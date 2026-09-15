---
id: TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic
type: task
title: take the lane report and the owner’s own words as automatic marks, and replace the ruling detector that only ever marked our own injection block
status: active
severity: soft
always: false
summary: Bookmark a helper agent’s report, find your rulings by the words you actually use, and stop bookmarking the tool’s own instructions as though you had written them.
summary_of: c30b7dd568dc0293
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
checksum: 91fd929e693992a1
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
