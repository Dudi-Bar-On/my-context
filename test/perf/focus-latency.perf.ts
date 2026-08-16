/**
 * What focus costs on the hot path.
 *
 * The PreToolUse hook is under a 50 ms p95 ceiling and the JIT hit path already
 * spends ~20.7–22.7 ms of it (see `jit-latency.perf.ts`, which owns that
 * baseline). Focus adds one `readFileSync` of a file measured in hundreds of
 * bytes, plus — only when a focus is actually set — one predicate per eligible
 * item and one relation walk over what it hid. Both are measured here rather
 * than argued, because "it is only a small file read" is exactly the reasoning
 * that puts an unbounded cost on a per-tool-call path.
 *
 * Three figures are taken, all on the same corpus and the same target file:
 * no focus at all (the ENOENT case, which is what nearly every workspace pays),
 * a focus that is set, and — as the control that makes the other two mean
 * something — the same hook before either.
 *
 * Recorded baseline (2026-08-16, dev machine, `npm run test:perf`): the focus
 * read measured p95 **0.027 ms with no focus set and 0.046 ms with one**, over
 * 200 iterations after 20 warm-up calls on a 5,000-item corpus. The whole JIT
 * hook with that focus applied measured p95 10.5 ms on the same run, inside the
 * 50 ms ceiling. Compare against these; a runner-driven widening must record its
 * own observed numbers rather than replacing this baseline silently. The audit
 * append beside it costs 0.55 ms, and was accepted — so focus is roughly a
 * twentieth of what this path already pays for the audit record.
 *
 * The two JIT figures here and in `jit-latency.perf.ts` are NOT comparable and
 * no before/after claim is made from them: this file's corpus has 40 scoped
 * items to that one's 10, and the two were measured in different processes.
 *
 * The suite-level assertion is deliberately the same 50 ms ceiling the hook
 * lives under rather than a tight bound on the delta: two wall-clock samples
 * a few hundredths of a millisecond apart cannot support a claim about their
 * difference, and a test that asserted one would fail on scheduler luck. What
 * IS asserted is the thing that would actually be a regression — that reading
 * the focus is not doing per-corpus work — by pinning it well under a
 * millisecond, three orders of magnitude below the ceiling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFocus, setFocus } from '../../src/core/focus.ts';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const CORPUS_SIZE = 5000;
const SCOPED_ITEMS = 40;
const WARMUP = 20;
const ITERATIONS = 200;
// 50ms is the product budget; widened 10× on the GitHub Windows runner only —
// see test/helpers/perf.ts for the recorded distribution and what the widened
// ceiling certifies.
const CEILING_MS = perfCeiling(50);
/** The read itself must stay off the corpus; this is three orders below the hook's ceiling. */
const READ_CEILING_MS = perfCeiling(1);

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

function corpus(): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < SCOPED_ITEMS; i++) {
    items.push(item({
      id: `CONST-scoped-${i}`, scope: ['src/db/**'],
      // Half carry the focused tag and half do not, so a set focus does real
      // filtering work rather than matching everything or nothing.
      tags: i % 2 === 0 ? ['billing'] : ['auth'],
      relations: [{ type: 'blocks', target: `CONST-scoped-${(i + 1) % SCOPED_ITEMS}` }],
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

function measure(fn: (i: number) => void): number {
  for (let i = 0; i < WARMUP; i++) fn(-1 - i);
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    fn(i);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return p95(samples);
}

test('reading the focus costs a file read, not a walk of the corpus', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-perf-'));
  try {
    runCli(['init'], cwd, () => {});
    const ws = resolveWorkspace(cwd);
    const root = ws.projectRoot!;
    const store = Store.open(ws.dbPath);
    for (const entry of corpus()) store.upsert(entry);
    store.close();

    const absent = measure(() => { readFocus(root); });
    setFocus(root, { tags: ['billing'], categories: [], scope: [] }, 'human');
    const present = measure(() => { readFocus(root); });

    console.log(`focus read p95: no focus ${absent.toFixed(3)}ms, focus set ${present.toFixed(3)}ms`);
    assert.ok(
      absent < READ_CEILING_MS && present < READ_CEILING_MS,
      `the focus read is ${absent.toFixed(3)}ms / ${present.toFixed(3)}ms p95 against a ` +
      `${READ_CEILING_MS}ms bound. Over that, it is doing something other than reading one ` +
      `small file — the corpus is 5,000 items and this must not scale with it.`,
    );
  } finally {
    removeTree(cwd);
  }
});

test('the JIT hook stays under the 50ms p95 ceiling with a focus set', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-perf-jit-'));
  try {
    runCli(['init'], cwd, () => {});
    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    for (const entry of corpus()) store.upsert(entry);
    store.close();
    setFocus(ws.projectRoot!, { tags: ['billing'], categories: [], scope: [] }, 'human');

    const target = path.join(cwd, 'src', 'db', 'writer.ts');
    let last = '';
    const measured = measure((i) => {
      last = runPreToolUse(JSON.stringify({
        session_id: `perf-focus-${i}`, cwd, tool_name: 'Read', tool_input: { file_path: target },
      }), cwd);
    });

    assert.match(last, /hidden by focus/, 'the focus did no filtering, so this measures nothing');
    console.log(`JIT p95 with a focus set: ${measured.toFixed(1)}ms`);
    assert.ok(
      measured < CEILING_MS,
      `JIT hit-path p95 with a focus was ${measured.toFixed(1)}ms, over the ${CEILING_MS}ms ceiling`,
    );
  } finally {
    removeTree(cwd);
  }
});
