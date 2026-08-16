import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { pendingRevisionLine } from '../../src/core/revision.ts';
import { humanEdit, stageIn } from '../helpers/revisions.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext review`'s SECOND queue: the content changes an agent proposed
 * against a governing item under `agentEdits: "review"`, which the item does
 * not carry and never has.
 *
 * Everything here drives the real command end to end, because that is the only
 * way to see what a reviewer sees. The store's own semantics — staleness,
 * accumulation, the append-only log — are covered by
 * `test/core/revision.test.ts`; what these assert is that a human is shown the
 * change rather than an identifier, and is not asked to approve anything they
 * have not been shown.
 */

const BODY = 'Never log a customer email address.\nNot at debug level.\nNot in a stack trace.';
const NEW_BODY = 'Never log a customer email address.\nNot at debug level.\nRedact it in traces.';
const RULE = 'RULE-do-not-log-customer-email';
const DRAFT = 'RULE-cache-keys-include-tenant-id';

/**
 * A sentence that may have been WRAPPED to the layout budget. Every prose line
 * this command prints goes through `paragraph`, so a phrase can carry a
 * newline anywhere a space is — matching on the literal string would assert
 * the accident of where the wrap fell rather than what was said.
 */
function phrase(text: string): RegExp {
  return new RegExp(text.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-revs-'));
  try {
    runCli(['init'], cwd, () => {});
    run(['add', 'rule', 'Do not log customer email', '--body', BODY, '--yes'], cwd);
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** A normative DRAFT, so an item can sit in both queues at once. */
function seedDraft(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'rule', `${DRAFT}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${DRAFT}
type: rule
title: Cache keys include tenant ID
status: draft
severity: soft
always: false
origin: agent
---

# Cache keys include tenant ID

Every cache key carries the tenant id.
`, 'utf8');
}

function itemText(cwd: string, id: string, type = 'rule'): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

// --- the queue, as a diff ---------------------------------------------------

test('review revisions shows the proposal as a diff against the text the item governs now', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    const { code, out } = run(['review', 'revisions'], cwd);
    assert.equal(code, 0);
    assert.match(out, new RegExp(`^${RULE}$`, 'm'));
    assert.match(out, /^ {4}- Not in a stack trace\.$/m);
    assert.match(out, /^ {4}\+ Redact it in traces\.$/m);
    // The lines both texts agree on are context, not a delete-and-add pair.
    assert.match(out, /^ {6}Never log a customer email address\.$/m);
    assert.doesNotMatch(out, /^ {4}- Never log a customer email address\.$/m);
  });
});

test('the diff carries every field the revision changes and every line of each', () => {
  withProject((cwd) => {
    // Three fields at once, and a body whose change is at the END — the shape a
    // truncated diff hides. `review promote`'s preview was criticised in audit
    // for omitting `always`; a diff that stopped early would be that defect in
    // a shape that admits it less obviously.
    stageIn(cwd, RULE, {
      title: 'Never log any customer email',
      body: NEW_BODY,
      tags: ['pii', 'logging'],
    });
    const { out } = run(['review', 'revisions'], cwd);
    for (const field of ['title', 'body', 'tags']) {
      assert.match(out, new RegExp(`^ {2}${field}$`, 'm'), `no ${field} block:\n${out}`);
    }
    assert.match(out, /^ {4}\+ Never log any customer email$/m);
    assert.match(out, /^ {4}\+ Redact it in traces\.$/m);
    assert.match(out, /^ {4}\+ logging, pii$/m);
    assert.match(out, /^ {4}- \(no tags\)$/m);
  });
});

test('a stale revision says so at every detail level, naming the field that moved', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    humanEdit(cwd, RULE, `${BODY}\nAnd never in an exception message.`);
    for (const args of [['review', 'revisions'], ['review', 'revisions', '--full']]) {
      const { out } = run(args, cwd);
      assert.match(out, phrase('STALE — a human changed body'), `${args.join(' ')}:\n${out}`);
    }
    // `--full` shows what the human changed, not merely that they did.
    const full = run(['review', 'revisions', '--full'], cwd).out;
    assert.match(full, phrase('what changed underneath this revision'));
    assert.match(full, /^ {6}\+ And never in an exception message\.$/m);
  });
});

test('an item carrying two revisions shows both, and says which one this promotion staled', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    stageIn(cwd, RULE, { title: 'Never log any customer email' });
    const { out } = run(['review', 'revisions', '--full'], cwd);
    assert.equal(out.match(new RegExp(`^${RULE}$`, 'gm'))?.length, 2);
    // Staleness is per FIELD: promoting the body proposal does not touch the
    // title proposal, and saying otherwise would be a false claim about the
    // very consequence this line exists to warn about.
    assert.match(out, phrase('a different field, unaffected by promoting this one'));
    assert.doesNotMatch(out, phrase('rewrites what this one rewrites'));
  });
});

test('two revisions that rewrite the same field say the other one goes stale', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    stageIn(cwd, RULE, { body: `${BODY}\nRedact it everywhere.` });
    const { out } = run(['review', 'revisions', '--full'], cwd);
    assert.match(out, phrase('rewrites what this one rewrites, so promoting this one makes it stale'));
  });
});

// --- promotion --------------------------------------------------------------

test('promote-revision previews the diff before the confirmation, and applies it', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    const { code, out } = run(['review', 'promote-revision', RULE, '--yes'], cwd);
    assert.equal(code, 0);
    // The preview precedes the outcome line, so it was printed BEFORE the act.
    assert.ok(out.indexOf('about to promote a staged revision') < out.indexOf('promoted revision'));
    assert.match(out, /^ {4}\+ Redact it in traces\.$/m);
    assert.match(itemText(cwd, RULE), /Redact it in traces\./);
    assert.match(run(['review', 'revisions'], cwd).out, /no revisions pending/);
  });
});

/**
 * The tier axis, which nothing here exercised until dogfooding found it.
 *
 * Every other test in this file, and every test in `core/revision.test.ts`,
 * stages against a `rule`. On the normative tier "keeps governing its current
 * body" and "now governs the proposed body" are exactly right, so four
 * messages carrying that word were green forever. Setting
 * `agentEdits: "review"` on `lesson` in this repository's own corpus — the one
 * configuration a user has to write by hand to reach this path, since
 * rationale defaults to `allow` — produced all four about an item that governs
 * nothing, by the definition this project's own glossary gives the word.
 *
 * A green suite over one tier is a suite that has tested one tier. Both are
 * asserted below, and in the same test, because the point is the DIFFERENCE:
 * checking them apart is how a single tier-blind wording satisfies both.
 */
test('the word "governs" appears only where the tier earns it', () => {
  const LESSON = 'LESSON-retry-storms-need-jitter';
  withProject((cwd) => {
    // `lesson` is rationale, so it defaults to `allow` and must be set
    // explicitly — which is exactly the configuration this defect hid behind.
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({
        profile: 'standard',
        categories: { lesson: { agentEdits: 'review' } },
      }),
      'utf8',
    );
    run(['add', 'lesson', 'Retry storms need jitter', '--body', 'Because they synchronise.'], cwd);

    const staged = stageIn(cwd, LESSON, { body: 'Because they synchronise on the same tick.' });
    assert.doesNotMatch(
      staged.message, /govern/,
      `a lesson governs nothing, but the staging message says it does:\n${staged.message}`,
    );
    assert.match(staged.message, /is unchanged and keeps its current body/);

    // The aggregate line covers both tiers at once and so cannot branch; it
    // must therefore say the thing that is true of both.
    const queue = run(['review', 'revisions'], cwd).out;
    assert.match(queue, phrase('the items keep their current text'));

    const promoted = run(['review', 'promote-revision', LESSON, '--yes'], cwd);
    assert.equal(promoted.code, 0);
    assert.doesNotMatch(
      promoted.out, /govern/,
      `nothing in a rationale promotion may claim governance:\n${promoted.out}`,
    );
    assert.match(promoted.out, phrase('`-` is the text this item has now'));
    assert.match(promoted.out, phrase('now carries the proposed body'));
  });

  // The other half: the normative tier keeps the strong word, because that is
  // where it carries the weight of the sentence. A tier-neutral rewrite would
  // pass every assertion above and lose exactly that.
  withProject((cwd) => {
    const staged = stageIn(cwd, RULE, { body: NEW_BODY });
    assert.match(staged.message, /keeps governing its current body/);
    const promoted = run(['review', 'promote-revision', RULE, '--yes'], cwd);
    assert.match(promoted.out, phrase('now governs the proposed body'));
  });
});

test('a stale revision is refused before any preview, and nothing is written', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    humanEdit(cwd, RULE, `${BODY}\nAnd never in an exception message.`);
    const before = itemText(cwd, RULE);
    const { code, out } = run(['review', 'promote-revision', RULE, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /is STALE/);
    assert.match(out, /--force/);
    // Refusal first: a human must never be shown what a promotion will do,
    // asked to approve it, and only then told it was never going to land.
    assert.doesNotMatch(out, /about to promote/);
    assert.equal(itemText(cwd, RULE), before);
  });
});

test('--force is itself gated, and shows the human text it is about to destroy', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    humanEdit(cwd, RULE, `${BODY}\nAnd never in an exception message.`);
    const before = itemText(cwd, RULE);

    // Not confirmed (no --yes, no tty): --force alone does not promote.
    const refused = run(['review', 'promote-revision', RULE, '--force'], cwd);
    assert.equal(refused.code, 1);
    assert.match(refused.out, phrase('refusing without confirmation'));
    assert.equal(itemText(cwd, RULE), before);
    // And what it would have destroyed was on screen before the prompt.
    assert.match(refused.out, phrase('DESTROYS that newer text'));
    assert.match(refused.out, /^ {4}\+ And never in an exception message\.$/m);
    assert.ok(
      refused.out.indexOf('And never in an exception message.')
      < refused.out.indexOf('refusing without confirmation'),
      `the overwritten text must be shown before the prompt:\n${refused.out}`,
    );

    const forced = run(['review', 'promote-revision', RULE, '--force', '--yes'], cwd);
    assert.equal(forced.code, 0);
    assert.match(forced.out, phrase('promoted with force'));
    assert.match(itemText(cwd, RULE), /Redact it in traces\./);
    assert.doesNotMatch(itemText(cwd, RULE), /exception message/);
  });
});

test('--force on a revision that is not stale says it changed nothing', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    const { out } = run(['review', 'promote-revision', RULE, '--force', '--yes'], cwd);
    assert.match(out, phrase('--force was passed, but this revision is not stale'));
  });
});

test('--revision picks one of several, and an unknown one is refused naming the pending ids', () => {
  withProject((cwd) => {
    const first = stageIn(cwd, RULE, { body: NEW_BODY }).revision.revisionId;
    const second = stageIn(cwd, RULE, { title: 'Never log any customer email' }).revision.revisionId;

    const bad = run(['review', 'promote-revision', RULE, '--revision', 'REV-nope', '--yes'], cwd);
    assert.equal(bad.code, 1);
    assert.match(bad.out, new RegExp(first));
    assert.match(bad.out, new RegExp(second));

    const { code, out } = run(['review', 'promote-revision', RULE, '--revision', second, '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, new RegExp(second));
    assert.match(itemText(cwd, RULE), /title: Never log any customer email/);
    // The other one is still pending, not silently settled alongside it.
    assert.match(run(['review', 'revisions'], cwd).out, new RegExp(first));
  });
});

// --- rejection --------------------------------------------------------------

test('discard-revision leaves the item alone and the proposal readable', () => {
  withProject((cwd) => {
    const rev = stageIn(cwd, RULE, { body: NEW_BODY }).revision.revisionId;
    const before = itemText(cwd, RULE);
    const { code, out } = run(['review', 'discard-revision', RULE, '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /^ {4}\+ Redact it in traces\.$/m, 'the diff must precede the confirmation');
    assert.equal(itemText(cwd, RULE), before);

    // The message names a command, and that command prints the proposed text —
    // the claim "the proposal is NOT deleted" is only true if it does.
    assert.match(out, new RegExp(`mycontext review revisions ${RULE} --full`));
    const history = run(['review', 'revisions', RULE, '--full'], cwd);
    assert.equal(history.code, 0);
    assert.match(history.out, new RegExp(`${rev} {2}discarded`));
    assert.match(history.out, /Redact it in traces\./);
  });
});

test('discard-revision without confirmation changes nothing', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    const { code, out } = run(['review', 'discard-revision', RULE], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase('refusing without confirmation'));
    assert.match(run(['review', 'revisions'], cwd).out, /1 pending revision\(s\)/);
  });
});

/**
 * The sentence a real agent reads when its edit is staged names commands. This
 * runs every command it names and asserts each one works and actually shows
 * the revision.
 *
 * That clause has been wrong once already — it named `mycontext review` when
 * `review` walked only the draft queue — and was then rewritten to say plainly
 * that NO command surfaced revisions, which this task makes false in turn. A
 * message naming a command is only as true as the command, so it is checked by
 * running it rather than by matching a string.
 */
test('the commands the staging message names exist, run, and show the revision', () => {
  withProject((cwd) => {
    const staged = stageIn(cwd, RULE, { body: NEW_BODY });
    const named = [...staged.message.matchAll(/`mycontext ([^`]+)`/g)].map((m) => m[1].split(' '));
    assert.ok(named.length > 0, `the staging message names no command:\n${staged.message}`);
    assert.doesNotMatch(staged.message, phrase('no command surfaces'));
    for (const args of named) {
      const { code, out } = run(args, cwd);
      assert.equal(code, 0, `\`mycontext ${args.join(' ')}\` failed:\n${out}`);
      assert.match(out, /1 pending revision\(s\)/, `\`mycontext ${args.join(' ')}\`:\n${out}`);
    }
  });
});

// --- a revision is not an item ----------------------------------------------

test('a pending revision is in no count of what governs and in no listing of items', () => {
  withProject((cwd) => {
    const listBefore = run(['list'], cwd).out;
    const statusBefore = run(['status', '--json'], cwd).out;
    stageIn(cwd, RULE, { title: 'Never log any customer email', body: NEW_BODY });

    assert.equal(run(['list'], cwd).out, listBefore);
    assert.doesNotMatch(run(['list', '--full'], cwd).out, /Never log any customer email/);
    const before = JSON.parse(statusBefore);
    const after = JSON.parse(run(['status', '--json'], cwd).out);
    assert.deepEqual(after.items, before.items);
    assert.deepEqual(after.reviewQueue, before.reviewQueue);
    assert.equal(after.pendingRevisions.revisions, 1);
    assert.equal(run(['show', RULE], cwd).out.includes('Redact it in traces.'), false);
  });
});

// --- the two queues ---------------------------------------------------------

test('a draft carrying a revision is unambiguous in both queues and in the promotion', () => {
  withProject((cwd) => {
    seedDraft(cwd);
    const rev = stageIn(cwd, DRAFT, {
      body: 'Every cache key carries the tenant id, first segment.',
    }).revision.revisionId;

    // The draft table points at the other queue rather than quietly holding an
    // id that means two things.
    const list = run(['review'], cwd).out;
    assert.match(list, phrase('also carry a pending revision'));
    assert.match(list, new RegExp(DRAFT));
    assert.match(run(['review', '--full'], cwd).out, new RegExp(`${rev}\\) — promoting this draft`));

    // Promoting the DRAFT promotes the draft. It applies no revision, says so
    // before the confirmation, and leaves the proposal pending.
    const promoted = run(['review', 'promote', DRAFT, '--yes'], cwd);
    assert.equal(promoted.code, 0);
    assert.match(promoted.out, phrase('neither applies nor discards it'));
    assert.ok(promoted.out.indexOf('pending revision') < promoted.out.indexOf('about to promote'));
    assert.match(itemText(cwd, DRAFT, 'rule'), /status: active/);
    assert.doesNotMatch(itemText(cwd, DRAFT, 'rule'), /first segment/);
    assert.match(run(['review', 'revisions'], cwd).out, new RegExp(rev));
  });
});

// --- argument handling ------------------------------------------------------

test('the revision subcommands refuse an unknown flag and require an id', () => {
  withProject((cwd) => {
    for (const args of [
      ['review', 'revisions', '--ful'],
      ['review', 'promote-revision', RULE, '--forse', '--yes'],
      ['review', 'discard-revision', RULE, '--resaon', 'x', '--yes'],
    ]) {
      const { code, out } = run(args, cwd);
      assert.equal(code, 1, args.join(' '));
      assert.match(out, /unknown option/, args.join(' '));
    }
    for (const sub of ['promote-revision', 'discard-revision']) {
      const { code, out } = run(['review', sub], cwd);
      assert.equal(code, 1);
      assert.match(out, /usage: mycontext review/);
    }
  });
});

test('an item with nothing pending is told so, not shown an empty queue', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'promote-revision', RULE, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase('no revision is pending for'));
    assert.match(out, phrase('Nothing has ever been staged against it'));
  });
});

// --- the counts -------------------------------------------------------------

/**
 * **One assertion over every surface that reports this queue's length.**
 *
 * Enumerated in one place and checked in one comparison, because a surface
 * checked in a test of its own is a surface excluded from the agreement — this
 * project proved that when a per-preview test stayed green on a mutant that
 * made one preview disagree, and `status` and `review` disagreeing about a
 * queue length is the defect that shipped five times in one plan.
 *
 * The corpus is deliberately three revisions on two items, so the two numbers
 * that could be meant by "pending revisions" are DIFFERENT: a surface that
 * counted items rather than revisions would report 2 here and fail, where on
 * one-revision-per-item data every wrong spelling agrees with every right one.
 */
test('every surface reports the same number of pending revisions', () => {
  withProject((cwd) => {
    seedDraft(cwd);
    stageIn(cwd, RULE, { body: NEW_BODY });
    stageIn(cwd, RULE, { title: 'Never log any customer email' });
    stageIn(cwd, DRAFT, { body: 'Every cache key carries the tenant id, first segment.' });

    const textSurfaces = [
      ['review'], ['review', '--full'], ['review', '--summary'],
      ['review', 'revisions'], ['review', 'revisions', '--full'],
      ['review', 'revisions', '--summary'], ['review', 'revisions', RULE],
      ['status'], ['status', '--full'], ['status', '--summary'],
    ];
    const jsonSurfaces = [['review', '--json'], ['review', 'revisions', '--json'], ['status', '--json']];

    const reported = new Map<string, number>();
    for (const args of textSurfaces) {
      const { out } = run(args, cwd);
      const match = /(\d+) pending revision\(s\)/.exec(out);
      assert.ok(match, `\`${args.join(' ')}\` reports no count at all:\n${out}`);
      reported.set(args.join(' '), Number(match[1]));
    }
    for (const args of jsonSurfaces) {
      const doc = JSON.parse(run(args, cwd).out);
      assert.ok(doc.pendingRevisions, `\`${args.join(' ')}\` carries no pendingRevisions field`);
      reported.set(args.join(' '), doc.pendingRevisions.revisions);
    }

    assert.deepEqual(
      [...new Set(reported.values())], [3],
      `surfaces disagree about the pending-revision count: ${JSON.stringify([...reported])}`,
    );
    // The premise: the wrong spelling is a different number here.
    for (const args of jsonSurfaces) {
      assert.equal(JSON.parse(run(args, cwd).out).pendingRevisions.items, 2);
    }
  });
});

/**
 * 1C.1 — `review revisions <typo>` used to state a falsehood.
 *
 * It printed "no revision is pending for TYPO-does-not-exist" followed by the
 * workspace-wide "0 pending revision(s) on 0 item(s) — nothing is waiting for a
 * human here" and exited 0, having never checked that the item exists. That is
 * the silent-empty-answer class Wave 1 fixed for `mycontext list`, on a surface
 * that additionally asserts the queue was checked.
 */
test('review revisions refuses an id no item and no revision has ever had', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });

    const { code, out } = run(['review', 'revisions', 'RULE-does-not-exist'], cwd);
    assert.equal(code, 1, `a nonexistent id must not exit 0:\n${out}`);
    assert.match(out, phrase('no item with id "RULE-does-not-exist"'));
    // The two sentences that made the old answer a falsehood rather than a
    // silence. Both must be gone, not merely one.
    assert.doesNotMatch(out, phrase('no revision is pending for'));
    assert.doesNotMatch(out, phrase('nothing is waiting for a human here'));
    assert.doesNotMatch(out, /pending revision\(s\)/);
  });
});

/** The closest match is what makes the refusal actionable on a real typo. */
test('review revisions names the closest id on a misspelling', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'revisions', 'RULE-do-not-log-customer-emial'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase(`The closest match is "${RULE}"`));
  });
});

/** --json takes the same refusal: a script must not read `revisions: []` for
 * an id that does not exist and conclude the queue is empty. */
test('review revisions --json refuses an unknown id rather than emitting an empty queue', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'revisions', 'RULE-nope', '--json'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase('no item with id "RULE-nope"'));
    assert.doesNotMatch(out, /"pendingRevisions"/);
  });
});

/**
 * The refusal is bounded by existence, not by the queue: a real item with
 * nothing pending is a real question with a real empty answer, and still gets
 * one.
 */
test('review revisions still answers for a real item with no pending revision', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'revisions', RULE], cwd);
    assert.equal(code, 0, out);
    assert.match(out, phrase(`no revision is pending for ${RULE}`));
  });
});

/**
 * A revision outlives its item — `decorate` (revision.ts) carries an
 * `itemMissing` branch for exactly that — so an id with revision history and no
 * item is answerable and must NOT be refused as a typo.
 */
test('review revisions answers for an id whose item is gone but whose revision is not', () => {
  withProject((cwd) => {
    stageIn(cwd, RULE, { body: NEW_BODY });
    rmSync(path.join(cwd, '.my_context', 'items', 'rule', `${RULE}.md`));

    const { code, out } = run(['review', 'revisions', RULE], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, phrase('no item with id'));
    assert.match(out, /pending revision\(s\)/);
  });
});

/**
 * The EMPTY queue is reported through `pendingRevisionLine` like every other
 * queue, and this asserts the identity rather than the words.
 *
 * `review revisions` used to spell "0 pending revision(s) on 0 item(s)" itself.
 * That could not print a wrong number — it is behind a length check — but it
 * made `pendingRevisionLine`'s own contract false ("every surface prints this
 * sentence rather than a wording of its own") about the one template that
 * function exists to own, and the count template's shape was therefore typed in
 * two files. Comparing against the function's output rather than against a
 * string is what makes this a pin on the single source: a second copy anywhere
 * fails here the moment the wording moves.
 */
test('an empty revision queue is reported in the words pendingRevisionLine chooses', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'revisions'], cwd);
    assert.equal(code, 0);
    assert.match(out, phrase(pendingRevisionLine([])),
      'the empty-queue sentence must come from core/revision.ts, not from review.ts');
  });
});
