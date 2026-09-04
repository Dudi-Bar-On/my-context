/**
 * `agent-step` — one audit row per tool call in a lane's OWN transcript,
 * backfilled once on `SubagentStop` (TASK-the-audit-stream-cannot-say-what-a-
 * lane-was-doing-at-a-given). The transcript path arrives as
 * `agent_transcript_path` (`hooks/io.ts`) and is read exactly once, here —
 * nothing on the hot (per-tool-call) path changes.
 *
 * Covered, per the task's own list: three tool calls produce three rows in
 * order; each row carries the tool name, a short subject and the joining
 * `agent=<id>`; the whole tool INPUT is never in the row; an empty transcript
 * records nothing; a missing file records nothing and does not throw; a
 * malformed line is skipped while its neighbours still record; a large
 * transcript is bounded rather than read whole; and the rows join to a
 * `subagent-stop` row on the agent id.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import {
  MAX_TRANSCRIPT_READ_BYTES, recordAgentSteps, SUBAGENT_STOP, transcriptSteps,
} from '../../src/hooks/subagent-stop.ts';
import { agentStepNote } from '../../src/hooks/post-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUBAGENT_STOP_BINARY = path.join(REPO_ROOT, 'src', 'hooks', 'subagent-stop.ts');

/** Runs the real `subagent-stop.ts` binary as an OS process, over real stdio. */
function runSubagentStop(payload: string, cwd: string): Promise<{ code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath, ['--disable-warning=ExperimentalWarning', SUBAGENT_STOP_BINARY],
      { cwd, stdio: ['pipe', 'ignore', 'ignore'] },
    );
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('subagent-stop.ts did not exit within 30s'));
    }, 30_000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code }); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.stdin.end(payload);
  });
}

function box(): { root: string; dispose(): void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-agent-steps-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  return { root, dispose: () => removeTree(cwd) };
}

/** One realistic transcript line: an assistant turn with one tool_use block. */
function toolUseLine(name: string, input: Record<string, unknown>, at: string): string {
  return JSON.stringify({
    parentUuid: null, isSidechain: true, agentId: 'a1b2c3', type: 'assistant',
    timestamp: at,
    message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
  });
}

function transcriptFile(dir: string, lines: string[]): string {
  const file = path.join(dir, 'transcript.jsonl');
  writeFileSync(file, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  return file;
}

test('three tool calls produce three rows, in order, each naming the tool and joining the agent', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-'));
    const file = transcriptFile(dir, [
      toolUseLine('Read', { file_path: 'src/core/audit.ts' }, '2026-09-04T00:00:00.000Z'),
      toolUseLine('Bash', { command: 'npm test', description: 'Run the suite' }, '2026-09-04T00:00:01.000Z'),
      toolUseLine('Grep', { pattern: 'HOOK_OPS' }, '2026-09-04T00:00:02.000Z'),
    ]);

    recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: file,
    }, path.dirname(b.root));

    const rows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.equal(rows.length, 3, 'expected exactly one row per tool call');
    assert.deepEqual(rows.map((r) => r.at), [
      '2026-09-04T00:00:00.000Z', '2026-09-04T00:00:01.000Z', '2026-09-04T00:00:02.000Z',
    ], 'rows must be in transcript order and carry the RECORD\'s own timestamp');

    assert.match(rows[0].note ?? '', /Read/);
    assert.match(rows[0].note ?? '', /src\/core\/audit\.ts/);
    assert.match(rows[1].note ?? '', /Bash/);
    assert.match(rows[1].note ?? '', /Run the suite/, 'description is the preferred subject');
    assert.match(rows[2].note ?? '', /Grep/);
    assert.match(rows[2].note ?? '', /HOOK_OPS/);

    for (const row of rows) {
      assert.match(row.note ?? '', /agent=agent-77/, 'every row must join on the agent id');
      assert.equal(row.kind, 'hook');
      assert.equal(row.hook, 'SubagentStop');
      assert.equal(row.sessionId, 's1');
    }
    removeTree(dir);
  } finally { b.dispose(); }
});

test('the whole tool input is never in the row — only the short subject', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-input-'));
    const hugeCommand = 'echo '.padEnd(5000, 'x');
    const file = transcriptFile(dir, [
      toolUseLine('Bash', { command: hugeCommand }, '2026-09-04T00:00:00.000Z'),
    ]);

    recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: file,
    }, path.dirname(b.root));

    const rows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.equal(rows.length, 1);
    assert.ok((rows[0].note ?? '').length < 400, 'the row must not carry the whole 5000-char input');
    assert.equal((rows[0].note ?? '').includes(hugeCommand), false);
    removeTree(dir);
  } finally { b.dispose(); }
});

test('an empty transcript produces no rows', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-empty-'));
    const file = transcriptFile(dir, []);
    recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: file,
    }, path.dirname(b.root));
    assert.deepEqual(readAudit(b.root).filter((r) => r.op === 'agent-step'), []);
    removeTree(dir);
  } finally { b.dispose(); }
});

test('a missing transcript file produces no rows and does not throw', () => {
  const b = box();
  try {
    assert.doesNotThrow(() => recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: path.join(tmpdir(), 'myctx-does-not-exist', 'nope.jsonl'),
    }, path.dirname(b.root)));
    assert.deepEqual(readAudit(b.root).filter((r) => r.op === 'agent-step'), []);
  } finally { b.dispose(); }
});

test('a malformed line is skipped while its neighbours still record', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-bad-line-'));
    const file = transcriptFile(dir, [
      toolUseLine('Read', { file_path: 'a.ts' }, '2026-09-04T00:00:00.000Z'),
      'not json at all {{{',
      toolUseLine('Read', { file_path: 'b.ts' }, '2026-09-04T00:00:02.000Z'),
    ]);
    recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: file,
    }, path.dirname(b.root));
    const rows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.equal(rows.length, 2, 'the malformed line is skipped, not fatal to its neighbours');
    assert.match(rows[0].note ?? '', /a\.ts/);
    assert.match(rows[1].note ?? '', /b\.ts/);
    removeTree(dir);
  } finally { b.dispose(); }
});

test('an unrecognised record shape is skipped rather than guessed at', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-unknown-'));
    const file = transcriptFile(dir, [
      JSON.stringify({ type: 'summary', summary: 'compacted', leafUuid: 'x' }),
      toolUseLine('Read', { file_path: 'a.ts' }, '2026-09-04T00:00:00.000Z'),
      JSON.stringify({
        parentUuid: 'x', isSidechain: true, type: 'assistant',
        message: { role: 'assistant', content: 'a plain string, not an array' },
      }),
    ]);
    recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77',
      agent_transcript_path: file,
    }, path.dirname(b.root));
    const rows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.equal(rows.length, 1);
    assert.match(rows[0].note ?? '', /a\.ts/);
    removeTree(dir);
  } finally { b.dispose(); }
});

test('missing agent_id records nothing, matching the join gate the SubagentStop row already uses', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-noagent-'));
    const file = transcriptFile(dir, [
      toolUseLine('Read', { file_path: 'a.ts' }, '2026-09-04T00:00:00.000Z'),
    ]);
    recordAgentSteps({ session_id: 's1', cwd: path.dirname(b.root), agent_transcript_path: file },
      path.dirname(b.root));
    assert.deepEqual(readAudit(b.root).filter((r) => r.op === 'agent-step'), []);
    removeTree(dir);
  } finally { b.dispose(); }
});

test('a large transcript is bounded rather than read whole, and does not throw', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-huge-'));
    const filler = `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'x'.repeat(500) } })}\n`;
    const fillerBytes = Buffer.byteLength(filler, 'utf8');
    const repeats = Math.ceil((MAX_TRANSCRIPT_READ_BYTES * 1.2) / fillerBytes);
    const file = path.join(dir, 'huge.jsonl');
    // One big buffer built in memory, then one write — building it with
    // thousands of separate appendFileSync calls dominates this test's own
    // wall time and has nothing to do with the property under test.
    const body = filler.repeat(repeats)
      + `${toolUseLine('Read', { file_path: 'tail-marker.ts' }, '2026-09-04T09:00:00.000Z')}\n`;
    writeFileSync(file, body, 'utf8');

    const start = Date.now();
    assert.doesNotThrow(() => recordAgentSteps({
      session_id: 's1', cwd: path.dirname(b.root), agent_id: 'agent-77', agent_transcript_path: file,
    }, path.dirname(b.root)));
    const elapsed = Date.now() - start;
    // The hook's own `hooks.json` timeout is 3s; a bounded read over ~10 MiB
    // measures in the tens of ms, so 1000ms leaves ample margin without the
    // assertion being loose enough to hide a real regression.
    assert.ok(elapsed < 1000, `bounded read took ${elapsed}ms, must stay well under the hook timeout`);

    const rows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.ok(rows.length >= 1, 'the tail marker must still be found within the bounded read');
    assert.ok(rows.some((r) => (r.note ?? '').includes('tail-marker.ts')));
    removeTree(dir);
  } finally { b.dispose(); }
});

test('transcriptSteps: three tool calls produce three ordered steps with no whole-input leakage', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-unit-'));
  const file = transcriptFile(dir, [
    toolUseLine('Read', { file_path: 'x.ts' }, '2026-09-04T00:00:00.000Z'),
    toolUseLine('Edit', { file_path: 'y.ts' }, '2026-09-04T00:00:01.000Z'),
  ]);
  const steps = transcriptSteps(file, 'agent-1');
  assert.equal(steps.length, 2);
  assert.match(steps[0].note, /Read.*x\.ts.*agent=agent-1/);
  assert.match(steps[1].note, /Edit.*y\.ts.*agent=agent-1/);
  removeTree(dir);
});

test('the agent-step rows join to the subagent-stop row on the same agent id', () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-transcript-join-'));
    const file = transcriptFile(dir, [
      toolUseLine('Read', { file_path: 'a.ts' }, '2026-09-04T00:00:00.000Z'),
    ]);
    const input = {
      session_id: 'sess-join-steps', cwd: path.dirname(b.root), agent_id: 'agent-join-42',
      agent_type: 'general-purpose', agent_transcript_path: file,
    };
    observeAndRecord(SUBAGENT_STOP, input, path.dirname(b.root));
    recordAgentSteps(input, path.dirname(b.root));

    const all = readAudit(b.root);
    const stepRow = all.find((r) => r.op === 'agent-step');
    const stopRow = all.find((r) => r.op === 'subagent-stop');
    assert.ok(stepRow, 'no agent-step row was written');
    assert.ok(stopRow, 'no subagent-stop row was written');

    const idOf = (note: string | undefined) => /agent=([^:\s]+)/.exec(note ?? '')?.[1];
    assert.equal(idOf(stepRow!.note), 'agent-join-42');
    assert.equal(idOf(stopRow!.note), 'agent-join-42');
    removeTree(dir);
  } finally { b.dispose(); }
});

/* ---------------------------------------------------------------------------
 * The duplication proof (TASK-a-lane-step-is-recorded-as-it-happens-because-
 * the-hook, hooks/33). The decision: the live writer (`post-tool-use.ts`'s
 * `agentStepNote`) is the ONLY writer; the real `subagent-stop.ts` binary's
 * main entry no longer calls `recordAgentSteps` at all. This is not asserted
 * from the source — it is MEASURED against the real, spawned binary: a
 * transcript that would backfill to 3 rows if the old path still ran, a lane
 * that already wrote its 3 rows live, and a real `SubagentStop` firing for
 * the SAME agent id and the SAME transcript in between — then the total is
 * counted and shown to be 3, not 6.
 * ------------------------------------------------------------------------- */

test('a real SubagentStop firing adds zero rows for a lane whose steps were already written live', async () => {
  const b = box();
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-noduplicate-'));
    // A real, valid transcript the OLD backfill path would have turned into
    // 3 more `agent-step` rows, had `recordAgentSteps` still been called from
    // this binary's main entry.
    const file = transcriptFile(dir, [
      toolUseLine('Read', { file_path: 'a.ts' }, '2026-09-04T00:00:00.000Z'),
      toolUseLine('Bash', { command: 'npm test', description: 'Run the suite' }, '2026-09-04T00:00:01.000Z'),
      toolUseLine('Grep', { pattern: 'HOOK_OPS' }, '2026-09-04T00:00:02.000Z'),
    ]);
    const cwd = path.dirname(b.root);
    const agentId = 'agent-noduplicate-1';

    // 1. The lane runs: three live PostToolUse firings, exactly as
    //    `post-tool-use.ts`'s widened matcher would produce for these three
    //    real tool calls, while the lane is still working.
    agentStepNote({
      session_id: 'sess-noduplicate', cwd, tool_name: 'Read',
      tool_input: { file_path: 'a.ts' }, agent_id: agentId,
    }, cwd);
    agentStepNote({
      session_id: 'sess-noduplicate', cwd, tool_name: 'Bash',
      tool_input: { command: 'npm test', description: 'Run the suite' }, agent_id: agentId,
    }, cwd);
    agentStepNote({
      session_id: 'sess-noduplicate', cwd, tool_name: 'Grep',
      tool_input: { pattern: 'HOOK_OPS' }, agent_id: agentId,
    }, cwd);

    const liveRows = readAudit(b.root).filter((r) => r.op === 'agent-step');
    assert.equal(liveRows.length, 3, 'the live writer must have already recorded all three steps');

    // 2. The lane ends: a real SubagentStop firing, for the SAME agent id,
    //    with `agent_transcript_path` pointing at a transcript that DOES
    //    contain those same three tool_use blocks (proving this is not
    //    passing only because the transcript was unreadable).
    const result = await runSubagentStop(JSON.stringify({
      hook_event_name: 'SubagentStop', session_id: 'sess-noduplicate', cwd,
      agent_id: agentId, agent_type: 'general-purpose', agent_transcript_path: file,
      stop_hook_active: false,
    }), cwd);
    assert.equal(result.code, 0);

    // 3. The measurement: still exactly 3 `agent-step` rows for this agent,
    //    not 6 — and the `subagent-stop` row for the same agent id exists,
    //    proving the binary ran and simply did not re-derive the steps.
    const after = readAudit(b.root);
    const stepRows = after.filter((r) => r.op === 'agent-step' && (r.note ?? '').includes(`agent=${agentId}`));
    const stopRows = after.filter((r) => r.op === 'subagent-stop' && (r.note ?? '').includes(`agent=${agentId}`));
    assert.equal(stepRows.length, 3,
      'a real SubagentStop firing for a lane whose steps were already live must add ZERO agent-step rows');
    assert.equal(stopRows.length, 1, 'the subagent-stop row itself must still be written');

    removeTree(dir);
  } finally { b.dispose(); }
});
