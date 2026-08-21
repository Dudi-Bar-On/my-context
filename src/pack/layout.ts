/**
 * Where things sit in an exported artefact, and which names are allowed to
 * become paths.
 *
 * Two writers (the canonical directory and the deterministic ZIP), one reader
 * and the manifest all share this module. They share it because two
 * implementations that disagree about sort order produce artefacts that fail
 * to verify, and because an allow-list enforced in one caller is not enforced
 * at all — the second caller is where it stops being true.
 *
 * ## The shape, in full
 *
 *     manifest.json          the integrity list
 *     history.jsonl          the filtered mutation log
 *     config.json            the category projection
 *     items/<type>/<file>.md one file per exported item
 *
 * That is the whole format. There is no fifth root file and no fourth level.
 *
 * ## Why the allow-list lives on the PATH
 *
 * `INV-nothing-is-dropped-silently` cuts both ways: an exporter must not
 * carry what it never meant to, and `.revisions/` holds the text of proposals
 * that were REJECTED — a deny-list that is accurate today ships those to a
 * stranger the first time the product grows a directory nobody remembered to
 * add. So the rule is stated positively: a path is legal when it is one of
 * three named root files or matches the item shape exactly, and everything
 * else is refused whether or not anyone has heard of it.
 *
 * The same list is the traversal guard on the way in. `readArtefact` walks a
 * directory a stranger produced; every relative path it finds passes through
 * `refuseArtefactPath` before it is opened.
 *
 * ## Why so much of this is about Windows
 *
 * A path is a string until something opens it, and Win32 opens several of
 * these strings as a different file from the one the bytes name:
 *
 *   - `C:/items/x.md` is absolute, and a containment check that inspects the
 *     shape of a RELATIVE path cannot see it. That is exactly
 *     `KNOWN-repo-containment-guard-is-defeated-across-windows-drive`, where
 *     `path.relative('D:\\repo', 'C:\\tmp\\x')` returns an absolute path that
 *     is neither `..` nor `../`-prefixed and sails through a guard built to
 *     reject those two spellings. Nothing here computes a relative path at
 *     all: the drive spelling is refused outright, which is the one form of
 *     that check that has no shape left to walk around.
 *   - `items/rule/RULE-a.md:evil` writes to an NTFS alternate data stream
 *     hanging off the item file. The visible file is untouched, no directory
 *     listing shows the payload, and the bytes are on disk.
 *   - `items/rule/CON.md` is the console device, not a file, on every Windows
 *     build to date — with any extension and in any case.
 *   - `items/rule/RULE-a.md ` and `items/rule/RULE-a.md` are ONE file:
 *     CreateFile strips trailing dots and spaces. Two manifest entries, one
 *     file written, and the reader then reports the loser as `missing` for a
 *     reason that names the wrong thing.
 *   - `items/rule/RULE-a.md` and `items/rule/rule-a.md` are one file on NTFS
 *     and on default-configured APFS, and two everywhere else. That one is a
 *     property of the SET, not of either path, which is why
 *     `refuseArtefactPaths` exists beside the singular form.
 *
 * None of these is visible to a comparison of path strings, and every one of
 * them lands a stranger's bytes somewhere the importer did not agree to.
 *
 * ## What this module is NOT
 *
 * It guards the paths INSIDE an artefact. It does not guard where an item is
 * written on import: `applyImport` builds `items/<type>/<id>.md` from the
 * item's own frontmatter, not from the artefact path it arrived under, and
 * neither `type` nor `id` is validated by any grammar in `core/`. That is a
 * separate boundary and it belongs to the importer, not here.
 */
import { Buffer } from 'node:buffer';

/** The artefact protocol, carried in `manifest.json`. */
export const PACK_PROTOCOL = 'my_context/pack@1';
/** The protocol every line of a travelling `history.jsonl` carries. */
export const PACK_HISTORY_PROTOCOL = 'my_context/pack-history@1';
/** The protocol imported history carries once it has landed locally. */
export const IMPORTED_PROTOCOL = 'my_context/imported@1';
/** The wrapper protocol for a history row this build could not validate. */
export const IMPORTED_UNKNOWN_PROTOCOL = 'my_context/imported-unknown@1';
/** The protocol of `.audit/imported/<pack>/import.json`. */
export const IMPORT_RECORD_PROTOCOL = 'my_context/pack-import@1';

/**
 * The `.audit` subdirectory a stranger's history lands in, and the one inside
 * it that holds rows this build could not validate.
 *
 * They are here rather than in `imported-audit.ts` because two modules name
 * them and only one of them builds paths: the collision report prints
 * `.audit/imported/<pack>/` as part of telling a person where the history
 * will go, and `imported-audit.ts` puts it there. A directory the report
 * names and the writer spells differently is a report that sends someone to
 * an empty directory.
 */
export const IMPORTED_DIR = 'imported';
export const UNKNOWN_PACK_DIR = 'unknown';

export const MANIFEST_NAME = 'manifest.json';
export const HISTORY_NAME = 'history.jsonl';
export const CONFIG_NAME = 'config.json';
export const ITEMS_DIR = 'items';
export const ITEM_EXTENSION = '.md';

/**
 * The only files an artefact may hold at its root — the whole list, matched
 * byte for byte. `Manifest.json` is not one of them even on a filesystem that
 * would open it: an artefact whose root file names depend on the reader's
 * filesystem is not a format.
 */
export const ROOT_FILES: readonly string[] = [MANIFEST_NAME, HISTORY_NAME, CONFIG_NAME];

/** One file on its way into or out of an artefact. */
export type ExportFile = { path: string; bytes: Buffer };

/**
 * `export` carries the corpus and its provenance; `pack` is the portable
 * artefact and drops the fields that name the author's own repository.
 */
export type ArtefactKind = 'export' | 'pack';

/**
 * The ONE comparator. Both writers sort with it and the manifest is built in
 * its order, so an artefact's byte layout does not depend on which of them
 * produced it.
 *
 * UTF-8 bytes rather than `String.prototype.localeCompare` or a bare `<`,
 * and the difference is reachable rather than theoretical: JavaScript's
 * default comparison orders by UTF-16 code UNITS, so an astral character
 * (U+1D400, a surrogate pair beginning D835) sorts BEFORE a high BMP
 * character (U+FF21) while its UTF-8 encoding (F0 …) sorts after (EF …). A
 * ZIP central directory sorted one way and a manifest sorted the other are
 * two files that disagree about the same artefact.
 */
export function comparePaths(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * The Win32 device names, which are resolved BEFORE the filesystem sees a
 * path and therefore cannot be escaped by any directory prefix: `items/rule/
 * CON.md` opens the console. Matched case-insensitively against the segment
 * up to its first `.`, because the extension is not consulted either.
 *
 * `COM0`/`LPT0` and the superscript spellings `COM\u00b9`, `COM\u00b2` and
 * `COM\u00b3` are included although the classic list omits them: they are
 * reserved on some builds, nobody names an item after one, and over-blocking
 * costs a rename while under-blocking costs a write to a device.
 */
const WIN32_DEVICES = new Set([
  'CON', 'PRN', 'AUX', 'NUL', 'CONIN$', 'CONOUT$',
  'COM0', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT0', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  'COM\u00b9', 'COM\u00b2', 'COM\u00b3', 'LPT\u00b9', 'LPT\u00b2', 'LPT\u00b3',
]);

/** C0 and C1 controls, and DEL. A NUL truncates a path in every C API. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Reserved by Win32 in a file name. `/`, `\` and `:` are handled by name. */
const WIN32_FORBIDDEN = /["*<>?|]/;

/** `C:/x`, `c:x`, `Z:\x` — a drive-qualified path in any of its spellings. */
const DRIVE_LETTER = /^[A-Za-z]:/;

/**
 * 255 UTF-8 bytes, which is the name limit on ext4, on APFS and on NTFS —
 * NTFS counts 255 UTF-16 units, so bytes is the stricter reading for every
 * non-ASCII name and the identical one for ASCII. A path that cannot be
 * written is better refused by name than discovered as an ENAMETOOLONG from
 * inside a writer half-way through a tree.
 */
const MAX_SEGMENT_BYTES = 255;

function refusal(p: string, sentence: string): string {
  return `my_context: artefact path ${JSON.stringify(p)} ${sentence}`;
}

/**
 * `null` when the path may appear in an artefact, otherwise one
 * `my_context:`-prefixed sentence naming the path and the rule it broke.
 *
 * The checks run in three groups, and the order is what makes the messages
 * worth reading — because almost every rule below is ALSO caught by the
 * allow-list shape one step later, so which check fires decides only what the
 * refusal SAYS, and a refusal that says the wrong thing sends the author to
 * fix the wrong thing.
 *
 * **Group A — this string does not denote a file inside the artefact.**
 * Absolute spellings, separators, `..`, a colon, a control character, a
 * reserved device, a trailing dot or space, a non-NFC encoding. Every one is
 * a fact about how a NAME RESOLVES, not about shape, and each must be named
 * as itself: "does not end in .md" is a useless thing to say about
 * `C:/items/x.md`, and "not Markdown" hides that `items/rule/CON.md` is the
 * console.
 *
 * **Group B — the allow-list shape.** Three root files, or exactly
 * `items/<type>/<file>.md`. This is where `.revisions/…` is refused, and it
 * is refused for being outside the allow-list rather than for beginning with
 * a dot: the message has to say that nothing else travels, because that is
 * the rule, and "it starts with a dot" invites an author to rename it.
 *
 * **Group C — what is left, on a path whose shape is already legal.** A
 * dot-prefixed segment and a segment too long to write.
 */
export function refuseArtefactPath(p: string): string | null {
  // --- Group A: this is not a relative POSIX path -------------------------
  if (p === '') {
    return refusal(p, 'is empty. Every file in an artefact is named.');
  }
  // The drive check runs BEFORE the separator check: `Z:\items\x.md` breaks
  // both rules, and "it is absolute and leaves the artefact" is the fact
  // worth reporting — "use forward slashes" reads like a formatting note
  // about a path that points at another volume.
  if (DRIVE_LETTER.test(p)) {
    return refusal(p, 'names a Windows drive letter, so it is absolute and points outside '
      + 'the artefact. Artefact paths are relative to the artefact root.');
  }
  if (p.includes('\\')) {
    return refusal(p, 'contains a backslash, which is a path separator on Windows. '
      + 'Artefact paths are POSIX and separate with "/" on every platform.');
  }
  if (p.includes(':')) {
    return refusal(p, 'contains a colon, which on NTFS opens an alternate data stream '
      + 'rather than a file — the payload would be invisible to a directory listing.');
  }
  if (CONTROL_CHARS.test(p)) {
    return refusal(p, 'contains a control character. A NUL truncates a path in every C API, '
      + 'so the file that opens is not the file the name describes.');
  }
  if (p.startsWith('/')) {
    return refusal(p, 'begins with "/", so it is absolute and points outside the artefact.');
  }
  if (p.endsWith('/')) {
    return refusal(p, 'ends with "/", which names a directory. An artefact lists files.');
  }

  const segments = p.split('/');
  for (const seg of segments) {
    if (seg === '') {
      return refusal(p, 'has an empty path segment. Two separators in a row do not name '
        + 'anything, and what a reader resolves them to is its own business.');
    }
    if (seg === '..') {
      return refusal(p, 'has a ".." segment, which walks out of the artefact.');
    }
    if (seg === '.') {
      return refusal(p, 'has a "." segment. An artefact path is already relative to the '
        + 'artefact root and is written without one.');
    }
    // The next three are grouped with the escapes rather than with the
    // hygiene below because they are facts about NAME RESOLUTION, not about
    // shape: Win32 rewrites or reroutes each of these before the filesystem
    // is consulted at all. Reporting `items/rule/CON.md` as "not Markdown"
    // would be true and would hide the fact worth knowing.
    if (seg.endsWith('.') || seg.endsWith(' ')) {
      return refusal(p, `has a segment with a trailing dot or space (${JSON.stringify(seg)}). `
        + 'Win32 strips both when it opens the file, so this names the same file as the '
        + 'segment without them — two entries, one file, and one of them silently lost.');
    }
    if (WIN32_FORBIDDEN.test(seg)) {
      return refusal(p, 'has a segment containing a character Windows reserves in a file name '
        + `(${JSON.stringify(seg)}): one of " * < > ? |.`);
    }
    if (WIN32_DEVICES.has((seg.split('.')[0] as string).toUpperCase())) {
      return refusal(p, 'has a segment naming a reserved Windows device '
        + `(${JSON.stringify(seg)}). Win32 resolves it before the filesystem sees the path, with `
        + 'any extension and in any case, so it opens a device rather than a file.');
    }
  }
  if (p.normalize('NFC') !== p) {
    return refusal(p, 'is not in Unicode NFC. One name must have exactly one spelling: the '
      + 'decomposed and composed forms are different bytes, so the manifest, the archive and '
      + `the filesystem would disagree about the same file. Write it as ${JSON.stringify(p.normalize('NFC'))}.`);
  }

  // --- Group B: the allow-list shape --------------------------------------
  if (segments.length === 1) {
    if (ROOT_FILES.includes(p)) return null;
    return refusal(p, `is not one of the artefact's root files (${ROOT_FILES.join(', ')}) and is `
      + `not under "${ITEMS_DIR}/". Nothing else travels — this is an allow-list, so a file is `
      + 'excluded until someone adds it deliberately.');
  }
  if (segments[0] !== ITEMS_DIR) {
    if (segments[0]?.toLowerCase() === ITEMS_DIR) {
      return refusal(p, `differs from "${ITEMS_DIR}/" only by case. On Windows and on default `
        + `macOS that is the same directory and on Linux it is not, so it is refused rather `
        + `than resolved. Write "${ITEMS_DIR}/".`);
    }
    return refusal(p, `is not under "${ITEMS_DIR}/" and is not one of the artefact's root files `
      + `(${ROOT_FILES.join(', ')}). Nothing else travels — this is an allow-list, so a file is `
      + 'excluded until someone adds it deliberately.');
  }
  if (segments.length !== 3) {
    return refusal(p, `is under "${ITEMS_DIR}/" but is not "${ITEMS_DIR}/<type>/<file>`
      + `${ITEM_EXTENSION}". An item file has exactly that shape, so an artefact never asks a `
      + 'reader to create a directory tree of a stranger\'s choosing.');
  }
  const name = segments[2] as string;
  // No `name.length === ITEM_EXTENSION.length` clause guarding a bare ".md":
  // that segment begins with a dot and is refused a few lines below, and a
  // condition that can never be the one to decide is exactly the kind of
  // check a mutation run reports as surviving because nothing could ever
  // notice it was gone.
  if (!name.endsWith(ITEM_EXTENSION)) {
    return refusal(p, `does not name a Markdown file. Under "${ITEMS_DIR}/" every file is an `
      + `item and ends in "${ITEM_EXTENSION}" — Markdown is the source of truth, and a file the `
      + 'item parser cannot read has no meaning inside an artefact.');
  }

  // --- Group C: per-segment hygiene on a legal shape -----------------------
  for (const seg of segments) {
    if (seg.startsWith('.')) {
      return refusal(p, `has a segment beginning with "." (${JSON.stringify(seg)}). A category `
        + 'and an item id never do, and a dot-prefixed name is how a directory hides.');
    }
    const bytes = Buffer.byteLength(seg, 'utf8');
    if (bytes > MAX_SEGMENT_BYTES) {
      return refusal(p, `has a segment of ${bytes} UTF-8 bytes (${JSON.stringify(seg.slice(0, 24))}`
        + `…), and ${MAX_SEGMENT_BYTES} is the limit every filesystem this runs on imposes. It `
        + 'could not be written.');
    }
  }

  return null;
}

/**
 * The same rules over a whole artefact, plus the two properties no single
 * path can have: no path appears twice, and no two paths collide on a
 * case-insensitive filesystem.
 *
 * **Why the set-level check is not optional.** `items/rule/RULE-a.md` and
 * `items/rule/rule-a.md` are each perfectly legal, and on NTFS or default
 * APFS they are one file. Writing the pair produces a tree with one fewer
 * file than the manifest lists; reading it back reports the loser as
 * `missing` and refuses the artefact, blaming corruption for what is
 * actually a name collision. Refusing the pair up front names the real
 * problem, and it names both paths, because a refusal that names one of two
 * colliding names is half a refusal.
 *
 * `toLowerCase` over-approximates Win32's fixed case table (it folds pairs
 * Win32 leaves distinct), and over-approximating is the safe direction here:
 * the cost is a rename, and the alternative is a lost file.
 *
 * **Directories collide too, and that one is easy to miss.**
 * `items/rule/RULE-a.md` and `items/RULE/RULE-b.md` name two different files
 * under two spellings of ONE directory. Both files are written, so nothing is
 * lost — but one of them lands under a directory name the manifest does not
 * use, and the reader then reports it as `extra` while the path the manifest
 * does name is `missing`. The artefact verifies on Linux and fails on
 * Windows, which is the worst available outcome: it is the author who cannot
 * reproduce it.
 *
 * Normalisation collisions cannot reach this check, because a non-NFC path is
 * already refused one at a time — which is the point of requiring NFC rather
 * than merely comparing normalised forms here.
 */
export function refuseArtefactPaths(paths: readonly string[]): string | null {
  const files = new Map<string, string>();
  /** folded directory prefix -> the first path that introduced that spelling */
  const dirs = new Map<string, { spelling: string; path: string }>();

  for (const p of paths) {
    const bad = refuseArtefactPath(p);
    if (bad !== null) return bad;

    const folded = p.toLowerCase();
    const first = files.get(folded);
    if (first === p) {
      return `my_context: artefact path ${JSON.stringify(p)} is listed twice. An artefact names `
        + 'each file once, so that its manifest and its contents can be compared entry for entry.';
    }
    if (first !== undefined) {
      return `my_context: artefact paths ${JSON.stringify(first)} and ${JSON.stringify(p)} differ `
        + 'only by case. On Windows and on default macOS they are the same file, so one would '
        + 'overwrite the other and the artefact would arrive with a file missing.';
    }
    files.set(folded, p);

    const segments = p.split('/');
    for (let i = 1; i < segments.length; i += 1) {
      const prefix = segments.slice(0, i).join('/');
      const held = dirs.get(prefix.toLowerCase());
      if (held === undefined) {
        dirs.set(prefix.toLowerCase(), { spelling: prefix, path: p });
        continue;
      }
      if (held.spelling !== prefix) {
        return `my_context: artefact directories ${JSON.stringify(held.spelling)} `
          + `(from ${JSON.stringify(held.path)}) and ${JSON.stringify(prefix)} `
          + `(from ${JSON.stringify(p)}) differ only by case. On Windows and on default macOS `
          + 'they are one directory, so one of the two files would arrive under a path the '
          + 'manifest does not name and the artefact would fail to verify there and nowhere else.';
      }
    }
  }
  return null;
}
