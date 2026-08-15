import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTPUT_WIDTH, outputWidth, paragraph, records, supportsUnicode, table, wrap,
} from '../../src/cli/commands/format.ts';

/** Every line of `lines`, widest first — the measurement all of this is about. */
const widest = (lines: string[]): number => Math.max(0, ...lines.map((l) => [...l].length));

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

// --- the layout budget ---

/**
 * The defect these pin: `table` did no wrapping, so a report was as wide as
 * its widest cell — 280 columns for `list --full` and 284 for `decay` against
 * this repo's own corpus — and every terminal narrower than that rewrapped
 * each row MID-CELL, destroying the columns the borders were drawn to show.
 */

const SENTENCE =
  'A validator that gates writes must be a complete precondition for the write it gates';

test('a table wider than the budget is wrapped down into it, losing no text', () => {
  const lines = table(['id', 'title'], [['CONST-a', SENTENCE]], { unicode: true, width: 60 });
  assert.ok(widest(lines) <= 60, `laid out to ${widest(lines)} columns:\n${lines.join('\n')}`);
  // Every word survives, in order, once the title column is rejoined.
  const rejoined = lines.slice(3, -1)
    .map((l) => l.split('│')[2].trim())
    .filter((s) => s !== '')
    .join(' ');
  assert.equal(rejoined, SENTENCE);
});

test('a wrapped row is still a box: every line the same width, continuations blank-first', () => {
  const lines = table(['id', 'title'], [['CONST-a', SENTENCE]], { unicode: true, width: 60 });
  assert.equal(new Set(lines.map((l) => [...l].length)).size, 1, lines.join('\n'));
  assert.ok(lines.length > 5, 'the row must occupy more than one line at this width');
  // A continuation is marked by an empty first column, which is what tells it
  // from the start of the next item now that no rule separates rows.
  assert.match(lines[4], /^│ {9}│/, lines[4]);
});

test('a table that already fits the budget is untouched', () => {
  // Regression guard: wrapping must be inert for the tables that were fine,
  // or every narrow report in the suite silently changes shape.
  const narrow = table(['id', 'type'], [['CONST-a', 'constraint']], { unicode: true, width: 100 });
  assert.deepEqual(narrow, table(['id', 'type'], [['CONST-a', 'constraint']], { unicode: true, width: 1000 }));
  assert.equal(narrow.length, 5);
});

test('no column is narrowed below its longest token, so an id is never broken', () => {
  const id = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondition';
  const lines = table(['id', 'title'], [[id, SENTENCE]], { unicode: true, width: 80 });
  assert.ok(lines.some((l) => l.includes(`│ ${id} `)), lines.join('\n'));
});

test('a table whose own tokens exceed the budget is left at its natural widths', () => {
  // Squeezing it buys nothing — it overflows either way — and costs a great
  // deal: it turns one-line rows into five-line rows that STILL overflow.
  const id = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondition';
  const lines = table(['id', 'title'], [[id, SENTENCE]], { unicode: true, width: 60 });
  assert.equal(lines.length, 5, `must stay one line per row:\n${lines.join('\n')}`);
  assert.ok(lines[3].includes(SENTENCE), lines[3]);
});

test('an indent comes out of the budget rather than being added on top of it', () => {
  // Four commands used to indent the returned lines themselves, which put a
  // table laid out to exactly the budget two columns over it — and two columns
  // over is a full rewrap on the terminal it was sized for.
  const lines = table(['id', 'title'], [['CONST-a', SENTENCE]], {
    unicode: true, width: 60, indent: '  ',
  });
  assert.ok(widest(lines) <= 60, `laid out to ${widest(lines)} columns`);
  for (const line of lines) assert.match(line, /^ {2}[│┌├└]/, line);
});

// --- wrap ---

test('wrap returns text that already fits verbatim, spacing included', () => {
  assert.deepEqual(wrap('a  b', 10), ['a  b']);
});

test('wrap never splits a token, even one wider than the column', () => {
  const token = 'x'.repeat(30);
  assert.deepEqual(wrap(`hello ${token} world`, 10), ['hello', token, 'world']);
});

test('wrap breaks at spaces and fills each line', () => {
  assert.deepEqual(wrap('one two three four', 9), ['one two', 'three', 'four']);
});

// --- paragraph ---

test('paragraph carries its prefix on every line, not only the first', () => {
  const lines = paragraph(SENTENCE, '  ', 40);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.match(line, /^ {2}\S/, line);
  assert.equal(lines.map((l) => l.trim()).join(' '), SENTENCE);
});

// --- records ---

test('records renders a stanza per item carrying every field', () => {
  const lines = records(['id', 'type', 'title'], [['CONST-a', 'constraint', 'Short']]);
  assert.deepEqual(lines, ['CONST-a', '  type   constraint', '  title  Short']);
});

test('records separates stanzas with a blank line and no trailing indent', () => {
  const lines = records(['id', 'type'], [['CONST-a', 'constraint'], ['CONST-b', 'constraint']]);
  assert.deepEqual(lines, ['CONST-a', '  type  constraint', '', 'CONST-b', '  type  constraint']);
});

test('records wraps a long value under a hanging indent, within the budget', () => {
  const lines = records(['id', 'title'], [['CONST-a', SENTENCE]], { width: 50 });
  assert.ok(widest(lines) <= 50, `laid out to ${widest(lines)} columns:\n${lines.join('\n')}`);
  assert.ok(lines.length > 2, 'the title must occupy more than one line at this width');
  const value = lines.slice(1).map((l) => l.trim()).join(' ').replace(/^title\s+/, '');
  assert.equal(value, SENTENCE);
  // Continuations line up under the value, not under the label.
  const at = lines[1].indexOf(SENTENCE.slice(0, 5));
  for (const line of lines.slice(2)) assert.equal(line.search(/\S/), at, line);
});

test('records returns no lines for zero rows, exactly as table does', () => {
  assert.deepEqual(records(['id', 'type'], []), []);
});

// --- outputWidth ---

test('the layout budget is a constant, not the terminal, unless overridden', () => {
  // A width read from `process.stdout.columns` would make README's generated
  // example blocks a fact about the maintainer's window; see OUTPUT_WIDTH.
  assert.equal(outputWidth({}), OUTPUT_WIDTH);
  assert.equal(outputWidth({ MYCONTEXT_WIDTH: '140' }), 140);
});

test('an unusable MYCONTEXT_WIDTH falls back to the constant', () => {
  for (const raw of ['', 'wide', '0', '-80', '12.5', '20']) {
    assert.equal(outputWidth({ MYCONTEXT_WIDTH: raw }), OUTPUT_WIDTH, raw);
  }
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
