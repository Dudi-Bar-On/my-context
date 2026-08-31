/**
 * The write plumbing every mutation shares: the SQLite busy retry, the
 * Markdown-then-index `persist` choke point, the project-layer write
 * authorization (`requireWritableItem`), the audit record, and the
 * lifecycle stamp (`stampValidUntil`). Split out of `mutate.ts` in Wave 5:
 * these are about HOW a write lands, not about which mutation is being made,
 * and `relations.ts` needs them without needing `createItem`.
 */
import { auditFailureNote, recordAudit, type MutationOp } from './audit.ts';
import { computeItemChecksum } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem, type WriteItemOptions } from './rebuild.ts';
import { isSnapshot, snapshotSource } from './reference.ts';
import { checksum } from './slug.ts';
import { sleepMs } from './sleep.ts';
import { unknownIdError } from './teach.ts';
import type { Item, Origin, Status } from './types.ts';
import type { MutationContext } from './mutate.ts';

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

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeSource(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizePosix(value);
}

/** Project-layer items only — global-layer rows are a different owner's
 * items, indexed for read-time selection, and must never be treated as
 * something create_item already wrote or could overwrite. */
export function projectItems(ctx: MutationContext): Item[] {
  return ctx.store.all().filter((i) => i.layer === 'project');
}

/** `Store.get` looks up by id across every layer; this narrows to the one
 * this module is allowed to reason about — see `projectItems`. */
export function projectItem(ctx: MutationContext, id: string): Item | null {
  const item = ctx.store.get(id);
  return item && item.layer === 'project' ? item : null;
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

/**
 * Records one mutation in the run-time audit log and returns the sentence to
 * append to the caller's own message — '' when the record was written.
 *
 * **Called where the mutation is KNOWN to have succeeded, not inside
 * `persist`.** `persist` is the single write choke point and would have been
 * the obvious place, but `createItem` calls it inside a retry loop that walks
 * a family of candidate ids and swallows `EEXIST` — auditing there would
 * record an operation for every id a racing process took first, i.e. writes
 * that never happened. The audit log's whole value is that a record in it
 * corresponds to something that occurred.
 *
 * Nothing enforces at compile time that a NEW mutation function calls this.
 * That is covered instead by `test/core/audit-coverage.test.ts`, which
 * enumerates `MUTATION_OPS` and drives a real surface for each one, so an op
 * added to the vocabulary without a surface that emits it fails the suite, and
 * a surface added without a record fails the case that names it.
 */
export function auditMutation(
  ctx: MutationContext,
  op: MutationOp,
  origin: Origin,
  itemId: string,
  extra: { fields?: string[]; note?: string } = {},
): string {
  return auditFailureNote(recordAudit(ctx.root, {
    kind: 'mutation',
    op,
    origin,
    itemId,
    ...(extra.fields === undefined || extra.fields.length === 0 ? {} : { fields: extra.fields }),
    ...(extra.note === undefined ? {} : { note: extra.note }),
  }));
}

/**
 * The item fields an update actually MOVED, sorted — not the fields the call
 * carried.
 *
 * An `update_item` that re-sends a tag list identical to the item's own has
 * changed nothing, and recording `tags` for it would make the audit log
 * disagree with the item's own history. Compared against a snapshot taken
 * immediately before the assignment block, by value, so a reordered `tags`
 * array or an `extra` merge that set every key to what it already held reads
 * as the no-op it is.
 */
const AUDITED_FIELDS = [
  // `summary` is here because it is CONTENT (`UPDATE_FIELD_POLICY`, trust.ts)
  // and the audit log is what answers "what did this session do": a summary is
  // the most quotable thing an item has, so a session that rewrote one and
  // left no record of it is the gap this log exists to close. `summaryOf` is
  // NOT here — it is derived from the item by `stampSummary` and never moves
  // on its own, so recording it would name a second field for every change to
  // the first.
  'title', 'body', 'summary', 'scope', 'tags', 'severity', 'always', 'status', 'extra',
] as const;

type AuditedSnapshot = Record<(typeof AUDITED_FIELDS)[number], unknown>;

export function snapshotFields(item: Item): AuditedSnapshot {
  return {
    title: item.title, body: item.body, summary: item.summary,
    scope: [...item.scope], tags: [...item.tags],
    severity: item.severity, always: item.always, status: item.status, extra: { ...item.extra },
  };
}

export function movedFields(before: AuditedSnapshot, item: Item): string[] {
  const after = snapshotFields(item);
  return AUDITED_FIELDS.filter(
    (f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]),
  ).slice().sort();
}

/** Looks up across every layer (unlike `projectItem`) because `updateItem`,
 * `supersedeItem` and `linkItems` all need to name *any* known id in their
 * error messages — a global-layer id is a legitimate link/supersede target
 * to *read*. This is a lookup, not a write authorization: callers that are
 * about to persist the result must go through `requireWritableItem` below,
 * which enforces the layer boundary this function does not. */
export function requireItem(ctx: MutationContext, id: string): Item {
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
export function requireWritableItem(ctx: MutationContext, id: string): Item {
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
 * silent, invisible narrowing `guardedChange` (trust.ts) exists to refuse.
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
export function stampValidUntil(item: Item): void {
  if (isRetired(item.status)) {
    if (item.validUntil === null) item.validUntil = today();
  } else {
    item.validUntil = null;
  }
}
