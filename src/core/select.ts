import type { Config } from './config.ts';
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
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
}

/**
 * Approximate token count, chars/4. No tokenizer is available under the
 * zero-dependency constraint, so this is an average-case approximation, not a
 * guaranteed bound in either direction. `itemCost` (the only caller that
 * matters for budgeting) also omits `scope`, `tags`, observation tags and
 * context, and any render scaffolding, so real rendered cost can exceed the
 * estimate.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function itemCost(item: Item): number {
  const parts = [
    item.id, item.type, item.title, item.body,
    ...item.observations.map((o) => `${o.category} ${o.text}`),
    ...item.relations.map((r) => `${r.type} ${r.target}`),
  ];
  return estimateTokens(parts.join(' '));
}

export function isEligible(item: Item, config: Config): boolean {
  if (item.status !== 'active') return false;
  const category = config.categories[item.type];
  return Boolean(category?.enabled);
}

function isNormative(item: Item, config: Config): boolean {
  return config.categories[item.type]?.tier === 'normative';
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
    const cost = estimateTokens(`${line.id} ${line.type} ${line.title}`);
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

  return {
    summary: { normative, counts, drafts, retired, truncated: spilled.length },
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

  const seen = new Set(ctx.seen ?? []);

  // Filter `seen` BEFORE budgeting, never after. Budgeting first would let an
  // item Claude already has consume budget and push a fresh constraint into
  // spill — a silent loss that no test catches until the ledger exists.
  const pinnedCandidates = eligible
    .filter((i) => i.always && isNormative(i, config))
    .filter((i) => !seen.has(i.id));
  const { entries, spilled } = fitToBudget(pinnedCandidates, config.budgets.pinned, 'pinned');
  const { summary: index, spilled: indexSpilled } = buildIndex(eligible, merged, config);

  return { full: entries, index, spilled: [...spilled, ...indexSpilled] };
}
