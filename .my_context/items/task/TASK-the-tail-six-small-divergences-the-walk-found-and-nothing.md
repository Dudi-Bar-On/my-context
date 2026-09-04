---
id: TASK-the-tail-six-small-divergences-the-walk-found-and-nothing
type: task
title: "the tail: six small divergences the walk found and nothing else explains"
status: active
severity: soft
always: false
summary: Six small leftover differences between the app and its design, each too minor to have a cause of its own.
summary_of: 517643e7977ea8e4
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "plan:walk"
  - "seq:22"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3ed64d38e5d97451
plan: walk
seq: "22"
state: done
priority: "3"
source: "plan:port seq:98, the tail"
---

# the tail: six small divergences the walk found and nothing else explains

The end of the plan:port seq:98 walkthrough. Everything here is small, measured, and belongs to no larger cause -- which is why it is one task and not six.

capture -- the mockup draws a TABLE of recently captured items (`INV-prices-are-integer-cents`, `STD-api-errors-use-problem-json`) and the app draws none. Verdict AMBIGUOUS, so the code can build one; establish whether this is the fixture having no recent captures or a card that was never wired. Also `p.cmdnote` and `span.m.v`, absent.

learn -- two `span` and one `span.m` in the wrong parent; the app draws each kind elsewhere on the screen. A placement difference, four findings, one cause.

palette -- `span.chip.crit` appears nowhere in the app. The chip fires when an argv value carries a shell substitution, which no default value does, so it may be unreachable rather than unbuilt -- decide which. `span.chip.ok` 5 to 2 and `div.hit` 7 to 16 are the fixture.

work -- the app emits `<br>` inside the word-level diff cell and the mockup never does, so the app s diff wraps where the design s runs inline. The `ins`/`del` counts either side are the different text being diffed, not a defect.

port -- one `td.m` against one `td.small`: the em-dash cell for a value the server cannot supply, which is the same shape doctor already ruled on.

NONE of these is worth an owner ruling on its own. Bring anything that turns out to be a real gap back as its own task.
