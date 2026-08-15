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
   * Carried alongside `scope` because a renderer given only `scope` cannot
   * describe how the item reaches a session. `mycontext decay --full` once
   * printed `(none)` for 7 of this repo's 25 cold rows —
   * `RULE-erasable-syntax-only` and `CONST-zero-runtime-dependencies` among
   * them — which read as "this can never be injected, give it a scope or
   * delete it" about pinned, load-bearing items.
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
  /**
   * Active normative items that declare no scope, and therefore apply to every
   * file. NOT a fourth bucket: `cold` and `warm` partition the eligible set on
   * their own, and these rows also appear in one of them. It is a breadth
   * view over the same set, not a slice of it, and a consumer that sums
   * `cold + warm + unrestricted` double-counts.
   *
   * This replaces an `unscoped` bucket that meant the opposite. While an empty
   * scope matched nothing, an unscoped, unpinned item could not reach a
   * session at all, so it was excluded from cold/warm as unmeasurable and
   * reported as a configuration gap to fix. Now an unscoped item is
   * unrestricted rather than unreachable: it is injectable everywhere, so it
   * is measurable and belongs in cold/warm like anything else, and what is
   * worth saying about it is the reverse — it is the broadest kind of item
   * there is, and it competes for the JIT budget on every file operation.
   * That is a cost to be aware of, not a defect, and this list carries no
   * recommendation to "fix" it.
   */
  unrestricted: DecayRow[];
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
  const unrestricted: DecayRow[] = [];

  for (const item of input.items) {
    if (!isEligible(item, input.config)) continue;
    if (input.config.categories[item.type]?.tier !== 'normative') continue;

    const row = toRow(item, usage);

    // Every eligible normative item is measured. An unscoped item used to be
    // pulled out of this partition because it could not be injected at all;
    // it can now be injected on every path, so excluding it from cold/warm
    // would be discarding a real measurement.
    (recent.has(item.id) ? warm : cold).push(row);
    // Additive, not exclusive — see `DecayReport.unrestricted`. The `push`
    // above already ran, deliberately.
    if (item.scope.length === 0) unrestricted.push(row);
  }

  return {
    window: input.window,
    sessionsRecorded: input.sessionsRecorded,
    cold: cold.sort(byColdest),
    warm: warm.sort(byColdest),
    unrestricted: unrestricted.sort(byColdest),
  };
}
