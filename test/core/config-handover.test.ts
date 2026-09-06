/**
 * The `handover` top-level config key — Task 1 of
 * `docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md`,
 * spec §3.1.
 *
 * The one fact this file exists to hold is the DIRECTION of the key, which is
 * the opposite of `ui`'s and is the only thing about it a reader could get
 * wrong from habit. `ui` is opt-OUT: absent resolves to `DEFAULT_UI`, enabled,
 * because a workspace that never heard of the key still gets the web UI. This
 * key is opt-IN: absent resolves to `null`, off, because resolving it means
 * READING A FILE IN SOMEBODY'S REPOSITORY and no default may take that. A
 * `DEFAULT_HANDOVER` object sitting beside `DEFAULT_UI` is exactly the change
 * that would quietly invert it, so the absent case is pinned first and by
 * itself.
 *
 * The refusals are asserted BY THE OFFENDING SUB-KEY'S NAME rather than by
 * their sentences: what is being held is that the message tells the user which
 * of the three keys they got wrong, which is `requireUi`'s contract and the
 * house one. `Nothing was loaded` is asserted with them because a refusal that
 * quietly started returning a partial config would still match a name.
 *
 * The marker is written `'\u23ED'` and never as the literal character:
 * `npm run check:text-files` gates non-ASCII in source, and the escape is what
 * makes the value readable in a diff on any terminal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handoverAskMuted, handoverThresholdPercent, resolveConfig, skippedKeyNotice,
  DEFAULT_HANDOVER_MARKER, DEFAULT_HANDOVER_BUDGET_TOKENS,
  DEFAULT_HANDOVER_THRESHOLD_PERCENT, HANDOVER_ASK_NEVER,
} from '../../src/core/config.ts';

test('handover is absent by default, and absent means off', () => {
  assert.equal(resolveConfig({}).handover, null);
  // A missing config file and an explicit empty one are the same absence: a
  // plugin does not start reading a repository because it was installed.
  assert.equal(resolveConfig(null).handover, null);
  assert.equal(resolveConfig(undefined).handover, null);
});

test('a handover object gets the marker and budget defaults', () => {
  const config = resolveConfig({ handover: { path: 'reports/V2-HANDOVER.md' } });
  assert.deepEqual(config.handover, {
    path: 'reports/V2-HANDOVER.md',
    marker: '\u23ED',
    budgetTokens: 1200,
  });
  // The two defaults are exported so that no consumer re-types them; pinned
  // against the literals above so that an export renamed to a different value
  // cannot make both sides agree on the wrong one.
  assert.equal(DEFAULT_HANDOVER_MARKER, '\u23ED');
  assert.equal(DEFAULT_HANDOVER_BUDGET_TOKENS, 1200);
});

test('an unknown sub-key is refused BY NAME and nothing is loaded', () => {
  assert.throws(
    () => resolveConfig({ handover: { path: 'a.md', pathh: 'b.md' } }),
    /"pathh".*is not a key this config understands.*Nothing was loaded/s,
  );
  // The name has to be in the message, not merely the fact that something was
  // wrong: three sub-keys with near-identical spellings is the whole hazard.
  assert.throws(() => resolveConfig({ handover: { path: 'a.md', budgetTokns: 5 } }), /budgetTokns/);
});

test('a path that escapes the project root is refused', () => {
  assert.throws(() => resolveConfig({ handover: { path: '../elsewhere.md' } }), /handover\.path/);
  assert.throws(() => resolveConfig({ handover: { path: 'reports/../../x.md' } }), /handover\.path/);
  assert.throws(() => resolveConfig({ handover: { path: 'reports\\..\\..\\x.md' } }), /handover\.path/);
  // Every absolute spelling, on every platform, from the same loader. A
  // `config.json` travels — between machines and inside packs — so a check
  // that only refused the host OS's own spelling would accept a POSIX
  // `/etc/passwd` when read on Windows and a `C:\...` when read on Linux.
  // `path.isAbsolute` alone is that check, which is why the loader does not
  // use it bare.
  for (const abs of ['/etc/passwd', 'C:\\abs.md', 'C:/abs.md', '\\\\server\\share\\h.md', '\\abs.md']) {
    assert.throws(() => resolveConfig({ handover: { path: abs } }), /handover\.path/, abs);
  }
});

test('a non-object handover is refused, and so is a missing path', () => {
  assert.throws(() => resolveConfig({ handover: true }), /"handover" is true, not an object/);
  assert.throws(() => resolveConfig({ handover: [] }), /"handover" is \[\], not an object/);
  assert.throws(() => resolveConfig({ handover: null }), /"handover" is null, not an object/);
  // `{}` is NOT the empty-section-means-default case `{"ui": {}}` is: `path`
  // has no default to fall back to, because there is no file this product
  // could pick on the user's behalf.
  assert.throws(() => resolveConfig({ handover: {} }), /handover\.path/);
  assert.throws(() => resolveConfig({ handover: { marker: '!' } }), /handover\.path/);
  assert.throws(() => resolveConfig({ handover: { path: 42 } }), /handover\.path/);
  assert.throws(() => resolveConfig({ handover: { path: '   ' } }), /handover\.path/);
});

test('a marker that could never match a heading is refused by name', () => {
  assert.throws(() => resolveConfig({ handover: { path: 'a.md', marker: '' } }), /handover\.marker/);
  assert.throws(() => resolveConfig({ handover: { path: 'a.md', marker: 7 } }), /handover\.marker/);
});

test('budgetTokens must be a positive whole number, and every near miss is refused', () => {
  const ok = resolveConfig({ handover: { path: 'a.md', budgetTokens: 40 } });
  assert.equal(ok.handover?.budgetTokens, 40);
  // `0` is included deliberately. It is the one value with a plausible reading
  // — "deliver nothing" — and that reading is already spelled by leaving the
  // key out. Accepting it would mean a configured handover that silently
  // delivers an empty block, which is the silent drop the whole feature is
  // against.
  for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1200', null]) {
    assert.throws(
      () => resolveConfig({ handover: { path: 'a.md', budgetTokens: bad } }),
      /handover\.budgetTokens/,
      JSON.stringify(bad) ?? String(bad),
    );
  }
});

/** The point of adding the key to `TOP_LEVEL_KEYS` rather than letting R14.2
 * skip it: a config that sets `handover` must be one this build UNDERSTANDS,
 * not one it tolerates while the feature stays off. */
test('handover is a key this build understands, so setting it discloses nothing', () => {
  const cfg = resolveConfig({ handover: { path: 'reports/V2-HANDOVER.md' } });
  assert.deepEqual(cfg.skippedKeys, []);
  assert.equal(skippedKeyNotice(cfg), '');
});

/** Adding the key to a `config.json` that already says things must disturb
 * none of them — the same guarantee `ui` was given when it shipped. */
test('adding handover to an existing config changes nothing else in it', () => {
  const raw = {
    profile: 'minimal', budgets: { jit: 7 }, watchedDocs: ['a/**'],
    categories: { rule: { enabled: false, prefix: 'RL' } },
  };
  const before = resolveConfig(raw);
  const after = resolveConfig({ ...raw, handover: { path: 'reports/H.md' } });
  assert.equal(after.handover?.path, 'reports/H.md');
  assert.equal(before.handover, null);
  assert.deepEqual({ ...after, handover: before.handover }, before);
});

/* ---------------------------------------------------------------------------
 * `plan:handover seq:11` — the THIRD state of `thresholdPercent`.
 *
 * The defect: `handover` was one switch over two independent halves. The
 * delivery (the marked section, injected on the continuity tier) and the ask
 * (`Stop`, at the threshold) could only be turned off together, so a person who
 * maintains a handover by hand had to choose between an unwanted ask and no
 * continuity at all.
 *
 * These tests hold the two halves of the answer: the word is accepted in the
 * field the threshold already lives in, and it changes the ASK and nothing that
 * belongs to the delivery.
 * ------------------------------------------------------------------------- */

test('thresholdPercent takes "never", and it leaves the delivery untouched', () => {
  const config = resolveConfig({
    handover: { path: 'reports/H.md', thresholdPercent: 'never' },
  });
  assert.deepEqual(config.handover, {
    path: 'reports/H.md',
    marker: DEFAULT_HANDOVER_MARKER,
    budgetTokens: DEFAULT_HANDOVER_BUDGET_TOKENS,
    thresholdPercent: 'never',
  });
  // The three fields the DELIVERY is made of resolve exactly as they do without
  // the word, which is the whole claim: muting the ask is not switching the
  // feature off, and `handover: null` — the switch that does turn it off — is
  // still reached only by removing the key.
  assert.notEqual(config.handover, null);
  assert.equal(HANDOVER_ASK_NEVER, 'never');
});

test('"never" is a MUTE and not a threshold, so no percent is handed back for it', () => {
  const muted = resolveConfig({ handover: { path: 'a.md', thresholdPercent: 'never' } }).handover;
  const chosen = resolveConfig({ handover: { path: 'a.md', thresholdPercent: 85 } }).handover;
  const unchosen = resolveConfig({ handover: { path: 'a.md' } }).handover;
  assert.ok(muted && chosen && unchosen);

  assert.equal(handoverAskMuted(muted), true);
  assert.equal(handoverAskMuted(chosen), false);
  assert.equal(handoverAskMuted(unchosen), false);

  // `null` rather than the default, and this is the assertion that keeps the
  // strip honest: `first ask at 98%` is drawn from this number, and a muted ask
  // has no first ask to name.
  assert.equal(handoverThresholdPercent(muted), null);
  assert.equal(handoverThresholdPercent(chosen), 85);
  assert.equal(handoverThresholdPercent(unchosen), DEFAULT_HANDOVER_THRESHOLD_PERCENT);
});

test('100 is still a NUMBER, so the accidental workaround stays what it was', () => {
  // The item filing this defect names `thresholdPercent: 100` as the workaround
  // people reach for, and names why it is not an off switch: it fails to fire
  // only because Claude Code auto-compacts at ~99.75%, which is a number nobody
  // in this project controls. It must therefore keep parsing as the threshold it
  // is — a build that compacted at exactly 100.0 would ask — rather than being
  // quietly folded into the mute.
  const config = resolveConfig({ handover: { path: 'a.md', thresholdPercent: 100 } });
  assert.ok(config.handover);
  assert.equal(handoverAskMuted(config.handover), false);
  assert.equal(handoverThresholdPercent(config.handover), 100);
});

test('every other word is refused, and the refusal names the one that works', () => {
  for (const bad of ['off', 'none', 'no', 'NEVER', 'false', '98', true, null]) {
    assert.throws(
      () => resolveConfig({ handover: { path: 'a.md', thresholdPercent: bad } }),
      /handover\.thresholdPercent/,
      JSON.stringify(bad) ?? String(bad),
    );
  }
  // The message has to carry the accepted word, not merely refuse: a person who
  // wrote `"off"` meant exactly this feature, and a refusal that does not say
  // `"never"` leaves them with the whole-feature switch as their only option —
  // which is the defect, restated by the error message.
  assert.throws(
    () => resolveConfig({ handover: { path: 'a.md', thresholdPercent: 'off' } }),
    /"never".*mutes the automatic ask and still delivers the handover.*Nothing was loaded/s,
  );
  // And the numbers are refused exactly as hard as they were.
  for (const bad of [0, -1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => resolveConfig({ handover: { path: 'a.md', thresholdPercent: bad } }),
      /handover\.thresholdPercent/,
      String(bad),
    );
  }
});
