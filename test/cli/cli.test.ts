import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-cli-'));
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

test('init creates the workspace and config', () => {
  const cwd = sandbox();
  const { code } = run(['init'], cwd);
  assert.equal(code, 0);
  assert.ok(existsSync(path.join(cwd, '.my_context', 'config.json')));
  assert.ok(existsSync(path.join(cwd, '.my_context', 'items')));
  rmSync(cwd, { recursive: true, force: true });
});

test('init writes a gitignore for the index', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const ignore = readFileSync(path.join(cwd, '.my_context', '.gitignore'), 'utf8');
  assert.match(ignore, /\.index\.db/);
  rmSync(cwd, { recursive: true, force: true });
});

test('add creates an item file with a slug id', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'constraint', 'Postgres pool capped at 20'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-postgres-pool-capped-at-20/);
  assert.ok(existsSync(path.join(
    cwd, '.my_context', 'items', 'constraint', 'CONST-postgres-pool-capped-at-20.md')));
  rmSync(cwd, { recursive: true, force: true });
});

test('add rejects a disabled category with a helpful message', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'policy', 'Some policy'], cwd);
  assert.equal(code, 1);
  assert.match(out, /policy/);
  assert.match(out, /not enabled/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('add rejects an unknown category and suggests the closest', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'constraints', 'Typo'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint/);
  rmSync(cwd, { recursive: true, force: true });
});

test('list shows added items', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { out } = run(['list'], cwd);
  assert.match(out, /CONST-pool-cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('show prints the full item', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { out } = run(['show', 'CONST-pool-cap'], cwd);
  assert.match(out, /Pool cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status reports counts by category and status', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
  const { out } = run(['status'], cwd);
  assert.match(out, /constraint\s+1/);
  assert.match(out, /lesson\s+1/);
  assert.match(out, /active\s+2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown command exits non-zero with usage', () => {
  const cwd = sandbox();
  const { code, out } = run(['frobnicate'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('commands outside a workspace explain how to create one', () => {
  const cwd = sandbox();
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  rmSync(cwd, { recursive: true, force: true });
});

function corruptItem(cwd: string): void {
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-broken.md'), 'no frontmatter here\n');
}

test('list surfaces a rebuild error for a corrupt item and exits non-zero', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Good item'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /CONST-good-item/);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  rmSync(cwd, { recursive: true, force: true });
});

test('status surfaces a rebuild error for a corrupt item and exits non-zero', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Good item'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint\s+1/);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  rmSync(cwd, { recursive: true, force: true });
});

test('init inside a subdirectory of an existing workspace warns and still succeeds', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const sub = path.join(cwd, 'packages', 'a');
  mkdirSync(sub, { recursive: true });
  const { code, out } = run(['init'], sub);
  assert.equal(code, 0);
  assert.match(out, /warning/i);
  assert.match(out, new RegExp(path.join(cwd, '.my_context').replace(/\\/g, '\\\\')));
  assert.ok(existsSync(path.join(sub, '.my_context', 'config.json')));
  rmSync(cwd, { recursive: true, force: true });
});

test('init in a fresh directory produces no ancestor warning', () => {
  const cwd = sandbox();
  const { out } = run(['init'], cwd);
  assert.doesNotMatch(out, /warning/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('a command whose store operation throws still closes the handle', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  // Force Store.open to fail after the workspace exists: the db path is a
  // directory instead of a file.
  mkdirSync(path.join(cwd, '.my_context', '.index.db'), { recursive: true });
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /my_context:/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);
  // If the store handle leaked, this throws on Windows.
  rmSync(cwd, { recursive: true, force: true });
});

test('openStore closes the handle when rebuild throws AFTER a successful open — the real leak-guard path', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Good item'], cwd);
  const ws = resolveWorkspace(cwd);

  // Store.open succeeds fully (unlike the directory-as-dbPath test above,
  // which never opens a handle at all); rebuild() throws only once inside
  // the transaction, exercising openStore's catch(store.close(); throw err;).
  const original = Store.prototype.deleteByLayer;
  Store.prototype.deleteByLayer = function (): never { throw new Error('simulated deleteByLayer failure'); };
  try {
    assert.throws(() => openStore(ws), /simulated deleteByLayer failure/);
  } finally {
    Store.prototype.deleteByLayer = original;
  }

  // If the handle leaked, removing the workspace (which deletes the open db
  // file) throws on Windows.
  rmSync(cwd, { recursive: true, force: true });
});

test('the rendered CLI error line names the broken file exactly once', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  corruptItem(cwd);
  const { out } = run(['list'], cwd);
  const line = out.split('\n').find((l) => l.includes('CONST-broken.md'));
  assert.ok(line, 'expected an error line naming CONST-broken.md');
  const occurrences = line!.split('CONST-broken.md').length - 1;
  assert.equal(occurrences, 1, `expected the filename exactly once, got: ${line}`);
  rmSync(cwd, { recursive: true, force: true });
});

test('LoadError text is never doubly prefixed with "my_context:"', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  corruptItem(cwd);
  const { out } = run(['list'], cwd);
  assert.doesNotMatch(out, /my_context:[^\n]*my_context:/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unexpected exception surfaces as a my_context message, not a stack trace', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not valid json');
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /my_context:/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);
  rmSync(cwd, { recursive: true, force: true });
});
