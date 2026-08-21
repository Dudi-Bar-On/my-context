/**
 * The Work read model (web-UI plan 2): the palette's read execution of
 * `mycontext search`, and its live glob tester. Everything here is a READ.
 *
 * The settlements a human makes from this data — promote, discard, capture —
 * are composed in the browser (`lib/command.js`) and pasted into the user's
 * own shell; no function in this module, or reachable from it, mutates
 * anything, and `test/ui/no-writes.test.ts` enforces that over the whole
 * import graph.
 *
 * ── WHAT IS NOT HERE YET ───────────────────────────────────────────────────
 *
 * Plan 2's Task 3 also lands `apiRevisions` and `apiReviewQueue` in this
 * module, over `core/revision-log.ts` and `core/revision-diff.ts`, and wires
 * `registerWorkRoutes()` into `server.ts`. That task was built on a separate
 * branch; `registerWorkRoutes` below marks the two lines where its
 * registrations belong, and nothing calls `registerWorkRoutes` until that
 * branch lands the `server.ts` half of it. The import rule Task 3
 * states governs anything added here: revision-LOG and revision-DIFF, never
 * `revision.ts`, which imports `updateItem` at runtime and would put a
 * mutating function inside the server's graph.
 */
import path from 'node:path';
import { injection } from '../cli/commands/injection.ts';
import { matchesAnyGlob } from '../core/paths.ts';
import { anyFilterSet, filterItems, type ItemFilters } from '../core/search.ts';
import type { Status } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
/**
 * No mirrors. `STATUSES` comes from `core/validate.ts` and `RELATION_TYPES`
 * from `core/vocabulary.ts`, which imports nothing and exists so that reading
 * a closed vocabulary never requires a module that can write.
 *
 * An earlier version of plan 2 declared local copies here, because both lists
 * then lived in `mutate.ts` and the server's import graph bans it. That is no
 * longer true, and a copy would be a second spelling of a closed vocabulary --
 * the defect `RELATION_TYPES`'s own comment warns about.
 */
import { STATUSES } from '../core/validate.ts';
import { RELATION_TYPES } from '../core/vocabulary.ts';
import { badRequest, coverageFiles, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

const SEARCH_PARAMS = ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'];

/**
 * The CLI's own cap, so the palette and the command answer the same question
 * by default (`cli/commands/search.ts` · `const DEFAULT_LIMIT = 50;` · ~63).
 */
const SEARCH_DEFAULT_LIMIT = 50;

/**
 * `GET /api/search` — `filterItems`, exposed. **Its third caller, not a fourth
 * spelling.**
 *
 * The predicate behind `query_items` and `mycontext search` lives in
 * `core/search.ts` · `The corpus filter behind BOTH` · ~7 precisely so that a
 * surface answering "which items match this" cannot grow a private opinion.
 * The `path` filter is the instance in miniature: it goes through
 * `matchesScope`, so an item that declares NO scope is unrestricted and still
 * matches — a raw `matchesAnyGlob` would hide exactly the broadest items in
 * the corpus, which is the defect `query_items` shipped for months.
 *
 * At least one filter is required, mirroring the CLI's refusal
 * (`cli/commands/search.ts` · `At least one filter is required. To list the whole corpus, that is` · ~58):
 * an all-absent filter matches the whole corpus, which is `/api/items`, not a
 * search. Truncation is reported rather than silent — a capped 200 and a
 * complete 200 must not be the same document.
 */
export function apiSearch(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, SEARCH_PARAMS);
  if (bad) return badRequest(bad);

  const status = url.searchParams.get('status');
  if (status !== null && !STATUSES.includes(status as Status)) {
    return badRequest(`status must be one of ${STATUSES.join(', ')} (got ${JSON.stringify(status)})`);
  }
  const relation = url.searchParams.get('relation');
  if (relation !== null && !RELATION_TYPES.includes(relation)) {
    return badRequest(`relation must be one of ${RELATION_TYPES.join(', ')} (got ${JSON.stringify(relation)})`);
  }
  const type = url.searchParams.get('type');
  // `Object.hasOwn`, not a bare index: the categories map is null-prototype
  // (`config.ts` · `const categories: Record<string, ResolvedCategory> = Object.create(null);` · ~671).
  if (type !== null && !Object.hasOwn(ws.config.categories, type)) {
    return badRequest(
      `unknown category ${JSON.stringify(type)} — this config declares: ` +
      `${Object.keys(ws.config.categories).join(', ')}`);
  }
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? SEARCH_DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    return badRequest(`limit must be a positive integer (got ${JSON.stringify(rawLimit)})`);
  }

  const filters: ItemFilters = {
    text: url.searchParams.get('text'),
    type,
    tag: url.searchParams.get('tag'),
    path: url.searchParams.get('path'),
    status: status as Status | null,
    relation,
  };
  if (!anyFilterSet(filters)) {
    return badRequest(
      'at least one filter is required — an all-absent filter matches the whole corpus, ' +
      'which is /api/items, not a search (the CLI refuses the same way)');
  }

  return withStores(ws, (store) => {
    const matched = filterItems(store.all(), filters, ws.config);
    return {
      status: 200,
      body: {
        items: matched.slice(0, limit).map((i) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, status: i.status,
            always: i.always, scope: i.scope,
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
        total: matched.length,
        truncated: matched.length > limit,
      },
    };
  });
}

/** How many matches travel with the answer. `total` always carries the rest. */
const GLOB_SAMPLE_CAP = 200;

/**
 * `GET /api/glob?pattern=a/**,b/**` — which files a pattern being composed
 * would match. Comma-separated exactly as `--scope` takes it
 * (`cli/index.ts` · `[--scope "a/**,b/**"] [--tags "a,b"] [--severity hard|soft] ` · ~182).
 *
 * **This is the one legitimate `matchesAnyGlob` call in the UI.** The question
 * is "which files match this pattern" — a question about a pattern, not about
 * which items govern a file. The govern question stays with
 * `matchesScope`/`injection()`, and the difference is the defect
 * `matchesScope`'s own comment names (`select.ts` · `matchesAnyGlob(path, item.scope)` · ~173):
 * an empty scope is a restriction that is ABSENT, and `matchesAnyGlob(path, [])`
 * answers `false` for it in every scope policy.
 *
 * **A caller-supplied pattern cannot escape the workspace, structurally.** The
 * pattern never reaches the filesystem: the walk is rooted at the repository
 * and emits root-relative POSIX paths (`doctor/checks.ts` · `if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));` · ~64),
 * so a pattern normalizing to `../…` or to an absolute path matches no subject
 * that exists, and a sibling directory whose name merely starts with the
 * root's — the case `ui/static.ts`'s containment check is written around — is
 * never walked and so can never be matched. Asserted, not asserted-by-comment,
 * in `test/ui/read-model-work.test.ts`.
 *
 * The walk is `coverageFiles`, which is `listRepoFiles` plus the one honest
 * truncation probe: it asks for one file past the bound and slices back, so
 * "there is at least one more file" is a fact rather than an inference, and
 * the bound itself stays a single exported constant.
 */
export function apiGlob(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['pattern']);
  if (bad) return badRequest(bad);
  const raw = url.searchParams.get('pattern');
  const patterns = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (patterns.length === 0) {
    return badRequest('pattern=<glob>[,<glob>…] is required — the same comma form --scope takes');
  }
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  // The repository, not the workspace: `projectRoot` IS `<repo>/.my_context`.
  const repoRoot = path.dirname(ws.projectRoot);
  const walk = coverageFiles(repoRoot);
  const matches = walk.files.filter((f) => matchesAnyGlob(f, patterns));
  return {
    status: 200,
    body: {
      patterns,
      total: matches.length,
      sample: matches.slice(0, GLOB_SAMPLE_CAP),
      fileWalkTruncated: walk.truncated,
    },
  };
}

export function registerWorkRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  // Task 3's two registrations belong here:
  //   registerRoute('GET', '/api/revisions', json(apiRevisions));
  //   registerRoute('GET', '/api/review-queue', json(apiReviewQueue));
  registerRoute('GET', '/api/search', json(apiSearch));
  registerRoute('GET', '/api/glob', json(apiGlob));
}
