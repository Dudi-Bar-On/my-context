/**
 * **Whether anything may be retired on this corpus's own evidence, and — when
 * the answer is yes — which items.** `plan:loop seq:5`, design §9.
 *
 * ── THE ORDER THE WHOLE PHASE EXISTS TO ENFORCE ────────────────────────────
 *
 * §9's first draft said *"auto-deprecate after N days"*. The research says a
 * badly tuned retirement rule measured **worse than no retirement at all** —
 * −0.019 against a 0.258 baseline — and that calendar age is uncorrelated with
 * whether an item helps. So the numbers are **derived from this corpus's
 * measured distribution**, never copied from a paper, and the derivation is
 * dated.
 *
 * That is why `RetirementRule` carries `derivedOn` and `derivedIn` beside the
 * two thresholds, and why there is no default rule anywhere in this build.
 * **A threshold with no derivation cannot be constructed**, so a caller cannot
 * reach `candidates` by guessing a number: it has to name the day the number
 * was measured and the report that measured it.
 *
 * ── AND WHY THIS BUILD SHIPS NO RULE AT ALL ────────────────────────────────
 *
 * `RETIREMENT_RULE` is `null`, and `WHY_NO_RULE` says why in the corpus's own
 * numbers (`reports/2026-09-11-retirement-thresholds.md`). `derivability`
 * below is the re-runnable form of that answer: it takes the evidence and
 * refuses, naming each measured reason. **When the corpus changes, the gate
 * changes its mind on its own** — which is the difference between a
 * measurement and a paragraph in a report.
 *
 * ── THIS MODULE READS. IT OPENS NOTHING AND WRITES NOTHING ─────────────────
 *
 * Every input is already-parsed data — items, the contribution map, audit
 * records — exactly as `core/contribution.ts` is built, and for a second
 * reason on top of that module's: **§13 says the owner promotes, always, and a
 * retirement is a stand-down that reaches every future session.** A module
 * that cannot write cannot retire anything by accident, in a hook, or under a
 * flag somebody adds later without reading this comment. The surface
 * (`contribution --retire`) prints a proposal and has no verb.
 *
 * @see reports/2026-09-11-retirement-thresholds.md — the derivation, and why it refuses
 */
import type { AuditRecord } from './audit.ts';
import type { Contribution } from './contribution.ts';
import type { Item } from './types.ts';

/**
 * **The only origin this mechanism may ever touch**, and the plan's own
 * restriction: *"Never touch `origin: 'human'`. Every mechanism here is
 * restricted to `origin: 'review'`."*
 *
 * The cap half is defensible on the same line: the human-authored corpus is
 * not what a self-improvement loop can inflate, so bounding it would be this
 * mechanism taking a decision about somebody else's writing.
 */
export const RETIREABLE_ORIGIN = 'review';

/**
 * **A derived threshold, and it cannot be written down without its
 * derivation.**
 *
 * `derivedOn`/`derivedIn` are not documentation. They are the difference
 * between a number this corpus measured and a number somebody liked the look
 * of, and the failure mode §9 exists to prevent is exactly the second one
 * arriving with the confidence of the first.
 */
export interface RetirementRule {
  /**
   * Deliveries at or below which an item has demonstrably not earned its
   * place. Never applied to an item younger than `minAgeDays`.
   */
  maxDelivered: number;
  /**
   * How long an item must have existed before it may be judged at all. *An
   * item filed last week that has not been delivered has not failed — it has
   * not been tested.*
   */
  minAgeDays: number;
  /** The day the two numbers above were measured. `YYYY-MM-DD`. */
  derivedOn: string;
  /** The report that measured them, so the next reader reads it rather than guessing. */
  derivedIn: string;
}

/**
 * **What this build ships: no rule.**
 *
 * Not a config default of zero, not a disabled flag — `null`, so `candidates`
 * is unreachable without a caller constructing a rule and naming the
 * measurement that produced it. `WHY_NO_RULE` carries the measured reasons;
 * `derivability` re-derives them from whatever the corpus looks like today.
 */
export const RETIREMENT_RULE: RetirementRule | null = null;

/**
 * The reasons, measured on 2026-09-11 against this repository's own corpus and
 * audit log. Each one is a number, and each one is re-computed by
 * `derivability` rather than trusted from here.
 */
export const WHY_NO_RULE: string[] = [
  'the population a rule could ever touch is empty: 0 items of origin `review` exist, because '
  + '`review.maxProposalsPerPass` ships at 0 and the loop has never proposed anything',
  'both signals the design names fire on nothing: 0 injectable items have never been delivered, '
  + 'and 0 were ever spilled without also being delivered',
  'the low tail of every exposure-corrected delivery statistic is the PINNED tier — all 39 '
  + '`always: true` items rank in the least-delivered 69 of 157, and not one reaches the '
  + 'most-delivered 89',
];

/** One item a rule names, with the reason it names it. */
export interface RetirementCandidate {
  id: string;
  delivered: number;
  /** Whole days since `valid_from`, or `null` when the item carries none. */
  ageDays: number | null;
  /** The reason, travelling with the candidate so a list is readable on its own. */
  why: string;
  /**
   * **Always `deprecate`.** §8: *ignoring is not declining.* An item nobody
   * judged is stood down, never deleted — only judgement earns deletion, and
   * this module is the absence of judgement by construction.
   *
   * A field rather than a comment because a caller that renders the list has
   * to say which verb it is proposing, and a caller that one day adds a second
   * verb has to widen this type to do it.
   */
  action: 'deprecate';
}

/** Milliseconds in a day, spelled once. */
const DAY_MS = 86_400_000;

/**
 * Whole days between an item's `valid_from` and `now`, or `null` when it
 * carries no date.
 *
 * `null` is NOT zero and is not treated as young: an undated item is one this
 * rule cannot judge, and both callers below exclude it for that reason rather
 * than guessing in either direction.
 */
export function ageDays(item: Item, now: number): number | null {
  if (item.validFrom === null) return null;
  const ms = Date.parse(item.validFrom);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/**
 * Whether this mechanism is allowed to name an item at all — the guard both
 * `candidates` and `overCap` pass through, so there is one statement of it.
 *
 * `origin: 'review'` and nothing else. A `human` item is out however cold, a
 * `agent` item is out because a person drove the tool that wrote it, and an
 * `ingest` item is out because a document somebody chose to import is a
 * person's judgement too.
 */
function retireable(item: Item): boolean {
  return item.origin === RETIREABLE_ORIGIN;
}

/**
 * **The items a rule names, and nothing about how they are acted on.**
 *
 * Pure, and sorted least-delivered first so a reader sees the strongest case
 * at the top. An item younger than `rule.minAgeDays`, or carrying no date at
 * all, is never named: *it has not failed, it has not been tested.*
 */
export function candidates(
  items: Item[], got: Map<string, Contribution>, rule: RetirementRule, now: number,
): RetirementCandidate[] {
  const out: RetirementCandidate[] = [];
  for (const item of items) {
    if (!retireable(item)) continue;
    const age = ageDays(item, now);
    if (age === null || age < rule.minAgeDays) continue;
    const delivered = got.get(item.id)?.delivered ?? 0;
    if (delivered > rule.maxDelivered) continue;
    out.push({
      id: item.id,
      delivered,
      ageDays: age,
      why: delivered === 0
        ? `never delivered in ${age} day(s) — the rule derived on ${rule.derivedOn} `
          + `(${rule.derivedIn}) allows ${rule.maxDelivered}`
        : `delivered ${delivered} time(s) in ${age} day(s), at or under the ${rule.maxDelivered} `
          + `the rule derived on ${rule.derivedOn} (${rule.derivedIn}) allows`,
      action: 'deprecate',
    });
  }
  return out.sort((a, b) => (a.delivered - b.delivered) || a.id.localeCompare(b.id));
}

/**
 * **The bounded active set: what falls out when something comes in.**
 *
 * §9 adopts the principle and says the number *"is an OPEN QUESTION and must
 * not be invented"*. So the cap arrives as an argument and this build passes
 * none — `derivability` refuses to supply one while the population it would
 * bound is empty.
 *
 * **Human-authored items are not counted against the cap at all**, which is
 * the plan's own defensible reading: the corpus a person wrote is not what the
 * loop can inflate, and a cap that counted it would make somebody else's
 * writing the reason an agent's draft was stood down.
 *
 * Least-delivered first, oldest first among ties — the tie-break matters,
 * because equal delivery counts are the normal case in a young cohort and an
 * arbitrary order there would make the cap's answer depend on load order.
 */
export function overCap(
  items: Item[], got: Map<string, Contribution>, cap: number, now: number,
): RetirementCandidate[] {
  const counted = items.filter(retireable);
  if (counted.length <= cap) return [];
  const ranked = counted
    .map((item) => ({
      item,
      delivered: got.get(item.id)?.delivered ?? 0,
      age: ageDays(item, now),
    }))
    .sort((a, b) => {
      if (a.delivered !== b.delivered) return a.delivered - b.delivered;
      // Oldest first among ties. An item with no date sorts after every dated
      // one rather than winning the tie on a `null` read as zero.
      const ageA = a.age ?? -1;
      const ageB = b.age ?? -1;
      if (ageA !== ageB) return ageB - ageA;
      return a.item.id.localeCompare(b.item.id);
    });
  return ranked.slice(0, counted.length - cap).map((row) => ({
    id: row.item.id,
    delivered: row.delivered,
    ageDays: row.age,
    why: `${counted.length} item(s) of origin \`${RETIREABLE_ORIGIN}\` against a cap of ${cap} — `
      + `least delivered (${row.delivered}) of the set, so it is what falls out`,
    action: 'deprecate',
  }));
}

/**
 * **Is there a cut in this distribution, or only a slope?**
 *
 * A threshold is only a threshold if the values fall into two groups. The
 * measurement is the widest gap between adjacent sorted values against the
 * MEDIAN gap: a distribution with a real break has one gap many times the
 * typical spacing, and a smooth slope has none.
 *
 * **`below` and `of` are reported beside it and are the half that does the
 * refusing.** A widest gap that leaves nothing below it, or everything, is not
 * a threshold at all — it is a constant wearing one. On this corpus on
 * 2026-09-11 the widest gap in the per-chance rate was 76× the median spacing
 * and sat at the 45th percentile, which is a rule that would retire nearly
 * half the items that govern.
 */
export interface Separation {
  /** The widest adjacent gap, divided by the median gap. 0 when there is no spread. */
  widestGapRatio: number;
  /** The value the widest gap opens at, or `null` when fewer than two values. */
  cutAt: number | null;
  /** How many values fall below `cutAt`. */
  below: number;
  /** How many values there were. */
  of: number;
}

export function separation(values: number[]): Separation {
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length < 2) return { widestGapRatio: 0, cutAt: null, below: 0, of: sorted.length };
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]!);
  const ordered = gaps.slice().sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)]!;
  let widest = 0;
  let at = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i]! > widest) { widest = gaps[i]!; at = i + 1; }
  }
  return {
    // A median gap of 0 means most values are identical; the ratio is then
    // undefined and reported as 0 rather than as Infinity, because "every
    // value is the same" is the absence of separation, not an infinite amount
    // of it.
    widestGapRatio: median === 0 ? 0 : widest / median,
    cutAt: sorted[at] ?? null,
    below: at,
    of: sorted.length,
  };
}

/**
 * **Where the items the corpus PINS sit in a delivery ranking** — and the
 * check that killed every threshold considered on 2026-09-11.
 *
 * An `always: true` item is one the corpus decided must reach every session.
 * It is delivered at the pinned doors only (session start, subagent start,
 * compact restore) while an unpinned, unscoped item can also ride JIT, and JIT
 * is half of this log. So a delivery rate ranks items by WHICH DOOR THEY COME
 * THROUGH, and the pinned tier lands at the bottom of it.
 *
 * Measured: all 39 pinned items sit in the least-delivered 69 of 157; the
 * highest-rate pinned item (0.281) is below the unpinned median (0.357); and
 * of the twenty lowest-rate items seven are pinned, including
 * `CONST-zero-runtime-dependencies`, `CONST-node-24-no-build-step`,
 * `RULE-erasable-syntax-only` and `INV-nothing-is-dropped-silently`.
 *
 * **So a threshold drawn at the bottom of this distribution retires the
 * project's standing constraints**, and that is a property of the statistic
 * rather than of the corpus — which is why it is measured here on every run
 * instead of being recorded as a finding that was true once.
 */
export interface TierSkew {
  /** Values ranked, least first. */
  of: number;
  /** How many of them belong to pinned items. */
  pinned: number;
  /**
   * The best rank a pinned item reaches, 0 = least delivered, or `null` when
   * nothing is pinned. A pinned item near the TOP of the ranking is the
   * healthy shape; every pinned item in the bottom half is the broken one.
   */
  bestPinnedRank: number | null;
  /** Pinned items ranked in the least-delivered half. */
  pinnedInBottomHalf: number;
}

export function tierSkew(rows: { value: number; pinned: boolean }[]): TierSkew {
  const ranked = rows.slice().sort((a, b) => a.value - b.value);
  const pinnedRanks: number[] = [];
  ranked.forEach((row, rank) => { if (row.pinned) pinnedRanks.push(rank); });
  const half = Math.floor(ranked.length / 2);
  return {
    of: ranked.length,
    pinned: pinnedRanks.length,
    bestPinnedRank: pinnedRanks.length === 0 ? null : Math.max(...pinnedRanks),
    pinnedInBottomHalf: pinnedRanks.filter((r) => r < half).length,
  };
}

/**
 * **The load one door carried on one day** — the measurement behind "bound the
 * corpus", which is the half of §9 that is not about retirement.
 *
 * A corpus that only grows does not announce itself as spill. It announces
 * itself HERE: on 2026-09-11 the subagent-start door carried a mean of 21.5
 * items on 2026-08-26 and 78.6 on 2026-09-10 — 3.7× in sixteen days — while
 * spilling essentially nothing, because that door's budget is not binding.
 * Every delegated worker pays the growth in context, and nothing falls out.
 *
 * Spill is the OTHER shape and it is the JIT door's: 55–65% of everything
 * selected was cut for budget through early September. A bound derived from
 * spill alone would therefore have said the corpus was bounded at exactly the
 * door where it was growing fastest.
 */
export interface DoorLoad {
  op: string;
  day: string;
  records: number;
  /** Mean items delivered per record. */
  injected: number;
  /** Mean items cut for budget per record. */
  spilled: number;
}

export function payloadTrend(records: AuditRecord[]): DoorLoad[] {
  const rows = new Map<string, { op: string; day: string; n: number; i: number; s: number }>();
  for (const record of records) {
    if (record.kind !== 'injection') continue;
    const day = record.at.slice(0, 10);
    const key = `${record.op} ${day}`;
    const row = rows.get(key) ?? { op: record.op, day, n: 0, i: 0, s: 0 };
    row.n += 1;
    // `?? []` is ABSENCE, not zero — the reading `contributions` states: a
    // record written before a field existed and one whose list was empty are
    // both "this record names no id here".
    row.i += (record.injected ?? []).length;
    row.s += (record.spilled ?? []).length;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row): DoorLoad => ({
      op: row.op, day: row.day, records: row.n, injected: row.i / row.n, spilled: row.s / row.n,
    }))
    .sort((a, b) => (a.op === b.op ? a.day.localeCompare(b.day) : a.op.localeCompare(b.op)));
}

/**
 * Everything `derivability` reads, gathered in one place so the verdict is a
 * function of a record a report can print rather than of a corpus a reader has
 * to re-open.
 */
export interface RetirementEvidence {
  /** Items of origin `review` — the population a rule could ever touch. */
  population: number;
  /** Injectable items in the whole corpus, for scale. */
  injectable: number;
  /** Of `injectable`, how many no injection record has ever delivered. */
  neverDelivered: number;
  /** Of `injectable`, how many were spilled at least once and delivered never. */
  alwaysSpilled: number;
  /** Days between the first and last injection record. */
  windowDays: number;
  /** The shape of the exposure-corrected distribution over `injectable`. */
  separation: Separation;
  /** Where the pinned tier sits in that distribution. */
  skew: TierSkew;
}

/**
 * **A month, and it is the owner's number rather than one this file chose.**
 *
 * `TASK-retire-on-evidence-and-bound-the-corpus`: *"DO NOT START until the
 * baseline has at least a month of records behind it. A threshold derived from
 * a week is a threshold derived from noise."*
 */
export const MIN_WINDOW_DAYS = 30;

/** The verdict, and every reason behind it. */
export interface Derivability {
  derivable: boolean;
  /** One line per refusal, each carrying the number that refused. */
  because: string[];
}

/**
 * **May a retirement threshold be derived from this corpus today?**
 *
 * Every clause is a fact or the owner's own number — a zero, a whole
 * population, or `MIN_WINDOW_DAYS`. Nothing here is tuned, because a tuned
 * gate would be the invented threshold arriving one level up.
 */
export function derivability(evidence: RetirementEvidence): Derivability {
  const because: string[] = [];
  if (evidence.population === 0) {
    because.push(
      `no item of origin \`${RETIREABLE_ORIGIN}\` exists, so a threshold would be derived over an `
      + 'empty population and applied to nothing — there is no distribution to read',
    );
  }
  if (evidence.neverDelivered === 0) {
    because.push(
      `"never delivered" fires on nothing: 0 of ${evidence.injectable} injectable items has never `
      + 'been delivered, so the rule the design names is not a signal on this corpus',
    );
  }
  if (evidence.alwaysSpilled === 0) {
    because.push(
      '"always spilled" fires on nothing: no item was ever spilled without also being delivered '
      + 'at least once',
    );
  }
  if (evidence.windowDays < MIN_WINDOW_DAYS) {
    because.push(
      `the log covers ${evidence.windowDays} day(s) and the item requires at least `
      + `${MIN_WINDOW_DAYS} — "a threshold derived from a week is a threshold derived from noise"`,
    );
  }
  // The check that does the most work, and the one no paper would have
  // predicted: the bottom of the distribution is where the corpus keeps the
  // items it pins. See `TierSkew`.
  if (evidence.skew.pinned > 0 && evidence.skew.bestPinnedRank !== null
    && evidence.skew.bestPinnedRank < Math.floor(evidence.skew.of / 2)) {
    because.push(
      `the low tail is the PINNED tier: all ${evidence.skew.pinned} \`always: true\` items rank in `
      + `the least-delivered half of ${evidence.skew.of}, so any cut at the bottom of this `
      + 'statistic retires what the corpus decided must reach every session',
    );
  }
  if (evidence.separation.below === 0 || evidence.separation.below === evidence.separation.of) {
    because.push(
      'the widest gap in the distribution separates nothing: it leaves '
      + `${evidence.separation.below} of ${evidence.separation.of} below it, which is a constant `
      + 'rather than a threshold',
    );
  }
  return { derivable: because.length === 0, because };
}
