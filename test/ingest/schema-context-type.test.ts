import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import type { Chunk } from '../../src/ingest/chunk.ts';
import { validateCandidates } from '../../src/ingest/schema.ts';

/**
 * The same silent-drop class as I9 (unknown observation keys), one field over,
 * and found while fixing it: `context` was read as
 * `typeof o.context === 'string' ? o.context : null`, so a model that wrote
 * `context: 42` — or, more plausibly, `context: {at: "registration"}` after
 * misreading the shape — had the qualifier discarded, the candidate accepted,
 * and the apply reported `created 1` with zero issues.
 *
 * `null` and absent both legitimately mean "no context" and must stay
 * accepted, or every candidate that spells "no context" explicitly starts
 * failing. That asymmetry is the whole point of the test.
 */
const CONFIG = resolveConfig({});

const CHUNK: Chunk = {
  index: 0,
  anchor: 'pool',
  heading: 'Pool',
  text: '# Pool\n\nThe pool is capped at 20 connections.',
  checksum: 'abc123',
};

function candidate(context: unknown): unknown {
  const observation: Record<string, unknown> = { category: 'limit', text: 'Pool capped at 20' };
  if (context !== undefined) observation.context = context;
  return {
    type: 'constraint',
    title: 'Postgres pool capped at 20',
    body: 'RDS permits 25 connections.',
    quote: 'The pool is capped at 20 connections.',
    observations: [observation],
  };
}

test('a non-string context is refused, naming the field and what would be lost', () => {
  for (const bad of [42, true, { at: 'registration' }, ['at registration']]) {
    const result = validateCandidates([candidate(bad)], CONFIG, CHUNK);
    assert.equal(result.valid.length, 0, `context ${JSON.stringify(bad)} must not be accepted`);
    assert.equal(result.issues.length, 1);
    assert.match(result.issues[0].message, /observations\[0\]\.context must be a string/);
    // The message must say what the old behaviour cost, not merely "wrong type".
    assert.match(result.issues[0].message, /dropped|lost/);
  }
});

test('absent and explicit null context are both still accepted as "no context"', () => {
  for (const ok of [undefined, null]) {
    const result = validateCandidates([candidate(ok)], CONFIG, CHUNK);
    assert.equal(
      result.issues.length, 0,
      `context ${JSON.stringify(ok) ?? 'absent'} must remain accepted: ${JSON.stringify(result.issues)}`,
    );
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0].observations[0].context, null);
  }
});

test('a real string context still survives, trimmed', () => {
  const result = validateCandidates([candidate('  at registration  ')], CONFIG, CHUNK);
  assert.equal(result.issues.length, 0, JSON.stringify(result.issues));
  assert.equal(result.valid[0].observations[0].context, 'at registration');
});
