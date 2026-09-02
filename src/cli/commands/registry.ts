import type { Workspace } from '../../core/workspace.ts';

export type Emit = (s: string) => void;

/** Returns the process exit code. Never throws — commands report and return 1. */
export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;

/**
 * The signature of a command that runs BEFORE `resolveWorkspace` — see
 * `CommandDef.workspace`. It receives no `Workspace` at all, structurally,
 * so a bare command cannot half-use one: handing it a fabricated or
 * partially-resolved workspace object would be a value accepted on one
 * branch and quietly wrong on the other, which is the exact failure mode
 * this registry migration was told to watch for.
 */
export type BareCommandFn = (args: string[], out: Emit, cwd: string) => number;

/**
 * One registered CLI command. The union is discriminated on `workspace`, so
 * a definition is EITHER a workspace command (the default — `runCli`
 * resolves the workspace first and passes it) or a bare one (`workspace:
 * 'none'` — dispatched before `resolveWorkspace` runs). There is one `run`
 * field with two shapes rather than two optional fields, so a definition
 * carrying both — one of which would be silently ignored — cannot be
 * written at all.
 *
 * `workspace: 'none'` exists for `init` and, today, only `init`: it must be
 * able to create a workspace from inside a directory whose ANCESTOR
 * workspace has a corrupt `config.json`, and `resolveWorkspace` throws on
 * exactly that — dispatching `init` after it would trade "create the
 * workspace here" for an error about a config file the user may not even
 * know exists.
 */
export type CommandDef = {
  name: string;
  /** The usage column, e.g. "ingest <path>". */
  usage: string;
  summary: string;
} & (
  | { workspace?: undefined; run: CommandFn }
  | { workspace: 'none'; run: BareCommandFn }
);

export const COMMANDS = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  if (COMMANDS.has(def.name)) {
    throw new Error(`my_context: command "${def.name}" is already registered.`);
  }
  COMMANDS.set(def.name, def);
}

/** One occurrence of `--name` on the command line. */
export interface FlagOccurrence {
  /** The value it carries; `null` only for a bare `--name` with nothing after it. */
  value: string | null;
  /** true for `--name value`, false for `--name=value` — the two forms fail differently. */
  bare: boolean;
}

/**
 * EVERY occurrence of `--name`, in command-line order.
 *
 * This exists because `flag()` returned the FIRST match and said nothing about
 * the rest, so `mycontext add rule "…" --scope "src/api/**" --scope "src/db/**"`
 * created an item scoped to `src/api/**` alone and reported success — two
 * scopes accepted, dropped, and never mentioned, which is the one failure this
 * project rules out. Every caller now goes through this function and decides
 * what a repeat means for its own flag (`flag` refuses one, `listFlag` unions
 * one); nothing silently keeps the first any more.
 *
 * The value token is SKIPPED after a bare `--name value`, exactly as
 * `positionals` and `unknownFlag` skip it. That has to stay identical: if this
 * function read `--body --body x` as two occurrences while `positionals` read
 * one, the two would disagree about the same argv, and whichever won would be
 * doing so silently.
 */
/**
 * `--extra key=value`, repeatable, for BOTH `add` and `edit`.
 *
 * It lives here rather than in either command because both need it and this
 * project has paid four times for two hand-kept expressions of one rule. The
 * error text is the same wherever it is raised, which is the point: a user who
 * mistypes it on `add` gets the sentence they would have got on `edit`.
 *
 * Returns null when the flag never appeared, which the caller distinguishes
 * from an empty patch.
 */
export function extraFlag(args: string[]): Record<string, string> | null {
  const found = flagOccurrences(args, 'extra');
  if (found.length === 0) return null;
  const out: Record<string, string> = {};
  for (const occurrence of found) {
    const raw = occurrence.value ?? '';
    const eq = raw.indexOf('=');
    if (eq <= 0) {
      throw new Error(
        `my_context: --extra takes key=value (got ${JSON.stringify(raw)}). Category-specific ` +
        `fields are named one at a time — \`--extra directive=dont --extra kind=security\` — ` +
        `and the value is taken whole, commas included. Run \`mycontext examples <category>\` to ` +
        `see which keys a category uses.`,
      );
    }
    out[raw.slice(0, eq)] = raw.slice(eq + 1);
  }
  return out;
}

export function flagOccurrences(args: string[], name: string): FlagOccurrence[] {
  // The `name` each occurrence carries is dropped rather than passed through:
  // this function's answer is about ONE flag, and every caller already knows
  // which. Returning the richer record would also change what
  // `deepEqual(flagOccurrences(...), [{value, bare}])` compares in
  // `test/cli/registry.test.ts`, which is a claim about this shape and not
  // about the scanner underneath it.
  return interleavedOccurrences(args, [name]).map(({ value, bare }) => ({ value, bare }));
}

/**
 * The same occurrence, plus WHICH flag it was — for a caller reading two or
 * more flags whose RELATIVE order is part of the meaning.
 *
 * `mycontext add --note a --observation limit=b --note c` records three
 * observations, and they must land in that order: an item's `## Observations`
 * block is a list, `renderItem` writes it in array order, and a re-created item
 * whose observations came back in flag-grouped order is not the item it was
 * copied from. Reading each flag separately with `flagOccurrences` cannot
 * answer that — two independent scans know each flag's internal order and
 * nothing about the order BETWEEN them, so `--note a --observation x --note c`
 * would be assembled as `a, c, x` and reported as a success.
 *
 * One scan, not two, is also what keeps the value-token skip honest: a bare
 * `--note --observation` must consume `--observation` as `--note`'s value
 * (where the caller's own guard then refuses it by name), exactly as
 * `positionals` and `unknownFlag` treat it, and two scans would see the same
 * token as both a value and a flag.
 */
export interface NamedFlagOccurrence extends FlagOccurrence {
  /** Which of the requested flags this occurrence is. */
  name: string;
}

export function interleavedOccurrences(
  args: string[], names: string[],
): NamedFlagOccurrence[] {
  const found: NamedFlagOccurrence[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const name = names.find((n) => arg === `--${n}` || arg.startsWith(`--${n}=`));
    if (name === undefined) continue;
    if (arg === `--${name}`) {
      found.push({ name, value: args[i + 1] ?? null, bare: true });
      i++;
      continue;
    }
    found.push({ name, value: arg.slice(name.length + 3), bare: false });
  }
  return found;
}

/**
 * The refusal for a repeated single-valued flag, spelled once so no command
 * grows its own wording. Exported because `mycontext add` validates its own
 * occurrences (it additionally refuses a bare flag with no value) and must
 * refuse a repeat in the same words as everything else.
 */
export function repeatedFlagError(name: string, values: (string | null)[]): Error {
  return new Error(
    `my_context: --${name} was given ${values.length} times ` +
    `(${values.map((v) => JSON.stringify(v ?? '')).join(', ')}), and it takes a single value. ` +
    `Honouring one of them would drop the others without saying so, so pass it once.`,
  );
}

/**
 * A single-valued flag: `--name value` → value; `--name=value` → value;
 * absent → null; **given twice → throws**.
 *
 * Refusing rather than collecting is the right answer for THIS shape of flag
 * and not for every one. There is no reading of `--by A --by B` in which the
 * caller gets both: `supersede --by` names one replacement, `--limit` is one
 * number, `--body` is one body. Silently keeping the first (what this did) is
 * a drop; silently keeping the last is the same drop with a different victim;
 * concatenating them invents a value the caller never typed. Only a refusal
 * leaves the caller in possession of the facts. List-valued flags — the ones
 * where repeating obviously means "and also" — are `listFlag` below, which
 * collects instead.
 *
 * Throwing matches `boolFlag` above: commands' own `catch`, or `runCli`'s,
 * turns it into a one-line message and exit 1, so `CommandFn`'s "never throws"
 * contract is upheld at the command boundary rather than by swallowing this.
 */
export function flag(args: string[], name: string): string | null {
  const found = flagOccurrences(args, name);
  if (found.length > 1) throw repeatedFlagError(name, found.map((o) => o.value));
  return found[0]?.value ?? null;
}

/**
 * A list-valued flag — `--scope`, `--tags` — read from EVERY occurrence.
 *
 * `--scope "a/**,b/**"` and `--scope a/** --scope b/**` mean the same thing and
 * compose freely: each occurrence is split on commas, the results are
 * concatenated in command-line order, and duplicates are dropped keeping the
 * first position. Collecting rather than refusing is what a caller who typed
 * the flag twice obviously means — "and also this one" — and it is the form a
 * shell makes easy when a value itself contains a comma-free glob per line.
 * Absent → null, which callers distinguish from `--scope=` (present, empty,
 * i.e. "no scope"), because those are different instructions.
 */
export function listFlag(args: string[], name: string): string[] | null {
  const found = flagOccurrences(args, name);
  if (found.length === 0) return null;
  return dedupe(found.flatMap((o) => csv(o.value ?? '')));
}

/** `"a, b"` → `['a', 'b']` — the spelling every list flag in this CLI uses. */
export function csv(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** First occurrence wins, so command-line order is preserved. */
export function dedupe(values: string[]): string[] {
  return [...new Set(values)];
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
 *
 * Occurrences that CONTRADICT each other (`--yes=false --yes=true`) throw, for
 * the reason `flag` refuses a repeated value flag: this used to answer with
 * the first one and drop the rest in silence, and on `--yes` in particular the
 * dropped one is a decision about whether an item starts governing the
 * project. Occurrences that agree are not an error — `--json --json` asks for
 * one thing twice and gets it.
 */
export function boolFlag(args: string[], name: string): boolean | null {
  const long = `--${name}`;
  let answer: boolean | null = null;
  for (const arg of args) {
    let value: boolean;
    if (arg === long) {
      value = true;
    } else if (arg.startsWith(`${long}=`)) {
      const raw = arg.slice(long.length + 1);
      const word = raw.toLowerCase();
      if (TRUE_WORDS.has(word)) value = true;
      else if (FALSE_WORDS.has(word)) value = false;
      else {
        throw new Error(
          `my_context: ${long} accepts ${[...TRUE_WORDS].join('/')} or ` +
          `${[...FALSE_WORDS].join('/')} (got ${JSON.stringify(raw)}). ` +
          `Pass a bare ${long} to mean "true".`,
        );
      }
    } else {
      continue;
    }
    if (answer !== null && answer !== value) {
      throw new Error(
        `my_context: ${long} was given as both true and false. There is no reading of that ` +
        `which honours both, and answering with one of them would drop the other without ` +
        `saying so — pass it once.`,
      );
    }
    answer = value;
  }
  return answer;
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
