---
id: TASK-a-cleared-session-orphans-its-seen-file-and-only-sessionend
type: task
title: a cleared session orphans its seen file, and only SessionEnd carries the old id
status: active
severity: soft
always: false
summary: Clearing a conversation abandons the old one's bookkeeping file instead of cleaning it up, and nobody has decided whether that should be fixed.
summary_of: cd9f29b3ee058f4e
scope: []
tags:
  - "plan:hooks"
  - "seq:8q"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: a71996e6988ed7d4
plan: hooks
seq: 8q
state: done
priority: "1"
---

# a cleared session orphans its seen file, and only SessionEnd carries the old id

Measured by the clear probe, and it changes what the clear handler is FOR.

/clear mints a NEW session_id. The order on build 2.1.239: SessionEnd fires first with reason 'clear' on the OLD id, then SessionStart fires with source 'clear' on a NEW one. The id is replaced in a live mutable store before the payload is built, so the SessionStart payload reads the already-replaced id.

Consequence the decision table does not spell out: the clear branch can never reach the parent's seen file, because the old key is not in the payload it receives. The old session's dedupe state is ORPHANED, not cleared - it stays on disk until the 30-day sweep takes it.

And SessionEnd with reason 'clear' is the ONLY firing that carries the old id. mycontext registers no SessionEnd hook at all.

So there are two questions, and neither is answered:
1. Should mycontext register SessionEnd, so a cleared window's seen file is actually cleared rather than left to expire?
2. If not, is the current clear branch doing anything useful? It clears state for a session id that has just been created and therefore has none.

The probe agent flagged this as a design question rather than settling it, which was right.
