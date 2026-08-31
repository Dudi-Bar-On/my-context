/**
 * The trust boundary of the write path, in one module: who may move which
 * field of an item, and what happens when a non-human caller tries.
 *
 * Split out of `mutate.ts` in Wave 5. The centre of it is
 * `UPDATE_FIELD_POLICY`, whose `satisfies` clause makes an UNCLASSIFIED
 * writable field a compile error, and whose four type assertions pin the
 * staged set (`REVISION_FIELDS`, revision.ts) and the guarded set
 * (`GUARDED_FIELDS` + status) to it in both directions — that property is
 * the compiler-enforced half of the boundary and moved here intact.
 *
 * Imports from `mutate.ts` and `revision.ts` are TYPE-ONLY, so this module
 * adds no runtime edge to the existing mutate↔revision cycle.
 */
import { agentEditsFor, type Config, type ResolvedCategory } from './config.ts';
import { normalizePosix } from './paths.ts';
import type { MutationContext, UpdateInput } from './mutate.ts';
import type { RevisionChanges, RevisionField, RevisionValue } from './revision.ts';
import type { Item, Origin, Status, Tier } from './types.ts';

/**
 * The `scopePolicy: 'required'` refusal, as a message rather than a throw, so
 * that the ONE rule serves three surfaces with three different shapes of
 * failure: `createItem` throws it (and with it `mycontext add`, MCP
 * `create_item`, `lesson-accept` and every other write path, since they all
 * funnel through there), `cmdAdd` throws it EARLIER so a capture that cannot
 * land is refused before the human is asked to confirm it, and the ingest
 * candidate validator records it as a per-candidate rejection instead of
 * throwing, so one unscoped candidate cannot take a whole batch down.
 *
 * It refuses at CAPTURE and nowhere else. Spec §4b is explicit that `required`
 * must not become a second injection-time filter: an item that exists and can
 * never be injected is the defect the unscoped-means-global change removed,
 * and reintroducing it under a config key would be the same defect wearing a
 * setting. `matchesScope` (select.ts) therefore treats `required` exactly like
 * `global`.
 *
 * The `'edit'` surface is the spec's own open question, answered yes: an
 * update that removes the LAST glob is refused too, because leaving it open
 * would make `required` mean "required at capture, optional forever after" —
 * one `update_item` call would produce exactly the unscoped item the policy
 * exists to prevent, and nothing would say so. The gate is narrow: it fires
 * only when the item actually HAS globs and the update would clear them, so a
 * caller echoing back the empty scope of an item captured before the policy
 * changed is not refused for a no-op it did not make.
 *
 * Returns `null` when there is nothing to refuse.
 */
export function scopeRequirementError(
  category: ResolvedCategory, scope: string[] | undefined, surface: 'capture' | 'edit' = 'capture',
): string | null {
  if (category.scopePolicy !== 'required') return null;
  if (scope !== undefined && scope.length > 0) return null;
  const remedy = surface === 'capture'
    ? `Nothing was written. Pass one: \`mycontext add ${category.name} "<title>" --scope ` +
      `"src/**"\`, or the "scope" argument of create_item.`
    : `Nothing was changed. Replace the globs rather than clearing them, or narrow them to the ` +
      `paths the item still applies to.`;
  return (
    `my_context: "${category.name}" is configured with scopePolicy "required" in this project, so ` +
    `every ${category.name} must declare at least one scope glob saying which files it applies ` +
    `to. ${remedy} To allow ${category.name} items with no scope here, change ` +
    `categories.${category.name}.scopePolicy to "global" in .my_context/config.json. ` +
    `See mycontext_help("scope").`
  );
}

/**
 * The refusal for a field that exists on every item but only GOVERNS on the
 * normative tier (spec §3), as a message rather than a throw — the same shape
 * `scopeRequirementError` above uses, and for the same reason: one rule, one
 * wording, three surfaces with three different shapes of failure.
 * `createItem`/`updateItem` throw it (and with them `mycontext add`, MCP
 * `create_item`/`update_item` and every other write path, since they all
 * funnel through there); `cmdReview`'s `promote` calls it EARLIER so a
 * promotion that cannot land is refused before a human is shown a preview of
 * it; the ingest candidate validator records it as a per-candidate rejection
 * instead of throwing, so one bad candidate cannot take a whole batch down.
 *
 * TWO fields, not three, and `scope` is deliberately NOT one of them.
 *
 *  - `always` gates exactly one thing: admission to the pinned tier. `select`
 *    filters `isNormative` BEFORE it filters `always`
 *    (`eligible.filter(isNormative)`, then `fresh.filter((i) => i.always)`),
 *    so a rationale item carrying `always: true` is never pinned, never
 *    injected, and nothing said so. Verified by execution: an `active`
 *    `lesson` with `always: true` produced an EMPTY session-start selection.
 *  - `severity` gates nothing at all outside the normative tier. Its only
 *    consumers are `byPriority` (select.ts), which orders candidates that a
 *    rationale item never becomes, and the reports.
 *  - `scope` is different, and the difference is a consumer that does not
 *    filter by tier: the `query_items` MCP tool answers "which items apply to
 *    this path?" with `matchesScope(item, path, config)` over EVERY item,
 *    rationale included (mcp/tools.ts). A decision's scope is how a reader
 *    finds "what was decided about this file", which is a real feature and the
 *    reason spec §3 left it open. It is also the only answer consistent with
 *    Task 2's `scopePolicy`: `required` on a rationale category demands a
 *    scope at capture, so refusing scope there would make the two settings
 *    mutually unsatisfiable — every capture refused, both ways, with two
 *    messages contradicting each other. So `scope` is accepted on a rationale
 *    item, and nothing about it is inert: it is inert for INJECTION on that
 *    tier, exactly as `scopePolicy: "inert"` is inert for injection and still
 *    leaves the item listed and (under `global`) queryable.
 *
 * It refuses the ASSERTION, not the presence of a value, and the distinction
 * is what keeps the rule from breaking working paths:
 *
 *  - The neutral values are accepted. `always: false` and `severity: 'soft'`
 *    are what every item carries by default and what `applyCandidates` passes
 *    explicitly for every ingest candidate, so refusing them would refuse
 *    every rationale ingest while dropping nothing a caller asked for.
 *  - On an update, only a CHANGE is refused — the same principle
 *    `guardedChange` applies one field over. A caller echoing back a value it
 *    just read is not asserting anything, and an item whose category was
 *    retiered underneath it must stay editable rather than stranded behind a
 *    field it did not set. `inertFieldNote` reports such a stored value
 *    instead. Refuse the new assertion; report the pre-existing one.
 *
 * `enumError` (teach.ts) is deliberately not reused: this is not an invalid
 * value — `true` and `"hard"` are both in the enum and both round-trip — but a
 * valid value on a kind of item where it does nothing, which needs a different
 * sentence and a different remedy.
 *
 * Returns `null` when there is nothing to refuse.
 */
export function inertFieldError(
  category: ResolvedCategory,
  field: 'always' | 'severity',
  surface: 'capture' | 'edit' = 'capture',
): string | null {
  if (category.tier !== 'rationale') return null;
  const what = field === 'always'
    ? '`always: true` asks for the pinned tier, which selection admits only normative items to'
    : '`severity: "hard"` asks for the strongest force a normative item can carry';
  const outcome = surface === 'capture' ? 'Nothing was written.' : 'Nothing was changed.';
  return (
    `my_context: "${field}" is a field on every item, but it only governs on the normative ` +
    `tier — and "${category.name}" is a rationale-tier category in this project. ${what}, so ` +
    `this would be stored and then do nothing at all. ${outcome} Two things work instead: ` +
    `retier the category, by setting categories.${category.name}.tier to "normative" in ` +
    `.my_context/config.json — after which "${field}" governs here exactly as it reads — or ` +
    `capture this as an item in a normative category (rule, constraint, invariant, …), which ` +
    `is the tier that decides what an agent is told to do. ` +
    `See mycontext_help("categories").`
  );
}

/**
 * The `extra` keys the PRODUCT writes and reads, on every category alike —
 * exempt from the ownership rule below because they are not category-specific
 * fields at all.
 *
 * `applyCandidates` (ingest/apply.ts) stamps both onto every ingested item and
 * reads them back on the next run: `content_hash` is the dedupe key that
 * decides whether a re-extraction is the same item, and `ingest_key` is the
 * supersession key that decides what a reworded one replaces. They live in
 * `extra` because `extra` is the only per-item frontmatter that survives the
 * Markdown round trip without a schema change, and they are stamped on
 * `requirement`, `constraint`, `lesson` and everything else, so no category
 * could declare them without every category declaring them.
 *
 * They are exempt rather than declared, and the difference matters: adding
 * them to `extraFields` would put them in `extraFieldNames`, and therefore in
 * the MCP `create_item` schema, advertising the pipeline's dedupe key to every
 * model as a field to fill in. A hand-set `content_hash` would then silently
 * dedupe an unrelated item away. So the union schema must not name them, and
 * the ownership check must not refuse them.
 *
 * Named here, in the module that enforces the rule, and IMPORTED by the writer
 * rather than re-spelled there — one list, so an exemption and the field it
 * exempts cannot drift apart.
 */
export const CONTENT_HASH_KEY = 'content_hash';
export const INGEST_KEY_KEY = 'ingest_key';
const PIPELINE_EXTRA_KEYS = new Set<string>([CONTENT_HASH_KEY, INGEST_KEY_KEY]);

/**
 * Extra-field OWNERSHIP: an `extra` key must be one the item's own category
 * declares. As a message rather than a throw, for the same reason
 * `scopeRequirementError` and `inertFieldError` above are — one rule, one
 * wording, three surfaces: `createItem`/`updateItem` throw it (and with them
 * `mycontext add --extra`, `mycontext edit --extra`, MCP `create_item`/
 * `update_item`), and the ingest candidate validator records it as a
 * per-candidate rejection so one mis-fielded candidate cannot take a whole
 * batch down.
 *
 * Nothing enforced this before. `extraFields` was declared per category and
 * read in exactly two places — the MCP `create_item` schema and the ingest
 * extraction request, both of which are the UNION of what every category
 * declares — so `directive`, which decides whether a rule prohibits or
 * prescribes, was accepted on a `risk`, and `likelihood` on a `rule`. The
 * catalogue read as a per-category promise and behaved as a global namespace.
 *
 * Ordered AFTER `validateExtra` (validate.ts) at every call site, and that
 * ordering is the point rather than an accident: `--extra status=x` must keep
 * failing with the reserved-frontmatter-field message, which says the field
 * would silently overwrite a real one on disk, and not with "status is not
 * declared by rule" — which would send the user to add `status` to
 * `extraFields`, the one remedy that cannot work.
 *
 * The message names the offending key, the category, what that category DOES
 * declare, and — when some other category declares the key — which one, so a
 * `directive` on a `risk` reads as "you meant rule" rather than as "no". Both
 * remedies are given, because both are real: capture it under the category
 * that owns the field, or declare the field on this category in config.
 *
 * The check is on the keys the CALLER passed, not on the item's merged result:
 * a value stored before a config change stays on disk and keeps rendering, and
 * only a new assertion of it is refused — the same "refuse the assertion,
 * report the pre-existing one" split `inertFieldError`/`inertFieldNote` draw.
 *
 * Returns `null` when there is nothing to refuse.
 */
export function unknownExtraFieldError(
  config: Config,
  category: ResolvedCategory,
  extra: Record<string, string> | undefined,
  surface: 'capture' | 'edit' = 'capture',
): string | null {
  if (extra === undefined) return null;
  const declared = category.extraFields;
  const offending = Object.keys(extra)
    .find((key) => !declared.includes(key) && !PIPELINE_EXTRA_KEYS.has(key));
  if (offending === undefined) return null;

  const owners = Object.values(config.categories)
    .filter((c) => c.extraFields.includes(offending))
    .map((c) => c.name)
    .sort();
  const declares = declared.length > 0
    ? `A "${category.name}" declares: ${declared.join(', ')}.`
    : `A "${category.name}" declares no extra fields at all.`;
  const elsewhere = owners.length > 0
    ? ` "${offending}" is declared by ${owners.join(', ')}.`
    : '';
  const outcome = surface === 'capture' ? 'Nothing was written.' : 'Nothing was changed.';
  return (
    `my_context: extra field "${offending}" is not declared by "${category.name}", so it would ` +
    `be stored on an item whose category never promises it and read back by nothing. ` +
    `${declares}${elsewhere} ${outcome} Two things work: capture this under a category that ` +
    `declares the field, or declare it here by adding it to categories.${category.name}` +
    `.extraFields in .my_context/config.json (["${offending}"]) — that list ADDS to what the ` +
    `category already declares, so nothing it has now is lost. ` +
    `Anything the catalogue does not name also fits in \`tags\` or in the body. ` +
    `See mycontext_help("categories").`
  );
}

/**
 * Spec §7.1: trust is per-tier, not per-caller. Nothing that isn't
 * human-authored governs future work until a human promotes it — this
 * covers `'agent'` and `'ingest'` alike (see the `Origin` union in
 * types.ts), and any future non-human origin, by construction: the check is
 * `!== 'human'`, not an enumeration of the callers we happened to think of.
 * `'ingest'` matters concretely: batch ingestion (spec §7.2) lands items via
 * this same path, and an ingested constraint must not reach `active` and
 * start governing before a human has looked at it, any more than an
 * agent-authored one does.
 *
 * The tier argument must come from the *resolved* config so per-project
 * tier overrides and custom categories are covered — reading the built-in
 * category table here would quietly exempt every project override. This is
 * a hard override, not a default: a non-human caller that explicitly passes
 * `status: 'active'` for a normative item is still forced to `draft`, or one
 * argument would defeat the whole boundary.
 */
export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {
  if (origin !== 'human' && tier === 'normative') return 'draft';
  return requested;
}

/**
 * Fails CLOSED: an item whose `type` is missing from config (e.g. the
 * category was renamed or removed after the item was captured — `loadLayer`
 * in rebuild.ts still indexes such items deliberately) is treated as
 * `'normative'`, the *more* restrictive tier, not `'rationale'`. Defaulting
 * to `'rationale'` would silently hand an agent status control over an item
 * whose governing category just vanished from config — the opposite of what
 * a security check should do when its input goes missing. `Object.hasOwn`
 * guards the same prototype-pollution hazard `resolveCategory` documents: a
 * bare index on `type: 'constructor'` would otherwise reach
 * `Object.prototype.constructor`, whose `.tier` is `undefined`, landing on
 * the same permissive default this function refuses to have.
 */
export function tierOf(ctx: MutationContext, item: Item): Tier {
  return Object.hasOwn(ctx.config.categories, item.type)
    ? ctx.config.categories[item.type].tier
    : 'normative';
}

/**
 * The other half of `inertFieldError`, for the one case a refusal cannot
 * cover: a governing value that is ALREADY stored on a rationale item.
 *
 * `inertFieldError` refuses the assertion, so nothing can newly set
 * `always: true` or `severity: "hard"` on a rationale item through any write
 * path. What it cannot refuse is a value that was legal when it was written
 * and is not now: `tierOf` reads the RESOLVED per-project config, so a
 * category that was normative when the item was captured — or in another
 * workspace, or in this one before a config change — can be rationale today.
 * Refusing an edit for that would strand the item behind a field its author
 * did not set; saying nothing would put the silence back. So the update path
 * reports it.
 *
 * Only `updateItem` calls this. On `createItem` it would be unreachable by
 * construction — the refusal above fires first on exactly the values this
 * reports — and an unreachable branch claiming to explain a live one is the
 * kind of statement this project treats as a defect.
 */
export function inertFieldNote(ctx: MutationContext, item: Item): string {
  if (tierOf(ctx, item) !== 'rationale') return '';
  const stored: string[] = [];
  if (item.always) stored.push('`always: true`');
  if (item.severity === 'hard') stored.push('`severity: "hard"`');
  if (stored.length === 0) return '';
  return (
    ` Note: ${stored.join(' and ')} ${stored.length > 1 ? 'are' : 'is'} stored but INERT on ` +
    `${item.id} — "${item.type}" is a rationale-tier category in this project, and neither the ` +
    `pinned tier nor severity governs anything outside the normative tier, so nothing here ` +
    `changes what is injected. ${stored.length > 1 ? 'They' : 'It'} would take effect if the ` +
    `category's tier were changed. See mycontext_help("categories").`
  );
}

/** True when an item is a normative item that is *currently governing* —
 * the same narrow predicate `supersedeItem` uses for its own refusal. Only
 * `active` items are actually eligible for selection (`select.ts`), but
 * `validated` is included because a human who marks an item `validated` has
 * affirmed it, and treating that as "no longer protected" would make the
 * strongest human endorsement the weakest guard. */
export function governsNormatively(ctx: MutationContext, item: Item): boolean {
  return tierOf(ctx, item) === 'normative' && GOVERNING_STATUS[item.status];
}

/**
 * Which statuses govern, as a table keyed BY `Status` rather than a list of
 * the two that do.
 *
 * `governsNormatively` above is the whole test — tier and status — but tier
 * needs a resolved `Config`, and one reader has items and no config: the
 * import collision report (`pack/collide.ts`), which must say whether
 * approving an overwrite stops an item governing, and is rendered from two
 * `Item`s and nothing else. It reads the status half from here rather than
 * spelling the two members again beside it.
 *
 * `Record<Status, boolean>` and not `Status[]`: a sixth member added to the
 * union fails to compile here, where a list would keep compiling and quietly
 * answer `false` for it.
 */
export const GOVERNING_STATUS: Record<Status, boolean> = {
  active: true,
  validated: true,
  draft: false,
  superseded: false,
  deprecated: false,
};

/**
 * The fields that decide whether — and how forcefully — an item is injected:
 * `scope` (which files it attaches to), `always` (whether it is pinned at
 * every session start), `continuity` (whether it is re-delivered on every
 * session start and after every compaction) and `severity`. Changing any of them on a governing
 * item is functionally identical to the `status` change `updateItem`
 * (mutate.ts) refuses — the item
 * stops reaching the session — but leaves it `active`, so it shows up in no
 * draft queue, no retired count, and no selection spill (it was never a
 * candidate). That silence is what makes it worse than the status change,
 * not better, so it gets the same refusal.
 */
export const GUARDED_FIELDS = {
  scope: 'scope',
  always: 'always flag',
  continuity: 'continuity flag',
  severity: 'severity',
} as const;

/**
 * `scope` is a SET, not a sequence: `contentHash` (above) sorts it before
 * hashing precisely because glob order carries no meaning — `['a/**',
 * 'b/**']` and `['b/**', 'a/**']` attach the item to exactly the same files.
 * Comparing it positionally here would contradict that and make the guard
 * below refuse a no-op reorder as if it were a real narrowing of the item's
 * reach, with a message accusing the caller of neutralising a constraint it
 * never touched. Sorting both sides first makes the comparison agree with
 * what `scope` actually means everywhere else in this module.
 */
function sameScope(a: string[], b: string[]): boolean {
  return sameStringSet(a, b);
}

/** Order-insensitive equality, for the two `Item` fields that are sets rather
 * than sequences: `scope` (above) and `tags` — `contentHash` sorts both before
 * hashing, and `stageRevision`'s own comparison (revision.ts `sameValue`)
 * sorts them too, so a reordering must not read as a change at any of the
 * three. */
function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Which guarded field, if any, this input would actually CHANGE. Sending a
 * field back unchanged (a model echoing what it just read) is not a change
 * and must not be refused, or every round-trip edit becomes an error.
 */
export function guardedChange(item: Item, input: UpdateInput): keyof typeof GUARDED_FIELDS | null {
  if (input.scope !== undefined && !sameScope(input.scope.map((g) => normalizePosix(g)), item.scope)) {
    return 'scope';
  }
  if (input.always !== undefined && input.always !== item.always) return 'always';
  if (input.continuity !== undefined && input.continuity !== item.continuity) return 'continuity';
  if (input.severity !== undefined && input.severity !== item.severity) return 'severity';
  return null;
}

/**
 * **Every field of `UpdateInput` that names item data, and which policy governs
 * it. This table is the gate's input; nothing else is.**
 *
 * The hole this closes, stated as the bug rather than the fix: the staging
 * policy used to be keyed to whichever fields `RevisionChanges` happened to
 * carry, and the refusal policy to whichever fields `GUARDED_FIELDS` happened
 * to list. `extra` was in neither, so it was silently the one writable field
 * with NO policy at all — an agent holding only the MCP tools could rewrite
 * `rule.directive` on a governing, active, hard rule and have it apply at once.
 * Nothing was wrong with either list; the wrongness was that a field could
 * belong to no list and nobody would be told.
 *
 * So the classification comes first and the two lists are checked against it:
 *
 *  - `satisfies Record<Exclude<keyof UpdateInput, 'id' | 'origin'>, …>` means a
 *    field added to `UpdateInput` without a class here does not COMPILE. That
 *    is the whole point — the failure mode was a field nobody classified.
 *  - The four assertions below pin the two lists to it in both directions, so
 *    "content" cannot come to mean something a revision cannot carry, and
 *    "gated" cannot come to mean something no guard refuses.
 *
 * `content` is what a revision may carry and what `agentEdits` routes: it
 * changes what the agent is TOLD. `gated` is what stays a human decision on a
 * governing normative item: it changes whether, where and how forcefully the
 * item is injected at all. `extra` is content — it holds `rule.directive`,
 * which decides whether a rule prohibits or prescribes, and that is the
 * plainest possible case of changing what the agent is told.
 *
 * **Exported for one reader outside this module.** `skills/mycontext/SKILL.md`
 * states the content half of this table in prose — "stages a change to title,
 * body, tags or extra" — in the file the model loads at every session start,
 * and `test/plugin-assets.test.ts` derives that sentence from here rather than
 * repeating it. It was a literal there, which meant a fifth content field
 * would have left the always-loaded sentence naming four and the test green.
 */
type FieldPolicy = 'content' | 'gated';

export const UPDATE_FIELD_POLICY = {
  title: 'content',
  body: 'content',
  // Content, and the ruling is explicit that no exception is carved for it: a
  // summary write is an edit, so `agentEdits` routes it exactly as it routes a
  // title or a body. On a category set to `review` an agent's proposed summary
  // is STAGED for a human, which is what stops the most quotable field on an
  // item from being the one field an agent can rewrite unreviewed.
  summary: 'content',
  tags: 'content',
  extra: 'content',
  scope: 'gated',
  always: 'gated',
  continuity: 'gated',
  severity: 'gated',
  status: 'gated',
} as const satisfies Record<Exclude<keyof UpdateInput, 'id' | 'origin'>, FieldPolicy>;

type UpdateField = keyof typeof UPDATE_FIELD_POLICY;
type FieldOfPolicy<P extends FieldPolicy> =
  { [K in UpdateField]: (typeof UPDATE_FIELD_POLICY)[K] extends P ? K : never }[UpdateField];
type ContentField = FieldOfPolicy<'content'>;
type GatedField = FieldOfPolicy<'gated'>;

/** Compile-time only, and erased entirely: `Assert<false>` violates the
 * constraint and `tsc --noEmit` fails with the alias's name. */
type Assert<T extends true> = T;

// A field classified `content` must be one a staged revision can actually
// carry, or `agentEdits: "review"` would have nothing to stage for it and it
// would fall through to the direct apply — which is precisely what `extra` did.
type _ContentIsStageable = Assert<ContentField extends RevisionField ? true : false>;
// And the reverse, so a revision can never carry a field this table does not
// call content: that would be a route around the gate rather than a proposal.
type _StageableIsContent = Assert<RevisionField extends ContentField ? true : false>;
// A field classified `gated` must be one an actual guard refuses. The guards
// are `guardedChange` (scope/always/continuity/severity) and `updateItem`'s status rule;
// widening `GUARDED_FIELDS` is out of scope here, so this asserts agreement
// rather than producing it.
type _GatedIsGuarded =
  Assert<GatedField extends keyof typeof GUARDED_FIELDS | 'status' ? true : false>;
type _GuardedIsGated =
  Assert<keyof typeof GUARDED_FIELDS | 'status' extends GatedField ? true : false>;

const CONTENT_FIELDS = (Object.keys(UPDATE_FIELD_POLICY) as UpdateField[])
  .filter((field): field is ContentField => UPDATE_FIELD_POLICY[field] === 'content');
const GATED_FIELDS = (Object.keys(UPDATE_FIELD_POLICY) as UpdateField[])
  .filter((field): field is GatedField => UPDATE_FIELD_POLICY[field] === 'gated');

/** `title` and `body` already normalized, beside the raw input — see
 * `contentChange` for why the normalized pair travels separately. */
interface NormalizedUpdate {
  input: UpdateInput;
  title: string | undefined;
  body: string | undefined;
  /** `''` is the CLEAR instruction, not an absent one — see `UpdateInput.summary`. */
  summary: string | undefined;
}

/**
 * Per content field: the value this update would MOVE it to, or `undefined`
 * when it does not move.
 *
 * A `Record<ContentField, …>` rather than a chain of `if`s, so a field
 * classified as content with no reader here is a compile error rather than a
 * field that silently stages nothing. `extra`'s reader is the one that is not a
 * plain comparison: `updateItem` MERGES `extra`, so the moved value is the
 * subset of keys that actually differ — matching `normalizeChanges`
 * (revision.ts), which narrows identically, so this module cannot decide to
 * stage something that one then refuses as an empty proposal.
 */
const CONTENT_READERS: Record<
  ContentField, (item: Item, update: NormalizedUpdate) => RevisionValue | undefined
> = {
  title: (item, u) => (u.title !== undefined && u.title !== item.title ? u.title : undefined),
  body: (item, u) => (u.body !== undefined && u.body !== item.body ? u.body : undefined),
  // `item.summary ?? ''` because a revision carries strings, and the absence
  // of a summary is spelled `''` on this side of the boundary (`RevisionValue`
  // has no `null`). That makes both directions comparable and both stageable:
  // proposing a summary for an item that has none, and proposing to remove one
  // it has. An echo — the summary it already carries — is not a change, the
  // same rule every other reader here applies.
  summary: (item, u) => (
    u.summary !== undefined && u.summary !== (item.summary ?? '') ? u.summary : undefined
  ),
  tags: (item, u) => (
    u.input.tags !== undefined && !sameStringSet(u.input.tags, item.tags)
      ? [...u.input.tags]
      : undefined
  ),
  extra: (item, u) => {
    if (u.input.extra === undefined) return undefined;
    const moved: Record<string, string> = {};
    for (const key of Object.keys(u.input.extra)) {
      const before = Object.hasOwn(item.extra, key) ? item.extra[key] : undefined;
      if (u.input.extra[key] !== before) moved[key] = u.input.extra[key];
    }
    return Object.keys(moved).length === 0 ? undefined : moved;
  },
};

/** Per gated field: whether this update would move it. Same shape and same
 * reason as `CONTENT_READERS` — an unclassified or unread field is a compile
 * error, not a silent pass. */
const GATED_READERS: Record<GatedField, (item: Item, input: UpdateInput) => boolean> = {
  scope: (item, input) => (
    input.scope !== undefined && !sameScope(input.scope.map((g) => normalizePosix(g)), item.scope)
  ),
  always: (item, input) => input.always !== undefined && input.always !== item.always,
  continuity: (item, input) => (
    input.continuity !== undefined && input.continuity !== item.continuity
  ),
  severity: (item, input) => input.severity !== undefined && input.severity !== item.severity,
  status: (item, input) => input.status !== undefined && input.status !== item.status,
};

/**
 * The CONTENT fields this input would actually CHANGE, in the shape
 * `stageRevision` takes — or null when it changes none.
 *
 * `title` and `body` arrive already normalized (`.trim()`, `normalizeEol`),
 * because `updateItem` normalizes them before any guard runs and the values
 * this returns must be the ones that would have been written. That is also
 * what keeps this in step with `normalizeChanges` (revision.ts), which
 * normalizes identically: a field this function calls changed and that one
 * calls unchanged would make `stageRevision` refuse a call this module had
 * already decided to stage.
 *
 * Spec §4 names "title, body, observations and tags" as content. There is no
 * `observations` here because `UpdateInput` has none — no write surface can
 * edit an existing item's observations at all, so its absence takes nothing
 * away; `REVISION_FIELDS` (revision.ts) records the same reasoning.
 *
 * An echo is not a change, the same rule `guardedChange` applies one field
 * over: without it, every read-modify-write round trip would stage a revision
 * that proposes the text already in force.
 */
export function contentChange(
  item: Item, input: UpdateInput, title: string | undefined, body: string | undefined,
  summary: string | undefined,
): RevisionChanges | null {
  const update: NormalizedUpdate = { input, title, body, summary };
  const out: Record<string, RevisionValue> = {};
  for (const field of CONTENT_FIELDS) {
    const moved = CONTENT_READERS[field](item, update);
    if (moved !== undefined) out[field] = moved;
  }
  return Object.keys(out).length === 0 ? null : out as RevisionChanges;
}

/**
 * What a non-human caller may still do to CONTENT on this item, as a phrase
 * with no trailing punctuation, for the two refusal messages that end by
 * naming it.
 *
 * Both messages used to say flatly that "title, body, tags and extra are still
 * editable here". That was true of every build before `agentEdits` existed and
 * is only true of `allow` now: under `review` the same call is accepted and
 * STAGED, and telling a caller its next edit will be applied when it will be
 * held is the kind of claim this project treats as a defect — the caller would
 * go on to reason about text that is not in force, which is the whole failure
 * the staged-revision message exists to prevent.
 *
 * `extra` used to be called out as an exception here — "extra applies directly"
 * — because `RevisionChanges` could not carry it. It can now, and it is content
 * like the rest (`UPDATE_FIELD_POLICY`), so the exception is gone rather than
 * reworded: it was the sentence describing the hole.
 */
export function openContentPhrase(ctx: MutationContext, item: Item): string {
  if (agentEditsFor(ctx.config, item.type) !== 'review') {
    return 'Title, body, summary, tags and extra are still editable';
  }
  return (
    `Title, body, summary, tags and extra can still be changed here, but "${item.type}" is set to ` +
    `agentEdits: "review" in this project, so such a change is STAGED as a pending revision for ` +
    `a human rather than applied`
  );
}

/** The same fact as a trailing note, for the message whose main clause
 * ("every other field is editable") stays true under both policies — a DRAFT
 * normative item, which no field guard restricts. Empty under `allow`. */
export function stagedContentCaveat(ctx: MutationContext, item: Item): string {
  if (agentEditsFor(ctx.config, item.type) !== 'review') return '';
  return (
    ` Note that "${item.type}" is set to agentEdits: "review" in this project, so a change to ` +
    `title, body, summary, tags or extra is STAGED as a pending revision for a human rather than ` +
    `applied.`
  );
}

/** The field names a `RevisionChanges` carries, for a message. Read off the
 * object rather than a literal list, so it names what is actually there. */
export function fieldList(changes: RevisionChanges): string {
  return Object.keys(changes).join(', ');
}

/**
 * The names of every GATED field this input would actually change — everything
 * a `RevisionChanges` cannot carry. Used only to detect a mixed call; see
 * `updateItem`, which refuses one rather than applying half of it.
 *
 * Read off `UPDATE_FIELD_POLICY` rather than listed again, and every entry goes
 * through `GATED_READERS`, so this cannot drift from what the gate classifies —
 * `extra` used to be listed here by hand, which described it as a field a
 * revision cannot carry at the same time as nothing refused it.
 *
 * All of them, not the first: `guardedChange` returns only the first field it
 * finds, and a refusal naming one of three changes would leave the caller to
 * discover the other two by retrying.
 */
export function nonContentChanges(item: Item, input: UpdateInput): string[] {
  return GATED_FIELDS.filter((field) => GATED_READERS[field](item, input));
}
