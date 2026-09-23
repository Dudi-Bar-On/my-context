// @basis TASK-one-number-means-nothing-cited-could-not-read-and-read-only,
//   STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
//   INV-nothing-is-dropped-silently
//
/**
 * **Three facts, three answers — at the place the number is produced.**
 *
 * `scanTranscriptIds` returned `string[]`, so "nothing was cited", "the
 * transcript could not be read" and "only the last 8 MB of a 65 MB transcript
 * was read" all came back as the same value: an empty (or short) array whose
 * `.length` the PreCompact row then printed as one figure. A real transcript in
 * this workspace measures 65,046,326 bytes and the tail bound covers 12% of it,
 * so the third case drops every id cited in the first 57 MB — and printed the
 * same number as a session that cited nothing at all.
 *
 * What is pinned here is that `scanTranscript` returns the STATE beside the
 * ids, that the three states are distinguishable from each other without
 * reading the ids, and that a state which measured nothing carries no zero:
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids
 * dressing "unmeasured" up as "measured none", and `bytesRead`/`totalBytes` are
 * `null` exactly where nobody read anything.
 *
 * **A FOURTH fact joined them in round 1 of this task's review**, and it is the
 * same shape once more: whether anything CHECKED the ids. `KnownIds` makes the
 * caller say either which ids it knows — an empty set included, which is a real
 * filter matching nothing — or why it knows none, and the answer carries that
 * reason back in `unfiltered`. How much was read and whether it was checked are
 * two questions; one field answering both is how this defect got in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_TRANSCRIPT_BYTES, scanTranscript } from '../../src/core/ledger.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-scan-state-'));
}

test('a transcript read whole and citing nothing is a MEASURED zero, drawn and named', () => {
  const root = sandbox();
  const file = path.join(root, 't.jsonl');
  writeFileSync(file, '{"content":"no ids were mentioned in this session at all"}\n', 'utf8');

  const scan = scanTranscript(file, { ids: new Set(['CONST-a']) });
  assert.deepEqual(scan.ids, []);
  assert.equal(scan.state, 'whole');
  assert.equal(scan.why, null);
  assert.equal(scan.totalBytes, statSync(file).size);
  assert.equal(scan.bytesRead, scan.totalBytes,
    'a whole read must say it read the whole file, in bytes');

  removeTree(root);
});

test('a transcript that could not be read is UNMEASURED — no zero, and it says why', () => {
  const root = sandbox();
  const known = { ids: new Set(['CONST-a']) };

  const missing = scanTranscript(path.join(root, 'gone.jsonl'), known);
  assert.deepEqual(missing.ids, []);
  assert.equal(missing.state, 'unreadable');
  assert.ok(missing.why !== null && missing.why !== '', 'an unreadable transcript must say why');
  assert.equal(missing.bytesRead, null,
    'nothing was read, so a byte count would be a measurement nobody made');

  // A directory where a file was promised is the same fact with a different
  // cause, and it must not be reported as a file that cited nothing.
  const dir = scanTranscript(root, known);
  assert.equal(dir.state, 'unreadable');
  assert.ok(dir.why !== null && dir.why !== '');

  removeTree(root);
});

test('no transcript path at all is its own answer, never "read and found nothing"', () => {
  const known = { ids: new Set(['CONST-a']) };
  for (const nothing of [null, undefined, '']) {
    const scan = scanTranscript(nothing, known);
    assert.deepEqual(scan.ids, []);
    assert.equal(scan.state, 'absent', `${JSON.stringify(nothing)} did not report as absent`);
    assert.equal(scan.bytesRead, null);
    assert.equal(scan.totalBytes, null);
  }
});

/**
 * The expensive one, and it is expensive on purpose: ~9 MB of I/O to test a
 * byte boundary at the byte boundary. A smaller, injectable limit would test a
 * constant rather than the behaviour the hook's row now promises.
 */
test('an oversized transcript reports the tail bound, with both byte counts', () => {
  const root = sandbox();
  const file = path.join(root, 'big.jsonl');
  const filler = 'x'.repeat(MAX_TRANSCRIPT_BYTES + 1024);
  writeFileSync(file, `CONST-buried-at-the-start\n${filler}\nCONST-near-the-end\n`, 'utf8');

  const known = { ids: new Set(['CONST-buried-at-the-start', 'CONST-near-the-end']) };
  const scan = scanTranscript(file, known);
  assert.deepEqual(scan.ids, ['CONST-near-the-end'], 'the tail bound still bites');
  assert.equal(scan.state, 'tail');
  assert.equal(scan.bytesRead, MAX_TRANSCRIPT_BYTES);
  assert.equal(scan.totalBytes, statSync(file).size);
  assert.ok(scan.totalBytes! > scan.bytesRead!,
    'a tail read that read everything is not a tail read');

  removeTree(root);
});

/**
 * The claim the item makes, asserted as the item states it: ONE number for
 * three situations is the defect, so the three answers must differ from each
 * other — not merely be individually correct.
 */
test('nothing cited, could not read, and read only the tail are three different answers', () => {
  const root = sandbox();
  const known = { ids: new Set(['CONST-a']) };

  const quiet = path.join(root, 'quiet.jsonl');
  writeFileSync(quiet, '{"content":"nothing cited here"}\n', 'utf8');
  const big = path.join(root, 'big.jsonl');
  writeFileSync(big, `${'x'.repeat(MAX_TRANSCRIPT_BYTES + 1024)}\nCONST-a\n`, 'utf8');

  const states = [
    scanTranscript(quiet, known).state,
    scanTranscript(path.join(root, 'gone.jsonl'), known).state,
    scanTranscript(big, known).state,
  ];
  assert.equal(new Set(states).size, 3, `the three situations collapsed into ${states.join('/')}`);

  removeTree(root);
});

/**
 * **The empty filter is a real filter now, and it READS.**
 *
 * It used to return a `'not-scanned'` state without opening the file, and no
 * caller ever reached it — round 1 of this task's review found the state dead
 * and the doc claiming production hit it. An empty set says the index knows
 * zero ids, which is a fact about the INDEX; what the transcript cited is a
 * separate fact, and the only honest way to report it is to read the file and
 * find nothing matching. That is a measured zero over real bytes.
 */
test('an EMPTY known-id set reads the transcript and answers a measured zero', () => {
  const root = sandbox();
  const file = path.join(root, 't.jsonl');
  writeFileSync(file, 'CONST-a was cited right here\n', 'utf8');

  const scan = scanTranscript(file, { ids: new Set() });
  assert.deepEqual(scan.ids, []);
  assert.equal(scan.state, 'whole');
  assert.equal(scan.bytesRead, statSync(file).size,
    'the file was not read, so the zero is a guess rather than a measurement');
  assert.equal(scan.unfiltered, null, 'an empty filter is still a filter that ran');

  removeTree(root);
});

/**
 * The other half of the same distinction: NO filter was possible. The scan
 * still reads — over-capture is the safe direction, and a MISS is the one this
 * design forbids — and it carries the caller's reason back so the row can say
 * the count was never checked against anything.
 */
test('an unfiltered scan still reads, takes every id-shaped token, and says why nothing checked it', () => {
  const root = sandbox();
  const file = path.join(root, 't.jsonl');
  writeFileSync(file, 'CONST-a and STD-b and NOTANID were mentioned\n', 'utf8');

  const scan = scanTranscript(file, { unfiltered: 'index unavailable' });
  assert.deepEqual(scan.ids, ['CONST-a', 'STD-b'],
    'an unavailable index must over-capture, never under-capture');
  assert.equal(scan.state, 'whole');
  assert.equal(scan.unfiltered, 'index unavailable');

  // The reason travels even where nothing was read at all: a count that does
  // not exist and a count nothing checked are still two different facts.
  assert.equal(scanTranscript(null, { unfiltered: 'index empty' }).unfiltered, 'index empty');

  removeTree(root);
});

/**
 * An EMPTY transcript file — the review's Minor. It is a whole read of zero
 * bytes, so `0 bytes` here is measured rather than missing, and it must not be
 * told apart from a real read by accident.
 */
test('an empty transcript file is a whole read of zero bytes, not an unread one', () => {
  const root = sandbox();
  const file = path.join(root, 'empty.jsonl');
  writeFileSync(file, '', 'utf8');

  const scan = scanTranscript(file, { ids: new Set(['CONST-a']) });
  assert.deepEqual(scan.ids, []);
  assert.equal(scan.state, 'whole');
  assert.equal(scan.bytesRead, 0);
  assert.equal(scan.totalBytes, 0);
  assert.equal(scan.why, null);
  assert.equal(scan.unfiltered, null);

  removeTree(root);
});
