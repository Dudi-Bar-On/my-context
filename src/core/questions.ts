/**
 * **The open questions that stand between a reader and open work** —
 * `plan:governance seq:9`.
 *
 * ── THE DEFECT THIS ANSWERS ────────────────────────────────────────────────
 *
 * `mycontext ready` listed ready tasks and named what held every held one, and
 * it NEVER listed open questions. So a decision awaiting the owner sat in the
 * corpus with nothing putting it in front of him, and every decision that
 * reached him reached him because an assistant remembered to ask in
 * conversation — across a compaction, which is the one thing this product
 * exists because assistants do not do.
 *
 * ── WHY `ready` AND NOT THE REVIEW QUEUE, MEASURED 2026-09-11 ──────────────
 *
 * The owner asked whether the review queue could carry this, and it is a
 * better fit than it first looks: that queue exists to hold what a person must
 * LOOK AT and decide on. It was measured before being ruled out, and five
 * things settled it:
 *
 *  1. **`reviewQueue` (select.ts) is `status === 'draft' && layer ===
 *     'project'`, and an active question is not a draft.** It could only enter
 *     behind a SECOND predicate — which `cli/commands/todo.ts` already refused
 *     in these words: *"either a second predicate beside it — this project's
 *     most-repeated defect — or teaching the queue about tiers"*. The argument
 *     carries over unchanged; only the noun differs.
 *  2. **Widening it moves seven counts at once**, because it is deliberately
 *     the ONE definition: `buildIndex`'s SessionStart banner and
 *     `load_context`, `list_drafts` (mcp/tools.ts), `mycontext review`,
 *     `status --json`'s `reviewQueue` block, `propose`'s pending count, the
 *     status-line chip via `pendingReview`, and `pendingReviewFromIndex`'s SQL
 *     narrowing — which is spelled `WHERE status='draft' AND layer='project'`
 *     and would have gone on answering the old question in silence.
 *  3. **That queue holds nothing today.** Measured on this corpus 2026-09-11:
 *     `drafts: 0`, `revisions: 0`, and no `draft` item at all among 1,085.
 *     Eight active questions would not have joined a queue; they would have
 *     BECOME it, permanently, under a name that says drafts.
 *  4. **Its colour bands are measured from draft settle latencies** —
 *     `AGEING_DAYS = 1`, `STALE_DAYS = 10`, from n=2 promotions
 *     (`review/pending.ts`). A decision correctly awaiting the owner for a
 *     fortnight would have rendered as landfill.
 *  5. **The draft/active split already does the right thing, and this is the
 *     half most easily missed.** A DRAFT `open_question` is *"should this
 *     question govern at all"* — a promotion, and the review queue's business
 *     today. An ACTIVE one has already been accepted; what it awaits is an
 *     ANSWER. One category, two states, two surfaces. That is the existing
 *     design working rather than a gap in it.
 *
 * **So `ready` is canonical AND SOLE.** The task allowed that the honest answer
 * might be both, with `ready` naming a count and pointing at the queue. It is
 * not both: a count here and a list there is two lists that can disagree, and
 * this corpus has spent seven items on exactly that.
 *
 * ── AND WHY NOT `doctor`, WHICH ALREADY READS THIS FIELD ───────────────────
 *
 * The task recorded that `blocks` is *"read by nothing operational"*. That is
 * true of `ready.ts` and NOT true of the corpus: `checkOpenQuestionBlocks`
 * (doctor/checks.ts) has been reporting it since it was built, at `info`, with
 * its own docblock saying *"nowhere else surfaces it"*.
 *
 * **It is surfaced there and it did not work, and the measurement is
 * unusually clean.** On 2026-09-11 that check produced 7 findings inside a
 * 76-finding report, and ALL 7 WERE ACKNOWLEDGED — including the one blocking
 * `live/22`. Every reader who has ever met this population has said "stop
 * showing me this". `doctor` answers *"is my corpus healthy"*; a decision is
 * not a corpus defect, and an `info` finding among 76 is the 5,207-row audit
 * stream again.
 *
 * **So this report does not read acknowledgements**, and that is a ruling
 * rather than an omission. An ack records that *the wait is known*, which is
 * not an answer; honouring it here would have shipped a surface born empty on
 * the very corpus it was built for. A question leaves this report when the
 * work it names lands or when somebody answers it — never because it was
 * dismissed.
 *
 * ── WHICH QUESTIONS ARE LISTED, AND WHY NOT ALL OF THEM ────────────────────
 *
 * Only the ones whose `blocks` resolves to work that is still open. Everything
 * else active is COUNTED AND NAMED BY REASON, and `--questions` lists it.
 *
 * The task put this decision here rather than leaving it assumed, and warned
 * what the other answer costs: *"a queue that lists all seven every time
 * trains a reader to skip it, which is how the audit stream earned 5,207 rows
 * nobody read."* The acknowledgement measurement above is that warning already
 * having come true once on this exact population.
 *
 * **And "has a non-empty `blocks`" is NOT the filter**, though it is the
 * obvious one. `blocks: live/22` stays written after `live/22` lands, so that
 * test never falls quiet and the list only ever grows. Resolving the reference
 * does fall quiet — on the next run after the work lands, with nobody editing
 * anything. That is the property `ready` already refuses to give up: nothing
 * here is stored, and nothing here is kept by hand.
 *
 * ── ONE GRAMMAR, NOT TWO ───────────────────────────────────────────────────
 *
 * `blocks` is declared free text (`core/categories.ts`) and stays free text —
 * nothing about the field's contract changes, which is why its declaration is
 * untouched. What changed is that a `plan/seq` entry in it is now RESOLVED,
 * and it is resolved by `parseNeeds` and `refStatus` (core/needs.ts), the same
 * two functions `needs` uses, against the same `buildTaskIndex`. A second copy
 * of `REF_SHAPE` here would be the defect this whole file is filed under.
 * Anything that is not `plan/seq` is kept verbatim and reported as
 * `unparsed` — `parseNeeds`'s own `malformed` discipline, for its own reason:
 * an entry this product cannot read is the author saying something, in a
 * spelling nothing can act on, and dropping it would be
 * `INV-nothing-is-dropped-silently` with the invariant's own subject as the
 * victim.
 *
 * ── AND THE SECOND SPELLING, WHICH WAS MEASURED BEFORE IT WAS ADDED ────────
 *
 * `PROSE_REF` reads `plan:walk seq:89` out of a sentence. It is a SECOND
 * spelling of the same reference and every one of those is a liability, so it
 * is here on evidence rather than on tidiness. Measured on this corpus
 * 2026-09-11: five active questions carry a `blocks`, and only ONE is written
 * as `live/22`. The other four name their work in prose, in this notation —
 * which is the corpus's own: the task this file rests on uses it four times in
 * its own body (`plan:live seq:23`, `plan:archive seq:9`).
 *
 * What it is worth was measured too, and the number is the argument. Of the
 * four prose references, three name work that is DONE — `walk/96`,
 * `builder/7`, `port/14` — and one, `walk/89`, is still `todo`. So reading the
 * notation adds exactly ONE row to the list today and leaves the other three
 * quiet, which is the opposite of the flood a looser reading would have
 * caused. Without it this surface would have listed NOTHING on the corpus it
 * was built for, while a decision genuinely standing in front of open work sat
 * in it — the defect, rebuilt inside its own fix.
 *
 * **It is deliberately narrow.** Both halves must be present, adjacent and in
 * order; `plan:` alone is not a reference, and the shapes are `REF_SHAPE`'s
 * own two halves. A false positive costs one extra row on a list a person
 * reads; a false negative costs the whole feature, and that asymmetry is why
 * the cheap direction is the one this errs in.
 *
 * Nothing in this file writes.
 */
import type { Config } from './config.ts';
import {
  buildTaskIndex, isWorkCategory, parseNeeds, refStatus,
} from './needs.ts';
import { RETIRED_STATUSES } from './select.ts';
import type { Item } from './types.ts';

/**
 * The field an `open_question` uses to name what waits on it.
 *
 * Spelled once, here, for the reason `NEEDS_FIELD` is spelled once in
 * `needs.ts`: the doctor check, this report and the category declaration all
 * name the same string, and a literal in three places is three chances to
 * rename two of them.
 */
export const BLOCKS_FIELD = 'blocks';

/**
 * A `plan:<plan> seq:<seq>` reference written into a sentence — see the
 * header for the measurement that put it here and for why it is this narrow.
 *
 * The two capture shapes are `REF_SHAPE`'s own halves (`needs.ts`), spelled
 * again here ONLY because that constant is one anchored pattern over a joined
 * `plan/seq` and cannot be reused to scan a sentence. Everything the two
 * spellings produce is a `plan/seq` string resolved by the SAME `refStatus`
 * against the SAME index, so there is one resolver and no second grammar of
 * readiness — which is the part that would actually have mattered.
 */
const PROSE_REF = /\bplan:\s*([a-z][a-z0-9_-]*)\s+seq:\s*([a-z0-9][a-z0-9_-]*)/gi;

/**
 * Does this category's items ask a question that work can wait on?
 *
 * Asked of the CONFIG and not of the name `open_question`, for exactly
 * `isWorkCategory`'s reason: a report keyed on a shipped spelling prints
 * "nothing is waiting" in a project that calls the same idea something else,
 * and says it in the confident voice of a measurement.
 *
 * `Object.hasOwn` rather than a bare index, for the prototype hazard
 * `isWorkCategory` documents — a category literally named `constructor` must
 * answer false here rather than reaching `Object.prototype`.
 *
 * **A category that plans work is work, whatever else it declares.** The
 * ruling this file rests on is that *a question is not a task and must not be
 * drawn as one*; an item carrying a `seq` is scheduled, and scheduling it in
 * one report while listing it as an unanswered question in another would be
 * two answers about one item from one command.
 *
 * A DISABLED category asks nothing, the same clause and the same reason
 * `isWorkCategory` carries: offering a reader something the project's own
 * tools will not capture is worse than silence.
 */
export function isQuestionCategory(config: Config, type: string): boolean {
  if (!Object.hasOwn(config.categories, type)) return false;
  const category = config.categories[type];
  if (!category.enabled) return false;
  if (isWorkCategory(config, type)) return false;
  return category.extraFields.includes(BLOCKS_FIELD);
}

/**
 * Why a question is, or is not, standing between the reader and open work.
 *
 * Five values and not a boolean, for `HeldReason`'s reason: "not listed" is
 * four different facts about the corpus, and collapsing them would tell a
 * reader their question was quiet without telling them it was quiet because
 * nobody could read what it said.
 */
export type QuestionReason =
  /** `blocks` names work that is open. The one that is LISTED. */
  | 'blocking'
  /** Every `plan/seq` it names is done — the wait is over, and nobody edited it. */
  | 'landed'
  /** It names `plan/seq` that nothing in this corpus answers to. */
  | 'unresolved'
  /** Its `blocks` says something, in a spelling this report cannot resolve. */
  | 'unparsed'
  /** It names nothing it blocks. */
  | 'unstated';

/** One question, read against the corpus. */
export interface QuestionRow {
  item: Item;
  reason: QuestionReason;
  /** `blocks` verbatim and trimmed; `''` when the field is absent or empty. */
  blocks: string;
  /** Well-shaped `plan/seq` entries whose targets are not all done. */
  pending: string[];
  /** Well-shaped entries nothing in the corpus answers to. */
  unresolved: string[];
  /** Entries that are not `plan/seq`, verbatim as written. */
  unparsed: string[];
}

/**
 * The split, computed once so that no two surfaces can draw it differently.
 *
 * `ready`'s table, its disclosure and its `--json` all read THESE two arrays
 * rather than each filtering `rows` by reason. The task's hard constraint is
 * that what must not happen is two lists that can disagree; two filters over
 * one array is that hazard with a shorter fuse.
 */
export interface QuestionReport {
  /** Listed: the questions standing between the reader and open work. */
  blocking: QuestionRow[];
  /** Counted and named; reachable with `--questions`. */
  quiet: QuestionRow[];
}

/**
 * Read one question against the task index.
 *
 * The precedence is the order a reader would ask the questions in, and the
 * first clause is the one that matters: if ANY well-shaped reference is still
 * open, the question is blocking, whatever else the field also says. A
 * `blocks` reading `live/22, and the thing about the pane` is a live
 * dependency with a note attached, not an unreadable field.
 */
export function readQuestion(item: Item, index: Map<string, Item[]>): QuestionRow {
  const blocks = (item.extra[BLOCKS_FIELD] ?? '').trim();
  const { refs, malformed } = parseNeeds(blocks === '' ? undefined : blocks);

  // The prose spelling, folded in beside the `plan/seq` one. Appended rather
  // than merged in place so that a field written in both spellings keeps the
  // well-shaped entries first, which is the order `needs` lists them in.
  for (const match of blocks.matchAll(PROSE_REF)) {
    const ref = `${match[1]}/${match[2]}`.toLowerCase();
    if (!refs.includes(ref)) refs.push(ref);
  }
  // An entry reported as unreadable must really be unreadable: a comma-piece
  // that the prose reader DID get a reference out of is not, and naming it
  // would send a reader to fix a spelling this product just acted on.
  // `matchAll` and not `test`: `PROSE_REF` is global, so `test` would carry
  // `lastIndex` from one entry to the next and answer differently on the
  // second call with the same input. `matchAll` clones the regex by spec.
  const unparsed = malformed.filter((entry) => [...entry.matchAll(PROSE_REF)].length === 0);

  const pending: string[] = [];
  const unresolved: string[] = [];
  for (const ref of refs) {
    const status = refStatus(ref, index);
    if (status === 'pending') pending.push(ref);
    else if (status === 'unresolved') unresolved.push(ref);
  }

  let reason: QuestionReason;
  if (blocks === '') reason = 'unstated';
  else if (pending.length > 0) reason = 'blocking';
  else if (refs.length === 0) reason = 'unparsed';
  else if (unresolved.length > 0) reason = 'unresolved';
  else reason = 'landed';

  return { item, reason, blocks, pending, unresolved, unparsed };
}

/**
 * Every question this corpus is still holding, split into what is listed and
 * what is counted.
 *
 * **Retired questions are excluded through `RETIRED_STATUSES`** — the one
 * definition — rather than by naming statuses here. A settled question's
 * `blocks` is history, and repeating it would be the stale noise this surface
 * exists to replace. (`checkOpenQuestionBlocks` skips only `superseded` and so
 * still reports two `deprecated` questions on this corpus; that is its bug to
 * fix, and this report must not inherit it by copying the clause.)
 *
 * **Drafts are excluded too, and that is the boundary the whole design rests
 * on**: a draft question is awaiting a PROMOTION, which is `reviewQueue`'s
 * question and is already answered there. Spelled as "not retired and not
 * draft" rather than as `=== 'active'` so that a sixth `Status` lands here as
 * a decision somebody makes rather than as a silent exclusion.
 *
 * Ordered by id, the order every other listing in this product uses, and for
 * the reason `reviewQueue` gives for ordering nothing: determinism is the
 * caller's to spend, and there is no priority on a question to spend it on.
 */
export function questionReport(items: Item[], config: Config): QuestionReport {
  const index = buildTaskIndex(items, config);
  const blocking: QuestionRow[] = [];
  const quiet: QuestionRow[] = [];
  for (const item of items) {
    if (!isQuestionCategory(config, item.type)) continue;
    if (RETIRED_STATUSES.has(item.status) || item.status === 'draft') continue;
    const row = readQuestion(item, index);
    (row.reason === 'blocking' ? blocking : quiet).push(row);
  }
  const byId = (a: QuestionRow, b: QuestionRow): number => a.item.id.localeCompare(b.item.id);
  return { blocking: blocking.sort(byId), quiet: quiet.sort(byId) };
}
