// @basis TASK-find-out-what-else-in-a-transcript-is-worth-marking, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The findings `scripts/measure-anchor-candidates.ts` reports, held as
 * assertions so they cannot rot quietly.**
 *
 * Every test here is a FINDING and is named as one. Only one of them asserts a
 * behaviour somebody wanted; the rest pin a defect the measurement counted on
 * the owner's real archive, so that a later change which closes one reddens the
 * line describing it and sends the person closing it to the number.
 *
 * **Each finding carries its own removal proof IN THE SAME RUN.** A test that
 * only asserts "this text is marked" is green when the grammar has been
 * widened to mark everything, and a test that only asserts "this is refused"
 * is green when the predicate throws every input away. So each case below
 * asserts the NEAR MISS beside it — the same string with the one property
 * changed that the claim rests on — and that half must come out the other way.
 * A green therefore means "the distinction is real", not "nothing matched".
 *
 * The predicates are IMPORTED from the script rather than restated here. A
 * second copy of a regex is the defect `CLAUDE.md` opens by describing, and it
 * would make this file agree with itself while disagreeing with the numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorInTurn } from '../../src/core/anchor-pass.ts';
import {
  longestFence, ownerTyped, unitCount,
} from '../../scripts/measure-anchor-candidates.ts';

/**
 * A lane dispatch as this plugin actually writes one: the SubagentStart hook
 * prepends the governing items, in full, each under its own id. Trimmed to the
 * two lines that matter — the id, and the fact that the block is prose.
 */
const LANE_DISPATCH = [
  '_This block was added by my_context, the knowledge plugin installed in this',
  'repository, when this subagent started._',
  '',
  '### CONST-node-24-no-build-step · constraint · Node 24 or newer, and no build step',
  '',
  'Source is `.ts`, executed directly by Node 24 native type stripping.',
].join('\n');

/**
 * FINDING — **the `ruling` grammar marks this plugin's own injection block**,
 * and on the owner's archive that is 296 of its 377 marks.
 *
 * `anchorInTurn` restricts a ruling to `kind === 'prompt'` because *"a ruling
 * is something the owner GAVE"*. A lane's transcript opens with the dispatch
 * message, `classifyTurn` calls it a prompt, and the dispatch carries every
 * governing id verbatim — so the restriction admits exactly the turns it was
 * written to exclude.
 *
 * REMOVAL PROOF: the same text as an ANSWER is refused. If this test were
 * green because the grammar had stopped matching at all, or because the sample
 * carried no id, the second half would be green too and it is not.
 */
test('FINDING: a lane dispatch — the plugin\'s own injection — is marked as a ruling', () => {
  const asPrompt = anchorInTurn('prompt', LANE_DISPATCH);
  assert.equal(asPrompt?.kind, 'ruling');
  assert.equal(asPrompt?.label, 'CONST-node-24-no-build-step');

  // The removal proof: the ONE property this finding rests on is `kind`.
  assert.equal(anchorInTurn('answer', LANE_DISPATCH), null);
});

/**
 * FINDING — **a `<task-notification>` is a prompt too**, and 53 of the ruling
 * marks on the owner's archive are one.
 *
 * The harness writes a lane's report back into the parent's prompt slot. It
 * quotes whatever the lane said, ids included.
 *
 * REMOVAL PROOF: strip the wrapper and the same words are the owner's, which
 * `ownerTyped` admits. One string, one difference, two answers.
 */
test('FINDING: a harness task-notification reaches the ruling grammar as a prompt', () => {
  const body = 'closed under DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written';
  const notification = `<task-notification>\n<task-id>abc123</task-id>\n${body}\n</task-notification>`;

  assert.equal(anchorInTurn('prompt', notification)?.kind, 'ruling');
  assert.equal(
    ownerTyped({ kind: 'prompt', agentId: null, sessionId: 's', text: notification }),
    false,
    'ownerTyped must refuse it — that is the filter the shipped grammar does not have',
  );

  // Removal proof: the same sentence, typed. If `ownerTyped` were refusing
  // everything, this half would be false.
  assert.equal(
    ownerTyped({ kind: 'prompt', agentId: null, sessionId: 's', text: body }),
    true,
  );
});

/**
 * FINDING — **a one-prompt session is not the owner's keyboard.** Twelve of the
 * thirteen sessions in his archive are headless runs of this product's own
 * nightly lesson pass, whose "prompt" is a prompt this repository wrote.
 *
 * The filter is `conversations.prompts <= 1` — structural, from the archive's
 * own row, so it does not need a text shape that has to grow as the harness
 * changes.
 *
 * REMOVAL PROOF: the identical text in a session that is NOT headless is
 * admitted. The session id is the only thing that moves.
 */
test('FINDING: a headless session\'s prompt is not owner-typed, the same words elsewhere are', () => {
  const text = 'You are reading one coding session to decide whether this project learned anything';
  const headless = new Set(['nightly']);

  assert.equal(
    ownerTyped({ kind: 'prompt', agentId: null, sessionId: 'nightly', text }, headless),
    false,
  );
  assert.equal(
    ownerTyped({ kind: 'prompt', agentId: null, sessionId: 'his', text }, headless),
    true,
  );
});

/**
 * A BEHAVIOUR, not a finding — the fence counter the `fence-*` rows are counted
 * with. It is here because the counts in the report rest on it and nothing else
 * in this repository measures a fence.
 *
 * REMOVAL PROOF: the unclosed fence. A counter that simply returned "lines
 * between the first ``` and the end" would pass the first assertion and fail
 * this one, and that is the mistake that inflates every `fence-*` count.
 */
test('longestFence counts the BODY of a closed fence, and refuses an unclosed one', () => {
  assert.deepEqual(
    longestFence('before\n```js\na\nb\nc\n```\nafter'),
    { lines: 3, info: 'js' },
  );
  assert.equal(longestFence('before\n```js\na\nb\nc\nno close'), null);
  assert.equal(longestFence('no fence here at all'), null);
});

/**
 * A BEHAVIOUR — **the LONGEST block, and a line carrying an info string does
 * not close one.** Both halves are what the `fence-5` / `fence-12` / `fence-25`
 * thresholds are counted with, so a counter that returned the FIRST block, or
 * that let an opening fence close the block above it, would move every one of
 * those rows.
 *
 * REMOVAL PROOF: the two blocks are deliberately in the order that separates
 * the claims — the short one first, so "the longest" cannot be satisfied by
 * "the first"; and the info-string line in the middle, so a counter that
 * treated it as a closer would report a 1-line body instead of a 4-line one.
 */
test('longestFence takes the longest block, and an info string never closes one', () => {
  assert.deepEqual(
    longestFence('```\nonly\n```\ntext\n```py\na\nb\nc\nd\n```'),
    { lines: 4, info: 'py' },
  );
  assert.deepEqual(
    longestFence('```js\na\n```ts\nb\nc\n```'),
    { lines: 4, info: 'js' },
  );
});

/**
 * A BEHAVIOUR — the `measure-*` rows rest on "a number with a UNIT", and the
 * whole weight of that candidate is on the word unit.
 *
 * REMOVAL PROOF: the same digits with no unit count zero. A counter that
 * matched bare integers would mark every turn that numbers a list, which is
 * most of this archive.
 */
test('unitCount counts numbers that carry a unit and ignores bare digits', () => {
  assert.equal(unitCount('the pass costs 266 ms and reads 25.9 MB, 4% of the budget'), 3);
  assert.equal(unitCount('do 1, then 2, then 3 and finally 4'), 0);
});
