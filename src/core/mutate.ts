import type { Config, ResolvedCategory } from './config.ts';
import { computeItemChecksum, isValidObservationCategory } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem } from './rebuild.ts';
import { sleepMs } from './sleep.ts';
import { checksum, makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError, unknownIdError } from './teach.ts';
import { normalizeEol } from './text.ts';
import type { Item, Observation, Origin, Relation, Severity, Status, Tier } from './types.ts';

export interface MutationContext {
  /** Absolute path to the project layer root, i.e. `<repo>/.my_context`. */
  root: string;
  store: Store;
  config: Config;
}

export interface CreateInput {
  type: string;
  title: string;
  body?: string;
  /**
   * Explicit id. Defaults to an auto-allocated id derived from `title`.
   * Plan 4 requires this: a superseded item and its replacement share a title,
   * so the replacement needs an explicit revision id (`-r2`) to avoid colliding
   * with the item it replaces. `createItem` never overwrites an existing item
   * at this id — see the explicit-id handling below.
   */
  id?: string;
  /**
   * Checksum of the source passage at capture time. Plan 4's `doctor` compares
   * it against the live source to detect drift; hardcoding null here would make
   * drift undetectable for every ingested item.
   */
  sourceChecksum?: string | null;
  status?: Status;
  severity?: Severity;
  always?: boolean;
  scope?: string[];
  tags?: string[];
  origin?: Origin;
  sourceFile?: string | null;
  sourceAnchor?: string | null;
  observations?: Observation[];
  relations?: Relation[];
  extra?: Record<string, string>;
}

export interface MutationResult {
  id: string;
  /** False when the call was a no-op: a duplicate, or an already-present link. */
  created: boolean;
  status: Status;
  filePath: string;
  message: string;
}

interface ContentShape {
  type: string;
  title: string;
  body: string;
  severity: Severity;
  always: boolean;
  scope: string[];
  tags: string[];
  observations: Observation[];
  relations: Relation[];
  extra: Record<string, string>;
}

/** Fixed key order so a freshly-authored observation and one recovered by
 * `parseItem` (whose keys come out in `parseItem`'s own order) hash the same. */
function canonicalObservation(o: Observation): Observation {
  return { category: o.category, text: o.text, tags: o.tags, context: o.context };
}

function canonicalRelation(r: Relation): Relation {
  return { type: r.type, target: r.target };
}

function canonicalExtra(extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(extra).sort()) out[key] = extra[key];
  return out;
}

/**
 * Identity of an item's *content*. `ContentShape` is the whole of it, so the
 * eleven `Item` fields absent from that interface are all excluded: `id`,
 * `status`, `origin`, provenance (`sourceFile`/`sourceAnchor`/
 * `sourceChecksum`), lifecycle dates (`validFrom`/`validUntil`), the
 * `checksum` itself, and the storage location (`layer`/`filePath`). None of
 * them change what the item *asserts*. `severity` and
 * `always` ARE included: they are normative content, not bookkeeping —
 * `computeItemChecksum` (item.ts) agrees, it hashes both too — so
 * re-capturing the same title as `severity: 'hard'` after `'soft'` must
 * not be silently swallowed as an unchanged duplicate.
 *
 * `scope` and `tags` are unordered sets, so they are sorted before hashing.
 * `observations` and `relations` are ORDERED — they render to Markdown in
 * the sequence given (see `renderItem` in item.ts) — so their order is
 * preserved as given, but each entry is rebuilt with a fixed key order
 * (`canonicalObservation`/`canonicalRelation`) so that JSON.stringify does
 * not make key order part of identity: a payload the model just sent and
 * the same content recovered by `parseItem` must hash identically even
 * though the two objects were built with their keys in different orders.
 * `extra`'s keys are sorted for the same reason.
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify({
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    severity: v.severity,
    always: v.always,
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations.map(canonicalObservation),
    relations: v.relations.map(canonicalRelation),
    extra: canonicalExtra(v.extra),
  }));
}

export function contentHash(input: CreateInput): string {
  return hashContent({
    type: input.type,
    title: input.title,
    // Normalized here, not just at storage time (and not only by the one
    // caller that remembers to pre-normalize): the hash and the stored
    // item must see the same value, or a body containing a lone `\r`
    // (CRLF, or a bare old-Mac line ending) would hash differently from
    // the LF-normalized text `parseItem` reads back, and `createItem`
    // could dedupe or fail to dedupe inconsistently with what disk holds.
    body: normalizeEol(input.body ?? ''),
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    // Normalized here, not just at storage time: the hash and the stored
    // item must see the same value, or the same call made twice with
    // `scope: ['src\\db\\**']` on Windows would hash differently from what
    // ends up on disk and create a spurious second item.
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    extra: input.extra ?? {},
  });
}

export function itemContentHash(item: Item): string {
  return hashContent(item);
}

/**
 * Retry a write that lost a race for the SQLite write lock. `busy_timeout` (set
 * in Store.open) covers most contention; this covers the rest. Anything that is
 * not a lock error rethrows immediately — retrying a schema error just makes the
 * failure slower. Exhaustion is rethrown as a teaching message: every error this
 * module throws is prefixed `my_context:`, and a raw `SQLITE_BUSY` string is not.
 */
export function withRetry<T>(fn: () => T, attempts = 8): T {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/busy|locked/i.test(message)) throw err;
      if (attempt < attempts - 1) sleepMs(20 * (attempt + 1));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `my_context: the index database is still locked after ${attempts} attempts (${message}). ` +
    `Another process may be using it — try again in a moment.`,
  );
}

/**
 * `ctx.config.categories[type]` would be a prototype-unsafe lookup — a type
 * of `"constructor"` resolves to `Object.prototype.constructor` and reports
 * a nonsensical "is disabled" instead of "unknown". `Object.hasOwn` guards it.
 */
function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {
  if (!Object.hasOwn(ctx.config.categories, type)) {
    // Only enabled categories are offered: naming a disabled one as the
    // "closest match" would invite a retry that create_item refuses too.
    const enabledNames = Object.values(ctx.config.categories)
      .filter((c) => c.enabled)
      .map((c) => c.name);
    throw new Error(enumError('type', type, enabledNames, 'categories'));
  }
  const category = ctx.config.categories[type];
  if (!category.enabled) {
    throw new Error(
      `my_context: category "${type}" is disabled in this project, so no new ` +
      `${type} items are accepted. Enable it in .my_context/config.json under ` +
      `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`,
    );
  }
  return category;
}

/**
 * Spec §7.1: trust is per-tier, not per-caller. Nothing that isn't
 * human-authored governs future work until a human promotes it — this
 * covers `'agent'` and `'ingest'` alike (see the `Origin` union in
 * types.ts), and any future non-human origin, by construction: the check is
 * `!== 'human'`, not an enumeration of the callers we happened to think of.
 * `'ingest'` matters concretely: batch ingestion (spec §7.2) lands items via
 * this same path, and an ingested constraint must not reach `active` and
 * start governing before a human has looked at it, any more than an
 * agent-authored one does.
 *
 * The tier argument must come from the *resolved* config so per-project
 * tier overrides and custom categories are covered — reading the built-in
 * category table here would quietly exempt every project override. This is
 * a hard override, not a default: a non-human caller that explicitly passes
 * `status: 'active'` for a normative item is still forced to `draft`, or one
 * argument would defeat the whole boundary.
 */
export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {
  if (origin !== 'human' && tier === 'normative') return 'draft';
  return requested;
}

const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const SEVERITIES: Severity[] = ['hard', 'soft'];
const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

/**
 * Without this, `status: 'activ'` (or any other typo) persists happily —
 * the item is then never actually `'active'`, so it is never selected or
 * injected, while `createItem`'s own return message still reports success.
 *
 * Shape is a narrowed structural subset — not `CreateInput` — so
 * `updateItem`'s `UpdateInput` (which has no required `type`/`title`) can
 * route through the same three checks `createItem` uses instead of a second,
 * divergent copy of them.
 */
function validateEnums(input: { status?: Status; severity?: Severity; origin?: Origin }): void {
  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    throw new Error(enumError('status', input.status, STATUSES, 'capture'));
  }
  if (input.severity !== undefined && !SEVERITIES.includes(input.severity)) {
    throw new Error(enumError('severity', input.severity, SEVERITIES, 'capture'));
  }
  if (input.origin !== undefined && !ORIGINS.includes(input.origin)) {
    throw new Error(enumError('origin', input.origin, ORIGINS, 'capture'));
  }
}

/** The frontmatter keys `renderItem` (item.ts) already writes for every item —
 * an `extra` field of the same name would silently overwrite it on disk. */
const RESERVED_FRONTMATTER_KEYS = new Set([
  'id', 'type', 'title', 'status', 'severity', 'always', 'scope', 'tags', 'origin',
  'source_file', 'source_anchor', 'source_checksum', 'valid_from', 'valid_until', 'checksum',
]);

/** What `frontmatter.ts`'s `KEY_LINE` grammar accepts as a frontmatter key. */
const EXTRA_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Guards two ways `extra` can silently destroy data if written through
 * unvalidated: (a) a key the frontmatter grammar cannot reparse (e.g.
 * `valid-until`, with a hyphen) makes the item unreadable — and therefore
 * invisible — on the very next rebuild, even though create_item reported
 * success; (b) a key that collides with a reserved name (e.g. `id`)
 * overwrites that field in the rendered file, so disk and index disagree
 * about identity.
 */
/**
 * U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR) are as fatal as
 * `\r`/`\n` for anything stored as a single frontmatter scalar/list line or
 * a single Markdown line: frontmatter's `KEY_LINE` grammar is anchored with
 * `.`/`$`, neither of which spans a line terminator in a JS `RegExp`, so a
 * value containing one writes a file `parseFrontmatter` cannot read back —
 * "unsupported frontmatter syntax" — even though it contains no literal
 * `\r` or `\n`. Shared by every guard below that stores a value as one
 * frontmatter line or one Markdown list line.
 */
const LINE_BREAK = /[\r\n\u2028\u2029]/;

export function validateExtra(extra: Record<string, string>): void {
  for (const [key, value] of Object.entries(extra)) {
    if (!EXTRA_KEY_RE.test(key)) {
      throw new Error(
        `my_context: extra field "${key}" is not a valid key — frontmatter keys must match ` +
        `letters, digits and underscore, and not start with a digit, or the item cannot be ` +
        `read back after the next rebuild. See mycontext_help("capture").`,
      );
    }
    if (RESERVED_FRONTMATTER_KEYS.has(key)) {
      throw new Error(
        `my_context: extra field "${key}" collides with a reserved frontmatter field of the ` +
        `same name and would silently overwrite it on disk. Choose a different key. ` +
        `See mycontext_help("capture").`,
      );
    }
    // Both new: `''` is indistinguishable from an absent field once written
    // and read back (item.ts's `asString` maps an empty scalar back to
    // `null`, and the extra-field loader then skips a `null` entry
    // entirely) — the key silently vanishes on the very next read. A line
    // break corrupts frontmatter's one-value-per-line format outright.
    // Both are the same silent-loss/silent-corruption failure class this
    // whole function exists to refuse, just on the VALUE instead of the key.
    if (value === '') {
      throw new Error(
        `my_context: extra.${key} is an empty string, which is indistinguishable from an absent ` +
        `field once written and read back — frontmatter parses an empty scalar as absent. ` +
        `Omit the key instead. See mycontext_help("capture").`,
      );
    }
    if (LINE_BREAK.test(value)) {
      throw new Error(
        `my_context: extra.${key} contains a line break (${JSON.stringify(value)}). Frontmatter ` +
        `stores one value per line, so this would corrupt the file — making it unreadable — the ` +
        `next time it is written to disk. Remove it, or move this into "body" instead. ` +
        `See mycontext_help("capture").`,
      );
    }
  }
}

/**
 * `title` is written both as a frontmatter scalar AND as the file's
 * Markdown `# ` heading (`renderItem`, item.ts) — a line break in either
 * position corrupts the file the next time it is written to disk.
 */
export function validateTitle(title: string): void {
  if (!LINE_BREAK.test(title)) return;
  throw new Error(
    `my_context: "title" contains a line break. It is written both as frontmatter and as a ` +
    `Markdown heading, so this would corrupt the file the next time it is written to disk. ` +
    `Keep the title on one line; put the rest in "body". See mycontext_help("capture").`,
  );
}

/**
 * Each `scope` glob is written as one frontmatter list line
 * (`serializeFrontmatter`, frontmatter.ts). A line break inside one is the
 * same single-line-format corruption `validateTitle`/`validateExtra` guard.
 */
export function validateScope(scope: string[]): void {
  scope.forEach((glob, i) => {
    if (!LINE_BREAK.test(glob)) return;
    throw new Error(
      `my_context: scope[${i}] contains a line break, which would corrupt the file's frontmatter ` +
      `the next time it is written to disk. Remove it. See mycontext_help("capture").`,
    );
  });
}

/** The sibling of `validateScope`, guarding top-level `tags` (a frontmatter
 * list, unlike an observation's inline `#tag` — see `validateObservationTags`
 * for that separate, more restrictive grammar). */
export function validateTags(tags: string[]): void {
  tags.forEach((tag, i) => {
    if (!LINE_BREAK.test(tag)) return;
    throw new Error(
      `my_context: tags[${i}] contains a line break, which would corrupt the file's frontmatter ` +
      `the next time it is written to disk. Remove it. See mycontext_help("capture").`,
    );
  });
}

/**
 * Spec §10 requires `rebuild` to be lossless: files → DB → files is
 * byte-identical. Two shapes of authored text break that, and both destroy
 * content permanently and silently:
 *
 *  (a) a body line starting with `#`…`######`. `splitSections` (item.ts)
 *      treats `## X` as a SECTION heading, so everything from that line on
 *      leaves `body` — and a leading `# ` line is dropped outright. The
 *      write succeeds, the file on disk is complete, and then the very next
 *      `persist()` on that item re-renders from the truncated re-parsed copy
 *      and overwrites the file. The prose is gone, and the tool call that
 *      did it reported success. A fabricated `## Observations` block is the
 *      same bug with an extra edge: it empties the real body AND invents
 *      observations nobody wrote.
 *
 *  (b) observation text containing `#`, or ending in `(...)`.
 *      `parseObservations` reads `#tag` as a tag and a trailing
 *      parenthetical as `context`, stripping both out of `text`.
 *
 * Refused at the WRITE boundary rather than fixed in the format:
 * `renderItem`/`parseItem`/`splitSections` carry Plan 1's byte-identity
 * invariant, and changing the file format to accommodate this is a much
 * larger decision than this guard. The messages name the offending content
 * and say where it should go instead.
 */
const HEADING_LINE = /^#{1,6}\s/;

/**
 * Tested against the RAW line — deliberately not `line.trim()` — because
 * `item.ts`'s actual parser (`splitSections`'s `/^#\s+/`/`/^##\s+(.+?)\s*$/`)
 * anchors with `^` against the untrimmed line and needs the trailing
 * whitespace after the hash(es) to be PRESENT to match at all. Trimming
 * first breaks the guard in both directions: a line `'  # Heading'`
 * (leading whitespace) would trim to something `HEADING_LINE` matches, even
 * though `item.ts`'s `^`-anchored regex — seeing the untrimmed line — never
 * treats it as a heading (harmless, over-rejected); a bare `'# '` (a hash
 * plus trailing whitespace and NOTHING else) trims to `'#'`, which
 * `HEADING_LINE` does NOT match (no character left for `\s` to match) —
 * even though `item.ts` DOES drop that exact untrimmed line outright,
 * silently truncating the body one line short of what was written
 * (under-rejected — the actual gap this comment replaces).
 */
export function validateBody(body: string): void {
  for (const line of body.split('\n')) {
    if (!HEADING_LINE.test(line)) continue;
    throw new Error(
      `my_context: the body line ${JSON.stringify(line)} starts with a Markdown ` +
      `heading. An item's body is stored as the prose BEFORE its first "## " section, so ` +
      `this line — and everything after it — would be lost the next time the item is read ` +
      `back from disk, without any error. Put the detail in an observation instead, or ` +
      `write the line without its leading "#". See mycontext_help("capture").`,
    );
  }
}

export function validateObservationText(text: string, where: string): void {
  // A line break here is more destructive than the '#'/trailing-paren
  // cases below: `OBSERVATION`'s `(.*)$` does not span a line separator
  // (U+2028/U+2029) — nor, once the line is split on `\n` upstream, does a
  // literal `\r`/`\n` leave anything behind to match — so the WHOLE list
  // line fails to match and `parseObservations` silently drops the entire
  // observation, not just the part after the break.
  if (LINE_BREAK.test(text)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(text)}). An observation is ` +
      `stored as one Markdown list line, so this would either corrupt the line or make the ` +
      `whole observation silently disappear the next time this item is read back from disk. ` +
      `Keep it on one line, or split it into a separate observation. See mycontext_help("capture").`,
    );
  }
  if (text.includes('#')) {
    throw new Error(
      `my_context: ${where} contains "#" (${JSON.stringify(text)}). Observation text is ` +
      `stored as Markdown in which "#word" is a TAG, so the "#" and the word after it would ` +
      `be silently moved out of the text when the item is read back. Drop the "#", or pass ` +
      `the value in "tags". See mycontext_help("capture").`,
    );
  }
  if (/\([^()]*\)\s*$/.test(text)) {
    throw new Error(
      `my_context: ${where} ends in parentheses (${JSON.stringify(text)}). A trailing ` +
      `"(...)" is stored as the observation's separate "context" field, so it would be ` +
      `silently removed from the text when the item is read back. Rephrase so the ` +
      `parenthetical is not last, or pass it as "context". See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling of `validateBody`/`validateObservationText` above: those guard
 * the observation's TEXT, this guards its CATEGORY. `OBSERVATION` in
 * item.ts only recognizes `[a-z0-9_-]+` inside the brackets — a category
 * like `root cause` (a space) renders as `- [root cause] the pool leaked`,
 * which the parser cannot match at all, so `parseObservations` silently
 * skips the whole line. The write itself succeeds and reports success; the
 * observation is gone the moment anything re-persists the item from the
 * re-parsed (now `observations: []`) copy — the same failure mode
 * `validateBody` documents for a `##` heading in body, one step earlier in
 * the pipeline.
 */
export function validateObservationCategory(category: string, where: string): void {
  if (isValidObservationCategory(category)) return;

  // Distinguishes the two ways `isValidObservationCategory` can fail without
  // restating either of its checks: if lowercasing `category` would make it
  // valid, the character class was fine and the only problem is case: that
  // fails differently (silently RE-WRITTEN, not dropped) and deserves a
  // different, honest message rather than reusing the "would be dropped" one.
  if (isValidObservationCategory(category.toLowerCase())) {
    throw new Error(
      `my_context: ${where} is ${JSON.stringify(category)}, which is not all-lowercase. ` +
      `Categories are read back with "[category]".toLowerCase() (see parseObservations in ` +
      `item.ts), so this would be silently rewritten to ${JSON.stringify(category.toLowerCase())} ` +
      `the next time this item is read back from disk — its checksum would then no longer match ` +
      `what was written, and a repeat create_item call for the same content would stop deduping ` +
      `against it. Use ${JSON.stringify(category.toLowerCase())} instead. ` +
      `See mycontext_help("capture").`,
    );
  }

  throw new Error(
    `my_context: ${where} is ${JSON.stringify(category)}, which contains a character the ` +
    `observation format cannot store. Categories are written as "[category]" ` +
    `in Markdown and read back with the pattern [a-z0-9_-]+ (letters, digits, underscore and ` +
    `hyphen only) — anything else makes the line unparseable, so the whole observation would ` +
    `be silently dropped the next time this item is read back from disk. Use a category made ` +
    `only of those characters, e.g. "root-cause" instead of "root cause". ` +
    `See mycontext_help("capture").`,
  );
}

/** What `parseObservations` (item.ts) reads back out of "#tag" — anything else round-trips wrong or not at all. */
const OBSERVATION_TAG_RE = /^[A-Za-z0-9_-]+$/;

/**
 * The sibling of `validateObservationCategory`/`validateObservationText`
 * above, guarding the observation's TAGS. A tag is rendered inline as
 * `#tag` and read back with `#([A-Za-z0-9_-]+)` — a tag containing any
 * other character (a leading `#`, whitespace, punctuation) either matches a
 * shorter substring than what was written (silently truncating it to a
 * different tag) or fails to match at all (silently dropped), the same
 * failure class `validateObservationCategory` guards one field over.
 */
export function validateObservationTags(tags: string[], where: string): void {
  for (const tag of tags) {
    if (OBSERVATION_TAG_RE.test(tag)) continue;
    throw new Error(
      `my_context: ${where} contains ${JSON.stringify(tag)}, which is not a valid tag. Tags are ` +
      `written as "#tag" in Markdown and read back with the pattern [A-Za-z0-9_-]+ (letters, digits, ` +
      `underscore and hyphen only) — anything else round-trips to a different tag, or not at all, the ` +
      `next time this item is read back from disk. See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling guarding an observation's CONTEXT. Context is rendered
 * wrapped in one layer of parentheses, `(${context})`, and read back with
 * `\(([^()]*)\)\s*$` — a character class that explicitly excludes `(` and
 * `)`, so it cannot see through a paren nested inside context. A context of
 * `'(at) registration'` renders as `... ((at) registration)`, and reparsing
 * that trailing-parens pattern against a character class that excludes `(`
 * and `)` yields a DIFFERENT (truncated or empty) context than what was
 * written — the same silently-wrong-on-the-next-read failure
 * `validateObservationText` guards for a trailing parenthetical in text.
 */
export function validateObservationContext(context: string | null, where: string): void {
  if (context === null) return;
  if (/[()]/.test(context)) {
    throw new Error(
      `my_context: ${where} contains "(" or ")" (${JSON.stringify(context)}). Context is rendered ` +
      `wrapped in its own parentheses, and the parser that reads it back cannot see through a paren ` +
      `nested inside — this would round-trip to a different (or truncated) context the next time this ` +
      `item is read back from disk. Remove the parentheses, or fold this into "text" instead. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (LINE_BREAK.test(context)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(context)}). An observation is ` +
      `stored as one Markdown list line, so this would corrupt — or silently drop — the whole ` +
      `observation the next time this item is read back from disk. Remove it. ` +
      `See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling of `validateObservationCategory`/`validateObservationTags`,
 * guarding a RELATION target. A relation is rendered as `- type [[target]]`
 * and read back with `RELATION` (item.ts): `/^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i`.
 * That pattern's target group is `[^\]]+` — it cannot see through a `]`
 * nested inside the target — and is anchored per-line, so it cannot span a
 * line break either. A target containing either would either round-trip to
 * a truncated target (a `]` mid-string ends the match early) or fail to
 * match at all (a line break splits the relation across two unparseable
 * lines), silently dropping the whole relation the next time this item is
 * read back from disk — the write itself would report success. An empty
 * target is refused for the same "silently wrong on read-back" reason, not a
 * new one: `[[]]` round-trips to a relation whose target is the empty
 * string, indistinguishable from a typo that dropped the id entirely, and
 * every consumer of `Relation.target` treats it as a real id to look up.
 *
 * This is called on every string that ends up as a `Relation.target` in a
 * *stored* item, from every angle that can produce one:
 *  - `linkItems`'s `to`;
 *  - `createItem`'s `relations` input (defensive: `applyCandidates` always
 *    passes `relations: []` today, but this is the shared entry point for
 *    any future caller that doesn't);
 *  - `createItem`'s own explicit `id` — an id becomes a `supersedes` TARGET
 *    the moment something later supersedes this item, so an id that could
 *    not itself survive as a target must be refused at mint time, not
 *    discovered later at whichever future call writes the relation;
 *  - `supersedeItem`'s `id` (the retired item) — literally the string that
 *    gets written as `replacement.relations`'s new `supersedes` target.
 *    Without this, `supersede_item(id: "CONST-a]b", by: ...)` succeeds,
 *    writes `- supersedes [[CONST-a]b]]`, and the relation is silently
 *    dropped on the very next read of the REPLACEMENT — which also then
 *    fails its own checksum, since the parsed-back relations no longer match
 *    what was hashed at write time.
 */
export function validateRelationTarget(target: string, where: string): void {
  if (target.trim() === '') {
    throw new Error(
      `my_context: ${where} is empty. A relation target must name a real item id — an empty ` +
      `target would be stored as "[[]]" and read back as a relation pointing at nothing. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (LINE_BREAK.test(target)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(target)}). A relation is ` +
      `stored as one Markdown list line ("- type [[target]]"), so this would corrupt the line, ` +
      `or silently drop the whole relation the next time this item is read back from disk. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (target.includes(']')) {
    throw new Error(
      `my_context: ${where} contains "]" (${JSON.stringify(target)}). A relation target is ` +
      `stored inside "[[...]]", and the parser that reads it back matches up to the first "]" — ` +
      `so this would round-trip to a truncated (or unmatched) target the next time this item is ` +
      `read back from disk. See mycontext_help("capture").`,
    );
  }
}

/** Guards every relation's target in one place — see `validateRelationTarget`. */
function validateRelations(relations: Relation[]): void {
  relations.forEach((r, i) => validateRelationTarget(r.target, `relations[${i}].target`));
}

/**
 * Shared by both surfaces that hand a model's observations to `createItem`:
 * the MCP `create_item` tool (`optObservations` in mcp/tools.ts forwards
 * per-entry `tags`/`context` with only a shape check, no round-trip
 * validation of their own) and the ingest candidate validator
 * (`src/ingest/schema.ts`). Validating category, text, tags AND context
 * here — once — is what keeps those two callers from drifting into two
 * different (and possibly incomplete) copies of the same rules.
 */
function validateObservations(observations: Observation[]): void {
  observations.forEach((o, i) => {
    validateObservationCategory(o.category, `observations[${i}].category`);
    validateObservationText(o.text, `observations[${i}].text`);
    validateObservationTags(o.tags, `observations[${i}].tags`);
    validateObservationContext(o.context, `observations[${i}].context`);
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizePosix(value);
}

/** Project-layer items only — global-layer rows are a different owner's
 * items, indexed for read-time selection, and must never be treated as
 * something create_item already wrote or could overwrite. */
function projectItems(ctx: MutationContext): Item[] {
  return ctx.store.all().filter((i) => i.layer === 'project');
}

/** `Store.get` looks up by id across every layer; this narrows to the one
 * this module is allowed to reason about — see `projectItems`. */
function projectItem(ctx: MutationContext, id: string): Item | null {
  const item = ctx.store.get(id);
  return item && item.layer === 'project' ? item : null;
}

const MAX_FAMILY = 1000;

/**
 * Finds either a content duplicate among `base`, `base-2`, `base-3`, … (the
 * exact sequence `createItem` allocates into), or the next free id in that
 * sequence. Checking the whole family — not just `base` — matters: without
 * it, a third identical call to a title that has already collided once
 * would find `base` already an (unrelated) `base-2` sibling occupies and
 * think there is no duplicate, minting a third item for the same content.
 */
function locateInFamily(
  ctx: MutationContext, prefix: string, title: string, hash: string,
): { duplicate: Item | null; nextId: string } {
  const base = makeId(prefix, title);
  for (let n = 1; n <= MAX_FAMILY; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const item = projectItem(ctx, candidate);
    if (!item) return { duplicate: null, nextId: candidate };
    if (itemContentHash(item) === hash) return { duplicate: item, nextId: candidate };
  }
  throw new Error(
    `my_context: cannot allocate an id for "${title}" — ${MAX_FAMILY} variants already exist. ` +
    `Use a more specific title.`,
  );
}

/**
 * Persist an item: Markdown first (the source of truth), then the index.
 * `writeItem` recomputes and writes the checksum itself — it never mutates
 * the `item` it's given, only the copy it renders to disk — so this sets
 * `item.checksum` first, from the same `computeItemChecksum`, purely to
 * keep the object that then goes into `ctx.store.upsert` consistent with
 * what lands on disk. The recomputation inside `writeItem` is redundant
 * but harmless; there is exactly one checksum implementation, reused twice,
 * not two implementations that could drift.
 */
export function persist(ctx: MutationContext, item: Item): void {
  item.checksum = computeItemChecksum(item);
  writeItem(ctx.root, item);
  withRetry(() => ctx.store.upsert(item));
}

export function createItem(ctx: MutationContext, input: CreateInput): MutationResult {
  const category = resolveCategory(ctx, input.type);

  const title = (input.title ?? '').trim();
  if (title === '') throw new Error(missingFieldError('title', 'create_item', 'capture'));
  // Normalized ONCE, here, into a local `body` that both the validator and
  // the stored item read — not validated-then-re-derived, and not stored
  // raw. `parseItem` (item.ts) normalizes line endings before splitting the
  // body into lines; a body carrying a lone `\r` (any Windows- or old-Mac-
  // authored source text) has no literal `\n` to reveal a hidden `## `
  // heading to a naive check, but normalizing after storage would have
  // already lost the chance — the checksum, and `contentHash` below, both
  // need to see the SAME normalized text the file will actually hold.
  const body = normalizeEol(input.body ?? '').trim();

  validateEnums(input);
  validateTitle(title);
  validateExtra(input.extra ?? {});
  validateScope(input.scope ?? []);
  validateTags(input.tags ?? []);
  validateBody(body);
  validateObservations(input.observations ?? []);
  validateRelations(input.relations ?? []);
  // An id is a relation TARGET the moment anything later supersedes this
  // item (see `validateRelationTarget`'s doc comment) — guarded here, at
  // mint time, rather than only at whichever future `supersede_item`/
  // `link_items` call first tries to write it as one.
  if (input.id !== undefined) validateRelationTarget(input.id, '"id"');

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  const hash = contentHash({ ...input, title, body });

  // Spec §7.3: the idempotency key is `(source_file, source_anchor)` PLUS a
  // content hash — `type` is part of the match too, since a requirement and
  // a constraint captured from the same heading are different items, not a
  // collision. Content hash is folded into the match itself (not checked
  // after) so that different content at the same anchor simply falls
  // through to the normal id-allocation path below and creates a new item,
  // rather than being refused: a single heading routinely yields more than
  // one item, and a revision must be mintable at the same anchor as its
  // predecessor for supersede_item to have anything to wire together.
  const anchored = sourceFile !== null && sourceAnchor !== null
    ? projectItems(ctx).find(
        (i) => i.type === input.type && i.sourceFile === sourceFile &&
          i.sourceAnchor === sourceAnchor && itemContentHash(i) === hash,
      )
    : undefined;

  if (anchored) {
    return {
      id: anchored.id,
      created: false,
      status: anchored.status,
      filePath: anchored.filePath,
      message: `my_context: already captured as ${anchored.id}. Nothing changed.`,
    };
  }

  let id: string;
  if (input.id !== undefined) {
    // An explicit id names an item this call must never silently overwrite.
    // Only two outcomes are legal: it's the same content (a no-op duplicate),
    // or the caller is pointed at update_item/supersede_item instead.
    const existing = projectItem(ctx, input.id);
    if (existing) {
      if (itemContentHash(existing) === hash) {
        return {
          id: existing.id,
          created: false,
          status: existing.status,
          filePath: existing.filePath,
          message: `my_context: already captured as ${existing.id}. Nothing changed.`,
        };
      }
      throw new Error(
        `my_context: "${input.id}" already exists with different content. create_item never ` +
        `overwrites an existing item — call update_item(id: "${input.id}", ...) to change it, ` +
        `or supersede_item(id: "${input.id}", ...) to replace it with a new revision.`,
      );
    }
    id = input.id;
  } else {
    const located = locateInFamily(ctx, category.prefix, title, hash);
    if (located.duplicate) {
      return {
        id: located.duplicate.id,
        created: false,
        status: located.duplicate.status,
        filePath: located.duplicate.filePath,
        message: `my_context: already captured as ${located.duplicate.id}. Nothing changed.`,
      };
    }
    id = located.nextId;
  }

  const origin: Origin = input.origin ?? 'human';
  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');
  const item: Item = {
    id,
    type: input.type,
    title,
    status,
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    origin,
    sourceFile,
    sourceAnchor,
    sourceChecksum: input.sourceChecksum ?? null,
    validFrom: today(),
    validUntil: null,
    checksum: '',
    extra: input.extra ?? {},
    body,
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    layer: 'project',
    filePath: `items/${input.type}/${id}.md`,
  };

  persist(ctx, item);

  // Gated on the rule having actually fired — not merely on the resulting
  // status — so a caller that explicitly asks for `draft` on a non-normative
  // (e.g. rationale) item never sees a demotion explanation for a demotion
  // that did not happen. Since this can then only ever be the normative
  // case, the message says "normative" literally rather than interpolating
  // `category.tier`, so it cannot drift from the condition again. The
  // condition mirrors `trustedStatus` exactly (`origin !== 'human'`, not
  // `origin === 'agent'`) — an ingested item that gets demoted must get the
  // same explanation an agent-authored one does, or the message would be
  // silently missing for the one path (batch ingestion, spec §7.2) that is
  // going to demote the most items.
  const suffix = origin !== 'human' && category.tier === 'normative' && (input.status ?? 'active') !== 'draft'
    ? ` It is a draft because non-human-authored normative items are not injected until ` +
      `reviewed — promote it by editing "status:" directly in its Markdown file (Markdown is ` +
      `the source of truth; \`mycontext review\` is not implemented yet).`
    : '';

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}`,
  };
}

/**
 * The relation vocabulary. Closed deliberately: an open vocabulary produces
 * `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no
 * query finds all three.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
];

export interface UpdateInput {
  id: string;
  title?: string;
  body?: string;
  scope?: string[];
  tags?: string[];
  severity?: Severity;
  always?: boolean;
  status?: Status;
  extra?: Record<string, string>;
  origin?: Origin;
}

export interface SupersedeInput {
  id: string;
  by: string;
  reason?: string;
  origin?: Origin;
}

export interface LinkInput {
  from: string;
  to: string;
  relation: string;
}

/** Looks up across every layer (unlike `projectItem`) because `updateItem`,
 * `supersedeItem` and `linkItems` all need to name *any* known id in their
 * error messages — a global-layer id is a legitimate link/supersede target
 * to *read*. This is a lookup, not a write authorization: callers that are
 * about to persist the result must go through `requireWritableItem` below,
 * which enforces the layer boundary this function does not. */
function requireItem(ctx: MutationContext, id: string): Item {
  const item = ctx.store.get(id);
  if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
  return item;
}

/**
 * `requireItem` resolves across every layer so an id can still be *named* in
 * an error message; this narrows to items this module is allowed to
 * *persist*. Global-layer rows belong to a different owner's layer (see
 * `projectItem`/`projectItems`) — without this guard, `updateItem`,
 * `supersedeItem` and `linkItems` would happily call `persist()` on one,
 * which writes a project-layer shadow file for an id the index still marks
 * `global`. Disk and index then disagree about which layer owns the id, and
 * on the next rebuild `loadLayer`'s per-layer dedupe lets one copy silently
 * overwrite the other by primary key.
 */
function requireWritableItem(ctx: MutationContext, id: string): Item {
  const item = requireItem(ctx, id);
  if (item.layer !== 'project') {
    throw new Error(
      `my_context: "${id}" belongs to the global layer and cannot be modified from this ` +
      `project — global items are read-only here. See mycontext_help("categories").`,
    );
  }
  return item;
}

/**
 * Fails CLOSED: an item whose `type` is missing from config (e.g. the
 * category was renamed or removed after the item was captured — `loadLayer`
 * in rebuild.ts still indexes such items deliberately) is treated as
 * `'normative'`, the *more* restrictive tier, not `'rationale'`. Defaulting
 * to `'rationale'` would silently hand an agent status control over an item
 * whose governing category just vanished from config — the opposite of what
 * a security check should do when its input goes missing. `Object.hasOwn`
 * guards the same prototype-pollution hazard `resolveCategory` documents: a
 * bare index on `type: 'constructor'` would otherwise reach
 * `Object.prototype.constructor`, whose `.tier` is `undefined`, landing on
 * the same permissive default this function refuses to have.
 */
function tierOf(ctx: MutationContext, item: Item): Tier {
  return Object.hasOwn(ctx.config.categories, item.type)
    ? ctx.config.categories[item.type].tier
    : 'normative';
}

/** Statuses under which an item is no longer current — `valid_until` should
 * be set the moment an item transitions into one, whichever write path does
 * the transitioning, so the invariant `supersedeItem` establishes at
 * capture-of-retirement time holds no matter how status got there. */
function isRetired(status: Status): boolean {
  return status === 'superseded' || status === 'deprecated';
}

/** True when an item is a normative item that is *currently governing* —
 * the same narrow predicate `supersedeItem` uses for its own refusal. Only
 * `active` items are actually eligible for selection (`select.ts`), but
 * `validated` is included because a human who marks an item `validated` has
 * affirmed it, and treating that as "no longer protected" would make the
 * strongest human endorsement the weakest guard. */
function governsNormatively(ctx: MutationContext, item: Item): boolean {
  return tierOf(ctx, item) === 'normative' &&
    (item.status === 'active' || item.status === 'validated');
}

/**
 * The fields that decide whether — and how forcefully — an item is injected:
 * `scope` (which files it attaches to), `always` (whether it is pinned at
 * every session start) and `severity`. Changing any of them on a governing
 * item is functionally identical to the `status` change below — the item
 * stops reaching the session — but leaves it `active`, so it shows up in no
 * draft queue, no retired count, and no selection spill (it was never a
 * candidate). That silence is what makes it worse than the status change,
 * not better, so it gets the same refusal.
 */
const GUARDED_FIELDS = {
  scope: 'scope',
  always: 'always flag',
  severity: 'severity',
} as const;

/**
 * `scope` is a SET, not a sequence: `contentHash` (above) sorts it before
 * hashing precisely because glob order carries no meaning — `['a/**',
 * 'b/**']` and `['b/**', 'a/**']` attach the item to exactly the same files.
 * Comparing it positionally here would contradict that and make the guard
 * below refuse a no-op reorder as if it were a real narrowing of the item's
 * reach, with a message accusing the caller of neutralising a constraint it
 * never touched. Sorting both sides first makes the comparison agree with
 * what `scope` actually means everywhere else in this module.
 */
function sameScope(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Which guarded field, if any, this input would actually CHANGE. Sending a
 * field back unchanged (a model echoing what it just read) is not a change
 * and must not be refused, or every round-trip edit becomes an error.
 */
function guardedChange(item: Item, input: UpdateInput): keyof typeof GUARDED_FIELDS | null {
  if (input.scope !== undefined && !sameScope(input.scope.map((g) => normalizePosix(g)), item.scope)) {
    return 'scope';
  }
  if (input.always !== undefined && input.always !== item.always) return 'always';
  if (input.severity !== undefined && input.severity !== item.severity) return 'severity';
  return null;
}

/**
 * The second write path. `createItem` is the only place a non-human-authored
 * normative item gets forced to `draft` (via `trustedStatus`) — but nothing
 * stops a non-human caller from *editing* an already-active constraint, so
 * the boundary that matters here is narrower and different: a non-human
 * caller may revise a governing normative item's `title`, `body`, `tags` and
 * `extra` freely (that is deliberate — an agent sharpening the wording of a
 * rule is the point of the tool), but not `status`, and not the
 * injection-control fields `scope`/`always`/`severity`. Forcing `draft` here
 * would be wrong (spec intent, see module docs) — it would let a non-human
 * caller demote a human's active constraint just by editing its body — so an
 * attempted change is refused outright rather than silently rewritten.
 *
 * Both refusals are narrow on purpose, and gated on the same predicate:
 * non-human origin, normative tier, and currently governing — the same
 * `!== 'human'` widening as `trustedStatus`, for the same reason: `'ingest'`
 * reaches this tool exactly the same way `'agent'` does, and an ingestion
 * pipeline retiring or defanging a human's governing constraint is no less
 * dangerous than an agent doing it interactively. A caller editing its own
 * `draft` (which governs nothing yet), or any rationale item, is unaffected
 * in every field, regardless of origin.
 */
export function updateItem(ctx: MutationContext, input: UpdateInput): MutationResult {
  const item = requireWritableItem(ctx, input.id);
  const origin: Origin = input.origin ?? 'human';

  // Every replacement value is normalized and validated up front, before
  // any trust-boundary check runs and before `item` is touched — the same
  // ordering `createItem` uses, and the same reason: a shape violation
  // (an unreadable-once-written body, title, scope glob or tag) is refused
  // on its own terms rather than surfacing as a confusing trust-boundary
  // error, or worse, silently corrupting the file after the trust check
  // passes. `update_item` is a first-class MCP surface (not merely an
  // ingest-adjacent one), so it needs the identical guards `create_item`
  // does for the identical fields — see `validateTitle`/`validateScope`/
  // `validateTags` above.
  const title = input.title !== undefined ? input.title.trim() : undefined;
  const body = input.body !== undefined ? normalizeEol(input.body).trim() : undefined;

  validateEnums(input);
  if (input.extra !== undefined) validateExtra(input.extra);
  if (title !== undefined) {
    if (title === '') throw new Error(missingFieldError('title', 'update_item', 'capture'));
    validateTitle(title);
  }
  if (body !== undefined) validateBody(body);
  if (input.scope !== undefined) validateScope(input.scope);
  if (input.tags !== undefined) validateTags(input.tags);

  if (origin !== 'human' && governsNormatively(ctx, item)) {
    const field = guardedChange(item, input);
    if (field) {
      throw new Error(
        `my_context: a non-human caller cannot change the ${GUARDED_FIELDS[field]} of a governing ` +
        `normative item. ${item.id} is currently "${item.status}" and its ${GUARDED_FIELDS[field]} ` +
        `decides whether it is injected into a session at all, so changing it is a human ` +
        `decision — edit "${field}:" directly in the item's Markdown file (Markdown is the ` +
        `source of truth; \`mycontext review\` is not implemented yet). The title, body, tags ` +
        `and extra fields are still editable, and a draft or rationale item is unaffected. ` +
        `See mycontext_help("capture").`,
      );
    }
  }

  if (
    input.status !== undefined && input.status !== item.status &&
    origin !== 'human' && tierOf(ctx, item) === 'normative'
  ) {
    // The "what else is editable" clause has to match reality for *this*
    // item: on a governing (active/validated) normative item, scope/always/
    // severity are refused too (see the field guard above) — only title,
    // body, tags and extra remain open. A draft normative item has no such
    // restriction, so every other field really is editable there.
    const otherFields = governsNormatively(ctx, item)
      ? `Title, body, tags and extra are still editable; scope, always and severity are not, ` +
        `for the same reason.`
      : `Every other field is editable.`;
    throw new Error(
      `my_context: a non-human caller cannot change the status of a normative item. ` +
      `${item.id} stays "${item.status}". ${otherFields} Status changes on a ` +
      `normative item are a human decision — edit "status:" directly in the item's Markdown ` +
      `file (Markdown is the source of truth; \`mycontext review\` is not implemented yet). ` +
      `See mycontext_help("capture").`,
    );
  }

  if (title !== undefined) item.title = title;
  if (body !== undefined) item.body = body;
  if (input.scope !== undefined) item.scope = input.scope.map((g) => normalizePosix(g));
  if (input.tags !== undefined) item.tags = input.tags;
  if (input.severity !== undefined) item.severity = input.severity;
  if (input.always !== undefined) item.always = input.always;
  if (input.status !== undefined) {
    item.status = input.status;
    // Whichever write path retires an item, `validUntil` must move with it —
    // `supersedeItem` establishes this invariant at its own retirement point,
    // and a direct `update_item({status: 'deprecated'})` must not be a second,
    // divergent way to reach "retired" that leaves it null.
    if (isRetired(item.status) && item.validUntil === null) item.validUntil = today();
  }
  if (input.extra !== undefined) item.extra = { ...item.extra, ...input.extra };

  persist(ctx, item);

  return {
    id: item.id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: updated ${item.id} (${item.status}).`,
  };
}

/**
 * Never deletes and never drops content (spec §10): the retired item keeps
 * its file, body, observations and relations — only `status` and
 * `validUntil` move. The `supersedes` relation is written onto the
 * *replacement*, not the retiree, so the surviving item carries the pointer
 * to its own history (spec §3.2 file format).
 *
 * Note for future work (logged, not fixed here): a superseded item is still
 * a *content* duplicate as far as `createItem`'s dedup lookups are
 * concerned, so re-capturing the same text after a supersede returns
 * "already captured" pointing at the now-dead item. Nothing in this
 * function changes `createItem`'s dedup keys, so it does not make that
 * pre-existing gap any wider.
 */
export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {
  if (input.id === input.by) {
    throw new Error(`my_context: ${input.id} cannot supersede itself.`);
  }
  // `input.id` is about to be written verbatim as the REPLACEMENT's new
  // `supersedes` relation target (`replacement.relations.push` below) —
  // guarded here even though `createItem` now refuses to mint a malformed id
  // in the first place, because this function's own contract (retiring `id`)
  // is what actually performs the write that would silently corrupt on
  // read-back; defending only the mint site and not the write site is the
  // same "fixed in one place, live in the next" gap this review round found.
  validateRelationTarget(input.id, '"id"');

  const origin: Origin = input.origin ?? 'human';
  validateEnums(input);
  // `reason` becomes the text of an observation on the replacement (below),
  // so it goes through the same round-trip guard as any other observation
  // text — otherwise a reason like "see #4521" is silently shredded into a
  // tag on the way back off disk.
  if (input.reason) validateObservationText(input.reason, 'the supersede reason');

  const retired = requireWritableItem(ctx, input.id);
  const replacement = requireWritableItem(ctx, input.by);

  // The second route to the demotion `updateItem` refuses: retiring a
  // GOVERNING normative item (one currently `active` or `validated`) stops
  // it from being injected, exactly like a non-human caller editing its
  // status directly — so it gets the same refusal. Widened to `!== 'human'`
  // for the same reason `trustedStatus` and `updateItem`'s guards are:
  // `'ingest'` reaches this tool exactly the way `'agent'` does, and batch
  // ingestion (spec §7.2) retiring a human's governing constraint is the
  // same hazard as an agent doing it interactively. Narrow on purpose: a
  // non-human caller superseding its own `draft` (never governed anything),
  // an already `deprecated`/`superseded` item, or any rationale-tier item is
  // harmless and stays allowed — a later task legitimately supersedes one
  // agent- or ingest-authored draft with another.
  if (origin !== 'human' && governsNormatively(ctx, retired)) {
    throw new Error(
      `my_context: a non-human caller cannot supersede a governing normative item. ${retired.id} is ` +
      // Deliberately not "and still governs": only `active` is actually
      // eligible for selection (`isEligible` in select.ts, which classifies
      // `validated` as retired). `validated` is protected here because a
      // human affirming an item must not make it *easier* for an agent to
      // retire, but the message must not claim it is being injected.
      `currently "${retired.status}", a status only a human sets; retiring it is a human ` +
      `decision. Superseding a draft, deprecated or already-superseded item — or any rationale ` +
      `item — is unaffected. See mycontext_help("capture").`,
    );
  }

  const alreadyWired = replacement.relations.some(
    (r) => r.type === 'supersedes' && r.target === retired.id,
  );
  if (alreadyWired && retired.status === 'superseded') {
    return {
      id: retired.id,
      created: false,
      status: retired.status,
      filePath: retired.filePath,
      message: `my_context: ${retired.id} is already superseded by ${replacement.id}.`,
    };
  }

  // Content is never removed — only the lifecycle fields move (spec §10).
  retired.status = 'superseded';
  retired.validUntil = today();
  persist(ctx, retired);

  if (!alreadyWired) {
    replacement.relations.push({ type: 'supersedes', target: retired.id });
    // Guarded by the same `alreadyWired` check as the relation push, not by
    // `input.reason` alone: a repeat supersede after a human resets the
    // retiree's status back (so the idempotent early-return above no longer
    // applies) must not append a second copy of the same observation just
    // because the relation was already there.
    if (input.reason) {
      replacement.observations.push({
        category: 'supersession',
        text: `Replaces ${retired.id}: ${input.reason}`,
        tags: [],
        context: null,
      });
    }
  }
  persist(ctx, replacement);

  return {
    id: retired.id,
    created: true,
    status: retired.status,
    filePath: retired.filePath,
    message:
      `my_context: ${retired.id} is now superseded by ${replacement.id}. ` +
      `Nothing was deleted — the file remains and the item stays searchable.`,
  };
}

export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {
  if (!RELATION_TYPES.includes(input.relation)) {
    throw new Error(enumError('relation', input.relation, RELATION_TYPES, 'workflow'));
  }
  // `supersedes` stays in the vocabulary — it's part of the file format
  // (spec §3.2) and `supersedeItem` writes it — but forging it through
  // linkItems would assert a supersession with none of the lifecycle side
  // effects (`status`, `validUntil` on the retiree) that make the assertion
  // true, leaving the file and the item's actual state contradicting each
  // other.
  if (input.relation === 'supersedes') {
    throw new Error(
      `my_context: "supersedes" cannot be added with link_items — it asserts a lifecycle ` +
      `change, not just a relation, and link_items never touches status. Use ` +
      `supersede_item(id: "${input.to}", by: "${input.from}") instead.`,
    );
  }
  if (input.from === input.to) {
    throw new Error(`my_context: ${input.from} cannot link to itself.`);
  }
  validateRelationTarget(input.to, '"to"');

  const from = requireWritableItem(ctx, input.from);
  const target = ctx.store.get(input.to);

  if (from.relations.some((r) => r.type === input.relation && r.target === input.to)) {
    return {
      id: from.id,
      created: false,
      status: from.status,
      filePath: from.filePath,
      message: `my_context: ${from.id} already ${input.relation} ${input.to}.`,
    };
  }

  from.relations.push({ type: input.relation, target: input.to });
  persist(ctx, from);

  // Unresolved links are permitted by design (spec §3.2) and resolve on the
  // next sync, so this is a note rather than an error.
  const note = target
    ? ''
    : ` Note: ${input.to} does not exist yet; the link resolves when it is created.`;

  return {
    id: from.id,
    created: true,
    status: from.status,
    filePath: from.filePath,
    message: `my_context: ${from.id} ${input.relation} ${input.to}.${note}`,
  };
}
