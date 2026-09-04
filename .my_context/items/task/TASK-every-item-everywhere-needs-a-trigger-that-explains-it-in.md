---
id: TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in
type: task
title: every item everywhere needs a trigger that explains it in one place, and the summary is corpus data
status: active
severity: soft
always: false
summary: Every item can be opened to a short plain-language explanation, written ahead of time and stored with it, which says so when it is missing or out of date.
summary_of: 9f7033162d0dce3b
summary_was:
  - 2026-09-01 Every item gets a short plain-language explanation, written in advance and stored with it, so anyone can tell what it is at a glance.
scope: []
tags:
  - v2
  - ui
  - pane
  - walk
  - "plan:walk"
  - "seq:119"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/explain.md"
source_anchor: null
source_checksum: 04ec375a500dd750
valid_from: 2026-08-31
valid_until: null
checksum: 425a8cecd1085c93
plan: walk
seq: "119"
state: todo
priority: "1"
source: owner ruling, 2026-08-31
---

# every item everywhere needs a trigger that explains it in one place, and the summary is corpus data

> > Owner ruling 2026-08-31: every item, everywhere in the app, without exception, gets a trigger that shows a **simple summary explaining it** — and the summary is produced by **Claude Code itself, as an ordinary prompt. No external API.**
>
> **The constraint decides the architecture, so take it first**
>
> The browser cannot call a model, and this product has zero runtime dependencies and no key to spend. So the summary cannot be fetched on demand.
>
> **Therefore the summary is CORPUS DATA, not a request.** It is written by an agent through the ordinary capture path — the same door every other item write uses — and the app merely **displays** it. That is the only design that satisfies "no external API" without inventing a service, and it matches what this app already is: it reads, and it composes commands for a human to run.
>
> Two consequences worth stating rather than discovering:
>
> * **A summary can be missing**, and a missing one is a measured absence, not a blank. Where it is absent the trigger composes the command that would generate it — the same compose-then-Execute pattern the Review queue and Configure already use.
> * **A summary can be STALE.** The item's body moves; the summary does not. It needs the same treatment every other derived thing here gets — either a checksum of what it was written against, or it says when it was written and against what. **An explanation that silently describes an older item is worse than none**, and this project has now corrected five stale justifications in three days for exactly that reason.
>
> **Where the trigger goes, per surface — and they genuinely differ**
>
> 1. **Every id on every screen** — `linkId()` in `screens/parts.js` renders `button.linkid`, and ten screens use it, so **every id in the app already opens the item detail pane**. The pane is therefore the one place that reaches almost everything, and the trigger belongs there rather than on ten screens. **One insertion point, no per-screen work.**
> 2. **The Relations graph** — nodes are SVG `<text>`, not buttons. A `button` cannot be nested there, so this needs its own affordance: selecting a node already changes the screen's state, so the summary belongs in whatever panel that selection drives, not on the node.
> 3. **The budget ribbon's segments and ghosts** — these are `div`s sized by data and identified only by a `title`. They are the one place an item appears with **no id rendered at all**. Either they gain a reachable id or they are named as out of scope — decide, do not skip.
> 4. **Composer and Capture** — these compose an item that does not exist yet. There is nothing to explain. **Name them as deliberately excluded**, so "without exception" has a written boundary rather than an accidental one.
>
> **Rulings**
>
> * **One implementation, in the pane.** Ten screens each growing an Explain button is the hand-kept-list defect this project has now measured five times, in a different costume.
> * **The generation path is a composed command, never a hidden call.** Whatever writes the summary goes through `mycontext`, is auditable, and is visible to the owner before it runs.
> * **The summary is for the item as it is, not as it was.** Store what it was written against.
> * **It must be keyed in both string tables** — every user-facing sentence here is.
>
> **Done when**
>
> Every id-bearing surface reaches a summary through one implementation; the graph and the ribbon are each either covered or named as out of scope with a reason; a missing summary is drawn and named rather than blank; a stale one says so; and a browser test drives the trigger from at least three different screens to prove the single implementation genuinely reaches them.
