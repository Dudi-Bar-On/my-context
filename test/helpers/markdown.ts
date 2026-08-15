/**
 * The two Markdown rules `test/docs/*` needs to agree on: where a fenced block
 * starts and ends, and what anchor GitHub gives a heading.
 *
 * Both live here rather than in one test file because two tests now depend on
 * them — `parity.test.ts` counts headings, `capabilities.test.ts` resolves
 * links to them — and a second copy of a subtle rule is how the first copy goes
 * quietly wrong. The fence tracker in particular was already wrong once (see
 * below), and a duplicate would have had to be found and fixed twice.
 */

const FENCE = /^ {0,3}(`{3,})[ \t]*(\S*)/;
const HEADING = /^(#{1,6}) (\S.*)$/;

/**
 * A CommonMark fence tracker, rather than a `/^```/` toggle.
 *
 * The toggle was wrong and stayed green by luck. Both documents carry a
 * five-backtick example block — `mycontext ingest`'s extraction request — whose
 * body holds a ```` ```json ```` fence and a four-backtick one, and each of
 * those inner lines starts with three backticks, so the toggle flipped on all
 * of them. It happened to flip an even number of times, so the parity
 * assertions still saw the real headings; a body with one more inner fence, or
 * an opener at the wrong nesting, would have silently hidden a section of the
 * document from every check built on it.
 *
 * The rule implemented here is the one CommonMark states and the one
 * `scripts/gen-doc-examples.ts` already derives its closing fence from: while
 * open, a block ends only at a line whose backtick run is at least as long as
 * the opener's and which holds nothing else. Everything shorter is body.
 *
 * Returns a predicate that reports, for each line in order, whether that line
 * is inside a fenced block or is one of its two fence lines.
 */
export function fenceTracker(): (line: string) => boolean {
  let open: number | null = null;
  return (line: string): boolean => {
    const m = FENCE.exec(line);
    if (open === null) {
      // An opening fence may carry an info string (```text); a closing one may not.
      if (m !== null) { open = m[1].length; return true; }
      return false;
    }
    if (m !== null && m[1].length >= open && m[2] === '') { open = null; return true; }
    return true;
  };
}

/** One heading of a document: its depth, its raw source text, and its anchor. */
export interface Heading {
  /** 1 for `#`, 6 for `######`. */
  depth: number;
  /** The heading text as written, markup included. */
  text: string;
  /** The anchor GitHub mints for it, without the leading `#`. */
  slug: string;
  /** 1-based line number in the source. */
  line: number;
}

/**
 * The anchor GitHub gives a heading.
 *
 * GitHub slugs the *rendered* text: HTML tags are dropped and their content
 * kept, code spans keep their content, then the result is lower-cased,
 * everything that is not a letter, digit, `_`, space or hyphen is removed, and
 * spaces become hyphens. Two headings that slug the same get `-1`, `-2` … in
 * document order, which `headings()` below applies.
 *
 * Tag-stripping is deliberately done outside code spans only. Both documents
 * carry `` `categories.<name>.enabled` `` as a heading: `<name>` is literal
 * text inside a code span, and its anchor is `categoriesnameenabled`. Stripping
 * it as if it were a tag would produce `categoriesenabled` and silently declare
 * every link to that section broken.
 *
 * Calibrated against the rendered documents rather than from memory: with this
 * function all 119 in-document anchors of `README.md` and all 118 of
 * `docs/README.he.md` resolve, matching what rendering both files through
 * GitHub's own markdown API produced.
 */
export function headingSlug(text: string): string {
  const flattened = text
    .split(/(`[^`]*`)/)
    .map((part) => (
      part.length > 1 && part.startsWith('`') && part.endsWith('`')
        ? part.slice(1, -1)
        : part.replace(/<[^>]*>/g, '')
    ))
    .join('');
  return flattened
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replace(/ /g, '-');
}

/**
 * Every heading of a document, in order — `#` lines inside fenced blocks
 * excluded.
 *
 * Excluding them is deliberate. Both documents quote injected output verbatim
 * (§3, §4, §6), and that output contains `## my_context index` and similar
 * lines which are not sections of the README: they are the tool's words.
 */
export function headings(markdown: string): Heading[] {
  const found: Heading[] = [];
  const seen = new Map<string, number>();
  const fenced = fenceTracker();
  markdown.split('\n').forEach((line, i) => {
    if (fenced(line)) return;
    const m = HEADING.exec(line);
    if (m === null) return;
    const base = headingSlug(m[2]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    found.push({ depth: m[1].length, text: m[2], slug: n === 0 ? base : `${base}-${n}`, line: i + 1 });
  });
  return found;
}
