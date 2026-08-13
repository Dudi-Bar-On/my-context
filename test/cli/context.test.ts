import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { openMutateContext } from '../../src/cli/commands/context.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ctx-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/**
 * The dogfooding defect this guards: `createItem` (and every mutation
 * function) trusts `ctx.store` as its whole view of the corpus for
 * dedupe/id-family lookups. A caller that hands it a store which has never
 * been rebuilt from the Markdown on disk gets a confidently wrong answer —
 * in practice, `createItem` once reported "created" for three items that
 * already existed on disk, because the store it consulted did not yet know
 * about them. `openMutateContext` must always rebuild before returning, so
 * that items written to disk by some OTHER means (by hand, by a prior
 * process, by a test fixture) are visible to the very first call that uses
 * the returned context — not just to a second, later call.
 */
test('openMutateContext sees an item written to disk without going through the index first', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);

  // Written directly to Markdown, bypassing createItem/the index entirely —
  // exactly the "knowledge already on disk that the store has never seen"
  // case openMutateContext must not be blind to.
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-hand-written.md'), [
    '---',
    'id: CONST-hand-written',
    'type: constraint',
    'title: Hand-written',
    'status: active',
    'severity: soft',
    'always: false',
    'origin: human',
    'valid_from: 2024-01-01',
    'checksum: ""',
    '---',
    '',
    '# Hand-written',
    '',
    'Written directly to disk.',
    '',
  ].join('\n'), 'utf8');

  const { ctx, errors } = openMutateContext(ws);
  try {
    assert.deepEqual(errors, []);
    assert.ok(ctx.store.get('CONST-hand-written'), 'the hand-written item must already be visible');
  } finally {
    ctx.store.close();
  }
  rmSync(cwd, { recursive: true, force: true });
});
