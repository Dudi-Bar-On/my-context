import { parseAcknowledged, renderAcknowledged } from './acknowledge.ts';
import { parseSummaryWas, renderSummaryWas } from './summary-history.ts';
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
  'id', 'type', 'title', 'status', 'severity', 'always', 'continuity', 'summary', 'summary_of',
  'summary_was', 'acknowledged', 'scope', 'tags', 'origin',
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

/**
 * The `## Section` names `renderItem` (below) knows how to write back. A
 * section under any other name is not a field of an item at all: `parseItem`
 * puts its lines in `sections`, nothing reads them, and the next `renderItem`
 * writes the item back WITHOUT them.
 */
const WRITABLE_SECTIONS = new Set(['steps', 'observations', 'relations']);

/** What a canonical rewrite of an item file would not write back — see `droppedBodyText`. */
export interface BodyLoss {
  /** The first line that would be dropped, for a message that names it. */
  line: string;
  /** How many lines would be dropped, blank ones inside a dropped section included. */
  lines: number;
  /** How many UTF-8 bytes those lines are. */
  bytes: number;
}

/** A section's own trailing separator blank line is not content. */
function withoutTrailingBlanks(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(0, end);
}

/**
 * **The text `renderItem(parseItem(fileText))` would silently delete.**
 *
 * `validateBody` (validate.ts) is the same rule at the WRITE boundary: it
 * refuses a body a caller hands in that this format cannot hold. This is the
 * rule at the READ boundary, for text that is already on disk — a file a human
 * edited by hand, which no validator ever saw. The two must agree, and they do
 * because neither restates the parser: `validateBody` refuses the shape
 * `splitSections` eats, and this function IS `splitSections`' partition, read
 * for what falls out of it.
 *
 * It exists because every write path re-renders the whole item, so any command
 * that touches a hand-edited item performs the deletion and reports success —
 * `mycontext repair` most of all, whose entire job is to write items back.
 * Returns `null` when the rewrite is lossless, which is every item this tool
 * itself wrote.
 *
 * What counts as dropped, and why each one:
 *
 *  - **a `## ` section that is not one of `WRITABLE_SECTIONS`** — heading and
 *    body both. This is the case that cost this corpus two task bodies.
 *  - **the EARLIER of two sections with the same name.** `splitSections` keeps
 *    the last block under a repeated heading and `renderItem` writes one, so
 *    the first block is deleted. (`## Steps` is refused outright by
 *    `parseItem`; the other two are not, and this is where they show up.)
 *  - **a second `# ` line in the prose.** `splitSections` drops every one of
 *    them and `renderItem` re-emits exactly one, from `title:` — so the first
 *    is not a loss and any further one is.
 *  - **a line inside `## Observations`/`## Relations` that the section's own
 *    grammar does not match.** `parseObservations`/`parseRelations` skip it,
 *    which is the same deletion one line lower down.
 *
 * NOT counted: whitespace. `parseItem` trims the prose and `renderItem` writes
 * one separator blank line per section, so blank lines at either edge move
 * around on every canonical write and always have. A report that called that
 * "text lost" would cry wolf on every item in every corpus.
 */
export function droppedBodyText(fileText: string): BodyLoss | null {
  const normalized = fileText.replace(/\r\n?/g, '\n');
  const match = DELIM.exec(normalized);
  // Not an item file at all. `parseItem` refuses it with its own message; this
  // function's answer is "no PARSED text is lost", which is true of a file that
  // never parses.
  if (match === null) return null;

  const blocks: { name: string | null; heading: string; lines: string[] }[] =
    [{ name: null, heading: '', lines: [] }];
  for (const line of normalized.slice(match[0].length).split('\n')) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      blocks.push({ name: heading[1].toLowerCase(), heading: line, lines: [] });
      continue;
    }
    blocks[blocks.length - 1].lines.push(line);
  }

  // Which block wins for each name — `splitSections` keeps the LAST.
  const kept = new Map<string, number>();
  blocks.forEach((block, i) => { if (block.name !== null) kept.set(block.name, i); });

  const dropped: string[] = [];
  blocks.forEach((block, i) => {
    if (block.name === null) {
      let titleSeen = false;
      for (const line of block.lines) {
        if (!/^#\s+/.test(line)) continue;
        if (!titleSeen) { titleSeen = true; continue; }
        dropped.push(line);
      }
      return;
    }
    if (!WRITABLE_SECTIONS.has(block.name) || kept.get(block.name) !== i) {
      dropped.push(block.heading, ...withoutTrailingBlanks(block.lines));
      return;
    }
    if (block.name === 'steps') return;
    const grammar = block.name === 'observations' ? OBSERVATION : RELATION;
    for (const line of block.lines) {
      if (line.trim() === '' || grammar.test(line.trim())) continue;
      dropped.push(line);
    }
  });

  if (dropped.length === 0) return null;
  return {
    line: dropped.find((l) => l.trim() !== '') ?? dropped[0],
    lines: dropped.length,
    bytes: Buffer.byteLength(dropped.join('\n'), 'utf8'),
  };
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
    // `optString`, so an item that predates the field — every item in every
    // corpus — reads `null`, which is `summaryState`'s `absent`. Nothing here
    // validates the LENGTH: `SUMMARY_MAX_CHARS` is a write-boundary rule
    // (validate.ts), and refusing to LOAD a file over the bound would make an
    // item that is merely too wordy invisible, which is a heavier punishment
    // than the defect. `doctor` reports an over-long summary on disk instead.
    summary: optString(fm, rawBlock, 'summary'),
    // Read even when `summary` is null, and never defaulted to anything: a
    // basis with no summary is inert, and a summary with no basis must read as
    // `unanchored` rather than as a summary written against nothing in
    // particular. Both cases are `summaryState`'s to name, not this parser's.
    summaryOf: optString(fm, rawBlock, 'summary_of'),
    // `[]` for every item that predates the field, which is every item in every
    // corpus — and `[]` is "nothing has been replaced yet", which is the honest
    // state rather than a missing one. Nothing is backfilled from anywhere:
    // there is nowhere to backfill FROM (the audit log records that `summary`
    // moved, never what it said), and inventing one would be recording a
    // sentence nobody wrote.
    //
    // `parseSummaryWas` KEEPS an entry it cannot date rather than dropping it,
    // which is the opposite of `parseAcknowledged` two lines down; its docblock
    // argues why keeping is the safe direction for authored text and dropping
    // is the safe direction for a hash.
    summaryWas: parseSummaryWas(stringList(fm, 'summary_was')),
    // `{}` for every item that predates the field, which is every item in every
    // corpus — and `{}` is `acknowledgementState`'s `none`, so an item nobody
    // has ruled on reads exactly as it did before this field existed.
    // `parseAcknowledged` drops an entry it cannot read rather than storing a
    // broken one; its docblock argues why dropping is the SAFE direction here
    // and nowhere else in this parser.
    acknowledged: parseAcknowledged(stringList(fm, 'acknowledged')),
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
 * **The checksum BASIS version this build computes against.** The one
 * declaration `CHECKSUM_BASIS_VERSION` promises to be — every producer
 * (`computeItemChecksum` below) and every consumer that has to tell "the
 * recorded formula changed" apart from "the content changed" (`loadLayer` in
 * rebuild.ts, `checksumMigrationFindings` in doctor/checks.ts) reads this
 * constant rather than carrying its own copy of the number.
 *
 * **Why `1`.** Counted as the basis stands today: `computeItemChecksum`'s
 * shape has grown fields over time (`continuity`, `summary`/`summary_of`,
 * `summary_was`, `acknowledged`), but every one of them was added
 * CONDITIONALLY, specifically so an item that predates the field hashes
 * byte-identically to how it hashed before — see this function's own
 * comments on each conditional key. No change to this formula has ever
 * invalidated a recorded checksum, so there has only ever been ONE basis in
 * this corpus's history, and every item in it is on that basis. `1` is
 * therefore both "the current formula" and "what every existing item
 * already is", which is exactly what `formatChecksum` below encodes: version
 * 1 carries no visible tag at all.
 *
 * **What changes this number.** Only an edit to `computeItemChecksum` that
 * is NOT of the conditional-key shape above — e.g. changing what an existing
 * key hashes, reordering keys, or making a previously-conditional key
 * unconditional. Bump it, update the golden value pinned by
 * `test/core/checksum-basis.test.ts`, and run `mycontext repair` to migrate
 * a real corpus. Skipping that migration does not corrupt anything by
 * itself — every already-correct item still round-trips — but it leaves the
 * whole corpus reporting a version mismatch that `repair` alone clears.
 */
export const CHECKSUM_BASIS_VERSION = 1;

/**
 * Renders `hash` tagged with the basis version it was computed under.
 *
 * Version 1 is untagged — `hash` alone — so every checksum this product has
 * ever recorded parses as version 1 without a migration and without a new
 * frontmatter field (a new field would itself move `computeItemChecksum`'s
 * basis, needing its own migration — the thing this scheme exists to avoid
 * doing again). Version 2 and above are prefixed `"<version>:<hash>"`. The
 * colon makes the frontmatter value need quoting (`NEEDS_QUOTES` in
 * frontmatter.ts matches `:`), which `emitScalar`/`unquote` already round-trip
 * losslessly — proven raw-fixture-and-byte-identical by
 * `test/core/item.test.ts`, not merely by canonicalized re-parsing.
 */
export function formatChecksum(version: number, hash: string): string {
  return version === 1 ? hash : `${version}:${hash}`;
}

/**
 * The inverse of `formatChecksum`: recovers the basis version a RECORDED
 * checksum was computed under, and the hash itself. A value with no
 * `"<version>:"` prefix is version 1 by definition — every item captured
 * before this scheme existed, and every item this product has ever written,
 * parses this way with no migration needed.
 *
 * The pattern requires at least one digit before the colon and at least one
 * character after it, so a checksum that merely happens to look unusual is
 * never misread as carrying a version tag it does not have — a 16-character
 * lowercase-hex sha256 slice (`checksum` in slug.ts) can never itself match
 * `^\d+:`, since hex digits never include `:`.
 */
export function parseChecksumVersion(recorded: string): { version: number; hash: string } {
  const m = /^(\d+):(.+)$/.exec(recorded);
  if (!m) return { version: 1, hash: recorded };
  return { version: Number(m[1]), hash: m[2] };
}

/**
 * Whether a RECORDED checksum disagreeing with a fresh hash of an item's
 * content is a benign basis migration or the real alarm.
 *
 * - `'migration'` — the recorded value's own basis version differs from
 *   `CHECKSUM_BASIS_VERSION`. The formula that produced it is not the one
 *   running now, so a disagreement is EXPECTED and says nothing about
 *   whether the content moved; `mycontext repair` re-stamps it in the
 *   current format and that is the whole fix.
 * - `'alteration'` — the recorded value's basis version matches, so the
 *   same formula was used on both sides and still disagrees. That can only
 *   mean the content itself changed (or was mangled) since the checksum was
 *   recorded — the real, and only, case where data loss is a live
 *   possibility.
 *
 * Callers that already know the two values disagree (`loadLayer` in
 * rebuild.ts, `needsRestamp` in repair.ts) call this to choose which of the
 * two messages to show; it does not itself check for disagreement.
 */
export function classifyChecksumMismatch(recorded: string): 'migration' | 'alteration' {
  return parseChecksumVersion(recorded).version !== CHECKSUM_BASIS_VERSION ? 'migration' : 'alteration';
}

/**
 * Checksum over the semantic content only — never over the checksum field
 * itself.
 *
 * Built as an object rather than written as a literal for one reason: `steps`
 * has to be conditional. The hash is over `JSON.stringify`, so **key order is
 * identity** — every existing key keeps its existing position.
 *
 * The returned string is always tagged with `CHECKSUM_BASIS_VERSION` via
 * `formatChecksum` — see that function and `CHECKSUM_BASIS_VERSION` itself
 * for why version 1 renders with no visible tag at all.
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
  // Added ONLY when the item HAS a summary, for the reason `continuity` above
  // and `steps` below are conditional, and the reason is the same one a third
  // time because it is the only reason that matters: this hash is RECORDED in
  // every item's frontmatter, and an unconditional pair of keys would move the
  // checksum of all 730 items in this corpus in one act — reddening `doctor`
  // everywhere, destroying the stale-checksum signal that is the only evidence
  // a file was altered outside my_context, and making `repair` the only way
  // back. An item with no summary therefore hashes byte-identically to how it
  // hashed before this field existed, by construction.
  //
  // **`summary_of` is hashed too, and not only `summary`.** The basis is what
  // makes staleness a measurement; a basis excluded from the checksum is one a
  // hand edit can rewrite to match, turning a stale summary into a "current"
  // one with nothing reporting it. The two are written together
  // (`stampSummary`, content-hash.ts) and are covered together.
  //
  // The key is `summary_of` and not `summaryOf` because every other key in
  // this shape is the frontmatter spelling of its field.
  if (item.summary !== null) {
    shape.summary = item.summary;
    shape.summary_of = item.summaryOf;
  }
  // Added ONLY when the item has actually replaced a summary, for the reason
  // `summary` directly above is conditional and stated once more because it is
  // the only reason that matters: an unconditional key would move every
  // recorded checksum in every corpus at once. No item in any corpus carries a
  // history today, so every one of them hashes exactly as it did before this
  // field existed, by construction.
  //
  // **It is covered rather than excluded**, on `acknowledged`'s argument
  // directly below: the history is authored text stored in a file a person can
  // edit, and a previous summary quietly rewritten — or deleted — is a claim
  // about what this item used to say that nobody made. Covering it means such
  // an edit leaves a stale checksum behind, which is what `doctor` and `repair`
  // exist to notice.
  //
  // `renderSummaryWas` and not the array itself, because the stored shape is
  // `{ at, text }` and the file's shape is one string per entry: hashing the
  // objects would make the checksum depend on a key order no reader of the file
  // can see.
  if (item.summaryWas.length > 0) shape.summary_was = renderSummaryWas(item.summaryWas);
  // Added ONLY when a person has ruled on something, for the reason `summary`
  // directly above is conditional: an unconditional key would move every
  // recorded checksum in every corpus at once.
  //
  // **It is covered rather than excluded, and the anchor is the reason.** An
  // acknowledgement says a person read this content and settled the finding
  // over it; that claim is exactly as forgeable by a hand edit as `summary_of`
  // is, and for the same payoff — a `lapsed` acknowledgement typed back to the
  // current hash reads as `current`, and a finding a person never saw reports
  // as one they ruled on. Covering it means the forgery leaves a stale checksum
  // behind, which is what `doctor` and `repair` exist to notice.
  //
  // `renderAcknowledged` and not the record itself, because the record's key
  // order is insertion order — two items with the same two acknowledgements
  // added in different orders must hash the same.
  if (Object.keys(item.acknowledged).length > 0) {
    shape.acknowledged = renderAcknowledged(item.acknowledged);
  }
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
  return formatChecksum(CHECKSUM_BASIS_VERSION, checksum(JSON.stringify(shape)));
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
    // Emitted ONLY when there is a summary, for `continuity`'s reason directly
    // above: an unconditional `summary: null` / `summary_of: null` pair would
    // add two lines to all 730 items on the next write, which is the
    // byte-identical round trip (`INV-markdown-is-the-source-of-truth`) broken
    // for every item at once.
    //
    // Both keys move together, so a file never carries one without the other
    // — `summaryState` reads that pair, and half of it is `unanchored`.
    ...(item.summary === null ? {} : { summary: item.summary, summary_of: item.summaryOf }),
    // Immediately after the summary it is the history OF, and emitted ONLY when
    // the item has replaced one — `continuity`'s and `summary`'s reason again:
    // an unconditional `summary_was: []` line would be added to every item in
    // every corpus on the next write, which is
    // `INV-markdown-is-the-source-of-truth`'s byte-identical round trip broken
    // for all of them at once.
    //
    // NOT inside the `summary === null` guard above, unlike `summary_of`: a
    // CLEARED summary is a replacement like any other, and an item whose
    // summary was removed is precisely the one where a reader most needs to see
    // what it used to say. The two keys above move as a pair because half of
    // that pair is `unanchored`; this one is independent of both.
    ...(item.summaryWas.length === 0
      ? {}
      : { summary_was: renderSummaryWas(item.summaryWas) }),
    // Emitted ONLY when a person has actually ruled on something, for
    // `continuity`'s and `summary`'s reason above: an unconditional
    // `acknowledged: []` line would add a line to every item in every corpus on
    // the next write, which is `INV-markdown-is-the-source-of-truth`'s
    // byte-identical round trip broken for all of them at once.
    ...(Object.keys(item.acknowledged).length === 0
      ? {}
      : { acknowledged: renderAcknowledged(item.acknowledged) }),
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
