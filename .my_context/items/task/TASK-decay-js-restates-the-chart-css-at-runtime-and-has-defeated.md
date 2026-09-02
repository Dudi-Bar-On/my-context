---
id: TASK-decay-js-restates-the-chart-css-at-runtime-and-has-defeated
type: task
title: decay.js restates the chart CSS at runtime and has defeated two fixes in one day
status: active
severity: soft
always: false
summary: One screen re-applies its own styling over the shared stylesheet, so it silently ignores fixes made everywhere else, and has done so twice.
summary_of: fa7a17f5b7f14727
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:68"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: ee1b0b70dd3dfe9c
plan: walk
seq: "68"
state: done
priority: "1"
source: "found twice by plan:walk seq:62 and seq:47, 2026-08-29"
---

# decay.js restates the chart CSS at runtime and has defeated two fixes in one day

> `src/ui/public/screens/decay.js` restates the shell's `svg.chart` rules on the element through the CSSOM. **It has now defeated two separate fixes in one day, silently, and the second time the stylesheet was already correct.**
>
> **Instance 1 — the chart typography restore.** The four `svg.chart text*` sizes were restored to their pre-repaint values behind new tokens. decay.js's inline `font-size:11px` and `font-size:var(--fs-00)` overrode the stylesheet, so Decay alone would have kept the large type while every other chart shrank. Caught only because the implementer checked the screen rather than the rule.
>
> **Instance 2 — the 1:1 scale bound.** `svg.chart` moved from `inline-size:100%` to `max-inline-size:100%`. decay.js's inline `inline-size:100%` beat it. The first measurement after the change read staircase 1.000, graph 1.000, comb **1.267** — *"green stylesheet, wrong page"*, in the implementer's words.
>
> **The justification it carries is stale, and that is the actual defect**
>
> Its comment claims the restatement is needed *"for as long as the shell's stylesheet has no `svg.chart` block at all"*. That stopped being true on **2026-08-23**. The rules have been in `styles.css` for days; the override outlived its own reason and nothing noticed, because an override that merely duplicates the stylesheet is invisible until the stylesheet changes.
>
> **Why no gate sees it**
>
> `styles-parity` compares the mockup's rule bodies against `styles.css` byte-for-byte. It is blind by construction to a THIRD source of the same declarations applied at runtime through the CSSOM — which outranks both. So the gate can be green, the stylesheet can be right, and the screen can be wrong, all at once. That is precisely what happened twice.
>
> **What to do**
>
> Delete the restatement. It is the only screen that does this — `graph.js`, `simulate.js` and `watch.js` all inherit from CSS cleanly, which is the proof that nothing needs it.
>
> Then consider the general guard: **a check that no module under `src/ui/public/` sets a property through the CSSOM that `styles.css` already declares for the same selector.** That is the gate `styles-parity` cannot be, and this file is the evidence it is worth having — two fixes, one file, one day.
>
> **Done when**
>
> `decay.js` inherits its chart rules from the stylesheet like every other screen; a browser test asserts the comb's computed chart properties match the stylesheet's rather than an inline copy; and the general CSSOM-override check is either built or its absence recorded with a reason.
