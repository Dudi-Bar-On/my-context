---
id: TASK-build-the-foreign-store-check-the-design-of-record-already
type: task
title: build the foreign_store check the design of record already draws
status: active
severity: soft
always: false
summary: Notice when another tool on the same machine also collects durable notes, so people do not write knowledge somewhere this one will never read.
summary_of: 05df35a060cf21ca
acknowledged:
  - body_disagrees_with_meta@7ea5c8b3ca54f8b7
scope: []
tags:
  - v2
  - ui
  - "screen:doctor"
  - tree-parity
  - "plan:walk"
  - "seq:19"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 50227542f105ee7f
plan: walk
seq: "19"
state: done
priority: "2"
source: "plan:port seq:98, doctor"
---

# build the foreign_store check the design of record already draws

Carries out the ruling that `foreign_store` becomes a real check, at notice level.

THE OPEN QUESTION OF WHERE IT MAY LOOK IS GONE, and the check shipped without it. The owner dropped the `~/.gsd/knowledge/` row from the mockup s notice card on 2026-08-26, so `checkForeignStore` never reads OUTSIDE the repository -- `src/doctor/checks.ts` · `code: 'foreign_store',` · ~1806 stats a known list of in-repo directories and reports each at info level. That dissolves the question rather than settling it, and it is why the constraint below is met rather than waived.

WHAT IT REPORTS, in the design s own words: "a second cross-project knowledge store exists on this machine" and "another plugin writes durable learnings here -- the same kind as lessons". Two rows, `notice` level, in the notice card.

WHY IT IS WORTH BUILDING: it answers a question nothing else asks. This tool exists to be the place durable knowledge lives, and a second store on the same machine silently defeats that -- the user is writing lessons somewhere my_context will never inject. A notice is the right register: it informs and does not nag.

CONSTRAINTS THAT ALREADY EXIST: `test/core/real-home-guard.test.ts` is there because this project has already had to stop code touching a real home directory. Whatever the check reads, its test must not reach one.

DO NOT let this become a filesystem scan by default. The open question existed precisely because thorough and surprising are the same option here.
