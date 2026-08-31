/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * **What this file is for.** `SubagentStart` BLOCKS the dispatch it fires for
 * — measured: a 3,018 ms hook delayed the subagent's first tool call until it
 * returned — and nothing in the process bounds it. The stdin timer in
 * `subagent-start.ts` bounds a pipe that never closes and nothing else, so
 * once the payload is in hand the only thing that can end this hook is Claude
 * Code killing it at the `timeout` its `hooks.json` entry declares. Task 11
 * registers it at 5 seconds. That number is worth nothing as an assertion; it
 * is worth something only if the work it bounds is measured, which is what
 * this file does.
 *
 * **The 500 ms ceiling is SessionStart's, deliberately unchanged**
 * (`test/perf/session-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~212,
 * via `test/helpers/perf.ts` · `export function perfCeiling(` · ~55), because
 * this event does the same selection over the same corpus: the pinned tier in
 * full plus the index, read from Markdown. It is not the JIT hook's 50 ms
 * per-tool-call budget — this runs once per dispatch, not once per tool call.
 *
 * **It measures the IN-PROCESS function, and the registered timeout covers
 * more than that.** `buildSubagentStartOutput` is called directly here; a cold
 * `node` start that has to type-strip the whole injection import graph, and
 * the stdin read before it, are both inside the 5 s the manifest declares and
 * outside every number below. Nothing here may be read as a claim about the
 * end-to-end hook. It bounds the part the product controls, which is the part
 * that can regress in a commit.
 *
 * **So the end-to-end number is recorded here rather than left to look
 * unknown, and it is recorded as UNASSERTED.** `node <binary>` with a real
 * payload on stdin, against this same 500-item corpus, on the same loaded
 * machine, eight consecutive runs: 338, 341, 342, 353, 357, 360, 379 and
 * 413 ms wall clock, each returning the same 8,305-byte envelope — roughly
 * 150 ms of cold start and type-stripping on top of the in-process cost below,
 * and an order of magnitude inside the registered 5,000 ms. Nothing in this
 * repository asserts that figure: measuring it in a test would time a `node`
 * start on whatever machine ran it, which is the flake this suite's own
 * helpers exist to avoid. It is a measurement, taken once, written down.
 *
 * **A fresh `agent_id` per iteration, and that is load-bearing.** The dedupe
 * key is `session_id::agent_id` (`hooks/io.ts` · `export function ledgerKey(` · ~208),
 * so a fixed agent would write one seen file on the first call and then
 * measure nineteen deduped near-empty deliveries — a number that would pass
 * while asserting nothing, the same trap the compact case in
 * `session-start-latency.perf.ts` documents. A new agent under one parent
 * session is also exactly the production shape: every dispatch is a birth,
 * with its own key and its own first seen-file append. The append is therefore
 * ON the timed path here, which is the honest shape — its worst case scales
 * with the number of delivered lines (`core/seen-file.ts` · `= 200 ms of backoff PER LINE` · ~81).
 *
 * **What this event does NOT do, so nobody reads the number as covering it:**
 * the subagent event skips the best-effort index refresh entirely
 * (`core/inject.ts` · `**THE SUBAGENT EVENT SKIPS THIS ENTIRELY**` · ~566), so
 * it opens no database and the contended-open worst case
 * (`core/store.ts` · `Worst case ~1.06s: two attempts` · ~122) is not on this
 * path at all. A held index write lock cannot slow this hook down.
 *
 * **The corpus here is 500 NORMATIVE items where the sibling file's first case
 * is 500 `lesson`s, and the difference is deliberate.** A `lesson` corpus
 * delivers nothing on this event — rationale categories are ineligible for
 * `selection.full` and absent from the index tier — so it would time a hook
 * that selected nothing, which is not the hook. This one renders 25 pinned
 * items, lists 500 normative ids in the index tier, records 525 refs in the
 * audit row and appends 25 seen lines. The assertion above the loop pins that
 * premise, because a selection that quietly went empty is fast and proves
 * nothing.
 *
 * ── The statistic, and why it is a percentile rather than a maximum ──────
 *
 * Until 2026-08-30 the assertion below called itself a p95 and computed a
 * MAXIMUM: the local helper indexed `floor(n * 0.95)`, which is the last
 * index of the sorted array for every `n <= 20`, and `ITERATIONS` was
 * exactly 20. So the "500 ms p95 ceiling" was a max-of-twenty, dominated by
 * its worst sample — one GC pause or one descheduled iteration set it, and
 * the number moved with the machine rather than with the code. That is
 * exactly the shape of the two red runs recorded below.
 *
 * Resolved by making the statistic match its name, NOT by renaming the
 * ceiling to "max" and not by widening it. The full argument — a per-dispatch
 * budget is not a promise that no single call ever exceeds it, and a
 * regression detector needs a stable statistic where a maximum gets worse the
 * harder you sample — lives in `test/helpers/perf-stats.ts`, which this file
 * now shares with its siblings. `ITERATIONS` is 100 because a p95 needs
 * samples above it: at 20 there is one, at 100 there are five.
 *
 * ── Recorded baselines ──────────────────────────────────────────────────
 *
 * Everything recorded before 2026-08-30 was a MAX-OF-20 and is kept here
 * relabelled rather than deleted. It remains the best record of how this
 * shape's worst case moved, and it is NOT comparable with a p95.
 *
 * 2026-08-21, dev machine: max-of-20 184.8, 200.9 and 243.4 ms across three
 * runs, against the unchanged 500 ms ceiling. Read these as LOAD-INFLATED:
 * the machine was running several worktrees' suites at once, and the sibling
 * file's idle-machine baseline for its own 500-item shape is 45.6–46.3 ms
 * (2026-08-16). What the loaded machine does still say, because both were
 * measured back to back in one process, is the comparison that matters here:
 * subagent-start 184.8 ms against session-start 212.4 ms on the same corpus
 * size at the same moment. This event is the CHEAPER of the two, which is
 * what skipping the index refresh predicts.
 *
 * ── 2026-08-30: THE FIRST p95-OF-100 RUNS ARE ALL RED, AND THEY ARE NOT A
 * REGRESSION SIGNAL. THIS CEILING IS NOT CERTIFIED. ─────────────────────
 *
 * The machine, because a measurement taken under unknown load is not a
 * measurement: dev machine, 20 logical cores, 64 GB, DELIBERATELY NOT IDLE
 * and not idlable — six other agents were working this tree throughout, the
 * box moved between 16 and 65 resident `node` processes and between 45% and
 * a pinned 100% CPU, and `Everything` (a filesystem indexer) and `MsMpEng`
 * (Defender) were its two largest cumulative CPU consumers. NINE runs, each
 * n=100, each carrying the CPU and resident `node`-process count read in the
 * minute before it. Every one of them RED (ms):
 *
 *     CPU  node   p95      min    median   max      first-25 → last-25
 *     100    62  5768.4   179.5  1205.9   7338.4
 *     100    62  2765.4   401.9   628.6   6501.7
 *     100    62  4601.9   214.2   729.9   7456.1
 *      77    21  6101.3   293.9   491.4  14661.0
 *      90    24  4070.2   414.7  1190.7   5987.9
 *      98    56  5019.1   183.8   535.7  10272.4
 *     100    65  2209.4   513.0   896.7   6075.5   1346.9 → 728.8
 *      77    22  1503.5   359.0   738.7   1997.5    736.0 → 597.8
 *      78    23  1258.7   385.2   780.3   1535.4    851.1 → 638.1
 *
 * Read that as the machine, on this suite's own recorded rule — every
 * statistic up together. The MEDIAN is 491–1206 ms against the 45.6–46.3 ms
 * idle baseline above: 10–26×. The MINIMUM sample, 179.5–513.0 ms, is
 * 4–11× that same baseline and in two runs already at or over the ceiling.
 * The load never fell below 21 concurrent `node` processes for the whole
 * session, and the quietest run measured (78% CPU) was still 17× the idle
 * median — so no quiet window was reachable, not merely not taken.
 * No choice of statistic rescues a measurement taken there, and the response
 * is to re-measure somewhere quieter — never to widen the ceiling to fit.
 *
 * **The control, run to settle exactly this.** `session-start-latency.perf.ts`
 * was already at n=100 and was NOT touched by the change above. Run on the
 * same box in the same window, its 500-item shape measured p95 4703.7 ms,
 * min 502.3, median 1062.4, max 6546.0 — red, on the same corpus size, with
 * no edit of any kind. So the redness here belongs to the machine and not to
 * the statistic, the sample count, or the code. The two figures also
 * reproduce this file's own standing claim, on the same box at the same
 * moment: subagent-start's median (738.7–896.7 ms) sits BELOW
 * session-start's (1062.4 ms). This event is still the cheaper of the two,
 * which is what skipping the index refresh predicts.
 *
 * The fixture slope is falling (1346.9 → 728.8 and 736.0 → 597.8), which is a
 * busy box settling, not the fixture: nothing in this loop is consumed, and
 * the same decaying head is recorded below from 2026-08-21. A decaying head
 * is precisely what the old max-of-20 reported and a p95 does not.
 *
 * **So this ceiling is honest but UNVERIFIED.** The statistic now matches its
 * name and the ceiling is unchanged at 500 ms; what is missing is a run on a
 * machine capable of certifying it. That run is owed. Until it is taken, a
 * red result from this file means nothing on its own — check the median
 * against 45.6–46.3 ms first, and check whether the SessionStart cases in the
 * same process went red with it.
 *
 * **What the loaded machine also showed, recorded so the next reader does not
 * re-diagnose it.** Across five runs on that box this case went red twice
 * (3075.8 ms, 1368.1 ms — both MAX-OF-20 verdicts, and both a single
 * first-iteration outlier decided by the defect above) and green three times — and on two of the green runs
 * the UNTOUCHED SessionStart cases in the same process went red instead
 * (569.6, 561.4 and 513.1 ms against the same 500 ms ceiling), as did
 * `fallback-latency.perf.ts` against its own hard 300 ms. Which member of the
 * 500 ms family reddens is a coin toss on a loaded machine; that they move
 * together is the signature `test/helpers/perf.ts` records for the runner
 * rather than the code. The ceiling is NOT widened for it, for the reason that
 * file gives: a bound sized to absorb a busy dev box certifies nothing. The
 * 3 s sample itself was reproduced outside the suite and is a first-iteration
 * effect on a busy box — 3087, 1305, 859, 768, … decaying inside one
 * 20-sample run, and a flat 374–396 ms across a later run of the identical
 * shape. A decaying head is precisely what a maximum reports and a percentile
 * does not, which is the other half of the case for the change above. The seen-file append's share was measured
 * the same way, by running this shape with and without a `session_id` (no id
 * means no dedupe key and no append): ~40 ms for 25 lines. Small, and on the
 * timed path deliberately.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import type { HookInput } from '../../src/hooks/io.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';
import { PERF_SAMPLES, report, slope, summarize } from '../helpers/perf-stats.ts';

const CORPUS_SIZE = 500;
/** How many of them are `always: true`, so the full tier and the seen-file append are non-empty. */
const PINNED = 25;
const WARMUP = 3;
/**
 * The sample count is part of the assertion's MEANING, not a tuning knob — see
 * "The statistic" in the header and `test/helpers/perf-stats.ts`. It was 20,
 * at which count the reported p95 IS the maximum.
 */
const ITERATIONS = PERF_SAMPLES;
/** The parent's id, shared by every dispatch below exactly as it is in production. */
const PARENT = 'perf-subagent-parent';
// 500ms is the product budget; widened 10× on the GitHub Windows runner only
// (an 819ms breach was observed there on unchanged code, run 31674652091) —
// see test/helpers/perf.ts for what the widened ceiling certifies.
const CEILING_MS = perfCeiling(500);

/**
 * `type: 'constraint'`, never `lesson`: only NORMATIVE categories pass
 * `isNormative` and become eligible for `selection.full`, so a `lesson` corpus
 * would measure a selection that could never deliver anything however it was
 * pinned. The same reason `session-start-latency.perf.ts` gives for its
 * compact case.
 */
function constraintItem(i: number): Item {
  return {
    id: `CONST-${i}`, type: 'constraint', title: `Constraint number ${i}`, status: 'active',
    severity: 'soft', always: i < PINNED, continuity: false, summary: null, summaryOf: null, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/constraint/CONST-${i}.md`,
  };
}

/** One dispatch's payload: the parent's session, a subagent of its own. */
function payload(cwd: string, agent: string): HookInput {
  return { hook_event_name: 'SubagentStart', session_id: PARENT, agent_id: agent, cwd };
}

test('SubagentStart stays under the 500ms p95 ceiling on a 500-item corpus', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-subagent-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  // Written straight to disk (not through the CLI's `add`) so corpus setup is
  // a one-time cost rather than 500 CLI invocations — the hook itself still
  // does the real work: reading and parsing every file on every call.
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, constraintItem(i));

  // Warm-up: lazy module init and cold file-cache reads are real cost but a
  // one-time one — not what the per-call ceiling is meant to protect.
  let last = '';
  for (let i = 0; i < WARMUP; i++) last = buildSubagentStartOutput(payload(cwd, `warmup-${i}`), cwd);

  // The premise, because a hook that selected nothing is fast and proves
  // nothing: this corpus really does deliver both tiers on this event.
  assert.match(last, /CONST-0/, 'the pinned tier delivered nothing, so nothing was timed');
  assert.match(last, /SubagentStart/, 'the envelope was not built, so this timed a no-op');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const input = payload(cwd, `run-${i}`);
    const started = process.hrtime.bigint();
    buildSubagentStartOutput(input, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = summarize(samples);
  console.log(report('subagent-start', measured, CEILING_MS));
  console.log(slope('subagent-start', samples));
  assert.ok(measured.p95 < CEILING_MS, report('subagent-start', measured, CEILING_MS));

  removeTree(cwd);
});
