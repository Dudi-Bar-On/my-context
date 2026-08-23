/**
 * **Fields store, tags index — and the projection is GENERATED, never typed.**
 *
 * The owner's ruling of 2026-08-23, which is the design this module
 * implements: **update is not a legal operation on a tag.** A tag is a
 * MEMBERSHIP and a set supports add and remove; what looks like an update is a
 * remove plus an add — two operations that can half-fail, and that a typo turns
 * into a silent third membership. So the test is one sentence: *if you would
 * ever want to update it, it is a field.* Where a field must stay filterable,
 * the tool PROJECTS a tag from it (`<projectsTo>:<value>`, declared on
 * `UpdatableName.projectsTo` in categories.ts) so the two cannot disagree, and
 * remove-then-add is atomic because a machine does both.
 *
 * **This is not theory, and it is not a suspicion.** Measured over this
 * project's own corpus with `loadLayer` — the real parser, not a grep — on
 * 2026-08-23: 293 `task` items, every one carrying a `state:` TAG, 213 of them
 * also carrying a `state` FIELD, and FIFTEEN of those disagreeing — nine
 * reading `done` as a tag against `todo` as a field, five `done`/`doing`, one
 * `done`/`blocked`. 198 agree, and the remaining eighty carry the tag and no
 * field at all: 15 + 198 + 80 = 293, which is the whole population and is how
 * the count was checked. Nothing synced them and nothing checked them: before this
 * module, no code anywhere read or validated the `plan:`/`seq:`/`state:`
 * prefixes, so `state:donee` would have removed a task from every progress view
 * with no gate noticing. The field values include `doing`, which is not a tag
 * value anywhere in the corpus — the two halves of one name had drifted into
 * two different vocabularies.
 *
 * **GROUPING AND FILTERING KEEP WORKING UNCHANGED, and that is the whole
 * point.** Nothing here deletes a tag. `focus`, `search --tag`, `query_items`
 * and every progress view read `item.tags` today and read exactly the same
 * `plan:port` and `state:todo` afterwards — `filterItems` (search.ts) is
 * untouched and `select`/`focus.ts` are untouched. What changes is only WHO
 * writes the projected tag: a machine, from the field, instead of a person,
 * from memory.
 *
 * ---
 *
 * ## THE SEAM — what `src/cli/commands/edit.ts` must call, and in what order
 *
 * `edit.ts` is where `--state` is wired (plan:categories seq 15) and it is NOT
 * touched by this module. This is the handoff, and the order is load-bearing:
 *
 * 1. **`--tags` — refuse a hand-written projection, before the preview.**
 *    Once `item` is in hand, next to the existing `validateExtra` call:
 *
 *        const refusal = handWrittenProjectionError(ws.config, item.type, tags);
 *        if (refusal) { say(out, refusal); return 1; }
 *
 *    Before the preview, so the message's "nothing was changed" is true — the
 *    same placement, for the same reason, that `validateExtra` and
 *    `scopeRequirementError` already have in this command.
 *
 * 2. **`--state <value>` (and every other projected field) — project, before
 *    the preview.** After the item is loaded and before `changesOf` builds the
 *    diff a human is asked to approve:
 *
 *        const projected = projectFieldUpdate(ws.config, item, { state: value });
 *        patch.extra = { ...patch.extra, ...projected.extra };
 *        if (projected.tags !== undefined) patch.tags = projected.tags;
 *
 *    `projectFieldUpdate` THROWS on a value outside the declared vocabulary,
 *    with `updatableValueError`'s words (validate.ts) — so catch it the way
 *    this command already catches `validateExtra`, and refuse before the
 *    preview. Step 1 runs before step 2 deliberately: a command that
 *    hand-writes the tag *and* sets the field has two readings, and honouring
 *    either would drop the other without saying so — the rule `--clear --tag`
 *    is already refused under (focus.ts).
 *
 * 3. **Nothing else.** `projected.tags` is the WHOLE replacement list, already
 *    containing every unrelated tag the item carried. `updateItem` assigns
 *    `item.tags = input.tags` outright (mutate.ts) and merges only `extra`, so
 *    merging this list again would duplicate tags. Pass it through as it is.
 *
 * Because the tag rewrite is on the patch before the preview, the diff a human
 * approves shows both halves of the change — the field moving and the tag being
 * rewritten from it — rather than showing the field and performing the tag.
 *
 * ---
 *
 * ## What this module deliberately does NOT do
 *
 * It does not migrate anything. `projectFieldUpdate` reconciles only the
 * projections whose field the CALLER is moving, so an unrelated `--title` edit
 * does not silently rewrite an item's tags. Reconciling the fifteen items that
 * already disagree is `plan:categories seq 19`, a separate task with its own
 * audit trail. What this module gives that task is `projectionMismatches`, and
 * what it gives everyone until then is `mycontext doctor`, which now names
 * every one of them instead of nothing at all.
 */
import { TIER_UPDATES, type CategoryUpdates, type UpdatableName } from './categories.ts';
import type { Config } from './config.ts';
import type { Item } from './types.ts';
import { GENERIC_EXTRA_COMMAND, updatableExtraError } from './validate.ts';

/**
 * One declared field that projects a tag, flattened into the shape every caller
 * here actually needs.
 *
 * `command` is resolved rather than optional: `UpdatableName.command` is absent
 * exactly when the generic `--extra` spelling applies (its own doc comment says
 * so), and a refusal whose job is to name the command that works cannot be
 * handed an absent one.
 */
export interface Projection {
  /** The frontmatter field that STORES the value, e.g. `state`. */
  field: string;
  /** The tag prefix generated from it, e.g. `state` — the tag is `state:done`. */
  prefix: string;
  /** The closed vocabulary, or `undefined` for free text. */
  values?: readonly string[];
  /** How the field is changed, as it is typed. */
  command: string;
}

/**
 * Every updatable name in force for an item of category `type`: the TIER's
 * rules, overlaid with the category's OWN.
 *
 * The two tables are merged HERE rather than in config.ts because
 * `TIER_UPDATES` declares the general rules once — 24 categories would
 * otherwise carry 24 copies of one fact — while `ResolvedCategory.updates`
 * carries only what is genuinely the category's own. A category's own entry
 * WINS on a name collision: a category that redeclares `status` means to narrow
 * it, the way the `rationale` tier already narrows `severity` to `['soft']`.
 *
 * A type absent from config resolves to `{}` — not to a tier default, because
 * there is no tier to read. That is the direction `updateItem`'s
 * missing-category branch already takes ("does nothing on purpose"): an item
 * whose category was renamed or removed after capture has no declaration to be
 * checked against, and inventing one would refuse edits against a list that no
 * longer exists. `Object.hasOwn`, not a bare index, for the prototype hazard a
 * `type` of `"constructor"` carries — this codebase has been bitten by it six
 * times.
 */
export function updatesFor(config: Config, type: string): CategoryUpdates {
  if (!Object.hasOwn(config.categories, type)) return {};
  const category = config.categories[type];
  return { ...TIER_UPDATES[category.tier], ...category.updates };
}

/** The declaration for one updatable name, or `null`. Prototype-safe. */
export function updatableFor(
  config: Config, type: string, name: string,
): UpdatableName | null {
  const updates = updatesFor(config, type);
  return Object.hasOwn(updates, name) ? updates[name] : null;
}

/**
 * Every field of this category that projects a tag, in field-name order so two
 * runs over one corpus produce the same report.
 *
 * `store: 'field'` is required as well as `projectsTo`: a `tag` claiming to
 * project one would be a membership generating a membership, which is not a
 * thing, and honouring it would let a declaration bug rewrite a user's tags. It
 * is skipped rather than thrown on — a read path that throws takes `doctor`
 * down with it — and there is no `doctor` finding for it because
 * `test/core/tag-projection.test.ts` refuses the shipped catalogue on it, which
 * is where a declaration bug belongs.
 */
export function projectionsFor(config: Config, type: string): Projection[] {
  const updates = updatesFor(config, type);
  return Object.keys(updates).sort().flatMap((field) => {
    const decl = updates[field];
    if (decl.store !== 'field' || decl.projectsTo === undefined) return [];
    return [{
      field,
      prefix: decl.projectsTo,
      values: decl.values,
      command: decl.command ?? GENERIC_EXTRA_COMMAND,
    }];
  });
}

/** The projection for one field name, or `null` when that field projects nothing. */
export function projectionFor(
  config: Config, type: string, field: string,
): Projection | null {
  return projectionsFor(config, type).find((p) => p.field === field) ?? null;
}

/** The one place `<prefix>:<value>` is spelled. */
export function projectedTag(projection: Projection, value: string): string {
  return `${projection.prefix}:${value}`;
}

/**
 * Every value this tag list carries under a projection's prefix, in list order.
 *
 * A LIST, not a value, because the COUNT is the defect: two `state:` tags is
 * exactly the silent third membership a remove-then-add typo produces, and a
 * function that returned the first would hide it.
 */
export function projectedTagValues(
  tags: readonly string[], projection: Projection,
): string[] {
  const prefix = `${projection.prefix}:`;
  return tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
}

/**
 * The tag list this item must carry once `projection.field` holds `value` —
 * remove-then-add performed as ONE function, which is the whole reason the
 * projection exists.
 *
 * The first tag under the prefix keeps its SLOT and takes the new value; any
 * further tag under the same prefix is dropped, which is how a pre-existing
 * duplicate membership is healed rather than preserved. A projection with no
 * tag yet appends. `value === undefined` removes the projection entirely — no
 * field, no tag; `validateExtra` refuses an empty string, so clearing a field
 * is not expressible through `--extra` today, and this branch exists so that
 * when it is, the tag does not outlive the value it was generated from.
 *
 * Every tag that is not under this prefix is returned untouched and in its
 * original position. That is the guarantee `focus` and `search --tag` depend
 * on: `plan:port` is not this projection's business and must survive a change
 * to `state`.
 */
export function reconcileTags(
  tags: readonly string[], projection: Projection, value: string | undefined,
): string[] {
  const prefix = `${projection.prefix}:`;
  const out: string[] = [];
  let written = false;
  for (const tag of tags) {
    if (!tag.startsWith(prefix)) { out.push(tag); continue; }
    if (written || value === undefined) continue;
    out.push(projectedTag(projection, value));
    written = true;
  }
  if (!written && value !== undefined) out.push(projectedTag(projection, value));
  return out;
}

/**
 * What `edit.ts` calls (step 2 of the seam above): the `extra` patch it was
 * given, plus the tag list that patch implies.
 *
 * THROWS on a value outside a declared vocabulary, before returning anything —
 * so `state:donee` is impossible rather than merely undetected, and the refusal
 * lands before a preview is printed or a file is touched. Every declared name
 * carrying a `values` list is checked, projected or not: `directive` on a
 * `rule` has a closed vocabulary and no projection, and there is no reading
 * under which a typo there should be accepted because the field happens not to
 * be filterable.
 *
 * `tags` is `undefined` when nothing about the tag list would change — an echo
 * (`--state done` on an item already at `done` with the right tag) is not a
 * change, and returning an identical list would make `changesOf` (edit.ts)
 * report a tags edit that moved nothing and ask a human to approve it.
 */
export function projectFieldUpdate(
  config: Config,
  item: Pick<Item, 'type' | 'tags' | 'extra'>,
  extra: Record<string, string>,
): { extra: Record<string, string>; tags?: string[] } {
  const refusal = updatableExtraError(extra, updatesFor(config, item.type));
  if (refusal !== null) throw new Error(refusal);

  let tags = [...item.tags];
  for (const projection of projectionsFor(config, item.type)) {
    if (!Object.hasOwn(extra, projection.field)) continue;
    tags = reconcileTags(tags, projection, extra[projection.field]);
  }

  const unchanged =
    tags.length === item.tags.length && tags.every((t, i) => t === item.tags[i]);
  return unchanged ? { extra } : { extra, tags };
}

/**
 * The refusal for a hand-written projected tag, or `null` when every tag in the
 * list is a person's to write.
 *
 * Called by `edit.ts` on `--tags` (step 1 of the seam). It names the command
 * that does work, because a refusal that only says "no" leaves the caller with
 * the same intention and no route — the point of the ruling is that the value
 * moves to a field, not that it becomes unwritable.
 *
 * The FIRST offending tag, not all of them, for the same reason
 * `unknownExtraFieldError` (trust.ts) reports the first offending key: the
 * sentence is long, it is identical for every one of them, and a person fixes
 * them one at a time.
 */
export function handWrittenProjectionError(
  config: Config, type: string, tags: readonly string[] | undefined,
): string | null {
  if (tags === undefined) return null;
  for (const projection of projectionsFor(config, type)) {
    const prefix = `${projection.prefix}:`;
    const offending = tags.find((t) => t.startsWith(prefix));
    if (offending === undefined) continue;
    const value = offending.slice(prefix.length);
    const spelling = projection.values !== undefined && projection.values.includes(value)
      ? value
      : '<value>';
    return (
      `my_context: "${offending}" is a PROJECTED tag, and my_context writes it — it is ` +
      `generated from the "${projection.field}" field and rewritten whenever that field moves, ` +
      `so a hand-written one is either overwritten without notice or left disagreeing with the ` +
      `field, which is the drift \`mycontext doctor\` reports as tag_projection_drift. Update ` +
      `is not a legal operation on a tag: a tag is a MEMBERSHIP, and what looks like an update ` +
      `is a remove plus an add — two operations that can half-fail, and that a typo turns into ` +
      `a silent third membership. Nothing was changed. Set the field instead: ` +
      `\`${projection.command.replace('<value>', spelling)}\`, which writes the field and ` +
      `rewrites "${prefix}…" from it in one write, so the two cannot disagree. Every other tag ` +
      `you passed is a tag like any other — only the "${prefix}" prefix is reserved — and ` +
      `\`mycontext focus ${offending}\` and \`mycontext search --tag ${offending}\` go on ` +
      `working exactly as they do now. See mycontext_help("categories").`
    );
  }
  return null;
}

/**
 * How a field and the tag projected from it can fail to say the same thing.
 *
 * The set is TOTAL over one (item, projection) pair — every pair lands in
 * exactly one of these five or in "agrees", and `test/core/tag-projection.test.ts`
 * asserts that by enumerating the whole input space rather than by inspection.
 * That matters more than it looks: the measurement this module exists to make
 * honest was blind for the same reason a partial enumeration is blind, and a
 * mismatch kind nobody thought of is an item nobody sees.
 */
export type MismatchKind =
  /** Exactly one projected tag, a field, and they name different values. */
  | 'stale'
  /** More than one tag under the prefix — the silent third membership. */
  | 'duplicate'
  /** The field holds a value and NO tag was projected from it: invisible to every filter. */
  | 'absent'
  /** A value — in the field, in the tag, or in both — outside the declared vocabulary. */
  | 'unknown_value'
  /** A projected tag with no field behind it: the value lives only in the index. */
  | 'unprojected';

export interface ProjectionMismatch {
  itemId: string;
  projection: Projection;
  kind: MismatchKind;
  /** The stored value, or `null` when the field is absent. */
  field: string | null;
  /** Every value carried under the prefix, in tag order. */
  tagValues: string[];
}

function legal(projection: Projection, value: string): boolean {
  return projection.values === undefined || projection.values.includes(value);
}

/**
 * The one classifier, so `doctor`, the seq-19 migration and any future caller
 * read the same corpus the same way.
 *
 * The order of the branches is the order of severity, and it is deliberate.
 * `duplicate` outranks everything because two memberships is the failure the
 * ruling is ABOUT and no other branch can describe it. `unknown_value` is
 * checked before agreement, so a field and a tag that agree on `donee` are
 * still reported: two copies of a wrong answer is not a right one.
 */
export function projectionMismatch(
  item: Pick<Item, 'id' | 'tags' | 'extra'>, projection: Projection,
): ProjectionMismatch | null {
  const tagValues = projectedTagValues(item.tags, projection);
  const field = Object.hasOwn(item.extra, projection.field)
    ? item.extra[projection.field]
    : null;
  const at = (kind: MismatchKind): ProjectionMismatch =>
    ({ itemId: item.id, projection, kind, field, tagValues });

  if (tagValues.length === 0 && field === null) return null;
  if (tagValues.length > 1) return at('duplicate');
  if (tagValues.some((v) => !legal(projection, v))) return at('unknown_value');
  if (field !== null && !legal(projection, field)) return at('unknown_value');
  if (field === null) return at('unprojected');
  if (tagValues.length === 0) return at('absent');
  if (tagValues[0] !== field) return at('stale');
  return null;
}

/**
 * Every mismatch in a corpus, in item order then field order.
 *
 * An item whose category declares no projection contributes nothing and costs
 * one cached lookup — which is every item in every project that has not
 * declared one, so `doctor` on an untouched corpus pays effectively nothing for
 * this check.
 */
export function projectionMismatches(
  items: readonly Item[], config: Config,
): ProjectionMismatch[] {
  const byType = new Map<string, Projection[]>();
  const out: ProjectionMismatch[] = [];
  for (const item of items) {
    let projections = byType.get(item.type);
    if (projections === undefined) {
      projections = projectionsFor(config, item.type);
      byType.set(item.type, projections);
    }
    for (const projection of projections) {
      const mismatch = projectionMismatch(item, projection);
      if (mismatch !== null) out.push(mismatch);
    }
  }
  return out;
}
