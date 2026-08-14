import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-lesson-'));
  runCli(['init'], cwd, () => {});
  return cwd;
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
  const keys = [...staged.out.matchAll(/^\s{2}([0-9a-f]{8})\s/gm)].map((m) => m[1]);
  assert.equal(keys.length, 2, `expected 2 staged keys, output was:\n${staged.out}`);
  return { lessonId, keys };
}

test('lesson records the lesson and prints a derivation request', () => {
  const cwd = project();
  const { code, out } = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
  assert.equal(code, 0);
  assert.match(out, /LESSON-migrations-deadlock-when-run-during-peak-traffic/);
  assert.match(out, /RULE DERIVATION REQUEST/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the recorded lesson is active but rationale — indexed, never injected', () => {
  const cwd = project();
  run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  assert.match(run(['list'], cwd).out, /LESSON-migrations-deadlock-during-peak-traffic\s+lesson\s+active/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson with an existing id re-derives without creating a duplicate', () => {
  const cwd = project();
  const first = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(first.out)![0];
  const again = run(['lesson', id], cwd);
  assert.equal(again.code, 0);
  assert.match(again.out, /RULE DERIVATION REQUEST/);
  assert.equal(run(['list', 'lesson'], cwd).out.trim().split('\n').length, 1);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson with no argument prints usage', () => {
  const cwd = project();
  const { code, out } = run(['lesson'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext lesson/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-stage lists the staged candidates with their keys and creates no rules', () => {
  const cwd = project();
  const { keys } = stage(cwd);
  assert.equal(keys.length, 2);
  const listed = run(['list', 'rule'], cwd).out.trim();
  assert.equal(listed, '', `no rule may exist before acceptance, got:\n${listed}`);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-stage reports rejected candidates without discarding the good ones', () => {
  const cwd = project();
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
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept creates exactly the accepted rule, with derived_from', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  const { code, out } = run(['lesson-accept', lessonId, keys[1]], cwd);
  assert.equal(code, 0);
  assert.match(out, /RULE-never-deploy-a-migration-on-a-friday/);

  const rules = run(['list', 'rule'], cwd).out.trim().split('\n').filter(Boolean);
  assert.equal(rules.length, 1);
  const shown = run(['show', 'RULE-never-deploy-a-migration-on-a-friday'], cwd).out;
  assert.match(shown, /directive: dont/);
  assert.match(shown, new RegExp(`derived_from \\[\\[${lessonId}\\]\\]`));
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept honours --title and --scope edits', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  run(['lesson-accept', lessonId, keys[0], '--title', 'Run migrations between 02:00 and 05:00 UTC', '--scope', 'migrations/**,ops/**'], cwd);
  const shown = run(['show', 'RULE-run-migrations-between-02-00-and-05-00-utc'], cwd).out;
  // Unquoted: serializeFrontmatter's NEEDS_QUOTES fires on leading/trailing
  // whitespace, `:`, `#`, and a leading `-`/`[`/`{` — never on `/` or `*` — so
  // a scope glob renders as `  - migrations/**`. Plan 1's round-trip tests pin
  // that output; the assertion is what was wrong here, not the serializer.
  assert.match(shown, /^\s+- migrations\/\*\*$/m);
  assert.match(shown, /^\s+- ops\/\*\*$/m);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-discard removes a candidate from consideration permanently', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  assert.equal(run(['lesson-discard', lessonId, keys[0]], cwd).code, 0);
  const { code, out } = run(['lesson-accept', lessonId, keys[0]], cwd);
  assert.equal(code, 1);
  assert.match(out, /discarded/i);
  assert.equal(run(['list', 'rule'], cwd).out.trim(), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept on a lesson with no staging explains the next step', () => {
  const cwd = project();
  const created = run(['lesson', 'Something happened'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  const { code, out } = run(['lesson-accept', id, 'deadbeef'], cwd);
  assert.equal(code, 1);
  assert.match(out, /lesson-stage/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept with an unknown key lists the real ones', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  const { code, out } = run(['lesson-accept', lessonId, 'ffffffff'], cwd);
  assert.equal(code, 1);
  assert.match(out, new RegExp(keys[0]));
  rmSync(cwd, { recursive: true, force: true });
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
  const cwd = project();
  plantUnrelatedCorruptItem(cwd);
  const { code, out } = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  assert.equal(code, 0, 'lesson recorded the item and printed the request; the unrelated corpus problem is a warning');
  assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  assert.match(out, /RULE DERIVATION REQUEST/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-stage reports an unrelated corrupt item as a warning but still exits 0', () => {
  const cwd = project();
  const created = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  plantUnrelatedCorruptItem(cwd);
  writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
  const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  assert.equal(code, 0, 'lesson-stage staged the candidates; the unrelated corpus problem is a warning');
  assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept persists the rule and reports an unrelated corrupt item as a warning, exiting 0', () => {
  const cwd = project();
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
    .filter((line) => line.startsWith('RULE-'));
  assert.equal(rules.length, 1);
  rmSync(cwd, { recursive: true, force: true });
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
  const cwd = project();
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
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-discard treats --title\'s own value as a flag argument, not the key, like lesson-accept does', () => {
  const cwd = project();
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
  rmSync(cwd, { recursive: true, force: true });
});
