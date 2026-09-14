/* -------------------------------------------------------------------------- *
 * THE FOUR HASH KINDS
 *
 * `TASK-two-nonces-are-both-plain-strings-so-either-store-redeems` measured a
 * second instance of its own subject here: *"four hash kinds are mutually
 * assignable, so a mis-stamp is silent in both directions."* Three of the four
 * are stored SIDE BY SIDE on `Item` — `checksum`, `summaryOf`,
 * `sourceChecksum` — with `acknowledged`'s values a fourth kind one field
 * along. Every one is hex of the same length, every one looks right in a file,
 * and while they were all `string` every one was assignable to every other.
 * A transposition was a silent write, and it stayed silent: what a wrong hash
 * in `summaryOf` produces is a summary that reports `stale` forever, or worse
 * `current` when it is not, and nothing anywhere says a hash of the wrong KIND
 * was stored.
 *
 * Each kind is now its own brand: `string` intersected with a phantom property
 * keyed on a `unique symbol` that is not exported. Fully erasable
 * (`CONST-node-24-no-build-step`) — no runtime representation, still a
 * primitive `string` in the frontmatter, in `JSON.stringify`, in a `Map` key
 * and in every comparison — and unforgeable outside the one function that
 * produces each.
 *
 * **What is closed and what is not, counted rather than implied.** Three of the
 * four DESTINATIONS are branded below (`summaryOf`, `sourceChecksum`,
 * `acknowledged`), so an unbranded string or a hash of another kind cannot be
 * written into any of them: eleven of the twelve wrong pairings are now compile
 * errors. The twelfth is `Item.checksum`, which stays `string` — not because it
 * matters less (it is the subject of
 * `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a`) but
 * because branding it was MEASURED at 77 assignment sites across 61 test files,
 * which is a migration and not an edit. It is named as open in that item rather
 * than half-done here.
 * -------------------------------------------------------------------------- */

declare const ITEM_CHECKSUM: unique symbol;
/**
 * **The checksum over an item's semantic content**, tagged with
 * `CHECKSUM_BASIS_VERSION`. Produced by `computeItemChecksum` (item.ts) and by
 * nothing else; it is what `Item.checksum` records and what `mycontext repair`
 * recomputes.
 *
 * `Item.checksum` is still declared `string`, so this brand currently guards
 * the PRODUCING end only — it is what makes `item.summaryOf =
 * computeItemChecksum(x)` a compile error. See the block above for the count
 * that left the other end open.
 */
export type ItemChecksum = string & { readonly [ITEM_CHECKSUM]: true };

declare const SUMMARY_BASIS_HASH_BRAND: unique symbol;
/**
 * **What a summary was written against** — `itemSummaryBasis(item)`
 * (content-hash.ts), stored in `Item.summaryOf`, and the value `summaryState`
 * compares the item against to decide whether the summary has gone stale.
 *
 * It covers a DIFFERENT set of fields from `ItemChecksum` (the summary itself
 * is excluded from it, deliberately and at length in `content-hash.ts`), which
 * is exactly why the two being interchangeable was a defect and not a
 * redundancy: a `checksum` written here would disagree with every basis this
 * item will ever compute, so the summary would read `stale` forever with no
 * edit able to clear it.
 */
export type SummaryBasisHash = string & { readonly [SUMMARY_BASIS_HASH_BRAND]: true };

declare const SOURCE_CHECKSUM_BRAND: unique symbol;
/**
 * **A snapshot's provenance**: the hash of the SOURCE TEXT an item was
 * captured from, not of the item. `Item.sourceChecksum`, stamped by
 * `reconcileSnapshot` (persist.ts) from `checksum(snapshotSource(item.body))`.
 *
 * The one kind here whose subject is not the item at all, which is what makes
 * a transposition into it the most misleading of the four: `source_drift`
 * reads this field to answer *"has the file this was copied from moved?"*, and
 * an item checksum stored here answers that question about the wrong document.
 */
export type SourceChecksum = string & { readonly [SOURCE_CHECKSUM_BRAND]: true };

declare const CONTENT_HASH_BRAND: unique symbol;
/**
 * **The anchor of a human acknowledgement**: `itemContentHash(item)`
 * (content-hash.ts) as of the moment a person ruled on a doctor finding, stored
 * as the VALUE in `Item.acknowledged`.
 *
 * The mechanism is `summaryOf`'s and the consequence of a mis-stamp is the
 * worst of the four, because it fails in the permissive direction: an
 * acknowledgement whose anchor matches by accident certifies a body nobody has
 * read as one already judged. `acknowledge.ts` states that at length; this is
 * the same statement made to the compiler.
 */
export type ContentHash = string & { readonly [CONTENT_HASH_BRAND]: true };

export type Tier = 'normative' | 'rationale';
export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';
export type Severity = 'hard' | 'soft';
/**
 * Who is asking. **`'review'` is the self-improvement pass and it is a
 * FOURTH member rather than a flavour of `'agent'`** — `plan:loop seq:3`,
 * design §4/§13.
 *
 * Every existing guard in this product is written `origin !== 'human'`, never
 * as an enumeration of the callers we happened to think of (`trustedStatus`
 * says so in as many words), so `'review'` inherits all of them the moment it
 * exists. What it needs that `'agent'` does not is STRICTLY MORE refusal, and
 * that is what the separate member buys:
 *
 *  - it can never produce anything but a `draft`, on any tier, where an
 *    `'agent'` capture of a rationale-tier item lands `active`;
 *  - `updateItem` and `supersedeItem` refuse it outright — it proposes and
 *    never edits;
 *  - its files land outside `items/` (`core/drafts.ts`), so a proposal nobody
 *    approved cannot reach anybody else's clone.
 *
 * Folding it into `'agent'` would have made all three conditional on a flag
 * travelling beside the origin, and `audit --origin review` would have had
 * nothing to filter on.
 */
export type Origin = 'human' | 'agent' | 'ingest' | 'review';
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
  /**
   * **`readonly`, and it is the first of five on this interface.** Before
   * 2026-09-14 there were none at all —
   * `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a`
   * measured exactly that: ten invariants of this record held in comments and
   * conventions, and zero compiler guarantees.
   *
   * An id is the item's name in every index, every relation, every audit row
   * and every citation. It is assigned once, by `createItem`, and a rename is a
   * NEW file and a supersession — never an assignment. Nothing in `src/` ever
   * assigned it (measured: zero), so the modifier pins what was already true
   * rather than changing any behaviour, which is the only kind of `readonly`
   * worth adding to a shipped record.
   *
   * `readonly` is a TYPE modifier and erases to nothing, so it costs zero bytes
   * and zero microseconds — unlike `Object.freeze`, which was measured on this
   * repository's own 1,244-item corpus (4.3% of load time shallow, 11.1% deep)
   * AND breaks `applyUpdate`, `persist` and `stampSummary`, all of which mutate
   * the very objects the loader produced. The compiler can hold the parts of
   * this that are genuinely immutable; the rest is a timing property and is
   * named on `checksum` below.
   */
  readonly id: string;
  /**
   * `readonly` for `id`'s reason and one of its own: the product already SAYS
   * this field is immutable, in prose, where only a human can read it —
   * `loadLayer`'s unknown-type error (rebuild.ts) ends *"`type` is fixed at
   * creation, so it cannot be re-filed in place"*. That sentence is now also a
   * compiler rule. Zero assignments in `src/`.
   */
  readonly type: string;
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
  summaryOf: SummaryBasisHash | null;
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
  acknowledged: Record<string, ContentHash>;
  scope: string[];
  tags: string[];
  origin: Origin;
  sourceFile: string | null;
  sourceAnchor: string | null;
  sourceChecksum: SourceChecksum | null;
  validFrom: string | null;
  validUntil: string | null;
  /**
   * **The recorded checksum: what this item's content hashed to at the moment
   * it was last written or last read off disk.**
   *
   * `ItemChecksum` rather than `string`, so the only values assignable here are
   * the two the type documents — a freshly computed one, or one read out of a
   * file through the named door. A `summaryOf`, a `sourceChecksum` or an
   * `itemContentHash` can no longer be written into this field by a slip.
   *
   * **Deliberately NOT `readonly`, and the reason is the whole of
   * `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a`.**
   * `persist` re-stamps it on every write, from the same `computeItemChecksum`
   * the renderer uses, precisely so the object handed to `store.upsert` agrees
   * with the bytes that landed. A `readonly` here would only move that one
   * assignment behind a cast, which is a convention wearing a modifier. The
   * honest statement is that freshness is a timing guarantee this type does not
   * make, and the four fields that ARE fixed at creation (`id`, `type`,
   * `layer`, `filePath`) carry the modifier where it is true.
   */
  /**
   * **The recorded checksum of this item's content.**
   *
   * Still `string` rather than `ItemChecksum`, and that is a measured decision
   * rather than an oversight: branding this field reddens 77 assignment sites
   * across 61 test files, almost all of them `checksum: 'x'` in a fixture. The
   * brand is defined (see `ItemChecksum` above) and `computeItemChecksum`
   * already returns it, so the PRODUCER end is typed and nothing can put this
   * value into `summaryOf`, `sourceChecksum` or `acknowledged` by a slip. The
   * consuming end is named as open in
   * `TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a`.
   *
   * **Not `readonly` either, and for a reason no modifier can fix.** `persist`
   * re-stamps this on every write so the object handed to `store.upsert`
   * agrees with the bytes that landed; `applyUpdate` mutates the item field by
   * field before that happens. Between those two points the value here
   * describes content the item no longer has. That window is a TIMING property,
   * a `readonly` would only push the one legitimate assignment behind a cast,
   * and `Object.freeze` was measured (4.3% of load time shallow, 11.1% deep, on
   * this repository's 1,244-item corpus) and would break all three write paths
   * outright. The four fields that genuinely are fixed at creation — `id`,
   * `type`, `layer`, `filePath` — carry `readonly` where it is TRUE, which is
   * the only place it is worth having.
   */
  checksum: string;
  /** Category-specific fields, e.g. kind, directive, likelihood, impact. */
  extra: Record<string, string>;
  /** Prose between the title heading and the first `##` section. */
  body: string;
  /**
   * **The free text a PERSON wrote when they asked for this item, verbatim,
   * before any body or summary was derived from it.** The `## Request`
   * section. D41 spec §16a.
   *
   * The owner's requirement, in his own words (2026-09-10): *"the user request
   * prompt in free text should be also documented in the item before it's body
   * and summary created, it will ease the user understanding about what the
   * rule or instruction or other item type is because it was written by it's
   * own words — this property is for documentation only and should not be
   * injected to the context."* Every clause of that sentence is a decision,
   * and each one is enforced somewhere different:
   *
   *  - **verbatim, including the mess** — nothing normalises it, nothing
   *    reflows it, nothing spell-checks it. `validateRequest` (validate.ts)
   *    REFUSES text this format cannot hold rather than repairing it, which is
   *    `validateBody`'s rule one section over: the value of this field is that
   *    it is HIS words, so a tidied one is not a smaller version of it, it is a
   *    different thing wearing quotation marks.
   *  - **before the body and summary** — it is what the item was derived FROM,
   *    which is why it is not itself derived. Recording it makes a check
   *    possible that nothing performs today: the summary standard governs the
   *    SHAPE of the sentence and never asks whether the sentence answers the
   *    request that produced it.
   *  - **documentation only, never injected** — `renderItemBlock` and
   *    `renderIndexLine` (render-item.ts) name the fields they emit and this is
   *    not among them, so `itemCost` does not charge for it and no tier's
   *    budget moves. That absence is STRUCTURAL, not a filter list: a filter is
   *    a list somebody can forget to extend, and the same argument is written
   *    out at length in `src/rules/deliver.ts` for the store's own copy of this
   *    field. `test/core/request-field.test.ts` plants a distinctive request
   *    and asserts it reaches no injected surface, because "structural" is a
   *    claim and the test is the evidence.
   *  - **never in the summary basis** — it is NOT part of `ContentShape`
   *    (content-hash.ts), so `itemSummaryBasis` cannot see it and no summary
   *    goes stale because a request was recorded. That is `summaryWas`'s own
   *    treatment for `summaryWas`'s own reason, and content-hash.ts states it
   *    beside `SUMMARY_BASIS` where somebody about to add a field will read it.
   *  - **never in the checksum** — absent from `computeItemChecksum` (item.ts)
   *    UNCONDITIONALLY, which is one step further than `summary`, `summaryWas`
   *    and `acknowledged` go. Those are conditional so that an item predating
   *    the field hashes unchanged; this one is excluded outright so that
   *    ADDING a request and CLEARING it again both leave the recorded checksum
   *    exactly where it was. Spec §16a requires the backfill to be reversible
   *    *"without touching body, summary or checksum"*, and a field the checksum
   *    covers could not be.
   *  - **optional, and absent is not a defect** — `undefined` on every item
   *    that no person asked for in writing, which is every agent-origin and
   *    ingest-origin item and every item captured before this field existed.
   *    Nothing requires one, no validator asks for one, and no reader may
   *    assume one.
   *  - **never edited after the fact** — absent from `UpdateInput`, the way
   *    `steps` and `observations` are absent from it. A correction is a NEW
   *    request, not a rewritten old one, and there is nothing to gain from a
   *    surface that lets somebody improve what he actually typed.
   */
  request?: string;
  /**
   * The `## Steps` section, in file order. Create-only: absent from
   * `UpdateInput` exactly as `observations` is, so a step is corrected by
   * editing the Markdown and running `mycontext repair`.
   */
  steps: Step[];
  observations: Observation[];
  relations: Relation[];
  /**
   * `readonly`: which root this item was loaded from is a fact about WHERE it
   * was found, decided by the loader that found it, and moving an item between
   * layers is a copy plus a delete rather than a field write. Zero assignments
   * in `src/`.
   */
  readonly layer: Layer;
  /**
   * POSIX, relative to the layer root.
   *
   * `readonly`, and it is `layer`'s argument exactly: it is what the loader
   * read the item OUT of. A write that changed it would leave the object
   * claiming a path nothing wrote, which is the same class of lie
   * `checksum`'s window is. Zero assignments in `src/`.
   */
  readonly filePath: string;
}
