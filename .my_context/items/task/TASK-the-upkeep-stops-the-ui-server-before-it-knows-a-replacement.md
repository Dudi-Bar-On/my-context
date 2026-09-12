---
id: TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement
type: task
title: the upkeep stops the UI server before it knows a replacement will start
status: active
severity: soft
always: false
summary: The background upkeep that keeps the web UI running can stop the running server and then fail to start its replacement, leaving nobody with a server at all.
summary_of: 35d97ed22b4a5d7b
acknowledged:
  - tag_projection_unprojected@ceec96965d2974c9
  - task_unverified@ceec96965d2974c9
scope: []
tags:
  - ui-server
  - upkeep
  - "plan:live"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 1b6c40e499fa66f0
state: done
---

# the upkeep stops the UI server before it knows a replacement will start

MEASURED 2026-09-11, 23:00-23:20Z. The owner's UI server on 58888 was replaced five times in 39 minutes (22:35:12, 22:41:19, 22:49:34, 23:00:21, 23:14:24 UTC, every one an audit 'stop' row saying 'reported its own code stale, so it was stopped and started again'), and at 23:18 nothing was listening on 58888 and no liveness record existed.

Three things are wrong and they are separable.

FIRST, restartStaleServer stops the old server and then starts the replacement, and nothing in the call ever learns whether the replacement bound the port. A spawn that dies leaves the owner with nothing, and the next attempt is gated behind the five-minute spawn floor and behind some session firing a Stop hook at all.

SECOND, nothing stops two concurrent hooks replacing the same server. The kill targets a pid the probe proved alive before a three-request freshness exchange, which is a wide window; by the time the signal is sent another hook may already have put a new server on that port, and this one kills it.

THIRD, a stale stand-down gates the COLD spawn. stood-down-stale means 'something is serving and will not be replaced' - it is not evidence that a spawn would fail - yet once it is set, a server that later dies is never put back. The state file tonight already held consecutiveSpawnFailures 1 of the 3 that reach it.

The shape of the fix: never stop a server you cannot replace. A server on slightly stale code is strictly better than no server, and the product already discloses that state.

## Observations
- [note] Filed by the lane that measured it; work against this item, not against the account it was dispatched with.
