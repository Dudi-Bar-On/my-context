// src/ui/public/lib/viewmodel.js
// The screens' pure logic: everything a Watch or Ask view decides before a
// single element is created. `node --test` imports this file directly
// (test/ui/viewmodel.test.ts), which is the whole reason the decisions live
// here rather than in the DOM glue — per spec §6 the glue is the stated
// rendering-coverage gap, so nothing that can be decided may be decided there.
//
// A plain browser ES module: no types (the browser cannot strip them), no
// imports, no build step. The bytes the browser loads are the bytes the test
// loads.
//
// Plan 1's helpers (`selectQuery`, `budgetBar`, `buildTree`, `coverageGaps`,
// `layoutGraph`, `groupFindings`, `decayBuckets`, `renderMarkdown`) join this
// file when its Tasks 17-19 land; plan 3 Task 10 opened it because they had
// not.

// --- Watch/Ask view-models (web-ui plan 3) ----------------------------------

// The one place absence-vs-zero is decided for the DOM: an injection record
// without `tokens` predates the field and means NOT RECORDED — never zero.
// Zero is a real measurement (everything selected spilled). audit.ts pins
// this on the field itself
// (`core/audit.ts` · `ABSENT on records written before this field existed, and absence means` · ~366);
// this function is that contract applied to rendering, and the test pins both
// directions.
//
// There are SIX kinds (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~242),
// and `injected`/`spilled`/`tokens` belong to exactly one of them. The other
// five come back with an empty spill list and a `null` token count — not
// "not-recorded", which is a claim about a field that kind never carries.
export function describeRecord(record) {
  const injection = record.kind === 'injection';
  return {
    at: record.at,
    kind: record.kind,
    op: record.op,
    sessionId: record.sessionId ?? null,
    injected: injection ? (record.injected ?? []).length : 0,
    spilled: injection ? (record.spilled ?? []) : [],
    tokens: !injection ? null : (typeof record.tokens === 'number' ? record.tokens : 'not-recorded'),
    itemId: record.itemId ?? null,
    origin: record.origin ?? null,
    path: record.path ?? null,
    note: record.note ?? null,
  };
}

function sortedJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${sortedJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Records carry no id; the stream-vs-backlog overlap is deduped by full
// serialized identity (plan 3 design decision 1). Two records that are equal
// in every field — same op, same session, same millisecond — therefore have
// one key and the feed shows one row. That is the trade the decision makes
// knowingly: inventing an id server-side would be a second truth about a log
// whose whole value is being the first one.
export function dedupeKey(record) {
  return sortedJson(record);
}

export function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// The strip's decision table (spec §4b + §7): five states, each its own
// rendering, never a number invented for a state that lacks one. `age` is
// computed by the caller from receivedAt at render time so it ticks — it is
// deliberately NOT a field here, because a number frozen at fetch time is the
// one thing an "as of … ago" label must not be.
export function contextStrip(body, isCold) {
  if (isCold || body === null) {
    return { state: 'cold', pct: null, used: null, size: null, receivedAt: null, myctx: null, myctxError: null };
  }
  const myctx = body.mycontext ?? null;
  const myctxError = body.mycontextError ?? null;
  if (body.sample === null) {
    return { state: 'no-bridge', pct: null, used: null, size: null, receivedAt: null, myctx, myctxError };
  }
  const c = body.sample.context;
  return {
    state: c.state,                    // 'known' | 'not-yet-known' | 'unknown'
    pct: c.percent,
    used: c.usedTokens,
    size: c.windowSize,
    receivedAt: body.sample.receivedAt,
    myctx,
    myctxError,
  };
}

// One series from the volume endpoint's columns: the HEIGHT only. The
// per-kind breakdown each bucket also carries is the pulse's colouring, and
// the pulse is not drawn by this plan yet (§0, open question 1) — the six
// kinds have no clean mapping onto the approved palette and that is an open
// owner decision, so nothing here names a colour.
//
// `Math.max(1, …)` is the empty-window case and not a nicety: a window in
// which nothing happened must draw a flat line on the floor, and 0/0 would
// draw NaN into the `points` attribute instead.
export function sparkline(buckets, width, height) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const step = buckets.length > 1 ? width / (buckets.length - 1) : 0;
  return buckets
    .map((b, i) => `${Math.round(i * step)},${Math.round(height - (b.total / max) * height)}`)
    .join(' ');
}

/** Which string key each stream event renders as; `record` renders as a row. */
const STREAM_EVENT_KEYS = {
  hello: 'watch.streamWaiting',
  record: null,
  resync: 'watch.resync',
  fault: 'watch.streamFault',
};

// **`resync` is an event, not a silence, and this is where it becomes an
// obligation.** `AuditTail.poll()` answers `{ records: [], resync: true }` when
// the log diverged under it — a known segment that shrank or vanished, or an
// unknown segment that is not the live log, which is the face a rotation
// actually shows (it recreates `audit.jsonl` at the same path, at a size that
// need not be smaller, so nothing shrinks). The tail resets to the current
// EOFs rather than replaying, so whatever landed in the gap is NOT coming down
// this stream (`ui/watch-model.ts` · `if (result.resync) sseSend(res, 'resync', {});` · ~462).
//
// The only way to fill that hole is to refetch the backlog through the query
// surface, which reads the projection and is immune to the rename — so
// `refetchBacklog` is that obligation, written where a test can reach it
// rather than as one branch of a DOM switch that nothing checks. A screen that
// renders the record events and ignores the resync shows a gap as if nothing
// had happened, which is the one thing an audit view may not do.
//
// An event this build does not know is `'unknown'` and carries no record: a
// frame the parser could read but this function cannot name must not reach the
// feed as though it were audited history.
export function describeStreamEvent(event, data) {
  const known = Object.hasOwn(STREAM_EVENT_KEYS, event);
  const payload = data !== null && typeof data === 'object' ? data : {};
  return {
    kind: known ? event : 'unknown',
    pollMs: event === 'hello' && typeof payload.pollMs === 'number' ? payload.pollMs : null,
    record: event === 'record' ? (data ?? null) : null,
    gap: event === 'resync',
    refetchBacklog: event === 'resync',
    // The server ends the response after a fault and nothing reconnects
    // (spec §2), so this is the last event a screen will see on this stream.
    ended: event === 'fault',
    error: event === 'fault' && typeof payload.error === 'string' ? payload.error : null,
    stringKey: known ? STREAM_EVENT_KEYS[event] : null,
  };
}
