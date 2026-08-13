import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';

function makeItem(id: string, over: Partial<Item> = {}): Item {
  const base = parseItem(
    `---\nid: ${id}\ntype: constraint\ntitle: ${id} title\nstatus: active\n---\n\n# ${id} title\n`,
    `items/constraint/${id}.md`,
    'project',
  );
  return { ...base, ...over };
}

test('activeScoped returns only active items that declare a scope', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-scoped', { scope: ['src/db/**'] }));
  store.upsert(makeItem('CONST-inert', { scope: [] }));
  store.upsert(makeItem('CONST-draft', { scope: ['src/**'], status: 'draft' }));
  store.upsert(makeItem('CONST-old', { scope: ['src/**'], status: 'superseded' }));

  assert.deepEqual(store.activeScoped().map((i) => i.id), ['CONST-scoped']);
  store.close();
});

test('activeScoped round-trips the full item, not a projection', () => {
  const store = Store.open(':memory:');
  const item = makeItem('CONST-scoped', { scope: ['src/db/**'] });
  store.upsert(item);
  assert.deepEqual(store.activeScoped()[0], item);
  store.close();
});

test('re-upserting an item that lost its scope removes it from activeScoped', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a', { scope: ['src/**'] }));
  assert.equal(store.activeScoped().length, 1);
  store.upsert(makeItem('CONST-a', { scope: [] }));
  assert.equal(store.activeScoped().length, 0);
  store.close();
});

test('ids lists every item cheaply, in order', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-b'));
  store.upsert(makeItem('CONST-a', { status: 'draft' }));
  assert.deepEqual(store.ids(), ['CONST-a', 'CONST-b']);
  store.close();
});

test('opening a stale schema rebuilds items and preserves the ledger', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-migrate-'));
  const dbPath = path.join(dir, 'index.db');

  const store = Store.open(dbPath);
  store.upsert(makeItem('CONST-a', { scope: ['src/**'] }));
  store.close();

  const ledger = Ledger.open(dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();

  // Pretend the file was written by an older release.
  const raw = new DatabaseSync(dbPath);
  raw.prepare('UPDATE schema_version SET version = ?').run(1);
  raw.close();

  const reopened = Store.open(dbPath);
  assert.deepEqual(reopened.all(), [], 'items are dropped and await a rebuild');
  reopened.close();

  const ledgerAgain = Ledger.open(dbPath);
  assert.deepEqual(ledgerAgain.seen('s1'), ['CONST-a'], 'session state must survive migration');
  ledgerAgain.close();

  rmSync(dir, { recursive: true, force: true });
});
