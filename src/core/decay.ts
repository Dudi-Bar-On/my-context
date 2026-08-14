import type { Config } from './config.ts';
import type { Usage } from './ledger.ts';
import { isEligible } from './select.ts';
import type { Item } from './types.ts';

export interface DecayRow {
  id: string;
  type: string;
  title: string;
  scope: string[];
  /**
   * Carried alongside `scope` because the two together decide whether an item
   * can reach a session at all — see the `unscoped` branch below, which
   * requires BOTH "no scope" and "not pinned". A renderer given only `scope`
   * prints `(none)` for a pinned item and invites exactly the wrong action:
   * `mycontext decay --full` did that for 7 of this repo's 25 cold rows,
   * `RULE-erasable-syntax-only` and `CONST-zero-runtime-dependencies` among
   * them, in a report whose own summary said `unscoped 0`.
   */
  always: boolean;
  useCount: number;
  lastUsed: string | null;
}

export interface DecayReport {
  /** How many sessions back the caller asked to look. */
  window: number;
  /** How many sessions the ledger actually holds. */
  sessionsRecorded: number;
  cold: DecayRow[];
  warm: DecayRow[];
  unscoped: DecayRow[];
}

export interface DecayInput {
  items: Item[];
  config: Config;
  usage: Usage[];
  /** Item ids injected during the most recent `window` sessions. */
  recentlyUsed: string[];
  window: number;
  sessionsRecorded: number;
}

function toRow(item: Item, usage: Map<string, Usage>): DecayRow {
  const row = usage.get(item.id);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    scope: item.scope,
    always: item.always,
    useCount: row?.useCount ?? 0,
    lastUsed: row?.lastUsed ?? null,
  };
}

/** Never used, then least recently used, then id. Coldest first. */
function byColdest(a: DecayRow, b: DecayRow): number {
  if (a.lastUsed === null && b.lastUsed !== null) return -1;
  if (a.lastUsed !== null && b.lastUsed === null) return 1;
  if (a.lastUsed !== null && b.lastUsed !== null && a.lastUsed !== b.lastUsed) {
    return a.lastUsed < b.lastUsed ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

export function computeDecay(input: DecayInput): DecayReport {
  const usage = new Map(input.usage.map((u) => [u.itemId, u]));
  const recent = new Set(input.recentlyUsed);

  const cold: DecayRow[] = [];
  const warm: DecayRow[] = [];
  const unscoped: DecayRow[] = [];

  for (const item of input.items) {
    if (!isEligible(item, input.config)) continue;
    if (input.config.categories[item.type]?.tier !== 'normative') continue;

    const row = toRow(item, usage);

    // An item with no scope and no pin cannot reach a session at all. That is a
    // configuration gap, not decay, and mixing the two hides the real signal.
    if (!item.always && item.scope.length === 0) { unscoped.push(row); continue; }

    (recent.has(item.id) ? warm : cold).push(row);
  }

  return {
    window: input.window,
    sessionsRecorded: input.sessionsRecorded,
    cold: cold.sort(byColdest),
    warm: warm.sort(byColdest),
    unscoped: unscoped.sort(byColdest),
  };
}
