/**
 * The coverage test for `docs/tutorials/manifest.json` —
 * `TASK-the-tutorial-manifest-and-the-surface-globs-it-derives-from`
 * (`plan:tuts seq:1`).
 *
 * Globs the four surfaces INDEPENDENTLY of the manifest — never by reading
 * the manifest's own idea of what exists — so a stale manifest cannot pass by
 * agreeing with itself. Every file (except the named meta/plumbing
 * exclusions) must be claimed by EXACTLY one tutorial: zero owners and two
 * owners both fail, naming the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { loadTutorialManifest, type TutorialManifestEntry } from '../../src/core/tutorial-manifest.ts';
import { CATEGORIES } from '../../src/core/categories.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
// The screens that are ABOUT the documentation system rather than about a
// feature a tutorial could teach, plus the shared `parts.js`. `tut.js` and
// `docs.js` were two of these until 2026-09-05, when
// `DEC-the-documentation-and-tutorials-screens-become-one-list-and` replaced
// both with `library.js` — which inherits the exclusion for the same reason
// they held it: a tutorial teaching the reader how to find the tutorials is a
// circle, not a lesson.
// `cli-help.js` joined them on 2026-09-06 (`plan:library seq:1`): it is the
// Library's command-line card, a second module of that same page, and a
// tutorial about the screen that explains the CLI is the same circle.
//
// **This set is written twice and the two had drifted.** The generator's copy
// (`scripts/build-tutorial-manifest.ts`) still named `tut.js` and `docs.js` and
// did not name `library.js`, four weeks after those files stopped existing —
// so `npm run gen:tutorials` and this test disagreed about which screens are
// exempt, and only this half was ever run. Both are corrected; the duplication
// itself is left, because the generator may not import a test and this test
// deliberately does not import the generator (that is the independence the file
// header argues for).
const META_SCREENS = new Set(['parts.js', 'library.js', 'cli-help.js', 'learn.js']);
const PLUMBING_CLI = new Set(['index.ts', 'registry.ts', 'format.ts']);

function claimMap(manifest: TutorialManifestEntry[], pick: (e: TutorialManifestEntry) => string[]): Map<string, string[]> {
  const claimed = new Map<string, string[]>();
  for (const entry of manifest) {
    for (const f of pick(entry)) claimed.set(f, [...(claimed.get(f) ?? []), entry.id]);
  }
  return claimed;
}

test('every CLI command file is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = claimMap(manifest, (e) => e.cli);
  const files = readdirSync(path.join(REPO_ROOT, 'src/cli/commands'))
    .filter((f) => f.endsWith('.ts') && !PLUMBING_CLI.has(f));
  for (const f of files) {
    const owners = claimed.get(f) ?? [];
    assert.equal(owners.length, 1, `${f}: claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every UI screen file is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = claimMap(manifest, (e) => e.screens);
  const files = readdirSync(path.join(REPO_ROOT, 'src/ui/public/screens'))
    .filter((f) => f.endsWith('.js') && !META_SCREENS.has(f));
  for (const f of files) {
    const owners = claimed.get(f) ?? [];
    assert.equal(owners.length, 1, `${f}: claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every slash command file is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = claimMap(manifest, (e) => e.slash);
  const files = readdirSync(path.join(REPO_ROOT, 'commands')).filter((f) => f.endsWith('.md'));
  for (const f of files) {
    const owners = claimed.get(f) ?? [];
    assert.equal(owners.length, 1, `${f}: claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every category is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = claimMap(manifest, (e) => e.categories);
  for (const key of Object.keys(CATEGORIES)) {
    const owners = claimed.get(key) ?? [];
    assert.equal(owners.length, 1, `category "${key}": claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every tutorial has a unique id and a valid tier', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const ids = manifest.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate tutorial id');
  for (const e of manifest) assert.ok(e.tier === 'basic' || e.tier === 'advanced', e.id);
});

test('loadTutorialManifest refuses a missing manifest file, naming the path', () => {
  assert.throws(
    () => loadTutorialManifest(path.join(REPO_ROOT, 'test', 'fixtures', 'nonexistent-repo-root')),
    /docs\/tutorials\/manifest\.json/,
  );
});

test('the manifest reports its measured tutorial count (informational)', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  console.log(`tutorial manifest: ${manifest.length} tutorials`);
  assert.ok(manifest.length > 0);
});
