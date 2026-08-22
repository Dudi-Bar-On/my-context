/**
 * **The `SessionStart` matcher must name every `source` the platform sends.**
 *
 * A `SessionStart` entry whose matcher does not match the incoming `source`
 * does not fail — it does not RUN. Nothing is injected and nothing says so,
 * which is `INV-nothing-is-dropped-silently` failing at the outermost edge,
 * where no code of ours is reached to catch it.
 *
 * That happened: the matcher read `startup|clear|resume|compact` while the
 * platform's own payload schema declared five values. A forked session got
 * nothing, silently, and no test noticed because every test we had supplied
 * the `source` itself.
 *
 * ── WHERE THE LIST COMES FROM ──────────────────────────────────────────────
 *
 * Claude Code ships as a single executable and validates its own hook payload
 * against a schema carried inside it. Read on build 2.1.239 at
 * `C:/Users/UserC/.local/share/claude/versions/2.1.239`, by
 * `grep -a -o -E 'hook_event_name:kt\("SessionStart"\).{0,120}'`:
 *
 *     hook_event_name:kt("SessionStart"),
 *     source:Or(["startup","resume","clear","compact","fork"]),
 *     agent_type:L().optional(),model:L().optional(),session_title:...
 *
 * That is a validation schema, not a comment, so the five are the values the
 * platform accepts. It does NOT prove each one occurs — see
 * `reports/probes/2026-08-20-clear-and-prompt-hooks.md`.
 *
 * **This list is hand-kept and cannot be derived**: it lives in a binary, not
 * in a package this project depends on. So the test's job is to make a change
 * DELIBERATE rather than to catch a new platform value on its own. When a
 * sixth value appears, this test fails, and whoever updates it re-reads the
 * schema on the current build and records the version here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `source` values build 2.1.239's payload schema accepts, in its order. */
const PLATFORM_SOURCES = ['startup', 'resume', 'clear', 'compact', 'fork'] as const;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sessionStartMatcher(): string {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as {
    hooks: Record<string, { matcher?: string }[]>;
  };
  const entries = manifest.hooks['SessionStart'];
  assert.ok(entries !== undefined && entries.length === 1,
    'SessionStart must have exactly one entry — two entries would run the hook twice per session');
  const matcher = entries[0]?.matcher;
  assert.ok(typeof matcher === 'string' && matcher !== '',
    'the SessionStart entry must carry a matcher; an absent one is not the same as a permissive one');
  return matcher;
}

test('the SessionStart matcher names every source the platform sends', () => {
  const declared = sessionStartMatcher().split('|');
  assert.deepEqual(
    [...declared].sort(), [...PLATFORM_SOURCES].sort(),
    'the matcher and the platform schema disagree. A source the matcher omits does not fail — ' +
    'the hook does not run at all, nothing is injected, and nothing says so. Re-read the schema ' +
    'on the current build (see this file\'s header) before changing either side.',
  );
});

test('every source the injector branches on is one the matcher admits', () => {
  const declared = new Set(sessionStartMatcher().split('|'));
  const inject = readFileSync(path.join(ROOT, 'src', 'core', 'inject.ts'), 'utf8');
  // `options.source === '<value>'` is how the injector asks which session shape it is in.
  const branched = [...inject.matchAll(/options\.source === '([a-z]+)'/gu)].map((m) => m[1] ?? '');
  assert.ok(branched.length > 0,
    'found no source branch in inject.ts — this test would pass vacuously; the regex has drifted');
  for (const source of branched) {
    assert.ok(declared.has(source),
      `inject.ts branches on source '${source}', which the matcher does not admit — that branch ` +
      'is unreachable, because the hook never runs for it');
  }
});

test('every source the matcher admits is a source the platform declares', () => {
  // The reverse of the first test, stated separately so a failure says which
  // direction broke: a matcher naming a value the platform never sends is dead
  // configuration, and reads as coverage it does not have.
  const platform = new Set<string>(PLATFORM_SOURCES);
  for (const source of sessionStartMatcher().split('|')) {
    assert.ok(platform.has(source),
      `the matcher admits '${source}', which build 2.1.239's schema does not declare`);
  }
});
