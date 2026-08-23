/**
 * The ten observation binaries, run as real OS processes over real stdio.
 *
 * `test/hooks/observation-hooks.test.ts` imports `recordObservation` and calls
 * it. That leaves the part Claude Code actually uses — `node <file>` with a
 * JSON payload on stdin, an exit code, and whatever landed on stdout — with no
 * test that could fail if the entry guard, the stdin read or the exit code were
 * removed. `hook-binaries-e2e.test.ts` is the model and states the argument at
 * length; this file applies it to the ten `seq:21`/`seq:2b` added, in one loop,
 * because unlike the six older binaries these ten make the SAME decisions about
 * the reader, the timer and the envelope — `src/hooks/observe.ts` makes them
 * once — so ten hand-written cases would be nine copies of one assertion.
 *
 * **Three contracts, and the third is the one that only a process can show.**
 *
 *  1. Garbage on stdin exits 0 and writes nothing to stdout
 *     (`INV-hooks-fail-open`), with the shared disclosure on stderr.
 *  2. A real payload exits 0, writes nothing to stdout, and leaves exactly one
 *     audit row. Silence is the whole envelope here: `TaskCreated`,
 *     `TaskCompleted`, `InstructionsLoaded` and `ConfigChange` have no output
 *     variant in the platform's schema at all, and the other six have one this
 *     project deliberately does not fill. So the row read back off disk is the
 *     only evidence the process did anything, which is exactly why it is read
 *     back rather than inferred from a zero exit.
 *  3. Every one of them is the binary the MANIFEST names. The command string in
 *     `hooks/hooks.json` is resolved here rather than a path being written out
 *     again, so a hook whose registration points at a file that was renamed
 *     fails in this file rather than in a user's session.
 *
 * **No held-open-stdin case, and that is a property rather than an omission.**
 * These ten read stdin with `readFileSync(0)`, which blocks the thread outright
 * — no timer can fire, and a test that opened their stdin and never closed it
 * would hang the suite rather than fail it. `hook-binaries-e2e.test.ts` records
 * the same asymmetry for the four older synchronous readers. What bounds a
 * never-closed pipe here is Claude Code killing the process at the `timeout`
 * the manifest declares, and `src/hooks/observe.ts` says so where the reader is
 * chosen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Cold start plus type-stripping, with room to spare on a loaded box. */
const EXIT_BUDGET_MS = 60_000;
const SESSION = 'e2e-observation-1';

interface Run { code: number | null; stdout: string; stderr: string }

function runBinary(file: string, payload: string, cwd: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath, ['--disable-warning=ExperimentalWarning', file],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { stdout += c; });
    child.stderr.on('data', (c: string) => { stderr += c; });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(file)} did not exit within ${EXIT_BUDGET_MS}ms`));
    }, EXIT_BUDGET_MS);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.stdin.end(payload);
  });
}

/**
 * The binary the manifest registers for one event, resolved from the command
 * string. `FileChanged` is registered twice and both entries name one file (see
 * `src/hooks/file-changed.ts`), so taking the first is not a choice.
 */
function binaryFor(event: string): string {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as {
    hooks: Record<string, { hooks: { command: string }[] }[]>;
  };
  const entries = manifest.hooks[event];
  assert.ok(entries?.[0], `${event} is not registered`);
  const found = /\$\{CLAUDE_PLUGIN_ROOT\}\/(src\/hooks\/[a-z-]+\.ts)/u
    .exec(entries[0].hooks[0].command);
  assert.ok(found, `${event}'s command names no binary: ${entries[0].hooks[0].command}`);
  return path.join(ROOT, found[1]);
}

/** One realistic payload per event, plus the op its row must carry. */
function cases(cwd: string): { event: string; op: string; payload: Record<string, unknown> }[] {
  const base = { session_id: SESSION, cwd };
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-e2e.md');
  return [
    { event: 'FileChanged', op: 'file-changed',
      payload: { ...base, hook_event_name: 'FileChanged', file_path: item, event: 'change' } },
    { event: 'InstructionsLoaded', op: 'instructions-loaded',
      payload: { ...base, hook_event_name: 'InstructionsLoaded',
        file_path: path.join(cwd, 'CLAUDE.md'), memory_type: 'Project',
        load_reason: 'session_start' } },
    { event: 'ConfigChange', op: 'config-change',
      payload: { ...base, hook_event_name: 'ConfigChange', source: 'project_settings' } },
    { event: 'PermissionDenied', op: 'permission-denied',
      payload: { ...base, hook_event_name: 'PermissionDenied', tool_name: 'Write',
        tool_input: { file_path: 'x' }, tool_use_id: 'tu-1', reason: 'my_context: managed' } },
    { event: 'SubagentStop', op: 'subagent-stop',
      payload: { ...base, hook_event_name: 'SubagentStop', stop_hook_active: false,
        agent_id: 'agent-e2e', agent_type: 'general-purpose', agent_transcript_path: 'x' } },
    { event: 'Stop', op: 'stop',
      payload: { ...base, hook_event_name: 'Stop', stop_hook_active: false } },
    { event: 'Setup', op: 'setup',
      payload: { ...base, hook_event_name: 'Setup', trigger: 'maintenance' } },
    { event: 'TaskCreated', op: 'task-created',
      payload: { ...base, hook_event_name: 'TaskCreated', task_id: 'T-e2e', task_subject: 's' } },
    { event: 'TaskCompleted', op: 'task-completed',
      payload: { ...base, hook_event_name: 'TaskCompleted', task_id: 'T-e2e', task_subject: 's' } },
    { event: 'UserPromptExpansion', op: 'prompt-expansion',
      payload: { ...base, hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command',
        command_name: 'mycontext:status', command_args: '', command_source: 'plugin' } },
  ];
}

function hookRows(cwd: string): AuditRecord[] {
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root);
  return readAudit(root).filter((r) => r.kind === 'hook');
}

test('every observation binary records its row when run as a real process', async (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-observe-e2e-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));

  for (const c of cases(cwd)) {
    const run = await runBinary(binaryFor(c.event), JSON.stringify(c.payload), cwd);
    assert.equal(run.code, 0, `${c.event} exited ${run.code}: ${run.stderr}`);
    assert.equal(run.stdout, '',
      `${c.event} wrote to stdout. These ten fill no output envelope; a byte here is either a ` +
      'byte nobody reads or, on the four events that surface it, a banner in front of the user.');
    assert.equal(run.stderr, '', `${c.event} disclosed something on a good payload: ${run.stderr}`);
  }

  const recorded = hookRows(cwd);
  assert.deepEqual(
    recorded.map((r) => r.op), cases(cwd).map((c) => c.op),
    'the binaries did not each leave exactly one row, in order. A zero exit is not evidence ' +
    'that anything happened — for these ten the row IS the whole output.',
  );
  for (const row of recorded) {
    assert.equal(row.sessionId, SESSION, `${row.op} lost the session id`);
    assert.ok((row.note ?? '') !== '', `${row.op} recorded an empty note`);
  }
});

test('every observation binary fails open on garbage, and says so on stderr', async (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-observe-e2e-bad-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));

  for (const c of cases(cwd)) {
    const run = await runBinary(binaryFor(c.event), 'not json at all {{{\n', cwd);
    assert.equal(run.code, 0,
      `${c.event} exited ${run.code} on an unreadable payload. INV-hooks-fail-open: a knowledge ` +
      'base that breaks a session is worse than one that says nothing.');
    assert.equal(run.stdout, '', `${c.event} wrote to stdout on garbage`);
    assert.match(run.stderr, /my_context: hook payload unreadable/u,
      `${c.event} swallowed an unreadable payload silently (INV-nothing-is-dropped-silently)`);
  }

  assert.deepEqual(hookRows(cwd), [],
    'a payload that could not be read produced an audit row anyway, which would be a record of ' +
    'an event nobody can describe');
});
