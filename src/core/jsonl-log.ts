import {
  appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, statSync,
  truncateSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

// --- The append-only JSONL log, once ----------------------------------------
//
// `src/core/revision.ts` established this shape in Phase 1 and wrote down why:
// one `<json>\n` per record, appended and never rewritten, so a discard can
// never destroy the proposal it settles and a kill mid-write can damage at
// most the final line. `src/core/audit.ts` (Phase 5) needs the identical
// guarantees for a different payload. This module is that machinery, extracted
// verbatim in behaviour, so the second log is the SAME log shape rather than a
// third staging format with its own subtly different rules.
//
// The three read outcomes are the whole point and are not negotiable per
// caller (see `readJsonlLog`):
//
//   - absent          → `[]`
//   - unreadable      → THROW ("cannot read" is never "there is nothing")
//   - a damaged line  → THROW, unless it is a torn tail
//
// and `healTornTail` TRUNCATES rather than newline-healing, because a reader
// this strict would refuse forever the permanent middle line that
// newline-healing leaves behind (the defect `ingest/session.ts`'s
// `appendToLog` has and can afford, and this shape cannot).
//
// What is NOT shared is the wording. Every refusal names what the caller's log
// is for and what skipping a line there would cost, and those two sentences
// are different for a revision queue and for an audit trail — so the callers
// supply them (`refuse`, `unreadable`) and this module supplies only the
// decision about WHEN to throw.

/** One parsed line, before the caller's own validation narrows it. */
export type JsonlRow = Record<string, unknown>;

export interface JsonlLogSpec {
  /** Absolute path of the log file. */
  file: string;
  /**
   * The value every line's `protocol` field must equal. A mismatch is refused
   * on EVERY line, torn tail included: unrecognised protocol is version skew,
   * not a truncated write, and reading a future build's log as "empty" is the
   * same silent hiding the unreadable case refuses.
   */
  protocol: string;
  /**
   * Every protocol value this reader ACCEPTS, when that set is wider than the
   * one value it writes. Defaults to `[protocol]`, so a caller that passes one
   * version — `revision-log.ts`, `seen-file.ts` — keeps by construction the
   * behaviour it had before this field existed.
   *
   * It exists because `protocol` above is the value WRITTEN, and a log gains a
   * new version by having its writer bumped while every line already on disk
   * still carries the old one. Comparing with strict inequality against the
   * write value alone would make that bump refuse every existing log on the
   * first command after an upgrade — a more universal failure than the version
   * skew the field exists to diagnose. An empty array is not a wildcard: it
   * accepts nothing, and says so on line 1.
   */
  accepts?: readonly string[];
  /**
   * `null` when the row carries the fields the caller requires, or a short
   * description of what is missing or mistyped. Tolerated on a torn tail,
   * refused anywhere else.
   */
  validate: (row: JsonlRow) => string | null;
  /** The refusal for a damaged line that is not a torn tail. 1-based line number. */
  refuse: (line: number, reason: string) => Error;
  /** The error for a file that exists but cannot be read. */
  unreadable: (err: unknown) => Error;
}

/**
 * Creates the directory and (re)writes its `*` .gitignore.
 *
 * Same shape and same reason as `ensureIngestDir` (ingest/session.ts) and
 * `writeSnapshot` (core/ledger.ts): these directories hold working state and
 * run-time records, not knowledge, and a workspace that reached one through a
 * bare `mkdirSync` would offer the log — and any lock file beside it — to git.
 * Rewritten unconditionally so an emptied or hand-edited .gitignore self-heals.
 *
 * **The consequence is that the log is local to the machine that wrote it**,
 * and every caller of this function is required to disclose that where its log
 * is documented rather than leaving a reader to infer it. See `README.md`,
 * "What the audit log is not" (and `docs/README.he.md` for the Hebrew).
 *
 * The path in this sentence used to read `docs/README.md`, which does not
 * exist — the English README is at the repository root. A pointer that names
 * a missing file is worse than none: it reads as verified.
 */
export function ensureLogDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
  return dir;
}

/** How much of a torn tail is scanned backwards at a time when healing it. */
const TAIL_CHUNK = 64 * 1024;

/**
 * True when the file's last byte is not a newline, i.e. a writer was killed
 * mid-append.
 *
 * O(1): one `stat` and one 1-byte read, never a read of the whole file. That
 * matters because `appendJsonlLine` calls this before EVERY append and the
 * audit log's busiest writer is the PreToolUse hook, which runs on every tool
 * call under a 50 ms p95 ceiling. The original in-place version in
 * `revision.ts` read the entire log to answer this, which is invisible on a
 * revision queue of a few dozen lines and would have been a per-tool-call cost
 * proportional to the whole audit history.
 *
 * A missing file is not torn — there is nothing to heal and `appendFileSync`
 * creates it.
 */
function isTorn(file: string): { torn: boolean; size: number } {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return { torn: false, size: 0 };
  }
  if (size === 0) return { torn: false, size: 0 };
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1);
    readSync(fd, buf, 0, 1, size - 1);
    return { torn: buf[0] !== 0x0a, size };
  } finally {
    closeSync(fd);
  }
}

/**
 * Drops a torn final line before the next append.
 *
 * `appendToLog` in ingest/session.ts heals the same damage by prefixing a
 * newline, which leaves the fragment in place as a line every later read has
 * to skip. That is safe there because `readAppliedLines` skips a bad line
 * anywhere. It is NOT safe for this shape: `readJsonlLog` refuses a damaged
 * line that is not the final one, so newline-healing a fragment would wedge
 * the log permanently on the very write that recovers from the crash.
 *
 * Only bytes AFTER the final newline are removed, and only when the file does
 * not end in one. `appendJsonlLine` writes one complete `<json>\n` per record,
 * so those bytes cannot be a whole record — they are the tail of a write that
 * never finished, and `readJsonlLog` already reads the file as if they were
 * absent. `truncateSync` makes the file agree with that reading; it never
 * touches a byte of any completed record, which is what keeps this
 * append-only in the sense that matters.
 *
 * The scan for the final newline walks BACKWARDS in `TAIL_CHUNK` blocks rather
 * than reading the file, so its cost is proportional to the length of the torn
 * tail — bounded by one record — and not to the size of the log.
 */
export function healTornTail(file: string): void {
  const { torn, size } = isTorn(file);
  if (!torn) return;

  const fd = openSync(file, 'r');
  try {
    let end = size;
    while (end > 0) {
      const start = Math.max(0, end - TAIL_CHUNK);
      const buf = Buffer.alloc(end - start);
      readSync(fd, buf, 0, buf.length, start);
      const at = buf.lastIndexOf(0x0a);
      if (at !== -1) {
        closeSync(fd);
        truncateSync(file, start + at + 1);
        return;
      }
      end = start;
    }
  } finally {
    // Double-close is guarded: the success path above closes before
    // truncating and returns, so this only runs when it did not.
    try { closeSync(fd); } catch { /* already closed on the success path */ }
  }
  // No newline anywhere: the whole file is one unfinished write.
  truncateSync(file, 0);
}

/**
 * Appends one record as one line.
 *
 * One `appendFileSync` call, which does not interleave with a concurrent
 * process's append on either POSIX or Windows for writes this small — the
 * property that lets a writer append without holding a lock.
 */
export function appendJsonlLine(dir: string, file: string, record: unknown): void {
  ensureLogDir(dir);
  healTornTail(file);
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
}

function lastRowIndex(rows: string[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].trim() !== '') return i;
  return -1;
}

/**
 * Reads and validates one log file's worth of lines. See the module comment
 * for the three outcomes, which are the reason this exists at all.
 *
 * `raw` is passed in rather than read here so a caller reading several rotated
 * segments does its own I/O once per file and reports the failing file by
 * name; `readJsonlFile` below is the ordinary single-file entry point.
 */
export function parseJsonlLog(raw: string, spec: JsonlLogSpec): JsonlRow[] {
  const rows = raw.split('\n');
  const lastIndex = lastRowIndex(rows);
  // A torn write is the ONLY thing that can leave bytes after the final
  // newline: `appendJsonlLine` writes one `<json>\n` string per record, so a
  // complete record always ends the file with a newline. A damaged line that
  // IS newline-terminated therefore did not come from a killed writer — it is
  // corruption or a hand edit, and it gets no tolerance below.
  const torn = raw !== '' && !raw.endsWith('\n');

  // Hoisted: this runs on every line of every segment, and `readJsonlFile` is
  // on the PreToolUse hook's path through `seen-file.ts`.
  const accepted = spec.accepts ?? [spec.protocol];

  const out: JsonlRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    if (line.trim() === '') continue;
    const isLast = i === lastIndex && torn;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      if (isLast) continue; // a crash-truncated tail — the one case this log exists to survive
      throw spec.refuse(
        i + 1, `is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      if (isLast) continue;
      throw spec.refuse(i + 1, 'is not a JSON object');
    }
    const row = parsed as JsonlRow;
    if (typeof row.protocol !== 'string' || !accepted.includes(row.protocol)) {
      // Never tolerated, last line or not — see `JsonlLogSpec.protocol`.
      throw spec.refuse(
        i + 1,
        `declares protocol ${JSON.stringify(row.protocol)}, expected ` +
        `${accepted.map((p) => JSON.stringify(p)).join(' or ')} (it may have been written by a ` +
        `different version)`,
      );
    }
    const problem = spec.validate(row);
    if (problem !== null) {
      if (isLast) continue;
      throw spec.refuse(i + 1, problem);
    }
    out.push(row);
  }
  return out;
}

/**
 * One log file, read whole. Absent is `[]`; unreadable throws `spec.unreadable`;
 * a damaged line throws `spec.refuse` unless it is a torn tail.
 *
 * The ENOENT branch is the ONLY error swallowed here, and deliberately: a
 * permissions failure, a lock, or an I/O error is not "nothing has been
 * recorded", and reporting it as such would hide the entire log from every
 * surface that reads it.
 */
export function readJsonlFile(spec: JsonlLogSpec): JsonlRow[] {
  let raw: string;
  try {
    raw = readFileSync(spec.file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw spec.unreadable(err);
  }
  return parseJsonlLog(raw, spec);
}
