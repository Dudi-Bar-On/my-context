import type { ServerResponse } from 'node:http';
import { AUDIT_KINDS, type AuditKind, type AuditRecord } from '../core/audit.ts';
import {
  openProjectionReadOnlyChecked, queryProjection, topItems,
  ProjectionAbsentError, ProjectionStaleError, type SummaryRow,
} from '../core/audit-db.ts';
import { AuditTail } from '../core/audit-tail.ts';
import { classifyContext, readTee, type ContextSample } from '../core/statusline-tee.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, repeatedParams, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { SECURITY_HEADERS } from './security.ts';

// --- Watch: the live view (spec §4 Watch, §5) -------------------------------
//
// Spills are the centre of this module, not a detail. A `spilled` entry is
// the ONLY record anywhere of an item that was selected and did not fit the
// budget — the ledger records deliveries only — so "why didn't Claude see
// this item" is answered here and nowhere else.
//
// **NOTHING HERE OPENS A LEDGER.** The activity pulse's series comes from the
// audit projection (owner ruling A2): `at` and `kind` are two generated
// columns of the same audit row, both indexed, so no join is required. The
// ledger has no kind at all, and its `(session_id, item_id, tier)` key
// collides repeat injections inside a session, so a series drawn from it
// undercounts by exactly those repeats — `Ledger.history()`'s own docblock
// says so (`core/ledger.ts` · `from it undercounts by exactly the repeats the key swallowed. Which stamp` · ~452).
//
// **NOTHING HERE WRITES, AND THAT COST THE PLAN'S OWN SHAPE.** The plan routed
// all three JSON endpoints through `openProjection` + `syncProjection`. Both
// write: `openProjection` calls `ensureLogDir`, creates the database when it
// is missing, sets `journal_mode = WAL`, runs twelve `CREATE … IF NOT EXISTS`
// on every open, and on any failure `rmSync`s the file and both sidecars;
// `syncProjection` inserts, and on `diverged` deletes every row first. The
// read-only door that arrived for exactly this caller is used instead
// (`core/audit-db.ts` · `export function openProjectionReadOnlyChecked(root: string): DatabaseSync {` · ~537),
// and its own docblock names `/api/watch/spills` as one of the routes the
// plan would otherwise have let delete and rebuild a database from a GET.
//
// **So a stale projection is REPORTED, never repaired** (owner ruling C1).
// `syncProjection` would fix it and fixing it is a write, so the three
// outcomes the door distinguishes by CLASS are carried through to the wire by
// `readProjection` below: a healthy current projection answers; one that was
// never built is the `absent` empty state, disclosed and answered with NO
// data rather than with zeroes; one that is behind or diverged, and anything
// damaged, is a 503 naming what is wrong and the command that ends it.
//
// Staleness rule (spec §5): every projection read here reports what it found;
// a projection that cannot vouch for the log is a refusal, never a quiet
// partial. The live stream reads the JSONL itself (`AuditTail`) and is exempt
// from that rule only because it never claims completeness — it is "what has
// landed since you connected", with `resync` disclosing any discontinuity.

export const STREAM_POLL_MS = 1000;

/**
 * Pure: `buckets` intervals of `bucketMs` ending at `now`, oldest first, each
 * carrying a total and a per-kind breakdown — the pulse's column height and
 * the shape of what is in it.
 *
 * Every kind in `AUDIT_KINDS` is present on every bucket, at zero. A key left
 * out where nothing happened would leave a reader unable to tell "no records
 * of that kind" from "this build does not know that kind" — design decision
 * 3's absence-is-not-zero rule, read in the other direction. There are SIX
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~242), taken
 * from the one declaration rather than respelled here.
 *
 * **What colour any of this is drawn in is NOT decided here and must not be.**
 * The six kinds do not map cleanly onto the approved visual direction's four
 * meaning-hues; that is an open owner decision. This function ships the data,
 * the buckets and the counts, and names no colour.
 */
export function recordVolume(
  rows: { at: string; kind: string }[], bucketMs: number, buckets: number, now: number,
): { start: string; total: number; byKind: Record<AuditKind, number> }[] {
  const begin = now - bucketMs * buckets;
  const out = Array.from({ length: buckets }, (_, i) => ({
    start: new Date(begin + i * bucketMs).toISOString(),
    total: 0,
    byKind: Object.fromEntries(AUDIT_KINDS.map((k) => [k, 0])) as Record<AuditKind, number>,
  }));
  for (const row of rows) {
    const t = Date.parse(row.at);
    // The window is `[begin, now]` and CLOSED at the top, which is a
    // one-character difference with a record in it: the caller stamps `at` and
    // then asks `Date.now()`, and the two land in the same millisecond often
    // enough to matter. A half-open window would drop exactly the newest
    // record — the one the pulse exists to show — and drop it in silence.
    if (Number.isNaN(t) || t < begin || t > now) continue;
    // Clamped, because the closing instant divides into index `buckets`.
    const bucket = out[Math.min(Math.floor((t - begin) / bucketMs), buckets - 1)]!;
    // A kind this build does not know still COUNTS toward the column height
    // and is simply absent from the breakdown: the pulse stays honest about
    // how much happened, and says nothing it cannot account for.
    bucket.total++;
    if (row.kind in bucket.byKind) bucket.byKind[row.kind as AuditKind]++;
  }
  return out;
}

function intParam(url: URL, name: string, min: number, max: number, fallback: number): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * How the audit projection stood when this answer was read.
 *
 * `'fresh'` is the only state that produces data. `'absent'` is not one of
 * `ProjectionState`'s three: it means no projection file exists at all, which
 * is an empty state rather than a fault (`ProjectionAbsentError` carries its
 * own class so a reader tells it from damage without matching a message). The
 * stale states never reach a 200 — see `readProjection`.
 */
export type WatchProjectionState = 'fresh' | 'absent';

type ProjectionHandle = ReturnType<typeof openProjectionReadOnlyChecked>;

export type ProjectionRead<T> =
  | { ok: true; state: 'fresh'; value: T }
  | { ok: true; state: 'absent'; value: null }
  | { ok: false; refusal: JsonResult };

/** The command that ends every state below — named in the message, never performed here. */
const BUILD_IT = 'Run `mycontext audit` to build it; a read surface may not, because building it is a write.';

function refuseProjection(err: unknown): JsonResult {
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof ProjectionStaleError) {
    return {
      status: 503,
      body: {
        error: `the audit projection is ${err.state} relative to its log, and this endpoint may `
          + `not catch it up: syncing is a write, and answering from it anyway would present a `
          + `partial history as a complete one. ${BUILD_IT} (${detail})`,
        projectionState: err.state,
      },
    };
  }
  return {
    status: 503,
    body: {
      error: `the audit projection could not be read: ${detail}. It is derived from the JSONL `
        + `log and holds nothing the log does not, so deleting it loses nothing. ${BUILD_IT}`,
      projectionState: null,
    },
  };
}

/**
 * One door onto the projection for every JSON endpoint that reads it, opened
 * READ-ONLY, checked, and closed — including when the read throws.
 *
 * The handle never outlives this call, which is what keeps the stream route's
 * "nothing holds a database handle open across a held-open response" true by
 * construction: the stream does not come through here at all.
 *
 * **Exported for `ask-model.ts`, which reads the same projection from
 * `/api/ask/audit` and `/api/ask/summary`.** The three outcomes are a POLICY —
 * fresh answers, absent is an empty state, everything else refuses — and a
 * second spelling of a policy is how two endpoints come to disagree about what
 * a missing database means. There is one spelling, and this is it.
 */
export function readProjection<T>(root: string, read: (db: ProjectionHandle) => T): ProjectionRead<T> {
  let db: ProjectionHandle;
  try {
    db = openProjectionReadOnlyChecked(root);
  } catch (err) {
    // The never-built empty state, and ONLY it. Everything else — behind,
    // diverged, truncated, corrupt, a shape this build does not read — is a
    // refusal, because reporting damage as "nothing here yet" is the same
    // silent drop as reporting a fresh workspace as damage.
    if (err instanceof ProjectionAbsentError) return { ok: true, state: 'absent', value: null };
    return { ok: false, refusal: refuseProjection(err) };
  }
  try {
    return { ok: true, state: 'fresh', value: read(db) };
  } catch (err) {
    return { ok: false, refusal: refuseProjection(err) };
  } finally {
    db.close();
  }
}

/**
 * The most columns this endpoint will draw. The mockup's pulse asks for 120;
 * the cap is where a request stops being a pulse and starts being a scan, and
 * it is what bounds the projection read below.
 */
const MAX_VOLUME_COLUMNS = 1440;

export function apiWatchVolume(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['minutes', 'bucket']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const minutes = intParam(url, 'minutes', 1, 1440, 20);
  if (minutes === null) return badRequest('minutes must be an integer between 1 and 1440');
  const bucketSeconds = intParam(url, 'bucket', 1, 3600, 10);
  if (bucketSeconds === null) {
    return badRequest('bucket must be a whole number of seconds between 1 and 3600');
  }
  const seconds = minutes * 60;
  if (seconds % bucketSeconds !== 0) {
    return badRequest(
      `minutes=${minutes} does not divide into whole ${bucketSeconds}-second buckets. This ` +
      'endpoint refuses rather than rounding: a window quietly shortened to fit its buckets ' +
      'reports a span it did not measure.',
    );
  }
  const columns = seconds / bucketSeconds;
  if (columns > MAX_VOLUME_COLUMNS) {
    return badRequest(
      `minutes=${minutes} at bucket=${bucketSeconds}s is ${columns} columns; this endpoint draws ` +
      `at most ${MAX_VOLUME_COLUMNS}. It refuses rather than truncating, because a series silently ` +
      'shortened is a series that lies about its window.',
    );
  }
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const now = Date.now();
  const since = new Date(now - seconds * 1000).toISOString();
  // `since` becomes `at >= ?` — the predicate `idx_audit_at` exists to serve,
  // and the only thing bounding this read, which is why the column cap above
  // is a refusal rather than a slice. `at` and `kind` are two generated
  // columns of the SAME row, so nothing is joined here; `audit_item`, the
  // table that would need a join, answers a per-item question and not this one.
  const read = readProjection(root, (db) => queryProjection(db, { since }));
  if (!read.ok) return read.refusal;
  return {
    status: 200,
    body: {
      minutes,
      bucketSeconds,
      // An absent projection answers with NO columns, not with a row of
      // zeroes: 120 zero columns is a chart asserting that nothing happened,
      // over a log this endpoint has not read. The owner's zero-data view
      // renders the state named beside it — never an empty chart.
      buckets: read.value === null ? [] : recordVolume(read.value, bucketSeconds * 1000, columns, now),
      projectionState: read.state,
    },
  };
}

/** The §4b numerator, shared with `mycontext statusline` in shape: recorded tokens summed, absences counted. */
function share(records: { tokens?: number }[]): { tokens: number; injections: number; unrecorded: number } {
  let tokens = 0;
  let unrecorded = 0;
  for (const r of records) {
    if (typeof r.tokens === 'number') tokens += r.tokens;
    else unrecorded++;
  }
  return { tokens, injections: records.length, unrecorded };
}

export interface WatchContextBody {
  session: string;
  /** `null` is the NO-SAMPLE state: no bridge installed, or this session was never sampled. */
  sample: {
    receivedAt: string; model: string | null; version: string | null; context: ContextSample;
  } | null;
  /** `null` whenever the projection could not answer — with `mycontextError` saying which state. */
  mycontext: { tokens: number; injections: number; unrecorded: number } | null;
  mycontextError: string | null;
}

/**
 * The §4b join: Claude Code's own context figure beside what this corpus
 * recorded injecting into the same session, keyed on `session_id`.
 *
 * **This endpoint owns never inventing a number.** Both halves are nullable
 * and each null carries its own reason: the client owns the wording, and a
 * missing measurement is a state rather than a zero. It answers 200 even when
 * both halves are absent, because "no bridge and no projection" is a thing to
 * render, not a fault to refuse.
 */
export function apiWatchContext(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['session']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const session = url.searchParams.get('session');
  if (session === null || session === '') return badRequest('session is required');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } }; // startUiServer refuses this earlier

  const tee = readTee(root, session);
  const sample = tee === null ? null : {
    receivedAt: tee.receivedAt,
    model: modelName(tee.payload),
    version: versionOf(tee.payload),
    context: classifyContext(tee.payload),
  };

  const read = readProjection(root, (db) => share(queryProjection(db, { sessionId: session, kind: 'injection' })));
  let mycontext: { tokens: number; injections: number; unrecorded: number } | null = null;
  let mycontextError: string | null = null;
  if (!read.ok) {
    mycontextError = (read.refusal.body as { error: string }).error;
  } else if (read.value === null) {
    mycontextError = `no audit projection has been built for this corpus, so what mycontext put `
      + `in this session is unknown rather than zero. ${BUILD_IT}`;
  } else {
    mycontext = read.value;
  }
  const body: WatchContextBody = { session, sample, mycontext, mycontextError };
  return { status: 200, body };
}

function modelName(payload: unknown): string | null {
  const m = (payload as { model?: { display_name?: unknown; id?: unknown } } | null)?.model;
  if (typeof m?.display_name === 'string') return m.display_name;
  if (typeof m?.id === 'string') return m.id;
  return null;
}

function versionOf(payload: unknown): string | null {
  const v = (payload as { version?: unknown } | null)?.version;
  return typeof v === 'string' ? v : null;
}

/** How many newest injection records the spill list is drawn from — disclosed in the response. */
const SPILL_RECORD_WINDOW = 1000;

export interface Spill {
  at: string;
  sessionId: string | null;
  hook: string | null;
  path: string | null;
  id: string;
  tier: string;
  reason: string;
  /**
   * The PARENT record's token estimate; `null` means "not recorded" (a record
   * predating the `tokens` field), and the client renders it as that state —
   * never as zero.
   */
  tokens: number | null;
}

function flattenSpills(records: AuditRecord[], item: string | null): Spill[] {
  const spills: Spill[] = [];
  for (const record of records) {
    for (const s of record.spilled ?? []) {
      // `itemId` matches a record in any of three roles, so a record filtered
      // by `item` can still carry OTHER items' spills. Narrow again here, or
      // "why didn't Claude see RULE-c" answers with RULE-d.
      if (item !== null && s.id !== item) continue;
      spills.push({
        at: record.at,
        sessionId: record.sessionId ?? null,
        hook: record.hook ?? null,
        path: record.path ?? null,
        id: s.id,
        tier: s.tier,
        reason: s.reason,
        tokens: typeof record.tokens === 'number' ? record.tokens : null,
      });
    }
  }
  return spills;
}

export function apiWatchSpills(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['item', 'limit']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const limit = intParam(url, 'limit', 1, 500, 50);
  if (limit === null) return badRequest('limit must be an integer between 1 and 500');
  const item = url.searchParams.get('item');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const read = readProjection(root, (db) => ({
    records: queryProjection(db, {
      kind: 'injection',
      ...(item === null ? {} : { itemId: item }),
      limit: SPILL_RECORD_WINDOW,
    }),
    topSpilled: topItems(db, 'spilled', 10),
  }));
  if (!read.ok) return read.refusal;

  const spills = read.value === null ? [] : flattenSpills(read.value.records, item);
  const topSpilled: SummaryRow[] = read.value === null ? [] : read.value.topSpilled;
  return {
    status: 200,
    body: {
      spills: spills.slice(-limit),
      topSpilled,
      recordWindow: SPILL_RECORD_WINDOW,
      projectionState: read.state,
    },
  };
}

// --- The stream -------------------------------------------------------------

function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * The live audit stream — **the route the idle rule was built for**. The
 * dispatch loop never `touch()`es a `kind: 'stream'` route, so a forgotten tab
 * holding this open still lets the 15-minute idle exit fire (spec §2).
 *
 * It reads the JSONL directly through `AuditTail` and opens no database at
 * all, which is what makes it safe to hold open: no write lock, no handle, and
 * nothing for a checkpoint to be waiting on.
 *
 * **`resync` is DISCLOSED, never swallowed.** `AuditTail.poll()` answers
 * `{ records: [], resync: true }` when the log diverged under it — a segment
 * that shrank or vanished, or a rotated segment it has never read, which is
 * the face a rotation actually shows (a rotation recreates `audit.jsonl` at
 * the same path, at a size that need not be smaller, so nothing shrinks). The
 * tail resets to the current EOFs rather than re-reading from zero, because
 * re-reading would show every record around the rotation twice in an audit
 * view. What was appended in the gap is therefore NOT on this stream, and that
 * is precisely why the event goes out: the screen refetches its backlog
 * through the query surface, which reads the projection and is immune to the
 * rename. A consumer that ignored the event would silently show a hole.
 */
function streamHandler(ctx: ApiContext, res: ServerResponse): void {
  const bad = unknownParams(ctx.url, ['poll']) ?? repeatedParams(ctx.url);
  const poll = intParam(ctx.url, 'poll', 50, 10_000, STREAM_POLL_MS);
  if (bad !== null || poll === null) {
    res.writeHead(400, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: bad ?? 'poll must be an integer between 50 and 10000' }));
    return;
  }
  const root = ctx.ws.projectRoot;
  if (root === null) {
    res.writeHead(500, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'no project workspace' }));
    return;
  }

  res.writeHead(200, {
    // The same four headers every other response carries (spec §2), from the
    // one object, so a new response path cannot quietly ship without them.
    ...SECURITY_HEADERS,
    'content-type': 'text/event-stream; charset=utf-8',
    // NO CORS headers, deliberately — their absence is the defence (spec §2).
  });
  const tail = new AuditTail(root);
  sseSend(res, 'hello', { pollMs: poll });

  // Unref'd: this timer must never be what keeps the process alive. The idle
  // monitor exits the server WITH this stream open (an open stream is not
  // activity — spec §2), and server.closeAllConnections() destroys the
  // socket, which fires 'close' below and clears the timer.
  const timer = setInterval(() => {
    let result;
    try {
      result = tail.poll();
    } catch (err) {
      // A damaged audit line: refuse loudly, on-stream, and end. The screen
      // renders the fault; it never reconnects on its own (spec §2).
      sseSend(res, 'fault', { error: err instanceof Error ? err.message : String(err) });
      res.end();
      return;
    }
    if (result.resync) sseSend(res, 'resync', {});
    for (const record of result.records) sseSend(res, 'record', record);
  }, poll);
  timer.unref();
  res.on('close', () => clearInterval(timer));
}

/**
 * Registered from inside `registerReadRoutes()`'s once-only guarded body, the
 * way `registerWorkRoutes()` is, and for the same two reasons: `startUiServer`
 * is called repeatedly in one process by `test/ui/server.test.ts`, so an
 * unguarded second registration would throw; and `server-e2e.test.ts`'s "every
 * registered read route is in the sweep" asks that function what the table
 * holds, so a route registered only on the server-start path would be
 * invisible to it.
 */
export function registerWatchRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/watch/volume', json(apiWatchVolume));
  registerRoute('GET', '/api/watch/context', json(apiWatchContext));
  registerRoute('GET', '/api/watch/spills', json(apiWatchSpills));
  registerRoute('GET', '/api/watch/stream', { kind: 'stream', handle: streamHandler });
}
