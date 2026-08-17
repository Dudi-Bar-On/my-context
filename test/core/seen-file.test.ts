import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { sanitizeSessionId, snapshotPath } from '../../src/core/ledger.ts';
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
  const file = seenFilePath(dir, 'sess::agent');
  // A folded key carries a digest of its raw spelling — see the decision
  // records below. The stem must be the SAME one the restore snapshots use:
  // one sanitizer, one equivalence class per key, never two.
  assert.match(file, /[\\/]sess__agent-[0-9a-f]{12}\.seen\.jsonl$/);
  assert.equal(
    basename(snapshotPath(dir, 'sess::agent'), '.restore.json'),
    basename(file, '.seen.jsonl'),
  );
});

// --- The collision decision records ----------------------------------------
//
// The 2026-08-16 task-3-4 review executed four collision shapes the folding
// sanitizer admitted: `a::b`↔`a__b`, 128-char truncation (which folded a
// parent key into EVERY `::agent` key of the same live session — the exact
// per-window suppression E2 was fixed to eliminate), case-variant ids on a
// case-insensitive filesystem, and the leading-dot fold. All four were
// unreachable with real UUID session ids — but that is a fact about Claude
// Code's current id format, not about this code, and nothing pinned it. The
// DECISION, recorded here: the sanitizer is injective (modulo a 48-bit
// digest collision) for every input, so no shape is left to the id format.

test('DECISION: a::b and a__b no longer collide — the digest preserves raw-string distinctness', (t) => {
  const dir = root(t);
  appendSeen(dir, 'a::b', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, 'a__b')), []);
  assert.deepEqual(seenIds(readSeen(dir, 'a::b')), ['CONST-x']);
});

test('DECISION: truncation cannot fold a parent key into its subagent keys (the E2 shape)', (t) => {
  const dir = root(t);
  const long = `sess-${'x'.repeat(200)}`; // past the 128-char filename cap
  const sub = `${long}::agent-7`;
  assert.notEqual(seenFilePath(dir, long), seenFilePath(dir, sub));
  assert.notEqual(seenFilePath(dir, `${long}::agent-7`), seenFilePath(dir, `${long}::agent-8`));
  assert.ok(sanitizeSessionId(long).length <= 128, 'sanitized names must stay filename-sized');
  // A subagent's fresh context window must get a fresh dedupe scope: the
  // parent's deliveries must not read as its own.
  appendSeen(dir, long, [{ id: 'CONST-parent', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, sub)), []);
});

test('DECISION: case-variant ids stay distinct even on a case-insensitive filesystem', (t) => {
  const dir = root(t);
  // An id containing uppercase never passes through bare — it takes the
  // digest suffix, and digests are lowercase hex, so two case-variant raws
  // differ in character VALUE, which NTFS/APFS case-folding cannot conflate.
  assert.notEqual(sanitizeSessionId('SessABC'), 'SessABC');
  assert.notEqual(
    sanitizeSessionId('SessABC').toLowerCase(),
    sanitizeSessionId('SESSABC').toLowerCase(),
  );
  // And on THIS filesystem, whatever its case sensitivity:
  appendSeen(dir, 'SessABC', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, 'sessabc')), []);
});

test('DECISION: the leading-dot fold no longer conflates .a, ..a and _a', () => {
  const distinct = new Set(['.a', '..a', '_a'].map((k) => sanitizeSessionId(k)));
  assert.equal(distinct.size, 3);
});

test('a canonical id — a real lowercase UUID — passes through byte-stable', () => {
  // Filename stability for the ids Claude Code actually sends: existing
  // sessions must not have their dedupe state orphaned by this change.
  const uuid = '3f2c9d1e-8a4b-4c6d-9e0f-123456789abc';
  assert.equal(sanitizeSessionId(uuid), uuid);
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

test('the append retry budget is wired, not just declared: effective backoff is MEASURED', (t) => {
  // The static band above pins the CONSTANT's value; this pins that appendSeen
  // actually retries with that constant and the documented formula. A
  // read-only seen file makes every attempt fail EPERM (Windows) / EACCES
  // (POSIX) — both in TRANSIENT_RENAME_CODES, verified by execution — so the
  // real retry loop runs to exhaustion and its total backoff can be measured.
  // This is what makes dropping the explicit attempts argument SAFE rather
  // than a silent value coincidence with retryOnTransientFsError's default:
  // if the effective attempt count ever drifts (a changed default with the
  // argument dropped, a changed backoff formula), the measured time leaves
  // this band and the suite goes red — the drift cannot be silent.
  // Measured three times, keeping the FASTEST — the band is unchanged.
  //
  // This is a wall-clock measurement inside a runner that executes test files
  // concurrently, so `elapsed` is the backoff PLUS whatever the scheduler took
  // away. A single sample therefore fails for a reason that has nothing to do
  // with the retry loop: the ceiling is 400ms and an unloaded sample lands at
  // ~262ms, which leaves under 1.5x of headroom for that noise. Measured
  // during the v1.0.0 documentation sweep: growing README.md and
  // docs/README.he.md by ~5% each was enough on its own to push this to 461ms
  // and turn the suite red, twice, reproducibly — a documentation-only change
  // failing a retry-budget assertion.
  //
  // Taking the minimum separates the two causes rather than tolerating both.
  // Scheduler noise is not systematic: across three samples at least one
  // usually runs clean. A real drift IS systematic — the next attempt count up
  // from 5 that this band can catch is 7, at 420ms, and a doubled count is
  // 900ms; neither gets under the ceiling on any sample. So the band still
  // catches everything it caught before, and stops reporting machine load as a
  // wiring defect.
  const perLineWorstMs = 10 * SEEN_APPEND_ATTEMPTS * (SEEN_APPEND_ATTEMPTS - 1);
  const dir = root(t);
  appendSeen(dir, 'locked', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  const file = seenFilePath(dir, 'locked');

  let elapsed = Number.POSITIVE_INFINITY;
  let written = true;
  for (let sample = 0; sample < 3; sample += 1) {
    chmodSync(file, 0o444);
    const started = Date.now();
    const result = appendSeen(dir, 'locked', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
    const took = Date.now() - started;
    chmodSync(file, 0o666); // before any assert can throw past it — cleanup must not fail
    written = written && result.written;
    elapsed = Math.min(elapsed, took);
  }

  assert.equal(written, false);
  assert.ok(elapsed >= perLineWorstMs * 0.75,
    `measured ${elapsed}ms of backoff — the declared ${perLineWorstMs}ms budget is not wired in`);
  assert.ok(elapsed < perLineWorstMs * 2,
    `measured ${elapsed}ms of backoff — more patience than the declared ${perLineWorstMs}ms budget`);
});
