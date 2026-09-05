---
id: TASK-learn-cross-links-a-superseded-item-and-a-closed-task-and
type: task
title: Learn cross-links a superseded item and a closed task, and its fourth row links nothing at all
status: active
severity: soft
always: false
summary: The topic table picks whatever item matches rather than one that demonstrates the topic, and one row silently shows no link and no unmeasured mark.
summary_of: 3e5a05671aa0140e
scope:
  - src/ui/public/screens/learn.js
tags:
  - v2
  - ui
  - walk
  - "screen:learn"
  - "plan:walk"
  - "seq:138"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 763fd01cfcdfb47a
state: done
verified_on: 2026-09-05
---

# Learn cross-links a superseded item and a closed task, and its fourth row links nothing at all

Found 2026-09-05 by driving the live screen, immediately after walk/88 landed the honest
unmeasured mark on the categories row. The mark was correct. What it exposed is that the other
three rows are not.

WHAT THE SCREEN CLAIMS, in its own subtitle: "The four help topics, each linked to the items in
this corpus that demonstrate it. That join is what a docs page cannot do." The join is the whole
stated value of the screen, so the quality of what it joins to is the feature, not a detail.

WHAT IT ACTUALLY DOES, read out of the live DOM:

  categories  no single item represents this        <- honest, shipped today
  scope       DEC-focus-discloses-and-allows-...    <- SUPERSEDED, valid until 2026-09-03
  capture     TASK-injection-preview-rung-4-...     <- a task, closed the same hour
  workflow    (nothing at all)                      <- no link, no mark, no text

Three separate faults with one cause. The scope row opens a pane that says, in the product’s own
words, status "superseded" and "not injected (status “superseded”)" - the screen is teaching a
reader how scope works by pointing at a decision that stopped governing two days ago. The capture
row points at a TASK, which demonstrates nothing about what to write down and when; it was closed
as done within the hour, so the link now teaches from a finished piece of work. And the workflow
row draws neither an item nor the unmeasured mark that the categories row just earned, which is a
silent drop and is what INV-nothing-is-dropped-silently exists to forbid.

THE CAUSE is the selection rule, not the four rows. Whatever picks these ids is matching on
topic words and taking a result, with no test that the item is active, none that it is of a
category capable of demonstrating anything, and no branch for finding nothing. A row that finds
no suitable item must draw the unmeasured mark walk/88 added, not blank space.

WHAT WOULD CLOSE THIS. The picker excludes superseded and non-active items; it prefers the
normative tier over tasks for topics that are about a rule; every row either names an item or
draws the unmeasured mark; and a test asserts all four rows are in one of those two states so
this cannot silently regress to blank again.
