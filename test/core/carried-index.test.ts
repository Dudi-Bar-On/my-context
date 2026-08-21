import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../../src/core/config.ts';
import { renderIndexLine } from '../../src/core/render-item.ts';
import { renderSelection } from '../../src/core/render.ts';
import { estimateTokens, select } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * §6n.2's ordering, its marker, and — the half a plan usually loses — the cost
 * of the ordering, named exactly.
 *
 * **What this file is really guarding is `INV-nothing-is-dropped-silently`.** A
 * carried id that gets no index line has to SAY why, and every reason has to be
 * reachable. Task 3's probe (`reports/probes/2026-08-20-carry-set.md`) measured
 * this repository's own corpus and found that exactly ONE drop reason ever
 * fires there — `delivered in full this session`, on the seven pinned items —
 * and that displacement first appears one token below the current index cost.
 * So the other reasons and the exhausted-budget case are built here as
 * synthetic fixtures rather than reported as covered because the code has a
 * branch for them.
 */

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'RULE-a', type: 'rule', title: 'A rule', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/rule/RULE-a.md',
    ...over,
  };
}

/**
 * An item whose index line costs EXACTLY `tokens`, marker included.
 *
 * The displacement fixtures below turn on arithmetic between three line costs
 * and a budget, and a title typed by hand makes that arithmetic a coincidence
 * nobody can check. This derives the title length from the cost the fixture
 * needs, and every caller asserts the cost it asked for came back — so a
 * changed `renderIndexLine` breaks the fixture loudly instead of quietly
 * moving which lines fit.
 */
function lineOfCost(id: string, tokens: number, carried: boolean): Item {
  const length = tokens * 4;
  const prefix = renderIndexLine({ id, type: 'rule', title: '' }).length;
  const marker = carried ? renderIndexLine({ id, type: 'rule', title: '', carried: true }).length - prefix : 0;
  const width = length - prefix - marker;
  assert.ok(width > 0, `a ${tokens}-token line leaves no room for a title`);
  return item({ id, title: 'x'.repeat(width) });
}

/** The `SelectContext.carried` shape, with the ids the case is about. */
function carriedFrom(ids: string[], label = 'auth-refactor'): {
  sessionId: string; label: string; ids: string[];
} {
  return { sessionId: 'sess-previous', label, ids };
}

test('a carried id that is already a candidate is marked, not duplicated', () => {
  const items = [item({ id: 'RULE-a' }), item({ id: 'RULE-b' })];
  const sel = select(items, { event: 'session-start', carried: carriedFrom(['RULE-a']) }, CONFIG);

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-a', 'RULE-b'],
    'a carried candidate appears exactly once — the dedupe §6m.11 requires is by construction');
  assert.equal(sel.index.normative[0].carried, true);
  assert.equal(sel.index.normative[1].carried, undefined);
  assert.equal(sel.index.carried?.shown, 1);
  assert.deepEqual(sel.index.carried?.dropped, []);
});

test('carried candidates come first in the index, ahead of the by-id order', () => {
  const items = ['RULE-a', 'RULE-b', 'RULE-c'].map((id) => item({ id }));
  const sel = select(items, { event: 'session-start', carried: carriedFrom(['RULE-c']) }, CONFIG);

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-c', 'RULE-a', 'RULE-b'],
    '§6n.2 says FRONT of queue: front-of-queue is what makes carry do anything on an ' +
    'exhausted index, and reversing it makes carry a no-op whenever budgets.index is full');
  assert.deepEqual(
    sel.index.normative.filter((n) => n.carried).map((n) => n.id), ['RULE-c'],
  );
});

/**
 * The exhausted-budget case. Task 3 measured that this repository's own corpus
 * displaces nothing at any budget from 1200 down to 470 and displaces exactly
 * one line at 469 — so the case exists, one token below where this project
 * lives, and it is built here rather than left to the corpus.
 */
test('with an exhausted budget, a carried line displaces a non-carried one, and the displaced one spills', () => {
  const config = resolveConfig({ budgets: { index: 42 } });
  const a = lineOfCost('RULE-a', 25, false);
  const b = lineOfCost('RULE-b', 21, true);
  const sel = select([a, b], { event: 'session-start', carried: carriedFrom(['RULE-b']) }, config);

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-b'],
    'the carried line is admitted first and the by-id winner no longer fits');
  assert.equal(sel.index.truncated, 1);
  assert.deepEqual(sel.spilled.map((s) => ({ id: s.id, tier: s.tier })),
    [{ id: 'RULE-a', tier: 'index' }]);
});

test('the displaced id is named in carried.displaced, and its spill reason names the carry, not just the budget', () => {
  const config = resolveConfig({ budgets: { index: 42 } });
  const a = lineOfCost('RULE-a', 25, false);
  const b = lineOfCost('RULE-b', 21, true);
  const sel = select([a, b], { event: 'session-start', carried: carriedFrom(['RULE-b']) }, config);

  // §6n.2: "displace something, and say so." The spill alone does not say it.
  assert.deepEqual(sel.index.carried?.displaced, ['RULE-a']);
  const spill = sel.spilled.find((s) => s.id === 'RULE-a');
  assert.match(spill?.reason ?? '', /displaced by a line carried from session auth-refactor/,
    'a displaced line whose reason names only the budget is the most-named defect in this ' +
    'project committed deliberately');
  assert.match(spill?.reason ?? '', /index budget/,
    'the budget is still named — the carry is why this line lost, the budget is why there was ' +
    'a contest');
});

test('displaced is the exact set difference, not a count — the two-pass computation', () => {
  // The by-id order admits {A,C} and carried-first admits {B,C}, so displaced is
  // exactly ['A'] — one line lost while the ADMITTED COUNT is unchanged at two.
  // A count, or a prefix of the order, cannot express that: the budget loop
  // `continue`s rather than `break`s on an overflow, so the admitted set is not
  // a prefix and the difference has to be computed.
  const config = resolveConfig({ budgets: { index: 42 } });
  const a = lineOfCost('RULE-a', 25, false);
  const b = lineOfCost('RULE-b', 21, true);
  const c = lineOfCost('RULE-c', 13, false);

  assert.equal(estimateTokens(renderIndexLine({ id: 'RULE-a', type: 'rule', title: a.title })), 25);
  assert.equal(
    estimateTokens(renderIndexLine({ id: 'RULE-b', type: 'rule', title: b.title, carried: true })), 21,
    'the carried line is costed WITH its marker, in both passes',
  );
  assert.equal(estimateTokens(renderIndexLine({ id: 'RULE-c', type: 'rule', title: c.title })), 13);

  const plain = select([a, b, c], { event: 'session-start' }, config);
  assert.deepEqual(plain.index.normative.map((n) => n.id), ['RULE-a', 'RULE-c'],
    'the by-id order admits A then skips B then admits C');

  const sel = select(
    [a, b, c], { event: 'session-start', carried: carriedFrom(['RULE-b']) }, config,
  );
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-b', 'RULE-c']);
  assert.deepEqual(sel.index.carried?.displaced, ['RULE-a'],
    'C is admitted under both orders and is NOT displaced; A is the whole of the cost');
  assert.equal(sel.index.normative.length, plain.index.normative.length,
    'the admitted COUNT is identical — which is exactly why a count cannot find A');
});

test('with an unexhausted budget nothing is displaced and carried.displaced is empty', () => {
  // The case this repository's own corpus measures: Task 3's F = 0, at 470 of
  // 1200 index tokens with the marker charged.
  const items = ['RULE-a', 'RULE-b', 'RULE-c'].map((id) => item({ id }));
  const sel = select(items, { event: 'session-start', carried: carriedFrom(['RULE-c']) }, CONFIG);

  assert.deepEqual(sel.index.carried?.displaced, []);
  assert.equal(sel.index.truncated, 0);
  assert.deepEqual(sel.spilled, []);
  assert.equal(sel.index.carried?.shown, 1);
});

test('a carried id delivered in full this session is dropped with that reason, and gets no line', () => {
  // Task 3's |A \ B| = 7 on this repository: every one of the seven is here for
  // this reason and no other, because all seven are the pinned items.
  const items = [item({ id: 'RULE-pinned', always: true }), item({ id: 'RULE-b' })];
  const sel = select(
    items, { event: 'session-start', carried: carriedFrom(['RULE-pinned', 'RULE-b']) }, CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-pinned']);
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-b'],
    'an item already delivered in full gets no index line, carried or not');
  assert.deepEqual(sel.index.carried?.dropped,
    [{ id: 'RULE-pinned', reason: 'delivered in full this session' }]);
  assert.equal(sel.index.carried?.shown, 1);
});

test('a carried id that is now superseded is dropped with "no longer eligible"', () => {
  const items = [item({ id: 'RULE-a' }), item({ id: 'RULE-gone', status: 'superseded' })];
  const sel = select(
    items, { event: 'session-start', carried: carriedFrom(['RULE-a', 'RULE-gone']) }, CONFIG,
  );

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-a']);
  assert.deepEqual(sel.index.carried?.dropped,
    [{ id: 'RULE-gone', reason: 'no longer eligible' }]);
});

test('a carried id whose category is disabled is dropped with "no longer eligible" too', () => {
  const config = resolveConfig({ categories: { rule: { enabled: false } } });
  const sel = select(
    [item({ id: 'RULE-a' })], { event: 'session-start', carried: carriedFrom(['RULE-a']) }, config,
  );

  assert.deepEqual(sel.index.normative, []);
  assert.deepEqual(sel.index.carried?.dropped, [{ id: 'RULE-a', reason: 'no longer eligible' }]);
});

test('a carried id on a rationale category is dropped with "not a normative category"', () => {
  const items = [item({ id: 'RULE-a' }), item({ id: 'LESSON-a', type: 'lesson' })];
  const sel = select(
    items, { event: 'session-start', carried: carriedFrom(['RULE-a', 'LESSON-a']) }, CONFIG,
  );

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-a']);
  assert.deepEqual(sel.index.carried?.dropped,
    [{ id: 'LESSON-a', reason: 'not a normative category' }]);
});

test('a carried id nothing knows is dropped with "unknown id"', () => {
  const sel = select(
    [item({ id: 'RULE-a' })],
    { event: 'session-start', carried: carriedFrom(['RULE-a', 'RULE-vanished']) },
    CONFIG,
  );

  assert.deepEqual(sel.index.carried?.dropped,
    [{ id: 'RULE-vanished', reason: 'unknown id' }]);
});

/**
 * The reason the plan's four do not cover, and the one a user is most likely to
 * meet: focus.
 *
 * A focused session narrows `eligible` before `buildIndex` ever sees it, so a
 * carried id the focus hides is not a candidate — it would fall through to
 * `no longer eligible`, which is FALSE about it. The item is eligible; the user
 * narrowed. Reporting the wrong reason is a silent drop wearing a label.
 */
test('a carried id the active focus hides says so, rather than claiming it is no longer eligible', () => {
  const items = [
    item({ id: 'RULE-a', tags: ['billing'] }),
    item({ id: 'RULE-b', tags: ['shipping'] }),
  ];
  const sel = select(items, {
    event: 'session-start',
    focus: {
      tags: ['billing'], categories: [], scope: [],
      setAt: '2026-08-20T00:00:00.000Z', setBy: 'human',
    },
    carried: carriedFrom(['RULE-a', 'RULE-b']),
  }, CONFIG);

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-a']);
  assert.deepEqual(sel.index.carried?.dropped,
    [{ id: 'RULE-b', reason: 'hidden by the active focus' }]);
});

test('the budget charged equals the rendered length, marker included', () => {
  // The mis-sizing guard. `renderIndexLine` is called twice for every line —
  // once by `estimateTokens` to charge the budget and once by the renderer — so
  // a marker appended anywhere else charges for a line shorter than the one
  // delivered, which is exactly the failure §6a names.
  const items = ['RULE-a', 'RULE-b', 'RULE-c'].map((id) => item({ id }));
  const sel = select(items, { event: 'session-start', carried: carriedFrom(['RULE-b']) }, CONFIG);

  const charged = sel.index.normative.reduce((t, n) => t + estimateTokens(renderIndexLine(n)), 0);
  assert.equal(sel.tokens, charged,
    'Selection.tokens is the figure the admissions were decided against, over the SAME line ' +
    'objects the renderer is handed');

  const rendered = renderSelection(sel);
  assert.match(rendered, /^- RULE-b · rule · A rule · carried$/m,
    'the marker is inside the costed line, not appended by the renderer');
  assert.match(rendered, /^- RULE-a · rule · A rule$/m);
  assert.equal((rendered.match(/ · carried$/gm) ?? []).length, 1);
});

test('carried: null is byte-identical to today', () => {
  const items = [
    item({ id: 'RULE-pinned', always: true }),
    item({ id: 'RULE-a' }),
    item({ id: 'LESSON-a', type: 'lesson' }),
    item({ id: 'RULE-gone', status: 'superseded' }),
  ];
  const absent = select(items, { event: 'session-start' }, CONFIG);
  const explicit = select(items, { event: 'session-start', carried: null }, CONFIG);

  assert.deepEqual(explicit, absent);
  assert.equal(absent.index.carried, null);
  for (const line of absent.index.normative) {
    assert.equal(Object.hasOwn(line, 'carried'), false,
      'an index line carries no `carried` key at all when nothing was carried — an undefined ' +
      'own property is a shape change every JSON consumer would see');
  }
  assert.equal(renderSelection(explicit), renderSelection(absent));
  assert.doesNotMatch(renderSelection(absent), /carried/);
});

test('select still reads nothing from disk', () => {
  // The INV-select-is-pure guard: `- [invariant] select imports only types and
  // config`. Carry arrives through `SelectContext`, and the moment this module
  // reads a seen file itself the whole selection rule stops being testable as
  // data-in/data-out.
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', 'select.ts'), 'utf8',
  );
  const imports = [...source.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0, 'the import scan found nothing, so it proves nothing');
  assert.deepEqual(
    imports.filter((s) => s.startsWith('node:')), [],
    `core/select.ts imports a node builtin: ${imports.join(', ')}`,
  );
  assert.deepEqual(
    imports.filter((s) => /store|seen-file|ledger|continuity|audit|workspace|rebuild/.test(s)), [],
    `core/select.ts imports an I/O module: ${imports.join(', ')}`,
  );
});
