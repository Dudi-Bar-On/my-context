import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { DEFAULT_BUDGETS } from '../../src/core/config.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

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
  // Pins the invariant `buildJitOutput` relies on when it hands the whole
  // Selection to renderSelection: a tool event's IndexSummary is always
  // empty, so no "## my_context index" block is emitted here.
  assert.doesNotMatch(text, /my_context index/);

  removeTree(cwd);
});

test('the second read in the same session injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts')), cwd);
  assert.equal(second, '');

  removeTree(cwd);
});

test('dedupe is per-item, not per-session: a second, distinct item still arrives', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  addItem(cwd, 'CONST-api', 'constraint', ['src/api/**'], 'Rate limited to 100/min.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  // Same session, different item, different scope: this must still inject —
  // an implementation that merely recorded "this session was already served"
  // (rather than deduping per item id) would wrongly suppress it.
  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/api/handler.ts')), cwd);
  const text = context(second);
  assert.match(text, /CONST-api/);
  assert.doesNotMatch(text, /CONST-pool/);

  removeTree(cwd);
});

test('a different session gets its own first injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const other = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(other), /CONST-pool/);

  removeTree(cwd);
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

  removeTree(cwd);
});

test('a file outside every scope injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/readme.md')), cwd), '');
  removeTree(cwd);
});

test('a file outside the repository injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  const outside = path.join(tmpdir(), 'elsewhere', 'file.ts');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', outside), cwd), '');
  removeTree(cwd);
});

test('a cross-drive path injects nothing rather than matching by accident', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  // On win32, path.relative(repoRoot, target) returns an ABSOLUTE path (not
  // '..'-prefixed) when the two paths resolve to different drive roots — an
  // absolute string that neither the empty check nor a '..' prefix check
  // would catch. A drive letter unrelated to the sandbox's own drive forces
  // exactly that path through path.relative without needing the drive to
  // actually exist (path.relative/path.resolve are purely syntactic).
  const otherDrive = path.parse(cwd).root.startsWith('Z') ? 'Y:\\other\\file.ts' : 'Z:\\other\\file.ts';
  assert.equal(runPreToolUse(toolInput(cwd, 's1', otherDrive), cwd), '');
  removeTree(cwd);
});

/**
 * End-to-end through the real hook, because `select`'s rule is not the only
 * place this lived: the hook pre-filters the corpus in SQL, and that filter
 * used to be `has_scope = 1`. With the selector inverted but the SQL left
 * alone, `select` would never see an unscoped row and the whole change would
 * be a no-op in production while the unit tests went green. Two unrelated
 * paths, so a stray glob cannot make this pass by accident.
 */
test('an unscoped item activates on every path — scope restricts, it does not enable', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-unrestricted', 'constraint', [], 'Applies everywhere.');
  index(cwd);
  for (const target of ['src/db/writer.ts', 'docs/unrelated/notes.md']) {
    const out = runPreToolUse(toolInput(cwd, `s-${target}`, path.join(cwd, target)), cwd);
    assert.match(out, /CONST-unrestricted/, `expected an injection on ${target}`);
  }
  removeTree(cwd);
});

test('a scoped item is still restricted to its globs through the hook', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-db', 'constraint', ['src/db/**'], 'Only the db layer.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/notes.md')), cwd), '');
  removeTree(cwd);
});

test('a rationale item never activates however well it matches', () => {
  const cwd = sandbox();
  addItem(cwd, 'LESSON-db', 'lesson', ['src/db/**'], 'Migrations need locks.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  removeTree(cwd);
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

  removeTree(cwd);
});

test('an unindexed workspace injects nothing rather than throwing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Never indexed.');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  removeTree(cwd);
});

test('a corrupt config yields empty output rather than a throw', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  removeTree(cwd);
});

test('a missing session id injects nothing — there would be nowhere to dedupe', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const raw = JSON.stringify({
    cwd, tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
  });
  assert.equal(runPreToolUse(raw, cwd), '');
  removeTree(cwd);
});

test('a ledger write failure does not discard the already-rendered injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // Simulates the ledger write throwing (e.g. SQLITE_BUSY from a concurrent
  // rebuild holding the WAL lock past busy_timeout): the render has already
  // happened by the time this can fire, and the injection must still be
  // returned rather than swallowed by the outer catch.
  const original = Ledger.prototype.recordMany;
  Ledger.prototype.recordMany = () => { throw new Error('simulated ledger failure'); };
  try {
    const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
    assert.match(context(out), /CONST-pool/);
    assert.match(context(out), /Pool capped at 20\./);
  } finally {
    Ledger.prototype.recordMany = original;
  }

  removeTree(cwd);
});

test('a spilled item is not recorded as seen, so it can still arrive later', () => {
  const cwd = sandbox();
  // Derived from the budget rather than typed: a literal sized to one
  // particular `jit` value stops exercising the spill path the moment the
  // default moves, and does so silently — the item simply fits.
  const big = 'x'.repeat((DEFAULT_BUDGETS.jit + 100) * 4);
  addItem(cwd, 'CONST-huge', 'constraint', ['src/db/**'], big);
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /omitted/i);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('s1'), []);
  ledger.close();

  removeTree(cwd);
});
