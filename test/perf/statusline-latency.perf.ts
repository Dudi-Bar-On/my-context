/**
 * **The measurement `mycontext statusline` does not ship without.**
 *
 * The bridge runs on Claude Code's **per-message** path — more often than the
 * PreToolUse hook, which is held to a 50 ms p95 ceiling and has
 * `test/perf/jit-latency.perf.ts` to prove it. `2026-08-18-v2-expert-review-addendum.md`
 * §8.4 raised the cost of the tee's directory sweep as a fix to shipped code;
 * it was not one, because no `statusline` command existed yet. It is instead a
 * condition of building it, and this file is that condition.
 *
 * The two halves are measured SEPARATELY, because they grow with different
 * things and only one of them is bounded:
 *
 *  - the **tee write** grows with the number of files in `.statusline/`, which
 *    gains one per session and which nothing prunes (`sweepStaleTeeTemps`
 *    removes only leftover temp files, and says so);
 *  - the **print path** — `myctxShare`: the audit projection synced, then one
 *    aggregate over this session's injection records — grows with how many
 *    injections THIS SESSION has made.
 *
 * Recorded baseline (2026-08-23, dev machine, Windows/Node 24, 200 iterations
 * after 20 warm-up calls, `node --test --test-concurrency=1`), taken as
 * `audit-latency.perf.ts` and `focus-latency.perf.ts` take theirs rather than
 * asserted as a ratio — a ratio would pass a run in which both halves got ten
 * times slower together:
 *
 *   tee write, .statusline/ holding      1 sample    p95  4.6 ms
 *                                      200 samples   p95  4.7 ms
 *                                    1,000 samples   p95  5.9 ms
 *                                    5,000 samples   p95  9.5 ms
 *
 *   myctxShare, this session holding    10 records   p95  8.7 ms
 *                                    1,000 records   p95 16.2 ms
 *                                    5,000 records   p95 47.0 ms
 *
 *   statusLineText (the formatting)                  p95  0.004 ms
 *
 * **The conditions, because they matter to how much these figures are worth,
 * and because this file has been seen green exactly once.** They were taken on
 * a machine running fifteen other build agents against the same disk. The
 * spread over nine consecutive runs was enormous: the same single-sample tee
 * write — one `writeFileSync` of ~400 bytes, one rename, one `readdir` —
 * measured 4.6, 10.1, 15.3, 32.7, 45.5, 51.0, 52.0, 59.0, 65.2 and 143.5 ms.
 * The block above is the quietest of those runs, in which every size passed
 * its ceiling; the rest were red. The control that says this is the machine
 * rather than this code is the EXISTING `audit-latency.perf.ts`, whose own
 * recorded baseline is 0.55 ms and flat: in the same window it measured
 * 113 ms, a 200× inflation of a number that has nothing to do with the status
 * line. `statusline-tee.ts`'s own header records `writeTee` at p95 3.0 ms on an
 * idle machine, which is the right order for the top block.
 *
 * So a red here is read exactly the way `test/helpers/perf.ts` says to read a
 * red CI job: every perf test slow together means the machine, one test slow
 * alone means the code. Anyone re-measuring on a quiet machine should replace
 * the figures above rather than the ceilings.
 *
 * **What the run below found, and what changed because of it.** `myctxShare`
 * first asked `queryProjection` for the session's records and summed them in
 * JavaScript. That measured **p95 71.8 ms over 5,000 records** and grew
 * linearly, because every matching record is re-serialized by `json(rec)` and
 * parsed again in JS to read one number off it. It is now one SQL aggregate
 * returning one row — the 47.0 ms above, with the JS side no longer
 * proportional to the session's history at all. The two spellings of the
 * tokens rule that this created are pinned against each other in
 * `test/cli/statusline.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { myctxShare, occupancyFromPayload, statusLineText } from '../../src/cli/commands/statusline.ts';
import { NO_EXTRAS } from '../../src/cli/commands/statusline-powerline.ts';
import { AUDIT_PROTOCOL, auditDir, auditLogPath } from '../../src/core/audit.ts';
import { ensureLogDir } from '../../src/core/jsonl-log.ts';
import {
  classifyContext, statuslineDir, teePath, writeTee,
} from '../../src/core/statusline-tee.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const WARMUP = 20;
const ITERATIONS = 200;

/**
 * The ceiling for either half at the sizes a real workspace reaches.
 *
 * 50 ms is the JIT hook's product budget — the tightest this suite certifies
 * anywhere — and the status line is a slower cadence than that hook but pays a
 * whole Node startup around this work, so it is the right number to hold both
 * halves to. Against the baselines above it is a 5–10× margin on the tee and
 * a 3–6× margin on the share.
 */
const CEILING_MS = perfCeiling(50);

/**
 * The looser bound for a session that has made 5,000 injections.
 *
 * That is the far tail — one injection per tool call, all day, in one session
 * — and it is the one size where the tight budget is NOT certified: the
 * aggregate measured 47.0 ms there on the quietest run, which is inside 50 ms
 * by too little to assert without flaking. The number is still taken and
 * printed, because a reader deciding whether the bridge stays usable in a long
 * session wants it; what is asserted here is only that it has not returned to
 * the shape that made it 71.8 ms and rising.
 */
const TAIL_CEILING_MS = perfCeiling(120);

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

function measure(call: () => void): number {
  for (let i = 0; i < WARMUP; i++) call();
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    call();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return p95(samples);
}

/** The payload Claude Code sends, at the size it really is. */
function payload(sessionId: string): Record<string, unknown> {
  return {
    session_id: sessionId,
    cwd: 'C:/repo',
    version: '2.1.239',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: 'C:/repo', project_dir: 'C:/repo' },
    context_window: {
      total_input_tokens: 47000, total_output_tokens: 9000, context_window_size: 200000,
      current_usage: {
        input_tokens: 1000, cache_creation_input_tokens: 6000,
        cache_read_input_tokens: 40000, output_tokens: 9000,
      },
      used_percentage: 23.5, remaining_percentage: 76.5,
    },
  };
}

/**
 * A `.statusline/` directory holding `samples` real sample files, plus one
 * leftover temp file so the sweep has something to `stat` on every call — the
 * shape a workspace is actually in, and the one the addendum asked about.
 */
function teeFixture(samples: number): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-sl-perf-'));
  ensureLogDir(statuslineDir(root));
  const body = JSON.stringify({ receivedAt: '2026-08-23T00:00:00.000Z', payload: payload('x') });
  for (let i = 0; i < samples; i++) {
    writeFileSync(teePath(root, `session-${i}`) as string, body, 'utf8');
  }
  writeFileSync(path.join(statuslineDir(root), 'session-0.json.tmp-999-0'), body, 'utf8');
  return root;
}

test('the tee write stays flat in the number of samples the directory already holds', () => {
  for (const samples of [1, 200, 1000, 5000]) {
    const root = teeFixture(samples);
    try {
      const measured = measure(() => { writeTee(root, payload('perf')); });
      console.log(`  tee write, .statusline/ ${String(samples).padStart(5)} samples  ` +
        `p95 ${measured.toFixed(3)} ms`);
      assert.ok(
        measured < CEILING_MS,
        `writeTee cost ${measured.toFixed(3)}ms p95 with ${samples} samples in .statusline/, ` +
        `against a ${CEILING_MS}ms ceiling. The sweep stats only NAMES that match the ` +
        `temp-file pattern, so a sample file costs a regex and nothing else — a figure that ` +
        `grows with the count above means something started opening them.`,
      );
    } finally {
      removeTree(root);
    }
  }
});

/**
 * A log of `records` injection records, every one of them for the session
 * being asked about: the worst case for the share, since nothing is filtered
 * out before the aggregate runs.
 */
function shareFixture(records: number): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-share-perf-'));
  ensureLogDir(auditDir(root));
  const injected = Array.from({ length: 10 }, (_, i) => ({ id: `CONST-scoped-${i}`, tier: 'jit' }));
  const lines: string[] = [];
  for (let i = 0; i < records; i++) {
    lines.push(JSON.stringify({
      protocol: AUDIT_PROTOCOL, at: new Date(Date.UTC(2026, 7, 23, 0, 0, i % 60)).toISOString(),
      kind: 'injection', op: 'jit', sessionId: 'perf', hook: 'PreToolUse',
      path: 'src/db/writer.ts', injected, tokens: 1234,
    }));
  }
  writeFileSync(auditLogPath(root), `${lines.join('\n')}\n`, 'utf8');
  return root;
}

test('the print path stays affordable as the session accumulates injections', () => {
  for (const records of [10, 1000, 5000]) {
    const root = shareFixture(records);
    try {
      // The first call builds the projection from scratch; every call after it
      // does the incremental sync a real bridge process does, which is what
      // the per-message path pays. Both are inside `measure`'s warm-up.
      const measured = measure(() => { myctxShare(root, 'perf'); });
      console.log(`  myctxShare, session ${String(records).padStart(5)} records  ` +
        `p95 ${measured.toFixed(3)} ms`);
      const ceiling = records >= 5000 ? TAIL_CEILING_MS : CEILING_MS;
      assert.ok(
        measured < ceiling,
        `myctxShare cost ${measured.toFixed(3)}ms p95 over ${records} injection records for ` +
        `one session, against a ${ceiling}ms ceiling. The projection syncs incrementally and ` +
        `the share is ONE aggregate returning ONE row; a figure at this size means it went ` +
        `back to materializing every record (which measured 71.8ms p95 here) or that the ` +
        `sync stopped being incremental.`,
      );
    } finally {
      removeTree(root);
    }
  }
});

test('the formatting itself is not where the time goes', () => {
  const sample = classifyContext(payload('perf'));
  const share = { tokens: 6200, injections: 3, unrecorded: 1 };
  // The powerline replaced the pipe-delimited line on 2026-08-31, so what is
  // measured here is now segment assembly plus ANSI, at a real terminal width.
  // The band lookup it calls is a pure function over two numbers; the module
  // load that supplies it happens once, at import, and is not in this loop.
  const input = {
    ...NO_EXTRAS,
    model: 'Opus 4.5', project: 'my-context', branch: 'master',
    occupancy: occupancyFromPayload(sample), threshold: 98,
    myctx: share, myctxNote: null, teeNote: null,
  };
  const measured = measure(() => { statusLineText(input, true, 120); });
  console.log(`  statusLineText  p95 ${measured.toFixed(3)} ms`);
  assert.ok(
    measured < perfCeiling(1),
    `statusLineText cost ${measured.toFixed(3)}ms p95, which is a string join and should be ` +
    'immeasurable. Something in the formatter is doing I/O.',
  );
});
