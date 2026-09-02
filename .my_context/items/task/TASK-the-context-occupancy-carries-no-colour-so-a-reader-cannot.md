---
id: TASK-the-context-occupancy-carries-no-colour-so-a-reader-cannot
type: task
title: the context occupancy carries no colour so a reader cannot see how much runway is left
status: active
severity: soft
always: false
summary: Show in colour how much room a session has left, with the warning starting early enough that there is still time to act on it.
summary_of: c397f0fcbc750c03
scope: []
tags:
  - v2
  - ui
  - shell
  - walk
  - "plan:walk"
  - "seq:117"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/ctxcolour.md"
source_anchor: null
source_checksum: 2a946913b0347867
valid_from: 2026-08-31
valid_until: null
checksum: 61571f9356666fa1
plan: walk
seq: "117"
state: done
priority: "1"
source: owner ruling, 2026-08-31
---

# the context occupancy carries no colour so a reader cannot see how much runway is left

> > Owner ruling 2026-08-31, with the thresholds to be derived from the measurement below rather than from taste.
>
> **The measurement that settles the design**
>
> Every `pre-compact` record carries `occupancyPercent` and `trigger`. Read from the live audit log:
>
>     2026-08-29  auto   99.7147%   handoverAsk: acted-on
>     2026-08-28  auto   99.809%    —
>     2026-08-27 and earlier: protocol @1, no occupancy recorded
>
> **Claude Code's auto-compaction fires at ~99.75%.** That answers the standing concern recorded in `config.ts` — *"98 may be a threshold Claude Code's own auto-compaction never lets anything reach"*. It is reachable: 98 sits below 99.75, so the handover ask does get its window, and on 2026-08-29 it used it (`acted-on`, with the record naming both the ask time and the file's write time).
>
> **What that implies, and it is the whole point of colouring at all**
>
> A bar that only leaves green at 98 gives a reader **about two per cent of runway**. By the time it changed colour the compaction would be imminent and there would be nothing useful to do. So the bands must start well below the threshold they are named against:
>
> * healthy — comfortably below the ask
> * warn — approaching it, while there is still room to act (finish a thought, capture a lesson, write the handover deliberately)
> * crit — at or past `handoverThresholdPercent`, where the ask fires
>
> **Rulings**
>
> * **Colour against `handoverThresholdPercent`, not a constant.** That value is configurable and currently unset, so it resolves to 98 through `handoverThresholdPercent()` — the one place the default is applied. Read it; do not hard-code 98.
> * **Use the meaning-hue budget of five.** ok / warn / crit already exist. Do not introduce a sixth.
> * **Colour is not the only carrier.** The percentage stays a number, and the state must be readable without colour — `RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it` and the contrast gate both apply, and a reader who cannot distinguish the hues must still get the state.
> * **Do not colour a stale figure as though it were live.** The strip already discloses age (*"as of last response, 27h ago"*). A fossil rendered in confident red is worse than an uncoloured number.
>
> **Done when**
>
> The bands are derived from `handoverThresholdPercent` and stated in the code; a browser test asserts the computed colour at three occupancies either side of the boundaries; the stale and no-bridge states are visibly not-a-level rather than a colour; and the contrast gate passes on all three hues.
