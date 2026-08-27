/**
 * `src/ui/open.ts` and the `mycontext ui` command (plan Task 15).
 *
 * Two halves, and they answer different questions. The `openBrowser` half is
 * about a process spawn on three platforms: what goes on the command line, and
 * what happens when the opener is not there. The command half is about the
 * refusals, all of which must land BEFORE a socket is bound — because a
 * command that starts a server and then reports a bad flag has already done
 * the thing the flag was about.
 *
 * **What the fakes here model, and why they have a `pid`.** The plan's own
 * Step-1 test used a fake that THREW to model a missing opener, and a fake
 * with no `pid` at all. Neither is what `child_process` does: measured on Node
 * v24, a spawn of a missing binary returns a `ChildProcess` whose `pid` is
 * `undefined` and emits `'error'` on a later tick. So the fakes below carry a
 * `pid` when they model a launch that worked, and the two failure shapes are
 * exercised separately — one with a fake, one with the REAL `spawn` against a
 * name that cannot exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { openBrowser } from '../../src/ui/open.ts';
import { removeTree } from '../helpers/tmp.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';

/** The exact shape `RunningUiServer.urlWithNonce` produces. */
const URL_OK = 'http://127.0.0.1:54321/#0123456789abcdef0123456789abcdef';

interface FakeChild extends EventEmitter {
  pid?: number | undefined;
  unref(): void;
}

interface Fake {
  calls: { command: string; args: string[]; options: Record<string, unknown> }[];
  children: FakeChild[];
  unrefs: number;
  fn: typeof spawn;
}

/**
 * A `spawn` stand-in. `pid` is what says whether the launch worked:
 * `undefined` is what the real one returns for a missing binary, so a fake
 * carrying no pid models exactly that and nothing else.
 *
 * The failure is asked for as `null` rather than as `undefined`, because a
 * default parameter is not applied to a `null` — `fakeSpawn(null)` would
 * silently take the 4242 and test the opposite of what it says.
 */
function fakeSpawn(pid: number | null = 4242): Fake {
  const fake: Fake = { calls: [], children: [], unrefs: 0, fn: null as unknown as typeof spawn };
  fake.fn = ((command: string, args: string[], options: Record<string, unknown>) => {
    fake.calls.push({ command, args, options });
    const child = new EventEmitter() as FakeChild;
    child.pid = pid === null ? undefined : pid;
    child.unref = (): void => { fake.unrefs++; };
    fake.children.push(child);
    return child as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  return fake;
}

// ---------------------------------------------------------------------------
// The three command lines
// ---------------------------------------------------------------------------

test('win32 spawns cmd /c start with an empty title argument before the URL', () => {
  const fake = fakeSpawn();
  const result = openBrowser(URL_OK, 'win32', fake.fn);
  assert.deepEqual(result, { opened: true, command: 'cmd', args: ['/c', 'start', '', URL_OK] });
  assert.equal(fake.calls.length, 1);
  // Asserted by POSITION, not merely by presence. `start` reads its first
  // quoted operand as a window TITLE, so `start "<url>"` opens a console
  // window named after the URL and no browser at all; the empty string has to
  // sit between `start` and the URL for the URL to be the operand.
  assert.deepEqual(fake.calls[0]!.args, ['/c', 'start', '', URL_OK]);
  assert.equal(fake.calls[0]!.args[2], '', 'the title argument is what makes the URL the operand');
});

test('darwin uses open, linux uses xdg-open, and every other POSIX platform uses xdg-open', () => {
  for (const [platform, command] of [
    ['darwin', 'open'], ['linux', 'xdg-open'], ['freebsd', 'xdg-open'], ['sunos', 'xdg-open'],
  ] as [NodeJS.Platform, string][]) {
    const fake = fakeSpawn();
    const result = openBrowser(URL_OK, platform, fake.fn);
    assert.equal(result.opened, true, `${platform} did not open`);
    assert.deepEqual(fake.calls[0], {
      command,
      args: [URL_OK],
      options: { stdio: 'ignore', detached: true },
    }, `${platform} spawned the wrong thing`);
  }
});

/**
 * The two spawn options, asserted as behaviour rather than as configuration.
 *
 * `detached: true` + `unref()` is what stops the browser being a child whose
 * lifetime the CLI waits on — without it, `mycontext ui` cannot exit until the
 * browser does. `stdio: 'ignore'` is what keeps a browser's own startup
 * chatter off the terminal the URL was just printed to.
 */
test('the opener is detached, unref-ed and silent', () => {
  const fake = fakeSpawn();
  openBrowser(URL_OK, 'linux', fake.fn);
  assert.deepEqual(fake.calls[0]!.options, { stdio: 'ignore', detached: true });
  assert.equal(fake.unrefs, 1, 'the opener was never unref-ed, so the CLI would wait on it');
});

// ---------------------------------------------------------------------------
// The failure that is not a throw
// ---------------------------------------------------------------------------

test('a spawn that produced no pid is reported as not opened, with the command named', () => {
  const fake = fakeSpawn(null);
  const result = openBrowser(URL_OK, 'linux', fake.fn);
  assert.equal(result.opened, false);
  assert.match(
    result.opened === false ? result.reason : '',
    /xdg-open/,
    'the reason must name what could not be started — it is the whole of what the user can act on',
  );
  assert.equal(fake.calls.length, 1, 'it must not retry, and must not fall through to a second opener');
});

/**
 * **The defect the plan shipped, and the one this module exists to not have.**
 *
 * A `ChildProcess` whose spawn failed emits `'error'` on a later tick. An
 * `EventEmitter` with no `'error'` listener RETHROWS that event, so without the
 * listener in `open.ts` the emission below throws out of `emit` — synchronously,
 * here — and in production it is an uncaught exception that kills the server
 * this browser was being opened onto.
 *
 * This is the synchronous half of the proof; the test after it is the same
 * property against the real `child_process`.
 */
test('the error event a failed spawn emits is listened for, so it cannot reach the process', () => {
  const fake = fakeSpawn();
  openBrowser(URL_OK, 'linux', fake.fn);
  const child = fake.children[0]!;
  assert.equal(child.listenerCount('error'), 1, 'nothing is listening for the spawn error');
  assert.doesNotThrow(
    () => child.emit('error', new Error('spawn xdg-open ENOENT')),
    'an unlistened "error" event is an uncaught exception, and it would take the server with it',
  );
});

test('a REAL spawn of a binary that cannot exist is survived and reported, never thrown', async () => {
  const result = openBrowser(URL_OK, 'linux', ((
    _command: string, args: string[], options: Record<string, unknown>,
  ) => spawn('mycontext-no-such-browser-opener-4d9f', args, options)) as unknown as typeof spawn);
  assert.equal(result.opened, false, 'a missing opener must answer, not throw');
  // Past the tick the real `'error'` event arrives on. If `open.ts` stopped
  // listening, this await is where the uncaught exception lands and reddens
  // this test rather than escaping into whatever ran next.
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// ---------------------------------------------------------------------------
// The URL is not a shell string
// ---------------------------------------------------------------------------

/**
 * Every one of these is refused, and none of them reaches `spawn`.
 *
 * The first four are the reason this check parses instead of pattern-matching
 * the string: `startsWith('http://127.0.0.1')` accepts two of them, and both
 * resolve to `evil.example`. That is
 * `KNOWN-repo-containment-guard-is-defeated-across-windows-drive` in a
 * different alphabet — a guard written against the SHAPE of a string rather
 * than against the value it denotes.
 *
 * The rest are the argument-injection half: a leading `-` is an option to both
 * `open` and `xdg-open`, and `&`, `|`, `^`, `<`, `>` and a quote are `cmd.exe`
 * syntax rather than data.
 */
const REFUSED_URLS: [string, string][] = [
  // The first three are here BECAUSE OF A SURVIVING MUTANT. Replacing the
  // parsed-hostname check with `url.startsWith('http://127.0.0.1')` left this
  // suite green: the two cases below it are caught by the port and credential
  // checks instead, so nothing was testing the hostname check itself. Each of
  // these passes a prefix test, carries a port, carries no credentials, and
  // still denotes another host — which is the whole of the defect
  // `KNOWN-repo-containment-guard-is-defeated-across-windows-drive` records.
  ['http://127.0.0.1.evil.example:8080/#a', 'a hostname that merely starts with the loopback address'],
  ['http://127.0.0.1x:8080/#a', 'a hostname one character longer than the loopback address'],
  ['http://127.0.0.15:8080/#a', 'a different host on the loopback network'],
  ['http://127.0.0.1.evil.example/#a', 'a prefix match with no port'],
  ['http://127.0.0.1@evil.example/#a', 'the loopback address used as a username'],
  ['https://127.0.0.1:54321/#a', 'a scheme this server never serves'],
  ['http://localhost:54321/#a', 'a name that resolves to loopback but is not it'],
  ['http://127.0.0.1/#a', 'no port'],
  ['http://user:pw@127.0.0.1:54321/#a', 'credentials'],
  ['--help', 'an option rather than a URL'],
  ['http://127.0.0.1:54321/#a&calc', 'a cmd.exe command separator'],
  ['http://127.0.0.1:54321/#a|calc', 'a pipe'],
  ['http://127.0.0.1:54321/#a^b', 'a cmd.exe escape character'],
  ['http://127.0.0.1:54321/#a"b', 'a quote'],
  ['http://127.0.0.1:54321/#a b', 'a space'],
  // Written as an escape, never as a literal byte: `npm run check:text-files`
  // has already caught three raw NULs pasted into source files.
  ['http://127.0.0.1:54321/#a\u0000b', 'a NUL'],
  ['http://127.0.0.1:54321/#a\nb', 'a newline'],
  ['', 'nothing at all'],
];

test('a URL that is not one this server could have minted is refused, and nothing is spawned', () => {
  for (const [url, what] of REFUSED_URLS) {
    const fake = fakeSpawn();
    const result = openBrowser(url, 'win32', fake.fn);
    assert.equal(result.opened, false, `${what} was accepted: ${JSON.stringify(url)}`);
    assert.equal(fake.calls.length, 0, `${what} reached spawn: ${JSON.stringify(url)}`);
    assert.notEqual(
      result.opened === false ? result.reason : '', '',
      `${what} was refused with no reason — a caller cannot print what it was not told`,
    );
  }
});

/**
 * The other direction, so the guard above is not simply "refuse everything".
 * A test that refused every input would pass every assertion in the block
 * above while making the command useless.
 */
test('the URL shapes this server does mint are accepted', () => {
  for (const url of [
    'http://127.0.0.1:1/#0123456789abcdef0123456789abcdef',
    'http://127.0.0.1:65535/#a',
    'http://127.0.0.1:54321/',
  ]) {
    const fake = fakeSpawn();
    assert.equal(openBrowser(url, 'linux', fake.fn).opened, true, `${url} was refused`);
    assert.deepEqual(fake.calls[0]!.args, [url]);
  }
});

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

test('mycontext ui is a registered command with the documented flags in its usage', () => {
  const def = COMMANDS.get('ui');
  assert.ok(def, 'ui is not registered — src/cli/commands/index.ts must import ./ui.ts');
  assert.match(def.usage, /--port/);
  assert.match(def.usage, /--no-open/);
});

function inWorkspace<T>(fn: (cwd: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'the fixture workspace did not initialize');
    return fn(dir);
  } finally {
    removeTree(dir);
  }
}

function run(argv: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/**
 * **Every refusal is synchronous, and that is the assertion — not a detail.**
 *
 * `runCli` returns a number; the server outlives it. So a refusal that is
 * deferred into the promise returns 0, prints nothing the caller can see, and
 * sets `process.exitCode = 1` a tick later — on whatever process is running,
 * which for `test/docs/inventory.test.ts` is the test runner itself. Each case
 * below asserts the code AND the message from the SAME synchronous call, which
 * is the only way to state that nothing was deferred.
 */
test('every bad command line is refused synchronously, before anything is started', () => {
  inWorkspace((cwd) => {
    const cases: [string[], RegExp][] = [
      [['ui', '--no-opn'], /unknown option "--no-opn"/],
      [['ui', '--yes'], /unknown option "--yes"/],
      [['ui', '--port'], /--port needs a value/],
      [['ui', '--port='], /--port needs a value/],
      [['ui', '--port', 'abc'], /--port must be a whole number from 0 to 65535 \(got "abc"\)/],
      [['ui', '--port', '65536'], /--port must be a whole number from 0 to 65535/],
      [['ui', '--port', '-1'], /--port must be a whole number from 0 to 65535/],
      [['ui', '--port', '1.5'], /--port must be a whole number from 0 to 65535/],
      [['ui', '--port', '1', '--port', '2'], /--port was given 2 times/],
      // `--idle-ms`, added 2026-08-23. Same four spellings of the same silent
      // drop the port flag refuses, against the same bound `IdleMonitor`'s
      // constructor enforces — one bound, imported, not re-typed here either.
      [['ui', '--idle-ms'], /--idle-ms needs a value/],
      [['ui', '--idle-ms='], /--idle-ms needs a value/],
      [['ui', '--idle-ms', 'abc'], /--idle-ms must be a whole number of milliseconds from 1 to 86400000 \(24 hours\) \(got "abc"\)/],
      [['ui', '--idle-ms', '0'], /--idle-ms must be a whole number of milliseconds from 1 to 86400000/],
      [['ui', '--idle-ms', '-1'], /--idle-ms must be a whole number of milliseconds from 1 to 86400000/],
      [['ui', '--idle-ms', '1.5'], /--idle-ms must be a whole number of milliseconds from 1 to 86400000/],
      // One past MAX_IDLE_MS — the day the class calls the point where the
      // window "stops meaning anything", not the point where the timer breaks.
      [['ui', '--idle-ms', '86400001'], /--idle-ms must be a whole number of milliseconds from 1 to 86400000/],
      [['ui', '--idle-ms', '1000', '--idle-ms', '2000'], /--idle-ms was given 2 times/],
    ];
    for (const [argv, message] of cases) {
      const result = run(argv, cwd);
      assert.equal(result.code, 1, `${argv.join(' ')} did not exit 1: ${result.out}`);
      assert.match(result.out, message, argv.join(' '));
    }
  });
});

/**
 * The case `test/docs/inventory.test.ts` actually runs when it proves every
 * banner name dispatches: `mycontext ui` in a directory with no workspace.
 *
 * It must answer here, in this call. Left to `startUiServer`'s rejection it
 * answers one tick later, having already returned 0 — and sets
 * `process.exitCode = 1` on the test runner, which is a suite that passes
 * every assertion and still exits 1.
 */
test('with no workspace, ui refuses in the same call rather than in a promise', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-bare-'));
  try {
    const result = run(['ui'], dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /no workspace here/);
  } finally {
    removeTree(dir);
  }
});

/**
 * **The same refusals, in a child process, asserting the half an in-process
 * call cannot: that nothing is left running.**
 *
 * This test exists because of a mutation run. Deleting the `refuseUnknownFlag`
 * line from `cmdUi` does not redden the in-process test above — it HANGS it.
 * `runCli` is called in this process, so an unrefused flag starts a real
 * listening socket inside `node --test`, the runner finishes its assertions and
 * then waits on an event loop that will never drain. The mutant is detected and
 * cannot be reported, which is exit 4 rather than a kill: a guard that can only
 * fail by hanging is a guard whose failure nobody reads.
 *
 * A child process turns that into an ordinary red: the refusal is proved by the
 * child EXITING, and a mutant that starts a server is a child that does not.
 *
 * Every case carries `--no-open` as well, and that is deliberate rather than
 * incidental: without it a mutant that reached the server would also spawn a
 * real browser on the machine running the suite.
 */
async function cliExits(argv: string[], cwd: string): Promise<{ code: number | null; out: string }> {
  const child = spawn(process.execPath, [CLI, ...argv], { cwd });
  let out = '';
  const collect = (chunk: Buffer): void => { out += chunk.toString('utf8'); };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(
        `\`mycontext ${argv.join(' ')}\` was still running after 12s — it bound a socket instead `
        + `of refusing. Output:\n${out}`));
    }, 12_000);
    child.once('exit', (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

test('a refused command line binds nothing — the process exits instead of serving', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-refuse-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0);
    for (const argv of [
      ['ui', '--no-open', '--no-opn'],                  // an unknown flag
      ['ui', '--no-open', '--port'],                    // a value flag with nothing after it
      ['ui', '--no-open', '--port='],                   // a value flag with an empty value
      ['ui', '--no-open', '--port', '0', '--port', '0'], // the same flag twice
    ]) {
      const { code, out } = await cliExits(argv, dir);
      assert.equal(code, 1, `\`mycontext ${argv.join(' ')}\` exited ${code}:\n${out}`);
    }
  } finally {
    removeTree(dir);
  }
});

/**
 * `--no-open`, end to end, in a child process — the one test that proves the
 * command's happy path rather than its refusals.
 *
 * A child rather than an in-process call, for the reason `test/ui/helpers.ts`
 * spawns one: `cmdUi` hands the server to nobody, so an in-process start would
 * leave a listening socket this file has no handle to close, and `node --test`
 * would not exit.
 */
const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

test('ui --no-open prints a URL that a real request can reach, and opens no browser', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-live-'));
  let child: ChildProcess | null = null;
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0);
    child = spawn(process.execPath, [CLI, 'ui', '--no-open', '--port', '0'], { cwd: dir });
    const url = await new Promise<string>((resolve, reject) => {
      let buffer = '';
      const timer = setTimeout(() => reject(new Error(`no URL printed; output: ${buffer}`)), 30_000);
      const onChunk = (chunk: Buffer): void => {
        buffer += chunk.toString('utf8');
        const match = /http:\/\/127\.0\.0\.1:\d+\/#[0-9a-f]+/.exec(buffer);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      };
      child!.stdout?.on('data', onChunk);
      child!.stderr?.on('data', onChunk);
      child!.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`ui exited early (${code}): ${buffer}`));
      });
    });

    // The printed URL is the whole remedy, so it has to actually work: the
    // nonce in it exchanges for a token, and the token reads.
    const origin = new URL(url).origin;
    const nonce = new URL(url).hash.slice(1);
    const handoff = await fetch(`${origin}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce }),
    });
    assert.equal(handoff.status, 200, 'the printed nonce did not exchange for a token');
    const { token } = await handoff.json() as { token: string };
    const ping = await fetch(`${origin}/api/ping`, { headers: { 'X-Mycontext-Token': token } });
    assert.equal(ping.status, 200);
    assert.deepEqual(await ping.json(), { ok: true });
  } finally {
    if (child !== null && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((done) => { child!.once('exit', () => done()); child!.kill(); });
    }
    removeTree(dir);
  }
});
