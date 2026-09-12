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
import { markAnchor, unmarkAnchor } from './anchors.ts';
import { anchorTransaction } from './anchor-file.ts';
import {
  buildSearchIndex, proseOf, searchArchive, type SearchBuildReport,
} from './conversation-search.ts';

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
  /** Which grammar matched. `'table'` or `'ruling'`. */
  kind: string;
  /**
   * The evidence — never a summary of the turn. A ruling's is the id,
   * verbatim; a table's is its first readable header cell, which is the one
   * place this stops being verbatim and says why (`tableLabel`).
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

/**
 * **What one table's anchor is CALLED.**
 *
 * The owner's ruling of 2026-09-11, on reading his own list: a table anchor
 * must be labelled with something a person can read — *the table's first
 * header cell*. It was the whole header row joined with `" | "` until then,
 * which is why 25 of his anchors were labelled literally `|` and five more
 * `|  |`: a header of empty cells joins to nothing but its own borders, and a
 * bookmark called `|` is one he cannot recognise in a list.
 *
 * "First" therefore means the first cell there is anything to read IN. An
 * empty corner cell over a row-label column is ordinary, and skipping it
 * yields the table's own header rather than a fallback.
 *
 * **When no cell has anything in it, the label SAYS so** rather than drawing
 * the border characters. It is a poor name and an honest one; the alternative
 * is the defect this fixes.
 */
function tableLabel(header: string[]): string {
  const named = header.find(isReadable);
  return named ?? `a table of ${header.length} columns`;
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
  for (let i = 1; i < lines.length; i += 1) {
    const delimiter = cellsOf(lines[i] ?? '');
    if (delimiter === null || !isDelimiter(delimiter)) continue;
    const header = cellsOf(lines[i - 1] ?? '');
    if (header === null || header.length !== delimiter.length || header.length < 2) continue;
    return tableLabel(header);
  }
  return null;
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
    markAnchor(index, {
      sessionId: row.sessionId,
      agentId: row.agentId,
      byteOffset: row.byteOffset,
      label: finding.label,
      kind: finding.kind,
      origin: 'automatic',
      at: row.at,
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
  anchorTransaction(index, () => {
    for (const { probe, kind } of ANCHOR_PROBES) {
      const answer = searchArchive(index, probe, {
        ...(kind === undefined ? {} : { kind }),
        limit: ANCHOR_PROBE_LIMIT,
      });
      if (answer.hits.length >= ANCHOR_PROBE_LIMIT) report.capped = true;
      for (const hit of answer.hits) {
        if (only !== null) {
          const from = only.get(hit.agentId ?? hit.sessionId);
          if (from === undefined || hit.byteOffset < from) continue;
        }
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
      if (search.read.length === 0) return { search, anchors: null };
      return {
        search,
        anchors: markAutomaticAnchors(index, {
          only: new Map(search.read.map((key, i) => [key, search.readFrom[i] ?? 0])),
        }),
      };
    } finally {
      index.close();
    }
  } catch {
    return null;
  }
}
