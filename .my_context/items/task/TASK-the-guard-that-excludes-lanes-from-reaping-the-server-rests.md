---
id: TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests
type: task
title: the guard that excludes lanes from reaping the server rests on a field that is sometimes absent
status: active
severity: soft
always: false
summary: The owner's server died again after the fix, and the reason the last lane gave for ruling lanes out cannot be checked from the record it checked it against.
summary_of: 8587f7afec5a3cf8
scope:
  - src/core/ui-server-upkeep.ts
  - src/hooks/stop.ts
tags:
  - ui-server
  - upkeep
  - "plan:live"
  - "seq:25"
  - "state:todo"
  - v2
origin: human
source_file: "C:/Program Files/Git/reap-body.md"
source_anchor: null
source_checksum: bbe08607473ef9fa
valid_from: 2026-09-12
valid_until: null
checksum: 97c9d1b8f1b86b1c
plan: live
seq: "25"
state: todo
priority: "1"
---

# the guard that excludes lanes from reaping the server rests on a field that is sometimes absent

> FILED 2026-09-12 00:20Z, AFTER THE FIX FOR `TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement` WAS ALREADY LIVE. That fix was committed at 00:02Z. At 00:10:29Z the owner's server went down again and stayed down until it was started by hand at 00:12Z. So the fix did not hold, and the next change to this mechanism must be preceded by a MEASUREMENT rather than a fourth hypothesis.
>
> WHY THIS ITEM EXISTS RATHER THAN A PATCH. The lane that wrote the last fix produced three confident conclusions and its first one is now in doubt. It said: "Lanes are not reaping. `stopUpkeep` already declines on `input.agent_id !== undefined` -- spec section 7, subagents excluded. All 15 `stop` rows since 20:00Z carry ONE sessionId and no agent marker. Lanes contributed zero restarts." That argument reads the audit AFTER the guard has already declined, so a firing the guard let through would be indistinguishable in it from the dispatcher's own.
>
> THE OBSERVATION THAT PUTS IT IN DOUBT, and it is an observation, not a finding. Tonight's audit carries repeated rows of the form `subagent-stop-untyped ... type=<absent> (no agent_type on this firing -- not a named lane; no step backfill will be attempted)`. There are firings arriving at the stop path with NO AGENT TYPE. If `agent_id` is absent on those same firings, the guard the fix rests on does not decline, and a lane's hook runs `upkeepUiServer`.
>
> AND THE SHAPE OF TONIGHT'S DEATHS FITS THAT. The 00:10:27Z replacement MINTED ITS NONCE, BOUND THE PORT AND WROTE ITS LIVENESS RECORD AT 00:10:27.988Z -- and was dead by 00:10:29Z, about one and a half seconds later. It did not fail to start. It started and then died, which is what a child does when the process tree that made it goes away. Every server that survived tonight was one started by hand with PowerShell `Start-Process`; every hook-spawned one died in roughly a second.
>
> ONE SIMPLER EXPLANATION IS ALREADY RULED OUT, so nobody re-tests it: a detached `unref`ed child DOES outlive its parent in this environment. Measured -- a child spawned exactly the way `startServer` spawns one, from a parent that then exited, was still alive afterwards. So `detached: true` is not the problem in the general case, and the question is specifically about the process tree a HOOK runs in.
>
> AND ONE FACT NOBODY HAS EXPLAINED: the 00:10:27Z restart wrote NO `stop` audit row at all, while `stop.ts` is what writes them. Something started a server through a path that does not record one. `nonce-minted` at 00:10:27 carries `who=hook`.
>
> WHAT THIS ITEM ASKS FOR, IN ORDER, AND THE FIRST STEP IS NOT A FIX:
>
> 1. MEASURE THE INPUT. Establish what `input.agent_id` actually is on a firing that the audit records as `subagent-stop-untyped`. Not inferred from the audit row, which is written downstream of the guard -- read at the guard. If it is `undefined`, the guard does not exclude lanes and the previous lane's first conclusion is false.
>
> 2. ESTABLISH WHO STARTED THE 00:10:27Z SERVER, given that no `stop` row exists for it. Enumerate every path that can reach `startServer`, and find which of them writes no audit row.
>
> 3. MEASURE WHETHER A HOOK'S SPAWNED CHILD OUTLIVES THE HOOK. Specifically inside a hook process, not from a shell -- the general case is already answered and is not the question.
>
> 4. ONLY THEN decide the change. If lanes do reap, the guard needs to be on something a firing cannot omit rather than on a field that can be absent. If hook children cannot survive, then no ordering fix can help and the spawn has to escape the tree the way the hand-started ones do.
>
> THE STANDING CONSTRAINT APPLIES THROUGHOUT: the server on 58888 is the owner's. Nothing here kills, replaces or rebinds it. Verify in process; if a measurement needs a server of its own, it takes another port.
>
> THE PREVIOUS LANE'S OTHER TWO CORRECTIONS STAND AND ARE NOT RE-OPENED: staleness is measured against the working tree and not HEAD, so committing changes nothing; and the five restarts were 6 to 14 minutes apart, so the spawn floor was holding and it was not a stampede.
