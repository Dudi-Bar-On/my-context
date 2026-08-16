import { readFileSync } from 'node:fs';
import path from 'node:path';
import { auditFailureNote, recordAudit } from './audit.ts';
import { parseItem } from './item.ts';
import { appendJsonlLine, ensureLogDir, readJsonlFile, type JsonlRow } from './jsonl-log.ts';
import { acquireLock } from './lock.ts';
import { updateItem, type MutationContext, type MutationResult } from './mutate.ts';
import type { Store } from './store.ts';
import { tierOf } from './trust.ts';
import { validateBody, validateExtra, validateTags, validateTitle } from './validate.ts';
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
//
// **The mechanics moved to `core/jsonl-log.ts` in Phase 5** — the three read
// outcomes, the torn-tail rule and the truncating heal — because the audit log
// needs exactly them and a second hand-written copy is how two logs that are
// supposed to behave identically stop doing so. The behaviour is unchanged and
// every refusal below is still worded here, where the reason for it lives:
// what a skipped line would cost is a fact about a revision queue, not about
// JSONL.

export const REVISION_PROTOCOL = 'my_context/revision@1';

/**
 * "keeps governing" or "keeps", by the item's tier.
 *
 * Found by dogfooding, which is the only way it could have been: every test
 * for this store uses a normative category, where "keeps governing its current
 * body" is exactly right. Setting `agentEdits: "review"` on `lesson` in this
 * repository's own corpus and staging one edit produced four messages telling
 * the reader that a rationale item "keeps governing" and then "now governs" —
 * and a `lesson` governs nothing, ever, by the definition this project's own
 * glossary gives the word: eligible for injection AND phrased as an
 * instruction. `select` admits only the normative tier.
 *
 * The word is not dropped for the normative tier, because that is where it
 * carries the whole weight of the sentence: an agent reading "keeps governing
 * its current body" about a `rule` is being told precisely what is at stake.
 * A tier-neutral wording would have cost that to fix a sentence about
 * `lesson`.
 */
function keepsPhrase(ctx: MutationContext, item: Item): string {
  return tierOf(ctx, item) === 'normative' ? 'keeps governing' : 'keeps';
}

/**
 * The fields a revision may carry: the item's CONTENT, as spec §4 defines it,
 * minus the one content field no write surface can currently change.
 *
 * **`extra` is here, and its absence was a security hole.** It holds the
 * category-specific fields — `rule.directive` among them, which is what decides
 * whether a rule prohibits or prescribes — so it is content in the plainest
 * sense: it changes what the agent is told. While it was absent from this list,
 * `contentChange` (trust.ts) had nothing to stage for it and `guardedChange`
 * does not cover it, so an agent holding only the MCP tools could invert a
 * governing rule's directive and have it apply immediately, with the item
 * staying `active`, `hard` and unchanged in every report. The list a revision
 * happens to carry must never be what decides the policy: see
 * `UPDATE_FIELD_POLICY` in trust.ts, which classifies every writable field and
 * fails to COMPILE if one is added without a class, and the two type assertions
 * beside it that pin this list to exactly the fields it classifies as content.
 *
 * Spec §4 names "title, body, observations and tags". `observations` is absent
 * here because `UpdateInput` (mutate.ts) has no `observations` field and no
 * command or MCP tool edits an existing item's observations — observations are
 * only ever set at capture. Carrying a field this module could stage but
 * nothing could ever produce, and no promote could apply through `updateItem`,
 * would be a claim of coverage that does not exist. That is a real gap and not
 * the same kind as `extra` was: nothing can change observations at all, by any
 * caller of any origin, so there is nothing for a gate to be routed around. If
 * an observation-editing surface is added, it belongs here, in
 * `UPDATE_FIELD_POLICY`, and in `promoteRevision`'s apply, together.
 *
 * `scope`, `always`, `severity` and `status` are NOT here and must never be:
 * they stay human-only on a governing normative item regardless of
 * `agentEdits` (spec §4), and a revision that could carry them would be a
 * route around that gate rather than a proposal about content.
 */
export const REVISION_FIELDS = ['title', 'body', 'tags', 'extra'] as const;

export type RevisionField = (typeof REVISION_FIELDS)[number];

/** What one field of a proposal holds: prose, an unordered set of strings, or
 * the `extra` map. Named because three modules render and compare these values
 * and each needs the same union. */
export type RevisionValue = string | string[] | Record<string, string>;

export interface RevisionChanges {
  title?: string;
  body?: string;
  tags?: string[];
  /**
   * The `extra` keys this proposal MOVES, and only those. `updateItem` merges
   * `extra` rather than replacing it, so a proposal that carried the item's
   * whole map would show a human a diff full of keys nobody proposed changing,
   * and would go stale on an edit to a key it never touched.
   */
  extra?: Record<string, string>;
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
  /**
   * Which revision. May be omitted only when the item has exactly ONE pending
   * revision; with more than one, omitting it is refused rather than defaulted
   * — see `pickPendingRevision` for why "the oldest" was the wrong default.
   */
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
  /** Same contract as `PromoteOptions.revisionId`: required when more than
   * one revision is pending — a discard is terminal for the exact proposal it
   * names (`stageRevision` refuses to re-stage it), so guessing which one is
   * as much a wrong settlement as promoting the wrong one. */
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
  return ensureLogDir(revisionDir(root));
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

/**
 * One field's value in a form where equal values have equal JSON, whatever
 * order their parts were written in.
 *
 * `tags` is an unordered set (`hashContent` in mutate.ts sorts it for the same
 * reason) and `extra` is a map whose key order carries no meaning
 * (`canonicalExtra` in mutate.ts sorts it before hashing), so a reordering of
 * either must not read as a change here, in `revisionIdFor`, or in the
 * staleness comparison. Title and body compare exactly.
 */
function canonicalValue(value: RevisionValue): unknown {
  if (Array.isArray(value)) return [...value].sort();
  if (typeof value === 'object') {
    return Object.keys(value).sort().map((key) => [key, value[key]]);
  }
  return value;
}

/** Fixed field order, so a value built here and the same value read back out of
 * JSON hash identically. */
function canonical(changes: RevisionChanges): unknown[] {
  return REVISION_FIELDS.map((field) => {
    const value = changes[field];
    return value === undefined ? null : canonicalValue(value);
  });
}

/** Equality under `canonicalValue`. A string, an array and a map can never
 * compare equal to each other, because their canonical forms differ in shape as
 * well as in content. */
function sameValue(a: RevisionValue | undefined, b: RevisionValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return JSON.stringify(canonicalValue(a)) === JSON.stringify(canonicalValue(b));
}

/**
 * The item's current values for exactly the fields `changes` carries.
 *
 * Keyed off the proposal rather than off a field list, because `extra` needs
 * more than the field name to answer the question: the base is the item's
 * values for the KEYS this proposal moves and no others, which is what keeps
 * staleness per-key rather than per-map. A key the item does not have yet is
 * absent from the base, so a human who adds it afterwards makes the proposal
 * stale — which is right, since the proposal was written against its absence.
 */
function valuesOf(item: Item, changes: RevisionChanges): RevisionChanges {
  const out: RevisionChanges = {};
  if (changes.title !== undefined) out.title = item.title;
  if (changes.body !== undefined) out.body = item.body;
  if (changes.tags !== undefined) out.tags = [...item.tags];
  if (changes.extra !== undefined) {
    const base: Record<string, string> = {};
    for (const key of Object.keys(changes.extra)) {
      if (Object.hasOwn(item.extra, key)) base[key] = item.extra[key];
    }
    out.extra = base;
  }
  return out;
}

/**
 * The fields a revision actually touches, in `REVISION_FIELDS`' stable order.
 *
 * Exported (B7.3): `changedFields` in `src/cli/commands/revision-view.ts` was
 * a byte-for-byte copy of this function — two renderers of the same object
 * each carrying their own "which fields does this revision touch". One copy,
 * one order, and a field added to `REVISION_FIELDS` cannot appear in one
 * renderer and silently not the other.
 */
export function changedFields(changes: RevisionChanges): RevisionField[] {
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
  if (changes.extra !== undefined) {
    validateExtra(changes.extra);
    // Narrowed to the keys that actually MOVE, for the reason `RevisionChanges`
    // records: `updateItem` merges `extra`, so an echoed key is not a proposal
    // about anything and carrying it would put it in the diff a human reads and
    // in the staleness comparison. `Object.hasOwn` because a key absent from
    // the item must read as "not set" rather than reaching up the prototype
    // chain — `validateExtra` refuses `__proto__` outright, and this closes the
    // rest of that class rather than relying on the name.
    const moved: Record<string, string> = {};
    for (const key of Object.keys(changes.extra)) {
      const before = Object.hasOwn(item.extra, key) ? item.extra[key] : undefined;
      if (changes.extra[key] !== before) moved[key] = changes.extra[key];
    }
    if (Object.keys(moved).length > 0) out.extra = moved;
  }

  if (changedFields(out).length === 0) {
    throw new Error(
      `my_context: nothing to stage — the proposed ${changedFields(changes).join(', ') || 'change'} ` +
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
  return readJsonlFile({
    file,
    protocol: REVISION_PROTOCOL,
    validate: (row: JsonlRow) => (
      (row.op !== 'stage' && row.op !== 'promote' && row.op !== 'discard')
      || typeof row.revisionId !== 'string' || typeof row.itemId !== 'string'
      || typeof row.at !== 'string'
        ? 'is missing or mistypes one of "op", "revisionId", "itemId", "at"'
        : null
    ),
    refuse: (line, reason) => new Error(
      `my_context: the revision log at ${file} cannot be trusted — line ${line} ${reason}. ` +
      `Refusing to read it, because a line this code skipped could be the record that a human ` +
      `already promoted or discarded a proposal, and dropping it would put that proposal back ` +
      `in the pending queue. Only a damaged FINAL line is tolerated (that is what a process ` +
      `killed mid-append leaves). Inspect the file: it is one JSON object per line, each with ` +
      `"op", "revisionId" and "itemId" fields.`,
    ),
    unreadable: (err) => new Error(
      `my_context: could not read the revision log at ${file} ` +
      `(${err instanceof Error ? err.message : String(err)}). This is NOT the same as "no ` +
      `revisions are pending" — reading it that way would hide every proposal in this ` +
      `workspace and let a later write append to a log it never saw. Investigate the ` +
      `underlying error before retrying.`,
    ),
  }) as unknown as LogLine[];
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

/** Appends one record as one line. One `appendFileSync` call, which does not
 * interleave with a concurrent process's append on either POSIX or Windows for
 * writes this small — the property that lets `stageRevision` run without the
 * settlement lock. The torn-tail heal and the `.gitignore` are
 * `core/jsonl-log.ts`'s; see the note at the top of this file. */
function appendLine(root: string, line: LogLine): void {
  appendJsonlLine(revisionDir(root), revisionLogPath(root), line);
}

/**
 * `pendingRevisions`' context: a `MutationContext`, or — on the injection
 * path, where the corpus is already in hand and the database is deliberately
 * off the critical path (design §4.3) — the same shape with `store: null` and
 * the parsed `items` supplied instead. The lookup is the only thing the store
 * was used for here, so the two are equivalent by construction; an item found
 * in neither decorates as missing, exactly as a store miss always has.
 */
export type RevisionViewContext = Omit<MutationContext, 'store'> & {
  store: Store | null;
  items?: Item[];
};

function itemNow(ctx: RevisionViewContext, id: string): Item | null {
  if (ctx.store !== null) return ctx.store.get(id);
  return ctx.items?.find((i) => i.id === id) ?? null;
}

/** Decorates a pending record with everything that depends on the item as it
 * is NOW: the current values, which of this revision's fields moved underneath
 * it, and whether the item is still there at all. */
function decorate(ctx: RevisionViewContext, record: RevisionRecord): PendingRevision {
  const item = itemNow(ctx, record.itemId);
  const fields = changedFields(record.changes);
  if (!item) {
    return {
      ...record, state: 'pending', current: {}, changedSince: fields, stale: true, itemMissing: true,
    };
  }
  const current = valuesOf(item, record.changes);
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
export function pendingRevisions(ctx: RevisionViewContext): PendingRevision[] {
  return foldLog(readLog(ctx.root))
    .filter((r) => r.state === 'pending')
    .map((r) => decorate(ctx, r));
}

/**
 * **The count spelling, chosen once for every surface that reports this queue.**
 *
 * The number is PENDING REVISIONS, not items carrying one, and the two are
 * genuinely different: an item accumulates revisions (`stageRevision` lets a
 * second proposal queue behind the first rather than refusing or replacing it),
 * so three proposals on two items is three, not two. Revisions is the right
 * unit because a revision is the unit of decision — each one is promoted or
 * discarded on its own, and counting items would tell a human "2 waiting" for a
 * queue with three approvals left in it.
 *
 * The item count is reported too, in the same breath, because a reader who is
 * given only one number cannot tell which it is. What must never happen is two
 * surfaces reporting DIFFERENT numbers for the same queue — `status` and
 * `review` disagreeing about a queue length is a defect that shipped five times
 * in one plan — so both numbers come from here, in this sentence, and every
 * surface prints this sentence rather than a wording of its own.
 *
 * It lives in this module, not in `cli/commands/review.ts` where it was first
 * written, because the queue is now reported to AGENTS as well: `get_item`,
 * `query_items`, `list_drafts` and the session injection all say it, and none
 * of them may import a CLI command to find out how to count.
 */
export function pendingRevisionCounts(
  revs: PendingRevision[],
): { revisions: number; items: number } {
  return { revisions: revs.length, items: new Set(revs.map((r) => r.itemId)).size };
}

/**
 * The sentence every HUMAN text surface prints about this queue, and the one
 * place its numbers are spelled. `mycontext review` and `mycontext status`
 * print exactly this.
 *
 * The EMPTY queue is handled here rather than at the one call site that reports
 * it, and that is not tidying. `mycontext review revisions` used to spell
 * "0 pending revision(s) on 0 item(s)" itself, which made this function's own
 * contract two lines up — "every surface prints this sentence rather than a
 * wording of its own" — false about the count template it exists to own. The
 * other two callers suppress the line entirely when the queue is empty, so this
 * branch has exactly one reader; it is here so that there is nowhere else the
 * shape of this sentence is typed.
 *
 * The empty case cannot share the rest of the wording: "Read them as diffs"
 * addresses a reader who has something to read.
 */
export function pendingRevisionLine(revs: PendingRevision[]): string {
  const { revisions, items } = pendingRevisionCounts(revs);
  const stale = revs.filter((r) => r.stale).length;
  if (revisions === 0) {
    return `${revisions} pending revision(s) on ${items} item(s) — nothing is waiting for a human here.`;
  }
  return (
    // "keep their current text", NOT "keep governing": this line aggregates
    // every pending revision in the workspace, and under a user's own
    // `agentEdits: "review"` on a rationale category some of those items
    // govern nothing. One sentence covering both tiers cannot branch, so it
    // says the thing that is true of both — that nothing was applied. The
    // per-item messages, which know their tier, still say "governing" where
    // it is earned.
    `${revisions} pending revision(s) on ${items} item(s) — proposed by an agent and NOT applied; ` +
    'the items keep their current text. Read them as diffs with ' +
    '`mycontext review revisions`.' +
    (stale === 0
      ? ''
      : ` ${stale} of them ${stale === 1 ? 'is' : 'are'} STALE: a human has changed the very text ` +
        `${stale === 1 ? 'it proposes' : 'they propose'} to rewrite.`)
  );
}

/**
 * The same queue, addressed to an AGENT rather than to the human who settles
 * it — the sentence `get_item`, `query_items`, `list_drafts` and the session
 * injection share.
 *
 * It is a second wording of the same FACT and that is deliberate, unlike the
 * drift this project keeps producing: `pendingRevisionLine` ends by telling
 * the reader to run `mycontext review revisions`, and a model cannot run it —
 * every write tool on the MCP surface hardcodes a non-human origin, and
 * promoting is a human act by construction. Handing an agent an instruction it
 * cannot follow is how a model ends up asserting it did. The NUMBERS still come
 * from `pendingRevisionCounts`, so the two sentences can never disagree about
 * the queue; only the closing clause differs, and it differs because the reader
 * differs.
 *
 * The two things an agent actually needs are both here, and neither was
 * discoverable before: that its own staged change is still waiting (so it does
 * not propose it again), and that the text it is looking at is the text in
 * force (so it does not reason as if the proposal had landed).
 */
export function agentRevisionNotice(revs: PendingRevision[]): string {
  if (revs.length === 0) return '';
  const { revisions, items } = pendingRevisionCounts(revs);
  return (
    `my_context: ${revisions} pending revision(s) on ${items} item(s) in this workspace, ` +
    `staged and NOT applied — ${revs.map((r) => `${r.revisionId} → ${r.itemId}`).join(', ')}. ` +
    'Every item here carries the text it had before the proposal; that is the text in force. ' +
    'Only a human can settle them, and you cannot: do not propose the same change again, ' +
    'and do not reason as if the proposed text applies. Tell the user they are waiting.'
  );
}

/**
 * What ONE item's pending revisions amount to, for a surface that is showing
 * that item in full (`get_item`). Named fields rather than a count alone: an
 * agent that proposed a body change and is now reading the title needs to know
 * which of the two it is looking at a proposal for.
 */
export function itemRevisionNotice(itemId: string, revs: PendingRevision[]): string {
  const mine = revs.filter((r) => r.itemId === itemId);
  if (mine.length === 0) return '';
  const one = mine.length === 1;
  const fields = [...new Set(mine.flatMap((r) => Object.keys(r.changes)))].sort();
  return (
    `my_context: ${mine.length} pending revision(s) on ${itemId} ` +
    `(${mine.map((r) => r.revisionId).join(', ')}), proposing new ${fields.join(', ')}. ` +
    `${one ? 'It has' : 'They have'} NOT been applied: everything above is the text ${itemId} ` +
    `actually has. A human promotes or discards ${one ? 'it' : 'them'}; no tool on this ` +
    'surface can. Do not stage the same change again, and do not answer as if the proposed ' +
    'text were in force.'
  );
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
  const base = valuesOf(item, normalized);
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
      // How a human sees it, and the command named here must actually do what
      // this sentence says. It has been wrong once already: it named
      // `mycontext review` while `review` only walked the draft queue and knew
      // nothing about revisions, which was harmless while this store was
      // library-only and false to a real agent the moment `updateItem` started
      // routing edits here. It then said plainly that NO command surfaced
      // revisions — true until `review revisions` shipped, and replaced in the
      // same commit that shipped it. `mycontext review revisions` lists every
      // pending revision as a diff against the current text; `mycontext status`
      // counts them. Both are pinned by tests that run the real commands.
      `my_context: NOT applied — staged as revision ${revisionId} for review. ${itemId} is ` +
      `unchanged and ${keepsPhrase(ctx, item)} its current ${changedFields(normalized).join(', ')}, ` +
      `and will until a human promotes this proposal. A human sees it with ` +
      `\`mycontext review revisions\` (it is counted by \`mycontext status\` too), and it is ` +
      `recorded in ${revisionLogPath(ctx.root)}. Tell the user you staged it rather than ` +
      `assuming they will look. Do not reason as if the new text is in force.${queued}`,
  };
}

/**
 * The one pending revision a `promote` or `discard` is about, or a refusal
 * naming what is actually pending.
 *
 * Exported for the CLI, which needs the SAME selection this module's own
 * settlement functions perform — it has to know which revision it is about to
 * act on in order to show a human the diff before asking them to confirm it,
 * and a second copy of this rule is a second rule that can disagree about
 * which proposal was approved.
 *
 * **With more than one pending and no `revisionId`, it REFUSES rather than
 * defaults.** The default used to be "the oldest", and settlement is a write
 * on the trust boundary: a human reads a diff in `review revisions`, types
 * `review promote-revision <id> --yes`, and — if a second proposal was staged
 * first — promotes a different change than the one they reviewed, which
 * `promoteRevision` then stamps `origin: 'human'`. The wrong proposal
 * laundered into a human-approved change, and nothing says so. An id alone is
 * simply not enough information to name one of several proposals, so the gap
 * is refused, naming what is pending. One pending revision stays addressable
 * by item id alone: there is nothing to disagree about, and the diff every
 * surface shows IS the change that lands.
 */
export function pickPendingRevision(
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
  if (revisionId === undefined) {
    if (forItem.length > 1) {
      throw new Error(
        `my_context: ${itemId} has ${forItem.length} pending revisions ` +
        `(${forItem.map((r) => r.revisionId).join(', ')}) and no --revision names which one ` +
        `to ${verb}. Refusing to pick one — settling a proposal the human was not shown ` +
        `would ${verb} a change nobody reviewed, under a confirmation given for a different ` +
        `one. Read them with \`mycontext review revisions ${itemId} --full\`, then pass ` +
        `--revision with the one you mean.`,
      );
    }
    return forItem[0];
  }
  const found = forItem.find((r) => r.revisionId === revisionId);
  if (!found) {
    throw new Error(
      `my_context: ${itemId} has no pending revision "${revisionId}". Pending: ` +
      `${forItem.map((r) => r.revisionId).join(', ')}. Pass one of those to ${verb}; ` +
      `--revision may be omitted only when exactly one revision is pending.`,
    );
  }
  return found;
}

/**
 * Why a stale revision was not promoted, in the one wording every surface
 * uses.
 *
 * Exported because the CLI must refuse BEFORE it prints a preview or asks for
 * a confirmation — a human shown what a promotion will do, asked to approve
 * it, and only then told it was never going to land is the ordering defect
 * `review promote` was already fixed for. That refusal and this function's
 * caller below are the same refusal for the same reason, so they are the same
 * sentence; the CLI adds only how to override it, which is a fact about the
 * command and not about the store.
 */
/**
 * Why a revision whose item cannot be found was not promoted. Exported for the
 * same reason as `staleRefusal`: the CLI refuses before it previews, and one
 * refusal wants one wording.
 */
export function missingItemRefusal(
  ctx: MutationContext, itemId: string, pending: PendingRevision,
): string {
  return (
    `my_context: revision ${pending.revisionId} names ${itemId}, which is no longer in the ` +
    `index or on disk. Refusing to promote a change to an item that cannot be found. Run ` +
    `\`mycontext rebuild\` if the index is stale, or discard the revision — its proposed ` +
    `text is kept in ${revisionLogPath(ctx.root)} either way.`
  );
}

export function staleRefusal(itemId: string, pending: PendingRevision): string {
  const moved = pending.changedSince
    .map((f) => `${f} (staged against ${JSON.stringify(pending.base[f])}, now ` +
      `${JSON.stringify(pending.current[f])})`)
    .join('; ');
  return (
    `my_context: revision ${pending.revisionId} is STALE and was not promoted. It was staged ` +
    `on ${pending.stagedAt} against text a human has changed since, in the very field(s) it ` +
    `rewrites: ${moved}. Promoting it would overwrite that change with text written against ` +
    `a version of ${itemId} that no longer exists. ${itemId} is unchanged. Either discard ` +
    `this revision, or promote it deliberately knowing it overwrites the newer text.`
  );
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

    const pending = pickPendingRevision(ctx, itemId, options.revisionId, 'promote');
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
      throw new Error(missingItemRefusal(ctx, itemId, pending));
    }

    if (pending.stale && options.force !== true) throw new Error(staleRefusal(itemId, pending));

    // `auditOp: 'promote'` rather than the default `'update'`: promoting is the
    // act, and the audit log records acts. Recording it as a plain `update`
    // would make a human's approval of an agent's proposal indistinguishable
    // in the log from a human typing the same text themselves, which is the
    // one distinction this whole review boundary exists to draw. It also means
    // ONE record, not two — the promotion is not separately audited below.
    const update = updateItem(ctx, {
      id: itemId,
      ...(pending.changes.title === undefined ? {} : { title: pending.changes.title }),
      ...(pending.changes.body === undefined ? {} : { body: pending.changes.body }),
      ...(pending.changes.tags === undefined ? {} : { tags: pending.changes.tags }),
      ...(pending.changes.extra === undefined ? {} : { extra: pending.changes.extra }),
      origin: 'human',
    }, 'promote');

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
        // "governs" only where it is true. `onDisk` is non-null here — the
        // refusal above threw otherwise — and the `??` fails closed to the
        // stronger word for the same reason `tierOf` fails closed to
        // `normative`, rather than asserting non-null.
        `my_context: promoted revision ${pending.revisionId} — ${itemId} ` +
        `${onDisk === null || tierOf(ctx, onDisk) === 'normative' ? 'now governs' : 'now carries'}` +
        ` the proposed ${changedFields(pending.changes).join(', ')}.${forced}${alsoNote}`,
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
    const pending = pickPendingRevision(ctx, itemId, options.revisionId, 'discard');
    const at = new Date().toISOString();
    appendLine(ctx.root, {
      protocol: REVISION_PROTOCOL,
      op: 'discard',
      revisionId: pending.revisionId,
      itemId,
      at,
      ...(options.reason === undefined ? {} : { reason: options.reason }),
    });

    // A discard writes no item and so passes through no `persist`, which is
    // why it records here rather than in mutate.ts. It is a human decision
    // about a governing item and belongs in the audit log for exactly that
    // reason: "nobody approved this" is as much a fact about the corpus as an
    // approval is. The discarded TEXT is not copied here — it stays in the
    // revision log, which is its store.
    const audited = auditFailureNote(recordAudit(ctx.root, {
      kind: 'mutation',
      op: 'discard',
      origin: 'human',
      itemId,
      fields: changedFields(pending.changes),
      note: options.reason === undefined
        ? pending.revisionId
        : `${pending.revisionId}: ${options.reason}`,
    }));

    const logPath = revisionLogPath(ctx.root);
    return {
      revision: { ...pending, state: 'discarded', settledAt: at, reason: options.reason ?? null },
      logPath,
      message:
        `my_context: discarded revision ${pending.revisionId}. ${itemId} is unchanged and keeps ` +
        `governing its current text. The proposal itself is NOT deleted — its full proposed ` +
        `${changedFields(pending.changes).join(', ')} stays in the append-only log at ${logPath} and ` +
        // Names a command that prints the discarded proposal's own text, not
        // merely the fact that it existed: `mycontext review revisions <id>`
        // lists every settled revision for an item and `--full` renders what
        // each one proposed, in full. Before that command existed this
        // sentence said "readable through the revision history", which named a
        // library function a user has no way to call.
        `is read back with \`mycontext review revisions ${itemId} --full\`. It cannot be staged ` +
        `again against this same text; a different proposal, or the same one after the item ` +
        `changes, ` +
        `can be.${audited}`,
    };
  } finally {
    release();
  }
}
