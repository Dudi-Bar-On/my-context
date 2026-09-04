---
id: TASK-four-watch-strings-the-mockup-builds-in-script-have-no-key
type: task
title: four watch strings the mockup builds in script have no key, so they render English inside the Hebrew UI
status: active
severity: soft
always: false
summary: Four labels on the activity screen stay in English for a Hebrew reader, and an empty chart still never says it is empty rather than broken.
summary_of: 8dd8e7115295b7a4
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: 93db174d82666660
valid_from: 2026-08-22
valid_until: null
checksum: 9a71ff975af165d8
plan: ui3
seq: 11x
state: done
verified_on: 2026-09-04
---

# four watch strings the mockup builds in script have no key, so they render English inside the Hebrew UI

> `test/ui/strings-parity.test.ts` compares both string tables against the mockup's `data-t` set in BOTH directions, so a key can only be added to the tables after the mockup declares it. These four are on the Audit stream and the mockup builds each inside a `HEB ? … : …` ternary in script, which is the exact defect the mockup records having fixed in its own provenance bar:
>
> 1. **`regime change · `** — the label on every focus row (`renderAudit`, the `kk==='focus'` branch). `screens/watch.js` transcribes the English literal, so a Hebrew reader sees English on that row. `watch.sub` carries the concept in both languages, so the meaning is not lost — only this row's label.
> 2. **The pulse's accessible name** — the mockup's `renderPulse` passes a ternary as the chart's `aria-label`. The screen uses `tFlat('watch.pulsen')` instead, which is keyed and is the design's own sentence about that graphic; if that is not what the label should say, it needs its own key.
> 3. **The EMPTY pulse.** A twenty-minute window with no records draws a floor line and nothing else, which is a measured zero and is correct — but no sentence says so, and a reader cannot tell it from a chart that failed. The screen draws the floor rather than a blank; a keyed sentence is what it actually owes.
> 4. **The ABSENT projection** (`/api/watch/volume` answers 200 with no buckets). The screen renders the server's own word `absent` as a literal chip, the treatment a kind and a tier already get, because no key exists for the state. It owes a sentence.
>
> Order for each: key in the mockup first, then both tables, then the screen.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. It is the same shape as plan:screens seq:1s-b -- prose the mockup builds inside a HEB ternary in its own script, which no string table can carry until the mockup declares a data-t. The owner ruled the method on 2026-08-25: "give the mockup a data-t and ship it".

IT JOINS THE ONE MOCKUP SESSION, which the reconciliation now counts at FIFTEEN items rather than the six reported to the owner.

AND ITEM 3 IS NOT A STRING PROBLEM AT ALL, which is worth separating before the sitting. "The EMPTY pulse -- a measured zero and a chart that failed look identical" is the same fact the walk found from the other side, where watch draws an extra `line` the mockup never draws: the floor the pulse columns stand on, argued in its own header as "a measured zero and an undrawn chart are two facts and the difference has to survive". The app has the better answer already. What is missing is the SENTENCE, not the graphic.

**WARNING added 2026-08-28 — this task will LOOK closed and will not be**

`plan:walk seq:28` made `recordAudit` keep the audit projection current, so `/api/watch/volume` stops answering 503 in ordinary use. **That removes two of the three ways the short filter row appeared (`behind` and `diverged`) and leaves the third — which is now the only one, and therefore much easier to miss.**

The remaining route: `apiWatchVolume` answers the `absent` state with `buckets: []` (`watch-model.ts` · `export function apiWatchVolume(ws: Workspace, url: URL): JsonResult {` · ~236). A browser deriving its kind vocabulary from one bucket's key order still gets a silently shorter filter row — **200, no refusal** — for any workspace that has never run `mycontext audit`.

So a green screen on a warm workspace is no longer evidence. Test it on a workspace with no projection at all, or this closes on a symptom.
