---
id: TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a
type: task
title: a table mark is labelled with one word from its header, and a mark never says which lane made it
status: active
severity: soft
always: false
summary: Half your bookmarks are named after a single column heading like "id", and none of them say which piece of work was running when it was made.
summary_of: 6a367913c6184fd1
scope:
  - src/core/anchor-pass.ts
  - src/core/anchors.ts
  - src/ui/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 8501f2485b506cbf
plan: anchors
seq: "1"
state: todo
priority: "1"
---

# a table mark is labelled with one word from its header, and a mark never says which lane made it

OWNER RULING 2026-09-15, option 1b plus the clarification he gave when asked: the label carries
the HEADER CELLS PLUS THE NEAREST HEADING ABOVE THE TABLE, and where a mark names a lane it
names THE WORK ITEM / LANE THAT WAS RUNNING.

HIS WORDS: "you write Marked lane, it would be nice to see which lane, which table, which
report etc for every mark you add."

MEASURED 2026-09-15 on his own corpus, 746 anchors:
  ruling  370  label is the full id, e.g. RULE-a-delegated-worker-runs-no-git-command-that-touches-the. GOOD.
  table   374  label is ONE WORD: "id", "origin", "characters", "Fact", "lane", "before", "status".
  note      1  the owner’s single hand-made mark.

THE CAUSE IS ONE LINE. `tableLabel(header)` in `src/core/anchor-pass.ts` is
`header.find(isReadable)` — the FIRST readable cell and nothing else. So a table whose first
column happens to be headed "lane" is labelled "lane". Half of every mark he has is named after
a column heading that describes a column, not the table.

AND THE LANE IS ALREADY IN THE DATABASE, UNSHOWN. `anchors.agent_id` joins `subagents.agent_id`,
and `subagents` carries `description` — the lane’s own name, as dispatched — across 432 rows.
Measured: 384 of 746 anchors resolve to a named lane today, e.g. "Lane N: rename cancel and
hidden total". NO NEW STORE IS NEEDED and none may be added: the file stays the truth and the
index stays derived.

THE OTHER 362 CARRY agent_id = null — they were marked by the main session, not a lane. That is
not a gap to paper over: say so honestly rather than inventing an owner for them. This is
exactly the absent-is-not-zero rule.

WHAT MUST NOT HAPPEN. The label is not a second store and not a cache: it is composed from the
turn at the byte, the way it is today. And the automatic pass must stay idempotent in both
directions — relabelling every existing table anchor is a RELABEL the pass already knows how to
report, not a new write path. Expect a large relabel count on the first run and say the number.
