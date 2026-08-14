import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';
import { removeTree } from '../helpers/tmp.ts';

function dbFile(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), 'myctx-ro-')), 'index.db');
}

function seed(file: string): void {
  const store = Store.open(file);
  store.upsert(parseItem(
    '---\nid: CONST-a\ntype: constraint\ntitle: A constraint\nstatus: active\n---\n\n# A constraint\n',
    'items/constraint/CONST-a.md', 'project',
  ));
  store.close();
}

test('raw returns rows as plain objects', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  const rows = store.raw("SELECT id, type, status FROM items ORDER BY id");
  assert.deepEqual(rows, [{ id: 'CONST-a', type: 'constraint', status: 'active' }]);
  store.close();
  removeTree(path.dirname(file));
});

test('a read-only connection cannot write, whatever the SQL says', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  assert.throws(() => store.raw("DELETE FROM items"), /readonly|read-only/i);
  store.close();

  const check = Store.open(file);
  assert.equal(check.all().length, 1);
  check.close();
  removeTree(path.dirname(file));
});

test('openReadOnly does not create a missing database', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ro2-'));
  assert.throws(() => Store.openReadOnly(path.join(dir, 'absent.db')));
  removeTree(dir);
});

test('openReadOnly does not block VACUUM INTO an arbitrary path — the connection is read-only about dbPath, not about every write a statement could make', () => {
  // This pins the CRITICAL finding from review: `{ readOnly: true }` stops
  // writes to the tables in the opened file, but `VACUUM INTO` writes a full
  // copy of the database to a DIFFERENT path the caller names, and the
  // engine does not stop that. `assertSelectOnly` in query.ts — a UX guard
  // for everything else — is the ONLY thing blocking this one statement, and
  // this test exists so that fact cannot be silently "corrected" back to
  // trusting the connection alone.
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  const copyPath = path.join(path.dirname(file), 'vacuum-copy.db');
  assert.equal(existsSync(copyPath), false);
  store.raw(`VACUUM INTO '${copyPath.replace(/\\/g, '/')}'`);
  assert.equal(existsSync(copyPath), true, 'VACUUM INTO wrote a copy through a read-only connection');
  store.close();
  removeTree(path.dirname(file));
});

test('a raw aggregate query works', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  assert.deepEqual(store.raw('SELECT type, COUNT(*) AS n FROM items GROUP BY type'),
    [{ type: 'constraint', n: 1 }]);
  store.close();
  removeTree(path.dirname(file));
});
