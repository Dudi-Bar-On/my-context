import { askHandoverNow, type OnDemandAsk, type RunningLane } from '../../core/handover-ask.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { occupancyStandDownLine } from '../../core/context-occupancy.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitJson, outputWidth, paragraph, refuseUnknownFlag, wantsJson } from './format.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * **`mycontext handover ask` — the handover, asked for on demand.**
 *
 * `DEC-a-handover-can-be-asked-for-on-demand-and-the-ask-is-the`, owner ruling
 * 2026-09-06, in his own words: *"i want you to implement all 3 ways: a cli
 * command, a slash command and a MCP tool, all should trigger handover update
 * on demand."* The use case is his own — he does not want to wait for the
 * threshold before compacting or starting a new session.
 *
 * **This command decides NOTHING.** Every decision — which session is asking,
 * what the occupancy is, whether work is in flight, and each refusal — is
 * `core/handover-ask.ts`'s `askHandoverNow`, and this module renders what comes
 * back. That is the whole point of the ruling's own sentence about three
 * surfaces: *the three surfaces are ENTRY POINTS, not implementations*. The MCP
 * tool (`ask_handover`) calls the same function and renders the same fields;
 * `commands/handover.md` runs THIS command.
 *
 * ── WHY THE VERB IS A POSITIONAL ───────────────────────────────────────────
 *
 * `handover ask` rather than `handover-ask`, and rather than a bare `handover`
 * that asks. `handover/11` — *"there is no way to keep the handover injected
 * while turning the automatic ask off"* — wants the OPPOSITE control on this
 * same surface and is deliberately not built here. A verb slot is what leaves
 * room for it without a second command and without changing this one's flags:
 * `mycontext handover mute` / `handover unmute` would be two more branches in
 * the body below and two more entries in `COMMAND_FLAGS.handover`'s existing
 * flat set. A bare `mycontext handover` that asked would have made the same
 * addition ambiguous — the no-verb form would then mean one of the two.
 *
 * It stays a FLAT entry in `COMMAND_FLAGS` rather than a `SUBCOMMAND_FLAGS`
 * one, exactly as `carry` and `focus` are: one accepted set, forms split in the
 * body. `SUBCOMMAND_FLAGS` is for commands whose subcommands take DIFFERENT
 * flags, which these do not.
 *
 * ── INSIDE CLAUDE CODE, OR NOWHERE ─────────────────────────────────────────
 *
 * Owner ruling 2026-09-06: *"another thing we cant do is to allow this action
 * only if it is done from inside claude code app and not elsewere."* So this is
 * the one command in the CLI that is not really for a terminal. It is reached
 * three ways, and only the last of them is a person typing:
 *
 *  - `/mycontext:handover` — the slash command runs THIS command through a tool
 *    call, so it is inside a session by construction;
 *  - the `ask_handover` MCP tool, in a server Claude Code started;
 *  - the assistant running `mycontext handover ask` in a shell of its own,
 *    which is the same environment.
 *
 * A person in a terminal they opened themselves is refused, and that is the
 * ruling working rather than a gap in it. `sessionFromEnvironment` in
 * `core/handover-ask.ts` says exactly what the signal is and exactly how strong
 * it is not.
 *
 * ── THE REFUSALS, AND WHY EACH IS A REFUSAL RATHER THAN A DEFAULT ──────────
 *
 * They are argued where they are decided (`OnDemandAskVerdict`), and the
 * shortest form of all of them is one sentence: this command stamps a
 * per-session latch with a measured percentage, and every one of the values it
 * could have made up instead would have been believed.
 *
 * ── WHAT A RUNNING LANE COSTS, AND WHO DECIDES ─────────────────────────────
 *
 * Owner ruling 2026-09-06, on being shown that two lanes were live in the files
 * this command was being added to: *"if somthing is running you should say it
 * and the the user could wait for the coliding to complete or choose to stop or
 * pause it in order to execute the update handover command."* So a running lane
 * is disclosed BY NAME and the command stops; `--anyway` is the person saying
 * they have chosen. Neither direction is taken silently.
 *
 * **There is no stop and no pause here, and that is stated rather than
 * implied.** my_context has no control that ends a lane — nothing in the CLI,
 * the MCP surface or the hooks kills a subagent, and `hooks/subagent-start.ts`
 * says in as many words that *the only thing that can end it is Claude Code
 * killing it*. Building a process-killer to satisfy the word "stop" would be a
 * new power for this plugin, decided by a lane rather than by its owner. So the
 * disclosure offers WAITING, and names stopping as something the person does in
 * Claude Code itself.
 */

const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.handover;

const USAGE = [
  'usage: mycontext handover ask [--anyway] [--json]',
  '',
  'Asks for the handover NOW, at whatever the context window currently holds —',
  'the same ask the Stop hook makes at the threshold, so every reader of it (the',
  'status line, the watch screen, PreCompact, SessionEnd) works unchanged.',
  '',
  'It can only be run from INSIDE a Claude Code session — it asks the session you',
  'are in to write its handover, so outside one there is nothing to ask. It also',
  'refuses when the occupancy cannot be read, and when this session still has',
  'lanes running (--anyway proceeds past that one). Every refusal says why, and',
  'says that nothing was written.',
].join('\n');

function say(out: Emit, text: string): void {
  for (const line of paragraph(text, '', outputWidth(), '  ')) out(line);
}

/** `2026-09-06T14:37:57.150Z` -> `14:37:57`, or an em dash for an absent one. */
function clock(iso: string | null): string {
  if (iso === null) return '—';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : at.toISOString().slice(11, 19);
}

/**
 * One line per running lane, and it names the lane rather than counting it.
 *
 * The owner's ruling turns on this: *a person cannot choose between waiting and
 * stopping without knowing what they would be stopping*. So the dispatch's own
 * description is printed whole, and `lastStepAt` is drawn as an em dash when
 * nothing has been observed since the dispatch — never as the dispatch time,
 * which would claim an activity nobody measured.
 */
function laneLines(running: RunningLane[]): string[] {
  return running.map((lane) => {
    const what = lane.what ?? '(the dispatch row carried no description)';
    const type = lane.type === null ? '' : ` [${lane.type}]`;
    return `  ${lane.agentId}${type}  ${what}\n` +
      `    dispatched ${clock(lane.dispatchedAt)}, last step ${clock(lane.lastStepAt)}`;
  });
}

/** The human rendering of one result. Returns the process exit code. */
function report(result: OnDemandAsk, out: Emit): number {
  if (result.verdict === 'asked') {
    out(`my_context: ${result.note}.`);
    out('');
    say(out, result.ask);
    out('');
    say(out,
      `Recorded against session ${result.sessionId}. Whether it was acted on is decided the ` +
      `same way every other ask is: by whether ${result.path} is written after ` +
      `${result.askedAt}.`);
    return 0;
  }

  out(`my_context: ${result.note}.`);

  if (result.verdict === 'outside-session') {
    out('');
    say(out,
      'Nothing here can name a session for you, on purpose: an id typed by hand that happens ' +
      'to be wrong succeeds silently against another session\'s latch. From inside Claude ' +
      'Code — `/mycontext:handover`, the `ask_handover` tool, or this command run by the ' +
      'assistant — the session names itself.');
  }

  if (result.verdict === 'no-occupancy' && result.why !== null) {
    out('');
    // The bridge's own stand-down sentence, verbatim, rather than a second
    // wording of the same four reasons: the person who has to install or wait
    // for the bridge should read one sentence about it, not two that differ.
    out(occupancyStandDownLine(result.why).trimEnd());
  }

  if (result.verdict === 'work-in-flight') {
    out('');
    for (const line of laneLines(result.running)) out(line);
    out('');
    say(out, 'Choose one, because this command will not choose for you:');
    out('  • wait for them to finish, then run this again;');
    out('  • stop or pause them yourself in Claude Code — my_context has no control that ends ' +
      'a lane, and none is added here — then run this again;');
    out('  • run `mycontext handover ask --anyway` to ask now, accepting that a handover ' +
      'written while those lanes are still writing describes work that is still moving.');
  }

  if (result.verdict === 'work-unknown') {
    out('');
    say(out,
      'This is not "nothing is running": it is "nobody could tell". `mycontext doctor` reports ' +
      'on the audit log; `mycontext handover ask --anyway` proceeds without the answer.');
  }

  return 1;
}

function cmdHandover(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  // Flags BEFORE the positional, deliberately. `test/helpers/approval-boundary.ts`
  // probes every command's flag surface by handing it a sentinel flag, and a
  // command that reports a missing positional first is one that probe cannot
  // reach — five commands sat in exactly that gap until `plan:builder seq:1c`
  // and had to be excused by name.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const json = wantsJson(args);
  const rest = positionals(args, VALUE_FLAGS);
  const verb = rest[0];

  if (verb === undefined) {
    out(`my_context: handover needs a verb. The only one today is \`ask\`.\n\n${USAGE}`);
    return 1;
  }
  if (verb !== 'ask') {
    out(
      `my_context: "${verb}" is not something handover does. The only verb today is \`ask\`, ` +
      'which asks for the handover now, at whatever the context window currently holds.\n\n' +
      USAGE,
    );
    return 1;
  }
  if (rest.length > 1) {
    out(
      `my_context: handover ask takes no operand, and "${rest[1]}" was given. There is ` +
      `nothing to name: the session is the one this is running inside.\n${USAGE}`,
    );
    return 1;
  }

  const result = askHandoverNow(ws.projectRoot, { anyway: hasFlag(args, 'anyway') });

  if (json) {
    emitJson(out, result);
    return result.verdict === 'asked' ? 0 : 1;
  }
  return report(result, out);
}

registerCommand({
  name: 'handover',
  usage: 'handover ask [--anyway]',
  summary: 'ask for the handover NOW, at whatever the window holds (--anyway: past running lanes)',
  run: cmdHandover,
});
