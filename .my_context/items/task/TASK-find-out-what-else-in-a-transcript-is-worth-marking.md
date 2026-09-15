---
id: TASK-find-out-what-else-in-a-transcript-is-worth-marking
type: task
title: find out what else in a transcript is worth marking automatically, and prove each candidate on the real archive
status: active
severity: soft
always: false
summary: "Measured: the rule-id grammar marks none of your own words and 296 of its 377 marks are the plugin's own injection block; the lane report and your always/never turns are what is worth adding."
summary_of: a9015c1c35a1673a
summary_was:
  - 2026-09-15 Only two things get bookmarked for you automatically — work out what else is worth it, measured on your own conversations.
scope:
  - src/core/anchor-pass.ts
  - src/core/conversation-index.ts
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:11"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 446a44fc705df086
plan: anchors
seq: "11"
state: done
priority: "2"
verified_on: 2026-09-15
---

# find out what else in a transcript is worth marking automatically, and prove each candidate on the real archive

OWNER REQUEST 2026-09-15: "also do some research and check if there are other good candidates for
auto anchores marking on the fly".

THIS IS A MEASUREMENT TASK AND ITS DELIVERABLE IS A RECOMMENDATION, NOT A GRAMMAR. Do not ship a
new probe because it seems useful. Every candidate is counted on HIS OWN ARCHIVE first, and the
count is what decides.

WHAT EXISTS TODAY: exactly two grammars, in `anchorInTurn`. A GFM TABLE, any turn — 779 of his
1,155 marks. A NORMATIVE ID IN A PROMPT (`RULE-`, `STD-`, `DEC-`…) — 373. Plus one mark he made by
hand. That is the whole of it.

AND THERE IS A REFUSAL ON RECORD THAT SHAPES THIS WHOLE TASK. A third grammar existed and HE KILLED
IT on 2026-09-11: a dated report path under `reports/` or `docs/superpowers/{specs,plans}/`. It
contributed 101 of 613 anchors and he ruled it marks "a turn that MENTIONS a report, not a report,
and those are not worth having". READ THAT RULING BEFORE PROPOSING ANYTHING — it is the standard
every candidate is judged against: a mark must be ON the thing, not on a turn that points at it.

CANDIDATES WORTH COUNTING, and the list is a starting point, not a specification:
  — a fenced code block of some size, or one naming a file path;
  — a turn where he RULED something — a decision in his own words rather than a normative id,
    which is the half the id grammar cannot see;
  — a measurement: a turn carrying numbers with units, a before/after pair;
  — a refusal or a correction — the turns where something was found to be wrong;
  — a lane dispatch or a lane report, which the `subagents` table already knows about structurally
    rather than by grammar;
  — a commit or a command he actually ran.

FOR EACH CANDIDATE, REPORT: how many turns it would mark across his real archive; what share of them
a reader would call worth having, judged on a SAMPLE HE COULD CHECK; how it overlaps what is already
marked (a candidate that mostly re-marks tables adds noise, not signal); and its cost on the
per-turn path, which has a 250 ms budget and eight probes already costing 266-311 ms.

THE FAILURE MODE TO AVOID IS VOLUME. 1,155 marks over 13 days is already a lot; a grammar that
doubles it without doubling the value makes the whole feature worse, and the rarer kinds harder to
find (see `anchors/9`). A candidate that marks 40% of all turns is disqualified by that alone.

NOTHING SHIPS FROM THIS TASK WITHOUT HIS RULING. The deliverable is the table of candidates with
their counts and a recommendation; he decides which, if any, become grammars.

MEASURED 2026-09-15 — `scripts/measure-anchor-candidates.ts`, read-only over the prose index

SCANNED: all 10,836 prose spans (12.87 MB) of the archive's 454 sources. A span's `text` is the
same string `turnAt` hands `anchorInTurn`, so this is not an approximation of re-reading the
transcripts. The shipped grammar over those spans: 782 table, 377 ruling.

THE FINDING THAT OUTRANKS EVERY CANDIDATE: **the `ruling` grammar marks ZERO turns the owner
typed.** 296 of its 377 marks are a lane's FIRST prose span — this plugin's own SubagentStart
injection block, which delivers every governing item and therefore every normative id. 28 more are
later lane turns, and 53 are `<task-notification>` blobs and compaction summaries in the main
session's prompt slot. Fifty-five carry the identical label
`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`. By the standard that killed the
report grammar on 2026-09-11 — *"it marks a turn that MENTIONS a report, not a report"* — all 377
mark a turn that MENTIONS a rule. The cause is that `classifyTurn` calls a lane dispatch and a
harness notification "prompt", so the `kind === 'prompt'` guard admits exactly what it was written
to exclude. NOT REPAIRED HERE: this task ships no grammar change.

AND THE OTHER HALF OF THE SAME MEASUREMENT: **in 519 turns he typed, he named a normative id ZERO
times.** Two near-misses exist and neither is him citing a rule — a `REF-` id copied out of a doctor
warning, and a pasted terminal line. He does not speak in ids; he rules in his own words. So a
`ruling` grammar corrected to fire only on HIS turns would mark nothing at all, and the id is not a
signal that can find him.

THE CANDIDATES, counted (marks / % of all 10,836 turns / already-marked / NEW / windowed probe ms):

| candidate | marks | %turns | ov | NEW | probe |
|---|---|---|---|---|---|
| a fenced block, any size | 486 | 4.5% | 242 | 244 | ``` — 5.7 ms |
| a fenced block, 5+ lines | 203 | 1.9% | 135 | 68 | ``` — 5.7 ms |
| a fenced block, 12+ lines | 64 | 0.6% | 50 | 14 | ``` — 5.7 ms |
| he typed it + always/never/must/the rule/i approve | 38 | 0.4% | 0 | 38 | 4 common words, 7-20 ms each |
| he typed it + should/i want/need to/do not | 143 | 1.3% | 0 | 143 | 4 common words |
| he typed it + 250 characters, NO keywords | 106 | 1.0% | 0 | 106 | none — full scan |
| he typed it + a correction | 18 | 0.2% | 0 | 18 | 3 common words |
| 3+ numbers with units | 490 | 4.5% | 340 | 150 | none — full scan |
| a git commit | 46 | 0.4% | 20 | 26 | `git commit` — 1.3 ms |
| a lane REPORT, structural, 400-char floor | 417 | 3.8% | 228 | 189 | NO probe, NO grammar |

WORTH-HAVING, hand-labelled on the whole set rather than a slice: the strong owner list is 26/38
clearly worth, 34/38 counting corrections, and 2 of its 4 misses are harness text a wider filter
removes. The modal list (`should`, `i want`) is ~40% worth — the same share as "he typed 250
characters" with no keywords at all, which is the measurement that kills it: those words are his
ordinary register, not a ruling signal. Fences and measurements overlap the table grammar 50-70%
and mark the turn that QUOTES a thing, which is the 2026-09-11 refusal again. The lane report is
8/8 on a random sample and its LABEL is already written — `subagents.description` carries the
lane's mission for 436 of 436.

RECOMMENDED, and it is HIS ruling to give: (1) fix the `ruling` grammar — it is 32% of his
bookmarks and none of it is his words; (2) take the lane report, structural, +189; (3) take the
owner's strong list, +38; (4) refuse the fence, the measurement, the commit, the modal list and the
lane dispatch. Net if all three land: 1,159 → 1,000 or so, with the largest single kind replaced by
one that is actually his.
