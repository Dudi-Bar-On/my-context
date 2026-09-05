---
id: INSTR-a-screen-is-defined-from-every-document-that-mentions-it
type: instruction
title: a screen is defined from every document that mentions it before any task to build it is written
status: active
severity: soft
always: false
summary: Before building a screen, gather what every document in the project says about it, and write the definition the tasks are then cut from.
summary_of: 802455d36e6a35f5
scope: []
tags:
  - v2
  - method
  - screens
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 6b08f8d94bd1549c
---

# a screen is defined from every document that mentions it before any task to build it is written

Owner instruction 2026-09-05, given after the Tutorials screen was reported done and was not.

What went wrong there is the general case. An endpoint was built, twelve hard-coded cells
became computed, and a sweep read that as the item closing. The item itself named TWO
conditions and the second was an owner ruling that had never been asked for. Nobody had a
definition of what the screen is FOR, so nobody could say what finished meant, and the work
that landed was real and still did not close anything.

The method, in his words: make a deep research over ALL the documents in this project -
starting from the campaign - and find out requirements, thoughts, brainstorming, decisions,
specs, plans, declarations, mockups and everything else that relates to that screen. The goal
is a DEFINITION and REQUIREMENTS for it. Only then are tasks written that implement it.

Why it is done in that order. A task written before the definition is a guess about scope
wearing the shape of work, and this project has spent whole lanes discovering that a premise
was stale, that a symbol two tasks waited on had shipped under another name, or that a field
was served for a fortnight and read by nothing. Each was found by re-reading rather than by
building. Doing that reading once, deliberately, per screen, is cheaper than finding it a task
at a time.

What the research must produce. A definition of what the screen is for, said in one paragraph
a person outside this project could follow. The requirements it must meet, each traced to the
document it came from. What is already built, measured against those requirements rather than
against a task body. And what is missing, which is the gap list - the thing the tasks are then
cut from.

Where a document contradicts another, say so rather than picking. This corpus has a stated
precedence order for four disagreeing sources and it applies here. A contradiction found and
named is a finding; one silently resolved is a decision nobody made.

Where the record answers nothing, say THAT. The Tutorials screen is the one screen with no
plan behind it, and that fact is itself the most useful thing anyone has learned about it.

This runs for every screen still to be walked, and produces a gap list that can be acted on
rather than a task list that has to be re-verified before it can be trusted.
