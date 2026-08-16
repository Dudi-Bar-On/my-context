import type { Config } from './config.ts';
import { normalizePosix } from './paths.ts';
import { matchesScope } from './select.ts';
import type { Item, Status } from './types.ts';

/**
 * The corpus filter behind BOTH `query_items` (the model's tool) and
 * `mycontext search` (the user's command).
 *
 * It lives here rather than inside `src/mcp/tools.ts` because Phase 4's whole
 * premise is that anything the model can do through a tool, the user can do
 * through a command — and a second, hand-written copy of this predicate would
 * make the two surfaces agree only for as long as nobody edited either. This
 * project's most-repeated defect is exactly that: two hand-kept expressions of
 * one rule drifting apart. `path` is the clearest instance in miniature — the
 * `matchesScope` note below is a correction that had to be made once, and a
 * copied filter is where it would be missing the second time.
 *
 * Every field is AND-ed, and an absent field filters nothing. Nothing here
 * ranks: the result is in the order it was given, which for both callers is
 * `store.all()`'s `ORDER BY id`. A relevance score would be a claim about
 * which item answers the question best, and there is no signal in a corpus
 * this size to support one.
 */
export interface ItemFilters {
  /** Category name, exactly — no fuzzy match. */
  type?: string | null;
  status?: Status | null;
  tag?: string | null;
  /** Case-insensitive substring of the title or body. */
  text?: string | null;
  /** Repo-relative file path; matched against item scopes. */
  path?: string | null;
  /** Items carrying at least one relation of this type. */
  relation?: string | null;
}

export function filterItems(items: Item[], filters: ItemFilters, config: Config): Item[] {
  const text = filters.text?.toLowerCase();
  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    if (filters.relation && !item.relations.some((r) => r.type === filters.relation)) return false;
    // `matchesScope`, not a bare `matchesAnyGlob`: an item that declares no
    // scope is unrestricted and applies to this path, so it must be returned.
    // A raw glob match hides exactly the items that govern everything — the
    // broadest ones in the corpus.
    if (filters.path && !matchesScope(item, normalizePosix(filters.path), config)) return false;
    if (text && !`${item.title}\n${item.body}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

/** Whether any filter is actually set — an all-absent filter matches the whole
 * corpus, which both callers refuse rather than answer with "everything". */
export function anyFilterSet(filters: ItemFilters): boolean {
  return Object.values(filters).some((v) => v !== undefined && v !== null && v !== '');
}
