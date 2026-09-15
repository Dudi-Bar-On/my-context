// @basis TASK-two-read-endpoints-block-the-whole-server-for-about-four,
//        TASK-the-contradictions-already-in-the-corpus-are-found-and

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  overlapParts, overlapPartsOfTokens, overlapScore, overlapTokensOf,
} from '../../src/core/overlap.ts';

/**
 * **`overlapParts` split into a tokenizer and an arithmetic half, and the split
 * proved to change nothing.**
 *
 * `checkCorpusContradictions` (doctor/checks.ts) compares the governing in-scope
 * items against EACH OTHER, so `overlapParts(a, b)` re-tokenized every item's
 * body once per partner. Measured on the owner's corpus 2026-09-15 — 1,269
 * items, 214 candidates, 22,791 pairs — that sweep cost **1,240 ms**; with each
 * candidate tokenized once and the sets reused it costs **59 ms**, and the check
 * as a whole went 1,453 ms to 65 ms. `runChecks` went 2,202 ms to 700 ms and
 * `/api/status` cold went 2,325 ms to 668 ms.
 *
 * None of those numbers is asserted here. A millisecond threshold in a test is
 * green alone and red under load, which this repository has repaired twice this
 * week; the figures belong in the measurement that was reported, and what a test
 * can hold is the EQUIVALENCE the saving depends on.
 *
 * THE EQUIVALENCE, and why it is worth a file. The hoist is only sound if
 * `overlapPartsOfTokens(overlapTokensOf(a), overlapTokensOf(b))` is
 * `overlapParts(a, b)` for every input, including the ones that took the early
 * return: an empty side, a one-token side, a side that is wholly contained in
 * the other. `overlapParts` IS that composition now, so a reader could call this
 * circular — which is exactly why the cases below are chosen for the BRANCHES
 * rather than for the identity, and why the last of them re-derives the score
 * from the definition in the docblock (`max(jaccard, containment * 0.8)`)
 * instead of from either function.
 *
 * BORROWED POWER, disclosed, and it was MEASURED rather than assumed. Three of
 * the five tests below compare `overlapParts` against a composition it now IS,
 * so a mutation to the arithmetic they share passes all three. That was proved
 * by trying one: replacing `Math.min` with `Math.max` inside `containment`
 * reddened nothing in the first draft of this file. Two assertions carry their
 * own power and are the ones to break first if this file is ever refactored —
 * `title and body are joined, not concatenated`, which is all `overlapTokensOf`
 * does beyond the regex, and `jaccard and containment are the arithmetic they
 * claim`, whose numbers are worked out on paper from the docblock's formula
 * rather than read off the function under test.
 */

const pair = (t: string, b: string): { title: string; body: string } => ({ title: t, body: b });

/** Chosen for the branches, not for variety: each row reaches a different one. */
const CASES: [string, { title: string; body: string }, { title: string; body: string }][] = [
  ['both empty', pair('', ''), pair('', '')],
  ['left empty', pair('', ''), pair('alpha beta', 'gamma delta')],
  ['right empty', pair('alpha beta', 'gamma delta'), pair('', '')],
  ['nothing shared', pair('alpha beta', 'gamma'), pair('epsilon zeta', 'eta')],
  ['identical', pair('alpha beta', 'gamma delta'), pair('alpha beta', 'gamma delta')],
  ['contained: short inside long', pair('alpha', ''),
    pair('alpha beta gamma', 'delta epsilon zeta eta theta')],
  ['contained the other way', pair('alpha beta gamma', 'delta epsilon zeta eta theta'),
    pair('alpha', '')],
  ['partial overlap', pair('alpha beta gamma', 'delta'), pair('gamma delta epsilon', 'zeta')],
  ['tokens under three characters are dropped', pair('a an the alpha', 'of to beta'),
    pair('a an the alpha', 'of to gamma')],
  ['case and punctuation are folded', pair('ALPHA, Beta!', 'GAMMA.'), pair('alpha beta', 'gamma')],
  ['digits count as tokens', pair('item 2026 alpha', '58888'), pair('item 2026 beta', '58888')],
];

test('the token split computes exactly what the text form computes', () => {
  for (const [name, a, b] of CASES) {
    assert.deepEqual(
      overlapPartsOfTokens(overlapTokensOf(a), overlapTokensOf(b)),
      overlapParts(a, b),
      `FINDING: ${name} — the hoisted form and the text form agree exactly`,
    );
  }
});

test('the split is symmetric in the two halves it now iterates by size', () => {
  // `overlapPartsOfTokens` iterates the SMALLER set. `jaccard` and `containment`
  // are symmetric by definition, so swapping the arguments must move only
  // `aTokens`/`bTokens` — and if the size-based branch ever leaked into the
  // arithmetic, this is where it would show.
  for (const [name, a, b] of CASES) {
    const forward = overlapParts(a, b);
    const backward = overlapParts(b, a);
    assert.equal(backward.score, forward.score, `FINDING: ${name} — score is symmetric`);
    assert.equal(backward.jaccard, forward.jaccard, `FINDING: ${name} — jaccard is symmetric`);
    assert.equal(backward.containment, forward.containment,
      `FINDING: ${name} — containment is symmetric`);
    assert.equal(backward.aTokens, forward.bTokens, 'the token counts follow their arguments');
    assert.equal(backward.bTokens, forward.aTokens);
  }
});

test('title and body are joined, not concatenated', () => {
  // Without the newline the tokenizer would see `alphabeta` as one token; with
  // it, two. This is the whole content of `overlapTokensOf` beyond the regex,
  // and nothing else in this file would notice its loss.
  const tokens = overlapTokensOf({ title: 'alpha', body: 'beta' });
  assert.deepEqual([...tokens].sort(), ['alpha', 'beta'],
    'FINDING: the title/body boundary is a token boundary');
  assert.equal(tokens.has('alphabeta'), false);
});

test('jaccard and containment are the arithmetic they claim, computed by hand', () => {
  // **The assertion that is not circular, and the reason it had to be written.**
  //
  // Every other test in this file compares `overlapParts` against a composition
  // it now IS, so a mutation to the shared arithmetic passes them all: replacing
  // `Math.min` with `Math.max` in `containment` was tried and reddened nothing,
  // because the re-derivation below it reads `containment` off the same function
  // it is checking. These numbers come from the definition in the docblock —
  // `common / (|a| + |b| - common)` and `common / min(|a|, |b|)` — worked out on
  // paper, and are the only thing here that would catch it.
  const short = pair('alpha', '');
  const long = pair('alpha beta gamma', 'delta epsilon zeta eta theta');
  const contained = overlapParts(short, long);
  assert.equal(contained.aTokens, 1);
  assert.equal(contained.bTokens, 8);
  assert.equal(contained.jaccard, 1 / 8, 'FINDING: common 1, union 8 — jaccard is 0.125');
  assert.equal(contained.containment, 1,
    'FINDING: containment divides by the SMALLER set, so a one-token text wholly inside an '
    + 'eight-token one scores 1 — dividing by the larger would give 0.125 and this is the only '
    + 'assertion in the file that can tell those apart');
  assert.equal(contained.score, 0.8, 'FINDING: containment 1 scaled by 0.8 beats jaccard 0.125');

  const partial = overlapParts(pair('alpha beta gamma', 'delta'), pair('gamma delta epsilon', 'zeta'));
  assert.equal(partial.aTokens, 4);
  assert.equal(partial.bTokens, 4);
  assert.equal(partial.jaccard, 2 / 6, 'FINDING: common 2 (gamma, delta), union 6');
  assert.equal(partial.containment, 2 / 4, 'FINDING: common 2 over min size 4');
  assert.equal(partial.score, 0.4, 'FINDING: containment 0.5 scaled by 0.8 beats jaccard 0.333');
});

test('the score is still max(jaccard, containment * 0.8), re-derived from the definition', () => {
  // Deliberately NOT read off either function: this is the docblock's formula,
  // computed here from the two halves, and it is what keeps the pair of them
  // honest if somebody edits the `max`.
  for (const [name, a, b] of CASES) {
    const parts = overlapParts(a, b);
    const expected = parts.aTokens === 0 || parts.bTokens === 0
      ? 0 : Math.max(parts.jaccard, parts.containment * 0.8);
    assert.equal(parts.score, expected, `FINDING: ${name} — the score is its own definition`);
    assert.equal(overlapScore(a, b), parts.score,
      'FINDING: `overlapScore` is still exactly `overlapParts(...).score`');
  }
});
