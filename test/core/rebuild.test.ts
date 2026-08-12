import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { loadLayer, writeItem, rebuild } from '../../src/core/rebuild.ts';
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
  rmSync(root, { recursive: true, force: true });
});
