---
id: TASK-the-handover-feature-is-built-and-off-and-its-ask-is-bounded
type: task
title: the handover feature is built and off, and its ask is bounded per session
status: active
severity: soft
always: false
summary: The handover feature is finished but switched off, and only the owner can decide to turn it on and how.
summary_of: 40672c9ac76ba8ee
acknowledged:
  - state_unaudited@76b3d1110c68f05e
scope: []
tags:
  - v2
  - handover
  - "plan:handover"
  - "seq:10"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 996f55d9c99087f5
plan: handover
seq: "10"
state: done
priority: "2"
source: "plan:handover seq:9's residuals, 2026-08-29"
---

# the handover feature is built and off, and its ask is bounded per session

> Two things the owner must decide or do, both surfaced by `plan:handover seq:9`, 2026-08-29. Neither is a defect; both are choices an implementer correctly declined to make alone.
>
> **1. The feature is built and OFF, and only the owner can turn it on**
>
> `handover` is a top-level config key, absent by default, and **absent means the whole feature is off** — typed as `HandoverConfig | null`, so "not configured" is the type rather than a comment. Nothing in the repository enables it.
>
> To enable, in `.my_context/config.json`:
>
>     "handover": { "path": "reports/HANDOVER.md" }
>
> Defaults: `marker` `⏭`, `budgetTokens` 1200, `thresholdPercent` 98.
>
> **Two things to know before enabling.** `reports/HANDOVER.md` exists and carries **no `⏭` section**, so it would be delivered head-first until one is added. And `thresholdPercent` needs the status-line bridge installed, or the ask stands down — the strip already reports the bridge as absent.
>
> `requireHandover` refuses by name, without loading anything: an unknown sub-key (naming every offender and listing the four it accepts), a missing or empty `path`, a path absolute in EITHER platform's grammar or containing `..`, an empty `marker`, a `budgetTokens` that is not a positive integer, a `thresholdPercent` outside 1..100. Deliberately not a glob — a glob matching two handovers would need a picking rule nobody has written, so `*` simply resolves to a missing file.
>
> **2. The ask is bounded per SESSION, and a compaction does not reset it**
>
> `MAX_ASKS` is 2 and the latch lives with the session. After a compaction the same session continues with the same latch — so **a session that has already spent both asks is never asked about the refilled window**, which is exactly the window a handover exists to serve.
>
> Making it per-window means resetting the latch at `PostCompact`. That is a decision about what a compaction destroys, and it interacts with `plan:live seq:9`'s continuity tier, which already treats `snapshot.capturedAt` as the identity of a window. The implementer declined to take it and was right to.
>
> **The question**: is the ask a per-SESSION courtesy — asked at most twice, however long the session runs — or a per-WINDOW obligation, renewed each time the context is rebuilt? The second is more useful and more annoying, and the choice is a judgement about how much the product may nag.
>
> Note the shape it should probably take if the answer is per-window: the continuity tier already knows when a window is new. Two mechanisms deciding independently what a window is would be the two-spellings defect this project keeps meeting.
>
> **Done when**
>
> The owner has enabled the key or recorded a decision not to; and the per-session versus per-window bound is settled, with the window identity taken from the same place the continuity tier takes it rather than derived a second time.
