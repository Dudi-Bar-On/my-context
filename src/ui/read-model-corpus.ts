/**
 * **The corpus file browser — `GET /api/corpus` and `GET /api/corpus/:id`.**
 *
 * Moved out of `read-model.ts` whole, by
 * `TASK-the-largest-file-in-the-repository-is-twenty-independent`. The
 * `THE CORPUS FILE BROWSER` banner that opened this run of lines is kept
 * below, verbatim: it carries the owner requirement and the boundary ruling
 * these two handlers exist under, and it is also the evidence that the file
 * already drew the line exactly here.
 *
 * `test/ui/corpus-files.test.ts` imports `apiCorpusList` and `apiCorpusFile`
 * and nothing else from `read-model.ts`. Measured before the move: the range
 * referenced nothing declared elsewhere in `read-model.ts` and nothing
 * elsewhere referenced anything declared in it.
 *
 * Every line below is the line that shipped. `read-model.ts` re-exports this
 * module's public names, so `server.ts` and that test keep the import they had.
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { splitFrontmatter } from '../core/item.ts';
import type { Workspace } from '../core/workspace.ts';
import { corpusRootOf, isCorpusFilePath } from '../doctor/checks.ts';
import { badRequest, unknownParams, withStores } from './read-model-base.ts';
import type { JsonResult } from './routes.ts';

/* ══ THE CORPUS FILE BROWSER ═══════════════════════════════════════════════
 *
 * `TASK-the-library-browses-the-corpus-files-and-a-file-opens`, owner
 * requirement 2026-09-06, and the boundary ruling of the same day recorded as
 * `DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than`.
 *
 * ── THE QUESTION THESE TWO ROUTES ANSWER, AND THE ONE THEY DO NOT ─────────
 *
 * **"What is actually written in that file."** `/api/item/:id` already answers
 * a different question — what the INDEX holds about an item, which is the
 * shape `aside#pane` draws: summary, scope, tier, body, provenance, injection
 * and usage, every field already parsed and every projection already applied.
 * These two routes answer the question the index cannot: the Markdown on disk,
 * frontmatter and all, as a person wrote it. Two artefacts, two questions; a
 * reader comparing what an item SAYS with what its file CONTAINS is the case
 * neither one alone can serve.
 *
 * ── WHY THIS IS A SECOND ROUTE AND NOT A WIDER `/api/doc` ────────────────
 *
 * The owner ruled the corpus reachable on 2026-09-06. The shape is a separate
 * route, and three measurements rather than a preference decided it:
 *
 *   1. **Widening `isServableDocPath` would have served nothing.**
 *      `buildDocManifest` sources its paths from `coverageFiles` ->
 *      `listRepoFiles`, which drops every path with a `.my_context` segment
 *      (`SKIP_DIRS`, deliberately, since 2026-09-04). The predicate would have
 *      been asked about no corpus path, ever, and the feature would have
 *      shipped serving nothing while looking done.
 *   2. **The roster is keyed differently.** A document id is a REPOSITORY-
 *      relative path; a corpus file id is WORKSPACE-relative. One manifest
 *      holding both would carry two rootings under one key space, which is the
 *      kind of ambiguity that only ever shows up as the wrong file.
 *   3. **The cost is not the same cost.** `buildDocManifest` READS every file
 *      it lists, on every request, to derive headings and stat a Hebrew
 *      mirror: 190 files today. Folding 950 item files into it would make
 *      1,140 reads and 1,140 stats the price of drawing the Library's README
 *      row. `apiCorpusList` reads NO file at all — the roster is one indexed
 *      SQL column — and `apiCorpusFile` reads exactly the one file asked for.
 *
 * ── THE SECURITY ARGUMENT, IN FULL ───────────────────────────────────────
 *
 * **The roster is the INDEX, not a directory walk.** `items.file_path` for the
 * PROJECT layer is what the corpus is; nothing enumerates the filesystem here,
 * so there is no walk to escape from. The `layer = 'project'` clause is
 * load-bearing rather than tidy: a GLOBAL item's `file_path` is relative to
 * `globalRoot`, which is the user's home workspace and not this repository at
 * all, so serving one would hand out a file from outside the project under an
 * id that looks repo-local.
 *
 * **An id is a key, never a path.** `apiCorpusFile` looks its id up in that
 * roster and refuses anything not in it — the same argument `apiDoc` makes,
 * and the reason `..`, an absolute path, a percent-encoded traversal and a
 * Windows-separator path are all simply ABSENT from the key space rather than
 * defended against one spelling at a time.
 *
 * **`isCorpusFilePath` guards the row, not the request.** The index is a
 * SQLite file some other process wrote. A row claiming
 * `file_path: ../../../.ssh/id_rsa` would otherwise become a servable key
 * purely by being in the table, so every path is put through the predicate on
 * the way INTO the roster. See its own docblock in `doctor/checks.ts`.
 *
 * **And the realpath is verified before the read.** The two guards above are
 * about the id; this one is about the FILE. A symlink at
 * `items/note/NOTE-x.md` pointing anywhere outside the corpus is a legal entry
 * in this index — `rebuild`'s walk follows symlinks — so the resolved target
 * is required to sit under the resolved directory it claims to be in
 * (`corpusRootOf`, never a hardcoded `items/`), and a file that escapes is
 * refused with a message saying it escaped rather than pretending it is
 * missing.
 *
 * **Only Markdown, and the whole of it.** `isCorpusFilePath` admits `.md`
 * under a CORPUS WALK ROOT and nothing else, so `state/` (the index and the
 * audit databases) and `config.json` are outside the roster by construction.
 *
 * **AND THE WALK ROOTS ARE TWO, WHICH THIS PARAGRAPH USED TO DENY.** It said
 * `items/` only, three times, and went on saying it after `CORPUS_ROOTS` was
 * widened to `['items/', '.drafts/']` on 2026-09-11 — so this module asserted
 * one boundary while the predicate it calls enforced another.
 * `TASK-the-file-roster-serves-seven-unaccepted-drafts-as-corpus` found the
 * disagreement and named this file as one of the two sides; it is the side
 * that was wrong. `loadLayer` has had a second walk root since `plan:loop
 * seq:3`, a draft is indexed and listed and shown like any other item, and the
 * review surface cannot open a draft in its right pane unless this route will
 * serve it. The reasoning, and what it deliberately makes reachable, is
 * written out above `CORPUS_ROOTS` in `doctor/checks.ts` and is not repeated
 * here — only the original can be superseded.
 *
 * **What a draft in this roster is NOT is an accepted item.** Since
 * `mycontext review promote` moves a promoted draft into `items/`
 * (`review/promote.ts`), every path this roster carries under `.drafts/` names
 * something a person has not yet accepted. Before that, a promoted item stayed
 * in the ignored region and was served from here looking exactly like a
 * corpus item, because it was one — which is the second half of the same
 * finding.
 *
 * ── WHAT IS NOW REACHABLE THAT WAS NOT ───────────────────────────────────
 *
 * Every `.md` file under this corpus's own walk roots that this project's own
 * index holds — 950 under `items/` on 2026-09-06, plus whatever is staged
 * under `.drafts/` and awaiting a person — read by a browser that already
 * holds the session token. Nothing else in `.my_context/` becomes reachable:
 * not `config.json`, not `state/`, not `.audit/`. Nothing outside
 * `.my_context/` changes at all; `isServableDocPath` is untouched and
 * `/api/doc` serves the same documents it served yesterday.
 *
 * The honest residual, said out loud rather than left to be discovered: an
 * item's Markdown is now readable in a browser tab by anyone holding the UI
 * token, and item bodies are where this project writes its most detailed
 * reasoning. That is what the owner asked for, and it is the same corpus
 * `/api/items`, `/api/item/:id`, `/api/render` and `/api/search` already serve
 * to the same holder of the same token — the CONTENT was already reachable;
 * what is new is that it is now reachable AS THE FILE, frontmatter included.
 */

/** How many corpus files one roster carries before it is cut and says so —
 *  the same bound `COVERAGE_FILE_LIMIT` sets on the repository walk, for the
 *  same reason: a corpus large enough to reach it gets a disclosure rather
 *  than a silently short list (`INV-nothing-is-dropped-silently`). */
export const CORPUS_FILE_LIMIT = 20_000;

/** `GET /api/corpus`' body. */
export interface CorpusListBody {
  /** What the tree's root is called — the workspace directory's own name,
   *  read off `projectRoot` rather than written down, so a workspace found at
   *  `.my-context` is not drawn under a name it does not have. */
  root: string;
  /** Corpus-root-relative POSIX paths, sorted, one per servable file. */
  files: string[];
  /** How many project-layer rows the index held BEFORE `isCorpusFilePath`
   *  filtered them. `indexed - files.length` is what the boundary refused,
   *  and the Library states it rather than letting the difference vanish. */
  indexed: number;
  /** The roster hit `CORPUS_FILE_LIMIT` and is short. */
  truncated: boolean;
}

/** `GET /api/corpus/:id`' body. */
export interface CorpusFileBody {
  /** The id this was asked for — corpus-root-relative. */
  id: string;
  /** Where the file lives from the workspace's point of view, which is what
   *  the document page's breadcrumb shows. */
  path: string;
  /** The raw `---` block, WITHOUT its fences, or `null` where the file has
   *  none. Carried apart from the body because YAML pushed through a Markdown
   *  renderer is not a rendering of this file — see `splitFrontmatter`. */
  frontmatter: string | null;
  /** Everything after the frontmatter fence, as Markdown. */
  markdown: string;
  /** The whole file's size in bytes, frontmatter included — the one number
   *  that says the two halves above are the whole of it. */
  bytes: number;
}

/**
 * Every corpus file this server will serve, off the index and off nothing
 * else. Rebuilt per request rather than cached, for `buildDocManifest`'s own
 * reason: a roster rebuilt every time is a roster that can never itself go
 * stale.
 */
function corpusRoster(
  ws: Workspace,
): { files: string[]; roster: Set<string>; indexed: number; truncated: boolean } {
  if (ws.projectRoot === null) {
    return { files: [], roster: new Set(), indexed: 0, truncated: false };
  }
  return withStores(ws, (store) => {
    const rows = store.raw(
      "SELECT file_path FROM items WHERE layer = 'project' ORDER BY file_path",
    );
    const roster = new Set<string>();
    for (const row of rows) {
      if (roster.size >= CORPUS_FILE_LIMIT) break;
      const rel = row['file_path'];
      if (typeof rel !== 'string') continue;
      if (!isCorpusFilePath(rel)) continue;
      roster.add(rel);
    }
    return {
      files: [...roster].sort(),
      roster,
      indexed: rows.length,
      truncated: rows.length > CORPUS_FILE_LIMIT,
    };
  });
}

/**
 * `GET /api/corpus` — the roster the file tree is drawn from, with no file
 * content at all. `GET /api/corpus/:id` below is where one file's Markdown is
 * fetched, once a reader has picked it.
 *
 * No `limit`/`offset` pair, unlike `/api/coverage`: this answer is one string
 * per file (~52 kB for 950 of them) and the tree needs the WHOLE shape to say
 * how many files sit under a folder before that folder is opened. Paging it
 * would make "how many files are under `items/task/`" a question no page of
 * the answer could settle.
 */
export function apiCorpusList(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const { files, indexed, truncated } = corpusRoster(ws);
  const body: CorpusListBody = {
    root: ws.projectRoot === null ? '' : path.basename(ws.projectRoot),
    files,
    indexed,
    truncated,
  };
  return { status: 200, body };
}

/**
 * `GET /api/corpus/:id` — one corpus file, split into its frontmatter and its
 * body, and nothing interpreted beyond that split.
 *
 * The refusal NAMES what was refused and how many files the roster holds — the
 * shape `apiDoc` and `apiHelp` already take — and the one refusal that is NOT
 * a plain "no such file" is the symlink escape, which says so, because a file
 * that resolves outside the corpus is a fact about the corpus rather than a
 * missing id.
 */
export function apiCorpusFile(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const { roster } = corpusRoster(ws);
  const notFound = (): JsonResult => ({
    status: 404,
    body: {
      error: `no corpus file "${params.id}" — ${roster.size} file(s) in this corpus; list them ` +
        'at GET /api/corpus. Nothing outside that roster is ever read: the id is looked up as a ' +
        'key, never joined onto a path.',
    },
  });
  const projectRoot = ws.projectRoot;
  if (projectRoot === null) return notFound();
  if (!roster.has(params.id)) return notFound();

  // The id came out of the roster a line ago, so this join can only produce a
  // path under the workspace. The realpath check below is about the FILE the
  // path lands on, which the id cannot speak for: `rebuild`'s walk follows
  // symlinks, so a symlinked item is a legal member of this corpus and its
  // target is the thing that has to be inside it.
  const absPath = path.join(projectRoot, ...params.id.split('/'));
  // WHICH root, rather than `items/` — a draft is a corpus file under
  // `.drafts/` since `plan:loop seq:3` gave `loadLayer` a second walk root,
  // and `corpusRootOf` is the same list `isCorpusFilePath` admitted it by. The
  // `null` branch is unreachable from here (the id came out of the roster,
  // which is filtered by that same predicate) and is still narrowed rather
  // than asserted away: an unreachable branch that resolves to `items` would
  // become a containment check against the wrong directory the day the two
  // lists drift.
  const root = corpusRootOf(params.id);
  const itemsDir = path.join(projectRoot, root ?? 'items');
  let real: string;
  let realItems: string;
  try {
    realItems = realpathSync(itemsDir);
    real = realpathSync(absPath);
  } catch (err) {
    return {
      status: 404,
      body: {
        error: `"${params.id}" is in this corpus's index but its file could not be resolved: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  if (real !== realItems && !real.startsWith(realItems + path.sep)) {
    return {
      status: 404,
      body: {
        error: `"${params.id}" is in this corpus's index but resolves outside the corpus's own ` +
          `${root ?? 'items'} directory — a symlink pointing out of the workspace. It is ` +
          'refused rather than ' +
          'read: this route serves the corpus, and a file that is not in it is not one of its ' +
          'files however it came to be listed.',
      },
    };
  }

  let text: string;
  try {
    text = readFileSync(real, 'utf8');
  } catch (err) {
    return {
      status: 404,
      body: {
        error: `"${params.id}" is in this corpus's index but its file could not be read: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  const split = splitFrontmatter(text);
  const body: CorpusFileBody = {
    id: params.id,
    path: `${path.basename(projectRoot)}/${params.id}`,
    // A file with no fence is served WHOLE as the body rather than refused.
    // `parseItem` refuses it — it cannot make an item out of it — but this
    // route is not making an item, it is showing a file, and the one file in
    // a corpus that fails to parse is precisely the one somebody needs to
    // look at.
    frontmatter: split === null ? null : split.frontmatter,
    markdown: split === null ? text.replace(/\r\n?/g, '\n') : split.body,
    bytes: Buffer.byteLength(text, 'utf8'),
  };
  return { status: 200, body };
}
