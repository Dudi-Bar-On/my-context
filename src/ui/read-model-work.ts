import { injection } from '../cli/commands/injection.ts';
import {
  pendingRevisionCounts, pendingRevisionViews, REVISION_FIELDS,
  type PendingRevision, type RevisionField,
} from '../core/revision-log.ts';
import { lineDiff, valueLines, type DiffLine } from '../core/revision-diff.ts';
import { reviewQueue } from '../core/select.ts';
import type { Item } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The Work read model (web-ui plan 2): the pending-revision queue as
 * structured per-field diffs, and the draft queue. Everything here is a READ.
 * The settlements a human makes from this data — promote-revision, discard-
 * revision, review promote/discard — are composed in the browser
 * (lib/command.js) and pasted into the user's own shell; no function in this
 * module, or reachable from it, mutates anything, and test/ui/no-writes.test.ts
 * enforces that over the whole import graph.
 *
 * This module imports revision-LOG and revision-DIFF, never revision.ts:
 * revision.ts imports updateItem at runtime, and one import here would put a
 * mutating function inside the server's graph.
 */

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
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
      },
    };
  });
}

export function registerWorkRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/revisions', json(apiRevisions));
  registerRoute('GET', '/api/review-queue', json(apiReviewQueue));
  // Tasks 4 and 5 add their registrations here.
}
