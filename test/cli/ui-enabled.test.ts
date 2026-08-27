/**
 * `ui.enabled`'s FIRST enforcement site, and `ui.port`'s only one — Task 4 of
 * `docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md`,
 * spec §6.
 *
 * `ui.enabled` shipped validated, refused when malformed, rendered on the
 * Configure screen and consulted by NOTHING that decides anything. This file
 * is the assertion that changed: `mycontext ui` now declines when the key says
 * no, and says which key did it.
 *
 * ── WHY EVERY TEST HERE SPAWNS THE CLI ────────────────────────────────────
 *
 * Two reasons, and both are structural rather than stylistic.
 *
 * First, `cmdUi` returns 0 the moment the server is handed off — the process,
 * not the return value, is what carries the outcome. `runCli` in-process would
 * report 0 for a run whose server rejected a tick later and set
 * `process.exitCode = 1` on the TEST RUNNER's own process, which is the exact
 * failure `src/cli/commands/ui.ts`'s header describes and refuses to allow.
 *
 * Second, a served run writes `ui-sessions.json` into `GLOBAL_DIR`, which is
 * read off `homedir()` at import time. A child is the only place `HOME` can be
 * redirected before that constant is captured, and
 * `test/helpers/real-home-guard.ts` fails the suite for anything that touches
 * the developer's real `~/.my-context`.
 *
 * ── AND WHY THE SERVED RUNS PASS `--idle-ms 30` ───────────────────────────
 *
 * The default idle window is eight hours, so a test that starts a real server
 * and waits for it is a test that never ends. 30ms is the same knob a person
 * uses to say "this session is short", polled at 3ms, so each served run binds
 * a real port, prints its real URL and exits on its own. The port in that URL
 * is the whole measurement: it is the BOUND port, so it can settle the
 * precedence question by observation rather than by reading the parser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
// Spawns real UI servers, which mint tokens; pins the store out of the
// developer's real `~/.my-context`. See the module.
import '../helpers/pin-sessions-dir.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

interface Sandbox {
  /** The workspace root — where `mycontext ui` is run from. */
  cwd: string;
  /** A throwaway `HOME`, so `ui-sessions.json` never lands in the real one. */
  home: string;
}

/**
 * A real workspace built through the real CLI, with `config.json` MERGED
 * rather than replaced: `mycontext init` writes a file with a profile and
 * categories in it, and a test that overwrites the whole thing would be
 * asserting against a config shape no workspace on disk ever has.
 */
function sandbox(t: { after(fn: () => void): void }, config: Record<string, unknown>): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-uien-'));
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-uihome-'));
  t.after(() => { removeTree(cwd); removeTree(home); });

  runCli(['init'], cwd, () => {});
  const configPath = path.join(cwd, '.my_context', 'config.json');
  const merged = { ...JSON.parse(readFileSync(configPath, 'utf8')) as object, ...config };
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { cwd, home };
}

interface Run {
  out: string;
  code: number | null;
}

function runUi(box: Sandbox, args: string[]): Run {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', CLI, 'ui', ...args],
    {
      cwd: box.cwd,
      // `HOME` for POSIX, `USERPROFILE` for Windows — `os.homedir()` reads a
      // different one on each, and this suite runs on both.
      env: { ...process.env, HOME: box.home, USERPROFILE: box.home },
      encoding: 'utf8',
      // A served run exits on its own in tens of milliseconds. If one ever
      // does not, this bound is what turns "the suite hangs forever" into one
      // named failing test.
      timeout: 30_000,
    },
  );
  return { out: `${run.stdout}${run.stderr}`, code: run.status };
}

/**
 * A port nothing is listening on, taken by binding 0 and letting go. It races
 * in principle — anything could claim it between the close and the bind — and
 * that is accepted deliberately: the alternative is a hardcoded number, which
 * races against the DEVELOPER'S OWN machine, where 58888 is quite likely to
 * already be a `mycontext ui` somebody left running.
 */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => { resolve(port); });
    });
  });
}

/** The bound port, read back out of the URL the `--no-open` run prints. */
function servedPort(out: string): number {
  const match = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out);
  assert.notEqual(match, null, `no served URL in the output:\n${out}`);
  return Number(match?.[1]);
}

/**
 * The test this task exists for.
 *
 * The wording is the DENY HOOK's own line, word for word, and that is
 * deliberate rather than incidental: the product should say the same thing
 * everywhere it declines to touch a config. Asserted in pieces — the key, the
 * file, and the sentence that hands the decision back to the user — because
 * each piece is a separate promise and a reworded message that dropped only
 * "nothing here writes it" would still be a message that implies the CLI could
 * flip the key for you.
 */
test('ui.enabled false REFUSES mycontext ui, and says which key did it', (t) => {
  const box = sandbox(t, { ui: { enabled: false } });
  const run = runUi(box, ['--no-open']);

  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /ui\.enabled is false/);
  assert.match(run.out, /\.my_context[\\/]config\.json|\.my_context\/config\.json/);
  assert.match(run.out, /so the web UI is off/);
  assert.match(run.out, /Set it to true, or remove the key, to serve/);
  assert.match(run.out, /Configuration is a file and is yours to edit; nothing here writes it/);
});

/**
 * The refusal has to happen BEFORE the bind, not after it — the whole point of
 * a permission is that the forbidden thing does not happen. Measured rather
 * than asserted on the message: a configured port is handed to a run that is
 * disabled, and the port is still free afterwards.
 */
test('a disabled UI binds nothing, even with a port named for it', async (t) => {
  const port = await freePort();
  const box = sandbox(t, { ui: { enabled: false, port } });
  const run = runUi(box, ['--no-open', '--idle-ms', '30']);

  assert.equal(run.code, 1, run.out);
  assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:/, 'a refused run printed a URL');
  assert.equal(await isFree(port), true, 'a refused run bound the port anyway');
});

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.on('error', () => { resolve(false); });
    probe.listen(port, '127.0.0.1', () => { probe.close(() => { resolve(true); }); });
  });
}

/**
 * The direction of the key, pinned from the outside. `ui` is opt-OUT: a
 * workspace that has never heard of the key serves, and so does one that wrote
 * `true`. Both spellings are here because the failure this catches —
 * `config.ui?.enabled ?? false`, `undefined` falling to `false` — passes the
 * `true` case and fails the absent one, which is every workspace that exists.
 */
test('ui.enabled true, and absent, both serve — the default is opt-out', (t) => {
  const absent = runUi(sandbox(t, {}), ['--no-open', '--idle-ms', '30']);
  assert.equal(absent.code, 0, absent.out);
  assert.match(absent.out, /http:\/\/127\.0\.0\.1:\d+\//);

  const explicit = runUi(sandbox(t, { ui: { enabled: true } }), ['--no-open', '--idle-ms', '30']);
  assert.equal(explicit.code, 0, explicit.out);
  assert.match(explicit.out, /http:\/\/127\.0\.0\.1:\d+\//);
});

/**
 * ── THE PRECEDENCE, ALL THREE CASES ───────────────────────────────────────
 *
 * `--port` wins when given, `ui.port` is the fallback, and giving both is the
 * case that decides which of the two sentences above is really true. Asserted
 * on the BOUND port rather than on the parser's return value, because the bind
 * is what a person actually gets.
 */
test('the --port flag alone binds the flag port', async (t) => {
  const port = await freePort();
  const run = runUi(sandbox(t, {}), ['--no-open', '--idle-ms', '30', '--port', String(port)]);
  assert.equal(run.code, 0, run.out);
  assert.equal(servedPort(run.out), port);
});

test('ui.port alone binds the configured port — this is what a hook uses', async (t) => {
  const port = await freePort();
  const run = runUi(sandbox(t, { ui: { port } }), ['--no-open', '--idle-ms', '30']);
  assert.equal(run.code, 0, run.out);
  assert.equal(servedPort(run.out), port);
});

test('given both, the flag WINS — the config is only ever the fallback', async (t) => {
  const configured = await freePort();
  const flagged = await freePort();
  assert.notEqual(configured, flagged, 'the two probes handed back the same port');
  const run = runUi(
    sandbox(t, { ui: { port: configured } }),
    ['--no-open', '--idle-ms', '30', '--port', String(flagged)],
  );
  assert.equal(run.code, 0, run.out);
  assert.equal(servedPort(run.out), flagged);
  assert.notEqual(servedPort(run.out), configured);
});

/**
 * `--port 0` is the sharpest form of "the flag wins": 0 is a legal flag value
 * meaning "ask the operating system", and it is the one value `ui.port`
 * refuses. An implementation that merged the two with `??` or `||` would read
 * the explicit 0 as "not given" and quietly serve the configured port instead
 * — a person who typed a flag and got something else.
 */
test('an explicit --port 0 beats a configured port rather than falling through', async (t) => {
  const configured = await freePort();
  const run = runUi(sandbox(t, { ui: { port: configured } }), ['--no-open', '--idle-ms', '30', '--port', '0']);
  assert.equal(run.code, 0, run.out);
  assert.notEqual(servedPort(run.out), configured, '--port 0 fell through to ui.port');
});

/**
 * The failure mode adding a config read to this command introduces, and the
 * reason it is pinned here. A workspace whose `config.json` cannot be resolved
 * must fail in a way that NAMES THE CONFIG — before this task `mycontext ui`
 * read no config at all, so a broken one could only ever surface elsewhere,
 * and a refusal phrased as a server problem would send the reader to the
 * network stack for a typo in a JSON file.
 */
test('a broken config fails by naming the config, not by looking like a broken UI', (t) => {
  const box = sandbox(t, { ui: { enabled: 'false' } });
  const run = runUi(box, ['--no-open', '--idle-ms', '30']);

  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /ui\.enabled is "false"/);
  assert.doesNotMatch(run.out, /EADDRINUSE|listen|socket/i, 'a config typo was reported as a server fault');
});

test('a port this build cannot honour is refused before anything binds', (t) => {
  const run = runUi(sandbox(t, { ui: { port: 0 } }), ['--no-open', '--idle-ms', '30']);
  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /ui\.port is 0/);
  assert.doesNotMatch(run.out, /http:\/\/127\.0\.0\.1:/);
});
