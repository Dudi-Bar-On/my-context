---
id: DEC-stop-speaks-once-and-only-to-raise-the-handover
type: decision
title: Stop speaks once, and only to raise the handover
status: active
severity: soft
always: false
summary: "The end-of-turn check stays silent except for one thing: asking, once, for a handover note when the conversation is nearly out of room."
summary_of: cd71285c554551af
scope: []
tags:
  - v2
  - owner-ruling
  - hooks
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 3f4535ea50011c88
---

# Stop speaks once, and only to raise the handover

Stop's additionalContext envelope has been left EMPTY on purpose since the ten observation hooks landed. observe.ts records the platform's own description of it -- "non-error feedback delivered to the model; the conversation continues so the model can act on it" -- and stop.ts records why this project does not use it: moving a nudge to the end of a turn changes what the product asks a model to do, on every turn of every session, in a direction nothing has measured. hooks seq:21 named the argument and did not rule.

THE OWNER ASKING FOR THE OCCUPANCY REQUIREMENT IS THAT RULING. It is taken NARROWLY:

- Stop speaks ONLY to raise the handover at the threshold. The emptiness stands for every other purpose and a second use needs its own decision.
- At most ONCE per session per threshold crossing, latched in state. A second ask after the model has written the handover is a loop, and a loop in a per-turn hook is the most expensive bug this design can ship.
- It never blocks. Stop runs on a 3-second timeout the platform genuinely waits on, so the read is one small file and a pure function -- no transcript scan, no directory walk, no spawn.

WHAT THIS DOES NOT LICENCE: the capture nudge is still on PostToolUse and is not moved. That question is still hooks seq:21's and is still the owner's.
