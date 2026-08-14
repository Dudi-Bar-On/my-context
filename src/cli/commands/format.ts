import { boolFlag, type Emit } from './registry.ts';

/**
 * The shared output vocabulary for every reporting command — `status`,
 * `list`, `decay`, `review list`, `doctor`, `ingest-status`, `query`.
 *
 * It exists because the user's standing requirement (tabular output with
 * detail levels, JSON for anything hierarchical) was met nowhere: each report
 * hand-rolled its own `padEnd` columns, none printed a header, and the widths
 * collided on ids this repo already has. One helper, so a column that fits in
 * one report fits in all of them and a new report cannot invent a third
 * convention.
 */

/** The three detail levels, ordered from least to most. */
export type Detail = 'summary' | 'short' | 'full';

/** The usage-line fragment every reporting command appends, spelled once. */
export const DETAIL_USAGE = '[--full|--short|--summary] [--json]';

/**
 * Pads `s` to `width`, but never truncates or collides it into the next
 * column: a real id longer than `width` (this repo has several, e.g.
 * `INV-a-validator-that-gates-writes-must-be-a-complete...` at 63 chars)
 * still gets its own two-space gap instead of running straight into the next
 * field. Moved here from `decay.ts`, which was the only owner of the idea
 * while three other reports each kept their own colliding `padEnd`.
 */
export function col(s: string, width: number): string {
  return s.length >= width ? `${s}  ` : s.padEnd(width);
}

/**
 * Whether to draw tables with box-drawing characters rather than ASCII.
 *
 * Fails toward ASCII on Windows: a terminal that advertises nothing is given
 * the safe rendering, because a legacy `cmd.exe` on a non-UTF-8 code page
 * turns box characters into mojibake and Windows is this project's first
 * target. POSIX terminals have rendered these for decades, so they are
 * trusted by default.
 *
 * The Windows signals are the terminal's own advertisements — Windows
 * Terminal, an embedding program, or a terminfo name — and each is inherited
 * by child processes, so a shell *launched from* such a terminal is treated
 * as capable too. That inheritance is why the two overrides exist and why no
 * test in this repo relies on the ambient answer: under `npm test` the answer
 * is whatever the launching terminal exported, which is not necessarily what
 * a user double-clicking `cmd.exe` will see. `MYCONTEXT_ASCII=1` forces the
 * fallback, `MYCONTEXT_UNICODE=1` forces the box, and ASCII wins if both are
 * set, since that is the one a user reaches for after seeing mojibake.
 *
 * `env` and `platform` are injectable because the alternative is a test that
 * can only assert whatever the machine running it happens to be.
 */
export function supportsUnicode(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): boolean {
  if (env.MYCONTEXT_ASCII === '1') return false;
  if (env.MYCONTEXT_UNICODE === '1') return true;
  if (platform !== 'win32') return true;
  return Boolean(env.WT_SESSION || env.TERM_PROGRAM || env.TERM);
}

const BOX = {
  unicode: {
    tl: '┌', tm: '┬', tr: '┐', ml: '├', mm: '┼', mr: '┤',
    bl: '└', bm: '┴', br: '┘', h: '─', v: '│',
  },
  ascii: {
    tl: '+', tm: '+', tr: '+', ml: '+', mm: '+', mr: '+',
    bl: '+', bm: '+', br: '+', h: '-', v: '|',
  },
} as const;

/**
 * A bordered table: top rule, header, header rule, data, bottom rule. Widths
 * come from the widest of the header and every cell, so nothing collides and
 * nothing is truncated — including the 63-character ids this repo already has.
 *
 * `opts.unicode` decides the character set; omitted, it asks
 * `supportsUnicode()`. Callers pass nothing, so the six reporting commands
 * share one answer.
 *
 * Returns NO lines for zero rows — a bare header over an empty table reads as
 * "here is the data" when there is none; each caller says what "none" means
 * in its own words instead.
 */
export function table(
  headers: string[], rows: string[][], opts: { unicode?: boolean } = {},
): string[] {
  if (rows.length === 0) return [];

  const b = (opts.unicode ?? supportsUnicode()) ? BOX.unicode : BOX.ascii;
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? '').length)));

  const rule = (l: string, m: string, r: string): string =>
    l + widths.map((w) => b.h.repeat(w + 2)).join(m) + r;
  const line = (values: string[]): string =>
    b.v + widths.map((w, i) => ` ${(values[i] ?? '').padEnd(w)} `).join(b.v) + b.v;

  return [
    rule(b.tl, b.tm, b.tr),
    line(headers),
    rule(b.ml, b.mm, b.mr),
    ...rows.map(line),
    rule(b.bl, b.bm, b.br),
  ];
}

/**
 * `--full` / `--short` / `--summary`, defaulting to `short` — the shape every
 * report printed before this existed, so an operator who passes nothing sees
 * no change.
 *
 * Two levels at once is an error rather than a precedence rule: there is no
 * reading of `--full --summary` where the caller gets what they asked for, and
 * silently honouring one of them is how a report ends up quietly answering a
 * different question than the one asked.
 */
export function detailLevel(args: string[], fallback: Detail = 'short'): Detail {
  const chosen = (['full', 'short', 'summary'] as const).filter((name) => boolFlag(args, name) === true);
  if (chosen.length > 1) {
    throw new Error(
      `my_context: pass only one of --full, --short or --summary (got ${chosen.map((c) => `--${c}`).join(' ')}).`,
    );
  }
  return chosen[0] ?? fallback;
}

/** `--json`. Hierarchical reports are only faithful in this mode. */
export function wantsJson(args: string[]): boolean {
  return boolFlag(args, 'json') === true;
}

/** One JSON document, pretty-printed, exactly like `query --json`. */
export function emitJson(out: Emit, value: unknown): void {
  out(JSON.stringify(value, null, 2));
}

/**
 * The flag names every reporting command accepts, spelled once beside
 * `DETAIL_USAGE` so a command whose usage line advertises the detail levels
 * cannot forget to accept them (or accept ones it does not advertise).
 */
export const DETAIL_FLAGS = ['full', 'short', 'summary', 'json'];

/**
 * The first `--flag` in `args` whose name is not in `allowed`, or null.
 *
 * This is `positionals`' loop (registry.ts) with the identical value-flag
 * skip, and it has to stay identical: whatever `positionals` swallows as a
 * flag's VALUE this must not then report as an unknown flag name, or
 * `--type --json` would be refused here while `positionals` had already
 * treated `--json` as the type.
 *
 * It lives beside the detail levels because an unrecognized flag NAME is
 * precisely the failure the detail levels invite and that nothing else here
 * catches. `detailLevel`/`wantsJson` refuse a malformed VALUE (`--full=maybe`)
 * and `positionals` silently drops any `--token` it does not know, so
 * `mycontext status --ful` rendered the default report and exited 0: the user
 * asked for one thing, was given another, and was told nothing. That is the
 * same class of defect as everything else this command surface was fixed for,
 * and a typo'd detail flag is the spelling where the wrong answer looks most
 * like the right one.
 *
 * Moved here from `src/cli/index.ts` (which imports it back) so that the six
 * reporting commands the README names — `status`, `list`, `decay`,
 * `review list`, `doctor`, `ingest-status` — share ONE implementation rather
 * than one command having it and five going without, which is what the README
 * sentence "an option none of them recognises is refused, not silently
 * ignored" had been describing.
 */
export function unknownFlag(args: string[], allowed: string[], valueFlags: string[] = []): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2).split('=')[0];
    if (!allowed.includes(name)) return name;
    if (valueFlags.includes(name) && !arg.includes('=')) i++;
  }
  return null;
}

/**
 * `unknownFlag` plus the refusal message, so six call sites cannot drift into
 * six wordings. Returns true when the command should stop (having reported),
 * false when the arguments are clean.
 */
export function refuseUnknownFlag(
  args: string[], allowed: string[], valueFlags: string[], usage: string, out: Emit,
): boolean {
  const unknown = unknownFlag(args, allowed, valueFlags);
  if (unknown === null) return false;
  out(`my_context: unknown option "--${unknown}".\n${usage}`);
  return true;
}
