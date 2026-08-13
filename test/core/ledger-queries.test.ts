import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../../src/core/ledger.ts';

function seeded(): Ledger {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-10T10:00:00.000Z');
  ledger.record('s2', 'CONST-a', 'jit', '2026-08-11T10:00:00.000Z');
  ledger.record('s2', 'CONST-b', 'pinned', '2026-08-11T10:00:01.000Z');
  ledger.record('s3', 'CONST-c', 'jit', '2026-08-12T10:00:00.000Z');
  return ledger;
}

test('allUsage returns one row per item with counts and last use', () => {
  const ledger = seeded();
  const rows = ledger.allUsage().sort((a, b) => a.itemId.localeCompare(b.itemId));
  assert.deepEqual(rows.map((r) => r.itemId), ['CONST-a', 'CONST-b', 'CONST-c']);
  assert.equal(rows[0].useCount, 2);
  assert.equal(rows[0].lastUsed, '2026-08-11T10:00:00.000Z');
  ledger.close();
});

test('allUsage omits items that were never injected', () => {
  const ledger = seeded();
  assert.equal(ledger.allUsage().some((r) => r.itemId === 'CONST-never'), false);
  ledger.close();
});

test('allUsage agrees with usage() on the same data', () => {
  const ledger = seeded();
  for (const row of ledger.allUsage()) {
    assert.deepEqual(ledger.usage(row.itemId), row);
  }
  ledger.close();
});

test('recentSessions returns distinct sessions newest first', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.recentSessions(2), ['s3', 's2']);
  assert.deepEqual(ledger.recentSessions(10), ['s3', 's2', 's1']);
  ledger.close();
});

test('recentSessions breaks ties deterministically on same timestamp', () => {
  const ledger = Ledger.open(':memory:');
  // s-b and s-a both have their latest event at the exact same instant.
  ledger.record('s-a', 'CONST-a', 'jit', '2026-08-10T10:00:00.000Z');
  ledger.record('s-b', 'CONST-b', 'jit', '2026-08-10T10:00:00.000Z');
  const first = ledger.recentSessions(2);
  const second = ledger.recentSessions(2);
  assert.deepEqual(first, second);
  assert.deepEqual(first, ['s-b', 's-a']);
  ledger.close();
});

test('recentSessions(0) and negative limits return nothing', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.recentSessions(0), []);
  assert.deepEqual(ledger.recentSessions(-5), []);
  ledger.close();
});

test('itemsUsedIn returns distinct ids across the given sessions', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.itemsUsedIn(['s2', 's3']).sort(), ['CONST-a', 'CONST-b', 'CONST-c']);
  assert.deepEqual(ledger.itemsUsedIn([]), []);
  ledger.close();
});

test('itemsUsedIn ignores unknown session ids without throwing', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.itemsUsedIn(['nope']), []);
  ledger.close();
});

test('sessionCount counts distinct sessions', () => {
  const ledger = seeded();
  assert.equal(ledger.sessionCount(), 3);
  ledger.close();
});

test('an empty ledger answers every query without throwing', () => {
  const ledger = Ledger.open(':memory:');
  assert.deepEqual(ledger.allUsage(), []);
  assert.deepEqual(ledger.recentSessions(5), []);
  assert.deepEqual(ledger.itemsUsedIn(['nope']), []);
  assert.equal(ledger.sessionCount(), 0);
  ledger.close();
});
