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
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import {
  ConversationIndex, ConversationIndexIncompleteError, ConversationIndexUninitializedError,
  MAX_SCAN_BYTES, classifyTurn, iterateTranscript, listTranscriptFiles, transcriptDir,
  type ConversationRow, type SubagentRow, type TranscriptCursor,
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

/**
 * ── `STEP_CAP` AND `stepsOmitted` ARE GONE, AND THE ARITHMETIC IS WHY ──────
 *
 * `plan:archive seq:21`. `STEP_CAP` was declared `= WORK_RUN_CAP` and
 * `readNodes` closes a run BEFORE it takes a record — `if (open !== null &&
 * open.span >= WORK_RUN_CAP) closeRun()` — so a run's `span` never exceeded 40,
 * one record pushed one step, and `steps.length < STEP_CAP` was therefore true
 * on every record that ever reached it. `stepsOmitted` was `0` for every node
 * this endpoint has ever produced, `drawWork`'s `body.stepsOmitted > 0` branch
 * was unreachable, and the string behind it was delivered to no reader in
 * either table.
 *
 * **Option 1 of the three the item lists — delete — taken with option 2's
 * guard kept.** The coupling is removed by removing one side of it, and the
 * PROPERTY that made the branch dead is asserted instead of the constant:
 * `test/ui/conversation-document.test.ts` requires `steps.length === span` on
 * every node, so anyone who later re-introduces a cut has a red test rather
 * than a silently dropped step. `seq:7` removed two disclosures for this same
 * reason and this is the third.
 *
 * **`.tvcut` is NOT dead, and the item is wrong about that.** It has a live
 * call site in `laneLink` (`conversations.js`) — the line a lane whose
 * transcript has been pruned draws. The rule stays.
 */

/**
 * Who caused this turn — **not who typed it**, which is
 * `plan:archive seq:28`'s ruling and the reason there are four of these.
 *
 * `null` is a legal answer and is the honest one for the harness talking to
 * itself: a monitor tick, an `isMeta` record, a compaction carry-over. Measured
 * on the owner's own session, 2026-09-09 — 271 synthetic person-side turns:
 *
 *     `Agent "…" finished` / failed / stalled   177   `subagent`
 *     `Background command …`                     24   `shell`
 *     Monitor event / stream ended               16   null
 *     `isMeta`                                   25   null
 *     harness compaction carry-over               6   null
 *     no completion record found                  1   null
 *     slash-command wrapper                      23   `you`
 *
 * **`claude` is the speaker of none of them**, and that is the finding rather
 * than an omission: every one is delivered TO the assistant, so attributing any
 * of them to Claude would repeat the error the ruling exists to fix one name
 * over. **The 23 slash commands keep `you` and that is correct** — the wrapper
 * text is machinery but the ACT was his, and a change that renamed all 271
 * would take his own invocations away from him.
 *
 * `shell` is also the speaker of a command that RAN — see `Deed`.
 */
export type Speaker = 'you' | 'claude' | 'subagent' | 'shell';

/**
 * A record a reader wants MORE than the prose around it — `plan:archive
 * seq:16`, and the reason the fold grew a third node kind instead of a wider
 * exception.
 *
 * Owner ruling 2026-09-08: he wants to see *"the questions put to him, the
 * suggestions offered, which one he chose and what he answered — and the same
 * for shell commands that were executed."* Those are not missing from the file:
 * `classifyTurn` sorts every record that is not plainly a prompt or an answer
 * into MACHINERY, and the viewer folds machinery away, so they were present,
 * counted and collapsed as noise.
 *
 * **Machinery was one bucket doing two jobs** — things a reader never wants
 * (file-history snapshots, mode changes, latches) and things a reader wants
 * more than the words beside them. So a KIND IS ADDED here and `classifyTurn`
 * is untouched: the archive's counting definition of a prompt is measured and
 * shared, and breaking it to serve a viewer is how two screens come to disagree
 * about one record.
 *
 * **And the fold is kept for the rest.** 16,659 of 26,673 records carry no
 * `message` at all; promoting everything would undo `seq:13`. Measured on the
 * owner's transcript, 2026-09-09 — 31,101 records, 3,358 tool calls:
 *
 *     `Bash`             2,418   promoted
 *     `PowerShell`          15   promoted
 *     `AskUserQuestion`     71   promoted
 *     everything else      854   still folded
 *
 * A deed node is ONE RECORD — `span` 1 — so `sum(span) === records` says what
 * it said. Its RESULT stays folded, which is the ruling in the item's own
 * words: *"Its output belongs behind the fold; the command does not."*
 */
export type Deed = 'ran' | 'ask';

/** Tool names whose call IS a shell command. */
const SHELL_TOOLS = ['Bash', 'PowerShell'];

/** Tool names that put a question to the person. */
const ASK_TOOLS = ['AskUserQuestion'];

function deedOf(tool: string | null): Deed | null {
  if (tool === null) return null;
  if (SHELL_TOOLS.includes(tool)) return 'ran';
  if (ASK_TOOLS.includes(tool)) return 'ask';
  return null;
}

/**
 * How far past a full window `readNodes` keeps reading to learn how a promoted
 * call ENDED — records only, no further nodes.
 *
 * A deed carries its outcome, and the outcome lives in the `tool_result` record
 * that answers it, which is a LATER record than the call. Measured on the
 * owner's transcript, 2026-09-09, over 2,504 promoted calls: the result is the
 * very next record 2,314 times, and the largest gap in the file is 17 records.
 * So 40 is the same number `WORK_RUN_CAP` already is and more than twice the
 * worst case — and without it roughly one deed per window would say its result
 * was not in view when it plainly was.
 *
 * **0 calls in that file are never answered**, so `conv.doc.deed.noResult` is a
 * measured zero on his session and draws nothing there.
 */
const RESOLVE_AHEAD = WORK_RUN_CAP;

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
  /**
   * `said` — somebody used words. `work` — a folded run of machinery.
   * `deed` — one promoted record: a shell command, or a question put to the
   * person. See `Deed`.
   */
  k: 'said' | 'work' | 'deed';
  /**
   * Who CAUSED it. `null` on `work`, and also on a synthetic person-side turn
   * nobody caused — a monitor tick, an `isMeta` record, the harness's own
   * compaction carry-over. See `Speaker`.
   */
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
  /** `deed` nodes — the commands and the questions, promoted out of the fold. */
  deed: number;
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
  /**
   * WHAT THIS RECORD IS, where its `type` only names the envelope —
   * `plan:archive seq:28`.
   *
   * `attachment` is the measured case and the argument. Measured on the owner's
   * transcript, 2026-09-09, 4,864 of them: 3,646 are `total_tokens_reminder`,
   * which is pure book-keeping a reader never wants, and **1,218 are not** —
   * 677 `hook_success`, 230 `queued_command`, 77 `hook_additional_context`, 26
   * `file`, and twenty-two further kinds. Every one of them drew the same bare
   * word, so a reader could not tell "the harness counted tokens" from "a hook
   * injected context into this turn", and the second CHANGED THE CONVERSATION.
   * This is the argument `seq:13` already won for tool calls — a fold that says
   * `Bash` forty times is unskimmable — applied to the record type that never
   * got it.
   *
   * Read off the record's own shape rather than off a list of type names:
   * `attachment.type`, else `subtype` (which is what `system` records carry —
   * `away_summary` and its siblings), else `operation` (`queue-operation`:
   * `enqueue` 790, `remove` 562, `dequeue` 227). `null` when the record names
   * nothing finer than its type.
   */
  subtype: string | null;
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
   * This record's text, WHOLE. Not capped, not sliced — see THERE IS NO TEXT
   * CAP IN THIS DOCUMENT above.
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
  /**
   * **The `id` of this record's `tool_use` block — the handle a subagent is
   * opened by**, and `plan:archive seq:15`'s whole seam.
   *
   * An `agent-<id>.meta.json` sits beside every lane transcript carrying
   * `toolUseId`, which is exactly this id (`SubagentMeta` in
   * `core/conversation-index.ts` has the measurement: 253 of 253 sidecars
   * present, and every `Agent` call in the session resolved). So a step and a
   * lane are joined by a value BOTH SIDES ALREADY RECORDED, and the screen
   * invents no correlation of its own — no timestamp window, no ordinal, no
   * matching of a description against a prompt.
   *
   * **It costs almost nothing and it was measured rather than assumed.** On
   * the owner's own 74,099,176-byte transcript, 2026-09-09:
   *
   *     records                                       31,033
   *     `tool_use` blocks                              3,354
   *     of those carrying an `id`                      3,354   100%
   *     every id served, over the WHOLE file         147,576 bytes   0.2%
   *
   * And per WINDOW, which is the number that actually reaches a screen — the
   * same worst-case 24-node window the `input` measurement above is stated in:
   *
   *     worst 24-node window, without the ids        223,747 bytes
   *     worst 24-node window, with them              225,997 bytes
   *     the 50 ids inside it                           2,250 bytes   0.996%
   *
   * `null` on a record that calls no tool, which is 27,679 of those 31,033.
   *
   * **Last-wins where a record carries two calls, exactly as `tool` and
   * `detail` are**, and deliberately so: a step draws ONE tool name and this
   * is the id of that call. Measured on the same file, 0 records carry more
   * than one `tool_use` block, so the choice is between two spellings of a
   * case that does not occur — and the one that agrees with `tool` cannot
   * label a step with a name and a link that disagree.
   */
  toolUseId: string | null;
  /** This line would not parse. Served as a step so the gap is visible. */
  unreadable: boolean;
}

/**
 * ONE QUESTION AND WHAT WAS DONE WITH IT — `plan:archive seq:16`.
 *
 * **The question and its options arrive as STRUCTURE and the answer arrives as
 * PROSE, and that asymmetry is a fact about the transcript rather than a choice
 * made here.** `seq:24` kept every argument of a call in its own JSON type, so
 * `AskUserQuestion.questions` is a real array of objects carrying every option
 * that was offered. The ANSWER is in the `tool_result`, in English, and there
 * is NO chosen-index field anywhere in the record. Measured on the owner's
 * transcript, 2026-09-09 — 71 calls, 71 answered, **three shapes and not two**:
 *
 *     `The user answered: "Q"="A", "Q2"="A2".`             the common one
 *     `Your questions have been answered: "Q"="A", …`      a resumed ask
 *     a rejection paragraph listing `Questions asked:`     2 of 71, with
 *       `- "Q"` then `  Answer: <label>` or `(No answer provided)`
 *
 * So which option he picked is recovered by MATCHING TEXT, and when the match
 * fails the raw sentence is served instead (`DocNodeBody.answerText`) rather
 * than a silent blank — `INV-nothing-is-dropped-silently`.
 */
export interface DocAnswer {
  /** The question, exactly as the answer names it. */
  question: string;
  /** What he answered — an option label, free text, or both. `null` = none. */
  answer: string | null;
}

/** One node of the document with its body — what the scroll actually draws. */
export interface DocNodeBody {
  n: number;
  kind: 'said' | 'work' | 'deed';
  /** `ran` or `ask` on a `deed` node, `null` on the other two. See `Deed`. */
  deed: Deed | null;
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
   * more. See THERE IS NO TEXT CAP IN THIS DOCUMENT above.
   */
  totalChars: number;
  /** `said`: the thinking that came with the words, folded beside them. */
  thinking: string;
  /** The label a synthetic person-side turn carries. See `DocOutlineNode.y`. */
  synthetic: string | null;
  /**
   * `work`: one entry per record folded — every record, since a run closes at
   * `WORK_RUN_CAP` before it takes another. `deed`: exactly one, the promoted
   * call. `said`: one when the turn ALSO carried a tool call, which is 3 records
   * of 31,101 on the owner's transcript and 2 of them shell commands — words
   * win the classification and the call is served beside them rather than
   * dropped for being rare.
   */
  steps: DocStep[];
  /**
   * `deed`: how the call ended, read off the `tool_result` that answered it.
   * `null` means no result was found within `RESOLVE_AHEAD` records — measured
   * zero on the owner's session, and drawn rather than hidden when it happens.
   */
  outcome: 'ok' | 'failed' | null;
  /** `deed`/`ask`: the questions and what he answered. See `DocAnswer`. */
  answers: DocAnswer[];
  /**
   * The answer sentence VERBATIM, served only when `answers` is empty and a
   * result was found — a shape this parser did not recognise is shown as it
   * was written rather than silently reduced to nothing.
   */
  answerText: string;
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

/** The `<summary>` a task notification carries, collapsed to one line. */
function summaryLine(text: string): string | null {
  const found = /<summary>([\s\S]*?)<\/summary>/.exec(text);
  if (found === null) return null;
  const line = oneLine(found[1] ?? '', 160);
  return line === '' ? null : line;
}

/**
 * WHO CAUSED a synthetic person-side turn — `plan:archive seq:28`'s ruling,
 * applied per kind rather than as one label for all of them.
 *
 * **The distinction lives in the `<summary>` line and nowhere else, which is
 * why this reads the payload rather than the record.** `syntheticLabel` above
 * stops at `task-notification`: the record type, the queue operation and the
 * XML envelope are IDENTICAL for a finished lane, a finished background command
 * and a monitor tick, so nothing outside the summary can tell the 177 from the
 * 24 from the 16. Measured on the owner's own session and reliable across all
 * 217 of them.
 *
 * `null` is the answer for everything else, and it is a real answer: see
 * `Speaker` for the measured table and for why `claude` never appears in it.
 */
function syntheticSpeaker(label: string, text: string): Speaker | null {
  // He typed the slash command. The wrapper is machinery; the ACT was his.
  if (label === 'slash-command') return 'you';
  if (label !== 'task-notification') return null;
  const summary = summaryLine(text);
  if (summary === null) return null;
  // `Agent "…" finished`, and also `failed:`, `was stopped by Claude` and
  // `stalled` — 177 of 217. A lane reporting back, whatever it reported.
  if (summary.startsWith('Agent ')) return 'subagent';
  // `Background command "…" completed (exit code N)` / `failed with exit code
  // N` / `was stopped` — 24. The exit code is inside the sentence itself.
  if (summary.startsWith('Background command')) return 'shell';
  // A monitor tick, or the one record that says no completion was ever found.
  // Nobody caused these; the harness is talking to itself, and an invented
  // name would be worse than none.
  return null;
}

/* ── THE PAYLOAD OF A RECORD THAT CARRIES NO `message` ────────────────────── */

/**
 * Text held under a payload field, whatever shape the harness wrote it in.
 *
 * A bare string, an array of strings, or an array of blocks carrying `content`
 * or `text` — all three occur, and a reader of one of them only would have
 * found a third of what is there.
 */
function payloadText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  const parts: string[] = [];
  for (const block of value) {
    if (typeof block === 'string') { if (block !== '') parts.push(block); continue; }
    if (typeof block !== 'object' || block === null) continue;
    const b = block as { content?: unknown; text?: unknown };
    if (typeof b.content === 'string' && b.content !== '') parts.push(b.content);
    else if (typeof b.text === 'string' && b.text !== '') parts.push(b.text);
  }
  return parts.join('\n\n');
}

/**
 * WHAT A RECORD WITH NO `message` ACTUALLY SAYS — `plan:archive seq:28`, and
 * the same shape of defect `seq:24` fixed one field over.
 *
 * **Measured on the owner's own transcript, 2026-09-09, 31,101 records.** The
 * read model reached for a record's `message` object and its text blocks; these
 * records have none, so nothing was hidden and nothing was capped — the field
 * was never read at all:
 *
 *     `queue-operation.content`   1,352 records   3,971,694 characters
 *     `attachment.rendered[]`     4,129 records   2,016,939 characters
 *     `system.content`               40 records       8,653 characters
 *
 * That is **6.0 MB drawn as three bare words**, and it is not incidental
 * content: the `queue-operation` payload is a `<task-notification>` block,
 * which is HOW A SUBAGENT REPORTS BACK. Every lane completion and every result
 * a dispatched agent returned arrives in that record type, so the archive
 * showed that a lane had finished and not one word of what it said.
 *
 * **AND THE ITEM IS WRONG ABOUT `attachment`, which is worth more than agreeing
 * with it.** `seq:28` states *"`rendered` is null on all 4,796, so there is
 * nothing to draw from there"*. It is not null on any of them: it is ABSENT on
 * 735 and an ARRAY of `{content}` blocks on 4,129, holding the exact
 * `<system-reminder>` text the harness injected into that turn — the
 * instructions, the environment, the session context, the queued command, the
 * hook output. A `typeof x === 'string'` probe would report the same "nothing
 * there" the item did, which is why this reads the shape rather than a type.
 *
 * **A FIELD SWEEP, NOT A TYPE-NAME SWEEP**, exactly as the item requires — *"or
 * the next type to appear repeats it."* `content` first, then `rendered`, on
 * ANY record with no `message`. `system` was found by the sweep and not by
 * name, which is the sweep earning itself once already.
 *
 * **What is deliberately NOT read, so the omission is a decision rather than an
 * oversight**: `last-prompt.lastPrompt` (1,322 records, 152,383 characters) is
 * the harness restating a prompt the document already draws as its own turn,
 * and `bridge-session`, `ai-title`, `custom-title`, `agent-name`, `mode`,
 * `permission-mode` and `atis-latch` are single short identifiers already named
 * by `subtype`. Reading those would be duplication, which is the one thing a
 * document that already tiles its record space cannot afford.
 */
const PAYLOAD_FIELDS = ['content', 'rendered'];

function readPayload(row: Record<string, unknown>): { text: string; subtype: string | null } {
  let text = '';
  for (const field of PAYLOAD_FIELDS) {
    const got = payloadText(row[field]);
    if (got !== '') { text = got; break; }
  }
  return { text, subtype: subtypeOf(row) };
}

/** The record's own name for itself, finer than its `type`. See `DocStep.subtype`. */
function subtypeOf(row: Record<string, unknown>): string | null {
  const attachment = row['attachment'];
  if (typeof attachment === 'object' && attachment !== null) {
    const kind = (attachment as { type?: unknown }).type;
    if (typeof kind === 'string' && kind !== '') return kind;
  }
  for (const field of ['subtype', 'operation']) {
    const value = row[field];
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
}

/**
 * The questions and the answers, read out of the `tool_result`'s English.
 *
 * See `DocAnswer` for the three measured shapes and for why this is a parse of
 * prose rather than a read of a field: there is no chosen-index anywhere in the
 * record. An unrecognised shape returns nothing and the caller serves the
 * sentence itself.
 */
export function parseAnswers(text: string): DocAnswer[] {
  const out: DocAnswer[] = [];

  // The rejection paragraph — `Questions asked:` and then one `- "…"` per
  // question, each followed by `Answer: <label>` or `(No answer provided)`.
  if (text.includes('Questions asked:')) {
    let question: string | null = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      const asked = /^-\s+"([\s\S]*)"$/.exec(line);
      if (asked !== null) {
        if (question !== null) out.push({ question, answer: null });
        question = asked[1] ?? '';
        continue;
      }
      if (question === null) continue;
      const answered = /^Answer:\s*(.+)$/.exec(line);
      if (answered !== null) { out.push({ question, answer: answered[1] ?? '' }); question = null; continue; }
      if (line === '(No answer provided)') { out.push({ question, answer: null }); question = null; }
    }
    if (question !== null) out.push({ question, answer: null });
    if (out.length > 0) return out;
  }

  // `The user answered:` / `Your questions have been answered:` — one
  // `"question"="answer"` pair per question, comma separated.
  if (!/^\s*(The user answered:|Your questions have been answered:)/.test(text)) return out;
  const pair = /"([^"]*)"="([^"]*)"/g;
  for (;;) {
    const found = pair.exec(text);
    if (found === null) break;
    out.push({ question: found[1] ?? '', answer: found[2] ?? '' });
  }
  return out;
}

/**
 * The one-line description of a tool call, read off the tool's OWN argument
 * names rather than off a schema this build does not have.
 *
 * The table is ordered: the first name present wins. A tool nobody listed
 * falls through to the first string argument it carries, which is the safe
 * direction — an unknown tool describes itself imperfectly rather than not at
 * all, and `INV-nothing-is-dropped-silently` prefers the imperfect line.
 *
 * ── `command` LEADS `description`, AND THE PREMISE FOR THAT CHANGED ────────
 *
 * Owner ruling, 2026-09-08: *"move the command into the closed fold"*. The
 * closed fold now shows WHAT RAN rather than the prose written about it.
 *
 * **`seq:24`'s lane argued against exactly this and was right at the time.**
 * While `DETAIL_FIELDS` was the ONLY capture path, promoting `command` would
 * have destroyed `description` outright — and `description` is what makes a
 * fold of 2,375 `Bash` calls skimmable at all. That argument was sound; its
 * PREMISE is what changed. `seq:24` captures the whole input, so `description`
 * is on screen the moment the step is opened, and the swap now costs a reader
 * nothing while gaining the fact over the prose about the fact.
 *
 * **WHAT IT COSTS, MEASURED on the owner's own transcript, 2026-09-08, and
 * reported rather than shipped quietly** — 2,375 `Bash` calls, every one of
 * which carries BOTH a `description` and a `command`:
 *
 *     collapsed command longer than the 160-char cap   1,934   81%
 *
 * and the leading ~46 characters of nearly every one are the same constant,
 * `cd "D:/Users/UserC/source/repos/my-context" && `, which is a third of the
 * budget spent on a fact that never varies. A collapsed heredoc then reads:
 *
 *     cd "D:/…/my-context" && git commit -F - <<'EOF' doctor: a finding
 *     declares its own remedy, and a run is visible to whoever ran it The own…
 *
 * That is a summary line for a `git commit` and it is NOT one for the `python
 * - <<'PYEOF' import io p='reports/…' s=io.open(p,…).read() s=s.replace("| E…`
 * shape, which cuts mid-token and tells a reader only that some Python ran.
 * The ruling is the owner's and it is applied as given; this note is the
 * disclosure that 81% of these lines are truncated and that the prefix is
 * dead weight, so whoever holds the next ruling holds the measurement too.
 */
const DETAIL_FIELDS = [
  'command', 'description', 'file_path', 'pattern', 'query', 'url', 'prompt',
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
  /** The `tool_use` block's own id. See `DocStep.toolUseId`. */
  toolUseId: string | null;
  failed: boolean;
  blocks: string[];
  /** The record's own name for itself, finer than its type. See `DocStep.subtype`. */
  subtype: string | null;
  /** Results this record carries, so a promoted call can learn how it ended. */
  results: { id: string | null; failed: boolean; text: string }[];
}

function emptyRead(): Read {
  return {
    said: '', thinking: '', body: '', tool: null, detail: null, input: [],
    toolUseId: null, failed: false, blocks: [], subtype: null, results: [],
  };
}

function readRecord(message: unknown): Read {
  const out: Read = emptyRead();
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
      content?: unknown; thinking?: unknown; is_error?: unknown; id?: unknown;
    };
    if (typeof b.type === 'string' && !out.blocks.includes(b.type)) out.blocks.push(b.type);
    if (b.type === 'text' && typeof b.text === 'string') said.push(b.text);
    else if (b.type === 'thinking' && typeof b.thinking === 'string') thinking.push(b.thinking);
    else if (b.type === 'tool_use') {
      if (typeof b.name === 'string') out.tool = b.name;
      // The handle a lane is opened by — `DocStep.toolUseId` carries the
      // measurement and the last-wins reasoning.
      if (typeof b.id === 'string' && b.id !== '') out.toolUseId = b.id;
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
      const mine: string[] = [];
      if (typeof b.content === 'string') mine.push(b.content);
      else if (Array.isArray(b.content)) {
        for (const inner of b.content) {
          if (typeof inner === 'object' && inner !== null
            && (inner as { type?: unknown }).type === 'text'
            && typeof (inner as { text?: unknown }).text === 'string') {
            mine.push((inner as { text: string }).text);
          }
        }
      }
      body.push(...mine);
      // KEPT APART AS WELL AS JOINED, so a promoted call can be told how it
      // ended by the record that answered it. `body` is what this record DRAWS;
      // `results` is what it ANSWERS, and the two are the same characters
      // filed under different questions.
      const answers = (b as { tool_use_id?: unknown }).tool_use_id;
      out.results.push({
        id: typeof answers === 'string' && answers !== '' ? answers : null,
        failed: b.is_error === true,
        text: mine.join('\n\n'),
      });
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
  /** A promoted record — a command that ran, or a question put. See `Deed`. */
  deed: Deed | null;
  who: Speaker | null;
  read: Read;
  synthetic: string | null;
}

function shapeOf(row: Record<string, unknown> | null): Shape {
  if (row === null) {
    return { said: false, deed: null, who: null, read: emptyRead(), synthetic: null };
  }
  const message = row['message'];
  if (typeof message !== 'object' || message === null) {
    // NO `message` AT ALL — 62.6% of the file, and 6.0 MB of it carries a
    // payload one field over. See `readPayload`.
    const payload = readPayload(row);
    const read = emptyRead();
    read.body = payload.text;
    read.subtype = payload.subtype;
    read.detail = summaryLine(payload.text);
    return { said: false, deed: null, who: null, read, synthetic: null };
  }
  const content = (message as { content?: unknown }).content;
  // `classifyTurn` is IMPORTED rather than restated — `core/session-summary.ts`
  // gives the reason: the archive's measured definition of a prompt must
  // travel with every surface that shows one, or two screens disagree about
  // one record.
  const turn = classifyTurn(row['type'], content);
  if (turn === 'machinery') {
    const read = readRecord(message);
    read.subtype = subtypeOf(row);
    // A COMMAND, OR A QUESTION PUT TO HIM — lifted out of the fold rather than
    // counted into it. `classifyTurn` still calls this machinery and is right
    // to; what changes is which of the two jobs that bucket was doing.
    return { said: false, deed: deedOf(read.tool), who: null, read, synthetic: null };
  }
  const read = readRecord(message);
  read.subtype = subtypeOf(row);
  let who: Speaker | null = turn === 'prompt' ? 'you' : 'claude';
  const synthetic = turn === 'prompt'
    ? syntheticLabel(read.said, row['isMeta'] === true, row['isCompactSummary'] === true)
    : null;
  // WORDS WIN over a call in the same record, and the call is served beside
  // them rather than dropped — 3 records of 31,101 carry both.
  if (synthetic !== null) who = syntheticSpeaker(synthetic, read.said);
  return { said: true, deed: null, who, read, synthetic };
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
  said: number; work: number; deed: number;
} {
  const nodes: DocOutlineNode[] = [];
  const cursor: TranscriptCursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  const base = resume?.node ?? 0;
  let records = 0;
  let said = 0;
  let work = 0;
  let deed = 0;

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

    // A COMMAND, OR A QUESTION PUT TO HIM. One record, one node, drawn open —
    // `plan:archive seq:16`. Its `peek` is what the call ASKED, so the filter
    // above the scroll now finds a command by what it ran; before this, a
    // search over 2,433 shell calls could match nothing but the word `Bash`.
    if (shape.deed !== null) {
      closeRun();
      const asked = shape.read.detail ?? shape.read.tool ?? '';
      const node: DocOutlineNode = {
        n: base + nodes.length, k: 'deed',
        w: shape.deed === 'ran' ? 'shell' : 'claude',
        t: typeof step.record?.['timestamp'] === 'string'
          ? step.record['timestamp'] as string : null,
        c: asked.length, f: step.index, s: 1, o: step.byteOffset,
      };
      if (asked !== '') node.p = oneLine(asked, PEEK_CHARS);
      if (shape.read.tool !== null) node.x = [shape.read.tool];
      nodes.push(node);
      deed += 1;
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

  return { nodes, records, cursor, said, work, deed };
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

  /**
   * Promoted calls in this window that have not yet been told how they ended.
   * Keyed by the `tool_use` id BOTH SIDES ALREADY RECORDED — the same join
   * `laneIndex` uses, and no correlation invented here either.
   */
  const pending = new Map<string, DocNodeBody>();
  /** The window is full. The walk continues for outcomes only. See `RESOLVE_AHEAD`. */
  let done = false;
  let extra = 0;

  const walk = iterateTranscript(file, {
    cap: DOCUMENT_WALK_CAP, startByte: want.at, startIndex: want.from, cursor,
  });

  for (const step of walk) {
    const shape = shapeOf(step.record);

    // HOW A PROMOTED CALL ENDED, taken from whichever later record answers it.
    // Done before the window check so a deed at the very end of a window still
    // learns its outcome instead of claiming it has none.
    for (const result of shape.read.results) {
      if (result.id === null) continue;
      const node = pending.get(result.id);
      if (node === undefined) continue;
      node.outcome = result.failed ? 'failed' : 'ok';
      if (node.deed === 'ask') {
        node.answers = parseAnswers(result.text);
        if (node.answers.length === 0) node.answerText = result.text;
      }
      pending.delete(result.id);
    }

    if (!done && out.length >= want.count) done = true;
    if (done) {
      // Enough nodes built. Keep reading only far enough to answer the deeds
      // still waiting, then stop: the generator's `finally` closes the
      // descriptor on `break`.
      extra += 1;
      if (pending.size === 0 || extra >= RESOLVE_AHEAD) break;
      continue;
    }

    const timestamp = typeof step.record?.['timestamp'] === 'string'
      ? step.record['timestamp'] as string : null;

    const asStep = (): DocStep => ({
      index: step.index,
      type: typeof step.record?.['type'] === 'string' ? step.record['type'] as string : 'unknown',
      subtype: shape.read.subtype,
      timestamp,
      tool: shape.read.tool,
      detail: shape.read.detail,
      input: shape.read.input,
      toolUseId: shape.read.toolUseId,
      failed: shape.read.failed,
      blocks: shape.read.blocks,
      text: shape.read.body !== '' ? shape.read.body : shape.read.thinking,
      unreadable: step.record === null,
    });

    if (shape.said) {
      closeRun();
      if (out.length >= want.count) { done = true; continue; }
      const text = shape.read.said;
      const thinking = shape.read.thinking;
      out.push({
        n: n++, kind: 'said', deed: null, who: shape.who, timestamp,
        first: step.index, span: 1,
        text,
        totalChars: text.length,
        thinking,
        synthetic: shape.synthetic,
        // A turn that ALSO called a tool keeps the call beside its words —
        // 3 records of 31,101, and dropping them for being rare is the shape
        // `INV-nothing-is-dropped-silently` refuses.
        steps: shape.read.tool !== null ? [asStep()] : [],
        outcome: null, answers: [], answerText: '',
      });
      continue;
    }

    if (shape.deed !== null) {
      closeRun();
      if (out.length >= want.count) { done = true; continue; }
      const node: DocNodeBody = {
        n: n++, kind: 'deed', deed: shape.deed,
        who: shape.deed === 'ran' ? 'shell' : 'claude',
        timestamp, first: step.index, span: 1,
        text: '', totalChars: 0, thinking: shape.read.thinking, synthetic: null,
        steps: [asStep()],
        outcome: null, answers: [], answerText: '',
      };
      out.push(node);
      if (shape.read.toolUseId !== null) pending.set(shape.read.toolUseId, node);
      continue;
    }

    if (open !== null && open.span >= WORK_RUN_CAP) {
      closeRun();
      if (out.length >= want.count) { done = true; continue; }
    }
    if (open === null) {
      open = {
        n: n++, kind: 'work', deed: null, who: null, timestamp,
        first: step.index, span: 0, text: '', totalChars: 0,
        thinking: '', synthetic: null,
        steps: [], outcome: null, answers: [], answerText: '',
      };
    }
    open.span += 1;
    const body = shape.read.body !== '' ? shape.read.body : shape.read.thinking;
    open.totalChars += body.length;
    // EVERY RECORD IN THE RUN IS A STEP. A run closes at `WORK_RUN_CAP` before
    // it takes another record, so `steps.length === span` always — which is
    // exactly why `STEP_CAP` and `stepsOmitted` are gone. See their note above.
    open.steps.push(asStep());
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

/**
 * The indexed row for a session — **or for a SUBAGENT, on the same three
 * routes and through the same renderer.**
 *
 * `plan:archive seq:12`, and it is the seam `seq:15` needs: that item requires
 * *"THE SAME RENDERER, whichever shape wins … A subagent transcript is the
 * same kind of thing and must not grow a second viewer."* Every document route
 * in this module reaches the file through this one function and then uses only
 * `row.file` and `row.bytes`, so teaching THIS to resolve a lane makes the
 * whole outline / nodes / tip document work on one, and leaves `seq:15` with a
 * screen to build rather than a reader to write.
 *
 * **The two id spaces cannot collide, and that is measured rather than
 * assumed.** A session id is the harness's UUID (`595db3b1-a481-…`); a lane id
 * is the transcript's filename, `agent-` + its `agentId` — verified on all 253
 * lanes in this workspace, every one of which begins `agent-` and none of
 * which is a UUID. The session table is consulted FIRST regardless, so a
 * session can never be shadowed by a lane whatever the harness renames next.
 *
 * The lane is adapted into a `ConversationRow` rather than given a parallel
 * type, because what the routes want from it — a file, its size, a name to
 * draw, a branch — is the same list. Two fields are the adapter making a
 * choice and both are stated rather than implied:
 *
 *   - `title` is the lane's `description`, the one line the dispatcher typed.
 *     It is a RECORDED name and not a fabricated one, which is the bar
 *     `customTitleOf` sets. `titleSource` is `'agent'` — a third value beside
 *     `'custom'` and `'ai'`, because "the agent that dispatched it named it"
 *     is neither of those and a reader is owed which.
 *   - `source` is `'subagent'`. It is the honest answer to "what is this row"
 *     and it does not touch the `conversations` table's own `source` column,
 *     which stays `'live'`/`'exported'` for `seq:5`.
 */
function rowFor(ws: Workspace, id: string): { row: ConversationRow } | { fail: JsonResult } {
  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
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
    if (row === null) {
      const agent = index.getSubagent(id);
      if (agent !== null) row = subagentAsRow(agent);
    }
  } finally {
    index.close();
  }
  if (row === null) {
    return {
      fail: {
        status: 404,
        body: {
          error: `no indexed conversation or subagent "${id}".`,
        },
      },
    };
  }
  return { row };
}

/** A lane in the shape the document routes read. See `rowFor` for the two choices. */
function subagentAsRow(agent: SubagentRow): ConversationRow {
  return {
    sessionId: agent.agentId,
    source: 'subagent',
    file: agent.file,
    bytes: agent.bytes,
    mtimeMs: agent.mtimeMs,
    scannedBytes: agent.scannedBytes,
    startedAt: agent.startedAt,
    endedAt: agent.endedAt,
    prompts: agent.prompts,
    answers: agent.answers,
    machinery: agent.machinery,
    records: agent.records,
    unreadable: agent.unreadable,
    branch: agent.branch,
    cwd: agent.cwd,
    title: agent.description,
    titleSource: agent.description === null ? null : 'agent',
    scannedAt: agent.scannedAt,
  };
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
      said: 0, work: 0, deed: 0, nodes: [], truncated: false, walkedBytes: 0,
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
      said: 0, work: 0, deed: 0, nodes: [], truncated: false, walkedBytes: bytes,
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
    deed: built.deed,
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

/**
 * THE TRANSCRIPT'S OWN BYTES, over the records one marked passage covers —
 * `TASK-a-selected-passage-copies-as-something-a-terminal-will`, the third of
 * the three forms it rules.
 *
 * ── WHY THIS IS A SLICE AND NOT A RE-SERIALISATION ────────────────────────
 *
 * The item's words are *"the JSONL exactly as created, for reproducing a bug
 * or feeding a tool."* `readNodes` above cannot answer that: it PARSES, and
 * everything it hands back has been through `shapeOf`, so a record served from
 * it would be this module's reading of the line rather than the line. Anything
 * re-serialised from `JSON.parse` also loses key order, whitespace and the
 * exact number formatting the harness wrote, and those are precisely what a
 * reader reproducing a bug is holding the file for.
 *
 * So this reads BYTES and does nothing else to them. It is exact by
 * construction rather than by care.
 *
 * ── THE OFFSETS ARE ALREADY THE CLIENT'S, WHICH IS WHY IT IS THIS SMALL ───
 *
 * `DocOutlineNode.o` is the byte offset of a node's FIRST record, and a node
 * boundary is a record boundary by construction. So the slice covering nodes
 * `a…b` is `[nodes[a].o, nodes[b + 1].o)` — two numbers the screen already
 * holds — and `to` is simply omitted for a passage that runs to the end of the
 * document, which reads to whatever end-of-file is at the moment of the read.
 * No node model, no walk, no `iterateTranscript`.
 *
 * ── WHAT IT EXPOSES, SAID RATHER THAN LEFT TO BE FOUND ────────────────────
 *
 * A raw record carries envelope fields the document never draws — `cwd`,
 * `gitBranch`, `userType`, `requestId`, `sessionId`, `parentUuid`. It serves
 * no TEXT that is not already on the screen, so
 * `TASK-the-archive-already-serves-a-live-api-key-and-full-input`'s finding is
 * unchanged by it; what it adds is the envelope, and the absolute paths in it
 * come off the reader's own machine.
 *
 * That is a small widening rather than none, so it is FILED rather than
 * argued here: `TASK-the-raw-record-copy-serves-envelope-fields-the-screen-never`
 * carries it, and it depends on `seq:27` deliberately — one product should not
 * grow two redaction policies.
 *
 * It is also read-only, on the loopback-bound server, over a file already
 * unencrypted in the reader's own home — the exposure `seq:27` measured and
 * declined to call a leak.
 *
 * ── AND IT REFUSES RATHER THAN TRUNCATES ──────────────────────────────────
 *
 * A truncated JSONL is a broken JSONL: the last line is half a record and the
 * tool it was copied for will reject the whole file. `INV-nothing-is-dropped-
 * silently` and the item's own *"worse than one that refuses"* agree here, so
 * a slice over `PASSAGE_RAW_CAP` returns the size and no bytes, and the screen
 * says how big the passage was.
 */
export const PASSAGE_RAW_CAP = 8 * 1024 * 1024;

export interface DocRawBody {
  sessionId: string;
  /** `false` — the transcript is not on disk. No bytes, and not an error. */
  present: boolean;
  /** First byte served. Echoed so a caller can see what it actually got. */
  at: number;
  /** Bytes served. `0` with `tooLong` set is the refusal, never a short read. */
  bytes: number;
  /** The slice would have been this many bytes. Only set when `tooLong`. */
  wanted: number;
  /** The slice is longer than `PASSAGE_RAW_CAP`, so nothing was served. */
  tooLong: boolean;
  text: string;
}

export function apiConversationRaw(
  ws: Workspace, url: URL, params: { id: string },
): JsonResult {
  const bad = unknownParams(url, ['at', 'to']);
  if (bad !== null) return badRequest(bad);

  const at = digits(url, 'at');
  const to = digits(url, 'to');
  if (at === null) return badRequest('at must be a whole number, written in digits.');
  if (to === null) return badRequest('to must be a whole number, written in digits.');

  const found = rowFor(ws, params.id);
  if ('fail' in found) return found.fail;
  const { row } = found;

  const empty = (present: boolean): JsonResult => ({
    status: 200,
    body: {
      sessionId: row.sessionId, present, at: at ?? 0, bytes: 0,
      wanted: 0, tooLong: false, text: '',
    } satisfies DocRawBody,
  });

  let size = 0;
  try {
    const stat = statSync(row.file);
    if (!stat.isFile()) throw new Error('not a file');
    size = stat.size;
  } catch {
    return empty(false);
  }

  const start = at ?? 0;
  // The file is written while it is read, so an end past what is there now is
  // a legitimate question about a file that has since changed — the same
  // answer `apiConversationNodes` gives, for the same reason.
  const end = Math.min(to === undefined ? size : to, size);
  if (start >= size || end <= start) return empty(true);

  const wanted = end - start;
  if (wanted > PASSAGE_RAW_CAP) {
    return {
      status: 200,
      body: {
        sessionId: row.sessionId, present: true, at: start, bytes: 0,
        wanted, tooLong: true, text: '',
      } satisfies DocRawBody,
    };
  }

  const buffer = Buffer.alloc(wanted);
  let read = 0;
  let fd: number | null = null;
  try {
    fd = openSync(row.file, 'r');
    read = readSync(fd, buffer, 0, wanted, start);
  } catch {
    return empty(true);
  } finally {
    if (fd !== null) { try { closeSync(fd); } catch { /* nothing usable to close */ } }
  }

  const text = buffer.subarray(0, read).toString('utf8');
  return {
    status: 200,
    body: {
      sessionId: row.sessionId, present: true, at: start, bytes: read,
      wanted, tooLong: false, text,
    } satisfies DocRawBody,
  };
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
  registerRoute('GET', '/api/conversations/:id/raw', {
    kind: 'json',
    handle: (ctx: ApiContext) =>
      apiConversationRaw(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
