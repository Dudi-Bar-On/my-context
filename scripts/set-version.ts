#!/usr/bin/env node
/**
 * Writes one version into every file that declares one.
 *
 *   node scripts/set-version.ts 0.2.0
 *
 * `package.json` owns the version (`VERSIONING.md`); the other two manifests
 * repeat it because Claude Code and `claude plugin install` read those and
 * cannot read `package.json`. `test/release.test.ts` fails when they disagree,
 * so this script exists to make the *right* thing a single command — the test
 * is what makes the wrong thing loud, not what makes it unnecessary.
 *
 * Four sites, and three of them are easy to miss: `marketplace.json` carries
 * the version BOTH at its top level and on its `plugins[0]` entry, and
 * `claude plugin tag` refuses a release where those two disagree.
 *
 * Deliberately a surgical text substitution rather than
 * `JSON.parse` → mutate → `JSON.stringify`: a round-trip through
 * `JSON.stringify` reformats files a human maintains, and this script is not
 * the place to argue about indentation. Every replacement is verified after
 * writing, so a manifest whose shape changed is reported rather than silently
 * left at its old version.
 *
 * It does NOT edit CHANGELOG.md, regenerate documentation or create a tag.
 * Those are steps 1, 3 and 5 of the release checklist in `VERSIONING.md`, each
 * of which requires a judgement no script has.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';
import { isSemver, parseVersion } from '../src/core/version.ts';

export const ROOT = path.join(import.meta.dirname, '..');

export interface VersionSite {
  /** Repository-relative path. */
  file: string;
  /** Matches exactly this declaration, and nothing else in the file. */
  pattern: RegExp;
  /** How many times `pattern` must match `file`. */
  count: number;
  /** Why this copy of the number exists — printed, and read by a human on failure. */
  what: string;
}

/**
 * One version declaration: the file it lives in, and the pattern that finds
 * exactly it.
 *
 * Each pattern is anchored to enough surrounding structure to be unique within
 * its file — `marketplace.json`'s two sites are told apart by indentation,
 * which is why `count` is asserted below rather than assumed.
 *
 * Exported so `test/release.test.ts` can check the list against the manifests
 * themselves: a version declaration that exists in a file and is not listed
 * here would be silently left at its old value by every release, which is
 * exactly the drift this script exists to prevent.
 */
export const VERSION_SITES: VersionSite[] = [
  {
    file: 'package.json',
    pattern: /^(  "version": ")[^"]+(",)$/m,
    count: 1,
    what: 'the owning declaration',
  },
  {
    file: path.join('.claude-plugin', 'plugin.json'),
    pattern: /^(  "version": ")[^"]+(",)$/m,
    count: 1,
    what: 'what Claude Code reports for the installed plugin',
  },
  {
    file: path.join('.claude-plugin', 'marketplace.json'),
    pattern: /^(  "version": ")[^"]+(",)$/m,
    count: 1,
    what: 'the marketplace manifest',
  },
  {
    file: path.join('.claude-plugin', 'marketplace.json'),
    pattern: /^(      "version": ")[^"]+(",)$/m,
    count: 1,
    what: 'the marketplace ENTRY — `claude plugin tag` refuses a drift from the line above',
  },
];

function fail(message: string): never {
  console.error(`my_context: ${message}`);
  process.exit(1);
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const [, , requested] = process.argv;
  if (requested === undefined) {
    fail('usage: node scripts/set-version.ts <MAJOR.MINOR.PATCH>');
  }
  if (!isSemver(requested)) {
    fail(`"${requested}" is not MAJOR.MINOR.PATCH — see VERSIONING.md`);
  }

  const before = parseVersion(
    readFileSync(path.join(ROOT, 'package.json'), 'utf8'), 'package.json',
  );

  // Every site is checked BEFORE any file is written. A validate-as-you-go
  // loop that fails on the third site has already written the first two, which
  // leaves the repository in the half-bumped state `test/release.test.ts`
  // exists to catch — a release tool must not be able to create the failure it
  // is meant to prevent.
  const planned: { absolute: string; site: VersionSite }[] = [];
  for (const site of VERSION_SITES) {
    const absolute = path.join(ROOT, site.file);
    const source = readFileSync(absolute, 'utf8');
    const matches = source.match(new RegExp(site.pattern.source, 'gm')) ?? [];
    if (matches.length !== site.count) {
      fail(
        `${site.file}: expected ${site.count} version declaration(s) for ${site.what}, found ` +
        `${matches.length}. The manifest's shape changed; update scripts/set-version.ts before ` +
        `releasing, or the version will be written to the wrong place. Nothing was written.`,
      );
    }
    planned.push({ absolute, site });
  }

  // Re-read inside the write loop rather than reusing the copy above: two sites
  // share `marketplace.json`, so the second rewrite must start from the first
  // one's output or it silently reverts it.
  for (const { absolute, site } of planned) {
    const source = readFileSync(absolute, 'utf8');
    writeFileSync(absolute, source.replace(site.pattern, `$1${requested}$2`), 'utf8');
    console.log(`${site.file}: ${before} -> ${requested}  (${site.what})`);
  }

  console.log('');
  console.log(`Version is now ${requested}. Still to do, in order (VERSIONING.md):`);
  console.log(`  1. CHANGELOG.md — close "## [Unreleased]" as "## [${requested}] - <YYYY-MM-DD>"`);
  console.log('  2. npm run gen:docs   (the documented `status` examples print the version)');
  console.log('  3. npm test && npx tsc --noEmit && claude plugin validate --strict .');
  console.log(`  4. commit, then: git tag v${requested}`);
}
