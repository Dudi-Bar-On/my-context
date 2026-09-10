/**
 * The `dispatchGate` top-level config key —
 * TASK-nothing-stops-a-subagent-being-dispatched-for-work-that-has.
 *
 * The one fact this file exists to hold is the DIRECTION of the key: absent
 * resolves to `DEFAULT_DISPATCH_GATE`, OFF, exactly as `handover` resolves to
 * `null`, OFF, and for the same reason — the one thing this key's reader does
 * is REFUSE a dispatch that used to be let through, and no default may make
 * that behaviour change on a user's behalf. `test/core/config-handover.test.ts`
 * is the template this follows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DISPATCH_GATE, resolveConfig, TOP_LEVEL_KEYS,
} from '../../src/core/config.ts';

test('dispatchGate is off by default, on every absence a config file can spell', () => {
  assert.deepEqual(resolveConfig({}).dispatchGate, { enabled: false });
  assert.deepEqual(resolveConfig(null).dispatchGate, { enabled: false });
  assert.deepEqual(resolveConfig(undefined).dispatchGate, { enabled: false });
  assert.deepEqual(DEFAULT_DISPATCH_GATE, { enabled: false });
  // A declared-but-empty section is also still nobody having said yes — the
  // same reading `{"ui": {}}` gets, and the opposite of `handover`'s `{}`
  // refusal, because this key has a real default to fall back to.
  assert.deepEqual(resolveConfig({ dispatchGate: {} }).dispatchGate, { enabled: false });
});

test('dispatchGate.enabled turns the gate on, and only that', () => {
  assert.deepEqual(
    resolveConfig({ dispatchGate: { enabled: true } }).dispatchGate, { enabled: true },
  );
  assert.deepEqual(
    resolveConfig({ dispatchGate: { enabled: false } }).dispatchGate, { enabled: false },
  );
});

// This asserts what its name says — APPENDED, MOVING NOTHING — rather than
// pinning the whole list, and the difference stopped being cosmetic on
// 2026-09-10 when `plan:loop seq:2` appended `review` after it. A whole-list
// copy here would have gone red for the one change the list is designed to
// accept, and the exact list is already pinned once, in
// `test/core/config-top-level-keys.test.ts`. Two copies of one list is the
// defect this project spent 2026-09-07 measuring; what belongs HERE is the
// property this key's own change had to have.
test('dispatchGate joined TOP_LEVEL_KEYS, appended and moving nothing', () => {
  const before = ['profile', 'categories', 'budgets', 'watchedDocs', 'ui', 'handover'];
  assert.deepEqual(
    TOP_LEVEL_KEYS.slice(0, before.length), before,
    'a key that was there before dispatchGate moved',
  );
  assert.equal(
    TOP_LEVEL_KEYS[before.length], 'dispatchGate',
    'dispatchGate is no longer the key that was appended after the original six',
  );
});

test('a non-object dispatchGate is refused, by name', () => {
  assert.throws(
    () => resolveConfig({ dispatchGate: true }),
    /"dispatchGate" is true, not an object.*Nothing was loaded/s,
  );
  assert.throws(() => resolveConfig({ dispatchGate: [] }), /"dispatchGate" is \[\]/);
  assert.throws(() => resolveConfig({ dispatchGate: null }), /"dispatchGate" is null/);
});

test('a non-boolean enabled is refused, by name, and nothing is loaded', () => {
  for (const bad of ['true', 1, 0, null, [], {}]) {
    assert.throws(
      () => resolveConfig({ dispatchGate: { enabled: bad } }),
      /dispatchGate\.enabled/,
      `dispatchGate.enabled accepted ${JSON.stringify(bad)}`,
    );
    assert.throws(
      () => resolveConfig({ dispatchGate: { enabled: bad } }),
      /Nothing was loaded/,
      `dispatchGate.enabled ${JSON.stringify(bad)} was refused without saying so`,
    );
  }
});

test('an unknown sub-key is refused BY NAME rather than skipped', () => {
  assert.throws(
    () => resolveConfig({ dispatchGate: { enabld: true } }),
    /"enabld".*is not a key this config understands.*Nothing was loaded/s,
  );
  assert.throws(
    () => resolveConfig({ dispatchGate: { enabld: true } }),
    /dispatchGate accepts: enabled/,
  );
});

test('a configured dispatchGate is not a skipped key', () => {
  assert.deepEqual(resolveConfig({ dispatchGate: { enabled: true } }).skippedKeys, []);
});

test('an unrelated typo\'d top-level key is still skipped and disclosed, not refused', () => {
  // R14.2's boundary is unaffected by this key joining the list: a genuinely
  // unknown top-level key is still carried in skippedKeys rather than
  // throwing, exactly as it was before dispatchGate existed.
  assert.deepEqual(resolveConfig({ dispatchGat: { enabled: true } }).skippedKeys, ['dispatchGat']);
  assert.deepEqual(resolveConfig({ dispatchGat: { enabled: true } }).dispatchGate, { enabled: false });
});
