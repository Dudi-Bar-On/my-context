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
  ConversationIndex, ConversationIndexUninitializedError, classifyTurn,
  transcriptDir, truncatedScan, type ConversationRow,
} from '../core/conversation-index.ts';
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

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
 */
function workspaceCwd(ws: Workspace): string {
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
   * The transcript is still on disk. `false` is the pruned-session state the
   * spec names — the list must SHOW that a session's file is gone rather than
   * failing to load, and it is the strongest argument for export.
   */
  present: boolean;
  scannedAt: string;
}

export interface ConversationListBody {
  conversations: ConversationSummary[];
  /** Indexed sessions in total, however few this page carries. */
  total: number;
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
}

function summarise(row: ConversationRow): ConversationSummary {
  let present = false;
  try {
    present = statSync(row.file).isFile();
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
    scannedAt: row.scannedAt,
  };
}

const REBUILD_COMMAND = 'mycontext conversation rebuild';

export function apiConversations(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['limit', 'offset']) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  const askedLimit = boundedDigits(url, 'limit');
  if (askedLimit === null) {
    return badRequest('limit must be a whole number of rows, written in digits.');
  }
  const askedOffset = boundedDigits(url, 'offset');
  if (askedOffset === null) {
    return badRequest('offset must be a whole number of rows, written in digits.');
  }
  const limit = Math.min(askedLimit ?? CONVERSATION_LIST_CAP, CONVERSATION_LIST_CAP);
  const offset = askedOffset ?? 0;
  const dir = transcriptDir(process.env, workspaceCwd(ws));

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError) {
      // **A 200, not a 404 and not a 500.** The question was answered: this
      // workspace holds no conversation index. `server-e2e.test.ts` accepts
      // 200 and 404 and nothing else, and more importantly a reader needs the
      // difference between "nothing scanned" and "nothing there".
      const body: ConversationListBody = {
        conversations: [], total: 0, limit, offset, omitted: 0, more: false,
        indexed: false, dir, rebuild: REBUILD_COMMAND, missing: 0,
      };
      return { status: 200, body };
    }
    throw err;
  }

  try {
    const all = index.all();
    const page = all.slice(offset, offset + limit);
    const conversations = page.map(summarise);
    const body: ConversationListBody = {
      conversations,
      total: all.length,
      limit,
      offset,
      // Every indexed session this answer does not carry — the ones `offset`
      // skipped AS WELL AS the ones past `limit`, so `conversations.length +
      // omitted` is the total and no second field can disagree with it.
      // `/api/coverage`'s rule, verbatim.
      omitted: all.length - conversations.length,
      more: offset + conversations.length < all.length,
      indexed: true,
      dir,
      rebuild: REBUILD_COMMAND,
      missing: conversations.filter((c) => !c.present).length,
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
    if (err instanceof ConversationIndexUninitializedError) {
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

export function registerConversationRoutes(): void {
  registerRoute('GET', '/api/conversations', {
    kind: 'json', handle: (ctx: ApiContext) => apiConversations(ctx.ws, ctx.url),
  });
  registerRoute('GET', '/api/conversations/:id', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversation(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
