// @basis TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAudit } from '../../src/core/audit.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * **The OTHER way to retire an item, which `supersedeItem` is not.**
 *
 * `test/core/supersede-stands-down.test.ts` covers the retirement that names a
 * replacement. This file covers the one that does not: a status write into
 * `STOOD_DOWN_STATUSES` through `updateItem`, which is how FOUR supported
 * commands retire things — `mycontext edit <id> --status deprecated`,
 * `mycontext review discard`, `mycontext procedure done` and `mycontext inbox
 * promote` (the origin half). None of them goes near `supersedeItem`.
 *
 * Measured on a sandbox, 2026-09-10, before the fix: a pinned rule with
 * `severity: hard` deprecated through `updateItem` came back `deprecated`,
 * `always: true`, `severity: "hard"` — which is exactly the state `doctor`'s
 * `retired_still_binding` reports. The seven items his ruling cleared on
 * 2026-09-08 could therefore re-form through any of those four commands, and
 * the product would have been manufacturing its own findings.
 *
 * **Not a delivery test.** `isEligible` (select.ts) filters retired statuses
 * out of injection before a pin can matter, so nothing here is about what
 * reaches a session. It is about the fields SURVIVING AS DATA on the item,
 * read by counts, reports and the pinned-set review.
 *
 * `updateItem` rather than `runCli`: it is the single write every one of those
 * four commands routes through, so the semantics belong here and the surface
 * belongs in `test/cli/deprecate-stands-down.test.ts`.
 */

test('deprecating a pinned, hard item stands it down in the same act', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });

  const retired = s.ctx.store.get(made.id)!;
  assert.equal(retired.status, 'deprecated');
  assert.equal(retired.always, false, 'a retired item that still asks to be pinned still claims to govern');
  assert.equal(retired.severity, 'soft');
  s.dispose();
});

test('a retirement that finds nothing to stand down leaves no trace of one', () => {
  const s = sandbox();
  const made = createItem(s.ctx, { type: 'rule', title: 'Log every refusal' });
  const result = updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });

  const retired = s.ctx.store.get(made.id)!;
  assert.equal(retired.observations.length, 0, 'a note about nothing is noise on the item');
  assert.doesNotMatch(result.message, /stood down/);
  s.dispose();
});

/**
 * `INV-nothing-is-dropped-silently` in its standing form: an item somebody
 * pinned mattered enough to pin, so a reader who later asks why it is quiet
 * gets an answer on the item itself.
 */
test('what was cleared is recorded on the item, as a retirement and not a supersession', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });

  const retired = s.ctx.store.get(made.id)!;
  assert.equal(retired.observations.length, 1);
  const note = retired.observations[0];
  // NOT `supersession`: nothing replaced this item, and a supersession
  // category would assert a successor that does not exist on the one file a
  // reader asking "what happened to this?" has open.
  assert.equal(note.category, 'retirement');
  assert.match(note.text, /Stood down on \d{4}-\d{2}-\d{2}/);
  assert.match(note.text, /its status was set to "deprecated"/);
  assert.match(note.text, /"always" is now false/);
  assert.match(note.text, /"severity" is now "soft"/);
  // One act, one date — the same stamp `validUntil` took in the same write.
  assert.match(note.text, new RegExp(retired.validUntil!));
  s.dispose();
});

test('the note names only the field that actually moved', () => {
  const s = sandbox();
  const made = createItem(s.ctx, { type: 'requirement', title: 'Items carry a domain', severity: 'hard' });
  updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });

  const note = s.ctx.store.get(made.id)!.observations[0];
  assert.match(note.text, /"severity" is now "soft"/);
  assert.doesNotMatch(note.text, /always/);
  s.dispose();
});

test('the audit row names the fields the retirement moved', () => {
  const s = sandbox();
  const pinned = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const plain = createItem(s.ctx, { type: 'rule', title: 'Log every refusal' });
  updateItem(s.ctx, { id: pinned.id, status: 'deprecated', origin: 'human' });
  updateItem(s.ctx, { id: plain.id, status: 'deprecated', origin: 'human' });

  const rows = readAudit(s.root).filter((r) => r.op === 'update');
  const forPinned = rows.find((r) => r.itemId === pinned.id)!;
  const forPlain = rows.find((r) => r.itemId === plain.id)!;
  assert.ok(forPinned.fields!.includes('always'), `expected "always" in ${forPinned.fields}`);
  assert.ok(forPinned.fields!.includes('severity'), `expected "severity" in ${forPinned.fields}`);
  // An echo is not a change: a retirement that found the fields already down
  // must not name them in the log.
  assert.ok(!forPlain.fields!.includes('always'));
  assert.ok(!forPlain.fields!.includes('severity'));
  s.dispose();
});

test('the result message says the item was stood down, not only that it was updated', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const result = updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });
  assert.match(result.message, /stood down/);
  assert.match(result.message, /"always" is now false and "severity" is now "soft"/);
  s.dispose();
});

/**
 * A call asking to retire an item AND to keep it binding is asking for two
 * things that cannot both be true. The stand-down is the half that wins, and
 * it is not the silent half: the message says so and the item records it.
 */
test('a retirement that is asked for a hard severity in the same call still stands the item down', () => {
  const s = sandbox();
  const made = createItem(s.ctx, { type: 'rule', title: 'Log every refusal' });
  const result = updateItem(s.ctx, {
    id: made.id, status: 'deprecated', severity: 'hard', origin: 'human',
  });

  assert.equal(s.ctx.store.get(made.id)!.severity, 'soft');
  assert.match(result.message, /stood down/);
  s.dispose();
});

/**
 * The stand-down belongs to the ACT of retiring. `supersedeItem` rules the
 * same way at its idempotent early return, and for the same reason: a later
 * write to a long-retired item performs no retirement, and repairing a field
 * there would be a corpus edit nobody asked for hidden inside an unrelated
 * write. `doctor`'s `retired_still_binding` is where those surface, for a
 * person to rule on one at a time.
 */
test('a later write to an already-retired item stands nothing down', () => {
  const s = sandbox();
  const made = createItem(s.ctx, { type: 'rule', title: 'Pin the budget, not the item' });
  updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });
  // Put a pin on the retired item the way a person or an older write could
  // have, then make an ordinary edit that is not a retirement.
  updateItem(s.ctx, { id: made.id, always: true, origin: 'human' });
  updateItem(s.ctx, { id: made.id, title: 'Pin the budget', origin: 'human' });

  assert.equal(s.ctx.store.get(made.id)!.always, true);
  s.dispose();
});

/**
 * `validated` sits in `RETIRED_STATUSES` and deliberately NOT in
 * `STOOD_DOWN_STATUSES` — it means a human AFFIRMED the item, and on an
 * affirmed item `hard` and a pin are a claim a person made rather than
 * bookkeeping debt. The constant carries the measurement; this pins the
 * behaviour on the `updateItem` path so widening the set stays deliberate.
 */
test('moving an item to validated is not a retirement and stands nothing down', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  updateItem(s.ctx, { id: made.id, status: 'validated', origin: 'human' });

  const item = s.ctx.store.get(made.id)!;
  assert.equal(item.always, true);
  assert.equal(item.severity, 'hard');
  assert.equal(item.observations.length, 0);
  s.dispose();
});

test('nothing else about the retired item is touched', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', body: 'The reason.',
    always: true, severity: 'hard', scope: ['src/**'], tags: ['governance'],
  });
  updateItem(s.ctx, { id: made.id, status: 'deprecated', origin: 'human' });

  const retired = s.ctx.store.get(made.id)!;
  assert.equal(retired.body, 'The reason.');
  assert.deepEqual(retired.scope, ['src/**']);
  assert.deepEqual(retired.tags, ['governance']);
  assert.equal(retired.continuity, false);
  s.dispose();
});
