---
id: TASK-the-demo-corpus-cannot-trip-a-single-list-bound-so-paging-is
type: task
title: the demo corpus cannot trip a single list bound, so paging is never exercised on served data
status: active
severity: soft
always: false
summary: The sample data is too small to ever fill a list, so the paging controls are never exercised against anything the app really serves.
summary_of: a6a85cbd5f29f0a3
scope: []
tags:
  - v2
  - ui
  - fixture
  - e2e
  - lists
  - "plan:port"
  - "seq:94b"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 50d42a8defbc394e
plan: port
seq: 94b
state: todo
priority: "2"
source: "found building plan:walk seq:54, 2026-08-27"
---

# the demo corpus cannot trip a single list bound, so paging is never exercised on served data

FOUND 2026-08-27 while building the paging control (plan:walk seq:54), and reported by the agent rather than worked around -- which is the part worth keeping.

MEASURED IN `.demo-corpus`: preview delivers **4** rows against a cap of 20; injected has **0** against 50; packs has **1** against 50. **Not one bounded surface in the fixture exceeds its own bound**, so no served screen in the e2e suite ever draws the Previous/Next control at all.

WHAT THE AGENT DID INSTEAD, and it was right: it asserted condition 3 (a list holding back nothing draws NO control) against the real served data -- which the fixture CAN prove -- and MOUNTED the shipped `boundedList` inside the running app, through the browser's own `/screens/parts.js`, `/lib/i18n.js` and `/strings/*.js`, to exercise the paging paths. Real module, real strings, real DOM; only the data is synthetic.

**WHAT IT REFUSED TO DO, and this is the finding.** Lowering a cap to make the fixture trip would have turned every paging assertion green against a bound no user ever meets. `screen-parity.spec.ts`'s own header names that edit as the one that makes a gate worse than nothing -- and this project has read a fixture gap as a code gap six times already (`plan:port seq:94`).

SO THE GAP IS THE FIXTURE'S, and it is the same class `seq:94` was filed for: **a feature the demo corpus cannot demonstrate looks exactly like a feature that does not work.** The five bounded surfaces are the delivered rows, the carried index lines, the injection rows, the packs and the revisions. `scripts/demo-corpus.ts` would need a session with more than 20 delivered items, and more than 50 injection rows, for the served screens to draw a control at all.

DONE WHEN: at least one served screen in `.demo-corpus` draws the Previous/Next control, and the e2e spec exercises it through the app rather than through a mounted module -- with the mounted-module tests KEPT, because they cover the take-last direction and the display-only wording that one fixture session would not.
