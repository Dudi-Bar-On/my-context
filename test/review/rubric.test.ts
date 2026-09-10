// @basis TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
//
// The standard is here for the refusals, not the firings: every `fire: false`
// below also asserts that `because` says something, because a loop that
// declines to fire and cannot say why is a quiet loop nobody can tell apart
// from a broken one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worthAPass } from '../../src/review/rubric.ts';

test('a stretch with a correction in it is worth a pass', () => {
  const got = worthAPass([{ category: 'correction', who: 'person' }]);
  assert.equal(got.fire, true);
  assert.match(got.because, /correction/i, 'the reason must name what made it worth firing');
});

test('measurements alone are not worth a pass', () => {
  const got = worthAPass([
    { category: 'measurement', who: 'model' },
    { category: 'measurement', who: 'model' },
  ]);
  assert.equal(got.fire, false);
  assert.match(got.because, /.+/, 'a refusal must say why, so a quiet loop is explicable');
  assert.match(got.because, /measurement/i);
});

test('nothing at all is not worth a pass', () => {
  const got = worthAPass([]);
  assert.equal(got.fire, false);
  assert.match(got.because, /.+/);
});

test('a decision is worth a pass', () => {
  const got = worthAPass([{ category: 'decision', who: 'person' }]);
  assert.equal(got.fire, true);
  assert.match(got.because, /decision/i);
});

test('a failure that was then resolved is worth a pass', () => {
  const got = worthAPass([
    { category: 'failure', who: 'model' },
    { category: 'measurement', who: 'model' },
  ]);
  assert.equal(got.fire, true);
  assert.match(got.because, /failure/i);
  assert.match(got.because, /resolved|recover/i);
});

// ── THE ONE THAT IS NOT A CONVENIENCE ──────────────────────────────────────
//
// Design §12's fifth anti-learning rule, and it is the sharpest text in that
// file: an unresolved failure written up as if it worked "presents an untested
// sequence of failures as validated guidance a future session will trust and
// repeat". The rubric is the first place that rule can be enforced, because it
// is the only place that sees the stretch before anything is written about it.
test('a failure with nothing after it is NOT worth a pass', () => {
  const got = worthAPass([{ category: 'failure', who: 'model' }]);
  assert.equal(
    got.fire, false,
    'a stretch that ends in an unresolved failure is the one §12 says not to learn from',
  );
  assert.match(got.because, /unresolved|no recovery|nothing after/i);
});

// THE ONE THAT ACTUALLY PINS THE ORDER. The test below it looked like it did
// and did not: a `decision` fires on its own, so the failure branch was never
// reached and dropping the ordering left the suite green — measured here on
// 2026-09-10 by dropping it. The resolver has to be a category that does NOT
// fire alone, or the assertion is about something else.
test('a measurement BEFORE a failure does not resolve it', () => {
  const got = worthAPass([
    { category: 'measurement', who: 'model' },
    { category: 'failure', who: 'model' },
  ]);
  assert.equal(
    got.fire, false,
    'the measurement came first, so nothing recovered from the failure — a rubric that ' +
    'ignores order calls every failure in a busy stretch resolved by whatever preceded it',
  );
  assert.match(got.because, /no recovery after it/);
});

test('a failure resolved BEFORE it, and nothing after, is still unresolved', () => {
  const got = worthAPass([
    { category: 'decision', who: 'person' },
    { category: 'failure', who: 'model' },
  ]);
  // The decision fires it on its own — but the reason must not claim the
  // failure was resolved, because it was not: the decision came first.
  assert.equal(got.fire, true);
  assert.doesNotMatch(
    got.because, /resolved/i,
    'order is the whole of "then resolved"; a rubric that ignores it would call every ' +
    'failure in a busy stretch resolved by whatever happened to precede it',
  );
});

test('questions alone are not worth a pass', () => {
  const got = worthAPass([
    { category: 'question', who: 'person' },
    { category: 'question', who: 'model' },
  ]);
  assert.equal(got.fire, false);
  assert.match(got.because, /question/i);
});

test('a category this build has never heard of is counted and never fires alone', () => {
  const got = worthAPass([{ category: 'vibe', who: 'model' }]);
  assert.equal(
    got.fire, false,
    'the reader owns the category vocabulary; a category added there must not become a ' +
    'firing reason here without anybody deciding it is one',
  );
  assert.match(got.because, /vibe/, 'and the unknown category is NAMED rather than dropped');
});

test('the reason names who, because an owner correction is not a self-correction', () => {
  const owner = worthAPass([{ category: 'correction', who: 'person' }]);
  const self = worthAPass([{ category: 'correction', who: 'model' }]);
  assert.equal(owner.fire, true);
  assert.equal(self.fire, true);
  assert.notEqual(
    owner.because, self.because,
    'both fire, and the reason distinguishes them — §3b is explicit that a lane believing ' +
    'X is not the same evidence as the owner saying X',
  );
});
