---
id: DEC-the-wave-is-the-order-and-priority-is-a-tiebreak-within-it
type: decision
title: the wave is the order, and priority is a tiebreak within it
status: active
severity: soft
always: false
summary: What is done next is set by which batch of work it belongs to; a priority number only breaks ties inside a batch, since nearly everything claims to be urgent.
summary_of: db057ce450506cfb
scope: []
tags:
  - v2
  - planning
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 012772201bbf4ad9
---

# the wave is the order, and priority is a tiebreak within it

> Ruled by the owner 2026-08-28.
>
> **The problem, measured**
>
> Of 125 ready tasks: **42 are priority 1, 37 carry no priority at all.** A field where a third of the values are the top value and a third are absent cannot order anything. `needs` computes what is POSSIBLE; nothing computed what was NEXT, so the wave ordering offered to the owner was the assistant's judgement wearing the appearance of a derivation.
>
> **The ruling**
>
> **The wave is the order. Priority is a tiebreak within a wave, and nothing more.**
>
> The wave map already encodes what priority was failing to: dependency (`needs`), file contention (which tasks cannot run concurrently), and the owner's own reported defects. Those are the three things that actually decide what comes next here, and none of them fits in a single integer.
>
> **What this stops us doing**
>
> Re-scoring 125 tasks so that `priority` means something again. That was the alternative and it was not taken: it costs a large review pass on the owner's side to restore a field that would drift back to all-p1 the moment new work is filed under pressure — which is exactly how it got here.
>
> **The cost, accepted and named**
>
> The wave map is not derived from anything. It is a judgement, and it has to be maintained by hand as waves complete and new defects arrive. Two consequences follow and both are addressed rather than left:
>
> * **It lives in the corpus**, as `REF-the-wave-map-what-order-the-work-is-being-done-in`, so it is not held only by whoever drew it. A plan that exists in one session's context is a plan that dies with that context.
> * **The table is COMPUTED from the corpus on every render** — done/open/blocked counts and every percentage — even though the wave ASSIGNMENT is authored. `STD-the-progress-table-has-one-format-and-this-is-it` requires exactly this, and records that three of its numbers changed inside a single afternoon.
>
> **One deliberate deviation from the progress standard, stated so it is not read as a slip**
>
> That standard sorts plans by completion descending, so the eye lands on 100% and travels to the trouble. **Waves are NOT sorted that way.** A wave's whole content is its position in a sequence; sorting by percentage would destroy the one thing the table exists to show. Every other rule of the standard is followed — six columns, `open` folds `todo` and `doing`, `blocked` keeps its own column, the ten-cell bar, bold only at 100%.
>
> **Not decided here**
>
> Whether `priority` should be re-scored EVENTUALLY. This ruling says it is not the ordering mechanism; it does not say the field is worthless. If a future reader wants `mycontext ready --json` to be orderable by someone other than its author, re-scoring is the way, and this item is the record of why it was deferred rather than never considered.
