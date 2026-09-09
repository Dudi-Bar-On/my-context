/**
 * **The mirror: a session kept outside the project, and kept up to date** —
 * `plan:archive seq:4`, step 4 of five in
 * `docs/superpowers/specs/2026-09-04-conversation-archive-design.md`.
 *
 * ── WHAT THE OWNER ASKED FOR, AND WHY IT IS NOT AN EXPORT ─────────────────
 *
 * The item shipped as "export a conversation" and he re-cut it on 2026-09-07,
 * in these words: *"if a session is marked as to stay persistent aka export
 * (maybe PERSISTENT is a better terminology, consider it), EVERY CHANGE IN A
 * SESSION FILE SHOULD ALSO BE WRITTEN TO ITS PERSISTENT EXTERNAL FILE IN ORDER
 * NOT TO LOSE CONTENT."*
 *
 * A one-shot export captures a session at a moment and then rots, and a session
 * still being written to would be exported half-finished with nobody able to
 * tell which half. So what is built is a STANDING MARK plus a MIRROR that keeps
 * up. Export survives as what the mirror IS rather than as a second command:
 * the mirror is one ordinary `.jsonl` file at a stable path, so "give me one
 * file I can hand to somebody" is answered by naming it, and there is no second
 * copy of a session for the two commands to disagree about.
 *
 * ── THE APPEND IS WHAT MAKES IT AFFORDABLE, AND THAT IS MEASURED ──────────
 *
 * The owner's own live session was 51.3 MB and 24,757 records when he asked;
 * re-measured on this workspace it has been past 65 MB. Copying the file on
 * every change is not affordable at the once-per-turn cadence this runs at.
 * A transcript ONLY APPENDS, so the mirror tails the bytes beyond what it
 * already holds — the same argument `rebuildConversations` makes for reading
 * only the tail of a grown transcript, and the same freshness key.
 *
 * ── AND IT IS CRASH-SAFE BY TRUNCATING BEFORE IT WRITES ───────────────────
 *
 * `PersistedRow.bytes` is the length the index has AGREED the mirror holds,
 * and the mirror is byte-for-byte the first `bytes` bytes of the transcript,
 * always ending on a line boundary. An advance therefore truncates the file
 * back to that number before appending, so an interrupted write costs the
 * partial line and never a duplicated one — and the file is valid JSONL at
 * every instant a reader could open it, which is what lets the viewer read a
 * mirror that is being written to.
 *
 * ── WHERE IT LIVES, AND WHY NOT IN THE CORPUS ─────────────────────────────
 *
 * `~/.my-context/conversations/<project>/<session>.jsonl` — the global root,
 * which already holds exactly this class of thing (`ui-sessions.json`,
 * `ui-server.json`). Not the corpus, for three reasons that are each on their
 * own sufficient: a corpus that grows by 51 MB per session is not a corpus;
 * `.my_context/` is committed, and a transcript is the one thing in this
 * product that must never reach a repository; and `test/ui/server-e2e.test.ts`
 * snapshots every byte under the workspace and asserts the read surface
 * changes none of them.
 *
 * Namespaced by `projectDirName(cwd)` — the harness's own encoding, borrowed
 * rather than invented — so two projects' sessions cannot collide in one
 * directory, and so a person looking for the copy finds it filed the same way
 * Claude Code files the original.
 *
 * `MYCONTEXT_MIRROR_DIR` overrides the location and the test suite pins it to a
 * temporary directory, exactly as `MYCONTEXT_UI_SESSIONS_DIR` is pinned: a
 * fixture leaking into the developer's real `~/.my-context/` turned 134
 * unrelated tests red on 2026-08-22 with a message pointing nowhere near the
 * cause.
 *
 * ── A WRITE, AND OUTSIDE THE PROJECT ──────────────────────────────────────
 *
 * Nothing under `src/ui/` may bind anything here; `test/ui/no-writes.test.ts`
 * names this module's writers. It is a separate module from
 * `conversation-index.ts` for that test's own reason: that module is in
 * `WRITES_WITHOUT_FS` on the strength of holding no `node:fs` write API at
 * all, and this one is nothing but `node:fs` writes.
 */
import {
  closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readSync, statSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import {
  ConversationIndex, projectDirName, scanTranscript, transcriptDir,
  type ConversationRow, type PersistedRow,
} from './conversation-index.ts';
import { GLOBAL_DIR } from './workspace.ts';

/** Names the directory the mirrors live in, overriding the global root. */
export const MIRROR_DIR_ENV = 'MYCONTEXT_MIRROR_DIR';

/**
 * How much is copied per read. The same 1 MiB `scanTranscript` uses, and for
 * the same reason: a mirror of a 65 MB transcript must never be held in memory
 * whole.
 */
const CHUNK_BYTES = 1024 * 1024;

/**
 * How far back a search for the last line boundary reads at a time.
 *
 * A tail is copied only up to its last newline, so the mirror is always whole
 * lines. Finding that newline reads BACKWARDS from the end of the file in
 * steps, because a transcript's last line is normally a few hundred bytes and
 * reading the delta twice to find it would double the cost of the thing this
 * module exists to make cheap. It steps rather than assuming, because one
 * record can be a tool result of several megabytes.
 */
const BOUNDARY_STEP = 64 * 1024;

/** The mirrors' root: the override when set, else `~/.my-context/conversations`. */
export function mirrorRoot(env: Record<string, string | undefined>): string {
  const configured = env[MIRROR_DIR_ENV];
  return configured !== undefined && configured !== ''
    ? configured
    : path.join(GLOBAL_DIR, 'conversations');
}

/** This project's mirrors, filed the way the harness files its own transcripts. */
export function mirrorDir(env: Record<string, string | undefined>, cwd: string): string {
  return path.join(mirrorRoot(env), projectDirName(cwd));
}

/** Where one session's mirror lives. The file a person can hand to somebody. */
export function mirrorPath(
  env: Record<string, string | undefined>, cwd: string, sessionId: string,
): string {
  return path.join(mirrorDir(env, cwd), `${sessionId}.jsonl`);
}

/** A file's size on disk, or `null` when it is not there. */
function sizeOf(file: string): number | null {
  try {
    const stat = statSync(file);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

/**
 * The offset just past the last `\n` at or before `end`, never below `floor`.
 *
 * `floor` when the range holds no newline at all — a partial record still being
 * written, which is the ordinary state of a transcript at the instant a hook
 * looks at it. Copying it would put half a JSON object in the mirror and the
 * other half in the next append, so the honest answer is to copy nothing this
 * turn and take the whole line on the next one.
 */
function lastLineEnd(fd: number, floor: number, end: number): number {
  let top = end;
  while (top > floor) {
    const from = Math.max(floor, top - BOUNDARY_STEP);
    const buffer = Buffer.alloc(top - from);
    const read = readSync(fd, buffer, 0, buffer.length, from);
    for (let i = read - 1; i >= 0; i--) {
      if (buffer[i] === 0x0a) return from + i + 1;
    }
    top = from;
  }
  return floor;
}

/**
 * How much of the tail is compared to decide the copy is still a prefix of the
 * file. One page, and the bound is the point: the check has to be affordable
 * once per marked session per assistant turn.
 */
const WITNESS_BYTES = 4096;

/** `count` bytes of `file` ending at `end`, or `null` when they cannot be read. */
function windowEndingAt(file: string, end: number, count: number): Buffer | null {
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return null;
  }
  try {
    const buffer = Buffer.alloc(count);
    return readSync(fd, buffer, 0, count, end - count) === count ? buffer : null;
  } catch {
    return null;
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }
}

/**
 * **Is the copy still a PREFIX of the file it was copied from?**
 *
 * The one integrity check available without keeping a digest of every mirrored
 * byte, and it is what separates "this file grew" from "a different file is now
 * at this path". The last page before the agreed length is read from both and
 * compared, and the last byte of it must be the newline the copy ends on.
 *
 * **A line-boundary check alone is not enough, and that was MEASURED rather
 * than reasoned about.** The first draft checked only that byte `bytes - 1` of
 * the transcript was still `
`; `a replaced transcript stops the copy and
 * records the reason on the mark` replaced a two-turn transcript with a
 * four-turn one and the check PASSED, because records of a similar shape are
 * of a similar length and the offset landed on a newline of the new file. It
 * would have appended the second half of a different conversation onto the
 * copy, silently, and every count on the row would still have added up.
 *
 * The residual is stated rather than hidden: a replacement whose final 4 KB
 * before the offset are byte-for-byte identical to the original's would pass.
 * What it reliably catches is truncation, a shorter replacement, a rewrite in
 * place, and — the case that actually occurs — a file that was started over.
 */
function stillPrefix(original: string, mirror: string, bytes: number): boolean {
  if (bytes === 0) return true;
  const window = Math.min(bytes, WITNESS_BYTES);
  const here = windowEndingAt(original, bytes, window);
  const kept = windowEndingAt(mirror, bytes, window);
  if (here === null || kept === null) return false;
  if (here[window - 1] !== 0x0a) return false;
  return here.equals(kept);
}

/**
 * Copy `[from, …]` of `source` onto `target`, truncating `target` back to
 * `from` first, and stopping at the last whole line.
 *
 * Returns the new agreed length — which is `from` when the delta held no line
 * boundary, and that is a legitimate answer rather than a failure.
 */
function appendTail(source: string, target: string, from: number, size: number): number {
  mkdirSync(path.dirname(target), { recursive: true });
  const src = openSync(source, 'r');
  let end = from;
  try {
    end = lastLineEnd(src, from, size);
    if (end <= from) return from;
    const dst = openSync(target, existsSync(target) ? 'r+' : 'w');
    try {
      // BEFORE a byte is written, never after: this is what makes an
      // interrupted advance cost the partial line instead of duplicating it.
      ftruncateSync(dst, from);
      const buffer = Buffer.alloc(CHUNK_BYTES);
      let at = from;
      while (at < end) {
        const want = Math.min(CHUNK_BYTES, end - at);
        const read = readSync(src, buffer, 0, want, at);
        if (read <= 0) break;
        writeSync(dst, buffer, 0, read, at);
        at += read;
      }
      return at;
    } finally {
      try { closeSync(dst); } catch { /* nothing usable to close */ }
    }
  } finally {
    try { closeSync(src); } catch { /* nothing usable to close */ }
  }
}

/** The one wording for a mirror that has stopped being able to keep up. */
export const REPLACED_NOTE =
  'the transcript on disk is no longer the file this mirror was copied from — it was replaced '
  + 'or rewritten rather than appended to, so nothing further can be added without guessing. '
  + 'What is here is everything up to that point.';

/** What one `mycontext conversation persist <session>` did. */
export interface PersistResult {
  sessionId: string;
  /** The mirror — the file to hand to somebody. */
  file: string;
  /** The transcript it was copied from. */
  from: string;
  /** Bytes the mirror now holds. */
  bytes: number;
  /** Bytes written by THIS run. `0` on a mark that was already caught up. */
  written: number;
  /** The mark already existed and this advanced it. */
  already: boolean;
  ms: number;
}

/** The session is not indexed, so there is nothing to copy and nowhere to look. */
export class NotIndexedError extends Error {}

/**
 * **Take the mark and make the copy** — the whole of
 * `mycontext conversation persist <session>`.
 *
 * The copy starts at byte 0 and not at the current end, and that CORRECTS the
 * item, which predicted the opposite: *"If a session is marked persistent
 * halfway through, the mirror starts from that point and the beginning is
 * already unrecoverable."* It is not, because a transcript only appends and the
 * whole of it is on disk at the moment the mark is taken — so marking a session
 * mid-flight loses nothing, and there is no partial-mirror state for a row to
 * have to disclose. The disclosure the item asked for would have been about a
 * state this build cannot reach.
 */
export function persistSession(
  dbPath: string,
  env: Record<string, string | undefined>,
  cwd: string,
  sessionId: string,
): PersistResult {
  const startedMs = Date.now();
  const index = ConversationIndex.open(dbPath);
  try {
    const row = index.get(sessionId);
    if (row === null) {
      throw new NotIndexedError(
        `my_context: no indexed session "${sessionId}". Only a session this workspace has ` +
        'scanned can be persisted — the mark records what to keep and the index is where the ' +
        'transcript it names is known. Run `mycontext conversation rebuild` and try again.',
      );
    }
    const target = mirrorPath(env, cwd, sessionId);
    const existing = index.persistedOf(sessionId);
    // **RE-RUNNING THIS ON A BROKEN COPY STARTS A FRESH ONE, WHICH IS WHAT THE
    // COMMAND'S OWN REPORT PROMISES.** `advanceMirrors` refuses to append to a
    // copy whose `note` is set — the file it was copied from was replaced, so
    // there is no correct offset to resume at — and the way out it names is
    // this command. Resuming from `bytes` here would splice the tail of one
    // conversation onto the body of another, in silence, and every count on
    // the row would still add up.
    const resumable = existing !== null
      && existing.note === null
      && existing.file === target
      && sizeOf(target) === existing.bytes
      && stillPrefix(row.file, target, existing.bytes);
    const from = resumable && existing !== null ? existing.bytes : 0;
    const size = sizeOf(row.file);
    if (size === null) {
      throw new NotIndexedError(
        `my_context: the transcript for "${sessionId}" is not on disk at ${row.file}. There is ` +
        'nothing here to copy. A session already gone cannot be persisted after the fact — ' +
        'that is the loss this command exists to prevent, not one it can undo.',
      );
    }
    const bytes = appendTail(row.file, target, from, size);
    const now = new Date().toISOString();
    index.markPersisted({
      sessionId,
      file: target,
      bytes,
      markedAt: existing?.markedAt ?? now,
      mirroredAt: now,
      note: null,
    });
    // The row says which file a reader is looking at, from this moment on.
    index.upsert({ ...row, source: 'persisted' });
    return {
      sessionId,
      file: target,
      from: row.file,
      bytes,
      written: bytes - from,
      already: existing !== null,
      ms: Date.now() - startedMs,
    };
  } finally {
    index.close();
  }
}

/** What `mycontext conversation persist --off <session>` did. */
export interface UnpersistResult {
  sessionId: string;
  /** `false` when there was no mark — an answer, not a failure. */
  unmarked: boolean;
  /** The mirror, which is LEFT ON DISK. `null` when there was no mark. */
  file: string | null;
}

/**
 * **Drop the mark and leave the file.**
 *
 * Deleting it would be this product destroying the only remaining copy of a
 * conversation on the strength of a command that reads as "stop keeping this up
 * to date". The two acts are different sizes and only the smaller one is
 * offered here; the larger one is the person's own `rm`, against a path this
 * command prints.
 *
 * A session whose original is gone keeps its `'exported'` row until the next
 * rebuild, which then drops it — the mark was the only thing holding it in the
 * list, which is `seq:5`'s point stated from the other side.
 */
export function unpersistSession(dbPath: string, sessionId: string): UnpersistResult {
  const index = ConversationIndex.open(dbPath);
  try {
    const existing = index.persistedOf(sessionId);
    if (existing === null) return { sessionId, unmarked: false, file: null };
    index.unpersist(sessionId);
    const row = index.get(sessionId);
    // Back to `'live'` only where there is a live file to be. An `'exported'`
    // row has no original left, so calling it live would be a false claim that
    // survives until the next rebuild removes the row.
    if (row !== null && row.source === 'persisted') index.upsert({ ...row, source: 'live' });
    return { sessionId, unmarked: true, file: existing.file };
  } finally {
    index.close();
  }
}

/** What one pass over every mark did. */
export interface MirrorReport {
  /** Where the mirrors are, named even when there are none. */
  dir: string;
  /** Marks found. */
  marked: number;
  /** Mirrors that took bytes this run. */
  advanced: number;
  /** Bytes written this run — the number that shows the append path working. */
  bytesWritten: number;
  /** Sessions now served FROM their mirror, because the original is gone. */
  orphaned: string[];
  /** Marks whose mirror can no longer keep up, with the reason on the row. */
  broken: string[];
  /** Marks dropped because the mirror itself is not on disk any more. */
  cleared: string[];
  ms: number;
}

/** An empty pass — the shape a caller always holds. */
function emptyMirrorReport(dir: string, startedMs: number): MirrorReport {
  return {
    dir,
    marked: 0,
    advanced: 0,
    bytesWritten: 0,
    orphaned: [],
    broken: [],
    cleared: [],
    ms: Date.now() - startedMs,
  };
}

/**
 * **Bring every mirror up to the file it mirrors** — the thing that makes a
 * mark worth taking.
 *
 * ── WHEN THIS RUNS, WHICH THE ITEM LEFT OPEN AND ASKED TO BE ARGUED ───────
 *
 * On `mycontext conversation rebuild`, and on the `Stop` hook beside the
 * refresh that already runs there. Not `SessionEnd`, and not a watcher:
 *
 *   - **A watcher is a second process** for a job that has to happen a few
 *     times a turn at most. It is the expensive answer to a cheap question.
 *   - **`SessionEnd` does not fire on the case this exists for.** The mark
 *     answers "do not lose this", and the ways a session is lost — a crash, a
 *     machine that goes down, a harness that prunes — are precisely the ways an
 *     end-of-session hook never gets to run. A mirror that catches up only at
 *     the end would be current exactly when the original still exists.
 *   - **The `Stop` hook already reads the tail**, once per assistant turn, and
 *     already argues that cadence with numbers. Riding it costs one extra read
 *     and one write of the SAME delta the refresh just scanned — measured in
 *     the report this returns, so a mirror that quietly fell back to copying
 *     whole files shows up as bytes rather than as a suspicion.
 *
 * It runs AFTER `rebuildConversations` rather than inside it, and that is the
 * read/write split holding: `conversation-index.ts` writes only through
 * `node:sqlite` and is named in `WRITES_WITHOUT_FS` on exactly that basis, so
 * the filesystem write lives here and the two are composed by their callers.
 *
 * Every branch is a STATE and none of them throws. A mirror that cannot keep up
 * is a row that says why; a mark whose file has been deleted is a mark that
 * goes, named.
 */
export function advanceMirrors(
  dbPath: string,
  env: Record<string, string | undefined>,
  cwd: string,
  options: { busyTimeoutMs?: number } = {},
): MirrorReport {
  const startedMs = Date.now();
  const dir = mirrorDir(env, cwd);
  const index = options.busyTimeoutMs === undefined
    ? ConversationIndex.open(dbPath)
    : ConversationIndex.open(dbPath, options.busyTimeoutMs);
  try {
    const marks = index.persisted();
    if (marks.length === 0) return emptyMirrorReport(dir, startedMs);
    const report = emptyMirrorReport(dir, startedMs);
    report.marked = marks.length;
    for (const mark of marks) {
      advanceOne(index, env, cwd, mark, report);
    }
    report.ms = Date.now() - startedMs;
    return report;
  } finally {
    index.close();
  }
}

/** One mark, and the four states it can be in. */
function advanceOne(
  index: ConversationIndex,
  env: Record<string, string | undefined>,
  cwd: string,
  mark: PersistedRow,
  report: MirrorReport,
): void {
  const row = index.get(mark.sessionId);
  const original = row?.source === 'exported' || row === null
    ? path.join(transcriptDir(env, cwd), `${mark.sessionId}.jsonl`)
    : row.file;
  const originalBytes = sizeOf(original);

  if (originalBytes === null) {
    orphan(index, mark, row, report);
    return;
  }
  // The original is here. Whatever else happens, a reader looking at this row
  // is looking at the live file, and the row says so.
  if (row !== null && row.source !== 'persisted') {
    index.upsert({ ...row, source: 'persisted' });
  }
  if (mark.note !== null) {
    // Already broken. It is not retried, because "append to a file that is not
    // the file we copied" has no correct answer to retry INTO — the person
    // re-takes the mark, which starts a fresh copy from byte 0.
    report.broken.push(mark.sessionId);
    return;
  }
  const mirrorBytes = sizeOf(mark.file);
  if (mirrorBytes === null) {
    // The copy is gone from under the mark. Nothing is silently re-created:
    // the mark is dropped and named, because re-copying 65 MB on a background
    // hook because a file vanished is not a thing to do without being asked.
    index.unpersist(mark.sessionId);
    report.cleared.push(mark.sessionId);
    if (row !== null && row.source !== 'live' && row.source !== 'exported') {
      index.upsert({ ...row, source: 'live' });
    }
    return;
  }
  if (originalBytes < mark.bytes || !stillPrefix(original, mark.file, mark.bytes)) {
    index.markPersisted({ ...mark, mirroredAt: new Date().toISOString(), note: REPLACED_NOTE });
    report.broken.push(mark.sessionId);
    return;
  }
  if (originalBytes === mark.bytes) return;

  const bytes = appendTail(original, mark.file, mark.bytes, originalBytes);
  if (bytes === mark.bytes) return;
  index.markPersisted({
    ...mark, bytes, mirroredAt: new Date().toISOString(), note: null,
  });
  report.advanced += 1;
  report.bytesWritten += bytes - mark.bytes;
}

/**
 * The original is gone and the mirror is all there is — the state the whole
 * mark exists for, and the one `seq:5` calls PERSISTED AND ORPHANED.
 *
 * The row is rebuilt from the MIRROR rather than left holding numbers scanned
 * from a file nobody can check any more. That costs one scan of the mirror,
 * once, at the moment the transcript disappears; what it buys is that an
 * `'exported'` row is exactly as trustworthy as a live one, because every
 * number on it was read from the file the reader is about to open.
 *
 * The title is carried forward rather than re-derived: it may have come from a
 * `custom-title.json` that lived beside the transcript and went with it, and a
 * recorded name silently becoming "Untitled session" is a drop.
 */
function orphan(
  index: ConversationIndex,
  mark: PersistedRow,
  row: ConversationRow | null,
  report: MirrorReport,
): void {
  const mirrorBytes = sizeOf(mark.file);
  if (mirrorBytes === null) {
    index.unpersist(mark.sessionId);
    report.cleared.push(mark.sessionId);
    return;
  }
  if (row !== null && row.source === 'exported' && row.file === mark.file
    && row.bytes === mirrorBytes) {
    // Already read back and unchanged. A mirror whose original is gone cannot
    // grow, so this is the steady state and it costs one `stat`.
    return;
  }
  const scan = scanTranscript(mark.file);
  const stat = statSync(mark.file);
  index.upsert({
    sessionId: mark.sessionId,
    source: 'exported',
    file: mark.file,
    bytes: mirrorBytes,
    mtimeMs: Math.floor(stat.mtimeMs),
    scannedBytes: scan.scannedBytes,
    startedAt: scan.startedAt,
    endedAt: scan.endedAt,
    prompts: scan.prompts,
    answers: scan.answers,
    machinery: scan.machinery,
    records: scan.records,
    unreadable: scan.unreadable,
    branch: scan.branch,
    cwd: scan.cwd,
    title: row?.title ?? scan.aiTitle,
    titleSource: row?.title !== undefined && row.title !== null
      ? row.titleSource
      : (scan.aiTitle !== null ? 'ai' : null),
    scannedAt: new Date().toISOString(),
  });
  report.orphaned.push(mark.sessionId);
}
