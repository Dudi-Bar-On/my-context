---
id: DEC-the-handover-is-delivered-by-sessionstart-because
type: decision
title: the handover is delivered by SessionStart, because PostCompact cannot speak to the model
status: active
severity: soft
always: false
summary: The note carrying work forward is read out at the start of the next session, because the moment the old one ends cannot say anything the assistant will hear.
summary_of: 1327c82b42016bcc
scope: []
tags:
  - v2
  - owner-requirement
  - hooks
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ee304c28425821de
---

# the handover is delivered by SessionStart, because PostCompact cannot speak to the model

The owner asked for the handover to be read "on post compact hook". IT CANNOT BE, and the reason is a property of the platform rather than a preference.

PostCompact declares no hookSpecificOutput variant in build 2.1.239, so anything written to its stdout becomes a USER-FACING BANNER appended to the compaction message. The model never sees a byte of it. Reading a handover into a hook that cannot speak to the model is reading it into a void.

SessionStart's stdout is appended to the model's context VERBATIM, which is why io.ts deliberately excludes SessionStart from the envelope union -- wrapping it would deliver the JSON itself into context. Its registered matcher is startup|clear|resume|compact|fork, so the compaction case is already dispatched and already builds a block. The handover joins that block rather than opening a second injection path.

SO THE WORK IS SPLIT ALONG WHAT EACH EVENT CAN DO. PostCompact RESOLVES the handover and records what it found in the audit row it already writes. SessionStart DELIVERS the bounded block. That is not a workaround; it is the shape the injection tiers already have -- the hook that knows something records it, the hook that can speak says it.

DELIVERED ON EVERY SOURCE EXCEPT resume, which is the only one that keeps the window it already had. A resumed session that has its context does not need telling what it is doing; one just compacted, cleared or started does. Taken here rather than left open, because the alternative is a config key nobody would ever change.
