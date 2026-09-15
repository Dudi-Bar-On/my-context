---
id: TASK-stepping-to-the-next-mark-of-a-particular-kind-needs-its-own
type: task
title: stepping to the next mark of a particular kind needs its own key, alongside the keys that already exist
status: active
severity: soft
always: false
summary: You can filter the walk to one kind with a dropdown, but there is no key for "take me to the next defect".
summary_of: 9a121003e0c384d4
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:10"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 6098e0719582e74d
plan: anchors
seq: "10"
state: todo
priority: "2"
---

# stepping to the next mark of a particular kind needs its own key, alongside the keys that already exist

OWNER REQUEST 2026-09-15: "it would be nice to be able to jump to different mark types with special
keys (do not replace existing just add specifc)."

THE INSTRUCTION IS EXPLICIT AND BINDING: ADD, DO NOT REPLACE. `N`/`Shift+N` (marks) and
`U`/`Shift+U` (his messages) stay exactly as they are, and so does the kind `<select>` from
`anchors/6` — a key is a third route to a capability that already has two, which is `anchors/4`’s
own ruling (also, not only) applied again.

WHAT ALREADY HOLDS AND MUST KEEP HOLDING:
  — BOUND BY `event.code`, NEVER `event.key`. On a Hebrew layout the key printed M reports
    `key: ‘צ’`; a `key` table silently unbinds every shortcut for half this archive.
  — INERT INSIDE A FIELD. There is a search box and a rename box on this screen.
  — ESCAPE IS SPOKEN FOR TWICE and is not available.
  — THE KEY IS SHOWN ON THE CONTROL, or the fast path is as undiscoverable as the right-click was.
  — ONE WALK. `anchors/6` put the kind filter INSIDE `markStops`; a key must drive that same walk
    and the same cursor, not a second one that can disagree about where the reader is.

THE DESIGN QUESTION THE LANE MUST ANSWER RATHER THAN ASSUME: there are nine kinds and the keyboard
has no room for nine mnemonic pairs that do not collide with `N`, `U`, `M` and `/`. Options worth
measuring: a prefix (a key that says "next, of kind…" and then one letter); cycling the kind filter
with a single key and stepping with the existing `N`; or keys for only the few kinds a reader
actually hunts. HIS 1,155 MARKS ARE 67% TABLES — the kinds worth a key are the RARE ones, which is
the opposite of what frequency would suggest, and the lane should say which it chose and why.

AND WHATEVER IS CHOSEN MUST SAY WHAT IT IS DOING. The count already names its subject when filtered
(`anchors/6`); a key that changes the subject must announce the change in the same region, or a
reader will not know why the next press went somewhere unexpected.
