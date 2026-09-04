---
id: TASK-the-template-packs-screen-has-no-endpoint-behind-it
type: task
title: the Template packs screen has no endpoint behind it
status: active
severity: soft
always: false
summary: The shared-collections screen has nothing serving it yet, so it cannot be built until that exists.
summary_of: 570097894f787db8
scope: []
tags:
  - "plan:api"
  - "seq:4"
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
checksum: e3e0659bef790436
plan: api
seq: "4"
state: done
---

# the Template packs screen has no endpoint behind it

Measured 2026-08-23: of the ten screens the rail lists and the app does not build, six already have their endpoints - ask, work, palette, config, docs and tut - and are pure UI work. This screen is one of the four that has NONE, so the UI task for it is blocked until this lands. That makes these four the long pole to TASK-screen-by-screen-review-walk-the-rail-item-by-item-against (plan:port seq:98), which cannot run until all 21 screens exist. Read the mockup section for the shape of the data it must answer, and the web-ui spec for what a read surface may and may not do - it performs no writes, and a composed command is handed back for the user to run rather than executed. Section data-p=packs. Same plan as Export / import - 2026-08-20-v2-export-import-and-packs - and the two screens likely share a model, so design the route for both rather than twice.
