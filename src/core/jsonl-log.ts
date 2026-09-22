import fs from 'node:fs';
import {
  appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync,
  truncateSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { acquireLock } from './lock.ts';

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
 * What one look at the tail established — or that there was no look.
 *
 * **Two shapes rather than one with a `torn` boolean**, because `torn: false`
 * was the answer this function gave for a file it could not `stat` until
 * `plan:swallow seq:11`, and a caller had no way back from it: "I looked, and
 * the last byte is a newline" and "I could not look" were the same value, and
 * the only consumer — `healTornTail` — correctly decided there was nothing to
 * heal. `looked: false` carries NO `torn` field at all, so no caller can read
 * a verdict that was never reached. Same shape, same reason, as
 * `core/context-occupancy.ts`'s unmeasurable branch carrying no `percent`.
 */
type TornRead =
  | { looked: true; torn: boolean; size: number }
  | { looked: false; error: string };

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
 * **Only `ENOENT` is absence.** A missing file is not torn — there is nothing
 * to heal and `appendFileSync` creates it. Every other errno is a REFUSAL: a
 * locked file, a permission, a directory where the log should be. Those used
 * to answer "not torn", which let `appendJsonlLine` append onto an unhealed
 * fragment and wedge the log against `readJsonlLog` permanently.
 *
 * **`fs.statSync`, not a destructured named import**, and for the reason
 * `core/lock.ts` gives where it calls `fs.linkSync` the same way: this branch
 * cannot be reached on this platform with real files. A directory in place of
 * the log makes `statSync` SUCCEED (size 0), and a file used as a directory
 * component answers `ENOENT` rather than `ENOTDIR` on Windows — so there is no
 * arrangement of the filesystem that produces a non-`ENOENT` stat failure here.
 * Reading the property at call time lets `test/fixtures/force-stat-failure.ts`
 * force exactly this call to fail, in its own process, instead of the branch
 * being written and never proved.
 */
function isTorn(file: string): TornRead {
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { looked: true, torn: false, size: 0 };
    return { looked: false, error: `${file} could not be measured (${code ?? (err as Error).message})` };
  }
  if (size === 0) return { looked: true, torn: false, size: 0 };
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { looked: false, error: `${file} could not be opened (${code ?? (err as Error).message})` };
  }
  try {
    const buf = Buffer.alloc(1);
    readSync(fd, buf, 0, 1, size - 1);
    return { looked: true, torn: buf[0] !== 0x0a, size };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { looked: false, error: `${file}'s last byte could not be read (${code ?? (err as Error).message})` };
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
 *
 * ── THE STALE BOUND, REPRODUCED 2026-09-15 (`plan:swallow seq:12`) ──────────
 *
 * This used to compute the cut from the size it read BEFORE the backwards
 * scan, and truncate to it with no second look. `audit-db.ts` · the note that
 * two concurrent writers is the ordinary case states that two writers is the
 * ORDINARY case here, and the item that raised this said the race was inferred
 * and never produced. It produces: six processes appending 150 records each to
 * one torn log lost **32 of 900 complete records** with a ONE-BYTE torn tail,
 * and 94 of 900 with an 8 MB one. The one-byte figure is the one that matters
 * — the loss is not an artefact of a fixture that made the scan slow.
 *
 * The mechanism: A reads size S and finds the last newline at L. B heals the
 * same tear, truncates to L, and appends complete records. A then truncates to
 * L, which is now BEHIND B's records, and they are gone. The whole-file
 * `truncateSync(file, 0)` fall-through is the same thing at whole-file scale.
 *
 * ── WHAT REPLACES IT ───────────────────────────────────────────────────────
 *
 * The heal is serialized on `core/lock.ts`'s lock — the project's ONE file
 * lock, by that module's own standing rule, and pid-authoritative so a writer
 * killed mid-heal (the only thing that produces a torn tail in the first
 * place) leaves a lock that the next writer judges dead and reclaims rather
 * than a wedged log.
 *
 * The lock is taken ONLY once the file has been established torn, so the
 * ordinary append pays nothing for it: an untorn log still costs one `stat`
 * and one 1-byte read and takes no lock at all. A torn one is rare by
 * construction — it means a writer was killed — and correctness there is worth
 * more than the microseconds.
 *
 * Inside the lock the bound cannot go stale, because every appender heals
 * before it appends and every heal that sees a tear waits here. The tail is
 * re-read INSIDE the lock rather than trusting the look that got us here: by
 * then another holder has usually healed it already, and that is reported as
 * `intact` rather than as a second truncate of a file that no longer needs one.
 *
 * A heal that could not take the lock at all reports `contended` and
 * `appendJsonlLine` refuses to append on it, rather than writing past a
 * fragment `readJsonlLog` will refuse forever.
 */
export type TailHeal =
  | { healed: false; why: 'intact' | 'empty' }
  | { healed: false; why: 'unreadable'; error: string }
  | { healed: false; why: 'contended'; error: string }
  | { healed: true; droppedBytes: number };

/** The offset just past the last `\n` at or before `size`, or 0 if there is none. */
function cutAfterLastNewline(fd: number, size: number): number {
  let end = size;
  while (end > 0) {
    const start = Math.max(0, end - TAIL_CHUNK);
    const buf = Buffer.alloc(end - start);
    readSync(fd, buf, 0, buf.length, start);
    const at = buf.lastIndexOf(0x0a);
    if (at !== -1) return start + at + 1;
    end = start;
  }
  // No newline anywhere: the whole file is one unfinished write.
  return 0;
}

function unreadable(error: string): TailHeal {
  return { healed: false, why: 'unreadable', error };
}

function errnoOf(err: unknown): string {
  return (err as NodeJS.ErrnoException).code ?? (err as Error).message;
}

/**
 * The two points `healTornTail`/`appendJsonlLine` let a caller reach in
 * without a second copy of either function.
 *
 * **Why this exists, and why it is a seam rather than a shadow file.**
 * `test/core/jsonl-heal-race.test.ts` used to prove the heal lock matters by
 * regex-splicing a COPY of this module with the lock block cut out and
 * racing that copy in child processes — which could not notice a regression
 * where THIS file stopped calling `acquireLock`, because the copy never ran
 * this file's own code at all. `execute.ts`'s `CommandRunner` and
 * `execute-effect.ts`'s `RunChild`/`CopyTree` are this codebase's existing
 * shape for the same problem: a trailing, optional dependency that defaults
 * to the real implementation, so every caller that does not know this exists
 * — which is all of them but that one test file — gets exactly the
 * behaviour this file always had.
 *
 * `acquireLock` lets a test exercise the unlocked case (a stub that never
 * excludes anyone) or observe the locked one (the real acquirer, watched from
 * outside). `beforeTruncate` marks the window the lock exists to close — see
 * `cutAfterLastNewline`'s own doc comment ("A reads size S ... B heals the
 * same tear ... A then truncates to L") — so a test can act, or merely look,
 * at the exact instant between this heal's own read and its write.
 */
export interface HealSeams {
  /** Defaults to the real `acquireLock` (`./lock.ts`) — production behaviour. */
  acquireLock?: typeof acquireLock;
  /**
   * Called once the torn tail's cut point is known, immediately before the
   * `truncateSync` that acts on it. Defaults to a no-op.
   */
  beforeTruncate?: () => void;
}

/** The heal, with the tear already established and the lock already held. */
function healUnderLock(file: string, beforeTruncate: () => void): TailHeal {
  const read = isTorn(file);
  if (!read.looked) return unreadable(read.error);
  // Healed by whoever held the lock before this call — the ordinary outcome of
  // two writers arriving at one torn log, and not a second truncate.
  if (!read.torn) return { healed: false, why: read.size === 0 ? 'empty' : 'intact' };

  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch (err) {
    return unreadable(`${file} could not be opened to find its last complete record (${errnoOf(err)})`);
  }
  let cut: number;
  try {
    cut = cutAfterLastNewline(fd, read.size);
  } catch (err) {
    return unreadable(`${file}'s tail could not be scanned (${errnoOf(err)})`);
  } finally {
    closeSync(fd);
  }

  beforeTruncate();

  try {
    truncateSync(file, cut);
  } catch (err) {
    return unreadable(`${file}'s torn tail could not be truncated (${errnoOf(err)})`);
  }
  return { healed: true, droppedBytes: read.size - cut };
}

export function healTornTail(file: string, seams: HealSeams = {}): TailHeal {
  // **The look that decides whether to pay for the lock at all.** An untorn
  // log — every append but the first after a kill — leaves here having done
  // one `stat` and one 1-byte read, exactly what it did before.
  const first = isTorn(file);
  if (!first.looked) return unreadable(first.error);
  if (!first.torn) return { healed: false, why: first.size === 0 ? 'empty' : 'intact' };

  const acquire = seams.acquireLock ?? acquireLock;
  let release: () => void;
  try {
    release = acquire({
      file: `${file}.heal.lock`,
      name: 'jsonl-heal',
      otherHolder: 'another process is healing the unfinished write at the end of this log',
    });
  } catch (err) {
    return {
      healed: false, why: 'contended',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  try {
    return healUnderLock(file, seams.beforeTruncate ?? (() => {}));
  } finally {
    release();
  }
}

/**
 * Appends one record as one line.
 *
 * One `appendFileSync` call, which does not interleave with a concurrent
 * process's append on either POSIX or Windows for writes this small — the
 * property that lets a writer append without holding a lock.
 *
 * **A heal that did not happen stops the append**, and the `TailHeal` is
 * returned rather than discarded. Appending onto an unhealed fragment leaves a
 * damaged line that is no longer the FINAL one, and `readJsonlLog` refuses
 * exactly that — permanently, for every later reader. So the record is lost
 * either way, and the two ways are not equal: a throw reaches `recordAudit`'s
 * existing catch and becomes `written: false` with the reason, which
 * `auditFailureNote` already puts in front of a person. Writing anyway wedges
 * the log and says nothing.
 *
 * `seams` is forwarded to `healTornTail` verbatim and defaults exactly as it
 * does there — see `HealSeams`. No production caller passes it.
 */
export function appendJsonlLine(
  dir: string, file: string, record: unknown, seams: HealSeams = {},
): TailHeal {
  ensureLogDir(dir);
  const heal = healTornTail(file, seams);
  if (heal.healed === false && (heal.why === 'unreadable' || heal.why === 'contended')) {
    throw new Error(
      heal.why === 'unreadable'
        ? `${file} ends in an unfinished write and could not be healed: ${heal.error}. `
          + `Nothing was appended — a record written past that fragment would make every later `
          + `read of this log refuse it.`
        : `${file} ends in an unfinished write and the heal lock could not be taken: `
          + `${heal.error}. Nothing was appended — a record written past that fragment would `
          + `make every later read of this log refuse it.`,
    );
  }
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
  return heal;
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
 * Whether there was a FILE — the fact the ENOENT branch below observes.
 *
 *  - `read`   — a file was there and its bytes were handed to the parser.
 *  - `absent` — `readFileSync` answered ENOENT. Nothing else answers `absent`:
 *               a permissions failure or an I/O error is a file that could not
 *               be read, not a file that is not there, and it throws.
 *
 * **Why this is a value and not something each caller re-asks.** `[]` is the
 * honest answer to "what does the log hold" for both an absent log and an empty
 * one, and for most callers that is the whole question. It is not the whole
 * question for a log a PRODUCER REMOVES — `clearSeen` deletes a seen file when
 * `/clear` destroys a context window, and `pruneSnapshots` sweeps one at 30
 * days — because there "nothing was recorded" and "the record was taken away"
 * are different facts about the world, and a surface that has to draw one of
 * them cannot pick a sentence from an empty array. Any second spelling of the
 * question — an `existsSync` beside the read — asks the disk again a moment
 * later and can disagree with what the read saw, which is exactly how these two
 * facts came apart. So the read reports what it observed, once.
 */
export type JsonlFileState = 'read' | 'absent';

export interface JsonlFileRead {
  rows: JsonlRow[];
  /** `absent` only on an observed ENOENT; see `JsonlFileState`. */
  state: JsonlFileState;
}

/**
 * One log file, read whole, WITH the presence fact `readJsonlFile` drops.
 * Same three outcomes and the same bytes — `absent` is `{ rows: [], state:
 * 'absent' }`, unreadable throws `spec.unreadable`, a damaged line throws
 * `spec.refuse` unless it is a torn tail — so a caller moving from one to the
 * other changes nothing about what it reads, only about what it can say.
 */
export function readJsonlFileState(spec: JsonlLogSpec): JsonlFileRead {
  let raw: string;
  try {
    raw = readFileSync(spec.file, 'utf8');
  } catch (err) {
    // The ENOENT branch is the ONLY error swallowed here, and deliberately: a
    // permissions failure, a lock, or an I/O error is not "nothing has been
    // recorded", and reporting it as such would hide the entire log from every
    // surface that reads it.
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { rows: [], state: 'absent' };
    }
    throw spec.unreadable(err);
  }
  return { rows: parseJsonlLog(raw, spec), state: 'read' };
}

/**
 * One log file, read whole. Absent is `[]`; unreadable throws `spec.unreadable`;
 * a damaged line throws `spec.refuse` unless it is a torn tail.
 *
 * Byte-for-byte the behaviour every caller has always had: it is
 * `readJsonlFileState` with the presence fact dropped, which is the right shape
 * for a caller that has no way to be wrong about it — `readAudit` reads only
 * segments `readdirSync` just listed, and `readLog` answers "no revisions are
 * pending" identically for a log that never existed and one that holds no
 * lines. A caller for which the two DIFFER (see `JsonlFileState`) calls
 * `readJsonlFileState` instead of asking the disk a second time.
 */
export function readJsonlFile(spec: JsonlLogSpec): JsonlRow[] {
  return readJsonlFileState(spec).rows;
}
