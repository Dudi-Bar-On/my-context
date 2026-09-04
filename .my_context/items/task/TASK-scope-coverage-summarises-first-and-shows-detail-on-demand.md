---
id: TASK-scope-coverage-summarises-first-and-shows-detail-on-demand
type: task
title: scope coverage summarises first and shows detail on demand, because it draws six thousand rows at once
status: active
severity: soft
always: false
summary: Every long list on the screen gets a counted summary that is always visible, with the full list one click away.
summary_of: 7e0de5f7cee45087
scope:
  - src/ui/public/screens/coverage.js
  - src/ui/public/screens/**
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - readability
  - "plan:screens"
  - "seq:21"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 98cf93a2dc868d75
plan: screens
seq: "21"
state: todo
priority: "1"
---

# scope coverage summarises first and shows detail on demand, because it draws six thousand rows at once

Owner approved the mockup on 2026-09-04. Measured on his own corpus, on a real server, and
not estimated: the folder tree draws 6,236 rows fully expanded with no collapse and no
search, 184,246 pixels tall, about 205 screens of scrolling. The pinned card is 36 ids in one
unbroken paragraph mixing seven kinds. And opening any single folder lists about 86 governing
items, because almost every item in this corpus is unscoped and therefore matches every
folder identically.

His words for why this matters: the screens look complex, hard to read and difficult to
understand, and the effect is that a user does not use the screen. The cost is abandonment,
not confusion.

One principle, applied three times rather than three fixes. Anything longer than about eight
rows gets a short counted summary that is always visible, grouped by kind, with the full list
behind the shared question mark. The tree, the pinned card and the what-governs-this-folder
list all get the same treatment, because a reader who learns it once should not learn it
three times.

The approved shapes are in the mockup and should be followed rather than reinvented: a status
line reading files covered, gaps and empty categories; the pinned card as counted chips per
kind with ids on demand.

The pinned count is itself worth showing. Thirty-six items competing in one tier is a fact
about the budget, not decoration, and a bare list of 36 ids says it worse than a count does.

Verify as a user, in a browser, in both languages, per the standing ruling. The number that
settles it is how much a reader must scroll to see the shape of the screen, so measure it
before and after rather than asserting it improved.
