/**
 * **The admission order the owner ruled on 2026-09-04**
 * (`TASK-the-injection-budget-drops-governing-items-and-open-work`), measured
 * before this file existed: across the whole audit history, 12,034 of 46,316
 * selected items spilled, and the most-spilled were governing — a rule about
 * not accepting a test that passes in isolation spilled 278 times, a standard
 * about summaries 289 times, a requirement 263 times. Every one was
 * `severity: soft`, competing in the `jit` tier's budget on nothing more than
 * `byPriority`'s severity/layer/id tiebreak, which does not know a rule from a
 * runbook.
 *
 * His ruling: admit FIRST the items that GOVERN — rule, constraint, invariant,
 * instruction, requirement, standard — AND tasks/plans that are NOT DONE,
 * ahead of what merely records. `governs` (select.ts) is the predicate;
 * `byPriority` is where it is read. These tests exercise it directly, the way
 * `select-jit-bands.test.ts` exercises the band partition it composes with.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { governs, select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const body = (n: number) => 'x'.repeat(n);

test('governs is true for the six named categories and false for other normative categories', () => {
  for (const type of ['rule', 'constraint', 'invariant', 'instruction', 'requirement', 'standard']) {
    assert.equal(governs(item({ type })), true, type);
  }
  for (const type of ['pattern', 'glossary', 'runbook', 'procedure', 'environment',
    'known_issue', 'exception', 'contract', 'non_goal', 'open_question']) {
    assert.equal(governs(item({ type })), false, type);
  }
});

test('governs is true for an undone task or plan and false for a done one', () => {
  assert.equal(governs(item({ type: 'task', extra: { state: 'todo' } })), true);
  assert.equal(governs(item({ type: 'task', extra: { state: 'doing' } })), true);
  assert.equal(governs(item({ type: 'task', extra: {} })), true, 'no recorded state reads as open');
  assert.equal(governs(item({ type: 'task', extra: { state: 'done' } })), false);
  assert.equal(governs(item({ type: 'task', extra: { state: 'DONE' } })), false, 'case-insensitive');
  assert.equal(governs(item({ type: 'plan', extra: { state: 'done' } })), false);
  assert.equal(governs(item({ type: 'plan', extra: { state: 'active' } })), true);
});

test('governs is false for what merely records: notes, decisions, lessons', () => {
  for (const type of ['note', 'decision', 'lesson', 'adr', 'reference']) {
    assert.equal(governs(item({ type })), false, type);
  }
});

/**
 * The measured defect, reproduced as a fixture: a `known_issue` (normative,
 * but not one of the six governing categories) and a `rule` (governing), both
 * soft, both the same layer, and the rule's id sorts AFTER the known_issue's
 * ordinally — so the old severity/layer/id order picked the known_issue and
 * spilled the rule. The budget admits exactly one.
 */
test('a governing item is admitted ahead of a same-severity normative item that merely documents', () => {
  const config = resolveConfig({ budgets: { jit: 400 } });
  const items = [
    item({ id: 'KNOWN-alpha', type: 'known_issue', severity: 'soft', body: body(1000) }),
    item({ id: 'RULE-zulu', type: 'rule', severity: 'soft', body: body(1000) }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/x.ts' }, config);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-zulu'],
    'the rule governs and the known_issue does not, so the rule wins despite sorting later by id');
  assert.deepEqual(sel.spilled.map((s) => s.id), ['KNOWN-alpha']);
});

/**
 * Governance ranks ABOVE severity, deliberately — the measured spillers were
 * all `severity: soft`, so ranking below severity would have left them exactly
 * where they were: still losing to a `hard` non-governing item.
 */
test('governance outranks severity: a soft rule beats a hard known_issue', () => {
  const config = resolveConfig({ budgets: { jit: 400 } });
  const items = [
    item({ id: 'KNOWN-hard', type: 'known_issue', severity: 'hard', body: body(1000) }),
    item({ id: 'RULE-soft', type: 'rule', severity: 'soft', body: body(1000) }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/x.ts' }, config);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-soft']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['KNOWN-hard']);
});

/**
 * Within governance (both govern, or neither does), `byPriority`'s existing
 * three keys decide exactly as before — this change adds a rank in FRONT,
 * it does not touch what was already there.
 */
test('within the same governance rank, severity then layer then id still decide', () => {
  const config = resolveConfig({ budgets: { jit: 100_000 } });
  const items = [
    item({ id: 'RULE-zsoft', type: 'rule', severity: 'soft' }),
    item({ id: 'RULE-asoft', type: 'rule', severity: 'soft' }),
    item({ id: 'RULE-hard', type: 'rule', severity: 'hard' }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/x.ts' }, config);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-hard', 'RULE-asoft', 'RULE-zsoft']);
});

/**
 * The band partition (`DEC-the-jit-tier-offers-path-scoped-items-first-in-
 * two-bands`) is untouched: governance ranks WITHIN a band, not across bands.
 * A scoped known_issue still gets first refusal over an unscoped rule.
 */
test('governance ranks within a band; the scoped-first band order is unchanged', () => {
  const config = resolveConfig({ budgets: { jit: 400 } });
  const items = [
    item({ id: 'RULE-unscoped', type: 'rule', severity: 'soft', body: body(1000) }),
    item({
      id: 'KNOWN-scoped', type: 'known_issue', severity: 'soft', body: body(1000),
      scope: ['reports/**'],
    }),
  ];
  const sel = select(items, { event: 'tool', path: 'reports/x.md' }, config);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['KNOWN-scoped'],
    'band 1 (scoped) is offered before band 2 (unscoped), governance or not');
});

/**
 * A task/plan open-work item never actually reaches the jit/pinned/restored
 * candidate pool — those tiers are gated on `isNormative`, and `task`/`plan`
 * are rationale-tier by `categories.ts` design (deliberately: an open task
 * must never crowd the tier that is injected in full). `governs` still
 * answers true for one, for the one tier that is NOT gated on `isNormative` —
 * continuity, which draws from `eligible` — so the ranking is correct
 * wherever such an item COULD be a candidate, even though that is nowhere on
 * this repository's real corpus today.
 */
test('rationale categories including open task/plan work are still never injected in full', () => {
  const sel = select(
    [item({ id: 'TASK-open', type: 'task', always: true, extra: { state: 'todo' } })],
    { event: 'session-start' }, CONFIG,
  );
  assert.deepEqual(sel.full, []);
  assert.equal(sel.index.counts.task, 1);
});
