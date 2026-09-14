// @basis TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a, TASK-two-nonces-are-both-plain-strings-so-either-store-redeems, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The invariants of `Item` that the COMPILER now holds, and the two it still
 * does not.**
 *
 * `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a` measured
 * the starting state exactly: *"ten invariants, ten comments, zero compiler
 * guarantees."* `Item` had no `readonly` field, no factory and no freeze. This
 * file is the record of what changed, and it is written as `@ts-expect-error`
 * directives because that is the only form in which the claim can be false:
 *
 *   - A runtime test cannot assert `item.id = 'x'` is forbidden. Modules are
 *     strict mode, so the assignment would throw only if the object were
 *     FROZEN, and nothing is frozen (measured: 4.3% of corpus load time for a
 *     shallow freeze, 11.1% deep, and it breaks `applyUpdate`, `persist` and
 *     `stampSummary` outright, all three of which mutate the loader's own
 *     objects). With no freeze the assignment succeeds at run time and the
 *     guarantee lives entirely in the type.
 *   - A runtime test cannot assert that a `SummaryBasisHash` may not be written
 *     into `sourceChecksum`. Both are 16 hex characters; the write succeeds and
 *     the wrong value sits there looking exactly right. **That is the whole
 *     defect** — the second half of
 *     `TASK-two-nonces-are-both-plain-strings-so-either-store-redeems`: *"four
 *     hash kinds are mutually assignable, so a mis-stamp is silent in both
 *     directions"*.
 *
 * `@ts-expect-error` is itself an error when the line under it compiles, so
 * each directive fails in both directions, and `npm run typecheck` is what runs
 * this file. Removal proofs — each directive deleted in turn, `tsc` watched to
 * redden at that exact line — are recorded in the lane report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeItemChecksum, parseItem,
  recordedContentHashes, recordedSourceChecksum, recordedSummaryBasis,
} from '../../src/core/item.ts';
import { itemContentHash, itemSummaryBasis } from '../../src/core/content-hash.ts';
import { snapshotChecksum } from '../../src/core/reference.ts';
import type { Item } from '../../src/core/types.ts';

const TEXT = [
  '---',
  'id: RULE-fixture',
  'type: rule',
  'title: A fixture',
  'status: active',
  'severity: soft',
  'checksum: deadbeefdeadbeef',
  '---',
  '',
  '# A fixture',
  '',
  'Body.',
  '',
].join('\n');

function fixture(): Item {
  return parseItem(TEXT, 'items/rule/RULE-fixture.md', 'project');
}

/* -------------------------------------------------------------------------- *
 * 1. The four fields that are fixed at creation.
 * -------------------------------------------------------------------------- */

test('id, type, layer and filePath are readonly — four COMPILE errors', () => {
  const item = fixture();

  // @ts-expect-error -- an id is assigned once, by createItem; a rename is a new file.
  item.id = 'RULE-renamed';

  // @ts-expect-error -- `loadLayer`'s own error text says type is fixed at creation.
  item.type = 'constraint';

  // @ts-expect-error -- which root an item was loaded from is the loader's answer, not a field write.
  item.layer = 'global';

  // @ts-expect-error -- the path is what the item was read OUT of.
  item.filePath = 'items/rule/elsewhere.md';

  // The run-time half, and the reason the four above had to be compile errors:
  // nothing is frozen, so every one of those assignments would have SUCCEEDED.
  // Asserted rather than left for a reader to assume the type is backed by
  // something at run time. It is not, and it is not meant to be.
  const loose = item as unknown as Record<string, unknown>;
  loose['id'] = 'RULE-renamed';
  assert.equal(
    item.id, 'RULE-renamed',
    'not frozen: the write lands, which is exactly why the TYPE has to refuse it',
  );
  assert.equal(
    Object.isFrozen(item), false,
    'and the absence of a freeze is deliberate and measured — see the header',
  );
});

/* -------------------------------------------------------------------------- *
 * 2. The four hash kinds are four types.
 * -------------------------------------------------------------------------- */

test('no hash kind is assignable to another destination — six COMPILE errors', () => {
  const item = fixture();
  const asItem = computeItemChecksum(item);
  const asBasis = itemSummaryBasis(item);
  const asContent = itemContentHash(item);
  const asSource = snapshotChecksum('some file text');

  // @ts-expect-error -- an item checksum covers a different field set from a summary
  // basis: stored here it would read `stale` forever, with no edit able to clear it.
  item.summaryOf = asItem;

  // @ts-expect-error -- a source checksum is a hash of ANOTHER document entirely.
  item.summaryOf = asSource;

  // @ts-expect-error -- `sourceChecksum` answers "has the file this was copied from
  // moved?"; an item checksum answers that question about the wrong document.
  item.sourceChecksum = asItem;

  // @ts-expect-error -- and a summary basis is no better an answer to it.
  item.sourceChecksum = asBasis;

  // @ts-expect-error -- an acknowledgement anchor is `itemContentHash`, and a wrong
  // one fails PERMISSIVELY: it certifies a body nobody has read as one already judged.
  item.acknowledged['some_code'] = asItem;

  // @ts-expect-error -- the same, from the other side.
  item.acknowledged['some_code'] = asBasis;

  // The run-time half. Every one of those is a plain string of the same shape,
  // which is precisely why none of this could be caught anywhere but the type.
  for (const [name, value] of Object.entries({ asItem, asBasis, asContent, asSource })) {
    assert.equal(typeof value, 'string', `${name} is a primitive string at run time`);
  }
  assert.match(asContent, /^[0-9a-f]{16}$/, 'an item content hash is 16 hex characters');
  assert.match(asBasis, /^[0-9a-f]{16}$/, 'and so is a summary basis — indistinguishable by eye');
  assert.match(asSource, /^[0-9a-f]{16}$/, 'and so is a source checksum');
});

test('an unbranded string cannot reach a branded hash field — three COMPILE errors', () => {
  const item = fixture();

  // @ts-expect-error -- the door is `recordedSummaryBasis`, and there is no other way in.
  item.summaryOf = 'deadbeefdeadbeef';

  // @ts-expect-error -- the door is `recordedSourceChecksum`.
  item.sourceChecksum = 'deadbeefdeadbeef';

  // @ts-expect-error -- the door is `recordedContentHashes`.
  item.acknowledged['some_code'] = 'deadbeefdeadbeef';

  // Through the doors the same values are accepted and unchanged — the brands
  // are types, not validators, and a corpus full of hand-written frontmatter
  // depends on that (`INV-markdown-is-the-source-of-truth`).
  item.summaryOf = recordedSummaryBasis('deadbeefdeadbeef');
  item.sourceChecksum = recordedSourceChecksum('deadbeefdeadbeef');
  item.acknowledged = recordedContentHashes({ some_code: 'deadbeefdeadbeef' });
  assert.equal(item.summaryOf, 'deadbeefdeadbeef', 'a door changes the type and never the value');
  assert.equal(item.sourceChecksum, 'deadbeefdeadbeef');
  assert.equal(item.acknowledged['some_code'], 'deadbeefdeadbeef');

  // And `null` stays `null` through a door rather than becoming a hash of
  // nothing — the overloads exist for exactly this, because `summaryOf: null`
  // is the state of every item in every corpus that carries no summary.
  assert.equal(recordedSummaryBasis(null), null);
  assert.equal(recordedSourceChecksum(null), null);
});

/* -------------------------------------------------------------------------- *
 * 3. What is NOT held, said out loud.
 * -------------------------------------------------------------------------- */

/**
 * **The twelfth pairing, and it is open.** `Item.checksum` is still declared
 * `string`, so a hash of another kind can be written into it. The brand exists
 * and `computeItemChecksum` returns it — which is what makes the six errors
 * above possible — but branding the FIELD was measured at 77 assignment sites
 * across 61 test files, and that is a migration rather than an edit.
 *
 * This test is GREEN, and it is green because the defect is still there. It is
 * here so that the gap is a recorded fact with a test name on it, rather than a
 * sentence in a report nobody re-reads.
 */
test('OPEN: Item.checksum still accepts any string, and this test says so', () => {
  const item = fixture();
  const basis = itemSummaryBasis(item);

  // No `@ts-expect-error`: this COMPILES, and that is the finding. The day
  // somebody brands `Item.checksum`, this line turns red, and this test is what
  // tells them the work is finished.
  item.checksum = basis;
  assert.equal(
    item.checksum, basis,
    'a summary basis sitting in the checksum field — accepted by the compiler today',
  );

  // And what the window named in
  // `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a` actually
  // looks like, made concrete: the recorded checksum now describes content the
  // item no longer has, and the value is a live, valid, fully-typed `Item` that
  // every function in this product will accept.
  const stale = item.checksum;
  item.body = 'A completely different body.';
  assert.equal(item.checksum, stale, 'nothing re-stamped it');
  assert.notEqual(
    computeItemChecksum(item), item.checksum,
    'the stale-checksum window: no type closes it, because it is a timing property',
  );
});
