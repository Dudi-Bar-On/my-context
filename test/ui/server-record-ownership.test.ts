// @basis TASK-an-exiting-server-deletes-the-liveness-record-without,
// TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement,
// REQ-the-ui-server-is-running-whenever-the-owner-looks-or-it-says,
// RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
/**
 * **A server's exit may only take back ITS OWN liveness record.**
 *
 * ── THE MEASUREMENT THIS FILE IS THE PROOF OF, 2026-09-12 ──────────────────
 *
 * The owner reported his UI server going down "again and again and again". It
 * was not down. It was listening on 58888 and answering 200, and
 * `~/.my-context/ui-server.json` — the one file that says WHERE a server is —
 * was absent. The product had already diagnosed itself in its own words:
 * *"nothing else can find this server, so the upkeep hook will not put it back
 * after it exits."* At 12:21:44Z it exited, and nothing put it back.
 *
 * The line was `server.once('close', () => { clearUiServerRecord(); })` in
 * `src/ui/server.ts`. The record is ONE file per user, so an exiting server
 * removed whatever was there — including the record a NEWER server had written
 * while the old one was still winding down. `test/ui/server-record.test.ts`
 * proves the record is written and taken back; **it starts one server at a
 * time, so it could never see this.** This file starts two.
 *
 * ── WHY THE PORT AND NOT ONLY THE PID ─────────────────────────────────────
 *
 * A pid is recycled, so `pid` alone can be "confirmed" by whatever the OS
 * handed that number to next. And in this very file `pid` is no help at all:
 * two servers started in ONE test process share it, which is also the normal
 * state of a `npm test` run and of a lane. The bound port is what tells them
 * apart, and `UiServerIdentity` requires both for those two reasons together.
 *
 * ── WHICH CALLERS CLEAR ON PURPOSE, AND WHICH CLEARED BY ACCIDENT ─────────
 *
 * There are exactly two callers in `src/`, and the item asked for a verdict on
 * each rather than an assumption:
 *
 *   - `src/core/ui-server-probe.ts` (twice, on the dead-pid and dead-port
 *     branches) clears **on purpose** and is correct: it removes a claim it has
 *     just MEASURED to be false, which is the reason the record is called a
 *     hint. It keeps working — the last test below is the proof — and it now
 *     passes the identity it disproved, so a replacement that starts during its
 *     up-to-250ms connect keeps its record.
 *   - `src/ui/server.ts`'s `close` listener cleared **by accident**: it wanted
 *     "take back my record" and called "remove the record". That is the defect,
 *     and the two-server test below is the assertion that it cannot recur.
 *
 * (`test/core/ui-server-record.test.ts` and this file are the only other
 * callers in the tree; both are tests and both name the identity they mean.)
 *
 * ── THE REAL 58888 IS NEVER TOUCHED ───────────────────────────────────────
 *
 * Every server here binds through `startSafeUiServer` on port 0, and
 * `MYCONTEXT_UI_SESSIONS_DIR` is pinned to a temporary root for the whole file
 * and restored after it — so the record these tests write, overwrite and remove
 * is never the owner's. `test/core/real-home-guard.test.ts` exists because a
 * fixture once reached a real home and reddened 134 unrelated tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  clearUiServerRecord, readUiServerRecord, uiServerRecordPath, writeUiServerRecord,
  type UiServerRecord,
} from '../../src/core/ui-server-record.ts';
import { probeUiServer } from '../../src/core/ui-server-probe.ts';
import type { RunningUiServer } from '../../src/ui/server.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';

/** A workspace, the spelling `test/ui/server-record.test.ts` uses. */
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-own-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

/**
 * ONE global root for the whole case, and both servers write into it.
 *
 * `server-record.test.ts` gives every start a root of its own precisely so two
 * servers cannot see each other's record. That is right for what it proves and
 * wrong for what this file proves: the defect only exists because production
 * has ONE record for ONE machine, so the proof has to put both servers in it.
 *
 * The previous value is restored, because a stray `MYCONTEXT_UI_SESSIONS_DIR`
 * pointing at a removed directory would follow the rest of the run.
 */
async function inOneRoot(body: (root: string) => Promise<void>): Promise<void> {
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-oneroot-'));
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = root;
  try {
    await body(root);
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
    removeTree(root);
  }
}

/**
 * A server on a safe port with a long idle window.
 *
 * A minute is long enough that no case here can reach the idle exit and short
 * enough that a leaked server dies rather than holding `node --test`'s loop
 * open for the life of the run.
 */
function start(cwd: string): Promise<RunningUiServer> {
  return startSafeUiServer({ cwd, port: 0, idleMs: 60_000 });
}

/** Close whatever is still up, in reverse order, whatever the case did. */
async function closeAll(servers: RunningUiServer[]): Promise<void> {
  for (const server of servers.reverse()) {
    // `close()` destroys open connections first; an unread keep-alive socket
    // otherwise makes `server.close()` wait forever and a red test becomes a
    // hang. Nothing here opens one, and this is the belt for the day one does.
    try { await server.close(); } catch { /* already down */ }
  }
}

test('a second server`s exit cannot erase a live one`s record', async () => {
  await inOneRoot(async (root) => {
    const cwd = project();
    const first = await start(cwd);
    const second = await start(cwd);
    try {
      // The two servers must actually differ, or every assertion below is
      // satisfiable by a guard that compares nothing. They share a pid — one
      // process — so the port is the whole of the distinction.
      assert.notEqual(first.port, second.port,
        'both servers bound the same port, so this case cannot distinguish them');

      // The second server wrote its own record over the first's. That is the
      // normal, correct state: one file per machine, last writer names itself.
      assert.equal(readUiServerRecord(root)?.port, second.port,
        'the second server did not take over the record, so the case that follows is not set up');

      // ── THE HEADLINE ───────────────────────────────────────────────────
      // The FIRST server exits. The second is listening, serving, and its
      // record must survive — this is the exact sequence that left the owner's
      // server invisible on 2026-09-12.
      await first.close();

      assert.equal(existsSync(uiServerRecordPath(root)), true,
        'the exiting server deleted the record of a server that is still listening: nothing can '
        + 'find that server now, and the upkeep hook will not put it back when it does exit');
      assert.equal(readUiServerRecord(root)?.port, second.port,
        'the record no longer names the live server — it was erased or rewritten by the one that '
        + 'exited, which is the defect this file exists for');

      // …and the guard has not simply frozen the file: the server that DOES
      // own the record still takes it back on its way out.
      await second.close();
      assert.equal(readUiServerRecord(root), null,
        'the owning server failed to take its own record back, so every exit now leaks a stale '
        + 'claim — the opposite failure, bought with the fix for this one');
    } finally {
      await closeAll([first, second]);
      removeTree(cwd);
    }
  });
});

/**
 * The unit form of the same guard, one refused case per reason.
 *
 * The two-server test above rests on exactly one of these — same pid, different
 * port — because two servers in one process cannot differ any other way. The
 * recycled-pid case is the one production has and a test process cannot stage,
 * so it is asserted here directly rather than left to an integration nobody can
 * write.
 */
const RECORD: UiServerRecord = {
  version: 1, pid: 4242, host: '127.0.0.1', port: 58888,
  url: 'http://127.0.0.1:58888/', startedAt: 1_789_000_000_000, workspace: 'D:\\repo',
};

function withRecord(body: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-owncl-'));
  try {
    writeUiServerRecord(RECORD, root);
    body(root);
  } finally {
    removeTree(root);
  }
}

test('the removal refuses a record that names a different port — the same-process case', () => {
  withRecord((root) => {
    assert.equal(clearUiServerRecord({ pid: RECORD.pid, port: RECORD.port + 1 }, root),
      'names-another-server');
    assert.equal(existsSync(uiServerRecordPath(root)), true,
      'a server with the same pid and a different port removed another server`s record');
  });
});

test('the removal refuses a record that names a different pid — the recycled-pid case', () => {
  withRecord((root) => {
    assert.equal(clearUiServerRecord({ pid: RECORD.pid + 1, port: RECORD.port }, root),
      'names-another-server');
    assert.equal(existsSync(uiServerRecordPath(root)), true,
      'a process that inherited a recycled pid removed the record of the server on that port');
  });
});

test('the removal fires when both halves match, and says so', () => {
  withRecord((root) => {
    assert.equal(clearUiServerRecord({ pid: RECORD.pid, port: RECORD.port }, root), 'removed');
    assert.equal(existsSync(uiServerRecordPath(root)), false,
      'the owning server could not take its own record back');
  });
});

test('an unreadable record is removed by nobody, and that is not an error', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-ownnil-'));
  try {
    // No file at all. `readUiServerRecord` answers `null` here and for a file
    // that does not parse, and neither can be shown to name the caller — so
    // nothing is removed and nothing throws. The upkeep's next spawn overwrites
    // it, which is why refusing costs nothing.
    assert.equal(clearUiServerRecord({ pid: process.pid, port: 1 }, root), 'no-record');
  } finally {
    removeTree(root);
  }
});

test('the probe still clears a record it has just disproved — the on-purpose caller', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-ownprobe-'));
  try {
    // A pid that cannot be alive: `process.kill(pid, 0)` fails with ESRCH, the
    // probe's step 2, and the record is a claim it has measured to be false.
    // This is the caller the item names as CORRECT, and the guard must not have
    // turned it into a no-op — which is the way this fix would fail silently.
    writeUiServerRecord({ ...RECORD, pid: 0x7fff_fffe }, root);
    const liveness = await probeUiServer(root, 50);
    assert.equal(liveness.state, 'dead',
      'the probe did not disprove a record naming a pid that cannot exist');
    assert.equal(existsSync(uiServerRecordPath(root)), false,
      'the probe left behind a record it had just proved false: the guard was applied to the '
      + 'caller that clears ON PURPOSE, and every stale record now survives forever');
  } finally {
    removeTree(root);
  }
});
