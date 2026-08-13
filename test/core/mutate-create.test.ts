import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, withRetry } from '../../src/core/mutate.ts';
import { computeItemChecksum, parseItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
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
  const indexed = s.ctx.store.get(result.id)!;
  assert.match(indexed.checksum, /^[0-9a-f]{16}$/);
  assert.equal(indexed.checksum, computeItemChecksum(indexed));

  const text = readFileSync(path.join(s.root, ...result.filePath.split('/')), 'utf8');
  const onDiskChecksum = /^checksum:\s*(\S+)$/m.exec(text)?.[1];
  assert.equal(onDiskChecksum, indexed.checksum);
  s.dispose();
});

// --- C1: an explicit id must never silently overwrite a different item ---

test('an explicit id colliding with different content is refused, not overwritten', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'First', body: 'Original.' });

  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'Second', body: 'Overwrite.', id: first.id }),
    /"CONST-first" already exists with different content.*update_item.*supersede_item/s,
  );

  // The incumbent must survive untouched.
  const survivor = s.ctx.store.get(first.id);
  assert.equal(survivor?.title, 'First');
  assert.equal(survivor?.body, 'Original.');
  s.dispose();
});

test('an explicit id colliding with identical content is a duplicate, not a rewrite', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'First', body: 'Original.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'First', body: 'Original.', id: first.id });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

// --- C2: scope must be normalized before it is hashed ---

test('a Windows-style scope glob does not create a spurious second item', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Scoped', body: 'X.', scope: ['src\\db\\**'] });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Scoped', body: 'X.', scope: ['src\\db\\**'] });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

// --- C3: severity and always are normative content, not bookkeeping ---

test('re-capturing the same title with a different severity is not a no-op duplicate', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.', severity: 'soft' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.', severity: 'hard' });

  assert.equal(second.created, true);
  assert.notEqual(second.id, first.id);
  s.dispose();
});

test('re-capturing the same title with a different always is not a no-op duplicate', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.', always: false });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.', always: true });

  assert.equal(second.created, true);
  assert.notEqual(second.id, first.id);
  s.dispose();
});

// --- I1: dedup must inspect the whole base/base-N family, not just base ---

test('a third identical call to a colliding title is still a duplicate, not a third item', () => {
  const s = sandbox();
  createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Two.' });
  // Identical to the SIBLING (base-2), not the base — dedup must inspect the
  // whole family, not just the base id, or this mints a third item.
  const third = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Two.' });

  assert.equal(third.created, false);
  assert.equal(third.id, second.id);
  assert.equal(s.ctx.store.all().length, 2);
  s.dispose();
});

// --- I2: hashing must not depend on caller key order ---

test('an observation payload with different key order hashes the same as its parsed form', () => {
  const s = sandbox();
  const first = createItem(s.ctx, {
    type: 'constraint',
    title: 'Observed',
    body: 'X.',
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: null }],
  });

  // Same content, key order scrambled the way a hand-assembled payload might.
  const second = createItem(s.ctx, {
    type: 'constraint',
    title: 'Observed',
    body: 'X.',
    observations: [{ text: 'Never exceed 20', tags: ['db'], context: null, category: 'limit' } as unknown as {
      category: string; text: string; tags: string[]; context: string | null;
    }],
  });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  s.dispose();
});

test('extra keys in different order hash the same', () => {
  const s = sandbox();
  const first = createItem(s.ctx, {
    type: 'constraint', title: 'Extras', body: 'X.', extra: { alpha: '1', beta: '2' },
  });
  const second = createItem(s.ctx, {
    type: 'constraint', title: 'Extras', body: 'X.', extra: { beta: '2', alpha: '1' },
  });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  s.dispose();
});

// --- I3/I4: anchor dedup must include type, and the message separator must not double '#' ---

test('a requirement and a constraint at the same anchor do not collide', () => {
  const s = sandbox();
  const req = createItem(s.ctx, {
    type: 'requirement', title: 'Reset flow', body: 'X.',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset',
  });
  const constraint = createItem(s.ctx, {
    type: 'constraint', title: 'Reset flow limit', body: 'Y.',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset',
  });

  assert.equal(req.created, true);
  assert.equal(constraint.created, true);
  assert.notEqual(req.id, constraint.id);
  s.dispose();
});

test('the anchor collision message does not double up the heading hashes', () => {
  const s = sandbox();
  const base = {
    type: 'requirement', title: 'Reset flow',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset',
  };
  createItem(s.ctx, { ...base, body: 'One.' });
  const second = createItem(s.ctx, { ...base, body: 'Two.' });

  assert.match(second.message, /docs\/prd\/auth\.md ## Password reset/);
  assert.equal(/#{3,}/.test(second.message), false);
  s.dispose();
});

// --- I5: extra field validation ---

test('an extra key the frontmatter grammar cannot reparse is refused', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', extra: { 'valid-until': '2099-01-01' } }),
    /extra field "valid-until" is not a valid key/,
  );
  s.dispose();
});

test('an extra key that collides with a reserved frontmatter field is refused', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', extra: { id: 'CONST-hijacked' } }),
    /extra field "id" collides with a reserved frontmatter field/,
  );
  s.dispose();
});

// --- I6: enum validation on status, severity, origin ---

test('an invalid status is refused rather than silently persisted', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', status: 'activ' as unknown as 'active' }),
    /"status" must be one of/,
  );
  s.dispose();
});

test('an invalid severity is refused rather than silently persisted', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', severity: 'harde' as unknown as 'hard' }),
    /"severity" must be one of/,
  );
  s.dispose();
});

test('an invalid origin is refused rather than silently persisted', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', origin: 'robot' as unknown as 'agent' }),
    /"origin" must be one of/,
  );
  s.dispose();
});

// --- I7: withRetry must never surface a raw SQLite error ---

test('withRetry retries a lock error and returns the eventual success', () => {
  let calls = 0;
  const result = withRetry(() => {
    calls++;
    if (calls < 3) throw new Error('SQLITE_BUSY: database is locked');
    return 'ok';
  }, 5);

  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('withRetry rethrows a non-lock error immediately without retrying', () => {
  let calls = 0;
  assert.throws(
    () => withRetry(() => { calls++; throw new Error('SQLITE_CONSTRAINT: not null'); }, 5),
    /SQLITE_CONSTRAINT/,
  );
  assert.equal(calls, 1);
});

test('withRetry exhaustion surfaces a teaching message, not the raw SQLite error', () => {
  let calls = 0;
  assert.throws(
    () => withRetry(() => { calls++; throw new Error('SQLITE_BUSY: database is locked'); }, 3),
    /my_context: the index database is still locked after 3 attempts/,
  );
  assert.equal(calls, 3);
});

// --- I8: dedup lookups must be restricted to the project layer ---

test('a global-layer item with the same id does not shadow a project-layer create', () => {
  const s = sandbox();
  const globalItem: Item = {
    id: 'CONST-shared-title', type: 'constraint', title: 'Shared title', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2020-01-01', validUntil: null, checksum: 'deadbeefdeadbeef',
    extra: {}, body: 'Global body.', observations: [], relations: [],
    layer: 'global', filePath: 'items/constraint/CONST-shared-title.md',
  };
  s.ctx.store.upsert(globalItem);

  const result = createItem(s.ctx, { type: 'constraint', title: 'Shared title', body: 'Project body.' });

  assert.equal(result.created, true);
  assert.equal(result.id, 'CONST-shared-title');
  assert.equal(s.ctx.store.get(result.id)?.layer, 'project');
  assert.equal(s.ctx.store.get(result.id)?.body, 'Project body.');
  s.dispose();
});

test('a global-layer item at the same source anchor does not block a project-layer create', () => {
  const s = sandbox();
  const globalItem: Item = {
    id: 'REQ-global-anchor', type: 'requirement', title: 'Global anchor', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset', sourceChecksum: null,
    validFrom: '2020-01-01', validUntil: null, checksum: 'deadbeefdeadbeef',
    extra: {}, body: 'Global body.', observations: [], relations: [],
    layer: 'global', filePath: 'items/requirement/REQ-global-anchor.md',
  };
  s.ctx.store.upsert(globalItem);

  const result = createItem(s.ctx, {
    type: 'requirement', title: 'Project anchor', body: 'Project body.',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset',
  });

  assert.equal(result.created, true);
  s.dispose();
});

// --- I10: sourceChecksum round-trips ---

test('sourceChecksum is stored and round-trips through the file', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'requirement', title: 'Checksum carrier', body: 'X.',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## X', sourceChecksum: 'abc123deadbeef01',
  });

  assert.equal(s.ctx.store.get(result.id)?.sourceChecksum, 'abc123deadbeef01');

  const text = readFileSync(path.join(s.root, ...result.filePath.split('/')), 'utf8');
  const parsed = parseItem(text, result.filePath, 'project');
  assert.equal(parsed.sourceChecksum, 'abc123deadbeef01');
  s.dispose();
});

// --- MINOR: prototype-unsafe lookup, and the unknown-type error's allowed list ---

test('a type of "constructor" is reported as unknown, not as a disabled category', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constructor', title: 'X' }),
    /"type" must be one of/,
  );
  s.dispose();
});

test('the unknown-type error lists only enabled categories', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'nope', title: 'X' }),
    (err: Error) => !err.message.includes('policy'),
  );
  s.dispose();
});
