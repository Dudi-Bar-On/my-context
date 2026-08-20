/**
 * The web UI's security boundary: the session token, the one-shot handoff
 * nonce store, and the per-request gate every `/api` route passes through.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §2 (the token, the
 * custom header, Host/Origin validation) and §3, *Opening the browser* (the
 * nonce). Nothing here decides what a route may do — §2's mutator-free rule is
 * enforced by the import-graph test, not by this file.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

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
 */
export function validateApiRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  expected: { token: string; port: number },
): { ok: true } | { ok: false; status: number; reason: string } {
  const wantHost = `127.0.0.1:${expected.port}`;
  const host = headerValue(req.headers.host);
  if (host !== wantHost) {
    return { ok: false, status: 403, reason: `Host ${JSON.stringify(host ?? '')} is not ${wantHost}` };
  }
  const origin = headerValue(req.headers.origin);
  if (origin !== undefined && origin !== `http://${wantHost}`) {
    return { ok: false, status: 403, reason: `Origin ${JSON.stringify(origin)} is not http://${wantHost}` };
  }
  const token = headerValue(req.headers[TOKEN_HEADER]);
  if (token === undefined) {
    return { ok: false, status: 401, reason: `missing ${TOKEN_HEADER} header` };
  }
  if (!tokenEquals(token, expected.token)) {
    return { ok: false, status: 403, reason: 'wrong token' };
  }
  return { ok: true };
}
