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
 */
export function buildSearchIndex(
  index: ConversationIndex,
  options: { full?: boolean; cap?: number } = {},
): SearchBuildReport {
  const startedMs = Date.now();
  const cap = options.cap ?? MAX_SCAN_BYTES;
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

      // `previous.bytes` is the position the last walk REACHED, so resuming
      // from it is correct even when that walk stopped at the cap.
      const appendable = options.full !== true && previous !== undefined
        && source.bytes > previous.bytes
        && previous.bytes < cap
        && lineStartsAt(source.file, previous.bytes);

      const from = appendable && previous !== undefined ? previous.bytes : 0;
      const fromIndex = appendable && previous !== undefined ? previous.records : 0;
      // A whole re-read replaces what this source contributed; a tail adds to
      // it. Deleting on the tail path would throw away the prose that is still
      // correct and is the whole saving.
      if (!appendable) index.dropProse(source.key);

      const walked = proseFrom(source, from, fromIndex, appendable ? cap - from : cap);
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
