import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-jit-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, type: string, scope: string[], body: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const scopeBlock = scope.length
    ? `scope:\n${scope.map((s) => `  - "${s}"`).join('\n')}\n`
    : 'scope: []\n';
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
severity: hard
always: false
${scopeBlock}---

# ${id} title

${body}
`);
}

/** Index the workspace the way SessionStart would, so the JIT hook can read it. */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function toolInput(cwd: string, sessionId: string, filePath: string, tool = 'Read'): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: tool,
    tool_input: { file_path: filePath },
  });
}

function context(raw: string): string {
  const parsed = JSON.parse(raw) as {
    hookSpecificOutput: { additionalContext?: string };
  };
  return parsed.hookSpecificOutput.additionalContext ?? '';
}

test('reading a file in scope injects the matching item once', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const text = context(out);
  assert.match(text, /CONST-pool/);
  assert.match(text, /Pool capped at 20\./);

  rmSync(cwd, { recursive: true, force: true });
});

test('the second read in the same session injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts')), cwd);
  assert.equal(second, '');

  rmSync(cwd, { recursive: true, force: true });
});

test('a different session gets its own first injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const other = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(other), /CONST-pool/);

  rmSync(cwd, { recursive: true, force: true });
});

test('the injection is recorded in the ledger under the jit tier', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  const entries = ledger.entries('s1');
  assert.deepEqual(entries.map((e) => [e.itemId, e.tier]), [['CONST-pool', 'jit']]);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside every scope injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/readme.md')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside the repository injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  const outside = path.join(tmpdir(), 'elsewhere', 'file.ts');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', outside), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('an unscoped item never activates', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-inert', 'constraint', [], 'No scope, no injection.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a rationale item never activates however well it matches', () => {
  const cwd = sandbox();
  addItem(cwd, 'LESSON-db', 'lesson', ['src/db/**'], 'Migrations need locks.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a write to .my_context is denied and injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);

  const out = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, '.my_context/items/rule/RULE-x.md'), 'Write'), cwd);
  const parsed = JSON.parse(out) as {
    hookSpecificOutput: { permissionDecision?: string; additionalContext?: string };
  };
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(parsed.hookSpecificOutput.additionalContext, undefined);

  rmSync(cwd, { recursive: true, force: true });
});

test('an unindexed workspace injects nothing rather than throwing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Never indexed.');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt config yields empty output rather than a throw', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing session id injects nothing — there would be nowhere to dedupe', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const raw = JSON.stringify({
    cwd, tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
  });
  assert.equal(runPreToolUse(raw, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a spilled item is not recorded as seen, so it can still arrive later', () => {
  const cwd = sandbox();
  const big = 'x'.repeat(4000); // ~1000 tokens, over the 500 default JIT budget
  addItem(cwd, 'CONST-huge', 'constraint', ['src/db/**'], big);
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /omitted/i);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('s1'), []);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});
