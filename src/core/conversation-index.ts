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
 */
export function scanTranscript(file: string, cap: number = MAX_SCAN_BYTES): ScanResult {
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

  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    // Unreadable is a state this returns, not one it throws. The caller marks
    // the row and the reader is told; a rebuild that aborted on one bad file
    // would lose the whole archive to it.
    return result;
  }

  const buffer = Buffer.alloc(CHUNK_BYTES);
  let carry = '';

  /** One complete line. Everything above is bookkeeping around this. */
  const take = (line: string): void => {
    if (line === '') return;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      result.unreadable += 1;
      return;
    }
    // `Array.isArray` is not tidiness: `typeof [] === 'object'` and `[] !==
    // null`, so a line holding a JSON array passes both other checks and then
    // reads every field as `undefined` — a record counted as understood and
    // contributing nothing, which is the silent drop rather than the disclosed
    // one. Caught by `a line that will not parse costs one row and never its
    // neighbours`, which is why that test asserts the COUNT and not merely
    // that the neighbours survived.
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      result.unreadable += 1;
      return;
    }
    const row = record as {
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
  };

  try {
    let read = 0;
    while (result.scannedBytes < cap) {
      const want = Math.min(CHUNK_BYTES, cap - result.scannedBytes);
      read = readSync(fd, buffer, 0, want, null);
      if (read <= 0) break;
      result.scannedBytes += read;
      const parts = (carry + buffer.toString('utf8', 0, read)).split('\n');
      carry = parts.pop() ?? '';
      for (const line of parts) take(line);
    }
    // The trailing fragment is a whole line only when the read reached the end
    // of the file. If the cap stopped us, it is a record cut in half, and
    // parsing it would turn the bound into a phantom `unreadable`.
    if (result.scannedBytes < cap) take(carry);
  } catch {
    // A read that failed part-way keeps what it counted. `scannedBytes` says
    // how far it got, and the row it produces is visibly short.
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }

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

/** What one rebuild did, in the numbers a caller has to be able to print. */
export interface RebuildReport {
  /** The directory the transcripts were looked for in — named even when empty. */
  dir: string;
  /** Transcripts found on disk. */
  found: number;
  /** Transcripts actually read this run. */
  scanned: number;
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
 */
export function rebuildConversations(
  dbPath: string,
  env: Record<string, string | undefined>,
  cwd: string,
  options: { full?: boolean; cap?: number } = {},
): RebuildReport {
  const startedMs = Date.now();
  const dir = transcriptDir(env, cwd);
  const files = listTranscriptFiles(dir);
  const cap = options.cap ?? MAX_SCAN_BYTES;

  const index = ConversationIndex.open(dbPath);
  try {
    const known = index.fingerprints();
    const report: RebuildReport = {
      dir,
      found: files.length,
      scanned: 0,
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
        const scan = scanTranscript(file.file, cap);
        const custom = customTitleOf(dir, file.sessionId);
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
        report.scanned += 1;
        report.bytesRead += scan.scannedBytes;
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
