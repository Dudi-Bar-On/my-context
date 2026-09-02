---
id: TASK-the-fixture-mirrors-the-mockup-s-own-scene-so-the-two-are
type: task
title: the fixture mirrors the mockup's own scene, so the two are comparable
status: active
severity: soft
always: false
summary: Give the sample project the data each screen's design assumes, so any difference means wrong code rather than different data.
summary_of: e9a24799f92b014e
scope: []
tags:
  - "plan:port"
  - "seq:94"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: b6abf7d960ee2206
priority: "1"
needs: port/95
plan: port
seq: "94"
state: done
---

# the fixture mirrors the mockup's own scene, so the two are comparable

The second rung. Tree parity can only be an EQUALITY if the app is given data that should produce the mockup's scene; otherwise every difference is ambiguous between "wrong code" and "different data", which is exactly the ambiguity `DATA_DEPENDENT` was invented to paper over.

MEASURED TODAY, and it is the pattern: three screens drew nothing because the fixture held no drafts, no procedures and no packs - and each looked precisely like missing code until the endpoint was asked. Four MORE endpoints reported 400 to a probe that omitted their required parameters, which would have read as four more starved screens if believed.

DO: build `.demo-corpus` so that every screen has the data its mockup section draws - the same counts where the mockup shows a count, the same states where it shows a state. Then EMPTY `DATA_DEPENDENT` and let every screen be an equality.

THE GATE'S OWN COMMENTS ALREADY NAME THIS as the real fix, twice, in the watch and preview ledger notes. It has been the answer for a while; it was never the task.

DEPENDS ON seq 95 - the inventory says which screens diverge for data reasons.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, UNBLOCKED, and the reconciliation is raising it to priority 1. It is now the highest-leverage unbuilt thing in the UI plans and it has been sitting behind a dependency that is satisfied.

ITS BLOCKER IS GONE. "DEPENDS ON seq 95 -- the inventory says which screens diverge for data reasons." seq:95 is done, the inventory exists, and it says exactly that.

WHY IT MATTERS MORE THAN IT READS. The reconciliation has now found the SAME FAILURE FOUR TIMES in three days, each time costing a real investigation and twice nearly costing a rebuild of working code:
  decay s heatstrip -- called the worst-built screen on the board; it had been built all along
  preview s carried block and its four disclosures -- plan:walk seq:26 filed as a code gap; `preview.js` · `ctx.t('index.carriedFetch')` · ~1486 builds all five, guarded on a session-start event the fixture does not have
  watch s empty pulse -- a measured zero over a quiet window, indistinguishable from a chart that failed
  three screens drawing nothing because the fixture held no drafts, no procedures and no packs -- recorded in this task s own body, which is where the pattern was first named

EVERY ONE OF THOSE IS THE SAME BUG IN THE MEASUREMENT, not in the product. This task is the fix for the whole class, and until it lands every future finding carries the same ambiguity and the same cost to resolve.

IT ALSO UNBLOCKS seq:93 (pixel parity), and DATA_DEPENDENT -- which makes parity a CEILING for eight screens, so drawing FEWER kinds than the mockup passes -- can only be emptied after it.
