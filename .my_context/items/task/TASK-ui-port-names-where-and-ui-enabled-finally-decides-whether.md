---
id: TASK-ui-port-names-where-and-ui-enabled-finally-decides-whether
type: task
title: ui.port names where, and ui.enabled finally decides whether
status: active
severity: soft
always: false
summary: Give the web view a fixed address to live at, and finally make its on-or-off setting actually stop it from running.
summary_of: f27dc0322f7ed471
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - config
  - "plan:upkeep"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 79091b8a3271f0e2
plan: upkeep
seq: "4"
state: done
priority: "2"
source: owner, 2026-08-27
---

# ui.port names where, and ui.enabled finally decides whether

This item tracks state only. The task itself is Task 4 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

`ui.enabled` has been validated, refused when malformed, rendered on the Configure screen and consulted by nothing that decides anything since it shipped — `config.ts` says so about itself. This gives it its FIRST enforcement site: `mycontext ui` refuses when it is false, and says which key did it, in the deny hook's own words.

`ui.port` is the opt-in and defaults to absent, because a hook cannot use port 0: an ephemeral port is a URL nobody can bookmark. The CLI's `--port` flag still wins when given.

Its VALUE in this workspace is the owner's — OPENQ-which-port-does-the-ui-upkeep-use-and-is-58888-still-the.
