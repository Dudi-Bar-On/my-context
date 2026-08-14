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
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../src/core/config.ts';
import { generateCommands } from '../src/plugin/commands.ts';

/** Hand-written, not generated — see `generateCommands`' doc comment. */
const KEEP = new Set(['LoadMyContext.md']);

const dir = path.join(import.meta.dirname, '..', 'commands');
mkdirSync(dir, { recursive: true });

const files = generateCommands(resolveConfig({}));
const wanted = new Set(files.map((f) => f.file));

for (const existing of readdirSync(dir)) {
  if (!existing.endsWith('.md') || KEEP.has(existing) || wanted.has(existing)) continue;
  rmSync(path.join(dir, existing));
  console.log(`removed  commands/${existing}`);
}

for (const { file, content } of files) {
  writeFileSync(path.join(dir, file), content, 'utf8');
}
console.log(`wrote ${files.length} command file(s) to commands/`);
