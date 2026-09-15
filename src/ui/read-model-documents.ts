/**
 * **The Documentation screen's manifest — `GET /api/doc` and
 * `GET /api/doc/:id`.**
 *
 * Moved out of `read-model.ts` whole, by
 * `TASK-the-largest-file-in-the-repository-is-twenty-independent`. The section
 * banner that opened this run of lines in that file is kept below, verbatim,
 * because it is the argument for the boundary and not a decoration: the file
 * had already drawn the line here in its author's own hand.
 *
 * The tests had drawn it too. `test/ui/doc-endpoint.test.ts` and
 * `test/docs/doc-system.test.ts` import `apiDoc`, `apiDocList`,
 * `buildDocManifest`, `docHeadings`, `DocBody` and `DocListBody` and nothing
 * else from `read-model.ts`; `test/doctor/watched-docs-servable.test.ts` and
 * `test/ui/github-render.test.ts` import `buildDocManifest` alone. Measured
 * before the move: the range referenced nothing declared elsewhere in
 * `read-model.ts` and nothing elsewhere referenced anything declared in it.
 *
 * Every line below is the line that shipped. `read-model.ts` re-exports this
 * module's public names, so `server.ts` and all four tests keep the import
 * they had.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Workspace } from '../core/workspace.ts';
import { isServableDocPath } from '../doctor/checks.ts';
import { badRequest, coverageFiles, unknownParams } from './read-model-base.ts';
import type { JsonResult } from './routes.ts';

/* -------------------------------------------------------------------------- *
 * The Documentation screen's manifest — `GET /api/doc` and `GET /api/doc/:id`
 * (`TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary`,
 * `plan:walk seq:25`; consumed by `docsys/4`, `docsys/5`, `docsys/6`).
 *
 * **The boundary is the WIDE glob over `docs/` and `reports/`, plus
 * `README.md` itself — not `watchedDocs` alone**
 * (`DEC-the-documentation-system-is-hand-built-over-a-wide-glob`, answering
 * the open question `docs/superpowers/specs/2026-09-05-documentation-screen-
 * design.md` §"What settles this design" left for the owner). *"A
 * documentation system that cannot show a report is not one, and most of
 * what this project actually knows is written in reports."* `README.md` is
 * named on top of the glob because it sits at the repository root, outside
 * both `docs/` and `reports/`, and `REQ-the-two-readmes-are-the-base-of-a-
 * documentation-system-that` calls it (with `docs/README.he.md`) "the base
 * of the documentation system rather than two files a screen happens to
 * show".
 *
 * **The manifest IS the allow-list, enforced by construction rather than by
 * validating a string** — the same property `DEC-markdown-is-served-from-a-
 * manifest-rendered-by-one-renderer` ruled for `/api/help/:topic`'s four
 * topics, widened here. `buildDocManifest` walks the real filesystem once,
 * with values IT produced; `apiDoc` below looks a client-supplied `id` up in
 * the Map that walk built and NEVER joins the client string onto `repoRoot`
 * itself. An id naming no entry is a lookup miss, not a path that was
 * resolved and then refused — `../etc/passwd`, an absolute path, and an
 * encoded traversal sequence are all just strings that are not a key.
 *
 * **Extends `listRepoFiles`/`coverageFiles` (`doctor/checks.ts`) rather than
 * writing a second walk** — the ruling's own instruction: *"Extend the
 * machinery that already derives README sections from the running program."*
 * `coverageFiles` already gives a gitignore-aware, symlink-safe (a Dirent
 * representing a symlink is neither `isDirectory()` nor `isFile()`, so
 * `walkFiles` skips it by construction), bounded listing of every file in the
 * repository; this filters that list down to `README.md` and every `.md`
 * under `docs/` or `reports/` rather than re-walking the tree.
 *
 * **No copy, so no staleness to detect.** `docsys/4` asked for a refresh
 * mechanism because its own design copied a document INTO the corpus and
 * then had to disclose when the copy fell behind the source. This design
 * never copies: `apiDoc` reads the file fresh off disk on every request, so
 * the question "is the served copy stale" has no case where the answer is
 * anything but "there is no copy" — a stronger guarantee than a staleness
 * check, and simpler. Recorded here rather than discovered later.
 *
 * **And the copy was not merely unnecessary, it was unavailable** — measured
 * when `docsys/4` came to take it
 * (`LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of`):
 * `README.md` is 435,749 bytes and `docs/README.he.md` 579,601, against
 * `SNAPSHOT_MAX_BYTES`' 262,144, so `readSnapshot` refuses both. What the
 * corpus records of a watched document is therefore WHERE it is, never a copy
 * of it, and `checkWatchedDocsServable` (`doctor/checks.ts`) is what keeps
 * "watched" and "reachable through this manifest" from drifting apart.
 */

/** One ATX heading, in document order. `anchor` is a GitHub-style slug, with
 * `-1`, `-2`, … appended to a repeated slug within the SAME document — the
 * same disambiguation a real Markdown renderer's own anchor scheme uses, so
 * a link written by hand against this document lands where a reader expects. */
export interface DocHeading { ordinal: number; level: number; text: string; anchor: string }

/** One manifest entry — a document a reader can pick, with no markdown body
 * (that is `DocBody`'s addition, served only by `GET /api/doc/:id`). */
export interface DocManifestEntry {
  id: string;
  title: string;
  language: 'en' | 'he';
  /** Whether `hebrewMirrorRelPath(id)` exists on disk. For a document whose
   * own id already names a `.he.md` file, this is trivially `true` — see
   * `hebrewMirrorRelPath`'s own doc for why that is the right answer rather
   * than a degenerate one. */
  hasHebrewMirror: boolean;
  headings: DocHeading[];
}

/** `GET /api/doc/:id`'s body — one manifest entry, plus the markdown itself. */
export interface DocBody extends DocManifestEntry { markdown: string }

/** `GET /api/doc`'s body. `truncated` carries `coverageFiles`' own bound
 * forward: a repository walk that stopped before finishing must say so
 * rather than present a partial list as complete
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). */
export interface DocListBody { documents: DocManifestEntry[]; truncated: boolean }

/**
 * A fenced code block's delimiter, capturing the RUN of backticks and the info
 * string, because both decide whether a fence opens or closes.
 *
 * **It used to capture neither, and that was a defect with a measured cost.**
 * The old spelling was `/^\s*```/` and the reader toggled a boolean on every
 * match, so ANY fence closed the open block — including a shorter one nested
 * inside it. `README.md` quotes a four-backtick block inside a five-backtick
 * one, so the outer block "closed" at the inner fence, the `# Bookstore API
 * PRD` line inside the quotation was indexed as a README section, and the
 * document reported 99 headings where it has 98 — with a wrong ordinal on
 * every heading after that point. Found 2026-09-05 by `test/docs/
 * doc-system.test.ts`, which was committed deliberately red to hold it.
 *
 * CommonMark's rule, and now this one: a fence closes only on a run AT LEAST
 * as long as the one that opened it, carrying NO info string. That is exactly
 * why a nested block cannot close its parent. The leading-space allowance is
 * `{0,3}` rather than `\s*` for the same reason — four spaces is an indented
 * code block, not a fence.
 *
 * The rule is deliberately spelled the same way as `test/helpers/markdown.ts`'s
 * `fenceTracker`, whose own header records that it was wrong once too and that
 * "a second copy of a subtle rule is how the first copy goes quietly wrong".
 * This module cannot import it — that helper is test-only, and this file must
 * stay loadable by the MCP server (see `UI_HELP_TOPICS`'s own docblock) — so
 * the duplication is deliberate and this note is what ties the two together.
 * `screens/docs.js`'s own `FENCE` is the third copy and carries the same bug;
 * it is a client module reaching for `document` and cannot be imported either.
 */
const DOC_FENCE = /^ {0,3}(`{3,})[ \t]*(\S*)/;

/** An ATX heading line, `#` through `######`, requiring the one space
 * CommonMark and `screens/docs.js`'s own `ATX` both require after the
 * hashes. */
const DOC_ATX = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * `text` → a GitHub-style anchor slug: lower-cased, backtick/`*` markers and
 * punctuation stripped, internal whitespace collapsed to a single hyphen.
 * Underscores are KEPT, not stripped as an emphasis marker — GitHub's own
 * slugger does the same, and this repository's headings depend on it:
 * `# my_context` must slug to `my_context`, not `mycontext`. Unicode letters
 * and digits (`\p{L}`, `\p{N}`) are kept rather than only ASCII, so a Hebrew
 * heading slugs to Hebrew rather than to an empty string — this project
 * ships a Hebrew document and an anchor scheme that only worked in English
 * would be exactly the kind of English-first defect this whole system
 * exists to stop shipping.
 */
function slugAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * `markdown` → its ATX headings, in document order, with an ordinal, a
 * level and a deduplicated anchor per heading. A line inside a fenced code
 * block is never read as a heading — measured against `README.md` itself,
 * whose worked example (§3, "quoted verbatim") fences a block containing
 * four literal `###` lines that are prose about headings, not headings of
 * this document.
 */
export function docHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  // The LENGTH of the run that opened the current block, or null outside one —
  // never a boolean. See `DOC_FENCE`: the length is what stops a nested,
  // shorter fence from closing its parent.
  let openFence: number | null = null;
  let ordinal = 0;
  for (const line of markdown.split('\n')) {
    const fence = DOC_FENCE.exec(line);
    if (openFence === null) {
      // An opening fence may carry an info string (```mermaid); a closing one
      // may not, which is why `fence[2]` is only consulted on the way out.
      if (fence !== null) { openFence = fence[1].length; continue; }
    } else {
      if (fence !== null && fence[1].length >= openFence && fence[2] === '') openFence = null;
      // Every line inside a fence is skipped whether or not it closed one: a
      // closing fence is not a heading either.
      continue;
    }
    const match = DOC_ATX.exec(line);
    if (match === null) continue;
    ordinal += 1;
    const text = match[2];
    const base = slugAnchor(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({
      ordinal, level: match[1].length, text, anchor: count === 0 ? base : `${base}-${count}`,
    });
  }
  return headings;
}

/** The document's title: its first level-1 heading, or its filename with the
 * extension dropped when it has none — `docs/2026-09-05-…-report.md`-shaped
 * files under `reports/` routinely open on a `##` rather than a `#`. */
function docTitle(relPath: string, headings: DocHeading[]): string {
  return headings.find((h) => h.level === 1)?.text ?? path.basename(relPath, '.md');
}

/** `'he'` when `relPath`'s own name carries the `.he.md` convention this
 * project already uses (`docs/README.he.md`, `docs/TUTORIAL.he.md` if it
 * existed); `'en'` otherwise. Positional (English is the unmarked case)
 * rather than a third `'en'` suffix, matching the naming convention itself. */
function docLanguage(relPath: string): 'en' | 'he' {
  return relPath.endsWith('.he.md') ? 'he' : 'en';
}

/**
 * The Hebrew counterpart's repo-relative path, by the naming convention this
 * project already uses in two places (`docs/README.he.md` beside
 * `README.md`; `TUTORIAL_TARGETS`' own `heFile` above): the SAME directory,
 * `.md` replaced by `.he.md` — except `README.md` itself, whose mirror is
 * `docs/README.he.md`, a different directory, because the two READMEs are
 * not siblings on disk.
 *
 * **For a document whose OWN id already ends `.he.md`, this returns the id
 * unchanged**, so `hasHebrewMirror` reads `true` for it. That is a
 * deliberate reading, not an accident of the regex: `docsys/6` tracks
 * whether a reader can read THIS document's content in Hebrew, and a
 * document already written in Hebrew answers that trivially yes — never the
 * `false` a naive "does `X.he.he.md` exist" check would report, which would
 * put the "to write" chip on the Hebrew document itself.
 */
function hebrewMirrorRelPath(relPath: string): string {
  if (relPath === 'README.md') return 'docs/README.he.md';
  if (relPath.endsWith('.he.md')) return relPath;
  return relPath.replace(/\.md$/, '.he.md');
}

/** One manifest entry with its absolute path attached — the internal shape
 * `buildDocManifest` returns. `absPath` is stripped before any HTTP response
 * is built (`apiDocList`, `apiDoc`): it is a server-local filesystem detail,
 * never a client-facing fact, and keeping it out of the wire shape is what
 * makes "the id is a Map key, not a path" true of the RESPONSE too. */
interface InternalDocEntry extends DocManifestEntry { absPath: string }

/**
 * Every document the wide glob admits, read fresh off disk. Called once per
 * request rather than cached at server start: `docs/` and `reports/` hold a
 * few hundred files at most (measured: see this task's own report), reading
 * each is the same order of cost `apiTutorials` already pays on two files
 * per request, and a manifest that is rebuilt every time is a manifest that
 * can never itself go stale.
 */
export function buildDocManifest(
  repoRoot: string,
): { entries: InternalDocEntry[]; truncated: boolean } {
  const { files, truncated } = coverageFiles(repoRoot);
  // The wide glob is `isServableDocPath` (`doctor/checks.ts`) and is not
  // restated here: `checkWatchedDocsServable` has to ask the SAME question of
  // the SAME paths — "would a reader be able to open this one" — and two
  // spellings of one boundary is how a document ends up claimed by the corpus
  // and unreachable in the UI without anything failing. See that predicate's
  // own docblock for why it lives on doctor's side of the import arrow.
  const relPaths = files.filter((f) => isServableDocPath(f));

  const entries = relPaths.map((relPath): InternalDocEntry => {
    const absPath = path.join(repoRoot, ...relPath.split('/'));
    let markdown: string;
    try {
      markdown = readFileSync(absPath, 'utf8').replaceAll('\r\n', '\n');
    } catch {
      // Listed by the walk a moment ago and gone (or unreadable) now — a race
      // with a concurrent delete, not this endpoint's failure to report. An
      // entry with no headings and no title beyond its filename is what a
      // reader sees; `apiDoc` hits the same `readFileSync` and answers its
      // own refusal if this id is opened.
      markdown = '';
    }
    const headings = docHeadings(markdown);
    const mirrorAbs = path.join(repoRoot, ...hebrewMirrorRelPath(relPath).split('/'));
    let hasHebrewMirror = false;
    try {
      hasHebrewMirror = statSync(mirrorAbs).isFile();
    } catch {
      hasHebrewMirror = false;
    }
    return {
      id: relPath,
      title: docTitle(relPath, headings),
      language: docLanguage(relPath),
      hasHebrewMirror,
      headings,
      absPath,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  return { entries, truncated };
}

/**
 * `GET /api/doc` — the manifest, with no markdown body. The document picker
 * `docsys/5` builds is drawn from this list; `GET /api/doc/:id` below is
 * where its markdown is actually fetched, once a reader has picked one.
 */
export function apiDocList(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const projectRoot = ws.projectRoot;
  if (projectRoot === null) {
    const body: DocListBody = { documents: [], truncated: false };
    return { status: 200, body };
  }
  const repoRoot = path.dirname(projectRoot);
  const { entries, truncated } = buildDocManifest(repoRoot);
  const body: DocListBody = {
    documents: entries.map(({ absPath: _absPath, ...entry }) => entry),
    truncated,
  };
  return { status: 200, body };
}

/**
 * `GET /api/doc/:id` — one document's markdown, its heading index and
 * whether it has a Hebrew mirror. `id` is looked up in the SAME manifest
 * `apiDocList` serves; see this section's header for why that lookup is the
 * whole security argument. A refusal NAMES what was refused and how many
 * documents the manifest actually holds, the shape every other refusal on
 * this server takes (`apiHelp`'s unreachable-topic 404 is the closest
 * precedent).
 */
export function apiDoc(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const notFound = (count: number): JsonResult => ({
    status: 404,
    body: {
      error: `no document "${params.id}" — ${count} document(s) in the manifest; list them ` +
        'at GET /api/doc. Nothing outside the manifest is ever read: the id is looked up as a ' +
        'key, never joined onto a path.',
    },
  });
  const projectRoot = ws.projectRoot;
  if (projectRoot === null) return notFound(0);
  const repoRoot = path.dirname(projectRoot);
  const { entries } = buildDocManifest(repoRoot);
  const found = entries.find((entry) => entry.id === params.id);
  if (found === undefined) return notFound(entries.length);
  let markdown: string;
  try {
    markdown = readFileSync(found.absPath, 'utf8').replaceAll('\r\n', '\n');
  } catch (err) {
    return {
      status: 404,
      body: {
        error: `"${params.id}" is in the manifest but its file could not be read: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  const { absPath: _absPath, ...rest } = found;
  const body: DocBody = { ...rest, markdown };
  return { status: 200, body };
}
