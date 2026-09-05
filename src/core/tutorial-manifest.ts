/**
 * The tutorial manifest — the checked-in, derived roster of "one tutorial per
 * FEATURE of my_context" that `docs/tutorials/manifest.json` holds.
 *
 * This module is the READ half only: `loadTutorialManifest` parses and
 * validates the checked-in file. The DERIVATION — clustering
 * `src/cli/commands/*.ts`, `src/ui/public/screens/*.js`, `commands/*.md` and
 * `src/core/categories.ts`'s `CATEGORIES` into features — lives in
 * `scripts/build-tutorial-manifest.ts`, run by hand (`npm run gen:tutorials`)
 * whenever a surface changes. `test/core/tutorial-manifest.test.ts` is what
 * notices when the two disagree: it globs the four surfaces itself and fails,
 * naming the file, when something the manifest was supposed to cover is
 * claimed twice or not at all.
 *
 * `TASK-the-tutorial-manifest-and-the-surface-globs-it-derives-from`
 * (`plan:tuts seq:1`).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type TutorialTier = 'basic' | 'advanced';

export interface TutorialManifestEntry {
  /** Stable, kebab-case. Never renamed once shipped — it is the doc route's key. */
  id: string;
  /** A job a reader is trying to do, not a feature name — R2. */
  title: string;
  tier: TutorialTier;
  /** `src/cli/commands/*.ts` filenames this tutorial claims. May be empty. */
  cli: string[];
  /** `commands/*.md` filenames this tutorial claims. May be empty. */
  slash: string[];
  /** `src/ui/public/screens/*.js` filenames this tutorial claims. May be empty. */
  screens: string[];
  /** `CATEGORIES` keys this tutorial claims. Empty for every entry but one. */
  categories: string[];
  /** Repo-relative path to the English markdown file. */
  enFile: string;
  /** Repo-relative path to the Hebrew markdown file. */
  heFile: string;
}

/** Where the checked-in manifest lives, repo-relative. */
export const TUTORIAL_MANIFEST_PATH = 'docs/tutorials/manifest.json';

const REQUIRED_STRING_ARRAYS = ['cli', 'slash', 'screens', 'categories'] as const;

/**
 * One entry's shape, checked field by field so a malformed manifest fails
 * with a sentence naming what is wrong, not a generic JSON-parse error three
 * layers removed from the file that caused it.
 */
function validateEntry(raw: unknown, index: number): TutorialManifestEntry {
  const where = `docs/tutorials/manifest.json[${index}]`;
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`${where}: expected an object`);
  }
  const e = raw as Record<string, unknown>;
  if (typeof e['id'] !== 'string' || e['id'] === '') {
    throw new Error(`${where}: "id" must be a non-empty string`);
  }
  if (typeof e['title'] !== 'string' || e['title'] === '') {
    throw new Error(`${where.replace('[' + index + ']', `["${e['id']}"]`)}: "title" must be a non-empty string`);
  }
  if (e['tier'] !== 'basic' && e['tier'] !== 'advanced') {
    throw new Error(`docs/tutorials/manifest.json["${e['id']}"]: "tier" must be "basic" or "advanced", got ${JSON.stringify(e['tier'])}`);
  }
  for (const key of REQUIRED_STRING_ARRAYS) {
    const v = e[key];
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
      throw new Error(`docs/tutorials/manifest.json["${e['id']}"]: "${key}" must be a string array`);
    }
  }
  if (typeof e['enFile'] !== 'string' || e['enFile'] === '') {
    throw new Error(`docs/tutorials/manifest.json["${e['id']}"]: "enFile" must be a non-empty string`);
  }
  if (typeof e['heFile'] !== 'string' || e['heFile'] === '') {
    throw new Error(`docs/tutorials/manifest.json["${e['id']}"]: "heFile" must be a non-empty string`);
  }
  return {
    id: e['id'],
    title: e['title'] as string,
    tier: e['tier'],
    cli: e['cli'] as string[],
    slash: e['slash'] as string[],
    screens: e['screens'] as string[],
    categories: e['categories'] as string[],
    enFile: e['enFile'] as string,
    heFile: e['heFile'] as string,
  };
}

/**
 * Read and validate `docs/tutorials/manifest.json` under `repoRoot`.
 *
 * Throws — never returns a guessed or partial roster — when the file is
 * missing, is not valid JSON, is not an array, or any entry fails shape
 * validation. Callers that must answer 200 regardless (the UI's read routes)
 * catch this at the route boundary, the same "unknown, never invented"
 * pattern `apiTutorials` already applies to a missing project root.
 */
export function loadTutorialManifest(repoRoot: string): TutorialManifestEntry[] {
  const file = path.join(repoRoot, TUTORIAL_MANIFEST_PATH);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`${TUTORIAL_MANIFEST_PATH}: not found under ${repoRoot} — run \`npm run gen:tutorials\``);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${TUTORIAL_MANIFEST_PATH}: not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${TUTORIAL_MANIFEST_PATH}: expected a top-level array`);
  }
  const entries = parsed.map((raw, i) => validateEntry(raw, i));
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`${TUTORIAL_MANIFEST_PATH}: duplicate tutorial id "${e.id}"`);
    ids.add(e.id);
  }
  return entries;
}
