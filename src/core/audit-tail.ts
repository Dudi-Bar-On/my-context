import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { auditLogPath, auditSegments, parseAudit, type AuditRecord } from './audit.ts';
import { readCompleteLines } from './audit-db.ts';

/**
 * A live tail over the audit log for the web UI's Watch stream (web-ui plan 3).
 *
 * The JSONL is the truth and this reads it directly — no projection sits
 * between an append and the screen. Offsets are per segment file; only
 * COMPLETE lines are consumed (`readCompleteLines`, the projection's own
 * rule), so a hook killed mid-append never puts half a record on a screen.
 *
 * **Divergence resyncs; it never replays.** Divergence has two faces, and a
 * rotation shows the second one more often than the first. A file this tail
 * has consumed may shrink or vanish, and then the byte offsets no longer mean
 * "already emitted". But a rotation that renames the live log aside and
 * immediately starts a fresh one leaves a file at the SAME path with a size
 * that need not be smaller (measured on this repo's own rotation: 151 bytes
 * primed, 152 bytes after), so the shrink-or-vanish test alone does not see
 * it. What is always true of a rotation is that a ROTATED SEGMENT appears
 * that this tail has never read — and reading such a file from zero is
 * exactly the replay to avoid, since its records predate this tail. So an
 * unknown segment other than the live log is divergence too.
 *
 * Re-reading from zero would show every record around the rotation
 * twice, in an audit view. So the tail resets to the current EOFs and reports
 * `resync: true`; the consumer (the stream route, then the screen) refetches
 * its backlog through the query surface, which reads the projection and is
 * immune to the rename. Nothing is dropped silently: the resync is an event
 * the screen renders, not a condition it swallows.
 *
 * `poll()` throws what `parseAudit` throws: a damaged COMPLETE line means the
 * log cannot be trusted, and the audit read contract (audit.ts, `specFor`)
 * refuses rather than skips. The stream route turns that into a disclosed
 * `fault` event and ends the stream.
 */
export interface TailResult {
  records: AuditRecord[];
  resync: boolean;
}

// --- The bounded backlog (plan:walk seq:52) ---------------------------------
//
// **Why this exists.** A live tail that is empty is UNMEASURED — it means
// "nothing has been appended since you opened this", never "this corpus has no
// records" — and the owner read an empty Watch feed as the second over a corpus
// holding 2,076 records. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
// is the standard that reading breaks, and neither half of it can be satisfied
// from a stream that starts at EOF: there is nothing to draw, and nothing that
// knows whether the emptiness was measured.
//
// **Why it is an OPTION and not the new default.** Two callers construct an
// `AuditTail` and both depend on the current behaviour. `streamHandler`
// (`ui/watch-model.ts`) promises "what has landed since you connected", and
// `test/ui/server-e2e.test.ts` holds that promise as a contract — *"the records
// already in the log when it connected must NOT [arrive], because `AuditTail`
// starts at the current EOFs precisely so an audit view never shows an entry
// twice"*. Changing the constructor would start replaying history to every one
// of them, silently, which is the same defect pointed the other way. So a
// caller ASKS, and a caller that does not ask gets byte-for-byte what it got
// before.
//
// **Why it is BOUNDED and why the bound is declared.** 2,076 records into a
// live view is not a fix. `REQ-every-list-and-table-declares-what-leaves-it-and-when-and`
// is hard: a surface that truncates and says nothing cannot be told apart from
// one that is showing everything. `complete` is what says the difference, and
// it is only ever `true` when the scan actually reached the beginning of the
// log — so "all 7 records" is a MEASUREMENT and never an assumption.
//
// **Why the boundary is a record count and not a cursor — and how "show
// earlier" lands on it later.** `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`
// was filed today and is not built here. What this returns is shaped so it does
// not have to be undone: the caller receives records in log order with the
// OLDEST it was given first, and that record's own `at` is the boundary. The
// query surface already takes `until` (`/api/ask/audit`, `parseWhen`), so
// "show earlier" is that timestamp handed to an endpoint that exists, not a
// second cursor vocabulary invented here. A byte offset would have been the
// cheaper cursor and is deliberately not exposed: it is meaningless across the
// rotation this file already resyncs on.

/** What a caller asks of a tail beyond "follow the log". */
export interface TailOptions {
  /**
   * How many records ALREADY in the log to replay when the tail opens. `0` —
   * the default — is the pure live tail every existing caller gets.
   */
  backlog?: number;
  /**
   * The bytes the backwards scan may read. Defaults to `BACKLOG_SCAN_BYTES`;
   * a caller sets it only to test the exhausted-bound branch.
   */
  scanBytes?: number;
}

/** What was already in the log when a tail opened, and what that answer cost. */
export interface TailBacklog {
  /** OLDEST FIRST, at most `cap` — log order, so a screen can append in one direction. */
  records: AuditRecord[];
  /** What was asked for. Disclosed so a reader is never guessing at the bound. */
  cap: number;
  /**
   * **The whole of the declaration.** `true` means the scan reached the
   * beginning of the log: `records` is then the WHOLE log and nothing was held
   * back — including the empty-log case, where it is what turns a blank feed
   * into a measured zero. `false` means records exist that are not here, and a
   * surface drawing this must say so.
   */
  complete: boolean;
  /** The scan bound in bytes, disclosed the way `/api/watch/spills` discloses `recordWindow`. */
  scanBytes: number;
}

/**
 * How far back the opening scan will read, per tail.
 *
 * Measured on this repository's own log on 2026-08-27: 672,876 bytes over 2,076
 * records is ~324 bytes each, so this window holds ~800 records — forty times
 * the list bound the UI asks for. `complete` is therefore decided by how long
 * the log actually is in every corpus small enough for the answer to matter,
 * and the bound only bites where the honest answer is "there is more" anyway.
 *
 * Weighed against reading each segment whole to report an EXACT total the way
 * `boundedList` does: a segment rotates at 8 MB (`core/audit.ts` ·
 * `export const AUDIT_MAX_BYTES = 8 * 1024 * 1024;`), so an exact total costs a
 * full pass over every segment on every stream open, on the one route that is
 * held open indefinitely and must never take a lock or a long read. The
 * project's own precedent for the trade is `SPILL_RECORD_WINDOW` and
 * `RATIO_ROLE_WINDOW`: bound the read, and DISCLOSE the window rather than
 * claim a total nobody measured.
 */
export const BACKLOG_SCAN_BYTES = 256 * 1024;

function sizeOf(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return -1; // gone
  }
}

/**
 * The COMPLETE lines of `file` in `[from, end)`, as text.
 *
 * Two cuts, and each one is a different partial record. The tail cut is
 * `readCompleteLines`' own rule: `end` is an EOF captured while a writer may
 * have been mid-append, so anything after the last newline is a torn record and
 * is left alone. The HEAD cut is this function's own: a slice that does not
 * start at byte 0 begins in the middle of whatever record spans that offset, so
 * everything up to the first newline is dropped. Reading it would hand
 * `parseAudit` a fragment and turn a bounded scan into a refusal.
 *
 * Line NUMBERS in anything `parseAudit` then throws are relative to the slice
 * rather than to the file — re-deriving the absolute number would mean
 * counting newlines from 0 on every refusal, the whole cost the bound exists
 * to avoid, so this is still not corrected. **It is now DISCLOSED rather than
 * silently wrong**: both call sites below pass `windowed: true` whenever
 * `from > 0`, so `parseAudit`'s own refusal says plainly that its line number
 * is an offset into a bounded window, not the file's own count
 * (`TASK-a-server-older-than-the-data-on-disk-calls-the-audit-log` — the
 * owner's false alarm read line 18 of a tail window as line 18 of a 650-line
 * file, when the real line was 644).
 */
function readTailSlice(file: string, from: number, end: number): string {
  if (end <= from) return '';
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return ''; // rotated away under us; `poll()` reports the divergence
  }
  try {
    const buf = Buffer.alloc(end - from);
    const read = readSync(fd, buf, 0, buf.length, from);
    let slice = buf.subarray(0, read);
    if (from > 0) {
      const first = slice.indexOf(0x0a);
      if (first === -1) return '';
      slice = slice.subarray(first + 1);
    }
    const last = slice.lastIndexOf(0x0a);
    if (last === -1) return '';
    return slice.subarray(0, last + 1).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

export class AuditTail {
  #root: string;
  #offsets = new Map<string, number>();
  #backlogCap: number;
  #scanBytes: number;
  #backlog: TailBacklog | null = null;

  constructor(root: string, options: TailOptions = {}) {
    this.#root = root;
    this.#backlogCap = options.backlog ?? 0;
    this.#scanBytes = options.scanBytes ?? BACKLOG_SCAN_BYTES;
    for (const file of auditSegments(root)) this.#offsets.set(file, sizeOf(file));
  }

  /**
   * What was already in the log when this tail opened — the records BEFORE the
   * offsets the constructor captured, so nothing here can also arrive on
   * `poll()`. The boundary between history and live is exactly those offsets,
   * which is what lets a screen draw the two apart.
   *
   * **Computed on first call, not in the constructor, and memoized.** It reads
   * files and `parseAudit` REFUSES a damaged complete line — the audit read
   * contract, which this file's header already binds `poll()` to. A constructor
   * that throws would take the stream down before its response head was
   * written, turning a disclosed `fault` event into a bare 500; deferring it
   * lets the route disclose it on-stream exactly as it discloses a damaged line
   * found later. It is safe to defer because the boundary is the offsets, and
   * those were captured at construction.
   */
  backlog(): TailBacklog {
    if (this.#backlog === null) this.#backlog = this.#readBacklog();
    return this.#backlog;
  }

  #readBacklog(): TailBacklog {
    const cap = this.#backlogCap;
    const scanBytes = this.#scanBytes;
    // A tail that was never asked to look did not measure an empty log.
    // `complete: false` here is load-bearing: `true` would let a screen draw
    // "all 0 records" over a corpus with thousands in it.
    if (cap <= 0) return { records: [], cap, complete: false, scanBytes };

    // The constructor's OWN segment list, not a fresh `auditSegments()` call:
    // these are the files whose EOFs are the boundary, and a segment that
    // appeared since then belongs to `poll()`'s divergence check, not here.
    const files = [...this.#offsets.keys()];
    let budget = scanBytes;
    let reachedStart = true;
    const collected: AuditRecord[] = [];
    for (let i = files.length - 1; i >= 0; i -= 1) {
      // `> cap`, not `>= cap`: stopping AT the cap would leave "is there more?"
      // unanswered, and that question is the declaration. One record past the
      // cap is proof of a remainder and costs one segment read.
      if (collected.length > cap || budget <= 0) {
        reachedStart = false;
        break;
      }
      const file = files[i]!;
      const end = this.#offsets.get(file) ?? 0;
      if (end <= 0) continue; // empty, or gone since construction
      const from = Math.max(0, end - budget);
      budget -= end - from;
      const text = readTailSlice(file, from, end);
      // `windowed: from > 0` — a read starting at byte 0 carries the file's
      // real line numbers; one that does not is the mid-file slice this
      // module's own header already warns about (see `parseAudit`).
      if (text !== '') collected.unshift(...parseAudit(text, file, from > 0));
      if (from > 0) {
        reachedStart = false; // the bound cut this segment short
        break;
      }
    }
    return {
      records: collected.slice(Math.max(0, collected.length - cap)),
      cap,
      complete: reachedStart && collected.length <= cap,
      scanBytes,
    };
  }

  #resetToEof(files: string[]): void {
    this.#offsets = new Map();
    for (const file of files) this.#offsets.set(file, sizeOf(file));
  }

  poll(): TailResult {
    const files = auditSegments(this.#root);
    const present = new Set(files);
    const live = auditLogPath(this.#root);

    for (const [file, offset] of this.#offsets) {
      if (!present.has(file) || sizeOf(file) < offset) {
        this.#resetToEof(files);
        return { records: [], resync: true };
      }
    }

    // The other face of divergence: a rotated segment this tail has never
    // read. Its records predate this tail, so reading it from 0 would replay
    // them; and the rotation that produced it also replaced the live log
    // under a path whose offset now means nothing. Checked separately because
    // the loop above cannot see it — after a rotation the live log exists
    // again, at a size that need not have shrunk.
    for (const file of files) {
      if (file !== live && !this.#offsets.has(file)) {
        this.#resetToEof(files);
        return { records: [], resync: true };
      }
    }

    const records: AuditRecord[] = [];
    for (const file of files) {
      // The only file that can still be unknown here is a brand-new live log
      // (the first record in an empty workspace): read it from 0, because
      // everything in it was appended after this tail was constructed.
      const offset = this.#offsets.get(file) ?? 0;
      const { text, consumed } = readCompleteLines(file, Math.max(0, offset));
      // Same `windowed` rule as the backlog scan above: `offset > 0` is a
      // mid-file read, and its line numbers are the slice's, not the file's.
      if (text !== '') records.push(...parseAudit(text, file, offset > 0));
      this.#offsets.set(file, consumed);
    }
    return { records, resync: false };
  }
}
