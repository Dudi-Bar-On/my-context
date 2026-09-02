---
id: LESSON-an-absent-container-is-one-finding-so-a-divergence-count
type: lesson
title: an absent container is one finding, so a divergence count understates the gap
status: active
severity: soft
always: false
summary: A whole missing section counts as a single difference, so a tally of differences hides how much is actually absent.
summary_of: 76905597bf37fc6a
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - gate
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 209ce397cb6ef734
---

# an absent container is one finding, so a divergence count understates the gap

Found 2026-08-24, walking simulate in plan:port seq:98.

The tree walker pairs nodes and reports where they differ. When a node exists on one side and not the other it is reported ONCE, and the walk does not descend -- correctly, since there is no counterpart to descend beside. The consequence is that the SIZE of a missing subtree never reaches the report.

ON SIMULATE THAT HID 116 NODES BEHIND ONE SHRUG. The mockup s simulator card is `div.card.pane.sim`; the app builds the same card without the `sim` class. Differing by one class makes it a different KIND, so the walker reported `ABSENT div.card.pane.sim` with the detail "class lists differ only by [sim], which is a STATE class rather than a different element" -- verdict AMBIGUOUS -- and never looked inside. Inside were the admission staircase, its SVG, the threshold ladder and the readout: the substance of the screen, and the reason it exists.

The same walk reports 15 findings for simulate and 20 for proc, which draws MORE than its design.

THE GENERAL FORM: a count of findings is a count of PLACES that differ, and says nothing about how much differs at each place. Any ranking built on it ranks fragmentation. The node deficit was in the same JSON the whole time and nobody had subtracted it.

This is the third instance this week of a gate measuring what it was pointed at rather than what was asked: screen-parity comparing a sorted SET and so blind to order, nesting and quantity; styles-parity comparing only the selectors it was handed; and now a walker whose report is honest per finding and misleading in total.
