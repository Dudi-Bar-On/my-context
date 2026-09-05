import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWatchedDocsServable, isServableDocPath } from '../../src/doctor/checks.ts';
import { buildDocManifest } from '../../src/ui/read-model.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import { matchesAnyGlob } from '../../src/core/paths.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `plan:docsys seq:4` — the gate under
 * `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`
 * (`severity: hard`): *"Being in the repository does not make a document
 * viewable. Being IN THE CORPUS does — reachable through `watchedDocs`."*
 *
 * **What this file holds true, and why it is the whole of the mechanism.**
 * There are two boundaries in this product and they were decided eleven days
 * apart. `watchedDocs` (config.json) says which documents this corpus CLAIMS;
 * `isServableDocPath` (`DEC-the-documentation-system-is-hand-built-over-a-wide-glob`,
 * 2026-09-05) says which documents a reader can OPEN. Nothing measured that
 * the first fits inside the second, so a glob widened past the route would put
 * a document in the corpus and out of every reader's reach — silently, which
 * is exactly the failure the requirement was written about.
 *
 * The two READMEs are the case that matters: `README.md` was added to
 * `watchedDocs` on 2026-09-05 for this task, and `docs/README.he.md` was
 * already inside `docs/**\/*.md`. This file asserts both halves for both of
 * them against THIS repository, not a fixture — the project dogfoods itself
 * (`REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e`), and a
 * fixture cannot fail when the real config moves.
 *
 * **Four of these run against this repository and three against a temp
 * fixture** (`INSTR-testing-happens-against-the-current-corpus-and-an-exception`
 * asks for the first and for the second to be justified rather than assumed):
 * the negative branch — a watched document the route cannot serve — cannot be
 * exercised on the current corpus without first introducing into it the very
 * defect the check exists to report.
 *
 * **Deliberately NOT here:** whether a document's PROSE is current. That is
 * the `test/docs/` family's job (`STD-documentation-is-regenerated-not-edited-to-match`),
 * and no assertion in this file should be read as making a claim about it.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

function fixture(): { repoRoot: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-watched-'));
  mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'reports'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'notes'), { recursive: true });
  writeFileSync(path.join(repoRoot, 'README.md'), '# Readme\n');
  writeFileSync(path.join(repoRoot, 'docs', 'README.he.md'), '# קרא אותי\n');
  writeFileSync(path.join(repoRoot, 'reports', 'a-report.md'), '## A report\n');
  writeFileSync(path.join(repoRoot, 'notes', 'scratch.md'), '# Scratch\n');
  return { repoRoot, cleanup: () => removeTree(repoRoot) };
}

/** The shape `checkWatchedDocsServable` reads — only `watchedDocs` is consulted,
 * so the rest of a `Config` is not built here just to be ignored. */
function config(watchedDocs: string[]): Config {
  return { watchedDocs } as Config;
}

/** This repository's own `config.json`, resolved the way every command
 * resolves it — read here rather than restated, so the assertions below move
 * when the owner moves `watchedDocs` instead of quietly testing a copy. */
function shippedConfig(): Config {
  return resolveConfig(JSON.parse(readFileSync(path.join(REPO_ROOT, '.my_context', 'config.json'), 'utf8')));
}

test('the shipped watchedDocs claims both READMEs, and both are servable', () => {
  const watchedDocs = shippedConfig().watchedDocs;
  for (const doc of ['README.md', 'docs/README.he.md']) {
    assert.equal(
      matchesAnyGlob(doc, watchedDocs), true,
      `${doc} is not matched by watchedDocs (${JSON.stringify(watchedDocs)}), ` +
      'so this corpus does not claim it and the UI has no business serving it',
    );
    assert.equal(
      isServableDocPath(doc), true,
      `${doc} is watched but outside the document route's boundary — it would be in the corpus ` +
      'and unopenable',
    );
  }
});

test('both READMEs reach a reader: each is a document-manifest entry, by id', () => {
  const { entries } = buildDocManifest(REPO_ROOT);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  const en = byId.get('README.md');
  assert.ok(en, 'README.md is not in the document manifest, so GET /api/doc/README.md would 404');
  assert.equal(en.language, 'en');
  assert.equal(
    en.hasHebrewMirror, true,
    'README.md reports no Hebrew mirror, but docs/README.he.md is the mirror this project ships',
  );
  assert.ok(en.headings.length > 0, 'README.md produced no heading index');

  const he = byId.get('docs/README.he.md');
  assert.ok(he, 'docs/README.he.md is not in the document manifest');
  assert.equal(he.language, 'he');
  assert.ok(he.headings.length > 0, 'docs/README.he.md produced no heading index');
});

test('every document the corpus watches is one the manifest can serve', () => {
  // The whole check, run against the real repository rather than restated:
  // the finding list IS the claim, so an empty one is the assertion.
  const findings = checkWatchedDocsServable(REPO_ROOT, shippedConfig());
  const unserved = findings.filter((f) => f.code === 'watched_doc_unserved');
  assert.deepEqual(
    unserved.map((f) => f.message), [],
    'a document this corpus watches cannot be opened by a reader',
  );
});

test('a watched document outside the route is reported, naming the file and the glob', () => {
  const { repoRoot, cleanup } = fixture();
  try {
    const findings = checkWatchedDocsServable(repoRoot, config(['docs/**/*.md', 'notes/**/*.md']));
    assert.equal(findings.length, 1, 'exactly the one unservable watched file was expected');
    const [finding] = findings;
    assert.equal(finding.code, 'watched_doc_unserved');
    assert.equal(finding.level, 'warn');
    assert.match(finding.message, /notes\/scratch\.md/, 'the finding does not name the file');
    assert.match(finding.message, /notes\/\*\*\/\*\.md/, 'the finding does not name the glob');
    // The side effect `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`
    // asks to be said out loud rather than discovered later.
    assert.match(finding.message, /post-tool-use/, 'the capture-nudge consequence is not stated');
  } finally {
    cleanup();
  }
});

test('README.md, docs/ and reports/ are all inside the route — none of them is reported', () => {
  const { repoRoot, cleanup } = fixture();
  try {
    const findings = checkWatchedDocsServable(
      repoRoot, config(['README.md', 'docs/**/*.md', 'reports/**/*.md']),
    );
    assert.deepEqual(findings.map((f) => f.message), []);
  } finally {
    cleanup();
  }
});

test('an empty watchedDocs claims nothing, so nothing can be unreachable', () => {
  const { repoRoot, cleanup } = fixture();
  try {
    assert.deepEqual(checkWatchedDocsServable(repoRoot, config([])), []);
  } finally {
    cleanup();
  }
});

test('the check and the manifest read one boundary, not two', () => {
  // `buildDocManifest` filters on `isServableDocPath` and so does the check.
  // If a later edit gives either one its own copy of the rule, this fails.
  const { repoRoot, cleanup } = fixture();
  try {
    const { entries } = buildDocManifest(repoRoot);
    const served = new Set(entries.map((entry) => entry.id));
    assert.deepEqual(
      [...served].sort(), ['README.md', 'docs/README.he.md', 'reports/a-report.md'],
    );
    // Every file the fixture holds: served exactly when the predicate says so.
    for (const rel of ['README.md', 'docs/README.he.md', 'reports/a-report.md', 'notes/scratch.md']) {
      assert.equal(
        served.has(rel), isServableDocPath(rel),
        `${rel}: the manifest and isServableDocPath disagree about whether it is servable`,
      );
    }
  } finally {
    cleanup();
  }
});
