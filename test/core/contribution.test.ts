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
import { contributions, cohorts } from '../../src/core/contribution.ts';
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

function item(id: string, origin: Item['origin']): Item {
  return { id, origin } as unknown as Item;
}

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
  const rows = cohorts(items, got);
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
  const rows = cohorts(items, got);
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
  const rows = cohorts(items, got);
  assert.deepEqual(rows.map((r) => r.origin), ['human']);
  assert.equal(rows[0]!.items, 1);
  assert.ok(got.has('RULE-gone'), 'the reader still saw it — only the cohort table drops it');
});
