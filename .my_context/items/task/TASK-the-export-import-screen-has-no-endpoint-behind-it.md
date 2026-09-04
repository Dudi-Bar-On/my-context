---
id: TASK-the-export-import-screen-has-no-endpoint-behind-it
type: task
title: the Export / import screen has no endpoint behind it
status: active
severity: soft
always: false
summary: The export screen has nothing serving it yet, so it cannot be built until that exists.
summary_of: ae3439d874be8469
scope: []
tags:
  - "plan:api"
  - "seq:3"
  - v2
  - ui
  - backend
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 861f7ac252921ff8
plan: api
seq: "3"
state: done
---

# the Export / import screen has no endpoint behind it

Measured 2026-08-23: of the ten screens the rail lists and the app does not build, six already have their endpoints - ask, work, palette, config, docs and tut - and are pure UI work. This screen is one of the four that has NONE, so the UI task for it is blocked until this lands. That makes these four the long pole to TASK-screen-by-screen-review-walk-the-rail-item-by-item-against (plan:port seq:98), which cannot run until all 21 screens exist. Read the mockup section for the shape of the data it must answer, and the web-ui spec for what a read surface may and may not do - it performs no writes, and a composed command is handed back for the user to run rather than executed. Section data-p=port. The CLI has `mycontext export` and `mycontext init --pack`, and plan 2026-08-20-v2-export-import-and-packs owns the behaviour - read it before designing the route. The export plan has four open tasks that may already cover part of this.
