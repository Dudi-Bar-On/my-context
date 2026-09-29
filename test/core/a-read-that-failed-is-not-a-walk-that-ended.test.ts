// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11`, a site the item does not name and the class it does: a read
 * that FAILED left the same account as a walk that finished.**
 *
 * `iterateTranscript`'s header promises *"Errors are states, never throws … A
 * read that fails part-way keeps everything already yielded and stops."* The
 * first clause is kept by a bare `catch {}` at the bottom of the generator
 * whose entire comment is *"a read that failed part-way keeps what it yielded.
 * `scannedBytes` says how far it got"* — and `scannedBytes` is the one thing
 * that does NOT say it. `TranscriptCursor`'s own docstring is where the
 * conflation is written down:
 *
 *   *"A consumer that stops early leaves these at the point it stopped, which
 *    is the honest answer: `reachedEnd` false with `scannedBytes` below the cap
 *    means the CONSUMER stopped, not the file."*
 *
 * That sentence is false whenever a read threw. `reachedEnd: false` with
 * `scannedBytes` below the cap then means one of three things — the consumer
 * broke out, the cap bit, or the file stopped giving up bytes — and a reader
 * acting on the documented reading concludes the calmest of the three.
 *
 * ── AND `line-walk.ts` GOES ON PROPAGATING, WHICH IS NOT NEGOTIABLE ───────
 *
 * Its header argues the opposite choice for itself, at length and correctly:
 * *"It does not swallow a read error. Two callers catch and keep what they got;
 * the redaction copier deliberately lets it propagate, because half a JSON
 * record in a file being handed to somebody is the one outcome that feature
 * exists to prevent. A `try` in here would take that choice away from all
 * four."* So the walk RECORDS and RE-THROWS. Recording is not swallowing, and
 * the last test here is what holds that line: the copier's throw still
 * arrives.
 *
 * ── HOW A READ IS MADE TO FAIL, ON EVERY PLATFORM THIS SHIPS TO ───────────
 *
 * A CLOSED DESCRIPTOR. `readSync` on one refuses with `EBADF` everywhere,
 * which is what a test of a read failure needs and what a permission bit
 * cannot give: `icacls /deny` does not bite for the account this suite runs as
 * (measured 2026-09-14). For `iterateTranscript`, which opens its own
 * descriptor, the subject is a DIRECTORY where a transcript should be — and
 * the two platforms fail it at different doors, which the test says out loud
 * rather than hiding: `openSync` refuses it on POSIX and SUCCEEDS on Windows,
 * where the first `readSync` is what refuses (measured here, 2026-09-23). The
 * claim under test is the same either way: the walk did not read the file and
 * the cursor says so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, mkdirSync, mkdtempSync, openSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eachLine, newLineWalk } from '../../src/core/line-walk.ts';
import { iterateTranscript, type TranscriptCursor } from '../../src/core/conversation-index.ts';
import { removeTree } from '../helpers/tmp.ts';

const LINES = [
  JSON.stringify({ type: 'user', message: { role: 'user', content: 'one' } }),
  JSON.stringify({ type: 'user', message: { role: 'user', content: 'two' } }),
].join('\n') + '\n';

function base(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-readfail-'));
}

const cursor = (): TranscriptCursor => (
  { scannedBytes: 0, reachedEnd: false, unreadable: 0 }
);

test('a transcript whose bytes could not be read leaves a cursor that SAYS so', () => {
  const dir = base();
  try {
    const transcript = path.join(dir, 'a.jsonl');
    mkdirSync(transcript);

    const walked = cursor();
    const records = [...iterateTranscript(transcript, { cursor: walked })];

    // The promise that already held, and must go on holding.
    assert.deepEqual(records, [], 'errors are states — nothing may be yielded from a failed read');
    assert.equal(walked.scannedBytes, 0);
    assert.equal(walked.reachedEnd, false);

    // The half that did not hold. Without this the account is
    // `{ scannedBytes: 0, reachedEnd: false }`, which is byte-identical to a
    // consumer that broke out of the loop before the first record — the exact
    // reading `TranscriptCursor`'s own docstring tells a caller to make.
    assert.equal(
      typeof walked.failed, 'string',
      'a walk that could not read one byte of the file is indistinguishable from a consumer ' +
      'that stopped after none, and the cursor documents the second reading',
    );
    assert.match(
      walked.failed ?? '', /EISDIR|EBADF|EPERM|EACCES|illegal operation|not permitted/u,
      'the reason has to be the platform\'s own — a caller sent to look at a file needs to know ' +
      'whether it is locked, gone, or not a file at all',
    );
  } finally { removeTree(dir); }
});

test('a walk that reached the end, and one a CONSUMER stopped, both say nothing', () => {
  // Two controls in one, and the second is the one that matters: if `failed`
  // were set whenever a walk ended early, it would be set on every lazy read in
  // this codebase — `anchors.ts` and `anchor-pass.ts` both break out after the
  // first record — and the field would mean nothing.
  const dir = base();
  try {
    const transcript = path.join(dir, 'a.jsonl');
    writeFileSync(transcript, LINES, 'utf8');

    const whole = cursor();
    assert.equal([...iterateTranscript(transcript, { cursor: whole })].length, 2);
    assert.equal(whole.reachedEnd, true);
    assert.equal(whole.failed, undefined, 'a walk that read the file to its end reported a fault');

    const stopped = cursor();
    for (const _record of iterateTranscript(transcript, { cursor: stopped })) break;
    assert.equal(stopped.reachedEnd, false, 'this is the shape the failed walk is confused with');
    assert.equal(
      stopped.failed, undefined,
      'a consumer that stopped early was reported as a file that would not be read — the ' +
      'disclosure fires on every lazy read in the codebase and stops meaning anything',
    );
  } finally { removeTree(dir); }
});

test('the line walk RECORDS the failure and still throws it, which is the copier\'s guarantee', () => {
  // `line-walk.ts`'s header: *"It does not swallow a read error … the redaction
  // copier deliberately lets it propagate, because half a JSON record in a file
  // being handed to somebody is the one outcome that feature exists to
  // prevent."* Recording is not swallowing, and this is the line between them.
  const dir = base();
  try {
    const transcript = path.join(dir, 'a.jsonl');
    writeFileSync(transcript, LINES, 'utf8');
    const fd = openSync(transcript, 'r');
    closeSync(fd);

    const walk = newLineWalk();
    assert.throws(
      () => { for (const _line of eachLine(fd, { cap: 1024 }, walk)) { /* never */ } },
      /EBADF|bad file/iu,
      'the copier is handed a walk that ended quietly, so it writes out a file with half a ' +
      'record in it and calls that a success',
    );
    assert.equal(
      typeof walk.failed, 'string',
      'the throw carries the reason to a caller that catches it, and the ACCOUNT carries ' +
      'nothing — so the two callers that catch and keep what they got have no way to say why',
    );
    assert.equal(walk.readBytes, 0);
    assert.equal(walk.reachedEnd, false);
  } finally { removeTree(dir); }
});
