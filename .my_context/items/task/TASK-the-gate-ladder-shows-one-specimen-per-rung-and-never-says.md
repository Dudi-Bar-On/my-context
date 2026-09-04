---
id: TASK-the-gate-ladder-shows-one-specimen-per-rung-and-never-says
type: task
title: the gate ladder shows one specimen per rung and never says of how many
status: active
severity: soft
always: false
summary: Each reason for leaving something out shows one example and never says how many, so hundreds of omissions read as a handful.
summary_of: d80a7c4673201ffb
scope: []
tags:
  - v2
  - ui
  - preview
  - walk
  - "plan:walk"
  - "seq:80"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/gl.md"
source_anchor: null
source_checksum: a287fcd1a97ffc25
valid_from: 2026-08-29
valid_until: null
checksum: 15ec580f18986812
plan: walk
seq: "80"
state: done
priority: "1"
source: reported by the owner, 2026-08-29
---

# the gate ladder shows one specimen per rung and never says of how many

> > Owner report 2026-08-29: *"the why not in injection preview shows only 3 items, spill had much more."*
>
> **Measured on the live app, 673 items**
>
> The picker shows **3 names**. Behind them:
>
>     rung 1  eligible   CONST-live-pass-probe...      13 items
>     rung 2  tier       DEC-a-budget-is-chosen...    551 items
>     rung 6  budget     STD-v2-0-progress-report...    1 item
>
> **564 items did not make it, and the card shows three names and not a single number.**
>
> **The picker is not the defect.** One exemplar per rung is the design, and only three rungs have any failure, so three buttons is correct. The prose even says *"the strip holds one specimen per gate"*.
>
> **The defect is that a specimen is presented without its population.** The card never says *of how many*, so a reader sees three names and concludes three items missed, when 551 fell at one rung alone. A specimen standing silently for 551 reads as the whole set — which is `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` in a new place.
>
> **Done when**
>
> Each rung carries the count of items that fail there, so `tier` reads as 551 rather than as one name; a rung with a reachable id list is openable the way rung 6 already is; and a browser test asserts the counts against a corpus where the rungs differ by orders of magnitude, because a fixture with three items at each rung would prove nothing.
