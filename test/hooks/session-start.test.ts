import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

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
  removeTree(cwd);
});

test('pinned items appear in the output', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  assert.match(out, /Pool capped at 20/);
  removeTree(cwd);
});

test('non-pinned items appear only in the index', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /1 lesson/);
  assert.equal(/Migrations need locks/.test(out), false);
  removeTree(cwd);
});

test('a corrupt config yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(buildSessionStartOutput(cwd), '');
  removeTree(cwd);
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
  removeTree(cwd);
});

test('a malformed item file does not prevent output for the rest of the corpus', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const badFile = path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md');
  writeFileSync(badFile, 'not frontmatter at all, just text');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  removeTree(cwd);
});

/**
 * `rebuild` returns `LoadError[]` and this hook used to discard it — the
 * exact defect Task 7 fixed for the MCP surface, still present in the sibling
 * caller of the same function, on the product's highest-traffic path. A
 * broken item file simply vanished from injection with no signal anywhere.
 */
test('a malformed item file is reported in the session-start output, not swallowed', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md'),
    'not frontmatter at all, just text',
  );
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /could not be read during rebuild/);
  assert.match(out, /broken\.md/);
  // One concise line, not one per file: it shares the session-start budget.
  assert.equal(out.split('\n').filter((l) => /could not be read/.test(l)).length, 1);
  removeTree(cwd);
});

test('a clean corpus gets no load-error line at all', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.equal(/could not be read during rebuild/.test(buildSessionStartOutput(cwd)), false);
  removeTree(cwd);
});

test('the load-error line still appears when nothing at all was selected', () => {
  // The signal must not depend on there being something to inject: an empty
  // corpus whose only item file is broken is precisely when it matters most.
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md'),
    'not frontmatter at all, just text',
  );
  assert.match(buildSessionStartOutput(cwd), /could not be read during rebuild/);
  removeTree(cwd);
});
