import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
