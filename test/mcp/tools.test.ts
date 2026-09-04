import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { splitProvenance } from '../../src/mcp/provenance.ts';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';
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

test('the registry exposes exactly the twenty-two implemented tools', () => {
  assert.deepEqual([...TOOL_NAMES].sort(), [
    'audit_log', 'create_item', 'decay_report', 'doctor', 'focus_context', 'get_item',
    'ingest_document', 'link_items', 'list_drafts', 'list_ingest_sessions', 'list_todos',
    'load_context', 'mycontext_examples', 'mycontext_help', 'preview_pack_import', 'query_items',
    'ready', 'refresh_item', 'stage_rule_candidates', 'status_report', 'supersede_item',
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

/**
 * A7/A8 on this project's board were both defects of exactly this shape: a
 * filter a caller could not learn to use without reading source. `ready` and
 * `doctor` are new enough to check by name rather than trust to the generic
 * pass above.
 */
test('every ready and doctor schema parameter carries a description', () => {
  const cwd = project();
  for (const name of ['ready', 'doctor']) {
    const tool = createRegistry(cwd).list().find((t) => t.name === name);
    assert.ok(tool, name);
    const properties = (tool!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    for (const [key, schema] of Object.entries(properties)) {
      const description = (schema as { description?: unknown }).description;
      assert.equal(typeof description, 'string', `${name}.${key} has no description`);
      assert.ok((description as string).length > 0, `${name}.${key}'s description is empty`);
    }
  }
  removeTree(cwd);
});

/**
 * A task written straight to disk, the way `test/cli/ready.test.ts` builds
 * its own fixtures — `task` ships in the default catalogue, so no config
 * override is needed here the way that file needs one for its own reasons.
 */
function writeTask(cwd: string, id: string, extra: Record<string, string>, title = `task ${id}`): void {
  const dir = path.join(cwd, '.my_context', 'items', 'task');
  mkdirSync(dir, { recursive: true });
  const fields = Object.entries(extra).map(([k, v]) => `${k}: "${v}"`).join('\n');
  writeFileSync(path.join(dir, `${id}.md`), [
    '---',
    `id: ${id}`,
    'type: task',
    `title: ${title}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    fields,
    '---',
    '',
    `# ${title}`,
    '',
  ].join('\n'), 'utf8');
}

/**
 * **`ready`: the tool returns what the CLI returns for the same input.**
 *
 * The load-bearing case from `test/cli/ready.test.ts`, replayed through the
 * tool: a blocked task whose blocker has landed is READY, and its satisfied
 * blocker is not on the list. Both surfaces call the identical
 * `readyReport` (core/needs.ts) — this pins that the tool actually reaches
 * it, not a second implementation that happens to agree today.
 */
test('ready: a blocked task whose blocker has landed appears; the blocker itself does not', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'done', priority: '1' });
    writeTask(cwd, 'TASK-walk-8', {
      plan: 'walk', seq: '8', state: 'blocked', priority: '1', needs: 'walk/7',
    });
    const out = createRegistry(cwd).call('ready', {});
    assert.match(out, /walk\/8/);
    assert.doesNotMatch(out, /walk\/7/);
  } finally {
    removeTree(cwd);
  }
});

test('ready: a held task is counted on every call and listed only with held: true', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-walk-8', {
      plan: 'walk', seq: '8', state: 'blocked', priority: '1', needs: 'walk/7',
    });
    const registry = createRegistry(cwd);
    const bare = registry.call('ready', {});
    assert.doesNotMatch(bare, /walk\/8/);
    assert.match(bare, /1 open task\(s\) held/);
    assert.match(bare, /a blocker has not landed/);

    const held = registry.call('ready', { held: true });
    assert.match(held, /walk\/8/);
  } finally {
    removeTree(cwd);
  }
});

test('ready: --plan narrowing and the limit default (50) are both reachable and documented', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-a', { plan: 'walk', seq: '1', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-b', { plan: 'port', seq: '1', state: 'todo', priority: '1' });
    const registry = createRegistry(cwd);
    const narrowed = registry.call('ready', { plan: 'walk' });
    assert.match(narrowed, /walk\/1/);
    assert.doesNotMatch(narrowed, /port\/1/);

    const tool = registry.list().find((t) => t.name === 'ready')!;
    const limitDesc = (tool.inputSchema as { properties: Record<string, { description: string }> })
      .properties.limit.description;
    assert.match(limitDesc, /50/, 'the default cap must be disclosed, not silent');
  } finally {
    removeTree(cwd);
  }
});

test('ready: says so, rather than a bare empty list, when no category plans work', () => {
  const cwd = project();
  try {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { task: { enabled: false } } }, null, 2) + '\n',
    );
    const out = createRegistry(cwd).call('ready', {});
    assert.match(out, /no enabled category in this project declares/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`doctor`: the tool returns what the CLI returns for the same input.**
 *
 * A corpus `mycontext doctor` calls clean must read clean here too.
 */
test('doctor: a clean corpus reports zero findings', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('doctor', {});
    assert.match(out, /0 error\(s\), 0 warning\(s\), 0 note\(s\) across 0 finding\(s\)\./);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **The anti-vacuity assertion.** A `Finding` carrying `about` is a note a
 * check makes about ITSELF, never a defect in the corpus (`Finding.about`,
 * doctor/checks.ts) — `checkStateUnaudited`'s `state_audit_coverage` is one.
 * A task written through the product (correct checksum, correct summary,
 * a real `create` audit record) whose audit log is then wiped is exactly the
 * "unmeasured set" shape that check discloses: `state_unaudited` never fires
 * per item because nothing said the item was ever seen, so the tool must
 * report ZERO findings while the disclosure itself is still reachable —
 * naming its own check by code, under its own `about`, in the same string.
 * `test/cli/doctor-disclosures.test.ts` pins the identical shape on the CLI;
 * this is that same fact asked of the tool.
 */
test('doctor: a corpus with a disclosure and no finding reports ZERO findings, and the disclosure is still reachable', () => {
  const cwd = project();
  try {
    assert.equal(runCli([
      'add', 'task', 'a done task', '--summary', 'A task used to exercise the disclosure path.',
      '--extra', 'plan=exp', '--extra', 'seq=1', '--extra', 'state=done', '--yes',
    ], cwd, () => {}), 0);
    rmSync(path.join(cwd, '.my_context', '.audit'), { recursive: true, force: true });

    const out = createRegistry(cwd).call('doctor', {});
    assert.match(out, /0 error\(s\), 0 warning\(s\), 0 note\(s\) across 0 finding\(s\)\./,
      'a disclosure with no finding beside it must still read as zero findings');
    assert.match(out, /state_audit_coverage — about the "state_unaudited" check/,
      'the disclosure must still be reachable, under its own check name');
  } finally {
    removeTree(cwd);
  }
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
  const text = registry.call('create_item', { summary_omitted: true,
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
    () => registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap', origin: 'human' }),
    /create_item does not take "origin"/,
  );
  // Refused before the handler ran, so nothing was written under any origin.
  assert.throws(() => registry.call('get_item', { id: 'CONST-pool-cap' }), /no item with id/);
  removeTree(cwd);
});

test('the origin refusal says why, rather than only that', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
      type: 'constraint', title: 'Pool cap', origin: 'human',
    }),
    /records origin "agent" itself/,
  );
  removeTree(cwd);
});

test('update_item refuses an origin argument, so an agent cannot self-attest as human', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
  createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });
  const second = createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });
  assert.match(second, /already captured as LESSON-locks-matter/);
  removeTree(cwd);
});

test('create_item with a bad type returns a teaching message', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'requirment', title: 'X' }),
    /closest match is "requirement"/,
  );
  removeTree(cwd);
});

test('create_item with a non-array scope is corrected, not coerced silently', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
      type: 'constraint', title: 'X', scope: 'src/db/**',
    }),
    /"scope" must be an array of strings/,
  );
  removeTree(cwd);
});

test('get_item returns the full Markdown and query_items finds it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true,
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Token check', scope: ['src/api/**'] });

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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Applies everywhere' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });

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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
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
    registry.call('create_item', { summary_omitted: true, type: 'lesson', title: `Lesson number ${i}` });
  }
  const out = registry.call('query_items', { type: 'lesson', limit: 5 });
  assert.equal(out.split('\n').filter((l) => l.startsWith('LESSON-')).length, 5);
  assert.match(out, /25 more/);
  removeTree(cwd);
});

/**
 * **B10 — the backlink query, on the MCP surface.** `relationDegrees` and
 * `apiGraph` (`src/ui/read-model.ts`) already walk every edge in both
 * directions; before this, no tool could answer "what points AT this item".
 * `linked_to` names the anchor and `direction` (`in|out|both`) says which side
 * of its edges to answer with.
 *
 * `CONST-hub` carries the case this feature exists for: a stored
 * `enforced_by` targeting `RULE-enforces-hub`. `enforced_by` is the PASSIVE
 * spelling — "the hub is enforced_by RULE-enforces-hub" means
 * `RULE-enforces-hub` enforces the hub — so the row's owner (`CONST-hub`) is
 * the party being pointed AT, backwards from the literal owner/target
 * columns `link_items` wrote it with. `direction: 'in'` on the hub must
 * still surface `RULE-enforces-hub`, and `direction: 'out'` on
 * `RULE-enforces-hub` must surface the hub — both derived from the one row,
 * exactly `DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two`'s
 * "a reader may want either" end.
 */
function backlinkFixture(registry: ReturnType<typeof createRegistry>): void {
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Hub' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Points at hub' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Hub points here' });
  registry.call('create_item', { summary_omitted: true, type: 'rule', title: 'Enforces hub' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Lonely item' });
  registry.call('link_items', { from: 'CONST-points-at-hub', to: 'CONST-hub', relation: 'constrains' });
  registry.call('link_items', { from: 'CONST-hub', to: 'CONST-hub-points-here', relation: 'relates_to' });
  registry.call('link_items', { from: 'CONST-hub', to: 'RULE-enforces-hub', relation: 'enforced_by' });
}

function idsFrom(text: string): string[] {
  return [...text.matchAll(/^([A-Z][A-Za-z0-9-]*) ·/gm)].map((m) => m[1]).sort();
}

test('query_items direction:in finds what points at the anchor, through the passive enforced_by row', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  const out = registry.call('query_items', { linked_to: 'CONST-hub', direction: 'in' });
  assert.deepEqual(idsFrom(out), ['CONST-points-at-hub', 'RULE-enforces-hub'].sort());
  removeTree(cwd);
});

test('query_items direction:out excludes what merely points at the anchor', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  const out = registry.call('query_items', { linked_to: 'CONST-hub', direction: 'out' });
  assert.deepEqual(idsFrom(out), ['CONST-hub-points-here']);
  removeTree(cwd);
});

test('query_items direction:both is the union', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  const out = registry.call('query_items', { linked_to: 'CONST-hub', direction: 'both' });
  assert.deepEqual(
    idsFrom(out),
    ['CONST-points-at-hub', 'CONST-hub-points-here', 'RULE-enforces-hub'].sort(),
  );
  removeTree(cwd);
});

test('query_items linked_to with no direction defaults to both', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  const both = registry.call('query_items', { linked_to: 'CONST-hub', direction: 'both' });
  const defaulted = registry.call('query_items', { linked_to: 'CONST-hub' });
  assert.deepEqual(idsFrom(defaulted), idsFrom(both),
    'an out-only default would hide every item that only points AT the anchor');
  removeTree(cwd);
});

test('query_items reads the inverse pair correctly from the other end too', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  assert.deepEqual(
    idsFrom(registry.call('query_items', { linked_to: 'RULE-enforces-hub', direction: 'out' })),
    ['CONST-hub'],
  );
  assert.match(
    registry.call('query_items', { linked_to: 'RULE-enforces-hub', direction: 'in' }),
    /no items match/i,
  );
  removeTree(cwd);
});

test('query_items linked_to on an item with zero inbound answers empty', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  assert.match(
    registry.call('query_items', { linked_to: 'CONST-lonely-item', direction: 'in' }),
    /no items match/i,
  );
  removeTree(cwd);
});

test('query_items linked_to an item with inbound edges of several relation types returns every one', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Magnet' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'X one' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'X two' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'X three' });
  registry.call('link_items', { from: 'CONST-x-one', to: 'CONST-magnet', relation: 'constrains' });
  registry.call('link_items', { from: 'CONST-x-two', to: 'CONST-magnet', relation: 'depends_on' });
  registry.call('link_items', { from: 'CONST-x-three', to: 'CONST-magnet', relation: 'blocks' });
  const out = registry.call('query_items', { linked_to: 'CONST-magnet', direction: 'in' });
  assert.deepEqual(idsFrom(out), ['CONST-x-one', 'CONST-x-three', 'CONST-x-two']);
  removeTree(cwd);
});

/**
 * `superseded_by` again — `RELATION_TYPES` deliberately excludes it (it is
 * the write gate `link_items` refuses it under), so a `linked_to` + `relation`
 * combination must not be checked against that vocabulary either, or it
 * refuses the one edge type `supersede_item` actually writes.
 */
test('query_items direction finds a real superseded_by edge from both the retired item and its replacement', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Old item' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'New item' });
  registry.call('supersede_item', { id: 'CONST-old-item', by: 'CONST-new-item' });

  assert.deepEqual(
    idsFrom(registry.call('query_items', {
      linked_to: 'CONST-old-item', direction: 'out', relation: 'superseded_by',
    })),
    ['CONST-new-item'],
  );
  assert.deepEqual(
    idsFrom(registry.call('query_items', {
      linked_to: 'CONST-new-item', direction: 'in', relation: 'superseded_by',
    })),
    ['CONST-old-item'],
  );
  removeTree(cwd);
});

test('query_items refuses a direction outside in|out|both', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  backlinkFixture(registry);
  assert.throws(
    () => registry.call('query_items', { linked_to: 'CONST-hub', direction: 'sideways' }),
    /must be one of.*in.*out.*both/s,
  );
  removeTree(cwd);
});

test('list_drafts is the review queue', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });

  const drafts = registry.call('list_drafts', {});
  assert.match(drafts, /CONST-pool-cap/);
  assert.equal(/LESSON-locks-matter/.test(drafts), false);
  removeTree(cwd);
});

test('supersede_item retires without deleting when one agent-authored draft supersedes another', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 20' });

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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 20' });

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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 20' });
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active' }),
    /cannot change the status of a normative item/i,
  );
  removeTree(cwd);
});

test('link_items records a relation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { summary_omitted: true, type: 'adr', title: 'Managed Postgres' });
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
    () => createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'constraint' }),
    /create_item requires "title"/,
  );
  removeTree(cwd);
});

test('calling a tool outside a workspace explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'constraint', title: 'X' }),
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

  const drafts = splitProvenance(createRegistry(cwd).call('list_drafts', {})).answer;
  const ids = drafts.split('\n').map((l) => l.split(' · ')[0]);
  assert.deepEqual(ids, ['CONST-zzz', 'CONST-aaa']);
  removeTree(cwd);
});

test('list_drafts ties on valid_from break by id ascending, for determinism', () => {
  const cwd = project();
  writeRawDraft(cwd, { id: 'CONST-bbb', title: 'Bbb item', validFrom: '2026-01-01' });
  writeRawDraft(cwd, { id: 'CONST-aaa', title: 'Aaa item', validFrom: '2026-01-01' });

  const drafts = splitProvenance(createRegistry(cwd).call('list_drafts', {})).answer;
  const ids = drafts.split('\n').map((l) => l.split(' · ')[0]);
  assert.deepEqual(ids, ['CONST-aaa', 'CONST-bbb']);
  removeTree(cwd);
});

test('update_item can correct an extra field set at creation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'risk', title: 'Vendor outage', likelihood: 'low' });
  registry.call('update_item', { summary_unchanged: true, id: 'RISK-vendor-outage', extra: { likelihood: 'high' } });
  assert.match(registry.call('get_item', { id: 'RISK-vendor-outage' }), /likelihood: high/);
  removeTree(cwd);
});

/**
 * `create_item`'s flattened extra-field arguments come from
 * `extraFieldSchema(DEFAULT_CONFIG)` — the STATIC default config, which knows
 * every BUILT-IN category's extra fields and nothing a project has added of
 * its own in `config.json`. `update_item` never had this gap: its schema
 * already carries a genuine free-form `extra: {type: 'object', ...}`, honoured
 * by `updateItem` regardless of which project declared the field. `create_item`
 * now carries the same escape hatch, mirroring `update_item`'s.
 */
test('create_item can capture a project-defined extra field, the way update_item already can', () => {
  const cwd = project();
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    `${JSON.stringify({ profile: 'standard', categories: { task: { extraFields: ['owner_team'] } } }, null, 2)}\n`,
    'utf8',
  );
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    summary_omitted: true, type: 'task', title: 'Rotate secrets', extra: { owner_team: 'platform' },
  });
  assert.match(registry.call('get_item', { id: 'TASK-rotate-secrets' }), /owner_team: platform/);
  removeTree(cwd);
});

/** The free-form `extra` merges with, rather than silently overwrites, the
 * flattened built-in fields the schema already advertises — both routes into
 * the same item at once, on fields that do not collide. */
test('create_item merges a project-defined extra field alongside a built-in flattened one', () => {
  const cwd = project();
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    `${JSON.stringify({ profile: 'standard', categories: { risk: { extraFields: ['owner_team'] } } }, null, 2)}\n`,
    'utf8',
  );
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    summary_omitted: true, type: 'risk', title: 'Vendor outage', likelihood: 'low', extra: { owner_team: 'platform' },
  });
  const stored = registry.call('get_item', { id: 'RISK-vendor-outage' });
  assert.match(stored, /likelihood: low/);
  assert.match(stored, /owner_team: platform/);
  removeTree(cwd);
});

/** A field named both ways is refused rather than letting one silently win —
 * the same shape `unknownExtraFieldError` refuses an unrecognised field with
 * elsewhere in this file. */
test('create_item refuses a field passed both as a flattened argument and inside extra', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.throws(
    () => registry.call('create_item', {
      summary_omitted: true, type: 'risk', title: 'Vendor outage', likelihood: 'low', extra: { likelihood: 'high' },
    }),
    /"likelihood" was passed both as a top-level argument and inside "extra"/,
  );
  // Nothing was written — the refusal happens before the item is created.
  assert.throws(() => registry.call('get_item', { id: 'RISK-vendor-outage' }), /no item with id/);
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
  registry.call('create_item', { summary_omitted: true, type: 'lesson', title: 'A rationale item', body: 'b' });
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
  const created = registry.call('create_item', { summary_omitted: true,
    type: 'constraint', title: 'Pool capped at 20', body: 'b', always: true,
  });
  assert.doesNotMatch(created, /INERT/);
  const updated = registry.call('update_item', {
    id: 'CONST-pool-capped-at-20', always: true, body: 'Measured.',
    summary: 'A sentence for the fixture.',
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
  registry.call('create_item', { summary_omitted: true, type: 'risk', title: 'Vendor outage' });
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
  registry.call('create_item', { summary_omitted: true, type: 'risk', title: 'Vendor outage' });
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
  const withNull = registry.call('create_item', { summary_omitted: true,
    type: 'constraint', title: 'Pool cap A', source_file: null,
  });
  const omitted = registry.call('create_item', { summary_omitted: true,
    type: 'constraint', title: 'Pool cap B',
  });
  assert.match(withNull, /created/);
  assert.match(omitted, /created/);
  removeTree(cwd);
});

test('an explicit null on an optional boolean field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', always: null });
  assert.match(text, /updated/);
  removeTree(cwd);
});

test('an explicit null limit falls back to the default, like an omitted one', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });
  const text = registry.call('query_items', { type: 'lesson', limit: null });
  assert.match(text, /LESSON-locks-matter/);
  removeTree(cwd);
});

test('an explicit null extra behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  const text = registry.call('update_item', { id: 'CONST-pool-cap', extra: null });
  assert.match(text, /updated/);
  removeTree(cwd);
});

test('an explicit null on an optional array field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  // scope: null must create successfully — not throw "must be an array of
  // strings" — and behave the same as never passing scope at all.
  const text = registry.call('create_item', { summary_omitted: true,
    type: 'constraint', title: 'Pool cap', scope: null,
  });
  assert.match(text, /created/);
  removeTree(cwd);
});

test('an explicit null on an optional enum field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  // status: null on query_items must not throw an enum error — it must
  // behave as though status were never passed, i.e. no status filter.
  const text = registry.call('query_items', { type: 'constraint', status: null });
  assert.match(text, /CONST-pool-cap/);
  removeTree(cwd);
});

test('an explicit null on the observations field behaves exactly like omitting it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', { summary_omitted: true,
    type: 'lesson', title: 'Locks matter', observations: null,
  });
  assert.match(text, /created/);
  removeTree(cwd);
});

test('a per-entry observation context: null is unaffected by the top-level null handling', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', { summary_omitted: true,
    type: 'lesson', title: 'Locks matter',
    observations: [{ category: 'symptom', text: 'Duplicate column errors', context: null }],
  });
  assert.match(text, /created/);
  removeTree(cwd);
});

test('an explicit null does not bypass wrong-type rejection for a real array or enum violation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  // A bare string (not null, not an array) is still refused for scope.
  assert.throws(
    () => registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'X', scope: 'src/db/**' }),
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
      type: 'lesson', title: 'X', observations: [{ text: 'no category here' }],
    }),
    /observations\[0\] is missing "category"/,
  );
  removeTree(cwd);
});

test('create_item refuses an observation with a non-string text, rather than stringifying it', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
  const out = registry.call('get_item', { id: 'CONST-pool-cap' });
  assert.equal(/could not be read during rebuild/.test(out), false);
  removeTree(cwd);
});

/**
 * The inversion of what this test used to assert. `kind` on a `constraint`
 * was accepted "since it is typical usage, not an enforced restriction" — the
 * whole reason `extraFields` could not be set in config, because a field
 * declared there would have been honoured on every category. Ownership is
 * enforced now (`unknownExtraFieldError`, core/trust.ts), so the schema being
 * a union is a statement about the ARGUMENT LIST and no longer about what any
 * one category accepts.
 *
 * The argument still reaches the handler — `create_item` advertises `kind`, so
 * `checkUnknownArgs` lets it through — and the refusal comes from validation,
 * which is where it can know the item's category.
 */
test('create_item refuses kind on a constraint, naming the category and what it declares', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.throws(
    () => registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Weird', kind: 'x' }),
    (err: Error) => {
      assert.match(err.message, /extra field "kind" is not declared by "constraint"/);
      assert.match(err.message, /declares no extra fields at all/);
      // Where to go, not merely "no": the category that does own the field.
      assert.match(err.message, /"kind" is declared by requirement/);
      assert.match(err.message, /categories\.constraint\.extraFields/);
      return true;
    },
  );
  // ...and the same field on the category that DOES declare it still lands.
  assert.match(
    registry.call('create_item', { summary_omitted: true, type: 'requirement', title: 'Reset flow', kind: 'functional' }),
    /created/,
  );
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
    'type', 'title', 'body', 'summary', 'summary_omitted', 'scope', 'tags', 'severity', 'always',
    'observations', 'steps', 'source_file', 'source_anchor', 'extra',
  ]);
  for (const key of Object.keys(props)) {
    assert.ok(core.has(key) || declared.includes(key), `schema has undeclared property "${key}"`);
  }
  removeTree(cwd);
});

test('create_item stores validated_on, which the hardcoded harvest silently dropped', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true,
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
  registry.call('create_item', { summary_omitted: true,
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
  // `.answer`, and the split is the point rather than a concession: the two
  // paths must produce the same SELECTION, and the MCP surface additionally
  // names the corpus it resolved on every result (`mcp/provenance.ts`). The
  // hook has no such envelope because its own text carries the disclosure a
  // hook needs. Asserted below rather than merely dropped, so the envelope
  // cannot quietly stop appearing.
  const { answer, provenance } = splitProvenance(createRegistry(cwd).call('load_context', {}));
  assert.equal(answer, buildSessionStartOutput(cwd));
  assert.equal(provenance, `my_context corpus: ${path.join(cwd, '.my_context')}.`);
  removeTree(cwd);
});

test('load_context leaves an unpinned item in the index, not in the governing block', () => {
  const cwd = corpus();
  const out = createRegistry(cwd).call('load_context', {});
  const indexAt = out.indexOf('## my_context index');
  assert.ok(indexAt > 0, 'the index section is present');
  // Not delivered in full: no full-text heading (`### id ·`) for it anywhere.
  assert.equal(out.includes('### CONST-token-checked ·'), false,
    'an unpinned item must not be in the full-text governing block');
  // It IS a `constraint` — a GOVERNING category — so it legitimately appears
  // ahead of the index too, named as title-only rather than silently indexed
  // (`TASK-a-governing-item-degraded-to-an-index-line-looks-delivered`). Its
  // own index BULLET is what belongs after the index heading.
  assert.ok(
    out.indexOf('- CONST-token-checked ·') > indexAt,
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

/**
 * This test used to require the description to say load_context's output is
 * "not restored after a compaction", which is false: executing PreCompact →
 * SessionStart(compact) restores a manually-loaded item in full, because the
 * snapshot scans the transcript for ids. The pin is kept and repointed rather
 * than removed — it is the reason this description cannot drift away from the
 * command file, the skill and both READMEs, which all carry the same claim.
 *
 * The description is the surface the MODEL reads, so the condition has to be
 * in it: an agent told "restored" without "only if" will assume a rule is
 * still in force when it is not, which is the exact failure this corpus
 * exists to prevent.
 */
test("load_context's description states the real compaction behaviour, conditionally", () => {
  const cwd = project();
  const spec = createRegistry(cwd).list().find((t) => t.name === 'load_context');
  const description = spec!.description;
  // "never" as well as "not": a bare negation in front of the claim satisfies
  // every positive assertion below, which mutation testing demonstrated on
  // the sibling pin in test/plugin-assets.test.ts.
  assert.doesNotMatch(
    description, /(?:never|not) restored after a compaction/i,
    'the false claim must not come back — it shipped on eight surfaces once already',
  );
  assert.match(
    description, /restored after a compaction only if/i,
    'the condition belongs in the same sentence as the claim',
  );
  assert.match(
    description, /the transcript still shows the ids/i,
    'the mechanism restore actually depends on — and the reason "usually" is true',
  );
  assert.match(
    description, /never rationale/i,
    'the one exception an agent will otherwise get wrong',
  );
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
    () => registry.call('create_item', { summary_omitted: true,
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
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool capped at 20' });
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
    () => registry.call('create_item', { summary_omitted: true,
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
  registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });
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
  const text = registry.call('create_item', { summary_omitted: true,
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
  // A summary rather than `summary_unchanged`: under `agentEdits: "review"` the
  // hatch is refused outright, because a staged revision has nowhere to carry
  // "the summary still describes this". A summary IS stageable, so this is the
  // shape an agent's proposal has to take on a governing item.
  registry.call('update_item', {
    id, body: 'A proposal nobody has settled.', summary: 'A proposed sentence.',
  });
}

/** A governing normative item, so an agent's content edit stages rather than
 * applying — `agentEdits` defaults to `review` on every normative category. */
function governingRule(cwd: string): string {
  const registry = createRegistry(cwd);
  registry.call('create_item', { summary_omitted: true,
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
  createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });

  const other = createRegistry(cwd).call('get_item', { id: 'LESSON-locks-matter' });
  assert.doesNotMatch(other, /pending revision/);
  removeTree(cwd);
});

test('query_items marks the items whose text is pre-proposal, and reports the queue', () => {
  const cwd = project();
  const id = governingRule(cwd);
  createRegistry(cwd).call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });
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
  registry.call('update_item', { id, body: 'First proposal.', summary: 'A proposed sentence.' });
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
  registry.call('create_item', { summary_omitted: true,
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

/**
 * `create_item{steps}` — the write surface the model actually uses, exercised
 * through the real registry rather than through `createItem` directly, because
 * the registry is where the argument gate and the advertised schema live and
 * either one can refuse a field the handler would have accepted.
 */
function stepsOnDisk(cwd: string, filePath: string): { text: string; checked: boolean }[] {
  const file = readFileSync(path.join(cwd, '.my_context', ...filePath.split('/')), 'utf8');
  const item = parseItem(file, filePath, 'project');
  // The round trip, not `file.includes(text)`: a line this write produced that
  // `parseSteps` refuses would satisfy `includes` and never load again.
  assert.equal(renderItem(item), file, 'the file create_item produced must survive re-rendering');
  return item.steps;
}

test('create_item accepts steps and they land unchecked', () => {
  const cwd = project();
  const text = createRegistry(cwd).call('create_item', { summary_omitted: true,
    type: 'procedure',
    title: 'Rotate the webhook secret',
    body: 'The live secret leaked.',
    steps: [
      'Deploy the next secret beside the live one',
      'Roll the endpoint secret',
      'Promote and redeploy',
    ],
  });
  assert.match(text, /PROC-rotate-the-webhook-secret/);
  assert.deepEqual(
    stepsOnDisk(cwd, 'items/procedure/PROC-rotate-the-webhook-secret.md'),
    [
      { text: 'Deploy the next secret beside the live one', checked: false },
      { text: 'Roll the endpoint secret', checked: false },
      { text: 'Promote and redeploy', checked: false },
    ],
  );
  removeTree(cwd);
});

test('create_item exposes nothing about `checked`, and refuses a Step-shaped array', () => {
  // "Nothing in this product ever writes `checked: true`" is true by
  // construction at the boundary rather than by convention: the field is
  // `string[]`, so a model that sends `{text, checked}` is corrected rather
  // than partially honoured. A box is ticked only by a human editing the file.
  const cwd = project();
  const schema = createRegistry(cwd).list().find((t) => t.name === 'create_item')!.inputSchema;
  const steps = (schema.properties as Record<string, Record<string, unknown>>).steps;
  assert.deepEqual(steps.items, { type: 'string' });
  assert.equal(JSON.stringify(schema).includes('checked'), false);
  assert.throws(
    () => createRegistry(cwd).call('create_item', { summary_omitted: true,
      type: 'procedure', title: 'Rotate it', steps: [{ text: 'Roll it', checked: true }],
    }),
    /"steps" must be an array of strings/,
  );
  removeTree(cwd);
});

test('the steps schema makes the offer for `procedure` and says where a runbook keeps its own', () => {
  // Design decision 19: steps are ACCEPTED on every category, so the only
  // thing separating the two is where the offer is made. This description is
  // one of the places §6o's boundary has to be stated at capture time.
  const cwd = project();
  const schema = createRegistry(cwd).list().find((t) => t.name === 'create_item')!.inputSchema;
  const steps = (schema.properties as Record<string, Record<string, unknown>>).steps;
  const description = String(steps.description);
  assert.match(description, /procedure/);
  assert.match(description, /runbook/);
  // And that progress is never stored in the item — the ruling a model reading
  // this schema is most likely to violate by inventing a "done" field.
  assert.match(description, /progress is never stored/);
  removeTree(cwd);
});

/* -------------------------------------------------------------------- *
 * mcp/4 — six more read-only tools, the same shape `ready` and `doctor`
 * were: no mutation, no origin, each wrapping the function the CLI command
 * itself already calls.
 * -------------------------------------------------------------------- */

const NEW_READ_ONLY_TOOLS = [
  'decay_report', 'list_ingest_sessions', 'stage_rule_candidates',
  'preview_pack_import', 'status_report', 'list_todos',
];

/**
 * The A7/A8 check `ready` and `doctor` got by name, extended to the six new
 * tools rather than widened to every tool on the surface: some existing
 * schemas (`create_item.tags`, for one) predate this pin and are not this
 * task's to fix.
 */
test('every schema parameter of the six new read-only tools carries a description', () => {
  const cwd = project();
  for (const name of NEW_READ_ONLY_TOOLS) {
    const tool = createRegistry(cwd).list().find((t) => t.name === name);
    assert.ok(tool, name);
    const properties = (tool!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    for (const [key, schema] of Object.entries(properties)) {
      const description = (schema as { description?: unknown }).description;
      assert.equal(typeof description, 'string', `${name}.${key} has no description`);
      assert.ok((description as string).length > 0, `${name}.${key}'s description is empty`);
      // `stage_rule_candidates.candidates` is an array of objects — its own
      // nested properties must carry descriptions too, or a caller learns
      // the candidate shape only by reading source.
      const items = (schema as { items?: { properties?: Record<string, unknown> } }).items;
      if (items?.properties) {
        for (const [innerKey, innerSchema] of Object.entries(items.properties)) {
          const innerDescription = (innerSchema as { description?: unknown }).description;
          assert.equal(
            typeof innerDescription, 'string', `${name}.${key}[].${innerKey} has no description`,
          );
          assert.ok(
            (innerDescription as string).length > 0, `${name}.${key}[].${innerKey}'s description is empty`,
          );
        }
      }
    }
  }
  removeTree(cwd);
});

/**
 * **`decay_report`: the tool returns what `mycontext decay` returns for the
 * same input.** Both call `computeDecay` (core/decay.ts) directly.
 */
test('decay_report: a freshly captured active normative item is cold and never injected', () => {
  const cwd = project();
  try {
    assert.equal(runCli([
      'add', 'constraint', 'Pool capped at 20', '--summary', 'A capped connection pool.', '--yes',
    ], cwd, () => {}), 0);

    const out = createRegistry(cwd).call('decay_report', {});
    assert.match(out, /CONST-pool-capped-at-20/);
    assert.match(out, /never injected/);
    assert.match(out, /"cold" means:/);
    assert.match(out, /cold \(1\)/);
  } finally {
    removeTree(cwd);
  }
});

test('decay_report: an empty corpus says so rather than an empty cold list', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('decay_report', {});
    assert.match(out, /nothing to report — no active normative items/);
  } finally {
    removeTree(cwd);
  }
});

test('decay_report refuses a non-integer "sessions" rather than rounding it', () => {
  const cwd = project();
  try {
    assert.throws(
      () => createRegistry(cwd).call('decay_report', { sessions: 1.5 }),
      /"sessions" must be a positive whole number/,
    );
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`list_ingest_sessions`: the tool returns what `mycontext ingest-status`
 * returns for the same input.** Both read `listSessions`/`pendingAnchors`
 * (ingest/session.ts) directly.
 */
test('list_ingest_sessions: no sessions says so', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('list_ingest_sessions', {});
    assert.match(out, /no ingest sessions/);
  } finally {
    removeTree(cwd);
  }
});

test('list_ingest_sessions: a session opened by ingest_document is listed, pending', () => {
  const cwd = project();
  try {
    writeFileSync(
      path.join(cwd, 'doc.md'),
      '# Doc\n\n## One\n\nEvery deploy must pass CI before it reaches production.\n',
      'utf8',
    );
    const registry = createRegistry(cwd);
    const first = registry.call('ingest_document', { path: 'doc.md' });
    const sessionId = first.match(/"session":\s*"([^"]+)"/)?.[1];
    assert.ok(sessionId, `no session id found in:\n${first}`);

    const out = registry.call('list_ingest_sessions', {});
    assert.match(out, new RegExp(sessionId!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(out, /pending/);
    assert.match(out, /doc\.md/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`stage_rule_candidates`: the tool returns what `mycontext lesson-stage`
 * returns for the same input.** Both call `stageRuleCandidates`
 * (lesson/derive.ts) directly, and neither creates an item.
 */
test('stage_rule_candidates: stages a candidate on disk and creates no item', () => {
  const cwd = project();
  try {
    const registry = createRegistry(cwd);
    registry.call('create_item', { summary_omitted: true, type: 'lesson', title: 'Locks matter' });

    const out = registry.call('stage_rule_candidates', {
      lesson: 'LESSON-locks-matter',
      candidates: [
        { title: 'Always take the row lock first', directive: 'do', body: 'Two deploys collided without it.' },
      ],
    });
    assert.match(out, /1 rule candidate\(s\) staged for LESSON-locks-matter/);
    assert.match(out, /None of them exists as an item yet/);
    assert.match(out, /Accept with: mycontext lesson-accept LESSON-locks-matter/);

    // Nothing was created — staging writes to `.staging/`, never to `.my_context/items/`.
    const rules = registry.call('query_items', { type: 'rule' });
    assert.match(rules, /no items match/);
  } finally {
    removeTree(cwd);
  }
});

test('stage_rule_candidates on an unknown lesson id is refused, naming the closest match', () => {
  const cwd = project();
  try {
    assert.throws(
      () => createRegistry(cwd).call('stage_rule_candidates', {
        lesson: 'LESSON-does-not-exist', candidates: [],
      }),
      /no item with id/,
    );
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`preview_pack_import`: the tool stops exactly where `CLI_WITHOUT_SLASH.pack`
 * already said a preview should — the collision report, then the command a
 * human runs. It never calls `applyImport`.**
 */
test('preview_pack_import: no packs imported yet says so', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('preview_pack_import', {});
    assert.match(out, /no packs have been imported/);
  } finally {
    removeTree(cwd);
  }
});

test('preview_pack_import: previews an artefact and never imports it', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'myctx-tools-pack-source-'));
  const cwd = project();
  try {
    assert.equal(runCli(['init'], source, () => {}), 0);
    assert.equal(runCli([
      'add', '--summary-omitted', 'constraint', 'Pool capped at 20', '--yes',
    ], source, () => {}), 0);
    const artefact = path.join(source, 'artefact');
    assert.equal(runCli([
      'export', '--out', artefact, '--as-pack', '--pack-name', 'acme', '--pack-version', '1.0.0',
    ], source, () => {}), 0);

    const registry = createRegistry(cwd);
    const out = registry.call('preview_pack_import', { path: artefact });
    assert.match(out, /pack: acme/);
    assert.match(out, /CONST-pool-capped-at-20/);
    assert.match(out, /Nothing was imported — this tool only previews/);
    assert.match(out, new RegExp(`mycontext pack import ${artefact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

    // Nothing actually landed: no item, and no import record.
    assert.match(registry.call('query_items', { type: 'constraint' }), /no items match/);
    assert.match(registry.call('preview_pack_import', {}), /no packs have been imported/);
  } finally {
    removeTree(cwd);
    removeTree(source);
  }
});

/**
 * **`status_report`: the tool returns what `mycontext status` returns for
 * the same input.** Both compose `runChecks`, `computeDecay`, `listSessions`
 * and the review queue.
 */
test('status_report: counts items and reports the review queue', () => {
  const cwd = project();
  try {
    const registry = createRegistry(cwd);
    registry.call('create_item', { summary_omitted: true, type: 'constraint', title: 'Pool cap' });

    const out = registry.call('status_report', {});
    assert.match(out, /1 item\(s\)/);
    assert.match(out, /review queue: 1 draft\(s\) pending review/);
    assert.match(out, /health: 0 error\(s\)/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`list_todos`: the tool returns what `mycontext todo` returns for the
 * same input.** Both call `filterItems` (core/search.ts) with `type: 'todo'`.
 */
test('list_todos: no todos says so', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('list_todos', {});
    assert.match(out, /no todo items/);
  } finally {
    removeTree(cwd);
  }
});

test('list_todos: a captured todo is listed, and the rationale-tier note is printed', () => {
  const cwd = project();
  try {
    assert.equal(runCli(['add', '--summary-omitted', 'todo', 'Ping the billing team about the export bug'], cwd, () => {}), 0);
    const out = createRegistry(cwd).call('list_todos', {});
    assert.match(out, /Ping the billing team/);
    assert.match(out, /rationale tier/);
  } finally {
    removeTree(cwd);
  }
});

test('list_todos: --tag narrows, and the "all" flag is required to include retired ones', () => {
  const cwd = project();
  try {
    assert.equal(runCli(['add', '--summary-omitted', 'todo', 'Untagged one'], cwd, () => {}), 0);
    assert.equal(runCli(['add', '--summary-omitted', 'todo', 'Tagged one', '--tags', 'billing'], cwd, () => {}), 0);

    const registry = createRegistry(cwd);
    const narrowed = registry.call('list_todos', { tag: 'billing' });
    assert.match(narrowed, /Tagged one/);
    assert.doesNotMatch(narrowed, /Untagged one/);
  } finally {
    removeTree(cwd);
  }
});

/** Every one of the six new tools has a `TOOL_PARITY` row, and the CLI
 * command it wraps no longer appears in `CLI_WITHOUT_TOOL` — checked here
 * directly rather than trusted to `test/plugin/parity.test.ts`'s generic
 * derived-set comparison alone, since that comparison would pass just as
 * well if a tool answered the WRONG CLI command. */
test('each of the six new tools has a TOOL_PARITY row naming its CLI command', async () => {
  const { TOOL_PARITY, CLI_WITHOUT_TOOL } = await import('../../src/plugin/parity.ts');
  const expected: Record<string, string> = {
    decay_report: 'decay',
    list_ingest_sessions: 'ingest-status',
    stage_rule_candidates: 'lesson-stage',
    preview_pack_import: 'pack',
    status_report: 'status',
    list_todos: 'todo',
  };
  for (const [tool, cli] of Object.entries(expected)) {
    const row = TOOL_PARITY.find((r) => r.tool === tool);
    assert.ok(row, `${tool} has no TOOL_PARITY row`);
    assert.equal(row!.cli, cli, `${tool}'s TOOL_PARITY row does not claim ${cli}`);
    assert.equal(Object.hasOwn(CLI_WITHOUT_TOOL, cli), false, `${cli} is still in CLI_WITHOUT_TOOL`);
  }
});
