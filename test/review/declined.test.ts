// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// INV-nothing-is-dropped-silently
//
// §8. The property that matters is not "a decline is remembered" — it is that
// the decline survives the pass REWORDING the proposal. A content hash blocks
// one sentence; the pass rephrases and re-proposes forever, and the owner
// declines the same thing every week. Keying on a canonical claim is the
// difference between blocking a phone number and blocking a caller.
//
// The ledger is also untrusted input the pass reads on every run, so the
// failure DIRECTION is asserted too: an unreadable or malformed ledger must
// degrade to "propose it again and let the owner decline it again", never to
// "suppress silently".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  alreadyDeclined, claimKey, declinedPath, readDeclines, recordDecline, DECLINE_CAP,
} from '../../src/review/declined.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'review-declined-'));
}

test('a reworded proposal of the same claim about the same target is already declined', () => {
  const dir = root();
  recordDecline(dir, {
    claim: claimKey(
      'inputs need styling', 'Bare inputs render as UA chrome in a dark console.', 'styles.css',
    ),
    target: 'styles.css',
    at: new Date().toISOString(),
    why: 'the console is deliberately unstyled',
  });

  const again = claimKey(
    'unstyled inputs', 'A plain input shows browser chrome against the dark console.', 'styles.css',
  );
  const hit = alreadyDeclined(dir, again, 'styles.css');
  assert.ok(hit !== null, 'a decline must survive the pass finding new words for the same claim');
  assert.equal(hit.why, 'the console is deliberately unstyled');
  removeTree(dir);
});

test('the same words about a different target are not already declined', () => {
  const dir = root();
  recordDecline(dir, {
    claim: claimKey('t', 'a claim about rendering in the console', 'styles.css'),
    target: 'styles.css', at: new Date().toISOString(), why: null,
  });
  assert.equal(
    alreadyDeclined(dir, claimKey('t', 'a claim about rendering in the console', 'app.js'), 'app.js'),
    null,
  );
  removeTree(dir);
});

test('the ledger is bounded and drops the oldest first', () => {
  const dir = root();
  for (let i = 0; i < DECLINE_CAP + 25; i++) {
    recordDecline(dir, {
      claim: `claim number ${i} about something distinct`,
      target: null,
      // Zero-padded so string ordering is time ordering — the eviction sort is
      // lexical, and 10 sorting before 9 would evict the wrong end.
      at: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      why: null,
    });
  }
  const kept = readDeclines(dir);
  assert.ok(kept.length <= DECLINE_CAP,
    'an unbounded ledger is a growing untrusted input the pass reads every time');
  assert.equal(kept.length, DECLINE_CAP);
  assert.match(kept[kept.length - 1]!.claim, new RegExp(`number ${DECLINE_CAP + 24}\\b`),
    'the NEWEST decline must survive — it is the one the owner just made');
  assert.equal(kept.some((d) => d.claim.includes('number 0 ')), false, 'the oldest is evicted');
  removeTree(dir);
});

test('a malformed ledger costs itself and never its neighbours', () => {
  const dir = root();
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(declinedPath(dir), JSON.stringify([
    { claim: 'a good row about the styling of console inputs', target: 'styles.css', at: '', why: null },
    'not an object at all',
    { target: 'styles.css' },
    { claim: 42, target: 'styles.css' },
    { claim: 'another good row about exit codes and pipelines', target: null, at: '', why: null },
  ]), 'utf8');

  const rows = readDeclines(dir);
  assert.equal(rows.length, 2, 'three unusable rows cost three rows, not the file');
  removeTree(dir);
});

test('an unreadable ledger fails toward proposing, never toward suppressing', () => {
  const dir = root();
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(declinedPath(dir), '{ this is not json', 'utf8');
  // The direction is the assertion. Trusting an unreadable ledger to suppress
  // would let anything that can write this file silence a proposal invisibly.
  assert.deepEqual(readDeclines(dir), []);
  assert.equal(alreadyDeclined(dir, claimKey('t', 'a body about something', null), null), null);
  removeTree(dir);
});

test('an empty claim matches no decline', () => {
  const dir = root();
  recordDecline(dir, { claim: 'anything at all', target: null, at: '', why: null });
  assert.equal(alreadyDeclined(dir, '', null), null,
    'a claim with no content words must not match the whole ledger');
  removeTree(dir);
});
