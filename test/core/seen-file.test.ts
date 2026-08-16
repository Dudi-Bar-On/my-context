import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendSeen, readSeen, restoredFor, SEEN_APPEND_ATTEMPTS, seenFilePath, seenIds,
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

test('a well-formed line missing a required field degrades to error, never a guessed record', (t) => {
  // Valid JSON with the right protocol but a missing/mistyped field is not a
  // torn tail — it is corruption or version skew, and treating it as a record
  // would hand dedupe an `undefined` id. Each field's guard is pinned in its
  // own file so a surviving mutant names the field it lost.
  const cases: Array<[string, string]> = [
    ['no-id', '{"protocol":"mycontext-seen/1","tier":"jit","at":"T0"}\n'],
    ['bad-tier', '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"bogus","at":"T0"}\n'],
    ['no-at', '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"jit"}\n'],
  ];
  for (const [key, line] of cases) {
    const dir = root(t);
    appendSeen(dir, key, [{ id: 'CONST-ok', tier: 'jit', at: 'T0' }]);
    appendFileSync(seenFilePath(dir, key), line, 'utf8');
    appendSeen(dir, key, [{ id: 'CONST-later', tier: 'jit', at: 'T1' }]);
    const state = readSeen(dir, key);
    assert.notEqual(state.error, null, `${key}: the damaged line must be refused, not guessed at`);
    assert.deepEqual(state.lines, [], `${key}: no partial answer — dedupe is all-or-disclosed`);
  }
});

test('the key is sanitized into the filename exactly as snapshot paths are', (t) => {
  const dir = root(t);
  assert.equal(
    seenFilePath(dir, 'sess::agent'),
    join(dir, 'state', 'sess__agent.seen.jsonl'),
  );
});

test('DOCUMENTED NARROWING: sanitized keys collide — a::b and a__b share one file', (t) => {
  const dir = root(t);
  appendSeen(dir, 'a::b', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  // The SQL ledger compared raw strings; the file scheme cannot. The worst
  // case is SHARED DEDUPE SCOPE between the colliding keys — a suppression
  // within the pair, recoverable, never a corpus-wide miss — and it is
  // unreachable with UUID session ids. This test is the decision record.
  assert.deepEqual(seenIds(readSeen(dir, 'a__b')), ['CONST-x']);
});

test('the seen append retry budget is hot-path patience that fits the hook kill window', () => {
  // `retryOnTransientFsError` sleeps 20·(attempt+1) ms after each failed
  // attempt, so k attempts back off for at most 10·k·(k-1) ms PER LINE — and
  // unlike the snapshot rename, appendSeen retries per line, so its worst
  // case scales with the number of items delivered: every line can exhaust
  // its backoff and still succeed. This pins the budget the way
  // SNAPSHOT_RENAME_ATTEMPTS is pinned, so neither the constant nor the
  // backoff formula can drift silently. If the formula in rebuild.ts
  // changes, re-derive the budget rather than deleting this test.
  const perLineWorstMs = 10 * SEEN_APPEND_ATTEMPTS * (SEEN_APPEND_ATTEMPTS - 1);
  assert.ok(perLineWorstMs >= 100,
    `seen append backoff ${perLineWorstMs}ms cannot outlast a scanner's momentary hold`);
  assert.ok(perLineWorstMs <= 250,
    `seen append backoff ${perLineWorstMs}ms is compaction-time patience on a hot path`);
  // 40 lines is ~4x the largest single delivery observed in this project;
  // even that pathological append must leave at least 2s of the 10s hook
  // kill (hooks.json) for the store open, select and render that precede it.
  assert.ok(40 * perLineWorstMs <= 8000,
    `a 40-line append could back off ${40 * perLineWorstMs}ms — too close to the 10s hook kill`);
});
