/**
 * The screen is the door, so every test here is about a way something
 * invisible could get through it.
 *
 * Three of them are the ones worth reading twice:
 *
 *  1. **The rows are not retyped.** One test is generated per row of
 *     `SCREENED_RANGES`, and each asserts BOTH ends of every span the row
 *     covers. A row added to the table gains its test for free; a span
 *     narrowed by one code point fails the end that moved. A test file that
 *     spelled the eleven rows out again would be a second copy of the table,
 *     free to drift from the one the message reads.
 *  2. **The neighbourhood is asserted too.** For every span, the code point
 *     on each side of it must screen CLEAN unless some other row claims it.
 *     That is what makes the table a boundary rather than a direction: it
 *     pins U+0009 (tab), U+000A (newline) and U+000D (carriage return) as
 *     accepted, which no test of the screened points themselves can do.
 *  3. **`screenItem` is audited by silence.** One control is planted in each
 *     authored field in turn, and each plant must produce exactly one finding
 *     naming that field. A field the screen forgot is a plant that produces
 *     none — which is the only shape of bug this module can have that reading
 *     it will not show you.
 *
 * **Not one screened code point in this file is written as itself.** Every
 * one is built with `String.fromCodePoint`, because a source file carrying a
 * raw U+202E reorders the test that reads it, and a source file carrying a
 * raw NUL stops diffing altogether (`scripts/check-text-files.ts` exists
 * because that has happened here twice). The legitimate-text test is the
 * deliberate exception: Hebrew, Arabic and emoji are written as themselves,
 * because that test is about text a person would actually type.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '../../src/core/types.ts';
import {
  SCREENED_RANGES, screenItem, screenPackMeta, screenText, type ScreenedRange,
} from '../../src/pack/screen.ts';

/** A screened character, built rather than typed. See the file comment. */
const ch = (cp: number): string => String.fromCodePoint(cp);

/**
 * `U+200E`, spelled here rather than imported. The module's own spelling is
 * what the message carries; this one is the independent copy that would
 * disagree with it if either moved.
 */
const spell = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

/** The row of the exported table covering `cp`, or `null`. */
function rowFor(cp: number): ScreenedRange | null {
  return SCREENED_RANGES.find((r) => r.spans.some((s) => cp >= s.from && cp <= s.to)) ?? null;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** U+200E LEFT-TO-RIGHT MARK — the plant used wherever one control will do. */
const MARK = ch(0x200e);

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

test('the table is the eleven rows the spec names, and no row is empty', () => {
  assert.equal(SCREENED_RANGES.length, 11);
  for (const row of SCREENED_RANGES) {
    assert.ok(row.spans.length > 0, `${row.name} covers nothing`);
    assert.ok(row.name.trim() !== '', 'a row with no name cannot appear in a message');
    assert.ok(row.why.trim() !== '', `${row.name} does not say why it is refused`);
    for (const span of row.spans) {
      assert.ok(span.from <= span.to, `${row.name} has a span that runs backwards`);
    }
  }
});

for (const row of SCREENED_RANGES) {
  test(`refused: ${row.name}`, () => {
    for (const span of row.spans) {
      for (const point of new Set([span.from, span.to])) {
        const findings = screenText(`a${ch(point)}b`, 'a field');
        assert.equal(findings.length, 1, `${spell(point)} produced ${findings.length} findings`);
        assert.equal(findings[0].codePoint, spell(point));
        assert.equal(findings[0].name, row.name);
        assert.equal(findings[0].offset, 1);
        assert.equal(findings[0].where, 'a field');
      }
    }
  });
}

test('the code point on each side of every span is untouched — a boundary, not a neighbourhood', () => {
  for (const row of SCREENED_RANGES) {
    for (const span of row.spans) {
      for (const near of [span.from - 1, span.to + 1]) {
        if (near < 0 || near > 0x10ffff) continue;
        if (rowFor(near) !== null) continue;
        assert.deepEqual(
          screenText(`a${ch(near)}b`, 'a field'), [],
          `${spell(near)} sits beside ${row.name}, no row claims it, so it must pass`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The BOM, which is the one code point whose position decides it
// ---------------------------------------------------------------------------

test('a BOM at offset 0 of a file is accepted; a BOM anywhere else is refused', () => {
  assert.deepEqual(screenText(`${ch(0xfeff)}{\n}\n`, 'manifest.json'), []);

  const later = screenText(`{${ch(0xfeff)}}\n`, 'manifest.json');
  assert.equal(later.length, 1);
  assert.equal(later[0].codePoint, 'U+FEFF');
  assert.equal(later[0].offset, 1);
});

// ---------------------------------------------------------------------------
// What must still pass, and what the list costs
// ---------------------------------------------------------------------------

test('legitimate Hebrew, Arabic and emoji text with no controls passes untouched', () => {
  const passes = [
    'שלום עולם',
    'מסמך README.md נקרא לפני כל שינוי',
    'مرحبا بالعالم',
    'قاعدة صارمة',
    'ship it 🚢',
    'ok 👍🏽 done',
    'tab\tand\nnewline\r\nsurvive',
  ];
  for (const text of passes) {
    assert.deepEqual(screenText(text, 'a field'), [], JSON.stringify(text));
  }
});

test('a ZWJ emoji sequence is refused too — the cost of the invisible list, named not discovered', () => {
  const findings = screenText('👨‍👩‍👧', 'a field');
  assert.equal(findings.length, 2);
  assert.deepEqual(findings.map((f) => f.codePoint), ['U+200D', 'U+200D']);
});

// ---------------------------------------------------------------------------
// What a finding says
// ---------------------------------------------------------------------------

test('the screen reports every finding, not the first — a report that stops early hides the rest', () => {
  const text = `a${MARK}b${ch(0x202e)}c${ch(0x200b)}`;
  const findings = screenText(text, 'a field');
  assert.deepEqual(findings.map((f) => f.codePoint), ['U+200E', 'U+202E', 'U+200B']);
  assert.deepEqual(findings.map((f) => f.offset), [1, 3, 5]);
});

test('the message names the code point, the field and the offset', () => {
  const finding = screenText(`ab${MARK}cd`, 'item "RULE-x" title')[0];
  assert.match(finding.message, /U\+200E/);
  assert.match(finding.message, /item "RULE-x" title/);
  assert.match(finding.message, /offset 2/);
});

test('offsets are counted on the text as it arrived — the screen never normalises', () => {
  // `e` + U+0301 is one character to a reader and two code units to a string.
  // NFC folds it to U+00E9 and moves the mark to offset 1; the offset
  // reported must be 2, or a caller slicing the text it was handed would cut
  // the wrong character out.
  const text = `e${ch(0x0301)}${MARK}`;
  assert.notEqual(text.normalize('NFC').indexOf(MARK), text.indexOf(MARK));
  assert.equal(screenText(text, 'a field')[0].offset, 2);
});

test('an astral screened code point reports the offset of its first code unit', () => {
  // U+E0001 is a surrogate PAIR, so the character after it sits at offset 3.
  const findings = screenText(`a${ch(0xe0001)}${MARK}`, 'a field');
  assert.deepEqual(findings.map((f) => f.offset), [1, 3]);
  assert.equal(findings[0].codePoint, 'U+E0001');
});

// ---------------------------------------------------------------------------
// screenItem — the silence audit
// ---------------------------------------------------------------------------

function clean(): Item {
  return {
    id: 'RULE-clean',
    type: 'rule',
    title: 'a clean title',
    status: 'active',
    severity: 'hard',
    always: false,
    scope: ['src/**'],
    tags: ['ops'],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: null,
    validUntil: null,
    checksum: '0123456789abcdef',
    extra: { kind: 'constraint' },
    body: 'a clean body',
    steps: [{ text: 'a clean step', checked: false }],
    observations: [
      {
        category: 'evidence', text: 'a clean observation', tags: ['seen'],
        context: 'a clean context',
      },
    ],
    relations: [{ type: 'supports', target: 'RULE-other' }],
    layer: 'project',
    filePath: 'items/rule/RULE-clean.md',
  };
}

/**
 * One control planted in each authored field in turn, with the name the
 * finding must carry. Constructed rather than asserted field by field: a
 * field added to `Item` and not to `screenItem` is caught by the plant that
 * produces no finding, which is what a silence audit is for.
 */
const PLANTS: readonly { field: string; plant: (i: Item) => void }[] = [
  { field: 'title', plant: (i) => { i.title += MARK; } },
  { field: 'body', plant: (i) => { i.body += MARK; } },
  { field: 'observation 1 text', plant: (i) => { i.observations[0].text += MARK; } },
  { field: 'observation 1 context', plant: (i) => { i.observations[0].context = `c${MARK}`; } },
  { field: 'observation 1 tag 1', plant: (i) => { i.observations[0].tags[0] += MARK; } },
  { field: 'tag 1', plant: (i) => { i.tags[0] += MARK; } },
  { field: 'scope 1', plant: (i) => { i.scope[0] += MARK; } },
  { field: 'relation 1 target', plant: (i) => { i.relations[0].target += MARK; } },
  { field: 'extra "kind"', plant: (i) => { i.extra.kind += MARK; } },
  { field: 'step 1', plant: (i) => { i.steps[0].text += MARK; } },
  { field: 'id', plant: (i) => { i.id += MARK; } },
];

test('a clean item screens clean — the control the audit below is measured against', () => {
  assert.deepEqual(screenItem(clean()), []);
});

test('screenItem reaches every authored field, including extra values and relation targets', () => {
  for (const { field, plant } of PLANTS) {
    const item = clean();
    plant(item);
    const findings = screenItem(item);
    assert.equal(findings.length, 1, `${field}: expected one finding, got ${findings.length}`);
    assert.equal(findings[0].codePoint, 'U+200E');
    assert.match(findings[0].where, new RegExp(`${escapeRe(field)}$`));
    assert.match(findings[0].where, /RULE-clean/);
  }
});

test('an item carrying controls in several fields reports all of them', () => {
  const item = clean();
  item.title += MARK;
  item.body += ch(0x202e);
  item.extra.kind += ch(0x200b);
  assert.deepEqual(
    screenItem(item).map((f) => f.codePoint),
    ['U+200E', 'U+202E', 'U+200B'],
  );
});

test('a control in the id is escaped where the message names the item, never carried into it', () => {
  const item = clean();
  item.id += ch(0x202e);
  const finding = screenItem(item)[0];
  assert.equal(finding.codePoint, 'U+202E');
  assert.match(finding.where, /U\+202E/);
  assert.ok(
    !finding.message.includes(ch(0x202e)),
    'the refusal must not carry the override it is refusing',
  );
});

// ---------------------------------------------------------------------------
// screenPackMeta
// ---------------------------------------------------------------------------

test('screenPackMeta screens the name and the version, and names which is which', () => {
  assert.deepEqual(screenPackMeta('acme security', '2026-08 rev 3'), []);

  const findings = screenPackMeta(`acme${ch(0x202e)}`, `rev${ch(0x200b)}3`);
  assert.deepEqual(findings.map((f) => f.codePoint), ['U+202E', 'U+200B']);
  assert.match(findings[0].where, /name/);
  assert.match(findings[1].where, /version/);
});
