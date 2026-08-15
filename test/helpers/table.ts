/**
 * Matchers for the bordered tables every reporting command prints.
 *
 * They accept EITHER rendering — box-drawing `│` or the ASCII `|` fallback —
 * on purpose. Which one `table()` picks depends on the terminal the test
 * process inherited its environment from (`supportsUnicode` in
 * `src/cli/commands/format.ts`), so a matcher that pinned one of them would
 * pass here and fail on a machine whose shell exports nothing. The glyphs
 * themselves are pinned exactly, in both modes, by `format-table.test.ts`;
 * what these assert is the columns and their contents.
 *
 * They are also stricter than the `\s+`-separated matchers they replaced: a
 * column boundary must actually sit between two cells, where whitespace alone
 * would have matched a cell containing a space.
 */

/** A cell boundary in either rendering. */
const V = '[│|]';

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const contiguous = (cells: string[]): string =>
  cells.map((cell) => `${V} ${escape(cell)}`).join('\\s*');

/**
 * These cells, in this order, side by side in one row — with whatever columns
 * precede or follow them left unconstrained. Use it when a row carries a
 * `title` or `message` column the assertion does not care about.
 */
export function cells(...values: string[]): RegExp {
  return new RegExp(contiguous(values), 'm');
}

/**
 * A row whose FIRST cell matches `pattern` (a regex source fragment), with
 * that cell captured. For pulling generated ids out of a table rather than
 * asserting on one.
 */
export function firstCell(pattern: string, flags = 'm'): RegExp {
  return new RegExp(`^\\s*${V} (${pattern}) `, flags);
}

/** These cells and no others: a whole row, from its left border to its right. */
export function row(...values: string[]): RegExp {
  return new RegExp(`^\\s*${contiguous(values)}\\s*${V}\\s*$`, 'm');
}
