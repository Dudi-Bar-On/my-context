/**
 * What the Markdown fallback costs when it fires — the C path of the
 * never-miss design, priced in THIS suite rather than only in the design's
 * external benchmarks. External figures for context, each with its source:
 * warm-cache loadLayer+select measured 28.1 ms p95 at 500 items and
 * 597.7 ms at 5,000 (design measurement M1, 15 iterations/size); cold-cache
 * at 10,000 items measured 9,903 ms (review probe R5) — the ceiling
 * `doctor` warns about (`checkCorpusSize`). This test runs warm (a
 * node:test process cannot honestly manufacture a cold NTFS cache), so its
 * ceiling is a WARM bound with generous CI headroom, and the recorded
 * baseline below is the number regressions are judged against.
 *
 * Recorded baseline (2026-08-16, dev machine, `node --test` on this file,
 * four runs): p95 33.9 / 36.0 / 50.2 / 97.0 ms over 50 iterations after
 * 5 warm-up calls, 500-item corpus (10 scoped constraints + 490 rationale
 * lessons, the jit-latency shape at session-start's size). The run-to-run
 * spread is real — the first run of a fresh process pays file-cache and
 * lazy-init costs the warm-up does not fully absorb — so the asserted
 * ceiling is ~3× the WORST recorded p95 (300 ms): tight enough to catch a
 * real regression in the fallback path, loose enough not to flake on a
 * shared runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildJitOutput } from '../../src/hooks/pre-tool-use.ts';
import { FALLBACK_NOTE } from '../../src/core/markdown-fallback.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const CORPUS_SIZE = 500;
const SCOPED_ITEMS = 10;
const WARMUP = 5;
const ITERATIONS = 50;
const CEILING_MS = 300;

function item(over: Partial<Item>): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'A body of roughly forty characters.', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('JIT fallback (no index) at 500 items stays far inside the 10 s kill', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-fallback-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  // The corpus lives ON DISK as Markdown — the fallback parses files, so an
  // in-store-only corpus (the jit-latency shortcut) would measure nothing.
  for (let i = 0; i < SCOPED_ITEMS; i++) {
    writeItem(ws.projectRoot!, item({
      id: `CONST-scoped-${i}`, scope: ['src/db/**'],
      filePath: `items/constraint/CONST-scoped-${i}.md`,
    }));
  }
  for (let i = SCOPED_ITEMS; i < CORPUS_SIZE; i++) {
    writeItem(ws.projectRoot!, item({
      id: `LESSON-${i}`, type: 'lesson', title: `Lesson ${i}`,
      filePath: `items/lesson/LESSON-${i}.md`,
    }));
  }

  // No index at all: the read-only open fails, so every call below takes the
  // Markdown fallback — the branch this test prices.
  rmSync(ws.dbPath, { force: true });
  rmSync(`${ws.dbPath}-wal`, { force: true });
  rmSync(`${ws.dbPath}-shm`, { force: true });
  assert.equal(existsSync(ws.dbPath), false);

  // A fresh session id per call: the seen-file dedupe would otherwise turn
  // every call after the first into a cheap miss, and the p95 would price
  // the dedupe short-circuit instead of the fallback.
  const call = (id: string): string => buildJitOutput({
    session_id: `perf-fallback-${id}`, tool_name: 'Read',
    tool_input: { file_path: path.join(cwd, 'src', 'db', 'writer.ts') }, cwd,
  }, cwd, 'src/db/writer.ts');

  for (let i = 0; i < WARMUP; i++) call(`warmup-${i}`);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const output = call(String(i));
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    // Every measured call must have actually served the injection FROM the
    // fallback — a run that quietly found an index (or injected nothing)
    // would price the wrong branch and pass anyway. (`buildJitOutput`
    // returns the raw injected text; the JSON envelope is `runPreToolUse`'s.)
    assert.match(output, /CONST-scoped-/, `no injection on iteration ${i}`);
    assert.ok(output.includes(FALLBACK_NOTE), `not fallback-served on iteration ${i}`);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `fallback p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});
