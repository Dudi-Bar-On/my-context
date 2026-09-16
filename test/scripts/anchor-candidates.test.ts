// @basis TASK-find-out-what-else-in-a-transcript-is-worth-marking,
// TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The findings `scripts/measure-anchor-candidates.ts` reports, held as
 * assertions so they cannot rot quietly.**
 *
 * ── THREE OF THESE USED TO BE FINDINGS AND ARE NOW REMOVAL PROOFS ─────────
 *
 * Until 2026-09-15 the first three tests in this file ASSERTED THE DEFECT: that
 * a lane dispatch is marked as a ruling, that a `<task-notification>` reaches
 * the ruling grammar as a prompt, and that a text-shape `ownerTyped` was needed
 * to tell the owner's keyboard from the harness'. They were green, and every
 * one of them described something nobody wanted — 377 of his 1,164 marks, none
 * of them a turn he typed.
 *
 * `TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic` closed it.
 * The same three cases are still here, still with the same fixtures, and the
 * ANSWERS ARE INVERTED. That is deliberate: a finding that is repaired should
 * become the proof of its own repair at the line that described it, so a reader
 * following the number lands on the thing that fixed it rather than on a gap.
 *
 * **Each case still carries its own removal proof IN THE SAME RUN.** A test
 * that only asserts "this is refused" is green when the predicate throws every
 * input away. So each asserts the NEAR MISS beside it — the same string with
 * the one property changed that the claim rests on — and that half must come
 * out the other way. A green therefore means "the distinction is real", not
 * "nothing matched".
 *
 * The predicates are IMPORTED from the shipped grammar rather than restated
 * here. A second copy of a regex is the defect `CLAUDE.md` opens by describing,
 * and it would make this file agree with itself while disagreeing with the
 * numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorsInTurn, ownerTyped } from '../../src/core/anchor-pass.ts';
import { longestFence, unitCount } from '../../scripts/measure-anchor-candidates.ts';

/**
 * A lane dispatch as this plugin actually writes one: the SubagentStart hook
 * prepends the governing items, in full, each under its own id. Trimmed to the
 * two lines that matter — the id, and the fact that the block is prose.
 *
 * **It carries `must` as well as the id**, and that is the point of the fixture
 * rather than an accident: the block is normative text, so it speaks in exactly
 * the words the new grammar looks for. Nothing about the WORDS keeps it out.
 */
const LANE_DISPATCH = [
  '_This block was added by my_context, the knowledge plugin installed in this',
  'repository, when this subagent started._',
  '',
  '### CONST-node-24-no-build-step · constraint · Node 24 or newer, and no build step',
  '',
  'Source is `.ts`, executed directly by Node 24 native type stripping. Every',
  'relative import must carry an explicit .ts extension.',
].join('\n');

/**
 * The record a lane's first turn actually is. `isSidechain` is the harness
 * saying THIS FILE IS A LANE'S TRANSCRIPT, and it carries no `origin` at all
 * because nobody produced it — the hook did.
 */
const DISPATCH_RECORD = { type: 'user', isSidechain: true };
/** A record the harness attributes to a person. */
const HIS = { type: 'user', origin: { kind: 'human' }, promptSource: 'typed' };

/**
 * REMOVAL PROOF — **this plugin's own injection block is no longer marked**,
 * and it was 296 of the `ruling` grammar's 377 marks on the owner's archive.
 *
 * `anchorsInTurn` restricted a ruling to `kind === 'prompt'` because *"a ruling
 * is something the owner GAVE"*. A lane's transcript opens with the dispatch,
 * `classifyTurn` calls it a prompt, and the dispatch carries every governing id
 * verbatim — so the restriction admitted exactly the turns it was written to
 * exclude. It now reads `origin.kind` off the record, which the hook does not
 * write because the hook is not a person.
 *
 * REMOVAL PROOF FOR THE REMOVAL: the SAME BLOCK on a record the archive
 * attributes to him IS marked. If this test were green because the grammar had
 * stopped matching anything at all, that half would be green too and it is not.
 */
test('the injection block this plugin writes into every lane is not a ruling', () => {
  assert.equal(
    anchorsInTurn({ record: DISPATCH_RECORD, laneReport: null }, LANE_DISPATCH).length, 0,
    'the block carries `CONST-node-24-no-build-step` AND the word `must`, and neither is a '
    + 'reason to mark it: nobody typed it',
  );

  // The detector can still see a red. One property moves: whose record it is.
  const asHis = anchorsInTurn({ record: HIS, laneReport: null }, LANE_DISPATCH);
  assert.deepEqual(asHis.map((f) => f.kind), ['ruling']);
  assert.match(asHis[0]?.label ?? '', /must carry an explicit \.ts extension/);
});

/**
 * REMOVAL PROOF — **a `<task-notification>` is no longer a ruling**, and 53 of
 * the old grammar's marks on the owner's archive were one.
 *
 * The harness writes a lane's report back into the parent's prompt slot and
 * quotes whatever the lane said, ids and normative words included. It files the
 * record as `origin.kind: 'task-notification'`, which is the archive answering
 * the question the old guard could only guess at.
 *
 * REMOVAL PROOF: strip the wrapper and the same words on HIS record are a
 * ruling. One string, one difference, two answers.
 */
test('a harness task-notification is not a ruling, and the same words typed are', () => {
  const body = 'the mockup must never be written to — it is a frozen reference';
  const notification = `<task-notification>\n<task-id>abc123</task-id>\n${body}\n</task-notification>`;
  const record = { type: 'user', origin: { kind: 'task-notification' }, promptSource: 'system' };

  assert.equal(anchorsInTurn({ record, laneReport: null }, notification).length, 0);
  assert.equal(
    ownerTyped(record), false,
    'the archive says who produced it, and it was not him — that is the filter the shipped '
    + 'grammar did not have',
  );

  // Removal proof: the same sentence, typed. If `ownerTyped` were refusing
  // everything, this half would be false.
  assert.equal(ownerTyped(HIS), true);
  assert.deepEqual(
    anchorsInTurn({ record: HIS, laneReport: null }, body),
    [{ kind: 'ruling', label: body }],
  );
});

/**
 * REMOVAL PROOF — **a headless run is not the owner's keyboard, and it no
 * longer takes a filter to say so.** Twelve of the thirteen sessions in his
 * archive are headless runs of this product's own nightly lesson pass, whose
 * "prompt" is a prompt this repository wrote.
 *
 * `measure-anchor-candidates.ts` used `conversations.prompts <= 1` to name them.
 * That filter is GONE and the number it produced is now zero, because the
 * harness files a headless prompt as `promptSource: 'sdk'` with no `origin` at
 * all. The report still prints the count so the agreement is visible.
 *
 * REMOVAL PROOF: the identical text on a record the harness attributes to a
 * person is admitted. The record is the only thing that moves.
 */
test('a headless run is refused on the record, with no session filter at all', () => {
  const text = 'You are reading one coding session to decide whether this project learned anything';
  const sdk = { type: 'user', promptSource: 'sdk', entrypoint: 'sdk-cli' };

  assert.equal(ownerTyped(sdk), false);
  assert.equal(ownerTyped(HIS), true);
  assert.equal(anchorsInTurn({ record: sdk, laneReport: null }, `${text} — it must`).length, 0);
  assert.equal(
    anchorsInTurn({ record: HIS, laneReport: null }, `${text} — it must`)[0]?.kind, 'ruling',
  );
});

/**
 * A BEHAVIOUR — **`ownerTyped` is not satisfied by the SHAPE of a record.**
 *
 * This is the assertion that stops the predicate from being widened back into a
 * list of text shapes wearing a structural costume: an `origin` that is a
 * string, or an object with some other `kind`, is not a person. It exists
 * because `origin` is read off a JSON record whose fields nothing validates.
 */
test('origin must say `human`, and a plausible near-miss is refused', () => {
  const ruled = 'you must always use port 58888';
  assert.equal(ownerTyped({ origin: 'human' }), false, 'a STRING is not the shape');
  assert.equal(ownerTyped({ origin: { kind: 'coordinator' } }), false);
  assert.equal(ownerTyped({ origin: { kind: 'unclassified' } }), false);
  assert.equal(ownerTyped({ origin: null }), false);
  assert.equal(ownerTyped({}), false);
  assert.equal(ownerTyped(null), false, 'a record the pass could not read is never his');
  // And the red the detector must still be able to see.
  assert.equal(anchorsInTurn({ record: HIS, laneReport: null }, ruled)[0]?.kind, 'ruling');
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
