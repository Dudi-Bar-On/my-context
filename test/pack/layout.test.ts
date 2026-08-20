/**
 * The comparator and the path rules, which two writers and one reader all
 * share. They live in one module because two implementations that disagree
 * about sort order produce packs that fail to verify, and the disagreement is
 * invisible until a stranger tries to read one.
 *
 * The allow-list lives on the PATH rather than in the walk, so that a walk
 * written later cannot widen it by accident. `.revisions/` is refused here not
 * because it is named but because nothing outside `items/` and the three root
 * files is ever accepted — which is the difference between an allow-list and a
 * deny-list that happens to be up to date today.
 *
 * The Windows half of this file is not defensive tidiness. A pack is authored
 * on one machine and written on another, and every rule below names a spelling
 * that Win32 resolves to a DIFFERENT file from the one the bytes say — a drive
 * letter, a colon, a reserved device, a trailing dot, a case fold. Each one is
 * a way for a stranger's artefact to land somewhere the importer did not agree
 * to, and none of them is visible to a comparison of the path strings.
 *
 * No literal combining character and no literal NUL appears in this file: both
 * are invisible in a diff, and `npm run check:text-files` fails on the second.
 * Every such input is written as an escape and sends the same bytes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { AUDIT_PROTOCOL } from '../../src/core/audit.ts';
import {
  comparePaths, refuseArtefactPath, refuseArtefactPaths,
  PACK_PROTOCOL, PACK_HISTORY_PROTOCOL, IMPORTED_PROTOCOL,
  IMPORTED_UNKNOWN_PROTOCOL, IMPORT_RECORD_PROTOCOL,
  MANIFEST_NAME, HISTORY_NAME, CONFIG_NAME, ITEMS_DIR, ROOT_FILES,
} from '../../src/pack/layout.ts';

test('the pack protocols are distinct from each other and from the live audit protocol', () => {
  const all = [
    PACK_PROTOCOL, PACK_HISTORY_PROTOCOL, IMPORTED_PROTOCOL,
    IMPORTED_UNKNOWN_PROTOCOL, IMPORT_RECORD_PROTOCOL, AUDIT_PROTOCOL,
  ];
  assert.equal(new Set(all).size, all.length);
});

test('the protocol strings and the file names are pinned, because artefacts in the wild carry them', () => {
  // A rename here is not a refactor: it is a format break that every already
  // written artefact would fail to read. Spelled out rather than compared to
  // the module's own constants, which would assert nothing.
  assert.equal(PACK_PROTOCOL, 'my_context/pack@1');
  assert.equal(PACK_HISTORY_PROTOCOL, 'my_context/pack-history@1');
  assert.equal(IMPORTED_PROTOCOL, 'my_context/imported@1');
  assert.equal(IMPORTED_UNKNOWN_PROTOCOL, 'my_context/imported-unknown@1');
  assert.equal(IMPORT_RECORD_PROTOCOL, 'my_context/pack-import@1');
  assert.equal(MANIFEST_NAME, 'manifest.json');
  assert.equal(HISTORY_NAME, 'history.jsonl');
  assert.equal(CONFIG_NAME, 'config.json');
  assert.equal(ITEMS_DIR, 'items');
  assert.deepEqual([...ROOT_FILES].toSorted(), ['config.json', 'history.jsonl', 'manifest.json']);
});

test('comparePaths orders by UTF-8 bytes, not by UTF-16 code units', () => {
  // U+1D400 encodes as F0 9D 90 80 in UTF-8 and as the surrogate pair D835 DC00
  // in UTF-16. Against U+FF21 (EF BC A1 / FF21) the two orderings DISAGREE: by
  // bytes F0 > EF, by code units D835 < FF21. That disagreement is the only
  // reason this comparator exists rather than a bare sort.
  const astral = '\u{1D400}';
  const bmp = '\uFF21';
  assert.ok(comparePaths(astral, bmp) > 0);
  assert.equal([astral, bmp].toSorted()[0], astral, 'the default sort disagrees — which is the point');
});

test('comparePaths is a total order on the paths an artefact really holds', () => {
  const paths = ['items/rule/RULE-b.md', 'config.json', 'items/rule/RULE-a.md', 'history.jsonl'];
  assert.deepEqual(
    paths.toSorted(comparePaths),
    ['config.json', 'history.jsonl', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md'],
  );
  assert.equal(comparePaths('config.json', 'config.json'), 0);
  assert.equal(comparePaths('a', 'b') + comparePaths('b', 'a'), 0, 'antisymmetric');
});

test('every escape and every path outside the allow-list is refused, by name', () => {
  for (const bad of [
    '', '/items/x.md', 'items\\rule\\x.md', 'items/../../etc/passwd', 'C:/items/x.md',
    'items/rule/./x.md', 'items/', '.revisions/revisions.jsonl', '.ingest/session.json',
    '.staging/LESSON-a.json', 'state/focus.json', '.index.db', '.audit/audit.jsonl',
  ]) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /^my_context: /);
  }
});

test('the four legal shapes are accepted', () => {
  for (const good of ['config.json', 'manifest.json', 'history.jsonl', 'items/rule/RULE-a.md']) {
    assert.equal(refuseArtefactPath(good), null, good);
  }
});

test('every refusal quotes the path it refused, so a report never says only that something was wrong', () => {
  for (const bad of [
    '', '/x.md', 'a\\b', 'C:/x.md', 'items/rule/x.md:stream', 'items/..', 'items/./x.md',
    'items//x.md', 'items/rule/x.md/', 'state/focus.json', 'items/rule/x.txt',
    'items/rule/sub/x.md', 'items/.git/x.md', 'items/rule/CON.md', 'items/rule/x.md ',
    'items/rule/x?.md', 'ITEMS/rule/x.md',
  ]) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /^my_context: /);
    assert.ok(
      refusal.includes(JSON.stringify(bad)),
      `refusal of ${JSON.stringify(bad)} does not quote it: ${refusal}`,
    );
  }
});

test('each escape is refused for being an escape, not for having the wrong shape', () => {
  // Every one of these is ALSO refused by the allow-list shape one step
  // later, so an assertion that they are merely refused proves nothing about
  // the checks above it — delete any of those checks and the suite stays
  // green. What is asserted here is the SENTENCE, because the sentence is the
  // whole difference between "items/../RULE-a.md walks out of the artefact"
  // and "items/../RULE-a.md is not items/<type>/<file>.md", and only one of
  // those tells a reader they are looking at an attack.
  const cases: [string, RegExp][] = [
    ['/items/x.md', /absolute/i],
    ['items\\rule\\x.md', /separator/i],
    ['items/', /directory/i],
    ['items//x.md', /empty path segment/i],
    ['items/../RULE-a.md', /walks out/i],
    ['items/../../etc/passwd', /walks out/i],
    ['items/rule/./x.md', /"\." segment/],
  ];
  for (const [bad, expected] of cases) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, expected);
  }
});

test('a Windows drive letter is refused, and the refusal names the drive rather than the shape of a relative walk', () => {
  // KNOWN-repo-containment-guard-is-defeated-across-windows-drive: a guard
  // that decides containment by inspecting a relative string is defeated
  // across drives, because `path.relative('D:\\repo', 'C:\\tmp\\x')` returns
  // an ABSOLUTE path that is neither '..' nor '../'-prefixed. Nothing here
  // computes a relative path at all — the drive spelling is refused outright,
  // which is the only form of that check that cannot be walked around.
  for (const bad of ['C:/items/x.md', 'c:/items/x.md', 'D:items/x.md', 'Z:\\items\\x.md']) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /drive/i);
  }
});

test('a colon anywhere is refused, because on NTFS it opens an alternate data stream', () => {
  // `items/rule/RULE-a.md:evil` writes to a hidden stream OF the item file.
  // The visible file is unchanged, the bytes are there, and no directory
  // listing shows it.
  const refusal = refuseArtefactPath('items/rule/RULE-a.md:evil');
  assert.ok(refusal);
  assert.match(refusal, /stream/i);
});

test('a Windows reserved device name is refused, with any extension and in any case', () => {
  for (const device of [
    'CON', 'con', 'PRN', 'AUX', 'NUL', 'nul', 'COM1', 'com9', 'LPT1', 'lpt9',
    'CONIN$', 'CONOUT$',
  ]) {
    for (const spelling of [device, `${device}.md`, `${device}.tar.md`]) {
      const refusal = refuseArtefactPath(`items/rule/${spelling}`);
      assert.ok(refusal, `items/rule/${spelling} was accepted`);
      assert.match(refusal, /reserved/i);
    }
    // The device name as the CATEGORY segment is the same hazard: nothing
    // validates a category name, so a pack's config can define one.
    assert.ok(refuseArtefactPath(`items/${device}/RULE-a.md`), `items/${device}/ was accepted`);
  }
  // A name that merely starts with a device name is a real name and is kept.
  assert.equal(refuseArtefactPath('items/rule/CONSTRAINT-a.md'), null);
  assert.equal(refuseArtefactPath('items/rule/NULlable-a.md'), null);
});

test('a segment Win32 would silently rewrite — a trailing dot or space — is refused', () => {
  // CreateFile strips both, so `RULE-a.md ` and `RULE-a.md` are one file on
  // Windows and two entries in the manifest. The second write wins and the
  // reader then reports the loser as missing.
  for (const bad of ['items/rule/RULE-a.md ', 'items/rule/RULE-a.md.', 'items/rule /RULE-a.md']) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /trailing/i);
  }
});

test('a control character anywhere in a path is refused, including a NUL', () => {
  for (const bad of [
    'items/rule/RULE-a.md\u0000.txt', 'items/ru\u001ble/RULE-a.md', 'items/rule/a\u007f.md',
  ]) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /control/i);
  }
});

test('a path that is not in NFC is refused, so one name has exactly one spelling', () => {
  // Two byte strings, one name. macOS writes the decomposed form and Windows
  // the composed one, so an artefact carrying both would round-trip on
  // neither. Requiring NFC costs an author with a decomposed category name one
  // rename, and the refusal says which form is wanted.
  const composed = 'items/caf\u00e9/RULE-a.md';
  const decomposed = 'items/cafe\u0301/RULE-a.md';
  assert.notEqual(composed, decomposed);
  assert.equal(refuseArtefactPath(composed), null, 'the composed spelling is legal');
  const refusal = refuseArtefactPath(decomposed);
  assert.ok(refusal, 'the decomposed spelling was accepted');
  assert.match(refusal, /NFC/);
});

test('a segment is measured in UTF-8 bytes, and 255 is the last one that fits', () => {
  const fits = `items/rule/${'a'.repeat(252)}.md`;
  const overflows = `items/rule/${'a'.repeat(253)}.md`;
  assert.equal(refuseArtefactPath(fits), null, '255 bytes must be accepted');
  assert.ok(refuseArtefactPath(overflows), '256 bytes was accepted');
  // Bytes, not characters: 127 two-byte characters plus '.md' is 130
  // characters and 257 bytes, and 255 is a BYTE limit on every filesystem that
  // has one.
  const segment = `${'\u00e9'.repeat(127)}.md`;
  assert.equal(segment.length, 130, 'the segment is under the limit when counted as characters');
  assert.equal(Buffer.byteLength(segment, 'utf8'), 257, 'and over it when counted as bytes');
  assert.ok(
    refuseArtefactPath(`items/rule/${segment}`),
    'a 257-byte segment was accepted because it is only 130 characters',
  );
  assert.ok(
    refuseArtefactPath(`items/${'a'.repeat(256)}/RULE-a.md`),
    'a long category segment was accepted',
  );
});

test('under items/ the shape is exactly <type>/<file>.md — depth and extension are both fixed', () => {
  assert.equal(refuseArtefactPath('items/rule/RULE-a.md'), null);
  for (const bad of [
    'items', 'items/rule', 'items/rule/sub/RULE-a.md', 'items/rule/RULE-a.txt',
    'items/rule/RULE-a', 'items/rule/.md', 'ITEMS/rule/RULE-a.md', 'Items/rule/RULE-a.md',
  ]) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /^my_context: /);
  }
  // A near-miss on the case of `items` is named as such rather than being
  // reported as an unrecognised root, because on Windows it IS the same
  // directory and the author will not otherwise see what they typed.
  assert.match(refuseArtefactPath('ITEMS/rule/RULE-a.md') ?? '', /case/i);

  // The depth rule is load-bearing on its own, and "at least three segments"
  // is the near-miss that looks equivalent and is not. Mutation found it: a
  // fourth segment slips past a `< 3` test, and if the THIRD segment happens
  // to end in ".md" the extension rule waves it through too — so
  // `items/rule/x.md/evil.md` is accepted and a stranger's artefact gets to
  // turn an item file name into a directory on the importer's disk.
  assert.ok(
    refuseArtefactPath('items/rule/RULE-a.md/evil.md'),
    'a fourth segment under a .md-shaped third segment was accepted',
  );
  // And the sentence has to name the shape, not the extension: told only
  // "this is not Markdown", an author renames `sub` instead of flattening the
  // tree that is the actual problem.
  assert.match(
    refuseArtefactPath('items/rule/sub/RULE-a.md') ?? '',
    /is not "items\/<type>\/<file>\.md"/,
  );
});

test('a root file is exactly one of three, matched byte for byte', () => {
  for (const good of ROOT_FILES) assert.equal(refuseArtefactPath(good), null, good);
  for (const bad of ['Manifest.json', 'MANIFEST.JSON', 'manifest.json ', 'readme.md', 'items.json']) {
    assert.ok(refuseArtefactPath(bad), `${JSON.stringify(bad)} was accepted`);
  }
});

test('refuseArtefactPaths accepts the set an artefact really holds, and refuses any illegal member', () => {
  assert.equal(refuseArtefactPaths([
    'config.json', 'history.jsonl', 'manifest.json',
    'items/rule/RULE-a.md', 'items/standard/STD-b.md',
  ]), null);
  assert.equal(
    refuseArtefactPaths([]), null,
    'an empty set is a question for the reader, not for the path rules',
  );
  const refusal = refuseArtefactPaths(['config.json', 'state/focus.json']);
  assert.ok(refusal);
  assert.ok(refusal.includes(JSON.stringify('state/focus.json')));
});

test('two paths that differ only by case are refused as a set, and the refusal names both', () => {
  // Each is legal alone. On NTFS and on default APFS they are ONE file, so a
  // writer produces a tree with one fewer file than the manifest lists and a
  // reader then refuses the artefact for a reason that names the wrong thing.
  assert.equal(refuseArtefactPath('items/rule/RULE-a.md'), null);
  assert.equal(refuseArtefactPath('items/rule/rule-a.md'), null);
  const refusal = refuseArtefactPaths(['items/rule/RULE-a.md', 'items/rule/rule-a.md']);
  assert.ok(refusal, 'the pair was accepted');
  assert.match(refusal, /case/i);
  assert.ok(refusal.includes(JSON.stringify('items/rule/RULE-a.md')), refusal);
  assert.ok(refusal.includes(JSON.stringify('items/rule/rule-a.md')), refusal);
  // The category segment is the same hazard one level up.
  assert.ok(refuseArtefactPaths(['items/rule/RULE-a.md', 'items/RULE/RULE-b.md']));
});

test('two paths that differ only by Unicode normalisation are refused as a set', () => {
  const refusal = refuseArtefactPaths(['items/caf\u00e9/RULE-a.md', 'items/cafe\u0301/RULE-a.md']);
  assert.ok(refusal, 'the pair was accepted');
  assert.match(refusal, /NFC/);
});

test('the same path listed twice is refused, and is not called a case collision', () => {
  const refusal = refuseArtefactPaths(['config.json', 'items/rule/RULE-a.md', 'config.json']);
  assert.ok(refusal);
  assert.match(refusal, /twice|duplicate/i);
  assert.ok(refusal.includes(JSON.stringify('config.json')));
});
