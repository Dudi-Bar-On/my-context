---
id: TASK-the-procedures-screen-has-no-endpoint-behind-it
type: task
title: the Procedures screen has no endpoint behind it
status: active
severity: soft
always: false
summary: The procedures screen has nothing serving it yet, so it cannot be built until that exists.
summary_of: 58037e902139fc3b
scope: []
tags:
  - "plan:api"
  - "seq:2"
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
checksum: d9c96db29bbc01ea
plan: api
seq: "2"
state: done
---

# the Procedures screen has no endpoint behind it

Measured 2026-08-23: of the ten screens the rail lists and the app does not build, six already have their endpoints - ask, work, palette, config, docs and tut - and are pure UI work. This screen is one of the four that has NONE, so the UI task for it is blocked until this lands. That makes these four the long pole to TASK-screen-by-screen-review-walk-the-rail-item-by-item-against (plan:port seq:98), which cannot run until all 21 screens exist. Read the mockup section for the shape of the data it must answer, and the web-ui spec for what a read surface may and may not do - it performs no writes, and a composed command is handed back for the user to run rather than executed. Section data-p=proc. The CLI already has `mycontext procedure [list|show|activate|done|step]`, so the model exists and what is missing is a read route that serves it - the one-shot lifecycle, what is ready, what is running, what is finished.
