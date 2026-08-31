export type Tier = 'normative' | 'rationale';
export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';
export type Severity = 'hard' | 'soft';
export type Origin = 'human' | 'agent' | 'ingest';
export type Layer = 'project' | 'global';

/**
 * What an agent's edit to an item's *content* (title, body, observations,
 * tags) does: apply immediately, or become a revision a human must promote.
 * Per-category config, resolved on `ResolvedCategory` (config.ts).
 */
export type AgentEdits = 'allow' | 'review';

/**
 * What an item with *no scope* means: injects everywhere, is refused at
 * capture until a scope is given, or is never JIT-injected at all.
 * Per-category config, resolved on `ResolvedCategory` (config.ts).
 */
export type ScopePolicy = 'global' | 'required' | 'inert';

export interface Observation {
  category: string;
  text: string;
  tags: string[];
  context: string | null;
}

export interface Relation {
  type: string;
  target: string;
}

/**
 * One line of a `## Steps` section.
 *
 * The field is on `Item` rather than on one category, because `parseItem` is
 * handed a file and a layer and never a `Config` — it cannot know what type
 * it is reading until it has read it. `procedure` is the category the
 * product documents, seeds and commands around steps (spec §6o); nothing
 * refuses them elsewhere.
 *
 * `checked` exists because Markdown is the source of truth and a person may
 * tick a box in the file by hand; it round-trips so that doing so is not
 * destroyed by the next write. **Nothing in this product ever sets it.**
 * Progress made through `mycontext procedure step` is recorded in the audit
 * log and never in the item — spec §6m.3, which §6o attaches to `procedure`
 * — so the file on disk does not move when somebody makes progress,
 * `checksum` stays stable, and `UPDATE_FIELD_POLICY` (trust.ts) is never
 * asked to classify a third kind of field.
 */
export interface Step {
  text: string;
  checked: boolean;
}

export interface Item {
  id: string;
  type: string;
  title: string;
  status: Status;
  severity: Severity;
  always: boolean;
  /**
   * Membership of the CONTINUITY tier — what the next session needs in order
   * not to start over, as opposed to what governs the work.
   *
   * It mirrors `always` exactly and deliberately
   * (`DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be`): a
   * boolean on the item that routes it to one tier, defaulting false,
   * validated at capture, and visible on every surface that shows `always`.
   * It is NOT a hardcoded id in `select` — a rule invisible from every screen
   * — nor a category (categories already carry a governance tier, and
   * overloading one axis with two is how both stop meaning anything) nor a tag
   * (tags are projected and unvalidated).
   *
   * **Written to the frontmatter only when true**, unlike `always`, and
   * absent from `computeItemChecksum` unless true, for the reason `steps`
   * is conditional there: every item in every corpus predates this field, and
   * an unconditional key would move every recorded checksum at once.
   */
  continuity: boolean;
  /**
   * **One plain sentence saying what this item is and why it matters, written
   * for a reader who does not know this codebase.**
   *
   * The bar is the owner's: *simple and very readable from first sight*. That
   * is stronger than short, and the difference is the whole point of the
   * field. This corpus already produces short — titles have a median of 70
   * characters, **202 of the 730 have grown past 80** and one reached 566 —
   * and short is not what makes them hard to read. A real 120-character title:
   *
   *     the injected endpoint collapses a missing seen file into a measured
   *     zero, so the screen says a file nobody opened was read
   *
   * ...against the summary of the same item:
   *
   *     A screen says it checked a session and found nothing, when in fact it
   *     never checked at all.
   *
   * So: plain words rather than project vocabulary, no ids, no file paths, no
   * measurements, and it says what the thing IS rather than how it was found.
   * `body` (median 1,693 characters) keeps every bit of the precision; the
   * summary is not a shorter body, it is the same claim said plainly.
   * `SUMMARY_MAX_CHARS` (validate.ts) bounds it at one such sentence, and the
   * bar and the bound are both argued there.
   *
   * People stretch the title today because there is nowhere else to put this,
   * so the field is not a new layer — it is a slot already being improvised
   * into.
   *
   * `null` means the item has none, and **absent is legal and stays legal**:
   * every item in every corpus predates this field. Nothing requires one, no
   * validator asks for one, and no reader may assume one.
   *
   * **Written to the frontmatter only when non-null**, and absent from
   * `computeItemChecksum` unless non-null — `continuity`'s treatment, for
   * `continuity`'s stated reason: an unconditional key would move every
   * recorded checksum at once.
   *
   * **It is not injected.** `renderItemBlock` and `renderIndexLine`
   * (render-item.ts) do not emit it, so `itemCost` does not charge for it and
   * no tier's budget moves. That is a measurement, not a shrug — see
   * `SUMMARY_BASIS` (content-hash.ts) for where the figures are recorded.
   */
  summary: string | null;
  /**
   * **The basis: what `summary` was written against**, so divergence is
   * measured rather than assumed.
   *
   * A summary does not know the body moved, and a summary is the most quotable
   * thing an item has — the one most likely to be trusted without checking. So
   * the field is not one value: this holds `itemSummaryBasis(item)`
   * (content-hash.ts) as of the write that set `summary`, and an edit that
   * moves the summarised content makes the two disagree. `summaryState` reads
   * that disagreement; `doctor` reports it; `mycontext show` and `get_item`
   * say it beside the summary itself.
   *
   * Never a caller's value. Every write path stamps it through `stampSummary`,
   * so a summary cannot be stored without the basis it was written against.
   * `null` exactly when `summary` is null — except in a file a human wrote by
   * hand, where a `summary:` with no `summary_of:` reads as `unanchored`,
   * which is a stale summary and is reported as one.
   */
  summaryOf: string | null;
  scope: string[];
  tags: string[];
  origin: Origin;
  sourceFile: string | null;
  sourceAnchor: string | null;
  sourceChecksum: string | null;
  validFrom: string | null;
  validUntil: string | null;
  checksum: string;
  /** Category-specific fields, e.g. kind, directive, likelihood, impact. */
  extra: Record<string, string>;
  /** Prose between the title heading and the first `##` section. */
  body: string;
  /**
   * The `## Steps` section, in file order. Create-only: absent from
   * `UpdateInput` exactly as `observations` is, so a step is corrected by
   * editing the Markdown and running `mycontext repair`.
   */
  steps: Step[];
  observations: Observation[];
  relations: Relation[];
  layer: Layer;
  /** POSIX, relative to the layer root. */
  filePath: string;
}
