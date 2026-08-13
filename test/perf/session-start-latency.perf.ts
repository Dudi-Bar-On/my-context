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
import type { Item } from '../../src/core/types.ts';

const CORPUS_SIZE = 500;
const WARMUP = 3;
const ITERATIONS = 20;
const CEILING_MS = 500;

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

  rmSync(cwd, { recursive: true, force: true });
});
