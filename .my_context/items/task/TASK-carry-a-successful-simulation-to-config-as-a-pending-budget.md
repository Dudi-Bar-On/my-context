---
id: TASK-carry-a-successful-simulation-to-config-as-a-pending-budget
type: task
title: carry a successful simulation to config as a pending budget change
status: active
severity: soft
always: false
summary: After trying out a setting and liking the result, carry it straight to the settings screen as a proposed change instead of retyping it.
summary_of: 0c7f8c085bca9823
scope: []
tags:
  - v2
  - ui
  - "screen:config"
  - "screen:simulate"
  - builder
  - mockup
  - "plan:walk"
  - "seq:14"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 1567710a16b1fe69
plan: walk
seq: "14"
state: todo
priority: "1"
needs: walk/7, walk/10, walk/13
source: owner ruling 2026-08-25
---

# carry a successful simulation to config as a pending budget change

Carries out the ruling that a budget is chosen by simulating it.

THE FLOW: drag the budget on simulate, read the staircase, and when the number is right, take it forward. config shows it as a pending line in the patch, alongside any other tiers already carried. The user applies the patch.

BOTH ENDS ARE MOCKUP ADDITIONS. The design of record draws neither, so it is edited first and the app follows -- same shape as the config composer, plan:walk seq:13:
1. simulate: a control to take the current tier and budget forward. Enabled only after a simulation has SUCCEEDED; a budget nobody evaluated may not be carried.
2. config: the pending set, shown as the patch, with a way to remove a line. The Apply this card already draws the patch shape -- one changed line today, several now.

THE VALUE TRAVELS IN THE URL, beside the screen name the hash already routes. A malformed one is NAMED AND REFUSED, never silently applied -- the same rule `apiSimulate` already follows on its own query, refusing anything that is not digits rather than letting `Number("")` become a budget of 0 and a chart to match.

A KNOWN LIMITATION, RULED IN DELIBERATELY AND WRITTEN DOWN SO IT IS NOT DISCOVERED LATER: each carried line was simulated ON ITS OWN, against the config as it stood. Carry jit, then carry pinned, and the second simulation did not know about the first -- so the combined patch can behave differently from either simulation that produced it. The owner chose accumulation knowing one-at-a-time has the same flaw and costs three trips to the file.

THE UPGRADE PATH IS ALREADY BUILT, if this bites: `POST /api/config/preview` takes a CANDIDATE CONFIG, so re-running the preview over the whole pending set gives the true combined effect rather than a stack of independent what-ifs. That is the third option the owner was offered and it remains available at any time. Until then the screen must not imply the combined patch was simulated as a whole.

Depends on plan:walk seq:7 (the staircase, so there is a rung to pick), seq:10 (the delta plate, which is where a carried change lands) and seq:13 (the composer this is part of).

UNBLOCKED 2026-08-25 by DEC-claude-drafts-the-mockup-and-the-owner-approves. It still follows seq:13, because a budget cannot be carried INTO a composer that does not exist.
