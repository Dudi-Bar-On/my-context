import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  describeFocus, focusReportLines, isFocusActive, readFocus, relationTableLines,
  setFocus, unsetFocus,
  RELATION_CLASSIFICATION, type Focus, type FocusAxes, type FocusReport,
} from '../../core/focus.ts';
import { auditFailureNote } from '../../core/audit.ts';
import { select } from '../../core/select.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { emitJson, refuseUnknownFlag, wantsJson } from './format.ts';
import { dedupe, hasFlag, listFlag, positionals, registerCommand, type Emit } from './registry.ts';
import { confirmAction } from './review.ts';

/**
 * **`mycontext focus` — narrow what my_context injects, and be told what that
 * cost.**
 *
 * The requirement is `REQ-session-focus-controls-what-loads`, a `hard` item in
 * this project's own corpus, and the shape is plan decision Q2: focus discloses
 * and allows. It hides exactly what it was asked to hide, reports the number of
 * items hidden and the number of load-bearing relations that leaves dangling,
 * and never refuses a hide because something visible points at the item.
 *
 * **The preview is not a second implementation of the filter, and could not
 * be.** `--preview` and `--show` both call `select` — the one answer to "what
 * gets injected" — with the candidate focus in the context, and print the
 * `FocusReport` it comes back with. So what a preview promises and what a
 * session start delivers are computed by the same code on the same corpus; the
 * only way they can disagree is if the corpus changed in between. This project
 * has paid four times for two implementations of one rule, and a preview that
 * re-derived "would this be hidden" would have been the fifth.
 *
 * **What it is scoped to: the workspace.** Not the session — no surface that
 * can set a focus has a trustworthy session id (see the long note in
 * `core/focus.ts`, and `core/inject.ts` for the measurement behind it). The
 * cost of outliving a session is paid by disclosure: every injection under a
 * focus says so and names the command that clears it.
 */

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.focus;

const USAGE = [
  'usage: mycontext focus [<tag>…] [--tag t] [--category c] [--scope path-or-glob] [--yes]',
  '       mycontext focus --clear [--yes]',
  '       mycontext focus --show | --relations   [--json]',
  '       mycontext focus <tag>… --preview      (report the cost, change nothing)',
  '',
  'Positional arguments are tags. Axes combine: every axis given must match, and',
  'within one axis any value may. `severity: hard` items are never hidden.',
  '',
  '--yes belongs to the two forms that WRITE. The reporting forms refuse it.',
].join('\n');

/**
 * **The owner's ruling, 2026-09-04, as a refusal rather than as prose: "writes
 * take the boundary, the read does not."**
 *
 * `mycontext focus` is on the approval boundary now
 * (`DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the`), and the
 * boundary is about the two forms that change `state/focus.json` — `--clear`,
 * and setting an axis. `--show`, `--preview` and `--relations` report and
 * change nothing, and the owner's words about putting `--yes` on the whole
 * command were that it means asking *"are you sure you want to report
 * something?"*.
 *
 * The flag table (`core/command-flags.ts`) is flat per command and cannot
 * express that — its one question is whether the parser accepts a token. So the
 * split lives here, and it is a REFUSAL rather than a silent ignore, for the
 * reason `ack --code` is ("it means nothing without --all and is refused rather
 * than ignored"): a confirmation flag accepted where there is nothing to
 * confirm teaches a reader — and every script written against this command —
 * that focus asks before it reports. It does not, and it must not start.
 *
 * Refused AFTER `refuseUnknownFlag`, deliberately: the boundary probe in
 * `test/helpers/approval-boundary.ts` runs `focus --yes <sentinel>` and must
 * see the SENTINEL named, which is what places focus on the boundary at all. A
 * refusal ahead of the unknown-flag walk would answer `--yes` first and hide
 * the command from the very derivation this change exists to reach.
 */
function refusesYesOnRead(args: string[], out: Emit, form: string): boolean {
  if (!hasFlag(args, 'yes')) return false;
  out(
    `my_context: --yes means nothing on \`mycontext focus ${form}\`, which reports and ` +
    'changes nothing — there is no confirmation to answer. It is refused rather than ' +
    'ignored, because a confirmation accepted where nothing is confirmed teaches that this ' +
    `command asks before it reports.\nDrop --yes, or drop ${form}.\n${USAGE}`,
  );
  return true;
}

/** The report `select` produces for a focus, over the whole eligible corpus. */
function reportFor(ws: Workspace, focus: Focus | null, out: Emit): FocusReport | null {
  const { ctx, errors } = openMutateContext(ws);
  try {
    // `manual` rather than `session-start`: identical selection (see `select`),
    // and it is the honest name for "someone asked, outside a hook".
    const selection = select(ctx.store.all(), { event: 'manual', focus }, ws.config);
    return selection.focus;
  } finally {
    ctx.store.close();
    emitLoadErrors(errors, out);
  }
}

function axesFrom(args: string[]): FocusAxes {
  return {
    tags: dedupe([...positionals(args, VALUE_FLAGS), ...(listFlag(args, 'tag') ?? [])]),
    categories: listFlag(args, 'category') ?? [],
    scope: listFlag(args, 'scope') ?? [],
  };
}

function emitReport(out: Emit, report: FocusReport | null, json: boolean, heading: string): void {
  if (json) {
    emitJson(out, report);
    return;
  }
  out(heading);
  for (const line of focusReportLines(report!)) out(line);
}

function cmdFocus(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const json = wantsJson(args);
  const root = ws.projectRoot;

  try {
    if (hasFlag(args, 'relations')) {
      if (refusesYesOnRead(args, out, '--relations')) return 1;
      if (json) {
        emitJson(out, RELATION_CLASSIFICATION);
        return 0;
      }
      for (const line of relationTableLines()) out(line);
      return 0;
    }

    const axes = axesFrom(args);
    const asked = isFocusActive(axes);

    if (hasFlag(args, 'clear')) {
      // Refused rather than resolved: `--clear --tag billing` has two readings
      // ("clear then set" and "clear, ignoring the tag") and honouring either
      // silently discards an instruction the caller typed.
      if (asked) {
        out(
          'my_context: --clear takes no axes, and you passed some. Clearing and setting in ' +
          'one command has two readings and honouring either would drop the other without ' +
          `saying so. Run one, then the other.\n${USAGE}`,
        );
        return 1;
      }
      // **The gate.** `--clear` is
      // one of the two forms on the approval boundary: it widens what every
      // later session receives, and the sessions that receive it are not the
      // one that typed this. `confirmAction` is the CLI's one spelling of that
      // question (`--yes`, else a TTY prompt, else a refusal) and it is
      // imported rather than restated — `edit` and `inbox-promote` reach it
      // the same way.
      // **The disclosure comes BEFORE the question**, so that a refusal is
      // still worth having. Every other boundary command works this way —
      // `commands/refresh.md` tells the model in so many words to run it
      // WITHOUT `--yes`, print the preview it produces and hand it back, and
      // `exit 1` there is the expected outcome rather than a failure. A gate
      // whose refusal says only "rerun with --yes" gives a reader nothing to
      // decide with.
      //
      // Printed only when a question is actually going to be asked: with
      // `--yes` there is nothing to preview for, and the report below is the
      // one that prints.
      if (!hasFlag(args, 'yes') && !json) {
        const standing = readFocus(root);
        out(standing.focus !== null && isFocusActive(standing.focus)
          ? `my_context: the focus in force is ${describeFocus(standing.focus)}. `
            + 'Clearing it makes every eligible item injectable again.'
          : 'my_context: no focus is set, so clearing changes nothing.');
      }
      if (!confirmAction(
        args, out,
        'Clear the focus? Every eligible item becomes injectable again, in every later session.',
      )) return 1;
      const { existed, audit } = unsetFocus(root, 'human');
      out(existed
        ? `my_context: focus cleared. Every eligible item is injectable again.${auditFailureNote(audit)}`
        : 'my_context: there was no focus to clear. Nothing was hidden.');
      return 0;
    }

    if (!asked || hasFlag(args, 'show')) {
      if (refusesYesOnRead(args, out, '--show')) return 1;
      // `--show` with axes would be ambiguous in the same way `--clear` with
      // axes is, so it reports the STORED focus and says so.
      const state = readFocus(root);
      if (state.error !== null) {
        out(
          `my_context: \`.my_context/state/focus.json\` ${state.error}, so NO focus is in ` +
          'effect and nothing is hidden. Fix the file, or run `mycontext focus --clear` to ' +
          'remove it.',
        );
        return 1;
      }
      if (state.focus === null || !isFocusActive(state.focus)) {
        if (json) { emitJson(out, null); return 0; }
        out('my_context: no focus is set — every eligible item is injectable.');
        out('Set one with `mycontext focus <tag>`, or see `mycontext focus --relations`.');
        return 0;
      }
      emitReport(
        out, reportFor(ws, state.focus, out), json,
        `my_context: focus set ${state.focus.setAt} by ${state.focus.setBy}.`,
      );
      return 0;
    }

    const preview = hasFlag(args, 'preview');
    if (preview && refusesYesOnRead(args, out, '--preview')) return 1;
    const candidate: Focus = { ...axes, setAt: new Date().toISOString(), setBy: 'human' };
    const report = reportFor(ws, candidate, out);

    if (preview) {
      emitReport(out, report, json, 'my_context: preview only — nothing was changed.');
      if (!json) out('Apply it by running the same command without --preview.');
      return 0;
    }

    // **The confirm is asked AFTER the report is computed and names its cost**,
    // which is the whole of why the gate is here rather than beside
    // `refuseUnknownFlag` at the top. Focus discloses and allows (plan decision
    // Q2): a person answering "are you sure" about a narrowing is owed the
    // number of items it hides, and that number is `select`'s own — the same
    // one `--preview` prints, never re-derived. Nothing has been written when
    // this question is asked; `reportFor` only reads.
    // The same disclosure, and here it is the whole report: what would be
    // hidden, what is kept regardless, and what relations that leaves
    // dangling. Computed already — this prints it rather than asking again.
    //
    // **Suppressed under `--json`**, and that is not tidiness: `confirmAction`
    // prints its refusal as prose through this same `out`, so a JSON preview
    // ahead of it would put two documents and a sentence on one stream and
    // leave a parser with none. A caller asking for `--json` gets the exit code
    // and `--preview --json` if it wants the report.
    if (!hasFlag(args, 'yes') && !json) {
      emitReport(out, report, false, 'my_context: this focus is NOT set yet — here is what it '
        + 'would do.');
    }
    if (!confirmAction(
      args, out,
      report === null
        ? 'Set this focus? Later sessions receive only what it matches.'
        : `Set this focus? ${report.visible} item(s) stay in focus and ` +
          `${report.hidden.length} are hidden from every later session until it is cleared.`,
    )) return 1;

    const { audit } = setFocus(root, axes, 'human');
    emitReport(
      out, report, json,
      `my_context: focus set. Future injections narrow to it and say so.${auditFailureNote(audit)}`,
    );
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'focus',
  usage: 'focus [<tag>…] [--show|--clear]',
  summary: 'narrow what gets injected (--scope --category --preview --relations)',
  run: (ws, args, out) => cmdFocus(ws, args, out),
});
