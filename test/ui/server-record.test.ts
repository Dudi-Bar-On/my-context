/**
 * The liveness record `startUiServer` writes on listen and takes back on exit.
 *
 * Spec: `docs/superpowers/specs/2026-08-27-the-ui-server-outlives-the-session-design.md`
 * §3. Plan: `docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md`
 * Task 2. `test/core/ui-server-record.test.ts` proves the FILE; this proves the
 * SERVER's use of it, which is a different set of claims:
 *
 *   - the recorded port is the one the socket is actually bound to,
 *   - every exit route takes the record back, the idle one included,
 *   - and a record that cannot be written costs the record, never the server.
 *
 * ── THE ASSERTION THIS FILE EXISTS FOR ─────────────────────────────────────
 *
 * `port` is `0` by default and `0` means "ask the OS for a free one". A record
 * that copied the REQUESTED port would therefore say `0` on almost every real
 * start, and every probe built on it would connect to the wrong place forever —
 * silently, because a record that parses looks exactly like a record that is
 * right. So the port is asserted against `server.port`, which is read back from
 * `server.address()`, and asserted to be something other than `0` besides. One
 * of those two alone is not enough: `notEqual(0)` alone passes for any wrong
 * non-zero port, and comparing to `server.port` alone would pass if BOTH came
 * from the requested value.
 *
 * ── WHY EVERY TEST PINS THE GLOBAL DIRECTORY ───────────────────────────────
 *
 * `ui-server-record.ts` defaults to `GLOBAL_DIR` — the developer's real
 * `~/.my-context` — and `startUiServer` passes no root, so nothing but the
 * environment stands between this file and the owner's home. It honours
 * `MYCONTEXT_UI_SESSIONS_DIR` (deliberately the same variable `ui-sessions.ts`
 * reads, so one pin covers both files), and it reads it per call, so setting it
 * here — after import, before each server starts — is enough.
 *
 * The suite's preload pins that variable for a full `npm test` run, but this
 * file must also be correct under a bare `node --test test/ui/server-record.test.ts`,
 * where no preload runs at all. So it pins its own per test rather than relying
 * on an ambient one. `test/core/real-home-guard.test.ts` is why that is not
 * belt-and-braces: on 2026-08-22 fixtures reached the real `~/.my-context` and
 * turned 134 unrelated tests red with a message pointing nowhere near the cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { readUiServerRecord } from '../../src/core/ui-server-record.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';

/** A workspace, the spelling `test/ui/server.test.ts` uses. */
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-rec-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

/**
 * A fresh global root, pinned into the environment so `startUiServer` — which
 * passes no root — writes there and nowhere near a real home.
 *
 * Set per start rather than once for the file, so that two servers in this
 * process cannot read each other's record: they share ONE record path inside a
 * given root, since the record names a machine's server rather than a
 * workspace's.
 */
function pinnedGlobalRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-glob-'));
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = root;
  return root;
}

interface Started {
  server: RunningUiServer;
  /** The workspace root — `repoRoot`, the directory holding `.my_context`. */
  cwd: string;
  globalRoot: string;
  /** Resolves when the IDLE monitor has closed the server, never on `close()`. */
  idleExit: Promise<void>;
}

/**
 * A server whose record lands in a temporary root.
 *
 * `idleMs` defaults to a minute — long enough that no test that is not ABOUT
 * the idle exit can reach it, and short enough that a leaked server dies.
 */
async function startForTest(options: { port?: number; idleMs?: number } = {}): Promise<Started> {
  const cwd = project();
  const globalRoot = pinnedGlobalRoot();
  let signalIdle: () => void = () => { /* replaced below, before any exit can fire */ };
  const idleExit = new Promise<void>((resolve) => { signalIdle = resolve; });
  const server = await startUiServer({
    cwd,
    port: options.port ?? 0,
    idleMs: options.idleMs ?? 60_000,
    onExit: (reason) => { if (reason === 'idle') signalIdle(); },
  });
  return { server, cwd, globalRoot, idleExit };
}

/** Close the server and remove both trees, whatever the test did to them. */
async function done(started: Started): Promise<void> {
  await started.server.close();
  removeTree(started.cwd);
  removeTree(started.globalRoot);
}

test('a listening server leaves a record naming its real bound port', async () => {
  const started = await startForTest();
  try {
    const record = readUiServerRecord(started.globalRoot);
    assert.notEqual(record, null, 'no record was written at all');
    assert.equal(record?.version, 1);
    assert.equal(record?.port, started.server.port);
    assert.equal(record?.pid, process.pid);
    assert.equal(record?.host, '127.0.0.1');
    assert.equal(record?.url, `http://127.0.0.1:${started.server.port}/`);
    // The repository root, not `.my_context` inside it: the record is what a
    // hook uses to decide where to re-spawn `mycontext ui`, and that is a cwd.
    assert.equal(record?.workspace, started.cwd);
    assert.ok((record?.startedAt ?? 0) > 0, 'startedAt must be a real epoch stamp');
  } finally { await done(started); }
});

test('the recorded port is the BOUND one, not the requested one', async () => {
  // `0` is the default and the whole hazard: it is a legal REQUEST and a
  // useless RECORD. Requested explicitly here so the two values are provably
  // different rather than incidentally so.
  const started = await startForTest({ port: 0 });
  try {
    const record = readUiServerRecord(started.globalRoot);
    assert.notEqual(record?.port, 0,
      'the record carries the requested port 0, so every probe built on it would connect to '
      + 'nothing — and the file would parse, so nothing downstream could tell');
    assert.equal(record?.port, started.server.port);
    assert.ok(record?.url.endsWith(`:${started.server.port}/`), record?.url);
  } finally { await done(started); }
});

test('closing takes the record back', async () => {
  const started = await startForTest();
  try {
    assert.notEqual(readUiServerRecord(started.globalRoot), null, 'nothing to take back');
    await started.server.close();
    assert.equal(readUiServerRecord(started.globalRoot), null,
      'the record outlived the server that wrote it, which is exactly the stale claim the probe '
      + 'would then have to disprove over a socket');
  } finally { await done(started); }
});

test('an idle exit takes the record back too', async () => {
  // The exit route a human never watches. It runs on the idle monitor's own
  // callback rather than on `close()`, so it is the one a per-route removal
  // could silently forget.
  const started = await startForTest({ idleMs: 30 });
  try {
    await started.idleExit;
    assert.equal(readUiServerRecord(started.globalRoot), null,
      'the idle exit left its record behind: a server that reaps itself after eight hours would '
      + 'leave a record claiming a port it stopped holding');
  } finally { await done(started); }
});

test('a record that cannot be written costs the record, never the server', async () => {
  // `writeUiServerRecord` throws by design — it returns void, so a swallowed
  // failure would be a silent drop. The server must still serve, and the
  // failure must still be said out loud.
  const cwd = project();
  const blocked = mkdtempSync(path.join(tmpdir(), 'myctx-ui-glob-'));
  const notADirectory = path.join(blocked, 'occupied');
  writeFileSync(notADirectory, 'a file standing where the global directory must be\n', 'utf8');
  // A root whose PARENT is a file: `mkdirSync(…, { recursive: true })` cannot
  // create it, so the write fails for a reason no test has to simulate.
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = path.join(notADirectory, 'inside');

  const issues: string[] = [];
  const server = await startUiServer({
    cwd, port: 0, idleMs: 60_000, onSessionStoreIssue: (message) => { issues.push(message); },
  });
  try {
    assert.equal((await fetch(`http://127.0.0.1:${server.port}/`)).status, 200,
      'the server stopped serving because it could not write a hint about itself');
    assert.ok(issues.some((message) => message.includes('ui-server.json')),
      `the failure was dropped instead of disclosed; what was said was ${JSON.stringify(issues)}`);
    // …and closing a server that never wrote a record is still clean.
    await server.close();
  } finally { await server.close(); removeTree(cwd); removeTree(blocked); }
});
