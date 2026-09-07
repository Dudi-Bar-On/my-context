---
id: TASK-an-exported-conversation-opens-in-the-viewer-marked-as
type: task
title: an exported conversation opens in the viewer, marked as exported
status: active
severity: soft
always: false
summary: A session kept outside the project opens in the same viewer as a live one, and says which it is.
summary_of: e5cc162529632a6f
summary_was:
  - 2026-09-07 A copy taken earlier can be read back, and never looks like a live session.
scope:
  - src/ui/public/screens/**
  - src/core/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 2cc270a8225a0236
plan: archive
seq: "5"
state: todo
priority: "3"
---

# an exported conversation opens in the viewer, marked as exported

Step 5 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md, and the last.

The owner asked for the viewer to display an exported conversation distinguished from the
internal one saved under the Claude directory. A copy that looks identical to a live session
is worse than no copy, because a reader cannot tell which they are acting on.

Exports are indexed and listed BESIDE live sessions, marked and dated. That was decided
rather than assumed: an export you cannot find again is not a copy, it is a file. The source
column already exists to carry the distinction.

The accepted cost, stated in the spec: the list stops being a pure mirror of what the harness
holds and becomes a list of what the OWNER holds, which was judged the more useful thing.

Whatever marks an export must survive being looked at quickly. A subtle tint is not a mark.


─────────────────────────────────────────────────────────────────────────────
RE-CUT 2026-09-07 BY OWNER RULING, to follow seq:4 becoming PERSISTENCE.
─────────────────────────────────────────────────────────────────────────────

ONE VIEWER, TWO SOURCES - that was his reason for asking for this at all: "we could use THE SAME
BROWSER to go over a session even if the original file is not available anymore". So a persisted
session is not a second screen and not a second renderer. It is the same list row and the same
transcript view, reading a different file.

AND IT IS NOW LOAD-BEARING RATHER THAN A NICETY, because seq:11 was ruled the other way: a session
whose original file is deleted DISAPPEARS from the list. So the persisted copy is the ONLY thing that
can keep it visible. Without this task, "marked persistent" is a promise the product does not keep.

THE MARK MUST SAY WHICH IT IS, and the machinery is already half-built: the screen draws an exported
mark against `source !== 'live'` (conversations.js), and nothing can yet produce a non-live source.
The index carries a `source` column already. So this is wiring an existing drawing to a real value,
not designing a new one.

SAY WHAT IS TRUE ABOUT COMPLETENESS. Three states must be distinguishable at a glance and must not
blur: LIVE (the original file is there), PERSISTED AND CURRENT (mirror is caught up with a file that
still exists), PERSISTED AND ORPHANED (the original is gone; this is all there is). A mirror that
started late is a fourth - see seq:4. Blurring these is the same class of error as a screen that
cannot tell an absence from an unmeasured value.
