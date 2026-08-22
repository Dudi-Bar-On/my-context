import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHash, randomBytes as cryptoRandomBytes,
} from 'node:crypto';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  mintToken, NonceStore, recordRefusal, REFUSAL_VALUE_MAX, TOKEN_HEADER, validateApiRequest,
} from '../../src/ui/security.ts';
import {
  auditLogPath, readAudit,
  type AuditRecord, type RefusalCheck, type RefusalDetail,
} from '../../src/core/audit.ts';
import { removeTree } from '../helpers/tmp.ts';

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
  const cases: {
    headers: Record<string, string>; is: string; names: RegExp; check: RefusalCheck;
  }[] = [
    {
      headers: {},
      is: 'no Host header was sent',
      names: /Host/,
      check: 'host',
    },
    {
      headers: { host: 'evil.example:4111' },
      is: 'Host header did not match the expected loopback host and port',
      names: /Host/,
      check: 'host',
    },
    {
      headers: { host: HOST, origin: 'https://evil.example' },
      is: 'Origin header did not match the expected scheme, host and port',
      names: /Origin/,
      check: 'origin',
    },
    {
      headers: { host: HOST },
      // Names BOTH credentials it looked for. A reloaded page has no header
      // and is authenticated by the cookie instead, so a refusal that mentioned
      // only the header would send a reader hunting for the wrong thing.
      is: 'missing x-mycontext-token header and mycontext_token cookie',
      names: new RegExp(TOKEN_HEADER),
      check: 'token-missing',
    },
    {
      headers: { host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) },
      is: 'wrong token',
      names: /token/,
      check: 'token-mismatch',
    },
  ];
  for (const { headers, is, names, check } of cases) {
    const verdict = validateApiRequest(req(headers), EXPECT);
    assert.equal(verdict.ok, false, `these headers must be refused: ${JSON.stringify(headers)}`);
    if (!verdict.ok) {
      assert.equal(verdict.reason, is, `the reason for ${JSON.stringify(headers)} is a fixed string`);
      assert.match(verdict.reason, names, `the reason must name what refused ${JSON.stringify(headers)}`);
      assert.equal(
        verdict.check, check,
        `the check for ${JSON.stringify(headers)} must be ${check}: three of the four answer 403, `
        + 'so a caller cannot infer it from the status, and the audit record needs exactly this',
      );
    }
  }
});

/**
 * OWNER RULING C6, 2026-08-20 — the two Host refusals are two literals.
 *
 * They were told apart by the submitted value interpolated into the reason
 * (`Host "evil.example:4111" is not …`) until ruling 11 dropped that echo,
 * which collapsed both onto one fixed string. *"No Host header at all"* and
 * *"a Host that is not loopback"* are different failures, and a log that
 * cannot tell them apart is worth less. Neither literal carries submitted
 * input — that is what the echo test below still enforces on both.
 */
test('C6: an absent Host and a wrong Host are two DIFFERENT fixed reasons', () => {
  const absent = validateApiRequest(req({ [TOKEN_HEADER]: EXPECT.token }), EXPECT);
  const wrong = validateApiRequest(
    req({ host: 'evil.example:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(absent.ok, false, 'an absent Host must be refused');
  assert.equal(wrong.ok, false, 'a non-loopback Host must be refused');
  if (absent.ok || wrong.ok) return;

  assert.equal(absent.reason, 'no Host header was sent');
  assert.equal(wrong.reason, 'Host header did not match the expected loopback host and port');
  assert.notEqual(
    absent.reason, wrong.reason,
    'ruling C6: "no Host header at all" and "a Host that is not loopback" are different failures, '
    + 'and collapsing them back onto one string is exactly what this ruling reversed',
  );
  // Both are still the same CHECK — see the RefusalCheck comment in audit.ts.
  assert.equal(absent.check, 'host', 'an absent Host is still the Host check');
  assert.equal(wrong.check, 'host', 'a wrong Host is still the Host check');
  // An EMPTY Host was sent, so it is "present and not loopback", not "absent".
  const empty = validateApiRequest(req({ host: '', [TOKEN_HEADER]: EXPECT.token }), EXPECT);
  assert.equal(empty.ok, false, 'an empty Host must be refused');
  if (!empty.ok) {
    assert.equal(
      empty.reason, wrong.reason,
      'a Host sent EMPTY was sent — it takes the not-loopback reason, and the record\'s '
      + '`host: ""` is what says it arrived empty',
    );
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

// ---------------------------------------------------------------------------
// `recordRefusal` — OWNER RULING B4, 2026-08-20 (plan section 0.6).
//
// The ONE write this read-only surface performs. Everything below reads the
// record back OFF DISK rather than trusting the value handed to `recordAudit`:
// the field rules are about what a file on someone's machine ends up holding,
// and an assertion against an in-memory object cannot see a serializer.
// ---------------------------------------------------------------------------

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ui-refusal-'));
  return { root, dispose: () => removeTree(root) };
}

/** The raw bytes of the live log — what a reader of the FILE sees. */
function rawLog(root: string): string {
  try {
    return readFileSync(auditLogPath(root), 'utf8');
  } catch {
    return '';
  }
}

/** Every record, parsed back off disk by the project's own reader. */
function onDisk(root: string): AuditRecord[] {
  return readAudit(root);
}

/** The single `access` record on disk, or a failure naming how many there were. */
function soleAccessRecord(root: string): AuditRecord {
  const access = onDisk(root).filter((r) => r.kind === 'access');
  assert.equal(access.length, 1, `expected exactly one access record, found ${access.length}`);
  return access[0]!;
}

/** The FIRST value of a repeated header — the same value the gate judged. */
const headerFirst = (v: string | string[] | undefined): string | null =>
  v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;

/**
 * What the server's `refuse()` does, reduced to the two lines this module owns
 * (plan Task 13): validate, and on a refusal record BEFORE answering. The
 * server does not exist on this branch yet, so this is how the unit suite
 * exercises the composition the ruling actually ships.
 */
function gate(
  root: string,
  headers: Record<string, string | string[] | undefined>,
  target = '/api/ping',
  method = 'GET',
): { ok: true } | { ok: false; status: number; check: RefusalCheck; reason: string } {
  const verdict = validateApiRequest(req(headers), EXPECT);
  if (verdict.ok) return verdict;
  const url = new URL(target, `http://${HOST}`);
  recordRefusal(root, {
    check: verdict.check,
    status: verdict.status as 401 | 403,
    method,
    route: url.pathname,
    host: headerFirst(headers.host),
    origin: headerFirst(headers.origin),
  });
  return verdict;
}

/** Every file under `dir`, relative POSIX path -> sha256 of its bytes. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (abs: string, rel: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(abs);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const full = path.join(abs, entry);
      const key = rel === '' ? entry : `${rel}/${entry}`;
      if (statSync(full).isDirectory()) walk(full, key);
      else out[key] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(dir, '');
  return out;
}

/** The four gate checks, each with the headers that reach it. */
const REFUSAL_CASES: { check: RefusalCheck; status: 401 | 403; headers: Record<string, string> }[] = [
  {
    check: 'host', status: 403,
    headers: { host: 'evil.example:4111', [TOKEN_HEADER]: EXPECT.token },
  },
  {
    check: 'origin', status: 403,
    headers: { host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: EXPECT.token },
  },
  { check: 'token-missing', status: 401, headers: { host: HOST } },
  {
    check: 'token-mismatch', status: 403,
    headers: { host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) },
  },
];

test('B4: each of the four checks writes one access record, read back off disk', () => {
  for (const { check, status, headers } of REFUSAL_CASES) {
    const b = box();
    try {
      const verdict = gate(b.root, headers, '/api/items');
      assert.equal(verdict.ok, false, `${check} must refuse`);

      assert.equal(
        rawLog(b.root).split('\n').filter((l) => l !== '').length, 1,
        `${check}: one refused request appends exactly one line`,
      );
      const record = soleAccessRecord(b.root);
      assert.equal(record.kind, 'access', `${check}: the fifth kind, not mutation/injection/hook/focus`);
      assert.equal(record.op, 'ui-refused', `${check}: the one access op`);
      assert.deepEqual(record.refusal, {
        check,
        status,
        method: 'GET',
        route: '/api/items',
        host: headerFirst(headers.host),
        origin: headerFirst(headers.origin),
      }, `${check}: the record carries the check, the code the sender got, and what was submitted`);
    } finally {
      b.dispose();
    }
  }
});

/**
 * Field rule 6: an `access` record carries no `AuditRecord.origin`, no
 * `itemId` and no `sessionId` — a refused request has none of them — and
 * `AuditRecord.origin` and `RefusalDetail.origin` are different things kept
 * apart by the NESTING. An equality on the key set, not a spot check: a field
 * that leaks in later fails here rather than being noticed by nobody.
 */
test('B4: an access record carries exactly protocol, at, kind, op and refusal', () => {
  const b = box();
  try {
    gate(b.root, { host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: EXPECT.token });
    const record = soleAccessRecord(b.root);
    assert.deepEqual(
      Object.keys(record).sort(), ['at', 'kind', 'op', 'protocol', 'refusal'],
      'a refused request has no item, no session and no mutation origin — and the HTTP Origin '
      + 'lives inside `refusal`, where it cannot collide with `AuditRecord.origin`',
    );
    assert.equal(
      record.origin, undefined,
      'AuditRecord.origin means WHO MADE A MUTATION; an access record must not set it',
    );
    assert.equal(
      (record.refusal as RefusalDetail).origin, 'https://evil.example',
      'the HTTP Origin belongs to the nested RefusalDetail',
    );
    assert.match(record.at, /^\d{4}-\d\d-\d\dT.*Z$/, 'stamped UTC ISO-8601 like every other record');
  } finally {
    b.dispose();
  }
});

/**
 * Field rule 2: `null` means the header was not sent — normal for `Origin` on
 * a same-origin GET, and itself the fact a reader needs — and `''` means it
 * was sent empty. A record that folded one into the other would answer "was a
 * Host sent?" wrongly, which is the whole question the C6 split exists for.
 */
test('B4: an ABSENT header records null and an EMPTY one records the empty string', () => {
  const b = box();
  try {
    gate(b.root, { [TOKEN_HEADER]: EXPECT.token });
    const record = soleAccessRecord(b.root);
    assert.equal((record.refusal as RefusalDetail).host, null, 'no Host header was sent: null');
    assert.equal((record.refusal as RefusalDetail).origin, null, 'no Origin header was sent: null');
    assert.match(rawLog(b.root), /"host":null/, 'and it is a JSON null on disk, not an omitted key');
  } finally {
    b.dispose();
  }

  const c = box();
  try {
    gate(c.root, { host: '', origin: '', [TOKEN_HEADER]: EXPECT.token });
    const record = soleAccessRecord(c.root);
    assert.equal(
      (record.refusal as RefusalDetail).host, '',
      'a Host sent empty is not the same fact as a Host not sent, and the record must not merge them',
    );
    assert.match(rawLog(c.root), /"host":""/, 'the empty string survives serialization as itself');
  } finally {
    c.dispose();
  }
});

/**
 * Field rule 2, second half: where the gate read the FIRST value of a repeated
 * header, the record carries that same first value — so the log says what the
 * gate JUDGED rather than what the socket carried.
 */
test('B4: a repeated header is recorded as the first value, the one the gate judged', () => {
  const b = box();
  try {
    gate(b.root, { host: ['evil.example:4111', HOST], [TOKEN_HEADER]: EXPECT.token });
    const record = soleAccessRecord(b.root);
    assert.equal(
      (record.refusal as RefusalDetail).host, 'evil.example:4111',
      'the gate judged the first value, so the record must name the first value',
    );
  } finally {
    b.dispose();
  }
});

/**
 * Field rule 3: `host`, `origin` and `route` are capped at
 * `REFUSAL_VALUE_MAX`, and a capped value is VISIBLY truncated — first 256
 * characters then the marker. Visibly, because a silently clipped value can be
 * misread as what was sent, and a refusal record whose whole job is "what was
 * submitted" must not lie about it.
 */
test('B4: host, origin and route are capped, and a capped value says so', () => {
  const b = box();
  try {
    const long = 'z'.repeat(REFUSAL_VALUE_MAX * 3);
    recordRefusal(b.root, {
      check: 'host',
      status: 403,
      method: 'GET',
      route: `/api/${long}`,
      host: `${long}.example:4111`,
      origin: `https://${long}.example`,
    });
    const refusal = soleAccessRecord(b.root).refusal as RefusalDetail;
    for (const [field, value] of Object.entries({
      host: refusal.host!, origin: refusal.origin!, route: refusal.route,
    })) {
      assert.equal(
        value.length, REFUSAL_VALUE_MAX + 1,
        `${field}: a capped value is 256 characters plus the one-character marker`,
      );
      assert.equal(
        value.endsWith('…'), true,
        `${field}: a truncated value must be VISIBLY truncated — a silent clip can be misread `
        + `as what was actually submitted (got ${JSON.stringify(value.slice(-8))})`,
      );
    }
  } finally {
    b.dispose();
  }

  const c = box();
  try {
    const exact = 'y'.repeat(REFUSAL_VALUE_MAX);
    recordRefusal(c.root, {
      check: 'host', status: 403, method: 'GET', route: '/api/ping', host: exact, origin: null,
    });
    const refusal = soleAccessRecord(c.root).refusal as RefusalDetail;
    assert.equal(refusal.host, exact, 'a value exactly at the cap is stored whole, with no marker');
  } finally {
    c.dispose();
  }
});

/**
 * Field rule 4: `url.search` is NOT recorded. The route identifies the
 * request; a query string is unbounded caller-supplied data answering no
 * question this record asks.
 *
 * The caller is told to pass `url.pathname` — this asserts that the rule holds
 * even when it does not, because "the call site passes the right thing" is an
 * instruction and this project has thirty-odd recorded instances of a later
 * task reading past one.
 */
test('B4: a query string never reaches route, even when a caller hands one over', () => {
  const b = box();
  try {
    recordRefusal(b.root, {
      check: 'token-mismatch',
      status: 403,
      method: 'GET',
      route: '/api/items?secret=leak-probe-4a7b2e&page=2',
      host: HOST,
      origin: null,
    });
    const refusal = soleAccessRecord(b.root).refusal as RefusalDetail;
    assert.equal(refusal.route, '/api/items', 'the route is the pathname and stops at the "?"');
    assert.equal(
      rawLog(b.root).includes('leak-probe-4a7b2e'), false,
      'no part of the query string may reach the file on disk',
    );
  } finally {
    b.dispose();
  }
});

/**
 * Field rule 5: THE TOKEN IS NEVER RECORDED, IN ANY FORM — not the value, not
 * its length, not a prefix, not a hash.
 *
 * Asserted against the WHOLE SERIALIZED RECORD read back off disk, not against
 * the field we think holds it: the point of the rule is that no path puts it
 * anywhere, and a field-by-field check can only see the fields someone
 * remembered to look at.
 */
test('B4: the token appears nowhere in a serialized record, for any of the four checks', () => {
  const token = mintToken();
  const expected = { token, port: 4111 };
  const cases: Record<string, string | string[]>[] = [
    { host: 'evil.example:4111', [TOKEN_HEADER]: token },
    { host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: token },
    { host: HOST },
    { host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) },
  ];
  for (const headers of cases) {
    const b = box();
    try {
      const verdict = validateApiRequest(req(headers), expected);
      assert.equal(verdict.ok, false, `must refuse: ${JSON.stringify(Object.keys(headers))}`);
      if (verdict.ok) continue;
      recordRefusal(b.root, {
        check: verdict.check,
        status: verdict.status as 401 | 403,
        method: 'GET',
        route: '/api/ping',
        host: headerFirst(headers.host),
        origin: headerFirst(headers.origin),
      });
      const raw = rawLog(b.root);
      const record = soleAccessRecord(b.root);
      assert.equal(
        JSON.stringify(record).includes(token), false,
        `the serialized record carries the token for ${JSON.stringify(headers)}: ${JSON.stringify(record)}`,
      );
      assert.equal(raw.includes(token), false, 'and the bytes on disk must not carry it either');
      // Not a prefix and not a hash, either — the rule is "in any form".
      assert.equal(raw.includes(token.slice(0, 8)), false, 'nor any prefix of it');
      assert.equal(
        raw.includes(createHash('sha256').update(token).digest('hex')), false,
        'nor a hash of it — a hash of a 32-byte secret is still a handle on the secret',
      );
      // "in any form" also means "no field derived from it" — a length, a
      // prefix or a hash would each need somewhere to live, and there is no
      // seventh field for one to live in.
      assert.deepEqual(
        Object.keys(record.refusal as RefusalDetail).sort(),
        ['check', 'host', 'method', 'origin', 'route', 'status'],
        'no field beyond the six declared ones, so nothing derived from the token has a home',
      );
    } finally {
      b.dispose();
    }
  }
});

/**
 * THE LIMIT OF THE RULE ABOVE, EXECUTED RATHER THAN ASSUMED — and reported to
 * the owner as a finding, not silently mitigated.
 *
 * Field rule 5 says the token is never recorded in any form. Field rule 2 says
 * `host` and `origin` are recorded AS SUBMITTED. When the value submitted in
 * `Host` or `Origin` IS the token, the two rules point opposite ways, and rule
 * 2 wins — because `recordRefusal` is never given the token and so cannot
 * recognise it. What rule 5 actually holds is narrower than its wording: the
 * value of the TOKEN HEADER never reaches the record.
 *
 * Nothing here is a fix. It is the same disclosure discipline the audit module
 * already applies to its own gitignoring: a limitation that is executed cannot
 * quietly stop being true, and a later reader finds this test instead of
 * finding the gap.
 *
 * Why it is not obviously fatal, stated so it is not over-read either: a sender
 * that can put the token in a header already HAS the token, so this discloses
 * nothing to that sender. What it does do is put the secret in a file that
 * outlives the process, which is exactly what rule 5's reasoning objects to.
 */
test('B4 LIMIT: a token submitted as the Host IS recorded — rule 2 outranks rule 5 here', () => {
  const token = mintToken();
  const b = box();
  try {
    const verdict = validateApiRequest(req({ host: token, [TOKEN_HEADER]: token }), { token, port: 4111 });
    assert.equal(verdict.ok, false, 'a Host that is not loopback is refused, whatever it spells');
    if (verdict.ok) return;
    recordRefusal(b.root, {
      check: verdict.check,
      status: verdict.status as 401 | 403,
      method: 'GET',
      route: '/api/ping',
      host: token,
      origin: null,
    });
    assert.equal(
      rawLog(b.root).includes(token), true,
      'if this ever goes false, `recordRefusal` has learned to recognise the token — which means '
      + 'it is being given the token, and THAT is the change that needs reviewing, not this test',
    );
  } finally {
    b.dispose();
  }
});

/**
 * The record is an ALLOW-LIST, not a pass-through, and that is what makes the
 * rule above hold for a caller this module does not own.
 *
 * `recordRefusal` is handed an object assembled from request headers by
 * `server.ts`. If it spread that object into the record instead of copying the
 * six declared fields, anything else the caller put on it — a token above all —
 * would land on disk. This feeds it exactly that.
 */
test('B4: a field the caller added beyond RefusalDetail does not reach the disk', () => {
  const b = box();
  try {
    const secret = cryptoRandomBytes(32).toString('hex');
    const smuggled = {
      check: 'host',
      status: 403,
      method: 'GET',
      route: '/api/ping',
      host: 'evil.example:4111',
      origin: null,
      // Everything below is NOT part of RefusalDetail. None of it may be written.
      token: secret,
      [TOKEN_HEADER]: secret,
      reason: 'Host header did not match the expected loopback host and port',
      search: '?q=leak',
    } as unknown as RefusalDetail;
    recordRefusal(b.root, smuggled);
    const raw = rawLog(b.root);
    assert.equal(
      raw.includes(secret), false,
      'the record is built field by field from an allow-list; a spread would have written this',
    );
    assert.deepEqual(
      Object.keys(soleAccessRecord(b.root).refusal as RefusalDetail).sort(),
      ['check', 'host', 'method', 'origin', 'route', 'status'],
      'exactly the six declared fields, and no seventh',
    );
    assert.equal(raw.includes('?q=leak'), false, 'and no query string, by any route in');
  } finally {
    b.dispose();
  }
});

/**
 * THE TENSION, RESOLVED STRUCTURALLY. The UI is a read-only surface and this
 * is the one thing it writes — on the REFUSAL path, never on a served read.
 *
 * `validateApiRequest` is handed no root and so cannot write at all; the write
 * lives in `recordRefusal`, and `recordRefusal` will not record a status that
 * is not a refusal. So a later change that moved the call onto the success
 * path cannot quietly produce a log entry: it would have to invent a refusal
 * status first. Task 13 proves the same bound from outside, over real HTTP,
 * across every read route.
 */
test('B4: recordRefusal refuses to record anything that is not a refusal', () => {
  const b = box();
  try {
    const notRefusals: { status: number; check: string; why: string }[] = [
      { status: 200, check: 'host', why: 'a served read' },
      { status: 204, check: 'origin', why: 'a served read with no body' },
      { status: 404, check: 'host', why: 'a miss is not a refusal' },
      { status: 500, check: 'host', why: 'an error is not a refusal' },
      { status: 403, check: 'nonce', why: 'the handoff nonce branch is NOT covered by this ruling' },
      { status: 403, check: 'token', why: 'an unclosed check vocabulary' },
    ];
    for (const { status, check, why } of notRefusals) {
      const detail = {
        check, status, method: 'GET', route: '/api/ping', host: HOST, origin: null,
      } as unknown as RefusalDetail;
      const result = recordRefusal(b.root, detail);
      assert.equal(result.written, false, `${why} (${check}/${status}) must not be recorded`);
      assert.match(
        result.error ?? '', /not a refusal/,
        'and the reason it was not written is returned, never swallowed',
      );
    }
    assert.equal(rawLog(b.root), '', 'not one byte was appended by any of them');
  } finally {
    b.dispose();
  }
});

/**
 * The runtime half of the same boundary, at the scope this module can prove:
 * an AUTHORISED request changes nothing on disk. `.audit/` is inside this
 * snapshot ON PURPOSE — excluding it is the single edit that would blind this
 * assertion to a served read writing an audit record, which is exactly the
 * defect it exists to catch (plan section 0.6, and Task 13's E2E scoping).
 */
test('B4: a SERVED READ writes nothing — the corpus is byte-identical afterwards', () => {
  const b = box();
  try {
    // A corpus that already HAS an audit log, so this compares CONTENT rather
    // than the appearance of a file that was not there before.
    const seeded = {
      protocol: 'my_context/audit@1', at: '2026-08-20T00:00:00.000Z',
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x',
    };
    mkdirSync(path.join(b.root, '.audit'), { recursive: true });
    writeFileSync(auditLogPath(b.root), `${JSON.stringify(seeded)}\n`, 'utf8');
    mkdirSync(path.join(b.root, 'rules'), { recursive: true });
    writeFileSync(path.join(b.root, 'rules', 'RULE-x.md'), 'body\n', 'utf8');
    const before = snapshot(b.root);

    const authorised: Record<string, string | string[]>[] = [
      { host: HOST, [TOKEN_HEADER]: EXPECT.token },
      { host: HOST, origin: `http://${HOST}`, [TOKEN_HEADER]: EXPECT.token },
      { host: [HOST, 'evil.example:4111'], [TOKEN_HEADER]: [EXPECT.token, 'b'.repeat(64)] },
    ];
    for (const headers of authorised) {
      const verdict = gate(b.root, headers, '/api/items?q=anything');
      assert.deepEqual(
        verdict, { ok: true }, `this sweep must stay authorised: ${JSON.stringify(headers)}`,
      );
    }

    assert.deepEqual(
      snapshot(b.root), before,
      'a SERVED READ changed the corpus — including .audit/, which is inside this snapshot on '
      + 'purpose: the one ruled write is on the refusal path, and no request in this sweep was '
      + 'refused',
    );
  } finally {
    b.dispose();
  }
});

/**
 * Field rule 7: the write happens BEFORE the response is sent, so a refusal
 * cannot be answered and then lost. What this module can prove of that is the
 * half that makes it possible — `recordAudit` is a SYNCHRONOUS append, so the
 * bytes are on disk by the time `recordRefusal` returns, with nothing to await
 * and no flush to miss. The ordering at the call site is Task 13's.
 */
test('B4: the record is on disk by the time recordRefusal returns', () => {
  const b = box();
  try {
    const result = recordRefusal(b.root, {
      check: 'token-missing', status: 401, method: 'POST', route: '/api/handoff',
      host: HOST, origin: null,
    });
    assert.equal(result.written, true, 'the append succeeded');
    assert.equal(
      readFileSync(auditLogPath(b.root), 'utf8').trim().length > 0, true,
      'and the bytes are readable with no await between the call and this line',
    );
  } finally {
    b.dispose();
  }
});

/**
 * Field rule 8: the result is DISCARDED by the server, exactly as the hooks
 * discard theirs — which is only defensible because a failure is RETURNED
 * rather than thrown. A `recordRefusal` that threw would break the refusal
 * path of a security gate over log I/O.
 */
test('B4: an unwritable log returns the failure and never throws', () => {
  const b = box();
  try {
    // A root whose `.audit` cannot be created, because the path is a FILE.
    const blocked = path.join(b.root, 'blocked');
    writeFileSync(blocked, 'not a directory\n', 'utf8');
    const result = recordRefusal(blocked, {
      check: 'host', status: 403, method: 'GET', route: '/api/ping', host: null, origin: null,
    });
    assert.equal(result.written, false, 'the append could not happen');
    assert.equal(
      typeof result.error, 'string',
      'and the failure is reported in the result, not thrown out of the security gate',
    );
  } finally {
    b.dispose();
  }
});
