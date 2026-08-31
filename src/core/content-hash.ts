/**
 * Content identity: the one definition of "is this the same item content",
 * shared by `createItem`'s dedupe, the id-family walk, and the ingest
 * idempotency key. Split out of `mutate.ts` in Wave 5 — hashing what an item
 * ASSERTS is a separate responsibility from writing it.
 */
import { normalizePosix } from './paths.ts';
import { checksum } from './slug.ts';
import { normalizeEol } from './text.ts';
import { normalizeSteps } from './validate.ts';
import type { Item, Observation, Relation, Severity, Step } from './types.ts';
import type { CreateInput } from './mutate.ts';

/**
 * Every field that decides content identity, and nothing else.
 *
 * Exported alongside `canonicalContent` below, for the one reader outside
 * this module that needs to NAME these fields rather than hash them — see
 * that function's comment.
 */
export interface ContentShape {
  type: string;
  title: string;
  body: string;
  steps: Step[];
  severity: Severity;
  always: boolean;
  continuity: boolean;
  scope: string[];
  tags: string[];
  observations: Observation[];
  relations: Relation[];
  extra: Record<string, string>;
}

/** Fixed key order so a freshly-authored observation and one recovered by
 * `parseItem` (whose keys come out in `parseItem`'s own order) hash the same. */
function canonicalObservation(o: Observation): Observation {
  return { category: o.category, text: o.text, tags: o.tags, context: o.context };
}

/** Fixed key order, for the reason `canonicalObservation` gives. */
function canonicalStep(s: Step): Step {
  return { text: s.text, checked: s.checked };
}

function canonicalRelation(r: Relation): Relation {
  return { type: r.type, target: r.target };
}

function canonicalExtra(extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(extra).sort()) out[key] = extra[key];
  return out;
}

/**
 * Identity of an item's *content*. `ContentShape` is the whole of it, so the
 * eleven `Item` fields absent from that interface are all excluded: `id`,
 * `status`, `origin`, provenance (`sourceFile`/`sourceAnchor`/
 * `sourceChecksum`), lifecycle dates (`validFrom`/`validUntil`), the
 * `checksum` itself, and the storage location (`layer`/`filePath`). None of
 * them change what the item *asserts*. `severity` and
 * `always` and `continuity` ARE included: they are normative content, not
 * bookkeeping —
 * `computeItemChecksum` (item.ts) agrees, it hashes both too — so
 * re-capturing the same title as `severity: 'hard'` after `'soft'` must
 * not be silently swallowed as an unchanged duplicate.
 *
 * `scope` and `tags` are unordered sets, so they are sorted before hashing.
 * `steps`, `observations` and `relations` are ORDERED — they render to
 * Markdown in the sequence given (see `renderItem` in item.ts), and for a
 * procedure the order IS the knowledge — so their order is preserved as
 * given, but each entry is rebuilt with a fixed key order
 * (`canonicalStep`/`canonicalObservation`/`canonicalRelation`) so that
 * JSON.stringify does
 * not make key order part of identity: a payload the model just sent and
 * the same content recovered by `parseItem` must hash identically even
 * though the two objects were built with their keys in different orders.
 * `extra`'s keys are sorted for the same reason.
 *
 * **Why the projection is exported and not just the hash.** A hash says
 * *that* two items differ; the import warning §6n.7 requires must say *which
 * fields* differ, because the person reading it is about to approve replacing
 * their own writing. `diffFields` (`pack/collide.ts`) answers that by
 * comparing this object field by field, so the answer is derived from the
 * predicate rather than written beside it. A second list of these fields kept
 * next to the hash could disagree with it in both directions, and both are
 * bad: a field named in the warning that did not move the hash teaches the
 * reader to distrust the warning, and a field that moved the hash without
 * being named is the silent difference the warning exists to surface. The
 * object's key order is part of what is exported — it is the order the
 * warning lists fields in.
 */
export function canonicalContent(v: ContentShape): ContentShape {
  return {
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    // UNCONDITIONAL, unlike `computeItemChecksum`'s key, and the difference
    // is that this hash is never persisted: it is recomputed on both sides
    // of every `createItem` dedupe, so there is nothing recorded anywhere
    // for a new key to invalidate. Omitting it would make two procedures
    // that differ only in their steps dedupe onto each other — the second
    // one reported as a duplicate of the first and never written.
    steps: v.steps.map(canonicalStep),
    severity: v.severity,
    always: v.always,
    continuity: v.continuity,
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations.map(canonicalObservation),
    relations: v.relations.map(canonicalRelation),
    extra: canonicalExtra(v.extra),
  };
}

/**
 * The hash itself: `canonicalContent` serialised. The two are one function
 * split in two so that the projection has a name, and the split is the whole
 * reason `differs` cannot lie.
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify(canonicalContent(v)));
}

export function contentHash(input: CreateInput): string {
  return hashContent({
    type: input.type,
    title: input.title,
    // Normalized here, not just at storage time (and not only by the one
    // caller that remembers to pre-normalize): the hash and the stored
    // item must see the same value, or a body containing a lone `\r`
    // (CRLF, or a bare old-Mac line ending) would hash differently from
    // the LF-normalized text `parseItem` reads back, and `createItem`
    // could dedupe or fail to dedupe inconsistently with what disk holds.
    body: normalizeEol(input.body ?? ''),
    // Normalised here through the SAME function `createItem` writes the item
    // with, not through a second `.map()` that says the same thing today: a
    // hash taken over a differently-shaped step is a hash that can never match
    // `itemContentHash` again, and the failure is silent — two procedures that
    // differ only in their steps would dedupe onto each other, the second one
    // reported as an already-captured duplicate and never written.
    //
    // `CreateInput.steps` is `string[]`, not `Step[]`, so this conversion
    // cannot be skipped the way `observations` skips it (that field arrives
    // already in its stored shape and `createItem` overrides it in the spread).
    // `normalizeSteps` can throw, and that path is unreachable from
    // production: `createItem` validates the same array before it calls this.
    steps: normalizeSteps(input.steps ?? []),
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    continuity: input.continuity ?? false,
    // Normalized here, not just at storage time: the hash and the stored
    // item must see the same value, or the same call made twice with
    // `scope: ['src\\db\\**']` on Windows would hash differently from what
    // ends up on disk and create a spurious second item.
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    extra: input.extra ?? {},
  });
}

export function itemContentHash(item: Item): string {
  return hashContent(item);
}

/* -------------------------------------------------------------------------- *
 * THE SUMMARY BASIS — what `Item.summary` was written against.
 * -------------------------------------------------------------------------- */

/**
 * Whether a field of `ContentShape` is part of **what a summary summarises**.
 *
 * A summary does not know the body moved, so it records the hash of the
 * content it describes and an edit to that content makes it STALE. This table
 * is the definition of "that content", and it is a table rather than a second
 * list of field names for the reason `UPDATE_FIELD_POLICY` (trust.ts) is one:
 * the `satisfies Record<keyof ContentShape, …>` clause below means a field
 * added to `ContentShape` **does not compile** until somebody decides whether
 * a summary of the item is invalidated when it moves. A hand-kept list beside
 * the hash is the defect this repository has measured seven times; a partition
 * the compiler enforces is not one.
 *
 * `summarised` is what the item ASSERTS in prose. `unsummarised` is
 * everything that decides where, when and how forcefully the assertion is
 * delivered — none of which changes a word of what the summary would say.
 * Each entry's reason:
 *
 *  - **title** · summarised. The summary is the sentence the title was being
 *    stretched into; a retitled item says something else.
 *  - **body** · summarised. It is the thing being summarised.
 *  - **steps** · summarised. For a `procedure` the steps ARE the knowledge
 *    (`canonicalContent` above says so), so a summary of a procedure whose
 *    steps changed describes a procedure that no longer exists.
 *  - **observations** · summarised. They are the item's own limits, evidence
 *    and history; a summary that counts three of them is wrong at four.
 *  - **extra** · summarised. It holds `rule.directive`, which decides whether
 *    a rule prohibits or prescribes — the plainest possible case of changing
 *    what the item says, and the reason `UPDATE_FIELD_POLICY` classifies it as
 *    content rather than bookkeeping.
 *  - **type** · NOT summarised, and it is the only "no" that is not a
 *    judgement: `type` decides the id prefix and the file's directory and is
 *    fixed at creation (there is no retype — `checkUnknownCategory`, doctor),
 *    so it cannot move this hash in either direction.
 *  - **severity, always, continuity, scope** · NOT summarised. Injection
 *    controls. Pinning an item, narrowing its globs or putting it on the
 *    continuity tier changes who reads it and when, not what it says — and
 *    marking a summary stale because somebody ran `mycontext pin` would spend
 *    the signal on a change no reader of the summary can see.
 *  - **tags** · NOT summarised. Tags are projected and unvalidated, and the
 *    projection rewrites them mechanically (`projectFieldUpdate`,
 *    tag-projection.ts — 285 items had a tag adopted into its field in one
 *    pass on this corpus). Including them would have turned that single
 *    maintenance run into 285 stale summaries, none of them stale.
 *  - **relations** · NOT summarised, and this one is load-bearing:
 *    `supersedeItem` writes a `superseded_by` edge onto the retiree. Including
 *    relations would make every retirement in this corpus report a stale
 *    summary, for an edge that says something about a DIFFERENT item.
 *
 * The alternative considered and rejected was reusing `itemContentHash`
 * itself, which needs no new definition at all. It is over-sensitive in
 * exactly the four places above, and a staleness signal that fires on a pin, a
 * tag projection or a retirement is one readers learn to ignore — the
 * cry-wolf failure `droppedBodyText` (item.ts) refuses for whitespace, one
 * field further out.
 */
type SummaryBasis = 'summarised' | 'unsummarised';

export const SUMMARY_BASIS = {
  type: 'unsummarised',
  title: 'summarised',
  body: 'summarised',
  steps: 'summarised',
  severity: 'unsummarised',
  always: 'unsummarised',
  continuity: 'unsummarised',
  scope: 'unsummarised',
  tags: 'unsummarised',
  observations: 'summarised',
  relations: 'unsummarised',
  extra: 'summarised',
} as const satisfies Record<keyof ContentShape, SummaryBasis>;

/**
 * The summarised fields, in this table's declaration order.
 *
 * The hash below is over `JSON.stringify`, so **key order is identity** —
 * reordering `SUMMARY_BASIS` would move every recorded basis at once and mark
 * every summary in the corpus stale. The order is authored here and nowhere
 * else; nothing sorts it, because a sort would silently absorb a reorder that
 * should have been a deliberate act.
 */
const SUMMARISED_FIELDS = (Object.keys(SUMMARY_BASIS) as (keyof ContentShape)[])
  .filter((field) => SUMMARY_BASIS[field] === 'summarised');

/**
 * The hash `Item.summaryOf` records: the summarised fields of this item's
 * content, canonicalised by `canonicalContent` so that the projection here and
 * the identity used everywhere else cannot disagree about what a field's value
 * IS (sorted `extra` keys, fixed key order inside each observation and step).
 *
 * **`summary` itself is deliberately absent from `ContentShape`**, and that
 * absence is what makes this hash computable at all: a basis that included the
 * summary would be invalidated by the very write that set it, so every summary
 * would be born stale. The second consequence is stated rather than
 * discovered: `contentHash`'s dedupe therefore does not see a summary either,
 * so re-capturing identical content with a different summary is reported as
 * the duplicate it is. That is correct — a description of an assertion is not
 * a second assertion.
 */
export function itemSummaryBasis(v: ContentShape): string {
  const canonical = canonicalContent(v) as unknown as Record<string, unknown>;
  const shape: Record<string, unknown> = {};
  for (const field of SUMMARISED_FIELDS) shape[field] = canonical[field];
  return checksum(JSON.stringify(shape));
}

/**
 * What an item's summary currently is, as a measured state rather than a
 * guess.
 *
 *  - `absent` — there is none. The legal default, and what all 730 items in
 *    this corpus are today.
 *  - `current` — the basis recorded with it still matches the item's
 *    summarised content, so it describes what the item says now.
 *  - `stale` — the content moved after the summary was written. The summary
 *    is still there and is still shown; nothing is deleted (this product
 *    never silently drops authored text), it is drawn as stale.
 *  - `unanchored` — there is a summary and no basis. Unreachable through any
 *    write path in this product, because `stampSummary` writes the pair
 *    together; reachable by hand-editing a file, which is exactly the case
 *    that must not read as `current`. It is a stale summary with a different
 *    reason, and `summaryIsStale` treats it as one.
 */
export type SummaryState = 'absent' | 'current' | 'stale' | 'unanchored';

export function summaryState(item: Item): SummaryState {
  if (item.summary === null) return 'absent';
  if (item.summaryOf === null) return 'unanchored';
  return item.summaryOf === itemSummaryBasis(item) ? 'current' : 'stale';
}

/** Whether a reader must not take this item's summary as describing it. Both
 * non-`current` states with a summary in them answer yes, and they are folded
 * into one predicate so no caller has to remember that `unanchored` exists. */
export function summaryIsStale(item: Item): boolean {
  const state = summaryState(item);
  return state === 'stale' || state === 'unanchored';
}

/**
 * **What a reader is told when an item's summary can no longer be trusted, in
 * ONE wording.**
 *
 * It lives beside `summaryState` rather than in a renderer because it is a
 * fact about the state and not about a layout: three surfaces say it —
 * `mycontext show`, the MCP `get_item` tool, and `doctor` — and a summary
 * described as stale on one screen and printed bare on the next is the drift
 * this repository keeps finding. The callers wrap it to their own width; none
 * of them decides what it says.
 *
 * `null` when there is nothing to say, so a caller cannot accidentally print
 * an empty warning beside a perfectly good summary.
 */
export function summaryStalenessNote(item: Item): string | null {
  const state = summaryState(item);
  if (state === 'absent' || state === 'current') return null;
  if (state === 'unanchored') {
    return (
      `my_context: this item's summary carries no "summary_of", so there is no record of what ` +
      `it was written against and nothing can say whether it still describes the item. No ` +
      `command in this product writes one without the other, so this file was edited by hand. ` +
      `Do not quote the summary as though it described this item; read the body.`
    );
  }
  return (
    `my_context: this item's summary is STALE — the title, body, steps, observations or extra ` +
    `fields have changed since it was written, so it describes text that is no longer here. It ` +
    `is shown rather than hidden because nothing here is dropped silently, but do not quote it ` +
    `as though it described this item. Read the body, and write a new summary with ` +
    `\`mycontext edit ${item.id} --summary "<text>"\`.`
  );
}

/**
 * **The only way a summary is written.** Sets the text and the basis it was
 * written against, together, so the pair cannot come apart.
 *
 * Two write paths set a summary — `createItem` and `updateItem` — and a second
 * copy of "…and now stamp the basis" in either would be a summary stored
 * against nothing the first time somebody forgot it, which reads as
 * `unanchored` forever after. Called AFTER every other field of the item has
 * been assigned, which is what makes a call that changes the body and the
 * summary together produce a summary that is `current` rather than instantly
 * stale.
 *
 * **It never refreshes a basis on its own.** A write that does not carry a
 * summary must not touch either field: that is the whole mechanism. An edit to
 * the body leaves the old basis in place, the two stop agreeing, and the
 * summary is stale — which is the honest half, and the only half available to
 * a CLI that cannot call a model.
 */
export function stampSummary(item: Item, summary: string | null): void {
  item.summary = summary;
  item.summaryOf = summary === null ? null : itemSummaryBasis(item);
}
