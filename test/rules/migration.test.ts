// @basis TASK-seed-the-store-and-migrate-the-rules-that-already-exist, INV-markdown-is-the-source-of-truth
/**
 * **Migration: one copy of a rule, and a way back that a test takes.**
 *
 * D41 spec §15 and `plan:store seq:4` Task 16. The owner's ruling is the whole
 * shape of this file: *"it should happen only once when we have the store as
 * production grade and not before, so we could be sure it will not mess our
 * corpus and project; it should be done carefully and tested that the
 * migration process is correct, and if not it should be reversible until what
 * is required is fixed."*
 *
 * Two things follow, and they are asserted rather than promised.
 *
 * **One copy.** Each migrated rule MOVES: the entry is written, and the corpus
 * item it came from is retired with a pointer and STOOD DOWN in the same act.
 * Never copied — `CLAUDE.md` opens on what a copy costs, measured on
 * 2026-09-07 when five superseded instructions were being acted on as current,
 * because a copy cannot be superseded and only the original can.
 *
 * **A way back that somebody has taken.** "Reversible" is a property of code
 * that has been run backwards, not a sentence in a design. `revertMigration`
 * writes the recorded bytes back and the assertion is byte identity, because
 * anything weaker would pass on a corpus that had been subtly rewritten.
 *
 * ── AND WHY THE APPLY PATH IS TESTED BUT NOT RUN ───────────────────────────
 *
 * `supersedeItem` refuses a non-human caller retiring a governing normative
 * item, so an agent CANNOT perform this migration — asserted below rather than
 * described. That refusal is the product's, not this script's, and it is the
 * reason the real candidate list is reported to the owner instead of applied:
 * four of the eleven candidates are pinned (`always: true`) hard rules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import type { Severity } from '../../src/core/types.ts';
import { loadRules } from '../../src/rules/store.ts';
import { writeManifest } from '../../src/rules/manifest.ts';
import {
  CANDIDATES, applyMigration, ledgerPath, planMigration, revertMigration, type Candidate,
} from '../../scripts/migrate-rules.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/** An empty published store, so no test ever writes into the shipped one. */
function scratchStore(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-migrate-'));
  writeManifest(dir);
  return dir;
}

const BODY = [
  'Owner ruling 2026-09-05, after it happened. A lane ran `git stash` while three other lanes',
  'were writing to the same working tree.',
  '',
  'The blast radius is every other lane’s uncommitted work, and the lane that fires it cannot',
  'see what it destroyed.',
].join('\n');

/** One candidate whose source item this test creates for itself. */
function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    entryId: 'never-a-git-command-that-writes-the-shared-tree',
    kind: 'prohibition',
    tier: 'developer',
    title: 'a lane runs no git command that writes the shared working tree',
    from: 'RULE-a-lane-runs-no-git-command-that-writes',
    parts: {
      prohibition: 'a lane runs no git command that writes, moves or discards — stash, checkout, '
        + 'reset, clean, restore, add, commit, merge, rebase, and anything with force in it.',
      why: 'lanes share ONE checkout, so a whole-tree operation issued by someone holding a '
        + 'fraction of the tree destroys work it cannot see.',
      example: 'a lane stashed three other lanes’ uncommitted work on 2026-09-05 and recovered '
        + 'it only by checking files out of the stash before the pop landed.',
      check: 'none - nothing gates what a lane types into a shell.',
    },
    ...over,
  };
}

/** The source item for `candidate()`, created in the sandbox. */
function source(
  box: Sandbox,
  over: { always?: boolean; type?: string; id?: string; title?: string; severity?: Severity } = {},
): string {
  const made = createItem(box.ctx, {
    type: over.type ?? 'rule',
    id: over.id ?? 'RULE-a-lane-runs-no-git-command-that-writes',
    title: over.title ?? 'a lane runs no git command that writes the shared working tree',
    body: BODY,
    summary: 'Lanes share one working tree, so a git command that moves files can destroy work '
      + 'belonging to someone who never ran it.',
    status: 'active',
    severity: over.severity ?? 'hard',
    always: over.always ?? false,
    origin: 'human',
  });
  // `MutationResult.filePath` is relative to the corpus root.
  return path.resolve(box.root, made.filePath);
}

const APPLY = { origin: 'human' as const, confirm: true };

test('the plan names every candidate and classifies each, with nothing silently absent', () => {
  const box = sandbox();
  try {
    const plan = planMigration(box.ctx, CANDIDATES);
    assert.equal(plan.rows.length, CANDIDATES.length);
    assert.deepEqual(
      plan.rows.map((r) => r.candidate.entryId).sort(),
      CANDIDATES.map((c) => c.entryId).sort(),
    );
    for (const row of plan.rows) assert.notEqual(row.detail.trim(), '');
  } finally { box.dispose(); }
});

/**
 * **The classification itself, and this exists because the test above did not
 * cover it.** Asserting the row COUNT and the ids left `classify` free to
 * return the same state for every candidate: the mutation that turned
 * `authored` into `ready` came back GREEN. So the two cases that are
 * determinate whatever the corpus holds are asserted directly — a candidate
 * that names no source item is `authored` wherever it runs, and one that names
 * a source item is `missing` in a corpus that does not hold it.
 */
test('a candidate with no source item is AUTHORED, and one with a source is not', () => {
  const box = sandbox();
  try {
    const rows = new Map(planMigration(box.ctx, CANDIDATES).rows
      .map((r) => [r.candidate.entryId, r.state]));
    for (const c of CANDIDATES) {
      assert.equal(
        rows.get(c.entryId),
        c.from === null ? 'authored' : 'missing',
        `${c.entryId} is classified ${rows.get(c.entryId)}`,
      );
    }
    // And the two groups are both non-empty, or one half of the assertion
    // above is vacuous.
    assert.ok(CANDIDATES.some((c) => c.from === null));
    assert.ok(CANDIDATES.some((c) => c.from !== null));
  } finally { box.dispose(); }
});

test('a candidate whose source item is absent is REFUSED, never quietly authored', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    const plan = planMigration(box.ctx, [candidate()]);
    assert.deepEqual(plan.rows.map((r) => r.state), ['missing']);
    assert.notEqual(plan.refusal, null);
    assert.throws(
      () => applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY }),
      /missing/,
    );
    assert.deepEqual(loadRules(store, true).entries, []);
  } finally { box.dispose(); removeTree(store); }
});

test('a PINNED source item refuses the whole plan, and names it', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box, { always: true });
    const plan = planMigration(box.ctx, [candidate()]);
    assert.deepEqual(plan.rows.map((r) => r.state), ['pinned']);
    assert.match(String(plan.refusal), /RULE-a-lane-runs-no-git-command-that-writes/);
    assert.throws(
      () => applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY }),
      /pinned/,
    );
  } finally { box.dispose(); removeTree(store); }
});

test('an entry NARROWER than the item it would retire refuses, because retiring it loses the rest', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    const narrow = candidate({ broader: 'RULE-a-lane-runs-no-git-command-that-writes' });
    const plan = planMigration(box.ctx, [narrow]);
    assert.deepEqual(plan.rows.map((r) => r.state), ['narrows']);
    assert.throws(
      () => applyMigration(box.ctx, [narrow], { storeDir: store, ...APPLY }),
      /narrow/i,
    );
  } finally { box.dispose(); removeTree(store); }
});

test('AN AGENT CANNOT PERFORM THIS MIGRATION: the product refuses, not the script', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    assert.throws(
      () => applyMigration(box.ctx, [candidate()], { storeDir: store, origin: 'agent', confirm: true }),
      /non-human caller cannot supersede a governing normative item/,
    );
    // And the store is untouched by the half that ran before the refusal.
    assert.deepEqual(loadRules(store, true).entries.map((e) => e.id), []);
  } finally { box.dispose(); removeTree(store); }
});

test('a migrated rule lives in EXACTLY ONE place: the entry governs, the item is retired and stood down', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    const file = source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });

    const entries = loadRules(store, true).entries;
    assert.deepEqual(entries.map((e) => e.id), ['never-a-git-command-that-writes-the-shared-tree']);

    const after = readFileSync(file, 'utf8');
    // Structure, one field per assertion: a retirement that moved `status` and
    // left `always` set is exactly the defect that had five superseded
    // instructions acted on as current, and a single combined assertion would
    // let either half pass for the other.
    assert.match(after, /^status: superseded$/m);
    assert.match(after, /^always: false$/m);
    assert.match(after, /^severity: soft$/m);
    assert.match(after, /superseded_by/);
  } finally { box.dispose(); removeTree(store); }
});

test('the retired item POINTS at where the rule went, in ONE hop', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    const file = source(box);
    const result = applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });

    // Structure, not a substring: read the relation OFF the retired item,
    // then follow it. A substring match would pass on the entry id appearing
    // anywhere in the file, including inside the stand-down note.
    const edge = /^- superseded_by \[\[([\w-]+)\]\]$/m.exec(readFileSync(file, 'utf8'));
    assert.ok(edge !== null, 'the retired item carries no superseded_by relation');
    assert.deepEqual(result.pointers, [edge[1]]);

    const successor = box.ctx.store.get(edge[1]);
    assert.ok(successor !== null && successor !== undefined, `${edge[1]} is not in the corpus`);
    assert.ok(
      String(successor.body).includes('src/rules/entries/never-a-git-command-that-writes-the-shared-tree.md'),
      'the successor does not say where the rule went',
    );
  } finally { box.dispose(); removeTree(store); }
});

test('the entry carries the ITEM’S OWN BODY, so migrating loses no evidence', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    const entry = loadRules(store, true).entries[0];
    assert.ok(entry.body.includes('blast radius'), 'the item’s argument did not travel');
    assert.ok(entry.body.includes('2026-09-05'), 'the item’s measurement did not travel');
    assert.match(entry.body, /Moved from `RULE-a-lane-runs-no-git-command-that-writes`/);
  } finally { box.dispose(); removeTree(store); }
});

test('THE WAY BACK: revert restores the corpus item byte for byte', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    const file = source(box);
    const before = readFileSync(file);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    assert.notDeepEqual(readFileSync(file), before, 'the migration changed nothing to revert');

    revertMigration(box.ctx, { storeDir: store });
    assert.deepEqual(readFileSync(file), before);
  } finally { box.dispose(); removeTree(store); }
});

test('THE WAY BACK: revert takes the entry back out of the store', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    const manifestBefore = readFileSync(path.join(store, 'manifest.json'), 'utf8');
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    revertMigration(box.ctx, { storeDir: store });
    assert.deepEqual(readdirSync(store).filter((f) => f.endsWith('.md')), []);
    assert.equal(readFileSync(path.join(store, 'manifest.json'), 'utf8'), manifestBefore);
  } finally { box.dispose(); removeTree(store); }
});

test('THE WAY BACK: revert puts the INDEX back, not only the file', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    revertMigration(box.ctx, { storeDir: store });
    const row = box.ctx.store.get('RULE-a-lane-runs-no-git-command-that-writes');
    assert.ok(row !== null && row !== undefined, 'the item is not in the index');
    assert.equal(row.status, 'active');
  } finally { box.dispose(); removeTree(store); }
});

test('revert with no ledger REFUSES rather than guessing what to undo', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    assert.equal(existsSync(ledgerPath(box.root)), false);
    assert.throws(() => revertMigration(box.ctx, { storeDir: store }), /no migration/i);
  } finally { box.dispose(); removeTree(store); }
});

test('a ledger that no longer matches the file on disk REFUSES to overwrite it', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    const file = source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    // Somebody edited the retired item after the migration. Writing the
    // recorded bytes back would silently discard that edit, and a way back
    // that destroys work is not a way back.
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n<!-- edited after the migration -->\n`);
    assert.throws(() => revertMigration(box.ctx, { storeDir: store }), /changed since/i);
  } finally { box.dispose(); removeTree(store); }
});

/**
 * **TWO mechanisms stop a second run, and they are asserted separately —
 * because asserting on the word "already" proved nothing.**
 *
 * The first draft matched `/already/i` on the refusal, and it stayed GREEN
 * with the ledger guard removed: the SECOND mechanism, `planMigration`
 * classifying the now-retired source item as `already`, produces a refusal
 * carrying the same word. One assertion was covering two mechanisms and would
 * have gone on passing with either one deleted.
 *
 * So: the LEDGER guard is asserted on the ledger's own sentence, and it is
 * asserted against a candidate whose source item is untouched — otherwise the
 * classifier refuses first and the guard is never reached.
 */
test('applying twice is refused BY THE LEDGER, before anything is classified', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    // A candidate the classifier would happily pass: nothing in the corpus
    // holds it, so `authored` — and the only thing left to refuse is the
    // ledger.
    const fresh = candidate({ entryId: 'a-second-entry', from: null });
    assert.throws(
      () => applyMigration(box.ctx, [fresh], { storeDir: store, ...APPLY }),
      /migration ledger is already on disk/,
    );
  } finally { box.dispose(); removeTree(store); }
});

test('applying twice is refused AGAIN by the classifier: the source is retired', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY });
    const plan = planMigration(box.ctx, [candidate()]);
    assert.deepEqual(plan.rows.map((r) => r.state), ['already']);
  } finally { box.dispose(); removeTree(store); }
});

test('the real candidate list is NOT applicable today, and the plan says why', () => {
  const box = sandbox();
  try {
    // Dogfooding: this runs against the CURRENT corpus, which is the workspace
    // the candidates name. The sandbox is empty, so every candidate that names
    // a source item is `missing` here — the assertion that matters is over the
    // real corpus, in `planMigration`'s own refusal, and it is asserted by the
    // shape of the answer rather than by a number that moves.
    const plan = planMigration(box.ctx, CANDIDATES);
    assert.notEqual(plan.refusal, null);
    assert.ok(plan.rows.some((r) => r.state === 'missing'));
  } finally { box.dispose(); }
});

/**
 * **THE CONTRADICTION GATE FIRES ON THE POINTER ITEM, and until this the plan
 * had no way to answer it.**
 *
 * `pointerItem` mints a `decision`, and `decision` is in the owner's gated set
 * (`core/overlap.ts` · `GATED_CATEGORIES`) — so every pointer this migration
 * writes is put to the gate, against a corpus of 1,000-odd items, on a LEXICAL
 * score that cannot tell agreement from conflict. It fired on the real corpus
 * on the first rehearsal run and there was nothing in `Candidate` to answer
 * with, so the migration was unrunnable rather than merely refused.
 *
 * The answer is the product's own: `--distinct`, carried on the candidate and
 * handed to `createItem`. Not routed around — a verdict is recorded for the
 * pair exactly as it would be from the CLI, so the next write about either
 * item is not asked again.
 *
 * **The collider below is short and every one of its tokens appears in the
 * pointer item**, so `containment` is 1 and the score is 0.8 — well over
 * `CONTRADICTION_THRESHOLD`. Shaped that way rather than copied from
 * `pointerItem`'s body, because a copy of that text here would be a second
 * copy of it in the repository and would go stale the day the pointer's
 * wording changes.
 */
function collider(box: Sandbox): string {
  return createItem(box.ctx, {
    type: 'decision',
    id: 'DEC-an-earlier-decision-about-the-product-rule-store',
    title: 'moved into the product rule store',
    summary: 'An earlier decision that happens to use the same words as the pointer this '
      + 'migration mints, and means something else entirely.',
    body: 'This rule is no longer maintained in this corpus.',
    status: 'active',
    severity: 'soft',
    always: false,
    origin: 'human',
  }).id;
}

test('the pointer item is PUT TO the contradiction gate, and refused when nothing answers it', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    collider(box);
    assert.throws(
      () => applyMigration(box.ctx, [candidate()], { storeDir: store, ...APPLY }),
      /may contradict/,
    );
    // And the entry written before the pointer was attempted is gone again:
    // a half-applied migration is the one outcome worse than none.
    assert.deepEqual(loadRules(store, true).entries, []);
  } finally { box.dispose(); removeTree(store); }
});

test('a candidate ANSWERS the gate with `distinct`, and the migration proceeds', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    const other = collider(box);
    applyMigration(
      box.ctx, [candidate({ distinct: [other] })], { storeDir: store, ...APPLY },
    );
    assert.deepEqual(
      loadRules(store, true).entries.map((e) => e.id),
      ['never-a-git-command-that-writes-the-shared-tree'],
    );
  } finally { box.dispose(); removeTree(store); }
});

/**
 * **TWO POINTERS IN ONE MIGRATION CONTRADICT EACH OTHER, and nothing a person
 * types could have settled it — the second pointer does not exist when the
 * candidate list is written.**
 *
 * `pointerItem` mints every pointer from ONE template, so two pointers differ
 * only in a title and an entry id and are otherwise the same paragraph. The
 * gate scores that LEXICALLY, so the second pointer of any multi-rule
 * migration is raised against the first — measured on this repository's own
 * corpus, where the second of three was refused against the first.
 *
 * Answering it by hand would mean writing `DEC-moved-<the previous entry>`
 * into the candidate list, which is a disposition naming an item that does not
 * exist until the run is half done: migrate a different subset and the same
 * line becomes a stray id the gate refuses as a typo. So the dispositions
 * between THIS RUN'S OWN pointers are supplied by the run, and only genuine
 * disagreements with the standing corpus are written down by a person.
 *
 * The verdict is `distinct` and it is true rather than convenient: two
 * pointers say where two DIFFERENT rules went, and both are true at once.
 */
test('two pointers in one migration do not refuse each other', () => {
  const box = sandbox();
  const store = scratchStore();
  try {
    source(box);
    source(box, {
      id: 'LESSON-stage-what-an-agent-reported-touching',
      title: 'stage what an agent reported touching',
      type: 'lesson',
      severity: 'soft',
    });
    applyMigration(box.ctx, [
      candidate(),
      candidate({
        entryId: 'commit-with-a-pathspec',
        title: 'the dispatching session commits by explicit path',
        from: 'LESSON-stage-what-an-agent-reported-touching',
      }),
    ], { storeDir: store, ...APPLY });
    assert.deepEqual(
      loadRules(store, true).entries.map((e) => e.id).sort(),
      ['commit-with-a-pathspec', 'never-a-git-command-that-writes-the-shared-tree'],
    );
  } finally { box.dispose(); removeTree(store); }
});
