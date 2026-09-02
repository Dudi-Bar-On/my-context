---
id: REF-the-wave-map-what-order-the-work-is-being-done-in
type: reference
title: "the wave map: what order the work is being done in"
status: active
severity: soft
always: false
summary: The order the work is being tackled in, grouped so that jobs which do not touch each other can be done at the same time.
summary_of: 188ab3b5d8e23e32
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
checksum: abc830bb4fb26a63
---

# the wave map: what order the work is being done in

> **The order the v2.0 work is being done in.** Authored, not derived — `DEC-the-wave-is-the-order-and-priority-is-a-tiebreak-within-it` records why, and what that costs.
>
> A wave groups tasks that can run CONCURRENTLY because they own disjoint files. One task per lane at a time; up to three lanes at once. The measured reason: 58% of open UI tasks touch `docs/design/web-ui-mockup.html` or a string table, so those are a single serial lane, and parallelism beyond three has produced contention rather than speed on this repo.
>
> **Wave 1 — foundation under the instrument (DONE)**
> `live/8` the config unfreezes · `budget/7` the jit tier bands · `walk/1h` Hebrew emphasis
>
> **Wave 2 — the instrument, and the blindness behind it**
> `walk/37` one markdown renderer · `live/12` asset/server version skew · `live/7` the preview hears a compact · `ui1/20e` e2e over the served corpus (runs ALONE — it reworks the suite other tasks add specs to)
>
> **Wave 3 — what the owner asked for, and the 503**
> `walk/56` the spilled-items list · `walk/29b` + `walk/29` the status strip · `walk/28` audit projection on the write path
>
> **Wave 4 — ruled, and red**
> `walk/58` the path picker discloses it cannot filter · `walk/7b` the slider's range control · `live/11` the shared-stream test · `upkeep/7` the liveness record
>
> **Wave 5 — readability**
> `walk/47` three unreadable screens · `walk/62` graph and staircase fonts, the status line · `walk/60` English literals with no key · `budget/6` an edited budget shows what it was
>
> **Wave 6 — the builder programme**
> `walk/20` draw the builder in the mockup FIRST · `walk/13` the config composer · `walk/10` the delta plate · `walk/46` the shared write-preview block
>
> **Wave 7 — tooling and corpus integrity**
> `categories/23` ready's silent cap · `categories/21` finish · `upkeep/8` add --file truncates a body · `walk/61` a doctor finding with no repair · `live/13` three false comments · `walk/30` · `walk/27` · `walk/5` · `repaint/12` · `repaint/8r` · `rulings/42`
>
> **Wave 8 — features and flows**
> `budget/2` -> `3` -> `4` in order, each assumes the last · `handover/1` · `handover/9` · `export/13r` · `export/14n` · `ui1/17b` · `walk/18` · `walk/31` · `walk/35` · `walk/44` · `port/94`
>
> **What is NOT in a wave, and this is deliberate disclosure rather than an omission**
>
> These waves hold the priority-1 set. The remaining ready tasks — p2, p3, p4 and the 37 carrying no priority — are not yet assigned. Two silent-truncation defects were filed on 2026-08-28 (`categories/23`, `upkeep/8`); a plan that implies coverage it does not have would be a third.
>
> **Where it is rendered**
>
> The progress table is computed from the corpus on every render, never remembered. The wave ASSIGNMENT is authored here; every count, percentage and bar is derived.
