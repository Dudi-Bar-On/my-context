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

/**
 * The column budget every table, record view and wrapped paragraph is laid
 * out to.
 *
 * A CONSTANT, deliberately, and never `process.stdout.columns`. A
 * width-adaptive layout produces different bytes when piped than when watched,
 * and `scripts/gen-doc-examples.ts` captures command output through a pipe to
 * write README's example blocks: the documented tables would then be a fact
 * about the terminal the maintainer regenerated them in, and
 * `test/docs/examples.test.ts` would fail on a machine whose window is a
 * different size. The same reasoning is why `MYCONTEXT_UNICODE` is pinned
 * there rather than sniffed.
 *
 * 100 rather than 80: at 80 the four-column default (`id` alone is 63
 * characters on this repo's own corpus) has nothing left for a title, and 100
 * still fits a maximized window on any display this decade and a GitHub code
 * block without a scrollbar.
 */
export const OUTPUT_WIDTH = 100;

/** The narrowest `MYCONTEXT_WIDTH` that can still hold a bordered table. */
const MIN_WIDTH = 40;

/**
 * The layout budget, with `MYCONTEXT_WIDTH` as the operator's override.
 *
 * The override exists because the constant above cannot be right for
 * everyone — a 60-column pane and a 200-column ultrawide both exist — and
 * because it is the only way to see what this output does at another width
 * without owning that terminal.
 *
 * A value that is not a whole number of columns, or is too narrow to hold a
 * bordered table at all, falls back to `OUTPUT_WIDTH` rather than rendering a
 * table narrower than its own borders. Nothing is dropped either way: the
 * layout below wraps, and never truncates, so the budget only decides how many
 * lines a row occupies.
 */
export function outputWidth(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MYCONTEXT_WIDTH;
  if (raw === undefined) return OUTPUT_WIDTH;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= MIN_WIDTH ? parsed : OUTPUT_WIDTH;
}

/**
 * `text` broken into lines no wider than `width`, at spaces only.
 *
 * A token longer than `width` is NEVER split: it is emitted on a line of its
 * own and allowed to overflow. That rule is what keeps this safe to point at a
 * table cell — the 63-character ids this repo already has (and the globs in a
 * `scope` cell) stay in one piece and stay copy-pasteable, which a break at
 * column 20 would end. `table` sizes every column to at least its longest
 * token for the same reason, so inside a table the overflow case cannot arise.
 *
 * Text that already fits comes back verbatim, byte for byte. Only text that
 * has to be broken is re-joined on single spaces, so a cell containing runs of
 * spaces keeps them unless wrapping was needed at all.
 */
export function wrap(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

/** The longest run of non-space characters in `s` — the width it cannot go below. */
function longestToken(s: string): number {
  return Math.max(0, ...s.split(/\s+/).map((w) => w.length));
}

/**
 * A paragraph of prose wrapped to the layout budget, each line carrying
 * `prefix`.
 *
 * Reporting commands print several fixed hedges and explanations that were
 * emitted as single unwrapped lines — `decay`'s "cold" caveat was 284
 * characters at EVERY detail level, `--summary` included, so there was no way
 * to read that command's output without scrolling sideways.
 *
 * `continuation` is the prefix every line after the first carries, defaulting
 * to `prefix` — the flat shape `decay` and `status` use for their hedges,
 * which is right when the paragraph stands alone. `doctor` passes a deeper one
 * because its paragraphs are a LIST: each finding begins `  <id>: `, and with a
 * flat prefix a wrapped second line begins in the same column as the next
 * finding's id, so a five-line message reads as five findings. The budget is
 * taken from the wider of the two prefixes, so neither line shape can exceed
 * it.
 */
export function paragraph(
  text: string, prefix = '', width: number = outputWidth(), continuation: string = prefix,
): string[] {
  const indent = Math.max(prefix.length, continuation.length);
  return wrap(text, Math.max(width - indent, MIN_WIDTH))
    .map((line, i) => (i === 0 ? prefix : continuation) + line);
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
 * A bordered table: top rule, header, header rule, data, bottom rule. Nothing
 * is truncated and nothing collides — including the 63-character ids this repo
 * already has.
 *
 * A table whose natural widths fit `opts.width` (default `outputWidth()`) is
 * laid out exactly as before: one line per row, every cell whole. A table that
 * does NOT fit has its widest columns narrowed, one column at a time, and the
 * cells in them WRAPPED across as many lines as they need — because the
 * alternative the terminal offers is worse. An unbounded table does not stay
 * unbounded: the terminal rewraps every row mid-cell at its own width, which
 * destroys the columns the borders were drawn to show, and it did so worst at
 * `--full`, making the widest detail level the least readable one. Wrapping
 * here keeps the columns.
 *
 * No column is narrowed below its longest single token, so an id, a glob or a
 * URL is never broken across lines and stays copy-pasteable. A break inside a
 * hyphenated id would be the worst kind of wrong here: `INV-a-validator-that-`
 * reads as a whole id, so a reader would copy half of one and get "no item
 * with that id" for a row that is on their screen. Nothing is elided either,
 * so there is nothing for the reader to be told about.
 *
 * That floor is also why a table that CANNOT reach the budget — its own
 * longest tokens are wider than the window — is left at its natural widths
 * instead of being squeezed as far as it will go. Squeezing it buys nothing
 * (the terminal rewraps it either way) and costs a great deal: on this repo's
 * corpus, where one id is 63 characters, `list` cannot go below 116 columns,
 * and forcing it there turns one-line rows into five-line rows that STILL
 * overflow a 100-column window. `--full` exists in the shape it does
 * (`records`, below) precisely because that table has no readable width.
 *
 * A continuation line is marked by its EMPTY first column, not by a rule
 * between rows. Rules were tried and reverted: on the documentation fixture,
 * where exactly one title wraps, they turned ten clean rows into nineteen
 * lines of border for the sake of two lines of text, and the empty id cell
 * already says "this is the same item" unambiguously.
 *
 * `opts.unicode` decides the character set; omitted, it asks
 * `supportsUnicode()`. Callers pass nothing, so the six reporting commands
 * share one answer. `opts.width` is likewise only passed by tests.
 *
 * `opts.indent` is the prefix a table nested inside a section carries, and it
 * belongs here rather than at the call site because it is SUBTRACTED from the
 * budget as well as prepended: four commands used to indent the returned lines
 * themselves, which put a table laid out to exactly the budget two columns
 * over it, and two columns over is a full rewrap on the terminal it was sized
 * for.
 *
 * Returns NO lines for zero rows — a bare header over an empty table reads as
 * "here is the data" when there is none; each caller says what "none" means
 * in its own words instead.
 */
export function table(
  headers: string[], rows: string[][],
  opts: { unicode?: boolean; width?: number; indent?: string } = {},
): string[] {
  if (rows.length === 0) return [];

  const b = (opts.unicode ?? supportsUnicode()) ? BOX.unicode : BOX.ascii;
  const cellAt = (row: string[], i: number): string => row[i] ?? '';
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => cellAt(row, i).length)));
  // A header is never wrapped, so it is part of its column's floor alongside
  // the longest token in the data. Headers here are one or two short words.
  const floors = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => longestToken(cellAt(row, i)))));

  // ` cell ` plus one border character per column, plus the closing border.
  const prefix = opts.indent ?? '';
  const drawnAs = (ws: number[]): number =>
    ws.reduce((sum, w) => sum + w + 3, 0) + 1 + prefix.length;
  const budget = opts.width ?? outputWidth();
  // Only narrow a table the budget is actually reachable for; see the doc
  // comment for why the unreachable case is left alone rather than squeezed.
  if (drawnAs(floors) <= budget) {
    while (drawnAs(widths) > budget) {
      let widest = -1;
      for (let i = 0; i < widths.length; i++) {
        if (widths[i] > floors[i] && (widest === -1 || widths[i] > widths[widest])) widest = i;
      }
      /* c8 ignore next -- unreachable: drawnAs(floors) <= budget was checked above. */
      if (widest === -1) break;
      widths[widest]--;
    }
  }

  const rule = (l: string, m: string, r: string): string =>
    prefix + l + widths.map((w) => b.h.repeat(w + 2)).join(m) + r;
  const line = (values: string[]): string =>
    prefix + b.v + widths.map((w, i) => ` ${(values[i] ?? '').padEnd(w)} `).join(b.v) + b.v;
  const block = (values: string[]): string[] => {
    const wrapped = widths.map((w, i) => wrap(cellAt(values, i), w));
    const height = Math.max(...wrapped.map((c) => c.length));
    return Array.from({ length: height }, (_, l) => line(wrapped.map((c) => c[l] ?? '')));
  };

  return [
    rule(b.tl, b.tm, b.tr),
    ...block(headers),
    rule(b.ml, b.mm, b.mr),
    ...rows.flatMap(block),
    rule(b.bl, b.bm, b.br),
  ];
}

/**
 * The same data as `table`, one item per stanza instead of one item per row:
 * the first column as a heading, every other column as a labelled line under
 * it, wrapped to the layout budget with a hanging indent.
 *
 * This is what `--full` renders, and the reason is arithmetic. `list --full`
 * carries seven columns, and on this repo's own corpus two of them — a
 * 63-character id and a 92-character title — cannot share a row with the other
 * five at any terminal width a person has: the table was 280 columns wide, so
 * the level that exists to show the MOST about an item was the one level that
 * could not be read. Narrowing it into `table`'s wrapping instead would keep a
 * 63-wide column and wrap a title into a 20-wide slot five lines deep, which
 * is a table in name only.
 *
 * Nothing is dropped and nothing is truncated — the whole point of the shape
 * is that it has room for every field. The tabular form is still what
 * `--short` and the default level render, because scanning many items across
 * few columns is what a table is good at; `--json` remains the machine form of
 * this same set of fields.
 */
export function records(
  headers: string[], rows: string[][], opts: { width?: number; indent?: string } = {},
): string[] {
  if (rows.length === 0) return [];
  const labels = headers.slice(1);
  const label = Math.max(0, ...labels.map((h) => h.length));
  const prefix = opts.indent ?? '';
  const hang = prefix.length + 2 + label + 2;
  const width = opts.width ?? outputWidth();

  const stanza = (row: string[]): string[] => {
    const lines = [prefix + (row[0] ?? '')];
    for (const [i, name] of labels.entries()) {
      const wrapped = wrap(row[i + 1] ?? '', Math.max(width - hang, MIN_WIDTH));
      lines.push(`${prefix}  ${name.padEnd(label)}  ${wrapped[0]}`);
      for (const rest of wrapped.slice(1)) lines.push(' '.repeat(hang) + rest);
    }
    return lines;
  };

  // A blank line between stanzas, never a line of trailing indent: the
  // separator is what tells one item from the next, and it is not part of one.
  return rows.flatMap((row, i) => (i === 0 ? stanza(row) : ['', ...stanza(row)]));
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
 *
 * RE-EXPORTED from `core/command-flags.ts`, where the flag specs that are
 * written in terms of it now live — the same shape `relations.ts` uses to keep
 * `RELATION_TYPES` reachable from its old home after it moved to
 * `vocabulary.ts`. It is the same ARRAY through both names, not a copy;
 * `test/cli/command-flags.test.ts` asserts that, because a copy is the second
 * spelling the move exists to remove.
 */
export { DETAIL_FLAGS } from '../../core/command-flags.ts';

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
