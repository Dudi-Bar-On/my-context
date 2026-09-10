/**
 * **How often each item was actually DELIVERED, read backwards out of the
 * audit log rather than measured going forward.**
 *
 * `recordAudit` has always written one `kind: 'injection'` record per delivery
 * carrying `injected` and `spilled` (`AuditRecord`, `core/audit.ts`), so this
 * needs no new write path, no hook change, and can answer for history that
 * already happened. That is the whole reason the instrumentation was cheap:
 * the instrument was already recording and nobody had read it.
 *
 * **Why it had to exist before anything else was built on the corpus.**
 * Library drift — accumulated knowledge pushing a session BELOW the
 * no-knowledge baseline — is silent by construction and only ever detectable
 * as a CHANGE. A measurement taken after the first automatic promotion has no
 * control to compare against, so it can only be believed.
 *
 * A spilled item is reported with `delivered: 0` rather than omitted. "Chosen
 * and then cut for budget" and "never a candidate at all" are different facts,
 * and an item that is always spilled is the sharpest finding this file can
 * produce.
 *
 * **This module reads. It opens nothing, writes nothing and takes no path** —
 * every input is already-parsed data, which is what lets it be tested without
 * a corpus and what keeps it safe for a read surface to import. Eligibility
 * therefore arrives as a predicate (`Injectable`) rather than being derived
 * from config here: see its doc comment for why it is required and not
 * defaulted.
 */
import type { AuditRecord } from './audit.ts';
import type { Item } from './types.ts';

/** One item's whole record in the log: how often it landed, and how often it did not. */
export interface Contribution {
  id: string;
  /** Injection records that carried this id in `injected`. */
  delivered: number;
  /** Injection records that carried it in `spilled` — chosen, then cut. */
  spilled: number;
  /** Every tier it was ever seen at, in first-seen order. */
  tiers: string[];
  /** The earliest and latest injection record naming it, or null if none. */
  firstAt: string | null;
  lastAt: string | null;
}

function seen(map: Map<string, Contribution>, id: string): Contribution {
  const found = map.get(id);
  if (found !== undefined) return found;
  const made: Contribution = {
    id, delivered: 0, spilled: 0, tiers: [], firstAt: null, lastAt: null,
  };
  map.set(id, made);
  return made;
}

/**
 * ISO-8601 UTC compares correctly as a string, and `AuditRecord.at` is
 * documented as always UTC ISO-8601 for exactly this kind of reason. No Date
 * is constructed, so a malformed stamp in an old record cannot become `NaN`
 * and silently win or lose every comparison.
 */
function stamp(row: Contribution, at: string): void {
  if (row.firstAt === null || at < row.firstAt) row.firstAt = at;
  if (row.lastAt === null || at > row.lastAt) row.lastAt = at;
}

/**
 * Every id the log has ever delivered or spilled, counted.
 *
 * Records of any other `kind` are skipped rather than tolerated: `injected`
 * and `spilled` are optional fields on the one flat `AuditRecord` interface,
 * not members of a discriminated union, so nothing but this filter keeps a
 * `mutation` record out of the answer.
 */
export function contributions(records: AuditRecord[]): Map<string, Contribution> {
  const out = new Map<string, Contribution>();
  for (const record of records) {
    if (record.kind !== 'injection') continue;
    const at = record.at;
    // `?? []` is ABSENCE, not zero: a record written before a field existed,
    // and one whose list was genuinely empty, are both correctly read as
    // "this record names no id here".
    for (const ref of record.injected ?? []) {
      const row = seen(out, ref.id);
      row.delivered += 1;
      if (!row.tiers.includes(ref.tier)) row.tiers.push(ref.tier);
      stamp(row, at);
    }
    for (const ref of record.spilled ?? []) {
      const row = seen(out, ref.id);
      row.spilled += 1;
      if (!row.tiers.includes(ref.tier)) row.tiers.push(ref.tier);
      stamp(row, at);
    }
  }
  return out;
}

/**
 * **Can `select` ever choose this item at all?**
 *
 * Taken as a predicate rather than derived here, for two reasons that pull the
 * same way. This module opens nothing and imports no config, which is what
 * lets it be tested without a corpus; and the gate already exists —
 * `isEligible` ∧ `isNormative` (`core/select.ts`), where a doc comment says in
 * so many words that the FUNCTION travels rather than the predicate, because a
 * re-spelling of that test is the drift it was exported to prevent. So the
 * caller passes `select`'s own answer in.
 *
 * **Required, not optional, and not defaulted to `() => true`.** A delivery
 * count with no eligibility verdict beside it reads "never delivered" over a
 * `task`, a `decision` and an `adr` that `select` could not have chosen under
 * any circumstances — and on 2026-09-10 that was 918 of this corpus's 1,076
 * items. A default would let a caller take that number without ever having to
 * decide what it meant.
 */
export type Injectable = (item: Item) => boolean;

/**
 * One origin's whole delivery picture.
 *
 * **The COMPARISON is the measurement.** A delivery count on its own says
 * nothing about whether a corpus is helping; the question the loop has to
 * answer later is whether items it promoted are delivered, superseded or
 * retired differently from the ones a person wrote. That is a comparison
 * between cohorts, so the cohort split has to exist from the first
 * measurement — it cannot be added to a number already taken.
 *
 * **And every count here except `items` is taken over the INJECTABLE subset,
 * which is the correction that makes the comparison legal.** The first reading
 * of this table (`reports/2026-09-08-contribution-baseline.md`) had to be
 * corrected in prose by a reader who knew `select.ts`: it reported 810 of 983
 * human items "never delivered" and a median of 0 for every cohort, because a
 * corpus of mostly `task` and `decision` items drowns the population that can
 * actually be delivered. **A number a report has to hand-correct in order to
 * mean anything is a number a later reading cannot be compared against** — and
 * comparison over time is this whole module's reason to exist — so the
 * instrument now makes the correction itself.
 */
export interface Cohort {
  origin: string;
  /** Items of this origin in the corpus TODAY, injectable or not. */
  items: number;
  /** Of those, the ones `select` could choose today — the measurable population. */
  injectable: number;
  /** Of `injectable`, how many no injection record has ever delivered. */
  neverDelivered: number;
  /**
   * Of `injectable`, how many were spilled at least once and delivered NEVER —
   * the selector chose them and the budget cut them, every time. A strict
   * subset of `neverDelivered`: an item delivered once and spilled ten times
   * is not here.
   */
  alwaysSpilled: number;
  /** Median delivery count across `injectable`. */
  medianDelivered: number;
  /**
   * **Not injectable today, and yet the log delivered it.** The corpus MOVED
   * under the log: an item whose `status` went to `deprecated` or `superseded`,
   * or whose category left the normative tier, after the injections that
   * carried it.
   *
   * It is a column rather than a footnote because it is the only figure that
   * says out loud that the eligibility verdict is PRESENT-TENSE, applied to a
   * HISTORICAL log. A zero means nothing left the injectable set while the log
   * was being written. A non-zero means some delivery events the log holds
   * were earned under a rule that no longer applies to that item — which is
   * exactly the shape of the change a later reading is looking for, and it
   * must not be invisible in the reading it is compared against.
   */
  deliveredNotInjectable: number;
}

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = ns.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The cohort table, keyed on the items that EXIST rather than on the ids the
 * log holds.
 *
 * Both directions of that choice are deliberate. An item nobody ever delivered
 * has no row in `got` at all, and it is the most interesting row in the table
 * — so the walk is over the corpus. An id in the log answering to no item
 * today is the corpus having MOVED (retired, superseded) and belongs to no
 * cohort; counting it under a guessed origin would be inventing a measurement.
 *
 * `origin` is typed as a plain string rather than as `Origin`, and that is not
 * looseness: the self-improvement design adds a fourth origin for items a
 * review path proposes, and this function must not need editing on the day it
 * does.
 */
export function cohorts(
  byId: Map<string, Item>, got: Map<string, Contribution>, injectable: Injectable,
): Cohort[] {
  const buckets = new Map<string, number[]>();
  const all = new Map<string, number>();
  const never = new Map<string, number>();
  const spilledOnly = new Map<string, number>();
  const movedOut = new Map<string, number>();
  for (const item of byId.values()) {
    // `item.origin` is REQUIRED on `Item` and defaulted by the loader, so
    // there is no `?? 'human'` here: a fallback that can never fire would be
    // guessing an author for an item whose author is a fact on disk.
    const origin: string = item.origin;
    all.set(origin, (all.get(origin) ?? 0) + 1);
    // An origin the corpus carries gets a row even if every one of its items
    // is ineligible: `items: 38, injectable: 0` is a statement, and a missing
    // row is a statement made by omission (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
    if (!buckets.has(origin)) buckets.set(origin, []);
    const row = got.get(item.id);
    const delivered = row?.delivered ?? 0;
    if (!injectable(item)) {
      // Its count is NOT pooled into the median or the never-count. An item
      // `select` cannot choose has a delivery count of zero for a reason that
      // is not about the item, and mixing the two populations is what made the
      // first reading of this table need a prose correction to be read at all.
      if (delivered > 0) movedOut.set(origin, (movedOut.get(origin) ?? 0) + 1);
      continue;
    }
    buckets.get(origin)!.push(delivered);
    if (delivered === 0) {
      never.set(origin, (never.get(origin) ?? 0) + 1);
      if ((row?.spilled ?? 0) > 0) {
        spilledOnly.set(origin, (spilledOnly.get(origin) ?? 0) + 1);
      }
    }
  }
  return [...buckets.entries()].map(([origin, list]): Cohort => ({
    origin,
    items: all.get(origin) ?? 0,
    injectable: list.length,
    neverDelivered: never.get(origin) ?? 0,
    alwaysSpilled: spilledOnly.get(origin) ?? 0,
    medianDelivered: median(list),
    deliveredNotInjectable: movedOut.get(origin) ?? 0,
  })).sort((a, b) => (a.origin < b.origin ? -1 : 1));
}

/**
 * **The items that govern and have never landed** — injectable today, and
 * named by no injection record the log holds.
 *
 * Named rather than only counted, because a count with no names is not
 * checkable and this is the one list in the report a reader can act on. It is
 * deliberately NOT reachable from `got`: an item nobody ever delivered has no
 * entry there at all, so the walk is over the corpus and the log is consulted
 * only to rule a candidate out.
 *
 * **An empty answer is a finding and the caller must print it as one.** A
 * corpus in which everything lands and a log that recorded nothing are
 * indistinguishable here — which is why the caller states how many injection
 * records the log held in the same breath. A quiet run is not a clean corpus.
 */
export function undelivered(
  byId: Map<string, Item>, got: Map<string, Contribution>, injectable: Injectable,
): Item[] {
  const out: Item[] = [];
  for (const item of byId.values()) {
    if (!injectable(item)) continue;
    if ((got.get(item.id)?.delivered ?? 0) > 0) continue;
    out.push(item);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * **What an item's delivery count is worth once you know how long it existed.**
 *
 * The raw count is dominated by age, and on this repository's own corpus it is
 * dominated ENTIRELY: on 2026-09-10 the twenty least-delivered injectable
 * items were the twenty most recently created, and the twenty most-delivered
 * were all created in August. A retirement rule keyed on the raw count would
 * therefore retire exactly the newest governing items — which is the single
 * most important thing this measurement has to hand forward, because those
 * thresholds are supposed to be DERIVED from this corpus rather than copied
 * from a paper.
 *
 * So `opportunities` is the number of injection records written on or after
 * the item's `valid_from`: the chances it actually had. `rate` is `delivered ÷
 * opportunities` — 1.0 for an item that landed in every injection since it
 * existed, near 0 for one that governs and almost never lands.
 *
 * **What it still cannot do**, and this is not a hedge on a real signal: a
 * day's injection records are not evenly spread, so an item created during a
 * quiet week and one created during a busy one are still not perfectly
 * comparable; and `valid_from` is a DATE while `at` is a timestamp, so an item
 * created midway through a day is credited with that whole day's records. Both
 * push the rate DOWN for a young item, so a high rate is trustworthy and a low
 * one on a young item is not.
 */
export interface Exposure {
  id: string;
  delivered: number;
  /** Injection records written on or after `valid_from` — the chances it had. */
  opportunities: number;
  /** `delivered ÷ opportunities`, or null when it had no chances at all. */
  rate: number | null;
}

/**
 * `injectionDays` is every injection record's `at`, in any order; only the
 * date part is compared, because `valid_from` is a date.
 *
 * An item with no `valid_from` is credited with the WHOLE log as its exposure,
 * which is the pessimistic reading — it makes the rate as low as the data
 * allows rather than as flattering as possible.
 */
export function exposure(
  byId: Map<string, Item>, got: Map<string, Contribution>, injectionDays: string[],
): Map<string, Exposure> {
  const days = injectionDays.map((at) => at.slice(0, 10)).sort();
  const chancesSince = (from: string | null): number => {
    if (from === null) return days.length;
    // Binary search for the first day on or after `from`; everything from
    // there to the end is a record this item could have appeared in.
    let lo = 0;
    let hi = days.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (days[mid]! < from) lo = mid + 1;
      else hi = mid;
    }
    return days.length - lo;
  };
  const out = new Map<string, Exposure>();
  for (const item of byId.values()) {
    const delivered = got.get(item.id)?.delivered ?? 0;
    const opportunities = chancesSince(item.validFrom);
    out.set(item.id, {
      id: item.id,
      delivered,
      opportunities,
      rate: opportunities === 0 ? null : delivered / opportunities,
    });
  }
  return out;
}
