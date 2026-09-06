---
id: DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is
type: decision
title: the ask and the writing are two turns apart, so a flag is what tells them apart
status: deprecated
severity: soft
always: false
summary: "Superseded: the two-ask bound assumed the window stops changing between asks, and measurement showed it does not."
summary_of: 390d37bca7855800
summary_was:
  - 2026-09-06 When the tool asks for a note to be written, it records when it asked, so it can later tell whether the note was written or the request was quietly ignored.
scope: []
tags:
  - v2
  - owner-ruling
  - hooks
  - handover
  - continuity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: 2026-09-06
checksum: d966420ffb55bed8
---

# the ask and the writing are two turns apart, so a flag is what tells them apart

SUPERSEDED 2026-09-06 by the owner instruction recorded in
TASK-the-handover-is-asked-for-again-at-every-percent-not-written, and by the change that landed
the same day. Kept rather than rewritten, because what it decided and why it was reversed are both
worth reading.

WHAT IT SAID: the ask is bounded at two per context window - "at most twice... there is no third" -
on the reasoning that a third ask about the same state teaches nothing and a mechanism that nags is
one people learn to ignore. That reasoning was sound and is not what changed.

WHAT CHANGED IS THE PREMISE. The bound assumed the state does not move between asks. It does. The
audit log measured handovers written at 85% and then carried 2h39m, 1h24m and 3h06m to windows that
died at 99.9%, 96.1% and 96.6% - every row reporting acted-on, because acted-on proves ORDERING and
not currency. A percentage step is not the same state: one percent of a 1M window is roughly ten
thousand tokens the standing handover does not describe.

SO THE BOUND IS NOW PROGRESS-BASED rather than count-based: one ask per whole percent crossed, from
the threshold to 100 - naturally capped at sixteen, each one earned by real growth rather than by a
turn passing. MAX_ASKS is gone and askStep replaced it.

The anti-nagging instinct survives intact in the new shape: an ask never repeats INSIDE the percent
it was made in, which is the thing this decision was actually protecting.
