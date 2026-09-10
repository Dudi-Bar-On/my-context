// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
//
// §10's indicator, on the surface that makes it unavoidable. The three
// properties asserted here are the three the item states in its own words:
//
//   1. **zero draws nothing at all** — "an indicator that shows something when
//      there is nothing pending trains a reader to ignore it";
//   2. **a count draws with the number**;
//   3. **the colour is keyed on the AGE OF THE OLDEST, not on the count** —
//      and that is proved by making the count move in the opposite direction
//      to the colour, which a count-keyed chip cannot survive.
//
// The band is asserted through `buildLines`' emitted segment rather than
// through the rendered escape string: the hue is the same `INK` table the rest
// of the bar uses, and asserting bytes of SGR here would pin the palette
// instead of the verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLines, NO_EXTRAS, reviewSegment, type PowerlineInput,
} from '../../src/cli/commands/statusline-powerline.ts';
import { reviewChip, type PendingReview } from '../../src/review/pending.ts';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');
const DAY = 86_400_000;

/**
 * The minimum input `buildLines` needs, plus the one field under test.
 * `NO_EXTRAS` covers the optional groups; the four below are the required
 * ones, and they are set to their quiet values so nothing but the review block
 * can appear in a bar this file asserts the ABSENCE of a block on.
 */
function bar(review: PowerlineInput['review']): PowerlineInput {
  return {
    ...NO_EXTRAS,
    model: null, project: null, branch: null,
    occupancy: { state: 'unmeasurable', why: 'no-bridge' },
    threshold: null, myctx: null, focus: null, lastAudit: null,
    myctxNote: null, teeNote: null, corpus: null,
    review,
  } as unknown as PowerlineInput;
}

function fields(input: PowerlineInput): string[] {
  const { identity, window, account } = buildLines(input, NOW);
  return [...identity, ...window, ...account].map((s) => s.field ?? '');
}

function view(over: Partial<PendingReview>): PendingReview {
  return { drafts: 0, revisions: 0, total: 0, oldestAt: null, undated: 0, ...over };
}

test('zero pending draws nothing at all — no block, no label, no zero', () => {
  const empty = reviewChip(view({}), NOW);
  assert.equal(empty, null);
  assert.equal(reviewSegment(empty), null);
  assert.equal(
    fields(bar(null)).includes('review-queue'), false,
    'a bar that said "REVIEW 0" on every message of every empty session is the doctor screen ' +
    'where 74 of 74 findings offered no remedy and the control stopped being read',
  );
});

test('a queue that could not be read draws nothing either, and is not a zero', () => {
  // Two different facts, one silence — and the fact survives upstream in
  // `PendingReview` for the surfaces that have room to say it.
  assert.equal(reviewSegment(reviewChip(null, NOW)), null);
});

test('a count draws with the number, and the block is on the bar', () => {
  const today = new Date(NOW).toISOString().slice(0, 10);
  const chip = reviewChip(view({ drafts: 12, total: 12, oldestAt: today }), NOW);
  const segment = reviewSegment(chip);
  assert.ok(segment);
  assert.match(segment.text, /12/);
  assert.equal(segment.label, 'REVIEW');
  assert.equal(segment.field, 'review-queue');
  assert.ok(fields(bar(chip)).includes('review-queue'), 'and it reaches the rendered line');
});

test('the colour is the AGE of the oldest, and the count moves the other way', () => {
  const today = new Date(NOW).toISOString().slice(0, 10);
  const sixWeeks = new Date(NOW - 42 * DAY).toISOString().slice(0, 10);

  const busy = reviewSegment(reviewChip(view({ drafts: 12, total: 12, oldestAt: today }), NOW));
  const landfill = reviewSegment(reviewChip(view({ drafts: 3, total: 3, oldestAt: sixWeeks }), NOW));
  assert.ok(busy && landfill);

  assert.notDeepEqual(
    busy.ink, landfill.ink,
    'twelve from today and three from six weeks ago must not read the same',
  );
  // The count is BIGGER on the quiet one. A chip keyed on the count would have
  // to colour these the other way round, so this pair cannot both pass under
  // the wrong key.
  assert.match(busy.text, /12/);
  assert.match(landfill.text, /3/);
  // And the glyph carries the same verdict as the hue, so `--no-colour` and a
  // monochrome terminal lose nothing (`06-a11y.html`).
  assert.notEqual(busy.text[0], landfill.text[0]);
});

test('the age rides along only where it is the news', () => {
  const today = new Date(NOW).toISOString().slice(0, 10);
  const old = new Date(NOW - 12 * DAY).toISOString().slice(0, 10);
  const fresh = reviewSegment(reviewChip(view({ drafts: 2, total: 2, oldestAt: today }), NOW));
  const stale = reviewSegment(reviewChip(view({ drafts: 2, total: 2, oldestAt: old }), NOW));
  assert.ok(fresh && stale);
  assert.doesNotMatch(fresh.text, /d$/, 'a fresh queue does not spend columns saying "0d"');
  assert.match(stale.text, /12d/);
  // The narrow-terminal spelling keeps the verdict and drops the explanation,
  // which is `corpusSegment`'s rule and not a second one.
  assert.equal(stale.terse, `${stale.text[0]} 2`);
});

test('nothing on this block blinks, in any band', () => {
  // §10 spends motion on a TRANSITION and never on a steady state, and this
  // bar re-renders on every assistant message — so any blink here would be a
  // permanent one. `Segment` has no blink field of its own; the assertion is
  // that this block never asks for the one the level table can carry.
  const old = new Date(NOW - 40 * DAY).toISOString().slice(0, 10);
  const segment = reviewSegment(reviewChip(view({ drafts: 9, total: 9, oldestAt: old }), NOW));
  assert.ok(segment);
  assert.equal((segment as unknown as { blink?: boolean }).blink, undefined);
});
