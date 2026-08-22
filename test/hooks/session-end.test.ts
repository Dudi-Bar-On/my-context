/**
 * **The state `/clear` orphaned, and the event that can finally reach it.**
 *
 * `test/hooks/session-start-clear.test.ts` asserts what the `SessionStart`
 * clear branch does with the id it is handed. What it could never assert is
 * that the branch reaches the state the user actually destroyed, because it
 * does not: `/clear` mints a NEW `session_id` and the `SessionStart` payload
 * carries only that one. The order — `SessionEnd(reason: clear)` on the OLD
 * id, then `SessionStart(source: clear)` on a NEW one — is measured in
 * `reports/probes/2026-08-20-clear-and-prompt-hooks.md`, and it makes this
 * event the only firing that can name the destroyed window.
 *
 * So the first test below is the one the whole hook exists for, and it is
 * written as the two-session sequence rather than as a single call: the old
 * session's files are created under its id, the clear is delivered under its
 * id, and the new session's id is never mentioned. That is the production
 * shape, and asserting it any other way would assert the handler rather than
 * the fix.
 *
 * The rest are the other four reasons, and they carry as much weight. Four of
 * the five `reason` values are sessions whose id OUTLIVES the event — a
 * `--resume` reuses it — so clearing on them would cost a resumed window a
 * full re-delivery and, worse, take its restore snapshot with it, leaving a
 * compaction after the resume with nothing to restore. A hook that deleted on
 * all five would pass the first test and be a defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { snapshotPath, writeSnapshot } from '../../src/core/ledger.ts';
import { appendSeen, seenFilePath } from '../../src/core/seen-file.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildSessionEndOutcome } from '../../src/hooks/session-end.ts';
import { removeTree } from '../helpers/tmp.ts';

const OLD = '6eb9731c-811d-495e-8009-e1aa81ef3f42';
/** Any stamp: nothing here reads it back, and a fixed one keeps the fixture deterministic. */
const SEEN_AT = '2026-08-22T07:06:33.112Z';

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-session-end-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

/**
 * A window that has been used: the parent's seen file, one subagent sibling,
 * and the restore snapshot a PreCompact would have left. All three are what
 * `/clear` destroys and all three used to survive it.
 */
function usedWindow(cwd: string, sessionId: string): void {
  const r = root(cwd);
  appendSeen(r, sessionId, [{ id: 'CONST-pool', tier: 'pinned', at: SEEN_AT }]);
  appendSeen(r, `${sessionId}::agent-7`, [{ id: 'CONST-pool', tier: 'pinned', at: SEEN_AT }]);
  writeSnapshot(r, sessionId, ['CONST-pool']);
}

function windowFiles(cwd: string, sessionId: string): { seen: boolean; sib: boolean; snap: boolean } {
  const r = root(cwd);
  return {
    seen: existsSync(seenFilePath(r, sessionId)),
    sib: existsSync(seenFilePath(r, `${sessionId}::agent-7`)),
    snap: existsSync(snapshotPath(r, sessionId)),
  };
}

function endPayload(cwd: string, sessionId: string, reason: string) {
  return { hook_event_name: 'SessionEnd', session_id: sessionId, cwd, reason };
}

function sessionEndRows(cwd: string): AuditRecord[] {
  return readAudit(root(cwd)).filter((r) => r.op === 'session-end');
}

test('a clear removes the OLD window\'s seen files and snapshot, named by the old id', (t) => {
  const cwd = sandbox(t);
  usedWindow(cwd, OLD);
  assert.deepEqual(
    windowFiles(cwd, OLD), { seen: true, sib: true, snap: true },
    'the fixture did not create the state this test is about',
  );

  const outcome = buildSessionEndOutcome(endPayload(cwd, OLD, 'clear'), cwd);

  assert.equal(outcome.action, 'cleared');
  assert.deepEqual(
    windowFiles(cwd, OLD), { seen: false, sib: false, snap: false },
    'the destroyed window\'s state survived the one event that carries its id',
  );
  // The sentence names what went, and it is `clearWindowState`'s, not a second
  // spelling: "cleared 2 seen file(s)" is the parent plus its subagent sibling.
  assert.match(outcome.note, /cleared 2 seen file\(s\)/);
  assert.match(outcome.note, /restore snapshot for this session was removed too/);
});

/**
 * The record is the whole disclosure. Claude Code copies a `SessionEnd` hook's
 * output to the user only when the hook FAILS, and `INV-hooks-fail-open`
 * requires this one to exit 0 — so a deletion that wrote no row would be a
 * deletion nothing anywhere could ever name.
 */
test('the clear writes one session-end record naming the reason and what went', (t) => {
  const cwd = sandbox(t);
  usedWindow(cwd, OLD);
  buildSessionEndOutcome(endPayload(cwd, OLD, 'clear'), cwd);

  const rows = sessionEndRows(cwd);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'hook');
  assert.equal(rows[0].hook, 'SessionEnd');
  assert.equal(rows[0].sessionId, OLD);
  assert.match(rows[0].note ?? '', /^reason=clear; cleared 2 seen file\(s\)/);
  // Scope, never content: no item text, no path, no payload.
  assert.equal(rows[0].injected, undefined);
});

/**
 * `describeClearSeen` distinguishes "cleared nothing" from "cleared", and this
 * hook must carry that distinction rather than claim a clear it did not
 * perform. A session that ended without ever being injected into is the
 * ordinary case of it.
 */
test('a clear on a window that owns nothing says so instead of claiming a clear', (t) => {
  const cwd = sandbox(t);
  const outcome = buildSessionEndOutcome(endPayload(cwd, 'never-used', 'clear'), cwd);
  assert.equal(outcome.action, 'cleared');
  assert.match(outcome.note, /cleared no seen file \(none existed for this session id\)/);
  assert.match(outcome.note, /no restore snapshot was there to remove/);
  assert.match(sessionEndRows(cwd)[0].note ?? '', /cleared no seen file/);
});

/**
 * The four that must not delete. Each one is a session whose transcript and id
 * survive the event, so its dedupe state is the state of a window that is
 * coming back — and its snapshot is what a compaction after the resume
 * restores from.
 */
for (const reason of ['resume', 'logout', 'prompt_input_exit', 'other']) {
  test(`reason '${reason}' keeps the window's state, because its id survives`, (t) => {
    const cwd = sandbox(t);
    usedWindow(cwd, OLD);

    const outcome = buildSessionEndOutcome(endPayload(cwd, OLD, reason), cwd);

    assert.equal(outcome.action, 'retained');
    assert.deepEqual(
      windowFiles(cwd, OLD), { seen: true, sib: true, snap: true },
      `reason '${reason}' deleted state a later --resume of this id needs`,
    );
    assert.match(outcome.note, /survive|left for another one/);
    // No record: nothing was dropped, and one row per process exit would be
    // the log's largest and least informative population.
    assert.equal(sessionEndRows(cwd).length, 0);
  });
}

test('no session_id, no workspace and no payload are each a skip, not a throw', (t) => {
  const cwd = sandbox(t);
  usedWindow(cwd, OLD);

  const noId = buildSessionEndOutcome(
    { hook_event_name: 'SessionEnd', cwd, reason: 'clear' }, cwd,
  );
  assert.equal(noId.action, 'skipped');
  assert.match(noId.note, /no session_id/);

  const empty = buildSessionEndOutcome({}, cwd);
  assert.equal(empty.action, 'skipped');
  assert.match(empty.note, /no payload/);

  const elsewhere = mkdtempSync(path.join(tmpdir(), 'myctx-session-end-nowhere-'));
  t.after(() => removeTree(elsewhere));
  const noRoot = buildSessionEndOutcome(
    { hook_event_name: 'SessionEnd', session_id: OLD, cwd: elsewhere, reason: 'clear' }, elsewhere,
  );
  assert.equal(noRoot.action, 'skipped');
  assert.match(noRoot.note, /no my_context workspace/);

  // And none of the three touched the real workspace's state.
  assert.deepEqual(windowFiles(cwd, OLD), { seen: true, sib: true, snap: true });
  assert.equal(sessionEndRows(cwd).length, 0);
});

/**
 * The clear is keyed on the id in the payload and reaches nothing else. A
 * `/clear` in one terminal must not wipe the delivery state of a session
 * running in another — the seen files sit in one shared `state/` directory,
 * so this is a real adjacency and not a hypothetical one.
 */
test('the clear reaches only the window it names', (t) => {
  const cwd = sandbox(t);
  usedWindow(cwd, OLD);
  usedWindow(cwd, 'other-live-session');

  buildSessionEndOutcome(endPayload(cwd, OLD, 'clear'), cwd);

  assert.deepEqual(windowFiles(cwd, OLD), { seen: false, sib: false, snap: false });
  assert.deepEqual(
    windowFiles(cwd, 'other-live-session'), { seen: true, sib: true, snap: true },
    'a clear in one session reached another session\'s state',
  );
});
