---
id: TASK-give-every-screen-an-implementing-task-starting-with-the
type: task
title: give every screen an implementing task, starting with the five that have none
status: active
severity: soft
always: false
summary: Every screen should have a written statement of what it is and what it refuses, so someone can build it without opening the design file.
summary_of: b4ddcda8e2112906
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - mockup
  - "plan:walk"
  - "seq:27"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: d21df52191c9f5fe
plan: walk
seq: "27"
state: done
priority: "1"
source: owner requirement 2026-08-25
---

# give every screen an implementing task, starting with the five that have none

Carries out the requirement that every screen has a task that implements it, until the mockup is no longer needed.

FIVE SCREENS HAVE FINDINGS AND NO TASK NAMING THEM, measured 2026-08-25:
  decay      18 findings   the largest list on the board
  work       11
  coverage    5
  learn       4
  injected    1

FIRST, VERIFY THE ZEROES. The match was by keyword -- rail label, module filename, `screen:` tag -- so a task that names a screen some other way reads as absent. Check each of the five by reading before writing anything. A duplicate task is worse than a missing one because two agents will build from both.

THEN, WHAT AN IMPLEMENTING TASK IS, and it is not what most of the existing ones are. The board is full of tasks about a screen s DEFECTS -- "the chip is invisible", "the ladder is missing". An implementing task says what the screen IS: what question it answers, what it reads, what it draws, what it refuses and why. When that task exists, a person can build the screen without opening the mockup, which is the whole point.

THE MODEL ALREADY EXISTS, in the screen modules themselves. `packs.js`, `coverage.js` and `docs.js` open with exactly that: what the screen is for, what it refuses, and why it draws nothing weaker in its place. Those headers are the specification, written after the fact and living in the code rather than in the corpus. Much of this task is moving what is already written into a place a query can reach.

DO NOT WRITE TWENTY-ONE OF THESE FROM THE MOCKUP. Write them from the module header, the mockup section and the rulings already taken, and where those three disagree, that is a finding rather than a wording problem.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and the reconciliation sharpens its first instruction rather than its list.

ITS OWN WARNING WAS RIGHT AND IS NOW PROVEN. It says "FIRST, VERIFY THE ZEROES. The match was by keyword ... a task that names a screen some other way reads as absent." The reconciliation established that condition 1 of REQ-every-screen-has-a-task-that-implements-it-until-the-mockup is ALREADY MET, 21 of 21, by tasks the keyword match could not see -- ui1/17, ui1/18, ui1/19, ui2/11-13, ui3/11-12 and port/4, 5, 5b, 7, 8, 8b. So the five "NO OWNER" screens have owners. THE ZEROES WERE AN ARTEFACT.

THAT DOES NOT CLOSE THIS TASK; it changes what it is for. The distinction this task draws is the real one and it survives: the existing tasks say what the screen was BUILT FROM. An implementing task says what the screen IS -- what question it answers, what it reads, what it draws, what it refuses and why -- so a person can build it without opening the mockup. That is condition 3, and condition 3 is not met.

AND ITS BEST INSTRUCTION IS THE ONE TO FOLLOW LITERALLY: the model already exists in the screen modules themselves. packs.js, coverage.js and docs.js open with exactly that specification, written after the fact, living in code rather than in the corpus. MUCH OF THIS TASK IS MOVING WHAT IS ALREADY WRITTEN INTO A PLACE A QUERY CAN REACH -- which is the same sentence as the reconciliation s own purpose.

ONE SCREEN HAS NO PLAN AT ALL and should be first: Tutorials. plan:port seq:5d records that the mockup is its only specification, and that twelve hard-coded cells assert checkmarks about content nobody checks, one of them true of no file on disk.

RE-MEASURED 2026-08-29, from the code and not from memory. `SCREENS` in `src/ui/public/app.js` registers 21 loaders and `NAV` lists all 21 across four groups, so the register is unchanged. Every screen was matched against every live task item on four spellings at once -- `screens/<name>.js`, a bare `<name>.js`, the route `#/<name>`, and the `screen:<name>` tag -- plus the rail label from `strings/en.js`, so a task naming a screen any of those ways is visible.

THE FIVE ZEROES ARE NOW ZERO, AND THE ARTEFACT IS GONE FOR GOOD. All five -- decay, work, coverage, learn, injected -- are claimed by an open or closed task today, and so are the other sixteen. The claiming set is the one the 2026-08-25 reconciliation named, and it still covers 21 of 21: ui1/17 (preview, coverage, gaps, simulate, injected), ui1/18 (coverage, gaps, graph), ui1/19 (doctor, decay, status, learn), ui2/11 (work), ui2/12 (palette), ui2/13 (config), ui3/11 (watch), ui3/12 (ask), port/4 (capture), port/5 (tut), port/5b (docs), port/7 (proc), port/8 (packs), port/8b (port). NO SCREEN HAS NO TASK. Condition 1 is met and stays met.

CONDITION 3 IS WHAT IS LEFT, and the five screens whose owing work was untracked now have it, written from the module headers rather than from the mockup:
  walk/87  Relations -- nothing chooses the item the ego graph is drawn around. HELD on port/94 and walk/44: the demo corpus carries no relations, so the screen has never been seen drawing an edge.
  walk/88  Learn -- the categories row cannot draw the cross-link ln.v makes the screen conditional on, because /api/help/categories serves a tally and no item id.
  walk/89  Status and Export / import -- the em dash is correct at both sites and no key can say why; Status's two queue counts are held out by the no-writes import boundary, Port's buckets by there being no import surface at all.
  walk/90  Coverage gaps -- gaps.cat is `category {m:open_question}`, a literal, so fifteen empty categories can never be named; the fix is one word in the design of record.
  walk/91  Decay -- #deccaveat is undrawn, so nothing on the screen says that cold means twenty SESSIONS rather than twenty days; the mockup writes its three sentences in script and no table declares a key.

SIXTEEN SCREENS STILL HAVE NO IMPLEMENTING TASK. Their owing work is tracked -- every one of them has open defect tasks, and the three largest silences are already owned elsewhere: plan:screens seq:10s holds the nine facts the engine computes and no key can say (Capture's notGoverning, the Composer's glob count and dead_scope sentence, Configure's four states, and Packs' quarantined/dropped/missing), plan:port seq:5d holds Tutorials' twelve hard-coded cells, and plan:ui1 seq:17e holds the truncation paths Coverage and Coverage gaps both want. What those sixteen lack is the sentence that says what the screen IS, and it exists in each module's own header waiting to be moved.
