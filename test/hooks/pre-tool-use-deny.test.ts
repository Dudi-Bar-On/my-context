import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('writing an item file is denied and names the add command', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  const d = decision(out);
  assert.equal(d.hookEventName, 'PreToolUse');
  assert.equal(d.permissionDecision, 'deny');
  assert.match(String(d.permissionDecisionReason), /mycontext add/);
});

test('editing an item file is denied too', () => {
  const out = runPreToolUse(
    hookInput('Edit', path.join(CWD, '.my_context/items/adr/ADR-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
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
