---
id: TASK-three-screens-the-owner-cannot-read-truncated-ratio-rows
type: task
title: "three screens the owner cannot read: truncated ratio rows, oversized Decay and Relations, no timestamps on Injection preview"
status: active
severity: soft
always: false
summary: Three complaints about screens being hard to read, each needing measuring first to know whether the app or the design is at fault.
summary_of: 964566ecf1307869
scope: []
tags:
  - v2
  - ui
  - readability
  - "plan:walk"
  - "state:done"
  - "seq:47"
origin: human
source_file: null
source_anchor: null
source_checksum: fa9bd72f3fb84ccb
valid_from: 2026-08-28
valid_until: null
checksum: 45c9306607b9335c
plan: walk
seq: "47"
state: done
priority: "1"
source: owner, 2026-08-28
---

# three screens the owner cannot read: truncated ratio rows, oversized Decay and Relations, no timestamps on Injection preview

> Owner, 2026-08-28, from using the running UI:
>
> 1. *"budget simulator, selected not delivered, the items is too short — extend
>    them so the full text will be seen"*
> 2. *"Decay and Relations, the font is too big"*
> 3. *"injection preview, it will be helpful to have there timestamps"*
>
> ## The question to settle FIRST, for each of the three
>
> **Is this a parity gap or a design change?** They take opposite fixes and the
> wrong one fails a gate in the direction that means "the app invented something".
>
> * If the app differs from `docs/design/web-ui-mockup.html`, the app is wrong and
>   the mockup is the answer.
> * If the app MATCHES the mockup, the design is what the owner finds unreadable,
>   and the **mockup is edited first with the app following** — the order used for
>   `cap.warn` and `cfg.nocmd`, both of which moved that way earlier the same day.
>
> This is not a formality. `plan:walk seq:29b` was filed hours before this and the
> measurement changed its answer: the status strip's font was 13px in BOTH
> surfaces, so "the font is too small" was a design change, not the parity bug it
> looked like. Measure each of the three the same way — drive both surfaces and
> compare computed styles — before deciding which fix applies.
>
> Drive the mockup with its own screen-showing helper; its sections are hidden
> until shown, and a naive `goto` reads zero widths and root-inherited fonts. A
> first attempt at measuring these three did exactly that and produced numbers not
> worth keeping.
>
> ## 1 — the "Selected, then not delivered" rows are cut short
>
> `sim.ratio` on the Budget simulator: the diverging bar whose halves are
> delivered and spilled, built from `topItems` through `/api/watch/ratio`. The
> owner reports the item text is too short to read.
>
> Establish whether the truncation is CSS (a width, an ellipsis) or the data (an
> id sliced before it is drawn). Those are different bugs: the first is a layout
> fix, the second means the full text never reached the page and no styling will
> recover it. Item ids in this corpus reach 67 characters — `e2e/bidi.spec.ts`
> records that length as the reason a dangling-edge row puts each id on its own
> line — so whatever is chosen has to hold at that width without pushing the page
> into a horizontal scroll, which `RULE`-level layout guidance forbids.
>
> ## 2 — Decay and Relations read too large
>
> Two screens, and they may not have the same cause. Check each against its own
> mockup section rather than assuming one rule covers both.
>
> ## 3 — the Injection preview carries no timestamps
>
> The screen answers "what did the last session get". *When* is missing, and the
> data exists: the seen file records injections, and `audit.at` carries the time
> on every record — `dec.heatn` already describes joining `audit_item.role` to
> `audit.at` for the decay heatstrip, so the join is established and used.
>
> Decide WHICH time is meant before drawing one: when the item was injected into
> that session, or when the session started. They differ, and a timestamp whose
> meaning is ambiguous is worse than none on a screen whose whole subject is
> provenance. The mockup must gain the element first either way.
>
> ## Done when
>
> Each of the three is settled as parity-or-design with the measurement recorded;
> the mockup carries whatever the app draws; a browser test drives each changed
> screen and asserts the property that was wrong — full text visible at a
> 67-character id, the computed font size, the timestamp present and unambiguous —
> and both string tables carry any new key, with the mockup's Hebrew copy using
> `{m:…}` markers so `bidi.spec.ts` does not fail on a run-count mismatch. That
> trap was hit twice on 2026-08-28.

**EXTENDED BY THE OWNER 2026-08-28, after the chart typography was restored**

*"the decay and relation graphics should become smaller fonts and scale down, this also implies to the budget simulator too."*

Two distinct asks, and only the first is already done:

* **Smaller fonts** — landed. `--fs-chart` 10px, `--fs-chart-mono` 9.5px, `--fs-chart-nid` 9px, `--fs-chart-rel` 8px, restored from the pre-repaint sketches and given their own tokens so a prose repaint cannot move them again.
* **SCALE DOWN** — not done, and it is a different thing. Measured: every chart is upscaled because `svg.chart{inline-size:100%}` stretches a fixed viewBox into whatever width the card gives it. The staircase renders 896x320 from a 560x200 box — **1.6x** — and the graph and decay render at **1.267x**. So nominal 10px text draws at 12.7px on two screens and 15.2px on a third.

**That last number is the real complaint.** Text that is nominally identical renders at different sizes on different screens, because each chart is stretched by a different factor. Making the fonts smaller cannot fix it; it only changes what gets multiplied.

**The fix is to bound the scale, not the type.** A `max-inline-size` on `svg.chart` at its own viewBox width would render every chart at 1:1 and make the tokens mean what they say. That is a design change — the charts become physically smaller and the cards gain whitespace — which is exactly what the owner asked for, and it must go in the mockup first.

Check all three named screens plus the ribbon, and report the scale factor per chart before and after. **The one thing that must hold: 1:1 everywhere, or a single deliberate factor everywhere — never a different one per screen.**
