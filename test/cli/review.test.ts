import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function draft(cwd: string, id: string, type: string, title: string, extra = ''): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${title}
status: draft
severity: soft
always: false
origin: ingest
source_file: docs/prd.md
source_anchor: password-policy
${extra}---

# ${title}

Body text.
`, 'utf8');
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-review-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

test('review lists drafts with their type, origin and source', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
  const { code, out } = run(['review'], cwd);
  assert.equal(code, 0);
  assert.match(out, /REQ-a\s+requirement\s+ingest\s+docs\/prd\.md/);
  assert.match(out, /CONST-b/);
  assert.match(out, /2 draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('review reports an empty queue rather than printing nothing', () => {
  const cwd = project();
  const { code, out } = run(['review'], cwd);
  assert.equal(code, 0);
  assert.match(out, /no drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('review --type filters the queue', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
  const { out } = run(['review', 'list', '--type', 'constraint'], cwd);
  assert.match(out, /CONST-b/);
  assert.equal(/REQ-a/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('review show prints the full item and its provenance', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'show', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /Body text\./);
  assert.match(out, /docs\/prd\.md/);
  assert.match(out, /password-policy/);
  rmSync(cwd, { recursive: true, force: true });
});

test('promote moves a draft to active', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'promote', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /REQ-a.*active/);
  assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+active/);
  rmSync(cwd, { recursive: true, force: true });
});

test('promote can set scope in the same step', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  run(['review', 'promote', 'REQ-a', '--scope', 'src/auth/**'], cwd);
  // Unquoted — NEEDS_QUOTES does not fire on `/` or `*`. See Task 9's note.
  assert.match(run(['show', 'REQ-a'], cwd).out, /^\s+- src\/auth\/\*\*$/m);
  rmSync(cwd, { recursive: true, force: true });
});

test('promoting a non-draft is refused with its actual status', () => {
  const cwd = project();
  run(['add', 'constraint', 'Already active'], cwd);
  const { code, out } = run(['review', 'promote', 'CONST-already-active'], cwd);
  assert.equal(code, 1);
  assert.match(out, /active/);
  assert.match(out, /only drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('promoting into a disabled category is refused rather than creating a silently inert item', () => {
  const cwd = project();
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ profile: 'standard', categories: { requirement: { enabled: false } } }, null, 2),
    'utf8',
  );
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'promote', 'REQ-a'], cwd);
  assert.equal(code, 1);
  assert.match(out, /not enabled/i);
  assert.match(out, /never be injected/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('discard deprecates rather than deleting, leaving a trail', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'discard', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /deprecated/);
  assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+deprecated/);
  assert.match(run(['review'], cwd).out, /no drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown id is reported for every subcommand', () => {
  const cwd = project();
  for (const sub of ['show', 'promote', 'discard']) {
    const { code, out } = run(['review', sub, 'REQ-nope'], cwd);
    assert.equal(code, 1, sub);
    assert.match(out, /REQ-nope/, sub);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown subcommand prints usage', () => {
  const cwd = project();
  const { code, out } = run(['review', 'frobnicate'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext review/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown subcommand given with an id is refused, not silently promoted', () => {
  // Without the subcommand whitelist check, an unrecognized subcommand falls
  // through past the `show`/`discard` branches to the `promote` logic at the
  // bottom — so a typo'd subcommand paired with a real draft id would
  // silently promote it. This pins that the whitelist check runs first.
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'frobnicate', 'REQ-a'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext review/);
  assert.match(run(['show', 'REQ-a'], cwd).out, /status: draft/);
  rmSync(cwd, { recursive: true, force: true });
});
