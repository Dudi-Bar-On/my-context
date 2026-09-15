---
id: TASK-find-out-what-else-in-a-transcript-is-worth-marking
type: task
title: find out what else in a transcript is worth marking automatically, and prove each candidate on the real archive
status: active
severity: soft
always: false
summary: Only two things get bookmarked for you automatically — work out what else is worth it, measured on your own conversations.
summary_of: c7a06e7469c8bccc
scope:
  - src/core/anchor-pass.ts
  - src/core/conversation-index.ts
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 49d89820e6c1f1d9
plan: anchors
seq: "11"
state: todo
priority: "2"
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
