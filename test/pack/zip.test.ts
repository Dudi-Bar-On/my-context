/**
 * `zip.ts` writes a container, so almost every test below reads a BYTE.
 *
 * `dir-writer.test.ts` recorded that its determinism test was nearly vacuous:
 * writing the same in-memory `Buffer`s into two directories is identical
 * unless the writer is nondeterministic in a way no other test could miss. A
 * ZIP is the opposite case and this file is where that difference is spent —
 * a timestamp, an external attribute, a version-made-by, a compression choice,
 * an extra field and the order of the central directory are six independent
 * places a byte drifts between runs, between platforms or between zlib builds,
 * and `writeZip(FILES) === writeZip(FILES)` sees none of them.
 *
 * **Read against the guards, the plan's own nine tests leave nine holes.**
 * They are recorded here rather than fixed silently:
 *
 *  1. **The determinism test compares the writer against itself.** A pure
 *     function of its arguments is byte-identical to itself for free; what
 *     that assertion cannot see is a value pinned to the WRONG constant, and
 *     every one of the six drift sources above is a fixed constant. The
 *     container is therefore pinned whole, as hex, for a known one-entry
 *     archive, and field by field for a multi-entry one.
 *  2. **"entries appear in UTF-8 byte order" is asserted through `readZip`**,
 *     which sorts. That test passes with the writer's sort deleted. Order is
 *     asserted here by reading names straight out of the central directory,
 *     with a parser this file owns.
 *  3. **…and the plan's fixture is all-ASCII**, so it cannot tell UTF-8 byte
 *     order from JavaScript's default UTF-16 code-unit order — which is the
 *     one distinction `comparePaths`'s doc comment exists to make. The fixture
 *     below adds U+FF21 and U+1D400: `comparePaths` puts U+FF21 first (its
 *     UTF-8 begins `EF`, the other's `F0`) and a bare `<` puts it second.
 *  4. **Only the LOCAL header is asserted.** The byte layout fixes eight
 *     fields across the 46-byte central header — version made by, disk number
 *     start, internal and external attributes among them — and the plan reads
 *     none of them. External attributes at 0 is the whole reason host 0 (FAT)
 *     was chosen; nothing checked it.
 *  5. **`history.jsonl` present-and-empty is not tested at all.** Tasks 4, 5
 *     and 6 settled that absent and zero-byte are different artefacts. A
 *     writer with `if (file.bytes.length)` around its local record passes all
 *     nine of the plan's tests and silently drops the file that carries the
 *     distinction.
 *  6. **The set-level refusal is untested**, and for a ZIP it is not defence
 *     in depth — it is the only check there is. Two names differing by case
 *     are two entries here and one file after extraction. Proved below by
 *     construction, as `dir-writer.test.ts` does: the pair is asserted to pass
 *     `refuseArtefactPath` ONE AT A TIME and then to be refused by the writer.
 *  7. **The oversize test asserts `assert.ok(refusal)`** and never checks
 *     which refusal fired. `refuseZipInput` runs the name grammar first, so a
 *     truthy string proves nothing about the arithmetic; each of the three
 *     limits is matched by its own sentence below.
 *  8. **…and its fixture does not typecheck.** `{ path: 'config.json', bytes:
 *     { length: 2 ** 32 } }` is not an `ExportFile`, whose `bytes` is a
 *     `Buffer`. The cast is unavoidable — a real 4 GiB `Buffer` is not a test
 *     fixture on any machine — so it is made explicit and explained at the
 *     one place it appears, rather than left as a type error in the plan.
 *  9. **"the reader accepts method 8" is left as a comment**, and hand-built
 *     bytes only prove the reader accepts what its own author imagined. Two
 *     archives produced by PowerShell's `Compress-Archive` on this host are
 *     embedded below instead. They carry things no hand-built fixture would
 *     have thought to include: the UTF-8 flag left CLEAR, entries in traversal
 *     rather than sorted order, method 0 for the empty file beside method 8
 *     for the rest, and a bare directory entry.
 *
 * **The crc32 sign test asserts a property no correct implementation can
 * have**, and it is replaced rather than repaired. See its own test below.
 *
 * **Malformed archives are hand-built, never produced by patching one field of
 * a good one.** Flipping only the central directory's CRC does not test the
 * CRC guard: it trips the local-versus-central agreement check first, and the
 * test would pass with the CRC verification deleted. Where a fixture does
 * patch, it patches both records and says so.
 *
 * **What a foreign extractor makes of what we write is not asserted in this
 * file**, because spawning PowerShell from a unit test is not a thing this
 * suite does. It was measured instead, and the result is recorded in
 * `zip.ts`'s header: .NET's `System.IO.Compression.ZipFile` reads every entry
 * of a six-file archive written here, decodes a Hebrew-and-emoji entry name
 * correctly from the bit-11 flag, and reports every `LastWriteTime` as
 * 1980-01-01 00:00:00; `Expand-Archive` extracts the same archive to a tree
 * that includes the zero-byte `history.jsonl`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { crc32, deflateRawSync } from 'node:zlib';
import { comparePaths, refuseArtefactPath, type ExportFile } from '../../src/pack/layout.ts';
import { readZip, refuseZipInput, writeZip } from '../../src/pack/zip.ts';

const file = (path: string, body: string): ExportFile => ({ path, bytes: Buffer.from(body, 'utf8') });

/** The plan's fixture, deliberately not in sorted order. */
const FILES: ExportFile[] = [
  file('items/rule/RULE-b.md', 'bbbb'),
  file('config.json', '{}'),
  file('items/rule/RULE-a.md', 'aaaa'),
];

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

// --- a ZIP parser this file owns ----------------------------------------
// Deliberately not `readZip`. A test that read the archive with the code under
// test would assert that the writer agrees with the reader, which is a
// property two matching mistakes also have.

/** The EOCD offset of an archive with no comment, which is every archive we write. */
const eocdAt = (z: Buffer): number => z.length - 22;

/** Every entry name, in central directory order. */
function centralNames(z: Buffer): string[] {
  const names: string[] = [];
  let at = z.readUInt32LE(eocdAt(z) + 16);
  for (let i = 0; i < z.readUInt16LE(eocdAt(z) + 10); i += 1) {
    assert.equal(z.readUInt32LE(at), CENTRAL_SIG, `entry ${i} is not a central directory record`);
    const nameLength = z.readUInt16LE(at + 28);
    names.push(z.subarray(at + 46, at + 46 + nameLength).toString('utf8'));
    at += 46 + nameLength + z.readUInt16LE(at + 30) + z.readUInt16LE(at + 32);
  }
  return names;
}

/** The offset of entry `index`'s central directory record. */
function centralAt(z: Buffer, index: number): number {
  let at = z.readUInt32LE(eocdAt(z) + 16);
  for (let i = 0; i < index; i += 1) {
    at += 46 + z.readUInt16LE(at + 28) + z.readUInt16LE(at + 30) + z.readUInt16LE(at + 32);
  }
  return at;
}

// --- a hand-built archive, for the malformed fixtures --------------------

interface Raw {
  name: Buffer;
  localName: Buffer;
  flags: number;
  localFlags: number;
  method: number;
  localMethod: number;
  crc: number;
  localCrc: number;
  compressedSize: number;
  localCompressedSize: number;
  uncompressedSize: number;
  localUncompressedSize: number;
  data: Buffer;
}

/**
 * A well-formed entry, which each fixture then breaks in exactly one way. The
 * central and local copies of every duplicated field default to the same
 * value, so a fixture that overrides one of a pair is visibly overriding one
 * of a pair.
 */
function raw(name: string, body: Buffer, over: Partial<Raw> = {}): Raw {
  const nameBytes = Buffer.from(name, 'utf8');
  const digest = crc32(body) >>> 0;
  return {
    name: nameBytes,
    localName: nameBytes,
    flags: 0x0800,
    localFlags: 0x0800,
    method: 0,
    localMethod: 0,
    crc: digest,
    localCrc: digest,
    compressedSize: body.length,
    localCompressedSize: body.length,
    uncompressedSize: body.length,
    localUncompressedSize: body.length,
    data: body,
    ...over,
  };
}

/** A deflated entry, whose stored bytes are the raw deflate stream. */
function deflated(name: string, body: Buffer, over: Partial<Raw> = {}): Raw {
  const stream = deflateRawSync(body);
  return raw(name, body, {
    method: 8,
    localMethod: 8,
    data: stream,
    compressedSize: stream.length,
    localCompressedSize: stream.length,
    uncompressedSize: body.length,
    localUncompressedSize: body.length,
    crc: crc32(body) >>> 0,
    localCrc: crc32(body) >>> 0,
    ...over,
  });
}

function archive(entries: readonly Raw[], options: { comment?: Buffer; zip64?: boolean } = {}): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(LOCAL_SIG, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(e.localFlags, 6);
    lh.writeUInt16LE(e.localMethod, 8);
    lh.writeUInt16LE(0x0021, 12);
    lh.writeUInt32LE(e.localCrc, 14);
    lh.writeUInt32LE(e.localCompressedSize, 18);
    lh.writeUInt32LE(e.localUncompressedSize, 22);
    lh.writeUInt16LE(e.localName.length, 26);
    locals.push(lh, e.localName, e.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(CENTRAL_SIG, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(e.flags, 8);
    ch.writeUInt16LE(e.method, 10);
    ch.writeUInt16LE(0x0021, 14);
    ch.writeUInt32LE(e.crc, 16);
    ch.writeUInt32LE(e.compressedSize, 20);
    ch.writeUInt32LE(e.uncompressedSize, 24);
    ch.writeUInt16LE(e.name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, e.name);
    offset += 30 + e.localName.length + e.data.length;
  }

  const comment = options.comment ?? Buffer.alloc(0);
  const locator = Buffer.alloc(options.zip64 === true ? 20 : 0);
  if (options.zip64 === true) locator.writeUInt32LE(0x07064b50, 0);
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(comment.length, 20);
  return Buffer.concat([...locals, ...central, locator, eocd, comment]);
}

// --- archives produced by PowerShell on this host, frozen as fixtures -----

/**
 * `Compress-Archive` over an artefact-shaped directory. Five entries, in the
 * traversal order that tool chose rather than in `comparePaths` order; method
 * 8 for every non-empty file and method 0 for the zero-byte `history.jsonl`;
 * general-purpose flags `0x0000`, so the UTF-8 bit is CLEAR; real 2026
 * timestamps in every header.
 */
const COMPRESS_ARCHIVE = Buffer.from(
  'UEsDBBQAAAAIAHRVFV2L9k8PBgAAAAQAAAAYAAAAaXRlbXMvbGVzc29uL0xFU1NPTi1iLm1kS0pKSgIAUEsD'
  + 'BBQAAAAIAHRVFV3Y5bVIBgAAAKAAAAAUAAAAaXRlbXMvcnVsZS9SVUxFLWEubWRLTBzcAABQSwMEFAAAAAgA'
  + 'dFUVXUO/pqMEAAAAAgAAAAsAAABjb25maWcuanNvbquuBQBQSwMEFAAAAAAAdFUVXQAAAAAAAAAAAAAAAA0A'
  + 'AABoaXN0b3J5Lmpzb25sUEsDBBQAAAAIAHRVFV3IErCUIgAAACAAAAANAAAAbWFuaWZlc3QuanNvbqtWKijK'
  + 'L8lPzs9RslLKrYxPzs8rSa0o0S9ITM52MFSqBQBQSwECFAAUAAAACAB0VRVdi/ZPDwYAAAAEAAAAGAAAAAAA'
  + 'AAAAAAAAAAAAAAAAaXRlbXMvbGVzc29uL0xFU1NPTi1iLm1kUEsBAhQAFAAAAAgAdFUVXdjltUgGAAAAoAAA'
  + 'ABQAAAAAAAAAAAAAAAAAPAAAAGl0ZW1zL3J1bGUvUlVMRS1hLm1kUEsBAhQAFAAAAAgAdFUVXUO/pqMEAAAA'
  + 'AgAAAAsAAAAAAAAAAAAAAAAAdAAAAGNvbmZpZy5qc29uUEsBAhQAFAAAAAAAdFUVXQAAAAAAAAAAAAAAAA0A'
  + 'AAAAAAAAAAAAAAAAoQAAAGhpc3RvcnkuanNvbmxQSwECFAAUAAAACAB0VRVdyBKwlCIAAAAgAAAADQAAAAAA'
  + 'AAAAAAAAAADMAAAAbWFuaWZlc3QuanNvblBLBQYAAAAABQAFADcBAAAZAQAAAAA=',
  'base64',
);

/**
 * The same tool over a directory holding an EMPTY category directory, which is
 * what makes it emit a bare directory entry — `items/emptycat/`, method 0,
 * zero length, zero CRC. `refuseArtefactPath` refuses a trailing "/" by name,
 * so this fixture is the whole reason the reader drops such entries instead of
 * screening them.
 */
const COMPRESS_ARCHIVE_DIRS = Buffer.from(
  'UEsDBBQAAAAAAH1VFV0AAAAAAAAAAAAAAAAPAAAAaXRlbXMvZW1wdHljYXQvUEsDBBQAAAAIAH1VFV1F5Zit'
  + 'BgAAAAQAAAAUAAAAaXRlbXMvcnVsZS9SVUxFLWEubWRLTExMBABQSwMEFAAAAAgAfVUVXUO/pqMEAAAAAgAA'
  + 'AA0AAABtYW5pZmVzdC5qc29uq64FAFBLAQIUABQAAAAAAH1VFV0AAAAAAAAAAAAAAAAPAAAAAAAAAAAAAAAA'
  + 'AAAAAABpdGVtcy9lbXB0eWNhdC9QSwECFAAUAAAACAB9VRVdReWYrQYAAAAEAAAAFAAAAAAAAAAAAAAAAAAt'
  + 'AAAAaXRlbXMvcnVsZS9SVUxFLWEubWRQSwECFAAUAAAACAB9VRVdQ7+mowQAAAACAAAADQAAAAAAAAAAAAAA'
  + 'AABlAAAAbWFuaWZlc3QuanNvblBLBQYAAAAAAwADALoAAACUAAAAAAA=',
  'base64',
);

// --- determinism, which is the whole product -----------------------------

test('the archive is byte-identical across runs, and across a re-ordered input', () => {
  assert.deepEqual(writeZip(FILES), writeZip(FILES));
  // Entry order is the comparator's, not the caller's.
  assert.deepEqual(writeZip(FILES), writeZip([...FILES].reverse()));
});

test('sorting does not reorder the caller\'s array', () => {
  // `buildBundle` hands the same array to the manifest and to both writers. A
  // writer that sorted in place would be handing back a different value from
  // the one it was given, which is a bug no assertion about its OUTPUT sees.
  //
  // The fixture is built here rather than copied from `FILES`, and the expected
  // order is written out rather than compared against `FILES`. Both were the
  // other way round first, and an in-place sort SURVIVED the mutation run: the
  // earlier tests had already called `writeZip(FILES)`, so the shared fixture
  // was sorted before this test read it and the comparison was against the
  // damage rather than against the original.
  const given = [file('items/rule/RULE-b.md', 'b'), file('config.json', '{}')];
  writeZip(given);
  assert.deepEqual(given.map((f) => f.path), ['items/rule/RULE-b.md', 'config.json']);
});

test('the whole container is pinned, byte for byte, for a known one-entry archive', () => {
  // The assertion the plan's self-comparison cannot make. Every value in here
  // is a constant the writer chose, so a mutation to any one of them — the DOS
  // date, the UTF-8 flag, version made by, the method, an external attribute,
  // a stray extra field — changes these bytes and nothing else could notice.
  // Also a silence audit on the container: a byte that no field claims would
  // show up as a length change here and in no other test.
  assert.equal(
    writeZip([file('config.json', '{}')]).toString('hex'),
    // local header: PK\3\4, v20, flags 0800, method 0, time 0000, date 0021,
    // crc a3a6bf43, csize 2, usize 2, nameLen 11, extraLen 0
    '504b03041400000800000000210043bfa6a302000000020000000b000000'
    // "config.json" then the two bytes of data, stored
    + '636f6e6669672e6a736f6e7b7d'
    // central header: PK\1\2, made by 20, needs 20, flags 0800, method 0,
    // time/date, crc, csize, usize, nameLen 11, extraLen 0, commentLen 0,
    // disk 0, internal 0, external 0, local offset 0
    + '504b010214001400000800000000210043bfa6a302000000020000000b0000000000000000000000000000000000'
    + '636f6e6669672e6a736f6e'
    // EOCD: PK\5\6, disk 0, cd disk 0, 1 entry, 1 entry, cd size 0x39,
    // cd offset 0x2b, comment length 0
    + '504b05060000000001000100390000002b0000000000',
  );
});

test('an empty file set is a valid archive of exactly its end record, and nothing more', () => {
  // `dir-writer.ts` accepts an empty bundle because "wrote nothing" is a real
  // outcome; the same holds here, and the 22 bytes are what "nothing" looks
  // like in this container.
  assert.equal(writeZip([]).toString('hex'), '504b0506000000000000000000000000000000000000');
  assert.deepEqual(readZip(writeZip([])), []);
});

test('entries appear in UTF-8 byte order in the central directory itself', () => {
  // Read from the container rather than through `readZip`, which sorts what it
  // returns: asserting the order through the reader passes with the writer's
  // sort deleted.
  assert.deepEqual(centralNames(writeZip(FILES)),
    ['config.json', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md']);

  // ...and with a fixture that can tell UTF-8 byte order from JavaScript's
  // default. U+1D400 is a surrogate pair beginning D835, so UTF-16 code-unit
  // order puts it BEFORE U+FF21; its UTF-8 encoding begins F0 against EF, so
  // byte order puts it after. Both paths pass `refuseArtefactPath` alone and
  // as a set, checked here so a future refusal cannot silently make this
  // fixture vacuous.
  const astral = 'items/rule/\u{1D400}.md';
  const bmp = 'items/rule/\uFF21.md';
  assert.equal(refuseArtefactPath(astral), null);
  assert.equal(refuseArtefactPath(bmp), null);
  assert.ok(bmp > astral, 'the fixture must disagree with a bare < comparison to be worth anything');
  assert.ok(comparePaths(bmp, astral) < 0, 'UTF-8 byte order puts EF... before F0...');
  assert.deepEqual(centralNames(writeZip([file(astral, 'a'), file(bmp, 'b')])), [bmp, astral]);
});

test('nothing is deflated — a member\'s bytes stand verbatim in the archive', () => {
  // Design decision 10 in the only form the artefact can carry it. A body that
  // any compressor would shrink to a few bytes is asserted to appear at full
  // length, at the offset the header points to.
  const body = 'a'.repeat(4096);
  const z = writeZip([file('config.json', body)]);
  const nameLength = z.readUInt16LE(26);
  assert.equal(z.readUInt16LE(8), 0, 'method 0 — stored');
  assert.deepEqual(z.subarray(30 + nameLength, 30 + nameLength + body.length),
    Buffer.from(body, 'utf8'));
  // ...and the container adds exactly its own headers to it, nothing else.
  assert.equal(z.length, 30 + nameLength + body.length + 46 + nameLength + 22);
});

// --- the byte layout -----------------------------------------------------

test('the local file header carries the fixed values, at the documented offsets', () => {
  const z = writeZip([file('config.json', 'x')]);
  assert.equal(z.readUInt32LE(0), LOCAL_SIG);
  assert.equal(z.readUInt16LE(4), 20, 'version needed');
  assert.equal(z.readUInt16LE(6), 0x0800, 'UTF-8 name flag, always');
  assert.equal(z.readUInt16LE(8), 0, 'method 0 — stored');
  assert.equal(z.readUInt16LE(10), 0x0000, 'time — 00:00:00');
  assert.equal(z.readUInt16LE(12), 0x0021, 'date — 1980-01-01, the lowest DOS can express');
  assert.equal(z.readUInt32LE(14), crc32(Buffer.from('x', 'utf8')) >>> 0);
  assert.equal(z.readUInt32LE(18), 1, 'compressed size');
  assert.equal(z.readUInt32LE(22), 1, 'uncompressed size');
  assert.equal(z.readUInt16LE(26), 11, 'file name length');
  assert.equal(z.readUInt16LE(28), 0, 'no extra field');
  assert.deepEqual(z.subarray(30, 41), Buffer.from('config.json', 'utf8'));
});

test('the central directory file header carries the fixed values, at the documented offsets', () => {
  // Eight of these the plan never reads. External attributes at zero is the
  // whole reason host 0 (FAT) was chosen for version-made-by: on host 3 (Unix)
  // the high half of that field is a file mode, and a writer that let a umask
  // reach it would produce a different archive on two machines from one bundle.
  const z = writeZip(FILES);
  const at = centralAt(z, 1);
  assert.equal(z.readUInt32LE(at), CENTRAL_SIG);
  assert.equal(z.readUInt16LE(at + 4), 20, 'version made by — 2.0, host 0 (FAT)');
  assert.equal(z.readUInt16LE(at + 6), 20, 'version needed');
  assert.equal(z.readUInt16LE(at + 8), 0x0800, 'UTF-8 name flag, always');
  assert.equal(z.readUInt16LE(at + 10), 0, 'method 0 — stored');
  assert.equal(z.readUInt16LE(at + 12), 0x0000, 'time');
  assert.equal(z.readUInt16LE(at + 14), 0x0021, 'date');
  assert.equal(z.readUInt32LE(at + 16), crc32(Buffer.from('aaaa', 'utf8')) >>> 0);
  assert.equal(z.readUInt32LE(at + 20), 4, 'compressed size');
  assert.equal(z.readUInt32LE(at + 24), 4, 'uncompressed size');
  assert.equal(z.readUInt16LE(at + 28), 20, 'file name length');
  assert.equal(z.readUInt16LE(at + 30), 0, 'extra field length');
  assert.equal(z.readUInt16LE(at + 32), 0, 'file comment length');
  assert.equal(z.readUInt16LE(at + 34), 0, 'disk number start');
  assert.equal(z.readUInt16LE(at + 36), 0, 'internal attributes');
  assert.equal(z.readUInt32LE(at + 38), 0, 'external attributes');
  assert.deepEqual(z.subarray(at + 46, at + 66), Buffer.from('items/rule/RULE-a.md', 'utf8'));

  // The local header offset it records really is where that entry begins.
  const local = z.readUInt32LE(at + 42);
  assert.equal(z.readUInt32LE(local), LOCAL_SIG);
  assert.deepEqual(z.subarray(local + 30, local + 50), Buffer.from('items/rule/RULE-a.md', 'utf8'));
});

test('the EOCD is the last 22 bytes and its counts and offsets agree with the directory', () => {
  const z = writeZip(FILES);
  const eocd = eocdAt(z);
  assert.equal(z.readUInt32LE(eocd), EOCD_SIG);
  assert.equal(z.readUInt16LE(eocd + 4), 0, 'this disk');
  assert.equal(z.readUInt16LE(eocd + 6), 0, 'the disk holding the central directory');
  assert.equal(z.readUInt16LE(eocd + 8), FILES.length);
  assert.equal(z.readUInt16LE(eocd + 10), FILES.length);
  assert.equal(z.readUInt32LE(eocd + 16) + z.readUInt32LE(eocd + 12), eocd);
  assert.equal(z.readUInt16LE(eocd + 20), 0, 'no archive comment, so nothing follows this record');
});

test('crc32 is the ZIP checksum, and the unsigned shift is equivalent on this runtime', () => {
  // The plan's version of this test asserts a property no correct
  // implementation can have. It says a signed CRC "writes the wrong bytes",
  // and neither half survives execution: `zlib.crc32` returns an UNSIGNED
  // value already — crc32('the quick brown fox') is 2445345482, a positive
  // number that is 0x91c102ca with bit 31 set — so `>>> 0` cannot change any
  // digest; and `Buffer.writeUInt32LE(-1)` throws ERR_OUT_OF_RANGE rather than
  // writing anything, so a signed digest would crash loudly, never corrupt.
  // The mutation removing `>>> 0` is therefore equivalent, and `zip.ts` says
  // so at the call site.
  //
  // What IS worth pinning is that the digest in the header is the ZIP CRC-32
  // rather than some other checksum, and that a high-bit digest reaches the
  // bytes intact. The plan's own arithmetic fixture does that; its comment
  // names the wrong string for it (0x352441c2 is the CRC of 'abc', not of
  // 'aaa', whose CRC is 0xf007732d and has bit 31 SET — so the plan's
  // "bit 31 clear" control is not a control at all).
  assert.equal(crc32(Buffer.from('abc', 'utf8')) >>> 0, 0x352441c2);
  const highBit = 'the quick brown fox';
  assert.equal(crc32(Buffer.from(highBit, 'utf8')) >>> 0, 0x91c102ca);
  const z = writeZip([file('config.json', highBit)]);
  assert.deepEqual(z.subarray(14, 18), Buffer.from([0xca, 0x02, 0xc1, 0x91]));
  assert.deepEqual(readZip(z)[0]?.bytes, Buffer.from(highBit, 'utf8'));
});

// --- the round trip ------------------------------------------------------

test('the round trip is exact for every byte a corpus can hold', () => {
  const bodies = [
    Buffer.alloc(0),
    Buffer.from('a', 'utf8'),
    Buffer.from('\u05d0\u05d1\u05d2', 'utf8'),
    Buffer.from('\u{1F600}', 'utf8'),
    Buffer.from('line1\nline2\n', 'utf8'),
    Buffer.from('cr\r\nlf\r\n', 'utf8'),
    // Bytes no string round trip survives, built from numbers rather than from
    // a literal: a NUL, a lone 0x80 continuation byte and 0xFF are not text and
    // `check:text-files` refuses a raw NUL in a source file.
    Buffer.from([0x00, 0x80, 0xff, 0x0d, 0x0a, 0x1a]),
    Buffer.from('x'.repeat(70_000), 'utf8'),
  ];
  for (const bytes of bodies) {
    assert.deepEqual(readZip(writeZip([{ path: 'config.json', bytes }]))[0]?.bytes, bytes);
  }
});

test('a present-and-empty history.jsonl survives the ZIP rung as a present-and-empty file', () => {
  // Tasks 4, 5 and 6 settled that absent and zero-byte are different
  // artefacts: `history: false` omits the file and `history: true` with
  // nothing to say writes zero bytes. A container that dropped empty members
  // would collapse the two, and a writer with `if (file.bytes.length)` around
  // its local record passes every other test in this file.
  const withEmpty = writeZip([file('config.json', '{}'), file('history.jsonl', '')]);
  const without = writeZip([file('config.json', '{}')]);
  assert.equal(withEmpty.readUInt16LE(eocdAt(withEmpty) + 10), 2);
  assert.equal(without.readUInt16LE(eocdAt(without) + 10), 1);
  assert.deepEqual(centralNames(withEmpty), ['config.json', 'history.jsonl']);
  assert.deepEqual(readZip(withEmpty).map((f) => [f.path, f.bytes.length]),
    [['config.json', 2], ['history.jsonl', 0]]);
});

test('an entry\'s bytes are its own, not a window onto the archive', () => {
  // A returned `subarray` would keep the whole archive alive and let one
  // caller's write reach into another entry's bytes.
  const z = writeZip([file('config.json', '{}'), file('history.jsonl', 'abcd')]);
  const [config, history] = readZip(z);
  assert.ok(config !== undefined && history !== undefined);
  history.bytes.fill(0x7a);
  assert.deepEqual(config.bytes, Buffer.from('{}', 'utf8'));
  assert.deepEqual(readZip(z)[1]?.bytes, Buffer.from('abcd', 'utf8'));
});

// --- refusals on the way out ---------------------------------------------

test('oversize inputs are refused rather than silently truncated into a broken header', () => {
  // A real 4 GiB Buffer is not a fixture on any machine, so the length is
  // faked and the cast is the honest way to say so: `refuseZipInput` reads
  // `path` and `bytes.length` and nothing else on this route, which is the
  // whole reason the check can run before a byte is allocated. The plan's own
  // version of this fixture does not typecheck at all.
  const huge = { path: 'config.json', bytes: { length: 2 ** 32 } } as unknown as ExportFile;
  assert.match(refuseZipInput([huge]) ?? '', /is 4294967296 bytes, and a ZIP records a size in 32 bits/);
  assert.throws(() => writeZip([huge]), /4294967295 is the largest it can express/);

  const many = Array.from({ length: 70_000 }, (_, i) => file(`items/rule/R-${i}.md`, 'x'));
  assert.match(refuseZipInput(many) ?? '', /has 70000 files, and a ZIP counts its entries in 16 bits/);

  // Two files that each fit in a 32-bit size field and together do not fit in
  // a 32-bit offset. Refused by the archive total, which is a different
  // sentence from the per-file one on purpose.
  const pair = [
    { path: 'items/rule/RULE-a.md', bytes: { length: 2 ** 31 } },
    { path: 'items/rule/RULE-b.md', bytes: { length: 2 ** 31 } },
  ] as unknown as ExportFile[];
  assert.match(refuseZipInput(pair) ?? '', /would be 4294967550 bytes as a ZIP/);
});

test('the name grammar is layout.ts\'s, applied whole, and not a second spelling', () => {
  // The plan's ZIP refusal list names four name rules — backslash, leading
  // slash, ".." and a drive letter — where `refuseArtefactPath` enumerates
  // more than a dozen, each with a reason. A ZIP entry name is data a
  // stranger's extractor acts on, so the list has to be the stricter one, and
  // it has to be the SAME one: two spellings of one rule is how an artefact
  // comes to be legal as a directory and not as an archive.
  for (const [path, sentence] of [
    ['../escape.json', /walks out of the artefact/],
    ['/config.json', /begins with "\/", so it is absolute/],
    ['items\\rule\\RULE-a.md', /contains a backslash/],
    ['C:/config.json', /names a Windows drive letter/],
    // Not on the plan's list, and each lands a stranger's bytes somewhere they
    // did not agree to on a platform the exporter never sees.
    ['items/rule/RULE-a.md:evil', /opens an alternate data stream/],
    ['items/rule/CON.md', /reserved Windows device/],
    ['items/rule/RULE-a.md ', /trailing dot or space/],
    ['.revisions/x.md', /allow-list/],
  ] as const) {
    assert.match(refuseZipInput([file(path, 'x')]) ?? '', sentence);
    assert.throws(() => writeZip([file(path, 'x')]), sentence);
  }
});

test('a colliding pair is refused, and no per-path check could have caught it', () => {
  // Proof by construction that the plural check is load-bearing — and for a
  // ZIP it is not defence in depth, it is the only check that exists. The
  // directory writer hands both names to a real filesystem; this one hands
  // them to a Buffer, which accepts anything, and the receiver is then told
  // one of the two files is missing.
  const collide = [file('items/rule/RULE-a.md', 'a'), file('items/RULE/RULE-b.md', 'b')];
  for (const f of collide) assert.equal(refuseArtefactPath(f.path), null);
  assert.match(refuseZipInput(collide) ?? '', /differ only by case/);

  const twice = [file('config.json', 'a'), file('config.json', 'b')];
  assert.equal(refuseArtefactPath('config.json'), null);
  assert.match(refuseZipInput(twice) ?? '', /is listed twice/);
  // ...and the writer acts on it rather than producing an archive whose second
  // entry silently overwrites its first on extraction.
  assert.throws(() => writeZip(twice), /is listed twice/);
});

// --- refusals on the way in ----------------------------------------------

test('the reader refuses a wrong CRC', () => {
  // Both records are patched. Flipping only the central directory's copy would
  // trip the local-versus-central agreement check first, and this test would
  // then pass with the checksum verification deleted.
  const body = Buffer.from('aaaa', 'utf8');
  const bad = archive([raw('config.json', body, { crc: 0xdeadbeef, localCrc: 0xdeadbeef })]);
  assert.throws(() => readZip(bad), /fails its own checksum: the archive records CRC-32 0xdeadbeef/);
});

test('the reader refuses a wrong size', () => {
  const body = Buffer.from('aaaa', 'utf8');
  // Stored, where the two size fields must be one number.
  assert.throws(
    () => readZip(archive([raw('config.json', body,
      { uncompressedSize: 9, localUncompressedSize: 9 })])),
    /is stored uncompressed and yet declares 4 bytes on disk for 9 bytes of content/,
  );
  // Deflated, where they legitimately differ and only the inflated length can
  // settle it. Declaring more than the stream holds is the case a reader that
  // trusted the header would carry into the manifest check as a short file.
  assert.throws(
    () => readZip(archive([deflated('config.json', body,
      { uncompressedSize: 8, localUncompressedSize: 8 })])),
    /declares 8 bytes and holds 4/,
  );
});

test('the reader refuses an unknown compression method, by number', () => {
  const bad = archive([raw('config.json', Buffer.from('aaaa', 'utf8'),
    { method: 14, localMethod: 14 })]);
  assert.throws(() => readZip(bad), /uses compression method 14/);
  // Refused rather than skipped: an artefact is verified against its manifest,
  // and a file that did not arrive is not a file that is absent.
  assert.throws(() => readZip(bad), /not the same thing as a file that is absent/);
});

test('the reader refuses a traversing name before any entry is decompressed', () => {
  // The name set is screened before a byte of data is touched. Asserting that
  // needs a fixture whose data CANNOT be read: this entry claims to be deflate
  // and is not, so a reader that screened after extracting would refuse it for
  // the wrong reason and this test would say so. A fixture that merely inflates
  // slowly proves nothing, because both orders end in the same sentence.
  const hostile = raw('../../etc/passwd', Buffer.from('not a deflate stream', 'utf8'),
    { method: 8, localMethod: 8, uncompressedSize: 200_000, localUncompressedSize: 200_000 });
  assert.throws(() => readZip(archive([hostile])), /walks out of the artefact/);
  assert.throws(() => readZip(archive([hostile])), /No entry was decompressed/);
});

test('a deflated zero-length member reads back as zero bytes', () => {
  // The one fixture that can tell `Math.max(1, usize)` from a bare `usize`:
  // `maxOutputLength: 0` is ERR_OUT_OF_RANGE on this runtime, so an unbounded
  // spelling of the bound turns an empty deflated entry into a crash from
  // inside zlib about an option the caller never wrote.
  const z = archive([
    deflated('history.jsonl', Buffer.alloc(0)),
    raw('config.json', Buffer.from('{}', 'utf8')),
  ]);
  assert.deepEqual(readZip(z).map((f) => [f.path, f.bytes.length]),
    [['config.json', 2], ['history.jsonl', 0]]);
});

test('the reader refuses a central directory that disagrees with its own end record', () => {
  const z = archive([
    raw('config.json', Buffer.from('{}', 'utf8')),
    raw('history.jsonl', Buffer.from('a', 'utf8')),
  ]);
  const eocd = z.length - 22;

  // Two records, one claimed. The walk stops early and the bytes left over
  // belong to an entry a stricter tool would read and this one would not.
  const short = Buffer.from(z);
  short.writeUInt16LE(1, eocd + 8);
  short.writeUInt16LE(1, eocd + 10);
  assert.throws(() => readZip(short), /entries account for/);

  const otherDisk = Buffer.from(z);
  otherDisk.writeUInt16LE(1, eocd + 4);
  assert.throws(() => readZip(otherDisk), /multi-part archive/);

  const split = Buffer.from(z);
  split.writeUInt16LE(1, eocd + 8);
  assert.throws(() => readZip(split), /says it holds 1 of its 2 entries/);

  // An offset that points at real bytes which are not a local header. Without
  // the signature test this is still refused — the name comparison a few lines
  // later reads a garbage name and reports the archive as "naming one entry
  // two ways" — so the mutant survives any assertion that only says "it
  // throws". The archive is not naming anything twice; its offset is wrong,
  // and the sentence is the whole difference. Asserted by the sentence.
  const misplaced = Buffer.from(z);
  misplaced.writeUInt32LE(z.readUInt32LE(eocd + 16), centralAt(z, 0) + 42);
  assert.throws(() => readZip(misplaced), /where there is no local file header/);
});

test('the reader refuses an archive that names one entry two ways', () => {
  // The plan's reader "reads the local header, skips name and extra, and takes
  // the data". Skipping the name is how one archive means two things: a tool
  // that walks the central directory sees the safe name and one that scans
  // local headers sees the other. Neither reading is wrong, which is why the
  // archive is refused rather than resolved.
  const bad = archive([raw('config.json', Buffer.from('aaaa', 'utf8'),
    { localName: Buffer.from('../../evil.json', 'utf8') })]);
  assert.throws(() => readZip(bad), /names one entry two ways/);
  assert.throws(() => readZip(bad), /"\.\.\/\.\.\/evil\.json"/);
});

test('the reader refuses a local header that disagrees about method, size or checksum', () => {
  const body = Buffer.from('aaaa', 'utf8');
  assert.throws(
    () => readZip(archive([raw('config.json', body, { localMethod: 8 })])),
    /is compressed one way beside its data \(method 8\) and another in the central directory/,
  );
  assert.throws(
    () => readZip(archive([raw('config.json', body, { localCrc: 0x11111111 })])),
    /carries one size and checksum beside its data and a different pair/,
  );
});

test('the reader refuses a Zip64 archive by name rather than misreading it', () => {
  const good = archive([raw('config.json', Buffer.from('{}', 'utf8'))]);
  const zip64 = archive([raw('config.json', Buffer.from('{}', 'utf8'))], { zip64: true });
  assert.deepEqual(readZip(good).map((f) => f.path), ['config.json']);
  assert.throws(() => readZip(zip64), /is a Zip64 archive/);
});

test('the reader refuses a deflate stream that expands past its declared size', () => {
  // 200 KB of one byte deflates to a few hundred. An entry that declares ten
  // bytes and holds this stream is how an archive asks a reader for memory it
  // never agreed to give, and `maxOutputLength` is what stops it.
  const stream = deflateRawSync(Buffer.alloc(200_000, 0x61));
  assert.ok(stream.length < 1000, 'the fixture must actually be a bomb to be worth anything');
  const bad = archive([raw('config.json', stream, {
    method: 8, localMethod: 8,
    uncompressedSize: 10, localUncompressedSize: 10,
  })]);
  assert.throws(() => readZip(bad), /could not be decompressed/);
  assert.throws(() => readZip(bad), /expands past the 10 bytes it declares/);
});

test('the reader refuses a non-ASCII name in an archive that does not claim UTF-8', () => {
  // Bit 11 clear means CP437 by the specification, and `Compress-Archive`
  // leaves it clear. An ASCII name is the same string either way and is taken;
  // a non-ASCII one has no knowable spelling, and guessing produces an item id
  // that is subtly not the author's.
  const name = 'items/rule/RULE-\u05d0.md';
  assert.deepEqual(
    readZip(archive([raw(name, Buffer.from('a', 'utf8'))])).map((f) => f.path), [name],
  );
  const bad = archive([raw(name, Buffer.from('a', 'utf8'), { flags: 0, localFlags: 0 })]);
  assert.throws(() => readZip(bad), /does not set the UTF-8 flag/);
  // ...and bytes that are not valid UTF-8 at all are refused rather than
  // silently turned into U+FFFD, which would make a corrupt name a plausible one.
  const mangled = archive([raw('config.json', Buffer.from('a', 'utf8'), {
    name: Buffer.from([0x63, 0x6f, 0x6e, 0xff, 0x69, 0x67]),
    localName: Buffer.from([0x63, 0x6f, 0x6e, 0xff, 0x69, 0x67]),
  })]);
  assert.throws(() => readZip(mangled), /is not valid UTF-8/);
});

test('the reader refuses a file that is not a ZIP, or one that was truncated', () => {
  assert.throws(() => readZip(Buffer.from('not a zip', 'utf8')), /the smallest possible ZIP is 22/);
  assert.throws(() => readZip(Buffer.alloc(500)), /has no end-of-central-directory record/);
  const z = writeZip(FILES);
  assert.throws(() => readZip(z.subarray(0, z.length - 1)),
    /has no end-of-central-directory record/);
  // A central directory that points past its own end record: truncated, or
  // something was prepended to the file and every offset inside is relative to
  // bytes this reader cannot see.
  const moved = Buffer.from(z);
  moved.writeUInt32LE(z.length, eocdAt(z) + 16);
  assert.throws(() => readZip(moved), /runs past the end record/);
});

// --- tolerance, measured against a real zipper ---------------------------

test('an archive PowerShell produced reads back, deflate and all', () => {
  // Design decision 10's stated user: someone who receives a pack as a
  // directory and re-zips it to pass it on. Method 8 for the content, method 0
  // for the empty file, the UTF-8 flag clear, real timestamps, and entries in
  // that tool's traversal order rather than sorted — all of which this reader
  // has to take, and none of which a hand-built fixture would have thought to
  // include together.
  assert.equal(COMPRESS_ARCHIVE.readUInt16LE(6), 0x0000, 'the fixture leaves the UTF-8 flag clear');
  assert.equal(COMPRESS_ARCHIVE.readUInt16LE(8), 8, 'the fixture really is deflated');
  const files = readZip(COMPRESS_ARCHIVE);
  assert.deepEqual(files.map((f) => f.path), [
    'config.json', 'history.jsonl', 'items/lesson/LESSON-b.md',
    'items/rule/RULE-a.md', 'manifest.json',
  ]);
  assert.deepEqual(files.map((f) => f.bytes.length), [2, 0, 4, 160, 32]);
  assert.deepEqual(files[3]?.bytes, Buffer.from('aaaa'.repeat(40), 'utf8'));
  assert.deepEqual(files[4]?.bytes, Buffer.from('{"protocol":"my_context/pack@1"}', 'utf8'));
});

test('directory entries a real zipper adds are dropped, and a non-empty one is refused', () => {
  // `refuseArtefactPath` refuses a trailing "/" by name — "an artefact lists
  // files" — so a reader that screened before dropping these would refuse the
  // archive the most likely Windows tool produces, which is the exact user
  // design decision 10 accepts method 8 for.
  assert.ok(centralNames(COMPRESS_ARCHIVE_DIRS).includes('items/emptycat/'),
    'the fixture must really carry a directory entry');
  assert.deepEqual(readZip(COMPRESS_ARCHIVE_DIRS).map((f) => f.path),
    ['items/rule/RULE-a.md', 'manifest.json']);

  // Dropped only when it is genuinely empty. A name ending in "/" that carries
  // bytes describes a thing this format has no shape for, and quietly ignoring
  // it would hide content from the manifest check.
  const body = Buffer.from('aaaa', 'utf8');
  assert.throws(() => readZip(archive([raw('items/rule/', body)])),
    /ends in "\/" and so names a directory, yet it carries 4 bytes/);
});

test('the end record is found past a foreign comment, and a false one is not taken for it', () => {
  const commented = archive([raw('config.json', Buffer.from('{}', 'utf8'))],
    { comment: Buffer.from('written by some other tool', 'utf8') });
  assert.deepEqual(readZip(commented).map((f) => f.path), ['config.json']);

  // A comment carrying something that looks exactly like an end record, placed
  // so that a backwards scan reaches it FIRST. Only the comment-length test
  // separates the two: the decoy claims nothing follows it and ten bytes do.
  //
  // The obvious version of this fixture — a MEMBER whose stored bytes contain
  // the signature — cannot fail, and that is written down rather than left in
  // as a test that looks like one: member data lies before the central
  // directory, so a scan starting at `length - 22` and walking down always
  // meets the real record first. It is asserted below only as a round trip.
  const decoy = Buffer.alloc(22);
  decoy.writeUInt32LE(EOCD_SIG, 0);
  const withDecoy = archive([raw('config.json', Buffer.from('{}', 'utf8'))],
    { comment: Buffer.concat([decoy, Buffer.alloc(10, 0x7a)]) });
  assert.equal(withDecoy.readUInt32LE(withDecoy.length - 32), EOCD_SIG,
    'the decoy must really sit later in the file than the record, or this proves nothing');
  assert.deepEqual(readZip(withDecoy).map((f) => f.path), ['config.json']);

  const shaped = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]);
  assert.deepEqual(readZip(writeZip([{ path: 'config.json', bytes: shaped }]))[0]?.bytes, shaped);
});
