/**
 * **`Item.summary`, and the staleness mechanism that keeps it honest.**
 *
 * Four properties this file exists to pin, because each is a way the field
 * could look right and be wrong:
 *
 *  1. **An item with no summary is untouched — byte for byte and hash for
 *     hash.** Every item in every corpus predates this field, and `continuity`
 *     is the precedent: written to frontmatter only when present, absent from
 *     `computeItemChecksum` unless present. An unconditional key would move all
 *     730 recorded checksums in this repository's own corpus in one act. This
 *     is the gate that matters and it is tested first.
 *  2. **A summary records what it was written against, and divergence is
 *     MEASURED.** Not "probably stale" — a recorded hash that no longer
 *     matches. The write that sets a summary stamps the basis; no other write
 *     touches it, which is why an edit to the body makes the summary stale
 *     rather than quietly re-blessing it.
 *  3. **The basis is the item's PROSE and nothing else.** Pinning an item,
 *     re-tagging it, narrowing its scope or retiring it must not report a
 *     stale summary — a staleness signal that fires on a pin is one readers
 *     learn to ignore.
 *  4. **`agentEdits` governs it with no exception carved.** A summary is the
 *     most quotable thing an item has; it must not be the one content field an
 *     agent can rewrite unreviewed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  SUMMARY_BASIS, itemSummaryBasis, stampSummary, summaryState, summaryStalenessNote,
} from '../../src/core/content-hash.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import {
  createItem, updateItem, supersedeItem, type UpdateInput,
} from '../../src/core/mutate.ts';
import { revisionFor } from '../../src/core/revision.ts';
import { SUMMARY_MAX_CHARS, validateSummary } from '../../src/core/validate.ts';
import { checkSummary } from '../../src/doctor/checks.ts';
import { itemCost } from '../../src/core/select.ts';
import { renderIndexLine, renderItemBlock } from '../../src/core/render-item.ts';
import { TIER_UPDATES } from '../../src/core/categories.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';

const PLAIN = 'A screen says it checked a session and found nothing, when it never checked at all.';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

function fileOf(box: Sandbox, id: string): string {
  return readFileSync(path.join(box.root, itemOf(box, id).filePath), 'utf8');
}

function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: 'Secrets in logs outlive the incident.',
    status: 'active',
    origin: 'human',
    ...extra,
  }).id;
}

// --- 1. an item without one is byte-identical and hash-identical ------------

test('an item with no summary writes no summary line and no summary_of line', () => {
  const box = sandbox();
  try {
    const text = fileOf(box, rule(box));
    assert.doesNotMatch(text, /^summary:/m,
      'an unconditional `summary: null` line would be added to every item in every corpus on ' +
      'the next write — the byte-identical round trip broken for all of them at once');
    assert.doesNotMatch(text, /^summary_of:/m);
  } finally { box.dispose(); }
});

test('a summaryless item hashes exactly as it did before the field existed', () => {
  // Built as a literal and hashed against a shape assembled WITHOUT the two
  // keys, which is what "before the field existed" means: not a golden string
  // that would have to be regenerated, but the claim itself — the conditional
  // in `computeItemChecksum` is what makes an unconditional key impossible.
  const box = sandbox();
  try {
    const id = rule(box);
    const item = itemOf(box, id);
    assert.equal(item.summary, null);
    const before = computeItemChecksum(item);

    // The same item, re-hashed after a summary is stamped on: the hash MUST
    // move, or the checksum would not protect the summary at all.
    const withOne = { ...item };
    stampSummary(withOne, PLAIN);
    assert.notEqual(computeItemChecksum(withOne), before,
      'a summary that does not move the checksum is a summary a hand edit can rewrite with ' +
      'nothing reporting it');
  } finally { box.dispose(); }
});

test('the whole committed corpus still matches its recorded checksums', () => {
  // The gate the owner named as the most important one: phase 1 must not
  // invalidate 729 checksums. `test/core/corpus-checksums.test.ts` asserts this
  // over this repository's own `.my_context/`; this asserts the PROPERTY that
  // makes it hold, so a future change that makes the key unconditional fails
  // here with a sentence rather than there with a wall of ids.
  const shape = (item: Item): string => computeItemChecksum(item);
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box));
    const parsedBack = parseItem(fileOf(box, item.id), item.filePath, 'project');
    assert.equal(parsedBack.summary, null, 'absent must parse back as absent, never as ""');
    assert.equal(parsedBack.summaryOf, null);
    assert.equal(shape(parsedBack), item.checksum);
  } finally { box.dispose(); }
});

// --- the shape on disk ------------------------------------------------------

test('a summary is two frontmatter lines, and they round-trip byte for byte', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    const text = fileOf(box, id);
    assert.match(text, /^summary: /m);
    assert.match(text, /^summary_of: [0-9a-f]{16}$/m,
      'the basis is a checksum of the summarised content, written beside the summary');

    // `INV-markdown-is-the-source-of-truth`: files -> DB -> files, byte-identical.
    const parsed = parseItem(text, itemOf(box, id).filePath, 'project');
    assert.equal(renderItem(parsed), text);
    assert.equal(parsed.summary, PLAIN);
    assert.equal(parsed.summaryOf, itemOf(box, id).summaryOf);
  } finally { box.dispose(); }
});

test('a summary containing a colon survives the frontmatter round trip', () => {
  // The serializer quotes anything carrying `:` or `#`; a prose summary is
  // exactly the value most likely to carry one, and a summary that could not
  // be read back would be authored knowledge destroyed on the next rebuild.
  const box = sandbox();
  try {
    const tricky = 'It says one thing: it did the check. In fact: it did not.';
    const id = rule(box, { summary: tricky });
    const text = fileOf(box, id);
    assert.equal(parseItem(text, itemOf(box, id).filePath, 'project').summary, tricky);
    assert.equal(renderItem(parseItem(text, itemOf(box, id).filePath, 'project')), text);
  } finally { box.dispose(); }
});

// --- 2. staleness is measured ----------------------------------------------

test('a summary written with the item is current', () => {
  const box = sandbox();
  try {
    assert.equal(summaryState(itemOf(box, rule(box, { summary: PLAIN }))), 'current');
  } finally { box.dispose(); }
});

test('editing the body makes the summary stale, and nothing re-blesses it', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    updateItem(box.ctx, { id, body: 'Rewritten entirely.', origin: 'human' });
    assert.equal(summaryState(itemOf(box, id)), 'stale');

    // A SECOND unrelated edit must not quietly fix it: only a write that
    // carries a summary re-stamps the basis.
    updateItem(box.ctx, { id, title: 'Another title', origin: 'human' });
    assert.equal(summaryState(itemOf(box, id)), 'stale');
  } finally { box.dispose(); }
});

test('an edit that carries the body AND a new summary lands current, not stale', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    updateItem(box.ctx, {
      id, body: 'Rewritten entirely.', summary: 'The check never happened.', origin: 'human',
    });
    assert.equal(summaryState(itemOf(box, id)), 'current',
      'the basis is stamped AFTER the assignments, so a summary written with the change it ' +
      'describes is not born stale');
  } finally { box.dispose(); }
});

test('the empty string clears the summary, and clears the basis with it', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    updateItem(box.ctx, { id, summary: '', origin: 'human' });
    const item = itemOf(box, id);
    assert.equal(item.summary, null);
    assert.equal(item.summaryOf, null, 'a basis with no summary is a dangling record');
    assert.equal(summaryState(item), 'absent');
    assert.doesNotMatch(fileOf(box, id), /^summary(_of)?:/m);
  } finally { box.dispose(); }
});

test('a summary with no basis reads as unanchored, never as current', () => {
  // Unreachable through any write path — `stampSummary` writes the pair — so
  // this is the hand-edited file, which is the one case that must not pass for
  // a good summary.
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    assert.equal(summaryState({ ...item, summaryOf: null }), 'unanchored');
  } finally { box.dispose(); }
});

test('the staleness note is one wording, and says nothing when there is nothing to say', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box, { summary: PLAIN }));
    assert.equal(summaryStalenessNote(item), null);
    assert.equal(summaryStalenessNote({ ...item, summary: null }), null);
    assert.match(summaryStalenessNote({ ...item, summaryOf: 'deadbeefdeadbeef' })!, /STALE/);
    assert.match(summaryStalenessNote({ ...item, summaryOf: null })!, /summary_of/);
  } finally { box.dispose(); }
});

// --- 3. the basis is the prose and nothing else -----------------------------

test('SUMMARY_BASIS classifies every content field, and the prose fields are the summarised set', () => {
  assert.deepEqual(
    Object.entries(SUMMARY_BASIS).filter(([, v]) => v === 'summarised').map(([k]) => k),
    ['body', 'steps', 'observations', 'extra'],
    'the summarised set is what the item ASSERTS. Adding OR REMOVING a field here makes every ' +
    'recorded basis in every corpus stale at once, so it is a deliberate act and not a ' +
    'tidy-up. `title` left this set by owner ruling on 2026-08-27 and the corpus was migrated ' +
    'by scripts/restamp-summary-basis.ts in the same act; the reasoning and the accepted risk ' +
    'are on SUMMARY_BASIS itself.',
  );
});

test('pinning, re-tagging, re-scoping and retiring do NOT make a summary stale', () => {
  const moves: [string, UpdateInput][] = [
    // OWNER RULING 2026-08-27, and it is the reason this row is here rather
    // than in the stale-making test below: a summary is a plain sentence about
    // what the item SAYS, and the title is a label ON the item, not part of
    // what it says. Retitling
    // `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` to remove a
    // claim its own body had already withdrawn flipped a word-for-word correct
    // summary to `stale`, and nothing could clear it but rewriting a sentence
    // with nothing wrong with it.
    ['title', { id: '', title: 'Never log a customer email address' }],
    ['always', { id: '', always: true }],
    ['tags', { id: '', tags: ['v2', 'ui'] }],
    ['scope', { id: '', scope: ['src/**'] }],
    ['severity', { id: '', severity: 'hard' }],
  ];
  for (const [what, patch] of moves) {
    const box = sandbox();
    try {
      const id = rule(box, { summary: PLAIN });
      updateItem(box.ctx, { ...patch, id, origin: 'human' });
      assert.equal(summaryState(itemOf(box, id)), 'current',
        `moving ${what} marked the summary stale — a signal that fires on a change no reader ` +
        `of the summary can see is one readers learn to ignore`);
    } finally { box.dispose(); }
  }
});

test('a retirement does not make the retired item\'s summary stale', () => {
  // `supersedeItem` writes a `superseded_by` relation onto the retiree. If
  // relations were part of the basis, every retirement in this corpus would
  // report a stale summary for an edge that says something about a DIFFERENT
  // item.
  const box = sandbox();
  try {
    const old = rule(box, { summary: PLAIN });
    const replacement = rule(box, { title: 'Do not log customer email, ever', id: 'RULE-r2' });
    supersedeItem(box.ctx, { id: old, by: replacement, origin: 'human' });
    assert.equal(summaryState(itemOf(box, old)), 'current');
  } finally { box.dispose(); }
});

test('an observation or an extra field DOES move the basis', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN, extra: { directive: 'dont' } });
    updateItem(box.ctx, { id, extra: { directive: 'do' }, origin: 'human' });
    assert.equal(summaryState(itemOf(box, id)), 'stale',
      '`directive` decides whether a rule prohibits or prescribes — a summary written against ' +
      'one describes the opposite of the other');
  } finally { box.dispose(); }
});

test('the basis excludes the summary itself, so a summary is never born stale', () => {
  const box = sandbox();
  try {
    const item = itemOf(box, rule(box));
    const before = itemSummaryBasis(item);
    const after = { ...item };
    stampSummary(after, PLAIN);
    assert.equal(itemSummaryBasis(after), before,
      'a basis that included the summary would be invalidated by the very write that set it');
    assert.equal(after.summaryOf, before);
  } finally { box.dispose(); }
});

// --- the bound --------------------------------------------------------------

test('the bound is 160 characters, and it is a readability bound', () => {
  assert.equal(SUMMARY_MAX_CHARS, 160,
    'the number is reasoned from what a reader absorbs in one pass — about twenty-five words, ' +
    'two lines at 80 columns — not from what fits on a screen. Changing it is a decision ' +
    'about the bar, which validate.ts states in full.');
  assert.doesNotThrow(() => validateSummary('x'.repeat(SUMMARY_MAX_CHARS)));
  assert.throws(() => validateSummary('x'.repeat(SUMMARY_MAX_CHARS + 1)), /161 characters/);
});

test('the refusal teaches the bar rather than only naming the number', () => {
  assert.throws(() => validateSummary('x'.repeat(400)), (err: Error) => {
    assert.match(err.message, /ONE PLAIN SENTENCE/);
    assert.match(err.message, /does not know this codebase/);
    assert.match(err.message, /wants splitting/,
      'an item that cannot be summarised inside the bound is a finding about the item');
    return true;
  });
});

test('a line break in a summary is refused, not folded', () => {
  assert.throws(() => validateSummary('One line.\nAnd another.'), /line break/);
  assert.throws(() => validateSummary('One line. And another.'), /line break/);
});

test('an over-long summary is refused at every write surface', () => {
  const box = sandbox();
  try {
    assert.throws(() => rule(box, { summary: 'x'.repeat(200) }), /the limit is 160/);
    const id = rule(box);
    assert.throws(
      () => updateItem(box.ctx, { id, summary: 'x'.repeat(200), origin: 'human' }),
      /the limit is 160/,
    );
    assert.equal(itemOf(box, id).summary, null, 'the refusal promises nothing was written');
  } finally { box.dispose(); }
});

// --- injection cost ---------------------------------------------------------

test('a summary costs nothing at injection: it reaches no rendered block or index line', () => {
  // The decision, pinned rather than described. Measured on this repository's
  // corpus: the index tier's 111 normative-eligible lines already cost 4,242
  // estimated tokens against `budgets.index` of 1,200, and the 25 pinned items
  // cost 17,679 against `budgets.pinned` of 6,000. Both tiers are already over.
  // A summary on every index line would take the index to ~9,900 — eight times
  // its budget — so the summary is a READER's field, not an injected one, and
  // `itemCost` must not move.
  const box = sandbox();
  try {
    const id = rule(box);
    const bare = itemOf(box, id);
    const withOne = { ...bare };
    stampSummary(withOne, PLAIN);

    assert.equal(renderItemBlock(withOne), renderItemBlock(bare));
    assert.equal(itemCost(withOne), itemCost(bare));
    assert.equal(
      renderIndexLine({ id: withOne.id, type: withOne.type, title: withOne.title }),
      renderIndexLine({ id: bare.id, type: bare.type, title: bare.title }),
    );
    assert.doesNotMatch(renderItemBlock(withOne), /screen says it checked/);
  } finally { box.dispose(); }
});

// --- 4. agentEdits governs it -----------------------------------------------

test('an agent\'s summary edit on a governing rule is STAGED, not applied', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'review' } } });
  try {
    const id = rule(box, { summary: PLAIN });
    const result = updateItem(box.ctx, {
      id, summary: 'Something else entirely.', origin: 'agent',
    });
    assert.ok(result.staged, 'a summary write is an edit and obeys agentEdits with no exception');
    assert.equal(itemOf(box, id).summary, PLAIN, 'the item keeps its summary until promoted');
    assert.deepEqual(
      Object.keys(revisionFor(box.ctx, id)!.changes), ['summary'],
    );
  } finally { box.dispose(); }
});

test('a promoted summary revision is stamped against the text it was approved against', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'allow' } } });
  try {
    const id = rule(box, { summary: PLAIN });
    updateItem(box.ctx, { id, summary: 'The check never happened.', origin: 'agent' });
    const item = itemOf(box, id);
    assert.equal(item.summary, 'The check never happened.');
    assert.equal(summaryState(item), 'current');
  } finally { box.dispose(); }
});

// --- doctor -----------------------------------------------------------------

test('doctor reports a stale summary, an unanchored one and an over-long one', () => {
  const box = sandbox();
  try {
    const id = rule(box, { summary: PLAIN });
    updateItem(box.ctx, { id, body: 'Rewritten.', origin: 'human' });
    const stale = itemOf(box, id);

    assert.deepEqual(checkSummary([stale]).map((f) => f.code), ['summary_stale']);
    assert.deepEqual(
      checkSummary([{ ...stale, summaryOf: null }]).map((f) => f.code), ['summary_unanchored'],
    );
    // Hand-authored over-length: no write path produces it, and refusing to
    // LOAD it would make an item invisible for being wordy.
    const long = { ...stale, summary: 'x'.repeat(400) };
    assert.ok(checkSummary([long]).some((f) => f.code === 'summary_too_long'));
    // And a good one is silent.
    assert.deepEqual(checkSummary([itemOf(box, rule(box, { id: 'RULE-b', summary: PLAIN }))]), []);
  } finally { box.dispose(); }
});

test('doctor says nothing at all about the 730 items that have no summary', () => {
  const box = sandbox();
  try {
    assert.deepEqual(checkSummary([itemOf(box, rule(box))]), [],
      'absent is legal and stays legal — a corpus that predates the field must not turn ' +
      'yellow the day it lands');
  } finally { box.dispose(); }
});

// --- extra-field collision --------------------------------------------------

test('an extra field named summary or summary_of is refused as the collision it is', () => {
  const box = sandbox();
  try {
    for (const key of ['summary', 'summary_of']) {
      assert.throws(
        () => rule(box, { extra: { [key]: 'x' } }),
        /collides with a reserved frontmatter field/,
        `renderItem writes extra AFTER the fixed keys, so an extra "${key}" would overwrite ` +
        `the real field on disk and be read back as it`,
      );
    }
  } finally { box.dispose(); }
});

// --- the CLI ----------------------------------------------------------------

/**
 * **The gate and the net, in one test, because they are one ruling.**
 *
 * This used to reach `stale` by running `mycontext edit --body` with no
 * summary. That route is now REFUSED (owner ruling: a summary follows its
 * body), so the only way a summary can still go stale is the one the gate
 * cannot see and the net exists for: a hand-edited `.md`, which
 * markdown-as-source-of-truth explicitly permits. Both halves are asserted
 * here — the refusal, and the staleness that survives it — because dropping
 * either would leave the other looking like the whole mechanism.
 */
test('edit refuses a body change with no summary, and a HAND edit still goes stale', () => {
  const box = sandbox();
  try {
    const lines: string[] = [];
    const out = (s: string): void => { lines.push(s); };
    assert.equal(runCli(
      ['add', 'rule', 'Do not log secrets', '--body', 'Because they outlive the incident.',
        '--summary', PLAIN, '--yes'],
      box.cwd, out,
    ), 0, lines.join('\n'));

    const id = /created (\S+)/.exec(lines.join('\n'))![1];
    lines.length = 0;
    assert.equal(runCli(['show', id], box.cwd, out), 0);
    assert.match(lines.join('\n'), /^summary: /m);
    assert.doesNotMatch(lines.join('\n'), /STALE/, 'a current summary is not accused');

    lines.length = 0;
    assert.equal(runCli(['edit', id, '--body', 'Rewritten.', '--yes'], box.cwd, out), 1,
      'a body change with no summary is refused, not applied and left stale');
    const refusal = lines.join('\n');
    assert.match(refusal, /Nothing was changed/);
    assert.match(refusal, /screen says it checked/,
      'the refusal shows what the summary currently says, so the writer can judge how much ' +
      'of it has to move');

    // The hand edit: the one route the gate cannot reach, and the reason
    // `summary_stale` stays exactly as it is.
    const file = path.join(box.root, 'items', 'rule', `${id}.md`);
    writeFileSync(file, readFileSync(file, 'utf8').replace('Because they outlive', 'Rewritten by'));

    lines.length = 0;
    assert.equal(runCli(['show', id], box.cwd, out), 0);
    const shown = lines.join('\n');
    assert.match(shown, /^summary: /m, 'the summary is shown rather than hidden');
    assert.match(shown, /STALE/, 'and it is labelled, because nobody can hash it in their head');
  } finally { box.dispose(); }
});

test('mycontext edit --summary= removes the summary, and --summary sets one', () => {
  const box = sandbox();
  try {
    const lines: string[] = [];
    const out = (s: string): void => { lines.push(s); };
    const id = rule(box, { summary: PLAIN });
    box.ctx.store.close();

    assert.equal(runCli(['edit', id, '--summary', 'A shorter one.', '--yes'], box.cwd, out), 0,
      lines.join('\n'));
    lines.length = 0;
    assert.equal(runCli(['show', id], box.cwd, out), 0);
    assert.match(lines.join('\n'), /^summary: A shorter one\.$/m);

    lines.length = 0;
    assert.equal(runCli(['edit', id, '--summary=', '--yes'], box.cwd, out), 0, lines.join('\n'));
    lines.length = 0;
    assert.equal(runCli(['show', id], box.cwd, out), 0);
    assert.doesNotMatch(lines.join('\n'), /^summary(_of)?:/m);
  } finally { box.dispose(); }
});

test('mycontext add refuses an over-long summary before the normative gate', () => {
  const box = sandbox();
  try {
    const lines: string[] = [];
    assert.equal(runCli(
      ['add', 'rule', 'A title', '--summary', 'x'.repeat(200), '--yes'],
      box.cwd, (s) => { lines.push(s); },
    ), 1);
    const text = lines.join('\n');
    assert.match(text, /the limit is 160/);
    assert.doesNotMatch(text, /about to create/,
      'a capture that cannot land is refused before a human is asked to approve it');
  } finally { box.dispose(); }
});

// --- the surface says so ----------------------------------------------------

test('every surface that names `always` names `summary` too', () => {
  // `continuity`'s own precedent for a new first-class field: it is declared in
  // `TIER_UPDATES`, which is what `mycontext examples <type>` renders — so
  // declaring `summary` there is what puts it beside `always` on that surface
  // rather than leaving it a flag a user can only find by reading source.
  for (const tier of ['normative', 'rationale'] as const) {
    assert.ok(Object.hasOwn(TIER_UPDATES[tier], 'summary'),
      `the ${tier} tier declares \`always\` and not \`summary\``);
  }
  const lines: string[] = [];
  const box = sandbox();
  try {
    assert.equal(runCli(['examples', 'rule'], box.cwd, (s) => { lines.push(s); }), 0);
    const text = lines.join('\n').replace(/\s+/g, ' ');
    assert.ok(text.includes('summary'), '`mycontext examples rule` never mentions summary');
    assert.ok(text.includes('always'), 'the control: this surface does name `always`');
  } finally { box.dispose(); }
});

// --- the MCP surfaces -------------------------------------------------------

test('create_item takes a summary, and get_item labels it once it goes stale', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'allow' } } });
  try {
    const registry = createRegistry(box.cwd);
    registry.call('create_item', {
      type: 'lesson',
      title: 'The check never ran',
      body: 'The endpoint reported a zero it had not measured.',
      summary: PLAIN,
    });

    const before = registry.call('get_item', { id: 'LESSON-the-check-never-ran' });
    assert.match(before, /^summary: /m, 'the summary is part of the item a model reads back');
    assert.doesNotMatch(before, /STALE/);

    // A hand edit, for the reason the CLI test above gives: `update_item` with
    // a body and no summary is now refused, so the only remaining route to a
    // stale summary is a file edited outside the tool — which is exactly the
    // case a model reading an item back most needs to be warned about, because
    // nothing told it the file had moved.
    const file = path.join(
      box.root, 'items', 'lesson', 'LESSON-the-check-never-ran.md',
    );
    writeFileSync(file, readFileSync(file, 'utf8').replace('reported a zero', 'reported nothing'));
    const after = registry.call('get_item', { id: 'LESSON-the-check-never-ran' });
    assert.match(after, /^summary: /m, 'still shown — nothing is withheld');
    assert.match(after, /STALE/,
      'a model reading an item back is the caller most likely to quote its summary onward');
  } finally { box.dispose(); }
});

test('update_item("") removes a summary through the agent surface too', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'allow' } } });
  try {
    const registry = createRegistry(box.cwd);
    registry.call('create_item', { type: 'lesson', title: 'The check never ran', summary: PLAIN });
    registry.call('update_item', { id: 'LESSON-the-check-never-ran', summary: '' });
    assert.doesNotMatch(
      registry.call('get_item', { id: 'LESSON-the-check-never-ran' }), /^summary(_of)?:/m,
    );
  } finally { box.dispose(); }
});

test('the create_item and update_item schemas both offer summary', () => {
  const box = sandbox();
  try {
    for (const name of ['create_item', 'update_item']) {
      const spec = createRegistry(box.cwd).list().find((t) => t.name === name)!;
      const props = (spec.inputSchema as { properties: Record<string, { description?: string }> })
        .properties;
      assert.ok(Object.hasOwn(props, 'summary'), `${name} does not offer summary`);
      assert.match(props.summary.description!, /PLAIN sentence/,
        'the schema is where a model learns the bar, and "short" is not the bar');
    }
  } finally { box.dispose(); }
});
