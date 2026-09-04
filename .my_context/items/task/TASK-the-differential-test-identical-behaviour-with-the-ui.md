---
id: TASK-the-differential-test-identical-behaviour-with-the-ui
type: task
title: "the differential test: identical behaviour with the UI enabled and disabled"
status: active
severity: soft
always: false
summary: Prove that having the web view switched on changes nothing about what the tool does, by running the same work both ways.
summary_of: 7401afdf9b0ce385
scope: []
tags:
  - "plan:rulings"
  - "seq:21"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: ec5c6e578f2ec8bc
plan: rulings
seq: "21"
state: todo
progress: "0"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T14:14:56Z"
needs: rulings/42
---

# the differential test: identical behaviour with the UI enabled and disabled

Ruling R14.4. This is what makes R14's third clause a fact rather than a claim, and this project does not ship claims.

Run the same operations with the UI enabled and with it disabled, and assert IDENTICAL injection text, identical audit records and identical exit codes. It mirrors how the no-writes ban is proven.

Drive BOTH directions. The UI is enabled by default, so the no-effect claim has to hold on the path every install gets - and the disabled path becomes the less-travelled one. Testing only that disabled behaves like today would be testing the branch nobody is on.

Rejected as the proof, and worth recording: a static import-graph check showing nothing outside src/ui/ imports UI code. It proves the CODE is isolated, not that BEHAVIOUR is identical, and the failure R14 exists to prevent is the UI's presence quietly changing what gets injected.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the proof obligation behind ruling R14 s third clause: the UI s presence must not change what gets injected.

ITS OWN REJECTED ALTERNATIVE IS THE PART TO PRESERVE, because a later agent will certainly propose it: a static import-graph check showing nothing outside src/ui/ imports UI code proves the CODE is isolated, not that BEHAVIOUR is identical. That check already exists (test/ui/no-writes.test.ts and the static import-graph test) and is green, which makes it MORE tempting to call this done rather than less. It is not done.

AND ITS SECOND INSTRUCTION IS THE ONE THAT WILL BE SKIPPED: drive BOTH directions. The UI is enabled by default, so the no-effect claim has to hold on the path every install gets. Testing only that disabled behaves like today is testing the branch nobody is on.

NOTE THE INTERACTION WITH plan:rulings seq:42: ui.enabled is read by nothing today, so there is currently no "disabled" path to differ FROM. This test cannot be honestly written until seq:42 is settled.
