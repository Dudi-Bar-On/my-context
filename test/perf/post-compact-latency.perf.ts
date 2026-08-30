/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * **What this file is for.** `PostCompact` BLOCKS the compaction it fires for:
 * the emitter is awaited inside the compaction flow and its output is folded
 * into the message the user sees when the window comes back, so every
 * millisecond here is a millisecond between "compacting" and the conversation
 * resuming. Unlike `SessionEnd` this event honours the `timeout` the manifest
 * declares — the emitter passes the compaction's own abort signal and no timer
 * of its own — so `hooks/hooks.json`'s `"timeout": 5` really is the bound. A
 * bound is worth nothing as an assertion; it is worth something only if the
 * work it bounds is measured, which is what this file does.
 *
 * **The ceiling is 50 ms, which is the JIT tier's budget**
 * (`test/perf/jit-latency.perf.ts` · `const CEILING_MS = perfCeiling(50);` · ~70).
 * This event parses no corpus, opens no database, walks no transcript and
 * writes no snapshot: it reads one snapshot file, scans one string, reads one
 * seen file and appends one audit row. Nothing about it belongs in
 * `SessionStart`'s 500 ms family, and — unlike `session-end-latency.perf.ts`,
 * which had to be widened to 250 ms because its dominant term is `rmSync` on
 * NTFS — nothing here deletes anything, so the one filesystem write is a single
 * append.
 *
 * **It measures the IN-PROCESS function, and the registered timeout covers
 * more.** `recordPostCompact` is called directly here; the cold `node` start
 * and the stdin read before it are both inside the 5 s the manifest declares
 * and outside every number below.
 *
 * **So the end-to-end number is recorded here rather than left to look
 * unknown, and it is recorded as UNASSERTED**, exactly as
 * `subagent-start-latency.perf.ts` and `session-end-latency.perf.ts` record
 * theirs. `node <binary>` with a real payload on stdin — 500 captured ids, all
 * 500 marked restored, a 64 KB summary — eight consecutive runs:
 *
 *     103, 104, 104, 106, 112, 112, 112, 116 ms
 *
 * each writing one row reading
 * `trigger=auto; summary 65549 chars; snapshot 500 id(s), 500 re-delivered by
 * the restore tier, 500 still named in the summary`, and nothing on either
 * stream. So this hook is ~100 ms of cold `node` start plus the ~4 ms below,
 * **an order of magnitude and a half inside its registered 5,000 ms.** Nothing
 * in this repository asserts that figure: measuring it in a test would time a
 * `node` start on whatever machine ran it, which is the flake this suite's own
 * helpers exist to avoid.
 *
 * **THE SUMMARY IS THE ONLY INPUT THAT COULD HAVE SCALED BADLY, AND IT DOES
 * NOT.** `compact_summary` is the largest field any payload in this project
 * carries and the handler runs a global regex over it. Measured at this
 * fixture's shape, varying one axis at a time: 500 ids over a 16 KB summary is
 * 5.0 ms p95, over 64 KB is 5.5 ms, over **256 KB is 6.1 ms**; 50 ids over
 * 16 KB is 5.7 ms. Four-fold and sixteen-fold increases in the scanned text
 * move the total by ~1 ms, so the scan is not this hook's cost — the audit
 * append and the two file reads are, and they are flat. Recorded because the
 * opposite was the reason to measure: a regex over a summary that grows with
 * the user's conversation is exactly the shape that turns into an O(n) stall
 * nobody notices until a long session.
 *
 * **A 64 KB summary is the fixture, and it is deliberately generous.** A
 * compaction summary is model OUTPUT, so it is bounded by a max-tokens budget
 * — a few thousand tokens, i.e. low tens of kilobytes. 64 KB is well past a
 * realistic one and 256 KB above is well past that; both are here so the
 * scaling claim is measured rather than argued.
 *
 * **All three counts are exercised, and that is load-bearing.** A fixture whose
 * `restored` markers did not carry the snapshot's own `capturedAt` measures
 * `restoredFor` returning an empty set — fast, and asserting nothing about the
 * comparison that costs. The premise below pins that the timed call really does
 * report 500/500/500, the same trap `subagent-start-latency.perf.ts` documents
 * for its deduped deliveries.
 *
 * ── The statistic, and why it is a percentile rather than a maximum ──────
 *
 * Until 2026-08-30 the assertion below called itself a p95 and computed a
 * MAXIMUM: the local helper indexed `floor(n * 0.95)`, which is the last
 * index of the sorted array for every `n <= 20`, and `ITERATIONS` was exactly
 * 20. So the "50 ms p95 ceiling" was a max-of-twenty. This is the worst place
 * in the suite to have made that mistake, because it has the tightest ceiling
 * and the cheapest call: a 50 ms bound on a 2–3 ms operation carries ~20× of
 * headroom for the CODE and none at all for one descheduled iteration, so a
 * single stall — an antivirus touch of the audit file, a GC pause — reddened
 * the build while the median never moved.
 *
 * Resolved by making the statistic match its name, NOT by renaming the
 * ceiling to "max" and not by widening it. The argument is in
 * `test/helpers/perf-stats.ts`, which this file now shares with its siblings;
 * `ITERATIONS` is 100 because a p95 needs samples above it — at 20 there is
 * one, at 100 there are five. The change costs ~0.3 s of wall clock.
 *
 * ── Recorded baselines ──────────────────────────────────────────────────
 *
 * 2026-08-22, dev machine, MAX-OF-20 — relabelled rather than deleted, because
 * it remains the best record of how this shape's worst case moved and it is
 * NOT comparable with a p95: 3.2, 4.5, 4.5 and 5.3 ms across four runs (min
 * 2.0, median 2.3-2.7), against the 50 ms ceiling.
 *
 * The `p95` figures in the summary-scaling paragraph above (5.0, 5.5, 6.1 and
 * 5.7 ms) are that same statistic under that same name and should be read as
 * maxima too. The CONCLUSION they support survives the relabelling intact: a
 * four- and a sixteen-fold increase in the scanned text moving the WORST
 * sample by ~1 ms is a stronger statement than the same about a percentile,
 * not a weaker one.
 *
 * ── The machine these were taken on, because a measurement taken under
 * unknown load is not a measurement ─────────────────────────────────────
 *
 * 2026-08-30, dev machine, 20 logical cores, 64 GB. DELIBERATELY NOT IDLE and
 * not idlable: six other agents were working this tree throughout, and the
 * box moved between 16 and 65 resident `node` processes and between 45% and a
 * pinned 100% CPU across the session. `Everything` (a filesystem indexer) and
 * `MsMpEng` (Defender) were the two largest cumulative CPU consumers on the
 * box — which is the antivirus-and-indexer class this suite's headers already
 * name as the source of single-iteration stalls. Every figure below carries
 * the CPU reading taken in the minute before its run.
 *
 * First p95-of-100 figures, fourteen runs across the day, each with the CPU
 * and the resident `node`-process count read in the minute before it (ms):
 *
 *     CPU  node   p95    min  median   max    first-25 → last-25   verdict
 *     100    62  325.7   7.5   13.6   425.8                        RED
 *     100    62   99.6   5.9    9.9   420.0                        RED
 *     100    62  153.3   7.4   13.3   372.3                        RED
 *     100    41  130.6   5.4   15.4   434.8   16.8 → 15.5          RED
 *     100    41  149.0   8.4   15.8   272.7                        RED
 *      99    34   31.0   7.7   13.2    52.0                        green
 *      93    28   17.5   6.7    9.7    25.5                        green
 *      90    26   13.3   4.7    7.1    23.8                        green
 *      87    24   12.9   5.8    7.8    16.7    7.1 → 9.8           green
 *      80    22   18.7   7.0   10.2    42.2   11.0 → 9.3           green
 *      66    21   12.2   4.6    7.8    39.4                        green
 *      66    21   14.3   5.1    7.4    23.1                        green
 *      66    21   14.5   4.2    7.0    23.5                        green
 *      66    21   11.2   4.1    6.4    18.3                        green
 *      45    16    9.0   4.5    6.4    11.6    7.3 → 6.2           green
 *
 * So: **p95 9.0–31.0 ms against the 50 ms ceiling** wherever the box was not
 * saturated, medians 6.4–13.2 ms. Read them as LOAD-INFLATED — the
 * 2026-08-22 record's median is 2.3-2.7 ms and does not state what the
 * machine was doing, so ~3× is a floor on the inflation rather than a
 * measurement of it — and read the ceiling as still holding with 1.6–5.5× of
 * margin even so.
 *
 * **The boundary is sharp and it is the box, not the code.** Every red run
 * above sat at a pinned 100% CPU with 41–62 resident `node` processes; every
 * green one sat below that. The medians move with the same axis (15.4–15.8 ms
 * red against 6.4–13.2 ms green) — every statistic up together, which is this
 * suite's recorded signature for the machine rather than the code. Those five
 * reds are NOT a regression signal and the ceiling was not touched for them.
 * On a saturated box this ceiling cannot be certified at all, by any
 * statistic; the response is to re-measure somewhere quieter.
 *
 * The fixture slope is flat in both directions wherever it was printed, which
 * is what a stationary fixture should show: nothing here is consumed by the
 * loop, so raising the count changed nothing about what is measured.
 *
 * **What the change bought, visible in this very table.** Three GREEN runs
 * carry a single sample at 52.0, 42.2 and 39.4 ms — 4–6× the run's own
 * median, and the first of them ABOVE the 50 ms ceiling. The old max-of-20
 * would have printed those as "the p95" and failed the build on at least the
 * first, on a hook whose distribution never moved.
 *
 * Re-derive on an idle machine before reading any single number as a
 * regression signal, and record it beside these rather than over them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readSnapshotMeta, writeSnapshot } from '../../src/core/ledger.ts';
import { appendSeen } from '../../src/core/seen-file.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';
import { PERF_SAMPLES, report, slope, summarize } from '../helpers/perf-stats.ts';

/** Captured ids, matching the corpus size the sibling perf files use. */
const CAPTURED = 500;
/** Well past a real compaction summary; see the header for why. */
const SUMMARY_BYTES = 64 * 1024;
const WARMUP = 3;
/**
 * The sample count is part of the assertion's MEANING, not a tuning knob — see
 * "The statistic" in the header and `test/helpers/perf-stats.ts`. It was 20,
 * at which count the reported p95 IS the maximum. One iteration here is ~4 ms,
 * so 100 of them cost well under a second: this file had the least excuse of
 * the three for sampling too thinly.
 */
const ITERATIONS = PERF_SAMPLES;
const SESSION = 'perf-post-compact';
// 50ms is the product budget for a hook that touches no corpus and deletes
// nothing; widened 10× on the GitHub Windows runner only — see
// test/helpers/perf.ts for what the widened ceiling certifies.
const CEILING_MS = perfCeiling(50);

/** A summary that really does name the captured ids, padded to size. */
function summaryText(ids: string[]): string {
  let out = '';
  let i = 0;
  while (out.length < SUMMARY_BYTES) {
    out += `The user worked through ${ids[i % ids.length]} and then moved on. `;
    i++;
  }
  return out;
}

test('PostCompact stays under the 50ms p95 ceiling over a 64KB summary', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-post-compact-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;

  const ids = Array.from({ length: CAPTURED }, (_, i) => `CONST-${i}`);
  writeSnapshot(root, SESSION, ids);
  // The marker `restoredFor` compares for EQUALITY. Read it back off the
  // snapshot rather than stamping `new Date()`: a fixture that guessed would
  // time an empty result set and prove nothing about the comparison.
  const capturedAt = readSnapshotMeta(root, SESSION)!.capturedAt;
  appendSeen(root, SESSION, ids.map((id) => ({ id, tier: 'restored' as const, at: capturedAt })));

  const input = {
    hook_event_name: 'PostCompact', session_id: SESSION, cwd,
    trigger: 'auto', compact_summary: summaryText(ids),
  };

  for (let i = 0; i < WARMUP; i++) recordPostCompact(input, cwd);

  // The premise, because a handler that counted nothing is fast and proves
  // nothing: every one of the three counts is non-trivial on this fixture.
  const premise = recordPostCompact(input, cwd);
  assert.equal(premise?.captured, CAPTURED, 'the snapshot was not read');
  assert.equal(premise?.restored, CAPTURED, 'restoredFor matched nothing — the marker is wrong');
  assert.equal(premise?.survived, CAPTURED, 'the summary scan found none of the captured ids');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    recordPostCompact(input, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = summarize(samples);
  console.log(report('post-compact', measured, CEILING_MS));
  console.log(slope('post-compact', samples));
  assert.ok(measured.p95 < CEILING_MS, report('post-compact', measured, CEILING_MS));

  removeTree(cwd);
});
