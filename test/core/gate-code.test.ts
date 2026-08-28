/**
 * The gate ladder: a STABLE CODE for the gate an item first failed, beside the
 * English sentence that has always said it.
 *
 * WHAT THIS PINS, and why it is worth a file of its own.
 *
 * `INV-nothing-is-dropped-silently` says an item that got no line has to say
 * why. It has always said it once, for a human — `injection()`'s `phrase` and
 * `Spill.reason`. The injection preview's gate ladder
 * (`docs/design/web-ui-mockup.html`, `#gates` / `preview.why`) needs the same
 * fact for a MACHINE: which of `select()`'s six gates bound, so the rungs above
 * it can be drawn as passed and the rungs below as *not reached*. The mockup
 * says in as many words what was missing — *"Composing the fix needs a stable
 * code on `injection()`; today the five causes differ only in English prose."*
 *
 * The prose was never an option to read. A screen recovering the gate by
 * matching on "is disabled in this project" would be a SECOND implementation
 * of the selector's decision, and it breaks silently the day someone improves
 * the wording. So the code is a second FIELD, written by the branch that writes
 * the sentence — and these tests are about that structure as much as about the
 * values:
 *
 *   1. the ladder is closed and ordered (`GATE_RUNG`, `GATE_LADDER`);
 *   2. every branch of `injection()` writes both halves, and the SENTENCES are
 *      pinned verbatim so that adding the code cannot have moved one;
 *   3. `injected === (gate === 'passed')` over a cross product of items and
 *      configs — the two halves cannot disagree, because there is no second
 *      `if` chain for them to disagree through;
 *   4. the vocabulary is the one the chart draws, checked against the mockup
 *      rather than against this file's memory of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { injection } from '../../src/cli/commands/injection.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import { GATE_LADDER, GATE_RUNG, type GateCode } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const BASE = resolveConfig({});
const INERT = resolveConfig({ categories: { constraint: { scopePolicy: 'inert' } } });
const DISABLED = resolveConfig({ categories: { constraint: { enabled: false } } });

// --- 1 · the ladder ---------------------------------------------------------

test('the ladder is select()\'s own order, and `passed` holds no rung', () => {
  assert.deepEqual(GATE_LADDER, ['eligible', 'tier', 'focus', 'scope', 'seen', 'budget'],
    'the order IS the explanation — a rung only means something in the position it holds');
  assert.deepEqual(GATE_LADDER.map((code) => GATE_RUNG[code]), [1, 2, 3, 4, 5, 6],
    'rungs are 1-based and dense, because the chart numbers them');
  assert.equal(GATE_RUNG.passed, null,
    'an item that cleared the ladder failed nothing; 0 or 7 would be a position on it');

  // Closed: `GATE_RUNG` is `Record<GateCode, …>`, so a seventh gate added to
  // the union fails to COMPILE rather than answering `undefined` here. The
  // runtime half of that is the key set — the ladder plus `passed` and nothing
  // else — together with `GATE_LADDER` being DERIVED from this table rather
  // than written out a second time beside it.
  assert.deepEqual(Object.keys(GATE_RUNG).sort(), [...GATE_LADDER, 'passed'].sort(),
    'the ladder is derived from GATE_RUNG; two spellings of one order is how an order drifts');
  assert.equal(new Set(GATE_LADDER.map((code) => GATE_RUNG[code])).size, GATE_LADDER.length,
    'two gates sharing a rung would draw one over the other');
});

// --- 2 · one branch, both halves --------------------------------------------

/**
 * Every branch of `injection()`, with the sentence it has always written and
 * the code it now writes beside it.
 *
 * The phrases are LITERALS rather than the constants the function composes
 * them from (`RATIONALE_NOT_INJECTED`, `emptyScopeInjection`). Asserting a
 * constant against itself would pass however the wording moved, and half of
 * what this file is for is that adding the code did not disturb the sentence
 * the CLI prints.
 */
const CASES: { name: string; item: Item; config: Config; phrase: string; gate: GateCode }[] = [
  {
    name: 'a draft — rung 1, about the item\'s status',
    item: item({ status: 'draft' }), config: BASE,
    phrase: 'not injected (status "draft")', gate: 'eligible',
  },
  {
    name: 'a superseded item — the same rung, a different sentence',
    item: item({ status: 'superseded' }), config: BASE,
    phrase: 'not injected (status "superseded")', gate: 'eligible',
  },
  {
    name: 'a disabled category — still rung 1, and about the config',
    item: item(), config: DISABLED,
    phrase: 'not injected (category "constraint" is disabled in this project)', gate: 'eligible',
  },
  {
    name: 'a category this project has never heard of — rung 1',
    item: item({ id: 'X-a', type: 'nonesuch' }), config: BASE,
    phrase: 'not injected (category "nonesuch" is not in this project\'s config)',
    gate: 'eligible',
  },
  {
    name: 'a rationale-tier item — rung 2, and no budget change will move it',
    item: item({ id: 'DEC-a', type: 'decision' }), config: BASE,
    phrase: 'rationale tier — searchable, and counted in the session index, but never injected in full',
    gate: 'tier',
  },
  {
    name: 'an unscoped item under scopePolicy inert — rung 4, matched by no path',
    item: item(), config: INERT,
    phrase: 'no scope — this category\'s scopePolicy is "inert", so an item without one is ' +
      'never injected on a file; it appears in the session index only',
    gate: 'scope',
  },
  {
    name: 'a pinned item — every gate cleared',
    item: item({ always: true }), config: BASE,
    phrase: 'PINNED — injected in full at every session start, regardless of scope',
    gate: 'passed',
  },
  {
    name: 'a scoped item — every gate this function can ask, cleared',
    item: item({ scope: ['src/**'] }), config: BASE,
    phrase: 'injected when work touches src/**', gate: 'passed',
  },
  {
    name: 'an unscoped item under global — unrestricted, so it clears too',
    item: item(), config: BASE,
    phrase: 'no scope — unrestricted, so nothing narrows it and it is injected on the first ' +
      'file touched in a session',
    gate: 'passed',
  },
];

test('injection() writes the gate and the sentence from ONE branch', () => {
  for (const c of CASES) {
    const verdict = injection(c.item, c.config);
    assert.equal(verdict.phrase, c.phrase, `${c.name}: the sentence is unchanged`);
    assert.equal(verdict.gate, c.gate, `${c.name}: and the code says the same thing`);
    assert.equal(verdict.injected, c.gate === 'passed',
      `${c.name}: injected === (gate === 'passed'), always`);
  }

  // Non-vacuity, in both directions. FOUR distinct codes come out of this
  // function and no more: it is asked about an item and a config, so it can
  // answer the gates that are properties of the item — rungs 1, 2 and 4 — and
  // `passed`. Rungs 3, 5 and 6 (focus, seen, budget) are facts about a
  // SELECTION and are already machine-readable where they are decided
  // (`Selection.focus.hidden`, the caller's own `seen`, `Selection.spilled`).
  assert.deepEqual([...new Set(CASES.map((c) => c.gate))].sort(),
    ['eligible', 'passed', 'scope', 'tier'],
    'every code this function can produce is produced by a case above');
  // And rung 1 is ONE gate reached by four sentences, not four gates.
  assert.equal(CASES.filter((c) => c.gate === 'eligible').length, 4);
  assert.equal(new Set(CASES.filter((c) => c.gate === 'eligible').map((c) => c.phrase)).size, 4,
    'four sentences, one rung — exactly what a screen could not tell apart before');
});

test('the code and the sentence cannot disagree, over every item × config here', () => {
  const items = [
    item(), item({ always: true }), item({ scope: ['src/**'] }), item({ status: 'draft' }),
    item({ status: 'deprecated' }), item({ id: 'DEC-a', type: 'decision' }),
    item({ id: 'DEC-b', type: 'decision', always: true, continuity: false, scope: ['src/**'] }),
    item({ id: 'X-a', type: 'nonesuch' }),
  ];
  const configs: [string, Config][] = [['global', BASE], ['inert', INERT], ['disabled', DISABLED]];
  let refusals = 0;
  for (const [label, config] of configs) {
    for (const i of items) {
      const v = injection(i, config);
      const where = `${i.id} (${i.type}, ${i.status}) under ${label}`;
      assert.equal(v.injected, v.gate === 'passed', `${where}: the two halves disagree`);
      assert.notEqual(GATE_RUNG[v.gate], undefined, `${where}: ${v.gate} is not on the ladder`);
      if (v.gate === 'passed') continue;
      refusals++;
      // Only the three item-level rungs can ever bind here — see the case
      // table above. A refusal landing on focus, seen or budget would mean
      // this function had started answering a question it is not asked.
      assert.ok([1, 2, 4].includes(GATE_RUNG[v.gate]!),
        `${where}: rung ${GATE_RUNG[v.gate]} needs an event, and there is none in hand`);
      assert.ok(v.phrase.length > 0, `${where}: a code with no sentence is half an answer`);
    }
  }
  assert.ok(refusals >= 10, 'non-vacuity: the sweep must actually reach refusals');
});

// --- 3 · the vocabulary the chart draws -------------------------------------

/**
 * The codes against the ladder the design of record draws, rung for rung.
 *
 * The mockup names rung 2 *"normative tier"* where the code is `tier`, so this
 * is containment at the same INDEX rather than equality: what has to hold is
 * that there are six rungs, in one order, and that each code names the gate
 * drawn in its position. The alternative — this file's own list of six names —
 * is the second spelling that lets a screen and a read model drift apart,
 * which is the defect the whole feature is written against.
 *
 * When this fails, the mockup and the codes have diverged. The fix is to bring
 * them into line, in that direction: the mockup is the specification.
 */
test('the six codes are the six rungs the mockup draws, in the mockup\'s order', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const table = /const GATES=\[([\s\S]*?)\n\];/.exec(html);
  assert.ok(table, 'the mockup must still declare a GATES table for this to check against');
  const drawn = [...table[1]!.matchAll(/\n\s*\['([^']+)'/g)].map((m) => m[1]!);
  assert.equal(drawn.length, GATE_LADDER.length,
    `the mockup draws ${drawn.length} rungs and the ladder has ${GATE_LADDER.length}`);
  for (let i = 0; i < GATE_LADDER.length; i++) {
    assert.ok(drawn[i]!.includes(GATE_LADDER[i]!),
      `rung ${i + 1}: the mockup draws "${drawn[i]}" where the code is "${GATE_LADDER[i]}"`);
  }
});
