// @basis TASK-the-store-is-delivered-at-every-door-an-agent-starts-through, STD-the-precedence-order-when-four-sources-of-truth-disagree
/**
 * **A product constant wins, AND the conflict is reported.**
 *
 * D41 spec §9, `plan:store seq:2` Task 8. Both halves, and the second is the
 * one the section spends its argument on:
 *
 * > *A product fact is not negotiable — "a body stops at the first `##`" is
 * > true whatever a user believes. But **losing silently teaches a user their
 * > rule is being obeyed when it is not**, so the disagreement is surfaced.*
 *
 * So a test that only asserted the win would pass against precisely the
 * failure §9 exists to prevent. Every case below asserts the report as well,
 * and one asserts that the losing item is still THERE — the corpus item is not
 * deleted, hidden or rewritten, because
 * `STD-the-precedence-order-when-four-sources-of-truth-disagree` is explicit
 * that *"the superseded statement is how anybody later understands why the
 * winner reads the way it does."*
 *
 * ── THE CONFLICT IS DETECTED THROUGH THE REAL DOOR ─────────────────────────
 *
 * `findConflicts` is unit-tested in `deliver.test.ts`. What is tested here is
 * the wiring: that the ids the corpus block actually delivered reach the
 * store's check. That edge runs from `core/inject.ts` · `deliveredIds: string[];`
 * through `hooks/session-start.ts` · `storeAppendix`, and it exists in that
 * shape because `test/rules/isolation.test.ts` forbids `core/inject.ts` from
 * reaching `src/rules/` at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { buildSessionStartResult, storeAppendix } from '../../src/hooks/session-start.ts';
import { DELIVERED_DIR, DELIVERED_FILE, type DeliveryRecord } from '../../src/rules/delivered.ts';
import { removeTree } from '../helpers/tmp.ts';

const ENTRY_ID = 'a-body-stops-at-the-first-heading';
const ITEM_TITLE = 'a body stops at the first heading';
const ITEM_ID = `RULE-${ENTRY_ID}`;

/** What the corpus item claims, and it is the OPPOSITE of the constant. */
const ITEM_BODY =
  'A body is stored whole. Everything written into it is kept, headings included, so a long ' +
  'body may be structured freely.';

const CONSTANT = [
  '---',
  `id: ${ENTRY_ID}`,
  'kind: fact',
  'tier: product',
  'title: an item body stops at the first ## heading',
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool, whatever a corpus records about it.',
  '',
].join('\n');

function storeFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-prec-store-'));
  writeFileSync(path.join(dir, 'fact.md'), CONSTANT, 'utf8');
  return dir;
}

/** A workspace whose corpus holds the item that disagrees with the constant. */
function workspace(withItem: boolean): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-prec-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the sandbox workspace did not initialize');
  if (withItem) {
    assert.equal(
      runCli([
        'add', 'rule', ITEM_TITLE, '--body', ITEM_BODY,
        '--summary', 'What happens to the rest of a body after a heading, as this project records it.',
        '--yes',
      ], cwd, () => {}),
      0,
      'the conflicting corpus item was not created',
    );
  }
  return cwd;
}

function rows(cwd: string): DeliveryRecord[] {
  try {
    return readFileSync(path.join(cwd, '.my_context', DELIVERED_DIR, DELIVERED_FILE), 'utf8')
      .split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as DeliveryRecord);
  } catch { return []; }
}

/** The door, exactly as `hooks/session-start.ts`'s binary composes it. */
function door(cwd: string, storeDir: string): { corpus: string; store: string } {
  const injection = buildSessionStartResult(cwd, { sessionId: 'sp', source: 'startup' });
  return {
    corpus: injection.text,
    store: storeAppendix(cwd, { sessionId: 'sp', source: 'startup', storeDir }, injection.deliveredIds),
  };
}

/* ══ 1. THE WIN, AND THE REPORT ═══════════════════════════════════════════ */

test('a product constant wins over a conflicting corpus item, and the conflict is REPORTED', () => {
  const cwd = workspace(true);
  const store = storeFixture();
  try {
    const { corpus, store: block } = door(cwd, store);

    // Anti-vacuity first: the corpus item has to have been delivered, or the
    // conflict below is between a constant and nothing.
    assert.ok(
      corpus.includes(ITEM_ID),
      'the corpus block never delivered the item, so there was no disagreement to detect',
    );

    assert.ok(block.includes(ENTRY_ID), 'the block does not name the constant that won');
    assert.ok(
      block.includes(ITEM_ID),
      'THE CONFLICT WAS SILENT. Spec §9: losing silently teaches a user their rule is being ' +
      'obeyed when it is not — the disagreement has to be surfaced, by name, in the block the ' +
      'reader is holding both halves of.',
    );
    assert.match(
      block, /GOVERNS/,
      'the report names both ids and does not say which of them wins, which leaves the reader ' +
      'to guess exactly the thing §9 exists to settle',
    );
    assert.match(
      block, /disagreement\(s\) between a product constant/,
      'the report does not say that this IS a disagreement between the two, which is the whole ' +
      'of what §9 asks to be surfaced',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('the losing corpus item is not deleted, hidden or rewritten', () => {
  const cwd = workspace(true);
  const store = storeFixture();
  try {
    const { corpus, store: block } = door(cwd, store);
    assert.ok(
      corpus.includes(ITEM_ID),
      'the corpus item vanished from the injection once a constant disagreed with it. ' +
      '`STD-the-precedence-order-when-four-sources-of-truth-disagree`: never resolve a conflict ' +
      'by deleting the loser — the superseded statement is how anybody later understands why ' +
      'the winner reads the way it does.',
    );
    const file = path.join(cwd, '.my_context', 'items', 'rule', `${ITEM_ID}.md`);
    assert.ok(readFileSync(file, 'utf8').includes('stored whole'), 'the item file itself was edited');
    assert.match(block, /untouched/, 'the block does not say the item is left alone');
  } finally { removeTree(cwd); removeTree(store); }
});

test('the delivery record counts the conflict, so a silent win would still be countable', () => {
  const cwd = workspace(true);
  const store = storeFixture();
  try {
    door(cwd, store);
    const delivered = rows(cwd).filter((r) => r.kind === 'delivered');
    assert.equal(delivered.length, 1);
    assert.equal(
      delivered[0].conflicts, 1,
      'the record does not carry the conflict count. Spec §8.2 asks for a COUNT rather than a ' +
      'promise, and "how often does a shipped constant contradict a real corpus" is the number ' +
      'that decides whether a migration candidate is safe to move.',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

/* ══ 2. AND IT DOES NOT CRY WOLF ══════════════════════════════════════════ */

test('a corpus with no conflicting item produces no conflict report', () => {
  const cwd = workspace(false);
  const store = storeFixture();
  try {
    const { store: block } = door(cwd, store);
    assert.ok(
      block.includes(ENTRY_ID),
      'the constant was not delivered at all, so the silence below proves nothing',
    );
    assert.ok(
      !block.includes('GOVERNS'),
      'a conflict was reported against a corpus that holds no conflicting item. A check that ' +
      'cries wolf is a check people turn off, and this one has to be believed the day it fires.',
    );
    assert.ok(
      !block.includes('disagreement(s) between'),
      'the conflict SECTION was rendered with nothing in it — an empty finding reads as a ' +
      'finding',
    );
    const delivered = rows(cwd).filter((r) => r.kind === 'delivered');
    assert.equal(delivered[0].conflicts, undefined, 'a conflict was counted where there is none');
  } finally { removeTree(cwd); removeTree(store); }
});

/* ══ 3. THE PRECEDENCE SENTENCE TRAVELS WHETHER OR NOT ANYTHING CONFLICTS ══ */

/**
 * The standing sentence and the per-conflict report are two different things,
 * and the reason both exist is the reason `STD-the-precedence-order-…` exists
 * at all: the ORDER has to be knowable before a disagreement is found, or the
 * first person to meet one resolves it by guessing.
 */
test('the block states the precedence order even when nothing conflicts', () => {
  const cwd = workspace(false);
  const store = storeFixture();
  try {
    const { store: block } = door(cwd, store);
    assert.match(block, /Precedence/, 'the block never states which source outranks which');
    assert.match(
      block, /STD-the-precedence-order-when-four-sources-of-truth-disagree/,
      'the block does not cite the item that carries the full order, so a reader who wants the ' +
      'rest of it has nowhere to go (RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number)',
    );
  } finally { removeTree(cwd); removeTree(store); }
});
