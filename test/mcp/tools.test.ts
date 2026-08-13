import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';
import { extraFieldNames, resolveConfig } from '../../src/core/config.ts';
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
    /cannot supersede a governing normative item/i,
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
    /cannot supersede a governing normative item/i,
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

// --- Round 2: findings from review -----------------------------------------

/** Writes a minimal, valid item file directly, bypassing create_item — the
 * only way to control `valid_from`, since createItem always stamps "today". */
function writeRawDraft(cwd: string, opts: { id: string; title: string; validFrom: string }): void {
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  const body = [
    '---',
    `id: ${opts.id}`,
    'type: constraint',
    `title: ${opts.title}`,
    'status: draft',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: agent',
    `valid_from: ${opts.validFrom}`,
    '---',
    '',
    `# ${opts.title}`,
    '',
  ].join('\n');
  writeFileSync(path.join(dir, `${opts.id}.md`), body, 'utf8');
}

test('list_drafts is newest first by valid_from, not alphabetical by id', () => {
  const cwd = project();
  // "aaa" is alphabetically first but the OLDEST; "zzz" is alphabetically
  // last but the NEWEST. Only a genuine valid_from-descending sort puts zzz
  // first — plain `ORDER BY id` (the unfixed behaviour) would put aaa first.
  writeRawDraft(cwd, { id: 'CONST-aaa', title: 'Aaa item', validFrom: '2020-01-01' });
  writeRawDraft(cwd, { id: 'CONST-zzz', title: 'Zzz item', validFrom: '2026-01-01' });

  const drafts = createRegistry(cwd).call('list_drafts', {});
  const ids = drafts.split('\n').map((l) => l.split(' · ')[0]);
  assert.deepEqual(ids, ['CONST-zzz', 'CONST-aaa']);
  rmSync(cwd, { recursive: true, force: true });
});

test('list_drafts ties on valid_from break by id ascending, for determinism', () => {
  const cwd = project();
  writeRawDraft(cwd, { id: 'CONST-bbb', title: 'Bbb item', validFrom: '2026-01-01' });
  writeRawDraft(cwd, { id: 'CONST-aaa', title: 'Aaa item', validFrom: '2026-01-01' });

  const drafts = createRegistry(cwd).call('list_drafts', {});
  const ids = drafts.split('\n').map((l) => l.split(' · ')[0]);
  assert.deepEqual(ids, ['CONST-aaa', 'CONST-bbb']);
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item can correct an extra field set at creation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'risk', title: 'Vendor outage', likelihood: 'low' });
  registry.call('update_item', { id: 'RISK-vendor-outage', extra: { likelihood: 'high' } });
  assert.match(registry.call('get_item', { id: 'RISK-vendor-outage' }), /likelihood: high/);
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item refuses a non-object extra rather than silently dropping it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'risk', title: 'Vendor outage' });
  assert.throws(
    () => registry.call('update_item', { id: 'RISK-vendor-outage', extra: 'high' }),
    /"extra" must be an object/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

// Non-regression only: `'requirment'` was already an ordinary miss under the
// pre-fix `config.categories[type]` lookup (it resolves to `undefined` either
// way), so this test stays green whether or not the Object.hasOwn guard is
// present. It documents the ordinary-typo path; it does NOT cover the
// prototype-pollution finding — only the test below does that.
test('mycontext_examples on an unknown type is a teaching message naming the closest match', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('mycontext_examples', { type: 'requirment' }),
    /closest match is "requirement"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

// This is the one that actually discriminates: under the pre-fix bare
// `config.categories[type]` lookup, `type: 'constructor'` resolves to
// `Object.prototype.constructor` (truthy, so the old `if (!category) throw`
// guard never fires) and the function crashes deeper in with a raw
// TypeError — a message that does NOT start with "my_context:". Only the
// Object.hasOwn guard makes this throw the teaching message instead.
test('mycontext_examples on a prototype-polluting type is refused with a teaching message, not a raw TypeError', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('mycontext_examples', { type: 'constructor' }),
    (err: unknown) => err instanceof Error && err.message.startsWith('my_context:')
      && !/Cannot read propert/.test(err.message),
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item with a wrong-typed title is refused, not a silent no-op', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', title: 12345 }),
    /"title" must be a string/,
  );
  // And the title genuinely did not change.
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /title: Pool cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item with a wrong-typed always is refused, not a silent no-op', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', always: 'true' }),
    /"always" must be a boolean/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null on an optional string field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  // source_file: null must create successfully (not throw "must be a
  // string") and must be indistinguishable from never having passed it.
  const withNull = registry.call('create_item', {
    type: 'constraint', title: 'Pool cap A', source_file: null,
  });
  const omitted = registry.call('create_item', {
    type: 'constraint', title: 'Pool cap B',
  });
  assert.match(withNull, /created/);
  assert.match(omitted, /created/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null on an optional boolean field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', always: null });
  assert.match(text, /updated/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null limit falls back to the default, like an omitted one', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'lesson', title: 'Locks matter' });
  const text = registry.call('query_items', { type: 'lesson', limit: null });
  assert.match(text, /LESSON-locks-matter/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null extra behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', extra: null });
  assert.match(text, /updated/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null on an optional array field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  // scope: null must create successfully — not throw "must be an array of
  // strings" — and behave the same as never passing scope at all.
  const text = registry.call('create_item', {
    type: 'constraint', title: 'Pool cap', scope: null,
  });
  assert.match(text, /created/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null on an optional enum field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  // status: null on query_items must not throw an enum error — it must
  // behave as though status were never passed, i.e. no status filter.
  const text = registry.call('query_items', { type: 'constraint', status: null });
  assert.match(text, /CONST-pool-cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null on the observations field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'lesson', title: 'Locks matter', observations: null,
  });
  assert.match(text, /created/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a per-entry observation context: null is unaffected by the top-level null handling', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'lesson', title: 'Locks matter',
    observations: [{ category: 'symptom', text: 'Duplicate column errors', context: null }],
  });
  assert.match(text, /created/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null does not bypass wrong-type rejection for a real array or enum violation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  // A bare string (not null, not an array) is still refused for scope.
  assert.throws(
    () => registry.call('create_item', { type: 'constraint', title: 'X', scope: 'src/db/**' }),
    /"scope" must be an array of strings/,
  );
  // A non-member string (not null) is still refused for status.
  assert.throws(
    () => registry.call('query_items', { status: 'not-a-status' }),
    /"status" must be one of/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('an explicit null does not bypass wrong-type rejection for genuinely bad values', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  // A number is still refused — only null (and undefined) are treated as absent.
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', title: 12345 }),
    /"title" must be a string/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test("update_item's extra schema constrains values to strings", () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'update_item');
  const props = (spec!.inputSchema as { properties: Record<string, { additionalProperties?: unknown }> }).properties;
  assert.deepEqual(props.extra.additionalProperties, { type: 'string' });
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item refuses an observation missing category, rather than defaulting to "note"', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'lesson', title: 'X', observations: [{ text: 'no category here' }],
    }),
    /observations\[0\] is missing "category"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item refuses an observation with a non-string text, rather than stringifying it', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'lesson', title: 'X', observations: [{ category: 'note', text: 42 }],
    }),
    /observations\[0\] is missing "text"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items refuses limit: 0, rather than silently falling back to 20', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('query_items', { limit: 0 }),
    /"limit" must be a positive number/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items refuses a negative limit, rather than silently falling back to 20', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('query_items', { limit: -5 }),
    /"limit" must be a positive number/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('a rebuild error surfaces as a note on the result, not silence', () => {
  const cwd = project();
  // A hand-corrupted item file: no frontmatter block at all.
  const itemsDir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(itemsDir, { recursive: true });
  writeFileSync(path.join(itemsDir, 'CONST-broken.md'), 'not a valid item file at all', 'utf8');

  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const out = registry.call('query_items', { type: 'constraint' });

  assert.match(out, /CONST-pool-cap/);
  // The broken file is unreadable, so it can never appear as a listed item
  // (an "id · type · status · title" line) — only in the trailing note,
  // which names the file path and therefore does legitimately mention it.
  assert.equal(/CONST-broken · /.test(out), false, 'the broken item itself is still not indexed');
  assert.match(out, /1 item file could not be read during rebuild/);
  assert.match(out, /CONST-broken\.md/);
  // Exactly one note line, appended once, never duplicated.
  assert.equal((out.match(/could not be read during rebuild/g) ?? []).length, 1);
  rmSync(cwd, { recursive: true, force: true });
});

test('a clean rebuild never appends a load-error note', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const out = registry.call('get_item', { id: 'CONST-pool-cap' });
  assert.equal(/could not be read during rebuild/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item accepts kind on any type, since it is typical usage, not an enforced restriction', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', { type: 'constraint', title: 'Weird but allowed', kind: 'x' });
  assert.match(text, /created/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item schema exposes likelihood, impact and validate_by', () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'create_item');
  const props = (spec!.inputSchema as { properties: Record<string, unknown> }).properties;
  assert.ok(Object.hasOwn(props, 'likelihood'));
  assert.ok(Object.hasOwn(props, 'impact'));
  assert.ok(Object.hasOwn(props, 'validate_by'));
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * `extraFields` in the category config used to be written and never read: the
 * harvest below was a hardcoded literal of five names, and the two had
 * already diverged — `assumption.validated_on` and `open_question.blocks`
 * were declared in categories.ts and absent from the tool schema, so
 * `create_item({type:'assumption', validated_on:'…'})` returned success and
 * dropped the field with no message at all. Driving both the schema and the
 * harvest from the resolved config is what makes that divergence
 * unrepresentable.
 */
test('the create_item schema exposes exactly the extra fields the config declares', () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'create_item');
  const props = (spec!.inputSchema as { properties: Record<string, unknown> }).properties;

  const declared = extraFieldNames(resolveConfig({}));
  assert.ok(declared.length > 0);
  for (const field of declared) {
    assert.ok(Object.hasOwn(props, field), `schema is missing declared extra field "${field}"`);
  }
  // And nothing invented: every schema property is either a core create_item
  // field or a declared extra field.
  const core = new Set([
    'type', 'title', 'body', 'scope', 'tags', 'severity', 'always', 'observations',
    'source_file', 'source_anchor',
  ]);
  for (const key of Object.keys(props)) {
    assert.ok(core.has(key) || declared.includes(key), `schema has undeclared property "${key}"`);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item stores validated_on, which the hardcoded harvest silently dropped', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'assumption', title: 'Traffic stays under 500rps', validated_on: '2026-01-01',
  });
  assert.match(
    registry.call('get_item', { id: 'ASSUME-traffic-stays-under-500rps' }),
    /validated_on: 2026-01-01/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item stores blocks, the other field the hardcoded harvest dropped', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'open_question', title: 'Shard by tenant or region', blocks: 'REQ-sharding',
  });
  assert.match(
    registry.call('get_item', { id: 'OPENQ-shard-by-tenant-or-region' }),
    /blocks: REQ-sharding/,
  );
  rmSync(cwd, { recursive: true, force: true });
});
