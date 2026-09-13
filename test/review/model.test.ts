// @basis TASK-call-a-model-with-the-prompt-this-build-already-ships-and,
// CONST-zero-runtime-dependencies, INV-nothing-is-dropped-silently
//
// **What this file proves, and the one thing it cannot.**
//
// It proves that the five anti-learning rules REACH the transport, that a
// prompt which has lost one is refused before a single byte is spawned, that
// every way the call can fail is a named field rather than a silence, that a
// model proposal passes the same gates a lexical one does, and that with the
// ration at 0 the report says what WOULD have been proposed and nothing is
// written. It cannot prove that a model produces good proposals — `prompt.ts`
// says so in its own header and the plan agrees: the only real check is a week
// of reading drafts.
//
// **Nothing here spawns the real CLI.** The one test that spawns anything at
// all names a binary that is deliberately not there, because the missing-
// binary path is the one that takes a detached child down if it is wrong, and
// `src/ui/open.ts` measured that a fake which THREW would prove a control flow
// `child_process` never takes.
//
// **And the fixture must not carry the proof.** Every assertion below that
// could be satisfied by the stub rather than by the subject is written so the
// stub is the thing being read FROM, never the thing being asserted about:
// the prompt assertions read the bytes the pass handed over, and the gate
// assertions change one field of a candidate and watch the verdict move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { DRAFT_DIR } from '../../src/core/drafts.ts';
import { passReportPath, runPass, spawnPass, type PassReport } from '../../src/review/pass.ts';
import { reviewTrigger } from '../../src/review/trigger.ts';
import { bumpCounter } from '../../src/core/review-counter.ts';
import {
  ANTI_LEARNING_MARKERS, agentCliCall, cliInvocation, isUsableModelName, parseReply, rulesMissing,
  type ModelCall, type ModelCandidate, type ModelOutcome,
} from '../../src/review/model.ts';
import { reviewPrompt, ANTI_LEARNING, OUTPUT_CONTRACT } from '../../src/review/prompt.ts';
import {
  propose, MODEL_AUTHORABLE, NO_QUEUE_CEILING, proposerTag,
} from '../../src/review/propose.ts';
import type { PassInput, Point } from '../../src/review/input.ts';
import { sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/* ══ FIXTURES ══════════════════════════════════════════════════════════════ */

/** An observation naming a real path, so a proposal about it has something to cite. */
const OBSERVED =
  'The owner ruling is that the pass must never be awaited on Stop, and src/review/pass.ts ' +
  'asserts it: node scripts/check-basis.ts exits non-zero when a test names nothing, so the ' +
  'gate fails the build rather than warning.';

function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

function project(review: Record<string, unknown> | null): {
  cwd: string; root: string; transcript: string;
} {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-model-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  if (review !== null) {
    writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({ profile: 'standard', review }, null, 2) + '\n',
    );
  }
  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript, `${record(OBSERVED, '2026-09-13T01:00:00Z')}\n`, 'utf8');
  return { cwd, root, transcript };
}

/** One well-formed proposal, as a model would return it. */
function candidate(over: Partial<ModelCandidate> = {}): ModelCandidate {
  return {
    artifact: 'rule',
    target: 'src/review/pass.ts',
    title: 'the pass is never awaited on Stop',
    summary: 'Background work started while somebody is waiting must not be waited for.',
    brief: 'Observed in this session. The check is that the hook returns before the pass does.',
    evidence: [{ source: 'transcript.jsonl', recordIndex: 0 }],
    ...over,
  };
}

/** A transport that records what it was handed and replies with whatever is given. */
function transport(reply: string | ModelOutcome): { sent: string[]; call: ModelCall } {
  const sent: string[] = [];
  const call: ModelCall = (prompt, options) => {
    sent.push(prompt);
    if (typeof reply !== 'string') return Promise.resolve(reply);
    return Promise.resolve({
      ok: true as const, text: reply, ms: 1,
      command: `fake ${options.model}`, promptBytes: Buffer.byteLength(prompt, 'utf8'),
    });
  };
  return { sent, call };
}

const point: Point = {
  category: 'measurement', who: 'model', source: 'C:/t/transcript.jsonl', recordIndex: 0,
  at: null, text: OBSERVED,
};

function input(points: Point[] = [point]): PassInput {
  return {
    points, readTo: 0, sources: ['C:/t/transcript.jsonl'], whole: true, skipped: [],
    readBytes: 0, records: points.length, unreadable: 0, briefPoints: 0, ms: 0,
  };
}

/* ══ 1 — THE FIVE RULES REACH THE MODEL, PROVED PER RULE ═══════════════════ */

test('every one of the five anti-learning rules is in the bytes the pass hands over', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  const { sent, call } = transport('[]');
  try {
    await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: 'haiku', modelCall: call,
    });
    assert.equal(sent.length, 1, 'the pass called the transport exactly once');
    const delivered = sent[0] ?? '';
    // PER RULE, never per file. Five assertions, each naming the rule it is
    // about, because a loop asserting "all five present" that went green with
    // four would be a loop asserting the list's length.
    for (const { rule, probe } of ANTI_LEARNING_MARKERS) {
      assert.match(delivered, probe,
        `anti-learning rule ${rule} did not reach the model. Design §12 calls the list a scar ` +
        `record; a prompt arriving with its rules dropped is worse than no prompt.`);
    }
    assert.equal(rulesMissing(delivered).length, 0);
  } finally { removeTree(cwd); }
});

test('the report carries the count taken on the delivered bytes, not on a constant', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  const { call } = transport('[]');
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: 'haiku', modelCall: call,
    });
    assert.equal(report.model?.antiLearningRulesDelivered, 5);
    assert.deepEqual(report.model?.antiLearningRulesMissing, []);
    assert.ok((report.model?.promptBytes ?? 0) > 1000,
      'a prompt that fits in a tweet is a prompt that lost its rules');
  } finally { removeTree(cwd); }
});

test('a prompt that lost a rule is REFUSED, before anything is spawned, naming the rule', async () => {
  // The removal is performed on the SUBJECT's own output rather than on a
  // hand-written string: take the real prompt and delete rule 5, which is the
  // one §12 records as having been added upstream later, as a separate fix.
  const whole = reviewPrompt(input());
  const maimed = whole.replace(/Unresolved failures written up as if they worked/i, 'Something else');
  assert.notEqual(maimed, whole, 'the removal did not bite — the probe no longer matches the prompt');

  assert.deepEqual(rulesMissing(whole), []);
  assert.deepEqual(rulesMissing(maimed), ['5 — unresolved failures written up as if they worked']);

  const outcome = await agentCliCall('definitely-not-a-real-binary-xyz')(maimed, {
    model: 'haiku', cwd: process.cwd(), timeoutMs: 5000,
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.why ?? '', /refused before sending/);
  assert.match(outcome.why ?? '', /rule\(s\) 5 — unresolved failures/);
  assert.equal(outcome.ms, 0,
    'the refusal is BEFORE the spawn: a call that reached a process would have taken time, and ' +
    'the binary named here does not exist, so a spawn would have reported ENOENT instead');
});

/* ══ 2 — THE MECHANISM, AND EVERY WAY IT FAILS ═════════════════════════════ */

test('the prompt is never in argv — it is tens of kilobytes and a command line is readable', () => {
  const { command, args } = cliInvocation('haiku');
  assert.equal(command, 'claude');
  assert.deepEqual(args, ['--print', '--model', 'haiku', '--output-format', 'text']);
  const whole = reviewPrompt(input());
  assert.ok(!args.some((a) => a.includes(whole.slice(0, 40))),
    'the prompt reached argv. On Windows a command line is readable by every local account for ' +
    'the lifetime of the spawn, and it is capped near 32K — the prompt goes on stdin.');
});

test('a model name that is an option is refused rather than escaped', () => {
  assert.equal(isUsableModelName('haiku'), true);
  assert.equal(isUsableModelName('claude-opus-4.5'), true);
  assert.equal(isUsableModelName('--dangerously-skip-permissions'), false,
    'a name beginning with "-" is an OPTION to the program being spawned');
  assert.equal(isUsableModelName('haiku; rm -rf /'), false);
  assert.equal(isUsableModelName(''), false);
});

test('a missing binary is a NAMED failure and never an uncaught error', async () => {
  // Not a fake that throws. `spawn` does not throw for an exec failure — it
  // returns a ChildProcess with `pid === undefined` and emits 'error' on a
  // later tick, and without a listener that event takes the process down.
  // Measured in `src/ui/open.ts` on Node v24.14.0; asserted here against a
  // binary that genuinely is not on this machine.
  const whole = reviewPrompt(input());
  const outcome = await agentCliCall('definitely-not-a-real-binary-xyz')(whole, {
    model: 'haiku', cwd: process.cwd(), timeoutMs: 30_000,
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.why ?? '', /could not be started/);
  assert.doesNotMatch(outcome.why ?? '', /refused before sending/,
    'this prompt carries all five rules, so the refusal under test is the SPAWN failure');
});

test('a transport that fails leaves a report saying so — not a report saying nothing was learned', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  const failing: ModelCall = () => Promise.resolve({
    ok: false, why: 'the model CLI exited 1: quota', ms: 12, command: 'claude …', promptBytes: 9,
  });
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: 'haiku', modelCall: failing,
    });
    assert.equal(report.model?.ok, false);
    assert.match(report.model?.why ?? '', /quota/);
    assert.equal(report.model?.returned, 0);
    assert.equal(report.proposed, null,
      'no candidates and no ration, so the proposing block never opened the store');
  } finally { removeTree(cwd); }
});

test('a transport that THROWS is still a report, because a detached child has nobody to tell', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  const throwing: ModelCall = () => { throw new Error('socket hang up'); };
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: 'haiku', modelCall: throwing,
    });
    assert.equal(report.model?.ok, false);
    assert.match(report.model?.why ?? '', /socket hang up/);
    assert.ok(existsSync(passReportPath(root)), 'the report survived the throw');
  } finally { removeTree(cwd); }
});

test('no model configured is a null, never a zero — the two readings are different', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  const { sent, call } = transport('[]');
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: null, modelCall: call,
    });
    assert.equal(report.model, null, '"no model was called" and "the model found nothing" differ');
    assert.equal(sent.length, 0, 'a null model reached no transport at all');
  } finally { removeTree(cwd); }
});

/* ══ 3 — READING THE REPLY, WHICH IS UNTRUSTED TEXT ════════════════════════ */

test('a bare array, a fenced array and an array inside prose all read', () => {
  const body = JSON.stringify([candidate()]);
  for (const [what, raw] of [
    ['bare', body],
    ['fenced', '```json\n' + body + '\n```'],
    ['prose-wrapped', `Here is what I found:\n${body}\nLet me know.`],
  ] as [string, string][]) {
    const parsed = parseReply(raw);
    assert.equal(parsed.unparseable, null, `${what} did not read`);
    assert.equal(parsed.candidates.length, 1, `${what} yielded the wrong count`);
  }
});

test('an empty array is an ANSWER, and is not confused with a failure', () => {
  const parsed = parseReply('[]');
  assert.equal(parsed.unparseable, null);
  assert.deepEqual(parsed.candidates, []);
  assert.deepEqual(parsed.rejected, []);
});

test('a reply with no array at all is named as a contract failure', () => {
  const parsed = parseReply('I could not find anything worth proposing.');
  assert.equal(parsed.candidates.length, 0);
  assert.match(parsed.unparseable ?? '', /output contract/);
});

test('every unusable element is rejected BY NAME, never dropped silently', () => {
  const parsed = parseReply(JSON.stringify([
    candidate(),
    'a string',
    { ...candidate(), artifact: 'skill' },
    { ...candidate(), target: '' },
    { ...candidate(), evidence: [] },
    { ...candidate(), title: 42 },
  ]));
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.rejected.length, 5, 'five bad elements, five reasons');
  assert.match(parsed.rejected.join('\n'), /not an object/);
  assert.match(parsed.rejected.join('\n'), /artifact is not check, rule or lesson/);
  assert.match(parsed.rejected.join('\n'), /names no target/);
  assert.match(parsed.rejected.join('\n'), /cites no evidence/);
  assert.match(parsed.rejected.join('\n'), /title, summary or brief/);
});

test('a reply cannot flood the queue past the per-reply bound', () => {
  const parsed = parseReply(JSON.stringify(Array.from({ length: 40 }, (_, i) =>
    candidate({ title: `claim number ${i}` }))));
  assert.equal(parsed.candidates.length, 20);
  assert.equal(parsed.rejected.length, 20);
  assert.match(parsed.rejected.at(-1) ?? '', /beyond the 20-proposal bound/);
});

/* ══ 4 — THE GATES APPLY TO THE MODEL EXACTLY AS THEY DO TO THE OTHER ══════ */

test('§5c fires on a model proposal whose own evidence does not mention its target', async () => {
  const box = sandbox();
  try {
    // The evidence is real and the observation is real; only the TARGET is
    // wrong, which is upstream issue #66350 in miniature — content from one
    // piece of work written against an unrelated item.
    const wrong = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ target: 'src/ui/nothing-to-do-with-this.ts' })],
    });
    assert.equal(wrong.model?.irrelevant, 1);
    assert.equal(wrong.model?.ranked, 0);
    assert.match(wrong.because.join('\n'), /does not mention src\/ui\/nothing-to-do-with-this\.ts/);

    // ONE FIELD CHANGED, and the verdict moves. Without this half, the
    // assertion above would be satisfied by any proposal being refused for any
    // reason at all.
    const right = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ target: 'src/review/pass.ts' })],
    });
    assert.equal(right.model?.irrelevant, 0);
    assert.equal(right.model?.ranked, 1);
  } finally { box.dispose(); }
});

test('a model citing a record this pass never read is refused, not trusted', async () => {
  const box = sandbox();
  try {
    const out = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ evidence: [{ source: 'transcript.jsonl', recordIndex: 99 }] })],
    });
    assert.equal(out.model?.irrelevant, 1);
    assert.match(out.because.join('\n'), /no observation this pass read carries that source/);
  } finally { box.dispose(); }
});

test('§12 is re-run over what the MODEL wrote, because a prompt asks and a screen decides', async () => {
  const box = sandbox();
  try {
    const out = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({
        brief: 'The run was flaky and the retry passed, so src/review/pass.ts is fine.',
      })],
    });
    assert.equal(out.model?.screened, 1, 'the third anti-learning rule was not applied to the reply');
    assert.equal(out.model?.ranked, 0);
    assert.match(out.because.join('\n'), /model: screened/);
  } finally { box.dispose(); }
});

test('a model proposal and a lexical one about the same target collapse to one', async () => {
  const box = sandbox();
  try {
    // Ask the LEXICAL proposer what it makes of this observation first, and
    // use its own answer as the model's. Hand-writing a near-duplicate would
    // make the assertion a statement about the similarity threshold; taking
    // the other proposer's output makes it a statement about the two of them
    // sharing one suppression list, which is the claim.
    const alone = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
    });
    const lexical = [...alone.proposals, ...alone.withheld][0];
    assert.ok(lexical !== undefined, 'the lexical proposer produced nothing to collide with');

    const both = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ artifact: 'check', title: lexical.title })],
    });
    assert.equal(both.model?.suppressed, 1,
      '§5b suppresses a near-duplicate whichever proposer got there first — they share one list');
    assert.match(both.because.join(' '), /model: suppressed/);

    // AND THE OTHER DIRECTION, so the assertion is not just "the model path
    // drops things": a DIFFERENT claim about the same target is not suppressed.
    const distinct = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ title: 'a detached child needs an error listener before unref' })],
    });
    assert.equal(distinct.model?.suppressed, 0);
  } finally { box.dispose(); }
});

/* ══ 5 — WHAT EACH PROPOSER MAY AUTHOR, AND WHICH ONE DID ═════════════════ */

test('the model may author all three tiers; the lexical proposer still may not', async () => {
  const box = sandbox();
  try {
    assert.deepEqual([...MODEL_AUTHORABLE], ['check', 'rule', 'lesson']);
    const out = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true,
      modelCandidates: [candidate({ artifact: 'lesson', title: 'a wholly different claim here' })],
    });
    assert.equal(out.model?.unauthored, 0, 'a model composes, so a lesson from it is not a quote');
    assert.equal(out.model?.ranked, 1);

    // The narrowing is per proposer, not global: hand the SAME tier to the
    // model path with the model set narrowed, and it is refused.
    const narrowed = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5,
      queueCeiling: NO_QUEUE_CEILING, dryRun: true, modelAuthors: ['check'],
      modelCandidates: [candidate({ artifact: 'lesson', title: 'a wholly different claim here' })],
    });
    assert.equal(narrowed.model?.unauthored, 1);
  } finally { box.dispose(); }
});

test('a written draft says which proposer wrote it, on the item and in its brief', async () => {
  const box = sandbox();
  try {
    const out = await propose(input(), {
      workspace: box.root, ctx: box.ctx, sessionId: 's', max: 5, queueCeiling: NO_QUEUE_CEILING,
      modelCandidates: [candidate({ title: 'the pass is never awaited while a person waits' })],
    });
    const model = out.proposals.find((p) => p.by === 'model');
    assert.ok(model !== undefined, 'the model proposal was not written');
    assert.match(model.brief, /^A draft from the self-improvement pass[\s\S]*WRITTEN BY A MODEL/,
      'provenance is the FIRST thing after the opening line, before the argument it qualifies');
    assert.ok(model.id !== null);
    const file = path.join(box.root, DRAFT_DIR, model.category, `${model.id}.md`);
    const text = readFileSync(file, 'utf8');
    assert.match(text, new RegExp(`- "?${proposerTag('model')}"?`),
      'the item does not carry its proposer as a tag');
    assert.match(text, /origin: review/,
      'origin stays the one trust boundary and is not split to carry a label');

    const lexical = out.proposals.find((p) => p.by === 'deterministic');
    if (lexical !== undefined) {
      assert.match(lexical.brief, /Written by the DETERMINISTIC proposer/);
    }
  } finally { box.dispose(); }
});

/* ══ 6 — THE PROOF AT RATION 0: IT WOULD HAVE PROPOSED, AND DID NOT ═══════ */

test('with the ration at 0 the pass reports what the model WOULD have proposed and writes nothing', async () => {
  const { cwd, root, transcript } = project({ enabled: true, model: 'haiku' });
  const { call } = transport(JSON.stringify([
    candidate({ title: 'a pass started on Stop is never awaited', artifact: 'rule' }),
  ]));
  try {
    const ws = resolveWorkspace(cwd);
    assert.equal(ws.config.review.maxProposalsPerPass, 0, 'the ration under test is the shipped 0');
    assert.equal(ws.config.review.model, 'haiku');

    const before = runCli(['list'], cwd, () => {});
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: ws.config.review.maxProposalsPerPass,
      queueCeiling: ws.config.review.queueCeiling,
      model: ws.config.review.model, modelCall: call,
    });

    // IT RAN.
    assert.equal(report.model?.ok, true);
    assert.equal(report.model?.returned, 1);
    // IT WOULD HAVE PROPOSED, and the report says what.
    const withheld = (report.proposed?.withheld ?? []).filter((d) => d.by === 'model');
    assert.equal(withheld.length, 1, 'the report does not say what the model would have proposed');
    assert.equal(withheld[0]?.title, 'a pass started on Stop is never awaited');
    assert.equal(withheld[0]?.artifact, 'rule');
    assert.equal(withheld[0]?.id, null, 'a withheld proposal has no id because nothing was written');
    // AND THE RATION IS WHAT STOPPED IT.
    assert.ok((report.proposed?.rationed ?? 0) >= 1);
    assert.equal(report.proposed?.held, null, 'the QUEUE was not the reason — the ration was');
    assert.deepEqual(report.proposed?.drafts, []);

    // NOTHING WAS WRITTEN.
    assert.deepEqual(report.created, []);
    assert.equal(before, runCli(['list'], cwd, () => {}), 'the corpus listing changed');
    assert.ok(!existsSync(path.join(root, DRAFT_DIR)) ||
      readFileSync(passReportPath(root), 'utf8').includes('"created": []'));

    // And it is on disk, which is where a person reads it.
    const onDisk = JSON.parse(readFileSync(passReportPath(root), 'utf8')) as PassReport;
    assert.equal(onDisk.proposed?.withheld.filter((d) => d.by === 'model').length, 1);
    assert.equal(onDisk.model?.antiLearningRulesDelivered, 5);
  } finally { removeTree(cwd); }
});

test('raising the ration is what turns the same withheld proposal into a draft', async () => {
  // The complement of the test above, and the reason it is here: an assertion
  // that "nothing was created" stays green when the proposer is broken. This
  // one fails if the model path cannot write at all, so the pair separates
  // "the ration stopped it" from "there was nothing to stop".
  const { cwd, root, transcript } = project({ enabled: true, model: 'haiku', maxProposalsPerPass: 5 });
  const { call } = transport(JSON.stringify([
    candidate({ title: 'a pass started on Stop is never awaited', artifact: 'rule' }),
  ]));
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: false, maxProposals: 5, queueCeiling: NO_QUEUE_CEILING,
      model: 'haiku', modelCall: call,
    });
    const drafts = (report.proposed?.drafts ?? []).filter((d) => d.by === 'model');
    assert.equal(drafts.length, 1, 'the model path cannot write at all — the ration proved nothing');
    assert.ok(report.created.length >= 1);
  } finally { removeTree(cwd); }
});

/* ══ 7 — THE SWITCH STILL KILLS, WITH A MODEL CONFIGURED ══════════════════ */

test('with review off and a model named, NO CHILD IS SPAWNED AT ALL', () => {
  // Upstream's issue #82708 was a kill switch that did not kill, because a
  // SECOND PATH created anyway. `review.model` is exactly the shape of a second
  // path, so the switch is re-asserted with it configured rather than assumed
  // to still hold. `everyNToolCalls: 1` for `pass.test.ts`'s reason: with the
  // default interval the counter gate declines first and this stays green with
  // the switch removed.
  const { cwd, root, transcript } = project({ enabled: false, everyNToolCalls: 1, model: 'haiku' });
  try {
    assert.equal(resolveWorkspace(cwd).config.review.model, 'haiku',
      'the second path is configured and present — otherwise this proves nothing');
    bumpCounter(root, 's-1');
    const calls: unknown[] = [];
    const fn: any = () => { calls.push(1); return { pid: 1, on: () => {}, unref: () => {} }; };
    const decision = reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn);
    assert.equal(decision, null);
    assert.equal(calls.length, 0, 'THE KILL SWITCH DID NOT KILL — a child was spawned');
    assert.ok(!existsSync(passReportPath(root)), 'and nothing reached a model or a report');
  } finally { removeTree(cwd); }
});

test('with review ON and a model named, a child IS spawned and carries the name', () => {
  // The complement, and it is why the test above is about the switch rather
  // than about the fixture: without this half, a broken trigger that never
  // spawned anything would keep both green.
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 1, model: 'haiku' });
  try {
    bumpCounter(root, 's-1');
    const calls: string[][] = [];
    const fn: any = (_c: string, args: string[]) => {
      calls.push(args);
      return { pid: 1, on: () => {}, unref: () => {} };
    };
    reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn);
    assert.equal(calls.length, 1);
    assert.ok(calls[0]?.includes('--model'), 'the child was not told which model');
    assert.equal(calls[0]?.[(calls[0]?.indexOf('--model') ?? -1) + 1], 'haiku');
    assert.ok(calls[0]?.includes('--dry-run'),
      'the shipped ration is 0, so the trigger still sends the child as a dry run');
  } finally { removeTree(cwd); }
});

test('a child is told which model, and never told an unusable one', () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    const calls: string[][] = [];
    const fn: any = (_c: string, args: string[]) => {
      calls.push(args);
      return { pid: 1, on: () => {}, unref: () => {} };
    };
    const base = {
      workspace: root, transcript, sessionId: 's', subagentDir: null, includeSubagents: true,
      dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    };
    spawnPass({ ...base, model: 'haiku' }, fn);
    assert.ok(calls[0]?.includes('--model') && calls[0]?.includes('haiku'));

    spawnPass({ ...base, model: null }, fn);
    assert.ok(!calls[1]?.includes('--model'),
      'a lost --model must cost a model call, never produce one');

    spawnPass({ ...base, model: '--dangerously-skip-permissions' }, fn);
    assert.ok(!calls[2]?.includes('--model'),
      'an option-shaped name is dropped at the boundary, not passed on to be rejected later');
  } finally { removeTree(cwd); }
});

/* ══ 8 — THE OUTPUT CONTRACT, WHICH THE DESIGN NEVER SPECIFIED ════════════ */

test('the prompt states how to answer, and states that [] is an answer', () => {
  const text = reviewPrompt(input());
  assert.ok(text.includes(OUTPUT_CONTRACT), 'the contract is not in the assembled prompt');
  assert.match(OUTPUT_CONTRACT, /"artifact"/);
  assert.match(OUTPUT_CONTRACT, /"evidence"/);
  assert.match(OUTPUT_CONTRACT, /WRITE `\[\]` WHEN NOTHING HERE IS WORTH WRITING DOWN/);
  assert.doesNotMatch(OUTPUT_CONTRACT, /missed learning opportunity|be active/i,
    'the framing that caused upstream issue #66350 must not re-enter through the format section');
});

test('adding an output contract did not displace the rules it sits beside', () => {
  const text = reviewPrompt(input());
  assert.ok(text.indexOf(ANTI_LEARNING) < text.indexOf(OUTPUT_CONTRACT),
    'the rules must be read before the format, not after it');
  assert.deepEqual(rulesMissing(text), []);
});

/* ══ 9 — THE CONFIG KEY, WHICH WAS REFUSED BY NAME UNTIL NOW ══════════════ */

test('review.model is accepted, and absent still means no model at all', () => {
  assert.equal(resolveConfig({}).review.model, null,
    'the shipped default calls no model: a workspace that turns the loop on and changes nothing ' +
    'else must not start spending tokens');
  assert.equal(resolveConfig({ review: { enabled: true } }).review.model, null);
  assert.equal(resolveConfig({ review: { model: 'haiku' } }).review.model, 'haiku');
  assert.equal(resolveConfig({ review: { model: null } }).review.model, null,
    'null is a legal, spelled answer and not a missing key');
});

test('a model name that is an option is REFUSED at the config, not escaped later', () => {
  for (const bad of ['--dangerously-skip-permissions', '-p', 'haiku && whoami', 5, true, '']) {
    assert.throws(
      () => resolveConfig({ review: { model: bad } }),
      (err: Error) => {
        assert.match(err.message, /review\.model/);
        assert.match(err.message, /Nothing was loaded/,
          'a setting that cannot be acted on is refused rather than ignored');
        return true;
      },
      `review.model ${JSON.stringify(bad)} was accepted`,
    );
  }
});

test('the refusal that made way for this key names what it is for, and the other one still stands', () => {
  // `model` left REVIEW_LATER_KEYS because the sentence behind the refusal —
  // "nothing in this product calls a model" — stopped being true. The OTHER
  // key on that list did not, so the list must not have been emptied.
  assert.throws(
    () => resolveConfig({ review: { crossSessionSameCwd: true } }),
    (err: Error) => {
      assert.match(err.message, /crossSessionSameCwd/);
      assert.match(err.message, /LATER phase/);
      return true;
    },
    'crossSessionSameCwd is still not a key this build acts on',
  );
  // And the accepted list now names `model`, so the refusal message a user
  // reads for a typo tells them the key exists.
  assert.throws(
    () => resolveConfig({ review: { modell: 'haiku' } }),
    /review accepts:[^.]*model/,
  );
});
