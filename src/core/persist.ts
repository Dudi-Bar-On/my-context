/**
 * The write plumbing every mutation shares: the SQLite busy retry, the
 * Markdown-then-index `persist` choke point, the project-layer write
 * authorization (`requireWritableItem`), the audit record, and the
 * lifecycle stamp (`stampValidUntil`). Split out of `mutate.ts` in Wave 5:
 * these are about HOW a write lands, not about which mutation is being made,
 * and `relations.ts` needs them without needing `createItem`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  auditFailureNote, recordAudit, type DivergenceRef, type MutationOp,
} from './audit.ts';
import { classifyChecksumMismatch, computeItemChecksum, parseItem } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem, type WriteItemOptions } from './rebuild.ts';
import { isSnapshot, snapshotChecksum, snapshotSource } from './reference.ts';
import { checksum } from './slug.ts';
import { sleepMs } from './sleep.ts';
import { unknownIdError } from './teach.ts';
import type { Item, Origin, Status } from './types.ts';
import { isoDay } from './validate.ts';
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

/**
 * The day every `valid_from`/`valid_until` stamp is written with.
 *
 * `isoDay` rather than an inline `.toISOString().slice(0, 10)`: a caller may
 * now SET `valid_from` (`mycontext add --valid-from`), and the guard that
 * refuses a date this format cannot store has to check against the same
 * expression that writes one. Two spellings of "a stored day" is how a
 * validator comes to accept what the writer would not produce.
 */
export function today(): string {
  return isoDay(new Date());
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

export interface PersistOptions extends WriteItemOptions {
  /**
   * **This write CARRIES a body** — the caller supplied one, whether or not it
   * moved. `updateItem` is the only caller that sets it, from `body !==
   * undefined`, and it is the trigger for `reconcileSnapshot` below.
   *
   * It is "carries" rather than "moved" deliberately, and the difference is
   * what makes an already-damaged item repairable: on an item whose
   * `source_checksum` was already re-stamped from an authored body, the body
   * and the record agree with each other and disagree with the file, which is
   * byte-for-byte the state of a legitimately DRIFTED snapshot. Nothing on
   * disk separates the two, so no automatic pass can heal one without
   * corrupting the other. Re-writing the item's own body through
   * `mycontext edit --body` is the explicit act that says which it is, and it
   * moves nothing — so a trigger keyed on movement would ignore exactly the
   * items that need it.
   */
  bodyWritten?: boolean;
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
export function persist(ctx: MutationContext, item: Item, options?: PersistOptions): void {
  // FIRST, before a byte is written: what does the file we are about to
  // overwrite actually say about itself? See `detectDivergence`. It has to
  // happen here and not later because `writeItem` below destroys the
  // evidence — unconditionally, on every write path.
  const diverged = detectDivergence(ctx.root, item);
  // A whole-file snapshot's `source_checksum` is not an independent field, and
  // this is where it is kept in step: the one function every write path funnels
  // through, rather than at each of them. `mycontext refresh` supplies a new
  // body and does NOT set the checksum itself, and `promoteRevision` applies a
  // staged refresh through `updateItem` with only `body`; without this, both
  // would leave the checksum describing text the item no longer holds.
  //
  // What it must NOT do is decide what the field MEANS from the body alone —
  // see `reconcileSnapshot`, which is that whole story.
  const provenance = options?.bodyWritten === true && isSnapshot(item)
    ? reconcileSnapshot(ctx.root, item)
    : null;
  item.checksum = computeItemChecksum(item);
  // Markdown first, and `writeItem` throws before the index is touched when
  // `exclusive` finds the file taken — so a racer that loses the id never
  // upserts a row for an item it did not write.
  writeItem(ctx.root, item, options);
  withRetry(() => ctx.store.upsert(item));
  // AFTER the write succeeded, never before: `createItem` calls this in a
  // retry loop that walks a family of candidate ids and swallows `EEXIST`, and
  // a witness left behind by an attempt that threw would describe a write that
  // never happened — the same reason `auditMutation` is not called from here.
  lastWrite = {
    itemId: item.id,
    checksumAfter: item.checksum,
    ...(diverged === null ? {} : { diverged }),
    ...(provenance === null ? {} : { provenance }),
  };
}

/**
 * **What a snapshot's `source_checksum` still means after a write that carries
 * a body — and whether the item is still a snapshot at all.**
 *
 * The field this repairs was doing two jobs at once and could only ever do
 * one. `persist` used to re-stamp it from the body on EVERY write while
 * `isSnapshot(item)` held, on the assumption written into the old comment
 * here: that a snapshot's `source_checksum` "is the checksum of the content
 * the item HOLDS, which is its body". That assumption is true only while the
 * body IS the file. `mycontext edit --body` breaks it, and the re-stamp then
 * makes the break permanent and invisible: `source_checksum` starts describing
 * authored text while `source_file` still names a file, `doctor`'s
 * `source_drift` compares the file against a number that no longer describes
 * it, and the remedy it prints — `mycontext refresh` — replaces the authored
 * body whole from the file. A command the tool recommends destroys the work.
 * Measured live: fifteen `edit --body` writes to repair citations, five of
 * them on snapshot items, and `doctor` went from 0 warnings to 5
 * `source_drift`. See `KNOWN-edit-body-silently-re-stamps-source-checksum-on-a-snapshot`.
 *
 * **The rule, in one sentence: a snapshot survives a body write only if what
 * was written is what the file says now.** Three outcomes, decided by reading
 * the file the item itself names:
 *
 *  - `resnapshotted` — the body equals the file's current text. This is
 *    `refresh`, and a promoted staged refresh, and it is the case the re-stamp
 *    existed for. The checksum is set from the body, which is also the file's,
 *    so the two fields agree about one thing rather than two.
 *  - `ended` — the body is text the file does not contain. The item is no
 *    longer a copy of anything, so it stops claiming to be: `source_checksum`
 *    is CLEARED, `isSnapshot` goes false, `doctor` stops asking a question
 *    with no answer and `refresh` refuses with the sentence it already has for
 *    this shape ("names X but records no source_checksum ... Capture it again
 *    with --file").
 *  - `unconfirmed` — the file could not be read. NOTHING is changed, in either
 *    direction: ending a provenance record on a transient read failure would
 *    destroy a true fact, and re-stamping would assert one nobody checked.
 *    `doctor` already reports this item as `source_missing`, at `error`.
 *
 * **`source_file` is KEPT, and that is a decision rather than an omission.**
 * The two fields answer different questions. `source_checksum` answers *which
 * state of that file does this body hold*, and after the body is authored over
 * there is no answer — so it goes. `source_file` answers *where did this text
 * come from*, and that is still true of authored text derived from a file; it
 * is the only surviving record of the provenance, and deleting a true fact to
 * avoid an implication would be the reverse of the problem being fixed. The
 * shape this leaves — a `source_file` with no checksum — is one the product
 * already names and explains rather than one nobody planned for: it is the
 * third refusal branch in `cli/commands/refresh.ts`.
 *
 * The alternative, clearing all three (which
 * `KNOWN-edit-body-silently-re-stamps-source-checksum-on-a-snapshot` suggests),
 * is one line away in the `ended` branch and needs no new capability either —
 * the "nothing can clear `source_file`" gap that item records is about CLI
 * FLAGS and validator-reserved keys, and this function writes the item object
 * directly. It is not taken because it destroys information, and it is named
 * here so overturning it is an edit rather than a rediscovery.
 *
 * **Never widened into `isSnapshot`.** That predicate is a field-SHAPE test
 * with three other callers — `refresh`, `doctor`'s `checkSnapshotDrift` and
 * the MCP `refresh_item` — which all need "does this item carry the snapshot
 * shape", not "did somebody author over it". Teaching it about behaviour would
 * change all three at once to answer a question none of them asked.
 */
export type SnapshotReconciliation =
  | { kind: 'resnapshotted'; checksum: string }
  | { kind: 'ended'; sourceFile: string; wasChecksum: string }
  | { kind: 'unconfirmed'; sourceFile: string };

function reconcileSnapshot(root: string, item: Item): SnapshotReconciliation | null {
  // Both established by `isSnapshot`, which the caller has already applied.
  const sourceFile = item.sourceFile as string;
  const recorded = item.sourceChecksum as string;

  // Resolved against the REPOSITORY root, not the corpus root: `source_file`
  // is repo-root-relative, which is what `readSnapshot` records, what `doctor`
  // resolves and what `mycontext refresh` re-reads. `path.dirname(ctx.root)`
  // is the same fallback `refresh` uses when it has no cwd to walk up from;
  // under `MYCONTEXT_CORPUS_DIR` the two diverge, the file is not found, and
  // the outcome is `unconfirmed` — which changes nothing, so a corpus pointed
  // somewhere else cannot end a provenance record by accident.
  const absolute = path.resolve(path.dirname(root), ...sourceFile.split('/'));
  let live: string;
  try {
    live = snapshotChecksum(readFileSync(absolute, 'utf8'));
  } catch {
    return { kind: 'unconfirmed', sourceFile };
  }

  const body = checksum(snapshotSource(item.body));
  if (body === live) {
    // A no-op when the item was already in sync, and the whole point of this
    // function's existence when it was not.
    item.sourceChecksum = body;
    return { kind: 'resnapshotted', checksum: body };
  }

  item.sourceChecksum = null;
  return { kind: 'ended', sourceFile, wasChecksum: recorded };
}

/**
 * **Did something other than my_context write this item's file since my_context
 * last did?** Measured over the bytes still on disk, at the last instant they
 * exist — `persist` calls this immediately before `writeItem` overwrites them.
 *
 * The measurement is the one `loadLayer` (rebuild.ts) already makes at load
 * time and reports as a corpus LOAD ERROR: a file's recorded checksum covers
 * `extra`, and `extra` is where `state` lives, so a hand-edited item hashes to
 * something its own frontmatter does not claim. What is new here is only
 * WHERE the answer is put. `writeItem` recomputes the checksum unconditionally
 * (`const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) }`),
 * so the next ordinary `mycontext edit` on that item — for any reason at all,
 * on any field — re-hashes the hand-edited value and the divergence is gone
 * with nothing recorded anywhere. Measured on this repository's own corpus:
 * every flagged item had a later product write, and every one now checksums
 * cleanly. The evidence erodes while you look at it. This lifts it into the
 * audit log, which no later write can reach.
 *
 * **It never refuses the write.** The owner ruled against blocking — shell
 * blocking was tried and reverted, because a guard that reads as complete and
 * is not is worse than none — and ruled for visibility instead. Every caller
 * of this function ignores the result except to record it.
 *
 * Four cases answer `null`, and each is a deliberate silence rather than a
 * clean bill of health:
 *
 *  - **No file yet.** The ordinary `add` path. There is nothing to have
 *    diverged from.
 *  - **The file will not parse.** `loadLayer` reports that as its own load
 *    error, loudly, on every command; saying it again from a write path would
 *    add a second voice for one fact and no new information.
 *  - **No checksum recorded.** A hand-authored file, or one written before
 *    checksums existed, has nothing to verify against — `loadLayer` draws the
 *    same line for the same reason.
 *  - **A basis migration.** The recorded value was computed by an older
 *    formula (`classifyChecksumMismatch`, item.ts), so a disagreement is
 *    EXPECTED and says nothing about whether anyone touched the content.
 *    Reporting it as a hand edit would be an accusation the evidence does not
 *    support, and it would fire on every item in every corpus on the release
 *    that changes the basis.
 *
 * The read costs one small file per write, against a write that is already
 * doing a temp-file-plus-rename on the same path.
 */
export function detectDivergence(root: string, item: Item): DivergenceRef | null {
  let raw: string;
  try {
    raw = readFileSync(path.join(root, ...item.filePath.split('/')), 'utf8');
  } catch {
    return null;
  }
  let onDisk: Item;
  try {
    onDisk = parseItem(raw, item.filePath, item.layer);
  } catch {
    return null;
  }
  const recorded = onDisk.checksum;
  if (!recorded) return null;
  if (classifyChecksumMismatch(recorded) === 'migration') return null;
  const actual = computeItemChecksum(onDisk);
  return actual === recorded ? null : { recorded, actual };
}

/**
 * What the last successful `persist` in this process observed and stamped,
 * waiting for the `auditMutation` that records the same act.
 *
 * **A single slot rather than a map, and it is consumed on read.** The two
 * functions are the two halves of one mutation and always run in that order,
 * adjacent, in the same synchronous call — `updateItem`, `supersedeItem`,
 * `linkItems` and `promoteRevision` all read `persist(...)` then
 * `auditMutation(...)` with the same item. Passing the witness as an argument
 * would have been plainer, but it would mean editing every mutation surface in
 * two other modules to thread a value each of them only forwards.
 *
 * The hazards that shape it, both real:
 *
 *  - **A `persist` with no audit record.** `mycontext repair` re-stamps items
 *    and records nothing (see the gap noted in `auditMutation`). Its witness
 *    would linger and could attach itself to some later record for the same
 *    id. So the slot is cleared by the first `auditMutation` that reads it,
 *    whether or not the id matches.
 *  - **An audit record with no `persist`.** `stage` writes a revision, not the
 *    item; `acknowledge` and `discard` likewise. So the id is checked, and a
 *    witness for a different item is dropped rather than misattributed.
 */
interface WriteWitness {
  itemId: string;
  checksumAfter: string;
  diverged?: DivergenceRef;
  provenance?: SnapshotReconciliation;
}

let lastWrite: WriteWitness | null = null;

function takeWriteWitness(itemId: string): WriteWitness | null {
  const witness = lastWrite;
  lastWrite = null;
  if (witness === null || witness.itemId !== itemId) return null;
  return witness;
}

/**
 * What a write owes the person who ran it when it ended, or could not confirm,
 * an item's snapshot provenance.
 *
 * **Said out loud, and not only recorded.** Clearing `source_checksum` is a
 * field disappearing from a person's item as a side effect of an edit about
 * something else; leaving it unsaid would be `INV-nothing-is-dropped-silently`
 * broken by the fix for a silent drop. It travels the same way the audit-log
 * failure note does — appended by `auditMutation` to the message every
 * mutation surface already prints — so `mycontext edit`, the MCP tools and the
 * UI all carry it without one of them having to remember to.
 *
 * `resnapshotted` says nothing: that is `refresh` doing exactly what it
 * announced, and it prints the checksum change itself.
 */
function provenanceNote(itemId: string, outcome: SnapshotReconciliation): string {
  if (outcome.kind === 'resnapshotted') return '';
  if (outcome.kind === 'unconfirmed') {
    return (
      ` NOTE: ${itemId} records a snapshot of "${outcome.sourceFile}", which could not be read, ` +
      `so whether it is still a copy of that file could not be decided. Nothing about its ` +
      `provenance was changed in either direction. \`mycontext doctor\` reports the unreadable ` +
      `source as source_missing.`
    );
  }
  return (
    ` NOTE: ${itemId} was a snapshot of "${outcome.sourceFile}", and the body just written is ` +
    `not that file's current text — so it is no longer a copy of it and has stopped saying it ` +
    `is: source_checksum (${outcome.wasChecksum}) was cleared. The body was written exactly as ` +
    `given and nothing else was touched. source_file is KEPT, as the record of where this text ` +
    `came from. From here \`mycontext doctor\` no longer checks this item for source_drift — so ` +
    `it can no longer tell you to \`mycontext refresh\` it, which would have replaced this body ` +
    `whole with the file — and \`mycontext refresh\` refuses it.`
  );
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
 *
 * **It carries what the write it records observed and stamped**, taken from
 * the `persist` immediately above it — see `lastWrite`. `checksumAfter` is on
 * every record whose op actually wrote an item file; `diverged` is on the ones
 * whose file had moved underneath the product first.
 *
 * **The one write path this does not cover, said here rather than left to be
 * found:** `mycontext repair` (cli/commands/repair.ts) calls `persist` and
 * writes NO audit record, so a re-stamp leaves no trace in this log even
 * though `persist` measured the divergence it was re-stamping. That path is
 * not silent — `doctor` reported the mismatch first, and `repair` prints every
 * item it touches — but the log does not hold it. Closing it means a new
 * member of `MUTATION_OPS`, which `test/core/audit-coverage.test.ts` requires
 * a driven surface for.
 */
export function auditMutation(
  ctx: MutationContext,
  op: MutationOp,
  origin: Origin,
  itemId: string,
  extra: { fields?: string[]; note?: string } = {},
): string {
  const witness = takeWriteWitness(itemId);
  const written = auditFailureNote(recordAudit(ctx.root, {
    kind: 'mutation',
    op,
    origin,
    itemId,
    ...(extra.fields === undefined || extra.fields.length === 0 ? {} : { fields: extra.fields }),
    ...(extra.note === undefined ? {} : { note: extra.note }),
    ...(witness === null ? {} : { checksumAfter: witness.checksumAfter }),
    ...(witness?.diverged === undefined ? {} : { diverged: witness.diverged }),
    ...(witness?.provenance === undefined || witness.provenance.kind === 'resnapshotted'
      ? {}
      : { snapshotEnded: witness.provenance }),
  }));
  return witness?.provenance === undefined
    ? written
    : `${written}${provenanceNote(itemId, witness.provenance)}`;
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
  // `extra` is the ONE entry here that does not name what gets recorded:
  // `movedFields` expands it per key, so a write reports `extra.state` rather
  // than `extra`. It stays a single entry in this list because the SNAPSHOT is
  // per bag — one object comparison — and only the report is per key.
  //
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

/**
 * `extra` reports per KEY — `extra.state`, `extra.priority` — and never as one
 * name for the whole bag.
 *
 * **The coarse spelling was the single reason `state_unaudited` (doctor/
 * checks.ts) could only ever be a floor on the bypass and never a count of
 * it.** `state` is an extra field (`categories.ts`: `task.state`), so a record
 * that moved `state` said `extra`, and so did a record that moved `priority`,
 * `progress`, `last_change` or `needs`. An unrelated `priority` edit therefore
 * CREDITED an item whose `state` was never written through the product, and
 * the check had to say so in every finding it wrote. At this resolution the
 * question "did a recorded write ever set this item's state" has an answer.
 *
 * Additions, removals and value changes all count, which is why the key set is
 * the union of both sides: `extra.state` moved whether it appeared, vanished
 * or changed. Values are compared by `JSON.stringify` like every other audited
 * field, so re-sending a key with the value it already held reads as the no-op
 * it is.
 *
 * The values themselves are NOT recorded — this log stores no copy of item
 * content, by the rule in `audit.ts`'s header — so a reader learns which keys
 * a write moved, never what they moved to.
 */
function movedExtraKeys(before: unknown, after: unknown): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((key) => JSON.stringify(b[key]) !== JSON.stringify(a[key]))
    .map((key) => `extra.${key}`);
}

export function movedFields(before: AuditedSnapshot, item: Item): string[] {
  const after = snapshotFields(item);
  const moved: string[] = [];
  for (const field of AUDITED_FIELDS) {
    if (field === 'extra') {
      moved.push(...movedExtraKeys(before.extra, after.extra));
      continue;
    }
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) moved.push(field);
  }
  return moved.sort();
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
