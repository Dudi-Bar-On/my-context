import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, makeId, checksum } from '../../src/core/slug.ts';

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Postgres connection pool capped at 20'), 'postgres-connection-pool-capped-at-20');
});

test('slugify strips punctuation and collapses separators', () => {
  assert.equal(slugify('Use SQLite JSONB -- for the KB!'), 'use-sqlite-jsonb-for-the-kb');
});

test('slugify is deterministic across case variants', () => {
  assert.equal(slugify('PG Pool Cap'), slugify('pg pool cap'));
});

test('slugify truncates on a word boundary', () => {
  const long = slugify('a'.repeat(20) + ' ' + 'b'.repeat(60));
  assert.ok(long.length <= 60, `got ${long.length}`);
});

test('makeId keeps the prefix uppercase and the body lowercase', () => {
  assert.equal(makeId('CONST', 'PG Pool Cap'), 'CONST-pg-pool-cap');
});

// Cross-platform determinism (spec §5.4) depends on NFKD normalization
// stripping combining diacritics before slugifying, rather than leaving them
// to fall out through the `[^a-z0-9]` filter in a platform-dependent way.
test('slugify strips diacritics via NFKD normalization', () => {
  assert.equal(slugify('Café résumé'), 'cafe-resume');
  assert.equal(slugify('Ångström'), 'angstrom');
});

test('checksum is stable and 16 hex chars', () => {
  const a = checksum('hello');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, checksum('hello'));
  assert.notEqual(a, checksum('hello '));
});
