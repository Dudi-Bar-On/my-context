// @basis TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const dbPath = join(dir, '.index.db');
  // ── THE TWO THINGS THIS TEST'S TITLE CLAIMS, NEITHER OF WHICH IT CHECKED ──
  //
  // A bare `assert.throws` with no matcher passes on ANY error, including a
  // `TypeError` from a renamed argument — the failure would be reported as the
  // behaviour under test. And nothing looked at the directory: a
  // `openReadOnlyChecked` that MINTS an empty `.index.db`, finds no
  // `schema_version` in it and then throws satisfied a test whose title is "it
  // must never be created by a reader". Its direct twin
  // `test/core/ledger-readonly.test.ts` asserts both, and this is that
  // assertion copied to the door beside it.
  assert.throws(() => Store.openReadOnlyChecked(dbPath), /unable to open|does not exist|ENOENT/i);
  assert.equal(existsSync(dbPath), false, 'a reader created the database file it was asked to read');
  assert.equal(existsSync(`${dbPath}-wal`), false, 'a reader left a write-ahead log behind');
  assert.equal(existsSync(`${dbPath}-shm`), false, 'a reader left a shared-memory file behind');
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
  assert.throws(() => Store.openReadOnlyChecked(dbPath), Error);
  assert.equal(readFileSync(dbPath, 'utf8'), 'this is not a database');
  // The self-heal belongs to writers, and a writer's recovery takes the two
  // journals with it. A read door that left either behind would have run some
  // part of that recovery.
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.equal(existsSync(`${dbPath}-shm`), false);
});
