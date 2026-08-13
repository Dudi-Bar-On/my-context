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

/**
 * Builds a database in the genuine pre-v2 on-disk shape via raw SQL —
 * never through `Store.open` — so `items` truly lacks `has_scope` and
 * `schema_version` truly says 1. The stale-schema test above only ever
 * force-downgrades the `version` column of a database `Store.open` itself
 * created (already carrying `has_scope`), so it cannot catch a migration
 * that never gets as far as looking at that column. These tests exercise
 * the actual state an upgrading user's disk is in.
 */
function makeGenuineV1Database(dbPath: string, withOldIndexes: boolean): void {
  const raw = new DatabaseSync(dbPath);
  raw.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL);
    CREATE TABLE items (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL,
      always      INTEGER NOT NULL,
      layer       TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      data        TEXT NOT NULL
    );
  `);
  if (withOldIndexes) {
    raw.exec(`
      CREATE INDEX idx_items_type   ON items(type);
      CREATE INDEX idx_items_status ON items(status);
      CREATE INDEX idx_items_layer  ON items(layer);
    `);
  }
  raw.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
  const item = makeItem('CONST-a', { scope: ['src/**'] });
  raw.prepare(`
    INSERT INTO items (id, type, title, status, always, layer, file_path, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.type, item.title, item.status, item.always ? 1 : 0, item.layer, item.filePath, JSON.stringify(item));
  raw.close();
}

test('a genuine version-1 database (items without has_scope) is migrated, not left permanently broken', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-v1-'));
  const dbPath = path.join(dir, 'index.db');
  makeGenuineV1Database(dbPath, false);

  const store = Store.open(dbPath);

  const raw = new DatabaseSync(dbPath);
  const versionRow = raw.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number };
  assert.equal(versionRow.version, 2, 'schema_version must be bumped to 2');
  const columns = (raw.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
  assert.ok(columns.includes('has_scope'), 'items must have gained has_scope');
  raw.close();

  // The pre-existing row is gone — dropped-and-refilled, as documented —
  // but the database is usable again, which is the property that matters:
  // upsert and activeScoped must work against the migrated schema.
  assert.deepEqual(store.all(), []);
  store.upsert(makeItem('CONST-b', { scope: ['src/**'] }));
  assert.deepEqual(store.activeScoped().map((i) => i.id), ['CONST-b']);
  store.close();

  rmSync(dir, { recursive: true, force: true });
});

test('a genuine version-1 database that also has the old indexes is migrated cleanly', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-v1-idx-'));
  const dbPath = path.join(dir, 'index.db');
  makeGenuineV1Database(dbPath, true);

  const store = Store.open(dbPath);
  store.upsert(makeItem('CONST-b', { scope: ['src/**'] }));
  assert.deepEqual(store.activeScoped().map((i) => i.id), ['CONST-b']);
  store.close();

  rmSync(dir, { recursive: true, force: true });
});

test('a database with a v1-shaped items table and no schema_version row at all is migrated, not bricked', () => {
  // The old code wrote items's schema and the schema_version row as two
  // separate autocommits — a crash between them leaves exactly this state:
  // a pre-v2 items table on disk, and an empty (rowless, but present)
  // schema_version table, which reads as `!row` rather than a stale
  // version. That branch must not assume "no row" means "nothing else on
  // disk either".
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-v1-norow-'));
  const dbPath = path.join(dir, 'index.db');

  const raw = new DatabaseSync(dbPath);
  raw.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL);
    CREATE TABLE items (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL,
      always      INTEGER NOT NULL,
      layer       TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      data        TEXT NOT NULL
    );
  `);
  const item = makeItem('CONST-a', { scope: ['src/**'] });
  raw.prepare(`
    INSERT INTO items (id, type, title, status, always, layer, file_path, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.type, item.title, item.status, item.always ? 1 : 0, item.layer, item.filePath, JSON.stringify(item));
  raw.close();

  const store = Store.open(dbPath);

  const check = new DatabaseSync(dbPath);
  const versionRow = check.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number };
  assert.equal(versionRow.version, 2, 'schema_version must end up at 2');
  const columns = (check.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
  assert.ok(columns.includes('has_scope'), 'items must have gained has_scope');
  check.close();

  store.upsert(makeItem('CONST-b', { scope: ['src/**'] }));
  assert.deepEqual(store.activeScoped().map((i) => i.id), ['CONST-b']);
  store.close();

  rmSync(dir, { recursive: true, force: true });
});
