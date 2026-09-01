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

/**
 * One summary this item USED to carry, and the date it stopped carrying it.
 *
 * Declared here beside `Observation`, `Relation` and `Step` rather than in
 * `summary-history.ts`, for the reason those three are here: `types.ts` imports
 * nothing, and a field of `Item` whose type lives in a module that imports
 * `content-hash.ts` would put a type-only edge into every file that reads an
 * item.
 *
 * `at` is a date, not a timestamp: the owner's ruling is that the history "does
 * not take long space", and the hour a sentence was replaced answers no
 * question anybody asks of it. `null` is the honest reading of an entry a
 * person typed into the file without one — the entry is KEPT and re-rendered
 * exactly as written rather than dropped or stamped with today, because
 * markdown is the source of truth and byte-identity is the promise.
 */
export interface PreviousSummary {
  at: string | null;
  text: string;
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
  /**
   * **The summaries this item used to carry, newest first, capped at three.**
   *
   * Owner ruling: *"we could leave history of summaries that does not take long
   * space and should not be injected."* Every clause of that sentence is a
   * decision, and each is enforced somewhere different:
   *
   *  - **history** — an entry is appended by `reviseSummary` (summary-history.ts)
   *    and by nothing else, at the one moment a summary is REPLACED. A cleared
   *    summary is a replacement too; a re-stamp that leaves the text alone
   *    (`--summary-unchanged`) is not, because nothing was replaced.
   *  - **does not take long space** — `SUMMARY_HISTORY_MAX` is 3 and the oldest
   *    drops off. Unbounded history in a file that must round-trip
   *    byte-identically (`INV-markdown-is-the-source-of-truth`) is a slow leak,
   *    and this field is the one part of an item that only ever grows.
   *  - **should not be injected** — `renderItemBlock` and `renderIndexLine`
   *    (render-item.ts) do not emit it, so `itemCost` does not charge for it and
   *    no tier's budget moves. Pinned by test/core/summary-history.test.ts
   *    rather than left to the budget to keep out: a history that quietly
   *    started costing injection tokens would be worse than no history, because
   *    what it costs tokens to say is what the item USED to say.
   *
   * **It is NOT part of `ContentShape`, and therefore not part of
   * `itemSummaryBasis`.** That absence is load-bearing in exactly the way
   * `summary`'s own absence from `ContentShape` is: appending to this list
   * happens during the very write that sets the new summary, so a basis that
   * covered it would be invalidated by the act of recording what it replaced —
   * every summary born stale, and the field that exists to explain the
   * staleness would be its cause. It is the trap `acknowledged` had to avoid
   * for the same reason and one field further out.
   *
   * **Written to the frontmatter only when non-empty**, and absent from
   * `computeItemChecksum` unless non-empty, for the reason `continuity`,
   * `summary` and `acknowledged` are conditional: an unconditional key would
   * move every recorded checksum in every corpus at once.
   *
   * Nothing is backfilled. Every item captured before this field existed has an
   * empty history, which is the honest state — nothing was recorded, so there
   * is nothing to record.
   */
  summaryWas: PreviousSummary[];
  /**
   * **Doctor findings a PERSON has ruled on, each anchored to the item as it
   * was when they ruled.** Keys are `Finding.code`; values are
   * `itemContentHash(item)` (content-hash.ts) at the moment of the
   * acknowledgement.
   *
   * `doctor` reports several things that are worth a human's eye and that no
   * edit to the item can ever clear — `checkBodyAgreement`'s retraction branch
   * is the measured case: it fires on a body's own wording, so an item whose
   * body genuinely does withdraw something reports forever, correctly, and the
   * person who has already read it has no way to say so. The owner's ruling
   * (2026-08-27) is that a person may record having looked. The finding is
   * still computed, still reported and still counted; it is reported as
   * ACKNOWLEDGED rather than open. Nothing is silenced by the machine — only
   * distinguished by a person.
   *
   * **The value is the whole mechanism, and it is `summaryOf`'s mechanism.** An
   * acknowledgement that outlives the thing it acknowledged is worse than none:
   * it would certify a body nobody has read as one already judged. So what is
   * stored is not a flag but the identity of the content that was ruled on, and
   * `acknowledgementState` (acknowledge.ts) compares it against the item as it
   * stands. Edit the body and the two disagree; the acknowledgement LAPSES and
   * the finding is open again.
   *
   * WHO and WHEN are deliberately not here. `mycontext ack` writes through
   * `auditMutation`, so the audit log already carries the origin and the
   * timestamp of every acknowledgement — `REQ-changes-are-timestamped-and-audited`
   * — and a second, unverifiable copy of both in the frontmatter is a claim a
   * hand edit could forge.
   *
   * **Written to the frontmatter only when non-empty**, and absent from
   * `computeItemChecksum` unless non-empty, for the reason `continuity` and
   * `summary` above are conditional: an unconditional key would move every
   * recorded checksum in every corpus at once.
   */
  acknowledged: Record<string, string>;
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
