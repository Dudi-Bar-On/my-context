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
  ['subagents', [
    'agent_id', 'session_id', 'parent_agent_id', 'tool_use_id', 'agent_type', 'description',
    'model', 'spawn_depth', 'is_fork', 'file', 'bytes', 'mtime_ms', 'scanned_bytes',
    'started_at', 'ended_at', 'prompts', 'answers', 'machinery', 'records', 'unreadable',
    'branch', 'cwd', 'scanned_at',
  ]],
  ['persisted', ['session_id', 'file', 'bytes', 'marked_at', 'mirrored_at', 'note']],
];

/**
 * `source` is a column rather than something inferred from a path, because the
 * owner asked for a live session and an exported copy to be distinguishable
 * wherever either appears, and a fact that important should not be re-derived
 * by every reader.
 *
 * **Three values, and they are three answers to ONE question** — which file
 * this row was read from, `plan:archive seq:4`/`seq:5`:
 *
 *   - `'live'`      the transcript the harness wrote, and nothing else.
 *   - `'persisted'` that same transcript, with a mirror kept beside it.
 *   - `'exported'`  the MIRROR. The original is gone and this copy is all
 *                   there is, which is the state the mark exists for.
 *
 * They are ordered by how much a reader can still check: `'live'` can be
 * verified against the harness's own file, `'persisted'` can, and `'exported'`
 * cannot, because the thing it would be checked against no longer exists. The
 * screen draws the last two apart for that reason rather than for tidiness.
 *
 * `scanned_bytes` beside `bytes` is the truncation disclosure in the row
 * itself: they are equal for a transcript read whole, and `scanned_bytes <
 * bytes` means the scan stopped at `MAX_SCAN_BYTES` and every count derived
 * from it is a floor rather than a total. A capped row and a complete one must
 * not look the same.
 *
 * `(bytes, mtime_ms)` is the freshness key, and the reason a re-scan is cheap:
 * a file whose size and mtime match its row is skipped after one `stat`.
 *
 * ── `subagents` IS A SECOND TABLE, AND THAT WAS DECIDED ON MEASUREMENT ─────
 *
 * `plan:archive seq:12` left the choice open — same list or its own — and
 * asked for it to be settled against what the harness actually records. It
 * was, on this workspace's own 253 subagent transcripts, 2026-09-08:
 *
 *   - **A subagent has no title and structurally cannot have one.** ZERO
 *     `ai-title` records across all 253 transcripts (99,760 records), and no
 *     `custom-title.json` anywhere under `subagents/`. `title` and
 *     `title_source` would be two columns that are always `NULL`, and the
 *     screen's "named by the model" state would be unreachable for every one
 *     of them. The name a subagent HAS is `description` — the one line the
 *     dispatcher typed — and it comes from a different file entirely.
 *   - **`session_id` would have to mean two different things.** In a subagent
 *     transcript the `sessionId` FIELD names the PARENT session, not the
 *     subagent: measured, 0 of 99,760 records carry any other value. So in one
 *     shared table the primary key would be the agent id while a column called
 *     `session_id` pointed at somebody else's row — a field whose meaning
 *     flips on a discriminator, which is the defect this repository spent
 *     2026-09-07 measuring in its own documents.
 *   - **`source` cannot be the discriminator.** It answers which FILE a row was
 *     read from — `'live'`, `'persisted'`, `'exported'` (`seq:4`/`seq:5`) —
 *     and spending that column on "is this a lane" would be a field whose
 *     meaning flips on what is being looked at, which is the defect the bullet
 *     above this one is about.
 *   - **The list is 2 sessions against 253 subagents**, and `all()` is capped
 *     at 200 rows. Merged, the two real conversations would sort below a
 *     hundred lanes and the archive screen would answer a question nobody
 *     asked.
 *
 * So they are separate tables with separate keys, and what joins them is
 * recorded rather than inferred — see `SubagentMeta`.
 *
 * There is deliberately no `source` column here. A second hard-coded `'live'`
 * would be a second copy of a discriminator that is already known not to work,
 * and step 5 can add the column when it has a second value to put in it.
 *
 * ── `persisted` IS THE STANDING MARK, AND IT IS NOT A SECOND `source` ──────
 *
 * `plan:archive seq:4`. The owner's ruling of 2026-09-07 re-cut that item from
 * a one-shot export into PERSISTENCE — a standing mark plus a mirror that
 * keeps up — on the reasoning that *"EVERY CHANGE IN A SESSION FILE SHOULD
 * ALSO BE WRITTEN TO ITS PERSISTENT EXTERNAL FILE IN ORDER NOT TO LOSE
 * CONTENT."*
 *
 * The mark is a row here and NOT a column on `conversations`, and the reason
 * is the one that keeps the two questions apart:
 *
 *   - `conversations.source` answers *which file this row was read from* —
 *     `'live'`, `'persisted'` or `'exported'`. It is the one discriminator,
 *     and `seq:5` spends the value that was reserved for it.
 *   - `persisted` answers *what the owner asked us to keep*, and it outlives
 *     the row: a session whose transcript the harness has pruned has no
 *     `conversations` row to hang a column on until the mirror is read back
 *     in, which is precisely the case the mark exists for. A column would be
 *     deleted by `removeMissing` at the one moment it matters.
 *
 * `bytes` is how much of the ORIGINAL the mirror already holds, and it is the
 * resume point: the mirror is byte-for-byte the first `bytes` bytes of the
 * transcript, always ending on a line boundary. `note` is `NULL` or the one
 * reason the mirror stopped keeping up, so a copy that is no longer current
 * says so rather than looking finished — `INV-nothing-is-dropped-silently`.
 *
 * There is deliberately no `from_byte`. It was designed, and then measured
 * away: a transcript only ever appends and the whole of it is on disk at the
 * moment the mark is taken, so `mycontext conversation persist` copies from
 * byte 0 and a mirror that begins late is not a state this build can reach.
 * A column that can only ever hold one value is the unreachable-state defect
 * `source` itself spent two items in.
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

CREATE TABLE IF NOT EXISTS subagents (
  agent_id        TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  parent_agent_id TEXT,
  tool_use_id     TEXT,
  agent_type      TEXT,
  description     TEXT,
  model           TEXT,
  spawn_depth     INTEGER NOT NULL,
  is_fork         INTEGER NOT NULL,
  file            TEXT NOT NULL,
  bytes           INTEGER NOT NULL,
  mtime_ms        INTEGER NOT NULL,
  scanned_bytes   INTEGER NOT NULL,
  started_at      TEXT,
  ended_at        TEXT,
  prompts         INTEGER NOT NULL,
  answers         INTEGER NOT NULL,
  machinery       INTEGER NOT NULL,
  records         INTEGER NOT NULL,
  unreadable      INTEGER NOT NULL,
  branch          TEXT,
  cwd             TEXT,
  scanned_at      TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_subagents_session ON subagents(session_id);
CREATE INDEX IF NOT EXISTS idx_subagents_tooluse ON subagents(tool_use_id);
CREATE INDEX IF NOT EXISTS idx_subagents_parent  ON subagents(parent_agent_id);

CREATE TABLE IF NOT EXISTS persisted (
  session_id  TEXT PRIMARY KEY,
  file        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  marked_at   TEXT NOT NULL,
  mirrored_at TEXT NOT NULL,
  note        TEXT
) WITHOUT ROWID;
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

/**
 * **The index was built by an OLDER BUILD that had fewer tables** — every
 * table this build reads is either present or is one this build added, and a
 * rebuild fills it.
 *
 * Its own class, and it is not a nicety. When `conversations` was the only
 * table, `missing.length > 0` could only mean somebody had deleted a table by
 * hand, so calling it damage was right. `subagents` (`plan:archive seq:12`)
 * makes it mean something else as well, and far more often: an index built
 * before this build existed. Every corpus in the world is in that state the
 * moment this ships.
 *
 * **Reporting that as damage would have been a permanent stall**, and the path
 * is worth spelling out because nothing would have said so:
 * `stopConversationRefresh` gates on `openReadOnlyChecked` and returns `null`
 * when it throws, so a hard error there would stop the automatic refresh for
 * good — and the automatic refresh is the only thing that would have created
 * the missing table. The index would then sit frozen at the byte it reached
 * on upgrade day, exactly the defect `plan:archive seq:14` was built to end,
 * and with no surface anywhere reporting a cause.
 *
 * So it is a REPAIRABLE state with a named repair, the write path heals it on
 * the next turn, and the read surfaces serve the same empty answer they serve
 * for `ConversationIndexUninitializedError` — with the rebuild command
 * composed beside it, never run.
 */
export class ConversationIndexIncompleteError extends Error {
  /** The tables this build reads that the index does not have yet. */
  readonly missing: string[];
  constructor(message: string, missing: string[]) {
    super(message);
    this.missing = missing;
  }
}

/** One indexed session, in the shape the row is stored and read back. */
export interface ConversationRow {
  sessionId: string;
  /**
   * Which file this row was read from: `'live'`, `'persisted'` or
   * `'exported'`. See the header for why those three and not a boolean.
   */
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
 * **One session the owner asked us not to lose** — `plan:archive seq:4`, the
 * standing mark and the mirror's bookkeeping in one row.
 *
 * The mark is separate from `ConversationRow` for the reason the schema header
 * gives: it has to outlive the row. A session whose transcript the harness has
 * pruned has no `conversations` row until the mirror is read back in, and that
 * is the exact moment the mark is worth something.
 */
export interface PersistedRow {
  sessionId: string;
  /** Absolute path of the mirror — the file a person can hand to somebody. */
  file: string;
  /**
   * **How much of the ORIGINAL transcript the mirror already holds**, and
   * therefore where the next append resumes.
   *
   * The mirror is byte-for-byte the first `bytes` bytes of the transcript and
   * always ends on a line boundary, so it is valid JSONL at every instant and
   * an interrupted append costs the partial line rather than the file: the
   * next advance truncates back to this number before it writes.
   */
  bytes: number;
  /** When the owner asked. Never moved by an append. */
  markedAt: string;
  /** When the mirror last caught up. Moved by every advance. */
  mirroredAt: string;
  /**
   * `null` while the mirror is keeping up; otherwise the one reason it
   * stopped. A copy that is no longer current has to say so rather than look
   * finished — `INV-nothing-is-dropped-silently`.
   */
  note: string | null;
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

/**
 * A search term as a literal for SQL `LIKE`.
 *
 * `%` and `_` are `LIKE`'s own wildcards, so a reader searching for `100%` or
 * for `read_model` would otherwise be handed a pattern that matches far more
 * than what they typed — and would have no way to tell, because the extra rows
 * look exactly like real matches. The backslash is escaped first because it
 * is what the other two are escaped WITH; every caller pairs this with
 * `ESCAPE '\'`.
 *
 * There is deliberately no way to opt IN to wildcards. The box on the screen
 * is a find box, not a query language, and a product that silently accepted
 * one from a reader who meant a literal would be answering a different
 * question from the one that was asked.
 */
function likeEscape(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

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
 * **How long a session lasted, in milliseconds** — `plan:archive seq:10`,
 * which names duration in the list's column set and observes that both stamps
 * are already in the row, "so this is arithmetic".
 *
 * It is arithmetic, and it is here rather than on the screen for
 * `truncatedScan`'s stated reason: a subtraction every surface re-derives is a
 * subtraction two surfaces will eventually make differently. The list, the
 * terminal and any later export all take it from this one function.
 *
 * ── THREE ANSWERS, AND `null` IS ONE OF THEM ──────────────────────────────
 *
 * `null` when either stamp is missing. A transcript that carried no timestamp
 * at all is a real state — `all()`'s ordering already treats it as one, and
 * sorts those rows last rather than at the epoch — and `0` would be a measured
 * zero-length session, which is a different fact
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
 *
 * `null` too when the stamps run backwards. It has not been observed and it is
 * not impossible: `startedAt` and `endedAt` are the harness's own timestamps
 * on the first and last records the SCAN read, and a clock that stepped back
 * mid-session would produce it. A negative duration drawn as `-3h` is a
 * screen asserting something absurd with total confidence; the absence is
 * honest and is the same absence a missing stamp already produces.
 *
 * ── AND WHAT IT MEANS FOR A SESSION STILL BEING WRITTEN ───────────────────
 *
 * Exactly what every other number on the row means: **what the last scan
 * saw.** `endedAt` is the stamp of the last record the index read, so a live
 * session's duration is a FLOOR that grows each time the index is refreshed —
 * and the row already carries the disclosure that says so, because
 * `staleBy` is non-zero for precisely those rows. No second field is added to
 * say it a second way; the list marks the duration with the staleness it
 * already draws.
 *
 * Measured on this workspace 2026-09-09, which is why the range matters: the
 * two indexed sessions are **84.553 seconds** and **6 days 21 minutes**
 * (519,680,397 ms and 84,553 ms). A format that reads well for one of those
 * and not the other is not a format.
 */
export function spanMs(row: { startedAt: string | null; endedAt: string | null }): number | null {
  if (row.startedAt === null || row.endedAt === null) return null;
  const from = Date.parse(row.startedAt);
  const to = Date.parse(row.endedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return to < from ? null : to - from;
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

/**
 * **What the harness records about a subagent, in a file beside its
 * transcript — and it is the whole answer to "what links a lane to the turn
 * that dispatched it".**
 *
 * `plan:archive seq:12` asked for this to be MEASURED rather than invented,
 * and `seq:15` cannot be built without it. It was measured on this workspace,
 * 2026-09-08, over all 253 subagent transcripts:
 *
 *     agent-<id>.jsonl        the transcript
 *     agent-<id>.meta.json    THIS — present for 253 of 253, never missing
 *
 * and every one of the 253 carries `agentType`, `description`, `toolUseId` and
 * `spawnDepth`. `parentAgentId` appears on 43, `model` on 88, `isFork` on 8.
 *
 * ── `toolUseId` IS THE LINK, AND IT RESOLVES EXACTLY ───────────────────────
 *
 * It is the `id` of the `tool_use` block of the `Agent` call that dispatched
 * this lane, in the transcript of whoever dispatched it. Cross-checked both
 * directions on the owner's own session:
 *
 *     `Agent` tool_use blocks in the session transcript        210
 *     of those with a subagent transcript                      210   100%
 *     subagent metas whose toolUseId is NOT in the session      43
 *     subagent metas carrying `parentAgentId`                   43   the same 43
 *     of those, resolved inside `agent-<parentAgentId>.jsonl`    43   100%
 *
 * So there are no orphans in either direction, and the 43 that do not resolve
 * against the session are not a failure of the link — they are lanes a LANE
 * dispatched. `spawnDepth` says which: 210 at depth 1, 43 at depth 2, and
 * `parentAgentId` is present on exactly the ones with depth > 1 and absent on
 * exactly the ones with depth 1.
 *
 * **So the parent is two facts and not one**, and a build that stored only the
 * session would silently mis-file a fifth of them: `parentAgentId === null`
 * means the SESSION dispatched it, and otherwise the named subagent did.
 *
 * ── AND `sessionId` IN THE TRANSCRIPT NAMES THE PARENT, NOT THE SUBAGENT ───
 *
 * Every record inside a subagent transcript carries `sessionId` = the owning
 * SESSION — 99,760 of 99,760, including all 43 at depth 2. The subagent's own
 * identity is `agentId`, and the filename is `agent-` + that: verified on all
 * 253. That is why `session_id` here is the ROOT session and not a hop.
 */
export interface SubagentMeta {
  /** `general-purpose`, `Explore`, `fork`, a plugin agent — the harness's word. */
  agentType: string | null;
  /** The one line the dispatcher typed. The nearest thing a lane has to a title. */
  description: string | null;
  /** The `Agent` tool_use block that dispatched this lane. THE parent link. */
  toolUseId: string | null;
  /** `null` when the SESSION dispatched it; else the subagent that did. */
  parentAgentId: string | null;
  model: string | null;
  /** 1 for a lane the session dispatched, 2 for a lane a lane dispatched. */
  spawnDepth: number;
  /** A `fork` inherits the dispatcher's context. Recorded because it changes what to expect. */
  isFork: boolean;
}

/**
 * Read one subagent's sidecar.
 *
 * **Never throws, and a missing or unparseable sidecar is not a reason to drop
 * the transcript.** The reasoning is `listTranscriptFiles`': the sidecar's
 * schema is the HARNESS's and can change without notice, while the transcript
 * beside it is the thing worth keeping. A lane whose sidecar cannot be read is
 * indexed with its link fields `null` and `spawnDepth` 0 — visibly unlinked
 * rather than absent, which is `INV-nothing-is-dropped-silently` applied to
 * the join rather than to the counts.
 *
 * Measured 2026-09-08: this branch never fired here — 253 of 253 sidecars
 * parsed — so it is a tolerance rather than a workaround for something seen.
 */
export function readSubagentMeta(dir: string, agentId: string): SubagentMeta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path.join(dir, `${agentId}.meta.json`), 'utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  const text = (key: string): string | null => {
    const value = row[key];
    return typeof value === 'string' && value !== '' ? value : null;
  };
  return {
    agentType: text('agentType'),
    description: text('description'),
    toolUseId: text('toolUseId'),
    parentAgentId: text('parentAgentId'),
    model: text('model'),
    spawnDepth: typeof row['spawnDepth'] === 'number' ? row['spawnDepth'] : 0,
    isFork: row['isFork'] === true,
  };
}

/** Where one session's subagent transcripts live. */
export function subagentDir(
  env: Record<string, string | undefined>, cwd: string, sessionId: string,
): string {
  return path.join(transcriptDir(env, cwd), sessionId, 'subagents');
}

/** One subagent transcript found on disk, with whatever its sidecar said. */
export interface SubagentFile {
  /** `agent-<hex>` — the filename without `.jsonl`, and the primary key. */
  agentId: string;
  file: string;
  bytes: number;
  mtimeMs: number;
  meta: SubagentMeta | null;
}

/**
 * The subagent transcripts of one session: **top-level `*.jsonl` in that one
 * directory, and never a recursive walk** — `listTranscriptFiles`' rule, for
 * `listTranscriptFiles`' reason.
 *
 * `.meta.json` is excluded by the `.jsonl` test alone, which is worth stating
 * because the two files share a stem: `agent-<id>.jsonl` and
 * `agent-<id>.meta.json` sit beside each other, so a listing keyed on a prefix
 * rather than on the extension would find every lane twice.
 *
 * Never throws. A session with no `subagents/` directory dispatched no lanes,
 * which is an ordinary state and not a fault — measured here, 2 of the 4
 * sessions in this project's directory have no such directory at all.
 */
export function listSubagentFiles(dir: string): SubagentFile[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const found: SubagentFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const agentId = name.slice(0, -'.jsonl'.length);
    const file = path.join(dir, name);
    try {
      const stat = statSync(file);
      if (!stat.isFile()) continue;
      found.push({
        agentId,
        file,
        bytes: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
        meta: readSubagentMeta(dir, agentId),
      });
    } catch {
      continue;
    }
  }
  return found.sort((a, b) => (a.agentId < b.agentId ? -1 : 1));
}

/**
 * One indexed subagent. The counting columns are `ConversationRow`'s, by the
 * same scanner, so the two kinds of transcript are never counted two ways.
 */
export interface SubagentRow {
  agentId: string;
  /** The session that OWNS this lane, however many hops dispatched it. */
  sessionId: string;
  /** `null` when the session dispatched it directly. */
  parentAgentId: string | null;
  /** The `Agent` tool_use block in the dispatching transcript. `seq:15`'s handle. */
  toolUseId: string | null;
  agentType: string | null;
  /** The dispatcher's one-line brief. A lane's name, and never fabricated. */
  description: string | null;
  model: string | null;
  spawnDepth: number;
  isFork: boolean;
  file: string;
  bytes: number;
  mtimeMs: number;
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
  scannedAt: string;
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
    //
    // ── `machinery` IS THE REMAINDER, AND IT WAS NOT ────────────────────────
    //
    // This block used to increment `machinery` only when `row.type` was
    // `user` or `assistant`, and only when the record carried a `message`
    // object at all. So a record of any other type landed in NONE of the
    // three, and `prompts + answers + machinery` came out BELOW `records` —
    // while `ConversationRow.machinery`'s own doc promised the opposite:
    // *"counted rather than discarded so `prompts + answers + machinery`
    // accounts for every conversational record"*. The code contradicted its
    // own stated contract, which is the silent drop rather than the disclosed
    // one and exactly what `INV-nothing-is-dropped-silently` forbids.
    //
    // Measured on this workspace, 2026-09-08, which is why it is fixed here
    // rather than noted: of 99,760 records across the 253 subagent
    // transcripts, **29,082 are `attachment`** — 29% of the file falling into
    // no column at all. On the session transcript the same hole swallows
    // `ai-title`, `queue-operation`, `system` and `file-history-snapshot`.
    //
    // `classifyTurn` already answers `'machinery'` for every type it does not
    // know, so the fix is to stop second-guessing it: the two guards are gone
    // and the identity now HOLDS — `prompts + answers + machinery ===
    // records`, exactly, for both kinds of transcript.
    //
    // **This changes existing numbers**, upward, in the `machinery` column
    // only. That is the column being made true rather than a count being
    // inflated: nothing moves out of `prompts` or `answers`, and the two
    // headline numbers are untouched.
    const message = row.message;
    const content = typeof message === 'object' && message !== null
      ? (message as { content?: unknown }).content
      : undefined;
    const turn = classifyTurn(row.type, content);
    if (turn === 'prompt') result.prompts += 1;
    else if (turn === 'answer') result.answers += 1;
    else result.machinery += 1;
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
        // **Which table is missing decides which of the two states this is.**
        //
        // `conversations` is created by the same `open` that creates every
        // other table here, so an index that HAS it was built by some build of
        // this feature and the tables it lacks are ones a LATER build added.
        // That is an upgrade, and a rebuild fills them.
        //
        // An index missing `conversations` while holding something else is the
        // original reading and still damage: nothing has ever created one
        // without the other, so a file in that shape was edited by something
        // that is not this code.
        if (present.includes('conversations')) {
          throw new ConversationIndexIncompleteError(
            `my_context: ${dbPath} has ${present.join(', ')} but not ${missing.join(', ')} — ` +
            'an index built before this build added that table, not a damaged one. Run ' +
            '`mycontext conversation rebuild` to fill it; the automatic per-turn refresh also ' +
            'creates it, because creating tables is a write and a read-only caller never does.',
            missing,
          );
        }
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
   * ── THIS DOES THE OPPOSITE OF THE SPEC, ON A RULING ───────────────────────
   *
   * The design says "a pruned transcript is a BROKEN ROW in the index" and
   * that the list must keep showing it. This deletes it instead, and the
   * disagreement was found and put to the owner: `plan:archive seq:11` records
   * both sides and his ruling of 2026-09-07 — **the code is right**, the list
   * shows only sessions that still exist, and the spec sentence is superseded.
   * What replaces a broken row is his own better answer, persistence
   * (`plan:archive seq:4` and `seq:5`), where a session worth keeping is
   * mirrored out rather than remembered as a stub.
   *
   * The comment here used to cite that spec sentence in support of doing the
   * opposite of what it says, which is how the contradiction survived. It now
   * cites the ruling that settled it.
   *
   * The count is returned rather than swallowed because a transcript the
   * harness pruned is knowledge leaving the archive, and a rebuild that
   * quietly shrank would be exactly the silent loss
   * `INV-nothing-is-dropped-silently` forbids. Between one rebuild and the
   * next, a deleted file is still disclosed on the list by
   * `ConversationSummary.present`, which is a `stat` at request time and not
   * this.
   */
  removeMissing(present: Set<string>): number {
    const known = (this.#db.prepare('SELECT session_id FROM conversations')
      .all() as { session_id: string }[]).map((r) => r.session_id);
    // **A PERSISTED SESSION IS NEVER DROPPED, AND THAT IS THE WHOLE POINT OF
    // THE MARK** — `plan:archive seq:4`/`seq:5`. `seq:11`'s ruling is that a
    // session whose file the harness pruned leaves the list; `seq:5` records
    // the consequence in as many words — *"the persisted copy is the ONLY
    // thing that can keep it visible. Without this task, 'marked persistent'
    // is a promise the product does not keep."* So the row survives here and
    // `advanceMirrors` (`core/conversation-mirror.ts`) rewrites it against the
    // mirror, with `source = 'exported'` saying which file a reader now has.
    //
    // A mark with no mirror on disk spares nothing: `advanceMirrors` clears
    // the mark in that case, so this cannot pin a row to a file that is gone
    // twice over.
    const kept = new Set(
      (this.#db.prepare('SELECT session_id FROM persisted')
        .all() as { session_id: string }[]).map((r) => r.session_id),
    );
    const gone = known.filter((id) => !present.has(id) && !kept.has(id));
    const statement = this.#db.prepare('DELETE FROM conversations WHERE session_id = ?');
    for (const id of gone) statement.run(id);
    return gone.length;
  }

  /** Replace one subagent's row wholesale. A scan is a fact about a file at a time. */
  upsertSubagent(row: SubagentRow): void {
    this.#db.prepare(
      `INSERT INTO subagents (
         agent_id, session_id, parent_agent_id, tool_use_id, agent_type, description, model,
         spawn_depth, is_fork, file, bytes, mtime_ms, scanned_bytes, started_at, ended_at,
         prompts, answers, machinery, records, unreadable, branch, cwd, scanned_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(agent_id) DO UPDATE SET
         session_id = excluded.session_id, parent_agent_id = excluded.parent_agent_id,
         tool_use_id = excluded.tool_use_id, agent_type = excluded.agent_type,
         description = excluded.description, model = excluded.model,
         spawn_depth = excluded.spawn_depth, is_fork = excluded.is_fork,
         file = excluded.file, bytes = excluded.bytes, mtime_ms = excluded.mtime_ms,
         scanned_bytes = excluded.scanned_bytes, started_at = excluded.started_at,
         ended_at = excluded.ended_at, prompts = excluded.prompts, answers = excluded.answers,
         machinery = excluded.machinery, records = excluded.records,
         unreadable = excluded.unreadable, branch = excluded.branch, cwd = excluded.cwd,
         scanned_at = excluded.scanned_at`,
    ).run(
      row.agentId, row.sessionId, row.parentAgentId, row.toolUseId, row.agentType,
      row.description, row.model, row.spawnDepth, row.isFork ? 1 : 0, row.file, row.bytes,
      row.mtimeMs, row.scannedBytes, row.startedAt, row.endedAt, row.prompts, row.answers,
      row.machinery, row.records, row.unreadable, row.branch, row.cwd, row.scannedAt,
    );
  }

  /**
   * One session's lanes, OLDEST FIRST.
   *
   * The opposite of `all()`'s order, and deliberately: `all()` lists sessions,
   * where the newest conversation is the one a reader wants on top, while this
   * lists the lanes WITHIN one session, which a reader follows in the order
   * the session dispatched them. A row with no `started_at` sorts last for
   * `all()`'s reason — it is a real state, not a zero date.
   */
  subagentsOf(sessionId: string): SubagentRow[] {
    const rows = this.#db.prepare(
      'SELECT * FROM subagents WHERE session_id = ? ' +
      'ORDER BY started_at ASC NULLS LAST, agent_id ASC',
    ).all(sessionId) as Record<string, unknown>[];
    return rows.map(toSubagentRow);
  }

  getSubagent(agentId: string): SubagentRow | null {
    const row = this.#db.prepare(
      'SELECT * FROM subagents WHERE agent_id = ?',
    ).get(agentId) as Record<string, unknown> | undefined;
    return row === undefined ? null : toSubagentRow(row);
  }

  /**
   * **The lane a given `Agent` tool call produced** — `plan:archive seq:15`'s
   * whole lookup, in one indexed query.
   *
   * `tool_use_id` is not declared UNIQUE, because uniqueness is the harness's
   * to guarantee and not ours to enforce on data we only read; measured
   * 2026-09-08 the 253 ids here are all distinct. `get` rather than `all` is
   * the reading that follows from the fact: one call dispatches one lane.
   */
  subagentByToolUse(toolUseId: string): SubagentRow | null {
    const row = this.#db.prepare(
      'SELECT * FROM subagents WHERE tool_use_id = ?',
    ).get(toolUseId) as Record<string, unknown> | undefined;
    return row === undefined ? null : toSubagentRow(row);
  }

  /** How many lanes each session owns, for the list's count. One grouped query. */
  subagentCounts(): Map<string, number> {
    const rows = this.#db.prepare(
      'SELECT session_id, COUNT(*) AS n FROM subagents GROUP BY session_id',
    ).all() as { session_id: string; n: number }[];
    return new Map(rows.map((r) => [r.session_id, Number(r.n)]));
  }

  /**
   * **Every branch the archive holds a session from, in one query** —
   * `plan:archive seq:10`, whose spec clause asks for the list to be
   * "filterable by date and branch".
   *
   * A branch the reader can choose has to be a branch that EXISTS in the
   * index: a free-text box would let somebody type `mian` and read the empty
   * answer as "no sessions on that branch" rather than as a typo. Serving the
   * roster is what makes the control a choice among facts.
   *
   * `NULL` is dropped rather than offered as a value. A session whose
   * transcript recorded no branch is a real state, but it is not a branch, and
   * putting it in a branch list would invent a repository named "unknown".
   * The list's own count discloses it: filtering by branch narrows, and the
   * screen says how many the filter left out.
   *
   * Measured on this workspace 2026-09-09: one branch, `master`, over 2
   * sessions — 0.025 ms. The cost is stated because the control is drawn
   * whether the answer is one branch or forty.
   */
  branches(): string[] {
    const rows = this.#db.prepare(
      'SELECT DISTINCT branch FROM conversations WHERE branch IS NOT NULL ORDER BY branch ASC',
    ).all() as { branch: string }[];
    return rows.map((r) => r.branch);
  }

  /**
   * **How many of each session's LANES match a search term** — the half of
   * `plan:archive seq:10`'s "searchable across content" that this archive can
   * actually answer, and the measurement that decided which half.
   *
   * ── WHAT IS SEARCHED, AND WHAT COSTS WHAT ─────────────────────────────────
   *
   * This searches the INDEX — a lane's `description` (the line its dispatcher
   * typed) and its `agent_type` — and never a transcript. Measured on this
   * workspace, 2026-09-09, over 259 lanes and 2 sessions:
   *
   *     this query, median of 20             0.076 ms
   *     GNU grep over the same transcripts   647 ms warm, 1,003 ms cold
   *                                          (889,365,963 bytes, 261 files)
   *
   * **Eight thousand times**, for a keypress. And that 647 ms is C reading
   * bytes; this build would have to `JSON.parse` every record to search what a
   * reader would call the CONTENT rather than the punctuation of the JSON
   * around it. `read-model-conversation-document.ts` already measures a full
   * outline walk of ONE 74 MB session at 1,577 ms — one session of the 261
   * files above.
   *
   * So the list's search is a search of NAMES, and the screen says so in the
   * same breath as it reports what matched (`conv.searchScope`). The within-a-
   * session search that DOES read content already exists, one level down, and
   * is bounded to the session a reader has chosen to open.
   *
   * ── WHY LANES AT ALL, WHEN THE LIST IS OF SESSIONS ────────────────────────
   *
   * Because the archive is mostly lanes. 2 sessions against 259 subagent
   * transcripts here: a search that read only the two session titles would be
   * a control with almost nothing to match, and the thing a reader actually
   * wants to find — "which session dispatched the lane about the index?" — is
   * exactly the thing the sessions' own two rows cannot answer. Six lanes
   * match `index` in this workspace, all under one session; that session is
   * the answer, and the count is how the row says why it is on screen.
   *
   * The term is matched as a case-insensitive substring. SQLite's `LIKE` is
   * ASCII-case-insensitive by default and is left that way rather than given a
   * collation: a Hebrew or accented term still matches exactly, and inventing
   * a folding rule here would be this build guessing at a reader's language.
   */
  subagentMatches(term: string): Map<string, number> {
    const pattern = `%${likeEscape(term)}%`;
    const rows = this.#db.prepare(
      'SELECT session_id, COUNT(*) AS n FROM subagents ' +
      "WHERE description LIKE ? ESCAPE '\\' OR agent_type LIKE ? ESCAPE '\\' " +
      'GROUP BY session_id',
    ).all(pattern, pattern) as { session_id: string; n: number }[];
    return new Map(rows.map((r) => [r.session_id, Number(r.n)]));
  }

  /** The `(bytes, mtime_ms)` freshness key for every indexed subagent. */
  subagentFingerprints(): Map<string, { bytes: number; mtimeMs: number }> {
    const rows = this.#db.prepare(
      'SELECT agent_id, bytes, mtime_ms FROM subagents',
    ).all() as { agent_id: string; bytes: number; mtime_ms: number }[];
    return new Map(rows.map((r) => [r.agent_id, { bytes: r.bytes, mtimeMs: r.mtime_ms }]));
  }

  /**
   * Drop the rows for lanes no longer on disk, and say how many.
   *
   * **Scoped to ONE session**, unlike `removeMissing`, and the difference is
   * load-bearing: a rebuild only ever lists the `subagents/` directories of
   * the sessions it found, so it learns nothing about the lanes of a session
   * whose own transcript has been pruned. Sweeping globally on that knowledge
   * would delete every one of them on the first refresh after a prune —
   * knowledge leaving the archive to a walk that never looked.
   */
  removeMissingSubagents(sessionId: string, present: Set<string>): number {
    const known = (this.#db.prepare('SELECT agent_id FROM subagents WHERE session_id = ?')
      .all(sessionId) as { agent_id: string }[]).map((r) => r.agent_id);
    const gone = known.filter((id) => !present.has(id));
    const statement = this.#db.prepare('DELETE FROM subagents WHERE agent_id = ?');
    for (const id of gone) statement.run(id);
    return gone.length;
  }

  /* ── THE STANDING MARK — `plan:archive seq:4` ──────────────────────────── */

  /**
   * Record, or move on, one session's mark. `bytes` is how much of the
   * ORIGINAL the mirror now holds; see `PersistedRow`.
   *
   * `marked_at` is preserved across an update, because it answers *when did
   * the owner ask for this* and no later append changes that. `mirrored_at`
   * moves on every advance, which is what makes a mirror that has quietly
   * stopped keeping up visible from the row alone.
   */
  markPersisted(row: PersistedRow): void {
    this.#db.prepare(
      `INSERT INTO persisted (session_id, file, bytes, marked_at, mirrored_at, note)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(session_id) DO UPDATE SET
         file = excluded.file, bytes = excluded.bytes,
         mirrored_at = excluded.mirrored_at, note = excluded.note`,
    ).run(row.sessionId, row.file, row.bytes, row.markedAt, row.mirroredAt, row.note);
  }

  /** Every mark, oldest first — the order they were taken, which is the order they read. */
  persisted(): PersistedRow[] {
    const rows = this.#db.prepare(
      'SELECT * FROM persisted ORDER BY marked_at ASC, session_id ASC',
    ).all() as Record<string, unknown>[];
    return rows.map(toPersisted);
  }

  persistedOf(sessionId: string): PersistedRow | null {
    const row = this.#db.prepare(
      'SELECT * FROM persisted WHERE session_id = ?',
    ).get(sessionId) as Record<string, unknown> | undefined;
    return row === undefined ? null : toPersisted(row);
  }

  /** Drop one mark. `false` when there was none — an answer, not a failure. */
  unpersist(sessionId: string): boolean {
    if (this.persistedOf(sessionId) === null) return false;
    this.#db.prepare('DELETE FROM persisted WHERE session_id = ?').run(sessionId);
    return true;
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

function toPersisted(row: Record<string, unknown>): PersistedRow {
  const note = row['note'];
  return {
    sessionId: String(row['session_id'] ?? ''),
    file: String(row['file'] ?? ''),
    bytes: Number(row['bytes'] ?? 0),
    markedAt: String(row['marked_at'] ?? ''),
    mirroredAt: String(row['mirrored_at'] ?? ''),
    note: typeof note === 'string' ? note : null,
  };
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

function toSubagentRow(row: Record<string, unknown>): SubagentRow {
  const text = (key: string): string | null => {
    const value = row[key];
    return typeof value === 'string' ? value : null;
  };
  const count = (key: string): number => Number(row[key] ?? 0);
  return {
    agentId: String(row['agent_id'] ?? ''),
    sessionId: String(row['session_id'] ?? ''),
    parentAgentId: text('parent_agent_id'),
    toolUseId: text('tool_use_id'),
    agentType: text('agent_type'),
    description: text('description'),
    model: text('model'),
    spawnDepth: count('spawn_depth'),
    isFork: count('is_fork') === 1,
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
 *
 * **`previous` is the structural shape both row kinds share**, rather than
 * `ConversationRow`, so a subagent row composes by the identical arithmetic
 * (`plan:archive seq:12`). It has to be the same function and not a second
 * one: the whole reason this lives in one place is that a caller improvising
 * it gets one of the two kinds wrong, and a second row kind is a second
 * caller. `previousAiTitle` is passed IN because it is the only field the two
 * kinds disagree about — a subagent has no title at all, measured, so it
 * passes `null` and the last-writer-wins rule collapses to the tail's answer.
 */
type MergeablePrevious = Pick<
  ConversationRow,
  'scannedBytes' | 'startedAt' | 'endedAt' | 'prompts' | 'answers' | 'machinery'
  | 'records' | 'unreadable' | 'branch' | 'cwd'
>;

function mergeScan(
  previous: MergeablePrevious, tail: ScanResult, previousAiTitle: string | null,
): ScanResult {
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
    aiTitle: tail.aiTitle ?? previousAiTitle,
  };
}

/**
 * What the subagent half of one rebuild did.
 *
 * **A nested object rather than more fields on `RebuildReport`**, so every
 * number already printed keeps meaning exactly what it meant: `found` is
 * transcripts, `scanned` is transcripts, `bytesRead` is bytes of transcript.
 * A rebuild that quietly folded 253 lanes into `found` would make the one
 * line `reportLines` prints — *"scanned N transcript(s) of M"* — say something
 * different without anybody editing it, which is how a number stops being
 * checkable.
 */
export interface SubagentRebuildReport {
  /** Subagent transcripts found on disk, across every session listed. */
  found: number;
  /** Read WHOLE this run. */
  scanned: number;
  /** Brought up to date from their appended tail alone. */
  appended: number;
  /** Skipped because size and mtime matched the indexed row. */
  skipped: number;
  /** Rows dropped because their transcript is gone from disk. */
  removed: number;
  /** Lanes whose scan hit the cap; their counts are floors. */
  truncated: string[];
  /**
   * Transcripts whose `.meta.json` was missing or unreadable, so the link to
   * the turn that dispatched them is `null`. Counted because an unlinked lane
   * is exactly what `plan:archive seq:15` cannot open, and a silent zero here
   * would look identical to a session that dispatched none.
   */
  unlinked: number;
  /** Bytes of subagent transcript actually read this run. */
  bytesRead: number;
}

/** What one `forget` removed. Zero and never-indexed are different answers. */
export interface ForgetReport {
  /** `false` when there was no conversation index here to begin with. */
  indexed: boolean;
  /** Session rows dropped. */
  conversations: number;
  /** Subagent rows dropped. */
  subagents: number;
  /**
   * **Standing persistence marks dropped** — `plan:archive seq:4`.
   *
   * The MIRRORS THEMSELVES ARE NOT DELETED, and the split is deliberate. This
   * command's whole argument is that it drops a cache the transcripts on disk
   * can rebuild; a mirror is the opposite kind of thing — it may be the only
   * remaining copy of a session, and deleting it would destroy knowledge under
   * a command whose own confirmation promises it destroys none. So the marks
   * go, the files stay, and the caller is told where they are.
   */
  persisted: number;
}

/**
 * **Un-index this workspace: drop every conversation row and the tables
 * themselves, so nothing scans a transcript here again until somebody asks.**
 *
 * `plan:archive seq:9`, and it is the half of that item that was genuinely
 * missing. The item says the design settles the archive as "OPT-IN ... One key,
 * defaulting to OFF ... A project that does not turn it on behaves exactly as
 * it does today, AND NOTHING SCANS A TRANSCRIPT", and reports that no such key
 * exists.
 *
 * ── THE OFF DEFAULT ALREADY HELD; WHAT WAS ABSENT WAS THE WAY BACK ─────────
 *
 * Checked against the code as it stands 2026-09-09 rather than as the item
 * found it. `rebuildConversations` has exactly TWO callers in the whole
 * product: `cli/commands/conversation.ts`, which is a person typing a command,
 * and `hooks/stop.ts`' `stopConversationRefresh`, which opens with
 * `openReadOnlyChecked` purely as a GATE and returns `null` when no index
 * exists — its own comment says "a workspace nobody has ever scanned is still
 * never opted in by a background hook". `ConversationIndex.open` — the only
 * thing that creates these tables — is called from exactly one place, inside
 * `rebuildConversations`. And the read surfaces cannot build one at all, by
 * construction, which `test/ui/no-writes.test.ts` holds.
 *
 * So a project that never runs the command never has an index, and nothing
 * ever reads its transcripts. That IS off-by-default, enforced in three places
 * instead of declared in one — and it is stronger than a config key in the
 * respect the item cares about most, because a key is a FILE and a file can
 * arrive with a cloned repository. Nothing a repository ships can opt a
 * reader's machine into scanning their transcripts; only their own keystroke
 * can.
 *
 * What was missing is that the switch had no OFF position. Once scanned, the
 * Stop hook refreshes for ever, and the only way to stop it was to delete
 * `.index.db` — which is also the corpus's item index, so opting out of the
 * archive meant discarding an unrelated cache. This is that missing half, and
 * it is deliberately NOT a new key: it removes the state the existing gate
 * reads, so the same three enforcement points do the work in both directions.
 *
 * ── WHY IT DROPS THE TABLES AND NOT JUST THE ROWS ─────────────────────────
 *
 * Because the gate asks whether the TABLES exist, not whether they hold
 * anything. `DELETE FROM conversations` would leave an empty index that
 * `openReadOnlyChecked` still opens, so the hook would keep scanning and
 * re-fill it on the next assistant turn — an opt-out that silently undid
 * itself, which is worse than none. Dropping returns the workspace to the
 * `ConversationIndexUninitializedError` state it was in before the first scan,
 * which is precisely the state the hook declines to act on.
 *
 * Nothing is lost that is not reconstructible: the transcripts are the source
 * of truth and this index is a cache — the whole reason `rebuildConversations`
 * can rebuild it from disk. The counts come back so the caller can say what
 * left, because a cache shrinking in silence is what
 * `INV-nothing-is-dropped-silently` forbids.
 *
 * **A WRITE, and therefore unreachable from `src/ui/`.** It lives beside
 * `rebuildConversations` for that reason and is called from the CLI only.
 */
export function forgetConversations(dbPath: string, busyTimeoutMs = 3000): ForgetReport {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    const has = (table: string): boolean => (db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(table) as { name: string } | undefined) !== undefined;
    const count = (table: string): number => Number(
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n,
    );

    // Either table alone is enough to have been opted in: an index holding
    // `conversations` and not `subagents` is the "a schema behind" state the
    // Stop hook deliberately treats as EXISTING, so an opt-out that only
    // recognised the complete shape would leave exactly that workspace
    // scanning.
    const hasConversations = has('conversations');
    const hasSubagents = has('subagents');
    const hasPersisted = has('persisted');
    if (!hasConversations && !hasSubagents && !hasPersisted) {
      return { indexed: false, conversations: 0, subagents: 0, persisted: 0 };
    }
    const conversations = hasConversations ? count('conversations') : 0;
    const subagents = hasSubagents ? count('subagents') : 0;
    const persisted = hasPersisted ? count('persisted') : 0;
    db.exec('DROP TABLE IF EXISTS conversations');
    db.exec('DROP TABLE IF EXISTS subagents');
    // The marks, not the mirrors. See `ForgetReport.persisted` for why those
    // two are not the same act and why this command may only do the first.
    db.exec('DROP TABLE IF EXISTS persisted');
    return { indexed: true, conversations, subagents, persisted };
  } finally {
    db.close();
  }
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
  /** The subagent half, kept apart so neither set of numbers dilutes the other. */
  subagents: SubagentRebuildReport;
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
    const knownAgents = index.subagentFingerprints();
    const report: RebuildReport = {
      dir,
      found: files.length,
      scanned: 0,
      appended: 0,
      skipped: 0,
      removed: 0,
      truncated: [],
      bytesRead: 0,
      subagents: {
        found: 0, scanned: 0, appended: 0, skipped: 0, removed: 0,
        truncated: [], unlinked: 0, bytesRead: 0,
      },
      ms: 0,
    };

    /**
     * **One session's lanes** — `plan:archive seq:12`.
     *
     * ── THE COST, MEASURED, BECAUSE THE ITEM ASKED FOR IT TO BE ────────────
     *
     * This runs on the `Stop` hook, once per assistant turn, so it has to be
     * affordable at that cadence and not merely finite. Measured on this
     * workspace, 2026-09-08, over its 253 subagent transcripts:
     *
     *     stat every one of the 253       5.06 ms      615.3 MB on disk
     *     read every one of the 253      1577 ms       99,760 records
     *     the largest single lane          28 ms        16.2 MB
     *                                                  ---------- 311x
     *
     * **The steady state is the 5 ms, and the reason is a property a session
     * does not have: a subagent transcript is FINISHED.** A session appends
     * for as long as somebody is typing into it, so its row is stale by
     * construction on every turn. A lane's transcript stops the moment the
     * lane returns, and never grows again — so after the first index every
     * later refresh is `stat`s that match, plus a whole-file read of only the
     * lanes that ran during that one turn. The first index pays 1.6 seconds
     * ONCE, from `mycontext conversation rebuild`.
     *
     * The cap is not reached and is not close: the largest lane here is 16.2
     * MB against `MAX_SCAN_BYTES` of 256 MiB, so no row is truncated and
     * `truncated` stays empty. It is still checked and still reported, for
     * the reason the session path checks it — a bound nobody tests is a bound
     * nobody knows the state of.
     *
     * **The append path is not a precaution here; it FIRES.** It was offered
     * on the reasoning that "a finished lane never grows" is a claim about the
     * harness rather than a guarantee from it — and the first incremental run
     * measured it firing on 2 of 254 lanes for 8,529 bytes, because two lanes
     * were RUNNING at that moment and a running lane is writing. So the
     * sentence above needs its qualifier: a lane's transcript is finished once
     * the lane returns, and until then it appends exactly as a session does.
     *
     * The three runs, measured end to end through `mycontext conversation
     * rebuild` on this workspace, 2026-09-08:
     *
     *     --full            254 lanes read whole   646,837,699 B   1,762 ms
     *     incremental       2 tails, 252 skipped         8,529 B      36 ms
     *     incremental       0 tails, 254 skipped             0 B      18 ms
     *
     * The 18 ms is the per-turn cost in the steady state, and it is what makes
     * this affordable on `Stop`.
     */
    const scanSubagents = (sessionId: string): void => {
      const agentDir = path.join(dir, sessionId, 'subagents');
      const agents = listSubagentFiles(agentDir);
      report.subagents.found += agents.length;
      for (const agent of agents) {
        if (agent.meta === null) report.subagents.unlinked += 1;
        const fingerprint = knownAgents.get(agent.agentId);
        if (
          options.full !== true && fingerprint !== undefined
          && fingerprint.bytes === agent.bytes && fingerprint.mtimeMs === agent.mtimeMs
        ) {
          report.subagents.skipped += 1;
          continue;
        }

        const previous = fingerprint === undefined || options.full === true
          ? null
          : index.getSubagent(agent.agentId);
        // The session path's five conditions, less the one that cannot apply:
        // there is no custom title to have hidden an `ai-title`, because a
        // subagent transcript carries no `ai-title` at all (measured: 0 across
        // 99,760 records). The other four are the ways a cheap read would be
        // WRONG rather than merely skippable, and they are unchanged.
        const appendable = previous !== null
          && previous.scannedBytes === previous.bytes
          && agent.bytes > previous.bytes
          && previous.bytes < cap
          && lineStartsAt(agent.file, previous.bytes);

        const tail = appendable && previous !== null
          ? scanTranscript(agent.file, cap - previous.bytes, previous.bytes)
          : null;
        const scan = tail !== null && previous !== null
          ? mergeScan(previous, tail, null)
          : scanTranscript(agent.file, cap);

        index.upsertSubagent({
          agentId: agent.agentId,
          // **From the DIRECTORY, not from the records.** The two agree here —
          // 99,760 of 99,760 records carry this same session — but the
          // directory is the fact that made the file reachable at all, and a
          // row filed under a `sessionId` a record claimed would be a row the
          // walk that found it could not find again.
          sessionId,
          parentAgentId: agent.meta?.parentAgentId ?? null,
          toolUseId: agent.meta?.toolUseId ?? null,
          agentType: agent.meta?.agentType ?? null,
          description: agent.meta?.description ?? null,
          model: agent.meta?.model ?? null,
          spawnDepth: agent.meta?.spawnDepth ?? 0,
          isFork: agent.meta?.isFork ?? false,
          file: agent.file,
          bytes: agent.bytes,
          mtimeMs: agent.mtimeMs,
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
          scannedAt: new Date().toISOString(),
        });

        if (tail !== null) {
          report.subagents.appended += 1;
          report.subagents.bytesRead += tail.scannedBytes;
        } else {
          report.subagents.scanned += 1;
          report.subagents.bytesRead += scan.scannedBytes;
        }
        if (scan.scannedBytes < agent.bytes) report.subagents.truncated.push(agent.agentId);
      }
      report.subagents.removed += index.removeMissingSubagents(
        sessionId, new Set(agents.map((a) => a.agentId)),
      );
    };

    // One transaction for the whole run, for `rebuild.ts`'s measured reason:
    // per-statement WAL flushes dominate a batch of small writes.
    index.transaction(() => {
      for (const file of files) {
        // **Before the skip, not after it.** A session whose own transcript is
        // byte-for-byte unchanged can still have gained a lane — a subagent
        // writes its own file, and the parent's Stop hook is what indexes it,
        // so the two do not move together. Skipping the lanes of an unchanged
        // session would mean a lane dispatched by a session that has since
        // ended is never indexed at all. It costs a `readdir` and one `stat`
        // per lane: 5.06 ms for all 253 measured here, against 1,577 ms to
        // read them.
        scanSubagents(file.sessionId);

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
          ? mergeScan(previous, tail, previous.titleSource === 'ai' ? previous.title : null)
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
