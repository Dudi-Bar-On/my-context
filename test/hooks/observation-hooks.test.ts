/**
 * **The nine events the hook survey ruled in, and the one rule they share:
 * they observe and they do not act.**
 *
 * `hooks plan seq:21` registers `FileChanged`, `InstructionsLoaded`,
 * `ConfigChange`, `PermissionDenied`, `SubagentStop`, `Stop`, `Setup`,
 * `TaskCreated` and `TaskCompleted`. Each of them has an obvious second thing
 * it could do — `Setup(init)` could create a workspace, `TaskCreated` could
 * write a `task` item, `FileChanged` could rebuild the index — and every one of
 * those is a decision about what mycontext turns on without being asked, which
 * is `seq:22`'s question and is BLOCKED on the owner. So the contract asserted
 * here is deliberately narrow and it is asserted in both directions: one audit
 * row when the firing is my_context's business, **nothing at all** otherwise,
 * and never a mutation.
 *
 * The negative tests carry most of the weight. A record-only hook that records
 * everything is a hook that makes the audit log unreadable — `FileChanged`
 * fires for every file under a watched directory, and `Stop` fires on every
 * assistant turn — so "declined to record" is the normal state of most of
 * these, and it is the state a bug would quietly leave.
 *
 * Nothing here asserts a latency. The end-to-end cost of each registration is
 * measured against the real binaries in `test/hooks/hook-binaries-e2e.test.ts`
 * and recorded, unasserted, in `test/perf/observation-latency.perf.ts`, for the
 * reason `subagent-start-latency.perf.ts` gives: a number that times a `node`
 * start on whatever machine ran it is a flake, not a bound.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { recordObservation } from '../../src/hooks/observe.ts';
import { CONFIG_CHANGE } from '../../src/hooks/config-change.ts';
import { FILE_CHANGED } from '../../src/hooks/file-changed.ts';
import { INSTRUCTIONS_LOADED } from '../../src/hooks/instructions-loaded.ts';
import { PERMISSION_DENIED } from '../../src/hooks/permission-denied.ts';
import { PROMPT_EXPANSION } from '../../src/hooks/user-prompt-expansion.ts';
import { SETUP } from '../../src/hooks/setup.ts';
import { STOP } from '../../src/hooks/stop.ts';
import { SUBAGENT_STOP } from '../../src/hooks/subagent-stop.ts';
import { TASK_COMPLETED, TASK_CREATED } from '../../src/hooks/task-events.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = '8321812a-5d4f-46a1-8a58-532b717ffb3a';

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-observe-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

function rows(cwd: string): AuditRecord[] {
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');
  return readAudit(root);
}

/** Every row this run wrote that is not the `init` mutation the sandbox made. */
function hookRows(cwd: string): AuditRecord[] {
  return rows(cwd).filter((r) => r.kind === 'hook');
}

/* ---------------------------------------------------------------------------
 * The shared contract — every one of the nine, in both directions.
 * ------------------------------------------------------------------------- */

const SPECS = [
  CONFIG_CHANGE, FILE_CHANGED, INSTRUCTIONS_LOADED, PERMISSION_DENIED, PROMPT_EXPANSION,
  SETUP, STOP, SUBAGENT_STOP, TASK_CREATED, TASK_COMPLETED,
];

test('an empty payload records nothing, on every observation hook', (t) => {
  const cwd = sandbox(t);
  for (const spec of SPECS) {
    assert.equal(recordObservation(spec, {}, cwd), null, `${spec.hook} acted on an empty payload`);
  }
  assert.deepEqual(hookRows(cwd), [], 'an interactive run with no stdin wrote to the audit log');
});

test('a payload from outside any workspace records nothing', (t) => {
  const cwd = sandbox(t);
  const outside = mkdtempSync(path.join(tmpdir(), 'myctx-observe-outside-'));
  t.after(() => removeTree(outside));
  for (const spec of SPECS) {
    const out = recordObservation(spec, { session_id: SESSION, cwd: outside }, outside);
    assert.equal(out, null, `${spec.hook} recorded with no workspace to record into`);
  }
  assert.deepEqual(hookRows(cwd), []);
});

test('every observation op is a hook op, and every spec names a distinct one', () => {
  const ops = SPECS.map((s) => s.op);
  assert.equal(new Set(ops).size, ops.length,
    'two observation hooks share one op — a reader filtering on it cannot tell them apart');
  const hooks = SPECS.map((s) => s.hook);
  assert.equal(new Set(hooks).size, hooks.length, 'two specs claim one platform event');
});

/* ---------------------------------------------------------------------------
 * FileChanged — the one that fires most, so the filter is the feature.
 * ------------------------------------------------------------------------- */

test('FileChanged records a hand edit of a corpus item, with the path and the verb', (t) => {
  const cwd = sandbox(t);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');
  mkdirSync(path.dirname(item), { recursive: true });
  writeFileSync(item, '# x\n');

  const note = recordObservation(
    FILE_CHANGED, { session_id: SESSION, cwd, file_path: item, event: 'change' }, cwd,
  );
  assert.ok(note !== null, 'a corpus edit was not recorded');

  const recorded = hookRows(cwd);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].op, 'file-changed');
  assert.equal(recorded[0].hook, 'FileChanged');
  assert.equal(recorded[0].sessionId, SESSION);
  assert.equal(recorded[0].path, 'items/constraint/CONST-x.md',
    'the path is recorded relative to the workspace, not as an absolute machine path');
  assert.match(recorded[0].note ?? '', /change/u);
});

test('FileChanged declines every file outside the workspace directory', (t) => {
  const cwd = sandbox(t);
  for (const file of ['src/index.ts', 'README.md', path.join('..', 'elsewhere.md')]) {
    const abs = path.resolve(cwd, file);
    assert.equal(
      recordObservation(FILE_CHANGED, { session_id: SESSION, cwd, file_path: abs, event: 'change' }, cwd),
      null, `${file} was recorded; FileChanged watches the corpus, not the repository`,
    );
  }
  assert.deepEqual(hookRows(cwd), []);
});

test('FileChanged records config.json, which ConfigChange can never see', (t) => {
  const cwd = sandbox(t);
  const config = path.join(cwd, '.my_context', 'config.json');
  const note = recordObservation(
    FILE_CHANGED, { session_id: SESSION, cwd, file_path: config, event: 'change' }, cwd,
  );
  assert.ok(note !== null,
    'config.json is the user\'s file and the only event that can see it edited is this one — ' +
    'ConfigChange fires for Claude Code\'s own settings and never for this file');
  assert.equal(hookRows(cwd)[0].path, 'config.json');
});

test('FileChanged records an unlink as an unlink', (t) => {
  const cwd = sandbox(t);
  const item = path.join(cwd, '.my_context', 'items', 'rule', 'RULE-y.md');
  recordObservation(FILE_CHANGED, { session_id: SESSION, cwd, file_path: item, event: 'unlink' }, cwd);
  const recorded = hookRows(cwd);
  assert.equal(recorded.length, 1);
  assert.match(recorded[0].note ?? '', /unlink/u,
    'a deleted item file is the one FileChanged verb that loses knowledge; the row must say so');
});

test('FileChanged does not rebuild, mutate or otherwise touch the corpus', (t) => {
  const cwd = sandbox(t);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');
  recordObservation(FILE_CHANGED, { session_id: SESSION, cwd, file_path: item, event: 'add' }, cwd);
  const mutations = rows(cwd).filter((r) => r.kind === 'mutation');
  assert.deepEqual(mutations, [],
    'the hook wrote a mutation. Acting on a hand edit is a behaviour change and it is seq:22\'s ' +
    'decision, not this hook\'s');
});

/* ---------------------------------------------------------------------------
 * InstructionsLoaded — the other thing that reaches a session's context.
 * ------------------------------------------------------------------------- */

test('InstructionsLoaded records the tier and the reason a CLAUDE.md was loaded', (t) => {
  const cwd = sandbox(t);
  const file = path.join(cwd, 'CLAUDE.md');
  recordObservation(INSTRUCTIONS_LOADED, {
    session_id: SESSION, cwd, file_path: file,
    memory_type: 'Project', load_reason: 'session_start',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'instructions-loaded');
  assert.equal(row.path, 'CLAUDE.md');
  assert.match(row.note ?? '', /Project/u);
  assert.match(row.note ?? '', /session_start/u);
});

test('InstructionsLoaded records a file outside the repository by name only', (t) => {
  const cwd = sandbox(t);
  const outside = path.join(tmpdir(), 'somewhere-else', 'CLAUDE.md');
  recordObservation(INSTRUCTIONS_LOADED, {
    session_id: SESSION, cwd, file_path: outside, memory_type: 'User', load_reason: 'session_start',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.ok(row !== undefined, 'the User tier reaches the session too and must be recorded');
  assert.equal(row.path, undefined,
    'an absolute path outside the repository is a machine path and is not put in the log');
  assert.match(row.note ?? '', /CLAUDE\.md/u, 'the basename still identifies which file loaded');
  assert.doesNotMatch(row.note ?? '', /somewhere-else/u);
});

/* ---------------------------------------------------------------------------
 * ConfigChange — and what it is NOT.
 * ------------------------------------------------------------------------- */

test('ConfigChange records which settings tier changed', (t) => {
  const cwd = sandbox(t);
  recordObservation(CONFIG_CHANGE, {
    session_id: SESSION, cwd, source: 'project_settings',
    file_path: path.join(cwd, '.claude', 'settings.json'),
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'config-change');
  assert.match(row.note ?? '', /project_settings/u);
  assert.equal(row.path, '.claude/settings.json',
    'the settings path is recorded relative to the repository');
});

test('ConfigChange discloses a source this build does not know', (t) => {
  const cwd = sandbox(t);
  recordObservation(CONFIG_CHANGE, { session_id: SESSION, cwd, source: 'quantum_settings' }, cwd);
  const row = hookRows(cwd)[0];
  assert.match(row.note ?? '', /quantum_settings/u);
  assert.match(row.note ?? '', /not one of/u,
    'a new settings tier may be one that can disable these hooks; the row is the only channel ' +
    'that would ever say so (INV-nothing-is-dropped-silently)');
});

/* ---------------------------------------------------------------------------
 * PermissionDenied — usually our own deny, fired back at us.
 * ------------------------------------------------------------------------- */

test('PermissionDenied records the tool and never the tool input', (t) => {
  const cwd = sandbox(t);
  recordObservation(PERMISSION_DENIED, {
    session_id: SESSION, cwd, tool_name: 'Write',
    tool_input: { file_path: 'secret.txt', content: 'THE SECRET' },
    reason: 'my_context: refusing to Write inside .my_context/items',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'permission-denied');
  assert.match(row.note ?? '', /Write/u);
  const serialized = JSON.stringify(row);
  assert.doesNotMatch(serialized, /THE SECRET/u, 'tool_input reached the audit log');
  assert.doesNotMatch(serialized, /secret\.txt/u, 'tool_input reached the audit log');
});

test('PermissionDenied says when the denial was my_context\'s own', (t) => {
  const cwd = sandbox(t);
  recordObservation(PERMISSION_DENIED, {
    session_id: SESSION, cwd, tool_name: 'Write',
    reason: 'my_context: refusing to Write inside .my_context/items',
  }, cwd);
  recordObservation(PERMISSION_DENIED, {
    session_id: SESSION, cwd, tool_name: 'Bash', reason: 'the user pressed no',
  }, cwd);
  const recorded = hookRows(cwd);
  assert.equal(recorded.length, 2);
  assert.match(recorded[0].note ?? '', /my_context/u,
    'this hook exists partly because our own PreToolUse deny is what usually fires it; a row ' +
    'that cannot tell our denial from the user\'s answers the wrong question');
  assert.doesNotMatch(recorded[1].note ?? '', /source=my_context/u);
});

/* ---------------------------------------------------------------------------
 * SubagentStop — the other half of the pair SubagentStart opens.
 * ------------------------------------------------------------------------- */

test('SubagentStop names the agent, so the SubagentStart pair can be read back', (t) => {
  const cwd = sandbox(t);
  recordObservation(SUBAGENT_STOP, {
    session_id: SESSION, cwd, agent_id: 'agent-7', agent_type: 'general-purpose',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'subagent-stop');
  assert.equal(row.sessionId, SESSION, 'the row carries the PARENT session id, as SubagentStart does');
  assert.match(row.note ?? '', /agent-7/u);
  assert.match(row.note ?? '', /general-purpose/u);
});

test('SubagentStop with no agent_type writes subagent-stop-untyped, not subagent-stop, and says plainly why', (t) => {
  const cwd = sandbox(t);
  recordObservation(SUBAGENT_STOP, { session_id: SESSION, cwd, agent_id: 'agent-7' }, cwd);
  const row = hookRows(cwd)[0];
  // TASK-a-third-of-the-audit-feed-is-stop-rows-for-things-that-were, hooks/34:
  // a firing with no agent_type never described a lane, so it no longer
  // competes with real lanes for the `subagent-stop` op — see `HOOK_OPS`'s
  // own comment in `core/audit.ts` for the decision and the three options
  // weighed against it.
  assert.equal(row.op, 'subagent-stop-untyped');
  assert.equal(row.hook, 'SubagentStop', 'the event that wrote the row is unchanged by which op it chose');
  assert.match(row.note ?? '', /type=<absent>/u);
  assert.match(row.note ?? '', /not a named lane/u,
    'a bare "type=<absent>" cannot be told apart from a real lane that did nothing; the note ' +
    'must say why no agent-step rows will follow this firing ' +
    '(TASK-the-step-backfill-produces-nothing-for-ninety-eight-percent)');
});

test('SubagentStop with no agent_id records nothing', (t) => {
  const cwd = sandbox(t);
  assert.equal(
    recordObservation(SUBAGENT_STOP, { session_id: SESSION, cwd, agent_type: 'x' }, cwd), null,
    'without agent_id the row could not be paired with anything, which is its only purpose',
  );
  assert.deepEqual(hookRows(cwd), []);
});

test('SubagentStop does not clear the subagent\'s delivery state', (t) => {
  const cwd = sandbox(t);
  recordObservation(SUBAGENT_STOP, { session_id: SESSION, cwd, agent_id: 'agent-7' }, cwd);
  const recorded = hookRows(cwd);
  assert.equal(recorded.length, 1);
  assert.doesNotMatch(recorded[0].note ?? '', /cleared/u,
    'pruning a finished subagent\'s seen file is a behaviour change to the dedupe state and it ' +
    'is the owner\'s call, exactly as post-compact.ts leaves its own pruning undone');
});

/* ---------------------------------------------------------------------------
 * Stop — one row per assistant turn, and no capture nudge.
 * ------------------------------------------------------------------------- */

test('Stop records the end of a turn', (t) => {
  const cwd = sandbox(t);
  recordObservation(STOP, { session_id: SESSION, cwd, stop_hook_active: false }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'stop');
  assert.equal(row.hook, 'Stop');
});

test('Stop says when the turn is continuing because a stop hook asked it to', (t) => {
  const cwd = sandbox(t);
  recordObservation(STOP, { session_id: SESSION, cwd, stop_hook_active: true }, cwd);
  assert.match(hookRows(cwd)[0].note ?? '', /stop_hook_active=true/u);
});

test('Stop emits no capture nudge', (t) => {
  const cwd = sandbox(t);
  const note = recordObservation(STOP, { session_id: SESSION, cwd }, cwd);
  assert.ok(note !== null);
  assert.doesNotMatch(note, /create_item/u,
    'moving the capture nudge from PostToolUse to Stop changes what the product asks a model ' +
    'to do and when — seq:21 calls it arguable, which is not a ruling');
});

/* ---------------------------------------------------------------------------
 * Setup — and the line it deliberately stops at.
 * ------------------------------------------------------------------------- */

test('Setup records its trigger', (t) => {
  const cwd = sandbox(t);
  recordObservation(SETUP, { session_id: SESSION, cwd, trigger: 'maintenance' }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'setup');
  assert.match(row.note ?? '', /maintenance/u);
});

test('Setup(init) creates no workspace and runs no doctor', (t) => {
  const outside = mkdtempSync(path.join(tmpdir(), 'myctx-setup-fresh-'));
  t.after(() => removeTree(outside));
  const out = recordObservation(SETUP, { session_id: SESSION, cwd: outside, trigger: 'init' }, outside);
  assert.equal(out, null,
    'Setup(init) on a directory with no workspace must do nothing. Creating one here is the ' +
    'whole of "what a fresh install turns on without being asked", which is BLOCKED on the owner ' +
    '(hooks seq:22). The hook is registered and the payload is reachable; the decision is not made.');
  assert.equal(resolveWorkspace(outside).projectRoot, null, 'Setup created a workspace');
});

/* ---------------------------------------------------------------------------
 * TaskCreated / TaskCompleted — the harness's tasks, observed, not imported.
 * ------------------------------------------------------------------------- */

test('TaskCreated and TaskCompleted record the id and a capped subject', (t) => {
  const cwd = sandbox(t);
  recordObservation(TASK_CREATED, {
    session_id: SESSION, cwd, task_id: 'T-1', task_subject: 'wire the thing',
  }, cwd);
  recordObservation(TASK_COMPLETED, {
    session_id: SESSION, cwd, task_id: 'T-1', task_subject: 'wire the thing',
  }, cwd);
  const recorded = hookRows(cwd);
  assert.deepEqual(recorded.map((r) => r.op), ['task-created', 'task-completed']);
  for (const row of recorded) {
    assert.match(row.note ?? '', /T-1/u);
    assert.match(row.note ?? '', /wire the thing/u);
  }
});

test('a task subject is capped, because it is unbounded caller text', (t) => {
  const cwd = sandbox(t);
  recordObservation(TASK_CREATED, {
    session_id: SESSION, cwd, task_id: 'T-2', task_subject: 'x'.repeat(5000),
  }, cwd);
  const note = hookRows(cwd)[0].note ?? '';
  assert.ok(note.length < 500, `the note is ${note.length} chars; a row that scrolls the terminal ` +
    'discloses less than one that fits on it');
});

test('TaskCreated writes no task item', (t) => {
  const cwd = sandbox(t);
  recordObservation(TASK_CREATED, {
    session_id: SESSION, cwd, task_id: 'T-3', task_subject: 'wire the thing',
  }, cwd);
  const mutations = rows(cwd).filter((r) => r.kind === 'mutation');
  assert.deepEqual(mutations, [],
    'tying the harness\'s tasks to the corpus\'s task category means WRITING items nobody asked ' +
    'for. That is seq:22\'s decision about what a fresh install does on its own.');
});

test('TaskCreated with no task_id records nothing', (t) => {
  const cwd = sandbox(t);
  assert.equal(recordObservation(TASK_CREATED, { session_id: SESSION, cwd }, cwd), null);
  assert.deepEqual(hookRows(cwd), []);
});

/* ---------------------------------------------------------------------------
 * UserPromptExpansion — hooks seq:2b, the second event a slash command fires.
 * ------------------------------------------------------------------------- */

test('UserPromptExpansion records the command a slash command announced', (t) => {
  const cwd = sandbox(t);
  recordObservation(PROMPT_EXPANSION, {
    session_id: SESSION, cwd, expansion_type: 'slash_command',
    command_name: 'mycontext:status', command_args: '', command_source: 'plugin',
    prompt_id: 'd472fded-27d1-44fc-9c72-537805695652',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.equal(row.op, 'prompt-expansion');
  assert.equal(row.hook, 'UserPromptExpansion');
  assert.match(row.note ?? '', /mycontext:status/u);
  assert.match(row.note ?? '', /plugin/u);
});

test('UserPromptExpansion records that arguments were given, never what they were', (t) => {
  const cwd = sandbox(t);
  recordObservation(PROMPT_EXPANSION, {
    session_id: SESSION, cwd, expansion_type: 'slash_command',
    command_name: 'mycontext:capture', command_args: 'a secret the user typed',
  }, cwd);
  const row = hookRows(cwd)[0];
  assert.doesNotMatch(JSON.stringify(row), /a secret the user typed/u,
    'command_args is whatever the user typed after the command name — it is content, and the ' +
    'log records scope');
  assert.match(row.note ?? '', /args=/u, 'whether arguments were given is scope and is recorded');
});

test('UserPromptExpansion with no command_name records nothing', (t) => {
  const cwd = sandbox(t);
  assert.equal(
    recordObservation(PROMPT_EXPANSION, { session_id: SESSION, cwd, expansion_type: 'mcp_prompt' }, cwd),
    null, 'the command name is the whole of what this event adds over UserPromptSubmit',
  );
  assert.deepEqual(hookRows(cwd), []);
});
