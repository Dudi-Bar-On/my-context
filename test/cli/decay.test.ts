import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-decay-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function scoped(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: constraint\ntitle: ${title}\nstatus: active\nscope:\n  - "src/**"\n---\n\n# ${title}\n\nBody.\n`, 'utf8');
}

/** Plants a corrupt, unrelated item file so `openMutateContext`'s rebuild
 * reports a load error that has nothing to do with the command under test —
 * the same fixture `test/cli/review.test.ts` uses for the identical F2
 * assertion on its own commands. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

test('decay lists items never injected in the window', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /CONST-a/);
    assert.match(out, /never/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an item injected in the window drops out of the cold list', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Used recently');
    scoped(cwd, 'CONST-b', 'Never used');

    const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['decay'], cwd);
    assert.match(out, /CONST-b/);
    // Every row is indented (`  ${line(row)}`), so an anchored /^CONST-a/m could
    // never match and would pass no matter what the command printed. A plain
    // containment check is the assertion that can actually fail: without --all,
    // a warm item appears nowhere in the output.
    assert.equal(out.includes('CONST-a'), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('unscoped normative items are reported separately from decay', () => {
  const cwd = project();
  try {
    run(['add', 'constraint', 'No scope at all'], cwd);
    const { out } = run(['decay'], cwd);
    assert.match(out, /never auto-injected/i);
    assert.match(out, /CONST-no-scope-at-all/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('decay --sessions narrows the window and says so', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const { out } = run(['decay', '--sessions', '5'], cwd);
    assert.match(out, /last 5 session/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('when the ledger holds fewer sessions than the requested window, the report says so', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['decay', '--sessions', '20'], cwd);
    assert.match(out, /only 1 recorded/);
    assert.match(out, /"cold" mostly means "new"/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('decay --all also lists the warm items', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Used recently');
    const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    assert.equal(/CONST-a/.test(run(['decay'], cwd).out), false);
    assert.match(run(['decay', '--all'], cwd).out, /CONST-a/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an empty corpus reports nothing to decay rather than an empty screen', () => {
  const cwd = project();
  try {
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /nothing/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an unrelated corpus load error is reported but does not fail decay (F2)', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /CONST-a/);
    assert.match(out, /my_context: error/);
    assert.match(out, /CONST-broken/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an unrelated corpus load error on an otherwise-empty report is still reported and still exits 0 (F2)', () => {
  const cwd = project();
  try {
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /nothing/i);
    assert.match(out, /my_context: error/);
    assert.match(out, /CONST-broken/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('a non-numeric --sessions is rejected', () => {
  const cwd = project();
  try {
    const { code, out } = run(['decay', '--sessions', 'many'], cwd);
    assert.equal(code, 1);
    assert.match(out, /--sessions/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
