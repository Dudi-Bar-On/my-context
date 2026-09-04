---
id: TASK-the-gate-ladder-needs-a-stable-gate-code-not-a-reason-string
type: task
title: the gate ladder needs a stable gate code, not a reason string to mine
status: active
severity: soft
always: false
summary: Send a fixed code saying which check something first failed, so the screen does not have to read meaning out of a sentence.
summary_of: e4d1c8c3b16f4995
scope: []
tags:
  - "plan:ui1"
  - "seq:17a"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: f8e400ebfb87b1ec
plan: ui1
seq: 17a
state: done
priority: "1"
---

# the gate ladder needs a stable gate code, not a reason string to mine

Ruled by the owner 2026-08-22: extend the read models so the mockup's four undrawn charts can be drawn. This is the first of four.

The gate ladder (#gates, with preview.why and preview.whyn) shows which of select()'s six gates an item first failed. The screen agent could not draw it: no read model carries the INDEX of the first failing gate, and the plan explicitly forbids mining Spill.reason for it - a prose sentence parsed by a screen is a second implementation of the selector's own decision.

What it needs: a stable gate code on injection(), returned per item. A code, not a sentence: the sentence can be reworded without breaking anything, and a screen keying off prose breaks the day someone improves the wording.

The screen's own note already records this; preview.js says so where the view would have gone.
