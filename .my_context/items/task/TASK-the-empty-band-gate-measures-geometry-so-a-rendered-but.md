---
id: TASK-the-empty-band-gate-measures-geometry-so-a-rendered-but
type: task
title: the empty-band gate measures geometry, so a rendered-but-wordless row passes it
status: active
severity: soft
always: false
summary: The check meant to catch an empty strip across the window only measures its size, so a strip that is present but wordless passes.
summary_of: 39d0727fcf82022f
scope: []
tags:
  - v2
  - ui
  - walk
  - e2e
  - "plan:walk"
  - "seq:67"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 031326525c2070cc
plan: walk
seq: "67"
state: done
priority: "1"
source: owner, 2026-08-29
needs: walk/29b
---

# the empty-band gate measures geometry, so a rendered-but-wordless row passes it

> Found 2026-08-29 when the owner reported the status strip crowded and asked whether it should become two rows. It already is two rows; the upper one renders empty. **The gate written to catch exactly that passes over it.**
>
> **The gate**
>
> `e2e/app-layout.spec.ts` — *"every row of the app shell is occupied — no empty band"*. Its own docstring records why it exists: the owner was looking at *"56px of teal across the bottom of the window, which is exactly `26 + 30`"*, and the file states the principle plainly: **"A band of nothing is a missing element, not a styling slip."**
>
> It was written as a `test.fail()`, correctly recording a real gap in the suite rather than in a TODO, and it started passing when `renderChrome()` landed — which forced its own annotation off, exactly as designed. That mechanism worked.
>
> **What it measures**
>
>     const spans = [...shell.children]
>       .map((c) => c.getBoundingClientRect())
>       .filter((r) => r.height > 0 && r.width > 0)
>
> Children with a non-zero box, checked for gaps between their spans. **Geometry, not content.**
>
> So a `prov` element present at its full 26px with no text inside covers its span, leaves no gap, and passes. The test proves the row EXISTS. It never asks whether it SAYS anything — and "a band of nothing", its own words for the defect, is precisely what it is now passing over.
>
> `renderChrome()` creating the element was enough to satisfy it. `fillChrome()` never filling it was not something it could notice.
>
> **Why this one is worth writing down beyond the fix**
>
> This is the third gate in two days found to be correct about what it measured and silent about what it missed:
>
> * `screen-parity`'s settle loop read "element count stopped changing" as "finished loading" — but screens append cards synchronously and fill them when fetches resolve, so a half-drawn screen is stable.
> * Several `toHaveCount(0)` absence assertions were vacuous, satisfied by the instant before an async read returns.
> * And this one: occupancy without content.
>
> **The shape is the same every time — a proxy measured instead of the property.** Element count for loaded. Absence for settled-absence. Box for band. Each proxy was true and cheap and correct in the case it was written against, and each stopped tracking the property the moment something changed around it. That is worth naming as a pattern rather than fixing three times.
>
> **Done when**
>
> The prov row is filled from what the mockup declares; the occupancy assertion measures visible CONTENT rather than only a box, so a rendered-but-wordless band fails it; and the assertion is driven at more than one viewport so a row that collapses at one size is caught.

**PARTLY LANDED 2026-08-29, by the status-strip work**

`e2e/app-layout.spec.ts` gained **"every row of the app shell SAYS something — no silent band"**: visible text per row, across four screens. It went red immediately and caught a real one — `#screen`, the body's `1fr` row, 610px, empty during the dynamic `import()` of every screen module, most visible on the landing screen. `route()` had diagnosed that itself and declined to fix it for want of a string key; the key was written and the state is now drawn.

**What remains of this task:**

* The assertion is driven at ONE viewport height. It should run at more than one, so a row that collapses at a particular size is caught.
* It covers four screens, not twenty-one.
* The generalisation is still unwritten: three gates in two days measured a PROXY instead of the property — element count for "loaded", absence for "settled absence", a box for a band. Naming that pattern was this task's wider point and it is unaddressed.
