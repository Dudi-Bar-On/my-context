import { checksum, slugify } from '../core/slug.ts';

export interface Chunk {
  /** Position in the document, 0-based. */
  index: number;
  /** Stable provenance key. Derived from the heading slug, never from a line number. */
  anchor: string;
  heading: string | null;
  text: string;
  checksum: string;
}

export const DEFAULT_MAX_CHARS = 6000;

const HEADING = /^(#{1,6})\s+(.*?)\s*$/;

/** Every path through this module normalizes first, so Windows CRLF never changes a checksum. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Checksum of a whole source document, insensitive to line endings and edge whitespace. */
export function sourceChecksum(text: string): string {
  return checksum(normalizeEol(text).trim());
}

interface Section {
  heading: string | null;
  lines: string[];
}

function isBlank(section: Section): boolean {
  return section.heading === null && section.lines.join('\n').trim() === '';
}

/** Split on blank lines, falling back to a hard cut for a single oversize paragraph. */
function splitOversize(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const out: string[] = [];
  let current = '';

  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length > maxChars) {
      if (current) { out.push(current); current = ''; }
      for (let i = 0; i < paragraph.length; i += maxChars) {
        out.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }
    const joined = current ? `${current}\n\n${paragraph}` : paragraph;
    if (joined.length > maxChars) {
      if (current) out.push(current);
      current = paragraph;
      continue;
    }
    current = joined;
  }

  if (current) out.push(current);
  return out;
}

export function chunkDocument(text: string, opts: { maxChars?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;

  const sections: Section[] = [];
  let current: Section = { heading: null, lines: [] };

  for (const line of normalizeEol(text).split('\n')) {
    const match = HEADING.exec(line);
    if (match) {
      if (!isBlank(current)) sections.push(current);
      current = { heading: match[2], lines: [line] };
      continue;
    }
    current.lines.push(line);
  }
  if (!isBlank(current)) sections.push(current);

  const seen = new Map<string, number>();
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    if (body === '') continue;

    const base = section.heading === null
      ? '_preamble'
      : (slugify(section.heading) || 'section');

    const parts = splitOversize(body, maxChars);
    parts.forEach((part, partIndex) => {
      let anchor = parts.length > 1 ? `${base}--${partIndex + 1}` : base;
      const count = seen.get(anchor) ?? 0;
      seen.set(anchor, count + 1);
      if (count > 0) anchor = `${anchor}-${count + 1}`;

      chunks.push({
        index: chunks.length,
        anchor,
        heading: section.heading,
        text: part,
        checksum: checksum(part),
      });
    });
  }

  return chunks;
}
