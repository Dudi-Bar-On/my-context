# Direction D — data-first. The visualisation is the design.

**Deliverable:** `reports/design-panel/dir-d/prototype.html` — one self-contained file, no
external requests, no CDN, no font fetch, no build step. Open it, or serve it; both work.

Provenance marks follow the 2026-08-21 panel's convention:

- `[M]` **measured today**, 2026-08-21, in Chromium via Playwright 1.62, against this file.
- `[V]` **verified** by reading the file today.
- `[R]` **reasoned** — an argument, not a measurement.

---

## 0. The argument in one paragraph

`[R]` This product has eighteen graphical views and its entire subject is *what was delivered,
what governs what, and what is decaying*. A charting library draws the eleven charts every
product already has. It does not draw a **ghost lane**, an **absent tier**, a **never bucket**,
a **not-examined hatch** or a **not-recorded void** — and those five marks are the only ones
this product could not have bought. So the investment goes into a shared chart **substrate**
— one scale/tick/projection kernel, one hover-and-focus contract, one motion contract, one
degradation contract, one table twin — and the marks stay hand-written, because the marks are
the differentiator. Eighteen views stop being eighteen drawings and become eighteen
configurations of one instrument.

**The signature is the absence channel.** Every view here draws what is *not* there with the
same care as what is. Absence is never a zero-length bar and never an empty region: it is
hatched, outlined, dimensioned and named. That is specific to a governance ledger and it is
the one thing this page should be remembered for.

**The vocabulary is drafting, not dashboard.** Dimension lines with extension lines and printed
measures, crop-mark plot frames instead of plot boxes, hairline *solid* rules, 45°/135° hatches.
A budget is arithmetic and an identifier is exact; the visual language of exactness is an
engineering drawing, not a KPI tile. `[R]` This is also the deliberate divergence from
Datadog/Grafana, which are *monitoring* surfaces. This is a *survey drawing of a corpus*.

---

## 1. What is in the file

| View | What it is | Why it is here |
|---|---|---|
| **Injection preview** | the **budget ruler** (tier ribbon + ghost lane + headroom dimension), the delivered table with a share ruler at the same scale, and the gate ladder | the screen every expert builds, so the owner compares like with like |
| **Scope coverage** | the **coverage cascade** on one shared *absolute* axis, plus a "what governs" pane | harder view #1 |
| **Decay** | the **recency comb**, log axis, separate never bucket, with a **draggable cold window** | harder view #2 |
| **Relations** | the layered **ego-graph**, edge class by stroke *and* arrowhead | harder view #3 |
| **Audit stream** | a Grafana-style **state timeline**, four tiers × twelve sessions, with a regime boundary | the fourth mark nobody ships: *not recorded* |
| **The direction** | the live cost table, the axis ruling, and my own four weakest points | so the owner can rule on cost without taking my word |

Five controls in the top bar, and each of them is an argument: **theme**, **language**,
**axis in RTL** (the ruling this page owes the panel), **hue** (remove it entirely and watch
nothing break), **motion** (turn it off and watch the substitutes take over).

`[M]` Data is the mockup's own fabricated demo data, unchanged — `CANDIDATES`, `TIER_BUDGET`,
`EVENT_TIERS`, `DECAY.rows`, the ego relations. Only the rendering differs, which is the
comparison the panel is for.

---

## 2. What I chose to render with, and why

### The ruling: hand-rolled SVG plus a real kernel — not hand-rolled *charts*

`[R]` The mockup already hand-rolls SVG, and the honest criticism of it is not "it is
hand-rolled", it is that **each chart is drawn bespoke**. There is no scale, no tick
generator, no shared hover contract, no shared degradation contract. Every new view re-derives
its own arithmetic, and that is what does not survive eighteen views.

So this direction hand-rolls the **primitives** and configures the **charts**:

| The kernel provides | Lines |
|---|---|
| `linear`, `log1p` scales | 2 |
| `ticks()` — the 1/2/5 nice-number ladder, so an axis never prints 3,750 | 7 |
| `X()` / `ANC()` projection — mirroring by projection, never `scale(-1,1)` | 2 |
| `sv`, `svtext`, `chart`, `el`, `isz` — CSSOM-only sizing, CSP-safe | 12 |
| `cropMarks()` — the frame as four corners | 10 |
| `defs()` — the two hatch patterns, 45° and 135°, defined once globally | 8 |
| `showTip` / `hoverable` / `hoverOnly` — one hover-and-focus contract for the page | 30 |
| `twin()` — the table twin every figure owes | 16 |
| `fitFirstFit()` — the selector's own admission rule | 8 |

`[M]` **The whole kernel is 3,798 bytes with comments stripped, 1,725 bytes gzipped, 95 lines.**

### What a library would have cost, measured

`[M]` I downloaded the real published `dist` builds on 2026-08-21 and measured them rather
than quoting a comparison article:

| Package | `dist` build | raw | gzip -9 | brotli |
|---|---|---|---|---|
| `@observablehq/plot` 0.6.17 | `plot.umd.min.js` | 209,183 B | **68,818 B** | 58,755 B |
| `d3` 7.9.0 | `d3.min.js` | 279,706 B | 92,370 B | 77,652 B |
| `uplot` 1.6.32 | `uPlot.iife.min.js` + `.css` | 52,938 B | 22,781 B | 20,439 B |
| **this kernel** | — | **3,798 B** | **1,725 B** | — |

`[R]` Observable Plot is **40×** the kernel gzipped; uPlot, the smallest serious option, is
**13×**. That is not the argument on its own — 68 KB is affordable and I am not going to
pretend otherwise. The argument is what the 68 KB *buys*, and here it buys almost nothing:

`[V]` Plot's own docs state that marks and axes default to `currentColor`. `[M]` And
`currentColor` is precisely the thing that **fails under forced colors**: forced colours are
applied at *used*-value time while `currentColor` inherits the *computed* value, so an SVG
built on `currentColor` does not pick up the system palette. Chrome's fix — the
`forced-color-adjust: preserve-parent-color` keyword — is a UA-stylesheet change, not
something a library consumer can rely on today. So a Plot-based chart inherits D7 rather than
fixing it, and the fix is the same work either way: restate every stroke and fill by system
colour name. **The library does not save the accessibility work, which is where the real cost
in this product is.**

`[R]` And every one of the five marks that make this product what it is would be a custom mark
in any library: a spill drawn at the position the selector considered it, a tier drawn absent
rather than empty, a terminal never bucket outside the axis, a not-examined hatch that is not
a fourth degree of coverage, a not-recorded void that is not zero. Writing five custom marks
against a library's internals is *more* work than writing five marks, not less.

### The honest verdict on a charting library

**No, for this product — and I would change my mind on three named triggers.**

1. **If a view needs >2,000 marks.** The kernel renders to DOM SVG. `[M]` 265 SVG nodes today;
   at a few thousand the right answer is canvas, and uPlot is a canvas renderer that already
   solves it. A real repository's coverage map is exactly this trigger.
2. **If the product ever needs a projected map, a real force layout, or statistical
   transforms** (binning, regression, KDE). Reimplementing those is how a kernel becomes a
   library badly.
3. **If this file passes ~600 lines of kernel.** It is 95 today. `[R]` At 600 the maintenance
   argument flips and the honest move is to re-cost against Plot rather than defend the
   decision out of habit. That number should be written down now, while it is cheap to agree.

`[R]` Meanwhile the kernel carries a liability a package does not: **no test suite, no
changelog, no upstream.** Ship it with unit tests for `ticks()` and `log1p()` on day one, or
it is a dependency with none of a dependency's guarantees.

---

## 3. What I actually changed about the charts, and why

Every item below came out of the `dataviz` skill's checks, not out of taste. These are the
concrete deltas from the mockup.

| Change | The mockup today | Here | Rule |
|---|---|---|---|
| **Segment separation** | `border-inline-end:1px solid` on every `.seg` | a **2px gap in the surface colour** | *"Never draw a border around a mark to separate them. The gap and the ring are the mechanism; a stroke adds data-weight ink that isn't data."* |
| **Gridlines** | `stroke-dasharray:2 4` on the comb's gridlines | hairline **solid**; only a real threshold dashes | *"Dashed gridlines read as 'projection' or 'threshold' when it's just a grid."* |
| **Coverage encoding** | four categorical dots | an **ordered ramp** (solid → lighter step of the same ramp) + two **textures** for the two kinds of absence | coverage is ordinal, not nominal; *"if swapping the category order would change the meaning it is ordinal and takes a one-hue ramp"* |
| **Coverage axis** | each directory bar normalised to 100% | **one shared absolute axis in files** | a row that is 100% ungoverned reads equally loud at 3 files and at 40; magnitude was being thrown away |
| **In-mark labels** | labels drawn unconditionally | measured after layout; `.fits` only when the label clears the mark with 14px to spare | *"A label that won't fit doesn't get clipped — measure first."* `[M]` the label falls back to the tooltip and the table twin |
| **Label colour inside a fill** | one rule for all fills | white or ink **by the fill's luminance** | `[M]` white-on-index measured **3.48:1**; ink-on-index measures **5.23:1** |
| **Figures** | `tabular-nums` everywhere `.m` appears | tabular in columns and axes, proportional on standalone measures | *"`tabular-nums` on a large standalone number makes `121` look loose."* |
| **Every figure** | tooltips only on some, no table equivalent | **a table twin on every figure**, opened automatically for print | *"A tooltip as the only way to read a value"* is an anti-pattern; the twin is the WCAG-clean equivalent |
| **Hover/focus parity** | `title` attributes | one tooltip, `textContent` only, same content on keyboard focus as on hover | *"Labels are untrusted data — use `textContent`"*; *"Same details on keyboard focus as on hover"* |
| **Hit targets** | painted pixels only | the mark's box grows to 24px while the painted bar keeps its weight (`::before`) | WCAG 2.5.8 |

### The two analytical additions

`[R]` **The headroom dimension.** The mockup's ribbon ends in a sentence: *"the smallest thing
that did not fit costs 760 — so the headroom is not usable."* Here that sentence is a
**drawing**: an extension-line dimension across the headroom with the measure printed in a
break in the line, and the smallest spilled item laid into it at true scale, running past the
end. You measure the claim off the figure instead of trusting the caption. That is the whole
direction in one mark.

`[R]` **One ruler, read twice.** The `share of tier` column in the delivered table is drawn at
the *same scale* as the ribbon above it, so a row's bar and its segment are literally the same
width. Hover either and both light. It is a small thing and it is the thing that makes the
screen feel like one instrument rather than two charts about the same numbers.

---

## 4. Motion — what it says, and what replaces it when it is off

`[V]` The mockup contains **zero** transitions, animations and keyframes. `[R]` For data views
that is a real loss: transitions are how a reader keeps their place when data changes, and
these views change constantly. But motion that carries meaning is motion that goes missing
under `prefers-reduced-motion`, so each one owes a static substitute.

**Two durations and one curve, and that is all.** `--t-data: 400ms` moves a mark to a new
value; `--t-ui: 150ms` moves chrome; `cubic-bezier(.22,.61,.36,1)` for both.

| Motion | What it says | Substitute when motion is off |
|---|---|---|
| **Ribbon retime** — segments travel to their new widths when the event changes | *which* item spilled, not merely that the picture is different | the ghost lane already carries the delta statically — every spill is drawn at its own width, in position |
| **Comb threshold** — the window slides; the teeth **do not move**, they change shape as it passes them | decay is a **threshold crossing**, so the reader has to see the crossing | the threshold line is always drawn at its current value, so the two populations stay readable from one frame |
| **Ego-graph travel** — nodes move to their new columns, edges redraw under them | lets the reader follow one node across a focus change instead of re-orienting from scratch | `[V]` a `.wasat` hairline is drawn from each surviving node's previous position to its new one; `[M]` `svg.chart .wasat` goes from `opacity:0` to `.9` under `prefers-reduced-motion` and under the page's own motion toggle |
| **Gate ladder** — the binding rung slides when you pick a different spilled item | tells you the *diagnosis* changed, not just the row | the rung's own `binds` styling and the "not reached" rungs below it are static |

`[R]` **Nothing loops, nothing pulses, nothing reveals on scroll.** There is no ambient motion
in this file at all. If it does not answer a question, it is not there.

`[M]` `@media (prefers-reduced-motion: reduce)` sets both durations to 0 and forces
`transition-duration: .001ms` globally; the `data-motion="off"` toggle does the same thing so
the owner can compare without changing an OS setting.

---

## 5. Hebrew RTL — the ruling this page owes the panel

`[R]` The mockup already draws the right line: *a quantity bar is a box model and mirrors for
free through logical properties; a position on an axis is not, and mirrors by projection.*
That machinery is correct and this page keeps it, `X()` and `ANC()` included. What this page
adds is the ruling about **what it is applied to**:

> **Layout mirrors. A magnitude axis does not.**
> Row labels, legends, tooltips, the never bucket, the rail, the whole reading order swap
> sides. A numeric axis keeps its numbers growing away from the origin in the direction the
> numerals themselves are written.

`[R]` The argument is that a numeric axis is a **direction-known run**, exactly like an
identifier, a path, a glob or a command — and the sheet already has that rule and applies it
to text (`.m { direction: ltr; unicode-bidi: isolate }`). This extends the rule the product
already believes in from text to graphics. The supporting evidence is that Hebrew and Arabic
mathematics both set notation left-to-right: the x-axis in a Hebrew textbook runs the same way
it does in an English one. Mirroring it puts "50 sessions ago" where the eye expects "1".

`[R]` **The counter-evidence is real and I am not hiding it.** The published survey of
real-world RTL charts (Alebri et al., IEEE VIS 2024) finds the practice genuinely split —
roughly 58% keep the y-axis on the reading-start side with the x-axis unmirrored, roughly 33%
mirror both — and the mockup currently does the opposite of what I ship. **That is exactly why
the page has a toggle rather than a stylesheet rule**: `Axis in RTL → Numbers grow away |
Mirror` flips every SVG figure in one attribute, and the owner can rule by looking.

`[M]` **One measured trap, and it cost an hour.** SVG `text-anchor` resolves against the
*inline base direction*, so an `<svg>` that inherits `dir="rtl"` flips every anchor a **second**
time on top of `ANC()`. The two mirrors cancel and every row label lands on top of its own
mark. `[V]` The fix in this file is `svg.chart { direction: ltr }` — the charts pin their own
direction and do all mirroring through the projection, which is also the only way "mirror the
layout" and "mirror the axis" stay separable at all. `[R]` Any implementation of the mockup's
`ANC()` inherits this trap.

`[M]` Hebrew is translated for the chrome, the marks, the legends, the tooltips, every figure
note and every `<h2>`/`<h3>`/eyebrow. A missing key degrades to the captured English, never to
a key name. This file does not claim the mockup's 396-key parity discipline — it is a
prototype — but it exercises everything an RTL layout test actually exercises.

---

## 6. Measured behaviour

### 6.1 Accessibility

`[M]` **48 states** — 2 themes × 2 languages × 2 axis rulings × 6 views — composited through
the full ancestor chain including the card sheen gradient at each element's own vertical
position, with every colour normalised through a canvas and the parse validated from two
different seed colours:

| | |
|---|---|
| elements owning visible text, checked | **8,440** |
| WCAG 2.x text-contrast failures | **0** |
| controls below 24 × 24 CSS px | **0** |
| console errors / uncaught exceptions across a full exercise of every control in both languages | **0** |
| tab stops reached by keyboard | 80, covering nav, every toggle, every select, ribbon segments, ghost bars, table twins and every identifier |

`[R]` **I fabricated 50 failures on the way to that number, and the cause is worth recording**
because it is the same defect class the 2026-08-21 panel opened with. The first harness read
computed colours immediately after flipping `data-theme`, and `.nav` carries a 150 ms colour
transition — so `getComputedStyle` returned the *interpolated* value and reported the light
`--dim` on a dark rail at 2.79:1. The 50 failures were the transition, not the design. The
harness now disables motion before it measures. `[R]` A harness is exactly as capable of
asserting a property the code does not have as a product is.

`[M]` Three further real defects the audit found and this file fixes:

- `.chip` carried `forced-color-adjust: none`, so `.chip.gov { color: var(--gold) }` (0,2,0)
  then beat the forced-colors block's `.chip` (0,1,0) and the chips kept their author colours
  on a forced-colour ground. Removed — the platform's own forcing is correct here, and the
  `::before` glyph is *content*, which forced colours never touch.
- `.fig` carried the same opt-out, and **`forced-color-adjust` is inherited** — one word on
  the card opted out every descendant, prose included. Removed.
- White-on-index-tier measured 3.48:1. In-fill labels now take white or ink by the fill's own
  luminance.

### 6.2 Under `forced-colors: active` — this is the D7 fix

`[M]` Emulated with `forcedColors: 'active'`; zero author colours leak into text on any of
`.chip`, `.fignote`, `.psub`, `h2`, `h3`, `.eyebrow`, `td`, `th`, `.linkid`.

`[R]` Forced colours deliberately do **not** adjust SVG, because the platform cannot know what
an SVG means. So every stroke and fill in this file is restated **by system colour name**
inside the `@media (forced-colors: active)` block — `CanvasText`, `Canvas`, `GrayText`,
`Highlight`, `LinkText` — not through `currentColor`, which does not work there.

`[M]` And the four tiers, which collapse to one visual state in the mockup, become four
distinct **patterns**, because a `background-image` survives forced colours and a
`background-color` does not:

| tier | forced-colors treatment |
|---|---|
| pinned | solid `CanvasText` |
| jit | 45° `CanvasText` hatch |
| restored | 135° `CanvasText` hatch |
| index | vertical `CanvasText` stripe |
| spilled (ghost) | 135° hatch, `CanvasText` border |
| absent | 45° `GrayText` hatch |

`[M]` The comb keeps all four of its shapes — filled disc, ring, square, crossed ring — and
the ego-graph keeps stroke weight, dash pattern and three distinct arrowheads. Screenshots in
`C:\…\fc2-preview.png` and `fc-decay.png` during the run; both are legible without hue.

### 6.3 In print — this is the D1 fix

`[M]` Printing **from the dark theme**, the print block's `:root, :root[data-theme] {
color-scheme: light !important }` takes every token back to its light value:

| token | print, from dark theme | print, from light theme |
|---|---|---|
| `--ink` | `rgb(23,23,27)` | `rgb(23,23,27)` |
| `--dim` | `rgb(101,99,93)` | `rgb(101,99,93)` |
| `--faint` | `rgb(95,93,87)` | `rgb(95,93,87)` |
| `--gold` | `rgb(125,98,15)` | `rgb(125,98,15)` |
| `color-scheme` | `light` | `light` |

`[R]` Identical, which is the whole point: the panel measured **246** text failures printing
the mockup from dark against **17** from light, and the cause was that
`:root[data-theme="dark"] { color-scheme: dark }` outranks a bare `:root` in the print block.
The rule here matches the attribute *and* carries `!important`.

`[V]` `beforeprint` also opens every table twin and marks the current view `.printing`, because
**a hover tooltip does not print** — the twin is what carries the numbers onto paper. `[M]` The
dark-theme printout renders the full preview screen plus its twin as clean black-on-white.

`[R]` In monochrome print the marks survive for the same reason they survive forced colours:
shape and texture carry every distinction, and hue is redundant everywhere.

### 6.4 Cost

`[M]` Chromium, 1440 × 1000, no CPU or network throttling, served over HTTP from `127.0.0.1`:

| | |
|---|---|
| LCP | **225 ms** (TTFB 5 ms, render delay 220 ms) |
| CLS | **0.00** |
| DOMContentLoaded / load | 59.4 ms / 191.2 ms |
| first render, injection preview | **2.0–2.5 ms** |
| all five views rendered | **5.2–6.6 ms** |
| ribbon retime on an event change | **1.3–4.3 ms** |
| one frame of the decay-window drag | **0.5–1.5 ms** of a 16.7 ms frame |
| forced full-subtree layout of the coverage view | **0.2 ms** |
| DOM nodes, whole page, all six views present | **1,481** |
| SVG nodes | **265** |

`[M]` **File size, measured on the frozen deliverable:**

| | raw | gzip -9 | brotli |
|---|---|---|---|
| whole page | 144,581 B | **42,734 B** | 35,420 B |
| JS, comments stripped | 58,600 B | 20,651 B | — |
| CSS, comments stripped | 29,994 B | 6,295 B | — |
| the chart kernel alone | 3,798 B | **1,725 B** | — |

`[R]` The page figure is not the shipping figure and I am not going to present it as one: it
carries five views' fabricated data, two string tables (7,156 B), all the explanatory prose the
panel needs, and comments that are roughly a third of the source. The number that matters for
the ruling is the **kernel at 1,725 B gzipped against Observable Plot at 68,818 B**.

`[M]` **Zero horizontal overflow** on `<html>` and on the scroll container at 1440, 1100, 900
and 720 px, across all five chart views.

### 6.5 The mockup's "measured performance problem", corrected

`[V]` The coverage map's cost story in the mockup is the CSS comment *"That allowlist is the
whole 57,000-node cost story"*, and D12 records that 57,000 appears exactly once in the whole
repository — in that comment. `[M]` The panel measured the Coverage screen at 122 elements and
a 0.6 ms forced full-subtree layout. `[M]` This page's coverage view measures **0.2 ms** for the
same operation, on more marks.

`[R]` So there is no measured performance problem in the coverage map. There is a fabricated
number being used to justify a rule that is correct for other reasons. **The rule should keep
its justification and lose its number** — and the `.gloss`/`.fig` allowlist is kept here
unchanged for exactly the reason the panel gave: it is a rule about selectors, not a hope about
the compositor.

---

## 7. What the 29 unstarted UI tasks become

`[R]` Under this direction they stop being "build 29 screens" and become "build one substrate,
then configure 29 views." Concretely:

**One task that does not exist today and must exist first** — *the chart substrate*:
`public/lib/chart.js` (scales, `ticks()`, projection, crop marks, hatch defs) plus
`public/lib/figure.js` (the `<figure>` anatomy: eyebrow, title, plot, measure rule, legend,
table twin) plus a **degradation contract** shared by all of them. `[M]` 95 lines of kernel
today, and it must ship with unit tests for `ticks()` and `log1p()`. Everything below depends
on it, so it is the only serialising task in the set.

**Then the 29 collapse into four shapes:**

| Shape | Views it covers | What a task becomes |
|---|---|---|
| **Quantity bar on a shared ruler** (CSS box model, mirrors for free) | tier ribbon, coverage cascade, per-item share, spill diverging bar, delivery heatstrip, token bars | supply data + a scale; the ruler, the ghost lane and the dimension line already exist |
| **Position on an axis** (SVG, projection) | recency comb, admission staircase, activity pulse, sparkline | supply data + a scale; axis, ticks, crop marks, hover already exist |
| **Layered node graph** (SVG, deterministic columns) | relations ego-graph, supersession chain, gate ladder | supply nodes + edges + a class per edge |
| **State timeline** (SVG lanes) | audit stream, watch, injected-now, proc | supply lanes + a state string per cell |

**Six cross-cutting tasks that are written once and then never again**, each of which is
currently implicit in all 29:

1. The forced-colors block for SVG, written by system colour name. (Fixes D7 for every view at
   once, and it is *not* a per-component task the way the panel's "can wait" list assumes —
   done once in the substrate it is done everywhere.)
2. The print block: `color-scheme` reset (D1), twins opened, current view marked.
3. The motion contract: two durations, one curve, one reduced-motion answer per motion.
4. The hover/focus contract: one tooltip, `textContent` only, keyboard parity, ≥24px targets.
5. The table twin: generated from the same rows the chart draws, so it cannot disagree.
6. The reduced-transparency contract for the seven meaning-bearing opacities (D6).

`[R]` And three token-level items the panel already ruled must land first are applied in this
file so it can be judged as it would ship: `--gold #7d620f` (D2), dark `--crit #d27676` (D9),
light `--panel #fdfcfa` for the depth fix, plus the `--link` token the product does not have
and a real `.linkid` design at a 24px target (D3, D4). `[V]` `<meta charset="utf-8">` is
present (D8). `[V]` No identifier is case-transformed anywhere (D5). `[V]` Type is in `rem`
against a 16px root with a 10px floor.

---

## 8. My own weakest points, before someone else names them

`[R]` Four, in the order I would attack them.

**1. The kernel is a dependency that happens to live in the repo.** 95 lines today; it will
not stay 95 across eighteen views, and unlike a package it has no test suite, no changelog and
no upstream. Mitigation: tests for `ticks()` and `log1p()` on day one, and a written trigger —
past ~600 lines, re-cost against Observable Plot rather than defend the decision out of habit.
`[R]` This is the strongest argument against my direction and I would rather state it than
have it stated at me.

**2. One shared absolute axis makes a large repository unreadable.** `[M]` The coverage
cascade is excellent at 21 files. At 4,000 files across 300 directories every leaf row is a
pixel wide and the shared axis stops informing and starts flattening. It needs a per-level
rescale, a log axis, or roll-up-and-drill, and **none of those is designed here**. This is the
weakest *view* in the set and it is the one that has to survive a real repository.

**3. Motion carries meaning, and motion is the first thing anyone cuts.** Two figures use
animation to say something. The substitutes are real — the threshold line is always drawn, and
surviving nodes leave a hairline — but they are strictly weaker than watching the crossing
happen, and a reviewer is entitled to call this a nice-to-have that got promoted to a channel.

**4. The RTL axis ruling is mine, not the panel's.** I ship "layout mirrors, magnitude axes do
not" and argue it from Hebrew and Arabic mathematical typesetting and from the product's own
`direction:ltr` rule for identifiers. The published survey is genuinely split and the mockup
currently does the opposite. Every SVG figure flips with one attribute — but the *argument*,
not the code, is the thing that could be wrong.

`[R]` A fifth, smaller: this file translates the chrome and the figure notes into Hebrew but
does not meet the mockup's 396-key parity discipline, and it uses no external font, so D11 —
the mono stack having no Hebrew face — is inherited unchanged.

---

## 9. Tools consulted, and what each one changed

The pinned rule `RULE-ui-work-consults-every-installed-design-frontend-and-browser` names these
by name. This is what each actually did.

| Tool | What it changed |
|---|---|
| **`dataviz`** (primary) | The largest single influence. Directly produced: the surface-gap-not-border rule for segments; solid-not-dashed gridlines; coverage as an **ordinal ramp plus two textures** rather than four categorical hues; the measure-before-you-label rule for in-mark labels; white-or-ink-by-luminance for labels inside a fill; proportional vs `tabular-nums`; the **table twin on every figure**; hover-and-focus parity with `textContent`-only tooltip construction; ≥24px hit targets on marks; 45°/135°-only hatch angles. I also checked the finished page against `references/anti-patterns.md` entry by entry — it caught the two label-clipping cases and the border-around-marks case while I was building. |
| **`frontend-design`** | Changed the shape of the whole thing. Its calibration section names the three looks AI-generated design defaults to; I would have produced the third (broadsheet hairlines, zero radius, dense columns) on autopilot. Instead it pushed me to ground the direction in the subject's own world, which is where the **drafting vocabulary** and the **absence channel as the signature** came from — and to spend boldness in exactly one place, which is the headroom dimension line and nowhere else. |
| **`visual-documentation-skills:dashboard-creator`** | Honestly: almost nothing, and usefully so. Its pattern is a KPI-card grid with a hero number and an SVG bar chart — the exact generic default `dataviz` and `frontend-design` both warn against. Reading it is what made me delete the KPI row I had sketched and open the page on the ribbon at full width instead. Negative evidence is still evidence. |
| **`ui-ux-pro-max:design`** | Its `charts.csv` confirmed two form choices against a written matrix rather than my memory: **adjacency/layered graph over force-directed** for ≤100 nodes where precise connections matter, and **network graph is wrong past 500 nodes without pre-clustering** — which is where the ego-graph's 60-node hard cap earns its place. Its `motion.csv` intensity tiers set the two durations (150 ms chrome, ~400 ms data) and the ease-out curve. |
| **`context7`** | Fetched current Observable Plot docs. Two facts that changed the verdict: Plot renders standard SVG and **defaults its marks and axes to `currentColor`** — which is the exact construct that fails under forced colors — and Plot defaults to `system-ui` and `max-width:100%`. Without this I would have argued the library case from memory and got the accessibility cost wrong. |
| **`chrome-devtools-mcp:a11y-debugging`** | Its method is what the 48-state audit implements: contrast against the *composited* background, tap targets, focus order, keyboard parity, semantic roles. It is why the audit checks focus reachability and target size rather than only colour. |
| **`chrome-devtools-mcp:debug-optimize-lcp`** | Ran a real trace: LCP 225 ms, TTFB 5 ms, render delay 220 ms, CLS 0.00, plus the DOMSize insight. It also flagged "enable text compression" — which is my throwaway test server, not the page — and that is precisely why the compressed figures in §6.4 are measured on disk instead of taken from the trace. |
| **Web research (not memory)** | Observable's faceting/small-multiples idiom; Grafana's state-timeline and its `single | all | hidden` tooltip modes and shared-crosshair behaviour (the audit-stream form and the ribbon↔table cross-highlight both come from here); Linear's restraint and its "if motion doesn't serve a purpose, skip it"; Melanie Richards on `currentColor` failing in forced-colors mode and the `preserve-parent-color` fix; the IEEE VIS 2024 RTL design-patterns survey and Gorelik's textbook evidence on x-axis direction; matplotlib's `symlog` — which I read and then **rejected**, for the reason the page states in full. |
| **Playwright MCP** | The 48-state audit, the forced-colors and print emulation, the keyboard sweep, the responsive overflow check, and every screenshot. |

---

## 10. The question for the owner

> **In Hebrew, does a magnitude axis mirror with the layout, or stay left-to-right with the
> numerals?**

Everything else in this direction is settled by measurement. That one is a ruling, the evidence
is genuinely split, and this page renders both answers side by side so it can be made by
looking rather than by argument. It is one attribute either way.

---

*Built 2026-08-21 on branch `v2/dir-d`. Nothing in the product was changed: this direction
writes only under `reports/design-panel/dir-d/`, and `node_modules` was never touched — the
library builds measured in §2 were downloaded into a scratchpad outside the repository.*
