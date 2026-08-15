import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateCandidates, CANDIDATE_SCHEMA, CANDIDATE_FIELDS } from '../../src/ingest/schema.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Chunk } from '../../src/ingest/chunk.ts';
import { createItem } from '../../src/core/mutate.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { sandbox } from '../helpers/workspace.ts';

const CONFIG = resolveConfig({});

const CHUNK: Chunk = {
  index: 0,
  anchor: 'password-policy',
  heading: 'Password policy',
  text: '# Password policy\n\nPasswords must be at least 12 characters.\nSessions expire after 30 minutes.',
  checksum: 'abc123',
};

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration and at password change.',
    quote: 'Passwords must be at least 12 characters.',
    ...over,
  };
}

test('a well-formed candidate validates', () => {
  const result = validateCandidates([candidate()], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].type, 'requirement');
  assert.equal(result.valid[0].title, 'Passwords are at least 12 characters');
});

test('a non-array payload is one issue, not a crash', () => {
  const result = validateCandidates({ items: [] }, CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].message, /array/i);
});

test('an empty array is valid and produces nothing', () => {
  assert.deepEqual(validateCandidates([], CONFIG, CHUNK), { valid: [], issues: [] });
});

test('an unknown type is rejected with the closest legal match', () => {
  const result = validateCandidates([candidate({ type: 'requirements' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /requirements/);
  assert.match(result.issues[0].message, /closest match is "requirement"/);
});

test('a disabled category is rejected even though it is a real category', () => {
  const result = validateCandidates([candidate({ type: 'policy' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /enabled category/i);
});

test('a missing title is rejected', () => {
  const result = validateCandidates([candidate({ title: '   ' })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /"title" is required/);
});

test('an over-long title is rejected with both numbers', () => {
  const result = validateCandidates([candidate({ title: 'x'.repeat(201) })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /201/);
  assert.match(result.issues[0].message, /200/);
});

test('a quote that is not verbatim in the chunk is rejected', () => {
  const result = validateCandidates(
    [candidate({ quote: 'Passwords must be at least sixteen characters.' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /does not appear in the source chunk/);
  assert.match(result.issues[0].message, /password-policy/);
});

test('quote matching ignores whitespace and line-break differences', () => {
  const result = validateCandidates(
    [candidate({ quote: 'Passwords   must be at\nleast 12 characters.' })], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
});

test('a missing quote is rejected with instructions', () => {
  const result = validateCandidates([candidate({ quote: undefined })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /verbatim/);
});

test('a backslash in a scope glob is rejected', () => {
  const result = validateCandidates(
    [candidate({ scope: ['src\\auth\\**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /backslash/);
});

/**
 * The rejection survives the scope inversion but its reason changed. `**` is
 * no longer "too broad" against an inert default — it is now exactly what
 * omitting `scope` already means, so writing it is a redundant spelling that
 * hides the intent. The message must say that and not the old reason.
 */
test('a bare ** scope is rejected as a redundant spelling of omitting scope', () => {
  const result = validateCandidates([candidate({ scope: ['**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /matches the whole repository/i);
  assert.match(result.issues[0].message, /omitting "scope" already does/i);
  assert.doesNotMatch(result.issues[0].message, /inert/i);
});

test('an invalid severity is rejected', () => {
  const result = validateCandidates([candidate({ severity: 'critical' })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /severity/);
  assert.match(result.issues[0].message, /hard/);
});

test('good and bad candidates partition — every success is kept, every failure named', () => {
  const result = validateCandidates(
    [candidate(), candidate({ type: 'nonsense' }), candidate({ title: 'Sessions expire after 30 minutes', quote: 'Sessions expire after 30 minutes.' })],
    CONFIG, CHUNK);
  assert.equal(result.valid.length, 2);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].index, 1);
});

test('an issue carries the candidate title when there is one, for a readable report', () => {
  const result = validateCandidates([candidate({ type: 'nonsense' })], CONFIG, CHUNK);
  assert.equal(result.issues[0].title, 'Passwords are at least 12 characters');
});

test('observations are normalized to the item shape', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'At least 12 chars', tags: ['auth'] }] })],
    CONFIG, CHUNK);
  // The full `Observation` shape from core/types.ts, `context` included, so
  // Task 4 hands this straight to createItem without inventing a field here.
  assert.deepEqual(result.valid[0].observations, [
    { category: 'limit', text: 'At least 12 chars', tags: ['auth'], context: null },
  ]);
});

test('an observation context is carried through rather than dropped', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'At least 12 chars', context: 'at registration' }] })],
    CONFIG, CHUNK);
  assert.equal(result.valid[0].observations[0].context, 'at registration');
});

test('unknown extra keys are carried through as strings', () => {
  const result = validateCandidates([candidate({ extra: { kind: 'functional' } })], CONFIG, CHUNK);
  assert.deepEqual(result.valid[0].extra, { kind: 'functional' });
});

test('a bare-string scope is rejected rather than silently dropped', () => {
  const result = validateCandidates([candidate({ scope: 'src/auth/**' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"scope" must be an array/);
});

test('a bare-string tags is rejected rather than silently dropped', () => {
  const result = validateCandidates([candidate({ tags: 'auth' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"tags" must be an array/);
});

test('an observations payload that is not an array is rejected', () => {
  const result = validateCandidates(
    [candidate({ observations: { category: 'limit', text: 'x' } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"observations" must be an array/);
});

test('an observation category with a space is rejected early, aligned with the write boundary', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'root cause', text: 'x' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.category/);
  assert.match(result.issues[0].message, /root cause/);
});

test('an observation text containing "#" is rejected early, aligned with the write boundary', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'see #123' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.text/);
});

test('an observation text ending in a parenthetical is rejected early, aligned with the write boundary', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'at least 12 chars (enforced)' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.text/);
});

test('an extra key with a hyphen is rejected early, aligned with the write boundary', () => {
  const result = validateCandidates([candidate({ extra: { 'valid-until': '2027-01-01' } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /valid-until/);
});

test('an extra key colliding with a reserved frontmatter name is rejected early', () => {
  const result = validateCandidates([candidate({ extra: { id: 'REQ-9' } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /reserved/);
});

test('an extra payload that is not an object is rejected', () => {
  const result = validateCandidates([candidate({ extra: 'functional' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"extra" must be an object/);
});

test('an extra value that is an object is rejected rather than silently dropped', () => {
  const result = validateCandidates([candidate({ extra: { kind: { nested: true } } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /extra\.kind must be a string/);
});

test('the published schema names every required field', () => {
  // Copy before sorting — `required` is the live array embedded in the
  // exported (shared, module-level) CANDIDATE_SCHEMA object; sorting it
  // in place would permanently reorder that object for every other test
  // and every real caller in the same process.
  const required = [...(CANDIDATE_SCHEMA.items as { required: string[] }).required];
  assert.deepEqual(required.sort(), ['body', 'quote', 'title', 'type']);
});

test('the schema and the validator agree on exactly which fields a candidate may carry', () => {
  const schemaKeys = Object.keys((CANDIDATE_SCHEMA.items as { properties: Record<string, unknown> }).properties);
  assert.deepEqual([...schemaKeys].sort(), [...CANDIDATE_FIELDS].sort());
});

test('an unknown top-level field is rejected rather than silently accepted', () => {
  const result = validateCandidates([candidate({ source_anchor: 'no-such-chunk' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /source_anchor/);
});

// --- guards that had no dedicated test before this review pass ---

test('a non-object entry (e.g. a bare string) is rejected', () => {
  const result = validateCandidates(['just a string'], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /expected an object/);
});

test('a missing type is rejected', () => {
  const result = validateCandidates([candidate({ type: undefined })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"type" is required/);
});

test('an observation entry that is not an object is rejected', () => {
  const result = validateCandidates([candidate({ observations: ['not an object'] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\] must be an object/);
});

test('an observation missing category is rejected', () => {
  const result = validateCandidates([candidate({ observations: [{ text: 'x' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.category is required/);
});

test('an observation missing text is rejected', () => {
  const result = validateCandidates([candidate({ observations: [{ category: 'limit' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.text is required/);
});

// --- CRITICAL: body never reached validateBody, so a candidate could pass
// validation and then throw (or corrupt) at the write boundary ---

test('a body that opens with a Markdown heading is rejected, aligned with the write boundary', () => {
  const result = validateCandidates([candidate({ body: '# Password policy\n\nstuff' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /heading/);
});

test('a body containing a "## " section later on is rejected, aligned with the write boundary', () => {
  const result = validateCandidates([candidate({ body: 'Rationale.\n## Details\nmore' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /heading/);
});

// --- CRITICAL: a lone '\r' (or CRLF) line ending has no literal '\n', so a
// naive `body.split('\n')` check sees ONE harmless line and passes, while
// item.ts's own normalizeEol (applied before splitSections at parse time)
// turns the exact same text into three lines with a real section break ---

test('a body with bare-CR line endings hiding a heading is rejected, not silently truncated', () => {
  const result = validateCandidates([candidate({ body: 'prose\r## Details\rmore' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /heading/);
});

test('a body with CRLF line endings hiding a heading is rejected, not silently truncated', () => {
  const result = validateCandidates([candidate({ body: 'prose\r\n## Details\r\nmore' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /heading/);
});

// --- CRITICAL: two smaller instances of the same "throws at the write
// boundary" class — a title or extra value containing a newline ---

test('a title containing a newline is rejected', () => {
  const result = validateCandidates([candidate({ title: 'Line one\nLine two' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"title" contains a line break/);
});

test('a title containing U+2029 (PARAGRAPH SEPARATOR) is rejected', () => {
  const result = validateCandidates([candidate({ title: 'Line one\u2029Line two' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"title" contains a line break/);
});

test('an extra value containing a newline is rejected', () => {
  const result = validateCandidates([candidate({ extra: { kind: 'functional\nextra line' } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /extra\.kind contains a line break/);
});

// --- IMPORTANT: observation tags/context are LLM-authored and unvalidated;
// this is the same dogfooding bug as observation category, one field over ---

test('an observation tag that is not valid tag grammar is rejected', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'ok', tags: ['#auth'] }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.tags/);
  assert.match(result.issues[0].message, /#auth/);
});

test('an observation context ending in its own parentheses is rejected', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'ok', context: 'at (registration)' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.context/);
});

test('a parenthesis anywhere in observation context is rejected, not just a trailing one', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'ok', context: '(at) registration' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.context/);
});

// --- IMPORTANT: whitespace-run collapsing is the ONE sanctioned
// normalization — parseObservations (item.ts) does it unconditionally, so
// preserving "a  b" literally can only ever produce a checksum that never
// matches what disk holds ---

test('a double space in observation text is silently collapsed to one, matching the parser', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'Value  has   extra spaces.' }] })], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid[0].observations[0].text, 'Value has extra spaces.');
});

test('a tab in observation text is silently collapsed to a space, matching the parser', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'Value\thas\ttabs.' }] })], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid[0].observations[0].text, 'Value has tabs.');
});

// --- IMPORTANT: an empty extra value is dropped entirely on the next read
// (asString maps '' to null), so it must be refused, not silently written ---

test('an empty-string extra value is rejected rather than silently dropped on the next read', () => {
  const result = validateCandidates([candidate({ extra: { kind: '' } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /extra\.kind is an empty string/);
});

// --- minor: NEWLINE also has to catch U+2028/U+2029, which frontmatter's
// KEY_LINE regex (`.`/`$`) does not span either ---

test('a title containing U+2028 (LINE SEPARATOR) is rejected', () => {
  const result = validateCandidates([candidate({ title: 'Line one Line two' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"title" contains a line break/);
});

// --- self-initiated: the same newline-corrupts-a-single-line-format family
// as title/extra above, extended to the other single-line fields ---

test('a scope glob containing a newline is rejected', () => {
  const result = validateCandidates([candidate({ scope: ['src/auth\n/**'] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /scope\[0\] contains a line break/);
});

test('a top-level tag containing a newline is rejected', () => {
  const result = validateCandidates([candidate({ tags: ['auth\nteam'] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /tags\[0\] contains a line break/);
});

test('observation text containing a newline is rejected', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'line one\nline two' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.text contains a line break/);
});

test('observation context containing a newline is rejected', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'ok', context: 'line one\nline two' }] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[0\]\.context contains a line break/);
});

// --- MINOR: every issue message speaks in one voice, whether it came from a
// bespoke check here or was caught from a reused mutate.ts/teach.ts error ---

test('issue messages never carry the internal "my_context:" prefix, reused or bespoke alike', () => {
  const reused = validateCandidates([candidate({ severity: 'critical' })], CONFIG, CHUNK);
  const bespoke = validateCandidates([candidate({ title: '   ' })], CONFIG, CHUNK);
  assert.doesNotMatch(reused.issues[0].message, /my_context:/);
  assert.doesNotMatch(bespoke.issues[0].message, /my_context:/);
});

// --- IMPORTANT: mycontext_help is the real tool name ---

test('the too-broad scope message points at the real help tool, mycontext_help', () => {
  const result = validateCandidates([candidate({ scope: ['**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /mycontext_help\("scope"\)/);
});

// --- MINOR: grammar, silent-drop and non-mutation fixes ---

test('the "you passed" message uses correct grammar for an array ("an array", not "a an array")', () => {
  const result = validateCandidates([candidate({ extra: ['not an object'] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /You passed an array/);
  assert.doesNotMatch(result.issues[0].message, /a an array/);
});

test('the "you passed" message uses correct grammar for a vowel-leading type ("an object", not "a object")', () => {
  const result = validateCandidates([candidate({ scope: {} })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /You passed an object/);
});

test('a null extra value is rejected rather than silently dropped', () => {
  const result = validateCandidates([candidate({ extra: { kind: null } })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /extra\.kind is null/);
});

test('a non-string element in scope is rejected rather than silently filtered out', () => {
  const result = validateCandidates([candidate({ scope: ['src/auth/**', 42] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /scope\[1\] must be a non-empty string/);
});

test('a non-string element in tags is rejected rather than silently filtered out', () => {
  const result = validateCandidates([candidate({ tags: ['auth', null] })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /tags\[1\] must be a non-empty string/);
});

// --- the charter this whole file exists to prove: everything `validateCandidates`
// accepts must survive createItem -> write -> parse -> re-render with no
// drift at all — not just "no throw". This is a regression test for the
// corruption families a stress-matrix review found: quote-leading values,
// embedded quotes/backslashes in frontmatter-stored fields, whitespace
// runs in observation text, and EOL variance in body.
//
// Built as a genuine cross-product, not a hand-written list where every row
// perturbs exactly one field: a hand-written list is exactly how `body` and
// `severity` went untested in an earlier version of this file — nothing
// forced a new field to be exercised, so it silently wasn't. Every
// dimension below varies independently of every other; `TITLE_VARIANTS` x
// `BODY_VARIANTS` x `SEVERITY_VARIANTS` is the actual cross product (the
// two dimensions the review found uncovered, crossed with the dimension
// that already had tricky values), and `scope`/`tags`/`extra`/`observations`
// rotate through their own tricky values across the generated rows (by
// index, modulo each list's length) so every field gets exercised in
// combination with every OTHER field's variation, not held at a permanent
// clean default while only one field moves.

const TITLE_VARIANTS = [
  (n: number) => `Plain title ${n}`,
  (n: number) => `Quote-leading title ${n}: "Least privilege" applies to every service`,
  (n: number) => `Single-quote-leading title ${n}: 'tis a title about caching`,
  (n: number) => `Backslash title ${n}: trailing backslash a\\`,
];

// Every variant here must NOT contain a Markdown heading — a body that
// does is a REJECTED shape, already covered by the dedicated
// "body with bare-CR/CRLF line endings hiding a heading" tests above.
// These are the ACCEPTED shapes: bare-CR, CRLF, and mixed EOL, none of
// which trip validateBody, all of which must still round-trip losslessly
// once normalized at capture time (Critical 1).
const BODY_VARIANTS = [
  'Enforced at registration and at password change.',
  'Enforced at registration.\rAnd at password change.',
  'Enforced at registration.\r\nAnd at password change.',
  'Enforced at registration.\r\nAnd at\rpassword\nchange.',
];

const SEVERITY_VARIANTS: ('hard' | 'soft')[] = ['soft', 'hard'];

const SCOPE_VARIANTS: string[][] = [
  [],
  ['"weird/path/**'],
  ['"auth/**"'],
];

const TAG_VARIANTS: string[][] = [
  [],
  ["'urgent"],
];

const EXTRA_VARIANTS: Record<string, string>[] = [
  {},
  { kind: '"functional' },
  { kind: '"quoted"' },
  { kind: 'note: a\\b' },
];

const OBSERVATION_VARIANTS: Record<string, unknown>[][] = [
  [],
  [{ category: 'limit', text: 'Value  has   extra    spaces.' }],
  [{ category: 'limit', text: 'Value\thas\ttabs.' }],
  [{ category: 'limit', text: 'ok', tags: ['auth', 'db-2'], context: 'at registration' }],
];

function buildStressMatrix(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let n = 0;
  for (const title of TITLE_VARIANTS) {
    for (const body of BODY_VARIANTS) {
      for (const severity of SEVERITY_VARIANTS) {
        rows.push(candidate({
          title: title(n),
          body,
          severity,
          scope: SCOPE_VARIANTS[n % SCOPE_VARIANTS.length],
          tags: TAG_VARIANTS[n % TAG_VARIANTS.length],
          extra: EXTRA_VARIANTS[n % EXTRA_VARIANTS.length],
          observations: OBSERVATION_VARIANTS[n % OBSERVATION_VARIANTS.length],
        }));
        n++;
      }
    }
  }
  return rows;
}

const STRESS_MATRIX: Record<string, unknown>[] = buildStressMatrix();

test('every accepted stress-matrix candidate survives createItem -> write -> parse -> re-render with zero drift', () => {
  const s = sandbox();
  let checked = 0;
  try {
    for (const [i, raw] of STRESS_MATRIX.entries()) {
      const result = validateCandidates([raw], CONFIG, CHUNK);
      assert.deepEqual(
        result.issues, [],
        `matrix[${i}] (${JSON.stringify(raw.title)}) was unexpectedly rejected: ${JSON.stringify(result.issues)}`,
      );
      const v = result.valid[0];

      const out = createItem(s.ctx, {
        type: v.type, title: v.title, body: v.body, severity: v.severity,
        scope: v.scope, tags: v.tags, observations: v.observations, extra: v.extra,
      });

      const filePath = path.join(s.root, ...out.filePath.split('/'));
      const onDisk = readFileSync(filePath, 'utf8');
      const parsed = parseItem(onDisk, out.filePath, 'project');

      assert.equal(
        computeItemChecksum(parsed), parsed.checksum,
        `matrix[${i}] (${JSON.stringify(raw.title)}): checksum drifted between write and read-back`,
      );
      assert.equal(
        renderItem(parsed), onDisk,
        `matrix[${i}] (${JSON.stringify(raw.title)}): did not round-trip byte-identical`,
      );
      checked++;
    }
  } finally {
    s.dispose();
  }
  assert.equal(checked, STRESS_MATRIX.length);
});
