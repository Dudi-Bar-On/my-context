import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  readSnapshot, sanitizeSessionId, scanTranscriptIds, snapshotPath, writeSnapshot,
} from '../../src/core/ledger.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-snap-'));
}

test('a snapshot round-trips through the state directory', () => {
  const root = sandbox();
  writeSnapshot(root, 'abc-123', ['CONST-b', 'CONST-a']);
  assert.deepEqual(readSnapshot(root, 'abc-123'), ['CONST-a', 'CONST-b']);
  rmSync(root, { recursive: true, force: true });
});

test('the snapshot lands under state/ with a .restore.json suffix', () => {
  const root = sandbox();
  const written = writeSnapshot(root, 'abc-123', ['CONST-a']);
  assert.equal(written, path.join(root, 'state', 'abc-123.restore.json'));
  assert.equal(snapshotPath(root, 'abc-123'), written);
  rmSync(root, { recursive: true, force: true });
});

test('ids are deduplicated and sorted for a stable diff', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-b', 'CONST-a', 'CONST-b']);
  assert.deepEqual(readSnapshot(root, 's'), ['CONST-a', 'CONST-b']);
  rmSync(root, { recursive: true, force: true });
});

test('the state directory ignores itself in git', () => {
  const root = sandbox();
  writeSnapshot(root, 's', []);
  assert.equal(readFileSync(path.join(root, 'state', '.gitignore'), 'utf8'), '*\n');
  rmSync(root, { recursive: true, force: true });
});

test('a traversal-shaped session id cannot escape the state directory', () => {
  const root = sandbox();
  const written = writeSnapshot(root, '../../etc/evil', ['CONST-a']);
  assert.equal(path.dirname(written), path.join(root, 'state'));
  assert.equal(existsSync(written), true);
  rmSync(root, { recursive: true, force: true });
});

test('sanitizeSessionId keeps safe characters and replaces the rest', () => {
  assert.equal(sanitizeSessionId('a1B2-c3_d4.e5'), 'a1B2-c3_d4.e5');
  assert.equal(sanitizeSessionId('a/b\\c:d'), 'a_b_c_d');
  assert.equal(sanitizeSessionId(''), 'unknown');
});

test('a missing snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  assert.deepEqual(readSnapshot(root, 'never-written'), []);
  rmSync(root, { recursive: true, force: true });
});

test('a corrupt snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-a']);
  writeFileSync(snapshotPath(root, 's'), '{ not json');
  assert.deepEqual(readSnapshot(root, 's'), []);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan returns only ids that exist in the index', () => {
  const root = sandbox();
  const transcript = path.join(root, 'transcript.jsonl');
  writeFileSync(transcript, [
    '{"role":"user","content":"why is CONST-pg-pool-cap set to 20?"}',
    '{"role":"assistant","content":"see ADR-sqlite-jsonb and NOTREAL-made-up"}',
    '{"role":"assistant","content":"CONST-pg-pool-cap again"}',
  ].join('\n'));

  const known = new Set(['CONST-pg-pool-cap', 'ADR-sqlite-jsonb', 'LESSON-unmentioned']);
  assert.deepEqual(scanTranscriptIds(transcript, known),
    ['ADR-sqlite-jsonb', 'CONST-pg-pool-cap']);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan is safe on a missing path, null, and a directory', () => {
  const root = sandbox();
  const known = new Set(['CONST-a']);
  assert.deepEqual(scanTranscriptIds(null, known), []);
  assert.deepEqual(scanTranscriptIds(undefined, known), []);
  assert.deepEqual(scanTranscriptIds(path.join(root, 'nope.jsonl'), known), []);
  assert.deepEqual(scanTranscriptIds(root, known), []);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan reads the tail of an oversized transcript', () => {
  const root = sandbox();
  const transcript = path.join(root, 'big.jsonl');
  const filler = 'x'.repeat(9 * 1024 * 1024);
  writeFileSync(transcript, `CONST-buried-at-the-start\n${filler}\nCONST-near-the-end\n`);
  const known = new Set(['CONST-buried-at-the-start', 'CONST-near-the-end']);
  assert.deepEqual(scanTranscriptIds(transcript, known), ['CONST-near-the-end']);
  rmSync(root, { recursive: true, force: true });
});
