// @basis TASK-any-throwaway-server-takes-the-owner-s-ui-record-and-deletes,
// KNOWN-ui-nonce-hands-you-a-credential-for-whichever-server-it,
// TASK-an-exiting-server-deletes-the-liveness-record-without,
// REQ-the-ui-server-is-running-whenever-the-owner-looks-or-it-says,
// RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
/**
 * **A server may not write itself into the liveness record over a server that
 * is still answering — and MUST still write itself over one that is not.**
 *
 * ── THE MEASUREMENT, 2026-09-17, TWICE IN ONE DAY ─────────────────────────
 *
 * `~/.my-context/ui-server.json` is ONE file per user. Until `claimUiServerRecord`
 * it was written unconditionally at every start. A lane started a throwaway
 * server on 58991; that write took the record from the owner's server on 58888.
 * Both consequences were observed rather than argued:
 *
 *   - while the lane ran, `mycontext ui --nonce` handed out a credential for
 *     the LANE's server. It worked, it opened a real server on the same corpus,
 *     and it looked correct — which is worse than an error;
 *   - when the lane exited it took the record with it. By then the record was
 *     genuinely its own, so `clearUiServerRecord`'s 2026-09-12 ownership guard
 *     had nothing to refuse. The owner's server was left answering HTTP 200 and
 *     undiscoverable, and the upkeep hook had nothing to put back.
 *
 * **So the theft was the WRITE, and this file is the proof of the write.**
 * `test/ui/server-record-ownership.test.ts` is the proof of the removal and
 * still holds; the two together are the whole of "a process does not take a
 * record it did not write".
 *
 * ── WHY THE FIRST TEST IS THE ONE WHERE REFUSING WOULD BE WRONG ───────────
 *
 * A protection that cannot tell dead from alive has not fixed this defect, it
 * has swapped it for a slower one: a server killed with the machine leaves a
 * perfectly readable record behind, and if a record's mere presence were enough
 * to refuse, that one crash would lock the file for the life of the home
 * directory and no server could ever record itself again. The crashed-server
 * case is therefore asserted FIRST, before anything asserts a refusal.
 *
 * The same argument has a second, sharper form that a naive fix also breaks and
 * that production actually runs: `ui-server-upkeep.ts` replaces a stale-code
 * server by stopping it and starting a replacement ON THE SAME CONFIGURED PORT.
 * The replacement meets the stopped server's record with its own socket already
 * bound — so a guard that probed that port would be answered BY THE CLAIMANT
 * ITSELF and would refuse. Every upkeep restart would silently stop being
 * recorded. That is the third test, and it stages a real listener on the port
 * to make the probe answer if one is performed.
 *
 * ── THE REAL 58888 IS NEVER TOUCHED ───────────────────────────────────────
 *
 * Every server here binds through `startSafeUiServer` on port 0, and
 * `MYCONTEXT_UI_SESSIONS_DIR` is pinned to a temporary root — which is the very
 * mechanism this item asks to be documented, used here rather than described.
 * Testing this defect by reproducing it on the owner's machine would be the
 * defect. `test/core/real-home-guard.test.ts` exists because a fixture once
 * reached a real home and reddened 134 unrelated tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  readUiServerRecord, uiServerRecordPath, writeUiServerRecord, type UiServerRecord,
} from '../../src/core/ui-server-record.ts';
import { claimUiServerRecord } from '../../src/core/ui-server-probe.ts';
import { refusedClaimLine, type RunningUiServer } from '../../src/ui/server.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';

/** The incumbent every unit case starts from: a plausible, perfectly readable record. */
const INCUMBENT: UiServerRecord = {
  version: 1, pid: 4242, host: '127.0.0.1', port: 58888,
  url: 'http://127.0.0.1:58888/', startedAt: 1_789_000_000_000, workspace: 'D:\\owner-repo',
};

/** A claimant, distinguishable from `INCUMBENT` in both halves of the identity. */
function claimant(port: number): UiServerRecord {
  return {
    version: 1, pid: process.pid, host: '127.0.0.1', port,
    url: `http://127.0.0.1:${port}/`, startedAt: 1_789_000_001_000, workspace: 'D:\\lane-repo',
  };
}

/** A real listening socket on an ephemeral port — the shape `ui-server-probe.test.ts` uses. */
async function listening(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}

/** A port nothing is listening on: bind one, read it back, then give it up. */
async function closedPort(): Promise<number> {
  const open = await listening();
  const { port } = open;
  await open.close();
  return port;
}

async function withRoot(body: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-claim-'));
  try {
    await body(root);
  } finally {
    removeTree(root);
  }
}

// ── 1. THE CASE WHERE REFUSING WOULD BE WRONG ──────────────────────────────

test('a record naming a port NOTHING answers on is replaced — a crash must not lock the file', async () => {
  await withRoot(async (root) => {
    // The record is whole, current-version and reads perfectly. The only thing
    // wrong with it is the thing a file cannot say: its server is gone.
    const dead = await closedPort();
    writeUiServerRecord({ ...INCUMBENT, port: dead, url: `http://127.0.0.1:${dead}/` }, root);

    const mine = claimant(await closedPort());
    const outcome = await claimUiServerRecord(mine, root, 50);

    assert.equal(outcome.state, 'claimed',
      'a record left behind by a crashed server was treated as an incumbent: one crash now '
      + 'locks ~/.my-context/ui-server.json forever and no server can ever record itself again '
      + '— the opposite outage, bought with the fix for this one');
    assert.deepEqual(readUiServerRecord(root), mine,
      'the claim reported success without writing the record');
  });
});

// ── 2. THE THEFT ITSELF ────────────────────────────────────────────────────

test('a record naming a port that ANSWERS is not replaced, and is not removed either', async () => {
  await withRoot(async (root) => {
    const owner = await listening();
    try {
      writeUiServerRecord(
        { ...INCUMBENT, port: owner.port, url: `http://127.0.0.1:${owner.port}/` }, root);
      const before = readFileSync(uiServerRecordPath(root), 'utf8');

      const outcome = await claimUiServerRecord(claimant(await closedPort()), root, 250);

      assert.equal(outcome.state, 'refused',
        'a throwaway server took the record of a server that answered when connected to — this '
        + 'is 2026-09-17 exactly: `mycontext ui --nonce` now answers for the wrong server, and '
        + 'the owner`s live one is undiscoverable');
      assert.equal(readFileSync(uiServerRecordPath(root), 'utf8'), before,
        'the refusal still touched the file — a refusal that rewrites anything is not a refusal');
      assert.equal(readUiServerRecord(root)?.port, owner.port,
        'the record no longer names the server that is answering');
      // The incumbent is carried back, because the caller`s only useful answer
      // is a sentence naming WHO holds the record. "Somebody else" leaves the
      // reader with the missing fact that made this defect invisible.
      if (outcome.state === 'refused') {
        assert.equal(outcome.incumbent.port, owner.port);
        assert.equal(outcome.incumbent.workspace, INCUMBENT.workspace);
      }
    } finally {
      await owner.close();
    }
  });
});

// ── 3. THE CASE A NAIVE FIX BREAKS, AND PRODUCTION RUNS EVERY RESTART ──────

test('a record naming the claimant`s OWN port is replaced, even with something listening there', async () => {
  await withRoot(async (root) => {
    // `ui-server-upkeep.ts` stops a stale server and starts a replacement on the
    // SAME configured port. By the time the replacement claims, it holds that
    // socket — so a probe aimed at the record`s port is answered by the
    // claimant itself. The listener below IS that claimant`s socket for the
    // purposes of this test: if the guard probes, it will get an answer.
    const mine = await listening();
    try {
      writeUiServerRecord(
        { ...INCUMBENT, port: mine.port, url: `http://127.0.0.1:${mine.port}/` }, root);

      const replacement = claimant(mine.port);
      const outcome = await claimUiServerRecord(replacement, root, 250);

      assert.equal(outcome.state, 'claimed',
        'the replacement was refused by a probe answered by its own socket: every upkeep '
        + 'restart now silently stops being recorded, which is the outage this guard exists '
        + 'to prevent, caused by the guard');
      assert.equal(readUiServerRecord(root)?.pid, replacement.pid,
        'the record still names the server that was stopped');
    } finally {
      await mine.close();
    }
  });
});

test('no record at all is claimed without a probe and without an error', async () => {
  await withRoot(async (root) => {
    const mine = claimant(await closedPort());
    assert.deepEqual(await claimUiServerRecord(mine, root, 50), { state: 'claimed' });
    assert.deepEqual(readUiServerRecord(root), mine);
  });
});

test('an UNREADABLE record is claimed — it cannot be shown to name a server worth keeping', async () => {
  await withRoot(async (root) => {
    // `readUiServerRecord` degrades a file it cannot fully understand to `null`,
    // deliberately, so nothing downstream ever sees a half-trusted record. A
    // record with no address in it is not an address to protect, and refusing
    // for one would be refusing on the strength of bytes nobody could parse.
    writeUiServerRecord({ ...INCUMBENT, port: 58888 }, root);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(uiServerRecordPath(root), '{ not json', 'utf8');

    const mine = claimant(await closedPort());
    assert.equal((await claimUiServerRecord(mine, root, 50)).state, 'claimed');
    assert.deepEqual(readUiServerRecord(root), mine);
  });
});

// ── 4. THE SAME THING WITH TWO REAL SERVERS ────────────────────────────────

/**
 * ONE global root, and both servers write into it — `server-record-ownership.test.ts`
 * argues why: the defect only exists because production has one record for one
 * machine, so the proof has to put both servers in it.
 */
async function inOneRoot(body: (root: string) => Promise<void>): Promise<void> {
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-claim2-'));
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = root;
  try {
    await body(root);
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
    removeTree(root);
  }
}

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-claimws-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

async function closeAll(servers: RunningUiServer[]): Promise<void> {
  for (const server of servers.reverse()) {
    try { await server.close(); } catch { /* already down */ }
  }
}

test('a second server does not take a live first server`s record, and its exit leaves it alone', async () => {
  await inOneRoot(async (root) => {
    const cwd = project();
    const notices: string[] = [];
    const first = await startSafeUiServer({ cwd, port: 0, idleMs: 60_000 });
    const second = await startSafeUiServer({
      cwd,
      port: 0,
      idleMs: 60_000,
      onSessionStoreIssue: (message) => { notices.push(message); },
    });
    try {
      // The two must actually differ or every assertion below is satisfiable by
      // a guard that compares nothing. They share a pid — one process — so the
      // bound port is the whole of the distinction, which is also the normal
      // state of a lane and of a full `npm test` run.
      assert.notEqual(first.port, second.port,
        'both servers bound the same port, so this case cannot distinguish them');

      // ── THE HEADLINE ──────────────────────────────────────────────────
      // 2026-09-17 in miniature: the first server is the owner`s on 58888 and
      // the second is the lane`s throwaway on 58991.
      assert.equal(readUiServerRecord(root)?.port, first.port,
        'the second server took the record from a server that was listening and answering — '
        + '`mycontext ui --nonce` now mints a credential for the throwaway, on the same corpus, '
        + 'and looks entirely correct doing it');

      // And it SAID so. A silent refusal leaves the same person with the same
      // wrong model of which server is theirs, which is how this ran twice in
      // one day without anyone noticing.
      const refusal = notices.find((line) => line.includes('did NOT write'));
      assert.ok(refusal !== undefined,
        `the refused server said nothing about it; it emitted ${JSON.stringify(notices)}`);
      assert.match(refusal, /MYCONTEXT_UI_SESSIONS_DIR/,
        'the refusal does not name the supported way to run a throwaway server beside the '
        + 'owner`s, so the next lane meets the same wall with no way through it');
      assert.ok(refusal.includes(String(first.port)),
        'the refusal does not say which server holds the record');

      // ── AND THE EXIT TAKES NOTHING WITH IT ────────────────────────────
      // The lane`s server goes away. On 2026-09-17 this is the step that left
      // NO record at all, because by then the record was the lane`s own.
      await second.close();
      assert.equal(existsSync(uiServerRecordPath(root)), true,
        'the exiting second server removed the record entirely: the first server is still '
        + 'answering HTTP 200 and is now undiscoverable, and the upkeep hook has nothing to '
        + 'put back — this is the exact end state the owner hit twice');
      assert.equal(readUiServerRecord(root)?.port, first.port,
        'the record stopped naming the live server when the second one exited');

      // …and the guard has not simply frozen the file: the server that DOES own
      // the record still takes it back on its way out.
      await first.close();
      assert.equal(readUiServerRecord(root), null,
        'the owning server failed to take its own record back, so every exit now leaks a stale '
        + 'claim — the opposite failure, bought with the fix for this one');
    } finally {
      await closeAll([first, second]);
      removeTree(cwd);
    }
  });
});

test('a server started after the record`s owner has gone DOES record itself', async () => {
  // The two-server case above proves the refusal. This proves the refusal is
  // not the only answer the mechanism can give — the same pair of servers, one
  // after the other rather than at once, and the record must follow.
  await inOneRoot(async (root) => {
    const cwd = project();
    const first = await startSafeUiServer({ cwd, port: 0, idleMs: 60_000 });
    const firstPort = first.port;
    await first.close();
    // Its own exit took its own record, so re-stage the stale claim a CRASH
    // would have left: same address, no server behind it.
    writeUiServerRecord({
      version: 1, pid: process.pid, host: '127.0.0.1', port: firstPort,
      url: `http://127.0.0.1:${firstPort}/`, startedAt: Date.now(), workspace: cwd,
    }, root);

    const second = await startSafeUiServer({ cwd, port: 0, idleMs: 60_000 });
    try {
      assert.equal(readUiServerRecord(root)?.port, second.port,
        'a live server could not record itself because a dead one had left a file behind: '
        + 'nothing can find the only server that is actually running');
    } finally {
      await closeAll([second]);
      removeTree(cwd);
    }
  });
});

test('the refusal sentence names the file, the holder, and the sandbox', () => {
  // Read without staging two servers, the habit `startedLines` set: the
  // sentence is the whole product of a refusal, so it is asserted directly
  // rather than through a server that has to be arranged to refuse.
  const line = refusedClaimLine(INCUMBENT);
  assert.ok(line.includes(uiServerRecordPath()), 'the reader is not told which file');
  assert.ok(line.includes('58888') && line.includes('4242'),
    'the reader is not told which server holds it');
  assert.ok(line.includes(INCUMBENT.workspace), 'the reader is not told what that server serves');
  assert.match(line, /MYCONTEXT_UI_SESSIONS_DIR/,
    'the one sentence a lane needs — how to run a server without competing for the shared '
    + 'record — is the one the refusal does not say');
  assert.match(line, /--nonce/,
    'the refusal does not say that `mycontext ui --nonce` will keep answering for the other '
    + 'server, which is the consequence the reader will meet next');
});
