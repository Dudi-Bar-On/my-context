/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * **What this file is for.** `SessionEnd` is the only hook in this project
 * whose bound my_context cannot set. The shutdown path awaits the whole
 * SessionEnd batch under `AbortSignal.timeout(getSessionEndHookTimeoutMs())`,
 * and that resolver reads the `timeout` of SessionEnd entries in *settings*
 * hooks and main-thread agent hooks only — never the plugin registry this
 * manifest lands in — then floors the result at a **1,500 ms** constant. Read
 * on build 2.1.239. So `hooks/hooks.json`'s `"timeout": 2` cannot extend
 * anything on the ordinary path: 1.5 s is the wall, and a cold `node` start is
 * inside it. That is the reason this file exists, and the reason
 * `src/hooks/session-end.ts` imports `core/window-state.ts` rather than
 * `core/inject.ts`.
 *
 * **The ceiling is 250 ms, and it is deliberately loose — the tight number is
 * the recorded baseline below, not the assertion.** This event parses no
 * corpus, runs no selection and renders nothing; measured, it costs 10.7-12.9
 * ms p95. A ceiling anywhere near that would not be bounding this project's
 * work: the dominant term is `rmSync` over the window's files on NTFS, and a
 * single delete stalling behind an antivirus or an indexer is a documented
 * property of this platform (`core/ledger.ts` · `SNAPSHOT_RENAME_ATTEMPTS` · ~729
 * exists for the same class of stall on rename). A 50 ms ceiling was tried
 * first and went red at 134 and 140 ms on a loaded box with the median
 * unchanged at ~10 ms — one stalled iteration out of twenty, in the code's
 * cheapest path.
 *
 * So 250 ms certifies what `perfCeiling`'s own doc says a widened ceiling
 * certifies (`test/helpers/perf.ts` · `it certifies the absence of order-of-magnitude regressions` · ~42):
 * no accidental corpus parse, no per-call process spawn, no lock stall — all of
 * which land far above it — while absorbing filesystem noise that is not this
 * project's to fix. It is also ~6× the worst single-iteration stall observed
 * and still an order of magnitude inside the platform's own 1,500 ms wall.
 * (Both of those stalls were measured under the max-of-20 statistic this file
 * used to assert; read the section below before treating either as the reason
 * the ceiling is where it is.)
 *
 * ── The statistic, and why it is a percentile rather than a maximum ──────
 *
 * Until 2026-08-30 the assertion below called itself a p95 and computed a
 * MAXIMUM. `Math.floor(20 * 0.95)` is 19, the last index of a 20-sample
 * sorted array, and `ITERATIONS` was exactly 20 — so the reported p95 WAS the
 * maximum, in this file and in three siblings that carried the same four-line
 * helper. That is why one stalled delete reddened the run.
 *
 * Resolved by making the statistic match its name, NOT by renaming the
 * ceiling to "max" and not by widening it. The argument is in
 * `test/helpers/perf-stats.ts`, which this file now shares; `ITERATIONS` is
 * 100 because a p95 needs samples above it — at 20 there is one, at 100 there
 * are five.
 *
 * **This changes what the 250 ms ceiling is defending against, and the number
 * is deliberately left alone anyway.** The paragraph above sized 250 ms to
 * absorb ONE stalled `rmSync` out of twenty, because one was all it took. A
 * p95-of-100 absorbs the worst five samples by construction, so a single
 * stall no longer decides the verdict and that argument no longer has to
 * carry the ceiling on its own. It does not follow that the ceiling can now
 * be tightened towards the ~12 ms median: the stalls this platform produces
 * are not rare enough to sit above a p95 reliably — they were observed at
 * 134 and 140 ms against a ~10 ms median, i.e. one or two per twenty, which
 * is 5–10% of calls and lands ON the 95th percentile rather than above it.
 * So the ceiling still has to clear a stall; what changed is that it now
 * clears one instead of being set by one. Re-deriving it downwards needs a
 * measured stall RATE on an idle machine, which nobody has taken.
 *
 * **It measures the IN-PROCESS function, and the platform's wall covers more
 * than that.** `buildSessionEndOutcome` is called directly; the cold `node`
 * start that type-strips this file's (much smaller) import graph and the stdin
 * read before it are both inside the platform's 1,500 ms and outside every
 * number below. Nothing here may be read as a claim about the end-to-end hook.
 *
 * **So the end-to-end number is recorded here rather than left to look
 * unknown, and it is recorded as UNASSERTED**, exactly as
 * `subagent-start-latency.perf.ts` records its own. `node <binary>` with a real
 * payload on stdin, against the same 500-file `state/` this file builds, eight
 * consecutive runs each, all four measured back to back in one session so the
 * comparison is same-machine rather than same-adjective:
 *
 *     SessionEnd reason=clear     102, 117, 120, 121, 125, 128, 130, 135 ms
 *     SessionEnd reason=other     115, 116, 127, 129, 137, 140, 141, 150 ms
 *     SubagentStart               147, 150, 152, 153, 158, 168, 169, 181 ms
 *     PreCompact                  125, 127, 136, 137, 140, 140, 141, 150 ms
 *
 * Every `clear` run left the window's 26 files gone and one `session-end` row
 * behind, and wrote nothing to either stream. So the whole of this hook is
 * **roughly 110 ms of cold `node` start and type-stripping plus the ~10 ms
 * below** — inside the platform's 1,500 ms by a factor of twelve, and the
 * cheapest binary in the manifest, which is what importing
 * `core/window-state.ts` instead of `core/inject.ts` was for.
 *
 * **`reason=other` is the row to read twice.** It is the platform's DEFAULT
 * reason, so it fires on every ordinary exit, and it is the price this
 * registration charges every user of the plugin whether or not they ever type
 * `/clear`. In-process that path is 0.1-0.3 ms — it decides on the `reason` and
 * touches no file — so the ~130 ms is the `node` start and nothing else. There
 * is no way to make it cheaper without a matcher, and a matcher is what
 * `test/hooks/session-end-matcher.test.ts` explains this registration will not
 * have.
 *
 * Nothing in this repository asserts any of those figures: measuring them in a
 * test would time a `node` start on whatever machine ran it, which is the flake
 * this suite's own helpers exist to avoid. They are measurements, taken once,
 * written down. The 338-413 ms `subagent-start-latency.perf.ts` records for its
 * own binary was taken on a machine running several worktrees' suites at once;
 * the 147-181 ms above is the same binary by the same method on a quieter one,
 * and both are in this file's sense correct.
 *
 * **The `state/` directory is 500 files, and that is the number that matters
 * here.** `clearSeen` lists `state/` once to find the `session::agent`
 * siblings, so this hook's cost scales with how many sessions the workspace has
 * accumulated since the last sweep — not with the corpus, which it never reads.
 * `session-start.ts`'s own survey measured 15 files one day and 47 the next on
 * a real project, and `SNAPSHOT_MAX_AGE_MS` lets them stand for 30 days, so 500
 * is a deliberate over-estimate of a busy workspace rather than a typical one.
 * A corpus is not built at all: adding 500 items would time a parse this event
 * never performs.
 *
 * **Where the ~10 ms goes, decomposed rather than attributed.** Measured
 * separately at this fixture's size: the `readdirSync(state/)` over 527 entries
 * is **1.0 ms** — it is not the cost, and widening `state/` does not move it
 * much. Removing the 26 files is **12-21 ms** on NTFS, i.e. essentially all of
 * it, and it scales with the siblings a window owns rather than with the
 * directory. The audit append adds **3-4 ms**. The same fixture with the
 * siblings dropped to zero gives a whole-hook p95 of 5.8 ms, which is the same
 * statement from the other side.
 *
 * **A fresh window per iteration, and all of them built BEFORE the timing
 * loop.** A window that has already been cleared clears nothing on the second
 * call — fast, and asserting nothing, the same trap the compact case in
 * `session-start-latency.perf.ts` documents. But creating those 26 files
 * immediately before timing their removal is the opposite mistake, and a
 * bigger one: the first draft did exactly that and measured **176.5 ms**, which
 * is a number about NTFS write-back rather than about this hook. Recorded
 * because it is invisible — both versions are green against a generous ceiling
 * and only one of them is measuring the hook.
 *
 * **What the longer loop costs, measured rather than assumed.** Raising
 * `ITERATIONS` to 100 is not free of fixture effects here, unlike in the two
 * sibling files, because every iteration consumes a window of its own: the
 * setup builds 2,600 seen files instead of 520, and `state/` SHRINKS by 26
 * entries per timed call. `clearSeen` lists that directory once per call, so
 * the early samples carry a bigger `readdirSync` term than the late ones — a
 * slope inside the run that no single statistic shows. The test therefore
 * prints the first-quarter and last-quarter medians beside the distribution.
 * Read a widening gap as this fixture emptying itself, not as a regression.
 * The bias runs the safe way: the inflated samples are the early ones, so the
 * slope can only push the p95 UP, never hide a real one. See the recorded
 * figures below for the size of it.
 *
 * ── Recorded baselines ──────────────────────────────────────────────────
 *
 * 2026-08-22, dev machine, MAX-OF-20 — relabelled rather than deleted, because
 * it remains the best record of how this shape's worst case moved and it is
 * NOT comparable with a p95: 12.9, 12.3 and 10.7 ms across three runs (min
 * 6.1, median 7.6-9.8, max 12.9), against what was then a 50 ms ceiling.
 * Note that the "p95" and the "max" columns of that record are the same
 * number — 12.9 and 12.9 — which is the defect stated as a measurement.
 *
 * ── The machine these were taken on, because a measurement taken under
 * unknown load is not a measurement ─────────────────────────────────────
 *
 * 2026-08-30, dev machine, 20 logical cores, 64 GB. DELIBERATELY NOT IDLE and
 * not idlable: six other agents were working this tree throughout, and the
 * box moved between 16 and 65 resident `node` processes and between 45% and a
 * pinned 100% CPU across the session. `Everything` (a filesystem indexer) and
 * `MsMpEng` (Defender) were the two largest cumulative CPU consumers on the
 * box — which is the antivirus-and-indexer class this file's header already
 * names as the source of the `rmSync` stalls it has to absorb. Every figure
 * below carries the CPU reading taken in the minute before its run.
 *
 * First p95-of-100 figures, SEVEN RUNS, ALL GREEN (all in ms, n=100 each):
 *
 *     CPU  node   p95     min   median   max     first-25 → last-25 median
 *      45    16   13.0    7.6    9.1     14.4    9.6 →  8.5
 *      66    21   17.8    9.5   14.9     18.8   15.5 → 13.4
 *      66    21   16.7    6.8   11.4    258.2   11.9 → 10.5
 *      66    21   13.8    7.1    9.7     16.9   10.6 →  8.5
 *      80    22   31.2   14.8   20.7     34.6   21.1 → 20.9
 *      87    24  132.8   16.3   23.5    237.4   24.3 → 72.7
 *     100    41  153.9   16.4   47.1    313.8   45.8 → 45.5
 *
 * So: **p95 13.0–31.2 ms against the 250 ms ceiling** in the five runs where
 * the load held still, 132.8 ms in the one where it rose under the loop, and
 * 153.9 ms on a box pinned at 100% CPU with 41 resident `node` processes —
 * the load level at which the sibling files' ceilings could not be certified
 * at all. The sixth row's slope is RISING, which is the machine arriving
 * mid-run, not the fixture, whose slope falls. Medians 9.1–47.1 ms against
 * the 2026-08-22 record's 7.6-9.8 ms — that record does not state what the
 * machine was doing, so call this 1.2–5× and treat it as a floor on the
 * inflation rather than a measurement of it. The ceiling holds with 1.6–19×
 * of margin, on every run, including the ones where the box was saturated.
 *
 * **This is the only one of the three ceilings this session could certify on
 * a saturated box**, and the reason is the ceiling's own looseness: 250 ms
 * over a ~10 ms hook was sized to absorb an NTFS stall, and it turns out to
 * absorb a 100%-CPU machine as well. That is a fact about the margin, not a
 * licence to read a green run here as evidence about the siblings.
 *
 * **What the change bought, visible in this very table.** Three rows carry a
 * worst sample at or over the ceiling: 258.2 ms, 313.8 ms and 237.4 ms, on
 * runs whose MEDIANS were 11.4, 47.1 and 23.5 ms. The old max-of-20 would
 * have failed the build on two of them and come within 5% on the third. That
 * is one stalled `rmSync` out of a hundred deciding a verdict, which is
 * exactly what this file's header said the 250 ms ceiling had to be loose
 * enough to absorb. It no longer has to.
 *
 * **And the fixture slope, measured rather than assumed** — the one thing
 * raising the count risked here. In the six runs where load held still the
 * first quarter's median runs 0.2–2.1 ms ABOVE the last quarter's, which is
 * the shrinking `state/` directory and nothing else: ~10–15% of a ~10 ms
 * hook, biased toward the early samples, i.e. it can only push the p95 UP.
 * The longer loop measures what the short one did. Small enough to record and
 * ignore; large enough that it should be printed rather than inferred.
 *
 * Re-derive on an idle machine before reading any single number as a
 * regression signal, and record it beside these rather than over them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { snapshotPath, writeSnapshot } from '../../src/core/ledger.ts';
import { appendSeen, seenFilePath } from '../../src/core/seen-file.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildSessionEndOutcome } from '../../src/hooks/session-end.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';
import { PERF_SAMPLES, report, slope, summarize } from '../helpers/perf-stats.ts';

/** Bystander sessions whose files `clearSeen` has to walk past on every call. */
const BYSTANDERS = 500;
/** Subagent siblings the cleared window owns, matching the subagent perf file's 25. */
const SIBLINGS = 25;
const WARMUP = 3;
/**
 * The sample count is part of the assertion's MEANING, not a tuning knob — see
 * "The statistic" in the header and `test/helpers/perf-stats.ts`. It was 20,
 * at which count the reported p95 IS the maximum.
 *
 * It is also the one thing raising the count changes about the FIXTURE here,
 * because every iteration consumes a window of its own: 100 iterations means
 * 2,600 seen files built before the loop instead of 520, and `state/` shrinks
 * by 26 entries per call as the loop runs. `clearSeen` lists that directory
 * once per call, so the early samples carry a larger `readdirSync` term than
 * the late ones. Measured rather than assumed — see "What the longer loop
 * costs" in the header.
 */
const ITERATIONS = PERF_SAMPLES;
// Loose on purpose — see the header. The measured p95 is 10.7-12.9 ms; what
// this bounds is the order of magnitude, over a path whose dominant term is
// NTFS deleting files. Widened a further 10× on the GitHub Windows runner only.
const CEILING_MS = perfCeiling(250);
/** Any stamp: nothing here reads it back, and a fixed one keeps the fixture deterministic. */
const SEEN_AT = '2026-08-22T07:06:33.112Z';

/** One used window: a parent seen file, its subagent siblings, and a snapshot. */
function usedWindow(root: string, sessionId: string): void {
  appendSeen(root, sessionId, [{ id: 'CONST-0', tier: 'pinned', at: SEEN_AT }]);
  for (let i = 0; i < SIBLINGS; i++) {
    appendSeen(root, `${sessionId}::agent-${i}`, [{ id: 'CONST-0', tier: 'pinned', at: SEEN_AT }]);
  }
  writeSnapshot(root, sessionId, ['CONST-0']);
}

function payload(cwd: string, sessionId: string) {
  return { hook_event_name: 'SessionEnd', session_id: sessionId, cwd, reason: 'clear' };
}

test('SessionEnd stays under the 250ms p95 ceiling with 500 files in state/', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-session-end-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;

  // The bystanders: sessions this clear must walk past and must not touch.
  for (let i = 0; i < BYSTANDERS; i++) {
    appendSeen(root, `bystander-${i}`, [{ id: 'CONST-0', tier: 'pinned', at: SEEN_AT }]);
  }

  for (let i = 0; i < WARMUP; i++) {
    usedWindow(root, `warmup-${i}`);
    buildSessionEndOutcome(payload(cwd, `warmup-${i}`), cwd);
  }

  // The premise, because a clear that found nothing is fast and proves
  // nothing: this fixture really does give every iteration something to lose.
  usedWindow(root, 'premise');
  assert.equal(existsSync(seenFilePath(root, 'premise::agent-0')), true, 'no sibling to clear');
  assert.equal(existsSync(snapshotPath(root, 'premise')), true, 'no snapshot to clear');
  const premise = buildSessionEndOutcome(payload(cwd, 'premise'), cwd);
  assert.equal(premise.action, 'cleared');
  assert.match(premise.note, /cleared 26 seen file\(s\)/, 'the clear did not remove the siblings');

  // Every window is built BEFORE the loop, not one per iteration — see the
  // header: creating 26 files immediately before timing their removal measured
  // 176.5 ms of NTFS write-back and nothing about this hook.
  for (let i = 0; i < ITERATIONS; i++) usedWindow(root, `run-${i}`);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    buildSessionEndOutcome(payload(cwd, `run-${i}`), cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  // The bystanders are still there — a clear whose cost fell because it stopped
  // finding the siblings, or rose because it started deleting other sessions,
  // would both show up here rather than in the timing.
  assert.equal(
    existsSync(seenFilePath(root, `bystander-${BYSTANDERS - 1}`)), true,
    'the clear reached a session it does not name',
  );

  const measured = summarize(samples);
  console.log(report('session-end', measured, CEILING_MS));
  console.log(slope('session-end', samples));
  assert.ok(measured.p95 < CEILING_MS, report('session-end', measured, CEILING_MS));

  removeTree(cwd);
});
