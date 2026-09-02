---
id: DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is
type: decision
title: the ask and the writing are two turns apart, so a flag is what tells them apart
status: active
severity: soft
always: false
summary: When the tool asks for a note to be written, it records when it asked, so it can later tell whether the note was written or the request was quietly ignored.
summary_of: e410e1902973f843
scope: []
tags:
  - v2
  - owner-ruling
  - hooks
  - handover
  - continuity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: f430dc97fc5ba49e
---

# the ask and the writing are two turns apart, so a flag is what tells them apart

OWNER DESIGN NOTE, 2026-08-27: "if you need to update handover triggered by a hook, and because the hook has timeout, you can do it async and maybe checking if it is already completed using for example a flag before compacting or clear".

IT NAMES A HOLE THE DESIGN HAD. `Stop` asks the model to update the handover at the threshold and latches so it asks only once. NOTHING VERIFIED THAT THE MODEL DID IT. A model that ignores the ask, or a compaction that fires mid-turn, leaves a stale handover and an audit row saying an ask went out -- which reads like the mechanism worked.

WHY A HOOK CANNOT JUST DO IT. The writer is the MODEL, not the hook: a handover is prose about what was decided and why, and no hook can produce that. So the two halves are inherently a turn or more apart, and `Stop`'s 3-second timeout is not a budget the work could ever fit in anyway. The mechanism is asynchronous by construction, and the owner's flag is how the two halves RENDEZVOUS.

THE FLAG IS NOT A CLAIM, IT IS A COMPARISON. The latch already records `askedAtThreshold`; adding the wall-clock `askedAt` lets `PreCompact` -- which runs BEFORE the compaction, on a 10-second timeout, and already resolves the handover -- compare the file's mtime against it:

  - written after the ask  -> the ask was ACTED ON
  - not written           -> the ask was IGNORED, and that is a fact worth having

That is a measurement rather than a belief, which is the same move that settled the threshold question: measure the thing, not its proxy.

WHAT IT UNLOCKS, and this is worth more than the check itself. The latch today says "asked once per threshold crossing". With the flag it can say "asked, and NOT YET SATISFIED" -- so an ignored ask can be repeated, which is correct while the window is still filling and is impossible to do safely without knowing the first one failed. Bounded: at most two asks, and the second one SAYS the first was ignored. A third would be nagging, and a hook that nags is a hook that gets uninstalled.

WHERE ELSE IT APPLIES: `SessionEnd` with `reason: 'clear'` is the other boundary that destroys a window, and it gets the same check. `PostCompact` is too late to matter -- it can only report.

AND THE SECOND READING OF "ASYNC", recorded because it is a real technique this project has not needed yet: a hook that genuinely must do slow work can spawn it DETACHED and unref it, the way `plan:upkeep seq:5` spawns the UI server. That is not what the handover needs -- its slow part is a model turn, not a process -- but the day a hook does need it, the shape is already ruled in.
