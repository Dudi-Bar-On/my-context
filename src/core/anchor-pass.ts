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
  ConversationIndex, anchorIdFor, classifyTurn, iterateTranscript,
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
 * The RULING grammar below is untouched. He judged those the useful ones.
 */

/**
 * A NORMATIVE corpus id — the categories that carry a ruling.
 *
 * `TASK-` and `REQ-` are deliberately absent. They are ids of work, not of
 * rulings, and this repository holds 728 of the former against 94 `DEC-`; a
 * prefix set widened to catch them would mark nearly every turn of a working
 * session, which is the point at which a list of bookmarks stops being one.
 */
const RULING_ID = /\b(?:DEC|RULE|INSTR|STD|CONST|INV)-[a-z0-9]+(?:-[a-z0-9]+){3,}\b/;

/**
 * **What, if anything, makes this turn an anchor by nature.**
 *
 * The order is the precedence, and first match wins: a turn that both holds a
 * table and names a report is marked as the table, because the table is the
 * thing in the turn rather than a thing the turn points at.
 *
 * `kind` is the turn's own — `classifyTurn`'s, already decided one layer down.
 * A ruling is restricted to `'prompt'` because a ruling is something the owner
 * GAVE; the same id in an answer is a citation, and citations are what this
 * project's assistants write in nearly every turn.
 */
export function anchorInTurn(kind: string, text: string): AutoAnchorFinding | null {
  const table = tableIn(text);
  if (table !== null) return { kind: 'table', label: table };
  if (kind === 'prompt') {
    const ruling = RULING_ID.exec(text);
    if (ruling !== null) return { kind: 'ruling', label: ruling[0] };
  }
  return null;
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
const ANCHOR_PROBES: { probe: string; kind?: 'prompt' | 'answer' }[] = [
  { probe: '|---' },
  { probe: '| ---' },
  { probe: 'DEC-', kind: 'prompt' },
  { probe: 'RULE-', kind: 'prompt' },
  { probe: 'INSTR-', kind: 'prompt' },
  { probe: 'STD-', kind: 'prompt' },
  { probe: 'CONST-', kind: 'prompt' },
  { probe: 'INV-', kind: 'prompt' },
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

export interface AutoAnchorReport {
  /** Candidate turns the probes brought back, before the grammar saw them. */
  probed: number;
  /** Turns the grammar recognised. */
  found: number;
  /** Anchors written — `found` minus the ones already standing at that point. */
  marked: number;
  /**
   * Anchors the pass had written before and TOOK BACK, because the grammar it
   * runs today does not recognise what is at that byte. Never one of his.
   */
  dropped: number;
  /** Anchors the pass had written before whose label or kind it re-derived. */
  relabelled: number;
  /** At least one probe filled its bound, so there may be more behind it. */
  capped: boolean;
  ms: number;
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
 * The words at one byte offset of one transcript, and how that turn was
 * classified — or `null` when nothing readable starts there.
 *
 * One seek and one line, exactly as `resolveAnchor` reads: the generator's
 * `finally` closes the descriptor when the loop breaks, so this costs the
 * record and not the file.
 *
 * The classification is `classifyTurn`'s, derived here from the record itself
 * rather than read off the prose index, because the sweep below reaches
 * anchors the prose index never offered as candidates. It is the SAME call the
 * prose walk makes (`conversation-search.ts`' `proseFrom`), so the two cannot
 * come to disagree about what a prompt is.
 */
function turnAt(file: string, byteOffset: number): { kind: string; text: string } | null {
  for (const record of iterateTranscript(file, { startByte: byteOffset })) {
    if (record.record === null) return null;
    const text = proseOf(record.record);
    if (text === '') return null;
    const message = record.record['message'];
    const content = typeof message === 'object' && message !== null
      ? (message as { content?: unknown }).content
      : undefined;
    return { kind: classifyTurn(record.record['type'], content), text };
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
): void {
  for (const row of index.anchorRows(null)) {
    if (row.origin !== 'automatic') continue;
    if (keep.has(row.id)) continue;

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

    const finding = anchorInTurn(turn.kind, turn.text);
    if (finding === null) {
      unmarkAnchor(index, row.id);
      report.dropped += 1;
      continue;
    }
    if (finding.kind === row.kind && finding.label === row.label) continue;
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
 */
export function markAutomaticAnchors(
  index: ConversationIndex, options: { only?: Map<string, number> } = {},
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
  const startedMs = Date.now();
  const report: AutoAnchorReport = {
    probed: 0, found: 0, marked: 0, dropped: 0, relabelled: 0, capped: false, ms: 0,
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
   * measured: the eight probe queries already cost 266-311 ms of the hook's
   * budget, so a query per source per probe — eight times a handful of moved
   * transcripts — would have been seconds inside a three-second hook. The
   * `OR`-joined windows keep the count at eight.
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

  anchorTransaction(index, () => {
    for (const { probe, kind } of ANCHOR_PROBES) {
      const answer = probeCandidates(index, probe, {
        ...(kind === undefined ? {} : { kind }),
        ...(windows === null ? {} : { windows }),
      });
      if (answer.capped) report.capped = true;
      for (const hit of answer.hits) {
        const id = anchorIdFor(hit.sessionId, hit.agentId, hit.byteOffset);
        if (seen.has(id)) continue;
        seen.add(id);
        report.probed += 1;
        const standing = mine.get(id);
        if (standing?.origin === 'owner') continue;

        const key = hit.agentId ?? hit.sessionId;
        if (!files.has(key)) files.set(key, fileOf(index, hit.sessionId, hit.agentId));
        const file = files.get(key) ?? null;
        if (file === null) continue;

        const turn = turnAt(file, hit.byteOffset);
        if (turn === null) continue;

        const finding = anchorInTurn(turn.kind, turn.text);
        if (finding === null) continue;
        report.found += 1;
        if (standing === undefined) report.marked += 1;
        else if (standing.kind !== finding.kind || standing.label !== finding.label) {
          report.relabelled += 1;
        }
        kept.add(id);
        markAnchor(index, {
          sessionId: hit.sessionId,
          agentId: hit.agentId,
          byteOffset: hit.byteOffset,
          label: finding.label,
          kind: finding.kind,
          origin: 'automatic',
          at: hit.at ?? new Date().toISOString(),
          // Carried for `sweepAutomaticAnchors`' stated reason: `markAnchor`
          // writes the whole row, so an omitted field is `null` and not
          // "unchanged". `undefined` for a point being marked for the first
          // time, which `markAnchor` reads as `null`.
          note: standing?.note ?? null,
        });
      }
    }

    // And the other direction, over what the pass already owns. `kept` is the
    // ids it just re-derived, which are the only ones it need not read again.
    sweepAutomaticAnchors(index, files, kept, report, only);
  });

  report.ms = Date.now() - startedMs;
  return report;
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
 * scoped by transcript, 266-311 ms scoped by byte — of which nearly all is the
 * eight probe queries themselves.
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
   * `STD-nothing-to-do-and-could-not-look-are-different-answers`, written from
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
