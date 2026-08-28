/**
 * **What an injected item's block says about its steps, and what that costs.**
 *
 * `renderItemBlock` is the injection path: the string it returns is the string
 * that enters a model's context window, and `select.ts` ·
 * `export function itemCost(item: Item): number {` derives the budget from
 * that same string. The two facts are one fact, which is why this file asserts
 * them together — a block that omits steps ships an `active` procedure without
 * the content it exists to deliver AND under-counts it, so it is admitted to a
 * tier it does not fit. Silent in both directions at once.
 *
 * Three things are pinned here, and the order of importance is the order of
 * the file:
 *
 *  1. **A stepless item is byte-identical to what it rendered before steps
 *     existed.** Every item in every corpus that exists today is stepless, so
 *     this is the assertion that says the change costs nothing it should not.
 *     The golden below is `master`'s output, verbatim, not this branch's — it
 *     was taken by running `git show master:src/core/render-item.ts` over the
 *     same item. Byte-identical rendering is byte-identical cost, so the two
 *     assertions are one measurement made twice.
 *  2. **A stepped item carries every step, in file order, before its
 *     observations** — the order `renderItem` writes them in, so a reader who
 *     has seen the file sees the same sequence.
 *  3. **The block never carries progress** (spec §6m, Design decision 15).
 *     Progress lives in the audit log and is a display concern of
 *     `mycontext procedure show`. If it leaked in here, two sessions would
 *     receive different text for one item and no budget and no ledger could
 *     then describe what a session was given.
 *
 * The item under test is parsed from `test/fixtures/procedure-with-steps.md`
 * rather than written as a literal, deliberately. That fixture carries a
 * checkbox-shaped line inside a fenced block in its BODY — `- [ ] deploy
 * (printed by the script, not a step of this procedure)` — so a test that
 * greps for `- [ ]` and calls it a step passes for the wrong reason. Every
 * assertion here names the step's own text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseItem, renderItem } from '../../src/core/item.ts';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { estimateTokens, itemCost, select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'procedure-with-steps.md');
const REL = 'items/procedure/PROC-rotate-the-stripe-webhook-secret.md';

/** The fixture, through the real parser — an item that came off disk, not one
 *  written to match the renderer. */
function procedure(over: Partial<Item> = {}): Item {
  return { ...parseItem(readFileSync(FIXTURE, 'utf8'), REL, 'project'), ...over };
}

/** A minimal, ordinary, STEPLESS item: a body, one observation carrying a tag
 *  and a context, one scope glob. Every field the block renders is present, so
 *  `STEPLESS_BLOCK` below exercises all of them at once. */
function stepless(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20', status: 'active',
    severity: 'hard', always: true, continuity: false, scope: ['src/db/**'], tags: ['db'], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'RDS permits 25.',
    steps: [],
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: 'staging' }],
    relations: [], layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

/**
 * `renderItemBlock(stepless())` as `master` renders it, before this task. It
 * is the pre-change module's output, not this branch's: a golden copied out of
 * the code it is meant to constrain would assert nothing.
 */
const STEPLESS_BLOCK = [
  '### CONST-a · constraint · Pool capped at 20',
  '',
  'RDS permits 25.',
  '',
  '- [limit] Never exceed 20 #db (staging)',
  '',
  '_scope: src/db/**_',
].join('\n');

const STEP_1 = '- [ ] Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.';
const STEP_2 = '- [ ] Roll the endpoint secret in Stripe.';
const STEP_3 = '- [ ] Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.';

// ---------------------------------------------------------------------------
// 1. The stepless item — which is every item in every corpus that exists.
// ---------------------------------------------------------------------------

test('a stepless item renders the exact bytes it rendered before steps existed', () => {
  assert.equal(renderItemBlock(stepless()), STEPLESS_BLOCK);
});

test('a stepless item costs exactly what it cost before — same bytes, same chars/4', () => {
  assert.equal(itemCost(stepless()), estimateTokens(STEPLESS_BLOCK) + estimateTokens('\n\n'));
});

test('an empty steps array adds no heading, no blank line, nothing', () => {
  const block = renderItemBlock(procedure({ steps: [] }));
  assert.doesNotMatch(block, /#### Steps/);
  assert.ok(!block.includes(STEP_1), 'a stepless copy of the fixture must carry no step lines');
});

// ---------------------------------------------------------------------------
// 2. The stepped item.
// ---------------------------------------------------------------------------

test('the injected block carries the steps, in order, as checkbox lines', () => {
  const text = renderItemBlock(procedure());
  assert.match(text, /- \[ \] Deploy STRIPE_WEBHOOK_SECRET_NEXT/);
  assert.ok(text.includes(`${STEP_1}\n${STEP_2}\n${STEP_3}`),
    'the three steps must be one unbroken list, in file order');
});

test('the steps are labelled, so they are not read as three more observations', () => {
  const text = renderItemBlock(procedure());
  assert.ok(text.includes(`#### Steps\n${STEP_1}`),
    'the heading sits one level under the item’s ### so it can be mistaken neither for a ' +
    'new item block nor for one of renderSelection’s own ## sections');
});

test('steps come before observations in the block, as they do in the file', () => {
  const text = renderItemBlock(procedure());
  // Both halves are asserted present first, and that is not ceremony: with a
  // block that emits no steps at all, `indexOf(STEP_1)` is -1 and the ordering
  // comparison below passes for the one reason this file exists to catch.
  assert.ok(text.includes(STEP_1), 'the step must be in the block at all');
  assert.ok(text.includes('- [risk]'), 'the observation must be in the block at all');
  assert.ok(text.indexOf(STEP_1) < text.indexOf('- [risk]'));
});

test('steps come after the body, as they do in the file', () => {
  const text = renderItemBlock(procedure());
  // Anchored on the step itself rather than on the heading, so this test says
  // one thing: where the steps sit. The heading is a separate claim with its
  // own test, and an ordering assertion that also fails when the label moves
  // reports the wrong defect.
  assert.ok(text.includes(STEP_1), 'the step must be in the block at all');
  assert.ok(text.indexOf('The signing secret reached a build log') < text.indexOf(STEP_1));
});

test('the scope line stays last, after the steps and the observations', () => {
  const text = renderItemBlock(procedure());
  assert.ok(text.indexOf('- [rollback]') < text.indexOf('_scope: src/billing/**_'));
  assert.ok(text.endsWith('_scope: src/billing/**_'));
});

test('a hand-ticked box injects as [x] — the file is the source of truth about progress too', () => {
  // Nothing in this product writes `checked: true`; a human ticking a box in
  // the Markdown is how it happens, and the injected text must say what the
  // file says.
  const text = renderItemBlock(procedure({
    steps: [{ text: 'Roll the endpoint secret in Stripe.', checked: true }],
  }));
  assert.ok(text.includes('- [x] Roll the endpoint secret in Stripe.'));
});

test('the block never shows progress — an injected procedure is the same text in every session', () => {
  const ticked = procedure({
    steps: [
      { text: 'Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.', checked: true },
      { text: 'Roll the endpoint secret in Stripe.', checked: false },
    ],
  });
  assert.doesNotMatch(renderItemBlock(procedure()), /\d+ of \d+/);
  assert.doesNotMatch(renderItemBlock(ticked), /\d+ of \d+/);
  assert.doesNotMatch(renderItemBlock(ticked), /\d+ remaining|\d+ done|% complete/i);
});

/** The `## Steps` section of an item's FILE form, as one string — the lines
 *  `renderItem` wrote between the heading and the blank line that ends it. */
function stepsSectionOfFile(item: Item): string {
  const lines = renderItem(item).split('\n');
  const start = lines.indexOf('## Steps');
  assert.notEqual(start, -1, 'the file form must have a ## Steps section to compare against');
  const end = lines.indexOf('', start);
  return lines.slice(start + 1, end).join('\n');
}

test('the injected step lines are byte-identical to the step lines in the file', () => {
  // `renderItem` (item.ts) and `renderItemBlock` (render-item.ts) each spell
  // the checkbox line themselves, exactly as they each already spell the
  // observation line themselves. This is the assertion that catches the day
  // one of them drifts: `parseSteps` refuses any step that would not
  // re-render byte for byte, so the file's spelling IS the invariant, and the
  // injected block has no licence to use a second one.
  //
  // Both markers are compared, because they are two different characters and
  // only one of them is in the fixture: a renderer that wrote `[X]` for a
  // ticked box would round-trip nowhere, and `parseSteps` says so in as many
  // words on the file side.
  const ticked = procedure({
    steps: procedure().steps.map((s, n) => ({ ...s, checked: n === 1 })),
  });
  for (const item of [procedure(), ticked]) {
    const section = stepsSectionOfFile(item);
    assert.equal(section.split('\n').length, 3, 'all three steps, or this compares less than it says');
    assert.ok(renderItemBlock(item).includes(`\n${section}\n`),
      `the injected block must carry the file's own step lines verbatim:\n${section}`);
  }
});

// ---------------------------------------------------------------------------
// 3. The budget, which follows the render and is never told about it.
// ---------------------------------------------------------------------------

test('the budget charges for the steps, because cost is derived from this exact text', () => {
  const withSteps = estimateTokens(renderItemBlock(procedure()));
  const without = estimateTokens(renderItemBlock(procedure({ steps: [] })));
  assert.ok(withSteps > without,
    'itemCost reads renderItemBlock; if the block omits steps the selector under-counts a ' +
    'procedure and admits it to a tier it does not fit');
});

test('itemCost is still the rendered block plus one separator — for a stepped item too', () => {
  const item = procedure();
  assert.equal(itemCost(item), estimateTokens(renderItemBlock(item)) + estimateTokens('\n\n'));
});

test('the steps move the budget boundary: a procedure that fitted without them spills with them', () => {
  const item = procedure();
  const budget = itemCost(procedure({ steps: [] }));

  const tight = resolveConfig({ budgets: { pinned: budget } });
  const sel = select([item], { event: 'session-start' }, tight);
  assert.equal(sel.full.length, 0, 'the steps are charged for, so the item no longer fits');
  assert.equal(sel.spilled.some((s) => s.id === item.id), true);

  const roomy = resolveConfig({ budgets: { pinned: itemCost(item) } });
  assert.equal(select([item], { event: 'session-start' }, roomy).full.length, 1);
});

test('a stepless item spills at exactly the boundary it always spilled at', () => {
  const item = stepless();
  const cost = estimateTokens(STEPLESS_BLOCK) + estimateTokens('\n\n');

  const tight = resolveConfig({ budgets: { pinned: cost - 1 } });
  assert.equal(select([item], { event: 'session-start' }, tight).full.length, 0);

  const exact = resolveConfig({ budgets: { pinned: cost } });
  assert.equal(select([item], { event: 'session-start' }, exact).full.length, 1);
});
