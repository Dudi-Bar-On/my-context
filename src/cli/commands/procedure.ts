import { readAudit, recordAudit, type AuditRecord } from '../../core/audit.ts';
import { renderItem } from '../../core/item.ts';
import { updateItem } from '../../core/mutate.ts';
import { rebuildRoots } from '../../core/open-store.ts';
import { procedureProgress, progressLine, unreadableProgress } from '../../core/progress.ts';
import { loadLayer, type LoadError } from '../../core/rebuild.ts';
import { mergeLayers, RETIRED_STATUSES } from '../../core/select.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { paragraph, refuseUnknownFlag } from './format.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';
import { confirmAction } from './review.ts';

/**
 * `mycontext procedure` — the lifecycle of the one category that has one.
 *
 * **This command exists for `procedure` and refuses every other category by
 * name, `runbook` included** (spec §6o). A runbook has no lifecycle because it
 * is never finished: it is performed again every time the named operation comes
 * up. So `procedure activate RUN-...` is not a missing feature to be added
 * later, it is a category error, and the refusal below says so in those words
 * — it is the fourth of the four places §6o requires the boundary to be
 * statable, and the only one that reaches somebody who has ALREADY chosen
 * wrongly. The other three are `mycontext help categories` and the two
 * `mycontext examples` specimens.
 *
 * The stages, mapped onto what ships — nothing was added to `Status` for this:
 *
 * | Stage     | Representation                  | Injects                | Command                            |
 * |-----------|---------------------------------|------------------------|------------------------------------|
 * | proposed  | `status: draft`                 | nothing                | `mycontext add procedure …`        |
 * | ready     | `status: draft` + tag `ready`   | nothing, not even an index line | `mycontext edit <id> --tags …` |
 * | active    | `status: active` + `always: true` | the full block, every session | `mycontext procedure activate` |
 * | done      | `status: deprecated`            | nothing; counted in `retired` | `mycontext procedure done`  |
 * | abandoned | `status: superseded`            | nothing                | `mycontext supersede <id> --by <id>` |
 *
 * **Progress is never written into the item.** A tick is one `progress` record
 * in the audit log (`core/audit.ts` · `export const PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset'] as const;`),
 * replayed by `core/progress.ts`. That is why `step` writes no item, takes no
 * index write lock, and leaves the file's checksum exactly where it was — and
 * why `show` says out loud that the `- [x]` it prints is rendered rather than
 * stored. `INV-markdown-is-the-source-of-truth`: the Markdown is the record,
 * and a rendered tick must never be mistaken for one.
 */

/** The category this command acts on, and the near miss it must name. */
const CATEGORY = 'procedure';
const NEAR_MISS = 'runbook';

/**
 * The tag that marks a draft procedure as ready to run.
 *
 * A tag rather than a status, because §2.1 forbids building on "index line
 * only" until that is decided and a sixth status would be exactly that
 * decision taken quietly. What it costs is that a `ready` procedure reaches no
 * session at all, and `list` discloses that rather than leaving it to be
 * discovered.
 */
const READY_TAG = 'ready';

export const SUBCOMMANDS = ['list', 'show', 'activate', 'done', 'step'] as const;

/**
 * The flags each subcommand accepts, per subcommand rather than one union —
 * the same reason `review` splits them (`cli/commands/review.ts` ·
 * `const REVIEW_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {`):
 * a `--yes` on `list` is meaningless, and accepting it would leave exactly the
 * silent swallow `unknownFlag` exists to stop on a command whose other half
 * mutates.
 */
const PROCEDURE_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {
  list: { allowed: [], values: [] },
  show: { allowed: [], values: [] },
  activate: { allowed: ['yes'], values: [] },
  done: { allowed: ['yes'], values: [] },
  step: { allowed: ['undo'], values: [] },
};

const USAGE = `usage: mycontext procedure [list]
       mycontext procedure show <id>
       mycontext procedure activate <id> [--yes]
       mycontext procedure done <id> [--yes]
       mycontext procedure step <id> <n> [--undo]`;

/**
 * The lifecycle stage of one procedure, in the order the table above names
 * them.
 *
 * DERIVED from `RETIRED_STATUSES` (core/select.ts) rather than listing the
 * retired statuses again here: that set is what makes a finished procedure
 * appear in the session's `N retired` line instead of vanishing from every
 * tally, and a second hand-kept copy of it would be a defect waiting to go
 * stale the first time the set moves. `superseded` is tested first because it
 * is a member of that set with a stage of its own — abandoned is not done.
 */
const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;
type Stage = (typeof STAGES)[number];

function stageOf(item: Item): Stage {
  if (item.status === 'superseded') return 'abandoned';
  if (RETIRED_STATUSES.has(item.status)) return 'done';
  if (item.status === 'active') return 'active';
  return item.tags.includes(READY_TAG) ? 'ready' : 'proposed';
}

/**
 * The one category refusal, shared by all five subcommands, and it names BOTH
 * categories when the near miss is the one a user will actually hit.
 *
 * Any other category gets the first sentence alone: `RULE-x` is not a near
 * miss, and the boundary paragraph would be noise on a refusal nobody reached
 * by confusing the two.
 */
function categoryRefusal(item: Item): string {
  const first =
    `my_context: ${item.id} is a ${item.type}, not a ${CATEGORY}. ` +
    `\`mycontext ${CATEGORY}\` acts on ${CATEGORY} items only — ` +
    `\`mycontext show ${item.id}\` prints this one.`;
  if (item.type !== NEAR_MISS) return first;
  return `${first}\n` +
    `A \`${NEAR_MISS}\` is repeatable: it is performed again every time the named operation ` +
    `comes up, so it has no lifecycle to activate and nothing to finish. A \`${CATEGORY}\` is ` +
    `done once and then it is finished, which is why it is the one that carries a lifecycle. ` +
    `This is a category error, not a feature that is coming.`;
}

/**
 * `out` for a sentence rather than a line — `review`'s helper, same reason.
 *
 * The continuation is INDENTED to the prefix's width rather than repeating it,
 * which is `paragraph`'s own fourth argument (format.ts): a wrapped
 * `note: ...` line otherwise begins with a second `note: ` and reads as a
 * second note that says half a sentence.
 */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix, undefined, ' '.repeat(prefix.length))) out(line);
}

/**
 * The corpus, read from MARKDOWN rather than from the index.
 *
 * `list`, `show` and `step` change no item, and reading them through
 * `openMutateContext` would rebuild the SQLite projection — taking its write
 * lock — to answer a question the Markdown already answers. `step` in
 * particular is documented to the agent as safe to run precisely because it
 * takes no write lock, so it must not quietly take one. This is the same
 * `loadLayer` + `mergeLayers` pair `buildInjection` (core/inject.ts) uses, and
 * the same layer precedence: project shadows global by id.
 */
function corpus(ws: Workspace, root: string, errors: LoadError[]): Item[] {
  const roots = rebuildRoots(ws);
  const items: Item[] = [];
  if (roots.global) items.push(...loadLayer(roots.global, 'global', errors, ws.config));
  items.push(...loadLayer(root, 'project', errors, ws.config));
  return mergeLayers(items);
}

function findItem(items: Item[], id: string, out: Emit): Item | null {
  const item = items.find((i) => i.id === id);
  if (!item) {
    out(`my_context: no item with id "${id}". List them with \`mycontext ${CATEGORY} list\` or ` +
        `find one with \`mycontext search "..."\`.`);
    return null;
  }
  return item;
}

/** The steps a procedure declares, with the audit log's ticks laid over them. */
function overlay(item: Item, done: Set<number>): Item {
  return {
    ...item,
    steps: item.steps.map((step, i) => ({ ...step, checked: done.has(i + 1) })),
  };
}

/**
 * The limit that belongs beside every number this command prints.
 *
 * No CLI surface is handed a trustworthy session id — `core/focus.ts` measured
 * that and conceded it — so a progress record is keyed to the WORKSPACE. Two
 * terminals working one procedure share one record set. Disclosed by the
 * commands that print the number rather than papered over in `core/progress.ts`.
 */
const WORKSPACE_SCOPE =
  'progress is recorded per workspace, not per session — two terminals on this workspace ' +
  'share one record set.';

/**
 * What a `ready` procedure does today, which is nothing.
 *
 * `select.ts` · `export function isEligible(item: Item, config: Config): boolean {` admits
 * `active` only, and `buildIndex` enumerates only eligible items, so a `ready`
 * procedure reaches neither the injected block nor an index line. §2.1 forbids
 * building on "index line only" until that is decided, so this task builds
 * nothing and says so instead: silence here would be the
 * `INV-nothing-is-dropped-silently` failure exactly.
 */
const READY_DISCLOSURE =
  `a ready procedure is not injected and not named in the index — the model does not learn it ` +
  `exists until \`mycontext ${CATEGORY} activate\` runs. Nothing is lost: it is a draft, and ` +
  `\`mycontext ${CATEGORY} list\` is where it is visible.`;

function cmdList(items: Item[], records: AuditRecord[], out: Emit): number {
  const procedures = items
    .filter((i) => i.type === CATEGORY)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (procedures.length === 0) {
    out(`0 ${CATEGORY}(s). Capture one with \`mycontext add ${CATEGORY} "<title>" --step "..."\`.`);
    say(out, WORKSPACE_SCOPE, 'note: ');
    return 0;
  }

  const byStage = new Map<Stage, Item[]>();
  for (const item of procedures) {
    const stage = stageOf(item);
    byStage.set(stage, [...(byStage.get(stage) ?? []), item]);
  }

  for (const stage of STAGES) {
    const rows = byStage.get(stage);
    if (!rows) continue;
    out(`${stage}:`);
    for (const item of rows) {
      const done = procedureProgress(records, item.id);
      out(`  ${item.id} · ${stage} · ${progressLine(done, item.steps.length)} · ${item.title}`);
    }
    out('');
  }

  // Carried with its CONDITION, not asserted unconditionally: the sentence is
  // about the rows above it, and printing it when there are none would teach a
  // limitation this corpus is not subject to.
  if (byStage.has('ready')) say(out, READY_DISCLOSURE, 'note: ');
  say(out, WORKSPACE_SCOPE, 'note: ');
  return 0;
}

function cmdShow(item: Item, records: AuditRecord[], out: Emit): number {
  const done = procedureProgress(records, item.id);
  const unreadable = unreadableProgress(records, item.id);

  out(renderItem(overlay(item, done)));
  out('');
  out(`progress: ${progressLine(done, item.steps.length)}`);
  // Said in the same output as the ticks, because a reader who has just been
  // shown `- [x]` will otherwise believe the file moved — and the whole design
  // of this lifecycle rests on it not having.
  say(out,
    `every ticked box above is RENDERED from the audit log, not stored: every step in the ` +
    `file on disk is still unticked and its recorded checksum is unchanged, which is why ` +
    `\`mycontext doctor\` stays quiet while a procedure is being worked through.`);
  if (unreadable > 0) {
    say(out,
      `${unreadable} progress record(s) in this run could not be read by this build and are ` +
      `counted in neither direction. They were written by something that spelled the step ` +
      `differently; the count above is of the records that parsed.`);
  }
  say(out, WORKSPACE_SCOPE, 'note: ');
  return 0;
}

function cmdActivate(ws: Workspace, root: string, args: string[], id: string, out: Emit): number {
  const { ctx, errors } = openMutateContext(ws);
  try {
    const item = findItem(ctx.store.all(), id, out);
    if (!item) return 1;
    // Before the preview, always: a refusal preceded by "about to activate"
    // reads as a report of something that then did not happen.
    if (item.type !== CATEGORY) { out(categoryRefusal(item)); return 1; }

    out('about to activate:');
    out(`  procedure   ${item.id}`);
    out(`  title       ${item.title}`);
    out(`  status      ${item.status} -> active`);
    out(`  always      ${item.always} -> true`);
    out('');
    // The two writes, described SEPARATELY, because §2.1 says this is the
    // distinction a plan gets wrong: `status: active` makes the item ELIGIBLE,
    // and `always: true` is what delivers it IN FULL every session. A command
    // that set only the status would ship a procedure that is indexed, not
    // delivered, and silently not doing the one thing this lifecycle is for.
    say(out, 'status: active makes it eligible to be selected at all — without it the item is ' +
      'invisible to every injection.', '  ');
    say(out, 'always: true is what delivers it IN FULL at every session start rather than as ' +
      'one index line. The two are different properties and this command sets both.', '  ');
    if (item.steps.length === 0) {
      // Allowed, not refused: a half-written procedure should be visible
      // rather than blocked, and saying so is cheaper than a refusal that
      // sends the author to edit the Markdown before they can start.
      say(out, 'this procedure declares NO steps, so there will be nothing to tick. Steps are ' +
        'set at capture time (`mycontext add procedure … --step "..."`) and are corrected by ' +
        'editing the Markdown.', '  ');
    } else {
      say(out, `${item.steps.length} step(s) will be injected with it.`, '  ');
    }
    out('');

    if (!confirmAction(args, out, `Activate ${item.id} ("${item.title}")?`)) return 1;

    // THE AUDIT RECORD FIRST, THEN THE ITEM WRITE. The order looks arbitrary
    // and is not: `step-reset` is the anchor `procedureProgress` counts
    // forward from, so interrupted between the two calls, the other order
    // leaves an ACTIVE procedure carrying the previous run's ticks — and "is
    // this finished", the question the one-shot lifecycle exists to answer, is
    // then answered wrongly and in silence. This order fails the harmless way:
    // a reset with no activation is a procedure that is not active yet, which
    // is what it already was. Do not tidy it into "do the real work first,
    // then log it".
    const written = recordAudit(root, {
      kind: 'progress', op: 'step-reset', itemId: item.id, origin: 'human', note: 'activated',
    });
    if (!written.written) {
      // Refused rather than continued. Elsewhere the audit log fails OPEN,
      // because a record is evidence about a write that happened anyway. Here
      // it is not evidence, it is the replay anchor: activating without it is
      // the exact silent-wrong-answer this ordering exists to prevent.
      out(`my_context: the step-reset record could not be written (${written.error}), so ` +
          `${item.id} was NOT activated. Activating without it would carry the previous run's ` +
          `ticks into this one.`);
      return 1;
    }

    const result = updateItem(ctx, { id: item.id, status: 'active', always: true, origin: 'human' });
    out(result.message);
    out(`my_context: ${item.id} is active and pinned — it is injected in full at every session ` +
        `start until \`mycontext ${CATEGORY} done ${item.id}\` retires it.`);
    emitLoadErrors(errors, out);
    return 0;
  } finally {
    ctx.store.close();
  }
}

function cmdDone(
  ws: Workspace, args: string[], id: string, records: AuditRecord[], out: Emit,
): number {
  const { ctx, errors } = openMutateContext(ws);
  try {
    const item = findItem(ctx.store.all(), id, out);
    if (!item) return 1;
    if (item.type !== CATEGORY) { out(categoryRefusal(item)); return 1; }

    const done = procedureProgress(records, item.id);
    out('about to finish:');
    out(`  procedure   ${item.id}`);
    out(`  title       ${item.title}`);
    out(`  status      ${item.status} -> deprecated`);
    out(`  progress    ${progressLine(done, item.steps.length)}`);
    out('');
    // `deprecated`, not `validated`: `trust.ts` ·
    // `export function governsNormatively(ctx: MutationContext, item: Item): boolean {`
    // treats `validated` as still governing, so a completed procedure filed
    // there would keep its guarded-field refusals switched on for the rest of
    // its life.
    say(out, 'after this it is no longer injected, and it is not deleted either: the file, its ' +
      'body and its steps all stay, and it is counted in the session banner\'s "N retired" ' +
      'rather than vanishing from every tally.', '  ');
    say(out, 'the progress line above is what it is — this command checks nothing and concludes ' +
      'nothing. A procedure is finished when a human says it is.', '  ');
    out('');

    if (!confirmAction(args, out, `Finish ${item.id} ("${item.title}")? It stops being injected.`)) {
      return 1;
    }

    const result = updateItem(ctx, { id: item.id, status: 'deprecated', origin: 'human' });
    out(result.message);
    emitLoadErrors(errors, out);
    return 0;
  } finally {
    ctx.store.close();
  }
}

/**
 * `step <id> <n> [--undo]` — one append to the audit log, and nothing else.
 *
 * It writes no item and takes no index write lock, which is exactly why
 * `commands/procedure.md` tells the agent it may run this one: it crosses no
 * trust boundary because progress governs nothing.
 */
function cmdStep(
  root: string, args: string[], item: Item, raw: string | undefined,
  records: AuditRecord[], out: Emit,
): number {
  if (item.type !== CATEGORY) { out(categoryRefusal(item)); return 1; }

  // A procedure that was never initiated has no run to record against, and a
  // tick against it would be counted the moment somebody activated it later —
  // progress from before the anchor, silently inside the new run.
  if (item.status !== 'active') {
    out(`my_context: ${item.id} is "${item.status}", not "active", so there is no run to ` +
        `record a step against. Start it with \`mycontext ${CATEGORY} activate ${item.id}\`.`);
    return 1;
  }

  if (raw === undefined) { out(USAGE); return 1; }
  const n = Number(raw);
  const total = item.steps.length;
  if (!Number.isSafeInteger(n) || n < 1 || n > total) {
    out(total === 0
      ? `my_context: ${item.id} declares 0 steps, so there is nothing to tick. Steps are set at ` +
        `capture time with \`mycontext add ${CATEGORY} "<title>" --step "..."\`, and correcting ` +
        `one means editing the Markdown.`
      : `my_context: ${JSON.stringify(raw)} is not one of this procedure's steps. ` +
        `${item.id} has ${total} step(s), numbered 1 to ${total}. ` +
        `\`mycontext ${CATEGORY} show ${item.id}\` prints them.`);
    return 1;
  }

  const undo = hasFlag(args, 'undo');
  const written = recordAudit(root, {
    kind: 'progress',
    op: undo ? 'step-undone' : 'step-done',
    itemId: item.id,
    origin: 'human',
    note: `step ${n}`,
  });
  if (!written.written) {
    out(`my_context: the progress record could not be written (${written.error}), so nothing ` +
        `was recorded. The item is untouched either way — progress never enters items/.`);
    return 1;
  }

  const after = procedureProgress([...records, {
    protocol: '', at: '', kind: 'progress', op: undo ? 'step-undone' : 'step-done',
    itemId: item.id, note: `step ${n}`,
  }], item.id);
  out(`my_context: step ${n} ${undo ? 'un-ticked' : 'ticked'} — ` +
      `${progressLine(after, total)}. The item file is unchanged; this is one record in the ` +
      `audit log.`);
  return 0;
}

function cmdProcedure(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  const root = ws.projectRoot;

  const [subcommand = 'list', id, stepNumber] = positionals(args, []);
  if (!(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown ${CATEGORY} subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  // Refused before the corpus is read and before any preview or prompt — the
  // same ordering `review` and `supersede` use, for the same reason.
  const { allowed, values } = PROCEDURE_FLAGS[subcommand];
  if (refuseUnknownFlag(args, allowed, values, USAGE, out)) return 1;

  try {
    const records = readAudit(root);

    if (subcommand === 'activate' || subcommand === 'done') {
      if (!id) { out(USAGE); return 1; }
      return subcommand === 'activate'
        ? cmdActivate(ws, root, args, id, out)
        : cmdDone(ws, args, id, records, out);
    }

    const errors: LoadError[] = [];
    const items = corpus(ws, root, errors);

    if (subcommand === 'list') {
      const code = cmdList(items, records, out);
      emitLoadErrors(errors, out);
      return code;
    }

    if (!id) { out(USAGE); return 1; }
    const item = findItem(items, id, out);
    if (!item) { emitLoadErrors(errors, out); return 1; }

    if (subcommand === 'show') {
      if (item.type !== CATEGORY) { out(categoryRefusal(item)); return 1; }
      const code = cmdShow(item, records, out);
      emitLoadErrors(errors, out);
      return code;
    }

    const code = cmdStep(root, args, item, stepNumber, records, out);
    emitLoadErrors(errors, out);
    return code;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'procedure',
  usage: 'procedure [list|show|activate|done|step] [<id>] [<n>]',
  summary: 'the one-shot lifecycle: what is ready, what is running, what is finished',
  run: (ws, args, out) => cmdProcedure(ws, args, out),
});
