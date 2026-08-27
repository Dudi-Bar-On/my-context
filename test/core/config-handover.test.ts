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
  resolveConfig, skippedKeyNotice,
  DEFAULT_HANDOVER_MARKER, DEFAULT_HANDOVER_BUDGET_TOKENS,
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
