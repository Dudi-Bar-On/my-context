import type { DatabaseSync } from 'node:sqlite';
import { INJECTION_OPS, type InjectionOp } from './audit.ts';

// --- How much of THIS window came from project knowledge --------------------
//
// One question, asked by two surfaces: `mycontext statusline` prints it as
// `myctx 41.8k` beside the context figure, and `/api/watch/context` serves it
// to the web strip, which renders it as "{tokens} of it from project
// knowledge". "OF IT" is the whole contract — of the context you are holding
// right now — and this module exists because the sum that answered it was true
// of something else entirely.
//
// **What was measured, 2026-08-31, on this repository's own corpus** (session
// `9e5b6b17…`, a 1,000,000-token window sitting at 25.1% full):
//
//     every injection record for the session      289 records   2,556,774 tokens
//     …bounded to the current compaction epoch    110 records   1,192,523 tokens
//     …and only the ops that reach THIS window     11 records     200,845 tokens
//
// The first figure is 2.5x the entire window: a monotonically increasing
// lifetime counter over fourteen days and nine compactions, printed next to a
// percentage of the window as though the two were commensurable.
//
// The second is the obvious fix — count only what was injected since the last
// compaction — and it is STILL 119% of the window. Bounding the time was not
// enough, and that is the finding this module is really built on:
//
// **`subagent-start` records carry the PARENT session's id.** A subagent is a
// model, so `INJECTION_OPS` files its delivery as an injection and keys it on
// `sessionId` (see that constant's own note: *the only thing separating it
// from `session-start` is which model received the text, and that is
// `sessionId`'s job rather than a kind's*). For the audit log that is right —
// `mycontext audit --kind injection` must not under-report what models were
// shown. For THIS question it is fatal: 991,678 of the epoch's 1,192,523
// tokens went into ninety-nine subagent windows that the operator's session
// never held a byte of. Summed into "of it", they are a claim about somebody
// else's context window presented as a claim about yours.
//
// So the bound is TWO bounds, and neither alone is sufficient.

/**
 * The injection ops whose text lands in the session's OWN context window.
 *
 * Derived from `INJECTION_OPS` by removing `subagent-start` rather than
 * written out, so a sixth injection op added later is included by default and
 * has to be excluded deliberately. The failure direction matters: a new op
 * silently left OUT would understate the share with no symptom, while one
 * wrongly left IN shows up as a figure that outgrows the window — which is how
 * this defect was caught at all.
 */
export const MAIN_WINDOW_INJECTION_OPS: readonly InjectionOp[] =
  INJECTION_OPS.filter((op) => op !== 'subagent-start');

export interface ContextShare {
  tokens: number;
  injections: number;
  unrecorded: number;
}

/**
 * When this session's current context epoch began: the `at` of the newest
 * `pre-compact` record for it, or `null` when it has never been compacted.
 *
 * `pre-compact` and not `post-compact`, for two reasons. It is the record that
 * FIRES — `post-compact` is written on completion and a compaction can leave
 * the first without the second (`audit.ts`: *a `pre-compact` row with no
 * `post-compact` row beside it is a compaction that started and did not
 * finish*) — and using the earlier of the pair errs towards counting an
 * injection that may already be gone, which overstates rather than invents.
 *
 * **`null` is "never compacted", not "unknown".** A session with no
 * `pre-compact` record has held everything ever injected into it, so an
 * unbounded sum is the correct answer for it and the caller applies no `since`
 * at all. That is the one case where the old behaviour was already right.
 *
 * A `/clear` is NOT a boundary this can see: it starts a new session id, so
 * the counter starts again on its own. A session RESUMED after a restart keeps
 * its id and its transcript, and so keeps its epoch — which is correct.
 */
export function contextEpochStart(db: DatabaseSync, sessionId: string): string | null {
  const row = db
    .prepare(`SELECT rec ->> '$.at' AS at FROM audit
                WHERE session_id = ? AND op = 'pre-compact'
                ORDER BY seq DESC LIMIT 1`)
    .get(sessionId) as { at?: unknown } | undefined;
  return typeof row?.at === 'string' ? row.at : null;
}

/**
 * The op filter as a SQL fragment, GENERATED from
 * `MAIN_WINDOW_INJECTION_OPS` and never typed out a second time.
 *
 * The list is interpolated rather than parameterised because it is this
 * module's own constant and not user input, and because the fragment is nested
 * inside `filterSelect`'s parameterised SQL, whose placeholders are positional
 * — a second set of `?` here would have to be threaded through every caller in
 * the right order to buy nothing.
 */
function opClause(column: string): string {
  return `${column} IN (${MAIN_WINDOW_INJECTION_OPS.map((op) => `'${op}'`).join(', ')})`;
}

/**
 * The share as ONE aggregate row over `filterSelect`'s own SELECT.
 *
 * The record-by-record version measured p95 71.8 ms over 5,000 injection
 * records on Claude Code's per-message path (`test/perf/statusline-latency.perf.ts`);
 * this returns one row and stops being proportional to the session's history
 * in JavaScript. `shareOf` below is the same rules in a loop, and
 * `test/cli/statusline.test.ts` runs both over one corpus and requires the
 * same answer — because "an absent `tokens` is counted, never summed as zero"
 * and "a `subagent-start` is somebody else's window" now each exist in two
 * languages.
 *
 * `json_type`, not `IS NOT NULL`: a JSON `null`, a missing key and a string
 * are all "no number here", which is what makes this agree with the loop's
 * `typeof record.tokens === 'number'` rather than merely resemble it.
 */
export function shareSql(inner: string): string {
  return `SELECT
      count(*) AS injections,
      coalesce(sum(CASE WHEN ty IN ('integer', 'real') THEN t ELSE 0 END), 0) AS tokens,
      coalesce(sum(CASE WHEN ty IN ('integer', 'real') THEN 0 ELSE 1 END), 0) AS unrecorded
    FROM (SELECT json_type(rec, '$.tokens') AS ty, rec ->> '$.tokens' AS t FROM (${inner})
            WHERE ${opClause(`rec ->> '$.op'`)})`;
}

/**
 * The same three figures over records already in hand — the loop the aggregate
 * replaced, kept executable so the two can be held to one answer over a real
 * corpus rather than by reading the SQL.
 *
 * Also the form the UI server uses: `/api/watch/context` already has the
 * records, and the row count it reports is small by construction because the
 * epoch bound is applied in the query.
 */
export function shareOf(records: { op?: unknown; tokens?: unknown }[]): ContextShare {
  const wanted = new Set<unknown>(MAIN_WINDOW_INJECTION_OPS);
  let tokens = 0;
  let unrecorded = 0;
  let injections = 0;
  for (const record of records) {
    if (!wanted.has(record.op)) continue;
    injections++;
    if (typeof record.tokens === 'number') tokens += record.tokens;
    else unrecorded++;
  }
  return { tokens, injections, unrecorded };
}

/**
 * The newest row in the audit log: its `op` and its `at`, or `null` for a log
 * with no rows in it.
 *
 * **Never throws.** A caller on Claude Code's per-message path cannot afford a
 * query that can take the status line down, and the difference between "the
 * log is empty" and "the read failed" is a distinction the CALLER has to draw
 * for the reader — so this returns `null` for empty and throws for nothing,
 * with the failure surfaced by the caller's own try. See `lastAudit` in
 * `cli/commands/statusline.ts`.
 *
 * **Cost, measured before it was built** (2026-09-01, this repository's own
 * corpus of 8,252 audit rows): p50 0.020 ms, p95 0.048 ms, on the connection
 * `myctxShare` already holds open — against a bar that already pays p95
 * 26.6 ms for that share. `seq` is the table's INTEGER PRIMARY KEY, so
 * `ORDER BY seq DESC LIMIT 1` walks the rowid index backwards and stops at the
 * first row. `EXPLAIN QUERY PLAN` prints `SCAN audit`, which reads alarming
 * and is not: there is no `WHERE`, so there is nothing to seek, and the LIMIT
 * ends the walk after one row. The measurement is the answer, not the plan.
 *
 * NOT filtered by session, deliberately. The question is whether this MACHINE
 * is still recording anything at all, and a filter would answer a narrower one
 * — while also being the expensive shape here: every column on this table is a
 * VIRTUAL generated column, so a predicate that is not the chosen index
 * re-extracts JSON per row (measured at p95 63 ms for a session filter).
 */
export function newestAuditRow(db: DatabaseSync): { op: string; at: string } | null {
  const row = db
    .prepare(`SELECT rec ->> '$.op' AS op, rec ->> '$.at' AS at
                FROM audit ORDER BY seq DESC LIMIT 1`)
    .get() as { op?: unknown; at?: unknown } | undefined;
  if (row === undefined) return null;
  return typeof row.op === 'string' && typeof row.at === 'string'
    ? { op: row.op, at: row.at }
    : null;
}
