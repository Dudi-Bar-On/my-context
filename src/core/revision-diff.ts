/**
 * The line diff a revision is reviewed as — extracted, verbatim, from
 * `cli/commands/revision-view.ts` (web-ui plan 2, Task 2).
 *
 * It moved so the UI server can serve the SAME LCS diff the terminal prints
 * without importing the CLI view. `revision-view.ts` value-imports from
 * `revision.ts`, and `revision.ts` imports `updateItem` at runtime, so an
 * import of the CLI view would put a mutating function inside the read-only
 * server's graph. This module imports `revision-log.ts` for its types and
 * nothing else; the CLI view imports these functions back, so there is still
 * exactly one implementation of the diff and one of the value-to-lines
 * rendering — a second one written in the browser would be this project's
 * most-repeated defect in a new medium.
 */
import type { RevisionField, RevisionValue } from './revision-log.ts';

export interface DiffLine { mark: '-' | '+' | ' '; text: string }

/**
 * A line-level diff, longest-common-subsequence, so an unchanged line inside a
 * changed body is shown as context rather than as a deletion and an addition.
 *
 * The quadratic table is bounded: past `MAX_CELLS` the two sides are shown as
 * a whole-block replacement instead. That is a coarser diff, never a shorter
 * one — every line of both texts is still printed — so the guard costs
 * precision and never costs the reader a line of what is changing.
 */
const MAX_CELLS = 250_000;

export function lineDiff(from: string[], to: string[]): DiffLine[] {
  if (from.length * to.length > MAX_CELLS) {
    return [
      ...from.map((text): DiffLine => ({ mark: '-', text })),
      ...to.map((text): DiffLine => ({ mark: '+', text })),
    ];
  }
  // lcs[i][j] = length of the longest common subsequence of from[i..] and to[j..].
  const lcs: number[][] = Array.from(
    { length: from.length + 1 },
    () => new Array<number>(to.length + 1).fill(0),
  );
  for (let i = from.length - 1; i >= 0; i--) {
    for (let j = to.length - 1; j >= 0; j--) {
      lcs[i][j] = from[i] === to[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < from.length && j < to.length) {
    if (from[i] === to[j]) { out.push({ mark: ' ', text: from[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ mark: '-', text: from[i] }); i++; }
    else { out.push({ mark: '+', text: to[j] }); j++; }
  }
  for (; i < from.length; i++) out.push({ mark: '-', text: from[i] });
  for (; j < to.length; j++) out.push({ mark: '+', text: to[j] });
  return out;
}

/**
 * A field's value as the lines a diff compares.
 *
 * `tags` are one line, comma-joined and SORTED: they are an unordered set
 * (`sameValue` in revision.ts compares them that way, and a reordering is
 * therefore not a change), so rendering them in stored order would show a
 * human `- a, b` / `+ b, a` for a revision that changes only which tags exist.
 *
 * `extra` is ONE LINE PER KEY, sorted by key, for the same reason and one
 * more: a proposal carries only the keys it moves, so the reviewer of a
 * `directive` change reads `- directive: dont` / `+ directive: do` — the whole
 * decision on two lines — rather than a re-rendering of a map. A key the item
 * does not have yet has no "-" line at all, which is what its absence looks
 * like; `(not set)` would read as a stored value.
 */
export function valueLines(field: RevisionField, value: RevisionValue | undefined): string[] | null {
  if (value === undefined) return null;
  if (field === 'tags') {
    const tags = [...(value as string[])].sort();
    return [tags.length === 0 ? '(no tags)' : tags.join(', ')];
  }
  if (field === 'extra') {
    const extra = value as Record<string, string>;
    const keys = Object.keys(extra).sort();
    return keys.length === 0 ? ['(no extra fields)'] : keys.map((key) => `${key}: ${extra[key]}`);
  }
  // `summary` is one line by construction (`validateSummary` refuses a line
  // break), and the empty string is the ABSENCE of a summary rather than an
  // empty one — rendering it as a bare `-`/`+` would show a reader a blank line
  // where the fact is "there is none", which is the same silent gap
  // `(no tags)` and `(no extra fields)` above exist to close.
  if (field === 'summary') {
    const text = value as string;
    return [text === '' ? '(no summary)' : text];
  }
  return (value as string).split('\n');
}
