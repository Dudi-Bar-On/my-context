import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { agentDispatchNote, buildOutput, nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { SUBAGENT_STOP } from '../../src/hooks/subagent-stop.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(watchedDocs?: string[]): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nudge-'));
  runCli(['init'], cwd, () => {});
  if (watchedDocs) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', watchedDocs }, null, 2) + '\n',
    );
  }
  return cwd;
}

test('a watched document produces a nudge naming the file, within a tight token budget', () => {
  const cwd = project(['docs/prd/**']);
  const relative = 'docs/prd/auth.md';
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);

  assert.match(text, /docs\/prd\/auth\.md/);
  assert.match(text, /create_item/);

  // The path must appear exactly once — interpolating it twice is how a deep
  // path (long relative path) can silently blow past the token budget while
  // a short one in a test still looks fine.
  const occurrences = text.split(relative).length - 1;
  assert.equal(occurrences, 1, `path appears ${occurrences} times, expected 1`);

  // Bound the CONSTANT part of the message, not the total: the total grows
  // with the (variable-length, caller-controlled) path, so a bound on the
  // total doesn't actually constrain the message's own verbosity.
  const constantChars = text.length - relative.length;
  assert.ok(
    constantChars < 200,
    `constant portion is ${constantChars} chars — budget is ~30 tokens`,
  );
  removeTree(cwd);
});

test('an unwatched file produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Edit',
    tool_input: { file_path: path.join(cwd, 'src', 'db', 'writer.ts') },
    cwd,
  }, cwd);
  assert.equal(text, '');
  removeTree(cwd);
});

test('a windows-style backslash path still matches a POSIX glob', { skip: process.platform !== 'win32' }, () => {
  // Only meaningful on win32: a backslash is an ordinary filename character
  // on POSIX, so a manually-built `${cwd}\\docs\\prd\\auth.md` string is a
  // SIBLING of cwd there, not a child — this test would fail on Linux for a
  // reason that has nothing to do with the property under test.
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: `${cwd}\\docs\\prd\\auth.md` },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  removeTree(cwd);
});

test('a native child path is normalized to POSIX on every platform', () => {
  // The cross-platform half of the property above: path.join uses the
  // native separator, so this is a genuine child path on both win32 and
  // POSIX, and the nudge must always report it with forward slashes.
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  removeTree(cwd);
});

test('a file outside the repository produces nothing, even under a catch-all watch pattern', () => {
  // watchedDocs is '**' here specifically so this test cannot pass merely
  // because the escaped path fails the glob — the '..' guard itself must do
  // the work, which is the property this test names.
  const cwd = project(['**']);
  const outside = path.join(tmpdir(), 'docs', 'prd', 'elsewhere.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: outside }, cwd }, cwd), '');
  removeTree(cwd);
});

test('a cross-drive or UNC path never leaks into the nudge', { skip: process.platform !== 'win32' }, () => {
  // On win32, path.relative(repoRoot, target) returns an ABSOLUTE path (not
  // '..'-prefixed) when the two paths are on different drives/roots. A
  // guard that only checks for a leading '..' misses this entirely and
  // leaks the foreign absolute path into the model's context.
  const cwd = project(['**']);
  const otherDrive = cwd[0].toUpperCase() === 'C' ? 'D' : 'C';
  const candidates = [
    `${otherDrive}:\\secrets\\notes.md`,
    '\\\\server\\share\\notes.md',
    `${otherDrive}:/other/repo/README.md`,
  ];
  for (const file_path of candidates) {
    assert.equal(
      nudgeFor({ tool_name: 'Write', tool_input: { file_path }, cwd }, cwd),
      '',
      `expected no nudge for ${file_path}`,
    );
  }
  removeTree(cwd);
});

test('my_context items never nudge about themselves', () => {
  const cwd = project(['**/*.md']);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: item }, cwd }, cwd), '');
  removeTree(cwd);
});

test('the self-nudge guard covers a nested workspace, the .my-context spelling and MultiEdit', () => {
  const cwd = project(['**']);

  const nested = path.join(cwd, 'packages', 'foo', '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: nested }, cwd }, cwd), '');

  const altSpelling = path.join(cwd, '.my-context', 'items', 'constraint', 'CONST-b.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: altSpelling }, cwd }, cwd), '');

  // MultiEdit is watched (unlike PreToolUse's Read|Edit|Write deny matcher)
  // specifically so a MultiEdit into a nested workspace is caught too.
  const nestedMultiEdit = path.join(cwd, 'packages', 'foo', '.my_context', 'items', 'constraint', 'CONST-c.md');
  assert.equal(
    nudgeFor({ tool_name: 'MultiEdit', tool_input: { file_path: nestedMultiEdit }, cwd }, cwd),
    '',
  );
  removeTree(cwd);
});

/**
 * The self-nudge guard shares `managedSplit` with the PreToolUse write-deny
 * (see the comment on that helper), so the case-insensitivity fix that closed
 * the deny bypass has to hold here too — otherwise a case-varied spelling of
 * the workspace, which on NTFS is the same directory, produces a nudge telling
 * the model to capture an item about the item store itself.
 */
test('the self-nudge guard is case-insensitive on the managed segment', () => {
  const cwd = project(['**']);
  for (const spelling of ['.MY_CONTEXT', '.My_Context', '.MY-CONTEXT']) {
    const item = path.join(cwd, spelling, 'items', 'constraint', 'CONST-a.md');
    assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: item }, cwd }, cwd), '', spelling);
  }
  removeTree(cwd);
});

test('a tool other than Write or Edit produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.md');
  assert.equal(nudgeFor({ tool_name: 'Read', tool_input: { file_path: file }, cwd }, cwd), '');
  assert.equal(nudgeFor({ tool_name: 'Bash', tool_input: {} }, cwd), '');
  removeTree(cwd);
});

test('NotebookEdit is not a watched tool, even for a path that would otherwise match', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.ipynb');
  assert.equal(
    nudgeFor({ tool_name: 'NotebookEdit', tool_input: { file_path: file }, cwd }, cwd),
    '',
  );
  removeTree(cwd);
});

test('no workspace, malformed input and a missing path all fail open', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(bare, 'docs', 'prd', 'a.md') }, cwd: bare,
  }, bare), '');
  assert.equal(nudgeFor({}, bare), '');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: {} }, bare), '');
  removeTree(bare);
});

test('a corrupt config fails open rather than throwing', () => {
  const cwd = project();
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'a.md') }, cwd,
  }, cwd), '');
  removeTree(cwd);
});

test('the default watchedDocs cover spec and plan directories', () => {
  const cwd = project();
  const file = path.join(cwd, 'docs', 'superpowers', 'specs', '2026-08-12-design.md');
  assert.match(nudgeFor({ tool_name: 'Write', tool_input: { file_path: file }, cwd }, cwd), /specs/);
  removeTree(cwd);
});

test('buildOutput emits the documented hook JSON on one line', () => {
  const line = buildOutput('You edited docs/prd/auth.md.');
  const parsed = JSON.parse(line) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.equal(parsed.hookSpecificOutput.additionalContext, 'You edited docs/prd/auth.md.');
  assert.equal(line.includes('\n'), false);
});

test('buildOutput emits nothing for an empty nudge', () => {
  assert.equal(buildOutput(''), '');
});

/* ---------------------------------------------------------------------------
 * agentDispatchNote — one row per Agent dispatch (V2-HANDOVER §"the
 * agent-title hook"). The title is `tool_input.description` on the `Agent`
 * tool, the join key is `tool_response.agentId` on the SAME payload, and the
 * owner chose one row per dispatch over per-tool-call auditing.
 * ------------------------------------------------------------------------- */

function auditRows(root: string): AuditRecord[] {
  return readAudit(root);
}

test('a real PostToolUse(Agent) payload produces exactly one row carrying type, description and id', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-dispatch-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  try {
    // Shaped exactly as build 2.1.239's own Agent tool call: `tool_input`
    // carries `description`, `prompt` and `subagent_type`; `tool_response`
    // carries `agentId` — the pair V2-HANDOVER measured on the same payload.
    agentDispatchNote({
      session_id: 'sess-dispatch-1',
      cwd,
      tool_name: 'Agent',
      // `prompt` is also on the wire for a real dispatch and is deliberately
      // NOT part of `HookInput.tool_input`'s type — this hook never reads it,
      // and a declared field nothing reads is a claim about the payload no
      // test can hold up (`post-tool-use-failure.ts` states the same rule).
      // The hand-piped verification below sends it on the raw JSON payload.
      tool_input: {
        description: 'Grepping runChecks signature in checks.ts',
        subagent_type: 'general-purpose',
      },
      tool_response: { agentId: 'agent-real-001' },
    }, cwd);

    const rows = auditRows(root).filter((r) => r.op === 'agent-dispatched');
    assert.equal(rows.length, 1, 'expected exactly one dispatch row');
    const [row] = rows;
    assert.equal(row.kind, 'hook');
    assert.equal(row.hook, 'PostToolUse');
    assert.equal(row.sessionId, 'sess-dispatch-1');
    assert.match(row.note ?? '', /general-purpose/, 'the agent type is missing from the row');
    assert.match(row.note ?? '', /agent-real-001/, 'the agent id is missing from the row');
    assert.match(
      row.note ?? '', /Grepping runChecks signature in checks\.ts/,
      'the description is missing from the row',
    );
  } finally { removeTree(cwd); }
});

test('a payload missing the description still records the id, rather than dropping the row', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-dispatch-nodesc-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  try {
    agentDispatchNote({
      session_id: 'sess-dispatch-2',
      cwd,
      tool_name: 'Agent',
      tool_input: { subagent_type: 'general-purpose' },
      tool_response: { agentId: 'agent-no-desc' },
    }, cwd);

    const rows = auditRows(root).filter((r) => r.op === 'agent-dispatched');
    assert.equal(rows.length, 1, 'a dropped row is worse than one missing a description');
    assert.match(rows[0].note ?? '', /agent-no-desc/, 'the id must survive when the title does not');
  } finally { removeTree(cwd); }
});

test('a malformed PostToolUse(Agent) payload does not throw, per INV-hooks-fail-open', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-dispatch-malformed-'));
  runCli(['init'], cwd, () => {});
  try {
    assert.doesNotThrow(() => agentDispatchNote({
      tool_name: 'Agent',
      // @ts-expect-error -- deliberately the wrong shape; a real payload is untyped JSON.
      tool_input: 'not an object',
      // @ts-expect-error -- same.
      tool_response: 42,
    }, cwd));
    assert.doesNotThrow(() => agentDispatchNote({ tool_name: 'Agent' }, cwd));
    assert.doesNotThrow(() => agentDispatchNote({}, cwd));
  } finally { removeTree(cwd); }
});

test('the dispatch row is not written for a tool other than Agent', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-dispatch-other-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  try {
    agentDispatchNote({
      session_id: 'sess-dispatch-3',
      cwd,
      tool_name: 'Write',
      tool_input: { description: 'not an agent dispatch', subagent_type: 'general-purpose' },
      tool_response: { agentId: 'agent-should-not-appear' },
    }, cwd);
    agentDispatchNote({ session_id: 'sess-dispatch-3', cwd, tool_name: 'Bash' }, cwd);

    const rows = auditRows(root).filter((r) => r.op === 'agent-dispatched');
    assert.equal(rows.length, 0, 'the widened matcher must not turn into an audit of every tool');
  } finally { removeTree(cwd); }
});

test('the dispatch row joins to the matching subagent-stop row on the agent id', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-dispatch-join-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  try {
    agentDispatchNote({
      session_id: 'sess-join-1',
      cwd,
      tool_name: 'Agent',
      tool_input: { description: 'Doing the joinable thing', subagent_type: 'general-purpose' },
      tool_response: { agentId: 'agent-join-99' },
    }, cwd);

    observeAndRecord(SUBAGENT_STOP, {
      session_id: 'sess-join-1', cwd, agent_id: 'agent-join-99', agent_type: 'general-purpose',
    }, cwd);

    const dispatchRow = auditRows(root).find((r) => r.op === 'agent-dispatched');
    const stopRow = auditRows(root).find((r) => r.op === 'subagent-stop');
    assert.ok(dispatchRow, 'no dispatch row was written');
    assert.ok(stopRow, 'no subagent-stop row was written');

    const idOf = (note: string | undefined) => /agent=([^:\s]+)/.exec(note ?? '')?.[1];
    const dispatchId = idOf(dispatchRow!.note);
    const stopId = idOf(stopRow!.note);
    assert.ok(dispatchId, 'could not extract an agent id from the dispatch row');
    assert.equal(dispatchId, 'agent-join-99');
    assert.equal(stopId, 'agent-join-99');
    assert.equal(dispatchId, stopId, 'the two rows do not join on the same agent id');
  } finally { removeTree(cwd); }
});
