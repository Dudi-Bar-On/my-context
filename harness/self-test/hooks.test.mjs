import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWorkspace, destroyWorkspace, CLI } from '../lib/workspace.mjs';
import { runHook } from '../lib/hooks.mjs';

const execFileAsync = promisify(execFile);

test('session-start emits the injection block on stdout', async () => {
  const ws = await createWorkspace();
  // Add an item so the injection block is non-empty
  await execFileAsync(process.execPath, [CLI, 'add', 'reference', 'test', '--body', 'test', '--yes'], { cwd: ws });
  const r = await runHook('sessionStart', { session_id: 's1', source: 'startup' }, { cwd: ws });
  assert.equal(r.exitCode, 0, 'hooks fail open');
  assert.match(r.stdout, /my_context/, 'injection block reaches stdout');
  await destroyWorkspace(ws);
});

test('hooks fail open on garbage stdin', async () => {
  const ws = await createWorkspace();
  const r = await runHook('preToolUse', 'not json at all', { cwd: ws });
  assert.equal(r.exitCode, 0, 'exit 0 even on unparseable input');
  await destroyWorkspace(ws);
});

test('session-start emits nothing on an empty corpus', async () => {
  const ws = await createWorkspace();
  const r = await runHook('sessionStart', { session_id: 's1', source: 'startup' }, { cwd: ws });
  assert.equal(r.exitCode, 0, 'fails open');
  assert.equal(r.stdout, '', 'a corpus with no items injects nothing');
  await destroyWorkspace(ws);
});

test('recordable outcome on bad cwd: childError is set, promise resolves', async () => {
  // Spawn will fail because cwd does not exist
  const badCwd = '/nonexistent/path/that/cannot/exist';
  const r = await Promise.race([
    runHook('sessionStart', { session_id: 's1', source: 'startup' }, { cwd: badCwd }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: promise did not settle')), 5000)),
  ]);
  assert.equal(r.exitCode, null, 'spawn failure sets exitCode to null');
  assert(r.childError, 'childError is non-null on spawn failure');
  assert.equal(r.stdout, '', 'stdout is empty on spawn failure');
  assert.equal(r.stderr, '', 'stderr is empty on spawn failure');
  assert.equal(r.timedOut, false, 'timedOut is false (spawn failed before timer)');
});

test('timedOut is set when timeoutMs expires', async () => {
  const ws = await createWorkspace();
  // Hooks take ~90–140ms, so 1ms budget will timeout
  const r = await runHook('sessionStart', { session_id: 's1', source: 'startup' }, { cwd: ws, timeoutMs: 1 });
  assert.equal(r.timedOut, true, 'timedOut is true when budget expires');
  assert.equal(r.exitCode, null, 'exitCode is null on timeout');
  await destroyWorkspace(ws);
});
