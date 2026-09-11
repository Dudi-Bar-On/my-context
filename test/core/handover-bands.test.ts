// @basis TASK-the-handover-asks-on-a-widening-then-narrowing-schedule-and, TASK-the-handover-is-asked-for-again-at-every-percent-not-written
//
// --- The widening-then-narrowing ask schedule --------------------------------
//
// `plan:handover seq:19` against `plan:handover seq:12` (D14). `seq:12` made the
// ask re-arm on every whole percent from the threshold to full; the owner then
// measured what that cost — eleven updates between 85% and 96% spending about a
// quarter of the runway the mechanism exists to protect — and ruled the steps
// WIDEN early and NARROW at the end.
//
// EVERY READING BELOW IS FABRICATED AND PASSED IN. Nothing here measures elapsed
// wall time, and nothing reads a live window: the schedule is a pure function of
// an occupancy, so the test drives it with the occupancies a window would have
// produced. That is the only way to assert "what would this have done over nine
// real windows" without the assertion becoming a flake.
//
// THE SAFETY-CRITICAL HALF IS THE NARROWING ONE. An ask that fires less often is
// an ask that can be missing at the moment the window dies, so the assertions
// that matter most are the ones that pin the TAIL: from `ASK_TAIL_FROM` upward a
// band is exactly a whole percent, which is what `seq:12` already gave, so the
// change cannot cost anything in the region where every observed window of this
// session actually ended (~96.5%).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_BAND_BOUNDARIES, ASK_CEILING_PERCENT, ASK_TAIL_FROM, DELTA_MAX_LINES,
  askBand, askPlan, askStep, compositionDirective,
} from '../../src/core/handover-ask.ts';

/** The occupancies a window rising from `from` to `to` would have reported. */
function rise(from: number, to: number): number[] {
  const out: number[] = [];
  for (let tenths = Math.round(from * 10); tenths <= Math.round(to * 10); tenths += 1) {
    out.push(tenths / 10);
  }
  return out;
}

/** The steps a schedule would actually have FIRED at over a rising window. */
function fired(readings: number[], step: (percent: number) => number | null): number[] {
  const out: number[] = [];
  let last: number | null = null;
  for (const reading of readings) {
    const at = step(reading);
    if (at === null) continue;
    if (last !== null && at <= last) continue;
    last = at;
    out.push(at);
  }
  return out;
}

test('the ladder is the seven bands the owner ruled, in order', () => {
  assert.deepEqual(
    [...ASK_BAND_BOUNDARIES], [90, 92, 94, 96, 97, 98, 99],
    'the ruled schedule is 90 .. 92 .. 94 .. 96 . 97 . 98 . 99 — seven asks, not eight and not fifteen',
  );
});

test('a window rising from the threshold to full fires seven asks where it fired eleven', () => {
  const readings = rise(90, 100);
  assert.deepEqual(fired(readings, askBand), [90, 92, 94, 96, 97, 98, 99],
    'the band schedule did not fire once on entering each band');
  assert.deepEqual(fired(readings, askStep), [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
    'the schedule this replaces fired on every whole percent — eleven from a threshold of 90');
});

// The sweep stops at 99.9 and NOT at 100, and the stop is the ruling rather
// than a rounding convenience: `ASK_CEILING_PERCENT` folds a full window onto
// the last band, so 100 is the one reading in the tail where a band is not its
// own whole percent. That single case is asserted on its own below, where it
// can be read as a decision instead of hiding inside a range.
test('from the tail up a band IS a whole percent, so nothing is lost where windows end', () => {
  for (const reading of rise(ASK_TAIL_FROM, 99.9)) {
    assert.equal(askBand(reading), askStep(reading),
      `the tail widened at ${reading}% — the narrowing half must never be coarser than seq:12`);
  }
});

test('below the ladder every whole percent is still its own band', () => {
  for (const reading of rise(50, 89.9)) {
    assert.equal(askBand(reading), askStep(reading),
      `a threshold below the ladder lost an ask at ${reading}%`);
  }
});

test('a reading that is not a number earns no band at all', () => {
  assert.equal(askBand(Number.NaN), null);
  assert.equal(askBand(Number.POSITIVE_INFINITY), null);
});

test('an over-full reading folds onto the last band instead of being thrown away', () => {
  assert.equal(askBand(ASK_CEILING_PERCENT), 99,
    'a window at 100 is inside the last band, not a band of its own');
  assert.equal(askBand(101.4), 99, 'a reading above the ceiling is clamped, never discarded');
});

test('the first ask of a window is a full block, and it is the one that is delegated', () => {
  assert.deepEqual(askPlan(90.2, 90), {
    band: 90, place: 'first', shape: 'full', writer: 'subagent', maxLines: null,
  });
});

// The cap is spelled 25 here and NOT `DELTA_MAX_LINES`, and the literal is the
// point. A removal proof caught the first version of this staying GREEN under a
// mutation that moved the constant to 26: the assertion compared the export with
// itself, so it could not fail for the one reason it exists. The constant is
// pinned to the ruled number once, on its own line, and every other assertion
// names the number the owner ruled.
test('the cap is the ruled twenty-five, and it is what an early band carries', () => {
  assert.equal(DELTA_MAX_LINES, 25, 'the ruled cap is around 25 lines');
});

test('the widening bands send a capped delta to a subagent', () => {
  assert.deepEqual(askPlan(92.5, 90), {
    band: 92, place: 'early', shape: 'delta', writer: 'subagent', maxLines: 25,
  });
  assert.deepEqual(askPlan(94.9, 90), {
    band: 94, place: 'early', shape: 'delta', writer: 'subagent', maxLines: 25,
  });
});

test('NOTHING IN THE TAIL IS DELEGATED, and every tail block is a whole one', () => {
  for (const boundary of ASK_BAND_BOUNDARIES) {
    if (boundary < ASK_TAIL_FROM) continue;
    const plan = askPlan(boundary + 0.3, 90);
    assert.deepEqual(
      { writer: plan?.writer, shape: plan?.shape, place: plan?.place },
      { writer: 'this-turn', shape: 'full', place: 'tail' },
      `the ask at ${boundary}% was handed to a writer that may not return before the window does`,
    );
  }
});

test('a threshold already inside the tail gets one block, written here', () => {
  assert.deepEqual(askPlan(98.4, 98), {
    band: 98, place: 'tail', shape: 'full', writer: 'this-turn', maxLines: null,
  });
});

test('a reading with no band has no plan either', () => {
  assert.equal(askPlan(Number.NaN, 90), null);
});

test('the delta directive names its cap and the tail directive names no subagent', () => {
  const delta = compositionDirective(askPlan(92.5, 90)!);
  assert.ok(delta.includes('at most 25 lines'),
    'a delta that does not say how many lines it may be is not capped');
  const tail = compositionDirective(askPlan(99.1, 90)!);
  assert.doesNotMatch(tail, /subagent/iu,
    'the last ask a window ever gets must not depend on a writer that may not return');
});
