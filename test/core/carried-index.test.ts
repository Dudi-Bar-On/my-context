import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { ledgerRows, readAudit } from '../../src/core/audit.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { renderIndexLine } from '../../src/core/render-item.ts';
import { renderSelection } from '../../src/core/render.ts';
import { appendSeen, readSeen, seenIds } from '../../src/core/seen-file.ts';
import { estimateTokens, select } from '../../src/core/select.ts';
import { setSessionName } from '../../src/core/session-names.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
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

/* -------------------------------------------------------------------------- *
 * Task 19 — the disclosure a reader of the injected block actually sees, and
 * the record the audit log keeps of it.
 *
 * **The one spelling.** Every reason below is `select`'s own string, read out
 * of `IndexSummary.carried.dropped` and asserted to appear in the rendered
 * text VERBATIM. That is the whole test: a renderer that re-words a reason is
 * a second spelling of a sentence the UI reads from the same field over
 * `/api/select`, and two surfaces that agree today are what this project keeps
 * paying for. Nothing here matches a literal the renderer could have invented.
 * -------------------------------------------------------------------------- */

test('the disclosure names the session in the label continuity resolved, and invents nothing', () => {
  const items = ['RULE-a', 'RULE-b'].map((id) => item({ id }));
  const named = renderSelection(select(
    items, { event: 'session-start', carried: carriedFrom(['RULE-a'], 'auth-refactor') }, CONFIG,
  ));
  assert.match(named, /carried from session `auth-refactor`/);

  // An unnamed session arrives as its short prefix — `labelFor` decided that,
  // not this renderer, and the renderer prints exactly what it was handed.
  const unnamed = renderSelection(select(
    items, { event: 'session-start', carried: carriedFrom(['RULE-a'], 'a1b2c3d4') }, CONFIG,
  ));
  assert.match(unnamed, /carried from session `a1b2c3d4`/);
});

test('the count in the line is the marked lines rendered, not the ids that were sent', () => {
  const items = [
    item({ id: 'RULE-pinned', always: true }), item({ id: 'RULE-a' }), item({ id: 'RULE-b' }),
  ];
  const sel = select(items, {
    event: 'session-start', carried: carriedFrom(['RULE-pinned', 'RULE-a', 'RULE-b']),
  }, CONFIG);
  const out = renderSelection(sel);

  assert.match(out, /_2 index line\(s\)/,
    'three ids were sent and two arrived — the §6g condition is that the line says two');
  assert.equal((out.match(/ · carried$/gm) ?? []).length, 2,
    'the number in the disclosure is the number of markers above it, counted the same way');
});

test('every carried id that got no line is named with select’s own reason, never a second wording', () => {
  const items = [
    item({ id: 'RULE-pinned', always: true }),
    item({ id: 'RULE-a' }),
    item({ id: 'LESSON-a', type: 'lesson' }),
    item({ id: 'RULE-gone', status: 'superseded' }),
  ];
  const sel = select(items, {
    event: 'session-start',
    carried: carriedFrom(['RULE-pinned', 'RULE-a', 'LESSON-a', 'RULE-gone', 'RULE-vanished']),
  }, CONFIG);
  const out = renderSelection(sel);

  const dropped = sel.index.carried?.dropped ?? [];
  assert.equal(dropped.length, 4, 'the fixture must actually drop four ids, for four reasons');
  assert.equal(new Set(dropped.map((d) => d.reason)).size, 4,
    'four DISTINCT reasons, or this asserts one sentence four times');
  for (const { id, reason } of dropped) {
    assert.ok(out.includes(`${id} (${reason})`),
      `${id} is not disclosed with the reason select gave (${reason}); the renderer has its ` +
      'own wording, which is the drift this whole task exists to prevent');
  }
  assert.match(out, /4 carried id\(s\) got no line/);
});

/**
 * The reason `dropped` did not have, and the hole it left.
 *
 * `dropped` is documented as "every carried id that got no line AND why", and
 * it skipped every CANDIDATE — but a carried candidate can still miss, because
 * `fitIndexOrder` is a budget and carried lines are only at the FRONT of it,
 * not exempt from it. Such an id had no line and no reason: it was disclosed
 * only as an anonymous unit of "+N more", which is
 * `INV-nothing-is-dropped-silently` failing in the one place this feature
 * exists to enforce it.
 */
test('a carried id that did not fit the index budget is dropped WITH a reason, not left anonymous', () => {
  const config = resolveConfig({ budgets: { index: 42 } });
  const a = lineOfCost('RULE-a', 25, true);
  const b = lineOfCost('RULE-b', 21, true);
  const sel = select(
    [a, b], { event: 'session-start', carried: carriedFrom(['RULE-a', 'RULE-b']) }, config,
  );

  assert.deepEqual(sel.index.normative.map((n) => n.id), ['RULE-a'],
    '25 fits and 21 no longer does — both are carried, so neither displaced the other');
  assert.deepEqual(sel.index.carried?.displaced, [],
    'nothing of this session’s OWN was displaced: every candidate here was carried');
  assert.deepEqual(sel.index.carried?.dropped, [{ id: 'RULE-b', reason: 'over the index budget' }]);
  assert.match(renderSelection(sel), /RULE-b \(over the index budget\)/);
});

test('shown plus dropped accounts for every carried id — nothing falls between them', () => {
  const tight = resolveConfig({ budgets: { index: 42 } });
  const cases: { ids: string[]; items: Item[]; config: Config }[] = [
    {
      ids: ['RULE-pinned', 'RULE-a', 'LESSON-a', 'RULE-gone', 'RULE-vanished'],
      items: [
        item({ id: 'RULE-pinned', always: true }), item({ id: 'RULE-a' }),
        item({ id: 'LESSON-a', type: 'lesson' }), item({ id: 'RULE-gone', status: 'superseded' }),
      ],
      config: CONFIG,
    },
    {
      ids: ['RULE-a', 'RULE-b'],
      items: [lineOfCost('RULE-a', 25, true), lineOfCost('RULE-b', 21, true)],
      config: tight,
    },
    {
      ids: ['RULE-b'],
      items: [lineOfCost('RULE-a', 25, false), lineOfCost('RULE-b', 21, true)],
      config: tight,
    },
  ];

  for (const c of cases) {
    const sel = select(c.items, { event: 'session-start', carried: carriedFrom(c.ids) }, c.config);
    const summary = sel.index.carried;
    assert.equal((summary?.shown ?? 0) + (summary?.dropped.length ?? 0), c.ids.length,
      `a carried id is neither shown nor explained: ${JSON.stringify(summary)}`);
  }
});

test('the displaced ids are named, and the whole clause vanishes when nothing was displaced', () => {
  const config = resolveConfig({ budgets: { index: 42 } });
  const withCost = renderSelection(select(
    [lineOfCost('RULE-a', 25, false), lineOfCost('RULE-b', 21, true)],
    { event: 'session-start', carried: carriedFrom(['RULE-b']) }, config,
  ));
  assert.match(withCost, /1 of this session's own line\(s\) displaced/);
  assert.match(withCost, /displaced to make room: RULE-a/);
  // §6n.2's whole point: `renderSpill` drops an index-only spill, so this line
  // is the ONLY place a reader of the injected block learns RULE-a was
  // displaced rather than merely over budget.
  assert.doesNotMatch(withCost, /omitted from full text/);

  const free = renderSelection(select(
    ['RULE-a', 'RULE-b', 'RULE-c'].map((id) => item({ id })),
    { event: 'session-start', carried: carriedFrom(['RULE-c']) }, CONFIG,
  ));
  assert.doesNotMatch(free, /displaced/,
    'a clause that appeared with a zero in it every session is how a reader learns to skim ' +
    'past the one session where it matters');
});

test('a carry whose every id was dropped still renders its disclosure, index heading and all', () => {
  // The index block is otherwise empty here — one pinned item, delivered in
  // full, and nothing else. Returning '' would lose the only account of a
  // carry that arrived and delivered nothing.
  const sel = select(
    [item({ id: 'RULE-pinned', always: true })],
    { event: 'session-start', carried: carriedFrom(['RULE-pinned']) }, CONFIG,
  );
  assert.deepEqual(sel.index.normative, []);

  const out = renderSelection(sel);
  assert.match(out, /## my_context index/);
  assert.match(out, /_0 index line\(s\)/);
  assert.match(out, /RULE-pinned \(delivered in full this session\)/);
  assert.equal(out.includes('\n\n\n'), false, 'no stray blank-line run where the list would be');
});

test('carried: null renders no disclosure and no fetch hint', () => {
  const items = ['RULE-a', 'RULE-b'].map((id) => item({ id }));
  const out = renderSelection(select(items, { event: 'session-start', carried: null }, CONFIG));
  assert.doesNotMatch(out, /carried from session/);
  assert.doesNotMatch(out, /got no line/);
  assert.doesNotMatch(out, /displaced/);
});

/* -------------------------------------------------------------------------- *
 * The audit record — the second surface the same carry has to reach.
 *
 * The ids go into the EXISTING injection record's `injected` array at
 * `tier: 'carried'`, which needs no type change (`InjectedRef.tier` is
 * `string`) and no widening of the two closed tier sets. Both refusals are
 * asserted below rather than trusted, because widening either one is how a
 * replayed ledger comes to claim a delivery of full text that never happened —
 * a carried line is an index LINE, and the `index` tier's own treatment was
 * written to prevent exactly this.
 * -------------------------------------------------------------------------- */

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-carry-audit-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

/** A normative, unpinned item — an index candidate and nothing more. */
function writeRule(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: rule
title: ${title}
status: active
severity: soft
always: false
continuity: false,
---

# ${title}

Body text.
`);
}

test('the injection record carries the carried ids at tier `carried`, and the replayed ledger contains none of them', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  const root = path.join(cwd, '.my_context');

  writeRule(cwd, 'RULE-carried-one', 'A rule the previous session had');
  writeRule(cwd, 'RULE-fresh', 'A rule this session meets for the first time');

  // The source session: a real seen file, which is where `resolveCarry` reads
  // the ids from, plus a name so the label is not the short prefix.
  assert.equal(appendSeen(root, 'sess-previous', [
    { id: 'RULE-carried-one', tier: 'jit', at: '2026-08-20T09:00:00.000Z' },
  ]).written, true);
  assert.equal(setSessionName(root, 'sess-previous', 'auth-refactor').written, true);

  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-now' });
  assert.match(output, /carried from session `auth-refactor`/,
    'the fixture must actually produce a carry, or the record below proves nothing');

  const records = readAudit(root);
  const injection = records.find((r) => r.kind === 'injection' && r.op === 'session-start');
  assert.ok(injection, 'the session start recorded no injection at all');

  const refs = injection.injected ?? [];
  assert.deepEqual(
    refs.filter((e) => e.id === 'RULE-carried-one'),
    [{ id: 'RULE-carried-one', tier: 'carried' }],
    'the carried line is recorded ONCE, at tier carried — not twice, and not as a plain index line',
  );
  assert.deepEqual(
    refs.filter((e) => e.id === 'RULE-fresh').map((e) => e.tier), ['index'],
    'an uncarried index line still records at tier index; only the carried one moves',
  );

  // The two closed sets stay closed. `ledgerRows` refuses the tier by
  // construction, and the seen file never sees it: a carried line is not a
  // delivery of full text, and a rebuilt ledger claiming it was would suppress
  // an item that was never actually injected.
  assert.deepEqual(
    ledgerRows(records).filter((r) => r.itemId === 'RULE-carried-one'), [],
    'a replayed ledger must claim no delivery for a line that was only ever an index entry',
  );
  assert.equal(seenIds(readSeen(root, 'sess-now')).includes('RULE-carried-one'), false,
    'the seen file records deliveries; a carried index line is not one');

  // The note carries what the refs cannot: WHERE the carry came from, and what
  // it cost. The count of carried lines is not repeated here — it is the refs,
  // counted, and `mycontext audit` already prints the tier tally.
  assert.match(injection.note ?? '', /carried from session auth-refactor/);
});

test('a session with nothing to carry from records no carried refs and no carry note', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  const root = path.join(cwd, '.my_context');
  writeRule(cwd, 'RULE-fresh', 'A rule this session meets for the first time');

  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-only' });
  assert.doesNotMatch(output, /carried from session/);

  const records = readAudit(root);
  const injection = records.find((r) => r.kind === 'injection' && r.op === 'session-start');
  assert.ok(injection);
  assert.deepEqual((injection.injected ?? []).map((e) => e.tier), ['index'],
    'no carry, no carried tier — the vocabulary widens only when something used it');
  assert.doesNotMatch(injection.note ?? '', /carried/);
});
