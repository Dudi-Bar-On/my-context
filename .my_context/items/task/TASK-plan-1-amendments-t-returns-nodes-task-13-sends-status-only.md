---
id: TASK-plan-1-amendments-t-returns-nodes-task-13-sends-status-only
type: task
title: "plan 1 amendments: t() returns nodes, Task 13 sends status only, refusals reach the audit log"
status: active
severity: soft
always: false
summary: "Three corrections to an existing plan: how translated text is built, what a refused request tells the browser, and recording refusals."
summary_of: bca16721cb4b4ef8
scope: []
tags:
  - "plan:rulings"
  - "seq:16"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: e7b0c7bf8bd635f4
plan: rulings
seq: "16"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# plan 1 amendments: t() returns nodes, Task 13 sends status only, refusals reach the audit log

ONE task because all three edit docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md. Rulings A1, A4, B4.

A1 - Task 16's t() is specified as template.replace(/\{(\w+)\}/g, ...) returning a STRING. It cannot build an element, and \w excludes the colon, so {m:...} never becomes monospace and {mv:branch} would reach the screen with its braces visible. Respecify t() to return an ARRAY OF NODES: text for plain runs, a monospace bidi-isolated element for {m:} and {mv:}, and a bidi-isolated non-monospace element for the new {b:}. Callers use append(...t(key, vals)). Add a flattening helper for attributes, which cannot hold elements - the mockup's applyLang() already needs one.
A4 - Task 13 stops sending { error: gate.reason }. The browser gets the status and nothing else, so never-rendered becomes structural rather than a comment asking politely.
B4 - a refused request is recorded in the audit log with the check that refused and the submitted Host/Origin. NOTE THE TENSION and resolve it rather than ignoring it: this is a write on a surface whose premise is that it cannot write. It is on the REFUSAL path only, never on a served read, and Task 13's byte-identical assertion must be scoped to say so.
