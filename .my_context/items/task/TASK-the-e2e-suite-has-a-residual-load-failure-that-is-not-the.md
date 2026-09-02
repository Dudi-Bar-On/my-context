---
id: TASK-the-e2e-suite-has-a-residual-load-failure-that-is-not-the
type: task
title: the e2e suite has a residual load failure that is not the database contention and skews to one browser project
status: active
severity: soft
always: false
summary: Ten browser tests fail together and pass alone, and eight of the ten are on one browser; nobody has chased why.
summary_of: e28a0b37f4f0c97b
scope: []
tags:
  - v2
  - gates
  - e2e
  - walk
  - "plan:walk"
  - "seq:84"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/resid.md"
source_anchor: null
source_checksum: 170f73dbaea506b2
valid_from: 2026-08-29
valid_until: null
checksum: f5e43ec51354969b
plan: walk
seq: "84"
state: done
priority: "1"
source: measured on a quiet machine, 2026-08-29
---

# the e2e suite has a residual load failure that is not the database contention and skews to one browser project

> > Measured 2026-08-29 on a QUIET machine — no agents running, nothing else on the box — immediately after `plan:walk seq:79` moved the fixture write out and `seq:74` fixed two settle loops.
>
> **What the fix did achieve, and it should not be understated**
>
>     database is locked / disk I/O error       ZERO occurrences in the whole run
>
> That was the entire mechanism `seq:79` identified, and it is gone. `app-refresh`, `served-shape`, `app-layout`, `button-contrast` and `screen-parity` no longer fail for it.
>
> **What is left**
>
>     309 passed · 10 failed · 6.7 min at the default worker count
>
> And the failures are **not regressions**. `e2e/app-layout.spec.ts` passes **18 of 18 in 34 seconds** run alone, including the two cases that failed in the suite (`:735` the gate ladder, `:783` the carried block). Every other failing spec has the same shape.
>
> **The signal nobody has chased yet**
>
> **8 of the 10 failures are on the `chrome` project; 2 are on `chromium`.** The two projects run concurrently, and `chrome` is the real installed channel while `chromium` is the bundled build. A systematic skew that strong is not randomness — it is either a slower boot on one channel pushing settles past their bound, or a resource ceiling reached only when both browser stacks are live at once.
>
> The failing set: `app-layout:735`, `app-layout:783`, `item-pane:31` (BOTH projects), `bounded-paging:112`, `pane-size:338`, `preview-overlap:90`, `preview-spilled:238`, `preview-spilled:559`, `screen-parity:603` (both projects).
>
> **Why this must not become another allowance list**
>
> The last one accumulated five specs and hid two genuine defects for weeks — one of them a parity gate silently inventorying ten screens it had never seen. A list of specs known to fail under load is a list nobody reads. This item exists so the residual is named and measured rather than tolerated.
>
> **Where to start**
>
> Run the full suite with `--project=chromium` only, then `--project=chrome` only, then both. If the failures follow the channel rather than the concurrency, it is a boot-time bound; if they only appear when both run, it is resource pressure and the fix is scheduling, not waiting.
>
> **Done when**
>
> The default-worker suite is repeatedly green, or every remaining failure is named with its own cause. `walk/82`'s `bad port` and `walk/83`'s holding-chip settles are candidate contributors and should be ruled in or out rather than assumed unrelated.
