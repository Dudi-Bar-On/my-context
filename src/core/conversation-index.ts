/**
 * The conversation index and the scanner that rebuilds it from disk —
 * `plan:archive seq:1`, step 1 of five in
 * `docs/superpowers/specs/2026-09-04-conversation-archive-design.md`.
 *
 * ── WHAT THIS IS, AND THE ONE FACT THE WHOLE DESIGN RESTS ON ───────────────
 *
 * **The recording already exists.** Claude Code writes every session to
 * `~/.claude/projects/<project>/<session>.jsonl`. Nothing here captures
 * anything; this is a READING feature.
 *
 * The spec says `message.role` already separates prompts from answers. It does
 * not, quite, and `classifyTurn` below carries the measurement that shows where
 * it fails and what this build counts instead.
 *
 * What is kept is an INDEX holding one row per SESSION — not per message —
 * so it stays small however many sessions accumulate. Measured on this
 * project's own corpus, 2026-09-07:
 *
 *     transcript   52,061,736 bytes   22,605 records
 *     turns        450 prompts   1,668 answers   6,553 machinery
 *     one row      ~300 bytes
 *
 * The transcript file is the source of truth and this index is a cache — the
 * analogue of `INV-markdown-is-the-source-of-truth`. Losing it costs time and
 * never knowledge, which is why `rebuildConversations` reconstructs the whole
 * thing from disk.
 *
 * ── WHERE THE ROWS LIVE, AND WHY NOT BEHIND `SCHEMA_VERSION` ───────────────
 *
 * In `.my_context/.index.db`, the disposable index the corpus already uses —
 * the spec's own instruction. But as a SECOND schema owner in that file, the
 * way `ledger`/`ledger_source` already are (`core/ledger.ts`), and not as a
 * new table inside `store.ts`'s `SCHEMA`.
 *
 * That is a deliberate choice with a measured cost behind it. `store.ts`'s
 * `tryOpen` runs NO DDL at all on the "already current" branch, so a table
 * added to `SCHEMA` reaches an existing workspace only via a `SCHEMA_VERSION`
 * bump — and that branch begins `DROP TABLE IF EXISTS items;`, discarding and
 * refilling every installed workspace's item index to gain a table that has
 * nothing to do with items. The ledger avoided exactly that by owning its own
 * DDL, and so does this.
 *
 * The consequence, stated rather than discovered: these tables carry no
 * version number, so THE SHAPE IS THE VERSION. `openReadOnlyChecked` walks
 * `CONVERSATION_TABLE_COLUMNS` for that reason, precisely as
 * `Ledger.openReadOnlyChecked` does, and refuses a shape it does not read
 * rather than migrating.
 *
 * The other inherited cost: `Store.open` deletes `.index.db` outright on
 * corruption. These rows go with it. That is acceptable here and would not be
 * for the audit projection (which is why THAT lives in its own file): every
 * column below is reconstructible from a transcript still sitting on disk.
 *
 * ── THE WRITE / READ SPLIT, WHICH IS NOT A CONVENTION BUT THE POINT ────────
 *
 * `ConversationIndex.open` creates the tables, so opening one IS a write, and
 * nothing under `src/ui/` may call it. The web UI is read-only and says so in
 * its own navigation; `test/ui/no-writes.test.ts` enforces it by walking the
 * transitive import graph. The read path is `openReadOnlyChecked`, which
 * creates nothing, migrates nothing, and reports the never-built state as
 * `ConversationIndexUninitializedError` — its own class, so a caller can tell
 * an empty archive from a damaged one WITHOUT matching on a message.
 *
 * That is `INV-nothing-is-dropped-silently` cutting both ways, and it is the
 * reason the CLI half of this feature exists at all: a read-only server cannot
 * build its own index, so `mycontext conversation rebuild` is what fills it.
 *
 * ── AND FOR A YEAR OF TURNS, THAT WAS THE ONLY THING THAT EVER DID ─────────
 *
 * `rebuildConversations` had exactly one caller — that command, typed by a
 * person — and the screen serves the INDEX rather than the file. Measured
 * 2026-09-08 on this project's own corpus: the index said the owner's session
 * ended `2026-09-07T00:50` while the transcript was 65,046,326 bytes and had
 * been written that minute. **11,231,042 bytes, and over a day, behind.**
 * `plan:restore` and the self-improvement loop read these same rows, so a
 * stale index is a loop learning from a day-old transcript and never knowing.
 *
 * Two things changed and they are deliberately separate:
 *
 *   - **A refresh is now automatic**, on `hooks/stop.ts`, once per assistant
 *     turn in the parent session. It is affordable because a transcript ONLY
 *     APPENDS: an unchanged file costs one `stat`, and a grown one costs its
 *     TAIL. `rebuildConversations` argues that path and carries the numbers.
 *   - **The staleness is now VISIBLE**, from a `stat` alone and with no
 *     rebuild, so a cache that is behind says so wherever it is served.
 *     `staleBy` below is the predicate, and `ui/read-model-conversations.ts`
 *     serves it on every row.
 *
 * The second is not a consolation for the first failing; it is the part that
 * makes the first CHECKABLE. Automatic refresh that silently stopped working
 * would put the archive back exactly where it was found.
 */
import { DatabaseSync } from 'node:sqlite';
import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * The tables this file owns, and the columns each declares. Read by exactly
 * one thing — `ConversationIndex.openReadOnlyChecked` — because on a read path
 * this shape IS the version; see the header for why there is no number to
 * compare instead.
 */
const CONVERSATION_TABLE_COLUMNS: [string, string[]][] = [
  ['conversations', [
    'session_id', 'source', 'file', 'bytes', 'mtime_ms', 'scanned_bytes',
    'started_at', 'ended_at', 'prompts', 'answers', 'machinery', 'records', 'unreadable',
    'branch', 'cwd', 'title', 'title_source', 'scanned_at',
  ]],
];

/**
 * `source` is a column rather than something inferred from a path, because the
 * owner asked for a live session and an exported copy to be distinguishable
 * wherever either appears, and a fact that important should not be re-derived
 * by every reader. Only `'live'` is written today; `'exported'` is step 5's,
 * and the column exists now so step 5 adds rows rather than a migration.
 *
 * `scanned_bytes` beside `bytes` is the truncation disclosure in the row
 * itself: they are equal for a transcript read whole, and `scanned_bytes <
 * bytes` means the scan stopped at `MAX_SCAN_BYTES` and every count derived
 * from it is a floor rather than a total. A capped row and a complete one must
 * not look the same.
 *
 * `(bytes, mtime_ms)` is the freshness key, and the reason a re-scan is cheap:
 * a file whose size and mtime match its row is skipped after one `stat`.
 */
const CONVERSATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  session_id    TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  file          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  mtime_ms      INTEGER NOT NULL,
  scanned_bytes INTEGER NOT NULL,
  started_at    TEXT,
  ended_at      TEXT,
  prompts       INTEGER NOT NULL,
  answers       INTEGER NOT NULL,
  machinery     INTEGER NOT NULL,
  records       INTEGER NOT NULL,
  unreadable    INTEGER NOT NULL,
  branch        TEXT,
  cwd           TEXT,
  title         TEXT,
  title_source  TEXT,
  scanned_at    TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_conversations_ended  ON conversations(ended_at);
CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
`;

/**
 * The database is a real database and holds no `conversations` table at all:
 * nobody has ever run `mycontext conversation rebuild` in this corpus.
 *
 * A legitimate empty state and not a fault — a fresh corpus reaches exactly
 * this, because `Store.open` creates `schema_version` and `items` while this
 * table is created by `ConversationIndex.open`, which no command has yet run.
 * It carries its own class for the reason `LedgerUninitializedError` does: so
 * a caller can tell this state from damage without matching on a message.
 */
export class ConversationIndexUninitializedError extends Error {}

/** One indexed session, in the shape the row is stored and read back. */
export interface ConversationRow {
  sessionId: string;
  /** `'live'` — the harness writes it. `'exported'` is step 5's and unused here. */
  source: string;
  /** Absolute path to the transcript this row was scanned from. */
  file: string;
  /** The transcript's size on disk at scan time. */
  bytes: number;
  mtimeMs: number;
  /** How much of it the scan actually read. `< bytes` means the counts are floors. */
  scannedBytes: number;
  startedAt: string | null;
  endedAt: string | null;
  /** Turns a PERSON typed. See `classifyTurn` for why this is not "role === user". */
  prompts: number;
  /** Turns the model spoke in words. Not every assistant record is one. */
  answers: number;
  /**
   * `user`/`assistant` records carrying no human-readable turn: tool results,
   * tool calls, and thinking. Counted rather than discarded so `prompts +
   * answers + machinery` accounts for every conversational record and a reader
   * can see what the two headline numbers left out.
   */
  machinery: number;
  /** Records parsed, of every type — the denominator the counts sit in. */
  records: number;
  /** Lines that would not parse. Never a throw; always a number that is shown. */
  unreadable: number;
  branch: string | null;
  cwd: string | null;
  title: string | null;
  /** `'custom'`, `'ai'`, or `null` when nothing named it — never a fabricated title. */
  titleSource: string | null;
  scannedAt: string;
}

/**
 * **The bound on a single scan, and the measurement behind the number.**
 *
 * The spec measured one of this project's transcripts at 13,095,349 bytes on
 * 2026-09-04. Re-measured 2026-09-07 the live session was 52,061,736 bytes —
 * FOUR TIMES the figure the design was written against — which is the whole
 * argument for a stated cap rather than a read that happens to be fine today.
 *
 * 256 MiB is five times the largest transcript observed on this machine, and
 * a full scan of the 52 MB one takes 376 ms by measurement, so the cap is
 * roughly a two-second ceiling per file. Memory is bounded far below it
 * regardless: `scanTranscript` reads in 1 MiB chunks and never holds the file.
 *
 * When the cap is reached the row records `scannedBytes < bytes` and every
 * count it carries is a floor. It is NOT silently short —
 * `INV-nothing-is-dropped-silently` — and `truncatedScan` below is the
 * predicate every surface asks rather than re-deriving the comparison.
 */
export const MAX_SCAN_BYTES = 256 * 1024 * 1024;

/** Read granularity. Bounds memory independently of `MAX_SCAN_BYTES`. */
const CHUNK_BYTES = 1024 * 1024;

/** Did this row's scan stop at the cap? The one place the comparison is made. */
export function truncatedScan(row: { bytes: number; scannedBytes: number }): boolean {
  return row.scannedBytes < row.bytes;
}

/**
 * **How many bytes of this session's transcript the index has never read.**
 *
 * The predicate the whole staleness disclosure rests on, and it is a
 * SUBTRACTION rather than a scan: `row.bytes` is the size the file had when it
 * was indexed and `onDiskBytes` is what a `stat` says now, so a surface can
 * report "this is 11 MB behind" without opening the file at all. Measured on
 * this machine, 2026-09-08: `listTranscriptFiles` stats the whole directory in
 * **0.449 ms**, against 168 ms to re-read the 65 MB transcript it names.
 *
 * It exists as a named function beside `truncatedScan` for that function's own
 * stated reason — a comparison every surface re-derives is a comparison two
 * surfaces will eventually make differently — and because the defect it
 * discloses is the one this index actually had: the archive screen served rows
 * scanned on 2026-09-07T04:03 while the owner's transcript had grown
 * **11,231,042 bytes** past them, and nothing anywhere said so.
 *
 * `0` for a file that is gone (`onDiskBytes === null`), because a pruned
 * session is not a stale one — `ConversationSummary.present` is the field that
 * already says that, and two fields disagreeing about one state is worse than
 * either alone. `0` too for a file that SHRANK, which is not "behind" but a
 * transcript replaced under the index; `rebuildConversations` re-reads that one
 * whole rather than appending to it.
 */
export function staleBy(row: { bytes: number }, onDiskBytes: number | null): number {
  if (onDiskBytes === null) return 0;
  return onDiskBytes > row.bytes ? onDiskBytes - row.bytes : 0;
}

/**
 * A working directory, encoded the way Claude Code names its transcript
 * directory: every path separator and drive colon becomes a hyphen.
 *
 * **Measured rather than assumed**, 2026-09-07, against the real directory on
 * this machine — `D:\Users\UserC\source\repos\my-context` is filed under
 * `D--Users-UserC-source-repos-my-context`, the doubled hyphen being the
 * colon and the separator in turn. `test/core/conversation-index.test.ts`
 * pins both that case and the nested-temp-path case observed beside it.
 *
 * This encoding is the HARNESS's, not ours, and it can change without notice.
 * That is survivable because nothing here fails when the directory is absent:
 * `listTranscriptFiles` reports an empty archive rather than throwing, and the
 * screen says the directory it looked in — so a changed encoding surfaces as
 * "nothing here, and here is where I looked" rather than as silence.
 */
export function projectDirName(cwd: string): string {
  return cwd.replace(/[\\/:]/g, '-');
}

/**
 * Where Claude Code keeps its transcripts: `CLAUDE_CONFIG_DIR`, else
 * `~/.claude` — then `projects/`.
 *
 * The variable is honoured for the reason `claudeSettingsPath`
 * (`cli/commands/statusline-install.ts`) gives for honouring it there: it is
 * the binary's own, so a reader that ignored it would look in a directory the
 * user's Claude Code does not use and then report an empty archive. An
 * exported-but-empty value is treated as unset, matching that function.
 *
 * The environment is an argument rather than a `process.env` read so both
 * branches are testable without mutating the process — again that function's
 * shape, and the reason this is not simply imported from it is that
 * `statusline-install.ts` is a WRITER (`test/ui/no-writes.test.ts` names
 * `cmdStatuslineInstall` in `WRITERS`), so importing it here would drag the
 * write surface into the graph the UI read path walks.
 */
export function claudeProjectsDir(env: Record<string, string | undefined>): string {
  const configured = env['CLAUDE_CONFIG_DIR'];
  const dir = configured !== undefined && configured !== ''
    ? configured
    : path.join(homedir(), '.claude');
  return path.join(dir, 'projects');
}

/** This workspace's transcript directory: the projects root plus the encoded cwd. */
export function transcriptDir(
  env: Record<string, string | undefined>, cwd: string,
): string {
  return path.join(claudeProjectsDir(env), projectDirName(cwd));
}

/** One transcript file found on disk, before anything has been read from it. */
export interface TranscriptFile {
  sessionId: string;
  file: string;
  bytes: number;
  mtimeMs: number;
}

/**
 * The transcripts in one project directory: **top-level `*.jsonl` only, never
 * a recursive walk.**
 *
 * That is not tidiness, it is the difference between a bounded listing and an
 * unbounded one. Measured on this project's directory, 2026-09-07:
 *
 *     the two transcripts                        52 MB
 *     <session>/subagents/    414 files         493 MB
 *     <session>/tool-results/ 1,149 files        91 MB
 *     ------------------------------------------------
 *     the directory as a whole                  643 MB
 *
 * A recursive scan would walk twelve times the bytes it wanted, and every one
 * of those extra files belongs to a different feature: the spec rules lane
 * activity OUT of this archive and into the audit stream, on the measurement
 * that a lane's work appears in none of the records this index counts.
 *
 * Never throws. A directory that does not exist is an archive with nothing in
 * it — a project whose transcripts were pruned, or a cwd the harness has never
 * opened — and the caller is given the empty list plus the path it looked in,
 * so "nothing here" can be told from "looked in the wrong place".
 */
export function listTranscriptFiles(dir: string): TranscriptFile[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const found: TranscriptFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const file = path.join(dir, name);
    try {
      const stat = statSync(file);
      if (!stat.isFile()) continue;
      found.push({
        sessionId: name.slice(0, -'.jsonl'.length),
        file,
        bytes: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
      });
    } catch {
      // Vanished between the listing and the stat, or unreadable. A file we
      // cannot stat is a file we cannot index; it is simply not here, and the
      // next rebuild will find it if it comes back.
      continue;
    }
  }
  return found.sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1));
}

/**
 * The title a session already has, taken from the harness's own record —
 * `<session>/custom-title.json` if the user renamed it, else the last
 * `ai-title` record in the transcript.
 *
 * **The override the spec asked for already exists on disk**, which is worth
 * stating because it is what makes "overridable" compatible with a read-only
 * viewer. Measured 2026-09-07: `595db3b1-…/custom-title.json` holds
 * `{"customTitle":"MyContext V2.0"}`. So a session worth naming can be named,
 * by the rename the harness already offers, and this index reads the result
 * rather than needing a write of its own.
 *
 * `null` when nothing named it. **Never the first prompt** — the spec
 * considered and rejected that, because first prompts are routinely "continue"
 * or "ok go ahead", which names nothing. A row with no title says so and the
 * screen draws the date; a fabricated title would be worse than none.
 */
function customTitleOf(dir: string, sessionId: string): string | null {
  try {
    const raw = readFileSync(path.join(dir, sessionId, 'custom-title.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = (parsed as { customTitle?: unknown }).customTitle;
    return typeof value === 'string' && value !== '' ? value : null;
  } catch {
    return null;
  }
}

/** What one transcript scan learned. Every field is derived; none is assumed. */
export interface ScanResult {
  scannedBytes: number;
  startedAt: string | null;
  endedAt: string | null;
  prompts: number;
  answers: number;
  machinery: number;
  records: number;
  unreadable: number;
  branch: string | null;
  cwd: string | null;
  /** The last `ai-title` seen, or `null`. Not the first — see below. */
  aiTitle: string | null;
}

/**
 * Which of the three a `user`/`assistant` record is — and **the place the
 * spec's one factual claim turned out to be wrong.**
 *
 * The design says: *"`message.role` already separates prompts from answers.
 * The distinguishing mark the owner asked for is a field, not something to
 * invent."* The first half is true and the conclusion is not. `role`
 * separates the two SIDES of the exchange; it does not separate a turn a
 * person took from machinery filed under their side of it.
 *
 * **Measured across the whole 52 MB transcript, 2026-09-07:**
 *
 *     user records         445 whose content is a plain string   → a typed prompt
 *                            5 an array carrying a `text` block  → a prompt with attachments
 *                        2,504 an array of `tool_result` ONLY    → machinery
 *     assistant records  1,668 carrying a `text` block           → an answer in words
 *                        2,501 `tool_use` with no text           → machinery
 *                        1,548 `thinking` with no text           → machinery
 *
 * So `role`-counting reports **2,933 prompts and 5,687 answers** for a session
 * in which a person typed **450** things and the model replied in words
 * **1,668** times — wrong by six and a half times, in the most prominent
 * column the list screen has. A tool result is not something anybody said.
 *
 * The classification is therefore on the CONTENT, and `machinery` is counted
 * rather than dropped so `prompts + answers + machinery` accounts for every
 * conversational record: the two headline numbers can be checked against the
 * total instead of being believed (`INV-nothing-is-dropped-silently`).
 *
 * Block types are read by name and anything unrecognised falls to machinery,
 * which is the safe direction: a future block type is under-counted as
 * machinery and visible in that column, rather than inflating a headline.
 */
export function classifyTurn(type: unknown, content: unknown): 'prompt' | 'answer' | 'machinery' {
  const hasText = Array.isArray(content)
    && content.some((block) =>
      typeof block === 'object' && block !== null
      && (block as { type?: unknown }).type === 'text');
  if (type === 'user') {
    // A string is what the harness writes for a prompt with nothing attached;
    // an array with a `text` block is the same prompt carrying files.
    return typeof content === 'string' || hasText ? 'prompt' : 'machinery';
  }
  if (type === 'assistant') return hasText ? 'answer' : 'machinery';
  return 'machinery';
}

/**
 * One record of a transcript, as the walk yields it — the SEAM that
 * `core/session-summary.ts` reported as missing and could not add from where
 * it sits.
 *
 * Its header says it plainly: *"What is NOT shared is the walk itself, and
 * that is a real defect rather than a choice: `scanTranscript` consumes
 * records and returns only counts, and `readWindow` (`ui/read-model-
 * conversations.ts`) is private to the UI read model … Neither exposes a seam
 * that yields records. The repair is one record-iterator in
 * `conversation-index.ts` that all three consume; it belongs to the lane that
 * owns that file."* This is that repair, and `scanTranscript` below is now a
 * CONSUMER of it rather than a second walk of its own.
 *
 * ── `byteOffset` IS WHY THIS EXISTS, NOT ONLY WHY IT IS TIDY ───────────────
 *
 * `readWindow` (`ui/read-model-conversations.ts`) states the cost it accepted:
 * *"The walk is from the start every time … JSONL records are variable-length,
 * so there is no offset to seek to."* That is true of a reader who has never
 * walked the file and false of one who has. A document outline walks it ONCE
 * and remembers where each node began; every later window then costs the
 * window instead of the file — on the owner's own transcript, 61 MB read once
 * rather than 61 MB read per scroll. That is the whole of what makes a
 * virtualised scroll over 27,686 records possible.
 *
 * So the walk is over BYTES and not over a decoded string. Splitting a decoded
 * chunk on `'\n'` loses byte positions the moment a record carries a
 * non-ASCII character, and this project's own corpus is half Hebrew: every
 * offset after the first such record would be wrong, and wrong SILENTLY,
 * because a wrong offset lands mid-record and reports `unreadable` rather than
 * throwing. The newline is therefore found in the Buffer, and each line is
 * decoded on its own.
 */
export interface TranscriptRecord {
  /** 0-based position in the file — the index every surface counts in. */
  index: number;
  /** Where this line's first byte sits in the file. A seek target. */
  byteOffset: number;
  /** The line's length in bytes, not counting the newline that ended it. */
  byteLength: number;
  /**
   * The parsed object, or `null` when the line would not parse OR parsed to
   * something that is not a plain object.
   *
   * `null` for both is deliberate and carries `scanTranscript`'s own rule:
   * `typeof [] === 'object'` and `[] !== null`, so a line holding a JSON array
   * passes a naive check and then reads every field as `undefined` — a record
   * counted as understood and contributing nothing, which is the silent drop
   * rather than the disclosed one.
   */
  record: Record<string, unknown> | null;
}

/**
 * How far the walk got, mutated as it goes so a caller reading the last record
 * already knows whether there was more.
 *
 * A consumer that stops early leaves these at the point it stopped, which is
 * the honest answer: `reachedEnd` false with `scannedBytes` below the cap
 * means the CONSUMER stopped, not the file.
 */
export interface TranscriptCursor {
  /** Bytes read from the file so far. */
  scannedBytes: number;
  /** The read saw end-of-file rather than stopping at `cap`. */
  reachedEnd: boolean;
  /** Lines that would not parse. Counted, never thrown and never skipped. */
  unreadable: number;
}

export interface TranscriptWalkOptions {
  /** Stop after this many bytes. Default `MAX_SCAN_BYTES`. */
  cap?: number;
  /**
   * Start reading here instead of at byte 0.
   *
   * **It must be the first byte of a line**, which in practice means an offset
   * this same walk produced. A caller that passes an offset landing inside a
   * record gets one `unreadable` and then correct records after the next
   * newline — visibly wrong rather than quietly shifted.
   */
  startByte?: number;
  /** What `index` the record at `startByte` carries. Default 0. */
  startIndex?: number;
  /** Mutated as the walk proceeds. Pass one in to read it afterwards. */
  cursor?: TranscriptCursor;
}

/** Read granularity for the walk. Bounds memory, never the read. */
const WALK_CHUNK_BYTES = 1024 * 1024;

/**
 * Walk a transcript line by line, in bounded chunks, yielding every record
 * with the byte offset it lives at.
 *
 * **Errors are states, never throws.** A file that will not open yields
 * nothing and leaves the cursor at zero — the answer `scanTranscript` already
 * gave, because a rebuild that aborted on one bad file would lose the whole
 * archive to it. A read that fails part-way keeps everything already yielded
 * and stops.
 *
 * The descriptor is closed in a `finally`, so a consumer that `break`s out of
 * the `for…of` closes the file: a generator runs its `finally` on `.return()`.
 */
export function* iterateTranscript(
  file: string, options: TranscriptWalkOptions = {},
): Generator<TranscriptRecord> {
  const cap = options.cap ?? MAX_SCAN_BYTES;
  const cursor = options.cursor ?? { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  let index = options.startIndex ?? 0;
  let position = options.startByte ?? 0;

  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return;
  }

  const buffer = Buffer.alloc(WALK_CHUNK_BYTES);
  /** Bytes of a line the last chunk ended in the middle of. */
  let carry: Buffer | null = null;
  /** Where that partial line began in the file. */
  let carryAt = 0;

  const parse = (bytes: Buffer, at: number): TranscriptRecord => {
    let record: unknown;
    try {
      record = JSON.parse(bytes.toString('utf8'));
    } catch {
      cursor.unreadable += 1;
      return { index: index++, byteOffset: at, byteLength: bytes.length, record: null };
    }
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      cursor.unreadable += 1;
      return { index: index++, byteOffset: at, byteLength: bytes.length, record: null };
    }
    return {
      index: index++, byteOffset: at, byteLength: bytes.length,
      record: record as Record<string, unknown>,
    };
  };

  try {
    while (cursor.scannedBytes < cap) {
      const want = Math.min(WALK_CHUNK_BYTES, cap - cursor.scannedBytes);
      const read = readSync(fd, buffer, 0, want, position);
      if (read <= 0) { cursor.reachedEnd = true; break; }
      const chunkAt = position;
      position += read;
      cursor.scannedBytes += read;

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
        // An empty line is not a record. `scanTranscript` skipped one and so
        // does this, so the index a record carries is unchanged by the blank
        // line a transcript may end with.
        if (bytes.length > 0) yield parse(bytes, at);
      }
      if (from < read) {
        const rest = view.subarray(from, read);
        if (carry === null) { carryAt = chunkAt + from; carry = Buffer.from(rest); }
        else carry = Buffer.concat([carry, rest]);
      }
    }
    // The trailing fragment is a whole line only when the read reached the end
    // of the file. If the cap stopped us it is a record cut in half, and
    // parsing it would turn the bound into a phantom `unreadable`.
    if (cursor.reachedEnd && carry !== null && carry.length > 0) yield parse(carry, carryAt);
  } catch {
    // A read that failed part-way keeps what it yielded. `scannedBytes` says
    // how far it got.
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }
}

/**
 * Read one transcript and count what the index holds, synchronously and in
 * bounded chunks.
 *
 * **Synchronous on purpose.** `CommandFn` returns a number, not a promise, and
 * every store in this project is `node:sqlite`'s synchronous one; an async
 * scanner would make the one command that fills this index the only async
 * command in the CLI. Measured 2026-09-07 the sync chunked read costs 376 ms
 * on the 52 MB transcript against 909 ms for a `createReadStream` — it is
 * both simpler and faster here.
 *
 * ── THE TOLERANCE RULES, WHICH ARE THE HARNESS'S SCHEMA BEING SOMEONE
 *    ELSE'S ────────────────────────────────────────────────────────────────
 *
 * The transcript schema belongs to Claude Code and can change without notice,
 * so this reader never assumes a key it has not checked for:
 *
 *   - a line that is not valid JSON costs ONE `unreadable`, never its
 *     neighbours and never a throw;
 *   - a record whose `type` this build does not know is counted in `records`
 *     and otherwise ignored — an unknown type is not an error;
 *   - `prompts` counts `type === 'user'` records carrying `message.role ===
 *     'user'`, which is the field the spec identified and not a guess. The
 *     role is CHECKED rather than inferred from the type, because the two
 *     disagree: measured on this project's transcript, 22,605 records carry
 *     `type` values including `attachment`, `system`, `ai-title`,
 *     `file-history-snapshot`, `queue-operation` and five more this build had
 *     never heard of when it was written.
 *
 * ── WHY THE LAST `ai-title` AND NOT THE FIRST ──────────────────────────────
 *
 * Measured: the 52 MB transcript carries 957 `ai-title` records, not one. The
 * model renames a session as it learns what the session is about, so the first
 * is the earliest guess and the last is the current name. Taking the first
 * would show every session under the title it had in its opening minute.
 *
 * ── THE CAP, AND WHAT IT COSTS ─────────────────────────────────────────────
 *
 * The read stops at `MAX_SCAN_BYTES`. `scannedBytes` is returned so the caller
 * can see it stopped: when it is less than the file's size, every count here
 * is a floor and `ended_at` is not the end of the conversation. Nothing is
 * dropped silently — it is dropped and said.
 *
 * ── `startByte`, AND WHY A PARTIAL SCAN IS THE SAME FUNCTION ───────────────
 *
 * A transcript ONLY EVER APPENDS, so a session already indexed at N bytes and
 * now at N+M needs the M read and nothing else. `startByte` is that, and every
 * field it returns is then a DELTA over the range read rather than a total:
 * `records`, `prompts`, `answers`, `machinery` and `unreadable` are added to
 * the row's; `endedAt`, `branch`, `cwd` and `aiTitle` are last-writer-wins and
 * overwrite it when the tail carried one. `mergeScan` below owns that
 * arithmetic so no caller re-derives it.
 *
 * `scannedBytes` is bytes READ, not the position reached, so a caller resuming
 * at `startByte` adds the two to get the file position — which is exactly what
 * `rebuildConversations` does, and the reason the cap it passes for a tail is
 * `cap - startByte` rather than `cap`.
 *
 * **It must be the first byte of a line**, and the caller is the one that has
 * to know: `iterateTranscript` documents that an offset landing inside a
 * record costs one `unreadable` and then reads correctly. `lineStartsAt` below
 * is how `rebuildConversations` establishes it, from one byte of the file.
 */
export function scanTranscript(
  file: string, cap: number = MAX_SCAN_BYTES, startByte = 0,
): ScanResult {
  const result: ScanResult = {
    scannedBytes: 0,
    startedAt: null,
    endedAt: null,
    prompts: 0,
    answers: 0,
    machinery: 0,
    records: 0,
    unreadable: 0,
    branch: null,
    cwd: null,
    aiTitle: null,
  };

  // The cursor is READ AFTERWARDS rather than accumulated here, so this
  // function has no opinion about bytes at all — the walk owns that, and a
  // second opinion about how far a read got is exactly the drift the shared
  // iterator exists to prevent.
  const cursor: TranscriptCursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };

  for (const step of iterateTranscript(file, { cap, cursor, startByte })) {
    // `null` is a line that would not parse or parsed to a non-object. The
    // cursor has already counted it; counting it twice here is the bug this
    // shape removes.
    if (step.record === null) continue;
    const row = step.record as {
      type?: unknown; timestamp?: unknown; gitBranch?: unknown; cwd?: unknown;
      aiTitle?: unknown; message?: unknown;
    };
    result.records += 1;

    if (typeof row.timestamp === 'string') {
      if (result.startedAt === null) result.startedAt = row.timestamp;
      result.endedAt = row.timestamp;
    }
    // Last writer wins: a session that changes branch mid-run is filed under
    // the branch it ended on, which is the one a reader looking for the work
    // remembers. Recorded here because it is a choice, not a fallout.
    if (typeof row.gitBranch === 'string' && row.gitBranch !== '') result.branch = row.gitBranch;
    if (typeof row.cwd === 'string' && row.cwd !== '') result.cwd = row.cwd;
    if (row.type === 'ai-title' && typeof row.aiTitle === 'string' && row.aiTitle !== '') {
      result.aiTitle = row.aiTitle;
    }

    // The turn, classified on its CONTENT rather than on `message.role` — see
    // `classifyTurn` for the measurement that made the difference matter.
    const message = row.message;
    if (typeof message === 'object' && message !== null) {
      const content = (message as { content?: unknown }).content;
      const turn = classifyTurn(row.type, content);
      if (turn === 'prompt') result.prompts += 1;
      else if (turn === 'answer') result.answers += 1;
      else if (row.type === 'user' || row.type === 'assistant') result.machinery += 1;
    }
  }

  result.scannedBytes = cursor.scannedBytes;
  result.unreadable = cursor.unreadable;
  return result;
}

/** The read-only handle plus the tables. `open` writes; `openReadOnlyChecked` cannot. */
export class ConversationIndex {
  #db: DatabaseSync;
  #closed = false;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * **A WRITE.** Creates the tables if they are not there, exactly as
   * `Ledger.open` does, which is why nothing under `src/ui/` may call it and
   * why `mycontext conversation rebuild` exists.
   */
  static open(dbPath: string, busyTimeoutMs = 3000): ConversationIndex {
    const db = new DatabaseSync(dbPath);
    try {
      db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs};`);
      db.exec(CONVERSATION_SCHEMA);
      return new ConversationIndex(db);
    } catch (error) {
      try { db.close(); } catch { /* nothing usable to close */ }
      throw error;
    }
  }

  /**
   * The read door. Creates nothing, migrates nothing, repairs nothing.
   *
   * Every check runs on the `DatabaseSync` before the wrapper exists, and the
   * handle is closed before any throw escapes — the Windows reason
   * `Ledger.openReadOnlyChecked` gives for doing it that way: an open handle
   * PINS the file, so a leaked one blocks the writer that would replace it.
   *
   * There is deliberately no unchecked `openReadOnly` beside this. Nothing
   * needs one, and an exported door that skips the check is a hole in an API
   * whose entire purpose is that it cannot write.
   */
  static openReadOnlyChecked(dbPath: string): ConversationIndex {
    // **Absence is checked BEFORE the open, not caught after it**, which is
    // `openProjectionReadOnlyChecked`'s rule (`core/audit-db.ts`) and it is
    // there for a reason worth repeating: opening a missing file raises
    // `SQLITE_CANTOPEN`, and so does a permission failure. Catching the error
    // and calling it "nothing has been scanned" would report an unreadable
    // database as an empty archive.
    //
    // A workspace reaches this the moment it is created: `mycontext init`
    // writes no `.index.db`, so a fresh corpus has no file at all until the
    // first `Store.open`. Measured on a real `mycontext init`, 2026-09-07 —
    // `conversation list` answered `unable to open database file`, a SQLite
    // sentence with nothing in it a reader could act on.
    try {
      statSync(dbPath);
    } catch {
      throw new ConversationIndexUninitializedError(
        `my_context: ${dbPath} does not exist — nothing has been indexed in this corpus at ` +
        'all. It is created by a write, and a read-only caller never creates it. This is an ' +
        'empty state, not a damaged database.',
      );
    }
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      // Positive evidence that this is a database, before "no tables" is
      // allowed to mean "nothing has been indexed". A zero-length file is a
      // VALID empty SQLite database — it opens and `sqlite_master` is simply
      // empty — so absence of tables alone cannot tell a prepared corpus from
      // a file truncated to nothing, and reporting damage as an empty archive
      // is the failure this door exists to avoid.
      const pages = db.prepare('PRAGMA page_count').get() as { page_count?: number } | undefined;
      if (pages === undefined || Number(pages.page_count) === 0) {
        throw new Error(
          `my_context: ${dbPath} holds no database pages at all — an empty or truncated file, ` +
          'not a corpus whose conversation index is empty. A read-only caller never repairs it.',
        );
      }

      const present: string[] = [];
      const missing: string[] = [];
      for (const [table] of CONVERSATION_TABLE_COLUMNS) {
        const row = db.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ).get(table) as { name: string } | undefined;
        (row === undefined ? missing : present).push(table);
      }
      if (present.length === 0) {
        throw new ConversationIndexUninitializedError(
          `my_context: ${dbPath} has no conversation index yet — no transcript has been ` +
          'scanned in this corpus. The table is created by `mycontext conversation rebuild`, ' +
          'which is a write, and a read-only caller never creates it. This is an empty state, ' +
          'not a damaged database.',
        );
      }
      if (missing.length > 0) {
        throw new Error(
          `my_context: ${dbPath} has ${present.join(', ')} but not ${missing.join(', ')}. ` +
          'Half an index is damage, not the not-yet-scanned empty state, and this open refuses ' +
          'to report it as one.',
        );
      }

      for (const [table, columns] of CONVERSATION_TABLE_COLUMNS) {
        const actual = (db.prepare('SELECT name FROM pragma_table_info(?)').all(table) as
          { name: string }[]).map((r) => r.name).sort().join(', ');
        const expected = [...columns].sort().join(', ');
        if (actual !== expected) {
          throw new Error(
            `my_context: ${dbPath} declares ${table}(${actual}) where this build reads ` +
            `${table}(${expected}). The conversation tables carry no schema_version, so their ` +
            'shape is the only version there is, and a read-only caller never migrates.',
          );
        }
      }

      return new ConversationIndex(db);
    } catch (error) {
      try { db.close(); } catch { /* nothing usable to close */ }
      throw error;
    }
  }

  /** Replace one session's row wholesale. A scan is a fact about a file at a time. */
  upsert(row: ConversationRow): void {
    this.#db.prepare(
      `INSERT INTO conversations (
         session_id, source, file, bytes, mtime_ms, scanned_bytes, started_at, ended_at,
         prompts, answers, machinery, records, unreadable, branch, cwd, title, title_source,
         scanned_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(session_id) DO UPDATE SET
         source = excluded.source, file = excluded.file, bytes = excluded.bytes,
         mtime_ms = excluded.mtime_ms, scanned_bytes = excluded.scanned_bytes,
         started_at = excluded.started_at, ended_at = excluded.ended_at,
         prompts = excluded.prompts, answers = excluded.answers,
         machinery = excluded.machinery, records = excluded.records,
         unreadable = excluded.unreadable, branch = excluded.branch, cwd = excluded.cwd,
         title = excluded.title, title_source = excluded.title_source,
         scanned_at = excluded.scanned_at`,
    ).run(
      row.sessionId, row.source, row.file, row.bytes, row.mtimeMs, row.scannedBytes,
      row.startedAt, row.endedAt, row.prompts, row.answers, row.machinery, row.records,
      row.unreadable, row.branch, row.cwd, row.title, row.titleSource, row.scannedAt,
    );
  }

  /**
   * Every row, newest conversation first — the order the list wants and the
   * only order anything asks for, so it is taken here rather than re-sorted by
   * each caller. A row with no `ended_at` sorts last: it is a transcript that
   * carried no timestamp at all, which is a real state and not a zero date.
   */
  all(): ConversationRow[] {
    const rows = this.#db.prepare(
      'SELECT * FROM conversations ORDER BY ended_at DESC NULLS LAST, session_id ASC',
    ).all() as Record<string, unknown>[];
    return rows.map(toRow);
  }

  get(sessionId: string): ConversationRow | null {
    const row = this.#db.prepare(
      'SELECT * FROM conversations WHERE session_id = ?',
    ).get(sessionId) as Record<string, unknown> | undefined;
    return row === undefined ? null : toRow(row);
  }

  /** The `(bytes, mtime_ms)` freshness key for every indexed session. */
  fingerprints(): Map<string, { bytes: number; mtimeMs: number }> {
    const rows = this.#db.prepare(
      'SELECT session_id, bytes, mtime_ms FROM conversations',
    ).all() as { session_id: string; bytes: number; mtime_ms: number }[];
    return new Map(rows.map((r) => [r.session_id, { bytes: r.bytes, mtimeMs: r.mtime_ms }]));
  }

  /**
   * Drop the rows for sessions no longer on disk, and say how many.
   *
   * The count is returned rather than swallowed because a transcript the
   * harness pruned is knowledge leaving the archive: the spec names it as the
   * strongest argument for export, and a rebuild that quietly shrank would be
   * exactly the silent loss `INV-nothing-is-dropped-silently` forbids.
   */
  removeMissing(present: Set<string>): number {
    const known = (this.#db.prepare('SELECT session_id FROM conversations')
      .all() as { session_id: string }[]).map((r) => r.session_id);
    const gone = known.filter((id) => !present.has(id));
    const statement = this.#db.prepare('DELETE FROM conversations WHERE session_id = ?');
    for (const id of gone) statement.run(id);
    return gone.length;
  }

  transaction<T>(fn: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.#db.exec('COMMIT');
      return value;
    } catch (error) {
      try { this.#db.exec('ROLLBACK'); } catch { /* the commit already failed */ }
      throw error;
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#db.close();
  }
}

function toRow(row: Record<string, unknown>): ConversationRow {
  const text = (key: string): string | null => {
    const value = row[key];
    return typeof value === 'string' ? value : null;
  };
  const count = (key: string): number => Number(row[key] ?? 0);
  return {
    sessionId: String(row['session_id'] ?? ''),
    source: String(row['source'] ?? 'live'),
    file: String(row['file'] ?? ''),
    bytes: count('bytes'),
    mtimeMs: count('mtime_ms'),
    scannedBytes: count('scanned_bytes'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    prompts: count('prompts'),
    answers: count('answers'),
    machinery: count('machinery'),
    records: count('records'),
    unreadable: count('unreadable'),
    branch: text('branch'),
    cwd: text('cwd'),
    title: text('title'),
    titleSource: text('title_source'),
    scannedAt: String(row['scanned_at'] ?? ''),
  };
}

/**
 * **Is `at` the first byte of a line?** One byte of the file answers it.
 *
 * This is the guard that makes an append-only resume safe rather than
 * plausible. `row.bytes` is the size the transcript had when it was indexed,
 * and it is a line boundary WHENEVER the last thing the scan saw was a
 * complete record — which is the ordinary case, because the harness writes a
 * JSON object and a newline per record. It is NOT a line boundary when the
 * scan caught the file between the object and its newline, and resuming there
 * would append a second copy of a record the row already counted, silently and
 * forever: every later refresh would resume past it too.
 *
 * So it is CHECKED, from `at - 1`, and a `false` sends the file down the full
 * re-read path rather than down a cheaper wrong one. Measured on the owner's
 * own 65 MB transcript, 2026-09-08: the byte at `row.bytes - 1` is `0x0a`, and
 * the tail scan from there composed exactly — 23,650 + 4,733 records against
 * 28,383 from a full read, and 460 + 96 prompts against 556.
 *
 * A file that will not open is `false`: not a boundary anyone can vouch for,
 * and the full path reports the failure the way it always has.
 */
function lineStartsAt(file: string, at: number): boolean {
  if (at === 0) return true;
  if (at < 0) return false;
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return false;
  }
  try {
    const byte = Buffer.alloc(1);
    return readSync(fd, byte, 0, 1, at - 1) === 1 && byte[0] === 0x0a;
  } catch {
    return false;
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }
}

/**
 * A row and the tail read since it was written, combined into the row the
 * session now deserves.
 *
 * **The arithmetic lives here and nowhere else**, because it is not uniform
 * and a caller improvising it would get one of the two kinds wrong:
 *
 *   - the COUNTS are cumulative, so they add. `prompts + answers + machinery`
 *     accounts for every conversational record in the whole file only if the
 *     tail's contribution is added to the row's rather than replacing it.
 *   - `endedAt`, `branch` and `cwd` are LAST-WRITER-WINS in `scanTranscript`,
 *     which over a tail means the tail wins whenever it saw one — and the row
 *     keeps its value when the tail carried none, which is what a tail of pure
 *     machinery with no timestamp looks like.
 *   - `startedAt` is FIRST-writer-wins and therefore never moves, unless the
 *     row never had one at all.
 *
 * `aiTitle` follows `endedAt`: the last `ai-title` in the file is the current
 * name, and if the tail carried one it is more recent than the row's by
 * construction.
 */
function mergeScan(previous: ConversationRow, tail: ScanResult): ScanResult {
  return {
    scannedBytes: previous.scannedBytes + tail.scannedBytes,
    startedAt: previous.startedAt ?? tail.startedAt,
    endedAt: tail.endedAt ?? previous.endedAt,
    prompts: previous.prompts + tail.prompts,
    answers: previous.answers + tail.answers,
    machinery: previous.machinery + tail.machinery,
    records: previous.records + tail.records,
    unreadable: previous.unreadable + tail.unreadable,
    branch: tail.branch ?? previous.branch,
    cwd: tail.cwd ?? previous.cwd,
    aiTitle: tail.aiTitle ?? (previous.titleSource === 'ai' ? previous.title : null),
  };
}

/** What one rebuild did, in the numbers a caller has to be able to print. */
export interface RebuildReport {
  /** The directory the transcripts were looked for in — named even when empty. */
  dir: string;
  /** Transcripts found on disk. */
  found: number;
  /** Transcripts read WHOLE this run. */
  scanned: number;
  /**
   * Transcripts brought up to date by reading only the bytes appended since
   * they were last indexed — the cheap path, and the one that makes a refresh
   * affordable often enough to be automatic.
   */
  appended: number;
  /** Transcripts skipped because size and mtime matched the indexed row. */
  skipped: number;
  /** Rows dropped because their transcript is gone from disk. */
  removed: number;
  /** Sessions whose scan hit `MAX_SCAN_BYTES`; their counts are floors. */
  truncated: string[];
  /** Bytes actually read this run. */
  bytesRead: number;
  /** How long the scan took, so a slow archive is visible rather than felt. */
  ms: number;
}

/**
 * Rebuild the index from disk — the property the item asks for, and the reason
 * losing this index costs time and never knowledge.
 *
 * `full: true` re-reads every transcript. The default re-reads only those whose
 * size or mtime differs from the indexed row, which is what makes a re-scan one
 * `stat` per unchanged file. Both forms end at the same rows; the difference is
 * only how much work is repeated, so the cheap one is the default and the
 * expensive one is available when the reader wants the guarantee rather than
 * the inference.
 *
 * ── THE THIRD PATH, AND WHY IT HAD TO EXIST ────────────────────────────────
 *
 * There were two paths and they were the wrong two. An unchanged file cost one
 * `stat`; a file that had grown by one line cost the WHOLE FILE. On the live
 * session that is 65 MB re-read to learn about a few kilobytes, which is why
 * this ran only when somebody typed the command — and, measured 2026-09-08,
 * why nobody had typed it for over a day while the owner read the screen it
 * fills. **The staleness was a consequence of the cost.**
 *
 * A transcript ONLY EVER APPENDS, so the third path reads the tail and adds
 * it. Measured on the owner's own transcript, 2026-09-08, catching up a gap of
 * 11,231,042 bytes:
 *
 *     full re-read   65,046,326 bytes   168 ms
 *     tail re-read   11,231,042 bytes    26 ms      6.5x
 *     `stat` alone            0 bytes  0.449 ms     both files
 *
 * and per turn, which is the interval it actually runs at, the tail is a few
 * kilobytes and the whole refresh is closer to the `stat` than to either.
 *
 * The composed row is IDENTICAL to the one a full read produces — 23,650 +
 * 4,733 records against 28,383, 460 + 96 prompts against 556 — and
 * `test/core/conversation-refresh.test.ts` asserts that equality against a
 * `--full` rebuild rather than against remembered numbers, so a divergence in
 * either path fails rather than being believed.
 */
export function rebuildConversations(
  dbPath: string,
  env: Record<string, string | undefined>,
  cwd: string,
  options: { full?: boolean; cap?: number; busyTimeoutMs?: number } = {},
): RebuildReport {
  const startedMs = Date.now();
  const dir = transcriptDir(env, cwd);
  const files = listTranscriptFiles(dir);
  const cap = options.cap ?? MAX_SCAN_BYTES;

  // `busyTimeoutMs` is the caller's, because the two callers have opposite
  // deadlines. A person at a terminal would rather wait three seconds than be
  // told to try again; a `Stop` hook is inside a timeout the platform enforces
  // and would rather give up on this turn and succeed on the next, which is a
  // choice an append-only refresh can afford and a one-shot command cannot.
  const index = options.busyTimeoutMs === undefined
    ? ConversationIndex.open(dbPath)
    : ConversationIndex.open(dbPath, options.busyTimeoutMs);
  try {
    const known = index.fingerprints();
    const report: RebuildReport = {
      dir,
      found: files.length,
      scanned: 0,
      appended: 0,
      skipped: 0,
      removed: 0,
      truncated: [],
      bytesRead: 0,
      ms: 0,
    };

    // One transaction for the whole run, for `rebuild.ts`'s measured reason:
    // per-statement WAL flushes dominate a batch of small writes.
    index.transaction(() => {
      for (const file of files) {
        const fingerprint = known.get(file.sessionId);
        if (
          options.full !== true && fingerprint !== undefined
          && fingerprint.bytes === file.bytes && fingerprint.mtimeMs === file.mtimeMs
        ) {
          report.skipped += 1;
          continue;
        }

        // ── THE APPEND-ONLY PATH ──────────────────────────────────────────
        //
        // Five conditions, and every one of them is a way the cheap read
        // could be WRONG rather than merely a way it could be skipped:
        //
        //   1. `--full` was not asked for. It is the escape hatch that buys
        //      the guarantee back, and it must reach a whole re-read.
        //   2. the row exists and its scan was COMPLETE (`scannedBytes ===
        //      bytes`). A row capped at `MAX_SCAN_BYTES` stopped in the
        //      middle of the file, so there is no "rest" to resume from —
        //      only the part it never reached, and that starts before
        //      `bytes`, not at it.
        //   3. the file GREW. Equal size with a different mtime is a file
        //      rewritten in place, and a smaller one is a file replaced;
        //      neither is an append and appending to either would carry
        //      counts forward from a transcript that no longer exists.
        //   4. `bytes` is a line boundary — `lineStartsAt` argues it.
        //   5. the row is not one whose `ai-title` a CUSTOM title has hidden
        //      while that custom title has since been removed. The row stores
        //      one title, so a row reading `title_source = 'custom'` has
        //      forgotten the `ai-title` the file may still carry — and a tail
        //      that saw no `ai-title` of its own cannot recover it, while a
        //      whole re-read finds it wherever it sits. Without this the two
        //      paths would DISAGREE, and disagree only in the one case nobody
        //      would think to look at: a session renamed by hand and then
        //      un-renamed.
        //
        // Anything else falls to the whole re-read below, which is the
        // behaviour this command has always had. The cheap path is an
        // OPTIMISATION that can decline; it is never the only way to a row.
        //
        // The custom title is therefore read BEFORE the path is chosen, which
        // costs one `readFileSync` of a tiny JSON file that both paths needed
        // anyway.
        const custom = customTitleOf(dir, file.sessionId);
        const previous = fingerprint === undefined || options.full === true
          ? null
          : index.get(file.sessionId);
        const appendable = previous !== null
          && previous.scannedBytes === previous.bytes
          && file.bytes > previous.bytes
          && previous.bytes < cap
          && !(previous.titleSource === 'custom' && custom === null)
          && lineStartsAt(file.file, previous.bytes);

        const tail = appendable && previous !== null
          ? scanTranscript(file.file, cap - previous.bytes, previous.bytes)
          : null;
        const scan = tail !== null && previous !== null
          ? mergeScan(previous, tail)
          : scanTranscript(file.file, cap);

        index.upsert({
          sessionId: file.sessionId,
          source: 'live',
          file: file.file,
          bytes: file.bytes,
          mtimeMs: file.mtimeMs,
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
          title: custom ?? scan.aiTitle,
          titleSource: custom !== null ? 'custom' : (scan.aiTitle !== null ? 'ai' : null),
          scannedAt: new Date().toISOString(),
        });
        if (tail !== null) {
          report.appended += 1;
          // Bytes THIS RUN read, not bytes the row now accounts for. A
          // refresh that reported 65 MB for reading 11 MB would hide exactly
          // the saving it exists to make.
          report.bytesRead += tail.scannedBytes;
        } else {
          report.scanned += 1;
          report.bytesRead += scan.scannedBytes;
        }
        if (scan.scannedBytes < file.bytes) report.truncated.push(file.sessionId);
      }
      report.removed = index.removeMissing(new Set(files.map((f) => f.sessionId)));
    });

    report.ms = Date.now() - startedMs;
    return report;
  } finally {
    index.close();
  }
}
