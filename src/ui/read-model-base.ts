/**
 * **The six things every read endpoint in `src/ui/` already reached for.**
 *
 * Ten modules beside `read-model.ts` — `ask-model`, `capture-model`,
 * `packs-model`, `port-model`, `preview-history`, `proc-model`, `watch-model`,
 * `read-model-cli-help`, `read-model-config`, `read-model-work` — import
 * `badRequest`, `unknownParams`, `repeatedParams`, `withStores` and (two of
 * them) `coverageFiles` FROM `read-model.ts`. That import line is the boundary
 * this file makes real; nothing here is a new decision about what belongs
 * together, it is where the directory had already put the seam.
 *
 * It exists because the seam was one-way and had to stop being. While the
 * handlers and the primitives shared a file, a handler could only be split out
 * of `read-model.ts` by importing the primitives back from it, and
 * `read-model.ts` re-exporting the split module would close that into a cycle.
 * `src/doctor/finding.ts` is the same move one directory over and is the
 * precedent: the shared vocabulary went BELOW every check module, and
 * `checks.ts` then re-exported the checks that moved out without importing
 * anything back.
 *
 * **Nothing here reads a corpus except through the read-only doors.**
 * `withStores` opens both handles through `openReadOnlyChecked`, and
 * `coverageFiles` walks the repository through `listRepoFiles`, which reads
 * directory entries and nothing else. `test/ui/no-writes.test.ts` sees this
 * module in the `src/ui/` graph exactly as it saw these functions before, and
 * the set of write symbols bound in that graph is unchanged by the move — the
 * bodies below are the ones that shipped, moved and not rewritten.
 */
import { Ledger, LedgerUninitializedError } from '../core/ledger.ts';
import { Store } from '../core/store.ts';
import type { Workspace } from '../core/workspace.ts';
import { listRepoFiles } from '../doctor/checks.ts';
import type { JsonResult } from './routes.ts';

export const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/**
 * Refuse any query parameter this endpoint does not act on
 * (INV-nothing-is-dropped-silently). `/api/select?sesion=x` answering the
 * cold-session question because a typo dropped `session` would be this
 * project's canonical defect wearing an HTTP status of 200.
 */
export function unknownParams(url: URL, allowed: string[]): string | null {
  // An empty allow-list is a real case — `/api/sessions` and
  // `/api/session/:session/injected` take no parameters at all — and it needs
  // its own wording: `accepts: ` followed by nothing named nothing.
  const accepts = allowed.length === 0
    ? 'this endpoint accepts no parameters'
    : `this endpoint accepts: ${allowed.join(', ')}`;
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — ${accepts}. ` +
        'A parameter accepted and ignored would silently answer a different question.';
    }
  }
  return null;
}

/**
 * Refuse a parameter given twice. `URLSearchParams.get` returns the FIRST
 * occurrence, so `?event=tool&event=manual` would answer about `tool` and
 * discard `manual` without saying so — the same silent drop as an unknown
 * parameter, arriving through a spelling the allow-list cannot see.
 */
export function repeatedParams(url: URL): string | null {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) {
      return `parameter "${key}" was given more than once. Only the first value would be ` +
        'read, so the rest would be silently discarded; pass it exactly once.';
    }
    seen.add(key);
  }
  return null;
}

/**
 * **Both handles read-only, and both checked.** `Store.openReadOnlyChecked`
 * and `Ledger.openReadOnlyChecked` — the latter had to be built before the
 * first could be enough. `Ledger.open` execs `LEDGER_SCHEMA` on every call, so
 * opening a `Ledger` the ordinary way IS a schema write; swapping only the
 * `Store` call here would have left this function handing out a writable
 * ledger connection creating tables in a database the read path never
 * prepared — worse than before, not better.
 *
 * **`Ledger.open`'s "`Store.open` must have run first" prerequisite does not
 * apply, and neither half of it does.** It existed only to make a WRITABLE
 * ledger safe: `Store.open`'s corruption self-heal had to have
 * deleted-and-recreated a corrupt file first, and `Store.open` had to have set
 * `journal_mode = WAL` first because `Ledger.open` creates a missing database.
 * A read-only open can commit neither error — it cannot create a database at
 * all — and throwing on a corrupt file is the correct answer for a read path
 * rather than something to heal. The `Store` is still opened first, but only
 * because its `schema_version` check is what says this file is a my_context
 * index at all; nothing about the ledger open depends on it any more.
 *
 * **`ledger` is `Ledger | null`, and the null is a STATE, not a failure.** A
 * corpus whose ledger PROJECTION has not been built has `schema_version` and
 * `items` but no `ledger`/`ledger_source` tables at all. **That is not the
 * same as never having been injected into.** The table is a projection of the
 * audit log, and the only thing that writes it is `topUpLedger` — reached by
 * `mycontext status`, `mycontext decay` and `audit replay-ledger`, and by
 * nothing else. The hook stopped writing it when dedupe moved to the seen
 * file. So a corpus injected into a thousand times, on which no aggregate
 * CLI reader has ever run, arrives here with no tables. Refusing to serve the UI
 * against a fresh corpus would be wrong, so `Ledger.openReadOnlyChecked` marks
 * that one state with its own CLASS, `LedgerUninitializedError`, and only that
 * class is swallowed here. **The class is the whole test — never a message
 * match.** A corrupt file, a truncated one, half a ledger, or a table shape
 * this build does not read all propagate: `INV-nothing-is-dropped-silently`
 * cuts both ways, and reporting damage as an empty ledger is the same failure
 * as refusing a fresh corpus.
 *
 * **SETTLED by `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`,
 * `plan:rulings seq:26`'s re-decision.** This paragraph used to record the
 * question as open and said the owner had ruled the null renders as the
 * mockup's zero-data view — true when it was written, and now exactly
 * backwards. The ruling is the opposite: `not-projected` renders as its OWN
 * panel, never as the mockup's null state, because the null state means
 * "nothing here" and a corpus injected into a thousand times with no ledger
 * TABLE would be making that claim falsely. Every caller that USES the ledger
 * argument inherits `LedgerPresence` for exactly this reason — this function
 * only guarantees the state ARRIVES at the caller distinguishable from both an
 * empty result and a fault; which panel draws it is each screen's to build.
 *
 * `withStores` is where the three outcomes are decided, so it is where they
 * are proved. Carrying one of them into a response body is the CALLER's job
 * and starts at `apiSessions` — see `LedgerPresence`, which exists because a
 * `null` ledger and an empty one are the same JSON without it.
 */
export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T {
  const store = Store.openReadOnlyChecked(ws.dbPath);
  let ledger: Ledger | null = null;
  try {
    try {
      ledger = Ledger.openReadOnlyChecked(ws.dbPath);
    } catch (err) {
      // The not-projected empty state, and only it. Everything else is a
      // fault and must reach the caller.
      if (!(err instanceof LedgerUninitializedError)) throw err;
    }
    return fn(store, ledger);
  } finally {
    try { ledger?.close(); } catch { /* already closed */ }
    try { store.close(); } catch { /* already closed */ }
  }
}

/**
 * `listRepoFiles`' own bound (`doctor/checks.ts`'s private `FILE_LIMIT`),
 * named here because this endpoint has to DISCLOSE hitting it and cannot
 * disclose a number it does not have.
 *
 * **A second private copy of one number is a finding, not a design** — the
 * same finding `DECAY_WINDOW_DEFAULT` records for the decay window's three.
 * `FILE_LIMIT` belongs beside `listRepoFiles`, exported, so the walk and every
 * caller that must say "the walk stopped" read one constant. Reported to the
 * owner.
 */
export const COVERAGE_FILE_LIMIT = 20_000;

/**
 * The repository walk, plus whether it stopped short — asked for **one file
 * past the bound** so the two states are actually distinguishable.
 *
 * `files.length >= limit` (this task's own code block) cannot tell a
 * repository holding *exactly* the bound from one holding more: `walkFiles`
 * returns at most `limit` either way. It reports the complete walk as
 * truncated, and the coverage tree would draw a **not examined** segment over
 * a directory that was examined — the one state `gaps.note` says must never be
 * confused with another. Walking to `limit + 1` and slicing back makes
 * "there is at least one more file" a fact rather than an inference.
 *
 * **`limit` is a parameter because the bound is 20,000 and building a
 * repository that overflows it costs ~19 seconds of file creation** (measured
 * while writing `read-model.test.ts`). The decision therefore lives here,
 * where a test can drive it at both sides of a bound of 2, rather than only in
 * `apiCoverage`, where it could not be driven at all.
 *
 * **What this still cannot say is WHERE the walk stopped**, and the screen
 * needs that: the tree's third magnitude segment and the gaps table's
 * *"vendor/ — not examined — past the file limit"* both name a PATH. A single
 * global boolean cannot produce either, so Task 18 must not infer them from
 * it. Recorded in this task's plan and reported to the owner: **needs the
 * paths `listRepoFiles` did not reach.**
 */
export function coverageFiles(
  repoRoot: string, limit: number = COVERAGE_FILE_LIMIT,
): { files: string[]; truncated: boolean } {
  const probe = listRepoFiles(repoRoot, limit + 1);
  return { files: probe.slice(0, limit), truncated: probe.length > limit };
}
