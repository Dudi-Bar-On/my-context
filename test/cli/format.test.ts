import { test } from 'node:test';
import assert from 'node:assert/strict';
import { col, detailLevel, table, wantsJson } from '../../src/cli/commands/format.ts';

test('table prints a header row and a rule above the data', () => {
  const lines = table(['id', 'type'], [['CONST-a', 'constraint']]);
  assert.deepEqual(lines, [
    'id       type',
    '-------  ----------',
    'CONST-a  constraint',
  ]);
});

test('table widens a column to fit the widest cell, header included', () => {
  const lines = table(['id'], [['a-very-long-identifier']]);
  // Trailing padding is trimmed, so the header of a single-column table is
  // just the header — the rule below it is what shows the column's width.
  assert.equal(lines[0], 'id');
  assert.equal(lines[1], '----------------------');
  assert.equal(lines[2], 'a-very-long-identifier');
});

test('table renders no rows as no lines at all, not a bare header', () => {
  assert.deepEqual(table(['id', 'type'], []), []);
});

test('table never lets a cell collide with the next column', () => {
  // The `padEnd(44)` collision this replaces: this repo's real ids reach 63
  // characters, and a fixed width ran them straight into the next field.
  const long = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondition';
  const [, , row] = table(['id', 'type'], [[long, 'invariant'], ['CONST-a', 'constraint']]);
  assert.equal(row, `${long}  invariant`);
});

test('table tolerates a row with fewer cells than there are headers', () => {
  const lines = table(['id', 'type'], [['CONST-a']]);
  assert.equal(lines[2], 'CONST-a');
});

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
