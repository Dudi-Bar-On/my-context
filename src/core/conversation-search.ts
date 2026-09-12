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
import {
  ConversationIndex, MAX_SCAN_BYTES, type ProseHit, type ProseSpan, type ProseSourceRow,
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

/** Where to look. Omitting everything searches this workspace's whole archive. */
export interface SearchScope {
  /** One session — and its lanes, unless `agentId` narrows further. */
  sessionId?: string;
  /** One lane, or `null` for a session's own transcript only. */
  agentId?: string | null;
  /** `'prompt'` for what he typed, `'answer'` for what was said back. */
  kind?: 'prompt' | 'answer';
  limit?: number;
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
  ms: number;
}

/**
 * The words of one record, or `''` when it holds none.
 *
 * A prompt with nothing attached is a plain string; the same prompt carrying
 * files is an array with a `text` block in it, and an answer is always the
 * array form. Anything else — a `tool_use`, a `tool_result`, a `thinking`
 * block — contributes nothing, which is deliberate and is NOT this build's
 * definition of noise: `classifyTurn` has already decided that one record
 * earlier, and this only reads what the record says.
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
    });
    for (const lane of index.subagentsOf(row.sessionId)) {
      found.push({
        key: lane.agentId,
        sessionId: lane.sessionId,
        agentId: lane.agentId,
        file: lane.file,
        bytes: lane.bytes,
        mtimeMs: lane.mtimeMs,
      });
    }
  }
  return found;
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
    const kind = classifyTurn(record.record.type, (record.record.message as
      { content?: unknown } | undefined)?.content);
    // **The filter is `classifyTurn` and nothing else.** A second definition of
    // what counts as words would drift from the one the list screen's prompt
    // and answer columns already rest on.
    if (kind === 'machinery') continue;
    const text = proseOf(record.record);
    if (text.trim() === '') continue;
    spans.push({
      sourceKey: source.key,
      sessionId: source.sessionId,
      agentId: source.agentId,
      recordIndex: record.index,
      byteOffset: record.byteOffset,
      kind,
      at: stampOf(record.record),
      text,
    });
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
    return {
      query: trimmed,
      searchable: false,
      note:
        `my_context: "${trimmed}" is shorter than ${MIN_QUERY_CHARS} characters, and the `
        + 'archive\'s index matches runs of three — so this cannot be searched for at all. It '
        + 'is not an answer of "nothing found". Type at least '
        + `${MIN_QUERY_CHARS} characters.`,
      hits: [],
    };
  }
  const phrase = `"${trimmed.replace(/"/g, '""')}"`;
  return {
    query: trimmed,
    searchable: true,
    note: null,
    hits: index.matchProse(
      phrase,
      { sessionId: scope.sessionId, agentId: scope.agentId, kind: scope.kind },
      scope.limit ?? DEFAULT_SEARCH_LIMIT,
    ),
  };
}
