import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

test('openReadOnlyChecked serves a current-schema database and refuses writes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  Store.open(dbPath).close(); // a writer establishes the schema
  const store = Store.openReadOnlyChecked(dbPath);
  try {
    assert.deepEqual(store.ids(), []);
    assert.equal(store.isReadOnly, true);
  } finally {
    store.close();
  }
});

test('an absent database throws fast — it must never be created by a reader', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc2-'));
  t.after(() => removeTree(dir));
  assert.throws(() => Store.openReadOnlyChecked(join(dir, '.index.db')));
});

test('a stale schema version throws — a reader never migrates', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc3-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  Store.open(dbPath).close();
  const db = new DatabaseSync(dbPath);
  db.exec('UPDATE schema_version SET version = 1');
  db.close();
  assert.throws(() => Store.openReadOnlyChecked(dbPath), /schema/);
  // The failed open must not leak its connection: on Windows an open handle
  // blocks deletion, so a caller (the writer path that would migrate, or a
  // cleanup) could no longer replace the stale file. Deleting it here is the
  // observable form of "the connection was closed on the throw path".
  rmSync(dbPath);
});

test('an empty schema_version table throws too — "absent" is not "current"', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc5-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  Store.open(dbPath).close();
  const db = new DatabaseSync(dbPath);
  db.exec('DELETE FROM schema_version');
  db.close();
  assert.throws(() => Store.openReadOnlyChecked(dbPath), /schema/);
});

test('a corrupt file throws and is NOT deleted — the self-heal belongs to writers', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc4-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  writeFileSync(dbPath, 'this is not a database', 'utf8');
  assert.throws(() => Store.openReadOnlyChecked(dbPath));
  assert.equal(readFileSync(dbPath, 'utf8'), 'this is not a database');
});
