import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, destroyWorkspace } from '../lib/workspace.mjs';
import { runCli } from '../lib/run.mjs';

test('bare invocation exits 1, --help exits 0', async () => {
  const ws = await createWorkspace();
  const bare = await runCli([], { cwd: ws });
  const help = await runCli(['--help'], { cwd: ws });
  assert.equal(bare.exitCode, 1, 'bare mycontext exits 1');
  assert.equal(help.exitCode, 0, '--help exits 0');
  await destroyWorkspace(ws);
});

test('stdout and stderr are captured separately', async () => {
  const ws = await createWorkspace();
  const r = await runCli(['status'], { cwd: ws });
  assert.match(r.stderr, /ExperimentalWarning/, 'known node:sqlite warning lands on stderr');
  assert.doesNotMatch(r.stdout, /ExperimentalWarning/, 'stdout must stay clean');
  await destroyWorkspace(ws);
});

test('a command that reads stdin terminates instead of hanging', async () => {
  const ws = await createWorkspace();
  const r = await runCli(['ingest-apply', 'ING-nope', '--anchor', 'x', '--stdin'], { cwd: ws });
  assert.equal(r.timedOut, false, 'must not have hit the timeout');
  await destroyWorkspace(ws);
});
