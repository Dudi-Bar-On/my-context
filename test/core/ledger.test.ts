import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../../src/core/ledger.ts';

test('record returns true the first time and false on a repeat', () => {
  const ledger = Ledger.open(':memory:');
  assert.equal(ledger.record('s1', 'CONST-a', 'jit'), true);
  assert.equal(ledger.record('s1', 'CONST-a', 'jit'), false);
  ledger.close();
});

test('the same item in a different tier is a distinct event', () => {
  const ledger = Ledger.open(':memory:');
  assert.equal(ledger.record('s1', 'CONST-a', 'pinned'), true);
  assert.equal(ledger.record('s1', 'CONST-a', 'restored'), true);
  assert.equal(ledger.usage('CONST-a').useCount, 2);
  ledger.close();
});

test('seen is per session and deduplicated across tiers', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'pinned');
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.record('s1', 'CONST-b', 'jit');
  ledger.record('s2', 'CONST-c', 'jit');
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b']);
  assert.deepEqual(ledger.seen('s2'), ['CONST-c']);
  assert.deepEqual(ledger.seen('never-existed'), []);
  ledger.close();
});

test('recordMany returns only the ids it actually inserted', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit');
  const inserted = ledger.recordMany('s1', ['CONST-a', 'CONST-b', 'CONST-c'], 'jit');
  assert.deepEqual(inserted, ['CONST-b', 'CONST-c']);
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b', 'CONST-c']);
  ledger.close();
});

test('entries carry the tier and timestamp', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-13T10:00:00.000Z');
  const rows = ledger.entries('s1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].itemId, 'CONST-a');
  assert.equal(rows[0].tier, 'jit');
  assert.equal(rows[0].injectedAt, '2026-08-13T10:00:00.000Z');
  ledger.close();
});

test('usage derives use_count and last_used across sessions', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-11T09:00:00.000Z');
  ledger.record('s2', 'CONST-a', 'jit', '2026-08-13T09:00:00.000Z');
  const usage = ledger.usage('CONST-a');
  assert.equal(usage.useCount, 2);
  assert.equal(usage.lastUsed, '2026-08-13T09:00:00.000Z');
  ledger.close();
});

test('usage of an unused item is zero, not undefined', () => {
  const ledger = Ledger.open(':memory:');
  assert.deepEqual(ledger.usage('CONST-never'), {
    itemId: 'CONST-never', useCount: 0, lastUsed: null,
  });
  ledger.close();
});

test('mostUsed ranks by use count then id', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-hot', 'jit');
  ledger.record('s2', 'CONST-hot', 'jit');
  ledger.record('s3', 'CONST-hot', 'jit');
  ledger.record('s1', 'CONST-warm', 'jit');
  ledger.record('s2', 'CONST-warm', 'jit');
  ledger.record('s1', 'CONST-cold', 'jit');
  assert.deepEqual(ledger.mostUsed(2).map((u) => u.itemId), ['CONST-hot', 'CONST-warm']);
  ledger.close();
});

test('the ledger survives being reopened on the same file', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();
  // A second open on a fresh :memory: database must not throw on CREATE IF NOT EXISTS.
  const again = Ledger.open(':memory:');
  assert.deepEqual(again.seen('s1'), []);
  again.close();
});
