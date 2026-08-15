import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells, firstCell, row } from '../helpers/table.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-lesson-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/** Every test runs inside this so a FAILING assertion still removes its temp
 * project — a bare `rmSync` at the end of a test body only runs when every
 * assertion above it passed, and one red test then leaks its directory into
 * the OS temp dir for good. The same helper `test/cli/review.test.ts` uses. */
function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

const CANDIDATES = JSON.stringify([
  { title: 'Run schema migrations outside peak traffic hours', directive: 'do', body: 'An ACCESS EXCLUSIVE lock queues writes.', scope: ['migrations/**'] },
  { title: 'Never deploy a migration on a Friday', directive: 'dont', body: 'Nobody is available to roll it back.' },
]);

function stage(cwd: string): { lessonId: string; keys: string[] } {
  const created = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
  const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  const keys = [...staged.out.matchAll(firstCell('[0-9a-f]{8}', 'gm'))].map((m) => m[1]);
  assert.equal(keys.length, 2, `expected 2 staged keys, output was:\n${staged.out}`);
  return { lessonId, keys };
}

/** The staging file `lesson-stage` wrote, so a test can corrupt it the way
 * anything else with write access to the workspace could. */
function stagingFile(cwd: string, lessonId: string): string {
  return path.join(cwd, '.my_context', '.staging', `${lessonId}.json`);
}

test('lesson records the lesson and prints a derivation request', () => {
  withProject((cwd) => {
    const { code, out } = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
    assert.equal(code, 0);
    assert.match(out, /LESSON-migrations-deadlock-when-run-during-peak-traffic/);
    assert.match(out, /RULE DERIVATION REQUEST/);
  });
});

test('the recorded lesson is active but rationale — indexed, never injected', () => {
  withProject((cwd) => {
    run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    assert.match(run(['list'], cwd).out,
      cells('LESSON-migrations-deadlock-during-peak-traffic', 'lesson', 'active'));
  });
});

test('lesson with an existing id re-derives without creating a duplicate', () => {
  withProject((cwd) => {
    const first = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    const id = /LESSON-[a-z0-9-]+/.exec(first.out)![0];
    const again = run(['lesson', id], cwd);
    assert.equal(again.code, 0);
    assert.match(again.out, /RULE DERIVATION REQUEST/);
    // `list --json`, not a line count: the text table now has a header row.
    assert.equal((JSON.parse(run(['list', 'lesson', '--json'], cwd).out) as { count: number }).count, 1);
  });
});

test('lesson with no argument prints usage', () => {
  withProject((cwd) => {
    const { code, out } = run(['lesson'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext lesson/);
  });
});

test('lesson-stage lists the staged candidates with their keys and creates no rules', () => {
  withProject((cwd) => {
    const { keys } = stage(cwd);
    assert.equal(keys.length, 2);
    const listed = run(['list', 'rule'], cwd).out.trim();
    // `0 item(s)`, not `''`: an empty list now says so out loud (see cmdList).
    assert.equal(listed, '0 item(s)', `no rule may exist before acceptance, got:\n${listed}`);
  });
});

// The shared `table`/`col` helpers, not hand-rolled `padEnd` widths: a header
// row is the visible evidence the helper is in use, and a title far wider
// than any hardcoded width must still start after its own column, not be
// truncated into it.
test('lesson-stage prints a real table — headed, and not collided by a long title', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Deploys are risky'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    const longTitle = 'Run every schema migration through the staged rollout checklist before it reaches production';
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: longTitle, directive: 'do', body: 'b' },
      { title: 'Short one', directive: 'dont', body: 'b' },
    ]), 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, row('key', 'directive', 'title'), `expected a table header, got:\n${out}`);
    assert.match(out, /^\s{2}[├+][─-]{3,}([┼+][─-]{3,})+[┤+]$/m,
      `expected a rule under the header, got:\n${out}`);
    // Both data rows put the directive in the same column as the header's.
    const lines = out.split('\n');
    const header = lines.find((l) => row('key', 'directive', 'title').test(l))!;
    const at = header.indexOf('directive');

    // The long title is printed WHOLE. It is no longer contiguous — `table`
    // wraps a cell that will not fit the layout budget (format.ts) — so the
    // assertion rejoins the title column across its continuation lines rather
    // than looking for the string. Wrapping is not truncation, and the
    // difference is exactly that this join comes back complete.
    const titleAt = header.indexOf('title');
    const titleColumn = lines
      .filter((l) => /^\s*[│|]/.test(l))
      .map((l) => l.slice(titleAt, l.lastIndexOf(l.includes('│') ? '│' : '|')).trim())
      .filter((s) => s !== '' && s !== 'title')
      .join(' ');
    assert.ok(
      titleColumn.includes(longTitle),
      `the long title must survive whole, wrapped or not; the title column held:\n${titleColumn}`,
    );
    for (const line of lines.filter((l) => firstCell('[0-9a-f]{8}').test(l))) {
      assert.match(line.slice(at), /^(do|dont)\s/, `directive column misaligned in row: "${line}"`);
    }
  });
});

test('lesson-stage reports rejected candidates without discarding the good ones', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Deploys are risky'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Good rule', directive: 'do', body: 'b' },
      { title: 'Bad rule', directive: 'maybe', body: 'b' },
    ]), 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 0);
    assert.match(out, /1 candidate rejected/);
    assert.match(out, /Bad rule/);
    assert.match(out, /Good rule/);
  });
});

// I6 at the CLI: a scope or body the model asserted and this tool threw away
// used to be reported as ZERO issues, and `lesson-accept` then printed
// "scope: (none — matches every scope check)" for a candidate whose author
// named real directories.
test('lesson-stage rejects a string scope by name instead of staging it as unscoped', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Deploys are risky'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Scoped rule', directive: 'do', body: 'b', scope: 'migrations/**' },
    ]), 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 0);
    assert.match(out, /0 rule candidate\(s\) staged/);
    assert.match(out, /1 candidate rejected/);
    assert.match(out, /"scope" must be an array/);
    assert.doesNotMatch(out, /^\s*[│|]?\s*[0-9a-f]{8}\s/m,
      'nothing may be staged from a candidate whose scope was rejected');
  });
});

test('lesson-stage rejects a candidate with no body — the schema declares it required', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Deploys are risky'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Bodyless rule', directive: 'do' },
    ]), 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 0);
    assert.match(out, /0 rule candidate\(s\) staged/);
    assert.match(out, /"body" is required/);
  });
});

test('re-staging says which pending candidates it dropped', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    writeFileSync(path.join(cwd, 'r2.json'), JSON.stringify([
      { title: 'Run schema migrations outside peak traffic hours', directive: 'do', body: 'An ACCESS EXCLUSIVE lock queues writes.', scope: ['migrations/**'] },
    ]), 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r2.json'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /1 previously pending candidate\(s\) dropped/);
    assert.match(out, new RegExp(keys[1]), 'the dropped candidate is named by its key');
    assert.match(out, /Never deploy a migration on a Friday/);
  });
});

test('lesson-accept creates exactly the accepted rule, with derived_from', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[1]], cwd);
    assert.equal(code, 0);
    assert.match(out, /RULE-never-deploy-a-migration-on-a-friday/);

    assert.equal((JSON.parse(run(['list', 'rule', '--json'], cwd).out) as { count: number }).count, 1);
    const shown = run(['show', 'RULE-never-deploy-a-migration-on-a-friday'], cwd).out;
    assert.match(shown, /directive: dont/);
    assert.match(shown, new RegExp(`derived_from \\[\\[${lessonId}\\]\\]`));
  });
});

test('lesson-accept honours --title and --scope edits', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    run(['lesson-accept', lessonId, keys[0], '--title', 'Run migrations between 02:00 and 05:00 UTC', '--scope', 'migrations/**,ops/**'], cwd);
    const shown = run(['show', 'RULE-run-migrations-between-02-00-and-05-00-utc'], cwd).out;
    // Unquoted: serializeFrontmatter's NEEDS_QUOTES fires on leading/trailing
    // whitespace, `:`, `#`, and a leading `-`/`[`/`{` — never on `/` or `*` — so
    // a scope glob renders as `  - migrations/**`. Plan 1's round-trip tests pin
    // that output; the assertion is what was wrong here, not the serializer.
    assert.match(shown, /^\s+- migrations\/\*\*$/m);
    assert.match(shown, /^\s+- ops\/\*\*$/m);
  });
});

test('lesson-discard removes a candidate from consideration permanently', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    assert.equal(run(['lesson-discard', lessonId, keys[0]], cwd).code, 0);
    const { code, out } = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.equal(code, 1);
    assert.match(out, /discarded/i);
    assert.equal(run(['list', 'rule'], cwd).out.trim(), '0 item(s)');
  });
});

test('lesson-accept on a lesson with no staging explains the next step', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Something happened'], cwd);
    const id = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    const { code, out } = run(['lesson-accept', id, 'deadbeef'], cwd);
    assert.equal(code, 1);
    assert.match(out, /nothing staged/);
    assert.match(out, /lesson-stage/);
  });
});

// I7 — the other half of the branch above. A staging file that exists but
// cannot be parsed is NOT "nothing staged": telling the user to run
// `lesson-stage` would steer them into an overwrite of working state that
// may record an earlier discard, and `lesson-stage` refuses that case anyway,
// so the advice would also be false.
test('lesson-accept on a CORRUPT staging file names the file rather than claiming nothing is staged', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const file = stagingFile(cwd, lessonId);
    writeFileSync(file, '{ this is not json', 'utf8');

    const { code, out } = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.equal(code, 1);
    assert.doesNotMatch(out, /nothing staged/i);
    assert.match(out, /cannot be trusted/i);
    assert.match(out, /not valid JSON/i);
    assert.ok(out.includes(path.join('.staging', `${lessonId}.json`)), `the message must name the file, got:\n${out}`);
    assert.equal(run(['list', 'rule'], cwd).out.trim(), '0 item(s)');
  });
});

test('lesson-stage refuses to overwrite a corrupt staging file and leaves it untouched', () => {
  withProject((cwd) => {
    const { lessonId } = stage(cwd);
    const file = stagingFile(cwd, lessonId);
    const corrupt = '{ this is not json';
    writeFileSync(file, corrupt, 'utf8');

    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /cannot be trusted/i);
    assert.equal(readFileSync(file, 'utf8'), corrupt);
  });
});

// The resurrection this pair of defects produced, end to end: discard a
// candidate, corrupt the staging file, re-stage. Before the fix,
// `stageRuleCandidates` read the corrupt file's `null` as "nothing staged
// yet" and wrote a fresh file in which the DISCARDED candidate was pending
// and acceptable again — the reset button silently un-rejecting a rule on the
// approval gate.
test('a discarded candidate does not come back acceptable when staging is corrupted and re-staged', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    assert.equal(run(['lesson-discard', lessonId, keys[0]], cwd).code, 0);

    writeFileSync(stagingFile(cwd, lessonId), '{ corrupted', 'utf8');
    const restage = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(restage.code, 1, `re-staging over corrupt working state must be refused, got:\n${restage.out}`);

    const accept = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.equal(accept.code, 1);
    assert.doesNotMatch(accept.out, /about to create this rule/);
    assert.equal(run(['list', 'rule'], cwd).out.trim(), '0 item(s)', 'no rule may exist from a discarded candidate');
  });
});

test('lesson-accept with an unknown key lists the real ones', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, 'ffffffff'], cwd);
    assert.equal(code, 1);
    assert.match(out, new RegExp(keys[0]));
  });
});

// `stagingFile` refuses an id that is not a legal filename component. That
// throw used to escape `cmdLessonAccept` uncaught, because the peek at
// staging sat outside its try/catch.
test('lesson-accept with a path-separator lesson id fails with a message, not an uncaught throw', () => {
  withProject((cwd) => {
    const { code, out } = run(['lesson-accept', '../../evil', 'deadbeef'], cwd);
    assert.equal(code, 1);
    assert.match(out, /not a valid lesson id/i);
  });
});

/** Plants a corrupt, unrelated item file so `openMutateContext`'s rebuild
 * reports a load error that has nothing to do with the command under test —
 * the same fixture `test/cli/ingest.test.ts` uses for the identical F2
 * assertion on `ingest-apply`. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

// F2 (context.ts's doc comment on openMutateContext, and the identical rule
// already pinned for ingest-apply): a command that did what it was asked
// reports an unrelated corpus load error as a WARNING and still exits 0 —
// only `status`/`doctor` exit non-zero on one. `lesson-accept` matters most
// of the three: it performs a real, persisted mutation (creates the rule,
// writes the accepted state to staging) before this exit code is decided, so
// exiting 1 here would report failure AFTER a committed effect.
test('lesson reports an unrelated corrupt item as a warning but still exits 0', () => {
  withProject((cwd) => {
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    assert.equal(code, 0, 'lesson recorded the item and printed the request; the unrelated corpus problem is a warning');
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
    assert.match(out, /RULE DERIVATION REQUEST/);
  });
});

test('lesson-stage reports an unrelated corrupt item as a warning but still exits 0', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    plantUnrelatedCorruptItem(cwd);
    writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
    const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(code, 0, 'lesson-stage staged the candidates; the unrelated corpus problem is a warning');
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  });
});

test('lesson-accept persists the rule and reports an unrelated corrupt item as a warning, exiting 0', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[1]], cwd);
    assert.equal(code, 0, 'lesson-accept created the rule; the unrelated corpus problem is a warning, not a failure');
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
    assert.match(out, /RULE-never-deploy-a-migration-on-a-friday/);
    // The mutation really did persist — this must not be a "reported success,
    // dropped the effect" situation either. `list` reports the SAME unrelated
    // load error itself (F2 applies there too), so only count actual item
    // lines, not the trailing `my_context: error ...` line.
    const rules = run(['list', 'rule'], cwd).out.trim().split('\n')
      .filter((line) => firstCell('RULE-[a-z0-9-]+').test(line));
    assert.equal(rules.length, 1);
  });
});

// Constraint 2 (task-9-brief.md): lesson-accept must print the candidate's
// full title, body, directive, scope and severity before creating it — and
// it must print the EDITED values that will actually be created, not the
// pre-edit staged ones. Asserting only that a "created ..." line appears
// somewhere does not pin this: deleting the whole print block, printing only
// a header with no field values, or printing the pre-edit candidate while
// creating the edited one would all still pass every other test in this
// file. This test fails on all three of those mutations.
test('lesson-accept prints the edited candidate — not the pre-edit one — before the created line', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run([
      'lesson-accept', lessonId, keys[0],
      '--title', 'Run migrations between 02:00 and 05:00 UTC',
      '--scope', 'migrations/**,ops/**',
    ], cwd);
    assert.equal(code, 0);

    const createdAt = out.indexOf('my_context: created RULE-');
    assert.notEqual(createdAt, -1, `expected a "created RULE-..." line, got:\n${out}`);
    const preview = out.slice(0, createdAt);

    // keys[0] is 'Run schema migrations outside peak traffic hours' / do /
    // 'An ACCESS EXCLUSIVE lock queues writes.' / scope ['migrations/**'] /
    // default severity 'soft' — title and scope are edited above; directive,
    // severity and body are not, so the pre-edit and post-edit values would be
    // indistinguishable for those three UNLESS the whole block is checked
    // together against what --title/--scope actually changed.
    assert.match(preview, /title:\s+Run migrations between 02:00 and 05:00 UTC/);
    assert.doesNotMatch(preview, /title:\s+Run schema migrations outside peak traffic hours/);
    assert.match(preview, /directive:\s+do/);
    assert.match(preview, /severity:\s+soft/);
    assert.match(preview, /scope:\s+migrations\/\*\*, ops\/\*\*/);
    assert.doesNotMatch(preview, /scope:\s+migrations\/\*\*$/m);
    assert.match(preview, /body:\s+An ACCESS EXCLUSIVE lock queues writes\./);
  });
});

test('lesson-discard treats --title\'s own value as a flag argument, not the key, like lesson-accept does', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    // No positional named "X" was staged — if lesson-discard's positional
    // parsing consumed "--title" as an unrecognized flag but left its value
    // "X" as a stray positional, "X" would be silently treated as the key
    // (fails closed: "no candidate X", but silently on the wrong grounds).
    // With the same valueFlags list lesson-accept uses, "X" is consumed as
    // --title's argument and never reaches positional parsing at all.
    const { code, out } = run(['lesson-discard', lessonId, '--title', 'X', keys[0]], cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`discarded candidate ${keys[0]}`));
  });
});

/**
 * `edits()` used to FILTER its `--severity`/`--directive` values to the legal
 * ones (`if (severity === 'hard' || severity === 'soft')`), so
 * `--severity critical` was accepted on the command line, dropped, and the
 * rule created from the staged value while the command printed its ordinary
 * success line. Its own doc comment claimed the opposite — that the merged
 * candidate is re-validated — and passing the value through is what makes
 * that claim true: `validateRuleCandidates` refuses it by name.
 */
test('lesson-accept refuses a bogus --severity instead of dropping it and creating the rule', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(
      ['lesson-accept', lessonId, keys[0], '--severity', 'critical'], cwd,
    );
    assert.equal(code, 1, out);
    assert.match(out, /"severity" must be "hard" or "soft"/);
    assert.doesNotMatch(out, /created RULE-/);
  });
});

test('lesson-accept refuses a bogus --directive on the same terms', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(
      ['lesson-accept', lessonId, keys[0], '--directive', 'maybe'], cwd,
    );
    assert.equal(code, 1, out);
    assert.match(out, /"directive" is required and must be "do" or "dont"/);
    assert.doesNotMatch(out, /created RULE-/);
  });
});

test('lesson-accept keeps every --scope, not just the first', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(
      ['lesson-accept', lessonId, keys[0], '--scope', 'migrations/**', '--scope', 'ops/**'], cwd,
    );
    assert.equal(code, 0, out);
    assert.match(out, /scope:\s+migrations\/\*\*, ops\/\*\*/);
  });
});
