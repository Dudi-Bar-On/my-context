// @basis TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen, INV-nothing-is-dropped-silently, INV-hooks-fail-open
/**
 * **`recordAudit` answers, and every hook call site reads the answer.**
 *
 * `recordAudit` returns `{ written, error }` and never throws — the honest
 * shape this project asks for — and until this file existed fourteen of the
 * sixteen hook call sites threw that answer away. Three of the fourteen are
 * load-bearing in writing:
 *
 *  - the JIT injection record, whose neighbour justifies the seen-file
 *    append's best-effort posture on the grounds that *"the audit record
 *    above already holds the delivery durably"*;
 *  - `recordDeny`, which the source calls *"the one hook action that CHANGES
 *    what a tool call does"*;
 *  - `subagent-start`'s `delivery=attempted` row, which is the whole
 *    mechanism by which a killed lane *"becomes evidence rather than
 *    silence"*.
 *
 * When the append fails, each of those three guarantees is void and the prose
 * still asserts it. That is `INV-nothing-is-dropped-silently` broken at the
 * one place the product records what it did.
 *
 * ── HOW THE FAILURE IS PLANTED ─────────────────────────────────────────────
 *
 * A plain FILE where `.audit/` must be. `ensureLogDir`'s `mkdirSync` then
 * fails with `ENOTDIR`/`EEXIST` on every platform, which `recordAudit`
 * catches and returns as `{ written: false, error }`. It is the same
 * simulation `test/core/audit.test.ts`, `test/hooks/post-tool-use-failure.test.ts`
 * and `test/cli/report-unreadable-audit-log.test.ts` already use, so nothing
 * here invents a second way to make a log unwritable.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ─────────────────────────
 *
 * Every test asserts three things and never fewer: the hook did NOT throw,
 * the hook still did its job (the deny still denies, the injection still
 * injects, the snapshot is still on disk), and the loss reached stderr naming
 * the event and the `--op` a reader would have gone looking under. Exit codes
 * are not asserted here — every one of these functions is called by a binary
 * whose entry guard sets `process.exitCode = 0` unconditionally, and
 * `test/hooks/hook-binaries-e2e.test.ts` is where that is measured against the
 * real processes.
 *
 * stderr is the channel because it is the one the hooks already use for
 * exactly this class of loss — `noWorkspaceLine`, `configUnreadableLine`,
 * `hookParseErrorLine`, `pinnedSpillLine`, `unrecordedDeliveryLine` — and
 * because the reader who can fix an unwritable directory is the person, never
 * the model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { auditDir } from '../../src/core/audit.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { agentDispatchNote, agentStepNote, nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { buildSessionEndOutcome } from '../../src/hooks/session-end.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { recordAgentSteps, SUBAGENT_STOP } from '../../src/hooks/subagent-stop.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(t: { after(fn: () => void): void }, config?: Record<string, unknown>): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-auditdisc-'));
  runCli(['init'], cwd, () => {});
  if (config !== undefined) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', ...config }, null, 2) + '\n',
    );
  }
  t.after(() => removeTree(cwd));
  return cwd;
}

function root(cwd: string): string {
  const projectRoot = resolveWorkspace(cwd).projectRoot;
  assert.ok(projectRoot, 'the fixture must have a workspace');
  return projectRoot;
}

/**
 * Makes every append to this workspace's audit log fail, for good, without
 * touching anything else in the corpus. A FILE where the directory must be —
 * see the header for why this and not a permission bit.
 */
function breakAuditLog(cwd: string): void {
  const dir = auditDir(root(cwd));
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  writeFileSync(dir, 'not a directory', 'utf8');
}

/** Runs `fn` with `process.stderr.write` captured — the pattern in pre-compact.test.ts. */
function capturingStderr<T>(fn: () => T): { value: T; stderr: string } {
  const chunks: string[] = [];
  const real = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stderr.write;
  try {
    return { value: fn(), stderr: chunks.join('') };
  } finally {
    process.stderr.write = real;
  }
}

function addItem(cwd: string, id: string, scope: string[]): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${id} title
status: active
severity: hard
always: false
scope:
${scope.map((s) => `  - "${s}"`).join('\n')}
---

# ${id} title

Pool capped at 20.
`);
}

function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

/* ---------------------------------------------------------------------------
 * THE THREE LOAD-BEARING SITES, FIRST AND NAMED.
 * ------------------------------------------------------------------------- */

test('the JIT injection record that the seen-file append leans on discloses when it is lost', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pool', ['src/db/**']);
  index(cwd);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => runPreToolUse(JSON.stringify({
    session_id: 's1', hook_event_name: 'PreToolUse', cwd,
    tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
  }), cwd));

  // The injection still happened. A hook that traded the delivery for the
  // disclosure would be a worse failure than the one this test is about.
  assert.match(captured.value, /CONST-pool/, 'the item must still be delivered');
  assert.match(
    captured.stderr,
    /my_context: the PreToolUse audit record could not be written/,
    'the loss of the record the seen-file append leans on must reach the user',
  );
  assert.match(captured.stderr, /--op jit/, 'and name the op a reader would look under');
});

test('a refusal that could not be recorded still refuses, and says the record was lost', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => runPreToolUse(JSON.stringify({
    session_id: 's1', hook_event_name: 'PreToolUse', cwd,
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, '.my_context', 'items', 'constraint', 'x.md') },
  }), cwd));

  // "The one hook action that CHANGES what a tool call does" — it must still
  // change it. The disclosure is in addition to the deny, never instead of it.
  assert.match(captured.value, /"permissionDecision":"deny"/, 'the deny must still stand');
  assert.match(captured.stderr, /my_context: the PreToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op deny/);
});

test('the delivery=attempted row that turns a killed lane into evidence discloses when lost', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => buildSubagentStartOutput({
    session_id: 's1', cwd, agent_id: 'agent-1', agent_type: 'general-purpose',
  }, cwd));

  assert.equal(typeof captured.value, 'string', 'the dispatch must not be broken');
  assert.match(captured.stderr, /my_context: the SubagentStart audit record could not be written/);
  assert.match(captured.stderr, /--op subagent-start/);
});

/* ---------------------------------------------------------------------------
 * THE REST OF THE FOURTEEN, ONE REPRESENTATIVE SITE PER HOOK.
 * ------------------------------------------------------------------------- */

test('an observation hook discloses the row it could not write', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => observeAndRecord(SUBAGENT_STOP, {
    session_id: 's1', cwd, agent_id: 'agent-1', agent_type: 'general-purpose',
  }, cwd));

  assert.equal(captured.value.note === null, false, 'the observation itself still happened');
  assert.match(captured.stderr, /my_context: the SubagentStop audit record could not be written/);
  assert.match(captured.stderr, /--op subagent-stop/);
});

test('PostCompact discloses the compaction row it could not write', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => recordPostCompact({
    hook_event_name: 'PostCompact', session_id: 's1', cwd, trigger: 'auto',
    compact_summary: 'a summary',
  }, cwd));

  assert.notEqual(captured.value, null, 'the handler must still return its outcome');
  assert.match(captured.stderr, /my_context: the PostCompact audit record could not be written/);
  assert.match(captured.stderr, /--op post-compact/);
});

test('the capture nudge is still emitted, and the row it could not write is disclosed', (t) => {
  const cwd = sandbox(t, { watchedDocs: ['docs/prd/**'] });
  breakAuditLog(cwd);

  const captured = capturingStderr(() => nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') }, cwd,
  }, cwd));

  assert.match(captured.value, /docs\/prd\/auth\.md/, 'the nudge itself must still be emitted');
  assert.match(captured.stderr, /my_context: the PostToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op post-tool-use/);
});

test('an Agent dispatch row that could not be written is disclosed', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => agentDispatchNote({
    session_id: 's1', cwd, tool_name: 'Agent',
    tool_input: { subagent_type: 'general-purpose', description: 'do a thing' },
    tool_response: { agentId: 'agent-1' },
  }, cwd));

  assert.match(captured.stderr, /my_context: the PostToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op agent-dispatched/);
});

test('a live lane step that could not be recorded is disclosed', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => agentStepNote({
    session_id: 's1', cwd, tool_name: 'Bash', tool_input: { command: 'echo hi' },
    agent_id: 'agent-1', agent_type: 'general-purpose',
  }, cwd));

  assert.match(captured.stderr, /my_context: the PostToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op agent-step/);
});

test('PreCompact writes its snapshot, and discloses the row that says what it captured', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => buildRestoreSnapshot({
    session_id: 's1', hook_event_name: 'PreCompact', cwd,
  }, cwd));

  // The snapshot is the thing this hook exists for and it must survive: the
  // disclosure is about the RECORD of what it captured, not about the file.
  assert.notEqual(captured.value, null, 'the snapshot must still have been written');
  assert.match(captured.stderr, /my_context: the PreCompact audit record could not be written/);
  assert.match(captured.stderr, /--op pre-compact/);
});

test('an Agent dispatch waived by the escape hatch discloses the waiver it could not record', (t) => {
  const cwd = sandbox(t, { dispatchGate: { enabled: true } });
  breakAuditLog(cwd);

  const captured = capturingStderr(() => runPreToolUse(JSON.stringify({
    session_id: 's1', hook_event_name: 'PreToolUse', cwd, tool_name: 'Agent',
    tool_input: { prompt: 'no-item: this is a one-off spike with nothing to file' },
  }), cwd));

  assert.equal(captured.value, '', 'the dispatch must still be allowed through');
  assert.match(captured.stderr, /my_context: the PreToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op agent-item-waived/);
});

test('a refused Agent dispatch still refuses, and discloses the deny row it could not write', (t) => {
  const cwd = sandbox(t, { dispatchGate: { enabled: true } });
  breakAuditLog(cwd);

  const captured = capturingStderr(() => runPreToolUse(JSON.stringify({
    session_id: 's1', hook_event_name: 'PreToolUse', cwd, tool_name: 'Agent',
    tool_input: { prompt: 'go and do some work, naming nothing' },
  }), cwd));

  assert.match(captured.value, /"permissionDecision":"deny"/, 'the refusal must still stand');
  assert.match(captured.stderr, /my_context: the PreToolUse audit record could not be written/);
  assert.match(captured.stderr, /--op deny/);
});

test('SessionEnd clears the window and discloses the row it could not write', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => buildSessionEndOutcome({
    hook_event_name: 'SessionEnd', session_id: 's1', cwd, reason: 'clear',
  }, cwd));

  assert.equal(captured.value.action, 'cleared', 'the clear must still have happened');
  assert.match(captured.stderr, /my_context: the SessionEnd audit record could not be written/);
  assert.match(captured.stderr, /--op session-end/);
});

test('a SessionEnd reason this build does not know is disclosed when its row is lost', (t) => {
  const cwd = sandbox(t);
  breakAuditLog(cwd);

  const captured = capturingStderr(() => buildSessionEndOutcome({
    hook_event_name: 'SessionEnd', session_id: 's1', cwd, reason: 'teleported',
  }, cwd));

  // The unknown-reason row is the ONLY thing that would ever say a new
  // platform member arrived. Losing it silently is the whole defect twice.
  assert.equal(captured.value.action, 'unknown');
  assert.match(captured.stderr, /my_context: the SessionEnd audit record could not be written/);
  assert.match(captured.stderr, /--op session-end/);
});

test('a backfilled lane step that could not be recorded is disclosed once, with a count', (t) => {
  const cwd = sandbox(t);
  const transcript = path.join(cwd, 'transcript.jsonl');
  const line = (tool: string, input: Record<string, unknown>) => JSON.stringify({
    type: 'assistant', timestamp: '2026-09-04T00:00:00.000Z',
    message: { content: [{ type: 'tool_use', name: tool, input }] },
  });
  writeFileSync(transcript, [
    line('Read', { file_path: 'src/core/audit.ts' }),
    line('Bash', { command: 'npm test' }),
  ].join('\n') + '\n', 'utf8');
  breakAuditLog(cwd);

  const captured = capturingStderr(() => recordAgentSteps({
    session_id: 's1', cwd, agent_id: 'agent-77', agent_transcript_path: transcript,
  }, cwd));

  assert.match(captured.stderr, /my_context: the SubagentStop audit record could not be written/);
  assert.match(captured.stderr, /--op agent-step/);
  // One line for the whole backfill, not one per step: this loop writes up to
  // `MAX_STEP_ROWS` rows and a line each would bury its own disclosure.
  assert.equal(
    captured.stderr.split('\n').filter((l) => l.startsWith('my_context:')).length, 1,
    'the backfill discloses once for the whole run',
  );
  assert.match(captured.stderr, /2 /, 'and says how many rows were lost');
});

/* ---------------------------------------------------------------------------
 * THE OTHER DIRECTION — a healthy log says nothing at all.
 * ------------------------------------------------------------------------- */

test('a log that takes the write discloses nothing on any of these paths', (t) => {
  const cwd = sandbox(t, { watchedDocs: ['docs/prd/**'] });
  addItem(cwd, 'CONST-pool', ['src/db/**']);
  index(cwd);

  const captured = capturingStderr(() => {
    runPreToolUse(JSON.stringify({
      session_id: 's1', hook_event_name: 'PreToolUse', cwd,
      tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
    }), cwd);
    runPreToolUse(JSON.stringify({
      session_id: 's2', hook_event_name: 'PreToolUse', cwd, tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, '.my_context', 'items', 'constraint', 'x.md') },
    }), cwd);
    nudgeFor({
      tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') }, cwd,
    }, cwd);
    agentStepNote({
      session_id: 's1', cwd, tool_name: 'Bash', tool_input: { command: 'echo hi' },
      agent_id: 'agent-1',
    }, cwd);
    buildSubagentStartOutput({ session_id: 's1', cwd, agent_id: 'agent-1' }, cwd);
    observeAndRecord(SUBAGENT_STOP, { session_id: 's1', cwd, agent_id: 'agent-1' }, cwd);
    buildSessionEndOutcome({
      hook_event_name: 'SessionEnd', session_id: 's1', cwd, reason: 'clear',
    }, cwd);
  });

  assert.doesNotMatch(
    captured.stderr, /audit record could not be written/,
    'a working log is the silent case, and it must stay silent',
  );
});
