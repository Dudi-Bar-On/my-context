---
id: TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be
type: task
title: "Injection preview: rung 4 of the gate ladder can never be measured, because the per-event scope refusal is on no endpoint"
status: active
severity: soft
always: false
summary: One step of the why-was-this-left-out explanation can never show its workings, because nothing tells the page what a chosen file path excluded.
summary_of: 84ccb4d61a93bb23
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:preview"
  - api
  - "plan:walk"
  - "seq:103"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: d01f08284ad96616
plan: walk
seq: "103"
state: todo
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against screens/preview.js and src/core/select.ts on 2026-08-29"
---

# Injection preview: rung 4 of the gate ladder can never be measured, because the per-event scope refusal is on no endpoint

FOUND 2026-08-29 under plan:walk seq:27, from `screens/preview.js`'s `RUNG_OPENABLE` docstring. It is the one hole left in the gate ladder after `seenFiltered` closed rung 5 on the same day.

THE LADDER'S SIX RUNGS EACH NAME A POPULATION AND, WHERE IT CAN, A LIST. Rungs 1, 2 and 3 (`eligible`, `tier`, `focus`) list their ids under the ladder. Rungs 5 and 6 (`seen`, `budget`) are named IN FULL under `Not delivered` and are counted here with a sentence saying where the list already is. **Rung 4, `scope`, draws no list and its count is not the answer to the question the rung asks.**

WHY. `ItemSummary.gate` says `scope` only in its ITEM-LEVEL form -- an unscoped item under `scopePolicy: "inert"`. The per-event refusal is `matchesScope(item, target, config)` inside `select.ts`'s jit tier, and it is on no endpoint at all. So the items an event's PATH excluded are absent from every response, and the screen cannot place them on the rung that dropped them.

THE SCREEN HANDLES THIS EXACTLY RIGHT AND THAT IS WHY IT IS FILED RATHER THAN FIXED IN PASSING. `rungSentence` puts rung 4 FIRST in its branch order, before the zero case, so it takes `preview.rungunk` whatever its number: a `0` there would claim the event's path excluded nothing, which is precisely the thing nobody measured, and a bare count would be the measured half presented as the whole. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is satisfied. What is not satisfied is the reader's question.

WHY IT IS WORTH SERVING NOW AND WAS NOT BEFORE. `plan:walk seq:58` established that on this corpus 619 of 621 items carry `scope: []` and are unrestricted under the default policy, so the path picker cannot change the answer -- and it closed by DISCLOSING that, which is right. The disclosure says how many items are scoped at all. It cannot say which items a chosen path excluded, because nothing serves that either. The two halves of the same silence were closed and left open on the same screen.

WHAT THE WORK IS: `/api/select` (or `/api/simulate`, which already gained `seenFiltered` for rung 5, and is the closer precedent) serves the ids `matchesScope` removed for the context the selection ran under -- computed against the SAME context, which is what made `seenFiltered` trustworthy. Then rung 4 binds like every other rung, takes the plain count, and its ids list under the ladder beside rungs 1-3.

BOUNDS. Do not derive it in the browser: re-running a glob match client-side is a second implementation of `select()`'s decision, which is the cost this project keeps paying. Do not fold it into rung 4's existing item-level meaning -- an unscoped item under an `inert` policy and a scoped item whose globs missed the path are two different refusals, and if they share a rung the sentence has to say so. And keep `preview.rungunk` in the code: a `tool` event with no path chosen still measures nothing, and that state does not go away when the endpoint lands.
