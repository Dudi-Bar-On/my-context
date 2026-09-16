---
id: TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic
type: task
title: take the lane report and the owner’s own words as automatic marks, and replace the ruling detector that only ever marked our own injection block
status: active
severity: soft
always: false
summary: Bookmarks labelled as your own rulings were mostly our own injected text; that is fixed and proved, and one choice about which label wins when a message is both is still yours.
summary_of: 93ec3c8fa024d9d4
summary_was:
  - 2026-09-16 Bookmark a helper agent’s report, find your rulings by the words you actually use, and stop bookmarking the tool’s own instructions as though you had written them.
scope:
  - src/core/anchor-pass.ts
  - src/core/conversation-index.ts
  - scripts/measure-anchor-candidates.ts
tags:
  - v2
  - recall
  - silent-failure
  - "plan:anchors"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 319bd3a5f732cefc
plan: anchors
seq: "12"
state: todo
priority: "1"
---

# take the lane report and the owner’s own words as automatic marks, and replace the ruling detector that only ever marked our own injection block

OWNER RULINGS 2026-09-15, all three given together after reading `anchors/11`’s measurements:
  1. TAKE THE LANE REPORT as a new automatic mark. — yes
  2. TAKE HIS OWN WORDS as the way a ruling is found. — yes
  3. THE BROKEN `ruling` GRAMMAR — REPLACE IT, do not delete it.

WHY REPLACE AND NOT DELETE, recorded because it is the decision that shapes the work: `ruling` is
the RIGHT NAME for the right thing. What is wrong is only how it is DETECTED. Deleting it would
leave him with no way to find a ruling he gave — which is the thing he most wants to find again.
Keep the kind; swap the detector.

WHAT IS BROKEN, measured by `anchors/11` over all 10,836 prose spans: the `ruling` grammar owns 377
of his 1,164 marks — 32% — AND MARKS ZERO TURNS HE TYPED. 296 are a lane’s first prose span, which
is THIS PLUGIN’S OWN SubagentStart INJECTION BLOCK; 28 are later lane turns; 53 are
task-notifications and compaction summaries. 55 carry the identical label
`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`. By his own 2026-09-11 standard
— "it marks a turn that MENTIONS a report, not a report" — all 377 mark a turn that MENTIONS a rule.

AND CORRECTING IT IN PLACE WOULD MARK NOTHING: in 519 turns he typed over 13 days he named a
normative id ZERO times. He does not speak in ids. The id cannot find him, which is why the
detector has to change rather than the guard around it.

── THE THREE CHANGES ───────────────────────────────────────────────────

A. THE LANE REPORT becomes an automatic mark. STRUCTURAL, not a grammar: a helper agent’s final
   answer, with the 400-character floor `anchors/11` measured (a lane’s last answer is 7,530 chars
   at the median; only 19 of 436 fall under it, and those are trailing acknowledgements). +189 new
   marks, 8/8 worth having on a random sample, NO PROBE AND NO PER-TURN COST because `subagents`
   already knows it. The label writes itself from `subagents.description`, which exists for 436 of
   436 — the lane’s own mission rather than a header cell.

   AND THE LANE DISPATCH IS REFUSED, deliberately: it is the injection block, which is the noise
   this item exists to remove. Report yes, dispatch no.

B. A RULING IS FOUND BY HIS WORDS. On turns HE TYPED, the strong list measured in `anchors/11`:
   `always`, `never`, `must`, `the rule`, `i approve`. +38 over 13 days — about 1 in 14 of his
   turns — with 26 of 38 clearly worth having and 34 of 38 counting corrections.

   THE MODAL LIST IS REFUSED AND THE MEASUREMENT IS WHY: `should` / `i want` / `need to` scores the
   SAME worth-having share as "he typed 250 characters with no keywords at all". Those are his
   ordinary register, not a ruling signal. Only the strong list separates. Do not widen it because
   it feels thin — thin and precise is the point.

C. THE OLD DETECTOR GOES. The kind `ruling` stays and keeps its glyph, its hue group (a judgement
   that was made) and its word.

── THE RISK THAT MUST BE DESIGNED AGAINST, NOT NOTED ─────────────────────────────

ALL OF (B) RESTS ON KNOWING A TURN IS HIS, AND THAT IS EXACTLY WHAT IS BROKEN TODAY.
`classifyTurn` calls a lane dispatch and a `task-notification` a "prompt", so `kind === ‘prompt’`
admits precisely what it was written to exclude. THAT IS THE MECHANICAL CAUSE OF THE 377.

So (B) must NOT rest on `kind === ‘prompt’` alone. `anchors/11`’s own `ownerTyped` used a list of
text shapes and IT LEAKED TWICE in a 38-row sample — a `/command` body and a skill preamble. A
growing list of strings rebuilds this defect in a new costume.

FIND A STRUCTURAL SIGNAL. The archive knows things a regex does not: `agent_id IS NULL` separates
the main session from a lane; the prose index knows whether a span is the FIRST of a source (which
is what 296 of the 377 are); `subagents` knows every dispatch by id. Prefer any of those to another
substring. If no structural signal is sufficient, say so plainly and report what the residue is —
do not paper it with a longer list.

── WHAT CLOSES THIS ─────────────────────────────────────────────────

  1. ON A COPY OF HIS ARCHIVE, a rebuild takes the 377 back and adds the new marks. The pass is
     idempotent and reads back every `origin: automatic` row at its byte, so a row that no longer
     qualifies is TAKEN BACK BY THE PASS ITSELF — nothing hand-edits `.anchors.jsonl`, and his
     `origin: owner` row is never read. Report the three counts the pass already prints: newly
     marked, relabelled, taken back.
  2. THE NET IS REPORTED AND IS EXPECTED TO BE NEGATIVE. `anchors/11` projects 1,164 -> ~1,010.
     FEWER MARKS IS THE POINT; a change that grows the total has misunderstood the task.
  3. A REMOVAL PROOF THAT THE INJECTION BLOCK IS NO LONGER MARKED — feed the pass a real lane
     dispatch carrying a normative id and assert nothing is written. That is the defect, and it is
     the one assertion that would have caught it years earlier.
  4. THE REAL RUN IS HIS. Do not rebuild his live archive; measure on a copy and tell him the
     command.

── THEY MUST REACH THE FILTER, THE MENU AND THE KEY — OWNER, 2026-09-15 ──────────────

He asked, before this was dispatched, whether the new kinds reach the jump navigation on the
right-click menu and the kind filter.

THE ANSWER LOOKS LIKE YES AND MUST BE PROVED RATHER THAN ASSUMED. Every one of those surfaces is
DERIVED rather than listed:
  — `fillKinds` builds the `<select>` from `kindsPresent()` — the kinds THIS DOCUMENT HOLDS;
  — the menu’s `menuitemradio` rows are built from `kindPick.options`, so they inherit it;
  — `K`/`Shift+K` cycle that same option list, which is why the ring is a ring and not a table of
    nine bindings;
  — `ANCHOR_KIND_HUE` already carries `report: kindfound` and `ruling: kindsettled`, so both new
    kinds arrive coloured;
  — `conv.anchors.kind.report` exists in BOTH string tables.

So the claim is that this costs nothing. THAT CLAIM IS EXACTLY THE KIND THIS PROJECT KEEPS FINDING
TO BE FALSE — every layer looked right while the feature was dead, twice this week. Prove it on a
document that actually holds a `report` mark:
  1. the kind appears in the filter’s options, with its own word;
  2. it appears as a `menuitemradio` row in the right-click menu, and the tick follows it;
  3. `K` cycles onto it and the count names it;
  4. it draws in its hue in the list AND in the document;
  5. stepping to it lands on the turn it marks.

IF ANY OF THE FIVE NEEDS CODE, THAT IS PART OF THIS ITEM and not a follow-up — a new mark kind that
cannot be filtered, reached or seen is a kind that exists only in the file.

── BOTH ARE MARKED ON THE FLY, AND ONE OF THEM NEEDS A TRIGGER ───────────────────

He asked, before dispatch, whether these are marked on the fly as tables and rulings are. They are,
and `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when` already binds them: a turn
the archive has read and that qualifies CARRIES ITS MARK.

HIS OWN WORDS: nothing changes. It is `anchorInTurn` on the Stop hook, the same per-turn path, with
the detector swapped. A ruling he types is marked on the turn he types it.

THE LANE REPORT CARRIES A REAL QUESTION AND THE LANE MUST SETTLE IT RATHER THAN GUESS.
"A lane’s FINAL answer" is not knowable while the lane is still running — mark the latest answer on
the fly and the next one makes that mark wrong. Three shapes, and the cost of each:

  1. MARK WHEN THE LANE ENDS. `subagents.ended_at` says so. A running lane is left alone and its
     report lands at the moment it finishes — still on the fly, triggered by the lane ending rather
     than by an answer appearing. RECOMMENDED unless measurement says otherwise.
  2. MARK THE LATEST ANSWER AND LET THE PASS CORRECT ITSELF. The pass is idempotent and reads back
     every `origin: automatic` row at its byte, so a superseded mark is taken back on the next run.
     Honest, and it CHURNS: a long lane would move its own mark repeatedly, and every move is a
     write to the file that is the truth.
  3. LEAVE IT TO THE UNSCOPED REBUILD. Correct, and it breaks the invariant above — a reader
     browsing a finished lane would see nothing until he ran a command.

WHICHEVER IS CHOSEN, `ended_at` IS NULL FOR A RUNNING LANE AND THAT IS A MEASURED ZERO, not a
missing value: a lane with no end time has not finished, and the screen must not draw it as a lane
with no report. `STD-a-measured-zero-is-drawn-and-named`.

AND THE COST GOES IN THE REPORT. The per-turn budget is `TURN_PROSE_BUDGET_MS` = 250 ms with eight
probes already costing 266-311 ms unwindowed. A structural check against `subagents` is not a probe
and should cost almost nothing — say what it actually cost, measured, the way `archiveFreshness`
reported 7 ms over 452 sources.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN c382b7a5 — every closing condition above is met; it stays open on ONE decision that is the owner's, and on the rebuild that is his to run

WHAT LANDED, all four closing conditions and the five reach-checks: the structural signal is `origin.kind === 'human'` on the record with `isSidechain` and `isMeta` both not true — not `classifyTurn`'s word, which is what admitted 296 injection blocks as rulings. Over 10,910 spans read at their bytes, 537 carry it and 524 survive all three. On a copy of his archive: 1,172 marks became 1,019, newly marked 225, taken back 378, and a second pass moved nothing at all, so it is idempotent on real data. The net is NEGATIVE, as required. Cost went DOWN: 266–311 ms became 85 ms at four sources moved, and neither new query is ranked or bounded, so neither can repeat the recency defect found the same morning.

THE ITEM'S RECOMMENDED TRIGGER WAS REFUSED WITH A MEASUREMENT, which settles option 1 above: `subagents.ended_at` is not "the lane finished" — it is the timestamp of the last record the scan read, and it is non-null for 442 of 442 lanes including ones still running. So the report is the lane's last answer as read, and the source that SUPERSEDES a report takes the old mark back in the same transaction.

WHY IT IS STILL OPEN, and it is not work: 230 of 419 lane reports are findable ONLY as tables, because the table grammar claims a turn that is both. Reversing the precedence is one line and moves 230 marks. That is the owner's call and it is filed as `OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one`, so `mycontext path` draws this subject as WAITING ON HIM rather than as open work to dispatch. The second thing owed to him is the rebuild of his live archive, which this lane deliberately did not run.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.
