/**
 * **`needs` — the one dependency a work item can declare, and everything that
 * reads it.**
 *
 * Measured on this project's own corpus, 2026-08-28: 425 non-superseded task
 * items, ZERO carrying a machine-readable dependency, five sitting at
 * `state: blocked` and none of them naming what they are blocked ON. The cost
 * was paid the same day the count was taken — `plan:walk seq:8` carried the
 * sentence "Blocked on plan:walk seq:7", `seq:7` landed and went green, and
 * `seq:8` stayed `blocked` until a human noticed by hand while drawing a
 * progress table. Two more tasks were freed by that same landing and nothing
 * said so.
 *
 * A deliberate attempt to recover the graph from the prose with a regex
 * matched 4 of ~28 mentions, and one of the four resolved to `the/45` — a plan
 * that does not exist, harvested out of the middle of a sentence. That result
 * is the argument for a FIELD: a notation with a 25% hit rate and a false
 * positive in the same pass is not a notation.
 *
 * ── THE DIRECTION IS `needs`, NOT `blocks` ─────────────────────────────────
 *
 * `open_question` already declares `blocks`, "naming what is waiting on the
 * answer", and it is the right direction for a QUESTION: whoever writes the
 * question knows who is stuck. It is the wrong direction for a task. A task
 * knows what it is waiting for — the author wrote the sentence — and almost
 * never knows who will one day wait on it. `blocks` is derivable from `needs`
 * by inversion; `needs` is derivable from nothing.
 *
 * ── SHAPE, NEVER EXISTENCE ─────────────────────────────────────────────────
 *
 * A reference to a task that does not exist yet is LEGITIMATE and stays
 * legitimate: plans are written before the tasks in them are. Refusing an
 * unknown reference would make the field unusable at exactly the moment it is
 * most useful — while a plan is being laid out. So this module answers three
 * separate questions and never collapses them:
 *
 *   - is the reference well SHAPED (`plan/seq`)?     malformed, if not
 *   - does anything in the corpus ANSWER to it?      unresolved, if not — a
 *                                                    note, never an error
 *   - are the things it answers to `done`?           satisfied / pending
 *
 * ── EVERYTHING HERE IS PURE ────────────────────────────────────────────────
 *
 * No I/O, no clock, no workspace, the same discipline `core/progress.ts`
 * keeps: the caller supplies the items. That is what lets one corpus read
 * serve a doctor check and a report, and what makes every case in
 * `test/core/needs.test.ts` a plain function call.
 */
import type { Config } from './config.ts';
import type { Item } from './types.ts';

/** The frontmatter field this module is about. */
export const NEEDS_FIELD = 'needs';

/**
 * The three fields that, taken together, identify a category as one whose
 * items are PLANNED WORK — and therefore one whose items can wait on each
 * other.
 *
 * Read from config rather than matched against the name `task`, and the
 * difference is not cosmetic. `task` was a CUSTOM category when this was
 * written — it existed only because `.my_context/config.json` declared it — and
 * it SHIPS in the catalogue as of 2026-09-02, which changes nothing here:
 * another project may still call the same idea `story` or `ticket`, and a
 * hardcoded name would make every check below silently do nothing there. What
 * the checks actually require is a plan, a position in it, and a state — so
 * that is what is asked for.
 */
export const PLAN_FIELD = 'plan';
export const SEQ_FIELD = 'seq';
export const STATE_FIELD = 'state';

/** The two `state` values this module reasons about by name. */
export const DONE_STATE = 'done';
export const BLOCKED_STATE = 'blocked';

/**
 * A reference is `plan/seq`, comma-separated in the field.
 *
 * Both halves lowercase, because the ids they name are: `slug.ts` mints one
 * deterministic case for exactly the reason INV-posix-normalized-paths gives —
 * Windows is case-insensitive and Linux is not, so a reference that matched on
 * one machine and not the other would be a dependency that quietly stopped
 * being one. `-` and `_` are admitted because real sequences use them
 * (`1s-a`, `13c2`, `10p`); a second `/` is not, because `plan/seq/extra` is
 * not a thing this field can mean and accepting it would silently truncate.
 */
const REF_SHAPE = /^[a-z][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/;

/** One `needs` value, split into what can be used and what cannot. */
export interface ParsedNeeds {
  /** Well-shaped references, in the order written, de-duplicated. */
  refs: string[];
  /**
   * Entries that are not `plan/seq`, verbatim as written.
   *
   * Kept rather than dropped: a malformed entry is the author saying this task
   * waits on something, in a spelling nothing can read. Dropping it silently
   * would leave a task looking dependency-free when its author said otherwise
   * — INV-nothing-is-dropped-silently, applied to the field whose whole job is
   * to stop a dependency going unnoticed.
   */
  malformed: string[];
}

/**
 * Split and shape-check a raw `needs` value.
 *
 * Empty and whitespace-only entries are skipped rather than reported: a
 * trailing comma is a typo with no reading other than "nothing here", and
 * reporting it would put noise in front of the findings that matter.
 */
export function parseNeeds(raw: string | undefined): ParsedNeeds {
  const refs: string[] = [];
  const malformed: string[] = [];
  if (raw === undefined) return { refs, malformed };
  for (const piece of raw.split(',')) {
    const entry = piece.trim();
    if (entry === '') continue;
    const normalized = entry.toLowerCase();
    if (!REF_SHAPE.test(normalized)) {
      if (!malformed.includes(entry)) malformed.push(entry);
      continue;
    }
    if (!refs.includes(normalized)) refs.push(normalized);
  }
  return { refs, malformed };
}

/**
 * Does this category's items plan work? See `PLAN_FIELD` above for why the
 * question is asked of the config rather than of the category's name.
 *
 * `Object.hasOwn`, not a bare index, for the prototype hazard `resolveCategory`
 * and `tierOf` both document: a category literally named `constructor` must
 * answer false here rather than reaching `Object.prototype`.
 *
 * **A DISABLED category plans no work**, and that clause is what keeps the
 * zero-work-category answer reachable at all. `task` shipped in the catalogue
 * on 2026-09-02 with `plan`, `seq` and `state` among its extra fields, and a
 * config `extraFields` override EXTENDS the catalogue's list rather than
 * replacing it (`resolveConfig`, core/config.ts) — so no `config.json` can take
 * those three names off `task`, and without this clause every project on earth
 * would answer true here and `ready`'s "no category plans work" branch would be
 * dead code guarding a case no configuration could produce. `enabled` is the
 * switch a project actually has, it is the one this question should follow —
 * offering work from a category the project switched off is offering work its
 * own tools will not capture — and turning it off is a deliberate act, so the
 * answer is loud rather than an empty list: `ready` names the switch.
 */
export function isWorkCategory(config: Config, type: string): boolean {
  if (!Object.hasOwn(config.categories, type)) return false;
  const category = config.categories[type];
  if (!category.enabled) return false;
  const declared = category.extraFields;
  return declared.includes(PLAN_FIELD)
    && declared.includes(SEQ_FIELD)
    && declared.includes(STATE_FIELD);
}

/**
 * The `plan/seq` key an item answers to, or `null` when it does not carry
 * both halves.
 *
 * Not every work item has one — this corpus holds a task whose `plan` and
 * `seq` were never filled in — and a `null` key is a real answer rather than
 * an error: such an item can still HAVE needs, it just cannot BE needed.
 */
export function taskKey(item: Item): string | null {
  const plan = (item.extra[PLAN_FIELD] ?? '').trim().toLowerCase();
  const seq = (item.extra[SEQ_FIELD] ?? '').trim().toLowerCase();
  if (plan === '' || seq === '') return null;
  return `${plan}/${seq}`;
}

/** The `state` of a work item, lowercased, or `''` when it declares none. */
export function taskState(item: Item): string {
  return (item.extra[STATE_FIELD] ?? '').trim().toLowerCase();
}

/**
 * Every work item in the corpus, superseded ones excluded.
 *
 * Superseded is the one status that means "this was replaced": counting a
 * replaced task as an unmet dependency would hold its successor's dependents
 * back forever. `deprecated` is deliberately NOT excluded here — it is retired
 * without a replacement, so a task waiting on one is waiting on something that
 * will never land, and that is a fact the reader should see rather than one
 * this module should hide.
 */
export function workItems(items: Item[], config: Config): Item[] {
  return items.filter((i) => i.status !== 'superseded' && isWorkCategory(config, i.type));
}

/**
 * `plan/seq` → every work item answering to it.
 *
 * A LIST and not a single item, because the key is not unique and pretending
 * otherwise would be the defect this whole field exists to remove. Measured on
 * this corpus, 2026-08-28: six live tasks share `ui3/11x` and two share
 * `probe/0`. A reference to `ui3/11x` therefore means all six, and is
 * satisfied only when every one of them is done — the reading that cannot
 * quietly under-report a blocker.
 */
export function buildTaskIndex(items: Item[], config: Config): Map<string, Item[]> {
  const index = new Map<string, Item[]>();
  for (const item of workItems(items, config)) {
    const key = taskKey(item);
    if (key === null) continue;
    const bucket = index.get(key);
    if (bucket === undefined) index.set(key, [item]);
    else bucket.push(item);
  }
  return index;
}

/**
 * What one reference is worth right now.
 *
 * `unresolved` is a NOTE and never an error — the ruling this module opens
 * with. It is kept separate from `pending` rather than folded into it because
 * the two mean different things to a reader: `pending` is "the blocker exists
 * and has not landed", `unresolved` is "nothing in this corpus answers to that
 * name", which is either a plan not yet written out or a typo, and only a
 * human can tell which.
 */
export type RefStatus = 'satisfied' | 'pending' | 'unresolved';

export function refStatus(ref: string, index: Map<string, Item[]>): RefStatus {
  const matches = index.get(ref);
  if (matches === undefined || matches.length === 0) return 'unresolved';
  return matches.every((i) => taskState(i) === DONE_STATE) ? 'satisfied' : 'pending';
}

/** One work item's dependencies, resolved against the corpus. */
export interface NeedsReading {
  /** `plan/seq` for this item, or null — see `taskKey`. */
  key: string | null;
  /** Its `state`, lowercased. */
  state: string;
  /** Entries that are not `plan/seq`, verbatim. */
  malformed: string[];
  /** Well-shaped references whose targets are all `done`. */
  satisfied: string[];
  /** Well-shaped references with at least one target not `done`. */
  pending: string[];
  /** Well-shaped references nothing in the corpus answers to. */
  unresolved: string[];
}

export function readNeeds(item: Item, index: Map<string, Item[]>): NeedsReading {
  const { refs, malformed } = parseNeeds(item.extra[NEEDS_FIELD]);
  const satisfied: string[] = [];
  const pending: string[] = [];
  const unresolved: string[] = [];
  for (const ref of refs) {
    const status = refStatus(ref, index);
    if (status === 'satisfied') satisfied.push(ref);
    else if (status === 'pending') pending.push(ref);
    else unresolved.push(ref);
  }
  return { key: taskKey(item), state: taskState(item), malformed, satisfied, pending, unresolved };
}

/**
 * Why a work item is NOT on the ready list.
 *
 * An enumerated reason rather than a boolean, because the list has to disclose
 * what it left out and why — a "ready" list that silently omits half the open
 * work is the flattering-in-one-direction failure
 * `STD-the-progress-table-has-one-format-and-this-is-it` names.
 */
export type HeldReason = 'pending' | 'unresolved' | 'malformed' | 'blocked_without_needs';

export interface ReadyRow {
  item: Item;
  reading: NeedsReading;
}

export interface HeldRow extends ReadyRow {
  reason: HeldReason;
}

export interface ReadyReport {
  /** Open work whose every `needs` reference is satisfied, sorted by priority. */
  ready: ReadyRow[];
  /** Open work that is not ready, each row carrying the reason. */
  held: HeldRow[];
  /** Work items considered — open ones only. */
  open: number;
}

/**
 * `priority` as a number for sorting. `1` is highest in this corpus; anything
 * absent or unreadable sorts LAST rather than first, so a task with no stated
 * priority never displaces one that has been prioritised.
 */
function priorityOf(item: Item): number {
  const raw = (item.extra.priority ?? '').trim();
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/**
 * Split `plan/seq` ordering so `seq:9` comes before `seq:10`.
 *
 * A plain string compare puts `10` before `9`, which is the ordering nobody
 * reading a plan means. The leading digits are compared as a number and
 * whatever follows them (`b`, `s-a`, `c2`) as a string, which is exactly how
 * the sequences in this corpus are written.
 */
function seqParts(seq: string): [number, string] {
  const match = /^(\d+)(.*)$/.exec(seq);
  if (match === null) return [Number.POSITIVE_INFINITY, seq];
  return [Number(match[1]), match[2]];
}

function compareRows(a: ReadyRow, b: ReadyRow): number {
  const byPriority = priorityOf(a.item) - priorityOf(b.item);
  if (byPriority !== 0) return byPriority;
  const planA = (a.item.extra[PLAN_FIELD] ?? '').toLowerCase();
  const planB = (b.item.extra[PLAN_FIELD] ?? '').toLowerCase();
  if (planA !== planB) return planA.localeCompare(planB);
  const [numA, restA] = seqParts((a.item.extra[SEQ_FIELD] ?? '').toLowerCase());
  const [numB, restB] = seqParts((b.item.extra[SEQ_FIELD] ?? '').toLowerCase());
  if (numA !== numB) return numA - numB;
  if (restA !== restB) return restA.localeCompare(restB);
  return a.item.id.localeCompare(b.item.id);
}

/**
 * **What can be started right now** — and what cannot, with the reason.
 *
 * "Open" is every work item whose state is not `done`, `blocked` included:
 * a blocked task whose blockers have all landed is the single case this whole
 * field was built for, so excluding `blocked` from the ready list would leave
 * out the only row that ever surprised anybody.
 *
 * A task with NO `needs` is ready — vacuously, and honestly: nothing in the
 * corpus says anything is holding it. The one exception is a task at
 * `state: blocked` with no `needs`, which is held rather than listed: it
 * asserts a blocker and names none, so the corpus cannot say it is ready and
 * must not pretend to. `doctor` reports that same item by name.
 *
 * Readiness is DERIVED here and stored nowhere. There is no `ready` state and
 * there must not be one: it is a function of `needs` plus the states of what
 * `needs` names, and writing it down would create a second copy to keep in
 * sync — the defect class this corpus keeps paying for, most recently in the
 * thirteen tasks whose `state` tag and `state` field disagreed.
 */
export function readyReport(items: Item[], config: Config): ReadyReport {
  const index = buildTaskIndex(items, config);
  const ready: ReadyRow[] = [];
  const held: HeldRow[] = [];

  for (const item of workItems(items, config)) {
    const state = taskState(item);
    if (state === DONE_STATE) continue;
    // **A cancelled task is not work, and `state` cannot say so.** The four
    // states are `todo|doing|blocked|done`, so a task abandoned before it was
    // built has no state to move to: `done` would claim it shipped, and it
    // never did. What records the cancellation is `status: deprecated`, and
    // until now this loop did not read it — `workItems` filters `superseded`
    // alone, so six deprecated tasks were being offered as ready work on this
    // corpus (`docsys/5`, `/6`, `/9`, `/10`, `walk/16`, `tuts/4`), and the
    // count said "2 ready of 2 open" for a plan holding one real task.
    //
    // Found 2026-09-06 by a worker that read its own cancelled task back out
    // of `ready` and said so. The defect is this report's, not the author's:
    // asking every author to also move a state that cannot express the fact is
    // the held-by-convention failure this project keeps paying for.
    //
    // `deprecated` only, deliberately. `draft` and `validated` are workable
    // states of a live task; `superseded` is already gone above. Deprecated is
    // the one that means "this is not to be done".
    if (item.status === 'deprecated') continue;
    const reading = readNeeds(item, index);
    const row: ReadyRow = { item, reading };

    if (reading.malformed.length > 0) held.push({ ...row, reason: 'malformed' });
    else if (reading.pending.length > 0) held.push({ ...row, reason: 'pending' });
    else if (reading.unresolved.length > 0) held.push({ ...row, reason: 'unresolved' });
    else if (state === BLOCKED_STATE && reading.satisfied.length === 0) {
      held.push({ ...row, reason: 'blocked_without_needs' });
    } else ready.push(row);
  }

  ready.sort(compareRows);
  held.sort(compareRows);
  return { ready, held, open: ready.length + held.length };
}
