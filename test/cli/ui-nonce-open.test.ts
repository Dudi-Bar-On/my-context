/**
 * `mycontext ui --nonce`'s open/print decision (owner ruling 2026-09-03) —
 * IN-PROCESS, unlike `test/cli/ui-nonce.test.ts`'s spawned-CLI cases.
 *
 * ── WHY IN-PROCESS RATHER THAN SPAWNED ─────────────────────────────────────
 *
 * `--nonce` now opens a real browser by default. A test that spawns the real
 * CLI and lets that happen would launch whatever browser is installed on
 * whatever machine runs this suite — not a fake to assert against, an actual
 * window. `cmdUiNonce` and `mintNonceFrom` are exported from
 * `src/cli/commands/ui.ts` for exactly this: an in-process call can inject a
 * fake `openFn` (the same seam `openBrowser` itself is tested with in
 * `test/ui/open.test.ts`), so the open/print decision and the no-browser
 * fallback are provable without a test ever touching a real opener.
 *
 * `probeUiServer` (used inside `cmdUiNonce`) reads the SAME liveness record a
 * spawned child would, so an in-process `startUiServer` — the harness
 * `test/ui/nonce-route.test.ts` already uses — is indistinguishable from a
 * server started any other way; `--nonce` cannot tell the two apart, and that
 * is the whole point of testing it this way.
 *
 * ── THE INVARIANT EVERY CASE BELOW SHARES ──────────────────────────────────
 *
 * `recordNonceMint` (`src/ui/security.ts`) writes one `nonce-minted` audit row
 * per credential coming into existence. `--nonce` must never turn one
 * invocation into two of those rows, whatever `openFn` reports back — that is
 * the regression this file exists to catch, so every case below counts them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cmdUiNonce } from '../../src/cli/commands/ui.ts';
import type { BrowserLaunch } from '../../src/ui/open.ts';
import { readAudit } from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
import { removeTree } from '../helpers/tmp.ts';
// Spawns a real UI server, which mints a session token; pins the store out of
// the developer's real `~/.my-context`. See the module.
import '../helpers/pin-sessions-dir.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-nonce-open-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture workspace failed to init');
  return dir;
}

interface Harness {
  cwd: string;
  server: RunningUiServer;
}

/** One initialised workspace, one server — torn down whatever the body does. */
async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const cwd = project();
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({ cwd, server });
  } finally {
    await server.close();
    removeTree(cwd);
  }
}

const accessRecords = (cwd: string) =>
  readAudit(path.join(cwd, '.my_context')).filter((r) => r.kind === 'access');

/** A fake `openFn`: records every URL it was called with, answers a fixed outcome. */
function fakeOpener(outcome: BrowserLaunch): { calls: string[]; fn: (url: string) => BrowserLaunch } {
  const calls: string[] = [];
  return { calls, fn: (url: string) => { calls.push(url); return outcome; } };
}

/** An `openFn` that fails the test if it is ever called — for the `--no-open` cases. */
function neverCalled(url: string): BrowserLaunch {
  assert.fail(`openFn must not be called with --no-open, but was, with ${url}`);
}

test('--nonce (no --no-open) opens the browser and does not print the URL', async () => {
  await withServer(async (h) => {
    const opener = fakeOpener({ opened: true, command: 'fake-browser', args: [] });
    const out: string[] = [];
    await cmdUiNonce(out.push.bind(out), null, false, opener.fn);

    assert.equal(opener.calls.length, 1, 'the browser must be opened exactly once');
    assert.match(opener.calls[0] ?? '',
      new RegExp(`^http://127\\.0\\.0\\.1:${h.server.port}/#[0-9a-f]{32}$`),
      'the URL handed to the opener must carry the live server\'s port and a real nonce');

    const joined = out.join('\n');
    assert.doesNotMatch(joined, /http:\/\/127\.0\.0\.1:\d+\/#[0-9a-f]{32}/,
      `the nonce URL must not be printed when the browser opened: ${joined}`);
    assert.match(joined, /opening your browser/, joined);

    assert.equal(accessRecords(h.cwd).filter((r) => r.op === 'nonce-minted').length, 1,
      'exactly one credential came into existence, and exactly one row must record it');
  });
});

test('--nonce --no-open prints the URL and never touches the opener', async () => {
  await withServer(async (h) => {
    const out: string[] = [];
    await cmdUiNonce(out.push.bind(out), null, true, neverCalled);

    const joined = out.join('\n');
    assert.match(joined, new RegExp(`http://127\\.0\\.0\\.1:${h.server.port}/#[0-9a-f]{32}`), joined);

    assert.equal(accessRecords(h.cwd).filter((r) => r.op === 'nonce-minted').length, 1,
      'printing must still mint exactly once');
  });
});

/**
 * The no-browser fallback (spec item 2 of the task this file covers): when
 * `openFn` reports it could not open anything, `--nonce` must still hand the
 * reader a usable URL — the fallback IS the remedy, not a dead end — and it
 * must not have minted a SECOND credential to produce it. The nonce already
 * minted for the (failed) open attempt is the one that gets printed.
 */
test('the no-browser fallback prints the URL it already minted, and mints only once', async () => {
  await withServer(async (h) => {
    const opener = fakeOpener({ opened: false, reason: 'no browser opener on this machine' });
    const out: string[] = [];
    await cmdUiNonce(out.push.bind(out), null, false, opener.fn);

    assert.equal(opener.calls.length, 1, 'the open attempt must still happen exactly once');
    const openedUrl = opener.calls[0] ?? '';
    assert.match(openedUrl, /^http:\/\/127\.0\.0\.1:\d+\/#[0-9a-f]{32}$/);

    const joined = out.join('\n');
    assert.ok(joined.includes(openedUrl),
      `the fallback must print the SAME url the opener was given, not mint a second one: ${joined}`);
    assert.match(joined, /no browser opener on this machine/, 'the reason must be named, not swallowed');
    assert.match(joined, /--no-open/,
      'the fallback must point the reader at the longer-lived, human-carried variant');

    assert.equal(accessRecords(h.cwd).filter((r) => r.op === 'nonce-minted').length, 1,
      'a failed open must not cost a second nonce-minted row — the SAME credential is reused');
  });
});

test('exit code stays 0 whether the browser opened or the fallback fired — a working session either way', async () => {
  await withServer(async (h) => {
    void h;
    const savedExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      await cmdUiNonce(() => {}, null, false, () => ({ opened: true, command: 'x', args: [] }));
      assert.equal(process.exitCode, undefined, 'a successful open must not set an exit code');
      await cmdUiNonce(() => {}, null, false, () => ({ opened: false, reason: 'no opener' }));
      assert.equal(process.exitCode, undefined, 'the printed fallback is still a working session, not a failure');
    } finally {
      process.exitCode = savedExitCode;
    }
  });
});
