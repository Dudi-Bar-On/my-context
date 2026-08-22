/**
 * Pure browser-module logic, tested in Node. THE LIMIT, stated rather than
 * papered over (spec §6): the DOM rendering in `app.js` and `screens/*.js` has
 * no test — that would need a browser dependency this project does not have.
 * A green run here verifies the view-models, not the pixels.
 *
 * This file is opened by web-ui plan 3 Task 10 rather than by plan 1 Task 16,
 * which named it first and has not landed: `src/ui/public/lib/` does not exist
 * on master, so the plan-3 task that says *modify `viewmodel.js`* and *extend
 * `viewmodel.test.ts`* creates both. Plan 1's own helpers (`extractNonce`,
 * `shouldPing`, `t`, `pickLanguage`) join this file when Task 16 lands.
 *
 * **The parser half is where the byte stream's assumptions are checked.** An
 * SSE frame arrives over a socket that may split anywhere, so every place it
 * can split is a test below and not a hope: mid-field-name, mid-JSON, exactly
 * on the blank line, one byte at a time, two frames in one chunk, CRLF, a lone
 * CR, a comment, a `retry`, and an escaped newline pair inside a payload that
 * is NOT a frame boundary however much it looks like one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { AUDIT_KINDS } from '../../src/core/audit.ts';

/**
 * **How a TypeScript test imports an untyped browser module, and why not the
 * obvious way.** These modules are plain ES modules, deliberately untyped and
 * outside `tsconfig.json`'s `include`, so the browser and `node --test` load
 * the same bytes with no build step. The relative specifier the plan wrote —
 * a bare `import()` of `../../src/ui/public/lib/sse.js` — runs fine and does
 * NOT type-check: with `allowJs` off it is TS2307 before the file exists and
 * TS7016 after it ("could not find a declaration file … implicitly has an
 * 'any' type"), and `npm run typecheck` is a gate. A URL specifier is what
 * lets this file import them, and it is also the only form that survives a
 * Windows path — the same reason, in the same words, as
 * (`test/ui/strings-parity.test.ts` · `TypeScript file import them without` · ~39).
 *
 * The shapes below are hand-declared rather than generated, so they are an
 * assertion in their own right: they are this task's published interface, and
 * a module that drifts from one fails here rather than at a call site in a
 * screen nobody type-checks.
 */
const LIB = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'lib');

async function lib<T>(name: string): Promise<T> {
  const file = path.join(LIB, name).replaceAll('\\', '/');
  return (await import(new URL(`file://${file}`).href)) as T;
}

interface SseModule {
  createSseParser: (onEvent: (event: string, data: unknown) => void) => (chunk: string) => void;
}

interface DescribedRecord {
  at: string;
  kind: string;
  op: string;
  sessionId: string | null;
  injected: number;
  spilled: { id: string; tier: string; reason: string }[];
  /** The absence-vs-zero decision, and the reason this module exists. */
  tokens: number | 'not-recorded' | null;
  itemId: string | null;
  origin: string | null;
  path: string | null;
  note: string | null;
}

interface Strip {
  state: 'cold' | 'no-bridge' | 'unknown' | 'not-yet-known' | 'known';
  pct: number | null;
  used: number | null;
  size: number | null;
  receivedAt: string | null;
  myctx: { tokens: number; injections: number; unrecorded: number } | null;
  myctxError: string | null;
}

interface StreamEvent {
  kind: 'hello' | 'record' | 'resync' | 'fault' | 'unknown';
  pollMs: number | null;
  record: unknown;
  gap: boolean;
  refetchBacklog: boolean;
  ended: boolean;
  error: string | null;
  stringKey: string | null;
}

interface ViewModelModule {
  describeRecord: (record: Record<string, unknown>) => DescribedRecord;
  dedupeKey: (record: unknown) => string;
  formatAge: (ms: number) => string;
  contextStrip: (body: unknown, isCold: boolean) => Strip;
  sparkline: (buckets: { total: number }[], width: number, height: number) => string;
  describeStreamEvent: (event: string, data: unknown) => StreamEvent;
}

const sse = (): Promise<SseModule> => lib<SseModule>('sse.js');
const vm = (): Promise<ViewModelModule> => lib<ViewModelModule>('viewmodel.js');

// --- The SSE parser ---------------------------------------------------------

test('createSseParser assembles frames across chunk boundaries', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  feed('event: hello\ndata: {"pollMs":50}\n\nevent: rec');
  feed('ord\ndata: {"op":"jit"}\n\n');
  assert.deepEqual(seen, [['hello', { pollMs: 50 }], ['record', { op: 'jit' }]]);
});

/**
 * The same four frames the stream route actually sends (`hello`, `record`,
 * `resync`, `fault`), fed at every split there is: whole, one byte at a time,
 * and split at each of the ~200 positions in between. A parser that only works
 * on frame-aligned chunks passes the test above and loses a record the first
 * time the socket flushes mid-JSON.
 */
test('createSseParser: every split of the same stream yields the same events', async () => {
  const { createSseParser } = await sse();
  const stream =
    'event: hello\ndata: {"pollMs":1000}\n\n' +
    'event: record\ndata: {"kind":"injection","op":"jit","tokens":0}\n\n' +
    'event: resync\ndata: {}\n\n' +
    'event: fault\ndata: {"error":"line 3 is not JSON"}\n\n';
  const expected: [string, unknown][] = [
    ['hello', { pollMs: 1000 }],
    ['record', { kind: 'injection', op: 'jit', tokens: 0 }],
    ['resync', {}],
    ['fault', { error: 'line 3 is not JSON' }],
  ];

  const run = (chunks: string[]): [string, unknown][] => {
    const seen: [string, unknown][] = [];
    const feed = createSseParser((event, data) => seen.push([event, data]));
    for (const chunk of chunks) feed(chunk);
    return seen;
  };

  assert.deepEqual(run([stream]), expected, 'one whole chunk');
  assert.deepEqual(run([...stream]), expected, 'one byte at a time');
  for (let i = 1; i < stream.length; i++) {
    assert.deepEqual(run([stream.slice(0, i), stream.slice(i)]), expected,
      `split at index ${i} (…${JSON.stringify(stream.slice(Math.max(0, i - 8), i + 8))}…)`);
  }
});

test('createSseParser: a partial frame is withheld until its blank line arrives', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  feed('event: record\ndata: {"op":"jit"}\n');   // terminated line, UNterminated frame
  assert.deepEqual(seen, [], 'a frame without its blank line has not happened yet');
  feed('\nevent: resync\ndata: {}');             // the blank line, then another partial
  assert.deepEqual(seen, [['record', { op: 'jit' }]]);
  feed('\n\n');
  assert.deepEqual(seen, [['record', { op: 'jit' }], ['resync', {}]]);
});

/**
 * CRLF and lone-CR. Nothing in `watch-model.ts` writes either — `sseSend`
 * writes `\n` — so this is not a claim about our own server; it is the line
 * terminator the SSE grammar allows, and a parser that hunts for a doubled LF
 * delivers NOTHING at all over a stream that uses the other two, in silence.
 */
test('createSseParser: CRLF and lone-CR are line terminators too', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  feed('event: record\r\ndata: {"op":"jit"}\r\n\r\n');
  assert.deepEqual(seen, [['record', { op: 'jit' }]], 'CRLF, arriving whole');

  // The split that only CRLF has: BETWEEN the CR and the LF, on the frame's
  // own terminator. A CR at the end of what has arrived is AMBIGUOUS — the
  // next byte may be the LF that completes one terminator — so it is HELD
  // rather than guessed at. Guessed at, it is two terminators instead of one:
  // an empty line that ends the frame, and a second empty line that ends
  // another, and the frame after it loses its `event:` to the leftover LF.
  feed('event: resync\r\ndata: {}\r\n\r');
  assert.equal(seen.length, 1, 'a CR that may still become a CRLF is not a line yet');
  feed('\n');
  assert.deepEqual(seen.at(-1), ['resync', {}], 'the LF arrived: one terminator, not two');

  // Lone CR, the third terminator. The cost of holding it is exactly one frame
  // of latency at a chunk boundary, and only against a server that terminates
  // with CR alone — ours writes LF, in one place
  // (`ui/watch-model.ts` · `function sseSend(res: ServerResponse, event: string, data: unknown): void {` · ~397).
  feed('event: record\rdata: {"op":"manual"}\r\r');
  assert.equal(seen.length, 2, 'the frame is complete, but its last byte is an ambiguous CR');
  feed(':');  // any byte that is not an LF resolves it
  assert.deepEqual(seen.at(-1), ['record', { op: 'manual' }]);
});

test('createSseParser: comments, retry and id are not events', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  // A keep-alive comment frame, a retry-only frame, and a field this parser
  // does not read — none of them carries `data:`, so none of them is an event.
  feed(': keep-alive\n\nretry: 3000\n\nid: 7\n\n');
  assert.deepEqual(seen, []);
  // …and a comment INSIDE a real frame does not disturb it.
  feed(': ping\nevent: record\n: mid-frame comment\ndata: {"op":"jit"}\n\n');
  assert.deepEqual(seen, [['record', { op: 'jit' }]]);
});

/**
 * The two things that look like structure and are not: an escaped blank line
 * inside a JSON string (backslash-n twice — four characters, and never a
 * newline on the wire) and the optional space after the field's colon, which
 * the grammar makes optional and `sseSend` always writes.
 */
test('createSseParser: a blank line inside the payload is not a frame boundary', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  const note = 'scope=src/**\n\nand a second paragraph';
  feed(`event:record\ndata:${JSON.stringify({ kind: 'focus', note })}\n\n`);
  assert.deepEqual(seen, [['record', { kind: 'focus', note }]]);
  assert.equal((seen[0]![1] as { note: string }).note.includes('\n\n'), true,
    'the payload really does carry a blank line — it just never was one on the wire');
});

test('createSseParser: a multi-line data field is joined with newlines, not concatenated', async () => {
  const { createSseParser } = await sse();
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  feed('event: record\ndata: {"op":\ndata: "jit"}\n\n');
  assert.deepEqual(seen, [['record', { op: 'jit' }]]);
});

// --- The Watch/Ask view-models ----------------------------------------------

test('describeRecord: tokens absence is the not-recorded STATE, zero is the number zero', async () => {
  const { describeRecord } = await vm();
  const base = { protocol: 'my_context/audit@1', at: '2026-08-16T10:00:00.000Z' };
  const withTokens = describeRecord({ ...base, kind: 'injection', op: 'jit', sessionId: 's1', injected: [{ id: 'A', tier: 'jit' }], spilled: [], tokens: 0 });
  assert.equal(withTokens.tokens, 0); // a real measurement — everything spilled
  const without = describeRecord({ ...base, kind: 'injection', op: 'jit', sessionId: 's1', injected: [{ id: 'A', tier: 'jit' }] });
  assert.equal(without.tokens, 'not-recorded');
  const mutation = describeRecord({ ...base, kind: 'mutation', op: 'update', origin: 'human', itemId: 'A', fields: ['body'] });
  assert.equal(mutation.tokens, null);
  assert.equal(mutation.itemId, 'A');
  const focus = describeRecord({ ...base, kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });
  assert.equal(focus.note, 'scope=src/**');
});

/**
 * There are SIX kinds, not four
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~242), and
 * this plan's own prose says four in several places. `access` and `progress`
 * are the two that were left out, so they are the two most likely to be
 * described by a branch written for something else: both must come back with
 * `tokens: null` — an injection-only field — and an empty spill list.
 */
test('describeRecord describes all six kinds, and invents an injection out of none of them', async () => {
  const { describeRecord } = await vm();
  assert.equal(AUDIT_KINDS.length, 6);
  for (const kind of AUDIT_KINDS) {
    const d = describeRecord({ protocol: 'my_context/audit@1', at: '2026-08-16T10:00:00.000Z', kind, op: 'x' });
    assert.equal(d.kind, kind);
    if (kind === 'injection') {
      assert.equal(d.tokens, 'not-recorded', 'an injection with no tokens field is the state');
    } else {
      assert.equal(d.tokens, null, `${kind} has no tokens field to be absent`);
      assert.equal(d.injected, 0);
      assert.deepEqual(d.spilled, []);
    }
  }
});

test('dedupeKey is stable under key order', async () => {
  const { dedupeKey } = await vm();
  assert.equal(dedupeKey({ a: 1, b: [2, { c: 3 }] }), dedupeKey({ b: [2, { c: 3 }], a: 1 }));
  assert.notEqual(dedupeKey({ a: 1 }), dedupeKey({ a: 2 }));
});

test('contextStrip decides the five states', async () => {
  const { contextStrip } = await vm();
  assert.equal(contextStrip(null, true).state, 'cold');
  assert.equal(contextStrip({ sample: null, mycontext: { tokens: 0, injections: 0, unrecorded: 0 }, mycontextError: null }, false).state, 'no-bridge');
  const known = contextStrip({
    sample: { receivedAt: '2026-08-16T10:00:00.000Z', model: 'Opus 4.5', version: '2.1.233',
      context: { state: 'known', usedTokens: 47000, windowSize: 200000, percent: 23.5 } },
    mycontext: { tokens: 6200, injections: 3, unrecorded: 1 }, mycontextError: null,
  }, false);
  assert.equal(known.state, 'known');
  assert.equal(known.pct, 23.5);
  assert.equal(known.receivedAt, '2026-08-16T10:00:00.000Z');
  assert.deepEqual(known.myctx, { tokens: 6200, injections: 3, unrecorded: 1 });
  assert.equal(contextStrip({ sample: { receivedAt: 'x', model: null, version: null, context: { state: 'not-yet-known', usedTokens: null, windowSize: null, percent: null } }, mycontext: null, mycontextError: 'e' }, false).state, 'not-yet-known');
  assert.equal(contextStrip({ sample: { receivedAt: 'x', model: null, version: null, context: { state: 'unknown', usedTokens: null, windowSize: null, percent: null } }, mycontext: null, mycontextError: null }, false).state, 'unknown');
});

test('formatAge and sparkline', async () => {
  const { formatAge, sparkline } = await vm();
  assert.equal(formatAge(12_000), '12s');
  assert.equal(formatAge(190_000), '3m');
  assert.equal(formatAge(7_300_000), '2h');
  assert.equal(formatAge(200_000_000), '2d');
  const points = sparkline([{ total: 0 }, { total: 2 }, { total: 1 }], 30, 10);
  assert.equal(points.split(' ').length, 3);
  assert.match(points, /^0,10 15,0 30,5$/);
});

/**
 * The three series `/api/watch/volume` can really answer with: no columns at
 * all (an `absent` projection answers `buckets: []` rather than a row of
 * zeroes), one column, and a window in which nothing happened. None of them
 * may divide by zero or draw a line claiming a height it did not measure.
 */
test('sparkline: the degenerate series a real endpoint answers with', async () => {
  const { sparkline } = await vm();
  assert.equal(sparkline([], 30, 10), '');
  assert.equal(sparkline([{ total: 4 }], 30, 10), '0,0');
  // An all-zero window is a FLAT line on the floor, never a full-height one:
  // the denominator is at least 1, so 0/1 is 0 and the baseline is drawn.
  assert.equal(sparkline([{ total: 0 }, { total: 0 }, { total: 0 }], 30, 10), '0,10 15,10 30,10');
});

/**
 * **`resync` is an event, not a silence** — and this is where it stops being
 * an SSE frame and becomes something a screen can act on.
 *
 * `AuditTail.poll()` answers `{ records: [], resync: true }` when the log
 * diverged under it, and divergence has two faces: a known segment that shrank
 * or vanished, and an unknown segment that is not the live log — the second
 * exists because a rotation recreates `audit.jsonl` at the same path at a size
 * that need not be smaller, so nothing shrinks. The tail resets to the current
 * EOFs rather than replaying, so what landed in the gap is NOT on this stream
 * (`ui/watch-model.ts` · `if (result.resync) sseSend(res, 'resync', {});` · ~462).
 * The screen has to refetch its backlog through the query surface, which reads
 * the projection and is immune to the rename — and `refetchBacklog` is the one
 * place that obligation is written down where a test can reach it.
 */
test('describeStreamEvent turns resync into a gap to be refilled, never into nothing', async () => {
  const { describeStreamEvent } = await vm();
  assert.deepEqual(describeStreamEvent('resync', {}), {
    kind: 'resync', pollMs: null, record: null,
    gap: true, refetchBacklog: true, ended: false, error: null,
    stringKey: 'watch.resync',
  });
  const hello = describeStreamEvent('hello', { pollMs: 1000 });
  assert.equal(hello.pollMs, 1000);
  assert.equal(hello.gap, false);
  const record = describeStreamEvent('record', { kind: 'hook', op: 'deny' });
  assert.deepEqual(record.record, { kind: 'hook', op: 'deny' });
  assert.equal(record.gap, false);
  assert.equal(record.refetchBacklog, false);
  const fault = describeStreamEvent('fault', { error: 'line 3 is not JSON' });
  assert.equal(fault.ended, true, 'the server ends the response after a fault; the screen says so');
  assert.equal(fault.error, 'line 3 is not JSON');
  // An event this build does not know is NOT a record. Rendering it as one
  // would put an unparsed frame in the feed as though it were audited history.
  const unknown = describeStreamEvent('something-new', { x: 1 });
  assert.equal(unknown.kind, 'unknown');
  assert.equal(unknown.record, null);
  assert.equal(unknown.stringKey, null);
});

/**
 * Every string key this view-model names must exist, because `t()` THROWS on a
 * missing key: a view-model naming a key the table does not declare blanks the
 * screen rather than mislabelling one line.
 */
test('every stringKey describeStreamEvent can name is declared in both tables', async () => {
  const { describeStreamEvent } = await vm();
  const REPO = path.join(import.meta.dirname, '..', '..');
  const load = async (lang: string): Promise<{ strings: Record<string, string> }> => {
    const file = path.join(REPO, 'src', 'ui', 'public', 'strings', `${lang}.js`).replaceAll('\\', '/');
    return (await import(new URL(`file://${file}`).href)) as { strings: Record<string, string> };
  };
  const en = await load('en');
  const he = await load('he');
  const keys = ['hello', 'record', 'resync', 'fault', 'nonsense']
    .map((event) => describeStreamEvent(event, {}).stringKey)
    .filter((key): key is string => key !== null);
  assert.ok(keys.length > 0, 'a view-model that names no key at all is not being checked by this');
  for (const key of keys) {
    assert.ok(key in en.strings, `${key} is missing from the English table`);
    assert.ok(key in he.strings, `${key} is missing from the Hebrew table`);
  }
});
