import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ledger } from '../../src/core/ledger.ts';

/**
 * `rmSync` on Windows can transiently EPERM right after a SQLite WAL/SHM
 * sidecar file is closed — the OS hasn't released its handle yet. A few
 * short synchronous retries clear it without slowing down the common case
 * (an unlocked path removes on the first try, no wait incurred).
 */
function rmSyncRetrying(target: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 5 || (err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 20);
    }
  }
}

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

test('mostUsed ties on use count and breaks the tie by id', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-b', 'jit');
  ledger.record('s1', 'CONST-a', 'jit');
  assert.deepEqual(ledger.mostUsed(2).map((u) => u.itemId), ['CONST-a', 'CONST-b']);
  ledger.close();
});

test('the ledger survives being reopened on the same file', () => {
  // `:memory:` databases are independent per open — reopening one never
  // exercises reopen safety at all, since the second open can't see the
  // first's state. This must be a genuine file-backed database.
  const tmpDir = join(tmpdir(), `ledger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'ledger.db');
  try {
    const ledger = Ledger.open(dbPath);
    ledger.record('s1', 'CONST-a', 'jit');
    ledger.close();
    // A second open on the same file must not throw on CREATE IF NOT EXISTS,
    // and must see the entry the first handle wrote.
    const again = Ledger.open(dbPath);
    assert.deepEqual(again.seen('s1'), ['CONST-a']);
    assert.equal(again.entries('s1').length, 1);
    again.close();
  } finally {
    rmSyncRetrying(tmpDir);
  }
});

test('a failed schema init closes the handle rather than leaking it', () => {
  // A file that isn't a valid SQLite database opens fine (DatabaseSync's
  // constructor only opens the file) but fails on the first `exec` with
  // SQLITE_NOTADB. If Ledger.open doesn't close the handle on that failure,
  // the OS keeps the file locked and removing the temp directory afterwards
  // fails on Windows — that failure is the leak detector.
  const tmpDir = join(tmpdir(), `ledger-leak-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'not-a-database.db');
  writeFileSync(dbPath, 'this is not a sqlite file');
  try {
    assert.throws(() => Ledger.open(dbPath));
    // If the handle leaked, this throws EPERM/EBUSY on Windows.
    rmSync(tmpDir, { recursive: true, force: true });
  } finally {
    rmSyncRetrying(tmpDir);
  }
});
