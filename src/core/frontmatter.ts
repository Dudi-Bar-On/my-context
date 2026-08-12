export type FrontmatterValue = string | number | boolean | null | string[];

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
const LIST_ITEM = /^[ \t]+-[ \t]+(.*)$/;

function fail(lineNo: number, line: string): never {
  throw new Error(
    `my_context: unsupported frontmatter syntax at line ${lineNo}: ${JSON.stringify(line)}. ` +
    `Supported: "key: scalar", "key: [a, b]", and "key:" followed by indented "- value" lines. ` +
    `This file may have been edited outside my_context.`,
  );
}

function unquote(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
      (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

function scalar(raw: string): FrontmatterValue {
  const t = raw.trim();
  if (t === '') return '';
  if (t.startsWith('"') || t.startsWith("'")) return unquote(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function inlineArray(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  const inner = t.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((part) => String(unquote(part)));
}

export function parseFrontmatter(text: string): Record<string, FrontmatterValue> {
  const out: Record<string, FrontmatterValue> = {};
  const lines = text.split(/\r?\n/);
  let pendingKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      if (pendingKey === null) fail(lineNo, line);
      (out[pendingKey] as string[]).push(String(unquote(listMatch[1])));
      continue;
    }

    if (/^\s/.test(line)) fail(lineNo, line);

    const keyMatch = KEY_LINE.exec(line);
    if (!keyMatch) fail(lineNo, line);

    const [, key, rest] = keyMatch;
    if (rest.trim() === '') {
      out[key] = [];
      pendingKey = key;
      continue;
    }

    const arr = inlineArray(rest);
    out[key] = arr !== null ? arr : scalar(rest);
    pendingKey = null;
  }

  return out;
}

const NEEDS_QUOTES = /^[\s]|[:#]|^$|^[-[{]|[\s]$/;
/** Strings that would parse back as a number, boolean or null must be quoted. */
const LOOKS_TYPED = /^(true|false|null|~|-?\d+(\.\d+)?)$/;

function emitScalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v !== 'string') return String(v);
  const needsQuotes = NEEDS_QUOTES.test(v) || LOOKS_TYPED.test(v);
  return needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v;
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
