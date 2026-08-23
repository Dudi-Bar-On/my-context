import { isMainEntry } from '../core/paths.ts';

/**
 * my_context registering my_context's hooks — for this repository, and only for
 * it (`hooks seq:23`).
 *
 * ── THE GAP ────────────────────────────────────────────────────────────────
 *
 * `hooks/hooks.json` is a PLUGIN manifest. It applies where the plugin is
 * INSTALLED, and installing it into its own repository is not something a
 * manifest can do for itself. So for the whole life of this project, every hook
 * in `src/hooks/` ran in other people's sessions and never in the ones building
 * it: no injection reached a session working on mycontext, the audit stream
 * showed no injection rows to render, and the one surface that would prove the
 * integration works end to end had never once run against the corpus it was
 * built from. A product that is not a consumer of itself is testing the parts
 * and shipping the whole.
 *
 * **Measured, 2026-08-23, and worse than "absent".** The plugin IS installed and
 * IS enabled — `mycontext@mycontext`, user scope, `enabledPlugins` true — but it
 * resolves to a frozen **1.0.0** snapshot in the plugin cache taken 2026-08-17.
 * That snapshot's own manifest registers four events, on the
 * `startup|clear|resume|compact` matcher that predates `fork`, and piping a
 * real `SessionStart` payload into its `session-start.ts` against this
 * project's corpus exits 0, prints nothing and appends no audit row. So the
 * integration is not missing, it is present and mute — which is the failure
 * that survives longest, because everything looks installed.
 *
 * ── WHAT THIS MODULE IS ────────────────────────────────────────────────────
 *
 * A derivation, not a decision. `.claude/settings.json` is generated from
 * `hooks/hooks.json` with one substitution, and
 * `test/hooks/self-register.test.ts` fails on any difference between them.
 *
 * **That equality is the point, and it is the guard rail on a blocked
 * ruling.** WHICH events my_context turns on is `hooks seq:22` — *make
 * mycontext autonomous from the first second: survey every integration surface
 * and ship the settings* — and that task is BLOCKED on the owner. A hand-written
 * settings file would be a second, quieter place to answer it: someone adds an
 * event here that the manifest does not carry, or drops one it does, and the
 * product's posture has been changed by a file nobody reads. Deriving it means
 * the only way to change what this repository turns on is to change what every
 * installation turns on, in the manifest, where the ruling belongs.
 *
 * ── THE SUBSTITUTION, AND WHY IT IS NOT COSMETIC ───────────────────────────
 *
 * Build 2.1.239's hook runner (byte 317131150):
 *
 *     Fe=Fe.replaceAll("${CLAUDE_PROJECT_DIR}",()=>C);
 *     if(Re)Fe=Fe.replaceAll("${CLAUDE_PLUGIN_ROOT}",()=>Re);
 *
 * `${CLAUDE_PROJECT_DIR}` is substituted for every hook command.
 * `${CLAUDE_PLUGIN_ROOT}` is substituted only when `Re` — the plugin root — is
 * defined, which it is not for an entry read out of a settings file. A settings
 * file that kept the plugin variable would therefore run
 * `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts"` with the braces
 * intact, and every event would fail to start.
 *
 * ── THE TWO LIMITS, STATED HERE RATHER THAN DISCOVERED ─────────────────────
 *
 *  1. **It covers a session opened at THIS directory.** `${CLAUDE_PROJECT_DIR}`
 *     is the directory the session was opened in, so `<repo>/src/hooks/…`
 *     resolves only for a session rooted here. A session opened one level up —
 *     in a wrapper checkout that contains this repository as a subdirectory —
 *     resolves the variable to the wrapper and finds no `src/hooks`, and it
 *     also resolves a DIFFERENT corpus, because `findProjectRoot` walks upward
 *     and stops at the first `.my_context` it meets. Registering for that
 *     wrapper is a change to a directory this repository does not own.
 *  2. **The installed 1.0.0 plugin still registers four of these events.** So
 *     in a session here, `SessionStart`, `PreToolUse`, `PreCompact` and
 *     `PostToolUse` each run twice: once from the cache, once from the working
 *     tree. The duplication is bounded — the hooks are keyed on the same seen
 *     file, so the second delivery dedupes, and the cached copy was measured
 *     producing nothing at all — but it is two process spawns where one is
 *     wanted, and the fix is to update or remove the cached install, which is
 *     an act on the user's machine and not this repository's to perform.
 */

export const PLUGIN_ROOT_VAR = '${CLAUDE_PLUGIN_ROOT}';
export const PROJECT_DIR_VAR = '${CLAUDE_PROJECT_DIR}';

/** Where the derived file lives, repo-relative and POSIX, as the test reads it. */
export const SELF_SETTINGS_PATH = '.claude/settings.json';

/**
 * The generated file's exact bytes, from the manifest's exact bytes.
 *
 * A string transformation rather than a parse-and-re-serialise, deliberately:
 * re-serialising would silently normalise key order, spacing and anything the
 * manifest carries that this function does not model, so a manifest change of a
 * kind nobody anticipated would arrive here as a quiet reformat instead of as
 * the difference it is. What comes out is the manifest, wrapped in the object a
 * settings file expects, with one variable renamed — and nothing else can
 * change without being visible in the diff.
 *
 * The header comment is part of the output because the file is generated and a
 * reader who opens it must be told so before they edit it. JSON has no comment
 * syntax, so it is carried in a `"//"` key, which Claude Code's settings schema
 * ignores and every JSON parser accepts.
 */
export function renderSelfRegistration(manifestText: string): string {
  const manifest = JSON.parse(manifestText) as { hooks: Record<string, unknown> };
  const hooksText = JSON.stringify(manifest.hooks, null, 2)
    .replaceAll(PLUGIN_ROOT_VAR, PROJECT_DIR_VAR);

  // Indented by two so the block sits under `"hooks":` at the same depth the
  // rest of the file uses. `JSON.stringify` indents from column zero, so every
  // line after the first needs the offset added.
  const indented = hooksText.split('\n').join('\n  ');

  return [
    '{',
    '  "//": "GENERATED from hooks/hooks.json by src/hooks/self-register.ts. Do not edit: ' +
      'test/hooks/self-register.test.ts fails on any difference. This file is what makes ' +
      'my_context run its own hooks in its own repository (hooks seq:23); WHICH events it ' +
      'registers is the manifest\'s ruling, not this file\'s.",',
    `  "hooks": ${indented}`,
    '}',
    '',
  ].join('\n');
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // Prints the file rather than writing it. A generator that writes on import,
  // or on any invocation, is a program that can change a settings file as a
  // side effect of being looked at; redirecting is one keystroke and it is the
  // caller's decision.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = (await import('node:path')).default;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  process.stdout.write(
    renderSelfRegistration(readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8')),
  );
}
