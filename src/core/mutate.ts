import type { Config, ResolvedCategory } from './config.ts';
import { computeItemChecksum } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem } from './rebuild.ts';
import { checksum, makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError } from './teach.ts';
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
 * Identity of an item's *content* — deliberately excludes `id`, `status`,
 * `origin`, and provenance (`sourceFile`/`sourceAnchor`/`sourceChecksum`),
 * since none of those change what the item *asserts*. `severity` and
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
    body: input.body ?? '',
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

/** Block the current thread without a dependency and without a busy loop. */
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Retry a write that lost a race for the SQLite write lock. `busy_timeout` (set
 * in Store.open) covers most contention; this covers the rest. Anything that is
 * not a lock error rethrows immediately — retrying a schema error just makes the
 * failure slower. Exhaustion is rethrown as a teaching message: every error this
 * module throws is prefixed `my_context:`, and a raw `SQLITE_BUSY` string is not.
 */
export function withRetry<T>(fn: () => T, attempts = 5): T {
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
 * Spec §7.1. Agents capture freely; nothing they author governs future work
 * until a human promotes it. The tier argument must come from the *resolved*
 * config so per-project tier overrides and custom categories are covered —
 * reading the built-in category table here would quietly exempt every
 * project override. This is a hard override, not a default: an agent that
 * explicitly passes `status: 'active'` for a normative item is still forced
 * to `draft`, or one argument would defeat the whole boundary.
 */
export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {
  if (origin === 'agent' && tier === 'normative') return 'draft';
  return requested;
}

const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const SEVERITIES: Severity[] = ['hard', 'soft'];
const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

/**
 * Without this, `status: 'activ'` (or any other typo) persists happily —
 * the item is then never actually `'active'`, so it is never selected or
 * injected, while `createItem`'s own return message still reports success.
 */
function validateEnums(input: CreateInput): void {
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
function validateExtra(extra: Record<string, string>): void {
  for (const key of Object.keys(extra)) {
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
  }
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
function locateInFamily(
  ctx: MutationContext, prefix: string, title: string, hash: string,
): { duplicate: Item | null; nextId: string } {
  const base = makeId(prefix, title);
  for (let n = 1; n <= MAX_FAMILY; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const item = projectItem(ctx, candidate);
    if (!item) return { duplicate: null, nextId: candidate };
    if (itemContentHash(item) === hash) return { duplicate: item, nextId: candidate };
  }
  throw new Error(
    `my_context: cannot allocate an id for "${title}" — ${MAX_FAMILY} variants already exist. ` +
    `Use a more specific title.`,
  );
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
export function persist(ctx: MutationContext, item: Item): void {
  item.checksum = computeItemChecksum(item);
  writeItem(ctx.root, item);
  withRetry(() => ctx.store.upsert(item));
}

export function createItem(ctx: MutationContext, input: CreateInput): MutationResult {
  const category = resolveCategory(ctx, input.type);

  const title = (input.title ?? '').trim();
  if (title === '') throw new Error(missingFieldError('title', 'create_item', 'capture'));

  validateEnums(input);
  validateExtra(input.extra ?? {});

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  const hash = contentHash({ ...input, title });

  // `type` is part of the match: a requirement and a constraint captured
  // from the same heading are different items, not a collision.
  const anchored = sourceFile !== null && sourceAnchor !== null
    ? projectItems(ctx).find(
        (i) => i.type === input.type && i.sourceFile === sourceFile && i.sourceAnchor === sourceAnchor,
      )
    : undefined;

  if (anchored) {
    const same = itemContentHash(anchored) === hash;
    return {
      id: anchored.id,
      created: false,
      status: anchored.status,
      filePath: anchored.filePath,
      message: same
        ? `my_context: already captured as ${anchored.id}. Nothing changed.`
        // sourceAnchor already begins with the Markdown heading's own '#'
        // characters (e.g. "## Password reset") — concatenating another
        // '#' as a separator would double it up mid-word.
        : `my_context: ${anchored.id} already covers ${sourceFile} ${sourceAnchor} with ` +
          `different wording. Call update_item(id: "${anchored.id}", ...) rather than ` +
          `creating a second item for the same passage.`,
    };
  }

  let id: string;
  if (input.id !== undefined) {
    // An explicit id names an item this call must never silently overwrite.
    // Only two outcomes are legal: it's the same content (a no-op duplicate),
    // or the caller is pointed at update_item/supersede_item instead.
    const existing = projectItem(ctx, input.id);
    if (existing) {
      if (itemContentHash(existing) === hash) {
        return {
          id: existing.id,
          created: false,
          status: existing.status,
          filePath: existing.filePath,
          message: `my_context: already captured as ${existing.id}. Nothing changed.`,
        };
      }
      throw new Error(
        `my_context: "${input.id}" already exists with different content. create_item never ` +
        `overwrites an existing item — call update_item(id: "${input.id}", ...) to change it, ` +
        `or supersede_item(id: "${input.id}", ...) to replace it with a new revision.`,
      );
    }
    id = input.id;
  } else {
    const located = locateInFamily(ctx, category.prefix, title, hash);
    if (located.duplicate) {
      return {
        id: located.duplicate.id,
        created: false,
        status: located.duplicate.status,
        filePath: located.duplicate.filePath,
        message: `my_context: already captured as ${located.duplicate.id}. Nothing changed.`,
      };
    }
    id = located.nextId;
  }

  const origin: Origin = input.origin ?? 'human';
  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');
  const item: Item = {
    id,
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
    body: (input.body ?? '').trim(),
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    layer: 'project',
    filePath: `items/${input.type}/${id}.md`,
  };

  persist(ctx, item);

  const suffix = status === 'draft' && origin === 'agent'
    ? ` It is a draft because agent-authored ${category.tier} items are not injected ` +
      `until reviewed — run \`mycontext review\` to promote it.`
    : '';

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}`,
  };
}
