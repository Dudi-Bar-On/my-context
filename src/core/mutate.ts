import { readFileSync } from 'node:fs';
import path from 'node:path';
import { agentEditsFor, type Config, type ResolvedCategory } from './config.ts';
import { computeItemChecksum, isValidObservationCategory, parseItem } from './item.ts';
import { normalizePosix } from './paths.ts';
import { isItemExistsError, writeItem, type WriteItemOptions } from './rebuild.ts';
import { isSnapshot, snapshotSource } from './reference.ts';
// `revision.ts` imports `updateItem` and three validators back out of this
// module, so this edge closes a cycle. It resolves under ESM because both
// sides only ever CALL each other's hoisted `function` declarations, never
// read a binding while the other module is still evaluating. Nothing here may
// become a top-level `const` initialised from a `revision.ts` export, and
// nothing there may read one of ours — verified against the CLI, the MCP
// server and the hooks entry points, not only under `node --test`.
import { stageRevision, type RevisionChanges, type RevisionField, type RevisionValue } from './revision.ts';
import { sleepMs } from './sleep.ts';
import { checksum, makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError, unknownIdError } from './teach.ts';
import { normalizeEol } from './text.ts';
import type { Item, Observation, Origin, Relation, Severity, Status, Tier } from './types.ts';

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

interface ContentShape {
  type: string;
  title: string;
  body: string;
  severity: Severity;
  always: boolean;
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
 * `always` ARE included: they are normative content, not bookkeeping —
 * `computeItemChecksum` (item.ts) agrees, it hashes both too — so
 * re-capturing the same title as `severity: 'hard'` after `'soft'` must
 * not be silently swallowed as an unchanged duplicate.
 *
 * `scope` and `tags` are unordered sets, so they are sorted before hashing.
 * `observations` and `relations` are ORDERED — they render to Markdown in
 * the sequence given (see `renderItem` in item.ts) — so their order is
 * preserved as given, but each entry is rebuilt with a fixed key order
 * (`canonicalObservation`/`canonicalRelation`) so that JSON.stringify does
 * not make key order part of identity: a payload the model just sent and
 * the same content recovered by `parseItem` must hash identically even
 * though the two objects were built with their keys in different orders.
 * `extra`'s keys are sorted for the same reason.
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify({
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    severity: v.severity,
    always: v.always,
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations.map(canonicalObservation),
    relations: v.relations.map(canonicalRelation),
    extra: canonicalExtra(v.extra),
  }));
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
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
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

/**
 * Retry a write that lost a race for the SQLite write lock. `busy_timeout` (set
 * in Store.open) covers most contention; this covers the rest. Anything that is
 * not a lock error rethrows immediately — retrying a schema error just makes the
 * failure slower. Exhaustion is rethrown as a teaching message: every error this
 * module throws is prefixed `my_context:`, and a raw `SQLITE_BUSY` string is not.
 */
export function withRetry<T>(fn: () => T, attempts = 8): T {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/busy|locked/i.test(message)) throw err;
      if (attempt < attempts - 1) sleepMs(20 * (attempt + 1));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `my_context: the index database is still locked after ${attempts} attempts (${message}). ` +
    `Another process may be using it — try again in a moment.`,
  );
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

/** Exported for the same reason `SEVERITIES` is: `mycontext edit --status`
 * has to refuse a bad value BEFORE it prints a preview and asks for
 * confirmation, and it must refuse it against this list, in `enumError`'s
 * words, rather than keeping a second copy of the vocabulary. */
export const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
/** Exported so every surface that takes a severity — the `create_item` and
 * `update_item` tools, `mycontext add --severity`, `review promote --severity`
 * — refuses a bad one against this list and `enumError`, rather than each
 * growing its own copy of the vocabulary and its own wording for the refusal. */
export const SEVERITIES: Severity[] = ['hard', 'soft'];
const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

/**
 * Without this, `status: 'activ'` (or any other typo) persists happily —
 * the item is then never actually `'active'`, so it is never selected or
 * injected, while `createItem`'s own return message still reports success.
 *
 * Shape is a narrowed structural subset — not `CreateInput` — so
 * `updateItem`'s `UpdateInput` (which has no required `type`/`title`) can
 * route through the same three checks `createItem` uses instead of a second,
 * divergent copy of them.
 */
function validateEnums(input: { status?: Status; severity?: Severity; origin?: Origin }): void {
  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    throw new Error(enumError('status', input.status, STATUSES, 'capture'));
  }
  if (input.severity !== undefined && !SEVERITIES.includes(input.severity)) {
    throw new Error(enumError('severity', input.severity, SEVERITIES, 'capture'));
  }
  if (input.origin !== undefined && !ORIGINS.includes(input.origin)) {
    throw new Error(enumError('origin', input.origin, ORIGINS, 'capture'));
  }
}

/** The frontmatter keys `renderItem` (item.ts) already writes for every item —
 * an `extra` field of the same name would silently overwrite it on disk. */
const RESERVED_FRONTMATTER_KEYS = new Set([
  'id', 'type', 'title', 'status', 'severity', 'always', 'scope', 'tags', 'origin',
  'source_file', 'source_anchor', 'source_checksum', 'valid_from', 'valid_until', 'checksum',
]);

/** What `frontmatter.ts`'s `KEY_LINE` grammar accepts as a frontmatter key. */
const EXTRA_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Guards two ways `extra` can silently destroy data if written through
 * unvalidated: (a) a key the frontmatter grammar cannot reparse (e.g.
 * `valid-until`, with a hyphen) makes the item unreadable — and therefore
 * invisible — on the very next rebuild, even though create_item reported
 * success; (b) a key that collides with a reserved name (e.g. `id`)
 * overwrites that field in the rendered file, so disk and index disagree
 * about identity.
 */
/**
 * U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR) are as fatal as
 * `\r`/`\n` for anything stored as a single frontmatter scalar/list line or
 * a single Markdown line: frontmatter's `KEY_LINE` grammar is anchored with
 * `.`/`$`, neither of which spans a line terminator in a JS `RegExp`, so a
 * value containing one writes a file `parseFrontmatter` cannot read back —
 * "unsupported frontmatter syntax" — even though it contains no literal
 * `\r` or `\n`. Shared by every guard below that stores a value as one
 * frontmatter line or one Markdown list line.
 */
const LINE_BREAK = /[\r\n\u2028\u2029]/;

export function validateExtra(extra: Record<string, string>): void {
  for (const [key, value] of Object.entries(extra)) {
    if (!EXTRA_KEY_RE.test(key)) {
      throw new Error(
        `my_context: extra field "${key}" is not a valid key — frontmatter keys must match ` +
        `letters, digits and underscore, and not start with a digit, or the item cannot be ` +
        `read back after the next rebuild. See mycontext_help("capture").`,
      );
    }
    if (RESERVED_FRONTMATTER_KEYS.has(key)) {
      throw new Error(
        `my_context: extra field "${key}" collides with a reserved frontmatter field of the ` +
        `same name and would silently overwrite it on disk. Choose a different key. ` +
        `See mycontext_help("capture").`,
      );
    }
    // `__proto__` passes `EXTRA_KEY_RE` and is not a reserved frontmatter
    // name, so neither check above sees it — but it cannot survive being
    // written. `renderItem` (item.ts) builds the frontmatter record with
    // `fm[key] = value`; for the key `__proto__` that assignment sets the
    // record's PROTOTYPE instead of creating an own property, so
    // `serializeFrontmatter` never sees the field and the file is written
    // without it. The checksum, however, was taken over an item whose
    // `extra` DID carry it. Result: the field is silently gone and the item
    // fails its own recorded checksum from the moment it is written.
    //
    // Verified by execution through the library entry point, with an `extra`
    // built by `JSON.parse` (which produces a real own `__proto__` property,
    // unlike an object literal): the rendered file contained no such line,
    // the re-parsed item's `extra` was `{}`, and its recomputed checksum did
    // not match the one in the file. `constructor` and `prototype` were
    // tested the same way and behave normally — they round-trip and their
    // checksums match — so they are deliberately NOT refused here.
    if (key === '__proto__') {
      throw new Error(
        `my_context: extra field "__proto__" cannot be stored. Assigning it while building the ` +
        `frontmatter sets the object's prototype instead of adding a field, so the value would ` +
        `never reach the file — and the item's checksum, which was taken with it, would then ` +
        `never match its own contents again. Choose a different key. ` +
        `See mycontext_help("capture").`,
      );
    }
    // Both new: `''` is indistinguishable from an absent field once written
    // and read back (item.ts's `asString` maps an empty scalar back to
    // `null`, and the extra-field loader then skips a `null` entry
    // entirely) — the key silently vanishes on the very next read. A line
    // break corrupts frontmatter's one-value-per-line format outright.
    // Both are the same silent-loss/silent-corruption failure class this
    // whole function exists to refuse, just on the VALUE instead of the key.
    if (value === '') {
      throw new Error(
        `my_context: extra.${key} is an empty string, which is indistinguishable from an absent ` +
        `field once written and read back — frontmatter parses an empty scalar as absent. ` +
        `Omit the key instead. See mycontext_help("capture").`,
      );
    }
    if (LINE_BREAK.test(value)) {
      throw new Error(
        `my_context: extra.${key} contains a line break (${JSON.stringify(value)}). Frontmatter ` +
        `stores one value per line, so this would corrupt the file — making it unreadable — the ` +
        `next time it is written to disk. Remove it, or move this into "body" instead. ` +
        `See mycontext_help("capture").`,
      );
    }
  }
}

/**
 * `title` is written both as a frontmatter scalar AND as the file's
 * Markdown `# ` heading (`renderItem`, item.ts) — a line break in either
 * position corrupts the file the next time it is written to disk.
 */
export function validateTitle(title: string): void {
  if (!LINE_BREAK.test(title)) return;
  throw new Error(
    `my_context: "title" contains a line break. It is written both as frontmatter and as a ` +
    `Markdown heading, so this would corrupt the file the next time it is written to disk. ` +
    `Keep the title on one line; put the rest in "body". See mycontext_help("capture").`,
  );
}

/**
 * Each `scope` glob is written as one frontmatter list line
 * (`serializeFrontmatter`, frontmatter.ts). A line break inside one is the
 * same single-line-format corruption `validateTitle`/`validateExtra` guard.
 */
export function validateScope(scope: string[]): void {
  scope.forEach((glob, i) => {
    if (!LINE_BREAK.test(glob)) return;
    throw new Error(
      `my_context: scope[${i}] contains a line break, which would corrupt the file's frontmatter ` +
      `the next time it is written to disk. Remove it. See mycontext_help("capture").`,
    );
  });
}

/** The sibling of `validateScope`, guarding top-level `tags` (a frontmatter
 * list, unlike an observation's inline `#tag` — see `validateObservationTags`
 * for that separate, more restrictive grammar). */
export function validateTags(tags: string[]): void {
  tags.forEach((tag, i) => {
    if (!LINE_BREAK.test(tag)) return;
    throw new Error(
      `my_context: tags[${i}] contains a line break, which would corrupt the file's frontmatter ` +
      `the next time it is written to disk. Remove it. See mycontext_help("capture").`,
    );
  });
}

/**
 * Spec §10 requires `rebuild` to be lossless: files → DB → files is
 * byte-identical. Two shapes of authored text break that, and both destroy
 * content permanently and silently:
 *
 *  (a) a body line starting with `#`…`######`. `splitSections` (item.ts)
 *      treats `## X` as a SECTION heading, so everything from that line on
 *      leaves `body` — and a leading `# ` line is dropped outright. The
 *      write succeeds, the file on disk is complete, and then the very next
 *      `persist()` on that item re-renders from the truncated re-parsed copy
 *      and overwrites the file. The prose is gone, and the tool call that
 *      did it reported success. A fabricated `## Observations` block is the
 *      same bug with an extra edge: it empties the real body AND invents
 *      observations nobody wrote.
 *
 *  (b) observation text containing `#`, or ending in `(...)`.
 *      `parseObservations` reads `#tag` as a tag and a trailing
 *      parenthetical as `context`, stripping both out of `text`.
 *
 * Refused at the WRITE boundary rather than fixed in the format:
 * `renderItem`/`parseItem`/`splitSections` carry Plan 1's byte-identity
 * invariant, and changing the file format to accommodate this is a much
 * larger decision than this guard. The messages name the offending content
 * and say where it should go instead.
 */
const HEADING_LINE = /^#{1,6}\s/;

/**
 * Tested against the RAW line — deliberately not `line.trim()` — because
 * `item.ts`'s actual parser (`splitSections`'s `/^#\s+/`/`/^##\s+(.+?)\s*$/`)
 * anchors with `^` against the untrimmed line and needs the trailing
 * whitespace after the hash(es) to be PRESENT to match at all. Trimming
 * first breaks the guard in both directions: a line `'  # Heading'`
 * (leading whitespace) would trim to something `HEADING_LINE` matches, even
 * though `item.ts`'s `^`-anchored regex — seeing the untrimmed line — never
 * treats it as a heading (harmless, over-rejected); a bare `'# '` (a hash
 * plus trailing whitespace and NOTHING else) trims to `'#'`, which
 * `HEADING_LINE` does NOT match (no character left for `\s` to match) —
 * even though `item.ts` DOES drop that exact untrimmed line outright,
 * silently truncating the body one line short of what was written
 * (under-rejected — the actual gap this comment replaces).
 */
export function validateBody(body: string): void {
  for (const line of body.split('\n')) {
    if (!HEADING_LINE.test(line)) continue;
    throw new Error(
      `my_context: the body line ${JSON.stringify(line)} starts with a Markdown ` +
      `heading. An item's body is stored as the prose BEFORE its first "## " section, so ` +
      `this line — and everything after it — would be lost the next time the item is read ` +
      `back from disk, without any error. Put the detail in an observation instead, or ` +
      `write the line without its leading "#". See mycontext_help("capture").`,
    );
  }
}

export function validateObservationText(text: string, where: string): void {
  // A line break here is more destructive than the '#'/trailing-paren
  // cases below: `OBSERVATION`'s `(.*)$` does not span a line separator
  // (U+2028/U+2029) — nor, once the line is split on `\n` upstream, does a
  // literal `\r`/`\n` leave anything behind to match — so the WHOLE list
  // line fails to match and `parseObservations` silently drops the entire
  // observation, not just the part after the break.
  if (LINE_BREAK.test(text)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(text)}). An observation is ` +
      `stored as one Markdown list line, so this would either corrupt the line or make the ` +
      `whole observation silently disappear the next time this item is read back from disk. ` +
      `Keep it on one line, or split it into a separate observation. See mycontext_help("capture").`,
    );
  }
  if (text.includes('#')) {
    throw new Error(
      `my_context: ${where} contains "#" (${JSON.stringify(text)}). Observation text is ` +
      `stored as Markdown in which "#word" is a TAG, so the "#" and the word after it would ` +
      `be silently moved out of the text when the item is read back. Drop the "#", or pass ` +
      `the value in "tags". See mycontext_help("capture").`,
    );
  }
  if (/\([^()]*\)\s*$/.test(text)) {
    throw new Error(
      `my_context: ${where} ends in parentheses (${JSON.stringify(text)}). A trailing ` +
      `"(...)" is stored as the observation's separate "context" field, so it would be ` +
      `silently removed from the text when the item is read back. Rephrase so the ` +
      `parenthetical is not last, or pass it as "context". See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling of `validateBody`/`validateObservationText` above: those guard
 * the observation's TEXT, this guards its CATEGORY. `OBSERVATION` in
 * item.ts only recognizes `[a-z0-9_-]+` inside the brackets — a category
 * like `root cause` (a space) renders as `- [root cause] the pool leaked`,
 * which the parser cannot match at all, so `parseObservations` silently
 * skips the whole line. The write itself succeeds and reports success; the
 * observation is gone the moment anything re-persists the item from the
 * re-parsed (now `observations: []`) copy — the same failure mode
 * `validateBody` documents for a `##` heading in body, one step earlier in
 * the pipeline.
 */
export function validateObservationCategory(category: string, where: string): void {
  if (isValidObservationCategory(category)) return;

  // Distinguishes the two ways `isValidObservationCategory` can fail without
  // restating either of its checks: if lowercasing `category` would make it
  // valid, the character class was fine and the only problem is case: that
  // fails differently (silently RE-WRITTEN, not dropped) and deserves a
  // different, honest message rather than reusing the "would be dropped" one.
  if (isValidObservationCategory(category.toLowerCase())) {
    throw new Error(
      `my_context: ${where} is ${JSON.stringify(category)}, which is not all-lowercase. ` +
      `Categories are read back with "[category]".toLowerCase() (see parseObservations in ` +
      `item.ts), so this would be silently rewritten to ${JSON.stringify(category.toLowerCase())} ` +
      `the next time this item is read back from disk — its checksum would then no longer match ` +
      `what was written, and a repeat create_item call for the same content would stop deduping ` +
      `against it. Use ${JSON.stringify(category.toLowerCase())} instead. ` +
      `See mycontext_help("capture").`,
    );
  }

  throw new Error(
    `my_context: ${where} is ${JSON.stringify(category)}, which contains a character the ` +
    `observation format cannot store. Categories are written as "[category]" ` +
    `in Markdown and read back with the pattern [a-z0-9_-]+ (letters, digits, underscore and ` +
    `hyphen only) — anything else makes the line unparseable, so the whole observation would ` +
    `be silently dropped the next time this item is read back from disk. Use a category made ` +
    `only of those characters, e.g. "root-cause" instead of "root cause". ` +
    `See mycontext_help("capture").`,
  );
}

/** What `parseObservations` (item.ts) reads back out of "#tag" — anything else round-trips wrong or not at all. */
const OBSERVATION_TAG_RE = /^[A-Za-z0-9_-]+$/;

/**
 * The sibling of `validateObservationCategory`/`validateObservationText`
 * above, guarding the observation's TAGS. A tag is rendered inline as
 * `#tag` and read back with `#([A-Za-z0-9_-]+)` — a tag containing any
 * other character (a leading `#`, whitespace, punctuation) either matches a
 * shorter substring than what was written (silently truncating it to a
 * different tag) or fails to match at all (silently dropped), the same
 * failure class `validateObservationCategory` guards one field over.
 */
export function validateObservationTags(tags: string[], where: string): void {
  for (const tag of tags) {
    if (OBSERVATION_TAG_RE.test(tag)) continue;
    throw new Error(
      `my_context: ${where} contains ${JSON.stringify(tag)}, which is not a valid tag. Tags are ` +
      `written as "#tag" in Markdown and read back with the pattern [A-Za-z0-9_-]+ (letters, digits, ` +
      `underscore and hyphen only) — anything else round-trips to a different tag, or not at all, the ` +
      `next time this item is read back from disk. See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling guarding an observation's CONTEXT. Context is rendered
 * wrapped in one layer of parentheses, `(${context})`, and read back with
 * `\(([^()]*)\)\s*$` — a character class that explicitly excludes `(` and
 * `)`, so it cannot see through a paren nested inside context. A context of
 * `'(at) registration'` renders as `... ((at) registration)`, and reparsing
 * that trailing-parens pattern against a character class that excludes `(`
 * and `)` yields a DIFFERENT (truncated or empty) context than what was
 * written — the same silently-wrong-on-the-next-read failure
 * `validateObservationText` guards for a trailing parenthetical in text.
 */
export function validateObservationContext(context: string | null, where: string): void {
  if (context === null) return;
  if (/[()]/.test(context)) {
    throw new Error(
      `my_context: ${where} contains "(" or ")" (${JSON.stringify(context)}). Context is rendered ` +
      `wrapped in its own parentheses, and the parser that reads it back cannot see through a paren ` +
      `nested inside — this would round-trip to a different (or truncated) context the next time this ` +
      `item is read back from disk. Remove the parentheses, or fold this into "text" instead. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (LINE_BREAK.test(context)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(context)}). An observation is ` +
      `stored as one Markdown list line, so this would corrupt — or silently drop — the whole ` +
      `observation the next time this item is read back from disk. Remove it. ` +
      `See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling of `validateObservationCategory`/`validateObservationTags`,
 * guarding a RELATION target. A relation is rendered as `- type [[target]]`
 * and read back with `RELATION` (item.ts): `/^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i`.
 * That pattern's target group is `[^\]]+` — it cannot see through a `]`
 * nested inside the target — and is anchored per-line, so it cannot span a
 * line break either. A target containing either would either round-trip to
 * a truncated target (a `]` mid-string ends the match early) or fail to
 * match at all (a line break splits the relation across two unparseable
 * lines), silently dropping the whole relation the next time this item is
 * read back from disk — the write itself would report success. An empty
 * target is refused for the same "silently wrong on read-back" reason, not a
 * new one: `[[]]` round-trips to a relation whose target is the empty
 * string, indistinguishable from a typo that dropped the id entirely, and
 * every consumer of `Relation.target` treats it as a real id to look up.
 *
 * This is called on every string that ends up as a `Relation.target` in a
 * *stored* item, from every angle that can produce one:
 *  - `linkItems`'s `to`;
 *  - `createItem`'s `relations` input (defensive: `applyCandidates` always
 *    passes `relations: []` today, but this is the shared entry point for
 *    any future caller that doesn't);
 *  - `createItem`'s own explicit `id` — an id becomes a `supersedes` TARGET
 *    the moment something later supersedes this item, so an id that could
 *    not itself survive as a target must be refused at mint time, not
 *    discovered later at whichever future call writes the relation;
 *  - `supersedeItem`'s `id` (the retired item) — literally the string that
 *    gets written as `replacement.relations`'s new `supersedes` target.
 *    Without this, `supersede_item(id: "CONST-a]b", by: ...)` succeeds,
 *    writes `- supersedes [[CONST-a]b]]`, and the relation is silently
 *    dropped on the very next read of the REPLACEMENT — which also then
 *    fails its own checksum, since the parsed-back relations no longer match
 *    what was hashed at write time.
 */
export function validateRelationTarget(target: string, where: string): void {
  if (target.trim() === '') {
    throw new Error(
      `my_context: ${where} is empty. A relation target must name a real item id — an empty ` +
      `target would be stored as "[[]]" and read back as a relation pointing at nothing. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (LINE_BREAK.test(target)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(target)}). A relation is ` +
      `stored as one Markdown list line ("- type [[target]]"), so this would corrupt the line, ` +
      `or silently drop the whole relation the next time this item is read back from disk. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (target.includes(']')) {
    throw new Error(
      `my_context: ${where} contains "]" (${JSON.stringify(target)}). A relation target is ` +
      `stored inside "[[...]]", and the parser that reads it back matches up to the first "]" — ` +
      `so this would round-trip to a truncated (or unmatched) target the next time this item is ` +
      `read back from disk. See mycontext_help("capture").`,
    );
  }
}

/**
 * An id is not only a key. `createItem` turns an explicit `input.id`
 * straight into a path — `filePath: items/${type}/${id}.md` — and
 * `writeItem` (rebuild.ts) joins that with the workspace root and
 * `mkdirSync`s the parent recursively. So an id of `../../../evil`, or one
 * carrying any separator, writes a file OUTSIDE `.my_context/`, creating
 * directories on the way, and the write-deny hook (which matches on the
 * `.my_context` path segment) never sees a managed path at all.
 *
 * Nothing forwards a caller-supplied id today: the MCP `create_item` tool
 * has no `id` field, `mycontext add` never sets one, and the three internal
 * callers that do (`lesson/derive.ts`, `ingest/apply.ts`) build theirs from
 * `makeId`/`slugify`, whose output is `[A-Z0-9]+-[a-z0-9-]*` by
 * construction. This is insurance against the surface that forwards one
 * next, taken at the boundary rather than at whichever future call site
 * first does it — and it is stated as "not reachable today" rather than
 * "an exploit", because it is not one.
 *
 * The rule is "one safe filename segment", not `slugify`'s grammar. What
 * actually matters here is the path property, and the slug grammar would
 * additionally reject ids this system already accepts from disk — an
 * uppercase or underscored id in a hand-authored or older corpus parses and
 * indexes fine today, and a `createItem` that refused to re-mint one would
 * be enforcing a rule the rest of the codebase does not. `..` is refused
 * anywhere in the string, not merely as a whole segment: no id this project
 * mints contains one, and the separator check plus the leading-character
 * rule already make a bare `..` unreachable, so this only removes a shape
 * that is meaningless as an id and easy to misread as safe.
 */
const ID_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function validateExplicitId(id: string, where: string): void {
  if (/[/\\]/.test(id) || id.includes('..')) {
    throw new Error(
      `my_context: ${where} contains a path separator or ".." (${JSON.stringify(id)}). An id ` +
      `becomes the item's filename — "items/<type>/<id>.md" — so this would write outside the ` +
      `workspace. Ids are a single name: letters, digits, ".", "_" and "-". ` +
      `See mycontext_help("capture").`,
    );
  }
  if (!ID_GRAMMAR.test(id)) {
    throw new Error(
      `my_context: ${where} is not a usable id (${JSON.stringify(id)}). An id becomes the item's ` +
      `filename — "items/<type>/<id>.md" — so it must start with a letter or digit and contain ` +
      `only letters, digits, ".", "_" and "-". See mycontext_help("capture").`,
    );
  }
}

/** Guards every relation's target in one place — see `validateRelationTarget`. */
function validateRelations(relations: Relation[]): void {
  relations.forEach((r, i) => validateRelationTarget(r.target, `relations[${i}].target`));
}

/**
 * Shared by both surfaces that hand a model's observations to `createItem`:
 * the MCP `create_item` tool (`optObservations` in mcp/tools.ts forwards
 * per-entry `tags`/`context` with only a shape check, no round-trip
 * validation of their own) and the ingest candidate validator
 * (`src/ingest/schema.ts`). Validating category, text, tags AND context
 * here — once — is what keeps those two callers from drifting into two
 * different (and possibly incomplete) copies of the same rules.
 *
 * It NORMALIZES as well as validates, and returns the normalized
 * observations, because the two cannot be separated: the collapse below is
 * what makes the text round-trip, so any caller that validated here and then
 * stored its own un-normalized copy would write a permanently
 * checksum-mismatched file. Callers must store — and hash — what this
 * returns, not what they passed in.
 */
export function normalizeObservations(observations: Observation[]): Observation[] {
  return observations.map((o, i) => {
    validateObservationCategory(o.category, `observations[${i}].category`);

    // Validated on the TRIMMED but UNCOLLAPSED text, and the order is
    // load-bearing. `validateObservationText` is what rejects a line break,
    // a "#", or a trailing parenthetical; the collapse below would not
    // change whether a "#" or a parenthetical is present, but it WOULD
    // silently erase a line break into a space. A line break must stay a
    // rejection (it destroys the whole observation on read-back), so the
    // collapse may only run after the validator has confirmed there is none.
    const trimmed = o.text.trim();
    validateObservationText(trimmed, `observations[${i}].text`);
    validateObservationTags(o.tags, `observations[${i}].tags`);

    // `parseObservations` (item.ts) trims context and maps a missing
    // parenthetical to `null`; `renderObservation` omits the parenthetical
    // entirely for a falsy context. So a context of "" (or one that is only
    // whitespace) is written as nothing and read back as `null` — stored as
    // "" it would never match its own re-parse. Interior whitespace in
    // context is NOT collapsed here, because `parseObservations` does not
    // collapse it either: it only `.trim()`s what it captured.
    const trimmedContext = o.context === null ? null : o.context.trim();
    const context = trimmedContext === '' ? null : trimmedContext;
    validateObservationContext(context, `observations[${i}].context`);

    // THE ONE SANCTIONED **LOSSY** NORMALIZATION AT THIS BOUNDARY — read
    // this before "fixing" it back. (The `.trim()`s above are normalizations
    // too, but lossless ones: they only remove whitespace nothing downstream
    // would ever see anyway. This one is different — it changes interior
    // content.) `parseObservations` (item.ts) unconditionally collapses
    // every run of whitespace in observation text to a single space
    // (`.replace(/\s+/g, ' ')`) on the way back off disk. Text containing
    // "a  b" (a double space — routine after a sentence-ending period),
    // "a\tb", or a non-breaking space would otherwise validate, get written,
    // and come back as "a b" with a checksum that can never match again:
    // `mycontext doctor` then exits 1 accusing the user of editing a file
    // that my_context itself wrote, and `rebuild` does not repair it. Every
    // OTHER normalization this project refuses — lowercasing a category,
    // truncating at a parenthesis — changes what the text MEANS or IS;
    // collapsing a whitespace run changes neither, and there is no lossless
    // alternative: Markdown itself collapses runs of spaces on render, so
    // preserving "a  b" literally would only buy a value nothing downstream
    // can ever distinguish from "a b" again.
    //
    // It lives HERE, in the function both surfaces already converge on,
    // rather than in `src/ingest/schema.ts` where it used to: the MCP
    // `create_item`/`update_item` path never reaches schema.ts at all, so
    // the rule was enforced for ingested items and absent for the ones a
    // model writes interactively. schema.ts now delegates to this function.
    return {
      category: o.category,
      text: trimmed.replace(/\s+/g, ' '),
      tags: o.tags,
      context,
    };
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizePosix(value);
}

/** Project-layer items only — global-layer rows are a different owner's
 * items, indexed for read-time selection, and must never be treated as
 * something create_item already wrote or could overwrite. */
function projectItems(ctx: MutationContext): Item[] {
  return ctx.store.all().filter((i) => i.layer === 'project');
}

/** `Store.get` looks up by id across every layer; this narrows to the one
 * this module is allowed to reason about — see `projectItems`. */
function projectItem(ctx: MutationContext, id: string): Item | null {
  const item = ctx.store.get(id);
  return item && item.layer === 'project' ? item : null;
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

/**
 * Persist an item: Markdown first (the source of truth), then the index.
 * `writeItem` recomputes and writes the checksum itself — it never mutates
 * the `item` it's given, only the copy it renders to disk — so this sets
 * `item.checksum` first, from the same `computeItemChecksum`, purely to
 * keep the object that then goes into `ctx.store.upsert` consistent with
 * what lands on disk. The recomputation inside `writeItem` is redundant
 * but harmless; there is exactly one checksum implementation, reused twice,
 * not two implementations that could drift.
 */
export function persist(ctx: MutationContext, item: Item, options?: WriteItemOptions): void {
  // A whole-file snapshot's `source_checksum` is not an independent field —
  // it is the checksum of the content the item HOLDS, which is its body. Kept
  // in step here, in the one function every write path funnels through, rather
  // than at each of them: `createItem` sets it from the file it just read,
  // `mycontext refresh` sets it from the file it just re-read, and
  // `promoteRevision` — which applies a staged refresh through `updateItem`
  // with only `body` — would otherwise leave the checksum describing the text
  // the promotion just replaced. `doctor` compares this field against the live
  // file, so a stale one is not a cosmetic inaccuracy: it is `source_drift`
  // reporting on a body nobody holds.
  //
  // Scoped by `isSnapshot`, which requires `source_anchor` to be ABSENT, so
  // an ingested item — whose body is an extraction and whose checksum is of a
  // section it deliberately does not equal — is never touched.
  if (isSnapshot(item)) item.sourceChecksum = checksum(snapshotSource(item.body));
  item.checksum = computeItemChecksum(item);
  // Markdown first, and `writeItem` throws before the index is touched when
  // `exclusive` finds the file taken — so a racer that loses the id never
  // upserts a row for an item it did not write.
  writeItem(ctx.root, item, options);
  withRetry(() => ctx.store.upsert(item));
}

export function createItem(ctx: MutationContext, input: CreateInput): MutationResult {
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

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message:
      `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}`,
  };
}

/**
 * The relation vocabulary. Closed deliberately: an open vocabulary produces
 * `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no
 * query finds all three.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
];

/**
 * The back-reference `supersedeItem` writes onto the item it RETIRES, the
 * mirror of the `supersedes` edge it writes onto the replacement. The
 * project's own `STD-answered-questions-are-superseded` requires it by name:
 * an answered open_question is set to `superseded` AND carries a
 * `superseded_by` pointer to whatever answered it, so a reader who opens the
 * question finds the answer without having to search the corpus for whichever
 * item happens to point back at it.
 *
 * Deliberately NOT a member of `RELATION_TYPES`, and that omission is the
 * guard, not an oversight. `RELATION_TYPES` is the whole gate on `linkItems`,
 * which is agent-reachable through the `link_items` MCP tool and has no
 * `origin` at all — `LinkInput` carries none, because adding a relation was
 * defined as crossing no trust boundary. Listing `superseded_by` there would
 * hand any agent a way to stamp "this item has been retired in favour of that
 * one" onto a still-`active` governing item, with none of the lifecycle
 * changes that would make the claim true — the same forgery the `supersedes`
 * refusal below already blocks, re-opened through the opposite-facing edge.
 * `linkItems` refuses this string by name, immediately below, so the refusal
 * survives even if someone later widens the enum.
 */
export const SUPERSEDED_BY = 'superseded_by';

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

export interface LinkInput {
  from: string;
  to: string;
  relation: string;
}

/** Looks up across every layer (unlike `projectItem`) because `updateItem`,
 * `supersedeItem` and `linkItems` all need to name *any* known id in their
 * error messages — a global-layer id is a legitimate link/supersede target
 * to *read*. This is a lookup, not a write authorization: callers that are
 * about to persist the result must go through `requireWritableItem` below,
 * which enforces the layer boundary this function does not. */
function requireItem(ctx: MutationContext, id: string): Item {
  const item = ctx.store.get(id);
  if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
  return item;
}

/**
 * `requireItem` resolves across every layer so an id can still be *named* in
 * an error message; this narrows to items this module is allowed to
 * *persist*. Global-layer rows belong to a different owner's layer (see
 * `projectItem`/`projectItems`) — without this guard, `updateItem`,
 * `supersedeItem` and `linkItems` would happily call `persist()` on one,
 * which writes a project-layer shadow file for an id the index still marks
 * `global`. Disk and index then disagree about which layer owns the id, and
 * on the next rebuild `loadLayer`'s per-layer dedupe lets one copy silently
 * overwrite the other by primary key.
 */
function requireWritableItem(ctx: MutationContext, id: string): Item {
  const item = requireItem(ctx, id);
  if (item.layer !== 'project') throw new Error(globalLayerRefusal(id));
  return item;
}

/**
 * The one wording for "this id belongs to the global layer", exported because
 * two CLI commands have to say it BEFORE `requireWritableItem` ever runs.
 *
 * `mycontext supersede` and `mycontext edit` both print a preview and ask for
 * confirmation before they write, and a refusal that arrived from inside the
 * write would land after the preview — a human shown what a command will do,
 * asked to approve it, and only then told it was never going to happen. So
 * each checks the layer itself, and each must say what the store would have
 * said rather than growing a third and fourth spelling of one refusal.
 */
export function globalLayerRefusal(id: string): string {
  return (
    `my_context: "${id}" belongs to the global layer and cannot be modified from this ` +
    `project — global items are read-only here. See mycontext_help("categories").`
  );
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
function inertFieldNote(ctx: MutationContext, item: Item): string {
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

/** Statuses under which an item is no longer current — `valid_until` should
 * be set the moment an item transitions into one, whichever write path does
 * the transitioning, so the invariant `supersedeItem` establishes at
 * capture-of-retirement time holds no matter how status got there. */
function isRetired(status: Status): boolean {
  return status === 'superseded' || status === 'deprecated';
}

/**
 * What `valid_until` IS, decided rather than left implicit — the question 1C.5
 * asks, since nothing anywhere reads the field.
 *
 * It is a **lifecycle record**: the day this item stopped being current. It is
 * not a control input, and deliberately is not being turned into one. `status`
 * already decides currency, in one place, and every surface reads it —
 * `isEligible` (select.ts), `reviewQueue`, `decay`, `doctor`, the guards in
 * this module. Adding a second, date-based gate would let an item stop
 * governing on a day nobody typed anything, with no draft queue entry, no
 * retired count and no spill line to show for it — which is precisely the
 * silent, invisible narrowing `guardedChange` below exists to refuse.
 *
 * What follows from that is symmetry, and it is what was missing. The field
 * was set on the way into a retired status and left stamped on the way out, so
 * `mycontext edit <id> --status active` on a deprecated item produced a file
 * whose frontmatter said `status: active` and `valid_until: 2026-08-16` — "it
 * is in force" and "it stopped being in force" in the same eight lines. A
 * record that contradicts the thing it records is worse than no record, and
 * nothing is lost by clearing it: the retirement is in git, in the revision
 * log, and in the `superseded_by` relation when there is one.
 *
 * Both READMEs say this in the frontmatter table, in these terms, so a reader
 * of a file is not left to infer which of the two it is.
 */
function stampValidUntil(item: Item): void {
  if (isRetired(item.status)) {
    if (item.validUntil === null) item.validUntil = today();
  } else {
    item.validUntil = null;
  }
}

/** True when an item is a normative item that is *currently governing* —
 * the same narrow predicate `supersedeItem` uses for its own refusal. Only
 * `active` items are actually eligible for selection (`select.ts`), but
 * `validated` is included because a human who marks an item `validated` has
 * affirmed it, and treating that as "no longer protected" would make the
 * strongest human endorsement the weakest guard. */
function governsNormatively(ctx: MutationContext, item: Item): boolean {
  return tierOf(ctx, item) === 'normative' &&
    (item.status === 'active' || item.status === 'validated');
}

/**
 * The fields that decide whether — and how forcefully — an item is injected:
 * `scope` (which files it attaches to), `always` (whether it is pinned at
 * every session start) and `severity`. Changing any of them on a governing
 * item is functionally identical to the `status` change below — the item
 * stops reaching the session — but leaves it `active`, so it shows up in no
 * draft queue, no retired count, and no selection spill (it was never a
 * candidate). That silence is what makes it worse than the status change,
 * not better, so it gets the same refusal.
 */
const GUARDED_FIELDS = {
  scope: 'scope',
  always: 'always flag',
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
function guardedChange(item: Item, input: UpdateInput): keyof typeof GUARDED_FIELDS | null {
  if (input.scope !== undefined && !sameScope(input.scope.map((g) => normalizePosix(g)), item.scope)) {
    return 'scope';
  }
  if (input.always !== undefined && input.always !== item.always) return 'always';
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
 */
type FieldPolicy = 'content' | 'gated';

const UPDATE_FIELD_POLICY = {
  title: 'content',
  body: 'content',
  tags: 'content',
  extra: 'content',
  scope: 'gated',
  always: 'gated',
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
// are `guardedChange` (scope/always/severity) and `updateItem`'s status rule;
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
function contentChange(
  item: Item, input: UpdateInput, title: string | undefined, body: string | undefined,
): RevisionChanges | null {
  const update: NormalizedUpdate = { input, title, body };
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
function openContentPhrase(ctx: MutationContext, item: Item): string {
  if (agentEditsFor(ctx.config, item.type) !== 'review') {
    return 'Title, body, tags and extra are still editable';
  }
  return (
    `Title, body, tags and extra can still be changed here, but "${item.type}" is set to ` +
    `agentEdits: "review" in this project, so such a change is STAGED as a pending revision for ` +
    `a human rather than applied`
  );
}

/** The same fact as a trailing note, for the message whose main clause
 * ("every other field is editable") stays true under both policies — a DRAFT
 * normative item, which no field guard restricts. Empty under `allow`. */
function stagedContentCaveat(ctx: MutationContext, item: Item): string {
  if (agentEditsFor(ctx.config, item.type) !== 'review') return '';
  return (
    ` Note that "${item.type}" is set to agentEdits: "review" in this project, so a change to ` +
    `title, body, tags or extra is STAGED as a pending revision for a human rather than applied.`
  );
}

/** The field names a `RevisionChanges` carries, for a message. Read off the
 * object rather than a literal list, so it names what is actually there. */
function fieldList(changes: RevisionChanges): string {
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
function nonContentChanges(item: Item, input: UpdateInput): string[] {
  return GATED_FIELDS.filter((field) => GATED_READERS[field](item, input));
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
export function updateItem(ctx: MutationContext, input: UpdateInput): MutationResult {
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
  // `validateTags` above.
  const title = input.title !== undefined ? input.title.trim() : undefined;
  const body = input.body !== undefined ? normalizeEol(input.body).trim() : undefined;

  validateEnums(input);
  if (input.extra !== undefined) validateExtra(input.extra);
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
      return {
        id: item.id,
        // The item was not written. `created: false` is this interface's
        // existing spelling for "this call changed nothing" (a duplicate, an
        // already-present link), and a staged revision changed nothing about
        // the item — `status` and `filePath` below are the ones it still has.
        created: false,
        status: item.status,
        filePath: item.filePath,
        message: result.message,
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

  persist(ctx, item);

  return {
    id: item.id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: updated ${item.id} (${item.status}).${inertFieldNote(ctx, item)}`,
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

  return {
    id: retired.id,
    created: true,
    status: retired.status,
    filePath: retired.filePath,
    message:
      `my_context: ${retired.id} is now superseded by ${replacement.id}. ` +
      `Nothing was deleted — the file remains and the item stays searchable.`,
  };
}

export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {
  // Both retirement edges are refused BEFORE the `RELATION_TYPES` check, not
  // after it, so the refusal survives someone widening the enum: adding
  // `superseded_by` to that list is the one wrong fix this area invites, and
  // the enum is `linkItems`' only other gate.
  //
  // Neither can be forged here. `supersedes` is in the vocabulary because it
  // is part of the file format (spec §3.2) and `supersedeItem` writes it;
  // `superseded_by` is deliberately not (see `SUPERSEDED_BY`). Writing either
  // through `linkItems` would assert a supersession with none of the
  // lifecycle side effects — `status`, `validUntil` on the retiree — that
  // make the assertion true, leaving the file and the item's actual state
  // contradicting each other.
  //
  // The remedy names BOTH orderings rather than one ready-made command. A
  // relation is stored on the item named by `from`, so this call means "from
  // supersedes to"; mechanically inverting that into `supersede_item(id: to,
  // by: from)` was verified to retire the wrong item in the case this
  // vocabulary exists for — an agent recording that it had answered an open
  // question wrote `from: <question>, to: <answer>`, and following the
  // printed remedy retired the ANSWER and left the question standing.
  // Whichever way round the caller meant it, they have to read a sentence
  // naming the item that gets retired before they can copy a command.
  if (input.relation === 'supersedes' || input.relation === SUPERSEDED_BY) {
    throw new Error(
      `my_context: "${input.relation}" cannot be added with link_items — it asserts a lifecycle ` +
      `change, not just a relation, and link_items never touches status. supersede_item writes ` +
      `both directions itself ("supersedes" on the replacement, "${SUPERSEDED_BY}" on the item ` +
      `it retires). Name the item being RETIRED as its "id": if that is ${input.from} — it was ` +
      `answered or replaced by ${input.to} — use ` +
      `supersede_item(id: "${input.from}", by: "${input.to}"); if it is ${input.to}, use ` +
      `supersede_item(id: "${input.to}", by: "${input.from}"). A human retires a governing ` +
      `normative item with \`mycontext supersede <retired id> --by <replacement id>\`; an agent ` +
      `cannot, either way. See mycontext_help("workflow").`,
    );
  }
  if (!RELATION_TYPES.includes(input.relation)) {
    throw new Error(enumError('relation', input.relation, RELATION_TYPES, 'workflow'));
  }
  if (input.from === input.to) {
    throw new Error(`my_context: ${input.from} cannot link to itself.`);
  }
  validateRelationTarget(input.to, '"to"');

  const from = requireWritableItem(ctx, input.from);
  const target = ctx.store.get(input.to);

  if (from.relations.some((r) => r.type === input.relation && r.target === input.to)) {
    return {
      id: from.id,
      created: false,
      status: from.status,
      filePath: from.filePath,
      message: `my_context: ${from.id} already ${input.relation} ${input.to}.`,
    };
  }

  from.relations.push({ type: input.relation, target: input.to });
  persist(ctx, from);

  // Unresolved links are permitted by design (spec §3.2) and resolve on the
  // next sync, so this is a note rather than an error.
  const note = target
    ? ''
    : ` Note: ${input.to} does not exist yet; the link resolves when it is created.`;

  return {
    id: from.id,
    created: true,
    status: from.status,
    filePath: from.filePath,
    message: `my_context: ${from.id} ${input.relation} ${input.to}.${note}`,
  };
}
