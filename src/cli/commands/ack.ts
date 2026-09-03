import path from 'node:path';
import { acknowledgementState } from '../../core/acknowledge.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { acknowledgeFinding } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks, type Finding } from '../../doctor/checks.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { outputWidth, paragraph, refuseUnknownFlag, table } from './format.ts';
import {
  flag, flagOccurrences, hasFlag, positionals, registerCommand, type Emit,
} from './registry.ts';

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

const USAGE = `usage: mycontext ack <id> <code> [--clear] [--list]
       mycontext ack --all --code <code> [--count <n>]
             (one ruling for every finding of one code — the preview prints first and
              names everything it skips; --count is how the ruling is consented to)`;

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

/* ---------------------------------------------------------------------------
 * `mycontext ack --all --code <code>` — one ruling for a whole class.
 * ------------------------------------------------------------------------- */

/**
 * **Why a bulk settlement exists at all, and why ruling per CODE is honest.**
 *
 * `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`, owner
 * ruling 2026-09-03, overturning his own no-bulk ruling of 2026-08-31 in one
 * word — asked directly whether he wanted it overturned, he answered "yes".
 * His reason, in his words: *"for notices that could be many items, we need to
 * have a capability to fix all of them at once using doctor"*. The measurement
 * behind it: this repository reports 71 findings, 70 of which route to
 * `acknowledge`. One at a time that is seventy confirmations, and **a gate
 * nobody can afford to pass is not a gate** — it is a screen people stop
 * reading, which is worse than the risk the original ruling was protecting
 * against.
 *
 * **RULING PER CODE IS RULING ON ONE THING READ ONCE, NOT ON N THINGS
 * SKIPPED.** This is the load-bearing claim and it is measured rather than
 * argued. The 2026-09-01 text-shortening pass counted the Doctor screen:
 * 42,353 characters of `Finding.message`, of which **34,440 were one paragraph
 * reprinted per row**. Thirty-four `citation_form` rows carry one 943-character
 * explanation each; thirty-four `body_disagrees_with_meta` rows say the same
 * sentence thirty-four times. `screens/doctor.js`'s `sharedTail` finds that
 * shared remainder and draws it ONCE, which is only sound because the findings
 * of one code genuinely share one argument. The same fact is what makes this
 * command honest: a person who has read the argument for a code has read what
 * every finding of that code says. What differs per row is which item it lands
 * on, and that is named in the preview below, every one of them.
 *
 * **THE SHAPE IS INHERITED, NOT INVENTED.** `review promote --all --pack
 * <name>` (cli/commands/review.ts) is the only sanctioned bulk act in this
 * product, and its three rules hold here unchanged:
 *
 *  1. **A bulk act is licensed by a NAMED, BOUNDED SET.** `--all` needs
 *     `--code`, exactly as it needs `--pack` there: *"There is no unbounded
 *     bulk promote here"*. There is no unbounded bulk settlement here either.
 *  2. **Per-item decisions are refused inside a bulk act.** `--clear` withdraws
 *     ONE person's ruling on ONE item and is refused with `--all`; so is an id
 *     positional, because the two name different acts and honouring either
 *     would honour it against a command line that asked for the other.
 *  3. **The full preview prints BEFORE the gate and regardless of consent, and
 *     everything skipped is NAMED** — because a bulk operation that reports
 *     only its successes is the exact shape of a silent drop
 *     (`INV-nothing-is-dropped-silently`).
 *
 * ── HOW CONSENT IS SPELLED, AND WHY IT IS NOT `--yes` ──────────────────────
 *
 * **`--count <n>` is the consent, and it is the only one.** `mycontext ack`
 * accepts no `--yes` and still does not.
 *
 * The governing constraint is
 * `DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing`, which
 * refused a one-token flag for a bulk re-affirmation on COST: *"A flag is one
 * token: `--summary-unchanged` could be typed over every stale summary in a
 * corpus, in a loop, without one of them being read … The guard is intrinsic to
 * the act rather than bolted onto it."* The bulk decision quotes that argument
 * forward: *"Whatever stands in for consent here is intrinsic to the act rather
 * than bolted onto it."* `--yes` is the definition of bolted on — one token,
 * the same token on nineteen other commands, muscle memory, and it says nothing
 * about what is being agreed to.
 *
 * A COUNT cannot be typed without having read the preview that names it. It
 * costs the same keystrokes as `--yes` and buys three things `--yes` cannot:
 *
 *  - **It cannot be a habit.** The number is different for every act, so there
 *    is no form of it that can be typed ahead of reading.
 *  - **It refuses when the corpus has moved.** Between the run that printed the
 *    preview and the run that settles, a check can start firing on six more
 *    items. `--yes` would settle those six unseen; a count that no longer
 *    matches is refused, naming both numbers. `review promote --all` has no
 *    equivalent guard, so this is strictly stronger than the precedent rather
 *    than weaker than it.
 *  - **It keeps the approval boundary honest.** `approvalBoundary()`
 *    (test/helpers/approval-boundary.ts) DERIVES the set of commands that
 *    change what governs this project with no human in the loop by asking the
 *    real parser which commands accept `--yes` — and §7 of both READMEs and
 *    `skills/mycontext/SKILL.md`, the surface the model reads at every session
 *    start, are held to that derivation. An acknowledgement changes NOTHING
 *    about what governs: it records that a person read a finding, against the
 *    item as it stands. That is this file's own argument for why `ack` is a
 *    verb and not a flag on `edit`, and it is why `palette-defs.js` carries
 *    `boundary: false` on this entry. Adding `--yes` here would make the
 *    derivation report `ack` as boundary-crossing — a false claim, in the one
 *    place whose whole value is that it is exact — and it would additionally
 *    give every SINGLE acknowledgement the field-by-field-diff confirm and its
 *    full-corpus dry run, which is ceremony bought for the seventy acts that
 *    did not need it.
 *
 * **The non-interactive path is therefore not a special case, and that is the
 * point.** `confirmAction` (review.ts) refuses off a TTY and takes `--yes` as
 * the answer, which is why the Doctor screen's `refresh` remedy has to carry
 * `yes: true` — a command run from the UI is a child process with no terminal.
 * `--count` needs no such carve-out: it is answered the same way from a
 * terminal, from a script and from the browser, so the line a person reads on
 * the card is byte for byte the line that runs. There is no second spelling of
 * consent to keep in agreement with the first.
 *
 * ── WHAT IS OUT OF SCOPE, STATED RATHER THAN LEFT TO BE DISCOVERED ─────────
 *
 * Only `route: 'acknowledge'` findings are settled. A code whose findings route
 * to `run` is left alone with its reason named: bulk-running `refresh` would
 * rewrite N bodies, which is a different act with a different gate. And
 * `--clear` is refused with `--all`: withdrawing seventy rulings is not the act
 * the owner asked for, and it would be a bulk act nobody has ruled on.
 */

/** The skip reason for one finding of the named code, or `null` if it settles.
 *
 * Exported for the same reason `promoteAllSkipReason` is: the branches are the
 * whole of what "everything skipped is named" means, and two of them are
 * awkward to reach through a real corpus — a finding with no item, and a code
 * whose findings carry mixed routes (`source_drift` emits `ACK` on one branch
 * and a `refresh` remedy on another, so mixed is real and not hypothetical).
 *
 * `alreadyRuled` is `Finding.acknowledged`, which `runChecks` sets through
 * `markAcknowledged` after every check has run — asked of the finding rather
 * than recomputed here, so this reports the same state the doctor report and
 * the Doctor screen draw. */
export function ackAllSkipReason(
  finding: { item?: string; acknowledged?: true; remedy: { route: string } },
  itemExists: boolean,
): string | null {
  if (finding.item === undefined || finding.item === '') {
    return 'names no item, and an acknowledgement is anchored to an item\'s content';
  }
  if (!itemExists) return 'names an item this workspace does not have';
  if (finding.remedy.route !== 'acknowledge') {
    return `its remedy is "${finding.remedy.route}", not a ruling — settled one at a time`;
  }
  if (finding.acknowledged === true) return 'already acknowledged against its current content';
  return null;
}

/** `--count` as a number, or `null` for anything that is not a plain count.
 *
 * Strict on purpose. `Number('34 ')` is 34 and `Number('0x22')` is 34 as well,
 * and a consent token that accepts two spellings of one number is a consent
 * token whose value a reader cannot verify by looking at it. The digits are the
 * digits the preview printed. */
export function parseCount(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  return Number(raw);
}

/** The preview's skip block: every skipped finding named, with its reason. */
function emitSkipped(skipped: { id: string; reason: string }[], total: number, out: Emit): void {
  if (skipped.length === 0) return;
  for (const line of paragraph(
    `skipping ${skipped.length} of the ${total} finding(s) doctor reports for this code:`,
    '', outputWidth(), '  ',
  )) out(line);
  // **Two lines per skip, and NOT `review promote --all`'s padded column.**
  // That command pads the id and hangs the reason under it, which reads well
  // for pack member ids. Item ids in this corpus run to 65 characters — the
  // longest in the table above is `KNOWN-every-command-the-product-tells-a-user-
  // to-run-begins-with-a` — so a padded column would start the reason past the
  // right edge and wrap it back under nothing. The id gets its own line and the
  // reason is indented under it, which cannot be misread at any id length.
  for (const s of skipped) {
    out(`  ${s.id}`);
    for (const line of paragraph(s.reason, '      ', outputWidth(), '      ')) out(line);
  }
}

/**
 * `mycontext ack --all --code <code> [--count <n>]`.
 *
 * Reached whenever ANY of the three bulk flags is present, so that every
 * refusal below belongs to this act rather than being reported by the one-item
 * path as a missing id — a bulk settlement refused for "no id" would be refused
 * for the one thing it is not missing. `review promote --all` takes the same
 * cut for the same reason.
 */
function cmdAckAll(ws: Workspace, args: string[], rest: string[], out: Emit): number {
  const all = hasFlag(args, 'all');
  const code = flag(args, 'code');
  const rawCount = flag(args, 'count');

  if (!all) {
    const named = ['code', 'count'].filter((n) => flagOccurrences(args, n).length > 0);
    say(out,
      `my_context: ${named.map((n) => `--${n}`).join(' and ')} ` +
      `${named.length === 1 ? 'belongs' : 'belong'} to the bulk form and ` +
      `${named.length === 1 ? 'means' : 'mean'} ` +
      'nothing on its own — a ruling on one finding is named by an item id and a code, as ' +
      'two operands. Nothing was written. Pass `--all --code <code>` to rule on a whole class, ' +
      'or drop the flag and name the item you mean.');
    return 1;
  }
  if (code === null || code === '') {
    say(out,
      'my_context: --all needs --code <code>. There is no unbounded bulk settlement here: the ' +
      'licence a bulk act can be given is for a class a human just named, not for every finding ' +
      'in this workspace, which is why this is refused rather than defaulted. Findings of one ' +
      'code share one argument — that is what makes ruling on the class ruling on one thing ' +
      'read once — and findings of two codes do not. `mycontext doctor` prints the code on ' +
      'every line.');
    return 1;
  }
  if (rest.length > 0) {
    say(out,
      `my_context: --all rules on a whole class and ${rest[0]} names one item, so this command ` +
      'line asks for two different rulings. Nothing was written. Drop --all to rule on ' +
      `${rest[0]} alone, or drop the operand to rule on everything --code names.`);
    return 1;
  }
  if (hasFlag(args, 'clear') || hasFlag(args, 'list')) {
    const named = ['clear', 'list'].filter((n) => hasFlag(args, n));
    say(out,
      `my_context: ${named.map((n) => `--${n}`).join(' and ')} ` +
      `${named.length === 1 ? 'is refused' : 'are refused'} with --all. --list reports on ONE ` +
      'item and --clear withdraws ONE ruling a person made; neither is the act --all performs, ' +
      'and a bulk withdrawal of rulings nobody re-read is not an act anyone has asked for. ' +
      'Nothing was written.');
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

  // The full doctor run — the same `runChecks` `mycontext doctor` calls, for
  // the reason the one-item path already carries: a bulk act that refused a
  // code because its own smaller check set did not emit it would be refusing on
  // a fact about itself. The writable connection is closed BEFORE the checks
  // for `checkIndexFreshness`'s reason, also stated on the one-item path.
  ctx.store.close();
  let findings: Finding[];
  try {
    findings = runChecks({
      root: ws.projectRoot!,
      repoRoot: path.dirname(ws.projectRoot!),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
  } catch (err) {
    out(toCliMessage(err));
    emitLoadErrors(errors, out);
    return 1;
  }

  const mine = findings.filter((f) => f.code === code);
  if (mine.length === 0) {
    // The same refusal shape the one-item path makes, and for the same reason:
    // a ruling written against a code no check emits would never match anything
    // and never clear. The vocabulary offered is this corpus's, not a table's.
    const reported = [...new Set(findings.map((f) => f.code))].sort();
    say(out,
      `my_context: doctor reports no finding with code "${code}" in this project, so there is ` +
      'nothing to rule on. Nothing was written.');
    out('');
    say(out, reported.length === 0
      ? 'doctor reports no findings at all here.'
      : `The codes it does report: ${reported.join(', ')}.`);
    emitLoadErrors(errors, out);
    return 1;
  }

  const known = new Set(items.map((i) => i.id));
  const settle: Finding[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const finding of mine) {
    const reason = ackAllSkipReason(finding, finding.item !== undefined && known.has(finding.item));
    if (reason === null) settle.push(finding);
    else skipped.push({ id: finding.item === undefined || finding.item === '' ? '(no item)' : finding.item, reason });
  }
  // An acknowledgement is keyed by (item, code), so two findings of one code on
  // one item are ONE ruling and one audit record. `checkDeadScopes` emits a
  // finding per dead glob, so this is a real case rather than a defensive one —
  // and a count that said 12 while writing 9 would be a consent token measuring
  // something other than what happens.
  const targets = [...new Set(settle.map((f) => f.item!))].sort();

  // ── THE PREVIEW, printed before the gate and regardless of consent ────────
  if (targets.length > 0) {
    say(out,
      `about to acknowledge "${code}" on ${targets.length} item(s), settling ` +
      `${settle.length} finding(s) — one ruling per item, each recording that a person read ` +
      'this finding and ruled on it against the item as it stands.');
    out('');
    for (const line of table(
      ['item', 'level'],
      targets.map((id) => [id, [...new Set(settle.filter((f) => f.item === id).map((f) => f.level))].join(', ')]),
      { indent: '  ' },
    )) out(line);
    out('');
  }
  emitSkipped(skipped, mine.length, out);
  if (skipped.length > 0) out('');

  // Said HERE, in the preview, rather than only after the write: it is the one
  // property of this act a reader could get wrong, and getting it wrong makes
  // the act look like a mute button. `core/acknowledge.ts` argues it at length.
  say(out,
    'an acknowledgement is a MARK and never a filter: every finding above stays computed, ' +
    'stays reported, stays counted and moves the exit code exactly as much as it does now. ' +
    'Each ruling is recorded per item, so `mycontext ack <id> ' + code + ' --clear` withdraws ' +
    'any one of them on its own.');
  out('');

  if (targets.length === 0) {
    say(out,
      `my_context: nothing to settle — not one of the ${mine.length} "${code}" finding(s) is a ` +
      'ruling this command can record. Every one is named above with its reason. Nothing was ' +
      'written.');
    emitLoadErrors(errors, out);
    return 0;
  }

  // ── THE GATE ─────────────────────────────────────────────────────────────
  // One consent, for the set, taken after the preview. See the header for why
  // it is a count and not `--yes`.
  if (rawCount === null) {
    say(out,
      `my_context: refusing without consent. Read the ${settle.length} finding(s) above and ` +
      `rerun with the count to record the ruling:`);
    out('');
    out(`  mycontext ack --all --code ${code} --count ${settle.length}`);
    out('');
    say(out,
      'The count is the consent, and it is deliberately not a one-token flag: a number cannot ' +
      'be typed without having read the preview that names it, and it is refused if the corpus ' +
      'moves before you run it. Nothing was written.');
    emitLoadErrors(errors, out);
    return 1;
  }
  const count = parseCount(rawCount);
  if (count === null) {
    say(out,
      `my_context: --count is "${rawCount}", which is not a count. It takes the plain digits of ` +
      `the number of findings this will settle — here, ${settle.length}. Nothing was written.`);
    emitLoadErrors(errors, out);
    return 1;
  }
  if (count !== settle.length) {
    say(out,
      `my_context: --count says ${count} and doctor reports ${settle.length} "${code}" ` +
      'finding(s) waiting for a ruling right now. Nothing was written. The two disagree either ' +
      'because the corpus moved since the preview you read — a check started or stopped firing, ' +
      'an item was edited, somebody ruled on one of these — or because the number was typed ' +
      'rather than read. Either way the set in front of you is not the set the number was ' +
      `agreed for. Read the preview above and rerun with --count ${settle.length}.`);
    emitLoadErrors(errors, out);
    return 1;
  }

  // ── THE WRITE: one call, one audit record, per ITEM ──────────────────────
  // Never one record for the batch. Each ruling stays individually attributable
  // — `mycontext audit --item <id>` answers for it alone — and individually
  // clearable, which a single batch record could support neither of.
  const { ctx: writeCtx } = openMutateContext(ws);
  const done: string[] = [];
  try {
    for (const id of targets) {
      acknowledgeFinding(writeCtx, { id, code, on: true });
      done.push(id);
    }
  } catch (err) {
    // There is no transaction here. The partial state is NAMED rather than left
    // for the user to discover — `review promote --all`'s precedent.
    out(toCliMessage(err));
    say(out,
      `${done.length} of the ${targets.length} item(s) were acknowledged and are recorded` +
      `${done.length === 0 ? '' : ` — ${done.join(', ')}`}. The rest are untouched, and running ` +
      'this again rules on them: the preview will name the smaller set and the count with it.');
    writeCtx.store.close();
    emitLoadErrors(errors, out);
    return 1;
  } finally {
    writeCtx.store.close();
  }

  say(out,
    `my_context: acknowledged "${code}" on ${done.length} item(s) — ${done.join(', ')}. ` +
    `${settle.length} finding(s) are now reported as acknowledged rather than open. They are ` +
    'still reported and still counted; editing an item\'s content lapses its ruling and its ' +
    'finding opens again.');
  emitLoadErrors(errors, out);
  return 0;
}

/** `out` for a sentence rather than a line, wrapped to the layout budget. The
 * spelling `review` and `status` already use, for the reason they give: a
 * 180-column explanation is rewrapped by the terminal with no indent. */
function say(out: Emit, text: string): void {
  for (const line of paragraph(text, '', outputWidth(), '  ')) out(line);
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

  // The bulk form is dispatched on the PRESENCE of any of its three flags, not
  // on `--all` alone: `--code` or `--count` typed without `--all` is a bulk
  // command line missing a piece, and reporting it as a missing item id would
  // answer a question the user did not ask. `cmdAckAll` refuses it by name.
  if (['all', 'code', 'count'].some((name) => flagOccurrences(args, name).length > 0)) {
    return cmdAckAll(ws, args, rest, out);
  }

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
  // The bulk form is on the usage line rather than only in `USAGE`, because
  // `mycontext --help` prints THIS string and a form nobody can see is a form
  // nobody uses. It stays one line: `subcommandedFromUsage`
  // (test/helpers/approval-boundary.ts) reads the first token after the command
  // name to decide whether a command dispatches by subcommand, and `<id>` says
  // plainly that this one does not.
  usage: 'ack <id> <code> [--clear] [--list], or ack --all --code <code> [--count <n>]',
  summary: 'record that a person has ruled on a doctor finding, anchored to the item as it stands',
  run: cmdAck,
});
