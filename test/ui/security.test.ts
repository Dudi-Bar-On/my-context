import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mintToken, NonceStore, TOKEN_HEADER, validateApiRequest,
} from '../../src/ui/security.ts';

/*
 * Every assertion below carries a message, because the ones that matter here
 * compare booleans: a bare `true !== false` from a security test says which
 * line broke and nothing about which guarantee it was holding.
 */

test('mintToken returns 64 hex chars and never repeats across calls', () => {
  const a = mintToken();
  const b = mintToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b, 'two mints must not produce the same token');
});

test('a nonce redeems exactly once', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 1_000), true, 'the first redemption inside the window succeeds');
  assert.equal(store.redeem(nonce, 1_001), false, 'a nonce is one-shot: the second redemption fails');
});

test('a nonce is dead after its window', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 10_001), false, 'a nonce past its ttl must not redeem');
});

test('an unknown nonce never redeems', () => {
  const store = new NonceStore();
  store.mint(10_000, 0);
  assert.equal(store.redeem('not-a-nonce', 0), false, 'a nonce the store never minted must not redeem');
});

/**
 * A handoff nonce transits a process command line (spec section 3), so it is
 * unguessable or it is not a credential: 128 bits of hex, from `randomBytes`,
 * never the same twice.
 */
test('a minted nonce is 128 bits of hex, and two mints never collide', () => {
  const store = new NonceStore();
  const a = store.mint(10_000, 0);
  const b = store.mint(10_000, 0);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.match(b, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b, 'a nonce a caller can predict is not a credential');
});

/**
 * "Spent OR expired, it is gone either way": an expired nonce is DELETED by the
 * attempt, not left in the map for a later caller that passes a different
 * clock.
 */
test('an expired nonce is deleted, not merely late — rewinding the clock does not revive it', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 10_001), false, 'expired: must not redeem');
  assert.equal(store.redeem(nonce, 1), false, 'and it was deleted, so an earlier clock cannot redeem it either');
});

test('a nonce redeems at the exact expiry instant, and not one millisecond later', () => {
  const store = new NonceStore();
  const onTime = store.mint(10_000, 0);
  assert.equal(store.redeem(onTime, 10_000), true, 'the ttl boundary is inclusive');
  const late = store.mint(10_000, 0);
  assert.equal(store.redeem(late, 10_001), false, 'one millisecond past the boundary is expired');
});

/**
 * Two lifetimes, both one-shot: 10 seconds for the nonce in a URL the opener
 * puts on a process command line, 10 minutes for one that is only ever printed
 * (plan 1, "Design decisions", 5). A `mint` that ignored its `ttlMs` would give
 * one of the two the other's window, and the dangerous direction — the
 * command-line nonce living for ten minutes — looks like nothing at all.
 */
test('the ttl argument sets the window — a printed-URL nonce outlives an opener nonce minted with it', () => {
  const store = new NonceStore();
  const opener = store.mint(10_000, 0);
  const printed = store.mint(600_000, 0);
  assert.equal(store.redeem(opener, 10_001), false, 'a 10-second nonce is dead at 10.001s');
  assert.equal(store.redeem(printed, 10_001), true, 'a 10-minute nonce minted at the same instant is not');
  // A fresh one, because the line above spent that one: this asserts expiry, not one-shot.
  const printedAgain = store.mint(600_000, 0);
  assert.equal(store.redeem(printedAgain, 600_001), false, 'and a 10-minute nonce is dead at 600.001s');
});

test('a nonce is redeemable only at the store that minted it', () => {
  const minter = new NonceStore();
  const other = new NonceStore();
  const nonce = minter.mint(10_000, 0);
  assert.equal(other.redeem(nonce, 0), false, 'a second store must not honour another store\'s nonce');
  assert.equal(minter.redeem(nonce, 0), true, 'and the failed attempt elsewhere must not have spent it');
});

function req(
  headers: Record<string, string | string[] | undefined>,
): { headers: Record<string, string | string[] | undefined> } {
  return { headers };
}

const EXPECT = { token: 'a'.repeat(64), port: 4111 };
const HOST = '127.0.0.1:4111';

test('the exact token with the right Host passes', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(verdict, { ok: true });
});

test('a wrong token is 403', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) }), EXPECT,
  );
  assert.equal(verdict.ok, false, 'a token that is not the minted one must be refused');
  if (!verdict.ok) assert.equal(verdict.status, 403, 'a wrong token is 403');
});

test('a missing token header is 401', () => {
  const verdict = validateApiRequest(req({ host: HOST }), EXPECT);
  assert.equal(verdict.ok, false, 'a request with no token header must be refused');
  if (!verdict.ok) assert.equal(verdict.status, 401, 'a missing token header is 401');
});

test('a wrong Host is 403 even with the right token', () => {
  const verdict = validateApiRequest(
    req({ host: 'evil.example:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false, 'a Host that is not 127.0.0.1:<port> must be refused — this is the rebinding defence');
  if (!verdict.ok) assert.equal(verdict.status, 403, 'a wrong Host is 403');
});

test('a cross-origin Origin is 403; the loopback Origin and an absent Origin pass', () => {
  const bad = validateApiRequest(
    req({ host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(bad.ok, false, 'a PRESENT cross-origin Origin must be refused');
  if (!bad.ok) assert.equal(bad.status, 403, 'a cross-origin Origin is 403');
  const good = validateApiRequest(
    req({ host: HOST, origin: `http://${HOST}`, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(good, { ok: true }, 'the page\'s own Origin must pass');
  const absent = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(absent, { ok: true }, 'a same-origin GET may omit Origin, and must still pass');
});

test('localhost is not 127.0.0.1 — the page is only ever served on 127.0.0.1, so a localhost Host is refused', () => {
  const verdict = validateApiRequest(
    req({ host: 'localhost:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false, 'a `localhost` Host must be refused rather than aliased to 127.0.0.1');
});

test('a request with no Host header at all is refused', () => {
  const verdict = validateApiRequest(req({ [TOKEN_HEADER]: EXPECT.token }), EXPECT);
  assert.equal(verdict.ok, false, 'an absent Host must be refused, not treated as matching');
  if (!verdict.ok) {
    assert.equal(verdict.status, 403, 'an absent Host is 403');
    assert.match(verdict.reason, /Host/);
  }
});

/**
 * The port is half of the Host check: what it establishes is that the request
 * was addressed to the socket this server listens on, and a bare hostname
 * comparison would accept one addressed to any other port on the machine.
 */
test('the right host on the wrong port is refused', () => {
  const verdict = validateApiRequest(
    req({ host: '127.0.0.1:4112', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false, 'the Host check covers the port, not only the hostname');
  if (!verdict.ok) assert.equal(verdict.status, 403, 'a wrong port is 403');
});

/** An origin is scheme, host and port. The page is served over http on loopback. */
test('an Origin on the right host and port but the wrong scheme is refused', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, origin: `https://${HOST}`, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false, 'an Origin must match scheme, host and port — a suffix match is not an origin check');
  if (!verdict.ok) assert.equal(verdict.status, 403, 'a wrong-scheme Origin is 403');
});

/**
 * `timingSafeEqual` THROWS on buffers of unequal length, so a token of the
 * wrong length has to be refused by the length short-circuit before it reaches
 * the comparison. Without that line this is not a 403, it is an exception
 * thrown out of the security gate.
 */
test('a token of the wrong length is refused, not thrown', () => {
  for (const wrong of ['', 'a', 'a'.repeat(63), 'a'.repeat(65)]) {
    const verdict = validateApiRequest(
      req({ host: HOST, [TOKEN_HEADER]: wrong }), EXPECT,
    );
    assert.equal(verdict.ok, false, `a token of length ${wrong.length} must be refused`);
    if (!verdict.ok) assert.equal(verdict.status, 403, 'a wrong-length token is 403, not an exception');
  }
});

/**
 * The order is Host, then Origin, then token — and the status codes carry it:
 * `401` means "no token header" and nothing else. The server's `/api/handoff`
 * route is exempt from the token check alone and tells the two apart by that
 * code, so a Host refusal reported as 401 would open handoff to any Host.
 */
test('401 is the missing-token verdict and nothing else — a bad Host with no token is 403', () => {
  const badHost = validateApiRequest(req({ host: 'evil.example:4111' }), EXPECT);
  assert.equal(badHost.ok, false, 'a bad Host is refused whether or not a token was sent');
  if (!badHost.ok) {
    assert.equal(badHost.status, 403, 'Host is checked before the token, so this is 403 and not 401');
  }
  const badOrigin = validateApiRequest(
    req({ host: HOST, origin: 'https://evil.example' }), EXPECT,
  );
  assert.equal(badOrigin.ok, false, 'a bad Origin is refused whether or not a token was sent');
  if (!badOrigin.ok) {
    assert.equal(badOrigin.status, 403, 'Origin is checked before the token, so this is 403 and not 401');
  }
  const noToken = validateApiRequest(req({ host: HOST }), EXPECT);
  assert.equal(noToken.ok, false, 'a request with no token header must be refused');
  if (!noToken.ok) assert.equal(noToken.status, 401, '401 is reserved for exactly this case');
});

/** Node hands an array up for a header it does not join; the gate reads the first value. */
test('a repeated header is read as its first value, never as the whole array', () => {
  const passes = validateApiRequest(
    req({ host: [HOST, 'evil.example:4111'], [TOKEN_HEADER]: [EXPECT.token, 'b'.repeat(64)] }),
    EXPECT,
  );
  assert.deepEqual(passes, { ok: true }, 'the first value of each repeated header decides');
  const refused = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: ['b'.repeat(64), EXPECT.token] }), EXPECT,
  );
  assert.equal(refused.ok, false, 'a right token behind a wrong first value must not pass');
});

/**
 * A refusal that does not say which check refused is a refusal nobody can
 * debug — so each reason is pinned to its exact text AND to the check it has
 * to name. The exact text is the weaker of the two on its own (a rename that
 * kept the meaning would fail it for nothing), which is why `names` is still
 * asserted beside it: that one survives rewording and dies if a reason stops
 * identifying its check. `new RegExp(TOKEN_HEADER)` is deliberate — the
 * missing-token reason spells the header out as a literal, and this is what
 * catches it drifting apart from the constant the gate actually reads.
 */
test('every refusal names the check that refused it', () => {
  const cases: { headers: Record<string, string>; is: string; names: RegExp }[] = [
    {
      headers: { host: 'evil.example:4111' },
      is: 'Host header did not match the expected loopback host and port',
      names: /Host/,
    },
    {
      headers: { host: HOST, origin: 'https://evil.example' },
      is: 'Origin header did not match the expected scheme, host and port',
      names: /Origin/,
    },
    {
      headers: { host: HOST },
      is: 'missing x-mycontext-token header',
      names: new RegExp(TOKEN_HEADER),
    },
    {
      headers: { host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) },
      is: 'wrong token',
      names: /token/,
    },
  ];
  for (const { headers, is, names } of cases) {
    const verdict = validateApiRequest(req(headers), EXPECT);
    assert.equal(verdict.ok, false, `these headers must be refused: ${JSON.stringify(headers)}`);
    if (!verdict.ok) {
      assert.equal(verdict.reason, is, `the reason for ${JSON.stringify(headers)} is a fixed string`);
      assert.match(verdict.reason, names, `the reason must name what refused ${JSON.stringify(headers)}`);
    }
  }
});

/**
 * The reasons are developer-facing and never rendered, and they deliberately
 * carry no submitted input — they used to (`Host "evil.example:4111" is not
 * …`). What this test defends is that decision, not a hole: the response is a
 * JSON body under `default-src 'none'`, so the echo was never an XSS vector,
 * it simply bought nothing. What a developer needs is WHICH check refused, and
 * the sender already knows what it sent.
 *
 * So the marker below stands in for anything an attacker chooses to put in a
 * header. If a later change interpolates the Host, the Origin or the token
 * back into a message "to make debugging easier", this goes red and says so.
 * The submitted value belongs in an audit record if anything wants it kept —
 * not in a string handed back to the party that supplied it.
 */
test('a refusal reason never echoes the submitted value back', () => {
  const marker = 'echo-probe-9f3c1d';
  const cases: Record<string, string>[] = [
    { host: `${marker}.example:4111` },
    { host: HOST, origin: `https://${marker}.example` },
    // Short enough to be refused by the length short-circuit ...
    { host: HOST, [TOKEN_HEADER]: marker },
    // ... and long enough to reach the comparison itself.
    { host: HOST, [TOKEN_HEADER]: marker.padEnd(64, 'f') },
  ];
  for (const headers of cases) {
    const verdict = validateApiRequest(req(headers), EXPECT);
    assert.equal(verdict.ok, false, `these headers must be refused: ${JSON.stringify(headers)}`);
    if (!verdict.ok) {
      assert.equal(
        verdict.reason.includes(marker), false,
        `the reason for ${JSON.stringify(headers)} must not echo the submitted value: ${verdict.reason}`,
      );
    }
  }
});
