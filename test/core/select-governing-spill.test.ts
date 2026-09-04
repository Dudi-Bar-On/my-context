/**
 * **The gap `TASK-a-governing-item-degraded-to-an-index-line-looks-delivered`
 * (`plan:budget seq:14`) closes.** `governs`/`byPriority` (seq:11, commit
 * `016cdad`) made a governing item win a tier's admission race first; it did
 * not change what happens to the one that STILL loses. Today that item
 * becomes an ordinary `## my_context index` bullet — id, type, title — with
 * nothing distinguishing it from a `note` or an `adr`, and nothing saying its
 * body never arrived. That is the silent degradation the owner ruled against
 * 2026-09-04: *"a normative or pinned item is delivered with its body, or it
 * is NAMED as not delivered … never silently degraded to an index line."*
 *
 * `Selection.governingSpill` is the disclosure, in `PinnedSpill`/
 * `ContinuitySpill`'s own shape: `null` means nothing governing went
 * bodyless this call (including every tool event, where the index tier does
 * not run at all — `tiersRun`). Non-null names every governing id that did,
 * split by whether it at least got a title (`titled`) or reached the reader
 * in no form whatsoever (`untitled` — spilled the index tier's own budget
 * too), plus what delivering all of them in full would have cost.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'RULE-a', type: 'rule', title: 'A rule', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/rule/RULE-a.md',
    ...over,
  };
}

const body = (n: number) => 'x'.repeat(n);

test('a governing item not admitted to any full-text tier is named, not silently indexed', () => {
  const config = resolveConfig({});
  const items = [
    item({ id: 'RULE-a', type: 'rule', always: false }),
    // Normative but not governing (`select-governance.test.ts`'s own fixture
    // category): reaches the index exactly as the rule does, on the OLD
    // behaviour indistinguishably so.
    item({ id: 'KNOWN-a', type: 'known_issue' }),
  ];
  const sel = select(items, { event: 'session-start' }, config);

  // The old behaviour: the rule reaches the index exactly like the known_issue does.
  assert.deepEqual(sel.full, []);
  assert.deepEqual(sel.index.normative.map((l) => l.id).sort(), ['KNOWN-a', 'RULE-a']);

  // The new behaviour: the rule is ALSO named as undelivered, the known_issue is not.
  assert.notEqual(sel.governingSpill, null);
  assert.deepEqual(sel.governingSpill!.titled, ['RULE-a']);
  assert.deepEqual(sel.governingSpill!.untitled, []);
});

test('a governing item delivered in full (pinned) is not named as undelivered', () => {
  const config = resolveConfig({});
  const sel = select(
    [item({ id: 'RULE-pinned', type: 'rule', always: true })],
    { event: 'session-start' }, config,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-pinned']);
  assert.equal(sel.governingSpill, null);
});

test('a governing item that spills the index budget too is named as untitled, not silently dropped', () => {
  const config = resolveConfig({ budgets: { index: 1 } });
  const sel = select(
    [item({ id: 'RULE-big', type: 'rule', title: body(200) })],
    { event: 'session-start' }, config,
  );
  assert.deepEqual(sel.index.normative, []);
  assert.notEqual(sel.governingSpill, null);
  assert.deepEqual(sel.governingSpill!.titled, []);
  assert.deepEqual(sel.governingSpill!.untitled, ['RULE-big']);
});

test('governingSpill is null on a tool event: the index tier never runs there', () => {
  const config = resolveConfig({});
  const sel = select(
    [item({ id: 'RULE-a', type: 'rule', scope: [] })],
    { event: 'tool', path: 'src/x.ts' }, config,
  );
  assert.equal(sel.governingSpill, null);
});

test('governingSpill is null when every governing item was delivered in full or nothing governs', () => {
  const config = resolveConfig({});
  const sel = select(
    [item({ id: 'NOTE-only', type: 'note' })],
    { event: 'session-start' }, config,
  );
  assert.equal(sel.governingSpill, null);
});

test('governingSpill.cost is the estimated cost of delivering every named id in full', () => {
  const config = resolveConfig({});
  const sel = select(
    [item({ id: 'RULE-a', type: 'rule', body: body(400) })],
    { event: 'session-start' }, config,
  );
  assert.notEqual(sel.governingSpill, null);
  assert.ok(sel.governingSpill!.cost > 100, `expected a real cost, got ${sel.governingSpill!.cost}`);
});

test('an open (not-done) task/plan never reaches governingSpill: it is rationale-tier and never a candidate', () => {
  const config = resolveConfig({});
  const sel = select(
    [item({ id: 'TASK-open', type: 'task', extra: { state: 'todo' } })],
    { event: 'session-start' }, config,
  );
  assert.equal(sel.governingSpill, null);
});
