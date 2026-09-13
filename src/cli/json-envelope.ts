/**
 * **`--json` means JSON on every exit path, including the failing ones.**
 *
 * ── WHAT WAS MEASURED, 2026-09-13 ──────────────────────────────────────────
 *
 *     $ mycontext query --json --nosuchflag
 *     my_context: unknown flag "--nosuchflag" for `query`. …
 *     stdout: 380 bytes   exit: 1
 *
 * Not empty — plain English prose on the channel a consumer was promised JSON
 * on. That is worse than nothing: a script checking for empty output is fine,
 * and a script that parses what it asked for gets a `SyntaxError` at character
 * 0 naming `my_context`, with the real reason sitting inside the string that
 * broke the parser.
 *
 * ── THE THREE THINGS `rulings/72` SAID TO SETTLE RATHER THAN ASSUME ─────────
 *
 * **WHICH STREAM: stdout, and the decision is not close.** `runCli` has exactly
 * ONE emit — `Emit = (s: string) => void` — and no stderr channel exists at any
 * layer beneath it, so "put refusals on stderr" is not a flag to flip but a
 * second channel to thread through 48 commands and every test that drives them.
 * More decisively, it would not fix anything: the consumer's complaint is that
 * stdout carried something it could not parse, and moving the prose to stderr
 * leaves stdout EMPTY on failure — which is the defect the review originally
 * reported and the one the measurement disproved. The reason belongs where the
 * reader is looking. The EXIT CODE is what separates success from failure and
 * it is untouched, which is the whole point: this makes the channel honest, not
 * the failure quiet.
 *
 * **WHICH COMMANDS: derived, never listed.** `jsonEnvelopeFor` reads
 * `COMMAND_FLAGS` and `SUBCOMMAND_FLAGS` — the same two tables
 * `refuseUnknownFlag` is handed by every command, and which
 * `test/cli/command-flags.test.ts` already requires to cover exactly the
 * registered command set, in both directions. A command that gains `--json`
 * gains the envelope in the same edit; a command that never had `--json` (`show`
 * and the other two in `FLAGLESS_COMMANDS`) is not given a JSON contract it does
 * not honour on success. A hand-kept list of "the JSON commands" is this
 * project's own D51 pattern and it is the shape it keeps getting bitten by.
 *
 * **THE HUMAN FORM IS UNCHANGED**, because the envelope is only reached when
 * `--json` was actually typed.
 *
 * ── THE ONE PASS-THROUGH, AND WHY IT IS NOT AN EXCEPTION ────────────────────
 *
 * A non-zero run whose output ALREADY parses as JSON is emitted untouched.
 * `mycontext doctor --json` exits non-zero when it finds errors and its body is
 * a perfectly good JSON report; wrapping that in an error envelope would replace
 * a machine-readable answer with a machine-readable complaint. The rule is
 * stated as what it is — *the channel must carry JSON* — rather than as a list
 * of commands it does not apply to, so it cannot go stale.
 *
 * ── WHAT THE ENVELOPE CARRIES, AND WHAT IT DELIBERATELY DOES NOT ────────────
 *
 * `command`, `subcommand`, `exit`, `argv` and `message` — the verbatim sentence
 * the human form prints, newlines and all. Every one of those is known AT THE
 * BOUNDARY, which is why this needs no per-command work and cannot drift.
 *
 * `rulings/72` also asked for the id a command could not find and the flag it
 * refused as their own fields. They are not here, and that is a decision rather
 * than an omission: a command can only hand structured detail up through its
 * return value (`CommandFn` returns `number`, and widening it is the
 * "signature change across every command in the CLI" `core/command-flags.ts`
 * refused for the same reason) or through module-level mutable state, which is
 * a hidden channel between a refusal and a boundary that is re-entered by every
 * test in the suite. `argv` carries the id the caller passed and the flag they
 * typed, structurally; `message` says which of them is the problem.
 */
import { COMMAND_FLAGS, SUBCOMMAND_FLAGS } from '../core/command-flags.ts';

/** What a `--json` failure emits, on stdout, instead of prose. */
export interface JsonErrorEnvelope {
  error: {
    command: string;
    subcommand?: string;
    exit: number;
    argv: string[];
    message: string;
  };
}

/**
 * The command/subcommand pair whose failures must be JSON, or `null` when this
 * invocation is not one — the command does not declare `--json`, or it does and
 * the caller did not ask for it.
 *
 * `argv[0]` is the command; a subcommand is `argv[1]` only when the command has
 * a subcommand table AND the token answers to an entry in it, so `mycontext
 * conversation --json` (no subcommand) and `mycontext conversation nonsense
 * --json` both fall back to the top-level spec rather than inventing one.
 */
export function jsonEnvelopeFor(
  argv: string[], jsonAsked: (args: string[]) => boolean,
): { command: string; subcommand?: string } | null {
  const command = argv[0];
  if (command === undefined) return null;
  const args = argv.slice(1);

  const subs = Object.hasOwn(SUBCOMMAND_FLAGS, command) ? SUBCOMMAND_FLAGS[command] : undefined;
  const subcommand = subs !== undefined && args[0] !== undefined && Object.hasOwn(subs, args[0])
    ? args[0]
    : undefined;

  const spec = subcommand !== undefined
    ? subs?.[subcommand]
    : (Object.hasOwn(COMMAND_FLAGS, command) ? COMMAND_FLAGS[command] : undefined);
  if (spec === undefined || !spec.allowed.includes('json')) return null;

  // The command's OWN reading of `--json`, passed in rather than re-implemented
  // — two functions disagreeing about one argv is how a flag comes to be
  // honoured by the parser and missed by the gate. It throws on `--json=maybe`
  // and on `--json=true --json=false`; both are refusals ABOUT `--json`, so the
  // caller plainly asked for JSON and is owed a JSON refusal.
  try {
    if (!jsonAsked(args)) return null;
  } catch {
    // fall through: `--json` was typed, wrongly.
  }
  return subcommand === undefined ? { command } : { command, subcommand };
}

/** `true` when the text a command emitted is already a JSON document. */
export function isJsonAlready(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return false;
  try { JSON.parse(trimmed); return true; } catch { return false; }
}

/** The envelope, pretty-printed exactly as `emitJson` prints every other one. */
export function renderJsonError(
  where: { command: string; subcommand?: string }, argv: string[], exit: number, message: string,
): string {
  const envelope: JsonErrorEnvelope = {
    error: {
      command: where.command,
      ...(where.subcommand === undefined ? {} : { subcommand: where.subcommand }),
      exit,
      argv: argv.slice(1),
      message,
    },
  };
  return JSON.stringify(envelope, null, 2);
}
