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

test('an oversize section is split into content-addressed sub-chunks', () => {
  const doc = `# Big\n\n${'para one. '.repeat(40)}\n\n${'para two. '.repeat(40)}\n`;
  const chunks = chunkDocument(doc, { maxChars: 300 });
  assert.ok(chunks.length > 1, `expected a split, got ${chunks.length}`);
  for (const c of chunks) assert.ok(c.text.length <= 300, `chunk ${c.anchor} is ${c.text.length}`);
  assert.equal(new Set(chunks.map((c) => c.anchor)).size, chunks.length, 'anchors must be unique');
  for (const c of chunks) assert.match(c.anchor, /^big(--[0-9a-f]{8})?(-\d+)?$/);
  assert.match(chunks[0].text, /^# Big/);
  assert.ok(chunks[0].text.trim().length > '# Big'.length, 'first sub-chunk must carry real content, not just the heading');

  const again = chunkDocument(doc, { maxChars: 300 });
  assert.deepEqual(again.map((c) => c.anchor), chunks.map((c) => c.anchor), 'anchors are deterministic across runs');
});

test('inserting a paragraph in an oversize section does not change a sibling sub-chunk anchor', () => {
  const p1 = 'alpha '.repeat(30);
  const p2 = 'beta '.repeat(30);
  const p3 = 'gamma '.repeat(30);
  const before = `# Big\n\n${p1}\n\n${p3}\n`;
  const after = `# Big\n\n${p1}\n\n${p2}\n\n${p3}\n`;

  const beforeChunks = chunkDocument(before, { maxChars: 200 });
  const afterChunks = chunkDocument(after, { maxChars: 200 });

  const gammaBefore = beforeChunks.find((c) => c.text.includes('gamma'));
  const gammaAfter = afterChunks.find((c) => c.text.includes('gamma'));
  assert.ok(gammaBefore && gammaAfter, 'expected a gamma sub-chunk in both documents');
  assert.equal(gammaBefore.text, gammaAfter.text);
  assert.equal(gammaBefore.anchor, gammaAfter.anchor, 'inserting a sibling paragraph must not re-anchor this sub-chunk');
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

test('a closing ATX hash sequence is stripped from the stored heading', () => {
  const chunks = chunkDocument('# Closed ##\n\nbody\n');
  assert.equal(chunks[0].heading, 'Closed');
});

test('anchors are unique even with three colliding headings', () => {
  const doc = '## Password policy\n\nA\n\n## Password policy\n\nB\n\n## Password policy 2\n\nC\n';
  const chunks = chunkDocument(doc);
  const anchors = chunks.map((c) => c.anchor);
  assert.equal(new Set(anchors).size, anchors.length, 'every anchor in the document must be unique');
  assert.deepEqual(anchors, ['password-policy', 'password-policy-2', 'password-policy-2-2']);
});

test('a document with no headings is a single preamble chunk', () => {
  const chunks = chunkDocument('Just some prose.\n\nMore prose.\n');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].anchor, '_preamble');
  assert.equal(chunks[0].heading, null);
});

test('anchors are stable when unrelated text elsewhere in the document changes', () => {
  const before = chunkDocument(DOC).map((c) => c.anchor);
  const edited = DOC
    .replace('Some preamble prose.', 'Some preamble prose, now with extra unrelated detail.')
    .replace('The system must support SSO.', 'The system must support SSO and MFA.');
  const after = chunkDocument(edited).map((c) => c.anchor);
  assert.deepEqual(after, before);
});

test('a heading-shaped line inside a fenced code block does not start a new chunk', () => {
  const doc = [
    '# Install',
    '',
    'Run this:',
    '',
    '```bash',
    '# install deps',
    'npm i',
    '```',
    '',
    '# Usage',
    '',
    'more text',
    '',
  ].join('\n');

  const chunks = chunkDocument(doc);
  assert.deepEqual(chunks.map((c) => c.anchor), ['install', 'usage']);
  assert.match(chunks[0].text, /```bash/);
  assert.match(chunks[0].text, /# install deps/);
  assert.match(chunks[0].text, /npm i\n```/);
});

test('editing content inside a fenced code block does not re-anchor a sibling section', () => {
  const lines = [
    '# Install',
    '',
    'Run this:',
    '',
    '```bash',
    '# install deps',
    'npm i',
    '```',
    '',
    '# Usage',
    '',
    'more text',
    '',
  ];
  const before = chunkDocument(lines.join('\n')).map((c) => c.anchor);
  const edited = lines.map((l) => (l === '# install deps' ? '# install dependencies now' : l));
  const after = chunkDocument(edited.join('\n')).map((c) => c.anchor);
  assert.deepEqual(after, before);
});
