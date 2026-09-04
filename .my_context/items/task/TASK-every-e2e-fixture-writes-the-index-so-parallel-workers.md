---
id: TASK-every-e2e-fixture-writes-the-index-so-parallel-workers
type: task
title: every e2e fixture writes the index so parallel workers contend and the known-contention list hides real failures
status: active
severity: soft
always: false
summary: Tests write to a shared database while running side by side, so they fail at random, and a list of known flaky ones now hides real failures.
summary_of: 28cf7cdd25296c8c
scope: []
tags:
  - v2
  - gates
  - e2e
  - walk
  - "plan:walk"
  - "seq:79"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/e2econtend.md"
source_anchor: null
source_checksum: 7ffe1fb88474feeb
valid_from: 2026-08-29
valid_until: null
checksum: b6ce79fb3e3e391f
plan: walk
seq: "79"
state: done
priority: "1"
source: "measured by plan:walk seq:77, 2026-08-29"
---

# every e2e fixture writes the index so parallel workers contend and the known-contention list hides real failures

> > Measured 2026-08-29 by `plan:walk seq:77` while closing the preview spill defect. It is the residue that task could not make green, and the measurement identifies the cause precisely.
>
> **The defect**
>
> `e2e/app.ts` runs `mycontext audit` — a WRITE to `.demo-corpus`'s index — in **every fixture**. Parallel workers therefore write the index while sibling servers read it, and the failures surface as `database is locked` / `disk I/O error` rendered into whichever card was mid-fetch.
>
> **The measurement, and it is what makes this actionable**
>
> Failure rate of `item-pane.spec.ts` under four workers:
>
>     history fetch removed from the screen entirely   6 of 8 runs failed
>     history fetch present                            3 of 8 runs failed
>     --workers=1                                      0 of 3 runs failed
>
> The screen's own fetch is **not** the cause — removing it made things worse, not better, because it changed the timing rather than the contention. The write-per-fixture is the cause.
>
> **Why it has been misread repeatedly**
>
> This is the source of most of the "known e2e contention list" — `pane-size`, `execute`, `app-refresh`, `tree-parity`, `served-shape` — that four separate tasks have now been told not to chase. A list of specs known to fail under load is a list nobody reads any more, and it has already hidden at least one real failure (`plan:walk seq:74`).
>
> **The fix**
>
> Sync the projection ONCE per suite, in a Playwright `globalSetup`, rather than once per fixture. The fixtures then only read.
>
> **Done when**
>
> `npm run test:e2e` is green at the default worker count without a contention allowance; the known-contention list shrinks to whatever genuinely remains; and `plan:walk seq:74` can be re-verdicted against a suite that is no longer lying.
