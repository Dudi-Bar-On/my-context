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
