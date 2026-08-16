import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendSeen, readSeen, restoredFor, seenFilePath, seenIds,
} from '../../src/core/seen-file.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-seen-'));
  t.after(() => removeTree(dir));
  return dir;
}

test('append then read round-trips, ids deduplicated and sorted', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [
    { id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:00:00.000Z' },
    { id: 'CONST-a', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
  ]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:01:00.000Z' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.equal(state.lines.length, 3);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a missing file is an empty seen set, not an error', (t) => {
  const state = readSeen(root(t), 'never-written');
  assert.equal(state.error, null);
  assert.deepEqual(state.lines, []);
});

test('restoredFor is last-line-wins per (id, tier) — recordRestored refresh semantics', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-1' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-2' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'GEN-2' }]);
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-2')], ['CONST-a']);
  // The OLD generation no longer matches — the marker moved, exactly as
  // Ledger.recordRestored's ON CONFLICT ... UPDATE moved it.
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-1')], []);
});

test('a torn tail is healed by the next append; completed records survive', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), '{"id":"CONST-tor', 'utf8'); // killed mid-append
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a corrupt middle line degrades to error, never throws — inject-without-dedupe direction', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), 'not json at all\n', 'utf8');
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.notEqual(state.error, null);
  assert.deepEqual(state.lines, []); // no partial answer: dedupe is all-or-disclosed
});

test('the key is sanitized into the filename exactly as snapshot paths are', (t) => {
  const dir = root(t);
  assert.equal(
    seenFilePath(dir, 'sess::agent'),
    join(dir, 'state', 'sess__agent.seen.jsonl'),
  );
});
