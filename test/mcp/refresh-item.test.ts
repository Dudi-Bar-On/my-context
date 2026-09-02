import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { snapshotChecksum, snapshotSource } from '../../src/core/reference.ts';
import { pendingRevisions, promoteRevision } from '../../src/core/revision.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `refresh_item`: the agent's route to a stale snapshot, and the trust
 * boundary it does not move.
 *
 * The property that makes the tool worth having rather than telling the model
 * to call `update_item` with pasted text: the SERVER reads the file, so the
 * new body is a copy of the named file and not whatever the caller composed.
 * The property that keeps it safe: it writes through `updateItem` with
 * `origin: 'agent'`, so a category set to `agentEdits: "review"` — the default
 * wherever a `reference` has been retiered to the normative tier — stages the
 * refresh for a human instead of applying it.
 */

const V1 = ['# Roadmap', '', '## Q3', '', '- pricing', ''].join('\n');
const V2 = ['# Roadmap', '', '## Q3', '', '- pricing', '- dunning', ''].join('\n');

function sandbox(config?: unknown): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-refmcp-'));
  runCli(['init'], cwd, () => {});
  if (config !== undefined) {
    writeFileSync(path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config), 'utf8');
  }
  mkdirSync(path.join(cwd, 'docs'));
  writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), V1, 'utf8');
  runCli(['add', '--summary-omitted', 'reference', 'Roadmap', '--file', 'docs/roadmap.md', '--yes'], cwd, () => {});
  writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), V2, 'utf8');
  return cwd;
}

function get(cwd: string, id: string): Item {
  const { store } = openStore(resolveWorkspace(cwd));
  const item = store.all().find((i) => i.id === id);
  store.close();
  assert.ok(item, `no item ${id}`);
  return item!;
}

test('refresh_item re-reads the file itself — the caller supplies no body', () => {
  const cwd = sandbox();
  try {
    const registry = createRegistry(cwd);
    // The schema takes an id and nothing else; a `body` argument is refused
    // rather than accepted and ignored, which is what makes "the body is a
    // copy of the file" a guarantee rather than a convention.
    assert.throws(
      () => registry.call('refresh_item', { id: 'REF-roadmap', body: 'whatever I like' }),
      /does not take "body"/,
    );
    registry.call('refresh_item', { id: 'REF-roadmap' });
    const item = get(cwd, 'REF-roadmap');
    assert.equal(snapshotSource(item.body), V2.trim());
    assert.equal(item.sourceChecksum, snapshotChecksum(V2));
  } finally {
    removeTree(cwd);
  }
});

test('refresh_item on an unchanged file writes nothing and says so', () => {
  const cwd = sandbox();
  try {
    createRegistry(cwd).call('refresh_item', { id: 'REF-roadmap' });
    const message = createRegistry(cwd).call('refresh_item', { id: 'REF-roadmap' });
    assert.match(message, /already current/);
  } finally {
    removeTree(cwd);
  }
});

test('refresh_item refuses anything that is not a snapshot', () => {
  const cwd = sandbox();
  try {
    const registry = createRegistry(cwd);
    registry.call('create_item', { summary_omitted: true, type: 'decision', title: 'A decision' });
    assert.throws(
      () => registry.call('refresh_item', { id: 'DEC-a-decision' }),
      /is not a file snapshot/,
    );
    assert.throws(() => registry.call('refresh_item', { id: 'REF-nope' }), /no item with id/);
  } finally {
    removeTree(cwd);
  }
});

test('under agentEdits review the refresh STAGES, and the item is untouched', () => {
  // The configuration a user reaches by retiering `reference` to normative:
  // `agentEdits` then defaults to `review` for it.
  const cwd = sandbox({ categories: { reference: { tier: 'normative' } } });
  try {
    const before = get(cwd, 'REF-roadmap');
    const message = createRegistry(cwd).call('refresh_item', { id: 'REF-roadmap' });
    assert.match(message, /staged|review/i);

    const after = get(cwd, 'REF-roadmap');
    assert.equal(after.body, before.body, 'a staged refresh must not change the item');
    assert.equal(after.sourceChecksum, before.sourceChecksum);

    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    try {
      rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
      const ctx = { root: ws.projectRoot ?? '', store, config: ws.config };
      const pending = pendingRevisions(ctx);
      assert.equal(pending.length, 1, 'the proposal must be queued, not lost');
      assert.equal(pending[0].itemId, 'REF-roadmap');

      // And the invariant `persist` maintains: once a human promotes the
      // staged body, `source_checksum` follows it. If it did not, `doctor`
      // would keep reporting drift against text nobody holds any more.
      promoteRevision(ctx, 'REF-roadmap');
    } finally {
      store.close();
    }

    const promoted = get(cwd, 'REF-roadmap');
    assert.equal(snapshotSource(promoted.body), V2.trim());
    assert.equal(
      promoted.sourceChecksum, snapshotChecksum(V2),
      'source_checksum did not follow the promoted body — doctor would report phantom drift',
    );
  } finally {
    removeTree(cwd);
  }
});
