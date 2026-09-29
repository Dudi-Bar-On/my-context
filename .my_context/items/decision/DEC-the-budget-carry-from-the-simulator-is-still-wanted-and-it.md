---
id: DEC-the-budget-carry-from-the-simulator-is-still-wanted-and-it
type: decision
title: the budget carry from the simulator is still wanted, and it is built only after a simulation succeeded
status: active
severity: soft
always: false
summary: A user who tries a budget change in the simulator can carry it into the configuration, but only once the simulation has actually succeeded, so a failed experiment can never become a setting.
summary_of: 1f45e66d8c2cb9b5
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 558fba76c04c9da1
---

# the budget carry from the simulator is still wanted, and it is built only after a simulation succeeded

Owner ruling, 2026-09-21, recorded in release phase 2 on 2026-09-22 (runbook 7.3, ruling G). walk/14 asked whether the carry is still wanted after the 2026-09-07 re-cut. Yes; build it, only after a simulation succeeded. Lands in phase 7. Cites TASK-carry-a-successful-simulation-to-config-as-a-pending-budget.

## Relations
- relates_to [[TASK-carry-a-successful-simulation-to-config-as-a-pending-budget]]
