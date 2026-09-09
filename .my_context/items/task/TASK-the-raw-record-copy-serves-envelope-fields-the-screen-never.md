---
id: TASK-the-raw-record-copy-serves-envelope-fields-the-screen-never
type: task
title: "the raw record copy serves envelope fields the screen never draws, which seq:27 secrets scan did not cover"
status: active
severity: soft
always: false
summary: The third copy hands over the whole record, including fields the screen never shows, so the credentials question now covers a little more than it was measured against.
summary_of: 8620677eadd0aac3
scope:
  - src/ui/read-model-conversation-document.ts
tags:
  - v2
  - archive
  - ui
  - security
  - "plan:archive"
  - "seq:43"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 4598f513e83b7e49
plan: archive
seq: "43"
state: done
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

CLOSED 2026-09-09 WITH plan:archive seq:27, under the same ruling: the conversation’s content is
the owner’s property and his responsibility.

This item worried that the raw-record copy hands over `cwd`, `gitBranch`, `requestId` and absolute
paths off his machine. Under that ruling it is not a defect: the raw form exists precisely to be
the record EXACTLY AS CREATED - for reproducing a bug or feeding a tool - and a record with its
envelope quietly removed would be a different thing wearing the same name. plan:archive seq:17
ruled three copy formats named by purpose, and "the exact record" is the one whose purpose is
exactness.

AND IT IS NOT A WIDENING EITHER, which was this item’s actual claim: every one of those fields is
already on screen or already in a file in the reader’s own home. The copy moves nothing that was
not already movable.

The export case - a copy that leaves the project - is handled by seq:27’s successor rather than
here, and that is the right seam: a clipboard is the reader’s own hand, an export is a file
somebody else may open.

## Relations
- depends_on [[TASK-the-archive-already-serves-a-live-api-key-and-full-input]]
