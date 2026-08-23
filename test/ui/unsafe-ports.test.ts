/**
 * The port-selection rule, tested the only way an intermittent failure can
 * honestly be tested: deterministically.
 *
 * The defect this covers appeared ONCE, on port 6669, in roughly one browser
 * run in eleven on this machine. A test that starts servers and hopes to draw a
 * refused port would pass over a broken fix ~99.9% of the time and would be
 * worth nothing. So the decision — is this port acceptable, how many tries, what
 * does it say when it gives up — is a pure function of a port number, and every
 * assertion below drives it with a SCRIPTED list of ports rather than with
 * whatever the OS happened to hand out.
 *
 * Two of them do bind real sockets, deliberately and without a loop: a server
 * started on `--port 6669` is a refused port every single time, which turns the
 * once-in-eleven-runs failure into a test that reproduces it on demand and
 * proves the retry is wired to the real spawn path and not only to a fake.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { spawnUiChild, startUiChild, type UiHarness } from './helpers.ts';
import {
  CHROME_UNSAFE_PORTS, FETCH_ONLY_BLOCKED_PORTS, isChromeUnsafePort, isUnusableTestPort,
  startOnSafePort, type PortHarness,
} from './unsafe-ports.ts';

// ── The fact table ─────────────────────────────────────────────────────────

test('the refused set holds the ports the browsers were measured to refuse', () => {
  // The one this project actually drew, and its neighbours in the same block.
  for (const port of [6665, 6666, 6667, 6668, 6669, 6697]) {
    assert.ok(isChromeUnsafePort(port), `${port} is refused (IRC block)`);
  }
  assert.ok(isChromeUnsafePort(6000), 'X11');
  assert.ok(isChromeUnsafePort(10080), 'amanda');
  assert.ok(isChromeUnsafePort(22), 'ssh');
});

test('the refused set holds no port that was measured to be FINE', () => {
  // 4190 (ManageSieve) is here because it is the trap: it appears in several
  // published copies of this list and in this author's memory, and the sweep of
  // 1-65535 against both browsers did NOT refuse it. An entry added from memory
  // costs a spawn on every draw that hits it, forever, for nothing.
  assert.equal(isChromeUnsafePort(4190), false, '4190 was measured as NOT refused BY CHROME');
  // 13243 is a port a corroborating run actually served a 200 over.
  for (const port of [3000, 8080, 13243, 15000, 49152, 65535]) {
    assert.equal(isChromeUnsafePort(port), false, `${port} is an ordinary port`);
  }
});

/**
 * **The two consumers disagree, and the harness must obey both.**
 *
 * The sweep above asked Chrome. A separate investigation on the same day asked
 * node's `fetch` — which enforces the WHATWG Fetch "bad port" list and answers
 * `TypeError: fetch failed { cause: Error: bad port }` before opening a socket
 * — and found two ports Chrome serves happily and undici refuses. That is not
 * a contradiction between the two measurements; it is two different questions
 * with two different right answers, and the assertion directly above this one
 * pins the Chrome half so neither can quietly absorb the other.
 *
 * What makes it load-bearing rather than trivia: the same investigation
 * measured the `bad port` failure at 0.325% per bind over 4000 binds, and a
 * full suite makes 26 binds — 3-8% of runs, one red test, in a different UI
 * test each time, which is exactly why it went unidentified for a day. Roughly
 * a tenth of that lottery is bought by these two ports alone, so a Chrome-only
 * screen would have left a rarer version of the same unexplained red in place.
 */
test('the harness screens the UNION of both consumers, not Chrome alone', () => {
  for (const port of [4190, 6679]) {
    assert.equal(isChromeUnsafePort(port), false,
      `${port} is fine for Chrome — that is the measurement, and it stands`);
    assert.ok(FETCH_ONLY_BLOCKED_PORTS.has(port),
      `${port} is refused by node's fetch and must be recorded as such`);
    assert.ok(isUnusableTestPort(port),
      `${port} must be unusable for a TEST child, which is fetched as well as navigated`);
  }
  // The union never shrinks what Chrome already refused.
  for (const port of [6669, 6000, 10080, 22]) {
    assert.ok(isUnusableTestPort(port), `${port} stays unusable through the union`);
  }
  // And it does not swallow ordinary ports on the way.
  for (const port of [3000, 8080, 13243, 58888, 58800]) {
    assert.equal(isUnusableTestPort(port), false, `${port} is an ordinary port`);
  }
});

test('every entry is a real port number, and none is above 10080', () => {
  for (const port of CHROME_UNSAFE_PORTS) {
    assert.ok(Number.isInteger(port) && port >= 1 && port <= 65535, `${port} is a port`);
  }
  // The ceiling is not trivia. It is why a host on the Windows default
  // ephemeral range (49152-65535) or Linux's (32768-60999) can never reproduce
  // this, and why THIS machine — measured at 1024-15000 — can. If a future
  // browser adds a high port, this fails and the reasoning gets revisited
  // rather than silently going stale.
  assert.equal(Math.max(...CHROME_UNSAFE_PORTS), 10080);
});

// ── The retry, with no sockets at all ──────────────────────────────────────

/**
 * A starter that hands back the scripted ports in order, and records what
 * happened to each harness. No process, no socket: the point is that the port
 * is chosen by the test rather than by the OS.
 */
function scripted(ports: number[]): {
  start: () => Promise<PortHarness>;
  log: string[];
  stops: number[];
} {
  const log: string[] = [];
  const stops: number[] = [];
  let index = 0;
  return {
    log,
    stops,
    start: () => {
      const port = ports[index] ?? ports[ports.length - 1] ?? 0;
      index++;
      log.push(`start:${port}`);
      return Promise.resolve({
        port,
        stop: () => { log.push(`stop:${port}`); stops.push(port); return Promise.resolve(); },
      });
    },
  };
}

test('a safe port on the first attempt is returned untouched', async () => {
  const fake = scripted([13243]);
  const harness = await startOnSafePort(fake.start);
  assert.equal(harness.port, 13243);
  assert.deepEqual(fake.log, ['start:13243'], 'exactly one attempt, and nothing stopped');
});

test('a refused port is discarded and another asked for — in that order', async () => {
  const fake = scripted([6669, 6000, 13243]);
  const harness = await startOnSafePort(fake.start);
  assert.equal(harness.port, 13243);
  // The ORDER is the assertion: each refused child is stopped BEFORE the next
  // one is started. Started-then-stopped-later leaks a process per attempt and
  // keeps the refused port held while asking for a different one.
  assert.deepEqual(fake.log, [
    'start:6669', 'stop:6669',
    'start:6000', 'stop:6000',
    'start:13243',
  ]);
});

test('it gives up after a bounded number of attempts, and says what it drew', async () => {
  const fake = scripted([6669]); // the OS is stuck on a refused port
  await assert.rejects(
    () => startOnSafePort(fake.start, 3),
    (err: Error) => {
      assert.match(err.message, /3 attempt\(s\) in a row: 6669, 6669, 6669/);
      // It must say that the PRODUCT was not what failed, because the whole cost
      // of this defect was a red that read like a regression.
      assert.match(err.message, /THIS IS THE HARNESS, NOT THE PRODUCT/);
      assert.match(err.message, /ERR_UNSAFE_PORT/);
      return true;
    },
  );
  assert.deepEqual(fake.stops, [6669, 6669, 6669], 'every attempt was stopped — none leaked');
});

test('a child that fails to START is not retried; its rejection propagates as-is', async () => {
  // `server-e2e.test.ts` asserts that `startUiChild(cwd, ['--host', '0.0.0.0'])`
  // rejects. If a refusal to start were treated as a bad draw, that test would
  // pay five spawns for the same answer, and a genuinely broken server would be
  // retried instead of reported.
  let calls = 0;
  const boom = new Error('ui server exited early (1): mycontext ui: --host must be loopback');
  await assert.rejects(
    () => startOnSafePort(() => { calls++; return Promise.reject(boom); }),
    (err: Error) => { assert.equal(err, boom); return true; },
  );
  assert.equal(calls, 1, 'asked exactly once');
});

test('a nonsensical attempt budget is refused rather than silently doing nothing', async () => {
  const fake = scripted([13243]);
  await assert.rejects(() => startOnSafePort(fake.start, 0), /whole number of 1 or more/);
  assert.deepEqual(fake.log, [], 'nothing was started');
});

// ── The same rule against real processes and real sockets ──────────────────

/** The smallest workspace the server will agree to start over. */
function workspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-port-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture: init failed');
  return dir;
}

test('a REAL server on a refused port is killed and reported, not handed to the browser', async () => {
  const cwd = workspace();
  const started: UiHarness[] = [];
  try {
    // `--port 6669` instead of `--port 0`: the OS's one-in-820 becomes every
    // time, so the failure that was seen once now reproduces on demand.
    await assert.rejects(
      () => startOnSafePort(async () => {
        const h = await spawnUiChild(cwd, ['--port', '6669']);
        started.push(h);
        return h;
      }, 2),
      /2 attempt\(s\) in a row: 6669, 6669/,
    );
    assert.equal(started.length, 2, 'it really did spawn twice');
    for (const h of started) {
      assert.equal(h.port, 6669, 'the harness read the port the server actually bound');
      assert.ok(
        h.child.exitCode !== null || h.child.signalCode !== null,
        'the discarded child is gone — a retry that leaves it running holds the port',
      );
    }
  } finally {
    // Every child this test caused, stopped by this test — not by the assertion
    // above happening to hold. A `startOnSafePort` that WRONGLY resolves leaves
    // a live child behind, and a live child keeps `node --test`'s event loop
    // open: measured, that turns this file from a 3-second failure into a
    // five-minute hang with no output. A harness that hangs on the broken case
    // is the failure mode this whole task exists to remove.
    await Promise.all(started.map((h) => h.stop()));
    removeTree(cwd);
  }
});

test('the ordinary path still returns a working, browser-openable child', async () => {
  const cwd = workspace();
  const h = await startUiChild(cwd);
  try {
    assert.equal(isChromeUnsafePort(h.port), false, `${h.port} must be a port Chrome will open`);
    assert.match(h.nonce, /^[0-9a-f]+$/, 'still parses the readiness line');
    const response = await fetch(`http://127.0.0.1:${h.port}/api/ping`);
    assert.equal(response.status, 401, 'a real server answered on that port');
  } finally { await h.stop(); removeTree(cwd); }
});
