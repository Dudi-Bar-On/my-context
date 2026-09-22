// @basis TASK-release-phase-3-the-defects, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **Defect 4 of task 3.11: `promoteRevision` landed a revision with no
 * summary and no recorded omission.**
 *
 * `createItem` (`--summary-omitted`) and `updateItem` (`--summary-unchanged`
 * on an item that already carries no summary) both record `SUMMARY_OMITTED_NOTE`
 * in the audit row when the item they touch ends up with no summary and
 * nobody said so was deliberate. `promoteRevision` reaches `updateItem` too —
 * `origin: 'human'`, `auditOp: 'promote'` — but it passed neither flag, so a
 * promoted revision that left an item's summary null recorded no note at
 * all: `summary_absent` could report the item, but the audit log carried no
 * evidence that its own write was the one that left it that way.
 *
 * Fixed by passing `summaryUnchanged: true` into the `updateItem` call
 * exactly when the item's summary is ALREADY null before this write AND the
 * revision does not carry a new one — the same two-part condition
 * `updateItem`'s own note logic already branches on (mutate.ts, the block
 * right after `reviseSummary`). `item.summary !== null` guards
 * `reaffirmSummary`, so nothing is falsely re-stamped as re-affirmed; a
 * revision that DOES carry a summary lands it as ordinary content instead.
 *
 * **Throwaway workspaces** — `sandbox()` (`test/helpers/workspace.ts`), the
 * in-memory-index pattern `test/core/revision.test.ts` beside this file
 * already uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { promoteRevision, stageRevision } from '../../src/core/revision.ts';
import { readAudit } from '../../src/core/audit.ts';
import { sandbox } from '../helpers/workspace.ts';

const ORIGINAL_BODY = 'Never log a customer email address, anywhere, at any level.';
const PROPOSED_BODY = 'Avoid logging customer email addresses unless it is necessary.';
const SUMMARY = 'A standing rule that customer email addresses are never logged.';

test('promoteRevision on a summary-less item records SUMMARY_OMITTED_NOTE on the promote row', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL_BODY,
      status: 'active', origin: 'human', severity: 'hard',
      // No summary and no `summaryOmitted` — `createItem` is a shared road
      // and is not gated (see `core/summary-gate.ts`'s own header), so this
      // is a legal, if summary-less, item to seed the test with.
    });
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    promoteRevision(box.ctx, id);

    const rows = readAudit(box.root).filter((r) => r.kind === 'mutation' && r.itemId === id);
    const promoted = rows.filter((r) => r.op === 'promote');
    // Still exactly ONE record for the act — the note is a field on the SAME
    // row, not a second row: `test/core/audit-coverage.test.ts` already pins
    // "promote records a promotion, not an indistinguishable update", and
    // this fix must not cost that guarantee.
    assert.equal(promoted.length, 1, `expected one 'promote' row, got:\n${JSON.stringify(rows)}`);
    assert.equal(promoted[0].note, 'summary-omitted', JSON.stringify(promoted[0]));
    // The content still moved and is still reported — the note is additive.
    assert.deepEqual(promoted[0].fields, ['body']);
  } finally {
    box.dispose();
  }
});

test('promoteRevision on an item WITH a summary records no summary-omitted note', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL_BODY, summary: SUMMARY,
      status: 'active', origin: 'human', severity: 'hard',
    });
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    promoteRevision(box.ctx, id);

    const promoted = readAudit(box.root)
      .filter((r) => r.kind === 'mutation' && r.itemId === id && r.op === 'promote');
    assert.equal(promoted.length, 1, JSON.stringify(promoted));
    assert.equal(promoted[0].note, undefined, JSON.stringify(promoted[0]));
  } finally {
    box.dispose();
  }
});

/**
 * A revision that carries a NEW summary must land it as ordinary content —
 * the note must not fire, because the item does not end up summary-less.
 */
test('promoteRevision that gives a summary-less item its summary records no omission note', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL_BODY,
      status: 'active', origin: 'human', severity: 'hard',
    });
    stageRevision(box.ctx, id, { body: PROPOSED_BODY, summary: SUMMARY }, 'agent');
    promoteRevision(box.ctx, id);

    const promoted = readAudit(box.root)
      .filter((r) => r.kind === 'mutation' && r.itemId === id && r.op === 'promote');
    assert.equal(promoted.length, 1, JSON.stringify(promoted));
    assert.equal(promoted[0].note, undefined, JSON.stringify(promoted[0]));
    assert.equal(box.ctx.store.get(id)?.summary, SUMMARY);
  } finally {
    box.dispose();
  }
});
