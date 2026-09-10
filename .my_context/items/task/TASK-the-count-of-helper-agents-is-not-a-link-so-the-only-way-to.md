---
id: TASK-the-count-of-helper-agents-is-not-a-link-so-the-only-way-to
type: task
title: the count of helper agents is not a link, so the only way to browse them is the terminal
status: active
severity: soft
always: false
summary: The helper agents a conversation used can be listed and opened from the browser, instead of the number being the end of the trail.
summary_of: 0cad41ac44622cef
scope:
  - src/ui/read-model-conversations.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:41"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 66ba1f68ee6f8482
plan: archive
seq: "41"
state: done
priority: "1"
needs: archive/12
verified_on: 2026-09-10
---

# the count of helper agents is not a link, so the only way to browse them is the terminal

OWNER QUESTION 2026-09-09: "could the user see the list of subagents context files and can view
them as we do for a session ?"

MEASURED, AND THE ANSWER IS PARTLY - which is why this is an item rather than a reply.

  VIEW ONE LANE           YES. `#/conversations/agent-<id>` renders in the same viewer as a session
                          - markdown, code colouring, folds, the whole renderer. `rowFor` resolves
                          a lane, so plan:archive seq:12 got this for free.
  LIST THEM IN THE CLI    YES. `mycontext conversation subagents` prints agent, depth, type,
                          records, size, dispatched by and description, for all 255.
  LIST THEM IN THE UI     NO. The list row draws a COUNT - `conv.lane` / `conv.lanes`, "253 helper
                          agents" - and that count is NOT A LINK. `laneIndex` builds a map keyed on
                          `toolUseId` for the step links; it is not a list surface.

SO THE GAP IS EXACTLY ONE HOP. Everything needed already exists: the endpoint
`GET /api/conversations/:id/subagents` answers the whole roster with depth and parent, the renderer
takes a lane id, and the count is already on the row. What is missing is a way to get from the
count to the roster without leaving the browser for a terminal.

AND THE ROSTER IS THE ONLY PLACE SOME LANES CAN BE REACHED AT ALL. A lane is linked from the step
that dispatched it - but 43 of 255 were dispatched from INSIDE another lane, so reaching those means
first finding and opening the parent lane and then finding the step. A reader who wants "the lane
that ran the doctor sweep" has no route to it except the CLI.

WHAT TO DECIDE RATHER THAN ASSUME:

  - WHERE THE ROSTER LIVES. A third screen, a panel on the conversation, or a filtered view of the
    existing list. plan:archive seq:12 deliberately kept lanes OUT of the sessions list, on a
    measurement: 253 lanes against 2 sessions would bury both real conversations. That argument is
    about the DEFAULT list and does not forbid a roster reached deliberately - but whatever is built
    must not undo it.
  - WHAT A ROSTER ROW SAYS. The CLI already chose: agent, depth, type, records, size, dispatched by,
    description. That is a good starting set and the description is what makes a row identifiable at
    all - it is the lane’s own brief, and plan:archive seq:24 now captures the whole prompt behind
    it.
  - DEPTH. 212 at depth 1, 43 at depth 2. A flat list of 255 loses the fact that a fifth of them
    were dispatched by another lane; a tree makes the common case (depth 1) harder to scan. Say
    which and why.

ONE THING TO MEASURE FIRST: what a roster of 255 rows costs to draw. The sessions list is 2 rows,
so nothing on this screen has been asked to render a long list yet, and the document’s
virtualisation is per-RECORD rather than per-row. 255 rows is probably nothing - but "probably
nothing" is what the 160-character detail cap was, and it had never once fired.
