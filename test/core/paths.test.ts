import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toPosix, normalizePosix, matchesAnyGlob, isMainEntry } from '../../src/core/paths.ts';

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

test('isMainEntry matches identical paths', () => {
  assert.equal(isMainEntry('/a/b/index.ts', '/a/b/index.ts'), true);
});

test('isMainEntry rejects unrelated paths', () => {
  assert.equal(isMainEntry('/a/b/index.ts', '/a/b/other.ts'), false);
});

test('isMainEntry is false when either side is missing', () => {
  assert.equal(isMainEntry(undefined, '/a/b/index.ts'), false);
  assert.equal(isMainEntry('/a/b/index.ts', undefined), false);
});

test('isMainEntry resolves a symlinked argv[1] to the same real file — the npm-link-on-Windows case', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-mainentry-'));
  const real = path.join(dir, 'real.ts');
  writeFileSync(real, '// real file');
  const link = path.join(dir, 'link.ts');
  try {
    symlinkSync(real, link);
  } catch (err) {
    // Symlink creation can require elevated privileges on Windows. Skip
    // EXPLICITLY (not a silent catch-and-pass) so a green run can never be
    // mistaken for one that actually verified the symlink-resolution path.
    rmSync(dir, { recursive: true, force: true });
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
    t.skip('symlink creation requires elevated privileges in this environment');
    return;
  }
  try {
    // import.meta.filename resolves through the symlink; process.argv[1] does not.
    assert.equal(isMainEntry(real, link), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
