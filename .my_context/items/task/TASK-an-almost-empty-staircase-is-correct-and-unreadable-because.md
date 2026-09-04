---
id: TASK-an-almost-empty-staircase-is-correct-and-unreadable-because
type: task
title: an almost-empty staircase is correct and unreadable, because the seen gate is silent
status: active
severity: soft
always: false
summary: A nearly empty chart is right, because this session already received almost everything, but it looks broken because nothing on it says so.
summary_of: 6a610a2532e04886
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:65"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 5c75b8e53a520fd6
plan: walk
seq: "65"
state: done
priority: "1"
source: owner, 2026-08-28
---

# an almost-empty staircase is correct and unreadable, because the seen gate is silent

> Owner, 2026-08-28, looking at the staircase after the density fix landed: *"the starecase now draws less i do not know if it is correct or just because of you working on it."*
>
> **It is correct, and the fact that a careful reader could not tell is the defect.**
>
> **What was measured**
>
> The screen asks `/api/simulate?event=tool&path=.gitignore&session=<the live session id>` — captured from the browser's own network log. With that session:
>
>     pinned   16,000   FITS 0/0
>     jit      16,000   FITS 1/1
>
> and the staircase draws one step with a y-axis of 0..1. The same queries with `cold=1` answer `pinned 23` and `jit 27`.
>
> **The difference is the `seen` gate, working exactly as designed.** `preview.js`'s own gate ladder describes rung 5 as *"already-delivered items are filtered out before budgeting"*. This session has been running all day and has already received nearly the whole corpus, so almost nothing is left for a NEW tool event to deliver. One item remains eligible; the staircase honestly draws one step.
>
> **Why this is still a defect worth fixing**
>
> The screen says nothing about it. A staircase with one step and a tier table reading `0/0` is indistinguishable from a broken chart, an empty corpus, or a regression — and the owner reasonably suspected the last of those, having just watched two fixes land on this screen.
>
> The information needed to say so is already on the response. `Selection` carries what was filtered and why; the ladder already knows rung 5 exists. **The screen has the fact and does not state it.**
>
> This is the same shape as `plan:walk seq:61` (a doctor finding with no repair draws no control and no reason) and as the `noBridge` and `servingLastGood` disclosures: correct behaviour, silent about the condition that produced it, and therefore unreadable.
>
> **What it should say**
>
> Something with the number in it — *"N items already delivered to this session are excluded"* — so a reader can tell "this session has consumed the corpus" from "this chart is broken". The cold/live distinction should be reachable too: the reader can already pick an event, and the most useful comparison here is against a fresh session, which the API supports with `cold=1` and the UI never offers.
>
> **Bounds**
>
> * Do not solve it by defaulting the screen to `cold=1`. The live session is the true answer to "what would happen now", and swapping it for a hypothetical would trade a confusing truth for a comfortable fiction.
> * The disclosure belongs wherever the emptiness appears — the staircase, the tier table, or both. `plan:walk seq:56`'s spilled-items list is adjacent but not the same thing: that names what did not FIT, this names what was never a candidate.
>
> **Done when**
>
> A screen whose candidate set was narrowed by the seen gate says so, with the count; the reader can compare against a cold session without editing a URL; and a browser test drives a session that has consumed most of the corpus and asserts the disclosure rather than the empty chart.
