/**
 * Reading an artefact somebody else wrote: sniff the format, take the byte
 * set, verify it against its own manifest, and refuse everything that is not
 * exactly one artefact's worth.
 *
 * ## The order, and why it is the order
 *
 * Sniff → read the byte set → parse and verify `manifest.json` → parse
 * `config.json` → parse each item file → split the history. Nothing is parsed
 * before the manifest has agreed that the bytes are the bytes that were
 * hashed, because a parser is the largest attack surface in this module and
 * running it over unverified input hands a stranger the first move.
 *
 * **A manifest failure is a refusal, never a warning.** An artefact whose
 * bytes did not arrive intact is not partially imported: there is no "import
 * the files that verified" path here and there is deliberately no flag to ask
 * for one. `verification` is carried on the returned `Artefact` for a caller
 * that wants to print what was checked; on a value this function RETURNS all
 * three of its lists are empty, because a non-empty one threw.
 *
 * ## The walk is the one walk in this plan
 *
 * `src/pack/` has exactly one directory traversal and this is it, so it is
 * the one place a path traversal could be introduced. It:
 *
 *   - refuses a symlink **by name and never follows it**. `readArtefact`
 *     reads a stranger's directory, and a link in there pointing at the
 *     importer's own home directory is precisely what an allow-list is for.
 *     Refusing before recursing is also what stops a link to `/` from being
 *     walked in its entirety before anything says no;
 *   - passes every relative path through `refuseArtefactPath` — the same
 *     function the two writers use and the same one `readZip` uses — BEFORE
 *     the file is opened;
 *   - resolves every file it is about to read and refuses one whose real path
 *     lands outside the artefact root.
 *
 * That last check is a second line behind the first, and saying so is more
 * useful than implying it is load-bearing on its own: with symlinks refused,
 * a name `readdirSync` produced cannot leave the root by construction. It is
 * here because "cannot" is a statement about the reparse points Win32
 * REPORTS, and Win32 has more kinds of reparse point than it reports as
 * symbolic links.
 *
 * **Directories are not screened, files are.** The allow-list lives on the
 * file path (`layout.ts` · ` * ## Why the allow-list lives on the PATH` · ~26)
 * and re-expressing it for directory names here would be a second copy of the
 * shape, free to disagree with the first. A directory nobody expected costs
 * one wasted `readdirSync` and is then refused at the first file inside it; a
 * directory with no files in it carries no bytes, so there is nothing in it
 * to drop silently.
 */
import { Buffer } from 'node:buffer';
import { closeSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseItem } from '../core/item.ts';
import type { JsonlRow } from '../core/jsonl-log.ts';
import type { Item } from '../core/types.ts';
import { parseHistory, type PackHistoryRecord } from './history.ts';
import {
  comparePaths, refuseArtefactPath,
  CONFIG_NAME, HISTORY_NAME, ITEMS_DIR, MANIFEST_NAME, type ExportFile,
} from './layout.ts';
import { parseManifest, verifyManifest, type Manifest } from './manifest.ts';
import { readZip } from './zip.ts';

/** The two rungs of the format ladder. There is no third. */
export type ArtefactFormat = 'dir' | 'zip';

/** The three ways an artefact's files can disagree with its manifest. */
export interface ArtefactVerification {
  missing: string[];
  extra: string[];
  mismatched: string[];
}

/**
 * One artefact, read but not yet planned against anything local.
 *
 * `config` is raw JSON — unresolved and unmerged — because merging it is
 * `config-io.ts`'s decision and a reader that resolved it would have taken
 * that decision on a stranger's behalf.
 */
export interface Artefact {
  format: ArtefactFormat;
  /** The path as the caller gave it, so a message can quote what they typed. */
  source: string;
  manifest: Manifest;
  verification: ArtefactVerification;
  items: Item[];
  config: unknown;
  history: PackHistoryRecord[];
  /** History rows this build could not validate. Verbatim, in file order. */
  unknownHistory: JsonlRow[];
}

/** `PK` — the local file header every ZIP begins with. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function refuse(sentence: string): never {
  throw new Error(`my_context: ${sentence}`);
}

/** A refusal from `layout.ts`, re-voiced as a sentence about this artefact. */
function revoice(bad: string): string {
  return bad.replace(/^my_context:\s*/, '');
}

/** Up to `count` bytes from the head of a file, without reading the rest of it. */
function firstBytes(file: string, count: number): Buffer {
  const buffer = Buffer.alloc(count);
  const handle = openSync(file, 'r');
  try {
    return buffer.subarray(0, readSync(handle, buffer, 0, count, 0));
  } finally {
    closeSync(handle);
  }
}

/** `50 4b 03 04` — the bytes as a reader would compare them. */
function hex(bytes: Buffer): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * `'dir'`, `'zip'`, or a throw that says what was found.
 *
 * **It reports rather than guesses**, and the difference is the whole point
 * of the function: "this is not a mycontext export" plus the four bytes that
 * are actually there sends a person to look at the file. A reader that tried
 * the ZIP path on anything that was not a directory would report a corrupt
 * central directory about a Markdown file, which sends them to look for a
 * transfer problem that never happened.
 *
 * The magic number is read from the file's head rather than by loading it:
 * an artefact is as large as a corpus, and a wrong path should not cost the
 * whole file before it is rejected.
 */
export function sniffFormat(source: string): ArtefactFormat {
  if (source === '') {
    refuse('an empty path was given where an artefact was expected. Name the directory or the '
      + '.zip file to read; an empty string would resolve to the working directory, which is '
      + 'never what anyone meant.');
  }
  const found = statSync(source, { throwIfNoEntry: false });
  if (found === undefined) {
    refuse(`there is nothing at ${JSON.stringify(source)}. An artefact is a directory or a ZIP `
      + 'file that already exists; nothing was created and nothing was read.');
  }
  if (found.isDirectory()) return 'dir';
  if (!found.isFile()) {
    refuse(`${JSON.stringify(source)} is not a mycontext export: it is neither a directory nor a `
      + 'regular file. An export is one of those two things and nothing else is opened.');
  }

  const head = firstBytes(source, ZIP_MAGIC.length);
  if (head.equals(ZIP_MAGIC)) return 'zip';

  const printable = [...head].every((b) => b >= 0x20 && b <= 0x7e)
    ? ` (${JSON.stringify(head.toString('latin1'))})`
    : '';
  const saw = head.length === 0
    ? 'the file is empty'
    : `its first ${head.length} bytes are ${hex(head)}${printable}`;
  refuse(`${JSON.stringify(source)} is not a mycontext export — ${saw}, and a mycontext ZIP `
    + `begins ${hex(ZIP_MAGIC)} ("PK"). An export is either a directory or that archive, so `
    + 'nothing here was parsed and nothing was guessed at.');
}

/** True when `candidate` is a path strictly inside `root`. */
function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== ''
    && !path.isAbsolute(relative)
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`);
}

function walk(dir: string, realRoot: string, prefix: string, out: ExportFile[]): void {
  const entries = readdirSync(dir, { withFileTypes: true })
    .toSorted((a, b) => comparePaths(a.name, b.name));

  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const absolute = path.join(dir, entry.name);

    // Before the directory branch, so a link to a directory is refused rather
    // than descended into.
    if (entry.isSymbolicLink()) {
      refuse(`this artefact holds ${JSON.stringify(relative)}, which is a symbolic link. A link `
        + 'is refused by name and is never followed: an artefact is a set of files, and a link '
        + "inside a stranger's directory is an instruction to read something outside it — the "
        + 'importing machine\'s own home directory, for instance. Remove it, or replace it with '
        + 'the file it points at.');
    }
    if (entry.isDirectory()) {
      walk(absolute, realRoot, relative, out);
      continue;
    }
    if (!entry.isFile()) {
      refuse(`this artefact holds ${JSON.stringify(relative)}, which is neither a file nor a `
        + 'directory. An artefact is files; a socket, a pipe or a device node in one is not '
        + 'something to read and is refused by name rather than opened to find out.');
    }

    const bad = refuseArtefactPath(relative);
    if (bad !== null) {
      refuse(`this artefact cannot be read: ${revoice(bad)} Nothing was read — the file was `
        + 'refused by its name, before it was opened.');
    }

    // The second line, behind the symlink refusal above. See the module
    // comment for why it is here and what it is not claiming to be.
    const resolved = realpathSync(absolute);
    if (!within(realRoot, resolved)) {
      refuse(`this artefact's ${JSON.stringify(relative)} resolves to ${JSON.stringify(resolved)}, `
        + `which is outside ${JSON.stringify(realRoot)}. It was refused before it was opened: a `
        + 'file an artefact names must be a file the artefact holds.');
    }

    out.push({ path: relative, bytes: readFileSync(absolute) });
  }
}

/** Every file in an artefact directory, in `comparePaths` order. */
function readDirectoryFiles(source: string): ExportFile[] {
  const realRoot = realpathSync(source);
  const out: ExportFile[] = [];
  walk(source, realRoot, '', out);
  return out.toSorted((a, b) => comparePaths(a.path, b.path));
}

/** `…/artefact/history.jsonl`, or `history.jsonl inside …/artefact.zip`. */
function inside(source: string, format: ArtefactFormat, name: string): string {
  return format === 'dir'
    ? path.join(source, ...name.split('/'))
    : `${name} inside ${source}`;
}

/** One clause per non-empty bucket, or `null` when the artefact verified. */
function disagreement(verdict: ArtefactVerification): string | null {
  const clauses: string[] = [];
  const say = (paths: string[], what: string): void => {
    if (paths.length === 0) return;
    clauses.push(`${paths.length} ${paths.length === 1 ? 'file' : 'files'} ${what} `
      + `(${paths.join(', ')})`);
  };
  say(verdict.missing, 'the manifest lists that are not here');
  say(verdict.extra, 'here that the manifest does not list');
  say(verdict.mismatched, 'whose bytes are not the bytes that were hashed');
  return clauses.length === 0 ? null : clauses.join('; ');
}

/**
 * An artefact at `source`, read whole or not at all.
 *
 * Every refusal below names the artefact and the rule it broke, and none of
 * them leaves a partially-read value behind: this function either returns an
 * `Artefact` whose manifest agreed with its bytes, or it throws.
 */
export function readArtefact(source: string): Artefact {
  const format = sniffFormat(source);
  const files = format === 'dir'
    ? readDirectoryFiles(source)
    : readZip(readFileSync(source));

  const manifestFile = files.find((f) => f.path === MANIFEST_NAME);
  if (manifestFile === undefined) {
    refuse(`${JSON.stringify(source)} carries no ${MANIFEST_NAME}. It was looked for at `
      + `${JSON.stringify(inside(source, format, MANIFEST_NAME))}. That file is the list of every `
      + 'other file in the artefact, so without it there is nothing to check the arriving bytes '
      + 'against — and this build refuses rather than deciding for itself which of the files it '
      + 'found were meant to travel.');
  }
  const manifest = parseManifest(manifestFile.bytes);

  const verification = verifyManifest(manifest, files);
  const disagreed = disagreement(verification);
  if (disagreed !== null) {
    refuse(`${JSON.stringify(source)} does not match its own ${MANIFEST_NAME} and was not read: `
      + `${disagreed}. An artefact whose bytes did not arrive intact is not partially imported. `
      + 'The manifest lets a receiver check the files arrived intact; it says nothing about '
      + 'whether the author is trustworthy.');
  }

  const configFile = files.find((f) => f.path === CONFIG_NAME);
  if (configFile === undefined) {
    refuse(`${JSON.stringify(source)} carries no ${CONFIG_NAME}. It was looked for at `
      + `${JSON.stringify(inside(source, format, CONFIG_NAME))}. Every artefact this product `
      + 'writes carries one — an export projects the whole category block into it and a pack '
      + 'projects the categories its items use — so an artefact without one was written by '
      + 'something else, and what its items mean is then a guess.');
  }
  let config: unknown;
  try {
    config = JSON.parse(configFile.bytes.toString('utf8'));
  } catch (err) {
    refuse(`${JSON.stringify(inside(source, format, CONFIG_NAME))} is not valid JSON: `
      + `${err instanceof Error ? err.message : String(err)}. Its bytes matched the manifest, so `
      + 'this is how it was written rather than damage in transit.');
  }

  // After verification, and after the config: an item file is the largest
  // parser in this product's reach, and it is not run over anything until the
  // manifest has said the bytes are the bytes that were hashed.
  const items: Item[] = [];
  for (const file of files) {
    if (!file.path.startsWith(`${ITEMS_DIR}/`)) continue;
    items.push(parseItem(file.bytes.toString('utf8'), file.path, 'project'));
  }

  // `history.jsonl` is the one root file an artefact may legitimately lack:
  // `buildBundle` writes none when its caller asked for none. Absent is
  // therefore "no history travelled", which is not the same fact as "the
  // history was empty" — but both read back as no records, and nothing
  // downstream can act on the difference.
  const historyFile = files.find((f) => f.path === HISTORY_NAME);
  const history = historyFile === undefined
    ? { records: [], unknown: [] }
    : parseHistory(historyFile.bytes, inside(source, format, HISTORY_NAME));

  return {
    format,
    source,
    manifest,
    verification,
    items,
    config,
    history: history.records,
    unknownHistory: history.unknown,
  };
}
