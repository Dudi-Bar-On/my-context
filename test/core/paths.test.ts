import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPosix, normalizePosix, matchesAnyGlob } from '../../src/core/paths.ts';

test('toPosix converts backslashes', () => {
  assert.equal(toPosix('src\\db\\writer.ts'), 'src/db/writer.ts');
  assert.equal(toPosix('src/db/writer.ts'), 'src/db/writer.ts');
});

test('normalizePosix strips leading ./ and trailing slashes', () => {
  assert.equal(normalizePosix('./src/db/'), 'src/db');
  assert.equal(normalizePosix('src/../src/db'), 'src/db');
  assert.equal(normalizePosix('.'), '');
});

test('glob ** at end matches nested files but not the directory itself', () => {
  assert.equal(matchesAnyGlob('src/db/writer.ts', ['src/db/**']), true);
  assert.equal(matchesAnyGlob('src/db/a/b.ts', ['src/db/**']), true);
  assert.equal(matchesAnyGlob('src/db', ['src/db/**']), false);
  assert.equal(matchesAnyGlob('src/api/x.ts', ['src/db/**']), false);
});

test('glob * stays within a segment', () => {
  assert.equal(matchesAnyGlob('src/a.ts', ['src/*.ts']), true);
  assert.equal(matchesAnyGlob('src/x/a.ts', ['src/*.ts']), false);
});

test('glob ** in the middle spans zero or more segments', () => {
  assert.equal(matchesAnyGlob('src/test.ts', ['src/**/test.ts']), true);
  assert.equal(matchesAnyGlob('src/a/b/test.ts', ['src/**/test.ts']), true);
});

test('bare ** matches everything', () => {
  assert.equal(matchesAnyGlob('anything/at/all.ts', ['**']), true);
});

test('empty pattern list matches nothing', () => {
  assert.equal(matchesAnyGlob('src/a.ts', []), false);
});

test('dots in patterns are literal', () => {
  assert.equal(matchesAnyGlob('srcXa/ts', ['src/*.ts']), false);
});
