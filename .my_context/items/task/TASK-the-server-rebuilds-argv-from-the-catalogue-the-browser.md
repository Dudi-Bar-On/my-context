---
id: TASK-the-server-rebuilds-argv-from-the-catalogue-the-browser
type: task
title: the server rebuilds argv from the catalogue the browser composed from
status: active
severity: soft
always: false
summary: The page sends only which command and which values; the server builds the real command itself, from the same shared list.
summary_of: a3bac1625d838202
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 481393b4521d3647
plan: execute
seq: "1"
state: done
priority: "1"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# the server rebuilds argv from the catalogue the browser composed from

This item tracks state only. The task itself is Task 1 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

ONE catalogue, imported by both. `palette-defs.js` is plain ESM with no DOM reference and `capture-model.ts` already cites it as the authority; two catalogues would drift, and the drift would be silent in exactly the direction that matters — the browser showing one command in a confirm while the server ran another.

The client sends an ID and values, NEVER argv. A request naming a command the catalogue does not have is a 400, not a sanitisation problem. Free-text arguments carrying a NUL, a newline or a bidi override are REFUSED rather than stripped: `pack import --name` shipped accepting both, measured, and here the lie matters more — the confirm dialog's whole job is that what renders is what runs.

An entry with no boundary flag resolves as ON the boundary. A stale classification then costs ceremony, never a silent write.
