/**
 * The parts of `startUiServer` a spawned child cannot show you.
 *
 * `server-e2e.test.ts` is the contract test and it spawns a real process,
 * because that is what a browser talks to. Four properties are invisible from
 * out there and are proved in-process instead:
 *
 *   - **A stream route is not activity** (spec §2). Plan 3's
 *     `/api/watch/stream` has since landed and is the only stream route this
 *     project will have, but it is still proved here against the local
 *     `/api/test-hold` below: the property belongs to the DISPATCH LOOP, not
 *     to any one handler, and measuring it against a route that reads a real
 *     audit log would make an idle-window measurement depend on that log.
 *   - **A handler that throws answers 500** — and one that throws *after*
 *     writing tears the connection down instead of throwing a second time from
 *     inside the catch that was meant to rescue it.
 *   - **`close()` resolves, and reports `closed`.**
 *   - **Each `urlWithNonce` is a different one-shot nonce.**
 *
 * Routes registered here land in the table `routes.ts` owns, which is
 * process-global. That is safe exactly because `node --test` runs each FILE in
 * its own process — a fact this file depends on and therefore states.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { registerRoute } from '../../src/ui/routes.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-srv-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

/** The token, taken the way the page takes it: mint a nonce, redeem it once. */
async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

registerRoute('GET', '/api/test-hold', {
  kind: 'stream',
  handle: (_ctx, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(': open\n\n');   // headers and a byte, and deliberately no end()
  },
});
registerRoute('GET', '/api/test-boom', {
  kind: 'json',
  handle: () => { throw new Error('boom from a json handler'); },
});
registerRoute('GET', '/api/test-boom-stream', {
  kind: 'stream',
  handle: (_ctx, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.write('partial');
    throw new Error('boom after the headers went out');
  },
});

/**
 * An open stream never resets the idle timer (spec §2), which is what stops a
 * forgotten tab turning the ephemeral server into the daemon §3 exists to
 * prevent.
 *
 * Measured rather than asserted in prose, and measured against its own control:
 * two servers with the same one-second window, each sent one request at 900ms,
 * one to a stream route and one to a JSON route. If the stream touched the
 * monitor its server would outlive the other's expiry; the control is what says
 * the instrument can tell those apart, so a green line here is not "both exited
 * eventually".
 */
test('an open stream is not activity; a json request is', async () => {
  const cwd = project();
  const IDLE = 1_000;
  const measure = async (route: string): Promise<number> => {
    const started = Date.now();
    let exitedAt = 0;
    const server = await startUiServer({
      cwd, idleMs: IDLE, onExit: (reason) => { if (reason === 'idle') exitedAt = Date.now(); },
    });
    const token = await tokenFor(server);
    await new Promise((r) => setTimeout(r, 900));
    const response = await fetch(`http://127.0.0.1:${server.port}${route}`, {
      headers: { [TOKEN_HEADER]: token },
    });
    assert.equal(response.status, 200, route);
    void response.body?.cancel().catch(() => { /* the server tears this down itself */ });
    while (exitedAt === 0 && Date.now() - started < 5_000) {
      await new Promise((r) => setTimeout(r, 20));
    }
    await server.close();
    assert.ok(exitedAt > 0, `${route}: the server never idled out`);
    return exitedAt - started;
  };

  try {
    const [stream, json] = await Promise.all([measure('/api/test-hold'), measure('/api/ping')]);
    assert.ok(stream < IDLE + 500,
      `a stream request pushed the idle window out: exited after ${stream}ms, and a window that `
      + `was never touched expires at ${IDLE}ms`);
    assert.ok(json >= IDLE + 800,
      `the control failed: a /api/ping at 900ms must delay the exit to about ${IDLE + 900}ms, `
      + `and this server exited after ${json}ms — so this test cannot tell a touch from no touch`);
  } finally { removeTree(cwd); }
});

test('a handler that throws answers 500; one that throws after writing tears the connection down', async () => {
  const cwd = project();
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    const token = await tokenFor(server);
    const get = (route: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${server.port}${route}`, { headers: { [TOKEN_HEADER]: token } });

    const boom = await get('/api/test-boom');
    assert.equal(boom.status, 500);
    assert.deepEqual(await boom.json(), { error: 'boom from a json handler' });
    assert.equal(boom.headers.get('x-content-type-options'), 'nosniff');

    // Headers are already on the wire, so there is no status left to send. A
    // second `writeHead` would throw from inside the catch that exists to
    // rescue this, and the request would hang until the client gave up; the
    // connection is destroyed instead, which the client sees as the truncation
    // it is.
    const truncated = await get('/api/test-boom-stream');
    assert.equal(truncated.status, 200);
    await assert.rejects(() => truncated.text(), 'a torn-down response must not read as complete');

    // …and the server is still serving. A handler that threw must not take the
    // process with it.
    assert.equal((await get('/api/ping')).status, 200);
  } finally { await server.close(); removeTree(cwd); }
});

test('close() resolves, reports `closed`, and the port stops answering', async () => {
  const cwd = project();
  const reasons: string[] = [];
  const server = await startUiServer({ cwd, idleMs: 60_000, onExit: (r) => reasons.push(r) });
  try {
    assert.ok(server.port > 0);
    assert.equal((await fetch(`http://127.0.0.1:${server.port}/`)).status, 200);
    await server.close();
    assert.deepEqual(reasons, ['closed']);
    await assert.rejects(() => fetch(`http://127.0.0.1:${server.port}/`));
  } finally { removeTree(cwd); }
});

test('every urlWithNonce is a different one-shot nonce, on this server`s own port', async () => {
  const cwd = project();
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    const first = new URL(server.urlWithNonce(10_000));
    const second = new URL(server.urlWithNonce(10_000));
    assert.equal(first.port, String(server.port));
    assert.equal(first.protocol, 'http:');
    assert.equal(first.hostname, '127.0.0.1');
    assert.notEqual(first.hash, second.hash, 'two calls handed out the same nonce');
    assert.match(first.hash, /^#[0-9a-f]{32}$/);

    const redeem = (hash: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nonce: hash.slice(1) }),
      });
    assert.equal((await redeem(second.hash)).status, 200);
    assert.equal((await redeem(second.hash)).status, 403, 'a nonce redeemed twice');
    // …and the OTHER nonce is untouched: they are independent, not a single
    // slot the newest mint overwrites.
    assert.equal((await redeem(first.hash)).status, 200);
  } finally { await server.close(); removeTree(cwd); }
});

test('a bind beyond loopback is refused, and refused as a REJECTION', async () => {
  const cwd = project();
  try {
    // A rejection rather than a throw is the property: the entry point prints
    // `err.message` from a `.catch`, and a synchronous throw would skip it.
    const attempt = startUiServer({ cwd, host: '0.0.0.0' });
    assert.ok(attempt instanceof Promise);
    await assert.rejects(attempt, /refusing to bind 0\.0\.0\.0/);
    await assert.rejects(startUiServer({ cwd, host: 'localhost' }), /refusing to bind localhost/);
    await assert.rejects(startUiServer({ cwd, idleMs: Number.NaN }), /idle window/);
  } finally { removeTree(cwd); }
});
