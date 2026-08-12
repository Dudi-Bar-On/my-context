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
  tier: string;
  reason: string;
}

export interface IndexSummary {
  normative: { id: string; type: string; title: string }[];
  counts: Record<string, number>;
  drafts: number;
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
}

/**
 * Approximate token count. No tokenizer is available under the zero-dependency
 * constraint, so this deliberately over-estimates rather than under-estimates:
 * spilling one item too many is recoverable, blowing the budget is not.
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

/** Hard severity first, then most-recently-relevant, then id for determinism. */
function byPriority(a: Item, b: Item): number {
  if (a.severity !== b.severity) return a.severity === 'hard' ? -1 : 1;
  if (a.layer !== b.layer) return a.layer === 'project' ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function fitToBudget(
  candidates: Item[], budget: number, tier: SelectionEntry['tier'],
): { entries: SelectionEntry[]; spilled: Spill[] } {
  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];
  let used = 0;

  for (const item of [...candidates].sort(byPriority)) {
    const cost = itemCost(item);
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

function buildIndex(eligible: Item[], all: Item[], config: Config): IndexSummary {
  const normative = eligible
    .filter((i) => isNormative(i, config))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, type: i.type, title: i.title }));

  const counts: Record<string, number> = {};
  for (const item of eligible) {
    if (isNormative(item, config)) continue;
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }

  return { normative, counts, drafts: all.filter((i) => i.status === 'draft').length };
}

export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const eligible = items.filter((i) => isEligible(i, config));

  const pinnedCandidates = eligible.filter((i) => i.always && isNormative(i, config));
  const { entries, spilled } = fitToBudget(pinnedCandidates, config.budgets.pinned, 'pinned');

  const seen = new Set(ctx.seen ?? []);
  const full = entries.filter((e) => !seen.has(e.item.id));

  return { full, index: buildIndex(eligible, items, config), spilled };
}
