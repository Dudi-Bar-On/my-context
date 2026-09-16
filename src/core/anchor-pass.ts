/**
 * **THE AUTOMATIC ANCHOR PASS, AND IT LIVES IN `core/` BECAUSE MORE THAN ONE
 * SURFACE STARTS IT.**
 *
 * Every line below this header was moved here unchanged from
 * `src/cli/commands/conversation.ts` on 2026-09-12, under
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`. Nothing
 * about the grammar, the probes or the sweep changed in the move; what changed
 * is WHO CAN START IT.
 *
 * ── WHY IT HAD TO MOVE, said as the defect it was ─────────────────────────
 *
 * The owner's ruling: *"you shouldn't limit me because you decided to use the
 * CLI and then you tell me that this is the way i need to use it —
 * unacceptable."* The pass was reachable only from `mycontext conversation
 * rebuild`, and the viewer could not start it, because reaching it would have
 * meant importing `cli/commands/conversation.ts` — a module that calls
 * `registerCommand` at load and drags `confirmAction` and the whole CLI
 * surface in with it. That is a property of LOADING the module, which is
 * exactly what `test/ui/no-writes.test.ts`' import walk sees and refuses.
 *
 * So the pass is here, the command re-exports it, and the viewer imports it
 * from `core/` — one implementation, three surfaces, and no second grammar.
 *
 * **`markAutomaticAnchors` is a WRITE** and is named in `test/ui/no-writes.
 * test.ts`' `WRITERS` table as one; `src/ui/anchor-write.ts` binding it is a
 * ruled entry in `RULED_WRITES` with the properties that bound it.
 */
import {
  ConversationIndex, anchorIdFor, iterateTranscript, laneNameOf,
  type LaneLastAnswer,
} from './conversation-index.ts';
import { markAnchor, unmarkAnchor, type AutomaticAnchorKind } from './anchors.ts';
import { anchorTransaction } from './anchor-file.ts';
import {
  buildSearchIndex, proseOf, searchArchive,
  type SearchBuildReport, type SearchScope, type StaleSource,
} from './conversation-search.ts';
import type { ProseHit } from './conversation-index.ts';

/* ══ ANCHORS — `plan:recall seq:1`, Task 4 ════════════════════════════════ */

/**
 * **What the automatic pass will mark, and why it is a grammar rather than a
 * judgement.**
 *
 * §7 of the retrieval design records the owner's ruling that things which are
 * anchors BY NATURE are marked *"automatically by the assistant without
 * requiring the user to initiate one"*, and names *"a table, a report"* and a
 * ruling he gave. **The report half was withdrawn on 2026-09-11**, by him,
 * after reading the 613 anchors the first night produced — see the note where
 * that grammar used to be. What is left is a table and a ruling, and
 * everything below is the reading of "by nature" that this command is willing
 * to defend: a shape the text either has or has not.
 *
 * Nothing here scores, thresholds or infers. That is deliberate, and the
 * research this plan rests on is the reason: a lexical signal/noise classifier
 * measured **AUC 0.499** on this corpus — a coin flip — and a two-rule version
 * of the best single feature still admitted 47% of the noise. A detector that
 * guessed would fill his list with turns he never wanted and he would stop
 * reading the list, which costs more than marking nothing.
 *
 * Each finding also carries the EVIDENCE as its label — the table's header
 * row, the path, the id — so a reader can see what fired without opening the
 * turn, and a wrong mark is visibly wrong rather than merely present.
 */
export interface AutoAnchorFinding {
  /**
   * Which grammar matched. The type is `AutomaticAnchorKind` and not `string`
   * so that the pass cannot write a kind outside the set `core/anchors.ts`
   * holds — the set the OWNER's vocabulary is required to stay disjoint from.
   */
  kind: AutomaticAnchorKind;
  /**
   * The evidence — never a summary of the turn. A ruling's is the id,
   * verbatim; a table's is the nearest heading above it and its header cells,
   * which is the one place this stops being verbatim and says why
   * (`tableLabel`).
   */
  label: string;
}

/** The cells of one Markdown table row, or `null` when the line is not one. */
function cellsOf(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim());
}

/** GFM's delimiter row: every cell is dashes, with optional alignment colons. */
function isDelimiter(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * **A cell somebody can read: it carries a letter or a digit.**
 *
 * `\p{L}` and `\p{N}` rather than `[a-z0-9]`, and that is not tidiness — this
 * archive is half Hebrew, and an ASCII test would have called every Hebrew
 * header unreadable and thrown it onto the fallback below.
 */
function isReadable(cell: string): boolean {
  return /[\p{L}\p{N}]/u.test(cell);
}

/** Where the first GFM table of a text is, and what its header row says. */
interface TableSite {
  /** Index into the split lines of the HEADER row — the delimiter is below it. */
  headerLine: number;
  header: string[];
}

/**
 * The first GFM table in these lines, or `null`.
 *
 * Split out from `tableIn` on 2026-09-15 for one reason: the label now needs
 * the heading ABOVE the table, so it needs to know where the table is and not
 * only what its header says.
 */
function firstTableSite(lines: readonly string[]): TableSite | null {
  for (let i = 1; i < lines.length; i += 1) {
    const delimiter = cellsOf(lines[i] ?? '');
    if (delimiter === null || !isDelimiter(delimiter)) continue;
    const header = cellsOf(lines[i - 1] ?? '');
    if (header === null || header.length !== delimiter.length || header.length < 2) continue;
    return { headerLine: i - 1, header };
  }
  return null;
}

/** A Markdown heading: `#` through `######`, closing hashes tolerated. */
const ATX_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

/**
 * **A bold line standing alone, which is how this archive writes most of its
 * headings.** `**Wave 1 results**` over a table is a caption and nothing else.
 *
 * Measured 2026-09-15 over the 376 table anchors in the owner's corpus: ATX
 * headings alone reach 242 of them; counting these reaches 285. The 43 it adds
 * are captions immediately above the table, which is the position the ruling
 * names.
 *
 * A trailing colon is dropped by `headingAbove`, in either of the two places a
 * caption puts one — `**What I measured:**` and `**What I measured**:`.
 */
const BOLD_HEADING = /^\s{0,3}\*\*(.+?)\*\*:?\s*$/;

/**
 * **How far above a table a heading may be and still be ITS heading.**
 *
 * Measured 2026-09-15 on all 376 table anchors in the owner's corpus, scanning
 * with NO window at all: the nearest heading above a table sits 2 lines up at
 * the median, 12 at the 99th percentile, and **20 at the furthest of all 285
 * that have one**. So 24 loses nothing that was found without a bound, and
 * what it refuses is a heading ten screens up that belongs to a different
 * section — which is a heading the table is under, not the table's own.
 */
export const HEADING_LOOKBACK_LINES = 24;

/**
 * The nearest heading above one table, or `null` when there is none within
 * reach. First match walking UP wins, which is what "nearest" means.
 */
function headingAbove(lines: readonly string[], headerLine: number): string | null {
  const floor = Math.max(0, headerLine - HEADING_LOOKBACK_LINES);
  for (let i = headerLine - 1; i >= floor; i -= 1) {
    const line = lines[i] ?? '';
    const heading = (ATX_HEADING.exec(line) ?? BOLD_HEADING.exec(line))?.[1];
    // A heading of punctuation — `## ---`, `**···**` — is `isReadable`'s own
    // question, asked here for the same reason it is asked of a header cell:
    // a bookmark named after border characters is one he cannot recognise.
    // The walk CONTINUES past one rather than giving up, because such a line
    // is a rule somebody drew and not a statement that this table has no
    // heading.
    if (heading !== undefined && isReadable(heading)) {
      // A caption's trailing colon is punctuation joining it to what follows,
      // and what follows is the table. `**What I measured:**` and `**What I
      // measured**:` both reach here — the regex above captures the colon in
      // the first spelling and not in the second — so it is stripped here,
      // once, rather than in two patterns that could come to disagree.
      return heading.trim().replace(/\s*:$/, '');
    }
  }
  return null;
}

/**
 * **The longest label the automatic pass will compose**, and the length at
 * which it starts SAYING that it dropped something.
 *
 * Measured 2026-09-15 across the owner's 376 table anchors, composing every
 * one of them: the full heading-plus-header label is 55 characters at the
 * median, 106 at the 90th percentile, 262 at the 99th and 428 at the longest.
 * 200 therefore leaves ~97% of his tables untouched and bounds the tail, which
 * is the half a list has to survive. It is well under the 500 `LABEL_CAP` the
 * write routes enforce (`src/ui/anchor-write.ts`), so nothing the pass composes
 * can be a label the screen would have refused.
 */
export const TABLE_LABEL_CAP = 200;

/**
 * The share of the cap a heading may take before the header cells are starved.
 * 120 leaves at least 77 characters for cells in the worst case.
 */
const HEADING_CAP = 120;

/** Between the heading and the cells, and between the cells. */
const HEADING_JOIN = ' — ';
const CELL_JOIN = ' | ';

/** `text`, or its first `cap` characters with an ellipsis where the rest was. */
function clip(text: string, cap: number): string {
  return text.length <= cap ? text : `${text.slice(0, cap - 1).trimEnd()}…`;
}

/**
 * **What one table's anchor is CALLED** — rewritten 2026-09-15 under
 * `TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a`.
 *
 * ── THE DEFECT, AS HE FOUND IT ────────────────────────────────────────────
 *
 * This was `header.find(isReadable)` — the first readable cell and nothing
 * else — and it left **376 of his 750 bookmarks named after a single column
 * heading**: `"id"`, `"lane"`, `"before"`, `"status"`, `"D"`. 27 of them were
 * called `"lane"` and 13 `"before"`, which are not names at all once there are
 * two. His words: *"you write Marked lane, it would be nice to see which lane,
 * which table, which report etc for every mark you add."*
 *
 * **OWNER RULING 2026-09-15, option 1b plus the clarification he gave when
 * asked: the label carries the HEADER CELLS PLUS THE NEAREST HEADING ABOVE THE
 * TABLE.**
 *
 * ── AND THE 2026-09-11 RULING THIS REPLACES IS NOT UNDONE ─────────────────
 *
 * The single cell was itself a repair: the label had been the whole header row
 * joined with `" | "`, and 25 of his anchors came out labelled literally `|`
 * and five more `|  |`, because a header of empty cells joins to nothing but
 * its own borders. **That defect is not reintroduced**, and the reason is that
 * only READABLE cells are joined — the `find` became a `filter`, which is the
 * smallest possible change that keeps the old ruling's guarantee. When no cell
 * is readable the label still SAYS `a table of N columns` rather than drawing
 * the borders, and now a heading above it can rescue even that: 32 of his
 * anchors wear the `a table of N columns` fallback today and the ones with a
 * heading become, for instance, `📦 4 — How the store actually works — a table
 * of 2 columns`.
 *
 * ── IT IS COMPOSED FROM THE TURN AT THE BYTE, AND IS NOT A STORE ───────────
 *
 * Every part of this reads the text the anchor points at, exactly as it did
 * before. Nothing is cached, nothing is written beside the anchor, and a
 * relabel is the RELABEL the pass already reports.
 *
 * ── A DROPPED CELL IS SAID, NOT SWALLOWED ─────────────────────────────────
 *
 * `TABLE_LABEL_CAP` argues the number. When cells do not fit, the label ends
 * `+N more` rather than simply stopping — a capped answer and a complete one
 * must not look the same, which is the rule `ANCHOR_PROBE_LIMIT` already obeys
 * one layer up.
 */
function tableLabel(lines: readonly string[], site: TableSite): string {
  const readable = site.header.filter(isReadable);
  const cells = readable.length === 0
    ? [`a table of ${site.header.length} columns`]
    : readable;

  const heading = headingAbove(lines, site.headerLine);
  const head = heading === null ? '' : `${clip(heading, HEADING_CAP)}${HEADING_JOIN}`;
  const room = TABLE_LABEL_CAP - head.length;

  const kept: string[] = [];
  let width = 0;
  for (const cell of cells) {
    if (kept.length === 0) {
      // The first cell is always kept — a label of nothing but `+4 more` names
      // nothing — and clipped to the room it has so one enormous header cell
      // cannot carry the label past the cap on its own.
      const first = clip(cell, room);
      kept.push(first);
      width = first.length;
      continue;
    }
    if (width + CELL_JOIN.length + cell.length > room) break;
    kept.push(cell);
    width += CELL_JOIN.length + cell.length;
  }

  const dropped = cells.length - kept.length;
  return `${head}${kept.join(CELL_JOIN)}${dropped === 0 ? '' : ` +${dropped} more`}`;
}

/**
 * **The label of the first GFM table in this text, or `null`.**
 *
 * The rule for what IS a table is GFM's own and not an approximation of it: a
 * delimiter row, and a header row directly above it with THE SAME NUMBER OF
 * CELLS. Both halves earn their place against shapes that occur in this
 * archive constantly —
 *
 *   - a line full of `|` with no delimiter under it is a shell pipeline, and a
 *     detector that marked those would mark most `Bash` turns in the corpus;
 *   - a row of dashes whose count does not match the header is ASCII art or a
 *     horizontal rule someone drew with pipes.
 *
 * What comes back is `tableLabel`'s answer, which is never empty and never
 * only punctuation.
 *
 * Exported so the grammar can be tested on its own, in both directions. A
 * detector whose only test is through the command is a detector whose FALSE
 * side nobody checked.
 */
export function tableIn(text: string): string | null {
  const lines = text.split('\n');
  const site = firstTableSite(lines);
  return site === null ? null : tableLabel(lines, site);
}

/**
 * ── THERE WAS A THIRD GRAMMAR HERE, AND HE RULED IT OUT ────────────────────
 *
 * A **report** was a dated `.md` path under `reports/` or
 * `docs/superpowers/{specs,plans}/`. It contributed 101 of the 613 anchors the
 * pass wrote into his index overnight, and on 2026-09-11 he read them and
 * ruled: it marks *a turn that mentions a report*, not a report, and those are
 * not worth having. The regex is gone, the two probes that fed it are gone,
 * and `markAutomaticAnchors` takes back the anchors it already wrote —
 * `TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled`.
 *
 * `test/cli/anchors.test.ts` holds the removal from both ends: the grammar
 * answers `null` for such a path, and a rebuild over a fixture that names two
 * of them writes no anchor at either byte. Neither assertion alone would
 * notice a probe put back without its regex, or a regex put back without its
 * probe.
 *
 * **THE WORD `report` IS SPENT AGAIN AND THE RULING ABOVE STILL STANDS**, on
 * 2026-09-15 under `TASK-take-the-lane-report-and-the-owner-s-own-words-as-
 * automatic`. What he refused was a turn that NAMES a report. What he ruled in
 * is a lane's final answer, decided from `subagents` and a `MAX(byte_offset)`
 * with NO text consulted at all -- so the new kind cannot reach a turn that
 * merely points at something, because it never reads a turn's words to decide.
 * `laneReportAt` below is the whole of it.
 */

/**
 * ── THE `ruling` DETECTOR THAT WAS HERE, AND WHY A NORMATIVE ID REPLACED
 *    ITSELF WITH HIS OWN WORDS ─────────────────────────────────────────────
 *
 * It was `/\b(?:DEC|RULE|INSTR|STD|CONST|INV)-[a-z0-9]+(?:-[a-z0-9]+){3,}\b/`
 * behind a `kind === 'prompt'` guard, and it is gone under
 * `TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic`, owner
 * ruling 2026-09-15: **replace it, do not delete it.** The KIND is the right
 * name for the right thing — a judgement he gave, and the thing he most wants
 * to find again. Only the detection was wrong.
 *
 * **HOW WRONG, measured by `anchors/11` over all 10,836 prose spans of his real
 * archive: the id grammar owned 377 of his 1,164 marks — 32% — and marked ZERO
 * turns he typed.** 296 were a lane's FIRST prose span, which is THIS PLUGIN'S
 * OWN SubagentStart injection block: it delivers every governing item, so it
 * carries every normative id there is. 28 more were later lane turns and 53
 * were `<task-notification>` blobs and compaction summaries. Fifty-five wore
 * the identical label `RULE-a-test-names-the-items-it-rests-on-or-says-it-
 * rests-on-none` — an item this plugin injects into every lane. By the standard
 * that killed the report grammar one note up, all 377 marked a turn that
 * MENTIONS a rule.
 *
 * **AND REPAIRING THE GUARD WOULD HAVE MARKED NOTHING.** In 519 turns he typed
 * over 13 days he named a normative id ZERO times. He does not speak in ids, so
 * the id cannot find him however tightly the guard is drawn. That is why the
 * DETECTOR changed and not the condition around it.
 */

/**
 * **THE WORDS HE RULES IN** — read off his own prompts, never from a thesaurus.
 *
 * Measured by `anchors/11` on his 519 owner-typed turns: this list marks 38 of
 * them, about 1 in 14, with 26 of 38 clearly worth having and 34 of 38 counting
 * corrections.
 *
 * ── THE MODAL LIST IS REFUSED, AND THE MEASUREMENT IS THE REASON ───────────
 *
 * `should` / `i want` / `need to` / `do not` marks 143 of his turns and scores
 * the SAME worth-having share — ~40% — as *"he typed 250 characters with no
 * keyword at all"*, which is the dumb baseline it has to beat to exist. Those
 * words are his ordinary register, not a ruling signal. **Do not widen this
 * because it feels thin.** Thin and precise is the point, and the number that
 * says so is the baseline, not an opinion about the words.
 *
 * `nevver` is his spelling and it is here for that reason — it occurs in the
 * archive, and a list read off a corpus carries what the corpus holds.
 */
const RULING_WORDS =
  /\b(?:always|never|nevver|must|unacceptable|not allowed|forbidden|from now on|i approve|i decide|the rule|this rule|a rule|standardi[sz]e)\b/i;

/**
 * **The longest ruling label, and it is `TABLE_LABEL_CAP`'s number on purpose**
 * — one cap for what the pass composes, so two kinds of mark cannot come to
 * disagree about how long a name may be.
 */
export const RULING_LABEL_CAP = TABLE_LABEL_CAP;

/**
 * **What one ruling is CALLED: the LINE the word is on, verbatim, clipped.**
 *
 * The evidence and never a summary — `AutoAnchorFinding`'s own rule. A label of
 * the matched word alone would put `always` on his list twelve times over,
 * which is exactly the single-header-cell defect `tableLabel` was rewritten to
 * fix on the same day.
 *
 * ── A LINE AND NOT A SENTENCE, AND THAT WAS MEASURED ──────────────────────
 *
 * Composed both ways over all 36 of his turns this list marks, 2026-09-15.
 * Splitting on `.!?` produced five labels that begin mid-thought, because a
 * full stop in this archive is usually a file extension: `", i have already
 * added a rule …"`, `"json - i approve you to change it …"`, `"\" - if there is
 * a size restriction it must be removed …"`. A newline is a unit HE typed; a
 * sentence boundary is one guessed from punctuation he does not use that way.
 *
 * Exported so the label rule can be tested without a transcript, for `tableIn`'s
 * stated reason: a composer whose only test is through the pass is a composer
 * whose edge cases nobody checked.
 */
export function rulingLabel(text: string, at: number, word: string): string {
  const from = text.lastIndexOf('\n', at) + 1;
  const to = text.indexOf('\n', at);
  const line = text.slice(from, to < 0 ? text.length : to).trim();
  // A line that trims to nothing leaves the matched word as the label. It names
  // less than the line does and it is never empty, which is the one property a
  // list entry has to have.
  return line === '' ? word : clip(line, RULING_LABEL_CAP);
}

/**
 * **THE STRUCTURAL FACTS ONE TURN CARRIES, WHICH IS WHAT THE GRAMMAR READS
 * INSTEAD OF GUESSING.**
 *
 * `anchorInTurn` used to take `kind: string` — `classifyTurn`'s answer — and
 * that single parameter is the mechanical cause of every defect in the note
 * above: `classifyTurn` calls a lane dispatch and a harness notification a
 * "prompt", so a guard written to admit only what the owner GAVE admitted
 * precisely what it was written to exclude.
 *
 * So the grammar is handed the RECORD, and asks the archive's own columns.
 */
export interface TurnFacts {
  /**
   * The transcript record that starts at this byte, or `null` when the caller
   * could not read one.
   *
   * **`null` means "not his"**, which is the safe direction: a caller that
   * cannot see the record cannot claim the owner typed the turn.
   */
  record: Record<string, unknown> | null;
  /**
   * **The lane's own mission when this turn IS that lane's report**, and `null`
   * when it is not one. Decided by the caller from `subagents` and the prose
   * index — see `laneReportAt`. No text is consulted to produce it.
   */
  laneReport: string | null;
}

/**
 * **DID HE TYPE THIS? — asked of the archive's own columns, not of the text.**
 *
 * This is the risk `TASK-take-the-lane-report-and-the-owner-s-own-words-as-
 * automatic` says must be DESIGNED AGAINST rather than noted, because every
 * ruling mark rests on it and it is exactly what was broken. `anchors/11`'s own
 * `ownerTyped` was a list of text shapes — `^<task-notification`,
 * `^<system-reminder`, and eight more — and **it leaked twice in a 38-row
 * sample**: a `/command` body and a skill preamble. A list of strings that has
 * to grow as the harness changes rebuilds the defect in a new costume.
 *
 * ── THE THREE COLUMNS, AND WHAT EACH ONE REMOVES, MEASURED ────────────────
 *
 * Counted over all 10,910 prose spans of the owner's archive, 2026-09-15, by
 * reading each span's record at its own byte:
 *
 * | column | what it is | what it removes here |
 * |---|---|---|
 * | `origin.kind === 'human'` | the harness's own record of WHO produced the prompt | 10,373 spans that are not a person at all |
 * | `isSidechain !== true` | this record is in a LANE's transcript | 13 relays of his words INTO a lane |
 * | `isMeta !== true` | the harness's own "this is not user input" | the same 13 |
 *
 * **537 spans carry `origin.kind === 'human'`; 524 survive all three**, and all
 * 524 are `classifyTurn`-prompts without that ever being asked — which is the
 * point: the kind is DERIVED from this, not a condition on it.
 *
 * The 13 the last two guards remove are one shape: *"The user sent a new
 * message while you were working: …"*, the harness relaying him into a running
 * lane. It is `origin.kind: 'human'` because the words started with him, and
 * `isMeta` / `isSidechain` because the TURN is not his. Two independent columns
 * catch it; either alone would do, and both are kept because they say different
 * true things and a future harness need not keep both.
 *
 * ── WHAT IT DOES NOT CATCH — THE RESIDUE, REPORTED RATHER THAN PAPERED ────
 *
 * **Two of the 524 are slash-command envelopes** —
 * `<command-message>mycontext:ui</command-message>…` — which the harness files
 * as `origin.kind: 'human'` because he did invoke them. The WORDS are the
 * harness's. Neither matches `RULING_WORDS`, so the residue marks nothing
 * today; it is stated because it is real and it can change.
 *
 * **It is not closed with `promptSource`, deliberately**, though that column
 * would remove exactly those two (522 of 524 carry one). A transcript written
 * before the harness added that field has none, and the guard would then drop
 * his real turns silently — a worse failure than two envelopes that mark
 * nothing. `INV-nothing-is-dropped-silently` points the same way.
 *
 * `isCompactSummary` is NOT checked, and that is a measured zero rather than an
 * oversight: all 10 compaction summaries in this archive carry no `origin` at
 * all, so `origin.kind === 'human'` has already refused them.
 */
export function ownerTyped(record: Record<string, unknown> | null): boolean {
  if (record === null) return false;
  if (record['isSidechain'] === true) return false;
  if (record['isMeta'] === true) return false;
  const origin = record['origin'];
  return typeof origin === 'object' && origin !== null
    && (origin as { kind?: unknown }).kind === 'human';
}

/**
 * **What, if anything, makes this turn an anchor by nature.**
 *
 * The order is the precedence, and first match wins.
 *
 * ── WHY THE TABLE STILL COMES FIRST, WITH THE `report` KIND BESIDE IT ─────
 *
 * 230 of the archive's 419 lane reports already carry a `table` mark, because a
 * lane that reports in a table is this project's own house style. Putting
 * `report` first would RELABEL all of them — and the worth of the report mark
 * was judged, 8 out of 8, on a sample drawn from the 189 that carry NOTHING
 * today (`anchors/11`, section 7). Applying it to turns that already wear a
 * judged-good mark is a change nobody measured, so it is not made. The table is
 * the thing IN the turn; it keeps the turn.
 *
 * The consequence is stated rather than hidden: the `report` kind names 189 of
 * the 419 lane reports and the rest stay findable as the tables they are.
 * Reversing it is one line here, and the unscoped rebuild's sweep would relabel
 * them.
 *
 * ── AND THE RULING IS LAST, WHICH COSTS NOTHING ──────────────────────────
 *
 * `laneReport` is non-null only for a lane's answer and `ownerTyped` is true
 * only in the main session, so those two are disjoint by construction. The
 * order between them is documentation, not arbitration.
 */
export function anchorInTurn(facts: TurnFacts, text: string): AutoAnchorFinding | null {
  const table = tableIn(text);
  if (table !== null) return { kind: 'table', label: table };
  if (facts.laneReport !== null) return { kind: 'report', label: facts.laneReport };
  if (ownerTyped(facts.record)) {
    const ruling = RULING_WORDS.exec(text);
    if (ruling !== null) {
      return { kind: 'ruling', label: rulingLabel(text, ruling.index, ruling[0]) };
    }
  }
  return null;
}

/**
 * **HOW LONG A LANE'S FINAL ANSWER HAS TO BE TO BE ITS REPORT** — measured by
 * `anchors/11` on the owner's lanes, not chosen.
 *
 * A lane's last answer is **7,530 characters at the median**. Only 19 of 436
 * fall under 400, and reading them shows what they are: *"that background
 * command finished, no action needed"* — a trailing acknowledgement after the
 * report, not the report. The floor refuses exactly those and keeps the rest.
 *
 * It is a floor on the ANSWER and not a judgement about it: nothing here reads
 * what the lane said.
 */
export const LANE_REPORT_FLOOR_CHARS = 400;

/**
 * **IS THIS TURN A LANE'S REPORT, AND WHAT IS IT CALLED?** — `null` when it is
 * not one.
 *
 * Three facts, all structural, none of them a grammar:
 *
 *   1. the turn is in a LANE's transcript (`agentId !== null`);
 *   2. it is at the byte of that lane's LAST ANSWER, per
 *      `ConversationIndex.laneLastAnswers`;
 *   3. it carries at least `LANE_REPORT_FLOOR_CHARS`.
 *
 * **The label writes itself and is never fabricated**: `laneNameOf` is
 * `subagents.description`, the one line the dispatcher typed — measured present
 * for 419 of 419 lanes with a report. A lane the archive no longer holds a row
 * for has no name, and then this answers `null` rather than inventing one:
 * `STD-a-measured-zero-is-drawn-and-named` in the direction that matters here,
 * which is that a bookmark called nothing is a bookmark he cannot recognise.
 *
 * **THE LANE DISPATCH IS REFUSED, and it is refused by construction rather than
 * by a rule against it.** The dispatch is a lane's FIRST prose span and it is a
 * prompt; this asks for the LAST ANSWER. There is no input for which both are
 * true unless a lane's only answer is also its dispatch, which is not a shape a
 * transcript has.
 */
export function laneReportAt(
  index: ConversationIndex,
  lastAnswers: ReadonlyMap<string, LaneLastAnswer>,
  agentId: string | null,
  byteOffset: number,
  text: string,
): string | null {
  if (agentId === null) return null;
  if (lastAnswers.get(agentId)?.byteOffset !== byteOffset) return null;
  if (text.length < LANE_REPORT_FLOOR_CHARS) return null;
  return laneNameOf(index, agentId);
}

/**
 * **The cheap probes that narrow the archive before the grammar decides.**
 *
 * The grammar above needs a turn's WHOLE text and the prose index stores it,
 * but nothing exposes "every span" — and walking all 875 MB of transcript a
 * second time to re-derive what the index already read would cost the rebuild
 * its whole argument. So this uses the index as an index: each probe is a
 * contiguous substring that a turn of that kind MUST contain, `searchArchive`
 * returns the candidates, and the record at each candidate's byte offset is
 * read — one seek, one line — and put to the grammar.
 *
 * **A probe is allowed to be loose and the grammar is not.** `---` appears in
 * YAML front matter, in horizontal rules and in half the ASCII art in this
 * archive; every one of those is a candidate and none of them is marked,
 * because `tableIn` asks for a header row with a matching cell count. The
 * probe decides what is READ; the grammar decides what is MARKED.
 */
/*
 * **SIX OF THESE WERE THE NORMATIVE-ID PREFIXES, AND THEY ARE GONE** —
 * `DEC-`, `RULE-`, `INSTR-`, `STD-`, `CONST-`, `INV-`, each with `kind:
 * 'prompt'`. Removed 2026-09-15 with the grammar they fed.
 *
 * **The `ruling` kind did not lose its candidates; it stopped needing a probe.**
 * Its detector is now the owner's own words, and probing THOSE would be twelve
 * queries on the commonest words in English — 7-20 ms each against 1.3 ms for a
 * rare literal, on top of a budget these eight already overran.
 * `ConversationIndex.ownerPromptSpans` answers the same question with ONE
 * unranked `WHERE` at 19 ms, and its header carries the measurement.
 *
 * What is left is the table, which really is a shape in the text and really
 * does need finding by one.
 */
const ANCHOR_PROBES: { probe: string; kind?: 'prompt' | 'answer' }[] = [
  { probe: '|---' },
  { probe: '| ---' },
];

/**
 * How many candidates one probe brings back.
 *
 * A bound rather than everything, for `MAX_SCAN_BYTES`' reason: this runs on a
 * command a person types and must not become the slow part of it. When a probe
 * fills its bound the report SAYS so, because a capped pass and a complete one
 * must not look the same.
 */
export const ANCHOR_PROBE_LIMIT = 200;

/**
 * **How many pages of `ANCHOR_PROBE_LIMIT` one probe may walk.**
 *
 * Added 2026-09-15 under
 * `TASK-the-automatic-marking-stopped-and-said-nothing-because-a`, and it is
 * the bound that replaces a TRUNCATION. See `markAutomaticAnchors`' header for
 * the measurement; in one line, the `"|---"` probe matches 777 spans in this
 * archive and the first 200 by relevance are not the newest 200, so the 577
 * behind them were unreachable by any run at all — including the unbounded
 * `mycontext conversation rebuild` that exists to reach everything.
 *
 * 25 pages is 5,000 candidates a probe, against the 777 measured. It is still
 * a bound rather than "all of them", for `ANCHOR_PROBE_LIMIT`'s own stated
 * reason — this runs on a command a person types — and `capped` still says
 * when it binds, which now means what it says instead of meaning "your archive
 * has more than 200 tables in it".
 */
export const ANCHOR_PROBE_PAGES = 25;

/**
 * **Every candidate a probe has, in pages** — the door past a ranking.
 *
 * `searchArchive` answers "the best `limit` matches"; this answers "the
 * matches", and the difference is the whole of the 2026-09-15 defect. The
 * order is a total one (score, session, record), so a page boundary is stable
 * and a span is returned once.
 *
 * `capped` is the honest half: it is true when the last page this was allowed
 * to walk came back FULL, which means there are more behind it and this run
 * did not see them. A run that exhausted its matches ends on a short page and
 * reports false.
 */
function probeCandidates(
  index: ConversationIndex,
  probe: string,
  scope: SearchScope,
): { hits: ProseHit[]; capped: boolean } {
  const hits: ProseHit[] = [];
  for (let page = 0; page < ANCHOR_PROBE_PAGES; page += 1) {
    const answer = searchArchive(index, probe, {
      ...scope, limit: ANCHOR_PROBE_LIMIT, offset: page * ANCHOR_PROBE_LIMIT,
    });
    for (const hit of answer.hits) hits.push(hit);
    if (answer.hits.length < ANCHOR_PROBE_LIMIT) return { hits, capped: false };
  }
  return { hits, capped: true };
}

/**
 * **HOW MANY OF EACH KIND A PLAN SHOWS, AND WHY IT IS A SAMPLE AND NOT A
 * LIST.**
 *
 * A first run over somebody's whole history is a bulk act, and what makes it
 * refusable is not the total — a reader cannot judge `1,213` — but seeing what
 * one of them looks like. Measured 2026-09-16 on a foreign archive (see
 * `markAutomaticAnchors`' header): three labels of each kind is enough to tell
 * a table mark from a lane report at a glance, and the whole disclosure still
 * fits in the terminal a person typed the command into.
 *
 * **They are the FIRST of each kind the run met, in the order it met them, and
 * that is said rather than dressed up as a draw.** The pass streams its
 * candidates; keeping an even sample would mean holding every label of a run
 * that finds thousands, which is memory spent to make three lines look more
 * representative than they are. A reader judging three is judging the GRAMMAR,
 * which is the question a first run actually asks.
 */
export const PLAN_SAMPLES_PER_KIND = 3;

/** One label a plan shows, so a reader can judge the kind by an example. */
export interface AutoAnchorSample {
  kind: AutomaticAnchorKind;
  label: string;
}

export interface AutoAnchorReport {
  /** Candidate turns the probes brought back, before the grammar saw them. */
  probed: number;
  /** Turns the grammar recognised. */
  found: number;
  /** Anchors written — `found` minus the ones already standing at that point. */
  marked: number;
  /**
   * Anchors the pass had written before and TOOK BACK. Never one of his.
   *
   * Two causes, counted together because they are one fact to a reader — *a
   * bookmark this pass wrote is gone*: the grammar it runs today does not
   * recognise what is at that byte, or the row was a lane's `report` and the
   * lane has since said something later, so the report moved and the old mark
   * is no longer on it.
   */
  dropped: number;
  /** Anchors the pass had written before whose label or kind it re-derived. */
  relabelled: number;
  /** At least one probe filled its bound, so there may be more behind it. */
  capped: boolean;
  ms: number;
  /**
   * **`marked`, SPLIT BY KIND — the disclosure a bulk run is refusable on.**
   *
   * `marked` alone says *1,213 bookmarks are about to appear in your list*,
   * which is a number a reader can only accept or abandon. Per kind it becomes
   * a judgement they can make: *907 of those are tables Claude drew, 275 are
   * lane reports, 31 are things I said* — and each of the three is a different
   * decision, because the three grammars are independent and any one of them
   * could be the one that does not suit this project.
   *
   * It counts NEW marks only, so `table + ruling + report === marked` and a
   * relabel of a bookmark that already stands is not counted as something
   * about to appear. Nothing here is a second measurement: the increment sits
   * beside `marked`'s own.
   */
  byKind: Record<AutomaticAnchorKind, number>;
  /**
   * The first `PLAN_SAMPLES_PER_KIND` labels of each kind this run newly
   * marked — what a reader looks at to decide whether the rest are worth
   * having. Empty when the run marked nothing new.
   */
  samples: AutoAnchorSample[];
  /**
   * **NOTHING WAS WRITTEN.** True for a plan — the pass ran its whole
   * enumeration and its whole grammar and made no change at all, so every
   * count beside this one says what WOULD happen rather than what did.
   *
   * It is a field of the report rather than a second report type for
   * `nothing-to-do-and-could-not-look-are-different-answers`' reason one
   * step along: a caller holding an `AutoAnchorReport` must not be able to
   * read `marked: 1213` without also being able to see that nothing is marked.
   */
  planned: boolean;
}

/**
 * The transcript one hit lives in, or `null` when the archive lost the row.
 *
 * Exported because `mycontext conversation anchor` asks the same question
 * before it marks a point by hand, and `src/ui/anchor-write.ts` asks it for
 * the same reason one surface along. A second spelling of "which file is this
 * id's transcript" is two places to disagree about a pruned session.
 */
export function fileOf(
  index: ConversationIndex, sessionId: string, agentId: string | null,
): string | null {
  if (agentId === null) return index.get(sessionId)?.file ?? null;
  return index.getSubagent(agentId)?.file ?? null;
}

/**
 * The words at one byte offset of one transcript AND THE RECORD THEY CAME FROM
 * — or `null` when nothing readable starts there.
 *
 * One seek and one line, exactly as `resolveAnchor` reads: the generator's
 * `finally` closes the descriptor when the loop breaks, so this costs the
 * record and not the file.
 *
 * ── IT USED TO RETURN `classifyTurn`'S ANSWER, AND THAT WAS THE DEFECT ────
 *
 * This handed the grammar `kind: 'prompt' | 'answer' | 'machinery'` and nothing
 * else, so a guard that meant *the owner gave this* could only ask a question
 * that means *this record is filed under the user's side of the exchange* —
 * which a lane dispatch and a `<task-notification>` both are. 377 of his 1,164
 * marks came out of that one narrowing; `ownerTyped`'s header carries the
 * count. The record is returned whole, and the grammar asks it the question it
 * actually has.
 *
 * `classifyTurn` is NOT called here any more and is not called elsewhere in
 * this module. It is still the prose walk's own filter one layer down, which is
 * where it belongs: it decides what carries WORDS, not who wrote them.
 */
function turnAt(
  file: string, byteOffset: number,
): { record: Record<string, unknown>; text: string } | null {
  for (const record of iterateTranscript(file, { startByte: byteOffset })) {
    if (record.record === null) return null;
    const text = proseOf(record.record);
    if (text === '') return null;
    return { record: record.record, text };
  }
  return null;
}

/**
 * **The pass reads back what it wrote, and takes back what it no longer
 * recognises.** A WRITE, and the only one in this command that DELETES.
 *
 * ── WHY A PASS THAT ONLY ADDS IS NOT ENOUGH ────────────────────────────────
 *
 * Marking is idempotent by construction, which made it safe to run every
 * rebuild and made it incapable of carrying out a trim: when the owner
 * withdrew the report grammar on 2026-09-11 its 101 anchors would have stood
 * in his index for ever, and the 25 table anchors labelled `|` would have kept
 * that label, because `ANCHOR_PROBE_LIMIT` stops at 200 candidates a probe and
 * his archive holds 297 tables. So the pass owns its own anchors: each is read
 * back AT ITS OWN BYTE — which no probe bound can hide — and put to the
 * grammar as it stands today.
 *
 * ── AND IT NEVER TOUCHES ONE HE MADE ───────────────────────────────────────
 *
 * `origin` is the whole distinction between the two halves of §7, and here it
 * is load-bearing rather than descriptive: an automatic pass that deleted a
 * hand-made bookmark would be a far worse defect than any it could fix. An
 * anchor whose row says `origin: 'owner'` is not read, not re-labelled and not
 * dropped, whatever the grammar would say about the turn under it.
 *
 * ── SILENCE IS NOT EVIDENCE ────────────────────────────────────────────────
 *
 * A transcript the harness pruned, or an offset that reads as nothing, leaves
 * its anchor exactly where it is. Those are the two states `resolveAnchor`
 * already keeps distinct, and neither is the grammar saying no — deleting on
 * them would turn a missing file into lost bookmarks.
 */
function sweepAutomaticAnchors(
  index: ConversationIndex,
  files: Map<string, string | null>,
  keep: Set<string>,
  report: AutoAnchorReport,
  only: Map<string, number> | null,
  lastAnswers: ReadonlyMap<string, LaneLastAnswer>,
  write: boolean,
): void {
  for (const row of index.anchorRows(null)) {
    if (row.origin !== 'automatic') continue;
    if (keep.has(row.id)) continue;
    // **A `report` ROW WHOSE LANE THIS RUN DID NOT LOOK AT IS NOT READ BACK.**
    // Its kind rests entirely on `lastAnswers`, and over a lane out of scope
    // that map is EMPTY rather than false — so putting the row to the grammar
    // here would ask "is this the last answer of a lane I did not look up?",
    // get `null`, and delete a correct bookmark.
    // `nothing-to-do-and-could-not-look-are-different-answers` is the rule and
    // this is the shape of it: the pass could not look, so it says nothing.
    if (row.kind === 'report' && row.agentId !== null && !lastAnswers.has(row.agentId)) continue;

    const key = row.agentId ?? row.sessionId;
    // **A ROW IN A TRANSCRIPT THAT DID NOT MOVE CANNOT HAVE CHANGED.** The
    // sweep's whole job is to read an anchor back AT ITS OWN BYTE and put it
    // to today's grammar; over bytes nobody appended to since the last run,
    // the answer is the answer it already gave. `only` is what a per-turn
    // caller passes — `markAnchorsOnTurn` — and it is `null` for a full
    // `mycontext conversation rebuild`, where re-reading everything is the
    // point, because THAT is the run a changed grammar is trimmed by.
    if (only !== null) {
      const from = only.get(key);
      // Not a transcript that moved at all, or a row standing in bytes that
      // were already indexed before this run. Both are the same argument:
      // over bytes nobody appended to, the grammar's answer is the answer it
      // already gave.
      if (from === undefined || row.byteOffset < from) continue;
    }
    if (!files.has(key)) files.set(key, fileOf(index, row.sessionId, row.agentId));
    const file = files.get(key) ?? null;
    if (file === null) continue;

    const turn = turnAt(file, row.byteOffset);
    if (turn === null) continue;

    const finding = anchorInTurn({
      record: turn.record,
      laneReport: laneReportAt(index, lastAnswers, row.agentId, row.byteOffset, turn.text),
    }, turn.text);
    if (finding === null) {
      // **A PLAN COUNTS THE TAKE-BACK AND DOES NOT PERFORM IT.** The count is
      // the half a reader needs — a run that would remove bookmarks is a
      // different proposition from one that only adds — and `write` is the
      // only line between the two.
      if (write) unmarkAnchor(index, row.id);
      report.dropped += 1;
      continue;
    }
    if (finding.kind === row.kind && finding.label === row.label) continue;
    if (!write) {
      report.relabelled += 1;
      continue;
    }
    // The timestamp is the anchor's own and is carried over: re-deriving a
    // label is not a new bookmark, and moving the stamp would reorder his list
    // every time a grammar changed.
    //
    // **And so is the note**, added 2026-09-15 with the column. An automatic
    // row has none today and the sweep never reaches an `origin: 'owner'` row
    // at all — so this line is defensive rather than load-bearing, and it is
    // here because `markAnchor` writes the WHOLE row: an omitted field is not
    // "unchanged", it is `null`, and that is how a relabel silently erases
    // something. Carrying it costs a word and closes the shape.
    markAnchor(index, {
      sessionId: row.sessionId,
      agentId: row.agentId,
      byteOffset: row.byteOffset,
      label: finding.label,
      kind: finding.kind,
      origin: 'automatic',
      at: row.at,
      note: row.note,
    });
    report.relabelled += 1;
  }
}

/**
 * **Mark what is an anchor by nature, without being asked.** A WRITE.
 *
 * Idempotent by construction rather than by remembering: `anchorIdFor` derives
 * the id from the POSITION, so a point already marked is the same row again.
 * That is what makes this safe to run on every rebuild, which is what the
 * owner's ruling asks for — and it is why `markAnchor` is called even for an
 * anchor that already stands, rather than this pass keeping its own notion of
 * what it did last time. A second notion is a second thing to be wrong.
 *
 * **It never overwrites one HE made.** An anchor whose row says `origin:
 * 'owner'` is left exactly as it is, label and all: the automatic half is
 * allowed to add bookmarks and is not allowed to rewrite his.
 *
 * ── `plan: true` — THE SAME RUN, WITH THE TWO WRITES TAKEN OUT ─────────────
 *
 * Added 2026-09-16 under `TASK-a-user-who-installs-mycontext-mid-project-has-
 * conversations`, and it is an option on THIS function rather than a second
 * function beside it for the reason `consider` is a closure: a plan that
 * enumerated its candidates differently from the run would be a plan about a
 * different pass, and the number it showed a reader would be a number the run
 * never produced. Same probes, same `ownerPromptSpans`, same `laneLastAnswers`,
 * same grammar, same owner-row guard. `markAnchor`, `unmarkAnchor` and the
 * anchors DOCUMENT write are what `plan` removes, and nothing else.
 *
 * `anchorTransaction` is not entered at all on that path, deliberately: it
 * rewrites `.anchors.jsonl` whole at its close even when the body changed
 * nothing, so a plan wrapped in one would touch the one file this project
 * treats as the truth. A plan writes nothing, including nothing that looks
 * like nothing.
 *
 * ── WHY A PLAN EXISTS AT ALL, MEASURED ON SOMEBODY ELSE'S ARCHIVE ─────────
 *
 * The case is a person who installs this plugin into a repository that has
 * months of Claude Code sessions already sitting in `~/.claude/projects/`. The
 * archive indexes those immediately and the pass then marks all of them in one
 * act. Measured 2026-09-16 on a DIFFERENT project's real transcripts on this
 * machine — one session, 575 lanes, 13,375 prose spans, 726 of them turns the
 * person typed — with the grammar exactly as it stands:
 *
 * | kind | marks | per 1,000 turns | share |
 * |---|---|---|---|
 * | table | 907 | 67.8 | 74.8% |
 * | report | 275 | 20.6 | 22.7% |
 * | ruling | 31 | 2.3 | 2.6% |
 * | **all three** | **1,213** | **90.7** | |
 *
 * **1,213 bookmarks in one command, and `anchors/9` measured that 1,155 over
 * thirteen days was already enough to make the rare kinds hard to find.** The
 * grammar is not what is wrong there — every one of the three transfers, and
 * `anchorInTurn`'s own headers carry why — what is wrong is a first sight of
 * the feature that is a list nobody asked for. So the run is disclosed before
 * it happens, per kind, and `byKind` is what that disclosure is made of.
 */
export function markAutomaticAnchors(
  index: ConversationIndex, options: { only?: Map<string, number>; plan?: boolean } = {},
): AutoAnchorReport {
  /**
   * **WHERE this run is allowed to look: each transcript it may read, and the
   * byte in it from which anything is new** — `null` for all of everything,
   * which is what a rebuild passes. Added 2026-09-12 with the per-turn door.
   *
   * Measured on this workspace, on the day: the full pass costs 746-1457 ms of
   * seeks even when it changes nothing (2997 ms against a cold page cache),
   * because it re-reads 580 probe candidates and 623 of its own rows at their
   * bytes. That is right for a rebuild and wrong for something that runs after
   * every assistant turn.
   *
   * **The byte matters as much as the transcript, and that was a measurement
   * rather than a refinement.** Narrowing to the transcripts that MOVED still
   * cost 935 ms on the busiest turn, because one of them is always the session
   * being typed into and it holds most of the archive's tables and rulings:
   * 316 candidates came back from the probes every turn and were re-read and
   * re-marked idempotently, every one of them an answer already given. With
   * the byte floor the same turn puts 2-6 candidates to the grammar.
   *
   * The narrowing is not a shortcut in either dimension: a grammar's answer
   * over bytes that did not move cannot have changed. The one thing it cannot
   * catch is a CHANGED GRAMMAR, which is a code change rather than a turn, and
   * which the unscoped rebuild is exactly the run for.
   */
  const only = options.only ?? null;
  /** False for a plan, and the only thing a plan changes. */
  const write = options.plan !== true;
  const startedMs = Date.now();
  const report: AutoAnchorReport = {
    probed: 0, found: 0, marked: 0, dropped: 0, relabelled: 0, capped: false, ms: 0,
    byKind: { table: 0, ruling: 0, report: 0 },
    samples: [],
    planned: !write,
  };
  // The WHOLE row and not just its origin: `relabelled` is a count of anchors
  // whose label actually moved, and the probe pass re-marks every candidate it
  // recognises — so a counter that only watched the sweep would report 56 of a
  // run that changed 345 labels, which reads as a total and is not one.
  const mine = new Map(index.anchorRows(null).map((row) => [row.id, row]));
  const seen = new Set<string>();
  const kept = new Set<string>();
  const files = new Map<string, string | null>();

  // `anchorTransaction` and not `index.transaction`: this pass writes hundreds
  // of anchors in one go — 345 relabelled in the last run — and the anchors
  // DOCUMENT is the truth the table is rebuilt from (`plan:recall seq:6`). One
  // transaction is one document write, at the end, and the reconciliation at
  // the start is what stops a pass that has been running for seconds from
  // erasing an anchor the owner marked at the terminal meanwhile.
  /**
   * **THE SCOPE GOES INTO THE QUERY, AND THIS IS THE LINE THE FEATURE DIED
   * ON** — `TASK-the-automatic-marking-stopped-and-said-nothing-because-a`,
   * 2026-09-15.
   *
   * ── WHAT IT USED TO DO, AND WHY EVERY LAYER STAYED GREEN ────────────────
   *
   * The probes asked for the best `ANCHOR_PROBE_LIMIT` matches IN THE WHOLE
   * ARCHIVE, and `only` was then applied to that answer in JavaScript. So a
   * per-turn run's question was really *"is this turn's new table among the
   * 200 best-ranked tables in 875 MB of transcript?"* — and `bm25()` has no
   * opinion whatsoever about recency.
   *
   * Measured on the owner's live workspace, 2026-09-15, and this is the whole
   * case:
   *
   * ```
   * probe    matching spans   returned   newest match inside the window?
   * |---              777        200     NO
   * RULE-             295        200     yes
   * every other       <200       all     yes
   * ```
   *
   * And end to end over the two hours the owner was looking at: **15 turns
   * whose text `anchorInTurn` marks as a table; 6 of them inside the top-200
   * window; exactly those 6 carried an anchor; the other 9 carried nothing.**
   * Fifteen out of fifteen — window membership predicted the mark with no
   * exceptions. The grammar was right, the display was right, the hook ran,
   * and the pass was simply never shown the turns.
   *
   * It is also why the failure looked INTERMITTENT rather than broken, which
   * is what made it so hard to name: whether a new table lands inside a
   * relevance window is arbitrary, so marking worked on some turns and was
   * dead for half an hour on others, and no run of it ever looked like a
   * defect.
   *
   * ── WHAT IT DOES NOW ────────────────────────────────────────────────────
   *
   * `only` becomes `windows` — `source_key = ? AND byte_offset >= ?` inside
   * the SQL — so the limit is applied to *the candidates in what was appended*
   * rather than to the archive. A turn appends a handful of spans, so the
   * bound stops binding at all on this path, and `capped` becomes a real
   * disclosure instead of a permanent state of the world.
   *
   * **One query per probe however many sources moved.** That is deliberate and
   * measured: the probe queries were costing 266-311 ms of the hook's budget
   * when there were eight of them, so a query per source per probe — eight
   * times a handful of moved transcripts — would have been seconds inside a
   * three-second hook. The `OR`-joined windows keep the count at ONE PER PROBE
   * however many sources moved, which is now two.
   *
   * ── AND THE REBUILD PAGES, because a ceiling is not a scope ─────────────
   *
   * With `only === null` there is no window to narrow by, and the truncation
   * is then a plain one: 577 of this archive's 777 table spans could not be
   * marked by ANY run, including `mycontext conversation rebuild`, which is
   * the run whose whole job is to reach everything. `probeCandidates` pages to
   * `ANCHOR_PROBE_PAGES` instead, which is bounded and is not 200.
   */
  const windows = only === null ? null
    : [...only].map(([sourceKey, fromByte]) => ({ sourceKey, fromByte }));

  /**
   * **WHERE EACH LANE IN SCOPE STOPPED TALKING** — the `report` kind's whole
   * candidate source, and the sweep's only way to ask whether a `report` row it
   * owns is still on the lane's last answer.
   *
   * ── THE SCOPE IS `only`'S OWN KEYS, AND A SESSION KEY COSTS NOTHING ──────
   *
   * `only` is keyed by `agentId ?? sessionId`, so its keys are a mix of lanes
   * and sessions. They are all handed over as they are: `agent_id IN (...)`
   * matches the lanes and cannot match a session id, so the mix needs no
   * sorting and no second question asked of the archive. A run with `only ===
   * null` — the unscoped rebuild — asks for every lane, which is what that run
   * is for.
   *
   * **AND A LANE OUT OF SCOPE IS INVISIBLE TO EVERY `report` DECISION BELOW**,
   * which is the property that keeps a per-turn run from re-deciding 442 lanes:
   * `laneReportAt` answers `null` for a lane not in this map, and both the
   * supersede loop and the sweep skip a row whose lane is not in it rather than
   * reading it back. That is the same argument the byte floor already makes for
   * the probes — a grammar's answer over bytes nobody appended to cannot have
   * changed — said for lanes nobody appended to.
   */
  const lastAnswers = index.laneLastAnswers(only === null ? null : [...only.keys()]);

  /**
   * **ONE CANDIDATE, WHATEVER FOUND IT** — a probe hit or a lane's last answer.
   *
   * It is a closure rather than two copies of the same twenty lines because the
   * two sources differ in exactly one thing, WHICH BYTES TO LOOK AT, and in
   * nothing else: both read the record at the byte, both put it to
   * `anchorInTurn`, both refuse an `origin: 'owner'` row, both count the same
   * three numbers. A second copy would be a second place for the owner-row
   * guard to be forgotten, and that guard is the one this pass may never get
   * wrong.
   */
  const consider = (
    sessionId: string, agentId: string | null, byteOffset: number, at: string | null,
  ): void => {
    const id = anchorIdFor(sessionId, agentId, byteOffset);
    if (seen.has(id)) return;
    seen.add(id);
    report.probed += 1;
    const standing = mine.get(id);
    if (standing?.origin === 'owner') return;

    const key = agentId ?? sessionId;
    if (!files.has(key)) files.set(key, fileOf(index, sessionId, agentId));
    const file = files.get(key) ?? null;
    if (file === null) return;

    const turn = turnAt(file, byteOffset);
    if (turn === null) return;

    const finding = anchorInTurn({
      record: turn.record,
      laneReport: laneReportAt(index, lastAnswers, agentId, byteOffset, turn.text),
    }, turn.text);
    if (finding === null) return;
    report.found += 1;
    if (standing === undefined) {
      report.marked += 1;
      // Beside `marked`'s own increment and never derived a second way: a
      // per-kind total that disagreed with the total it splits would be worse
      // than no split at all.
      report.byKind[finding.kind] += 1;
      if (report.byKind[finding.kind] <= PLAN_SAMPLES_PER_KIND) {
        report.samples.push({ kind: finding.kind, label: finding.label });
      }
    } else if (standing.kind !== finding.kind || standing.label !== finding.label) {
      report.relabelled += 1;
    }
    kept.add(id);
    if (!write) return;
    markAnchor(index, {
      sessionId,
      agentId,
      byteOffset,
      label: finding.label,
      kind: finding.kind,
      origin: 'automatic',
      at: at ?? new Date().toISOString(),
      // Carried for `sweepAutomaticAnchors`' stated reason: `markAnchor` writes
      // the whole row, so an omitted field is `null` and not "unchanged".
      // `undefined` for a point being marked for the first time, which
      // `markAnchor` reads as `null`.
      note: standing?.note ?? null,
    });
  };

  const walk = (): void => {
    for (const { probe, kind } of ANCHOR_PROBES) {
      const answer = probeCandidates(index, probe, {
        ...(kind === undefined ? {} : { kind }),
        ...(windows === null ? {} : { windows }),
      });
      if (answer.capped) report.capped = true;
      for (const hit of answer.hits) {
        consider(hit.sessionId, hit.agentId, hit.byteOffset, hit.at);
      }
    }

    /*
     * ── HIS OWN PROMPTS, WHICH ALSO REACH THE GRAMMAR WITHOUT A PROBE ────
     *
     * Every prompt span of a session's own transcript, unranked and unbounded.
     * The grammar then asks each record whether he typed it — 960 candidates
     * over the whole archive, and nought to two on an ordinary turn.
     *
     * **It is offered to the grammar rather than filtered here**, which is the
     * probe discipline one function up said in as many words: *the probe
     * decides what is READ; the grammar decides what is MARKED.* A `WHERE`
     * clause that pre-judged `ownerTyped` would be a second expression of it,
     * in SQL, out of reach of every test that holds the first.
     */
    for (const span of index.ownerPromptSpans(windows)) {
      consider(span.sessionId, null, span.byteOffset, span.at);
    }

    /*
     * ── THE LANE REPORT, AND IT REACHES THE GRAMMAR WITHOUT A PROBE ────────
     *
     * Every other candidate in this pass arrives through `searchArchive`,
     * because every other grammar is a shape in the TEXT and a probe is the
     * cheapest way to find text. The report is not a shape in the text — it is
     * a position — so there is no substring to look for and
     * `ConversationIndex.laneLastAnswers` answers it directly. That is the
     * whole of its cost: ONE query, no ninth probe, measured at 16-18 ms
     * median over 10,910 spans, inside a whole per-turn pass measured below at
     * 77-85 ms.
     *
     * `capped` is untouched here and that is deliberate: this source has no
     * bound to fill. A `MAX ... GROUP BY` returns every lane or none.
     */
    for (const [agentId, last] of lastAnswers) {
      const lane = index.getSubagent(agentId);
      // A lane the archive no longer holds a row for. Its prose is still
      // indexed, and it has no session to key an anchor by and no name to wear
      // — which `laneReportAt` would also refuse one line later. Skipped in
      // silence for `sweepAutomaticAnchors`' stated reason: a pruned row is not
      // the grammar saying no.
      if (lane === null) continue;
      consider(lane.sessionId, agentId, last.byteOffset, last.at);
    }

    /*
     * ── EXACTLY ONE `report` MARK PER LANE, AND THE PASS ITSELF KEEPS IT ───
     *
     * **This is the churn the item warns about, paid here instead of being
     * left to a later rebuild.** A lane that is still talking moves its own
     * last answer, so the mark this pass wrote on Monday's answer is on the
     * wrong turn by Tuesday. The sweep below cannot be the answer to that: on
     * the per-turn path it deliberately skips every row standing BEHIND the
     * byte a transcript was read from, so the superseded mark — which is always
     * behind the new one — would never be read again and the lane would carry
     * two reports until somebody typed `mycontext conversation rebuild`.
     *
     * So it is taken back HERE, by the source that superseded it, inside the
     * same transaction. The scope is `lastAnswers`' own: a lane this run did
     * not look at yields `undefined` and is left entirely alone, which is the
     * same restraint the sweep keeps one function down.
     */
    for (const row of mine.values()) {
      if (row.origin !== 'automatic' || row.kind !== 'report') continue;
      if (row.agentId === null) continue;
      if (kept.has(row.id)) continue;
      const last = lastAnswers.get(row.agentId);
      if (last === undefined || last.byteOffset === row.byteOffset) continue;
      if (write) unmarkAnchor(index, row.id);
      report.dropped += 1;
    }

    // And the other direction, over what the pass already owns. `kept` is the
    // ids it just re-derived, which are the only ones it need not read again.
    sweepAutomaticAnchors(index, files, kept, report, only, lastAnswers, write);
  };

  // **A PLAN IS NOT WRAPPED, AND THAT IS THE WHOLE OF ITS GUARANTEE.**
  // `anchorTransaction` rewrites the anchors document at its close whatever the
  // body did, so entering one for a plan would touch `.anchors.jsonl` — the
  // file this project rebuilds the table FROM. A plan leaves both untouched.
  if (write) anchorTransaction(index, walk);
  else walk();

  report.ms = Date.now() - startedMs;
  return report;
}

/**
 * **WHAT THE PASS WOULD DO, WITHOUT DOING ANY OF IT.**
 *
 * The same run as `markAutomaticAnchors` with `markAnchor`, `unmarkAnchor` and
 * the anchors document write removed — see that function's `plan: true` note,
 * which is where the argument for one implementation lives.
 *
 * It is exported under its own name rather than left as an option because the
 * two surfaces that ask for it — `mycontext conversation rebuild` and the
 * viewer's sweep — are asking a question, not passing a switch, and a named
 * question is one a reader of either call site can see the shape of.
 *
 * **THE ONE PLACE A PLAN CAN OVERSTATE, SAID RATHER THAN PAPERED OVER.** The
 * run reconciles the anchors document into the table before it decides what is
 * already marked (`anchorTransaction`); the plan does not, because that
 * reconciliation CAN WRITE — it adopts the table into the file when the file is
 * absent — and a plan writes nothing. So over an index that has fallen behind
 * its document, a plan counts rows the run would find already standing, and
 * reports more than the run then marks. The run's number is the one the report
 * carries afterwards, and `mycontext conversation rebuild` reconciles on the
 * line above either way, which is the path this actually runs on.
 */
export function previewAutomaticAnchors(index: ConversationIndex): AutoAnchorReport {
  return markAutomaticAnchors(index, { plan: true });
}

/**
 * **HOW MANY BOOKMARKS THE PASS ALREADY OWNS — the first-run question, asked
 * of the archive rather than remembered.**
 *
 * Zero means no run of the automatic pass has ever left a mark in this
 * workspace, which is exactly the state a person is in the moment they install
 * this plugin into a repository that already has months of transcripts. That
 * is the one run whose size nobody has seen yet, and the one that is disclosed
 * before it happens.
 *
 * **It counts `origin: 'automatic'` and nothing else.** A workspace where the
 * owner has marked points by hand and the pass has never run is still a first
 * run for the pass, and asking "are there any anchors" would call it a later
 * one and mark 1,213 points without a word. The two origins are the whole
 * distinction this module is built on; it holds here too.
 *
 * A second run is NOT re-disclosed, and that is the point rather than an
 * omission: from then on the pass is incremental — `markAnchorsOnTurn` puts
 * two or three turns to the grammar — so every later run is small, and a
 * consent prompt on every rebuild would be a prompt nobody reads.
 */
export function automaticAnchorsStanding(index: ConversationIndex): number {
  let count = 0;
  for (const row of index.anchorRows(null)) if (row.origin === 'automatic') count += 1;
  return count;
}

/**
 * **How long the per-turn prose build may spend, and why the number is this
 * one.**
 *
 * The `Stop` hook's platform timeout is **3 seconds** (`hooks/hooks.json`),
 * and an overrun there is not a slow turn: the hook is killed with
 * `taskkill /T` and the audit row for that turn is lost. Measured on this
 * workspace, 2026-09-12, on the real corpus of 346 sources and 875 MB:
 *
 * ```
 * node start + stop.ts module graph      ~200 ms
 * stopUpkeep, restart path                ~1300 ms   (its own measurement)
 * stopConversationRefresh, before this     293 ms    (4 lanes read whole)
 * markAnchorsOnTurn, nothing moved           7 ms
 * markAnchorsOnTurn, 7 sources / 25.9 MB   647 ms    (prose 229, anchors 409)
 * ```
 *
 * That worst realistic turn lands near 2.5 s of the 3 s, and the number that
 * can run away is the prose build's: it is proportional to bytes nobody has
 * indexed yet, which is a few kilobytes on an ordinary turn and 875 MB on the
 * first turn in a workspace scanned before the prose index existed. 400 ms is
 * ~45 MB at this machine's measured 113 MB/s — comfortably more than the
 * 25.9 MB a three-lane turn moved here — and it is a CEILING rather than a
 * cost: an ordinary turn spends 3-6 ms and never comes near it.
 *
 * The anchor half beside it takes no clock of its own. What bounds it is the
 * scope: candidates and owned rows BEHIND the byte each transcript was read
 * from are skipped, so an ordinary turn puts two or three turns to the grammar
 * rather than the 316 that came back from the probes when the scope was the
 * whole transcript. Measured 2026-09-12, same corpus, same minute: 935 ms
 * scoped by transcript, 266-311 ms scoped by byte — of which nearly all was the
 * EIGHT probe queries themselves.
 *
 * **RE-MEASURED 2026-09-15, AND IT WENT DOWN RATHER THAN UP.** The grammar
 * change of that day deleted six of those eight probes — the normative-id
 * prefixes — and replaced them with two unranked `WHERE` queries
 * (`ownerPromptSpans` at 19.3 ms, `laneLastAnswers` at 18.1 ms). Measured on a
 * COPY of the owner's archive, median of seven runs of `markAutomaticAnchors`
 * in the per-turn shape:
 *
 * ```
 * sources moved   before (8 probes)   after (2 probes + 2 queries)
 * 1                                          77 ms
 * 4               266-311 ms                 85 ms
 * unscoped rebuild                        1,280 ms
 * ```
 *
 * So the two new kinds cost the per-turn path NOTHING and gave back about
 * three-quarters of what the old detector was spending. That is the number the
 * item asked for, and it is the opposite sign from the one it expected.
 */
export const TURN_PROSE_BUDGET_MS = 250;

/**
 * **The largest read one transcript may cost a single turn.**
 *
 * `TURN_PROSE_BUDGET_MS` is checked BETWEEN sources — it has to be, because a
 * walk cut off part-way writes a `prose_sources.bytes` that is not where the
 * archive's scan reached, which is the skew that cost 103.3 MB a run until
 * 2026-09-11 and never healed by itself. So without a second bound one
 * transcript could start at the last millisecond of the budget and overrun it
 * by its own whole size: the largest in this workspace is 106 MB, about a
 * second at the 95 MB/s measured here.
 *
 * 16 MiB is ~170 ms at that rate, and it is larger than any delta a turn has
 * actually produced here — the busiest measured, three lanes and the session
 * together, moved 31.2 MB across ELEVEN sources, of which the largest single
 * one was 14.9 MB. What it refuses is the first sight of a transcript already
 * tens of megabytes long, which is a rebuild's work and not a turn's.
 */
export const TURN_PROSE_SOURCE_BYTES = 16 * 1024 * 1024;

/**
 * **THE PER-TURN DOOR — CREATION PATH 1, AND IT IS WIRED.**
 *
 * The owner's design, 2026-09-12: *"1 ongoing appended payload to the
 * conversation would have anchores created on the fly"*. A transcript that is
 * being appended to should get its anchors as it goes, rather than waiting for
 * somebody to type `mycontext conversation rebuild`.
 *
 * The caller is `stopConversationRefresh` in `src/hooks/stop.ts`, inside its
 * existing `try` and beside `reconcileAnchors` — after `rebuildConversations`,
 * because the index is only level with the transcript at that point and this
 * pass reads the index. It was built here on 2026-09-12 and left uncalled for
 * one day, while another lane held `src/hooks/stop.ts`
 * (`TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests`), and
 * the owner ruled the landing SCOPED when that lane reported: *"Yes,
 * scoped"* — you pay only on turns where a transcript actually changed.
 *
 * ── AND THE COST OBJECTION IS DEAD, said once so it is not re-quoted ──────
 *
 * `plan:recall seq:1` kept the prose index off the Stop hook because it cost
 * 1.8-2.1 s and 95.7 MB EVERY run. Both causes were repaired on 2026-09-11:
 * the index resume clamp took it to 3-6 ms and 0 bytes, and the archive scan's
 * own skew went from 96.7 MB / 421 ms to 571 B / 7.5 ms. The filing lane said
 * in as many words that if the steady state became single-digit milliseconds
 * the reason for that decision was gone. It has.
 *
 * `test/core/anchor-per-turn.test.ts` measures THIS function's own steady
 * state on an unchanged archive rather than inheriting that claim.
 *
 * ── IT SWALLOWS ITS OWN FAILURE, WHICH IS THE HOOK'S RULE AND NOT A HABIT ─
 *
 * `null` on anything thrown, exactly as `advanceMirrors` and `reconcileAnchors`
 * are composed there: a pass that failed has left the index one turn behind and
 * the next turn fixes it, and a hook that threw would cost the turn its whole
 * refresh report. What it may never do is fail SILENTLY in the other
 * direction — a `null` return is a fact the caller reports, which is what
 * `refreshNote` already does for the two beside it.
 */
export interface TurnAnchorReport {
  /** What the incremental prose build read — the half the grammar needs. */
  search: SearchBuildReport;
  /**
   * What the grammar then marked, relabelled and took back — or `null` when
   * no transcript moved and the pass was not run at all.
   *
   * The two are kept apart because they are two different facts and a caller
   * reporting "0 marked" for a pass that never ran would be saying something
   * it does not know. `INV-nothing-is-dropped-silently` in the direction that
   * matters for a hook: what was skipped is skipped on the record.
   */
  anchors: AutoAnchorReport | null;
  /**
   * **WHY the line above is what it is, and the whole reason this field
   * exists is that `null` was answering two different questions.**
   *
   * `nothing-to-do-and-could-not-look-are-different-answers`, written from
   * the incident this closes, states the rule as a table:
   *
   * | the step means | what it must return |
   * |---|---|
   * | I looked at the thing, and there was no work | a measured zero |
   * | I could not look | **a different value, and the reason** |
   *
   * So:
   *
   *  - `'marked'` — the pass ran. `anchors` is its report, zeroes included,
   *    and a zero here is a MEASURED one: the grammar was shown what arrived
   *    and recognised nothing in it.
   *  - `'nothing-moved'` — no transcript's words moved, and the archive's rows
   *    agree with the files on disk. This is the ordinary turn, and it is the
   *    only one of the three that is allowed to be silent.
   *  - `'could-not-look'` — the build read nothing AND at least one row is
   *    behind the file it names. The pass was never offered the turn. This is
   *    the value that did not exist on 2026-09-15, which is why half an hour
   *    of dead marking was indistinguishable from half an hour of quiet.
   *
   * It is derived from `search` and never from a second measurement, so it
   * cannot disagree with the report beside it.
   */
  did: 'marked' | 'nothing-moved' | 'could-not-look';
  /**
   * The rows that are behind their files, carried up from the build so a
   * caller can say *how far* behind rather than only *that* it is —
   * `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when` asks
   * the screen for the sentence "the archive is N bytes behind this document",
   * and N is here.
   */
  stale: StaleSource[];
}

export function markAnchorsOnTurn(
  dbPath: string,
  options: { busyTimeoutMs?: number; budgetMs?: number; maxSourceBytes?: number } = {},
): TurnAnchorReport | null {
  try {
    const index = options.busyTimeoutMs === undefined
      ? ConversationIndex.open(dbPath)
      : ConversationIndex.open(dbPath, options.busyTimeoutMs);
    try {
      // **THE WORDS FIRST, AND THIS IS THE HALF THAT WAS EASY TO MISS.**
      //
      // The pass finds its candidates through `searchArchive` — it uses the
      // PROSE INDEX as an index, because re-walking 875 MB of transcript to
      // re-derive what that index already read would cost the whole argument.
      // So a turn whose words are not in the prose index is invisible to the
      // grammar, however recently it was appended.
      //
      // `rebuildConversations` does not fill it. `mycontext conversation
      // rebuild` calls `buildSearchIndex` separately, which is why the pass
      // works there and why a first draft of this function marked NOTHING on a
      // transcript that had just grown — caught by
      // `test/core/anchor-per-turn.test.ts` and not by reading.
      //
      // It is the incremental build, never `full`: a transcript only appends,
      // so an unchanged source costs one comparison of `(bytes, mtimeMs)` and
      // a grown one costs the delta. That clamp is the 2026-09-11 repair the
      // expired cost objection turned on.
      //
      // **AND IT IS BOUNDED, because this one runs inside a 3-second hook.**
      // Everything the incremental build does is proportional to what moved,
      // which is the argument for the cadence and is NOT a ceiling: a
      // workspace scanned before the prose index existed has the whole archive
      // to read on the first turn that asks — 875 MB and 8.6 s here — and a
      // hook that overruns is killed rather than slow. `TURN_PROSE_BUDGET_MS`
      // argues the number; what the budget leaves unread is deferred to the
      // next turn and counted, never dropped.
      const search = buildSearchIndex(index, {
        budgetMs: options.budgetMs ?? TURN_PROSE_BUDGET_MS,
        maxSourceBytes: options.maxSourceBytes ?? TURN_PROSE_SOURCE_BYTES,
      });
      // **NOTHING MOVED, SO NOTHING IS READ.** This is what makes the door
      // affordable and it is a measurement rather than a guess: on this
      // workspace the full pass costs 746-1457 ms of seeks in its steady state
      // (580 probe candidates and 623 of its own rows, each read at its byte),
      // while the prose build over 346 unchanged sources costs 3-4 ms. A pass
      // that ran unscoped after every assistant turn would spend a second a
      // turn re-deciding bytes nobody touched.
      //
      // `null` is the honest answer for "there was nothing to do", and it is
      // distinct from the `null` this function returns on a FAILURE — that one
      // is the whole report, this one is a field of it.
      //
      // **AND IT IS NO LONGER THE ONLY THING SAID ABOUT THIS TURN.** `did`
      // beside it separates the two answers `null` used to cover: an archive
      // level with its files that read nothing had nothing to read, and an
      // archive BEHIND its files that read nothing could not look. The second
      // is the state that ran for over half an hour on 2026-09-15 while every
      // layer reported success.
      if (search.read.length === 0) {
        return {
          search,
          anchors: null,
          did: search.stale.length === 0 ? 'nothing-moved' : 'could-not-look',
          stale: search.stale,
        };
      }
      return {
        search,
        anchors: markAutomaticAnchors(index, {
          only: new Map(search.read.map((key, i) => [key, search.readFrom[i] ?? 0])),
        }),
        did: 'marked',
        stale: search.stale,
      };
    } finally {
      index.close();
    }
  } catch {
    return null;
  }
}
