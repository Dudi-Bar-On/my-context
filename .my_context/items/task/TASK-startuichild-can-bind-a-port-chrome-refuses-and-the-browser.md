---
id: TASK-startuichild-can-bind-a-port-chrome-refuses-and-the-browser
type: task
title: startUiChild can bind a port Chrome refuses, and the browser suite dies on it
status: active
severity: soft
always: false
summary: Tests sometimes pick a network port the browser refuses to use, producing a random failure that looks exactly like a real bug.
summary_of: 1b472e9e56b221b2
scope: []
tags:
  - "plan:port"
  - "seq:11"
  - v2
  - quality
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 510dfc209e5b309a
plan: port
seq: "11"
state: done
---

# startUiChild can bind a port Chrome refuses, and the browser suite dies on it

e2e/app.ts starts the server with --port 0, so the OS picks any free ephemeral port. Chrome and Chromium refuse a fixed list outright - 6000, 6665-6669, 6697 and others - and navigation fails with net::ERR_UNSAFE_PORT before the page loads. Observed on 2026-08-23: a diagnostic run bound 6669 and died with no assertion behind it. In the browser suite this is an intermittent red that reads exactly like a regression and is not one, which this project has already paid for twice. Fix in test/ui/helpers.ts or e2e/app.ts: after startUiChild returns, if the port is in Chrome's blocked set, stop the child and start another. A retry loop of a few attempts is enough - the set is small and the ephemeral range is large.
