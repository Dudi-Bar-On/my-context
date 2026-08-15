import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table, supportsUnicode } from '../../src/cli/commands/format.ts';

test('renders a unicode box with a header rule', () => {
  const lines = table(['id', 'type'], [['CONST-a', 'constraint']], { unicode: true });
  assert.deepEqual(lines, [
    '┌─────────┬────────────┐',
    '│ id      │ type       │',
    '├─────────┼────────────┤',
    '│ CONST-a │ constraint │',
    '└─────────┴────────────┘',
  ]);
});

test('falls back to ascii without dropping a column', () => {
  const lines = table(['id', 'type'], [['CONST-a', 'constraint']], { unicode: false });
  assert.deepEqual(lines, [
    '+---------+------------+',
    '| id      | type       |',
    '+---------+------------+',
    '| CONST-a | constraint |',
    '+---------+------------+',
  ]);
});

test('the ascii fallback carries no character outside 7-bit ascii', () => {
  // The whole point of the fallback is that a non-UTF-8 code page cannot
  // mangle it, so assert the property directly rather than trusting the
  // glyphs above to have been typed correctly.
  const lines = table(['id', 'type'], [['CONST-a', 'constraint']], { unicode: false });
  for (const line of lines) {
    assert.ok(/^[\x20-\x7e]*$/.test(line), line);
  }
});

test('a 63-character id does not collide with the next column', () => {
  const long = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondi';
  const lines = table(['id', 'type'], [[long, 'invariant']], { unicode: true });
  const dataRow = lines[3];
  assert.ok(dataRow.includes(`│ ${long} │`), dataRow);
  assert.equal(lines[1].length, dataRow.length);
});

test('every line of a table is exactly as wide as every other', () => {
  // A box that does not close is the failure a reader sees first.
  const long = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondition';
  for (const unicode of [true, false]) {
    const lines = table(
      ['id', 'type', 'status'],
      [[long, 'invariant', 'active'], ['CONST-a', 'constraint', 'superseded']],
      { unicode },
    );
    const widths = new Set(lines.map((line) => [...line].length));
    assert.equal(widths.size, 1, `${unicode ? 'unicode' : 'ascii'}: ${[...widths].join(',')}`);
  }
});

test('widens a column to fit the widest cell, header included', () => {
  const lines = table(['id'], [['a-very-long-identifier']], { unicode: true });
  assert.deepEqual(lines, [
    '┌────────────────────────┐',
    '│ id                     │',
    '├────────────────────────┤',
    '│ a-very-long-identifier │',
    '└────────────────────────┘',
  ]);
});

test('tolerates a row with fewer cells than there are headers', () => {
  const lines = table(['id', 'type'], [['CONST-a']], { unicode: true });
  assert.equal(lines[3], '│ CONST-a │      │');
  assert.equal([...lines[3]].length, [...lines[0]].length);
});

test('returns no lines for zero rows', () => {
  assert.deepEqual(table(['id'], [], { unicode: true }), []);
});

test('unicode detection fails toward ascii on an unknown windows terminal', () => {
  assert.equal(supportsUnicode({}, 'win32'), false);
  assert.equal(supportsUnicode({ WT_SESSION: '1' }, 'win32'), true);
  assert.equal(supportsUnicode({ TERM: 'xterm-256color' }, 'win32'), true);
  assert.equal(supportsUnicode({}, 'linux'), true);
});

test('MYCONTEXT_ASCII overrides a capable terminal', () => {
  assert.equal(supportsUnicode({ WT_SESSION: '1', MYCONTEXT_ASCII: '1' }, 'win32'), false);
});

test('MYCONTEXT_UNICODE overrides an unknown terminal', () => {
  assert.equal(supportsUnicode({ MYCONTEXT_UNICODE: '1' }, 'win32'), true);
  // MYCONTEXT_ASCII wins when both are set: the safe rendering is the one a
  // user reaches for after seeing mojibake, so it must not be overridable.
  assert.equal(supportsUnicode({ MYCONTEXT_ASCII: '1', MYCONTEXT_UNICODE: '1' }, 'win32'), false);
});

test('an omitted opts.unicode consults the environment, not a hardcoded default', () => {
  // Every command calls `table(headers, rows)` with no options, so this
  // ambient path — not the injected one the tests above pin — is what a user
  // actually gets. Without this test the whole suite could pass while the
  // wiring between `supportsUnicode` and `table` was missing.
  const saved = { ...process.env };
  try {
    delete process.env.MYCONTEXT_UNICODE;
    process.env.MYCONTEXT_ASCII = '1';
    assert.deepEqual(table(['id'], [['a']]), table(['id'], [['a']], { unicode: false }));

    delete process.env.MYCONTEXT_ASCII;
    process.env.MYCONTEXT_UNICODE = '1';
    assert.deepEqual(table(['id'], [['a']]), table(['id'], [['a']], { unicode: true }));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
