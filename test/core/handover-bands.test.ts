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
  BRIEF_MAX_LINES, COMPOSER_DIRECTIVE_MAX_CHARS, COMPOSER_MAY_READ, COMPOSER_MUST_NOT_READ,
  COMPOSER_REPORT_MAX_CHARS, askBand, askPlan, askStep, compositionDirective,
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

// --- The subagent that composes the block ------------------------------------
//
// `plan:handover seq:19`'s second half. The schedule above decides WHEN; these
// decide WHO WRITES IT AND OUT OF WHOSE CONTEXT — which is the half that can
// look like it worked and have saved nothing, because a subagent handed the
// session's transcript composes the same block over the same input and this
// window has still paid to assemble it.
//
// So the assertions below are not "the text mentions a subagent". They pin the
// three things that make the delegation real: the writer's read list is bounded
// and names the transcript as forbidden, the block is written INTO THE FILE and
// never returned as prose, and the ask itself is a pure function of the plan —
// one of exactly three fixed strings, none of which grows with the session.

test('the delegated writer may read two things, and both are bounded by the brief', () => {
  assert.deepEqual([...COMPOSER_MAY_READ], [
    "the handover's current top block",
    '`mycontext show <id>` for any id your brief names',
  ], 'a read list that grows is a writer re-deriving the session instead of being handed it');
});

// The transcript is the load-bearing entry and it is asserted BY NAME rather
// than by counting the list: a writer handed the transcript is the exact failure
// this ruling can suffer while appearing to have been implemented.
test('the transcript, a diff and the audit log are forbidden to the writer, by name', () => {
  assert.deepEqual([...COMPOSER_MUST_NOT_READ], ['this transcript', 'a git diff', 'the audit log'],
    'a writer handed the transcript has saved this window nothing at all');
});

test('every allowed and every forbidden read actually reaches the delegated ask', () => {
  for (const percent of [90.2, 92.5, 94.9]) {
    const directive = compositionDirective(askPlan(percent, 90)!);
    for (const allowed of COMPOSER_MAY_READ) {
      assert.ok(directive.includes(allowed),
        `the ask at ${percent}% never tells the writer it may read ${allowed}`);
    }
    for (const forbidden of COMPOSER_MUST_NOT_READ) {
      assert.ok(directive.includes(forbidden),
        `the ask at ${percent}% never forbids ${forbidden}, so the contract is only a comment`);
    }
  }
});

test('the block is written INTO THE FILE, and the one line back is capped and is not the block', () => {
  const directive = compositionDirective(askPlan(92.5, 90)!);
  assert.ok(directive.includes('into the file itself'),
    'a writer that hands the block back has moved the composing, not the cost');
  assert.ok(directive.includes('ONE line of at most 120 characters'),
    'an uncapped report is the block arriving in this window by another door');
  assert.ok(directive.includes('never the block text'),
    'nothing forbids returning the prose, which is the only way this looks done and is not');
  assert.equal(COMPOSER_REPORT_MAX_CHARS, 120, 'the one line back is capped at 120 characters');
});

// Eight is spelled as a literal in the expected string for the reason the delta
// cap already is: an assertion built from the export compares the export with
// itself and cannot fail for the one reason it exists.
test('the dispatching session writes at most eight lines, and each names an id', () => {
  assert.equal(BRIEF_MAX_LINES, 8, 'the brief is the session\'s half of the cost and it is capped');
  const directive = compositionDirective(askPlan(92.5, 90)!);
  assert.ok(directive.includes('at most 8 short lines'),
    'an uncapped brief is this session re-emitting its own picture of the day');
  assert.ok(
    directive.includes('naming an item id or a plan/seq lane rather than a report line number'),
    'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number is not carried into the block',
  );
});

// THE PROOF THAT THE COMPOSING DOES NOT HAPPEN HERE, and it is a property rather
// than a wording check. Sweep every occupancy the ladder can see: the ask this
// window pays for is a pure function of the PLAN, so there are exactly three
// strings it can ever be — full/delegated, delta/delegated, and the tail's
// written-here — and not one of them carries a fact about the session. A
// directive that grew with what happened would be this window composing after
// all, and the set below would be larger than three.
test('the delegated ask is one of three fixed strings, and none of them grows with the session', () => {
  const seen = new Set<string>();
  for (let tenths = 890; tenths <= 1000; tenths += 1) {
    const plan = askPlan(tenths / 10, 90);
    assert.notEqual(plan, null);
    seen.add(compositionDirective(plan!));
  }
  assert.equal(seen.size, 3,
    'the ask varies with something other than the plan, so it is carrying session facts');
  for (const directive of seen) {
    assert.ok(directive.length <= 1400,
      `an ask of ${directive.length} characters is the contract costing what it was meant to save`);
  }
  assert.equal(COMPOSER_DIRECTIVE_MAX_CHARS, 1400,
    'the budget is 1400 characters against a median committed block of 3,555');
});

// The roll-forward is offered at exactly the bands where declining costs
// nothing. `first` has no previous block for "nothing since" to be measured
// against; the tail is where this project gives nothing up. A roll-forward
// offered everywhere would be an instruction to skip the only block that is ever
// read, which is why this asserts all three places and not just the one.
test('nothing-to-record rolls forward in the widening bands ONLY', () => {
  assert.match(compositionDirective(askPlan(92.5, 90)!), /roll forward/u,
    'an early band with nothing to record still spends a whole update');
  assert.doesNotMatch(compositionDirective(askPlan(90.2, 90)!), /roll forward/u,
    'the first block of a window has nothing behind it to be unchanged from');
  assert.doesNotMatch(compositionDirective(askPlan(97.2, 90)!), /roll forward/u,
    'the tail is the block that gets read, and it is never declined');
});

test('the tail ask carries no contract at all, because it delegates to nobody', () => {
  const tail = compositionDirective(askPlan(97.2, 90)!);
  for (const clause of [...COMPOSER_MAY_READ, ...COMPOSER_MUST_NOT_READ]) {
    assert.ok(!tail.includes(clause),
      `the tail ask carries "${clause}", so a contract for a writer it must not dispatch leaked in`);
  }
  assert.ok(!tail.includes('ONE line'),
    'the tail ask asks for a report from a writer that does not exist');
});
