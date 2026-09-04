---
id: TASK-rule-on-injectedline-title-a-served-field-no-screen-reads
type: task
title: "rule on InjectedLine.title: a served field no screen reads"
status: active
severity: soft
always: false
summary: A piece of data is looked up on every request and then thrown away; decide whether to drop it or give it somewhere to appear.
summary_of: efc3be0d3b19a04d
scope: []
tags:
  - "plan:ui1"
  - "seq:17f"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 9507df0cc9c506d2
plan: ui1
seq: 17f
state: done
priority: "3"
---

# rule on InjectedLine.title: a served field no screen reads

Ruled by the owner 2026-08-22 as needing a decision.

/api/session/:session/injected serves a joined title. No screen reads it: the mockup's injected-now table has three columns - Item, Tier, When - and apiInjected's own contract says no join invents a column. So the join runs on every request and its result is discarded.

Two honest ends: the join is dead and comes out, or the title is meant for something the mockup has not drawn - a tooltip, an accessible label - and that gets designed in the mockup first, per the rule that the file changes first.

Not urgent. Recorded because a served field nothing reads is either waste or an unfinished intention, and both are worth naming rather than leaving as a shrug.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- an owner ruling, priority 3, and genuinely small.

Nothing in the walk touched it and nothing supersedes it. Checked: no open task in plan:walk, plan:ui3 or plan:api mentions the injected table s columns.

ONE THING THE RECONCILIATION ADDS. This is the INVERSE of plan:screens seq:10s, which lists nine facts the read models serve that no screen can say. Here a field is served and deliberately not said. The two belong in the same review: a survey of what the wire carries against what the screens use would settle both, and would be cheaper than nine separate rulings.
