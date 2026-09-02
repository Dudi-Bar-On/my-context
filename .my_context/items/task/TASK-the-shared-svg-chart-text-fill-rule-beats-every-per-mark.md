---
id: TASK-the-shared-svg-chart-text-fill-rule-beats-every-per-mark
type: task
title: the shared svg chart text fill rule beats every per-mark colour the charts draw
status: active
severity: soft
always: false
summary: One shared styling rule overrides every colour the charts choose, so meaning encoded as colour comes out flat grey.
summary_of: 9024f43cca79a0dd
scope: []
tags:
  - v2
  - ui
  - graphics
  - walk
  - "plan:walk"
  - "seq:78"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/fill.md"
source_anchor: null
source_checksum: 4627686257064cf7
valid_from: 2026-08-29
valid_until: null
checksum: d1875265cf3e8b1e
plan: walk
seq: "78"
state: done
priority: "1"
source: "found by plan:walk seq:68, 2026-08-29"
---

# the shared svg chart text fill rule beats every per-mark colour the charts draw

> > Found 2026-08-29 by `plan:walk seq:68` while deleting decay.js's CSSOM restatement, and measured before AND after that deletion so it is provably not caused by it.
>
> **The defect**
>
> `svg.chart text { fill: var(--dim) }` is an author rule. A `fill` **attribute** on a `<text>` element is a presentation attribute, and presentation attributes lose to author rules. So **the shared rule beats every per-mark colour the charts draw.**
>
> Measured on the live comb: **110 `<text>` elements ask for something other than `--dim` and all 110 render `rgb(169,166,184)`.** `window 20` asks `var(--warn)`. `never` asks `var(--crit)`. Every id asks `var(--ink)`. None of them gets it. `simulate.js` has the same shape — its `eviction` labels ask `var(--crit)`.
>
> **Why it matters more than it looks**
>
> This is the meaning-hue budget being silently spent to nothing. The charts are drawing severity — warn, crit, ink — and the reader sees one flat dim grey. The information was encoded and then erased by the cascade, which is worse than never encoding it: the code reads as if the distinction is being made.
>
> **Pre-existing since 2026-08-23**, the day the `svg.chart` rules entered `styles.css`.
>
> **The fix, and it is a judgement**
>
> Either class the marks that need their own colour and give those classes rules, or drop `fill` from the shared `svg.chart text` rule and let each mark carry its own. The second is smaller but changes the default for every unclassed mark, so it needs a sweep of what currently relies on inheriting `--dim`.
>
> **Done when**
>
> A mark that asks for `--warn` or `--crit` renders it; a browser test asserts computed `fill` per mark rather than the rule's presence; and `check-cssom-restatement` is confirmed still clean afterwards.
