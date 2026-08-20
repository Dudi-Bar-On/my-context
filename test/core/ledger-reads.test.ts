import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

function open(): { ledger: Ledger; dir: string; close: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ledger-'));
  const dbPath = path.join(dir, '.index.db');
  const store = Store.open(dbPath); // Ledger.open relies on Store.open first — see its docblock.
  const ledger = Ledger.open(dbPath);
  return { ledger, dir, close: () => { ledger.close(); store.close(); } };
}

test('history() returns every row in a total, repeatable order', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    assert.deepEqual(ledger.history(), [
      { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', injectedAt: '2026-08-01T10:00:00.000Z' },
      { sessionId: 's1', itemId: 'RULE-b', tier: 'jit', injectedAt: '2026-08-01T11:00:00.000Z' },
      { sessionId: 's2', itemId: 'RULE-a', tier: 'jit', injectedAt: '2026-08-02T10:00:00.000Z' },
    ]);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries agrees with recentSessions on order, and carries last time and item count', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    const summaries = ledger.sessionSummaries(20);
    assert.deepEqual(summaries.map((s) => s.sessionId), ledger.recentSessions(20));
    assert.deepEqual(summaries, [
      { sessionId: 's2', lastInjectedAt: '2026-08-02T10:00:00.000Z', itemCount: 1 },
      { sessionId: 's1', lastInjectedAt: '2026-08-01T11:00:00.000Z', itemCount: 2 },
    ]);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries(0) and an empty ledger both answer []', () => {
  const { ledger, dir, close } = open();
  try {
    assert.deepEqual(ledger.sessionSummaries(0), []);
    assert.deepEqual(ledger.sessionSummaries(5), []);
    assert.deepEqual(ledger.history(), []);
  } finally { close(); removeTree(dir); }
});

test('history() breaks an injected_at tie on session_id then item_id, repeatably', () => {
  const { ledger, dir, close } = open();
  try {
    const at = '2026-08-01T10:00:00.000Z';
    ledger.record('s2', 'RULE-b', 'jit', at);
    ledger.record('s1', 'RULE-b', 'jit', at);
    ledger.record('s2', 'RULE-a', 'jit', at);
    ledger.record('s1', 'RULE-a', 'jit', at);
    const first = ledger.history().map((e) => `${e.sessionId}/${e.itemId}`);
    assert.deepEqual(first, ['s1/RULE-a', 's1/RULE-b', 's2/RULE-a', 's2/RULE-b']);
    assert.deepEqual(ledger.history().map((e) => `${e.sessionId}/${e.itemId}`), first);
  } finally { close(); removeTree(dir); }
});

/**
 * `history()` is a MIRROR of the table, not a filtered view of it: every tier
 * comes back, and what the table collides (a repeat inside one
 * `(session, item, tier)`) is one row here too — which is why the docblock
 * says first-injections rather than event stream, and why a caller must not
 * read this as one entry per delivery.
 */
test('history() carries every tier, and shows the collision the schema makes', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-a', 'jit', '2026-08-01T10:00:01.000Z');
    ledger.recordRestored('s1', ['RULE-a'], '2026-08-01T10:00:02.000Z');
    // A repeat of an already-recorded (session, item, tier) adds no row.
    ledger.record('s1', 'RULE-a', 'jit', '2026-08-01T23:59:59.000Z');
    // `recordRestored` refreshes in place rather than adding a row.
    ledger.recordRestored('s1', ['RULE-a'], '2026-08-02T09:00:00.000Z');
    assert.deepEqual(ledger.history(), [
      { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', injectedAt: '2026-08-01T10:00:00.000Z' },
      { sessionId: 's1', itemId: 'RULE-a', tier: 'jit', injectedAt: '2026-08-01T10:00:01.000Z' },
      { sessionId: 's1', itemId: 'RULE-a', tier: 'restored', injectedAt: '2026-08-02T09:00:00.000Z' },
    ]);
  } finally { close(); removeTree(dir); }
});

/** The one row per session that `entries()` already returns must agree here. */
test('history() filtered to one session agrees with entries() on that session', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    for (const sessionId of ['s1', 's2']) {
      assert.deepEqual(
        ledger.history().filter((e) => e.sessionId === sessionId)
          .map(({ itemId, tier, injectedAt }) => ({ itemId, tier, injectedAt })),
        ledger.entries(sessionId),
      );
    }
  } finally { close(); removeTree(dir); }
});

/**
 * The count `sessionSummaries` reports is DISTINCT ITEMS, not rows: one item
 * delivered in two tiers within a session is one item. Pinned because the
 * difference is invisible in the field name, and a count that quietly meant
 * something else would make the audit log lie.
 */
test('sessionSummaries itemCount counts distinct items, not ledger rows', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-a', 'jit', '2026-08-01T10:00:01.000Z');
    ledger.recordRestored('s1', ['RULE-a'], '2026-08-01T10:00:02.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T10:00:03.000Z');
    assert.equal(ledger.history().filter((e) => e.sessionId === 's1').length, 4);
    assert.deepEqual(ledger.sessionSummaries(5), [
      { sessionId: 's1', lastInjectedAt: '2026-08-01T10:00:03.000Z', itemCount: 2 },
    ]);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries rejects a negative limit exactly as recentSessions does', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'jit', '2026-08-01T10:00:00.000Z');
    assert.deepEqual(ledger.sessionSummaries(-5), []);
    assert.deepEqual(ledger.recentSessions(-5), []);
  } finally { close(); removeTree(dir); }
});

/**
 * `limit` truncates and the result says nothing about what it left out —
 * `sessionCount()` is the disclosure, and this pins that the two agree so a
 * caller can always tell a full window from a truncated one.
 */
test('sessionSummaries truncates at limit, and sessionCount() still reports the whole', () => {
  const { ledger, dir, close } = open();
  try {
    for (let i = 0; i < 5; i++) {
      ledger.record(`s${i}`, 'RULE-a', 'jit', `2026-08-0${i + 1}T10:00:00.000Z`);
    }
    const window = ledger.sessionSummaries(2);
    assert.deepEqual(window.map((s) => s.sessionId), ['s4', 's3']);
    assert.deepEqual(window.map((s) => s.sessionId), ledger.recentSessions(2));
    assert.equal(ledger.sessionCount(), 5);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries agrees with recentSessions when timestamps tie', () => {
  const { ledger, dir, close } = open();
  try {
    const at = '2026-08-01T10:00:00.000Z';
    ledger.record('s-a', 'RULE-a', 'jit', at);
    ledger.record('s-b', 'RULE-b', 'jit', at);
    assert.deepEqual(ledger.sessionSummaries(5).map((s) => s.sessionId), ['s-b', 's-a']);
    assert.deepEqual(ledger.sessionSummaries(5).map((s) => s.sessionId), ledger.recentSessions(5));
  } finally { close(); removeTree(dir); }
});
