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
 * Recorded baseline (2026-08-13, dev machine, `npm run test:perf`,
 * two runs): p95 ~54.9–55.5ms, well inside the 500ms ceiling. Compare
 * future CI/local p95 readings against this figure to tell a genuine
 * regression from ordinary machine-to-machine variance.
 *
 * The second test below covers the compact/restore branch this one
 * deliberately skips (no session id): with a session id and a real
 * snapshot present — Ledger.open, entries(), and recordRestored() all
 * genuinely execute on the timed path every iteration (verified by
 * instrumenting a run and printing the ledger row count after each call,
 * not just asserted) — recorded baseline (2026-08-13, dev machine) is p95
 * ~123.9ms, still comfortably inside the 500ms ceiling. See that test's own
 * docblock for the two conditions (a normative corpus, a fresh
 * session/snapshot per iteration) this depends on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const CORPUS_SIZE = 500;
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
    body: 'A body of roughly forty characters.', observations: [], relations: [],
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
    body: 'A body of roughly forty characters.', observations: [], relations: [],
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
 * SessionStart(compact) firing does: Ledger.open, entries(), the snapshot
 * read, and recordRestored() are all skipped. That is the newest and
 * slowest code added by this plan, and it was previously unmeasured by any
 * perf test. This exercises it directly.
 *
 * Two things had to be genuinely true, not just claimed, for `recordRestored`
 * to actually land on the timed path — both were checked by instrumenting a
 * run and printing the ledger's row count after each call before settling on
 * this shape:
 *
 * 1. The restored ids must resolve to items in a NORMATIVE category. The
 *    corpus below uses `constraint` items (see `constraintItem`), not the
 *    `lesson` corpus the test above uses — `lesson` is a rationale category,
 *    permanently ineligible for `selection.full` regardless of `always` or
 *    the restore ids passed in, so `recordRestored` would never run no
 *    matter how the session/snapshot were varied.
 * 2. The session and its snapshot must be fresh on every iteration, not
 *    reused. The restore dedupe is identity-based (matches ledger rows
 *    against the snapshot's own `capturedAt`), so reusing one session/
 *    snapshot would make every call after the first see its own prior
 *    `recordRestored` write as "already restored for this generation" —
 *    `restore` would collapse to `[]` on every iteration but the first, and
 *    the `selection.full.length > 0` guard would skip `recordRestored` for
 *    the rest.
 */
test('SessionStart(compact) with a session id and a snapshot stays under the 500ms p95 ceiling', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-compact-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, constraintItem(i));

  const restoredIds = Array.from({ length: 50 }, (_, i) => `CONST-${i}`);

  /** A brand-new session with its own freshly-captured snapshot, so this call's `restore` is never pre-emptied by a previous iteration's ledger row. */
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
