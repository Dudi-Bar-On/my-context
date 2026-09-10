// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// INV-a-validator-that-gates-writes-must-be-a-complete
//
// The trust boundary of `plan:loop seq:3`, and it is asserted on the WRITE
// PATH rather than on the pass, because the pass is not what guarantees it:
// `createItem` is. Everything the review loop is allowed to do to this corpus
// goes through these three functions, so a future surface that forgets the
// rule still cannot break it.
//
// **The rationale-tier case is the one that matters.** `trustedStatus` forces
// a non-human capture to `draft` only for the NORMATIVE tier — which would
// have left `lesson`, the pass's least-preferred artifact (design §4), as the
// one output landing `active` with nobody's approval. That inversion is what
// the loop over four categories below is for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { trustedStatus } from '../../src/core/trust.ts';
import { sandbox } from '../helpers/workspace.ts';

test('origin review cannot produce anything but a draft, on any tier', () => {
  const s = sandbox();
  // Two normative (`rule`, `constraint`) and two rationale (`lesson`,
  // `decision`) — read off the shipped catalogue rather than assumed, so this
  // test fails loudly if a tier is ever re-classified.
  for (const category of ['lesson', 'rule', 'decision', 'constraint']) {
    const made = createItem(s.ctx, {
      type: category,
      title: `A ${category} from the pass`,
      summary: 'A one sentence summary.',
      body: 'Body.',
      scope: ['src/**'],
      origin: 'review',
      status: 'active',
    });
    const item = s.ctx.store.get(made.id);
    assert.equal(item?.status, 'draft', `${category} must land as draft`);
    assert.equal(item?.origin, 'review');
  }
  s.dispose();
});

test('trustedStatus refuses review before it consults the tier', () => {
  // The unit under the test above, isolated: the rationale tier is where
  // `origin !== human && tier === normative` says yes and this rule says no.
  assert.equal(trustedStatus('review', 'rationale', 'active'), 'draft');
  assert.equal(trustedStatus('review', 'normative', 'active'), 'draft');
  // And the widening is EXACTLY one origin — an agent's rationale capture is
  // still `active`, which is the behaviour 1,076 items in this corpus rest on.
  assert.equal(trustedStatus('agent', 'rationale', 'active'), 'active');
});

test('update_item is refused outright for origin review', () => {
  const s = sandbox();
  const existing = createItem(s.ctx, {
    type: 'lesson', title: 'An existing lesson', body: 'Body.',
  });
  assert.throws(
    () => updateItem(s.ctx, { id: existing.id, title: 'edited', origin: 'review' }),
    /propose|never edits|cannot edit/i,
    'the pass proposes; it never edits — and the refusal must say so',
  );
  // Nothing was changed, which is the half of the promise a thrown error does
  // not make on its own.
  assert.equal(s.ctx.store.get(existing.id)?.title, 'An existing lesson');
  s.dispose();
});

test('supersede_item is refused for origin review even on a draft', () => {
  const s = sandbox();
  // A DRAFT deliberately: `governsNormatively` would let every other non-human
  // origin retire this one, so a green here proves the review refusal is its
  // own gate rather than the existing one firing.
  const old = createItem(s.ctx, {
    type: 'lesson', title: 'The older lesson', body: 'Body.', origin: 'agent', status: 'draft',
  });
  const replacement = createItem(s.ctx, {
    type: 'lesson', title: 'The newer lesson', body: 'Body two.', origin: 'agent',
  });
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: replacement.id, origin: 'review' }),
    /propose|never edits|cannot supersede/i,
  );
  assert.equal(s.ctx.store.get(old.id)?.status, 'draft');
  s.dispose();
});
