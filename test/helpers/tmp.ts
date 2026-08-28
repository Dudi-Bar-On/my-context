import { rmSync } from 'node:fs';
import { closeProjectionUpkeep } from '../../src/core/audit-db.ts';

/**
 * Remove a temp directory tree, retrying briefly on the transient failures
 * Windows produces.
 *
 * **The one owner of test temp-directory cleanup.** Every test in this suite
 * used to end with a bare `rmSync(dir, { recursive: true, force: true })` —
 * 403 call sites across 57 files — and `force: true` does NOT retry: it
 * suppresses "does not exist", nothing more. `maxRetries` defaults to 0.
 *
 * On Windows a directory cannot be removed while any handle to anything
 * inside it is still open, and a handle can outlive the call that closed it:
 * SQLite's `.index.db`/`-wal`/`-shm` files are released asynchronously by the
 * OS after `close()`, a spawned child process's cwd pins its own directory
 * until the process is fully reaped, and Defender/the search indexer open
 * files behind the test's back. Each of those is a millisecond-scale window,
 * and each surfaces as `EPERM: Permission denied` from `rmSync` — thrown from
 * a cleanup line, so the test that FAILS is whichever one happened to be
 * unlucky, not the one that leaked anything.
 *
 * This is the third of three flakes measured against this branch (~2 spurious
 * failures per ~30 full-suite runs, none reproducible when a file is run
 * alone, because the contention comes from the full run's own concurrency).
 * Reproduced here in 1 of 5 full runs, on
 * `test/hooks/session-start.test.ts`'s "the load-error line still appears
 * when nothing at all was selected" — a test that touches neither SQLite
 * handles nor child processes, which is what makes the point: the failure has
 * nothing to do with the test it lands on.
 *
 * A red suite makes every mutation result worthless (this ledger records a
 * "10/10 killed" read against one), so a cleanup that fails 1 run in 5 is not
 * cosmetic — it is a hole in the signal the whole suite exists to provide.
 *
 * 20 attempts with a 25ms backoff is ~5s worst case and, in practice, one
 * extra attempt on the rare failure. `rmSync`'s own retry covers exactly the
 * codes at issue (`EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, `EPERM`); a
 * genuine permission error still throws after the budget rather than being
 * swallowed, so a real leak is still reported.
 *
 * `test/no-bare-rmsync.test.ts` fails if a test file goes back to calling
 * `rmSync` recursively itself — the fix has to stay reachable from every call
 * site, not be a helper some files happen to use.
 */
export function removeTree(dir: string): void {
  // `recordAudit` holds one upkeep connection per audit projection for the life
  // of the PROCESS — measured, and the alternative was 10 ms per record on the
  // hook path (`core/audit-db.ts` · `interface UpkeepHandle`). In production
  // that handle outlives nothing that matters: a hook exits, and the UI server
  // wants it. In a test run, every temp corpus is deleted while this process
  // keeps running, and on Windows a directory cannot be removed while a handle
  // inside it is open — so without this line the occasional, reported leak
  // above becomes a certain one on every run, and the signal it exists to give
  // is buried. The next append reopens.
  closeProjectionUpkeep();
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  } catch (err) {
    unremovable.push(`${dir} (${(err as NodeJS.ErrnoException)?.code ?? 'unknown'})`);
  }
}

/**
 * Paths the retry budget above did not manage to remove.
 *
 * **Why cleanup does not throw, stated plainly because swallowing an error is
 * normally the wrong answer.** The retry budget is ~4.75s (Node backs off by
 * `i * retryDelay`), and one failure still got through 22 full-suite runs
 * after it was added — on `session-start-restore.test.ts`, whose only handles
 * are a `Store` and a `Ledger` that `buildInjection` closes in a `finally`
 * (checked, not assumed). At that point the remaining cause is outside this
 * repository: a scanner or indexer holding a freshly-written `.index.db` for
 * longer than any budget worth paying.
 *
 * The trade being made: a leaked temp directory costs disk in `%TEMP%` and is
 * reported below. A throw from a cleanup line costs a RED SUITE, attributed
 * to whichever test was unlucky — and this ledger records two occasions where
 * a mutation result was read against a red suite and believed. The leak is
 * the cheaper failure, and it is the one that does not lie about which test
 * is broken.
 *
 * It is not silent: the exit handler prints every path and its errno to
 * stderr. A REAL leak — a test that forgets to close a store — shows up there
 * as a persistent entry rather than an occasional one, which is the signal
 * that would otherwise have been buried under the flake.
 */
const unremovable: string[] = [];

process.on('exit', () => {
  if (unremovable.length === 0) return;
  process.stderr.write(
    `\nremoveTree: ${unremovable.length} temp director${unremovable.length === 1 ? 'y' : 'ies'} ` +
    `could not be removed after ~4.75s of retries. Leaked, not failed — see ` +
    `test/helpers/tmp.ts for why. A path that appears here on EVERY run is a real handle leak:\n` +
    unremovable.map((p) => `  ${p}\n`).join(''),
  );
});
