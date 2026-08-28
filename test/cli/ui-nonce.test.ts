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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readUiServerRecord, uiServerRecordPath } from '../../src/core/ui-server-record.ts';
import { removeTree } from '../helpers/tmp.ts';
import { startUiChild } from '../ui/helpers.ts';
// `startUiChild` mints a session token and writes a liveness record; pins
// both stores out of the developer's real `~/.my-context`. Reachable
// transitively through `../ui/helpers.ts` too — imported explicitly so this
// file's own dependence on the pin is not left implicit.
import '../helpers/pin-sessions-dir.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

/**
 * **This file gets its OWN global root, and it is not belt-and-braces.**
 *
 * `pin-sessions-dir.ts` keeps the suite out of the developer's home, but it
 * pins ONE directory for the whole run: the preload sets the variable in the
 * runner's parent process and every test file's child inherits that same value.
 * `ui-server.json` names a MACHINE's server rather than a workspace's, so there
 * is exactly one of it per root — and `node --test` runs test files in
 * parallel. Every other file that starts a harness server therefore writes and
 * removes the same record these cases are asserting about.
 *
 * That is tolerable for a file asserting a server IS there, and not for this
 * one: the cases below turn on a record being ABSENT, and a neighbour's server
 * writing one between `withoutRecord()` and the `--nonce` run would make this
 * file report a defect that belongs to nobody. Re-pointing the variable here
 * costs nothing — `uiServerRecordPath()` reads it per call, and both the
 * harness spawn and `runNonce` pass `process.env` at spawn time — and it is
 * still a temporary directory, so the real-home guard is unaffected.
 */
process.env['MYCONTEXT_UI_SESSIONS_DIR']
  = mkdtempSync(path.join(tmpdir(), 'myctx-nonce-global-'));

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

/**
 * Set `ui.port` in the fixture's own config — the one address `--nonce` may try
 * when the liveness record is missing.
 *
 * Written by merging rather than by replacing the file, so the rest of what
 * `mycontext init` wrote still has to load: a `--nonce` run that failed because
 * the config no longer parsed would pass every negative assertion below for
 * entirely the wrong reason.
 */
function setConfiguredPort(cwd: string, port: number): void {
  const file = path.join(cwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const ui = (config['ui'] ?? {}) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...config, ui: { ...ui, port } }, null, 2)}\n`, 'utf8');
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

/**
 * Remove the liveness record, so the next `--nonce` meets a genuine "no record"
 * and not a leftover.
 *
 * Needed because a harness server is stopped with `child.kill()`, which is a
 * SIGTERM the server does not handle — so it dies without running the `close`
 * listener that takes its record back, and the file outlives it. That leftover
 * is the `dead` state, which is a DIFFERENT fact from the one these cases are
 * about, and the whole point of this task is that the two are no longer said
 * with the same sentence.
 *
 * `pin-sessions-dir.ts` put the record in a temporary root, so this reaches
 * nothing in a real home.
 */
function withoutRecord(): void {
  rmSync(uiServerRecordPath(), { force: true });
  assert.equal(readUiServerRecord(), null, 'the fixture failed to remove the liveness record');
}

/**
 * ── "NO RECORD" IS NOT "NO SERVER" ─────────────────────────────────────────
 *
 * The wording this asserts was wrong twice on 2026-08-28. A server was
 * LISTENING on 127.0.0.1:58888, confirmed by `netstat`, and `--nonce` answered
 * *"no server is running"* — on the strength of a `ui-server.json` that had
 * lost a rename race at startup and had never been written. The command had
 * checked one file and reported a fact about the machine.
 *
 * So this case now asserts what was actually established (there is no record,
 * and nothing was checked) and asserts the absence of the claim that was not
 * (that no server is running). `assert.doesNotMatch` is the load-bearing half:
 * a message can be truthful in its first sentence and still assert the wrong
 * thing in its second, and only the negative assertion catches that.
 */
test('mycontext ui --nonce reports no RECORD, not no server, and prints no URL', (t) => {
  const cwd = project(t);
  withoutRecord();
  const run = runNonce(cwd);
  assert.equal(run.code, 1, run.out);
  assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:\d+\/#/, 'a "no server" run must not print a usable URL');
  assert.match(run.out, /no liveness record/, run.out);
  assert.doesNotMatch(run.out, /no server is running/,
    'nothing checked whether a server is running — only whether a file exists — and the command '
    + `said the stronger thing anyway: ${run.out}`);
  assert.match(run.out, /ui-server\.json/, 'the reader must be told which file was missing');
  assert.match(run.out, /mycontext ui`/, 'it must tell the reader the one command that fixes this');
});

/**
 * ── THE DEFECT ITSELF: A LIVE SERVER AND NO RECORD ─────────────────────────
 *
 * The state measured on 2026-08-28, reproduced: a server listening, and
 * `ui-server.json` absent. Deleting the record after the server is up is the
 * same end state a failed rename produces, and it is the only way to reach it
 * without manufacturing a Windows share-mode conflict — see
 * `test/core/ui-server-record.test.ts` for why that cannot be done reliably.
 *
 * Two runs, because the answer differs and both answers have to be TRUE:
 * without `ui.port` the command has no address at all and must say so without
 * denying the server; with `ui.port` it has exactly one address a person wrote
 * down, and it recovers the tab — which is the point of the flag existing.
 */
test('a live server with no record: --nonce does not deny it, and recovers it from ui.port', async (t) => {
  const cwd = project(t);
  const h = await startUiChild(cwd);
  try {
    // The record the server wrote on listen, removed. `pin-sessions-dir.ts`
    // put it in a temporary root, so this touches nothing in a real home.
    withoutRecord();

    const blind = runNonce(cwd);
    assert.equal(blind.code, 1, blind.out);
    assert.doesNotMatch(blind.out, /no server is running/,
      'a server was listening on 127.0.0.1:' + h.port + ' throughout this run, and the command '
      + `said it was not — which is the defect verbatim: ${blind.out}`);
    assert.match(blind.out, /no liveness record/, blind.out);
    assert.match(blind.out, /ui\.port/,
      'a refusal that cannot be acted on is a dead end; it must name the one way forward');

    // Now the address a person wrote down. `--nonce` tries exactly this one,
    // and nothing else — no scan, no sweep of the ephemeral range.
    setConfiguredPort(cwd, h.port);
    const recovered = runNonce(cwd);
    assert.equal(recovered.code, 0, recovered.out);
    const match = /mycontext ui: http:\/\/127\.0\.0\.1:(\d+)\/#([0-9a-f]{32})/.exec(recovered.out);
    assert.ok(match, `the configured port was not tried, or its answer was dropped:\n${recovered.out}`);
    assert.equal(Number(match?.[1]), h.port);
    // The record is STILL missing, and a working command must not hide a broken
    // one — `INV-nothing-is-dropped-silently` reaches this seam too.
    assert.match(recovered.out, /record is still missing/, recovered.out);

    // Usable, not merely well-shaped.
    const response = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce: match?.[2] ?? '' }),
    });
    assert.equal(response.status, 200, 'the nonce minted through the ui.port fallback must redeem');
  } finally {
    await h.stop();
  }
});

/**
 * The configured port is ONE address, not a scan, and this is what proves it:
 * with no record and a `ui.port` nothing is listening on, the command reports
 * both facts — no record, and that address silent — and does not go looking
 * anywhere else.
 */
test('a configured port that answers nothing is reported, not swept past', async (t) => {
  const cwd = project(t);
  withoutRecord();
  // Port 1 is refused outright on every platform this runs on and needs no
  // socket of its own to be certainly silent.
  setConfiguredPort(cwd, 1);
  const run = runNonce(cwd);
  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /no liveness record/, run.out);
  assert.match(run.out, /ui\.port 1 was tried/,
    `the configured address was tried and the outcome was dropped: ${run.out}`);
  assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:\d+\/#/);
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
