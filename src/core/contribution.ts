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
 * a corpus and what keeps it safe for a read surface to import.
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
 * One origin's whole delivery picture.
 *
 * **The COMPARISON is the measurement.** A delivery count on its own says
 * nothing about whether a corpus is helping; the question the loop has to
 * answer later is whether items it promoted are delivered, superseded or
 * retired differently from the ones a person wrote. That is a comparison
 * between cohorts, so the cohort split has to exist from the first
 * measurement — it cannot be added to a number already taken.
 */
export interface Cohort {
  origin: string;
  /** Items of this origin in the corpus TODAY, whether or not the log knows them. */
  items: number;
  /** Of those, how many no injection record has ever delivered. */
  neverDelivered: number;
  /**
   * Of those, how many were spilled at least once and delivered NEVER — the
   * selector chose them and the budget cut them, every time. A strict subset
   * of `neverDelivered`: an item delivered once and spilled ten times is not
   * here.
   */
  alwaysSpilled: number;
  medianDelivered: number;
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
export function cohorts(byId: Map<string, Item>, got: Map<string, Contribution>): Cohort[] {
  const buckets = new Map<string, number[]>();
  const never = new Map<string, number>();
  const spilledOnly = new Map<string, number>();
  for (const item of byId.values()) {
    // `item.origin` is REQUIRED on `Item` and defaulted by the loader, so
    // there is no `?? 'human'` here: a fallback that can never fire would be
    // guessing an author for an item whose author is a fact on disk.
    const origin: string = item.origin;
    const row = got.get(item.id);
    const delivered = row?.delivered ?? 0;
    const list = buckets.get(origin) ?? [];
    list.push(delivered);
    buckets.set(origin, list);
    if (delivered === 0) {
      never.set(origin, (never.get(origin) ?? 0) + 1);
      if ((row?.spilled ?? 0) > 0) {
        spilledOnly.set(origin, (spilledOnly.get(origin) ?? 0) + 1);
      }
    }
  }
  return [...buckets.entries()].map(([origin, list]): Cohort => ({
    origin,
    items: list.length,
    neverDelivered: never.get(origin) ?? 0,
    alwaysSpilled: spilledOnly.get(origin) ?? 0,
    medianDelivered: median(list),
  })).sort((a, b) => (a.origin < b.origin ? -1 : 1));
}
