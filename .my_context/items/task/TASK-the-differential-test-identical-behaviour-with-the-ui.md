---
id: TASK-the-differential-test-identical-behaviour-with-the-ui
type: task
title: "the differential test: identical behaviour with the UI enabled and disabled"
status: active
severity: soft
always: false
summary: "The differential is built and green: the same work run with the viewer on and with it off produces identical injected text, identical recorded history and identical outcomes, and the only marks the viewer leaves are its own two bookkeeping entries."
summary_of: 748bb3cc6cd4fa13
summary_was:
  - 2026-09-12 Its blocker is discharged - ui.enabled now has enforcement sites on both sides - and nothing of the test itself has been built.
  - 2026-09-11 Prove that having the web view switched on changes nothing about what the tool does, by running the same work both ways.
acknowledged:
  - task_unverified@7413ed9564f63fe5
scope: []
tags:
  - "plan:rulings"
  - "seq:21"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 7d31d7993778cd53
plan: rulings
seq: "21"
state: done
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

2026-09-12 BUILT, PROVEN, AND CLOSED. `test/ui/differential.test.ts` runs the
same seven operations twice - the SessionStart, PreToolUse, SubagentStart and
Stop hook binaries as real processes, plus `mycontext show`, `mycontext list`
and a real `mycontext add` - once against a workspace whose `ui.enabled` is
true AND which has a real `src/ui/server.ts` child serving it on the port
`ui.port` names, and once against `ui.enabled: false`. It compares the
injection text of all three injection doors byte for byte, stdout and stderr of
every operation, every exit code, every audit record field for field, and every
file under `.my_context/`. The ENABLED path is a real server rather than a flag,
because two sides produced by one code path is the shape that can never go red.

WHAT IT FOUND, AND IT IS NOT NOTHING. The injection text, the exit codes, the
product audit rows and the corpus files are identical. The UI's presence does
add exactly two things: one `access` / `nonce-minted` audit row, written by the
running server when the upkeep's freshness exchange asks it whether its code is
stale, and one file, `state/ui-server-upkeep.json`, the upkeep's own clocks.
Both are the UI recording itself - `ACCESS_OPS` exists for exactly that - so the
test treats them as the UI's footprint rather than as a change to what the
product decided. It does NOT normalise them away: each is pinned as an EQUALITY
in both directions, so a second kind of row, a row written outside `access`, a
second file, or either of them appearing on the DISABLED side, is red. **If the
owner reads R14's "identical audit records" strictly enough to forbid even
that, the repair is one expectation in that test and this item should be
reopened.**

PROVEN BY PLANTING, NOT BY PASSING. Five product plants, each reverted: the
injection made to depend on `ui.enabled` (injection assertion red);
`recordNonceMint` writing outside the `access` kind (product-audit and
access-equality assertions red); the Stop hook's exit status made to carry the
upkeep's outcome (exit-code assertion red); the server writing a second file and
rewriting a shared one (both corpus-file assertions red); and the
`if (!config.ui.enabled)` guard removed from `upkeepUiServer` (the corpus-file
assertions red, which is what makes that line the thing that makes "off" mean
off). Every remaining assertion was reddened at its own line.
