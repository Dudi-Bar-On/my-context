/**
 * **`GET /api/conversations` and `GET /api/conversations/:id` — the archive
 * over HTTP, bounded and read-only.**
 *
 * `plan:archive seq:2`, step 2 of five in
 * `docs/superpowers/specs/2026-09-04-conversation-archive-design.md`.
 *
 * ── ITS OWN MODULE, FOR `read-model-staging.ts`'s MEASURED REASON ──────────
 *
 * `read-model.ts` reaches `doctor/checks.ts`, which imports
 * `node:child_process`, and it is four thousand lines that three lanes edit.
 * Serving from there would put a process spawner into the graph and collide
 * with work in flight. `read-model-command.ts` and `read-model-staging.ts` are
 * the precedent — same reason, same shape, a `register*Routes` called from
 * `registerReadRoutes` — and this follows it down to spelling `badRequest`
 * and the parameter refusal locally rather than importing five lines and the
 * spawner behind them.
 *
 * The runtime graph here is exactly two project files: this one and
 * `core/conversation-index.ts`, which imports no project module at all —
 * only `node:sqlite`, `node:fs`, `node:os` and `node:path`.
 * `test/ui/conversations-endpoint.test.ts` walks it and fails if a writer, the
 * CLI entry or a process spawner ever becomes reachable, with a control that
 * proves the walk can still FAIL.
 *
 * ── IT CANNOT BUILD WHAT IT READS, AND THAT IS THE POINT ───────────────────
 *
 * `ConversationIndex.open` creates tables, which is a write. This module binds
 * only `openReadOnlyChecked`, which creates nothing. So an archive nobody has
 * scanned is served as the EMPTY STATE with the command that would fill it —
 * composed, never run, exactly as the Doctor screen composes `mycontext ack`.
 * A read surface that quietly built its own index would be the read-only
 * guarantee failing at the one place a new feature most wants to break it.
 *
 * ── AND SO IT MUST SAY HOW FAR BEHIND IT IS ───────────────────────────────
 *
 * The consequence of the paragraph above went unnoticed for a day. Nothing but
 * a person typing the rebuild command had EVER refreshed this index, so the
 * screen served rows scanned on 2026-09-07T04:03 while the transcript beneath
 * them had grown 11,231,042 bytes past. Every count and every end time on this
 * list was of a file that had since moved on — 460 prompts against 557, and an
 * end time a day and a half early. **A cache that is behind and does not say
 * so is how that stayed invisible**, and `staleBytes` on every row is the
 * answer.
 *
 * The blast radius is worth stating exactly, because it is narrower than it
 * looks and the narrowness is load-bearing: `read-model-conversation-document.
 * ts` walks the FILE for its records and takes `bytes` from a `stat`, so the
 * document a reader opens is current whatever the row says. What was stale is
 * the LIST — these counts, these end times — and the title and branch the
 * document borrows from the row. Nothing anybody read was fabricated; it was
 * measured, and then it was old.
 *
 * It is affordable HERE, on the read surface, for one reason: `summarise`
 * already stats each transcript to answer `present`, and the same `stat`
 * carries the size. So the archive reports its own staleness for 0.449 ms over
 * the whole directory (measured 2026-09-08) and without opening one transcript
 * — which is what makes disclosure compatible with a surface that may not
 * write. The REFRESH itself is somebody else's: `hooks/stop.ts` runs it once
 * per assistant turn, because a read surface that repaired its own cache would
 * be exactly the read-only guarantee failing where a new feature most wants it
 * to.
 *
 * ── THE BOUNDS, AND WHY A NAIVE READ HERE IS A REAL HAZARD ─────────────────
 *
 * Measured on this project's own transcript, 2026-09-07: **52,061,736 bytes**,
 * 22,884 records — four times the 13 MB the design was written against three
 * days earlier. `GET /api/conversations/:id` handing back a whole session is
 * the "way to take the server down by clicking a link" the item names, and it
 * is not hypothetical at that size.
 *
 * Three bounds, each disclosed in the body rather than implied:
 *
 *   - `RECORD_CAP` records per answer. `total`, `omitted` and `more` say what
 *     is past the window, in `/api/coverage`'s vocabulary.
 *   - `TEXT_CAP` characters per record. A longer turn is sliced and the record
 *     carries `textTruncated` with its real length, so a clipped message and a
 *     short one never look the same.
 *   - `WALK_CAP` bytes of file walked per request. A window that starts past
 *     it is refused with `uncounted` naming the bound — an honest "I did not
 *     look that far" rather than an empty page that reads as the end.
 *
 * `INV-nothing-is-dropped-silently` is the standard all three answer to, and
 * the reason each is a FIELD rather than a sentence in a comment.
 */
import {
  ConversationIndex, ConversationIndexIncompleteError, ConversationIndexUninitializedError,
  classifyTurn, spanMs, staleBy, transcriptDir, truncatedScan,
  type ConversationRow, type PersistedRow, type SubagentRow,
} from '../core/conversation-index.ts';
import { readRedactionPlan } from '../core/conversation-redaction.ts';
import {
  SECRET_SHAPES, scanSessionSecrets, type SecretCandidate,
} from '../core/conversation-secrets.ts';
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { zoneIsKnown, zonedDay } from './zoned-day.ts';

/**
 * `badRequest`, `unknownParams` and `repeatedParams` are spelled here rather
 * than imported from `read-model.ts`, for the reason `read-model-staging.ts`
 * measured and wrote down: importing them would put `node:child_process` into
 * this module's graph through `doctor/checks.ts`. The wording is
 * `read-model.ts`' verbatim so a reader meets one sentence and not two.
 */
const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

function unknownParams(url: URL, allowed: string[]): string | null {
  const accepts = allowed.length === 0
    ? 'this endpoint accepts no parameters'
    : `this endpoint accepts: ${allowed.join(', ')}`;
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — ${accepts}. ` +
        'A parameter accepted and ignored would silently answer a different question.';
    }
  }
  return null;
}

function repeatedParams(url: URL): string | null {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) {
      return `parameter "${key}" was given more than once. Only the first value would be ` +
        'read, so the rest would be silently discarded; pass it exactly once.';
    }
    seen.add(key);
  }
  return null;
}

/**
 * `undefined` = not asked, `null` = asked and not something this endpoint can
 * act on, else the number. **Digits only**, deliberately: `Number(raw)` accepts
 * `' 2 '`, `'1e1'`, `'0x10'` and `'+5'`, and reads `''` as `0`, which turns
 * `?limit=` into an empty page nobody requested. `read-model.ts`'
 * `boundedDigits` is the same three-state parse for the same reason.
 */
function boundedDigits(url: URL, name: string): number | null | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The directory Claude Code encodes into a transcript folder name — the
 * REPOSITORY root, not `ws.projectRoot`.
 *
 * `ws.projectRoot` is the `.my_context` directory (`core/workspace.ts` sets
 * `dbPath` to `path.join(projectRoot, '.index.db')`, and the index lives at
 * `.my_context/.index.db`). Encoding that would name a folder one level too
 * deep and report an empty archive next to a full one. Found by driving the
 * screen in a browser; every assertion passed first.
 *
 * Derived from the corpus rather than from `process.cwd()` so this and
 * `mycontext conversation rebuild` cannot disagree about which project's
 * transcripts they mean, whichever directory either was launched from.
 *
 * **Exported for `read-model-conversation-document.ts` rather than copied
 * there.** It is one derivation with a defect already paid for once — the
 * `.my_context` directory encoded as the project name, found by driving the
 * screen after every assertion had passed — and a second spelling of it would
 * be a second chance to make that mistake, in a module whose answer the first
 * one would not contradict until a reader noticed two screens disagreeing.
 */
export function workspaceCwd(ws: Workspace): string {
  return ws.projectRoot === null ? process.cwd() : path.dirname(ws.projectRoot);
}

/** How many indexed sessions one list answer carries before it says it stopped. */
export const CONVERSATION_LIST_CAP = 200;
/** How many transcript records one answer carries. */
export const CONVERSATION_RECORD_CAP = 200;
/** The window a caller gets without asking for one. */
export const CONVERSATION_RECORD_DEFAULT = 50;
/**
 * Characters of one record's rendered text. 20,000 is roughly six thousand
 * words — longer than any turn a person reads in one piece, and far short of
 * the 91 MB of tool output one session's `tool-results/` directory held when
 * this was measured.
 */
export const CONVERSATION_TEXT_CAP = 20_000;
/**
 * How far into a transcript ONE request will walk to reach its window.
 *
 * There is no byte offset to seek to: records are variable-length JSONL lines,
 * so reaching record 5,000 means reading past the first 4,999. An offset index
 * would fix that and would be a second store of conversation text, which the
 * item forbids in the same breath as it asks for the bound.
 *
 * 64 MiB is above the largest transcript measured here (52 MB) and costs about
 * half a second at the measured 376 ms per 52 MB. A window starting past it is
 * REFUSED with the bound named, never served as an empty page.
 */
export const CONVERSATION_WALK_CAP = 64 * 1024 * 1024;

const CHUNK_BYTES = 1024 * 1024;

/** One indexed session as the list serves it. */
export interface ConversationSummary {
  sessionId: string;
  source: string;
  title: string | null;
  titleSource: string | null;
  startedAt: string | null;
  endedAt: string | null;
  prompts: number;
  answers: number;
  machinery: number;
  records: number;
  unreadable: number;
  branch: string | null;
  bytes: number;
  scannedBytes: number;
  /** The scan hit its cap, so every count above is a floor. */
  scanTruncated: boolean;
  /**
   * The transcript is still on disk.
   *
   * `false` is a session whose file has been deleted SINCE THE LAST REBUILD.
   * The spec wanted such a row kept for ever and the owner ruled against it
   * (`plan:archive seq:11`): `removeMissing` drops it on the next rebuild, and
   * the archive holds only sessions that still exist.
   *
   * That ruling also called this field dead code, and that part of it was
   * wrong. `removeMissing` runs on a REBUILD; this is served BETWEEN rebuilds
   * from a `stat` taken at request time, so the state is reachable for exactly
   * as long as the window between a file being deleted and the next assistant
   * turn — `conversations-endpoint.test.ts` · `a transcript deleted between two
   * rebuilds` constructs it. What the field means is therefore narrower than
   * the spec's "the list shows pruned sessions" and wider than the ruling's
   * "this cannot happen": it is the one-turn disclosure, and the screen says so
   * in those words.
   */
  present: boolean;
  /**
   * The transcript's size ON DISK NOW, from the same `stat` that answered
   * `present` — not the size the row was scanned at, which is `bytes`. `null`
   * when the file is gone.
   */
  fileBytes: number | null;
  /** When the transcript was last written, from that same `stat`. `null` when gone. */
  fileMtimeMs: number | null;
  /**
   * **Bytes of this session's transcript the index has never read.**
   *
   * `0` means the row is current. Anything else is the defect this feature was
   * built for, measured rather than suspected: on 2026-09-08 this field would
   * have read **11,231,042** for the owner's live session while the screen
   * drew its counts as though they were totals.
   *
   * It costs NOTHING to serve. `summarise` already stats every row's file to
   * answer `present`, and that one `stat` carries the size — so the archive can
   * say how far behind it is without opening a transcript, which is precisely
   * what makes the disclosure affordable on a read-only surface that may not
   * rebuild anything.
   */
  staleBytes: number;
  /**
   * **How many subagent transcripts this session owns** — `plan:archive
   * seq:12`, and the count is the whole argument for the feature.
   *
   * Measured on this workspace, 2026-09-08: 253 lanes and 615.3 MB against a
   * 65 MB session. The session holds each lane's REPORT; those files hold its
   * REASONING, and until now the archive saw none of them.
   *
   * `0` is a measured zero — a session that dispatched no lanes — and not an
   * absence: every row on this list carries the number.
   */
  subagents: number;
  /**
   * **How many of those lanes can still be OPENED** — `plan:archive seq:35`.
   *
   * `subagents` counts the rows the index holds; this counts the ones whose
   * transcript is on disk right now. The two differ for exactly one reason and
   * it is deliberate: a pruned session's lane rows are KEPT — the item rules
   * that sweeping them discards the only remaining record that those lanes
   * ever ran — so a row can name a lane nothing can open, and the number of
   * rows would otherwise be read as a number of readable things.
   *
   * Both are served rather than one being corrected into the other, which is
   * the decision `bytes` and `fileBytes` above already embody: what the
   * recording says and what the archive holds are two facts, and a screen that
   * had only the second could not say that anything was missing.
   *
   * Equal to `subagents` in the ordinary case, and measured equal on this
   * workspace 2026-09-09 (268 rows, 268 openable) — the defect is reachable,
   * not yet reached here. `openableLanes` carries what the count costs.
   */
  openableSubagents: number;
  /**
   * **How long this session lasted, in milliseconds** — `plan:archive seq:10`,
   * whose spec clause names duration in the list's columns.
   *
   * `null` when either stamp is missing or they run backwards; `spanMs` in
   * `core/conversation-index.ts` carries the whole argument for the three
   * answers and for why the arithmetic lives there rather than on the screen.
   *
   * For a session still being written this is a FLOOR, for the reason every
   * other number on this row is one: `endedAt` is the last record the SCAN
   * read. Nothing new is added to say so — `staleBytes` beside it is already
   * non-zero for exactly those rows, and the screen marks the duration with
   * the disclosure it already draws rather than inventing a second.
   */
  durationMs: number | null;
  /**
   * **How many of this session's lanes matched the search term**, or `null`
   * when no term was given.
   *
   * `null` and `0` are different facts and both occur: `null` is "nothing was
   * searched for", and `0` is "this session is on the list because its own
   * title, branch or id matched, and none of its lanes did"
   * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). A row
   * that reached the list only through its lanes carries a positive count, and
   * that count is the only thing on the row that explains why it is there.
   */
  matchedLanes: number | null;
  /**
   * **How much of this session the copy outside the project holds** —
   * `plan:archive seq:4`, `null` when the session is not being kept.
   *
   * `null` and a number are different facts and the screen must not blur them
   * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`): `null`
   * is "nobody asked for this to be kept", and a number is a measured length.
   * With `fileBytes` beside it — the same `stat` that answered `present` — the
   * reader can see whether the copy is CURRENT with the file or behind it,
   * which is the difference `seq:5` requires never to blur.
   *
   * On a row whose `source` is `'exported'` the two are the same file, so the
   * difference is zero by construction and the screen says the original is
   * gone rather than that the copy is current.
   */
  keptBytes: number | null;
  /** When the copy last caught up, or `null` when the session is not kept. */
  keptAt: string | null;
  /**
   * Why the copy stopped keeping up, or `null` while it is keeping up. A copy
   * that can no longer follow its file must not look finished —
   * `INV-nothing-is-dropped-silently`.
   */
  keptNote: string | null;
  scannedAt: string;
}

/** What the caller asked the list to narrow to, echoed back verbatim. */
export interface ConversationFilter {
  /** The search term, or `null` when none was given. */
  q: string | null;
  /** An exact branch, or `null`. */
  branch: string | null;
  /** `YYYY-MM-DD`, inclusive from the start of that day, or `null`. */
  since: string | null;
  /** `YYYY-MM-DD`, inclusive through the end of that day, or `null`. */
  until: string | null;
  /**
   * **The zone those two days are days OF**, as an IANA name the caller sent,
   * or `null` when it sent none and the bounds were therefore read in UTC —
   * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`.
   *
   * Echoed for the same reason every other clause here is: a narrowed list
   * that cannot say what it narrowed by is a list a reader reads as the whole
   * archive. It is also what lets the screen NAME the clock its dates were
   * counted in, which is `seq:18`'s standing rule applied to a control instead
   * of to a stamp.
   */
  tz: string | null;
}

export interface ConversationListBody {
  conversations: ConversationSummary[];
  /**
   * Indexed sessions in total, however few this page carries **and whatever
   * the filter left out**. It is the size of the archive, not the size of the
   * answer — `matching` is that — so a reader who has narrowed to one row can
   * still see how much they narrowed from.
   */
  total: number;
  /**
   * Indexed sessions that pass the filter. Equal to `total` when nothing was
   * asked for, which is why `conversations.length + omitted === total` still
   * holds on an unfiltered answer.
   */
  matching: number;
  /** What the answer was narrowed by, echoed so the screen can prove it. */
  filter: ConversationFilter;
  /**
   * Every branch the ARCHIVE holds a session from — not just the ones on this
   * page, and not narrowed by the filter, because a branch chooser that
   * dropped the branch you are filtering by would be a control that erases
   * itself on first use.
   */
  branches: string[];
  /**
   * Sessions a date bound excluded for carrying **no end time at all**, rather
   * than for falling outside the range.
   *
   * A transcript with no timestamp cannot be placed on either side of a date,
   * so it is left out — and that is a drop, which under
   * `INV-nothing-is-dropped-silently` has to be counted where the reader can
   * see it. `0` when no date bound was asked for, and `0` is then a fact about
   * a filter that excluded nothing rather than a check that did not run.
   */
  undated: number;
  limit: number;
  offset: number;
  /** Indexed sessions this answer does not carry — before AND after the page. */
  omitted: number;
  /** A further page exists. */
  more: boolean;
  /**
   * `false` means nobody has ever scanned in this workspace. It is a state,
   * not a failure, and it is distinguishable from an archive that is genuinely
   * empty (`indexed: true, total: 0`) — which is the difference between "run
   * this" and "there is nothing here".
   */
  indexed: boolean;
  /** Where transcripts are looked for, named even when nothing was found. */
  dir: string;
  /** The command that fills the index. Composed, never run — the UI cannot write. */
  rebuild: string;
  /** Indexed sessions whose transcript has since been pruned from disk. */
  missing: number;
  /**
   * Sessions on this page whose transcript has grown past their row.
   *
   * Counted over the PAGE and not over the archive, which is `missing`'s rule
   * and it is here for `missing`'s reason: `summarise` is what stats a file,
   * and it runs on the rows this answer carries. A number counted over rows
   * nobody stat'd would be an estimate wearing a count's clothes.
   */
  stale: number;
  /** Bytes those sessions have appended since they were indexed. */
  staleBytes: number;
  /**
   * `indexed: false` because the index is a SCHEMA BEHIND, not because nothing
   * has been scanned — `plan:archive seq:12`.
   *
   * The two states are both "no rows to serve" and they are opposite facts
   * about the reader's archive: one has nothing in it and the other is full
   * and momentarily unreadable. Measured on the owner's running server,
   * 2026-09-08, where the second was reported as a raw refusal and the screen
   * drew no files. It repairs itself on the next assistant turn, so the
   * honest line is "one moment", not "run this".
   */
  outdated?: boolean;
}

/**
 * **How many of each session's indexed lanes can still be OPENED** —
 * `TASK-a-pruned-session-s-lane-rows-are-never-swept-so-an-exported`,
 * `plan:archive seq:35`.
 *
 * ── THE FACT IT SERVES, AND WHY THE ROW COUNT IS NOT IT ───────────────────
 *
 * `ConversationSummary.subagents` counts ROWS. A row outlives the file it
 * names: `removeMissingSubagents` is scoped to one session for a reason its
 * own docblock argues (a rebuild lists only the `subagents/` directories of
 * the sessions it FOUND, so sweeping globally would delete every lane of a
 * session whose transcript had just been pruned), and a PERSISTED session is
 * now spared by `removeMissing` — so its lane rows stay beside it for ever and
 * may name files deleted at any point since. The list row then says "N helper
 * agents" about lanes none of which can be opened. The item's words: the
 * number is true of the recording and false of what the archive holds.
 *
 * The item names three answers and rules on them: (a) sweep those rows on the
 * pass that orphans the session — cheap, and it "discards the only remaining
 * record that those lanes ever ran"; (b) keep them and let the row say how
 * many are still openable; (c) grow the mirror to include lanes, measured and
 * REJECTED at 615.3 MB of lanes against 65 MB of session. **(b) drops
 * nothing**, and the item made it conditional on a cost nobody had measured.
 *
 * ── THE MEASUREMENT THAT DECIDED IT, 2026-09-09, 268 LANES / 2 SESSIONS ───
 *
 *     GET /api/conversations as it stands            p50 4.024 ms
 *     one `stat` per lane, as the item proposed      p50 3.704 ms   (+92%)
 *     one `readdir` per lane DIRECTORY, as built     p50 0.991 ms   (+25%)
 *     the grouped row count alone, today's cost      p50 0.024 ms
 *
 * Both answers agreed exactly on this workspace (267 and 1 openable). So (b)
 * is affordable and is built — at a QUARTER of the price the item quoted for
 * it, because the cost it feared is per-lane and this one is per-directory.
 *
 * ── WHY A DIRECTORY LISTING RATHER THAN A `stat` PER LANE ─────────────────
 *
 * Every lane of a session lives in that session's one `subagents/` directory,
 * so one `readdir` answers for all of them at once and the per-lane work drops
 * to a `Set` lookup: 2.2 µs per lane against 12–17 µs. It is also the same
 * question `countSubagentFiles` already answers this way for the status line,
 * with the same rule — **top-level `*.jsonl` only, the extension test alone**
 * — which is why the presence test here is membership of the listing rather
 * than a second, subtly different notion of what an openable lane is.
 *
 * What it costs in precision is stated: a directory entry that is not a
 * readable file would be counted here and refused by `summariseSubagent`'s
 * `stat` one screen down. Nothing on disk has ever been in that state, the
 * roster the reader opens next re-checks every row with a real `stat`, and the
 * alternative was to pay four times the price on every list request for a
 * distinction no measurement has ever shown.
 *
 * A directory that cannot be read at all is ZERO openable and not an absence,
 * which is `countSubagentFiles`' contract for the same reason: a session that
 * dispatched no lanes has no `subagents/` directory, that is a measured zero,
 * and neither caller can act on the difference between that and a directory
 * refusing to be read.
 */
function openableLanes(files: Map<string, string[]>): Map<string, number> {
  const listings = new Map<string, Set<string>>();
  const listing = (dir: string): Set<string> => {
    const known = listings.get(dir);
    if (known !== undefined) return known;
    let names: Set<string>;
    try {
      names = new Set(readdirSync(dir));
    } catch {
      names = new Set();
    }
    listings.set(dir, names);
    return names;
  };

  const open = new Map<string, number>();
  for (const [sessionId, paths] of files) {
    let found = 0;
    for (const file of paths) {
      if (listing(path.dirname(file)).has(path.basename(file))) found += 1;
    }
    open.set(sessionId, found);
  }
  return open;
}

/**
 * One row, plus what a `stat` of its transcript says about it NOW.
 *
 * **The stat was already here** — `present` has always needed it — and it has
 * always thrown away the two numbers that say whether the row is current. That
 * is not a small oversight in hindsight: it is why an index over a day stale
 * could be served for a day with no surface anywhere able to notice. The stat
 * is now read for all three facts rather than for one.
 */
function summarise(
  row: ConversationRow, subagents: number, openableSubagents: number,
  matchedLanes: number | null, kept: PersistedRow | null = null,
): ConversationSummary {
  let present = false;
  let fileBytes: number | null = null;
  let fileMtimeMs: number | null = null;
  try {
    const stat = statSync(row.file);
    present = stat.isFile();
    if (present) {
      fileBytes = stat.size;
      fileMtimeMs = Math.floor(stat.mtimeMs);
    }
  } catch {
    present = false;
  }
  return {
    sessionId: row.sessionId,
    source: row.source,
    title: row.title,
    titleSource: row.titleSource,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    prompts: row.prompts,
    answers: row.answers,
    machinery: row.machinery,
    records: row.records,
    unreadable: row.unreadable,
    branch: row.branch,
    bytes: row.bytes,
    scannedBytes: row.scannedBytes,
    scanTruncated: truncatedScan(row),
    present,
    fileBytes,
    fileMtimeMs,
    staleBytes: staleBy(row, fileBytes),
    subagents,
    openableSubagents,
    durationMs: spanMs(row),
    matchedLanes,
    keptBytes: kept === null ? null : kept.bytes,
    keptAt: kept === null ? null : kept.mirroredAt,
    keptNote: kept === null ? null : kept.note,
    scannedAt: row.scannedAt,
  };
}

/**
 * A free-text parameter, or the refusal that names why.
 *
 * `undefined` = not asked. A present-but-EMPTY value is a 400 rather than a
 * silent "no filter", for `unknownParams`' own stated reason: `?q=` is a
 * caller asking a question, and answering the unfiltered one instead would be
 * this endpoint silently answering something else. The bound is a bound
 * because a `LIKE '%…%'` pattern is built from it.
 */
function textParam(url: URL, name: string, cap: number): string | null | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  const value = raw.trim();
  if (value === '' || value.length > cap) return null;
  return value;
}

/**
 * A `YYYY-MM-DD` bound, or the refusal.
 *
 * A DATE and not a timestamp, deliberately. The stamps in the index are UTC
 * instants and the reader's question is "which day was that session" in their
 * own clock — a distinction this product has already paid for once
 * (`TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`).
 *
 * ── WHAT `plan:archive seq:10` COMPARED, AND WHY IT WAS CHANGED ───────────
 *
 * It compared this against the stored ISO stamp as a STRING PREFIX, with no
 * zone arithmetic anywhere, and said so rather than hiding it: the alternative
 * looked like the server guessing an offset it does not have. The cost was
 * stated too — "a reader in UTC+11 asking for one day gets the UTC day".
 *
 * That cost turned out to be a DEFECT ONE ROW UP. `seq:18` had already moved
 * every stamp on this screen into the reader's clock and named it, so the list
 * drew `2026-09-08 01:00 GMT+3` on a row that this filter filed under
 * `2026-09-07`. A control and the column above it giving different answers to
 * "which day is this" is not a documented limitation; it is the same shape as
 * the three-hours-missing report that produced `seq:18`.
 *
 * **The server still guesses nothing.** The zone arrives in `tz`, from the
 * only party that knows it — the browser that is already rendering in it. See
 * `zoneParam` and `zonedDay`.
 */
function dateParam(url: URL, name: string): string | null | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

/**
 * The IANA zone the date bounds are days of, or the refusal.
 *
 * ── AN IANA NAME AND NEVER AN OFFSET ──────────────────────────────────────
 *
 * A caller could send `+03:00` in a third of the characters, and it would be
 * wrong for half of every year. `Asia/Jerusalem` — the owner's own — is GMT+2
 * in January and GMT+3 in July, so an instant at `21:30Z` falls on the 15th
 * under one and the 16th under the other. A NAME carries the transitions; an
 * offset carries one side of them. `Intl` is what knows the difference, and
 * `zonedDay` is where it is asked.
 *
 * ── AND IT IS REFUSED THE WAY EVERY OTHER CLAUSE IS ───────────────────────
 *
 * `seq:10`'s rule, restated by the item that asked for this: *"do not regress
 * the refusal … whatever shape carries the zone must be refused the same way
 * when it is wrong."* An empty `tz` is a caller asking about a zone and being
 * answered about UTC; an unknown one would silently become the SERVER's zone,
 * which is the exact substitution this whole item exists to end.
 *
 * `undefined` — not sent at all — is UTC, which is what this endpoint has
 * always done and what a caller with no clock of its own (a script, `curl`)
 * still means. It is not refused, because it is not wrong; it is simply the
 * bound read in the one zone that needs no reader.
 */
function zoneParam(url: URL): string | null | undefined {
  const raw = url.searchParams.get('tz');
  if (raw === null) return undefined;
  if (raw === '' || raw.length > 64) return null;
  // **AND AN OFFSET IS REFUSED EVEN THOUGH `Intl` WOULD TAKE IT.** ECMA-402
  // accepts `+03:00` as a time zone identifier, and it would work — for half
  // the year, on the owner's own clock, failing silently at exactly the day
  // boundary this endpoint is being asked about. A caller sending one has
  // already thrown away the transitions, and there is no way for this side to
  // tell that from a caller who meant the zone. So it is a refusal with the
  // reason in it, not a quiet acceptance.
  if (/^[+-]/.test(raw) || !zoneIsKnown(raw)) return null;
  return raw;
}

/** The longest search term this endpoint will build a pattern from. */
export const CONVERSATION_QUERY_CAP = 200;

/**
 * **What a session's own row offers a search** — its title, its branch and its
 * id, and nothing else.
 *
 * Not its transcript. `ConversationIndex.subagentMatches` carries the
 * measurement that decided it: 0.076 ms to search the index against 647 ms for
 * a warm `grep` over the 889,365,963 bytes of transcript the same two sessions
 * and 259 lanes occupy on this machine. The screen says which of the two it
 * did, in `conv.searchScope`, because a search box that quietly searched less
 * than a reader assumed is how a real match gets read as an absence.
 *
 * The id is included because it is what every other surface addresses a
 * session by — the URL, `mycontext conversation subagents <session>`, the
 * terminal's own eight-character column — so a reader holding one from
 * somewhere else can paste it here.
 */
function rowMatches(row: ConversationRow, needle: string): boolean {
  const hay = [row.title, row.branch, row.sessionId];
  return hay.some((v) => v !== null && v.toLowerCase().includes(needle));
}

const REBUILD_COMMAND = 'mycontext conversation rebuild';

/**
 * `GET /api/conversations` — **the list, and since `plan:archive seq:10` a
 * BROWSABLE one.**
 *
 * The item found this endpoint accepting `limit` and `offset` only and
 * actively refusing anything else, "so this cannot be added client-side and
 * the endpoint must move first". It has moved: `q`, `branch`, `since` and
 * `until`, each refused when malformed rather than accepted and ignored.
 *
 * **The narrowing is done HERE and not in the browser**, which is a choice
 * with a reason rather than a habit. `subagentMatches` is a grouped SQL query
 * over 259 lane rows — the half of the search that finds the sessions a reader
 * is actually looking for — and shipping 259 lane descriptions to the client
 * on every page load to filter them there would be moving the data to the code
 * instead of the question to the data. The unfiltered path is unchanged and
 * costs what it always did.
 */
export function apiConversations(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['limit', 'offset', 'q', 'branch', 'since', 'until', 'tz'])
    ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  const askedLimit = boundedDigits(url, 'limit');
  if (askedLimit === null) {
    return badRequest('limit must be a whole number of rows, written in digits.');
  }
  const askedOffset = boundedDigits(url, 'offset');
  if (askedOffset === null) {
    return badRequest('offset must be a whole number of rows, written in digits.');
  }
  const askedQuery = textParam(url, 'q', CONVERSATION_QUERY_CAP);
  if (askedQuery === null) {
    return badRequest(
      `q must be between 1 and ${CONVERSATION_QUERY_CAP} characters. An empty q would be a `
      + 'search nobody asked for, answered as though nothing had been typed.',
    );
  }
  const askedBranch = textParam(url, 'branch', CONVERSATION_QUERY_CAP);
  if (askedBranch === null) {
    return badRequest(
      `branch must be between 1 and ${CONVERSATION_QUERY_CAP} characters, and is matched whole `
      + '— it is chosen from the branches this archive holds, not typed.',
    );
  }
  const askedSince = dateParam(url, 'since');
  if (askedSince === null) {
    return badRequest('since must be a date written YYYY-MM-DD.');
  }
  const askedUntil = dateParam(url, 'until');
  if (askedUntil === null) {
    return badRequest('until must be a date written YYYY-MM-DD.');
  }
  const askedZone = zoneParam(url);
  if (askedZone === null) {
    return badRequest(
      'tz must be an IANA time zone name this runtime knows, such as Asia/Jerusalem — not a '
      + 'fixed offset, which cannot carry the transitions a day boundary turns on. Omit it and '
      + 'the date bounds are read in UTC.',
    );
  }
  const limit = Math.min(askedLimit ?? CONVERSATION_LIST_CAP, CONVERSATION_LIST_CAP);
  const offset = askedOffset ?? 0;
  const filter: ConversationFilter = {
    q: askedQuery ?? null,
    branch: askedBranch ?? null,
    since: askedSince ?? null,
    until: askedUntil ?? null,
    tz: askedZone ?? null,
  };
  const dir = transcriptDir(process.env, workspaceCwd(ws));

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    // **Both empty states, and they are the same answer to a reader.**
    //
    // `Uninitialized` is "nobody has ever scanned here". `Incomplete`
    // (`plan:archive seq:12`) is "this index was built before a table this
    // build reads existed" — which every workspace hits on upgrade day, and
    // which was measured hitting the owner's own running server on
    // 2026-09-08: the list drew no files and printed the raw refusal instead.
    //
    // Neither is damage and neither is this surface's to repair, because
    // creating a table is a write. So both are served as the empty state with
    // the rebuild COMPOSED beside it — the Doctor screen's rule, and the same
    // one this module already applied to the never-scanned case. `indexed`
    // reports which of the two, so the screen can say "run this" rather than
    // "there is nothing here".
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      // **A 200, not a 404 and not a 500.** The question was answered: this
      // workspace holds no conversation index. `server-e2e.test.ts` accepts
      // 200 and 404 and nothing else, and more importantly a reader needs the
      // difference between "nothing scanned" and "nothing there".
      const body: ConversationListBody = {
        conversations: [], total: 0, matching: 0, filter, branches: [], undated: 0,
        limit, offset, omitted: 0, more: false,
        indexed: false, dir, rebuild: REBUILD_COMMAND, missing: 0,
        stale: 0, staleBytes: 0,
        // An index a schema behind is a DIFFERENT empty state from one nobody
        // has scanned, and the screen must not tell a reader with a full
        // archive that nothing has ever been scanned. It heals itself on the
        // next assistant turn — `stopConversationRefresh` treats this state as
        // existing — so what the reader is owed is that sentence, not a
        // command they must type.
        outdated: err instanceof ConversationIndexIncompleteError,
      };
      return { status: 200, body };
    }
    throw err;
  }

  try {
    const all = index.all();
    // ONE grouped query for the whole archive rather than one per row. The
    // page is capped at 200 sessions and this workspace has 259 lanes under a
    // single one of them, so a per-row `COUNT(*)` would be 200 statements to
    // answer what one `GROUP BY` answers.
    const laneCounts = index.subagentCounts();
    const branches = index.branches();

    // ── THE NARROWING, AND WHAT EACH CLAUSE COSTS ─────────────────────────
    //
    // One further grouped query when a term was given, and nothing at all when
    // it was not — measured 0.076 ms over 259 lane rows on this workspace,
    // 2026-09-09. The session clauses are plain JavaScript over `all()`, which
    // is 0.025 ms for the whole table: pushing them into SQL would be a second
    // spelling of `all()`'s ordering for no measurable gain, and this way the
    // list has exactly one query that decides row order.
    const needle = filter.q === null ? null : filter.q.toLowerCase();
    const laneMatches = filter.q === null
      ? null
      : index.subagentMatches(filter.q);

    // ── WHICH DAY EACH ROW IS, COMPUTED ONCE, IN THE READER'S ZONE ────────
    //
    // `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`. The
    // day is `zonedDay`'s and nothing else's, because `zonedDay` is what draws
    // the date half of the stamp the screen puts on the same row — one
    // derivation with two readings rather than a filter and a column that can
    // come to different answers about the same session.
    //
    // `filter.tz ?? 'UTC'` is stated here rather than defaulted inside
    // `zonedDay`, because that function's `undefined` means "this runtime's
    // zone" and this runtime is the SERVER. A caller that named no zone gets
    // UTC — the endpoint's own long-standing answer — never the machine the
    // server happens to be on.
    //
    // ONE PASS over the table, kept in a Map, because `undated` is counted
    // over the whole archive while the branch and text clauses are not — two
    // walks over `all()` that would otherwise format every stamp twice.
    //
    // AND IT IS NOT FREE, so the number is here rather than assumed. Measured
    // 2026-09-10, best of nine, warm formatter: 0.009 ms over the 2 sessions
    // this workspace holds, 0.952 ms over 259 rows, 7.571 ms over 2,000 —
    // against the 4.024 ms `openableLanes` costs the whole request. It is paid
    // ONLY when a bound was asked for; an unfiltered list does not build the
    // map at all, which is why `dated` gates the loop rather than the lookup.
    //
    // A date bound cannot place a row with no end time — and cannot place one
    // whose stamp is not an instant either, which `zonedDay` reports as `null`
    // rather than guessing. Both are DROPPED rather than kept-because-unknown,
    // and counted so the drop is visible — `INV-nothing-is-dropped-silently`.
    // Counted only when a bound was asked for, so the number is never a
    // comment on a filter nobody set.
    const dated = filter.since !== null || filter.until !== null;
    const zone = filter.tz ?? 'UTC';
    const dayOf = new Map<string, string | null>();
    if (dated) {
      for (const row of all) {
        dayOf.set(row.sessionId, row.endedAt === null ? null : zonedDay(row.endedAt, zone));
      }
    }
    const undated = dated
      ? all.filter((r) => (dayOf.get(r.sessionId) ?? null) === null).length
      : 0;

    const matched = all.filter((row) => {
      if (filter.branch !== null && row.branch !== filter.branch) return false;
      if (dated) {
        // Both bounds compare `YYYY-MM-DD` against `YYYY-MM-DD`, so both are
        // INCLUSIVE of their whole day by construction — the item's first
        // requirement, and the edge it names: an off-by-one at `until` hides
        // the newest day, which is the day anybody filtering most wants.
        const day = dayOf.get(row.sessionId) ?? null;
        if (day === null) return false;
        if (filter.since !== null && day < filter.since) return false;
        if (filter.until !== null && day > filter.until) return false;
      }
      if (needle !== null) {
        const lanes = laneMatches?.get(row.sessionId) ?? 0;
        if (!rowMatches(row, needle) && lanes === 0) return false;
      }
      return true;
    });

    const page = matched.slice(offset, offset + limit);
    // The standing marks, read once for the whole page rather than per row:
    // `plan:archive seq:4` puts at most a handful of rows in this table, and a
    // query per session would be a cost proportional to the LIST for a fact
    // proportional to the marks.
    const kept = new Map(index.persisted().map((mark) => [mark.sessionId, mark]));
    // **HOW MANY OF EACH ROW'S LANES CAN STILL BE OPENED** — `plan:archive
    // seq:35`, and it is counted over the PAGE for `missing`'s reason: the
    // filesystem is only asked about rows this answer carries, so no number
    // here is an estimate about rows nobody looked at. One query bounded to
    // the page's sessions, then one directory listing per session — measured
    // p50 0.991 ms over 268 lanes against 4.024 ms for the whole request, and
    // `openableLanes` carries why it is not the per-lane `stat` the item
    // costed.
    const laneOpenable = openableLanes(index.subagentFilesOf(page.map((r) => r.sessionId)));
    const conversations = page.map((row) => summarise(
      row,
      laneCounts.get(row.sessionId) ?? 0,
      laneOpenable.get(row.sessionId) ?? 0,
      laneMatches === null ? null : (laneMatches.get(row.sessionId) ?? 0),
      kept.get(row.sessionId) ?? null,
    ));
    const body: ConversationListBody = {
      conversations,
      total: all.length,
      matching: matched.length,
      filter,
      branches,
      undated,
      limit,
      offset,
      // Every indexed session this answer does not carry — the ones `offset`
      // skipped AS WELL AS the ones past `limit`, so `conversations.length +
      // omitted` is the total and no second field can disagree with it.
      // `/api/coverage`'s rule, verbatim.
      // Counted against `matching` rather than `total`, so `conversations
      // .length + omitted` is the size of the ANSWER and no field disagrees
      // with another. On an unfiltered list the two are the same number, which
      // is why `/api/coverage`'s rule — that the two add up — still holds
      // exactly where it always did.
      omitted: matched.length - conversations.length,
      more: offset + conversations.length < matched.length,
      indexed: true,
      dir,
      rebuild: REBUILD_COMMAND,
      missing: conversations.filter((c) => !c.present).length,
      stale: conversations.filter((c) => c.staleBytes > 0).length,
      staleBytes: conversations.reduce((sum, c) => sum + c.staleBytes, 0),
    };
    return { status: 200, body };
  } finally {
    index.close();
  }
}

/** One record of a transcript, rendered for reading rather than for a machine. */
export interface ConversationRecordView {
  /** Position in the file, 0-based — the handle a window is asked for by. */
  index: number;
  /** The harness's own `type`. Unknown values are served, never dropped. */
  type: string;
  /**
   * `prompt`, `answer`, or `machinery` — the owner's requirement, and NOT
   * `message.role`. See `classifyTurn` for the measurement showing why the
   * spec's proposed field would have marked 2,504 tool results as prompts.
   */
  kind: 'prompt' | 'answer' | 'machinery';
  timestamp: string | null;
  /** What this record says, flattened to text and capped at `CONVERSATION_TEXT_CAP`. */
  text: string;
  /** The full length before the cap. Equal to `text.length` when nothing was cut. */
  totalChars: number;
  textTruncated: boolean;
  /** The tool this record calls, when it calls one. */
  tool: string | null;
  /**
   * The content block types this record carries, in first-seen order —
   * `text`, `thinking`, `tool_use`, `tool_result`, or whatever the harness
   * adds next.
   *
   * It exists because a folded machinery row has to SAY what it is, and the
   * two obvious labels are both wrong: `tool` is null for a tool result, and
   * `type` is the string `"user"` for one — which is the very confusion
   * `classifyTurn` was written to remove. Naming the blocks is the answer that
   * stays true when the schema gains a member.
   */
  blocks: string[];
  /** This line would not parse. Served as a record so the gap is visible. */
  unreadable: boolean;
}

export interface ConversationBody {
  sessionId: string;
  source: string;
  title: string | null;
  titleSource: string | null;
  branch: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** The transcript file. `present: false` is a pruned session, not an error. */
  present: boolean;
  bytes: number;
  records: ConversationRecordView[];
  offset: number;
  limit: number;
  /** Records in the file, or `null` when the walk stopped before the end. */
  total: number | null;
  /** Records not in this answer, or `null` when no total exists to subtract from. */
  omitted: number | null;
  more: boolean;
  /** The walk hit `CONVERSATION_WALK_CAP` before the file ended. */
  truncated: boolean;
  /** Why no total exists. `null` when the whole file was walked. */
  uncounted: string | null;
  /** Bytes of the file this request read. */
  walkedBytes: number;
  textCap: number;
}

/** Flatten one record's content to text, plus the tool it names if any. */
function renderContent(
  message: unknown,
): { text: string; tool: string | null; blocks: string[] } {
  if (typeof message !== 'object' || message === null) {
    return { text: '', tool: null, blocks: [] };
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return { text: content, tool: null, blocks: ['text'] };
  if (!Array.isArray(content)) return { text: '', tool: null, blocks: [] };

  const parts: string[] = [];
  const blocks: string[] = [];
  let tool: string | null = null;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as { type?: unknown; text?: unknown; name?: unknown; content?: unknown };
    if (typeof b.type === 'string' && !blocks.includes(b.type)) blocks.push(b.type);
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
    else if (b.type === 'thinking') {
      const thought = (b as { thinking?: unknown }).thinking;
      if (typeof thought === 'string') parts.push(thought);
    } else if (b.type === 'tool_use') {
      if (typeof b.name === 'string') tool = b.name;
    } else if (b.type === 'tool_result') {
      if (typeof b.content === 'string') parts.push(b.content);
      else if (Array.isArray(b.content)) {
        for (const inner of b.content) {
          if (typeof inner === 'object' && inner !== null
            && (inner as { type?: unknown }).type === 'text'
            && typeof (inner as { text?: unknown }).text === 'string') {
            parts.push((inner as { text: string }).text);
          }
        }
      }
    }
    // A block type this build does not know contributes no text and is not an
    // error: the transcript schema is the harness's and can gain members. It
    // is still NAMED in `blocks` above, so an unknown member shows up as
    // itself rather than as an empty fold.
  }
  return { text: parts.join('\n\n'), tool, blocks };
}

/**
 * Walk one transcript to a window of records, reading in place and bounded.
 *
 * The walk is from the start every time. That is the honest cost of not
 * keeping a second store: JSONL records are variable-length, so there is no
 * offset to seek to, and building one would be the copy the item forbids.
 * `CONVERSATION_WALK_CAP` is what keeps the cost stated rather than open.
 */
function readWindow(
  file: string, offset: number, limit: number,
): {
  records: ConversationRecordView[];
  counted: number;
  walked: number;
  hitCap: boolean;
  reachedEnd: boolean;
} {
  const records: ConversationRecordView[] = [];
  let counted = 0;
  let walked = 0;
  let hitCap = false;
  let reachedEnd = false;

  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return { records, counted, walked, hitCap, reachedEnd: true };
  }

  const buffer = Buffer.alloc(CHUNK_BYTES);
  let carry = '';

  const take = (line: string): void => {
    if (line === '') return;
    const at = counted;
    counted += 1;
    // Past the window: counted so `total` stays true, not built.
    if (at < offset || records.length >= limit) return;

    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      records.push({
        index: at, type: 'unreadable', kind: 'machinery', timestamp: null,
        text: '', totalChars: 0, textTruncated: false, tool: null, blocks: [],
        unreadable: true,
      });
      return;
    }
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      records.push({
        index: at, type: 'unreadable', kind: 'machinery', timestamp: null,
        text: '', totalChars: 0, textTruncated: false, tool: null, blocks: [],
        unreadable: true,
      });
      return;
    }
    const row = record as { type?: unknown; timestamp?: unknown; message?: unknown };
    const message = row.message;
    const content = typeof message === 'object' && message !== null
      ? (message as { content?: unknown }).content
      : undefined;
    const rendered = renderContent(message);
    const totalChars = rendered.text.length;
    const capped = totalChars > CONVERSATION_TEXT_CAP;
    records.push({
      index: at,
      type: typeof row.type === 'string' ? row.type : 'unknown',
      kind: classifyTurn(row.type, content),
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      text: capped ? rendered.text.slice(0, CONVERSATION_TEXT_CAP) : rendered.text,
      totalChars,
      textTruncated: capped,
      tool: rendered.tool,
      blocks: rendered.blocks,
      unreadable: false,
    });
  };

  try {
    let read = 0;
    while (walked < CONVERSATION_WALK_CAP) {
      const want = Math.min(CHUNK_BYTES, CONVERSATION_WALK_CAP - walked);
      read = readSync(fd, buffer, 0, want, null);
      if (read <= 0) { reachedEnd = true; break; }
      walked += read;
      const parts = (carry + buffer.toString('utf8', 0, read)).split('\n');
      carry = parts.pop() ?? '';
      for (const line of parts) take(line);
      // Stop as soon as the window is full AND the total is no longer needed —
      // which it always is, so the walk continues to count. The cap is what
      // bounds it.
    }
    if (reachedEnd) take(carry);
    else hitCap = true;
  } catch {
    // A read that failed part-way keeps what it built; `walked` says how far.
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }

  return { records, counted, walked, hitCap, reachedEnd };
}

export function apiConversation(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, ['limit', 'offset']) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  const askedLimit = boundedDigits(url, 'limit');
  if (askedLimit === null) {
    return badRequest('limit must be a whole number of records, written in digits.');
  }
  const askedOffset = boundedDigits(url, 'offset');
  if (askedOffset === null) {
    return badRequest('offset must be a whole number of records, written in digits.');
  }
  const limit = Math.min(askedLimit ?? CONVERSATION_RECORD_DEFAULT, CONVERSATION_RECORD_CAP);
  const offset = askedOffset ?? 0;

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      // Nothing is indexed, so this session is not known here. A 404 with the
      // reason, rather than a 500 that reads as damage.
      return {
        status: 404,
        body: {
          error: 'no conversation index in this workspace — nothing has been scanned.',
          rebuild: REBUILD_COMMAND,
        },
      };
    }
    throw err;
  }

  let row: ConversationRow | null;
  try {
    row = index.get(params.id);
  } finally {
    index.close();
  }
  if (row === null) {
    return { status: 404, body: { error: `no indexed conversation "${params.id}".` } };
  }

  let present = false;
  let bytes = row.bytes;
  try {
    const stat = statSync(row.file);
    present = stat.isFile();
    bytes = stat.size;
  } catch {
    present = false;
  }

  if (!present) {
    // **The pruned session, served as itself.** The spec asks that the list
    // show a session's file is gone rather than failing to load; the same
    // holds one level down. Everything the index remembers is still here, and
    // `records: []` beside `present: false` is a different fact from a
    // conversation that is genuinely empty.
    const body: ConversationBody = {
      sessionId: row.sessionId, source: row.source, title: row.title,
      titleSource: row.titleSource, branch: row.branch,
      startedAt: row.startedAt, endedAt: row.endedAt,
      present: false, bytes: row.bytes, records: [], offset, limit,
      total: null, omitted: null, more: false, truncated: false,
      uncounted: 'the transcript is no longer on disk — the harness prunes them, and the '
        + 'archive reads them in place rather than copying, so what is gone is gone. The '
        + 'counts above are what the last scan measured.',
      walkedBytes: 0,
      textCap: CONVERSATION_TEXT_CAP,
    };
    return { status: 200, body };
  }

  const walk = readWindow(row.file, offset, limit);
  const total = walk.hitCap ? null : walk.counted;
  const body: ConversationBody = {
    sessionId: row.sessionId,
    source: row.source,
    title: row.title,
    titleSource: row.titleSource,
    branch: row.branch,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    present: true,
    bytes,
    records: walk.records,
    offset,
    limit,
    total,
    omitted: total === null ? null : total - walk.records.length,
    more: total === null
      ? walk.records.length === limit
      : offset + walk.records.length < total,
    truncated: walk.hitCap,
    uncounted: walk.hitCap
      ? `the walk stopped at ${CONVERSATION_WALK_CAP} bytes (CONVERSATION_WALK_CAP) of a `
        + `${bytes} byte transcript, so records past it were never counted and no total `
        + 'exists. Records are variable-length JSONL lines with no offset to seek to, and '
        + 'building one would be a second store of conversation text.'
      : null,
    walkedBytes: walk.walked,
    textCap: CONVERSATION_TEXT_CAP,
  };
  return { status: 200, body };
}

/** One indexed lane as the list serves it. */
export interface SubagentSummary {
  agentId: string;
  sessionId: string;
  /** `null` when the SESSION dispatched it; else the lane that did. */
  parentAgentId: string | null;
  /**
   * **The `Agent` tool_use block that dispatched this lane** — `plan:archive
   * seq:15`'s handle, and the reason this endpoint exists rather than a
   * count alone.
   *
   * A document step rendered from an `Agent` call carries this same id in its
   * captured input (`seq:24`), so a screen can go from THE TURN to THE
   * TRANSCRIPT with no correlation of its own to invent. `null` means the
   * sidecar was unreadable and this lane cannot be linked — visibly, rather
   * than by being absent from the list.
   */
  toolUseId: string | null;
  agentType: string | null;
  /** The dispatcher's one-line brief. A lane's name, never fabricated. */
  description: string | null;
  model: string | null;
  spawnDepth: number;
  isFork: boolean;
  startedAt: string | null;
  endedAt: string | null;
  prompts: number;
  answers: number;
  machinery: number;
  records: number;
  unreadable: number;
  bytes: number;
  scannedBytes: number;
  scanTruncated: boolean;
  /** The transcript is still on disk. `false` is a lane whose file is gone. */
  present: boolean;
  fileBytes: number | null;
  /** Bytes of this lane's transcript the index has never read. */
  staleBytes: number;
  scannedAt: string;
}

export interface SubagentListBody {
  /** The id that was ASKED for — a session, or one of its own lanes. */
  sessionId: string;
  /**
   * **The session this roster belongs to, which is not always what was asked
   * for** — `plan:archive seq:15`, and the trap it exists to close.
   *
   * A lane at depth 2 was dispatched from INSIDE another lane's transcript, so
   * its `Agent` call is a record in that lane's file and not in the session's.
   * Measured on this workspace, 2026-09-08: 43 of 254 lanes are at depth 2 —
   * **a fifth of them.** A document opened ON a lane therefore has dispatching
   * turns of its own, and asking `subagentsOf('agent-…')` answers nothing,
   * because `subagents.session_id` is the OWNING SESSION for every row at
   * every depth (measured: 99,760 of 99,760 records inside a lane transcript
   * carry the session's id, including all 43 at depth 2).
   *
   * So an id that names a lane is resolved to its owning session first and the
   * WHOLE roster is answered. A `tool_use` id is unique across the session's
   * tree, so one map from `toolUseId` serves a document at any depth and the
   * caller needs no notion of depth at all.
   */
  ownerSessionId: string;
  subagents: SubagentSummary[];
  total: number;
  /** Lanes whose transcript has since been pruned from disk. */
  missing: number;
  /** Lanes with no `toolUseId`, which nothing can link to a turn. */
  unlinked: number;
  /** Bytes of lane transcript on disk, summed over what this answer carries. */
  bytes: number;
  indexed: boolean;
  rebuild: string;
}

function summariseSubagent(row: SubagentRow): SubagentSummary {
  let present = false;
  let fileBytes: number | null = null;
  try {
    const stat = statSync(row.file);
    present = stat.isFile();
    if (present) fileBytes = stat.size;
  } catch {
    present = false;
  }
  return {
    agentId: row.agentId,
    sessionId: row.sessionId,
    parentAgentId: row.parentAgentId,
    toolUseId: row.toolUseId,
    agentType: row.agentType,
    description: row.description,
    model: row.model,
    spawnDepth: row.spawnDepth,
    isFork: row.isFork,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    prompts: row.prompts,
    answers: row.answers,
    machinery: row.machinery,
    records: row.records,
    unreadable: row.unreadable,
    bytes: row.bytes,
    scannedBytes: row.scannedBytes,
    scanTruncated: truncatedScan(row),
    present,
    fileBytes,
    staleBytes: staleBy(row, fileBytes),
    scannedAt: row.scannedAt,
  };
}

/**
 * `GET /api/conversations/:id/subagents` — **the lanes one session
 * dispatched**, oldest first.
 *
 * `plan:archive seq:12`. It is deliberately NOT a page of the sessions list:
 * a subagent is not a conversation a person had, it has no title and cannot
 * have one, and merging 253 of them into a 200-row list would bury the two
 * real sessions beneath them. It hangs UNDER the session instead, which is
 * also where a reader looks for it — the item's own words.
 *
 * **Uncapped, and that is a measurement rather than an oversight.** One row is
 * roughly 300 bytes and the largest session in this workspace owns 253 lanes,
 * so the whole answer is about 76 KB — against `CONVERSATION_LIST_CAP`, which
 * bounds a list whose rows are unbounded in number across all time. This one
 * is bounded by how many lanes ONE session dispatched. If that ever stops
 * being true the bound belongs here, disclosed the way every other bound in
 * this module is; it is not true yet and a cap nobody needs is a cap nobody
 * maintains.
 *
 * **`:id` MAY NAME A LANE, and answering that with an empty list would be the
 * quiet defect `plan:archive seq:15` is most exposed to.** 43 of this
 * workspace's 254 lanes were dispatched from inside another lane, so a
 * document opened on a lane has dispatching turns of its own — and the rows
 * for them are filed under the SESSION. `ownerSessionId` carries the
 * resolution and its measurement.
 */
export function apiConversationSubagents(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, []) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      const body: SubagentListBody = {
        sessionId: params.id, ownerSessionId: params.id,
        subagents: [], total: 0, missing: 0, unlinked: 0,
        bytes: 0, indexed: false, rebuild: REBUILD_COMMAND,
      };
      return { status: 200, body };
    }
    throw err;
  }

  try {
    // **An id that names a LANE is resolved to the session that owns it** —
    // see `SubagentListBody.ownerSessionId`. One exact lookup on a primary
    // key; a session id is never in this table, so a session pays for a miss
    // and nothing else.
    const asLane = index.getSubagent(params.id);
    const owner = asLane === null ? params.id : asLane.sessionId;
    const rows = index.subagentsOf(owner).map(summariseSubagent);
    const body: SubagentListBody = {
      sessionId: params.id,
      ownerSessionId: owner,
      subagents: rows,
      total: rows.length,
      missing: rows.filter((r) => !r.present).length,
      unlinked: rows.filter((r) => r.toolUseId === null).length,
      bytes: rows.reduce((sum, r) => sum + r.bytes, 0),
      indexed: true,
      rebuild: REBUILD_COMMAND,
    };
    return { status: 200, body };
  } finally {
    index.close();
  }
}

/**
 * **The scan bound for this endpoint, and it is smaller than the CLI's.**
 *
 * `scanSessionSecrets` defaults to `MAX_SCAN_BYTES` (256 MiB), which is right
 * for a command a person typed and waited for. This is a browser fetch, and
 * the same 64 MiB `CONVERSATION_WALK_CAP` bounds the document walk beside it
 * for the same reason: a request that cannot say how long it will take is one
 * a reader cancels by leaving. Measured 2026-09-09 on this workspace, the 83.6
 * MB live session scans in 2.6 s whole, so the cap costs a fraction of it and
 * buys a stated ceiling.
 *
 * A scan that stopped at the cap says so — `truncated` — and the screen draws
 * that as a FLOOR rather than as a total, because a list a reader believes is
 * complete is worse than one that admits it is not.
 */
export const CONVERSATION_SECRET_CAP = CONVERSATION_WALK_CAP;

/** One shape, as a legend needs it. Never the pattern — that is not a fact a reader can use. */
export interface SecretShapeView {
  id: string;
  title: string;
  /** `true` when this shape is one this build added past `seq:46`'s thirteen. */
  added: boolean;
  note: string;
}

/** One candidate, plus whether the standing choice already ticks it. */
export type SecretCandidateView = SecretCandidate & { accepted: boolean };

/**
 * **What the checkbox form draws** — `plan:archive seq:46`, step 3.
 *
 * Every field here is one a person needs in order to JUDGE, and no field
 * carries a credential: `preview` is a mask, `contexts` are windows with every
 * match in them masked, and `id` is a hash of the value. That is what lets the
 * form exist in a browser at all — the screen never holds a secret, so a
 * reader who is screen-sharing is no worse off than before.
 */
export interface ConversationSecretsBody {
  sessionId: string;
  /** Nobody has scanned this workspace, so there is no session to read. */
  indexed: boolean;
  /** The file this was read from, which may be the copy rather than the original. */
  file: string | null;
  source: string | null;
  records: number;
  unreadable: number;
  scannedBytes: number;
  /** The scan stopped at `cap`, so every count is a floor. */
  truncated: boolean;
  cap: number;
  occurrences: number;
  total: number;
  candidates: SecretCandidateView[];
  shapes: SecretShapeView[];
  /** The standing choice, or `null` when nobody has made one. */
  chosen: { accepted: string[]; chosenAt: string; projectedAt: string; replaced: number } | null;
  /** `true` when this session is being kept outside the project at all. */
  kept: boolean;
  /** The command that would apply a choice — the argv the screen composes. */
  persistCommand: string;
  rebuild: string;
  ms: number;
}

/** The empty answer, so a caller holds one shape whatever happened. */
function noSecrets(sessionId: string, indexed: boolean, ms: number): ConversationSecretsBody {
  return {
    sessionId,
    indexed,
    file: null,
    source: null,
    records: 0,
    unreadable: 0,
    scannedBytes: 0,
    truncated: false,
    cap: CONVERSATION_SECRET_CAP,
    occurrences: 0,
    total: 0,
    candidates: [],
    shapes: SECRET_SHAPES.map(({ id, title, added, note }) => ({ id, title, added, note })),
    chosen: null,
    kept: false,
    persistCommand: PERSIST_COMMAND,
    rebuild: REBUILD_COMMAND,
    ms,
  };
}

/** The verb the screen composes a choice onto. */
const PERSIST_COMMAND = 'mycontext conversation persist';

/**
 * **`GET /api/conversations/:id/secrets` — what looks private in one session,
 * and nothing else.** `plan:archive seq:46`, the read half of step 3.
 *
 * ── IT READS. THE SCREEN CANNOT ACT, AND THAT IS THE WHOLE ARRANGEMENT ────
 *
 * `test/ui/no-writes.test.ts` holds `src/ui/` write bindings to an exact set
 * of ONE, so no endpoint here can perform an export and none tries.
 * `scanSessionSecrets` is pure and touches no `node:fs` write API — it is
 * deliberately a module of its own for that reason, and its writing half
 * (`core/conversation-redaction.ts`) is a WRITERS key this file may not bind.
 * So the screen DRAWS the candidates and COMPOSES the command; the CLI runs
 * it. The item leaves "where the form lives" open and asks for both to be
 * weighed, and this is the weighing settled by a test rather than by taste.
 *
 * `readRedactionPlan` IS bound, and it is a read: it answers which boxes are
 * already ticked, so a reader who chose yesterday is not shown an empty form
 * today. The plan holds ids and never values, so serving it exposes nothing.
 *
 * ── AND IT DECIDES NOTHING ────────────────────────────────────────────────
 *
 * `accepted` is `false` for every candidate until somebody has chosen, which
 * is the owner's rule stated where a form could most easily break it: an
 * export he did not read must be byte-faithful, so a pre-ticked box would be
 * this product deciding on his behalf and calling it a default.
 */
export function apiConversationSecrets(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const startedMs = Date.now();
  const bad = unknownParams(url, []) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      return { status: 200, body: noSecrets(params.id, false, Date.now() - startedMs) };
    }
    throw err;
  }

  let row: ConversationRow | null;
  let mark: PersistedRow | null;
  try {
    row = index.get(params.id);
    mark = row === null ? null : index.persistedOf(params.id);
  } finally {
    index.close();
  }
  if (row === null) return { status: 200, body: noSecrets(params.id, true, Date.now() - startedMs) };

  const scan = scanSessionSecrets(row.file, { cap: CONVERSATION_SECRET_CAP });
  const plan = mark === null ? null : readRedactionPlan(mark.file);
  const accepted = new Set(plan?.accepted ?? []);
  return {
    status: 200,
    body: {
      sessionId: params.id,
      indexed: true,
      file: row.file,
      source: row.source,
      records: scan.records,
      unreadable: scan.unreadable,
      scannedBytes: scan.scannedBytes,
      truncated: scan.truncated,
      cap: CONVERSATION_SECRET_CAP,
      occurrences: scan.occurrences,
      total: scan.candidates.length,
      candidates: scan.candidates.map((c) => ({ ...c, accepted: accepted.has(c.id) })),
      shapes: SECRET_SHAPES.map(({ id, title, added, note }) => ({ id, title, added, note })),
      chosen: plan === null ? null : {
        accepted: plan.accepted,
        chosenAt: plan.chosenAt,
        projectedAt: plan.projectedAt,
        replaced: plan.replaced,
      },
      kept: mark !== null,
      persistCommand: PERSIST_COMMAND,
      rebuild: REBUILD_COMMAND,
      ms: Date.now() - startedMs,
    },
  };
}

export function registerConversationRoutes(): void {
  // **`/secrets` before `/:id`**, exactly as `/subagents` is: the router
  // matches in registration order and `/api/conversations/:id` would otherwise
  // swallow `:id` = "…/secrets".
  registerRoute('GET', '/api/conversations/:id/secrets', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationSecrets(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/conversations/:id/subagents', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationSubagents(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/conversations', {
    kind: 'json', handle: (ctx: ApiContext) => apiConversations(ctx.ws, ctx.url),
  });
  registerRoute('GET', '/api/conversations/:id', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversation(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
