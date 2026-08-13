import { checksum, slugify } from '../core/slug.ts';

export interface Chunk {
  /** Position in the document, 0-based. */
  index: number;
  /**
   * Provenance key, unique within the document.
   *
   * Base anchor: the slug of the section's heading (or `_preamble` for text
   * before the first heading, or the literal `section` when a heading
   * slugifies to nothing, e.g. `# !!!`). This half moves only when the
   * heading's own text changes.
   *
   * Disambiguation: when two or more sections would produce the same base
   * anchor, the second and later ones get a `-2`, `-3`, ... suffix — a count
   * over prior sections that already claimed that exact anchor, walked in
   * document order. This is keyed on matching *anchor text*, not a line
   * number or index, so it never moves because of an edit to unrelated
   * content; it only moves if a section whose heading slugifies to the same
   * value is inserted or removed earlier in the document.
   *
   * Oversize sections (bigger than the size limit) are split into
   * sub-chunks; each gets a `--<hash>` suffix derived from that sub-chunk's
   * own final text (heading prefix included, where present). A sub-chunk's
   * anchor therefore changes only when that sub-chunk's own text changes —
   * never when a sibling sub-chunk's text changes — with one documented
   * exception: hard-splitting a single paragraph that alone exceeds the
   * limit uses fixed-width character windows with no content boundary to
   * anchor to, so an edit near the start of such a paragraph can shift
   * later windows' content (see splitSection's doc comment).
   *
   * Never derived from a line number or running byte offset.
   */
  anchor: string;
  heading: string | null;
  text: string;
  checksum: string;
}

export const DEFAULT_MAX_CHARS = 6000;

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const FENCE = /^(`{3,}|~{3,})/;

/** Every path through this module normalizes first, so Windows CRLF never changes a checksum. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

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

function fenceMarker(line: string): FenceState | null {
  const match = FENCE.exec(line.trim());
  if (!match) return null;
  return { char: match[1][0], len: match[1].length };
}

function closesFence(line: string, fence: FenceState): boolean {
  const closing = fenceMarker(line);
  return closing !== null && closing.char === fence.char && closing.len >= fence.len;
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
 * the opening fence's marker and length per CommonMark) is treated as
 * ordinary text, not a section break.
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
 * caller-prepended prefix (e.g. the section heading).
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
 * `-2`, `-3`, ... until a free anchor is found, and register *that* one.
 * The disambiguated result — not the pre-disambiguation candidate — is
 * what gets marked used, so a third colliding section can never reclaim an
 * anchor a second section already took.
 */
function allocateAnchor(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let n = 2;
  let next = `${candidate}-${n}`;
  while (used.has(next)) {
    n += 1;
    next = `${candidate}-${n}`;
  }
  used.add(next);
  return next;
}

export function chunkDocument(text: string, opts: { maxChars?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
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
