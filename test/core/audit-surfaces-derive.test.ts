/**
 * **The CLI's and the MCP tool's vocabularies are DERIVED, not listed.**
 *
 * `AUDIT_KINDS` and `AUDIT_OPS` are the one declaration; `--kind`/`--op`
 * (`src/cli/commands/audit.ts`) and the `audit_log` schema (`src/mcp/tools.ts`)
 * read them. That is the property this file pins, and it is worth pinning
 * because it is invisible: the day someone respells either list, everything
 * keeps working until the sixth kind arrives and one surface has never heard
 * of it. The plan says the two surfaces gain a new kind with no edit — this
 * asserts it rather than assuming it.
 *
 * The last two cases are the strong form. They read the two source files and
 * require that the word `progress` and the op `step-done` do NOT appear in
 * either: the surfaces accept the new member while never naming it.
 *
 * **Every later widening is pinned here too, and an OP-only one is the harder
 * case.** `progress` arrived as a kind AND three ops; `subagent-start` and
 * `post-tool-use-failure` (hooks plan Task 4) arrive as ops inside kinds that
 * already existed, so nothing about `--kind` or the schema's `kind` enum
 * changes and a surface that hard-coded its `--op` list would still answer
 * every `--kind` question correctly. That is precisely the failure that hides:
 * the cases below drive `--op` and the `op` enum directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUDIT_KINDS, AUDIT_OPS, recordAudit } from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-audit-derive-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const root = resolveWorkspace(cwd).projectRoot!;
  recordAudit(root, {
    kind: 'progress', op: 'step-done', origin: 'human', itemId: 'PROC-x', note: 'step 1',
    at: '2026-08-20T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'injection', op: 'subagent-start', sessionId: 'sub-1', hook: 'SubagentStart',
    injected: [{ id: 'RULE-sub', tier: 'pinned' }], tokens: 9,
    at: '2026-08-21T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'hook', op: 'post-tool-use-failure', sessionId: 'sub-1', hook: 'PostToolUseFailure',
    path: 'src/thing.ts', at: '2026-08-21T10:00:01.000Z',
  });
  return { cwd, root, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

function source(rel: string): string {
  return readFileSync(path.join(import.meta.dirname, '..', '..', rel), 'utf8');
}

test('the CLI accepts --kind progress and --op step-done with no edit of its own', () => {
  const p = project();
  try {
    const byKind = run(['audit', '--kind', 'progress'], p.cwd);
    assert.equal(byKind.code, 0);
    assert.match(byKind.out, /PROC-x/);

    const byOp = run(['audit', '--op', 'step-done'], p.cwd);
    assert.equal(byOp.code, 0);
    assert.match(byOp.out, /PROC-x/);
  } finally { p.dispose(); }
});

test('the CLI accepts --op subagent-start and --op post-tool-use-failure with no edit', () => {
  const p = project();
  try {
    const injected = run(['audit', '--op', 'subagent-start'], p.cwd);
    assert.equal(injected.code, 0);
    assert.match(injected.out, /subagent-start/);
    assert.doesNotMatch(injected.out, /post-tool-use-failure/, 'the filter selected one op');

    const failed = run(['audit', '--op', 'post-tool-use-failure'], p.cwd);
    assert.equal(failed.code, 0);
    assert.match(failed.out, /post-tool-use-failure/);
    // `post-tool-use` is a DIFFERENT op and this record is not one: a filter
    // that matched by prefix would answer the wrong question in both
    // directions, so the sibling op is checked to select nothing.
    const sibling = run(['audit', '--op', 'post-tool-use'], p.cwd);
    assert.equal(sibling.code, 0);
    assert.doesNotMatch(sibling.out, /post-tool-use-failure/);
  } finally { p.dispose(); }
});

test('the CLI teaches the new member when it refuses a wrong one', () => {
  const p = project();
  try {
    const bad = run(['audit', '--kind', 'progres'], p.cwd);
    assert.notEqual(bad.code, 0);
    assert.match(bad.out, /progress/);
    const badOp = run(['audit', '--op', 'step-don'], p.cwd);
    assert.notEqual(badOp.code, 0);
    assert.match(badOp.out, /step-done/);
    // The same list, reached through the ops this task adds.
    const badNew = run(['audit', '--op', 'subagent-star'], p.cwd);
    assert.notEqual(badNew.code, 0);
    assert.match(badNew.out, /subagent-start/);
    assert.match(badNew.out, /post-tool-use-failure/);
  } finally { p.dispose(); }
});

test('the audit_log schema IS the declaration, not a copy of it', () => {
  const p = project();
  try {
    const audit = createRegistry(p.cwd).list().find((t) => t.name === 'audit_log');
    assert.ok(audit, 'audit_log is registered');
    const properties = (audit.inputSchema as { properties: Record<string, { enum?: unknown }> })
      .properties;
    // Identity, not equality: the schema holds the very array `audit.ts`
    // exports, so a member added there cannot fail to reach the model.
    assert.equal(properties.kind.enum, AUDIT_KINDS);
    assert.equal(properties.op.enum, AUDIT_OPS);
    assert.ok((properties.kind.enum as string[]).includes('progress'));
    assert.ok((properties.op.enum as string[]).includes('step-done'));
    assert.ok((properties.op.enum as string[]).includes('subagent-start'));
    assert.ok((properties.op.enum as string[]).includes('post-tool-use-failure'));
  } finally { p.dispose(); }
});

test('the audit_log tool answers a progress query', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('audit_log', { kind: 'progress' });
    assert.match(text, /PROC-x/);
    assert.match(text, /step-done/);
  } finally { p.dispose(); }
});

test('the audit_log tool answers a subagent-start query it was never told about', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('audit_log', { op: 'subagent-start' });
    assert.match(text, /subagent-start/);
    const failure = createRegistry(p.cwd).call('audit_log', { op: 'post-tool-use-failure' });
    assert.match(failure, /post-tool-use-failure/);
  } finally { p.dispose(); }
});

test('neither surface names the new kind or its ops anywhere in its source', () => {
  for (const rel of ['src/cli/commands/audit.ts', 'src/mcp/tools.ts']) {
    const src = source(rel);
    assert.doesNotMatch(src, /['"]progress['"]/, `${rel} spells the kind out`);
    assert.doesNotMatch(src, /step-done|step-undone|step-reset/, `${rel} spells an op out`);
    assert.doesNotMatch(src, /subagent-start/, `${rel} spells the subagent op out`);
    assert.doesNotMatch(src, /post-tool-use-failure/, `${rel} spells the failure op out`);
    // The hook NAMES travel with the ops (`AuditRecord['hook']`); a surface
    // that listed those would drift the same way one listing the ops would.
    assert.doesNotMatch(src, /SubagentStart|PostToolUseFailure/, `${rel} spells a hook out`);
  }
});
