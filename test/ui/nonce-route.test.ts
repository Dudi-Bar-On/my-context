/**
 * `POST /api/nonce` over real HTTP (owner ruling 2026-08-28,
 * `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 * out-the-next-one`).
 *
 * **What this file exists to prove that the shared unit tests in
 * `security.test.ts` cannot: that THIS ROUTE is held to it, not only that the
 * gate function is correct in isolation.** `validateApiRequest` already has a
 * full battery of Host/Origin/token tests; what is new here is the wiring —
 * that `/api/nonce` runs the same `gate` value `/api/handoff` runs, that a
 * mint is audited exactly once with no credential on disk, and that the
 * store it mints into is the SAME store `/api/handoff` redeems from, so a
 * nonce this route hands out is honoured exactly like one printed at startup.
 *
 * The harness spelling is `execute-route.test.ts`'s: an in-process
 * `startUiServer`, torn down per test so the audit-count assertions are never
 * looking at another test's rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Spawns a real UI server, which mints a session token; pins the store out of
// the developer's real `~/.my-context`. See the module.
import '../helpers/pin-sessions-dir.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-nonce-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture workspace failed to init');
  return dir;
}

interface Harness {
  cwd: string;
  server: RunningUiServer;
}

/**
 * One initialised workspace, one server — torn down whatever the body does.
 * Every test takes its own: the audit assertions count rows, and a shared log
 * would make each count depend on which tests ran before it.
 */
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

const base = (h: Harness): string => `http://127.0.0.1:${h.server.port}`;
const hostOf = (h: Harness): string => `127.0.0.1:${h.server.port}`;

interface MintBody { nonce: string }
interface TokenBody { token: string }

const mint = async (h: Harness, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${base(h)}/api/nonce`, { method: 'POST', headers });

const handoff = async (h: Harness, nonce: string): Promise<Response> =>
  fetch(`${base(h)}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });

/**
 * One raw HTTP/1.0 POST, because `Host` is a header `fetch` (and every
 * browser) refuses to let a caller set — the same reason `test/ui/helpers.ts`
 * built `rawGet` for the GET side of this exact gate.
 */
function rawPost(
  port: number, target: string, options: { host?: string | null } = {},
): Promise<{ status: number; body: string }> {
  const host = options.host === undefined ? `127.0.0.1:${port}` : options.host;
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `POST ${target} HTTP/1.0\r\n` +
        (host === null ? '' : `Host: ${host}\r\n`) +
        'Content-Length: 0\r\n\r\n',
      );
    });
    socket.setEncoding('utf8');
    let raw = '';
    socket.on('data', (chunk: string) => { raw += chunk; });
    socket.on('error', reject);
    socket.on('end', () => {
      const split = raw.indexOf('\r\n\r\n');
      const head = split === -1 ? raw : raw.slice(0, split);
      const bodyText = split === -1 ? '' : raw.slice(split + 4);
      const status = Number(head.match(/^HTTP\/1\.[01] (\d{3})/)?.[1] ?? 0);
      resolve({ status, body: bodyText });
    });
  });
}

const accessRecords = (cwd: string) =>
  readAudit(path.join(cwd, '.my_context')).filter((r) => r.kind === 'access');

test('a mint succeeds, and the nonce it hands out redeems exactly once via /api/handoff', async () => {
  await withServer(async (h) => {
    const minted = await mint(h);
    assert.equal(minted.status, 200, `mint answered ${minted.status}`);
    const { nonce } = (await minted.json()) as MintBody;
    assert.match(nonce, /^[0-9a-f]{32}$/, 'a nonce is 128 bits of hex, same shape as every other one');

    const first = await handoff(h, nonce);
    assert.equal(first.status, 200, 'the minted nonce must redeem for a token, exactly like a printed one');
    const { token } = (await first.json()) as TokenBody;
    assert.match(token, /^[0-9a-f]{64}$/);

    const second = await handoff(h, nonce);
    assert.equal(second.status, 403, 'a second redemption of the same minted nonce must fail — one-shot');
    assert.equal((await second.text()).length, 0, 'a refusal is a status line and nothing else');
  });
});

test('two mints from the same server hand out two different nonces', async () => {
  await withServer(async (h) => {
    const a = (await (await mint(h)).json()) as MintBody;
    const b = (await (await mint(h)).json()) as MintBody;
    assert.notEqual(a.nonce, b.nonce, 'a nonce a caller can predict from a previous mint is not a credential');
  });
});

test('a non-loopback Host is refused, and mints nothing', async () => {
  await withServer(async (h) => {
    const res = await rawPost(h.server.port, '/api/nonce', { host: 'evil.example:1234' });
    assert.equal(res.status, 403, 'this is the DNS-rebinding defence — it must hold on this route too');
    assert.equal(res.body.length, 0);
  });
});

test('a bad Origin is refused, and mints nothing', async () => {
  await withServer(async (h) => {
    const res = await mint(h, { origin: 'https://evil.example' });
    assert.equal(res.status, 403);
    assert.equal((await res.text()).length, 0);
  });
});

/**
 * `GET /api/nonce` is not a registered route AND is not the exempt branch —
 * that branch checks `req.method === 'POST'` explicitly — so a GET with no
 * token falls straight to the full gate and is refused there, the same as any
 * other unauthenticated GET. Nothing softer exists for it to hit.
 */
test('a GET never mints — this route is POST only', async () => {
  await withServer(async (h) => {
    const res = await fetch(`${base(h)}/api/nonce`);
    assert.equal(res.status, 401, 'no token was presented, and GET gets no exemption from needing one');
    assert.equal((await res.text()).length, 0);
    assert.equal(accessRecords(h.cwd).some((r) => r.op === 'nonce-minted'), false,
      'a GET must never produce a mint record');
  });
});

test('every mint is audited — kind access, op nonce-minted, and neither the nonce nor a token reaches disk', async () => {
  await withServer(async (h) => {
    const minted = await mint(h);
    const { nonce } = (await minted.json()) as MintBody;
    const token = (await (await handoff(h, nonce)).json()) as TokenBody;

    const records = accessRecords(h.cwd);
    assert.equal(records.length, 1, 'one mint, one record — the handoff redemption above audits nothing');
    const record = records[0]!;
    assert.equal(record.kind, 'access');
    assert.equal(record.op, 'nonce-minted');
    assert.deepEqual(record.nonceMint, { host: hostOf(h), origin: null });
    assert.equal(record.refusal, undefined, 'a mint record carries no refusal — the two ops are disjoint');
    const raw = JSON.stringify(record);
    assert.equal(raw.includes(nonce), false, 'the minted nonce must never reach the audit log');
    assert.equal(raw.includes(token.token), false, 'the token it later redeemed for must not reach it either');
  });
});

test('a mint carries the submitted Origin when the caller sent one, and null when it did not', async () => {
  await withServer(async (h) => {
    await mint(h, { origin: `http://${hostOf(h)}` });
    const record = accessRecords(h.cwd)[0]!;
    assert.equal(record.nonceMint?.origin, `http://${hostOf(h)}`, 'a same-origin Origin is recorded as submitted');
  });
});

test('security headers are sent on the mint response, same as every other response', async () => {
  await withServer(async (h) => {
    const res = await mint(h);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('access-control-allow-origin'), null, 'no CORS headers, same as everywhere');
  });
});
