import type { Config, ResolvedCategory } from './config.ts';
import { computeItemChecksum } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem } from './rebuild.ts';
import { checksum, makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError } from './teach.ts';
import type { Item, Observation, Origin, Relation, Severity, Status } from './types.ts';

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
   * Explicit id. Defaults to `makeId(prefix, title)` via allocateId.
   * Plan 4 requires this: a superseded item and its replacement share a title,
   * so the replacement needs an explicit revision id (`-r2`) to avoid colliding
   * with the item it replaces.
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
  scope: string[];
  tags: string[];
  observations: Observation[];
  relations: Relation[];
  extra: Record<string, string>;
}

/**
 * Identity of an item's *content*, deliberately excluding id, status, origin and
 * provenance. Two calls that say the same thing hash the same even though one
 * would receive a suffixed id, which is what makes create_item idempotent
 * (spec §7.3: idempotency lives in the tool, not in the model's discipline).
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify({
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations,
    relations: v.relations,
    extra: v.extra,
  }));
}

export function contentHash(input: CreateInput): string {
  return hashContent({
    type: input.type,
    title: input.title,
    body: input.body ?? '',
    scope: input.scope ?? [],
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
 * failure slower.
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
      sleepMs(20 * (attempt + 1));
    }
  }
  throw lastError;
}

function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {
  const category = ctx.config.categories[type];
  if (!category) {
    throw new Error(enumError('type', type, Object.keys(ctx.config.categories), 'categories'));
  }
  if (!category.enabled) {
    throw new Error(
      `my_context: category "${type}" is disabled in this project, so no new ` +
      `${type} items are accepted. Enable it in .my_context/config.json under ` +
      `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`,
    );
  }
  return category;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizePosix(value);
}

/** An id nobody else holds. Existing content is compared by the caller first. */
function allocateId(ctx: MutationContext, prefix: string, title: string): string {
  const base = makeId(prefix, title);
  if (!ctx.store.get(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!ctx.store.get(candidate)) return candidate;
  }
  throw new Error(
    `my_context: cannot allocate an id for "${title}" — 1000 variants already exist. ` +
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

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  const hash = contentHash({ ...input, title });

  const anchored = sourceFile !== null && sourceAnchor !== null
    ? ctx.store.all().find((i) => i.sourceFile === sourceFile && i.sourceAnchor === sourceAnchor)
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
        : `my_context: ${anchored.id} already covers ${sourceFile}#${sourceAnchor} with ` +
          `different wording. Call update_item(id: "${anchored.id}", ...) rather than ` +
          `creating a second item for the same passage.`,
    };
  }

  const byTitle = ctx.store.get(makeId(category.prefix, title));
  if (byTitle && itemContentHash(byTitle) === hash) {
    return {
      id: byTitle.id,
      created: false,
      status: byTitle.status,
      filePath: byTitle.filePath,
      message: `my_context: already captured as ${byTitle.id}. Nothing changed.`,
    };
  }

  const id = input.id ?? allocateId(ctx, category.prefix, title);
  const status: Status = input.status ?? 'active';
  const item: Item = {
    id,
    type: input.type,
    title,
    status,
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    origin: input.origin ?? 'human',
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

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: created ${id} (${item.status}) at ${item.filePath}.`,
  };
}
