---
id: TASK-a-pruned-session-s-lane-rows-are-never-swept-so-an-exported
type: task
title: a pruned session's lane rows are never swept, so an exported document names lanes that are gone
status: active
severity: soft
always: false
summary: removeMissingSubagents only runs for sessions found on disk, so the lane rows of a session whose transcript is gone stay in the index for ever and an exported document draws a 'gone' link for each of them.
summary_of: 8c55965196deb7b1
scope:
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - "plan:archive"
  - "seq:35"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 3b88da4b2b33d3cb
plan: archive
seq: "35"
state: todo
---

# a pruned session's lane rows are never swept, so an exported document names lanes that are gone

Found by `plan:archive seq:4`/`seq:5` while making `source = 'exported'` reachable, and NOT fixed
by that lane because the fix is a ruling about what an archive should hold rather than a
mechanical repair.

WHAT IS TRUE, read off the code rather than suspected. `ConversationIndex.removeMissingSubagents`
is SCOPED TO ONE SESSION and its own docblock argues why: `rebuildConversations` only lists the
`subagents/` directory of the sessions it FOUND, so sweeping globally on that knowledge would
delete every lane of a session whose own transcript had just been pruned — "knowledge leaving the
archive to a walk that never looked". That argument is right.

THE CONSEQUENCE IT DID NOT HAVE UNTIL NOW. Before `seq:4`, a pruned session left the index
entirely (`removeMissing`), so its orphaned lane rows were unreachable and harmless. A PERSISTED
session is now deliberately spared by `removeMissing`, so the row stays — and its lane rows stay
beside it, for ever, describing files that may have been deleted at any point since.

WHAT A READER SEES. `apiConversationSubagents` answers the roster from those rows;
`summariseSubagent` stats each file at request time, so `present` is `false` and
`screens/conversations.js`' `laneLink` draws `conv.doc.laneGone` — "no longer on disk, so there is
nothing to open". That is HONEST and is not a defect. Two things about it are:

  - `ConversationSummary.subagents` counts the rows, so the list row for an exported session says
    "N helper agents" about lanes none of which can be opened. The number is true of the recording
    and false of what the archive holds.
  - The rows never leave. `conversation forget` drops them wholesale, and nothing narrower does.

THE FORK, and it is a real one. Either (a) an exported session's lane rows are swept on the pass
that orphans it — cheap, and it discards the only remaining record that those lanes ever ran; or
(b) they are kept and the list row learns to say how many of its lanes are still openable, which
is one extra `stat` per lane per list request and is a cost the list currently does not pay; or
(c) the mirror grows to include lanes, which was measured and rejected — 615.3 MB of lanes against
65 MB of session in this workspace, 2026-09-08.

(b) is the one that drops nothing, and it is the one this lane would have taken if the cost of
statting a roster on the list path had been measured. It has not been. Measure it first.
