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
 * A column-aligned table: a header row, a rule under it, then the data. Widths
 * come from the widest of the header and every cell, so nothing collides and
 * nothing is truncated.
 *
 * Returns NO lines for zero rows — a bare header over an empty table reads as
 * "here is the data" when there is none; each caller says what "none" means
 * in its own words instead.
 */
export function table(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return [];

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? '').length)));

  const pad = (values: string[]): string =>
    widths.map((w, i) => (values[i] ?? '').padEnd(w)).join('  ').trimEnd();

  return [pad(headers), pad(widths.map((w) => '-'.repeat(w))), ...rows.map(pad)];
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
