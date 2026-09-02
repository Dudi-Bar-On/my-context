// harness/self-test/workspace.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createWorkspace, destroyWorkspace, REPO, SCRATCH } from '../lib/workspace.mjs';

test('createWorkspace returns an initialised, isolated workspace', async () => {
  const ws = await createWorkspace();
  assert.ok(existsSync(join(ws, '.my_context', 'config.json')), 'config.json exists');
  assert.ok(existsSync(join(ws, '.my_context', 'items')), 'items/ exists');
  assert.ok(!ws.startsWith(REPO), 'workspace must live outside the plugin clone');
  await destroyWorkspace(ws);
  assert.ok(!existsSync(ws), 'workspace removed');
});

test('two workspaces are independent', async () => {
  const a = await createWorkspace();
  const b = await createWorkspace();
  assert.notEqual(a, b);
  await destroyWorkspace(a);
  assert.ok(existsSync(b), 'destroying one must not affect the other');
  await destroyWorkspace(b);
});

test('destroyWorkspace refuses paths outside SCRATCH', async () => {
  await assert.rejects(() => destroyWorkspace(SCRATCH + '-backup'), /refusing to remove/);
  await assert.rejects(() => destroyWorkspace(SCRATCH), /refusing to remove/);
  await assert.rejects(() => destroyWorkspace(join(SCRATCH, '..', '..', 'my-context')), /refusing to remove/);
  assert.ok(existsSync(REPO), 'the plugin clone must still exist');
});
