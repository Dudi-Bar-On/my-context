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
 * Recorded baseline (2026-08-22, dev machine): p95 3.2, 4.5, 4.5 and 5.3 ms
 * across four runs (min 2.0, median 2.3-2.7), against the 50 ms ceiling.
 * Re-derive before reading any single number as a regression signal.
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

/** Captured ids, matching the corpus size the sibling perf files use. */
const CAPTURED = 500;
/** Well past a real compaction summary; see the header for why. */
const SUMMARY_BYTES = 64 * 1024;
const WARMUP = 3;
const ITERATIONS = 20;
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

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
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

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `post-compact p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});
