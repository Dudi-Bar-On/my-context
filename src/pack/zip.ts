/**
 * `writeZip` / `readZip` — the deterministic archive, hand-written, and the
 * one artefact in this plan that has CONTAINER bytes of its own.
 *
 * The ZIP is a convenience over the canonical directory, not a replacement for
 * it: `dir-writer.ts` produces the rung that imports with `cp -r` and reviews
 * in a pull request. This one exists because a single file travels through
 * email, a browser download and a chat attachment, and a directory does not.
 *
 * Zero runtime dependencies. `node:zlib` is used for exactly two things —
 * `crc32` for the header field, and `inflateRawSync` for archives WE DID NOT
 * WRITE. Nothing here deflates; see "Compression" below.
 *
 * ## Entry names are data inside a file, and that changes the whole argument
 *
 * `dir-writer.ts` settled why an allow-list check belongs at a writer: there,
 * `refuseArtefactPaths` IS the containment check, because
 * `path.join(target, ...p.split('/'))` cannot leave `target` for as long as
 * every segment reaching it is a plain non-empty name with no separator, no
 * `..`, no `.`, no colon and no drive letter. Deleting the call there does not
 * lose redundancy; it loses containment.
 *
 * That reasoning transfers, and then it has to be extended, because this
 * module is different in a way that matters:
 *
 * **This module never touches a filesystem.** `writeZip` returns a `Buffer`;
 * `readZip` takes one. There is no `path.join` here whose precondition the
 * check could be. So containment cannot be the argument — and yet the check
 * has to be STRONGER here, not weaker, for three reasons:
 *
 *  1. **The names are consumed by a stranger's extractor, not by us.** An
 *     entry name is not a path this process will open; it is an instruction,
 *     stored inside a file, that some unzip on some other machine will turn
 *     into a path under rules we do not control and cannot inspect. Every
 *     mainstream extractor has shipped at least one traversal bug. The
 *     exporting process is the last moment at which anyone who understands
 *     this format is in the room, so it is the moment the refusal has to
 *     happen. A refusal that "the receiver's unzip would surely catch" is not
 *     a refusal.
 *
 *  2. **It has to hold on every platform, not just this one.** The directory
 *     writer only had to survive the host it was running on: if a name would
 *     have done something strange, it would have done it there, where the
 *     author could see it. An archive is carried to a host chosen by someone
 *     else. `items/rule/CON.md`, `items/rule/RULE-a.md:evil` and a segment
 *     with a trailing space are harmless bytes on ext4 and are a device, a
 *     hidden alternate data stream, and a silent overwrite on NTFS. That is
 *     exactly the set `refuseArtefactPath` already enumerates, with a reason
 *     per row, so this module calls it rather than restating it.
 *
 *  3. **The SET-level rules are not defence in depth here — they are the only
 *     check that exists.** Two entries whose names differ only by case are two
 *     entries in the central directory and ONE file after extraction on NTFS
 *     and on default APFS. The directory writer at least hands both names to a
 *     real filesystem, which could in principle be observed to have made one
 *     file. This writer hands them to a `Buffer`, which accepts anything; the
 *     archive then verifies against its own central directory, the manifest
 *     lists both files, and the receiver is told one of them is `missing`.
 *     Nothing between here and there can notice. Likewise a name repeated
 *     twice: legal ZIP, last-write-wins on extraction, silent.
 *
 * So `refuseZipInput` is `refuseArtefactPaths` plus the arithmetic that is
 * genuinely this container's own, and there is no second spelling of the name
 * grammar in this file. `readZip` screens with the SAME function, because a
 * stranger's archive is names-as-data pointed the other way — the plan's
 * reader refusal list says only "a traversing name", which is one row of a
 * table `layout.ts` already owns in full.
 *
 * **What is deliberately NOT re-checked**, on `dir-writer.ts`'s line: this
 * module does not care which files there are, whether `manifest.json` is among
 * them, or whether the manifest agrees with the bytes beside it. That is
 * assembly's business and `readArtefact`'s, and a copy of it here would be a
 * second spelling to drift.
 *
 * ## Determinism, which here is the whole product
 *
 * `renderManifest` writes its own object literal so that an artefact's bytes
 * do not depend on how the value was assembled. A directory inherited that
 * obligation in its narrowest form — copy `bytes` verbatim, add nothing —
 * because a directory has no container bytes at all.
 *
 * This container has container bytes, so the obligation is the same sentence
 * with much more to say: **every byte of the output is a function of the
 * (path, bytes) pairs and of nothing else.** Not the clock, not the platform,
 * not the locale, not the zlib build, not the order the caller happened to
 * pass, and not any other property the caller's objects happen to carry. Each
 * of the six places a ZIP normally leaks one of those is pinned, and each is
 * pinned by a test that reads the byte:
 *
 *   | drift source        | in an ordinary zipper     | here                 |
 *   |---------------------|---------------------------|----------------------|
 *   | entry order         | directory traversal order | `comparePaths`       |
 *   | modification time   | the file's mtime          | 1980-01-01 00:00:00  |
 *   | compression         | level- and version-tuned  | stored, method 0     |
 *   | extra field         | UT/NTFS timestamps        | absent, length 0     |
 *   | external attributes | unix mode / DOS attrs     | 0, host 0 (FAT)      |
 *   | name encoding, flag | CP437 or UTF-8 by content | UTF-8, bit 11 always |
 *
 * `createdAt` is the one non-reproducible value in this format and it lives in
 * `manifest.json`, where it is data the manifest hashes, not container.
 *
 * ### Compression: it stores, and that IS the determinism decision
 *
 * Design decision 10. `deflateRawSync` is reproducible only for a fixed level
 * AND a fixed zlib build, which turns "byte-identical across runs" into a
 * claim carrying a condition the receiver cannot check from the artefact.
 * Measured rather than assumed: on this runtime `deflateRawSync(s, { level: 1
 * })` and `deflateRawSync(s, { level: 9 })` differ for a 505-byte input, and
 * nothing in a ZIP records which one produced it. Method 0 makes the
 * determinism unconditional, and a corpus of Markdown measured in tens of
 * kilobytes does not need the bytes.
 *
 * The READER accepts method 8 anyway, and that asymmetry is the point rather
 * than a concession: a user who receives a pack as a directory and re-zips it
 * to pass it on produces deflated entries. Measured on this host —
 * PowerShell's `Compress-Archive` and .NET's `ZipFile.CreateFromDirectory`
 * both write method 8 for every non-empty file. That is the whole reason
 * `inflateRawSync` is imported.
 *
 * ## What a real zipper does that a hand-written reader must expect
 *
 * Both facts below were established by running those tools on this host, not
 * read out of the specification:
 *
 *   - **`Compress-Archive` writes DIRECTORY ENTRIES** — a name ending in `/`
 *     with zero length, zero CRC and method 0. `refuseArtefactPath` refuses a
 *     trailing `/` by name ("an artefact lists files"), so a reader that
 *     screened before dropping them would refuse an archive produced by the
 *     most likely Windows tool — and design decision 10's entire reason for
 *     accepting method 8 is that exact user. They are dropped, not refused,
 *     and only when they are genuinely empty; a name ending in `/` that
 *     carries bytes is a malformed entry and is refused as one.
 *   - **`Compress-Archive` leaves the UTF-8 flag CLEAR** (flags `0x0000`).
 *     With bit 11 clear the specification says the name is CP437, so a
 *     non-ASCII name in such an archive has no knowable spelling. It is
 *     refused by name rather than guessed at; an all-ASCII name is the same
 *     string under both encodings and is accepted.
 *
 * ## What the reader refuses that the plan did not think to name
 *
 *   - **A local header whose name differs from the central directory's.** The
 *     plan says the reader "reads the local header, skips name and extra, and
 *     takes the data". Skipping the name is how one archive comes to mean two
 *     different things: tools that walk the central directory see the safe
 *     name and tools that scan local headers see the other one. The two are
 *     compared byte for byte and a mismatch is refused. Method, CRC and sizes
 *     are compared too, except where the local header declares a data
 *     descriptor (general-purpose bit 3), which is the legitimate case in
 *     which all three are zero and the central directory is authoritative.
 *   - **A deflate stream that expands past its declared size.** `usize` from
 *     the central directory is passed as `maxOutputLength`, so a stranger's
 *     archive cannot make this process allocate more than its own directory
 *     promised. `maxOutputLength: 0` is `ERR_OUT_OF_RANGE` on this runtime —
 *     measured, and the reason for the `Math.max(1, …)` — so a zero-length
 *     deflated entry is bounded at one byte and then caught by the length
 *     check.
 *   - **Zip64.** An archive carrying a Zip64 end-of-central-directory locator
 *     is refused by name. This writer never emits Zip64 and refuses rather
 *     than truncating, so reading one back silently would be the one place
 *     this format grew a second shape.
 *
 * ## The EOCD scan, and why it is a scan
 *
 * The plan says the reader locates the EOCD "by scanning backwards from the
 * end over the last 22 bytes plus a 0-byte comment allowance (we write no
 * comment, but a foreign zipper may)". Those two clauses contradict each
 * other: a 0-byte allowance means looking at exactly the last 22 bytes, which
 * is the one thing that cannot find a foreign zipper's comment. The allowance
 * here is the full 65,535 bytes the comment-length field can express, and a
 * candidate is accepted only when its comment-length field accounts for
 * exactly the bytes that follow it — which is what stops the four signature
 * bytes appearing inside a stored member's data from being taken for the
 * record.
 */
import { Buffer } from 'node:buffer';
import { crc32, inflateRawSync } from 'node:zlib';
import { comparePaths, refuseArtefactPaths, type ExportFile } from './layout.ts';

/** `PK\x03\x04` — a local file header, and the first four bytes of the file. */
const LOCAL_SIG = 0x04034b50;
/** `PK\x01\x02` — a central directory file header. */
const CENTRAL_SIG = 0x02014b50;
/** `PK\x05\x06` — the end of central directory record. */
const EOCD_SIG = 0x06054b50;
/**
 * `PK\x06\x07` — the Zip64 end-of-central-directory LOCATOR, which sits
 * immediately before the EOCD in every Zip64 archive. Recognising Zip64 by
 * this record rather than by a saturated count field is what lets an archive
 * of exactly 65,535 entries — a legal non-Zip64 archive, and one this writer
 * will happily produce — still be read back.
 */
const ZIP64_LOCATOR_SIG = 0x07064b50;
/** The Zip64 locator is 20 bytes, and it ends where the EOCD begins. */
const ZIP64_LOCATOR_BYTES = 20;

/**
 * 2.0 — the lowest version that reads what this writes. Version made by
 * carries host 0 (FAT) in its high byte, which is what makes external
 * attributes meaningless and therefore fixable at zero.
 */
const VERSION = 20;
/**
 * Bit 11: the name is UTF-8. Set always, so an ASCII-only corpus and one with
 * a non-ASCII custom category produce the same header shape and this writer
 * has one path rather than two.
 */
const FLAG_UTF8 = 0x0800;
/**
 * Bit 3: the CRC and both sizes follow the data instead of preceding it. Never
 * written here — every size is known before its header is — and tolerated on
 * read, because a zipper streaming into a pipe has no other option.
 */
const FLAG_DATA_DESCRIPTOR = 0x0008;

const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

/**
 * 00:00:00 and 1980-01-01: the lowest instant the DOS encoding can express.
 * There is no "no timestamp" encoding in this format, so a fixed one is the
 * only determinism available. `0x0000` as a DATE would be day 0 of month 0,
 * which some readers render as garbage and some reject outright.
 */
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;

const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const EOCD_BYTES = 22;

/** The EOCD's entry counts are 16-bit, and this writer never emits Zip64. */
const MAX_ENTRIES = 0xffff;
/**
 * Every size and offset in a non-Zip64 archive is a 32-bit unsigned value, so
 * 4 GiB is the first quantity that cannot be expressed.
 */
const SIZE_LIMIT = 0x1_0000_0000;
/** The comment-length field is 16-bit, so no EOCD can begin further back. */
const MAX_COMMENT_BYTES = 0xffff;

/**
 * `null` when this file set can be written as a ZIP, otherwise one
 * `my_context:`-prefixed sentence naming the entry and the limit it broke.
 *
 * Two groups, and the order between them is load-bearing.
 *
 * **The name grammar, which is not this module's to define.**
 * `refuseArtefactPaths` runs first and runs whole — every rule in it, singular
 * and plural. See the header for why an archive needs the stricter list rather
 * than a looser one, and why the plural half is the only check that exists
 * here at all.
 *
 * **The container's own arithmetic**, which `layout.ts` cannot know because it
 * is about the width of a header field rather than about a name: at most
 * 65,535 entries, and every 32-bit size field must hold the value written into
 * it. Each is checked separately although the later ones subsume the earlier —
 * a single file of 4 GiB necessarily makes the whole archive exceed 4 GiB —
 * because which check fires decides only what the refusal SAYS, and "this
 * archive is too large" sends an author to look at the wrong thing when one
 * item is the problem. That is `layout.ts`'s own reason for ordering its three
 * groups the way it does.
 *
 * **The name-length limit the plan lists is deliberately absent, and this is
 * where that decision is recorded.** The plan's refusal list includes "a name
 * whose UTF-8 encoding exceeds 65,535 bytes", for the 16-bit file name length
 * field. It cannot fire. `refuseArtefactPaths` has already refused any path
 * that is not one of three root files or exactly `items/<type>/<file>.md` with
 * every segment at most 255 UTF-8 bytes, so the longest name this function can
 * ever be asked to pass is `items/` + 255 + `/` + 255 = 517 bytes. Writing the
 * check would add a branch nothing could reach — exactly what `layout.ts`
 * deleted a clause to avoid, and what a mutation run reports as permanently
 * SURVIVING. The bound is real; it is enforced one layer up, and the ordering
 * above is what makes that true.
 */
export function refuseZipInput(files: readonly ExportFile[]): string | null {
  const bad = refuseArtefactPaths(files.map((f) => f.path));
  if (bad !== null) return bad;

  if (files.length > MAX_ENTRIES) {
    return `my_context: this artefact has ${files.length} files, and a ZIP counts its entries in `
      + `16 bits — ${MAX_ENTRIES} is the most one can hold. It is refused rather than truncated, `
      + 'because an archive whose count field disagrees with its contents is read differently by '
      + 'every tool that opens it. Export as a directory (--format dir), or narrow the selection '
      + 'with --type, --status or --tag.';
  }

  let total = EOCD_BYTES;
  for (const file of files) {
    if (file.bytes.length >= SIZE_LIMIT) {
      return `my_context: the artefact file ${JSON.stringify(file.path)} is ${file.bytes.length} `
        + `bytes, and a ZIP records a size in 32 bits — ${SIZE_LIMIT - 1} is the largest it can `
        + 'express. Zip64 lifts that limit and this writer does not emit it, so the file is '
        + 'refused rather than written with a wrapped length that would extract as a different '
        + 'file. Export as a directory (--format dir).';
    }
    total += LOCAL_HEADER_BYTES + CENTRAL_HEADER_BYTES
      + 2 * Buffer.byteLength(file.path, 'utf8') + file.bytes.length;
  }
  if (total >= SIZE_LIMIT) {
    return `my_context: this artefact would be ${total} bytes as a ZIP, and the offsets in a `
      + `central directory are 32 bits — ${SIZE_LIMIT - 1} is the largest one can express. Zip64 `
      + 'lifts that limit and this writer does not emit it, so the archive is refused rather than '
      + 'written with offsets that point at the wrong bytes. Export as a directory (--format '
      + 'dir), or narrow the selection with --type, --status or --tag.';
  }
  return null;
}

/**
 * The 30-byte local file header for one entry; the name and the data follow it.
 *
 * Every field the byte layout fixes at zero — the extra field length here, and
 * the comment length, disk number, internal and external attributes in the
 * central header — is left to `Buffer.alloc`'s zero fill rather than written
 * with an explicit `writeUInt16LE(0, …)`. Writing them would read as more
 * careful and would be less: an explicit zero into an already-zero buffer is a
 * statement no test can tell apart from its own absence, so each one would be
 * a permanently surviving mutant. The zeros are asserted where they can be —
 * in the output bytes, by the tests that read those offsets.
 */
function localHeader(nameBytes: Buffer, digest: number, size: number): Buffer {
  const header = Buffer.alloc(LOCAL_HEADER_BYTES);
  header.writeUInt32LE(LOCAL_SIG, 0);
  header.writeUInt16LE(VERSION, 4);
  header.writeUInt16LE(FLAG_UTF8, 6);
  header.writeUInt16LE(METHOD_STORED, 8);
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(digest, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  return header;
}

/** The 46-byte central directory file header for one entry; the name follows. */
function centralHeader(nameBytes: Buffer, digest: number, size: number, offset: number): Buffer {
  const header = Buffer.alloc(CENTRAL_HEADER_BYTES);
  header.writeUInt32LE(CENTRAL_SIG, 0);
  header.writeUInt16LE(VERSION, 4);
  header.writeUInt16LE(VERSION, 6);
  header.writeUInt16LE(FLAG_UTF8, 8);
  header.writeUInt16LE(METHOD_STORED, 10);
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(digest, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(offset, 42);
  return header;
}

/**
 * The whole archive for `files`, or a throw naming the entry that cannot be
 * written.
 *
 * The caller's array is copied before it is sorted: a writer that reordered
 * its caller's array in place would hand back a different value from the one
 * it was given, and `buildBundle` has already sorted the same array once with
 * the same comparator for the manifest. Sorting here anyway is not a second
 * opinion about that order — it is what makes the archive's order a property
 * of the file SET rather than of the call, which is the only form in which
 * "byte-identical across runs" is checkable by a receiver.
 *
 * **`crc32(bytes) >>> 0`, and an honest note about it.** The plan calls the
 * `>>> 0` load-bearing: "a signed value writes the wrong bytes for any digest
 * with the high bit set". Measured on this runtime, neither half of that is
 * true. `zlib.crc32` already returns an unsigned value — `crc32(Buffer.from(
 * 'the quick brown fox'))` is `2445345482`, which is `0x91c102ca` with bit 31
 * set and is a positive JavaScript number — so the shift cannot change any
 * value this function is given. And `Buffer.writeUInt32LE(-1)` throws
 * `ERR_OUT_OF_RANGE` rather than writing anything, so even a runtime that DID
 * return a signed digest would produce a loud crash, never the wrong bytes.
 * The shift is kept because it is the documented contract of the header field
 * and costs nothing, but the mutation that removes it SURVIVES and is
 * genuinely equivalent here. Recorded so the next mutation run does not spend
 * an hour deciding whether it is a hole.
 *
 * An empty file set produces a valid 22-byte archive that is nothing but an
 * EOCD, and it is not refused — `dir-writer.ts` accepts an empty bundle for
 * the same reason, that "wrote nothing" is a real outcome and inventing an
 * artefact-shape rule here would be a second spelling of assembly's. Note for
 * Task 9: `sniffFormat` is specified to recognise a ZIP by its first four
 * bytes being `50 4B 03 04`, and an empty archive begins `50 4B 05 06`. That
 * is a gap in the sniff, not in this writer.
 */
export function writeZip(files: readonly ExportFile[]): Buffer {
  const bad = refuseZipInput(files);
  if (bad !== null) throw new Error(bad);

  const sorted = [...files].sort((a, b) => comparePaths(a.path, b.path));
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of sorted) {
    const nameBytes = Buffer.from(file.path, 'utf8');
    const digest = crc32(file.bytes) >>> 0;
    locals.push(localHeader(nameBytes, digest, file.bytes.length), nameBytes, file.bytes);
    central.push(centralHeader(nameBytes, digest, file.bytes.length, offset), nameBytes);
    offset += LOCAL_HEADER_BYTES + nameBytes.length + file.bytes.length;
  }

  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(EOCD_BYTES);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...central, eocd]);
}

/** Every refusal from the reader carries the house prefix and stops the read. */
function refuse(sentence: string): never {
  throw new Error(`my_context: ${sentence}`);
}

/** How an archive is named in a refusal, when an entry is not the subject. */
const THIS_ARCHIVE = 'this ZIP artefact';

/**
 * The offset of the end of central directory record.
 *
 * Scanned backwards, and a candidate is taken only when its comment-length
 * field accounts for exactly the bytes that follow it. Without that test the
 * four signature bytes appearing inside a stored member's data — ordinary for
 * a corpus that documents this very format — would be taken for the record.
 * The scan runs from the end, so the LAST valid record wins, which is what a
 * reader wants when an archive has been appended to.
 */
function findEocd(bytes: Buffer): number {
  if (bytes.length < EOCD_BYTES) {
    refuse(`${THIS_ARCHIVE} is ${bytes.length} bytes, and the smallest possible ZIP is `
      + `${EOCD_BYTES} — an empty archive is exactly its end-of-central-directory record. This `
      + 'file is not a ZIP.');
  }
  const lowest = Math.max(0, bytes.length - EOCD_BYTES - MAX_COMMENT_BYTES);
  for (let at = bytes.length - EOCD_BYTES; at >= lowest; at -= 1) {
    if (bytes.readUInt32LE(at) !== EOCD_SIG) continue;
    if (bytes.readUInt16LE(at + 20) === bytes.length - at - EOCD_BYTES) return at;
  }
  refuse(`${THIS_ARCHIVE} has no end-of-central-directory record in its last `
    + `${Math.min(bytes.length, EOCD_BYTES + MAX_COMMENT_BYTES)} bytes, so it is either not a ZIP `
    + 'or it was truncated in transit. A ZIP is read from its end: without that record there is '
    + 'no list of what the file contains.');
}

/** One entry as the central directory describes it, before its data is read. */
interface CentralEntry {
  path: string;
  nameBytes: Buffer;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

/**
 * The entry name as text, or a refusal.
 *
 * Bit 11 of the general-purpose flag is the only thing in the file that says
 * how a name is encoded. Set, it is UTF-8. Clear, the specification says
 * CP437 — and `Compress-Archive` on this host leaves it clear. An all-ASCII
 * name is the same string under both, so it is accepted either way; a
 * non-ASCII name in an archive that does not claim UTF-8 has no knowable
 * spelling, and guessing one produces an item id that is subtly not the
 * author's.
 *
 * Even with bit 11 set the bytes are checked to BE valid UTF-8, by re-encoding
 * the decoded string and comparing. `Buffer.toString('utf8')` substitutes
 * U+FFFD for a malformed sequence rather than failing, which would turn a
 * corrupt name into a plausible-looking one — and an artefact path decides
 * where a file lands.
 */
function decodeName(nameBytes: Buffer, flags: number, index: number): string {
  if (nameBytes.length === 0) {
    refuse(`${THIS_ARCHIVE}'s entry ${index} has an empty name. Every file in an artefact is `
      + 'named, and a nameless entry cannot be matched against a manifest.');
  }
  if ((flags & FLAG_UTF8) === 0 && nameBytes.some((b) => b > 0x7f)) {
    refuse(`${THIS_ARCHIVE}'s entry ${index} has a name with bytes above 0x7F in an archive that `
      + 'does not set the UTF-8 flag, so the format says that name is CP437 and there is no way '
      + 'to tell which spelling was meant. Re-create the archive with a tool that marks its names '
      + 'as UTF-8, or pass on the directory instead.');
  }
  const path = nameBytes.toString('utf8');
  if (!Buffer.from(path, 'utf8').equals(nameBytes)) {
    refuse(`${THIS_ARCHIVE}'s entry ${index} has a name that is not valid UTF-8. Decoding it `
      + 'would silently replace the malformed bytes, which turns a corrupt name into a plausible '
      + 'one.');
  }
  return path;
}

/**
 * The central directory, walked whole, with the directory entries a foreign
 * zipper adds dropped and everything structurally impossible refused.
 *
 * The walk is driven by the EOCD's entry count AND bounded by its declared
 * size, and it insists the two agree exactly at the end. A directory shorter
 * than its count claims has been truncated; one that is longer has bytes in it
 * that no entry accounts for, and a reader that ignored them would be reading
 * a different archive from the one a stricter tool reads.
 */
function readCentralDirectory(bytes: Buffer, eocd: number): CentralEntry[] {
  if (eocd >= ZIP64_LOCATOR_BYTES
    && bytes.readUInt32LE(eocd - ZIP64_LOCATOR_BYTES) === ZIP64_LOCATOR_SIG) {
    refuse(`${THIS_ARCHIVE} is a Zip64 archive. This build reads and writes only the original `
      + '32-bit format: it refuses to emit Zip64 rather than truncate a size that will not fit, '
      + 'and reading one silently would be the one place this format grew a second shape. Unpack '
      + 'it with another tool and import the directory.');
  }
  if (bytes.readUInt16LE(eocd + 4) !== 0 || bytes.readUInt16LE(eocd + 6) !== 0) {
    refuse(`${THIS_ARCHIVE} is one part of a multi-part archive — its end record names disk `
      + `${bytes.readUInt16LE(eocd + 4)} and puts the central directory on disk `
      + `${bytes.readUInt16LE(eocd + 6)}. An artefact is one file. Rejoin the parts first.`);
  }
  const onDisk = bytes.readUInt16LE(eocd + 8);
  const total = bytes.readUInt16LE(eocd + 10);
  if (onDisk !== total) {
    refuse(`${THIS_ARCHIVE} says it holds ${onDisk} of its ${total} entries, so the rest are in `
      + 'another part of a multi-part archive. An artefact is one file.');
  }
  const size = bytes.readUInt32LE(eocd + 12);
  const start = bytes.readUInt32LE(eocd + 16);
  if (start + size > eocd) {
    refuse(`${THIS_ARCHIVE} places its ${size}-byte central directory at offset ${start}, which `
      + `runs past the end record at ${eocd}. The file is truncated, or bytes were prepended to `
      + 'it — a self-extracting stub does exactly that, and every offset inside is then relative '
      + 'to something this reader cannot see.');
  }

  const entries: CentralEntry[] = [];
  let at = start;
  for (let index = 0; index < total; index += 1) {
    if (at + CENTRAL_HEADER_BYTES > start + size) {
      refuse(`${THIS_ARCHIVE} declares ${total} entries but its central directory runs out after `
        + `${index}. The file is truncated.`);
    }
    if (bytes.readUInt32LE(at) !== CENTRAL_SIG) {
      refuse(`${THIS_ARCHIVE} has no central directory record where its entry ${index} should `
        + `begin (offset ${at}). The file is damaged, or it is not the ZIP its end record `
        + 'describes.');
    }
    const flags = bytes.readUInt16LE(at + 8);
    const method = bytes.readUInt16LE(at + 10);
    const crc = bytes.readUInt32LE(at + 16);
    const compressedSize = bytes.readUInt32LE(at + 20);
    const uncompressedSize = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    const localOffset = bytes.readUInt32LE(at + 42);
    const nameAt = at + CENTRAL_HEADER_BYTES;
    if (nameAt + nameLength + extraLength + commentLength > start + size) {
      refuse(`${THIS_ARCHIVE}'s central directory entry ${index} declares a name, extra field and `
        + 'comment that run past the end of the directory. The file is truncated.');
    }
    at = nameAt + nameLength + extraLength + commentLength;

    const path = decodeName(bytes.subarray(nameAt, nameAt + nameLength), flags, index);
    if (path.endsWith('/')) {
      // A directory entry, which `Compress-Archive` writes and .NET does not.
      // Dropped rather than refused — see the header — and only when it is
      // genuinely empty, because a name ending in "/" that carries bytes
      // describes a thing this format has no shape for.
      if (compressedSize === 0 && uncompressedSize === 0 && crc === 0) continue;
      refuse(`${THIS_ARCHIVE} has an entry named ${JSON.stringify(path)}, which ends in "/" and `
        + `so names a directory, yet it carries ${uncompressedSize} bytes. A directory entry is `
        + 'empty; this one is not, and what a reader should do with it is not a thing to guess.');
    }
    if (method !== METHOD_STORED && method !== METHOD_DEFLATED) {
      refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(path)} uses compression method ${method}. `
        + `This build reads method ${METHOD_STORED} (stored) and method ${METHOD_DEFLATED} `
        + '(deflate), which are the two every ZIP tool produces. It is refused by number rather '
        + 'than skipped: an artefact is verified against its manifest, and a file that did not '
        + 'arrive is not the same thing as a file that is absent.');
    }
    entries.push({
      path,
      nameBytes: bytes.subarray(nameAt, nameAt + nameLength),
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
  }
  if (at !== start + size) {
    refuse(`${THIS_ARCHIVE}'s central directory declares ${size} bytes but its ${total} entries `
      + `account for ${at - start}. Bytes that no entry claims sit inside it, and a reader that `
      + 'ignored them would be reading a different archive from the one a stricter tool reads.');
  }
  return entries;
}

/**
 * One entry's bytes, taken from beside its local header and verified against
 * what the central directory said they would be.
 *
 * The local header is read for three things: to confirm the record is there,
 * to confirm it names the SAME entry, and to find where the data begins — the
 * local extra field is routinely a different length from the central one, so
 * that offset cannot be computed from the central header alone.
 */
function readEntry(bytes: Buffer, entry: CentralEntry): Buffer {
  const at = entry.localOffset;
  if (at + LOCAL_HEADER_BYTES > bytes.length || bytes.readUInt32LE(at) !== LOCAL_SIG) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} is listed at offset ${at}, `
      + 'where there is no local file header. The file is damaged or truncated.');
  }
  const flags = bytes.readUInt16LE(at + 6);
  const nameLength = bytes.readUInt16LE(at + 26);
  const extraLength = bytes.readUInt16LE(at + 28);
  const localName = bytes.subarray(at + LOCAL_HEADER_BYTES, at + LOCAL_HEADER_BYTES + nameLength);
  if (!localName.equals(entry.nameBytes)) {
    refuse(`${THIS_ARCHIVE} names one entry two ways: its central directory calls it `
      + `${JSON.stringify(entry.path)} and the header beside the data calls it `
      + `${JSON.stringify(localName.toString('utf8'))}. Tools disagree about which of the two `
      + 'wins, so an archive like this means different things to different readers and is '
      + 'refused rather than resolved.');
  }
  if (bytes.readUInt16LE(at + 8) !== entry.method) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} is compressed one way beside `
      + `its data (method ${bytes.readUInt16LE(at + 8)}) and another in the central directory `
      + `(method ${entry.method}). The two records describe different files.`);
  }
  // Bit 3 puts the CRC and both sizes in a descriptor AFTER the data and
  // leaves all three zero here, which is legitimate and is why the comparison
  // is conditional. The central directory is authoritative in either case.
  if ((flags & FLAG_DATA_DESCRIPTOR) === 0
    && (bytes.readUInt32LE(at + 14) !== entry.crc
      || bytes.readUInt32LE(at + 18) !== entry.compressedSize
      || bytes.readUInt32LE(at + 22) !== entry.uncompressedSize)) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} carries one size and checksum `
      + 'beside its data and a different pair in the central directory. The two records describe '
      + 'different files, and which one a tool believes decides what it extracts.');
  }

  const from = at + LOCAL_HEADER_BYTES + nameLength + extraLength;
  if (from + entry.compressedSize > bytes.length) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} claims ${entry.compressedSize} `
      + 'bytes of data that run past the end of the file. It was truncated in transit.');
  }
  const raw = bytes.subarray(from, from + entry.compressedSize);

  let body: Buffer;
  if (entry.method === METHOD_STORED) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} is stored uncompressed and `
        + `yet declares ${entry.compressedSize} bytes on disk for ${entry.uncompressedSize} bytes `
        + 'of content. Stored means the two are the same number.');
    }
    // Copied rather than handed back as a view: a returned `subarray` keeps the
    // whole archive alive and lets a caller's write reach into another entry's
    // bytes, and every consumer treats an `ExportFile` as its own.
    body = Buffer.from(raw);
  } else {
    try {
      // Bounded by what the entry promised, so a stranger's archive cannot ask
      // this process for more memory than its own central directory declares.
      // `maxOutputLength: 0` is ERR_OUT_OF_RANGE on this runtime, so an empty
      // deflated entry is bounded at one byte and caught by the length check.
      body = inflateRawSync(raw, { maxOutputLength: Math.max(1, entry.uncompressedSize) });
    } catch (error) {
      refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} could not be decompressed: `
        + `${error instanceof Error ? error.message : String(error)}. Either the archive is `
        + `damaged, or the entry expands past the ${entry.uncompressedSize} bytes it declares — `
        + 'which is how an archive asks a reader for memory it never agreed to give.');
    }
  }

  if (body.length !== entry.uncompressedSize) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} declares `
      + `${entry.uncompressedSize} bytes and holds ${body.length}. The archive is damaged, and an `
      + 'artefact whose bytes did not arrive intact is not partially imported.');
  }
  const digest = crc32(body) >>> 0;
  if (digest !== entry.crc) {
    refuse(`${THIS_ARCHIVE}'s entry ${JSON.stringify(entry.path)} fails its own checksum: the `
      + `archive records CRC-32 0x${entry.crc.toString(16).padStart(8, '0')} and its bytes are `
      + `0x${digest.toString(16).padStart(8, '0')}. The file was corrupted after it was written.`);
  }
  return body;
}

/**
 * Every file in `bytes`, in `comparePaths` order, or a throw naming the entry
 * and the rule it broke.
 *
 * **Sorted rather than returned in central directory order**, which for an
 * archive this module wrote are the same thing and for a foreign one are not.
 * A foreign zipper's directory order is a fact about its own traversal, not
 * about the artefact, and `readArtefact` compares a directory rung against a
 * ZIP rung entry for entry. Sorting is not dropping: no entry and no byte is
 * lost by it.
 *
 * **The name set is screened before a single byte of data is touched.** A
 * hostile name therefore costs no inflation at all, and — much more
 * importantly — the screen is `refuseArtefactPaths`, the same function the
 * writer uses and the same one Task 9's directory walk uses. A stranger's
 * archive is entry-names-as-data pointed inward; see the header for why that
 * is the stricter case rather than the looser one.
 */
export function readZip(bytes: Buffer): ExportFile[] {
  const entries = readCentralDirectory(bytes, findEocd(bytes));

  const bad = refuseArtefactPaths(entries.map((e) => e.path));
  if (bad !== null) {
    refuse(`${THIS_ARCHIVE} cannot be read: ${bad.replace(/^my_context:\s*/, '')} No entry was `
      + 'decompressed and nothing was written — an archive names the files it holds, and a name '
      + 'this shape is refused before its bytes are looked at.');
  }

  return entries
    .map((entry) => ({ path: entry.path, bytes: readEntry(bytes, entry) }))
    .sort((a, b) => comparePaths(a.path, b.path));
}
