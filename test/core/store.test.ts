import { test } from 'node:test';
import assert from 'node:assert/strict';
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
