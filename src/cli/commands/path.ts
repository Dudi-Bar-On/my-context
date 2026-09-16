import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  dBoard, parseDMap, taskKey,
  type DSubject, type HeldRow, type ReadyRow, type WorkItem,
} from '../../core/needs.ts';
import { questionReport, type QuestionRow } from '../../core/questions.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, type Detail, detailLevel, emitJson, paragraph, records,
  refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, registerCommand, type Emit } from './registry.ts';

/**
 * **`mycontext path` — per SUBJECT: what is done, what can be started, what is
 * blocked, and what is waiting on YOU.**
 *
 * The owner's request, 2026-09-16: *"a mechanism that will make all of them be
 * dispatched, progress tracked and 100% completed so i could use it as a
 * reliable path to complete all currently known opened Ds."* This is the
 * reading half. `mycontext ready` answers "what can I start" over the whole
 * corpus; nothing answered "where is D72 up to", and the tables that tried
 * were regexes over the register's prose — two of their rows were wrong on the
 * day this was written.
 *
 * ── NOTHING HERE IS STORED, AND THAT IS THE CONSTRAINT, NOT A DETAIL ───────
 *
 * `ready`'s header says it for readiness and every word carries over: *"There
 * is deliberately no `ready` state and there must not be one: it would be a
 * second copy of a fact, and the two disagree the first time one of them is
 * updated alone."* Every number below is computed on this run from the
 * register's `[D-MAP]` block plus the states of the items it names. There is
 * no progress file, and a file that recorded progress would be the defect this
 * product exists to prevent.
 *
 * The ONE thing read rather than derived is MEMBERSHIP — which plan a subject
 * owns — because that is an assignment a person made and nothing can compute
 * it. And the row's `status`, because a subject closes on a JUDGEMENT: `D78`'s
 * own row says *"THE SUBJECT CLOSES when a reader opening a conversation can
 * tell at a glance what was marked and why it was worth marking — not when
 * twelve items are done."*
 *
 * ── THE FOURTH COLUMN IS THE WHOLE POINT ──────────────────────────────────
 *
 * Done, ready and blocked are what `ready` already knows. **YOURS** is the
 * category no command could see, and it is the difference between a list and a
 * path: three things are waiting on the owner right now and every report he
 * has been shown draws them as ordinary open work, so every one of those
 * reports offers him work he has already decided to defer.
 *
 * It is derived from two things the corpus already holds, and NEITHER is a new
 * field:
 *
 *   - **a subject whose row reads `held-by-owner`** — D67, held by his own
 *     ruling that the instrument was wrong more often than the paint;
 *   - **an item an open question names in its `blocks`** — which is exactly
 *     what `core/questions.ts` computes for `ready`, pointed at a subject
 *     instead of at the whole corpus. A decision waiting on a person IS an
 *     open question in this corpus's own vocabulary, and inventing a second
 *     notation for it would be the two-places-for-one-fact failure again.
 *
 * So the way to put something in this column is to file the question, which is
 * a thing the owner can then ANSWER — and the answer takes it out of the
 * column with nobody editing a status anywhere.
 *
 * ── WHAT 100% CAN AND CANNOT MEAN ─────────────────────────────────────────
 *
 * The honest version of the request is **a path where every remaining step is
 * either dispatchable or named as his** — not a promise that every subject
 * closes. The last line of this report says so on every run, because a
 * mechanism that hid that distinction would be telling him what he wants to
 * hear.
 *
 * Nothing in this file writes.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.path;

/** The register that carries the map. Overridable so a test can plant one. */
export const DEFAULT_REGISTER = 'REF-the-d-numbers-what-each-one-means-and-which-are-only';

const USAGE =
  `usage: mycontext path [--d <number>] [--all] [--register <id>] ${DETAIL_USAGE}

Per subject: how many of its items are done, which are ready now, which are held
by a blocker that has not landed, and which are waiting on YOU. Every number is
derived on this run. --all includes the subjects with no open work.`;

const HEADERS = ['D', 'status', 'done', 'ready', 'held', 'yours', 'work'];
const FULL_HEADERS = ['D', 'status', 'done', 'ready', 'held', 'yours', 'work', 'members'];

/** One subject plus the two things the board cannot see on its own. */
interface Row {
  subject: DSubject;
  /** Open items under this subject that an open question names. */
  questioned: Array<{ item: WorkItem; question: QuestionRow }>;
  /** `held-by-owner` on the row itself. */
  heldByOwner: boolean;
}

function say(out: Emit, text: string): void {
  for (const line of paragraph(text)) out(line);
}

/** `readmodel/2` — the address a lane is dispatched by, never the id. */
function addr(item: Item): string {
  return taskKey(item as WorkItem) ?? item.id;
}

/**
 * The `work` cell: the plan names this subject draws on, de-duplicated.
 *
 * Plan names rather than the raw member list, because this column answers "what
 * do I type after `--plan`". The members themselves are a `--full` line, where
 * there is room for `walk/152, walk/153, …` without pushing every other column
 * off a terminal.
 */
function workCell(subject: DSubject): string {
  const plans = new Set<string>();
  for (const item of subject.items) {
    const key = taskKey(item);
    if (key !== null) plans.add(key.split('/')[0]!);
  }
  if (plans.size > 0) return [...plans].sort().join(', ');
  // A subject can legitimately have no work items: `not-filed`, or D57 whose
  // one member is a requirement. Those are different from "a plan with none".
  return subject.row.members.length === 0 ? '(none filed)' : '(no task items)';
}

function cells(row: Row, detail: Detail): string[] {
  const s = row.subject;
  const base = [
    `D${s.row.d}`,
    s.row.status,
    s.items.length === 0 ? '-' : `${s.done}/${s.items.length}`,
    String(s.ready.length),
    String(s.held.length),
    String(row.questioned.length + (row.heldByOwner ? 1 : 0)),
    workCell(s),
  ];
  return detail === 'full'
    ? [...base, s.row.members.map((m) => m.raw).join(', ') || '-']
    : base;
}

/** Everything a reader is owed about ONE subject, at `--full`. */
function detailLines(row: Row, out: Emit): void {
  const s = row.subject;
  out(`D${s.row.d} — ${s.row.status}, ${s.done} of ${s.items.length} done`);
  const list = (label: string, entries: string[]): void => {
    if (entries.length === 0) return;
    // `prefix` and `continuation` differ, so a wrapped second line lands under
    // the addresses rather than under the label — the column discipline
    // `paragraph`'s own header argues for a findings list.
    for (const line of paragraph(`  ${label}  ${entries.join(', ')}`, '', undefined, ' '.repeat(10))) {
      out(line);
    }
  };
  list('ready ', s.ready.map((r: ReadyRow) => addr(r.item)));
  list('held  ', s.held.map((h: HeldRow) => `${addr(h.item)} (${h.reading.pending.join(', ')})`));
  for (const { item, question } of row.questioned) {
    for (const line of paragraph(
      `  yours   ${addr(item)} — ${question.item.title}`, '', undefined, ' '.repeat(10),
    )) out(line);
  }
  if (row.heldByOwner) {
    for (const line of paragraph(
      '  yours   the whole subject is held by your own ruling', '', undefined, ' '.repeat(10),
    )) out(line);
  }
}

function cmdPath(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  // Refused before anything is opened or printed — the gate-above-the-output
  // ordering `cmdTodo` carries the incident report for.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let detail: Detail;
  let json: boolean;
  let only: string | null;
  let register: string;
  const all = args.includes('--all');
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
    only = flag(args, 'd');
    register = flag(args, 'register') ?? DEFAULT_REGISTER;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
  if (only !== null) only = only.replace(/^[Dd]/, '');

  const { ctx, errors } = openMutateContext(ws);
  const corpus = ctx.store.all();
  ctx.store.close();

  const item = corpus.find((i) => i.id === register);
  if (item === undefined) {
    /**
     * **A project that keeps no subject map is not a project that failed**, and
     * the exit code has to tell those apart. Almost every project that installs
     * this plugin is in that state: the register is THIS repository's own item,
     * and `mycontext path` must not be an error in somebody else's checkout
     * merely because they group their work differently.
     *
     * So the DEFAULT register missing is answered at exit 0, loudly, in the
     * shape `ready` already uses for "no category in this project plans work".
     * A register named EXPLICITLY and missing is exit 1: the caller asserted it
     * exists and it does not, which is a failure to do what was asked
     * (`CONST-the-cli-exit-code-contract`).
     */
    const asked = register !== DEFAULT_REGISTER;
    say(out, `my_context: this corpus holds no item ${register}, so there is no subject map to `
      + 'read. That is not the same as there being no open work — `mycontext ready` answers over '
      + 'the corpus without one. A subject map is a reference item carrying a [D-MAP] block: '
      + 'one line per subject, `D<n> | status | plan/*`, with the argument for each in the '
      + (asked
        ? 'prose around it. Point this at the item that carries yours with --register <id>.'
        : 'prose around it. This project keeps none, which is a statement about the project '
          + 'rather than about the work.'));
    emitLoadErrors(errors, out);
    return asked ? 1 : 0;
  }
  const reading = parseDMap(item.body);
  if (!reading.found) {
    say(out, `my_context: ${register} carries no [D-MAP] block, so nothing here could be `
      + 'computed. The block is the map and the prose around it is the argument; '
      + '`npm run check:board` names what is wrong with one.');
    return 1;
  }
  const board = dBoard(reading, corpus, ws.config);

  /**
   * The questions, resolved to the ITEMS they name.
   *
   * `questionReport`'s `blocking` split is taken as it stands rather than
   * re-filtered: it is already "questions naming open work", computed once so
   * that no two surfaces can draw it differently, and `ready` draws the same
   * two arrays.
   */
  const questions = questionReport(corpus, ws.config);
  const questionOf = new Map<string, QuestionRow>();
  for (const question of questions.blocking) {
    for (const ref of question.pending) {
      for (const target of board.subjects.flatMap((s) => s.items)) {
        if (taskKey(target) === ref && !questionOf.has(target.id)) questionOf.set(target.id, question);
      }
    }
  }

  const rows: Row[] = board.subjects.map((subject) => ({
    subject,
    /**
     * **No `state` filter here, and its absence is a measured decision.** The
     * first draft also required `taskState(i) !== DONE_STATE`, and a removal
     * proof could not redden it: `questionOf` is keyed on `row.pending`, and
     * `questionReport` puts a question in `blocking` only for references that
     * are NOT all done. A question naming one landed item and one open one
     * therefore reaches this map under the open one alone. The guard was dead
     * code wearing the clothes of a safety check, which is worse than nothing:
     * the next reader budgets for a hazard that is already handled upstream.
     */
    questioned: subject.items
      .filter((i) => questionOf.has(i.id))
      .map((i) => ({ item: i, question: questionOf.get(i.id)! })),
    heldByOwner: subject.row.status === 'held-by-owner',
  }));

  /**
   * What the default level shows: the subjects with something still owed on
   * them. A "path to finishing the open Ds" that also listed forty finished
   * ones would be precise about the wrong corpus — `ready`'s own reasoning for
   * capping its list, applied one level up.
   *
   * `deferred` and `held-by-owner` stay even with no open items, because both
   * are STANDING answers the owner gave and a path that quietly dropped them
   * would let a deferral expire by being forgotten.
   */
  const live = (row: Row): boolean =>
    row.subject.ready.length > 0
    || row.subject.held.length > 0
    || row.questioned.length > 0
    || row.subject.row.status === 'deferred'
    || row.subject.row.status === 'held-by-owner';

  const chosen = only === null
    ? rows.filter((r) => all || live(r))
    : rows.filter((r) => r.subject.row.d.toLowerCase() === only.toLowerCase());

  if (only !== null && chosen.length === 0) {
    say(out, `my_context: no subject D${only} in ${register}'s map. A number announced in a `
      + 'message and not written in the register is not a D number yet, whatever the message '
      + `said — the register says so itself. \`mycontext path\` lists the ${rows.length} that are.`);
    return 1;
  }

  const openTotal = rows.reduce((n, r) => n + r.subject.ready.length + r.subject.held.length, 0);
  const yoursRows = rows.filter((r) => r.heldByOwner || r.questioned.length > 0);
  const closable = rows.filter(
    (r) => r.subject.row.status === 'open'
      && r.subject.items.length > 0
      && r.subject.done === r.subject.items.length,
  );

  if (json) {
    emitJson(out, {
      register,
      subjects: chosen.map((r) => ({
        d: r.subject.row.d,
        status: r.subject.row.status,
        members: r.subject.row.members.map((m) => m.raw),
        total: r.subject.items.length,
        done: r.subject.done,
        ready: r.subject.ready.map((x) => ({ id: x.item.id, task: addr(x.item) })),
        held: r.subject.held.map((x) => ({
          id: x.item.id, task: addr(x.item), reason: x.reason, pending: x.reading.pending,
        })),
        yours: [
          ...r.questioned.map((q) => ({
            kind: 'question', task: addr(q.item), question: q.question.item.id,
            title: q.question.item.title,
          })),
          ...(r.heldByOwner ? [{ kind: 'held-by-owner', task: null, question: null, title: null }] : []),
        ],
      })),
      subjectsTotal: rows.length,
      shown: chosen.length,
      openWork: openTotal,
      waitingOnYou: yoursRows.length,
      closable: closable.map((r) => r.subject.row.d),
      orphans: board.orphans.map((i) => ({ id: i.id, task: addr(i) })),
      // Never silently absent: a map with a broken row is a map whose numbers
      // are wrong, and a machine reader must be able to see that here rather
      // than only by running the gate.
      mapDefects: reading.defects,
      mapUnresolved: board.unresolved,
      mapDoubleClaimed: board.doubleClaimed,
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  if (detail !== 'summary') {
    const headers = detail === 'full' ? FULL_HEADERS : HEADERS;
    const drawn = chosen.map((r) => cells(r, detail));
    for (const line of (detail === 'full' ? records(headers, drawn) : table(headers, drawn))) {
      out(line);
    }
    if (drawn.length > 0) out('');
  }
  if (detail === 'full') {
    for (const row of chosen) {
      detailLines(row, out);
      out('');
    }
  }

  /**
   * The disclosure, on EVERY path including `--summary`, in one place so that
   * two levels cannot say different things. `ready` draws the same discipline
   * for the same reason.
   */
  const blocks: string[] = [];
  blocks.push(`${rows.length} subject(s) in the map, ${chosen.length} shown, `
    + `${openTotal} open work item(s) under them. Every count here is derived on this run from `
    + `${register}'s [D-MAP] block and the state of the items it names; nothing is stored and `
    + 'there is no progress file to go stale.');

  if (yoursRows.length > 0) {
    blocks.push(`WAITING ON YOU — ${yoursRows.length} subject(s), and no other command can say `
      + 'so. This is the difference between a list and a path: a report that draws these as '
      + 'ordinary open work keeps offering you work you have already decided to defer.');
    for (const row of yoursRows) {
      if (row.heldByOwner) {
        blocks.push(`  D${row.subject.row.d} — the whole subject is held by your own ruling.`);
      }
      for (const { item: target, question } of row.questioned) {
        blocks.push(`  D${row.subject.row.d} · ${addr(target)} — ${question.item.title} `
          + `(${question.item.id})`);
      }
    }
  }
  if (closable.length > 0) {
    blocks.push(`${closable.length} subject(s) read "open" with every item done: `
      + `${closable.map((r) => `D${r.subject.row.d}`).join(', ')}. A subject closes on a `
      + 'JUDGEMENT and never on a count — nothing here will close one for you.');
  }
  if (board.orphans.length > 0) {
    blocks.push(`${board.orphans.length} open work item(s) belong to no subject at all, so they `
      + 'are in none of the rows above. `npm run check:board --orphans` names them. Filing an '
      + 'item before its number is minted is ordinary; nobody being told is how a subject '
      + 'disappears from the board.');
  }
  if (reading.defects.length > 0 || board.unresolved.length > 0 || board.doubleClaimed.length > 0) {
    blocks.push(`THE MAP ITSELF HAS ${reading.defects.length + board.unresolved.length
      + board.doubleClaimed.length} DEFECT(S), so some of the numbers above are wrong and this `
      + 'report cannot say which. `npm run check:board` names every one of them by line.');
  }
  blocks.push('100% here means every remaining step is either DISPATCHABLE or NAMED AS YOURS. It '
    + 'is not a promise that every subject closes: one is held by your own ruling and others end '
    + 'in decisions only you can make.');

  for (const [i, text] of blocks.entries()) {
    const indented = text.startsWith('  ');
    if (i > 0 && !indented) out('');
    // An indented block is a ROW under the heading above it, and a wrapped
    // second line that started in column 0 would read as a new heading. So the
    // indent is a real prefix rather than two characters of the text.
    if (indented) for (const line of paragraph(text.trimStart(), '  ', undefined, '     ')) out(line);
    else say(out, text);
  }

  // This command did what it was asked, so an unrelated corpus load error is a
  // warning rather than a failure — the rule `ready`, `search` and `todo` all
  // follow.
  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'path',
  usage: `path [--d <n>] [--all] ${DETAIL_USAGE}`,
  summary: 'per subject: done, ready, held, and what is waiting on you',
  run: (ws, args, out) => cmdPath(ws, args, out),
});
