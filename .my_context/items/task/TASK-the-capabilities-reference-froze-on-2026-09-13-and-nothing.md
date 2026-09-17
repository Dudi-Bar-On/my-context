---
id: TASK-the-capabilities-reference-froze-on-2026-09-13-and-nothing
type: task
title: the capabilities reference froze on 2026-09-13 and nothing since is in it
status: active
severity: soft
always: false
summary: Audit and repair the fourteen capability chapters against the code as it stands, and add what is missing.
summary_of: 736dd6d5d80b66da
scope:
  - docs/capabilities/**
  - src/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:97"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: c5f28261958b8237
plan: rulings
seq: "97"
state: done
priority: "1"
---

# the capabilities reference froze on 2026-09-13 and nothing since is in it

THE OWNER, 2026-09-16: "i looked at the docs/capabilities and it looks the direction but i need to do several things: 1 - select professional reviewers from the tools you have and let ne approve them, they should go over the capabilities documents as well as over the code base and fix refactor add missing subjects documents mechanisms and every single detail to make them super accurate".

HE APPROVED FIVE SPECIALIST AGENTS AND RULED HOW THEY WORK: "intentionally i have decided not to use general purpose but other agents, i do not want them to obey to any rule so they will bring their speciality knowledge without any interuption or limitation". So this item does not prescribe method. It records the goal and the known ground truth.

WHAT IS KNOWN TO BE WRONG, measured 2026-09-16 by the lane that wrote reports/2026-09-16-the-subjects-of-this-system.md:
  - The reference STOPPED MOVING ON 2026-09-13. Everything shipped since is outside all fourteen chapters: the search grammar, the find panel, folding and highlighting, mark kinds, two marks on one turn, corpus ranking, --sources ran, the turn-refresh worker, mycontext path.
  - Chapter 4 says no CLI command reaches the archive. One does.
  - Chapter 10 says fifteen rule entries. There are sixteen.
  - app.js asserts ALL TWENTY-ONE SCREENS three lines above an array of twenty; chapter 8 says twenty and agrees with the code.
  - watchedDocs is named in the index as a key with two doctor findings behind it and has no chapter at all.

THE STANDARD IS ACCURACY AGAINST THE TREE, not against any document. A distillate freezes counts that keep moving - five of six wrong claims met this week came from documents made out of this conversation.
