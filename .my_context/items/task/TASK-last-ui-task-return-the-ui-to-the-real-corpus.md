---
id: TASK-last-ui-task-return-the-ui-to-the-real-corpus
type: task
title: "LAST UI TASK: return the UI to the real corpus"
status: active
severity: soft
always: false
summary: Once the screens are finished on sample data, point them back at real data and look at every one, because a fixture hides what real volume reveals.
summary_of: baddb5141a7a51f9
scope: []
tags:
  - "plan:port"
  - "seq:99"
  - "state:todo"
  - v2
  - ui
  - last
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: ba80bc5dd57f9461
plan: port
seq: "99"
state: todo
needs: port/98
---

# LAST UI TASK: return the UI to the real corpus

THIS MUST BE THE LAST UI TASK EXECUTED. Owner ruling 2026-08-23, recorded in DEC-the-ui-is-developed-against-a-simulated-corpus-until-the: the screens are developed and demonstrated against a simulated corpus until they are finished, and then the UI returns to the real one. Shipping against a fixture is exactly how a product comes to work only on its demo.

WHAT RETURNING MEANS, CONCRETELY

Point mycontext ui at the real workspace again and remove whatever made the demo corpus the default - no env var, no flag baked into a script, no path constant left pointing at fixtures.

Delete DATA_DEPENDENT from e2e/screen-parity.spec.ts. It exists only because the ledger flapped against live data; against the fixture the comparison measures the code, and once the fixture is the test corpus the exemption is dead weight that hides real regressions on the watch screen.

Re-run every screen against the REAL corpus and look at each one. The point is to find what the fixture hid - a screen that assumes data it will not always get, an empty state never exercised, a count that is fine at 12 items and wrong at 300. Dogfooding found the 5,888px scene and the 957 unstyled buttons; this pass is where it earns that again.

Confirm the real corpus was never written to for demonstration purposes, and that any fixture records that leaked into it are gone.

Report every difference between the two runs. A screen that looks right on the fixture and wrong on the real corpus is the finding this task exists for.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is TERMINAL by owner ruling. Nothing supersedes it and nothing may be sequenced after it.

ONE THING THE RECONCILIATION SHARPENS. This task says to delete DATA_DEPENDENT from e2e/screen-parity.spec.ts, "because against the fixture the comparison measures the code". That is only true once plan:port seq:94 has made the fixture mirror the mockup s scene. Today the fixture does NOT mirror it -- 200 ask rows against 2, 50 audit rows against 7 -- which is why DATA_DEPENDENT still exists and why it still makes parity a CEILING for eight screens. So the real order is 94, then 93, then 98, then 99, and deleting DATA_DEPENDENT belongs to 94 rather than here.

AND THE SECOND PARAGRAPH IS THE ONE THAT WILL EARN ITS KEEP: re-run every screen against the REAL corpus and look at each one, to find what the fixture hid. The reconciliation has already found the reverse case four times -- code that looked unbuilt because the fixture gave it nothing to draw. The forward case, a screen that is fine at 12 items and wrong at 300, has been seen once (preview s unbounded carried list draws 19 to 26 rows on the owner s corpus and nothing on the fixture) and nothing systematic has looked for more.
