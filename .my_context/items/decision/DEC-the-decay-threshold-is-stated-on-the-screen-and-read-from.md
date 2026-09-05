---
id: DEC-the-decay-threshold-is-stated-on-the-screen-and-read-from
type: decision
title: the decay threshold is stated on the screen and read from the config, not written into the prose
status: active
severity: soft
always: false
summary: Decay says what cold means, in the open, taking the number from the running configuration so it cannot go stale.
summary_of: 8f37c136c7a9a1ef
scope: []
tags:
  - v2
  - ui
  - walk
  - decay
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: c3b659e19af31fb4
---

# the decay threshold is stated on the screen and read from the config, not written into the prose

Owner ruling 2026-09-05, walk/91, taken in the screen walkthrough after #deccaveat was confirmed
ABSENT FROM THE DOM ENTIRELY — not hidden, not empty: never drawn.

WHAT WAS RULED. The caveat is stated ON THE SCREEN rather than behind the "?" disclosure, and the
threshold in it is DERIVED from the configuration rather than typed as "twenty".

WHY ON THE SCREEN. It is the one fact that makes the chart interpretable at all. A reader who
never opens a disclosure reads the chart wrong, and reading it wrong looks exactly like reading it
right. STD-a-screen-explains-itself-in-plain-words-and-depth-hides puts DEPTH behind the
disclosure; this is not depth, it is the unit the axis is drawn in.

WHY DERIVED. The number is configurable, so prose stating "twenty" is wrong for any project that
changed it, and wrong silently. Both READMEs have been found stale five times in two days, every
time by an agent and never by a reader — the measured reason this project prefers derivation
wherever a fact CAN be derived. A caveat that lies about the threshold is worse than no caveat,
because it is believed.
