/**
 * `CANDIDATE_SCHEMA` declares `additionalProperties: false` at both the
 * candidate level and the observation level. The candidate level was
 * enforced; the observation level was not — an observation carrying
 * `"rationale": "NIST 800-63B"` applied with `created 1`, zero issues, and
 * the field simply gone. Silent loss, while the schema the model was shown
 * promised the opposite.
 *
 * These assert the enforcement at every level the schema makes that promise,
 * and that the accepted-key list in the message really is the schema's own
 * list rather than a hand-copied one that can drift.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCandidates, CANDIDATE_SCHEMA, CANDIDATE_FIELDS, OBSERVATION_FIELDS,
} from '../../src/ingest/schema.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Chunk } from '../../src/ingest/chunk.ts';

const CONFIG = resolveConfig({});

const CHUNK: Chunk = {
  index: 0,
  anchor: 'password-policy',
  heading: 'Password policy',
  text: '# Password policy\n\nPasswords must be at least 12 characters.',
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

/** The observation-level `properties` the model is actually shown. */
function schemaObservationKeys(): string[] {
  const items = (CANDIDATE_SCHEMA as { items: { properties: Record<string, unknown> } }).items;
  const observations = items.properties.observations as {
    items: { properties: Record<string, unknown>; additionalProperties: unknown };
  };
  assert.equal(observations.items.additionalProperties, false, 'the schema must still promise this');
  return Object.keys(observations.items.properties);
}

test('the observation-level accepted key list is the schema\'s own, not a copy', () => {
  assert.deepEqual(OBSERVATION_FIELDS, schemaObservationKeys());
});

test('an observation carrying a key the reader does not consume is rejected, not dropped', () => {
  const result = validateCandidates(
    [candidate({
      observations: [{ category: 'note', text: 'Twelve is the floor', rationale: 'NIST 800-63B' }],
    })],
    CONFIG, CHUNK,
  );
  assert.equal(result.valid.length, 0, 'the candidate must not be accepted with the field silently gone');
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].message, /observations\[0\]/);
  assert.match(result.issues[0].message, /"rationale"/);
  // The message must teach the accepted set, in the style of its neighbours.
  for (const field of OBSERVATION_FIELDS) {
    assert.match(result.issues[0].message, new RegExp(field));
  }
});

test('the offending observation is named by its own index, not always [0]', () => {
  const result = validateCandidates(
    [candidate({
      observations: [
        { category: 'note', text: 'Fine' },
        { category: 'note', text: 'Also fine' },
        { category: 'note', text: 'Bad', severity: 'hard' },
      ],
    })],
    CONFIG, CHUNK,
  );
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /observations\[2\]/);
  assert.match(result.issues[0].message, /"severity"/);
});

test('every key the schema does declare is still accepted', () => {
  const result = validateCandidates(
    [candidate({
      observations: [{ category: 'note', text: 'Twelve is the floor', tags: ['auth'], context: 'at registration' }],
    })],
    CONFIG, CHUNK,
  );
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.valid[0].observations, [
    { category: 'note', text: 'Twelve is the floor', tags: ['auth'], context: 'at registration' },
  ]);
});

test('the candidate level rejects an unknown key too, and names the schema\'s own set', () => {
  const result = validateCandidates([candidate({ source_anchor: 'password-policy' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /"source_anchor"/);
  for (const field of CANDIDATE_FIELDS) {
    assert.match(result.issues[0].message, new RegExp(field));
  }
});

test('a candidate carrying __proto__ is rejected as an unknown field, not silently absorbed', () => {
  // `CANDIDATE_FIELDS` is a plain array and the check is
  // `Object.keys(entry).find(k => !CANDIDATE_FIELDS.includes(k))`. Whether
  // that sees `__proto__` at all depends on it being an OWN enumerable
  // property, which an object literal does not produce and `JSON.parse` does
  // — and candidates arrive as parsed JSON. Asserted rather than reasoned
  // about, because the same key defeated `optExtra` (mcp/tools.ts) and
  // `renderItem` (core/item.ts) in exactly this way.
  const entry = JSON.parse(JSON.stringify(candidate())) as Record<string, unknown>;
  const withProto = JSON.parse(`{"__proto__": {"polluted": true}, ${
    JSON.stringify(entry).slice(1)
  }`) as Record<string, unknown>;
  const result = validateCandidates([withProto], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0, 'the candidate must be rejected whole');
  assert.match(result.issues[0].message, /"__proto__"/);
  assert.equal(
    ({} as Record<string, unknown>).polluted, undefined,
    'and nothing may have been written onto Object.prototype on the way through',
  );
});

test('`additionalProperties: false` appears at exactly the levels enforced above', () => {
  // A future field whose schema declares the same promise must not be able to
  // go unenforced unnoticed: this fails when a THIRD such object appears.
  const seen: string[] = [];
  const walk = (node: unknown, at: string): void => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`));
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    if (record.additionalProperties === false) seen.push(at);
    for (const [key, value] of Object.entries(record)) walk(value, at === '' ? key : `${at}.${key}`);
  };
  walk(CANDIDATE_SCHEMA, '');
  assert.deepEqual(seen, ['items', 'items.properties.observations.items']);
});
