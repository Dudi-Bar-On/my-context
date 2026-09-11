// @basis TASK-retire-on-evidence-and-bound-the-corpus
/**
 * **What this rests on.**
 *
 * The item above says the corpus is bounded — *something must fall out when
 * something new comes in* — and the plan's own reading of §9 says the cap
 * applies to `origin: 'review'` items only, *"which is defensible, since the
 * human-authored corpus is not what the loop can inflate"*.
 *
 * So the three properties asserted here are: what the cap counts, what it
 * names when it is exceeded, and the order it names them in. The NUMBER is
 * not asserted anywhere, because this build derives none — see
 * `test/core/retire-gate.test.ts`, which asserts that it refuses to.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overCap } from '../../src/core/retire.ts';
import type { Contribution } from '../../src/core/contribution.ts';
import type { Item } from '../../src/core/types.ts';

const NOW = Date.parse('2026-09-11T00:00:00.000Z');

function item(id: string, origin: string, validFrom: string | null = '2026-07-01'): Item {
  return {
    id, origin, validFrom, type: 'rule', status: 'active', always: false,
  } as unknown as Item;
}

function got(counts: Record<string, number>): Map<string, Contribution> {
  return new Map(Object.entries(counts).map(([id, n]) => [id, {
    id, delivered: n, spilled: 0, tiers: [], firstAt: null, lastAt: null,
  }]));
}

test('at or under the cap nothing falls out', () => {
  const items = [item('L-1', 'review'), item('L-2', 'review')];
  assert.deepEqual(overCap(items, got({ 'L-1': 0, 'L-2': 0 }), 2, NOW), []);
  assert.deepEqual(overCap(items, got({ 'L-1': 0, 'L-2': 0 }), 3, NOW), []);
});

test('over the cap, the least-delivered fall out and exactly the overflow is named', () => {
  const items = [item('L-1', 'review'), item('L-2', 'review'), item('L-3', 'review')];
  const out = overCap(items, got({ 'L-1': 9, 'L-2': 1, 'L-3': 5 }), 1, NOW);
  assert.deepEqual(
    out.map((c) => c.id), ['L-2', 'L-3'],
    'two over a cap of one is two candidates, least delivered first',
  );
  assert.match(out[0]!.why, /cap of 1/, 'the reason names the bound that produced it');
  assert.equal(out[0]!.action, 'deprecate', 'a cap deprecates; nothing here deletes');
});

test('human-authored items are not counted against the cap at all', () => {
  // Not "not retired" — not COUNTED. A cap that counted them would make the
  // number of items a person wrote the reason an agent's draft was stood down.
  const items = [
    item('RULE-h1', 'human'), item('RULE-h2', 'human'), item('RULE-h3', 'human'),
    item('L-1', 'review'),
  ];
  assert.deepEqual(
    overCap(items, got({ 'L-1': 0 }), 2, NOW), [],
    'four items against a cap of two, and nothing falls out, because only one is countable',
  );
});

test('among equal counts the oldest falls out first, and an undated item falls out last', () => {
  const items = [
    item('L-new', 'review', '2026-09-01'),
    item('L-old', 'review', '2026-07-01'),
    item('L-undated', 'review', null),
  ];
  assert.deepEqual(
    overCap(items, got({}), 1, NOW).map((c) => c.id), ['L-old', 'L-new'],
    'equal delivery counts are the normal case in a young cohort, so the tie-break is the rule '
    + 'rather than an implementation detail',
  );
  assert.deepEqual(
    overCap(items, got({}), 2, NOW).map((c) => c.id), ['L-old'],
    'and an item whose age cannot be read is the last to be chosen, never the first',
  );
});

test('the candidate carries the count that put it there', () => {
  const items = [item('L-1', 'review'), item('L-2', 'review')];
  const out = overCap(items, got({ 'L-1': 3, 'L-2': 7 }), 1, NOW);
  assert.equal(out[0]!.delivered, 3);
  assert.equal(out[0]!.ageDays, 72);
});
