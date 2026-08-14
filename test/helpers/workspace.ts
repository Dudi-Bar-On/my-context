import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { MutationContext } from '../../src/core/mutate.ts';
import { removeTree } from './tmp.ts';

export interface Sandbox {
  cwd: string;
  root: string;
  ctx: MutationContext;
  dispose(): void;
}

/**
 * A throwaway project workspace with an in-memory index. The index is
 * `:memory:` deliberately — these tests exercise mutation semantics, not
 * SQLite durability, and an in-memory database cannot leave a locked file
 * behind on Windows when a test fails.
 */
export function sandbox(rawConfig?: Record<string, unknown>): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mut-'));
  // A failed init must not surface much later as a mysteriously-null
  // projectRoot — assert it here, at the point of failure.
  assert.equal(runCli(['init'], cwd, () => {}), 0);

  if (rawConfig) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify(rawConfig, null, 2) + '\n',
    );
  }

  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot!;
  const store = Store.open(':memory:');

  return {
    cwd,
    root,
    ctx: { root, store, config: ws.config },
    dispose() {
      try { store.close(); } catch { /* already closed */ }
      removeTree(cwd);
    },
  };
}
