---
id: TASK-research-a-documentation-tool-then-build-the-full
type: task
title: research a documentation tool, then build the full application documentation
status: active
severity: soft
always: false
summary: Pick a documentation tool first, then build the complete user documentation in both languages out of sources that already exist.
summary_of: b66588c94d90e8be
scope: []
tags:
  - v2
  - ui
  - "screen:docs"
  - documentation
  - research
  - "plan:walk"
  - "seq:24"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 0834c6ff86ac4d39
plan: walk
seq: "24"
state: todo
priority: "2"
source: owner ruling 2026-08-25
---

# research a documentation tool, then build the full application documentation

OWNER RULING, 2026-08-25, taken while ruling that the Documentation screen serves help topics FOR NOW.

THE END STATE: the Documentation screen is where a user finds EVERY detail about this application -- what it is, how to use it, how to configure it, and everything else. Built from the README, the application s own docs, and the application itself.

IN ENGLISH AND IN HEBREW. This project already holds both string tables to the same key set in both directions, and a documentation surface that ships one language would be the first place that stopped being true.

STEP ONE IS RESEARCH, NOT WRITING. Find a documentation tool that fits: it has to produce something this server can serve without a runtime dependency (this package ships ZERO), it has to handle two languages including an RTL one, and it has to be generatable from sources that already exist rather than hand-maintained beside them -- documentation that drifts from the code is the defect this whole project exists to end.

WHAT IS ALREADY TRUE AND CONSTRAINS THE CHOICE:
- `mycontext help` already carries seven topics of real prose, already translated.
- The screen s renderer is a hand-written markdown SUBSET -- no HTML string is ever produced, so there is nothing to sanitise. Whatever the tool emits has to survive that, or the renderer question has to be reopened deliberately.
- `.md` in styles.css has rules for h1/h2/h3, p, ul and pre and NOTHING else.

DO NOT start by writing prose. A tool chosen after the documentation exists is a rewrite.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and THREE TASKS FOLD INTO IT. It is one of the two largest unbuilt features in the corpus.

  plan:port seq:5c -- SUPERSEDED. dv.sub and the spec both say Docs renders the repository s README; no endpoint serves it. Its route half is plan:walk seq:25.
  plan:port seq:5d -- REFINES, and holds the strongest argument for this programme: the Tutorials screen hard-codes twelve EN/HE done-or-to-write cells, the claim was hand-checked and holds only loosely, and NO FILE ON DISK IS NAMED FOR ANY ROW. tu.2 matches no heading in either file. Tree parity calls tut one of two CLEAN screens -- a perfect tree over unverified content.
  plan:review seq:6b -- SHOULD MERGE. Applying a 2026-08-22 documentation review s findings separately means editing the same documents twice, which is the exact reason that task deferred itself.

AND IT MUST SHARE A SOURCE WITH plan:builder seq:8, which renders /api/help/:topic and `examples <cat>` INTO the screens. If the programme writes a second description of the same commands, the product grows two manuals -- which is the drift plan:builder exists to end.
