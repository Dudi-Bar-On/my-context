import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';

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
    rmSyncRetrying(tmpDir);
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
    rmSyncRetrying(tmpDir);
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
    rmSyncRetrying(tmpDir);
  }
});

test('a corrupt database file is deleted and reopened fresh rather than left broken forever', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    writeFileSync(dbPath, 'not a sqlite database at all');
    // Spec §5.2: "corrupting it costs a rebuild and nothing else" — Store.open
    // must recover by deleting the disposable index and retrying, not throw.
    const store = Store.open(dbPath);
    assert.deepEqual(store.all(), []);
    store.upsert(makeItem('CONST-a'));
    assert.deepEqual(store.all().map((i) => i.id), ['CONST-a']);
    store.close();
  } finally {
    rmSyncRetrying(tmpDir);
  }
});

test('a lock/busy failure from a concurrent connection does not delete a valid database', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    // Build a fully valid, current-schema database with one item entirely
    // via raw SQL — deliberately never through Store.open — so the file
    // stays in SQLite's default (non-WAL) journal mode. That matters: once
    // in WAL mode, readers never block on a concurrent writer, so a
    // steady-state reopen genuinely cannot observe SQLITE_BUSY. Left in the
    // default mode, `PRAGMA journal_mode = WAL` — the very first statement
    // Store.open's tryOpen issues, before its own busy_timeout is even set
    // — requires exclusive access and so contends with `holder`'s lock
    // immediately, deterministically, with no multi-second wait.
    const item = makeItem('CONST-a');
    const setup = new DatabaseSync(dbPath);
    setup.exec(`
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      CREATE TABLE items (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
        always INTEGER NOT NULL, layer TEXT NOT NULL, file_path TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, data TEXT NOT NULL
      );
    `);
    setup.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    setup.prepare(`
      INSERT INTO items (id, type, title, status, always, layer, file_path, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.type, item.title, item.status, item.always ? 1 : 0, item.layer, item.filePath, JSON.stringify(item));
    setup.close();

    const holder = new DatabaseSync(dbPath);
    holder.exec('BEGIN IMMEDIATE');
    holder.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    try {
      assert.throws(
        () => Store.open(dbPath),
        (err: Error) => {
          assert.equal((err as Error & { errcode?: number }).errcode, 5, 'expected SQLITE_BUSY (5)');
          return true;
        },
      );
    } finally {
      holder.exec('ROLLBACK');
      holder.close();
    }

    // The database file must still be the original, valid one — not deleted
    // and rebuilt from an empty index — so the item survives.
    const store2 = Store.open(dbPath);
    assert.deepEqual(store2.all().map((i) => i.id), ['CONST-a']);
    store2.close();
  } finally {
    rmSyncRetrying(tmpDir);
  }
});

test('the newer-schema case is never auto-deleted — it still throws', () => {
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, 'test.db');
  try {
    const store1 = Store.open(dbPath);
    store1.upsert(makeItem('CONST-a'));
    store1.close();

    const db = new DatabaseSync(dbPath);
    db.prepare('UPDATE schema_version SET version = 999').run();
    db.close();

    assert.throws(() => Store.open(dbPath), /newer than this code understands/);
    // The file must still exist and still hold its data — a newer-schema
    // database is never treated as disposable the way a corrupt one is.
    const stillNewer = new DatabaseSync(dbPath);
    const row = stillNewer.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      { version: number };
    assert.equal(row.version, 999);
    stillNewer.close();
  } finally {
    rmSyncRetrying(tmpDir);
  }
});

test('a dbPath that is itself a directory surfaces the original open error, not a delete failure', () => {
  // A directory at dbPath cannot be opened as a database and cannot be
  // deleted with a plain unlink; Store.open must fall back to surfacing the
  // original open error rather than throwing an unrelated ENOTDIR/EISDIR.
  const tmpDir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const dbPath = join(tmpDir, 'test.db');
  mkdirSync(dbPath, { recursive: true }); // dbPath itself is a directory
  try {
    assert.throws(() => Store.open(dbPath));
  } finally {
    rmSyncRetrying(tmpDir);
  }
});

test('close() called twice does not throw', () => {
  const store = Store.open(':memory:');
  store.close();
  // Should not throw
  store.close();
});

test('transaction commits all writes made inside it', () => {
  const store = Store.open(':memory:');
  const result = store.transaction(() => {
    store.upsert(makeItem('CONST-a'));
    store.upsert(makeItem('CONST-b'));
    return 'done';
  });
  assert.equal(result, 'done');
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-a', 'CONST-b']);
  store.close();
});

test('transaction rolls back all writes if fn throws', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-pre'));
  assert.throws(() => {
    store.transaction(() => {
      store.upsert(makeItem('CONST-a'));
      throw new Error('boom');
    });
  }, /boom/);
  // Pre-existing row survives; the aborted transaction's write does not.
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-pre']);
  store.close();
});
