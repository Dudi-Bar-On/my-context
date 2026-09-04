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
import { basisMoves, summaryReaffirmed, summaryRequired } from '../../src/core/summary-gate.ts';
import {
  SUMMARY_REAFFIRMED_NOTE, SUMMARY_UNCHANGED_NOTE,
} from '../../src/core/summary-history.ts';
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

/** A `task`, whose extra bag is entirely the workflow fields RULING 1
 * (2026-09-04) is about: `plan`, `seq`, `state`, `priority` — "its plan,
 * sequence and state live in extra fields; the body is what the task
 * actually requires" (categories.ts, `task`'s own description). */
function task(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'task',
    title: 'Fix the retry loop',
    body: 'The retry loop never applies backoff, so a flaky call hammers the endpoint.',
    status: 'active',
    origin: 'human',
    extra: { plan: 'walk', seq: '9', state: 'todo', priority: '2' },
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

/**
 * **RULING 1, 2026-09-04.** Owner's reasoning: a summary describes what an
 * item MEANS; moving a task to `done` changes its status, not its meaning.
 * `plan`, `seq`, `state` and `priority` are the whole of what a `task`'s
 * extra bag holds today (`categories.ts`'s own description of the category),
 * and none of them is the task's requirement — the body is. `directive`
 * (on `rule`) stays in the basis: it is content, the plainest case of a key
 * inside `extra` that genuinely changes what the item says, and this test
 * would fail if a workflow exclusion ever widened to swallow it.
 */
test('the gate does not fire on workflow keys inside extra: plan, seq, state, priority', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, task(box, { summary: PLAIN }));
    const asks = (patch: Record<string, unknown>): boolean =>
      summaryRequired(item, { id: item.id, ...patch });

    assert.equal(asks({ extra: { state: 'done' } }), false,
      'closing a task changes its status, not its meaning — owner ruling 2026-09-04');
    assert.equal(asks({ extra: { plan: 'port' } }), false,
      'which lane tracks the work, not what the work is');
    assert.equal(asks({ extra: { seq: '12' } }), false,
      'position within the plan, not the task\'s requirement');
    assert.equal(asks({ extra: { priority: '1' } }), false,
      'a ready-queue ordering number, the same role `severity` already plays outside extra');

    // A content-bearing key in the SAME bag, on a different category, is
    // untouched by the exclusion — `extra` as a whole is not unsummarised.
    const ruleItem = itemOf(box, rule(box, { summary: PLAIN }));
    assert.equal(summaryRequired(ruleItem, { id: ruleItem.id, extra: { directive: 'do' } }), true,
      '`directive` decides whether a rule prohibits or prescribes; it is the reason `extra` ' +
      'stays in the basis at all, and it must still gate on its own');
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

/**
 * The clause that used to stand here asserted the opposite: an item with no
 * summary was never gated, "because there is nothing to invalidate". That
 * waiver is what made the hole self-perpetuating — an item born without a
 * summary consulted it on every later edit and was let through every time,
 * while `summary_stale` could not report it either, so no enforced path could
 * ever give it one. With the creation gate closing the front door, a null
 * summary means a legacy item or a hand-authored file, and the owner's ruling
 * applies to both on the same terms as to everything else.
 */
test('an item with no summary is gated like any other: the waiver was the hole', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box));
    assert.equal(item.summary, null);
    assert.equal(summaryRequired(item, { id: item.id, body: 'Anything at all.' }), true,
      'a waiver no path can ever lift is a dead end, not an exemption');
    assert.equal(
      summaryRequired(item, { id: item.id, body: 'Anything at all.', summaryUnchanged: true }),
      false,
      'and the same escape hatch is available, so the gate is answerable',
    );
    assert.equal(summaryRequired(item, { id: item.id, tags: ['x'] }), false,
      'an edit that moves nothing summarised still raises no gate here');
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

/**
 * RULING 1, demonstrated end to end through the CLI. Before this ruling,
 * `mycontext edit <id> --extra state=done` refused every time — the defect
 * `TASK-closing-any-task-trips-the-summary-gate-even-though-only-the`
 * reports, with three lanes reaching for `--summary-unchanged` in one night
 * because the escape hatch had become the reflex. Both halves matter: the
 * gate must fall silent on the workflow move AND stay exactly as strict on a
 * real one, or the fix would be the permissive kind that quietly weakens a
 * real guard.
 */
test('closing a task with --extra state=done no longer trips the gate, and a real content edit still does', () => {
  const box = sandbox();
  try {
    const id = task(box, { summary: PLAIN });
    box.ctx.store.close();

    const closed = cli(box, ['edit', id, '--extra', 'state=done', '--yes']);
    assert.equal(closed.code, 0, closed.out);
    assert.doesNotMatch(cli(box, ['show', id]).out, /STALE/,
      'the summary is still current — moving state changed nothing it describes');

    const refused = cli(box, ['edit', id, '--body',
      'The retry loop applies backoff but never resets it, so it never recovers.', '--yes']);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.flat, /Nothing was changed/,
      'a real rewrite of what the task requires still asks for the sentence to move with it');
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

/**
 * The hatch on an item with no summary used to be refused outright — there was
 * no sentence for it to leave standing. It is ACCEPTED now, and it has to be:
 * the same item is gated now, so refusing the flag would raise a gate with no
 * way through it. What the flag asserts there is slightly different — "this
 * item is being left without a summary, deliberately" — and the audit row says
 * so with its own note.
 */
test('--summary-unchanged answers the gate on an item with no summary', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const filePath = itemOf(box, id).filePath;
    box.ctx.store.close();
    const refused = cli(box, ['edit', id, '--body', 'New.', '--yes']);
    assert.equal(refused.code, 1, 'the edit is gated, exactly as on a summarised item');
    assert.match(refused.flat, /carries no summary/);

    const r = cli(box, ['edit', id, '--body', 'New.', '--summary-unchanged', '--yes']);
    assert.equal(r.code, 0, r.flat);
    assert.match(readFileSync(path.join(box.root, filePath), 'utf8'), /New\./);
  } finally { box.dispose(); }
});

test('--summary-unchanged on an unsummarised item that raises no gate is still refused', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--tags', 'x', '--summary-unchanged', '--yes']);
    assert.equal(r.code, 1);
    assert.match(r.flat, /does not raise it/);
    assert.match(r.flat, /the summary it has never had/);
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
    assert.match(r.flat, /pass it back verbatim/,
      'and the refusal names the route that IS honest, because a refusal whose only remedy is ' +
      '"write a different sentence" is a demand for a gratuitous rewrite when the sentence is ' +
      'still correct');
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * THE RE-AFFIRMATION.
 *
 * A summary that is stale and STILL CORRECT had no honest way out: the hatch
 * refuses it (above), `update_item` on a normative category stages rather than
 * writes, and `edit --summary "<the same sentence>"` reported "nothing to
 * change" — which was false. The stamp had something to change; no FIELD did.
 *
 * The act is spelled with the sentence rather than with a flag on purpose. A
 * flag can be typed over every warning in a corpus without a word being read;
 * reproducing the sentence costs the same keystrokes as writing a new one and
 * carries the same claim, so the guard is intrinsic and there is no third
 * clause to get wrong.
 * -------------------------------------------------------------------------- */

/** The item, its file hand-edited so the summary is genuinely stale — the case
 * `summary_stale` exists for and the only one a re-affirmation is about. */
function staleRule(box: Sandbox): string {
  const id = rule(box, { summary: PLAIN });
  const filePath = itemOf(box, id).filePath;
  box.ctx.store.close();
  const file = path.join(box.root, filePath);
  writeFileSync(file, readFileSync(file, 'utf8').replace('outlive', 'outlast'));
  return id;
}

test('the same sentence, passed back on a stale summary, re-stamps the basis', () => {
  const box = sandbox();
  try {
    const id = staleRule(box);
    assert.match(cli(box, ['show', id]).out, /STALE/);

    const r = cli(box, ['edit', id, '--summary', PLAIN, '--yes']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.flat, /summary_of stale -> re-affirmed/,
      'the preview says what actually moves — a diff of the sentence against itself would show ' +
      'the reader nothing and suggest a rewrite that is not happening');

    const shown = cli(box, ['show', id]).out;
    assert.ok(shown.includes(PLAIN), 'not one word of the summary changed');
    assert.doesNotMatch(shown, /STALE/, 'and that is the whole point: it is current again');
    assert.doesNotMatch(shown, /^summary_was:/m,
      'nothing was REPLACED, so nothing is recorded — the same rule the hatch is under');
  } finally { box.dispose(); }
});

test('a re-affirmation is audited as itself, and not as the hatch', () => {
  const box = sandbox();
  try {
    const id = staleRule(box);
    assert.equal(cli(box, ['edit', id, '--summary', PLAIN, '--yes']).code, 0);

    const rows = readAudit(box.root).filter((r) => r.itemId === id && r.op === 'update');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, SUMMARY_REAFFIRMED_NOTE,
      '"I read this item and this sentence still describes it" is a different assertion from ' +
      '"this edit did not change what the item means", and a log that spelled them the same ' +
      'way could not answer either question');
    assert.notEqual(rows[0].note, SUMMARY_UNCHANGED_NOTE);
    assert.equal(rows[0].fields, undefined,
      'no AUDITED_FIELD moved — `summaryOf` is deliberately not one — so the note is the ' +
      'entire record of what happened, which is exactly why it has to exist');
  } finally { box.dispose(); }
});

test('an echo on a summary that is already current is still the no-op it always was', () => {
  // The narrowness of the fix, stated as a test. `summaryReaffirmed` asks
  // whether the STAMP moves, not whether the summary is echoed: on a current
  // summary with nothing else in the patch it does not, so the command reports
  // the no-op rather than writing a re-affirmation of something nobody doubted.
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--summary', PLAIN, '--yes']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.flat, /nothing to change/);
    assert.match(r.flat, /Nothing was written/);
    assert.equal(readAudit(box.root).filter((x) => x.itemId === id && x.op === 'update').length, 0,
      'and nothing reached the audit log, because nothing reached the store');
  } finally { box.dispose(); }
});

test('the same sentence beside a body change is the hatch\'s other spelling, and says so', () => {
  // `--body X --summary "<the same sentence>"` answers the gate and asserts the
  // sentence still holds — the identical claim `--summary-unchanged` makes,
  // typed the long way. It must be recorded as a re-affirmation rather than
  // passing as an ordinary summary write, or the log would say somebody wrote
  // a new sentence when nobody did.
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();
    const r = cli(box, ['edit', id, '--body', 'Secrets in logs outlast the incident.',
      '--summary', PLAIN, '--yes']);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(cli(box, ['show', id]).out, /STALE/);

    const rows = readAudit(box.root).filter((x) => x.itemId === id && x.op === 'update');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, SUMMARY_REAFFIRMED_NOTE);
    assert.deepEqual(rows[0].fields, ['body'],
      '`summary` did not move and the row must not say it did');
  } finally { box.dispose(); }
});

test('the predicate is the stamp, not the sentence: three cases', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    const asks = (patch: Record<string, unknown>): boolean =>
      summaryReaffirmed(item, { id: item.id, ...patch });

    assert.equal(asks({ summary: NEW }), false, 'new text is a rewrite, never a re-affirmation');
    assert.equal(asks({ summary: PLAIN }), false,
      'an echo that moves no stamp is a no-op — this item\'s summary is current');
    assert.equal(asks({ summary: PLAIN, body: 'A different claim entirely.' }), true,
      'the same echo becomes a re-affirmation the moment the text under it moves');
    assert.equal(asks({ summary: `  ${PLAIN}  `, body: 'A different claim entirely.' }), true,
      'normalised the way `updateItem` normalises, so surrounding whitespace is not new text');
    assert.equal(asks({ body: 'A different claim entirely.' }), false,
      'and a call that carries no summary at all asserts nothing');
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

test('nor can a RE-AFFIRMATION be staged, and it used to walk straight past review', () => {
  // The hole this test is the regression for: `contentChange` calls an echoed
  // summary no change — correctly, there is no new TEXT to stage — so the call
  // fell through the `review` branch with nothing staged and applied. That took
  // the STALE marker off a governing item on an agent's word, under the one
  // policy whose purpose is that it does not happen, and the audit row named no
  // field and carried no note, so there was no evidence it had.
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'The check never ran', summary: PLAIN,
      body: 'The endpoint reported a zero it had not measured.',
      status: 'active', origin: 'human',
    }).id;
    // Stale, through the road no gate watches: a direct body write.
    updateItem(box.ctx, { id, body: 'It reported nothing at all.', origin: 'human' });
    assert.equal(summaryState(itemOf(box, id)), 'stale');
    box.ctx.store.close();

    const registry = createRegistry(box.cwd);
    assert.throws(
      () => registry.call('update_item', { id, summary: PLAIN }),
      /nothing was staged/,
    );
    assert.throws(
      () => registry.call('update_item', { id, summary: PLAIN }),
      /mycontext edit .* --summary "<the same sentence>"/,
      'and it names the human who can make the assertion, in the spelling they would type',
    );
    assert.match(registry.call('get_item', { id }), /STALE/,
      'the marker is still there, which is the whole of the regression');
  } finally { box.dispose(); }
});

test('on agentEdits "allow" a re-affirmation applies, and carries its own note', () => {
  // `review` is what refuses it, not the assertion itself: where an agent's
  // content edits apply, so does this one — with the record that says which
  // assertion was made.
  const box = sandbox({ categories: { lesson: { agentEdits: 'allow' } } });
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'The check never ran', summary: PLAIN,
      body: 'The endpoint reported a zero it had not measured.',
      status: 'active', origin: 'human',
    }).id;
    updateItem(box.ctx, { id, body: 'It reported nothing at all.', origin: 'human' });
    assert.equal(summaryState(itemOf(box, id)), 'stale');
    box.ctx.store.close();

    const registry = createRegistry(box.cwd);
    registry.call('update_item', { id, summary: PLAIN });
    assert.doesNotMatch(registry.call('get_item', { id }), /STALE/);
    const rows = readAudit(box.root)
      .filter((r) => r.itemId === id && r.op === 'update' && r.origin === 'agent');
    assert.equal(rows.at(-1)!.note, SUMMARY_REAFFIRMED_NOTE);
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
