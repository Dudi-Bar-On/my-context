import { test } from 'node:test';
import assert from 'node:assert/strict';
import { col, detailLevel, wantsJson } from '../../src/cli/commands/format.ts';

// `table` is covered in full by `format-table.test.ts`, including the widths,
// the empty-table case and the short-row case that used to be asserted here.

test('col pads to the width but gives an over-long value its own gap', () => {
  assert.equal(col('ab', 6), 'ab    ');
  assert.equal(col('abcdef', 6), 'abcdef  ');
  assert.equal(col('abcdefgh', 6), 'abcdefgh  ');
});

test('detailLevel defaults to short and reads each level flag', () => {
  assert.equal(detailLevel([]), 'short');
  assert.equal(detailLevel(['--full']), 'full');
  assert.equal(detailLevel(['--short']), 'short');
  assert.equal(detailLevel(['--summary']), 'summary');
});

test('detailLevel honours a negated level flag rather than its mere presence', () => {
  assert.equal(detailLevel(['--full=false']), 'short');
});

test('detailLevel refuses two levels at once instead of silently picking one', () => {
  assert.throws(() => detailLevel(['--full', '--summary']), /only one of/);
});

test('wantsJson reads --json and its negation', () => {
  assert.equal(wantsJson(['--json']), true);
  assert.equal(wantsJson(['--json=false']), false);
  assert.equal(wantsJson([]), false);
});
