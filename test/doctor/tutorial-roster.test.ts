import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTutorialRoster } from '../../src/doctor/checks.ts';
import {
  loadTutorialManifest, TUTORIAL_MANIFEST_PATH, type TutorialManifestEntry,
} from '../../src/core/tutorial-manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `plan:docsys seq:4` — the TUTORIAL half, under
 * `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` and
 * `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`.
 *
 * **What the README half already settled, and why the tutorials needed one
 * more thing.** `LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of`
 * ruled that the corpus's record of a watched document is the pair
 * (`watchedDocs` membership, a manifest entry served fresh off disk) and never
 * a copy — so there is nothing that can be silently stale — and
 * `test/doctor/watched-docs-servable.test.ts` is the gate binding those two
 * halves together. Both halves already hold for all 48 tutorial files:
 * `docs/**\/*.md` claims every one of them and `isServableDocPath` serves
 * every one of them.
 *
 * The tutorials have a THIRD boundary the READMEs do not, and it IS a copy:
 * `docs/tutorials/manifest.json`, a checked-in roster derived by hand
 * (`npm run gen:tutorials`). Its drift against the four SURFACES it clusters
 * is gated by `test/core/tutorial-manifest.test.ts`. Its drift against the
 * FILE ROSTER was gated by nothing, and only one of the two directions is
 * silent:
 *
 *  - roster names a file that is absent → `apiTutorials` draws the row
 *    `unmeasured`/`todo` and `heRollup.total` excludes it. Visible already,
 *    and deliberately NOT reported twice (asserted below).
 *  - a file on disk that the roster does not name → watched, servable, and
 *    invisible in every tutorial surface at once, including
 *    `test/docs/tutorial-facts.test.ts`, which derives its document set from
 *    this same roster. That is where a tutorial's version string goes stale
 *    with nothing failing, and it is what `checkTutorialRoster` reports.
 *
 * **Three of these run against this repository and four against a temp
 * fixture** (`INSTR-testing-happens-against-the-current-corpus-and-an-exception`):
 * the negative branches cannot be exercised on the current corpus without
 * first planting in it the defect the check exists to report.
 *
 * **Deliberately NOT here:** whether a tutorial's PROSE is true. Four literal
 * facts are `test/docs/tutorial-facts.test.ts`'s job and the rest is human
 * review (`STD-documentation-is-regenerated-not-edited-to-match`). Nothing in
 * this file should be read as a claim about it.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const TUTORIAL_DIR = TUTORIAL_MANIFEST_PATH.split('/').slice(0, -1).join('/');

/** Every `.md` file directly under this repository's tutorial directory,
 * repo-relative — derived by walking the directory, never by asking the
 * manifest what it thinks is there. A roster that answered this question
 * about itself would agree with itself no matter what it held. */
function tutorialFilesOnDisk(): string[] {
  return readdirSync(path.join(REPO_ROOT, ...TUTORIAL_DIR.split('/')), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `${TUTORIAL_DIR}/${e.name}`)
    .sort();
}

function entry(id: string, over: Partial<TutorialManifestEntry> = {}): TutorialManifestEntry {
  return {
    id,
    title: `Do the thing called ${id}`,
    tier: 'basic',
    cli: [], slash: [], screens: [], categories: [],
    enFile: `${TUTORIAL_DIR}/${id}.md`,
    heFile: `${TUTORIAL_DIR}/${id}.he.md`,
    ...over,
  };
}

/** A repository root holding a tutorial directory, a roster, and whichever
 * files the caller asks for. `manifest` is written as given (a string, so a
 * malformed roster is expressible). */
function fixture(opts: { manifest?: string; files?: string[] }): {
  repoRoot: string; cleanup: () => void;
} {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-tutroster-'));
  mkdirSync(path.join(repoRoot, ...TUTORIAL_DIR.split('/')), { recursive: true });
  if (opts.manifest !== undefined) {
    writeFileSync(path.join(repoRoot, ...TUTORIAL_MANIFEST_PATH.split('/')), opts.manifest);
  }
  for (const rel of opts.files ?? []) {
    writeFileSync(path.join(repoRoot, ...rel.split('/')), '# A tutorial\n');
  }
  return { repoRoot, cleanup: () => removeTree(repoRoot) };
}

/* ---------------------------------------------------------------------------
 * Against this repository — the measured zero.
 * ------------------------------------------------------------------------- */

test('every tutorial file this repository ships is named by the roster', () => {
  // The whole check, run against the real repository rather than restated: the
  // finding list IS the claim, so an empty one is the assertion.
  const findings = checkTutorialRoster(REPO_ROOT);
  assert.deepEqual(
    findings.map((f) => `${f.code}: ${f.message}`), [],
    'a tutorial file is served and watched but named by no manifest entry, so no tutorial ' +
    'surface — screen, rollup, or facts gate — is looking at it',
  );
});

test('the zero above is measured over a non-empty set, in both directions', () => {
  // A check that read an empty directory would also report nothing, and the
  // assertion above would pass while measuring nothing at all.
  const onDisk = tutorialFilesOnDisk();
  const named = [...new Set(
    loadTutorialManifest(REPO_ROOT).flatMap((e) => [e.enFile, e.heFile]),
  )].sort();
  assert.ok(onDisk.length > 0, `no .md file under ${TUTORIAL_DIR}/ — nothing was measured`);
  assert.ok(named.length > 0, `${TUTORIAL_MANIFEST_PATH} names no file — nothing was measured`);
  assert.deepEqual(
    onDisk, named,
    `${TUTORIAL_DIR}/ holds ${onDisk.length} file(s) and the roster names ${named.length}; the ` +
    'two sets are supposed to be equal — run `npm run gen:tutorials`',
  );
});

test('the tutorial files are the roster\'s own, so the facts gate reads all of them', () => {
  // `test/docs/tutorial-facts.test.ts` derives its document set from the same
  // roster. This states the consequence the check exists to protect: every
  // file on disk is a file that gate reads.
  const named = new Set(loadTutorialManifest(REPO_ROOT).flatMap((e) => [e.enFile, e.heFile]));
  const unread = tutorialFilesOnDisk().filter((rel) => !named.has(rel));
  assert.deepEqual(
    unread, [],
    'these tutorial files exist and no facts gate reads them: ' + unread.join(', '),
  );
});

/* ---------------------------------------------------------------------------
 * The branches this corpus cannot exercise without planting the defect.
 * ------------------------------------------------------------------------- */

test('a tutorial file the roster does not name is reported, naming the file and the fix', () => {
  const { repoRoot, cleanup } = fixture({
    manifest: JSON.stringify([entry('the-inbox')]),
    files: [
      `${TUTORIAL_DIR}/the-inbox.md`,
      `${TUTORIAL_DIR}/the-inbox.he.md`,
      `${TUTORIAL_DIR}/the-composer.md`,
    ],
  });
  try {
    const findings = checkTutorialRoster(repoRoot);
    assert.equal(findings.length, 1, 'exactly the one unlisted tutorial file was expected');
    const [finding] = findings;
    assert.equal(finding.code, 'tutorial_unlisted');
    assert.equal(finding.level, 'warn');
    assert.equal(finding.remedy.route, 'none', 'the fix is outside my_context, so nothing runs');
    assert.match(finding.message, /the-composer\.md/, 'the finding does not name the file');
    assert.match(finding.message, /npm run gen:tutorials/, 'the finding does not name the fix');
    // The three surfaces that are silent about it — the whole reason this is a
    // finding rather than a note.
    assert.match(finding.message, /tutorial-facts/, 'the stale-facts consequence is not stated');
  } finally {
    cleanup();
  }
});

test('a roster entry naming an absent file is NOT reported — the screen already draws it', () => {
  const { repoRoot, cleanup } = fixture({
    manifest: JSON.stringify([entry('the-inbox'), entry('never-written')]),
    files: [`${TUTORIAL_DIR}/the-inbox.md`, `${TUTORIAL_DIR}/the-inbox.he.md`],
  });
  try {
    assert.deepEqual(
      checkTutorialRoster(repoRoot).map((f) => f.message), [],
      'doctor is repeating a gap GET /api/tutorials already draws as unmeasured/todo — two ' +
      'surfaces stating one fact is how they come to disagree',
    );
  } finally {
    cleanup();
  }
});

test('a project with no tutorial roster claims nothing, so nothing is reported', () => {
  // Nearly every project this plugin is installed into. A finding here would
  // be an invented debt on a system that project does not have.
  const { repoRoot, cleanup } = fixture({ files: [`${TUTORIAL_DIR}/stray.md`] });
  try {
    assert.deepEqual(checkTutorialRoster(repoRoot), []);
  } finally {
    cleanup();
  }
});

test('a roster that exists and cannot be parsed is reported, not silently read as empty', () => {
  // GET /api/tutorials catches this and answers an empty list, so the screen
  // draws nothing and says nothing. This line is the only place it is stated.
  const { repoRoot, cleanup } = fixture({
    manifest: '{ not json at all',
    files: [`${TUTORIAL_DIR}/the-inbox.md`],
  });
  try {
    const findings = checkTutorialRoster(repoRoot);
    assert.equal(findings.length, 1);
    const [finding] = findings;
    assert.equal(finding.code, 'tutorial_roster_unreadable');
    assert.equal(finding.level, 'warn');
    assert.match(finding.message, /manifest\.json/, 'the finding does not name the file');
    assert.match(finding.message, /npm run gen:tutorials/, 'the finding does not name the fix');
  } finally {
    cleanup();
  }
});
