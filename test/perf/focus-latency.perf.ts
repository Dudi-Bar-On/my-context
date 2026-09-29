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
 *
 * ── Trustworthiness of the JIT-with-focus ceiling, established 2026-09-22 ───
 *
 * CI run 35725630027 attempt 1 (ubuntu-latest, commit 4c19d8f5) failed 'the
 * JIT hook stays under the 50ms p95 ceiling with a focus set' at p95 74.1ms
 * against the 50ms ceiling; attempt 2 on the identical commit passed. The
 * sibling hit-path test in `jit-latency.perf.ts` (same corpus size, same
 * `runPreToolUse` call, no focus set) passed on both attempts. Per the
 * owner's standing rule — a ceiling is never widened without the owner's
 * word — `TASK-a-perf-ceiling-on-the-jit-hook-fails-on-the-hosted-ubuntu`
 * asks the measurement to be made trustworthy before the ceiling is judged,
 * not for the ceiling itself to move. What was checked here, rather than
 * assumed:
 *
 *   - **Warm-up.** `measure()` below discards `WARMUP` (20) calls before
 *     sampling, and those 20 calls run the IDENTICAL closure the 200 measured
 *     calls run — same corpus, same target path, same focus already set. So
 *     anything a first call pays once — module init, the `globToRegExp`
 *     pattern cache in `core/paths.ts` (compiled once per pattern text, then
 *     reused), cold file-cache reads — is paid during warm-up and absent from
 *     the sampled window.
 *   - **One-time work in the focus-set path.** `setFocus` runs ONCE, before
 *     `measure()` is called at all, not inside the timed closure. Inside the
 *     closure, `runPreToolUse` → `readFocus` does one small `readFileSync`
 *     per call (separately pinned under 1ms by the test above), then
 *     `matchesFocus`/`focusHides` and `danglingEdges` (`core/select.ts`,
 *     `core/focus.ts`) run over `eligibleAll` — bounded by `SCOPED_ITEMS`
 *     (40), the same set the hit-path test filters to, never the 5,000-item
 *     corpus. None of that is one-time setup that leaked into the sampled
 *     window: it is exactly the work a real PreToolUse call repeats on every
 *     invocation while a focus is active, so it stays IN the measured loop —
 *     moving it to warm-up would hide a cost a user with a focus set actually
 *     pays on every hook call.
 *   - **Sensitivity to a single hiccup.** The p95 here is still computed the
 *     way `jit-latency.perf.ts` computes its own — `floor(n * 0.95)` over 200
 *     sorted samples, the 190th-ranked sample with ten samples above it, not
 *     a maximum-in-disguise the way a 20-sample p95 would be.
 *     `TASK-five-perf-files-index-the-percentile-one-rank-high-and-their`
 *     (`hooks/12q`) already names this file as one of five whose index is one
 *     rank high against nearest-rank, with baselines that need re-deriving
 *     together on a quiet machine — a separate, broader task, deliberately
 *     NOT done here. What this item DOES add: the assertion below now prints
 *     min/median/max alongside the p95, the way `session-start-latency.perf.ts`
 *     already does, so a future red states its own shape instead of one
 *     number with no context.
 *
 * The Ubuntu log for the failing attempt (CI run 35725630027, job 4) supports
 * reading the 74.1ms result as contention rather than a code regression,
 * though this file draws no conclusion from that — the three-consecutive-run
 * check this item's closing condition asks for is the CONTROLLER's to run.
 * In that SAME job, minutes later, every other perf test that prints a
 * distribution showed a fat tail against its own median: `post-compact` p95
 * 1.4ms but max 155.8ms against a 0.7ms median; `session-start` p95 129.8ms,
 * max 278.5ms against a 26.7ms median; `subagent-start` p95 355.0ms, max
 * 562.5ms against an 82.2ms median, its own arrival-order slope climbing from
 * 55.3ms to 112.0ms across the run. That is the shape `test/helpers/perf.ts`
 * and `session-start-latency.perf.ts` both call "every statistic up together
 * → the machine, re-run" — and it is the shape this job shows everywhere it
 * printed enough to tell, this test included.
 */
// @basis TASK-a-perf-ceiling-on-the-jit-hook-fails-on-the-hosted-ubuntu
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
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

interface Distribution {
  readonly n: number;
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

/**
 * The whole shape, not just the number the ceiling below asserts — `min` and
 * `median` are what tell a future reader "this is the machine" from "this is
 * the code" (see this file's header, and `session-start-latency.perf.ts`,
 * which this mirrors). `p95` keeps this file's own `floor(n * 0.95)` index
 * rather than switching to `test/helpers/perf-stats.ts`'s nearest-rank form:
 * that switch, and re-deriving the baseline it would move, is
 * `TASK-five-perf-files-index-the-percentile-one-rank-high-and-their`
 * (`hooks/12q`), a separate task this item deliberately leaves alone.
 */
function distribution(samples: number[]): Distribution {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length * 0.5)],
    p95: p95(samples),
    max: sorted[sorted.length - 1],
  };
}

/** One line carrying the whole shape, for both the console log and a failure message. */
function report(label: string, d: Distribution): string {
  return (
    `${label} p95 ${d.p95.toFixed(1)}ms over ${d.n} samples ` +
    `(min ${d.min.toFixed(1)}, median ${d.median.toFixed(1)}, max ${d.max.toFixed(1)}ms)`
  );
}

function measure(fn: (i: number) => void): Distribution {
  for (let i = 0; i < WARMUP; i++) fn(-1 - i);
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    fn(i);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return distribution(samples);
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

    console.log(
      `focus read p95: no focus ${absent.p95.toFixed(3)}ms, focus set ${present.p95.toFixed(3)}ms`,
    );
    assert.ok(
      absent.p95 < READ_CEILING_MS && present.p95 < READ_CEILING_MS,
      `the focus read is ${absent.p95.toFixed(3)}ms / ${present.p95.toFixed(3)}ms p95 against a ` +
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
    // Printed with the same shape `session-start-latency.perf.ts` uses, so a
    // future red (see this file's header for run 35725630027's 74.1ms) states
    // its own diagnosis: every statistic up together points at the runner,
    // only the median moving points at the code.
    const line = `${report('JIT hit-path (focus set)', measured)} against a ${CEILING_MS}ms ceiling`;
    console.log(line);
    assert.ok(measured.p95 < CEILING_MS, line);
  } finally {
    removeTree(cwd);
  }
});
