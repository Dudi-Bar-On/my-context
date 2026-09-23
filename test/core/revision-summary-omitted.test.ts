// @basis TASK-release-phase-3-the-defects, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none,
// TASK-promoterevision-reuses-the-summary-unchanged-switch-and
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
import { readVerdicts } from '../../src/core/verdict-store.ts';
import { runCli } from '../../src/cli/index.ts';
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

/**
 * **`TASK-promoterevision-reuses-the-summary-unchanged-switch-and` — the
 * second half of the borrow, and the half that was wrong.**
 *
 * `summaryUnchanged: true` carries TWO assertions, and `core/summary-gate.ts`
 * owns both: on an item that HAS a summary it says *the sentence still
 * stands*, and on an item that has none it says *this item is deliberately
 * left without one*. Only the first is a claim about MEANING. `updateItem`
 * knew that at three of its four sites — `reaffirmSummary`, the audit note
 * and `carryVerdicts` each carry the `item.summary !== null` guard — and not
 * at the fourth: `meaningHeld`, which decides whether the contradiction gate
 * measures this write against the basis the item HAD or the one it is getting.
 *
 * So `promoteRevision`, which passes the flag to obtain
 * `SUMMARY_OMITTED_NOTE`, was also telling the gate that a body rewrite it had
 * never read did not change what the item means — and a verdict about the OLD
 * sentence went on silencing a pair about the NEW one. §11's lapse test, run
 * against the one population it could never reach.
 *
 * Driven end to end because that is the only place the fact is visible: the
 * gate's answer IS the observable, and `meaningHeld` has no other effect.
 */
test('promoteRevision on a summary-less governing item does not tell the gate its meaning held', () => {
  const box = sandbox();
  try {
    // Two near-duplicate governing rules, NEITHER carrying a summary — the
    // population the guard on the sibling sites had always excluded and this
    // site had not.
    const first = createItem(box.ctx, {
      type: 'rule', title: 'Never log the customer email address',
      body: 'Redact the address before it reaches any log sink, in every service we run.',
      status: 'active', origin: 'human', severity: 'hard',
    });
    const second = createItem(box.ctx, {
      type: 'rule', title: 'Never log the customer email address anywhere',
      body: 'Redact the address before it reaches any log sink, in every service we run today.',
      status: 'active', origin: 'human', severity: 'hard', distinct: [first.id],
    });
    assert.equal(readVerdicts(box.root).length, 1, 'the pair is settled to begin with');

    // An agent proposes a body that changes what the first rule CLAIMS. A
    // person is about to approve the text; nobody has been asked whether the
    // ruling about the old text still holds.
    stageRevision(box.ctx, first.id, {
      body: 'Redact the address, and also the account number, before any log sink sees it.',
    }, 'agent');

    assert.throws(
      () => promoteRevision(box.ctx, first.id),
      (err: Error) => /may contradict/.test(err.message) && err.message.includes(second.id),
      'THE DEFECT: the promotion borrowed `summaryUnchanged` for its audit note and the gate '
      + 'read it as "the meaning did not move", so a verdict about the sentence this write '
      + 'replaced went on settling the pair',
    );

    // The refusal's promise holds — this is a gate, not a warning.
    assert.equal(
      box.ctx.store.get(first.id)!.body,
      'Redact the address before it reaches any log sink, in every service we run.',
      'nothing was written',
    );
    assert.equal(readVerdicts(box.root).length, 1,
      'and no verdict was carried: a re-stamp on a meaning that moved is the same lie one layer down');
    assert.equal(
      readAudit(box.root).filter((r) => r.itemId === first.id && r.op === 'promote').length, 0,
      'and no promote row — a refused write records nothing',
    );
  } finally {
    box.dispose();
  }
});

/**
 * **The other side of the same guard: the note survives it.**
 *
 * The fix narrows what `summaryUnchanged` claims on a summary-less item; it
 * must not narrow what it RECORDS. A promotion with no pair to raise still
 * lands, and still says in the audit log that this item was left without a
 * summary on purpose — which is the whole of what task 3.11 put the flag here
 * for.
 */
test('the narrowed claim costs nothing: the promotion still lands and still records the omission', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL_BODY,
      status: 'active', origin: 'human', severity: 'hard',
    });
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    promoteRevision(box.ctx, id);

    const promoted = readAudit(box.root)
      .filter((r) => r.kind === 'mutation' && r.itemId === id && r.op === 'promote');
    assert.equal(promoted.length, 1, JSON.stringify(promoted));
    assert.equal(promoted[0].note, 'summary-omitted', JSON.stringify(promoted[0]));
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED_BODY, 'and the revision landed');
    assert.equal(box.ctx.store.get(id)!.summaryOf, null,
      'nothing was re-stamped as re-affirmed — there is no sentence to re-affirm');
  } finally {
    box.dispose();
  }
});

/**
 * **Through the surface its reader is on.**
 *
 * The person who meets this is at `mycontext review promote-revision`, about
 * to approve an agent's text. The refusal has to reach THEM — a gate that only
 * fires inside `updateItem` and is swallowed on the way out would be the
 * silent failure this phase is named for, wearing the fix as a disguise.
 */
test('mycontext review promote-revision refuses at the terminal, naming the item it may contradict', () => {
  const box = sandbox();
  try {
    const first = createItem(box.ctx, {
      type: 'rule', title: 'Never log the customer email address',
      body: 'Redact the address before it reaches any log sink, in every service we run.',
      status: 'active', origin: 'human', severity: 'hard',
    });
    const second = createItem(box.ctx, {
      type: 'rule', title: 'Never log the customer email address anywhere',
      body: 'Redact the address before it reaches any log sink, in every service we run today.',
      status: 'active', origin: 'human', severity: 'hard', distinct: [first.id],
    });
    stageRevision(box.ctx, first.id, {
      body: 'Redact the address, and also the account number, before any log sink sees it.',
    }, 'agent');

    let out = '';
    const code = runCli(
      ['review', 'promote-revision', first.id, '--yes'], box.cwd, (line) => { out += `${line}\n`; },
    );
    assert.equal(code, 1, `the promotion must be refused at the terminal:\n${out}`);
    assert.match(out, /may contradict/, out);
    assert.ok(out.includes(second.id), `and the other item is named:\n${out}`);
  } finally {
    box.dispose();
  }
});
