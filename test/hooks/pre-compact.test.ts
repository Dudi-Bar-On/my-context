import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { Ledger, readSnapshotMeta, snapshotPath } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-precompact-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, type = 'constraint'): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
---

# ${id} title

Body.
`);
}

function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function input(cwd: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { session_id: 's1', hook_event_name: 'PreCompact', cwd, ...extra };
}

test('the snapshot captures everything the ledger recorded this session', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  addItem(cwd, 'CONST-b');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.record('s2', 'CONST-b', 'jit');
  ledger.close();

  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);
  assert.deepEqual(readSnapshotMeta(ws.projectRoot!, 's1')?.itemIds, ['CONST-a']);

  removeTree(cwd);
});

test('the snapshot unions the ledger with ids cited in the transcript', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-injected');
  addItem(cwd, 'CONST-discussed');
  addItem(cwd, 'CONST-never-mentioned');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-injected', 'jit');
  ledger.close();

  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript,
    '{"role":"user","content":"remind me what CONST-discussed says"}\n');

  const result = buildRestoreSnapshot(input(cwd, { transcript_path: transcript }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-discussed', 'CONST-injected']);

  removeTree(cwd);
});

test('transcript tokens that are not real item ids are ignored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-real');
  index(cwd);

  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript,
    '{"content":"CONST-real plus TODO-invented and RFC-2119-ish talk"}\n');

  const result = buildRestoreSnapshot(input(cwd, { transcript_path: transcript }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-real']);

  removeTree(cwd);
});

test('an empty session still writes an empty snapshot', () => {
  const cwd = sandbox();
  index(cwd);
  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.deepEqual(result?.itemIds, []);
  const ws = resolveWorkspace(cwd);
  assert.deepEqual(readSnapshotMeta(ws.projectRoot!, 's1')?.itemIds, []);
  removeTree(cwd);
});

test('a missing transcript path degrades to the ledger alone', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();

  const result = buildRestoreSnapshot(
    input(cwd, { transcript_path: path.join(cwd, 'gone.jsonl') }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);

  removeTree(cwd);
});

test('ids that have since left the index are not carried forward', () => {
  const cwd = sandbox();
  index(cwd);
  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-deleted-since', 'jit');
  ledger.close();

  assert.deepEqual(buildRestoreSnapshot(input(cwd), cwd)?.itemIds, []);
  removeTree(cwd);
});

test('a snapshot that cannot be written is disclosed in the audit log and on stderr, not swallowed', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();

  // A directory squatting on the snapshot's own path makes every rename
  // attempt fail on every platform — the permanent form of the transient
  // NTFS EPERM an antivirus hold produces. On Windows this test therefore
  // also exercises the full retry budget before the failure is disclosed.
  mkdirSync(snapshotPath(ws.projectRoot!, 's1'), { recursive: true });

  const stderrChunks: string[] = [];
  const realWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrChunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  let result;
  try {
    result = buildRestoreSnapshot(input(cwd), cwd);
  } finally {
    process.stderr.write = realWrite;
  }

  assert.equal(result, null);

  const record = readAudit(ws.projectRoot!).find((r) => r.op === 'pre-compact');
  assert.ok(record, 'the failed snapshot write left no audit record — the loss was silent');
  assert.match(record.note ?? '', /SNAPSHOT WRITE FAILED/);
  assert.match(record.note ?? '', /NOT persisted/);
  assert.match(record.note ?? '', /1 from the ledger/);
  assert.equal(record.sessionId, 's1');
  // Nothing was delivered and nothing was captured durably: an `injected`
  // list here would let `ledgerRows` replay ids that were never persisted.
  assert.deepEqual(record.injected, []);

  assert.match(stderrChunks.join(''), /restore snapshot could not be written/);

  removeTree(cwd);
});

test('no workspace, no session id, and malformed input all return null', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(buildRestoreSnapshot({ session_id: 's1', cwd: bare }, bare), null);

  const cwd = sandbox();
  index(cwd);
  assert.equal(buildRestoreSnapshot({ cwd }, cwd), null);

  removeTree(bare);
  removeTree(cwd);
});
