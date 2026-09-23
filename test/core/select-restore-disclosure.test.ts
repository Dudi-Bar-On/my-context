// @basis TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import type { Focus } from '../../src/core/focus.ts';
import { select, type Spill } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * **The restore tier says why a snapshot id did not come back** —
 * `TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where`, which is
 * `INV-nothing-is-dropped-silently` at the one moment a session has just lost
 * its window and is least able to notice an absence.
 *
 * The other half of the same mechanism — the cross-session carry — already
 * names every id it drops, and `test/core/carried-index.test.ts` holds those
 * five reasons. This file asserts the SAME five strings on the restore tier,
 * because the requirement is one vocabulary and not two: the reasons come from
 * `carriedDropReason` itself, so a reword there moves both surfaces at once and
 * a test that spelled its own wording would hide the day they diverged.
 *
 * The channel is `Selection.spilled` at `tier: 'restored'` — the tier's own
 * existing spill channel, which the injected block, `--json` and the audit
 * projection already read. A second channel would need a second reader on every
 * surface, and the budget half of this tier's drops already arrives this way.
 */

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function focus(over: Partial<Focus> = {}): Focus {
  return {
    tags: [], categories: [], scope: [], setAt: '2026-09-15T00:00:00.000Z', setBy: 'human',
    ...over,
  };
}

/** The restore tier's own records, which is all these assertions are about. */
function restored(spilled: Spill[]): { id: string; reason: string }[] {
  return spilled.filter((s) => s.tier === 'restored').map((s) => ({ id: s.id, reason: s.reason }));
}

test('a snapshot id nothing knows is disclosed with "unknown id"', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a', 'CONST-deleted-since'] },
    CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  assert.deepEqual(restored(sel.spilled), [{ id: 'CONST-deleted-since', reason: 'unknown id' }]);
});

test('a snapshot id that is now superseded is disclosed with "no longer eligible"', () => {
  const sel = select(
    [item({ id: 'CONST-old', status: 'superseded' })],
    { event: 'compact', restore: ['CONST-old'] },
    CONFIG,
  );

  assert.deepEqual(sel.full, []);
  assert.deepEqual(restored(sel.spilled), [{ id: 'CONST-old', reason: 'no longer eligible' }]);
});

test('a snapshot id whose category is now disabled is disclosed with "no longer eligible" too', () => {
  const config = resolveConfig({ categories: { constraint: { enabled: false } } });
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a'] },
    config,
  );

  assert.deepEqual(sel.full, []);
  assert.deepEqual(restored(sel.spilled), [{ id: 'CONST-a', reason: 'no longer eligible' }]);
});

test('a snapshot id on a rationale category is disclosed with "not a normative category"', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'compact', restore: ['LESSON-a'] },
    CONFIG,
  );

  assert.deepEqual(sel.full, []);
  assert.deepEqual(restored(sel.spilled),
    [{ id: 'LESSON-a', reason: 'not a normative category' }]);
});

test('a snapshot id the active focus hides is disclosed as hidden, never as ineligible', () => {
  const sel = select(
    [item({ id: 'CONST-a', tags: ['billing'] }), item({ id: 'CONST-b', tags: ['shipping'] })],
    { event: 'compact', restore: ['CONST-a', 'CONST-b'], focus: focus({ tags: ['billing'] }) },
    CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  // The item is live, normative and eligible — calling it "no longer eligible"
  // would be a false label on an item the reader can still fetch.
  assert.deepEqual(restored(sel.spilled),
    [{ id: 'CONST-b', reason: 'hidden by the active focus' }]);
});

test('a snapshot id the seen gate suppresses is disclosed, not swallowed', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a'], seen: ['CONST-a'] },
    CONFIG,
  );

  assert.deepEqual(sel.full, []);
  assert.deepEqual(restored(sel.spilled),
    [{ id: 'CONST-a', reason: 'delivered in full this session' }]);
});

test('a snapshot id another tier already delivered is NOT reported as dropped', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true })],
    { event: 'compact', restore: ['CONST-pinned'] },
    CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.full[0].tier, 'pinned');
  // It arrived. A spill record would say the reader did not get it.
  assert.deepEqual(restored(sel.spilled), []);
});

test('an admitted snapshot id records nothing at all', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a'] },
    CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  assert.deepEqual(sel.spilled, []);
});

test('an id over the restored budget keeps the budget reason and is disclosed once', () => {
  const big = 'x'.repeat(4000); // ~1000 estimated tokens each
  const cfg = resolveConfig({ budgets: { restored: 1200 } });
  const sel = select(
    [
      item({ id: 'CONST-soft', severity: 'soft', body: big }),
      item({ id: 'CONST-hard', severity: 'hard', body: big }),
    ],
    { event: 'compact', restore: ['CONST-soft', 'CONST-hard'] },
    cfg,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  const records = restored(sel.spilled);
  assert.equal(records.length, 1, 'one record, not a budget record plus a candidacy record');
  assert.equal(records[0].id, 'CONST-soft');
  assert.match(records[0].reason, /^budget exceeded \(/);
});

/**
 * The contract, stated as the identity the carry tier states for itself:
 * `shown + dropped.length === carried.ids.length`. Here it is
 * *delivered + disclosed === the snapshot*, and an id that is neither is
 * exactly the silent drop this item closes.
 */
test('every snapshot id either arrives in full or is named at tier restored', () => {
  const config = resolveConfig({ categories: { reference: { enabled: false } } });
  const snapshot = [
    'CONST-admitted', 'CONST-pinned', 'CONST-superseded', 'LESSON-rationale',
    'REF-disabled', 'CONST-hidden', 'CONST-vanished',
  ];
  const sel = select(
    [
      item({ id: 'CONST-admitted', tags: ['billing'] }),
      item({ id: 'CONST-pinned', always: true, tags: ['billing'] }),
      item({ id: 'CONST-superseded', status: 'superseded', tags: ['billing'] }),
      item({ id: 'LESSON-rationale', type: 'lesson', tags: ['billing'] }),
      item({ id: 'REF-disabled', type: 'reference', tags: ['billing'] }),
      item({ id: 'CONST-hidden', tags: ['shipping'] }),
    ],
    { event: 'compact', restore: snapshot, focus: focus({ tags: ['billing'] }) },
    config,
  );

  const delivered = new Set(sel.full.map((e) => e.item.id));
  const disclosed = new Set(restored(sel.spilled).map((r) => r.id));
  for (const id of snapshot) {
    assert.ok(delivered.has(id) || disclosed.has(id), `${id} was dropped with no word said`);
    assert.ok(!(delivered.has(id) && disclosed.has(id)),
      `${id} is reported both delivered and dropped`);
  }
  assert.equal(delivered.size + disclosed.size, snapshot.length);
});

test('the disclosure is sorted by id, so two runs of one snapshot read the same', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-z-gone', 'CONST-a', 'CONST-b-gone'] },
    CONFIG,
  );

  assert.deepEqual(restored(sel.spilled).map((r) => r.id), ['CONST-b-gone', 'CONST-z-gone']);
});

test('a session start records nothing: the restore tier did not run', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'session-start', restore: ['CONST-a', 'CONST-gone'] },
    CONFIG,
  );

  assert.deepEqual(restored(sel.spilled), []);
});

test('a tool event records nothing either', () => {
  const sel = select(
    [item({ id: 'CONST-a', scope: ['src/api/**'] })],
    { event: 'tool', path: 'src/db/writer.ts', restore: ['CONST-a', 'CONST-gone'] },
    CONFIG,
  );

  assert.deepEqual(restored(sel.spilled), []);
});
