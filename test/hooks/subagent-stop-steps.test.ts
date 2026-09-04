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
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import {
  MAX_TRANSCRIPT_READ_BYTES, recordAgentSteps, SUBAGENT_STOP, transcriptSteps,
} from '../../src/hooks/subagent-stop.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

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
