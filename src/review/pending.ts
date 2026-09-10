/**
 * **What is waiting for a person, how old the oldest of it is, and whether
 * anything should be drawn at all** — `plan:loop seq:4`, design §10.
 *
 * ── WHY THIS MODULE EXISTS AT ALL ──────────────────────────────────────────
 *
 * §1 names the one failure this whole loop must not become: *"a queue nobody
 * works — the same failure as a stale rule, one step removed."* The indicator
 * is the half that makes that failure visible, and it is only worth anything
 * if the terminal bar, the web status strip and `mycontext status` cannot
 * disagree about the number. Every count in this product that was spelled
 * twice eventually said two different things — `reviewQueue` (core/select.ts)
 * carries the measurement: four surfaces each re-derived the draft filter and
 * three of the four omitted the layer clause, so the SessionStart banner, the
 * MCP queue and `status` reported a bigger number than the queue the reader
 * was pointed at. **So the queue filter is not re-derived here either.**
 * `reviewQueue` answers the drafts half and `foldLog(readLog(root))` answers
 * the revisions half, exactly as `mycontext review` reads them.
 *
 * ── AND WHY THE AGE IS THE THING THAT IS COLOURED ──────────────────────────
 *
 * §10 and the owner's ruling: the colour is keyed on the age of the OLDEST
 * pending item, never on the count. *"Twelve drafts from today is a productive
 * session; three from six weeks ago is the landfill, and a count alone cannot
 * tell them apart."* A count-coloured chip would go red on the day the loop
 * worked best.
 *
 * ── NOTHING AT ZERO, AND IT IS ENFORCED HERE RATHER THAN ASKED FOR ─────────
 *
 * The item is explicit: *"THE INDICATOR DRAWS NOTHING AT ZERO. An indicator
 * that shows something when there is nothing pending trains a reader to ignore
 * it — the failure this project measured on a doctor screen where 74 of 74
 * findings offered no remedy and the control stopped being read."*
 *
 * `reviewChip` returns `null` for an empty queue, so a surface that wants to
 * draw the chip has to narrow the `null` away first. Two callers that each
 * remembered to write `if (count === 0) return;` would be two callers that can
 * each forget it; a `null` is a thing the type system will not let either of
 * them forget.
 *
 * **An UNMEASURABLE queue also draws nothing, and that is a deliberate
 * departure from `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * on this surface only.** The standard is about a REPORT. The report here is
 * the Review screen and `mycontext review`, and both of them still name their
 * zero and name their failure — `work.js` draws an `errorNote` for a read that
 * threw and a headline sentence for a measured zero. What this module feeds is
 * a PRESSURE signal on a bar that has one line of room: a chip that appeared
 * saying "the queue could not be read" on every message of a session with no
 * corpus is the 74-of-74 doctor screen again, arriving through the mechanism
 * built to prevent it. So the distinction is kept in the TYPE — `null` count
 * for unmeasurable, `0` for a measured empty queue — and spent by the surfaces
 * that have room to say it.
 */
import { foldLog, readLog } from '../core/revision-log.ts';
import { reviewQueue } from '../core/select.ts';
import { Store } from '../core/store.ts';
import type { Item } from '../core/types.ts';

/** Milliseconds in a day, spelled once. */
const DAY_MS = 86_400_000;

/**
 * **How old the oldest pending thing has to be before the chip changes
 * colour, and both numbers are read off this corpus rather than chosen.**
 *
 * The evidence is thin and is stated rather than dressed up: this corpus has
 * settled exactly TWO drafts in its whole life (audit log, `op: promote`,
 * 2026-08-29 — measured 2026-09-11, n=2, and there has never been a
 * `discard`). Their latencies were:
 *
 *   - `STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional`
 *     created 04:59:49Z, promoted 07:01:03Z — **2.0 hours**, the same working
 *     stretch that made it;
 *   - `KNOWN-edit-body-silently-re-stamps-source-checksum-on-a-snapshot`
 *     created 2026-08-19T16:02Z, promoted 2026-08-29T06:59Z — **9.6 days**.
 *
 * So the two bands name the two things that actually happened here:
 *
 *   - **`AGEING_DAYS = 1`.** Under a day is the fast case: the draft is still
 *     inside the stretch that produced it, which is where this corpus's one
 *     healthy settle happened. Once it has survived a night, nobody settled it
 *     in the session that made it, and that is news rather than a state.
 *   - **`STALE_DAYS = 10`.** 9.6 days is the longest settle this corpus has
 *     ever COMPLETED. Past it, nothing here has ever come back — so the chip
 *     stops reporting an ageing queue and starts reporting landfill.
 *
 * **These are floors, and re-deriving them is owed.** n=2 cannot carry a
 * threshold on its own; what it can do is stop the numbers being invented,
 * which is the failure mode §9 already measured on this project's behalf
 * (*"badly tuned retirement measured WORSE THAN NONE"* — a calendar rule
 * uncorrelated with what it governs). After a fortnight of a real queue the
 * same two lines in the audit log answer the same question with a real n.
 */
export const AGEING_DAYS = 1;
export const STALE_DAYS = 10;

/** The three states of the queue's age. `fresh` is the quiet one. */
export type QueueAge = 'fresh' | 'ageing' | 'stale';

/** What is waiting for a person, split the way §7 splits the screen. */
export interface PendingReview {
  /** Project-layer drafts, exactly `reviewQueue`'s definition. */
  drafts: number;
  /** Revisions staged against items that already govern, still unsettled. */
  revisions: number;
  /** The number a reader is being asked to work down. */
  total: number;
  /**
   * The oldest pending thing's own date, or `null` when nothing pending
   * carries one. An ISO instant for a revision (the log stamps it) and a
   * `YYYY-MM-DD` day for a draft (`valid_from` is all an item records).
   */
  oldestAt: string | null;
  /**
   * How many pending things could not be dated at all. Counted rather than
   * skipped: a queue of five whose ages are unknown is not a fresh queue, and
   * `INV-nothing-is-dropped-silently` applies to the denominator of a colour
   * as much as to a list.
   */
  undated: number;
}

/** The empty answer, so callers never build one by hand. */
export const NOTHING_PENDING: PendingReview = {
  drafts: 0, revisions: 0, total: 0, oldestAt: null, undated: 0,
};

/**
 * The two queues, counted and dated.
 *
 * `items` is whatever the caller already has — `store.all()`, or a
 * post-`mergeLayers` array — because `reviewQueue` answers the same on both
 * and says why. `root` is the corpus directory, read only for the revision
 * log; a root whose log is missing or unreadable contributes zero revisions,
 * which is what `readLog` already answers for a workspace that has staged
 * nothing.
 */
export function pendingReview(
  root: string, items: Item[], staged?: readonly { stagedAt: string }[],
): PendingReview {
  const drafts = reviewQueue(items);
  let revisions: readonly { stagedAt: string }[] = [];
  try {
    // `staged` is for a caller that has ALREADY read the log — `mycontext
    // status` reads it through `revisionQueue` and refuses when it cannot,
    // and reading it a second time here could answer differently in the one
    // direction that matters. Handed in rather than re-read; never re-derived.
    revisions = staged ?? foldLog(readLog(root)).filter((r) => r.state === 'pending');
  } catch {
    // A revision log this product cannot read is a `mycontext review
    // revisions` problem and that command reports it in words. Here it would
    // cost the drafts half its count, which is the one direction that matters:
    // an under-reported queue is a queue that rots without the chip saying so.
    revisions = [];
  }

  let oldest: number | null = null;
  let oldestAt: string | null = null;
  let undated = 0;
  const consider = (stamp: string | null): void => {
    if (stamp === null || stamp === '') { undated++; return; }
    const ms = Date.parse(stamp);
    if (Number.isNaN(ms)) { undated++; return; }
    if (oldest === null || ms < oldest) { oldest = ms; oldestAt = stamp; }
  };
  for (const draft of drafts) consider(draft.validFrom);
  for (const revision of revisions) consider(revision.stagedAt);

  return {
    drafts: drafts.length,
    revisions: revisions.length,
    total: drafts.length + revisions.length,
    oldestAt,
    undated,
  };
}

/**
 * How old the oldest pending thing is, in whole days, or `null` when nothing
 * pending is datable.
 *
 * Floored rather than rounded: a draft eleven hours old is nought days old,
 * not one. A colour that stepped up half a day early would be a colour that
 * fires on the productive session §10 is trying to protect.
 */
export function oldestAgeDays(view: PendingReview, now: number): number | null {
  if (view.oldestAt === null) return null;
  const ms = Date.parse(view.oldestAt);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/**
 * The band, from the age. **`undated` counts as `ageing` rather than as
 * `fresh`**: a pending thing whose date this product cannot read is not
 * evidence that the queue is young, and the cheap failure direction is the one
 * that makes a reader look.
 */
export function queueAge(view: PendingReview, now: number): QueueAge {
  const days = oldestAgeDays(view, now);
  if (days === null) return view.undated > 0 ? 'ageing' : 'fresh';
  if (days >= STALE_DAYS) return 'stale';
  if (days >= AGEING_DAYS) return 'ageing';
  return view.undated > 0 ? 'ageing' : 'fresh';
}

/**
 * The same two counts, read from the INDEX rather than from a corpus somebody
 * has already loaded — for the status line, which runs on every assistant
 * message and cannot afford a rebuild.
 *
 * ── WHAT IT COSTS, MEASURED RATHER THAN ARGUED ─────────────────────────────
 *
 * p50 **2.9 ms**, p95 **4.3 ms**, over 60 runs against this repository's own
 * corpus (1,085 items) on 2026-09-11, on a contended machine — a read-only
 * open of `.index.db`, one indexed `SELECT` narrowed to draft rows, and one
 * read of the revision log. For scale, the same bar already pays p95 26.6 ms
 * for `myctxShare`, which opens a different database on the same path.
 *
 * **That number reverses a cost refusal recorded in
 * `test/ui/strip-parity.test.ts`** — *"the review queue … was refused for the
 * terminal because it needs `.index.db` opened, a second database, costing
 * +32% of that bar's per-message budget"*. The percentage is not disputed and
 * may well still be right; what changed is the case on the other side of it.
 * `plan:loop seq:4` exists because §1 names *a queue nobody works* as the one
 * failure the whole loop must not become, and a queue indicator that lives
 * only on a surface a person has to go and open is that failure with an extra
 * step. Four milliseconds a message is what it costs to make the count
 * unavoidable, and the field is drawn ONLY when there is something to say.
 *
 * **`null` for a queue that could not be read at all**, which is not a zero —
 * a workspace with no corpus, an index this build's schema does not match, a
 * database mid-write. `Store.openReadOnlyChecked` never migrates and never
 * self-heals, exactly as a per-message reader must not, and every failure
 * lands here as silence rather than as a wrong number.
 *
 * **Only draft ROWS are deserialised.** The corpus is 1,085 items and the
 * queue is normally nought to a handful; `JSON.parse` over the whole table
 * would be the cost the refusal was actually about.
 */
export function pendingReviewFromIndex(root: string, dbPath: string): PendingReview | null {
  let drafts: Item[];
  try {
    const store = Store.openReadOnlyChecked(dbPath);
    try {
      drafts = store
        .raw("SELECT data FROM items WHERE status = 'draft' AND layer = 'project'")
        .map((row) => JSON.parse(String(row['data'])) as Item);
    } finally {
      store.close();
    }
  } catch {
    return null;
  }
  // `reviewQueue` still runs over what the SQL selected, and that is not
  // belt-and-braces: the SQL is an INDEX-shaped restatement of the filter, and
  // the one definition is the function. If the two ever disagree, the function
  // wins and the SQL is merely a narrowing that saved some parsing.
  return pendingReview(root, drafts);
}

/** What a surface draws, or `null` — see the header: nothing at zero. */
export interface ReviewChip {
  count: number;
  age: QueueAge;
  /** Whole days, or `null` when the oldest pending thing carries no date. */
  days: number | null;
  drafts: number;
  revisions: number;
}

/**
 * **The one gate between "there is a queue" and "draw something".**
 *
 * `null` for an empty queue, for a `null` view (nothing could be measured),
 * and for nothing else. Every surface that draws this chip calls this
 * function; none of them re-implements the zero rule, because a rule about
 * silence is exactly the rule a second implementation forgets.
 */
export function reviewChip(view: PendingReview | null, now: number): ReviewChip | null {
  if (view === null) return null;
  if (view.total <= 0) return null;
  return {
    count: view.total,
    age: queueAge(view, now),
    days: oldestAgeDays(view, now),
    drafts: view.drafts,
    revisions: view.revisions,
  };
}
