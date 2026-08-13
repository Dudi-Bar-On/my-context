import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument, normalizeEol, sourceChecksum } from '../../src/ingest/chunk.ts';

const DOC = `Some preamble prose.

# Auth requirements

The system must support SSO.

## Password policy

Passwords must be at least 12 characters.

## Password policy

A second section with a colliding heading.
`;

test('an empty document yields no chunks', () => {
  assert.deepEqual(chunkDocument(''), []);
  assert.deepEqual(chunkDocument('\n\n   \n'), []);
});

test('preamble before the first heading becomes its own chunk', () => {
  const chunks = chunkDocument(DOC);
  assert.equal(chunks[0].anchor, '_preamble');
  assert.equal(chunks[0].heading, null);
  assert.equal(chunks[0].text, 'Some preamble prose.');
});

test('each heading starts a chunk anchored on its slug', () => {
  const chunks = chunkDocument(DOC);
  assert.deepEqual(
    chunks.map((c) => c.anchor),
    ['_preamble', 'auth-requirements', 'password-policy', 'password-policy-2'],
  );
});

test('the heading line is retained in the chunk text', () => {
  const chunks = chunkDocument(DOC);
  assert.match(chunks[1].text, /^# Auth requirements/);
  assert.match(chunks[1].text, /must support SSO/);
});

test('indexes are sequential and match array position', () => {
  const chunks = chunkDocument(DOC);
  chunks.forEach((c, i) => assert.equal(c.index, i));
});

test('an oversize section is split into numbered sub-chunks', () => {
  const doc = `# Big\n\n${'para one. '.repeat(40)}\n\n${'para two. '.repeat(40)}\n`;
  const chunks = chunkDocument(doc, { maxChars: 300 });
  assert.ok(chunks.length > 1, `expected a split, got ${chunks.length}`);
  assert.equal(chunks[0].anchor, 'big--1');
  assert.equal(chunks[1].anchor, 'big--2');
  for (const c of chunks) assert.ok(c.text.length <= 300, `chunk ${c.anchor} is ${c.text.length}`);
});

test('a single paragraph longer than the limit is hard-split rather than dropped', () => {
  const doc = `# Big\n\n${'x'.repeat(500)}\n`;
  const chunks = chunkDocument(doc, { maxChars: 200 });
  const joined = chunks.map((c) => c.text).join('');
  assert.ok(joined.includes('x'.repeat(200)));
  assert.equal(chunks.every((c) => c.text.length <= 200), true);
});

test('CRLF input produces identical chunks and checksums to LF input', () => {
  const lf = chunkDocument(DOC);
  const crlf = chunkDocument(DOC.replace(/\n/g, '\r\n'));
  assert.deepEqual(crlf, lf);
});

test('chunk checksums are stable and differ when the text changes', () => {
  const a = chunkDocument(DOC)[2];
  const b = chunkDocument(DOC)[2];
  assert.equal(a.checksum, b.checksum);
  const edited = chunkDocument(DOC.replace('12 characters', '16 characters'))[2];
  assert.notEqual(edited.checksum, a.checksum);
  assert.equal(edited.anchor, a.anchor, 'the anchor must survive an edit to the body');
});

test('normalizeEol removes every carriage return', () => {
  assert.equal(normalizeEol('a\r\nb\rc'), 'a\nb\nc');
});

test('sourceChecksum ignores line-ending and trailing-whitespace differences', () => {
  assert.equal(sourceChecksum('a\nb\n'), sourceChecksum('a\r\nb\r\n\n'));
  assert.notEqual(sourceChecksum('a\nb\n'), sourceChecksum('a\nc\n'));
});

test('a heading of only punctuation still yields a usable anchor', () => {
  const chunks = chunkDocument('# !!!\n\nbody\n');
  assert.equal(chunks[0].anchor, 'section');
});
