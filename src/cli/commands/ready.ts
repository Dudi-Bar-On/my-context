import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  isWorkCategory, NEEDS_FIELD, PLAN_FIELD, readyReport, SEQ_FIELD, STATE_FIELD,
  type HeldRow, type ReadyRow,
} from '../../core/needs.ts';
import type { LoadError } from '../../core/rebuild.ts';
import {
  BLOCKS_FIELD, questionReport, type QuestionReason, type QuestionRow,
} from '../../core/questions.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, type Detail, detailLevel, emitJson, paragraph, records,
  refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext ready` — **what can be started right now.**
 *
 * The artefact that makes `needs` pay for itself. Without it the field is a
 * place to write dependencies down; with it, the question "what is runnable"
 * is answered by reading the corpus rather than by a person re-deriving it —
 * and the re-derivation is what failed: `plan:walk seq:8` sat at `blocked`
 * after `seq:7` landed, and `plan:port seq:6` and `plan:walk seq:14` were
 * freed by the same landing with nothing saying so.
 *
 * **Nothing here is stored.** Readiness is `needs` plus the states of what
 * `needs` names, computed on every run by `readyReport` (core/needs.ts). There
 * is deliberately no `ready` state and there must not be one: it would be a
 * second copy of a fact, and the two disagree the first time one of them is
 * updated alone. This corpus has already paid that bill once — thirteen tasks
 * whose `state` tag and `state` field said different things.
 *
 * **It prints what it left out.** Every open work item is either ready or
 * held, and the held ones are counted by reason on every path and listed with
 * `--held`. A "what can I start" list that quietly omitted the rest would be
 * precise about the wrong corpus, which is the failure
 * `STD-the-progress-table-has-one-format-and-this-is-it` names.
 *
 * Nothing in this file writes.
 */

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.ready;

const USAGE =
  `usage: mycontext ready [--plan <plan>] [--held] [--questions] [--limit <n>] ${DETAIL_USAGE}

Open work whose \`${NEEDS_FIELD}\` are all done, highest priority first. Held work is
counted by reason on every level and listed with --held. Open questions standing in
front of open work are listed; the rest are counted and listed with --questions.`;

/** The row cap, and it is `todo`'s reason: this prints a table to a terminal,
 * and a hundred-row answer to "what can I start" is not an answer. A
 * truncation is always reported. */
const DEFAULT_LIMIT = 50;

const HEADERS = ['task', 'pri', 'state', 'title'];
const FULL_HEADERS = ['id', 'task', 'pri', 'state', NEEDS_FIELD, 'title'];
const HELD_HEADERS = ['task', 'pri', 'state', 'held by', 'title'];

/**
 * **A question's columns, and there is no `task`, `pri` or `state` among
 * them.** The ruling this block rests on is that *a question is not a task and
 * must not be drawn as one* — it has no `seq`, nothing depends on its
 * completion, and it is finished by an ANSWER. Sharing `HEADERS` would have
 * printed `(no plan/seq)` in a task column for every row, which is a report
 * saying a question is a badly-filled-in task.
 */
const QUESTION_HEADERS = ['question', 'blocks', 'title'];
const QUESTION_FULL_HEADERS = ['question', 'blocks', 'why', 'title'];

/** One line a person reads about why a row is held, in the field's own terms. */
const HELD_REASON: Record<HeldRow['reason'], string> = {
  pending: 'a blocker has not landed',
  unresolved: 'names a task this corpus does not have',
  malformed: `an unreadable "${NEEDS_FIELD}" entry`,
  blocked_without_needs: 'says blocked and names nothing',
};

/**
 * Why a question is listed, or is only counted — in the field's own terms, the
 * way `HELD_REASON` names a held row's.
 *
 * `blocking` is here for `--questions`, which lists every question side by
 * side and would otherwise be the one table in this report whose rows do not
 * say why they are there.
 */
const QUESTION_REASON: Record<QuestionReason, string> = {
  blocking: 'naming open work',
  landed: 'naming work that is already done',
  unresolved: 'naming work this corpus does not have',
  unparsed: 'naming what it blocks in prose this report cannot resolve',
  unstated: 'naming nothing it blocks',
};

function say(out: Emit, text: string): void {
  for (const line of paragraph(text)) out(line);
}

function taskCell(item: Item): string {
  const plan = item.extra[PLAN_FIELD] ?? '';
  const seq = item.extra[SEQ_FIELD] ?? '';
  return plan === '' || seq === '' ? '(no plan/seq)' : `${plan}/${seq}`;
}

/**
 * `(none)` rather than an empty cell, for the reason `tagCell` (todo.ts)
 * gives: at `--full` the value is a labelled line of its own, and a blank
 * there reads as a field that failed to load rather than one that is empty.
 */
function needsCell(row: ReadyRow): string {
  const all = [
    ...row.reading.satisfied, ...row.reading.pending, ...row.reading.unresolved,
    ...row.reading.malformed,
  ];
  return all.length > 0 ? all.join(', ') : '(none)';
}

function readyCells(row: ReadyRow, detail: Detail): string[] {
  const item = row.item;
  const pri = item.extra.priority ?? '';
  return detail === 'full'
    ? [item.id, taskCell(item), pri, row.reading.state, needsCell(row), item.title]
    : [taskCell(item), pri, row.reading.state, item.title];
}

function heldCells(row: HeldRow): string[] {
  return [
    taskCell(row.item), row.item.extra.priority ?? '', row.reading.state,
    HELD_REASON[row.reason], row.item.title,
  ];
}

/**
 * A question's cells. The `blocks` column shows the still-open references when
 * there are any and the raw field otherwise — a reader looking at a blocking
 * row wants the reference they can act on, not the sentence it was buried in.
 *
 * `(none)` rather than a blank, for `needsCell`'s reason: at `--full` the
 * value is a labelled line of its own, and an empty one reads as a field that
 * failed to load rather than one that is empty.
 */
function questionCells(row: QuestionRow, detail: Detail): string[] {
  const blocks = row.pending.length > 0
    ? row.pending.join(', ')
    : (row.blocks === '' ? '(none)' : row.blocks);
  return detail === 'full'
    ? [row.item.id, blocks, QUESTION_REASON[row.reason], row.item.title]
    : [row.item.id, blocks, row.item.title];
}

/**
 * One question, as JSON. `blocks` is the raw field and `null` when unstated —
 * never `''`, so a reader can tell "the author wrote nothing" from "the author
 * wrote something this report could not resolve", which is the distinction the
 * two reasons below it are built on.
 */
function questionJson(row: QuestionRow): Record<string, unknown> {
  return {
    id: row.item.id, title: row.item.title, type: row.item.type,
    reason: row.reason,
    [BLOCKS_FIELD]: row.blocks === '' ? null : row.blocks,
    pending: row.pending, unresolved: row.unresolved, unparsed: row.unparsed,
  };
}

function cmdReady(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before anything is opened or printed, the gate-above-the-output
  // ordering `cmdTodo` carries the incident report for.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let detail: Detail;
  let json: boolean;
  let showHeld: boolean;
  let showQuestions: boolean;
  let plan: string | null;
  let limit: number;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
    // `hasFlag`, so `--held=false` means false and `--held=maybe` is refused
    // rather than resolved to either answer — see `boolFlag` (registry.ts).
    showHeld = hasFlag(args, 'held');
    showQuestions = hasFlag(args, 'questions');
    plan = flag(args, 'plan');
    const rawLimit = flag(args, 'limit');
    if (rawLimit === null) {
      limit = DEFAULT_LIMIT;
    } else {
      limit = Number(rawLimit);
      if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
        say(out, 'my_context: --limit takes a positive whole number ' +
          `(got ${JSON.stringify(rawLimit)}).`);
        return 1;
      }
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  const corpus = ctx.store.all();
  ctx.store.close();

  /**
   * Which categories this report is about, resolved rather than assumed.
   *
   * `task` ships in the catalogue (2026-09-02) and was a CUSTOM category before
   * that, which is why this is not keyed on the NAME: a report that looked for
   * `task` would print "nothing is ready" in a project that calls the same idea
   * `story`, which is the accepted-and-ignored answer this corpus rules out,
   * and it would still do so now that one spelling happens to be shipped.
   * `isWorkCategory` asks for the three fields the report actually needs, and
   * for the category being switched on.
   */
  const workCategories = Object.keys(ws.config.categories)
    .filter((name) => isWorkCategory(ws.config, name))
    .sort();

  const report = readyReport(corpus, ws.config);
  const inPlan = (row: ReadyRow): boolean =>
    plan === null || (row.item.extra[PLAN_FIELD] ?? '').toLowerCase() === plan.toLowerCase();
  const ready = report.ready.filter(inPlan);
  const held = report.held.filter(inPlan);
  const shown = ready.slice(0, limit);
  const truncated = ready.length > shown.length;

  const heldByReason = new Map<HeldRow['reason'], number>();
  for (const row of held) heldByReason.set(row.reason, (heldByReason.get(row.reason) ?? 0) + 1);

  /**
   * **The open questions, derived on this run exactly as readiness is.**
   *
   * `core/questions.ts` carries the whole ruling — why this surface and not the
   * review queue, why not every active question, and why an acknowledgement
   * does not silence one. Nothing here re-decides any of it; this block only
   * draws what that module split.
   *
   * **`--plan` narrows the questions through the work they name, not through a
   * field of their own.** A question has no `plan` — that is the refusal this
   * whole item began with — so the only honest reading of "questions in plan
   * X" is "questions naming open work in plan X", and it is computed from the
   * reference rather than stored. The QUIET ones are then left out entirely
   * under `--plan`, and the disclosure says so rather than letting a narrowed
   * report imply this corpus has no other questions: a question that names
   * nothing, or names it in prose, belongs to no plan and cannot be attributed
   * to one without inventing the attribution.
   */
  const questions = questionReport(corpus, ws.config);
  const inQuestionPlan = (row: QuestionRow): boolean =>
    plan === null || row.pending.some((ref) => ref.split('/')[0] === plan.toLowerCase());
  const blocking = questions.blocking.filter(inQuestionPlan);
  const quiet = plan === null ? questions.quiet : [];
  const quietByReason = new Map<QuestionReason, number>();
  for (const row of quiet) quietByReason.set(row.reason, (quietByReason.get(row.reason) ?? 0) + 1);

  if (json) {
    emitJson(out, {
      ready: shown.map((r) => ({
        id: r.item.id, title: r.item.title, type: r.item.type,
        plan: r.item.extra[PLAN_FIELD] ?? null, seq: r.item.extra[SEQ_FIELD] ?? null,
        priority: r.item.extra.priority ?? null, state: r.reading.state,
        needs: r.reading.satisfied,
      })),
      held: held.map((r) => ({
        id: r.item.id, title: r.item.title, type: r.item.type,
        plan: r.item.extra[PLAN_FIELD] ?? null, seq: r.item.extra[SEQ_FIELD] ?? null,
        priority: r.item.extra.priority ?? null, state: r.reading.state,
        reason: r.reason,
        satisfied: r.reading.satisfied, pending: r.reading.pending,
        unresolved: r.reading.unresolved, malformed: r.reading.malformed,
      })),
      /**
       * The questions, from the SAME two arrays the text draws. A machine
       * reader and a person get one split, because the one thing this item
       * forbids is two lists that can disagree.
       *
       * `open` below is deliberately NOT widened to include them: it counts
       * open TASKS, and a question is answered rather than worked.
       */
      questions: {
        blocking: blocking.map((q) => questionJson(q)),
        quiet: quiet.map((q) => questionJson(q)),
        blockingTotal: blocking.length,
        quietTotal: quiet.length,
      },
      count: shown.length,
      readyTotal: ready.length,
      heldTotal: held.length,
      open: ready.length + held.length,
      truncated,
      limit,
      plan,
      // The categories this answer is ABOUT, so a machine reader does not have
      // to guess whether an empty list means "nothing is ready" or "this
      // project declares no category that plans work".
      workCategories,
      loadErrors: errors.map((e: LoadError) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  /**
   * Everything the reader must be told on EVERY path, empty list included, in
   * one place so the two cannot disclose different things.
   */
  const disclose = (): void => {
    const blocks: string[] = [];
    // `--summary` prints no rows, so it cannot have truncated any: reporting a
    // cap that did not apply would send a reader to raise a limit that is not
    // hiding anything from them.
    if (truncated && detail !== 'summary') {
      blocks.push(`${ready.length} ready; ${shown.length} shown. Raise the cap with ` +
        `--limit ${ready.length}, or narrow it with --plan.`);
    }
    if (held.length > 0) {
      const by = [...heldByReason]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([reason, n]) => `${n} ${HELD_REASON[reason]}`)
        .join(', ');
      blocks.push(`${held.length} open task(s) held and not listed above: ${by}. ` +
        '`mycontext ready --held` lists them.');
    }
    /**
     * **The question count, on EVERY path including `--summary`.** That is the
     * point of the whole item: a decision waiting on a person must not depend
     * on the reader having chosen the detail level that happens to draw it.
     */
    if (blocking.length > 0) {
      blocks.push(`${blocking.length} open question(s) stand between this list and open work` +
        (plan === null ? '' : ` in plan "${plan}"`) +
        '. A question is finished by an ANSWER, not by work: it carries no `' + SEQ_FIELD +
        '`, nothing waits on its completion, and it leaves this report when somebody answers ' +
        'it or when the work it names lands.');
    }
    if (quiet.length > 0) {
      const by = [...quietByReason]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([reason, n]) => `${n} ${QUESTION_REASON[reason]}`)
        .join(', ');
      blocks.push(`${quiet.length} active open question(s) not listed above: ${by}. ` +
        'They are not in front of open work, so they are counted rather than listed — a list ' +
        'that showed every question every time would train a reader to skip it. ' +
        '`mycontext ready --questions` lists them.');
    }
    /**
     * **What `--plan` narrowed away, counted rather than dropped.**
     *
     * Two populations end up here and both have to be counted, which is the
     * bug this paragraph was rewritten to fix: the questions naming open work
     * in some OTHER plan are absent from `blocking` (narrowed out) AND from
     * `quiet` (they are not quiet), so counting only `quiet` left them
     * mentioned nowhere at all — `INV-nothing-is-dropped-silently`, breached
     * by the narrowing rather than by the report.
     */
    const narrowed = plan === null
      ? 0
      : (questions.blocking.length - blocking.length) + questions.quiet.length;
    if (narrowed > 0) {
      blocks.push(`${narrowed} further open question(s) are not counted above: none of them ` +
        `names open work in plan "${plan}", and a question carries no plan of its own, so a ` +
        'narrowed report cannot honestly attribute them to this one. ' +
        '`mycontext ready --questions` without `--plan` lists them.');
    }
    blocks.push(
      'Readiness is derived on every run from `' + NEEDS_FIELD + '` and the `' + STATE_FIELD +
      '` of what it names — it is stored nowhere and there is no `ready` state to go stale. ' +
      'A task with no `' + NEEDS_FIELD + '` is ready here because nothing in the corpus says ' +
      'otherwise, which is a statement about the corpus and not a promise about the work: ' +
      'a dependency that was only ever written in prose is invisible to this report. ' +
      '`mycontext doctor` reports the blocked tasks that name nothing.',
    );
    for (const [i, text] of blocks.entries()) {
      if (i > 0) out('');
      say(out, text);
    }
  };

  if (workCategories.length === 0) {
    // Never a bare empty list here: "nothing is ready" and "no category in
    // this project plans work" are different answers, and printing the first
    // for the second is the silent-empty-answer failure `list` and `search`
    // were both fixed for.
    say(out, `my_context: no ENABLED category in this project declares "${PLAN_FIELD}", ` +
      `"${SEQ_FIELD}" and "${STATE_FIELD}", so there is no planned work to order. The shipped ` +
      `"task" category declares all four; if this project switched it off, ` +
      `categories.task.enabled in .my_context/config.json is the switch. A category of your ` +
      `own that plans work declares those three in categories.<name>.extraFields there, plus ` +
      `"${NEEDS_FIELD}" for the dependency this report reads.`);
    emitLoadErrors(errors, out);
    return 0;
  }

  if (detail === 'summary') {
    const rows: string[][] = [['ready', String(ready.length)]];
    for (const [reason, n] of [...heldByReason].sort((a, b) => a[0].localeCompare(b[0]))) {
      rows.push([`held: ${HELD_REASON[reason]}`, String(n)]);
    }
    for (const line of table(['group', 'tasks'], rows)) out(line);
    out('');
    out(`${ready.length + held.length} open task(s)`);
    out('');
    disclose();
    emitLoadErrors(errors, out);
    return 0;
  }

  if (shown.length === 0) {
    out(plan === null
      ? 'my_context: no task is ready to start.'
      : `my_context: no task in plan "${plan}" is ready to start.`);
    out('');
  } else {
    const rendered = detail === 'full'
      ? records(FULL_HEADERS, shown.map((r) => readyCells(r, detail)))
      : table(HEADERS, shown.map((r) => readyCells(r, detail)));
    for (const line of rendered) out(line);
    out('');
    out(`${ready.length} ready of ${ready.length + held.length} open task(s)`);
    out('');
  }

  /**
   * The questions, in a table of their own and ABOVE the held rows.
   *
   * Above, because the reader this report is for is asking "what now" and an
   * unanswered decision is the one thing on this screen they can clear without
   * writing any code. Its own table, because a question is not a task — see
   * `QUESTION_HEADERS`.
   *
   * `--questions` widens the table to every active question rather than
   * printing a second one: two tables of the same thing is the two-lists
   * hazard this item exists to avoid, at the smallest possible scale.
   */
  const drawn = showQuestions ? [...blocking, ...quiet] : blocking;
  if (drawn.length > 0) {
    /**
     * **`--questions` renders as RECORDS, not as a table, and it is the same
     * arithmetic `records` was written for.** A blocking row's `blocks` cell
     * is the resolved references and is short; a QUIET row's is the raw field,
     * and on this corpus that is 110 characters of prose beside a 66-character
     * id and a 130-character title. Measured 2026-09-11: as a table that is
     * 1,095 columns wide — `list --full`'s 280-column defect, four times over,
     * on the one level that exists to show the most.
     */
    const asRecords = detail === 'full' || showQuestions;
    const headers = asRecords ? QUESTION_FULL_HEADERS : QUESTION_HEADERS;
    const cells = drawn.map((r) => questionCells(r, asRecords ? 'full' : detail));
    for (const line of (asRecords ? records(headers, cells) : table(headers, cells))) out(line);
    out('');
  }

  if (showHeld && held.length > 0) {
    for (const line of table(HELD_HEADERS, held.map(heldCells))) out(line);
    out('');
  }

  disclose();

  // F2: this command did what it was asked, so an unrelated corpus load error
  // is a warning and not a failure — the rule `search`, `list`, `decay` and
  // `todo` already follow, and the reason `emitLoadErrors` is called on every
  // path above.
  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'ready',
  usage: `ready [--plan <p>] [--held] [--limit <n>] ${DETAIL_USAGE}`,
  summary: 'open tasks whose needs are all done, highest priority first',
  run: (ws, args, out) => cmdReady(ws, args, out),
});
