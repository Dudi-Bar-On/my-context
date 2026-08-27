/**
 * The Work read model (web-UI plan 2): the palette's read execution of
 * `mycontext search`, its live glob tester, and the capture-time overlap
 * hint. Everything here is a READ.
 *
 * The settlements a human makes from this data — promote, discard, capture —
 * are composed in the browser (`lib/command.js`) and pasted into the user's
 * own shell; no function in this module, or reachable from it, mutates
 * anything, and `test/ui/no-writes.test.ts` enforces that over the whole
 * import graph.
 *
 * Both halves of plan 2 are here: Task 3's revision queue and draft queue,
 * and Tasks 4 and 5's search, glob tester and overlap hint. They were built
 * on separate branches and composed at merge.
 *
 * The import rule governs everything added here: revision-LOG and
 * revision-DIFF, never `revision.ts`, which imports `updateItem` at runtime
 * and would put a mutating function inside the server's graph.
 */
import path from 'node:path';
import { injection } from '../cli/commands/injection.ts';
import { matchesAnyGlob } from '../core/paths.ts';
import { anyFilterSet, filterItems, type ItemFilters } from '../core/search.ts';
import type { Item, Status } from '../core/types.ts';
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
import {
  pendingRevisionCounts, pendingRevisionViews, REVISION_FIELDS,
  type PendingRevision, type RevisionField,
} from '../core/revision-log.ts';
import { lineDiff, valueLines, type DiffLine } from '../core/revision-diff.ts';
import { reviewQueue } from '../core/select.ts';

interface FieldDiff {
  field: RevisionField;
  changed: boolean;
  noCurrent: boolean;
  diff: DiffLine[];
}

function fieldDiffs(rev: PendingRevision): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of REVISION_FIELDS) {
    if (rev.changes[field] === undefined) continue;
    const before = valueLines(field, rev.current[field]);
    const after = valueLines(field, rev.changes[field]) ?? [];
    out.push({
      field,
      changed: rev.changedSince.includes(field),
      // No current text to diff against (item missing, or an extra key the
      // item never had). The CLIENT labels it; the server invents no line.
      noCurrent: before === null,
      diff: lineDiff(before ?? [], after),
    });
  }
  return out;
}

export function apiRevisions(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    const titles = new Map(items.map((i) => [i.id, i.title]));
    const pending = pendingRevisionViews(projectRoot, items);
    return {
      status: 200,
      body: {
        counts: pendingRevisionCounts(pending),
        revisions: pending.map((rev) => ({
          revisionId: rev.revisionId,
          itemId: rev.itemId,
          itemTitle: titles.get(rev.itemId) ?? null,
          origin: rev.origin,
          stagedAt: rev.stagedAt,
          stale: rev.stale,
          itemMissing: rev.itemMissing,
          changedSince: rev.changedSince,
          fields: fieldDiffs(rev),
        })),
      },
    };
  });
}

export function apiReviewQueue(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store) => {
    const drafts = reviewQueue(store.all());
    return {
      status: 200,
      body: {
        drafts: drafts.map((i: Item) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, severity: i.severity,
            always: i.always, scope: i.scope, origin: i.origin,
            injected: verdict.injected, phrase: verdict.phrase, gate: verdict.gate,
          };
        }),
      },
    };
  });
}


const SEARCH_PARAMS = ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'];

/**
 * The CLI's own cap, so the palette and the command answer the same question
 * by default (`cli/commands/search.ts` · `const DEFAULT_LIMIT = 50;` · ~68).
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
 * (`cli/commands/search.ts` · `At least one filter is required. To list the whole corpus, that is` · ~63):
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
  // (`config.ts` · `const categories: Record<string, ResolvedCategory> = Object.create(null);` · ~1140).
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
            injected: verdict.injected, phrase: verdict.phrase, gate: verdict.gate,
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
 * (`cli/index.ts` · `[--scope "a/**,b/**"] [--tags "a,b"] [--severity hard|soft] ` · ~454).
 *
 * **This is the one legitimate `matchesAnyGlob` call in the UI.** The question
 * is "which files match this pattern" — a question about a pattern, not about
 * which items govern a file. The govern question stays with
 * `matchesScope`/`injection()`, and the difference is the defect
 * `matchesScope`'s own comment names (`select.ts` · `matchesAnyGlob(path, item.scope)` · ~245):
 * an empty scope is a restriction that is ABSENT, and `matchesAnyGlob(path, [])`
 * answers `false` for it in every scope policy.
 *
 * **A caller-supplied pattern cannot escape the workspace, structurally.** The
 * pattern never reaches the filesystem: the walk is rooted at the repository
 * and emits root-relative POSIX paths (`doctor/checks.ts` · `if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));` · ~65),
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

// --- Capture-time overlap ---------------------------------------------------

/**
 * Capture-time overlap detection (spec §4, Work): a HEURISTIC hint that two
 * texts say nearly the same thing, shown before the second is filed — never a
 * dedup rule the corpus enforces, and the screen's wording says "may already
 * say this", not "duplicate". No similarity function existed anywhere in src/
 * when this was written (grepped); this is the one, kept deliberately simple
 * and deterministic: lowercase word sets (runs of [a-z0-9], length >= 3),
 * jaccard for symmetric similarity, containment (scaled 0.8) so a short
 * draft that is a subset of a long item still surfaces.
 *
 * It earns its place because `type` is fixed at creation: a duplicate filed
 * under the wrong category cannot be cleanly undone afterwards.
 *
 * **What the SCREEN does with this is not settled** (plan §0, open question 1).
 * The mockup's Capture screen lists the items whose SCOPE matches and says in
 * so many words that no similarity or ranking is shown, "because no similarity
 * metric exists in this product". This endpoint is that metric, so a score or
 * a ranked order must not be rendered until the owner rules. The function is
 * pure and tested either way; nothing here decides what is drawn.
 */
function overlapTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3));
}

export function overlapScore(draft: { title: string; body: string }, item: Item): number {
  const a = overlapTokens(`${draft.title}\n${draft.body}`);
  const b = overlapTokens(`${item.title}\n${item.body}`);
  // Nothing to compare is 0, not NaN. A NaN sorts unpredictably and would put
  // an empty draft anywhere in the list.
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  const jaccard = common / (a.size + b.size - common);
  const containment = common / Math.min(a.size, b.size);
  return Math.max(jaccard, containment * 0.8);
}

const OVERLAP_THRESHOLD = 0.2;
const OVERLAP_CAP = 5;

/**
 * `POST /api/overlap` — the items a draft may already be saying.
 *
 * POST because a draft body exceeds URL limits. It reads the store and writes
 * nothing, so spec §2's "no POST changes state on disk" holds, and
 * `test/ui/no-writes.test.ts` watches this module's whole import graph.
 *
 * A malformed body is a 400 that names the field, never an empty candidate
 * list: "nothing overlaps" and "you sent me something I could not read" are
 * different answers and must not share a response.
 */
export function apiOverlap(ws: Workspace, url: URL, body: unknown): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return badRequest('POST /api/overlap takes a JSON object body: { title: string; body?: string }');
  }
  const draft = body as { title?: unknown; body?: unknown };
  if (typeof draft.title !== 'string' || draft.title.trim() === '') {
    return badRequest('title (non-empty string) is required — overlap is judged on what would be filed');
  }
  if (draft.body !== undefined && typeof draft.body !== 'string') {
    return badRequest('body must be a string when present');
  }
  const input = { title: draft.title, body: draft.body ?? '' };
  return withStores(ws, (store) => {
    const candidates = store.all()
      .filter((i) => i.status !== 'superseded')
      .map((i) => ({ item: i, score: overlapScore(input, i) }))
      .filter((c) => c.score >= OVERLAP_THRESHOLD)
      // Ties broken by id, so the order is a fact about the corpus rather than
      // about the order two equally-scoring items happened to arrive in.
      .sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : 1))
      .slice(0, OVERLAP_CAP)
      .map(({ item: i, score }) => {
        const verdict = injection(i, ws.config);
        return {
          id: i.id, type: i.type, title: i.title,
          score: Math.round(score * 100) / 100,
          injected: verdict.injected, phrase: verdict.phrase, gate: verdict.gate,
        };
      });
    return { status: 200, body: { candidates } };
  });
}

export function registerWorkRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/revisions', json(apiRevisions));
  registerRoute('GET', '/api/review-queue', json(apiReviewQueue));
  registerRoute('GET', '/api/search', json(apiSearch));
  registerRoute('GET', '/api/glob', json(apiGlob));
  registerRoute('POST', '/api/overlap', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiOverlap(ctx.ws, ctx.url, ctx.body),
  });
}
