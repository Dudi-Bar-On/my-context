---
id: TASK-the-raw-record-copy-serves-envelope-fields-the-screen-never
type: task
title: "the raw record copy serves envelope fields the screen never draws, which seq:27 secrets scan did not cover"
status: active
severity: soft
always: false
summary: The third copy hands over the whole record, including fields the screen never shows, so the credentials question now covers a little more than it was measured against.
summary_of: 9c10ddade0734cc0
scope:
  - src/ui/read-model-conversation-document.ts
tags:
  - v2
  - archive
  - ui
  - security
  - "plan:archive"
  - "seq:43"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 53c186bb0955b962
plan: archive
seq: "43"
state: todo
priority: "2"
needs: archive/27
---

# the raw record copy serves envelope fields the screen never draws, which seq:27 secrets scan did not cover

Filed 2026-09-09 by the lane that built `TASK-a-selected-passage-copies-as-something-a-terminal-will`,
whose third form is *"the JSONL exactly as created, for reproducing a bug or feeding a tool"*. It is
served by `GET /api/conversations/:id/raw`, which reads a BYTE SLICE of the transcript between two
offsets the outline already holds.

WHAT IT ADDS TO WHAT `TASK-the-archive-already-serves-a-live-api-key-and-full-input` MEASURED, and
it is narrow rather than large. That item's finding is about `command` inputs and `tool_result`
TEXT, both of which the document has drawn on screen since the caps were removed. The raw slice
serves NO text those do not. What it adds is the ENVELOPE around them - `cwd`, `gitBranch`,
`userType`, `requestId`, `sessionId`, `parentUuid`, `uuid`, `version` - which the read model parses
and the screen never draws.

WHY THIS IS SMALL BUT NOT NOTHING. None of those fields is a credential shape, and the 1.7 GB scan
`seq:27` ran was over the whole of every transcript on the machine rather than over the fields the
screen happened to show, so the thirteen shapes it hunted were already hunted here. What changes is
that a copy taken from this button is now a FILE-SHAPED artefact a person can paste into an issue,
and it carries absolute paths from the reader's own machine which the screen deliberately does not.
`plan:archive seq:4`/`seq:5` are an EXPORT that leaves the machine, and this is a smaller door of
the same kind.

WHAT TO DECIDE, and it belongs with `seq:27` rather than beside it, because a second redaction
policy for one product would be the defect this corpus keeps recording:

  - Whether the raw form is redacted at all, given that it is defined as being exact. A redacted
    "exact record" is a contradiction, and `INV-nothing-is-dropped-silently` would require it to say
    so - at which point it is no longer JSONL a tool will take.
  - Whether the answer is instead a WARNING at the point of the copy, which is cheap and does not
    break the format: the screen already carries `conv.sensitive` in the feature's own help.
  - Whether the route should exist for an EXPORTED copy at all, where the transcript is already a
    file the reader chose to keep.

MEASURED, so the size of the door is on the record: the route reads with `openSync(file, 'r')` and
`readSync`, refuses any slice over 8 MB rather than truncating, and is in
`test/ui/server-e2e.test.ts`' read-only sweep, which snapshots every byte under the workspace and
compares it after exercising every registered route.

## Relations
- depends_on [[TASK-the-archive-already-serves-a-live-api-key-and-full-input]]
