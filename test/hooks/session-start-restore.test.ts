import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger, writeSnapshot } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-restore-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, opts: {
  type?: string; always?: boolean; status?: string; body?: string;
} = {}): void {
  const type = opts.type ?? 'constraint';
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: ${opts.status ?? 'active'}
severity: hard
always: ${opts.always ?? false}
---

# ${id} title

${opts.body ?? 'Body text.'}
`);
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

test('a compact session restores the snapshotted items in full', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Pool capped at 20.' });
  addItem(cwd, 'CONST-other', { body: 'Unrelated rule.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-restored/);
  assert.match(out, /Pool capped at 20\./);
  assert.equal(/Unrelated rule\./.test(out), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('a compact session also re-injects the pinned tier', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-pinned/);
  assert.match(out, /CONST-restored/);

  rmSync(cwd, { recursive: true, force: true });
});

test('a startup session ignores any snapshot lying around', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' });
  assert.equal(/Restored body\./.test(out), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('restoring is not blocked by the ledger rows from before the compact', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  ledger.record('s1', 'CONST-restored', 'jit');
  ledger.close();

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-restored/);

  rmSync(cwd, { recursive: true, force: true });
});

test('what is injected is recorded under the tier it was injected in', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true });
  addItem(cwd, 'CONST-restored');
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);
  buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  const tiers = new Map(ledger.entries('s1').map((e) => [e.itemId, e.tier]));
  ledger.close();
  assert.equal(tiers.get('CONST-pinned'), 'pinned');
  assert.equal(tiers.get('CONST-restored'), 'restored');

  rmSync(cwd, { recursive: true, force: true });
});

test('a second compact does not re-restore what the first already restored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const first = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(first, /CONST-restored/);
  const second = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.equal(/Restored body\./.test(second), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('a pinned item injected at startup is not re-injected by JIT later', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true });
  buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' });

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  assert.deepEqual(ledger.seen('s1'), ['CONST-pinned']);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});

test('without a session id the hook still injects, it just records nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pinned/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing snapshot degrades to an ordinary session start', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 'never-snapshotted' });
  assert.match(out, /CONST-pinned/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a snapshotted item that was superseded meanwhile is not restored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-old', { status: 'superseded', body: 'Retired body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-old']);
  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.equal(/Retired body\./.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});
