import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { appendUnprojected } from '../helpers/unprojected-audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { auditLogPath, recordAudit } from '../../src/core/audit.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import {
  recordVolume, apiWatchVolume, apiWatchContext, apiWatchSpills, apiWatchRatio, spillRatio,
} from '../../src/ui/watch-model.ts';

/**
 * Watch's read model: the pulse's volume, the context join, and spills.
 *
 * **The projection is built by the PRODUCT, never by the endpoint.** Every
 * fixture below that expects records runs `mycontext audit`, which is the one
 * caller entitled to write `.audit/audit.db`. The endpoints under test open it
 * through `openProjectionReadOnlyChecked`, which creates nothing and repairs
 * nothing — so a fixture that forgot to build it does not get a projection
 * built behind its back, it gets the `absent` state, and there is a test for
 * that below.
 *
 * Cleanup is `removeTree`, the one owner of test temp-directory removal; a
 * bare `rmSync` here is what `test/no-bare-rmsync.test.ts` fails on.
 */
function workspace(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
  return {
    dir,
    root: path.join(dir, '.my_context'),
    done: () => removeTree(dir),
  };
}

/** Build the audit projection the way a user does — the write path this surface may not take. */
function buildProjection(dir: string): void {
  assert.equal(runCli(['audit'], dir, () => {}), 0, 'fixture command failed: audit');
}

function url(pathname: string, qs = ''): URL {
  return new URL(`http://127.0.0.1:1${pathname}${qs === '' ? '' : `?${qs}`}`);
}

/**
 * Every kind at zero — spelled out rather than derived from `AUDIT_KINDS`, so
 * that a kind added to the vocabulary reddens this file instead of quietly
 * widening what it asserts. There are SIX (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~339).
 */
const NO_KINDS = {
  mutation: 0, injection: 0, hook: 0, focus: 0, access: 0, progress: 0, execution: 0,
};

test('recordVolume buckets by kind and drops nothing inside the window', () => {
  const now = Date.parse('2026-08-16T12:00:00.000Z');
  const rows = [
    { at: '2026-08-16T11:30:00.000Z', kind: 'injection' },
    { at: '2026-08-16T11:45:00.000Z', kind: 'focus' },
    { at: '2026-08-16T10:30:00.000Z', kind: 'injection' },
    { at: '2026-08-16T10:31:00.000Z', kind: 'mutation' },
    { at: '2026-08-10T10:30:00.000Z', kind: 'hook' }, // outside the window
  ];
  const buckets = recordVolume(rows, 3_600_000, 2, now);
  assert.equal(buckets.length, 2);
  assert.deepEqual(buckets.map((b) => b.total), [2, 2]);
  assert.equal(buckets[0]!.start, '2026-08-16T10:00:00.000Z');
  // Every kind on every bucket, at zero. An absent key would be
  // indistinguishable from a kind this build does not know.
  assert.deepEqual(buckets[0]!.byKind, { ...NO_KINDS, mutation: 1, injection: 1 });
  assert.deepEqual(buckets[1]!.byKind, { ...NO_KINDS, injection: 1, focus: 1 });
});

test('recordVolume counts a kind it does not know toward the height and colours none of it', () => {
  const now = Date.parse('2026-08-16T12:00:00.000Z');
  const buckets = recordVolume(
    [{ at: '2026-08-16T11:30:00.000Z', kind: 'telepathy' }], 3_600_000, 2, now,
  );
  assert.equal(buckets[1]!.total, 1, 'the pulse stays honest about how much happened');
  assert.deepEqual(buckets[1]!.byKind, NO_KINDS, 'and says nothing it cannot colour');
});

test('recordVolume keeps a record stamped at the closing instant of the window', () => {
  // The live path stamps `at` and then asks `Date.now()`, and the two can land
  // in the SAME millisecond. A half-open window that excludes its own closing
  // instant drops exactly the newest record — the one the pulse exists to show
  // — and drops it silently, which is the invariant this project refuses.
  const now = Date.parse('2026-08-16T12:00:00.000Z');
  const buckets = recordVolume([{ at: '2026-08-16T12:00:00.000Z', kind: 'hook' }], 60_000, 2, now);
  assert.equal(buckets[1]!.total, 1);
  assert.equal(buckets[1]!.byKind.hook, 1);
  // One millisecond into the future is not a measurement of this window.
  assert.equal(
    recordVolume([{ at: '2026-08-16T12:00:00.001Z', kind: 'hook' }], 60_000, 2, now)[1]!.total, 0,
  );
});

test('/api/watch/volume validates its window and answers from the audit projection', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    // The kind the LEDGER could never have supplied — it records injections
    // and nothing else, which is half of why A2 moved this endpoint.
    recordAudit(root, { kind: 'focus', op: 'focus-set', sessionId: 's1', note: 'src/**' });
    buildProjection(dir);

    const ok = apiWatchVolume(ws, url('/api/watch/volume', 'minutes=20&bucket=10'));
    assert.equal(ok.status, 200);
    const body = ok.body as {
      minutes: number; bucketSeconds: number; projectionState: string;
      buckets: { total: number; byKind: Record<string, number> }[];
    };
    assert.equal(body.minutes, 20);
    assert.equal(body.bucketSeconds, 10);
    assert.equal(body.projectionState, 'fresh');
    assert.equal(body.buckets.length, 120);      // the mockup's 120 columns, exactly
    assert.equal(body.buckets.reduce((n, b) => n + b.total, 0), 2);
    assert.equal(body.buckets.reduce((n, b) => n + b.byKind['focus']!, 0), 1);

    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=0')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=99999')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'bucket=0')).status, 400);
    // 20 minutes does not divide into 7-second buckets: refused, not rounded.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=20&bucket=7')).status, 400);
    // 1440 minutes at one-second buckets is 86,400 columns: refused, not sliced.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=1440&bucket=1')).status, 400);
    // The retired parameter is not quietly tolerated either.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'hours=2')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'bogus=1')).status, 400);
    // Given twice, only the first would be read — the same silent drop.
    assert.equal(
      apiWatchVolume(ws, url('/api/watch/volume', 'minutes=20&minutes=40')).status, 400,
    );
  } finally { done(); }
});

test('/api/watch/volume: a projection nobody has built is disclosed as absent, never drawn as zero', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    // No `mycontext audit` here: the endpoint must NOT build one for itself.
    const result = apiWatchVolume(ws, url('/api/watch/volume'));
    assert.equal(result.status, 200);
    const body = result.body as { projectionState: string; buckets: unknown[] };
    assert.equal(body.projectionState, 'absent');
    assert.deepEqual(body.buckets, [],
      'an absent projection answers with NO columns — 120 columns of zero is a flat chart '
      + 'asserting that nothing happened, over a log that holds a record');

    const spills = apiWatchSpills(ws, url('/api/watch/spills'));
    assert.equal(spills.status, 200);
    assert.deepEqual(spills.body, {
      spills: [], topSpilled: [], recordWindow: 1000, projectionState: 'absent',
    });

    // The spill ratio answers with NO bars for the same reason: a chart of
    // zeroes asserts that nothing spilled, over a log this endpoint has not read.
    const ratio = apiWatchRatio(ws, url('/api/watch/ratio'));
    assert.equal(ratio.status, 200);
    assert.deepEqual(ratio.body, {
      rows: [], roleWindow: 1000, truncated: false, projectionState: 'absent',
    });

    const context = apiWatchContext(ws, url('/api/watch/context', 'session=s1')).body as
      { mycontext: unknown; mycontextError: string | null };
    assert.equal(context.mycontext, null, 'a share nobody can compute is null, never 0');
    assert.match(String(context.mycontextError), /mycontext audit/);
  } finally { done(); }
});

test('/api/watch/volume: a projection behind its log refuses rather than answering short', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, { kind: 'focus', op: 'focus-set', sessionId: 's1', note: 'src/**' });
    buildProjection(dir);
    // A record the projection has not consumed. A read may not sync it in —
    // syncing is a write — so the only honest answer is to say so.
    //
    // Appended around `recordAudit`, which projects what it appends now
    // (`core/audit-db.ts` · `export function keepProjectionCurrent(`) and so
    // no longer leaves this state behind. The refusal below is unchanged: what
    // has changed is how often a real corpus arrives at it, not what it owes a
    // reader when it does. `test/helpers/unprojected-audit.ts` lists the ways
    // that are left.
    appendUnprojected(root, { kind: 'focus', op: 'focus-clear', sessionId: 's1' });

    const result = apiWatchVolume(ws, url('/api/watch/volume'));
    assert.equal(result.status, 503);
    const body = result.body as { error: string; projectionState: string };
    assert.equal(body.projectionState, 'behind');
    assert.match(body.error, /mycontext audit/);

    assert.equal(apiWatchSpills(ws, url('/api/watch/spills')).status, 503);
    assert.equal(apiWatchRatio(ws, url('/api/watch/ratio')).status, 503);
    // The context endpoint never fails as a whole — the tee half still answers.
    const context = apiWatchContext(ws, url('/api/watch/context', 'session=s1'));
    assert.equal(context.status, 200);
    assert.equal((context.body as { mycontext: unknown }).mycontext, null);
  } finally { done(); }
});

test('/api/watch/context: no tee is sample null — the no-bridge state, not zero', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    buildProjection(dir);
    const result = apiWatchContext(ws, url('/api/watch/context', 'session=sess-1'));
    assert.equal(result.status, 200);
    const body = result.body as {
      sample: unknown; mycontext: { injections: number } | null; mycontextError: string | null;
    };
    assert.equal(body.sample, null);
    assert.equal(body.mycontext?.injections, 0);
    assert.equal(body.mycontextError, null);
    assert.equal(apiWatchContext(ws, url('/api/watch/context')).status, 400); // session required
    assert.equal(apiWatchContext(ws, url('/api/watch/context', 'sesion=typo')).status, 400);
  } finally { done(); }
});

test('/api/watch/context joins the tee sample to the audit tokens, absences counted', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    writeTee(root, {
      session_id: 'sess-1', version: '2.1.233', model: { display_name: 'Opus 4.5' },
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 1000, cache_creation_input_tokens: 0,
          cache_read_input_tokens: 46000, output_tokens: 1,
        },
      },
    }, '2026-08-16T10:00:00.000Z');
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 'sess-1', hook: 'PreToolUse', path: 'a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 6200 });
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 'sess-1', hook: 'PreToolUse', path: 'b.ts', injected: [{ id: 'RULE-b', tier: 'jit' }] });
    buildProjection(dir);

    const body = apiWatchContext(ws, url('/api/watch/context', 'session=sess-1')).body as {
      sample: { receivedAt: string; model: string; version: string; context: { state: string; usedTokens: number } };
      mycontext: { tokens: number; injections: number; unrecorded: number };
    };
    assert.equal(body.sample.receivedAt, '2026-08-16T10:00:00.000Z');
    assert.equal(body.sample.model, 'Opus 4.5');
    assert.equal(body.sample.version, '2.1.233');
    assert.equal(body.sample.context.state, 'known');
    assert.equal(body.sample.context.usedTokens, 47000);
    assert.deepEqual(body.mycontext, { tokens: 6200, injections: 2, unrecorded: 1 });
  } finally { done(); }
});

test('/api/watch/spills flattens spilled refs with their reasons, item filter narrows, tokens absence is null', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded (900 > 800 estimated tokens)' }],
      tokens: 40,
    });
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's2', hook: 'SessionStart',
      injected: [], spilled: [{ id: 'RULE-c', tier: 'pinned', reason: 'budget exceeded' }],
    });
    buildProjection(dir);

    const all = apiWatchSpills(ws, url('/api/watch/spills')).body as {
      spills: { id: string; reason: string; tokens: number | null; hook: string | null }[];
      topSpilled: { label: string; count: number }[];
      recordWindow: number;
    };
    assert.deepEqual(all.spills.map((s) => s.id), ['RULE-b', 'RULE-c']);
    assert.match(all.spills[0]!.reason, /budget exceeded/);
    assert.equal(all.spills[0]!.tokens, 40);
    assert.equal(all.spills[0]!.hook, 'PreToolUse');
    assert.equal(all.spills[1]!.tokens, null); // not recorded — never zero
    assert.deepEqual(all.topSpilled.map((t) => t.label).sort(), ['RULE-b', 'RULE-c']);
    assert.equal(all.recordWindow, 1000);

    const one = apiWatchSpills(ws, url('/api/watch/spills', 'item=RULE-c')).body as { spills: { id: string }[] };
    assert.deepEqual(one.spills.map((s) => s.id), ['RULE-c']);

    assert.equal(apiWatchSpills(ws, url('/api/watch/spills', 'limit=0')).status, 400);
    assert.equal(apiWatchSpills(ws, url('/api/watch/spills', 'limit=501')).status, 400);
    assert.equal(apiWatchSpills(ws, url('/api/watch/spills', 'bogus=1')).status, 400);
  } finally { done(); }
});

test('/api/watch/volume refuses a damaged audit log rather than answering over the half it can read', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, { kind: 'focus', op: 'focus-set', sessionId: 's1', note: 'src/**' });
    buildProjection(dir);
    // A damaged line that is NOT a torn tail. `projectionState` compares sizes,
    // so this reads as `behind`; either way the answer is a refusal, and the
    // point is that it is never a shorter list presented as complete.
    writeFileSync(auditLogPath(root), '{"this":"is not an audit record"}\n{"nor":"is this"}\n', { flag: 'a' });
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume')).status, 503);
  } finally { done(); }
});

/**
 * The spill ratio, from the two tallies the mockup's own note names.
 *
 * The fixture numbers ARE the mockup's `RATIO` array — six items, delivered
 * against spilled — and the assertion is that the endpoint's ordering
 * reproduces the chart it was written for, including the row that spilled
 * NOTHING. Ranking by spills alone would drop that row; ranking by deliveries
 * alone would drop the top one. The union is the chart.
 */
test('spillRatio unions the two tallies and reproduces the mockup chart, longest red half first', () => {
  const delivered = [
    { label: 'RULE-never-log-customer-email', count: 34, last: null },
    { label: 'INV-prices-are-integer-cents', count: 29, last: null },
    { label: 'STD-error-message-conventions', count: 18, last: null },
    { label: 'RULE-posix-normalized-paths', count: 17, last: null },
    { label: 'INV-markdown-is-the-source-of-truth', count: 12, last: null },
    { label: 'STD-api-errors-use-problem-json', count: 3, last: null },
  ];
  const spilled = [
    { label: 'STD-api-errors-use-problem-json', count: 41, last: null },
    { label: 'INV-markdown-is-the-source-of-truth', count: 22, last: null },
    { label: 'STD-error-message-conventions', count: 9, last: null },
    { label: 'RULE-never-log-customer-email', count: 4, last: null },
    { label: 'INV-prices-are-integer-cents', count: 1, last: null },
  ];
  const { rows, truncated } = spillRatio(delivered, spilled, 1000, 10);
  assert.equal(truncated, false, 'neither tally filled the window, so neither is capped');
  assert.deepEqual(rows, [
    { id: 'STD-api-errors-use-problem-json', delivered: 3, spilled: 41 },
    { id: 'INV-markdown-is-the-source-of-truth', delivered: 12, spilled: 22 },
    { id: 'STD-error-message-conventions', delivered: 18, spilled: 9 },
    { id: 'RULE-never-log-customer-email', delivered: 34, spilled: 4 },
    { id: 'INV-prices-are-integer-cents', delivered: 29, spilled: 1 },
    // Delivered seventeen times and never spilled. `0` here is MEASURED: the
    // spilled tally came back short of the window, so it listed every item
    // that has ever spilled and this one is not among them.
    { id: 'RULE-posix-normalized-paths', delivered: 17, spilled: 0 },
  ]);
  assert.deepEqual(spillRatio(delivered, spilled, 1000, 2).rows.map((r) => r.id),
    ['STD-api-errors-use-problem-json', 'INV-markdown-is-the-source-of-truth']);
});

test('spillRatio reports an unmeasured half as null, never as a zero it did not count', () => {
  // Both tallies FILL the window, so neither listed every item holding its
  // role. An item missing from one of them has a count below that window's
  // cutoff — unknown, and a chart drawing it as an empty bar would assert a
  // history nothing read.
  const { rows, truncated } = spillRatio(
    [{ label: 'RULE-a', count: 5, last: null }, { label: 'RULE-b', count: 4, last: null }],
    [{ label: 'RULE-c', count: 9, last: null }, { label: 'RULE-a', count: 2, last: null }],
    2, 10,
  );
  assert.equal(truncated, true);
  assert.deepEqual(rows, [
    { id: 'RULE-c', delivered: null, spilled: 9 },
    { id: 'RULE-a', delivered: 5, spilled: 2 },
    // Last, because an unmeasured magnitude cannot claim a rank in a chart
    // ordered by magnitude — not even the rank a measured zero would take.
    { id: 'RULE-b', delivered: 4, spilled: null },
  ]);
});

test('/api/watch/ratio pairs delivered against spilled per item, from audit_item.role and nothing else', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }],
      spilled: [{ id: 'RULE-b', tier: 'pinned', reason: 'budget exceeded' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }, { id: 'RULE-c', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's2', hook: 'PreToolUse', path: 'src/b.ts',
      injected: [{ id: 'RULE-c', tier: 'jit' }],
    });
    // The THIRD role. A mutation names its item as `subject`, and a subject is
    // neither a delivery nor a spill: it must reach neither half of this bar.
    recordAudit(root, {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-d', fields: ['body'],
    });
    buildProjection(dir);

    const result = apiWatchRatio(ws, url('/api/watch/ratio'));
    assert.equal(result.status, 200);
    const body = result.body as {
      rows: { id: string; delivered: number | null; spilled: number | null }[];
      roleWindow: number; truncated: boolean; projectionState: string;
    };
    assert.equal(body.projectionState, 'fresh');
    assert.equal(body.roleWindow, 1000);
    assert.equal(body.truncated, false);
    assert.deepEqual(body.rows, [
      { id: 'RULE-b', delivered: 0, spilled: 2 },
      { id: 'RULE-a', delivered: 2, spilled: 0 },
      { id: 'RULE-c', delivered: 2, spilled: 0 },
    ], 'RULE-d was mutated, never delivered and never spilled — it is not a bar on this chart');

    const one = apiWatchRatio(ws, url('/api/watch/ratio', 'limit=1')).body as { rows: { id: string }[] };
    assert.deepEqual(one.rows.map((r) => r.id), ['RULE-b'],
      'the limit cuts from the bottom: the longest red half is the whole point of the chart');

    assert.equal(apiWatchRatio(ws, url('/api/watch/ratio', 'limit=0')).status, 400);
    assert.equal(apiWatchRatio(ws, url('/api/watch/ratio', 'limit=101')).status, 400);
    assert.equal(apiWatchRatio(ws, url('/api/watch/ratio', 'bogus=1')).status, 400);
    // Given twice, only the first would be read — the same silent drop.
    assert.equal(apiWatchRatio(ws, url('/api/watch/ratio', 'limit=5&limit=6')).status, 400);
  } finally { done(); }
});
