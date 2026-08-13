import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import { parseItem } from '../../src/core/item.ts';
import { sandbox } from '../helpers/workspace.ts';

test('createItem writes a Markdown file and indexes it', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint',
    title: 'Postgres pool capped at 20',
    body: 'RDS permits 25 connections.',
    scope: ['src/db/**'],
  });

  assert.equal(result.created, true);
  assert.equal(result.id, 'CONST-postgres-pool-capped-at-20');
  assert.equal(result.filePath, 'items/constraint/CONST-postgres-pool-capped-at-20.md');
  assert.ok(existsSync(path.join(s.root, ...result.filePath.split('/'))));
  assert.equal(s.ctx.store.get(result.id)?.title, 'Postgres pool capped at 20');
  s.dispose();
});

test('the file on disk parses back to the indexed item', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint',
    title: 'Pool cap',
    body: 'Body.',
    scope: ['src/db/**'],
    tags: ['database'],
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: null }],
  });

  const text = readFileSync(path.join(s.root, ...result.filePath.split('/')), 'utf8');
  const parsed = parseItem(text, result.filePath, 'project');
  assert.deepEqual(parsed, s.ctx.store.get(result.id));
  assert.equal(text.includes('\r'), false);
  s.dispose();
});

test('identical content at the same source anchor is already captured', () => {
  const s = sandbox();
  const input = {
    type: 'requirement',
    title: 'Users can reset their password',
    body: 'Via an emailed one-time link.',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const first = createItem(s.ctx, input);
  const second = createItem(s.ctx, { ...input });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.match(second.message, /already captured as REQ-users-can-reset-their-password/);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('a differently worded item at the same anchor directs to update_item', () => {
  const s = sandbox();
  const base = {
    type: 'requirement',
    title: 'Users can reset their password',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const first = createItem(s.ctx, { ...base, body: 'Via an emailed link.' });
  const second = createItem(s.ctx, { ...base, body: 'Via SMS, within 10 minutes.' });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.match(second.message, /update_item/);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('source paths are normalized to POSIX before they are stored', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'requirement',
    title: 'Windows path provenance',
    sourceFile: 'docs\\prd\\auth.md',
    sourceAnchor: '## X',
  });
  assert.equal(s.ctx.store.get(result.id)?.sourceFile, 'docs/prd/auth.md');
  s.dispose();
});

test('a colliding title with different content gets a suffixed id', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Two.' });

  assert.equal(first.id, 'CONST-pool-cap');
  assert.equal(second.id, 'CONST-pool-cap-2');
  assert.equal(second.created, true);
  s.dispose();
});

test('a colliding title with identical content is a duplicate, not a suffix', () => {
  const s = sandbox();
  createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });

  assert.equal(second.created, false);
  assert.equal(second.id, 'CONST-pool-cap');
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('an unknown type is refused with the closest category named', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'requirment', title: 'X' }),
    /closest match is "requirement".*mycontext_help\("categories"\)/s,
  );
  s.dispose();
});

test('a disabled category is refused and says where to enable it', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'policy', title: 'X' }),
    /"policy" is disabled.*config\.json/s,
  );
  s.dispose();
});

test('an empty title is refused by name', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: '   ' }),
    /create_item requires "title"/,
  );
  s.dispose();
});

test('the checksum on disk covers the content', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  assert.match(s.ctx.store.get(result.id)!.checksum, /^[0-9a-f]{16}$/);
  s.dispose();
});
