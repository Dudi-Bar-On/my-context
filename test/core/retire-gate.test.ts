// @basis TASK-retire-on-evidence-and-bound-the-corpus
/**
 * **What this rests on, and why it is the file that matters most.**
 *
 * The item above says the thresholds are DERIVED from this corpus's measured
 * distribution and that a threshold copied from a paper is the failure this
 * phase exists to prevent. `derivability` is the runnable form of that
 * sentence: it reads the evidence and says whether a number may be drawn at
 * all. Everything it refuses on is a zero, a whole population, or the item's
 * own "at least a month" — nothing tuned, because a tuned gate would be the
 * invented threshold arriving one level up.
 *
 * `separation`, `tierSkew` and `payloadTrend` are asserted here too, because
 * each is a claim the report `reports/2026-09-11-retirement-thresholds.md`
 * makes and each must go on being re-measurable after the corpus moves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_WINDOW_DAYS, derivability, payloadTrend, separation, tierSkew,
  type RetirementEvidence,
} from '../../src/core/retire.ts';
import type { AuditRecord } from '../../src/core/audit.ts';

/** Evidence with every gate satisfied, so each test can break exactly one. */
function evidence(over: Partial<RetirementEvidence> = {}): RetirementEvidence {
  return {
    population: 40,
    injectable: 200,
    neverDelivered: 7,
    alwaysSpilled: 2,
    windowDays: 90,
    separation: { widestGapRatio: 40, cutAt: 0.2, below: 8, of: 200 },
    // A healthy shape: the pinned items rank at the TOP of the ranking, so a
    // cut at the bottom does not reach them.
    skew: { of: 200, pinned: 20, bestPinnedRank: 199, pinnedInBottomHalf: 0 },
    ...over,
  };
}

test('with every clause satisfied a threshold may be derived', () => {
  const out = derivability(evidence());
  assert.deepEqual(out.because, []);
  assert.equal(out.derivable, true, 'the gate must be passable, or it is not a gate');
});

test('an empty population is refused, and it is the first thing said', () => {
  const out = derivability(evidence({ population: 0 }));
  assert.equal(out.derivable, false);
  assert.match(out.because[0]!, /empty population/);
});

test('a signal that fires on nothing is refused, named one by one', () => {
  assert.match(
    derivability(evidence({ neverDelivered: 0 })).because.join(' '), /"never delivered" fires/,
  );
  assert.match(
    derivability(evidence({ alwaysSpilled: 0 })).because.join(' '), /"always spilled" fires/,
  );
  assert.equal(
    derivability(evidence({ neverDelivered: 0, alwaysSpilled: 0 })).because.length, 2,
    'two signals that fire on nothing are two refusals — folding them would hide one',
  );
});

test('a window shorter than a month is refused, and the month is the item\'s number', () => {
  assert.equal(MIN_WINDOW_DAYS, 30);
  const out = derivability(evidence({ windowDays: 25 }));
  assert.equal(out.derivable, false);
  assert.match(out.because.join(' '), /covers 25 day\(s\).*at least 30/);
  assert.equal(
    derivability(evidence({ windowDays: 30 })).derivable, true,
    'a month is enough; the bound is "at least"',
  );
});

test('a distribution whose low tail is the pinned tier is refused', () => {
  // The check no paper would have predicted and the one that killed every
  // threshold considered on 2026-09-11: an `always: true` item is delivered at
  // the pinned doors only, so a delivery rate ranks by which door an item comes
  // through, and the pinned tier lands at the bottom of it.
  const out = derivability(evidence({
    skew: { of: 157, pinned: 39, bestPinnedRank: 68, pinnedInBottomHalf: 39 },
  }));
  assert.equal(out.derivable, false);
  assert.match(out.because.join(' '), /low tail is the PINNED tier/);
  assert.equal(
    derivability(evidence({
      skew: { of: 157, pinned: 0, bestPinnedRank: null, pinnedInBottomHalf: 0 },
    })).derivable, true,
    'a corpus that pins nothing cannot fail this check, and must not fail it by accident',
  );
});

test('a widest gap that separates nothing, or everything, is refused', () => {
  assert.match(
    derivability(evidence({ separation: { widestGapRatio: 99, cutAt: 0, below: 0, of: 200 } }))
      .because.join(' '),
    /separates nothing/,
  );
  assert.match(
    derivability(evidence({ separation: { widestGapRatio: 99, cutAt: 1, below: 200, of: 200 } }))
      .because.join(' '),
    /separates nothing/,
  );
});

test('separation finds a real break and measures it against the typical spacing', () => {
  // Four values packed together, then a jump, then four more.
  const out = separation([0.1, 0.11, 0.12, 0.13, 0.9, 0.91, 0.92, 0.93]);
  assert.equal(out.below, 4, 'the cut falls where the jump is');
  assert.equal(out.cutAt, 0.9);
  assert.ok(out.widestGapRatio > 50, `a break should dwarf the spacing, got ${out.widestGapRatio}`);
});

test('separation reports a smooth slope as one, rather than inventing a cut', () => {
  const out = separation([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(out.widestGapRatio, 1, 'evenly spaced values have no break at all');
  assert.equal(out.of, 8);
});

test('separation answers for a population too small to have a shape', () => {
  assert.deepEqual(separation([]), { widestGapRatio: 0, cutAt: null, below: 0, of: 0 });
  assert.deepEqual(separation([0.5]), { widestGapRatio: 0, cutAt: null, below: 0, of: 1 });
  assert.equal(
    separation([1, 1, 1, 1]).widestGapRatio, 0,
    'identical values are the ABSENCE of separation, never an infinite amount of it',
  );
});

test('tierSkew reports the best rank a pinned item reaches, counting from the bottom', () => {
  const rows = [
    { value: 0.1, pinned: true }, { value: 0.2, pinned: true },
    { value: 0.3, pinned: false }, { value: 0.4, pinned: false },
  ];
  assert.deepEqual(tierSkew(rows), {
    of: 4, pinned: 2, bestPinnedRank: 1, pinnedInBottomHalf: 2,
  });
});

test('tierSkew is silent about a corpus that pins nothing', () => {
  assert.deepEqual(
    tierSkew([{ value: 1, pinned: false }, { value: 2, pinned: false }]),
    { of: 2, pinned: 0, bestPinnedRank: null, pinnedInBottomHalf: 0 },
    'null is "nothing to rank", and it must not read as rank zero',
  );
});

test('payloadTrend measures the load one door carried on one day', () => {
  const records: AuditRecord[] = [
    injection('subagent-start', '2026-08-26T10:00:00.000Z', 20, 0),
    injection('subagent-start', '2026-08-26T11:00:00.000Z', 24, 0),
    injection('subagent-start', '2026-09-10T10:00:00.000Z', 79, 0),
    injection('jit', '2026-09-10T10:00:00.000Z', 20, 25),
  ];
  const out = payloadTrend(records);
  assert.deepEqual(out.map((r) => `${r.op} ${r.day}`), [
    'jit 2026-09-10', 'subagent-start 2026-08-26', 'subagent-start 2026-09-10',
  ], 'grouped by door and day, ordered so a growth curve reads down the column');
  assert.equal(out[1]!.injected, 22, 'two records of 20 and 24 is a mean of 22');
  assert.equal(out[1]!.records, 2);
  assert.equal(
    out[0]!.spilled, 25,
    'spill is the OTHER shape of the same question and is carried beside the payload, because a '
    + 'door that is not spilling can still be growing',
  );
});

test('payloadTrend counts injection records and nothing else', () => {
  const mutation = {
    protocol: '1', kind: 'mutation', op: 'create', at: '2026-09-10T10:00:00.000Z',
  } as unknown as AuditRecord;
  assert.deepEqual(
    payloadTrend([mutation, injection('jit', '2026-09-10T10:00:00.000Z', 3, 0)])
      .map((r) => r.records),
    [1],
    '`injected` and `spilled` are optional fields on one flat record type, so nothing but the '
    + 'kind filter keeps a mutation out of the answer',
  );
});

function injection(op: string, at: string, injected: number, spilled: number): AuditRecord {
  return {
    protocol: '1', kind: 'injection', op, at, tokens: 0,
    injected: Array.from({ length: injected }, (_, i) => ({ id: `I-${i}`, tier: 'jit' })),
    ...(spilled === 0 ? {} : {
      spilled: Array.from({ length: spilled }, (_, i) => ({
        id: `S-${i}`, tier: 'jit', reason: 'budget',
      })),
    }),
  } as unknown as AuditRecord;
}
