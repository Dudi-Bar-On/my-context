#!/usr/bin/env node
/**
 * Regenerates `commands/*.md` from `src/plugin/commands.ts`.
 *
 *   npm run gen:commands
 *
 * The files are committed because Claude Code discovers plugin commands by
 * scanning the directory on disk. `test/plugin/commands.test.ts` fails if the
 * committed files and the generator disagree, so running this is not
 * optional after touching the template or the category table — CI is what
 * notices.
 *
 * Stale files are removed, not left behind: a category that is disabled must
 * lose its command, and a leftover `add-policy.md` would offer the user a
 * capture `resolveCategory` refuses.
 *
 * **`KEEP` IS THE DRIFT GUARD** (`TASK-hooks-task-16-the-slash-commands`).
 * Every file named here is hand-written rather than generated, and a file
 * this generator does not itself want to write but also does not find in
 * `KEEP` is treated as stale and DELETED — the removal loop below cannot
 * otherwise tell "nobody wants this any more" apart from "a person wrote
 * this and the generator has simply never heard of it". Two hand-kept lists
 * of the same set is the drift this project has found repeatedly (see the
 * item), so `test/plugin/commands.test.ts` asserts this set and its own
 * `HAND_WRITTEN` name exactly the same files — the two must move together,
 * or the assertion is what fails, not a user's file.
 */
export const KEEP = new Set(['LoadMyContext.md']);

/**
 * Which of `existing` this generator would delete, given what it wants
 * (`wanted`) and what must never be touched (`keep`) — pulled out as a pure
 * function so the guard can be proven, and disproven, without writing to a
 * real directory. See `test/plugin/commands.test.ts`, "the drift guard
 * actually stops a deletion, proven both ways".
 */
export function filesToRemove(existing: string[], wanted: Set<string>, keep: Set<string>): string[] {
  return existing.filter((f) => f.endsWith('.md') && !keep.has(f) && !wanted.has(f));
}

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveConfig } from '../src/core/config.ts';
import { generateCommands } from '../src/plugin/commands.ts';

// Everything above is safe to IMPORT with no side effect — this is what lets
// `test/plugin/commands.test.ts` read `KEEP` and call `filesToRemove`
// directly. Only running this file (`npm run gen:commands`, or `node
// scripts/gen-commands.ts`) touches disk, exactly the `isMainEntry` gate
// every hook binary in this repository already uses for the same reason.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  const dir = path.join(import.meta.dirname, '..', 'commands');
  mkdirSync(dir, { recursive: true });

  const files = generateCommands(resolveConfig({}));
  const wanted = new Set(files.map((f) => f.file));

  for (const existing of filesToRemove(readdirSync(dir), wanted, KEEP)) {
    rmSync(path.join(dir, existing));
    console.log(`removed  commands/${existing}`);
  }

  for (const { file, content } of files) {
    writeFileSync(path.join(dir, file), content, 'utf8');
  }
  console.log(`wrote ${files.length} command file(s) to commands/`);
}
