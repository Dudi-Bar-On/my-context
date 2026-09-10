// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// INV-nothing-is-dropped-silently
//
// §5b, and the two halves of it that are easy to conflate. Exact and fuzzy
// dedupe are complementary rather than substitutes: a content hash catches the
// case that barely matters (two identical proposals) and passes the case that
// produced upstream's 74-item queue (one claim said twice). Both layers are
// asserted here, and so is the boundary that must NOT be crossed — the same
// words about a different target are two observations, and suppressing the
// second would drop it with no trace for anybody to notice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimKey, claimScore, sameClaim, NEAR_CLAIM_THRESHOLD } from '../../src/review/claim.ts';
import { suppress } from '../../src/review/dedupe.ts';

test('a reworded duplicate for the same target is suppressed', () => {
  const pending = [{
    id: 'a', target: 'styles.css', title: 'inputs need styling',
    body: 'Bare inputs render as UA chrome in a dark console.',
  }];
  const got = suppress({
    id: 'b', target: 'styles.css', title: 'unstyled inputs',
    body: 'A plain input shows browser chrome against the dark console.',
  }, pending);

  assert.equal(got.drop, true);
  assert.match(got.because ?? '', /\ba\b/, 'the reason names WHICH pending item it duplicates');
});

test('the same words about a different target are NOT suppressed', () => {
  const pending = [{
    id: 'a', target: 'styles.css', title: 'inputs need styling', body: 'x y z alpha beta gamma',
  }];
  const got = suppress({
    id: 'b', target: 'app.js', title: 'inputs need styling', body: 'x y z alpha beta gamma',
  }, pending);

  assert.equal(got.drop, false, 'target is part of identity — same claim, different subject');
  // And the mechanism, not just the outcome: the target is a TOTAL gate, so
  // the pair scores zero rather than scoring high and being vetoed afterwards.
  // Before `sameClaim` split the key, this pair scored 0.83 and was dropped.
  assert.equal(
    claimScore(
      claimKey('inputs need styling', 'x y z alpha beta gamma', 'styles.css'),
      claimKey('inputs need styling', 'x y z alpha beta gamma', 'app.js'),
    ),
    0,
  );
});

test('the exact layer survives rewording, dates, ticket ids and markdown', () => {
  // Same claim, written twice by somebody in a hurry. The canonical value is
  // IDENTICAL — no similarity measure is consulted at all, which is what makes
  // this layer deterministic.
  const first = claimKey(
    'inputs need styling', 'Bare inputs render as UA chrome in a dark console.', 'styles.css',
  );
  const second = claimKey(
    'Inputs, need STYLING!',
    '**bare input** rendered as UA chrome in a dark console (2026-09-08, #4521)',
    'styles.css',
  );
  assert.equal(second, first, 'a date, a ticket id, markdown and inflection are not the claim');
});

test('a claim with no content words matches nothing, and suppresses nothing', () => {
  assert.equal(claimKey('the and for', 'is was be', null), '');
  assert.equal(sameClaim('', 'anything at all'), false);
  const got = suppress(
    { id: 'b', target: null, title: 'the and', body: 'is was' },
    [{ id: 'a', target: null, title: 'the and', body: 'is was' }],
  );
  assert.equal(got.drop, false, 'an empty key must never collapse two proposals into one');
});

test('a candidate never suppresses itself', () => {
  const one = { id: 'a', target: 'src/x.ts', title: 'a claim about x', body: 'It renders wrong.' };
  assert.equal(suppress(one, [one]).drop, false);
});

test('the threshold is the calibrated one, not the contradiction gate', async () => {
  // The two numbers answer different questions over different populations and
  // must never be unified — `claim.ts` carries the table this one came from.
  const { CONTRADICTION_THRESHOLD } = await import('../../src/core/overlap.ts');
  assert.notEqual(NEAR_CLAIM_THRESHOLD, CONTRADICTION_THRESHOLD);
  assert.equal(NEAR_CLAIM_THRESHOLD, 0.35);
});
