import { rmSync } from 'node:fs';

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
  rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
}
