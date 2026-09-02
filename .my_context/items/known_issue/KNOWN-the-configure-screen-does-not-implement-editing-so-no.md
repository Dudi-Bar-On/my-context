---
id: KNOWN-the-configure-screen-does-not-implement-editing-so-no
type: known_issue
title: the Configure screen does not implement editing, so no setting can be written from the UI
status: active
severity: hard
always: false
summary: The settings screen only displays settings and nothing on it can be changed, so anything meant to end in a saved setting has nowhere to finish.
summary_of: a20f693bf511bcf9
scope: []
tags:
  - v2
  - ui
  - config
  - budget
  - owner-blocking
  - must-fix
origin: human
source_file: null
source_anchor: null
source_checksum: 95a66e7f4fe9deec
valid_from: 2026-08-27
valid_until: null
checksum: 56b97dae7d149ba7
---

# the Configure screen does not implement editing, so no setting can be written from the UI

> Owner-reported 2026-08-27: the Configure screen does not implement editing.
>
> `src/ui/public/screens/config.js` renders configuration but provides no way to
> change it. This matters more than a missing control usually would, because the
> owner has already ruled that the UI writing settings is the intended end state,
> not a reversal: the budget simulator was always meant to finish in an APPLIED
> setting, and splitting the config into several parts was done for exactly that
> reason. A Configure screen that only displays is therefore not a smaller
> version of the feature — it stops short of the thing the split was for.
>
> It also blocks the pinned-budget ruling: when pinned items cannot be injected,
> the user is to be shown a popup offering recommended budgets plus free entry,
> validated against what is possible, and the chosen budget is to be SET. That
> flow terminates in a write this screen cannot yet perform.
>
> Must be fixed.
