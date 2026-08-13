import { checksum, slugify } from '../core/slug.ts';
import { normalizeEol } from '../core/text.ts';

/** Re-exported so existing consumers (`src/ingest/schema.ts`, tests) keep
 * importing it from here — the canonical implementation now lives in
 * `core/text.ts` so `core/mutate.ts` can share it without core depending
 * on ingest. */
export { normalizeEol };

export interface Chunk {
  /** Position in the document, 0-based. */
  index: number;
  /**
   * Provenance key. NOT unconditionally stable under every edit — read this
   * before trusting it for drift detection (Task 9). This section describes
   * movers that are *known*; it is not a proof that no others exist, and
   * this comment has already been wrong about that boundary twice before —
   * treat any behavioural claim here as advisory unless it is backed by a
   * test (see `test/ingest/chunk.test.ts`, which pins the central claim
   * below in "the anchor of a duplicate-heading family can be reassigned").
   *
   * Base anchor: the slug of the section's heading (`_preamble` for text
   * before the first heading; the literal `section` when a heading slugifies
   * to nothing, e.g. `# !!!`). Oversize sections add a `--<hash>` suffix
   * derived from a sub-chunk's own final text.
   *
   * Disambiguation, when two candidates collide, appends `--2`, `--3`, ...
   * — a count over prior candidates that already claimed that exact string,
   * walked in document order. The separator is a **double** hyphen
   * deliberately: `slugify` can only ever emit a single hyphen between
   * alphanumeric runs (its `[^a-z0-9]+` replace collapses any run of
   * non-alphanumeric characters, however long, to exactly one `-`), so no
   * natural heading slug can ever collide with a disambiguation suffix or a
   * hash suffix (hashes are always exactly 8 hex characters, never string-
   * equal to a short decimal counter). This makes the `--N` counter for a
   * given base independent of every *other* base's counter, immune to being
   * confused with another (differently-slugged) section's own natural slug.
   * It does NOT make the counter stable within its own family — see below.
   *
   * For each known mover: does the OLD anchor simply stop appearing (safe —
   * a consumer keyed on it sees it vanish and knows to re-resolve), or does
   * it get reassigned, unchanged, to different content (unsafe — silent
   * misattribution)?
   *
   * - **Within-family renumbering (UNSAFE — the most common mover).**
   *   `--N` is a document-order count over sections sharing one base, and
   *   nothing about which specific section is "number 2" is fixed to that
   *   section — only to its position among same-base siblings. So: `# Notes`
   *   / `# Notes` -> `notes`, `notes--2`. Delete the *first* one -> the
   *   second's anchor becomes plain `notes` — same string, now the second
   *   section's content, not the first's. Insert a new `# Notes` above both
   *   -> everything shifts down one (`notes`, `notes--2`, `notes--3`), each
   *   anchor now naming a *different* section than it did before. Renaming
   *   the first `# Notes` to something else has the same effect on the
   *   survivors as deleting it. All three (delete / insert-above / rename)
   *   reassign an anchor to different content; none of them make an anchor
   *   vanish. This is pinned by a test, not just asserted here, because this
   *   comment has stated the opposite (a "vanish, not reassignment" claim)
   *   in an earlier revision and been wrong.
   *
   * - **Editing a heading's own text (safe ONLY when no sibling shares its
   *   slug).** Changing `# Notes` to `# Old notes` changes its base anchor,
   *   so the old `notes` anchor should vanish — *unless* another `# Notes`
   *   section exists, in which case `notes` does not vanish at all: it now
   *   refers to whichever section is the (new) first same-slug survivor,
   *   which is exactly the within-family renumbering case above, triggered
   *   by a rename instead of a delete. There is no version of "edit a
   *   heading" that is unconditionally safe; it depends on whether a
   *   same-slug sibling exists before and after the edit.
   *
   * - **The sub-chunk ordinal fallback (unsafe in the identical-text case;
   *   unsafe-in-principle, negligible-in-practice in the collision case).**
   *   Two sub-chunks under the same base heading whose text hashes to the
   *   same 8 hex characters are disambiguated by the same `--N` scheme.
   *   This does NOT require a genuine hash collision: **identical** text
   *   (e.g. repeated boilerplate, or two genuinely identical windows from a
   *   hard split) hits it with no collision at all, since identical input
   *   always hashes identically. In the identical-text case the reassigned
   *   content is byte-identical, so the harm is purely ordinal (which
   *   physical occurrence "--2" points at), not semantic. A true collision
   *   between two *different* texts is the same failure mode as
   *   within-family renumbering above, gated by an 8-hex-char collision;
   *   not otherwise mitigated.
   *
   * - **Heading-prefix coupling on an oversize section's first sub-chunk**
   *   (safe — vanishes, is not reassigned). Only the first sub-chunk's text
   *   is prefixed with the heading line, so its anchor depends on whether
   *   it IS first, not only on its own prose. Insert a new paragraph above
   *   the current first one, and the old first sub-chunk's anchor (a hash
   *   of heading + its own text) disappears — even though that paragraph's
   *   words never changed — replaced by a new anchor for the now-first
   *   paragraph; the old paragraph gets a fresh, unprefixed anchor of its
   *   own. Nothing else in the document can coincidentally already hold
   *   either new hash, so this is a vanish, not a reassignment.
   *
   * - **A single paragraph that alone exceeds the size limit** is
   *   hard-split by fixed character offset (safe — vanishes). It has no
   *   natural boundary to key sub-chunk identity on, so editing near its
   *   start shifts every later window's content and hash. Old window
   *   anchors disappear; they are not reassigned to different content.
   *
   * Never derived from a line number or running byte offset, in any case.
   */
  anchor: string;
  heading: string | null;
  text: string;
  checksum: string;
}

export const DEFAULT_MAX_CHARS = 6000;

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const FENCE_OPEN = /^(`{3,}|~{3,})/;
/** A closing fence, per CommonMark, must carry no info string — only the fence run and trailing whitespace. */
const FENCE_CLOSE = /^(`{3,}|~{3,})[ \t]*$/;

/** Checksum of a whole source document, insensitive to line endings and edge whitespace. */
export function sourceChecksum(text: string): string {
  return checksum(normalizeEol(text).trim());
}

/** Strip a CommonMark ATX closing sequence, e.g. "Closed ##" -> "Closed". */
function stripAtxClose(heading: string): string {
  return heading.replace(/\s+#+\s*$/, '');
}

interface FenceState {
  char: string;
  len: number;
}

/** Detects an *opening* fence marker. Permissive: an info string (e.g. "```js") is allowed here. */
function fenceMarker(line: string): FenceState | null {
  const match = FENCE_OPEN.exec(line.trim());
  if (!match) return null;
  return { char: match[1][0], len: match[1].length };
}

/**
 * Detects whether `line` *closes* `fence`. Strict, per CommonMark: a
 * closing fence carries no info string, and must be at least as long as
 * the opening fence and use the same character. A line like "```js" while
 * inside a fence does NOT close it — it is content.
 */
function closesFence(line: string, fence: FenceState): boolean {
  const match = FENCE_CLOSE.exec(line.trim());
  return match !== null && match[1][0] === fence.char && match[1].length >= fence.len;
}

interface Section {
  heading: string | null;
  /** The raw heading line (e.g. "# Auth requirements"), or null for the preamble. */
  headingLine: string | null;
  lines: string[];
}

function isBlank(section: Section): boolean {
  return section.heading === null && section.lines.join('\n').trim() === '';
}

/**
 * Split a normalized document into sections at ATX (`#`...`######`) headings.
 * A heading-shaped line inside a fenced code block (``` or ~~~, respecting
 * the opening fence's marker, length and closing rules per CommonMark) is
 * treated as ordinary text, not a section break.
 *
 * Note: setext headings (a line of text underlined with `===`/`---`) are
 * NOT recognized — only ATX headings start a new section. A document that
 * uses only setext headings becomes a single `_preamble` chunk. This is a
 * known limitation, not implemented here: correct recognition needs
 * one-line lookahead interleaved with the fence-tracking above, and `---`
 * collides with the thematic-break syntax, which adds ambiguity a small
 * fix could easily get wrong. The brief specifies ATX only.
 */
function splitIntoSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, headingLine: null, lines: [] };
  let fence: FenceState | null = null;

  for (const line of text.split('\n')) {
    if (fence) {
      current.lines.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    const opening = fenceMarker(line);
    if (opening) {
      fence = opening;
      current.lines.push(line);
      continue;
    }

    const match = ATX_HEADING.exec(line);
    if (match) {
      if (!isBlank(current)) sections.push(current);
      current = { heading: stripAtxClose(match[2]), headingLine: line, lines: [line] };
      continue;
    }
    current.lines.push(line);
  }
  if (!isBlank(current)) sections.push(current);
  return sections;
}

/**
 * Split text into paragraphs on blank lines. A fenced code block is kept as
 * one atomic paragraph even if it contains blank lines internally, so an
 * oversize split never cuts a section body in the middle of a fence.
 *
 * NOTE for consumers: a chunk's `text` is therefore not always a verbatim
 * substring of the source region it came from — the blank-line separators
 * between paragraphs are consumed as delimiters, not carried into any
 * paragraph's text. Do not assume `chunk.text` byte-reconstructs the
 * source; only non-split (`whole`-sized) chunks currently do.
 */
function splitParagraphs(text: string): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  let fence: FenceState | null = null;

  const flush = () => {
    if (current.length) {
      paragraphs.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of text.split('\n')) {
    if (fence) {
      current.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    const opening = fenceMarker(line);
    if (opening) fence = opening;
    current.push(line);
  }
  flush();
  return paragraphs;
}

/**
 * Hard-split a single oversize paragraph into windows of at most
 * `maxChars`, the first window shrunk to `firstBudget` to leave room for a
 * caller-prepended prefix (e.g. the section heading). `maxChars` must be
 * >= 1 — callers (`chunkDocument`) are responsible for clamping it, since
 * a non-positive `maxChars` would make `budget` never advance `offset`: the
 * output array grows without bound until it throws `RangeError: Invalid
 * array length` (observed after ~2s for a short input) rather than
 * returning — not a true infinite loop, but not a controlled failure either.
 */
function hardSplit(text: string, maxChars: number, firstBudget: number): string[] {
  const out: string[] = [];
  let offset = 0;
  let budget = firstBudget;
  while (offset < text.length) {
    // `slice`'s end index auto-clamps past `text.length`, so the final,
    // possibly-shorter window needs no separate remaining-length check.
    out.push(text.slice(offset, offset + budget));
    offset += budget;
    budget = maxChars;
  }
  return out;
}

/**
 * Split an oversize section's body into sub-chunks of at most `maxChars`
 * each (`headingPrefix` reserves room for the heading text prepended to the
 * first sub-chunk, so the first sub-chunk always carries real content, not
 * just the heading line).
 *
 * Each paragraph becomes its own sub-chunk — paragraphs are never combined
 * — so a sub-chunk's text is a pure function of exactly one paragraph (plus,
 * for the first, the heading). Inserting, deleting or editing a *different*
 * paragraph in the same section cannot change this sub-chunk's text, and
 * since its anchor is a hash of that text, the anchor is equally immune.
 *
 * The one case this cannot make stable: a single paragraph that alone
 * exceeds `maxChars` is hard-split by fixed character offset (`hardSplit`).
 * A paragraph has no smaller content-addressable boundary to key sub-window
 * identity on without a fundamentally different (content-defined / rolling
 * hash) chunking algorithm, which is out of scope here. Editing near the
 * start of such a paragraph shifts every later window's content, and so
 * its anchor. This is called out explicitly rather than papered over.
 */
function splitSection(rest: string, maxChars: number, headingPrefix: string): string[] {
  if (rest === '') return [];

  const paragraphs = splitParagraphs(rest);
  const out: string[] = [];
  let first = true;

  for (const paragraph of paragraphs) {
    const prefix = first ? headingPrefix : '';
    const budget = Math.max(1, maxChars - prefix.length);

    if (paragraph.length <= budget) {
      out.push(prefix + paragraph);
    } else {
      const slices = hardSplit(paragraph, maxChars, budget);
      slices.forEach((slice, i) => out.push(i === 0 ? prefix + slice : slice));
    }
    first = false;
  }
  return out;
}

function shortHash(text: string): string {
  return checksum(text).slice(0, 8);
}

/**
 * Register `candidate` as the anchor if it is free; otherwise append
 * `--2`, `--3`, ... (double hyphen — see the `Chunk.anchor` doc comment for
 * why that separator is unreachable by `slugify`) until a free anchor is
 * found, and register *that* one. The disambiguated result — not the
 * pre-disambiguation candidate — is what gets marked used, so a third
 * colliding section can never reclaim an anchor a second section already
 * took.
 */
function allocateAnchor(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let n = 2;
  let next = `${candidate}--${n}`;
  while (used.has(next)) {
    n += 1;
    next = `${candidate}--${n}`;
  }
  used.add(next);
  return next;
}

export function chunkDocument(text: string, opts: { maxChars?: number } = {}): Chunk[] {
  // Clamped to at least 1: a non-positive maxChars would leave hardSplit's
  // per-iteration budget non-positive too, so `offset` never advances and
  // the array grows without bound (see hardSplit's doc comment). `NaN`
  // fails every numeric comparison (including `Math.max(1, NaN) === NaN`),
  // so it is caught separately and treated as "not given" rather than
  // silently producing a single chunk that discards the whole body.
  const requested = opts.maxChars;
  const maxChars = Number.isFinite(requested) ? Math.max(1, requested as number) : DEFAULT_MAX_CHARS;
  const sections = splitIntoSections(normalizeEol(text));

  const used = new Set<string>();
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const restLines = section.headingLine !== null ? section.lines.slice(1) : section.lines;
    const rest = restLines.join('\n').trim();
    const headingPrefix = section.headingLine !== null ? `${section.headingLine}\n\n` : '';

    const whole = section.headingLine !== null
      ? (rest ? `${section.headingLine}\n\n${rest}` : section.headingLine)
      : rest;

    const base = section.heading === null
      ? '_preamble'
      : (slugify(section.heading) || 'section');

    if (whole.length <= maxChars) {
      chunks.push({
        index: chunks.length,
        anchor: allocateAnchor(base, used),
        heading: section.heading,
        text: whole,
        checksum: checksum(whole),
      });
      continue;
    }

    const parts = rest !== ''
      ? splitSection(rest, maxChars, headingPrefix)
      : hardSplit(section.headingLine ?? '', maxChars, maxChars);

    for (const part of parts) {
      const anchor = allocateAnchor(`${base}--${shortHash(part)}`, used);
      chunks.push({
        index: chunks.length,
        anchor,
        heading: section.heading,
        text: part,
        checksum: checksum(part),
      });
    }
  }

  return chunks;
}
