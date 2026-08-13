import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, supersedeItem, withRetry } from '../../src/core/mutate.ts';
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

/**
 * Spec §7.3: the idempotency key is `(source_file, source_anchor)` PLUS a
 * content hash — not the anchor alone. A single heading routinely yields
 * more than one item (e.g. a revision, or a second requirement extracted
 * from the same passage), so different content at the same anchor must
 * create a second item rather than being refused as a collision.
 */
test('different content at the same anchor creates a new item, not a refusal', () => {
  const s = sandbox();
  const base = {
    type: 'requirement',
    title: 'Users can reset their password',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const first = createItem(s.ctx, { ...base, body: 'Via an emailed link.' });
  const second = createItem(s.ctx, { ...base, body: 'Via SMS, within 10 minutes.' });

  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.notEqual(second.id, first.id);
  assert.equal(s.ctx.store.all().length, 2);
  assert.equal(s.ctx.store.get(second.id)?.sourceFile, 'docs/prd/auth.md');
  assert.equal(s.ctx.store.get(second.id)?.sourceAnchor, '## Password reset');
  s.dispose();
});

/**
 * The consequence spelled out in the ruling: a revision can now be minted
 * at the SAME anchor as its predecessor (sharing anchor, differing content
 * and explicit id), which is exactly what `supersede_item` needs to wire a
 * replacement onto a retiree captured from the same document passage.
 */
test('a revision at the same anchor unblocks supersede', () => {
  const s = sandbox();
  const base = {
    type: 'requirement',
    title: 'Users can reset their password',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const original = createItem(s.ctx, { ...base, body: 'Via an emailed link.' });
  const revision = createItem(s.ctx, {
    ...base, body: 'Via SMS, within 10 minutes.', id: `${original.id}-r2`,
  });

  assert.equal(revision.created, true);
  assert.notEqual(revision.id, original.id);

  supersedeItem(s.ctx, { id: original.id, by: revision.id, reason: 'Switched to SMS delivery.' });

  assert.equal(s.ctx.store.get(original.id)?.status, 'superseded');
  assert.equal(s.ctx.store.get(revision.id)?.status, 'active');
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

// --- CRITICAL: content that does not survive the files → DB → files round trip ---
//
// Spec §10: "rebuild is lossless — files → DB → files is byte-identical."
// `splitSections` (item.ts) treats a `## X` line as a section heading and
// drops a leading `# ` line, and `parseObservations` strips `#tag` and a
// trailing `(...)` out of observation text. So a body or observation
// carrying that syntax parses back as something SHORTER than what was
// written, and the next `persist()` re-renders the truncated copy over the
// file — destroying authored content, permanently, while the tool that did
// it reported success. The file format is Plan 1's byte-identity invariant
// and is deliberately not changed; the write boundary refuses the input
// instead, and says what to do with it.

test('a body containing a "## " heading is refused rather than silently truncated', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'constraint',
      title: 'Gateway enforces the rate limit',
      body: 'The gateway enforces this.\n\n## Rationale\n\nThe upstream vendor bills per request.',
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /## Rationale/, 'the message must name the offending line');
      assert.match(err.message, /observation/i, 'the message must suggest the alternative');
      return true;
    },
  );
  s.dispose();
});

test('a body containing a "# " heading is refused too — that line is dropped outright', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', body: '# Heading\n\nprose' }),
    /my_context: .*# Heading/,
  );
  s.dispose();
});

test('every heading level h1 through h6 is refused', () => {
  const s = sandbox();
  for (const hashes of ['#', '##', '###', '####', '#####', '######']) {
    assert.throws(
      () => createItem(s.ctx, { type: 'constraint', title: 'X', body: `ok\n${hashes} Heading` }),
      /my_context: .*Heading/,
      hashes,
    );
  }
  s.dispose();
});

test('a "#" that is not a heading is still allowed — the guard is anchored, not a substring test', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Issue tracking', body: 'Tracked as issue #4521 (C# service).',
  });
  assert.equal(s.ctx.store.get(created.id)?.body, 'Tracked as issue #4521 (C# service).');
  s.dispose();
});

test('a body that survives the round trip is accepted and comes back byte-identical', () => {
  const s = sandbox();
  const body = 'The gateway enforces this.\n\nThe upstream vendor bills per request.';
  const created = createItem(s.ctx, { type: 'constraint', title: 'Gateway', body });
  const onDisk = parseItem(
    readFileSync(path.join(s.root, ...created.filePath.split('/')), 'utf8'),
    created.filePath, 'project',
  );
  assert.equal(onDisk.body, body);
  s.dispose();
});

test('observation text containing a "#" is refused rather than silently becoming a tag', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Build broke',
      observations: [
        { category: 'symptom', text: 'Issue #4521 broke the build', tags: [], context: null },
      ],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /#4521|Issue #4521/);
      assert.match(err.message, /tag/i);
      return true;
    },
  );
  s.dispose();
});

test('observation text ending in parentheses is refused rather than silently becoming context', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Build broke',
      observations: [
        { category: 'symptom', text: 'The build broke (see CI log)', tags: [], context: null },
      ],
    }),
    /my_context: .*\(see CI log\)/,
  );
  s.dispose();
});

test('parentheses that are not trailing are fine', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'lesson', title: 'Build broke',
    observations: [
      { category: 'symptom', text: 'The build (finally) broke on main', tags: [], context: null },
    ],
  });
  assert.equal(s.ctx.store.get(created.id)?.observations[0].text, 'The build (finally) broke on main');
  s.dispose();
});

test('a body that fabricates an "## Observations" section cannot empty the real body', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'constraint', title: 'X',
      body: '## Observations\n- [limit] injected by an agent',
    }),
    /my_context: .*## Observations/,
  );
  s.dispose();
});

test('an observation category with a character the parser cannot match is refused, not silently dropped', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [
        { category: 'root cause', text: 'The pool leaked', tags: [], context: null },
      ],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /root cause/);
      assert.match(err.message, /\[a-z0-9_-\]|letters, digits/i);
      return true;
    },
  );
  s.dispose();
});

test('an observation category with uppercase letters is refused, not silently rewritten to lowercase', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [
        { category: 'Root-Cause', text: 'The pool leaked', tags: [], context: null },
      ],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /Root-Cause/);
      assert.match(err.message, /root-cause/);
      assert.match(err.message, /lowercase/i);
      return true;
    },
  );
  s.dispose();
});

test('an observation category using the parser\'s own character class is accepted', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'lesson', title: 'Pool leaked',
    observations: [
      { category: 'root-cause_1', text: 'The pool leaked', tags: [], context: null },
    ],
  });
  assert.equal(s.ctx.store.get(created.id)?.observations[0].category, 'root-cause_1');
  s.dispose();
});

// --- observation tags/context: reachable directly through createItem (and
// so through the MCP create_item tool, whose optObservations forwards
// tags/context with only a shape check) — not just through ingest's
// candidate validator. See src/ingest/schema.ts's own tests for the
// candidate-shaped version of these same checks.

test('an observation tag starting with "#" is refused, not silently corrupted on round trip', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [{ category: 'limit', text: 'ok', tags: ['#auth'], context: null }],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /observations\[0\]\.tags/);
      assert.match(err.message, /#auth/);
      return true;
    },
  );
  s.dispose();
});

test('a plain observation tag is accepted', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'lesson', title: 'Pool leaked',
    observations: [{ category: 'limit', text: 'ok', tags: ['auth', 'db-2'], context: null }],
  });
  assert.deepEqual(s.ctx.store.get(created.id)?.observations[0].tags, ['auth', 'db-2']);
  s.dispose();
});

test('an observation context containing a parenthesis is refused, not silently mis-parsed', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [{ category: 'limit', text: 'ok', tags: [], context: 'at (registration)' }],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /observations\[0\]\.context/);
      return true;
    },
  );
  s.dispose();
});

test('an observation context containing a newline is refused', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [{ category: 'limit', text: 'ok', tags: [], context: 'line one\nline two' }],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /observations\[0\]\.context/);
      assert.match(err.message, /newline/);
      return true;
    },
  );
  s.dispose();
});

test('a plain observation context is accepted', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'lesson', title: 'Pool leaked',
    observations: [{ category: 'limit', text: 'ok', tags: [], context: 'at registration' }],
  });
  assert.equal(s.ctx.store.get(created.id)?.observations[0].context, 'at registration');
  s.dispose();
});
