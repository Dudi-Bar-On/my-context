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
 * under `record` — filed under `.audit/imported/unknown/`, and COUNTED. The
 * count is returned rather than logged, because the caller has to report it:
 * a quarantine nobody is told about is a silent drop with extra steps.
 *
 * Nothing here validates the wrapped row. It is not ours to validate, and
 * rewriting it into a shape this build recognises would be inventing content
 * on a stranger's behalf.
 *
 * ## A pack name is not a path
 *
 * The name arrives from a stranger and is turned into a directory, so the two
 * ways it could stop naming its own directory are refused rather than
 * resolved: a name that slugs to nothing has no directory to be, and a name
 * that slugs to `unknown` would share the quarantine's. Both refusals name
 * the name and say what to do. `normalizeForSlug` (`core/slug.ts` ·
 * `export function normalizeForSlug(title: string): string {` · ~20) does the
 * rest — it is the same normalisation ids get, so the mapping from a pack
 * name to a directory is one a reader of this product already knows.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditDir } from '../core/audit.ts';
import {
  appendJsonlLine, ensureLogDir, parseJsonlLog,
  type JsonlLogSpec, type JsonlRow,
} from '../core/jsonl-log.ts';
import { normalizeForSlug } from '../core/slug.ts';
import type { Origin } from '../core/types.ts';
import type { PackHistoryRecord } from './history.ts';
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
 * `<root>/.audit/imported/<slug>` — one pack's own directory.
 *
 * Throws rather than inventing a directory for a name that cannot have one.
 * Both cases are reachable from a stranger's `manifest.json`: `refusePackName`
 * (manifest.ts) accepts any non-empty printable string, so `"!!!"` and
 * `"unknown"` both arrive here as legitimate pack names.
 */
export function packDir(root: string, name: string): string {
  const slug = normalizeForSlug(name);
  if (slug === '') {
    refuse(`the pack name ${JSON.stringify(name)} contains no letter or digit, so it names no `
      + 'directory. A pack\'s history is filed under a directory made from its name, and a name '
      + 'that slugs to nothing would file it under the empty string — which is the imported '
      + 'directory itself, where the next pack would land on top of it. Give the pack a name '
      + 'with a word in it.');
  }
  if (slug === UNKNOWN_PACK_DIR) {
    refuse(`the pack name ${JSON.stringify(name)} slugs to ${JSON.stringify(UNKNOWN_PACK_DIR)}, `
      + 'which is the directory this build files history rows it could not validate under. Two '
      + 'writers in one directory is not something to resolve quietly — a reader could no longer '
      + 'tell this pack\'s records from the quarantine. Rename the pack.');
  }
  return path.join(importedDir(root), slug);
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
   * The row's position among the rows the reader handed over, 1-based.
   *
   * It is NOT the physical line number in `source`, and the difference is
   * worth stating: `parseHistory` returns its unknown rows in file order but
   * without line numbers (`pack/history.ts` ·
   * `export function parseHistory(bytes: Buffer, file: string): HistoryRead {` · ~522),
   * so file order is all there is to carry. Two rows quarantined out of a
   * forty-line file are 1 and 2 here. That is enough to say WHICH row and to
   * put two of them back in order, which is what a person reading the
   * quarantine needs; recovering the byte offset means reading `source`,
   * which is in the artefact they still have.
   */
  line: number;
  /** The original object, verbatim. */
  record: JsonlRow;
}

/**
 * Creates one directory under `.audit/imported/`, and the imported directory
 * above it, each with its own `*` .gitignore.
 *
 * Both levels, not just the leaf: an empty pack directory — or the imported
 * directory before any pack has landed in it — is still not offered to git.
 * `.audit/` already carries a .gitignore of its own and this deliberately does
 * not lean on it, because a .gitignore one level up is a fact about the
 * parent, and a directory that is moved or copied out takes its own with it.
 */
function ensure(root: string, dir: string): string {
  ensureLogDir(importedDir(root));
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
  root: string, name: string, records: readonly PackHistoryRecord[],
): void {
  const dir = ensure(root, packDir(root, name));
  const file = path.join(dir, HISTORY_FILE);
  for (const r of records) appendJsonlLine(dir, file, imported(name, r));
}

/**
 * Wraps every row, files it under `.audit/imported/unknown/`, and returns how
 * many — which the caller must report.
 *
 * `now` is injectable so a test can pin the stamp; production passes nothing
 * and gets the wall clock, exactly as `recordAudit` does.
 */
export function quarantine(
  root: string, name: string, rows: readonly JsonlRow[], source: string,
  now: string = new Date().toISOString(),
): number {
  if (rows.length === 0) return 0;
  const dir = ensure(root, unknownDir(root));
  const file = path.join(dir, QUARANTINE_FILE);
  rows.forEach((record, i) => {
    const wrapped: QuarantinedRow = {
      protocol: IMPORTED_UNKNOWN_PROTOCOL,
      pack: name,
      at: now,
      source,
      line: i + 1,
      record,
    };
    appendJsonlLine(dir, file, wrapped);
  });
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

/** One pack's imported history, in the order it was filed. */
export function readImportedHistory(root: string, name: string): ImportedRecord[] {
  const file = path.join(packDir(root, name), HISTORY_FILE);
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
  source: string;
  importedAt: string;
  manifestFiles: number;
  /** Every id this import placed in the corpus, sorted with the comparator. */
  items: string[];
  historyRecords: number;
  quarantined: number;
}

/**
 * Writes `<pack>/import.json` and returns its path.
 *
 * Two-space JSON with one trailing newline, every key always present, written
 * from one object literal so the key order is the format's and not the
 * caller's. `items` is sorted here rather than trusted from the caller, for
 * the same reason the manifest sorts its own file list: two runs of the same
 * import must produce the same bytes.
 */
export function writeImportRecord(root: string, record: ImportRecord): string {
  const file = path.join(ensure(root, packDir(root, record.pack)), RECORD_FILE);
  const document = {
    protocol: IMPORT_RECORD_PROTOCOL,
    pack: record.pack,
    version: record.version,
    kind: record.kind,
    source: record.source,
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
 * Every pack imported into this workspace, in directory-name order.
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
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }

  const out: ImportRecord[] = [];
  for (const name of names.toSorted(comparePaths)) {
    if (name === UNKNOWN_PACK_DIR) continue;
    const file = path.join(dir, name, RECORD_FILE);
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
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
    out.push(parsed as ImportRecord);
  }
  return out;
}

