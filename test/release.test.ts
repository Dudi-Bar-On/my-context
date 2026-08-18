/**
 * The two claims a build makes about itself — what licence it is under, and
 * which version it is — asserted across every file that repeats them.
 *
 * Both are declared in more than one place because more than one consumer
 * reads them (npm reads `package.json`, Claude Code reads
 * `.claude-plugin/plugin.json`, `claude plugin install` reads
 * `.claude-plugin/marketplace.json`, and a user reads `mycontext status`), and
 * nothing at runtime reconciles them. A drifting version is not a cosmetic
 * defect here: `claude plugin tag` refuses a release whose marketplace entry
 * and plugin manifest disagree, and a user reporting a bug against a version
 * string that no longer matches the code they are running is a bug report that
 * cannot be acted on.
 *
 * `package.json` OWNS the version — see `VERSIONING.md`. Every assertion below
 * is directional: the other files are checked *against* it, never against each
 * other, so a failure names the file that has to change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VERSION, isSemver, parseVersion } from '../src/core/version.ts';
import { VERSION_SITES } from '../scripts/set-version.ts';

const ROOT = path.join(import.meta.dirname, '..');

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(...parts: string[]): string {
  return readFileSync(path.join(ROOT, ...parts), 'utf8').replaceAll('\r\n', '\n');
}

function json<T>(...parts: string[]): T {
  return JSON.parse(read(...parts)) as T;
}

interface Pkg { version: string; license: string }
interface Plugin { version: string; license: string }
interface Marketplace {
  version: string;
  license?: string;
  plugins: { version: string; license: string }[];
}

const pkg = json<Pkg>('package.json');

// ---------------------------------------------------------------------------
// Licence
// ---------------------------------------------------------------------------

test('the MIT licence text is present, and names the holder and year the manifests do', () => {
  const text = read('LICENSE');
  assert.match(text, /^MIT License\n/, 'LICENSE must be the standard MIT text, starting with its title');
  assert.match(text, /Copyright \(c\) 2026 Dudi Bar-On\n/);
  // The two clauses that make it MIT rather than some other permissive licence
  // paraphrased into an MIT-shaped file. Matching the title alone would pass on
  // an empty body.
  assert.match(text, /Permission is hereby granted, free of charge/);
  assert.match(
    text,
    /The above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software\./,
  );
  assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
});

test('every manifest declares the same licence, spelled the way the schema wants', () => {
  // `license`, American spelling. `claude plugin validate --strict` reports
  // `licence` as an unknown field ("did you mean 'license'?") and treats the
  // warning as an error, so the British spelling this project uses in prose is
  // wrong in all three of these files.
  assert.equal(pkg.license, 'MIT', 'package.json — the SPDX identifier npm reads');
  assert.equal(json<Plugin>('.claude-plugin', 'plugin.json').license, 'MIT');
  assert.equal(json<Marketplace>('.claude-plugin', 'marketplace.json').plugins[0].license, 'MIT');
});

/**
 * The placement opinion, found by running the tool rather than by reading the
 * reference: `license` is a recognised field on a plugin manifest and on a
 * marketplace *entry*, and is NOT recognised at the marketplace's top level,
 * where `claude plugin validate --strict` reports
 * `license: Unknown field 'license'. Claude Code ignores it at load time.` and
 * fails. This is the same class of finding as `repository` vs `homepage`.
 *
 * Pinned as an assertion because the field is otherwise the obvious thing to
 * add when someone notices the top-level manifest names an owner and a version
 * but no licence — and adding it breaks a strict validation that nothing in
 * `npm test` runs.
 */
test('marketplace.json declares no top-level licence, which strict validation rejects', () => {
  const market = json<Marketplace>('.claude-plugin', 'marketplace.json');
  assert.equal(
    Object.hasOwn(market, 'license'), false,
    '`claude plugin validate --strict` fails on a top-level `license` — it belongs on the ' +
    'plugins[] entry, which already carries it',
  );
});

test('both READMEs state the licence and point at the file', () => {
  const en = read('README.md');
  assert.match(en, /\[MIT licence\]\(LICENSE\)/, 'the English README must link the licence file');
  assert.match(en, /Copyright © 2026 Dudi Bar-On/);
  const he = read('docs', 'README.he.md');
  assert.match(he, /\[רישיון MIT\]\(\.\.\/LICENSE\)/, 'the Hebrew mirror must link it too');
  assert.match(he, /Copyright © 2026 Dudi Bar-On|© 2026 Dudi Bar-On/);
});

// ---------------------------------------------------------------------------
// Version — one owner, three repetitions, all checked against the owner
// ---------------------------------------------------------------------------

test('package.json declares a version this project will accept', () => {
  assert.ok(
    isSemver(pkg.version),
    `package.json says "${pkg.version}", which is not MAJOR.MINOR.PATCH — see VERSIONING.md`,
  );
});

test('the version the program reports is read from package.json, not transcribed', () => {
  assert.equal(
    VERSION, pkg.version,
    '`src/core/version.ts` must report the owning manifest\'s version, and nothing else',
  );
});

test('every manifest repeats package.json\'s version', () => {
  // Directional on purpose: each message names the file that has to change, and
  // names `package.json` as the one that does not. Comparing the repeats
  // against each other would report a disagreement without saying which side is
  // right, and the wrong fix — editing package.json to match a stale
  // manifest — silently un-does a release bump.
  const fix = 'run `node scripts/set-version.ts ' + pkg.version + '`';
  assert.equal(
    json<Plugin>('.claude-plugin', 'plugin.json').version, pkg.version,
    `.claude-plugin/plugin.json disagrees with package.json — ${fix}`,
  );
  const market = json<Marketplace>('.claude-plugin', 'marketplace.json');
  assert.equal(
    market.version, pkg.version,
    `.claude-plugin/marketplace.json (top level) disagrees with package.json — ${fix}`,
  );
  assert.equal(
    market.plugins[0].version, pkg.version,
    `.claude-plugin/marketplace.json plugins[0] disagrees with package.json — ${fix}`,
  );
});

/**
 * The gap an agreement test alone leaves open: a version declaration that
 * `scripts/set-version.ts` does not know about is left at its old value by
 * every release, and the three assertions above only notice for the three
 * sites they happen to name.
 *
 * So the script's site list is checked against the files themselves — every
 * `"version":` line in every manifest must be claimed by exactly one site.
 * Add a fourth manifest, or a second version field to an existing one, and
 * this fails with the line nobody would have updated.
 */
test('scripts/set-version.ts covers every version declaration in every manifest', () => {
  const MANIFESTS = [
    'package.json',
    path.join('.claude-plugin', 'plugin.json'),
    path.join('.claude-plugin', 'marketplace.json'),
  ];
  const ANY_VERSION_LINE = /^\s*"version": "[^"]*",?$/gm;

  assert.ok(VERSION_SITES.length > 0, 'the site list is empty — this test would check nothing');

  for (const file of MANIFESTS) {
    const source = read(...file.split(path.sep));
    const found = (source.match(ANY_VERSION_LINE) ?? []).length;
    const claimed = VERSION_SITES
      .filter((s) => s.file === file)
      .reduce((n, s) => n + s.count, 0);
    assert.equal(
      found, claimed,
      `${file} has ${found} version declaration(s) and scripts/set-version.ts claims ` +
      `${claimed}. An unclaimed one is never written by a release and will drift.`,
    );
  }

  // And each site's own pattern must still match what it says it matches —
  // a manifest reformatted (indentation, key order) can leave the counts above
  // right while a site's anchored pattern matches nothing.
  for (const site of VERSION_SITES) {
    const source = read(...site.file.split(path.sep));
    const hits = (source.match(new RegExp(site.pattern.source, 'gm')) ?? []).length;
    assert.equal(
      hits, site.count,
      `${site.file}: the pattern for "${site.what}" matched ${hits} time(s), expected ` +
      `${site.count}. scripts/set-version.ts would refuse to release.`,
    );
  }
});

/**
 * The badge is a number typed into prose, which is the shape this project's
 * documentation has got wrong three times (`docs/ROADMAP.md` E11). The usual
 * escape — a `shields.io/github/v/tag` badge that reads the forge — is not
 * available: the repository is private, so shields.io renders an error rather
 * than a version.
 *
 * So it is written by `scripts/set-version.ts` and checked here, in both
 * languages, against the one file that owns the number.
 */
test('both README version badges agree with package.json', () => {
  const BADGE = /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-([^-]+)-informational\)/;
  const fix = 'run `node scripts/set-version.ts ' + pkg.version + '`';

  for (const [label, file] of [
    ['README.md', ['README.md']],
    ['docs/README.he.md', ['docs', 'README.he.md']],
  ] as const) {
    const found = read(...file).match(BADGE);
    assert.ok(
      found,
      `${label} has no version badge. It is listed in scripts/set-version.ts, so a release ` +
      `would fail before writing anything — restore the badge or drop the site.`,
    );
    assert.equal(
      found[1], pkg.version,
      `${label}'s version badge says ${found[1]} and package.json says ${pkg.version} — ${fix}`,
    );
  }
});

test('parseVersion refuses every shape that is not a version, rather than guessing', () => {
  // A fallback here — 'unknown', '0.0.0' — would be the silent-drop defect in
  // the one string whose purpose is to let a user say what they are running.
  const cases: [string, string, RegExp][] = [
    ['not json', 'x{', /is not valid JSON/],
    ['an array', '[]', /does not contain a JSON object/],
    ['null', 'null', /does not contain a JSON object/],
    ['a bare string', '"0.1.0"', /does not contain a JSON object/],
    ['no version field', '{"name":"mycontext"}', /has no "version" field/],
    ['a number', '{"version":1}', /non-string "version" field \(number\)/],
    ['a tag-shaped string', '{"version":"v0.1.0"}', /not MAJOR\.MINOR\.PATCH/],
    ['two components', '{"version":"0.1"}', /not MAJOR\.MINOR\.PATCH/],
    ['a leading zero', '{"version":"01.2.3"}', /not MAJOR\.MINOR\.PATCH/],
    ['trailing prose', '{"version":"0.1.0 (dev)"}', /not MAJOR\.MINOR\.PATCH/],
  ];
  for (const [what, source, expected] of cases) {
    assert.throws(
      () => parseVersion(source, 'probe.json'),
      expected,
      `parseVersion must refuse ${what}`,
    );
  }
  // The converse, or the assertions above would pass on a function that throws
  // unconditionally.
  assert.equal(parseVersion('{"version":"1.2.3"}', 'probe.json'), '1.2.3');
  assert.equal(parseVersion('{"version":"0.1.0-rc.1"}', 'probe.json'), '0.1.0-rc.1');
});

// ---------------------------------------------------------------------------
// CHANGELOG — the step a version-agreement test cannot see
// ---------------------------------------------------------------------------

const changelog = read('CHANGELOG.md');

/** `## [1.2.3] - 2026-08-15` — a released section. */
const RELEASED = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\] - (\d{4}-\d{2}-\d{2})$/gm;
/** `## [Unreleased] — 0.1.0 when tagged` — a version in preparation. */
const PREPARING = /^## \[Unreleased\] — (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?) when tagged$/m;

test('CHANGELOG.md is a Keep a Changelog document', () => {
  assert.match(changelog, /^# Changelog$/m);
  assert.match(
    changelog, /keepachangelog\.com/,
    'the format must name itself, so an editor knows which conventions apply',
  );
  assert.match(
    changelog, /^## \[Unreleased\]/m,
    'there must always be an Unreleased section for the next change to land in',
  );
  // The section vocabulary is fixed by the format; a typo'd heading silently
  // files a security fix under nothing.
  const KNOWN = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
  const used = [...changelog.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.ok(used.length > 0, 'no ### sections found — the parser or the document is broken');
  for (const heading of used) {
    assert.ok(
      KNOWN.includes(heading),
      `"### ${heading}" is not a Keep a Changelog section. Use one of: ${KNOWN.join(', ')}`,
    );
  }
});

/**
 * Step 1 of the release checklist, enforced.
 *
 * Bumping `package.json` and the two manifests together satisfies every
 * assertion above while leaving the changelog describing the previous version —
 * so the version in the owning manifest must be *accounted for* by the
 * changelog, either as a dated release section or as the version the Unreleased
 * section declares it is being prepared as.
 */
test('CHANGELOG.md accounts for the version package.json declares', () => {
  RELEASED.lastIndex = 0;
  const released = [...changelog.matchAll(RELEASED)].map((m) => m[1]);
  const preparing = PREPARING.exec(changelog)?.[1];

  assert.ok(
    released.length > 0 || preparing !== undefined,
    'CHANGELOG.md names no version at all — neither a `## [X.Y.Z] - YYYY-MM-DD` release ' +
    'section nor a `## [Unreleased] — X.Y.Z when tagged` declaration. This assertion would ' +
    'otherwise be checking nothing.',
  );

  assert.ok(
    released.includes(pkg.version) || preparing === pkg.version,
    `package.json says ${pkg.version}, and CHANGELOG.md has neither a ` +
    `\`## [${pkg.version}] - YYYY-MM-DD\` section nor a ` +
    `\`## [Unreleased] — ${pkg.version} when tagged\` line. Released versions in the ` +
    `changelog: ${released.length ? released.join(', ') : '(none)'}; preparing: ` +
    `${preparing ?? '(nothing declared)'}. See step 1 of the checklist in VERSIONING.md.`,
  );

  // A version cannot be both released and still in preparation.
  if (preparing !== undefined) {
    assert.ok(
      !released.includes(preparing),
      `CHANGELOG.md declares it is preparing ${preparing} while also carrying a released ` +
      `section for it`,
    );
  }
});

test('VERSIONING.md names the owning file and the release steps it is cited for', () => {
  const doc = read('VERSIONING.md');
  assert.match(doc, /`package\.json` owns it/i, 'the owner must be stated, not implied');
  assert.match(doc, /scripts\/set-version\.ts/);
  assert.match(doc, /npm run gen:docs/);
  assert.match(doc, /git tag v/);
  // The product-specific decision this document exists for.
  assert.match(doc, /### MAJOR/);
  assert.match(doc, /moved between tiers/i, 'retiering a category is the non-obvious MAJOR case');
});
