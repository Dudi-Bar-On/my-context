// @basis TASK-sweep-every-timestamp-comparison-for-the-millisecond-tie
/**
 * **`lastRecordedAsk` picks the newest ask, and a tie is decided by the
 * FILENAME rather than by whatever order the filesystem listed.**
 *
 * `askedAt` is `Date.toISOString()` — one-millisecond resolution — and
 * `readdirSync` promises no order at all, so two latches written inside one
 * tick made this function answer differently on different machines and
 * different runs. The remedy is the one `newestSessionKey`
 * (`core/continuity.ts`) already takes over an mtime tie: the name is the
 * deterministic fact in hand.
 *
 * Forced rather than hoped for — both latches carry the SAME `askedAt` to the
 * millisecond, which is what the sweep this test belongs to says a fixture has
 * to do (CI run 35715432299 landed six `recordAudit` calls in one
 * millisecond).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ASK_LATCH_SUFFIX, lastRecordedAsk } from '../../src/core/handover-ask.ts';
import { removeTree } from '../helpers/tmp.ts';

const TIED_AT = '2026-09-23T10:00:00.000Z';

function corpus(latches: { session: string; askedAt: string; percent: number }[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-ask-tie-'));
  mkdirSync(path.join(root, 'state'), { recursive: true });
  for (const latch of latches) {
    writeFileSync(
      path.join(root, 'state', `${latch.session}${ASK_LATCH_SUFFIX}`),
      JSON.stringify({ askedAt: latch.askedAt, askedAtPercent: latch.percent }) + '\n',
      'utf8',
    );
  }
  return root;
}

test('two asks tied to the millisecond resolve to the same one every time — by name, not by listing order', () => {
  // Written in the order `b`, `a` so that "the first one read" and "the
  // smallest name" are different answers on any filesystem that lists by
  // creation order.
  const root = corpus([
    { session: 'sess-b', askedAt: TIED_AT, percent: 80 },
    { session: 'sess-a', askedAt: TIED_AT, percent: 90 },
  ]);
  try {
    // `null` for the session id: this is the scan branch, the one a session
    // that was forked or restarted reaches, where no latch of its own exists.
    const first = lastRecordedAsk(root, null);
    assert.notEqual(first, null);
    assert.equal(first!.sessionId, 'sess-a',
      'the smallest filename wins a tie, so the answer is a function of the directory and not '
      + 'of the order readdirSync happened to return');
    // Stability is the whole claim: the same directory, asked again.
    assert.deepEqual(lastRecordedAsk(root, null), first);
  } finally { removeTree(root); }
});

test('a tie never beats a genuinely newer ask', () => {
  const root = corpus([
    // `sess-a` sorts first AND is tied with nothing — but `sess-z` is a
    // millisecond newer, and newer still wins. A tiebreak that had become the
    // primary key would take `sess-a` here.
    { session: 'sess-a', askedAt: TIED_AT, percent: 80 },
    { session: 'sess-z', askedAt: '2026-09-23T10:00:00.001Z', percent: 90 },
  ]);
  try {
    assert.equal(lastRecordedAsk(root, null)?.sessionId, 'sess-z');
  } finally { removeTree(root); }
});
