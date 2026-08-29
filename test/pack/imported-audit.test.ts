/**
 * Where a stranger's history lands, and what is counted.
 *
 * The three properties these tests exist for, because none of them is visible
 * by reading the module:
 *
 *  1. **The live audit reader cannot see any of this.** Two independent walls
 *     hold that up — a SUBDIRECTORY, which the segment enumerator's two name
 *     shapes do not match, and a PROTOCOL, which the live parser refuses on
 *     every line. Each is asserted separately, because either one alone would
 *     make the other's test pass and a single wall is one refactor from none.
 *  2. **A quarantined row loses nothing.** It is wrapped, never rewritten, so
 *     the original object comes back out of the file byte for byte — that is
 *     what makes "counted here, nothing dropped" true rather than reassuring.
 *  3. **A pack name is not a path.** It arrives from a stranger, and the two
 *     ways it could stop naming its own directory — slugging to nothing, and
 *     slugging onto the one reserved name — are refused rather than resolved.
 *
 * The byte layouts are asserted as KEY ORDER, not just as values: the plan
 * specifies the order of both JSONL shapes and of `import.json`, and a
 * reader diffing two exports is the one who pays when it drifts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLogPath, auditSegments, readAudit, recordAudit } from '../../src/core/audit.ts';
import { PACK_HISTORY_PROTOCOL } from '../../src/pack/layout.ts';
import type { PackHistoryRecord } from '../../src/pack/history.ts';
import {
  importedDir, originKey, packDir, packDirFor, quarantine, readImportRecords, readImportedHistory,
  readQuarantine, unknownDir, writeImportRecord, writeImportedHistory,
  type ImportRecord, type PackKey,
} from '../../src/pack/imported-audit.ts';
import { removeTree } from '../helpers/tmp.ts';

const scratch: string[] = [];

/** A workspace root whose `.audit` already holds one real, local record. */
function workspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-imp-'));
  scratch.push(dir);
  const written = recordAudit(dir, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-local',
  });
  assert.equal(written.written, true, 'the fixture needs a live log to be invisible beside');
  return dir;
}

test.after(() => {
  for (const dir of scratch) removeTree(dir);
});

/**
 * The two halves of one import's key.
 *
 * `origin` defaults to a path made from the name, so a test that is not about
 * the collision gets one import per name and reads the way it always did; a
 * test that IS about it passes two origins under one name deliberately.
 */
function key(name: string, origin: string = `/artefacts/${name}.zip`): PackKey {
  return { name, origin, source: origin };
}

/** One record as it travelled, before this module restamps it. */
function travelled(over: Partial<PackHistoryRecord> = {}): PackHistoryRecord {
  return {
    protocol: PACK_HISTORY_PROTOCOL,
    at: '2026-08-20T09:12:44.031Z',
    kind: 'mutation',
    op: 'create',
    origin: 'human',
    itemId: 'RULE-b',
    ...over,
  };
}

/** A complete import record; each test overrides what it is about. */
function record(over: Partial<ImportRecord> = {}): ImportRecord & { origin: string } {
  return {
    protocol: 'my_context/pack-import@1',
    pack: 'acme-security',
    version: '2026-08 rev 3',
    kind: 'pack',
    source: '../packs/acme-security.zip',
    origin: '/home/dev/packs/acme-security.zip',
    importedAt: '2026-08-20T09:12:44.031Z',
    manifestFiles: 24,
    items: ['CONST-node-24-or-newer', 'RULE-never-log-a-token'],
    historyRecords: 41,
    quarantined: 2,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// The two walls
// ---------------------------------------------------------------------------

test('imported history is invisible to the live audit reader', () => {
  const root = workspace();

  writeImportedHistory(root, key('acme'), [travelled(), travelled({ op: 'update' })]);

  assert.deepEqual(auditSegments(root).filter((f) => f.includes('imported')), []);
  assert.doesNotThrow(() => readAudit(root), 'the live reader must not even see it');
  assert.equal(readAudit(root).length, 1, 'only the workspace\'s own record');

  // The byte layout, asserted as the order it is specified in.
  const [first] = readFileSync(path.join(packDir(root, key('acme')), 'history.jsonl'), 'utf8')
    .split('\n');
  assert.deepEqual(Object.keys(JSON.parse(first) as object), [
    'protocol', 'pack', 'at', 'kind', 'op', 'origin', 'itemId',
  ]);
  assert.deepEqual(readImportedHistory(root, key('acme')).map((r) => r.op), ['create', 'update']);
});

test('a stray copy of an imported record into audit.jsonl is refused by the live reader', () => {
  const root = workspace();
  writeImportedHistory(root, key('acme'), [travelled()]);
  const [importedRecord] = readImportedHistory(root, key('acme'));

  appendFileSync(auditLogPath(root), `${JSON.stringify(importedRecord)}\n`);

  assert.throws(() => readAudit(root), /my_context:/);
});

// ---------------------------------------------------------------------------
// The quarantine
// ---------------------------------------------------------------------------

test('quarantine returns the count and loses nothing from the original row', () => {
  const root = workspace();
  const alienRow = {
    protocol: PACK_HISTORY_PROTOCOL,
    at: '2026-08-20T09:12:44.031Z',
    kind: 'mutation',
    op: 'annotate',
    origin: 'human',
    itemId: 'RULE-b',
    sessionId: 'a field this build does not project',
  };

  // Line 40 of a file whose first row was fine: the reader is the only thing
  // that saw the bytes, so its number is written down and not renumbered here.
  const n = quarantine(root, key('acme'), [{ row: alienRow, line: 40 }], 'history.jsonl');

  assert.equal(n, 1);
  const [wrapped] = readQuarantine(root);
  assert.deepEqual(wrapped.record, alienRow);
  assert.equal(wrapped.line, 40);
  assert.equal(wrapped.pack, 'acme');
  assert.equal(wrapped.source, 'history.jsonl');
  assert.deepEqual(Object.keys(wrapped), [
    'protocol', 'pack', 'at', 'source', 'line', 'record',
  ]);
  assert.equal(
    quarantine(root, key('acme'), [], 'history.jsonl'), 0, 'nothing to file is not an error',
  );
});

test('a row whose line could not be established is filed with a null line, not a made-up one', () => {
  // `null` is written rather than the key being left out: an absent key reads
  // as an older build that never had the field, and any NUMBER here would be
  // one this function invented about a file it never opened.
  const root = workspace();
  const alienRow = { protocol: PACK_HISTORY_PROTOCOL, op: 'annotate' };

  quarantine(root, key('acme'), [{ row: alienRow, line: null }], 'history.jsonl');

  const [wrapped] = readQuarantine(root);
  assert.equal(wrapped.line, null);
  assert.deepEqual(Object.keys(wrapped), [
    'protocol', 'pack', 'at', 'source', 'line', 'record',
  ]);
  assert.match(
    readFileSync(path.join(unknownDir(root), 'quarantine.jsonl'), 'utf8'),
    /"line":null/,
    'the key is on the line, saying so, rather than missing from it',
  );
});

// ---------------------------------------------------------------------------
// A pack name is not a key
// ---------------------------------------------------------------------------

test('a pack name becomes the parent slug, and the origin names the leaf', () => {
  const root = workspace();

  assert.equal(
    packDir(root, key('Acme Security!', '/p/a.zip')),
    path.join(importedDir(root), 'acme-security', originKey('/p/a.zip')),
  );
  // The NAME half normalises exactly as an id's slug does, with the origin
  // held fixed so that this line is about the name and nothing else.
  assert.equal(
    packDir(root, key('acme security', '/p/a.zip')),
    packDir(root, key('Acme  Security', '/p/a.zip')),
  );
  assert.notEqual(
    packDir(root, key('acme-security', '/p/a.zip')),
    packDir(root, key('acme-standards', '/p/a.zip')),
  );

  // The one name that would land a pack in the quarantine directory. It is
  // refused rather than resolved: two writers in one directory is exactly the
  // sharing this test is named after.
  assert.throws(() => packDir(root, key('Unknown')), /my_context:/);
  assert.equal(unknownDir(root), path.join(importedDir(root), 'unknown'));
});

test('a pack name that slugs to nothing is refused rather than writing to an unnamed directory', () => {
  const root = workspace();
  for (const name of ['', '   ', '!!!', '---']) {
    assert.throws(() => packDir(root, key(name)), /my_context:/, JSON.stringify(name));
  }
});

/**
 * The defect this key exists for, at the level it is decided.
 *
 * Filed by name alone, the second write landed on the first one's `import.json`
 * and its history was appended to the first one's `history.jsonl` under the one
 * name they shared — a membership list gone with nobody told, and two
 * strangers' mutation logs interleaved past telling apart. The name is a string
 * the PACK chose; only the origin is this workspace's own.
 */
test('two packs that call themselves the same thing do not share a directory', () => {
  const root = workspace();
  const first = key('acme-security', '/artefacts/vendor-a/acme.zip');
  const second = key('acme-security', '/artefacts/vendor-b/acme.zip');

  assert.notEqual(packDir(root, first), packDir(root, second));
  assert.equal(
    path.dirname(packDir(root, first)), path.dirname(packDir(root, second)),
    'the readable half is still the name, so both are findable under it',
  );

  writeImportedHistory(root, first, [travelled({ itemId: 'RULE-a' })]);
  writeImportedHistory(root, second, [travelled({ itemId: 'RULE-b' })]);
  writeImportRecord(root, record({ ...first, pack: first.name, items: ['RULE-a'] }));
  writeImportRecord(root, record({ ...second, pack: second.name, items: ['RULE-b'] }));

  // Two histories, neither carrying the other's row.
  assert.deepEqual(readImportedHistory(root, first).map((r) => r.itemId), ['RULE-a']);
  assert.deepEqual(readImportedHistory(root, second).map((r) => r.itemId), ['RULE-b']);

  // Two records, and the first one's membership list is still what it was.
  const back = readImportRecords(root);
  assert.deepEqual(back.map((r) => r.items), [['RULE-a'], ['RULE-b']]);
  assert.deepEqual(back.map((r) => r.pack), ['acme-security', 'acme-security']);
});

test('the SAME pack imported again updates its record rather than filing a second', () => {
  const root = workspace();
  const same = key('acme-security', '/artefacts/acme.zip');

  writeImportRecord(root, record({ ...same, pack: same.name, items: ['RULE-a'] }));
  writeImportRecord(root, record({
    ...same, pack: same.name, items: ['RULE-a', 'RULE-b'], importedAt: '2026-08-22T00:00:00.000Z',
  }));

  const back = readImportRecords(root);
  assert.equal(back.length, 1, 're-importing one pack must not duplicate it');
  assert.deepEqual(back[0].items, ['RULE-a', 'RULE-b']);
  assert.equal(back[0].importedAt, '2026-08-22T00:00:00.000Z');
});

/**
 * The migration, asserted rather than described.
 *
 * A record written before the key had two halves sits at `<slug>/import.json`.
 * Nothing moves it, renames it or rewrites it — rekeying history quietly would
 * be this defect's own shape a second time, done to the only records that
 * cannot be re-derived from anything. It is listed where it is, a re-import of
 * the same artefact updates it in place, and a DIFFERENT pack of that name
 * takes its own leaf and cannot touch it.
 */
test('a record filed by an older build is read, adopted and never moved', () => {
  const root = workspace();
  const legacyDir = path.join(importedDir(root), 'acme-security');
  const legacyFile = path.join(legacyDir, 'import.json');
  const legacy = record({ source: '../packs/acme.zip', items: ['RULE-old'] });
  delete (legacy as { origin?: string }).origin;
  mkdirSync(legacyDir, { recursive: true });
  writeFileSync(legacyFile, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8');

  // It is listed exactly where it is.
  assert.deepEqual(readImportRecords(root).map((r) => r.items), [['RULE-old']]);

  // The same artefact again: matched on the one field the legacy record has
  // that says where it came from, and written back to the same file.
  const same = { name: 'acme-security', origin: '/wherever/acme.zip', source: '../packs/acme.zip' };
  assert.equal(packDirFor(root, same), legacyDir);
  writeImportRecord(root, record({ ...same, pack: same.name, items: ['RULE-old', 'RULE-new'] }));
  assert.deepEqual(readImportRecords(root).map((r) => r.items), [['RULE-new', 'RULE-old']]);
  assert.equal(readImportRecords(root).length, 1, 'adoption, not a second row');

  // A different pack of the same name: its own leaf, and the legacy record
  // still holds the list it held one line ago.
  const other = { name: 'acme-security', origin: '/elsewhere/acme.zip', source: './other.zip' };
  assert.notEqual(packDirFor(root, other), legacyDir);
  writeImportRecord(root, record({ ...other, pack: other.name, items: ['RULE-other'] }));
  assert.deepEqual(
    readImportRecords(root).map((r) => r.items), [['RULE-new', 'RULE-old'], ['RULE-other']],
    'the legacy record comes first because it was there first, and it still holds its own list',
  );
});

// ---------------------------------------------------------------------------
// The import record
// ---------------------------------------------------------------------------

test('the import record round-trips and its items list is sorted', () => {
  const root = workspace();
  const unsorted = record({ items: ['RULE-never-log-a-token', 'CONST-node-24-or-newer'] });

  const written = writeImportRecord(root, unsorted);

  assert.equal(written, path.join(
    packDir(root, { name: 'acme-security', origin: unsorted.origin, source: unsorted.source }),
    'import.json',
  ));
  const raw = readFileSync(written, 'utf8');
  assert.ok(raw.endsWith('}\n'), 'two-space JSON with exactly one trailing newline');
  assert.deepEqual(Object.keys(JSON.parse(raw) as object), [
    'protocol', 'pack', 'version', 'kind', 'source', 'origin', 'importedAt',
    'manifestFiles', 'items', 'historyRecords', 'quarantined',
  ]);

  writeImportRecord(root, record({ pack: 'beta-pack', items: [] }));
  const back = readImportRecords(root);
  assert.deepEqual(back.map((r) => r.pack), ['acme-security', 'beta-pack']);
  assert.deepEqual(back[0], record());
  assert.deepEqual(
    back[0].items, ['CONST-node-24-or-newer', 'RULE-never-log-a-token'],
    'the membership list is sorted with the comparator, whatever order it arrived in',
  );
});

test('the .audit gitignore covers the new subdirectories', () => {
  const root = workspace();
  writeImportedHistory(root, key('acme'), [travelled()]);
  quarantine(
    root, key('acme'), [{ row: { protocol: PACK_HISTORY_PROTOCOL, op: 'annotate' }, line: 1 }],
    'history.jsonl',
  );

  assert.equal(readFileSync(path.join(importedDir(root), '.gitignore'), 'utf8'), '*\n');
  // Every level of the pack's own path, the NAME directory between them
  // included: `mkdirSync(…, { recursive: true })` would have created that one
  // silently and left it the single level of this tree with nothing keeping it
  // out of git.
  assert.equal(readFileSync(path.join(importedDir(root), 'acme', '.gitignore'), 'utf8'), '*\n');
  assert.equal(
    readFileSync(path.join(packDir(root, key('acme')), '.gitignore'), 'utf8'), '*\n',
  );
  assert.equal(readFileSync(path.join(unknownDir(root), '.gitignore'), 'utf8'), '*\n');
});
