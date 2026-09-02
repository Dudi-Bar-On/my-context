---
id: TASK-ask-the-four-canned-reports-cannot-take-the-fetch-cap-ladder
type: task
title: "Ask: the four canned reports cannot take the fetch-cap ladder, and no sentence on the screen says the control stops applying"
status: active
severity: soft
always: false
summary: On the query screen a how-many control quietly stops applying to the ready-made reports, and nothing on the page tells the reader that.
summary_of: 83c2f22c53ea89a4
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:ask"
  - "plan:walk"
  - "seq:100"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: c0e584e0164d0eeb
plan: walk
seq: "100"
state: todo
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/ask.js on 2026-08-29"
---

# Ask: the four canned reports cannot take the fetch-cap ladder, and no sentence on the screen says the control stops applying

FOUND 2026-08-29 under plan:walk seq:27, from `screens/ask.js`'s `runSummary` docstring, which names it in its own report and no task carries it.

THE SHAPE. `plan:walk seq:75` gave this screen a fetch cap -- `ask.limit` and `LIMIT_STEPS`, a ladder up to 2,000 -- because a reader at the end of 100 rows under `ask.truncated` ("more matched; raise the limit to see them") was being told to move a control that did not exist. It answers "go and get more", which no amount of paging can.

IT DOES NOT TRAVEL TO THE CANNED REPORTS, AND CANNOT. `/api/ask/summary` has a third limit of its own -- 1..200, defaulting to 20 -- and `report=ops` takes none at all. So two of the ladder's four rungs are past what the endpoint accepts on either tab: sending one is a 400 where the reader changed nothing, and clamping instead puts 200 rows on screen under a control reading 1,000. The screen therefore does not send it, which is right.

WHAT IS MISSING IS THE SENTENCE. Press a canned query and the cap select is still sitting in the filter row above, at whatever the reader set it to, governing nothing. That is the same defect this screen was just fixed for one axis along -- a control that is correct and inert, with the inertness left to be interpreted -- and it is the shape `plan:walk seq:58` and `plan:walk seq:59` both found on other screens. The product keeps shipping a control whose contingency is real and unsaid.

AND THE DEEPER HALF, which is why this is not only a disclosure. These reports are AGGREGATES over the whole log rather than a page of it, so what a raised cap would buy is a longer top-N -- a different question, and one no sentence on this screen currently asks. Decide which of the two the canned queries are offering before wording anything: if a longer top-N is wanted, the endpoint's own 200 is the bound to raise and `report=ops` needs a limit at all; if it is not, then the cap is simply out of scope for these four and the screen says so.

WHAT MUST NOT HAPPEN: do not make the cap "work" by clamping it. The screen would then show 200 rows under a control reading 1,000, which is a number about the answer that is false -- the same class as `ask.truncated`'s own defect on the audit tab (plan:walk seq:76).

The rows these reports DO return are already bounded and paged like every other answer on the screen, so nothing is unreachable today; what is wrong is that the reader is not told which of their two controls is in force.
