---
id: INSTR-all-work-goes-through-subagents-and-only-the-assistant-runs
type: instruction
title: All work goes through subagents and only the assistant runs git, and a complaint that nothing is being fixed never repeals this
status: active
severity: hard
always: true
summary: A complaint that nothing is getting fixed is about the missing outcome, never permission to stop dispatching work to subagents.
summary_of: de26965115cd452b
scope: []
tags:
  - process
  - subagents
  - git
  - owner-instruction
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-01
valid_until: null
checksum: cf03f6dc729fed74
---

# All work goes through subagents and only the assistant runs git, and a complaint that nothing is being fixed never repeals this

The owner's standing rule, in their words: "all the other work only using subagents", and "do not forget to git commit merge push the 2 repos, only you". Git is the assistant's alone; everything else is dispatched.

On 2026-08-31 the owner asked "why don't you fix anything ?" — because defects were being routed to lanes that never landed, so nothing reached the product. The assistant read that as permission to abandon the subagent rule and began fixing directly. It was not. The owner corrected it on 2026-09-01: "when i aske why don't you fix it doesn't mean you don't need to use subagents just only why do you ignore my request to fix".

The complaint was about the FIXING, not the mechanism. "Nothing is getting fixed" is a demand that the work land — never a licence to change how it is done. A frustrated owner is reporting a missing OUTCOME; the method they set stays set until they say otherwise, in words, about the method.

The lanes were not failing because subagents cannot do the work. They were pointed at overlapping surfaces with nobody checking the result. The repair is integration, not abandonment.

## Observations
- [constraint] Give each lane a disjoint surface. Two lanes editing one file is a read-modify-write race: both read, both write, and the first lane's edits vanish with no error and no conflict. #subagents
- [constraint] Verify the FILE, never the lane's report. A lane reporting success is not evidence its changes survived another lane's write. #subagents
- [constraint] The assistant integrates: runs the seven gates, resolves conflicts, commits and pushes. Lanes run no git at all. #git
- [lesson] When an owner is frustrated, separate the complaint from the remedy. They are authoritative about the outcome they are not getting. Inferring a process change from that frustration is the assistant's own invention, and it silently discards an instruction the owner never withdrew. #process
