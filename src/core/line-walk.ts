/**
 * **One chunked line walk, and one `Buffer` carry, for the four places that
 * each wrote their own.**
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * `src/core/conversation-index.ts` (`iterateTranscript`),
 * `src/core/conversation-redaction.ts`, `src/core/session-summary.ts` and
 * `src/ui/read-model-conversations.ts` all read a JSONL transcript in bounded
 * chunks and split it on the newline BYTE. That is the same twenty lines
 * written four times, and each author re-derived the same decision
 * independently — **two of them got it wrong**, which is
 * `TASK-a-byte-offset-and-a-character-offset-are-the-same-number-and`
 * (`rulings/70`). This module is that item's own recommendation.
 *
 * **THE DECISION, made once, here.** A chunk boundary is counted in BYTES and
 * a UTF-8 character is not one byte, so a boundary lands inside a character
 * whenever the text is not ASCII — which this archive is from record 5, because
 * the corpus is Hebrew. Decoding each chunk on its own splits that character
 * into two U+FFFD, one at this chunk's tail and one at the next chunk's head:
 * the text is not lost, it is silently corrupted at a point nobody looks at,
 * and a search that should match no longer does. So **the leftover is carried
 * as a `Buffer` and every line is decoded ONCE, whole** — and the callback is
 * handed bytes rather than a string, so a caller that needs text decodes it and
 * a caller that re-encodes it (the redaction copier) never pays for a round
 * trip.
 *
 * The type of the carry is the entire correctness argument, and the wrong value
 * in the two broken seams was a `string` standing where a `Buffer` was meant.
 * `rulings/70` also asked whether the OFFSET should become a branded type
 * instead; the lane that fixed the seams recommended this extraction **over**
 * branding, because branding `number` would not have caught this bug. Branding
 * is explicitly deferred and is not what this module is.
 *
 * ── THE TWO SHAPES, AND WHY BOTH ───────────────────────────────────────────
 *
 * `forEachLine` is the ordinary one: hand it a descriptor and a callback and it
 * walks to the cap. `eachLine` is the generator it is built on, and it exists
 * because one of the four call sites is ITSELF a lazy generator whose consumers
 * stop after the first record — `anchors.ts` and `anchor-pass.ts` both `return`
 * out of the `for…of`, and the comment there records why it matters: *"the
 * generator's `finally` closes the descriptor when the loop breaks, so this
 * reads one chunk however large the transcript is."* A callback cannot stop a
 * walk, so collapsing that call site into `forEachLine` would read a 52 MB
 * transcript to answer a question the first line settles.
 *
 * ── WHAT IT DOES NOT DO, DELIBERATELY ──────────────────────────────────────
 *
 * **It does not open or close the descriptor.** Three of the four callers hold
 * one open across other work (the redaction copier writes to a second file
 * inside the loop) and all four have their own answer to a file that will not
 * open. The signature `rulings/70`'s lane costed takes an `fd` for that reason.
 *
 * **It does not swallow a read error.** Two callers catch and keep what they
 * got; the redaction copier deliberately lets it propagate, because half a
 * JSON record in a file being handed to somebody is the one outcome that
 * feature exists to prevent. A `try` in here would take that choice away from
 * all four.
 *
 * **It does not emit the trailing fragment**, and it does not skip an empty
 * line. Both are caller rules and the four disagree: the index and the summary
 * parse the tail only when the read reached the end of the FILE, the redaction
 * copier never emits it (a record still being written), and the copier counts
 * an empty line as a record while the other three skip it. The tail is handed
 * back in `LineWalk.trailing` for the caller to decide about.
 */
import { readSync } from 'node:fs';

/** Read granularity. Bounds memory independently of any caller's cap. */
export const LINE_WALK_CHUNK_BYTES = 1024 * 1024;

export interface LineWalkOptions {
  /** Stop after this many bytes have been READ by this walk. */
  cap: number;
  /** The byte offset to start at. Must be the first byte of a line. */
  from?: number;
  /** Read granularity. Only a test has a reason to move it. */
  chunkBytes?: number;
}

/**
 * How far a walk got, filled in AS IT GOES so that a consumer which breaks out
 * of `eachLine` still reads a true account of what was consumed.
 */
export interface LineWalk {
  /** Bytes read by this walk — not the position reached. */
  readBytes: number;
  /** The read ran out of file rather than stopping at the cap. */
  reachedEnd: boolean;
  /**
   * The unterminated fragment the walk ended holding, or `null`. Whether that
   * is a whole last line or a record cut in half is the caller's question, and
   * `reachedEnd` is what answers it.
   */
  trailing: { bytes: Buffer; at: number } | null;
}

/** A fresh account, for a caller that wants to pass one in and read it after. */
export function newLineWalk(): LineWalk {
  return { readBytes: 0, reachedEnd: false, trailing: null };
}

/**
 * Every complete line between `from` and `from + cap`, as bytes, with the byte
 * offset it starts at.
 *
 * `walk` is filled in as the generator runs; pass one to read how far it got.
 */
export function* eachLine(
  fd: number, options: LineWalkOptions, walk: LineWalk = newLineWalk(),
): Generator<{ bytes: Buffer; at: number }> {
  const chunkBytes = options.chunkBytes ?? LINE_WALK_CHUNK_BYTES;
  const buffer = Buffer.alloc(chunkBytes);
  let position = options.from ?? 0;

  /** Bytes of a line the last chunk ended in the middle of. */
  let carry: Buffer | null = null;
  /** Where that partial line began in the file. */
  let carryAt = 0;

  while (walk.readBytes < options.cap) {
    const want = Math.min(chunkBytes, options.cap - walk.readBytes);
    const read = readSync(fd, buffer, 0, want, position);
    if (read <= 0) { walk.reachedEnd = true; break; }
    const chunkAt = position;
    position += read;
    walk.readBytes += read;

    const view = buffer.subarray(0, read);
    let from = 0;
    for (;;) {
      const nl = view.indexOf(0x0a, from);
      if (nl === -1) break;
      let bytes: Buffer;
      let at: number;
      if (carry !== null) {
        bytes = Buffer.concat([carry, view.subarray(from, nl)]);
        at = carryAt;
        carry = null;
      } else {
        bytes = view.subarray(from, nl);
        at = chunkAt + from;
      }
      from = nl + 1;
      // `walk.trailing` is cleared here rather than at the end, so a consumer
      // that breaks mid-chunk is not handed a fragment from two chunks ago.
      walk.trailing = null;
      yield { bytes, at };
    }
    if (from < read) {
      // `buffer` is reused by the next read, so the leftover is COPIED out of
      // it rather than kept as a view into it.
      const rest = view.subarray(from, read);
      if (carry === null) { carryAt = chunkAt + from; carry = Buffer.from(rest); }
      else carry = Buffer.concat([carry, rest]);
      walk.trailing = { bytes: carry, at: carryAt };
    }
  }
  if (carry !== null && carry.length > 0) walk.trailing = { bytes: carry, at: carryAt };
  else walk.trailing = null;
}

/**
 * The same walk, driven to the cap with a callback — the shape three of the
 * four call sites want.
 *
 * A line's bytes are only valid for the duration of the call: a line that did
 * not cross a chunk boundary is a VIEW into the read buffer, which the next
 * read overwrites. Every caller decodes or copies immediately, which is what
 * the borrow is for.
 */
export function forEachLine(
  fd: number, options: LineWalkOptions, onLine: (bytes: Buffer, at: number) => void,
  walk: LineWalk = newLineWalk(),
): LineWalk {
  for (const line of eachLine(fd, options, walk)) onLine(line.bytes, line.at);
  return walk;
}
