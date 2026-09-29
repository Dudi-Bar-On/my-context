/**
 * **The Tutorials screen's two reads — `GET /api/tutorials` and
 * `GET /api/tutorials/:id`.**
 *
 * Moved out of `read-model.ts` whole, by
 * `TASK-the-largest-file-in-the-repository-is-twenty-independent`. The
 * boundary is not a new one: this is the contiguous run of lines that file
 * already held between `apiHelp`'s closing brace and its own
 * `The Documentation screen's manifest` banner, and the two test files that
 * cover it — `test/ui/tutorials-endpoint.test.ts` and
 * `test/ui/tutorial-doc.test.ts` — already name exactly these handlers and
 * nothing else. Measured before the move: the range referenced NOTHING
 * declared elsewhere in `read-model.ts`, and nothing elsewhere in
 * `read-model.ts` referenced anything declared in it.
 *
 * Every line below is the line that shipped. `read-model.ts` re-exports this
 * module's public names, so `server.ts` and both tests keep the import they
 * had.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  loadTutorialManifest, type TutorialManifestEntry, type TutorialTier,
} from '../core/tutorial-manifest.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams } from './read-model-base.ts';
import type { JsonResult } from './routes.ts';

/**
 * `GET /api/tutorials`'s body — one row per entry in
 * `docs/tutorials/manifest.json` (`loadTutorialManifest`,
 * `TASK-the-tutorial-manifest-and-the-surface-globs-it-derives-from`,
 * `plan:tuts seq:1`), widened from the twelve hard-coded EN/HE cells this
 * endpoint used to answer over six literal rows
 * (`TASK-get-api-tutorials-reads-the-manifest-and-adds-a-hebrew`,
 * `plan:tuts seq:2`).
 *
 * **Existence, not correctness — carried forward unchanged.** `done` means
 * the tutorial file exists and carries all four required section headings
 * (`TUTORIAL_REQUIRED_HEADINGS` below, the four-part shape
 * `REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials` names: what
 * it is for, how it works, from the CLI, from the UI); `todo` means the file
 * exists but is missing at least one; `unmeasured` means the file itself does
 * not exist yet, so there is nothing to check FOR.
 *
 * **`heRollup` is the measured zero, drawn rather than hidden**
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). Today
 * zero per-feature tutorial files exist at all, so every row's `en` reads
 * `unmeasured` and `heRollup` reads `{ done: 0, total: 0 }` — a stated fact,
 * not an absence a reader has to notice by counting `unmeasured` chips
 * themselves. `total` counts only rows whose `en` is NOT `unmeasured`: a row
 * cannot need a Hebrew translation of an English tutorial that does not exist
 * yet, the same reasoning `tutorialRowState`'s Hebrew column used to apply
 * per-row, now rolled up.
 */
export type TutorialCellState = 'done' | 'todo' | 'unmeasured';

/** One tutorial's list row: its manifest identity plus its EN/HE state. */
export interface TutorialListRow {
  id: string;
  /** A job, not a feature name — R2. */
  title: string;
  tier: TutorialTier;
  en: TutorialCellState;
  he: TutorialCellState;
}

export interface TutorialsBody {
  tutorials: TutorialListRow[];
  /**
   * **`null` when no manifest was read, and that is why it is nullable rather
   * than a pair of zeroes beside a flag.**
   *
   * `TASK-nine-sites-report-a-measured-zero-for-something-they-could` (M7 of
   * report 3) found this field answering `{ done: 0, total: 0 }` over a
   * `docs/tutorials/manifest.json` that would not parse — a translation-debt
   * MEASUREMENT taken over a file nothing had read, which the screen then drew
   * as "0 of 0 translated" beside an empty roster. That reads as *this project
   * has no tutorials*, which is the one thing it does not mean.
   *
   * The item's recommendation is to MAKE THE ZERO UNREPRESENTABLE rather than
   * merely discouraged, and the template it names is `context-occupancy.ts`'s
   * missing `percent` field: a caller cannot print a rollup it was not given,
   * so there is no path by which the unmeasured case draws as a measured one.
   * `{ done: 0, total: 0 }` stays a legal and truthful answer for a manifest
   * that WAS read and holds nothing to count.
   */
  heRollup: { done: number; total: number } | null;
  /**
   * Why no manifest was read, or `null` when one was. Never absent and never
   * `''`, so a reader can tell "measured" from "this build does not say" —
   * the distinction `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
   * thing-is` turns on.
   *
   * It carries the underlying reason verbatim rather than a summary, the same
   * shape `read-model-config.ts` serves `parseError`/`resolveError` in one
   * directory over: the reader with a broken manifest needs the parser's own
   * complaint, and `INV-nothing-is-dropped-silently` is what the old bare
   * `catch` broke by keeping it.
   */
  unmeasured: string | null;
}

/**
 * The four headings every tutorial's four-part shape requires
 * (`REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials`: "what it
 * is for", "how it works", "from the CLI", "from the UI"). A gate can check
 * for their PRESENCE, never for whether the prose under them is correct —
 * the same distinction `apiTutorials`'s own header has carried since the
 * first version of this endpoint.
 */
export const TUTORIAL_REQUIRED_HEADINGS = [
  '## What it is for',
  '## How it works',
  '## From the CLI',
  '## From the UI',
];

/** `true` when `file` (repo-relative) exists and its text contains `needle`. */
function repoFileContains(repoRoot: string, file: string, needle: string): boolean {
  try {
    return readFileSync(path.join(repoRoot, file), 'utf8').includes(needle);
  } catch {
    return false;
  }
}

/** `true` when `file` (repo-relative) exists at all. */
function repoFileExists(repoRoot: string, file: string): boolean {
  try {
    readFileSync(path.join(repoRoot, file), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** One file's state: `unmeasured` (absent), `done` (present, all four
 * required headings found) or `todo` (present, at least one missing). */
function tutorialFileState(repoRoot: string, file: string): TutorialCellState {
  if (!repoFileExists(repoRoot, file)) return 'unmeasured';
  return TUTORIAL_REQUIRED_HEADINGS.every((h) => repoFileContains(repoRoot, file, h)) ? 'done' : 'todo';
}

/**
 * One manifest entry's row, and the three-way distinction the Hebrew column
 * has to make.
 *
 * `unmeasured` and `todo` are different claims and the difference is the whole
 * point of the column — `LESSON-on-real-data-an-absent-feature-and-a-missing-
 * feature-look` is the same argument one screen over. Read as:
 *
 *   en unmeasured  -> he unmeasured. Nobody has written the English yet, so
 *                     there is no translation to be behind on. Guessing `todo`
 *                     here would invent a debt nobody has incurred.
 *   en measured,   -> he TODO. The manifest names a Hebrew file, the English
 *   he file absent    exists, and the Hebrew does not: that is a known, owed
 *                     gap, not an unknown. This is the case that was wrong.
 *   he file present -> `done` or `todo` on the four required headings, same
 *                     rule as English.
 *
 * **It used to read `unmeasured` for the middle case**, because it delegated
 * to `tutorialFileState`, whose `unmeasured` means only "the file is absent"
 * and cannot know whether absence was expected. Eighteen of twenty-four rows
 * therefore claimed the Hebrew was unmeasured when it was simply unwritten and
 * known to be. The rollup headline was honest throughout — it counts
 * `he === 'done'` against measured English — so the number said 6 of 24 while
 * the chips beside it said nobody had looked. Found 2026-09-05, reported by
 * the lane that wrote the Hebrew files and could see its own work uncounted.
 */
function tutorialListRow(repoRoot: string, entry: TutorialManifestEntry): TutorialListRow {
  const en = tutorialFileState(repoRoot, entry.enFile);
  const base = { id: entry.id, title: entry.title, tier: entry.tier };
  if (en === 'unmeasured') return { ...base, en, he: 'unmeasured' };
  // `repoFileExists` rather than `tutorialFileState`'s own absent branch: the
  // two answer different questions, and only here is absence a debt.
  const he: TutorialCellState = repoFileExists(repoRoot, entry.heFile)
    ? tutorialFileState(repoRoot, entry.heFile)
    : 'todo';
  return { ...base, en, he };
}

/**
 * `GET /api/tutorials` — one row per manifest entry, plus the Hebrew rollup.
 * Reads no item, no ledger and no config: the checked-in manifest, and per
 * row, whether its EN and HE files exist and carry the four required
 * headings.
 *
 * **No project, no manifest to read.** Answers an empty list rather than a
 * guessed one when `ws.projectRoot` is `null` — the same "unknown, never
 * invented" reasoning `apiDocList` already applies to its own manifest — and
 * the same answer when the checked-in manifest itself cannot be parsed: a
 * malformed `docs/tutorials/manifest.json` is a real defect, but it is this
 * project's OWN defect to fix, not a reason to fail every other row this
 * screen would otherwise draw correctly. Either way this endpoint answers 200
 * instead of throwing, because it needs no open index to say so.
 *
 * **The 200 was always right; the ZEROES beside it were not.** Both of those
 * paths used to answer `heRollup: { done: 0, total: 0 }` and swallow the
 * reason — `TASK-nine-sites-report-a-measured-zero-for-something-they-could`,
 * site M7. A rollup is a count of files this endpoint looked at, so over a
 * manifest it never read there is no count to report, only a reason; and the
 * reason was the one thing the `catch` discarded
 * (`INV-nothing-is-dropped-silently`). Both now answer `heRollup: null` with
 * `unmeasured` carrying the parser's own words, so the screen draws a refusal
 * where it used to draw a clean bill of health over nothing.
 */
export function apiTutorials(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  /** No roster, no rollup, and the reason in place of both. */
  const unmeasured = (why: string): JsonResult => ({
    status: 200,
    body: { tutorials: [], heRollup: null, unmeasured: why } satisfies TutorialsBody,
  });
  const projectRoot = ws.projectRoot;
  if (projectRoot === null) {
    return unmeasured(
      'no project is open here, so docs/tutorials/manifest.json was never looked for — the ' +
      'tutorial roster below is UNMEASURED, not empty, and no translation debt was counted.',
    );
  }
  const repoRoot = path.dirname(projectRoot);
  let manifest: TutorialManifestEntry[];
  try {
    manifest = loadTutorialManifest(repoRoot);
  } catch (err) {
    return unmeasured(
      'docs/tutorials/manifest.json could not be read, so no tutorial was measured — the roster ' +
      'below is UNMEASURED, not empty, and the Hebrew rollup is unknown rather than zero: ' +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const tutorials = manifest.map((entry) => tutorialListRow(repoRoot, entry));
  const heRollup = {
    done: tutorials.filter((t) => t.he === 'done').length,
    total: tutorials.filter((t) => t.en !== 'unmeasured').length,
  };
  const body: TutorialsBody = { tutorials, heRollup, unmeasured: null };
  return { status: 200, body };
}

/**
 * `GET /api/tutorials/:id` — one tutorial's markdown, served by manifest id.
 * `TASK-get-api-doc-colon-id-serves-one-tutorial-by-manifest-id`
 * (`plan:tuts seq:3`).
 *
 * **Not registered at `GET /api/doc/:id`, despite that task's own title.**
 * That path already answers a WIDER, already-shipped manifest — `apiDoc`
 * above, the `docs/`- and `reports/`-wide walk `DEC-markdown-is-served-from-
 * a-manifest-rendered-by-one-renderer` also governs, keyed by repo-relative
 * PATH rather than by a feature id and carrying no `lang` query param at all
 * (a Hebrew document is a second, separate manifest entry there). Registering
 * a second handler at the same path throws at server start
 * (`routes.ts`'s own collision guard) rather than shadowing one silently, so
 * this endpoint is nested under the list it belongs beside instead:
 * `GET /api/tutorials` lists, `GET /api/tutorials/:id` reads one. The two
 * doc systems are expected to converge on one manifest builder eventually,
 * exactly as the design of record says of `walk/25` and this task — they do
 * not converge inside this task, which does not touch `apiDoc`.
 *
 * **The same closed-set argument, applied to a different id space.** `id` is
 * looked up as an exact key against `loadTutorialManifest`'s own entries;
 * nothing here ever calls `path.join` with a client-supplied string. A `../`
 * id, an absolute-path id, or any string not naming a manifest entry is all
 * the same case to this handler: a lookup miss, answered by naming what IS
 * served (the tutorial count and where to list them) rather than by
 * resolving the string as a path and refusing what that resolved to.
 *
 * **`lang=he` never falls back to English.** An id whose Hebrew file does not
 * exist on disk yet is refused by name, the same "no toggle that falls back"
 * rule `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`'s
 * sibling instruction states for this exact screen — never a silent serve of
 * the English markdown under a Hebrew label.
 *
 * **Bounded, like every other read route here.** `TUTORIAL_DOC_MAX_CHARS`
 * caps the markdown this endpoint returns; `truncated` says so rather than
 * silently cutting a reader off mid-document
 * (`INV-nothing-is-dropped-silently`, the same disclosure `coverageFiles` and
 * `CoveragePage` already carry for the repository walk).
 */
export interface TutorialDocBody {
  markdown: string;
  title: string;
  tier: TutorialTier;
  lang: 'en' | 'he';
  /** The bound (`TUTORIAL_DOC_MAX_CHARS`) was reached; `markdown` was cut there. */
  truncated: boolean;
}

/** Far larger than any tutorial this project has ever shipped — a defensive
 * bound, not a working limit, so `truncated` is expected to read `false`
 * always in practice and to say so plainly the day it does not. */
export const TUTORIAL_DOC_MAX_CHARS = 200_000;

export function apiTutorialDoc(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, ['lang']);
  if (bad) return badRequest(bad);
  const langParam = url.searchParams.get('lang') ?? 'en';
  if (langParam !== 'en' && langParam !== 'he') {
    return badRequest(`lang must be "en" or "he" — got "${langParam}"`);
  }
  const lang = langParam;

  const notFound = (message: string): JsonResult => ({ status: 404, body: { error: message } });

  const projectRoot = ws.projectRoot;
  if (projectRoot === null) {
    return notFound(`no tutorial "${params.id}" — this workspace has no project open, so no ` +
      'tutorial manifest could be read.');
  }
  const repoRoot = path.dirname(projectRoot);
  let manifest: TutorialManifestEntry[];
  try {
    manifest = loadTutorialManifest(repoRoot);
  } catch (err) {
    return notFound(`the tutorial manifest could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  const entry = manifest.find((e) => e.id === params.id);
  if (entry === undefined) {
    return notFound(`no tutorial "${params.id}" — ${manifest.length} tutorial(s) in the manifest; ` +
      'list them at GET /api/tutorials. The id is looked up as a key, never joined onto a path.');
  }
  const file = lang === 'en' ? entry.enFile : entry.heFile;
  if (!repoFileExists(repoRoot, file)) {
    return notFound(lang === 'he'
      ? `tutorial "${entry.id}" has no Hebrew file yet (${file} does not exist) — read it with ` +
        'lang=en. Never a silent fallback to English.'
      : `tutorial "${entry.id}"'s English file does not exist yet (${file}).`);
  }
  let markdown: string;
  try {
    markdown = readFileSync(path.join(repoRoot, file), 'utf8').replaceAll('\r\n', '\n');
  } catch (err) {
    return notFound(`"${entry.id}" (${lang}) is in the manifest but its file could not be read: ` +
      `${err instanceof Error ? err.message : String(err)}`);
  }
  const truncated = markdown.length > TUTORIAL_DOC_MAX_CHARS;
  const body: TutorialDocBody = {
    markdown: truncated ? markdown.slice(0, TUTORIAL_DOC_MAX_CHARS) : markdown,
    title: entry.title,
    tier: entry.tier,
    lang,
    truncated,
  };
  return { status: 200, body };
}
