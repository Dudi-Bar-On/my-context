import path from 'node:path';
import { readJsonlFile, type JsonlRow } from './jsonl-log.ts';
import type { Item, Origin } from './types.ts';

/**
 * Read-only access to the staged-revision log — extracted from revision.ts
 * (web-ui plan 1, Task 6) so that a read-only surface can count and list
 * pending revisions WITHOUT importing revision.ts, which imports updateItem
 * from mutate.ts at runtime. The UI server's no-writes test bans mutate.ts and
 * revision.ts from its import graph; this module is what makes that ban
 * compatible with reporting the queue.
 *
 * Everything here was moved from revision.ts, which re-imports these symbols
 * so its callers are untouched. Every body is verbatim and every behaviour is
 * the one it had there, with exactly two exceptions, both named where they
 * are: `pendingRevisionCounts`'s widened parameter type, below, and
 * `decoratePending`'s refusal to decorate a settled record, which is a check
 * that had no reachable caller until the move made one.
 *
 * The one signature that moved is `pendingRevisionCounts`, WIDENED from
 * `PendingRevision[]` to the two fields it actually reads, so that the
 * undecorated summaries below and the store-decorated revisions in revision.ts
 * both satisfy it — every existing caller still type-checks.
 *
 * The per-field staleness decoration followed (web-ui plan 2, Task 1), for the
 * same reason one layer up: the Work screen renders `current` against
 * `changes` field by field, marks the fields a human moved underneath a
 * proposal, and marks an item that is gone — and none of that may cost it an
 * import of `updateItem`. See `decoratePending` below, whose one difference
 * from the `decorate` it was moved from is that the item is a parameter
 * instead of a lookup.
 *
 * **What deliberately stayed behind in revision.ts**, because it touches
 * mutate.ts, the `Store`, or the filesystem beyond reading the log:
 * `ensureRevisionDir`/`acquireRevisionLock` (create directories, take locks),
 * `appendLine` (the only writer), `itemNow`/`decorate`/`pendingRevisions` (need
 * the `Store` or a parsed corpus to find the item that `decoratePending` is
 * handed), and every settlement path — stage, promote, discard.
 */

export const REVISION_PROTOCOL = 'my_context/revision@1';

export interface RevisionChanges {
  title?: string;
  body?: string;
  /**
   * The proposed summary. `''` proposes REMOVING the item's summary — see
   * `UpdateInput.summary` for why the clear is spelled that way rather than as
   * a `null`: `RevisionValue` is `string | string[] | Record<string, string>`,
   * and widening it so one field could carry a null would touch every
   * comparison and every renderer of a diff for the sake of one spelling.
   *
   * The BASIS (`Item.summaryOf`) is deliberately not here. It is stamped from
   * the item at the moment a revision is promoted (`updateItem`), so a summary
   * a human approves is anchored to the text they approved it against — not to
   * whatever the item said when an agent drafted it.
   */
  summary?: string;
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

/** One line of `revisions.jsonl`. Every op carries every field it needs to be
 * read on its own; nothing is inherited from a neighbouring line. */
export interface LogLine {
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
export function foldLog(lines: LogLine[]): RevisionRecord[] {
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

/** The pending queue as (revisionId, itemId) — no store, no staleness decoration. */
export function pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[] {
  return foldLog(readLog(root))
    .filter((r) => r.state === 'pending')
    .map((r) => ({ revisionId: r.revisionId, itemId: r.itemId }));
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
  revs: { itemId: string }[],
): { revisions: number; items: number } {
  return { revisions: revs.length, items: new Set(revs.map((r) => r.itemId)).size };
}

// --- The staleness decoration ------------------------------------------------
// Moved here from revision.ts (web-ui plan 2, Task 1). Every body below is
// verbatim from there and every doc comment travelled with it; revision.ts
// re-imports and re-exports all of them, so no caller of that module notices.
// Three of them — canonicalValue, sameValue, valuesOf — were private there and
// are exported here, because that is what importing them back costs.
//
// `decoratePending` is the one signature that changed (the item is a parameter
// instead of a store lookup) and the one place a check was ADDED rather than
// moved; both differences are named at its own comment.

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
 * `steps` is absent for exactly the same reason, and that absence is a
 * decision rather than an oversight: steps are create-only, `UpdateInput`
 * (mutate.ts) has no `steps` field, and progress through a procedure is
 * recorded in the audit log rather than in the item (spec §6m.3), so there
 * is no edit for a revision to carry and no third kind of field for
 * `UPDATE_FIELD_POLICY` to classify. A step is corrected by editing the
 * Markdown and running `mycontext repair`, the route every other hand edit
 * takes.
 *
 * `scope`, `always`, `severity` and `status` are NOT here and must never be:
 * they stay human-only on a governing normative item regardless of
 * `agentEdits` (spec §4), and a revision that could carry them would be a
 * route around that gate rather than a proposal about content.
 */
export const REVISION_FIELDS = ['title', 'body', 'summary', 'tags', 'extra'] as const;

export type RevisionField = (typeof REVISION_FIELDS)[number];

/** What one field of a proposal holds: prose, an unordered set of strings, or
 * the `extra` map. Named because three modules render and compare these values
 * and each needs the same union. */
export type RevisionValue = string | string[] | Record<string, string>;

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
export function canonicalValue(value: RevisionValue): unknown {
  if (Array.isArray(value)) return [...value].sort();
  if (typeof value === 'object') {
    return Object.keys(value).sort().map((key) => [key, value[key]]);
  }
  return value;
}

/** Equality under `canonicalValue`. A string, an array and a map can never
 * compare equal to each other, because their canonical forms differ in shape as
 * well as in content. */
export function sameValue(a: RevisionValue | undefined, b: RevisionValue | undefined): boolean {
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
export function valuesOf(item: Item, changes: RevisionChanges): RevisionChanges {
  const out: RevisionChanges = {};
  if (changes.title !== undefined) out.title = item.title;
  if (changes.body !== undefined) out.body = item.body;
  // `?? ''` for the reason `RevisionChanges.summary` gives: absence is spelled
  // as the empty string on this side, so a proposal that ADDS a summary to an
  // item that has none has a base to diff against and a staleness comparison
  // that means something.
  if (changes.summary !== undefined) out.summary = item.summary ?? '';
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
 * Decorates a pending record with everything that depends on the item as it
 * is NOW: the current values, which of this revision's fields moved underneath
 * it, and whether the item is still there at all.
 *
 * The body is `decorate`'s (revision.ts), unchanged. The one difference is the
 * `item` parameter: `decorate` looked it up through a `Store` or a parsed
 * corpus, which is the whole reason it could not live on this side of the
 * mutator ban. Finding the item stayed with the caller; deciding what it means
 * came here.
 *
 * **The refusal is not moved — it is new, and it is here because the move made
 * it reachable.** `decorate` was private with exactly one caller,
 * `pendingRevisions`, which filters `state === 'pending'` before calling it, so
 * a settled record could never arrive. This function is exported, and what a
 * caller has in hand is a `foldLog` record of ANY state. Its return type says
 * `state: 'pending'`, so decorating a promoted or discarded record would hand
 * that caller a settled revision wearing the pending label — "a discarded
 * candidate came back pending", the exact failure `foldLog`'s terminal-state
 * rule above exists to prevent. Every existing caller filters first and cannot
 * reach this throw.
 */
export function decoratePending(record: RevisionRecord, item: Item | null): PendingRevision {
  if (record.state !== 'pending') {
    throw new Error(
      `my_context: revision ${record.revisionId} is ${record.state}, not pending — refusing to ` +
      `decorate it. What comes back from here is labelled "pending", so decorating a settled ` +
      `revision would put one that a human already promoted or discarded back in a queue ` +
      `awaiting decision. Filter the folded log to state === 'pending' first, as ` +
      `pendingRevisionViews does.`,
    );
  }
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
 * The pending queue, decorated against a plain `Item[]` — the store-free shape
 * a read-only surface consumes. An itemId absent from `items` decorates as
 * `itemMissing`, exactly as a store miss always has.
 *
 * `pendingRevisions` (revision.ts) is the same query over a `MutationContext`;
 * the two agree by construction, because both fold the same log and both
 * decorate through `decoratePending`. `test/core/revision-log-decorate.test.ts`
 * pins that agreement against a log `stageRevision` itself wrote, fresh and
 * stale, so the agreement is a test rather than a claim.
 */
export function pendingRevisionViews(root: string, items: Item[]): PendingRevision[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return foldLog(readLog(root))
    .filter((r) => r.state === 'pending')
    .map((r) => decoratePending(r, byId.get(r.itemId) ?? null));
}
