import { appendFileSync, mkdirSync, readFileSync, truncateSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseItem } from './item.ts';
import { acquireLock } from './lock.ts';
import {
  updateItem, validateBody, validateTags, validateTitle,
  type MutationContext, type MutationResult,
} from './mutate.ts';
import { checksum } from './slug.ts';
import { unknownIdError } from './teach.ts';
import { normalizeEol } from './text.ts';
import type { Item, Origin } from './types.ts';

// --- Staged revisions -------------------------------------------------------
//
// An agent's edit to a governing item's CONTENT does not apply. It becomes a
// pending revision, and the item keeps governing its current text until a
// human promotes the change (spec §4). This module is the store for those
// revisions and their whole lifecycle: stage, read, promote, discard.
//
// **Modelled on the ingest session (`src/ingest/session.ts`), not on lesson
// staging (`src/lesson/derive.ts`).** Both solve propose → hold → approve or
// reject, and both were read before this was written. The ingest session's
// shape was chosen for three reasons, in order of weight:
//
//  1. Lesson staging persists by REWRITING a whole JSON file
//     (`saveStaging`: temp file + rename). That is atomic per write, but a
//     rewrite means the file's content at any moment is one process's idea of
//     the whole truth — two processes settling two different revisions each
//     write a full document, and the second erases the first's outcome. The
//     ingest session hit exactly this and moved `applied` out of the header
//     into an append-only log for exactly this reason; its doc comment records
//     that the rewrite version "made the second writer silently erase the
//     first writer's applied entry". A promotion erased that way is a human
//     decision lost without a trace, which is the worst outcome this module
//     has.
//  2. An append-only log answers "discarding must not lose the proposal
//     silently" structurally rather than by remembering to. A discard APPENDS
//     a line; it never rewrites or removes the `stage` line, so the proposed
//     text stays on disk verbatim and `revisionHistory` reads it back. Under a
//     rewrite-based store, "keep the discarded proposal" is a property of
//     whoever wrote the rewrite.
//  3. A kill mid-append damages at most the final line, and only the final
//     line — `appendToLog` heals a missing trailing newline on the next write,
//     and `readLog` tolerates a broken LAST line while REFUSING a broken
//     earlier one (see `readLog`, which is deliberately stricter than
//     `readAppliedLines` in session.ts).
//
// What is deliberately taken from lesson staging instead: its `loadStaging`
// correction. `loadStaging` used to return `null` for both "absent" and
// "unparseable", which let `lesson-stage` overwrite a corrupt staging file so
// a DISCARDED candidate came back pending and acceptable. `readLog` below
// separates those two outcomes — absent is `[]`, unreadable or corrupt throws
// — and `foldLog` makes a settled revision terminal, so no read of a damaged
// log can resurrect one.
//
// What is deliberately NOT taken from either: neither stores anything under
// `items/`, and neither does this. A revision is not an item. It has no id in
// the item namespace, never reaches `Store`, and `loadLayer` (rebuild.ts)
// walks only `<root>/items`, so nothing in the selection path can see one.

export const REVISION_PROTOCOL = 'my_context/revision@1';

/**
 * The fields a revision may carry: the item's CONTENT, as spec §4 defines it,
 * minus the one content field no write surface can currently change.
 *
 * Spec §4 names "title, body, observations and tags". `observations` is absent
 * here because `UpdateInput` (mutate.ts) has no `observations` field and no
 * command or MCP tool edits an existing item's observations — observations are
 * only ever set at capture. Carrying a field this module could stage but
 * nothing could ever produce, and no promote could apply through `updateItem`,
 * would be a claim of coverage that does not exist. If an observation-editing
 * surface is added, it belongs here and in `promoteRevision`'s apply, together.
 *
 * `scope`, `always`, `severity` and `status` are NOT here and must never be:
 * they stay human-only on a governing normative item regardless of
 * `agentEdits` (spec §4), and a revision that could carry them would be a
 * route around that gate rather than a proposal about content.
 */
export const REVISION_FIELDS = ['title', 'body', 'tags'] as const;

export type RevisionField = (typeof REVISION_FIELDS)[number];

export interface RevisionChanges {
  title?: string;
  body?: string;
  tags?: string[];
}

export interface RevisionRecord {
  /** Stable handle. Derived from the proposal, not from a counter — see `revisionIdFor`. */
  revisionId: string;
  itemId: string;
  /** The proposed values, for exactly the fields this revision touches. */
  changes: RevisionChanges;
  /**
   * Those same fields' values on the item at the moment this was staged. Both
   * halves of the diff `review` shows, and the basis for staleness — see
   * `changedSince`.
   */
  base: RevisionChanges;
  origin: Origin;
  stagedAt: string;
  state: 'pending' | 'promoted' | 'discarded';
  /** When it was promoted or discarded; null while pending. */
  settledAt: string | null;
  /** Free text recorded with a discard. Null otherwise. */
  reason: string | null;
}

export interface PendingRevision extends RevisionRecord {
  state: 'pending';
  /** The item's values NOW for this revision's fields. Empty when `itemMissing`. */
  current: RevisionChanges;
  /**
   * Exactly which of this revision's own fields a human changed since it was
   * staged. Empty means the proposal still applies to the text it was written
   * against.
   */
  changedSince: RevisionField[];
  /** `changedSince.length > 0` — the item moved underneath this proposal. */
  stale: boolean;
  /** The item this revision names is no longer in the index at all. */
  itemMissing: boolean;
}

export interface StageResult {
  revision: RevisionRecord;
  /**
   * The revisions already pending on this item when this one was staged,
   * oldest first, excluding this one. Non-empty means a human has proposals
   * queued that nobody has reviewed yet — see `stageRevision`'s doc comment
   * for why a second revision accumulates rather than being refused.
   */
  alsoPending: PendingRevision[];
  /** True when this exact proposal was already pending; no line was appended. */
  duplicate: boolean;
  message: string;
}

export interface PromoteOptions {
  /** Which revision, when the item has more than one pending. Defaults to the oldest. */
  revisionId?: string;
  /**
   * Promote a STALE revision anyway. The human edit that landed underneath it
   * is overwritten for the fields this revision touches. Refused without it —
   * see `promoteRevision`.
   */
  force?: boolean;
}

export interface PromoteResult {
  revision: RevisionRecord;
  /** `updateItem`'s result for the item this promotion changed. */
  update: MutationResult;
  /**
   * Revisions on the same item still pending afterwards that this promotion
   * just made stale, because it moved the text they were written against.
   */
  invalidated: PendingRevision[];
  message: string;
}

export interface DiscardOptions {
  revisionId?: string;
  reason?: string;
}

export interface DiscardResult {
  revision: RevisionRecord;
  /** The append-only log the discarded proposal's full text remains in. */
  logPath: string;
  message: string;
}

/** One line of `revisions.jsonl`. Every op carries every field it needs to be
 * read on its own; nothing is inherited from a neighbouring line. */
interface LogLine {
  protocol: string;
  op: 'stage' | 'promote' | 'discard';
  revisionId: string;
  itemId: string;
  at: string;
  /** `stage` only. */
  changes?: RevisionChanges;
  /** `stage` only. */
  base?: RevisionChanges;
  /** `stage` only. */
  origin?: Origin;
  /** `discard` only, and optional there. */
  reason?: string;
}

export function revisionDir(root: string): string {
  return path.join(root, '.revisions');
}

export function revisionLogPath(root: string): string {
  return path.join(revisionDir(root), 'revisions.jsonl');
}

/**
 * Creates `.revisions/` and (re)writes its `*` .gitignore, the same shape and
 * for the same reason as `ensureIngestDir` (ingest/session.ts) and
 * `writeSnapshot` (core/ledger.ts): this directory holds working state, not
 * knowledge, and a workspace whose first revision command reached the
 * directory through a bare `mkdirSync` would offer the log — and the lock file
 * — to git. Rewritten unconditionally so an emptied or hand-edited .gitignore
 * self-heals.
 */
function ensureRevisionDir(root: string): string {
  const dir = revisionDir(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
  return dir;
}

/**
 * The workspace-wide lock every SETTLEMENT (promote, discard) is held under.
 *
 * Staging deliberately does not take it. A stage is one `appendFileSync` of
 * one small line, which does not interleave with a concurrent process's append
 * on either POSIX or Windows, and a stage decides nothing about an item — it
 * records `base` and lets promotion check that base later. Settlement is the
 * read-decide-write section: two concurrent promotions of two DIFFERENT
 * revisions of the same item would both pass their staleness check against the
 * same base, both apply, and the second would silently overwrite the first —
 * the exact "promotion that silently discards an intervening change" spec §4
 * names as the wrong outcome.
 *
 * One file for the whole workspace rather than one per item, because the log
 * is one file for the whole workspace: two settlements on two unrelated items
 * still both read and append to it. That is the same reasoning that made the
 * ingest-apply lock per-workspace rather than per-anchor (ingest/lock.ts), and
 * the same trade — two unrelated settlements wait on each other.
 */
function acquireRevisionLock(root: string): () => void {
  const dir = ensureRevisionDir(root);
  return acquireLock({
    file: path.join(dir, 'revisions.lock'),
    name: 'revision',
    otherHolder: 'another process is promoting or discarding a revision in this workspace',
  });
}

/**
 * Derived from the proposal itself — item, base and changes — not from a
 * counter or a timestamp. Two consequences, both wanted:
 *
 *  - Staging the identical proposal twice against the identical text is ONE
 *    revision, not two. An agent that repeats itself does not grow the queue.
 *  - A proposal a human already DISCARDED keeps the same id, so `foldLog`'s
 *    terminal rule recognises it and `stageRevision` refuses it by name rather
 *    than quietly re-staging it. That is the lesson-staging defect
 *    (`loadStaging` returning null for a corrupt file, so a discarded
 *    candidate came back pending) closed from the other side.
 *
 * It does NOT lock a proposal out forever: `base` is part of the derivation, so
 * once the item's text moves, the same `changes` produce a different id and can
 * be staged again.
 */
function revisionIdFor(itemId: string, base: RevisionChanges, changes: RevisionChanges): string {
  return `REV-${checksum(JSON.stringify([itemId, canonical(base), canonical(changes)])).slice(0, 12)}`;
}

/** Fixed key order and sorted tags, so a value built here and the same value
 * read back out of JSON hash and compare identically regardless of the order
 * its keys happened to be written in. */
function canonical(changes: RevisionChanges): unknown[] {
  return REVISION_FIELDS.map((field) => {
    const value = changes[field];
    if (value === undefined) return null;
    return Array.isArray(value) ? [...value].sort() : value;
  });
}

/** Tags are an unordered set (`hashContent` in mutate.ts sorts them for the
 * same reason), so a reordering is not a change; title and body compare
 * exactly. */
function sameValue(a: string | string[] | undefined, b: string | string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const left = [...a].sort();
    const right = [...b].sort();
    return left.every((v, i) => v === right[i]);
  }
  return a === b;
}

/** The item's current values for exactly `fields`. */
function valuesOf(item: Item, fields: RevisionField[]): RevisionChanges {
  const out: RevisionChanges = {};
  for (const field of fields) {
    if (field === 'title') out.title = item.title;
    else if (field === 'body') out.body = item.body;
    else out.tags = [...item.tags];
  }
  return out;
}

function fieldsOf(changes: RevisionChanges): RevisionField[] {
  return REVISION_FIELDS.filter((f) => changes[f] !== undefined);
}

/**
 * Normalizes and validates a proposal, exactly as `updateItem` would normalize
 * and validate the same values — `title.trim()`, `normalizeEol(body).trim()`,
 * and the same three validators. Doing it here, at stage time, is what makes
 * promotion unable to fail on shape: a proposal that could not be applied is
 * refused when it is made, to the caller that made it, rather than becoming a
 * pending revision that ambushes a human at the approval gate.
 *
 * A field present but unchanged from the item is dropped, and a proposal that
 * changes nothing is refused rather than staged: an empty revision would show
 * a human an empty diff and would count in every queue that counts revisions.
 */
function normalizeChanges(item: Item, changes: RevisionChanges): RevisionChanges {
  const unknown = Object.keys(changes).filter(
    (k) => !(REVISION_FIELDS as readonly string[]).includes(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `my_context: a staged revision carries content only — ` +
      `${REVISION_FIELDS.join(', ')}. It cannot carry ` +
      `${unknown.map((k) => JSON.stringify(k)).join(', ')}. scope, always, severity and status ` +
      `on a governing normative item are human-only whatever a category's agentEdits setting ` +
      `is, so staging one would be a route around that gate rather than a proposal about ` +
      `content. See mycontext_help("capture").`,
    );
  }

  const out: RevisionChanges = {};
  if (changes.title !== undefined) {
    const title = changes.title.trim();
    if (title === '') {
      throw new Error(
        `my_context: a staged revision cannot set an empty title on ${item.id}. ` +
        `Pass the replacement title, or omit the field.`,
      );
    }
    validateTitle(title);
    if (title !== item.title) out.title = title;
  }
  if (changes.body !== undefined) {
    const body = normalizeEol(changes.body).trim();
    validateBody(body);
    if (body !== item.body) out.body = body;
  }
  if (changes.tags !== undefined) {
    validateTags(changes.tags);
    if (!sameValue(changes.tags, item.tags)) out.tags = [...changes.tags];
  }

  if (fieldsOf(out).length === 0) {
    throw new Error(
      `my_context: nothing to stage — the proposed ${fieldsOf(changes).join(', ') || 'change'} ` +
      `already matches ${item.id}. A revision that changes nothing would show a human an empty ` +
      `diff and would still be counted as a pending revision everywhere revisions are counted.`,
    );
  }
  return out;
}

/**
 * Reads the append-only log.
 *
 * Three outcomes, deliberately not two — this is the `loadStaging` correction
 * (lesson/derive.ts) applied before the defect it fixed can happen here:
 *
 *  - The file does not exist: `[]`. Nothing has ever been staged.
 *  - The file exists but cannot be READ (EACCES, a lock, an I/O error): THROW.
 *    "Could not read the log" is not "there are no revisions"; reporting the
 *    second would hide every pending proposal in the workspace and would let a
 *    later append write a log that disagrees with itself.
 *  - The file exists and a line is unparseable: THROW, unless it is the LAST
 *    line, which is skipped.
 *
 * The last-line exception is the one an append-only log exists to survive: a
 * process killed mid-`appendFileSync` leaves a partial fragment there and
 * nowhere else, and `appendToLog` heals it on the next write. A broken line
 * ANYWHERE ELSE cannot have come from that — it is corruption or a hand edit,
 * and skipping it is not safe here the way it is for the ingest applied-log:
 * the skipped line could be the `discard` that settled a revision, and
 * dropping it would put that revision back in the pending queue. That is
 * precisely the "a discarded candidate came back pending" failure this module
 * was told not to reproduce, so it refuses instead and names the line.
 */
export function readLog(root: string): LogLine[] {
  const file = revisionLogPath(root);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw new Error(
      `my_context: could not read the revision log at ${file} ` +
      `(${err instanceof Error ? err.message : String(err)}). This is NOT the same as "no ` +
      `revisions are pending" — reading it that way would hide every proposal in this ` +
      `workspace and let a later write append to a log it never saw. Investigate the ` +
      `underlying error before retrying.`,
    );
  }

  const rows = raw.split('\n');
  const lastIndex = lastRowIndex(rows);
  // A torn write is the ONLY thing that can leave bytes after the final
  // newline: `appendLine` writes one `<json>\n` string per record, so a
  // complete record always ends the file with a newline. A damaged line that
  // IS newline-terminated therefore did not come from a killed writer — it is
  // corruption or a hand edit, and it gets no tolerance below.
  const torn = !raw.endsWith('\n');

  const out: LogLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    if (line.trim() === '') continue;
    const isLast = i === lastIndex && torn;
    const refuse = (reason: string): Error => new Error(
      `my_context: the revision log at ${file} cannot be trusted — line ${i + 1} ${reason}. ` +
      `Refusing to read it, because a line this code skipped could be the record that a human ` +
      `already promoted or discarded a proposal, and dropping it would put that proposal back ` +
      `in the pending queue. Only a damaged FINAL line is tolerated (that is what a process ` +
      `killed mid-append leaves). Inspect the file: it is one JSON object per line, each with ` +
      `"op", "revisionId" and "itemId" fields.`,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      if (isLast) continue; // a crash-truncated tail — the one case this log exists to survive
      throw refuse(`is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      if (isLast) continue;
      throw refuse('is not a JSON object');
    }
    const row = parsed as Partial<LogLine>;
    if (row.protocol !== REVISION_PROTOCOL) {
      // Never tolerated, last line or not. An unrecognised protocol is version
      // skew, not a truncated write, and reading a future build's log as "no
      // revisions" is the same silent hiding the read failure above refuses.
      throw refuse(
        `declares protocol ${JSON.stringify(row.protocol)}, expected ` +
        `${JSON.stringify(REVISION_PROTOCOL)} (it may have been written by a different version)`,
      );
    }
    if (
      (row.op !== 'stage' && row.op !== 'promote' && row.op !== 'discard')
      || typeof row.revisionId !== 'string' || typeof row.itemId !== 'string'
      || typeof row.at !== 'string'
    ) {
      if (isLast) continue;
      throw refuse('is missing or mistypes one of "op", "revisionId", "itemId", "at"');
    }
    out.push(row as LogLine);
  }
  return out;
}

/**
 * Folds the log into one record per revision, in the order they were staged.
 *
 * **A settled revision is terminal.** Once a `promote` or `discard` line has
 * been seen for a revision, no later line can move it back to pending, and a
 * second settlement of an already-settled revision is ignored here (both
 * `promoteRevision` and `discardRevision` refuse it outright, under the lock,
 * before appending — this is the read side agreeing with them rather than a
 * second gate). Without this rule a re-staged, previously-discarded proposal
 * would come back pending and acceptable, which is the lesson-staging defect
 * this module was told not to reproduce.
 *
 * A `promote`/`discard` naming a revision with no `stage` line is ignored: the
 * proposal it settles is not in the log, so there is nothing to report about
 * it and inventing a record with empty `changes` would put a revision in the
 * queue that no agent ever proposed.
 */
function foldLog(lines: LogLine[]): RevisionRecord[] {
  const byId = new Map<string, RevisionRecord>();
  for (const line of lines) {
    if (line.op === 'stage') {
      if (byId.has(line.revisionId)) continue; // an exact re-stage; already recorded
      byId.set(line.revisionId, {
        revisionId: line.revisionId,
        itemId: line.itemId,
        changes: line.changes ?? {},
        base: line.base ?? {},
        origin: line.origin ?? 'agent',
        stagedAt: line.at,
        state: 'pending',
        settledAt: null,
        reason: null,
      });
      continue;
    }
    const record = byId.get(line.revisionId);
    if (!record) continue;
    if (record.state !== 'pending') continue; // terminal: the first settlement stands
    record.state = line.op === 'promote' ? 'promoted' : 'discarded';
    record.settledAt = line.at;
    record.reason = line.reason ?? null;
  }
  return [...byId.values()];
}

function lastRowIndex(rows: string[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].trim() !== '') return i;
  return -1;
}

/**
 * Drops a torn final line before the next append.
 *
 * `appendToLog` in ingest/session.ts heals the same damage by prefixing a
 * newline, which leaves the fragment in place as a line every later read has
 * to skip. That is safe there because `readAppliedLines` skips a bad line
 * anywhere. It is NOT safe here: `readLog` refuses a damaged line that is not
 * the final one (see its doc comment for why — the line it would otherwise
 * skip could be a `discard`), so newline-healing a fragment would wedge the
 * log permanently on the very write that recovers from the crash. Verified by
 * a test that kills a writer mid-append and then stages again.
 *
 * Only bytes AFTER the final newline are removed, and only when the file does
 * not end in one. `appendLine` writes one complete `<json>\n` per record, so
 * those bytes cannot be a whole record — they are the tail of a write that
 * never finished, and `readLog` already reads the file as if they were absent.
 * `truncateSync` makes the file agree with that reading; it never touches a
 * byte of any completed record, which is what keeps this append-only in the
 * sense that matters.
 */
function healTornTail(file: string): void {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return; // no log yet — nothing to heal; `appendFileSync` creates it
  }
  if (raw === '' || raw.endsWith('\n')) return;
  const cut = raw.lastIndexOf('\n');
  truncateSync(file, cut === -1 ? 0 : Buffer.byteLength(raw.slice(0, cut + 1), 'utf8'));
}

/** Appends one record as one line. One `appendFileSync` call, which does not
 * interleave with a concurrent process's append on either POSIX or Windows for
 * writes this small — the property that lets `stageRevision` run without the
 * settlement lock. */
function appendLine(root: string, line: LogLine): void {
  ensureRevisionDir(root);
  const file = revisionLogPath(root);
  healTornTail(file);
  appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
}

/** Decorates a pending record with everything that depends on the item as it
 * is NOW: the current values, which of this revision's fields moved underneath
 * it, and whether the item is still there at all. */
function decorate(ctx: MutationContext, record: RevisionRecord): PendingRevision {
  const item = ctx.store.get(record.itemId);
  const fields = fieldsOf(record.changes);
  if (!item) {
    return {
      ...record, state: 'pending', current: {}, changedSince: fields, stale: true, itemMissing: true,
    };
  }
  const current = valuesOf(item, fields);
  const changedSince = fields.filter((f) => !sameValue(record.base[f], current[f]));
  return {
    ...record,
    state: 'pending',
    current,
    changedSince,
    stale: changedSince.length > 0,
    itemMissing: false,
  };
}

/**
 * Every pending revision in the workspace, oldest first. Promoted and
 * discarded revisions are not here — see `revisionHistory` for those.
 */
export function pendingRevisions(ctx: MutationContext): PendingRevision[] {
  return foldLog(readLog(ctx.root))
    .filter((r) => r.state === 'pending')
    .map((r) => decorate(ctx, r));
}

/**
 * The head of one item's pending queue: its OLDEST pending revision, or null.
 *
 * Oldest, not newest, because an item may have more than one pending revision
 * (see `stageRevision`) and this is the one `review` presents first — a queue
 * is walked in the order things joined it. Every pending revision for an item
 * is `pendingRevisions(ctx).filter((r) => r.itemId === id)`, and
 * `promoteRevision`/`discardRevision` take a `revisionId` to reach any of them.
 */
export function revisionFor(ctx: MutationContext, itemId: string): PendingRevision | null {
  return pendingRevisions(ctx).find((r) => r.itemId === itemId) ?? null;
}

/**
 * Every revision ever recorded for an item, in the order they were staged,
 * whatever their state — including the discarded ones, with the full text
 * their author proposed.
 *
 * This is what makes `discardRevision`'s "the proposal is kept" claim true
 * rather than a hopeful sentence about an implementation detail: discarding
 * appends a line, it never removes the `stage` line, so the proposed text is
 * still on disk and there is a supported way to read it back.
 */
export function revisionHistory(ctx: MutationContext, itemId: string): RevisionRecord[] {
  return foldLog(readLog(ctx.root)).filter((r) => r.itemId === itemId);
}

/**
 * Re-reads one item from its Markdown file — the source of truth — into
 * `ctx.store`, and returns it.
 *
 * Called at the top of `promoteRevision`'s critical section, and the reason is
 * a hazard the lock alone does NOT close. A caller builds its `MutationContext`
 * (and therefore reads every item) BEFORE it calls in here, so by the time this
 * process wins the lock, another process may already have promoted a revision
 * and rewritten the item. Deciding from the row loaded earlier would then
 * (a) miss the staleness the other promotion just created, and (b) worse, hand
 * `updateItem` an object carrying the OTHER process's fields at their old
 * values, so persisting it would silently revert them. That is a lost update
 * with the lock working exactly as designed — serialization does not help when
 * the read happened outside it.
 *
 * Reproduced with two real processes before this existed; see
 * `test/core/revision-concurrency.test.ts`.
 *
 * Returns null when the file is gone, which `promoteRevision` reports as a
 * missing item rather than promoting onto nothing.
 */
function refreshFromDisk(ctx: MutationContext, item: Item): Item | null {
  const abs = path.join(ctx.root, item.filePath);
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw new Error(
      `my_context: could not re-read ${item.id} from ${abs} before promoting a revision ` +
      `(${err instanceof Error ? err.message : String(err)}). Refusing to promote from a copy ` +
      `that may be out of date — another process may have changed this item since it was loaded.`,
    );
  }
  const fresh = parseItem(text, item.filePath, item.layer);
  ctx.store.upsert(fresh);
  return fresh;
}

function requireProjectItem(ctx: MutationContext, itemId: string): Item {
  const item = ctx.store.get(itemId);
  if (!item) throw new Error(unknownIdError(itemId, ctx.store.all().map((i) => i.id)));
  if (item.layer !== 'project') {
    throw new Error(
      `my_context: "${itemId}" belongs to the global layer and cannot be modified from this ` +
      `project — global items are read-only here, so a revision against one could never be ` +
      `promoted. See mycontext_help("categories").`,
    );
  }
  return item;
}

/**
 * Records a proposed content change against `itemId` WITHOUT applying it. The
 * item is untouched: its file, its row and everything it governs stay exactly
 * as they were, and nothing in the selection path can see this revision.
 *
 * **A second revision while one is pending ACCUMULATES; it is not refused, and
 * it does not replace the first.** Spec §4 allows an item to carry more than
 * one, and the alternatives are both worse: refusing the second throws away a
 * proposal that may be the better one, and replacing the first silently
 * destroys a proposal a human has not seen. What makes accumulation safe is
 * that each revision records the `base` it was written against, so promoting
 * one does not silently apply on top of another — the others become stale and
 * say so. What makes it VISIBLE is `alsoPending` and the returned `message`,
 * both of which name how many proposals are already queued on this item, so
 * the caller that just staged the second one is told the first is still
 * waiting rather than discovering it later.
 *
 * An exact re-stage of a proposal that is already pending is idempotent: same
 * `revisionId`, no new line, `duplicate: true`. An exact re-stage of a
 * proposal that was already PROMOTED or DISCARDED is REFUSED, naming which and
 * when — silently re-staging it is how a discarded proposal comes back
 * pending, and telling the agent is the only outcome that does not either
 * ignore the human's decision or hide it.
 */
export function stageRevision(
  ctx: MutationContext, itemId: string, changes: RevisionChanges, origin: Origin,
): StageResult {
  const item = requireProjectItem(ctx, itemId);
  const normalized = normalizeChanges(item, changes);
  const base = valuesOf(item, fieldsOf(normalized));
  const revisionId = revisionIdFor(itemId, base, normalized);

  const settled = foldLog(readLog(ctx.root)).find((r) => r.revisionId === revisionId);
  if (settled && settled.state !== 'pending') {
    throw new Error(
      `my_context: this exact change to ${itemId} was already ${settled.state} on ` +
      `${settled.settledAt} (revision ${revisionId}), against the same text it is being ` +
      `proposed against now. It is not staged again: re-staging a settled proposal is how a ` +
      `human's decision gets quietly undone. Propose a different change, or raise it with the ` +
      `user.`,
    );
  }

  const alsoPending = pendingRevisions(ctx).filter(
    (r) => r.itemId === itemId && r.revisionId !== revisionId,
  );

  if (settled) {
    return {
      revision: settled,
      alsoPending,
      duplicate: true,
      message:
        `my_context: this change to ${itemId} was already staged as ${revisionId} and is still ` +
        `waiting for a human. Nothing was applied and nothing was added. ${item.id} keeps ` +
        `governing its current text.`,
    };
  }

  const at = new Date().toISOString();
  appendLine(ctx.root, {
    protocol: REVISION_PROTOCOL,
    op: 'stage',
    revisionId,
    itemId,
    at,
    changes: normalized,
    base,
    origin,
  });

  const record: RevisionRecord = {
    revisionId, itemId, changes: normalized, base, origin, stagedAt: at,
    state: 'pending', settledAt: null, reason: null,
  };

  const queued = alsoPending.length === 0
    ? ''
    : ` ${alsoPending.length} other proposal${alsoPending.length === 1 ? '' : 's'} ` +
      `(${alsoPending.map((r) => r.revisionId).join(', ')}) ${alsoPending.length === 1 ? 'is' : 'are'} ` +
      `already pending on this item and ${alsoPending.length === 1 ? 'has' : 'have'} not been reviewed.`;

  return {
    revision: record,
    alsoPending,
    duplicate: false,
    message:
      // How a human sees it, stated as it actually IS today: the proposal is
      // in the append-only log, and no command surfaces pending revisions yet
      // (plan Task 6 adds one to `mycontext review`). This sentence used to
      // name `mycontext review` directly, which was not true of any shipped
      // build — `review` walks the draft queue and knows nothing about
      // revisions — and became reachable by a real agent the moment
      // `updateItem` started routing edits here. Naming a command that does
      // not do what the sentence says is the class of claim this project
      // treats as a defect; Task 6 replaces this clause when the command is
      // real.
      `my_context: NOT applied — staged as revision ${revisionId} for review. ${itemId} is ` +
      `unchanged and keeps governing its current ${fieldsOf(normalized).join(', ')}, and will ` +
      `until a human promotes this proposal. It is recorded in ` +
      `${revisionLogPath(ctx.root)}; no command surfaces pending revisions yet, so tell the ` +
      `user about it rather than assuming they will find it. Do not reason as if the new text ` +
      `is in force.${queued}`,
  };
}

function selectPending(
  ctx: MutationContext, itemId: string, revisionId: string | undefined, verb: string,
): PendingRevision {
  const forItem = pendingRevisions(ctx).filter((r) => r.itemId === itemId);
  if (forItem.length === 0) {
    const settled = revisionHistory(ctx, itemId);
    throw new Error(
      `my_context: no revision is pending for ${itemId}.` +
      (settled.length === 0
        ? ' Nothing has ever been staged against it.'
        : ` ${settled.length} revision(s) were staged and are all settled: ` +
          `${settled.map((r) => `${r.revisionId} (${r.state})`).join(', ')}.`),
    );
  }
  if (revisionId === undefined) return forItem[0];
  const found = forItem.find((r) => r.revisionId === revisionId);
  if (!found) {
    throw new Error(
      `my_context: ${itemId} has no pending revision "${revisionId}". Pending: ` +
      `${forItem.map((r) => r.revisionId).join(', ')}. Pass one of those to ${verb}, or omit ` +
      `it to take the oldest.`,
    );
  }
  return found;
}

/**
 * Applies a pending revision to its item and records the promotion. This is a
 * HUMAN act: the change is applied through `updateItem` with `origin: 'human'`,
 * so it goes through every validation, guard and checksum-stamping path a
 * human edit does, and the item's file stays byte-round-trippable.
 *
 * **A stale revision is REFUSED.** Stale means a human changed one of the very
 * fields this proposal rewrites after it was staged. Promoting it anyway would
 * overwrite that human's edit with an agent's text written against a version of
 * the item that no longer exists — spec §4's named wrong outcome. The refusal
 * says which fields moved, and names `force` as the deliberate override. It is
 * scoped to the revision's OWN fields: a human who changed the item's scope has
 * not touched a body proposal, and calling that stale would push people toward
 * `force` for changes that do not conflict, which would make `force` routine.
 *
 * `force` does not hide anything. The intervening text is still in the log's
 * `base`/`current` and in the returned message, and the caller wiring this to a
 * command is expected to show the human what they are overwriting first.
 *
 * Held under the workspace revision lock for the whole read-decide-write
 * section — see `acquireRevisionLock` for the race it closes.
 */
export function promoteRevision(
  ctx: MutationContext, itemId: string, options: PromoteOptions = {},
): PromoteResult {
  const release = acquireRevisionLock(ctx.root);
  try {
    // FIRST, before anything reads an item: the caller's store may predate
    // another process's promotion. See `refreshFromDisk`.
    const loaded = ctx.store.get(itemId);
    const onDisk = loaded === null ? null : refreshFromDisk(ctx, loaded);

    const pending = selectPending(ctx, itemId, options.revisionId, 'promote');
    // Read BEFORE the write, so `invalidated` below can name the revisions
    // THIS promotion made stale rather than every revision that is stale
    // afterwards — some of which were already stale when it started, and
    // saying this promotion caused those would be untrue.
    const freshBefore = new Set(
      pendingRevisions(ctx)
        .filter((r) => r.itemId === itemId && !r.stale)
        .map((r) => r.revisionId),
    );

    // `loaded !== null && onDisk === null` is the same conclusion reached from
    // the other side: the index still has a row, but the Markdown file it names
    // is gone. Markdown is the source of truth, so that is a missing item, not
    // a promotable one.
    if (pending.itemMissing || (loaded !== null && onDisk === null)) {
      throw new Error(
        `my_context: revision ${pending.revisionId} names ${itemId}, which is no longer in the ` +
        `index or on disk. Refusing to promote a change to an item that cannot be found. Run ` +
        `\`mycontext rebuild\` if the index is stale, or discard the revision — its proposed ` +
        `text is kept in ${revisionLogPath(ctx.root)} either way.`,
      );
    }

    if (pending.stale && options.force !== true) {
      const moved = pending.changedSince
        .map((f) => `${f} (staged against ${JSON.stringify(pending.base[f])}, now ` +
          `${JSON.stringify(pending.current[f])})`)
        .join('; ');
      throw new Error(
        `my_context: revision ${pending.revisionId} is STALE and was not promoted. It was staged ` +
        `on ${pending.stagedAt} against text a human has changed since, in the very field(s) it ` +
        `rewrites: ${moved}. Promoting it would overwrite that change with text written against ` +
        `a version of ${itemId} that no longer exists. ${itemId} is unchanged. Either discard ` +
        `this revision, or promote it deliberately knowing it overwrites the newer text.`,
      );
    }

    const update = updateItem(ctx, {
      id: itemId,
      ...(pending.changes.title === undefined ? {} : { title: pending.changes.title }),
      ...(pending.changes.body === undefined ? {} : { body: pending.changes.body }),
      ...(pending.changes.tags === undefined ? {} : { tags: pending.changes.tags }),
      origin: 'human',
    });

    const at = new Date().toISOString();
    appendLine(ctx.root, {
      protocol: REVISION_PROTOCOL, op: 'promote', revisionId: pending.revisionId, itemId, at,
    });

    const record: RevisionRecord = {
      ...pending, state: 'promoted', settledAt: at,
    };

    // Recomputed AFTER the item was written, so `stale` reflects the text this
    // promotion just put in force rather than the text it replaced, and
    // narrowed to the revisions that were fresh before it ran.
    const invalidated = pendingRevisions(ctx).filter(
      (r) => r.itemId === itemId && r.stale && freshBefore.has(r.revisionId),
    );

    const alsoNote = invalidated.length === 0
      ? ''
      : ` ${invalidated.length} other pending revision(s) on this item ` +
        `(${invalidated.map((r) => r.revisionId).join(', ')}) ${invalidated.length === 1 ? 'is' : 'are'} ` +
        `now stale, because this promotion changed the text they were written against. ` +
        `They were not applied and were not discarded.`;

    const forced = pending.stale
      ? ` It was stale and was promoted with force: the newer text in ` +
        `${pending.changedSince.join(', ')} was overwritten.`
      : '';

    return {
      revision: record,
      update,
      invalidated,
      message:
        `my_context: promoted revision ${pending.revisionId} — ${itemId} now governs the ` +
        `proposed ${fieldsOf(pending.changes).join(', ')}.${forced}${alsoNote}`,
    };
  } finally {
    release();
  }
}

/**
 * Records that a pending revision will not be applied. The item is untouched.
 *
 * **The proposal is not destroyed and the message says so truthfully.** The log
 * is append-only: discarding appends a `discard` line and never rewrites or
 * removes the `stage` line, so the full text the agent proposed stays on disk
 * and `revisionHistory(ctx, itemId)` reads it back at any time. What a discard
 * DOES do is final in one specific way — the same proposal against the same
 * text cannot be re-staged (see `stageRevision`), because that is how a human's
 * "no" gets quietly reversed. Recovering the text means reading it and acting
 * on it, not un-discarding the revision, and the message says exactly that
 * rather than implying an undo command that does not exist.
 */
export function discardRevision(
  ctx: MutationContext, itemId: string, options: DiscardOptions = {},
): DiscardResult {
  const release = acquireRevisionLock(ctx.root);
  try {
    const pending = selectPending(ctx, itemId, options.revisionId, 'discard');
    const at = new Date().toISOString();
    appendLine(ctx.root, {
      protocol: REVISION_PROTOCOL,
      op: 'discard',
      revisionId: pending.revisionId,
      itemId,
      at,
      ...(options.reason === undefined ? {} : { reason: options.reason }),
    });

    const logPath = revisionLogPath(ctx.root);
    return {
      revision: { ...pending, state: 'discarded', settledAt: at, reason: options.reason ?? null },
      logPath,
      message:
        `my_context: discarded revision ${pending.revisionId}. ${itemId} is unchanged and keeps ` +
        `governing its current text. The proposal itself is NOT deleted — its full proposed ` +
        `${fieldsOf(pending.changes).join(', ')} stays in the append-only log at ${logPath} and ` +
        `is readable through the revision history for ${itemId}. It cannot be staged again ` +
        `against this same text; a different proposal, or the same one after the item changes, ` +
        `can be.`,
    };
  } finally {
    release();
  }
}
