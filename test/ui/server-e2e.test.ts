/**
 * Endpoints tested as the MCP server is: spawn a real process, make real
 * requests (spec §6). Security assertions are first-class here.
 *
 * A limit stated rather than papered over (spec §6): these tests exercise every
 * /api contract and the security gate; the browser-side RENDERING has no test
 * here, because testing it needs a browser. `e2e/` drives one with Playwright —
 * against the mockup, which is the design of record — and `src/ui/public/` holds
 * a placeholder shell until Task 16. A green run here must not be read as pixels
 * verified.
 *
 * This file also carries the RUNTIME half of the no-writes enforcement (owner
 * ruling 2026-08-20, plan §0.5): `the read surface changes not one byte of the
 * corpus` below. Task 14's static test proves which write symbols `src/ui/`
 * BINDS; it cannot prove that no route WRITES, because a core read that writes
 * internally leaves no import line to look at — and that class is real here
 * (`Store.open` self-heals by `rmSync`-ing the database and both journals). Only
 * running the routes and comparing bytes answers the invariant the spec states.
 *
 * THE SCOPE OF THAT ASSERTION, because it is a boundary and not a footnote
 * (owner ruling B4, 2026-08-20, plan §0.6). The read surface performs exactly
 * one write, on the REFUSAL path: a refused request is recorded in the audit log
 * with the check that refused and the submitted Host/Origin. The sweep below
 * makes only AUTHORISED requests — it fails on any status that is not 200 or
 * 404, which is what keeps a refusal out of it — so `.audit/` stays INSIDE the
 * snapshot. Excluding it would be the one edit that lets a served read write an
 * audit record unnoticed. The refusal write is proved, and bounded, by `a
 * refused request is recorded, and it is the only write` below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, recordAudit } from '../../src/core/audit.ts';
import { HELP_TOPICS } from '../../src/core/teach.ts';
import { DIR_NAME } from '../../src/core/workspace.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { CREDENTIAL_COOKIE, TOKEN_COOKIE, TOKEN_HEADER } from '../../src/ui/security.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { rawGet, redeemNonce, runUiChild, startUiChild, type UiHarness } from './helpers.ts';

/**
 * A real corpus, built through the real CLI. Every command's exit code is
 * checked: a fixture that half-built itself turns the no-write sweep below into
 * an assertion over an empty corpus, which passes and measures nothing.
 */
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-e2e-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', '--summary-omitted', 'rule', 'Pin me', '--body', 'Pinned body, long enough to cost real tokens. '.repeat(10), '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  return dir;
}

async function api(
  h: UiHarness, token: string, pathname: string, headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`http://127.0.0.1:${h.port}${pathname}`, {
    headers: { [TOKEN_HEADER]: token, ...headers },
  });
}

/**
 * Spec §2's response-header table, which the plan's Task 13 sample set only one
 * quarter of. Asserted on every kind of response this server sends, because
 * "on every response including the static assets" is the requirement and a
 * header set on the JSON path only would satisfy any test that looked at JSON.
 */
function assertSecurityHeaders(response: Response, what: string): void {
  // **The CSP is asserted ABSENT, on purpose.**
  //
  // Spec §2 specifies one; the owner retired it on 2026-08-22 and
  // `security.ts` records why at length. Asserting the absence is what keeps
  // that a decision rather than a drift: a CSP reappearing without anyone
  // choosing it fails here, and so does one silently vanishing again if it is
  // ever restored. `INV-nothing-is-dropped-silently` applies to a header the
  // same as to an item.
  assert.equal(
    response.headers.get('content-security-policy'), null,
    `${what}: the CSP is retired (see security.ts). Re-adding it is a deliberate
     act — update this assertion in the same commit that sends the header.`,
  );
  // Stands in for the retired `frame-ancestors 'none'`: the framing half of
  // the DNS-rebinding defence for a loopback server holding a private corpus.
  assert.equal(response.headers.get('x-frame-options'), 'DENY', what);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', what);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer', what);
  assert.equal(response.headers.get('cache-control'), 'no-store', what);
}

test('handoff → token → authenticated read; the nonce is one-shot', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    await assert.rejects(() => redeemNonce(h.port, h.nonce)); // second use refused (spec §6)

    const ok = await api(h, token, '/api/select?event=session-start&cold=1');
    assert.equal(ok.status, 200);
    const body = await ok.json() as { full: unknown[]; index: unknown; spilled: unknown[] };
    assert.ok(Array.isArray(body.full));
  } finally { await h.stop(); removeTree(cwd); }
});

test('wrong token 403, missing header 401, bad Origin 403 — and no CORS headers anywhere', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);

    const wrong = await api(h, 'f'.repeat(64), '/api/ping');
    assert.equal(wrong.status, 403);

    const missing = await fetch(`http://127.0.0.1:${h.port}/api/ping`);
    assert.equal(missing.status, 401);

    const badOrigin = await api(h, token, '/api/ping', { origin: 'https://evil.example' });
    assert.equal(badOrigin.status, 403);

    // Owner ruling A4: a refusal is a STATUS AND NOTHING ELSE. Asserted on all
    // three, because the property is that no refusing exit has a body — not
    // that one of them happens not to. A `reason` that cannot be sent cannot
    // be rendered by a later task that decides refusals should be friendlier.
    for (const refused of [wrong, missing, badOrigin]) {
      const body = await refused.text();
      assert.equal(body.length, 0, `a refusal must carry no body at all; got ${body.length} bytes`);
      assert.equal(refused.headers.get('content-type'), null, 'no content, so no content-type');
      assertSecurityHeaders(refused, 'a refusal');
    }

    const good = await api(h, token, '/api/ping');
    assert.equal(good.status, 200);
    assert.equal(good.headers.get('access-control-allow-origin'), null);
    assert.equal(good.headers.get('access-control-allow-credentials'), null);
    assertSecurityHeaders(good, '/api/ping');
    // By shape, not by value — see `test/ui/open.test.ts` for why `staleCode`
    // is not pinned here: this test is about headers and refusals, and the
    // fields it gained are measured against trees the suite does not own.
    //
    // `corpus` is the out-of-band-edit disclosure (`plan:live seq:4`), and its
    // value is deliberately not pinned for the same reason plus one of its own:
    // it reports whether anything under `items/` is newer than the audit log,
    // and this suite's fixtures are written by the suite itself moments before
    // the request. The CONTRACT is that the field is present and can say "not
    // known" — `test/ui/corpus-drift.test.ts` is where the three states are
    // held apart.
    // `occupancy` (`plan:walk seq:124`) is the context-window reading, and it
    // is the one field here that is SESSION-SCOPED: this request names no
    // session, so `null` is the whole contract — "nobody asked", which is not
    // any of the four `UnmeasurableWhy` reasons and must not be reported as
    // one. That it is present and null with no session, and a reading with one,
    // is held apart in `test/ui/context-live.test.ts`.
    const body = await good.json() as {
      ok: boolean; staleCode: boolean; corpus: { drifted: boolean | null }; occupancy: unknown;
    };
    assert.deepEqual(Object.keys(body).sort(), ['corpus', 'occupancy', 'ok', 'staleCode']);
    assert.equal(body.ok, true);
    assert.equal(typeof body.staleCode, 'boolean');
    assert.ok(
      body.corpus.drifted === null || typeof body.corpus.drifted === 'boolean',
      'the heartbeat must always carry a corpus finding, even when it is "not known"',
    );
    assert.equal(body.occupancy, null, 'a ping that names no session asked nothing');
  } finally { await h.stop(); removeTree(cwd); }
});

/**
 * **A STALE token must not lock a page out of `/api/handoff`.**
 *
 * This test used to assert the opposite — that a wrong token is refused here
 * and only a missing one is exempt — and the reasoning was that a page
 * presenting a wrong token is not the case the exemption exists for.
 *
 * **That reasoning did not survive the token being kept in a cookie**, and it
 * locked a real browser out of a real server on 2026-08-23. Cookies are scoped
 * to a HOST, not to a port: `127.0.0.1:58901`'s `mycontext_token` is sent to
 * `127.0.0.1:58902`, and the next `mycontext ui` mints a different token. The
 * gate reads `header ?? cookie`, so a fresh page arriving with a VALID NONCE
 * and a stale cookie presented a mismatched token and was refused 403 — and
 * could never obtain a good one, because the cookie is `HttpOnly` and the page
 * cannot clear it. The only cure was clearing cookies by hand.
 *
 * Exempting the mismatch costs nothing, because **the nonce is the credential
 * on this route** and always was: a caller who cannot present an unspent nonce
 * is refused whatever token it holds, and a caller who can has proven exactly
 * what this route asks. The token it happened to be carrying is not evidence
 * about either question. The 200 also overwrites the cookie, which is how the
 * stale one is cleared.
 *
 * The refusals that are NOT about the token are asserted below to still refuse,
 * because widening an exemption is the kind of edit that quietly widens two.
 */
test('a stale or wrong token does not lock a page out of /api/handoff', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    // A stale cookie, exactly as a browser sends after the server restarted on
    // another port. This answered 403 before the fix.
    const viaCookie = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${TOKEN_COOKIE}=${'b'.repeat(64)}`,
      },
      body: JSON.stringify({ nonce: h.nonce }),
    });
    assert.equal(viaCookie.status, 200,
      'a stale token cookie must not stop a valid nonce being redeemed — it is how a ' +
      'restarted server locked the browser out permanently');
    const token = ((await viaCookie.json()) as { token: string }).token;
    assert.equal(typeof token, 'string');
    // The response must REPLACE the stale cookie, or the next request carries
    // it again and nothing has been fixed.
    const setCookie = viaCookie.headers.get('set-cookie') ?? '';
    assert.match(setCookie, new RegExp(`${TOKEN_COOKIE}=${token}`),
      'the handoff must overwrite the stale cookie with the token it just issued');
  } finally { await h.stop(); removeTree(cwd); }
});

/**
 * **The handoff sets a SECOND cookie, and it is a marker rather than a
 * credential** (`plan:walk seq:85`, 2026-08-29).
 *
 * The defect it closes is measured on the browser side: the token cookie is
 * `HttpOnly`, so a page that arrived with no fragment and no `sessionStorage`
 * could not tell "I hold a cookie credential" from "I hold nothing" without
 * making a request and being refused — and the shell makes ten on boot, each
 * one an audit WRITE. 5,207 of `.demo-corpus`'s 6,156 records were that.
 *
 * Four claims, and the last two are the ones that keep this a marker:
 * it names the ISSUING PORT (the token cookie is host-scoped and shared with
 * every other `mycontext ui` on 127.0.0.1, so "a cookie exists" is not the
 * same question as "a cookie for THIS server exists"); it is readable by
 * script while the token beside it is not; it is not accepted as a credential
 * by the gate; and a refusal that expires the token cookie expires this one
 * in the same response, so the page can never be left believing in a
 * credential the browser has thrown away.
 */
test('the handoff sets a readable credential MARKER beside the HttpOnly token cookie', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const handoff = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce: h.nonce }),
    });
    assert.equal(handoff.status, 200);
    const token = ((await handoff.json()) as { token: string }).token;
    const cookies = handoff.headers.getSetCookie();

    const tokenCookie = cookies.find((c) => c.startsWith(`${TOKEN_COOKIE}=`));
    const marker = cookies.find((c) => c.startsWith(`${CREDENTIAL_COOKIE}=`));
    assert.ok(tokenCookie !== undefined, 'the handoff must still set the token cookie');
    assert.ok(marker !== undefined,
      'the handoff must set the credential marker — without it a page with only a cookie has ' +
      'no way to know it has one, and finds out by being refused nine times');

    // Claim 1: it names the issuing port, not merely "yes".
    assert.equal(marker.split(';')[0], `${CREDENTIAL_COOKIE}=${h.port}`,
      'the marker must carry the port that issued the token, because cookies are host-scoped ' +
      'and every mycontext ui on 127.0.0.1 overwrites the same token cookie');

    // Claim 2: readable by script — which is the whole point — while the
    // credential beside it stays out of reach. Asserted in BOTH directions,
    // because a marker that became HttpOnly would silently restore the defect
    // and a token that lost it would be a real regression.
    assert.equal(/HttpOnly/i.test(marker), false,
      'the marker must NOT be HttpOnly: being readable is the one thing it exists to do');
    assert.equal(/HttpOnly/i.test(tokenCookie), true,
      'the TOKEN cookie must stay HttpOnly — the marker exists so that never has to change');
    assert.match(marker, /SameSite=Strict/i);
    assert.match(marker, /Path=\//);
    // And it is not the token in another wrapper.
    assert.equal(marker.includes(token), false,
      'the marker must not carry the token, in any form — it is a flag beside the credential');

    // Claim 3: the gate does not accept it. A caller holding only the marker
    // holds nothing, and must be refused exactly as one holding nothing is.
    const markerOnly = await fetch(`http://127.0.0.1:${h.port}/api/status`, {
      headers: { cookie: `${CREDENTIAL_COOKIE}=${h.port}` },
    });
    assert.equal(markerOnly.status, 401,
      'the marker must never authenticate anything — it is a hint to the page, not a key');

    // Claim 4: expired together. A cookie-only wrong token is the refusal that
    // clears the stale token cookie; the marker pointing at it must go too.
    const mismatch = await fetch(`http://127.0.0.1:${h.port}/api/status`, {
      headers: { cookie: `${TOKEN_COOKIE}=${'b'.repeat(64)}; ${CREDENTIAL_COOKIE}=${h.port}` },
    });
    assert.equal(mismatch.status, 403);
    const cleared = mismatch.headers.getSetCookie();
    assert.ok(cleared.some((c) => c.startsWith(`${TOKEN_COOKIE}=;`)),
      'a stale token cookie must still be expired by the refusal path');
    assert.ok(cleared.some((c) => c.startsWith(`${CREDENTIAL_COOKIE}=;`)),
      'the marker must be expired in the SAME response as the token it points at, or the page ' +
      'goes on believing it holds a credential the browser has just thrown away');
  } finally { await h.stop(); removeTree(cwd); }
});

test('widening the token exemption did not widen the others: Origin and nonce still refuse', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const badOrigin = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ nonce: h.nonce }),
    });
    assert.equal(badOrigin.status, 403, 'a cross-origin handoff must still be refused');
    assert.equal((await badOrigin.text()).length, 0);

    const badNonce = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce: 'deadbeef' }),
    });
    assert.equal(badNonce.status, 403, 'a wrong nonce must still be refused');

    // Neither refusal spent the real nonce, so it is still redeemable — and
    // then one-shot, as before.
    assert.equal(typeof await redeemNonce(h.port, h.nonce), 'string');
    const replay = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce: h.nonce }),
    });
    assert.equal(replay.status, 403, 'the nonce must remain one-shot');
  } finally { await h.stop(); removeTree(cwd); }
});

test('a malformed or replayed handoff body is refused with a status and no body', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    for (const body of ['not json at all', '{}', JSON.stringify({ nonce: 42 }), JSON.stringify({ nonce: 'deadbeef' })]) {
      const response = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      });
      assert.equal(response.status, 403, `handoff body ${body}`);
      const text = await response.text();
      assert.equal(text.length, 0, `handoff refusal carried ${text.length} bytes`);
    }
    assert.equal(typeof await redeemNonce(h.port, h.nonce), 'string');
  } finally { await h.stop(); removeTree(cwd); }
});

test('an expired nonce is refused after its window', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--nonce-ttl-ms', '50']);
  try {
    await new Promise((r) => setTimeout(r, 200));
    await assert.rejects(() => redeemNonce(h.port, h.nonce));
  } finally { await h.stop(); removeTree(cwd); }
});

test('the page and static assets serve without a token; /api/meta carries git info', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const page = await fetch(`http://127.0.0.1:${h.port}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    // Task 12 shipped `serveStatic` with no `Cache-Control` and said so: the
    // interface hands it to the caller and nothing tested it. This is the
    // caller, and this is the test.
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assertSecurityHeaders(page, 'the page');
    assert.match(await page.text(), /<title>mycontext Console<\/title>/);

    const css = await fetch(`http://127.0.0.1:${h.port}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') ?? '', /text\/css/);
    assertSecurityHeaders(css, 'the stylesheet');

    // Reported rather than fixed (plan Task 16's call): `.ico` is not in
    // `static.ts`'s content-type table and no favicon exists, so every browser
    // that opens this page logs one 404 it did not ask for.
    const favicon = await fetch(`http://127.0.0.1:${h.port}/favicon.ico`);
    assert.equal(favicon.status, 404);
    assert.equal((await favicon.text()).length, 0);

    const token = await redeemNonce(h.port, h.nonce);
    const meta = await api(h, token, '/api/meta');
    const body = await meta.json() as { version: string; projectRoot: string; repoRoot: string; git: unknown };
    assert.equal(typeof body.version, 'string');
    assert.equal(body.projectRoot, path.join(cwd, DIR_NAME));
    assert.equal(body.repoRoot, cwd);
    assert.ok('git' in body); // null in a tmpdir with no .git — present either way
  } finally { await h.stop(); removeTree(cwd); }
});

test('an unmatched /api path is a 404 that echoes nothing back', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    const marker = 'canary-9f3a2b';
    const response = await api(h, token, `/api/${marker}?q=${marker}`);
    assert.equal(response.status, 404);
    const body = await response.text();
    // The sender already knows what it sent, so the echo buys nothing — and it
    // is unbounded caller-supplied text, which is the reason ruling 11 took the
    // submitted value out of the gate's reasons in the first place.
    assert.ok(!body.includes(marker),
      `the 404 body echoed the submitted path back: ${body.slice(0, 200)}`);
    assert.deepEqual(JSON.parse(body), { error: 'no route matched this request' });
  } finally { await h.stop(); removeTree(cwd); }
});

test('an oversized POST body is cut off, and the server keeps serving', async () => {
  // The cap DESTROYS the request rather than only rejecting the promise that
  // reads it: a rejection settles the read and leaves the socket streaming, so
  // an unbounded body would go on arriving into a buffer nobody will read.
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce: 'x'.repeat(512 * 1024) }),
    }).catch(() => { /* a destroyed request has no response; that is the point */ });

    const token = await redeemNonce(h.port, h.nonce);
    assert.equal((await api(h, token, '/api/ping')).status, 200,
      'the server stopped serving after an oversized body');
  } finally { await h.stop(); removeTree(cwd); }
});

/**
 * The traversal cases **no browser can produce**, sent as bytes on a socket.
 *
 * A WHATWG URL resolves `%2e%2e` before the request leaves the client, so
 * `fetch` and every browser normalise these away; that is exactly why the
 * server may not rely on the client for them. Two independent things refuse
 * here and the test says which is which: the server's own `new URL()` collapses
 * the dot spellings, and `serveStatic` refuses what survives — `..%2f`, whose
 * encoded SLASH is not a path separator to the URL parser and so reaches the
 * module intact.
 */
test('traversal is refused on the wire, including the spellings a browser rewrites', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const targets = [
      '/%2e%2e/%2e%2e/package.json',
      '/%2E%2E/%2E%2E/package.json',
      '/.%2e/.%2e/package.json',
      '/..%2f..%2fpackage.json',
      '/../../package.json',
      '/..\\..\\package.json',
      '/sub%5cmod.js',
      '/%2e%2e/%2e%2e/src/ui/server.ts',
      '/styles.css::$DATA',
      '/styles.css.',
      '/%00',
    ];
    for (const target of targets) {
      const response = await rawGet(h.port, target);
      // A boolean and a size, never the served bytes: an assertion that hands
      // node:test a whole leaked file prints megabytes and can OOM before it
      // says which target leaked.
      assert.equal(
        response.status, 404,
        `${target} answered ${response.status} with ${response.body.length} bytes — it must not serve`,
      );
      assert.equal(response.body.length, 0, `${target} answered with a body`);
    }
    // The control: the same instrument serves the one path that is an asset,
    // so a green run above is not "every raw request 404s".
    const ok = await rawGet(h.port, '/index.html');
    assert.equal(ok.status, 200, ok.head);
    assert.match(ok.body, /mycontext Console/);
  } finally { await h.stop(); removeTree(cwd); }
});

test('idle: with no /api request for the window, the process exits on its own', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--idle-ms', '300']);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    assert.equal((await api(h, token, '/api/ping')).status, 200);
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000);
      h.child.once('exit', () => { clearTimeout(timer); resolve(true); });
    });
    assert.equal(exited, true, `server did not exit after its idle window: ${h.output()}`);
  } finally { await h.stop(); removeTree(cwd); }
});

test('non-loopback bind is refused at startup, not warned about', async () => {
  const cwd = project();
  try {
    await assert.rejects(() => startUiChild(cwd, ['--host', '0.0.0.0']));
    // …and it SAYS so. A refusal that exits 1 in silence is indistinguishable
    // from a crash, which is how a broken harness reads as a passing test.
    const run = await runUiChild(cwd, ['--port', '0', '--host', '0.0.0.0']);
    assert.equal(run.code, 1);
    assert.match(run.stderr, /refusing to bind 0\.0\.0\.0/);
    assert.equal(run.stdout, '', 'a server that refused to start printed a URL');
  } finally { removeTree(cwd); }
});

/**
 * A command line that cannot mean what it says must refuse to start.
 *
 * `INV-nothing-is-dropped-silently` in the medium that hides it best: every one
 * of these, under the obvious `argv.indexOf` parser, produces a server that
 * runs happily with settings nobody asked for. `--idle-ms=300` is the sharpest
 * — a test written that way does not fail, it keeps production's fifteen-minute
 * window and hangs until the runner gives up.
 */
test('a command line that would be silently misread refuses to start, and says why', async () => {
  const cwd = project();
  try {
    const cases: { args: string[]; expect: RegExp }[] = [
      { args: ['--idle-ms=300'], expect: /unknown argument "--idle-ms=300"/ },
      { args: ['--pory', '0'], expect: /unknown argument "--pory"/ },
      { args: ['--port'], expect: /--port needs a value/ },
      { args: ['--port', '0', '--port', '1'], expect: /--port was given twice/ },
      { args: ['--port', 'abc'], expect: /--port must be a whole number/ },
      { args: ['--nonce-ttl-ms', 'abc'], expect: /--nonce-ttl-ms must be a whole number/ },
      // Refused by `IdleMonitor`'s constructor, whose message is written to be
      // the whole user-facing message — reached only because `startUiServer`
      // never throws synchronously. A sync throw here would skip the entry
      // point's catch and print a stack instead of this line.
      { args: ['--idle-ms', 'abc'], expect: /idle window must be a positive, finite number/ },
      { args: ['--idle-ms', '0'], expect: /idle window must be a positive, finite number/ },
      { args: ['--idle-ms', '1.5'], expect: /idle window must be a positive whole number/ },
    ];
    for (const { args, expect } of cases) {
      const run = await runUiChild(cwd, args);
      assert.equal(run.code, 1, `${args.join(' ')} exited ${run.code}: ${run.stdout}${run.stderr}`);
      assert.match(run.stderr, expect, args.join(' '));
      assert.doesNotMatch(run.stderr, /at .*server\.ts:\d+/, 'a bad flag printed a stack trace');
      assert.equal(run.stdout, '', `${args.join(' ')} started a server anyway`);
    }
  } finally { removeTree(cwd); }
});

test('a directory with no workspace refuses to start', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-bare-'));
  try {
    const run = await runUiChild(dir, ['--port', '0']);
    assert.equal(run.code, 1);
    assert.match(run.stderr, /no workspace here/);
  } finally { removeTree(dir); }
});

// --- The runtime half of the no-writes enforcement (§0.5) -------------------

/**
 * Every read route this plan registers, with concrete parameters. **Plans 2 and
 * 3 append theirs here.** A route missing from this list is a route this
 * assertion does not cover — and that is no longer a promise: `every registered
 * read route is in the sweep` below compares this list against the route table
 * itself and fails on a route nobody added, which is what `registeredRoutes()`
 * exists for.
 *
 * `/api/help` is generated from `HELP_TOPICS` rather than typed out, and the id
 * and session come from the corpus at run time. `:id` and `:session` are each
 * probed twice, once with a value that exists and once with one that does not,
 * because "the file is not there" is the case that tempts a read into creating
 * it.
 */
/**
 * A probe: a GET path, a POST path together with the body it must carry, or a
 * STREAM path that is read to its first frame and then abandoned.
 *
 * The POST shape exists because plan 2 registers `POST /api/overlap`, which
 * reads the store and writes nothing (spec §2: no POST changes state on disk).
 * Probing it with a GET would answer 404 before ever reaching the handler —
 * enough to satisfy the coverage comparison below and to prove nothing at all
 * about the route, which is exactly the hollow probe this list is guarded
 * against. `templateMatches` compares paths only, so a POST route needs a
 * probe that actually sends a POST or the sweep silently stops covering it.
 *
 * The stream shape exists for the same reason one level up. Plan 3 registers
 * `GET /api/watch/stream`, the table's only `kind: 'stream'` route, and it is
 * DELIBERATELY never closed by the server: `await response.arrayBuffer()`
 * below would wait for an end that only the idle exit or the client can
 * produce, and hang the file until the runner's timeout. So a stream probe is
 * read to its first SSE frame — which is what proves the handler ran rather
 * than merely matched — and then aborted, which destroys the socket and fires
 * the handler's own `close` listener.
 */
type Probe =
  | string
  | { path: string; method: 'POST'; body: unknown }
  | { path: string; kind: 'stream' };

const probePath = (probe: Probe): string => (typeof probe === 'string' ? probe : probe.path);

const READ_ROUTES = (from: { item: string; session: string | null }): Probe[] => [
  '/api/ping',
  '/api/meta',
  '/api/select?event=session-start&cold=1',
  '/api/select?event=tool&path=src/index.ts&cold=1',
  '/api/render?event=session-start&cold=1',
  '/api/simulate?event=session-start&cold=1&pinned=100',
  // `plan:walk seq:7`'s sweep. `tier=pinned` runs at `session-start`, so this
  // probe walks the real threshold loop; `tier=jit` does not run there, so
  // the second probe exercises the absent-tier 200 rather than a 400.
  '/api/simulate/sweep?event=session-start&cold=1&tier=pinned',
  '/api/simulate/sweep?event=session-start&cold=1&tier=jit',
  // The preview's When column. It opens the audit PROJECTION rather than the
  // index — the one route on this list that does — so its presence here is what
  // proves that door is read-only too, and not only the two `Store` doors the
  // rest of the sweep exercises.
  '/api/injection-history',
  '/api/sessions',
  '/api/status',
  '/api/doctor',
  '/api/decay',
  '/api/decay?window=30',
  '/api/coverage',
  // NOT a bare `/api/graph`, which is what the plan's own list says: an ego
  // graph is drawn around one item and Task 11 refuses the parameterless form
  // with a 400. A 400 is not a refusal and writes nothing, but it is also not a
  // route that ran — so the sweep would be measuring a rejected query string
  // rather than a read. The missing-item probe keeps the "the file is not
  // there" case this list wants.
  '/api/graph?focus=RULE-no-such-item',
  `/api/graph?focus=${encodeURIComponent(from.item)}&radius=2`,
  '/api/items',
  // The focus dialog's tag vocabulary. It takes no parameters and answers 200
  // over any corpus — including one with no tags at all, where `free` and every
  // group's `options` are empty and the declared prefixes still appear, which
  // is the state this sweep runs it in.
  '/api/tags',
  // Plan 2, Task 3's Work read model. Both take no parameters, so the probe is
  // the bare path; both answer 200 over any corpus, including one with an empty
  // revision log and no drafts.
  '/api/revisions',
  '/api/review-queue',
  `/api/item/${encodeURIComponent(from.item)}`,
  '/api/item/RULE-no-such-item',
  // The item pane's twelve-week delivery sparkline. Probed on a REAL id and on
  // an unknown one, because the two exercise different halves: a known id runs
  // the projection query, and an unknown one must still answer rather than
  // 404 — an item with no delivery history is a legitimate answer of twelve
  // empty buckets, not a missing route.
  `/api/item/${encodeURIComponent(from.item)}/history`,
  '/api/item/RULE-no-such-item/history',
  ...(from.session === null ? [] : [`/api/session/${encodeURIComponent(from.session)}/injected`]),
  '/api/session/never-seen-session/injected',
  ...HELP_TOPICS.map((topic) => `/api/help/${topic}`),
  // Plan 2's Work read model. `search` and `glob` are probed with parameters
  // that actually MATCH — a refused or empty query is a route that did not
  // run — and `search` is probed a second time on a filter that matches
  // nothing, because "no result" is the case that tempts a read into creating
  // something to return.
  '/api/search?text=pinned',
  '/api/search?text=nothing-in-this-corpus-matches-this',
  `/api/search?path=${encodeURIComponent('src/index.ts')}`,
  '/api/glob?pattern=src/**',
  '/api/glob?pattern=no-such-directory/**',
  // A draft that overlaps the fixture's own item, so the handler actually
  // scores and returns something rather than short-circuiting on an empty
  // corpus read.
  { path: '/api/overlap', method: 'POST', body: { title: 'Pin me', body: 'Pinned body.' } },
  // Plan 2's Configure read model. `/api/config` re-reads `config.json` from
  // disk on every call, which is the probe that matters here: a screen that
  // reads a file the deny hook protects must leave it byte-identical, and this
  // sweep is what says it does. `check` is given a candidate that actually
  // RESOLVES, so the probe runs the loader rather than bouncing off a
  // malformed body — and it is sent as a POST, because a GET against a POST
  // route 404s before the handler and proves nothing.
  '/api/config',
  { path: '/api/config/check', method: 'POST', body: { candidate: { budgets: { jit: 100 } } } },
  // The preview runs the REAL selector and the real injection verdicts under a
  // candidate config, so it touches more of the corpus than any other probe in
  // this list — and it takes the select grammar in the query string, so it is
  // probed with a context that actually resolves rather than one that 400s.
  {
    path: '/api/config/preview?event=session-start&cold=1',
    method: 'POST',
    body: { candidate: { categories: { rule: { scopePolicy: 'inert' } } } },
  },
  // Plan 3's Watch read model. All three JSON routes read the AUDIT
  // PROJECTION, and this fixture has never built one — which is the case that
  // matters most here: the plan routed them through `openProjection` +
  // `syncProjection`, and `openProjection` alone would have CREATED
  // `.audit/audit.db` from a GET, which the byte-identical assertion below
  // catches as the write it is. They go through
  // `openProjectionReadOnlyChecked` instead and answer the `absent` state, so
  // these probes prove both halves at once: the route ran, and it left nothing
  // behind.
  '/api/watch/volume',
  '/api/watch/volume?minutes=20&bucket=10',
  '/api/watch/spills',
  '/api/watch/spills?item=RULE-no-such-item',
  // The spill ratio's two tallies. The parameterless form is the one the
  // chart draws; the second probe pins the limit, because a cap that is
  // never exercised is a cap nothing proves does not open a database.
  '/api/watch/ratio',
  '/api/watch/ratio?limit=6',
  // `session` is required, and a session the corpus has never seen is the
  // no-sample state — "the file is not there", the case that tempts a read
  // into creating it.
  '/api/watch/context?session=never-seen-session',
  { path: '/api/watch/stream?poll=50', kind: 'stream' },
  // Plan 3's Ask read model. `corpus` reads the INDEX through a checked
  // read-only `Store` and never rebuilds it; `audit` and `summary` read the
  // audit projection through the same read-only door the Watch routes use, and
  // over this fixture — which has never built one — they answer the `absent`
  // empty state. Probed with parameters that actually match as well as with
  // ones that match nothing, because "there is nothing to return" is the case
  // that tempts a read into creating something.
  '/api/ask/corpus',
  '/api/ask/corpus?type=rule&status=active&always=0&scoped=0&limit=5',
  '/api/ask/corpus?title=no-such-title-in-this-corpus',
  '/api/ask/audit',
  '/api/ask/audit?kind=injection&session=never-seen-session&limit=10',
  '/api/ask/summary?report=ops',
  '/api/ask/summary?report=items&role=spilled',
  '/api/ask/summary?report=sessions',
  // ── The four screens that had no endpoint at all, wired 2026-08-23 ───────
  //
  // These are the routes behind Capture, Procedures, Export/import and Template
  // packs. Three of the four sit on top of domain modules that DO write — the
  // pack importer binds `createItem`/`updateItem`, `procedure activate|done`
  // mutates, and export writes an artefact — so each read model was built to
  // reach the read half only, and this sweep is what turns that from a design
  // claim into a measurement. `no-writes.test.ts` proves which symbols they
  // BIND; only the byte-identical assertion below proves nothing is CALLED.
  //
  // Probed with arguments that match AND with arguments that match nothing,
  // for the reason the entries above give: "there is nothing to return" is the
  // case that tempts a read into creating something. `/api/capture` is also
  // probed with a repeated parameter, because refusing one is the behaviour its
  // model added deliberately after measuring that `/api/glob` silently drops a
  // repeat — a 400 writes nothing and proves the guard runs.
  '/api/capture?scope=src/**',
  '/api/capture?scope=no-such-directory/**',
  '/api/procedures',
  '/api/procedure/PROC-no-such-procedure',
  '/api/port',
  '/api/packs',
  // plan:builder seq:2b. It reads `COMMAND_FLAGS`, `FLAG_DECLARATIONS` and the
  // config `ApiContext` already resolved — it opens no store at all, which is
  // why it is the cheapest entry on this list and still has to be on it: a
  // route nobody probes is a route nothing proves read-only.
  '/api/flags',
];

/** Does a registered path template match this concrete pathname? */
function templateMatches(template: string, pathname: string): boolean {
  const t = template.split('/').filter((s) => s !== '');
  const p = pathname.split('/').filter((s) => s !== '');
  if (t.length !== p.length) return false;
  return t.every((segment, i) => segment.startsWith(':') || segment === p[i]);
}

/**
 * **The one way the sweep below can quietly stop meaning anything**, closed.
 *
 * `routes.ts` says `registeredRoutes()` exists for this sweep, "which has to
 * exercise EVERY read route and cannot do that from a list maintained by hand
 * beside the real one" — and the plan's own sample then maintained it by hand
 * anyway. This is the comparison that makes the list a claim rather than a
 * hope: a route plan 2 or plan 3 registers without adding it here fails, by
 * name, in this test rather than by silently shrinking the assertion below.
 */
test('every registered read route is in the sweep', () => {
  registerReadRoutes();
  const registered = registeredRoutes();
  assert.ok(registered.length >= 15, `only ${registered.length} routes registered`);
  const probes = READ_ROUTES({ item: 'RULE-x', session: 's' })
    .map((probe) => new URL(probePath(probe), 'http://127.0.0.1').pathname);
  const uncovered = registered
    .filter((route) => !probes.some((probe) => templateMatches(route.path, probe)))
    .map((route) => `${route.method} ${route.path}`);
  assert.deepEqual(uncovered, [],
    'these routes are registered and never exercised by the no-write sweep, so nothing proves '
    + 'they do not write. Add a concrete probe for each to READ_ROUTES.');
});

/**
 * `.index.db-wal` and `.index.db-shm` are named here rather than skipped
 * silently, because the reason they are excluded is exactly the reason this
 * test needs care.
 *
 * Their PRESENCE is not a write: opening an existing WAL database read-only
 * creates both, and `core/store.ts` records the measurement beside
 * `openReadOnlyChecked` — "the main file's bytes and mtime stay untouched".
 * Their CONTENT is a different matter for `-wal`, and it is asserted separately
 * below. `-shm` is SQLite's shared-memory index and holds no user data at all,
 * so it is excluded outright.
 */
const SIDECARS = new Set(['.index.db-wal', '.index.db-shm']);

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const key = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) { walk(full, key); continue; }
      if (SIDECARS.has(key)) continue;
      out[key] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root, '');
  return out;
}

/** Bytes in the WAL, or 0 when there is no WAL. See the assertion below. */
function walBytes(root: string): number {
  try { return statSync(path.join(root, '.index.db-wal')).size; } catch { return 0; }
}

/**
 * SCOPE (owner ruling B4, 2026-08-20, plan §0.6): the SERVED-READ path. Every
 * request this test makes is authorised, and the status guard below refuses
 * anything that is not 200 or 404 — so the one write this surface performs, the
 * refusal record, cannot happen inside this sweep. That is why `.audit/` is NOT
 * excluded from `snapshot()`: a served read writing an audit record is exactly
 * what this assertion is here to catch, and excluding the directory would be the
 * single edit that hides it.
 */
test('the read surface changes not one byte of the corpus', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const before = snapshot(corpus);          // taken with nothing holding the database
  try {
    const h = await startUiChild(cwd);
    try {
      const token = await redeemNonce(h.port, h.nonce);

      // The parameters come from the corpus through the server's own listings,
      // so a renamed fixture cannot silently reduce this test to the
      // parameterless routes. Both listings are themselves read routes and are
      // hit again below.
      const items = (await (await api(h, token, '/api/items')).json()) as
        { items: { id: string }[] };
      assert.ok(items.items.length > 0,
        'the fixture corpus is empty — this assertion would be measuring nothing');
      const sessions = (await (await api(h, token, '/api/sessions')).json()) as
        { sessions: { sessionId: string }[] };

      for (const probe of READ_ROUTES({
        item: items.items[0]!.id,
        session: sessions.sessions[0]?.sessionId ?? null,
      })) {
        const route = probePath(probe);
        if (typeof probe !== 'string' && 'kind' in probe) {
          // A held-open stream: read its first frame, then abort. Draining it
          // the way every other probe is drained would wait forever, because
          // this route's whole contract is that the server never ends it.
          const abort = new AbortController();
          const stream = await fetch(`http://127.0.0.1:${h.port}${route}`, {
            headers: { [TOKEN_HEADER]: token }, signal: abort.signal,
          });
          assert.equal(stream.status, 200, `${route} answered ${stream.status}`);
          const first = await stream.body!.getReader().read();
          assert.match(
            new TextDecoder().decode(first.value), /^event: hello\n/,
            `${route} sent no opening frame — a stream that only matched proves nothing`,
          );
          abort.abort();
          continue;
        }
        const response = typeof probe === 'string'
          ? await api(h, token, route)
          : await fetch(`http://127.0.0.1:${h.port}${route}`, {
            method: probe.method,
            headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
            body: JSON.stringify(probe.body),
          });
        // 401/403 are excluded ON PURPOSE and not only because they prove
        // nothing: a refusal WRITES (plan §0.6), so a refused request inside
        // this sweep would redden the byte-identical assertion below for the
        // right reason at the wrong time. This line is what keeps the sweep
        // authorised, and it fails as ITSELF rather than as a mystery diff.
        assert.ok(response.status === 200 || response.status === 404,
          `${route} answered ${response.status}; this sweep is authorised throughout — a refusal `
          + 'here writes an audit record, and a route that errored proves nothing');
        await response.arrayBuffer(); // drain, so the handler has certainly finished
      }
    } finally {
      await h.stop(); // the child exits, so SQLite is no longer holding the file
    }

    assert.deepEqual(snapshot(corpus), before,
      'a SERVED READ changed the corpus — including .audit/, which is inside this snapshot on '
      + 'purpose (plan §0.6: the one ruled write is on the refusal path, and no request in this '
      + 'sweep was refused). This is precisely what the static test in Task 14 cannot see: it '
      + 'proves which symbols src/ui/ BINDS, never that no route WRITES.');

    // A page written in WAL mode lands in `-wal` first and only reaches
    // `.index.db` at a checkpoint — and `stop()` KILLS the child rather than
    // closing it, so no checkpoint is guaranteed. A non-empty WAL is therefore
    // a write that the hash comparison above would otherwise have missed.
    assert.equal(walBytes(corpus), 0,
      'the WAL holds frames after a read-only sweep: something wrote pages');
  } finally { removeTree(cwd); }
});

/**
 * The stream's own contract, which the sweep above only opens far enough to
 * prove the handler ran (plan 3 Task 6).
 *
 * Both halves, because each is a different failure. A record appended AFTER a
 * client connected must arrive — that is the whole feature — and the records
 * already in the log when it connected must NOT, because `AuditTail` starts at
 * the current EOFs precisely so an audit view never shows an entry twice. The
 * fixture writes `create` and `update` records before the server starts, so
 * the negative half has something real to catch.
 */
test('the audit stream delivers what lands after you connect, and not what was already there', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const h = await startUiChild(cwd);
  const abort = new AbortController();
  try {
    const token = await redeemNonce(h.port, h.nonce);
    const stream = await fetch(`http://127.0.0.1:${h.port}/api/watch/stream?poll=50`, {
      headers: { [TOKEN_HEADER]: token },
      // The server never ends this response, so the read below needs its own
      // bound: without one a broken stream hangs the file instead of failing.
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
    });
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    // Spec §2's table applies to a stream too, and the stream writes its own
    // head — it does not pass through `sendJson`, so this is not implied by
    // any assertion above.
    assertSecurityHeaders(stream, 'the audit stream');

    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let seen = decoder.decode((await reader.read()).value);
    assert.match(seen, /^event: hello\ndata: \{"pollMs":50\}/);

    recordAudit(corpus, { kind: 'focus', op: 'focus-set', sessionId: 'streamed', note: 'src/**' });
    try {
      while (!seen.includes('event: record')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        seen += decoder.decode(chunk.value);
      }
    } catch { /* the 15s bound fired; the assertions below report what arrived */ }

    assert.match(seen, /event: record\ndata: .*"op":"focus-set"/,
      'a record appended while the stream was open never reached it');
    assert.ok(!seen.includes('"op":"create"'),
      'the tail replayed records that predate the connection — an audit view showing an entry '
      + 'twice is the failure `AuditTail` starts at the current EOFs to prevent');
  } finally { abort.abort(); await h.stop(); removeTree(cwd); }
});

/**
 * The other side of the same boundary (owner ruling B4, 2026-08-20, plan §0.6).
 * The test above proves a SERVED read writes nothing. This one proves the
 * refusal path writes exactly one thing, that it is the audit record the ruling
 * names, and that it carries what the ruling says and nothing more.
 *
 * It is an equality on the CHANGED SET, not a "the log grew" check: a refusal
 * that also touched an item file, the index or a seen file would satisfy "the
 * log grew" and fail this. And the fixture already HAS an audit log — `add`
 * wrote a mutation record — so this compares CONTENT, not appearance.
 */
test('a refused request is recorded, and it is the only write', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const before = snapshot(corpus);
  const h = await startUiChild(cwd);
  let token = '';
  try {
    token = await redeemNonce(h.port, h.nonce);
    const refused = await api(h, token, '/api/ping', { origin: 'https://evil.example' });
    assert.equal(refused.status, 403);
    assert.equal((await refused.text()).length, 0);   // ruling A4, again, on the audited path
  } finally { await h.stop(); }

  try {
    const after = snapshot(corpus);
    const changed = Object.keys({ ...before, ...after })
      .filter((k) => before[k] !== after[k]).sort();
    assert.deepEqual(changed, ['.audit/audit.jsonl'],
      'a refusal wrote something other than the one audit record the ruling allows');

    const access = readAudit(corpus).filter((r) => r.kind === 'access');
    assert.equal(access.length, 1, 'one refused request, one record');
    const record = access[0]!;
    assert.equal(record.op, 'ui-refused');
    assert.deepEqual(record.refusal, {
      check: 'origin',
      status: 403,
      method: 'GET',
      route: '/api/ping',
      host: `127.0.0.1:${h.port}`,          // as submitted — and it MATCHED; the Origin is what failed
      origin: 'https://evil.example',        // the submitted value, kept where ruling 11 said it belongs
    });
    // The token is the secret the gate exists to protect. Asserted against the
    // whole serialized record, not against the fields we remembered to check.
    assert.ok(!JSON.stringify(record).includes(token),
      'the refusal record must never carry the token, in any form');
  } finally { removeTree(cwd); }
});

/**
 * All FIVE of the gate's refusing exits reach the same log, each as itself.
 *
 * The test above measures one. This measures the set, because `status` cannot
 * tell three of them apart and the record exists precisely so a reader does not
 * have to infer the check from the code. Two of the five can only be produced
 * on a socket: `Host` is a forbidden header to `fetch` and to every browser, so
 * neither a wrong Host nor an absent one is reachable from a browser test — and
 * a wrong Host is the DNS-rebinding case this gate exists for.
 *
 * The absent/wrong Host pair is ruling C6's distinction, which lives entirely in
 * `RefusalDetail.host`: both carry `check: 'host'`, and `null` versus the
 * submitted value is the only thing that separates them in the log.
 */
test('each gate exit records its own check, and Host absent is not Host wrong', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const h = await startUiChild(cwd);
  const port = h.port;
  try {
    const token = await redeemNonce(port, h.nonce);
    assert.equal((await rawGet(port, '/api/ping', { host: null })).status, 403);           // host, absent
    assert.equal((await rawGet(port, '/api/ping', { host: 'evil.example' })).status, 403); // host, wrong
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/ping`)).status, 401);          // token-missing
    assert.equal((await api(h, 'f'.repeat(64), '/api/ping')).status, 403);                 // token-mismatch
    assert.equal((await api(h, token, '/api/ping', { origin: 'https://evil.example' })).status, 403);
  } finally { await h.stop(); }

  try {
    const access = readAudit(corpus).filter((r) => r.kind === 'access');
    assert.deepEqual(
      access.map((r) => r.refusal?.check),
      ['host', 'host', 'token-missing', 'token-mismatch', 'origin'],
      "each of the gate's refusing exits must reach the log as itself",
    );
    assert.deepEqual(access.map((r) => r.refusal?.status), [403, 403, 401, 403, 403]);
    assert.deepEqual(
      access.map((r) => r.refusal?.host),
      [null, 'evil.example', `127.0.0.1:${port}`, `127.0.0.1:${port}`, `127.0.0.1:${port}`],
      'ruling C6: an ABSENT Host is null and a WRONG one is the submitted value — the record is '
      + 'the only place those two failures are still told apart',
    );
    assert.deepEqual(access.map((r) => r.refusal?.origin), [null, null, null, null, 'https://evil.example'],
      'an absent Origin is null, not the empty string — absence is a fact a reader needs');
    assert.deepEqual(access.map((r) => r.refusal?.route), Array(5).fill('/api/ping'));
  } finally { removeTree(cwd); }
});

/**
 * `url.pathname`, never `url.search` (plan §0.6 field rule 4), and both capped
 * (rule 3). `recordRefusal` holds both properties, so this is the test that the
 * SERVER hands it the right value — a call site passing `req.url` would put an
 * unbounded query string on disk and no test in `security.test.ts` could see it.
 */
test('a refusal record carries the path without its query, capped', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const h = await startUiChild(cwd);
  try {
    await fetch(`http://127.0.0.1:${h.port}/api/items?secret=${'s'.repeat(50)}`);
    await rawGet(h.port, `/api/${'p'.repeat(400)}`, { host: null });
  } finally { await h.stop(); }

  try {
    const access = readAudit(corpus).filter((r) => r.kind === 'access');
    assert.equal(access.length, 2);
    assert.equal(access[0]!.refusal?.route, '/api/items', 'the query string must not reach the log');
    assert.ok(!JSON.stringify(access[0]).includes('secret'), 'the query string reached the log');
    const long = access[1]!.refusal?.route ?? '';
    assert.equal(long.length, 257, `a capped route is 256 characters plus the marker; got ${long.length}`);
    assert.ok(long.endsWith('…'), 'a truncated value must be visibly truncated');
  } finally { removeTree(cwd); }
});
