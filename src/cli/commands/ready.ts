import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  isWorkCategory, NEEDS_FIELD, PLAN_FIELD, readyReport, SEQ_FIELD, STATE_FIELD,
  type HeldRow, type ReadyRow,
} from '../../core/needs.ts';
import type { LoadError } from '../../core/rebuild.ts';
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

const USAGE = `usage: mycontext ready [--plan <plan>] [--held] [--limit <n>] ${DETAIL_USAGE}

Open work whose \`${NEEDS_FIELD}\` are all done, highest priority first. Held work is
counted by reason on every level and listed with --held.`;

/** The row cap, and it is `todo`'s reason: this prints a table to a terminal,
 * and a hundred-row answer to "what can I start" is not an answer. A
 * truncation is always reported. */
const DEFAULT_LIMIT = 50;

const HEADERS = ['task', 'pri', 'state', 'title'];
const FULL_HEADERS = ['id', 'task', 'pri', 'state', NEEDS_FIELD, 'title'];
const HELD_HEADERS = ['task', 'pri', 'state', 'held by', 'title'];

/** One line a person reads about why a row is held, in the field's own terms. */
const HELD_REASON: Record<HeldRow['reason'], string> = {
  pending: 'a blocker has not landed',
  unresolved: 'names a task this corpus does not have',
  malformed: `an unreadable "${NEEDS_FIELD}" entry`,
  blocked_without_needs: 'says blocked and names nothing',
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
  let plan: string | null;
  let limit: number;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
    // `hasFlag`, so `--held=false` means false and `--held=maybe` is refused
    // rather than resolved to either answer — see `boolFlag` (registry.ts).
    showHeld = hasFlag(args, 'held');
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
