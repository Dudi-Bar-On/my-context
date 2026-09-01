import path from 'node:path';
import { acknowledgementState } from '../../core/acknowledge.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { acknowledgeFinding } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks, type Finding } from '../../doctor/checks.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { outputWidth, paragraph, refuseUnknownFlag, table } from './format.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * **`mycontext ack <id> <code>` — a person rules on a doctor finding.**
 *
 * Owner ruling, 2026-08-27. The mechanism, the anchor and the honest limits are
 * all argued in `core/acknowledge.ts`; this file is the human boundary and it
 * adds exactly one guarantee of its own, which is the reason the verb exists at
 * all rather than a flag on `edit`.
 *
 * **It refuses to acknowledge a finding that is not there.** An acknowledgement
 * is a claim about something a person read. A typo — `body_disagees_with_meta`
 * — would otherwise write a permanent entry for a code no check emits: never
 * matched, never cleared, invisible in every report, and covered by the item's
 * checksum forever. So this command runs `doctor`'s own checks first and takes
 * the codes reported on THIS item as the vocabulary, which is stronger than any
 * list could be: it follows a check added tomorrow with no edit here, and it is
 * a fact about this corpus rather than about a table. When it refuses, it
 * prints what IS reported on the item, so the second attempt is a copy rather
 * than a guess (`STD-error-message-conventions` — a failed call should teach).
 *
 * **Why a verb and not `mycontext edit --acknowledge`.** `edit` changes what an
 * item SAYS, and its confirmation gate is sized to that: a normative active
 * item's edit shows what governs before and after and asks. An acknowledgement
 * changes nothing about what governs, so it would have to be carved out of that
 * gate — a special case inside the one command whose whole design is that its
 * ceremony scales with what the change can do. It also is not an `UpdateInput`
 * field (see `acknowledgeFinding`), so routing it through `edit` would mean
 * `edit` calling two mutation entry points and reporting one result.
 *
 * **There is no MCP tool, deliberately.** `acknowledgeFinding` refuses any
 * origin but `human`; this command is the only caller.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.ack;

const USAGE = 'usage: mycontext ack <id> <code> [--clear] [--list]';

/** The codes doctor currently reports for one item, with what each one is. */
function findingsFor(findings: Finding[], id: string): Finding[] {
  return findings.filter((f) => f.item === id);
}

/**
 * What is on the item now, printed as the answer to both `--list` and a refusal.
 *
 * One table rather than two shapes of the same information: the state column is
 * `acknowledgementState`'s own three words, so a `lapsed` ruling — one made
 * against content that has since moved — is visible here rather than only
 * inferable from the finding being reported open again.
 */
function reportState(item: Item, findings: Finding[], out: Emit): void {
  const own = findingsFor(findings, item.id);
  if (own.length === 0) {
    out(`my_context: doctor reports no findings on ${item.id}. There is nothing to acknowledge.`);
  } else {
    out(`my_context: doctor reports ${own.length} finding(s) on ${item.id}:`);
    out('');
    for (const line of table(
      ['code', 'level', 'acknowledgement'],
      own.map((f) => [f.code, f.level, acknowledgementState(item, f.code)]),
      { indent: '  ' },
    )) out(line);
    out('');
  }

  // Every acknowledgement the item carries whose code doctor is NOT reporting
  // right now. Never hidden: an entry nothing matches is exactly the state this
  // command's refusal exists to prevent, so on the day one exists anyway — a
  // check retired, a code renamed — it is named rather than left in the file
  // for nobody to find. `INV-nothing-is-dropped-silently`.
  const reported = new Set(own.map((f) => f.code));
  const orphaned = Object.keys(item.acknowledged).filter((c) => !reported.has(c)).sort();
  if (orphaned.length === 0) return;
  for (const line of paragraph(
    `${orphaned.length} acknowledgement(s) on this item name a code doctor is not reporting: ` +
    `${orphaned.join(', ')}. Either the finding cleared — in which case the entry is harmless ` +
    `and can be removed with \`mycontext ack ${item.id} <code> --clear\` — or the check that ` +
    `emitted it was renamed or retired.`,
    'my_context: ', outputWidth(), '  ',
  )) out(line);
}

function cmdAck(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let clear: boolean;
  let list: boolean;
  try {
    clear = hasFlag(args, 'clear');
    list = hasFlag(args, 'list');
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const rest = positionals(args, VALUE_FLAGS);
  const id = rest[0];
  const code = rest[1];
  if (id === undefined || (code === undefined && !list)) {
    out(`my_context: ack needs an item id and a doctor finding code.\n\n${USAGE}`);
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

  const item = items.find((i) => i.id === id);
  if (item === undefined) {
    ctx.store.close();
    out(`my_context: no item with id "${id}". \`mycontext list\` prints the ids in this project.`);
    emitLoadErrors(errors, out);
    return 1;
  }

  // The full doctor run, and it is the same `runChecks` `mycontext doctor`
  // calls with the same arguments — never a re-implementation narrowed to "the
  // checks that matter here". A command that refuses a code because its own
  // smaller check set did not emit it would be refusing on a fact about itself.
  //
  // The writable connection is closed BEFORE the checks, for the reason
  // `cmdDoctor` and `cmdStatus` both carry a comment about:
  // `checkIndexFreshness` stats the database's mtime, and SQLite only
  // checkpoints the WAL back into the file on close, so a still-open connection
  // makes a freshly rebuilt corpus report as stale.
  ctx.store.close();
  let findings: Finding[];
  try {
    findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
  } catch (err) {
    out(toCliMessage(err));
    emitLoadErrors(errors, out);
    return 1;
  }

  if (list) {
    reportState(item, findings, out);
    emitLoadErrors(errors, out);
    return 0;
  }

  // The refusal that makes this a verb worth having. `--clear` is exempt: a
  // code doctor no longer reports is precisely the acknowledgement somebody
  // needs to be able to remove, and refusing the removal would strand it.
  const reported = findingsFor(findings, item.id).map((f) => f.code);
  if (!clear && !reported.includes(code!)) {
    out(
      `my_context: doctor does not report "${code}" on ${item.id}, so there is nothing to ` +
      `acknowledge. An acknowledgement records that a person read a finding; one written ` +
      `against a code no check emits would never match anything and never clear.`,
    );
    out('');
    reportState(item, findings, out);
    emitLoadErrors(errors, out);
    return 1;
  }

  // Reopened for the write. The read above needed the connection closed; the
  // mutation needs one, and re-opening is what `openMutateContext` is for.
  const { ctx: writeCtx } = openMutateContext(ws);
  try {
    const result = acknowledgeFinding(writeCtx, { id: item.id, code: code!, on: !clear });
    for (const line of paragraph(result.message, '', outputWidth(), '  ')) out(line);
  } catch (err) {
    out(toCliMessage(err));
    emitLoadErrors(errors, out);
    return 1;
  } finally {
    writeCtx.store.close();
  }

  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'ack',
  usage: 'ack <id> <code> [--clear] [--list]',
  summary: 'record that a person has ruled on a doctor finding, anchored to the item as it stands',
  run: cmdAck,
});
