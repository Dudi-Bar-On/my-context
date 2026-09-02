---
id: DEC-the-screens-are-walked-worst-missing-first-by-node-deficit
type: decision
title: the screens are walked worst-missing first, by node deficit
status: active
severity: soft
always: false
summary: Screens are worked on in order of how much of the design is missing, not how many separate complaints were counted, since a whole missing part counts only once.
summary_of: c6782878baec79ae
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 0a0a68c11d5d5134
---

# the screens are walked worst-missing first, by node deficit

OWNER RULING, 2026-08-24, on the order of the plan:port seq:98 walkthrough.

The screens are taken in order of NODE DEFICIT -- how much of the design is missing -- and not by divergence count.

THE REASON, and it is a defect in how the inventory was being read rather than an opinion: the tree walker reports an ABSENT CONTAINER ONCE and does not recurse, because there is nothing on the other side to walk into. So an entire card that the app never draws is one line. Divergence count therefore measures how FRAGMENTED the damage is, not how much of it there is.

The two orders disagree completely. Measured 2026-08-23:
  decay     547 -> 86   461 missing, 14 findings
  watch     206 -> 26   180 missing,  8 findings
  simulate  193 -> 77   116 missing, 15 findings
  proc       91 -> 132   41 SURPLUS, 20 findings

decay draws 16 percent of its design and watch draws 13, while proc -- called the worst screen for a day on the strength of its 20 findings -- draws more than the design does. watch does not appear in the old worst-four at all.

THE ORDER IS NOT REVERSIBLE INTO A RANKING OF SURPLUS. Read together with the ruling that more than the mockup is usually right: a large NEGATIVE deficit is urgent, a large POSITIVE one is a mockup that needs updating and is not a queue jumper.

CONSEQUENCE FOR THE INVENTORY ITSELF: 182 is a FLOOR. The 116 nodes missing from simulate arrive as a single AMBIGUOUS line reading "differs only by [sim], which is a STATE class". Nobody should quote the count as the size of the gap again.
