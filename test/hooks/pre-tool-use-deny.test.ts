import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { denyReason, extractFilePath, runPreToolUse } from '../../src/hooks/pre-tool-use.ts';

const CWD = path.resolve('/repo');

function hookInput(toolName: string, filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    cwd: CWD,
    tool_name: toolName,
    tool_input: { file_path: filePath },
  });
}

function decision(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as { hookSpecificOutput: Record<string, unknown> };
  return parsed.hookSpecificOutput;
}

test('writing an item file is denied and names the create_item tool', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  const d = decision(out);
  assert.equal(d.hookEventName, 'PreToolUse');
  assert.equal(d.permissionDecision, 'deny');
  assert.match(String(d.permissionDecisionReason), /create_item/);
});

/**
 * `mycontext add` now routes through `mutate.ts`'s `createItem` (it no
 * longer bypasses the trust model), but it is still a human-facing CLI
 * command an agent in a hook-driven session cannot reach for. The hook that
 * enforces the write boundary must still point an agent at the MCP tool, not
 * a CLI command.
 */
test('no deny reason points the model at the CLI add command', () => {
  for (const rel of [
    '.my_context/items/constraint/CONST-a.md',
    '.my_context/config.json',
    '.my_context/.index.db',
  ]) {
    const reason = denyReason(path.join(CWD, rel));
    assert.ok(reason, rel);
    assert.doesNotMatch(reason, /mycontext add/, rel);
  }
});

test('editing an item file is denied too', () => {
  const out = runPreToolUse(
    hookInput('Edit', path.join(CWD, '.my_context/items/adr/ADR-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

/**
 * MultiEdit reaches the same files as Edit and Write. `hooks.json`'s
 * PreToolUse matcher must list it, or a MultiEdit straight into
 * `.my_context/items/CONST-x.md` — flipping `status: draft` to `active` —
 * is blocked by nothing at all.
 */
test('a MultiEdit into an item file is denied, and hooks.json actually matches MultiEdit', () => {
  const out = runPreToolUse(
    hookInput('MultiEdit', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');

  const config = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
  ) as { hooks: { PreToolUse: { matcher: string }[] } };
  const matcher = config.hooks.PreToolUse[0].matcher;
  assert.ok(
    new RegExp(`^(?:${matcher})$`).test('MultiEdit'),
    `hooks.json PreToolUse matcher ${JSON.stringify(matcher)} does not match MultiEdit`,
  );
  for (const tool of ['Read', 'Edit', 'Write']) {
    assert.ok(new RegExp(`^(?:${matcher})$`).test(tool), `matcher lost ${tool}`);
  }
});

/**
 * NotebookEdit is a lower-risk sibling of the MultiEdit gap closed above —
 * it can still write cell content straight into an item file's path. The
 * PreToolUse matcher must list it too, or a NotebookEdit into
 * `.my_context/items/CONST-x.md` is blocked by nothing at all.
 */
test('hooks.json PreToolUse matcher covers NotebookEdit', () => {
  const config = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
  ) as { hooks: { PreToolUse: { matcher: string }[] } };
  const matcher = config.hooks.PreToolUse[0].matcher;
  assert.ok(
    new RegExp(`^(?:${matcher})$`).test('NotebookEdit'),
    `hooks.json PreToolUse matcher ${JSON.stringify(matcher)} does not match NotebookEdit`,
  );
  for (const tool of ['Read', 'Edit', 'MultiEdit', 'Write']) {
    assert.ok(new RegExp(`^(?:${matcher})$`).test(tool), `matcher lost ${tool}`);
  }
});

test('writing the index database is denied and names the rebuild command', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/.index.db')), CWD);
  assert.match(String(decision(out).permissionDecisionReason), /mycontext rebuild/);
});

test('writing anything else under .my_context is denied with the general reason', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/config.json')), CWD);
  const reason = String(decision(out).permissionDecisionReason);
  assert.match(reason, /config\.json/);
  assert.match(reason, /managed by my_context/i);
});

test('the global layer is protected as well', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(path.resolve('/home/u'), '.my-context/items/rule/RULE-a.md')),
    CWD,
  );
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('a relative path is resolved against the hook cwd before the check', () => {
  const out = runPreToolUse(hookInput('Write', '.my_context/items/rule/RULE-a.md'), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('a native Windows path is normalized before the check', () => {
  assert.notEqual(denyReason('C:\\repo\\.my_context\\items\\rule\\RULE-a.md'), null);
});

test('Read is never denied — reading an item is legitimate', () => {
  const out = runPreToolUse(
    hookInput('Read', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  assert.equal(out, '');
});

test('writes outside .my_context are not denied', () => {
  assert.equal(runPreToolUse(hookInput('Write', path.join(CWD, 'src/db/writer.ts')), CWD), '');
  assert.equal(denyReason(path.join(CWD, 'src/my_context_notes.md')), null);
});

test('a directory merely named my_context is not protected', () => {
  assert.equal(denyReason(path.join(CWD, 'my_context/items/x.md')), null);
});

test('a directory or file that merely starts with .my_context is not protected', () => {
  assert.equal(denyReason(path.join(CWD, '.my_context-notes/x.md')), null);
  assert.equal(denyReason(path.join(CWD, '.my_contextrc')), null);
});

test('extractFilePath accepts the three tool input shapes and rejects the rest', () => {
  assert.equal(extractFilePath({ tool_input: { file_path: 'a.ts' } }), 'a.ts');
  assert.equal(extractFilePath({ tool_input: { path: 'b.ts' } }), 'b.ts');
  assert.equal(extractFilePath({ tool_input: { notebook_path: 'c.ipynb' } }), 'c.ipynb');
  assert.equal(extractFilePath({ tool_input: { file_path: '   ' } }), null);
  assert.equal(extractFilePath({ tool_input: {} }), null);
  assert.equal(extractFilePath({}), null);
});

test('malformed or empty stdin produces empty output, never a throw', () => {
  assert.equal(runPreToolUse('', CWD), '');
  assert.equal(runPreToolUse('{ not json', CWD), '');
  assert.equal(runPreToolUse('[]', CWD), '');
  assert.equal(runPreToolUse('null', CWD), '');
  assert.equal(runPreToolUse(JSON.stringify({ tool_name: 'Write' }), CWD), '');
});

test('an error mid-decision falls back to allow, not deny', () => {
  // A non-string cwd survives parseHookInput (it only rejects non-object/array
  // top-level values) and reaches path.resolve(cwd, filePath), which throws for
  // a non-string first argument. The catch in runPreToolUse must turn that into
  // '' (allow) rather than let it propagate or somehow deny.
  const raw = JSON.stringify({
    session_id: 's1',
    cwd: 12345,
    tool_name: 'Write',
    tool_input: { file_path: '.my_context/items/rule/RULE-a.md' },
  });
  assert.equal(runPreToolUse(raw, CWD), '');
});
