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
import { registerAskRoutes } from './ask-model.ts';
import { registerCaptureRoutes } from './capture-model.ts';
import { CLI_ENTRY, registerExecuteRoutes } from './execute.ts';
import { ExecutionNonceStore } from './execute-nonce.ts';
import { registerPacksRoutes } from './packs-model.ts';
import { registerPortRoutes } from './port-model.ts';
import { registerProcedureRoutes } from './proc-model.ts';
import { readGitInfo } from './git-info.ts';
import { IDLE_MS, IdleMonitor } from './idle.ts';
import {
  apiCoverage, apiDecay, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem, apiItems,
  apiRender, apiSelect, apiSessions, apiSimulate, apiStatus,
} from './read-model.ts';
import { registerConfigRoutes } from './read-model-config.ts';
import { registerWorkRoutes } from './read-model-work.ts';
import { matchRoute, registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { loadSessionDigests, recordSessionDigest } from '../core/ui-sessions.ts';
import {
  cookieValue, mintToken, NonceStore, recordRefusal, SECURITY_HEADERS, TOKEN_COOKIE,
  TOKEN_HEADER, tokenDigest, validateApiRequest,
} from './security.ts';
import { serveStatic } from './static.ts';
import { registerWatchRoutes } from './watch-model.ts';

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
  /**
   * Told when the session store could not be read or written, with a sentence
   * naming the file and what it costs. Not an error: the server serves either
   * way. Omitting this handler discards the notice, which is a caller's choice
   * to make and not a default this module takes on its behalf.
   */
  onSessionStoreIssue?: (message: string) => void;
}

export interface RunningUiServer {
  port: number;
  /** URL carrying a fresh one-shot handoff nonce in the FRAGMENT. */
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

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

  // Plan 2's Work read model, registered INSIDE this guarded block rather than
  // beside the call to it in `startUiServer`. Two reasons, and both are
  // properties rather than taste: `startUiServer` is called repeatedly in one
  // process by `test/ui/server.test.ts`, so an unguarded second registration
  // would throw; and `server-e2e.test.ts`'s "every registered read route is in
  // the sweep" asks THIS function what the table holds — a route registered
  // only on the server-start path would be invisible to it, which is the
  // silently-shrinking assertion that test exists to prevent.
  registerWorkRoutes();
  // Plan 2's Configure read model, registered here for the same two reasons.
  // It reads `config.json` fresh, validates a candidate and previews it, and
  // writes nothing: the file is the user's to change, so the settlement leaves
  // as a command the browser composes, never as a route that edits it.
  registerConfigRoutes();
  // Plan 3's Watch read model, registered here for exactly the same two
  // reasons — and it adds the table's first `kind: 'stream'` route, which the
  // dispatch loop below deliberately does not `idle.touch()` for.
  registerWatchRoutes();
  // Plan 3's Ask read model, here for the same two reasons again. The plan
  // defers this call to its own Task 8, and it cannot wait: `no-writes.test.ts`
  // walks the import graph from THIS file and fails on a `src/ui/` module
  // nothing reaches, which is exactly what an unregistered `ask-model.ts`
  // would be. A route nobody wired is one of the two things that assertion
  // exists to say out loud.
  registerAskRoutes();
  // The four screens the mockup draws that had no endpoint at all, wired here
  // on 2026-08-23 for the same two reasons as every call above — and for a
  // third the other four did not have to state, because they were never
  // unwired long enough to meet it.
  //
  // `no-writes.test.ts`'s "the walk examines a real graph" equates every
  // module on disk under `src/ui/` with the set reachable from THIS file, and
  // says of the difference: "either dead code or a route nobody wired". All
  // four models below were written in parallel by agents forbidden to touch
  // this file, so for the length of that wave the assertion was DETERMINISTIC­LY
  // red — it failed twelve consecutive full-suite runs, which made `npm test`
  // unreadable rather than merely noisy. These four calls are what clears it.
  //
  // Each model was measured against the mutation surface before it landed:
  // none binds a symbol in `WRITERS`, and the only genuinely new modules any
  // of them adds to this server's import graph are `core/progress.ts` (pure,
  // imports one type) and `pack/layout.ts` (a leaf whose sole import is
  // `node:buffer`). `core/mutate.ts` IS reachable from here, by the
  // pre-existing `read-model.ts → help/index.ts → mcp/tools.ts` edge this
  // file's own test header already records; not one of these four adds a path
  // to it.
  registerCaptureRoutes();
  registerProcedureRoutes();
  registerPortRoutes();
  registerPacksRoutes();
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

  /**
   * **The tokens EARLIER runs issued, so a tab that was open when the server
   * restarted is not locked out for good.**
   *
   * Read before the socket binds, and the new token's digest recorded in the
   * same breath, because both are decisions about this run rather than
   * responses to a request — nothing under `src/ui/` may touch this on a
   * request path, and nothing does. `core/ui-sessions.ts` carries the full
   * reasoning; the two facts that matter here are that what is stored is
   * `sha256(token)` and never the token, and that the file lives outside every
   * corpus so the read surface still changes not one byte of the workspace.
   *
   * Both failures are REPORTED rather than thrown. A server that cannot write
   * its session file must still serve — the corpus is readable and the person
   * is waiting — but it must not pretend it persisted, because the cost lands
   * later and somewhere else: the tab opened now would stop working at the next
   * restart, which is precisely the symptom this removes.
   */
  const restored = loadSessionDigests();
  if (restored.error !== null) options.onSessionStoreIssue?.(restored.error);
  const persisted = recordSessionDigest(tokenDigest(token));
  if (persisted.error !== null) options.onSessionStoreIssue?.(persisted.error);

  const nonces = new NonceStore();
  const nonceTtl = options.nonceTtlMs;

  registerReadRoutes();

  /**
   * The execution nonce store, created HERE and closed over by the two execute
   * routes — per server, never module-global.
   *
   * It is not registered inside `registerReadRoutes` with the others, and the
   * difference is the whole reason this block is here rather than there: those
   * routes are stateless, so registering them once for the process is correct.
   * This one authorises a run, and two servers in one test process must not
   * authorise each other's — the node suite starts several. So each server
   * brings its own store, and `registerExecuteRoutes` binds the endpoint to it
   * (registering the routes themselves only the first time, because the route
   * table is process-global and refuses a duplicate).
   *
   * `CLI_ENTRY` is the CLI this server SHIPS WITH, resolved from
   * `import.meta.url` rather than found on PATH. It is a path handed to a child
   * process, never an import: `no-writes.test.ts` bans `src/cli/index.ts` from
   * this process's import graph, and running it in a child is what keeps that
   * ban true while still letting every command in the catalogue run (§6.1).
   */
  registerExecuteRoutes(new ExecutionNonceStore(), CLI_ENTRY);

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

    // **A token cookie THIS server did not issue is expired here, or the page
    // is locked out for good.**
    //
    // The lockout, measured on 2026-08-23: restart `mycontext ui` on the same
    // port, reload the page WITHOUT the nonce fragment, and the browser sends
    // the previous server's `mycontext_token`. It does not match, every /api
    // call answers 403, and the page cannot recover — the cookie is `HttpOnly`
    // so script cannot clear it, and with no nonce in the URL there is nothing
    // left to re-handshake with. The screen goes blank and stays blank however
    // many times it is reloaded.
    //
    // That is a direct breach of the owner's requirement that a reload always
    // works, and the earlier exemption on `/api/handoff` does not reach it:
    // that one only helps when a nonce IS present.
    //
    // Only the COOKIE is expired, and only when the header did not carry the
    // token. A caller that sent a wrong token in the header chose that value
    // and gets a plain refusal; a browser that merely still had a cookie from
    // the last server is handed a clean slate, so the next load presents
    // nothing, answers 401 rather than 403, and the page can say what is
    // actually wrong.
    if (gate.check === 'token-mismatch'
      && headerFirst(req.headers[TOKEN_HEADER]) === null
      && cookieValue(req.headers.cookie, TOKEN_COOKIE) !== undefined) {
      res.setHeader('set-cookie', `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }
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
    const gate = validateApiRequest(req, {
      token, port: boundPort, priorDigests: restored.digests,
    });

    // Rule 2. Not a registered route: a route in the table is a route behind
    // the gate, and this is the one that must not be.
    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      // `check`, never the status: three of the gate's refusing exits answer
      // 403, so the status cannot say which one refused.
      //
      // **BOTH token exits are exempt here, and the second one had to be added
      // after it locked a real browser out of a real server.** The exemption
      // used to be `token-missing` alone, on the reasoning that a WRONG token
      // should still be refused. That reasoning does not survive the token
      // being kept in a cookie: cookies are scoped to a HOST, not to a port, so
      // `127.0.0.1:58901`'s cookie is sent to `127.0.0.1:58902`, and the next
      // `mycontext ui` mints a different token. The gate reads
      // `header ?? cookie`, so a fresh page arriving with a valid NONCE and a
      // stale cookie presented a mismatched token, was refused 403, and could
      // never obtain a good one — the cookie is `HttpOnly`, so the page cannot
      // clear it either. Measured: handoff with no cookie 200, handoff with a
      // stale token cookie 403.
      //
      // Exempting it costs nothing, because **the nonce is the credential on
      // this route** and it always was. A caller who cannot present an unspent
      // nonce is refused below whatever token it holds; a caller who can has
      // proven exactly what this route asks. Whatever token it happened to be
      // carrying is not evidence about either question — and the 200 response
      // overwrites that cookie, which is how the stale one is cleared.
      if (!gate.ok && gate.check !== 'token-missing' && gate.check !== 'token-mismatch') {
        refuse(req, url, gate, res);
        return;
      }
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
      // The token also goes back as a cookie, which is what makes a RELOAD
      // work: the fragment is erased on first load and the nonce is one-shot,
      // so the second load has no other credential to present. HttpOnly keeps
      // it out of reach of script — strictly tighter than the sessionStorage
      // copy the page used to keep — and SameSite=Strict keeps it off any
      // request another site started. See `TOKEN_COOKIE` in security.ts.
      //
      // No `Secure`: the server is plain http on loopback by design, and a
      // Secure cookie would simply never be stored.
      res.setHeader('set-cookie',
        `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict`);
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
