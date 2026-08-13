import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-hook-'));
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

test('with no workspace the hook outputs nothing', () => {
  const cwd = sandbox();
  assert.equal(buildSessionStartOutput(cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('pinned items appear in the output', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  assert.match(out, /Pool capped at 20/);
  rmSync(cwd, { recursive: true, force: true });
});

test('non-pinned items appear only in the index', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /1 lesson/);
  assert.equal(/Migrations need locks/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt config yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(buildSessionStartOutput(cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('the hook completes within the latency ceiling on a large corpus', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  for (let i = 0; i < 500; i++) {
    runCli(['add', 'lesson', `Lesson number ${i}`], cwd, () => {});
  }
  const started = process.hrtime.bigint();
  buildSessionStartOutput(cwd);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 500, `session-start took ${ms.toFixed(1)}ms`);
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt/unreadable database yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', '.index.db'), 'not a sqlite database');
  assert.equal(buildSessionStartOutput(cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a malformed item file does not prevent output for the rest of the corpus', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const badFile = path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md');
  writeFileSync(badFile, 'not frontmatter at all, just text');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  rmSync(cwd, { recursive: true, force: true });
});
