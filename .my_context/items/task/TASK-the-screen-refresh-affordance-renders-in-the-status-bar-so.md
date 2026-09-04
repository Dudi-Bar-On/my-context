---
id: TASK-the-screen-refresh-affordance-renders-in-the-status-bar-so
type: task
title: the screen refresh affordance renders in the status bar so it reads as the bar's control
status: active
severity: soft
always: false
summary: The refresh button sits in the status bar but acts on the page, so people read it as refreshing the wrong thing; move it.
summary_of: 8f04b24e9f2e6b24
scope: []
tags:
  - v2
  - ui
  - shell
  - walk
  - "plan:walk"
  - "seq:116"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/t3.md"
source_anchor: null
source_checksum: bee0dd0e9d7337b1
valid_from: 2026-08-31
valid_until: null
checksum: a22cd2e8f4ba6c41
plan: walk
seq: "116"
state: done
priority: "1"
source: owner ruling, 2026-08-31
---

# the screen refresh affordance renders in the status bar so it reads as the bar's control

> > Owner ruling 2026-08-31: *"move the refresh button to the screen"*.
>
> **Why it was asked**
>
> The owner asked what the refresh button on the right of the status bar is for, *"if the status bar should be ongoing refreshed"*. That question is the defect. The strip refreshes itself silently — `CHROME_INVALIDATION` declares every group `auto` — and the button rendering at the end of the strip's row acts on **the screen**, not the strip.
>
> Its own message already says so: *"New activity for this screen. Refresh"*. The placement contradicts the wording, and the wording lost.
>
> **The two behave oppositely on purpose, and that stays**
>
>     strip    auto   it holds no reader state; nothing is lost by redrawing it
>     screen   ask    it holds an event pick, filters, a session choice, scroll
>
> `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` settles that, and `plan:walk seq:64` measured a refresh discarding three of the owner's selections in one act.
>
> There is a second reason the screen cannot simply auto-refresh, and it must survive this move: every screen's `render()` opens with `root.replaceChildren()`, and six of them then await an endpoint and append afterwards — so two overlapping renders each clear an empty section and each append a whole screen. Measured in a browser: **three hash writes in one turn drew nine `<h3>` where one render draws three.** The affordance's single `pendingScreenRefresh` slot is what keeps that from happening.
>
> **Done when**
>
> The affordance renders with the screen it acts on, where "for this screen" is self-evident; `#screenstale`'s ID-versus-`[hidden]` specificity fix is preserved (an ID beat `[hidden]{display:none}` once already and the affordance could never hide); the single-slot guarantee is unchanged, so two takes cannot stack two renders; and a browser test drives a real invalidation and presses it from its new home.
