/**
 * **`POST /api/command/check` — would the CLI accept this line? (plan:builder
 * seq:4.)**
 *
 * The gate the owner asked for: *"checked before a command is allowed to be
 * copied"*. A page composes an argv from a form; this answers whether the real
 * argument parser would take it, and says so in the CLI's own words when it
 * would not.
 *
 * `POST /api/config/check` is the precedent and this follows it exactly, down
 * to the status codes: **a refusal is `200 { ok: false, … }`, not a 4xx.** The
 * question was asked and answered — "no, and here is why" is this endpoint's
 * SUCCESS case. A 4xx here means the request itself was unreadable, which is a
 * different sentence for a different reader, and the two must never share a
 * response.
 *
 * ── PARSE, NEVER EXECUTE — AND THAT IS STRUCTURAL, NOT PROMISED ────────────
 *
 * The item's binding requirement: *"the endpoint must be unable to run a
 * command even if a later change tried to — the same bound `recordRefusal`
 * has"*. `recordRefusal` is bounded by REFUSING TO PRODUCE a record that is not
 * a refusal; a checker has no equivalent output to guard, so the bound is on
 * the one thing that could ever run a command — WHAT THIS MODULE CAN REACH.
 *
 * Nothing in this file's transitive import graph can start a process. It
 * imports four things: two flag tables (`core/command-flags.ts`,
 * `core/edit-flags.ts`), one ten-line pure function (`unknownFlag`, whose only
 * import is `cli/commands/registry.ts`, whose only import is a TYPE), and the
 * route table. `execute.ts` — the module that holds this server's single
 * `execFile` — is not reachable from here, and neither is `execute-catalogue.ts`
 * or `src/cli/index.ts`. `test/ui/command-check.test.ts` walks that graph and
 * fails if any of them ever becomes reachable, so a later change that wanted to
 * run something would have to make the gate red first. That is the same shape
 * as `recordRefusal`'s: the wrong thing is not discouraged, it is unreachable
 * and the unreachability is measured.
 *
 * It is worth naming what this buys beyond tidiness. `POST /api/execute` exists
 * and is gated by a nonce, a confirm and `runnable: true`. A checker that could
 * reach the runner would be a SECOND door to the same act, opened by a route
 * whose whole promise to the reader is that it does not act.
 *
 * ── THE SAME CODE AS THE REFUSAL, NOT A SECOND OPINION ────────────────────
 *
 * `unknownFlag` is imported from `cli/commands/format.ts` — the function the
 * six reporting commands and `refuseUnknownFlag` itself call. It is not
 * re-implemented here, and re-implementing it would defeat the point: the
 * item asks that *"the UI's check and the CLI's refusal are the same code and
 * cannot disagree"*, and two copies of a ten-line loop is exactly how they come
 * to disagree about `--flag=value` versus `--flag value`.
 *
 * The flag SETS are `plan:builder seq:1`'s lift — `COMMAND_FLAGS`,
 * `SUBCOMMAND_FLAGS`, `FLAGLESS_COMMANDS` and `DYNAMIC_FLAG_COMMANDS`, whose
 * union `test/cli/command-flags.test.ts` holds to the registry exactly. So this
 * module knows every command the CLI dispatches without loading the module that
 * registers the writes, which is the same trick `read-model-cli-help.ts` uses
 * and for the same reason.
 *
 * ── WHAT IT CHECKS, AND WHAT IT CANNOT — SAID IN THE ANSWER ────────────────
 *
 * **This is the most important thing in the file.** A checker that answers
 * `ok: true` without saying what it looked at invites the caller to read it as
 * "this command will do what the form says", and that is a promise no parser
 * can make. `builder/6` will refuse a Copy on this verdict, so an over-read
 * `true` is worse than a refusal: it is a green light for a line nobody
 * checked.
 *
 * So every answer carries `checked` and `unchecked`, both derived from the path
 * actually taken. What is out of reach is out of reach for one reason — it is
 * decided INSIDE the command bodies, which is the write surface this server may
 * not import — and that reason is the same one that makes the endpoint safe.
 * Positional arity, whether a value is legal for the flag that took it, mutual
 * exclusion (`add --body` against `--file`), and whether the id names anything
 * are all past the flag gate.
 *
 * `INV-nothing-is-dropped-silently` is the rule this is an instance of: the
 * limit is reported, not left for a reader to discover when a "checked" command
 * refuses in their terminal.
 *
 * ── AND THE DISAGREEMENT IT IS SHAPED TO CATCH ────────────────────────────
 *
 * `command` comes back on every answer: the command STRING this line resolves
 * to (`review promote`, not `review`). A caller that composed one command and
 * is about to send the request for another can see it — which is the class of
 * fault `builder/15` is, where a composed `list rule` was answered by a route
 * that never received the category. A parse verdict cannot detect that on its
 * own, but a verdict that NAMES what it parsed lets the caller compare, and
 * naming it costs nothing.
 */
import { unknownFlag } from '../cli/commands/format.ts';
import {
  COMMAND_FLAGS, DYNAMIC_FLAG_COMMANDS, FLAGLESS_COMMANDS, SUBCOMMAND_FLAGS, type FlagSpec,
} from '../core/command-flags.ts';
import { editFlagSurface } from '../core/edit-flags.ts';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/** The binary name every composed line starts with. */
const BIN = 'mycontext';

/**
 * **`badRequest` and the unknown-parameter refusal are spelled here rather than
 * imported from `read-model.ts`, and the reason is the structural bound.**
 *
 * That was the first draft, and it was measured: `read-model.ts` imports
 * `doctor/checks.ts` — reasonably, for `/api/doctor` — and `doctor/checks.ts`
 * imports `node:child_process`, because one of its checks looks for the CLI on
 * the user's PATH. Two helpers totalling five lines therefore put a process
 * spawner into this module's import graph, and `test/ui/command-check.test.ts`
 * caught it on the first run.
 *
 * The bound is worth more than the reuse. A checker whose graph contains a
 * spawner is one where "it cannot execute" is back to being an argument about
 * intent, and this endpoint's entire promise to a reader is that it answers
 * without acting. The wording below is `read-model.ts`' verbatim so a reader
 * meets one sentence and not two, and the drift risk is bounded by there being
 * nothing here to drift: an envelope of `{ error }` and a 400.
 *
 * Lifting the pair into a module of their own would be the tidier fix and it is
 * not this task's to make — `read-model.ts` is being edited by another lane as
 * this is written, and a shared-helper extraction is exactly the change that
 * collides. It is named in the report instead.
 */
const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/** `read-model.ts` · `unknownParams`, for the empty allow-list case only. */
function refuseAnyParameter(url: URL): string | null {
  for (const key of url.searchParams.keys()) {
    return `unknown parameter "${key}" — this endpoint accepts no parameters. `
      + 'A parameter accepted and ignored would silently answer a different question.';
  }
  return null;
}

/**
 * Why a line was refused, as a token a control can branch on.
 *
 * Beside the sentence rather than instead of it: `builder/6` has to decide
 * WHICH control to point at, and parsing that back out of a refusal message
 * would make the message's wording load-bearing on the screen — which is how a
 * better sentence becomes a breaking change.
 */
export type CheckCode = 'unknown-command' | 'unknown-subcommand' | 'unknown-option';

/** The verdict, and the shape `builder/6` refuses a Copy on. */
export interface CommandCheckResult {
  /** Would the argument parser take this line. */
  ok: boolean;
  /**
   * The command STRING the line resolves to — `review promote`, never `review`
   * — or `null` when the first word names no command at all. Present on a
   * refusal too: what was refused is as much of the answer as why.
   */
  command: string | null;
  /** The CLI's own sentence, on a refusal. Absent when `ok`. */
  error?: string;
  code?: CheckCode;
  /**
   * The offending flag name, `--` stripped, on `unknown-option`. The one field
   * a form needs to put the refusal beside the control that caused it.
   */
  flag?: string;
  /** What this verdict actually rests on. */
  checked: string[];
  /** What it does not, each as a sentence a reader can act on. */
  unchecked: string[];
}

/**
 * The refusals the CLI words for itself, so this module does not claim their
 * wording as well as their verdict.
 *
 * `mycontext init` refuses a flag in a sentence of its own — *"init takes one
 * flag, --pack <path>, and \"--x\" was passed. Nothing was created"* — rather
 * than through `refuseUnknownFlag`. The VERDICT here is identical to the CLI's
 * either way, and `test/ui/command-check.test.ts` proves that against the real
 * parser for every command; what differs is one sentence, and a reader is told
 * so rather than shown a message the terminal will not repeat.
 *
 * Named rather than special-cased: reproducing `init`'s wording would mean
 * importing `cli/commands/init.ts`, which creates a corpus.
 */
const OWN_REFUSAL_WORDING: Record<string, string> = {
  init: 'mycontext init words this refusal itself, and its own sentence names the one flag it '
    + 'takes. The verdict here is the same; the sentence your terminal prints will differ.',
};

/**
 * Every flag any of a command's subcommands accepts, and every one that takes a
 * value.
 *
 * Used for two different jobs, and the second is the one that needs arguing.
 * Finding the subcommand at all means walking argv past the value-taking flags,
 * and which flags take values is what the subcommand decides — so `cmdReview`
 * walks with the UNION and this does the same, from the same table.
 *
 * Where no subcommand is given, the union is also what the flags are checked
 * against, and that direction is SOUND rather than exact: a flag no subcommand
 * accepts is one the CLI refuses whichever default applies, so a refusal here
 * is never one the CLI would not make. The reverse is not true, which is why
 * that path names itself in `unchecked` instead of pretending to be complete.
 * The default subcommand lives in the command body (`review` and `session` both
 * default to `list`), and reading it would mean importing the write surface.
 */
function unionSpec(subs: Record<string, FlagSpec>): FlagSpec {
  const allowed = new Set<string>();
  const values = new Set<string>();
  for (const spec of Object.values(subs)) {
    for (const flag of spec.allowed) allowed.add(flag);
    for (const flag of spec.values) values.add(flag);
  }
  return { allowed: [...allowed], values: [...values] };
}

/** The first argument that is not a flag or a flag's value. */
function firstPositional(args: string[], valueFlags: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) return arg;
    const name = arg.slice(2).split('=')[0];
    if (valueFlags.includes(name) && !arg.includes('=')) i++;
  }
  return undefined;
}

/** The sentences that are true of every answer, whichever way it went. */
const ALWAYS_UNCHECKED = [
  'Whether the positional arguments are the right number and shape — arity is decided in the '
  + 'command body, past the flag gate.',
  'Whether a value is legal for the flag that took it. A closed vocabulary is served by '
  + 'GET /api/flags for a control to enforce; this endpoint checks flag NAMES.',
  'Whether two flags may be used together (mycontext add refuses --body with --file), and '
  + 'whether any id, path or glob names anything that exists.',
];

/**
 * The verdict for one argv. Pure: no clock, no disk, no process.
 *
 * `ws` is read for one command only — `edit`, whose accepted set is
 * `[...allowed, ...declaredFlags(config)]` and is therefore a fact about THIS
 * project rather than about the CLI. A static answer for it would be true here
 * and wrong in the next repository, which is `read-model-flags.ts`' whole
 * argument and is inherited rather than restated.
 */
export function checkCommand(ws: Workspace, argv: readonly unknown[]): CommandCheckResult {
  const unchecked = [...ALWAYS_UNCHECKED];
  const checked: string[] = [];

  const words = argv.map((a) => String(a));
  const name = words[1] ?? '';
  const rest = words.slice(2);

  // The command surface, from the four records whose union IS the registry.
  let spec: FlagSpec | undefined;
  let command = name;

  if (Object.hasOwn(SUBCOMMAND_FLAGS, name)) {
    const subs = SUBCOMMAND_FLAGS[name];
    const union = unionSpec(subs);
    const sub = firstPositional(rest, union.values);
    if (sub !== undefined && !Object.hasOwn(subs, sub)) {
      return {
        ok: false,
        command: name,
        // `cli/commands/review.ts` · `unknown review subcommand` — the shared
        // shape of all five, quoted the way four of them quote it.
        error: `my_context: unknown ${name} subcommand "${sub}".`,
        code: 'unknown-subcommand',
        checked: [`${name} dispatches on a subcommand, and "${sub}" is not one of `
          + `${Object.keys(subs).join(', ')}.`],
        unchecked,
      };
    }
    if (sub === undefined) {
      spec = union;
      command = name;
      unchecked.push(
        `No subcommand was given, so the flags were checked against every flag ANY ${name} `
        + `subcommand accepts. That cannot refuse a line the CLI would accept, but it can `
        + `accept a flag that belongs to a different subcommand than the one ${name} defaults `
        + `to. Name the subcommand for an exact answer.`,
      );
    } else {
      spec = subs[sub];
      command = `${name} ${sub}`;
    }
  } else if (Object.hasOwn(COMMAND_FLAGS, name)) {
    spec = COMMAND_FLAGS[name];
  } else if (DYNAMIC_FLAG_COMMANDS.includes(name)) {
    // `edit` alone, and the ONE place this endpoint is about a workspace rather
    // than about the CLI.
    const surface = editFlagSurface(ws.config);
    spec = { allowed: [...surface.allowed], values: [...surface.values] };
    checked.push(
      `${name}'s accepted flags are computed from this project's own categories, not from a `
      + 'static list.',
    );
  } else if (FLAGLESS_COMMANDS.includes(name)) {
    // **"Takes no flags" is NOT "refuses flags", and reading it as the second
    // was this endpoint's first measured defect.**
    //
    // The first draft gave these three an empty spec, which made every `--flag`
    // on them an `unknown-option`. The agreement sweep failed immediately:
    // `mycontext help --anything` prints the topic refusal, `show` reads it as
    // an id and `rebuild` re-indexes and exits 0. NONE of the three refuses a
    // flag, so refusing here would have been a verdict the CLI does not make —
    // and a false refusal is the worse direction, because `builder/6` blocks
    // the Copy on it. A person would have been stopped from copying a line
    // their terminal accepts, with no way to tell they were being told
    // something untrue.
    //
    // `NO_FLAG_PROBE` in `test/helpers/approval-boundary.ts` records the same
    // three commands for the same reason, arrived at independently: a probe's
    // answer about a command that validates nothing is not an answer.
    return {
      ok: true,
      command: name,
      checked: [`${name} was recognised as a command the CLI dispatches.`],
      unchecked: [
        `${name} performs NO flag validation at all — it reads what it is given as a topic, an `
        + 'id, or nothing. So no claim is made about the flags on this line: the CLI will not '
        + 'refuse them, and it will not act on them either.',
        ...ALWAYS_UNCHECKED,
      ],
    };
  }

  if (spec === undefined) {
    return {
      ok: false,
      command: null,
      // `cli/index.ts` · `unknown command` — the sentence, without the usage
      // block that follows it in a terminal: that block is rendered from
      // `COMMANDS`, which only `src/cli/index.ts` fills, and loading it here is
      // the one thing this module may never do.
      error: `my_context: unknown command "${name}".`,
      code: 'unknown-command',
      checked: ['The first word was compared against every command the CLI dispatches.'],
      unchecked,
    };
  }

  const unknown = unknownFlag(rest, spec.allowed, spec.values);
  checked.push(
    `Every --flag on the line is one \`${command}\` accepts, walked by the CLI's own `
    + '`unknownFlag` — so `--flag=value` and `--flag value` are read here exactly as the '
    + 'parser reads them.',
  );
  const wording = OWN_REFUSAL_WORDING[name];
  if (wording !== undefined) unchecked.push(wording);

  if (unknown !== null) {
    return {
      ok: false,
      command,
      // `cli/commands/format.ts` · `refuseUnknownFlag` — its sentence verbatim.
      // The usage line it appends is the command's own and is not reachable
      // from here for the same reason the usage block above is not.
      error: `my_context: unknown option "--${unknown}".`,
      code: 'unknown-option',
      flag: unknown,
      checked,
      unchecked,
    };
  }

  return { ok: true, command, checked, unchecked };
}

/**
 * `POST /api/command/check` with body `{ argv: string[] }` — the argv exactly as
 * `commandFor` composes it, `mycontext` included.
 *
 * The leading word is REQUIRED rather than tolerated either way. What the page
 * holds is the composed line; accepting both shapes would mean guessing whether
 * a first word that happens to be a command name is the binary or the verb, and
 * `mycontext help` would be the case where the guess is unrecoverable.
 *
 * A body this cannot read is a 400 naming the field — `/api/config/check`'s
 * rule, for `/api/config/check`'s reason: "your command is wrong" and "I could
 * not read what you sent me" are answers to different questions.
 */
export function apiCommandCheck(ws: Workspace, url: URL, body: unknown): JsonResult {
  const bad = refuseAnyParameter(url);
  if (bad) return badRequest(bad);
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('argv' in body)) {
    return badRequest(
      'POST /api/command/check takes a JSON body: { argv: ["mycontext", …] }');
  }
  const argv = (body as { argv: unknown }).argv;
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== 'string')) {
    return badRequest('POST /api/command/check: argv must be an array of strings');
  }
  if (argv.length < 2 || argv[0] !== BIN) {
    return badRequest(
      `POST /api/command/check: argv must start with "${BIN}" and name a command — it takes the `
      + 'composed line, not the arguments after it');
  }
  return { status: 200, body: checkCommand(ws, argv) };
}

export function registerCommandRoutes(): void {
  registerRoute('POST', '/api/command/check', {
    kind: 'json', handle: (ctx: ApiContext) => apiCommandCheck(ctx.ws, ctx.url, ctx.body),
  });
}
