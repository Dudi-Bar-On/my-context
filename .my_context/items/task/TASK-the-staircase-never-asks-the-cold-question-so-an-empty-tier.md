---
id: TASK-the-staircase-never-asks-the-cold-question-so-an-empty-tier
type: task
title: the staircase never asks the cold question so an empty tier cannot say why it is empty
status: active
severity: soft
always: false
summary: The budget diagram cannot say whether a section is empty because nothing qualified or because it had all been delivered already.
summary_of: 1078f2cdd2237032
scope: []
tags:
  - v2
  - ui
  - simulate
  - walk
  - "plan:walk"
  - "seq:86"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/stair.md"
source_anchor: null
source_checksum: ac38d738eb0ecac1
valid_from: 2026-08-29
valid_until: null
checksum: 095f996d8b9bef4b
plan: walk
seq: "86"
state: done
priority: "1"
source: "split from plan:walk seq:65, 2026-08-29"
---

# the staircase never asks the cold question so an empty tier cannot say why it is empty

> > Split out of `plan:walk seq:65` on 2026-08-29, after that item's premise was measured on the wrong screen.
>
> **What happened, and it is worth recording**
>
> The owner reported *"an almost-empty staircase is correct and unreadable, because the seen gate is silent"*. The task was filed against the injection preview. On the preview the premise has **expired** — today's rung-count work gave the `seen` gate a voice: rung 5 reads *"104 item(s) fail at this gate"*, lists them, and the warm/cold control is one click away.
>
> But **the staircase is `screens/simulate.js`, not `preview.js`**. Measured there just now:
>
> * it never mentions `seen` at all;
> * it has **no cold control** — it always sends `ctx.session()`, so it can only ever ask the warm question;
> * its fits table draws `restored 0/0` and `continuity 0/0`.
>
> That is exactly the shape the owner described: every number correct, and the reason for the emptiness invisible. A reader sees a flat staircase and cannot tell whether the tiers are empty because nothing qualified or because everything had already been delivered.
>
> **Why the preview's answer is the precedent, not the specification**
>
> The preview solved this with two things, and both apply here: a **cold/warm control** so the other question is askable, and a **named count** for what `seen` removed so the zero is measured rather than blank. `/api/simulate` already serves `seenFiltered`, so the data exists — this is a screen that does not ask for it.
>
> **Done when**
>
> The staircase can be asked the cold question and says which it is showing; a tier drawing `0/0` says whether that is *nothing qualified* or *everything was already delivered*; and a browser test drives a session that has already been delivered items, because a cold fixture cannot reproduce the defect — that is the blindness that let it ship.
