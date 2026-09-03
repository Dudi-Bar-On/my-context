---
id: RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it
type: rule
title: A screen shows the new state after the reader acts on it, without being asked and without a reload
status: active
severity: hard
always: false
summary: When a reader does something on a screen, that screen immediately shows the result instead of leaving a stale row or waiting for a reload.
summary_of: 9f14d83f1f198523
scope:
  - src/ui/**
tags:
  - ui
  - live
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 76be5738d1baa461
---

# A screen shows the new state after the reader acts on it, without being asked and without a reload

Owner ruling, 2026-09-03, in his own words: "after doctor repairs an item, it should disapear from it is list and the screen should auto refreshed not waiting for user to reload the page, this rule is true for every other case when handling something on screen, the screen should be refreshed to represent the new state".

THE RULE

When the reader performs an action ON a screen, that screen shows the resulting state immediately. No reload. No affordance to press. No stale row left behind describing a condition the action just removed.

A repaired doctor finding leaves the list, because it is no longer found. A settled draft leaves the queue. A written budget shows as written. Whatever the action changed, the screen the action was taken on tells the truth about it before the reader looks away.

WHY THIS IS NOT A CONTRADICTION OF THE ASK RULE

`DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` says a refresh that cannot keep the reader place ASKS instead. Every word of its argument is about a change arriving from ELSEWHERE while somebody is reading: it protects a scroll offset, an open pane, a half-read row, against an interruption the reader did not cause.

That argument does not reach this case. The reader pressed the button. They are not mid-sentence in a body they will lose; they are waiting to find out what their own action did. There is no place to protect from them, and an affordance asking permission to show the result of a command they just confirmed is a second confirmation for an act already taken.

So the two divide cleanly by WHO CAUSED IT:
- The reader acted on this screen. Refresh. This rule.
- Something changed elsewhere while they were reading. Keep their place, or ask. That decision.

WHAT IT RULES OUT

Leaving a row on screen that names a condition the reader has just repaired. Requiring a reload to see the outcome of a command the product itself composed and ran. Drawing a stale affordance for a change the reader initiated.

WHAT IT DOES NOT REQUIRE

It does not require a finding to vanish when it was ACKNOWLEDGED rather than repaired. Acknowledgement is a mark and not a filter, by the ruling of 2026-08-27: the finding is still true, still reported and still counted, and it is drawn as ruled-on rather than removed. Disappearing is what a REPAIR earns, because a repaired defect is genuinely no longer found.
