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

/* -------------------------------------------------------------------------- *
 * WHAT A WORK ITEM IS, IN THE TYPE
 *
 * `TASK-a-function-that-reads-a-task-field-accepts-any-item-and` measured the
 * defect this section removes: `taskState(item: Item)` accepted ANY item and
 * answered the empty string for a `requirement` — a category that has no
 * `state` field at all — which is indistinguishable from a task that declares
 * `state` and has not set it. The measured-zero-versus-unmeasured defect
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`), expressed
 * in a function signature.
 *
 * **And the proof was already computed and thrown away.** `isWorkCategory`
 * below works out exactly the fact the signature needs — does this item's
 * category declare `plan`, `seq` and `state`, and is it enabled — and the
 * signature did not use it. `WorkItem` is that answer, carried.
 *
 * **THE LIVE INSTANCE.** D57 closed ON THE MAP rather than on its item, because
 * *"a requirement has no field to close on"* — recorded as an owner ruling in
 * `REF-the-d-numbers-what-each-one-means-and-which-are-only`. That is the same
 * fact seen from the corpus side: the state read on a requirement answered the
 * empty string, and nothing anywhere said the question did not apply.
 *
 * **Erasable** (`CONST-node-24-no-build-step`): an intersection with a phantom
 * property keyed on an unexported `unique symbol`. A `WorkItem` IS an `Item` at
 * run time, in every array, every `Map` and every `JSON.stringify`; the brand
 * emits nothing.
 * -------------------------------------------------------------------------- */

declare const WORK_ITEM: unique symbol;

/**
 * **An item whose category plans work** — one whose `plan`, `seq` and `state`
 * fields are declared by the config and can therefore be READ rather than
 * guessed at. The only functions that may ask an item for a task field take
 * this, not `Item`.
 *
 * Produced by `asWorkItem`, `isWorkItem` and `workItems`, and by nothing else.
 */
export type WorkItem = Item & { readonly [WORK_ITEM]: true };

/**
 * The proof, made once and carried: `item` if its category plans work, `null`
 * otherwise.
 *
 * This is `isWorkCategory` with its answer KEPT instead of discarded. A caller
 * that gets `null` has been told something real — *this category has no such
 * field* — which is the answer `taskState` used to hide inside an empty string.
 */
export function asWorkItem(config: Config, item: Item): WorkItem | null {
  return isWorkCategory(config, item.type) ? item as WorkItem : null;
}

/** The same proof as a guard, for a caller narrowing in place. */
export function isWorkItem(config: Config, item: Item): item is WorkItem {
  return isWorkCategory(config, item.type);
}

/**
 * **The state read for the one caller that cannot hold the proof.**
 *
 * `core/select.ts` is pure by declaration — its header records that it imports
 * only `Config` and `Item` as TYPES, nothing executable — and `governs`, the
 * exported function that reaches this, is called from `doctor/checks.ts` with
 * one argument. Threading a `Config` through it is a signature change in a file
 * this lane does not own, so the escape is NAMED rather than taken silently,
 * and its name says that no proof was presented.
 *
 * **It has exactly one non-test caller** — `isOpenWork` in `core/select.ts` —
 * and `test/core/needs.test.ts` pins that count, so a second one is a failing
 * test rather than a quiet return of the defect this section removed.
 *
 * Everything true of `taskState` is true here, including the part that is
 * wrong: an empty string for a work item that declares no `state`, AND an empty
 * string for a category that has no such field. Telling those two apart is
 * exactly what a caller gives up by not presenting a `Config`.
 */
export function unprovenTaskState(item: Item): string {
  return (item.extra[STATE_FIELD] ?? '').trim().toLowerCase();
}

/**
 * The `plan/seq` key a work item answers to, or `null` when it does not carry
 * both halves.
 *
 * **`WorkItem`, not `Item`** — see the section above. A `requirement` has no
 * `plan` and no `seq`, so `null` out of here used to mean two different things
 * and now means one.
 *
 * Not every work item has a key — this corpus holds a task whose `plan` and
 * `seq` were never filled in — and that `null` is a real answer rather than an
 * error: such an item can still HAVE needs, it just cannot BE needed.
 */
export function taskKey(item: WorkItem): string | null {
  const plan = (item.extra[PLAN_FIELD] ?? '').trim().toLowerCase();
  const seq = (item.extra[SEQ_FIELD] ?? '').trim().toLowerCase();
  if (plan === '' || seq === '') return null;
  return `${plan}/${seq}`;
}

/**
 * The `state` of a work item, lowercased, or the empty string when it declares
 * none.
 *
 * **`WorkItem`, not `Item`, and that is the whole of
 * `TASK-a-function-that-reads-a-task-field-accepts-any-item-and`.** The empty
 * string now has ONE reading — a work item that has not recorded a state —
 * instead of two that no caller could tell apart. An item of a category with no
 * `state` field cannot reach this function: it fails to produce a `WorkItem`,
 * and being told that is the point.
 */
export function taskState(item: WorkItem): string {
  return unprovenTaskState(item);
}

/**
 * Every work item in the corpus, superseded ones excluded.
 *
 * Superseded is the one status that means "this was replaced": counting a
 * replaced task as an unmet dependency would hold its successor's dependents
 * back forever. `deprecated` is deliberately NOT excluded HERE either, and the
 * reason has changed — read `refStatus` below before changing this line.
 *
 * The original reasoning was that a task waiting on something retired without a
 * replacement is a fact the reader should see rather than one this module hides.
 * That instinct is right and the mechanism was wrong: holding the dependent is
 * not how the fact gets seen — `doctor`'s `needs_unresolved` is. Owner ruling
 * 2026-09-06 discharges the wait in `refStatus` while the reference keeps
 * resolving here, so the target stays visible, addressable and reportable
 * instead of vanishing out of the index and reading as a typo.
 */
export function workItems(items: Item[], config: Config): WorkItem[] {
  // `WorkItem[]`, so every caller of this function — including the three in
  // `doctor/checks.ts` — carries the proof onward for free and needed no edit.
  // That is what made this migration landable at all: the boundary is HERE, at
  // the one filter every consumer already passes through.
  return items.filter((i): i is WorkItem =>
    i.status !== 'superseded' && isWorkCategory(config, i.type));
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
export function buildTaskIndex(items: Item[], config: Config): Map<string, WorkItem[]> {
  const index = new Map<string, WorkItem[]>();
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

/**
 * **A cancelled dependency is discharged, not pending** — owner ruling
 * 2026-09-06, and it reverses the reasoning `workItems` above still carries for
 * its own, different question.
 *
 * A task retired with `status: deprecated` will never land, so a dependent
 * waiting for it waits forever. Counting it as `pending` holds live work
 * hostage to work somebody decided not to do.
 *
 * **Discharged here rather than removed from the index, and the difference is
 * the whole of it.** Dropping deprecated tasks out of `buildTaskIndex` looks
 * like the simpler fix and does not work: the reference stops resolving, so it
 * becomes `unresolved`, and `readyReport` holds an unresolved row exactly as it
 * holds a pending one. The dependent stays stuck under a different label. The
 * wait is only actually over if the reference RESOLVES and is judged met.
 *
 * Nothing goes quiet. `unresolved` still means "nothing answers to that name",
 * and `doctor`'s `needs_unresolved` (`checks.ts` ~2461) still names every such
 * reference — so a typo or an unwritten plan is reported exactly as before.
 * What changed is only the case where the target EXISTS and was cancelled,
 * which no longer reads as "not landed yet".
 *
 * Measured when the ruling was taken: three tasks name `needs: docsys/5`, which
 * is deprecated. None was held by it — two are done and the third is itself
 * cancelled — so this changed nothing observable on the day it landed, which is
 * the safest moment to make it true.
 */
export function refStatus(ref: string, index: Map<string, WorkItem[]>): RefStatus {
  const matches = index.get(ref);
  if (matches === undefined || matches.length === 0) return 'unresolved';
  const met = (i: WorkItem): boolean => taskState(i) === DONE_STATE || i.status === 'deprecated';
  return matches.every(met) ? 'satisfied' : 'pending';
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

export function readNeeds(item: WorkItem, index: Map<string, WorkItem[]>): NeedsReading {
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
  item: WorkItem;
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
  /** Work items considered — open ones only. NEVER includes `drafts`. */
  open: number;
  /**
   * Work items at `status: draft` — proposals awaiting a person, counted and
   * in neither list above.
   *
   * A count rather than rows, for the reason `questionReport` gives for
   * counting the quiet questions: the surface that OWNS them is
   * `mycontext review list`, and a second listing of the same population here
   * is the two-lists-that-can-disagree failure. It is carried out of this
   * function rather than recomputed by each caller so that every surface
   * drawing a readiness report discloses the same number.
   */
  drafts: number;
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
  let drafts = 0;

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
    // `deprecated` here, and `draft` on the clause below — corrected
    // 2026-09-23, because this comment used to claim `draft` was a workable
    // state of a live task and it is not. `validated` is; `superseded` is
    // already gone above. Deprecated means "this is not to be done" and draft
    // means "nobody has agreed to do it yet".
    if (item.status === 'deprecated') continue;
    // **A DRAFT IS A PROPOSAL, NOT WORK** —
    // `TASK-mycontext-ready-counts-a-review-draft-as-open-work-so-the`.
    // Measured 2026-09-22: the review pass wrote ten task drafts from a
    // session's own prompts and `ready --json` answered `open: 146` against a
    // board of 136, every one of the ten listed as READY with `plan: null`.
    // Nothing had been filed. A draft is indexed, searchable and shown, and
    // `select` never injects it precisely because its status is `draft`; it
    // becomes dispatchable work when a person promotes it through
    // `mycontext review promote`, which is also where it gains a `plan` and a
    // `seq` to be addressed by. Counting it here let a machine's idea move the
    // board, which is the one thing the review loop's own design forbids.
    //
    // **The sibling clause above was wrong about this and is now corrected**:
    // it said `draft` and `validated` are workable states of a live task. That
    // is true of `validated` and false of `draft`, and the difference is who
    // has read the item. `questionReport` reached the same boundary first and
    // spells it the same way — see its docblock on why drafts are excluded
    // there.
    //
    // Counted, never dropped: `INV-nothing-is-dropped-silently`. The count
    // leaves here as `ReadyReport.drafts` and every surface says it out loud.
    if (item.status === 'draft') { drafts += 1; continue; }
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
  return { ready, held, open: ready.length + held.length, drafts };
}

/* -------------------------------------------------------------------------- *
 * THE D MAP — A SUBJECT'S MEMBERSHIP, AS DATA
 *
 * A "D number" is this project's name for a SUBJECT of work. The register that
 * mints them — `REF-the-d-numbers-what-each-one-means-and-which-are-only` — is
 * PROSE, and every progress table this campaign has produced was a regex over
 * that prose. TWO ROWS WERE WRONG ON 2026-09-16: `D78` was reported CLOSED
 * because its text QUOTES D57's closure, and `D57` was reported 0/3 because it
 * matched that day's `anchors/` items by name. A path the owner is meant to
 * rely on cannot rest on a parser that guesses.
 *
 * So the register carries a DELIMITED BLOCK of rows beside its prose, and this
 * module reads it. The prose is the argument and stays; the block is the map.
 *
 * ── WHAT THE BLOCK MAY CARRY, AND WHAT IT MUST NOT ─────────────────────────
 *
 * **Membership and a ruling. Never a count.** `D72 | open | readmodel/*` says
 * which plan the subject owns and that nobody has closed it. How many of its
 * items are done is DERIVED on every read, exactly as `readyReport` derives
 * readiness — because a recorded count is a second place for a fact to be
 * wrong, which is the defect this product exists to prevent.
 *
 * **And the status is a RULING, which is why it cannot be derived either.**
 * `D78`'s own row says so in as many words: *"THE SUBJECT CLOSES when a reader
 * opening a conversation can tell at a glance what was marked and why it was
 * worth marking — not when twelve items are done."* A subject whose every item
 * is done is a subject somebody should LOOK at; `dBoard` reports exactly that
 * and never decides it.
 *
 * ── WHY EVERY LINE INSIDE THE BLOCK MUST PARSE ─────────────────────────────
 *
 * A row that does not parse is a subject that has silently left the board, and
 * that is the whole failure this replaces. So the block is DELIMITED rather
 * than pattern-matched out of the prose: anything between the two sentinels is
 * a row or it is a defect, and `scripts/check-board.ts` fails naming the line.
 * A parser that skipped what it did not understand would rebuild the regex it
 * was written to replace.
 *
 * Everything here is PURE, the discipline the rest of this module keeps: the
 * caller supplies the body text and the items.
 * -------------------------------------------------------------------------- */

/** The sentinels. Anything between them is a row, or it is a defect. */
export const D_MAP_OPEN = '[D-MAP]';
export const D_MAP_CLOSE = '[END D-MAP]';

/**
 * The five words a row's status column may carry.
 *
 * `open` covers both "the register writes OPEN" and "the register records no
 * closure" — they are the same claim, and splitting them would put provenance
 * in a column somebody has to maintain by hand. `not-filed` is the row with no
 * plan work behind it at all, which is a real and common state for the early
 * numbers and must not be confused with a subject that has work and is
 * finished.
 */
export const D_STATUSES = ['open', 'closed', 'deferred', 'held-by-owner', 'not-filed'] as const;
export type DStatus = (typeof D_STATUSES)[number];

/**
 * One member of a subject, as written.
 *
 * `plan/*` is the whole plan and is preferred wherever a subject owns one,
 * because A PLAN GROWS: `D78` was minted over `plan:anchors seq:1-12` and the
 * plan held thirteen items two days later. A range written out by hand would
 * have silently stopped covering the subject. Where a subject owns scattered
 * items inside a plan that other subjects also draw from — `walk` is drawn on
 * by fourteen of them — the members are individual addresses.
 *
 * An item ID is admitted for the one case that has no address: `D57`'s work is
 * a REQUIREMENT, which declares no `plan` and no `seq`, and the register
 * records that in the owner's own ruling.
 */
export interface DMember {
  /** Exactly as written, so a finding can be grepped for. */
  raw: string;
  kind: 'plan' | 'task' | 'item';
  /** Lowercased plan name, for `plan` and `task`. */
  plan: string | null;
  /** Lowercased seq, for `task` only. */
  seq: string | null;
  /** The item id, for `item` only. */
  id: string | null;
}

export interface DRow {
  /** The number exactly as the register writes it — `66`, `13a/b`. */
  d: string;
  status: DStatus;
  members: DMember[];
  /** 1-based line within the body, so a finding can be found. */
  line: number;
}

/** A line inside the block that is not a row. */
export interface DMapDefect {
  line: number;
  text: string;
  why: string;
}

export interface DMapReading {
  /** Whether the block was found at all. A missing block is not an empty one. */
  found: boolean;
  rows: DRow[];
  /** Unparsed lines and duplicate numbers — everything that GATES. */
  defects: DMapDefect[];
}

/** `D66`, `D13a/b` — digits first, then whatever suffix the register uses. */
const D_ID = /^D([0-9]+[0-9a-z/]*)$/;
/** `swallow/*`. */
const MEMBER_PLAN = /^([a-z][a-z0-9_-]*)\/\*$/;
/** `walk/152`, `ui2/5r`. Both halves lowercase, for `REF_SHAPE`'s reason. */
const MEMBER_TASK = /^([a-z][a-z0-9_-]*)\/([a-z0-9][a-z0-9_-]*)$/;
/** `REQ-every-anchor-capability-…`, shaped as `ITEM_ID` (check-handover.ts). */
const MEMBER_ITEM = /^[A-Z][A-Z0-9]{1,9}-[a-z0-9][a-z0-9-]{3,}$/;

function parseMember(raw: string): DMember | string {
  const planOnly = MEMBER_PLAN.exec(raw);
  if (planOnly !== null) {
    return { raw, kind: 'plan', plan: planOnly[1]!.toLowerCase(), seq: null, id: null };
  }
  const task = MEMBER_TASK.exec(raw.toLowerCase());
  if (task !== null) {
    return { raw, kind: 'task', plan: task[1]!, seq: task[2]!, id: null };
  }
  if (MEMBER_ITEM.test(raw)) return { raw, kind: 'item', plan: null, seq: null, id: raw };
  return `"${raw}" is not plan/*, plan/seq or an item id`;
}

/**
 * Read the block out of an item body.
 *
 * Blank lines inside are skipped and NOTHING ELSE IS. A line that is not a row
 * becomes a defect carrying its own line number, because "the checker named
 * the row" is the property the whole design turns on.
 */
export function parseDMap(body: string): DMapReading {
  const lines = body.split(/\r?\n/);
  const rows: DRow[] = [];
  const defects: DMapDefect[] = [];
  let open = -1;
  let close = -1;
  for (const [i, line] of lines.entries()) {
    const text = line.trim();
    if (text === D_MAP_OPEN && open === -1) open = i;
    else if (text === D_MAP_CLOSE && open !== -1 && close === -1) close = i;
  }
  if (open === -1 || close === -1) return { found: false, rows, defects };

  const seen = new Map<string, number>();
  for (let i = open + 1; i < close; i++) {
    const text = lines[i]!.trim();
    const line = i + 1;
    if (text === '') continue;
    const cells = text.split('|').map((c) => c.trim());
    if (cells.length !== 3) {
      defects.push({ line, text, why: 'a row is three cells: D | status | members' });
      continue;
    }
    const id = D_ID.exec(cells[0]!);
    if (id === null) {
      defects.push({ line, text, why: `"${cells[0]}" is not a D number` });
      continue;
    }
    const status = cells[1]! as DStatus;
    if (!(D_STATUSES as readonly string[]).includes(status)) {
      defects.push({ line, text, why: `"${cells[1]}" is not one of ${D_STATUSES.join(', ')}` });
      continue;
    }
    const members: DMember[] = [];
    let bad = false;
    if (cells[2] !== '-') {
      for (const piece of cells[2]!.split(',')) {
        const entry = piece.trim();
        if (entry === '') continue;
        const member = parseMember(entry);
        if (typeof member === 'string') {
          defects.push({ line, text, why: member });
          bad = true;
          break;
        }
        members.push(member);
      }
    }
    if (bad) continue;
    const d = id[1]!;
    const first = seen.get(d);
    if (first !== undefined) {
      defects.push({ line, text, why: `D${d} is already a row at line ${first}` });
      continue;
    }
    seen.set(d, line);
    rows.push({ d, status, members, line });
  }
  return { found: true, rows, defects };
}

/** One subject, resolved against the corpus. Every number here is derived. */
export interface DSubject {
  row: DRow;
  /** Every work item the members name, de-duplicated. */
  items: WorkItem[];
  done: number;
  /** Open work under this subject, split exactly as `readyReport` splits it. */
  ready: ReadyRow[];
  held: HeldRow[];
}

/** A member naming nothing this corpus holds. Always a gate — see `dBoard`. */
export interface DMapUnresolved {
  d: string;
  line: number;
  member: string;
  why: string;
}

/** One item under two subjects. Always a gate — see `dBoard`. */
export interface DMapDoubleClaim {
  id: string;
  key: string | null;
  ds: string[];
}

export interface DBoard {
  subjects: DSubject[];
  unresolved: DMapUnresolved[];
  doubleClaimed: DMapDoubleClaim[];
  /** Open work items no row claims. Reported, never gated — see below. */
  orphans: WorkItem[];
}

/**
 * **What every subject is worth right now, computed on this run.**
 *
 * Three findings come out of here and the difference between them is the whole
 * of why this is not one list:
 *
 *   - **`unresolved`** — a member naming nothing. A subject pointing at work
 *     that does not exist cannot be dispatched, and it looks exactly like a
 *     subject with nothing left to do. It GATES.
 *   - **`doubleClaimed`** — one item under two subjects. Both rows then count
 *     it and the board's totals stop adding up, which is how a progress table
 *     starts lying while every individual row still looks right. It GATES.
 *   - **`orphans`** — open work no subject claims. REPORTED and never gated,
 *     because filing an item before its number is minted is ordinary and
 *     legitimate; what is not legitimate is nobody being told.
 *
 * **`readyReport` is called ONCE and its rows are distributed** rather than
 * readiness being re-decided per subject: two readings of "what can be
 * started" that could disagree is the defect this module's own header is
 * about.
 */
export function dBoard(reading: DMapReading, items: Item[], config: Config): DBoard {
  const index = buildTaskIndex(items, config);
  const byPlan = new Map<string, WorkItem[]>();
  for (const item of workItems(items, config)) {
    const plan = (item.extra[PLAN_FIELD] ?? '').trim().toLowerCase();
    if (plan === '') continue;
    const bucket = byPlan.get(plan);
    if (bucket === undefined) byPlan.set(plan, [item]);
    else bucket.push(item);
  }
  const byId = new Map<string, Item>();
  for (const item of items) byId.set(item.id, item);

  const report = readyReport(items, config);
  const readyOf = new Map<string, ReadyRow>();
  for (const row of report.ready) readyOf.set(row.item.id, row);
  const heldOf = new Map<string, HeldRow>();
  for (const row of report.held) heldOf.set(row.item.id, row);

  const unresolved: DMapUnresolved[] = [];
  const claimedBy = new Map<string, string[]>();
  const subjects: DSubject[] = [];

  for (const row of reading.rows) {
    const mine = new Map<string, WorkItem>();
    for (const member of row.members) {
      let hits: WorkItem[] = [];
      if (member.kind === 'plan') {
        hits = byPlan.get(member.plan!) ?? [];
        if (hits.length === 0) {
          unresolved.push({
            d: row.d, line: row.line, member: member.raw,
            why: 'no work item in this corpus carries that plan',
          });
        }
      } else if (member.kind === 'task') {
        hits = index.get(`${member.plan}/${member.seq}`) ?? [];
        if (hits.length === 0) {
          unresolved.push({
            d: row.d, line: row.line, member: member.raw,
            why: 'nothing in this corpus answers to that address',
          });
        }
      } else if (byId.get(member.id!) === undefined) {
        unresolved.push({
          d: row.d, line: row.line, member: member.raw, why: 'no item has that id',
        });
      }
      // An item-id member contributes NO work items even when it resolves, and
      // that is deliberate: `D57`'s requirement declares no `state`, so
      // counting it would make a finished subject read "0 of 1 done" forever.
      for (const hit of hits) mine.set(hit.id, hit);
    }
    const mineItems = [...mine.values()];
    for (const item of mineItems) {
      const owners = claimedBy.get(item.id);
      if (owners === undefined) claimedBy.set(item.id, [row.d]);
      else if (!owners.includes(row.d)) owners.push(row.d);
    }
    subjects.push({
      row,
      items: mineItems,
      done: mineItems.filter((i) => taskState(i) === DONE_STATE).length,
      ready: mineItems.map((i) => readyOf.get(i.id)).filter((r): r is ReadyRow => r !== undefined),
      held: mineItems.map((i) => heldOf.get(i.id)).filter((r): r is HeldRow => r !== undefined),
    });
  }

  const doubleClaimed: DMapDoubleClaim[] = [];
  for (const [id, ds] of claimedBy) {
    if (ds.length < 2) continue;
    const item = byId.get(id);
    doubleClaimed.push({
      id,
      key: item === undefined ? null : taskKey(item as WorkItem),
      ds: [...ds].sort(),
    });
  }
  doubleClaimed.sort((a, b) => a.id.localeCompare(b.id));

  const orphans = [...report.ready, ...report.held]
    .map((r) => r.item)
    .filter((i) => !claimedBy.has(i.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { subjects, unresolved, doubleClaimed, orphans };
}
