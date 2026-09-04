---
id: TASK-the-injection-preview-only-ever-asks-the-warm-question-so
type: task
title: the injection preview only ever asks the warm question so its spilled list is unreachable
status: active
severity: soft
always: false
summary: The panel listing what did not fit can never show anything, because the screen only asks the question where nothing is left out.
summary_of: d6125407c7fe1e64
scope: []
tags:
  - v2
  - ui
  - preview
  - walk
  - "plan:walk"
  - "seq:77"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/spill-body.md"
source_anchor: null
source_checksum: 36cf4587ef78cc55
valid_from: 2026-08-29
valid_until: null
checksum: 3be217a3abf8bb39
plan: walk
seq: "77"
state: done
priority: "1"
source: reported by the owner, 2026-08-29
---

# the injection preview only ever asks the warm question so its spilled list is unreachable

> > Reported by the owner 2026-08-29: *"Injection preview → 'Not delivered — every item that spilled, and what it cost' is not working correct or not at all."* They are right, and the panel is not the thing that is broken.
>
> **The cause, measured**
>
> `/api/select` requires exactly one of `session=<id>` or `cold=1`. **`screens/preview.js` contains the string `cold` zero times** — it always sends `session=<id>`, so the screen only ever asks the WARM question.
>
> Same event, same focus, only that parameter differing, against the live corpus:
>
>     event=session-start&session=<id>   full  1   spilled 0
>     event=session-start&cold=1         full 24   spilled 1   (pinned, 17,035 vs 16,000)
>
> 23 of 24 candidates are removed at the **`seen`** gate before the budget gate runs. Nothing reaches the gate that spills, so `spilled` is structurally empty. `drawSpilled` is correct and faithful; its own comment expects *"139 spills… on a real corpus"*, and that list is unreachable from the running app.
>
> **The worse half**
>
> `Showing all 0.` is drawn as a MEASURED ZERO. The true statement is *nothing reached the gate that spills, because 23 items were removed one gate earlier*. The screen's docblock already admits the hole — rung 5 `seen` *"is the one that cannot be shown; the field is not in any response"* — so a reader sees Delivered 1, Not delivered 0, and **23 items accounted for nowhere**. That is what `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids, and it is why the panel reads as broken rather than as empty.
>
> **Why no test caught it**
>
> Every fixture is a cold corpus. The panel tests green while being unreachable in the app — the fixture-flatters pattern this project has now measured six times.
>
> **Done when**
>
> The cold question is reachable and LABELLED (the warm default stays — it is the honest answer to *"exactly what Claude gets"*); every candidate can be accounted for as delivered, spilled, or filtered-before-budgeting; the empty state distinguishes *nothing spilled* from *nothing reached the budget gate*; and an e2e drives a session that has already been delivered items rather than a cold fixture.
