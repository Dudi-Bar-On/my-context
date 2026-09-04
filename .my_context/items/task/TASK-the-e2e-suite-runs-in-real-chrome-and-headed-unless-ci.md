---
id: TASK-the-e2e-suite-runs-in-real-chrome-and-headed-unless-ci
type: task
title: the e2e suite runs in real Chrome, and headed unless CI
status: active
severity: soft
always: false
summary: Run the browser tests in the real browser people actually use, and on screen, so somebody can watch them happen.
summary_of: aef5c1fa22e4b8cd
scope: []
tags:
  - "plan:fixes"
  - "seq:3"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 932bca7fe16b3487
plan: fixes
seq: "3"
state: done
---

# the e2e suite runs in real Chrome, and headed unless CI

Owner ruling 2026-08-22, twice. channel: chrome as a second project, because bundled Chromium and shipped Chrome differ where this app lives and the browser the owner opens is the one that decides. headless keyed on CI, because a headless run is an agent reporting numbers over a page nobody watched. Landed fb5f0fc and dfcc87e.
