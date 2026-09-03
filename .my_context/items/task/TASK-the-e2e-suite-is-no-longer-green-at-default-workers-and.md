---
id: TASK-the-e2e-suite-is-no-longer-green-at-default-workers-and
type: task
title: the e2e suite is no longer green at default workers and nobody has a pre-fixture baseline
status: active
severity: soft
always: false
summary: The browser tests stopped passing reliably once the sample data grew, and there is no earlier measurement to compare against.
summary_of: ed6d3c353561b7af
acknowledged:
  - body_disagrees_with_meta@3f63f1005dbcb37d
scope: []
tags:
  - v2
  - gates
  - e2e
  - port
  - "plan:port"
  - "seq:96"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/susp.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-30
valid_until: null
checksum: 6e8f9edf78f996e4
plan: port
seq: "96"
state: done
priority: "1"
source: "measured by plan:port seq:94, 2026-08-30"
---

# the e2e suite is no longer green at default workers and nobody has a pre-fixture baseline

> > Measured 2026-08-30 by `plan:port seq:94`, which reported it **against its own change** rather than only about it.
>
> **The recorded claim that no longer describes the suite**
>
> After `plan:walk seq:85` removed the boot-refusal writes, a full `npm run test:e2e` at the default worker count ran **331 passed / 0 failed**. That is recorded in this corpus and in several briefs.
>
> Three consecutive runs after the fixture grew: **7, 6 and 3 failures.** The failing sets are almost disjoint between runs, and **every one passes when re-run alone.**
>
>     run 1  config-blast-face x2 · execute:237 · injected-empty:290 x2 · screen-parity (packs)
>     run 2  config-blast-face x2 · preview-gate-counts:166 · preview-spilled:433 · preview-spilled:559 · served-shape:224 · simulate-range:52
>     run 3  app-layout:936 · bounded-paging:296 · execute:304
>
> Verified alone: 28/28, 46/46, 52/52, 4/4.
>
> **What the lane said about its own innocence, and it is the right answer**
>
> > *I cannot claim my change is innocent of it: the fixture is heavier now (66 more relation mutations and item rewrites, 24 more injections, a 60-line seen file), and a heavier corpus makes that class fire more often. I did not have a pre-change baseline full run to compare against.*
>
> That is the honest position and it is also the reason this needs its own item rather than a note in that one: **nobody has a pre-change baseline**, so "the fixture did it" and "the contention was never fully closed" are both live, and neither can be settled by argument.
>
> **Why it matters more than seven flakes**
>
> The failure signature is the same class `walk/85` was supposed to have ended — `database is locked` from `page.evaluate`, and screens that never settled. If that class is back, or was never fully gone, then the five specs taken off the contention list came off on a measurement that no longer holds. **A list that shrinks on a stale measurement is worse than one that never shrank**, because people trust the shorter one.
>
> And `app-layout` is now in the failing set. That spec walks 21 screens at three viewports with the default 25-sample settle — `plan:walk seq:112` measured its own headroom at 1.2 seconds on `doctor` — so it is the most load-sensitive spec in the suite and the first to report a machine problem as a coverage failure.
>
> **Done when**
>
> A full run at default workers on a QUIET machine establishes the baseline nobody has; the difference between the pre-fixture and post-fixture corpus is measured rather than argued; and if the contention class is still live, the specs taken off the list on 2026-08-29 go back on it or the class is closed for real.
>
> **Note the scheduling constraint, because it is the same one blocking two other items:** this cannot be measured while agents are dispatched. `plan:hooks seq:12p` and `seq:12q` are owed an idle-machine run for the same reason.
