import type { AuditRecord } from './audit.ts';

// --- Step progress, replayed rather than stored ------------------------------
//
// A procedure's "3 of 5" is COUNTED from the audit log every time it is asked,
// and is written down nowhere: not in the item file, not in the index, not in a
// sidecar. That is the same relationship the session banner's draft count has
// to `reviewQueue`, and it is chosen for the same reason — a stored tally is a
// second copy of a fact, and the two disagree the first time a write is
// interrupted, a run is reset, or a log is replayed from a rotated segment.
//
// **The log is the anchor, and `readAudit` is why that works.** It returns
// every record across every segment, oldest first, so a `step-reset` that has
// since rotated out of the live log is still found. No segment-window special
// case is needed here and none should be added: one would turn "this procedure
// was activated" into a fact with an expiry date.
//
// Everything here is PURE — no I/O, no clock, no workspace. The caller supplies
// the records, which is what lets one read serve a listing of many procedures
// and what makes every case in `test/core/progress.test.ts` a plain function
// call rather than a fixture.
//
// **What this cannot tell you: whose progress it is.** Progress records are
// workspace-scoped, because no CLI surface is handed a trustworthy session id
// (`core/focus.ts` measured that and conceded it). Two terminals working one
// procedure share one record set. That limit is disclosed by the command that
// prints the number, not papered over here.

/**
 * The step a `progress` record names, or `null` when this build cannot read it.
 *
 * The note is written as `step 3` by the command that records the tick. A note
 * that does not parse is NOT an error and not a zero — it is a record from a
 * build that wrote something else, and the only honest handling is to leave it
 * out of the count and say how many were left out (`unreadableProgress`).
 *
 * Step numbers are 1-based, matching how the steps are rendered and how a
 * person refers to them, so `step 0` does not parse either.
 */
function stepNumber(note: string | undefined): number | null {
  if (note === undefined) return null;
  const match = /^\s*step\s+(\d+)\s*$/i.exec(note);
  if (match === null) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * One replay of one procedure's records: which steps are done, and how many
 * records could not be read.
 *
 * Both answers come out of the same pass because both are anchored on the same
 * `step-reset`: a record from a previous run tells you nothing about this one,
 * whether or not this build can read it.
 */
function replay(records: AuditRecord[], itemId: string): { done: Set<number>; unreadable: number } {
  const done = new Set<number>();
  let unreadable = 0;
  for (const record of records) {
    if (record.kind !== 'progress' || record.itemId !== itemId) continue;
    if (record.op === 'step-reset') {
      // The anchor. A procedure is one-shot, so a second activation starts
      // clean rather than inheriting the first run's ticks — and it carries no
      // step of its own, so it is never itself unreadable.
      done.clear();
      unreadable = 0;
      continue;
    }
    const n = stepNumber(record.note);
    if (n === null) {
      unreadable++;
      continue;
    }
    if (record.op === 'step-done') done.add(n);
    if (record.op === 'step-undone') done.delete(n);
  }
  return { done, unreadable };
}

/**
 * Which steps of `itemId` are ticked, replayed from `records` in log order.
 *
 * Order is the whole of the semantics: a step ticked, un-ticked and ticked
 * again is done, because the log is append-only and the last word wins. A
 * record for another procedure, or of another kind, is not counted however its
 * note reads.
 */
export function procedureProgress(records: AuditRecord[], itemId: string): Set<number> {
  return replay(records, itemId).done;
}

/**
 * How many of `itemId`'s progress records in the current run this build could
 * not read.
 *
 * Task 9's `procedure show` prints "N progress record(s) could not be read"
 * when this is non-zero. Counting those records as done, or as not done, would
 * both be claims about a note nothing here understands; saying how many were
 * skipped is the only honest option, and it is why the number is exported at
 * all rather than swallowed inside the replay.
 */
export function unreadableProgress(records: AuditRecord[], itemId: string): number {
  return replay(records, itemId).unreadable;
}

/**
 * The "3 of 5" string — computed, never stored.
 *
 * `total` is the procedure's step count as the item file declares it TODAY, so
 * an edited procedure re-reads against its new length without any record being
 * rewritten. That is the intended behaviour of a derived number and the reason
 * this takes the total as an argument rather than recording it.
 */
export function progressLine(done: Set<number>, total: number): string {
  return `${done.size} of ${total}`;
}
