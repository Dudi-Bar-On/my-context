/**
 * **`mycontext <command> --help` prints that command's help and exits 0.**
 *
 * `TASK-asking-a-command-for-help-exits-1-on-all-38-commands-that`.
 *
 * ── WHAT WAS MEASURED ──────────────────────────────────────────────────────
 *
 * 2026-09-13, and re-measured 2026-09-14 by spawning the real binary and
 * reading `spawnSync(...).status` rather than a shell's `$?`: **47 of the 48
 * registered commands exited 1 on `--help`**, 41 of them behind the line
 * `my_context: unknown option "--help".` and the rest behind a refusal about
 * something else entirely — `show --help` answered `no item with id
 * "--help"`, `pack --help` answered `unknown pack subcommand ""`, `help
 * --help` answered the topic enum. The forty-eighth, `rebuild`, exited 0 and
 * printed `indexed N item(s)`: it swallowed the flag.
 *
 * The item filed the figure as 38, which was the count of ONE of those
 * wordings on the day it was written; the defect is wider than the number it
 * was filed under, and the number is not restated anywhere that can go stale
 * — `test/cli/command-help.test.ts` sweeps the registry.
 *
 * A wrapper, a Makefile or an agent that checks the status of `--help`
 * concludes the command does not exist. The correct usage block was already
 * being printed; it was reachable only by ignoring the status the tool
 * reported next to it.
 *
 * ── WHY IT IS ONE INTERCEPT AT THE BOUNDARY, AND NOT 48 EDITS ──────────────
 *
 * The obvious repair is to teach `refuseUnknownFlag` about `--help`. It does
 * not work: that function returns a BOOLEAN, every one of its ~45 call sites
 * reads it as `if (refused) return 1`, and there is no third answer for "stop,
 * and it is not a failure" without changing the signature at every one of
 * them — the exact "signature change across every command in the CLI" that
 * `core/command-flags.ts` refused for the same reason. It would also not reach
 * `show`, `rebuild`, `help`, `init` or `pack`, none of which route their
 * refusal through it.
 *
 * So `--help` is answered where every command is already reached: once, in
 * `dispatchCli`, before the command runs. That places the guarantee on the
 * registry rather than on 48 memories — a command registered tomorrow answers
 * `--help` on the day it is registered, with no line written for it.
 *
 * ── WHY THE TEXT IS DERIVED AND NOT AUTHORED ───────────────────────────────
 *
 * Every word this prints already exists, checked by something:
 *
 *   - `usage` and `summary` come off the command's own `registerCommand`
 *     entry — the same two strings the banner prints.
 *   - The flags come off `COMMAND_FLAGS` / `SUBCOMMAND_FLAGS`, which are the
 *     tables `refuseUnknownFlag` is HANDED, so a flag this page lists is a
 *     flag the parser accepts by construction rather than by agreement.
 *   - What each flag MEANS comes off `FLAG_DECLARATIONS` /
 *     `SUBCOMMAND_FLAG_DECLARATIONS`, which `test/cli/command-flags.test.ts`
 *     already requires to cover exactly the same flag names in both
 *     directions.
 *   - `edit`'s surface is computed per workspace by `editFlagSurface`, which
 *     is the only way anything can answer for it.
 *
 * A hand-written help string per command is this repository's own D51 pattern
 * — a second copy of a list, stale the day the first one moves — and is what
 * the `--help` block would have become.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 *
 * It does not replace the long `USAGE` blocks inside the command modules.
 * Those are still what a refusal prints, they carry worked forms this page
 * cannot derive, and `<command> --help` says so by pointing at the one place
 * the rest lives. Deriving a page and ALSO keeping the module blocks is not a
 * duplication: one is the flag surface, checked against the parser; the other
 * is prose about how the forms combine, and nothing can derive that.
 */
import {
  COMMAND_FLAGS, FLAG_DECLARATIONS, FLAGLESS_COMMANDS,
  SUBCOMMAND_FLAGS, SUBCOMMAND_FLAG_DECLARATIONS,
  type FlagDeclaration, type FlagDeclarations, type FlagSpec,
} from '../core/command-flags.ts';
import { editFlagSurface } from '../core/edit-flags.ts';
import type { Config } from '../core/config.ts';
import { outputWidth, paragraph } from './commands/format.ts';
import type { Emit } from './commands/registry.ts';

/**
 * The flag name a help request is spelled with. One constant because three
 * things read it: the scanner below, the renderer's own row, and the test.
 */
export const HELP_FLAG = 'help';

/**
 * **`true` when this argv is asking the command for help.**
 *
 * The loop is `unknownFlag`'s and `positionals`' loop, with the identical
 * value-flag skip, and it has to stay identical for the identical reason:
 * whatever those two swallow as a flag's VALUE this must not then read as a
 * request for help. `mycontext audit --item --help` passes `--help` as the
 * value of `--item`, which is a mistyped id and is refused as one — it is not
 * a request for this page.
 *
 * `--help=anything` counts, because the NAME is what was typed and a command
 * that took a value here would be inventing one.
 *
 * A command whose `values` are not known at this point (an unregistered
 * command, or one dispatched before its spec is reachable) is scanned with an
 * empty skip list, which can only ever read MORE tokens as `--help` than the
 * command would — and the worst case of that is printing help for a command
 * line that was going to be refused anyway.
 */
export function asksForHelp(args: string[], valueFlags: string[] = []): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined || !arg.startsWith('--')) continue;
    const name = arg.slice(2).split('=')[0];
    if (name === HELP_FLAG) return true;
    if (valueFlags.includes(name) && !arg.includes('=')) i++;
  }
  return false;
}

/**
 * The value-taking flags of a command, across every subcommand it has, for
 * the sole purpose of the skip above.
 *
 * The UNION rather than the spec of the subcommand actually named: resolving
 * the subcommand here would mean re-implementing `jsonEnvelopeFor`'s
 * resolution a second time, and the two disagreeing about one argv is how a
 * flag comes to be honoured by one gate and missed by another. A union can
 * only over-skip, and over-skipping means a `--help` sitting in a value slot
 * is treated as a value — which is what it is.
 */
export function valueFlagsOf(command: string, config: Config | null): string[] {
  if (command === 'edit' && config !== null) return editFlagSurface(config).values;
  const flat = Object.hasOwn(COMMAND_FLAGS, command) ? COMMAND_FLAGS[command] : undefined;
  if (flat !== undefined) return flat.values;
  const subs = Object.hasOwn(SUBCOMMAND_FLAGS, command) ? SUBCOMMAND_FLAGS[command] : undefined;
  if (subs === undefined) return [];
  return [...new Set(Object.values(subs).flatMap((spec: FlagSpec) => spec.values))];
}

/** One rendered flag row: the token as it is typed, and what it means. */
interface Row { token: string; note: string }

function rowFor(name: string, spec: FlagSpec, decl: FlagDeclaration | undefined): Row {
  const takesValue = spec.values.includes(name);
  const hint = decl?.values !== undefined
    ? decl.values.join('|')
    : (decl?.format !== undefined ? decl.example ?? '<value>' : '<value>');
  const token = takesValue ? `--${name} ${hint}` : `--${name}`;
  const parts: string[] = [];
  if (decl?.note !== undefined) parts.push(decl.note);
  if (decl?.values !== undefined) parts.push(`One of: ${decl.values.join(', ')}.`);
  else if (decl?.format !== undefined) parts.push(`Takes ${decl.format}.`);
  return { token, note: parts.join(' ') };
}

function rows(spec: FlagSpec, declarations: FlagDeclarations | undefined): Row[] {
  return [...spec.allowed].sort().map((name) => rowFor(name, spec, declarations?.[name]));
}

/**
 * The rows, laid out as a token column and a wrapped note column — the shape
 * `records` (format.ts) uses, spelled here rather than borrowed because
 * `records` takes a header row this page has no use for.
 */
function layout(out: Emit, list: Row[], indent = '  '): void {
  if (list.length === 0) return;
  const width = Math.max(0, ...list.map((r) => r.token.length));
  const gutter = indent.length + width + 2;
  for (const row of list) {
    const padded = indent + row.token.padEnd(width) + '  ';
    if (row.note === '') { out(padded.trimEnd()); continue; }
    const wrapped = paragraph(row.note, '', outputWidth() - gutter);
    out(padded + (wrapped[0] ?? ''));
    for (const rest of wrapped.slice(1)) out(' '.repeat(gutter) + rest);
  }
}

/**
 * **The whole of `mycontext <command> --help`.**
 *
 * `config` is `null` only where no workspace could be resolved, which is the
 * one case `edit`'s per-workspace surface cannot be computed in — it is said
 * rather than guessed at, because a shorter list than the command accepts is
 * the failure this page exists to remove.
 */
export function commandHelp(
  out: Emit, def: { name: string; usage: string; summary: string }, config: Config | null,
): void {
  out(`usage: mycontext ${def.usage}`);
  for (const line of paragraph(def.summary, '  ')) out(line);

  const name = def.name;
  if (name === 'edit') {
    out('');
    if (config === null) {
      for (const line of paragraph(
        '`edit` accepts a different set of flags in every project — the fields your categories '
        + 'declare are flags here — and no workspace could be resolved, so that set cannot be '
        + 'computed. Run this inside a project.', '  ',
      )) out(line);
    } else {
      const surface = editFlagSurface(config);
      out('flags (this project\'s; `edit` accepts the fields your categories declare):');
      layout(out, [...surface.allowed].sort().map((flag) => rowFor(
        flag, { allowed: surface.allowed, values: surface.values }, surface.flags[flag],
      )));
    }
  } else if (Object.hasOwn(SUBCOMMAND_FLAGS, name)) {
    const subs = SUBCOMMAND_FLAGS[name];
    const declarations = SUBCOMMAND_FLAG_DECLARATIONS[name];
    for (const sub of Object.keys(subs).sort()) {
      out('');
      out(`${name} ${sub}:`);
      const list = rows(subs[sub], declarations);
      if (list.length === 0) { for (const line of paragraph('takes no flags.', '  ')) out(line); continue; }
      layout(out, list);
    }
  } else if (Object.hasOwn(COMMAND_FLAGS, name)) {
    out('');
    out('flags:');
    layout(out, rows(COMMAND_FLAGS[name], FLAG_DECLARATIONS[name]));
  } else {
    out('');
    // Said in the words the measurement supports. `rebuild` SWALLOWS an
    // unknown flag rather than refusing it (see `FLAGLESS_DISPOSITION`,
    // test/cli/command-flags.test.ts), and telling a reader "it is refused"
    // would be this page asserting a refusal nothing performs.
    for (const line of paragraph(
      FLAGLESS_COMMANDS.includes(name)
        ? 'This command takes no flags.'
        : 'No flag surface is declared for this command.', '  ',
    )) out(line);
  }

  out('');
  for (const line of paragraph(
    'The command\'s own usage block — the worked forms, and how they combine — is printed by '
    + 'running it with an argument it refuses. `mycontext help cli` is the flag reference for '
    + 'the whole CLI, and carries the exit-code contract a script reads.', '  ',
  )) out(line);
}
