---
id: TASK-the-already-in-context-split-only-appears-under-a-hand
type: task
title: the already-in-context split only appears under a hand-forced budget, so it never answers the question it was built for
status: active
severity: soft
always: false
summary: The spilled-item split is unreachable in both views a reader actually opens, and it describes a simulated run rather than a real injection.
summary_of: 8e4b03f6e37164e6
scope:
  - src/ui/public/screens/**
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - injection
  - budget
  - "plan:budget"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 74812327740f2eff
plan: budget
seq: "13"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the already-in-context split only appears under a hand-forced budget, so it never answers the question it was built for

Measured in a browser on the running server, 2026-09-04, after the split shipped. It is correct
code and it is not reachable. Cold, which is now the default view, reports 91 spills and labels
every one GENUINELY ABSENT, which is trivially true because a cold run has seen nothing. Warm,
the real session, reports zero spills at all, because the seen gate had already removed 134 of
143 items before any tier picked candidates, so every tier reads that everything it could have
had was already delivered. The split was demonstrated by dragging the index budget down to 1.
In the two states a reader opens, it never shows.

The deeper mismatch is what it describes. The owner asked to look for spilled items and tell
whether they are currently absent from the context window, given they may already be there from
a previous injection. That is a question about injections that REALLY HAPPENED. The simulator
answers a hypothetical about a budget a reader is dragging, and a hypothetical spill is not
something anyone can act on.

Every fact needed is already recorded. The audit log carries the injection ops with what each
tier admitted and dropped, 12,034 spills across its history, and the seen file records what a
session received. Joining those answers the real question without any new selection logic, the
same way the simulator join was display over data that already existed.

What to build: the split over REAL injections, on a surface a reader already opens, so a spilled
item can be seen and acted on where it actually spilled. Keep the simulator list as it is, since
it correctly answers the hypothetical it belongs to.

Decide and state which surface carries it rather than adding a sixth screen. Injected now
already shows what a real injection delivered and is the obvious host; the audit stream already
renders injection rows. Say which and why.

This is what makes a one-shot carry usable rather than ornamental: a reader must be able to see
that an item really spilled and is really absent before deciding to spend a carry on it.

Verify as a user in a browser with the real corpus and no forced budgets. If the answer on this
corpus is that nothing genuinely spilled, that is a legitimate measured result and must be drawn
and named as one rather than left blank.
