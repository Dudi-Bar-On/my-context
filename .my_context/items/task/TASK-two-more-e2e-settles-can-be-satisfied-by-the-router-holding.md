---
id: TASK-two-more-e2e-settles-can-be-satisfied-by-the-router-holding
type: task
title: two more e2e settles can be satisfied by the router holding chip
status: active
severity: soft
always: false
summary: Two tests could be fooled into thinking a page has finished loading while it is still showing a placeholder.
summary_of: de54e2d98337f427
scope: []
tags:
  - v2
  - gates
  - e2e
  - walk
  - "plan:walk"
  - "seq:83"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/settle.md"
source_anchor: null
source_checksum: 2358c2300248ebaa
valid_from: 2026-08-29
valid_until: null
checksum: 28b909c8d43d8cac
plan: walk
seq: "83"
state: done
priority: "2"
source: "found by plan:walk seq:74, 2026-08-29"
---

# two more e2e settles can be satisfied by the router holding chip

> > Found 2026-08-29 while fixing `e2e/pane-size.spec.ts`, whose settle loop declared every screen loaded while it still held only the router's holding chip.
>
> **The latent case**
>
> `route()` writes `<p id="screenunread">` into the section BEFORE awaiting the screen module, deliberately, so the tallest grid row is never a blank band. Any settle that waits for "some elements exist and the count stopped changing" is satisfied by that chip alone.
>
> `pane-size` was bitten and is fixed. Two neighbours are not bitten TODAY, and both are one small change away from it:
>
> * **`e2e/button-contrast.spec.ts`** — survives only because it additionally requires a real `<button>`, and `stateChip` builds a `<span>`. A holding state that ever renders a button would break it.
> * **`e2e/screen-parity.spec.ts`** — carries the in-flight-request guard, so a screen that fetches is safe. **A screen whose module import outlasts two polls with no fetch pending is not.**
>
> **Neither checks for `#screenunread`.**
>
> **Why record it rather than fix it now**
>
> The fix is one line in each, but the value is in naming the class: a settle condition that a HOLDING state can satisfy is not a settle condition. This is the fifth "proxy instead of property" this project has measured — after the settle loop reading "count stopped changing" as "finished loading", a vacuous `toHaveCount(0)`, an empty-band gate measuring a box, and a grep that missed the word the tool actually printed.
>
> **Done when**
>
> Every e2e settle waits on the holding chip being GONE — which is an event in the render, since every `render()` opens with `root.replaceChildren()` — and not merely on elements existing; and the shared helper is one implementation rather than three copies that drift.
