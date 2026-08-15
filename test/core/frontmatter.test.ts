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

test('quoted commas inside inline array elements are not treated as separators', () => {
  const fm = parseFrontmatter('tags: ["a,b", "c"]\n');
  assert.deepEqual(fm.tags, ['a,b', 'c']);
});

test('a single-quoted element containing a comma parses correctly', () => {
  const fm = parseFrontmatter("tags: ['a,b', 'c']\n");
  assert.deepEqual(fm.tags, ['a,b', 'c']);
});

test('an escaped quote inside a quoted array element survives', () => {
  const fm = parseFrontmatter('tags: ["say \\"hi\\"", "c"]\n');
  assert.deepEqual(fm.tags, ['say "hi"', 'c']);
});

test('a duplicate scalar key throws, naming the line', () => {
  assert.throws(() => parseFrontmatter('id: X\nid: Y\n'), /line 2/);
  assert.throws(() => parseFrontmatter('id: X\nid: Y\n'), /id/);
});

test('a duplicate block-array key throws', () => {
  assert.throws(
    () => parseFrontmatter('scope:\n  - a\nscope:\n  - b\n'),
    /line 3/,
  );
});

test('an unterminated inline array throws', () => {
  assert.throws(() => parseFrontmatter('tags: [a, b\n'), /line 1/);
});

test('a hyphenated key parses — plugin command frontmatter uses them', () => {
  // `commands/*.md` carry `argument-hint` and `disable-model-invocation`.
  // This parser rejected every hyphenated key, which is why the test guarding
  // that surface checked shape with regexes and missed unparseable YAML.
  const fm = parseFrontmatter('argument-hint: "[--full] [--json]"\ndisable-model-invocation: true\n');
  assert.equal(fm['argument-hint'], '[--full] [--json]');
  assert.equal(fm['disable-model-invocation'], true);
});

test('a key may not START with a hyphen — a bare list item is still an error', () => {
  assert.throws(() => parseFrontmatter('-key: x\n'), /line 1/);
});

test('two flow sequences on one line throw rather than yielding one bogus element', () => {
  // The shipped defect: `[--full|--short|--summary] [--json]` starts with `[`
  // and ends with `]`, so it looked like an array and parsed as the single
  // element `--full|--short|--summary] [--json`. Real YAML rejects it, and
  // `claude plugin validate` reported the command loads with NO metadata.
  assert.throws(() => parseFrontmatter('argument-hint: [--full|--short] [--json]\n'), /line 1/);
});

test('a nested inline collection throws rather than being flattened', () => {
  assert.throws(() => parseFrontmatter('tags: [a, [b, c]]\n'), /line 1/);
  assert.throws(() => parseFrontmatter('tags: [a, {b: c}]\n'), /line 1/);
});

test('a quoted array element may still contain brackets', () => {
  const fm = parseFrontmatter('tags: ["[draft]", b]\n');
  assert.deepEqual(fm.tags, ['[draft]', 'b']);
});

test('a quoted value that starts with a bracket still parses as a string', () => {
  const fm = parseFrontmatter('title: "[draft] thing"\n');
  assert.equal(fm.title, '[draft] thing');
});

test('an unterminated quoted scalar throws', () => {
  assert.throws(() => parseFrontmatter('title: "abc\n'), /line 1/);
});

test('a trailing comma in an inline array throws rather than yielding an empty element', () => {
  assert.throws(() => parseFrontmatter('tags: [db,]\n'), /line 1/);
});

test('an empty element between commas in an inline array throws', () => {
  assert.throws(() => parseFrontmatter('scope: [a,,b]\n'), /line 1/);
});

test('a deliberate quoted empty string element is not treated as malformed', () => {
  const fm = parseFrontmatter('tags: ["", "a"]\n');
  assert.deepEqual(fm.tags, ['', 'a']);
});

// --- values beginning with a quote character: previously either unparseable
// ('auth, no closing quote) or silently stripped ("auth" -> auth) ---

test('a value starting with a double quote round-trips exactly', () => {
  const data = { title: '"Least privilege" applies to every service' };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('a value starting with a single quote round-trips exactly', () => {
  const data = { title: "'tis a title about caching" };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('a value that is itself a fully-quoted string round-trips with its quotes intact', () => {
  const data = { kind: '"auth"' };
  const out = serializeFrontmatter(data);
  assert.deepEqual(parseFrontmatter(out), data);
  // Not silently unwrapped to the bare inner string.
  assert.notEqual(parseFrontmatter(out).kind, 'auth');
});

test('a scope-list element starting with a single quote round-trips exactly', () => {
  const data = { scope: ["'auth/**"] };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('a scope-list element that is itself a fully-quoted string round-trips intact', () => {
  const data = { scope: ['"auth/**"'] };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

// --- backslashes: previously unescaped, so a value ending in one, or
// containing a raw \" sequence, produced an unclosable quoted scalar ---

test('a value ending in a backslash round-trips exactly', () => {
  const data = { title: 'trailing backslash: a\\' };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('a value containing a raw backslash-quote sequence round-trips exactly', () => {
  const data = { title: 'contains: a\\"b' };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('a value with a backslash that does not otherwise need quoting is unchanged (no regression)', () => {
  // No colon/hash/leading-quote/leading-dash — this value never needed
  // quoting before, and still doesn't; the backslash is written raw.
  const out = serializeFrontmatter({ plain: 'back\\slash' });
  assert.match(out, /plain: back\\slash/);
  assert.equal(parseFrontmatter(out).plain, 'back\\slash');
});

test('an inline array element ending in a backslash round-trips exactly', () => {
  const data = { tags: ['a\\', 'b'] };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});
