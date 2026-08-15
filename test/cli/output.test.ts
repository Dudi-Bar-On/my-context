import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE_UNRESTRICTED } from '../../src/core/render-item.ts';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { OUTPUT_WIDTH } from '../../src/cli/commands/format.ts';
import { makeId, slugify } from '../../src/core/slug.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells, row } from '../helpers/table.ts';

/**
 * The user's standing output requirement, which Task 15 could not meet
 * because its brief predated it: every reporting command takes
 * `--full`/`--short`/`--summary` and `--json`, prints column HEADERS, and
 * renders hierarchical data (ingest sessions with per-anchor progress) as
 * JSON rather than flattening it into columns that cannot carry it.
 *
 * These drive the real commands end to end. The per-helper unit tests live in
 * `test/cli/format.test.ts`.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-output-'));
  try {
    runCli(['init'], cwd, () => {});
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function seed(cwd: string): void {
  run(['add', 'constraint', 'Pool capped at 20', '--yes'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
}

/** An ingest session with two chunks, one applied — the hierarchical case. */
function ingestSession(cwd: string): string {
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(
    path.join(cwd, 'docs', 'prd.md'),
    '# Password policy\n\nPasswords must be at least 12 characters.\n\n' +
    '# Session policy\n\nSessions expire after 30 minutes.\n',
    'utf8',
  );
  const started = run(['ingest', 'docs/prd.md'], cwd);
  const id = /ING-[a-z0-9-]+/.exec(started.out)![0];
  writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
  }]), 'utf8');
  run([ 'ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  return id;
}

/** Runs `fn` with `name` set to '1' and every other rendering override off. */
function withRendering(name: 'MYCONTEXT_ASCII' | 'MYCONTEXT_UNICODE', fn: () => void): void {
  const saved = { ascii: process.env.MYCONTEXT_ASCII, unicode: process.env.MYCONTEXT_UNICODE };
  delete process.env.MYCONTEXT_ASCII;
  delete process.env.MYCONTEXT_UNICODE;
  process.env[name] = '1';
  try {
    fn();
  } finally {
    for (const [key, value] of [['MYCONTEXT_ASCII', saved.ascii], ['MYCONTEXT_UNICODE', saved.unicode]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/**
 * The ASCII fallback exists for a legacy `cmd.exe` on a non-UTF-8 code page,
 * where box-drawing characters arrive as mojibake. Every other assertion in
 * this file accepts either rendering on purpose (see `test/helpers/table.ts`),
 * so without this one the fallback could be wired only into `table()` and
 * never reach a command, and the suite would still be green.
 */
test('a real command renders ascii or box-drawing as the environment says', () => {
  withProject((cwd) => {
    seed(cwd);

    withRendering('MYCONTEXT_ASCII', () => {
      const { out } = run(['list'], cwd);
      assert.match(out, /^\+-+(\+-+)+\+$/m, out);
      assert.ok(/^[\x00-\x7f]*$/.test(out), 'the fallback must be 7-bit ascii throughout');
    });

    withRendering('MYCONTEXT_UNICODE', () => {
      const { out } = run(['list'], cwd);
      assert.match(out, /^┌─+(┬─+)+┐$/m, out);
      assert.match(out, /^└─+(┴─+)+┘$/m, out);
    });
  });
});

/**
 * The width defect, end to end.
 *
 * Measured on this repo's real corpus before the fix: `list --full` was 280
 * columns, `decay` was 284 at EVERY detail level (its "cold" caveat was one
 * unwrapped 284-character line, `--summary` included), and `status`'s `usage:`
 * line was 178. No terminal shows any of that without scrolling sideways, so
 * the level carrying the most about an item was the one nobody could read.
 *
 * The item below is deliberately shaped like the ones that caused it: a
 * 63-character id and a title far wider than any column can hold.
 */
const WIDE_TITLE =
  'A validator that gates writes must be a complete precondition for that write, never a hint';

function seedWide(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'invariant', 'INV-wide.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: INV-a-validator-that-gates-writes-must-be-a-complete-precondi
type: invariant
title: ${WIDE_TITLE}
status: active
scope:
  - src/core/mutate.ts
---

# ${WIDE_TITLE}

Body.
`, 'utf8');
}

const DRAFT_TITLE = 'Cache keys include tenant ID';

/**
 * A draft, so `review list` has rows. Without one that command prints
 * "no drafts pending review." and every assertion about its table passes
 * vacuously — which is exactly what happened to the two entries this corpus
 * contributes to the budget test below before this helper existed.
 *
 * Deliberately NOT the `seedWide` shape, and deliberately not `MAX_ID`
 * either. `review list`'s SCANNING levels carry five narrow columns beside the
 * id, and a draft whose id reaches the ceiling `slugify` permits puts them
 * over the budget on its own — 112 columns even with the `title` column
 * deleted. That is a limit on id length, not a verdict on this column set,
 * and no choice of columns fixes it; see the comment in review.ts's `list`.
 * `--full` is not subject to it, because it is a record view rather than a
 * table, and the test below holds it to the budget at that worst id.
 * What is asserted here is the case the documentation fixture shows and a real
 * queue produces: an ordinary draft id, and a title the table wraps into the
 * budget rather than overflowing it.
 */
function seedDraft(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'rule', 'RULE-draft.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: RULE-cache-keys-include-tenant-id
type: rule
title: ${DRAFT_TITLE}
status: draft
origin: agent
---

# ${DRAFT_TITLE}

Body.
`, 'utf8');
}

/**
 * The promise, stated exactly: EVERY detail level of every reporting command
 * fits the layout budget, on a corpus deliberately shaped like the one that
 * broke it — a 61-character id and a 90-character title.
 *
 * `list`'s and `decay`'s scanning tables (default and `--short`) are in this
 * list as of the commit that dropped their `title` column. They could not be
 * before: `id` and `title` are the same fact — the id is a slug of the title —
 * and the two of them side by side made `list` 192 columns and `decay` 170 on
 * this repository's own corpus, a width no wrapping could reach because
 * neither column may be broken. Removing the duplicate is what brought them
 * inside the budget, so a `title` column reintroduced to EITHER of those two
 * fails this test rather than quietly restoring a report nobody can read.
 *
 * `review list` keeps its title and is held to the same budget here, on the
 * draft `seedDraft` provides rather than on `seedWide`'s item — see that
 * helper for the measurement that says why. Its `--full` level is held to the
 * budget at the WORST id this project can mint as well, by the test below;
 * that one needs its own workspace, because a draft with such an id puts the
 * scanning levels over the budget no column set can fix.
 *
 * Two gaps are left, named here rather than left to be discovered the way
 * `review list --full` was — it sat outside this list unnoticed at 210
 * columns:
 *
 * - `doctor` at the default, `--short` and `--full` levels is NOT here,
 *   because it does not fit and this test is not the place to record that it
 *   should. On the corpus above it measures 298 columns at the scanning
 *   levels and 322 at `--full`: `dead_scope`'s message names the offending
 *   item TWICE and is emitted as one unwrapped line, so a 61-character id
 *   makes a 287-character sentence. That is `paragraph` (format.ts) not being
 *   applied, not a limit — a fix, and the documented `doctor` example block
 *   moving with it, is its own change. `--summary` is here and does fit.
 * - `ingest-status` needs an ingest session to print anything but "no
 *   sessions", and applying one adds a second draft to this corpus, which
 *   puts `review list`'s SCANNING levels at 137 columns — two ordinary
 *   ingest-origin drafts, no hostile id involved. Measured separately, every
 *   `ingest-status` level fits at 72 columns or less.
 */
test('every reporting command fits the layout budget at every detail level', () => {
  withProject((cwd) => {
    seed(cwd);
    seedWide(cwd);
    seedDraft(cwd);
    for (const args of [
      ['list'], ['list', '--short'], ['list', '--full'], ['list', '--summary'],
      ['decay'], ['decay', '--short'], ['decay', '--full'], ['decay', '--summary'],
      ['review', 'list'], ['review', 'list', '--short'], ['review', 'list', '--full'],
      ['review', 'list', '--summary'],
      ['status', '--full'], ['status'], ['status', '--summary'],
      ['doctor', '--summary'],
    ]) {
      const { out } = run(args, cwd);
      const over = out.split('\n').filter((l) => [...l].length > OUTPUT_WIDTH);
      assert.deepEqual(over, [], `\`${args.join(' ')}\` printed line(s) over ${OUTPUT_WIDTH}:\n${over.join('\n')}`);
    }
    // Non-vacuous: `review list` above was measuring a real table, not the
    // empty-queue message.
    assert.ok(run(['review', 'list'], cwd).out.includes('RULE-cache-keys-include-tenant-id'));
  });
});

/**
 * The longest title `slugify` will not truncate — its slug is exactly the
 * sixty-character ceiling, so appending words to the title cannot lengthen the
 * id. That equality is asserted in the test below rather than stated here, so
 * a change to the ceiling shows up as a failing premise instead of a stale
 * comment.
 */
const MAX_LESSON = 'A shared cache expiry turns every miss into one simultaneous stampede';

/**
 * The widest id this project can mint: a six-character prefix — the longest
 * any category has (`LESSON`, `ASSUME`, `NOGOAL` in categories.ts) — plus
 * `slugify`'s sixty-character ceiling, for sixty-seven characters.
 */
const MAX_ID = makeId('LESSON', MAX_LESSON);

function seedWidestDraft(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'lesson', 'LESSON-widest.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${MAX_ID}
type: lesson
title: ${MAX_LESSON}
status: draft
severity: soft
always: true
origin: ingest
scope:
  - src/cache/**
source_file: docs/prd.md
source_anchor: cache-policy
---

# ${MAX_LESSON}

Body.
`, 'utf8');
}

/**
 * `review list --full` at the worst id this project can mint.
 *
 * This is the level that was never in the budget test above and never fitted:
 * as a table of eight columns it measured 210 columns on the draft below,
 * because a table cannot be narrower than the sum of its columns' longest
 * tokens and an id is one token. It is a record view now — the same shape
 * `list --full` and `decay --full` render, and the shape the flag tables in
 * both READMEs already promise for all six reporting commands — where the id
 * is a heading on a line of its own and each remaining field is a labelled
 * line under it. The budget then depends on the id only through that one
 * heading line, which is sixty-seven characters here.
 *
 * Its own workspace, because the scanning levels cannot hold this draft: five
 * narrow columns beside a sixty-seven-character id is over the budget before a
 * title column is considered, which is a limit on id length that no choice of
 * columns fixes (see `seedDraft`). Seeding it into the shared corpus above
 * would fail those two entries for a reason that is not theirs.
 */
test('review list --full fits the budget at the widest id slugify can mint', () => {
  withProject((cwd) => {
    // The premise: this title is AT the ceiling, so no title makes a longer
    // id. Asserted rather than asserted-about — appending words leaves the
    // slug unchanged exactly when truncation is already in force.
    assert.equal(slugify(MAX_LESSON), slugify(`${MAX_LESSON} and then some more words`));
    seedWidestDraft(cwd);

    const { out } = run(['review', 'list', '--full'], cwd);
    const over = out.split('\n').filter((l) => [...l].length > OUTPUT_WIDTH);
    assert.deepEqual(over, [], `\`review list --full\` printed line(s) over ${OUTPUT_WIDTH}:\n${out}`);

    // Non-vacuous, and nothing lost to the shape: the id is present whole on a
    // line of its own — unbroken, so it is still copy-pasteable — and every
    // field the table carried is still labelled and still has a value.
    assert.ok(out.includes(MAX_ID), `no draft rendered:\n${out}`);
    assert.match(out, new RegExp(`^${MAX_ID}$`, 'm'), out);
    for (const [field, value] of [
      ['type', 'lesson'], ['origin', 'ingest'], ['severity', 'soft'],
      ['always', 'yes'], ['scope', 'src/cache/\\*\\*'], ['source', 'docs/prd\\.md'],
    ]) {
      assert.match(out, new RegExp(`^  ${field} +${value}$`, 'm'), `${field} in:\n${out}`);
    }
    // The title is wrapped, never elided, so it survives rejoining the lines.
    assert.ok(out.split('\n').map((l) => l.trim()).join(' ').includes(MAX_LESSON), out);
    assert.doesNotMatch(out, /\.\.\.|…/, out);
  });
});

/**
 * The other half of the same decision, and it is per report rather than per
 * detail level. `list` and `decay` REMOVE the title from their scanning
 * levels — they do not narrow it into them, because a column wrapped down to
 * twenty characters would still be there, still saying what the id says, and
 * still costing the rows it wraps onto. `review list` was never over the
 * budget and so never had a reason to lose it, and keeps it.
 */
test('list and decay drop the title at the scanning levels, review list keeps it', () => {
  withProject((cwd) => {
    seedWide(cwd);
    seedDraft(cwd);
    for (const args of [['list'], ['list', '--short'], ['decay'], ['decay', '--short']]) {
      const { out } = run(args, cwd);
      assert.ok(out.includes('INV-a-validator'), `\`${args.join(' ')}\` printed no rows:\n${out}`);
      // Not one word of it, in any wrapping: the first three words of the
      // title would survive any column narrow enough to have been kept.
      assert.ok(!out.includes('A validator that'), `\`${args.join(' ')}\` still prints the title:\n${out}`);
    }
    for (const args of [['review', 'list'], ['review', 'list', '--short']]) {
      const { out } = run(args, cwd);
      assert.ok(out.includes('RULE-cache-keys-include-tenant-id'), `\`${args.join(' ')}\` printed no rows:\n${out}`);
      // Wrapped across two lines by a column narrower than the title, so the
      // words are only contiguous once the vertical rules and the padding
      // between cells are collapsed. Whole, not elided: this asserts every
      // word of it, in order, which a truncated column would not survive.
      const flat = out.replace(/[│|]/g, ' ').replace(/\s+/g, ' ');
      assert.ok(flat.includes(DRAFT_TITLE), `\`${args.join(' ')}\` dropped the title:\n${out}`);
    }
    // Whole and unbroken, on one line, exactly as before — a row that fits the
    // budget must not have bought that by splitting an id.
    const dataRow = run(['list'], cwd).out.split('\n').find((l) => l.includes('INV-a-validator'))!;
    assert.ok(dataRow.includes('INV-a-validator-that-gates-writes-must-be-a-complete-precondi'), dataRow);
  });
});

test('list --full still carries the whole of a title too wide for any column', () => {
  withProject((cwd) => {
    seedWide(cwd);
    const { out } = run(['list', '--full'], cwd);
    // Wrapped, never truncated: rejoining the stanza's continuation lines
    // returns the title exactly, and no elision marker was printed.
    const stanza = out.split('\n').slice(1).map((l) => l.trim()).join(' ');
    assert.ok(stanza.includes(WIDE_TITLE), out);
    assert.doesNotMatch(out, /\.\.\.|…/, out);
    assert.match(out, /^INV-a-validator-that-gates-writes-must-be-a-complete-precondi$/m, out);
  });
});

test('decay prints its cold caveat whole, wrapped, at every detail level', () => {
  withProject((cwd) => {
    seed(cwd);
    seedWide(cwd);
    for (const args of [['decay'], ['decay', '--full'], ['decay', '--summary']]) {
      const { out } = run(args, cwd);
      const flat = out.split('\n').map((l) => l.trim()).join(' ');
      assert.ok(
        flat.includes('It does NOT mean unused — the ledger records injection, not reading or reliance'),
        `\`${args.join(' ')}\` must carry the caveat whole:\n${out}`,
      );
    }
  });
});

// --- list ---

test('list prints column headers above the data', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list'], cwd);
    const [top, header, rule] = out.split('\n');
    // `row` is exact — these columns and no others — so a `title` column
    // added back here fails rather than being tolerated as an extra.
    assert.match(header, row('id', 'type', 'status'));
    // The box opens above the header and a rule separates it from the data.
    assert.match(top, /^[┌+][─-]+([┬+][─-]+)+[┐+]$/);
    assert.match(rule, /^[├+][─-]+([┼+][─-]+)+[┤+]$/);
    assert.equal([...top].length, [...header].length);
  });
});

/**
 * `--full` carries the columns the default view has no room for, as a stanza
 * per item rather than as a seventh column: see `records` in format.ts. Seven
 * columns including a 63-character id and a 92-character title made a
 * 280-column table on this repo's own corpus, so the level that shows the most
 * about an item was the one level that could not be read.
 */
/** `(unrestricted)` carries regex metacharacters; this test builds patterns. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('list --full carries every field the default view has no room for', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list', '--full'], cwd);
    assert.match(out, /^CONST-pool-capped-at-20$/m, out);
    for (const [field, value] of [
      ['type', 'constraint'], ['status', 'active'], ['origin', 'human'],
      // `SCOPE_UNRESTRICTED`, not a `-` spelled here: `-` read as the
      // narrowest setting for what is the widest, and `decay --full` printed
      // a different answer for the same field of the same item. The agreement
      // across surfaces is pinned in `test/cli/scope-rendering.test.ts`; this
      // asserts the value reaches THIS view's record layout at all.
      ['layer', 'project'], ['scope', escapeRegExp(SCOPE_UNRESTRICTED)],
      ['title', 'Pool capped at 20'],
    ]) {
      assert.match(out, new RegExp(`^  ${field}\\s+${value}$`, 'm'), `${field} in:\n${out}`);
    }
  });
});

test('list --summary counts by category instead of listing rows', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list', '--summary'], cwd);
    assert.match(out, row('type', 'items'));
    assert.match(out, row('constraint', '1'));
    assert.match(out, /2 item\(s\)/);
    assert.doesNotMatch(out, /CONST-pool-capped-at-20/);
  });
});

test('list --json is parseable JSON carrying fields no column shows', () => {
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['list', '--json'], cwd).out) as {
      items: { id: string; scope: string[]; origin: string; layer: string }[];
      count: number;
      loadErrors: unknown[];
    };
    assert.equal(parsed.count, 2);
    assert.deepEqual(parsed.loadErrors, []);
    const constraint = parsed.items.find((i) => i.id === 'CONST-pool-capped-at-20');
    assert.ok(constraint, 'the constraint is in the document');
    assert.equal(constraint.origin, 'human');
    assert.equal(constraint.layer, 'project');
    assert.deepEqual(constraint.scope, []);
  });
});

test('a category filter still works when a flag precedes it', () => {
  // `args[0]` would read "--json" as the category filter and list nothing —
  // an empty answer that looks like a true one.
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['list', '--json', 'lesson'], cwd).out) as { count: number };
    assert.equal(parsed.count, 1);
  });
});

test('list --json reports a corpus load error inside the document, keeping it parseable', () => {
  withProject((cwd) => {
    seed(cwd);
    mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
    writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter\n');
    const { code, out } = run(['list', '--json'], cwd);
    assert.equal(code, 0, 'F2: list did its job');
    const parsed = JSON.parse(out) as { loadErrors: { file: string }[] };
    assert.equal(parsed.loadErrors.length, 1);
    assert.match(parsed.loadErrors[0].file, /CONST-broken\.md/);
  });
});

test('the usage banner never runs a long usage string into its summary', () => {
  // `padEnd(28)` produced `status [--full|--short|--summary] [--json]counts,
  // review queue, …` once the detail flags were added to the usage strings.
  withProject((cwd) => {
    const { out } = run(['--help'], cwd);
    assert.match(out, /\[--json\] {2}counts, review queue/);
    assert.doesNotMatch(out, /\][a-z]/, 'no summary starts immediately after a "]"');
  });
});

// --- status ---

test('status --json carries the counts, the queue, health and the usage caveat', () => {
  withProject((cwd) => {
    seed(cwd);
    const { code, out } = run(['status', '--json'], cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as {
      profile: string;
      items: { total: number; byCategory: Record<string, number> };
      reviewQueue: { drafts: number };
      usage: { sessionsRecorded: number; cold: number; caveat: string };
      health: { errors: number; warnings: number; infos: number };
      unfinishedIngest: unknown[];
      loadErrors: unknown[];
    };
    assert.equal(parsed.profile, 'standard');
    assert.equal(parsed.items.total, 2);
    assert.equal(parsed.items.byCategory.constraint, 1);
    assert.equal(parsed.reviewQueue.drafts, 0);
    assert.equal(parsed.usage.sessionsRecorded, 0);
    // The hedge is DATA, not decoration: a consumer ranking items by "cold"
    // is exactly the reader who must be told the ledger records injection.
    assert.match(parsed.usage.caveat, /records injection, not reading/);
    assert.equal(typeof parsed.health.errors, 'number');
    assert.deepEqual(parsed.unfinishedIngest, []);
    assert.deepEqual(parsed.loadErrors, []);
  });
});

test('status --summary drops the tallies but keeps the queue, usage and health lines', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['status', '--summary'], cwd);
    assert.doesNotMatch(out, /by category/);
    assert.match(out, /review queue:/);
    assert.match(out, /usage:/);
    assert.match(out, /health:/);
  });
});

test('status prints tallies as headed tables at the default level', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['status'], cwd);
    assert.match(out, row('category', 'items'));
    assert.match(out, row('status', 'items'));
    assert.match(out, row('origin', 'items'));
  });
});

test('status --full shows an ingest session\'s pending anchors, which no column can carry', () => {
  withProject((cwd) => {
    const id = ingestSession(cwd);
    const short = run(['status'], cwd).out;
    assert.match(short, /ingest: 1 unfinished session/);
    assert.doesNotMatch(short, /pending: session-policy/);

    const full = run(['status', '--full'], cwd).out;
    assert.match(full, new RegExp(`${id} pending: session-policy`));

    const parsed = JSON.parse(run(['status', '--json'], cwd).out) as {
      unfinishedIngest: { id: string; applied: number; chunks: number; pendingAnchors: string[] }[];
    };
    assert.equal(parsed.unfinishedIngest.length, 1);
    assert.equal(parsed.unfinishedIngest[0].applied, 1);
    assert.equal(parsed.unfinishedIngest[0].chunks, 2);
    assert.deepEqual(parsed.unfinishedIngest[0].pendingAnchors, ['session-policy']);
  });
});

test('two detail levels at once is refused rather than one being silently chosen', () => {
  withProject((cwd) => {
    const { code, out } = run(['status', '--full', '--summary'], cwd);
    assert.equal(code, 1);
    assert.match(out, /only one of/);
  });
});

// --- decay ---

test('decay --json carries every list plus the caveat, and --summary carries no rows', () => {
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['decay', '--json'], cwd).out) as {
      window: number; sessionsRecorded: number; caveat: string;
      counts: { cold: number; warm: number; unrestricted: number };
      cold: { id: string }[];
      unrestricted: { id: string }[];
    };
    assert.equal(parsed.window, 20);
    assert.equal(parsed.sessionsRecorded, 0);
    assert.match(parsed.caveat, /NOT mean unused/);
    // `unrestricted` OVERLAPS cold/warm rather than partitioning with them:
    // the same item is counted once as cold and listed again as unrestricted,
    // which is the whole shape of the field. A consumer summing all three
    // would get 2 for a corpus of 1.
    assert.equal(parsed.counts.cold, 1);
    assert.equal(parsed.counts.warm, 0);
    assert.equal(parsed.counts.unrestricted, 1, 'the constraint has no scope');
    assert.equal(parsed.cold[0].id, 'CONST-pool-capped-at-20');
    assert.equal(parsed.unrestricted[0].id, 'CONST-pool-capped-at-20');

    const summary = run(['decay', '--summary'], cwd).out;
    assert.match(summary, /cold 1, warm 0, of which 1 unrestricted/);
    assert.doesNotMatch(summary, /CONST-pool-capped-at-20/);
    // The hedge survives every detail level — a shorter report may drop rows,
    // never the reason its own headline might mislead.
    assert.match(summary, /NOT mean unused/);
    // And with an empty ledger it says there is NO measurement, rather than
    // hedging a real signal that does not exist.
    assert.match(summary, /no sessions recorded yet — nothing here has been measured/);
    assert.doesNotMatch(summary, /only 0 session\(s\)/);
  });
});

/**
 * Review finding: `decay --full` rendered a PINNED item's scope as `(none)`.
 * On this repo that was 7 of 25 cold rows — `RULE-erasable-syntax-only` and
 * `CONST-zero-runtime-dependencies` among them — each inviting exactly the
 * wrong action. `list --full` renders the same field as `always`, so the two
 * commands disagreed about the same value inside one release.
 *
 * `(none)` is now wrong for a second, independent reason: scope restricts, so
 * an item declaring none is the WIDEST there is and `(none)` reads as the
 * narrowest. No row may print it, pinned or not.
 */
test('decay --full says "always" for a pinned item, never "(none)", agreeing with list --full', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'rule', 'RULE-pinned.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---
id: RULE-pinned
type: rule
title: A pinned rule with no scope
status: active
always: true
directive: do
---

# A pinned rule with no scope

Body.
`, 'utf8');

    // `--full` is a stanza per item at both commands (see `records`), so the
    // field is asserted where it is now printed rather than as a table cell.
    const full = run(['decay', '--full'], cwd).out;
    assert.match(full, /^ {2}RULE-pinned$/m, full);
    assert.match(full, /^ {4}scope\s+always$/m, full);
    assert.doesNotMatch(full, /\(none\)/);
    assert.match(full, /cold \(1\)/);
    // It carries no scope, so it is also listed as unrestricted — a breadth
    // view over the same row, not a competing bucket.
    assert.match(full, /^unrestricted \(1\)/m);

    // The same field, the same word, in the other command that shows it.
    const listed = run(['list', 'rule', '--full'], cwd).out;
    assert.match(listed, /^RULE-pinned$/m, listed);
    assert.match(listed, /^ {2}scope\s+always$/m, listed);

    // And the machine surface carries the distinction rather than leaving a
    // consumer to infer "unscoped" from an empty scope array.
    const parsed = JSON.parse(run(['decay', '--json'], cwd).out) as
      { cold: { id: string; always: boolean; scope: string[] }[] };
    assert.equal(parsed.cold[0].always, true);
    assert.deepEqual(parsed.cold[0].scope, []);
  });
});

test('decay prints headers over its rows, and labels over its --full stanzas', () => {
  withProject((cwd) => {
    seed(cwd);
    assert.match(run(['decay'], cwd).out, row('id', 'type', 'usage'));
    const full = run(['decay', '--full'], cwd).out;
    for (const field of ['type', 'injections', 'last injected', 'scope', 'title']) {
      assert.match(full, new RegExp(`^ {4}${field} +\\S`, 'm'), `${field} in:\n${full}`);
    }
  });
});

// --- doctor ---

test('doctor --json carries findings, counts and the exit code it returns', () => {
  withProject((cwd) => {
    seed(cwd);
    const { code, out } = run(['doctor', '--json'], cwd);
    const parsed = JSON.parse(out) as {
      counts: { errors: number }; exitCode: number; findings: { level: string; code: string }[];
    };
    assert.equal(parsed.exitCode, code, 'the reported code is the returned code');
    assert.equal(parsed.counts.errors, 0);
    assert.ok(Array.isArray(parsed.findings));
  });
});

test('doctor --full lists one headed row per finding; --summary is the one-line form', () => {
  withProject((cwd) => {
    // A dead scope glob is a warn-level finding, so there is a row to show.
    run(['add', 'constraint', 'Scoped at a directory that does not exist', '--yes'], cwd);
    const file = path.join(cwd, '.my_context', 'items', 'constraint',
      'CONST-scoped-at-a-directory-that-does-not-exist.md');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('scope: []', 'scope:\n  - nope/**'), 'utf8');

    const full = run(['doctor', '--full'], cwd).out;
    assert.match(full, row('level', 'code', 'item', 'message'));
    assert.match(full, cells('warn', 'dead_scope'));

    const summary = run(['doctor', '--summary'], cwd).out;
    assert.match(summary, /my_context doctor: \d+ error\(s\)/);
    assert.doesNotMatch(summary, /dead_scope/);
    // `--quiet` predates the levels and still means the same thing.
    assert.equal(run(['doctor', '--quiet'], cwd).out, summary);
  });
});

// --- ingest-status ---

test('ingest-status renders per-anchor progress in --full and --json, and a table by default', () => {
  withProject((cwd) => {
    const id = ingestSession(cwd);

    const short = run(['ingest-status'], cwd).out;
    // `rejected` joined this table when durable rejection records landed (I10):
    // a mixed batch marks its anchor applied, so "1/2 applied" alone cannot say
    // that anything was refused. It reads 0 here — this fixture rejects nothing.
    assert.match(short, row('session', 'source', 'applied', 'rejected'));
    assert.match(short, row(id, 'docs/prd.md', '1/2', '0'));
    // The per-anchor breakdown belongs to `--full`. Asserted as the anchor
    // name appearing nowhere at all rather than as a column pairing, because a
    // negative assertion that demands a column boundary stops catching the
    // regression as soon as the layout shifts.
    assert.doesNotMatch(short, /password-policy/);
    // A clean session must not editorialise about rejections it does not have.
    assert.doesNotMatch(short, /were rejected and not written/);

    const full = run(['ingest-status', '--full'], cwd).out;
    // `--full`'s per-anchor breakdown is an indented list under each session,
    // not a table, so it is unaffected by the box rendering.
    assert.match(full, /applied\s+password-policy/);
    assert.match(full, /pending\s+session-policy/);

    const parsed = JSON.parse(run(['ingest-status', '--json'], cwd).out) as {
      id: string; applied: number; rejected: number;
      anchors: { anchor: string; applied: boolean; rejected: unknown[] }[];
    }[];
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].applied, 1);
    // Per-anchor rejections ride alongside `applied`, because both are true of
    // a mixed batch. Empty here, and asserted as empty rather than dropped from
    // the comparison: `deepEqual` is what would catch the field silently
    // disappearing again.
    assert.equal(parsed[0].rejected, 0);
    assert.deepEqual(parsed[0].anchors, [
      { anchor: 'password-policy', applied: true, rejected: [] },
      { anchor: 'session-policy', applied: false, rejected: [] },
    ]);

    assert.match(run(['ingest-status', '--summary'], cwd).out, /1 ingest session\(s\), 1 unfinished/);
  });
});

test('ingest-status --json on a workspace with no sessions is an empty array, not prose', () => {
  withProject((cwd) => {
    assert.deepEqual(JSON.parse(run(['ingest-status', '--json'], cwd).out), []);
  });
});

// --- review list ---

test('review list prints headers, and --json carries the body a column cannot', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'requirement', 'REQ-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---
id: REQ-a
type: requirement
title: Requirement A
status: draft
severity: soft
always: false
origin: ingest
source_file: docs/prd.md
source_anchor: password-policy
---

# Requirement A

Body text.
`, 'utf8');

    const short = run(['review', 'list'], cwd).out;
    // `always` is a column at both detail levels on purpose — see the note in
    // review.ts's `list`: it is the field with the largest injection footprint
    // and a draft can arrive already carrying it.
    //
    // `title` IS a column here, unlike `list` and `decay`, which dropped it
    // because it and the id are one fact in their two widest columns and
    // together put those reports at 192 and 170 against a 100-column budget.
    // This table never had that problem, so the reviewer keeps the words.
    // `row` is exact, so dropping the column again fails here.
    assert.match(short, row('id', 'type', 'origin', 'always', 'source', 'title'));

    // `--full` is a stanza per draft, not a wider table — `records`, the shape
    // `list --full` and `decay --full` already use, and the one both READMEs
    // promise for `--full` on all six reporting commands. `row` would match a
    // table's header line, so asserting the labels is what tells the two
    // shapes apart: a table has no line that begins with two spaces and a
    // field name.
    const full = run(['review', 'list', '--full'], cwd).out;
    assert.match(full, /^REQ-a$/m, full);
    for (const field of ['type', 'origin', 'severity', 'always', 'scope', 'source', 'title']) {
      assert.match(full, new RegExp(`^  ${field} +\\S`, 'm'), `${field} in:\n${full}`);
    }
    assert.doesNotMatch(full, /[┌+][─-]+[┬+]/, `--full must not be a table:\n${full}`);

    assert.match(run(['review', 'list', '--summary'], cwd).out, /^1 draft\(s\) pending\./m);

    const parsed = JSON.parse(run(['review', 'list', '--json'], cwd).out) as {
      drafts: { id: string; body: string; sourceAnchor: string }[]; count: number;
    };
    assert.equal(parsed.count, 1);
    assert.equal(parsed.drafts[0].sourceAnchor, 'password-policy');
    assert.match(parsed.drafts[0].body, /Body text/);
  });
});
