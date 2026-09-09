---
id: TASK-a-lane-is-named-by-what-it-did-and-never-by-what-it-is-so
type: task
title: a lane is named by what it did and never by what it is, so the terminal name is missing
status: active
severity: soft
always: false
summary: A helper agent shows the kind of agent it is beside what it was asked to do, matching the name you already recognise from the terminal.
summary_of: 1a6d700a874caf71
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/read-model-conversations.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:50"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: f04f6fb7ddc7b2bd
plan: archive
seq: "50"
state: todo
priority: "1"
needs: archive/15
---

# a lane is named by what it did and never by what it is, so the terminal name is missing

Owner report 2026-09-09, having clicked through to a lane successfully: "near the agent there was no
name like the names i see on the terminal that mostly starts with general purpose".

WHAT HE MEANS IS THE AGENT TYPE, NOT THE DESCRIPTION, and that distinction is the whole item. The
terminal names a lane by its KIND first - general-purpose - and this viewer never draws the kind at
all. My first reading was that the description was missing; measured, all 223 Agent tool_use blocks
carry one, and DETAIL_FIELDS already surfaces it because an Agent call has no `command` so
`description` wins. So the thing he recognises from the terminal and cannot find here is the TYPE.

AND IT IS ALREADY SERVED. `mycontext conversation subagents` prints it as its own column - measured,
every row reads general-purpose - so agentType comes off the sidecar and through
/api/conversations/:id/subagents to laneIndex without anything new being read.

WHERE IT BELONGS: beside the link on the dispatching step, and on a roster row. seq:41 roster
already draws type; the DOCUMENT does not, which is where he was looking.

TWO THINGS TO GET RIGHT:
  - TYPE AND DESCRIPTION ARE DIFFERENT FACTS AND BOTH ARE WANTED. The type says what kind of worker
    it is; the description says what this one was asked to do. The terminal shows both, and a row
    showing only one is the state he is reporting. Draw them as two fields rather than
    concatenating them into a sentence.
  - EVERY LANE IN THIS CORPUS IS general-purpose, WHICH MAKES THE FIELD LOOK USELESS AND DOES NOT
    MAKE IT SO. Measured on his own roster: every row. A field constant today is still the field
    that tells an Explore lane from a Plan lane the day one appears. Do not conclude from one
    uniform corpus that it carries nothing.
