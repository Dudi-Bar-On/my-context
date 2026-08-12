import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { loadLayer, writeItem, rebuild, type LoadError } from '../../src/core/rebuild.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-'));
}

const ITEM = `---
id: CONST-a
type: constraint
title: A constraint
status: active
severity: hard
always: true
scope:
  - "src/**"
tags: [db]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: null
valid_until: null
checksum: 0000000000000000
---

# A constraint

Some prose.

## Observations
- [limit] Never exceed 20 #db

## Relations
- supersedes [[CONST-old]]
`;

test('loadLayer reads items with POSIX-relative paths', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const items = loadLayer(root, 'project');
  assert.equal(items.length, 1);
  assert.equal(items[0].filePath, 'items/constraint/CONST-a.md');
  assert.equal(items[0].filePath.includes('\\'), false);
  rmSync(root, { recursive: true, force: true });
});

test('rebuild is lossless — files to DB to files is byte-identical', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const file = path.join(root, 'items', 'constraint', 'CONST-a.md');
  const canonical = renderItem(parseItem(ITEM, 'items/constraint/CONST-a.md', 'project'));
  writeFileSync(file, canonical);

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.deepEqual(result.errors, []);

  for (const item of store.all()) writeItem(root, item);
  assert.equal(readFileSync(file, 'utf8'), canonical);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('rebuild replaces the layer rather than accumulating', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const store = Store.open(':memory:');
  rebuild(store, { project: root });
  rmSync(path.join(root, 'items', 'constraint', 'CONST-a.md'));
  rebuild(store, { project: root });
  assert.equal(store.all().length, 0);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('a malformed item is reported and does not abort the rebuild', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  writeFileSync(path.join(root, 'items', 'constraint', 'broken.md'), 'no frontmatter here');

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].file, /broken\.md$/);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('writeItem writes atomically and creates parent directories', () => {
  const root = tempRoot();
  const item = parseItem(ITEM, 'items/constraint/CONST-a.md', 'project');
  const written = writeItem(root, item);
  assert.equal(readFileSync(written, 'utf8'), renderItem(item));
  const siblingNames = readdirSync(path.dirname(written));
  assert.equal(siblingNames.some((name) => name.includes('.tmp-')), false);
  rmSync(root, { recursive: true, force: true });
});

test('rebuild is lossless for a raw hand-authored file — normalized on first write, stable thereafter', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const file = path.join(root, 'items', 'constraint', 'CONST-a.md');
  // Write the raw fixture as authored, NOT pre-canonicalized. This proves
  // the round trip stabilizes a hand-authored file onto its canonical form,
  // rather than merely proving the canonical form is a fixed point.
  writeFileSync(file, ITEM);
  const canonical = renderItem(parseItem(ITEM, 'items/constraint/CONST-a.md', 'project'));

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.deepEqual(result.errors, []);

  for (const item of store.all()) writeItem(root, item);
  assert.equal(readFileSync(file, 'utf8'), canonical);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('an item whose upsert throws is recorded as a LoadError and does not prevent others from loading', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  writeFileSync(
    path.join(root, 'items', 'constraint', 'CONST-b.md'),
    ITEM.replace('id: CONST-a', 'id: CONST-b'),
  );

  const store = Store.open(':memory:');
  const originalUpsert = store.upsert.bind(store);
  // Stub the instance method (not Store itself) so one item's upsert fails
  // deterministically while the store's real behaviour is otherwise unchanged.
  (store as unknown as { upsert: typeof store.upsert }).upsert = ((item) => {
    if (item.id === 'CONST-b') throw new Error('simulated store failure');
    originalUpsert(item);
  }) as typeof store.upsert;

  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].file, /CONST-b\.md$/);
  assert.equal(store.get('CONST-a') !== null, true);
  assert.equal(store.get('CONST-b'), null);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('two files declaring the same id produce a LoadError naming both paths, first-by-sorted-order wins', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  // Same id in both files' frontmatter; filenames sort deterministically.
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a-1.md'), ITEM);
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a-2.md'), ITEM);

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);

  assert.equal(items.length, 1);
  assert.equal(items[0].filePath, 'items/constraint/CONST-a-1.md');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].file, 'items/constraint/CONST-a-2.md');
  assert.match(errors[0].message, /CONST-a/);
  assert.match(errors[0].message, /CONST-a-1\.md/);
  assert.match(errors[0].message, /CONST-a-2\.md/);

  rmSync(root, { recursive: true, force: true });
});
