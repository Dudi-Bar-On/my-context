---
id: TASK-nine-contrast-ratios-are-computed-against-a-colour-the
type: task
title: nine contrast ratios are computed against a colour the screen does not paint
status: active
severity: soft
always: false
summary: The check that says the buttons are readable measures them against a flat colour, while the screen behind them is a gradient that changes with position.
summary_of: 0b5986ff0456be5d
scope:
  - e2e/button-contrast.spec.ts
  - e2e/frame-paint.spec.ts
  - e2e/code-hue.spec.ts
  - test/ui/styles-parity.test.ts
tags:
  - v2
  - ui
  - gates
  - "plan:ui-gates"
  - "seq:2"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/d40body.md"
source_anchor: null
source_checksum: d471244a07bd2570
valid_from: 2026-09-13
valid_until: null
checksum: 84a94948ba934275
plan: ui-gates
seq: "2"
state: done
priority: "2"
---

# nine contrast ratios are computed against a colour the screen does not paint

> D40 WAS MINTED ON 2026-09-11 AND RULED TO START WHEN D37 CLOSED. D37 closed on 2026-09-11. This item is two days late and is the first one D40 has ever had - the number has sat in the map with no work attached to it, which is the shape the map exists to make visible.
>
> THE MECHANISM, VERIFIED 2026-09-13 rather than taken from the row. `e2e/button-contrast.spec.ts` computes nine ratios. It finds the background by walking ancestors with `getComputedStyle(node).backgroundColor`, falling back to `document.body`'s.
>
> `getComputedStyle().backgroundColor` RETURNS THE `background-color` PROPERTY AND NOTHING ELSE. The app's ground is not a colour. `styles.css` paints it with THREE STACKED `radial-gradient()`s in `background-image` - `#433580` at 14% 6%, `#0f6069` at 88% 92%, `#23306f` at 56% 46%, each fading to transparent. So the walk finds `rgba(0,0,0,0)` at every element whose colour comes from the gradient, keeps climbing, and lands on a `body` whose `backgroundColor` is not the gradient either.
>
> SO EVERY ONE OF THOSE NINE RATIOS IS A CLAIM ABOUT A COLOUR THAT IS NOT ON THE SCREEN. And it is worse than a constant offset: A GRADIENT VARIES WITH POSITION, so the true ratio for one button is not the true ratio for the same button moved, and there is no single number to correct to.
>
> THE EXAMPLE OF THE RIGHT WAY IS ALREADY IN THIS REPOSITORY and the row names it. `e2e/frame-paint.spec.ts` samples INSIDE the well, finds the box by SPAN rather than by colour, READS IT PIXEL BY PIXEL, and PRINTS THE TOKEN BESIDE THE PAINT so a reader can see the two disagree. It exists because the owner looked at screenshots and asked about the gap between what a token says and what a screen shows.
>
> WHAT THIS ASKS FOR:
>
> 1. MEASURE THE ERROR BEFORE CHANGING THE METHOD. For each of the nine, compute the ratio the way the spec does today AND the way `frame-paint` does, and print both. THE SIZE OF THE GAP IS THE FINDING. If it turns out small everywhere, that is a legitimate and valuable outcome and this item closes as one - do not manufacture a failure to justify the number.
>
> 2. THEN READ THE GROUND FROM THE RENDER. Sample the pixels actually under the element, at the element's actual position.
>
> 3. AND SAY WHAT A RATIO MEANS WHEN THE GROUND MOVES. A single number is a lie about a gradient. Sample at the corners and the centre and report the WORST, or state a different rule and argue it. The rule matters more than the number, because the next author will follow it.
>
> 4. CHECK WHETHER ANYTHING ELSE MEASURES COLOUR FROM A TOKEN. `e2e/code-hue.spec.ts` and `test/ui/styles-parity.test.ts` both read `--panel`, `--panel-2` or `--paper`. Judge each: a test about what the CSS SAYS is legitimate and should stay; a test about what a READER SEES and reading a token is this same defect.
>
> WHAT THIS IS NOT. It is not a claim that the UI fails contrast. Lighthouse, which measures from the render, scored accessibility 100 on 2026-09-13 and failed `color-contrast` on one banner only. THE DEFECT IS IN THE INSTRUMENT, NOT NECESSARILY IN THE PAINT, and the report must keep those apart.
