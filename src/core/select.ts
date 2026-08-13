import type { Config } from './config.ts';
import { matchesAnyGlob, normalizePosix } from './paths.ts';
import { renderIndexLine, renderItemBlock } from './render-item.ts';
import type { Item } from './types.ts';

export type SelectEvent = 'session-start' | 'compact' | 'tool' | 'manual';

export interface SelectContext {
  event: SelectEvent;
  /** POSIX, layer-root-relative. Used by the JIT tier (Plan 2). */
  path?: string | null;
  /** Item ids already injected this session. */
  seen?: string[];
  /** Item ids captured by the PreCompact snapshot (Plan 2). */
  restore?: string[];
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
  drafts: number;
  /** Items whose status is superseded, deprecated, or validated: retired, but not silently gone. */
  retired: number;
  /** Normative lines that didn't fit `config.budgets.index`, for a "+N more" indication. */
  truncated: number;
  /**
   * Active items whose category is disabled or entirely unknown to config,
   * by category name. A disabled/unknown category drops to index-only — it
   * never deletes existing items — so these counts keep them visible rather
   * than letting them vanish silently. Computed from the raw item set, same
   * basis as `drafts`/`retired`.
   */
  ineligible: Record<string, number>;
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
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
 */
function itemCost(item: Item): number {
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
 * Scope is inert by default (spec §3.2): an item with no globs is indexed and
 * searchable but never JIT-injected. Defaulting to global would refill the
 * context window as the corpus grows — the exact failure this design prevents.
 */
function matchesScope(item: Item, target: string): boolean {
  return item.scope.length > 0 && matchesAnyGlob(target, item.scope);
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
): { entries: SelectionEntry[]; spilled: Spill[] } {
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

  return { entries, spilled };
}

const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);

function buildIndex(
  eligible: Item[], all: Item[], config: Config,
): { summary: IndexSummary; spilled: Spill[] } {
  const normativeItems = eligible
    .filter((i) => isNormative(i, config))
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

  const drafts = all.filter((i) => i.status === 'draft').length;
  const retired = all.filter((i) => RETIRED_STATUSES.has(i.status)).length;

  // Active items whose category is disabled or unknown are eligible for
  // nothing above, and would otherwise vanish with no trace at all — unlike
  // drafts/retired, which at least aggregate by status. Computed from `all`
  // (the raw set), the same basis drafts/retired use.
  const ineligible: Record<string, number> = {};
  for (const item of all) {
    if (item.status !== 'active') continue;
    if (config.categories[item.type]?.enabled) continue;
    ineligible[item.type] = (ineligible[item.type] ?? 0) + 1;
  }

  return {
    summary: { normative, counts, drafts, retired, truncated: spilled.length, ineligible },
    spilled,
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

export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const merged = mergeLayers(items);
  const eligible = merged.filter((i) => isEligible(i, config));
  const injectable = eligible.filter((i) => isNormative(i, config));

  // Seen items are removed before budgeting, not after — this is Plan 1's
  // hardening and must not be reverted: an already-injected item must not
  // consume budget and spill a fresh one in its place.
  const seen = new Set(ctx.seen ?? []);
  const fresh = injectable.filter((i) => !seen.has(i.id));

  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];

  if (ctx.event === 'session-start' || ctx.event === 'compact' || ctx.event === 'manual') {
    const result = fitToBudget(fresh.filter((i) => i.always), config.budgets.pinned, 'pinned');
    entries.push(...result.entries);
    spilled.push(...result.spilled);
  }

  if (ctx.event === 'tool') {
    const target = ctx.path ? normalizePosix(ctx.path) : '';
    if (target !== '') {
      const result = fitToBudget(
        fresh.filter((i) => matchesScope(i, target)), config.budgets.jit, 'jit',
      );
      entries.push(...result.entries);
      spilled.push(...result.spilled);
    }
  }

  // The bounded index — and its own budget accounting inside buildIndex — is
  // a per-session cost, not a per-tool-call cost.
  if (ctx.event === 'tool') {
    return { full: entries, index: emptyIndex(), spilled };
  }
  const { summary: index, spilled: indexSpilled } = buildIndex(eligible, merged, config);
  return { full: entries, index, spilled: [...spilled, ...indexSpilled] };
}
