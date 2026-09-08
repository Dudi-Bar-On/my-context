// @basis TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned. Measured
 * over this repository's own corpus: 1,021 items, 60 retired, and `always:
 * true`/`severity: hard` survived every one of those retirements because
 * `supersedeItem` wrote `status`, `relations` and `validUntil` and nothing
 * else.
 *
 * **Not a delivery test, and it must not be read as one.** `isEligible`
 * (select.ts) filters `RETIRED_STATUSES` out before a pin can matter, so the
 * first tier held throughout. What these assert is that the FIELDS do not
 * survive as data on the item — which is what counts, reports and the
 * pinned-set review read.
 *
 * **The titles are deliberately unlike each other.** A real retirement pairs a
 * rule with its own revision, but the contradiction gate refuses a second
 * governing item that reads like a first one, and answering it with
 * `--supersedes` here would route these through `createItem`'s own retirement
 * path instead of the direct call each of them is about. The pairing is made
 * by `supersedeItem` explicitly, which is the surface under test.
 */

test('superseding a pinned item clears the pin in the same act', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.status, 'superseded');
  assert.equal(retired.always, false);
  assert.equal(retired.severity, 'soft');
  s.dispose();
});

test('a retired item that was neither pinned nor hard is left exactly as it was', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: 'Log every refusal' });
  const next = createItem(s.ctx, { type: 'rule', title: 'Prefer one act to two' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.always, false);
  assert.equal(retired.severity, 'soft');
  // No stand-down happened, so nothing is recorded — the note exists to
  // explain a cleared field, and a note about nothing is noise on the item.
  assert.equal(retired.observations.length, 0);
  s.dispose();
});

/**
 * `INV-nothing-is-dropped-silently` in its standing form. An item somebody
 * pinned mattered enough to pin; a reader who later asks why a once-pinned
 * rule is quiet must get an answer on the item, not only in an audit log they
 * would have to know to open.
 */
test('what was cleared is recorded on the retired item, with the date', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.observations.length, 1);
  const note = retired.observations[0];
  assert.equal(note.category, 'supersession');
  assert.match(note.text, /Stood down on \d{4}-\d{2}-\d{2}/);
  assert.match(note.text, new RegExp(`${next.id} superseded it`));
  assert.match(note.text, /"always" is now false/);
  assert.match(note.text, /"severity" is now "soft"/);
  // The stamp the same act writes on `validUntil` — one act, one date.
  assert.match(note.text, new RegExp(retired.validUntil!));
  s.dispose();
});

test('the note names only the field that actually moved', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'requirement', title: 'Items carry a domain', severity: 'hard',
  });
  const next = createItem(s.ctx, { type: 'requirement', title: 'Sessions resume where they stopped' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const note = s.ctx.store.get(old.id)!.observations[0];
  assert.match(note.text, /"severity" is now "soft"/);
  assert.doesNotMatch(note.text, /always/);
  s.dispose();
});

test('the note survives the round trip through Markdown byte for byte', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: 'Pin the budget, not the item', always: true });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const retired = s.ctx.store.get(old.id)!;
  const onDisk = readFileSync(path.join(s.root, retired.filePath), 'utf8');
  assert.ok(
    onDisk.includes(retired.observations[0].text),
    'the stand-down note is not on disk as written; a normalisation would make the '
    + 'checksum permanently disagree with the file and doctor would report a hand edit',
  );
  s.dispose();
});

test('the audit row names the fields the retirement moved, and no field it did not', () => {
  const s = sandbox();
  const pinned = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const plain = createItem(s.ctx, { type: 'rule', title: 'Log every refusal' });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: pinned.id, by: next.id });
  supersedeItem(s.ctx, { id: plain.id, by: next.id });

  const rows = readAudit(s.root).filter((r) => r.op === 'supersede');
  const forPinned = rows.find((r) => r.itemId === pinned.id)!;
  const forPlain = rows.find((r) => r.itemId === plain.id)!;
  assert.deepEqual(forPinned.fields, ['status', 'relations', 'validUntil', 'always', 'severity']);
  // An echo is not a change: naming `always` on a retirement that found it
  // already false would put a field in the log that this write never moved.
  assert.deepEqual(forPlain.fields, ['status', 'relations', 'validUntil']);
  s.dispose();
});

test('the result message says the item was stood down, not only that it was retired', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', always: true, severity: 'hard',
  });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  const result = supersedeItem(s.ctx, { id: old.id, by: next.id });
  assert.match(result.message, /stood down/);
  assert.match(result.message, /"always" is now false and "severity" is now "soft"/);
  s.dispose();
});

/**
 * The stand-down belongs to the ACT of retiring. A repeat call performs no
 * act — its own message says "already superseded ... Nothing changed" — so
 * repairing a field there would make that sentence false, and would be a
 * corpus edit nobody asked for hidden inside a no-op. `doctor`'s
 * `retired_still_binding` is where the already-retired ones surface.
 */
test('a repeat supersede does not repair a field, and does not add a second note', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: 'Pin the budget, not the item', always: true });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });
  const before = s.ctx.store.get(old.id)!.observations.length;

  // Put the pin back the way a person or an older write could have, then ask
  // again: the pair is already wired, so this returns without writing.
  updateItem(s.ctx, { id: old.id, always: true });
  const again = supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.match(again.message, /already superseded/);
  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.always, true, 'the no-op return must not quietly edit the corpus');
  assert.equal(retired.observations.length, before);
  s.dispose();
});

test('nothing else about the retired item is touched', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', body: 'The reason.',
    always: true, severity: 'hard', scope: ['src/**'], tags: ['governance'],
  });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.body, 'The reason.');
  assert.deepEqual(retired.scope, ['src/**']);
  assert.deepEqual(retired.tags, ['governance']);
  assert.equal(retired.continuity, false);
  s.dispose();
});
