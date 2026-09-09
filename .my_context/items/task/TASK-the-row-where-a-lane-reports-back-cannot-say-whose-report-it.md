---
id: TASK-the-row-where-a-lane-reports-back-cannot-say-whose-report-it
type: task
title: the row where a lane reports back cannot say whose report it is
status: active
severity: soft
always: false
summary: A finished helper agent is opened from the turn announcing it finished, not only from the turn that started it.
summary_of: 8a1d79dea30a28f9
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:49"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 9a739eef3447fa81
plan: archive
seq: "49"
state: done
priority: "1"
needs: archive/28
---

# the row where a lane reports back cannot say whose report it is

Owner question 2026-09-09: "where a subagent occures in the viewer a link should open it's file
directly from the viewer without browsing it's file from the list". Checked, and the answer split:
the DISPATCHING step already linked (seq:15's `laneLink`, joined by `toolUseId`); the turn where the
lane REPORTED BACK did not and could not, because `DocNodeBody.synthetic` is a label string and
carries no agent id. That is the row a reader reaches first - the report, not the request.

SHIPPED 2026-09-09, commit 8f281670. `taskId` reads the `<task-id>` out of the payload seq:28
already recovers and `shapeOf` puts it on the node as `DocNodeBody.lane`, BARE. `laneIndex` gains a
`byAgent` map keyed through `laneKey`, and `laneReport` draws the anchor `laneLink` already draws -
same renderer, same new tab, same never-lost reading position. NO NEW STRINGS: `conv.doc.lane`,
`conv.doc.laneGone` and `conv.doc.laneNotKept` all already existed, so neither table grew.

THE FOUR THINGS, AS DECIDED.
  - `agent-` IS PREPENDED ONCE, at the reader, by `laneKey` - seq:48's asymmetry, not a second
    prepend. The read model serves the id exactly as the payload wrote it.
  - THE DISCRIMINATOR IS THE ONE THAT EXISTED. `lane` is set only where `syntheticSpeaker` already
    ruled `subagent`. A Background command row and a monitor tick carry a `<task-id>` too, so a
    Shell row cannot link because it carries nothing to link WITH, and the speaker mapping did not
    move: Subagent, Shell, none, You for the slash commands, Claude never.
  - THE DOUBLE LINK WAS TAKEN DELIBERATELY. 158 of the 159 distinct lanes that report back in his
    session are depth 1 and therefore also reachable from their dispatching step, so the document
    now holds two routes to one transcript. They are different MOMENTS - where the work was asked
    for, and where it came back - and suppressing one would need "the other is on screen", which a
    virtualised document of 10,399 nodes cannot honestly know.
  - A MISSING LANE IS DISCLOSED. `conv.doc.laneGone` for a lane that is not in the roster,
    `conv.doc.laneNotKept` in a copy that kept no lanes, and silence only when the roster never
    loaded - which the page already says once at the top. Never a dead link.

MEASURED ON HIS OWN TRANSCRIPT, 2026-09-09, 35,008 records and 10,399 nodes (the file has grown
since this item was written; the shape held). 187 Subagent rows; 187 carry an id; 187 resolve to a
lane on disk; 0 disclose a missing one - so the disclosure path is real and fires on nothing he
owns today. 159 DISTINCT lanes behind those 187 rows, because a task id notifies more than once and
the payload says so itself in a `<note>`. Roster: 271 lanes, 0 missing, 0 unlinked.

EVIDENCE. `npm test` 7,239 tests, 7,235 pass, 2 fail - both the known `statusline-chain`
contention pair, which pass alone. `e2e/conversations.spec.ts` 140 passed on chromium AND chrome,
including a new browser test that proves three rows at once: a lane's report links, a report naming
a lane that is not there SAYS SO, and a Background command carrying the SAME id that resolves on
the first row does not link. Then his real session driven end to end on both projects - Chromium
151.0.7922.34 and Chrome 151.0.7922.174 - in English and Hebrew: the row reads
`Subagent | Background task finished | 2026-09-03 03:14 GMT+3 | Open this agent's transcript in a
new tab - 167 records`, the anchor carries `target=_blank rel=noopener`, clicking it opened
`#/conversations/agent-a996c4fb38c4e4833` in a new tab while the reader's own URL never moved, and
the lane document drew its own head.
