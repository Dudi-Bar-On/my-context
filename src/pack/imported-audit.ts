/**
 * Where a stranger's history lands, and what is counted.
 *
 * ## Two walls, and why one would not do
 *
 * A pack's history is somebody else's record of somebody else's corpus. It
 * must be readable — it is half the value of a pack — and it must never be
 * read as though it happened here. Two independent things keep it apart from
 * the local audit log, and neither is a convention:
 *
 *  1. **A subdirectory.** The live enumerator lists ONE directory and matches
 *     two name shapes (`core/audit.ts` ·
 *     `const SEGMENT_PATTERN = /^audit\.[0-9TZ]+-\d+\.jsonl$/;` · ~439, plus
 *     the literal `audit.jsonl`), so everything under `.audit/imported/` is
 *     invisible to it. Not filtered out — never listed.
 *  2. **A protocol.** Every line written here carries `IMPORTED_PROTOCOL`,
 *     which is not in `AUDIT_PROTOCOLS_READ`, and `parseJsonlLog` refuses an
 *     unaccepted protocol on EVERY line, torn tail included. So a stray copy
 *     of one of these files into `.audit/` is refused on line 1 rather than
 *     silently merged into the workspace's own history.
 *
 * Either wall alone would pass a test of the other, which is why the tests
 * assert them separately. Both are cheap and neither depends on a caller
 * remembering anything.
 *
 * ## What is quarantined, and what "nothing dropped" means here
 *
 * A pack may be written by a newer build. A history row whose `op` this build
 * has never heard of is version skew, not damage, so it is neither refused
 * (which would take the whole file with it) nor accepted (this build cannot
 * say what it means). It is WRAPPED — the original object carried verbatim
 * under `record`, beside the line of the artefact it was on — filed under
 * `.audit/imported/unknown/`, and COUNTED. The count is returned rather than
 * logged, because the caller has to report it: a quarantine nobody is told
 * about is a silent drop with extra steps.
 *
 * Nothing here validates the wrapped row. It is not ours to validate, and
 * rewriting it into a shape this build recognises would be inventing content
 * on a stranger's behalf.
 *
 * ## A pack name is not a key, and it is not a path either
 *
 * The name arrives from a stranger and is turned into a directory, so the two
 * ways it could stop naming its own directory are refused rather than
 * resolved: a name that slugs to nothing has no directory to be, and a name
 * that slugs to `unknown` would share the quarantine's. Both refusals name
 * the name and say what to do. `normalizeForSlug` (`core/slug.ts` ·
 * `export function normalizeForSlug(title: string): string {` · ~20) does the
 * rest — it is the same normalisation ids get, so the mapping from a pack
 * name to a directory is one a reader of this product already knows.
 *
 * That is not enough on its own, and for two years of this module's life it
 * was all there was. A name is text a THIRD PARTY chose, and nothing stops a
 * second pack from choosing what the first one did: filed by name alone, the
 * second import's `import.json` landed on top of the first's and took a
 * membership list with it — the only record of which items that pack brought
 * in, read by `pack list`, by `review promote --all --pack` and by the packs
 * screen. Nobody was told, and there was nothing left to reconstruct it from.
 *
 * So an import is filed under a KEY with two halves (`PackKey`): the name,
 * which is legible and is the parent directory, and the ORIGIN — the artefact
 * location this workspace resolved — which is the leaf and is the half that
 * decides identity. The receiver's own fact decides; the stranger's text only
 * labels. A key derived from attacker-controlled text is this bug twice.
 *
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditDir } from '../core/audit.ts';
import {
  appendJsonlLine, ensureLogDir, parseJsonlLog,
  type JsonlLogSpec, type JsonlRow,
} from '../core/jsonl-log.ts';
import { normalizeForSlug } from '../core/slug.ts';
import type { Origin } from '../core/types.ts';
import type { PackHistoryRecord, UnknownHistoryRow } from './history.ts';
import {
  comparePaths, IMPORT_RECORD_PROTOCOL, IMPORTED_DIR, IMPORTED_PROTOCOL,
  IMPORTED_UNKNOWN_PROTOCOL, UNKNOWN_PACK_DIR, type ArtefactKind,
} from './layout.ts';

/** The file each pack's imported history is appended to. */
const HISTORY_FILE = 'history.jsonl';
/** The one file every quarantined row from every pack is appended to. */
const QUARANTINE_FILE = 'quarantine.jsonl';
/** The membership record `pack list` and `review promote --all --pack` read. */
const RECORD_FILE = 'import.json';

function refuse(sentence: string): never {
  throw new Error(`my_context: ${sentence}`);
}

/** `<root>/.audit/imported` — every pack's history, and the quarantine. */
export function importedDir(root: string): string {
  return path.join(auditDir(root), IMPORTED_DIR);
}

/** `<root>/.audit/imported/unknown` — rows this build could not validate. */
export function unknownDir(root: string): string {
  return path.join(importedDir(root), UNKNOWN_PACK_DIR);
}

/**
 * The two facts that identify ONE import, and the reason there have to be two.
 *
 * `name` is a string a STRANGER chose — it arrives in the artefact's manifest,
 * or is retyped from it into `--name`, and nothing stops a second pack from
 * calling itself what the first one did. `origin` is the receiver's own fact:
 * the artefact location this workspace read, resolved. Only the pair says
 * which import a record belongs to.
 *
 * `source` is the same location as the operator TYPED it, carried alongside
 * rather than derived from `origin`, because it is what `pack list` prints and
 * what the legacy directories below were filed with. See `packDirFor`.
 */
export interface PackKey {
  name: string;
  /** The resolved artefact location. Not printed; hashed into the directory. */
  origin: string;
  /** The path as the caller typed it, recorded verbatim in the record. */
  source: string;
}

/**
 * How many hex characters of the origin digest name a directory.
 *
 * 16 hex characters is 64 bits, which is not a collision resistance claim and
 * is not doing one: this is a directory name for the artefact locations ONE
 * workspace has imported from, a set with tens of members, and the whole
 * digest would make a path nobody can read beside a slug that is already 60
 * characters wide. The digest is over a path this workspace resolved, so there
 * is no adversary choosing preimages for it — the name a stranger chose is the
 * PARENT directory, and the parent cannot decide identity any more.
 */
const ORIGIN_KEY_CHARS = 16;

/**
 * `origin` reduced to a directory name — the second half of the key.
 *
 * SHA-256 rather than `normalizeForSlug`, because a path is not a title: two
 * different absolute paths slug to one name constantly (`/a/pack` and
 * `/a-pack`), and a slug of a path is exactly the collision this module is
 * here to stop, moved one directory down.
 */
export function originKey(origin: string): string {
  return createHash('sha256').update(origin, 'utf8').digest('hex').slice(0, ORIGIN_KEY_CHARS);
}

/**
 * `<root>/.audit/imported/<slug>/<origin>` — one IMPORT's own directory.
 *
 * ## Why the name alone was not a key, and what it is now
 *
 * This used to be `<root>/.audit/imported/<slug>` and nothing else. The slug is
 * made from the pack's OWN name, so two packs that call themselves the same
 * thing named one directory: the second import's `import.json` landed on top of
 * the first's, and the first pack's membership list — the only record of which
 * items it brought in, and the list `review promote --all --pack` and the packs
 * screen read — was gone with nobody told. Their two histories were appended to
 * ONE `history.jsonl`, every row tagged with the one name they shared, so a
 * reader could no longer tell whose mutation was whose either.
 *
 * The name is still the parent directory, because it is what a person reads.
 * It no longer DECIDES anything: identity is the leaf, and the leaf is a digest
 * of the location this workspace read the artefact from. So two packs sharing a
 * name are two directories under one legible parent, and a re-import of the
 * same pack from the same place is the same leaf — which is what makes a
 * re-import an update rather than a second record.
 *
 * Throws rather than inventing a directory for a name that cannot have one.
 * Both cases are reachable from a stranger's `manifest.json`: `refusePackName`
 * (manifest.ts) accepts any non-empty printable string, so `"!!!"` and
 * `"unknown"` both arrive here as legitimate pack names.
 */
export function packDir(root: string, key: PackKey): string {
  const slug = normalizeForSlug(key.name);
  if (slug === '') {
    refuse(`the pack name ${JSON.stringify(key.name)} contains no letter or digit, so it names no `
      + 'directory. A pack\'s history is filed under a directory made from its name, and a name '
      + 'that slugs to nothing would file it under the empty string — which is the imported '
      + 'directory itself, where the next pack would land on top of it. Give the pack a name '
      + 'with a word in it.');
  }
  if (slug === UNKNOWN_PACK_DIR) {
    refuse(`the pack name ${JSON.stringify(key.name)} slugs to ${JSON.stringify(UNKNOWN_PACK_DIR)}, `
      + 'which is the directory this build files history rows it could not validate under. Two '
      + 'writers in one directory is not something to resolve quietly — a reader could no longer '
      + 'tell this pack\'s records from the quarantine. Rename the pack.');
  }
  return path.join(importedDir(root), slug, originKey(key.origin));
}

/**
 * The directory this import's records ACTUALLY go in — `packDir`, unless a
 * record written by an older build is already sitting at `<slug>/import.json`
 * for this same artefact.
 *
 * ## The migration, stated
 *
 * A record filed before the key had two halves lives at `<slug>/import.json`,
 * beside a `<slug>/history.jsonl`. Nothing here moves it, renames it or
 * rewrites it. Rekeying history quietly would be this defect's own shape a
 * second time — a record whose path says one thing and whose bytes were
 * written under another rule — and it would do it to the only records that
 * cannot be re-derived from anything.
 *
 * So legacy records stay exactly where they are and `readImportRecords` keeps
 * listing them. A re-import of the SAME artefact ADOPTS the legacy directory
 * and updates the record in place, which is what a re-import has always done;
 * a DIFFERENT artefact under that name gets its own leaf and cannot touch it.
 * "The same artefact" is decided on the one field the legacy record carries
 * that says where it came from: `source`, matched verbatim, exactly as it is
 * printed by `pack list`. A newer record carries `origin` too and is matched on
 * that first, because it is the resolved location and does not depend on how
 * the operator spelled the path.
 *
 * The consequence, and it is disclosed rather than hidden: a legacy pack
 * re-imported from a DIFFERENTLY SPELLED path to the same file is filed under
 * its own leaf, and `pack list` then shows two rows for what one person would
 * call one pack. Two rows naming two sources is a state a reader can see and
 * act on. One row that quietly replaced the other is not, and that is the whole
 * defect.
 */
export function packDirFor(root: string, key: PackKey): string {
  const legacy = path.join(importedDir(root), normalizeForSlug(key.name));
  const held = readRecordAt(path.join(legacy, RECORD_FILE));
  if (held !== null && (held.origin === key.origin
    || (held.origin === undefined && held.source === key.source))) {
    return legacy;
  }
  return packDir(root, key);
}

/**
 * One imported history line: the record as it travelled, restamped.
 *
 * The ONE object literal that fixes the key order — the same construction
 * `canonicalRecord` uses in `history.ts`, for the same reason: `JSON.stringify`
 * follows insertion order, so the format may not depend on the order a caller
 * happened to assemble a record in. A key whose value is `undefined` is not
 * written at all rather than written as `undefined`.
 */
export interface ImportedRecord {
  protocol: typeof IMPORTED_PROTOCOL;
  /** Which pack this row came from. The reason one directory could hold many. */
  pack: string;
  at: string;
  kind: 'mutation';
  op: string;
  origin?: Origin;
  itemId?: string;
  fields?: string[];
  note?: string;
}

function imported(pack: string, r: PackHistoryRecord): ImportedRecord {
  return {
    protocol: IMPORTED_PROTOCOL,
    pack,
    at: r.at,
    kind: r.kind,
    op: r.op,
    ...(r.origin === undefined ? {} : { origin: r.origin }),
    ...(r.itemId === undefined ? {} : { itemId: r.itemId }),
    ...(r.fields === undefined ? {} : { fields: [...r.fields] }),
    ...(r.note === undefined ? {} : { note: r.note }),
  };
}

/** One history row this build could not validate, wrapped and never rewritten. */
export interface QuarantinedRow {
  protocol: typeof IMPORTED_UNKNOWN_PROTOCOL;
  pack: string;
  at: string;
  /** The file inside the artefact the row came from. */
  source: string;
  /**
   * The PHYSICAL line of `source` this row is on, 1-based — the line a person
   * lands on when they open the artefact they still have and go there.
   *
   * It used to be the row's position among the rows the reader handed over,
   * which is a different number wearing the same name: two rows quarantined
   * out of a forty-one-line file were 1 and 2 here, and a reader told "line 1"
   * opened the file and found a row this build had read without complaint.
   * `parseHistory` now carries the true line (`pack/history.ts` ·
   * `export interface UnknownHistoryRow {`), and this field is that line and
   * nothing else.
   *
   * `null` when the reader could not establish it. The key is still written,
   * because an absent key reads as an older build that never had the field
   * while `null` says this build looked and could not tell — and either of
   * those is honest in a way a made-up number is not.
   */
  line: number | null;
  /** The original object, verbatim. */
  record: JsonlRow;
}

/**
 * Creates one directory under `.audit/imported/`, and the imported directory
 * above it, each with its own `*` .gitignore.
 *
 * EVERY level, not just the leaf: an empty pack directory — or the imported
 * directory before any pack has landed in it — is still not offered to git.
 * `.audit/` already carries a .gitignore of its own and this deliberately does
 * not lean on it, because a .gitignore one level up is a fact about the
 * parent, and a directory that is moved or copied out takes its own with it.
 *
 * The name directory between them is walked for the same reason and not
 * because it is new: `mkdirSync(…, { recursive: true })` inside `ensureLogDir`
 * would create it silently and leave it the one level of this tree with no
 * .gitignore of its own.
 */
function ensure(root: string, dir: string): string {
  const imported = ensureLogDir(importedDir(root));
  const parent = path.dirname(dir);
  if (parent !== imported && parent.startsWith(imported)) ensureLogDir(parent);
  return ensureLogDir(dir);
}

/**
 * Files `records` under this pack's own directory, one JSON object per line.
 *
 * Appends rather than replaces: re-importing a pack after new items were
 * added to it should not erase what the first import filed. The records
 * carry `at` and `op`, so a duplicate pair is recognisable, and a history
 * that repeats a record is a smaller problem than one that loses it.
 */
export function writeImportedHistory(
  root: string, key: PackKey, records: readonly PackHistoryRecord[],
): void {
  const dir = ensure(root, packDirFor(root, key));
  const file = path.join(dir, HISTORY_FILE);
  for (const r of records) appendJsonlLine(dir, file, imported(key.name, r));
}

/**
 * Wraps every row, files it under `.audit/imported/unknown/`, and returns how
 * many — which the caller must report.
 *
 * `now` is injectable so a test can pin the stamp; production passes nothing
 * and gets the wall clock, exactly as `recordAudit` does.
 */
export function quarantine(
  root: string, key: PackKey, rows: readonly UnknownHistoryRow[], source: string,
  now: string = new Date().toISOString(),
): number {
  if (rows.length === 0) return 0;
  const dir = ensure(root, unknownDir(root));
  const file = path.join(dir, QUARANTINE_FILE);
  for (const row of rows) {
    // `row.line` is passed through and never defaulted or renumbered. The
    // reader is the only thing that saw the bytes, so it is the only thing
    // that can say where a row was; anything invented here would be a number
    // this function made up about a file it never opened.
    const wrapped: QuarantinedRow = {
      protocol: IMPORTED_UNKNOWN_PROTOCOL,
      pack: key.name,
      at: now,
      source,
      line: row.line,
      record: row.row,
    };
    appendJsonlLine(dir, file, wrapped);
  }
  return rows.length;
}

/** The shared JSONL spec, over one of the two files this module writes. */
function specFor(file: string, protocol: string, what: string): JsonlLogSpec {
  return {
    file,
    protocol,
    validate: (row: JsonlRow): string | null => {
      if (typeof row.pack !== 'string') return 'is missing or mistypes "pack"';
      if (typeof row.at !== 'string') return 'is missing or mistypes "at"';
      return null;
    },
    refuse: (line: number, reason: string): Error => new Error(
      `my_context: the ${what} at ${file} cannot be read — line ${line} ${reason}. This file is `
      + 'written by this build and read by nothing else, so a line it cannot read is damage or a '
      + 'hand edit rather than version skew. It is refused rather than skipped: a record set '
      + 'aside from an import is exactly the thing that must not go quiet a second time.',
    ),
    unreadable: (err: unknown): Error => new Error(
      `my_context: the ${what} at ${file} could not be read: `
      + `${err instanceof Error ? err.message : String(err)}`,
    ),
  };
}

/** One file's rows, or `[]` when it has never been written. */
function rowsOf(file: string, spec: JsonlLogSpec): JsonlRow[] {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw spec.unreadable(err);
  }
  return parseJsonlLog(raw, spec);
}

/** One import's history, in the order it was filed. */
export function readImportedHistory(root: string, key: PackKey): ImportedRecord[] {
  const file = path.join(packDirFor(root, key), HISTORY_FILE);
  return rowsOf(
    file, specFor(file, IMPORTED_PROTOCOL, 'imported history'),
  ) as unknown as ImportedRecord[];
}

/** Every quarantined row, from every pack, in the order it was filed. */
export function readQuarantine(root: string): QuarantinedRow[] {
  const file = path.join(unknownDir(root), QUARANTINE_FILE);
  const spec = specFor(file, IMPORTED_UNKNOWN_PROTOCOL, 'import quarantine');
  return rowsOf(file, spec) as unknown as QuarantinedRow[];
}

/**
 * What one import did, as a whole — the membership list included.
 *
 * `items` is what makes bulk promotion possible without tagging an item:
 * `review promote --all --pack <name>` reads it. A tag would have changed the
 * items' content hashes, which would have made every one of them `changed`
 * against the pack it came from on the next import.
 */
export interface ImportRecord {
  protocol: typeof IMPORT_RECORD_PROTOCOL;
  pack: string;
  version: string;
  kind: ArtefactKind;
  /** The path as the caller typed it. Printed by `pack list`; never parsed. */
  source: string;
  /**
   * The same location resolved — the half of this record's key that a stranger
   * did not choose, and the directory this record sits in is its digest.
   *
   * `undefined` on a record written before the key had two halves. That is
   * read as "an older build that never had the field", never as an empty
   * origin: `packDirFor` falls back to matching `source` for exactly those,
   * and rewriting them to add this would be rekeying history to make a lookup
   * tidier.
   */
  origin?: string;
  importedAt: string;
  manifestFiles: number;
  /** Every id this import placed in the corpus, sorted with the comparator. */
  items: string[];
  historyRecords: number;
  quarantined: number;
}

/**
 * Writes this import's `import.json` and returns its path.
 *
 * The directory is `packDirFor`'s and not `packDir`'s, so a re-import of an
 * artefact filed by an older build updates that record where it stands instead
 * of leaving it behind as a second row nobody can account for.
 *
 * Two-space JSON with one trailing newline, every key always present, written
 * from one object literal so the key order is the format's and not the
 * caller's. `items` is sorted here rather than trusted from the caller, for
 * the same reason the manifest sorts its own file list: two runs of the same
 * import must produce the same bytes.
 *
 * `origin` is required BY THE PARAMETER TYPE for a record being written and
 * optional on one being read, and the asymmetry is deliberate: this build has
 * always got one, and a record it wrote without one would be a legacy record
 * this build had just created.
 */
export function writeImportRecord(
  root: string, record: ImportRecord & { origin: string },
): string {
  const key: PackKey = { name: record.pack, origin: record.origin, source: record.source };
  const file = path.join(ensure(root, packDirFor(root, key)), RECORD_FILE);
  const document = {
    protocol: IMPORT_RECORD_PROTOCOL,
    pack: record.pack,
    version: record.version,
    kind: record.kind,
    source: record.source,
    origin: record.origin,
    importedAt: record.importedAt,
    manifestFiles: record.manifestFiles,
    items: [...record.items].toSorted(comparePaths),
    historyRecords: record.historyRecords,
    quarantined: record.quarantined,
  };
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * One `import.json`, parsed — or `null` when there is no file there.
 *
 * The two ways a file that IS there can be unreadable both throw, and neither
 * is softened to `null`: this file is written by this build, so bad JSON is
 * damage or a hand edit, and an unexpected protocol is version skew. Either
 * one answered as "no record here" would hide a pack whose items nothing would
 * ever offer to promote — which is the same silence this module was rebuilt to
 * end, wearing a different hat.
 */
function readRecordAt(file: string): ImportRecord | null {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`my_context: the import record at ${file} is not valid JSON: `
      + `${err instanceof Error ? err.message : String(err)}. It was written by this build, so `
      + 'this is damage or a hand edit rather than something that arrived in a pack.');
  }
  const row = parsed as { protocol?: unknown };
  if (row.protocol !== IMPORT_RECORD_PROTOCOL) {
    throw new Error(`my_context: the import record at ${file} declares protocol `
      + `${JSON.stringify(row.protocol)}, expected ${JSON.stringify(IMPORT_RECORD_PROTOCOL)} `
      + '(it may have been written by a different version). It is refused rather than skipped: '
      + 'a pack missing from this list is a pack whose items nothing would offer to promote.');
  }
  return parsed as ImportRecord;
}

/** The entries of `dir` that are directories, sorted. `[]` when it is absent. */
function subdirectories(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted(comparePaths);
  } catch {
    return [];
  }
}

/**
 * Every import filed in this workspace, in directory order — name first, then
 * origin.
 *
 * ## Two shapes, because there are two shapes on disk
 *
 * A record this build writes is at `<slug>/<origin>/import.json`. A record an
 * older build wrote is at `<slug>/import.json`, and it is read from exactly
 * where it is — see `packDirFor` for why nothing moves it. Both are listed, in
 * one order, and a name's legacy record comes before that name's keyed ones
 * because it was there first.
 *
 * **Two records may now share a `pack`, and that is the point.** They are two
 * packs that call themselves the same thing, and before this key existed they
 * were one record with one of them silently gone. Every caller that resolves a
 * pack BY NAME therefore has an ambiguity to answer, and `review promote --all
 * --pack` answers it by refusing to guess rather than by taking the first.
 *
 * A directory with no `import.json` is skipped rather than reported: the
 * quarantine directory is one, and so is a pack directory left behind by an
 * import that failed before its record was written. Neither is a pack that
 * was imported, which is the question this function answers.
 *
 * A record whose protocol is not this build's IS reported, because that is
 * version skew and answering "no packs" would be the silent kind of wrong.
 */
export function readImportRecords(root: string): ImportRecord[] {
  const dir = importedDir(root);
  const out: ImportRecord[] = [];
  for (const name of subdirectories(dir)) {
    if (name === UNKNOWN_PACK_DIR) continue;
    const legacy = readRecordAt(path.join(dir, name, RECORD_FILE));
    if (legacy !== null) out.push(legacy);
    for (const origin of subdirectories(path.join(dir, name))) {
      const record = readRecordAt(path.join(dir, name, origin, RECORD_FILE));
      if (record !== null) out.push(record);
    }
  }
  return out;
}
