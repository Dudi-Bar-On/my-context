---
id: TASK-the-shell-owns-one-stream-and-screens-subscribe-to-it
type: task
title: the shell owns ONE stream, and screens subscribe to it
status: active
severity: soft
always: false
summary: Open one live connection for the whole page and let each screen listen in, rather than each screen opening its own.
summary_of: dd18ecb43e03768d
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a955d6229c8b0e0c
plan: live
seq: "1"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the shell owns ONE stream, and screens subscribe to it

`ctx.stream()` and `lib/sse.js` already exist and already work -- `watch.js` is the only caller. Lift the connection into the shell: opened once, shared, reconnected on nothing (the no-reconnect rule is deliberate and stays), and torn down with the page.

WHY ONE AND NOT ONE PER SCREEN: the idle monitor deliberately does not count an open stream as activity, so twenty-two connections would be twenty-two things the server is holding for a page that may be abandoned. And a screen that opens its own would have to solve the token, the fault and the teardown again -- three chances to be silently wrong, which is the argument `io.ts` makes about `hookContext` one layer down.

THE SUBSCRIPTION IS BY RECORD KIND, not by screen name: the shell fans out, and a screen that wants nothing costs nothing.

A DEAD STREAM MUST BE VISIBLE. The server exits after eight idle hours and a stream does not prevent it, so a page can sit frozen and look merely quiet. `watch.js` already draws a stream fault and the shell's version owes the same -- STD-a-measured-zero-is-drawn-and-named, on the surface where "nothing is happening" and "I stopped hearing" look identical.
