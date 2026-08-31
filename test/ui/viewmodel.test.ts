/**
 * Pure browser-module logic, tested in Node. THE LIMIT, stated rather than
 * papered over (spec §6): the DOM rendering in `app.js` and `screens/*.js` has
 * no test — that would need a browser dependency this project does not have.
 * A green run here verifies the view-models, not the pixels.
 *
 * This file was opened by web-ui plan 3 Task 10 rather than by plan 1 Task 16,
 * which named it first and had not landed yet: `src/ui/public/lib/` did not
 * exist on master, so the plan-3 task that said *modify `viewmodel.js`* and
 * *extend `viewmodel.test.ts`* created both. Plan 1 Task 16 has now landed and
 * joins its own helpers (`extractNonce`, `exchangeNonce`, `shouldPing`,
 * `startHeartbeat`, `t`, `tFlat`, `pickLanguage`, `applyLanguage`) into this
 * same file, below the SSE/view-model sections plan 3 opened it with, rather
 * than starting a second file — one file per the DOM-free half of
 * `src/ui/public/lib/`, exactly as the plan's own Step 1 named it before
 * either task actually landed.
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
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_KINDS } from '../../src/core/audit.ts';
import {
  CONTEXT_SAMPLE_FRESH_MS as SERVER_CONTEXT_SAMPLE_FRESH_MS,
} from '../../src/core/context-occupancy.ts';

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
  /**
   * `plan:walk seq:118` — the served handover verdict, carried and never
   * re-derived. `verdict: null` is "nobody told us", which is a different fact
   * from the `'off'` the server sends when the feature is switched off.
   */
  handover: {
    verdict: string | null;
    path: string | null;
    askedAt: string | null;
    writtenAt: string | null;
    /** `handoverThresholdPercent`, the number the occupancy bands are derived from. */
    threshold: number | null;
  };
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
  /** `plan:walk seq:117` — the two boundaries, derived from a threshold. */
  occupancyBands: (threshold: unknown) => { warn: number; crit: number } | null;
  fillLevel: (pct: unknown, ageMs?: unknown) => string | null;
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
  rateWindows: (body: unknown) => {
    fiveHour: { usedPercent: number; resetsAt: number | null } | null;
    sevenDay: { usedPercent: number; resetsAt: number | null } | null;
  };
  /** `plan:walk seq:117` — which band a live figure falls in, or `'stale'`, or nothing. */
  occupancyLevel: (pct: unknown, threshold: unknown, ageMs: unknown) => string | null;
  OCCUPANCY_WARN_FRACTION: number;
  CONTEXT_SAMPLE_FRESH_MS: number;
  /** `plan:walk seq:4` — the three states `measureCorpusDrift`'s answer can be in. */
  corpusDrift: (corpus: unknown) => { state: string; aheadByMs: number | null };
  sparkline: (buckets: { total: number }[], width: number, height: number) => string;
  describeStreamEvent: (event: string, data: unknown) => StreamEvent;
  /** Task 17: the query grammar all three nav.inj selection screens share. */
  selectQuery: (
    event: string, path: string | null, session: string,
    extra?: Record<string, string | number>,
  ) => string;
  /** Task 17: a budget's fill, clamped, with the overflow kept as a fact. */
  budgetBar: (used: number, budget: number) => { pct: number; over: boolean };
  /** Task 19: doctor's findings, grouped by code and ordered worst-first. */
  groupFindings: (findings: Finding[]) => Map<string, Finding[]>;
  /**
   * Task 19: the composed, never-run repair for a finding code — or `null`,
   * which is the ordinary answer. `item` is `string | null` because
   * `Finding.item` is optional and the absence is real.
   */
  repairCommandFor: (code: string, item: string | null) => string | null;
  /**
   * `plan:walk seq:61`: how many findings there are, and how many of them a
   * command can repair — the two numbers `doc.tally` substitutes, under the
   * slot names it declares.
   */
  repairTally: (findings: Finding[]) => { findings: number; repairs: number };
  /** Task 18: the coverage tree, the gap list, and the ego graph's columns. */
  buildTree: (files: { path: string; governs: string[] }[]) => TreeNode;
  coverageGaps: (tree: TreeNode) => string[];
  coverageGapRows: (tree: TreeNode) => { path: string; files: number }[];
  treeRows: (tree: TreeNode) => { node: TreeNode; depth: number }[];
  coverageDot: (node: TreeNode) => 'g' | 'o' | 'w';
  coverageIsEmpty: (body: { pinned: string[]; files: { governs: string[] }[] }) => boolean;
  layoutGraph: (
    nodes: { id: string }[],
    edges: { from: string; to: string; type: string }[],
    focusId: string,
  ) => Placed[];
  edgeClass: (edge: { dangling: boolean; loadBearing: boolean }) => 'bearing' | 'ref' | 'dangling';
  egoNodeClass: (
    node: { id: string; missing: boolean; status: string | null }, focusId: string,
  ) => 'focus' | 'missing' | 'superseded' | '';
}

/** `Finding` as `src/doctor/checks.ts` declares it, at this boundary. */
interface Finding {
  level: string;
  code: string;
  message: string;
  item?: string;
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
  // (`ui/watch-model.ts` · `function sseSend(res: ServerResponse, event: string, data: unknown): void {` · ~635).
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
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~339), and
 * this plan's own prose says four in several places. `access` and `progress`
 * are the two that were left out, so they are the two most likely to be
 * described by a branch written for something else: both must come back with
 * `tokens: null` — an injection-only field — and an empty spill list.
 */
test('describeRecord describes all seven kinds, and invents an injection out of none of them', async () => {
  const { describeRecord } = await vm();
  assert.equal(AUDIT_KINDS.length, 7);
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

/**
 * **The occupancy bands are DERIVED FROM THE THRESHOLD, and this is the test
 * that makes "derived" mean something** — `plan:walk seq:117`, owner ruling
 * 2026-08-31: *"Colour against `handoverThresholdPercent`, not a constant."*
 *
 * A test that only checked 88.2 and 98 would pass against a hard-coded pair of
 * numbers, which is exactly what the ruling forbids. So the boundaries are
 * checked AT TWO DIFFERENT THRESHOLDS: move the threshold and both boundaries
 * move with it, proportionally, which a constant cannot do.
 */
test('occupancyBands are a fraction of the threshold, not a remembered pair of numbers', async () => {
  const { occupancyBands, OCCUPANCY_WARN_FRACTION } = await vm();
  // The live default: `handoverThresholdPercent()` resolves to 98 with nothing
  // configured, and 98 * 0.9 is 88.2 — 9.8 points of runway before the ask,
  // against the 1.75 that remain between the ask and the auto-compaction the
  // audit log measured at 99.7147% and 99.809%.
  assert.deepEqual(occupancyBands(98), { warn: 98 * OCCUPANCY_WARN_FRACTION, crit: 98 });
  // A DIFFERENT threshold moves both. This is the assertion a constant fails.
  assert.deepEqual(occupancyBands(80), { warn: 80 * OCCUPANCY_WARN_FRACTION, crit: 80 });
  assert.equal(occupancyBands(80)!.warn, 72);
  // With the handover feature off there is no ask, so there is no band to name
  // against one. `null`, never a fallback constant.
  assert.equal(occupancyBands(null), null);
  assert.equal(occupancyBands(undefined), null);
  assert.equal(occupancyBands(Number.NaN), null);
});

/**
 * **The ABSOLUTE fill bands, which are the half of the context figure that does
 * NOT move** — owner ruling 2026-08-31, *"the context figure becomes TWO
 * fields, not one."*
 *
 * `occupancyBands` above is derived from the configured handover threshold and
 * moves with it. This pair does not, and that is the whole distinction: how
 * full a window is does not become a different fact because somebody
 * reconfigured when the handover fires. The two boundaries are declared once,
 * exported by name, and restated by name in `src/cli/commands/statusline-
 * powerline.ts` — `test/cli/statusline-powerline.test.ts` holds the terminal
 * and the browser to the same answer at every boundary, which is the seam.
 * This file holds the DECLARATION.
 */
test('the absolute fill bands are fixed at 60 and 85, and are exported by name', async () => {
  const { CONTEXT_FILL_WARN_PERCENT, CONTEXT_FILL_CRIT_PERCENT } = await vm();
  assert.equal(CONTEXT_FILL_WARN_PERCENT, 60);
  assert.equal(CONTEXT_FILL_CRIT_PERCENT, 85);
});

test('fillLevel bands on the absolute pair, and refuses to place a fossil', async () => {
  const {
    fillLevel, CONTEXT_FILL_WARN_PERCENT: W, CONTEXT_FILL_CRIT_PERCENT: C,
    CONTEXT_SAMPLE_FRESH_MS,
  } = await vm();
  // Derived from the constants, never written down twice: a boundary moved
  // there moves this test with it.
  assert.equal(fillLevel(0, 0), 'ok');
  assert.equal(fillLevel(W - 0.1, 0), 'ok');
  // `>=` on both boundaries, so a window sitting exactly on one is IN it.
  assert.equal(fillLevel(W, 0), 'warn');
  assert.equal(fillLevel(C - 0.1, 0), 'warn');
  assert.equal(fillLevel(C, 0), 'crit');
  assert.equal(fillLevel(100, 0), 'crit');

  // NO THRESHOLD ARGUMENT, and that is the point of the split: this is the same
  // answer at every configured threshold, because it does not take one.
  assert.equal(fillLevel.length, 2, 'fillLevel takes a percentage and an age — never a threshold');

  // A fossil is unplaced here exactly as it is for the handover proximity, so
  // the two fields go quiet together rather than one of them staying confident.
  assert.equal(fillLevel(91, CONTEXT_SAMPLE_FRESH_MS), 'crit');
  assert.equal(fillLevel(91, CONTEXT_SAMPLE_FRESH_MS + 1), 'stale');

  // Nothing to place is null, never a band.
  assert.equal(fillLevel(null, 0), null);
  assert.equal(fillLevel(Number.NaN, 0), null);
});

/**
 * **The account's two rate-limit windows, read defensively.** The payload can
 * decline to say at three levels — no `rateLimits` at all, one window missing,
 * a percentage in a shape this code will not read — and every one of them is
 * `null`, never a zero. A window nobody reported is not a window measured at
 * 0%, and drawing one would be a claim about an account that was never made.
 */
test('rateWindows answers null for every shape that is not a reported percentage', async () => {
  const { rateWindows } = await vm();
  assert.deepEqual(rateWindows(null), { fiveHour: null, sevenDay: null });
  assert.deepEqual(rateWindows({}), { fiveHour: null, sevenDay: null });
  assert.deepEqual(rateWindows({ rateLimits: null }), { fiveHour: null, sevenDay: null });
  assert.deepEqual(
    rateWindows({ rateLimits: { fiveHour: { usedPercent: '12', resetsAt: 5 }, sevenDay: null } }),
    { fiveHour: null, sevenDay: null },
    'a percentage that is not a number is NOT REPORTED, and never 12',
  );
  assert.deepEqual(
    rateWindows({ rateLimits: { fiveHour: { usedPercent: 16, resetsAt: null }, sevenDay: { usedPercent: 50, resetsAt: 1788354000 } } }),
    {
      fiveHour: { usedPercent: 16, resetsAt: null },
      sevenDay: { usedPercent: 50, resetsAt: 1788354000 },
    },
    'a reported percentage with no reset time is still worth drawing',
  );
});

test('occupancyLevel places a figure in a band, and refuses to place a fossil', async () => {
  const { occupancyLevel, CONTEXT_SAMPLE_FRESH_MS } = await vm();
  // Either side of both boundaries at the served 98.
  assert.equal(occupancyLevel(23.5, 98, 0), 'ok');
  assert.equal(occupancyLevel(88.1, 98, 0), 'ok');
  assert.equal(occupancyLevel(88.2, 98, 0), 'warn');
  assert.equal(occupancyLevel(97.9, 98, 0), 'warn');
  // ON the boundary is AT the ask, not one step below it: the ask fires here.
  assert.equal(occupancyLevel(98, 98, 0), 'crit');
  assert.equal(occupancyLevel(99.7147, 98, 0), 'crit');
  // The bands move with the threshold here too, which is the same property
  // `occupancyBands` above proves one level down: at a threshold of 80 the warn
  // band opens at 72, so 75 — comfortably `ok` against 98 — is `warn` here.
  assert.equal(occupancyLevel(70, 80, 0), 'ok');
  assert.equal(occupancyLevel(75, 80, 0), 'warn');
  assert.equal(occupancyLevel(75, 98, 0), 'ok', 'the same figure, a different threshold, a '
    + 'different band — which is what "derived" means and what a constant cannot do');
  assert.equal(occupancyLevel(80, 80, 0), 'crit');

  // **A STALE FIGURE IS NOT LEVELLED.** The live corpus's own case: 60.1%,
  // received 29 hours ago. Levelled, that is a confident green about a window
  // that no longer exists.
  assert.equal(occupancyLevel(60.1, 98, 29 * 3_600_000), 'stale');
  assert.equal(occupancyLevel(99.9, 98, 29 * 3_600_000), 'stale',
    'staleness beats the band — a fossil in confident red is the worst case, not an exception');
  // The boundary itself, both sides.
  assert.equal(occupancyLevel(60.1, 98, CONTEXT_SAMPLE_FRESH_MS), 'ok');
  assert.equal(occupancyLevel(60.1, 98, CONTEXT_SAMPLE_FRESH_MS + 1), 'stale');

  // Nothing to level: no percentage, or no threshold to name a band against.
  assert.equal(occupancyLevel(null, 98, 0), null);
  assert.equal(occupancyLevel(60.1, null, 0), null);
});

/**
 * **ONE FRESHNESS WINDOW, TWO LANGUAGES, AND THE MIRROR IS HELD** —
 * `plan:walk seq:123`.
 *
 * The constant used to exist only in `lib/viewmodel.js`, which meant only the
 * browser enforced it: `readOccupancy` handed `Stop` and `PreCompact` a
 * confident percentage off the very 29-hour-old sample the chip above was
 * refusing to colour. One product, two answers about one file, and the ONE that
 * mattered — the ask that writes the handover before a compaction — was the one
 * with no gate.
 *
 * `core/context-occupancy.ts` owns it now and the browser module restates it by
 * name, the way `lib/live-invalidation.js` restates the server's
 * `STREAM_POLL_MS`, because a browser ES module cannot import a `.ts` one.
 * A restatement with nothing holding it is a copy that rots, so this is the
 * thing holding it: the two are imported here and compared. It is deliberately
 * an EQUALITY and not a range — the whole defect was the two halves disagreeing,
 * and a range is a licence to disagree by a little.
 */
test('the freshness window the page enforces IS the one the server enforces', async () => {
  const { CONTEXT_SAMPLE_FRESH_MS: browser } = await vm();
  assert.equal(browser, SERVER_CONTEXT_SAMPLE_FRESH_MS,
    'lib/viewmodel.js restates core/context-occupancy.ts by name; they have drifted apart');
});

/**
 * **`false` is a MEASUREMENT and `null` is not**, and this is the distinction
 * the whole chip exists to keep. `core/corpus-drift.ts` answers `null` rather
 * than `false` for a sweep that hit its entry bound and found nothing, because
 * "nothing here" over the part that fit is not the question that was asked — so
 * a surface drawing this must say "not known" and may never say "no".
 */
test('corpusDrift keeps not-known apart from nothing-changed', async () => {
  const { corpusDrift } = await vm();
  assert.deepEqual(corpusDrift({ drifted: false, aheadByMs: null, scanned: 42, truncated: false }),
    { state: 'in-step', aheadByMs: null });
  assert.deepEqual(corpusDrift({ drifted: true, aheadByMs: 240_000, scanned: 42, truncated: false }),
    { state: 'drifted', aheadByMs: 240_000 });
  // The truncated sweep, which `measureCorpusDrift` reports as `null` for
  // exactly this reason.
  assert.deepEqual(corpusDrift({ drifted: null, aheadByMs: null, scanned: 5000, truncated: true }),
    { state: 'unknown', aheadByMs: null });
  // And nothing served at all — an older server, or a call that has not
  // answered yet. NOT `in-step`: a page nobody has told is not a page that
  // measured nothing.
  assert.deepEqual(corpusDrift(null), { state: 'unknown', aheadByMs: null });
  assert.deepEqual(corpusDrift(undefined), { state: 'unknown', aheadByMs: null });
  // A drift with no age is still a drift: the state is what the chip is about
  // and the age is the disclosure beside it.
  assert.deepEqual(corpusDrift({ drifted: true }), { state: 'drifted', aheadByMs: null });
});

/**
 * **The handover verdict travels; it is never re-derived here** — `plan:walk
 * seq:118`. `core/handover-ask.ts` computes it against the file's mtime and a
 * browser can stat nothing, so what this checks is that the block is READ
 * faithfully and that an absent one lands on a shape the caller draws nothing
 * for — which is NOT the same as `off`.
 */
test('contextStrip carries the served handover verdict, and invents none', async () => {
  const { contextStrip } = await vm();
  const withHandover = contextStrip({
    sample: { receivedAt: '2026-08-31T10:00:00.000Z', model: null, version: null,
      context: { state: 'known', usedTokens: 47000, windowSize: 200000, percent: 23.5 } },
    mycontext: null, mycontextError: null,
    handover: {
      verdict: 'ignored', path: 'reports/V2-HANDOVER.md',
      askedAt: '2026-08-31T09:00:00.000Z', writtenAt: null, thresholdPercent: 98,
    },
  }, false);
  assert.equal(withHandover.handover.verdict, 'ignored');
  assert.equal(withHandover.handover.threshold, 98);
  assert.equal(withHandover.handover.askedAt, '2026-08-31T09:00:00.000Z');

  // A body from a server that predates the field. `verdict: null` is what the
  // caller draws NOTHING for, and it is deliberately not `off`: "the feature is
  // switched off" is something this page was told, and "nobody told us
  // anything" is not.
  const without = contextStrip({ sample: null, mycontext: null, mycontextError: null }, false);
  assert.equal(without.handover.verdict, null);
  assert.equal(without.handover.threshold, null);
  // And a cold session, which has no endpoint to ask at all.
  assert.equal(contextStrip(null, true).handover.verdict, null);
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
 * (`ui/watch-model.ts` · `if (result.resync) sseSend(res, 'resync', {});` · ~700).
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

// --- Task 16: bootstrap, heartbeat, i18n ------------------------------------
//
// The shell's own pure logic, loaded through the same `lib<T>()` helper the
// sections above already use — a `file://` URL specifier, because a bare
// relative `import()` type-checks as TS2307/TS7016 with `allowJs` off (the
// header above explains why in full).

interface BootstrapModule {
  extractNonce: (hash: string) => string | null;
  exchangeNonce: (
    fetchFn: (path: string, init: unknown) => Promise<{ ok: boolean; json: () => Promise<{ token: string }> }>,
    nonce: string,
  ) => Promise<string | null>;
}

interface HeartbeatModule {
  shouldPing: (visibilityState: string) => boolean;
  startHeartbeat: (doc: { visibilityState: string }, pingFn: () => void, intervalMs: number) => () => void;
}

interface I18nModule {
  pickLanguage: (stored: string | null, navigatorLang: string) => 'en' | 'he';
  t: (
    strings: Record<string, string>,
    key: string,
    subs: Record<string, unknown> | undefined,
    // `append` is part of the contract since emphasis landed: a `{b:}` run
    // holds CHILD nodes, so `t()` calls it on the element it just created.
    doc: { createTextNode: (t: string) => unknown; createElement: (tag: string) => { className: string; textContent: string; append: (...ns: never[]) => void; tag?: string; kind?: string } },
  ) => { kind?: string; tag?: string; className?: string; textContent: string;
    kids?: { className?: string; textContent: string }[] }[];
  tFlat: (strings: Record<string, string>, key: string, subs?: Record<string, unknown>) => string;
  /** The substitution names a template requires. The grammar's one parser. */
  slots: (template: string) => string[];
  applyLanguage: (documentEl: { setAttribute: (name: string, value: string) => void }, table: { lang: string; dir: string }) => void;
}

const bootstrap = (): Promise<BootstrapModule> => lib<BootstrapModule>('bootstrap.js');
const heartbeat = (): Promise<HeartbeatModule> => lib<HeartbeatModule>('heartbeat.js');
const i18n = (): Promise<I18nModule> => lib<I18nModule>('i18n.js');

test('extractNonce reads the fragment and rejects junk', async () => {
  const { extractNonce } = await bootstrap();
  assert.equal(extractNonce('#abc123'), 'abc123');
  assert.equal(extractNonce(''), null);
  assert.equal(extractNonce('#'), null);
  assert.equal(extractNonce('#not hex!'), null);
});

test('exchangeNonce posts the nonce and returns the token, or null on any refusal', async () => {
  const { exchangeNonce } = await bootstrap();
  const calls: { path: string; init: unknown }[] = [];
  const ok = (reqPath: string, init: unknown) => {
    calls.push({ path: reqPath, init });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'tok-1' }) });
  };
  assert.equal(await exchangeNonce(ok, 'deadbeef'), 'tok-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.path, '/api/handoff');
  assert.deepEqual(
    JSON.parse((calls[0]!.init as { body: string }).body),
    { nonce: 'deadbeef' },
  );

  const refused = () => Promise.resolve({ ok: false, json: () => Promise.resolve({ token: 'must-not-be-read' }) });
  assert.equal(await exchangeNonce(refused, 'deadbeef'), null);
});

test('shouldPing is the visibility rule and nothing else', async () => {
  const { shouldPing } = await heartbeat();
  assert.equal(shouldPing('visible'), true);
  assert.equal(shouldPing('hidden'), false);
  assert.equal(shouldPing('prerender'), false);
});

test('startHeartbeat pings only while visible, and stop() clears the timer', async () => {
  const { startHeartbeat } = await heartbeat();
  const doc = { visibilityState: 'visible' };
  let pings = 0;
  // A generous interval and generous waits, deliberately: Windows' default
  // timer resolution is ~15.6ms, so a tight interval can fire once instead
  // of the "obvious" number of times inside a short window — measured here,
  // not assumed, after a first draft asserted `>= 2` at a 5ms interval over
  // 17ms and saw exactly 1. And `stop()` sits in a `finally`, unconditionally
  // — the same first draft threw out of the `assert.ok` below with `stop()`
  // never reached, which leaves an un-cleared `setInterval` ticking forever
  // and the whole `node --test` PROCESS unable to exit, ever: not a slow
  // test, a hung one. Every path out of this test must clear the timer.
  const stop = startHeartbeat(doc, () => { pings += 1; }, 25);
  let seenVisible = 0;
  try {
    await new Promise((r) => setTimeout(r, 160));
    seenVisible = pings;
    assert.ok(seenVisible >= 2, `expected at least two pings while visible in 160ms at a 25ms interval, saw ${seenVisible}`);

    doc.visibilityState = 'hidden';
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(pings, seenVisible, 'no further ping while hidden');
  } finally {
    stop();
  }
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(pings, seenVisible, 'no ping after stop(), even once visible again');
});

/**
 * `t()` returns NODES (owner ruling A1, §0.6). The stand-in `doc` is why this
 * runs under `node --test` at all: `t()` touches nothing on the document but
 * the two factory methods, so two methods are all a test has to supply.
 */
test('t() returns nodes, and each marker builds the element the grammar names', async () => {
  const { t } = await i18n();
  const doc = {
    createTextNode: (text: string) => ({ kind: 'text', textContent: text }),
    createElement: (tag: string) => ({
      kind: 'element', tag, className: '', textContent: '', append: (): void => {},
    }),
  };
  const strings = {
    'a.plain': 'hello {name}, {n} items',
    'a.mono': 'run {m:mycontext ui} first',
    'a.monoValue': 'in sync with origin/{mv:branch}',
  };
  const plain = t(strings, 'a.plain', { name: 'x', n: 3 }, doc);
  assert.deepEqual(plain.map((n) => n.textContent), ['hello ', 'x', ', ', '3', ' items']);
  // A plain slot is an ISOLATED ELEMENT — span.v — and not a bare run of text
  // (§0.7). `.v` carries `unicode-bidi: isolate` and nothing else, so a count
  // or an id keeps its own direction inside RTL prose and looks unchanged.
  assert.deepEqual(plain.map((n) => n.kind), ['text', 'element', 'text', 'element', 'text']);
  assert.deepEqual([plain[1]!.tag, plain[1]!.className], ['span', 'v']);

  const mono = t(strings, 'a.mono', {}, doc);
  assert.deepEqual([mono[1]!.kind, mono[1]!.tag, mono[1]!.className, mono[1]!.textContent],
    ['element', 'span', 'm', 'mycontext ui']);

  // {mv:…} is the one a string-returning t() could not even SEE: \w excludes
  // the colon, so it matched nothing and shipped its braces to the screen. It
  // is both at once — monospace like {m:…}, substituted like {name} — and the
  // pair of classes it carries is how it says so.
  const value = t(strings, 'a.monoValue', { branch: 'feature/x' }, doc);
  assert.deepEqual([value[1]!.tag, value[1]!.className, value[1]!.textContent],
    ['span', 'm v', 'feature/x']);

  assert.throws(() => t(strings, 'a.missing', {}, doc));           // an undeclared key
  assert.throws(() => t(strings, 'a.plain', { name: 'x' }, doc));  // a missing substitution
});

/**
 * **The emphasis markers, and the nesting that is the whole reason they are not
 * a fifth branch of the old regex.**
 *
 * The design of record wraps value slots INSIDE emphasis in five places -- the
 * plainest is `<b>"<span class="v">3</span> of <span class="v">5</span>" is
 * counted, never stored</b>`. A payload matched as `[^}]*` cannot contain the
 * `}` that closes an inner run, so a flat pattern truncates the bold at the
 * first inner slot and puts the rest of the sentence on screen as loose text
 * with a stray brace in it. The third assertion below is the one that catches
 * that, and it is the reason this test exists at all.
 */
test('emphasis builds b and i, and value slots survive INSIDE them', async () => {
  const { t, tFlat } = await i18n();
  // A richer stand-in than the one above: emphasis holds CHILDREN, so a doc
  // whose elements cannot be appended to could not show the defect either way.
  // `textContent` is an accessor pair rather than a field for the same reason
  // -- a plain field would read back as the empty string it was constructed
  // with and silently drop every word inside the bold.
  const kidsOf = new Map<object, { className: string; textContent: string }[]>();
  const doc = {
    createTextNode: (text: string) => ({ kind: 'text', className: '', textContent: text }),
    createElement: (tag: string) => {
      const kids: { className: string; textContent: string }[] = [];
      const node = {
        kind: 'element', tag, className: '',
        append: (...ns: never[]): void => { kids.push(...ns); },
        get textContent(): string { return kids.map((n) => n.textContent).join(''); },
        set textContent(v: string) {
          kids.length = 0;
          kids.push({ className: '', textContent: v });
        },
      };
      kidsOf.set(node, kids);
      return node;
    },
  };
  const childrenOf = (n: object): { className: string; textContent: string }[] =>
    kidsOf.get(n) ?? [];
  const strings = {
    'a.bold': 'and {b:then done} -- as against a rule',
    'a.ital': 'it lets the agent {i:ask}',
    'a.nested': '{b:"{done} of {steps}" is counted, never stored} beside it',
    'a.mixed': '{b:Injecting only in {m:active} is the mechanism}',
  };

  const bold = t(strings, 'a.bold', {}, doc);
  assert.deepEqual([bold[1]!.tag, bold[1]!.textContent], ['b', 'then done']);
  assert.equal(bold[2]!.textContent, ' -- as against a rule',
    'the text after a closed emphasis run must survive');

  const ital = t(strings, 'a.ital', {}, doc);
  assert.equal(ital[1]!.tag, 'i');

  // THE ONE THAT MATTERS. A flat `[^}]*` payload stops at the `}` of `{done}`,
  // so the bold would be `"` and the rest of the sentence would leak out.
  const nested = t(strings, 'a.nested', { done: 3, steps: 5 }, doc);
  const inner = childrenOf(nested[0]!);
  assert.equal(nested[0]!.tag, 'b');
  assert.deepEqual(inner.map((n) => (n.className === '' ? null : n.className)),
    [null, 'v', null, 'v', null],
    'the bold must hold text, slot, text, slot, text -- five children, in order');
  assert.equal(nested[0]!.textContent, '"3 of 5" is counted, never stored');
  assert.equal(nested[1]!.textContent, ' beside it',
    'and the sentence must continue AFTER the bold, not inside it');

  // A monospace literal nested in emphasis, which is the other shape the
  // mockup uses.
  const mixed = t(strings, 'a.mixed', {}, doc);
  assert.deepEqual(childrenOf(mixed[0]!).map((n) => (n.className === '' ? null : n.className)),
    [null, 'm', null]);

  // Attributes cannot hold an element, so emphasis flattens like everything
  // else -- INCLUDING what is nested inside it, which a stand-in with a plain
  // textContent field would silently drop.
  assert.equal(tFlat(strings, 'a.nested', { done: 3, steps: 5 }),
    '"3 of 5" is counted, never stored beside it');
});

test('tFlat flattens the same three markers, and that is what attributes get', async () => {
  const { tFlat } = await i18n();
  const strings = { 'a.aria': 'in sync with origin/{mv:branch}, run {m:mycontext ui}' };
  // The isolation is GONE, on purpose: an aria-label cannot hold an element.
  assert.equal(tFlat(strings, 'a.aria', { branch: 'main' }),
    'in sync with origin/main, run mycontext ui');
});

test('pickLanguage prefers the stored choice, then the navigator, then en', async () => {
  const { pickLanguage } = await i18n();
  assert.equal(pickLanguage('he', 'en-US'), 'he');
  assert.equal(pickLanguage(null, 'he-IL'), 'he');
  assert.equal(pickLanguage(null, 'fr-FR'), 'en');
  assert.equal(pickLanguage('nonsense', 'he-IL'), 'he'); // junk storage is ignored, not honoured
});

test('applyLanguage sets <html lang dir>, dir following the language (spec §3)', async () => {
  const { applyLanguage } = await i18n();
  const attrs: Record<string, string> = {};
  const documentEl = { setAttribute: (name: string, value: string) => { attrs[name] = value; } };
  applyLanguage(documentEl, { lang: 'he', dir: 'rtl' });
  assert.deepEqual(attrs, { lang: 'he', dir: 'rtl' });
});

/**
 * Every real key `app.js` names via `t()`/`tFlat()` outside a screen's own
 * render() — the shell's own vocabulary — must exist in both tables, for the
 * same reason `describeStreamEvent`'s keys are checked above: `t()` throws on
 * a missing key, so a typo here blanks the header or the exit banner rather
 * than mislabelling one word of it.
 */
test('every string key app.js itself names is declared in both tables', async () => {
  const REPO = path.join(import.meta.dirname, '..', '..');
  const load = async (lang: string): Promise<{ strings: Record<string, string> }> => {
    const file = path.join(REPO, 'src', 'ui', 'public', 'strings', `${lang}.js`).replaceAll('\\', '/');
    return (await import(new URL(`file://${file}`).href)) as { strings: Record<string, string> };
  };
  const en = await load('en');
  const he = await load('he');
  const appJs = readFileSync(path.join(REPO, 'src', 'ui', 'public', 'app.js'), 'utf8');
  const keys = [...appJs.matchAll(/translate\(table\.strings,\s*'([^']+)'|flat\(table\.strings,\s*'([^']+)'/g)]
    .map((m) => m[1] ?? m[2])
    .filter((k): k is string => typeof k === 'string' && !k.includes('${'));
  assert.ok(keys.length > 0, 'app.js names no literal string key — this assertion is checking nothing');
  for (const key of keys) {
    assert.ok(key in en.strings, `app.js names ${key}, missing from the English table`);
    assert.ok(key in he.strings, `app.js names ${key}, missing from the Hebrew table`);
  }
});

// --- The nav.inj screens' view-models (plan 1, Task 17) ---------------------

test('selectQuery builds the shared grammar, cold vs session', async () => {
  const { selectQuery } = await vm();
  assert.equal(selectQuery('tool', 'src/a.ts', 'cold'), 'event=tool&path=src%2Fa.ts&cold=1');
  assert.equal(selectQuery('session-start', null, 's1'), 'event=session-start&session=s1');
  assert.equal(selectQuery('tool', 'a b.ts', 's1', { jit: 100 }), 'event=tool&path=a+b.ts&session=s1&jit=100');
});

/**
 * The two absences are ONE absence. A screen whose picker has no selection
 * yet hands over `null`; a screen that never had a picker omits the argument
 * entirely. Both must produce a query with no `path` at all, because
 * `/api/select` refuses `path=` on any event but `tool` — it "refuses what it
 * would ignore" — so an empty string smuggled through here is a 400 the
 * caller cannot read as its own mistake.
 */
test('selectQuery omits path for both spellings of absence', async () => {
  const { selectQuery } = await vm();
  assert.equal(selectQuery('compact', null, 'cold'), 'event=compact&cold=1');
  assert.equal(selectQuery('compact', undefined as unknown as null, 'cold'), 'event=compact&cold=1');
});

test('budgetBar computes fill and overflow', async () => {
  const { budgetBar } = await vm();
  assert.deepEqual(budgetBar(50, 200), { pct: 25, over: false });
  assert.deepEqual(budgetBar(300, 200), { pct: 100, over: true });
  assert.deepEqual(budgetBar(0, 0), { pct: 0, over: false });
});

/**
 * A zero budget that was nonetheless charged is OVER, and this is the case a
 * guard written as `if (budget <= 0) return { pct: 0, over: false }` gets
 * wrong: `0/0` is NaN, so the division has to be avoided — but avoiding it
 * must not also throw away the overflow, which is a real fact about a tier
 * budgeted to nothing and asked for something.
 */
test('budgetBar keeps the overflow when the budget is zero', async () => {
  const { budgetBar } = await vm();
  assert.deepEqual(budgetBar(1, 0), { pct: 0, over: true });
  assert.deepEqual(budgetBar(200, 200), { pct: 100, over: false });
});

/**
 * **Every string key the three `nav.inj` screens name is declared in BOTH
 * tables, and every value slot those keys declare is supplied at the call
 * site.**
 *
 * `t()` throws twice on purpose — once for a key the table does not declare,
 * once for a substitution the caller did not pass — so either mistake blanks a
 * screen rather than mislabelling one line of it. Neither is reachable by any
 * other test here: the DOM glue in `screens/*.js` is the stated untested
 * surface (spec §6), so nothing else ever evaluates one of these calls.
 *
 * It is not hypothetical. The plan's own Step 3 sketch for these three screens
 * names nine keys — `preview.pickFile`, `preview.nothing`, `preview.spilled`,
 * `preview.renderedText`, `common.loading`, `injected.none`, `simulate.budget`,
 * `simulate.fits`, `simulate.spills` — and **the tables declare none of them**,
 * because they are transcribed key-for-key from the design of record and it
 * declares none of them either. Written as the sketch has it, not one of these
 * screens renders a line.
 *
 * **What the scan can and cannot prove.** The key check is exact: a literal in
 * the source either is a declared key or is not. The slot check is a SUPERSET
 * test — it asserts each slot name the template declares appears as `name:`
 * somewhere inside the call's argument object, and a nested object reusing the
 * name would satisfy it. That is the weaker half of the pair and is said so
 * rather than claimed as more; the failure it actually catches, a slot nobody
 * supplies, is the one that throws at runtime.
 */
test('every string key any screen names is declared, with its slots supplied', async () => {
  const REPO = path.join(import.meta.dirname, '..', '..');
  const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');
  const load = async (language: string): Promise<{ strings: Record<string, string> }> => {
    const file = path.join(REPO, 'src', 'ui', 'public', 'strings', `${language}.js`)
      .replaceAll('\\', '/');
    return (await import(new URL(`file://${file}`).href)) as { strings: Record<string, string> };
  };
  const en = (await load('en')).strings;
  const he = (await load('he')).strings;

  // The three run markers, as `strings/en.js`'s own grammar block spells them.
  // `{m:…}` is a literal and is NOT a value slot; `{name}` and `{mv:name}` are.
  // The grammar has ONE parser, and this is it. Eight files used to carry a
  // private `/\{(?:(mv|m):)?([^}]*)\}/` instead, which predates emphasis and
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  /** The argument object of a `ctx.t(key, {…})` call, by brace depth. */
  const argsAfter = (source: string, from: number): string | null => {
    const open = source.indexOf('{', from);
    const close = source.indexOf(')', from);
    if (open === -1 || (close !== -1 && close < open)) return null;
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(open, i + 1);
      }
    }
    return null;
  };

  // **The file list is DERIVED, not listed** (Task 19). It was
  // `['preview.js', 'simulate.js', 'injected.js', 'parts.js']` — the four
  // files that existed when Task 17 wrote this — and a screen added afterwards
  // was outside the scan with nothing to say so. That is the same shape as the
  // hole this test exists to close: a phantom key blanks its screen, and a
  // screen the scanner never opened blanks it just as quietly. Every module in
  // the directory is read, so a fifth screen is covered the moment it lands.
  const used: { key: string; args: string | null; file: string }[] = [];
  const names = readdirSync(SCREENS).filter((name) => name.endsWith('.js')).sort();
  assert.ok(names.length >= 4,
    `only ${names.length} screen module(s) found under ${SCREENS}; the scan would pass vacuously`);
  for (const name of names) {
    const source = readFileSync(path.join(SCREENS, name), 'utf8');
    for (const m of source.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
      used.push({ key: m[1]!, args: argsAfter(source, m.index + m[0].length), file: name });
    }
    // `screenHead(ctx, root, titleKey, verdictKey, subKey)` — three keys in one
    // call, none of which the pattern above can see. The call may carry a
    // fourth argument (the verdict glyph, Task 19), so this stops at the third
    // key rather than at the closing paren: anchoring on `)` made status.js's
    // and learn.js's three keys invisible here the day they were written.
    for (const m of source.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'/g)) {
      for (const key of [m[1]!, m[2]!, m[3]!]) used.push({ key, args: null, file: name });
    }
  }

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 20,
    `the scan found ${used.length} key(s) across the nav.inj screens; it has been ~30 since `
    + 'Task 17 landed. A collapse means the patterns stopped matching, not that the screens '
    + 'stopped naming keys.');

  const missing: string[] = [];
  const unsupplied: string[] = [];
  for (const { key, args, file } of used) {
    if (!(key in en)) { missing.push(`${key} (English, named by ${file})`); continue; }
    if (!(key in he)) { missing.push(`${key} (Hebrew, named by ${file})`); continue; }
    // Both tables are checked for slots, not only English: `strings-parity`
    // holds the slot NAMES equal across the pair, so a Hebrew value that
    // inflects differently still declares the same names.
    for (const table of [en, he]) {
      for (const slot of slotsOf(table[key]!)) {
        if (args === null || !new RegExp(`\\b${slot}\\s*:`).test(args)) {
          unsupplied.push(`${key} needs {${slot}}, and ${file} does not pass it`);
        }
      }
    }
  }
  assert.deepEqual(missing, [],
    'a screen naming a key no table declares blanks that screen: t() throws rather than '
    + 'rendering a blank, and the fix is the mockup first, then both tables.');
  assert.deepEqual(unsupplied, [],
    'a missing substitution throws too — leaving {n} on screen is the same defect wearing a '
    + 'different marker, which is why t() refuses it.');
});

// --- Task 19: doctor's findings ---------------------------------------------

/**
 * The two orderings `groupFindings` owes, which answer two different
 * questions: inside a group, the worst instance of one code first; between
 * groups, the worst code first, so the whole screen reads worst-first and
 * reads the same way twice. `runChecks` returns findings in check-REGISTRATION
 * order, which is an implementation detail of the checker and not an order a
 * reader should be shown as meaningful.
 */
test('groupFindings groups by code and keeps level order', async () => {
  const { groupFindings } = await vm();
  const groups = groupFindings([
    { level: 'info', code: 'b', message: 'i' },
    { level: 'error', code: 'a', message: 'e' },
    { level: 'warn', code: 'a', message: 'w' },
  ]);
  assert.deepEqual([...groups.keys()], ['a', 'b']); // error-bearing groups first
  assert.deepEqual(groups.get('a')!.map((f) => f.level), ['error', 'warn']);
});

test('groupFindings breaks a tie on the code, so the same corpus draws the same screen twice', async () => {
  const { groupFindings } = await vm();
  const groups = groupFindings([
    { level: 'warn', code: 'source_drift', message: 'd' },
    { level: 'warn', code: 'dead_scope', message: 's' },
    { level: 'warn', code: 'index_stale', message: 'i' },
  ]);
  assert.deepEqual([...groups.keys()], ['dead_scope', 'index_stale', 'source_drift']);
});

/**
 * Two findings identical in code AND level keep the order `runChecks`
 * produced them in — the order the files were walked, which is the only order
 * this function has any right to preserve. `Array.prototype.sort` is required
 * to be stable, so this is a property of the language rather than of luck; it
 * is pinned because a "clever" comparator added later could break it silently.
 */
test('groupFindings is stable within one code and level', async () => {
  const { groupFindings } = await vm();
  const rows = groupFindings([
    { level: 'warn', code: 'dead_scope', message: 'first', item: 'INV-a' },
    { level: 'warn', code: 'dead_scope', message: 'second', item: 'INV-b' },
    { level: 'error', code: 'dead_scope', message: 'third', item: 'INV-c' },
  ]).get('dead_scope')!;
  assert.deepEqual(rows.map((f) => f.message), ['third', 'first', 'second']);
});

/**
 * A level this build does not know sorts LAST rather than to `NaN`. The
 * browser has no types: `LEVEL_ORDER[level] - LEVEL_ORDER[other]` on an
 * unknown string returns `NaN` for every pair, which `sort` reads as "equal"
 * — so one unrecognised finding does not misplace itself, it unsorts the whole
 * list and nothing says so.
 */
test('groupFindings does not let an unknown level unsort everything around it', async () => {
  const { groupFindings } = await vm();
  const groups = groupFindings([
    { level: 'catastrophe', code: 'z', message: 'unknown level' },
    { level: 'info', code: 'b', message: 'i' },
    { level: 'error', code: 'a', message: 'e' },
  ]);
  assert.deepEqual([...groups.keys()], ['a', 'b', 'z']);
});

test('groupFindings drops nothing — every finding the checker reported comes back', async () => {
  const { groupFindings } = await vm();
  const input = [
    { level: 'error', code: 'a', message: '1' },
    { level: 'warn', code: 'a', message: '2' },
    { level: 'info', code: 'a', message: '3' },
    { level: 'info', code: 'b', message: '4' },
  ];
  const out = [...groupFindings(input).values()].flat();
  assert.equal(out.length, input.length,
    'a finding dropped between the checker and the screen is undetectable from the screen');
  assert.deepEqual(out.map((f) => f.message).sort(), ['1', '2', '3', '4']);
});

/**
 * **The establish-by-executing row of this task, and what executing
 * established.**
 *
 * The plan's own table is explicit that it is a sketch — *"establish the exact
 * command per code by reading `src/doctor/checks.ts`'s finding messages during
 * implementation … the composed command must match the message's own
 * recommendation, not this table"*. Reading them corrected four rows, and each
 * correction is one assertion below:
 *
 *  - `index_missing` → `null`. Its message says the index *"is disposable and
 *    will be built on the next command"*. A Copy button under a finding that
 *    asks for nothing invents work.
 *  - `orphan_relation` → `null`. *"Create it, or remove the line from
 *    &lt;filePath&gt;"* — a file edit; neither half is a command.
 *  - `source_missing` → `null`. The message names `mycontext supersede`, but
 *    `supersede` REQUIRES `--by <replacement id>` and this screen has no
 *    replacement to put there. A line that cannot be pasted without editing is
 *    not a composed command.
 *  - `mycontext repair` takes no id at all (`usage: mycontext repair
 *    [--yes]`), so every row the plan routed through `mycontext repair <id>`
 *    would have composed something the CLI refuses.
 */
test('repairCommandFor composes only what a finding message itself recommends', async () => {
  const { repairCommandFor } = await vm();

  // The four that name a runnable command, in the message's own words.
  assert.equal(repairCommandFor('index_stale', null), 'mycontext rebuild');
  assert.equal(repairCommandFor('source_drift', 'RULE-never-log-customer-email'),
    'mycontext refresh RULE-never-log-customer-email --yes');
  assert.equal(repairCommandFor('audit_log_size', null), 'mycontext audit --files');
  assert.equal(repairCommandFor('corpus_size_fallback_ceiling', null), 'mycontext decay');

  // The four corrections, each against the plan's own sketch.
  assert.equal(repairCommandFor('index_missing', null), null,
    'the message says the index will be built on the next command — it asks for nothing');
  assert.equal(repairCommandFor('orphan_relation', 'INV-prices-are-integer-cents'), null,
    'the message asks for a file edit, and mycontext repair takes no id');
  assert.equal(repairCommandFor('source_missing', 'INV-prices-are-integer-cents'), null,
    'supersede requires --by <replacement id>, which this screen does not have');
  assert.equal(repairCommandFor('dead_scope', 'INV-prices-are-integer-cents'), null,
    're-scoping is an edit to the item file, not a command');

  // A code this build has never heard of gets no command rather than a guess.
  assert.equal(repairCommandFor('some_check_added_next_year', 'CONST-x'), null);
});

/**
 * `source_drift` is the only row that takes an argument, so it is the only
 * row where quoting can go wrong — and it goes through `composeCommand`, the
 * one place quoting lives in this UI, rather than through a fourth spelling of
 * it. An id with no item is not composable at all: the finding would name a
 * file to refresh and not say which.
 */
test('repairCommandFor quotes its one argument, and refuses to compose without one', async () => {
  const { repairCommandFor } = await vm();
  assert.equal(repairCommandFor('source_drift', 'RULE with spaces'),
    'mycontext refresh "RULE with spaces" --yes');
  assert.equal(repairCommandFor('source_drift', null), null);
  assert.equal(repairCommandFor('source_drift', ''), null);
});

/**
 * **`plan:walk seq:61` — the number that tells a healthy corpus from a broken
 * screen.**
 *
 * Owner, 2026-08-28: *"doctor lost it's execute an fix controls ? why yo broke
 * it ?"* Nothing had. That day cleared nine `source_file` links — which retired
 * every `source_drift`, the code supplying most of the screen's controls — and
 * `blocked_without_needs` landed, whose remedy is a person naming a blocker.
 * The two facts a reader had to tell apart from an identical blank toolbar were
 * "this corpus needs no command" and "this build lost its commands", and the
 * only difference a screen can draw is a count.
 *
 * The three cases below are the three the report is made of, and the first is
 * the one that reproduces the owner's corpus exactly: two findings, both real
 * codes, neither repairable, and a tally that says so instead of nothing.
 */
test('repairTally counts the findings and the ones a command can repair', async () => {
  const { repairTally } = await vm();

  // The owner's own corpus on 2026-08-28, code for code.
  assert.deepEqual(
    repairTally([
      { level: 'warn', code: 'blocked_without_needs', message: 'm', item: 'TASK-a' },
      { level: 'info', code: 'nested_corpus', message: 'm' },
    ]),
    { findings: 2, repairs: 0 },
    'a corpus whose findings are all repaired by a person must still be COUNTED — a zero here '
    + 'is the sentence that distinguishes it from a screen that lost its controls',
  );

  assert.deepEqual(repairTally([]), { findings: 0, repairs: 0 });

  // **Findings, not deduped command lines.** `cardCommands` dedupes by the
  // composed line because two rows sharing a code share one `.cmd` block; that
  // is a count of CONTROLS. This is the count of rows those controls answer
  // for, which is what "of N findings" is a fraction of. Two `index_stale` rows
  // compose one line and are two repairable findings.
  assert.deepEqual(
    repairTally([
      { level: 'error', code: 'index_stale', message: 'm' },
      { level: 'error', code: 'index_stale', message: 'm' },
      { level: 'warn', code: 'dead_scope', message: 'm', item: 'INV-a' },
    ]),
    { findings: 3, repairs: 2 },
  );

  // `source_drift` with no item composes nothing (see the test above), so it is
  // an UNREPAIRABLE finding and the tally must agree with the row that draws it.
  assert.deepEqual(
    repairTally([
      { level: 'error', code: 'source_drift', message: 'm', item: 'RULE-a' },
      { level: 'error', code: 'source_drift', message: 'm' },
    ]),
    { findings: 2, repairs: 1 },
  );
});


/**
 * **Every string key the three `nav.inj` screens name is declared in BOTH
 * tables, and every value slot those keys declare is supplied at the call
 * site.**
 *
 * `t()` throws twice on purpose — once for a key the table does not declare,
 * once for a substitution the caller did not pass — so either mistake blanks a
 * screen rather than mislabelling one line of it. Neither is reachable by any
 * other test here: the DOM glue in `screens/*.js` is the stated untested
 * surface (spec §6), so nothing else ever evaluates one of these calls.
 *
 * It is not hypothetical. The plan's own Step 3 sketch for these three screens
 * names nine keys — `preview.pickFile`, `preview.nothing`, `preview.spilled`,
 * `preview.renderedText`, `common.loading`, `injected.none`, `simulate.budget`,
 * `simulate.fits`, `simulate.spills` — and **the tables declare none of them**,
 * because they are transcribed key-for-key from the design of record and it
 * declares none of them either. Written as the sketch has it, not one of these
 * screens renders a line.
 *
 * **What the scan can and cannot prove.** The key check is exact: a literal in
 * the source either is a declared key or is not. The slot check is a SUPERSET
 * test — it asserts each slot name the template declares appears as `name:`
 * somewhere inside the call's argument object, and a nested object reusing the
 * name would satisfy it. That is the weaker half of the pair and is said so
 * rather than claimed as more; the failure it actually catches, a slot nobody
 * supplies, is the one that throws at runtime.
 */
test('every string key the built screens name is declared, with its slots supplied', async () => {
  const REPO = path.join(import.meta.dirname, '..', '..');
  const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');
  const load = async (language: string): Promise<{ strings: Record<string, string> }> => {
    const file = path.join(REPO, 'src', 'ui', 'public', 'strings', `${language}.js`)
      .replaceAll('\\', '/');
    return (await import(new URL(`file://${file}`).href)) as { strings: Record<string, string> };
  };
  const en = (await load('en')).strings;
  const he = (await load('he')).strings;

  // The three run markers, as `strings/en.js`'s own grammar block spells them.
  // `{m:…}` is a literal and is NOT a value slot; `{name}` and `{mv:name}` are.
  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  /** The argument object of a `ctx.t(key, {…})` call, by brace depth. */
  const argsAfter = (source: string, from: number): string | null => {
    const open = source.indexOf('{', from);
    const close = source.indexOf(')', from);
    if (open === -1 || (close !== -1 && close < open)) return null;
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(open, i + 1);
      }
    }
    return null;
  };

  const used: { key: string; args: string | null; file: string }[] = [];
  for (const name of [
    'preview.js', 'simulate.js', 'injected.js', 'parts.js',
    // Task 18's three. The scan is the only thing that ever evaluates a
    // `ctx.t()` key in a screen file, so a screen left out of this list is a
    // screen whose phantom key nothing catches until it blanks in a browser.
    'coverage.js', 'gaps.js', 'graph.js',
  ]) {
    const source = readFileSync(path.join(SCREENS, name), 'utf8');
    for (const m of source.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
      used.push({ key: m[1]!, args: argsAfter(source, m.index + m[0].length), file: name });
    }
    // `screenHead(ctx, root, titleKey, verdictKey, subKey)` — three keys in one
    // call, none of which the pattern above can see.
    for (const m of source.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
      for (const key of [m[1]!, m[2]!, m[3]!]) used.push({ key, args: null, file: name });
    }
  }

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 20,
    `the scan found ${used.length} key(s) across the built screens; it has been ~30 since `
    + 'Task 17 landed and ~55 since Task 18 added three more. A collapse means the patterns '
    + 'stopped matching, not that the screens stopped naming keys.');

  const missing: string[] = [];
  const unsupplied: string[] = [];
  for (const { key, args, file } of used) {
    if (!(key in en)) { missing.push(`${key} (English, named by ${file})`); continue; }
    if (!(key in he)) { missing.push(`${key} (Hebrew, named by ${file})`); continue; }
    // Both tables are checked for slots, not only English: `strings-parity`
    // holds the slot NAMES equal across the pair, so a Hebrew value that
    // inflects differently still declares the same names.
    for (const table of [en, he]) {
      for (const slot of slotsOf(table[key]!)) {
        if (args === null || !new RegExp(`\\b${slot}\\s*:`).test(args)) {
          unsupplied.push(`${key} needs {${slot}}, and ${file} does not pass it`);
        }
      }
    }
  }
  assert.deepEqual(missing, [],
    'a screen naming a key no table declares blanks that screen: t() throws rather than '
    + 'rendering a blank, and the fix is the mockup first, then both tables.');
  assert.deepEqual(unsupplied, [],
    'a missing substitution throws too — leaving {n} on screen is the same defect wearing a '
    + 'different marker, which is why t() refuses it.');
});


// --- The coverage tree, the gap list and the ego layout (Task 18) -----------

/**
 * The plan's own Step 1 assertions, written through `vm()` rather than through
 * the relative `await import('../../src/ui/public/lib/viewmodel.js')` its
 * sketch uses: with `allowJs` off that specifier is TS7016 and `npm run
 * typecheck` is a gate — the same reason, in the same words, as this file's own
 * header. Three agents have hit it.
 */
test('buildTree aggregates governance up directories; coverageGaps names the ungoverned', async () => {
  const { buildTree, coverageGaps } = await vm();
  const tree = buildTree([
    { path: 'src/a.ts', governs: ['RULE-1'] },
    { path: 'src/b.ts', governs: [] },
    { path: 'docs/x.md', governs: [] },
  ]);
  const src = tree.children.find((c) => c.name === 'src');
  const docs = tree.children.find((c) => c.name === 'docs');
  assert.deepEqual(src?.governs, ['RULE-1']);
  assert.equal(src?.fileCount, 2);
  assert.equal(src?.governedCount, 1);
  assert.equal(docs?.governedCount, 0);
  assert.deepEqual(coverageGaps(tree), ['docs']);
});


/**
 * **The roll-up is every ancestor, not the parent.** A file three directories
 * down has to be counted by all three and by the root, and the parent-walk is
 * the fiddly part the plan's own sketch flagged: a loop that stops one short
 * leaves `src/` reporting fewer files than `src/billing/tax/` beneath it, which
 * is the arithmetic the coverage count exists to be trusted on.
 *
 * The ROOT is asserted too, because its `governs` is what `coverageIsEmpty`
 * reads against and its `fileCount` is the only total the screen ever shows.
 */
test('buildTree rolls a file up through every ancestor, root included', async () => {
  const { buildTree } = await vm();
  const tree = buildTree([
    { path: 'src/billing/tax/vat.ts', governs: ['INV-1', 'STD-2'] },
    { path: 'src/billing/plans.ts', governs: [] },
    { path: 'README.md', governs: ['INV-1'] },
  ]);
  const src = tree.children.find((c) => c.name === 'src');
  const billing = src?.children.find((c) => c.name === 'billing');
  const tax = billing?.children.find((c) => c.name === 'tax');
  assert.equal(tax?.fileCount, 1);
  assert.equal(billing?.fileCount, 2);
  assert.equal(src?.fileCount, 2);
  assert.equal(tree.fileCount, 3);
  assert.equal(src?.governedCount, 1);
  assert.equal(tree.governedCount, 2);
  // The UNION, deduped and sorted — the same two ids reached the root by two
  // different paths and the root names each once.
  assert.deepEqual(tree.governs, ['INV-1', 'STD-2']);
  assert.deepEqual(billing?.governs, ['INV-1', 'STD-2']);
});


/**
 * Directories before files, then by name — the mockup's own tree order, and the
 * order `treeRows` flattens. A file sorted in among the directories would put
 * `src/api/`'s subtree after a sibling file that belongs above it.
 */
test('treeRows flattens the mockup\'s order and never draws the root as a row', async () => {
  const { buildTree, treeRows } = await vm();
  const tree = buildTree([
    { path: 'z.md', governs: [] },
    { path: 'src/api/errors.ts', governs: [] },
    { path: 'src/keys.ts', governs: [] },
  ]);
  assert.deepEqual(
    treeRows(tree).map((r) => [r.node.path, r.depth]),
    [['src', 0], ['src/api', 1], ['src/api/errors.ts', 2], ['src/keys.ts', 1], ['z.md', 0]],
  );
});


/**
 * **The shallowest ungoverned directory, once — not its subtree.** Three
 * ungoverned directories nested inside one another are one row a reader can act
 * on, and `cov.e2`'s rule for the empty state is the same rule: said once, not
 * repeated per row.
 *
 * A FILE is never a gap: the actionable unit is a directory a scope glob can be
 * written for, and every ungoverned file already wears a `.dot w` on the tree.
 */
test('coverageGaps names the shallowest ungoverned directory and stops descending', async () => {
  const { buildTree, coverageGaps, coverageGapRows } = await vm();
  const tree = buildTree([
    { path: 'vendor/a/b/one.js', governs: [] },
    { path: 'vendor/a/b/two.js', governs: [] },
    { path: 'src/api/errors.ts', governs: ['STD-1'] },
    { path: 'src/workers/mailer.ts', governs: [] },
    { path: 'top.md', governs: [] },
  ]);
  assert.deepEqual(coverageGaps(tree), ['src/workers', 'vendor']);
  assert.deepEqual(coverageGapRows(tree), [
    { path: 'src/workers', files: 1 },
    { path: 'vendor', files: 2 },
  ]);
});


/**
 * `n` — *"not examined"* — is a state about paths the walk did not reach, and
 * `/api/coverage` carries no path list for it. Every node this function is
 * asked about came OUT of the walk, so it can never be that state, and this
 * pins the refusal rather than leaving it to a comment: a later hand adding an
 * `n` branch here would be inventing the one state `gaps.note` says must never
 * be folded into another.
 */
test('coverageDot is g / o / w and never the not-examined state', async () => {
  const { coverageDot } = await vm();
  const node = (governs: string[], governedCount: number) => ({
    name: 'x', path: 'x', children: [], governs, fileCount: 4, governedCount,
  });
  assert.equal(coverageDot(node([], 0)), 'w');
  assert.equal(coverageDot(node(['A'], 3)), 'o');
  assert.equal(coverageDot(node(['A', 'B'], 3)), 'g');
  // Ungoverned wins over the item count: a directory whose only governing item
  // reaches none of its files is a gap, whatever its `governs` union says.
  assert.equal(coverageDot(node(['A'], 0)), 'w');
});


/**
 * **Both halves, because the pinned items are hoisted out of the per-path
 * answer.** A corpus holding nothing but an `always:true` item governs every
 * path in the repository, and a screen that read only `files` would draw
 * *"Nothing governs this project yet"* over a project that is fully governed —
 * which is `cov.pinhelp`'s recorded defect, pointed the other way.
 */
test('coverageIsEmpty reads the pinned hoist as well as the paths', async () => {
  const { coverageIsEmpty } = await vm();
  assert.equal(coverageIsEmpty({ pinned: [], files: [] }), true);
  assert.equal(coverageIsEmpty({ pinned: [], files: [{ governs: [] }] }), true);
  assert.equal(coverageIsEmpty({ pinned: ['CONST-1'], files: [{ governs: [] }] }), false);
  assert.equal(coverageIsEmpty({ pinned: [], files: [{ governs: ['RULE-1'] }] }), false);
});


/** The plan's own Step 1 assertions for the layout, unchanged. */
test('layoutGraph is deterministic and layered by BFS depth', async () => {
  const { layoutGraph } = await vm();
  const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const edges = [
    { from: 'A', to: 'B', type: 'supersedes' },
    { from: 'A', to: 'C', type: 'relates' },
  ];
  const first = layoutGraph(nodes, edges, 'A');
  const second = layoutGraph(nodes, edges, 'A');
  assert.deepEqual(first, second); // deterministic — run twice, same pixels
  const a = first.find((p) => p.id === 'A');
  const b = first.find((p) => p.id === 'B');
  const c = first.find((p) => p.id === 'C');
  assert.equal(a?.x, 0);
  assert.equal(b?.x, 1);
  assert.equal(c?.x, 1);
  assert.notEqual(b?.y, c?.y);
});


/**
 * **Direction is the layout** (`gr.note`), and this is the assertion that says
 * so: what points AT the focus sits in a column BEFORE it, what the focus points
 * at sits after, and the focus is in the middle. The test above passes for a
 * plain unsigned BFS too — every node in it is an out-neighbour — so without
 * this one the mockup's three columns would be unpinned.
 *
 * The empty column is not reserved: with nothing pointing at the focus the
 * layout draws two columns and the focus is at index 0, which is exactly what
 * the assertion above depends on.
 */
test('layoutGraph puts what points at the focus in the column before it', async () => {
  const { layoutGraph } = await vm();
  const placed = layoutGraph(
    [{ id: 'IN' }, { id: 'F' }, { id: 'OUT' }],
    [
      { from: 'IN', to: 'F', type: 'constrains' },
      { from: 'F', to: 'OUT', type: 'refines' },
    ],
    'F',
  );
  assert.deepEqual(
    placed.map((p) => [p.id, p.x, p.depth]),
    [['F', 1, 0], ['IN', 0, -1], ['OUT', 2, 1]],
  );
});


/**
 * Rows inside a column come out in (relation type, id) order — the same
 * comparison `/api/graph` sorts its own adjacency by, so the server's order and
 * the drawing's order are one decision rather than two that can disagree.
 */
test('layoutGraph orders a column by relation type then id', async () => {
  const { layoutGraph } = await vm();
  const placed = layoutGraph(
    [{ id: 'F' }, { id: 'Z' }, { id: 'A' }, { id: 'M' }],
    [
      { from: 'F', to: 'Z', type: 'refines' },
      { from: 'F', to: 'A', type: 'refines' },
      { from: 'F', to: 'M', type: 'constrains' },
    ],
    'F',
  );
  assert.deepEqual(placed.filter((p) => p.x === 1).map((p) => p.id), ['M', 'A', 'Z']);
});


/**
 * An edge naming a node this response does not carry is not placed. The cap
 * drops NODES and reports `omitted` as a count, so a client must not invent a
 * position for an id it was never sent.
 */
test('layoutGraph places no node the response does not carry', async () => {
  const { layoutGraph } = await vm();
  const placed = layoutGraph(
    [{ id: 'F' }],
    [{ from: 'F', to: 'DROPPED', type: 'relates_to' }],
    'F',
  );
  assert.deepEqual(placed, [{ id: 'F', x: 0, y: 0, depth: 0 }]);
});


/**
 * **`dangling` outranks `bearing`, and that ordering is the point.** `gr.note`
 * keeps breakage and severity apart — *"a dangling `relates_to` reads as noise
 * and a dangling `constrains` reads as an alarm"* — and a broken load-bearing
 * relation has to draw as broken or the legend's third line style is never
 * reached by the case it exists for.
 */
test('edgeClass draws breakage over severity, and severity over neither', async () => {
  const { edgeClass } = await vm();
  assert.equal(edgeClass({ dangling: true, loadBearing: true }), 'dangling');
  assert.equal(edgeClass({ dangling: true, loadBearing: false }), 'dangling');
  assert.equal(edgeClass({ dangling: false, loadBearing: true }), 'bearing');
  assert.equal(edgeClass({ dangling: false, loadBearing: false }), 'ref');
});


/** The three node states the legend names, and the empty fourth that is none. */
test('egoNodeClass reads the response fields rather than deriving a state', async () => {
  const { egoNodeClass } = await vm();
  const node = (id: string, missing: boolean, status: string | null) => ({ id, missing, status });
  assert.equal(egoNodeClass(node('F', false, 'active'), 'F'), 'focus');
  assert.equal(egoNodeClass(node('X', true, null), 'F'), 'missing');
  assert.equal(egoNodeClass(node('X', false, 'superseded'), 'F'), 'superseded');
  assert.equal(egoNodeClass(node('X', false, 'active'), 'F'), '');
  // The focus wears its own state even when it is superseded: it is the item
  // the reader asked about, and the column it sits in is what says so.
  assert.equal(egoNodeClass(node('F', false, 'superseded'), 'F'), 'focus');
});

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  governs: string[];
  fileCount: number;
  governedCount: number;
}

interface Placed { id: string; x: number; y: number; depth: number }

interface ViewModelModule {
  describeRecord: (record: Record<string, unknown>) => DescribedRecord;
  dedupeKey: (record: unknown) => string;
  formatAge: (ms: number) => string;
  contextStrip: (body: unknown, isCold: boolean) => Strip;
  sparkline: (buckets: { total: number }[], width: number, height: number) => string;
  describeStreamEvent: (event: string, data: unknown) => StreamEvent;
  /** Task 17: the query grammar all three nav.inj selection screens share. */
  selectQuery: (
    event: string, path: string | null, session: string,
    extra?: Record<string, string | number>,
  ) => string;
  /** Task 17: a budget's fill, clamped, with the overflow kept as a fact. */
  budgetBar: (used: number, budget: number) => { pct: number; over: boolean };
  /** Task 18: the coverage tree, the gap list, and the ego graph's columns. */
  buildTree: (files: { path: string; governs: string[] }[]) => TreeNode;
  coverageGaps: (tree: TreeNode) => string[];
  coverageGapRows: (tree: TreeNode) => { path: string; files: number }[];
  treeRows: (tree: TreeNode) => { node: TreeNode; depth: number }[];
  coverageDot: (node: TreeNode) => 'g' | 'o' | 'w';
  coverageIsEmpty: (body: { pinned: string[]; files: { governs: string[] }[] }) => boolean;
  layoutGraph: (
    nodes: { id: string }[],
    edges: { from: string; to: string; type: string }[],
    focusId: string,
  ) => Placed[];
  edgeClass: (edge: { dangling: boolean; loadBearing: boolean }) => 'bearing' | 'ref' | 'dangling';
  egoNodeClass: (
    node: { id: string; missing: boolean; status: string | null }, focusId: string,
  ) => 'focus' | 'missing' | 'superseded' | '';
}
