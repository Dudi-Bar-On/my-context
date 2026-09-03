---
id: TASK-the-graph-and-staircase-read-oversized-and-the-status-line
type: task
title: the graph and staircase read oversized, and the status line comes and goes
status: active
severity: soft
always: false
summary: Several diagrams look out of proportion beside every other screen, and the status line does not stay visible.
summary_of: 532b2cb59a3df1a9
acknowledged:
  - state_unaudited@98ac96e0be206acf
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:62"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: c07b21b8b9fc7599
plan: walk
seq: "62"
state: done
priority: "1"
source: owner, 2026-08-28
---

# the graph and staircase read oversized, and the status line comes and goes

> Owner, 2026-08-28: *"be aware that the graph staircase and others uses very big font and should be fixed to look like all the other screens"*, and separately *"the status line is not constantly showing"*.
>
> **This is the same complaint as `plan:walk seq:47`, arriving on more screens.** That task records Decay and Relations reading too large. The owner now names the GRAPH and the admission STAIRCASE as well, and says "and others" — so the set is open and should be measured rather than enumerated from the report.
>
> **The staircase is newly built** (`plan:walk seq:7`, the same day), so this is not old drift: it shipped oversized. That is worth knowing, because it means the defect is being reproduced by new work rather than merely surviving in old work — and whatever `seq:47` settles has to become something a new screen inherits rather than something each screen gets right separately.
>
> **THE REAL CAUSE, SEEN IN A BROWSER 2026-08-28 — it is DENSITY, not type size**
>
> The owner, after the font restore shipped: *"still the graphics is non proportional and ugly - use playwright and systematic debugging to look and fix it."* Right on both counts. Two fixes had been attempted without once rendering the page.
>
> Driven with Playwright at 1440x900, app and mockup measured identically:
>
>     surface   viewBox      rendered    scale   first text
>     app       560 x 200    896 x 320   1.600   9.5px
>     mockup    560 x 200    896 x 320   1.600   9.5px
>
> **The scale is IDENTICAL. The upscaling is how the design has always rendered and is not a defect.** That eliminates the viewBox theory outright.
>
> What the screenshots show:
>
>     mockup   6 rungs   y-axis 0-6    ONE eviction label   clean, wide steps
>     app     18 rungs   y-axis 0-18   ~15 eviction labels  overlapping into an unreadable mash
>
> **The renderer draws every rung and every eviction label unconditionally.** No tick thinning, no label collision avoidance, no density cap. The design was drawn and validated against six rungs; the real corpus produces eighteen, and about fifteen evictions whose labels collide horizontally into `evictionevictioneviction`. The y-axis prints a tick at every integer from 0 to 18. The right-hand `16,000` collides with the axis label of the same value.
>
> **So the type-size work fixed the wrong thing.** It stands on its own merits — chart text no longer inherits a prose scale, which is a real improvement — but it was never the cause of what the owner was looking at. A smaller font would have produced a smaller unreadable mash.
>
> **This is the fixture-hid-it class again, and it is at least the seventh instance.** Every judgement about this chart was made against six sample rungs. `plan:ui1 seq:20e` exists for exactly this.
>
> **What the fix has to be**: density adaptation in the renderer — thin the axis ticks to a readable count whatever the rung count, and either suppress, thin, or collision-resolve the eviction labels. Check the graph and decay heatstrip for the same shape before assuming it is only the staircase. Do NOT solve it by shrinking type further.
>
> Screenshots: `scratchpad/shot-simulate.png` and `scratchpad/shot-mockup-simulate.png`.
>
> **THE CAUSE, MEASURED 2026-08-28 — the owner pointed at the mockup's PREDECESSORS, before the repaint, and they hold the answer**
>
> Owner: *"about the staircase and all the other graphics, they must change the font and lines width much smaller, look at the very first mockup documents and compare it"*, then: *"i intentionally requested you not to look at it but in it's predecesors, even before the repaint, there you would find the correct graphics svg etc."*
>
> Compared `86c31ea` (2026-08-19, *"restore all 18 graphical views the sketches had worked out"*) and `d263992` (2026-08-21, the last pre-repaint mockup) against HEAD. **Two inflations are stacked.**
>
> **1. The whole type scale rose 2px at every step during the repaint:**
>
>     token       pre-repaint   now
>     --fs-00        10px       12px    +20%
>     --fs-0         11px       13px    +18%
>     --fs-1        12.5px     14.5px   +16%
>     --fs-2         14px       16px    +14%
>     --fs-3         16px       18px    +13%
>     --fs-4         22px       24px     +9%
>
> `src/ui/public/styles.css` carries the new scale exactly, so the app inherited it.
>
> **2. The chart-specific sizes were ALSO raised individually, on top of that:**
>
>     svg.chart text.rel     8px  -> 10px     +25%
>     svg.chart text.nid     9px  -> 10.5px   +17%
>     svg.chart text.mono   9.5px -> 11px     +16%
>     (two more)             9px  -> 10.5px, 12.5px -> 14.5px
>
> `svg.chart text` references `--fs-00`, so it took the scale rise as well. **Stroke widths did NOT change** — `stroke-width:1` and `stroke-width:2` are identical in all three generations. So if lines read too heavy it is because they are drawn at the same width beside text that grew around them, not because the strokes themselves moved.
>
> **This supersedes the two eliminations recorded below.** They were correct measurements and the wrong conclusion: the ladder IS at the app's dominant size, and the dominant size is itself 2px larger than the design intended, so "matches the app" was never evidence of being right. Keeping both records because the reasoning is the useful part.
>
> **What this does NOT settle, and must not be assumed:** whether the scale rise was an intentional repaint decision for PROSE. Raising body text 11px -> 13px is defensible on its own; applying the same rise to chart labels, where density is the point and 8-10px is ordinary for an axis, is where it hurts. The owner's complaint names the GRAPHICS, not the whole UI. **So do not revert the global scale without asking** — restore the chart-specific values, and consider whether chart text should reference a dedicated small token instead of inheriting a prose scale that can move under it again.
>
> **The owner sharpened this 2026-08-28**: *"about the staircase and all the other graphics, they must change the font and lines width much smaller, look at the very first mockup documents and compare it."*
>
> Font AND stroke moving together is the signature of a SCALE problem rather than independent typography choices, so that was checked first. **Two candidates eliminated by measurement — do not spend time on them again:**
>
> * **Not the font tokens.** The scale is `--fs-00:12px --fs-0:13px --fs-1:14.5px --fs-2:16px --fs-3:18px --fs-4:24px`. `.ladder` is `--fs-0`, which is the app's dominant size (26 of 52 uses). `svg.chart text` is `--fs-00`. These are the small end of the scale already.
> * **Not the coordinate space.** The app's staircase is `STAIR_W = 560`, `STAIR_H = 200` (`screens/simulate.js` · `STAIR_W = 560` · ~213) and the mockup's `renderStair` is `W=560, H=200` — IDENTICAL. A viewBox mismatch would have scaled font and stroke together by exactly one ratio, which fits the report perfectly, and it is not the cause.
>
> **What is left, and where to look:** `svg.chart{inline-size:100%; block-size:auto}` — the chart fills its container. Same viewBox stretched into a WIDER container renders everything proportionally larger, font and stroke alike. So measure the RENDERED width of the chart element in both surfaces, not the CSS. If the app's card or pane is wider than the mockup's, that is the whole defect and the fix is a bound on the chart or the container, not a font change.
>
> Note the other charts do NOT share the staircase's space — the mockup carries `W=900 H=250` and `W=900 H=210` for others — so measure per chart rather than assuming one ratio explains all of them.
>
> **The design's own authority, worth knowing before changing anything**: `docs/design/web-ui-mockup.md` was CORRECTED on 2026-08-20 to say *"Where they disagree about APPEARANCE, the mockup wins. Screens, layout, controls, what a chart plots, empty states and every user-visible word are decided in the HTML… Appearance is the mockup's; behaviour is the spec's."* So if the app renders larger than the mockup, the app is wrong by the project's own rule and the mockup needs no edit.
>
> **Measure, do not read the report literally.** `seq:47`'s own instruction applies and was learned the hard way on `seq:29b`: drive BOTH surfaces and compare computed font sizes, because the status strip's font turned out to be 13px in the app AND in the mockup, making "too small" a design change rather than the parity bug it looked like. Do the same here for the graph, the staircase, Decay, Relations, and every other screen — a full census of computed font-size per screen is cheap once the harness exists and settles the open "and others".
>
> **Drive the mockup with its own screen-showing helper.** Its sections are hidden until shown, and a naive `goto` reads zero widths and root-inherited fonts. A first attempt at measuring this produced numbers not worth keeping.
>
> **The status line is a separate report and probably a separate task.** *"Not constantly showing"* suggests it appears and disappears rather than being absent, which is different from `plan:walk seq:29b`'s finding that the strip draws four of the mockup's forty-four elements. Establish which it is before folding them together: an intermittent strip is a rendering or layout bug; a permanently-partial strip is the parity gap already filed. If it is intermittent, this task owns it; if it is the known gap, hand it to `seq:29b` and say so here rather than duplicating it.
>
> **Done when**
>
> Computed font sizes are censused per screen across both surfaces and the numbers recorded; each divergence is settled as parity-or-design with the mockup edited first where the design moves; the graph and staircase read like their neighbours; the status line's intermittency is established as its own defect or handed to `seq:29b`; and a browser test asserts the sizes rather than leaving them to the next reader's eye.

> ## SETTLED 2026-08-28 — the chart ramp is its own token now, and the status line was handed to `seq:29b`
>
> **The global type scale was NOT reverted.** `--fs-00` through `--fs-4` stand at
> the repaint's values in both surfaces. Raising prose 11px → 13px is a decision
> about prose; reverting it on the strength of a complaint about charts would
> have moved every screen in the product.
>
> **The chart-specific values are restored, and they are TOKENS rather than the
> literals the pre-repaint commits carried.** Added to the LEGACY SCALE `:root`
> block of `docs/design/web-ui-mockup.html` and `src/ui/public/styles.css`,
> byte-identically (`styles-parity` pins that block):
>
>     --fs-chart:10px  --fs-chart-mono:9.5px  --fs-chart-nid:9px  --fs-chart-rel:8px
>
> and the rules now read them:
>
>     svg.chart text       var(--fs-00) 12px -> var(--fs-chart)      10px
>     svg.chart text.mono  11px              -> var(--fs-chart-mono)  9.5px
>     svg.chart text.nid   10.5px            -> var(--fs-chart-nid)   9px
>     svg.chart text.rel   10px              -> var(--fs-chart-rel)   8px
>
> Every value is the one `86c31ea`/`d263992` carried. **The token is the half
> that stops this recurring**: `svg.chart text` inheriting `--fs-00` is how a
> prose decision reached every axis label without anyone deciding it, and that
> path is now cut.
>
> **The chart's HTML furniture came with it, and that is a judgement, not a
> measurement.** `.legend`, `.heataxis` and `.heat` were never chart-SPECIFIC
> values — they read `--fs-00` before the repaint and after it, so only the
> global scale moved them, 10px → 12px. They are pointed at `--fs-chart` anyway,
> because a legend at 12px beside chart text at 10px is a legend that disagrees
> with the chart it labels, and pre-repaint they agreed. This is the one change
> here that goes beyond restoring a pre-repaint value; it is three declarations
> and reverting it is three edits.
>
> **Strokes were not touched, and the owner's "lines width" is answered by the
> text change.** `stroke-width` 1, 1.4, 1.5, 1.6, 2 and .8 are byte-identical in
> `86c31ea`, `d263992` and HEAD. The design of record has never drawn them any
> other way, so moving them would be inventing a divergence rather than closing
> one. What changed is that the text around them shrank back to the size the
> strokes were chosen against.
>
> **`screens/decay.js` was the one screen that would have survived the fix.** It
> restates the chart rules through the CSSOM (a comment says "for as long as the
> shell's stylesheet has no `svg.chart` block at all" — that stopped being true
> on 2026-08-23), so its inline `font-size:11px` and `font-size:var(--fs-00)`
> overrode the stylesheet on the element. Both now name the tokens. Any future
> screen that restates chart CSS inline must do the same.
>
> **Order of edit:** the mockup first, `styles.css` following, per
> `docs/design/web-ui-mockup.md`'s appearance rule. Both inflated, so both moved.
>
> **The status line: handed to `plan:walk seq:29b`, and the reasoning is recorded
> there.** Measured, not assumed. `renderChrome()` builds `footer.strip#strip`
> once and nothing removes it, hides it, or can push it off `100vh` — so it
> cannot flicker. What varies is its CONTENT: `fillChrome()` fills the git group
> and the item count from two one-shot boot fetches whose catch blocks leave the
> spans empty by design and never retry. A blank git group and a blank count
> beside the `noBridge` sentence is what "not constantly showing" looks like, and
> it is `seq:29b`'s four-of-forty-four rather than a second defect. One mechanism
> `seq:29b` did not name — silent, permanent blanking with no unmeasured state
> and no retry — was added to that item rather than filed again here.
>
> **Still open on this item:** the full per-screen census of computed font sizes
> across both surfaces, and a browser test asserting them, both of which need the
> e2e lane (`e2e/**`, owned elsewhere this round). `test/ui/styles-parity.test.ts`
> already pins the four `svg.chart text*` rules and the `--fs-00:` `:root` block
> byte-for-byte in both files, so the values themselves cannot drift unnoticed;
> what is missing is the RENDERED check. Note for whoever writes it:
> `test/ui/decay-screen.test.ts` ~317 does its ID_MAX arithmetic at "11px
> monospace, advance ≈ 0.6em ≈ 6.6"; at `--fs-chart-mono` that is 9.5px and ≈5.7,
> so the assertion still passes with MORE headroom, but the constant is stale.
