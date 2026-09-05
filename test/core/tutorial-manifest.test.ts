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
const META_SCREENS = new Set(['parts.js', 'tut.js', 'docs.js', 'learn.js']);
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
