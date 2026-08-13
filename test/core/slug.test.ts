import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, makeId, checksum, normalizeForSlug } from '../../src/core/slug.ts';

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

/**
 * F3: a naive "back off to the last hyphen inside the 60-char cut" throws
 * away a LAST WORD THAT ALREADY FIT — if the cut happens to land exactly at
 * the end of a complete word (the next character in the un-truncated slug is
 * a hyphen, not a letter), there is nothing partial to discard. The old
 * implementation backed off anyway, because `cut.lastIndexOf('-')` cannot
 * tell "this hyphen precedes a partial word" from "this hyphen precedes a
 * complete word that happens to end exactly at the boundary" — it dropped a
 * complete trailing word every time the cut landed exactly on one.
 *
 * This is the literal dogfooding case: "A behavioural guarantee in a
 * comment needs a test, not better wording" used to slugify down to
 * "...needs-a-test-not" — severing "not" from "better wording" — even
 * though "better" fit completely inside the 60-char ceiling.
 */
test('slugify keeps a complete trailing word that exactly fills the ceiling, rather than backing off past it', () => {
  const title = 'A behavioural guarantee in a comment needs a test, not better wording';
  const result = slugify(title);
  assert.equal(result, 'a-behavioural-guarantee-in-a-comment-needs-a-test-not-better');
  assert.ok(!result.endsWith('-not'), `should not sever "not" from "better": got ${result}`);
});

/**
 * General property, not just the one pinned example: whatever `slugify`
 * returns for an over-length title, the next character of the FULL
 * (untruncated) slug must be a hyphen or end-of-string — never a letter or
 * digit. If it were a letter/digit, the returned slug would end partway
 * through a word that continues beyond it, i.e. an actual mid-word cut.
 */
test('slugify never cuts off in the middle of a word, for a range of over-length titles', () => {
  const titles = [
    'A behavioural guarantee in a comment needs a test, not better wording',
    'The quick brown fox jumps over the lazy dog while the cat watches quietly from the windowsill',
    'x'.repeat(100),
    'one two three four five six seven eight nine ten eleven twelve thirteen',
  ];
  // Built from a string, not a literal char class, for the same reason
  // slug.ts's own COMBINING regex is: combining diacritics are invisible
  // and easy to corrupt as literal source characters.
  const combining = new RegExp('[\\u0300-\\u036f]', 'g');
  for (const title of titles) {
    const full = title
      .normalize('NFKD')
      .replace(combining, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const result = slugify(title);
    assert.ok(result.length <= 60, `over ceiling: got ${result.length} for ${JSON.stringify(title)}`);
    assert.ok(!result.endsWith('-'), `trailing separator: ${JSON.stringify(result)}`);
    // A title with no hyphen anywhere in its first 60 chars is a single
    // word with no boundary to back off to at all (e.g. a 100-char run with
    // no whitespace) — a hard character cut is the only option there, and
    // that pre-existing fallback is out of scope for this fix. The
    // no-mid-word guarantee only applies when a real boundary exists.
    const hasBoundary = full.slice(0, 60).includes('-');
    if (full.length > 60 && hasBoundary) {
      const boundaryChar = full.charAt(result.length);
      assert.ok(
        boundaryChar === '' || boundaryChar === '-',
        `mid-word cut for ${JSON.stringify(title)}: result ${JSON.stringify(result)} is followed ` +
        `by ${JSON.stringify(boundaryChar)} in the untruncated slug`,
      );
    }
  }
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

test('normalizeForSlug applies the same normalization as slugify, but without the 60-char truncation', () => {
  const short = 'PG Pool Cap';
  assert.equal(normalizeForSlug(short), slugify(short));

  // Two titles that collide once truncated to 60 chars must NOT collide in
  // the untruncated form — that's the whole reason `ingestKey` (apply.ts)
  // uses this instead of `slugify`'s output.
  const prefix = 'Reject any unauthenticated request that reaches internal ';
  const t1 = `${prefix}admin endpoints without a valid session token`;
  const t2 = `${prefix}public endpoints without a valid session token`;
  assert.equal(slugify(t1), slugify(t2), 'precondition: these DO collide once truncated');
  assert.notEqual(normalizeForSlug(t1), normalizeForSlug(t2));
});

test('checksum is stable and 16 hex chars', () => {
  const a = checksum('hello');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, checksum('hello'));
  assert.notEqual(a, checksum('hello '));
});
