/**
 * Perf suite — not matched by `npm test`'s `test/**​/*.test.ts` glob (file
 * extension is `.perf.ts`, not `.test.ts`) and run separately via
 * `npm run test:perf`, which forces `--test-concurrency=1`.
 *
 * Why not just live in the default suite: `node --test` runs test *files*
 * concurrently by default, and the default suite has ~280 tests spread
 * across dozens of files competing for cores. A single wall-clock sample
 * taken under that load measures scheduler luck, not the code — this file
 * previously reproduced exactly that flakiness (see the plan brief). Two
 * changes make the measurement trustworthy instead: (1) many iterations
 * reduced to a p95, so one descheduled iteration can't flip the verdict,
 * and (2) forcing `--test-concurrency=1` for this file only, so the p95 is
 * measured against real CPU time rather than shared time.
 *
 * A short warm-up (discarded) precedes every measured loop: the first call
 * into a lazily-initialized module or a cold file-cache read is real cost,
 * but it is a one-time cost the running plugin only ever pays once per
 * process, not per tool call — so it would inflate the p95 with something
 * the ceiling isn't about.
 *
 * Recorded baseline (2026-08-13, dev machine, `npm run test:perf`,
 * two runs): JIT hit-path p95 ~20.7–22.7ms, miss-path p95 ~4.6ms — both
 * well inside the 50ms ceiling. If CI's p95 comes in meaningfully higher
 * than these on a clean run (not a one-off), that is a real signal, not
 * noise; a future reader should compare against these numbers, and a
 * runner-driven widening of the ceiling must record its own observed
 * numbers in the commit message rather than replacing this baseline
 * silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const CORPUS_SIZE = 5000;
const SCOPED_ITEMS = 10;
const WARMUP = 20;
const ITERATIONS = 200;
const CEILING_MS = 50;

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

/** 5,000 items, of which only a handful declare a scope — the realistic shape. */
function corpus(): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < SCOPED_ITEMS; i++) {
    items.push(item({
      id: `CONST-scoped-${i}`, type: 'constraint', scope: ['src/db/**'],
      filePath: `items/constraint/CONST-scoped-${i}.md`,
    }));
  }
  for (let i = items.length; i < CORPUS_SIZE; i++) {
    items.push(item({
      id: `LESSON-${i}`, type: 'lesson', title: `Lesson ${i}`,
      filePath: `items/lesson/LESSON-${i}.md`,
    }));
  }
  return items;
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('the JIT hook stays under the 50ms p95 ceiling on a 5000-item corpus (hit path)', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  for (const entry of corpus()) store.upsert(entry);
  assert.equal(store.ids().length, CORPUS_SIZE);
  assert.equal(store.activeScoped().length, SCOPED_ITEMS);
  store.close();

  const target = path.join(cwd, 'src', 'db', 'writer.ts');

  const call = (id: string): string => {
    const raw = JSON.stringify({
      session_id: `perf-${id}`, cwd, tool_name: 'Read', tool_input: { file_path: target },
    });
    return runPreToolUse(raw, cwd);
  };

  // Warm-up: lazy module init, cold file-cache reads — discarded, not part
  // of the steady-state figure the ceiling is meant to protect.
  for (let i = 0; i < WARMUP; i++) call(`warmup-${i}`);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const out = call(String(i));
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.match(out, /additionalContext/, `no injection on iteration ${i}`);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `JIT hit-path p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});

test('a non-matching path is just as cheap — the miss case is the common case', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-miss-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  for (const entry of corpus()) store.upsert(entry);
  store.close();

  const target = path.join(cwd, 'docs', 'readme.md');

  const call = (i: string): string => {
    const raw = JSON.stringify({
      session_id: `perf-miss-${i}`, cwd, tool_name: 'Read', tool_input: { file_path: target },
    });
    return runPreToolUse(raw, cwd);
  };

  for (let i = 0; i < WARMUP; i++) call(`warmup-${i}`);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    assert.equal(call(String(i)), '');
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(measured < CEILING_MS, `JIT miss-path p95 was ${measured.toFixed(1)}ms`);
  removeTree(cwd);
});

test('the selector itself stays well inside the hook budget on 5000 items', () => {
  const items = corpus();
  const config = resolveConfig({});

  for (let i = 0; i < WARMUP; i++) select(items, { event: 'tool', path: 'src/db/writer.ts' }, config);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const selection = select(items, { event: 'tool', path: 'src/db/writer.ts' }, config);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(selection.full.length > 0, true);
  }

  const measured = p95(samples);
  assert.ok(measured < 10, `select p95 was ${measured.toFixed(1)}ms on ${items.length} items`);
});

test('the ledger stays fast once a long session has accumulated rows', () => {
  const ledger = Ledger.open(':memory:');
  for (let i = 0; i < CORPUS_SIZE; i++) ledger.record('long-session', `LESSON-${i}`, 'jit');

  for (let i = 0; i < WARMUP; i++) ledger.seen('long-session');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const seen = ledger.seen('long-session');
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(seen.length, CORPUS_SIZE);
  }
  ledger.close();

  const measured = p95(samples);
  assert.ok(measured < 25, `ledger seen() p95 was ${measured.toFixed(1)}ms`);
});
