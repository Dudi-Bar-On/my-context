import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, serializeFrontmatter } from '../../src/core/frontmatter.ts';

test('parses scalars with types', () => {
  const fm = parseFrontmatter('id: CONST-a\nalways: false\ncount: 3\nvalid_until: null\n');
  assert.equal(fm.id, 'CONST-a');
  assert.equal(fm.always, false);
  assert.equal(fm.count, 3);
  assert.equal(fm.valid_until, null);
});

test('parses inline and block arrays', () => {
  const fm = parseFrontmatter('tags: [database, perf]\nscope:\n  - "src/db/**"\n  - src/api/**\n');
  assert.deepEqual(fm.tags, ['database', 'perf']);
  assert.deepEqual(fm.scope, ['src/db/**', 'src/api/**']);
});

test('an empty inline array yields an empty list', () => {
  assert.deepEqual(parseFrontmatter('tags: []\n').tags, []);
});

test('quoted values keep colons and hashes', () => {
  const fm = parseFrontmatter('title: "a: b # c"\n');
  assert.equal(fm.title, 'a: b # c');
});

test('comments and blank lines are ignored', () => {
  const fm = parseFrontmatter('# a comment\n\nid: X\n');
  assert.equal(fm.id, 'X');
});

test('unsupported syntax throws with the line number', () => {
  assert.throws(() => parseFrontmatter('id: X\nnested:\n  deep:\n    a: 1\n'), /line 3/);
  assert.throws(() => parseFrontmatter('- bare list item\n'), /line 1/);
});

test('serialize then parse round-trips', () => {
  const data = {
    id: 'CONST-a', title: 'a: b', always: true, valid_until: null,
    scope: ['src/**'], tags: [],
  };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('serialize quotes values that need it', () => {
  const out = serializeFrontmatter({ title: 'a: b', plain: 'ok' });
  assert.match(out, /title: "a: b"/);
  assert.match(out, /plain: ok/);
});

test('a digit-only string is quoted so it does not return as a number', () => {
  const out = serializeFrontmatter({ checksum: '0000000000000000' });
  assert.match(out, /checksum: "0000000000000000"/);
  assert.equal(parseFrontmatter(out).checksum, '0000000000000000');
});

test('strings that look like booleans or null are quoted', () => {
  const data = { a: 'true', b: 'null', c: '42' };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});
