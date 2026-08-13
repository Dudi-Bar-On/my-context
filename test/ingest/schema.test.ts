import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCandidates, CANDIDATE_SCHEMA } from '../../src/ingest/schema.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Chunk } from '../../src/ingest/chunk.ts';

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

test('a bare ** scope is rejected as defeating inert-by-default', () => {
  const result = validateCandidates([candidate({ scope: ['**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /too broad/i);
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
  const required = (CANDIDATE_SCHEMA.items as { required: string[] }).required;
  assert.deepEqual(required.sort(), ['body', 'quote', 'title', 'type']);
});
