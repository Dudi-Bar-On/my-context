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
import { readAudit } from '../../src/core/audit.ts';
import { HELP_TOPICS } from '../../src/core/teach.ts';
import { DIR_NAME } from '../../src/core/workspace.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
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
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body, long enough to cost real tokens. '.repeat(10), '--yes']);
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
  assert.equal(
    response.headers.get('content-security-policy'),
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    `${what}: spec §2 requires the CSP on every response`,
  );
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
    assert.deepEqual(await good.json(), { ok: true });
  } finally { await h.stop(); removeTree(cwd); }
});

test('a WRONG token is refused at /api/handoff; only a MISSING one is exempt', async () => {
  // The exemption exists so the page can obtain a token it does not yet have.
  // A page that presents a wrong one is not that case, and keying the exemption
  // on the gate's `check` rather than on its status code is what tells them
  // apart: three of the gate's refusing exits answer 403.
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const refused = await fetch(`http://127.0.0.1:${h.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [TOKEN_HEADER]: 'f'.repeat(64) },
      body: JSON.stringify({ nonce: h.nonce }),
    });
    assert.equal(refused.status, 403);
    assert.equal((await refused.text()).length, 0);
    // …and the nonce it carried is still good, because the gate refused before
    // redemption: the wrong token cost the page nothing it cannot retry.
    assert.equal(typeof await redeemNonce(h.port, h.nonce), 'string');
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
const READ_ROUTES = (from: { item: string; session: string | null }): string[] => [
  '/api/ping',
  '/api/meta',
  '/api/select?event=session-start&cold=1',
  '/api/select?event=tool&path=src/index.ts&cold=1',
  '/api/render?event=session-start&cold=1',
  '/api/simulate?event=session-start&cold=1&pinned=100',
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
  // Plan 2, Task 3's Work read model. Both take no parameters, so the probe is
  // the bare path; both answer 200 over any corpus, including one with an empty
  // revision log and no drafts.
  '/api/revisions',
  '/api/review-queue',
  `/api/item/${encodeURIComponent(from.item)}`,
  '/api/item/RULE-no-such-item',
  ...(from.session === null ? [] : [`/api/session/${encodeURIComponent(from.session)}/injected`]),
  '/api/session/never-seen-session/injected',
  ...HELP_TOPICS.map((topic) => `/api/help/${topic}`),
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
    .map((route) => new URL(route, 'http://127.0.0.1').pathname);
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

      for (const route of READ_ROUTES({
        item: items.items[0]!.id,
        session: sessions.sessions[0]?.sessionId ?? null,
      })) {
        const response = await api(h, token, route);
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
