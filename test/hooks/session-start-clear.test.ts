/**
 * `/clear` destroys a context window; until this branch existed, it left the
 * window's dedupe state behind. The next injection into the now-empty window
 * therefore believed it had already delivered everything — the just-in-time
 * tier went silent for the rest of the session, and a later compaction would
 * have restored a snapshot describing items the cleared window never held.
 *
 * Every test here asks one of two questions, the same pair
 * `test/core/seen-clear.test.ts` asks of `clearSeen` itself: did the clear
 * remove something it should not have, or did it CLAIM a removal it did not
 * perform. The second is `INV-nothing-is-dropped-silently` in its
 * addition-shaped direction — a window told "cleared" when nothing was
 * cleared has been told something false about its own knowledge base.
 *
 * The two "unchanged" tests at the end carry as much weight as the first:
 * `buildInjection` is shared verbatim by the SessionStart hook, the
 * `load_context` MCP tool and SubagentStart, so a branch on `source` is a
 * branch every one of those surfaces takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { snapshotPath, writeSnapshot } from '../../src/core/ledger.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { appendSeen, readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { runCli } from '../../src/cli/index.ts';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-clear-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

function addItem(cwd: string, id: string, opts: {
  always?: boolean; scope?: string[]; body?: string;
} = {}): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const scope = opts.scope ?? [];
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${id} title
status: active
severity: hard
always: ${opts.always ?? false}
scope:${scope.length === 0 ? ' []' : `\n${scope.map((s) => `  - "${s}"`).join('\n')}`}
---

# ${id} title

${opts.body ?? 'Body text.'}
`);
}

/** Index the workspace the way a SessionStart would, so the JIT hook can read it. */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function toolInput(cwd: string, sessionId: string, filePath: string): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: 'Read',
    tool_input: { file_path: filePath },
  });
}

function jitContext(raw: string): string {
  if (raw === '') return '';
  const parsed = JSON.parse(raw) as { hookSpecificOutput: { additionalContext?: string } };
  return parsed.hookSpecificOutput.additionalContext ?? '';
}

/**
 * The injection record the call under test just wrote — the LAST matching
 * one, not the first. `op` is filtered because a test that also exercises the
 * JIT hook writes `jit` records after the session start, and the note being
 * asserted belongs to the session start.
 */
function lastInjection(cwd: string, op: AuditRecord['op'] = 'session-start'): AuditRecord {
  const records = readAudit(root(cwd)).filter((r) => r.kind === 'injection' && r.op === op);
  assert.notEqual(records.length, 0, `no ${op} injection was recorded at all`);
  return records[records.length - 1];
}

function note(cwd: string, op: AuditRecord['op'] = 'session-start'): string {
  return lastInjection(cwd, op).note ?? '';
}

test('a clear removes the seen files before the seen file is read, so items arrive again', (t) => {
  const cwd = sandbox(t);
  // Scoped, not pinned: the JIT tier is the one the seen file actually gates.
  addItem(cwd, 'CONST-pool', { scope: ['src/db/**'], body: 'Pool capped at 20.' });
  index(cwd);

  const read = () => jitContext(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/w.ts')), cwd));
  assert.match(read(), /Pool capped at 20\./, 'the first read must deliver, or this proves nothing');
  assert.equal(read(), '', 'the second read is suppressed by the seen file — the state being cleared');

  // A subagent sibling too: `/clear` destroys the window every one of them
  // was delivering into, so `session::agent` state is as stale as the
  // parent's.
  appendSeen(root(cwd), 's1::a1', [{ id: 'CONST-pool', tier: 'jit', at: 'T0' }]);
  assert.equal(existsSync(seenFilePath(root(cwd), 's1::a1')), true);

  const out = buildSessionStartOutput(cwd, { source: 'clear', sessionId: 's1' });

  assert.equal(existsSync(seenFilePath(root(cwd), 's1::a1')), false, 'the sibling was left behind');
  assert.equal(
    seenIds(readSeen(root(cwd), 's1')).includes('CONST-pool'), false,
    'the parent seen file still remembers a delivery the cleared window no longer holds',
  );
  // The defect, end to end: the tier that went silent speaks again.
  assert.match(read(), /Pool capped at 20\./, 'the JIT tier is still suppressed after a clear');

  // Disclosed on both channels — the audit note and the block the model reads.
  assert.match(note(cwd), /source=clear/);
  assert.match(note(cwd), /cleared \d+ seen file\(s\)/);
  assert.match(out, /cleared \d+ seen file\(s\)/, 'the model was told nothing about the clear');
});

test('a clear removes the restore snapshot', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  addItem(cwd, 'CONST-snap', { body: 'Snapshotted body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-snap']);
  assert.equal(existsSync(snapshotPath(root(cwd), 's1')), true);

  buildSessionStartOutput(cwd, { source: 'clear', sessionId: 's1' });

  assert.equal(
    existsSync(snapshotPath(root(cwd), 's1')), false,
    'the snapshot describes a window that no longer exists',
  );
  assert.match(note(cwd), /restore snapshot/);

  // The consequence, not just the file: a compaction later in the same
  // session must not restore items the cleared window never held.
  const after = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.doesNotMatch(after, /Snapshotted body\./);
});

test('a clear that removed nothing says so rather than claiming it cleared', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });

  // A fresh session id owns no state — the decision table's "new id on clear"
  // row. The branch still runs (it costs one comparison) but it must not
  // report a clear that never happened.
  const out = buildSessionStartOutput(cwd, { source: 'clear', sessionId: 'never-seen' });

  assert.match(note(cwd), /source=clear/);
  assert.match(note(cwd), /none existed for this session id/);
  assert.doesNotMatch(note(cwd), /cleared \d+ seen file\(s\)/);
  assert.doesNotMatch(
    note(cwd), /restore snapshot for this session was removed/,
    'no snapshot was there, so nothing may claim one was removed',
  );
  assert.match(out, /Always applies\./, 'the injection itself is unaffected');
});

test('a seen file that cannot be removed is disclosed in the note and the injection still happens', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  // A directory where the seen file should be: `rmSync` without `recursive`
  // refuses it on every platform, and the code is not one of the transient
  // ones the retry budget covers, so it fails at once. (The same fixture
  // `seen-clear.test.ts` uses, and for the reasons recorded there: a
  // read-only file and a file held open are both removed happily on win32.)
  mkdirSync(seenFilePath(root(cwd), 's1'), { recursive: true });

  let out = '';
  assert.doesNotThrow(() => {
    out = buildSessionStartOutput(cwd, { source: 'clear', sessionId: 's1' });
  });

  assert.match(out, /Always applies\./, 'a failed delete must never cost the injection');
  assert.match(note(cwd), /could not be removed/);
  assert.match(note(cwd), /items already delivered may be suppressed/);
  assert.match(out, /could not be removed/, 'the model reads the same disclosure');
});

test('startup and resume are unchanged — no clear, no note', (t) => {
  for (const source of ['startup', 'resume']) {
    const cwd = sandbox(t);
    addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
    appendSeen(root(cwd), 's1', [{ id: 'CONST-old', tier: 'jit', at: 'T0' }]);
    writeSnapshot(root(cwd), 's1', ['CONST-pinned']);

    buildSessionStartOutput(cwd, { source, sessionId: 's1' });

    assert.equal(
      seenIds(readSeen(root(cwd), 's1')).includes('CONST-old'), true,
      `${source} must not touch the seen file`,
    );
    assert.equal(existsSync(snapshotPath(root(cwd), 's1')), true, `${source} must not touch the snapshot`);
    assert.equal(note(cwd), `source=${source}`, `${source} gained a clear note it has no business carrying`);
  }
});

test('compact is unchanged — the restore still fires', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-snap', { body: 'Snapshotted body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-snap']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });

  assert.match(out, /Snapshotted body\./, 'the compaction restore stopped firing');
  assert.equal(existsSync(snapshotPath(root(cwd), 's1')), true);
  assert.equal(note(cwd, 'compact-restore'), 'source=compact');
});

test('a manual load never clears anything, whatever source it is handed', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  appendSeen(root(cwd), 's1', [{ id: 'CONST-old', tier: 'jit', at: 'T0' }]);
  writeSnapshot(root(cwd), 's1', ['CONST-pinned']);

  // `/LoadMyContext` cannot carry a trustworthy session id and drops the one
  // it is given (`const sessionId = manual ? undefined : options.sessionId;`).
  // A clear that ran off `source` alone would wipe a live session's state
  // from an MCP tool call.
  const out = buildInjection(cwd, { event: 'manual', source: 'clear', sessionId: 's1' });

  assert.match(out, /Always applies\./);
  assert.equal(seenIds(readSeen(root(cwd), 's1')).includes('CONST-old'), true);
  assert.equal(existsSync(snapshotPath(root(cwd), 's1')), true);
  assert.doesNotMatch(note(cwd, 'manual'), /cleared/);
});

test("a stray source=clear on a subagent leaves the parent's state alone", (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  appendSeen(root(cwd), 's1', [{ id: 'CONST-old', tier: 'jit', at: 'T0' }]);
  writeSnapshot(root(cwd), 's1', ['CONST-pinned']);

  // A SubagentStart payload carries no `source`, and a subagent shares its
  // parent's `session_id` — so a clear that ran on this event would destroy a
  // LIVE window's dedupe state from a child that has no standing to say the
  // window is gone. Same ordering discipline as the `compacting` branch,
  // which `'subagent'` is already tested ahead of.
  buildInjection(cwd, {
    event: 'subagent', source: 'clear', sessionId: 's1', dedupeKey: 's1::a1', agentId: 'a1',
  });

  assert.equal(seenIds(readSeen(root(cwd), 's1')).includes('CONST-old'), true);
  assert.equal(existsSync(snapshotPath(root(cwd), 's1')), true);
  assert.doesNotMatch(note(cwd, 'subagent-start'), /cleared/);
});
