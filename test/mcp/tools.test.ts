import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';
import { updateItem } from '../../src/core/mutate.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-tools-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/**
 * Promotes an item to `active` via a path that never goes through the MCP
 * registry — the registry's handlers always pass `origin: 'agent'`, so the
 * only way to get a governing normative item for the refusal test below is
 * to write it as a human would: directly through the mutation layer.
 */
function promoteToActive(cwd: string, id: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  try {
    rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
    updateItem(
      { root: ws.projectRoot ?? '', store, config: ws.config },
      { id, status: 'active', origin: 'human' },
    );
  } finally {
    store.close();
  }
}

test('the registry exposes exactly the nine implemented tools', () => {
  assert.deepEqual([...TOOL_NAMES].sort(), [
    'create_item', 'get_item', 'link_items', 'list_drafts', 'mycontext_examples',
    'mycontext_help', 'query_items', 'supersede_item', 'update_item',
  ]);
});

test('there is no delete tool', () => {
  assert.equal(TOOL_NAMES.some((n) => /delete|remove|purge/.test(n)), false);
});

test('ingest_document is reserved, documented, and not registered', () => {
  assert.equal(TOOL_NAMES.includes('ingest_document'), false);
  assert.ok(RESERVED_TOOLS.includes('ingest_document'));
  assert.ok(toolDescriptions().ingest_document);
});

test('documentation and the registry describe exactly the same tools', () => {
  const documented = Object.keys(toolDescriptions()).sort();
  const known = [...TOOL_NAMES, ...RESERVED_TOOLS].sort();
  assert.deepEqual(documented, known);
});

test('every listed tool has a terse description and an object schema', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    assert.ok(tool.description.length > 0, tool.name);
    assert.ok(tool.description.length <= 200, `${tool.name}: ${tool.description.length} chars`);
    assert.equal(tool.inputSchema.type, 'object', tool.name);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('no tool schema exposes an origin field', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    assert.equal(Object.hasOwn(properties, 'origin'), false, tool.name);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('tools are listed in a deterministic order', () => {
  const cwd = project();
  const first = createRegistry(cwd).list().map((t) => t.name);
  const second = createRegistry(cwd).list().map((t) => t.name);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [...first].sort());
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item creates a draft because the caller is an agent', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'constraint', title: 'Pool capped at 20', body: 'RDS permits 25.',
    scope: ['src/db/**'],
  });
  assert.match(text, /CONST-pool-capped-at-20/);
  assert.match(text, /draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item ignores an origin argument', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', origin: 'human' });
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /status: draft/);
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /origin: agent/);
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item ignores an origin argument, so an agent cannot self-attest as human', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active', origin: 'human' }),
    /cannot change the status of a normative item/i,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item is idempotent across calls and across processes', () => {
  const cwd = project();
  createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  const second = createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  assert.match(second, /already captured as LESSON-locks-matter/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item with a bad type returns a teaching message', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'requirment', title: 'X' }),
    /closest match is "requirement"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item with a non-array scope is corrected, not coerced silently', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'X', scope: 'src/db/**',
    }),
    /"scope" must be an array of strings/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('get_item returns the full Markdown and query_items finds it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'lesson', title: 'Migrations need locks', body: 'Two deploys collided.',
    tags: ['database'],
  });

  assert.match(registry.call('get_item', { id: 'LESSON-migrations-need-locks' }), /Two deploys/);
  assert.match(registry.call('query_items', { type: 'lesson' }), /LESSON-migrations-need-locks/);
  assert.match(registry.call('query_items', { tag: 'database' }), /LESSON-migrations/);
  assert.match(registry.call('query_items', { text: 'deploys' }), /LESSON-migrations/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items filters by the file path an item scopes', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  registry.call('create_item', { type: 'constraint', title: 'Token check', scope: ['src/api/**'] });

  const hits = registry.call('query_items', { path: 'src/db/writer.ts' });
  assert.match(hits, /CONST-pool-cap/);
  assert.equal(/CONST-token-check/.test(hits), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items accepts a Windows path and normalizes it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  assert.match(registry.call('query_items', { path: 'src\\db\\writer.ts' }), /CONST-pool-cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items says so when nothing matches', () => {
  const cwd = project();
  assert.match(createRegistry(cwd).call('query_items', { type: 'adr' }), /no items match/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items bounds its output and discloses the remainder', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  for (let i = 0; i < 30; i++) {
    registry.call('create_item', { type: 'lesson', title: `Lesson number ${i}` });
  }
  const out = registry.call('query_items', { type: 'lesson', limit: 5 });
  assert.equal(out.split('\n').filter((l) => l.startsWith('LESSON-')).length, 5);
  assert.match(out, /25 more/);
  rmSync(cwd, { recursive: true, force: true });
});

test('list_drafts is the review queue', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { type: 'lesson', title: 'Locks matter' });

  const drafts = registry.call('list_drafts', {});
  assert.match(drafts, /CONST-pool-cap/);
  assert.equal(/LESSON-locks-matter/.test(drafts), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('supersede_item retires without deleting when one agent-authored draft supersedes another', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20' });

  const text = registry.call('supersede_item', {
    id: 'CONST-pool-capped-at-10', by: 'CONST-pool-capped-at-20', reason: 'RDS resized.',
  });
  assert.match(text, /superseded by CONST-pool-capped-at-20/);
  assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-10' }), /status: superseded/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an agent cannot supersede a governing normative item through the registry', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20' });

  // A human promotes the retiree to active — the registry itself has no way
  // to do this, since every handler passes origin: 'agent'.
  promoteToActive(cwd, 'CONST-pool-capped-at-10');

  assert.throws(
    () => registry.call('supersede_item', {
      id: 'CONST-pool-capped-at-10', by: 'CONST-pool-capped-at-20', reason: 'RDS resized.',
    }),
    /an agent cannot supersede a governing normative item/i,
  );
  assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-10' }), /status: active/);
  rmSync(cwd, { recursive: true, force: true });
});

test('supersede_item ignores an origin argument, so an agent cannot self-attest as human', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20' });
  promoteToActive(cwd, 'CONST-pool-capped-at-10');

  assert.throws(
    () => registry.call('supersede_item', {
      id: 'CONST-pool-capped-at-10', by: 'CONST-pool-capped-at-20', reason: 'RDS resized.',
      origin: 'human',
    }),
    /an agent cannot supersede a governing normative item/i,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item cannot change the status of a normative item', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active' }),
    /cannot change the status of a normative item/i,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('link_items records a relation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { type: 'adr', title: 'Managed Postgres' });
  registry.call('link_items', {
    from: 'CONST-pool-cap', to: 'ADR-managed-postgres', relation: 'derived_from',
  });
  assert.match(
    registry.call('get_item', { id: 'CONST-pool-cap' }),
    /- derived_from \[\[ADR-managed-postgres\]\]/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('get_item on an unknown id suggests the nearest', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('get_item', { id: 'CONST-pool-capp' }),
    /closest match is "CONST-pool-cap"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('mycontext_help and mycontext_examples answer from the topic files', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.match(registry.call('mycontext_help', { topic: 'scope' }), /Too broad/i);
  assert.match(registry.call('mycontext_examples', { type: 'constraint' }), /type: constraint/);
  assert.throws(() => registry.call('mycontext_help', { topic: 'scopes' }), /closest match is "scope"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing required argument is named', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint' }),
    /create_item requires "title"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('calling a tool outside a workspace explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint', title: 'X' }),
    /mycontext init/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('help works without a workspace, since that is when it is most needed', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.match(createRegistry(cwd).call('mycontext_help', { topic: 'categories' }), /constraint/);
  rmSync(cwd, { recursive: true, force: true });
});
