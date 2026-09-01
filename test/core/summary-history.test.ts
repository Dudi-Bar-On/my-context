/**
 * **`summary_was` — the short capped history the owner's ruling asks for, and
 * the four ways it could look right and be wrong.**
 *
 *  1. **It round-trips byte for byte, proved on a RAW FIXTURE.**
 *     `INV-markdown-is-the-source-of-truth` promises `files → DB → files` is
 *     byte-identical, and this is the field most able to break it: it holds
 *     free prose, one entry per line, in a hand-written frontmatter list. The
 *     fixture below is authored text, not something this code produced, so the
 *     test cannot pass by rendering and re-reading its own conventions.
 *  2. **It is NEVER INJECTED.** Pinned rather than left to the budget: a
 *     history that quietly started costing injection tokens would be worse
 *     than no history, because what it would cost tokens to say is what the
 *     item USED to say.
 *  3. **It is not part of the summary basis.** Appending to it happens during
 *     the very write that sets the new summary, so a basis that covered it
 *     would make every summary born stale — the trap `acknowledged` had to
 *     avoid, one field further out.
 *  4. **It is capped, newest first, and never backfilled.** Three, the oldest
 *     dropping off; and an item that has only ever had one summary carries an
 *     empty history rather than a fabricated one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SUMMARY_BASIS, itemSummaryBasis, stampSummary, summaryState,
} from '../../src/core/content-hash.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import {
  SUMMARY_HISTORY_MAX, parseSummaryWas, reaffirmSummary, renderSummaryWas, reviseSummary,
} from '../../src/core/summary-history.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { itemCost } from '../../src/core/select.ts';
import { renderIndexLine, renderItemBlock } from '../../src/core/render-item.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const ONE = 'A screen says it checked a session and found nothing, when it never checked at all.';
const TWO = 'A screen reports a measurement it never took.';
const THREE = 'A screen claims to have looked, and did not.';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

function fileOf(box: Sandbox, id: string): string {
  return readFileSync(path.join(box.root, itemOf(box, id).filePath), 'utf8');
}

function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: 'Secrets in logs outlive the incident.',
    status: 'active',
    origin: 'human',
    ...extra,
  }).id;
}

/* -------------------------------------------------------------------------- *
 * 1. THE RAW FIXTURE — byte identity, on text this code did not write.
 * -------------------------------------------------------------------------- */

/**
 * Authored by hand, deliberately, and every entry in the list is a case that
 * could break the round trip on its own:
 *
 *  - the first carries a `:`, which `serializeFrontmatter` quotes and
 *    `unquote` must give back unchanged;
 *  - the second carries a `"` as well as a `:`, so it is quoted AND the inner
 *    quote is escaped as `\"` — the two escapes `emitScalar` applies in that
 *    order and `unquote` undoes in the same one;
 *  - the third has NO leading date, which is what a person typing the field by
 *    hand produces — it must be kept whole rather than dropped or stamped with
 *    today's date.
 *
 * `checksum` is deliberately a value this test never asserts: the fixture is
 * about BYTES, and a checksum recomputed here would only assert that this file
 * agrees with itself.
 */
const RAW = `---
id: RULE-do-not-log-customer-email
type: rule
title: Do not log customer email
status: active
severity: soft
always: false
summary: A screen claims to have looked, and did not.
summary_of: 0123456789abcdef
summary_was:
  - "2026-08-30 It says one thing: it did the check. In fact, it did not."
  - "2026-08-29 A screen says it \\"checked\\": it did not."
  - an entry somebody typed by hand, with no date in front of it
scope:
  - src/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-01
valid_until: null
checksum: a0b1c2d3e4f56789
---

# Do not log customer email

Secrets in logs outlive the incident.
`;

test('a hand-written summary_was survives files -> DB -> files byte for byte', () => {
  const parsed = parseItem(RAW, 'items/rule/RULE-do-not-log-customer-email.md', 'project');
  assert.equal(
    renderItem(parsed), RAW,
    'INV-markdown-is-the-source-of-truth: "delete the index, it rebuilds" is only a real ' +
    'recovery while the round trip is lossless. A history that re-rendered differently would ' +
    'destroy authored text on the next write of an item nobody edited',
  );
});

test('the fixture parses into the three entries it names, dates and all', () => {
  const parsed = parseItem(RAW, 'items/rule/RULE-do-not-log-customer-email.md', 'project');
  assert.deepEqual(parsed.summaryWas, [
    { at: '2026-08-30', text: 'It says one thing: it did the check. In fact, it did not.' },
    { at: '2026-08-29', text: 'A screen says it "checked": it did not.' },
    { at: null, text: 'an entry somebody typed by hand, with no date in front of it' },
  ], 'non-vacuity: the round trip above must not be passing by keeping raw strings it never ' +
    'understood. Each half of each entry is read, and the undated one keeps its whole text');
});

test('an undated entry is KEPT, never dropped — it is authored text, not a hash', () => {
  // The opposite of `parseAcknowledged`, which drops what it cannot read, and
  // the difference is the point: dropping an unreadable acknowledgement reopens
  // a finding, and dropping an unreadable history entry deletes a sentence
  // somebody wrote while reporting the write as a success
  // (`INV-nothing-is-dropped-silently`).
  const back = parseSummaryWas(['not a date at all', '2026-08-30 dated']);
  assert.deepEqual(back, [
    { at: null, text: 'not a date at all' },
    { at: '2026-08-30', text: 'dated' },
  ]);
  assert.deepEqual(renderSummaryWas(back), ['not a date at all', '2026-08-30 dated'],
    'and it renders back as exactly the string it was read from, which is what makes the ' +
    'byte-identical round trip hold for a file a human typed');
});

test('an over-cap file keeps every entry until something appends', () => {
  // The cap is applied when APPENDING, never at read time. Trimming on read
  // would silently delete authored text and break byte-identity for a file
  // nobody edited — and this is reachable: a person can type a fourth entry.
  const many = ['2026-08-30 a', '2026-08-29 b', '2026-08-28 c', '2026-08-27 d'];
  assert.equal(renderSummaryWas(parseSummaryWas(many)).length, 4);
  assert.deepEqual(renderSummaryWas(parseSummaryWas(many)), many);
});

/* -------------------------------------------------------------------------- *
 * 2. THE CHECKSUM — conditional, exactly like continuity/summary/acknowledged.
 * -------------------------------------------------------------------------- */

test('an item with no history writes no summary_was line and hashes as it always did', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: ONE });
    assert.doesNotMatch(fileOf(box, id), /^summary_was:/m,
      'an unconditional `summary_was: []` line would be added to every item in every corpus on ' +
      'the next write — the byte-identical round trip broken for all of them at once');

    const item = itemOf(box, id);
    assert.deepEqual(item.summaryWas, [], 'nothing is backfilled: no history existed to recover');
    const before = computeItemChecksum(item);

    const withHistory = { ...item, summaryWas: [{ at: '2026-08-30', text: TWO }] };
    assert.notEqual(computeItemChecksum(withHistory), before,
      'a history the checksum does not cover is one a hand edit can rewrite — or delete — with ' +
      'nothing reporting it, which is the same forgery `acknowledged` is covered against');
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * 3. IT IS NOT PART OF THE BASIS.
 * -------------------------------------------------------------------------- */

test('summary_was is absent from the summary basis table, and from ContentShape', () => {
  // `SUMMARY_BASIS` is `satisfies Record<keyof ContentShape, …>`, so a key here
  // would mean a field there. Asserted by NAME rather than by hashing, because
  // the claim is about the table: a field added to `ContentShape` does not
  // compile until somebody classifies it, and this one must never be added.
  assert.ok(!Object.hasOwn(SUMMARY_BASIS, 'summary_was'));
  assert.ok(!Object.hasOwn(SUMMARY_BASIS, 'summaryWas'));
});

test('appending to the history does not invalidate the summary it records', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: ONE }));
    const before = itemSummaryBasis(item);

    const after = { ...item, summaryWas: [{ at: '2026-08-30', text: ONE }] };
    assert.equal(itemSummaryBasis(after), before,
      'a basis covering the history would be invalidated by the very write that recorded what ' +
      'it replaced: every summary born stale, and the field that explains the staleness would ' +
      'be its cause. This is `acknowledged`\'s trap one field further out');
  } finally { box.dispose(); }
});

test('replacing a summary leaves the new one CURRENT, history and all', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: ONE });
    updateItem(box.ctx, { id, summary: TWO, origin: 'human' });
    const item = itemOf(box, id);
    assert.equal(item.summary, TWO);
    assert.equal(summaryState(item), 'current');
    assert.equal(item.summaryWas.length, 1);
    assert.equal(item.summaryWas[0].text, ONE);
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * 4. IT IS NEVER INJECTED.
 * -------------------------------------------------------------------------- */

test('a history costs nothing at injection: no rendered block, no index line, no tokens', () => {
  // Pinned rather than left to the budget to keep out. The owner's ruling says
  // "should not be injected" in as many words, and the failure it names is
  // specific: an item's three PREVIOUS summaries are, by construction, three
  // sentences that are no longer true — the last text in the corpus that
  // should be spent on a budget.
  const box = sandbox();
  try {
    const bare = itemOf(box, rule(box, { summary: ONE }));
    const withHistory: Item = {
      ...bare,
      summaryWas: [
        { at: '2026-08-30', text: TWO },
        { at: '2026-08-29', text: THREE },
      ],
    };

    assert.equal(renderItemBlock(withHistory), renderItemBlock(bare));
    assert.equal(itemCost(withHistory), itemCost(bare));
    assert.equal(
      renderIndexLine({ id: withHistory.id, type: withHistory.type, title: withHistory.title }),
      renderIndexLine({ id: bare.id, type: bare.type, title: bare.title }),
    );
    assert.doesNotMatch(renderItemBlock(withHistory), /screen reports a measurement/);
    assert.doesNotMatch(renderItemBlock(withHistory), /claims to have looked/);
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * 5. THE CAP, THE ORDER, AND WHAT DOES AND DOES NOT APPEND.
 * -------------------------------------------------------------------------- */

test('the cap is three, newest first, and the oldest drops off', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: 'first' }));
    for (const [n, at] of [['second', '2026-08-28'], ['third', '2026-08-29'],
      ['fourth', '2026-08-30'], ['fifth', '2026-08-31']] as [string, string][]) {
      reviseSummary(item, n, at);
    }
    assert.equal(SUMMARY_HISTORY_MAX, 3,
      'the owner asked for a history that "does not take long space"; the number is that ' +
      'sentence made a bound, and changing it is a decision about the bound');
    assert.deepEqual(item.summaryWas, [
      { at: '2026-08-31', text: 'fourth' },
      { at: '2026-08-30', text: 'third' },
      { at: '2026-08-29', text: 'second' },
    ], 'newest first, and "first" has dropped off — unbounded history in a file that must ' +
      'round-trip byte-identically is a slow leak');
    assert.equal(item.summary, 'fifth');
  } finally { box.dispose(); }
});

test('the first summary records nothing: an empty history is the honest state', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box));
    reviseSummary(item, ONE, '2026-08-30');
    assert.deepEqual(item.summaryWas, [],
      'nothing was replaced, so nothing is recorded. Migration says the same thing about every ' +
      'item that predates the field: absent is not missing');
  } finally { box.dispose(); }
});

test('CLEARING a summary records it — that is the case a reader most needs', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: ONE });
    updateItem(box.ctx, { id, summary: '', origin: 'human' });
    const item = itemOf(box, id);
    assert.equal(item.summary, null);
    assert.equal(item.summaryOf, null);
    assert.deepEqual(item.summaryWas.map((e) => e.text), [ONE],
      'the item stops saying it, and what it used to say is exactly what somebody will want ' +
      'back. The summary/summary_of pair moves together; this field does not move with them');
    assert.match(fileOf(box, id), /^summary_was:/m,
      'and it is written even though there is no summary above it — the two keys above move as ' +
      'a pair because half of that pair is `unanchored`; this one is independent of both');
  } finally { box.dispose(); }
});

test('re-stamping the same text records nothing — the escape hatch is not a replacement', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: ONE }));
    const basisBefore = item.summaryOf;
    item.body = 'A different body entirely.';
    reaffirmSummary(item);

    assert.deepEqual(item.summaryWas, [],
      'recording a summary as "previous" while it is still the current one would put the same ' +
      'sentence in the file twice and date the live one as retired');
    assert.equal(item.summary, ONE, 'the text is untouched — that is what the hatch asserts');
    assert.notEqual(item.summaryOf, basisBefore,
      'and the basis IS re-stamped, or the hatch would answer the gate without settling it');
    assert.equal(summaryState(item), 'current');
  } finally { box.dispose(); }
});

test('a replaced summary reaches disk and comes back byte-identical', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: ONE });
    updateItem(box.ctx, { id, summary: TWO, origin: 'human' });
    const text = fileOf(box, id);
    assert.match(text, /^summary_was:\n {2}- \d{4}-\d{2}-\d{2} A screen says it checked/m);

    const parsed = parseItem(text, itemOf(box, id).filePath, 'project');
    assert.equal(renderItem(parsed), text, 'the write path and the parser agree byte for byte');
    assert.deepEqual(parsed.summaryWas, itemOf(box, id).summaryWas);
    assert.equal(computeItemChecksum(parsed), itemOf(box, id).checksum,
      'and the recorded checksum covers the history, so a hand edit to it is reported');
  } finally { box.dispose(); }
});

test('a previous summary carrying a colon survives the round trip', () => {
  // The serializer quotes any entry carrying `:` or `#`, and a prose summary is
  // the value most likely to carry one. An entry that could not be read back
  // would be authored text destroyed on the next rebuild.
  const box = sandbox();
  try {
    const tricky = 'It says one thing: it did the check. In fact: it did not.';
    const id = rule(box, { summary: tricky });
    updateItem(box.ctx, { id, summary: TWO, origin: 'human' });
    const text = fileOf(box, id);
    const parsed = parseItem(text, itemOf(box, id).filePath, 'project');
    assert.equal(parsed.summaryWas[0].text, tricky);
    assert.equal(renderItem(parsed), text);
  } finally { box.dispose(); }
});

test('stampSummary alone still writes no history — the wrapper is the only writer', () => {
  // `stampSummary` is what every existing caller reaches for and what
  // `createItem` uses; leaving it able to append would have made a creation
  // record a replacement of nothing.
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: ONE }));
    stampSummary(item, TWO);
    assert.deepEqual(item.summaryWas, []);
  } finally { box.dispose(); }
});
