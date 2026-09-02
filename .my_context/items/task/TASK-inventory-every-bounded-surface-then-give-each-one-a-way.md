---
id: TASK-inventory-every-bounded-surface-then-give-each-one-a-way
type: task
title: the bounded surfaces already hold their data — give them a way through
status: active
severity: soft
always: false
summary: Lists that show only the first part already hold the rest, so they need a way to page through it, and one live feed genuinely does not.
summary_of: 114a703390bed6be
scope: []
tags:
  - v2
  - ui
  - lists
  - "plan:walk"
  - "seq:54"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 52109898b27b8a05
plan: walk
seq: "54"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the bounded surfaces already hold their data — give them a way through

INVENTORY DONE 2026-08-27, and it makes this task far smaller than it was filed as.

THE FINDING, and `parts.js` had already written it down before anyone asked: **every one of the five `boundedList` surfaces already receives its WHOLE array in the response it is rendering.** The file says so in its own words -- "The remainder costs no round trip anywhere ... So 'show all' is a re-render, the total is always EXACT rather than 'at least N'".

So the requirement's sharpest condition -- *no surface may answer "next" by re-reading the whole corpus and slicing* -- **is already satisfied for five of the seven surfaces, by construction.** They are display caps over data legitimately in hand. Paging them is a re-render and costs one round trip of nothing.

THE INVENTORY:

| surface | screen | cap | order | can it page? |
|---|---|---|---|---|
| delivered rows | preview | 20, `displayOnly` | admitted | YES -- whole array in hand |
| carried index lines | preview | 20, `displayOnly` | admitted | YES -- whole array in hand |
| injection rows | injected | 50, take last | recent | YES -- whole array in hand |
| packs | packs | 50, take last | recent | YES -- whole array in hand |
| revisions | work | 50, take last | recent | YES -- whole array in hand |
| repository files | coverage | server-side | path | **ALREADY PAGES** -- `?limit=&offset=`, and it reports what a page left out on BOTH sides |
| audit feed | watch | time: a tail from END of log | chronological | **NO** -- and this is the only real one |

TWO CONSEQUENCES.

**Coverage is the precedent, not a special case.** It already takes `offset`, already bounds it, and already returns an `omitted` count so a page can say what it skipped in both directions. Whatever control the five display-capped surfaces get should read the same way to a user, and coverage should not be re-invented.

**The audit feed is the only surface needing new mechanism**, and it is already filed as plan:walk seq:52. A live tail has no "previous" until it has a backlog, so seq:52 comes FIRST and this task follows it rather than racing it.

SO THE WORK IS: one control in `boundedList` -- which is the ONE place all five are drawn -- carrying the requirement's five conditions, plus whatever seq:52 leaves the feed needing. Not a paging layer across the stack.

WHAT MUST STILL BE TRUE, from the requirement: forward AND back; the control says WHERE YOU ARE and not merely that more exists; a list holding back nothing draws NO control, because an inert control is the same lie as a blank screen; keyboard-operable and it announces the move.

AND THE ONE THING NOT TO LOSE: `displayOnly` exists because "showing 20 of 47" would otherwise read as "you were given 20" on the one screen whose promise is *exactly what Claude gets*. A paging control must not quietly reintroduce that reading -- moving through a display cap is not moving through what was delivered.
