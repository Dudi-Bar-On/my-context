/**
 * **The gate: a summary follows its body — and the callers it must never
 * touch.**
 *
 * Owner ruling: *"everytime body is changed, the summary should too, based on
 * the new body."* Nothing here can write that sentence, so the ruling is a
 * REFUSAL at the two surfaces where somebody is holding the new text —
 * `mycontext edit` and the MCP `update_item` — and nowhere else.
 *
 * This file pins three things, and the third is the one that would be missed:
 *
 *  1. **The trigger is DERIVED from `itemSummaryBasis`, not from a list of
 *     flags.** So the cases below are not a catalogue of what somebody
 *     remembered: every "gated" case is a field `SUMMARY_BASIS` calls
 *     `summarised` and every "ungated" case is one it does not, and the two
 *     lists are the same list read from opposite ends. A hand-kept table of
 *     "flags that invalidate a summary" is the defect this repository has
 *     measured eight times.
 *  2. **The escape hatch is deliberate, bounded, and recorded.**
 *     `--summary-unchanged` re-stamps without new text; it is refused beside
 *     `--summary`, refused with no summary to leave alone, and refused on an
 *     edit that never raised the gate — so it can never become a way to bless
 *     a summary nobody read. Every use leaves a note in the audit log.
 *  3. **Every INTERNAL caller is untouched.** A gate that blocked `repair`, a
 *     promoted revision, a pack import, a status change or `refresh_item`
 *     would be a regression: none of those is a person holding new prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { summaryState } from '../../src/core/content-hash.ts';
import { basisMoves, summaryRequired } from '../../src/core/summary-gate.ts';
import { SUMMARY_UNCHANGED_NOTE } from '../../src/core/summary-history.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { promoteRevision } from '../../src/core/revision.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';

const PLAIN = 'A screen says it checked a session and found nothing, when it never checked at all.';
const NEW = 'A screen reports a measurement it never took.';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: 'Secrets in logs outlive the incident.',
    status: 'active',
    origin: 'human',
    extra: { directive: 'dont' },
    ...extra,
  }).id;
}

/** `mycontext <args>`, returning the exit code and everything it printed.
 * The store is closed first: `runCli` opens its own, and a sandbox holding a
 * write lock would make these tests about SQLite rather than about the gate. */
function cli(box: Sandbox, args: string[]): { code: number; out: string; flat: string } {
  const lines: string[] = [];
  const code = runCli(args, box.cwd, (s) => { lines.push(s); });
  const out = lines.join('\n');
  // Every refusal in this CLI is WRAPPED to the layout budget, so one sentence
  // arrives split across lines at a column nothing here should depend on.
  // `flat` is what the assertions match; `out` is what they print on failure.
  return { code, out, flat: out.replace(/\s+/g, ' ') };
}

/* -------------------------------------------------------------------------- *
 * THE TRIGGER, READ OFF THE BASIS.
 * -------------------------------------------------------------------------- */

test('the gate fires on exactly the fields the basis calls summarised', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    const asks = (patch: Record<string, unknown>): boolean =>
      summaryRequired(item, { id: item.id, ...patch });

    // Summarised: `body` and `extra` are the two an UpdateInput can carry.
    // (`steps` and `observations` are the other two and are create-only.)
    assert.equal(asks({ body: 'A different claim entirely.' }), true);
    assert.equal(asks({ extra: { directive: 'do' } }), true,
      '`directive` decides whether a rule prohibits or prescribes — the plainest possible case ' +
      'of changing what the item says');

    // Unsummarised, every one of them, and each is argued in `SUMMARY_BASIS`.
    assert.equal(asks({ title: 'A completely different title' }), false,
      'owner ruling 2026-08-27: a title is a label ON the item, not part of what it says');
    assert.equal(asks({ tags: ['v2', 'ui'] }), false,
      'tags are projected and rewritten mechanically — 285 items in one pass on this corpus');
    assert.equal(asks({ scope: ['docs/**'] }), false);
    assert.equal(asks({ always: true }), false, 'a pin changes who reads it, not what it says');
    assert.equal(asks({ continuity: true }), false);
    assert.equal(asks({ severity: 'hard' }), false);
    assert.equal(asks({ status: 'deprecated' }), false);
  } finally { box.dispose(); }
});

test('an echo is not a change: re-sending the same body raises no gate', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    assert.equal(basisMoves(item, { id: item.id, body: item.body }), false);
    // And the normalisation matches `updateItem`'s, so a body that differs only
    // in whitespace it will never store is not a change either.
    assert.equal(basisMoves(item, { id: item.id, body: `  ${item.body}\r\n` }), false,
      'the hash is taken over what will be WRITTEN, not over what was typed — refusing an edit ' +
      'for a change it does not make is the other half of the cry-wolf failure');
  } finally { box.dispose(); }
});

test('an item with no summary is never gated: there is nothing to invalidate', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box));
    assert.equal(item.summary, null);
    assert.equal(summaryRequired(item, { id: item.id, body: 'Anything at all.' }), false,
      'gating here would turn the ruling into a campaign to summarise the corpus');
  } finally { box.dispose(); }
});

test('an edit that carries a summary — including the CLEAR — satisfies the gate', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    assert.equal(summaryRequired(item, { id: item.id, body: 'New.', summary: NEW }), false);
    assert.equal(summaryRequired(item, { id: item.id, body: 'New.', summary: '' }), false,
      'removing a summary that no longer describes the item is not as good as writing a new ' +
      'one, and it is honest, which is the bar');
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * `mycontext edit` — the human surface.
 * -------------------------------------------------------------------------- */

test('edit refuses a body change with no summary, shows the current one, and writes nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    const bodyBefore = itemOf(box, id).body;
    box.ctx.store.close();

    const r = cli(box, ['edit', id, '--body', 'A different claim entirely.', '--yes']);
    assert.equal(r.code, 1);
    assert.match(r.flat, /Nothing was changed/);
    assert.match(r.flat, /screen says it checked/,
      'the refusal QUOTES the summary in full, because the whole point is that the writer ' +
      'judges how much of it has to move');
    assert.match(r.flat, /--summary-unchanged/, 'and it names the other way out');
    assert.doesNotMatch(r.flat, /about to edit/,
      'a refusal must never be preceded by "about to edit", which reads as a report of ' +
      'something that then did not happen');

    const after = cli(box, ['show', id]);
    assert.ok(after.out.includes(bodyBefore), 'the body on disk is untouched');
  } finally { box.dispose(); }
});

test('edit applies a body change that carries a summary, and records the old one', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();

    const r = cli(box, ['edit', id, '--body', 'A different claim entirely.',
      '--summary', NEW, '--yes']);
    assert.equal(r.code, 0, r.out);

    const shown = cli(box, ['show', id]).out;
    assert.match(shown, /^summary: A screen reports a measurement it never took\.$/m);
    assert.doesNotMatch(shown, /STALE/, 'the pair was written together, so it is current');
    assert.match(shown, /^summary_was:$/m);
    assert.ok(shown.includes(PLAIN), 'and what it replaced is kept');
  } finally { box.dispose(); }
});

test('edit does not gate a title, a pin, a retag, a rescope or a status change', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN, scope: ['src/**'] });
    box.ctx.store.close();

    for (const args of [
      ['--title', 'Never log customer email'],
      ['--tags', 'v2,ui'],
      ['--scope', 'docs/**'],
      ['--severity', 'hard'],
      ['--status', 'validated'],
    ]) {
      const r = cli(box, ['edit', id, ...args, '--yes']);
      assert.equal(r.code, 0, `\`edit ${args.join(' ')}\` was refused:\n${r.out}`);
    }
    assert.doesNotMatch(cli(box, ['show', id]).out, /STALE/,
      'and none of them made the summary stale either — the gate and the staleness check are ' +
      'the same predicate read from two sides, so they can never disagree');
  } finally { box.dispose(); }
});

test('edit gates an --extra that moves a declared field, because extra is content', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--extra', 'directive=do', '--yes']);
    assert.equal(r.code, 1, r.out);
    assert.match(r.flat, /Nothing was changed/);
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * THE ESCAPE HATCH.
 * -------------------------------------------------------------------------- */

test('--summary-unchanged applies the edit, keeps the sentence, and re-stamps the basis', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();

    const r = cli(box, ['edit', id, '--body', 'Secrets in logs outlive the incidnet.',
      '--summary-unchanged', '--yes']);
    assert.equal(r.code, 0, r.out);

    const shown = cli(box, ['show', id]).out;
    assert.ok(shown.includes(PLAIN), 'the summary text is untouched — that is what was asserted');
    assert.doesNotMatch(shown, /STALE/, 'and the basis moved with the body, so it is current');
    assert.doesNotMatch(shown, /^summary_was:/m,
      'nothing was REPLACED, so nothing is recorded: a history entry here would put the live ' +
      'sentence in the file twice');
  } finally { box.dispose(); }
});

test('the escape hatch is recorded in the audit row, so "nobody rewrote it" is visible', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    assert.equal(cli(box, ['edit', id, '--body', 'Secrets in logs outlive the incidnet.',
      '--summary-unchanged', '--yes']).code, 0);

    const rows = readAudit(box.root).filter((r) => r.itemId === id && r.op === 'update');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, SUMMARY_UNCHANGED_NOTE,
      'an unrecorded exemption is indistinguishable from nobody having noticed');
    assert.deepEqual(rows[0].fields, ['body'],
      '`summary` is NOT in `fields`: it did not move, and saying it did would make the audit ' +
      'log disagree with the item\'s own history');
  } finally { box.dispose(); }
});

test('an ordinary edit carries no such note, so the note means what it says', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    assert.equal(cli(box, ['edit', id, '--body', 'New body.', '--summary', NEW, '--yes']).code, 0);

    const rows = readAudit(box.root).filter((r) => r.itemId === id && r.op === 'update');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, undefined);
    assert.deepEqual(rows[0].fields, ['body', 'summary']);
  } finally { box.dispose(); }
});

test('--summary and --summary-unchanged together are refused rather than resolved', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--body', 'New.', '--summary', NEW,
      '--summary-unchanged', '--yes']);
    assert.equal(r.code, 1);
    assert.match(r.flat, /changed and that it did not/);
    assert.match(r.flat, /Nothing was changed/);
  } finally { box.dispose(); }
});

test('--summary-unchanged on an edit that never raised the gate is refused', () => {
  // The clause that keeps the hatch an ANSWER rather than a re-blessing tool.
  // Without it, `edit <id> --summary-unchanged` on an already-stale summary
  // would mark it current — a machine recording that somebody checked this
  // sentence against this text when nobody did.
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();

    const alone = cli(box, ['edit', id, '--summary-unchanged', '--yes']);
    assert.equal(alone.code, 1);
    assert.match(alone.flat, /does not raise it/);
    assert.match(alone.flat, /--summary "<text>"/, 'and it names what to do if it IS stale');

    const withTitle = cli(box, ['edit', id, '--title', 'Another title',
      '--summary-unchanged', '--yes']);
    assert.equal(withTitle.code, 1, 'a title moves nothing summarised, so there is no gate here');
  } finally { box.dispose(); }
});

test('--summary-unchanged on an item with no summary is refused', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--body', 'New.', '--summary-unchanged', '--yes']);
    assert.equal(r.code, 1);
    assert.match(r.flat, /has no summary to leave/);
  } finally { box.dispose(); }
});

test('a stale summary cannot be blessed by the hatch — it must be rewritten', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    const filePath = itemOf(box, id).filePath;
    box.ctx.store.close();

    // The hand edit that `summary_stale` exists for.
    const file = path.join(box.root, filePath);
    writeFileSync(file, readFileSync(file, 'utf8').replace('outlive', 'outlast'));
    assert.match(cli(box, ['show', id]).out, /STALE/);

    const r = cli(box, ['edit', id, '--summary-unchanged', '--yes']);
    assert.equal(r.code, 1, 'the hatch must not be the way a stale summary goes green');
    assert.match(cli(box, ['show', id]).out, /STALE/, 'and it is still stale afterwards');
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * THE MCP SURFACE.
 * -------------------------------------------------------------------------- */

test('update_item is gated too: an agent rewriting a body is holding the new text', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'allow' } } });
  try {
    const registry = createRegistry(box.cwd);
    registry.call('create_item', {
      type: 'lesson', title: 'The check never ran',
      body: 'The endpoint reported a zero it had not measured.', summary: PLAIN,
    });
    const id = 'LESSON-the-check-never-ran';

    assert.throws(
      () => registry.call('update_item', { id, body: 'Rewritten entirely.' }),
      /Nothing was changed/,
    );
    assert.throws(
      () => registry.call('update_item', { id, body: 'Rewritten entirely.' }),
      /summary_unchanged: true/,
      'the refusal names the hatch in the spelling THIS caller can type, not the CLI flag',
    );

    // Both ways out work from here.
    registry.call('update_item', { id, body: 'Rewritten entirely.', summary: NEW });
    assert.match(registry.call('get_item', { id }), /^summary: A screen reports a measurement/m);
    registry.call('update_item', { id, body: 'Rewritten entirley.', summary_unchanged: true });
    assert.doesNotMatch(registry.call('get_item', { id }), /STALE/);
  } finally { box.dispose(); }
});

test('the gate closes the staging path without touching it', () => {
  // On `agentEdits: "review"` a content change is STAGED. Gating the call means
  // the staged revision carries the body AND the summary, so the promotion a
  // human later approves lands both — rather than landing a body against a
  // summary written for the text it replaced.
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const registry = createRegistry(box.cwd);
    registry.call('create_item', {
      type: 'lesson', title: 'The check never ran',
      body: 'The endpoint reported a zero it had not measured.', summary: PLAIN,
    });
    const id = 'LESSON-the-check-never-ran';

    assert.throws(() => registry.call('update_item', { id, body: 'Rewritten.' }),
      /Nothing was changed/);
    const staged = registry.call('update_item', { id, body: 'Rewritten.', summary: NEW });
    assert.match(staged, /REV-/, 'it is held for a human, which is what `review` means');
  } finally { box.dispose(); }
});

test('the hatch cannot be STAGED, and is refused rather than dropped', () => {
  // A `RevisionChanges` carries text; `summary_unchanged` is an assertion about
  // the write and has nowhere to live in one. Letting it through would stage
  // the body, drop the assertion, and land a promoted body under a basis nobody
  // re-stamped — `INV-nothing-is-dropped-silently` with a summary attached.
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const registry = createRegistry(box.cwd);
    registry.call('create_item', {
      type: 'lesson', title: 'The check never ran',
      body: 'The endpoint reported a zero it had not measured.', summary: PLAIN,
    });
    const id = 'LESSON-the-check-never-ran';

    assert.throws(
      () => registry.call('update_item', { id, body: 'Rewriten.', summary_unchanged: true }),
      /nothing was staged/,
    );
    // And nothing WAS staged: the item is untouched and carries no revision.
    assert.doesNotMatch(registry.call('get_item', { id }), /Rewriten/);
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * EVERY INTERNAL CALLER, UNGATED.
 * -------------------------------------------------------------------------- */

test('updateItem itself is NOT gated — it is the road every internal write drives down', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    // The direct core call: `mycontext refresh`, `refresh_item`, `review
    // promote`, `inbox-promote`, `procedure`, the pack import and the revision
    // promotion all reach the store through exactly this, with no summary in
    // hand. A gate here would refuse every one of them.
    assert.doesNotThrow(() => updateItem(box.ctx, { id, body: 'Re-snapshotted.', origin: 'human' }));
    assert.equal(summaryState(itemOf(box, id)), 'stale',
      'and the summary goes stale, which is doctor\'s to report — the honest half, and the ' +
      'only half available to a caller that cannot write a sentence');
  } finally { box.dispose(); }
});

test('promoting a staged revision applies it, gate or no gate', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'The check never ran', body: 'It reported a zero.',
      summary: PLAIN, status: 'active', origin: 'human',
    }).id;
    // Staged through the store rather than the tool, because the point is the
    // PROMOTION: a human has already approved this text, and re-asking for a
    // summary at the moment of approval would be asking twice.
    updateItem(box.ctx, { id, body: 'It reported nothing at all.', origin: 'agent' });
    assert.doesNotThrow(() => promoteRevision(box.ctx, id, {}));
    assert.equal(itemOf(box, id).body, 'It reported nothing at all.');
  } finally { box.dispose(); }
});

test('repair re-stamps a hand-edited file without asking for a summary', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    const filePath = itemOf(box, id).filePath;
    box.ctx.store.close();

    const file = path.join(box.root, filePath);
    writeFileSync(file, readFileSync(file, 'utf8').replace('outlive', 'outlast'));
    const r = cli(box, ['repair', '--yes']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.flat, /re-stamped/);
    assert.match(cli(box, ['show', id]).out, /STALE/,
      'repair settles the CHECKSUM and says nothing about the sentence: the summary is still ' +
      'stale afterwards, and doctor still reports it');
  } finally { box.dispose(); }
});

test('pin, unpin, harden and soften are ungated on a summarised item', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    for (const name of ['pin', 'unpin', 'harden', 'soften']) {
      const r = cli(box, [name, id, '--yes']);
      assert.equal(r.code, 0, `\`${name}\` was refused:\n${r.out}`);
    }
  } finally { box.dispose(); }
});
