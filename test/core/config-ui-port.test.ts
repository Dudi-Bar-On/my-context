/**
 * `ui.port` — Task 4 of
 * `docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md`,
 * spec §6.
 *
 * The one fact this file exists to hold is that ABSENT means the upkeep
 * mechanism is OFF, and that this is a safety call rather than a default
 * anybody may tidy away. `ui.enabled` is opt-OUT because resolving it grants a
 * permission and costs nothing; `ui.port` is opt-IN because the only thing
 * that reads it SPAWNS A BACKGROUND SERVER, and a plugin that starts one on
 * every machine it is installed on, because somebody installed it, is not
 * acceptable. So the absent case is pinned first and by itself, exactly the
 * way `test/core/config-handover.test.ts` pins `handover`'s.
 *
 * The refusals are asserted BY THE OFFENDING SUB-KEY'S NAME rather than by
 * their sentences: what is held is that the message tells the user which key
 * they got wrong, which is `requireUi`'s standing contract. `Nothing was
 * loaded` is asserted with them, because a refusal that quietly began
 * returning a partial config would still match a name.
 *
 * `65535` and `1` are pinned at the boundaries rather than in the middle,
 * because an off-by-one in either direction is the only way this check can be
 * wrong without being obviously wrong: a config naming 65535 that is refused
 * looks like a broken product, and a config naming 0 that is accepted is the
 * ephemeral port this key exists to replace.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, DEFAULT_UI } from '../../src/core/config.ts';

test('ui.port defaults to null, which is what keeps the mechanism off', () => {
  assert.equal(resolveConfig({}).ui.port, null);
  // Declared-but-empty, and enabled-without-a-port, are both still nobody
  // asking for a background server. `enabled: true` in particular must not be
  // read as an opt-in: it has meant "the UI is permitted" since it shipped and
  // every workspace on earth resolves to it.
  assert.equal(resolveConfig({ ui: {} }).ui.port, null);
  assert.equal(resolveConfig({ ui: { enabled: true } }).ui.port, null);
  assert.equal(resolveConfig(null).ui.port, null);
  assert.equal(resolveConfig(undefined).ui.port, null);
  assert.equal(DEFAULT_UI.port, null);
});

test('a port is a whole number in 1..65535, and the ends are inclusive', () => {
  assert.equal(resolveConfig({ ui: { port: 58888 } }).ui.port, 58888);
  assert.equal(resolveConfig({ ui: { port: 1 } }).ui.port, 1);
  assert.equal(resolveConfig({ ui: { port: 65535 } }).ui.port, 65535);
  // The two keys are independent: naming a port does not switch anything on
  // that was off, and switching the UI off does not unset the port. That is
  // what a disable switch beside an address is for (spec §6).
  const both = resolveConfig({ ui: { enabled: false, port: 58888 } }).ui;
  assert.deepEqual(both, { enabled: false, port: 58888 });
});

/**
 * `0` is refused with the out-of-range values rather than read as "ask the
 * operating system", and it is the single most important refusal here. The
 * CLI's `--port` flag accepts 0 and means exactly that; this key cannot,
 * because **a hook cannot use port 0** — an ephemeral port is a URL nobody can
 * bookmark, and a record naming `0` would send every probe to the wrong place
 * forever (spec §6, and §3's third assertion). Accepting it would produce a
 * config that reads as configured and a mechanism that is silently useless.
 */
test('a port that is not a whole number in 1..65535 is refused BY NAME', () => {
  for (const bad of [0, -1, 65_536, 1.5, '58888', true, null, [], {}, Number.NaN]) {
    assert.throws(
      () => resolveConfig({ ui: { port: bad } }),
      /ui\.port/,
      `ui.port accepted ${JSON.stringify(bad) ?? String(bad)}`,
    );
    assert.throws(
      () => resolveConfig({ ui: { port: bad } }),
      /Nothing was loaded/,
      `ui.port ${JSON.stringify(bad) ?? String(bad)} was refused without saying so`,
    );
  }
});

/**
 * The message has to show the value the user actually wrote. A refusal that
 * says only "ui.port is invalid" makes the reader hunt for which of the two
 * places they typed it is the one this build read.
 */
test('the refusal quotes the value it refused', () => {
  assert.throws(() => resolveConfig({ ui: { port: '58888' } }), /ui\.port is "58888"/);
  assert.throws(() => resolveConfig({ ui: { port: 0 } }), /ui\.port is 0/);
});

/**
 * `UI_KEYS` is not exported, so the pairing it documents — "extend this list
 * and `requireUi` together" — is asserted through the behaviour instead: a key
 * the list does not know is refused by name, and `port` is no longer such a
 * key. The failure this catches is a `port` default added to `DEFAULT_UI`
 * while the accepted set still knows only `enabled`, which is the exact
 * accepted-and-dropped failure that comment exists to stop.
 */
test('port is a key ui understands, and a misspelling of it still is not', () => {
  assert.doesNotThrow(() => resolveConfig({ ui: { port: 58888 } }));
  assert.throws(() => resolveConfig({ ui: { prot: 58888 } }), /"prot"/);
  assert.throws(() => resolveConfig({ ui: { prot: 58888 } }), /ui accepts: enabled, port/);
});

/** Setting the key discloses nothing: `ui` is a key this build UNDERSTANDS,
 * not one R14.2 tolerates, and adding a sub-key must not change that. */
test('a configured port is not a skipped key', () => {
  assert.deepEqual(resolveConfig({ ui: { port: 58888 } }).skippedKeys, []);
});
