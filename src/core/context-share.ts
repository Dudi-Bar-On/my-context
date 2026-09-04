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
//
// **A third bound, found 2026-09-04 on this repository's own live session**
// (`595db3b1…`, a 1,000,000-token window): even with both bounds above
// applied, the figure was 1,699,381 tokens over 138 records — 170% of the
// window. Both prior bounds are about WHICH RECORDS to look at; this one is
// about what a record MEANS. `jit` fires on every file touch and reselects a
// working set from scratch each time, so the SAME items recur across many
// records in one epoch — the sample above held 138 records naming only 367
// distinct (item, tier) pairs between them. Summing every record's `tokens`
// charges that recurring set once per record, when the true cost of holding
// it in the window is paid once.
//
// **What is KNOWABLE from the log alone: distinct items.** `Ledger.entries`
// (`core/ledger.ts`) already answers "what has this session been shown" with
// one row per `(session, item, tier)` — first-seen only, because `record()`
// is `INSERT ... ON CONFLICT DO NOTHING`. That is the proof this dedupe is
// sound, not the mechanism: the ledger carries no `tokens` column, so it
// cannot SIZE what it names. Sizing has to come from the audit log's own
// `injected` field, which every record in `MAIN_WINDOW_INJECTION_OPS` already
// carries beside its `tokens` total — so `shareOf`/`shareSql` below re-derive
// the ledger's own rule (first appearance wins, in session order) directly
// over the records they already hold, and charge each record's `tokens` only
// on the record that is the FIRST to deliver at least one of its items. A
// record that redelivers only items already charged contributes nothing —
// which is the exact shape of the 138-vs-367 finding above, and why a session
// that reselects the same pinned set every tool call now costs what that set
// costs once, not once per tool call.
//
// **What is NOT knowable from the log alone, even now: eviction.** Nothing
// here observes what leaves the window between compactions — an old tool
// result trimmed by the platform's own context management, say. An item
// charged at its first delivery keeps counting for the rest of the epoch even
// if it was quietly dropped an hour later. So this is a much closer estimate
// than "everything ever emitted", but it is still an UPPER bound on what is
// actually resident, never a measured one — and the two callers say so on the
// name rather than the value: see the `≈`/`≥` qualifier logic in
// `cli/commands/statusline-powerline.ts`, ~line 1956.

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
 * module's own constant and not user input, and because the fragment is
 * nested inside `shareSql`'s own parameterised query below, whose
 * placeholders are positional — a second set of `?` here would have to be
 * threaded through in the right order to buy nothing.
 */
function opClause(column: string): string {
  return `${column} IN (${MAIN_WINDOW_INJECTION_OPS.map((op) => `'${op}'`).join(', ')})`;
}

/**
 * The share as ONE aggregate query — over `audit` joined to `audit_item`,
 * not over `filterSelect`'s SELECT, and that departure is deliberate enough
 * to earn its own paragraph below.
 *
 * **`injections` and `unrecorded`/`tokens` answer different questions now,
 * and that is deliberate.** `injections` stays a plain count of every
 * matching record — the raw event count `/api/watch/context` already shows
 * as "N injections", unaffected by this file — while `tokens` and
 * `unrecorded` are charged only on the record that FIRST delivers each
 * `(item, tier)` pair, per the module header's finding. A record that
 * redelivers a set already charged still counts as an injection; it
 * contributes nothing to either sum.
 *
 * **Why this is NOT `filterSelect`'s SELECT wrapped, unlike every other
 * reader of this log.** "First" needs an ORDER — some way to tell which of
 * two records naming the same item came earlier — and the table already has
 * one: `seq`, its `INTEGER PRIMARY KEY`, assigned in insertion order.
 * `filterSelect`'s unbounded branch never selects it (only `json(rec)`), so
 * the first version of this query manufactured an order instead, with
 * `ROW_NUMBER() OVER (ORDER BY rec ->> '$.at')` and `json_each` unpacking
 * every record's own `injected` array. It gave the right answer — measured
 * against this repository's own live session (138 records, 367 distinct
 * items), p50 27 ms / p95 37 ms — but `test/perf/statusline-latency.perf.ts`'s
 * far-tail case (5,000 injections, one session, all sharing one small item
 * set) measured p95 130 ms against a 120 ms ceiling: `json_each` tokenising
 * every record's array, for every record, is quadratic in spirit even
 * though the SET it resolves to is small. `audit_item` already holds one
 * row per `(seq, item_id, role)` — `hooks/*.ts` writes it beside every
 * injection record for exactly this shape of question — so joining it costs
 * an indexed lookup instead of a JSON parse, and `seq` is the real order
 * rather than a manufactured one. Re-measured on the SAME perf fixture:
 * p95 5.0 ms at 10 records, 12.9 ms at 1,000, 42.3–49.8 ms at 5,000 —
 * against ceilings of 50 ms and (for the 5,000 tail) 120 ms. The three plain
 * conditions this duplicates from `filterSelect` (`kind = 'injection'`,
 * `session_id = ?`, `at >= ?`) are narrow and stable enough that the risk of
 * the two drifting is worth the 2–3× this buys back; nothing else about the
 * filter is respelled.
 *
 * **`role = 'injected'`**, never `'spilled'` or `'subject'` — the same three
 * roles `filterSelect`'s `itemId` filter already reads off this table.
 * A record with nothing in `injected` (an empty selection) contributes no
 * `audit_item` row and is correctly never a `first_positions` entry.
 *
 * `shareOf` below is the same rule as a loop over records already in hand,
 * and `test/cli/statusline.test.ts` runs both over one corpus and requires
 * the same answer — the same reason the two existed before this rule
 * existed: "an absent `tokens` is counted, never summed as zero" and "a
 * `subagent-start` is somebody else's window" each already had to exist in
 * two languages, and "each item is charged once" is now the third rule that
 * does.
 */
export function shareSql(
  sessionId: string, since: string | null,
): { sql: string; params: (string | number)[] } {
  const params: (string | number)[] = since === null ? [sessionId] : [sessionId, since];
  const sinceClause = since === null ? '' : 'AND at >= ?';
  const sql = `
    WITH filtered AS (
      SELECT seq FROM audit
      WHERE kind = 'injection' AND session_id = ? ${sinceClause} AND ${opClause('op')}
    ),
    item_positions AS (
      SELECT ai.seq AS seq, ai.item_id AS item_id, ai.tier AS tier
      FROM audit_item ai JOIN filtered f ON f.seq = ai.seq
      WHERE ai.role = 'injected'
    ),
    first_positions AS (
      SELECT item_id, tier, MIN(seq) AS first_seq
      FROM item_positions
      GROUP BY item_id, tier
    ),
    introducing AS (
      SELECT DISTINCT first_seq AS seq FROM first_positions
    )
    SELECT
      (SELECT count(*) FROM filtered) AS injections,
      coalesce((SELECT sum(CASE WHEN json_type(a.rec, '$.tokens') IN ('integer', 'real')
                                 THEN a.rec ->> '$.tokens' ELSE 0 END)
                  FROM filtered f JOIN introducing i ON i.seq = f.seq
                  JOIN audit a ON a.seq = f.seq), 0) AS tokens,
      coalesce((SELECT sum(CASE WHEN json_type(a.rec, '$.tokens') IN ('integer', 'real')
                                 THEN 0 ELSE 1 END)
                  FROM filtered f JOIN introducing i ON i.seq = f.seq
                  JOIN audit a ON a.seq = f.seq), 0) AS unrecorded
  `;
  return { sql, params };
}

/**
 * One item's dedupe key — `(tier, id)`, because a pinned-then-restored item
 * is two real deliveries in `Ledger.record`'s own accounting and stays two
 * here for the same reason. `null` for anything that is not a real
 * `{ id: string, tier: string }` entry, so a malformed one is dropped rather
 * than coerced into a key that collides with a real item's.
 */
function itemKey(entry: unknown): string | null {
  if (entry === null || typeof entry !== 'object') return null;
  const id = (entry as { id?: unknown }).id;
  const tier = (entry as { tier?: unknown }).tier;
  return typeof id === 'string' && typeof tier === 'string' ? `${tier}:${id}` : null;
}

/**
 * The same rule as `shareSql`, as a loop over records already in hand — kept
 * executable so the two can be held to one answer over a real corpus rather
 * than by reading the SQL, and because it is also the form the UI server
 * uses: `/api/watch/context` already has the records, and the row count it
 * reports is small by construction because the epoch bound is applied in
 * the query.
 *
 * `seen` is every `(tier, id)` this pass has already charged, in the order
 * the caller's own records arrive — `queryProjection` orders by `seq`, which
 * IS delivery order, so this needs no `at`-sort of its own the way `shareSql`
 * does. A record is charged in full — its whole `tokens`, never a per-item
 * share of it — the first time ANY of its items is new, and every one of its
 * items (new or not) is marked seen before moving on, so a later record
 * redelivering the same set finds nothing left to introduce.
 */
export function shareOf(
  records: { op?: unknown; tokens?: unknown; injected?: unknown }[],
): ContextShare {
  const wanted = new Set<unknown>(MAIN_WINDOW_INJECTION_OPS);
  const seen = new Set<string>();
  let tokens = 0;
  let unrecorded = 0;
  let injections = 0;
  for (const record of records) {
    if (!wanted.has(record.op)) continue;
    injections++;
    const delivered = Array.isArray(record.injected) ? record.injected : [];
    let introducesNew = false;
    for (const entry of delivered) {
      const key = itemKey(entry);
      if (key !== null && !seen.has(key)) introducesNew = true;
    }
    for (const entry of delivered) {
      const key = itemKey(entry);
      if (key !== null) seen.add(key);
    }
    if (!introducesNew) continue;
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

/**
 * **The newest audit row, in the three states a reader must be able to tell
 * apart:** a row, an empty log, and a read that failed.
 *
 * Declared beside `newestAuditRow` rather than in either bar, because BOTH
 * bars draw it since 2026-09-01 and the three states are the whole point of
 * the type. "Nothing has been recorded" is a MEASUREMENT and "I could not
 * tell" is not; collapsing them makes a broken projection look like a quiet
 * machine, which is precisely the confusion this field exists to end.
 *
 * `at` is passed through and NEVER aged here. Both renderers compute the age
 * from their own render time, because a duration frozen when the value was
 * fetched is the fossil defect this product has already shipped three times.
 */
export type LastAuditRead =
  | { state: 'known'; op: string; at: string }
  | { state: 'empty' }
  | { state: 'unreadable' };
