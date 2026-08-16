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
 *
 * **Re-measured when the default budgets were raised 4–8× (2026-08-16),
 * because a larger injection is more work per hook and that had to be
 * established rather than assumed.** The measurement was made away from this
 * file, on a corpus shaped to make the difference bite — 5,000 items of which
 * 40, not 10, are scoped to the target path, so the old `jit: 500` spills most
 * of them and the new `jit: 4000` admits them all. Three runs of 200
 * iterations each after 20 warm-up calls: OLD budgets p95 9.5ms / 9.9ms /
 * 14.6ms, NEW budgets p95 11.0ms / 14.5ms / 10.7ms. Those ranges overlap, so
 * no before/after difference can be claimed from these figures beyond "not
 * detectable here" — the same conclusion, and for the same reason, that the
 * canonicalization measurement below reached. Both are well inside the 50ms
 * ceiling, and the ceiling was NOT widened. The corpus this file actually
 * uses has 10 scoped items totalling ~750 estimated tokens, so it fits both
 * budgets and is unaffected either way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { injectableTypes, select } from '../../src/core/select.ts';
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
  // The hook's pre-filter is by category type, not by scope: the 4,990
  // `lesson` rows are rationale-tier and never JIT-inject, so they are what
  // keeps this off the whole corpus — not the scope predicate it used to use.
  assert.equal(store.activeInjectable(injectableTypes(resolveConfig({}))).length, SCOPED_ITEMS);
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

/**
 * The write-deny path, measured separately because it is the only branch that
 * touches the filesystem before deciding.
 *
 * The two tests above send `Read`, which never reaches `denyReason` — so
 * neither of them exercises the `realpathSync.native` canonicalization that
 * closes the 8.3 short-name / symlink spellings. A `Write` to an ordinary
 * source file is the expensive shape: the segment regex misses, so the path
 * is canonicalized (one syscall per existing ancestor), and THEN the full JIT
 * selection runs on top. A `Write` into `.my_context` is the cheap shape —
 * the regex hits on the raw spelling and returns before any syscall.
 *
 * Recorded baseline (2026-08-14, dev machine, 200 iterations after 20 warm-up
 * calls, same corpus as above). Deny-HIT p95 0.01–0.02ms — the regex matches
 * the raw spelling and returns before any syscall, so closing the short-name
 * bypass cost the deny case nothing at all. Deny-MISS p95 9.1–15.2ms across
 * five runs WITH canonicalization and 9.0–15.5ms across four runs WITHOUT it
 * (the pre-fix sources restored over the working tree and measured the same
 * way). Those ranges overlap: the canonicalization is smaller than this
 * measurement's run-to-run noise, which is dominated by the SQLite-backed
 * selection that follows it, so no before/after difference can be claimed
 * from these figures beyond "not detectable here".
 *
 * Canonicalization measured on its own, away from that noise, is 0.106ms p95
 * for a not-yet-existing path four segments deep and 0.065ms p95 for one that
 * exists — against a 50ms ceiling.
 */
test('the write-deny path stays under the 50ms p95 ceiling, canonicalization included', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-deny-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  for (const entry of corpus()) store.upsert(entry);
  store.close();

  const call = (target: string, i: string): string => runPreToolUse(JSON.stringify({
    session_id: `perf-deny-${i}`, cwd, tool_name: 'Write', tool_input: { file_path: target },
  }), cwd);

  // The miss: an ordinary file, not yet created, deep enough that the
  // ancestor walk has somewhere to walk.
  const missTarget = path.join(cwd, 'src', 'db', 'writer.ts');
  const denyTarget = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');

  for (let i = 0; i < WARMUP; i++) { call(missTarget, `w${i}`); call(denyTarget, `w${i}`); }

  const missSamples: number[] = [];
  const denySamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    let started = process.hrtime.bigint();
    const missOut = call(missTarget, String(i));
    missSamples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.doesNotMatch(missOut, /permissionDecision/, `an ordinary write was denied at ${i}`);

    started = process.hrtime.bigint();
    const denyOut = call(denyTarget, String(i));
    denySamples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.match(denyOut, /"permissionDecision":"deny"/, `the deny was lost at ${i}`);
  }

  const missP95 = p95(missSamples);
  const denyP95 = p95(denySamples);
  assert.ok(missP95 < CEILING_MS, `write deny-miss p95 was ${missP95.toFixed(1)}ms`);
  assert.ok(denyP95 < CEILING_MS, `write deny-hit p95 was ${denyP95.toFixed(1)}ms`);

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
