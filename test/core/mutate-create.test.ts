import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { extraFieldNames } from '../../src/core/config.ts';
import { contentHash } from '../../src/core/content-hash.ts';
import { createItem, supersedeItem } from '../../src/core/mutate.ts';
import { withRetry } from '../../src/core/persist.ts';
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
  // Disabled by this project's config: nothing ships disabled since Phase 3
  // removed the three categories that did.
  const s = sandbox({ categories: { standard: { enabled: false } } });
  assert.throws(
    () => createItem(s.ctx, { type: 'standard', title: 'X' }),
    /"standard" is disabled.*config\.json/s,
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

/**
 * F3. An explicit `input.id` becomes the item's FILENAME —
 * `items/<type>/<id>.md`, joined with the workspace root by `writeItem` and
 * `mkdirSync`'d recursively — so a traversal id writes outside `.my_context/`
 * entirely, past the write-deny hook, which matches on the `.my_context` path
 * segment and never sees one. `validateRelationTarget` already ran on this
 * field and passes every string below: it refuses an empty id, a line break
 * and a `]`, and says nothing about separators.
 *
 * No external surface forwards a caller-supplied id today (the MCP
 * `create_item` tool has no `id` field, `mycontext add` never sets one), so
 * this is insurance taken at the boundary, not a live exploit.
 */
const TRAVERSAL_IDS = [
  '../evil',
  '../../../evil',
  '..\\..\\evil',
  'items/../../evil',
  'a/b',
  'a\\b',
  '..',
  'CONST-x/../../../CONST-y',
];

for (const id of TRAVERSAL_IDS) {
  test(`createItem refuses an explicit id that escapes its directory: ${JSON.stringify(id)}`, () => {
    const s = sandbox();
    try {
      assert.throws(
        () => createItem(s.ctx, { type: 'constraint', title: 'Traversal probe', id }),
        (err: Error) => {
          assert.match(err.message, /^my_context: /);
          assert.match(err.message, /path separator or "\.\."|not a usable id/);
          return true;
        },
        `an id of ${JSON.stringify(id)} was accepted`,
      );
      // And nothing was written anywhere: not inside the workspace, and not
      // at the place outside it the traversal aimed at.
      assert.equal(existsSync(path.join(s.root, 'items', 'constraint')), false);
      assert.equal(existsSync(path.join(s.cwd, 'evil.md')), false);
      assert.equal(existsSync(path.join(path.dirname(s.cwd), 'evil.md')), false);
    } finally {
      s.dispose();
    }
  });
}

test('an explicit id that is not a single safe filename segment is refused', () => {
  const s = sandbox();
  for (const id of ['.hidden', '-leading-dash', 'has space', 'C:CONST-x', 'CONST-x\u0000', '']) {
    assert.throws(
      () => createItem(s.ctx, { type: 'constraint', title: 'Grammar probe', id }),
      (err: Error) => {
        assert.match(err.message, /^my_context: /);
        return true;
      },
      `an id of ${JSON.stringify(id)} was accepted`,
    );
  }
  s.dispose();
});

test('an explicit id in the shape this project actually mints is still accepted', () => {
  const s = sandbox();
  // Every id the internal explicit-id callers produce: `makeId`'s output,
  // `nextCollisionId`'s `-2` sibling and `nextRevisionId`'s `-r2` revision
  // (both in ingest/apply.ts). Plus the uppercase/underscore/dot shapes a
  // hand-authored or older corpus can already hold and `parseItem` accepts,
  // which is why this guard is "one safe filename segment" and not
  // `slugify`'s grammar.
  const accepted = ['CONST-pool-cap', 'CONST-pool-cap-2', 'CONST-pool-cap-r2', 'CONST_Pool.Cap', '0'];
  accepted.forEach((id, i) => {
    const result = createItem(s.ctx, { type: 'constraint', title: `Accepted shape ${i}`, id });
    assert.equal(result.created, true, `${id} was refused`);
    assert.equal(result.id, id);
  });
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
  // `alpha`/`beta` are stand-ins for "any two extra keys", so the category has
  // to declare them now that `createItem` enforces extra-field ownership
  // (`unknownExtraFieldError`, trust.ts). Declaring them in config is the
  // supported way to say so, and keeps this test about key ORDER.
  const s = sandbox({ categories: { constraint: { extraFields: ['alpha', 'beta'] } } });
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
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2020-01-01', validUntil: null, checksum: 'deadbeefdeadbeef',
    extra: {}, body: 'Global body.', steps: [], observations: [], relations: [],
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
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: '## Password reset', sourceChecksum: null,
    validFrom: '2020-01-01', validUntil: null, checksum: 'deadbeefdeadbeef',
    extra: {}, body: 'Global body.', steps: [], observations: [], relations: [],
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
  const s = sandbox({ categories: { standard: { enabled: false } } });
  assert.throws(
    () => createItem(s.ctx, { type: 'nope', title: 'X' }),
    (err: Error) => !err.message.includes('standard'),
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

// --- CRITICAL: a bare '# ' line (a hash plus trailing whitespace and
// nothing else) is dropped outright by item.ts's untrimmed, `^`-anchored
// `/^#\s+/` — but validateBody used to trim the line before testing it,
// which removes the very trailing whitespace its own regex needs to match,
// so this exact shape slipped through undetected. Found by an independent
// randomized stress run over validateCandidates + createItem. ---

test('a body line that is only "#" plus trailing whitespace is refused, not silently dropped', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', body: 'x\n# \ny' }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /Markdown/);
      return true;
    },
  );
  s.dispose();
});

test('a body line with leading whitespace before "#" is allowed — item.ts never treats it as a heading either', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'X', body: 'x\n  # not a heading\ny' });
  assert.equal(s.ctx.store.get(created.id)?.body, 'x\n  # not a heading\ny');
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

// --- CRITICAL: a body with a lone '\r' (or CRLF) has no literal '\n' for a
// naive check, but parseItem normalizes on read — so an un-normalized
// stored body drifts from its own recorded checksum the moment it's read
// back, even with no heading anywhere in it. Reachable directly through
// createItem, not just through ingest's candidate validator. ---

test('a body with bare-CR line endings is normalized before storage, not stored raw', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'CR body', body: 'Line one.\rLine two.',
  });
  const indexed = s.ctx.store.get(created.id)!;
  assert.equal(indexed.body, 'Line one.\nLine two.');
  assert.equal(indexed.checksum, computeItemChecksum(indexed));

  const onDisk = parseItem(
    readFileSync(path.join(s.root, ...created.filePath.split('/')), 'utf8'),
    created.filePath, 'project',
  );
  assert.equal(onDisk.body, 'Line one.\nLine two.');
  assert.equal(computeItemChecksum(onDisk), onDisk.checksum);
  s.dispose();
});

test('a body with CRLF line endings is normalized before storage, not stored raw', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'CRLF body', body: 'Line one.\r\nLine two.',
  });
  const indexed = s.ctx.store.get(created.id)!;
  assert.equal(indexed.body, 'Line one.\nLine two.');
  assert.equal(indexed.checksum, computeItemChecksum(indexed));
  s.dispose();
});

test('a repeat create_item call with a CRLF body dedupes against the LF-normalized original', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Dedup body', body: 'Line one.\nLine two.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Dedup body', body: 'Line one.\r\nLine two.' });
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  s.dispose();
});

test('contentHash normalizes body line endings on its own — not only because createItem happens to pre-normalize', () => {
  // A direct unit test of the exported function, independent of createItem's
  // own body normalization: contentHash is public API (a future caller —
  // Task 4's dedup pre-check, an MCP handler — might call it directly with
  // a raw, un-normalized body), so its own internal normalizeEol must be
  // provably load-bearing on its own, not merely redundant with createItem.
  const lf = contentHash({ type: 'constraint', title: 'X', body: 'Line one.\nLine two.' });
  const crlf = contentHash({ type: 'constraint', title: 'X', body: 'Line one.\r\nLine two.' });
  const cr = contentHash({ type: 'constraint', title: 'X', body: 'Line one.\rLine two.' });
  assert.equal(crlf, lf);
  assert.equal(cr, lf);
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
      assert.match(err.message, /line break/);
      return true;
    },
  );
  s.dispose();
});

// --- CRITICAL: OBSERVATION's `(.*)$` does not span U+2028/U+2029, so the
// WHOLE list line fails to match and the observation silently vanishes —
// not merely corrupts — the next time the item is read back. Reachable
// directly through createItem (and so through MCP create_item), not just
// through ingest's widened NEWLINE check. ---

test('an observation context containing U+2028 is refused, not silently dropped on read-back', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [{ category: 'limit', text: 'ok', tags: [], context: 'a b' }],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /observations\[0\]\.context/);
      assert.match(err.message, /line break/);
      return true;
    },
  );
  s.dispose();
});

test('an observation text containing U+2029 is refused, not silently dropped on read-back', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'lesson', title: 'Pool leaked',
      observations: [{ category: 'limit', text: 'a b', tags: [], context: null }],
    }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /observations\[0\]\.text/);
      assert.match(err.message, /line break/);
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

// --- IMPORTANT: title/scope/tags with a line break are reachable directly
// through createItem (and so through MCP create_item), not just through
// ingest's candidate validator. The adjudication's reasoning — fix it
// where both surfaces share it — applies unchanged to these fields too. ---

test('a title containing a newline is refused, not written as an unparseable file', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'Line one\nLine two' }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /"title" contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('a scope glob containing a newline is refused, not written as an unparseable file', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', scope: ['a\nb/**'] }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /scope\[0\] contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('a tag containing a newline is refused, not written as an unparseable file', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', tags: ['a\nb'] }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /tags\[0\] contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('an extra value containing a newline is refused, not written as an unparseable file', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', extra: { kind: 'a\nb' } }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /extra\.kind contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('an empty-string extra value is refused, not silently dropped on the next read', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'X', extra: { kind: '' } }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /extra\.kind is an empty string/);
      return true;
    },
  );
  s.dispose();
});

// --- extra-field OWNERSHIP: an extra key must be one the item's category
//     declares (`unknownExtraFieldError`, core/trust.ts) ---

/**
 * The looseness this closes shipped for a long time and nothing exercised it:
 * `directive` decides whether a rule prohibits or prescribes, and it was
 * accepted on a `risk`, where nothing would ever read it. The catalogue read as
 * a per-category promise and behaved as a global namespace, because the only
 * two readers of `extraFields` — the MCP `create_item` schema and the ingest
 * extraction request — are both the UNION of what every category declares.
 */
test('createItem refuses an extra key the item category does not declare', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'risk', title: 'Index falls behind', extra: { directive: 'dont' } }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      // The offending key, the category, and what that category DOES declare.
      assert.match(err.message, /extra field "directive" is not declared by "risk"/);
      assert.match(err.message, /A "risk" declares: likelihood, impact\./);
      // Where to go, not merely "no": the category that owns the field, and the
      // config key that would declare it here.
      assert.match(err.message, /"directive" is declared by rule\./);
      assert.match(err.message, /categories\.risk\.extraFields/);
      assert.match(err.message, /Nothing was written\./);
      return true;
    },
  );
  assert.equal(s.ctx.store.all().length, 0, 'the refusal promises nothing was written');
  s.dispose();
});

/** The other half: the same field on the category that declares it. `rule`
 * accepting `directive` is what the shipped corpora actually do — a survey of
 * all 118 items found `rule` using only `directive` and `requirement` only
 * `kind`, so enforcing ownership breaks no shipped-category item. */
test('createItem accepts an extra key the item category declares', () => {
  const s = sandbox();
  const rule = createItem(s.ctx, {
    type: 'rule', title: 'Never log customer email', extra: { directive: 'dont' },
  });
  assert.equal(rule.created, true, rule.message);
  assert.equal(s.ctx.store.get(rule.id)!.extra.directive, 'dont');

  const risk = createItem(s.ctx, {
    type: 'risk', title: 'Index falls behind', extra: { likelihood: 'low', impact: 'high' },
  });
  assert.equal(risk.created, true, risk.message);
  s.dispose();
});

/**
 * PRECEDENCE, and it is not cosmetic. `--extra status=x` must keep failing with
 * the reserved-frontmatter-field message — the one that says the value would
 * silently overwrite a real field on disk — and not with "status is not
 * declared by rule", whose remedy is to add `status` to `extraFields`: the one
 * fix that cannot work, since `requireExtraFields` refuses it there too.
 */
test('a reserved extra key is refused as reserved, not as undeclared', () => {
  const s = sandbox();
  for (const key of ['status', 'id', 'scope', 'checksum']) {
    assert.throws(
      () => createItem(s.ctx, { type: 'rule', title: `R ${key}`, extra: { [key]: 'x' } }),
      (err: Error) => {
        assert.match(err.message, /collides with a reserved frontmatter field/);
        assert.doesNotMatch(err.message, /is not declared by/);
        return true;
      },
      `${key} was refused as undeclared rather than as reserved`,
    );
  }
  // Same ordering for the grammar and `__proto__` guards, which are the other
  // two things `validateExtra` refuses before ownership is ever consulted.
  assert.throws(
    () => createItem(s.ctx, { type: 'rule', title: 'R hyphen', extra: { 'valid-until': 'x' } }),
    (err: Error) => {
      assert.match(err.message, /is not a valid key/);
      assert.doesNotMatch(err.message, /is not declared by/);
      return true;
    },
  );
  s.dispose();
});

/**
 * The half that makes ownership usable at all, and the reason both halves are
 * one commit: a CUSTOM category could declare nothing, so validation shipped
 * alone would refuse every `task` item in this machine's outer corpus — 250
 * would-be violations, all of them `task`, carrying exactly these five fields.
 */
test('a config-declared extra field on a custom category is accepted', () => {
  const s = sandbox({
    categories: {
      task: {
        tier: 'rationale',
        description: 'A unit of planned work',
        extraFields: ['plan', 'seq', 'state', 'progress', 'source'],
      },
    },
  });
  const created = createItem(s.ctx, {
    type: 'task', title: 'Ship extra-field ownership',
    extra: { plan: '2026-08-20-v2', seq: '7', state: 'done', progress: '100', source: 'plan' },
  });
  assert.equal(created.created, true, created.message);
  assert.deepEqual(s.ctx.store.get(created.id)!.extra, {
    plan: '2026-08-20-v2', seq: '7', state: 'done', progress: '100', source: 'plan',
  });
  s.dispose();
});

/** ...and the coupling, stated as a test: the SAME item without the config
 * entry is refused, which is why the two halves cannot ship apart. */
test('the same custom-category item is refused when config declares no extraFields', () => {
  const s = sandbox({
    categories: { task: { tier: 'rationale', description: 'A unit of planned work' } },
  });
  assert.throws(
    () => createItem(s.ctx, {
      type: 'task', title: 'Ship extra-field ownership', extra: { plan: '2026-08-20-v2' },
    }),
    (err: Error) => {
      assert.match(err.message, /extra field "plan" is not declared by "task"/);
      assert.match(err.message, /A "task" declares no extra fields at all\./);
      assert.match(err.message, /categories\.task\.extraFields/);
      return true;
    },
  );
  s.dispose();
});

/** A config-declared field on a BUILT-IN category extends the catalogue rather
 * than replacing it, and the write path sees both. The catalogue field is the
 * assertion that matters: replace would pass a test checking only `owner`. */
test('a built-in category with a config extraFields entry accepts BOTH fields', () => {
  const s = sandbox({ categories: { rule: { extraFields: ['owner'] } } });
  const created = createItem(s.ctx, {
    type: 'rule', title: 'Never log customer email',
    extra: { directive: 'dont', owner: 'platform' },
  });
  assert.equal(created.created, true, created.message);
  assert.deepEqual(s.ctx.store.get(created.id)!.extra, { directive: 'dont', owner: 'platform' });
  s.dispose();
});

/** The pipeline's own provenance is exempt, and must stay exempt: ingest stamps
 * `content_hash` and `ingest_key` on every item of every category, and reads
 * them back to dedupe and to supersede. They are not declared by any category
 * — declaring them would advertise the dedupe key to every model through the
 * union `create_item` schema — so they are exempted by name in trust.ts. */
test('the ingest provenance keys are accepted on any category, and advertised on none', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20',
    extra: { content_hash: 'abc123', ingest_key: 'def456' },
  });
  assert.equal(created.created, true, created.message);
  // Exempt, NOT declared — the distinction the exemption exists for. Declaring
  // them would put the pipeline's dedupe key into the union the MCP
  // `create_item` schema is built from, offering every model a field that
  // silently dedupes an unrelated item away when it is set by hand.
  const union = extraFieldNames(s.ctx.config);
  assert.equal(union.includes('content_hash'), false);
  assert.equal(union.includes('ingest_key'), false);
  s.dispose();
});
