---
id: DEC-a-disclosure-sits-beside-the-card-it-qualifies
type: decision
title: a disclosure sits beside the card it qualifies
status: active
severity: soft
always: false
summary: A caveat belongs next to the thing it is about, not gathered into a footnote at the bottom; only a caveat about the whole page goes at the foot.
summary_of: 9547bf01d0d6c015
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - tree-parity
  - "screen:proc"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: c9cb8ca0733ab629
---

# a disclosure sits beside the card it qualifies

OWNER RULING, 2026-08-24, on tree-parity findings proc #00 and #01.

The app collects sentences such as `progress is recorded per workspace, not per session` into ONE card at the foot of the screen. The mockup places each beside the card it qualifies. THE MOCKUP WINS: they are scattered back.

WHAT WAS WEIGHED AGAINST IT: proc.js argues its own case in a comment, and the argument is real -- some of these sentences qualify the whole screen rather than one card, and the per-item ones name their own id in their text, so nothing is lost by collecting them. That argument holds for ONE sentence, the workspace-scope one, and it was used to move four. A screen-wide sentence may stay at the foot; a sentence about one card goes back to that card.

The same comment says plainly that where these sentences belong was an open question for the owner. It is answered now.

THE CONSEQUENCE: the extra top-level `div.card.pane` goes, which is what findings #00 and #01 are. The work is plan:walk seq:2.
