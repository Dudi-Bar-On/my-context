// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently
/**
 * **Noise removal** — `plan:recall seq:2`, Task 8 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §6 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * The owner said what this is for, and it is not summarisation: *"my say about
 * summary is not because of its content but it is more about filtering huge
 * amount of noise and irrelevant data like scripts, output and alike."* So
 * every assertion below is about VOLUME, and none is about meaning.
 *
 * What is worth proving here.
 *
 *   1. **One classification, reused.** `a turn in words is kept and machinery
 *      is not` rests on `stanceOf`, which is `classifyTurn` read one step
 *      further — not a second opinion about what machinery is. A second
 *      definition would drift from the one the document screen already draws.
 *   2. **Routing is by TOOL NAME, and the negative finding is asserted
 *      directly.** `a prose-bearing tool survives and Bash does not` plants
 *      the two results the OTHER way round from what a lexical classifier
 *      would say: the `Bash` result is plain, unpunctuated English prose and
 *      the `Read` result is dense in punctuation. A punctuation-density rule
 *      scored **AUC 0.499** — a coin flip — and would get this pair exactly
 *      backwards. If this assertion ever passes with a lexical rule in place,
 *      the rule is being lucky.
 *   3. **An unknown tool is machinery.** The safe direction, and it is the
 *      difference between a filter that under-collects visibly and one that
 *      admits whatever it has not heard of.
 *   4. **The repeat rule removes, and REPORTS.** `the second copy of a passage
 *      is dropped` and `the count removed is reported` are separate
 *      assertions, because the design asks for the count *rather than
 *      assumed*. On the real corpus the top repeated 8-gram is an injected
 *      harness note appearing **195 times**.
 *   5. **The first copy survives.** A repeat rule that dropped both copies
 *      would remove the thing itself, and would still make the dropped-count
 *      assertion above pass.
 *   6. **Exactness, not similarity.** `a passage that merely shares a phrase
 *      is kept` pins the decision NOT to build a fuzzy threshold: MinHash+LSH
 *      measured **4,065 ms** against an exact 8-gram index's **629 ms**, and a
 *      share threshold would be a number with no derivation behind it.
 *   7. **Nothing is dropped silently.** The counts and the kept list account
 *      for every turn handed in.
 *
 * `none` is not claimed for the basis: this rests on the task item and on
 * `INV-nothing-is-dropped-silently`, both named above.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  removeNoise, stanceOf, PROSE_BEARING_TOOLS, GRAM_WORDS,
} from '../../src/core/retrieval/noise.ts';

/** A prompt the owner typed. */
function said(text: string): Record<string, unknown> {
  return { type: 'user', message: { role: 'user', content: text } };
}

/** An answer in words. */
function answered(text: string): Record<string, unknown> {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

/** Machinery carrying no tool at all — thinking, folded away on the screen. */
function thought(text: string): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'thinking', thinking: text }] },
  };
}

/** A tool call. */
function called(id: string, name: string, input: unknown): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
  };
}

/** What the tool answered. The record does NOT name the tool; the id pairs it. */
function returned(id: string, text: string): Record<string, unknown> {
  return {
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text }] },
  };
}

test('a turn in words is kept and machinery carrying no tool is not', () => {
  const report = removeNoise([
    { record: said('where did the anchors table decision get made') },
    { record: answered('it was plan:archive seq:34, and the reason was the rebuild') },
    { record: thought('the user is asking about a decision I should look up') },
  ]);
  assert.deepEqual(report.kept.map((turn) => turn.stance), ['said', 'said']);
  assert.equal(report.removed.work, 1);
});

test('a tool call is a deed and a turn in words is not', () => {
  assert.equal(stanceOf(called('t1', 'Bash', { command: 'ls' })), 'deed');
  assert.equal(stanceOf(said('what did that print')), 'said');
  assert.equal(stanceOf(thought('considering')), 'work');
});

test('a prose-bearing tool survives and Bash does not', () => {
  // Deliberately the wrong way round for any lexical rule: the Bash result is
  // plain prose and the Read result is dense in punctuation.
  const report = removeNoise([
    { record: called('t1', 'Bash', { command: 'echo hi' }) },
    { record: returned('t1', 'the build finished and everything looks fine to me today') },
    { record: called('t2', 'Read', { file_path: 'docs/spec.md' }) },
    { record: returned('t2', '{"a":[1,2],"b":{"c":"d"}}; // <- punctuation, and still prose') },
  ]);
  const tools = report.kept.map((turn) => turn.tool);
  assert.ok(tools.includes('Read'), `Read was dropped: ${JSON.stringify(report.kept)}`);
  assert.ok(!tools.includes('Bash'), `Bash survived: ${JSON.stringify(report.kept)}`);
  assert.equal(report.removed.tool, 2);
});

test('Bash is not in the prose-bearing set and Read is', () => {
  assert.equal(PROSE_BEARING_TOOLS.has('Bash'), false);
  assert.equal(PROSE_BEARING_TOOLS.has('Read'), true);
});

test('a tool nobody can name is treated as machinery', () => {
  const report = removeNoise([
    { record: returned('orphan', 'a result whose call is not in the window handed in') },
  ]);
  assert.deepEqual(report.kept, []);
  assert.equal(report.removed.tool, 1);
});

/** Eight words is the gram width, so a repeated block must be at least that. */
const BLOCK = 'this block of text is long enough to carry a whole eight word gram';

test('the second copy of a passage is dropped and the first is kept', () => {
  const report = removeNoise([
    { record: said(BLOCK) },
    { record: said('something else entirely, about anchors and byte offsets') },
    { record: said(BLOCK) },
  ]);
  assert.equal(report.kept.length, 2);
  assert.deepEqual(report.kept.map((turn) => turn.index), [0, 1]);
  assert.equal(report.removed.repeat, 1);
});

test('the count removed is reported, and the repeated text is named', () => {
  const report = removeNoise([
    { record: said(BLOCK) },
    { record: said(BLOCK) },
    { record: said(BLOCK) },
  ]);
  assert.equal(report.removed.repeat, 2);
  assert.ok(report.repeats.length > 0, 'a repeat rule that reports nothing cannot be checked');
  assert.equal(report.repeats[0]?.count, 3);
  assert.ok(
    (report.repeats[0]?.gram ?? '').split(' ').length === GRAM_WORDS,
    `a reported repeat must be a ${GRAM_WORDS}-gram: ${JSON.stringify(report.repeats[0])}`,
  );
});

test('a passage that merely shares a phrase with another is kept', () => {
  const report = removeNoise([
    { record: said(BLOCK) },
    { record: said(`${BLOCK} and then it says something nobody has said before now`) },
  ]);
  assert.equal(report.removed.repeat, 0);
  assert.equal(report.kept.length, 2);
});

test('every turn handed in is accounted for', () => {
  const turns = [
    { record: said(BLOCK) },
    { record: said(BLOCK) },
    { record: thought('folded away') },
    { record: called('t1', 'Bash', { command: 'ls' }) },
    { record: returned('t1', 'a listing') },
    { record: answered('and an answer in words') },
  ];
  const report = removeNoise(turns);
  assert.equal(report.seen, turns.length);
  assert.equal(
    report.kept.length + report.removed.work + report.removed.tool
      + report.removed.repeat + report.removed.empty,
    turns.length,
    'a turn that is neither kept nor counted as removed has been dropped silently',
  );
});
