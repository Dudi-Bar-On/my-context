/**
 * **Search the archive** — `plan:recall seq:1`, Task 1 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §11
 * of `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 *
 * A full-text index over the PROSE of every transcript the archive already
 * knows about, and a search over it that answers with byte offsets a reader
 * can seek to. The table it fills lives in `conversation-index.ts` beside the
 * rest of that file's schema, and the header there carries the measurements
 * behind the two decisions that shape everything here — prose only, and the
 * `trigram` tokenizer. They are not repeated below; `CLAUDE.md` opens by
 * describing what a second copy of a rule costs.
 *
 * ── IT COSTS NO DEPENDENCY, AND THAT IS THE POINT ──────────────────────────
 *
 * Node 24 bundles SQLite 3.51.2 with `ENABLE_FTS5`, `bm25()`, porter and
 * trigram. Nothing is added to `package.json` and there is no build step —
 * `CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step`.
 *
 * ── WHAT FILLS IT, AND WHAT THIS DELIBERATELY DOES NOT DO ──────────────────
 *
 * `buildSearchIndex` is a WRITE and takes an already-open `ConversationIndex`,
 * which is `ConversationIndex.open`'s door and therefore not one `src/ui/` may
 * walk through. It is not wired into `rebuildConversations` or the Stop hook
 * by this task: Task 1's file list names this file and the schema, and putting
 * a new per-turn cost on the hook is a decision with its own measurement to
 * take. Until a caller runs it the table is EMPTY rather than stale, and an
 * empty table answers nothing rather than answering wrongly.
 *
 * It is built to be affordable at that cadence when somebody does wire it up:
 * an unchanged transcript costs one comparison and reads nothing, and a grown
 * one costs its TAIL, which is the same third path `rebuildConversations`
 * argues and measures.
 */
import { statSync } from 'node:fs';
import {
  ConversationIndex, MAX_SCAN_BYTES, PROSE_KINDS, RAN_KINDS, SAID_KINDS,
  type ProseHit, type ProseKind, type ProseSpan, type ProseSourceRow,
  classifyTurn, iterateTranscript, lineStartsAt,
} from './conversation-index.ts';

/**
 * **The shortest term a trigram index can match, and it is a hard floor.**
 *
 * A trigram tokenizer indexes runs of three characters, so a query of one or
 * two matches NOTHING — measured on the real corpus, `"ui"` returns zero rows
 * over an archive in which the word is on nearly every screen. That is a bound
 * of the index and not a property of the archive, so `searchArchive` reports
 * it instead of handing back an empty list that would read as "not here".
 */
export const MIN_QUERY_CHARS = 3;

/** How many hits a search returns when the caller does not say. */
export const DEFAULT_SEARCH_LIMIT = 200;

/* ── SAID, RAN, OR BOTH — `semantic/10` ────────────────────────────────────
 *
 * `TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done`, owner
 * ruling 2026-09-16: *"Index the tool calls"*. The index now holds them
 * (`toolProseOf`), and this is the half of that item that decides whether it
 * is an improvement at all.
 *
 * **A SEARCH THAT RETURNS EVERYTHING IS NOT BETTER THAN ONE THAT RETURNS TOO
 * LITTLE.** What was run is 3.6x what was said, and it is a different KIND of
 * text: paths, flags, ids, the same command a hundred times. Poured into one
 * undifferentiated result list it would bury a prose query under command
 * noise, and the reader would have lost a search to gain one. So the reader
 * says WHICH, in his own two words, and the answer says what it read.
 */

/**
 * **WHAT NO SEARCH HERE CAN REACH, AND IT IS SERVED WITH EVERY ANSWER.**
 *
 * `tool_result` is what every command PRINTED and `thinking` is what the model
 * thought. Measured over this workspace's own archive 2026-09-16
 * (`scripts/measure-tool-indexing.ts`): 67.0% and 16.4% of its characters,
 * 83.4% together, and neither is in the index at any cap.
 *
 * It is a LIST OF BLOCK TYPES rather than a sentence about "some things"
 * because a reader who has just been handed a count needs to know what the
 * count is not about — `INV-nothing-is-dropped-silently` is about the SCOPE of
 * an answer and not only about its truncation. One definition, and both
 * surfaces print it: a CLI and a screen disagreeing about what the archive
 * cannot find would be two answers to the reader's most important question.
 */
export const UNINDEXED_BLOCKS: readonly string[] = ['tool_result', 'thinking'];

/** The reader's word for which half of the archive a query is over. */
export type SearchSources = 'said' | 'ran' | 'both';

/** The three words, in the order a surface offers them. */
export const SEARCH_SOURCES: readonly SearchSources[] = ['said', 'ran', 'both'];

/**
 * The reader's word, as the kinds a query stands on. One spelling, every
 * caller, and the three lists themselves live beside the column they describe
 * (`conversation-index.ts` · `SAID_KINDS`, `RAN_KINDS`, `PROSE_KINDS`).
 *
 * **The default everywhere in this file is `said`, and it is a choice with a
 * cost.** It is what keeps every caller written before 2026-09-16 reading
 * exactly the rows it read. What it costs is that a reader who types a command
 * he ran into a *said* search is answered `0`, which has the same shape as
 * "the archive does not contain this" — so no search here is allowed to stop
 * at that: `TieredSearchResult.elsewhere` counts what the kinds he did NOT ask
 * for hold, on every query. `INV-nothing-is-dropped-silently`.
 */
export function kindsOf(sources: SearchSources): readonly ProseKind[] {
  if (sources === 'said') return SAID_KINDS;
  if (sources === 'ran') return RAN_KINDS;
  return PROSE_KINDS;
}

/**
 * **THE KINDS A QUERY DID NOT ASK FOR** — the complement, so a surface can say
 * what it did not look in without a second list of what exists.
 *
 * Empty when the query already covered all three, which is the one case where
 * there is nothing to disclose.
 */
export function kindsBesides(asked: readonly string[]): readonly ProseKind[] {
  return PROSE_KINDS.filter((kind) => !asked.includes(kind));
}

/** Where to look. Omitting everything searches this workspace's whole archive. */
export interface SearchScope {
  /** One session — and its lanes, unless `agentId` narrows further. */
  sessionId?: string;
  /** One lane, or `null` for a session's own transcript only. */
  agentId?: string | null;
  /**
   * **Which kinds of span** — one, or a set. `SAID_KINDS` when the caller does
   * not say, which is what keeps every pre-2026-09-16 caller unchanged.
   *
   * A surface takes the reader's word and passes `kindsOf(word)`; there is no
   * second field for the word itself, because two fields meaning one thing is
   * two places for a query's scope to be decided.
   */
  kind?: ProseKind | readonly ProseKind[];
  limit?: number;
  /**
   * **Only these transcripts, and only at or past these bytes.**
   *
   * `matchProse`'s header argues the whole of it. The short form: a caller
   * asking *what matched in what was just appended* cannot get that answer out
   * of a relevance ranking, so the scope is pushed into the query instead of
   * being applied to the ranking's output. An EMPTY list matches nothing,
   * which is what it means.
   */
  windows?: { sourceKey: string; fromByte: number }[];
  /** Skip this many hits — for a caller paging past the `limit`. */
  offset?: number;
}

/**
 * What a search answers with.
 *
 * **It is not a bare `Hit[]`, and the difference is `searchable`.** The plan
 * sketched `searchArchive(index, query, scope): Hit[]`; a list cannot carry
 * the one thing this index has to be able to say, which is that a query is
 * too short for the tokenizer to match at all. An empty array would make that
 * indistinguishable from "the archive does not contain this"
 * (`INV-nothing-is-dropped-silently`), and throwing would make a search box
 * throw on its second keystroke. So the answer carries its own disclosure and
 * the hits are a field of it.
 */
export interface SearchResult {
  /** The query as it was searched — trimmed, never rewritten. */
  query: string;
  /** False when the index cannot match this query at all. Then `hits` is empty. */
  searchable: boolean;
  /** Why not, in a sentence a reader can act on. `null` when it was searched. */
  note: string | null;
  hits: ProseHit[];
}

/** What one run of `buildSearchIndex` did. */
export interface SearchBuildReport {
  /** Transcripts the archive knows about — sessions and lanes together. */
  sources: number;
  /** Transcripts read WHOLE this run. */
  indexed: number;
  /** Transcripts brought up to date by reading only their appended tail. */
  appended: number;
  /** Transcripts whose size and mtime matched what was already indexed. */
  skipped: number;
  /** Transcripts forgotten because the archive no longer holds their row. */
  removed: number;
  /** Prose spans added this run. */
  spans: number;
  /** Bytes actually read this run. */
  bytesRead: number;
  /**
   * **The `key` of every source this run actually read** — a session id, or a
   * lane's `agentId`, exactly as `sourcesOf` keys them and exactly as an
   * anchor row's `agentId ?? sessionId` spells the same thing.
   *
   * Added 2026-09-12 for the per-turn anchor pass
   * (`core/anchor-pass.ts`' `markAnchorsOnTurn`,
   * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`), and it
   * is a LIST rather than the count beside it because a count cannot answer
   * the question that makes a per-turn pass affordable: *which* transcripts
   * moved. Measured on this workspace, 2026-09-12: the automatic anchor pass
   * over the whole archive costs ~550 ms of seeks in its steady state, and 341
   * of 341 sources are unchanged on the overwhelming majority of turns.
   *
   * Empty means the archive's words did not move, and a grammar's answer over
   * bytes that did not move cannot have changed either.
   */
  read: string[];
  /**
   * **The byte each entry of `read` was read FROM**, index for index.
   *
   * `0` for a source read whole, and the resume point for one whose tail was
   * read. Added 2026-09-12 with the per-turn anchor pass, which needs it for
   * the same reason `read` exists and one level finer: knowing WHICH
   * transcripts moved narrows the pass to six sources out of 346, and knowing
   * where they moved narrows it to the handful of turns that actually arrived
   * — measured on the real corpus, the difference between re-deciding 316
   * candidates every turn (935 ms) and deciding the two or three that are new.
   *
   * Parallel to `read` rather than a map, so the two cannot be written apart:
   * there is one `push` for each and they sit on consecutive lines.
   */
  readFrom: number[];
  /**
   * **Sources this run was out of time to read** — `budgetMs` stopped it, and
   * they are DEFERRED to the next run rather than dropped.
   *
   * Added 2026-09-12 with the per-turn caller. A count rather than silence
   * because a build that ran out of budget and one that had nothing to do are
   * two different facts and the second is the one a reader assumes
   * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`): a
   * workspace whose prose index is permanently behind by a few sources is a
   * workspace where the per-turn anchor pass never sees them, and nothing else
   * in the report would say so. `0` on every run that had no budget at all.
   */
  deferred: number;
  /**
   * **Every source whose ROW is behind the FILE it names** — the measurement
   * that turns this report's zeroes from a claim into a measured one.
   *
   * Added 2026-09-15 under
   * `TASK-the-automatic-marking-stopped-and-said-nothing-because-a`, whose
   * closing conditions name it: *"the pass must distinguish 'nothing to do'
   * from 'I read nothing', and the stalled case must reach a surface. A
   * `statSync` against the file a row claims to describe is affordable, and is
   * the measurement nobody was making."*
   *
   * **It is filled on EVERY run, including the runs that read nothing**, which
   * is the whole point: a source that is skipped is exactly the source this
   * field exists to talk about. `read.length === 0` with `stale` empty is *"I
   * looked and there was nothing"*; `read.length === 0` with `stale` non-empty
   * is *"I could not look"*, and until this field existed those two were the
   * same value.
   *
   * It is NOT an error. A live transcript is a few hundred bytes ahead of its
   * row for the whole of the turn that is being typed into it, and that is
   * latency rather than failure — `INV-a-turn-that-qualifies-for-an-automatic-
   * mark-carries-one-when` is explicit that what is forbidden is a reader who
   * cannot tell the two apart, not the latency itself. What this field makes
   * possible is the sentence "the archive is N bytes behind", which is true in
   * both cases and useful in one.
   */
  stale: StaleSource[];
  ms: number;
}

/**
 * The words of one record, or `''` when it holds none.
 *
 * A prompt with nothing attached is a plain string; the same prompt carrying
 * files is an array with a `text` block in it, and an answer is always the
 * array form. Anything else — a `tool_use`, a `tool_result`, a `thinking`
 * block — contributes nothing HERE, which is deliberate: `classifyTurn` has
 * already decided that one record earlier, and this only reads what the record
 * says. What a record RAN is read by `toolProseOf` beside this, into a span of
 * its own kind, so that the reader can ask for one without the other.
 */
export function proseOf(record: Record<string, unknown> | null): string {
  if (record === null) return '';
  const message = record.message;
  if (typeof message !== 'object' || message === null) return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type === 'text' && typeof typed.text === 'string') parts.push(typed.text);
  }
  return parts.join('\n');
}

/**
 * **HOW MUCH OF ONE ARGUMENT IS INDEXED**, in characters, and it is a cap on
 * the VALUE rather than on the block.
 *
 * ── WHY THERE IS A CAP AT ALL ─────────────────────────────────────────────
 *
 * `tool_use` is 106,728,078 characters of this archive against 29,301,746 of
 * text, and almost the whole of the difference is two arguments: `Write`'s
 * `content` and `Edit`'s `old_string`/`new_string`, which carry WHOLE FILES.
 * A file that was written through a tool is a file on disk; indexing its body
 * a second time buys a reader nothing he cannot get from the file, and it is
 * the same "file dump" cost that keeps `tool_result` out of the index
 * entirely.
 *
 * ── WHY IT IS PER VALUE AND NOT PER BLOCK ─────────────────────────────────
 *
 * The question this index now answers is *what command did I run, on which
 * path*. `Write`'s input is `{file_path, content}` and `Edit`'s is
 * `{file_path, old_string, new_string}` — a cap on the BLOCK spends its whole
 * budget on the first long value and can drop `file_path` entirely, which is
 * the one argument the reader was looking for. Capping each value keeps every
 * KEY and the head of every value, so a hundred-kilobyte `Write` still
 * indexes its path, its tool name and the first lines of what it wrote.
 *
 * The number is measured, not chosen: `scripts/measure-tool-indexing.ts`
 * prints the cap curve over the real archive, and
 * `reports/2026-09-16-indexing-what-was-done.md` carries the row this was read
 * off.
 */
export const TOOL_VALUE_CAP = 2_000;

/** Written into the text where a value was cut, so a reader sees the cut. */
export const TOOL_TRUNCATED = '…';

/**
 * **WHAT ONE RECORD RAN, rendered into something a trigram index can match** —
 * the tool's NAME, then one `key: value` line per argument.
 *
 * `''` for a record that called nothing, which is most of them.
 *
 * ── THE SHAPE IS THE ANSWER TO THE QUESTIONS IT EXISTS FOR ────────────────
 *
 * *"what command did I run"*, *"which file did I touch"*, *"when did I last
 * run that script"*. All three are the tool's name and its arguments, so both
 * are rendered and neither is summarised: a `Bash` block becomes
 *
 *     Bash
 *     command: node --test test/core/conversation-search.test.ts
 *     description: Run the search tests
 *
 * and a reader typing `conversation-search.test` finds it as a substring, which
 * is what this tokenizer is for. **The JSON is NOT indexed as JSON.** Quoting
 * and escaping would put `\"` and `\\n` between the characters a reader types,
 * and on a trigram index a query is matched as a contiguous run — a path
 * spelled `src\\core\\x.ts` in the raw record is not the `src/core/x.ts` he
 * would type. So strings are rendered as their own characters, and only a
 * value that is not a string is `JSON.stringify`d, because there is nothing
 * else it could be.
 *
 * ── ONE SPAN PER RECORD, NOT ONE PER BLOCK ────────────────────────────────
 *
 * A record can carry several `tool_use` blocks and they share a byte offset,
 * which is the only seek target a hit can carry. Rendering them into one text
 * keeps the index's promise that a span is a place in a file.
 */
export function toolProseOf(
  record: Record<string, unknown> | null, cap = TOOL_VALUE_CAP,
): string {
  if (record === null) return '';
  const message = record.message;
  if (typeof message !== 'object' || message === null) return '';
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: unknown; name?: unknown; input?: unknown };
    if (typed.type !== 'tool_use') continue;
    const lines: string[] = [];
    if (typeof typed.name === 'string' && typed.name !== '') lines.push(typed.name);
    if (typeof typed.input === 'object' && typed.input !== null && !Array.isArray(typed.input)) {
      for (const [key, value] of Object.entries(typed.input as Record<string, unknown>)) {
        lines.push(`${key}: ${clip(render(value), cap)}`);
      }
    }
    if (lines.length !== 0) parts.push(lines.join('\n'));
  }
  return parts.join('\n');
}

/** A value as its own characters — `JSON.stringify` only for what is not text. */
function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value) ?? ''; } catch { return ''; }
}

/**
 * Cut at `cap` CHARACTERS and say so.
 *
 * Characters and not bytes, and this is the one place in this project where
 * that is right rather than a defect: the cap is a bound on how much of an
 * argument is worth indexing, not an offset anybody seeks to. Cutting on a
 * byte would split a Hebrew character or an emoji in half and hand FTS5 a lone
 * surrogate. Every OFFSET this module produces is still a byte offset.
 */
function clip(text: string, cap: number): string {
  return text.length <= cap ? text : text.slice(0, cap) + TOOL_TRUNCATED;
}

/** A record's own timestamp, when it carried one. */
function stampOf(record: Record<string, unknown>): string | null {
  const at = record.timestamp;
  return typeof at === 'string' && at !== '' ? at : null;
}

/** One transcript the archive knows about: a session's own file, or a lane's. */
interface Source {
  key: string;
  sessionId: string;
  agentId: string | null;
  file: string;
  bytes: number;
  mtimeMs: number;
  /**
   * **The size the FILE has right now** — `null` when it would not `stat`.
   *
   * `bytes` above is what the archive's ROW says, and every decision in this
   * module used to rest on it alone. This is the other number, and the two
   * together are the only thing in the chain that can tell *"I looked and
   * there was nothing"* from *"I could not look"*.
   */
  fileBytes: number | null;
}

/**
 * **One transcript whose row is BEHIND the file it names.**
 *
 * `nothing-to-do-and-could-not-look-are-different-answers`, written from
 * the 2026-09-15 incident this field closes: *"the step that trusts a recorded
 * value must, at least once, compare it against the thing it claims to
 * describe"*. Nothing in this product was making that comparison, so a row
 * that stopped advancing made every step below it correctly decide there was
 * no work, for ever, while each one reported success.
 */
export interface StaleSource {
  key: string;
  file: string;
  /** What the archive's row says it has read. */
  rowBytes: number;
  /** What the file actually holds, or `null` when it would not `stat`. */
  fileBytes: number | null;
  /** `fileBytes - rowBytes`, and `null` for a file that would not answer. */
  behind: number | null;
}

/**
 * **Compare every row against the file it claims to describe, and say which
 * ones are behind.** A READ, and the cheapest measurement in this file.
 *
 * ── WHY IT IS ITS OWN EXPORT AND NOT A PRIVATE LINE IN THE BUILD ──────────
 *
 * The build reports this for the turn it ran on, which is what the Stop hook
 * needs. A SCREEN needs the same fact without writing anything —
 * `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when`'s second
 * half is that a turn the archive has not yet read is drawn as exactly that,
 * and *"the screen must be able to say 'the archive is N bytes behind this
 * document' from a `statSync` it can afford"*. One function, both callers, and
 * no second definition of what "behind" means.
 *
 * ── AFFORDABLE, MEASURED, BECAUSE IT RUNS ON EVERY TURN ───────────────────
 *
 * It is one `stat` per source and nothing else. Measured on this workspace,
 * 2026-09-15: **452 sources (13 sessions and 439 lanes) in 9-11 ms**, against
 * the 1,600 ms the Stop hook's whole anchor budget is. `rebuildConversations`'
 * own header measured the same operation at 5.06 ms for 253 lanes and reached
 * the same conclusion about affording it.
 *
 * ── A FILE THAT WILL NOT ANSWER IS NOT A FILE THAT IS LEVEL ───────────────
 *
 * `behind: null` rather than `0`, and the row is still returned. A transcript
 * the harness pruned, a lock, a permission — every one of those is a case
 * where the archive CANNOT KNOW whether it is behind, and reporting it as
 * caught up would be the exact substitution this standard forbids, made by the
 * function written to prevent it.
 */
export function archiveFreshness(index: ConversationIndex): StaleSource[] {
  return staleOf(sourcesOf(index));
}

/**
 * **THE ONE COMPARISON**, and there is exactly one of it in this product.
 *
 * `buildSearchIndex` reports it for the turn it ran on and `archiveFreshness`
 * hands it to a screen; both call this. A second spelling of "behind" is the
 * defect `CLAUDE.md` opens by describing, and it would be a particularly poor
 * one here — the two callers would drift and the disagreement would show up as
 * a screen and an audit row contradicting each other about whether the archive
 * is current.
 */
function staleOf(sources: Source[]): StaleSource[] {
  const behind: StaleSource[] = [];
  for (const source of sources) {
    if (source.fileBytes === null) {
      behind.push({
        key: source.key, file: source.file, rowBytes: source.bytes, fileBytes: null, behind: null,
      });
      continue;
    }
    if (source.fileBytes <= source.bytes) continue;
    behind.push({
      key: source.key,
      file: source.file,
      rowBytes: source.bytes,
      fileBytes: source.fileBytes,
      behind: source.fileBytes - source.bytes,
    });
  }
  return behind;
}

/**
 * Every transcript the archive holds a row for — sessions AND lanes.
 *
 * Lanes are not an extra: measured on this workspace 2026-09-11 there are 298
 * of them against 2 sessions, so an index that read only session transcripts
 * would be searching under one percent of the archive. The row is the source
 * of truth for where a file is, which is why this reads the index rather than
 * the filesystem — a transcript the archive has not scanned is not part of the
 * archive yet, and indexing it here would put words in the search results that
 * no other surface can show.
 */
function sourcesOf(index: ConversationIndex): Source[] {
  const found: Source[] = [];
  for (const row of index.all()) {
    found.push({
      key: row.sessionId,
      sessionId: row.sessionId,
      agentId: null,
      file: row.file,
      bytes: row.bytes,
      mtimeMs: row.mtimeMs,
      fileBytes: sizeOf(row.file),
    });
    for (const lane of index.subagentsOf(row.sessionId)) {
      found.push({
        key: lane.agentId,
        sessionId: lane.sessionId,
        agentId: lane.agentId,
        file: lane.file,
        bytes: lane.bytes,
        mtimeMs: lane.mtimeMs,
        fileBytes: sizeOf(lane.file),
      });
    }
  }
  return found;
}

/**
 * **The one `statSync` that nobody was making**, and it is deliberately not
 * inlined above: it is the single place this module touches the world rather
 * than the index, so it is the single place a removal proof has to break.
 *
 * `null` for a file that would not answer, never `0` — a size of zero is a
 * real measurement of an empty file and this is the absence of one.
 */
function sizeOf(file: string): number | null {
  try { return statSync(file).size; } catch { return null; }
}

/**
 * Walk one transcript from `startByte` and return the prose in it.
 *
 * `startIndex` is what record ordinal the first record read carries, so an
 * appended record keeps the number a whole-file walk would have given it. A
 * search result that pointed at turn 0 of a session because the tail restarted
 * its own counting would send a reader to the wrong place, silently.
 */
function proseFrom(
  source: Source, startByte: number, startIndex: number, cap: number,
): { spans: ProseSpan[]; records: number; bytesRead: number } {
  const cursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  const spans: ProseSpan[] = [];
  let records = startIndex;
  for (const record of iterateTranscript(source.file, { startByte, startIndex, cap, cursor })) {
    records = record.index + 1;
    if (record.record === null) continue;
    const at = stampOf(record.record);
    const put = (kind: ProseKind, text: string): void => {
      if (text.trim() === '') return;
      spans.push({
        sourceKey: source.key,
        sessionId: source.sessionId,
        agentId: source.agentId,
        recordIndex: record.index,
        byteOffset: record.byteOffset,
        kind,
        at,
        text,
      });
    };
    const said = classifyTurn(record.record.type, (record.record.message as
      { content?: unknown } | undefined)?.content);
    // **The filter for WHAT WAS SAID is `classifyTurn` and nothing else.** A
    // second definition of what counts as words would drift from the one the
    // list screen's prompt and answer columns already rest on.
    if (said !== 'machinery') put(said, proseOf(record.record));
    // **AND THE SAME RECORD IS READ AGAIN FOR WHAT IT RAN.** It is a second
    // `put` rather than an `else`, and that is the whole of the 2026-09-16
    // change: a record that says something and then calls a tool is BOTH, and
    // the record `classifyTurn` calls `machinery` is precisely the one this
    // index used to drop on the floor. Two spans at one byte offset is a
    // deliberate shape — see `ProseSpan` — and it is why `hitKey` carries the
    // kind.
    put('ran', toolProseOf(record.record));
  }
  return { spans, records, bytesRead: cursor.scannedBytes };
}

/**
 * **Fill the prose index from the transcripts the archive already knows.** A
 * WRITE: it takes an index opened through `ConversationIndex.open`.
 *
 * `full: true` re-reads every transcript. The default reads only what has
 * changed, on the same three paths `rebuildConversations` argues: an unchanged
 * file costs one comparison, a grown file costs its tail, and anything else —
 * a file rewritten in place, a file replaced, a source whose previous walk
 * stopped at the cap on a byte that is not a line boundary — falls to a whole
 * re-read, which is always correct and never the only way to a row.
 *
 * ── `budgetMs`: THE BOUND THAT LETS A HOOK CALL THIS ──────────────────────
 *
 * Added 2026-09-12, when `markAnchorsOnTurn` put this on the `Stop` hook,
 * whose platform timeout is **3 seconds** and whose overrun is not a slow turn
 * but a `taskkill /T` that loses the audit row. Everything above is
 * proportional to what MOVED, which is a few kilobytes on an ordinary turn and
 * is the whole argument for the cadence — but it is not BOUNDED. A workspace
 * whose archive was scanned before the prose index existed has 343 sources and
 * 875 MB to read on the first run that asks (8.6 s, measured 2026-09-11), and
 * a run that costs 8.6 s inside a 3-second hook is a killed hook every turn,
 * for ever, because the work it was killed part-way through is the work it
 * finds waiting next turn.
 *
 * So a caller may say how long it is willing to spend. The check is BETWEEN
 * sources and never inside one: a source whose walk was cut short would write
 * a `prose_sources.bytes` that is not where the archive's scan reached, which
 * is the exact skew that cost 103.3 MB a run until 2026-09-11 and never healed
 * (see the walk below). What is over budget is left completely unread, its row
 * untouched, and read by the next run — `deferred` says how many.
 *
 * **The order the sources come in is what makes deferral safe rather than
 * starvation**: `sourcesOf` takes `index.all()`, which is `ended_at DESC`, so
 * the transcripts being appended to right now are the ones served first. A
 * source can only be starved while something more recent keeps moving, and an
 * unchanged source costs no budget at all — it is a comparison, not a read.
 *
 * `maxSourceBytes` is the same bound in the other dimension, and it is what
 * makes `budgetMs` a CEILING rather than a hope: the clock is only ever read
 * between sources, so without it one transcript that needs a whole re-read —
 * 106 MB in this workspace, about a second — could start at the last
 * millisecond of the budget and overrun it by its own whole size. A source
 * whose pending read is larger is left for the run that has no bound, which is
 * `mycontext conversation rebuild`, and counted in `deferred` meanwhile.
 *
 * **Neither bound is a `cap`, and that distinction is load-bearing.** `cap`
 * stops a walk PART WAY and writes where it stopped, which is correct only
 * because the next run is allowed to resume past it; a per-turn caller passing
 * a small `cap` would write `bytes === cap`, fail `previous.bytes < cap` for
 * ever after, and re-read the same first `cap` bytes on every single turn.
 * These two skip a source ENTIRELY and touch nothing, which is why the next
 * run finds it exactly as it was.
 */
export function buildSearchIndex(
  index: ConversationIndex,
  options: { full?: boolean; cap?: number; budgetMs?: number; maxSourceBytes?: number } = {},
): SearchBuildReport {
  const startedMs = Date.now();
  const cap = options.cap ?? MAX_SCAN_BYTES;
  const deadline = options.budgetMs === undefined ? null : startedMs + options.budgetMs;
  const maxSourceBytes = options.maxSourceBytes ?? null;
  const sources = sourcesOf(index);
  const known = index.proseSources();
  const report: SearchBuildReport = {
    sources: sources.length,
    indexed: 0,
    appended: 0,
    skipped: 0,
    removed: 0,
    spans: 0,
    bytesRead: 0,
    read: [],
    readFrom: [],
    deferred: 0,
    // **Computed from the sources this run is about to consider, BEFORE it
    // decides anything about them** — a freshness answer derived after the
    // skips would be derived from the same recorded numbers the skips rest on,
    // which is the circularity this field exists to break. `staleOf` and not a
    // second comparison written out here: one definition of "behind", which is
    // what `archiveFreshness` hands a screen.
    stale: staleOf(sources),
    ms: 0,
  };

  index.transaction(() => {
    for (const source of sources) {
      const previous = known.get(source.key);
      if (
        options.full !== true && previous !== undefined
        && previous.bytes === source.bytes && previous.mtimeMs === source.mtimeMs
      ) {
        report.skipped += 1;
        continue;
      }

      // **OUT OF TIME, SO THIS SOURCE IS NOT TOUCHED AT ALL.** `continue` and
      // not `break`: the sources behind this one still get their free
      // comparison, so `skipped` keeps meaning what it means and
      // `dropProseSources` below still sees the whole set — a `break` would
      // make a budgeted run forget every source it never reached.
      if (deadline !== null && Date.now() >= deadline) {
        report.deferred += 1;
        continue;
      }

      // `previous.bytes` is where the last walk STOPPED, which is the archive
      // row's own count or the cap, whichever came first — see the clamp
      // below. Resuming from it is correct on both.
      const appendable = options.full !== true && previous !== undefined
        && source.bytes > previous.bytes
        && previous.bytes < cap
        && lineStartsAt(source.file, previous.bytes);

      const from = appendable && previous !== undefined ? previous.bytes : 0;

      // **TOO BIG FOR A BOUNDED RUN, so it is left whole rather than read
      // part-way.** Checked against what this source would actually READ —
      // its tail on the appendable path and the whole of it otherwise — and
      // before `read` records it, because a caller that scopes work to `read`
      // (`markAnchorsOnTurn`) must not be told a transcript moved that this
      // run never opened.
      if (maxSourceBytes !== null && Math.max(0, source.bytes - from) > maxSourceBytes) {
        report.deferred += 1;
        continue;
      }

      report.read.push(source.key);
      report.readFrom.push(from);

      const fromIndex = appendable && previous !== undefined ? previous.records : 0;
      // A whole re-read replaces what this source contributed; a tail adds to
      // it. Deleting on the tail path would throw away the prose that is still
      // correct and is the whole saving.
      if (!appendable) index.dropProse(source.key);

      /**
       * **The walk STOPS AT THE ARCHIVE ROW, not at the end of the file.**
       *
       * `source.bytes` is where the archive's own scan reached, and it is the
       * number the NEXT run compares against. A walk that ran on to the true
       * end of file wrote a `prose_sources.bytes` LARGER than that row for
       * every transcript still being written — and from then on
       * `source.bytes > previous.bytes` is false, so the source is neither a
       * skip nor a tail but a whole re-read, which re-creates the same skew.
       * It never healed. Measured on this workspace 2026-09-11, five live
       * transcripts: 103.3 MB and 2.0-2.6 s on every single run, against 0
       * bytes and single-digit milliseconds once the two numbers agree.
       *
       * Stopping here is also what `sourcesOf`'s header already says the
       * archive means: a transcript the archive has not scanned is not part of
       * the archive yet, so prose past the row would be words no other surface
       * can show. It is DEFERRED to the next scan, not dropped.
       *
       * The row's count is a line boundary in practice, because the harness
       * appends a record and its newline together; when it is not,
       * `lineStartsAt` sends the next run down the whole re-read that is
       * always correct.
       */
      const budget = Math.max(
        0, Math.min(appendable ? cap - from : cap, source.bytes - from),
      );
      const walked = proseFrom(source, from, fromIndex, budget);
      index.putProse(walked.spans);

      const row: ProseSourceRow = {
        key: source.key,
        sessionId: source.sessionId,
        agentId: source.agentId,
        file: source.file,
        bytes: from + walked.bytesRead,
        mtimeMs: source.mtimeMs,
        records: walked.records,
        spans: (appendable && previous !== undefined ? previous.spans : 0) + walked.spans.length,
        indexedAt: new Date().toISOString(),
      };
      index.putProseSource(row);

      if (appendable) report.appended += 1;
      else report.indexed += 1;
      report.spans += walked.spans.length;
      report.bytesRead += walked.bytesRead;
    }
    report.removed = index.dropProseSources(new Set(sources.map((s) => s.key)));
  });

  report.ms = Date.now() - startedMs;
  return report;
}

/**
 * **Search the archive's prose.**
 *
 * The reader's text is DATA. It is quoted into a single FTS5 phrase, with any
 * `"` doubled, so the characters FTS5 reserves — `"`, `(`, `)`, `*`, `:`, and
 * the bare words `AND`, `OR`, `NOT`, `NEAR` — are searched for rather than
 * obeyed. Unescaped, a reader typing a parenthesis gets `fts5: syntax error`
 * out of a search box; and a reader typing `NOT` would get an answer that
 * silently excludes what they were looking for, which is worse than an error.
 *
 * A phrase is also the right SEMANTICS here and not merely the safe one: on a
 * trigram index a quoted phrase is a contiguous substring, which is what
 * somebody typing a fragment they remember means. Measured on the real corpus:
 * `"byte offset"` as a phrase matches 17 records; unquoted, where it becomes
 * two independent substring terms, it matches 56.
 */
export function searchArchive(
  index: ConversationIndex, query: string, scope: SearchScope = {},
): SearchResult {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_CHARS) {
    return { query: trimmed, searchable: false, note: tooShortNote(trimmed), hits: [] };
  }
  const hits = index.matchProse(
    quoteTerm(trimmed),
    {
      sessionId: scope.sessionId, agentId: scope.agentId, kind: scope.kind ?? SAID_KINDS,
      ...(scope.windows === undefined ? {} : { windows: scope.windows }),
      ...(scope.offset === undefined ? {} : { offset: scope.offset }),
    },
    scope.limit ?? DEFAULT_SEARCH_LIMIT,
  );
  // **A hit is an answer. Only an EMPTY list needs to say what it is empty
  // of** — and it is also the only shape that can be mistaken for one, which
  // is site M10 of
  // `TASK-nine-sites-report-a-measured-zero-for-something-they-could`. Asking
  // the coverage question here rather than above is not only tidier: this
  // function is called once per probe by the per-turn anchor pass
  // (`core/anchor-pass.ts`), and `coverageNote` reads a table.
  if (hits.length > 0) return { query: trimmed, searchable: true, note: null, hits };
  const note = coverageNote(index);
  return { query: trimmed, searchable: note === null, note, hits };
}

/**
 * **What an EMPTY answer is empty of** — `null` when the answer is a
 * measurement, a sentence when it is not.
 *
 * This module's own header already admitted the defect this closes: *"until a
 * caller runs it the table is EMPTY rather than stale, and an empty table
 * answers nothing rather than answering wrongly"* — and `searchArchive` then
 * answered `searchable: true, note: null, hits: []`, which every consumer draws
 * as *the archive does not contain this*. A retrieval mission finds no pointers
 * and presents that as "the archive holds no material about this"
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
 *
 * The comparison is the one report 3 asked for: `proseSources().size` against
 * the archive's own source count. Three answers rather than two, because the
 * middle one is real and common:
 *
 *  - **Nothing indexed, and there ARE transcripts.** Nothing was searched. The
 *    prose index is filled by `mycontext conversation rebuild`, a CLI write
 *    that nothing under `src/ui/` may perform, so this is the state every
 *    workspace is in until somebody runs it — not an edge case.
 *  - **Some indexed, and fewer than the archive holds.** The phrase is absent
 *    from the part that was indexed, which is not the question that was asked.
 *  - **Everything indexed, including an EMPTY archive.** Zero of zero is
 *    complete coverage, and "this archive does not hold that phrase" is then a
 *    true and useful answer. Reporting it as a fault would invent one out of a
 *    fresh workspace — the measured zero this whole standard exists to protect.
 *
 * **It counts `sourcesOf`'s set without calling `sourcesOf`, and that is
 * deliberate rather than a duplication.** The set is the same one
 * `buildSearchIndex` indexes against — every session row, plus every lane under
 * it — but `sourcesOf` also `statSync`s each transcript to answer `fileBytes`,
 * which is real I/O this question does not need. `searchArchive` is called once
 * per probe by the per-turn anchor pass, and every one of those probes that
 * finds nothing would pay for a stat per transcript. Here it is two table
 * reads and no filesystem at all.
 */
function coverageNote(index: ConversationIndex): string | null {
  const indexed = index.proseSources().size;
  let held = 0;
  for (const row of index.all()) held += 1 + index.subagentsOf(row.sessionId).length;
  if (indexed >= held) return null;
  if (indexed === 0) {
    return `my_context: the prose index holds nothing, and this archive holds ${held} `
      + `transcript(s) — so nothing was searched, and this is not an answer of "nothing found". `
      + `Build it with \`mycontext conversation rebuild\`, then search again.`;
  }
  return `my_context: the prose index covers ${indexed} of the ${held} transcript(s) this archive `
    + `holds, so this search read part of it and found nothing there. That is not an answer about `
    + `the archive. Bring it up to date with \`mycontext conversation rebuild\`, then search again.`;
}

/* ── THE READER'S SEARCH: THREE READINGS OF ONE QUERY — `semantic/4` ────────
 *
 * `reports/2026-09-16-the-search-grammar.md` §5, committed at `c5e372dd`, is
 * the brief and every number below is its measurement rather than a new one.
 * The complaint it answers, in the owner's words on 2026-09-16: *"the search
 * in conversation is not smart, it let me search for a specific string and i
 * could not find more complex cases"*. The missing feature is not regex and
 * not a checkbox — HIS TWO WORDS ARE REQUIRED TO BE ADJACENT and nothing lets
 * him say *near* instead. Measured over 1,420 two-word phrases he actually
 * typed: as a phrase 31.7% return anything (median 3 spans); as
 * `NEAR(…, 30)` 99.6% (median 4); AND-ed 100% (median 38). The whole of the
 * complaint sits in that row, and the answer costs no dependency, no dialog
 * and — `§5`'s own line — **no new control at all.**
 */

/**
 * **One term, quoted into FTS5 as DATA.**
 *
 * `searchArchive`'s rule one level down: `"` is doubled, so the characters
 * FTS5 reserves — `"`, `(`, `)`, `*`, `:`, and the bare words `AND`, `OR`,
 * `NOT`, `NEAR` — are searched for rather than obeyed. This is the single
 * spelling of it, so a tier and the phrase it nests inside cannot escape the
 * reader's text two different ways.
 */
export function quoteTerm(term: string): string {
  return '"' + term.replace(/"/g, '""') + '"';
}

/**
 * **The distance the middle reading admits, and it is in CHARACTERS.**
 *
 * §2.1, and it is documented nowhere because it is not FTS5's documented
 * behaviour: FTS5 counts `NEAR` in TOKENS, and a trigram tokenizer emits one
 * token per character position, so the token window IS a character window.
 * **LAW: `NEAR(a b, N)` matches when at most `N-2` characters separate the two
 * substrings** — held on every N tried and pinned at both boundaries in
 * `test/core/search-grammar.test.ts`.
 *
 * In readable units, `NEAR(…, 12)` is *"in the same clause"*, `NEAR(…, 30)` is
 * *"in the same sentence"*, `NEAR(…, 200)` is *"in the same paragraph"*. 30 is
 * chosen against the measurement and not by feel: over the 1,420 two-word
 * phrases the owner typed, `NEAR 30` reaches 99.6% of what AND reaches and
 * hands back a TENTH as many spans (median 4 against 38). It is a free gift
 * from the tokenizer the Hebrew measurement already paid for.
 */
export const NEAR_CHARS = 30;

/**
 * **The three readings of one query, as FTS5 strings, in the order they are
 * shown.**
 *
 * They are strictly nested for terms of three characters or more — §2.2
 * checked the rowid SETS on 178 pairs, phrase ⊆ NEAR 30 in 178/178 and
 * NEAR 30 ⊆ AND in 178/178 — so an answer that shows phrase hits, then NEAR
 * hits, then AND hits **cannot lose a hit the shipped search returns today**.
 * That containment is the whole argument for the shape, and it is why these
 * are one function rather than three call sites.
 *
 * **`phrase` is a parameter and defaults to the terms rejoined.** The reader's
 * phrase tier is not the terms rejoined: it keeps the words this index cannot
 * match as terms (§3 Finding 2 — `"הם רשות"` matches as one substring and
 * matches nothing as a boolean) and it keeps the spacing he typed. The default
 * is what `scripts/measure-search-grammar.ts` measures with, where there is no
 * reader and no short word.
 */
export function tiersOf(terms: string[], near: number, phrase = terms.join(' ')): string[] {
  const q = terms.map(quoteTerm);
  return [quoteTerm(phrase), `NEAR(${q.join(' ')}, ${near})`, q.join(' AND ')];
}

/** Which reading a hit came back from, and it is an ORDER as well as a name. */
export type SearchTier = 'phrase' | 'near' | 'both';

/** The three, in the order they are asked and shown. Hebrew fixes it — see §3. */
export const SEARCH_TIERS: readonly SearchTier[] = ['phrase', 'near', 'both'];

/** One hit, and which of the three readings found it first. */
export interface TieredHit extends ProseHit {
  tier: SearchTier;
}

/**
 * What one reading did — asked, bounded, and how much it did not hand back.
 *
 * `matched` is COUNTED and not inferred (`ConversationIndex.countProse`), for
 * `INV-nothing-is-dropped-silently`: ordering is not filtering, and a set that
 * is truncated says so AND says by how much. It is this reading's own total in
 * scope, so it includes the spans an earlier tier already showed — the three
 * nest, and pretending otherwise would need a fourth query per tier to
 * subtract them.
 */
export interface TierAnswer {
  tier: SearchTier;
  /** The FTS5 expression actually sent, so a reader of a test can see it. */
  match: string;
  /**
   * **Hits this reading CONTRIBUTED** — the ones an earlier reading had not
   * already shown, which is exactly the number of rows drawn under its
   * heading. It is not `matched` minus anything: the readings nest, so what an
   * earlier one took is not a loss, and the screen's sentence says `shown`
   * and `matched` as the two different things they are rather than subtracting
   * one from the other and printing a number that is true of neither.
   */
  shown: number;
  /** Spans this reading matches in scope, counted — its own total, not the union's. */
  matched: number;
  /** The bound stopped this reading short of `matched`. */
  bounded: boolean;
}

/**
 * **The reader's answer**, which is `SearchResult` plus the three things that
 * cannot be read off a flat list of hits: which reading each hit came from,
 * which of his words the index cannot match, and what he excluded.
 */
export interface TieredSearchResult {
  /** The query as it was searched — trimmed, never rewritten. */
  query: string;
  /** False when nothing here could be searched at all. Then `hits` is empty. */
  searchable: boolean;
  /** Why not, in a sentence a reader can act on. `null` when it was searched. */
  note: string | null;
  /** The words that went into the boolean readings, in the order he typed. */
  terms: string[];
  /**
   * **The words this index cannot match at all, kept rather than dropped.**
   *
   * §5 TWO: the three-character floor moves from the QUERY to the TERM and
   * SAYS so. A short word stays glued into the phrase reading, which can still
   * match it; what it may not do is enter a boolean, where `"ui" AND "search"`
   * returns 0 while `"search"` alone returns 654 and NOTHING says why. 21.0%
   * of the 104,343 words the owner has typed are under the floor, and in
   * Hebrew it is 14.5% of word OCCURRENCES and 24.9% of adjacent word pairs.
   */
  short: string[];
  /** The words written `-word`, which every reading excludes. */
  excluded: string[];
  /** One entry per reading asked, in `SEARCH_TIERS` order. */
  tiers: TierAnswer[];
  hits: TieredHit[];
  /** **Which kinds of span this answer is over** — see `SearchScope.kind`. */
  kinds: ProseKind[];
  /**
   * **WHAT THE KINDS HE DID NOT ASK FOR HOLD**, counted — `null` when he asked
   * for all of them and there is nothing left out.
   *
   * `semantic/10`, and it is the line that makes a default of *said* honest
   * rather than a quiet refusal. A reader typing a command he ran into a
   * search that reads only what was SAID gets zero hits, and zero is the same
   * shape as "the archive does not contain this". This is the difference, and
   * it is a COUNT rather than a flag because *"and 47 more in what you ran"*
   * is actionable and *"there might be more somewhere"* is not.
   * `INV-nothing-is-dropped-silently`, and `SearchResult.searchable` is the
   * same bargain one layer down.
   *
   * It is counted over the BROADEST reading that was sent, which is the widest
   * net this query casts, so the number cannot understate what switching would
   * find. One `countProse` per search — measured on the real archive in
   * `reports/2026-09-16-indexing-what-was-done.md`.
   */
  elsewhere: { kinds: ProseKind[]; matched: number } | null;
}

/** One query, read into its parts. Nothing here touches the index. */
export interface ParsedQuery {
  /** The text of the phrase reading — his positive words, short ones kept. */
  phrase: string;
  /** Words long enough for a trigram index to match. */
  terms: string[];
  /** Words too short for it, kept in `phrase` and disclosed. */
  short: string[];
  /** Words he wrote `-word`. */
  excluded: string[];
}

/**
 * **Read one query into its parts — and there is no other syntax.** §5 THREE.
 *
 * A leading `-` on a whitespace-delimited word of three or more characters
 * excludes it. It is the only operator in the whole survey that every surveyed
 * surface has (Gmail `-`, GitHub `NOT`, notmuch `not`/`-`, ripgrep `-v`,
 * Elasticsearch `simple_query_string` `-`) and the one thing tiering alone
 * cannot do. It is safe because it is SUBTRACTIVE: a reader who types `-foo`
 * and gets a smaller list learns the rule in one try.
 *
 * **Anything else that looks like syntax is a literal**, on Elasticsearch's
 * rule — *"does not return errors for invalid syntax. Instead, it ignores any
 * invalid parts of the query string"*. A `-` inside a word (`foo-bar`), a lone
 * `-`, a `-` on a word the index could not match anyway: all of them are
 * characters to search for. **This function cannot throw**, which is the whole
 * difference between a grammar that can live behind a keystroke and one that
 * cannot: lunr throws `QueryParseError` in twelve places including on a
 * trailing colon, and a search box on its second keystroke cannot throw.
 *
 * Hebrew does not collide with it: Hebrew's hyphen is *maqaf* (`־`, U+05BE),
 * not ASCII `-`.
 *
 * **`phrase` is the trimmed query UNCHANGED when nothing was excluded**, which
 * is what keeps §2.2's containment true: the first reading is byte for byte
 * the query `searchArchive` sends today, spacing and all, so the tiered answer
 * cannot lose a hit the shipped search returns. Only an exclusion rebuilds it,
 * because the `-word` he typed is not part of what he is looking for.
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/);
  const positive: string[] = [];
  const terms: string[] = [];
  const short: string[] = [];
  const excluded: string[] = [];
  for (const token of tokens) {
    if (token.startsWith('-') && token.length - 1 >= MIN_QUERY_CHARS) {
      excluded.push(token.slice(1));
      continue;
    }
    positive.push(token);
    if (token.length >= MIN_QUERY_CHARS) terms.push(token);
    else short.push(token);
  }
  return {
    phrase: excluded.length === 0 ? trimmed : positive.join(' '),
    terms,
    short,
    excluded,
  };
}

/**
 * **Every reading carries every exclusion.**
 *
 * The reading is WRAPPED before the `NOT` so that the grouping is written down
 * rather than inherited from an operator precedence this project has not
 * measured. **What was measured** (2026-09-16, and pinned in
 * `test/core/conversation-search.test.ts`): for the three readings this
 * function actually emits — a phrase, a `NEAR` and an `AND`, never an `OR` —
 * `("a" AND "b") NOT "c"` and `"a" AND "b" NOT "c"` return the SAME rows. So
 * the parentheses are explicitness and cost nothing; they are not a repair,
 * and saying they were would be a claim with no number behind it. §2 measured
 * that parentheses work on this index at all
 * (`("byte" OR "offset") AND "trigram"` → 62).
 */
function excluding(match: string, excluded: readonly string[]): string {
  return excluded.reduce((m, term) => `(${m}) NOT ${quoteTerm(term)}`, match);
}

/** The refusal a query too short for the tokenizer gets. One spelling, two callers. */
function tooShortNote(trimmed: string): string {
  return `my_context: "${trimmed}" is shorter than ${MIN_QUERY_CHARS} characters, and the `
    + 'archive\'s index matches runs of three — so this cannot be searched for at all. It '
    + `is not an answer of "nothing found". Type at least ${MIN_QUERY_CHARS} characters.`;
}

/**
 * Where one hit is, spelled once. A lane and its session share a record index.
 *
 * **`kind` is part of the key, since 2026-09-16.** A record that says
 * something and then calls a tool is TWO spans at ONE byte offset
 * (`ProseSpan`), so a key over position alone makes the second of them
 * invisible: the tier loop treats it as already seen and drops it without a
 * word, which is the silent loss `INV-nothing-is-dropped-silently` forbids —
 * and it would fall on the NEW kind, so the feature would half-work and look
 * like it had worked.
 */
function hitKey(hit: ProseHit): string {
  // The separator is a NUL, written as an ESCAPE. A raw NUL in the source
  // makes the file binary to git, and this project lost the diff on
  // `screens/conversations.js` for days that way; `npm run check:text-files`
  // is the gate that catches it. The escape sends the identical byte.
  return `${hit.sessionId}\u0000${hit.agentId ?? ''}\u0000${hit.byteOffset}\u0000${hit.kind}`;
}

/**
 * **READ ONE QUERY THREE WAYS AND ANSWER IN TIERS** — §5 ONE, the reader's
 * search, and the only caller is `GET /api/conversations/search`.
 *
 * ── WHY THIS IS NOT `searchArchive` WITH A FLAG ───────────────────────────
 *
 * `searchArchive` is still the one-phrase reading and every other caller keeps
 * it, because their query is not prose a person typed: `anchor-pass.ts` sends
 * `"|---"` and `"| ---"` — machine probes — and PAGES through them with
 * `offset` over `matchProse`'s total order, 25 pages of 200. That paging is
 * the repair for the 2026-09-15 incident where the automatic marking stopped
 * for half an hour, and a union of THREE orders has no stable global offset to
 * page: page 2 of a tiered answer is not the rows after page 1. Splitting
 * `"| ---"` on whitespace would also change what a probe means. So the reader
 * gets a reading of a query, and a probe gets a substring, and neither is a
 * flag on the other. `retrieval/from-selection.ts` searches item-id slugs for
 * the same reason — they are names, not prose.
 *
 * ── THE SHAPE, AND WHAT EACH PART IS FOR ──────────────────────────────────
 *
 *   — **phrase**, *"your words, next to each other"* — today's answer,
 *     unchanged, FIRST. §3 Finding 2 is why it is first and Hebrew is the only
 *     reason: `"הם רשות"` matches 1 span as one substring and 0 as a boolean,
 *     because `הם` is two characters. "Phrase is a subset of AND" is FALSE in
 *     Hebrew, so a surface that REPLACED the substring reading would lose real
 *     hits and say nothing.
 *   — **near**, *"in the same sentence"* — `NEAR(…, 30)`, see `NEAR_CHARS`.
 *   — **both**, *"both somewhere in the same turn"* — plain `AND`.
 *
 * **A one-word query is unchanged**: fewer than two matchable terms and only
 * the phrase reading is sent, which is exactly today's query, plus whatever
 * `-word` he excluded. That is deliberately AC's own line — the readings
 * collapse, so sending three would be two queries spent to return the same
 * rows.
 *
 * ── RANKING IS ALLOWED NOW, AND IT IS SPENT INSIDE A TIER ─────────────────
 *
 * `RULE-search-may-rank-its-results-and-the-model-it-asks-is-the`, owner
 * ruling 2026-09-16, lifts `filterItems`' refusal. §5 was written under the
 * old constraint and said so. **The tier is kept anyway, because it is better
 * than a score and not a substitute for one**: a tier tells the reader WHY a
 * result is where it is and `bm25()` cannot. What the ruling buys is the
 * ordering WITHIN a tier, and it costs nothing to take — `matchProse` already
 * returns `ORDER BY bm25() ASC`, so each reading arrives best-first and this
 * function only has to not re-sort across the tiers.
 *
 * ── ORDERING IS NOT FILTERING ─────────────────────────────────────────────
 *
 * `INV-nothing-is-dropped-silently`, and the shape NOT to rebuild is
 * `nothing-to-do-and-could-not-look-are-different-answers`: the anchor pass
 * applied a top-200 ranking BEFORE the byte scope and silently stopped. **A
 * bound is not a scope.** Here the scope is in the `WHERE` of every reading —
 * `proseWhere`, one spelling — and the bound is a `LIMIT` after it, per
 * reading, disclosed: `TierAnswer.matched` is COUNTED when a reading fills its
 * bound, so "there are more" carries a number rather than a shrug. A reading
 * that came back short needs no count and is not charged for one.
 */
export function searchArchiveTiered(
  index: ConversationIndex,
  query: string,
  scope: Omit<SearchScope, 'offset'> = {},
): TieredSearchResult {
  const trimmed = query.trim();
  // **The kinds are decided BEFORE the refusals**, so a query that is too
  // short still says which half of the archive it would have searched. A
  // reader who has switched to *ran* and then types two characters is told the
  // floor, not silently moved back to *said*.
  const kinds = asKinds(scope.kind ?? SAID_KINDS);
  const empty = {
    query: trimmed,
    terms: [] as string[],
    short: [] as string[],
    excluded: [] as string[],
    tiers: [] as TierAnswer[],
    hits: [] as TieredHit[],
    kinds: [...kinds],
    elsewhere: null,
  };
  if (trimmed.length < MIN_QUERY_CHARS) {
    return { ...empty, searchable: false, note: tooShortNote(trimmed) };
  }
  const parsed = parseSearchQuery(trimmed);
  // **An exclusion with nothing to exclude FROM.** `-foo` is four characters
  // and passes the query floor, and there is no reading to send: the phrase is
  // empty and `NOT "foo"` alone is not a search. It is a refusal with a reason
  // rather than a zero, for the same reason two characters is.
  if (parsed.phrase === '') {
    return {
      ...empty,
      excluded: parsed.excluded,
      searchable: false,
      note:
        'my_context: every word here is an exclusion, so there is nothing to search FOR — '
        + `"-${parsed.excluded[0] ?? ''}" says what to leave out of an answer and no answer was `
        + 'asked for. Type the words you remember, and put the `-` only on the ones you want gone.',
    };
  }
  const limit = scope.limit ?? DEFAULT_SEARCH_LIMIT;
  const where = {
    sessionId: scope.sessionId, agentId: scope.agentId, kind: kinds,
    ...(scope.windows === undefined ? {} : { windows: scope.windows }),
  };
  const readings = tiersOf(parsed.terms, NEAR_CHARS, parsed.phrase)
    .map((match, i) => ({ tier: SEARCH_TIERS[i] as SearchTier, match: excluding(match, parsed.excluded) }))
    // **Fewer than two matchable terms and the three collapse into one.** The
    // boolean readings of a single term are that term, which is BROADER than
    // the phrase he typed rather than a different reading of it.
    .slice(0, parsed.terms.length < 2 ? 1 : SEARCH_TIERS.length);

  const seen = new Set<string>();
  const hits: TieredHit[] = [];
  const tiers: TierAnswer[] = [];
  for (const reading of readings) {
    const found = index.matchProse(reading.match, where, limit);
    let shown = 0;
    for (const hit of found) {
      const key = hitKey(hit);
      // The three nest, so the first reading to return a span is the most
      // literal one that holds it, and that is the tier it is shown under.
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ ...hit, tier: reading.tier });
      shown += 1;
    }
    const bounded = found.length >= limit;
    tiers.push({
      tier: reading.tier,
      match: reading.match,
      shown,
      matched: bounded ? index.countProse(reading.match, where) : found.length,
      bounded,
    });
  }
  return {
    query: trimmed,
    searchable: true,
    note: null,
    terms: parsed.terms,
    short: parsed.short,
    excluded: parsed.excluded,
    tiers,
    hits,
    kinds: [...kinds],
    // **THE ONE EXTRA QUERY, AND WHAT IT BUYS.** `readings` is ordered
    // narrowest-first, so its LAST entry is the broadest net this query casts
    // — counting the unasked kinds over that reading cannot understate what
    // switching would find. `null` when nothing was left out, so a surface
    // that prints this line only prints it when there is something to say.
    elsewhere: elsewhereOf(index, readings.at(-1)?.match ?? null, where, kinds),
  };
}

/** Kinds as a list, whichever way the caller spelled them. */
function asKinds(kind: ProseKind | readonly ProseKind[]): readonly ProseKind[] {
  return typeof kind === 'string' ? [kind] : kind;
}

/**
 * **How much the kinds this query did NOT ask for hold**, over the same scope
 * and the same reading — see `TieredSearchResult.elsewhere`.
 *
 * The scope is reused with only `kind` swapped, which is what makes the number
 * comparable to the one beside it: a count taken over a differently-built
 * `WHERE` would be a disclosure about a different set of rows, and
 * `proseWhere`'s own header is about exactly that cost.
 */
function elsewhereOf(
  index: ConversationIndex,
  match: string | null,
  where: { sessionId?: string; agentId?: string | null; kind: readonly ProseKind[];
    windows?: { sourceKey: string; fromByte: number }[] },
  asked: readonly ProseKind[],
): { kinds: ProseKind[]; matched: number } | null {
  const rest = kindsBesides(asked);
  if (rest.length === 0 || match === null) return null;
  return { kinds: [...rest], matched: index.countProse(match, { ...where, kind: rest }) };
}

/* ── FIND IN THE DOCUMENT I AM READING — `semantic/8` ──────────────────────
 *
 * `TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you`, owner
 * ruling 2026-09-16. Two halves; this file owns the first and
 * `screens/conversations.js` owns the second.
 *
 * ── WHY THIS IS NOT `searchArchiveTiered`, AND NOT A FLAG ON IT ───────────
 *
 * `semantic/4`'s tiered search is the ARCHIVE's answer and it stays exactly
 * as it landed. Its own lane flagged the collision for this one: **it
 * de-duplicates ACROSS tiers, and a find bar needs DOCUMENT ORDER.** Those
 * are two orderings of one result set, so here the tier is not consulted at
 * all and the answer comes back in record order. Nothing about
 * `searchArchiveTiered` changes, and nothing here replaces it.
 *
 * ── AND WHY IT DOES NOT ASK FTS5 ─────────────────────────────────────────
 *
 * Because FTS5 cannot answer it, twice over:
 *
 *   1. **It has no `offsets()`.** Verified against this live index by lane AI:
 *      `offsets(conversation_prose)` fails with *"unable to use function
 *      offsets in the requested context"* — it is an FTS3/4 function.
 *      `highlight()` and `snippet()` return marked-up TEXT, not positions. A
 *      highlight needs positions.
 *   2. **The index is not folded.** That is the whole task. Measured on this
 *      repository's own archive today, 11,364 prose spans:
 *
 *          "..."   FTS5 trigram   463 spans
 *          "..."   plain indexOf  463 spans
 *          "..."   folded       1,024 spans     <- 2.21x
 *          ".."    FTS5 trigram     0 spans     <- under the trigram floor
 *          ".."    folded       1,041 spans
 *
 *      A two-stage shape that asked FTS5 first would hand this function 463
 *      of the 1,024 spans and lose the other 561 SILENTLY, which is the exact
 *      defect the feature exists to remove (`INV-nothing-is-dropped-silently`).
 *      So the scan is over every prose span in the transcript, and the cost of
 *      that is measured below rather than feared.
 *
 * ── WHAT IT COSTS, MEASURED ON THE LARGEST SESSION IN THIS ARCHIVE ───────
 *
 * 11,336 prose spans, 13,206,532 characters, median of 9 runs, 2026-09-16:
 *
 *     proseSpans read                 159.3 ms
 *     scan for "..."                  116.5 ms
 *     scan for "byte offset"          111.5 ms
 *     scan for "the"                  159.9 ms
 *
 * Behind the 250 ms settle the find box already has, one whole-session scan a
 * query. That is affordable and it is the honest shape; the alternative is an
 * index that cannot answer the question being asked.
 */

/**
 * **HOW MANY PROSE SPANS ONE FIND MAY READ.**
 *
 * A bound, not a scope — `nothing-to-do-and-could-not-look-are-different-answers`,
 * and the distinction is why `DocumentFind.capped` exists beside it. The
 * largest transcript in this archive holds 11,336 prose spans, so this is
 * three and a half times the worst case seen; a document that exceeded it
 * would be answered honestly rather than quietly short.
 */
export const FIND_SCAN_CAP = 40_000;

/**
 * **HOW MANY HITS ARE COUNTED INSIDE ONE TURN.**
 *
 * A single turn of terminal output can hold thousands of occurrences of a
 * common letter, and nothing on the screen would ever draw them all. The
 * count stops here and the turn says it stopped, which is the same bargain
 * `TierAnswer.bounded` makes one surface along.
 */
export const FIND_HITS_PER_TURN = 500;

/**
 * **THE MATCHER, LOADED ONCE SO THIS FUNCTION STAYS SYNCHRONOUS.**
 *
 * `src/ui/public/lib/fold.js` is plain JavaScript that the BROWSER also
 * imports, and that is the point of it: the count this function returns and
 * the highlights `screens/conversations.js` paints are computed by the same
 * code, so they cannot come to different answers about what a hit is. Two
 * matchers would be two definitions of the feature.
 *
 * Loaded with a top-level `await import()` exactly as `ui/execute-catalogue.ts`
 * loads `public/lib/palette-defs.js`, and for the reason its header gives: a
 * request handler that had to await a lookup would put an `await` in the
 * middle of an ordering that has none. `allowJs` is off, so a static import
 * of a `.js` file cannot typecheck and the cast is what the boundary costs.
 */
const { findQuery, MODES: FIND_MODES_RAW } = (await import(
  new URL('../ui/public/lib/fold.js', import.meta.url).href
)) as {
  MODES: string[];
  findQuery: (query: string, options?: FindOptions) => {
    ok: boolean;
    error: string | null;
    slow: boolean;
    /**
     * A CODE for a query the chosen mode cannot read — `like`, `quote`,
     * `paren`, `operand`, `empty`, `nearRange` — never a sentence. `fold.js`
     * has no string table and the panel owns the words, in both languages.
     */
    why: string | null;
    mode: string;
    regex: boolean;
    unicode: boolean;
    find?: (
      text: string, limit?: number,
    ) => { from: number; to: number; byteFrom: number; byteTo: number; precise: boolean }[];
  };
};

/**
 * **THE FOUR WAYS A QUERY MAY BE READ, AND THE LIST IS `fold.js`'.**
 *
 * Re-exported rather than re-declared, so the route's parameter vocabulary,
 * the panel's radio group and the matcher's dispatcher are one list. A fifth
 * mode added in `fold.js` is a fifth mode here with nothing to remember.
 */
export const FIND_MODES: readonly string[] = FIND_MODES_RAW;

/**
 * **THE THREE THE OWNER ASKED FOR TWICE** — `semantic/9`. Every field
 * defaults to `false`, and all three `false` is exactly the find that shipped
 * with `semantic/8`.
 *
 * They are DECIDED in `src/ui/public/lib/fold.js` and only threaded here, for
 * the reason that file's header gives: the browser paints with the same
 * matcher this counts with, so a tick box read two ways would put a count on
 * the screen that the highlights under it disagree with.
 */
export interface FindOptions {
  /**
   * **HOW THE QUERY IS READ, AND IT IS ONE OF FOUR** — `semantic/11`.
   *
   * `normal` | `wildcard` | `logical` | `regex`. Exclusive, because "how do I
   * read this string" has one answer at a time; `caseSensitive` and
   * `wholeWord` are a different question and stay independent of it. That is
   * Notepad++'s own shape, which is the tool the owner named.
   *
   * Left out, `regex: true` still means `regex` and everything else means
   * `normal`, so every `semantic/9` caller is unchanged.
   */
  mode?: string;
  /** `Byte` is not `byte`. NFKD folding is UNAFFECTED — two axes, not one. */
  caseSensitive?: boolean;
  /** A boundary at each end that is itself a word character. */
  wholeWord?: boolean;
  /** Deprecated spelling of `mode: 'regex'`, kept so `semantic/9` still runs. */
  regex?: boolean;
}

/**
 * **HOW LONG ONE REGULAR EXPRESSION MAY SCAN FOR.**
 *
 * A literal scan of the largest transcript here costs ~160 ms and is bounded
 * by the text. A regular expression is bounded by the PATTERN: `(a+)+b` over
 * one long span is exponential, and a reader can type that without knowing it
 * — ripgrep's own FAQ is a note about exactly this class
 * (*"a guarantee [of] linear worst case time complexity on all inputs"*, which
 * `RegExp` does not give). So the scan is checked against a clock between
 * spans and stops, with `DocumentFind.timedOut` saying it did.
 *
 * **It cannot interrupt one span**, and that is the honest bound of a
 * single-threaded scan: a pathological pattern over a 900 KB span is inside
 * the engine and this code is not running. What this buys is that a document
 * of 4,580 spans cannot multiply a slow pattern by 4,580.
 */
export const FIND_REGEX_BUDGET_MS = 5_000;

/** One turn of a transcript that holds what the reader typed. */
export interface FoundTurn {
  sessionId: string;
  agentId: string | null;
  recordIndex: number;
  /** Bytes from the start of THAT transcript — what `nodeAtByte` joins on. */
  byteOffset: number;
  kind: string;
  /** Occurrences inside this turn's own words, folded. */
  matches: number;
  /** True when `matches` stopped at `FIND_HITS_PER_TURN` rather than running out. */
  bounded: boolean;
  /**
   * Where the first one starts, in BYTES from the start of the turn's TEXT —
   * never characters, and never from the start of the file. It is the offset
   * currency every anchor and every seek in this project is in, so a caller
   * that wants to mark the point can add it to `byteOffset` without a second
   * opinion about what an offset means.
   */
  firstByte: number;
}

/**
 * What a find over one transcript answers with.
 *
 * **`scanned` and `capped` are the disclosure, and they are not decoration.**
 * A count that silently meant *"in the spans I happened to read"* is worse
 * than no count at all; these two say exactly which spans were read.
 */
export interface DocumentFind {
  /** The query as it was searched — trimmed, never rewritten. */
  query: string;
  /** Prose spans actually read and scanned. */
  scanned: number;
  /** True when `FIND_SCAN_CAP` was reached, so spans exist that were not read. */
  capped: boolean;
  /** The turns that hold it, in DOCUMENT ORDER. */
  turns: FoundTurn[];
  /** Occurrences over all of them, each turn bounded by `FIND_HITS_PER_TURN`. */
  matches: number;
  /**
   * **WHAT THE SCAN COST, IN MILLISECONDS** — `semantic/9`.
   *
   * Served on every answer and not only the slow ones, because a number that
   * appears only when something is wrong teaches a reader nothing about what
   * right looks like. The screen draws it where the item requires it to:
   * beside the regular-expression toggle, which is the mode that can be slow
   * and the one the owner is owed a number for.
   */
  ms: number;
  /**
   * The regular expression could not be compiled, and this is the ENGINE's own
   * message — never a rewrite of it.
   *
   * `null` in every other case, including a valid pattern that matched
   * nothing. A pattern that is wrong and a pattern that is right and finds
   * nothing are two different answers
   * (`nothing-to-do-and-could-not-look-are-different-answers`) and this is the
   * field that keeps them apart.
   */
  error: string | null;
  /**
   * **THE PATTERN COMPILED WITHOUT THE `u` FLAG**, so `.` is one UTF-16 unit
   * rather than one character and an astral character is two of them.
   *
   * Only ever `true` in regex mode, and only for a pattern `u` refuses (see
   * `compileRegex` in `fold.js`, which tries `u` first precisely so that this
   * is rare). It is SERVED rather than swallowed because it changes what the
   * reader's own pattern means, and a matching mode that quietly downgraded
   * itself is the silent-failure shape this file's neighbours are full of.
   */
  codeUnitMode: boolean;
  /** `FIND_REGEX_BUDGET_MS` ran out, so spans exist that were not read. */
  timedOut: boolean;
  /**
   * **A LEGAL PATTERN THAT WAS NOT RUN**, because `fold.js`'
   * `nestedQuantifier` recognises it as the `(X+)+` shape that took
   * **108,785 ms** over this repository's own session on 2026-09-16 — a
   * freeze no budget here can end, because it happens inside one span, inside
   * V8's regex engine, which cannot be interrupted from JavaScript.
   *
   * It is its own field and not an `error`, because it is not an error: the
   * pattern is valid and a different engine would run it. Three answers where
   * a weaker design would have one empty result —
   * `nothing-to-do-and-could-not-look-are-different-answers`.
   */
  refused: boolean;
  /** Which of the four ways the query was read. Echoed, never inferred. */
  mode: string;
  /**
   * **A QUERY THE CHOSEN MODE CANNOT READ, AS A CODE** — `semantic/11`.
   *
   * `like`, `quote`, `paren`, `operand`, `empty`, `nearRange`. A CODE and not
   * a sentence, because the sentence has to exist in two languages and the
   * matcher has no string table: `error` is the regex ENGINE's own words and
   * is quoted verbatim, and this is the case where there is no engine to
   * quote. `null` whenever the query was read.
   */
  why: string | null;
}

/**
 * **EVERY TURN OF ONE TRANSCRIPT THAT HOLDS WHAT THE READER TYPED, FOLDED.**
 *
 * ── WHAT THIS COUNTS, SAID HERE SO THE SCREEN CAN SAY IT TOO ─────────────
 *
 * It counts **prose spans** — the turns `classifyTurn` calls `prompt` or
 * `answer`. It does NOT count machinery: 47,910 of one session's 52,292
 * records are tool calls, results and hooks, they are in no index, and lane
 * AI's report closes on exactly this gap (*"only 1.08% of the scanned archive
 * is searchable... nothing on any surface tells a reader the scope of what
 * they just searched"*). So the number is *"turns of words that hold it"* and
 * the screen is required to say so — a count a reader reads as "everywhere in
 * this conversation" would be false by two orders of magnitude.
 *
 * ── AND IT IS A TRANSCRIPT, NOT A SESSION ────────────────────────────────
 *
 * `agentId` is passed EXPLICITLY, `null` meaning the session's own
 * transcript, because `proseSpans` reads a session AND its lanes when the
 * field is left out. The document screen draws one file; a count that
 * silently included 263 lanes' turns would describe a document the reader is
 * not looking at.
 */
export function findInDocument(
  index: ConversationIndex,
  query: string,
  scope: { sessionId: string; agentId: string | null },
  options: FindOptions = {},
): DocumentFind {
  const trimmed = query.trim();
  const mode = FIND_MODES.includes(options.mode ?? '') ? (options.mode as string)
    : (options.regex === true ? 'regex' : 'normal');
  const blank: DocumentFind = {
    query: trimmed,
    scanned: 0,
    capped: false,
    turns: [],
    matches: 0,
    ms: 0,
    error: null,
    codeUnitMode: false,
    timedOut: false,
    refused: false,
    mode,
    why: null,
  };
  // **No floor of three characters here, and that is deliberate.**
  // `MIN_QUERY_CHARS` is a property of the TRIGRAM INDEX, which this does not
  // use: a JavaScript scan matches one character as happily as ten, and 14.5%
  // of the Hebrew occurrences in this corpus are words under three characters
  // (`reports/2026-09-16-the-search-grammar.md` §3 Finding 1). Refusing them
  // here would import a bound from a mechanism that is not involved.
  if (trimmed === '') return blank;

  /*
   * **COMPILED ONCE, BEFORE A SINGLE SPAN IS READ** — `semantic/9`.
   *
   * Two things follow from putting this here rather than inside the loop. A
   * pattern costs one `new RegExp` for a 4,580-span document instead of
   * 4,580. And an INVALID pattern is one answer with the engine's message on
   * it, drawn beside the box, rather than 4,580 silent catches that leave the
   * reader looking at an empty result they cannot tell from "not there".
   */
  const compiled = findQuery(trimmed, options);
  if (compiled.ok !== true || compiled.find === undefined) {
    return {
      ...blank,
      error: compiled.error,
      codeUnitMode: false,
      refused: compiled.slow === true,
      why: compiled.why ?? null,
    };
  }
  const { find } = compiled;

  const spans = index.proseSpans({ sessionId: scope.sessionId, agentId: scope.agentId },
    FIND_SCAN_CAP);
  const turns: FoundTurn[] = [];
  let matches = 0;
  let timedOut = false;
  const began = performance.now();
  /*
   * The clock is only consulted OUTSIDE the plain mode. A literal scan is
   * bounded by the text — 160 ms on the largest transcript here — so a budget
   * over it would be a bound that has never once been reached, drawn on a
   * screen as though it might be.
   *
   * **AND `semantic/11` WIDENED IT FROM REGEX TO THE OTHER TWO**, which is a
   * decision and not a tidy-up. A wildcard is bounded by (occurrences of its
   * first piece) x (pieces) and a logical query by (terms) x (span), so both
   * are polynomial rather than exponential and neither can freeze one span the
   * way `(X+)+` did. But `a*a*a*a*a*a` over a transcript of terminal output is
   * a real multiplication across 4,582 spans, and a bound that exists for one
   * polynomial mode and not for its two neighbours would be a bound nobody
   * could state.
   */
  const deadline = mode === 'normal' ? Infinity : began + FIND_REGEX_BUDGET_MS;
  for (const span of spans) {
    if (performance.now() > deadline) { timedOut = true; break; }
    const found = find(span.text, FIND_HITS_PER_TURN);
    if (found.length === 0) continue;
    matches += found.length;
    turns.push({
      sessionId: span.sessionId,
      agentId: span.agentId,
      recordIndex: span.recordIndex,
      byteOffset: span.byteOffset,
      kind: span.kind,
      matches: found.length,
      bounded: found.length >= FIND_HITS_PER_TURN,
      firstByte: found[0]?.byteFrom ?? 0,
    });
  }
  // **DOCUMENT ORDER, and it is restored rather than asked for.**
  // `proseSpans` answers `ORDER BY at DESC` because its own caller wants what
  // was worked on lately; a find bar wants the first hit in the file to be
  // first. `recordIndex` is the transcript's own ordinal, which is what the
  // document screen draws in, so sorting on it here is the same order the
  // reader is scrolling through.
  turns.sort((a, b) => a.recordIndex - b.recordIndex);
  return {
    query: trimmed,
    scanned: spans.length,
    capped: spans.length >= FIND_SCAN_CAP,
    turns,
    matches,
    ms: Math.round(performance.now() - began),
    error: null,
    codeUnitMode: compiled.regex === true && compiled.unicode !== true,
    timedOut,
    refused: false,
    mode,
    why: null,
  };
}
