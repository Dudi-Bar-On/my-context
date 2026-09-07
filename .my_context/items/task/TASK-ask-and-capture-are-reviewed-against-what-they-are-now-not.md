---
id: TASK-ask-and-capture-are-reviewed-against-what-they-are-now-not
type: task
title: Ask and Capture are reviewed against what they are now, not against the first sketch
status: active
severity: soft
always: false
summary: Two screens still shaped by the earliest drawing get looked at properly, and improved rather than replaced.
summary_of: 06c30eb5cb023b5d
scope:
  - src/ui/**
  - .my_context/items/**
tags:
  - v2
  - ui
  - review
  - "plan:walk"
  - "seq:141"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 717e43c610a6fcdd
plan: walk
seq: "141"
state: todo
priority: "2"
needs: builder/11
---

# Ask and Capture are reviewed against what they are now, not against the first sketch

Owner ruling 2026-09-07, after asking whether Ask and Capture should be merged into the Composer or
deleted. HIS DECISION: KEEP BOTH, CHANGE NEITHER’S EXISTENCE. They need reviewing, probably
refactoring, and probably extending - because both are still close to the MOCKUP’S VERY INITIAL
DEFINITION, and the product around them has moved a long way since.

THE MERGE QUESTION IS SETTLED AND THE REASONING IS WORTH KEEPING, so nobody re-opens it in a month.

THE NAV ALREADY ENCODES THE ANSWER. nav.ev holds watch, ask, doctor, decay, graph, status. nav.ch
holds work, capture, palette, config, proc, port, packs. CAPTURE AND THE COMPOSER ARE ALREADY
SIBLINGS; ASK IS NOT - it sits with Doctor and Decay. nav.ch is "change the corpus", nav.ev is "find
out what is in it". The Composer answers HOW DO I RUN THIS. Ask answers WHAT IS IN HERE. Only one of
those is a command, and Ask’s output is a result set, not a composed line.

CAPTURE IS ALREADY THE COMPOSER FOR ONE COMMAND - it composes `mycontext add`, and since builder/5 it
renders through the same builder.js component: same selects, same format placeholders, same required
marks, same composed row. So the merge has mechanically half happened already. What Capture holds
that the Composer does not is worth naming rather than losing: it is TASK-SHAPED rather than
COMMAND-SHAPED ("what are you recording?" against "which of 44 commands?"), it carries the category
hints library/8 put real work into, and captureCommand THROWS on a half-built capture - the behaviour
the whole builder refusal design was generalised from.

AND THE COST OF DELETING A MENU ITEM IS NOT THE CODE. A rail item is an AFFORDANCE: "Capture" teaches
that capturing is a thing you do; a Composer holding 44 commands teaches nothing to somebody who does
not already know what to look for. DEC/RULE on help going on controls a reader CANNOT INFER (walk
seq:0) points straight at this. There is also a measured precedent for one-door-to-everything on this
very screen: a 942-option select once stretched the page to 3,902px.

SO THE WORK IS REVIEW, REFACTOR, EXTEND - on both screens, against what the product is now rather
than against the first drawing. This is walk-shaped work and belongs with the rest of the walk review
(seq:140).

ONE QUESTION LEFT GENUINELY OPEN, and only answerable later: whether ui3 seq:15’s typed-SQL surface
makes Ask’s four canned reports redundant. That has a real answer, after typed SQL lands. It is not
a reason to touch Ask now.

HELD UNTIL THE COMPOSER IS PROVEN - the owner was explicit about the order. builder seq:11 (D12) is
the proof. Deciding anything about neighbouring screens on the strength of a Composer that is not yet
verified would be backwards.
