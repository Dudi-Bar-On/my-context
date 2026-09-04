---
id: TASK-preview-does-not-draw-the-four-carried-line-disclosures-or
type: task
title: preview does not draw the four carried-line disclosures, or the carried item block
status: active
severity: soft
always: false
summary: What a session inherited from an earlier one is already shown; it looks missing only because a sample session has nothing to inherit.
summary_of: 8917551cef7e490b
acknowledged:
  - citation_form@91adea82dad3dd08
scope: []
tags:
  - v2
  - ui
  - "screen:preview"
  - tree-parity
  - "plan:walk"
  - "seq:26"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3b5df42159f76dde
plan: walk
seq: "26"
state: done
priority: "2"
source: "plan:port seq:98, preview"
---

# preview does not draw the four carried-line disclosures, or the carried item block

Found walking preview, 2026-08-25, on the LANDING SCREEN.

The design of record draws four disclosure paragraphs the app does not:
  "4 items, 4,260 of 6,000 tokens"
  "3 index lines carried from session a3f9c1 - billing-refactor"
  "2 carried ids got no line: INV-prices-are-integer-cents (delivered in ...)"
  "1 of this session s own lines displaced to make room: RULE-round-half-..."
and the `div.carrieditem.small` block beside them.

ALL FOUR ARE ABOUT CARRIED INDEX LINES -- what a child session inherited from its parent thread, what got no line, and what was displaced to make room. That is the most consequential thing this screen can say and none of it is on screen.

WHY IT MAY NOT BE A CODE GAP: the walker calls the carried item block AMBIGUOUS, so the screen s own module can build it. A demo session with no parent thread carries no lines, and then every one of these paragraphs is correctly absent. ESTABLISH WHICH before building anything -- this is exactly the shape that made decay look like the worst screen on the board when its heatstrip had been built all along.

AND IT OVERLAPS TWO OLDER TASKS, which is why plan:walk seq:23 exists: plan:screens seq:1s-e ("the carried id list is unbounded and the mockup has no more affordance for it") and seq:1s-d ("the carried item block is BUILT and the mockup still badges it PROPOSED"). The second says it is built. Reconcile before dispatching.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: THE QUESTION THIS TASK ASKED IS ANSWERED, AND THE ANSWER IS NO. IT IS NOT A CODE GAP. Read this before doing anything.

This task said "ESTABLISH WHICH before building anything -- this is exactly the shape that made decay look like the worst screen on the board when its heatstrip had been built all along". Established, by reading the code:

  `src/ui/public/screens/preview.js` · `ctx.t('index.carriedFetch')` · ~1486 builds ALL FIVE things this task lists -- the preview.carried paragraph, the .carrieditem blocks, index.carriedDropped, index.carriedDisplaced and index.carriedFetch.
  Every one is guarded on IndexSummary.carried being non-null, and the dropped and displaced lines additionally on their arrays being non-empty.
  `src/ui/read-model.ts` · `if (event === 'session-start' && root !== null) ctx.carried = resolveCarry(root, session)` · ~364 resolves that field for exactly one event: `if (event === 'session-start' && root !== null) ctx.carried = resolveCarry(root, session)`.

THE FIXTURE IS NOT A SESSION-START WITH A RESOLVED ROOT, so it carries nothing, so a correctly-built screen correctly discloses nothing. Fourth time in three days that the fixture has made working code look unbuilt. The fix for the whole class is plan:port seq:94, now at priority 1.

AND THE OVERLAP THIS TASK FLAGGED IS ALSO SETTLED. plan:screens seq:1s-d ("the carried item block is BUILT and the mockup still badges it PROPOSED") and this task CONTRADICTED each other outright. Both were right about different things: built in code, absent in the fixture.

WHAT SURVIVES, AND IT IS NOT NOTHING: plan:screens seq:1s-e is a REAL defect this task could never have seen -- the carried list is unbounded, `preview.js` · `const carriedLines = index.normative.filter((line) => line.carried === true);` · ~1453 loops every carried line and draws one block each. On the fixture: zero. On the owner s own corpus: nineteen to twenty-six, photographed, pushing two graphics off the screen. INVISIBLE TO EVERY GATE, VISIBLE ON THE FIRST REAL SESSION.

CITATION DRIFT, checked 2026-09-03. The loop cited above still exists and is no longer unbounded: it goes through the house's one `boundedList` (`preview.js` · `const carriedBound = boundedList(ctx, carriedHost, carriedLines, (indexLine) => {` · ~1454). The hint is current; the "unbounded" half of the sentence is not.
