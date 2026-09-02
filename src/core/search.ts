import type { Config } from './config.ts';
import { normalizePosix } from './paths.ts';
import { matchesScope } from './select.ts';
import type { Item, Status } from './types.ts';
import { RELATION_TYPES } from './vocabulary.ts';

/**
 * **What a READ filter may ask about: the write vocabulary, plus whatever the
 * corpus actually holds.**
 *
 * `RELATION_TYPES` is a WRITE gate — it is the whole of what stops
 * `link_items` forging a `superseded_by` edge, and `superseded_by` is
 * deliberately absent from it for that reason. Validating a read filter
 * against it therefore refuses a question about an edge type the corpus really
 * carries: measured on this project's own corpus, `mycontext search --relation
 * superseded_by` was refused while NINE items carried exactly that edge, so
 * nine real relations were unsearchable from every query surface at once.
 *
 * `apiGraph` (`ui/read-model.ts`) hit the same class first and fixed it the
 * same way — serve the closed vocabulary in its authored order, then any type
 * on disk the vocabulary does not name, sorted — and this is that answer
 * lifted so the three surfaces share ONE implementation rather than three
 * agreeing copies. A read filter must accept any type that can appear on disk;
 * nothing here widens what may be written.
 *
 * Sorted after the vocabulary rather than merged into it, so two identical
 * corpora produce identical bytes and the closed vocabulary keeps the order it
 * was authored in — the order every select and refusal message shows.
 */
export function searchableRelationTypes(items: Item[]): string[] {
  const extra = new Set<string>();
  for (const item of items) {
    for (const relation of item.relations) {
      if (!RELATION_TYPES.includes(relation.type)) extra.add(relation.type);
    }
  }
  return [...RELATION_TYPES, ...[...extra].sort()];
}

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
  /**
   * Case-insensitive substring of the item's searchable text: title, body,
   * every observation (its text and its context), and every `extra` value.
   */
  text?: string | null;
  /** Repo-relative file path; matched against item scopes. */
  path?: string | null;
  /** Items carrying at least one relation of this type. */
  relation?: string | null;
}

/**
 * Everything the `text` filter searches, lower-cased and joined.
 *
 * Title and body are the obvious part. Observations and `extra` are here
 * because leaving them out was a real defect rather than an omission: the
 * corpus recorded the phrase "silently drop" inside an `## Observations`
 * section, and `search "silently drop"` returned nothing. That was read as
 * evidence that substring matching was too literal, and it nearly bought a
 * full-text index to fix it. The cause was field coverage — an FTS index over
 * title and body would have reproduced the miss exactly.
 *
 * `extra` is included for the same reason: a custom category's distinguishing
 * field is exactly what a user would search for, and it sat outside the
 * predicate.
 *
 * Still no ranking. The decision recorded at the top of this file is about
 * relevance scoring and is untouched: widening WHAT is matched is not ordering
 * what matched.
 */
function searchableText(item: Item): string {
  const parts: string[] = [item.title, item.body];
  for (const o of item.observations) {
    parts.push(o.text);
    if (o.context !== null) parts.push(o.context);
  }
  for (const value of Object.values(item.extra)) parts.push(value);
  return parts.join('\n').toLowerCase();
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
    if (text && !searchableText(item).includes(text)) return false;
    return true;
  });
}

/** Whether any filter is actually set — an all-absent filter matches the whole
 * corpus, which both callers refuse rather than answer with "everything". */
export function anyFilterSet(filters: ItemFilters): boolean {
  return Object.values(filters).some((v) => v !== undefined && v !== null && v !== '');
}
