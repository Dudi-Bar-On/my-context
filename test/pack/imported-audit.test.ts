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
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLogPath, auditSegments, readAudit, recordAudit } from '../../src/core/audit.ts';
import { PACK_HISTORY_PROTOCOL } from '../../src/pack/layout.ts';
import type { PackHistoryRecord } from '../../src/pack/history.ts';
import {
  importedDir, packDir, quarantine, readImportRecords, readImportedHistory, readQuarantine,
  unknownDir, writeImportRecord, writeImportedHistory, type ImportRecord,
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
function record(over: Partial<ImportRecord> = {}): ImportRecord {
  return {
    protocol: 'my_context/pack-import@1',
    pack: 'acme-security',
    version: '2026-08 rev 3',
    kind: 'pack',
    source: '../packs/acme-security.zip',
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

  writeImportedHistory(root, 'acme', [travelled(), travelled({ op: 'update' })]);

  assert.deepEqual(auditSegments(root).filter((f) => f.includes('imported')), []);
  assert.doesNotThrow(() => readAudit(root), 'the live reader must not even see it');
  assert.equal(readAudit(root).length, 1, 'only the workspace\'s own record');

  // The byte layout, asserted as the order it is specified in.
  const [first] = readFileSync(path.join(packDir(root, 'acme'), 'history.jsonl'), 'utf8')
    .split('\n');
  assert.deepEqual(Object.keys(JSON.parse(first) as object), [
    'protocol', 'pack', 'at', 'kind', 'op', 'origin', 'itemId',
  ]);
  assert.deepEqual(readImportedHistory(root, 'acme').map((r) => r.op), ['create', 'update']);
});

test('a stray copy of an imported record into audit.jsonl is refused by the live reader', () => {
  const root = workspace();
  writeImportedHistory(root, 'acme', [travelled()]);
  const [importedRecord] = readImportedHistory(root, 'acme');

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
  const n = quarantine(root, 'acme', [{ row: alienRow, line: 40 }], 'history.jsonl');

  assert.equal(n, 1);
  const [wrapped] = readQuarantine(root);
  assert.deepEqual(wrapped.record, alienRow);
  assert.equal(wrapped.line, 40);
  assert.equal(wrapped.pack, 'acme');
  assert.equal(wrapped.source, 'history.jsonl');
  assert.deepEqual(Object.keys(wrapped), [
    'protocol', 'pack', 'at', 'source', 'line', 'record',
  ]);
  assert.equal(quarantine(root, 'acme', [], 'history.jsonl'), 0, 'nothing to file is not an error');
});

test('a row whose line could not be established is filed with a null line, not a made-up one', () => {
  // `null` is written rather than the key being left out: an absent key reads
  // as an older build that never had the field, and any NUMBER here would be
  // one this function invented about a file it never opened.
  const root = workspace();
  const alienRow = { protocol: PACK_HISTORY_PROTOCOL, op: 'annotate' };

  quarantine(root, 'acme', [{ row: alienRow, line: null }], 'history.jsonl');

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
// A pack name is not a path
// ---------------------------------------------------------------------------

test('a pack name becomes a slug, and two packs never share a directory', () => {
  const root = workspace();

  assert.equal(packDir(root, 'Acme Security!'), path.join(importedDir(root), 'acme-security'));
  assert.equal(packDir(root, 'acme security'), packDir(root, 'Acme  Security'));
  assert.notEqual(packDir(root, 'acme-security'), packDir(root, 'acme-standards'));

  // The one name that would land a pack in the quarantine directory. It is
  // refused rather than resolved: two writers in one directory is exactly the
  // sharing this test is named after.
  assert.throws(() => packDir(root, 'Unknown'), /my_context:/);
  assert.equal(unknownDir(root), path.join(importedDir(root), 'unknown'));
});

test('a pack name that slugs to nothing is refused rather than writing to an unnamed directory', () => {
  const root = workspace();
  for (const name of ['', '   ', '!!!', '---']) {
    assert.throws(() => packDir(root, name), /my_context:/, JSON.stringify(name));
  }
});

// ---------------------------------------------------------------------------
// The import record
// ---------------------------------------------------------------------------

test('the import record round-trips and its items list is sorted', () => {
  const root = workspace();
  const unsorted = record({ items: ['RULE-never-log-a-token', 'CONST-node-24-or-newer'] });

  const written = writeImportRecord(root, unsorted);

  assert.equal(written, path.join(packDir(root, 'acme-security'), 'import.json'));
  const raw = readFileSync(written, 'utf8');
  assert.ok(raw.endsWith('}\n'), 'two-space JSON with exactly one trailing newline');
  assert.deepEqual(Object.keys(JSON.parse(raw) as object), [
    'protocol', 'pack', 'version', 'kind', 'source', 'importedAt',
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
  writeImportedHistory(root, 'acme', [travelled()]);
  quarantine(
    root, 'acme', [{ row: { protocol: PACK_HISTORY_PROTOCOL, op: 'annotate' }, line: 1 }],
    'history.jsonl',
  );

  assert.equal(readFileSync(path.join(importedDir(root), '.gitignore'), 'utf8'), '*\n');
  assert.equal(readFileSync(path.join(packDir(root, 'acme'), '.gitignore'), 'utf8'), '*\n');
  assert.equal(readFileSync(path.join(unknownDir(root), '.gitignore'), 'utf8'), '*\n');
});
