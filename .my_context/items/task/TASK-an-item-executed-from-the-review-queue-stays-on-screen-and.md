---
id: TASK-an-item-executed-from-the-review-queue-stays-on-screen-and
type: task
title: an item executed from the review queue stays on screen and the rail count never moves
status: active
severity: soft
always: false
summary: After approving something from the queue it stays on screen and the count beside it never moves, so the action looks as though it failed.
summary_of: 012c3e38ad7974f3
scope: []
tags:
  - v2
  - ui
  - work
  - shell
  - walk
  - "plan:walk"
  - "seq:120"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/exec-refresh.md"
source_anchor: null
source_checksum: 53735a21f1fda04f
valid_from: 2026-08-31
valid_until: null
checksum: 3d313e574b82a920
plan: walk
seq: "120"
state: done
priority: "1"
source: owner report, 2026-08-31
---

# an item executed from the review queue stays on screen and the rail count never moves

> > Owner report 2026-08-31: after pressing Run on a Review queue item, the item stays in the queue, the page does not refresh, and the gold count beside Review queue in the rail does not change.
>
> **Three separate causes, measured in the code, not one**
>
> 1. **`work` is `refresh: 'ask'`.** `SCREEN_INVALIDATION` declares `work: { kinds: ['mutation'], refresh: 'ask' }` — so even when it notices, it offers the affordance instead of redrawing.
> 2. **It may not notice at all.** Accept and Reject run `review promote` / `review discard`, which write **`execution`** records (`execute`, `execute-done`) alongside the `mutation`. `work` declares only `mutation`, so whether the stream wakes it depends on the ordering of two record kinds, one of which the row does not declare.
> 3. **The rail count never updates, ever.** `paintRailCounts()` is called from `route()` and from nowhere else, and `CHROME_REFILL` has entries for `repo`, `corpus`, `session`, `audit` and `prov` — **and none for the rail.** The strip's five groups refresh live; the rail counts do not. This is a defect on its own: the badge would still be wrong even if the screen redrew perfectly.
>
> **The distinction the fix turns on, and it must not be flattened**
>
> `refresh: 'ask'` is right and `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` settles it — `plan:walk seq:64` measured a refresh discarding three of the owner's selections in one act. **But that ruling is about a change someone ELSE made.**
>
> A change the reader **just made through the app's own Execute control** is a different event. They pressed Run; they know what happened; asking "shall I refresh?" is the app pretending not to know something it does know, and a settled item still sitting in the queue is worse than a lost scroll position.
>
> **So: an action taken through Execute refreshes the screen it was taken on, and the rail with it. An external change on that same screen still asks.** Those are two events that today collapse into one path.
>
> **What this must not break**
>
> * **The single-slot guarantee.** `showLiveAffordance` holds one `pendingScreenRefresh`, and every screen's `render()` opens with `root.replaceChildren()` while six of them then await an endpoint and append. Two overlapping renders each clear an empty section and each append a whole screen — measured: three hash writes in one turn drew **nine `<h3>` where one render draws three**. An Execute-driven refresh must go through the same single slot, not around it.
> * **Do not refresh before the write has landed.** `execute-done` is the record that says the run finished; refreshing on `execute` would redraw the queue mid-flight and could show the item still there, which is the reported symptom with extra steps.
> * **The rail badge counts BOTH queues** as of 2026-08-30 — `pendingRevisions.revisions + reviewQueue.drafts`. Whatever refreshes it must keep that; reading one is how it came to say 0 with a draft on screen.
>
> **Done when**
>
> Pressing Run on a Review queue item removes it from the queue without a manual refresh; the rail's gold count moves in the same act; an external change to that screen still offers the affordance rather than redrawing; and a browser test drives a real promote through Execute and asserts all three — the row gone, the count decremented, and exactly one render on the section.
