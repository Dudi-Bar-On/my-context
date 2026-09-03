---
id: TASK-a-doctor-finding-with-no-repair-shows-no-control-and-no
type: task
title: a doctor finding with no repair shows no control and no reason, which reads as broken
status: active
severity: soft
always: false
summary: A health problem with no automatic fix shows no button and no explanation, so a healthy project looks like a broken screen.
summary_of: d541c7648350d006
acknowledged:
  - state_unaudited@862f7cb2d538d277
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:61"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 98f1596f714a02b9
plan: walk
seq: "61"
state: done
priority: "1"
source: owner, 2026-08-28
---

# a doctor finding with no repair shows no control and no reason, which reads as broken

> Owner, 2026-08-28: *"doctor lost it's execute an fix controls ? why yo broke it ?"*
>
> **Nothing broke, and that is the defect.**
>
> The doctor screen draws a repair control only for findings that HAVE one. `lib/viewmodel.js`'s `repairCommandFor` is the whole list: `index_stale` -> `mycontext rebuild`, `audit_log_size` -> `mycontext audit --files`, `corpus_size_fallback_ceiling` -> `mycontext decay`, `source_drift` -> `mycontext refresh <id>`. Every other code returns null and the row is drawn without a control.
>
> The corpus now reports exactly two findings: `blocked_without_needs` (warn) and `nested_corpus` (info). **Neither has a repair.** So there is nothing for the screen to offer, and it offers nothing.
>
> **How it got here, in one day**
>
> * `source_drift` was the code that had been supplying most of the controls. Nine items pointed their `source_file` at a temp file; the links were cleared, and with them every drift finding.
> * Checksum mismatches were repaired.
> * `plan:categories seq:21` introduced `blocked_without_needs`, whose remedy is a PERSON naming a blocker — correctly not automatable.
>
> So the corpus got healthier and the screen went quiet, and quiet is exactly what a broken screen looks like.
>
> **What the screen must say**
>
> A finding with no automated repair should SAY it has none, and ideally why: *"no automated repair — this needs a person"* reads as a state; a missing control reads as a bug. `repairCommandFor` already returns `null` at the one point where the fact is known, so the disclosure has somewhere to live and needs no new data.
>
> This is the same shape as the day's other findings — a surface correct about what it drew and silent about what it did not — and it is worth noting that the owner's reaction was to assume regression, which is the cost of the silence rather than a misreading.
>
> **Consider also**: a doctor screen with no actionable findings might say so at the top. "2 findings, 0 with an automated repair" is a different sentence from an empty toolbar, and the reader can act on it.
>
> **Done when**
>
> A finding with no repair says so on its own row; the screen states how many findings carry a repair; and a browser test drives a corpus whose only findings are unrepairable and asserts the screen explains itself rather than falling silent.
