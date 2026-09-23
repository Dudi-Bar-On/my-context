/**
 * The web UI's security boundary: the session token, the one-shot handoff
 * nonce store, the per-request gate every `/api` route passes through, and the
 * two writes this module performs on the strength of that gate.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §2 (the token, the
 * custom header, Host/Origin validation) and §3, *Opening the browser* (the
 * nonce). Nothing here decides what a route may do — §2's mutator-free rule is
 * enforced by the import-graph test, not by this file.
 *
 * **This module binds `recordAudit`** (owner ruling B4, 2026-08-20, plan
 * `2026-08-16-web-ui-1-server-and-reads.md` §0.6, widened by owner ruling
 * 2026-08-28). It is no longer the only `src/ui/` module that does —
 * `execute.ts` earned its own binding on 2026-08-26, for running a catalogue
 * command — but it is still the one that carries the security GATE's own
 * writes, and there are now two of them rather than one:
 *
 *   - `recordRefusal`, on the REFUSAL path only — a request the gate said no
 *     to. This is the write Task 14's static test was written against, and the
 *     comment on that function still states its own bound in full.
 *   - `recordNonceMint`, on the MINT path `POST /api/nonce` added — a caller
 *     holding no credential handed a fresh one. See that function for why a
 *     credential coming into existence needed a second write rather than
 *     riding along inside the first.
 *
 * Task 14's static test asserts the SET of write bindings under `src/ui/` is
 * exactly the owner-ruled set — both of these plus `execute.ts`'s — so an
 * unruled third binding anywhere in this directory fails the build and so
 * does deleting a ruled one.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  recordAudit,
  type AuditWriteResult, type NonceMintDetail, type RefusalCheck, type RefusalDetail,
} from '../core/audit.ts';

/**
 * The session token: 32 random bytes, minted per invocation and held in memory
 * on both sides. It is required in a custom header on every /api request — the
 * custom header is the CSRF defence: a cross-origin form post cannot set one,
 * and with no CORS headers the browser blocks the fetch outright (spec §2).
 *
 * **The token itself is still never written anywhere.** What outlives the
 * process is its DIGEST — see `tokenDigest` below and `core/ui-sessions.ts` —
 * so a tab that was open when the server restarted is still recognised while
 * disk holds nothing anyone could present. Before that, this sentence read
 * "held in memory on both sides and nowhere else", and the price of the "and
 * nowhere else" was that a restarted server locked out every open tab
 * permanently: the reload answered 403, the stale cookie was expired, and every
 * refresh afterwards answered 401 with no way back except a nonce printed in
 * the terminal.
 */
export function mintToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * `sha256(token)`, lowercase hex — the only form of a token that is ever
 * written down.
 *
 * It lives here rather than in the store because this module owns the token,
 * and because the two must agree by construction: a store that hashed
 * differently from the gate would accept nothing and report nothing, which is
 * the lockout again wearing a different hat.
 *
 * A digest is not a credential. Presenting one is refused exactly as any other
 * wrong value is — `validateApiRequest` hashes what ARRIVES and compares that,
 * so a reader of the session file holds the answer to a question nobody asks.
 */
export function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
 * **The marker beside the token cookie: "a token cookie was issued to this
 * browser, by the server on THIS port". Script-readable, and not a
 * credential.**
 *
 * ── THE DEFECT IT CLOSES ───────────────────────────────────────────────────
 *
 * `TOKEN_COOKIE` above is `HttpOnly` by design, so `document.cookie` can never
 * show it. That is the right property for the credential and it left the page
 * unable to answer one question about itself: *do I hold a credential at all?*
 * The only way to find out was to make a request and be refused — and the
 * shell makes NINE on every boot. Measured 2026-08-29 (`plan:walk seq:85`):
 * a boot with no credential wrote ten `ui-refused` audit records, each one a
 * `BEGIN IMMEDIATE` write, and then repeated all ten the moment a nonce was
 * pasted. 5,207 of `.demo-corpus`'s 6,156 audit records, and 17% of the
 * owner's live log, were the app refusing its own boot.
 *
 * The page cannot be told "you have no credential" by a credential-less
 * request; that IS the request. So it is told by a cookie that carries no
 * credential and can therefore be read.
 *
 * ── WHY IT CARRIES THE PORT ────────────────────────────────────────────────
 *
 * Because cookies are scoped to a HOST and not to a port — the fact
 * `server.ts`'s handoff exemption already had to be widened for. Every
 * `mycontext ui` on `127.0.0.1` writes the SAME `mycontext_token` cookie name,
 * so the last server to hand one out owns it for every tab on every port. A
 * tab on the previous port sends a token the current server never issued and
 * is refused `token-mismatch` — 869 of the 5,207 records above.
 *
 * The marker is overwritten by exactly the same last-writer-wins rule, which
 * is what makes it truthful: it always names the server whose token the cookie
 * currently holds. A page whose `location.port` does not match it knows the
 * cookie is somebody else's before it spends a request finding out.
 *
 * ── WHY PUBLISHING IT IS NOT A LEAK ────────────────────────────────────────
 *
 * The value is a port number the reader's own address bar is already showing,
 * and `location.port` is readable by any script on the page regardless. It
 * proves nothing, authenticates nothing, and the gate never reads it: it is
 * not in `validateApiRequest`, and adding it there would turn a hint into a
 * credential. The token stays `HttpOnly`; this is a flag beside it, not a copy
 * of it.
 *
 * `SameSite=Strict` and `Path=/` are the token cookie's own attributes, kept
 * identical on purpose: the two are set in one response and expired in one
 * response, so they cannot drift apart into a marker that promises a
 * credential the browser no longer has.
 */
export const CREDENTIAL_COOKIE = 'mycontext_cred';

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
declare const HANDOFF_NONCE: unique symbol;

/**
 * **A handoff nonce, and NOT any other 32 hex characters.**
 *
 * The type exists because the alternative was measured and it was not a type
 * at all: both this credential and `ExecutionNonce` (`execute-nonce.ts`) were
 * plain `string`, so `handoffNonces.redeem(executionNonce)` compiled, as did
 * the mirror image. Two credentials that a compiler cannot tell apart are one
 * credential wearing two names — and this file's own header says *the nonce is
 * the credential on this route*.
 *
 * **A phantom property on an intersection, so the whole thing erases.**
 * `CONST-node-24-no-build-step` allows only syntax Node's type stripping can
 * delete, which rules out the classic runtime carriers of an invariant (a
 * wrapper class, an enum, a private constructor). A `declare const … : unique
 * symbol` plus `string & { readonly [S]: true }` costs zero bytes at run time,
 * stays a `string` everywhere a `string` is what goes on the wire or into a
 * `Map` key, and is unforgeable anywhere except the one function below.
 *
 * The brand is NOT exported and the symbol is NOT exported: `asHandoffNonce`
 * is the only way in, which is what makes the coercions greppable instead of
 * scattered `as` casts.
 */
export type HandoffNonce = string & { readonly [HANDOFF_NONCE]: true };

/**
 * **The one door.** Call it where a `string` genuinely arrives from outside
 * this process and is CLAIMED to be a handoff nonce — today that is exactly
 * one place, `POST /api/handoff`'s body in `server.ts`.
 *
 * It asserts nothing about the value and is not a validator: an unminted
 * string coerced here still refuses at `redeem`, exactly as before. What it
 * buys is that the claim is written down at the boundary rather than assumed
 * everywhere after it, so a future `redeem(someOtherToken)` is a compile error
 * unless somebody deliberately writes this name next to it.
 */
export function asHandoffNonce(raw: string): HandoffNonce {
  return raw as HandoffNonce;
}

export class NonceStore {
  #nonces = new Map<string, number>(); // nonce -> expiry epoch ms

  mint(ttlMs: number, now: number = Date.now()): HandoffNonce {
    const nonce = randomBytes(16).toString('hex');
    this.#nonces.set(nonce, now + ttlMs);
    return nonce as HandoffNonce;
  }

  redeem(nonce: HandoffNonce, now: number = Date.now()): boolean {
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

/**
 * Does this caller hold a credential THIS INSTALLATION issued?
 *
 * Two ways to be yes, and they answer different questions. The live token is
 * this process's own, compared directly — the fast path, and what every
 * script-driven caller and the whole node suite exercise. `priorDigests` are
 * tokens EARLIER processes issued, recognised by hashing what arrived: that is
 * what lets a tab which was open when the server restarted carry on, rather
 * than 401ing forever with no way to earn a new token but a nonce printed in a
 * terminal it may no longer have.
 *
 * The loop does not break early. There is nothing secret about which digest
 * matched, but a loop whose length depends on the answer is a habit worth not
 * having in this file, and eight iterations of a buffer compare costs nothing.
 */
function tokenAccepted(given: string, expected: ExpectedCredential): boolean {
  if (tokenEquals(given, expected.token)) return true;
  const priors = expected.priorDigests;
  if (priors === undefined || priors.length === 0) return false;
  const presented = tokenDigest(given);
  let matched = false;
  for (const digest of priors) if (tokenEquals(presented, digest)) matched = true;
  return matched;
}

/**
 * What the gate compares against. `priorDigests` is optional and absent means
 * an empty list — a caller that has no session store, and every existing test,
 * gets exactly the behaviour it had before this field existed.
 */
export interface ExpectedCredential {
  token: string;
  port: number;
  /** `sha256` hex of tokens issued by EARLIER runs; see `core/ui-sessions.ts`. */
  priorDigests?: readonly string[];
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
  expected: ExpectedCredential,
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
  if (!tokenAccepted(token, expected)) {
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
 * **The SECOND write this module performs — a credential coming into
 * existence, on `POST /api/nonce`** (owner ruling 2026-08-28,
 * `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 * out-the-next-one`).
 *
 * ── WHY THIS ROUTE EXISTS AT ALL ────────────────────────────────────────────
 *
 * A tab that loses its token has exactly one way back: a fresh nonce. Until
 * this route, a nonce was printed only when a server STARTS, so recovering one
 * locked-out tab meant restarting the server — which mints a new token digest,
 * evicts the oldest of the eight `~/.my-context/ui-sessions.json` remembers,
 * and can lock out a DIFFERENT tab. `mycontext ui --nonce`
 * (`src/cli/commands/ui.ts`) closes the cycle by asking a server that is
 * ALREADY RUNNING for a nonce instead, and this route is what it asks.
 *
 * ── WHY THIS IS STRICTLY MORE POWERFUL THAN `/api/handoff`, STATED HERE ─────
 *
 * `/api/handoff` EXCHANGES one credential (a nonce) for another (a token); a
 * caller holding neither cannot reach it — the nonce it redeems always came
 * from somewhere the gate already trusted (a process argv, a printed URL).
 * This route MANUFACTURES the first credential from nothing but a passing
 * Host/Origin check. The practical consequence: from the moment a server
 * starts until the moment it exits, ANY local process that can reach
 * `127.0.0.1` on this port may obtain a token at any time — not merely in the
 * seconds after startup, when a nonce used to be printed and then gone. That
 * is the residual the owner accepted in exchange for closing the lockout
 * (`README.md` §7 and `docs/README.he.md` §7 carry the same sentence, beside
 * the web UI's execute residual). Nothing below narrows that residual; this
 * function is the accountability trail FOR it.
 *
 * ── WHY IT IS A SEPARATE WRITE FROM `recordRefusal`, NOT A FIFTH CHECK ──────
 *
 * `recordRefusal` is structurally bounded to describing a REFUSAL — its own
 * comment states that bound and a static and a runtime test both hold it to
 * it. A mint is not a refusal; it is the opposite outcome, on a route the gate
 * does not even fully apply to (the token check is exempt, same as handoff).
 * Folding it into `recordRefusal` would either break that structural bound or
 * require inventing a `check`/`status` pair that lies about what happened.
 * `NonceMintDetail` (`core/audit.ts`) is the honest shape instead: no `check`,
 * no `status`, because this route has exactly one outcome and every record of
 * it means the same thing.
 *
 * Same allow-list discipline as `recordRefusal`, and the same capping — built
 * field by field, never spread, so a caller's extra property cannot ride
 * along, and a caller-supplied Host/Origin longer than any real header is
 * visibly truncated rather than let onto disk whole. **The nonce itself is
 * never recorded, in any form** — it is the credential this route exists to
 * mint, and an audit log is a file on disk.
 */
export function recordNonceMint(root: string, detail: NonceMintDetail): AuditWriteResult {
  return recordAudit(root, {
    kind: 'access',
    op: 'nonce-minted',
    nonceMint: {
      host: capRefusalValue(detail.host),
      origin: capRefusalValueOrNull(detail.origin),
    },
  });
}

/**
 * **Spec §2's response-header table, on EVERY response including the static
 * assets** — a correction to the plan's Task 13 sample, which set only
 * `Cache-Control` and dropped the other four.
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
 * alternative was a second spelling of the five headers in the one response
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
 *   - `X-Frame-Options: DENY` — see below; it carries the framing half of the
 *     DNS-rebinding defence, and it keeps carrying it now the CSP is back,
 *     because `frame-ancestors` is deliberately left out of the policy.
 *   - `Content-Security-Policy` — owner ruling E, 2026-09-21; see below for
 *     the ruling, its condition, and what the proof measured.
 *
 * One object, spread by every sender — `sendJson`, `sendRefusal` and the static
 * branch in `server.ts`, and the stream route's three heads in
 * `watch-model.ts` — so a response cannot be added that quietly ships without
 * them.
 *
 * ── THE CSP IS BACK, UNDER OWNER RULING E (2026-09-21), AND WHAT CHANGED
 *    HIS MIND WAS A MEASUREMENT AND NOT AN ARGUMENT ─────────────────────────
 *
 * The ruling, in the owner's own words: *"Content-Security-Policy on,
 * `script-src 'self'`, styles unrestricted, AND the lane proves every
 * command-executing screen (composer, palette, builder, config) still executes
 * its commands under the header before it lands."*
 *
 * It reverses `TASK-no-content-security-policy-header-and-no-meta-on-a-local`,
 * whose own framing was that the absence is *"NOT a live vulnerability … It is
 * cheap insurance for a local server that composes and executes shell
 * commands."* Nothing about that framing has been found wrong. What was
 * missing was the price of the insurance, and it is now measured rather than
 * feared. The policy sent is:
 *
 *     default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
 *     img-src 'self' data:; connect-src 'self'
 *
 * `script-src 'self'` is the directive the whole thing exists for — item
 * titles and bodies are authored by agents and by ingest and this page renders
 * them, so a stray `<img src=x onerror=…>` in a body now has nowhere to go
 * whether or not every future screen remembers to assign `textContent`. A
 * header holds when someone forgets; a convention does not.
 *
 * **"Styles unrestricted" is the ruling's phrase and `style-src 'self'
 * 'unsafe-inline'` is what it buys**: a `<style>` element may be injected to
 * try a fix in a live page, and a `style="…"` attribute is legal again. Both
 * are the friction the 2026-08-22 decision was actually paid to remove (see
 * the history below), and neither is what the header is here to stop.
 *
 * `img-src 'self' data:` and `connect-src 'self'` are the two the screens
 * need stated rather than inherited: nothing here loads an image from anywhere
 * but this server, and every `fetch` and the SSE stream go to this origin.
 *
 * **`frame-ancestors` is deliberately NOT in the policy.** `X-Frame-Options:
 * DENY` above already carries it, it is one header rather than a directive
 * with a syntax, and having the same refusal spelled twice invites the two to
 * disagree.
 *
 * ── WHAT THE PROOF MEASURED, WHICH IS THE CONDITION AND NOT A FORMALITY ────
 *
 * `e2e/csp-executes.spec.ts` drives a real command from each of the four
 * screens the ruling names — the Composer (`mycontext status`), a palette
 * catalogue entry that takes an argument (`mycontext show <id>`), Capture,
 * which is `lib/builder.js` on a screen that is not the Composer, and
 * Configure's Profile pane — and asserts the SERVER's own `execute-done` row
 * as well as the receipt the screen drew. It watches for a refusal twice over:
 * the browser console, and the `securitypolicyviolation` DOM event armed
 * before the document's first byte.
 *
 * It was run BEFORE this header existed and it was green: 8 of 8 (four screens
 * across two browser projects), 2.8 minutes, zero violations. That baseline is
 * the half of the proof that is easy to skip and impossible to reconstruct
 * afterwards — without it, a green run under the header cannot be told apart
 * from four screens that were already broken and a spec that never noticed.
 *
 * What it found on the way was NOT a CSP defect and is recorded where it was
 * found: Capture composes an `add` with no `summary` and no `--summary-omitted`
 * (`src/ui/public/screens/capture.js`' `FIELDS`), so the CLI refuses it and the
 * confirm never opens — before this header and after it, identically. That
 * phase therefore asserts the round trip it can reach and says so in its own
 * words rather than pretending to a run it cannot make.
 *
 * ── THE 2026-08-22 HISTORY, KEPT BECAUSE IT IS STILL TRUE ──────────────────
 *
 * Spec §2 specified a CSP; the owner retired it on 2026-08-22 and
 * `server-e2e.test.ts` asserted the ABSENCE so that re-adding it would be as
 * deliberate as removing it was. This is that deliberate act, and the same
 * test now asserts the exact VALUE for the same reason.
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
 * narrow path on purpose. Restoring the CSP does not block a chart, because no
 * chart was ever blocked; and `'unsafe-inline'` above means the attribute is
 * not blocked either.
 *
 * What it actually cost was reach-for-it speed: a `<style>` element could not
 * be injected to try a fix in a live page, and the mockup's `style="display:
 * none"` on the sprite had to be restated in `styles.css`. Real friction,
 * repeatedly paid, on a project whose UI is verified by looking at it — and it
 * is exactly what `style-src 'self' 'unsafe-inline'` gives back, which is why
 * the ruling could restore the half that guards agent-authored bodies without
 * restoring the half that slowed a person down.
 *
 * That split is the shape the retired block recommended for the day the CSP
 * returned, and the recommendation is honoured with one difference worth
 * naming: it proposed `style-src-elem` / `style-src-attr` as two directives.
 * The ruling says "styles unrestricted", which is one directive and no
 * question about which browser implements the pair.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    + "img-src 'self' data:; connect-src 'self'",
};

/**
 * **The static assets' cache policy, which until now was nobody's decision.**
 *
 * `TASK-nothing-is-compressed-nothing-is-cached-and-no-asset-carries` states
 * its own conclusion: *"the value here is not speed. It is that an immutable
 * asset with no `ETag` and `no-store` is a cache policy nobody chose."* One
 * `cache-control` line sat in `SECURITY_HEADERS` above with pages of argument
 * attached to the CSP beside it and not a word attached to caching, and every
 * response inherited it — the API answers, which carry corpus content, and
 * `src/ui/public/`, which carries none.
 *
 * **The split, and the line it is drawn on.** `no-store` exists so a private
 * corpus does not end up in a browser's disk cache on a shared machine. That
 * argument is about CONTENT, and the static surface has none: `src/ui/public/`
 * is the app shell and nine vendored open-source font faces. Every `/api`
 * response keeps `no-store` unchanged, with nothing about this weakened.
 *
 * **`no-cache`, not a `max-age`.** `no-cache` lets the browser KEEP the bytes
 * and forbids it serving them without asking — so every load still makes the
 * request, the server still decides, and a stale asset is impossible. A
 * `max-age` would be faster and would also mean a developer editing
 * `styles.css` gets yesterday's page with nothing on any surface saying so,
 * which is the class of silence this project keeps paying for. What is bought
 * is the BODY: measured 2026-09-15 on this repository, the assets a cold load
 * fetches are **938,336 B in 55 ms**, and with a validator a revisit fetches
 * 0 B of it and answers 304.
 *
 * `must-revalidate` is deliberately absent: it governs what a cache may do
 * once an entry is STALE, and `no-cache` leaves no entry fresh to go stale.
 */
export const STATIC_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  'cache-control': 'no-cache',
};
