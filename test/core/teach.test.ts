import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  levenshtein, closestMatch, enumError, missingFieldError, unknownIdError,
} from '../../src/core/teach.ts';

const CATEGORIES = ['constraint', 'invariant', 'rule', 'requirement', 'lesson', 'adr'];

test('levenshtein counts single edits', () => {
  assert.equal(levenshtein('rule', 'rule'), 0);
  assert.equal(levenshtein('rule', 'rules'), 1);
  assert.equal(levenshtein('rule', 'role'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('closestMatch finds the intended category behind a typo', () => {
  assert.equal(closestMatch('requirment', CATEGORIES), 'requirement');
  assert.equal(closestMatch('constraints', CATEGORIES), 'constraint');
  assert.equal(closestMatch('Rule', CATEGORIES), 'rule');
});

test('closestMatch returns null rather than a nonsense suggestion', () => {
  assert.equal(closestMatch('xylophone', CATEGORIES), null);
});

test('closestMatch is deterministic on ties', () => {
  assert.equal(closestMatch('aaa', ['bbb', 'ccc']), null);
  assert.equal(closestMatch('rulf', ['rule', 'ruld']), 'ruld');
});

test('enumError names the field, the allowed set, the value and the topic', () => {
  const msg = enumError('type', 'requirment', CATEGORIES, 'categories');
  assert.match(msg, /"type"/);
  assert.match(msg, /constraint, invariant/);
  assert.match(msg, /You passed "requirment"/);
  assert.match(msg, /closest match is "requirement"/);
  assert.match(msg, /mycontext_help\("categories"\)/);
});

test('enumError omits the suggestion clause when nothing is close', () => {
  const msg = enumError('type', 'xylophone', CATEGORIES, 'categories');
  assert.equal(/closest match/.test(msg), false);
  assert.match(msg, /mycontext_help\("categories"\)/);
});

test('missingFieldError names the tool and the topic', () => {
  const msg = missingFieldError('title', 'create_item', 'capture');
  assert.match(msg, /create_item requires "title"/);
  assert.match(msg, /mycontext_help\("capture"\)/);
});

test('unknownIdError suggests the nearest id and points at query_items', () => {
  const msg = unknownIdError('CONST-pg-pool', ['CONST-pg-pool-cap', 'LESSON-a']);
  assert.match(msg, /no item with id "CONST-pg-pool"/);
  assert.match(msg, /CONST-pg-pool-cap/);
  assert.match(msg, /query_items/);
});

test('every message is prefixed so callers can recognise it as ours', () => {
  assert.match(enumError('type', 'x', CATEGORIES, 'categories'), /^my_context: /);
  assert.match(missingFieldError('title', 'create_item', 'capture'), /^my_context: /);
  assert.match(unknownIdError('x', []), /^my_context: /);
});
