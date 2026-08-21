/**
 * The HTTP surface: dispatch, the security gate, the handoff nonce exchange,
 * and the process's own ephemerality.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §2 (the token, the
 * custom header, Host/Origin, the response headers) and §3 (opening the
 * browser, the idle exit). Plan:
 * `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` Task 13.
 *
 * **Dispatch order, and why each step is where it is.**
 *
 *   1. **Anything outside `/api/` goes to `serveStatic`, before the gate.** The
 *      page cannot present a token it has not loaded the code to fetch, so the
 *      page's own bytes are the one surface that answers without one.
 *      `static.ts` carries the three refusals that make that safe; this module
 *      supplies the headers it deliberately does not set.
 *   2. **`POST /api/handoff` is Host/Origin-checked and token-EXEMPT.** It is
 *      how the page first obtains the token. The exemption is keyed on
 *      `gate.check === 'token-missing'` — the closed vocabulary — and never on
 *      the status code: three of the gate's five refusing exits answer `403`,
 *      so a status cannot say which check refused, which is the reason `check`
 *      exists (plan §0.6 field rule 1).
 *   3. **Every other `/api` path passes the full gate**, then `idle.touch()`
 *      for a matched non-stream route, then the handler. An open stream is not
 *      activity (spec §2), so plan 3's stream route inherits ephemerality
 *      without having to remember it.
 *
 * **A refusal is a status line and nothing else** (owner ruling A4, plan §0.6):
 * see `sendRefusal`, which has no parameter a body could be passed in.
 *
 * **A refusal is recorded** (owner ruling B4, plan §0.6): see `refuse`, which
 * calls `recordRefusal` — the one write this read-only surface performs, on the
 * refusal path only. `test/ui/server-e2e.test.ts` proves both halves: that a
 * full sweep of every registered read route changes not one byte of the corpus,
 * and that a refused request appends exactly one audit record and nothing else.
 *
 * **`ping` and `meta` are REGISTERED routes, not branches in the dispatch
 * loop** — a correction to the plan's sample code, which special-cased both
 * above `matchRoute`. Two things fall out of registering them, and both are
 * properties the special cases only promised: they take the same
 * `idle.touch()`, the same headers and the same 405-shaped fallthrough as every
 * other route, and — the load-bearing half — they appear in `registeredRoutes()`,
 * which is what lets the E2E's no-write sweep assert that its route list covers
 * the real table instead of being a hand-maintained copy beside it. `routes.ts`
 * says that is what `registeredRoutes()` is for; the plan's own sample then
 * hand-maintained the list anyway.
 *
 * `/api/handoff` stays out of the table, because a registered route is a route
 * behind the gate and the handoff's whole job is to be the one that is not.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { RefusalCheck } from '../core/audit.ts';
import { isMainEntry } from '../core/paths.ts';
import { VERSION } from '../core/version.ts';
import { resolveWorkspace, type Workspace } from '../core/workspace.ts';
import { readGitInfo } from './git-info.ts';
import { IDLE_MS, IdleMonitor } from './idle.ts';
import {
  apiCoverage, apiDecay, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem, apiItems,
  apiRender, apiSelect, apiSessions, apiSimulate, apiStatus,
} from './read-model.ts';
import { matchRoute, registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { mintToken, NonceStore, recordRefusal, validateApiRequest } from './security.ts';
import { serveStatic } from './static.ts';

/** Ten seconds: the nonce that transits a process command line (spec §3). */
export const OPENER_NONCE_TTL_MS = 10_000;
/** Ten minutes: the nonce in a PRINTED url (--no-open / spawn fallback) — never on a command line. */
export const PRINTED_NONCE_TTL_MS = 600_000;

export interface UiServerOptions {
  /** Workspace resolution root. */
  cwd: string;
  /** `0` — the default — asks the OS for a free port. */
  port?: number;
  /** MUST be `127.0.0.1`; anything else is refused at startup (spec §2.1). */
  host?: string;
  /** The idle window; tests shrink it. `IdleMonitor` owns what is a legal value. */
  idleMs?: number;
  onExit?: (reason: 'idle' | 'closed') => void;
  /** Test-only override for handoff nonce ttl; production callers omit it. */
  nonceTtlMs?: number;
}

export interface RunningUiServer {
  port: number;
  /** URL carrying a fresh one-shot handoff nonce in the FRAGMENT. */
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

/**
 * **Spec §2's response-header table, on EVERY response including the static
 * assets** — a correction to the plan's Task 13 sample, which set only
 * `Cache-Control` and dropped the other three.
 *
 * They are not decoration and one of them was already being asserted as a fact:
 * `security.ts` explains that echoing a submitted value in a refusal reason "was
 * not an XSS vector — the response is a JSON body under `default-src 'none'`",
 * which was a claim about a header nothing sent. `static.ts` states the other
 * side of the same contract — it sets no `Cache-Control` and no
 * `Content-Security-Policy` because "headers are the caller's (Task 13)". This
 * is that caller, so this is where the claim becomes true.
 *
 * Why each, in the spec's own words:
 *
 *   - `Content-Security-Policy` — item titles and bodies are authored by agents
 *     and by ingest, and the page renders them; `default-src 'none'` leaves a
 *     stray `<img src=x onerror=…>` in a body nowhere to go, and
 *     `frame-ancestors 'none'` is the framing half of the DNS-rebinding
 *     defence. No `'unsafe-inline'`: §3's no-build-step rule already requires
 *     real `.js` and `.css` files, so nothing needs it.
 *   - `X-Content-Type-Options: nosniff` — an item body served as JSON must
 *     never be sniffed into HTML.
 *   - `Referrer-Policy: no-referrer` — nothing about a local corpus belongs in
 *     a referrer.
 *   - `Cache-Control: no-store` — the corpus is not public and the server is
 *     ephemeral; a cached response outliving the token is a leak with no
 *     upside. The spec scopes this one to `/api`; it is sent on the static
 *     assets too, because `static.ts`'s interface hands the caller that
 *     decision and an ephemeral app has nothing worth revalidating.
 *
 * One object, spread by all three senders, so a response cannot be added that
 * quietly ships without them.
 *
 * `font-src 'self' data:` is the one directive here that re-opens rather than
 * closes, and it is deliberate. Without it, `default-src 'none'` blocks EVERY
 * font -- same-origin files and `data:` URIs alike -- because an absent
 * directive falls back to the default. Chrome says so by name: "'font-src' was
 * not explicitly set, so 'default-src' is used as a fallback." That made the
 * product's typography undemonstrable, not merely unstyled.
 *
 * It costs nothing that matters. A font cannot execute. The directive this CSP
 * exists for is `script-src`, because the page renders item titles and bodies
 * authored by agents and by ingest; widening `font-src` leaves that untouched.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
};

let routesRegistered = false;

/**
 * The read routes, registered into the shared table `routes.ts` owns.
 *
 * Exported and idempotent so a test can ask what the table holds without
 * starting a server — which is what `test/ui/server-e2e.test.ts` does to prove
 * its sweep covers every registered route. Guarding inside rather than at the
 * call site means every caller inherits the guard, including one written later.
 */
export function registerReadRoutes(): void {
  if (routesRegistered) return;
  routesRegistered = true;

  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });

  // The heartbeat target (Task 16's visibility-gated ping). It reads nothing:
  // being answered at all is the whole payload, and the `idle.touch()` the
  // dispatch does for it is the point.
  registerRoute('GET', '/api/ping', { kind: 'json', handle: () => ({ status: 200, body: { ok: true } }) });
  // `git` is `null` in a workspace with no `.git` — present either way, because
  // "no repository" is a fact the strip renders rather than a field to omit.
  registerRoute('GET', '/api/meta', {
    kind: 'json',
    handle: (ctx) => ({
      status: 200,
      body: {
        version: VERSION,
        projectRoot: ctx.ws.projectRoot,
        repoRoot: ctx.repoRoot,
        git: readGitInfo(ctx.repoRoot),
      },
    }),
  });

  registerRoute('GET', '/api/select', json(apiSelect));
  registerRoute('GET', '/api/render', json(apiRender));
  registerRoute('GET', '/api/simulate', json(apiSimulate));
  registerRoute('GET', '/api/sessions', json(apiSessions));
  registerRoute('GET', '/api/status', json(apiStatus));
  registerRoute('GET', '/api/doctor', json(apiDoctor));
  registerRoute('GET', '/api/decay', json(apiDecay));
  registerRoute('GET', '/api/coverage', json(apiCoverage));
  registerRoute('GET', '/api/graph', json(apiGraph));
  registerRoute('GET', '/api/items', json(apiItems));
  registerRoute('GET', '/api/session/:session/injected', {
    kind: 'json',
    handle: (ctx) => apiInjected(ctx.ws, ctx.url, { session: ctx.params['session'] ?? '' }),
  });
  registerRoute('GET', '/api/item/:id', {
    kind: 'json',
    handle: (ctx) => apiItem(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/help/:topic', {
    kind: 'json',
    handle: (ctx) => apiHelp(ctx.ws, ctx.url, { topic: ctx.params['topic'] ?? '' }),
  });
}

function sendJson(res: ServerResponse, result: JsonResult): void {
  const body = JSON.stringify(result.body);
  res.writeHead(result.status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    // Deliberately NO CORS headers: their absence is the cross-origin defence (spec §2).
  });
  res.end(body);
}

/**
 * A status line and NOTHING ELSE (owner ruling A4, plan §0.6).
 *
 * There is no `body` parameter, and that absence is the whole point. The gate's
 * `reason` is a developer-facing fixed literal that carries no submitted input
 * (ruling 11) and a comment on it says it is never rendered — but a comment
 * cannot stop a later task rendering it, and NOTHING CAN RENDER WHAT IS NEVER
 * SENT. A helper you cannot pass a reason to holds the property structurally.
 *
 * No content-type either: there is no content. The security headers stay,
 * because a refusal is still a response and a cached refusal is still a refusal
 * someone could serve twice.
 *
 * It is also what answers a missing static asset, and for the same reason
 * `static.ts` refuses to distinguish its own refusals: the one distinction that
 * would help a caller is also the one that tells a stranger which paths exist.
 * The audit record is `refuse()`'s job, not this helper's — this one only
 * decides what goes on the wire.
 */
function sendRefusal(res: ServerResponse, status: number): void {
  res.writeHead(status, { ...SECURITY_HEADERS });
  res.end();
}

/** The FIRST value of a repeated header — the same value the gate judged. */
const headerFirst = (v: string | string[] | undefined): string | null =>
  v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;

/**
 * The request body, capped.
 *
 * The cap **destroys the request** rather than only rejecting the promise: a
 * rejection settles this function and leaves the socket streaming, so an
 * unbounded body would go on arriving into a buffer nobody is going to read.
 * `setEncoding` is what makes the concatenation correct — a multi-byte
 * character split across two chunks decodes to a replacement character under a
 * bare `String(chunk)`, and a JSON body is the one place that matters.
 */
const MAX_BODY_BYTES = 64 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error(`request body exceeded ${MAX_BODY_BYTES} bytes`));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Start the server. **Never throws synchronously** — every failure arrives as a
 * rejection, which is why this is `async`.
 *
 * That is not a style choice. `IdleMonitor`'s constructor refuses a malformed
 * window with a message written to be the whole user-facing message, and it
 * says Task 13 should "let it through unchanged"; the entry point below prints
 * `err.message` and exits 1. A constructor that throws out of a function
 * declared to return a promise would skip that `.catch` entirely and print a
 * stack trace instead — measured, and the reason `--idle-ms abc` has a test.
 * `resolveWorkspace` throws on a corrupt `config.json` and reaches the same
 * `.catch` by the same route.
 */
export async function startUiServer(options: UiServerOptions): Promise<RunningUiServer> {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    // Refuse to start, not warn (spec §2.1): a bind beyond loopback exposes
    // the corpus to the network, and a warning is a property claim nobody reads.
    throw new Error(`mycontext ui: refusing to bind ${host} — the UI serves 127.0.0.1 only.`);
  }
  const ws = resolveWorkspace(options.cwd);
  if (ws.projectRoot === null) {
    throw new Error('mycontext ui: no workspace here. Run `mycontext init` first.');
  }
  const corpusRoot = ws.projectRoot;   // narrowed here so the refusal recorder below has a string
  const repoRoot = path.dirname(corpusRoot);
  const token = mintToken();
  const nonces = new NonceStore();
  const nonceTtl = options.nonceTtlMs;

  registerReadRoutes();

  /** Set once the socket is bound; the gate compares the submitted Host against it. */
  let boundPort = 0;

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      // A handler that has already written cannot be given a status — a second
      // `writeHead` throws from inside this very catch. The connection is torn
      // down instead, so the client sees a truncated response rather than a
      // silent success, which is the honest signal for "this failed halfway".
      if (res.headersSent) { res.destroy(); return; }
      sendJson(res, {
        status: 500,
        body: { error: err instanceof Error ? err.message : String(err) },
      });
    });
  });

  const idle = new IdleMonitor(options.idleMs ?? IDLE_MS, () => {
    // On idle the server closes; open sockets (a stream, in plan 3) are
    // destroyed so close() completes and the page's next fetch fails, which
    // is what triggers the "server has exited" banner (no auto-reconnect).
    server.close(() => options.onExit?.('idle'));
    server.closeAllConnections();
  });

  /**
   * The ONE write this server performs, and then the status (plan §0.6,
   * rulings A4 and B4). Recorded BEFORE the response goes out, so a refusal
   * cannot be answered and then lost; `recordAudit` is a synchronous append,
   * not a read-modify-write.
   *
   * The `AuditWriteResult` is DISCARDED, exactly as the hooks discard theirs:
   * there is no one to tell, and telling the refused party would be the echo
   * ruling 11 removed. A log that has stopped being writable is discoverable
   * through `doctor`'s `audit_log_size` check.
   *
   * `url.pathname`, never `url.search`. Capping and the absent-versus-empty
   * distinction live in `recordRefusal` (§0.6), so every caller gets them.
   */
  function refuse(
    req: IncomingMessage, url: URL, gate: { status: number; check: RefusalCheck },
    res: ServerResponse,
  ): void {
    recordRefusal(corpusRoot, {
      check: gate.check,
      status: gate.status as 401 | 403,
      method: req.method ?? 'GET',
      route: url.pathname,
      host: headerFirst(req.headers.host),
      origin: headerFirst(req.headers.origin),
    });
    sendRefusal(res, gate.status);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${boundPort}`);

    // Rule 1: the page's own bytes, before the gate. `serveStatic` carries the
    // containment, extension and real-path refusals; `null` is every one of
    // them and is answered as 404 with no body, so which refusal fired is not
    // on the wire.
    if (!url.pathname.startsWith('/api/')) {
      const asset = serveStatic(url.pathname, PUBLIC_DIR);
      if (asset === null) { sendRefusal(res, 404); return; }
      res.writeHead(asset.status, { ...SECURITY_HEADERS, 'content-type': asset.contentType });
      res.end(asset.body);
      return;
    }

    // Host/Origin are validated for EVERY /api request, handoff included; the
    // token check is what handoff alone is exempt from (it is how the page
    // first obtains the token).
    const gate = validateApiRequest(req, { token, port: boundPort });

    // Rule 2. Not a registered route: a route in the table is a route behind
    // the gate, and this is the one that must not be.
    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      // `check`, never the status: three of the gate's refusing exits answer
      // 403, so the status cannot say which one refused. `token-missing` is
      // exactly the exemption — a WRONG token is still refused here.
      if (!gate.ok && gate.check !== 'token-missing') { refuse(req, url, gate, res); return; }
      let nonce: unknown;
      try {
        nonce = (JSON.parse(await readBody(req)) as { nonce?: unknown }).nonce;
      } catch {
        nonce = undefined;
      }
      if (typeof nonce !== 'string' || !nonces.redeem(nonce)) {
        // A4 again: no body. A nonce refusal is not one of the gate's four
        // exits and is deliberately NOT audited (plan §0.4 item 10), but what
        // goes on the wire is the same status-and-nothing-else.
        sendRefusal(res, 403);
        return;
      }
      sendJson(res, { status: 200, body: { token } });
      return;
    }

    // Rule 3: the full gate, then the table.
    if (!gate.ok) { refuse(req, url, gate, res); return; }

    const match = matchRoute(req.method ?? 'GET', url.pathname);
    if (match === null) {
      // The submitted method and path are NOT echoed back. The sender already
      // knows what it sent, so the echo buys nothing — and it is unbounded
      // caller-supplied text, which is the reason ruling 11 took the submitted
      // value out of the gate's reasons and §0.6 field rule 3 caps what reaches
      // the log. A fixed literal says the same thing to the only reader who
      // needs it.
      sendJson(res, { status: 404, body: { error: 'no route matched this request' } });
      return;
    }

    let body: unknown;
    if (req.method === 'POST') {
      try { body = JSON.parse(await readBody(req)); } catch { body = undefined; }
    }
    const ctx: ApiContext = { ws, repoRoot, url, params: match.params, body };

    if (match.handler.kind === 'stream') {
      // NOT idle.touch(): an open stream is not activity (spec §2). Plan 3's
      // stream route inherits this without remembering it.
      match.handler.handle(ctx, res);
      return;
    }
    idle.touch();
    sendJson(res, await match.handler.handle(ctx));
  }

  return new Promise<RunningUiServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      boundPort = (server.address() as AddressInfo).port;
      idle.touch();
      idle.start();
      resolve({
        port: boundPort,
        urlWithNonce: (ttlMs: number) =>
          `http://127.0.0.1:${boundPort}/#${nonces.mint(nonceTtl ?? ttlMs)}`,
        close: () => new Promise<void>((done) => {
          idle.stop();
          server.close(() => { options.onExit?.('closed'); done(); });
          server.closeAllConnections();
        }),
      });
    });
  });
}

/** The flags the main entry accepts, and the shape it hands `startUiServer`. */
export interface ServerArgs {
  port: number;
  host?: string;
  idleMs?: number;
  nonceTtlMs?: number;
}

/**
 * Parse `--flag value` pairs, and **refuse everything else**.
 *
 * `INV-nothing-is-dropped-silently` is the whole of this function. The obvious
 * `argv.indexOf('--port')` version drops three different mistakes on the floor,
 * and each of them ends as a server that runs with the wrong settings and says
 * nothing:
 *
 *   - **An unknown flag.** `--idle-ms=300` is the one that bites: the equals
 *     spelling matches no key, so the flag vanishes and the server keeps
 *     production's fifteen-minute window — a test written that way does not
 *     fail, it hangs until its own timeout.
 *   - **A flag with no value.** A trailing `--port` reads `undefined` and
 *     becomes the default, so an incomplete command line starts a server on a
 *     port the caller did not ask for.
 *   - **A repeated flag.** One of the two values is used and the other is not,
 *     and nothing says which.
 *
 * `--idle-ms` is passed through as a bare `Number()` **on purpose**:
 * `IdleMonitor`'s constructor already refuses NaN, Infinity, zero, a negative
 * and a fraction, each with a message written to be the whole user-facing
 * message. Validating it here would be a second wording for the same refusal.
 * `--port` and `--nonce-ttl-ms` have no such downstream owner — a NaN ttl makes
 * `now + NaN` an expiry no comparison can satisfy, so every nonce would be
 * refused with nothing to say why — so they are checked here.
 */
export function parseServerArgs(argv: string[]): ServerArgs {
  const seen = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] ?? '';
    if (!flag.startsWith('--') || !KNOWN_FLAGS.includes(flag.slice(2))) {
      throw new Error(
        `mycontext ui: unknown argument ${JSON.stringify(flag)}. ` +
        `Known flags: ${KNOWN_FLAGS.map((f) => `--${f}`).join(', ')}, each written as ` +
        '`--flag value`. It is refused rather than ignored: a flag that is accepted and ' +
        'dropped starts a server with settings nobody asked for and says nothing.',
      );
    }
    const name = flag.slice(2);
    if (seen.has(name)) {
      throw new Error(
        `mycontext ui: --${name} was given twice. Refused rather than resolved, because ` +
        'either answer — first wins or last wins — uses one value and discards the other ' +
        'without saying which.',
      );
    }
    seen.add(name);
    const value = argv[i + 1];
    if (value === undefined) {
      throw new Error(`mycontext ui: --${name} needs a value; the command line ended after it.`);
    }
    values.set(name, value);
    i++;
  }

  const args: ServerArgs = { port: wholeNumber('port', values.get('port') ?? '0', 0) };
  const host = values.get('host');
  if (host !== undefined) args.host = host;
  const idleMs = values.get('idle-ms');
  // Bare `Number`: `IdleMonitor` owns this refusal and its message. See above.
  if (idleMs !== undefined) args.idleMs = Number(idleMs);
  const nonceTtlMs = values.get('nonce-ttl-ms');
  if (nonceTtlMs !== undefined) args.nonceTtlMs = wholeNumber('nonce-ttl-ms', nonceTtlMs, 1);
  return args;
}

const KNOWN_FLAGS: string[] = ['port', 'host', 'idle-ms', 'nonce-ttl-ms'];

/** A whole number at or above `min`, or a refusal naming what was passed. */
function wholeNumber(name: string, raw: string, min: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `mycontext ui: --${name} must be a whole number of ${min === 0 ? '0 or more' : `${min} or more`}. ` +
      `You passed ${JSON.stringify(raw)}.`,
    );
  }
  return value;
}

/** Main-module entry: what `test/ui/helpers.ts` spawns and what Task 15's command reuses. */
if (isMainEntry(import.meta.filename, process.argv[1])) {
  // Inside the `try` because `parseServerArgs` refuses a bad command line by
  // throwing, and a bad command line is exactly the case that must print its
  // one-line message rather than a stack.
  try {
    const args = parseServerArgs(process.argv.slice(2));
    const running = await startUiServer({ cwd: process.cwd(), ...args, onExit: () => process.exit(0) });
    // Exactly one line on stdout, and the harness's readiness signal.
    process.stdout.write(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
