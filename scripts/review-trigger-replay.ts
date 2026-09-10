#!/usr/bin/env node
/**
 * **What the review trigger would actually have done, replayed over a real
 * transcript** — `plan:loop seq:2`.
 *
 *     node scripts/review-trigger-replay.ts <transcript.jsonl> [everyN] [maxFires]
 *
 * ── WHY THIS EXISTS RATHER THAN A PARAGRAPH ────────────────────────────────
 *
 * Design §2 sets `everyNToolCalls: 15` and `maxFiresPerSession: 3` and says
 * the rubric is what keeps a fixed counter from firing mid-derivation. Those
 * are three numbers nobody had run against a session. This runs them, and it
 * is the thing to re-run when one of them changes — a measurement that lives
 * only in a comment is one that stops being true without anybody noticing.
 *
 * **It counts tool calls from the transcript, not from the audit log**, and
 * the difference matters: `plan:loop seq:1` established that an audit record
 * is one DELIVERY and not one session, and the audit log's `post-tool-use` op
 * is written only when a nudge actually fired (146 rows against 5,604
 * `agent-step` rows, measured 2026-09-10). The transcript's `tool_use` content
 * blocks are the only complete count of what the parent session actually did.
 *
 * ── THE FLOOR, RESTATED BECAUSE IT APPLIES HERE TOO ────────────────────────
 *
 * A replay over a finished transcript sees the file as it ended. The live
 * trigger sees it as it grows, and a `PreCompact` firing has no counterpart
 * here at all. So the "considerations" column is what the interval alone would
 * have produced; the real trigger fires at least that often, because
 * compaction waives the interval.
 */
import { readFileSync } from 'node:fs';
import { iterateTranscript } from '../src/core/conversation-index.ts';
import { summariseTranscript } from '../src/core/session-summary.ts';
import { worthAPass } from '../src/review/rubric.ts';

const file = process.argv[2];
if (file === undefined) {
  process.stderr.write('usage: review-trigger-replay.ts <transcript.jsonl> [everyN] [maxFires]\n');
  process.exit(2);
}
const everyN = Number(process.argv[3] ?? 15);
const maxFires = Number(process.argv[4] ?? 3);

/** Every `tool_use` block in a record's content, which is the real tool count. */
function toolCalls(record: Record<string, unknown>): number {
  const message = record['message'];
  if (typeof message !== 'object' || message === null) return 0;
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const block of content) {
    if (typeof block === 'object' && block !== null
      && (block as { type?: unknown }).type === 'tool_use') n += 1;
  }
  return n;
}

const bytes = readFileSync(file).length;
const readStarted = Date.now();

// One walk for the tool calls, through the SHARED iterator, and one read for
// the points, through the reader. Two passes over one file rather than two
// scanners over it — the distinction `session-summary.ts` argues at length.
const considerations: number[] = [];
let calls = 0;
let sinceLast = 0;
let records = 0;
for (const step of iterateTranscript(file)) {
  records += 1;
  if (step.record === null) continue;
  const n = toolCalls(step.record);
  calls += n;
  sinceLast += n;
  if (sinceLast >= everyN) {
    considerations.push(step.index);
    sinceLast = 0;
  }
}

const summary = summariseTranscript(file, { maxPoints: 100_000 });
const readMs = Date.now() - readStarted;

let from = -1;
let fired = 0;
let declined = 0;
let firedWithinRation = 0;
const reasons = new Map<string, number>();
for (const at of considerations) {
  const stretch = summary.points
    .filter((point) => point.recordIndex > from && point.recordIndex <= at)
    .sort((a, b) => a.recordIndex - b.recordIndex)
    .map((point) => ({ category: point.category, who: point.speaker }));
  const verdict = worthAPass(stretch);
  if (verdict.fire) {
    fired += 1;
    if (firedWithinRation < maxFires) firedWithinRation += 1;
  } else {
    declined += 1;
    const head = verdict.because.split(' — ')[0] ?? verdict.because;
    // The leading count varies per stretch; the SHAPE of the refusal is what a
    // reader wants a histogram of.
    const shape = head.replace(/\d[\d,]*/g, 'N');
    reasons.set(shape, (reasons.get(shape) ?? 0) + 1);
  }
  from = at;
}

const out = process.stdout;
out.write(`transcript      ${file}\n`);
out.write(`bytes           ${bytes}\n`);
out.write(`records         ${records}\n`);
out.write(`tool calls      ${calls}\n`);
out.write(`points admitted ${summary.points.length}\n`);
out.write(`read            ${readMs}ms\n`);
out.write(`\npolicy at everyNToolCalls=${everyN}, maxFiresPerSession=${maxFires}\n`);
out.write(`  considerations   ${considerations.length}\n`);
out.write(`  rubric fires     ${fired}\n`);
out.write(`  rubric declines  ${declined}\n`);
out.write(`  passes that run  ${firedWithinRation}   (the ration is what bounds this)\n`);
if (reasons.size > 0) {
  out.write('\nwhy the rubric declined\n');
  for (const [shape, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
    out.write(`  ${String(n).padStart(4)}  ${shape}\n`);
  }
}
