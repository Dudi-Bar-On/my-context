---
id: TASK-five-perf-files-index-the-percentile-one-rank-high-and-their
type: task
title: five perf files index the percentile one rank high and their baselines were derived through it
status: active
severity: soft
always: false
summary: Five speed measurements report a slightly worse figure than the one they name, and the recorded baselines were all worked out the same wrong way.
summary_of: f90d1819cfd6f741
scope: []
tags:
  - v2
  - gates
  - perf
  - hooks
  - "plan:hooks"
  - "seq:12q"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/rank.md"
source_anchor: null
source_checksum: 94bd631c803c7562
valid_from: 2026-08-30
valid_until: null
checksum: 8c21fa72e5ee8bbe
plan: hooks
seq: 12q
state: todo
priority: "2"
source: "found by plan:hooks seq:12p, 2026-08-30"
---

# five perf files index the percentile one rank high and their baselines were derived through it

> > Found 2026-08-30 by `plan:hooks seq:12p` while fixing three ceilings that computed a maximum and called it a p95. These five are a smaller, different defect in the same arithmetic, reported rather than fixed because correcting them means re-deriving five files' recorded baselines.
>
> **The defect**
>
> `Math.floor(n * q)` is off by one rank high against nearest-rank `ceil(n * q) - 1`.
>
>     jit-latency        n=200   returns the 191st of 200, not the 190th
>     focus-latency      n=200   same
>     audit-latency      n=200   same
>     statusline-latency n=200   same
>     observation-latency n=40   returns the 39th of 40 — one sample above it
>
> **None of these is a max-of-n**, so none carries the defect `seq:12p` was sent for — at n=200 a rank-off-by-one is a small bias, not a category error. But every one of them reports a number one rank higher than the statistic it names, and every recorded baseline in those files was derived through it.
>
> `fallback-latency` at n=50 is **coincidentally correct** — both forms give index 47. That coincidence is worth naming, because it is the kind of thing that makes a bug look like a style difference.
>
> **Why it was not fixed in the same pass**
>
> Correcting the index moves every number those five files record. Re-deriving five sets of baselines needs a machine that is not saturated, and this one was not idlable during that work — six agents held it between 45% and a pinned 100% CPU. Deriving new baselines under that load would have replaced a small known bias with a large unknown one.
>
> **Done when**
>
> All five use `perf-stats.ts`'s shared `percentile` rather than a local copy; their baselines are re-derived on a quiet machine with the load recorded alongside; and `fallback-latency`'s coincidence is either removed by using the shared helper or named in place so nobody reads it as a second opinion.
>
> **And the standing debt this belongs to**
>
> `plan:hooks seq:12p` left `subagent-start`'s 500 ms ceiling **honest but uncertified** for the same reason: red on all nine runs, and the untouched `session-start` file measured the same shape on the same box, so the redness is the machine and not the code. **An idle-machine run is owed on both.** The right moment is when no agents are dispatched — which is a scheduling decision, not a code one.
