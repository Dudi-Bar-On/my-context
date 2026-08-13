import { parseFrontmatter, serializeFrontmatter, type FrontmatterValue } from './frontmatter.ts';
import { checksum } from './slug.ts';
import type { Item, Layer, Observation, Origin, Relation, Severity, Status } from './types.ts';

const DELIM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const OBSERVATION = /^-\s+\[([a-z0-9_-]+)\]\s+(.*)$/i;
const RELATION = /^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i;

const COMMON_KEYS = new Set([
  'id', 'type', 'title', 'status', 'severity', 'always', 'scope', 'tags', 'origin',
  'source_file', 'source_anchor', 'source_checksum', 'valid_from', 'valid_until', 'checksum',
]);

/** Escapes a string for safe interpolation into a RegExp source. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recovers the raw, unparsed scalar text for `key` from the frontmatter
 * block. Used only as a fallback when `parseFrontmatter` has already
 * coerced the value to a `number` (see `asString` below) — never for
 * quoted or list values, which `parseFrontmatter` handles losslessly.
 *
 * Works for any key, not just the fixed `COMMON_KEYS` set — `frontmatter.ts`
 * restricts parsed keys to `[A-Za-z_][A-Za-z0-9_]*` (no regex metacharacters)
 * via `KEY_LINE`, but the key is escaped anyway rather than relying on that
 * invariant holding in another module.
 */
function rawScalarText(rawBlock: string, key: string): string | null {
  const re = new RegExp(`^${escapeRegExp(key)}:[ \\t]*(.*)$`, 'm');
  const m = re.exec(rawBlock);
  if (!m) return null;
  const t = m[1].trim();
  return t === '' ? null : t;
}

/**
 * Coerce a scalar frontmatter value to a string.
 *
 * Numbers matter here: a 16-hex-char checksum can be all digits, so
 * `checksum: 0000000000000000` arrives from `parseFrontmatter` as the
 * *number* 0 — `String(v)` alone can't recover the leading zeros, since
 * that information is already gone once YAML-style parsing turns the text
 * into a JS number. Treating only `typeof v === 'string'` as valid would
 * silently drop the field entirely; falling back to the raw source text
 * for number-typed values recovers it exactly instead.
 */
function asString(v: FrontmatterValue, rawBlock: string, key: string): string | null {
  if (v === undefined || v === null || Array.isArray(v)) return null;
  if (typeof v === 'number') return rawScalarText(rawBlock, key);
  const s = String(v);
  return s === '' ? null : s;
}

function requireString(fm: Record<string, FrontmatterValue>, rawBlock: string, key: string): string {
  const v = asString(fm[key], rawBlock, key);
  if (v === null) throw new Error(`item is missing required field "${key}".`);
  return v;
}

function optString(fm: Record<string, FrontmatterValue>, rawBlock: string, key: string): string | null {
  return asString(fm[key], rawBlock, key);
}

function stringList(fm: Record<string, FrontmatterValue>, key: string): string[] {
  const v = fm[key];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v !== '') return [v];
  return [];
}

/** Split the body into its leading prose and its `## Section` blocks. */
function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {
  const lines = body.split('\n');
  const sections = new Map<string, string[]>();
  const prose: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1].toLowerCase();
      sections.set(current, []);
      continue;
    }
    if (current === null) {
      if (/^#\s+/.test(line)) continue;
      prose.push(line);
      continue;
    }
    sections.get(current)!.push(line);
  }

  return { prose: prose.join('\n').trim(), sections };
}

function parseObservations(lines: string[]): Observation[] {
  const out: Observation[] = [];
  for (const line of lines) {
    const m = OBSERVATION.exec(line.trim());
    if (!m) continue;
    let text = m[2].trim();

    let context: string | null = null;
    const ctx = /\(([^()]*)\)\s*$/.exec(text);
    if (ctx) { context = ctx[1].trim(); text = text.slice(0, ctx.index).trim(); }

    const tags: string[] = [];
    text = text.replace(/#([A-Za-z0-9_-]+)/g, (_all, tag: string) => { tags.push(tag); return ''; })
               .replace(/\s+/g, ' ').trim();

    out.push({ category: m[1].toLowerCase(), text, tags, context });
  }
  return out;
}

function parseRelations(lines: string[]): Relation[] {
  const out: Relation[] = [];
  for (const line of lines) {
    const m = RELATION.exec(line.trim());
    if (!m) continue;
    out.push({ type: (m[1] ?? 'links_to').toLowerCase(), target: m[2].trim() });
  }
  return out;
}

export function parseItem(text: string, filePath: string, layer: Layer): Item {
  // Normalize once, up front: the global constraint is LF everywhere, so a
  // CRLF- OR lone-CR- (classic Mac) authored file must never let a `\r`
  // survive into `item.body` (or anywhere else) only to be re-emitted
  // verbatim by renderItem.
  const normalized = text.replace(/\r\n?/g, '\n');

  const match = DELIM.exec(normalized);
  if (!match) {
    throw new Error(`${filePath} has no --- frontmatter block.`);
  }

  const rawBlock = match[1];
  const fm = parseFrontmatter(rawBlock);
  const body = normalized.slice(match[0].length);
  const { prose, sections } = splitSections(body);

  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (COMMON_KEYS.has(key)) continue;
    if (Array.isArray(value)) { extra[key] = value.join(', '); continue; }
    if (value === null) continue;
    const s = asString(value, rawBlock, key);
    if (s !== null) extra[key] = s;
  }

  return {
    id: requireString(fm, rawBlock, 'id'),
    type: requireString(fm, rawBlock, 'type'),
    title: requireString(fm, rawBlock, 'title'),
    status: (optString(fm, rawBlock, 'status') ?? 'active') as Status,
    severity: (optString(fm, rawBlock, 'severity') ?? 'soft') as Severity,
    always: fm.always === true,
    scope: stringList(fm, 'scope'),
    tags: stringList(fm, 'tags'),
    origin: (optString(fm, rawBlock, 'origin') ?? 'human') as Origin,
    sourceFile: optString(fm, rawBlock, 'source_file'),
    sourceAnchor: optString(fm, rawBlock, 'source_anchor'),
    sourceChecksum: optString(fm, rawBlock, 'source_checksum'),
    validFrom: optString(fm, rawBlock, 'valid_from'),
    validUntil: optString(fm, rawBlock, 'valid_until'),
    checksum: optString(fm, rawBlock, 'checksum') ?? '',
    extra,
    body: prose,
    observations: parseObservations(sections.get('observations') ?? []),
    relations: parseRelations(sections.get('relations') ?? []),
    layer,
    filePath,
  };
}

/** Checksum over the semantic content only — never over the checksum field itself. */
export function computeItemChecksum(item: Item): string {
  return checksum(JSON.stringify({
    id: item.id, type: item.type, title: item.title, status: item.status,
    severity: item.severity, always: item.always, scope: item.scope, tags: item.tags,
    origin: item.origin, extra: item.extra, body: item.body,
    observations: item.observations, relations: item.relations,
  }));
}

function renderObservation(o: Observation): string {
  const tags = o.tags.map((t) => ` #${t}`).join('');
  const ctx = o.context ? ` (${o.context})` : '';
  return `- [${o.category}] ${o.text}${tags}${ctx}`;
}

export function renderItem(item: Item): string {
  const fm: Record<string, FrontmatterValue> = {
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    severity: item.severity,
    always: item.always,
    scope: item.scope,
    tags: item.tags,
    origin: item.origin,
    source_file: item.sourceFile,
    source_anchor: item.sourceAnchor,
    source_checksum: item.sourceChecksum,
    valid_from: item.validFrom,
    valid_until: item.validUntil,
    checksum: item.checksum,
  };
  for (const [key, value] of Object.entries(item.extra)) fm[key] = value;

  const parts = [
    '---',
    serializeFrontmatter(fm).trimEnd(),
    '---',
    '',
    `# ${item.title}`,
    '',
  ];
  if (item.body) parts.push(item.body, '');
  if (item.observations.length) {
    parts.push('## Observations', ...item.observations.map(renderObservation), '');
  }
  if (item.relations.length) {
    parts.push('## Relations', ...item.relations.map((r) => `- ${r.type} [[${r.target}]]`), '');
  }
  return parts.join('\n');
}
