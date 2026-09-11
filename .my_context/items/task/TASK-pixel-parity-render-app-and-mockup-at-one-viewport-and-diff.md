---
id: TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff
type: task
title: "PIXEL parity: render app and mockup at one viewport and diff them"
status: active
severity: soft
always: false
summary: Compare pictures of the real app against the design to catch spacing, colour and size differences that structural checks cannot see.
summary_of: f0d47de7e846dcb8
scope: []
tags:
  - "plan:port"
  - "seq:93"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 87e85e8a7cddd663
plan: port
seq: "93"
state: todo
needs: port/94
---

# PIXEL parity: render app and mockup at one viewport and diff them

The third rung, and the only version of "1:1" that cannot be argued with.

Tree parity catches structure; it says nothing about spacing, colour, weight or size. `styles-parity` carries CSS byte-identically, but only for the selectors it is handed - and the item detail pane proved what that misses: `plan:repaint seq:9c` rescoped the whole `#pane` block after a collision, real work on the mockup, for an element the app did not have. Six rules, unmeasured, because there was nothing to measure them against.

DO: screenshot each screen in the app and the corresponding mockup section at one fixed viewport, and diff. Playwright already provides the comparison; what it needs is seq 94's fixture, or the diff is data noise.

EXPECT TO RULE ON A TOLERANCE, and rule on it deliberately: font rasterisation differs between a headless run and a real browser, and this suite runs BOTH Chromium and real Chrome. A tolerance chosen to make a run green is a gate that measures nothing.

DEPENDS ON seq 94.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and its dependency is REAL rather than stale -- unlike three other blockers this reconciliation has cleared.

DEPENDS ON seq:94, which is still open. Without the fixture mirroring the mockup s scene, a pixel diff is data noise: this corpus draws 200 ask rows against the mockup s 2, 50 audit rows against 7, 26 coverage buttons against 7. Nothing about those diffs is a defect and all of them are red pixels.

THE TOLERANCE WARNING IN THIS TASK IS THE IMPORTANT PART and it should survive into whoever builds it: this suite runs BOTH Chromium and real Chrome, font rasterisation differs between them, and a tolerance chosen to make a run green is a gate that measures nothing. That is the same failure this project has now recorded five times in different clothes -- a gate measuring what it was pointed at.

SEQUENCE: 94, then 93.

2026-09-11 -- THE SCALE GAP THIS TASK INHERITED, MEASURED, AND HALF CLOSED.

THE DEPENDENCY WAS SATISFIED AND ITS DELIVERABLE WAS GONE. This task carries `needs: port/94`,
and port/94 is marked `done`. What port/94 delivered was `.demo-corpus`, and
`INSTR-testing-happens-against-the-current-corpus-and-an-exception` retired that on 2026-09-07.
So this task inherited a satisfied dependency with nothing behind it, and nothing said so. The
seeded throwaway twins the owner approved on 2026-09-11 replaced `.demo-corpus` for STATE and not
for SCALE: they can make a draft exist or a selection spill; they cannot make a screen draw 122
nodes where it draws 19,215.

BEFORE, MEASURED BY THE INSTRUMENT ITSELF: 7 of 21 screens comparable, 14 refused. Eleven of the
fourteen refusals were SCALE alone -- the two sides drawing different amounts of the same thing.
Three were ABSENCE.

WHAT WAS BUILT. A bounded core sample of THIS corpus, computed by code from the corpus as it
stands, put in a throwaway copy and deleted with it. It is not a fixture and cannot rot into one:
every item in it is the owner's, byte-identical, with its own id, its own relations and its own
scope, and every repository file in it is his. Relation components and `needs` components are kept
WHOLE, so the sample invents no `orphan_relation` and no `needs_unresolved`; one real file is kept
per surviving `scope` glob, so it invents no `dead_scope`. The walk asks full scale FIRST and the
reduced twin only where full scale refuses, so a screen comparable against the corpus as it stands
stays measured against it -- and every finding now says which scale it was taken at.

AFTER, MEASURED THE SAME WAY, chromium, 2026-09-11: 11 of 21 comparable. Seven against the corpus
as it stands (decay, status, work, proc, port, packs, learn) and four against the reduced twin:
preview 398 against 242, injected 62 against 34, watch 427 against 218, graph 123 against 81.

WHAT STILL CANNOT BE COMPARED, AND THE THREE REASONS ARE NOT THE SAME REASON:

  ABSENCE, not scale -- gaps, docs, tut. The design names them and the app rail does not have
  them; the app draws nothing in those sections at either scale. No seed can fix that and none
  should try. It is a rail question for port/98.

  THE APP'S OWN CHROME -- capture 79 against 22, config 304 against 127. Neither count moved by a
  single node when the corpus went from 1,103 items to 41, because what those screens draw is the
  category vocabulary and the settings form rather than the corpus. They are real app-against-
  design divergences, and they are port/98's to rule on rather than anything a corpus can change.

  A CHROME FLOOR UNDER A REAL REDUCTION -- coverage 408 against 122, palette 150 against 51,
  simulate 645 against 213, ask 490 against 137, doctor 132 against 55. Every one of these shrank
  enormously (doctor from 1,427, palette from 1,396, coverage's tree from about 1,543 walked files
  to 16) and every one is still past 2x, because the screen's static structure alone is more than
  twice the design's section. doctor at 2.40x is the closest of them; a smaller sample might cross
  it and would push preview, watch and graph out the other side, so it was not chased.

TWO THINGS THE SECOND RUN SAID THAT THE FIRST DID NOT. The walk was run twice, and both runs
reported the same 11 of 21. Two differences between them are worth carrying:

  A TRANSIENT REFUSAL ON coverage. On the first run the full-scale coverage screen drew 5 nodes
  rather than 19,269 -- `/api/coverage` answered with an error and the screen drew the error. On
  the second it drew 19,269. So it is a flake rather than a regression, and coverage's verdict is
  unchanged either way; but a screen that refuses and a screen with nothing to draw were
  indistinguishable in this instrument's output, which is a defect of the instrument rather than
  of the product.

  SO THE WALK NOW NAMES A DRAWN REFUSAL, and it caught one on its first run: at mockup scale the
  watch screen draws `errorNote`'s own wording with an empty message after it -- "Refused. The
  wording is the system's own and is not translated:" -- while the rest of that screen renders. It
  is counted COMPARABLE there, and a reader should know that part of what was compared is a
  refusal. Which endpoint said no, and whether it also says no at full scale, is not established
  here.

THE PART THAT IS THE OWNER'S TO SAY. The instruction that records his exception says the copy is
"the same items, the same ids, the same scale". This reduction changes the scale, so it is a
WIDENING of that exception rather than a use of it. It is derived rather than authored, it is
confined to this walk, and the byte-identical assertion now covers both halves of what it could
damage -- the corpus and the repository files around it. It still wants his yes.

THIS TASK IS NOT CLOSED BY THAT WORK. port/98 is the screen-by-screen review and the owner closes
screen work: `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`.
