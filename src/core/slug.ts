import { createHash } from 'node:crypto';

const MAX_SLUG = 60;

/**
 * Combining diacritics, built from a string so the source file contains no
 * literal combining characters (which are invisible and easy to corrupt).
 */
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * The same normalization `slugify` applies (NFKD, strip combining marks,
 * lowercase, collapse any non-alphanumeric run to one hyphen, trim edge
 * hyphens) but WITHOUT the 60-character truncation below — exported so a
 * caller that needs case-/punctuation-tolerant identity without also
 * tolerating `slugify`'s truncation collision (two different long titles
 * cut down to the same 60 chars) has somewhere to get it. `slugify` itself
 * is defined in terms of this.
 */
export function normalizeForSlug(title: string): string {
  return title
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Deterministic, lowercase, hyphen-separated. Identical on every platform. */
export function slugify(title: string): string {
  const base = normalizeForSlug(title);

  if (base.length <= MAX_SLUG) return base;
  const cut = base.slice(0, MAX_SLUG);

  // F3: a hyphen inside `cut` is not, by itself, evidence that a word was
  // chopped in half — it is only evidence of that when the word AFTER the
  // hyphen keeps going past the ceiling. If `base[MAX_SLUG]` is itself a
  // separator (or the string simply ends there), the word that ends exactly
  // at the ceiling is already complete, and backing off to the previous
  // hyphen would discard a whole word that fit for no reason. Only back off
  // when the character immediately after the cut is alphanumeric, i.e. the
  // word straddling the boundary genuinely continues beyond it.
  if (!/[a-z0-9]/.test(base.charAt(MAX_SLUG))) return cut.replace(/-+$/, '');

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
