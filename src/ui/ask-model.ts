import {
  AUDIT_KINDS, AUDIT_OPS, parseWhen, type AuditFilter, type AuditKind, type AuditOp,
} from '../core/audit.ts';
import { filterSelect, queryProjection, sessions, summaryByOp, topItems } from '../core/audit-db.ts';
import { Store } from '../core/store.ts';
import type { Layer, Origin, Status } from '../core/types.ts';
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
// (`cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~114),
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
const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

export interface CorpusFilter {
  type?: string;
  status?: Status;
  layer?: Layer;
  always?: boolean;
  scoped?: boolean;
  titleContains?: string;
  limit: number;
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
  if (f.type !== undefined) { where.push('type = ?'); params.push(f.type); }
  if (f.status !== undefined) { where.push('status = ?'); params.push(f.status); }
  if (f.layer !== undefined) { where.push('layer = ?'); params.push(f.layer); }
  if (f.always !== undefined) where.push(`always = ${f.always ? 1 : 0}`);
  if (f.scoped !== undefined) where.push(`has_scope = ${f.scoped ? 1 : 0}`);
  if (f.titleContains !== undefined) {
    where.push(`title LIKE ? ESCAPE '\\'`);
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
  const bad = unknownParams(url, ['type', 'status', 'layer', 'always', 'scoped', 'title', 'limit'])
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

  const filter: CorpusFilter = {
    ...(type === null ? {} : { type }),
    ...(status === null ? {} : { status: status as Status }),
    ...(layer === null ? {} : { layer: layer as Layer }),
    ...(always === undefined ? {} : { always }),
    ...(scoped === undefined ? {} : { scoped }),
    ...(title === null ? {} : { titleContains: title }),
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
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~242 and
 * `core/audit.ts` · `export const AUDIT_OPS: AuditOp[] = [` · ~238) rather than
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

/**
 * `GET /api/ask/summary` — the three predefined reports, straight from
 * `summaryByOp` / `topItems` / `sessions`.
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
  if (report !== 'ops' && report !== 'items' && report !== 'sessions') {
    return badRequest('report must be one of ops, items, sessions');
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
