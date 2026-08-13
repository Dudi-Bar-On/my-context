import { createHash } from 'node:crypto';

const MAX_SLUG = 60;

/**
 * Combining diacritics, built from a string so the source file contains no
 * literal combining characters (which are invisible and easy to corrupt).
 */
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

/** Deterministic, lowercase, hyphen-separated. Identical on every platform. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= MAX_SLUG) return base;
  const cut = base.slice(0, MAX_SLUG);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

export function makeId(prefix: string, title: string): string {
  return `${prefix.toUpperCase()}-${slugify(title)}`;
}

/** First 16 hex chars of SHA-256. Used for tamper and drift detection. */
export function checksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}
