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
 *  - **body** · summarised. It is the thing being summarised.
 *  - **steps** · summarised. For a `procedure` the steps ARE the knowledge
 *    (`canonicalContent` above says so), so a summary of a procedure whose
 *    steps changed describes a procedure that no longer exists.
 *  - **observations** · summarised, AS A FIELD. They are the item's own
 *    limits, evidence and history; a summary that counts three of them is
 *    wrong at four. But the list is not uniform either:
 *    `LIFECYCLE_OBSERVATION_CATEGORIES`, below, excludes specific CATEGORIES
 *    inside it (`retirement`, `supersession`) by OWNER RULING 2026-09-10 —
 *    the same test applied one level in, exactly as `WORKFLOW_EXTRA_KEYS`
 *    applies it inside `extra`. See that table for the per-category reasoning.
 *  - **extra** · summarised, AS A FIELD — it holds `rule.directive`, which
 *    decides whether a rule prohibits or prescribes — the plainest possible
 *    case of changing what the item says, and the reason `UPDATE_FIELD_POLICY`
 *    classifies it as content rather than bookkeeping. But the bag is not
 *    uniform: `WORKFLOW_EXTRA_KEYS`, below, excludes specific KEYS inside it
 *    (`state`, `plan`, `seq`, `priority`, `source`, `progress`, `last_change`)
 *    by OWNER RULING 2026-09-04, the same test applied one field further in —
 *    see that table for the per-key reasoning.
 *  - **title** · NOT summarised, by OWNER RULING 2026-08-27, and it is the one
 *    entry in this table that was decided the other way first. The owner's
 *    reasoning, in their words: *a summary is a plain sentence about what the
 *    item SAYS; the title is a label ON the item, not part of what it says.*
 *    The measurement behind the ruling: retitling
 *    `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` — an edit
 *    that removed a claim the body had already withdrawn, and so made the item
 *    MORE accurate — flipped a summary that is still word for word correct
 *    into `stale`, and nothing could clear it except rewriting a sentence with
 *    nothing wrong with it. With 717 of this corpus's 733 items now carrying a
 *    summary, the old basis fired that way on every future retitle.
 *
 *    **The risk the owner accepted, stated rather than discovered:** a title
 *    can carry real meaning, and one that changes what the item claims will now
 *    move without flagging the summary. It is rare — a title is a label, and
 *    the claim it labels lives in the body this hash still covers — and it is
 *    not unwatched: `checkBodyAgreement` (doctor/checks.ts) reads the title
 *    against the body and is the check that reports a title asserting something
 *    its own body does not.
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
  title: 'unsummarised',
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
 *
 * **Reclassifying a field does the same thing, and it has now been done once.**
 * Moving `title` to `unsummarised` (owner ruling 2026-08-27, argued above)
 * invalidated all 717 recorded bases in this corpus at once — every one of them
 * would have read `stale` on the next `doctor` run. That is not a side effect
 * to absorb quietly: it is a corpus migration, and it was done by
 * `scripts/restamp-summary-basis.ts`, which re-stamps ONLY the items whose
 * recorded basis still matches the OLD formula — i.e. the items whose
 * summarised content is provably unmoved since the summary was written — and
 * leaves every already-stale item exactly as stale as it was. Read that script
 * before changing this table again; the rule it enforces is the one that
 * matters, and it is short: a re-stamp may never turn a real stale into a false
 * current.
 *
 * **Narrowing a field from the INSIDE does the same thing to fewer items, and
 * it is still a migration.** `WORKFLOW_EXTRA_KEYS` and
 * `LIFECYCLE_OBSERVATION_CATEGORIES` do not touch this table at all, so the
 * `satisfies` clause above cannot notice them — but they change what
 * `itemSummaryBasis` hashes just as surely, for every item that carries one of
 * the excluded keys or categories. The 2026-09-10 lifecycle ruling moved 12 of
 * this corpus's 1077 recorded bases and was migrated by
 * `scripts/restamp-summary-basis-lifecycle.ts` in the same act, under the same
 * one rule. Adding a key or a category to either table is the same kind of
 * deliberate act this docblock describes, at a smaller radius.
 */
const SUMMARISED_FIELDS = (Object.keys(SUMMARY_BASIS) as (keyof ContentShape)[])
  .filter((field) => SUMMARY_BASIS[field] === 'summarised');

/**
 * **Workflow keys inside `extra` — the same exclusion `SUMMARY_BASIS.tags`
 * already makes, one field further in.**
 *
 * OWNER RULING 2026-09-04, on `TASK-closing-any-task-trips-the-summary-gate-
 * even-though-only-the`: *"a summary describes what an item MEANS. Moving a
 * task to `done` changes its status, not its meaning."* `extra` as a whole
 * stays `summarised` — it holds `rule.directive`, which decides whether a
 * rule prohibits or prescribes, and that must keep gating on its own. The
 * ruling is about specific KEYS inside the bag, not the bag itself, so the
 * exclusion lives here rather than by widening `SUMMARY_BASIS.extra` — the
 * same reasoning `SUMMARY_BASIS`'s own docblock gives for a table over a
 * hand-kept list: a coarser cut would let `directive` escape the basis by
 * accident the day it travels inside a patch alongside a workflow key.
 *
 * Each key decided on its own, against the one test the ruling gives —
 * does moving it change what the item SAYS, or only where it stands:
 *
 *  - **`state`** · workflow. Named explicitly in the ruling. `todo` /
 *    `doing` / `blocked` / `done` is the task's position in its own
 *    lifecycle, not a claim about what it requires — `categories.ts`'s own
 *    words for the category: *"its plan, sequence and state live in extra
 *    fields; the body is what the task actually requires."*
 *  - **`progress`** · workflow. Named explicitly in the ruling. A percent-
 *    complete figure, and RETIRED from new writes as of the 2026-09-03
 *    ruling recorded in `categories.ts` for being "never more than state's
 *    shadow" — a field that was already agreed to carry no information
 *    `state` did not.
 *  - **`last_change`** · workflow. Named explicitly in the ruling. A
 *    bookkeeping timestamp, RETIRED alongside `progress` for the same
 *    reason `validFrom` is outside `ContentShape` entirely: a record of
 *    WHEN, never a claim about WHAT.
 *  - **`plan`** · workflow, by the same test extended to the rest of the
 *    bag. Names which body of work tracks the task — routing, the same
 *    role `scope` plays outside `extra` (`SUMMARY_BASIS.scope`: "injection
 *    controls... not what it says"). Reassigning a task from one plan to
 *    another is a filing decision, not a rewrite of what the task requires.
 *  - **`seq`** · workflow, same test. Position within the plan's order —
 *    scheduling, renumbered routinely when a plan is reshuffled, and never
 *    itself part of the task's requirement.
 *  - **`priority`** · workflow, same test. A ready-queue ordering number,
 *    1 highest — the identical role `severity` already plays as a top-level
 *    `SUMMARY_BASIS` entry (*"injection controls... not what it says"*).
 *  - **`source`** · workflow, same test. Free prose recording HOW or WHEN
 *    a task was found (e.g. "found sweeping neighbours during walk/72") —
 *    provenance, the exact role the top-level `sourceFile`/`sourceAnchor`/
 *    `sourceChecksum` fields play, and those are outside `ContentShape`
 *    entirely for the same reason.
 *  - **`directive`** (on `rule`) · stays CONTENT, deliberately not added
 *    here. It "decides whether a rule prohibits or prescribes" — the
 *    plainest case there is of a key that changes what the item SAYS, and
 *    the reason `extra` was ever classified `summarised` at all.
 *  - **Everything else** · stays CONTENT by omission, the conservative
 *    default. A key not named here — including `needs` (the task's own
 *    dependency, which the ruling did not touch, and which is closer to a
 *    claim than to bookkeeping) and any future custom `--extra` field —
 *    keeps counting toward the basis until a ruling excludes it by name.
 *    Getting this table wrong in the permissive direction is the failure
 *    mode `SUMMARY_BASIS`'s own docblock warns against: a field that quietly
 *    stops being able to invalidate a summary is a hole nothing reports.
 *
 * Applied only inside `itemSummaryBasis`, below — `canonicalContent` and
 * `contentHash`/`itemContentHash` (content IDENTITY, used by `createItem`'s
 * dedupe) still see the whole `extra` bag unfiltered. Two capture attempts
 * that differ only in `state` are still different content for dedupe
 * purposes; they are the same thing for what a SUMMARY has to describe. The
 * two questions are related and not identical, the way `tags` is unordered
 * for hashing but still full content for dedupe.
 */
const WORKFLOW_EXTRA_KEYS: ReadonlySet<string> = new Set([
  'state', 'progress', 'last_change', 'plan', 'seq', 'priority', 'source',
]);

/** `extra`, with `WORKFLOW_EXTRA_KEYS` removed — what the summary basis sees
 * of the bag. Iterates `canonicalExtra`'s already-sorted keys, so the result
 * stays in the same fixed order the rest of this module relies on.
 *
 * Exported for ONE caller and for one reason:
 * `scripts/restamp-summary-basis-lifecycle.ts` has to recompute the basis
 * formula as it stood before the 2026-09-10 lifecycle ruling, and that formula
 * filtered `extra` with this exact set. A second copy of `WORKFLOW_EXTRA_KEYS`
 * in the migration would be a list that can disagree with this one, which is
 * the defect this file's own docblocks refuse in three other places. The
 * export goes when that script does. */
export function summarisedExtra(extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(extra)) {
    if (WORKFLOW_EXTRA_KEYS.has(key)) continue;
    out[key] = extra[key];
  }
  return out;
}

/**
 * **Lifecycle categories inside `observations` — the same exclusion
 * `WORKFLOW_EXTRA_KEYS` already makes, one field over.**
 *
 * OWNER RULING 2026-09-10, on `TASK-a-lifecycle-note-makes-an-item-s-summary-
 * read-stale-because` (D43). Retiring an item WRITES an observation onto it:
 * `updateItem`'s stand-down note (category `retirement`) and `supersedeItem`'s
 * two notes (category `supersession` — the retiree's stand-down, and the
 * replacement's `Replaces <id>: <reason>`). With `observations` summarised
 * whole, correctly retiring an item moved its summary basis and `doctor`
 * reported `summary_stale` on an item whose meaning had not changed. The
 * ruling's own test, unchanged from 2026-09-04: does this change what the item
 * SAYS, or only where it stands?
 *
 * `observations` as a whole stays `summarised` — a substantive observation IS
 * part of what an item asserts, and dropping the field wholesale would let a
 * real change pass without ever marking a summary stale. That is the same
 * defect in the other direction and it would be silent, which is why the
 * exclusion lives here as named CATEGORIES rather than by widening
 * `SUMMARY_BASIS.observations` to `unsummarised`.
 *
 *  - **`retirement`** · lifecycle. Written only by `updateItem` when a status
 *    change crosses into `STOOD_DOWN_STATUSES` and the item was pinned or
 *    `hard`. Its whole text is `standDownNote` — *"the pin was cleared … the
 *    binding severity was dropped … Nothing else was changed and nothing was
 *    deleted"*. It is a record of the act of retiring, and it says in its own
 *    words that what the item asserts is untouched. `SUMMARY_BASIS.always`
 *    and `.severity` are already `unsummarised`; excluding the note that
 *    RECORDS them moving is the same ruling applied to the same two fields.
 *  - **`supersession`** · lifecycle, and it is the older half of the defect.
 *    `supersedeItem` has written it since long before the stand-down note
 *    existed, so every replacement in this corpus has been moving the
 *    retiree's basis (and the replacement's, when a `reason` was given) for
 *    the same non-reason. `SUMMARY_BASIS.relations` is already `unsummarised`
 *    precisely so the `superseded_by` EDGE cannot do this; the note that
 *    narrates the same edge must not do it either.
 *  - **Everything else** · stays CONTENT by omission, the conservative
 *    default `WORKFLOW_EXTRA_KEYS` sets. `limit`, `edge_case`, `evidence`,
 *    `history`, `rule`, `note` and every category a person invents keep
 *    counting toward the basis until a ruling excludes one by name.
 *
 * **Why by category and not by a marker the writer attaches.** The two shapes
 * D43 put up were a marker ON the note (so the exclusion survives a third
 * writer arriving) and an enumeration derived from the writers that exist. The
 * category IS a marker on the note — it round-trips through
 * `renderObservation`/`parseObservationLine`, it is chosen by whoever records
 * the note, and `mutate.ts` already reasons about which of the two values is
 * true of the act ("a `supersession` category here would assert a successor
 * that does not exist"). What this table adds over a fresh marker is that the
 * excluded VALUES are closed and named, and that decides the question in the
 * only direction that matters: a NEW marker would be attachable to any
 * observation by any writer, and an observation that quietly stops being able
 * to invalidate a summary is a hole nothing reports — the exact permissive
 * failure `WORKFLOW_EXTRA_KEYS`'s docblock warns against. This table's failure
 * mode is the opposite one: a third writer inventing a third lifecycle
 * category is not excluded until somebody names it here, and until then its
 * items read `stale` — wrong, but LOUD, and `doctor` prints it. The second
 * argument is retroactive reach: the notes already on disk carry their
 * category, so this exclusion applies to every lifecycle note ever written
 * without a single item file being touched to backfill a marker.
 *
 * Applied only inside `itemSummaryBasis`, below — `canonicalContent` and
 * `contentHash`/`itemContentHash` (content IDENTITY, used by `createItem`'s
 * dedupe) still see every observation. Two items that differ only in a
 * stand-down note are still different content; they are the same thing for
 * what a SUMMARY has to describe.
 */
const LIFECYCLE_OBSERVATION_CATEGORIES: ReadonlySet<string> = new Set([
  'retirement', 'supersession',
]);

/**
 * Whether an observation is a record of the item's LIFECYCLE rather than part
 * of what it asserts — exported so the two write paths that mint one
 * (`updateItem`'s stand-down and `supersedeItem`, both in mutate.ts) can be
 * held to it by test rather than by a comment, and so nothing has to keep a
 * second copy of the category names beside this one.
 */
export function isLifecycleObservation(o: Observation): boolean {
  return LIFECYCLE_OBSERVATION_CATEGORIES.has(o.category);
}

/** `observations`, with the lifecycle notes removed — what the summary basis
 * sees of the list. Order among the survivors is preserved, for the reason
 * `canonicalContent` preserves it: the list renders in the sequence given. */
function summarisedObservations(observations: readonly Observation[]): Observation[] {
  return observations.filter((o) => !isLifecycleObservation(o));
}

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
  for (const field of SUMMARISED_FIELDS) {
    // Two of the four summarised fields get a narrower cut than
    // `canonicalContent` gives them, and both cuts are inside the field rather
    // than a reclassification of it: `WORKFLOW_EXTRA_KEYS` for which keys in
    // the bag are tracking rather than content, and
    // `LIFECYCLE_OBSERVATION_CATEGORIES` for which notes record what happened
    // TO the item rather than what it says. See both tables above.
    if (field === 'extra') {
      shape[field] = summarisedExtra(canonical.extra as Record<string, string>);
    } else if (field === 'observations') {
      shape[field] = summarisedObservations(canonical.observations as Observation[]);
    } else {
      shape[field] = canonical[field];
    }
  }
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
    `my_context: this item's summary is STALE — the body, steps, observations or extra ` +
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
