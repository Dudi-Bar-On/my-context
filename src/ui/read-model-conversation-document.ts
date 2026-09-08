/**
 * A session read as ONE DOCUMENT — the outline you scroll and the nodes you
 * read — `plan:archive seq:7`, `seq:8` and `seq:13`, which are one surface and
 * are built here together.
 *
 * ── WHAT WAS ON THE SCREEN BEFORE THIS, MEASURED ──────────────────────────
 *
 * The owner opened his own session and the screen drew *"Showing entries 0–50
 * of 24,757"* with **no way to reach entry 51**: `conversations.js` asked
 * `?limit=50&offset=0` and no next control existed. Worse, those fifty were
 * almost entirely book-keeping — 1 prompt, 0 answers, 49 folded "0 characters"
 * rows. He had asked for *"a way to browse, retrieve and display the content
 * at a later time"* and got the first fifty of twenty-four thousand, mostly
 * machinery.
 *
 * `seq:7` rules the fix out of the obvious shape: **a pager is not this.**
 * *"view the session on a SEQUENTIAL DOCUMENT with markers for prompts and
 * answers AND NOT BROKEN TO PIECES — user should have a similar experience
 * like SCROLLING OVER A TERMINAL."* The design of record already said *"page
 * OR VIRTUALISE"* and only the paging half was attempted. So the engineering
 * problem is VIRTUALISED SCROLLING, and this module is the server half of it.
 *
 * ── THE MEASUREMENT THAT DECIDES THE WHOLE DESIGN ─────────────────────────
 *
 * Measured on the owner's own transcript, 2026-09-08 —
 * `595db3b1-….jsonl`, **63,871,429 bytes and 27,752 records** (it grew 2.7 MB
 * while this was being built, which is why nothing here caches by name):
 *
 *     records in the file                                   27,752
 *     records carrying no `message` object at all           17,375   (62.6%)
 *     `tool_use` blocks / `tool_result` blocks         3,014 / 3,014
 *     records carrying words somebody SAID                   2,444
 *
 * **2,444 against 27,752.** That ratio is `seq:13`'s whole argument: *"the
 * machinery is present but collapsed to one summarised line, so a reader sees
 * the CONVERSATION and can open the machinery when they want it. On his own
 * session that is the difference between reading 2,119 turns and 26,673
 * records."*
 *
 * ── THE DOCUMENT HAS TWO NODE KINDS, AND THAT IS THE FOLD ─────────────────
 *
 * `seq:13` supplied the format by example rather than by description — the
 * export at `D:\Claude-Hermes agent self-improvement loop implementation-
 * 20260908-1025.md`, read before this was written. Its shape: a heading per
 * turn naming the speaker, the timestamp on its own quoted line beneath,
 * **tool activity folded into a summarised quoted block** rather than
 * transcribed, and the spoken content as ordinary prose with its own headings
 * intact.
 *
 * So a document node is one of exactly two things:
 *
 *   `said`  ONE record in which a person or the model used words. It is drawn
 *           open, with a speaker heading and a timestamp, and its body is
 *           Markdown — see `seq:8`'s measurement below.
 *
 *   `work`  A RUN of consecutive records in which nobody said anything: tool
 *           calls, tool results, thinking-only turns, and the 62.6% that carry
 *           no `message` at all. Folded to one summarised line naming what ran.
 *
 * **The run is the fold.** Folding each machinery record on its own is what
 * shipped and it is what produced "49 folded 0-character rows" on the first
 * screen: a fold per record is not a fold, it is the same list with smaller
 * rows. A run of thirty-seven records becomes ONE line — *37 steps · Bash ×12,
 * Read ×3* — and opening it shows all thirty-seven.
 *
 * **Nothing is dropped, and the arithmetic is checkable.** Every node carries
 * `first` and `span`, and the outline's nodes tile the record space exactly:
 * `sum(span) === records`, asserted by
 * `test/ui/conversation-document.test.ts`. That is
 * `INV-nothing-is-dropped-silently` made into a sum rather than a promise, and
 * it is also the answer to the counting gap `seq:7` names — the 15,788 records
 * *"counted in none of the three"* are not a column to repair, they are the
 * `work` runs of this document, present and openable.
 *
 * ── WHY THIS CAN SEEK, AND WHY THAT IS THE WHOLE FEATURE ──────────────────
 *
 * `readWindow` (`read-model-conversations.ts`) wrote down the cost it accepted:
 * *"The walk is from the start every time … JSONL records are variable-length,
 * so there is no offset to seek to."* True of a reader who has never walked
 * the file; false of one who has. `buildOutline` walks it once and remembers
 * `off`, the byte the node's first record begins at, and `readNodes` seeks
 * there. Measured on the 61 MB transcript: the outline walk costs **157 ms**,
 * and every scroll afterwards costs the window rather than the file.
 *
 * The seam that makes that possible is `iterateTranscript`
 * (`core/conversation-index.ts`), added by this lane because
 * `core/session-summary.ts` reported it missing and could not add it from
 * where it sits. Its offsets are BYTE offsets found in the Buffer, not
 * character offsets from a decoded split — this corpus is half Hebrew, and a
 * character offset would be wrong from record 5 onward and wrong silently.
 * `test/ui/conversation-document.test.ts` seeks to a node after a non-ASCII
 * record and asserts the record found there is the record the outline named.
 *
 * ── `seq:8`: WHAT THE TRANSCRIPT ACTUALLY HOLDS ───────────────────────────
 *
 * `seq:8` requires this to be measured before the renderer is designed —
 * *"whether they carry ANSI escapes, pre-rendered text, or structured blocks
 * decides this entire task"* — and names an ANSI-to-HTML renderer as the
 * obvious vendoring candidate. **Measured on the owner's real transcript, the
 * lead is wrong, and this is the contradiction reported rather than worked
 * around.**
 *
 *     text carrying an ANSI escape sequence          1 record of 27,752
 *     text carrying a Markdown fence               175 records
 *     text carrying box-drawing characters         103 records
 *     `rendered` fields on `attachment` records   3,684, ZERO with ANSI
 *
 * The single ANSI record is one Playwright timeout quoting its own dim-styled
 * call log. **The transcript is not a terminal capture.** It is structured
 * JSON whose text blocks hold Markdown — which is exactly what the terminal
 * itself renders, so *"as close as it could be to what was seen on the
 * terminal"* is served by rendering that Markdown, not by replaying escape
 * codes that are not there.
 *
 * So the renderer is `lib/markdown.js`, **already vendored, already pinned,
 * already gated** — markdown-it 15.0.1 under `lib/vendor/`, called through
 * `markdownNodes`, which builds every node with `createElement` and produces
 * no HTML string at all. Vendoring an ANSI library beside it was costed and
 * declined: the smallest credible candidate is ~9 KB of pinned bytes and a new
 * row in `VENDOR.md` to serve 0.004% of records, against ~70 lines in
 * `lib/ansi.js` that this project can read. The full working is in that file's
 * header.
 *
 * ── WHAT IS NOT KEPT FROM THE EXPORT, AND WHY ─────────────────────────────
 *
 * `seq:13`'s own caution: *"that file is an EXPORT, written once. A live
 * viewer is scrolled, searched and virtualised. Whatever of this format
 * survives virtualised scrolling is what to keep."*
 *
 *   - a heading per turn — KEPT, it is the outline's unit.
 *   - the timestamp on its own line under the heading — KEPT, it is `at`.
 *   - the folded, summarised tool block — KEPT, and generalised to runs.
 *   - a rule between exchanges — KEPT, drawn by CSS rather than as a node.
 *   - **"sources collected at the end" — DROPPED.** There is no end to
 *     collect at in a scroll over 27,752 records, and a footer nobody can
 *     reach is not an affordance.
 */
import { statSync } from 'node:fs';
import {
  ConversationIndex, ConversationIndexUninitializedError, MAX_SCAN_BYTES,
  classifyTurn, iterateTranscript, listTranscriptFiles, transcriptDir,
  type ConversationRow, type TranscriptCursor,
} from '../core/conversation-index.ts';
import { workspaceCwd } from './read-model-conversations.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import type { Workspace } from '../core/workspace.ts';

/**
 * How far the outline walk reads.
 *
 * `MAX_SCAN_BYTES` and not `CONVERSATION_WALK_CAP` (64 MB), deliberately: the
 * index's own scan already reads to `MAX_SCAN_BYTES`, so a smaller cap here
 * would make the document stop before the counts the LIST screen shows for the
 * same session — two screens disagreeing about one file. The owner's
 * transcript is 61 MB today and passed 64 MB during this build, so the smaller
 * cap was not hypothetical.
 *
 * The walk yields metadata only — no record text is retained — so the cost of
 * the cap is time, not memory: 157 ms per 61 MB, measured.
 */
export const DOCUMENT_WALK_CAP = MAX_SCAN_BYTES;

/**
 * The longest run of machinery one `work` node may cover.
 *
 * A cap exists so a fold stays openable: without one, a session's opening
 * book-keeping burst would be a single node holding thousands of records, and
 * a reader who opened it would get the very wall of rows this design removes.
 * A longer run simply becomes consecutive `work` nodes, which read as
 * *"40 steps"* twice rather than as *"80 steps"* once — a smaller lie than an
 * unopenable fold, and no lie at all since both carry their true `span`.
 */
export const WORK_RUN_CAP = 40;

/** Characters of a `said` node carried in the OUTLINE, for search and preview. */
export const PEEK_CHARS = 140;

/** Distinct tool names named on a folded run before it says "and more". */
export const TOOLS_NAMED = 4;

/** Nodes one `readNodes` call will build. The screen asks for a screenful. */
export const NODE_WINDOW_CAP = 80;
export const NODE_WINDOW_DEFAULT = 24;

/**
 * ── THERE IS NO TEXT CAP IN THIS DOCUMENT, AND THAT IS A RULING ───────────
 *
 * `STEP_TEXT_CAP = 4_000` and `SAID_TEXT_CAP = 60_000` stood here until
 * 2026-09-08. The owner read their disclosure on his own screen — *"A turn
 * longer than 60000 characters is shown up to there and says so; tool output,
 * up to 4000"* — and ruled: *"if there is a size restriction it must be
 * removed, i want no restriction or limitation."* The ruling is
 * `TASK-the-transcript-is-one-document-you-scroll-not-fifty-records`, under
 * "NO CAP IN THE DOCUMENT VIEW". The lane that wrote the caps was dispatched
 * before it was written and never saw it.
 *
 * **The ruling is affordable HERE and would not be one level up, and that
 * difference is the whole argument.** `read-model-conversations.ts` hands a
 * whole page of records over in one response and keeps `CONVERSATION_TEXT_CAP`
 * for that reason — the item says so in as many words: *"Deleting the cap
 * while still shipping whole pages would hand a 64 MB session to a browser in
 * one response."* This module ships a WINDOW: `NODE_WINDOW_DEFAULT` nodes
 * seeked to by byte offset, so what a cap here would protect is already
 * bounded by the window.
 *
 * **MEASURED before removing them, on the owner's own transcript, 2026-09-08 —
 * 66,976,537 bytes, 28,998 records, 5,076 nodes:**
 *
 *     largest `said` node                    24,605 chars   (41% of 60,000)
 *     `said` nodes over 60,000 chars                  0     of 2,533
 *     largest folded STEP                    58,888 chars
 *     steps over 4,000 chars                         41     of 28,998 (0.14%)
 *     largest RECORD in the file          1,229,510 bytes — a base64 image
 *                                                    inside a `tool_result`,
 *                                                    which contributes ZERO
 *                                                    characters of text either
 *                                                    way (`readRecord` reads
 *                                                    `text` blocks, not
 *                                                    `image` ones)
 *     worst 24-node window, capped              101,267 bytes on the wire
 *     worst 24-node window, uncapped            191,671 bytes on the wire
 *
 * So `SAID_TEXT_CAP` **never fired on this file at all** — the sentence on the
 * screen described a bound that had never bound anything — and removing both
 * costs 90 KB on the worst window a reader can ask for, over loopback. The
 * biggest single thing the DOM now holds is one 58,888-character `<pre>`
 * inside a `<details>` that is CLOSED until a reader opens it.
 *
 * **AND THE SAME MEASUREMENT WAS RE-TAKEN when `DocStep.input` was added on
 * 2026-09-08, because `seq:24` required it rather than letting either answer be
 * inherited.** On the same transcript, grown to 30,218 records and 5,280 nodes:
 *
 *     largest single ARGUMENT of any call      21,713 chars — a `Write` body,
 *                                                    37% of the largest step
 *                                                    text already served whole
 *     worst 24-node window, without `input`   170,356 bytes on the wire
 *     worst 24-node window, with `input`      215,086 bytes on the wire
 *
 * **45 KB on the worst window a reader can ask for, over loopback**, to stop
 * dropping 4.45 MB of what was asked. So `input` is not capped either, for the
 * reason above and not by inheritance: nothing in the file comes close to the
 * text this list already draws.
 *
 * **What survives is the DISCLOSURE HABIT, which the item names as the thing
 * to keep.** The bounds that remain are bounds on the WINDOW, not on text, and
 * every one of them is still a field: `DOCUMENT_WALK_CAP` with `truncated` and
 * `uncounted`, `NODE_WINDOW_CAP` with the `count` the caller asked for,
 * `WORK_RUN_CAP` with each node's true `span`. Nothing is cut, so nothing
 * needs to say it was.
 */

/** Steps of one folded run served in a node body. Bounded by `WORK_RUN_CAP`. */
export const STEP_CAP = WORK_RUN_CAP;

/** Who said it. `null` on a `work` node, which is nobody speaking. */
export type Speaker = 'you' | 'claude';

/**
 * One node of the document, as the OUTLINE carries it — everything the scroll
 * needs to place a row and everything a search needs to match it, and no
 * record text beyond `peek`.
 *
 * The field names are short because there are thousands of them: the owner's
 * session outlines to 5,286 nodes, and `{"n":0,"k":"said"…}` against
 * `{"nodeIndex":0,"kind":"said"…}` is the difference between a 430 KB response
 * and a 700 KB one over a loopback socket. They are documented here instead.
 */
export interface DocOutlineNode {
  /** 0-based position in the DOCUMENT. The handle a scroll window asks by. */
  n: number;
  /** `said` — somebody used words. `work` — a folded run of machinery. */
  k: 'said' | 'work';
  /** Who spoke, on a `said` node. `null` on `work`. */
  w: Speaker | null;
  /** ISO timestamp of the node's first record that carries one, else `null`. */
  t: string | null;
  /** Characters of body text this node holds. Drives the scroll's estimate. */
  c: number;
  /** The first record index this node covers. */
  f: number;
  /** How many records it covers. Always 1 for `said`. */
  s: number;
  /** Byte offset of the first record's line. The seek target. */
  o: number;
  /**
   * The opening of a `said` node, whitespace collapsed and capped at
   * `PEEK_CHARS` — so the reader's filter matches THE WHOLE SESSION rather
   * than a loaded page.
   *
   * The old screen searched fifty records and said *"Showing all {total}
   * entries on this page"* — a phrase `seq:7` singles out for presuming a
   * second page the product did not have. There is no page here to be on.
   */
  p?: string;
  /** Distinct tools a `work` run ran, most-run first, capped at `TOOLS_NAMED`. */
  x?: string[];
  /** More distinct tools than `x` names. Absent when it named them all. */
  m?: number;
  /**
   * This `said` node is text on the person's side that **no person typed** —
   * a task notification, a slash-command wrapper, a `<system-reminder>`,
   * an `isMeta` record, or the harness's own compaction carry-over.
   *
   * `classifyTurn` counts these as prompts and is RIGHT to for the archive's
   * purpose — they are turns on the person's side of the exchange, and
   * `core/session-summary.ts` records the disagreement rather than changing
   * it. A document that names a speaker cannot be neutral about it: measured
   * on the owner's session, 194 of 525 records `classifyTurn` calls prompts
   * are `<task-notification>` blocks. Drawing those under "You asked" would
   * make the document lie about who spoke, so they keep their position and
   * their record and are LABELLED — which is the disclosure, not the drop.
   */
  y?: string;
  /** This `said` node also carries thinking, folded beside the words. */
  h?: 1;
}

export interface DocOutlineBody {
  sessionId: string;
  source: string;
  title: string | null;
  titleSource: string | null;
  branch: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** `false` is a pruned session — a state, never an error. */
  present: boolean;
  bytes: number;
  /**
   * The transcript's `mtimeMs` at the instant of this walk. With `bytes` it is
   * the freshness key — **`ConversationIndex`' own `(bytes, mtime_ms)`, not a
   * second one.** `plan:archive seq:19` names that as the requirement: the
   * LIST and the OPEN DOCUMENT are two readers of one probe, and a document
   * that invented its own notion of "the file moved" would eventually disagree
   * with the list about it, which is the class of defect `seq:14` was filed
   * for.
   */
  mtimeMs: number;
  /**
   * Records the walk saw. A floor when `truncated`, and — when the request
   * carried `at`/`from`/`node` — the TAIL's records rather than the file's.
   * The whole is `nodes[0].f + records`, which the caller already holds.
   */
  records: number;
  /** Lines that would not parse. Counted, never skipped. */
  unreadable: number;
  /** `said` nodes — the turns somebody actually took. */
  said: number;
  /** `work` nodes — the folded runs. */
  work: number;
  nodes: DocOutlineNode[];
  /** The walk stopped at `DOCUMENT_WALK_CAP` before the file ended. */
  truncated: boolean;
  walkedBytes: number;
  /** Why the document is short, or `null` when it is whole. */
  uncounted: string | null;
  peekChars: number;
  /**
   * This answer is the TAIL of a document the caller already holds, starting
   * at the node it named. `false` is a whole outline.
   */
  resumed: boolean;
}

/**
 * The cheap probe — `plan:archive seq:19`. A `stat` and nothing else.
 *
 * **It is deliberately NOT on `/api/ping`, and that is the item's ruling
 * rather than a preference.** The heartbeat's 60s "was RULED rather than
 * inherited": `measureCorpusDrift` rides that request, and its once-a-minute
 * budget is the argument that ruled out a file watcher at all. Hanging a
 * transcript `stat` on it would either inherit a cadence that is not the
 * "near real time" the owner asked for, or multiply that sweep for every
 * visible tab. So the probe gets a route of its own that does the `stat` and
 * NOT the sweep, and the screen that wants it runs a timer that lives and dies
 * with the document.
 *
 * What it costs, and how it got there, is under `apiConversationTip` — the
 * numbers matter, because the first draft of this route cost four times the
 * budget the ruling it respects exists to protect.
 */
export interface DocTipBody {
  sessionId: string;
  /** `false` — the harness pruned the transcript while it was being read. */
  present: boolean;
  bytes: number;
  mtimeMs: number;
}

/**
 * ONE ARGUMENT OF A TOOL CALL, kept under the tool's own name for it.
 *
 * **`value` is the JSON value the transcript holds, in its own type — not a
 * string this module made of it.** Measured on the owner's transcript,
 * 2026-09-08: 71 `AskUserQuestion` calls carry `questions` as an ARRAY of
 * objects, 347 `Bash` calls carry a numeric `timeout`, 61 `Edit` calls a
 * boolean `replace_all`, and `Artifact` carries object-valued `capabilities`
 * and `query`. A capture layer that only understood strings is exactly how
 * those 71 records ended up carrying nothing at all, so this one does not
 * stringify on the way out. The wire is JSON; structure survives for free, and
 * `plan:archive seq:16` — which must draw a question with EVERY option it
 * offered, not only the chosen one — gets the real array rather than a
 * paragraph it would have to re-parse.
 */
export interface DocField {
  /** The argument's own name, as the tool call wrote it. */
  name: string;
  /** Its value, unchanged. A string stays a string; nothing else is coerced. */
  value: unknown;
}

/** One record inside an opened fold. */
export interface DocStep {
  /** Record index in the file — the number every other surface counts in. */
  index: number;
  /** The harness's own `type`. Unknown values are served, never dropped. */
  type: string;
  timestamp: string | null;
  /** The tool this record calls, when it calls one. */
  tool: string | null;
  /**
   * One line describing what the tool was asked to do — the `description` a
   * Bash call carries, the path a Read names, the pattern a Grep hunts.
   *
   * `seq:13`'s example folds read *"Fetched 5 pages, searched the web"* and
   * then the queries, not a bare tool name; a fold that says only `Bash` forty
   * times is a fold nobody can skim. Measured on the real transcript, 2,123 of
   * 3,014 tool calls are `Bash` — without this the summary is one word
   * repeated.
   */
  detail: string | null;
  /** The tool reported failure. */
  failed: boolean;
  /** Content block types this record carries, in first-seen order. */
  blocks: string[];
  /**
   * This record's text, WHOLE. Not capped, not sliced — see the ruling above
   * `STEP_CAP`.
   *
   * `totalChars` and `textTruncated` sat beside this field until 2026-09-08
   * and went with the cap: `totalChars` was `text.length` restated for a
   * reader who had been handed less than that, and `textTruncated` was the
   * flag saying so. With nothing able to cut, both are `text.length` and
   * `false` for ever, and a window carries up to `WORK_RUN_CAP` steps — so
   * they were forty restatements per node of a fact the string itself
   * carries.
   */
  text: string;
  /**
   * WHAT THE TOOL WAS ASKED, WHOLE — every argument of the call, in reading
   * order. Empty on a record that calls no tool.
   *
   * **This field exists because `detail` was the ONLY capture path and a
   * summary is not a record.** `detail` reduces the whole input to one line of
   * at most 160 characters by taking the first name present in
   * `DETAIL_FIELDS`; everything else was dropped on the floor and was never in
   * the read model to be un-hidden. Measured on the owner's own transcript,
   * 2026-09-08 — 30,190 records:
   *
   *     `tool_use` blocks                          3,280
   *     characters of input, as JSON           4,450,726
   *     largest single input                      22,382   a `Write`
   *
   *     Bash    2,357 calls   `description` won, so THE COMMAND was lost
   *     Agent     208 calls   `description` won, so THE LANE BRIEF was lost
   *     Write     141 calls   `file_path` won, so THE CONTENT was lost
   *     AskUser…   71 calls   NOTHING won — `questions` is an array and the
   *                           fallback loop only accepted strings
   *
   * **NOT CAPPED, and the measurement is why.** `seq:7` removed the text caps
   * after finding the largest `said` node was 41% of a cap that never fired;
   * the same measurement here says the largest input in the file is 22,382
   * characters — 38% of the largest step TEXT this fold already serves
   * uncapped (58,888). The bound that matters is still the WINDOW:
   * `NODE_WINDOW_DEFAULT` nodes of at most `WORK_RUN_CAP` steps.
   *
   * **The count is untouched.** A step carries its whole input and is still
   * exactly ONE step, so `sum(span) === records` says what it said.
   */
  input: DocField[];
  /** This line would not parse. Served as a step so the gap is visible. */
  unreadable: boolean;
}

/** One node of the document with its body — what the scroll actually draws. */
export interface DocNodeBody {
  n: number;
  kind: 'said' | 'work';
  who: Speaker | null;
  timestamp: string | null;
  first: number;
  span: number;
  /** `said`: the words, as Markdown source, WHOLE. `work`: empty. */
  text: string;
  /**
   * `said`: `text.length`. `work`: the characters every record in the run
   * holds, which is a real total and not a restatement — a `work` node's own
   * `text` is empty and its content lives in `steps`.
   *
   * It stays for the `work` case; the `textTruncated` and `thinkingTruncated`
   * flags that sat beside it did not, because nothing here can truncate any
   * more. See the ruling above `STEP_CAP`.
   */
  totalChars: number;
  /** `said`: the thinking that came with the words, folded beside them. */
  thinking: string;
  /** The label a synthetic person-side turn carries. See `DocOutlineNode.y`. */
  synthetic: string | null;
  /** `work`: one entry per record folded, capped at `STEP_CAP`. */
  steps: DocStep[];
  /** Steps this node covers that the cap left out. */
  stepsOmitted: number;
}

export interface DocNodesBody {
  sessionId: string;
  nodes: DocNodeBody[];
}

/* ══ READING ONE RECORD ════════════════════════════════════════════════════ */

/**
 * Person-side text that no person typed.
 *
 * **A SECOND SPELLING OF A RULE THAT ALREADY EXISTS, AND IT IS REPORTED
 * RATHER THAN HIDDEN.** `syntheticKind` in `core/session-summary.ts` (line
 * ~585) is the same test, written first and measured there: of the 525 records
 * `classifyTurn` calls prompts on the owner's session, 194 are
 * `<task-notification>`, 24 are `isMeta`, 23 are slash-command wrappers and 5
 * are the harness's compaction carry-over.
 *
 * It is not imported because it is not exported, and exporting it means
 * editing a file this lane does not own — `core/session-summary.ts` landed the
 * same day from another plan. `test/ui/conversation-document.test.ts` reads
 * BOTH implementations off disk and asserts the two prefix lists are equal, so
 * the copy cannot drift in silence. **The repair is one exported predicate,
 * and it belongs to whoever next opens that file.**
 */
function syntheticLabel(
  text: string, isMeta: boolean, isCompactSummary: boolean,
): string | null {
  if (isCompactSummary) return 'harness-compaction-summary';
  if (isMeta) return 'meta';
  const head = text.trimStart();
  if (head.startsWith('<task-notification>')) return 'task-notification';
  if (head.startsWith('<command-name>') || head.startsWith('<command-message>')
    || head.startsWith('<local-command-stdout>') || head.startsWith('<command-args>')) {
    return 'slash-command';
  }
  if (head.startsWith('<system-reminder>')) return 'system-reminder';
  if (head.startsWith('This session is being continued from a previous conversation')) {
    return 'harness-compaction-summary';
  }
  return null;
}

/**
 * The one-line description of a tool call, read off the tool's OWN argument
 * names rather than off a schema this build does not have.
 *
 * The table is ordered: the first name present wins. A tool nobody listed
 * falls through to the first string argument it carries, which is the safe
 * direction — an unknown tool describes itself imperfectly rather than not at
 * all, and `INV-nothing-is-dropped-silently` prefers the imperfect line.
 */
const DETAIL_FIELDS = [
  'description', 'command', 'file_path', 'pattern', 'query', 'url', 'prompt',
  'skill', 'path', 'name', 'id',
];

function toolDetail(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  for (const field of DETAIL_FIELDS) {
    const value = row[field];
    if (typeof value === 'string' && value.trim() !== '') return oneLine(value, 160);
  }
  for (const value of Object.values(row)) {
    if (typeof value === 'string' && value.trim() !== '') return oneLine(value, 160);
  }
  // NOTHING AT THE TOP LEVEL WAS A STRING, which on the owner's transcript is
  // 71 `AskUserQuestion` calls and 13 others — every one of them drawn as a
  // bare tool name with no line beside it. The text is there, one level in:
  // `questions[0].question` is the question he was asked. So the last resort
  // reads INTO the structure rather than giving up on it, depth-bounded so a
  // deep input cannot turn a fold summary into a walk.
  const nested = firstString(row, DETAIL_DEPTH);
  return nested === null ? null : oneLine(nested, 160);
}

/** How far `toolDetail` reads into a structured input for its one line. */
const DETAIL_DEPTH = 4;

/** The first non-empty string anywhere in `value`, in the value's own order. */
function firstString(value: unknown, depth: number): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (depth <= 0 || typeof value !== 'object' || value === null) return null;
  for (const inner of Array.isArray(value) ? value : Object.values(value)) {
    const found = firstString(inner, depth - 1);
    if (found !== null) return found;
  }
  return null;
}

/**
 * The arguments of a tool call put in READING ORDER — the act first, the prose
 * about the act last, and everything else where the call itself wrote it.
 *
 * **This is the ordering fix, and it belongs HERE rather than in
 * `DETAIL_FIELDS`.** The item that ordered it (`plan:archive seq:24`) argues
 * both sides in one paragraph: it says `command` must outrank `description`,
 * and in the next sentence that *"a reader who wants the summary has
 * `detail`"* — which only holds if `detail` still carries the summary. The
 * reason `description` winning was damaging at all was that `DETAIL_FIELDS`
 * was the ONLY path input took; with the whole input captured, the fold's one
 * line costs nothing and keeps the property `seq:13` measured it for — 2,357
 * of 3,280 calls on this transcript are `Bash`, and a fold that reads `Bash`
 * forty times is unskimmable. So the summary line keeps `description` and the
 * OPENED step leads with the act.
 */
const INPUT_FIRST = [
  'file_path', 'path', 'url', 'command', 'prompt', 'content',
  'old_string', 'new_string', 'questions', 'pattern', 'query', 'function', 'text',
];

/** Prose ABOUT the call, written by the caller. It reads last. */
const INPUT_LAST = ['description'];

function toolInput(input: unknown): DocField[] {
  if (input === undefined) return [];
  // An input that is not an object at all is still an input, and a tool that
  // takes a bare array or string is not a schema violation this module gets to
  // rule on — `INV-nothing-is-dropped-silently`. It is served under its own
  // name so the screen can say what it is.
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return [{ name: 'input', value: input }];
  }
  const row = input as Record<string, unknown>;
  const names = Object.keys(row);
  const lead = INPUT_FIRST.filter((name) => names.includes(name));
  const trail = INPUT_LAST.filter((name) => names.includes(name));
  const middle = names.filter((name) => !lead.includes(name) && !trail.includes(name));
  return [...lead, ...middle, ...trail].map((name) => ({ name, value: row[name] }));
}

/** Collapse to one line and cap. Never a slice through a newline. */
function oneLine(text: string, cap: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > cap ? `${flat.slice(0, cap)}…` : flat;
}

/**
 * Everything one record says, split the way the DOCUMENT needs it.
 *
 * Deliberately not `renderContent`'s flattening (`read-model-conversations
 * .ts`), and the difference is the whole fold: that function joins spoken text
 * and tool-result text into one string, which is correct for a record list and
 * ruinous for a document — a turn's words and the 12 KB of `git log` it
 * triggered would render as one paragraph. Here `said` and `tool` and
 * `thinking` come back apart, and the node decides.
 */
interface Read {
  /** Words a person or the model used. Empty on a machinery record. */
  said: string;
  /** Reasoning that came with them. Folded, never drawn as prose. */
  thinking: string;
  /** Tool output, or the text of a record that is neither. */
  body: string;
  tool: string | null;
  detail: string | null;
  /** Every argument of the tool call, in reading order. See `DocStep.input`. */
  input: DocField[];
  failed: boolean;
  blocks: string[];
}

function readRecord(message: unknown): Read {
  const out: Read = {
    said: '', thinking: '', body: '', tool: null, detail: null, input: [],
    failed: false, blocks: [],
  };
  if (typeof message !== 'object' || message === null) return out;
  const content = (message as { content?: unknown }).content;

  // A plain string is what the harness writes for a prompt with nothing
  // attached. It is words, always.
  if (typeof content === 'string') {
    out.said = content;
    out.blocks.push('text');
    return out;
  }
  if (!Array.isArray(content)) return out;

  const said: string[] = [];
  const thinking: string[] = [];
  const body: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as {
      type?: unknown; text?: unknown; name?: unknown; input?: unknown;
      content?: unknown; thinking?: unknown; is_error?: unknown;
    };
    if (typeof b.type === 'string' && !out.blocks.includes(b.type)) out.blocks.push(b.type);
    if (b.type === 'text' && typeof b.text === 'string') said.push(b.text);
    else if (b.type === 'thinking' && typeof b.thinking === 'string') thinking.push(b.thinking);
    else if (b.type === 'tool_use') {
      if (typeof b.name === 'string') out.tool = b.name;
      const detail = toolDetail(b.input);
      if (detail !== null) out.detail = detail;
      // APPENDED, not assigned, so a record carrying two calls keeps both.
      // Measured on the owner's transcript: 0 of 3,280 records carry more than
      // one `tool_use` block, so this costs nothing today — but `tool` and
      // `detail` above are last-wins, and a silent replacement is the one
      // outcome `INV-nothing-is-dropped-silently` refuses. That those two are
      // still last-wins is a pre-existing shape this lane did not change.
      out.input.push(...toolInput(b.input));
    } else if (b.type === 'tool_result') {
      if (b.is_error === true) out.failed = true;
      if (typeof b.content === 'string') body.push(b.content);
      else if (Array.isArray(b.content)) {
        for (const inner of b.content) {
          if (typeof inner === 'object' && inner !== null
            && (inner as { type?: unknown }).type === 'text'
            && typeof (inner as { text?: unknown }).text === 'string') {
            body.push((inner as { text: string }).text);
          }
        }
      }
    }
    // A block type this build has never heard of contributes no text and is
    // not an error — the transcript schema is the harness's and gains members.
    // It is still NAMED in `blocks`, so it shows up as itself.
  }
  out.said = said.join('\n\n');
  out.thinking = thinking.join('\n\n');
  out.body = body.join('\n\n');
  return out;
}

/** `said`, `work`, and who — the one classification, made once. */
interface Shape {
  said: boolean;
  who: Speaker | null;
  read: Read;
  synthetic: string | null;
}

function shapeOf(row: Record<string, unknown> | null): Shape {
  const empty: Read = {
    said: '', thinking: '', body: '', tool: null, detail: null, input: [],
    failed: false, blocks: [],
  };
  if (row === null) return { said: false, who: null, read: empty, synthetic: null };
  const message = row['message'];
  if (typeof message !== 'object' || message === null) {
    return { said: false, who: null, read: empty, synthetic: null };
  }
  const content = (message as { content?: unknown }).content;
  // `classifyTurn` is IMPORTED rather than restated — `core/session-summary.ts`
  // gives the reason: the archive's measured definition of a prompt must
  // travel with every surface that shows one, or two screens disagree about
  // one record.
  const turn = classifyTurn(row['type'], content);
  if (turn === 'machinery') {
    return { said: false, who: null, read: readRecord(message), synthetic: null };
  }
  const read = readRecord(message);
  const who: Speaker = turn === 'prompt' ? 'you' : 'claude';
  const synthetic = who === 'you'
    ? syntheticLabel(read.said, row['isMeta'] === true, row['isCompactSummary'] === true)
    : null;
  return { said: true, who, read, synthetic };
}

/* ══ THE OUTLINE ═══════════════════════════════════════════════════════════ */

/**
 * Where a walk of an APPENDED file resumes: the first byte, record index and
 * document position of a node the caller already holds.
 *
 * Its contract is `readNodes`', for the same reason and with the same proof:
 * `at` must be the first byte of the first record of a node, which is a run
 * boundary by construction, so re-deriving from there yields the identical
 * nodes the first walk named. The node named is RE-BUILT, not skipped — it may
 * have been an open `work` run that the append has since extended, and a
 * resume that started after it would leave the reader holding a run of 3 while
 * the file says 7.
 */
export interface OutlineResume {
  /** Byte offset of the node's first record. From `o`. */
  at: number;
  /** Record index of that record. From `f`. */
  from: number;
  /** Document position of that node. From `n`. */
  node: number;
}

/**
 * Walk a transcript and return the document's skeleton — the whole of it, or,
 * given `resume`, only the part from one node onward.
 *
 * The nodes TILE the record space: node `k`'s `f + s` is node `k+1`'s `f`, and
 * the last node's `f + s` is `records`. That is not a nicety — it is what lets
 * the screen say *"27,752 records, 2,444 of them turns"* and lets a test add
 * the spans up instead of trusting a sentence. With `resume` the tiling is the
 * same claim shifted: the first node returned is `resume.node` and its `f` is
 * `resume.from`, so a caller splices rather than concatenating.
 *
 * **`records`, `said` and `work` count what THIS walk saw**, which is the whole
 * file without `resume` and the tail with it. `cursor.scannedBytes` is likewise
 * bytes read by this walk, so the absolute end is `resume.at + scannedBytes` —
 * `apiConversationOutline` does that addition rather than leaving it to a
 * reader who would have to know that `iterateTranscript` counts from where it
 * started.
 */
export function buildOutline(
  file: string, cap: number = DOCUMENT_WALK_CAP, resume?: OutlineResume,
): {
  nodes: DocOutlineNode[]; records: number; cursor: TranscriptCursor;
  said: number; work: number;
} {
  const nodes: DocOutlineNode[] = [];
  const cursor: TranscriptCursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  const base = resume?.node ?? 0;
  let records = 0;
  let said = 0;
  let work = 0;

  /** The run being accumulated, or `null` between runs. */
  let run: DocOutlineNode | null = null;
  /** Tool names in the open run, with how often each ran. */
  let runTools: Map<string, number> = new Map();

  const closeRun = (): void => {
    if (run === null) return;
    if (runTools.size > 0) {
      const ranked = [...runTools.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      run.x = ranked.slice(0, TOOLS_NAMED).map(([name, times]) => (
        times > 1 ? `${name} ×${times}` : name));
      if (ranked.length > TOOLS_NAMED) run.m = ranked.length - TOOLS_NAMED;
    }
    nodes.push(run);
    work += 1;
    run = null;
    runTools = new Map();
  };

  for (const step of iterateTranscript(file, {
    cap, cursor, startByte: resume?.at ?? 0, startIndex: resume?.from ?? 0,
  })) {
    records += 1;
    const shape = shapeOf(step.record);

    if (shape.said) {
      closeRun();
      const node: DocOutlineNode = {
        n: base + nodes.length, k: 'said', w: shape.who,
        t: typeof step.record?.['timestamp'] === 'string'
          ? step.record['timestamp'] as string : null,
        c: shape.read.said.length, f: step.index, s: 1, o: step.byteOffset,
      };
      const peek = oneLine(shape.read.said, PEEK_CHARS);
      if (peek !== '') node.p = peek;
      if (shape.synthetic !== null) node.y = shape.synthetic;
      if (shape.read.thinking !== '') node.h = 1;
      nodes.push(node);
      said += 1;
      continue;
    }

    // Machinery, and everything with no message at all. A run, capped so a
    // fold stays openable.
    if (run !== null && run.s >= WORK_RUN_CAP) closeRun();
    if (run === null) {
      run = {
        n: base + nodes.length, k: 'work', w: null,
        t: typeof step.record?.['timestamp'] === 'string'
          ? step.record['timestamp'] as string : null,
        c: 0, f: step.index, s: 0, o: step.byteOffset,
      };
    }
    run.s += 1;
    run.c += shape.read.body.length + shape.read.thinking.length;
    if (shape.read.tool !== null) {
      runTools.set(shape.read.tool, (runTools.get(shape.read.tool) ?? 0) + 1);
    }
  }
  closeRun();

  return { nodes, records, cursor, said, work };
}

/* ══ READING A WINDOW OF NODES ═════════════════════════════════════════════ */

export interface NodeWindowRequest {
  /** Byte offset of the first record of the first node wanted. From `o`. */
  at: number;
  /** Record index of that record. From `f`. */
  from: number;
  /** Document position of that node. From `n`. */
  node: number;
  /** How many nodes to build. */
  count: number;
}

/**
 * Seek to a node and build it and its neighbours.
 *
 * **The seek is exact because the caller supplies an offset THIS module
 * produced.** `at` must be the first byte of the first record of a node, which
 * is a run boundary by construction, so re-deriving nodes from there yields
 * the identical nodes the outline named — the run state at a node boundary is
 * empty by definition. An `at` from anywhere else lands mid-record and reports
 * one `unreadable` step, which is visible rather than silently shifted.
 */
export function readNodes(file: string, want: NodeWindowRequest): DocNodeBody[] {
  const out: DocNodeBody[] = [];
  const cursor: TranscriptCursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  let n = want.node;

  let open: DocNodeBody | null = null;
  const closeRun = (): void => {
    if (open === null) return;
    out.push(open);
    open = null;
  };

  const walk = iterateTranscript(file, {
    cap: DOCUMENT_WALK_CAP, startByte: want.at, startIndex: want.from, cursor,
  });

  for (const step of walk) {
    // Enough nodes built, and the run that was open is closed. Stop reading:
    // the generator's `finally` closes the descriptor on `break`.
    if (out.length >= want.count) break;
    const shape = shapeOf(step.record);
    const timestamp = typeof step.record?.['timestamp'] === 'string'
      ? step.record['timestamp'] as string : null;

    if (shape.said) {
      closeRun();
      if (out.length >= want.count) break;
      const text = shape.read.said;
      const thinking = shape.read.thinking;
      out.push({
        n: n++, kind: 'said', who: shape.who, timestamp,
        first: step.index, span: 1,
        text,
        totalChars: text.length,
        thinking,
        synthetic: shape.synthetic,
        steps: [], stepsOmitted: 0,
      });
      continue;
    }

    if (open !== null && open.span >= WORK_RUN_CAP) {
      closeRun();
      if (out.length >= want.count) break;
    }
    if (open === null) {
      open = {
        n: n++, kind: 'work', who: null, timestamp,
        first: step.index, span: 0, text: '', totalChars: 0,
        thinking: '', synthetic: null,
        steps: [], stepsOmitted: 0,
      };
    }
    open.span += 1;
    const body = shape.read.body !== '' ? shape.read.body : shape.read.thinking;
    open.totalChars += body.length;
    if (open.steps.length < STEP_CAP) {
      open.steps.push({
        index: step.index,
        type: typeof step.record?.['type'] === 'string' ? step.record['type'] as string : 'unknown',
        timestamp,
        tool: shape.read.tool,
        detail: shape.read.detail,
        input: shape.read.input,
        failed: shape.read.failed,
        blocks: shape.read.blocks,
        text: body,
        unreadable: step.record === null,
      });
    } else open.stepsOmitted += 1;
  }
  // A run still open when the file ended is a node, not a leak.
  if (out.length < want.count) closeRun();

  return out;
}

/* ══ THE ROUTES ════════════════════════════════════════════════════════════ */

const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

const REBUILD_COMMAND = 'mycontext conversation rebuild';

/** A whole number written in digits, or `null` for anything else. */
function digits(url: URL, name: string): number | null | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

function unknownParams(url: URL, allowed: string[]): string | null {
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown query parameter "${key}" — this endpoint takes ${allowed.join(', ')}.`;
    }
  }
  return null;
}

/** The indexed row for a session, or the refusal that explains itself. */
function rowFor(ws: Workspace, id: string): { row: ConversationRow } | { fail: JsonResult } {
  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError) {
      return {
        fail: {
          status: 404,
          body: {
            error: 'no conversation index in this workspace — nothing has been scanned.',
            rebuild: REBUILD_COMMAND,
          },
        },
      };
    }
    throw err;
  }
  let row: ConversationRow | null;
  try {
    row = index.get(id);
  } finally {
    index.close();
  }
  if (row === null) {
    return { fail: { status: 404, body: { error: `no indexed conversation "${id}".` } } };
  }
  return { row };
}

/**
 * `GET /api/conversations/:id/outline` — the document's skeleton.
 *
 * With `at`, `from` and `node` it answers the TAIL instead: the nodes from
 * that one onward, which is what a screen following a session still being
 * written asks for after the cheap probe says the file grew.
 *
 * **The three are supplied together or not at all**, because two of them
 * without the third is a request whose answer cannot be spliced anywhere:
 * `at` says where to seek, `from` numbers the records it finds, `node` numbers
 * the nodes. A partial set is refused rather than defaulted, since a defaulted
 * `node` of 0 would renumber the reader's whole document in silence.
 *
 * **The named node is REBUILT, not skipped.** It may have been an open `work`
 * run that the append extended — a run of 3 that is now a run of 7 — so the
 * caller replaces it rather than appending after it. See `OutlineResume`.
 *
 * **MEASURED on the owner's 66,976,537-byte transcript, 2026-09-08:** the
 * whole walk is 224 ms over 28,998 records and 5,076 nodes; a resume from the
 * last node reads the appended bytes and nothing else, which is the difference
 * this route exists for. `iterateTranscript`'s own header is why it can seek
 * at all: byte offsets found in the Buffer rather than character offsets from
 * a decoded split, in a corpus that is half Hebrew.
 */
export function apiConversationOutline(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, ['at', 'from', 'node']);
  if (bad !== null) return badRequest(bad);

  const at = digits(url, 'at');
  const from = digits(url, 'from');
  const node = digits(url, 'node');
  for (const [name, value] of [['at', at], ['from', from], ['node', node]] as const) {
    if (value === null) return badRequest(`${name} must be a whole number, written in digits.`);
  }
  const given = [at, from, node].filter((v) => v !== undefined).length;
  if (given !== 0 && given !== 3) {
    return badRequest('at, from and node are supplied together or not at all — a resume needs '
      + 'the byte to seek to, the record index to count from and the node number to continue at, '
      + 'and defaulting any one of them would renumber the document in silence.');
  }
  const resume: OutlineResume | undefined = given === 3
    ? { at: at as number, from: from as number, node: node as number }
    : undefined;

  const found = rowFor(ws, params.id);
  if ('fail' in found) return found.fail;
  const { row } = found;

  let present = false;
  let bytes = row.bytes;
  let mtimeMs = row.mtimeMs;
  try {
    const stat = statSync(row.file);
    present = stat.isFile();
    bytes = stat.size;
    // FLOORED, and the floor is not cosmetic: `listTranscriptFiles` floors the
    // same number, `/tip` answers from that listing, and a client comparing an
    // unfloored 1234.5678 here against a floored 1234 there would read its own
    // rounding as the file having changed and say so on the screen. One key
    // means one representation of it.
    mtimeMs = Math.floor(stat.mtimeMs);
  } catch {
    present = false;
  }

  const head = {
    sessionId: row.sessionId, source: row.source, title: row.title,
    titleSource: row.titleSource, branch: row.branch,
    startedAt: row.startedAt, endedAt: row.endedAt,
    peekChars: PEEK_CHARS, resumed: resume !== undefined,
  };

  if (!present) {
    // The pruned session, served as itself — everything the index remembers,
    // and an empty document that SAYS why rather than an error that reads as
    // damage. `read-model-conversations.ts` answers the same way one level up.
    const body: DocOutlineBody = {
      ...head, present: false, bytes: row.bytes, mtimeMs: row.mtimeMs,
      records: 0, unreadable: 0,
      said: 0, work: 0, nodes: [], truncated: false, walkedBytes: 0,
      uncounted: 'the transcript is no longer on disk — the harness prunes them, and the '
        + 'archive reads them in place rather than copying, so what is gone is gone. The '
        + 'counts on the list are what the last scan measured.',
    };
    return { status: 200, body };
  }

  // A resume offset at or past the end is not an error, for
  // `apiConversationNodes`' reason and with its answer: a transcript can be
  // replaced under a reader, and a client holding an outline built a minute ago
  // is asking a legitimate question about a file that has since changed. It
  // gets an empty tail and decides what to do about it.
  if (resume !== undefined && resume.at >= bytes) {
    const body: DocOutlineBody = {
      ...head, present: true, bytes, mtimeMs, records: 0, unreadable: 0,
      said: 0, work: 0, nodes: [], truncated: false, walkedBytes: bytes,
      uncounted: null,
    };
    return { status: 200, body };
  }

  const built = buildOutline(row.file, DOCUMENT_WALK_CAP, resume);
  const truncated = !built.cursor.reachedEnd;
  // `cursor.scannedBytes` counts from where THIS walk started, so the absolute
  // end is the resume offset plus it. The addition is made here rather than
  // left to a caller who would have to know that about `iterateTranscript`.
  const walkedBytes = (resume?.at ?? 0) + built.cursor.scannedBytes;
  const body: DocOutlineBody = {
    ...head,
    present: true,
    bytes,
    mtimeMs,
    records: built.records,
    unreadable: built.cursor.unreadable,
    said: built.said,
    work: built.work,
    nodes: built.nodes,
    truncated,
    walkedBytes,
    uncounted: truncated
      ? `the walk stopped at ${DOCUMENT_WALK_CAP} bytes (DOCUMENT_WALK_CAP) of a ${bytes} `
        + 'byte transcript, so the document ends there and records past it were never seen.'
      : null,
  };
  return { status: 200, body };
}

/**
 * `GET /api/conversations/:id/tip` — has this transcript moved?
 *
 * It reads no records, opens no descriptor onto the content and builds
 * nothing. See `DocTipBody` for why it is a route of its own rather than a
 * field on `/api/ping`.
 *
 * ── IT DOES NOT OPEN THE INDEX, AND THAT IS A MEASUREMENT, NOT A STYLE ────
 *
 * The first draft of this route resolved the file the way every other
 * conversation route does — `rowFor`, which opens the index, reads one row and
 * closes it. **Measured on this machine, 2026-09-08, and the split is the
 * whole decision:**
 *
 *     open + get + close (what `rowFor` costs)        1.930 ms
 *     open + close, with no query at all              1.917 ms
 *     `listTranscriptFiles` over the directory        0.057 ms
 *     `statSync` on the 67 MB transcript              0.007 ms
 *
 * So 1.92 of those 1.93 ms are opening a SQLite file, to learn a path — and
 * the fact being asked for, the size on disk right now, is not in the index at
 * all. At the screen's five-second cadence `rowFor` would have cost 23 ms of
 * server CPU per minute per open document, against the 6.24 ms/min budget that
 * `measureCorpusDrift` is held to and that the heartbeat's 60 s was RULED to
 * protect. A route that claimed to respect that ruling while costing four
 * times what it protects would be a worse defect than the cadence it bought.
 *
 * `listTranscriptFiles` already carries `bytes` and `mtimeMs` for every
 * transcript in this workspace's own directory — the same listing
 * `rebuildConversations` walks and the same one `/api/conversations` names as
 * `dir` — so the answer is a directory read and no database at all: 0.68 ms
 * per minute per document, an order of magnitude UNDER the sweep the ruling
 * protects. **No path is built from `:id`**; the id is compared against the
 * listing's own session names, so a traversal has nothing to traverse.
 *
 * ── WHAT THE INDEX IS STILL FOR, AND THE ONE DIVERGENCE THIS CREATES ──────
 *
 * A session that is NOT in that directory — an exported one, whose file lives
 * wherever the export was written, or one the harness has pruned — falls
 * through to the index, which is the only thing that knows where an export is
 * or that a pruned session ever existed. An id nobody indexed takes the same
 * 404 the outline gives it, from the same function.
 *
 * The divergence, stated rather than discovered: a transcript present in the
 * directory but not yet INDEXED answers 200 here and 404 from `/outline`. That
 * is the archive-is-behind state `seq:14` is about, it exposes nothing
 * `/api/conversations` does not already publish as `dir`, and it is
 * unreachable from the screen — which polls only a session it has already
 * opened, and opening one requires the index.
 */
export function apiConversationTip(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, []);
  if (bad !== null) return badRequest(bad);

  for (const file of listTranscriptFiles(transcriptDir(process.env, workspaceCwd(ws)))) {
    if (file.sessionId !== params.id) continue;
    const body: DocTipBody = {
      sessionId: file.sessionId, present: true,
      bytes: file.bytes, mtimeMs: file.mtimeMs,
    };
    return { status: 200, body };
  }

  const found = rowFor(ws, params.id);
  if ('fail' in found) return found.fail;
  const { row } = found;

  try {
    const stat = statSync(row.file);
    if (!stat.isFile()) throw new Error('not a file');
    const body: DocTipBody = {
      sessionId: row.sessionId, present: true,
      bytes: stat.size, mtimeMs: Math.floor(stat.mtimeMs),
    };
    return { status: 200, body };
  } catch {
    // A pruned transcript, answered with the bytes the INDEX remembers,
    // exactly as the outline answers it — a session that has gone is a state,
    // never an error, and a screen reading one is told rather than left
    // waiting for a turn that will never arrive.
    const body: DocTipBody = {
      sessionId: row.sessionId, present: false,
      bytes: row.bytes, mtimeMs: row.mtimeMs,
    };
    return { status: 200, body };
  }
}

export function apiConversationNodes(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, ['at', 'from', 'node', 'count']);
  if (bad !== null) return badRequest(bad);

  const at = digits(url, 'at');
  const from = digits(url, 'from');
  const node = digits(url, 'node');
  const count = digits(url, 'count');
  for (const [name, value] of [['at', at], ['from', from], ['node', node], ['count', count]] as const) {
    if (value === null) {
      return badRequest(`${name} must be a whole number, written in digits.`);
    }
  }

  const found = rowFor(ws, params.id);
  if ('fail' in found) return found.fail;
  const { row } = found;

  let size = 0;
  try {
    const stat = statSync(row.file);
    if (!stat.isFile()) throw new Error('not a file');
    size = stat.size;
  } catch {
    return {
      status: 200,
      body: {
        sessionId: row.sessionId, nodes: [],
      } satisfies DocNodesBody,
    };
  }

  // An offset past the end is not an error and not a crash: the file grows
  // while it is being read, and a client holding an outline built a minute ago
  // is asking a legitimate question about a file that has since changed. It
  // gets an empty window and re-asks for the outline.
  const start = at ?? 0;
  if (start >= size) {
    return {
      status: 200,
      body: {
        sessionId: row.sessionId, nodes: [],
      } satisfies DocNodesBody,
    };
  }

  const nodes = readNodes(row.file, {
    at: start,
    from: from ?? 0,
    node: node ?? 0,
    count: Math.min(count ?? NODE_WINDOW_DEFAULT, NODE_WINDOW_CAP),
  });
  const body: DocNodesBody = {
    sessionId: row.sessionId, nodes,
  };
  return { status: 200, body };
}

export function registerConversationDocumentRoutes(): void {
  registerRoute('GET', '/api/conversations/:id/outline', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationOutline(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/conversations/:id/nodes', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationNodes(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/conversations/:id/tip', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationTip(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
