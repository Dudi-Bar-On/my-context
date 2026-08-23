/**
 * The session store's rules, at the unit level.
 *
 * `test/ui/session-continuity.test.ts` proves the thing that matters — a tab
 * open across a restart keeps working — over real HTTP with two real servers.
 * This file covers what that one cannot reach without contorting itself: the
 * retention window, the cap, and every way the file on disk can be wrong.
 *
 * Those matter more than they look. Each retained digest is a credential a
 * returning tab may still present, so a prune that quietly did nothing would
 * widen the surface with no symptom at all — nothing fails, nothing is slower,
 * and the file simply grows. The window and the cap are the whole bound.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  SESSION_MAX, SESSION_TTL_MS,
  loadSessionDigests, recordSessionDigest, sessionsPath,
} from '../../src/core/ui-sessions.ts';

/** 64 hex characters, distinct per `n`, and never a real token. */
function digest(n: number): string {
  return n.toString(16).padStart(64, '0');
}

/**
 * Each case gets its OWN directory. `pin-rendering.ts` already keeps the suite
 * out of the developer's home, but a shared directory would let one case read
 * what another wrote and turn a retention assertion into a race.
 */
function inStore(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-sessions-unit-'));
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = dir;
  try {
    body(dir);
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
    removeTree(dir);
  }
}

test('a missing store is the ordinary first run: no digests, and nothing reported', () => {
  inStore(() => {
    const loaded = loadSessionDigests();
    assert.deepEqual(loaded.digests, []);
    assert.equal(
      loaded.error, null,
      'a first run reported a problem. `error` is for a file that EXISTS and could not be used; '
      + 'reporting an absent one would print a warning on every fresh install.',
    );
  });
});

test('a recorded digest is returned, and the token is nowhere in the file', () => {
  inStore(() => {
    assert.equal(recordSessionDigest(digest(1)).written, true);
    assert.deepEqual(loadSessionDigests().digests, [digest(1)]);
    const raw = readFileSync(sessionsPath(), 'utf8');
    assert.ok(raw.includes(digest(1)), 'the digest was not written');
    assert.ok(
      !raw.includes('"token"'),
      'the store wrote a field named token. What outlives the process is sha256(token) and '
      + 'never the token, which is the entire reason the file needs no permission mode.',
    );
  });
});

test('a value that is not a digest is refused rather than written', () => {
  inStore(() => {
    // The shape a mistake actually takes: a caller handing over the token it
    // just minted instead of hashing it. 64 hex characters is exactly what a
    // token looks like, so length alone cannot tell them apart — which is why
    // the guard is here at all, and why this case is a token-shaped string.
    const refused = recordSessionDigest('NOT-A-DIGEST');
    assert.equal(refused.written, false);
    assert.match(String(refused.error), /never the token itself/);
    assert.deepEqual(loadSessionDigests().digests, [], 'a refused write still changed the store');
  });
});

test('a digest past the window is dropped on read', () => {
  inStore(() => {
    const now = 1_700_000_000_000;
    recordSessionDigest(digest(1), now - SESSION_TTL_MS - 1);
    recordSessionDigest(digest(2), now);
    assert.deepEqual(
      loadSessionDigests(now).digests, [digest(2)],
      'an expired digest was still offered. Every retained digest is a credential a returning '
      + 'tab may present, so the window is the bound and not a hint.',
    );
  });
});

test('the cap retires the oldest, so restarting all afternoon cannot accumulate', () => {
  inStore(() => {
    const now = 1_700_000_000_000;
    // One more than the cap, each a millisecond apart so the ordering is total.
    for (let i = 0; i <= SESSION_MAX; i++) recordSessionDigest(digest(i), now + i);
    const kept = loadSessionDigests(now + SESSION_MAX).digests;
    assert.equal(kept.length, SESSION_MAX, `expected exactly ${SESSION_MAX} kept, got ${kept.length}`);
    assert.equal(kept[0], digest(SESSION_MAX), 'newest first');
    assert.ok(
      !kept.includes(digest(0)),
      'the oldest digest survived the cap. The window alone does not bound the case that '
      + 'actually happens — twenty restarts in one afternoon are all inside it.',
    );
  });
});

test('recording a digest already held moves it up rather than duplicating it', () => {
  inStore(() => {
    const now = 1_700_000_000_000;
    recordSessionDigest(digest(1), now);
    recordSessionDigest(digest(2), now + 1);
    recordSessionDigest(digest(1), now + 2);
    assert.deepEqual(
      loadSessionDigests(now + 2).digests, [digest(1), digest(2)],
      'a repeated digest was stored twice, which would spend two of the cap`s slots on one '
      + 'credential and retire a live one early.',
    );
  });
});

test('a corrupt store reports itself and reads as empty, rather than throwing', () => {
  inStore(() => {
    writeFileSync(sessionsPath(), '{not json', 'utf8');
    const loaded = loadSessionDigests();
    assert.deepEqual(loaded.digests, []);
    assert.match(
      String(loaded.error), /not valid JSON/,
      'a corrupt store said nothing. Silence here reintroduces exactly the lockout this module '
      + 'exists to prevent, with no way to find out why.',
    );
    // And it is recoverable in place: the next run overwrites it.
    assert.equal(recordSessionDigest(digest(3)).written, true);
    assert.deepEqual(loadSessionDigests().digests, [digest(3)]);
  });
});

test('a store from a future version is reported, not guessed at', () => {
  inStore(() => {
    writeFileSync(
      sessionsPath(),
      JSON.stringify({ version: 99, sessions: [{ digest: digest(1), issued: Date.now() }] }),
      'utf8',
    );
    const loaded = loadSessionDigests();
    assert.deepEqual(
      loaded.digests, [],
      'a version this build does not write was read anyway. Honouring an unknown schema is how '
      + 'a store silently starts trusting the wrong field.',
    );
    assert.match(String(loaded.error), /declares version 99/);
  });
});

test('a malformed record is skipped and its well-formed neighbours are kept', () => {
  inStore(() => {
    const now = 1_700_000_000_000;
    writeFileSync(sessionsPath(), JSON.stringify({
      version: 1,
      sessions: [
        { digest: digest(1), issued: now },
        { digest: 'too short', issued: now },
        { digest: digest(2) },
        null,
        { digest: digest(3), issued: 'yesterday' },
        { digest: digest(4), issued: now - 1 },
      ],
    }), 'utf8');
    assert.deepEqual(
      loadSessionDigests(now).digests, [digest(1), digest(4)],
      'a half-parsed store is worse than none: a record missing its timestamp cannot be pruned, '
      + 'so accepting it would keep a credential alive past every bound this module sets.',
    );
  });
});
