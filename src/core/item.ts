import { parseFrontmatter, serializeFrontmatter, type FrontmatterValue } from './frontmatter.ts';
import { checksum } from './slug.ts';
import { validateLoadedId } from './vocabulary.ts';
import type { Item, Layer, Observation, Origin, Relation, Severity, Status, Step } from './types.ts';

const DELIM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const OBSERVATION = /^-\s+\[([a-z0-9_-]+)\]\s+(.*)$/i;
const RELATION = /^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i;

/**
 * A `## Steps` line.
 *
 * **No `/i` flag, deliberately, and the two reasons are different from
 * `OBSERVATION`'s.** `OBSERVATION` carries `/i` because it must parse files
 * this product already wrote with mixed-case categories, and it lower-cases
 * what it captures. A step marker has no such history and no such
 * normalisation: if `[X]` matched, `renderStep` would write `[x]` back and
 * the file would not round-trip. The two regexes also overlap — `- [x] foo`
 * matches `OBSERVATION` with category `x` — which is harmless while they
 * live in different sections and **must not be resolved by widening either
 * one**.
 */
const STEP = /^-\s+\[([ x])\]\s+(.*)$/;

/**
 * Whether `category` is something that survives the render/parse round trip
 * UNCHANGED — not merely something `OBSERVATION`'s bracket can match. Those
 * are different questions: `OBSERVATION` carries the `/i` flag (it has to,
 * to parse a file a human or an old version of this code already wrote with
 * mixed case), so it happily matches `[Root-Cause]` — but `parseObservations`
 * (above) then does `m[1].toLowerCase()`. A category that matches the regex
 * but isn't already lowercase therefore parses back to a DIFFERENT string
 * than what was written: `computeItemChecksum` was taken over `Root-Cause`,
 * the reloaded item has `root-cause`, and every subsequent MCP call reports
 * a checksum mismatch — plus a second `create_item` call with the same
 * (differently-cased) input no longer finds its dedup match, since
 * `itemContentHash` is computed over the object in memory, not over what
 * disk would hand back. This function is deliberately NOT a second regex
 * restating `[a-z0-9_-]+` as a literal — that copy could drift from the
 * parser's real grammar — so it still runs `OBSERVATION` itself against a
 * synthetic line to check the bracket's character class, but it ALSO
 * requires `category` to already equal its own lowercased form, matching
 * what `parseObservations` actually does to whatever survives that check.
 * Exported so `mutate.ts` can refuse an un-round-trippable category at the
 * write boundary instead of restating either shape.
 */
export function isValidObservationCategory(category: string): boolean {
  const m = OBSERVATION.exec(`- [${category}] x`);
  return m !== null && m[1] === category && category === category.toLowerCase();
}

const COMMON_KEYS = new Set([
  'id', 'type', 'title', 'status', 'severity', 'always', 'continuity', 'scope', 'tags', 'origin',
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

/**
 * The `## Section` heading grammar, named because two readers now depend on
 * it agreeing with itself: `splitSections` below and `repeatedSections`
 * beside it. A second copy of the pattern would be the defect
 * `isValidObservationCategory` (above) refuses to introduce — a restatement
 * that can drift from the parser it claims to describe.
 */
const SECTION_HEADING = /^##\s+(.+?)\s*$/;

/**
 * Every `## Section` name appearing more than once in `body`.
 *
 * `splitSections` keeps the LAST block under a repeated heading, and that is
 * deliberately unchanged: a file with two `## Observations` sections has
 * always parsed to the second one's observations and must keep doing so.
 * `parseItem` acts on this for `## Steps` alone, where dropping the earlier
 * block would be a NEW silent loss rather than an existing one.
 */
function repeatedSections(body: string): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const line of body.split('\n')) {
    const m = SECTION_HEADING.exec(line);
    if (m === null) continue;
    // Lower-cased exactly as `splitSections` lower-cases it, so the two agree
    // about what "the same heading twice" means.
    const name = m[1].toLowerCase();
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  }
  return repeated;
}

/** Split the body into its leading prose and its `## Section` blocks. */
function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {
  const lines = body.split('\n');
  const sections = new Map<string, string[]>();
  const prose: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    const heading = SECTION_HEADING.exec(line);
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

function renderStep(s: Step): string {
  return `- [${s.checked ? 'x' : ' '}] ${s.text}`;
}

/**
 * The `## Steps` section, parsed the way `## Observations` already is — with
 * two deliberate departures, both forced by
 * `INV-markdown-is-the-source-of-truth`.
 *
 * **1. A line that is not a step is REFUSED, not skipped.**
 * `parseObservations` drops a line it cannot match, which is survivable there
 * only because it predates the invariant; here it would delete the line the
 * next time `persist()` re-rendered the item, having reported success. The
 * throw is caught per file by `loadLayer` (rebuild.ts), which records a
 * `LoadError` — so the item is reported, not silently emptied, which is the
 * treatment every other unparseable item file already gets.
 *
 * **2. The line is matched RAW, and what parsed must re-render to exactly
 * what was read.** `parseObservations` matches `line.trim()`, so an indented
 * or oddly-spaced observation is accepted and then re-rendered flush left —
 * the file is rewritten with nobody told. The `renderStep` comparison below
 * is the invariant itself rather than a restatement of it: it cannot drift
 * from the renderer, because it IS the renderer, so every step that parses
 * is one that writes back byte-identically, and every other spelling
 * (`-  [ ] x`, a tab after the `]`, a trailing space, a nested `  - [ ] x`)
 * is reported with the line in the message instead of being normalised.
 *
 * Blank lines: `renderItem` writes exactly one after the last step, as the
 * separator before the next section, and `splitSections` hands it back at the
 * end of this array. That one is dropped. Any OTHER blank line here is
 * refused, because `renderItem` has no way to write it back — a blank line
 * between two steps is deleted on the next persist exactly as a skipped line
 * would be.
 */
function parseSteps(lines: string[]): Step[] {
  const content = lines.length > 0 && lines[lines.length - 1] === ''
    ? lines.slice(0, -1)
    : lines;

  const out: Step[] = [];
  for (const line of content) {
    if (line.trim() === '') {
      throw new Error(
        `my_context: a blank line inside a "## Steps" section is not a step, and it cannot be ` +
        `written back: the steps are re-rendered as one unbroken list, so this line would be ` +
        `deleted the next time this item is written. Remove it, or move the steps it separates ` +
        `into two items.`,
      );
    }
    const m = STEP.exec(line);
    if (m === null) {
      throw new Error(
        `my_context: the line ${JSON.stringify(line)} is inside a "## Steps" section but is ` +
        `not a step. A step is written "- [ ] text" (or "- [x] text" once done), with a ` +
        `lower-case x. This line is refused rather than skipped, because a skipped line is ` +
        `deleted the next time this item is written back. Fix the line, or move it into the ` +
        `body above the first "## " section.`,
      );
    }
    const step: Step = { text: m[2]!, checked: m[1] === 'x' };
    const rendered = renderStep(step);
    if (rendered !== line) {
      throw new Error(
        `my_context: the step ${JSON.stringify(line)} would be re-rendered as ` +
        `${JSON.stringify(rendered)} the next time this item is written, so the file and the ` +
        `item would stop agreeing about what it says. Write it as exactly "- [ ] text" or ` +
        `"- [x] text" — one space after the "-", one after the "]", nothing after the text.`,
      );
    }
    out.push(step);
  }
  return out;
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
    throw new Error('no --- frontmatter block found.');
  }

  const rawBlock = match[1];
  const fm = parseFrontmatter(rawBlock);
  const body = normalized.slice(match[0].length);
  const { prose, sections } = splitSections(body);

  // A second `## Steps` section cannot be represented: `splitSections` keeps
  // the last block and `renderItem` writes exactly one, so the first block's
  // steps would be destroyed on the next persist with nothing reported. That
  // is `INV-nothing-is-dropped-silently`, so it is refused here. A repeated
  // `## Observations` or `## Relations` is NOT refused: it already behaves
  // this way, and changing how an item that exists today parses is a
  // different decision from choosing how a new section parses.
  // Guarded by `sections.has('steps')` so the extra scan is paid only by an
  // item that HAS steps — which is no item in any corpus that exists today.
  // An item with no `## Steps` section cannot have two of them.
  if (sections.has('steps') && repeatedSections(body).has('steps')) {
    throw new Error(
      'my_context: this item has more than one "## Steps" section. Only one can be written ' +
      'back — the last — so the steps in the earlier section would be deleted the next time ' +
      'this item is written. Merge them into a single "## Steps" section.',
    );
  }

  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (COMMON_KEYS.has(key)) continue;
    if (Array.isArray(value)) { extra[key] = value.join(', '); continue; }
    if (value === null) continue;
    const s = asString(value, rawBlock, key);
    if (s !== null) extra[key] = s;
  }

  // The read boundary. `validateExplicitId` guards the mint path; nothing
  // guarded this one, so an id arriving from disk reached ~15 sites that
  // interpolate it into a command a human is invited to paste. See
  // `validateLoadedId`.
  const id = requireString(fm, rawBlock, 'id');
  validateLoadedId(id, filePath);

  return {
    id,
    type: requireString(fm, rawBlock, 'type'),
    title: requireString(fm, rawBlock, 'title'),
    status: (optString(fm, rawBlock, 'status') ?? 'active') as Status,
    severity: (optString(fm, rawBlock, 'severity') ?? 'soft') as Severity,
    always: fm.always === true,
    // `=== true` and never a truthiness test, exactly as `always` above: an
    // item that predates this field carries no key at all and must read false.
    continuity: fm.continuity === true,
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
    steps: parseSteps(sections.get('steps') ?? []),
    observations: parseObservations(sections.get('observations') ?? []),
    relations: parseRelations(sections.get('relations') ?? []),
    layer,
    filePath,
  };
}

/**
 * Checksum over the semantic content only — never over the checksum field
 * itself.
 *
 * Built as an object rather than written as a literal for one reason: `steps`
 * has to be conditional. The hash is over `JSON.stringify`, so **key order is
 * identity** — every existing key keeps its existing position.
 */
export function computeItemChecksum(item: Item): string {
  const shape: Record<string, unknown> = {
    id: item.id, type: item.type, title: item.title, status: item.status,
    severity: item.severity, always: item.always, scope: item.scope, tags: item.tags,
    origin: item.origin, extra: item.extra, body: item.body,
  };
  // Added ONLY when true, for the reason `steps` below is conditional and
  // stated again because the two conditions are load-bearing in the same way:
  // this hash is RECORDED in every item's frontmatter, so an unconditional key
  // would change it for every item in every corpus at once — reddening
  // `doctor` everywhere and destroying the stale-checksum signal that is the
  // only evidence a file was altered outside my_context. An item without
  // `continuity: true` therefore hashes byte-identically to how it hashed
  // before this field existed, by construction. Pinned by
  // test/core/corpus-checksums.test.ts, which hashes this repository's own
  // committed corpus.
  if (item.continuity) shape.continuity = true;
  // Added ONLY when there are steps, and the reason is compatibility rather
  // than tidiness: this hash is RECORDED in every item's frontmatter, and an
  // unconditional key would change it for every item in every corpus at once
  // — reddening `doctor` everywhere and destroying the stale-checksum signal
  // that is the only evidence a file was ever altered outside my_context
  // (`cli/commands/repair.ts`). A stepless item therefore hashes
  // byte-identically to how it hashed before this field existed, by
  // construction. **The condition is load-bearing**: making the key
  // unconditional is a one-character change that silently invalidates the
  // recorded checksum of every item in existence (spec §6n.4). Pinned by
  // test/core/steps.test.ts and by test/core/corpus-checksums.test.ts, which
  // hashes this repository's own committed corpus.
  if (item.steps.length > 0) shape.steps = item.steps;
  shape.observations = item.observations;
  shape.relations = item.relations;
  return checksum(JSON.stringify(shape));
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
    // Emitted ONLY when true, so an item that predates the field round-trips
    // byte-identically — `INV-markdown-is-the-source-of-truth`, whose whole
    // promise is that `files → DB → files` is byte-identical. An
    // unconditional `continuity: false` line would add a line to every item
    // on the next write.
    ...(item.continuity ? { continuity: true } : {}),
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
  // Before `## Observations`, always: steps are what a procedure IS, and
  // observations are commentary on it. The order is fixed rather than
  // incidental — a floating order breaks byte-identity the first time an
  // item carries both.
  if (item.steps.length) {
    parts.push('## Steps', ...item.steps.map(renderStep), '');
  }
  if (item.observations.length) {
    parts.push('## Observations', ...item.observations.map(renderObservation), '');
  }
  if (item.relations.length) {
    parts.push('## Relations', ...item.relations.map((r) => `- ${r.type} [[${r.target}]]`), '');
  }
  return parts.join('\n');
}
