---
id: DEC-the-ui-is-developed-against-a-simulated-corpus-until-the
type: decision
title: The UI is developed against a simulated corpus until the screens are finished
status: active
severity: soft
always: false
summary: The screens are built against made-up data containing one of everything, so an empty screen means a bug and not a quiet day; real data comes back at the end.
summary_of: ab24ddd3ce3cc9f5
scope: []
tags:
  - v2
  - ui
  - dogfooding
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 2c6170d800954a6e
---

# The UI is developed against a simulated corpus until the screens are finished

Owner ruling, 2026-08-23, in his own words: i thought it is a good idea to make dogfooding but, while developing the ui it is a disadvantage because not all the data is available for demonstrating that it works the same as it is shown on the mockup, so from now till near the end of the ui development i want you to inject it simulated data in order you could demonstrate me the full featured developed, and let's add a task near the last tasks in the list to return to the real input data.

WHAT CHANGES

Until the UI is finished, screens are developed and demonstrated against a SIMULATED corpus that contains at least one of everything the mockup draws. The real corpus stays exactly as it is and is not written to for demonstration purposes.

WHY, AND IT IS NOT A RETREAT FROM DOGFOODING

Dogfooding found real defects that no fixture would have: the scene grew to 5,888px because 213 real bodies are not five short samples, and the coverage tree rendered 957 unstyled buttons because a real repository is not a handful of sample paths. That value is real and it is kept.

But a real corpus cannot demonstrate a feature it does not happen to exercise, and this project lost a full day to exactly that confusion. The audit stream drew no token bars, no hatched voids and no regime rule because this repository's recent history was fifty consecutive mutations; the tier ribbon drew no ghosts because this corpus does not spill at its real budgets; the activity pulse drew nothing because nothing had happened in the last twenty minutes. Every one of those absences looked exactly like missing code, and each cost a round of investigation to prove it was not.

An absence that cannot be told from a defect is worse than either.

WHAT THE SIMULATED CORPUS MUST CONTAIN

At least one of every audit record kind - mutation, injection, hook, focus, access, progress - spread across the activity pulse's twenty-minute window so the pulse is dense; items in every tier including enough to SPILL at the configured budgets, so ghosts draw; carried index lines; doctor findings; decay bands; relations; and coverage paths that are governed, ungoverned and not examined.

IT ALSO FIXES THE PARITY GATE. e2e/screen-parity.spec.ts compares each screen to its mockup section by element kind, and its ledger flapped run to run because the answer moved with the data - watch measured 15 gaps, then 8, then rect returned when the pulse window emptied. DATA_DEPENDENT exists only to paper over that. Against a fixed corpus the comparison measures the CODE instead of the day, and that exemption can be deleted.

THE RETURN IS A TASK, NOT A HOPE

TASK-return-the-ui-to-the-real-corpus-after-the-screens-are-built is the final UI task and must be the last one executed. Shipping against a fixture is exactly how a product comes to work only on its demo.
