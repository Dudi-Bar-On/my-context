/**
 * `manifest.json` — the list of every other file in an artefact, with the full
 * SHA-256 of its bytes, in one fixed order.
 *
 * ## What it is for, in one sentence with its condition attached
 *
 * It lets a receiver check that the files arrived intact. It says nothing
 * about who wrote them, nothing about whether importing them is wise, and it
 * never gates activation — everything imported lands `draft` whether the
 * digests match or not, because those are two different questions and only one
 * of them is arithmetic. `MANIFEST_MEANING` below is the one sentence every
 * surface that mentions this file must use, and the test asserts that no word
 * in this module can be read as a claim about the author.
 *
 * ## Why determinism is the whole job
 *
 * `config.json`'s BYTES are hashed in here, and so are every item's. Two
 * exports of one workspace that differ only in the order a directory walk
 * returned entries, or in the order an object literal was assembled, are two
 * artefacts that FAIL to verify against each other — and the failure is
 * reported as `mismatched`, which reads as tampering. So:
 *
 *   - the file list is sorted with `comparePaths`, the one comparator, over
 *     UTF-8 bytes rather than UTF-16 code units;
 *   - `renderManifest` writes its OWN object literal rather than serialising
 *     the caller's, so the byte layout does not depend on the order the value
 *     was built in;
 *   - `createdAt` is the one non-reproducible field and it comes from an
 *     injected `now`, never from `Date.now()` read in here.
 *
 * ## The digest is over the FILE BYTES, deliberately
 *
 * `computeItemChecksum` hashes a JSON projection of an item and would read a
 * reordered frontmatter block, a re-indented config or a rewritten line ending
 * as the same file. Catching exactly that is what a transit manifest is for,
 * so nothing here parses anything before it hashes.
 *
 * ## Why this module calls `refuseArtefactPaths`, three times
 *
 * A manifest IS a set of paths, so the set-level rules are this module's
 * business at each of the three points where such a set crosses its boundary,
 * and each point has its own silent failure:
 *
 *   - **`buildManifest`** — the artefact does not exist yet, so a set holding
 *     `items/rule/RULE-a.md` and `items/RULE/RULE-b.md` is refused BEFORE a
 *     stranger receives an artefact that verifies on Linux and fails on
 *     Windows. `buildBundle` checks its own walk; a rule enforced only in the
 *     caller that remembers to ask is not enforced.
 *   - **`parseManifest`** — a stranger's file, and the duplicate is an attack
 *     rather than an accident: two entries for one path with two digests let a
 *     reader that indexes by path check the bytes against whichever entry it
 *     kept, so a tampered file passes.
 *   - **`verifyManifest`** — the same duplicate reached from the disk side,
 *     where the loser of the collision would be silently dropped from the
 *     comparison and never reported as anything.
 *
 * ## What is NOT checked here, and why each absence is deliberate
 *
 *   - **`bytes` is not re-compared during verification.** The digest already
 *     decides it, and a second check that can never be the one to fail is the
 *     kind of check a mutation run reports as surviving because nothing could
 *     notice it was gone.
 *   - **The Unicode screen.** A pack name is screened for bidi and zero-width
 *     controls by `screen.ts`'s `screenPackMeta`, which owns that table.
 *     `refusePackName` refuses C0/C1 controls only, and for a different
 *     reason: the name is printed as ONE LINE in a confirmation prompt and in
 *     `pack list`, and a newline inside it forges a second line. Restating the
 *     screen's table here would produce two lists that drift.
 *   - **`generator` is never parsed.** It is descriptive. Refusing a spelling
 *     this build does not recognise would be version arithmetic, which this
 *     product does not do anywhere.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { VERSION } from '../core/version.ts';
import {
  comparePaths, elidedEcho, refuseArtefactPaths, ITEMS_DIR, MANIFEST_NAME, PACK_PROTOCOL,
  type ArtefactKind, type ExportFile,
} from './layout.ts';

/** One file's entry in the manifest. `bytes` is a LENGTH here, not content. */
export interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

/** `manifest.json`, parsed. Every key is always present; absence is `null`. */
export interface Manifest {
  protocol: string;
  kind: ArtefactKind;
  name: string | null;
  version: string | null;
  generator: string;
  createdAt: string;
  itemCount: number;
  files: ManifestFile[];
}

/** What the exporter knows that the file set does not say. */
export interface ManifestMeta {
  kind: ArtefactKind;
  name: string | null;
  version: string | null;
  /** Milliseconds since the epoch, injected — never read from the clock here. */
  now: number;
}

/** The three ways an artefact's files can disagree with its manifest. */
export interface ManifestVerdict {
  missing: string[];
  extra: string[];
  mismatched: string[];
}

/**
 * The ONE sentence about what a verified manifest means, exported so that the
 * CLI, the import report and both READMEs say it the same way.
 *
 * Both halves are load-bearing and neither may travel alone: the first states
 * the guarantee, the second states its condition, and a line that prints only
 * the first has started making a claim this arithmetic cannot support.
 */
export const MANIFEST_MEANING =
  'the manifest lets a receiver check the files arrived intact; it says nothing about whether '
  + 'the author is trustworthy';

/** The manifest's keys, in the order they are written. */
const MANIFEST_KEYS = [
  'protocol', 'kind', 'name', 'version', 'generator', 'createdAt', 'itemCount', 'files',
] as const;

/** A file entry's keys, in the order they are written. */
const FILE_KEYS = ['path', 'bytes', 'sha256'] as const;

const KINDS: readonly string[] = ['export', 'pack'];

/** 64 lowercase hex characters. Upper case is a different string and a different file. */
const DIGEST = /^[0-9a-f]{64}$/;

/** UTC with milliseconds, the audit log's `at` spelling. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** C0 and C1 controls, and DEL — none of which is one line of displayable text. */
const META_CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** Both opaque strings are bounded in CODE POINTS, so an emoji costs one. */
const MAX_META_CODE_POINTS = 64;

/** The widest value `new Date` represents; beyond it `toISOString` throws. */
const MAX_TIME = 8.64e15;

function json(v: unknown): string {
  return JSON.stringify(v) ?? String(v);
}

/**
 * The most characters of a QUOTED VALUE a refusal from this module prints.
 *
 * The values this module quotes are not all bounded by the time it quotes
 * them. `refuseOpaqueMeta`'s 64-code-point limit is the fifth of its rules,
 * and three that fire BEFORE it interpolate the value: the not-a-string
 * branch, the all-whitespace branch and the trim-mismatch branch. So a value
 * that trips one of those was quoted at whatever length it arrived at, and
 * **it arrives from a stranger's file**: `parseManifest` puts a received
 * manifest's `name` and `version` through `refuseMeta`, so nobody has to type
 * a flag for this to reach a terminal.
 *
 * Measured on 2026-08-24 through the real commands, message length in
 * characters: a 5,000-space name printed 5,175 through `pack import` and 5,178
 * through `export --as-pack`; 5,000 characters and one trailing space printed
 * 10,249 and 10,252, because the trim-mismatch branch quotes the value TWICE —
 * once as what arrived and once as what to write instead; and a 1,000-element
 * array printed 7,215.
 *
 * **The cap is on the VALUE and not on the message**, and the difference is
 * the whole point. Capping the message was measured on the import door on
 * 2026-08-23 and was wrong: the value is printed FIRST and the sentence saying
 * what is wrong with it comes AFTER, so a message-width cut keeps the
 * attacker's five thousand characters and throws away the reason. That is the
 * rule backwards. Capping the value keeps the whole sentence and shortens only
 * the part whose length somebody else chose.
 *
 * 256, the number this codebase already settled on for exactly this job
 * (`ui/security.ts` · `export const REFUSAL_VALUE_MAX = 256;` · ~354). It is
 * restated here rather than imported because `src/pack/` does not depend on
 * `src/ui/`, which is the same call `cli/commands/pack.ts` made.
 */
const QUOTED_VALUE_MAX = 256;

/** The marker that makes a capped value unmistakable. One character. */
const VALUE_TRUNCATED = '…';

/**
 * `json`, with the rendered value capped and the cut marked VISIBLY.
 *
 * **Used by every branch a value can reach UNBOUNDED, and by no other.** The
 * branches below `refuseOpaqueMeta`'s code-point limit keep plain `json`,
 * because the limit has already bounded what they quote and a value inside the
 * limit is one the author is entitled to see whole — 64 C1 controls render
 * past this cap in escapes alone, and cutting that would hide a legal length
 * behind a marker that means "too long". That is a dependency on the ORDER of
 * the checks, which is why it is written down at both ends rather than left
 * for a reorder to quietly undo.
 *
 * Two things the cut is careful about, both so that complaining about a
 * malformed value does not print a malformed value:
 *
 *   - never between the halves of a surrogate pair — half a pair is a lone
 *     surrogate, which is itself a row of `screen.ts`'s table;
 *   - never immediately after an odd run of backslashes, which would leave a
 *     JSON escape with nothing to escape.
 */
function quoted(v: unknown): string {
  const text = json(v);
  if (text.length <= QUOTED_VALUE_MAX) return text;
  const lead = text.charCodeAt(QUOTED_VALUE_MAX - 1);
  let end = lead >= 0xd800 && lead <= 0xdbff ? QUOTED_VALUE_MAX - 1 : QUOTED_VALUE_MAX;
  let backslashes = 0;
  while (backslashes < end && text.charCodeAt(end - 1 - backslashes) === 0x5c) backslashes += 1;
  if (backslashes % 2 === 1) end -= 1;
  // A rendering that opened a string literal is re-closed, so a cut value
  // still reads as a quoted string rather than as a sentence missing a quote.
  const close = text.startsWith('"') ? '"' : '';
  return `${text.slice(0, end)}${VALUE_TRUNCATED}${close}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A `my_context:`-prefixed sentence from `layout.ts`, re-voiced as one clause
 * inside a sentence that also says WHERE the offending set came from and what
 * did not happen as a result.
 *
 * The three call sites read the same rules and produce three different
 * messages, because "your export is about to write two files that are one file
 * on Windows" and "the manifest you received lists one file twice" send a
 * reader to two different places.
 */
function revoice(lead: string, refusal: string, tail: string): string {
  return `my_context: ${lead}: ${refusal.replace(/^my_context:\s*/, '')} ${tail}`;
}

/**
 * `null` when this string may be written into the manifest as an opaque
 * descriptive field, otherwise one sentence naming the field and the rule.
 *
 * Refuses rather than trims or normalises, which is the same ruling Task 1
 * made for paths and for the same reason: these bytes go into the manifest, so
 * rewriting the value would change the file that was hashed. The name is also
 * compared later — it is the directory an import's records are filed UNDER
 * (`pack/imported-audit.ts` · `export function packDir(root: string, key: PackKey): string {` · ~176)
 * and `review promote --all --pack <name>` matches on it — so two spellings of
 * one visible name would be two packs. It is not the whole key and has not been
 * since a second pack calling itself the first one's name overwrote its
 * membership record; what it decides is what a person READS, which is why the
 * rule below is about what can be one line of a report rather than about what
 * can be a path.
 *
 * The order of the checks decides what the message SAYS: `'   '` breaks the
 * empty rule and the whitespace rule at once, and only one of them tells the
 * author what to type instead.
 *
 * **Every value it quotes goes through `quoted`, never `json`.** Three of
 * these rules fire before the code-point limit does, so a value that trips one
 * of them is quoted at whatever length it arrived at — and it arrives from a
 * stranger's `manifest.json` as readily as from a flag somebody typed. See
 * `quoted` above for the measurements and for why the cap sits on the VALUE
 * rather than on the message.
 */
function refuseOpaqueMeta(field: string, v: unknown): string | null {
  const lead = `my_context: this pack's ${field}`;
  if (typeof v !== 'string') {
    return `${lead} is ${quoted(v)}, which is not a string. A pack carries a ${field} as opaque `
      + 'text: it is shown to whoever imports the pack and is never parsed, ordered or compared '
      + 'against another one.';
  }
  if (v === '') {
    return `${lead} is empty. It is what a reader sees to tell one pack from another, so there `
      + 'is no useful default to invent for it.';
  }
  if (v.trim() === '') {
    return `${lead} is ${quoted(v)}, which is only whitespace. It is what a reader sees to tell `
      + 'one pack from another, and whitespace shows as nothing at all.';
  }
  if (v !== v.trim()) {
    return `${lead} ${quoted(v)} has leading or trailing whitespace. It is refused rather than `
      + 'trimmed, because these bytes are written into the manifest and a value this product '
      + `rewrote is not the value the author wrote. Write ${quoted(v.trim())}.`;
  }
  const codePoints = [...v].length;
  if (codePoints > MAX_META_CODE_POINTS) {
    return `${lead} is ${codePoints} code points long, and ${MAX_META_CODE_POINTS} is the limit. `
      + 'It is a label rather than a description — it is printed beside the pack on every line '
      + 'that mentions it.';
  }
  // `json` and not `quoted`, from here down: the rule above has already bounded
  // the value at 64 code points, and a value INSIDE the limit is one the author
  // is entitled to see whole — a name of 64 C1 controls renders past the cap in
  // escapes alone, and cutting it would hide legal length behind a marker that
  // means "too long". The dependency is on the rule six lines up, so a reorder
  // of these checks is where to look again.
  if (META_CONTROL.test(v)) {
    return `${lead} ${json(v)} contains a control character. It is printed as ONE line in the `
      + 'confirmation prompt and in `mycontext pack list`, so a newline or a carriage return '
      + 'inside it forges a second line of a report the reader is relying on.';
  }
  if (v.normalize('NFC') !== v) {
    return `${lead} ${json(v)} is not in Unicode NFC. It is refused rather than normalised, `
      + 'because these bytes are written into the manifest and because the name is matched again '
      + `later, so two spellings would be two packs. Write ${json(v.normalize('NFC'))}.`;
  }
  return null;
}

/** `null` when this value may be a pack's name. */
export function refusePackName(v: unknown): string | null {
  return refuseOpaqueMeta('name', v);
}

/**
 * `null` when this value may be a pack's version.
 *
 * A descriptive version, not a semantic one. There is no version arithmetic
 * anywhere in this product: nothing compares two of these, orders them, or
 * decides that one supersedes another, and `"the one with the SQL rules"` is
 * as valid as `"2026-08 rev 3"`.
 */
export function refuseDescriptiveVersion(v: unknown): string | null {
  return refuseOpaqueMeta('version', v);
}

/** The `kind`/`name`/`version` triple, whose legal shapes depend on `kind`. */
function refuseMeta(kind: unknown, name: unknown, version: unknown): string | null {
  if (typeof kind !== 'string' || !KINDS.includes(kind)) {
    return `my_context: this artefact's "kind" is ${quoted(kind)}, and an artefact is either `
      + `"export" (a workspace travelling whole) or "pack" (a portable artefact). A change to `
      + `the artefact format is declared by its protocol, ${PACK_PROTOCOL}.`;
  }
  if (kind === 'pack') {
    return refusePackName(name) ?? refuseDescriptiveVersion(version);
  }
  if (name !== null || version !== null) {
    return `my_context: this artefact's "kind" is ${quoted(kind)} and it carries a name of `
      + `${quoted(name)} and a version of ${quoted(version)}. Both belong to a pack, which an `
      + `author names and versions deliberately; an export is one workspace travelling whole and `
      + `has neither, so both keys are null. Absence is written as null rather than omitted, so `
      + `a reader never has to tell "absent" from "empty".`;
  }
  return null;
}

/** `new Date(now).toISOString()`, or a refusal naming the clock that produced it. */
function stampedAt(now: unknown): string {
  if (typeof now !== 'number' || !Number.isFinite(now) || Math.abs(now) > MAX_TIME) {
    throw new Error(
      `my_context: this artefact would be stamped from a clock reading ${json(now)}, which is not `
      + 'a time. `createdAt` is the one field in a manifest that cannot be reproduced from the '
      + 'corpus, so it is passed in by the caller rather than read here — and a caller that '
      + 'passes nothing would otherwise stamp the epoch. Nothing was written.',
    );
  }
  return new Date(now).toISOString();
}

/**
 * The manifest for a set of files, with `manifest.json` itself excluded — it
 * is the one file no digest covers, because it cannot hash itself.
 *
 * The whole set is checked BEFORE `manifest.json` is dropped from it, so a
 * caller that hands over a set holding two spellings of the root file is
 * refused rather than quietly half-fixed.
 */
export function buildManifest(files: readonly ExportFile[], meta: ManifestMeta): Manifest {
  const badMeta = refuseMeta(meta.kind, meta.name, meta.version);
  if (badMeta !== null) throw new Error(`${badMeta} Nothing was written.`);

  const badPaths = refuseArtefactPaths(files.map((f) => f.path));
  if (badPaths !== null) {
    throw new Error(revoice(
      'this export would not be one artefact', badPaths, 'Nothing was written.',
    ));
  }

  const createdAt = stampedAt(meta.now);
  const entries: ManifestFile[] = files
    .filter((f) => f.path !== MANIFEST_NAME)
    .map((f) => ({
      path: f.path,
      bytes: f.bytes.length,
      sha256: createHash('sha256').update(f.bytes).digest('hex'),
    }))
    .toSorted((a, b) => comparePaths(a.path, b.path));

  return {
    protocol: PACK_PROTOCOL,
    kind: meta.kind,
    name: meta.name,
    version: meta.version,
    generator: `mycontext ${VERSION}`,
    createdAt,
    itemCount: entries.filter((e) => e.path.startsWith(`${ITEMS_DIR}/`)).length,
    files: entries,
  };
}

/**
 * The bytes of `manifest.json`: two-space JSON, LF, exactly one trailing
 * newline — the spelling `init` already uses for `config.json`.
 *
 * It writes its own literal rather than serialising the value it was handed,
 * because `JSON.stringify` follows insertion order and the format may not
 * depend on the order a caller assembled its fields in. There is no validation
 * here: a `Manifest` is produced by `buildManifest` or by `parseManifest`, and
 * both refuse before returning one.
 */
export function renderManifest(m: Manifest): Buffer {
  const canonical = {
    protocol: m.protocol,
    kind: m.kind,
    name: m.name,
    version: m.version,
    generator: m.generator,
    createdAt: m.createdAt,
    itemCount: m.itemCount,
    files: m.files.map((f) => ({ path: f.path, bytes: f.bytes, sha256: f.sha256 })),
  };
  return Buffer.from(`${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
}

/**
 * One entry of `files`, validated key by key.
 *
 * Four of its branches quote a value with `elidedEcho` rather than plain
 * `json`, because they are reachable from a stranger's `manifest.json` with
 * no length rule ahead of them: an unknown key, a non-string `path`, and the
 * `path` echoed alongside a bad `bytes` or a bad `sha256`. Measured
 * 2026-08-24 through `parseManifest`, before the bound: 5,379 / 7,075 /
 * (unbounded) / 5,284-ish characters. `layout.ts`'s own path rules already
 * cap what a LEGAL path can be (`MAX_PATH_ECHO`'s doc comment has the
 * arithmetic); this only stops an illegal one from being unbounded too.
 */
function refuseFileEntry(index: number, raw: unknown): string | null {
  const at = `my_context: this manifest's files[${index}]`;
  if (!isObject(raw)) {
    return `${at} is ${json(raw)}, not an object. Every entry is `
      + `{"${FILE_KEYS.join('", "')}"}.`;
  }
  for (const key of Object.keys(raw)) {
    if (!(FILE_KEYS as readonly string[]).includes(key)) {
      return `${at} carries ${elidedEcho(json(key))}, which is not a key a manifest entry has. An `
        + `unknown key is refused rather than skipped: a manifest entry says what a reader must `
        + `check, and a key this build does not act on would be a rule the author believes is in `
        + `force. The keys are "${FILE_KEYS.join('", "')}", and a change to them is declared by `
        + `the protocol, ${PACK_PROTOCOL}.`;
    }
  }
  if (typeof raw.path !== 'string') {
    return `${at} has "path" = ${elidedEcho(json(raw.path))}, which is not a string.`;
  }
  if (!Number.isSafeInteger(raw.bytes) || (raw.bytes as number) < 0) {
    return `${at} (${elidedEcho(json(raw.path))}) has "bytes" = ${json(raw.bytes)}, and a file's `
      + 'length is a whole number of bytes, not negative.';
  }
  if (typeof raw.sha256 !== 'string' || !DIGEST.test(raw.sha256)) {
    return `${at} (${elidedEcho(json(raw.path))}) has "sha256" = ${elidedEcho(json(raw.sha256))}, `
      + 'which is not 64 lowercase hex characters. The digest is the full SHA-256 of the file '
      + 'bytes — truncating it, or writing it in another case, produces a string this build cannot '
      + 'compare against a digest it computes.';
  }
  return null;
}

/**
 * `manifest.json`'s bytes, read back into a `Manifest`, or a thrown refusal
 * naming the one rule that decided it.
 *
 * **Why the byte-level rules are enforced on the way in.** Every other file in
 * an artefact is covered by a digest in here; this one is not, because it
 * cannot hash itself. Its own byte layout is therefore the only integrity
 * statement it has, and a reader that accepted two spellings of it would be
 * reading two formats. It is also the first thing a receiver opens, so
 * "a stray CR — your git checkout rewrote the line endings" is a far better
 * answer than the twelve `mismatched` files that same rewrite produces.
 */
export function parseManifest(bytes: Buffer): Manifest {
  if (bytes.length === 0) {
    throw new Error('my_context: this artefact\'s manifest.json is empty. It is the list of every '
      + 'other file in the artefact, so there is nothing to check the arriving bytes against.');
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error('my_context: this artefact\'s manifest.json begins with a UTF-8 byte order '
      + 'mark. The file is UTF-8 by definition and the mark is content, not encoding — it is '
      + 'refused by name here because a JSON parser reports it as a syntax error at offset 0, '
      + 'which sends a reader looking for a missing brace.');
  }
  const text = bytes.toString('utf8');
  if (text.includes('\r')) {
    throw new Error('my_context: this artefact\'s manifest.json contains a carriage return. The '
      + 'artefact\'s line endings are LF everywhere, so this file has been rewritten since it was '
      + 'written — a git checkout with core.autocrlf=true does exactly this, and it rewrites '
      + 'every other text file in the artefact too, which is why the digests below it would all '
      + 'fail. Fetch the artefact again without translating line endings.');
  }
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error('my_context: this artefact\'s manifest.json does not end with exactly one '
      + 'trailing newline. Its own bytes are the only thing that says it arrived whole — it is '
      + 'the one file in an artefact that no digest covers, because it cannot hash itself.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`my_context: this artefact's manifest.json is not valid JSON: `
      + `${err instanceof Error ? err.message : String(err)}`);
  }
  if (!isObject(parsed)) {
    throw new Error(`my_context: this artefact's manifest.json is ${json(parsed)}, not a JSON `
      + `object. It is an object carrying "${MANIFEST_KEYS.join('", "')}".`);
  }

  for (const key of MANIFEST_KEYS) {
    if (!Object.hasOwn(parsed, key)) {
      throw new Error(`my_context: this artefact's manifest.json has no ${json(key)} key. Every `
        + 'key is always present and absence is written as null, so a reader never has to tell '
        + '"absent" from "null" — a missing key is a manifest a different implementation wrote.');
    }
  }
  for (const key of Object.keys(parsed)) {
    if (!(MANIFEST_KEYS as readonly string[]).includes(key)) {
      throw new Error(`my_context: this artefact's manifest.json carries ${json(key)}, which is `
        + `not a key of ${PACK_PROTOCOL}. An unknown key is refused rather than skipped: this is `
        + `the one file in an artefact that no digest covers, so a key smuggled into it is a key `
        + `nothing else would notice. A change to the format is declared by its protocol.`);
    }
  }

  if (parsed.protocol !== PACK_PROTOCOL) {
    throw new Error(`my_context: this artefact declares the protocol ${json(parsed.protocol)}, and `
      + `this build reads ${PACK_PROTOCOL}. Nothing was read — a format this build does not know `
      + 'is refused rather than guessed at.');
  }
  const badMeta = refuseMeta(parsed.kind, parsed.name, parsed.version);
  if (badMeta !== null) throw new Error(`${badMeta} Nothing was read.`);

  if (typeof parsed.generator !== 'string' || parsed.generator.trim() === '') {
    throw new Error(`my_context: this artefact's manifest.json has "generator" = `
      + `${json(parsed.generator)}, and every artefact says which build wrote it. It is `
      + 'descriptive and is never parsed — nothing here compares it against this build\'s own '
      + 'version — but it may not be empty, because a bug report needs it.');
  }
  if (typeof parsed.createdAt !== 'string' || !TIMESTAMP.test(parsed.createdAt)
    || new Date(parsed.createdAt).toISOString() !== parsed.createdAt) {
    throw new Error(`my_context: this artefact's manifest.json has "createdAt" = `
      + `${json(parsed.createdAt)}, which is not a UTC timestamp with milliseconds `
      + '(YYYY-MM-DDTHH:MM:SS.sssZ, the audit log\'s own spelling). A local time, an offset or a '
      + 'date that does not exist would all order differently from the way they read.');
  }
  if (!Number.isSafeInteger(parsed.itemCount) || (parsed.itemCount as number) < 0) {
    throw new Error(`my_context: this artefact's manifest.json has "itemCount" = `
      + `${json(parsed.itemCount)}, which is not a count.`);
  }
  if (!Array.isArray(parsed.files)) {
    throw new Error(`my_context: this artefact's manifest.json has "files" = ${json(parsed.files)}, `
      + 'which is not an array. It lists every file in the artefact except manifest.json itself.');
  }

  const files: ManifestFile[] = [];
  for (const [index, raw] of parsed.files.entries()) {
    const bad = refuseFileEntry(index, raw);
    if (bad !== null) throw new Error(bad);
    const entry = raw as { path: string; bytes: number; sha256: string };
    if (entry.path === MANIFEST_NAME) {
      throw new Error(`my_context: this artefact's manifest.json lists ${json(MANIFEST_NAME)}, and `
        + 'it cannot hash itself — the digest would have to be computed over bytes that already '
        + 'contain it. Every other file in the artefact is listed; this one is not.');
    }
    files.push({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256 });
  }

  const badPaths = refuseArtefactPaths(files.map((f) => f.path));
  if (badPaths !== null) {
    throw new Error(revoice(
      'this artefact\'s manifest.json does not list one artefact\'s worth of files',
      badPaths,
      'Nothing was read.',
    ));
  }
  for (let i = 1; i < files.length; i += 1) {
    // `> 0` rather than `>= 0`: two equal paths cannot reach here, because the
    // set check above has already refused them by name. A clause that can
    // never be the one to decide is a clause no test could notice was gone.
    const previous = files[i - 1] as ManifestFile;
    const current = files[i] as ManifestFile;
    if (comparePaths(previous.path, current.path) > 0) {
      throw new Error(`my_context: this artefact's manifest.json lists ${json(current.path)} after `
        + `${json(previous.path)}, and its files are in ascending order of their UTF-8 bytes. The `
        + 'order is part of the format — the archive\'s entries are written in it too — so a '
        + 'manifest out of order is a manifest a different implementation wrote, and the point of '
        + 'fixing the order is that this is detectable.');
    }
  }

  const items = files.filter((f) => f.path.startsWith(`${ITEMS_DIR}/`)).length;
  if (parsed.itemCount !== items) {
    throw new Error(`my_context: this artefact's manifest.json says itemCount is `
      + `${json(parsed.itemCount)} and lists ${items} file(s) under "${ITEMS_DIR}/". The count is `
      + 'redundant on purpose, so that a reader wanting only the size does not parse the array — '
      + 'and a count that disagrees with the list is the disagreement it exists to surface.');
  }

  return {
    protocol: parsed.protocol,
    kind: parsed.kind as ArtefactKind,
    name: parsed.name as string | null,
    version: parsed.version as string | null,
    generator: parsed.generator,
    createdAt: parsed.createdAt,
    itemCount: parsed.itemCount as number,
    files,
  };
}

/**
 * Every way the files beside a manifest disagree with it, in three lists.
 *
 * All three are refusals at the call site; they are separated here because
 * they say different things about what happened. `missing` and `extra` are
 * usually a transport that dropped or added a file; `mismatched` is a file
 * whose bytes are not the bytes that were hashed.
 *
 * `manifest.json` is dropped from `present` rather than reported as `extra`,
 * which is the same exclusion `buildManifest` makes on the way out: it is not
 * a subject of verification in either direction, and a reader that walked a
 * directory honestly would otherwise be told its own manifest was a stray
 * file.
 *
 * `bytes` is deliberately not re-compared — the digest already decides it.
 *
 * **One sort, over the union, rather than one per list.** The three lists are
 * built in a single pass over every path either side names, sorted once with
 * the one comparator. Sorting each list separately would have produced two
 * sorts that can never be the ones to decide — `m.files` is already in this
 * order by construction, so `missing` and `mismatched` would come out sorted
 * whether or not anything sorted them, and a check nothing could notice was
 * gone is a check that is not really there.
 */
export function verifyManifest(m: Manifest, present: readonly ExportFile[]): ManifestVerdict {
  const subject = present.filter((f) => f.path !== MANIFEST_NAME);
  const badPaths = refuseArtefactPaths(subject.map((f) => f.path));
  if (badPaths !== null) {
    throw new Error(revoice(
      'the files found beside this manifest are not one artefact\'s worth',
      badPaths,
      'Nothing was verified.',
    ));
  }

  const listed = new Map(m.files.map((e) => [e.path, e]));
  const onDisk = new Map(subject.map((f) => [f.path, f.bytes]));
  const missing: string[] = [];
  const extra: string[] = [];
  const mismatched: string[] = [];

  for (const path of [...new Set([...listed.keys(), ...onDisk.keys()])].toSorted(comparePaths)) {
    const entry = listed.get(path);
    const found = onDisk.get(path);
    if (entry === undefined) {
      extra.push(path);
      continue;
    }
    if (found === undefined) {
      missing.push(path);
      continue;
    }
    if (createHash('sha256').update(found).digest('hex') !== entry.sha256) {
      mismatched.push(path);
    }
  }

  return { missing, extra, mismatched };
}
