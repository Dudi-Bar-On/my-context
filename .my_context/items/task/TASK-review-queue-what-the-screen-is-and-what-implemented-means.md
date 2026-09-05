---
id: TASK-review-queue-what-the-screen-is-and-what-implemented-means
type: task
title: "Review queue: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen where a person accepts or rejects proposed changes, seeing the difference side by side before approving anything.
summary_of: 7d967ee37731a18a
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:127"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: bac924390a8226fa
plan: walk
seq: "127"
state: doing
priority: "2"
source: "plan:walk seq:27, from the module header of screens/work.js on 2026-09-02"
verified_on: 2026-09-05
---

# Review queue: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.ch -- Review queue, section data-p="work". TWO queues -- pending drafts and pending revisions -- each a stack of cards, and on every card a human takes ONE decision, Accept or Reject, before anything is offered to run. The bargain the screen exists to keep: the diff is the capability a terminal cannot give, and the approval is a paste. The verdict the reader picks is what COMPOSES the line, the sentence saying what it will do, the audit op named, and the argv the confirm rebuilds -- all from the one choice, so there is no state in which the code shown says one thing and the button runs another. Execute stays the single approval boundary: Accept and Reject write nothing on their own. A revision's stale field is not diffed; its two value cells are REPLACED, because a proposal written against text that no longer exists has no comparison to draw. A draft card has no diff at all -- a draft is a whole item that does not govern yet, not a proposal against a text in force -- and inventing a two-column table for it would draw a comparison nobody made. The two queues fetch independently so one endpoint's failure cannot empty the other, and both zeroes are drawn and named.

WHAT IMPLEMENTED MEANS: both queues drawn, all four settlements reachable rather than only the one that says yes, per-field staleness expressed as the row's own shape, and the word-level diff the screen promises either built ONCE where both surfaces can share it or the promise corrected -- a second diff written in the browser is the one repair that would be worse than the gap.

Filed under plan:walk seq:27, condition 3.
