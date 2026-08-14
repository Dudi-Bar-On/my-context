import type { Workspace } from '../../core/workspace.ts';

export type Emit = (s: string) => void;

/** Returns the process exit code. Never throws — commands report and return 1. */
export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;

export interface CommandDef {
  name: string;
  /** The usage column, e.g. "ingest <path>". */
  usage: string;
  summary: string;
  run: CommandFn;
}

export const COMMANDS = new Map<string, CommandDef>();

/**
 * Names already claimed by a hardcoded `case` arm in `src/cli/index.ts`'s
 * dispatch switch. That switch is checked BEFORE the registry fallback (see
 * its `default` arm), so registering one of these would produce a command
 * that `usage()` advertises but that can never actually run — silently dead,
 * yet listed as if it worked. This list is a hand-kept mirror of the switch
 * because the switch is not itself registry-driven yet (see the brief's "What
 * this task does and does not migrate"). Task 15 already removed `status`
 * from both this list and the switch — it is a real `COMMANDS` registration
 * now (`src/cli/commands/status.ts`) — and nothing else here changes until a
 * later plan finishes the rest of that migration.
 */
const SHADOWED_BY_SWITCH = new Set([
  'init', 'add', 'list', 'show', 'rebuild', 'help', 'examples',
]);

export function registerCommand(def: CommandDef): void {
  if (COMMANDS.has(def.name)) {
    throw new Error(`my_context: command "${def.name}" is already registered.`);
  }
  if (SHADOWED_BY_SWITCH.has(def.name)) {
    throw new Error(
      `my_context: command "${def.name}" is already a hardcoded case in src/cli/index.ts's ` +
      `dispatch switch, which runs before the registry fallback — registering it here would ` +
      `advertise a command in usage() that can never actually execute.`,
    );
  }
  COMMANDS.set(def.name, def);
}

/** `--name value` → value; `--name=value` → value; absent → null. */
export function flag(args: string[], name: string): string | null {
  const long = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === long) return args[i + 1] ?? null;
    if (args[i].startsWith(`${long}=`)) return args[i].slice(long.length + 1);
  }
  return null;
}

const TRUE_WORDS = new Set(['true', 'yes', 'on', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'off', '0']);

/**
 * A boolean flag: `--name` → true, `--name=false` → FALSE, absent → null.
 *
 * This exists because `hasFlag` used to answer "does the token appear", which
 * on a confirmation gate is a trap: `--yes=false` and `--yes=no` — the exact
 * spellings an operator reaches for to DECLINE — matched the `--yes=` prefix
 * and confirmed the action (Task 10 follow-up, carried to Task 16). The fix
 * lives here rather than in a second helper used only by `--yes`, because
 * that would leave `--json=false`, `--all=false` and `--quiet=false` still
 * lying while the CLI grew two flag dialects; the trap was in the parser, so
 * the parser is what changed. `hasFlag` now delegates to this function, so
 * every boolean flag in the CLI reads the same words.
 *
 * An unrecognized value (`--yes=maybe`) THROWS rather than resolving to
 * either answer: guessing "true" confirms something the caller tried to
 * decline, guessing "false" silently drops a flag they meant to pass, and
 * both are the silent-wrongness this project keeps finding. Callers are
 * commands, whose own `catch` turns it into a one-line message and exit 1
 * (see `toCliMessage`); `CommandFn`'s "never throws" contract is upheld at
 * the command boundary, not by swallowing this here.
 *
 * The accepted words are the same set Claude Code's own frontmatter accepts
 * (`true/false`, `yes/no`, `on/off`, `1/0`, any case). `--name value` is NOT
 * read as a value: only declared value-flags consume the next token, and
 * `positionals()` would otherwise disagree with this function about the same
 * argv.
 */
export function boolFlag(args: string[], name: string): boolean | null {
  const long = `--${name}`;
  for (const arg of args) {
    if (arg === long) return true;
    if (!arg.startsWith(`${long}=`)) continue;
    const raw = arg.slice(long.length + 1);
    const value = raw.toLowerCase();
    if (TRUE_WORDS.has(value)) return true;
    if (FALSE_WORDS.has(value)) return false;
    throw new Error(
      `my_context: ${long} accepts ${[...TRUE_WORDS].join('/')} or ${[...FALSE_WORDS].join('/')} ` +
      `(got ${JSON.stringify(raw)}). Pass a bare ${long} to mean "true".`,
    );
  }
  return null;
}

/** `--name` / `--name=true` → true; `--name=false` → false; absent → false. */
export function hasFlag(args: string[], name: string): boolean {
  return boolFlag(args, name) ?? false;
}

/** Positional arguments, i.e. everything that is not a flag or a flag's value. */
export function positionals(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2).split('=')[0];
      if (valueFlags.includes(name) && !arg.includes('=')) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}
