---
id: DEC-a-refusal-is-a-state-to-leave-and-the-standing-goal-is-none
type: decision
title: a refusal is a state to leave, and the standing goal is none
status: active
severity: soft
always: false
summary: A note saying something could not be built yet is temporary, but once the obstacle is gone it reads like a permanent decision, so the aim is to have none.
summary_of: d0e2217c1896e1b2
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - process
  - refusals
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 287974cf12db9be3
---

# a refusal is a state to leave, and the standing goal is none

OWNER RULING, 2026-08-25, on what to do about refusals that outlive their reasons: make the condition checkable by a gate -- "but in general i want to remove the refusals".

SO THERE ARE TWO PARTS AND THE SECOND IS THE LARGER. The gate is how a refusal stops rotting; removing them is the direction of travel. A refusal in this codebase is a TEMPORARY state recording that something could not be built yet and why. It is not a resting place, and a file that has carried one for a month is not thereby entitled to it. Same shape as the ruling that PROPOSED is a stage to leave rather than a label to keep.

WHY, AND THIS IS THE PART A GATE CANNOT FIX: a refusal that outlives its reason is INDISTINGUISHABLE FROM A DECISION. It reads as permanent to the next person and it reads as permanent to the next agent. Three were found in a single day, every one of them well-written and well-argued:
- simulate.js refused the spill ratio because "its source is the audit projection, which no route in this plan exposes". `GET /api/watch/ratio` exposes exactly it, and its own header says it was built for that chart.
- config.js refuses the delta plate because "the screen contract s fetcher takes a path and nothing else: no method, no body". `ctx.post` exists, and its comment names screens/config.js as the caller it was built for.
- styles.css refuses ten `.delta` and `.blast` rules "until ctx.api can POST". It can.

The two in config name each other, so neither moves: no rows because no CSS, no CSS because no rows, both waiting on a POST that arrived and told nobody.

WHAT WAS WEIGHED AGAINST IT: refusals are one of the best things about this codebase. They are why nothing weaker was drawn in place of a chart that could not be drawn honestly, and the rule that produced them -- "Where a view cannot be drawn, stop and ask; do not draw a weaker one" -- is not being softened. Removing a refusal means BUILDING the thing, or converting it into an explicit recorded decision. It never means drawing the weaker thing the refusal was protecting against.
