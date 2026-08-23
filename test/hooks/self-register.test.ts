/**
 * **mycontext, registered for mycontext** — `hooks seq:23`.
 *
 * The finding that task records is that this repository has no `.claude`
 * directory, so `hooks/hooks.json` — which is a PLUGIN manifest, and applies
 * where the plugin is INSTALLED — never applies here. The product does not
 * consume itself: no injection reaches a session working on mycontext, and the
 * one surface that would prove the integration works never runs.
 *
 * The measured picture is one turn worse than that. The plugin IS installed and
 * IS enabled — `mycontext@mycontext`, user scope, in
 * `C:/Users/UserC/.claude/plugins/installed_plugins.json` — but it is pinned to
 * a frozen **1.0.0** copy in the plugin cache, taken 2026-08-17, whose own
 * `hooks/hooks.json` registers four events (`SessionStart`, `PreToolUse`,
 * `PreCompact`, `PostToolUse`) against the `startup|clear|resume|compact`
 * matcher that predates `fork`. Piping a real `SessionStart` payload into that
 * cached binary against this project's corpus exits 0, writes nothing to stdout
 * and appends no audit row. So the installed integration is not merely absent,
 * it is present and silent, which is the harder failure to notice.
 *
 * ── WHAT THIS FILE ENFORCES, AND WHAT IT DELIBERATELY DOES NOT DECIDE ──────
 *
 * `.claude/settings.json` is DERIVED from `hooks/hooks.json` and this test
 * fails on any difference. That is the whole design: which events my_context
 * turns on is a ruling that already exists, in the manifest, and the
 * self-registration re-states it rather than making a second, quieter one.
 * `hooks seq:22` — *make mycontext autonomous from the first second… what must
 * ship as a default and what genuinely requires the user* — is BLOCKED on the
 * owner, and this file must never become the place that answer leaks out
 * through. If the derived file and the manifest can only ever be equal, no
 * posture can be chosen here without changing the manifest, in the open, where
 * the ruling belongs.
 *
 * The one substantive transformation is `${CLAUDE_PLUGIN_ROOT}` →
 * `${CLAUDE_PROJECT_DIR}`, and it is not cosmetic: build 2.1.239's hook runner
 * (byte 317131150) substitutes `${CLAUDE_PROJECT_DIR}` unconditionally and
 * `${CLAUDE_PLUGIN_ROOT}` only when the entry came from a plugin registry —
 * `Fe=Fe.replaceAll("${CLAUDE_PROJECT_DIR}",()=>C);if(Re)Fe=Fe.replaceAll("${CLAUDE_PLUGIN_ROOT}",()=>Re)`
 * — so a settings file that kept the plugin variable would run `node
 * "${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts"` literally, and fail on
 * every event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLUGIN_ROOT_VAR, PROJECT_DIR_VAR, SELF_SETTINGS_PATH, renderSelfRegistration,
} from '../../src/hooks/self-register.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function manifestText(): string {
  return readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8');
}

function settingsPath(): string {
  return path.join(ROOT, SELF_SETTINGS_PATH);
}

test('this repository registers my_context\'s hooks for itself', () => {
  assert.ok(existsSync(settingsPath()),
    `${SELF_SETTINGS_PATH} does not exist, so nothing in this repository runs my_context's ` +
    'hooks and the product is not a consumer of the product (hooks seq:23).');
});

test('the checked-in settings are exactly what the manifest derives', () => {
  const expected = renderSelfRegistration(manifestText());
  const actual = readFileSync(settingsPath(), 'utf8');
  assert.equal(actual, expected,
    `${SELF_SETTINGS_PATH} has drifted from hooks/hooks.json. It is DERIVED, and it is derived ` +
    'so that the set of events my_context turns on for itself can never quietly differ from the ' +
    'set it turns on for a user — which is the ruling hooks seq:22 is blocked on. Regenerate it ' +
    'from the manifest rather than editing it.');
});

test('the derived settings carry no plugin-only variable', () => {
  const rendered = renderSelfRegistration(manifestText());
  assert.ok(!rendered.includes(PLUGIN_ROOT_VAR),
    `${PLUGIN_ROOT_VAR} survived into the settings file. Build 2.1.239 substitutes it only for ` +
    'entries that came from a plugin registry, so in a settings file it stays literal and every ' +
    'hook fails to start.');
  assert.ok(rendered.includes(PROJECT_DIR_VAR), 'nothing resolves the binaries\' location');
});

test('every event in the manifest is in the derived settings, with its timeout and matcher', () => {
  const manifest = JSON.parse(manifestText()) as { hooks: Record<string, unknown[]> };
  const derived = JSON.parse(renderSelfRegistration(manifestText())) as {
    hooks: Record<string, unknown[]>;
  };
  assert.deepEqual(
    Object.keys(derived.hooks).sort(), Object.keys(manifest.hooks).sort(),
    'the derived settings register a different set of events from the manifest',
  );
  for (const [name, entries] of Object.entries(manifest.hooks)) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(entries).replaceAll(PLUGIN_ROOT_VAR, PROJECT_DIR_VAR)),
      derived.hooks[name],
      `${name}'s entries differ by more than the root variable`,
    );
  }
});

test('the derived settings name binaries that exist in this repository', () => {
  const derived = JSON.parse(renderSelfRegistration(manifestText())) as {
    hooks: Record<string, { hooks: { command: string }[] }[]>;
  };
  for (const [name, entries] of Object.entries(derived.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        const found = /\$\{CLAUDE_PROJECT_DIR\}\/(src\/hooks\/[a-z-]+\.ts)/u.exec(hook.command);
        assert.ok(found, `${name} names no binary under src/hooks: ${hook.command}`);
        assert.ok(existsSync(path.join(ROOT, found[1])),
          `${name} would run ${found[1]}, which is not in this repository. ` +
          '${CLAUDE_PROJECT_DIR} is the directory the session was opened in, so this file only ' +
          'works for a session opened at the repository root.');
      }
    }
  }
});
