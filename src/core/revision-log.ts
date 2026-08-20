import path from 'node:path';
import { readJsonlFile, type JsonlRow } from './jsonl-log.ts';
import type { Origin } from './types.ts';

/**
 * Read-only access to the staged-revision log — extracted from revision.ts
 * (web-ui plan 1, Task 6) so that a read-only surface can count and list
 * pending revisions WITHOUT importing revision.ts, which imports updateItem
 * from mutate.ts at runtime. The UI server's no-writes test bans mutate.ts and
 * revision.ts from its import graph; this module is what makes that ban
 * compatible with reporting the queue.
 *
 * Everything here is moved verbatim from revision.ts; behaviour changes are
 * none, and revision.ts re-imports these symbols so its callers are untouched.
 * The one signature that moved is `pendingRevisionCounts`, WIDENED from
 * `PendingRevision[]` to the two fields it actually reads, so that the
 * undecorated summaries below and the store-decorated revisions in revision.ts
 * both satisfy it — every existing caller still type-checks.
 *
 * **What deliberately stayed behind in revision.ts**, because it touches
 * mutate.ts, the `Store`, or the filesystem beyond reading the log:
 * `ensureRevisionDir`/`acquireRevisionLock` (create directories, take locks),
 * `appendLine` (the only writer), `decorate`/`itemNow`/`pendingRevisions`
 * (need the `Store` or a parsed corpus), and every settlement path — stage,
 * promote, discard. `PendingRevision`, `RevisionField`, `REVISION_FIELDS`,
 * `RevisionValue` and `changedFields` stayed too: nothing here needs them, and
 * a type moved without a reader is a move for its own sake.
 */

export const REVISION_PROTOCOL = 'my_context/revision@1';

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
