/**
 * **Three more owed reads land: `list_items`, `create_lesson`, `read_procedure`.**
 *
 * `TASK-list-has-no-mcp-tool-and-it-is-the-one-owed-read-whose` and
 * `TASK-lesson-and-procedure-have-no-mcp-tool-and-each-needs-a-shape` (plan:mcp
 * seq:5, seq:6). Each tool gets the same treatment `test/mcp/tools.test.ts`
 * gives the six read-only tools from seq:4: a real call, real output, and a
 * `TOOL_PARITY` row checked directly rather than trusted to the generic
 * derived-set comparison alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-llp-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function itemOrigin(cwd: string, id: string): string | undefined {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  try {
    return store.get(id)?.origin;
  } finally {
    store.close();
  }
}

// ---------------------------------------------------------------------------
// list_items
// ---------------------------------------------------------------------------

test('list_items is registered', () => {
  assert.ok(TOOL_NAMES.includes('list_items'));
});

test('list_items: an empty corpus says so', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('list_items', {});
    assert.match(out, /no items in this corpus/);
  } finally {
    removeTree(cwd);
  }
});

test('list_items: with no category, returns a per-category census — counts, not items', () => {
  const cwd = project();
  try {
    assert.equal(runCli(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd, () => {}), 0);
    assert.equal(runCli(['add', '--summary-omitted', 'constraint', 'Timeout cap', '--yes'], cwd, () => {}), 0);
    assert.equal(runCli(['add', '--summary-omitted', 'requirement', 'Must log in', '--yes'], cwd, () => {}), 0);

    const out = createRegistry(cwd).call('list_items', {});
    assert.match(out, /constraint · 2/);
    assert.match(out, /requirement · 1/);
    // A census, not the item titles.
    assert.doesNotMatch(out, /Pool cap/);
  } finally {
    removeTree(cwd);
  }
});

test('list_items: a category filters to that category\'s items, the overlap with query_items', () => {
  const cwd = project();
  try {
    assert.equal(runCli(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd, () => {}), 0);
    assert.equal(runCli(['add', '--summary-omitted', 'requirement', 'Must log in', '--yes'], cwd, () => {}), 0);

    const registry = createRegistry(cwd);
    const out = registry.call('list_items', { category: 'constraint' });
    assert.match(out, /Pool cap/);
    assert.doesNotMatch(out, /Must log in/);

    const queried = registry.call('query_items', { type: 'constraint' });
    assert.match(queried, /Pool cap/);
  } finally {
    removeTree(cwd);
  }
});

test('list_items: an unknown category is refused, naming the closest match', () => {
  const cwd = project();
  try {
    assert.throws(
      () => createRegistry(cwd).call('list_items', { category: 'constraintt' }),
      /must be one of.*constraint/s,
    );
  } finally {
    removeTree(cwd);
  }
});

// ---------------------------------------------------------------------------
// create_lesson
// ---------------------------------------------------------------------------

test('create_lesson is registered', () => {
  assert.ok(TOOL_NAMES.includes('create_lesson'));
});

test('create_lesson: records a lesson with origin "agent", unconditionally', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('create_lesson', { subject: 'The retry loop needed a cap' });
    assert.match(out, /recorded as origin: agent/);
    assert.match(out, /rationale tier/);

    // Inspecting what was actually written, not just what the tool said.
    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    try {
      const all = store.all().filter((i) => i.type === 'lesson');
      assert.equal(all.length, 1);
      assert.equal(all[0]!.origin, 'agent');
      assert.equal(all[0]!.status, 'active');
    } finally {
      store.close();
    }
  } finally {
    removeTree(cwd);
  }
});

test('create_lesson: takes no origin argument at all', () => {
  const cwd = project();
  try {
    assert.throws(
      () => createRegistry(cwd).call('create_lesson', { subject: 'x', origin: 'human' }),
      /does not take "origin"/,
    );
  } finally {
    removeTree(cwd);
  }
});

test('create_lesson: calling twice with the same wording re-derives instead of duplicating', () => {
  const cwd = project();
  try {
    const registry = createRegistry(cwd);
    const first = registry.call('create_lesson', { subject: 'The retry loop needed a cap' });
    assert.match(first, /recorded as origin: agent/);
    const second = registry.call('create_lesson', { subject: 'The retry loop needed a cap' });
    assert.match(second, /already recorded — nothing was written/);

    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    try {
      assert.equal(store.all().filter((i) => i.type === 'lesson').length, 1);
    } finally {
      store.close();
    }
  } finally {
    removeTree(cwd);
  }
});

test('create_lesson: prints the rule-derivation request', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('create_lesson', { subject: 'The retry loop needed a cap' });
    assert.match(out, /"protocol"/);
    assert.match(out, /mycontext lesson-stage/);
  } finally {
    removeTree(cwd);
  }
});

// ---------------------------------------------------------------------------
// read_procedure
// ---------------------------------------------------------------------------

function addProcedure(cwd: string, title: string): void {
  assert.equal(
    runCli(
      ['add', '--summary-omitted', 'procedure', title, '--step', 'first step', '--step', 'second step', '--yes'],
      cwd, () => {},
    ),
    0,
  );
}

/** A `--summary-omitted --yes` `add` is HUMAN origin, so a normative item
 * (procedure included) lands `active` at once — there is no `--agent` flag
 * on `add`. To exercise a procedure that is still in the `proposed` stage
 * (not yet active), capture it as an agent would: through `create_item`,
 * which lands a normative item `draft`. */
function draftProcedure(cwd: string, title: string): string {
  const out = createRegistry(cwd).call('create_item', {
    type: 'procedure', title, summary_omitted: true, steps: ['first step', 'second step'],
  });
  const match = /created (PROC-[a-z0-9-]+)/.exec(out);
  assert.ok(match, `expected a created-id in: ${out}`);
  return match![1]!;
}

test('read_procedure is registered', () => {
  assert.ok(TOOL_NAMES.includes('read_procedure'));
});

test('read_procedure: no procedures says so', () => {
  const cwd = project();
  try {
    const out = createRegistry(cwd).call('read_procedure', {});
    assert.match(out, /0 procedure/);
  } finally {
    removeTree(cwd);
  }
});

test('read_procedure: default action "list" groups by stage', () => {
  const cwd = project();
  try {
    draftProcedure(cwd, 'Roll the certificate');
    const out = createRegistry(cwd).call('read_procedure', {});
    assert.match(out, /proposed:/);
    assert.match(out, /Roll the certificate/);
  } finally {
    removeTree(cwd);
  }
});

test('read_procedure: "show" prints the item and its progress, ticks rendered not stored', () => {
  const cwd = project();
  try {
    addProcedure(cwd, 'Roll the certificate');
    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    let id: string;
    try {
      id = store.all().find((i) => i.type === 'procedure')!.id;
    } finally {
      store.close();
    }
    const out = createRegistry(cwd).call('read_procedure', { action: 'show', id });
    assert.match(out, /progress: 0 of 2/);
    assert.match(out, /rendered from the audit log, not stored/);
  } finally {
    removeTree(cwd);
  }
});

test('read_procedure: "step" is refused until the procedure is active', () => {
  const cwd = project();
  try {
    const id = draftProcedure(cwd, 'Roll the certificate');
    assert.throws(
      () => createRegistry(cwd).call('read_procedure', { action: 'step', id, step: 1 }),
      /not "active"/,
    );
  } finally {
    removeTree(cwd);
  }
});

test('read_procedure: "step" ticks a step on an active procedure — one audit record, no item write', () => {
  const cwd = project();
  try {
    addProcedure(cwd, 'Roll the certificate');
    const ws = resolveWorkspace(cwd);
    let id: string;
    {
      const store = Store.open(ws.dbPath);
      try {
        id = store.all().find((i) => i.type === 'procedure')!.id;
      } finally {
        store.close();
      }
    }
    assert.equal(runCli(['procedure', 'activate', id, '--yes'], cwd, () => {}), 0);

    const before = itemOrigin(cwd, id); // unchanged by a step
    const out = createRegistry(cwd).call('read_procedure', { action: 'step', id, step: 1 });
    assert.match(out, /step 1 ticked/);
    assert.match(out, /1 of 2/);
    assert.equal(itemOrigin(cwd, id), before);
  } finally {
    removeTree(cwd);
  }
});

test('read_procedure: "activate" and "done" are not reachable through this tool', () => {
  const cwd = project();
  try {
    addProcedure(cwd, 'Roll the certificate');
    for (const action of ['activate', 'done']) {
      assert.throws(
        () => createRegistry(cwd).call('read_procedure', { action }),
        /must be one of/,
        `${action} should not be an accepted "action" value`,
      );
    }
  } finally {
    removeTree(cwd);
  }
});

/** Every one of the three new tools has a `TOOL_PARITY` row, and the CLI
 * command it wraps no longer appears in `CLI_WITHOUT_TOOL` — the same check
 * `test/mcp/tools.test.ts` runs for the earlier six. */
test('each of the three new tools has a TOOL_PARITY row naming its CLI command', async () => {
  const { TOOL_PARITY, CLI_WITHOUT_TOOL } = await import('../../src/plugin/parity.ts');
  const expected: Record<string, string> = {
    list_items: 'list',
    create_lesson: 'lesson',
    read_procedure: 'procedure',
  };
  for (const [tool, cli] of Object.entries(expected)) {
    const row = TOOL_PARITY.find((r) => r.tool === tool);
    assert.ok(row, `${tool} has no TOOL_PARITY row`);
    assert.equal(row!.cli, cli, `${tool}'s TOOL_PARITY row does not claim ${cli}`);
    assert.equal(Object.hasOwn(CLI_WITHOUT_TOOL, cli), false, `${cli} is still in CLI_WITHOUT_TOOL`);
  }
});
