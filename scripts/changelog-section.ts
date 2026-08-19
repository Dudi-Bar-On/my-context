#!/usr/bin/env node
/**
 * Print one version's section of `CHANGELOG.md`.
 *
 * The release notes on GitHub and the changelog in the repository must not be
 * two independently-written descriptions of the same release. `VERSIONING.md`
 * already makes the changelog the place where a `PATCH` that changes what a
 * user sees has to say so in words — *"a version number cannot carry that, so
 * the changelog has to"* — and a release page that paraphrased it would be a
 * second, drifting copy of exactly that sentence.
 *
 * So the changelog is the source and this extracts from it. If the section is
 * missing, this exits non-zero and the release fails loudly rather than
 * publishing a release with empty notes: a tag whose changelog entry was never
 * written is a release nobody can read, and that is worth stopping for.
 *
 * Usage:
 *   node scripts/changelog-section.ts 1.0.2
 *   node scripts/changelog-section.ts v1.0.2     (a leading v is accepted)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

function main(): number {
  const raw = process.argv[2];
  if (raw === undefined || raw === '') {
    process.stderr.write('usage: node scripts/changelog-section.ts <version>\n');
    return 2;
  }
  const version = raw.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    process.stderr.write(
      `my_context: "${raw}" is not a MAJOR.MINOR.PATCH version.\n`,
    );
    return 2;
  }

  const text = readFileSync(path.join(REPO, 'CHANGELOG.md'), 'utf8');
  const lines = text.split(/\r?\n/);

  // `## [1.0.2] - 2026-08-19`. The date is not matched: a section written
  // ahead of the release may carry a placeholder, and refusing it here would
  // block a release for a reason the author cannot see from the error.
  const open = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`);
  const anyHeading = /^## /;

  const start = lines.findIndex((l) => open.test(l));
  if (start === -1) {
    process.stderr.write(
      `my_context: CHANGELOG.md has no "## [${version}]" section.\n` +
      `Step 1 of "Cutting a release" in VERSIONING.md writes it, and it is the ` +
      `step that needs a human judgement — read the entries against the table there.\n`,
    );
    return 1;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (anyHeading.test(lines[i]!)) { end = i; break; }
  }

  const body = lines.slice(start + 1, end).join('\n').trim();
  if (body === '') {
    process.stderr.write(`my_context: the "${version}" section is empty.\n`);
    return 1;
  }

  process.stdout.write(`${body}\n`);
  return 0;
}

process.exit(main());
