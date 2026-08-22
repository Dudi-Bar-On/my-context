/**
 * The web UI's security boundary: the session token, the one-shot handoff
 * nonce store, the per-request gate every `/api` route passes through, and the
 * one write this read-only surface performs.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §2 (the token, the
 * custom header, Host/Origin validation) and §3, *Opening the browser* (the
 * nonce). Nothing here decides what a route may do — §2's mutator-free rule is
 * enforced by the import-graph test, not by this file.
 *
 * **This module binds `recordAudit`, and it is the only module under `src/ui/`
 * that may** (owner ruling B4, 2026-08-20, plan
 * `2026-08-16-web-ui-1-server-and-reads.md` §0.6). The UI is a read-only
 * surface; `recordRefusal` below is the single exception, it fires on the
 * REFUSAL path only, and Task 14's static test asserts the set of write
 * bindings under `src/ui/` is *exactly* this one — so a second binding fails
 * the build and so does deleting this one.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  recordAudit,
  type AuditWriteResult, type RefusalCheck, type RefusalDetail,
} from '../core/audit.ts';

/**
 * The session token: 32 random bytes, minted per invocation, held in memory
 * on both sides and nowhere else. It is required in a custom header on every
 * /api request — the custom header is the CSRF defence: a cross-origin form
 * post cannot set one, and with no CORS headers the browser blocks the fetch
 * outright (spec §2).
 */
export function mintToken(): string {
  return randomBytes(32).toString('hex');
}

/** Node lower-cases incoming header names; the page sends `X-Mycontext-Token`. */
export const TOKEN_HEADER = 'x-mycontext-token';

/**
 * The same token, carried as a cookie, so that A RELOAD ALWAYS WORKS.
 *
 * Owner ruling, 2026-08-22: "the refresh issue should not exist anymore, don't
 * matter what refresh will show the page correct, if there is a security issue
 * it should be solved in a way that will not destruct the page view."
 *
 * The handoff nonce is one-shot by design and the fragment carrying it is
 * erased on first load, so the SECOND load has nothing to present. The page
 * kept a copy in `sessionStorage`, which bought a reload in the same tab and
 * nothing else: a second tab on the same origin, or a tab whose storage was
 * cleared, still arrived with no credential and was told "The server has
 * exited" — which was false, and is a sentence a person cannot act on.
 *
 * **The cookie is STRICTLY MORE SECURE than the sessionStorage copy it
 * replaces**, which is worth stating plainly because "add a cookie" usually
 * reads as the other direction:
 *
 *   - `HttpOnly` — script cannot read it. The `sessionStorage` copy was
 *     readable by anything running on the page; this is not. Since the page
 *     renders agent-authored item bodies, that is the exact exposure worth
 *     removing.
 *   - `SameSite=Strict` — never attached to a request another site initiated.
 *   - The Host and Origin checks above are UNCHANGED and still run first, so
 *     the DNS-rebinding and cross-origin defences do not depend on this at all.
 *
 * What it does not change: the nonce is still one-shot, and a token is still
 * only ever issued by redeeming one. This is where the credential is kept, not
 * how it is earned.
 */
export const TOKEN_COOKIE = 'mycontext_token';

/**
 * One cookie's value out of a `Cookie` header, or `undefined`.
 *
 * Hand-parsed rather than depending on a parser: this project ships zero
 * runtime dependencies. The header is `name=value; name=value`, values here
 * are hex from `randomBytes`, and anything that does not split cleanly on the
 * first `=` is skipped rather than guessed at.
 */
export function cookieValue(header: string | string[] | undefined, name: string): string | undefined {
  const raw = typeof header === 'string' ? header : undefined;
  if (raw === undefined) return undefined;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

/**
 * One-shot handoff nonces (spec §3, "Opening the browser"). A nonce is minted
 * with its own ttl — 10 seconds for a URL that transits a process command
 * line, longer for a URL that is only ever printed — and redeems at most
 * once.
 *
 * A nonce is deleted the moment redemption is ATTEMPTED — spent or expired, it
 * is gone either way — which is what makes redemption one-shot. Nothing sweeps
 * a nonce that is never presented at all, and nothing needs to: the store is
 * bounded by the handful of `mint` calls a single invocation makes, and it
 * dies with the process.
 */
export class NonceStore {
  #nonces = new Map<string, number>(); // nonce -> expiry epoch ms

  mint(ttlMs: number, now: number = Date.now()): string {
    const nonce = randomBytes(16).toString('hex');
    this.#nonces.set(nonce, now + ttlMs);
    return nonce;
  }

  redeem(nonce: string, now: number = Date.now()): boolean {
    const expiry = this.#nonces.get(nonce);
    if (expiry === undefined) return false;
    this.#nonces.delete(nonce); // one-shot: spent OR expired, it is gone either way
    return now <= expiry;
  }
}

/** Constant-time comparison; length mismatch short-circuits (length is not secret here). */
function tokenEquals(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The per-request gate (spec §2): Host validated always, Origin validated
 * when the browser sends one (same-origin GETs may omit it; a PRESENT
 * mismatched Origin is always refused), token validated last. The server
 * binds 127.0.0.1 and the page is only ever opened on 127.0.0.1, so
 * `localhost` spellings are refused rather than aliased — an allowance for a
 * second spelling is a second thing to audit.
 *
 * The status codes are load-bearing beyond this function: `401` is returned
 * for a missing token header and for nothing else, which is how the server's
 * `/api/handoff` exemption tells "no token yet" apart from a Host or Origin
 * refusal it must never let through.
 *
 * **`check` is what the caller acts on; `reason` is what a developer reads.**
 * Three of the four checks answer `403`, so the status cannot identify which
 * one refused, and the audit record needs exactly that (owner ruling B4, plan
 * §0.6). `check` is a closed vocabulary a reader can filter the log on;
 * `reason` is prose about it and never leaves this process.
 *
 * **The two Host refusals are two different literals — owner ruling C6,
 * 2026-08-20.** *"No Host header at all"* and *"a Host that is not loopback"*
 * are different failures. They used to be told apart by the submitted value
 * interpolated into the reason; ruling 11 dropped that echo and collapsed both
 * onto one fixed string, and a log that cannot tell them apart is worth less.
 * So there are now FIVE refusing exits and still four `RefusalCheck` values:
 * both Host exits carry `check: 'host'`, and what separates them in the record
 * is `RefusalDetail.host` — `null` when the header was absent, the submitted
 * value when it was present and wrong. (Plan §0.6 field rule 1 says the four
 * values map one-to-one onto four refusing returns. Ruling C6 makes that
 * sentence false: the mapping is onto, not one-to-one. Named here rather than
 * left for a reader to trip over.)
 *
 * `reason` is DEVELOPER-FACING and is never rendered. Each one is a fixed
 * literal naming the check that refused, and carries no submitted input — not
 * the Host, not the Origin, not the token. Two things a later change must not
 * undo:
 *
 * - **It does not go on screen.** The UI renders from the mockup's string
 *   tables, and these strings have no key there precisely because nothing
 *   renders them. A surface that wants to tell a *user* why a request was
 *   refused needs its own table key, not this string.
 * - **The submitted value does not come back.** These reasons used to echo it
 *   (`Host "evil.example:4111" is not …`). That was not an XSS vector — the
 *   response is a JSON body under `default-src 'none'` — it just bought
 *   nothing: what a developer needs is WHICH check refused, and the sender
 *   already knows what it sent. If something ever wants the submitted value
 *   kept, it belongs in an audit record, not in a string handed back to the
 *   party that supplied it. **That record now exists** — `recordRefusal` below
 *   is it (owner ruling B4, plan §0.6), and it is where the submitted `Host`
 *   and `Origin` are kept.
 */
export function validateApiRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  expected: { token: string; port: number },
): { ok: true } | { ok: false; status: number; check: RefusalCheck; reason: string } {
  const wantHost = `127.0.0.1:${expected.port}`;
  const host = headerValue(req.headers.host);
  // Ruling C6: absent and wrong are two failures, so they are two literals. An
  // EMPTY Host (`''`) is a Host that WAS sent and is not loopback, so it takes
  // the second — and the record's `host: ''` is what says it arrived empty.
  if (host === undefined) {
    return { ok: false, status: 403, check: 'host', reason: 'no Host header was sent' };
  }
  if (host !== wantHost) {
    return { ok: false, status: 403, check: 'host', reason: 'Host header did not match the expected loopback host and port' };
  }
  const origin = headerValue(req.headers.origin);
  if (origin !== undefined && origin !== `http://${wantHost}`) {
    return { ok: false, status: 403, check: 'origin', reason: 'Origin header did not match the expected scheme, host and port' };
  }
  // Header first, cookie second. The header is what a script-driven caller
  // sends and what the node suite exercises; the cookie is what a RELOADED page
  // has, because the nonce that earned the header is long spent. Either proves
  // the same thing — that this caller redeemed a nonce — so either is accepted.
  const token = headerValue(req.headers[TOKEN_HEADER])
    ?? cookieValue(req.headers.cookie, TOKEN_COOKIE);
  if (token === undefined) {
    return {
      ok: false, status: 401, check: 'token-missing',
      reason: `missing ${TOKEN_HEADER} header and ${TOKEN_COOKIE} cookie`,
    };
  }
  if (!tokenEquals(token, expected.token)) {
    return { ok: false, status: 403, check: 'token-mismatch', reason: 'wrong token' };
  }
  return { ok: true };
}

/**
 * The cap on every caller-supplied string this module writes to disk.
 *
 * 256 characters, and a capped value is stored as its first 256 followed by
 * `'…'` — VISIBLY truncated, so a reader cannot mistake it for what was sent
 * (plan §0.6 field rule 3).
 */
export const REFUSAL_VALUE_MAX = 256;

/** The marker that makes a capped value unmistakable. One character, appended. */
const REFUSAL_TRUNCATED = '…';

function capRefusalValue(value: string): string {
  if (value.length <= REFUSAL_VALUE_MAX) return value;
  return `${value.slice(0, REFUSAL_VALUE_MAX)}${REFUSAL_TRUNCATED}`;
}

/** `null` is the ABSENT header and stays absent; `''` was sent empty and stays empty. */
function capRefusalValueOrNull(value: string | null): string | null {
  return value === null ? null : capRefusalValue(value);
}

/**
 * `url.pathname` and nothing after it (plan §0.6 field rule 4).
 *
 * The caller is told to pass `url.pathname`; this is what makes that a
 * PROPERTY rather than an instruction. A query string is unbounded
 * caller-supplied data answering no question this record asks, and the one
 * thing that must never happen to it is reaching a file on disk because some
 * later call site passed `req.url` instead. Structure beats a comment — the
 * same reasoning ruling A4 applied to the refusal body.
 */
function refusalRoute(route: string): string {
  const query = route.indexOf('?');
  return query === -1 ? route : route.slice(0, query);
}

/** The four checks and the two codes a REFUSAL can carry. Guarded, see below. */
const REFUSAL_CHECKS: readonly RefusalCheck[] = ['host', 'origin', 'token-missing', 'token-mismatch'];
const REFUSAL_STATUSES: readonly number[] = [401, 403];

/**
 * **The one write this read-only surface performs** (owner ruling B4,
 * 2026-08-20, plan §0.6). One `access` record naming the check that refused and
 * carrying the submitted `Host` and `Origin` — the destination ruling 11 named
 * for the submitted value when it took it out of `reason`.
 *
 * **It cannot be made to record a served read, and that is structural.** The
 * tension with the plan's read-only premise is resolved by a bound that can be
 * CHECKED rather than promised: a record whose `status` is not `401` or `403`,
 * or whose `check` is not one of the four, does not describe a refusal and is
 * refused here rather than written. A later call site that moved this call onto
 * the success path could not quietly produce a log entry — it would have to
 * invent a refusal status first. Task 13's byte-identical corpus assertion
 * proves the same bound from the outside, over real HTTP.
 *
 * **The token is never recorded, in any form** — not the value, not its length,
 * not a prefix, not a hash (field rule 5). The record is built field by field
 * from an ALLOW-LIST below rather than spread from the argument, because the
 * argument is assembled from request headers by a caller this module does not
 * own, and a spread would carry through whatever else that caller put on it.
 *
 * **Capping and the absent-versus-empty distinction live here**, so every
 * caller gets them: `null` is a header that was not sent, `''` is one sent
 * empty, and anything past `REFUSAL_VALUE_MAX` is visibly truncated.
 *
 * **Synchronous, and never throws.** `recordAudit` appends and returns
 * `{ written: false, error }` on failure, so this is called BEFORE the response
 * goes out (field rule 7) and a refusal cannot be answered and then lost. The
 * `AuditWriteResult` is returned for the same reason `recordAudit` returns it —
 * and the server DISCARDS it, exactly as the hooks discard theirs (field rule
 * 8): there is no one to tell, and telling the refused party would be the echo
 * ruling 11 removed. A log that has stopped being writable stays discoverable
 * through `doctor`'s `audit_log_size` check.
 */
export function recordRefusal(root: string, refusal: RefusalDetail): AuditWriteResult {
  if (!REFUSAL_CHECKS.includes(refusal.check) || !REFUSAL_STATUSES.includes(refusal.status)) {
    return {
      written: false,
      error:
        `not a refusal: an \`access\` record describes a request the gate REFUSED, so its check ` +
        `must be one of ${REFUSAL_CHECKS.join(', ')} and its status one of ` +
        `${REFUSAL_STATUSES.join(', ')}; got ${JSON.stringify(refusal.check)} and ` +
        `${JSON.stringify(refusal.status)}. Nothing was written — the web UI writes on the ` +
        `refusal path and nowhere else (plan section 0.6).`,
    };
  }
  return recordAudit(root, {
    kind: 'access',
    op: 'ui-refused',
    // Field by field, never `...refusal`: this is the allow-list that keeps a
    // caller's extra property — a token above all — off the disk.
    refusal: {
      check: refusal.check,
      status: refusal.status,
      method: capRefusalValue(refusal.method),
      route: capRefusalValue(refusalRoute(refusal.route)),
      host: capRefusalValueOrNull(refusal.host),
      origin: capRefusalValueOrNull(refusal.origin),
    },
  });
}

/**
 * **Spec §2's response-header table, on EVERY response including the static
 * assets** — a correction to the plan's Task 13 sample, which set only
 * `Cache-Control` and dropped the other three.
 *
 * They are not decoration and one of them was already being asserted as a fact:
 * this module explains above that echoing a submitted value in a refusal reason
 * "was not an XSS vector — the response is a JSON body under
 * `default-src 'none'`", which was a claim about a header nothing sent.
 * `static.ts` states the other side of the same contract — it sets no
 * `Cache-Control` and no `Content-Security-Policy` because "headers are the
 * caller's (Task 13)". `server.ts` is that caller, so spreading this object is
 * where the claim becomes true.
 *
 * **It lives HERE rather than in `server.ts`, where it was written, because a
 * second sender arrived that `server.ts` cannot reach.** `watch-model.ts`'s SSE
 * route writes its own head — the dispatch loop hands a `kind: 'stream'`
 * handler the raw `ServerResponse` — and `server.ts` already imports that
 * module to register its routes, so importing back would be a cycle. The
 * alternative was a second spelling of the four headers in the one response
 * this file's own sentence below says cannot be allowed to ship without them.
 *
 * Why each, in the spec's own words:
 *
 *   - `X-Content-Type-Options: nosniff` — an item body served as JSON must
 *     never be sniffed into HTML.
 *   - `Referrer-Policy: no-referrer` — nothing about a local corpus belongs in
 *     a referrer.
 *   - `Cache-Control: no-store` — the corpus is not public and the server is
 *     ephemeral; a cached response outliving the token is a leak with no
 *     upside. The spec scopes this one to `/api`; it is sent on the static
 *     assets too, because `static.ts`'s interface hands the caller that
 *     decision and an ephemeral app has nothing worth revalidating.
 *   - `X-Frame-Options: DENY` — see below; it stands in for one property the
 *     retired CSP used to carry.
 *
 * One object, spread by every sender — `sendJson`, `sendRefusal` and the static
 * branch in `server.ts`, and the stream route's three heads in
 * `watch-model.ts` — so a response cannot be added that quietly ships without
 * them.
 *
 * ── THE CSP IS SUSPENDED, DELIBERATELY ─────────────────────────────────────
 *
 * Spec §2 specifies a `Content-Security-Policy` and this object no longer
 * sends one. **That is an owner's decision taken on 2026-08-22, not an
 * oversight, and `server-e2e.test.ts` asserts the ABSENCE** so that re-adding
 * it is as deliberate as removing it was and neither can happen by drift.
 *
 * What it did NOT cost, measured rather than assumed. It is tempting to say a
 * strict `style-src` stops a chart drawing a bar whose length is a number. It
 * does not, and the difference was settled in a browser on 2026-08-22 against
 * this very server while it was still sending the policy:
 *
 *     el.style.setProperty('display', 'flex')   ->  computed "flex"   ALLOWED
 *     el.setAttribute('style', 'display:flex')  ->  computed "block"  BLOCKED
 *
 * `style-src` governs the style ATTRIBUTE and stylesheets. It does not govern
 * the CSSOM. So the nine `setProperty` calls under `src/ui/public/screens/`
 * were never blocked, and `screens/parts.js` says why in its own header — "No
 * `innerHTML`, and no `style` attribute" — the screens were written to the
 * narrow path on purpose. Retiring the CSP does not unblock a chart, because no
 * chart was blocked.
 *
 * What it actually cost was reach-for-it speed: a `<style>` element could not
 * be injected to try a fix in a live page, and the mockup's `style="display:
 * none"` on the sprite had to be restated in `styles.css`. Real friction,
 * repeatedly paid, on a project whose UI is verified by looking at it.
 *
 * What it was buying. `script-src 'self'` was the directive this CSP existed
 * for: item titles and bodies are authored by agents and by ingest, and the
 * page renders them, so a stray `<img src=x onerror=…>` in a body had nowhere
 * to go. **That protection is now off.** The mitigation that remains is in the
 * renderer rather than the header — the page builds nodes and assigns
 * `textContent`; it does not assemble markup from item text. That is a weaker
 * guarantee than a header, because it holds only as long as every future
 * screen keeps doing it, and a header holds even when someone forgets.
 *
 * `frame-ancestors 'none'` was the second thing lost, and it is the framing
 * half of the DNS-rebinding defence for a server that binds a loopback port and
 * holds a private corpus. It is restored by `X-Frame-Options: DENY`, which is
 * one header, needs no policy language, and cannot block anything a developer
 * is trying to do — it only refuses to be put in someone else's frame.
 *
 * If the CSP returns, `script-src 'self'` is the directive worth having back
 * and it costs a developer nothing. Should the style half return with it, name
 * the two halves separately — `style-src-elem 'self'` to keep a stylesheet from
 * being injected, `style-src-attr 'unsafe-inline'` for the attribute — so that
 * a live experiment stays possible without reopening what guards agent-authored
 * bodies.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
};
