---
id: TASK-the-row-where-a-lane-reports-back-cannot-say-whose-report-it
type: task
title: the row where a lane reports back cannot say whose report it is
status: active
severity: soft
always: false
summary: A finished helper agent is opened from the turn announcing it finished, not only from the turn that started it.
summary_of: 2acf9a38fb225ca5
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:49"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 7d4b676c2ecf3ef0
plan: archive
seq: "49"
state: todo
priority: "1"
needs: archive/28
---

# the row where a lane reports back cannot say whose report it is

Owner question 2026-09-09: "where a subagent occures in the viewer a link should open it’s file
directly from the viewer without browsing it’s file from the list". Checked, and the answer splits.

THE DISPATCHING STEP ALREADY LINKS. `laneLink` draws an anchor on the step that made the Agent
call, joined by `toolUseId`, opening the lane in the same renderer. plan:archive seq:15 built it and
seq:41’s roster is the SECONDARY route, for the 43 of 265 lanes dispatched from inside another lane
that have no step in his session to hang a link on.

THE ROW WHERE A LANE REPORTS BACK DOES NOT LINK, AND CANNOT AS THE READ MODEL STANDS. A synthetic
person-side turn carries `DocNodeBody.synthetic`, which is a LABEL STRING and nothing else -
"task-notification", "meta", "slash-command". `drawTurn` draws a chip from it. There is no agent id,
no `toolUseId`, nothing identifying WHICH lane finished. The row says a lane reported and cannot say
whose report it is.

AND THAT IS THE ROW A READER WOULD REACH FOR FIRST. The dispatching step is where the work was
ASKED for; the notification is where it came BACK. A reader scrolling their own session meets the
report, wants the reasoning behind it, and has to scroll back to find the Agent call - or open the
roster and match a description by eye.

── IT IS RECOVERABLE, AND MEASURED ─────────────────────────────────────────────────────────

On his own transcript:

    task-notification records         1,440
      carrying a <task-id>            1,437
      resolving to agent-<id>.jsonl     626
      no lane file                      811

The 811 are correct rather than broken: a task-notification also carries background SHELL commands
and MONITOR events, which have task ids and no agent file. Measured on the drawn synthetic turns
earlier: 175 `Agent "..." finished`, 24 `Background command`, 15 `Monitor event`.

AND THE DISCRIMINATOR ALREADY EXISTS - do not build a second one. seq:28’s `syntheticSpeaker` reads
the `<summary>` line to choose Subagent, Shell or no speaker at all. THE ROWS IT LABELS SUBAGENT ARE
EXACTLY THE ONES THAT SHOULD LINK. A row it labels Shell or leaves unnamed must not, and that
falls out of the existing function rather than needing a new rule.

── WHAT TO BUILD ───────────────────────────────────────────────────────────────────────────

Carry the id through: parse `<task-id>` from the payload seq:28 already recovered, and put it on the
node beside `synthetic` so `drawTurn` can reach `laneHref`. Then the Subagent row links with the
anchor `laneLink` already draws - same renderer, same new tab, same never-lost place.

FOUR THINGS TO GET RIGHT:
  - PREPEND `agent-`, AND KNOW WHY. The payload id is bare and the file carries the prefix. That is
    the same asymmetry plan:archive seq:48 exists for, and seq:48 normalises at the reader -
    reuse `laneKey` rather than writing a second prepend.
  - A MISSING LANE FILE IS A DISCLOSURE, NOT A DEAD LINK. 811 of 1,437 ids have no lane, and a
    pruned lane can vanish besides. `conv.doc.laneGone` already exists for exactly this and seq:15
    ruled three answers, never nothing.
  - DO NOT DOUBLE-LINK. If the dispatching step is on screen with its own link and the notification
    links too, that is two routes to one lane in one document. That is fine - they are different
    moments - but say so deliberately rather than discovering it.
  - THE SPEAKER MAPPING IS RULED AND MUST NOT MOVE. Subagent 175, Shell 24, none for the rest, You
    for the 23 slash commands, Claude never. A link is added to a row; the row’s name is his ruling.
