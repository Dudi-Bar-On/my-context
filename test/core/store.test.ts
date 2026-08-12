import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';

function makeItem(id: string, type = 'constraint', status = 'active') {
  return parseItem(
    `---\nid: ${id}\ntype: ${type}\ntitle: ${id} title\nstatus: ${status}\n---\n\n# ${id} title\n`,
    `items/${type}/${id}.md`,
    'project',
  );
}

test('upsert then get round-trips an item', () => {
  const store = Store.open(':memory:');
  const item = makeItem('CONST-a');
  store.upsert(item);
  assert.deepEqual(store.get('CONST-a'), item);
  store.close();
});

test('upsert is idempotent on id', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a'));
  store.upsert(makeItem('CONST-a'));
  assert.equal(store.all().length, 1);
  store.close();
});

test('upsert replaces the previous row', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a', 'constraint', 'active'));
  store.upsert(makeItem('CONST-a', 'constraint', 'deprecated'));
  assert.equal(store.get('CONST-a')?.status, 'deprecated');
  store.close();
});

test('get returns null for an unknown id', () => {
  const store = Store.open(':memory:');
  assert.equal(store.get('nope'), null);
  store.close();
});

test('deleteByLayer removes only that layer', () => {
  const store = Store.open(':memory:');
  const projectItem = makeItem('CONST-a');
  const globalItem = { ...makeItem('CONST-b'), layer: 'global' as const };
  store.upsert(projectItem);
  store.upsert(globalItem);
  store.deleteByLayer('project');
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-b']);
  store.close();
});

test('all returns items sorted by id for determinism', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-b'));
  store.upsert(makeItem('CONST-a'));
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-a', 'CONST-b']);
  store.close();
});

test('opening a file-backed database twice preserves items', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    // Open, upsert, close
    const store1 = Store.open(dbPath);
    store1.upsert(makeItem('CONST-a'));
    store1.close();

    // Open again, verify items preserved
    const store2 = Store.open(dbPath);
    assert.deepEqual(store2.all().map((i) => i.id), ['CONST-a']);
    store2.close();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('a database whose stored version is older has its items cleared and version updated', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    // Create database with version 1
    const store1 = Store.open(dbPath);
    store1.upsert(makeItem('CONST-a'));
    store1.close();

    // Manually downgrade schema version in the database
    const db = new DatabaseSync(dbPath);
    db.prepare('UPDATE schema_version SET version = 0').run();
    db.close();

    // Now open with the current Store code - it should clear items and update version
    const store3 = Store.open(dbPath);
    assert.equal(store3.all().length, 0, 'Items should be cleared for old schema');
    store3.close();

    // Verify version is updated by opening again without error
    const store4 = Store.open(dbPath);
    store4.close();
    // If we get here without error, the version was properly updated
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('a database whose stored version is newer causes Store.open to throw', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    // Create database with current version
    const store1 = Store.open(dbPath);
    store1.close();

    // Manually upgrade schema version
    const db = new DatabaseSync(dbPath);
    db.prepare('UPDATE schema_version SET version = 999').run();
    db.close();

    // Attempting to open should throw
    assert.throws(
      () => Store.open(dbPath),
      (err: Error) => {
        assert(err.message.includes('my_context:'), 'Error should have my_context prefix');
        assert(err.message.includes('999'), 'Error should name the newer version');
        assert(err.message.includes('1'), 'Error should name this code\'s version');
        return true;
      }
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('close() called twice does not throw', () => {
  const store = Store.open(':memory:');
  store.close();
  // Should not throw
  store.close();
});
