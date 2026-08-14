import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';

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
  rmSync(path.dirname(file), { recursive: true, force: true });
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
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('openReadOnly does not create a missing database', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ro2-'));
  assert.throws(() => Store.openReadOnly(path.join(dir, 'absent.db')));
  rmSync(dir, { recursive: true, force: true });
});

test('a raw aggregate query works', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  assert.deepEqual(store.raw('SELECT type, COUNT(*) AS n FROM items GROUP BY type'),
    [{ type: 'constraint', n: 1 }]);
  store.close();
  rmSync(path.dirname(file), { recursive: true, force: true });
});
