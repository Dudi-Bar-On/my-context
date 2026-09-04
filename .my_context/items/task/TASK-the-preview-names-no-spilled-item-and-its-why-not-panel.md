---
id: TASK-the-preview-names-no-spilled-item-and-its-why-not-panel
type: task
title: the preview names no spilled item, and its why-not panel shows a specimen rather than your data
status: active
severity: soft
always: false
summary: The panel explaining what was left out shows a stand-in example instead of your own items, and lists none of them at all.
summary_of: 83497e1d8d5544f5
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:56"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 1827df42b3d70766
plan: walk
seq: "56"
state: done
priority: "1"
source: owner, 2026-08-28
needs: live/7
---

# the preview names no spilled item, and its why-not panel shows a specimen rather than your data

> Owner, 2026-08-28, third report on the Injection preview in one sitting: *"can not see changes to why not, and also there is no place ther for a list of items that did not delivered"*.
>
> **The first half was CLARIFIED and belongs elsewhere**
>
> Asked which they had seen, the owner answered: *"i meant it did not update at all."* Nothing on this screen updates without a reload, and the cause is `plan:live seq:7`. The why-not panel is one of the regions that stays put, along with the ribbon and everything else. **This task does not own that and must not be closed by fixing it.**
>
> What follows is the SECOND half — the missing list — plus the exemplar defect found while measuring, which is the assistant's own finding and not a report from the owner. That defect is LATENT BEHIND `seq:7`: fix the refresh and the panel will redraw and still show the same specimen, so a still-static panel after that fix is not the fix having failed.
>
> **Both halves have one cause, and it is a deliberate design, not a bug**
>
> `screens/preview.js`'s gate ladder builds its picker from ONE EXEMPLAR PER RUNG:
>
>     const hit = corpus.find((item) => rungOf(item) === rung);
>
> `/api/items` is sorted by id, so "the first" is stable by construction — and that is exactly the property the owner is running into. The panel is not showing the reader's selection; it is showing a SPECIMEN of each gate. Change the event, change a budget, change what actually got delivered, and the first-by-id item failing rung 3 is very often the same item it was before. **The panel is stable against precisely the changes the reader is trying to observe.** "Cannot see changes to why not" is that stability, correctly reported.
>
> The second half follows from the same line: an item that spilled is reachable only as rung 5's exemplar. There is no list. `selection.spilled` is in hand — the function two lines above builds `new Map(selection.spilled.map(...))` from it — and it is used ONLY to answer "did this one item spill", a question the reader has to already suspect the answer to.
>
> **Measured against the design of record, because that decides the fix**
>
> The mockup has no such list either. Its whole account of what spilled on this screen is the ribbon's **ghost lane** — `#ribbons`, widths without names. The one place in the product that names spilled items is `sim.ratio` (*"Selected, then not delivered"*), and that is on the SIMULATOR, a different screen answering a different question.
>
> So this is a DESIGN CHANGE, not a parity gap: `RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change` applies and the mockup is edited first, app following — the order used for `cap.warn` and `cfg.nocmd` the same day.
>
> **The argument already on the record, and why it does not refuse this**
>
> `preview.whyn` argues the ladder's shape in the mockup's own words:
>
> > *"the order is the explanation: a list of six reasons is noise, and the one that binds is only meaningful in the position it holds."*
>
> That is an argument against listing **six REASONS**, and it is a good one — the rungs are a closed set and a flat list of them loses the ordering that carries the meaning. It is **not** an argument against listing the **ITEMS that did not deliver**. Reasons are a fixed vocabulary; spilled items are the reader's own data, they differ every run, and their count is the answer to "was my budget too small". Whoever builds this must not read `preview.whyn` as having already refused it — but must also not quietly overturn it: the ladder stays, and the list is a second thing beside it.
>
> **What the list has to get right**
>
> * **It names items, not rungs.** Each row an id and the tokens it cost, in `selection.spilled`'s own order — the selector's candidate order, which the header already records as load-bearing (`[4,9,4]` at 10 spills a different item than `[9,1,5]` does, and the order is why).
> * **Item ids in this corpus reach 67 characters.** `e2e/bidi.spec.ts` records that length as the reason a dangling-edge row puts each id on its own line. The list holds at that width without a horizontal page scroll.
> * **`spilled` is per-tier on the ribbon and whole on the selection.** Decide which this list is and say so; the header already warns that a spilled aggregate is the figure most easily lost between the two.
> * **It must change when the selection changes.** That is the whole complaint. Whatever test lands drives two different events and asserts the list DIFFERS — an assertion the exemplar picker would fail today.
>
> **The exemplar picker itself**
>
> Not necessarily wrong, but it is now known to be unreadable as change. Either it gains an indication that it is showing a specimen rather than the reader's data, or the picker offers the real failing items and the exemplar becomes the default rather than the only option. Settle which, and record the reasoning — this is the second time in one day that a screen has been correct about what it measured and silent about what it left out.
>
> **Done when**
>
> The mockup carries a spilled-items list on the preview screen; the app draws it from `selection.spilled` with ids and costs; a browser test drives two events and asserts the list changes between them and that a 67-character id does not scroll the page sideways; the exemplar picker either discloses what it is or stops being the only route to a failing item; and both string tables carry every new key, with the mockup's Hebrew copy using `{m:...}` markers so `bidi.spec.ts` does not fail on a run-count mismatch.
