---
id: TASK-composer-what-the-screen-is-and-what-implemented-means-for
type: task
title: "Composer: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen that builds a command for you from real choices out of your own project, and hands it over to paste rather than running it.
summary_of: f3c0ccd48073efec
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:129"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: 044652dc48525197
plan: walk
seq: "129"
state: todo
priority: "2"
source: "plan:walk seq:27, from the module header of screens/palette.js on 2026-09-02"
---

# Composer: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.ch -- Composer, section data-p="palette". It is Composer and not "command palette": both string tables say Composer on the heading and on the rail label, the design of record is the appearance authority, and the phrase never appears on the screen. Its contract is real pickers and a live glob tester, and both halves read the RUNNING corpus -- item ids, categories, drafts and pending revisions are all fetched, and the glob tester's matching is done by the server through the very cache the selector uses, so nothing on this screen is a canned example. Writes are COMPOSED AND COPIED, never run: what a person settles here is a string they paste into their own shell. Reads are different in kind and ARE executed -- they fetch the endpoint that already serves the answer, or route to the screen that already draws it. The command catalogue decides what is offerable and this screen never widens it: every control is built from a catalogue entry's own arguments and flags, so a flag the catalogue deliberately withholds cannot appear here by accident.

WHAT IMPLEMENTED MEANS: every catalogue entry reachable through pickers built from its own arguments and flags, the glob tester answering from the server rather than from a browser-side rematch, no control that can compose a flag the catalogue withholds -- and the count line and the dead-scope sentence the engine computes and no key can word, held open at plan:screens seq:10s.

Filed under plan:walk seq:27, condition 3.
