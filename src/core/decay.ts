import { scopePolicyFor, type Config } from './config.ts';
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
   *
   * An unscoped item whose category has `scopePolicy: 'inert'` is NOT here,
   * because under that policy it is the opposite of unrestricted: it matches
   * no path and is never JIT-injected (`matchesScope`, select.ts), so it
   * neither applies to every file nor competes for the jit budget — the two
   * things this list exists to say. It is not dropped: it is still measured in
   * `cold`/`warm` like everything else, its scope cell reads `(inert)` at
   * `--full`, and `doctor`'s `scope_policy_inert` note reports it by name.
   */
  unrestricted: DecayRow[];
  /**
   * Item types this config's `categories` map says NOTHING about, with how
   * many active items carry each — newest defect first, `plan:swallow seq:11`
   * minor m13.
   *
   * The line that produces them reads
   * `config.categories[item.type]?.tier !== 'normative'`, and the `?.` makes an
   * ABSENT category answer "not normative". That is the benign branch taken by
   * an unlisted input: rename a category in `config.json` and every item still
   * carrying the old type silently leaves this report — not retired, not cold,
   * not warm, not counted anywhere, and therefore never reviewed for
   * retirement again. Nothing said so, which is why it is here: the report must
   * be able to say *"I did not measure these, and this is why"*, in the same
   * report that otherwise reads as a complete census.
   *
   * Empty is the ordinary answer and means the census covered everything
   * eligible. It is NOT a bucket: these rows are in neither `cold` nor `warm`,
   * precisely because no tier could be established for them.
   */
  unknownCategory: { type: string; count: number }[];
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
  const unknown = new Map<string, number>();

  for (const item of input.items) {
    const category = input.config.categories[item.type];
    // **Counted BEFORE `isEligible`, and that is where the defect actually
    // lives.** `isEligible` is `Boolean(config.categories[item.type]?.enabled)`
    // and `isNormative` is `…?.tier === 'normative'`: both read an ABSENT
    // category as a measured "no". So an item whose category was renamed out
    // from under it is excluded one line earlier than the `?.tier` this item
    // names, and asking the question after the gate would count nothing at all.
    // An `active` item is the one this report is about; a retired one is
    // excluded on its own merits either way.
    if (category === undefined) {
      if (item.status === 'active') unknown.set(item.type, (unknown.get(item.type) ?? 0) + 1);
      continue;
    }
    if (!isEligible(item, input.config)) continue;
    if (category.tier !== 'normative') continue;

    const row = toRow(item, usage);

    // Every eligible normative item is measured. An unscoped item used to be
    // pulled out of this partition because it could not be injected at all;
    // it can now be injected on every path, so excluding it from cold/warm
    // would be discarding a real measurement.
    (recent.has(item.id) ? warm : cold).push(row);
    // Additive, not exclusive — see `DecayReport.unrestricted`. The `push`
    // above already ran, deliberately.
    // `scopePolicyFor`, not a bare `scope.length === 0`: what an empty scope
    // MEANS is per-category config, and under `inert` it means the reverse of
    // this list's whole claim. See `DecayReport.unrestricted`.
    if (item.scope.length === 0 && scopePolicyFor(input.config, item.type) !== 'inert') {
      unrestricted.push(row);
    }
  }

  return {
    window: input.window,
    sessionsRecorded: input.sessionsRecorded,
    unknownCategory: [...unknown]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type)),
    cold: cold.sort(byColdest),
    warm: warm.sort(byColdest),
    unrestricted: unrestricted.sort(byColdest),
  };
}
