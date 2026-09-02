---
id: TASK-capture-what-the-screen-is-and-what-implemented-means-for-it
type: task
title: "Capture: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen that shows what already applies to a part of the codebase before you write another rule for it, then drafts that rule.
summary_of: 19a52e030cfdbc67
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:128"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: e3b5b2c52486c763
plan: walk
seq: "128"
state: todo
priority: "2"
source: "plan:walk seq:27, from the module header of screens/capture.js on 2026-09-02"
---

# Capture: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.ch -- Capture, section data-p="capture". Its contract is one sentence: it shows what already governs before you add another. So it does exactly two things, and the split between them is the reason it is not a second Composer. First it asks what already governs a scope and draws the answer -- the overlap check, which is the half a terminal cannot do. Second it composes the add that would file the next item into that same scope: composed and copied, never run, so what a person settles here is a string they paste into their own shell where their own deny rules can still see it. The design of record draws NO INPUT on this screen -- its card opens on a sample scope and ends on a composed command, and nothing in the section says where the scope, the category, the title or the severity came from. In a static mockup those are sample values; in a running screen they have to come from somewhere, and the router carries no argument, so where the scope comes from is a control the design lacks and this screen has to answer for.

WHAT IMPLEMENTED MEANS: a scope a reader can actually choose, the overlap answer drawn for THAT scope, and the composed add carrying the same scope -- plus the count of items in that scope which do NOT govern, a fact the engine already computes and no string key can say, held open at plan:screens seq:10s.

Filed under plan:walk seq:27, condition 3.
