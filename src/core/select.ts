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
  /**
   * Item ids a previous session had, plus how to label where they came from —
   * the cross-session carry (§6n.2, plan Task 17).
   *
   * **It arrives here rather than being read here.**
   * `.my_context/items/invariant/INV-select-is-pure.md` ·
   * `- [invariant] select imports only types and config` · ~29 — this module
   * opens no seen file and no continuity file. `core/continuity.ts` resolves
   * both and hands the answer in.
   *
   * `label` is what a reader sees, never invented: the session's name when it
   * has one, its short prefix when it does not (`core/continuity.ts`).
   */
  carried?: { sessionId: string; label: string; ids: string[] } | null;
  /**
   * Continuity ids already delivered INTO THE CURRENT CONTEXT WINDOW — the
   * continuity tier's own dedupe, and deliberately NOT `seen`.
   *
   * **The distinction is the whole of the tier.** `seen` answers "has this
   * session ever been shown this item", which is the right question for every
   * other tier and the WRONG one here: a compaction REBUILDS the window, so
   * what it "already holds" is gone, and an item deduped on `seen` across a
   * compaction is a session that starts over with nothing — the exact failure
   * this tier exists to prevent. So the caller answers a narrower question,
   * keyed on the window rather than on the id: `continuityFor(seenState,
   * window)` (`core/seen-file.ts`), where the window is the compaction
   * snapshot's own `capturedAt` on a compact and a session-wide constant
   * otherwise — the same identity-marker comparison `restoredFor` makes, for
   * the same reason and through the same last-line-wins ledger.
   *
   * **It ARRIVES here rather than being read here**, exactly as `seen`,
   * `restore` and `carried` do: `INV-select-is-pure` — this module opens
   * no seen file.
   */
  continuityDelivered?: string[];
}

export interface SelectionEntry {
  item: Item;
  tier: 'pinned' | 'jit' | 'restored' | 'continuity';
}

export interface Spill {
  id: string;
  tier: SelectionEntry['tier'] | 'index';
  reason: string;
  /**
   * **Which BAND of its tier's candidates this item was offered in** — 1-based,
   * in the order the caller handed the bands to `fitToBudget`, and written
   * there rather than anywhere else.
   *
   * `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` made the
   * order of offers depend on a fact the spill record did not carry: on a tool
   * event band 1 is the items whose own globs match the path and band 2 is the
   * items that match only by having no scope at all. A reader who watches a
   * scoped item arrive and an unscoped one leave has no way to see why, and the
   * ruling itself says the answer belongs on screen — *"band membership is a
   * fact a screen can display beside each spilled item"*.
   *
   * **It is populated where the decision is taken.** The alternative — a screen
   * comparing `item.scope.length` against the event path — is a second
   * implementation of `matchesScope`'s banding, the two-spellings defect
   * `GateCode` exists to prevent, and it would answer for an item the selector
   * never even offered.
   *
   * **ABSENT unless the candidates were actually SPLIT**, which is `STD-absent-
   * vs-zero` and also what keeps the ruling's own property true. Where nothing
   * is scoped, band 1 is empty, every candidate is offered in one run, and the
   * spill records stay byte-identical to the single-band selector's — the
   * property the ruling was decided on, and the one
   * `test/core/select-jit-bands.test.ts` holds a verbatim pre-banding capture
   * against. A `band: 1` on every spill of every single-band tier would be a
   * number reporting a partition nobody made.
   *
   * The NUMBER travels; the meaning of each band belongs to the caller that
   * built them, and the screen names it there rather than here — `fitToBudget`
   * admits against a budget and knows nothing about scope.
   */
  band?: number;
}

/**
 * One line of the bounded index.
 *
 * `carried` is set — to `true`, never to `false` — only on a line a previous
 * session had. The key is ABSENT otherwise, deliberately: `IndexSummary` is
 * serialised verbatim by `/api/select` and compared field-for-field by the
 * golden tests, and a `carried: undefined` own property is a shape change
 * every consumer would see for a feature nobody switched on.
 */
export interface IndexLine {
  id: string;
  type: string;
  title: string;
  carried?: true;
}

/**
 * What a cross-session carry did to this index, in full — §6n.2's disclosure.
 *
 * Three numbers that cannot be re-derived from anywhere else, which is why
 * they are computed inside `buildIndex` rather than by whoever renders them:
 * `shown` is what actually ARRIVED (after the candidate filter and after the
 * budget), not what was sent; `dropped` names every carried id that got no
 * line AND why — `INV-nothing-is-dropped-silently` is the whole of this task —
 * and `displaced` names what the ordering cost.
 */
export interface CarriedSummary {
  sessionId: string;
  label: string;
  /** Carried ids that got a line, after the budget. */
  shown: number;
  /**
   * Carried ids that got no line, and why. Sorted by id.
   *
   * **`shown + dropped.length` is every id that was carried in**, and that
   * identity is the field's contract rather than a property it happens to
   * have: an id that is neither shown nor explained is exactly the silent drop
   * this summary exists to make impossible.
   */
  dropped: { id: string; reason: string }[];
  /**
   * §6n.2's cost, named: ids this session's own index WOULD have shown under
   * the by-id order and does not show under the carried-first order. Empty
   * whenever the index budget is not exhausted — which, on this repository's
   * own corpus, is always (Task 3's probe measured `F = 0` at every budget
   * from 1200 down to 470, and one displacement at 469). Computed, not
   * estimated — see `buildIndex`.
   */
  displaced: string[];
}

export interface IndexSummary {
  normative: IndexLine[];
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
  /**
   * The carry disclosure, or `null` when nothing was carried into this
   * selection — including on every event whose index tier does not run at all
   * (`tiersRun`: a tool event returns `emptyIndex()`, and there is no index for
   * a carry to reach).
   */
  carried: CarriedSummary | null;
}

/**
 * What the PINNED tier could not deliver, and what it would take to deliver it.
 *
 * **Only the pinned tier has one, and that is the whole of the field.** `jit`,
 * `restored` and `index` spill BY DESIGN — a JIT budget is a per-tool-call
 * bound, an index line is a title rather than a promise — and their spilling is
 * already drawn. Pinned is the tier whose entire semantics is *always*, so a
 * partial delivery is the only one that reads as a kept promise while being a
 * broken one. Widening this to the other three would make it a routine line,
 * and a routine line is how the one tier that matters stops being heard.
 *
 * **Every field here is one `Selection.spilled` cannot answer.** The ids are in
 * `spilled` already, mixed with three tiers whose spills are ordinary; the two
 * numbers are nowhere at all. `Spill.reason` carries a running total in
 * English, so a surface that wanted "what does this tier cost" would have to
 * parse a sentence apart — a second implementation of this file's arithmetic,
 * breaking the day someone improves the wording. Produced here, once, where the
 * candidates and their costs are already in hand.
 *
 * `null` on `Selection` means *nothing pinned was dropped*, which covers both a
 * tier that fitted and a tier that never ran (`tiersRun`). Those are different
 * facts, and this field deliberately does not distinguish them: the disclosure
 * is about undelivered items, and neither case has any.
 */
export interface PinnedSpill {
  /**
   * The pinned items that did not fit, in `fitToBudget`'s own priority order —
   * hard severity first, then project layer, then id. The order IS information:
   * the first name is the most important thing this session did not get. Sorted
   * by id it would read as a list; left as the selector ranked it, it reads as
   * a loss.
   */
  ids: string[];
  /**
   * The estimated tokens the WHOLE pinned candidate set costs — admitted plus
   * spilled — not the part that was admitted.
   *
   * It is the honest answer to "what does honouring `always` cost here", which
   * is the number a person raising the budget needs. `Selection.tokens` is the
   * other number and stays what it is: what was actually charged.
   */
  cost: number;
  /** `config.budgets.pinned` — the figure `cost` was measured against. */
  budget: number;
}

/**
 * What the CONTINUITY tier could not deliver, and what it would take to
 * deliver it — `PinnedSpill`'s shape, for a tier whose spill is louder still.
 *
 * **There is no acceptable silent overflow on this tier.** The defect this
 * whole feature exists to fix is precisely *a guarantee believed to be in force
 * that silently was not*: the handover document cost 37,831 estimated tokens
 * against a largest budget of 24,000, was delivered on no event, and nothing
 * said so. A continuity tier that quietly drops its payload reproduces that
 * defect with a longer fuse — so this disclosure is produced here, rendered as
 * its own sentence in the injected block (`render.ts`), and reported as a
 * `doctor` finding (`doctor/checks.ts`, `continuity_overflow`).
 *
 * The tier's content is meant to be a pointer plus a bounded digest, so this
 * should never fire. "Should never happen" is not a behaviour, which is why it
 * is built rather than assumed.
 *
 * `null` means *nothing continuity-marked was dropped* — covering both a tier
 * that fitted and a tier that never ran (`tiersRun`), exactly as
 * `PinnedSpill` does and for the same reason.
 */
export interface ContinuitySpill {
  /** The continuity items that did not fit, in `fitToBudget`'s priority order. */
  ids: string[];
  /** What the WHOLE continuity candidate set costs — admitted plus spilled. */
  cost: number;
  /** `config.budgets.continuity` — the figure `cost` was measured against. */
  budget: number;
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
  /**
   * The pinned tier's undelivered items, or `null` when it delivered every one
   * it was asked for (including when it was asked for none). See `PinnedSpill`.
   */
  pinnedSpill: PinnedSpill | null;
  /**
   * The continuity tier's undelivered items, or `null` when it delivered
   * every one it was asked for (including when it was asked for none, and when
   * it never ran). See `ContinuitySpill`.
   */
  continuitySpill: ContinuitySpill | null;
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
 * The exemptions live here, in the predicate, rather than in each caller — so
 * no surface can narrow the corpus past them by forgetting.
 *
 * ── TWO EXEMPTIONS, AND THEY ARE NOT THE SAME EXEMPTION ─────────────────────
 *
 * `severity: hard` says an item MUST NOT BE VIOLATED. `always: true` says an
 * item MUST NOT FALL OUT OF CONTEXT. They answer different questions and an
 * item can carry either without the other, which is exactly how the second one
 * came to be missing: the first was written, it read like "the important ones
 * are safe", and nobody asked which sense of important.
 *
 * **Measured 2026-08-27.** A focus set on 2026-08-24 with `tags: plan:walk`
 * hid SIX soft-severity pinned items for three days. Among them
 * `INSTR-use-my-context-for-everything…` and
 * `INSTR-query-and-display-the-task-item…` — the instruction to use the product
 * for every fitting category was itself hidden by the product, and nothing said
 * so. The absence was found by counting what should have been injected against
 * what was, not by anything reporting it.
 *
 * That also contradicted a ruling the owner had already given: pinned items are
 * first priority to stay in context, to the point that a budget which cannot
 * fit them should prompt the user to raise it. A focus silently removing them
 * broke that at the one moment it mattered.
 *
 * Owner ruling 2026-08-27,
 * `DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always`: a focus
 * is a lens for narrowing attention, not a mechanism for suppressing what was
 * pinned precisely so it would never fall out.
 *
 * **Written as two statements rather than one `||`.** They are independent
 * rules with independent reasons, and a single collapsed condition is one a
 * later edit can drop wholesale while appearing to simplify. `test/core/`
 * covers each separately for the same reason.
 */
export function focusHides(item: Item, focus: Focus | null, config: Config): boolean {
  if (!isFocusActive(focus)) return false;
  if (item.severity === 'hard') return false;
  if (item.always) return false;
  // A THIRD exemption, for the reason the other two exist and one of its own:
  // focus narrows what a session is shown, and the continuity tier's whole
  // promise is that the next session does not start over. A narrowing that
  // silently suppressed it would be the defect the tier was built to end,
  // wearing a feature's name. Disclosed, never assumed — `exemptContinuity`.
  if (item.continuity) return false;
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
  return {
    normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {},
    carried: null,
  };
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

/**
 * First-fit admission against one budget, over candidates supplied in BANDS.
 *
 * **Bands are a stable partition, never a sort.** Each band is sorted by
 * `byPriority` exactly as a single candidate list always was, and the bands
 * are then considered in the order the caller passed them — band 0 first, and
 * every one of its members before any member of band 1. A caller with nothing
 * to band passes `[candidates]`, which is byte-for-byte the previous
 * behaviour: one band is indistinguishable from no bands.
 *
 * **One budget, one `used`, one implementation.** The bands share the running
 * total, so a later band sees only what the earlier ones left and every spill
 * reason is still measured against the tier's real configured budget rather
 * than a remainder nobody set. Calling this once per band with a subtracted
 * budget would admit the same items and then describe them with figures that
 * appear nowhere in the config — and `preview.js`'s header is explicit that no
 * second implementation of `fitToBudget` may exist to reconcile.
 *
 * The only caller that passes more than one band today is the JIT tier
 * (`DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`).
 *
 * **A spill records the band it was offered in** — `Spill.band`, 1-based, and
 * only when more than one band actually held candidates. It is written here
 * because here is where the position is known: a surface re-deriving it from
 * an item's scope and the event path would be a second implementation of the
 * caller's partition, and would answer for items this function never saw.
 */
function fitToBudget(
  bands: Item[][], budget: number, tier: SelectionEntry['tier'],
): { entries: SelectionEntry[]; spilled: Spill[]; used: number } {
  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];
  let used = 0;

  // **`Spill.band` is written only where a partition actually happened**, and
  // "happened" is measured on the bands that HOLD something rather than on how
  // many were passed. One populated band is one run of candidates however the
  // caller spelled it, so an unscoped corpus — band 1 empty — still produces
  // the single-band selector's records byte for byte, which is the property
  // `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` was decided
  // on. See `Spill.band`.
  const partitioned = bands.filter((band) => band.length > 0).length > 1;

  // `[...band]` per band, never a sort in place: `fitToBudget` and `buildIndex`
  // sort copies and never the caller's array. Nested rather than flattened
  // since the band INDEX is now part of what a spill records; the order of
  // consideration is unchanged — every member of band 0, then every member of
  // band 1, each band sorted by `byPriority` on its own.
  for (const [index, band] of bands.entries()) {
    for (const item of [...band].sort(byPriority)) {
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
          ...(partitioned ? { band: index + 1 } : {}),
        });
        continue;
      }
      used += cost;
      entries.push({ item, tier });
    }
  }

  // `used` is returned, not recomputed by the caller: it is the exact figure
  // the admissions above were decided against, and `Selection.tokens` promises
  // that figure — not a second derivation that merely agrees today.
  return { entries, spilled, used };
}

/**
 * The three statuses that mean "finished with", as the session banner's
 * `retired` tally has always counted them.
 *
 * Exported since `mycontext todo` hides exactly this set by default and says
 * how many it hid. A second `new Set([...])` in that command would be a
 * fourth status drifting into one list and not the other — the same
 * two-hand-kept-expressions defect `filterItems` (core/search.ts) exists to
 * avoid — and the number the inbox discloses has to be the number the banner
 * would have counted.
 */
export const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);

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

/** One index line, with the cost it was measured at. Costed exactly once. */
interface IndexCandidate {
  line: IndexLine;
  cost: number;
}

/**
 * The index's greedy budget pass, over one ORDER of the same candidates.
 *
 * Extracted from `buildIndex` because §6n.2 needs it run twice — once in the
 * by-id order and once carried-first — to name what the carried-first ruling
 * cost. Both runs see the same `IndexCandidate` objects and therefore the same
 * per-line costs; only the order differs.
 *
 * **First-fit, not a prefix.** An over-budget line is skipped (`continue`, not
 * `break`) so a later, smaller line can still be admitted after a larger one
 * has spilled — the same rule `fitToBudget` uses for the full-text tiers. That
 * is exactly why the displaced set below has to be COMPUTED: the admitted set
 * is not a prefix of the order, so it cannot be inferred from a count.
 */
function fitIndexOrder(order: IndexCandidate[], budget: number): {
  admitted: IndexCandidate[];
  overflow: { line: IndexLine; attempted: number }[];
  used: number;
} {
  const admitted: IndexCandidate[] = [];
  const overflow: { line: IndexLine; attempted: number }[] = [];
  let used = 0;
  for (const candidate of order) {
    if (used + candidate.cost > budget) {
      overflow.push({ line: candidate.line, attempted: used + candidate.cost });
      continue;
    }
    used += candidate.cost;
    admitted.push(candidate);
  }
  return { admitted, overflow, used };
}

/**
 * Why a carried id got no index line — `INV-nothing-is-dropped-silently`, at
 * the one place that can still tell the reasons apart.
 *
 * An item the previous session relied on and this one will not see must be
 * VISIBLE, not absent, and "absent" is what every one of these becomes if the
 * reasons are collapsed into a single "not carried" or left to the caller to
 * guess from the corpus.
 *
 * The order is not interchangeable. `chosenIds` is tested first because it is
 * the only reason that is about THIS session rather than about the item, and
 * it is the only one that fires on this repository's own corpus (Task 3: all
 * seven dropped ids are the seven pinned items). The last branch is the
 * residual and is reachable only under an active focus: the item is eligible,
 * normative and undelivered, so the only thing that kept it out of `eligible`
 * is the narrowing the user asked for. Calling that "no longer eligible" would
 * be a false label on a live item, which is a silent drop wearing a badge.
 *
 * **Five reasons live here and a sixth does not.** `over the index budget` is
 * decided by the caller, because it is the only one that is not about the item
 * at all — the item was a perfectly good candidate and the budget ran out. This
 * function answers "why was it never a candidate"; asking it to also know
 * whether a candidate fitted would hand it the budget pass's result for no
 * gain.
 */
function carriedDropReason(
  id: string, item: Item | undefined, config: Config, chosenIds: Set<string>,
): string {
  if (chosenIds.has(id)) return 'delivered in full this session';
  if (item === undefined) return 'unknown id';
  if (!isNormative(item, config)) return 'not a normative category';
  if (!isEligible(item, config)) return 'no longer eligible';
  return 'hidden by the active focus';
}

function buildIndex(
  eligible: Item[], all: Item[], config: Config, chosenIds: Set<string>,
  carried: SelectContext['carried'],
): { summary: IndexSummary; spilled: Spill[]; used: number } {
  // An item already selected in full (any tier) needs no index line — Claude
  // already has the complete rule, so listing it would spend index budget on
  // redundancy and push genuinely unseen items behind "+N more". These items
  // are deliberately omitted, not truncated: they never enter the candidate
  // list below, so they can't consume budget or spill.
  const normativeItems = eligible
    .filter((i) => isNormative(i, config) && !chosenIds.has(i.id))
    .sort((a, b) => compareStrings(a.id, b.id));

  const carriedIds = new Set(carried?.ids ?? []);

  // Costed ONCE per candidate, marker included. Both budget passes below read
  // these numbers: a carried line costs the same in either order, because the
  // flag is a property of the item and not of its position.
  const candidates: IndexCandidate[] = normativeItems.map((item) => {
    const line: IndexLine = carriedIds.has(item.id)
      ? { id: item.id, type: item.type, title: item.title, carried: true }
      : { id: item.id, type: item.type, title: item.title };
    return { line, cost: estimateTokens(renderIndexLine(line)) };
  });

  // §6n.2's ordering, and it is two lines on purpose. Front-of-queue is what
  // makes a carry do anything at all on an exhausted index; swapping these two
  // `filter` calls reverses it and makes carry a no-op whenever `budgets.index`
  // is already full, which is the defect this project names most often. The
  // swap is written down here so a future reversal is a known one-line edit
  // rather than an excavation — NOT as an option this implementation may take.
  // Reversing it contradicts §6n.2 and needs a spec change.
  const ordered = carriedIds.size === 0 ? candidates : [
    ...candidates.filter((c) => c.line.carried),
    ...candidates.filter((c) => !c.line.carried),
  ];

  // Enforce config.budgets.index over the enumerated normative lines. What
  // doesn't fit is recorded as `truncated` (a "+N more" indication for the
  // renderer) and as `spilled` entries with tier 'index', so it never
  // disappears silently.
  const budget = config.budgets.index;
  const fitted = fitIndexOrder(ordered, budget);

  // **The second half of §6n.2, and the half a plan usually loses.** Reordering
  // the same candidates under the same budget changes WHICH lines fit, so a
  // non-carried line the by-id order would have shown can now miss. The same
  // greedy budget is run a second time in the by-id order and the difference is
  // taken exactly: `displaced = admitted(by-id) \ admitted(carried-first)`. The
  // second pass is discarded — it exists only to name what the ruling cost, and
  // it is one extra loop over numbers already in hand: no second render, no
  // second token estimate, nothing read from disk. A cheaper approximation is
  // not available, because `fitIndexOrder` continues rather than breaks on an
  // overflow, so the admitted set is not a prefix of the order.
  //
  // Skipped entirely when nothing was carried: the two orders are then the same
  // array, so the difference is empty by construction and the pass would be
  // pure cost on the injection-critical path.
  const displaced: string[] = [];
  if (carriedIds.size > 0) {
    const admittedNow = new Set(fitted.admitted.map((c) => c.line.id));
    for (const candidate of fitIndexOrder(candidates, budget).admitted) {
      if (!admittedNow.has(candidate.line.id)) displaced.push(candidate.line.id);
    }
  }
  const displacedIds = new Set(displaced);

  // The displaced line spills at tier 'index' exactly as any other index miss
  // does — no fifth budget, no new channel — and its reason NAMES THE CARRY
  // rather than the budget alone. `core/render.ts` ·
  // `.filter((g) => !(g.tiers.length === 1 && g.tiers[0] === 'index'));` · ~59
  // keeps an index-only spill out of the rendered spill note, so on that path
  // this reason reaches `--json` and the web UI but not the model: the rendered
  // *why* is the carry disclosure line Task 19 writes, which reads
  // `IndexSummary.carried.displaced` rather than parsing this string apart.
  const spilled: Spill[] = fitted.overflow.map(({ line, attempted }) => ({
    id: line.id,
    tier: 'index' as const,
    reason: displacedIds.has(line.id)
      ? `displaced by a line carried from session ${carried?.label} ` +
        `(index budget exceeded: ${attempted} > ${budget} estimated tokens)`
      : `index budget exceeded (${attempted} > ${budget} estimated tokens)`,
  }));

  const normative = fitted.admitted.map((c) => c.line);
  const used = fitted.used;

  // **Every carried id that got no line says why — the identity being kept is
  // `shown + dropped.length === carried.ids.length`.**
  //
  // The test is against the ADMITTED lines, not against candidacy, and that is
  // the correction rather than a detail. Skipping every candidate left a real
  // hole: a carried line is at the FRONT of `fitIndexOrder`, not exempt from
  // it, so on an exhausted index a carried candidate can overflow — and such an
  // id had no line, no reason, and reached the reader only as an anonymous unit
  // of "+N more". That is `INV-nothing-is-dropped-silently` failing inside the
  // feature written to enforce it.
  //
  // It is a sixth REASON rather than a fourth field, so the shape every surface
  // reads stays "one list of ids that got no line, each with why" — one string
  // table key in the UI, one clause in the rendered disclosure.
  const byId = new Map(all.map((i) => [i.id, i]));
  const admittedIds = new Set(normative.map((line) => line.id));
  const candidateIds = new Set(candidates.map((c) => c.line.id));
  const dropped: { id: string; reason: string }[] = [];
  for (const id of [...carriedIds].sort(compareStrings)) {
    if (admittedIds.has(id)) continue;
    dropped.push({
      id,
      reason: candidateIds.has(id)
        ? 'over the index budget'
        : carriedDropReason(id, byId.get(id), config, chosenIds),
    });
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
    summary: {
      normative,
      counts,
      drafts,
      retired,
      truncated: spilled.length,
      ineligible,
      // `shown` is counted off the ADMITTED lines, never off the input length:
      // §6g's condition is that the count is what actually arrived, after the
      // candidate filter and after the budget.
      carried: carried == null ? null : {
        sessionId: carried.sessionId,
        label: carried.label,
        shown: normative.filter((line) => line.carried).length,
        dropped,
        displaced,
      },
    },
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
  const exemptAlways: string[] = [];
  const exemptContinuity: string[] = [];
  for (const item of universeItems) {
    if (focusHides(item, focus, config)) {
      hidden.push(item);
      continue;
    }
    visible.push(item);
    if (matchesFocus(item, focus, config)) continue;
    // Reported under ONE heading each, and `hard` wins when an item is both.
    // Two lines naming the same id would read as two items kept, and the whole
    // point of these lists is that the counts are trustworthy.
    if (item.severity === 'hard') exemptHard.push(item.id);
    else if (item.always) exemptAlways.push(item.id);
    else if (item.continuity) exemptContinuity.push(item.id);
  }

  return {
    axes: { tags: focus.tags, categories: focus.categories, scope: focus.scope },
    universe: pathUniverse === null ? 'corpus' : 'path',
    hidden: hidden.map((i) => i.id).sort(compareStrings),
    visible: visible.length,
    exemptHard: exemptHard.sort(compareStrings),
    exemptAlways: exemptAlways.sort(compareStrings),
    exemptContinuity: exemptContinuity.sort(compareStrings),
    dangling: danglingEdges(visible, hidden),
  };
}

/**
 * The JIT target: the normalized path the `jit` tier matches scopes against,
 * or `''` when this event has none. `select` and `tiersRun` share it so the
 * question "does the jit tier run" has one answer and not two.
 */
function jitTarget(ctx: SelectContext): string {
  return ctx.event === 'tool' && ctx.path ? normalizePosix(ctx.path) : '';
}

/**
 * The gates an item passes on its way into a session, in the order `select`
 * puts them, plus the state of an item that cleared all six — as CODES, so a
 * surface can name the gate that bound without reading English.
 *
 * The order is this file, read downwards. `select` narrows with `isEligible`
 * first (`eligibleAll`), then `isNormative` (`injectable`), then `focusHides`
 * (`eligible`), then each tier's own predicate — `matchesScope` on the jit
 * tier — then the `seen` filter (`fresh`), and `fitToBudget` last. It is the
 * same order `injection()` (`cli/commands/injection.ts`) walks, which is the
 * only thing that makes that function's phrase true, and the order the
 * injection preview draws its ladder in (`docs/design/web-ui-mockup.html`,
 * `#gates` / `preview.whyn`).
 *
 * **A code BESIDE the sentence, never instead of it and never a second
 * derivation of it.** `Spill.reason` and `injection()`'s `phrase` are
 * unchanged: they are what the CLI prints and what a human reads. What no read
 * model could say before is WHICH gate an item first failed, and a screen that
 * answered by parsing those sentences would be a second implementation of this
 * file's decision — one that breaks the day someone improves the wording. So
 * it is a second FIELD, written by the same branch that writes the sentence.
 *
 * **Nothing here decides anything.** These are names for decisions the
 * functions above already take. A `GateCode` is only ever attached at the
 * branch that took the decision, never re-derived from the item afterwards —
 * a second `if` chain over the same fields is exactly the two-spellings defect
 * this project has paid for most often.
 *
 * `passed` is a member rather than an absence for the same reason `tiersRun`
 * exists: "cleared every gate" and "no gate was asked" are different facts,
 * and a nullable code would collapse them.
 */
export type GateCode = 'eligible' | 'tier' | 'focus' | 'scope' | 'seen' | 'budget' | 'passed';

/**
 * Each gate's RUNG — its 1-based position on the ladder, which is the whole of
 * what the ladder shows: the mockup's `preview.whyn` says *"the order is the
 * explanation … the one that binds is only meaningful in the position it
 * holds"*. `passed` holds no rung and is `null` rather than a seventh number:
 * an item that cleared the ladder failed nothing, and a 0 or a 7 would be a
 * position on it.
 *
 * **`Record<GateCode, …>` rather than a list of the six**, for the reason
 * `core/trust.ts` · `export const GOVERNING_STATUS: Record<Status, boolean> = {` · ~350
 * is a Record: a seventh gate added to the union fails to compile HERE, where
 * a list would keep compiling and answer `undefined` for it — a ladder drawn
 * with a rung missing and nothing saying so.
 */
export const GATE_RUNG: Record<GateCode, number | null> = {
  eligible: 1,
  tier: 2,
  focus: 3,
  scope: 4,
  seen: 5,
  budget: 6,
  passed: null,
};

/**
 * The ladder: the six gates in rung order, DERIVED from `GATE_RUNG` rather
 * than written out a second time beside it. Two spellings of one order is how
 * an order drifts, and here the order is the explanation.
 */
export const GATE_LADDER: GateCode[] = (Object.keys(GATE_RUNG) as GateCode[])
  .filter((code) => GATE_RUNG[code] !== null)
  .sort((a, b) => GATE_RUNG[a]! - GATE_RUNG[b]!);

/**
 * Which tiers this event actually reaches — `select`'s own dispatch, named.
 *
 * **A tier that does not run is a different fact from a tier that ran and
 * delivered nothing**, and `Selection` cannot tell them apart: a tier which
 * runs with no candidates contributes no entry to `full` and no record to
 * `spilled`, exactly like a tier that never ran. The web UI's budget ribbon
 * draws the first as absent-and-named and the second as an empty track (web-UI
 * plan 1, §0.3 row 3), so it needs this stated rather than inferred.
 *
 * It is exported instead of re-derived by the caller for the reason `itemCost`
 * is: a browser (or a server route) reconstructing "pinned and continuity run
 * on session-start, compact and manual; restored only on compact; jit only on a
 * tool event with a path; the bounded index on everything but tool" has
 * re-implemented this file's dispatch, and the copy drifts the first time the
 * dispatch changes. `select` below consumes this function for its own
 * branching, so there is one statement of the rule and no second place to
 * update.
 *
 * The array is in `select`'s run order — pinned, continuity, restored, jit,
 * index — which is the order the budgets are spent in. A caller drawing fixed tracks reads
 * it as a membership test; the order is a disclosure, not a layout.
 */
export function tiersRun(ctx: SelectContext): Spill['tier'][] {
  const tiers: Spill['tier'][] = [];
  if (ctx.event === 'session-start' || ctx.event === 'compact' || ctx.event === 'manual') {
    tiers.push('pinned');
    // The same three events as `pinned`, and NEVER `'tool'`. A tool event is
    // narrow by construction — that is what the JIT tier is — and continuity is
    // the opposite of narrow: it answers "what does the next session need in
    // order not to start over", which no file path can scope. `'manual'` is a
    // session start under another name (`inject.ts`: *"select treats 'manual'
    // exactly as it treats a session start"*) and carries the tier for that
    // reason and no other.
    tiers.push('continuity');
  }
  if (ctx.event === 'compact') tiers.push('restored');
  if (jitTarget(ctx) !== '') tiers.push('jit');
  // The bounded index is a per-session cost, not a per-tool-call cost.
  if (ctx.event !== 'tool') tiers.push('index');
  return tiers;
}

export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const tiers = tiersRun(ctx);
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

  // What the pinned tier was ASKED for, priced. `null` while the tier has not
  // run — which is not the same as 0, and `pinnedSpillOf` below relies on the
  // difference: a tool event never runs this tier, and a tier that did not run
  // has no cost rather than a cost of nothing (`STD-absent-vs-zero`).
  let pinnedCost: number | null = null;
  /** The same, for the continuity tier — see `continuitySpillOf`. */
  let continuityCost: number | null = null;

  if (tiers.includes('pinned')) {
    const candidates = fresh.filter((i) => i.always);
    // Priced over the CANDIDATES, before the budget sees them, so the figure is
    // what honouring `always` would cost rather than what was affordable. Each
    // item is costed twice on this path (here and inside `fitToBudget`), which
    // is one extra `renderItemBlock` per pinned item on the injection-critical
    // path; measured against threading a second return value out of
    // `fitToBudget` — which every other tier would then carry for a disclosure
    // only this one has — the duplicate arithmetic is the smaller cost and the
    // one that leaves `fitToBudget` a single-purpose function.
    pinnedCost = candidates.reduce((sum, i) => sum + itemCost(i), 0);
    const result = fitToBudget([candidates], config.budgets.pinned, 'pinned');
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  // THE CONTINUITY TIER. Second in the run order, after `pinned` and before
  // everything else, because it is the tier that answers "what does the next
  // session need in order not to start over" and it competes for nothing: it
  // has its own budget (`DEC-continuity-gets-its-own-budget-and-the-item-it-
  // holds-must-be`), so its position costs no other tier a token.
  //
  // THREE THINGS HERE ARE DIFFERENT FROM EVERY OTHER TIER, AND EACH IS THE
  // POINT OF THE TIER:
  //
  //  1. **It draws from `eligible`, not from `injectable`.** Every other
  //     full-text tier is gated on `isNormative` — the GOVERNANCE tier — and
  //     that gate is right for them: they all answer "what governs this work".
  //     Continuity answers a different question, and the decision that created
  //     this tier rejected category as its axis in as many words, because
  //     "categories carry a governance tier already and overloading them
  //     couples two unrelated axes". The item this tier exists for is a
  //     `reference`, which is rationale-tier by catalogue; gating here would
  //     have shipped a tier that could never deliver the one item it was built
  //     to deliver, and would have done it silently. See `Item.continuity`.
  //
  //  2. **It does not consult `fresh`.** `fresh` is `injectable` minus
  //     `seen`, and `seen` answers "has this SESSION ever been shown this
  //     item" — the right question everywhere else and the wrong one here. A
  //     compaction REBUILDS the window: what it "already holds" is gone, and an
  //     item deduped on `seen` across a compaction is a session that starts
  //     over with nothing, which is the exact failure this tier prevents. The
  //     dedupe is `ctx.continuityDelivered` instead, which its caller keys on
  //     the window (`snapshot.capturedAt` on a compact) and never on id alone.
  //
  //  3. **Its overflow is LOUD** — `continuitySpill` below, a sentence of its
  //     own in the injected block, and a `doctor` finding.
  //
  // `alreadyChosen` is consulted because `pinned` runs on the same three
  // events: an item that is both `always` and `continuity` arrives once,
  // through whichever tier reached it first, and is not rendered twice.
  if (tiers.includes('continuity')) {
    const delivered = new Set(ctx.continuityDelivered ?? []);
    const alreadyChosen = new Set(entries.map((e) => e.item.id));
    const candidates = eligible.filter(
      (i) => i.continuity && !delivered.has(i.id) && !alreadyChosen.has(i.id),
    );
    // Priced over the CANDIDATES, before the budget sees them, for
    // `pinnedCost`'s reason: the figure a person raising the budget needs is
    // what honouring `continuity` would cost, not what was affordable.
    continuityCost = candidates.reduce((sum, i) => sum + itemCost(i), 0);
    const result = fitToBudget([candidates], config.budgets.continuity, 'continuity');
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  if (tiers.includes('restored')) {
    const restoreIds = new Set(ctx.restore ?? []);
    const alreadyChosen = new Set(entries.map((e) => e.item.id));
    const result = fitToBudget(
      [fresh.filter((i) => restoreIds.has(i.id) && !alreadyChosen.has(i.id))],
      config.budgets.restored,
      'restored',
    );
    entries.push(...result.entries);
    spilled.push(...result.spilled);
    tokens += result.used;
  }

  const target = jitTarget(ctx);
  if (tiers.includes('jit')) {
    // THE JIT TIER OFFERS PATH-SCOPED ITEMS FIRST, IN TWO BANDS
    // (`DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`).
    //
    // `matchesScope` answers one question — "does this item apply to this
    // path" — and that answer is still exactly right. What it cannot say, and
    // must not be made to say, is WHY: an item declaring `reports/**` on the
    // path `reports/V2-HANDOVER.md` and an item declaring nothing at all both
    // arrive here as `true`, and used to reach the budget indistinguishable.
    // Measured on the real corpus (619 of 621 items unscoped): the one item
    // scoped to that path SPILLED while 27 items about nothing in particular
    // were delivered. The corpus asks people to record scope and then
    // discarded the record at the one place it could matter.
    //
    // So the banding lives HERE, in the caller, and the predicate keeps its
    // boolean. Band 1 is the items whose own globs match; band 2 is the items
    // that match only by having no scope at all. Band 1 gets first refusal —
    // which is what the person who wrote the glob was asking for — and band 2
    // still competes for everything band 1 left, on the same first-fit terms.
    // Nothing is demoted; the order of offers changed, not the rules.
    //
    // TWO DEGENERATIONS, both load-bearing and both covered by tests:
    //
    //  - **No scoped items** (every real corpus before it starts scoping, and
    //    the property this whole ruling was decided on): band 1 is empty, so
    //    the admitted set, its order, the spill records and their reason
    //    strings are byte-identical to the single-band behaviour. The change
    //    cannot regress a corpus that does not use scope.
    //  - **`scopePolicy: 'inert'`**: an unscoped item matches NO path, so it
    //    never reaches this filter and band 2 is empty by construction. The
    //    policy is untouched and needs no rule of its own here.
    //
    // The cost, stated rather than discovered later: a corpus that BEGINS
    // scoping will see its delivered set change on tool events, with unscoped
    // items displaced by scoped ones. That is the intent, and it is still a
    // real behaviour change — it belongs beside each row of the preview's
    // spilled-items list, so a reader can see WHY an item lost.
    const candidates = fresh.filter((i) => matchesScope(i, target, config));
    const result = fitToBudget(
      [
        candidates.filter((i) => i.scope.length > 0),
        candidates.filter((i) => i.scope.length === 0),
      ],
      config.budgets.jit, 'jit',
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

  /**
   * The pinned disclosure, built from the FINAL spill list rather than from the
   * pinned tier's own — and that ordering is the correctness of it, not a
   * detail. On a compaction the `restored` tier runs AFTER pinned with its own
   * budget, so an item that spilled from pinned can still reach the session;
   * `trueSpills` has already dropped its record by the time this runs. Naming
   * an item that arrived would be a false alarm on the one channel this whole
   * feature needs to stay credible.
   *
   * **Fires on any spill, not only on a total one.** Seven of twenty-three is a
   * partial `always`, and a partial `always` is precisely the failure that reads
   * as success. A threshold here would be the defect wearing the fix's name.
   */
  const pinnedSpillOf = (final: Spill[]): PinnedSpill | null => {
    if (pinnedCost === null) return null;
    const ids = final.filter((s) => s.tier === 'pinned').map((s) => s.id);
    if (ids.length === 0) return null;
    return { ids, cost: pinnedCost, budget: config.budgets.pinned };
  };

  /**
   * The continuity disclosure, built from the FINAL spill list — `pinnedSpillOf`'s
   * reasoning, verbatim: a later tier can retroactively falsify an earlier
   * tier's spill, and naming an item that actually arrived would be a false
   * alarm on the one channel this feature needs to stay credible.
   *
   * **Fires on any spill, not only a total one**, for `PinnedSpill`'s reason:
   * a partial continuity delivery is precisely the failure that reads as
   * success.
   */
  const continuitySpillOf = (final: Spill[]): ContinuitySpill | null => {
    if (continuityCost === null) return null;
    const ids = final.filter((sp) => sp.tier === 'continuity').map((sp) => sp.id);
    if (ids.length === 0) return null;
    return { ids, cost: continuityCost, budget: config.budgets.continuity };
  };

  // The bounded index — and its own budget accounting inside buildIndex — is
  // a per-session cost, not a per-tool-call cost (`tiersRun`).
  if (!tiers.includes('index')) {
    const finalSpilled = trueSpills(spilled);
    return {
      full: entries, index: emptyIndex(), spilled: finalSpilled,
      pinnedSpill: pinnedSpillOf(finalSpilled),
      continuitySpill: continuitySpillOf(finalSpilled),
      focus: focusReport,
      tokens,
    };
  }
  const { summary: index, spilled: indexSpilled, used: indexUsed } =
    buildIndex(eligible, merged, config, chosenIds, ctx.carried ?? null);
  const finalSpilled = trueSpills([...spilled, ...indexSpilled]);
  return {
    full: entries,
    index,
    spilled: finalSpilled,
    pinnedSpill: pinnedSpillOf(finalSpilled),
    continuitySpill: continuitySpillOf(finalSpilled),
    focus: focusReport,
    tokens: tokens + indexUsed,
  };
}
