import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { openRebuiltStore } from '../../src/core/open-store.ts';
import { Store } from '../../src/core/store.ts';
import type { Layer } from '../../src/core/types.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-open-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

test('openRebuiltStore rebuilds before returning — an item written straight to disk is visible', () => {
  const cwd = project();
  // Written to disk without going through the index, the way another process
  // (or a git pull) leaves the Markdown ahead of the database.
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-fresh.md'), [
    '---', 'id: CONST-fresh', 'type: constraint', 'title: Fresh', 'status: active',
    'severity: soft', 'always: false', 'origin: human', 'valid_from: 2024-01-01',
    'checksum: ""', '---', '', '# Fresh', '', 'Written directly to disk.', '',
  ].join('\n'), 'utf8');

  const { store, loaded, errors } = openRebuiltStore(resolveWorkspace(cwd));
  try {
    assert.equal(errors.length, 0);
    assert.equal(loaded, 1);
    assert.ok(store.get('CONST-fresh'), 'the rebuild must index what disk holds');
  } finally {
    store.close();
  }
  removeTree(cwd);
});

test('openRebuiltStore closes the handle when the rebuild throws — no leak on the error path', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const original = Store.prototype.deleteByLayer;
  Store.prototype.deleteByLayer = function (): never {
    throw new Error('simulated rebuild failure');
  };
  try {
    assert.throws(() => openRebuiltStore(ws), /simulated rebuild failure/);
  } finally {
    Store.prototype.deleteByLayer = original;
  }
  // If the handle leaked, deleting the open db file throws on Windows.
  removeTree(cwd);
});

/**
 * The caller-class retry policy, exercised on both sides of the parameter.
 * A transient SQLITE_BUSY-shaped failure must be retried when the caller asks
 * for the MCP policy and surfaced immediately when it does not — this is the
 * one behavioural difference the six hand-rolled copies actually had, and the
 * consolidation must not flatten it in either direction.
 */
function failBusyOnce(): { restore(): void; calls(): number } {
  const original = Store.prototype.deleteByLayer;
  let n = 0;
  Store.prototype.deleteByLayer = function (this: Store, layer: Layer): void {
    n++;
    if (n === 1) throw new Error('database is locked (simulated)');
    original.call(this, layer);
  };
  return {
    restore() { Store.prototype.deleteByLayer = original; },
    calls: () => n,
  };
}

test('retryOnBusy: a transient lock is retried and the open succeeds — the MCP policy', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const busy = failBusyOnce();
  try {
    const { store, errors } = openRebuiltStore(ws, { retryOnBusy: true });
    store.close();
    assert.equal(errors.length, 0);
    assert.ok(busy.calls() >= 2, 'the rebuild must have been retried after the lock error');
  } finally {
    busy.restore();
  }
  removeTree(cwd);
});

test('without retryOnBusy the same lock error surfaces immediately — the CLI/hook policy', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const busy = failBusyOnce();
  try {
    assert.throws(() => openRebuiltStore(ws), /database is locked/);
    assert.equal(busy.calls(), 1, 'the single-shot policy must not retry');
  } finally {
    busy.restore();
  }
  removeTree(cwd);
});
