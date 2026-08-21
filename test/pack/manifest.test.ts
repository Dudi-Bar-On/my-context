/**
 * The manifest is TRANSIT INTEGRITY. The last test in this file is the one
 * that matters most: it asserts that nothing this module emits can be read as
 * a statement about the author. A checksum a pack carries about itself proves
 * the files arrived intact and nothing else, and a message that says
 * "verified" without saying what was verified has started doing a job it
 * cannot do.
 *
 * Everything else in here is determinism, and determinism is the manifest's
 * whole job: `config.json`'s BYTES are hashed into it, so two exports of one
 * workspace that differ only in the order something was assembled are two
 * artefacts that fail to verify against each other. Three tests therefore
 * assert byte equality rather than structural equality — a `deepEqual` over
 * two objects would pass for two files that no reader can compare.
 *
 * **Refusals are asserted by their MESSAGE, not by the fact that something
 * threw.** Almost every malformed manifest below breaks more than one rule at
 * once, so a test that asserted only `/^my_context: /` would stay green with
 * any single check deleted — the shape a mutation run reports as a checker
 * that could never fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { VERSION } from '../../src/core/version.ts';
import { MANIFEST_NAME, PACK_PROTOCOL, type ExportFile } from '../../src/pack/layout.ts';
import {
  buildManifest, MANIFEST_MEANING, parseManifest, refuseDescriptiveVersion, refusePackName,
  renderManifest, verifyManifest, type Manifest, type ManifestFile, type ManifestMeta,
} from '../../src/pack/manifest.ts';

const file = (path: string, body: string): ExportFile => ({ path, bytes: Buffer.from(body, 'utf8') });

const FILES = [
  file('items/rule/RULE-b.md', 'b'),
  file('config.json', '{}'),
  file('items/rule/RULE-a.md', 'a'),
];

const META: ManifestMeta = {
  kind: 'pack', name: 'acme', version: '2026-08 rev 3', now: 1_755_000_000_000,
};

const EXPORT_META: ManifestMeta = { kind: 'export', name: null, version: null, now: META.now };

/** The parsed JSON of a manifest, loose enough to be tampered with by key. */
interface ManifestJson {
  [key: string]: unknown;
  files: Record<string, unknown>[];
}

/** A rendered manifest with one deliberate defect, in the bytes a reader gets. */
function tampered(mutate: (m: ManifestJson) => void): Buffer {
  const copy = JSON.parse(renderManifest(buildManifest(FILES, META)).toString('utf8')) as ManifestJson;
  mutate(copy);
  return Buffer.from(`${JSON.stringify(copy, null, 2)}\n`, 'utf8');
}

function entryFor(m: Manifest, path: string): ManifestFile {
  const entry = m.files.find((f) => f.path === path);
  assert.ok(entry, `the manifest has no entry for ${path}`);
  return entry;
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('nothing was refused');
}

// ---------------------------------------------------------------------------
// The byte layout
// ---------------------------------------------------------------------------

test('files are sorted by UTF-8 bytes and the manifest never lists itself', () => {
  const m = buildManifest([...FILES, file(MANIFEST_NAME, 'x')], META);
  assert.deepEqual(
    m.files.map((f) => f.path),
    ['config.json', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md'],
  );
});

test('the sort is over UTF-8 bytes, not UTF-16 code units, so both writers agree above the BMP', () => {
  // U+1D400 encodes F0 9D 90 80 and U+FF21 encodes EF BC A1, so by BYTES the
  // astral name sorts AFTER — while the default sort, over UTF-16 code units,
  // puts the surrogate pair D835 first. The ZIP's entry order is this order,
  // so a manifest that used the default sort and an archive that used the
  // comparator would disagree about the same artefact.
  const m = buildManifest([
    file('items/rule/\u{1D400}.md', 'astral'),
    file('items/rule/\uFF21.md', 'wide'),
  ], META);
  assert.deepEqual(m.files.map((f) => f.path), ['items/rule/\uFF21.md', 'items/rule/\u{1D400}.md']);
});

test('every digest is the full 64-hex SHA-256 of the file bytes', () => {
  const m = buildManifest(FILES, META);
  const entry = entryFor(m, 'items/rule/RULE-a.md');
  assert.equal(entry.sha256, createHash('sha256').update(Buffer.from('a', 'utf8')).digest('hex'));
  assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  assert.equal(entry.bytes, 1);
});

test('the digest is over the file BYTES, so a reordering that no projection would notice changes it', () => {
  // `computeItemChecksum` hashes a JSON PROJECTION and would read these two
  // as the same file. A transit manifest exists to catch exactly the
  // difference a projection throws away — a reordered frontmatter block, a
  // rewritten line ending, a re-indented config.
  const one = buildManifest([file('config.json', '{"a":1,"b":2}')], META);
  const other = buildManifest([file('config.json', '{"b":2,"a":1}')], META);
  assert.notEqual(entryFor(one, 'config.json').sha256, entryFor(other, 'config.json').sha256);
});

test('every key is always present; absence is null, never an omitted key', () => {
  const m = buildManifest(FILES, EXPORT_META);
  assert.deepEqual(
    Object.keys(m),
    ['protocol', 'kind', 'name', 'version', 'generator', 'createdAt', 'itemCount', 'files'],
  );
  assert.equal(m.name, null);
  assert.equal(m.version, null);
  assert.equal(m.itemCount, 2);
  assert.equal(m.protocol, PACK_PROTOCOL);
  assert.equal(m.generator, `mycontext ${VERSION}`);
  assert.equal(m.createdAt, '2025-08-12T12:00:00.000Z');
});

test('itemCount counts item files only, and follows the file set rather than the caller', () => {
  assert.equal(buildManifest([file('config.json', '{}')], META).itemCount, 0);
  assert.equal(buildManifest([...FILES, file('history.jsonl', '')], META).itemCount, 2);
});

test('the rendered bytes are two-space JSON, LF, with exactly one trailing newline', () => {
  const text = renderManifest(buildManifest(FILES, META)).toString('utf8');
  assert.ok(text.endsWith('}\n'));
  assert.equal(text.endsWith('}\n\n'), false);
  assert.ok(text.includes('\n  "protocol"'));
  assert.equal(text.includes('\r'), false);
});

// ---------------------------------------------------------------------------
// Determinism — the manifest's whole job
// ---------------------------------------------------------------------------

test('rendering is byte-identical across runs for a fixed clock', () => {
  assert.deepEqual(
    renderManifest(buildManifest(FILES, META)),
    renderManifest(buildManifest(FILES, META)),
  );
});

test('the clock is injected, and a caller that passes something that is not a time is refused', () => {
  // `createdAt` is the one field a manifest carries that cannot be recomputed
  // from the corpus, which is why it is passed in rather than read here. A
  // caller that passes nothing would otherwise stamp the epoch — a manifest
  // dated 1970 that still verifies — so the value is checked rather than
  // coerced.
  for (const bad of [Number.NaN, Infinity, -Infinity, 1e16, undefined as unknown as number]) {
    assert.match(refusalOf(() => buildManifest(FILES, { ...META, now: bad })), /not a time/);
  }
  assert.equal(buildManifest(FILES, { ...META, now: 0 }).createdAt, '1970-01-01T00:00:00.000Z');
});

test('a differently ordered input produces the identical manifest, byte for byte', () => {
  // The same workspace, walked in a different order — a filesystem that
  // returns entries in inode order, a selection built from a Set. Two
  // artefacts whose manifests differ do not verify against each other, and
  // `config.json`'s bytes are hashed in here, so this is the property the
  // whole module exists to hold.
  const shuffled = [FILES[2], FILES[0], FILES[1]] as ExportFile[];
  assert.deepEqual(
    renderManifest(buildManifest(shuffled, META)),
    renderManifest(buildManifest(FILES, META)),
  );
});

test('the rendered bytes do not depend on the key order of the object they came from', () => {
  // A `Manifest` can also be built by hand or by a future caller assembling
  // the fields in whatever order reads best. `JSON.stringify` follows
  // insertion order, so the renderer writes its own literal rather than the
  // caller's — otherwise the format would depend on how the value was built.
  const m = buildManifest(FILES, META);
  const reversed = Object.fromEntries(Object.entries(m).toReversed()) as unknown as Manifest;
  assert.deepEqual(Object.keys(reversed)[0], 'files', 'the fixture is not actually reordered');
  assert.deepEqual(renderManifest(reversed), renderManifest(m));
});

test('a manifest survives render → parse → render unchanged, byte for byte', () => {
  const bytes = renderManifest(buildManifest(FILES, META));
  assert.deepEqual(parseManifest(bytes), buildManifest(FILES, META));
  assert.deepEqual(renderManifest(parseManifest(bytes)), bytes);
});

// ---------------------------------------------------------------------------
// parseManifest — a stranger's file
// ---------------------------------------------------------------------------

test('parseManifest refuses a foreign protocol, a short digest, an out-of-order array and a missing key', () => {
  const mutations: ((m: ManifestJson) => void)[] = [
    (m) => { m.protocol = 'someone/else@1'; },
    (m) => { m.files[0].sha256 = 'abc'; },
    (m) => { m.files.reverse(); },
    (m) => { delete m.itemCount; },
  ];
  for (const mutate of mutations) {
    assert.throws(() => parseManifest(tampered(mutate)), /my_context:/);
  }
});

test('each parse refusal names its own problem, because almost every defect breaks a second rule too', () => {
  // Reversing the array also leaves `files` unsorted AND the first entry's
  // digest where a reader does not expect it; deleting `itemCount` also makes
  // the count disagree. A test that asserted only that something threw would
  // stay green with any one of these checks deleted.
  const cases: [(m: ManifestJson) => void, RegExp][] = [
    [(m) => { m.protocol = 'someone/else@1'; }, /protocol/i],
    // Not merely /"kind"/: the sentence about an export carrying a name says
    // that too, and it is the one that fires when the kind check is deleted.
    [(m) => { m.kind = 'archive'; }, /either "export"/],
    [(m) => { m.files[0].sha256 = 'abc'; }, /64 lowercase hex/],
    [(m) => { m.files[0].sha256 = (m.files[0].sha256 as string).toUpperCase(); }, /64 lowercase hex/],
    [(m) => { m.files.reverse(); }, /ascending order/],
    // A DELETED key must be refused as deleted. Every one of these also fails
    // its own value check one step later — `undefined` is not a count, is not
    // an array, is not a string — so /"itemCount"/ alone would stay green with
    // the whole always-present rule removed.
    [(m) => { delete m.itemCount; }, /has no "itemCount" key/],
    [(m) => { delete (m as Record<string, unknown>).files; }, /has no "files" key/],
    [(m) => { delete m.name; }, /has no "name" key/],
    [(m) => { m.itemCount = 99; }, /lists 2 file\(s\)/],
    [(m) => { m.itemCount = '2'; }, /not a count/],
    [(m) => { m.signature = 'x'; }, /"signature"/],
    [(m) => { m.files[0].bytes = -1; }, /"bytes"/],
    [(m) => { m.files[0].mode = 493; }, /"mode"/],
    [(m) => { delete m.files[0].path; }, /"path"/],
    [(m) => { m.files[0] = 'not an entry' as unknown as Record<string, unknown>; }, /not an object/],
    [(m) => { m.createdAt = '2026-08-20 09:12:44'; }, /createdAt/],
    [(m) => { m.createdAt = '2026-02-31T00:00:00.000Z'; }, /createdAt/],
    // `new Date(x).toISOString()` returns this string unchanged — it is the
    // top of the representable range — so the round trip accepts it and only
    // the shape refuses it. Without the shape rule there is no rule.
    [(m) => { m.createdAt = '+275760-09-13T00:00:00.000Z'; }, /createdAt/],
    [(m) => { m.generator = ''; }, /generator/],
    [(m) => { m.files = 'not an array' as unknown as Record<string, unknown>[]; }, /not an array/],
    [(m) => { m.files[0].path = 'items/rule/../../etc/passwd'; }, /walks out/],
    [(m) => { m.files.push({ path: MANIFEST_NAME, bytes: 1, sha256: 'e'.repeat(64) }); }, /cannot hash itself/],
  ];
  for (const [mutate, expected] of cases) {
    const message = refusalOf(() => parseManifest(tampered(mutate)));
    assert.match(message, /^my_context: /);
    assert.match(message, expected);
  }
});

test('each of the three set-level refusals says which side the bad set came from', () => {
  // One rule, three callers, and the caller is the whole difference between
  // "your export is about to write two files that are one file on Windows",
  // "the manifest you received lists one file twice" and "the directory
  // beside it does". A shared sentence with the wrong lead sends a reader to
  // someone else's machine.
  const twice = [file('config.json', '{}'), file('config.json', 'evil')];
  assert.match(refusalOf(() => buildManifest(twice, META)), /this export would not be one artefact/);
  assert.match(
    refusalOf(() => verifyManifest(buildManifest(FILES, META), twice)),
    /files found beside this manifest/,
  );
  assert.match(
    refusalOf(() => parseManifest(tampered((m) => { m.files[0].path = 'items/rule/x.md/'; }))),
    /manifest\.json does not list one artefact's worth/,
  );
});

test('a manifest listing one file twice is refused, and is not called a case collision', () => {
  // Two entries for one path, with two digests, is how a tampered file passes
  // verification: a reader that indexes the list by path keeps whichever
  // entry it saw last and checks the bytes against that one.
  const message = refusalOf(() => parseManifest(tampered((m) => {
    m.files.push({ ...m.files[1] as Record<string, unknown>, sha256: 'f'.repeat(64) });
    m.files.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  })));
  assert.match(message, /listed twice/);
});

test('a manifest whose paths collide on a case-insensitive filesystem is refused before it is written', () => {
  const collision = refusalOf(() => buildManifest([
    file('items/rule/RULE-a.md', 'a'), file('items/rule/rule-a.md', 'A'),
  ], META));
  assert.match(collision, /differ only by case/);
  // The directory form is the one that verifies on Linux and fails on
  // Windows: both files are written, one lands under a spelling the manifest
  // does not use, and the author cannot reproduce the failure.
  const directories = refusalOf(() => buildManifest([
    file('items/rule/RULE-a.md', 'a'), file('items/RULE/RULE-b.md', 'b'),
  ], META));
  assert.match(directories, /directories/);
});

test('a path outside the allow-list never reaches a manifest, in either direction', () => {
  assert.match(
    refusalOf(() => buildManifest([file('.revisions/revisions.jsonl', '{}')], META)),
    /allow-list/,
  );
  assert.match(
    refusalOf(() => parseManifest(tampered((m) => { m.files[0].path = 'C:/items/rule/x.md'; }))),
    /drive/,
  );
});

test('manifest.json is refused as bytes a reader could have received, not only as bad JSON', () => {
  const good = renderManifest(buildManifest(FILES, META));
  const cases: [Buffer, RegExp][] = [
    [Buffer.alloc(0), /is empty/],
    [Buffer.from(`\uFEFF${good.toString('utf8')}`, 'utf8'), /byte order mark/i],
    [Buffer.from(good.toString('utf8').replace(/\n/g, '\r\n'), 'utf8'), /carriage return/i],
    [good.subarray(0, good.length - 1), /trailing newline/],
    [Buffer.concat([good, Buffer.from('\n')]), /trailing newline/],
    [Buffer.from('{"protocol": nope}\n', 'utf8'), /not valid JSON/],
    [Buffer.from('[]\n', 'utf8'), /JSON object/],
    [Buffer.from('null\n', 'utf8'), /JSON object/],
  ];
  for (const [bytes, expected] of cases) {
    const message = refusalOf(() => parseManifest(bytes));
    assert.match(message, /^my_context: /);
    assert.match(message, expected);
  }
});

// ---------------------------------------------------------------------------
// kind, name and version
// ---------------------------------------------------------------------------

test('a pack manifest carries a name and a version; an export manifest carries neither', () => {
  assert.match(
    refusalOf(() => buildManifest(FILES, { ...META, name: null })),
    /pack's name/,
  );
  assert.match(
    refusalOf(() => buildManifest(FILES, { ...META, version: null })),
    /pack's version/,
  );
  assert.match(
    refusalOf(() => buildManifest(FILES, { ...EXPORT_META, name: 'acme' })),
    /"export"/,
  );
  assert.match(
    refusalOf(() => parseManifest(tampered((m) => { m.kind = 'export'; }))),
    /"export"/,
  );
  assert.match(
    refusalOf(() => parseManifest(tampered((m) => { m.name = null; }))),
    /pack's name/,
  );
});

test('a descriptive version is opaque: required, trimmed, bounded, and never parsed', () => {
  assert.equal(refuseDescriptiveVersion('2026-08 rev 3'), null);
  assert.equal(refuseDescriptiveVersion('v1'), null);
  assert.equal(refuseDescriptiveVersion('the one with the SQL rules'), null);
  for (const bad of [undefined, null, '', '   ', 42, 'x'.repeat(65)]) {
    assert.ok(refuseDescriptiveVersion(bad), String(bad));
  }
});

test('each refusal of a name or a version names the reason, and the two fields are named apart', () => {
  const cases: [unknown, RegExp][] = [
    [undefined, /not a string/],
    [null, /not a string/],
    [42, /not a string/],
    ['', /is empty/],
    ['   ', /only whitespace/],
    [' acme ', /leading or trailing whitespace/],
    ['x'.repeat(65), /65 code points/],
    ['acme\nsecurity', /control character/],
    ['acme\u0000', /control character/],
    ['e\u0301clair', /NFC/],
  ];
  for (const [bad, expected] of cases) {
    const name = refusePackName(bad);
    assert.ok(name, `refusePackName accepted ${JSON.stringify(bad)}`);
    assert.match(name, /^my_context: /);
    assert.match(name, expected);
    assert.match(name, /name/);
    const version = refuseDescriptiveVersion(bad);
    assert.ok(version, `refuseDescriptiveVersion accepted ${JSON.stringify(bad)}`);
    assert.match(version, expected);
    assert.match(version, /version/);
  }
});

test('the bound is 64 CODE POINTS, so an emoji name is not charged twice for one character', () => {
  // `'\u{1F510}'.length` is 2 — a name of 64 emoji is 128 UTF-16 units and 64
  // characters, and the spec says code points. A bound spelled `v.length`
  // would refuse a legal name and would do it only for authors outside the
  // BMP.
  assert.equal(refusePackName('\u{1F510}'.repeat(64)), null);
  const refusal = refusePackName('\u{1F510}'.repeat(65));
  assert.ok(refusal, 'a 65 code point name was accepted');
  assert.match(refusal, /65 code points/);
});

test('a name is refused rather than normalised, because its bytes are in the manifest', () => {
  // The same rule Task 1 fixed for paths: rewriting a name would change the
  // bytes the manifest hashed, and `.audit/imported/<pack>/` and
  // `review promote --all --pack <name>` both compare the name later. Two
  // spellings of one visible name are two packs.
  const decomposed = 'e\u0301clair';
  const refusal = refusePackName(decomposed);
  assert.ok(refusal);
  assert.ok(refusal.includes(JSON.stringify(decomposed.normalize('NFC'))), refusal);
  assert.equal(refusePackName(decomposed.normalize('NFC')), null);
});

// ---------------------------------------------------------------------------
// verifyManifest
// ---------------------------------------------------------------------------

test('verifyManifest names missing, extra and mismatched files separately', () => {
  const m = buildManifest(FILES, META);
  const present = [
    file('config.json', '{}'),
    file('items/rule/RULE-a.md', 'CHANGED'),
    file('items/rule/RULE-z.md', 'z'),
  ];
  const v = verifyManifest(m, present);
  assert.deepEqual(v.missing, ['items/rule/RULE-b.md']);
  assert.deepEqual(v.extra, ['items/rule/RULE-z.md']);
  assert.deepEqual(v.mismatched, ['items/rule/RULE-a.md']);
});

test('an intact artefact verifies clean, whether or not the caller filtered manifest.json out', () => {
  const m = buildManifest(FILES, META);
  const clean = { missing: [], extra: [], mismatched: [] };
  assert.deepEqual(verifyManifest(m, FILES), clean);
  // The reader walks a directory and finds `manifest.json` in it. It is the
  // one file no digest covers, so it is not a subject of verification —
  // reporting it as `extra` would refuse every artefact ever written.
  assert.deepEqual(verifyManifest(m, [...FILES, file(MANIFEST_NAME, 'anything')]), clean);
});

test('every verdict list is in UTF-8 byte order, so two readers report one artefact one way', () => {
  const m = buildManifest([
    file('items/rule/\uFF21.md', 'wide'), file('items/rule/\u{1D400}.md', 'astral'),
    file('items/rule/RULE-a.md', 'a'),
  ], META);
  // `present` is deliberately handed over in the opposite order, because a
  // directory walk returns whatever the filesystem returns.
  const v = verifyManifest(m, [
    file('items/rule/\u{1D400}-extra.md', 'astral'),
    file('items/rule/RULE-a.md', 'CHANGED'),
    file('items/rule/\uFF21-extra.md', 'wide'),
    file('items/rule/\uFF21.md', 'CHANGED'),
  ]);
  assert.deepEqual(v.missing, ['items/rule/\u{1D400}.md']);
  assert.deepEqual(v.mismatched, ['items/rule/RULE-a.md', 'items/rule/\uFF21.md']);
  // EF BC A1 sorts before F0 9D 90 80 by bytes; the default sort, over UTF-16
  // code units, puts the surrogate pair first and disagrees.
  assert.deepEqual(v.extra, ['items/rule/\uFF21-extra.md', 'items/rule/\u{1D400}-extra.md']);
});

test('verifyManifest refuses a file set no single artefact could hold', () => {
  // Two entries for one path is how a tampered file hides: the map keeps one,
  // and the digest is checked against bytes the reader may not be the one to
  // open. The reader guards its walk too — a guard enforced only in the
  // caller that remembers is not a guard.
  const m = buildManifest(FILES, META);
  assert.match(
    refusalOf(() => verifyManifest(m, [file('config.json', '{}'), file('config.json', 'evil')])),
    /listed twice/,
  );
  assert.match(
    refusalOf(() => verifyManifest(m, [file('items/rule/RULE-a.md', 'a'), file('items/rule/rule-a.md', 'A')])),
    /differ only by case/,
  );
});

// ---------------------------------------------------------------------------
// The sentence this module may never say
// ---------------------------------------------------------------------------

test('the one sentence about what a manifest means carries its condition in itself', () => {
  assert.match(MANIFEST_MEANING, /intact/);
  assert.match(MANIFEST_MEANING, /says nothing about/);
  assert.equal(/\bverified\b/.test(MANIFEST_MEANING), false, 'a bare "verified" is the claim');
});

test('nothing this module emits describes the manifest as evidence of trust', () => {
  const source = readFileSync(new URL('../../src/pack/manifest.ts', import.meta.url), 'utf8');
  for (const forbidden of [/\btrusted\b/i, /\bsafe to\b/i, /\bauthentic/i, /\bsigned by\b/i, /\bverified author/i]) {
    assert.equal(forbidden.test(source), false, `manifest.ts says ${forbidden}`);
  }
});
