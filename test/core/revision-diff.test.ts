import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineDiff, valueLines } from '../../src/core/revision-diff.ts';

test('lineDiff keeps an unchanged line as context between changes', () => {
  assert.deepEqual(lineDiff(['a', 'same', 'b'], ['x', 'same', 'y']), [
    { mark: '-', text: 'a' },
    { mark: '+', text: 'x' },
    { mark: ' ', text: 'same' },
    { mark: '-', text: 'b' },
    { mark: '+', text: 'y' },
  ]);
});

test('lineDiff of equal inputs is all context; of disjoint inputs, all -/+', () => {
  assert.deepEqual(lineDiff(['a'], ['a']), [{ mark: ' ', text: 'a' }]);
  assert.deepEqual(lineDiff(['a'], ['b']), [
    { mark: '-', text: 'a' }, { mark: '+', text: 'b' },
  ]);
});

test('valueLines renders tags sorted on one line and extra one line per sorted key', () => {
  assert.deepEqual(valueLines('tags', ['b', 'a']), ['a, b']);
  assert.deepEqual(valueLines('tags', []), ['(no tags)']);
  assert.deepEqual(valueLines('extra', { z: '1', a: '2' }), ['a: 2', 'z: 1']);
  assert.deepEqual(valueLines('body', 'one\ntwo'), ['one', 'two']);
  assert.equal(valueLines('title', undefined), null);
});

test('past the cell bound the diff degrades to whole-block replacement, never truncation', () => {
  const big = Array.from({ length: 600 }, (_, i) => `line ${i}`);
  const out = lineDiff(big, [...big]); // 600*600 = 360k cells > MAX_CELLS (250k)
  assert.equal(out.length, 1200); // every line of both sides is still present
  assert.ok(out.every((l) => l.mark !== ' '));
});
