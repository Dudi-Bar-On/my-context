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

export function registerCommand(def: CommandDef): void {
  if (COMMANDS.has(def.name)) {
    throw new Error(`my_context: command "${def.name}" is already registered.`);
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

export function hasFlag(args: string[], name: string): boolean {
  const long = `--${name}`;
  return args.some((a) => a === long || a.startsWith(`${long}=`));
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
