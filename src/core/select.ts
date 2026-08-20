import { scopePolicyFor, type Config } from './config.ts';
import {
  danglingEdges, isFocusActive, type Focus, type FocusAxes, type FocusReport,
} from './focus.ts';
import { matchesAnyGlob, normalizePosix } from './paths.ts';
import { renderIndexLine, renderItemBlock } from './render-item.ts';
import type { Item } from './types.ts';

/**
 * Re-exported so a caller that reads `Selection.focus` needs no second import,
 * and so nothing is tempted to define a second shape for the same disclosure.
 * It lives in `core/focus.ts` because the text renderers for it do, and those
 * cannot import this module without a cycle.
 */
export type { FocusReport } from './focus.ts';

export type SelectEvent = 'session-start' | 'compact' | 'tool' | 'manual';

export interface SelectContext {
  event: SelectEvent;
  /** POSIX, layer-root-relative. Used by the JIT tier (Plan 2). */
  path?: string | null;
  /** Item ids already injected this session. */
  seen?: string[];
  /** Item ids captured by the PreCompact snapshot (Plan 2). */
  restore?: string[];
  /**
   * The active focus, or null/absent for "no narrowing".
   *
   * Focus is applied HERE and nowhere else. It is a filter inside the one
   * selection rule, not a parallel path to injection — this project has paid
   * four times for two implementations of one rule, and a second place that
   * decides what a session sees would be the fifth. Every surface that asks
   * "what would focus hide" (the CLI's `--show`/`--preview`, the MCP tool,
   * `doctor`) calls `select` and reads `Selection.focus`, rather than
   * re-deriving the predicate.
   */
  focus?: Focus | null;
}

export interface SelectionEntry {
  item: Item;
  tier: 'pinned' | 'jit' | 'restored';
}

export interface Spill {
  id: string;
  tier: SelectionEntry['tier'] | 'index';
  reason: string;
}

export interface IndexSummary {
  normative: { id: string; type: string; title: string }[];
  counts: Record<string, number>;
  /** The review queue, as `reviewQueue` defines it: project-layer drafts only. */
  drafts: number;
  /** Items whose status is superseded, deprecated, or validated: retired, but not silently gone. */
  retired: number;
  /** Normative lines that didn't fit `config.budgets.index`, for a "+N more" indication. */
  truncated: number;
  /**
   * Active items whose category is disabled or entirely unknown to config,
   * by category name. A disabled/unknown category drops to index-only — it
   * never deletes existing items — so these counts keep them visible rather
   * than letting them vanish silently. Computed from the raw item set, the
   * same basis as `retired` (`drafts` is narrower: it is the review queue,
   * project layer only — see `reviewQueue`).
   */
  ineligible: Record<string, number>;
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
  /** The focus disclosure, or null when no focus is active. */
  focus: FocusReport | null;
  /**
   * The estimated tokens this selection's budgets were CHARGED for what was
   * admitted: the sum of `itemCost` over every entry in `full` (each item's
   * rendered block plus its joining separator, per `estimateTokens`) plus the
   * per-line estimates for every index line in `index.normative`. Spilled
   * items contribute nothing, and neither does un-budgeted scaffolding —
   * section headers, the "+N more" line, and the focus/spill/revision notes
   * are all outside the budgets and outside this number.
   *
   * It exists so the injection audit record can carry the figure the budget
   * decisions were actually made against, computed at selection time. It is
   * NOT recomputable later from the corpus: an item edited, superseded or
   * retired after the injection renders differently (or not at all), so a
   * recomputed figure drifts for exactly the corpus being maintained most
   * actively. Callers recording it must take it from here, never re-derive it.
   */
  tokens: number;
}

/**
 * Approximate token count, chars/4. No tokenizer is available under the
 * zero-dependency constraint, so this is a chars/4 approximation with
 * symmetric error in either direction — not a guaranteed bound. `itemCost`
 * (the only caller that matters for budgeting) applies this to the exact
 * text `renderItemBlock` emits, so it measures the real rendered block —
 * scope, tags, observation tags/context, and render scaffolding all
 * included — rather than a partial estimate of it.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The separator `render.ts` joins full-text blocks with (`renderSelection`). */
const BLOCK_SEPARATOR = '\n\n';

/**
 * Cost is derived from the exact text `render.ts` emits for this item, so
 * budgeting can never structurally undercount what actually gets rendered
 * (scope, observation tags/context, and all render scaffolding included).
 * `renderItemBlock` is pure, so this stays I/O-free.
 *
 * Exported for the UI's budget simulator (web-ui plan 1), which must show the
 * same per-item figure select budgets with rather than re-deriving one.
 */
export function itemCost(item: Item): number {
  return estimateTokens(renderItemBlock(item)) + estimateTokens(BLOCK_SEPARATOR);
}

export function isEligible(item: Item, config: Config): boolean {
  if (item.status !== 'active') return false;
  const category = config.categories[item.type];
  return Boolean(category?.enabled);
}

function isNormative(item: Item, config: Config): boolean {
  return config.categories[item.type]?.tier === 'normative';
}

/**
 * The category names `select` can ever admit to a full-text tier: enabled AND
 * normative, i.e. exactly `isEligible` ∧ `isNormative` expressed over config
 * rather than over an item.
 *
 * It exists so `Store.activeInjectable` can push that filter into SQL without
 * re-deriving the rule. Any pre-filter a caller applies must be a superset of
 * what `select` would keep, or the caller silently narrows injection below
 * the selector — which is exactly how the JIT hook's old `has_scope = 1`
 * predicate outlived the rule it encoded.
 */
export function injectableTypes(config: Config): string[] {
  return Object.entries(config.categories)
    .filter(([, category]) => category.enabled && category.tier === 'normative')
    .map(([name]) => name);
}

/**
 * Scope is a RESTRICTION, not an enabler (spec §3.2). An item that declares
 * globs is JIT-eligible only on the paths they match; an item that declares
 * none is unrestricted, so it matches every path and is JIT-eligible
 * everywhere. That is the point of the default: a user who does not need to
 * restrict an item types nothing.
 *
 * This deliberately reverses the original implementation, in which an empty
 * scope matched NOTHING and an unscoped item could never be injected at all —
 * a misimplementation of the requirement, not a decision being revisited.
 *
 * `always` is orthogonal and keeps its own meaning: pinned in full at session
 * start regardless of any path. An unscoped `always` item is therefore both
 * pinned and JIT-eligible, and the `seen` filter in `select` is what stops it
 * being injected twice — the pinned injection is recorded in the ledger, so
 * the first tool event of the session already sees it as seen.
 *
 * Exported so that every surface answering "does this item apply to this
 * path" — the JIT tier here, and the `query_items` MCP tool's `path` filter —
 * asks the same function. `query_items` re-derived it as a bare
 * `matchesAnyGlob(path, item.scope)` and consequently kept hiding unscoped
 * items from a path query long after they had become injectable on that path.
 *
 * What an empty scope MEANS is per-category configuration, not a constant:
 * `scopePolicy` (spec §4b). `global` (the default) and `required` both leave
 * an unscoped item unrestricted — `required` refuses one at capture instead
 * (mutate.ts), so it needs no second rule here and must not have one: an item
 * that exists but can never be injected is precisely the defect this comment
 * describes being removed. Only `inert` changes the answer, and it is the
 * whole of the difference: an unscoped item matches NO path, so it is never
 * JIT-injected and survives as an index line.
 *
 * `always` is unaffected by the policy as well as by the path — spec §4b says
 * so in as many words — because the pinned tier in `select` never consults
 * this function.
 *
 * `config` is required rather than optional. It was added to this signature
 * knowing that every caller had to be found by hand, because the alternative
 * (a default) is a caller that silently keeps the old rule: that is exactly
 * how `Store.activeScoped`'s `has_scope = 1` outlived the rule it encoded.
 */
export function matchesScope(item: Item, target: string, config: Config): boolean {
  if (item.scope.length === 0) return scopePolicyFor(config, item.type) !== 'inert';
  return matchesAnyGlob(target, item.scope);
}

/**
 * Whether an item is in focus on the `scope` axis.
 *
 * Two readings of a `--scope` value, both supported, because a person types
 * both and neither is wrong:
 *
 *  - **A path** (`src/api/orders.ts`): the item applies to that path. This is
 *    `matchesScope`, i.e. exactly the question the JIT tier asks, so an
 *    unscoped item is unrestricted and is in focus on every path, and the
 *    `inert` scope policy keeps its meaning.
 *  - **A glob** (`src/api/**`): the item's own globs fall inside it. Matched in
 *    the other direction — the item's scope entries as subjects, the focus
 *    value as the pattern — which is what makes `--scope 'src/api/**'` narrow
 *    to items scoped there rather than to items that happen to match the
 *    literal string.
 *
 * Either match is enough. Being generous here is the safe direction: it keeps
 * items visible, and every item focus DOES hide is counted and disclosed.
 */
export function focusMatchesScope(item: Item, value: string, config: Config): boolean {
  if (matchesScope(item, value, config)) return true;
  return item.scope.some((glob) => matchesAnyGlob(glob, [value]));
}

/**
 * Whether an item is in focus: every non-empty axis has at least one match.
 *
 * AND across axes, OR within one. `--tag billing --tag invoicing --category
 * rule` is "a rule tagged billing or invoicing", which is what a person means
 * when they type it. An empty axis constrains nothing.
 */
export function matchesFocus(item: Item, focus: FocusAxes, config: Config): boolean {
  if (focus.tags.length > 0 && !focus.tags.some((t) => item.tags.includes(t))) return false;
  if (focus.categories.length > 0 && !focus.categories.includes(item.type)) return false;
  if (focus.scope.length > 0 && !focus.scope.some((s) => focusMatchesScope(item, s, config))) {
    return false;
  }
  return true;
}

/**
 * Whether focus removes this item from injection.
 *
 * The `severity: hard` exemption lives here, in the predicate, rather than in
 * each caller — so no surface can narrow the corpus past it by forgetting.
 */
export function focusHides(item: Item, focus: Focus | null, config: Config): boolean {
  if (!isFocusActive(focus)) return false;
  if (item.severity === 'hard') return false;
  return !matchesFocus(item, focus, config);
}

/**
 * A fresh, unaliased empty IndexSummary (Plan 1 added retired/truncated/ineligible).
 * Must be a factory, not a shared constant: `select` is pure and this process
 * is long-lived, so handing the same object out on every tool event would let
 * one consumer's mutation of `sel.index.counts`/`.normative`/`.ineligible`
 * poison every subsequent tool-event selection. `Object.freeze` would not be
 * enough — the nested arrays/objects would still be mutable.
 */
function emptyIndex(): IndexSummary {
  return { normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {} };
}

const SEVERITY_RANK: Record<Item['severity'], number> = { hard: 0, soft: 1 };
const LAYER_RANK: Record<Item['layer'], number> = { project: 0, global: 1 };

/** Ordinal string compare: deterministic, unlike `localeCompare` (ICU/locale dependent, can return 0 for distinct strings). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Hard severity first, then most-recently-relevant, then id for determinism. */
function byPriority(a: Item, b: Item): number {
  const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severityDiff !== 0) return severityDiff;
  const layerDiff = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
  if (layerDiff !== 0) return layerDiff;
  return compareStrings(a.id, b.id);
}

function fitToBudget(
  candidates: Item[], budget: number, tier: SelectionEntry['tier'],
): { entries: SelectionEntry[]; spilled: Spill[]; used: number } {
  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];
  let used = 0;

  for (const item of [...candidates].sort(byPriority)) {
    const cost = itemCost(item);
    // First-fit, not strict priority truncation: an over-budget item is skipped
    // (`continue`, not `break`) so a later, smaller, LOWER-priority item can still
    // be admitted after a higher-priority one has spilled. Deliberate, for better
    // budget utilisation — `spilled` is therefore NOT a strict priority prefix of
    // the sorted candidates.
    if (used + cost > budget) {
      spilled.push({
        id: item.id, tier,
        reason: `budget exceeded (${used + cost} > ${budget} estimated tokens)`,
      });
      continue;
    }
    used += cost;
    entries.push({ item, tier });
  }

  // `used` is returned, not recomputed by the caller: it is the exact figure
  // the admissions above were decided against, and `Selection.tokens` promises
  // that figure — not a second derivation that merely agrees today.
  return { entries, spilled, used };
}

const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);

/**
 * The review queue: the drafts a human can actually act on from THIS project.
 *
 * The layer filter is part of the definition of the queue, not a display
 * choice. `updateItem`'s `requireWritableItem` refuses any write to a
 * non-project-layer item, so a global-layer draft can never be promoted or
 * discarded from this project — listing one is its own silent-wrongness trap
 * (spec §10): a caller works down the queue in the order given and hits a
 * refusal on an entry the queue itself offered as actionable. (Reasoning
 * carried over from `cli/commands/review.ts`, which is where it was first
 * written down.)
 *
 * ONE definition, for every surface that answers "how many drafts are pending
 * review": `buildIndex` below (the SessionStart banner and the `load_context`
 * MCP tool), `list_drafts` (`mcp/tools.ts`), `mycontext review`
 * (`cli/commands/review.ts`) and `mycontext status` (`cli/commands/status.ts`,
 * via `review`'s `drafts`). Each of those re-derived the filter before this
 * existed, and three of the four omitted the layer filter — so the banner, the
 * MCP queue and `status`'s `by status` tally reported a larger number than the
 * queue the user was pointed at, by exactly the global-layer drafts.
 *
 * Filtering only, no ordering: the callers sort differently on purpose
 * (`review` by type then id, `list_drafts` newest first).
 *
 * On input: `buildIndex` passes a post-`mergeLayers` array, while the CLI and
 * MCP callers pass `store.all()` unmerged. The result is the same on both.
 * `mergeLayers` drops an entry only when another entry shares its id, and
 * when it does it keeps the project-layer copy — it never drops a project item
 * in favour of a global one. So the two inputs can differ here only when one
 * id appears on two project-layer items, which `store.all()` cannot produce
 * (`items.id` is the SQLite PRIMARY KEY, and `rebuild` loads `global` before
 * `project` so a cross-layer collision resolves to the project copy in the
 * table itself). Pinned by `test/core/draft-queue.test.ts`.
 */
export function reviewQueue(items: Item[], type: string | null = null): Item[] {
  return items.filter((i) =>
    i.status === 'draft' && i.layer === 'project' && (type === null || i.type === type));
}

function buildIndex(
  eligible: Item[], all: Item[], config: Config, chosenIds: Set<string>,
): { summary: IndexSummary; spilled: Spill[]; used: number } {
  // An item already selected in full (any tier) needs no index line — Claude
  // already has the complete rule, so listing it would spend index budget on
  // redundancy and push genuinely unseen items behind "+N more". These items
  // are deliberately omitted, not truncated: they never enter the candidate
  // list below, so they can't consume budget or spill.
  const normativeItems = eligible
    .filter((i) => isNormative(i, config) && !chosenIds.has(i.id))
    .sort((a, b) => compareStrings(a.id, b.id));

  // Enforce config.budgets.index over the enumerated normative lines, in the
  // same priority order already used above (by id). What doesn't fit is
  // recorded as `truncated` (a "+N more" indication for the renderer) and as
  // `spilled` entries with tier 'index', so it never disappears silently.
  const normative: { id: string; type: string; title: string }[] = [];
  const spilled: Spill[] = [];
  let used = 0;
  for (const item of normativeItems) {
    const line = { id: item.id, type: item.type, title: item.title };
    const cost = estimateTokens(renderIndexLine(line));
    if (used + cost > config.budgets.index) {
      spilled.push({
        id: item.id, tier: 'index',
        reason: `index budget exceeded (${used + cost} > ${config.budgets.index} estimated tokens)`,
      });
      continue;
    }
    used += cost;
    normative.push(line);
  }

  const counts: Record<string, number> = {};
  for (const item of eligible) {
    if (isNormative(item, config)) continue;
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }

  // The banner's number must be the review queue's number — see `reviewQueue`.
  const drafts = reviewQueue(all).length;
  const retired = all.filter((i) => RETIRED_STATUSES.has(i.status)).length;

  // Active items whose category is disabled or unknown are eligible for
  // nothing above, and would otherwise vanish with no trace at all — unlike
  // drafts/retired, which at least aggregate by status. Computed from `all`
  // (the raw set), the same basis `retired` uses.
  const ineligible: Record<string, number> = {};
  for (const item of all) {
    if (item.status !== 'active') continue;
    if (config.categories[item.type]?.enabled) continue;
    ineligible[item.type] = (ineligible[item.type] ?? 0) + 1;
  }

  return {
    summary: { normative, counts, drafts, retired, truncated: spilled.length, ineligible },
    spilled,
    used,
  };
}

/** Project items shadow global items with the same id. */
export function mergeLayers(items: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || (existing.layer === 'global' && item.layer === 'project')) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

/**
 * The disclosure for an active focus, over the universe this event delivers
 * from — see `FocusReport.universe`.
 *
 * `pathUniverse` is the tool event's target path, or null for the whole-corpus
 * events. It is not an optimisation: on a tool event the only items that could
 * have been delivered are the ones matching the path, so counting the rest
 * would report items focus hid from an event that was never going to show them.
 */
function buildFocusReport(
  focus: Focus, eligibleAll: Item[], config: Config, pathUniverse: string | null,
): FocusReport {
  const universeItems = pathUniverse === null
    ? eligibleAll
    : eligibleAll.filter((i) => pathUniverse !== '' && matchesScope(i, pathUniverse, config));

  const hidden: Item[] = [];
  const visible: Item[] = [];
  const exemptHard: string[] = [];
  for (const item of universeItems) {
    if (focusHides(item, focus, config)) {
      hidden.push(item);
      continue;
    }
    visible.push(item);
    if (item.severity === 'hard' && !matchesFocus(item, focus, config)) exemptHard.push(item.id);
  }

  return {
    axes: { tags: focus.tags, categories: focus.categories, scope: focus.scope },
    universe: pathUniverse === null ? 'corpus' : 'path',
    hidden: hidden.map((i) => i.id).sort(compareStrings),
    visible: visible.length,
    exemptHard: exemptHard.sort(compareStrings),
    dangling: danglingEdges(visible, hidden),
  };
}

export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const merged = mergeLayers(items);
  const eligibleAll = merged.filter((i) => isEligible(i, config));

  // Focus narrows the eligible set, so every tier and the index inherit it from
  // one place. `drafts`, `retired` and `ineligible` are computed from `merged`
  // in `buildIndex` and are therefore whole-corpus counts either way, which is
  // right: they are counts of what is NOT being injected, and focus does not
  // change how many drafts are waiting for review.
  const focus = ctx.focus ?? null;
  const eligible = isFocusActive(focus)
    ? eligibleAll.filter((i) => !focusHides(i, focus, config))
    : eligibleAll;
  const injectable = eligible.filter((i) => isNormative(i, config));

  // Seen items are removed before budgeting, not after — this is Plan 1's
  // hardening and must not be reverted: an already-injected item must not
  // consume budget and spill a fresh one in its place.
  const seen = new Set(ctx.seen ?? []);
  const fresh = injectable.filter((i) => !seen.has(i.id));

  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];
  // `Selection.tokens`: accumulated from each tier's own `used`, which is the
  // figure the admissions were decided against — never re-derived afterwards.
  let tokens = 0;

  if (ctx.event === 'session-start' || ctx.event === 'compact' || ctx.event === 'manual') {
    const result = fitToBudget(fresh.filter((i) => i.always), config.budgets.pinned, 'pinned');
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  if (ctx.event === 'compact') {
    const restoreIds = new Set(ctx.restore ?? []);
    const alreadyChosen = new Set(entries.map((e) => e.item.id));
    const result = fitToBudget(
      fresh.filter((i) => restoreIds.has(i.id) && !alreadyChosen.has(i.id)),
      config.budgets.restored,
      'restored',
    );
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  const target = ctx.event === 'tool' && ctx.path ? normalizePosix(ctx.path) : '';
  if (ctx.event === 'tool' && target !== '') {
    const result = fitToBudget(
      fresh.filter((i) => matchesScope(i, target, config)), config.budgets.jit, 'jit',
    );
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  const focusReport = isFocusActive(focus)
    ? buildFocusReport(focus, eligibleAll, config, ctx.event === 'tool' ? target : null)
    : null;

  // A spill record means "excluded from the selection". An item can spill
  // from one tier (e.g. too big for `pinned`) and still land in `full` via
  // another tier that ran afterward (e.g. `restored` admits it). At that
  // point the earlier spill record is false — the item was not excluded —
  // so it is dropped once every tier has had its say. This must run after
  // ALL tiers, not per-tier, since a later tier is what can retroactively
  // falsify an earlier tier's spill.
  const chosenIds = new Set(entries.map((e) => e.item.id));
  const trueSpills = (records: Spill[]): Spill[] => records.filter((s) => !chosenIds.has(s.id));

  // The bounded index — and its own budget accounting inside buildIndex — is
  // a per-session cost, not a per-tool-call cost.
  if (ctx.event === 'tool') {
    return {
      full: entries, index: emptyIndex(), spilled: trueSpills(spilled), focus: focusReport,
      tokens,
    };
  }
  const { summary: index, spilled: indexSpilled, used: indexUsed } =
    buildIndex(eligible, merged, config, chosenIds);
  return {
    full: entries,
    index,
    spilled: trueSpills([...spilled, ...indexSpilled]),
    focus: focusReport,
    tokens: tokens + indexUsed,
  };
}
