// @basis TASK-measure-which-items-are-actually-delivered-before-anything
/**
 * **What this rests on, and the one thing it must keep honest.**
 *
 * The item above says per-item contribution is derivable BACKWARDS out of the
 * audit log, because `recordAudit` has always written one `kind: 'injection'`
 * record per delivery carrying `injected` and `spilled`. Every assertion here
 * is about that claim and nothing else: given records of that shape, what does
 * the reader count.
 *
 * The fixtures are hand-built `AuditRecord`s rather than a corpus, deliberately
 * — `contributions` touches no filesystem, so a temp workspace would only add a
 * way for this file to fail for a reason that is not about counting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cohorts, contributions, exposure, undelivered,
} from '../../src/core/contribution.ts';
import type { AuditRecord } from '../../src/core/audit.ts';
import type { Item } from '../../src/core/types.ts';

function injection(
  at: string,
  injected: { id: string; tier: string }[],
  spilled: { id: string; tier: string; reason: string }[] = [],
): AuditRecord {
  return {
    protocol: '1', kind: 'injection', op: 'session-start', at, injected, tokens: 0,
    ...(spilled.length === 0 ? {} : { spilled }),
  };
}

function item(
  id: string, origin: Item['origin'],
  type: string = 'rule', status: string = 'active',
): Item {
  return { id, origin, type, status } as unknown as Item;
}

/**
 * **The eligibility gate, spelled here as the test's OWN rule rather than
 * imported from `select.ts`.**
 *
 * `cohorts` and `undelivered` take the predicate as an argument precisely so
 * they can be tested without a config, and a test that imported the real gate
 * would be asserting `select`'s behaviour instead of the counting. What is
 * under test is that a predicate answering `false` moves an item out of every
 * measured population and into `items` alone.
 *
 * `rule` stands for a normative category and `task` for a rationale one, which
 * is the split `ADR-normative-vs-rationale-tiers` draws; `status !== 'active'`
 * is the other half of `isEligible`.
 */
const injectable = (i: Item): boolean =>
  i.status === 'active' && (i.type as string) === 'rule';

test('an item delivered twice is counted twice, and its tiers are collected', () => {
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-a', tier: 'pinned' }]),
    injection('2026-09-02T10:00:00.000Z', [{ id: 'RULE-a', tier: 'jit' }]),
  ]);
  const a = got.get('RULE-a');
  assert.ok(a, 'RULE-a must appear');
  assert.equal(a.delivered, 2);
  assert.equal(a.spilled, 0);
  assert.deepEqual(a.tiers.slice().sort(), ['jit', 'pinned']);
  assert.equal(a.firstAt, '2026-09-01T10:00:00.000Z');
  assert.equal(a.lastAt, '2026-09-02T10:00:00.000Z');
});

test('a spilled item is counted as spilled and NOT as delivered', () => {
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [], [{ id: 'RULE-b', tier: 'jit', reason: 'budget' }]),
  ]);
  const b = got.get('RULE-b');
  assert.ok(b, 'a spilled item must still appear — never delivered is the finding');
  assert.equal(b.delivered, 0);
  assert.equal(b.spilled, 1);
});

test('records that are not injections are ignored', () => {
  const got = contributions([
    { protocol: '1', kind: 'mutation', op: 'create', at: '2026-09-01T10:00:00.000Z' },
  ]);
  assert.equal(got.size, 0);
});

/**
 * An injection record written before `injected` existed, or one whose every
 * candidate spilled, carries no `injected` array at all. Absent is not zero
 * anywhere else in this log (`AuditRecord.tokens`' own doc comment says so),
 * and here the two agree on the count but must not agree by accident: the
 * reader must not throw on the absence.
 */
test('an injection record with neither list is read, not thrown on', () => {
  const got = contributions([
    { protocol: '1', kind: 'injection', op: 'jit', at: '2026-09-01T10:00:00.000Z' },
  ]);
  assert.equal(got.size, 0);
});

test('an item that exists but was never delivered is counted in its cohort', () => {
  const items = new Map([
    ['RULE-h', item('RULE-h', 'human')],
    ['RULE-a', item('RULE-a', 'agent')],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-h', tier: 'pinned' }]),
  ]);
  const rows = cohorts(items, got, injectable);
  const human = rows.find((r) => r.origin === 'human');
  const agent = rows.find((r) => r.origin === 'agent');
  assert.ok(human && agent);
  assert.equal(human.items, 1);
  assert.equal(human.neverDelivered, 0);
  assert.equal(agent.items, 1);
  assert.equal(agent.neverDelivered, 1, 'an item with no injection record has never been delivered');
});

/**
 * `alwaysSpilled` is the sharpest row this report can produce — an item the
 * selector chose and the budget then cut, every single time — so it must be a
 * strict subset of `neverDelivered` rather than a second count of the same
 * thing. An item delivered once and spilled ten times is NOT always spilled.
 */
test('always-spilled counts only items that were spilled and never once delivered', () => {
  const items = new Map([
    ['RULE-cut', item('RULE-cut', 'human')],
    ['RULE-both', item('RULE-both', 'human')],
    ['RULE-quiet', item('RULE-quiet', 'human')],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-both', tier: 'jit' }], [
      { id: 'RULE-cut', tier: 'jit', reason: 'budget' },
      { id: 'RULE-both', tier: 'jit', reason: 'budget' },
    ]),
  ]);
  const rows = cohorts(items, got, injectable);
  const human = rows.find((r) => r.origin === 'human');
  assert.ok(human);
  assert.equal(human.items, 3);
  assert.equal(human.neverDelivered, 2, 'RULE-cut and RULE-quiet');
  assert.equal(human.alwaysSpilled, 1, 'only RULE-cut — RULE-both was delivered once');
  assert.equal(human.medianDelivered, 0, 'delivered counts are 0, 0, 1');
});

/**
 * An id in the log that answers to no item today is the corpus MOVING — an
 * item retired or superseded after the injection that delivered it. The cohort
 * table is keyed on items that exist, so such an id contributes to no cohort;
 * it must not invent one, and it must not be silently counted as `human`.
 */
test('an injected id with no item today belongs to no cohort', () => {
  const items = new Map([['RULE-h', item('RULE-h', 'human')]]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [
      { id: 'RULE-h', tier: 'pinned' }, { id: 'RULE-gone', tier: 'pinned' },
    ]),
  ]);
  const rows = cohorts(items, got, injectable);
  assert.deepEqual(rows.map((r) => r.origin), ['human']);
  assert.equal(rows[0]!.items, 1);
  assert.ok(got.has('RULE-gone'), 'the reader still saw it — only the cohort table drops it');
});

/**
 * **The correction this file exists to keep honest, and the one that was
 * missing from the first reading.**
 *
 * `select` admits only categories whose tier is `normative`, so a `task` is
 * never a candidate for injection. Its delivery count is zero for a reason
 * that has nothing to do with the item, and on 2026-09-10 918 of this
 * corpus's 1,076 items were in exactly that position — enough to make the
 * whole-corpus figure ("82% never delivered") say something no reader should
 * act on, and to force `reports/2026-09-08-contribution-baseline.md` to
 * correct its own headline in prose.
 *
 * So an ineligible item must reach `items` and NOTHING else: not
 * `neverDelivered`, not `alwaysSpilled`, and not the median's population.
 * Remove the `injectable` gate from `cohorts` and this test goes red on three
 * separate assertions.
 */
test('an item select could never choose is counted in items and in nothing else', () => {
  const items = new Map([
    ['RULE-lands', item('RULE-lands', 'human')],
    ['TASK-never-a-candidate', item('TASK-never-a-candidate', 'human', 'task')],
    ['RULE-stood-down', item('RULE-stood-down', 'human', 'rule', 'superseded')],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-lands', tier: 'pinned' }], [
      { id: 'TASK-never-a-candidate', tier: 'jit', reason: 'budget' },
    ]),
  ]);
  const rows = cohorts(items, got, injectable);
  const human = rows.find((r) => r.origin === 'human');
  assert.ok(human);
  assert.equal(human.items, 3, 'all three exist and the corpus size must not shrink');
  assert.equal(human.injectable, 1, 'only RULE-lands is both normative and active');
  assert.equal(human.neverDelivered, 0,
    'the task and the superseded rule are ineligible, not unused');
  assert.equal(human.alwaysSpilled, 0,
    'a spilled ineligible item is not evidence the budget is cutting governance');
  assert.equal(human.medianDelivered, 1,
    'the median is over the injectable population — pooling the other two would make it 0');
});

/**
 * **The corpus moves under the log, and the report must say so where the
 * numbers are.**
 *
 * Eligibility is a verdict about today; the log is about the past. An item
 * delivered nine hundred times and superseded yesterday leaves every measured
 * population while its delivery events stay on disk. Counting it as a plain
 * ineligible item would hide the fact that the measured set shrank for a
 * reason a later reading needs to know about.
 */
test('an item the log delivered and the corpus has since stood down is counted as that', () => {
  const items = new Map([
    ['RULE-was', item('RULE-was', 'human', 'rule', 'superseded')],
    ['TASK-quiet', item('TASK-quiet', 'human', 'task')],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-was', tier: 'pinned' }]),
  ]);
  const rows = cohorts(items, got, injectable);
  const human = rows.find((r) => r.origin === 'human');
  assert.ok(human);
  assert.equal(human.injectable, 0);
  assert.equal(human.deliveredNotInjectable, 1,
    'RULE-was only — TASK-quiet is ineligible AND was never delivered, which is not a change');
});

/**
 * `undelivered` is the one list in the report a reader can act on, so it must
 * name only items that GOVERN today. An ineligible item in it would send a
 * reader to look at a `task` for not having been injected.
 */
test('undelivered names injectable items only', () => {
  const items = new Map([
    ['RULE-lands', item('RULE-lands', 'human')],
    ['RULE-quiet', item('RULE-quiet', 'agent')],
    ['TASK-quiet', item('TASK-quiet', 'human', 'task')],
    ['RULE-stood-down', item('RULE-stood-down', 'human', 'rule', 'deprecated')],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-lands', tier: 'pinned' }]),
  ]);
  assert.deepEqual(
    undelivered(items, got, injectable).map((i) => i.id), ['RULE-quiet'],
    'the task and the deprecated rule could not have been delivered, so their silence is not a finding',
  );
});

/**
 * An empty answer here is the corpus's best case AND the shape of a broken
 * instrument, and the two are indistinguishable from this function alone —
 * a quiet run is not a clean corpus. The assertion is
 * that emptiness is REACHABLE, which is what makes the non-empty answer above
 * a measurement rather than a constant.
 */
test('undelivered is empty when every injectable item has landed at least once', () => {
  const items = new Map([['RULE-lands', item('RULE-lands', 'human')]]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-lands', tier: 'pinned' }]),
  ]);
  assert.deepEqual(undelivered(items, got, injectable), []);
});

/**
 * **The correction that decides whether a delivery count may ever become a
 * retirement threshold.**
 *
 * On the real corpus (2026-09-10) the twenty least-delivered injectable items
 * were the twenty most recently created, and the twenty most-delivered were
 * all created in August: the raw ranking is age, not usefulness. So an item
 * that has landed in every injection since it existed must not read as
 * "barely delivered" beside one that existed for the whole log.
 */
test('an item is measured against the chances it actually had, not the whole log', () => {
  const items = new Map([
    ['RULE-old', { ...item('RULE-old', 'human'), validFrom: '2026-09-01' } as Item],
    ['RULE-new', { ...item('RULE-new', 'human'), validFrom: '2026-09-03' } as Item],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-old', tier: 'pinned' }]),
    injection('2026-09-02T10:00:00.000Z', [{ id: 'RULE-old', tier: 'pinned' }]),
    injection('2026-09-03T10:00:00.000Z', [
      { id: 'RULE-old', tier: 'pinned' }, { id: 'RULE-new', tier: 'pinned' },
    ]),
    injection('2026-09-04T10:00:00.000Z', [{ id: 'RULE-new', tier: 'pinned' }]),
  ]);
  const rows = exposure(items, got, [
    '2026-09-01T10:00:00.000Z', '2026-09-02T10:00:00.000Z',
    '2026-09-03T10:00:00.000Z', '2026-09-04T10:00:00.000Z',
  ]);
  const old = rows.get('RULE-old');
  const fresh = rows.get('RULE-new');
  assert.ok(old && fresh);
  assert.equal(old.delivered, 3);
  assert.equal(fresh.delivered, 2, 'fewer deliveries — and the raw count would rank it lower');
  assert.equal(old.opportunities, 4);
  assert.equal(fresh.opportunities, 2, 'it did not exist for the first two records');
  assert.equal(old.rate, 0.75);
  assert.equal(fresh.rate, 1, 'it landed in every injection since it existed');
  assert.ok(fresh.rate > old.rate!,
    'the order REVERSES once exposure is accounted for — which is the whole finding');
});

/**
 * `valid_from` is optional on an item. Crediting such an item with the whole
 * log is the PESSIMISTIC reading: it makes the rate as low as the data allows
 * rather than as flattering as possible, so an unknown creation date can never
 * manufacture a high score.
 */
test('an item with no valid_from is credited with the whole log, not with none of it', () => {
  const items = new Map([['RULE-x', { ...item('RULE-x', 'human'), validFrom: null } as Item]]);
  const got = contributions([
    injection('2026-09-04T10:00:00.000Z', [{ id: 'RULE-x', tier: 'pinned' }]),
  ]);
  const row = exposure(items, got, ['2026-09-01T10:00:00.000Z', '2026-09-04T10:00:00.000Z'])
    .get('RULE-x');
  assert.ok(row);
  assert.equal(row.opportunities, 2);
  assert.equal(row.rate, 0.5);
});

/** An empty log gives every item zero chances, and a rate of `null` — not 0. */
test('no injection records means no chances, and the rate is unmeasured rather than zero', () => {
  const items = new Map([['RULE-x', { ...item('RULE-x', 'human'), validFrom: '2026-09-01' } as Item]]);
  const row = exposure(items, new Map(), []).get('RULE-x');
  assert.ok(row);
  assert.equal(row.opportunities, 0);
  assert.equal(row.rate, null, '0/0 is unmeasured, and a zero here would read as a finding');
});
