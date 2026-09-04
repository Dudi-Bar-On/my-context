import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { clearCarryOnce, markCarryOnce, readCarryOnce } from '../../core/ledger.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { emitJson, outputWidth, paragraph, refuseUnknownFlag, wantsJson } from './format.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';
import { confirmAction } from './review.ts';

/**
 * **`mycontext carry <id>` — a one-shot override, spent at the next
 * injection.**
 *
 * Owner ruling 2026-09-04, in his own words: he should be able to select
 * spilled items and act to inject them if he thinks they are required — a
 * judgement about NOW, not forever. `TASK-no-command-delivers-one-item-at-
 * the-next-injection-so-a` names why neither existing lever says that:
 *
 *  - `pin` (`mycontext edit --always`/`pin`) delivers every session
 *    PERMANENTLY and prices the shared `pinned` budget every `always: true`
 *    item already competes in — a forgotten pin quietly starves the others.
 *    **Pin keeps its present meaning; this command does not touch it, and
 *    marking a carry writes nothing to any item.**
 *  - `focus` narrows what a WHOLE session receives. Using it to force one
 *    item through changes everything else that arrives too — a large side
 *    effect for a small intent.
 *
 * `carry` is neither: it marks one id, hands it to the very next injection as
 * a front-of-queue INDEX LINE — the same `carried` disclosure a cross-session
 * carry already produces (`core/select.ts`'s `carried` tier, folded in by
 * `core/inject.ts`'s `foldOnceCarry`) — and is gone whether or not that line
 * was admitted. Nothing here is a filter and nothing here changes what any
 * OTHER item receives.
 *
 * **Two questions the item asked to be answered rather than assumed, and
 * where the answer lives:**
 *
 *  1. *What happens to a carry nobody spends?* It waits. `state/carry-once.json`
 *     (`core/ledger.ts`) holds a small, visible queue with no timer and no
 *     expiry — `--show` reads it back at any time — and it costs nothing while
 *     it sits: no budget, no tier, nothing rendered. It is never renewed by
 *     merely existing, so it cannot compound into a second, invisible pin the
 *     way a forgotten `always: true` does.
 *  2. *Is carrying an item already in context refused, or allowed?* Allowed.
 *     This command has no reliable notion of "what the CURRENT session's
 *     window already holds" — that is a per-session fact the seen file and
 *     the spilled-items list already own, and re-deriving it here would be
 *     exactly the parallel logic `core/ledger.ts`'s carry-once section is
 *     written not to become. The cost of marking an id that is already
 *     delivered is one wasted front-of-queue index line, never a wrong
 *     answer — so the reader is expected to check the spilled-items list
 *     FIRST, and this command does not refuse on their behalf.
 *
 * **On the approval boundary.** Marking an id changes what the next injection
 * delivers with no human in that later loop, which is exactly what `--yes`
 * exists to gate (`test/helpers/approval-boundary.ts`). `--yes` is the right
 * shape here and not `--count`: this command always acts on exactly ONE item
 * per call — `mycontext carry <id>`, one id, one write — which is `--yes`'s
 * own definition (`cli/commands/ack.ts`'s header: `--count` is for a ruling on
 * a NAMED, BOUNDED CLASS of N things, because stating the number IS the
 * agreement). `--clear` is likewise one act — "empty the queue" — regardless
 * of how many ids happen to be sitting in it, the same shape `mycontext focus
 * --clear` already has for "however many items focus is currently hiding".
 *
 * **No MCP tool.** The owner's 2026-09-04 ruling on the web screen ("the web
 * screen can write") retired the compose-only restriction this item was
 * written under, but did not ask for an agent-callable surface, and this
 * command is squarely a HUMAN judgement call about what governs the very next
 * session — the same reasoning `ack`'s single-item form stands on ("There is
 * no MCP tool, deliberately"). `src/plugin/parity.ts`'s `CLI_WITHOUT_TOOL`
 * carries this with the reason named, `disposition: 'intended'`.
 */

const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.carry;

const USAGE = [
  'usage: mycontext carry <id> [--yes]',
  '       mycontext carry --show [--json]',
  '       mycontext carry --clear [--yes]',
  '',
  'Marks one item for delivery at the very next injection, regardless of its own',
  'budget, then forgets it — a one-shot override, not a second pin. `--show`',
  'prints what is currently queued and changes nothing; `--clear` withdraws the',
  'whole queue.',
].join('\n');

function say(out: Emit, text: string): void {
  for (const line of paragraph(text, '', outputWidth(), '  ')) out(line);
}

/** Titles for `--show`, best-effort: an id the corpus no longer has still lists, un-titled. */
function titleLookup(items: Item[]): (id: string) => string | null {
  const byId = new Map(items.map((i) => [i.id, i.title]));
  return (id) => byId.get(id) ?? null;
}

function cmdCarry(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const root = ws.projectRoot;
  const json = wantsJson(args);
  const show = hasFlag(args, 'show');
  const clear = hasFlag(args, 'clear');
  const rest = positionals(args, VALUE_FLAGS);

  if (show && clear) {
    out(
      'my_context: --show and --clear name two different acts — reporting the queue and ' +
      `withdrawing it. Run one, then the other.\n${USAGE}`,
    );
    return 1;
  }
  if ((show || clear) && rest.length > 0) {
    out(
      `my_context: ${show ? '--show' : '--clear'} takes no item id, and "${rest[0]}" was ` +
      `given. It reports on the whole queue, not on one item.\n${USAGE}`,
    );
    return 1;
  }

  // ── mycontext carry --show ────────────────────────────────────────────────
  if (show) {
    if (hasFlag(args, 'yes')) {
      out(
        'my_context: --yes means nothing on `mycontext carry --show`, which reports and ' +
        'changes nothing — there is no confirmation to answer. It is refused rather than ' +
        `ignored, so a reader is never told this command asks before it reports.\n${USAGE}`,
      );
      return 1;
    }
    const { ids, error } = readCarryOnce(root);
    if (error !== null) {
      out(`my_context: \`.my_context/state/carry-once.json\` ${error}, so nothing is carried.`);
      return 1;
    }
    if (json) { emitJson(out, ids); return 0; }
    if (ids.length === 0) {
      out('my_context: nothing is carried. `mycontext carry <id>` marks one for the next injection.');
      return 0;
    }
    const { ctx, errors } = openMutateContext(ws);
    let items: Item[];
    try {
      items = ctx.store.all();
    } finally {
      ctx.store.close();
    }
    const titleOf = titleLookup(items);
    out(
      `my_context: ${ids.length} item(s) queued for the next injection, whether or not it fits:`,
    );
    for (const id of ids) {
      const title = titleOf(id);
      out(`  ${id}${title === null ? ' (not in this corpus any more)' : ` — ${title}`}`);
    }
    emitLoadErrors(errors, out);
    return 0;
  }

  // ── mycontext carry --clear ───────────────────────────────────────────────
  if (clear) {
    const { ids: pending, error: readError } = readCarryOnce(root);
    if (readError === null && pending.length === 0) {
      out('my_context: nothing is carried, so there is nothing to clear.');
      return 0;
    }
    if (!hasFlag(args, 'yes') && !json) {
      say(out, readError !== null
        ? `\`.my_context/state/carry-once.json\` ${readError}, so the queue's contents cannot ` +
          'be shown, but clearing still empties it.'
        : `about to withdraw ${pending.length} pending carry mark(s): ${pending.join(', ')}. ` +
          'None of them will be forced into the next injection.');
    }
    if (!confirmAction(
      args, out,
      pending.length === 0
        ? 'Clear the carry queue?'
        : `Clear ${pending.length} pending carry mark(s)? None will reach the next injection.`,
    )) return 1;
    const { ids: cleared, written, error } = clearCarryOnce(root);
    if (!written) {
      out(`my_context: ${error}`);
      return 1;
    }
    out(cleared.length === 0
      ? 'my_context: carry queue cleared.'
      : `my_context: carry queue cleared — ${cleared.length} mark(s) withdrawn: ${cleared.join(', ')}.`);
    return 0;
  }

  // ── mycontext carry <id> ──────────────────────────────────────────────────
  const id = rest[0];
  if (id === undefined) {
    out(`my_context: carry needs an item id.\n\n${USAGE}`);
    return 1;
  }
  if (rest.length > 1) {
    out(
      `my_context: carry marks ONE item per call — "${rest[1]}" is a second id on the same ` +
      `command line. Run \`mycontext carry ${rest[1]}\` separately.\n${USAGE}`,
    );
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  let items: Item[];
  try {
    items = ctx.store.all();
  } catch (err) {
    ctx.store.close();
    out(toCliMessage(err));
    return 1;
  }
  ctx.store.close();

  const item = items.find((i) => i.id === id);
  if (item === undefined) {
    out(`my_context: no item with id "${id}". \`mycontext list\` prints the ids in this project.`);
    emitLoadErrors(errors, out);
    return 1;
  }

  const { ids: already } = readCarryOnce(root);
  if (already.includes(id)) {
    out(`my_context: ${id} is already marked, waiting for the next injection. Nothing changed.`);
    emitLoadErrors(errors, out);
    return 0;
  }

  if (!hasFlag(args, 'yes') && !json) {
    say(out,
      `about to mark ${item.id} ("${item.title}") for delivery at the next injection, ` +
      'regardless of its own budget. It is a front-of-queue index line — the same ' +
      'disclosure a cross-session carry already gets — not the full item text, and not a ' +
      'change to what governs it. The mark is spent by that one injection, whether or not the ' +
      'line is admitted, and is not renewed. This does not check whether the item is already ' +
      'in your current context — `mycontext status` or the spilled-items list answers that.');
  }
  if (!confirmAction(
    args, out,
    `Mark ${item.id} for delivery at the next injection?`,
  )) return 1;

  const { written, error } = markCarryOnce(root, item.id, 'human');
  if (!written) {
    out(`my_context: ${error}`);
    emitLoadErrors(errors, out);
    return 1;
  }
  out(
    `my_context: ${item.id} marked. It reaches the next injection as a front-of-queue index ` +
    'line, whether or not it fits, and the mark is then spent — run `mycontext carry --show` ' +
    'to see what is still queued.',
  );
  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'carry',
  usage: 'carry <id> [--show|--clear]',
  summary: 'mark one item for delivery at the next injection, then forget it (one-shot, not pin)',
  run: cmdCarry,
});
