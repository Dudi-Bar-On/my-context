// @basis TASK-a-byte-offset-and-a-character-offset-are-the-same-number-and, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none, INV-nothing-is-dropped-silently
/**
 * **The one chunked line walk, and the fourth reader that had no seam test.**
 *
 * `test/core/chunk-seam-utf8.test.ts` proves three readers through a Hebrew
 * fixture straddling the 1 MiB boundary, and it stays the main proof of the
 * extraction: it drove `iterateTranscript`, the conversation endpoint and the
 * session summary before `core/line-walk.ts` existed and it drives them after.
 *
 * This file proves the two things that one cannot:
 *
 *   1. **The seam module itself**, directly — the carry across a boundary, the
 *      byte offsets it reports, the trailing fragment it hands back, and the
 *      two rules it deliberately does NOT apply (it neither skips an empty line
 *      nor emits the tail), because all four callers disagree about those and
 *      each keeps its own answer.
 *   2. **`conversation-redaction.ts`, the FOURTH reader**, which wrote the same
 *      twenty lines and had no assertion about the seam at all. It is the one
 *      caller that wants the line as BYTES, and the one that must not swallow a
 *      read failure, so a shared walk is more dangerous for it than for the
 *      other three.
 *
 * **Hebrew, for the reason `rulings/70` records:** on ASCII a byte offset and a
 * character offset are the same number, so an assertion over ASCII cannot fail
 * on this defect — which is exactly why two readers shipped wrong. Every seam
 * assertion below puts a two-byte character ACROSS the boundary, and the
 * fixture guards itself: if the fixture drifted so the boundary fell between
 * two characters, every assertion would go green for the wrong reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  LINE_WALK_CHUNK_BYTES, eachLine, forEachLine, newLineWalk,
} from '../../src/core/line-walk.ts';
import { chooseRedactions, redactedCopyPath } from '../../src/core/conversation-redaction.ts';
import { removeTree } from '../helpers/tmp.ts';

/** U+FFFD. What a decoder emits where it found half a character. */
const REPLACEMENT = '�';
/** Hebrew letters, every one two bytes in UTF-8, none escaped by JSON. */
const HEBREW = 'שלוםעולםהזהטקסטבעברית';

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-linewalk-'));
}

function withFd<T>(file: string, run: (fd: number) => T): T {
  const fd = openSync(file, 'r');
  try { return run(fd); } finally { closeSync(fd); }
}

/** Every line the walk yields, decoded, with the offset it was reported at. */
function walkLines(file: string, cap: number, from = 0, chunkBytes?: number): {
  lines: { text: string; at: number }[];
  readBytes: number;
  reachedEnd: boolean;
  trailing: { text: string; at: number } | null;
} {
  return withFd(file, (fd) => {
    const lines: { text: string; at: number }[] = [];
    const walk = forEachLine(
      fd,
      chunkBytes === undefined ? { cap, from } : { cap, from, chunkBytes },
      (bytes, at) => { lines.push({ text: bytes.toString('utf8'), at }); },
    );
    return {
      lines,
      readBytes: walk.readBytes,
      reachedEnd: walk.reachedEnd,
      trailing: walk.trailing === null
        ? null
        : { text: walk.trailing.bytes.toString('utf8'), at: walk.trailing.at },
    };
  });
}

test('a Hebrew character straddling a chunk boundary survives the carry', () => {
  const dir = scratch();
  try {
    // A tiny chunk size, so the fixture is small and the seam is exact. The
    // real readers use 1 MiB; the RULE is the same at any size, and a small one
    // makes the guard below readable.
    const chunkBytes = 32;
    const file = path.join(dir, 'seam.txt');
    // 31 ASCII bytes, then Hebrew — every Hebrew letter is two bytes, so the
    // first one occupies bytes 31 and 32 and the boundary falls INSIDE it
    // rather than between two characters. An even prefix would land between
    // them and prove nothing, which is the whole point of the guard below.
    const line = `${'a'.repeat(31)}${HEBREW}`;
    writeFileSync(file, `${line}\n`, 'utf8');

    const raw = readFileSync(file);
    // **The fixture guard.** `rulings/70`'s own lesson, one layer up: shifting
    // the fixture one byte left would leave every assertion below green on
    // broken code, so the boundary is asserted to fall on a UTF-8 CONTINUATION
    // byte (0b10xxxxxx).
    assert.equal((raw[chunkBytes] as number) & 0b1100_0000, 0b1000_0000,
      'the fixture must split a character at the boundary, or this proves nothing');

    const walked = walkLines(file, raw.length, 0, chunkBytes);
    assert.equal(walked.lines.length, 1);
    assert.equal(walked.lines[0]?.text, line);
    assert.ok(!walked.lines[0]?.text.includes(REPLACEMENT),
      'a string carry would leave two U+FFFD, one on each side of the seam');
  } finally { removeTree(dir); }
});

test('every line is reported at the byte it starts on, across a carry and after one', () => {
  const dir = scratch();
  try {
    const chunkBytes = 16;
    const file = path.join(dir, 'offsets.txt');
    const lines = ['first', 'a-line-longer-than-one-chunk-by-far', HEBREW, 'last'];
    writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    const raw = readFileSync(file);

    const walked = walkLines(file, raw.length, 0, chunkBytes);
    assert.deepEqual(walked.lines.map((l) => l.text), lines);
    // Computed from the fixture rather than written down, so the expectation
    // cannot drift away from the file it describes.
    let at = 0;
    for (const [i, text] of lines.entries()) {
      assert.equal(walked.lines[i]?.at, at, `line ${i} is reported at the wrong byte`);
      at += Buffer.byteLength(text, 'utf8') + 1;
    }
    assert.equal(walked.readBytes, raw.length);
    assert.equal(walked.trailing, null, 'a file ending in a newline has no fragment');
    // A FINDING, not a pass: `reachedEnd` means the read RAN OUT, and a cap
    // that happens to equal the file's length stops the loop before any read
    // can answer zero. That is why `iterateTranscript` keeps a one-byte probe
    // of its own after the walk — the rule belongs to its cursor, not here.
    assert.equal(walked.reachedEnd, false,
      'a cap landing exactly on the end of the file is not the walk learning it ended');
  } finally { removeTree(dir); }
});

test('the trailing fragment is handed back, never emitted, and carries its offset', () => {
  const dir = scratch();
  try {
    const file = path.join(dir, 'tail.txt');
    writeFileSync(file, `done\n${HEBREW}`, 'utf8');
    const raw = readFileSync(file);

    const walked = walkLines(file, raw.length, 0, 8);
    assert.deepEqual(walked.lines.map((l) => l.text), ['done'],
      'the unterminated tail is NOT a line — the four callers disagree about it, '
      + 'so the walk refuses to decide');
    assert.equal(walked.trailing?.text, HEBREW);
    assert.equal(walked.trailing?.at, 5);
    assert.ok(!(walked.trailing?.text.includes(REPLACEMENT) ?? true),
      'the fragment is bytes too, so a caller that decodes it gets whole characters');
  } finally { removeTree(dir); }
});

test('an empty line is yielded, not skipped — the redaction copier counts one as a record', () => {
  const dir = scratch();
  try {
    const file = path.join(dir, 'blanks.txt');
    writeFileSync(file, 'a\n\nb\n', 'utf8');
    const walked = walkLines(file, 64, 0, 4);
    assert.deepEqual(walked.lines.map((l) => l.text), ['a', '', 'b']);
  } finally { removeTree(dir); }
});

test('`from` starts where it is told, and `cap` stops where it is told', () => {
  const dir = scratch();
  try {
    const file = path.join(dir, 'range.txt');
    writeFileSync(file, 'aaa\nbbb\nccc\nddd\n', 'utf8');

    const skipped = walkLines(file, 8, 4, 4);
    assert.deepEqual(skipped.lines.map((l) => l.text), ['bbb', 'ccc']);
    assert.deepEqual(skipped.lines.map((l) => l.at), [4, 8]);
    assert.equal(skipped.readBytes, 8);
    assert.equal(skipped.reachedEnd, false, 'the cap stopped it, not the end of the file');
  } finally { removeTree(dir); }
});

test('a consumer that breaks out of `eachLine` still reads a true account', () => {
  const dir = scratch();
  try {
    const file = path.join(dir, 'lazy.txt');
    // Four chunks' worth. A walk that ran to the end would read all of it.
    writeFileSync(file, Array.from({ length: 400 }, (_, i) => `line-${i}`).join('\n') + '\n', 'utf8');
    const total = readFileSync(file).length;

    const walk = newLineWalk();
    const seen: string[] = [];
    withFd(file, (fd) => {
      for (const line of eachLine(fd, { cap: total, from: 0, chunkBytes: 64 }, walk)) {
        seen.push(line.bytes.toString('utf8'));
        break;
      }
    });
    assert.deepEqual(seen, ['line-0']);
    // This is why `iterateTranscript` uses the generator rather than the
    // callback: `anchors.ts` and `anchor-pass.ts` both return after the first
    // record, and a callback cannot stop a walk. One chunk was read, not 400
    // lines' worth.
    assert.equal(walk.readBytes, 64, 'exactly one chunk, however large the file');
    assert.ok(walk.readBytes < total);
  } finally { removeTree(dir); }
});

/**
 * The fourth reader. It had no seam assertion before this, and it is the one
 * whose output is a FILE somebody is handed — so a U+FFFD at the seam would be
 * baked into the artefact rather than shown on a screen.
 */
test('the redaction copier carries Hebrew across a real 1 MiB seam', () => {
  const dir = scratch();
  try {
    const mirror = path.join(dir, 'session.jsonl');
    // Pad with whole ASCII records until the NEXT record starts before the
    // 1 MiB boundary and runs past it, then put Hebrew across the boundary.
    const filler = `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'x'.repeat(200) } })}\n`;
    let text = '';
    while (text.length + filler.length < LINE_WALK_CHUNK_BYTES - 400) text += filler;
    const seamRecord = JSON.stringify({
      type: 'user', message: { role: 'user', content: HEBREW.repeat(60) },
    });
    text += `${seamRecord}\n`;
    writeFileSync(mirror, text, 'utf8');

    const raw = readFileSync(mirror);
    assert.ok(raw.length > LINE_WALK_CHUNK_BYTES, 'the fixture must cross the seam');
    assert.equal((raw[LINE_WALK_CHUNK_BYTES] as number) & 0b1100_0000, 0b1000_0000,
      'the fixture must split a Hebrew character at the 1 MiB boundary, or this proves nothing');

    // No candidate accepted: the copy must be byte-identical, which is the
    // strongest statement available and the one a corrupted seam breaks.
    chooseRedactions(mirror, 'session', []);
    const copy = readFileSync(redactedCopyPath(mirror));
    assert.ok(copy.equals(raw), 'the default copy is byte-for-byte the mirror');
    assert.ok(!copy.toString('utf8').includes(REPLACEMENT));
  } finally { removeTree(dir); }
});
