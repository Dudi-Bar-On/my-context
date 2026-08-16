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

/**
 * The logical rows of the rendered table in `out` — header first — with each
 * wrapped cell rejoined into the text the renderer was given.
 *
 * This exists because a phrase asserted against the RENDERED bytes is a claim
 * about the layout, not the content: `table()` (format.ts) wraps any cell its
 * column cannot hold, so "tokens not recorded" can render as "tokens not" /
 * "recorded" across two physical lines, with a border character between the
 * fragments once the lines are joined. Whether that border is `│` or `|` is
 * decided by `supportsUnicode()` from the ambient environment, which is how a
 * test matching the phrase passed on every terminal-launched local shell and
 * failed on CI's bare one. Reconstructing the cells first makes an assertion
 * about cell CONTENT immune to both the wrap point and the border charset, by
 * construction.
 *
 * The renderer's own contract (format.ts, `table`'s doc comment) is what makes
 * the rejoin unambiguous: a continuation line is marked by its EMPTY first
 * column, and `wrap` only ever breaks at spaces, so joining a cell's fragments
 * with a single space returns exactly the text the renderer was given.
 *
 * Limitation, stated so it is not discovered: a cell whose CONTENT contains a
 * border character (`│` or `|`) would be split on it. No cell this repository
 * renders carries one.
 */
export function logicalRows(out: string): string[][] {
  const rows: string[][] = [];
  for (const raw of out.split('\n')) {
    // Cell lines start with a vertical border (after any indent); rule lines
    // start with `┌`/`├`/`└` or `+` and prose lines with neither.
    if (!/^\s*[│|]/.test(raw)) continue;
    const trimmed = raw.trim();
    const cells = trimmed.slice(1, -1).split(/[│|]/).map((c) => c.trim());
    const last = rows[rows.length - 1];
    if (cells[0] === '' && last !== undefined) {
      for (const [i, fragment] of cells.entries()) {
        if (fragment === '') continue;
        last[i] = last[i] === undefined || last[i] === '' ? fragment : `${last[i]} ${fragment}`;
      }
    } else {
      rows.push(cells);
    }
  }
  return rows;
}
