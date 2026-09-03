import type { Config } from './config.ts';
import { normalizePosix } from './paths.ts';
import { matchesScope } from './select.ts';
import type { Item, Status } from './types.ts';
import { inverseOf, RELATION_TYPES } from './vocabulary.ts';

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
 * `direction` on `ItemFilters` — B10, the backlink query. `relationDegrees`
 * and `apiGraph` (`src/ui/read-model.ts`) already walk every edge in both
 * directions to build the injection-safe read models; before this, no
 * agent- or CLI-reachable surface could ask "what points AT this item" —
 * only "what does this item point at", by reading its own `## Relations`
 * block. `in` answers the first question, `out` the second, and `both` is
 * their union.
 */
export const LINK_DIRECTIONS = ['in', 'out', 'both'] as const;
export type LinkDirection = typeof LINK_DIRECTIONS[number];

/** One edge touching the `linkedTo` anchor, as seen from the anchor's side. */
export interface RelationLink {
  /** The OTHER item's id — the anchor's own id never appears here. */
  id: string;
  /**
   * The relation type as it reads FROM THE ANCHOR, which is not always the
   * type the row was stored under — see `PASSIVE_RELATIONS`.
   */
  type: string;
  direction: 'in' | 'out';
}

/**
 * **Which spelling of each inverse pair is the PASSIVE one** — the one whose
 * stored row points the opposite way from what it means.
 *
 * `vocabulary.ts`'s `INVERSE_RELATIONS` records the two pairs but is
 * deliberately SYMMETRIC (`inverseOf('enforces') === 'enforced_by'` and
 * `inverseOf('enforced_by') === 'enforces'`), because both names are equally
 * legal to write — `linkItems` accepts either and refuses only the SECOND row
 * for one edge. Symmetry is right for a write gate and wrong for this
 * function: only ONE spelling of each pair reverses the direction a naive
 * owner/target read would report.
 *
 * For every ordinary relation, and for the ACTIVE half of a pair (`produced`,
 * `enforces`), the row's owner is the grammatical subject — "owner produced
 * target", "owner enforces target" — so the owner is the one POINTING and the
 * literal storage direction already IS the semantic one. The PASSIVE half
 * (`discovered_by`, `enforced_by`) is a passive-voice sentence: "owner is
 * enforced_by target" means TARGET enforces owner, so the party doing the
 * pointing is the row's TARGET and the owner is the one being pointed at —
 * backwards from every other relation this corpus stores.
 *
 * `relationLinks` uses this to swap source/sink (and to report the type under
 * its ACTIVE spelling) for exactly these two names, so a caller asking "what
 * enforces me" gets the right answer whether the row happens to be spelled
 * `enforces` on the enforcer or `enforced_by` on the enforced — the case
 * `DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two` exists
 * for: *"a relation has an ACTIVE and a PASSIVE side, and a reader may want
 * either"*.
 *
 * Not derived from `INVERSE_RELATIONS` because that map cannot answer this
 * question by construction (it is symmetric on purpose — see above); this is
 * the one piece of information the vocabulary's own prose carries
 * (`RELATION_MEANINGS.discovered_by` and `.enforced_by` both say, verbatim,
 * "the PASSIVE reading of …") that no export currently states as data.
 * `test/core/relation-inverses.test.ts` pins `INVERSE_RELATIONS`'s two pairs;
 * a third pair added there without a matching addition here would silently
 * treat the new pair as an ordinary, non-reversing relation rather than fail
 * loudly, which is why the guard test added alongside this constant asserts
 * this set's members are exactly two and are both keys of `INVERSE_RELATIONS`.
 */
const PASSIVE_RELATIONS = new Set(['discovered_by', 'enforced_by']);

/**
 * Every edge touching `anchorId`, direction resolved — ONE walk of the
 * corpus (`relationDegrees`'s own shape, `src/ui/read-model.ts`), building a
 * `Map` keyed by the OTHER item's id so `filterItems` can test each candidate
 * in O(1) rather than re-scanning every item's relations once per candidate.
 *
 * The anchor's own id is never a key: a self-referential row (an item naming
 * itself as its own target) satisfies neither "sink === anchor && source !==
 * anchor" nor "source === anchor && sink !== anchor" below, so it contributes
 * no link — there is no OTHER item on either end of it to report.
 *
 * `superseded_by` is not special-cased and needs none: it has no entry in
 * `PASSIVE_RELATIONS` (it is not even in `RELATION_TYPES` — see
 * `searchableRelationTypes` above), so it is read exactly like `constrains`
 * or `depends_on` — literal owner points at literal target. The vocabulary
 * ruling that a read filter must serve whatever is on disk applies here
 * unchanged: this function never consults `RELATION_TYPES`.
 */
export function relationLinks(items: Item[], anchorId: string): Map<string, RelationLink[]> {
  const links = new Map<string, RelationLink[]>();
  const add = (id: string, link: RelationLink): void => {
    const entry = links.get(id);
    if (entry === undefined) links.set(id, [link]);
    else entry.push(link);
  };
  for (const item of items) {
    for (const rel of item.relations) {
      const passive = PASSIVE_RELATIONS.has(rel.type);
      // Passive: the row's TARGET is the one pointing, and its OWNER is the
      // one pointed at — reversed from every other relation. Active or
      // ordinary: owner points at target, matching the literal storage.
      const source = passive ? rel.target : item.id;
      const sink = passive ? item.id : rel.target;
      const type = passive ? (inverseOf(rel.type) ?? rel.type) : rel.type;
      if (sink === anchorId && source !== anchorId) {
        add(source, { id: source, type, direction: 'in' });
      } else if (source === anchorId && sink !== anchorId) {
        add(sink, { id: sink, type, direction: 'out' });
      }
    }
  }
  return links;
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
  /**
   * Items carrying at least one relation of this type — the OWNER'S own row,
   * i.e. an outbound edge, UNLESS `linkedTo` is also set. Combined with
   * `linkedTo`, it narrows to that TYPE among the anchor's links in the
   * given `direction`, matching either spelling of an inverse pair (asking
   * for `enforces` also matches a stored `enforced_by` row and vice versa —
   * see `relationLinks`), because both name the one edge.
   */
  relation?: string | null;
  /**
   * B10 — the anchor item for a backlink query: only items connected to
   * THIS item by a relation, in `direction`. `null`/absent runs the ordinary,
   * anchor-free filters unchanged — `relation` alone keeps meaning exactly
   * what it always has. The anchor need not exist in the corpus: a dangling
   * id still answers correctly for whichever items actually name it, the
   * same tolerance every other relation-aware surface here extends.
   */
  linkedTo?: string | null;
  /** Which side of the anchor's edges to answer with. Only meaningful, and
   * only honoured, alongside `linkedTo`; defaults to `'both'` when absent —
   * see `relationLinks`'s header for why an `'out'`-only default would be
   * the same silent gap this filter exists to close. */
  direction?: LinkDirection | null;
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
  // Built ONCE, before the per-item loop — `relationLinks` is `relationDegrees`'s
  // own shape, one walk of the corpus, not a re-scan per candidate.
  const links = filters.linkedTo ? relationLinks(items, filters.linkedTo) : null;
  const direction = filters.direction ?? 'both';
  // The relation the caller asked for, matched under either spelling of an
  // inverse pair: `relationLinks` always reports a link under its ACTIVE
  // name, so a caller who typed the passive one (`enforced_by`, a value
  // `searchableRelationTypes` accepts exactly as readily) must not be
  // answered with an empty result for a question it asked correctly.
  const relationAlt = filters.relation ? inverseOf(filters.relation) : null;
  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    if (links) {
      const entries = (links.get(item.id) ?? [])
        .filter((l) => direction === 'both' || l.direction === direction);
      if (entries.length === 0) return false;
      if (filters.relation
        && !entries.some((l) => l.type === filters.relation || l.type === relationAlt)) return false;
    } else if (filters.relation && !item.relations.some((r) => r.type === filters.relation)) {
      return false;
    }
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
