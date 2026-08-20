import { readFileSync } from 'node:fs';
import path from 'node:path';
import { type MutationOp } from './audit.ts';
import { agentEditsFor, type Config, type ResolvedCategory } from './config.ts';
import { contentHash, itemContentHash } from './content-hash.ts';
import { parseItem } from './item.ts';
import { normalizePosix } from './paths.ts';
import {
  auditMutation, normalizeSource, persist, projectItem, projectItems, requireWritableItem,
  snapshotFields, movedFields, stampValidUntil, today,
} from './persist.ts';
import { isItemExistsError } from './rebuild.ts';
import { SUPERSEDED_BY } from './relations.ts';
// `revision.ts` imports `updateItem` back out of this module, so this edge
// closes a cycle. It resolves under ESM because both sides only ever CALL
// each other's hoisted `function` declarations, never read a binding while
// the other module is still evaluating. Nothing here may become a top-level
// `const` initialised from a `revision.ts` export, and nothing there may
// read one of ours — verified against the CLI, the MCP server and the hooks
// entry points, not only under `node --test`.
import { stageRevision, type RevisionChanges } from './revision.ts';
import { makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError } from './teach.ts';
import { normalizeEol } from './text.ts';
import {
  contentChange, governsNormatively, guardedChange, inertFieldError, inertFieldNote,
  nonContentChanges, openContentPhrase, scopeRequirementError, stagedContentCaveat,
  fieldList, tierOf, trustedStatus, unknownExtraFieldError, GUARDED_FIELDS,
} from './trust.ts';
import type { Item, Observation, Origin, Relation, Severity, Status } from './types.ts';
import {
  normalizeObservations, normalizeSteps, validateBody, validateEnums, validateExplicitId,
  validateExtra, validateObservationText, validateRelations, validateRelationTarget, validateScope,
  validateTags, validateTitle,
} from './validate.ts';

export interface MutationContext {
  /** Absolute path to the project layer root, i.e. `<repo>/.my_context`. */
  root: string;
  store: Store;
  config: Config;
}

export interface CreateInput {
  type: string;
  title: string;
  body?: string;
  /**
   * Explicit id. Defaults to an auto-allocated id derived from `title`.
   * Plan 4 requires this: a superseded item and its replacement share a title,
   * so the replacement needs an explicit revision id (`-r2`) to avoid colliding
   * with the item it replaces. `createItem` never overwrites an existing item
   * at this id — see the explicit-id handling below.
   */
  id?: string;
  /**
   * Checksum of the source passage at capture time. Plan 4's `doctor` compares
   * it against the live source to detect drift; hardcoding null here would make
   * drift undetectable for every ingested item.
   */
  sourceChecksum?: string | null;
  status?: Status;
  severity?: Severity;
  always?: boolean;
  scope?: string[];
  tags?: string[];
  origin?: Origin;
  sourceFile?: string | null;
  sourceAnchor?: string | null;
  observations?: Observation[];
  /**
   * A `procedure`'s ordered steps, as TEXT — never `Step[]`.
   *
   * A caller cannot set `checked`, so "nothing in this product ever writes
   * `checked: true`" holds by construction at this boundary rather than by
   * convention (`normalizeSteps`, validate.ts, sets it to `false` for every
   * entry). A box is ticked only by a human editing the Markdown.
   *
   * **Create-only, and deliberately absent from `UpdateInput`** (spec §6m.3):
   * that absence is what keeps `UPDATE_FIELD_POLICY` (trust.ts) and its four
   * `Assert<>` types compiling untouched, and it is the same shape
   * `observations` already has. Correcting a step means editing the file and
   * running `mycontext repair`; there is no command that edits or ticks one,
   * because progress lives in the audit log and never in the item.
   *
   * Accepted on EVERY category, `runbook` included. §6o says a runbook has no
   * `## Steps` field and this plan makes that documentary rather than
   * enforced: there is no category-conditional field rule anywhere in the
   * product to follow (`observations`, `scope` and `tags` are accepted on
   * every category) and adding the first one is a larger decision than §6o
   * took. What is category-specific is where the OFFER is made — `--step`'s
   * help and the `create_item` schema both name `procedure` and say what a
   * runbook does instead.
   */
  steps?: string[];
  relations?: Relation[];
  extra?: Record<string, string>;
}

export interface MutationResult {
  id: string;
  /** False when the call was a no-op: a duplicate, or an already-present link. */
  created: boolean;
  status: Status;
  filePath: string;
  message: string;
  /**
   * Present ONLY when the write was staged instead of applied — a non-human
   * caller's content edit under `agentEdits: "review"` (spec §4). The item is
   * unchanged on disk and in the index; `created` is `false` and `status` is
   * the status the item still has. Absent means the write was applied, so a
   * caller that ignores this field never mistakes an applied write for a
   * staged one, only the reverse — which is why `message` says it too.
   */
  staged?: {
    revisionId: string;
    /** True when this exact proposal was already pending; no new revision. */
    duplicate: boolean;
    /** How many OTHER proposals were already queued on this item. */
    alsoPending: number;
  };
}

/**
 * `ctx.config.categories[type]` would be a prototype-unsafe lookup — a type
 * of `"constructor"` resolves to `Object.prototype.constructor` and reports
 * a nonsensical "is disabled" instead of "unknown". `Object.hasOwn` guards it.
 */
function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {
  if (!Object.hasOwn(ctx.config.categories, type)) {
    // Only enabled categories are offered: naming a disabled one as the
    // "closest match" would invite a retry that create_item refuses too.
    const enabledNames = Object.values(ctx.config.categories)
      .filter((c) => c.enabled)
      .map((c) => c.name);
    throw new Error(enumError('type', type, enabledNames, 'categories'));
  }
  const category = ctx.config.categories[type];
  if (!category.enabled) {
    throw new Error(
      `my_context: category "${type}" is disabled in this project, so no new ` +
      `${type} items are accepted. Enable it in .my_context/config.json under ` +
      `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`,
    );
  }
  return category;
}

const MAX_FAMILY = 1000;

/**
 * Finds either a content duplicate among `base`, `base-2`, `base-3`, … (the
 * exact sequence `createItem` allocates into), or the next free id in that
 * sequence. Checking the whole family — not just `base` — matters: without
 * it, a third identical call to a title that has already collided once
 * would find `base` already an (unrelated) `base-2` sibling occupies and
 * think there is no duplicate, minting a third item for the same content.
 */
function familyId(base: string, n: number): string {
  return n === 1 ? base : `${base}-${n}`;
}

function familyExhausted(title: string): Error {
  return new Error(
    `my_context: cannot allocate an id for "${title}" — ${MAX_FAMILY} variants already exist. ` +
    `Use a more specific title.`,
  );
}

function locateInFamily(
  ctx: MutationContext, prefix: string, title: string, hash: string,
): { duplicate: Item | null; base: string; nextN: number } {
  const base = makeId(prefix, title);
  for (let n = 1; n <= MAX_FAMILY; n++) {
    const item = projectItem(ctx, familyId(base, n));
    if (!item) return { duplicate: null, base, nextN: n };
    if (itemContentHash(item) === hash) return { duplicate: item, base, nextN: n };
  }
  throw familyExhausted(title);
}

/**
 * The item ACTUALLY on disk at the path `item` would occupy — read from the
 * file, never from `ctx.store`. This is the whole point of the `EEXIST`
 * retry in `createItem`: the store snapshot is stale by construction (that
 * IS the bug being fixed), so consulting it again after losing the race
 * would just re-derive the same wrong answer.
 *
 * A file that exists but cannot be parsed is reported, not guessed at.
 * Under the `linkSync` construction (`createExclusive`, rebuild.ts) a target
 * that exists always holds complete content; under its no-hard-links
 * fallback there is a brief window where it is empty, and this is what that
 * window surfaces as — a visible error rather than a silent wrong answer.
 */
function itemAtPath(ctx: MutationContext, filePath: string): Item {
  const abs = path.join(ctx.root, ...filePath.split('/'));
  try {
    return parseItem(readFileSync(abs, 'utf8'), filePath, 'project');
  } catch (err) {
    throw new Error(
      `my_context: another process created ${filePath} at the same moment, but that file could ` +
      `not be read back to compare it with this content (${err instanceof Error ? err.message : String(err)}). ` +
      `Nothing was written. Check the file, then retry.`,
    );
  }
}

export function createItem(
  ctx: MutationContext, input: CreateInput, auditOp: MutationOp = 'create',
): MutationResult {
  const category = resolveCategory(ctx, input.type);

  const title = (input.title ?? '').trim();
  if (title === '') throw new Error(missingFieldError('title', 'create_item', 'capture'));
  // Normalized ONCE, here, into a local `body` that both the validator and
  // the stored item read — not validated-then-re-derived, and not stored
  // raw. `parseItem` (item.ts) normalizes line endings before splitting the
  // body into lines; a body carrying a lone `\r` (any Windows- or old-Mac-
  // authored source text) has no literal `\n` to reveal a hidden `## `
  // heading to a naive check, but normalizing after storage would have
  // already lost the chance — the checksum, and `contentHash` below, both
  // need to see the SAME normalized text the file will actually hold.
  const body = normalizeEol(input.body ?? '').trim();

  validateEnums(input);
  validateTitle(title);
  validateExtra(input.extra ?? {});
  // AFTER `validateExtra`, deliberately — see `unknownExtraFieldError`: a
  // reserved frontmatter name must keep failing as a collision, not as an
  // undeclared field whose remedy is to declare it.
  const extraRefusal = unknownExtraFieldError(ctx.config, category, input.extra);
  if (extraRefusal) throw new Error(extraRefusal);
  validateScope(input.scope ?? []);
  // Before anything is written, and before the id family is even consulted:
  // the refusal promises "nothing was written", and every write in this
  // function happens below.
  const scopeRefusal = scopeRequirementError(category, input.scope);
  if (scopeRefusal) throw new Error(scopeRefusal);
  // Spec §3, and here for the same reason the scope refusal is: before any
  // write, so "nothing was written" is true. Only the governing value of each
  // field is an assertion — see `inertFieldError` for why the neutral values
  // (`false`, `"soft"`) must stay accepted.
  if (input.always === true) {
    const refusal = inertFieldError(category, 'always');
    if (refusal) throw new Error(refusal);
  }
  if (input.severity === 'hard') {
    const refusal = inertFieldError(category, 'severity');
    if (refusal) throw new Error(refusal);
  }
  validateTags(input.tags ?? []);
  validateBody(body);
  // Normalized ONCE, here, into a local both `contentHash` below and the
  // stored item read — the same discipline `body` gets just above, for the
  // same reason: hashing the raw text and storing the normalized text (or
  // the reverse) puts the checksum permanently out of step with disk.
  const observations = normalizeObservations(input.observations ?? []);
  // Normalised ONCE, here, for the reason `body` and `observations` are — and
  // with one extra: `contentHash` below re-derives this from `input.steps`
  // through the SAME function, so a step that would be refused must be refused
  // before either sees it, and both must see the identical array.
  //
  // Unlike `normalizeObservations`, this trims nothing and collapses nothing:
  // `parseSteps` (item.ts) requires a step to re-render byte-identically to
  // the line it was read from, so a normalisation here would write a file that
  // no longer says what its author typed — or, for leading whitespace, one
  // that refuses to load at all. See `normalizeSteps`.
  const steps = normalizeSteps(input.steps ?? []);
  validateRelations(input.relations ?? []);
  // An id is a relation TARGET the moment anything later supersedes this
  // item (see `validateRelationTarget`'s doc comment) — guarded here, at
  // mint time, rather than only at whichever future `supersede_item`/
  // `link_items` call first tries to write it as one.
  if (input.id !== undefined) validateRelationTarget(input.id, '"id"');
  // ...and it is a FILENAME as well as a relation target, which
  // `validateRelationTarget` says nothing about: it refuses an empty string,
  // a line break and a "]", all of which a traversal id passes cleanly. See
  // `validateExplicitId`.
  if (input.id !== undefined) validateExplicitId(input.id, '"id"');

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  const hash = contentHash({ ...input, title, body, observations });

  // Spec §7.3: the idempotency key is `(source_file, source_anchor)` PLUS a
  // content hash — `type` is part of the match too, since a requirement and
  // a constraint captured from the same heading are different items, not a
  // collision. Content hash is folded into the match itself (not checked
  // after) so that different content at the same anchor simply falls
  // through to the normal id-allocation path below and creates a new item,
  // rather than being refused: a single heading routinely yields more than
  // one item, and a revision must be mintable at the same anchor as its
  // predecessor for supersede_item to have anything to wire together.
  const anchored = sourceFile !== null && sourceAnchor !== null
    ? projectItems(ctx).find(
        (i) => i.type === input.type && i.sourceFile === sourceFile &&
          i.sourceAnchor === sourceAnchor && itemContentHash(i) === hash,
      )
    : undefined;

  if (anchored) {
    return {
      id: anchored.id,
      created: false,
      status: anchored.status,
      filePath: anchored.filePath,
      message: `my_context: already captured as ${anchored.id}. Nothing changed.`,
    };
  }

  const origin: Origin = input.origin ?? 'human';
  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');
  const buildItem = (itemId: string): Item => ({
    id: itemId,
    type: input.type,
    title,
    status,
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    origin,
    sourceFile,
    sourceAnchor,
    sourceChecksum: input.sourceChecksum ?? null,
    validFrom: today(),
    validUntil: null,
    checksum: '',
    extra: input.extra ?? {},
    body,
    // Already validated and already `checked: false` throughout — see the
    // `normalizeSteps` call above. An input with no steps still produces `[]`,
    // which is what keeps a stepless item's `checksum` identical to what it
    // was before steps existed: `computeItemChecksum` adds the key only when
    // the list is non-empty (spec §6n.4), so every corpus that predates this
    // field hashes exactly as it did.
    steps,
    observations,
    relations: input.relations ?? [],
    layer: 'project',
    filePath: `items/${input.type}/${itemId}.md`,
  });

  const duplicateOf = (existing: Item): MutationResult => ({
    id: existing.id,
    created: false,
    status: existing.status,
    filePath: existing.filePath,
    message: `my_context: already captured as ${existing.id}. Nothing changed.`,
  });

  const occupiedError = (existingId: string): Error => new Error(
    `my_context: "${existingId}" already exists with different content. create_item never ` +
    `overwrites an existing item — call update_item(id: "${existingId}", ...) to change it, ` +
    `or supersede_item(id: "${existingId}", ...) to replace it with a new revision.`,
  );

  /**
   * Allocate an id and write the file, with the WRITE — not a store lookup —
   * as the thing that decides whether the id was free.
   *
   * `ctx.store` is a snapshot taken before this call; every check against it
   * is advisory, and under concurrency several processes read the same
   * snapshot, compute the same id, and each believe it is free. The store
   * checks below are kept because they answer the common questions cheaply
   * and produce the better messages (a duplicate is recognised without
   * touching the filesystem), but the guarantee comes from
   * `persist(..., { exclusive: true })`: `writeItem` creates the file with a
   * single atomic operation that fails if the name is taken, so exactly one
   * racer can win a given id. On losing, the loser reparses the file that is
   * ACTUALLY there — never `ctx.store`, which is stale by construction — and
   * either recognises its own content (a duplicate no-op) or moves to the
   * next id in the family.
   *
   * This lives in `persist`/`writeItem` rather than in a lock because
   * `writeItem` has ten call paths through `persist` and eight of them never
   * take the ingest apply lock; and because the ingest apply lock is
   * workspace-scoped and already held around `applyCandidates`, which calls
   * `createItem` — taking it here would deadlock that path.
   */
  let item: Item;
  if (input.id !== undefined) {
    // An explicit id names an item this call must never silently overwrite.
    // Only two outcomes are legal: it's the same content (a no-op duplicate),
    // or the caller is pointed at update_item/supersede_item instead. There
    // is no "next candidate" here — the caller named this exact id.
    const existing = projectItem(ctx, input.id);
    if (existing) {
      if (itemContentHash(existing) === hash) return duplicateOf(existing);
      throw occupiedError(input.id);
    }
    item = buildItem(input.id);
    try {
      persist(ctx, item, { exclusive: true });
    } catch (err) {
      if (!isItemExistsError(err)) throw err;
      const onDisk = itemAtPath(ctx, item.filePath);
      if (itemContentHash(onDisk) === hash) return duplicateOf(onDisk);
      throw occupiedError(item.id);
    }
  } else {
    const located = locateInFamily(ctx, category.prefix, title, hash);
    if (located.duplicate) return duplicateOf(located.duplicate);

    let written: Item | null = null;
    for (let n = located.nextN; n <= MAX_FAMILY && written === null; n++) {
      const candidate = buildItem(familyId(located.base, n));
      try {
        persist(ctx, candidate, { exclusive: true });
        written = candidate;
      } catch (err) {
        if (!isItemExistsError(err)) throw err;
        const onDisk = itemAtPath(ctx, candidate.filePath);
        if (itemContentHash(onDisk) === hash) return duplicateOf(onDisk);
        // Someone else's item holds this id: advance in the same sequence
        // `locateInFamily` allocates into, and try again.
      }
    }
    if (written === null) throw familyExhausted(title);
    item = written;
  }
  const id = item.id;

  // Gated on the rule having actually fired — not merely on the resulting
  // status — so a caller that explicitly asks for `draft` on a non-normative
  // (e.g. rationale) item never sees a demotion explanation for a demotion
  // that did not happen. Since this can then only ever be the normative
  // case, the message says "normative" literally rather than interpolating
  // `category.tier`, so it cannot drift from the condition again. The
  // condition mirrors `trustedStatus` exactly (`origin !== 'human'`, not
  // `origin === 'agent'`) — an ingested item that gets demoted must get the
  // same explanation an agent-authored one does, or the message would be
  // silently missing for the one path (batch ingestion, spec §7.2) that is
  // going to demote the most items.
  const suffix = origin !== 'human' && category.tier === 'normative' && (input.status ?? 'active') !== 'draft'
    ? ` It is a draft because non-human-authored normative items are not injected until ` +
      `reviewed — a human can promote it with \`mycontext review promote ${id}\`.`
    : '';

  // After the write, and only on the path that actually wrote: the duplicate
  // returns above (`duplicateOf`) created nothing, so they record nothing.
  const audited = auditMutation(ctx, auditOp, origin, id);

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message:
      `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}${audited}`,
  };
}

export interface UpdateInput {
  id: string;
  title?: string;
  body?: string;
  scope?: string[];
  tags?: string[];
  severity?: Severity;
  always?: boolean;
  status?: Status;
  extra?: Record<string, string>;
  origin?: Origin;
}

export interface SupersedeInput {
  id: string;
  by: string;
  reason?: string;
  origin?: Origin;
}

/**
 * The second write path. `createItem` is the only place a non-human-authored
 * normative item gets forced to `draft` (via `trustedStatus`) — but nothing
 * stops a non-human caller from *editing* an already-active constraint, so
 * the boundary that matters here is narrower and different: a non-human
 * caller may PROPOSE a change to a governing normative item's content —
 * `title`, `body`, `tags` and `extra` (that is deliberate — an agent sharpening
 * the wording of a rule is the point of the tool) — and whether the proposal
 * applies at once or waits for a human is the category's `agentEdits` setting,
 * below. What it may not touch at all is `status`, or the injection-control
 * fields `scope`/`always`/`severity`. Forcing `draft` here
 * would be wrong (spec intent, see module docs) — it would let a non-human
 * caller demote a human's active constraint just by editing its body — so an
 * attempted change is refused outright rather than silently rewritten.
 *
 * Both refusals are narrow on purpose, and gated on the same predicate:
 * non-human origin, normative tier, and currently governing — the same
 * `!== 'human'` widening as `trustedStatus`, for the same reason: `'ingest'`
 * reaches this tool exactly the same way `'agent'` does, and an ingestion
 * pipeline retiring or defanging a human's governing constraint is no less
 * dangerous than an agent doing it interactively. A caller editing its own
 * `draft` (which governs nothing yet), or any rationale item, is unaffected
 * in every field, regardless of origin.
 */
export function updateItem(
  ctx: MutationContext, input: UpdateInput, auditOp: MutationOp = 'update',
): MutationResult {
  const item = requireWritableItem(ctx, input.id);
  const origin: Origin = input.origin ?? 'human';

  // Every replacement value is normalized and validated up front, before
  // any trust-boundary check runs and before `item` is touched — the same
  // ordering `createItem` uses, and the same reason: a shape violation
  // (an unreadable-once-written body, title, scope glob or tag) is refused
  // on its own terms rather than surfacing as a confusing trust-boundary
  // error, or worse, silently corrupting the file after the trust check
  // passes. `update_item` is a first-class MCP surface (not merely an
  // ingest-adjacent one), so it needs the identical guards `create_item`
  // does for the identical fields — see `validateTitle`/`validateScope`/
  // `validateTags` (validate.ts).
  const title = input.title !== undefined ? input.title.trim() : undefined;
  const body = input.body !== undefined ? normalizeEol(input.body).trim() : undefined;

  validateEnums(input);
  if (input.extra !== undefined) validateExtra(input.extra);
  // The edit half of extra-field ownership, and before any mutation of `item`
  // so the message's "nothing was changed" is true. `Object.hasOwn` for the
  // prototype-safety reason `tierOf` documents, and the missing-category branch
  // does nothing on purpose: an item whose category was renamed or removed
  // after capture is still indexed (`loadLayer`, rebuild.ts) and has no
  // declaration to check against, so refusing every `extra` on it would strand
  // it behind a list that no longer exists — the same reason `scopePolicyFor`
  // resolves such an item to a product default rather than to a refusal.
  if (input.extra !== undefined && Object.hasOwn(ctx.config.categories, item.type)) {
    const refusal = unknownExtraFieldError(
      ctx.config, ctx.config.categories[item.type], input.extra, 'edit',
    );
    if (refusal) throw new Error(refusal);
  }
  if (title !== undefined) {
    if (title === '') throw new Error(missingFieldError('title', 'update_item', 'capture'));
    validateTitle(title);
  }
  if (body !== undefined) validateBody(body);
  if (input.scope !== undefined) validateScope(input.scope);
  // The edit half of `scopePolicy: 'required'` — see `scopeRequirementError`
  // for why removing the last glob is refused as well as capturing without
  // one. Gated on the item actually LOSING globs, and placed before any
  // mutation of `item`, so the message's "nothing was changed" is true.
  // `tierOf`-style prototype safety comes from `Object.hasOwn` inside the
  // lookup; a type absent from config has no policy to enforce.
  if (input.scope !== undefined && input.scope.length === 0 && item.scope.length > 0 &&
      Object.hasOwn(ctx.config.categories, item.type)) {
    const refusal = scopeRequirementError(ctx.config.categories[item.type], input.scope, 'edit');
    if (refusal) throw new Error(refusal);
  }
  if (input.tags !== undefined) validateTags(input.tags);
  // Spec §3. Gated on the update actually MOVING the field to its governing
  // value — not on the value being present — for the reasons in
  // `inertFieldError`: an echo asserts nothing, and an item whose category was
  // retiered underneath it must stay editable. Placed before any mutation of
  // `item`, so "nothing was changed" is true, and before the trust-boundary
  // checks below so that a rationale item (which those checks never reach) is
  // refused on its own terms. `Object.hasOwn` for the same prototype-safety
  // reason `tierOf` documents; a type absent from config has no tier to read,
  // and `tierOf` already fails closed to `normative` for it.
  if (Object.hasOwn(ctx.config.categories, item.type)) {
    const category = ctx.config.categories[item.type];
    if (input.always === true && !item.always) {
      const refusal = inertFieldError(category, 'always', 'edit');
      if (refusal) throw new Error(refusal);
    }
    if (input.severity === 'hard' && item.severity !== 'hard') {
      const refusal = inertFieldError(category, 'severity', 'edit');
      if (refusal) throw new Error(refusal);
    }
  }

  if (origin !== 'human' && governsNormatively(ctx, item)) {
    const field = guardedChange(item, input);
    if (field) {
      // This message is only ever shown to a NON-HUMAN caller, so it must
      // name something that caller can actually do. It used to end by
      // telling it to edit the field in the item's Markdown file. That was
      // wrong twice over: the plugin's own PreToolUse hook
      // (src/hooks/pre-tool-use.ts) denies the model every Write/Edit under
      // `.my_context/items/`, so it was instructing the one caller who reads
      // it to do the one thing it is blocked from doing; and a hand edit
      // leaves the item failing its own recorded checksum, because every
      // write path re-stamps `checksum` through `persist` and a hand edit
      // does not, while `rebuild` only REPORTS the resulting mismatch (see
      // loadLayer in rebuild.ts) and never restamps it. `mycontext doctor`
      // then exits 1, blaming an edit made outside my_context.
      //
      // Until `mycontext edit` shipped there was no COMMAND that made this
      // change on an already-governing item, and this message said so — then
      // named hand edit + `mycontext repair` as the only thing a human could
      // do, while forbidding the caller from taking that route itself.
      //
      // `mycontext edit` (and its named forms `pin`/`unpin`/`harden`/`soften`)
      // makes exactly this change, behind a preview of what governs before and
      // after and a confirmation. So the old message was false in its main
      // clause, and its remedy was the one route this project's documentation
      // is not allowed to instruct: a hand edit leaves the item failing its
      // own recorded checksum until `repair` re-stamps it, and the pairing
      // leaves no evidence it happened. Naming a supported command instead is
      // both true and shorter.
      //
      // The prohibition stays, and for a reason that did not change: `edit`
      // passes `origin: 'human'`, which is precisely the claim a non-human
      // caller cannot make. Naming the route without forbidding it would turn
      // this refusal into an instruction to walk around itself.
      throw new Error(
        `my_context: a non-human caller cannot change the ${GUARDED_FIELDS[field]} of a governing ` +
        `normative item. ${item.id} is currently "${item.status}" and its ${GUARDED_FIELDS[field]} ` +
        `decides whether it is injected into a session at all, so changing it is a human ` +
        `decision. A human has a command for it: \`mycontext edit ${item.id} --${field} …\`, ` +
        `which previews what governs before and after and asks for confirmation ` +
        `(\`mycontext pin\`/\`unpin\` and \`harden\`/\`soften\` are that edit under a shorter ` +
        `name). Do not run it yourself: it passes origin "human", which is the one claim you ` +
        `cannot make, and it is on the deny list this plugin's README recommends. Ask the user. ` +
        `${openContentPhrase(ctx, item)}. A draft or rationale item is unaffected by THIS ` +
        `refusal. See mycontext_help("capture").`,
      );
    }
  }

  if (
    input.status !== undefined && input.status !== item.status &&
    origin !== 'human' && tierOf(ctx, item) === 'normative'
  ) {
    // The "what else is editable" clause has to match reality for *this*
    // item: on a governing (active/validated) normative item, scope/always/
    // severity are refused too (see the field guard above) — only the content
    // fields title, body, tags and extra remain open, and `openContentPhrase`
    // says whether they apply or are staged. A draft normative item has no such
    // restriction, so every other field really is editable there.
    const otherFields = governsNormatively(ctx, item)
      ? `${openContentPhrase(ctx, item)}; scope, always and severity are not, for the same reason.`
      : `Every other field is editable.${stagedContentCaveat(ctx, item)}`;
    // A human's next action differs by what `item` currently is, and only
    // one of the two branches has a route at all. A draft is one verb away
    // from `mycontext review promote`; anything else has NO command today —
    // `review` refuses a non-draft outright (see review.ts), and every MCP
    // write path hardcodes a non-human origin, so it lands right back here.
    // Conflating the two would send a human to `review promote` for an item
    // it refuses to touch.
    //
    // The non-draft branch went through two false versions — "edit `status:`
    // directly in its Markdown file", then a hand edit deterred by a checksum
    // mismatch `mycontext repair` had already made temporary. Both are retired
    // for the same reason as the sibling refusal above: `mycontext edit <id>
    // --status <name>` makes this change, behind a preview and a confirmation,
    // so there is a supported command to name and no reason to describe a
    // route this project's documentation must not instruct. `superseded` is
    // the one status `edit` refuses, because a retirement names its
    // replacement and records it in both directions.
    const humanRoute = item.status === 'draft'
      ? `A human can promote it with \`mycontext review promote ${item.id}\`.`
      : `A human has a command for it: \`mycontext edit ${item.id} --status <name>\`, which ` +
        `previews the change and asks for confirmation — or \`mycontext supersede ${item.id} ` +
        `--by <id>\` for a retirement, which is the one status \`edit\` refuses because it names ` +
        `a replacement. Do not run either yourself: both pass origin "human", which is the one ` +
        `claim you cannot make.`;
    throw new Error(
      `my_context: a non-human caller cannot change the status of a normative item. ` +
      `${item.id} stays "${item.status}". ${otherFields} Status changes on a ` +
      `normative item are a human decision. ${humanRoute} ` +
      `See mycontext_help("capture").`,
    );
  }

  // Spec §4, and the LAST thing before anything is written: a non-human
  // caller's edit to CONTENT is routed by the item category's `agentEdits`
  // policy. `review` stages it; `allow` falls through to the apply below,
  // which is what happened before this setting existed.
  //
  // Placed after both trust-boundary refusals above deliberately, and both
  // directions matter:
  //
  //  - `review` cannot become a route around them. A call that would change
  //    scope/always/severity/status on a governing normative item is refused
  //    up there and never reaches here, so nothing guarded can be staged.
  //    (`stageRevision` refuses those fields a second time on its own side;
  //    that is a backstop, not this rule.)
  //  - `allow` does not widen them either. It is read only here, on content;
  //    the refusals above do not consult it at all.
  //
  // `agentEditsFor` fails closed to `review` for a category absent from
  // config — see its doc comment.
  if (origin !== 'human' && agentEditsFor(ctx.config, item.type) === 'review') {
    const proposed = contentChange(item, input, title, body);
    if (proposed !== null) {
      // Nothing is dropped silently (`INV-nothing-is-dropped-silently`), and
      // nothing is applied by halves. A call that mixes a content change with
      // a change to a field a revision cannot carry has no honest outcome
      // except refusal: staging the content while applying the rest would
      // leave the item in a state neither the caller nor a human asked for
      // and report it as a success, and staging only the content while
      // dropping the rest would be the silent drop itself. On a governing
      // normative item the guard above has already refused such a call; this
      // covers the cases it does not reach — a normative DRAFT, and any
      // rationale category a user has set to `review`.
      const alsoMoved = nonContentChanges(item, input);
      if (alsoMoved.length > 0) {
        throw new Error(
          `my_context: this call to update ${item.id} mixes a content change ` +
          `(${fieldList(proposed)}) with a change to ${alsoMoved.join(', ')}, which a staged ` +
          `revision cannot carry. "${item.type}" is set to agentEdits: "review" in this project, ` +
          `so the content change would be held for a human to approve while the rest applied ` +
          `immediately — leaving ${item.id} in a state nobody asked for and calling it a ` +
          `success. Refused instead: nothing was applied and nothing was staged, and ${item.id} ` +
          `is exactly as it was. Send the two halves as separate calls — the content change will ` +
          `be staged for review, and the other change will be applied or refused on its own ` +
          `terms. See mycontext_help("capture").`,
        );
      }
      const result = stageRevision(ctx, item.id, proposed, origin);
      // Staging is itself an auditable act: it is the record that an agent
      // proposed a change to a governing item, which is exactly the kind of
      // thing "what did this session do" has to be able to answer. The
      // proposed TEXT is not duplicated here — it is already in the revision
      // log, which is the store for it; the audit log records that it
      // happened, to which item, in which fields, by whom. A duplicate
      // re-stage records nothing, because nothing was appended.
      const stageNote = result.duplicate
        ? ''
        : auditMutation(ctx, 'stage', origin, item.id, {
          fields: Object.keys(result.revision.changes).sort(),
          note: result.revision.revisionId,
        });
      return {
        id: item.id,
        // The item was not written. `created: false` is this interface's
        // existing spelling for "this call changed nothing" (a duplicate, an
        // already-present link), and a staged revision changed nothing about
        // the item — `status` and `filePath` below are the ones it still has.
        created: false,
        status: item.status,
        filePath: item.filePath,
        message: `${result.message}${stageNote}`,
        staged: {
          revisionId: result.revision.revisionId,
          duplicate: result.duplicate,
          alsoPending: result.alsoPending.length,
        },
      };
    }
    // proposed === null: every content field this call carried is an echo, so
    // there is nothing to stage. Fall through — a call that also moves a
    // non-content field must still do it, and one that moves nothing at all
    // must still report the same no-op it always did.
  }

  // Taken immediately before the assignments, so `changedFields` below reports
  // what this call MOVED rather than what it carried — an echoed value is not
  // a change and must not appear in the audit record as one.
  const before = snapshotFields(item);

  if (title !== undefined) item.title = title;
  if (body !== undefined) item.body = body;
  if (input.scope !== undefined) item.scope = input.scope.map((g) => normalizePosix(g));
  if (input.tags !== undefined) item.tags = input.tags;
  if (input.severity !== undefined) item.severity = input.severity;
  if (input.always !== undefined) item.always = input.always;
  if (input.status !== undefined) {
    item.status = input.status;
    // Whichever write path retires an item, `validUntil` must move with it —
    // `supersedeItem` establishes this invariant at its own retirement point,
    // and a direct `update_item({status: 'deprecated'})` must not be a second,
    // divergent way to reach "retired" that leaves it null. It moves in BOTH
    // directions: see `stampValidUntil` for what the field is and why an
    // un-retired item must not keep the stamp.
    stampValidUntil(item);
  }
  if (input.extra !== undefined) item.extra = { ...item.extra, ...input.extra };

  const moved = movedFields(before, item);
  persist(ctx, item);
  const audited = auditMutation(ctx, auditOp, origin, item.id, { fields: moved });

  return {
    id: item.id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message:
      `my_context: updated ${item.id} (${item.status}).${inertFieldNote(ctx, item)}${audited}`,
  };
}

/**
 * Never deletes and never drops content (spec §10): the retired item keeps
 * its file, body, observations and existing relations — `status` and
 * `validUntil` move, and one relation is added.
 *
 * BOTH directions are written. The `supersedes` edge goes onto the
 * *replacement*, so the surviving item carries the pointer to its own history
 * (spec §3.2 file format); the mirroring `superseded_by` edge goes onto the
 * retiree, because `STD-answered-questions-are-superseded` requires an
 * answered item to name what answered it, and because a reader who opens a
 * `superseded` file otherwise has no way to reach the replacement short of
 * scanning the corpus for whichever item points back. `superseded_by` is not
 * in `RELATION_TYPES` and cannot be forged through `link_items` — see the
 * constant's doc comment for why that omission is the guard.
 *
 * Note for future work (logged, not fixed here): a superseded item is still
 * a *content* duplicate as far as `createItem`'s dedup lookups are
 * concerned, so re-capturing the same text after a supersede returns
 * "already captured" pointing at the now-dead item. Nothing in this
 * function changes `createItem`'s dedup keys, so it does not make that
 * pre-existing gap any wider.
 */
export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {
  if (input.id === input.by) {
    throw new Error(`my_context: ${input.id} cannot supersede itself.`);
  }
  // `input.id` is about to be written verbatim as the REPLACEMENT's new
  // `supersedes` relation target (`replacement.relations.push` below) —
  // guarded here even though `createItem` now refuses to mint a malformed id
  // in the first place, because this function's own contract (retiring `id`)
  // is what actually performs the write that would silently corrupt on
  // read-back; defending only the mint site and not the write site is the
  // same "fixed in one place, live in the next" gap this review round found.
  validateRelationTarget(input.id, '"id"');
  // `input.by` is now written verbatim too, as the RETIREE's `superseded_by`
  // target, for exactly the reason the line above guards `input.id`. Before
  // the back-reference existed, `by` was only ever read (via
  // `requireWritableItem`) and never rendered into a `[[...]]` link, so it
  // needed no such check; it does now, and a guard on one side of a pair of
  // mirrored writes is the "fixed in one place, live in the next" gap again.
  validateRelationTarget(input.by, '"by"');

  const origin: Origin = input.origin ?? 'human';
  validateEnums(input);
  // `reason` becomes the text of an observation on the replacement (below),
  // so it goes through the same round-trip guard as any other observation
  // text — otherwise a reason like "see #4521" is silently shredded into a
  // tag on the way back off disk.
  if (input.reason) validateObservationText(input.reason, 'the supersede reason');

  const retired = requireWritableItem(ctx, input.id);
  const replacement = requireWritableItem(ctx, input.by);

  // The second route to the demotion `updateItem` refuses: retiring a
  // GOVERNING normative item (one currently `active` or `validated`) stops
  // it from being injected, exactly like a non-human caller editing its
  // status directly — so it gets the same refusal. Widened to `!== 'human'`
  // for the same reason `trustedStatus` and `updateItem`'s guards are:
  // `'ingest'` reaches this tool exactly the way `'agent'` does, and batch
  // ingestion (spec §7.2) retiring a human's governing constraint is the
  // same hazard as an agent doing it interactively. Narrow on purpose: a
  // non-human caller superseding its own `draft` (never governed anything),
  // an already `deprecated`/`superseded` item, or any rationale-tier item is
  // harmless and stays allowed — a later task legitimately supersedes one
  // agent- or ingest-authored draft with another.
  if (origin !== 'human' && governsNormatively(ctx, retired)) {
    throw new Error(
      `my_context: a non-human caller cannot supersede a governing normative item. ${retired.id} is ` +
      // Deliberately not "and still governs": only `active` is actually
      // eligible for selection (`isEligible` in select.ts, which classifies
      // `validated` as retired). `validated` is protected here because a
      // human affirming an item must not make it *easier* for an agent to
      // retire, but the message must not claim it is being injected.
      `currently "${retired.status}", a status only a human sets; retiring it is a human ` +
      `decision. Superseding a draft, deprecated or already-superseded item — or any rationale ` +
      `item — is unaffected. See mycontext_help("capture").`,
    );
  }

  const alreadyWired = replacement.relations.some(
    (r) => r.type === 'supersedes' && r.target === retired.id,
  );
  // The mirror of `alreadyWired`, tracked separately rather than assumed to
  // follow from it: every item superseded before this back-reference existed
  // has the forward edge and not this one, and so does any item whose file a
  // human hand-edited. Folding the two into one flag would make the
  // early-return below permanently swallow the repair — the pair would be
  // reported "already superseded" and the missing half never written.
  const backWired = retired.relations.some(
    (r) => r.type === SUPERSEDED_BY && r.target === replacement.id,
  );
  if (alreadyWired && backWired && retired.status === 'superseded') {
    return {
      id: retired.id,
      created: false,
      status: retired.status,
      filePath: retired.filePath,
      message: `my_context: ${retired.id} is already superseded by ${replacement.id}.`,
    };
  }

  // Content is never removed — only the lifecycle fields move (spec §10)
  // and this one relation is ADDED. The retiree's own relations, body and
  // observations are untouched.
  retired.status = 'superseded';
  retired.validUntil = today();
  if (!backWired) retired.relations.push({ type: SUPERSEDED_BY, target: replacement.id });
  persist(ctx, retired);

  if (!alreadyWired) {
    replacement.relations.push({ type: 'supersedes', target: retired.id });
    // Guarded by the same `alreadyWired` check as the relation push, not by
    // `input.reason` alone: a repeat supersede after a human resets the
    // retiree's status back (so the idempotent early-return above no longer
    // applies) must not append a second copy of the same observation just
    // because the relation was already there.
    if (input.reason) {
      // Through `normalizeObservations`, not pushed raw: a reason carrying a
      // double space (routine after a sentence-ending period), a tab or a
      // non-breaking space would otherwise be stored uncollapsed, hashed
      // uncollapsed, and read back collapsed — a permanent checksum mismatch
      // on the REPLACEMENT, reported by `doctor` as if a human had edited the
      // file by hand. The text is re-validated on the way through, which is
      // redundant with the `validateObservationText(input.reason, ...)` call
      // above only for the shapes that call already refuses; the prefix this
      // adds ("Replaces X: ") is itself unvalidated text otherwise.
      replacement.observations.push(...normalizeObservations([{
        category: 'supersession',
        text: `Replaces ${retired.id}: ${input.reason}`,
        tags: [],
        context: null,
      }]));
    }
  }
  persist(ctx, replacement);

  // ONE record for the pair, on the item that was retired — the act is
  // "X was superseded by Y", not two independent edits. `note` carries the
  // replacement so a reader of the log never has to correlate two lines to
  // learn what replaced what.
  const audited = auditMutation(
    ctx, 'supersede', input.origin ?? 'human', retired.id,
    { fields: ['status', 'relations', 'validUntil'], note: `by ${replacement.id}` },
  );

  return {
    id: retired.id,
    created: true,
    status: retired.status,
    filePath: retired.filePath,
    message:
      `my_context: ${retired.id} is now superseded by ${replacement.id}. ` +
      `Nothing was deleted — the file remains and the item stays searchable.${audited}`,
  };
}
