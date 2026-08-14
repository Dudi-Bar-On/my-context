import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-status-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function draft(cwd: string, id: string, type: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: draft\norigin: ingest\n---\n\n# ${id}\n\nBody.\n`, 'utf8');
}

test('the counts from Plan 1 are unchanged', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 0);
  assert.match(out, /constraint\s+1/);
  assert.match(out, /lesson\s+1/);
  assert.match(out, /active\s+2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the review queue is surfaced with the command that walks it', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement');
  draft(cwd, 'REQ-b', 'requirement');
  const { out } = run(['status'], cwd);
  assert.match(out, /2 draft\(s\) pending review/);
  assert.match(out, /mycontext review/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a clean corpus says the queue is empty rather than omitting the section', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  assert.match(run(['status'], cwd).out, /0 draft\(s\) pending review/);
  rmSync(cwd, { recursive: true, force: true });
});

test('unfinished ingest sessions are listed with their progress', () => {
  const cwd = project();
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# A\n\nOne.\n\n# B\n\nTwo.\n', 'utf8');
  run(['ingest', 'docs/prd.md'], cwd);
  const { out } = run(['status'], cwd);
  assert.match(out, /ingest/);
  assert.match(out, /docs\/prd\.md\s+0\/2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('pending rule approvals are surfaced', () => {
  const cwd = project();
  const lesson = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(lesson.out)![0];
  writeFileSync(path.join(cwd, 'r.json'),
    JSON.stringify([{ title: 'Run migrations off-peak', directive: 'do', body: 'b' }]), 'utf8');
  run(['lesson-stage', id, '--file', 'r.json'], cwd);

  const { out } = run(['status'], cwd);
  assert.match(out, /1 rule candidate\(s\) awaiting approval/);
  assert.match(out, /lesson-accept/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the doctor summary appears as a single line', () => {
  const cwd = project();
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/gone/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

  const { out } = run(['status'], cwd);
  assert.match(out, /health:.*0 error\(s\).*warning\(s\)/);
  assert.match(out, /mycontext doctor/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status reports origin so agent-authored volume is visible', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  draft(cwd, 'REQ-a', 'requirement');
  const { out } = run(['status'], cwd);
  assert.match(out, /by origin/);
  assert.match(out, /human\s+1/);
  assert.match(out, /ingest\s+1/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status degrades gracefully when the ledger holds nothing', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 0);
  assert.match(out, /no sessions recorded|0 session/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt item file is reported and exits 1, exactly as Plan 1 required', () => {
  const cwd = project();
  run(['add', 'constraint', 'Good item'], cwd);
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');

  const { code, out } = run(['status'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint\s+1/, 'the good item is still counted');
  assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status outside a workspace still explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nostatus-'));
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  rmSync(cwd, { recursive: true, force: true });
});
