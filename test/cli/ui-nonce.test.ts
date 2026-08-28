/**
 * `mycontext ui --nonce`, spawned as the real CLI binary (owner ruling
 * 2026-08-28,
 * `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 * out-the-next-one`).
 *
 * ── WHY THIS SPAWNS THE CLI RATHER THAN CALLING `cmdUi` IN PROCESS ─────────
 *
 * Same two reasons `test/cli/ui-enabled.test.ts` gives for the same choice,
 * and both apply unchanged: `cmdUi` returns 0 before its async work settles —
 * the PROCESS carries the outcome, not the return value — and a served run
 * (the "server is live" case below) writes `ui-sessions.json` and
 * `ui-server.json` into whatever directory `MYCONTEXT_UI_SESSIONS_DIR`
 * resolves to at IMPORT time, which only a child process lets this test
 * control cleanly per case.
 *
 * ── WHY THE "SERVER IS LIVE" CASE USES `startUiChild`, NOT A SECOND CLI SPAWN ─
 *
 * `mycontext ui` (no flags) never returns — the process stays up until the
 * idle exit or a kill — so it cannot be the thing this test `await`s the way
 * `--nonce` can. `test/ui/helpers.ts`'s `startUiChild` is the existing answer
 * to "get a live server and its address without blocking": it spawns
 * `src/ui/server.ts` directly, which runs the exact same `startUiServer` that
 * `cmdUi` calls and writes the exact same `ui-server.json` liveness record —
 * `--nonce` cannot tell the two apart, and that is the point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { startUiChild } from '../ui/helpers.ts';
// `startUiChild` mints a session token and writes a liveness record; pins
// both stores out of the developer's real `~/.my-context`. Reachable
// transitively through `../ui/helpers.ts` too — imported explicitly so this
// file's own dependence on the pin is not left implicit.
import '../helpers/pin-sessions-dir.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

interface Run { out: string; code: number | null }

/** One `mycontext ui --nonce ...` invocation, run to completion. */
function runNonce(cwd: string, extraArgs: string[] = []): Run {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', CLI, 'ui', '--nonce', ...extraArgs],
    {
      cwd,
      env: process.env,
      encoding: 'utf8',
      // The probe and the mint each bound in well under a second; ten is a
      // generous multiple, so a hang here means the command is stuck, not slow.
      timeout: 10_000,
    },
  );
  return { out: `${run.stdout}${run.stderr}`, code: run.status };
}

function project(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nonce-cli-'));
  t.after(() => { removeTree(cwd); });
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture workspace failed to init');
  return cwd;
}

test('mycontext ui --nonce prints a usable URL when a server is live', async (t) => {
  const cwd = project(t);
  const h = await startUiChild(cwd);
  try {
    const run = runNonce(cwd);
    assert.equal(run.code, 0, run.out);
    const match = /mycontext ui: http:\/\/127\.0\.0\.1:(\d+)\/#([0-9a-f]{32})/.exec(run.out);
    assert.ok(match, `no usable URL in the output:\n${run.out}`);
    assert.equal(Number(match?.[1]), h.port, 'the URL must name the LIVE server\'s port, not a new one');

    // Usable, not merely well-shaped: redeem it for a token over real HTTP,
    // exactly as a recovered tab's `hashchange` listener would.
    const nonce = match?.[2] ?? '';
    const response = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce }),
    });
    assert.equal(response.status, 200, 'the CLI-obtained nonce must redeem for a real token');
  } finally {
    await h.stop();
  }
});

test('mycontext ui --nonce says so, clearly, and prints no URL when no server is running', (t) => {
  const cwd = project(t);
  const run = runNonce(cwd);
  assert.equal(run.code, 1, run.out);
  assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:\d+\/#/, 'a "no server" run must not print a usable URL');
  assert.match(run.out, /no server is running/);
  assert.match(run.out, /mycontext ui`/, 'it must tell the reader the one command that fixes this');
});

/**
 * `--nonce` starts nothing, so a flag that only means something to a START
 * is refused rather than silently ignored (`INV-nothing-is-dropped-silently`)
 * — combining them is not "start with these settings AND also mint", it is
 * two different intents on one command line.
 */
test('--nonce combined with a start-only flag is refused before anything runs', (t) => {
  const cwd = project(t);
  for (const extra of [['--port', '0'], ['--idle-ms', '1000'], ['--no-open']]) {
    const run = runNonce(cwd, extra);
    assert.equal(run.code, 1, `${extra.join(' ')}: ${run.out}`);
    assert.match(run.out, /--nonce/, `${extra.join(' ')}: the refusal must name --nonce`);
    assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:/, `${extra.join(' ')}: nothing should have run`);
  }
});
