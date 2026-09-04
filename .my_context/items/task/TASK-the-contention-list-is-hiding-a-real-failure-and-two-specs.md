---
id: TASK-the-contention-list-is-hiding-a-real-failure-and-two-specs
type: task
title: the contention list is hiding a real failure, and two specs have timing problems of their own
status: active
severity: soft
always: false
summary: A list of tests excused as unreliable is hiding one that genuinely fails; re-check every entry on its own.
summary_of: 158e23c906154a03
scope: []
tags:
  - v2
  - e2e
  - gates
  - "plan:walk"
  - "seq:74"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 5165a03fba8ad4b6
plan: walk
seq: "74"
state: done
priority: "1"
source: found sweeping neighbours during walk/72, 2026-08-29
---

# the contention list is hiding a real failure, and two specs have timing problems of their own

> Found 2026-08-29 while fixing `plan:walk seq:72`, by sweeping the neighbours rather than assuming the reported screen was alone. Two findings, both measured in a browser.
>
> **1. `pane-size.spec.ts` is not the flake the contention list says it is**
>
> It fails **in isolation**, on both browser projects, all five tests. It reports **`0 linked` items on all nine screens it walks** — a corpus or fixture condition, not load. Confirmed pre-existing: it fails identically with the router change bypassed.
>
> It has been sitting on the "known contention, do not chase" list, which is how a real failure hides inside a list of tolerated ones. **That list needs an audit**: every entry should be re-measured in isolation, and anything that fails alone should come off it and be diagnosed. This project has already recorded what a tolerated red does — *"a suite that is red on eleven tests trains everyone to read '11 failing' as normal, and the next real regression lands inside that number."*
>
> **2. `tree-parity.spec.ts` has a timing problem of its own**
>
> The same code, unchanged, measured **228s (pass), 246s (timeout), and later 34s**. A spec whose runtime varies seven-fold is one whose result is a property of the machine rather than of the code. It is not on the contention list and it should not simply be added to one — a 246-second parity walk is worth understanding before it is tolerated.
>
> **3. `simulate.js` can still let an OLDER answer win**
>
> Recorded in that file rather than patched, deliberately. Its six surfaces each `replaceChildren()` inside a synchronous draw, so it cannot stack two renders the way `preview.js` did. But if two fetches are in flight and the older resolves second, the older answer is what stays on screen. That is a different defect from double-rendering — quieter, and not what `seq:72` was about — and it deserves its own decision rather than a fix smuggled in beside another.
>
> **Done when**
>
> Every entry on the contention list is re-measured in isolation and anything failing alone is removed and diagnosed; `pane-size`'s `0 linked` condition is understood; `tree-parity`'s seven-fold runtime variance is explained; and `simulate.js`'s older-answer-wins case is either fixed or accepted with a reason.
