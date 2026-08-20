/**
 * The write-boundary validators: every guard that refuses content which would
 * silently corrupt, truncate or vanish on its way through the Markdown
 * round-trip (spec §10's byte-identity invariant), plus the enum
 * vocabularies those refusals teach against.
 *
 * Split out of `mutate.ts` in Wave 5 — the rules are about what the FILE
 * FORMAT can round-trip (item.ts's parser is the counterparty every comment
 * below names), not about who may write, so they were a separate
 * responsibility living inside the mutation module. Every function kept its
 * doc comment: the reasoning is the load-bearing part.
 */
import { isValidObservationCategory } from './item.ts';
import { enumError } from './teach.ts';
import { ID_GRAMMAR, isUsableId } from './vocabulary.ts';
import type { Observation, Origin, Relation, Severity, Status, Step } from './types.ts';

/** Exported for the same reason `SEVERITIES` is: `mycontext edit --status`
 * has to refuse a bad value BEFORE it prints a preview and asks for
 * confirmation, and it must refuse it against this list, in `enumError`'s
 * words, rather than keeping a second copy of the vocabulary. */
export const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
/** Exported so every surface that takes a severity — the `create_item` and
 * `update_item` tools, `mycontext add --severity`, `review promote --severity`
 * — refuses a bad one against this list and `enumError`, rather than each
 * growing its own copy of the vocabulary and its own wording for the refusal. */
export const SEVERITIES: Severity[] = ['hard', 'soft'];
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
export function validateEnums(input: { status?: Status; severity?: Severity; origin?: Origin }): void {
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
    // `__proto__` passes `EXTRA_KEY_RE` and is not a reserved frontmatter
    // name, so neither check above sees it — but it cannot survive being
    // written. `renderItem` (item.ts) builds the frontmatter record with
    // `fm[key] = value`; for the key `__proto__` that assignment sets the
    // record's PROTOTYPE instead of creating an own property, so
    // `serializeFrontmatter` never sees the field and the file is written
    // without it. The checksum, however, was taken over an item whose
    // `extra` DID carry it. Result: the field is silently gone and the item
    // fails its own recorded checksum from the moment it is written.
    //
    // Verified by execution through the library entry point, with an `extra`
    // built by `JSON.parse` (which produces a real own `__proto__` property,
    // unlike an object literal): the rendered file contained no such line,
    // the re-parsed item's `extra` was `{}`, and its recomputed checksum did
    // not match the one in the file. `constructor` and `prototype` were
    // tested the same way and behave normally — they round-trip and their
    // checksums match — so they are deliberately NOT refused here.
    if (key === '__proto__') {
      throw new Error(
        `my_context: extra field "__proto__" cannot be stored. Assigning it while building the ` +
        `frontmatter sets the object's prototype instead of adding a field, so the value would ` +
        `never reach the file — and the item's checksum, which was taken with it, would then ` +
        `never match its own contents again. Choose a different key. ` +
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
      `back from disk, without any error. Put the detail in an observation instead; an ordered ` +
      `procedure's steps belong in its "## Steps" section, which is a field of the item and ` +
      `not part of its body — capture them with \`mycontext add procedure --step "<text>"\`, or ` +
      `the "steps" field of create_item; or write the line without its leading "#". ` +
      `See mycontext_help("capture").`,
    );
  }
}

/**
 * The sibling of `validateObservationText` for a `## Steps` line, and the
 * differences from it are the point.
 *
 * **Refused here, because the file could not hold it:**
 *
 *  (a) a line break. `STEP` (item.ts) is one line anchored `^…$`, so a text
 *      carrying one either corrupts the line or makes `parseSteps` refuse the
 *      whole item the next time it is read — a write that reports success and
 *      produces a file that will not load.
 *
 *  (b) empty or whitespace-only text. It says nothing, and it renders to
 *      `- [ ] ` — a line whose only content after the marker is trailing
 *      whitespace, which most editors and formatters strip on save. Once
 *      stripped the line is `- [ ]`, which `STEP` does not match at all, and
 *      the item stops loading.
 *
 *  (c) LEADING whitespace. The marker's own `\s+` swallows it, so
 *      `- [ ]   indented` parses back as `indented` — a different string than
 *      was written — and `parseSteps`, which requires what it parsed to
 *      re-render to what it read, refuses the file this write just produced.
 *
 * **NOT refused, and deliberately — do not "fix" these by copying
 * `validateObservationText`:** a `#`, and a trailing `(...)`. Those two are
 * refused for an observation because `parseObservations` reads `#word` as a
 * tag and a trailing parenthetical as `context`, moving both OUT of the text.
 * A step line has no tag grammar and a `Step` has no `context` field, so
 * `- [ ] bump the #2 replica (console only)` round-trips character for
 * character. Refusing them here would refuse content this format holds
 * perfectly well.
 */
export function validateStepText(text: string, where: string): void {
  if (LINE_BREAK.test(text)) {
    throw new Error(
      `my_context: ${where} contains a line break (${JSON.stringify(text)}). A step is stored ` +
      `as one Markdown checkbox line, so this would corrupt the line — and a "## Steps" ` +
      `section whose lines are not all steps is refused when the item is read back, so the ` +
      `item this writes would not load. Keep it on one line, or split it into two steps. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (text.trim() === '') {
    throw new Error(
      `my_context: ${where} is empty (${JSON.stringify(text)}). A step with no text says ` +
      `nothing, and it renders as "- [ ] " — a line whose only content after the marker is ` +
      `trailing whitespace, which most editors strip on save, after which the line no longer ` +
      `reads as a step and the item stops loading. Give the step its text, or leave it out. ` +
      `See mycontext_help("capture").`,
    );
  }
  if (/^\s/.test(text)) {
    throw new Error(
      `my_context: ${where} starts with whitespace (${JSON.stringify(text)}). The "- [ ] " ` +
      `marker absorbs it, so the step would read back as ${JSON.stringify(text.trimStart())} — ` +
      `a different string than the one written — and the item would be refused when it is read ` +
      `back rather than silently changed. Drop the leading whitespace. ` +
      `See mycontext_help("capture").`,
    );
  }
}

/**
 * The write-boundary normalisation for `## Steps`, and the sibling of
 * `normalizeObservations` below — **with the one difference that matters
 * spelled out, because copying that function is the way this gets broken.**
 *
 * `normalizeObservations` trims its text and collapses every interior run of
 * whitespace, and both are correct there: `parseObservations` does exactly the
 * same thing on the way back off disk, so text that was NOT normalised here
 * would come back changed and never match its own recorded checksum again.
 *
 * `parseSteps` (item.ts) does neither. It matches the RAW line and requires
 * what it parsed to re-render to exactly what it read, so the normalisation
 * that keeps observations honest would make steps dishonest: `"a  b"` written
 * as `"a b"` is a step whose file no longer says what its author typed, and
 * `"  indented"` silently trimmed is the leading whitespace `validateStepText`
 * refuses BY NAME so that the author can fix it. **Nothing here alters the
 * text.** The only transformation is the one a caller is not allowed to make
 * for themselves: `checked` is set, always, to `false`.
 *
 * That is what makes "nothing in this product ever writes `checked: true`" a
 * property rather than a convention — every write surface takes `string[]`, so
 * there is no shape a caller could pass that reaches this function with a box
 * already ticked. A box is ticked only by a human editing the Markdown.
 */
export function normalizeSteps(steps: string[]): Step[] {
  return steps.map((text, i) => {
    validateStepText(text, `steps[${i}]`);
    return { text, checked: false };
  });
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

/**
 * An id is not only a key. `createItem` turns an explicit `input.id`
 * straight into a path — `filePath: items/${type}/${id}.md` — and
 * `writeItem` (rebuild.ts) joins that with the workspace root and
 * `mkdirSync`s the parent recursively. So an id of `../../../evil`, or one
 * carrying any separator, writes a file OUTSIDE `.my_context/`, creating
 * directories on the way, and the write-deny hook (which matches on the
 * `.my_context` path segment) never sees a managed path at all.
 *
 * Nothing forwards a caller-supplied id today: the MCP `create_item` tool
 * has no `id` field, `mycontext add` never sets one, and the three internal
 * callers that do (`lesson/derive.ts`, `ingest/apply.ts`) build theirs from
 * `makeId`/`slugify`, whose output is `[A-Z0-9]+-[a-z0-9-]*` by
 * construction. This is insurance against the surface that forwards one
 * next, taken at the boundary rather than at whichever future call site
 * first does it — and it is stated as "not reachable today" rather than
 * "an exploit", because it is not one.
 *
 * The rule is "one safe filename segment", not `slugify`'s grammar. What
 * actually matters here is the path property, and the slug grammar would
 * additionally reject ids this system already accepts from disk — an
 * uppercase or underscored id in a hand-authored or older corpus parses and
 * indexes fine today, and a `createItem` that refused to re-mint one would
 * be enforcing a rule the rest of the codebase does not. `..` is refused
 * anywhere in the string, not merely as a whole segment: no id this project
 * mints contains one, and the separator check plus the leading-character
 * rule already make a bare `..` unreachable, so this only removes a shape
 * that is meaningless as an id and easy to misread as safe.
 */


export function validateExplicitId(id: string, where: string): void {
  if (/[/\\]/.test(id) || id.includes('..')) {
    throw new Error(
      `my_context: ${where} contains a path separator or ".." (${JSON.stringify(id)}). An id ` +
      `becomes the item's filename — "items/<type>/<id>.md" — so this would write outside the ` +
      `workspace. Ids are a single name: letters, digits, ".", "_" and "-". ` +
      `See mycontext_help("capture").`,
    );
  }
  if (!ID_GRAMMAR.test(id)) {
    throw new Error(
      `my_context: ${where} is not a usable id (${JSON.stringify(id)}). An id becomes the item's ` +
      `filename — "items/<type>/<id>.md" — so it must start with a letter or digit and contain ` +
      `only letters, digits, ".", "_" and "-". See mycontext_help("capture").`,
    );
  }
}

/**
 * Re-exported so the validators stay findable from one place. It LIVES in
 * `vocabulary.ts`, which imports nothing: `item.ts` calls it on the read
 * boundary, and this module imports `item.ts`, so defining it here made the
 * two circular.
 */
export { validateLoadedId } from './vocabulary.ts';

/** Guards every relation's target in one place — see `validateRelationTarget`. */
export function validateRelations(relations: Relation[]): void {
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
 *
 * It NORMALIZES as well as validates, and returns the normalized
 * observations, because the two cannot be separated: the collapse below is
 * what makes the text round-trip, so any caller that validated here and then
 * stored its own un-normalized copy would write a permanently
 * checksum-mismatched file. Callers must store — and hash — what this
 * returns, not what they passed in.
 */
export function normalizeObservations(observations: Observation[]): Observation[] {
  return observations.map((o, i) => {
    validateObservationCategory(o.category, `observations[${i}].category`);

    // Validated on the TRIMMED but UNCOLLAPSED text, and the order is
    // load-bearing. `validateObservationText` is what rejects a line break,
    // a "#", or a trailing parenthetical; the collapse below would not
    // change whether a "#" or a parenthetical is present, but it WOULD
    // silently erase a line break into a space. A line break must stay a
    // rejection (it destroys the whole observation on read-back), so the
    // collapse may only run after the validator has confirmed there is none.
    const trimmed = o.text.trim();
    validateObservationText(trimmed, `observations[${i}].text`);
    validateObservationTags(o.tags, `observations[${i}].tags`);

    // `parseObservations` (item.ts) trims context and maps a missing
    // parenthetical to `null`; `renderObservation` omits the parenthetical
    // entirely for a falsy context. So a context of "" (or one that is only
    // whitespace) is written as nothing and read back as `null` — stored as
    // "" it would never match its own re-parse. Interior whitespace in
    // context is NOT collapsed here, because `parseObservations` does not
    // collapse it either: it only `.trim()`s what it captured.
    const trimmedContext = o.context === null ? null : o.context.trim();
    const context = trimmedContext === '' ? null : trimmedContext;
    validateObservationContext(context, `observations[${i}].context`);

    // THE ONE SANCTIONED **LOSSY** NORMALIZATION AT THIS BOUNDARY — read
    // this before "fixing" it back. (The `.trim()`s above are normalizations
    // too, but lossless ones: they only remove whitespace nothing downstream
    // would ever see anyway. This one is different — it changes interior
    // content.) `parseObservations` (item.ts) unconditionally collapses
    // every run of whitespace in observation text to a single space
    // (`.replace(/\s+/g, ' ')`) on the way back off disk. Text containing
    // "a  b" (a double space — routine after a sentence-ending period),
    // "a\tb", or a non-breaking space would otherwise validate, get written,
    // and come back as "a b" with a checksum that can never match again:
    // `mycontext doctor` then exits 1 accusing the user of editing a file
    // that my_context itself wrote, and `rebuild` does not repair it. Every
    // OTHER normalization this project refuses — lowercasing a category,
    // truncating at a parenthesis — changes what the text MEANS or IS;
    // collapsing a whitespace run changes neither, and there is no lossless
    // alternative: Markdown itself collapses runs of spaces on render, so
    // preserving "a  b" literally would only buy a value nothing downstream
    // can ever distinguish from "a b" again.
    //
    // It lives HERE, in the function both surfaces already converge on,
    // rather than in `src/ingest/schema.ts` where it used to: the MCP
    // `create_item`/`update_item` path never reaches schema.ts at all, so
    // the rule was enforced for ingested items and absent for the ones a
    // model writes interactively. schema.ts now delegates to this function.
    return {
      category: o.category,
      text: trimmed.replace(/\s+/g, ' '),
      tags: o.tags,
      context,
    };
  });
}
