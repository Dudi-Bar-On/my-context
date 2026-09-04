---
id: TASK-the-rail-count-badges-are-styled-and-never-drawn
type: task
title: the rail count badges are styled and never drawn
status: active
severity: soft
always: false
summary: The menu is meant to carry small counts of what needs attention; the styling exists and nothing ever draws them.
summary_of: f99ad8c9baf9f02c
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:status"
  - "plan:walk"
  - "seq:38"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 7b47e5b28194e2ea
plan: walk
seq: "38"
state: done
priority: "2"
source: "owner request 2026-08-25: preview, app vs mockup, on the REAL corpus"
---

# the rail count badges are styled and never drawn

FOUND 2026-08-25 by owner request 2026-08-25: preview, app vs mockup, on the REAL corpus. No task covered it.

THE MOCKUP DRAWS THREE. `<span class="cnt x">7</span>` on Coverage gaps, `2` on Doctor, `3` on Review queue -- the count of things wanting attention, on the rail, where a person sees it without opening the screen.

THE STYLESHEET CARRIES THEM. `styles.css` · `.cnt{font-family:var(--mono);` · ~1068 defines `.cnt` and `:443` defines `.cnt.x` in `--warn`. Both were carried faithfully from the mockup.

NO CODE IN THE APP EVER CREATES ONE. `renderNav()` builds a rail button with one span -- the label -- plus the PROPOSED badge where a screen has no module. There is no `cnt` anywhere in `src/ui/public/`.

SO THE STYLESHEET HAS RULES FOR AN ELEMENT NOTHING DRAWS. That is the same shape as the eighteen `svg.chart` rules that were carried and never rendered -- and it is invisible to every gate for the same reason: `styles-parity` compares CSS BLOCKS, and both files have the block.

THE DATA IS ALREADY ON THE WIRE. `/api/status` serves `reviewQueue.drafts` and `pendingRevisions`; doctor s finding counts come from `/api/doctor`; the gaps count is derivable from `/api/coverage`, which the gaps screen already reads. Nothing new has to be collected.

ONE THING TO RULE WHILE BUILDING IT: the shell would be fetching, on boot, three numbers that belong to three different screens. Either the rail asks for them itself, or `/api/status` grows a `counts` field that names all three. The second is one request instead of three and keeps the derivation server-side, which is where every other count in this product lives.

AND CHECK THE ZERO CASE AGAINST `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`: a badge reading `0` and a badge that is absent are two different claims, and the standard now says which is which.
