---
id: TASK-the-conversation-archive-is-taught-so-the-roster-stops-being
type: task
title: the conversation archive is taught, so the roster stops being red
status: active
severity: soft
always: false
summary: The new way of reading past conversations gets written up, in both languages, like every other feature.
summary_of: a7ea26d25054ed2e
scope:
  - docs/tutorials/**
  - scripts/build-tutorial-manifest.ts
tags:
  - v2
  - docs
  - tutorials
  - "plan:archive"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 7fbb675fa8dacf38
plan: archive
seq: "6"
state: todo
priority: "2"
---

# the conversation archive is taught, so the roster stops being red

Filed 2026-09-07, overnight, as the ONE known-red thing left by the archive lane.

test/core/tutorial-manifest.test.ts is 5 of 7. Two assertions fail: "every CLI command file is
claimed by exactly one tutorial" names conversation.ts, and "every UI screen file is claimed by
exactly one tutorial" names conversations.js.

THIS IS A REAL COVERAGE REQUIREMENT AND NOT BOOKKEEPING, which is why it was not closed by editing
the manifest. REQ-the-ui-serves-and-browses-the-tutorials says the tutorials cover every capability
from both surfaces, one tutorial per FEATURE. Adding conversation.ts to a roster without writing
the section would make the manifest assert coverage that does not exist - the precise class of
false claim this project measures in days, and the one the tutorial roster was built to prevent.

WHERE IT BELONGS: sessions-and-continuity, on the evidence of what it already claims - handover.ts,
session.ts, and the three session slash commands. Reading past conversations is the same subject as
carrying work between them. Its cli list gains conversation.ts and its screens list gains
conversations.js, in scripts/build-tutorial-manifest.ts, and the manifest is REGENERATED rather
than hand-edited.

WHAT THE SECTION HAS TO SAY, and one part of it is not obvious: the list reports "1 asked, 2
answered, 2 tool steps" while the transcript below shows 6 entries, because the index counts only
user and assistant records and the transcript also shows book-keeping rows. Both numbers are
accurate and they are not the same denominator. A reader who notices will think one of them is
broken unless the tutorial says so first.

BOTH LANGUAGES, and the Hebrew now follows the convention ruled the same night: dir attributes,
never RLM marks - see the decision from D8 and scripts/convert-hebrew-bidi-marks.ts. A Hebrew
tutorial written in the old convention would be the only file in the family carrying marks the
test now forbids.

AND THE COMMANDS IN IT ARE RUN, NOT COMPOSED. Every command and every block of output in these
tutorials was executed against a fixture; gen-doc-examples.ts is the mechanism. A pasted-looking
transcript nobody re-runs is what this family of documents exists to not be.
