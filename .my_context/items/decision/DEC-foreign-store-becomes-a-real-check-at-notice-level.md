---
id: DEC-foreign-store-becomes-a-real-check-at-notice-level
type: decision
title: foreign_store becomes a real check, at notice level
status: active
severity: soft
always: false
summary: The health check should tell you when something else on the machine is also storing the kind of knowledge this tool holds, as information and not a problem.
summary_of: dd411296ea90f0b4
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:doctor"
  - doctor
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 69fc116407ff8a03
---

# foreign_store becomes a real check, at notice level

OWNER RULING, 2026-08-25, in the doctor walkthrough.

The mockup s notice card draws two `foreign_store` rows -- "a second cross-project knowledge store exists on this machine" and "another plugin writes durable learnings here". `foreign_store` APPEARS IN ZERO FILES under `src/`. The doctor has no such check.

THE RULING: build it, at `notice`.

THE REASON: it answers a question nothing else in this tool asks -- is something ELSE on this machine holding the knowledge my_context is supposed to hold? A second store is not an error and not a warning; it is a fact the user should know and decide about. `notice` informs without nagging, which is why the design put it there.

WHAT WAS WEIGHED AGAINST IT: dropping it from the mockup, on the grounds that nobody built it. Declined for the same reason the PROPOSED ruling was taken earlier the same day -- deleting a designed feature because it is unbuilt is closing a gap by editing the specification.

ONE THING IS NOT DECIDED and is filed as an open question: WHERE the check is allowed to look. It reads outside the repository, which no other check does.
