import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  pruneSnapshots, readSnapshotMeta, sanitizeSessionId, scanTranscriptIds, snapshotPath,
  writeSnapshot, SNAPSHOT_RENAME_ATTEMPTS,
} from '../../src/core/ledger.ts';
import { removeTree } from '../helpers/tmp.ts';

function readSnapshot(root: string, sessionId: string): string[] {
  return readSnapshotMeta(root, sessionId)?.itemIds ?? [];
}

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-snap-'));
}

test('a snapshot round-trips through the state directory', () => {
  const root = sandbox();
  writeSnapshot(root, 'abc-123', ['CONST-b', 'CONST-a']);
  assert.deepEqual(readSnapshot(root, 'abc-123'), ['CONST-a', 'CONST-b']);
  removeTree(root);
});

test('the snapshot lands under state/ with a .restore.json suffix', () => {
  const root = sandbox();
  const written = writeSnapshot(root, 'abc-123', ['CONST-a']);
  assert.equal(written, path.join(root, 'state', 'abc-123.restore.json'));
  assert.equal(snapshotPath(root, 'abc-123'), written);
  removeTree(root);
});

test('ids are deduplicated and sorted for a stable diff', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-b', 'CONST-a', 'CONST-b']);
  assert.deepEqual(readSnapshot(root, 's'), ['CONST-a', 'CONST-b']);
  removeTree(root);
});

test('the state directory ignores itself in git', () => {
  const root = sandbox();
  writeSnapshot(root, 's', []);
  assert.equal(readFileSync(path.join(root, 'state', '.gitignore'), 'utf8'), '*\n');
  removeTree(root);
});

test('a traversal-shaped session id cannot escape the state directory', () => {
  const root = sandbox();
  const written = writeSnapshot(root, '../../etc/evil', ['CONST-a']);
  assert.equal(path.dirname(written), path.join(root, 'state'));
  assert.equal(existsSync(written), true);
  removeTree(root);
});

test('sanitizeSessionId keeps safe characters and replaces the rest', () => {
  assert.equal(sanitizeSessionId('a1B2-c3_d4.e5'), 'a1B2-c3_d4.e5');
  assert.equal(sanitizeSessionId('a/b\\c:d'), 'a_b_c_d');
  assert.equal(sanitizeSessionId(''), 'unknown');
});

test('a missing snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  assert.deepEqual(readSnapshot(root, 'never-written'), []);
  removeTree(root);
});

test('a corrupt snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-a']);
  writeFileSync(snapshotPath(root, 's'), '{ not json');
  assert.deepEqual(readSnapshot(root, 's'), []);
  removeTree(root);
});

test('a snapshot that is a top-level JSON array reads as empty rather than throwing', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-a']);
  writeFileSync(snapshotPath(root, 's'), '[]');
  assert.deepEqual(readSnapshot(root, 's'), []);
  removeTree(root);
});

test('pruneSnapshots deletes only entries older than the retention window', () => {
  const root = sandbox();
  const oldPath = writeSnapshot(root, 'old-session', ['CONST-a']);
  const freshPath = writeSnapshot(root, 'fresh-session', ['CONST-b']);

  const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  utimesSync(oldPath, longAgo, longAgo);

  const pruned = pruneSnapshots(root, 30 * 24 * 60 * 60 * 1000);
  assert.equal(pruned, 1);
  assert.equal(existsSync(oldPath), false);
  assert.equal(existsSync(freshPath), true);

  removeTree(root);
});

test('pruneSnapshots also clears orphaned .tmp- files left by a crashed write', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-a']);
  const tmp = path.join(root, 'state', 'orphan.restore.json.tmp-1234-0');
  writeFileSync(tmp, '{ incomplete');
  const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  utimesSync(tmp, longAgo, longAgo);

  const pruned = pruneSnapshots(root, 30 * 24 * 60 * 60 * 1000);
  assert.equal(pruned, 1);
  assert.equal(existsSync(tmp), false);

  removeTree(root);
});

test('pruneSnapshots on a project with no state/ directory yet is a safe no-op', () => {
  const root = sandbox();
  assert.equal(pruneSnapshots(root), 0);
  removeTree(root);
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
  removeTree(root);
});

test('the transcript scan is safe on a missing path, null, and a directory', () => {
  const root = sandbox();
  const known = new Set(['CONST-a']);
  assert.deepEqual(scanTranscriptIds(null, known), []);
  assert.deepEqual(scanTranscriptIds(undefined, known), []);
  assert.deepEqual(scanTranscriptIds(path.join(root, 'nope.jsonl'), known), []);
  assert.deepEqual(scanTranscriptIds(root, known), []);
  removeTree(root);
});

test('writeSnapshot survives the target being held open for reading (the NTFS antivirus hazard)', { skip: process.platform !== 'win32' ? 'Windows-only: EPERM-on-rename-over-open-file is a Windows-specific failure mode' : false }, async () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-old']);
  const target = snapshotPath(root, 's');

  // A separate process opens the existing snapshot for READ and holds the
  // handle for ~300ms — the shape of an antivirus or indexer sweep. On NTFS
  // a bare renameSync over that target fails EPERM immediately (measured:
  // 654/2,000 renames under a concurrent reader), so this test fails both
  // without the retry and with only the 5-attempt/~200ms default policy;
  // only the SNAPSHOT_RENAME_ATTEMPTS budget outlasts the hold.
  const holder = spawn(process.execPath, ['-e', `
    const fs = require('node:fs');
    const fd = fs.openSync(process.argv[1], 'r');
    setTimeout(() => { fs.closeSync(fd); }, 300);
  `, target], { stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 50)); // let the holder actually open its handle

  assert.doesNotThrow(() => writeSnapshot(root, 's', ['CONST-new']));
  assert.deepEqual(readSnapshot(root, 's'), ['CONST-new']);

  await new Promise((res) => holder.on('exit', res));
  removeTree(root);
});

test('the snapshot rename retry budget is real patience that still fits the hook kill window', () => {
  // `retryOnTransientFsError` sleeps 20·(attempt+1) ms after each failed
  // attempt, so k attempts back off for at most 10·k·(k-1) ms in total. This
  // pins the two properties the budget was chosen for: patient enough to
  // outlast a scanner's hold by an order of magnitude past the ~200ms
  // default, and short enough to leave most of the PreCompact hook's
  // 10-second kill budget (hooks.json) for the store open and transcript
  // scan that precede the write. If the backoff formula in rebuild.ts
  // changes, re-derive the budget rather than deleting this test.
  const worstCaseBackoffMs = 10 * SNAPSHOT_RENAME_ATTEMPTS * (SNAPSHOT_RENAME_ATTEMPTS - 1);
  assert.ok(worstCaseBackoffMs >= 1000,
    `snapshot rename backoff ${worstCaseBackoffMs}ms is hot-path impatience, not compaction-time patience`);
  assert.ok(worstCaseBackoffMs <= 3000,
    `snapshot rename backoff ${worstCaseBackoffMs}ms eats too much of the 10s hook kill budget`);
});

test('the transcript scan reads the tail of an oversized transcript', () => {
  const root = sandbox();
  const transcript = path.join(root, 'big.jsonl');
  const filler = 'x'.repeat(9 * 1024 * 1024);
  writeFileSync(transcript, `CONST-buried-at-the-start\n${filler}\nCONST-near-the-end\n`);
  const known = new Set(['CONST-buried-at-the-start', 'CONST-near-the-end']);
  assert.deepEqual(scanTranscriptIds(transcript, known), ['CONST-near-the-end']);
  removeTree(root);
});
