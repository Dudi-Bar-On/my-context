---
id: TASK-the-differential-test-identical-behaviour-with-the-ui
type: task
title: "the differential test: identical behaviour with the UI enabled and disabled"
status: active
severity: soft
always: false
summary: Its blocker is discharged - ui.enabled now has enforcement sites on both sides - and nothing of the test itself has been built.
summary_of: 6e5e49be7376d4af
summary_was:
  - 2026-09-11 Prove that having the web view switched on changes nothing about what the tool does, by running the same work both ways.
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
checksum: 7f14adf7f1926c0d
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

2026-09-12: UNBLOCKED, STILL OPEN, AND NOT STARTED. Its stated blocker has been discharged. This item ends by saying the test cannot be honestly written until plan:rulings seq:42 is settled, because ui.enabled was read by nothing and there was no disabled path to differ FROM. TASK-ui-enabled-is-accepted-strictly-validated-and-read-by is state done, and the setting now has at least two enforcement sites that a test can drive: src/cli/commands/ui.ts refuses to start the server when ws.config.ui.enabled is false and names the file in the refusal, and src/core/ui-server-upkeep.ts returns did nothing with why disabled on the same condition. So a disabled path exists and BOTH directions are drivable. NOTHING ELSE IS DONE. There is no differential test anywhere in test/ or e2e/ - the word does not appear in either tree - and the rejected alternative this item warns about is still the thing that will be offered in its place: the static import-graph check in test/ui/no-writes.test.ts is green and proves the CODE is isolated, not that BEHAVIOUR is identical. Left by the plan:rulings cluster lane on size rather than on doubt: the assertion is three-way - identical injection text, identical audit records, identical exit codes - over the same operations run twice, which is a new harness rather than an assertion added to an existing one, and it must drive the ENABLED path as the primary case because that is what every install gets.
