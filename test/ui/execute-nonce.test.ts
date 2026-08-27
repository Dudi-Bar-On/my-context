import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXECUTION_NONCE_TTL_MS, ExecutionNonceStore } from '../../src/ui/execute-nonce.ts';

/*
 * Every assertion here compares a boolean, so every one carries a message: a
 * bare `true !== false` out of a security test says which line broke and
 * nothing at all about which guarantee it was holding. Same rule as
 * `security.test.ts`, and for the same reason.
 *
 * No test sleeps. Every time-dependent case passes an explicit `now`, so the
 * suite asserts the window rather than racing it.
 */

test('a minted nonce redeems once, for the exact id and argv it was minted for', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A', '--yes']), true,
    'the run the confirm dialog rendered is the one that is authorised');
});

test('it is ONE-SHOT — the second attempt fails even when everything else matches', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  store.redeem(nonce, 'pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A', '--yes']), false,
    'one confirm authorises one run, never a replay of it');
});

test('a nonce minted for one command does not authorise another', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'unpin', ['unpin', 'A', '--yes']), false,
    'the id is part of what was shown, so it is part of what was authorised');
});

test('a nonce minted for one ARGV does not authorise a different one', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'B', '--yes']), false,
    'a different target is a different command, whatever the id says');
  const second = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(second, 'pin', ['pin', 'A']), false,
    'dropping a flag is a different command too — the binding is the whole argv');
});

test('a MISMATCHED attempt spends the nonce too — one attempt is all it gets', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A']);
  store.redeem(nonce, 'pin', ['pin', 'B']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A']), false,
    'a nonce that survives a wrong guess is a nonce an attacker may guess against');
});

test('it expires, and an expired nonce is gone rather than reusable', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A'], 1000, 0);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A'], 1001), false,
    'one millisecond past the window is expired');
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A'], 500), false,
    'and the attempt DELETED it, so rewinding the clock does not revive it');
});

test('an unminted nonce never redeems, whatever it looks like', () => {
  const store = new ExecutionNonceStore();
  assert.equal(store.redeem('', 'pin', ['pin', 'A']), false,
    'the empty string is not a credential');
  assert.equal(store.redeem('0'.repeat(32), 'pin', ['pin', 'A']), false,
    'a value shaped exactly like a nonce this store mints is still not one it minted');
});

/**
 * The map is bounded by sweeping expired entries on `mint` (see the module).
 * The sweep is only ever safe if it cannot take a LIVE nonce with it: a user
 * who read the dialog for ninety seconds and then confirmed must not be told
 * their confirm expired because other tabs minted in the meantime.
 *
 * The TTL constant is asserted here rather than in its own test because its
 * value is what makes that ninety seconds a real case, not a hypothetical one.
 */
test('bounding the store sweeps only what is dead — a live nonce survives later mints', () => {
  assert.equal(EXECUTION_NONCE_TTL_MS, 120_000, 'two minutes: one dialog read, not one browser trip');
  const store = new ExecutionNonceStore();
  const live = store.mint('pin', ['pin', 'A'], EXECUTION_NONCE_TTL_MS, 0);
  for (let i = 0; i < 64; i += 1) store.mint('doctor', ['doctor'], 1000, 0);
  // A later mint sweeps at a clock well past those short-lived entries.
  store.mint('doctor', ['doctor'], 1000, 90_000);
  assert.equal(store.redeem(live, 'pin', ['pin', 'A'], 90_001), true,
    'sixty-four expired neighbours swept away, and the one still inside its window redeems');
});
