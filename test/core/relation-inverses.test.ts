/**
 * **One edge, two names, and never two rows.**
 *
 * Owner ruling 2026-09-03,
 * `DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two`: asked
 * whether inverse pairs should be stored or derived, the owner answered *"do
 * it, currently there are also some pairs, we could look at the active one or
 * the passive side of a relation"*. So `enforces`/`enforced_by` and
 * `produced`/`discovered_by` are names in `RELATION_TYPES`.
 *
 * That ruling had to be reconciled with one this project already held —
 * inverses are DERIVED, not stored, because two independent rows for one fact
 * disagree the moment one is edited alone — and the decision reconciles them
 * rather than overriding either: "offering a name for the passive side is a
 * different act from storing an unmanaged second row."
 *
 * These tests hold BOTH halves at once, which is the only way either is safe:
 *
 *  1. the passive name is writable (the six are in the enum, `link_items`
 *     accepts them, every one has a meaning), and
 *  2. the second ROW is not — `linkItems` reports the mirror as already
 *     recorded and writes nothing, whichever end was written first.
 *
 * Deleting (2) to make a batch import pass would silently re-open the exact
 * duplicate the earlier ruling refused, with no test left objecting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from '../../src/core/mutate.ts';
import { linkItems, unlinkItems } from '../../src/core/relations.ts';
import {
  INVERSE_RELATIONS, RELATION_MEANINGS, RELATION_TYPES, inverseOf,
} from '../../src/core/vocabulary.ts';
import { sandbox } from '../helpers/workspace.ts';

/** The six adopted on 2026-09-03, named here so a silent removal fails. */
const ADOPTED_2026_09_03 = [
  'produced', 'discovered_by', 'unblocks', 'enforces', 'enforced_by', 'answers',
];

test('the six orphan relation types are in the vocabulary and each carries a meaning', () => {
  for (const type of ADOPTED_2026_09_03) {
    assert.ok(
      RELATION_TYPES.includes(type),
      `${type} was ruled into the vocabulary on 2026-09-03 and is missing — the eight merge ` +
      'edges that ruling unblocked cannot be written without it.',
    );
    assert.ok(
      typeof RELATION_MEANINGS[type] === 'string' && RELATION_MEANINGS[type].length > 0,
      `${type} is in RELATION_TYPES with no sentence in RELATION_MEANINGS. relationTable() ` +
      'refuses to render the workflow topic in that state, which is the guard working.',
    );
  }
});

/**
 * The name that must NOT have joined them. The owner counted nineteen and
 * `superseded_by` is the nineteenth, but it is not a relation the vocabulary
 * may gate on: excluding it from `RELATION_TYPES` is the whole of what stops
 * `link_items` stamping a retirement onto a still-active item.
 */
test('adding six names did not widen the vocabulary to superseded_by', () => {
  assert.equal(RELATION_TYPES.includes('superseded_by'), false);
  assert.equal(inverseOf('supersedes'), null);
  assert.equal(inverseOf('superseded_by'), null);
});

test('every declared inverse is symmetric and both ends are in the vocabulary', () => {
  for (const [active, passive] of Object.entries(INVERSE_RELATIONS)) {
    assert.equal(
      inverseOf(passive), active,
      `${active} declares ${passive} as its inverse and ${passive} does not point back. A ` +
      'one-way entry makes the mirror gate depend on which end the author wrote first.',
    );
    for (const name of [active, passive]) {
      assert.ok(
        RELATION_TYPES.includes(name),
        `${name} is declared in INVERSE_RELATIONS but link_items refuses it.`,
      );
    }
  }
  assert.deepEqual(Object.keys(INVERSE_RELATIONS).toSorted(), [
    'discovered_by', 'enforced_by', 'enforces', 'produced',
  ]);
});

/**
 * `conflicts_with` is its OWN inverse and is deliberately not declared. An
 * entry mapping it to itself would make the mirror gate refuse a second,
 * legitimately intended `conflicts_with` in the other direction — and the
 * vocabulary's own note is that it stores no mirror because none is needed,
 * not because one is forbidden.
 *
 * `blocks`/`unblocks` are not inverses either: `blocks` says the gate is still
 * shut and `unblocks` says it opened, so both can be true of one pair over time.
 */
test('the symmetric member and the blocks pair are not treated as inverses', () => {
  assert.equal(inverseOf('conflicts_with'), null);
  assert.equal(inverseOf('blocks'), null);
  assert.equal(inverseOf('unblocks'), null);
  assert.equal(inverseOf('derived_from'), null);
});

test('the passive side of a pair is writable, on its own', () => {
  const s = sandbox();
  const inv = createItem(s.ctx, { type: 'invariant', title: 'Markdown is the source of truth' });
  const rule = createItem(s.ctx, { type: 'rule', title: 'Never weaken byte identity' });

  const written = linkItems(s.ctx, { from: inv.id, to: rule.id, relation: 'enforced_by' });
  assert.equal(written.created, true);
  assert.deepEqual(s.ctx.store.get(inv.id)?.relations, [
    { type: 'enforced_by', target: rule.id },
  ]);
  s.dispose();
});

/**
 * THE GATE. Both orderings, because a check that only fired one way round
 * would be a rule about who typed first rather than about the corpus.
 */
for (const [first, second] of [
  ['enforces', 'enforced_by'],
  ['enforced_by', 'enforces'],
  ['produced', 'discovered_by'],
  ['discovered_by', 'produced'],
] as const) {
  test(`${second} is refused as a second row once ${first} records the same edge`, () => {
    const s = sandbox();
    const a = createItem(s.ctx, { type: 'rule', title: 'Never weaken byte identity' });
    const b = createItem(s.ctx, { type: 'invariant', title: 'Markdown is the source of truth' });

    linkItems(s.ctx, { from: a.id, to: b.id, relation: first });
    const mirror = linkItems(s.ctx, { from: b.id, to: a.id, relation: second });

    assert.equal(
      mirror.created, false,
      `${b.id} ${second} ${a.id} stored a second row for an edge ${a.id} already carries as ` +
      `${first}. That is the duplicate the derived-inverse ruling refused.`,
    );
    // Nothing written, and the message says so rather than reporting success.
    assert.deepEqual(s.ctx.store.get(b.id)?.relations, []);
    assert.deepEqual(s.ctx.store.get(a.id)?.relations, [{ type: first, target: b.id }]);
    assert.match(mirror.message, /nothing written/);
    assert.match(mirror.message, /recorded from the other end/);
    // The remedy names the row that actually exists, so a caller who meant the
    // other direction has a command rather than a puzzle.
    assert.ok(
      mirror.message.includes(`--unlink ${first} ${b.id}`),
      `the refusal must name the stored row's own unlink: ${mirror.message}`,
    );
    s.dispose();
  });
}

/**
 * The gate is about ONE edge, not about the two names. Two different pairs of
 * items may each carry their own half, and an unrelated third item is not
 * implicated by either.
 */
test('the mirror gate is per edge, not per relation name', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'rule', title: 'Never weaken byte identity' });
  const b = createItem(s.ctx, { type: 'invariant', title: 'Markdown is the source of truth' });
  const c = createItem(s.ctx, { type: 'invariant', title: 'Nothing is dropped silently' });

  linkItems(s.ctx, { from: a.id, to: b.id, relation: 'enforces' });
  const other = linkItems(s.ctx, { from: c.id, to: a.id, relation: 'enforced_by' });

  assert.equal(other.created, true);
  assert.deepEqual(s.ctx.store.get(c.id)?.relations, [{ type: 'enforced_by', target: a.id }]);
  s.dispose();
});

/**
 * The direction is CORRECTABLE, which is what makes refusing the mirror
 * acceptable rather than a trap: unlink the row that is wrong, then write the
 * one that is right. `--unlink` is the human route the refusal's own message
 * names.
 */
test('the stored direction can be swapped by removing the row first', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'lesson', title: 'Dogfooding found the missing edit path' });
  const b = createItem(s.ctx, { type: 'requirement', title: 'An item must be editable' });

  linkItems(s.ctx, { from: a.id, to: b.id, relation: 'produced' });
  assert.equal(linkItems(s.ctx, { from: b.id, to: a.id, relation: 'discovered_by' }).created, false);

  unlinkItems(s.ctx, { from: a.id, to: b.id, relation: 'produced' });
  assert.equal(linkItems(s.ctx, { from: b.id, to: a.id, relation: 'discovered_by' }).created, true);

  assert.deepEqual(s.ctx.store.get(a.id)?.relations, []);
  assert.deepEqual(s.ctx.store.get(b.id)?.relations, [{ type: 'discovered_by', target: a.id }]);
  s.dispose();
});

/**
 * An edge whose target does not exist yet is permitted by design (spec §3.2),
 * and the mirror gate must not turn that into a refusal it cannot justify:
 * there is no target to inspect, so there is no mirror to find.
 */
test('an unresolved target still links, because there is no stored mirror to find', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'rule', title: 'Never weaken byte identity' });
  const written = linkItems(s.ctx, { from: a.id, to: 'INV-not-created-yet', relation: 'enforces' });
  assert.equal(written.created, true);
  assert.match(written.message, /does not exist yet/);
  s.dispose();
});
