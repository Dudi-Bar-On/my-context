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

// The latency-ceiling test that used to live here moved to
// test/perf/session-start-latency.perf.ts: a single wall-clock sample
// compared to a hard ceiling inside node --test's default *concurrent*
// runner measured scheduler contention, not the code (~674ms against a
// 500ms ceiling under load from the other ~280 tests in this suite, passing
// comfortably run alone). The perf file replaces it with a many-iteration
// p95 run serially via `npm run test:perf`. See that file's header comment.

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
