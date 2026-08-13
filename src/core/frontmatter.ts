export type FrontmatterValue = string | number | boolean | null | string[];

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
const LIST_ITEM = /^[ \t]+-[ \t]+(.*)$/;

function fail(lineNo: number, line: string): never {
  throw new Error(
    `unsupported frontmatter syntax at line ${lineNo}: ${JSON.stringify(line)}. ` +
    `Supported: "key: scalar", "key: [a, b]", and "key:" followed by indented "- value" lines. ` +
    `This file may have been edited outside my_context.`,
  );
}

function failDuplicateKey(lineNo: number, key: string, line: string): never {
  throw new Error(
    `duplicate frontmatter key "${key}" at line ${lineNo}: ${JSON.stringify(line)}. ` +
    `Each key must appear once. This file may have been edited outside my_context.`,
  );
}

/**
 * Finds the index of the unescaped closing quote matching `quote`, starting
 * the scan at `from`. Both `\<quote>` and `\\` are escape sequences here —
 * not just `\<quote>` — because `emitScalar` now escapes a literal backslash
 * as `\\` before it escapes the quote character; without also honouring
 * `\\` here, a value ending in an odd number of backslashes right before
 * the closing quote (e.g. `"a\\"` meaning the one-character string `a\`)
 * would be misread as an escaped quote and the real close missed. Returns
 * -1 if none.
 */
function findClosingQuote(s: string, quote: string, from: number): number {
  let i = from;
  while (i < s.length) {
    if (s[i] === '\\' && (s[i + 1] === quote || s[i + 1] === '\\')) {
      i += 2;
      continue;
    }
    if (s[i] === quote) return i;
    i++;
  }
  return -1;
}

/**
 * Unquotes a single scalar value. Throws if it opens a quote it never
 * closes. Undoes both escapes `emitScalar` can produce — `\\` back to `\`,
 * `\<quote>` back to `<quote>` — in one left-to-right pass, so a `\\`
 * immediately followed by the quote character (from a value ending in a
 * literal backslash, e.g. `a\`) is read as "escaped backslash, then real
 * closing quote" rather than mis-grouped as "backslash, escaped quote".
 */
function unquote(raw: string, lineNo: number, line: string): string {
  const t = raw.trim();
  if (t.length === 0) return '';
  const q = t[0];
  if (q === '"' || q === "'") {
    const end = findClosingQuote(t, q, 1);
    if (end === -1 || end !== t.length - 1) fail(lineNo, line);
    const inner = t.slice(1, end);
    let out = '';
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '\\' && (inner[i + 1] === q || inner[i + 1] === '\\')) {
        out += inner[i + 1];
        i++;
      } else {
        out += inner[i];
      }
    }
    return out;
  }
  return t;
}

function scalar(raw: string, lineNo: number, line: string): FrontmatterValue {
  const t = raw.trim();
  if (t === '') return '';
  if (t.startsWith('"') || t.startsWith("'")) return unquote(t, lineNo, line);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/**
 * Splits the inside of an inline array on top-level commas, honouring
 * quoted runs (and their `\"`/`\'` escapes) so a comma inside a quoted
 * element is not treated as a separator.
 */
function splitInlineElements(inner: string, lineNo: number, line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (quote) {
      if (ch === '\\' && (inner[i + 1] === quote || inner[i + 1] === '\\')) {
        cur += ch + inner[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      i++;
      continue;
    }
    if (ch === ',') {
      parts.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (quote !== null) fail(lineNo, line);
  parts.push(cur);
  // A truly empty (or whitespace-only) part means a trailing comma
  // (`[a,]`) or an empty element between commas (`[a,,b]`) — never a
  // deliberate empty string, which would arrive quoted (`[""]`) and so
  // survive this trim non-empty. Malformed, consistent with every other
  // array path in this module: throw rather than silently drop a tag or
  // scope glob.
  if (parts.some((p) => p.trim() === '')) fail(lineNo, line);
  return parts;
}

/**
 * Returns the parsed inline array, or `null` if `raw` is not an inline
 * array at all (i.e. an unquoted value that doesn't start with `[`).
 * A quoted value that happens to start with `[` is left to `scalar()`.
 * An unquoted value that starts with `[` but never closes is a malformed
 * array attempt and throws rather than falling back to a string.
 */
function inlineArray(raw: string, lineNo: number, line: string): string[] | null {
  const t = raw.trim();
  if (t.startsWith('"') || t.startsWith("'")) return null;
  if (!t.startsWith('[')) return null;
  if (!t.endsWith(']')) fail(lineNo, line);
  const inner = t.slice(1, -1).trim();
  if (inner === '') return [];
  return splitInlineElements(inner, lineNo, line).map((part) => unquote(part, lineNo, line));
}

export function parseFrontmatter(text: string): Record<string, FrontmatterValue> {
  const out: Record<string, FrontmatterValue> = {};
  const seenKeys = new Set<string>();
  const lines = text.split(/\r?\n/);
  let pendingKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      if (pendingKey === null) fail(lineNo, line);
      (out[pendingKey] as string[]).push(unquote(listMatch[1], lineNo, line));
      continue;
    }

    if (/^\s/.test(line)) fail(lineNo, line);

    const keyMatch = KEY_LINE.exec(line);
    if (!keyMatch) fail(lineNo, line);

    const [, key, rest] = keyMatch;
    if (seenKeys.has(key)) failDuplicateKey(lineNo, key, line);
    seenKeys.add(key);

    if (rest.trim() === '') {
      out[key] = [];
      pendingKey = key;
      continue;
    }

    const arr = inlineArray(rest, lineNo, line);
    out[key] = arr !== null ? arr : scalar(rest, lineNo, line);
    pendingKey = null;
  }

  return out;
}

/**
 * A leading quote character (`^['"]`) is included deliberately, not just
 * leading whitespace/`-[{`: `unquote` treats ANY value beginning with `"`
 * or `'` as an opening quote and looks for a matching close. An unquoted
 * `'auth` (no closing quote at all) fails to parse; an unquoted `"auth"`
 * parses "successfully" but silently strips the quote characters the
 * caller's string actually contained, producing `auth` — a value that is
 * not what was asked to be stored, with no error raised anywhere. Both are
 * closed by always quoting (and correctly escaping) a string that starts
 * with a quote character, rather than trusting it to survive unquoted.
 */
const NEEDS_QUOTES = /^[\s'"]|[:#]|^$|^[-[{]|[\s]$/;
/** Strings that would parse back as a number, boolean or null must be quoted. */
const LOOKS_TYPED = /^(true|false|null|~|-?\d+(\.\d+)?)$/;

/**
 * Escapes a literal backslash to `\\` BEFORE escaping `"` to `\"` — order
 * matters, since escaping `"` first would double-escape the backslash the
 * first step just inserted. `unquote`/`findClosingQuote` undo both, in the
 * same precedence, on the way back in. Before this existed, a value like
 * `a: b\` (ends in a backslash) or containing a raw `\"` sequence produced
 * a quoted scalar `parseFrontmatter` could not close correctly, throwing
 * `unsupported frontmatter syntax` the next time the file was read —
 * `emitScalar` reported success and the value was unreadable by the very
 * write that produced it.
 */
function emitScalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v !== 'string') return String(v);
  const needsQuotes = NEEDS_QUOTES.test(v) || LOOKS_TYPED.test(v);
  if (!needsQuotes) return v;
  const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function serializeFrontmatter(data: Record<string, FrontmatterValue>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) { lines.push(`${key}: []`); continue; }
      lines.push(`${key}:`);
      for (const entry of value) lines.push(`  - ${emitScalar(entry)}`);
      continue;
    }
    lines.push(`${key}: ${emitScalar(value)}`);
  }
  return lines.join('\n') + '\n';
}
