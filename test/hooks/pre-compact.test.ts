import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { readSnapshotMeta, snapshotPath } from '../../src/core/ledger.ts';
import { appendSeen } from '../../src/core/seen-file.ts';
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

/** Like `addItem`, but `always: true` — selected into SessionStart's pinned tier. */
function addPinnedItem(cwd: string, id: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${id} title
status: active
severity: hard
always: true
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

test('the snapshot captures everything the seen file recorded this session', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  addItem(cwd, 'CONST-b');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendSeen(ws.projectRoot!, 's2', [{ id: 'CONST-b', tier: 'jit', at: 'T0' }]);

  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);
  assert.deepEqual(readSnapshotMeta(ws.projectRoot!, 's1')?.itemIds, ['CONST-a']);

  removeTree(cwd);
});

test('the snapshot unions the seen file with ids cited in the transcript', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-injected');
  addItem(cwd, 'CONST-discussed');
  addItem(cwd, 'CONST-never-mentioned');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-injected', tier: 'jit', at: 'T0' }]);

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

test('a missing transcript path degrades to the seen file alone', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);

  const result = buildRestoreSnapshot(
    input(cwd, { transcript_path: path.join(cwd, 'gone.jsonl') }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);

  removeTree(cwd);
});

test('ids that have since left the index are not carried forward', () => {
  const cwd = sandbox();
  // A surviving item keeps the index NON-empty: an index that still knows
  // something is trusted to say "this id is gone". (An index that knows
  // NOTHING is not — see the empty-index test below.)
  addItem(cwd, 'CONST-keeper');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-deleted-since', tier: 'jit', at: 'T0' }]);

  assert.deepEqual(buildRestoreSnapshot(input(cwd), cwd)?.itemIds, []);
  removeTree(cwd);
});

test('a snapshot that cannot be written is disclosed in the audit log and on stderr, not swallowed', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);

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
  assert.match(record.note ?? '', /1 from the seen file/);
  assert.equal(record.sessionId, 's1');
  // Nothing was delivered and nothing was captured durably: an `injected`
  // list here would let `ledgerRows` replay ids that were never persisted.
  assert.deepEqual(record.injected, []);

  assert.match(stderrChunks.join(''), /restore snapshot could not be written/);

  removeTree(cwd);
});

// --- Task 10: zero SQLite writes, zero blocking SQLite reads -----------------

test('PreCompact snapshots from the seen file with the database HELD — and lands inside milliseconds-scale, not seconds', (t) => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd); // a POPULATED index: the known filter has something to say
  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [
    { id: 'CONST-a', tier: 'jit', at: 'T0' },
    { id: 'CONST-gone', tier: 'pinned', at: 'T0' },
  ]);
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => {
    try { holder.exec('ROLLBACK'); } catch { /* done */ }
    holder.close();
    removeTree(cwd);
  });
  const started = performance.now();
  const result = buildRestoreSnapshot(input(cwd), cwd);
  const elapsed = performance.now() - started;
  assert.notEqual(result, null);
  assert.ok(elapsed < 2000, `took ${elapsed}ms with the write lock held`);
  // The held write lock does NOT block a read-only open (0.2 ms measured
  // [P4]), so the known filter still ran: the real item is captured, the
  // id the index says is gone is not.
  assert.deepEqual(result!.itemIds, ['CONST-a']);
});

test('an UNAVAILABLE index skips the known filter: over-capture, disclosed, never a lost snapshot', (t) => {
  const cwd = sandbox();
  const ws = resolveWorkspace(cwd);
  t.after(() => removeTree(cwd));
  rmSync(ws.dbPath, { force: true });
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.notEqual(result, null);
  // Over-capture is the safe direction: select drops ids matching no live
  // item at restore (select.ts).
  assert.deepEqual(result!.itemIds, ['CONST-a']);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 's1').at(-1)?.note ?? '';
  assert.match(note, /known-id filter skipped/);
});

/**
 * The reviewer's demonstrated restore MISS (tasks 5-6 review I1+I2), executed:
 * SessionStart delivers CONST-pc from Markdown while a foreign writer holds
 * the lock, so the best-effort refresh is dropped and the index stays EMPTY.
 * Before this task the snapshot came back `[]` twice over — the ledger arm
 * read a table nothing writes any more (I1), and the empty index's `known`
 * filter erased even what the arm had (I2). A miss is the one direction this
 * design forbids: the seen-file arm plus the empty-index skip must capture it,
 * with the write lock STILL held at snapshot time.
 */
test('the reviewer\'s MISS: an id delivered under a held lock survives into the snapshot', (t) => {
  const cwd = sandbox();
  addPinnedItem(cwd, 'CONST-pc'); // always:true — delivered in full at SessionStart
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close(); // schema exists; items table stays EMPTY
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => {
    try { holder.exec('ROLLBACK'); } catch { /* done */ }
    holder.close();
    removeTree(cwd);
  });

  // SessionStart under the held lock: injected from Markdown, refresh dropped.
  const injected = buildInjection(cwd, { event: 'session-start', sessionId: 's1' });
  assert.match(injected, /CONST-pc/);

  // PreCompact, lock still held, index still empty:
  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.notEqual(result, null);
  assert.deepEqual(result!.itemIds, ['CONST-pc']);
  // An index that knows NOTHING cannot tell "deleted" from "never indexed",
  // so filtering through it would convert a refresh lag into suppression —
  // the filter is skipped and the skip disclosed:
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 's1').at(-1)?.note ?? '';
  assert.match(note, /known-id filter skipped/);
});

test('an unreadable seen file degrades to the transcript arm, disclosed', (t) => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-cited');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  t.after(() => removeTree(cwd));
  // A directory where the seen file should be makes readSeen fail:
  mkdirSync(path.join(ws.projectRoot!, 'state', 's1.seen.jsonl'), { recursive: true });
  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript, '{"content":"per CONST-cited we do it this way"}\n');
  const result = buildRestoreSnapshot(input(cwd, { transcript_path: transcript }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-cited']);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 's1').at(-1)?.note ?? '';
  assert.match(note, /seen file unreadable/);
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
