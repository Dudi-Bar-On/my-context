/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * This replaces the single-sample "hook completes within the latency
 * ceiling on a large corpus" test that used to live in
 * `test/hooks/session-start.test.ts`. That test took one wall-clock
 * measurement inside `node --test`'s default *concurrent* runner — with
 * ~280 other tests competing for cores it measured ~674ms against its
 * 500ms ceiling, and passed comfortably run alone. It was flaky by
 * construction: failing for a reason unrelated to the code under test.
 *
 * The 500ms budget itself is correct and unchanged from the plan: it is
 * SessionStart's budget (once per session, full disk rebuild of the whole
 * corpus from Markdown), not the JIT hook's 50ms per-tool-call budget.
 * `buildSessionStartOutput` is exercised here across many iterations with
 * no session id, so it performs the same full rebuild every call with no
 * ledger state carried between iterations — the true steady-state cost.
 *
 * Recorded baseline (2026-08-16, dev machine, `npm run test:perf`,
 * two runs): p95 ~45.6–46.3ms, well inside the 500ms ceiling. Re-derived
 * after the never-miss change moved the index rebuild off the
 * injection-critical path (plan Task 5); the 500ms ceiling is unchanged and
 * was re-verified against the new shape, per the rule that a widened
 * ceiling records why (`focus-latency.perf.ts:21-22`). The previous
 * baseline (2026-08-13, same machine, before the reorder) was ~54.9–55.5ms
 * — the fall matches the design's prediction, since selection no longer
 * waits on the write transaction. Compare future CI/local p95 readings
 * against these figures to tell a genuine regression from ordinary
 * machine-to-machine variance.
 *
 * The THIRD test below covers what Task 12 added after the write to stdout:
 * the `state/` sweep. See its own docblock for why it recomposes the entry
 * guard's pair rather than spawning the binary, and why its 200 fixture files
 * are fresh rather than stale.
 *
 * The second test below covers the compact/restore branch this one
 * deliberately skips (no session id): with a session id and a real
 * snapshot present — recorded baseline (2026-08-16, dev machine, two runs)
 * is p95 ~149.1–163.6ms, still comfortably inside the 500ms ceiling. The
 * pre-reorder baseline (2026-08-13) was ~123.9ms; the rise is the restore
 * path's new work — the seen-file restore marker and the best-effort
 * index refresh both run per call in this shape — measured, recorded, and
 * inside the unchanged ceiling. See that test's own docblock for the two
 * conditions (a normative corpus, a fresh session/snapshot per iteration)
 * this depends on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { pruneSnapshots, writeSnapshot } from '../../src/core/ledger.ts';
import { SEEN_FILE_SUFFIX } from '../../src/core/seen-file.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const CORPUS_SIZE = 500;
/** The `state/` fixture for the sweep case below: 200 entries, all inside the retention window. */
const STATE_FILES = 200;
const WARMUP = 3;
const ITERATIONS = 20;
// 500ms is the product budget; widened 10× on the GitHub Windows runner only
// (an 819ms breach was observed there on unchanged code, run 31674652091) —
// see test/helpers/perf.ts for what the widened ceiling certifies.
const CEILING_MS = perfCeiling(500);

function lesson(i: number): Item {
  return {
    id: `LESSON-${i}`, type: 'lesson', title: `Lesson number ${i}`, status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/lesson/LESSON-${i}.md`,
  };
}

/**
 * Unlike `lesson`, `type: 'constraint'` is a NORMATIVE category (see
 * `src/core/categories.ts`) — only normative items ever pass `isNormative`
 * and become eligible for `selection.full` in `select.ts`. The compact perf
 * case below needs restored items to actually land in `full` (so
 * `recordRestored` runs on the timed path); a `lesson` corpus could never do
 * that regardless of `always` or the restore ids passed in, since rationale
 * items are excluded from full injection entirely.
 */
function constraintItem(i: number): Item {
  return {
    id: `CONST-${i}`, type: 'constraint', title: `Constraint number ${i}`, status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/constraint/CONST-${i}.md`,
  };
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('SessionStart stays under the 500ms p95 ceiling on a 500-item corpus rebuild', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-session-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  // Written straight to disk (not through the CLI's `add`) so corpus setup
  // is a one-time cost rather than 500 CLI invocations — the hook itself
  // still does the real work: reading and parsing every file on every call.
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, lesson(i));

  // Warm-up: lazy module init and cold file-cache reads are real cost but a
  // one-time one — not what the per-call ceiling is meant to protect.
  for (let i = 0; i < WARMUP; i++) buildSessionStartOutput(cwd);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    buildSessionStartOutput(cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `session-start p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});

/**
 * The test above passes no session id, so it never takes the branch a real
 * SessionStart(compact) firing does: the snapshot read, the seen-file read
 * (`readSeen`/`restoredFor`), and the seen-file append are all skipped.
 * (Before the never-miss reorder this branch went through `Ledger.open`/
 * `entries()`/`recordRestored()`; SessionStart no longer touches the
 * ledger at all — dedupe state lives in the per-session seen file.) This
 * exercises the compact branch directly.
 *
 * Two things had to be genuinely true, not just claimed, for the restore
 * marker to actually land on the timed path — both were checked by
 * instrumentation before settling on this shape:
 *
 * 1. The restored ids must resolve to items in a NORMATIVE category. The
 *    corpus below uses `constraint` items (see `constraintItem`), not the
 *    `lesson` corpus the test above uses — `lesson` is a rationale category,
 *    permanently ineligible for `selection.full` regardless of `always` or
 *    the restore ids passed in, so the restore branch would never carry
 *    items no matter how the session/snapshot were varied.
 * 2. The session and its snapshot must be fresh on every iteration, not
 *    reused. The restore dedupe is identity-based (`restoredFor` matches
 *    seen lines against the snapshot's own `capturedAt`), so reusing one
 *    session/snapshot would make every call after the first see its own
 *    prior seen-file append as "already restored for this generation" —
 *    `restore` would collapse to `[]` on every iteration but the first.
 */
test('SessionStart(compact) with a session id and a snapshot stays under the 500ms p95 ceiling', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-compact-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, constraintItem(i));

  const restoredIds = Array.from({ length: 50 }, (_, i) => `CONST-${i}`);

  /** A brand-new session with its own freshly-captured snapshot, so this call's `restore` is never pre-emptied by a previous iteration's seen-file append. */
  function freshCompactOptions(label: string): { source: string; sessionId: string } {
    const sessionId = `perf-compact-${label}`;
    writeSnapshot(ws.projectRoot!, sessionId, restoredIds);
    return { source: 'compact', sessionId };
  }

  for (let i = 0; i < WARMUP; i++) buildSessionStartOutput(cwd, freshCompactOptions(`warmup-${i}`));

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const options = freshCompactOptions(`run-${i}`);
    const started = process.hrtime.bigint();
    buildSessionStartOutput(cwd, options);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `session-start(compact) p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});

/**
 * Task 12 put a `state/` sweep in the SessionStart ENTRY GUARD, immediately
 * after the write to stdout — so it is not reachable from
 * `buildSessionStartOutput`, which is the point: the model already has its
 * text before the sweep starts. This test therefore times the guard's PAIR, in
 * the guard's order (build, then `pruneSnapshots`), rather than spawning the
 * binary. A spawn would measure a cold `node` start type-stripping the whole
 * injection graph — tens of times the cost being bounded here, and a
 * measurement of the machine rather than of the sweep.
 *
 * **The 200 fixture entries are FRESH, not stale**, which is both the honest
 * case and the expensive one. `pruneSnapshots` is a `readdirSync` plus one
 * `statSync` per matching entry; nothing is removed here, so that scan runs in
 * full on every iteration and the directory still holds 200 files at the last
 * one. A stale fixture would delete itself on the first call and leave the
 * remaining nineteen iterations measuring an empty directory — a number that
 * would pass while asserting nothing.
 *
 * Recorded baseline (2026-08-21, dev machine, two runs of the pair measured
 * back to back in one process): sweepless p95 218.9 and 266.1ms, with-sweep
 * p95 234.0 and 383.4ms, against the unchanged 500ms ceiling. Those absolute
 * numbers are 5-6x the 45.6-46.3ms this file's header records for the same
 * sweepless shape in 2026-08-16 — the machine was running five worktrees'
 * suites at once, and the spread between the two runs of the SAME shape (47ms
 * apart sweepless, 149ms apart with the sweep) is larger than anything the
 * sweep could contribute. So the sweep's own share was measured directly
 * instead, isolated from the build: `pruneSnapshots` over 200 fresh entries
 * took 3.1, 3.5, 4.0, 4.1 and 4.3ms. Single-digit milliseconds at 200 entries,
 * measured rather than assumed, which is what Step 4 of the plan asked for.
 * Re-derive all three on an idle machine before reading any of them as a
 * regression signal.
 */
test('SessionStart plus its state/ sweep stays under the 500ms p95 ceiling with 200 state entries', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-sweep-'));
  runCli(['init'], cwd, () => {});

  const root = resolveWorkspace(cwd).projectRoot!;
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(root, lesson(i));

  const stateDir = path.join(root, 'state');
  mkdirSync(stateDir, { recursive: true });
  for (let i = 0; i < STATE_FILES; i++) {
    writeFileSync(path.join(stateDir, `perf-session-${i}${SEEN_FILE_SUFFIX}`), '', 'utf8');
  }

  /** The entry guard's two steps, in its order and with its counting callback. */
  function sessionStartWithSweep(): void {
    buildSessionStartOutput(cwd);
    let seenPruned = 0;
    pruneSnapshots(root, undefined, (name) => {
      if (name.endsWith(SEEN_FILE_SUFFIX)) seenPruned++;
    });
  }

  for (let i = 0; i < WARMUP; i++) sessionStartWithSweep();

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    sessionStartWithSweep();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  // The fixture has to have survived, or every sample after the first measured
  // a directory that had already emptied itself.
  assert.equal(
    readdirSync(stateDir).filter((n) => n.endsWith(SEEN_FILE_SUFFIX)).length,
    STATE_FILES,
    'the sweep removed fixture entries that are inside the retention window',
  );

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `session-start+sweep p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});
