import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';
import { extraFieldNames, resolveConfig } from '../../src/core/config.ts';
import { updateItem } from '../../src/core/mutate.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { select } from '../../src/core/select.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

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

test('the registry exposes exactly the eleven implemented tools', () => {
  assert.deepEqual([...TOOL_NAMES].sort(), [
    'create_item', 'get_item', 'ingest_document', 'link_items', 'list_drafts', 'load_context',
    'mycontext_examples', 'mycontext_help', 'query_items', 'supersede_item',
    'update_item',
  ]);
});

test('there is no delete tool', () => {
  assert.equal(TOOL_NAMES.some((n) => /delete|remove|purge/.test(n)), false);
});

test('ingest_document is registered, documented, and no longer reserved', () => {
  assert.ok(TOOL_NAMES.includes('ingest_document'));
  assert.equal(RESERVED_TOOLS.includes('ingest_document'), false);
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
  removeTree(cwd);
});

/**
 * Every description is loaded into every session, and the "Not for:" clause is
 * the half that stops a tool being reached for wrongly — it is the cheapest
 * correction in the product. A new tool that ships without one is the failure
 * this pins.
 */
test('every tool description carries a Not for: clause', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    assert.match(tool.description, /Not for:/, tool.name);
  }
  removeTree(cwd);
});

test('no tool schema exposes an origin field', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    assert.equal(Object.hasOwn(properties, 'origin'), false, tool.name);
  }
  removeTree(cwd);
});

test('tools are listed in a deterministic order', () => {
  const cwd = project();
  const first = createRegistry(cwd).list().map((t) => t.name);
  const second = createRegistry(cwd).list().map((t) => t.name);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [...first].sort());
  removeTree(cwd);
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
  removeTree(cwd);
});

/**
 * `origin` used to be accepted by the transport, ignored by the handler, and
 * answered with the tool's ordinary success text — safe, because every handler
 * passes its own `origin`, but silent, which is the failure this project rules
 * out. It is now refused at the registry boundary before the handler runs.
 * Both halves are still pinned: the refusal here, and the handler-side
 * `origin: 'agent'` by the tests below that pass no `origin` at all
 * ("an agent cannot supersede a governing normative item through the
 * registry", "update_item cannot change the status of a normative item").
 */
test('create_item refuses an origin argument instead of accepting and dropping it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.throws(
    () => registry.call('create_item', { type: 'constraint', title: 'Pool cap', origin: 'human' }),
    /create_item does not take "origin"/,
  );
  // Refused before the handler ran, so nothing was written under any origin.
  assert.throws(() => registry.call('get_item', { id: 'CONST-pool-cap' }), /no item with id/);
  removeTree(cwd);
});

test('the origin refusal says why, rather than only that', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'Pool cap', origin: 'human',
    }),
    /records origin "agent" itself/,
  );
  removeTree(cwd);
});

test('update_item refuses an origin argument, so an agent cannot self-attest as human', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active', origin: 'human' }),
    /update_item does not take "origin"/,
  );
  // The item is untouched: the promotion the argument was reaching for did
  // not happen by another route either.
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /status: draft/);
  removeTree(cwd);
});

test('create_item is idempotent across calls and across processes', () => {
  const cwd = project();
  createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  const second = createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  assert.match(second, /already captured as LESSON-locks-matter/);
  removeTree(cwd);
});

test('create_item with a bad type returns a teaching message', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'requirment', title: 'X' }),
    /closest match is "requirement"/,
  );
  removeTree(cwd);
});

test('create_item with a non-array scope is corrected, not coerced silently', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'X', scope: 'src/db/**',
    }),
    /"scope" must be an array of strings/,
  );
  removeTree(cwd);
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
  removeTree(cwd);
});

test('query_items filters by the file path an item scopes', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  registry.call('create_item', { type: 'constraint', title: 'Token check', scope: ['src/api/**'] });

  const hits = registry.call('query_items', { path: 'src/db/writer.ts' });
  assert.match(hits, /CONST-pool-cap/);
  assert.equal(/CONST-token-check/.test(hits), false);
  removeTree(cwd);
});

/**
 * The `path` filter must answer the same question the JIT tier answers:
 * "which items apply to this file". An item that declares no scope is
 * unrestricted and applies to every path, so hiding it here would hide the
 * broadest items in the corpus from the query that exists to find them —
 * which is what a bare `matchesAnyGlob(path, item.scope)` did.
 */
test('query_items returns unscoped items for any path — they are unrestricted, not unmatched', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Applies everywhere' });
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });

  for (const path of ['src/db/writer.ts', 'docs/notes.md']) {
    const hits = registry.call('query_items', { path });
    assert.match(hits, /CONST-applies-everywhere/, `on ${path}`);
  }
  // Still a filter, not a pass-through: the scoped item is absent off its glob.
  assert.equal(/CONST-pool-cap/.test(registry.call('query_items', { path: 'docs/notes.md' })), false);
  removeTree(cwd);
});

test('query_items accepts a Windows path and normalizes it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  assert.match(registry.call('query_items', { path: 'src\\db\\writer.ts' }), /CONST-pool-cap/);
  removeTree(cwd);
});

test('query_items says so when nothing matches', () => {
  const cwd = project();
  assert.match(createRegistry(cwd).call('query_items', { type: 'adr' }), /no items match/i);
  removeTree(cwd);
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
  removeTree(cwd);
});

test('list_drafts is the review queue', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { type: 'lesson', title: 'Locks matter' });

  const drafts = registry.call('list_drafts', {});
  assert.match(drafts, /CONST-pool-cap/);
  assert.equal(/LESSON-locks-matter/.test(drafts), false);
  removeTree(cwd);
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
  removeTree(cwd);
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
    /a non-human caller cannot supersede a governing normative item/i,
  );
  assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-10' }), /status: active/);
  removeTree(cwd);
});

test('supersede_item refuses an origin argument, so an agent cannot self-attest as human', () => {
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
    /supersede_item does not take "origin"/,
  );
  // The governing item is still governing — the test above proves the same
  // call without the argument is refused by `supersedeItem`'s own guard.
  assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-10' }), /status: active/);
  removeTree(cwd);
});

test('update_item cannot change the status of a normative item', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active' }),
    /cannot change the status of a normative item/i,
  );
  removeTree(cwd);
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
  removeTree(cwd);
});

test('get_item on an unknown id suggests the nearest', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('get_item', { id: 'CONST-pool-capp' }),
    /closest match is "CONST-pool-cap"/,
  );
  removeTree(cwd);
});

test('mycontext_help and mycontext_examples answer from the topic files', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.match(registry.call('mycontext_help', { topic: 'scope' }), /Too broad/i);
  assert.match(registry.call('mycontext_examples', { type: 'constraint' }), /type: constraint/);
  assert.throws(() => registry.call('mycontext_help', { topic: 'scopes' }), /closest match is "scope"/);
  removeTree(cwd);
});

test('a missing required argument is named', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint' }),
    /create_item requires "title"/,
  );
  removeTree(cwd);
});

test('calling a tool outside a workspace explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint', title: 'X' }),
    /mycontext init/,
  );
  removeTree(cwd);
});

test('help works without a workspace, since that is when it is most needed', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.match(createRegistry(cwd).call('mycontext_help', { topic: 'categories' }), /constraint/);
  removeTree(cwd);
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
  removeTree(cwd);
});

test('list_drafts ties on valid_from break by id ascending, for determinism', () => {
  const cwd = project();
  writeRawDraft(cwd, { id: 'CONST-bbb', title: 'Bbb item', validFrom: '2026-01-01' });
  writeRawDraft(cwd, { id: 'CONST-aaa', title: 'Aaa item', validFrom: '2026-01-01' });

  const drafts = createRegistry(cwd).call('list_drafts', {});
  const ids = drafts.split('\n').map((l) => l.split(' · ')[0]);
  assert.deepEqual(ids, ['CONST-aaa', 'CONST-bbb']);
  removeTree(cwd);
});

test('update_item can correct an extra field set at creation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'risk', title: 'Vendor outage', likelihood: 'low' });
  registry.call('update_item', { id: 'RISK-vendor-outage', extra: { likelihood: 'high' } });
  assert.match(registry.call('get_item', { id: 'RISK-vendor-outage' }), /likelihood: high/);
  removeTree(cwd);
});

test('update_item refuses an always that selection would ignore, rather than storing it', () => {
  // README's pinning section used to offer `update_item` as one of two routes
  // to `always`. On a GOVERNING normative item it is refused outright; on a
  // rationale item it used to SUCCEED with the flag INERT, because `select`
  // filters `isNormative` before it filters `always` — so the tool reported
  // "updated" over a field that does nothing. It is now refused (spec §3).
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'lesson', title: 'A rationale item', body: 'b' });
  assert.throws(
    () => registry.call('update_item', { id: 'LESSON-a-rationale-item', always: true }),
    /only governs on the normative tier/,
  );

  // The premise the refusal rests on, checked by executing rather than
  // asserted in prose: even had it been stored, the item would not be pinned.
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  try {
    rebuild(store, { project: ws.projectRoot as string }, ws.config);
    const pinned = select(
      store.all().map((i) => (i.type === 'lesson' ? { ...i, always: true } : i)),
      { event: 'session-start' }, ws.config,
    );
    assert.deepEqual(
      pinned.full.map((e) => e.item.id), [],
      'a rationale item with always: true must not be pinned — that is what makes the refusal true',
    );
  } finally {
    store.close();
  }
  removeTree(cwd);
});

test('a normative item with always is accepted and given no inert note', () => {
  // The other direction: a rule that fires on everything says nothing.
  const cwd = project();
  const registry = createRegistry(cwd);
  const created = registry.call('create_item', {
    type: 'constraint', title: 'Pool capped at 20', body: 'b', always: true,
  });
  assert.doesNotMatch(created, /INERT/);
  const updated = registry.call('update_item', {
    id: 'CONST-pool-capped-at-20', always: true, body: 'Measured.',
  });
  assert.doesNotMatch(updated, /INERT/);
  removeTree(cwd);
});

test('update_item refuses extra.__proto__ instead of reporting a silent no-op', () => {
  // `optExtra` (mcp/tools.ts) used to copy with `out[key] = v`, which for the
  // key `__proto__` sets the copy's prototype rather than adding an own
  // property. `validateExtra` (mutate.ts) iterates `Object.entries`, i.e. own
  // properties only, so its `__proto__` refusal was unreachable from the one
  // surface that takes free-form `extra` from a model: the call returned
  // "updated" having silently dropped the field.
  //
  // `JSON.parse`, not an object literal: only the former produces a real own
  // `__proto__` property, and JSON is exactly how the arguments arrive over
  // the MCP transport.
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'risk', title: 'Vendor outage' });
  const args = JSON.parse('{"id": "RISK-vendor-outage", "extra": {"__proto__": "boom"}}');
  assert.throws(
    () => registry.call('update_item', args),
    /extra field "__proto__" cannot be stored/,
    'extra.__proto__ must be refused, not dropped while reporting success',
  );
  // And the item is unchanged on disk — the refusal happens before any write.
  assert.doesNotMatch(registry.call('get_item', { id: 'RISK-vendor-outage' }), /boom/);
  removeTree(cwd);
});

test('update_item refuses a non-object extra rather than silently dropping it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'risk', title: 'Vendor outage' });
  assert.throws(
    () => registry.call('update_item', { id: 'RISK-vendor-outage', extra: 'high' }),
    /"extra" must be an object/,
  );
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
});

test('update_item with a wrong-typed always is refused, not a silent no-op', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', always: 'true' }),
    /"always" must be a boolean/,
  );
  removeTree(cwd);
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
  removeTree(cwd);
});

test('an explicit null on an optional boolean field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', always: null });
  assert.match(text, /updated/);
  removeTree(cwd);
});

test('an explicit null limit falls back to the default, like an omitted one', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'lesson', title: 'Locks matter' });
  const text = registry.call('query_items', { type: 'lesson', limit: null });
  assert.match(text, /LESSON-locks-matter/);
  removeTree(cwd);
});

test('an explicit null extra behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', extra: null });
  assert.match(text, /updated/);
  removeTree(cwd);
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
  removeTree(cwd);
});

test('an explicit null on an optional enum field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  // status: null on query_items must not throw an enum error — it must
  // behave as though status were never passed, i.e. no status filter.
  const text = registry.call('query_items', { type: 'constraint', status: null });
  assert.match(text, /CONST-pool-cap/);
  removeTree(cwd);
});

test('an explicit null on the observations field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'lesson', title: 'Locks matter', observations: null,
  });
  assert.match(text, /created/);
  removeTree(cwd);
});

test('a per-entry observation context: null is unaffected by the top-level null handling', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'lesson', title: 'Locks matter',
    observations: [{ category: 'symptom', text: 'Duplicate column errors', context: null }],
  });
  assert.match(text, /created/);
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
});

test("update_item's extra schema constrains values to strings", () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'update_item');
  const props = (spec!.inputSchema as { properties: Record<string, { additionalProperties?: unknown }> }).properties;
  assert.deepEqual(props.extra.additionalProperties, { type: 'string' });
  removeTree(cwd);
});

test('create_item refuses an observation missing category, rather than defaulting to "note"', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'lesson', title: 'X', observations: [{ text: 'no category here' }],
    }),
    /observations\[0\] is missing "category"/,
  );
  removeTree(cwd);
});

test('create_item refuses an observation with a non-string text, rather than stringifying it', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'lesson', title: 'X', observations: [{ category: 'note', text: 42 }],
    }),
    /observations\[0\] is missing "text"/,
  );
  removeTree(cwd);
});

test('query_items refuses limit: 0, rather than silently falling back to 20', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('query_items', { limit: 0 }),
    /"limit" must be a positive number/,
  );
  removeTree(cwd);
});

test('query_items refuses a negative limit, rather than silently falling back to 20', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('query_items', { limit: -5 }),
    /"limit" must be a positive number/,
  );
  removeTree(cwd);
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
  removeTree(cwd);
});

test('a clean rebuild never appends a load-error note', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  const out = registry.call('get_item', { id: 'CONST-pool-cap' });
  assert.equal(/could not be read during rebuild/.test(out), false);
  removeTree(cwd);
});

test('create_item accepts kind on any type, since it is typical usage, not an enforced restriction', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', { type: 'constraint', title: 'Weird but allowed', kind: 'x' });
  assert.match(text, /created/);
  removeTree(cwd);
});

test('create_item schema exposes likelihood, impact and validate_by', () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'create_item');
  const props = (spec!.inputSchema as { properties: Record<string, unknown> }).properties;
  assert.ok(Object.hasOwn(props, 'likelihood'));
  assert.ok(Object.hasOwn(props, 'impact'));
  assert.ok(Object.hasOwn(props, 'validate_by'));
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
});

// --- load_context: manual injection on demand --------------------------------

/** Writes an item file directly, so `always`, `status` and `scope` can all be
 * set at once — `create_item` always produces an agent draft. */
function writeItemFile(cwd: string, opts: {
  id: string; title: string; status: string; always: boolean; scope: string[];
}): void {
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${opts.id}.md`), [
    '---',
    `id: ${opts.id}`,
    'type: constraint',
    `title: ${opts.title}`,
    `status: ${opts.status}`,
    'severity: hard',
    `always: ${opts.always}`,
    `scope: [${opts.scope.join(', ')}]`,
    'tags: []',
    'origin: human',
    'valid_from: 2026-01-01',
    '---',
    '',
    `# ${opts.title}`,
    '',
    'Body text.',
    '',
  ].join('\n'), 'utf8');
}

/** The corpus every load_context test below runs against: one pinned item, one
 * scoped-but-unpinned item, and one draft. */
function corpus(): string {
  const cwd = project();
  writeItemFile(cwd, {
    id: 'CONST-pool-capped-at-20', title: 'Pool capped at 20',
    status: 'active', always: true, scope: [],
  });
  writeItemFile(cwd, {
    id: 'CONST-token-checked', title: 'Token checked on every request',
    status: 'active', always: false, scope: ['"src/api/**"'],
  });
  writeItemFile(cwd, {
    id: 'CONST-draft-only', title: 'Draft only',
    status: 'draft', always: false, scope: [],
  });
  return cwd;
}

test('load_context injects the pinned item and never the draft', () => {
  const cwd = corpus();
  const out = createRegistry(cwd).call('load_context', {});

  assert.match(out, /CONST-pool-capped-at-20/);
  assert.match(out, /Pool capped at 20/);
  // A draft is never injected, by any path: not in full text, not in the
  // index — only in the aggregate "drafts pending review" count.
  assert.equal(/CONST-draft-only/.test(out), false, 'a draft must never be injected');
  assert.equal(/Draft only/.test(out), false, 'a draft must never be injected');
  assert.match(out, /1 drafts pending review/);
  removeTree(cwd);
});

test('load_context returns byte-for-byte what SessionStart would inject', () => {
  const cwd = corpus();
  assert.equal(createRegistry(cwd).call('load_context', {}), buildSessionStartOutput(cwd));
  removeTree(cwd);
});

test('load_context leaves an unpinned item in the index, not in the governing block', () => {
  const cwd = corpus();
  const out = createRegistry(cwd).call('load_context', {});
  const indexAt = out.indexOf('## my_context index');
  assert.ok(indexAt > 0, 'the index section is present');
  assert.ok(
    out.indexOf('CONST-token-checked') > indexAt,
    'an unpinned item belongs to the index, not the full-text block',
  );
  removeTree(cwd);
});

test('load_context takes no arguments — nothing for the model to guess', () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'load_context');
  const schema = spec!.inputSchema as { properties: Record<string, unknown>; required: string[] };
  assert.deepEqual(Object.keys(schema.properties), []);
  assert.deepEqual(schema.required, []);
  removeTree(cwd);
});

/** The tool is a read path. Any write here — a new file, a changed file, a
 * deleted one — is a defect, not a nuance. */
test('load_context creates, modifies and deletes nothing', () => {
  const cwd = corpus();
  const itemsDir = path.join(cwd, '.my_context', 'items', 'constraint');
  const before = readdirSync(itemsDir).sort()
    .map((f) => [f, readFileSync(path.join(itemsDir, f), 'utf8')] as const);

  createRegistry(cwd).call('load_context', {});

  const after = readdirSync(itemsDir).sort()
    .map((f) => [f, readFileSync(path.join(itemsDir, f), 'utf8')] as const);
  assert.deepEqual(after, before);
  removeTree(cwd);
});

/**
 * The MCP server has no trustworthy session id — Claude Code's
 * CLAUDE_CODE_SESSION_ID diverges from the hook payload's `session_id` on a
 * resumed session — so this path deliberately writes no ledger row at all.
 * See the note in `buildInjection`: a fabricated key would silently break the
 * compaction restore that reads the ledger.
 */
test('load_context writes no ledger row, since it has no session to key one by', () => {
  const cwd = corpus();
  createRegistry(cwd).call('load_context', {});

  const db = new DatabaseSync(path.join(cwd, '.my_context', '.index.db'));
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ledger (
      session_id TEXT NOT NULL, item_id TEXT NOT NULL,
      tier TEXT NOT NULL, injected_at TEXT NOT NULL,
      PRIMARY KEY (session_id, item_id, tier))`);
    const row = db.prepare('SELECT COUNT(*) AS n FROM ledger').get() as { n: number };
    assert.equal(Number(row.n), 0);
  } finally {
    db.close();
  }
  removeTree(cwd);
});

test('load_context outside a workspace says so rather than returning nothing', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const out = createRegistry(cwd).call('load_context', {});
  assert.match(out, /^my_context:/);
  assert.match(out, /mycontext init/);
  removeTree(cwd);
});

test("load_context's description discloses that it is not restored after a compaction", () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'load_context');
  assert.match(spec!.description, /not restored after a compaction/i);
  removeTree(cwd);
});

// --- D3: an argument a tool does not declare is refused, never absorbed ---

/**
 * `create_item({..., relations: [...]})` returned `created … (active)` with
 * zero relations written and no message: the schema declared no `relations`
 * property and no `additionalProperties: false`, so nothing rejected it and
 * the handler simply never looked.
 *
 * It is refused rather than implemented, and the reason is the trust boundary
 * rather than effort. `createItem` does take a `relations` array internally,
 * but its `validateRelations` checks only each relation's TARGET — the closed
 * `RELATION_TYPES` vocabulary is enforced solely inside `linkItems`, which
 * additionally refuses `supersedes`/`superseded_by` by name so an agent cannot
 * assert a retirement-direction edge on a governing item. Forwarding
 * `relations` from `create_item` would route around both gates in one step.
 * The test below proves that door is still shut.
 */
test('create_item refuses a relations argument rather than dropping it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.throws(
    () => registry.call('create_item', {
      type: 'constraint', title: 'Pool cap',
      relations: [{ type: 'derived_from', target: 'LESSON-x' }],
    }),
    /create_item does not take "relations"/,
  );
  // Nothing was written: the refusal happens before the handler runs, so this
  // is not "created without the relation" either.
  assert.throws(() => registry.call('get_item', { id: 'CONST-pool-cap' }), /no item with id/);
  removeTree(cwd);
});

test('the relations refusal names the routes that do work', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'Pool cap', relations: [],
    }),
    /link_items\(from, to, relation\)[\s\S]*supersede_item\(id, by\)/,
  );
  removeTree(cwd);
});

test('refusing relations at creation does not reopen the retirement-edge door', () => {
  // The reason `relations` is refused rather than forwarded: `link_items`
  // refuses both retirement edges by name, and `create_item` must not become
  // a second way to assert one. Both halves are pinned here.
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20' });
  for (const relation of ['supersedes', 'superseded_by']) {
    assert.throws(
      () => registry.call('link_items', {
        from: 'CONST-pool-capped-at-10', to: 'CONST-pool-capped-at-20', relation,
      }),
      /cannot be added with link_items/,
      relation,
    );
  }
  assert.throws(
    () => registry.call('create_item', {
      type: 'constraint', title: 'Pool capped at 30',
      relations: [{ type: 'superseded_by', target: 'CONST-pool-capped-at-20' }],
    }),
    /does not take "relations"/,
  );
  removeTree(cwd);
});

/**
 * The `relations` drop was one instance of a general shape, not a `create_item`
 * bug: no tool declared `additionalProperties: false` and no handler looked at
 * a key it did not expect, so ANY unknown argument was accepted, ignored, and
 * answered with the tool's ordinary success text. The check therefore lives at
 * the registry boundary every tool call crosses, and this test walks the whole
 * tool list rather than naming one.
 */
test('every tool refuses an argument it does not declare', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  for (const name of TOOL_NAMES) {
    assert.throws(
      () => registry.call(name, { there_is_no_such_argument: 1 }),
      new RegExp(`${name} does not take "there_is_no_such_argument"`),
      name,
    );
  }
  removeTree(cwd);
});

test('a misspelled argument is refused, not answered with success', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', sevrity: 'hard' }),
    /does not take "sevrity"/,
  );
  // The refusal lists what the tool does accept, so the caller can see the
  // spelling they meant.
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', sevrity: 'hard' }),
    /It accepts: .*severity/,
  );
  removeTree(cwd);
});

test('the refusal is about unknown keys only — a full, correct call still works', () => {
  // A guard that refused everything would pass every assertion above.
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'constraint', title: 'Pool capped at 20', body: 'RDS permits 25.',
    scope: ['src/db/**'], tags: ['db'], severity: 'hard', always: false,
    observations: [{ category: 'note', text: 'Seen in staging.', tags: ['x'], context: 'ops' }],
    source_file: 'docs/prd.md', source_anchor: 'pool',
  });
  assert.match(text, /CONST-pool-capped-at-20/);
  removeTree(cwd);
});

test('every advertised schema closes its top level, so a client sees the same rule', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
  }
  removeTree(cwd);
});

/**
 * 1C.2 — a pending revision was invisible to every one of the eleven tools and
 * to the SessionStart hook. `update_item`'s "NOT applied — staged as revision
 * REV-…" was the only place the fact ever appeared, so the agent that staged it
 * could not discover, on any later call or in any later session, that its own
 * proposal was still waiting.
 *
 * The surfaces that carry it now are the three READ surfaces plus the
 * injection. `create_item`, `link_items`, `mycontext_help` and
 * `mycontext_examples` deliberately do not: the first two write something a
 * revision cannot be about (a new item; a relation, which is not a content
 * field a revision can propose), and the last two answer without a workspace
 * at all. `supersede_item` and `ingest_document` do not either — both are
 * about a DIFFERENT item from the one a revision names, and both already
 * return a message about what they did.
 */
function stageAgainstGoverning(cwd: string, id: string): void {
  const registry = createRegistry(cwd);
  registry.call('update_item', { id, body: 'A proposal nobody has settled.' });
}

/** A governing normative item, so an agent's content edit stages rather than
 * applying — `agentEdits` defaults to `review` on every normative category. */
function governingRule(cwd: string): string {
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'rule', title: 'Never log customer email', body: 'The original body.',
  });
  const id = 'RULE-never-log-customer-email';
  promoteToActive(cwd, id);
  return id;
}

test('get_item says a pending revision exists, and names the fields it proposes', () => {
  const cwd = project();
  const id = governingRule(cwd);

  const before = createRegistry(cwd).call('get_item', { id });
  assert.doesNotMatch(before, /pending revision/);

  stageAgainstGoverning(cwd, id);
  const after = createRegistry(cwd).call('get_item', { id });

  assert.match(after, /1 pending revision\(s\) on RULE-never-log-customer-email/);
  assert.match(after, /REV-/);
  assert.match(after, /proposing new body/);
  // The item still shows the text in force, and the proposal's text is not in it.
  assert.match(after, /The original body\./);
  assert.doesNotMatch(after, /A proposal nobody has settled\./);
  // And the agent is told what it can and cannot do about it.
  assert.match(after, /no tool on this surface can/);
  removeTree(cwd);
});

test('get_item on a DIFFERENT item does not claim a revision it does not have', () => {
  const cwd = project();
  const id = governingRule(cwd);
  stageAgainstGoverning(cwd, id);
  createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });

  const other = createRegistry(cwd).call('get_item', { id: 'LESSON-locks-matter' });
  assert.doesNotMatch(other, /pending revision/);
  removeTree(cwd);
});

test('query_items marks the items whose text is pre-proposal, and reports the queue', () => {
  const cwd = project();
  const id = governingRule(cwd);
  createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  stageAgainstGoverning(cwd, id);

  const out = createRegistry(cwd).call('query_items', {});
  const ruleLine = out.split('\n').find((l) => l.startsWith(id))!;
  assert.match(ruleLine, /1 pending revision\(s\), not applied/);
  const lessonLine = out.split('\n').find((l) => l.startsWith('LESSON-locks-matter'))!;
  assert.doesNotMatch(lessonLine, /pending revision/);
  assert.match(out, /staged and NOT applied/);
  removeTree(cwd);
});

/**
 * The empty answer is the one that mattered most: `list_drafts` said "no drafts
 * are waiting for review" to a workspace with a proposal waiting for a human —
 * the same sentence, about the same queue, that `mycontext review list` was
 * already fixed for.
 */
test('list_drafts reports the revision queue even when the draft queue is empty', () => {
  const cwd = project();
  const id = governingRule(cwd);
  stageAgainstGoverning(cwd, id);

  const out = createRegistry(cwd).call('list_drafts', {});
  assert.match(out, /no drafts are waiting for review/);
  assert.match(out, /1 pending revision\(s\) on 1 item\(s\)/);
  assert.match(out, new RegExp(`REV-[0-9a-f]+ → ${id}`));
  removeTree(cwd);
});

test('list_drafts says nothing about a queue that is empty', () => {
  const cwd = project();
  const out = createRegistry(cwd).call('list_drafts', {});
  assert.match(out, /no drafts are waiting for review/);
  assert.doesNotMatch(out, /pending revision/);
  removeTree(cwd);
});

/** `load_context` and SessionStart share one implementation, so the proposal is
 * discoverable at the start of a session as well as on demand. */
test('load_context and the SessionStart hook both carry the pending-revision notice', () => {
  const cwd = project();
  const id = governingRule(cwd);
  stageAgainstGoverning(cwd, id);

  const loaded = createRegistry(cwd).call('load_context', {});
  const injected = buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' });
  for (const [what, text] of [['load_context', loaded], ['SessionStart', injected]] as const) {
    assert.match(text, /pending revision\(s\)/, what);
    assert.match(text, new RegExp(`REV-[0-9a-f]+ → ${id}`), what);
    // The proposal is named, never carried.
    assert.doesNotMatch(text, /A proposal nobody has settled\./, what);
  }
  removeTree(cwd);
});

/**
 * The numbers have exactly one source (`pendingRevisionCounts`,
 * core/revision.ts). Two surfaces reporting different counts for one queue is
 * the defect that shipped five times in one plan, and the agent-facing
 * surfaces are now four more places it could happen.
 */
test('every agent-facing surface reports the same pending-revision count as the CLI', () => {
  const cwd = project();
  const id = governingRule(cwd);
  const registry = createRegistry(cwd);
  registry.call('update_item', { id, body: 'First proposal.' });
  registry.call('update_item', { id, title: 'Never log any customer email' });

  const surfaces: Record<string, string> = {
    get_item: createRegistry(cwd).call('get_item', { id }),
    query_items: createRegistry(cwd).call('query_items', {}),
    list_drafts: createRegistry(cwd).call('list_drafts', {}),
    load_context: createRegistry(cwd).call('load_context', {}),
    session_start: buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' }),
  };
  let cli = '';
  runCli(['review', 'revisions'], cwd, (s) => { cli += s + '\n'; });
  surfaces.cli = cli;

  for (const [name, text] of Object.entries(surfaces)) {
    const match = /(\d+) pending revision\(s\)/.exec(text);
    assert.ok(match, `${name} reports no count at all:\n${text}`);
    assert.equal(Number(match[1]), 2, `${name} disagrees about the queue length`);
  }
  removeTree(cwd);
});

test('an observation entry may still carry tags and context, and the schema says so', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'lesson', title: 'Locks matter',
    observations: [{ category: 'note', text: 'A DDL wedged staging.', tags: ['db'], context: 'ops' }],
  });
  const rendered = registry.call('get_item', { id: 'LESSON-locks-matter' });
  assert.match(rendered, /A DDL wedged staging\./);

  const schema = createRegistry(cwd).list().find((t) => t.name === 'create_item')!.inputSchema;
  const observations = (schema.properties as Record<string, { items: { properties: object } }>)
    .observations;
  assert.deepEqual(
    Object.keys(observations.items.properties).toSorted(),
    ['category', 'context', 'tags', 'text'],
  );
  removeTree(cwd);
});
