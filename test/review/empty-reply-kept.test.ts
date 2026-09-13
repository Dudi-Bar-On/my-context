// @basis TASK-a-pass-that-proposed-nothing-cannot-say-which-of-three, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **Three events produce `returned: 0`, and before this they were one number.**
 *
 * A model that returned an empty array, a model that returned prose the parser
 * never saw as a candidate, and a model that returned nothing at all are three
 * different facts with three different remedies — and a pass reported all three
 * as `returned: 0, rejected: []`. The evidence that tells them apart is the
 * reply, and it was thrown away at the moment it existed.
 *
 * These tests drive `runPass` with an injected transport, so no CLI, no network
 * and no model are involved: the question is what the REPORT keeps, not what a
 * model says.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPass, boundedReply, EMPTY_REPLY_BYTES } from '../../src/review/pass.ts';

/** A workspace with a transcript the gatherer can read and nothing else. */
function scratch(): { workspace: string; transcript: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'empty-reply-'));
  const workspace = path.join(root, '.my_context');
  mkdirSync(path.join(workspace, 'state'), { recursive: true });
  const transcript = path.join(root, 'session.jsonl');
  const say = (text: string): string => JSON.stringify({
    type: 'user', timestamp: new Date().toISOString(), message: { role: 'user', content: text },
  });
  writeFileSync(transcript, `${say('a correction: that was wrong, it is the other way round')}\n`, 'utf8');
  return { workspace, transcript };
}

async function passWith(reply: string): Promise<{ emptyReply: string | null; returned: number }> {
  const { workspace, transcript } = scratch();
  const report = await runPass({
    workspace, transcript, sessionId: 's', subagentDir: null, includeSubagents: false,
    maxProposals: 0, queueCeiling: 0, dryRun: true, model: 'a-model',
    modelCall: async () => ({ ok: true as const, text: reply, ms: 1, command: 'x', promptBytes: 1 }),
  });
  const m = report.model;
  assert.ok(m !== null, 'a pass given a model must record what the call did');
  return { emptyReply: m.emptyReply, returned: m.returned };
}

test('a reply that parses to an empty array is KEPT, so a refusal is readable as one', async () => {
  const { emptyReply, returned } = await passWith('[]');
  assert.equal(returned, 0);
  assert.equal(emptyReply, '[]',
    'the model answered and proposed nothing; without the reply that is indistinguishable '
    + 'from a reply nobody could read');
});

test('a reply the parser cannot read is KEPT, which is the case `why` alone does not settle', async () => {
  const prose = 'I looked at the stretch and there is nothing here worth a rule.';
  const { emptyReply, returned } = await passWith(prose);
  assert.equal(returned, 0);
  assert.equal(emptyReply, prose,
    'an unparseable reply is the one a reader most needs to see, and it is the one a '
    + 'parser-shaped report is most likely to drop');
});

test('a reply that DID produce a candidate keeps nothing — the proposal is the evidence', async () => {
  const one = JSON.stringify([{
    artifact: 'rule', target: 'src/x.ts', title: 'a title',
    summary: 'a summary sentence a reader who does not know this codebase can follow.',
    brief: 'the argument, at the length a reviewer needs to rule on it.',
    evidence: [{ source: 'session.jsonl', recordIndex: 0 }],
  }]);
  const { emptyReply } = await passWith(one);
  assert.equal(emptyReply, null,
    'keeping the text as well would put a model\'s prose in every report for no question it answers');
});

test('a long reply is cut AND says how much it dropped', () => {
  const long = 'x'.repeat(EMPTY_REPLY_BYTES + 500);
  const out = boundedReply(long);
  assert.ok(out.length < long.length, 'the bound must actually bound');
  assert.match(out, /\[\.\.\. 500 more byte\(s\) not kept\]/,
    'a bound that hides how much it dropped is the defect this product files against others');
});

test('a reply inside the bound is kept whole, with no marker invented', () => {
  const short = 'nothing here';
  assert.equal(boundedReply(short), short);
});
