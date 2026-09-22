// @basis CONST-node-24-no-build-step, INV-nothing-is-dropped-silently
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { escapesRoot } from '../../src/core/paths.ts';

test('a relative path inside the root does not escape', () => {
  assert.equal(escapesRoot('docs/a.md'), false);
});
test('the three classic escapes are refused', () => {
  assert.equal(escapesRoot(''), true);
  assert.equal(escapesRoot('..'), true);
  assert.equal(escapesRoot('../x.md'), true);
});
test('a win32 cross-drive relative is absolute and is refused, on every host', () => {
  // What path.relative returns on Windows for two different drives: the target, absolute.
  const rel = path.win32.relative('D:\\repo', 'C:\\Users\\x\\scratch\\r4.md').replace(/\\/g, '/');
  assert.equal(rel, 'C:/Users/x/scratch/r4.md');
  assert.equal(escapesRoot(rel), true);
});
test('a posix absolute is refused too', () => {
  assert.equal(escapesRoot('/etc/passwd'), true);
});
