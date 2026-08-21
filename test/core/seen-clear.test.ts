import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSessionId, snapshotPath } from '../../src/core/ledger.ts';
import {
  appendSeen, clearSeen, describeClearSeen, readSeen, SEEN_APPEND_ATTEMPTS, SEEN_CLEAR_ATTEMPTS,
  seenFilePath, seenIds, type ClearSeenReport,
} from '../../src/core/seen-file.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `clearSeen` is the only thing in `state/` that REMOVES. Everything else
 * appends, so every test here is really asking one of two questions: did it
 * remove something it should not have, or did it claim a removal it did not
 * perform. The second is the one `INV-nothing-is-dropped-silently` covers —
 * a caller that discloses "cleared" on the strength of an empty report has
 * told the user something false about their own knowledge base.
 */

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-seenclear-'));
  t.after(() => removeTree(dir));
  return dir;
}

/** One seen line is enough for every case here; the content is never read back. */
function seed(dir: string, key: string): string {
  appendSeen(dir, key, [{ id: 'CONST-a', tier: 'pinned', at: 'T0' }]);
  return basename(seenFilePath(dir, key));
}

/**
 * What `state/` still holds, minus the `.gitignore` every JSONL append drops
 * there — `clearSeen` cannot match it (it carries neither the prefix nor the
 * suffix) and no test here is about it.
 */
function names(dir: string): string[] {
  return readdirSync(join(dir, 'state')).filter((n) => n !== '.gitignore').sort();
}

test('clearSeen removes the parent file and every session::agent sibling', (t) => {
  const dir = root(t);
  const parent = seed(dir, 'sess-1');
  const a1 = seed(dir, 'sess-1::a1');
  const a2 = seed(dir, 'sess-1::a2');
  const other = seed(dir, 'sess-2');

  const report = clearSeen(dir, 'sess-1');

  // The parent first, then the siblings in a filesystem-independent order.
  assert.deepEqual(report.removed, [parent, ...[a1, a2].sort()]);
  assert.deepEqual(report.failed, []);
  assert.equal(report.sweptSiblings, true);
  assert.equal(report.sweepError, null);
  // The point of the whole thing: the next injection into this session sees
  // an empty seen set rather than a suppressing one.
  assert.deepEqual(seenIds(readSeen(dir, 'sess-1')), []);
  assert.deepEqual(seenIds(readSeen(dir, 'sess-1::a1')), []);
  // And an unrelated session keeps its dedupe state.
  assert.deepEqual(names(dir), [other]);
  assert.deepEqual(seenIds(readSeen(dir, 'sess-2')), ['CONST-a']);
});

test('a session id that begins with another session id is not collateral', (t) => {
  const dir = root(t);
  seed(dir, 'sess-1');
  const ten = seed(dir, 'sess-10');
  const tenAgent = seed(dir, 'sess-10::a1');

  const report = clearSeen(dir, 'sess-1');

  assert.equal(report.removed.length, 1, 'only sess-1 had a file to remove');
  // The anchor is `sess-1__`, not `sess-1`: a bare stem match would take both
  // of these with it.
  assert.deepEqual(names(dir), [ten, tenAgent].sort());
  assert.deepEqual(seenIds(readSeen(dir, 'sess-10')), ['CONST-a']);
  assert.deepEqual(seenIds(readSeen(dir, 'sess-10::a1')), ['CONST-a']);
});

test('a non-canonical session id clears its own file and reports the sweep as not done', (t) => {
  const dir = root(t);
  const own = seed(dir, 'a/b');
  const sibling = seed(dir, 'a/b::a1');

  const report = clearSeen(dir, 'a/b');

  // `a/b` folds to `a_b-<digest>` and `a/b::a1` to `a_b__a1-<digest2>`. The
  // sibling is real and is NOT identifiable from the parent id, because the
  // prefix that would find it — `a_b__` — would also match a DIFFERENT
  // session whose id is literally `a_b`.
  assert.deepEqual(report.removed, [own]);
  assert.equal(report.sweptSiblings, false);
  assert.equal(report.sweepError, null, 'the id is the reason, not the disk');
  assert.deepEqual(names(dir), [sibling]);
  assert.match(
    describeClearSeen(report),
    /could not be identified from this session id and were left/,
  );
});

test('an empty session id sweeps nothing — `__` is not a prefix anybody owns', (t) => {
  const dir = root(t);
  // `::x` folds to `__x-<digest>`, so an unguarded `${sessionId}__` prefix
  // would be the bare string `__` and would take this file with it.
  const orphan = seed(dir, '::x');

  const report = clearSeen(dir, '');

  assert.deepEqual(report.removed, []);
  assert.equal(report.sweptSiblings, false);
  assert.deepEqual(names(dir), [orphan]);
});

test('clearSeen never throws when state/ does not exist, and reports an empty clear', (t) => {
  const dir = root(t);
  const report = clearSeen(dir, 'sess-1');
  assert.deepEqual(report, { removed: [], failed: [], sweptSiblings: true, sweepError: null });
  // A missing directory is a COMPLETE sweep over nothing, not a failed one:
  // there are no siblings anywhere for the caller to warn about.
  assert.equal(report.sweepError, null);
});

test('a clear that removed nothing says so rather than claiming it cleared', (t) => {
  const dir = root(t);
  seed(dir, 'sess-2'); // state/ exists, but nothing belongs to sess-1
  const report = clearSeen(dir, 'sess-1');

  // `rmSync(file, { force: true })` would have swallowed the ENOENT and this
  // report would have claimed one removal. The distinction is the whole
  // reason `removed` exists rather than a boolean.
  assert.deepEqual(report.removed, []);
  assert.deepEqual(report.failed, [], 'a file that was never there is not a failure either');
  assert.doesNotMatch(describeClearSeen(report), /^cleared \d/);
  assert.match(describeClearSeen(report), /none existed for this session id/);
});

test('the sibling window is derived from the sanitizer, not restated as a length', (t) => {
  // `sanitizeSessionId` truncates a folded base at 96 characters, so
  // `sid::agent` keeps its `sid__` prefix only while `sid.length + 2` fits.
  // The plan's prescribed rule — `sessionId.length <= 96` — claims the sweep
  // happened at 95 and 96, where the composite truncates to `sid_` and `sid`
  // and the prefix does not exist. A claimed sweep that found nothing is
  // exactly the silent drop this module refuses.
  const dir = root(t);
  const fits = 's'.repeat(94);
  const overruns = 't'.repeat(95);
  seed(dir, fits);
  seed(dir, `${fits}::a1`);
  seed(dir, overruns);
  const strandedSibling = seed(dir, `${overruns}::a1`);

  const inside = clearSeen(dir, fits);
  assert.equal(inside.removed.length, 2, 'at 94 the composite still carries the `__` prefix');
  assert.equal(inside.sweptSiblings, true);

  const outside = clearSeen(dir, overruns);
  assert.equal(outside.removed.length, 1, 'at 95 only the parent is identifiable');
  assert.equal(outside.sweptSiblings, false, 'and the report must not claim otherwise');
  assert.deepEqual(names(dir), [strandedSibling]);
  assert.ok(sanitizeSessionId(overruns) === overruns, 'the id is canonical — length is the reason');
});

test('a clear takes seen files only: snapshots and half-written temp files stay', (t) => {
  const dir = root(t);
  const parent = seed(dir, 'sess-1');
  const state = dirname(seenFilePath(dir, 'sess-1'));

  // Both of these carry the sibling prefix and neither is a seen file.
  const siblingSnapshot = basename(snapshotPath(dir, 'sess-1::a1'));
  writeFileSync(join(state, siblingSnapshot), '{}', 'utf8');
  const tornAppend = `${basename(seenFilePath(dir, 'sess-1::a2'))}.tmp-1234`;
  writeFileSync(join(state, tornAppend), '', 'utf8');
  const foreign = 'not-ours.txt';
  writeFileSync(join(state, foreign), 'x', 'utf8');

  const report = clearSeen(dir, 'sess-1');

  assert.deepEqual(report.removed, [parent]);
  assert.deepEqual(names(dir), [foreign, siblingSnapshot, tornAppend].sort());
});

test('a file that cannot be removed lands in failed, and clearSeen still returns', (t) => {
  const dir = root(t);
  // A directory where the seen file should be. Portable and deterministic:
  // `rmSync` without `recursive` refuses it with ERR_FS_EISDIR on every
  // platform, and EISDIR is not one of `retryOnTransientFsError`'s transient
  // codes, so it fails immediately rather than burning the retry budget.
  // (Measured 2026-08-21 on win32: a read-only file and a file held open by
  // another descriptor — the two fixtures the plan suggests — are both
  // deleted successfully by `rmSync`, so neither can stand in for this.)
  mkdirSync(seenFilePath(dir, 'sess-1'), { recursive: true });

  let report!: ClearSeenReport;
  assert.doesNotThrow(() => { report = clearSeen(dir, 'sess-1'); });

  assert.deepEqual(report.removed, []);
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].file, basename(seenFilePath(dir, 'sess-1')));
  assert.notEqual(report.failed[0].reason, '');
  assert.match(describeClearSeen(report), /items already delivered may be suppressed/);
});

test('one file that will not go does not stop the rest, and is counted once', (t) => {
  const dir = root(t);
  mkdirSync(seenFilePath(dir, 'sess-1'), { recursive: true }); // the parent will not go
  const a1 = seed(dir, 'sess-1::a1');
  const a2 = seed(dir, 'sess-1::a2');

  const report = clearSeen(dir, 'sess-1');

  assert.deepEqual(report.removed, [a1, a2].sort());
  assert.equal(report.failed.length, 1, 'the parent is attempted once, not once per pass');
  assert.equal(report.sweptSiblings, true);
  assert.deepEqual(names(dir), [basename(seenFilePath(dir, 'sess-1'))]);
});

test('a state/ that cannot be listed is a different sentence from an id with no prefix', (t) => {
  const dir = root(t);
  // `state` as a FILE: the listing fails with ENOTDIR (win32, measured) or
  // ENOTDIR/EACCES elsewhere — anything but ENOENT.
  writeFileSync(join(dir, 'state'), 'not a directory', 'utf8');

  let report!: ClearSeenReport;
  assert.doesNotThrow(() => { report = clearSeen(dir, 'sess-1'); });

  assert.equal(report.sweptSiblings, false);
  assert.notEqual(report.sweepError, null, 'a disk that could not be read is not an id problem');
  assert.match(describeClearSeen(report), /state\/ could not be listed/);
  assert.equal(readFileSync(join(dir, 'state'), 'utf8'), 'not a directory');
});

test('describeClearSeen says something for every report shape it can be handed', () => {
  const shapes: Array<[string, ClearSeenReport]> = [
    ['nothing at all', { removed: [], failed: [], sweptSiblings: true, sweepError: null }],
    ['a clean clear', { removed: ['a.seen.jsonl'], failed: [], sweptSiblings: true, sweepError: null }],
    ['siblings unnamed', { removed: ['a.seen.jsonl'], failed: [], sweptSiblings: false, sweepError: null }],
    ['state unlistable', { removed: [], failed: [], sweptSiblings: false, sweepError: 'ENOTDIR' }],
    ['one stuck file', {
      removed: [], failed: [{ file: 'a.seen.jsonl', reason: 'EBUSY' }],
      sweptSiblings: true, sweepError: null,
    }],
    ['two stuck files', {
      removed: ['b.seen.jsonl'],
      failed: [{ file: 'a.seen.jsonl', reason: 'EBUSY' }, { file: 'c.seen.jsonl', reason: 'EPERM' }],
      sweptSiblings: false, sweepError: null,
    }],
  ];
  for (const [label, report] of shapes) {
    const sentence = describeClearSeen(report);
    assert.notEqual(sentence, '', `${label}: a removal nobody can read about is a silent removal`);
    if (report.failed.length > 0) {
      assert.match(sentence, /may be suppressed/, `${label}: the CONSEQUENCE, not just the count`);
    }
    if (!report.sweptSiblings) {
      assert.match(sentence, /were left/, `${label}: what survived has to be said`);
    }
  }
  // The two failures are one clause with a count, not two pasted reasons:
  // an audit note carries scope, not content.
  assert.match(describeClearSeen(shapes[5][1]), /2 seen file\(s\) could not be removed \(EBUSY \+1 more\)/);
});

test('the clear retry budget is impatient where the append budget is patient, and it is WIRED', () => {
  // `retryOnTransientFsError` sleeps 20·(attempt+1) ms after each failed
  // attempt, so k attempts back off for at most 10·k·(k−1) ms per FILE.
  // Unlike appendSeen — whose worst case scales with one delivery, ~10
  // lines — a clear's scales with the size of `state/`, which is unbounded
  // and was measured at 46 files for a single session id on 2026-08-21.
  const perFileWorstMs = 10 * SEEN_CLEAR_ATTEMPTS * (SEEN_CLEAR_ATTEMPTS - 1);
  assert.ok(perFileWorstMs >= 20,
    `a clear that retries for ${perFileWorstMs}ms cannot outlast a scanner's momentary hold, ` +
    'and a lost clear suppresses everything the destroyed window had seen');
  // 200 files is over 4x the measured count. A SessionStart killed by
  // hooks.json at 10s injects NOTHING — a latency failure INV-hooks-fail-open
  // does not cover — so the whole clear must stay far inside it.
  assert.ok(200 * perFileWorstMs < 5000,
    `200 stuck files would back off ${200 * perFileWorstMs}ms inside a 10s SessionStart kill`);
  assert.ok(SEEN_CLEAR_ATTEMPTS < SEEN_APPEND_ATTEMPTS,
    'a per-file budget spent over an unbounded directory must be smaller than one spent per line');

  // The band above pins the CONSTANT. This pins that the removal actually
  // passes it, so dropping the argument — which would silently restore
  // `retryOnTransientFsError`'s 5-attempt default and its 200ms per file —
  // cannot pass unnoticed. There is no portable way to manufacture a
  // transient rm failure to measure the real loop with: read-only files and
  // held-open descriptors both delete cleanly on win32 (measured).
  const source = readFileSync(
    fileURLToPath(new URL('../../src/core/seen-file.ts', import.meta.url)), 'utf8',
  );
  assert.match(source, /rmSync\([^;]*\),\s*SEEN_CLEAR_ATTEMPTS\)/);
});

test('clearSeen is idempotent: the second call removes nothing and claims nothing', (t) => {
  const dir = root(t);
  seed(dir, 'sess-1');
  seed(dir, 'sess-1::a1');

  assert.equal(clearSeen(dir, 'sess-1').removed.length, 2);
  const again = clearSeen(dir, 'sess-1');
  assert.deepEqual(again.removed, []);
  assert.deepEqual(again.failed, []);
  assert.equal(again.sweptSiblings, true);
  assert.equal(existsSync(seenFilePath(dir, 'sess-1')), false);
});
