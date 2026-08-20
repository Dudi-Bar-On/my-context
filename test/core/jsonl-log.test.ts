/**
 * `src/core/jsonl-log.ts` — the protocol check, and the ONE widening it grew.
 *
 * There was no suite for this module: its behaviour was pinned only through
 * `revision.ts`, `seen-file.ts` and `audit.ts`, each of which passed exactly one
 * protocol value. `JsonlLogSpec.accepts` (categories plan Task 8 step 3a) makes
 * the read set wider than the write value for the first time, and the reason it
 * is a SET rather than a bumped string is a failure mode nothing else here can
 * express: a build that compares `!==` against what it writes refuses every log
 * every existing user already has, on the first command after an upgrade.
 *
 * So this file pins both halves — the widening, and the default that leaves the
 * single-protocol callers behaving exactly as they did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseJsonlLog, type JsonlLogSpec, type JsonlRow } from '../../src/core/jsonl-log.ts';

const FILE = '/tmp/example.jsonl';

function spec(over: Partial<JsonlLogSpec> = {}): JsonlLogSpec {
  return {
    file: FILE,
    protocol: 'example@2',
    validate: (row: JsonlRow) => (typeof row.at === 'string' ? null : 'is missing "at"'),
    refuse: (line, reason) => new Error(`example: line ${line} ${reason}.`),
    unreadable: (err) => new Error(`example: unreadable (${String(err)})`),
    ...over,
  };
}

const line = (protocol: string): string =>
  `${JSON.stringify({ protocol, at: '2026-08-20T00:00:00.000Z' })}\n`;

test('with no accepts, the read set is exactly the write value — the old behaviour', () => {
  assert.equal(parseJsonlLog(line('example@2'), spec()).length, 1);
  assert.throws(() => parseJsonlLog(line('example@1'), spec()), (err: Error) => {
    assert.match(err.message, /declares protocol "example@1", expected "example@2"/);
    assert.match(err.message, /different version/);
    return true;
  });
});

test('accepts widens the read set without moving the write value', () => {
  const s = spec({ accepts: ['example@1', 'example@2'] });
  assert.equal(s.protocol, 'example@2', 'the value WRITTEN is untouched by the widening');
  assert.equal(parseJsonlLog(line('example@1') + line('example@2'), s).length, 2);
});

test('a protocol outside the accepted set is refused, and the refusal names the whole set', () => {
  const s = spec({ accepts: ['example@1', 'example@2'] });
  assert.throws(() => parseJsonlLog(line('example@3'), s), (err: Error) => {
    assert.match(err.message, /declares protocol "example@3"/);
    assert.match(err.message, /expected "example@1" or "example@2"/);
    return true;
  });
});

test('an empty accepts is not a wildcard — it accepts nothing, loudly', () => {
  const s = spec({ accepts: [] });
  assert.throws(() => parseJsonlLog(line('example@2'), s), /declares protocol "example@2"/);
});

test('skew is refused on the FINAL line too, accepts or not — it is not a torn write', () => {
  // No trailing newline: the one shape a killed writer leaves, and the one
  // case every OTHER damage check tolerates.
  const torn = JSON.stringify({ protocol: 'example@9', at: '2026-08-20T00:00:00.000Z' });
  assert.throws(() => parseJsonlLog(torn, spec()), /declares protocol "example@9"/);
  assert.throws(
    () => parseJsonlLog(torn, spec({ accepts: ['example@1', 'example@2'] })),
    /declares protocol "example@9"/,
  );
});

test('a row with no protocol at all is refused rather than defaulted', () => {
  const bare = `${JSON.stringify({ at: '2026-08-20T00:00:00.000Z' })}\n`;
  assert.throws(() => parseJsonlLog(bare, spec()), /declares protocol undefined/);
  assert.throws(
    () => parseJsonlLog(bare, spec({ accepts: ['example@1', 'example@2'] })),
    /declares protocol undefined/,
  );
});

test('the widening reaches the protocol check only — validate still refuses', () => {
  const s = spec({ accepts: ['example@1', 'example@2'] });
  const noAt = `${JSON.stringify({ protocol: 'example@1' })}\n${line('example@2')}`;
  assert.throws(() => parseJsonlLog(noAt, s), /line 1 is missing "at"/);
});

/**
 * The single-protocol callers are untouched BY CONSTRUCTION rather than by
 * inspection: they declare no `accepts`, so the default is the only thing that
 * can apply to them. A future edit that hands one of them a set would have to
 * change this file too.
 */
test('revision-log.ts and seen-file.ts pass no accepts, so their read set did not widen', () => {
  const src = (name: string): string => readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', name), 'utf8');
  assert.doesNotMatch(src('revision-log.ts'), /accepts/);
  assert.doesNotMatch(src('seen-file.ts'), /accepts/);
});
