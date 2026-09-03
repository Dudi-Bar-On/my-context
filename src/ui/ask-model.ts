import {
  AUDIT_KINDS, AUDIT_OPS, parseWhen, type AuditFilter, type AuditKind, type AuditOp,
} from '../core/audit.ts';
import { filterSelect, queryProjection, sessions, summaryByOp, topItems } from '../core/audit-db.ts';
import { Store } from '../core/store.ts';
import type { Layer, Origin, Status } from '../core/types.ts';
import { ORIGINS } from '../core/validate.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, repeatedParams, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { readProjection } from './watch-model.ts';

// --- Ask: structured queries with the SQL shown (spec §4 Ask) ---------------
//
// The builder's promise is that the SQL on screen IS the SQL that ran. For
// audit queries that is `filterSelect` — extracted from `queryProjection` so
// display and execution share one spelling
// (`core/audit-db.ts` · `export function filterSelect(filter: AuditFilter): { sql: string; params: (string | number)[] } {` · ~720).
// For corpus queries it is `corpusSelect` below, executed through a read-only
// `Store` with BIND PARAMETERS — never inlined values.
//
// **The parameters are the security half of this module, and the reason
// `Store.raw` grew a second argument.** `mycontext query` accepts SQL a human
// typed and guards it with `assertSelectOnly`
// (`cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~173),
// whose own docblock records that a denylist over a full SQL grammar cannot be
// complete and that it is nevertheless the ONLY barrier in front of
// `VACUUM INTO` — the one statement that writes a full copy of the database to
// a path the caller names and that `readOnly: true` does not refuse. Nothing
// here widens that surface: **this module accepts no SQL from anyone.** It
// accepts a fixed set of named filters, refuses every value it does not
// recognise, and assembles the statement itself from a template whose only
// interpolated pieces are two booleans it has already reduced to `0` or `1`.
// Every value a user can spell reaches the engine as a bind parameter, where
// SQL text and data cannot be confused for one another. Do not add a route
// that takes a statement: `assertSelectOnly` is a CLI-shaped guard for a
// human-typed one-off, and a browser is not that.
//
// Corpus queries NEVER rebuild the index (plan 1 design decision 1: the server
// reads what the hooks read). The CLI's `query` rebuilds first; this surface
// does not, which makes the documented `updated_at` trap STRICTER here — the
// Ask screen's caveat string says so.
//
// **Audit queries read the projection through the READ-ONLY door, and the
// plan's own sample did not.** It routed them through `openProjection` +
// `syncProjection`, and both write: `openProjection` calls `ensureLogDir`,
// creates the database when it is missing, sets `journal_mode = WAL`, runs
// twelve `CREATE … IF NOT EXISTS` on every open, and on any failure `rmSync`s
// the file and both sidecars; `syncProjection` inserts, and on `diverged`
// deletes every row first. A GET would therefore CREATE `.audit/audit.db`, and
// `test/ui/server-e2e.test.ts`'s byte-identical sweep catches that as the
// write it is. `watch-model.ts` was corrected the same way one task earlier and
// owns the one spelling of the policy — `readProjection`, imported here rather
// than copied — so both surfaces answer a missing projection identically:
//
//   * `fresh`  — the projection is current with its log; it answers.
//   * `absent` — nobody has built one. That is an EMPTY STATE, not a fault:
//                200 with no records and no rows, never a zero this surface
//                did not measure.
//   * behind / diverged / damaged — 503 naming the state and naming
//                `mycontext audit`, because syncing is a write and answering
//                from a stale projection would present a partial history as a
//                complete one (spec §5).
//
// The field is `projectionState`, not `projectionStateBeforeSync`: nothing
// syncs, so the older name asserted a property this code does not have.

const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const LAYERS: Layer[] = ['project', 'global'];

export interface CorpusFilter {
  type?: string;
  status?: Status;
  layer?: Layer;
  always?: boolean;
  scoped?: boolean;
  titleContains?: string;
  limit: number;
  /**
   * The ONE field this query negates, **by name** — never an operator the
   * caller spells. `CONST-no-http-route-accepts-sql-the-ask-screen-sends-a-structured`
   * requires the request be composed of fields, operators and bound values, and
   * this keeps to it exactly: a client sends a FIELD NAME out of a closed set,
   * and the operator is chosen below, here, in code.
   *
   * **Before 2026-08-26 neither builder could negate at all.** The Ask screen
   * offered `is not`, disabled it on every field with more than two values, and
   * said nothing about why — `negatable()` could only FAKE a negation by
   * flipping to the other value of a two-valued field, which is not negation,
   * it is a coincidence that happens to hold for booleans. The owner ruled the
   * cause be fixed rather than described.
   */
  negate?: 'type' | 'status' | 'layer' | 'always' | 'scoped' | 'titleContains';
}

const CORPUS_COLUMNS = 'id, type, title, status, always, has_scope, layer, file_path, updated_at';

/**
 * Pure. The final `LIMIT ?` binds `limit + 1` — the truncation probe, disclosed
 * on screen (design decision 10): one row more than asked for is the difference
 * between "there were exactly this many" and "there were more and you are not
 * seeing them", and it is dropped before the rows are returned.
 *
 * **Every value is a bind parameter.** `always` and `scoped` are the two
 * exceptions and they are not values a caller can spell: they arrive here as
 * `boolean`, having been refused by the handler unless they were literally `1`
 * or `0`, and they reach the SQL as the digit. A `LIKE` fragment has its own
 * wildcards escaped, because an unescaped `%` silently widens the question to
 * "every title" and answers it as if it were the one that was asked.
 */
export function corpusSelect(f: CorpusFilter): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  // `=` or `<>`, chosen HERE from the field NAME the caller sent. The operator
  // is never a token that crossed the wire, which is the whole of what the
  // no-SQL-on-the-route constraint asks for.
  const op = (field: string): string => (f.negate === field ? '<>' : '=');
  if (f.type !== undefined) { where.push(`type ${op('type')} ?`); params.push(f.type); }
  if (f.status !== undefined) { where.push(`status ${op('status')} ?`); params.push(f.status); }
  if (f.layer !== undefined) { where.push(`layer ${op('layer')} ?`); params.push(f.layer); }
  // **The two booleans negate by FLIPPING THE DIGIT, not by `<>`.** Both are
  // `NOT NULL` columns holding 1 or 0, so the two spellings select the same
  // rows — and `always = 0` reads as what it means, where `always <> 1` makes a
  // reader work out the complement of a two-valued column to get there.
  if (f.always !== undefined) {
    where.push(`always = ${(f.negate === 'always' ? !f.always : f.always) ? 1 : 0}`);
  }
  if (f.scoped !== undefined) {
    where.push(`has_scope = ${(f.negate === 'scoped' ? !f.scoped : f.scoped) ? 1 : 0}`);
  }
  if (f.titleContains !== undefined) {
    // **`NOT LIKE`, never `<>`.** The affirmative here is a SUBSTRING match, so
    // its negation is "does not contain" — `title <> ?` would ask whether the
    // title is not exactly that string, which answers a different question and
    // would quietly return almost every row.
    where.push(`title ${f.negate === 'titleContains' ? 'NOT LIKE' : 'LIKE'} ? ESCAPE '\\'`);
    params.push(`%${f.titleContains.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const clause = where.length === 0 ? '' : `\nWHERE ${where.join('\n  AND ')}`;
  params.push(f.limit + 1);
  return { sql: `SELECT ${CORPUS_COLUMNS}\nFROM items${clause}\nORDER BY id\nLIMIT ?`, params };
}

/**
 * `1` or `0`, and nothing else. `null` is the INVALID answer and the caller
 * refuses on it; `undefined` is "not asked", which is a third state and not a
 * `false` — filtering on `always = 0` is a different question from not
 * filtering on `always` at all.
 */
function boolParam(url: URL, name: string): boolean | undefined | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

function intParam(url: URL, name: string, min: number, max: number, fallback: number): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * `GET /api/ask/corpus` — the corpus query builder's server half.
 *
 * **It never rebuilds the index** (design decision 9): it reads what the hooks
 * read, through a checked read-only `Store`. `Store.openReadOnlyChecked` rather
 * than the bare `openReadOnly` the plan named, for the reason every other read
 * endpoint in this directory uses the checked door — the `schema_version` check
 * is what says this file is a my_context index at all, and it is still a
 * read-only open that creates nothing and migrates nothing.
 */
export function apiAskCorpus(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url,
    ['type', 'status', 'layer', 'always', 'scoped', 'title', 'limit', 'not'])
    ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);

  const status = url.searchParams.get('status');
  if (status !== null && !STATUSES.includes(status as Status)) {
    return badRequest(`status must be one of ${STATUSES.join(', ')}`);
  }
  const layer = url.searchParams.get('layer');
  if (layer !== null && !LAYERS.includes(layer as Layer)) {
    return badRequest(`layer must be one of ${LAYERS.join(', ')}`);
  }
  const always = boolParam(url, 'always');
  const scoped = boolParam(url, 'scoped');
  if (always === null || scoped === null) return badRequest('always and scoped accept 1 or 0');
  const limit = intParam(url, 'limit', 1, 1000, 100);
  if (limit === null) return badRequest('limit must be an integer between 1 and 1000');
  const type = url.searchParams.get('type');
  const title = url.searchParams.get('title');

  // **`not` names a FIELD, and the name is checked against a closed set.**
  //
  // This is the whole of how negation crosses the wire: no operator token, no
  // fragment of SQL, just one of six names the server already knows. An
  // unknown name is a 400 rather than an ignored parameter, for the reason
  // `unknownParams` refuses anything it did not declare — a filter that was
  // silently dropped answers a wider question than the one that was asked and
  // presents it as the answer.
  //
  // The wire spells the title filter `title` while the builder calls it
  // `titleContains`; the map is here rather than in `corpusSelect` so the
  // builder never sees a name the URL chose.
  const NEGATABLE: Record<string, NonNullable<CorpusFilter['negate']>> = {
    type: 'type', status: 'status', layer: 'layer',
    always: 'always', scoped: 'scoped', title: 'titleContains',
  };
  const notField = url.searchParams.get('not');
  if (notField !== null && !Object.hasOwn(NEGATABLE, notField)) {
    return badRequest(`not must name one of ${Object.keys(NEGATABLE).join(', ')}`);
  }
  // Negating a field the query does not filter on is a contradiction rather
  // than a no-op: `?not=status` with no `status=` would return every row while
  // claiming to have excluded something.
  const negated = notField === null ? null : NEGATABLE[notField];
  if (notField !== null) {
    const present: Record<string, boolean> = {
      type: type !== null, status: status !== null, layer: layer !== null,
      always: always !== undefined, scoped: scoped !== undefined, title: title !== null,
    };
    if (!present[notField]) {
      return badRequest(`not=${notField} needs a ${notField} value to negate`);
    }
  }

  const filter: CorpusFilter = {
    ...(type === null ? {} : { type }),
    ...(status === null ? {} : { status: status as Status }),
    ...(layer === null ? {} : { layer: layer as Layer }),
    ...(always === undefined ? {} : { always }),
    ...(scoped === undefined ? {} : { scoped }),
    ...(title === null ? {} : { titleContains: title }),
    ...(negated === null ? {} : { negate: negated }),
    limit,
  };
  const { sql, params } = corpusSelect(filter);
  const store = Store.openReadOnlyChecked(ws.dbPath);
  try {
    const fetched = store.raw(sql, params);
    const truncated = fetched.length > limit;
    return {
      status: 200,
      // `sql` and `params` travel with the rows because the screen SHOWS them,
      // and it may only show what actually ran. The extra probe row is dropped
      // here; `truncated` is the only trace it leaves, and without it a capped
      // answer would be a short answer presented as a complete one.
      body: { rows: truncated ? fetched.slice(0, limit) : fetched, sql, params, truncated },
    };
  } finally {
    store.close();
  }
}

/**
 * `GET /api/ask/audit` — the audit query builder's server half.
 *
 * Every filter is validated against the one declaration of its vocabulary
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~339 and
 * `core/audit.ts` · `export const AUDIT_OPS: AuditOp[] = [` · ~329) rather than
 * respelled here, and `since`/`until` go through `parseWhen` — the same parser
 * `mycontext audit` uses, so the UI and the CLI cannot come to disagree about
 * what `7d` means.
 */
export function apiAskAudit(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['since', 'until', 'kind', 'op', 'origin', 'item', 'session', 'limit'])
    ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const filter: AuditFilter = {};
  try {
    const since = url.searchParams.get('since');
    if (since !== null) filter.since = parseWhen(since, 'since');
    const until = url.searchParams.get('until');
    if (until !== null) filter.until = parseWhen(until, 'until');
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  const kind = url.searchParams.get('kind');
  if (kind !== null) {
    if (!AUDIT_KINDS.includes(kind as AuditKind)) {
      return badRequest(`kind must be one of ${AUDIT_KINDS.join(', ')}`);
    }
    filter.kind = kind as AuditKind;
  }
  const op = url.searchParams.get('op');
  if (op !== null) {
    if (!AUDIT_OPS.includes(op as AuditOp)) {
      return badRequest(`op must be one of ${AUDIT_OPS.join(', ')}`);
    }
    filter.op = op as AuditOp;
  }
  const origin = url.searchParams.get('origin');
  if (origin !== null) {
    if (!ORIGINS.includes(origin as Origin)) {
      return badRequest(`origin must be one of ${ORIGINS.join(', ')}`);
    }
    filter.origin = origin as Origin;
  }
  const item = url.searchParams.get('item');
  if (item !== null) filter.itemId = item;
  const session = url.searchParams.get('session');
  if (session !== null) filter.sessionId = session;
  const limit = intParam(url, 'limit', 1, 2000, 200);
  if (limit === null) return badRequest('limit must be an integer between 1 and 2000');
  filter.limit = limit;

  // Built BEFORE the read, and shown whatever the read finds. On the `absent`
  // state there are no records to show it beside — but the statement is what
  // the builder assembled from these filters, and hiding it there would leave
  // the screen unable to explain what it was about to ask. `projectionState`
  // is what says whether it ran.
  const { sql, params } = filterSelect(filter);
  const read = readProjection(root, (db) => queryProjection(db, filter));
  if (!read.ok) return read.refusal;
  return {
    status: 200,
    body: { records: read.value === null ? [] : read.value, sql, params, projectionState: read.state },
  };
}

// --- report=tasks: the one report that joins two stores ---------------------
//
// **`items.updated_at` IS NOT A CHANGE TIME, and that fact is the whole reason
// this report exists.** The index is rebuilt whole from Markdown on every write
// path, so every row is stamped in the same instant: measured on the real
// corpus 2026-08-23, all 368 items carry ONE distinct `updated_at`, and on the
// demo corpus all 29 carry one. A progress view drawn from that column would
// show 293 tasks that all changed at the same second, which is not a caveat —
// it is a wrong answer delivered with confidence. `corpusSelect` returns the
// column and the Ask screen's own caveat string warns about it; this report
// does not return it at all.
//
// The per-item change time lives in the AUDIT LOG's `mutation` records, whose
// `at` is stamped by `recordAudit` at the moment of the write. That is a
// different store behind a different door, so this report reads BOTH: the index
// through the checked read-only `Store` that `apiAskCorpus` uses, and the
// projection through `readProjection`, which is the one spelling of the
// stale-projection policy. Neither door writes, and neither is widened here.
//
// **The item's own `last_change` extra field is NOT used, having been measured
// and rejected.** The `task` category declares one, 133 of 293 tasks carry it,
// and on 2026-08-23 ALL 133 disagreed with the newest `mutation` for the same
// item — usually by seconds, once by nearly three hours in the direction that
// claims a change which had not happened yet. It is hand-typed, so it drifts,
// which is the same defect `plan:categories seq:18` records about the `state`
// tag. The log is the store that knows.
//
// **`state` is read from the `state:` TAG.** Measured 2026-08-23 across 293
// tasks: all 293 carry the tag, 213 also carry a `state` FIELD, and FIFTEEN of
// those disagree. Which of the two is canonical is `plan:categories seq:18`'s
// ruling to make and its work to land — the field becomes canonical and the tag
// becomes GENERATED from it, at which point the two cannot disagree and this
// SQL keeps working unchanged, because a projected tag is still a tag. Until
// then the tag is the only source that answers for EVERY task; the field
// answers for 73% of them, and a progress view with 80 blank cells is not a
// progress view. This report reads the tag, reports what it read, and repairs
// nothing.

/**
 * The index half. `plan`, `seq` and `state` are lifted out of the `tags` array
 * inside the `data` JSON, which is where a tag lives — the index has no tags
 * table and no tag column, which is exactly why `corpusSelect` cannot filter on
 * one and why this is a canned report rather than another filter field.
 *
 * The prefix is written twice in each subquery — once in the `LIKE` and once
 * inside `length(…)` — so the offset can never drift from the string it is the
 * length of. `LIKE` needs no `ESCAPE` here because these three patterns are
 * literals in this file and hold no `%` or `_`; the only value a caller can
 * spell reaches this statement as a bind parameter, as everywhere else in this
 * module.
 *
 * A second `state:` tag on one item is possible today — a tag is a set
 * membership and nothing enforces one — so the pick is made DETERMINISTIC by
 * `ORDER BY t.value` rather than left to storage order. Making it impossible is
 * `plan:categories seq:18`.
 *
 * `ORDER BY` is plan, then seq NUMERICALLY (`seq:10` follows `seq:2`, which a
 * text sort reverses), then id; tasks the corpus says nothing about sort last
 * rather than first, because an unplanned task is not the head of every plan.
 * The final `LIMIT ?` binds `limit + 1` — the same truncation probe
 * `corpusSelect` uses, and for the same reason: a progress view that silently
 * shows 20 of 293 tasks is worse than one that refuses.
 */
const TASKS_CORPUS_SQL = `SELECT id AS label, title, status,
       (SELECT substr(t.value, length('plan:') + 1)
          FROM json_each(items.data, '$.tags') t
         WHERE t.value LIKE 'plan:%'  ORDER BY t.value LIMIT 1) AS plan,
       (SELECT substr(t.value, length('seq:') + 1)
          FROM json_each(items.data, '$.tags') t
         WHERE t.value LIKE 'seq:%'   ORDER BY t.value LIMIT 1) AS seq,
       (SELECT substr(t.value, length('state:') + 1)
          FROM json_each(items.data, '$.tags') t
         WHERE t.value LIKE 'state:%' ORDER BY t.value LIMIT 1) AS state
FROM items
WHERE type = ?
ORDER BY plan IS NULL, plan, CAST(seq AS INTEGER), seq, label
LIMIT ?`;

/**
 * The audit half: how many times each item has been changed, when it was last
 * changed, and what the last change WAS.
 *
 * `kind = 'mutation'` and nothing else. An `injection` names an item too — it
 * is why `audit_item` exists — but being injected into a session is not a
 * change to the item, and counting it would report a task nobody has touched
 * as this week's busiest.
 *
 * Constant: it binds NOTHING. It aggregates every item rather than the page of
 * tasks above, which costs a grouped scan of an indexed column and buys a
 * statement whose text does not vary with the request — so the SQL shown beside
 * the answer is this string, not a reconstruction of it.
 *
 * The last op is a correlated subquery rather than a bare column beside
 * `MAX(at)`. SQLite would in fact answer the bare column from the max row, but
 * that is an engine guarantee a reader has to know to trust, and this statement
 * is written to be READ on a screen.
 */
const TASKS_CHANGES_SQL = `SELECT a.item_id AS id, COUNT(*) AS changes, MAX(a.at) AS last,
       (SELECT b.op FROM audit b
         WHERE b.item_id = a.item_id AND b.kind = 'mutation'
         ORDER BY b.at DESC, b.seq DESC LIMIT 1) AS last_op
FROM audit a
WHERE a.kind = 'mutation' AND a.item_id IS NOT NULL
GROUP BY a.item_id`;

/** What the audit log knows about one item, or nothing at all. */
interface ItemChanges { count: number; lastOp: string | null; last: string | null }

/**
 * One row per task.
 *
 * `label`, `count` and `last` carry `SummaryRow`'s own names on purpose: the
 * other three reports return `{ label, count, last }`, the Ask screen already
 * maps exactly those three into its At · Kind · What columns (they were
 * At · Item · Role until 2026-08-29, `plan:walk seq:73`; the mapper is the
 * same one and a summary row still claims no kind of its own)
 * (`src/ui/public/screens/ask.js` · `export function summaryRows(report, role, rows) {` · ~461),
 * and a fourth report that renamed them would need a fourth mapper to show
 * anything at all. This row is that shape plus the columns a progress view
 * needs, so it fits the screen as it stands and a screen that wants the extra
 * columns can reach for them without a translation layer.
 *
 * **`count`, `lastOp` and `last` are `null` when the AUDIT STORE could not
 * answer, and `0`/`null` when it answered "none".** Those are different facts.
 * A projection nobody has built has measured nothing, and reporting it as zero
 * changes would invent a number; a fresh projection holding no `mutation` for
 * an item has measured zero, which is a real answer. `projectionState` on the
 * body says which of the two the reader is looking at.
 */
export interface TaskProgressRow {
  /** The item id. */
  label: string;
  /** The name the owner asked for. */
  title: string;
  plan: string | null;
  seq: string | null;
  /** Progress, from the `state:` tag. `null` means the corpus does not say. */
  state: string | null;
  status: string;
  /** Mutations in the audit log. `null` = the audit store could not answer. */
  count: number | null;
  lastOp: string | null;
  /** The real change time: the newest `mutation` for this item. */
  last: string | null;
}

/**
 * `report=tasks` — name, plan, seq, progress, status, change count, last op and
 * last change time, per task.
 *
 * The corpus is read FIRST and is the spine of the report: it is what says
 * which tasks exist. The audit projection is read second and only decorates
 * rows the index already produced — so a task with no history is a task with an
 * empty history, never a task that vanished.
 *
 * A stale projection REFUSES the whole report (503, naming the state), exactly
 * as `report=ops` does through the same `readProjection`. Half a report served
 * under the same name as a whole one is the failure mode this codebase keeps
 * finding, and on this surface a stale projection is routine rather than
 * exotic: every 401 appends an `access` record, which pushes the log past the
 * projection and leaves it `behind` until `mycontext audit` runs.
 */
function taskProgressReport(ws: Workspace, root: string, limit: number): JsonResult {
  const params: (string | number)[] = ['task', limit + 1];
  const store = Store.openReadOnlyChecked(ws.dbPath);
  let fetched: Record<string, unknown>[];
  try {
    fetched = store.raw(TASKS_CORPUS_SQL, params);
  } finally {
    store.close();
  }
  const truncated = fetched.length > limit;
  const page = truncated ? fetched.slice(0, limit) : fetched;

  const read = readProjection(root, (db) => {
    const changes = new Map<string, ItemChanges>();
    for (const row of db.prepare(TASKS_CHANGES_SQL).all() as
      { id: string; changes: number; last: string | null; last_op: string | null }[]) {
      changes.set(row.id, {
        count: Number(row.changes), lastOp: row.last_op, last: row.last,
      });
    }
    return changes;
  });
  if (!read.ok) return read.refusal;
  const changes = read.value;

  const rows: TaskProgressRow[] = page.map((row) => {
    const label = String(row['label']);
    // The two silences, kept apart. `changes === null` is the ABSENT
    // projection — nothing was asked, so nothing is claimed. A `Map` that
    // simply has no entry for this id is a projection that WAS asked and holds
    // no mutation for it, which is a measured zero and a different sentence.
    const found: ItemChanges | null = changes === null
      ? null
      : changes.get(label) ?? { count: 0, lastOp: null, last: null };
    return {
      label,
      title: String(row['title']),
      plan: (row['plan'] as string | null) ?? null,
      seq: (row['seq'] as string | null) ?? null,
      state: (row['state'] as string | null) ?? null,
      status: String(row['status']),
      count: found === null ? null : found.count,
      lastOp: found === null ? null : found.lastOp,
      last: found === null ? null : found.last,
    };
  });

  return {
    status: 200,
    body: {
      report: 'tasks',
      rows,
      // **Only the statements that RAN.** The screen shows the SQL as the
      // account of how an answer was reached, so an audit statement displayed
      // beside rows whose change columns are null — because there was no
      // projection to run it against — would be an account of something that
      // did not happen.
      sql: changes === null
        ? `${TASKS_CORPUS_SQL};`
        : `${TASKS_CORPUS_SQL};\n\n${TASKS_CHANGES_SQL};`,
      params,
      truncated,
      projectionState: read.state,
    },
  };
}

/**
 * `GET /api/ask/summary` — the four predefined reports. Three come straight
 * from `summaryByOp` / `topItems` / `sessions`; the fourth is `taskProgressReport`
 * above, the only one that reads a second store.
 *
 * `summaryByOp` takes no limit: it reports every op, of which there are a
 * couple of dozen in the whole vocabulary. `topItems`' `role: null` form
 * answers `report=items` with no role — every role at once, which is a
 * different question from any one of them and not a default for it.
 */
export function apiAskSummary(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['report', 'role', 'limit']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };
  const report = url.searchParams.get('report');
  if (report !== 'ops' && report !== 'items' && report !== 'sessions' && report !== 'tasks') {
    return badRequest('report must be one of ops, items, sessions, tasks');
  }
  const role = url.searchParams.get('role');
  // Refused rather than ignored: a `role` accepted and dropped would answer a
  // different question from the one on screen and report it as the same one.
  if (role !== null && report !== 'items') return badRequest('role applies only to report=items');
  if (role !== null && !['subject', 'injected', 'spilled'].includes(role)) {
    return badRequest('role must be one of subject, injected, spilled');
  }
  const limit = intParam(url, 'limit', 1, 200, 20);
  if (limit === null) return badRequest('limit must be an integer between 1 and 200');

  // Answered before the three below because it is not one of them: its rows
  // come from the index as well as the projection, it discloses a cap, and it
  // shows the SQL it ran. Folding it into the ternary would have made those
  // three differences invisible at the call site.
  if (report === 'tasks') return taskProgressReport(ws, root, limit);

  const read = readProjection(root, (db) => (
    report === 'ops' ? summaryByOp(db)
    : report === 'items' ? topItems(db, role, limit)
    : sessions(db, limit)
  ));
  if (!read.ok) return read.refusal;
  return {
    status: 200,
    // An absent projection answers with NO rows rather than a row of zeroes:
    // a report of zeroes is a claim about a log this endpoint has not read.
    body: { report, rows: read.value === null ? [] : read.value, projectionState: read.state },
  };
}

/**
 * Registered from inside `registerReadRoutes()`'s once-only guarded body, the
 * way `registerWorkRoutes()` and `registerWatchRoutes()` are, and for the same
 * two reasons: `startUiServer` is called repeatedly in one process by
 * `test/ui/server.test.ts`, so an unguarded second registration would throw;
 * and `server-e2e.test.ts`'s "every registered read route is in the sweep" asks
 * that function what the table holds, so a route registered only on the
 * server-start path would be invisible to it.
 */
export function registerAskRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/ask/corpus', json(apiAskCorpus));
  registerRoute('GET', '/api/ask/audit', json(apiAskAudit));
  registerRoute('GET', '/api/ask/summary', json(apiAskSummary));
}
