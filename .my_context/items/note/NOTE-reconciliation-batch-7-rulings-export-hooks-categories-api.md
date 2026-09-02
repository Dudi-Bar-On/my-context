---
id: NOTE-reconciliation-batch-7-rulings-export-hooks-categories-api
type: note
title: "reconciliation batch 7: rulings, export, hooks, categories, api and review -- 23 verdicted"
status: active
severity: soft
always: false
summary: A seventh batch of open work read, gathering scattered items into single pieces of work and naming a habit of stating things nobody checked.
summary_of: a58ffeb020dd87ee
scope: []
tags:
  - v2
  - reconciliation
  - "plan:walk"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: bb5493edc0a50533
---

# reconciliation batch 7: rulings, export, hooks, categories, api and review -- 23 verdicted

plan:walk seq:23, 2026-08-25. One closed, twenty-two stand.

THE CITATION CLUSTER IS SIX TASKS ABOUT ONE GATE, and they had never been read together: `rulings 33c, 33d, 38, 47, 48` and the new `walk/30`. `verify:citations` now has THREE known blind spots -- both READMEs (6 false claims), the corpus (104 broken pointers), and `.html` files, which is where the design of record lives and is the most-cited artefact in the project. Three blind spots is a scope problem, not three bugs: settle what the gate scans BY RULE. Dispatch the six as one piece of work.

THE TYPED-SQL FEATURE IS THREE TASKS IN THREE PLANS and the order is now fixed: `rulings/46` (the guard refuses twelve keywords SQLite accepts as ordinary identifiers), then `api/6` (the two questions), then `ui3/15` (the build). `rulings/46` was filed as a curiosity and is now a BLOCKER, because the feature s whole safety argument is "reuse that guard" -- and reusing a wrong guard ships the wrongness to a browser.

TWO MORE STALE BLOCKERS, bringing the total to seven. `review/5`, the functional UX review, is blocked on `ui1 task 15` which is DONE -- and it is THE ONLY ITEM IN THE CORPUS THAT MEASURES WHETHER A SCREEN WORKS. Every gate here measures shape. That is the direct answer to the owner saying "many things does not work". And `hooks/22`, an owner instruction, waits for a hooks programme that is 32 done with one README SENTENCE outstanding.

ONE CLOSED ON ITS OWN WORDS: `review/2` has said "RULED 2026-08-21: absorbed by the web UI visual repaint" in its own body for four days, while reading as open priority-1 work.

AND A COUNT THAT GREW: `categories/19` measured 13 tasks whose state tag and field disagree. It is TWENTY-EIGHT today, of 265. Direction uniform -- all 28 are tag=done with a stale field, so no reported count was ever wrong. But it is growing, which means a closing path still moves the tag and leaves the field. Find that path before the sweep, or the sweep is needed again next week.

A CLASS WORTH NAMING, from three findings in three plans: THE PRODUCT STATES THINGS IT HAS NOT CHECKED. `ui.enabled` is accepted, strictly validated and read by nothing (verified live). The status strip announces the bridge is not installed without asking. The Tutorials screen asserts twelve checkmarks about content nobody checks, one of them true of no file on disk. Every one is green under every gate.
