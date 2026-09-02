# Visual direction — CSS Expert panel seat

Sketch: `sketches/04-visual.html` (self-contained, `light-dark()` theme toggle, EN/HE toggle,
logical properties only, one flagged physical-property exception in a code comment).

## Direction

**Evolve, don't replace.** The paper-and-gold editorial look is not decoration bolted onto this
product — it's the correct *material metaphor* for what the product does. This is a tool that
renders a verdict on a governance question ("does this govern that path? on what terms? did it
fit the budget?"), and paper-plus-a-single-ink-of-authority is literally how legal and editorial
documents signal "this is the record, and here is the one mark that means it's binding." A
consumer-app palette (saturated brand blue, elevated cards floating on gradients, rounded pill
buttons everywhere) would work against that: it reads as *product*, and this tool's whole
argument is that it is not a wiki, not a dashboard-for-its-own-sake — it's closer to a ledger.
Replacing the look for something "shinier" in the generic SaaS sense would be the visual
equivalent of the §2 argument the spec's owner already rejected once: it optimizes for how the
thing looks rather than for what it actually is.

Where the current sheet is genuinely weak is not its *palette*, it's its *system discipline*: nine
ad-hoc font sizes with no ratio (16/14/13/12.5/12/11.5/10.5/10/9.5px), a dozen-plus one-off
spacing values (4,5,6,7,8,9,10,12,13,14,16,20,22px), six radii for what should be three tiers, and
one flat `--sh` shadow reused identically for a resting card, a popover, and an alert banner —
three surfaces at three different conceptual depths, rendered as if they were one. That's not a
palette problem, it's a *scale* problem, and it's exactly what makes a redesign expensive to
extend later (every new component either invents a tenth font size or has to reverse-engineer
which of the twelve spacing values was "the right one" for this context).

**Concrete tokens** (see the sketch's `:root` for the full set with values):

- **Palette:** keep the ten semantic surface/ink tokens (`paper/panel/sink/ink/dim/faint/rule/edge`)
  and the four semantic accents (`gold/ok/warn/crit`), but derive each accent's background and
  border tint from the accent itself via `color-mix(in oklch, var(--accent) 12%, var(--panel))`
  instead of six hand-picked hex pairs per theme. Same visual result, half the tokens to keep in
  sync, and the *relationship* ("a chip background is 12% of its ink colour over the panel") is
  now legible as code instead of implicit in a colour picker's history. Add one surface step,
  `--panel-2`, an elevated tint distinct from `--panel`, for anything that floats (popovers,
  banners) — currently they reuse `--panel`, which is why a popover and a card look like the same
  object at a different z-index rather than genuinely different materials.
- **Type scale:** 7 steps — `10 / 11 / 12.5 / 14 / 16 / 22 / 30px`. 12.5px is the *dense body*
  size (table cells — this tool's default reading size, not an exception to it); 30px is reserved
  for exactly one use, below.
- **Spacing:** a 4px base — `4/8/12/16/20/24px`. No in-between values. A hairline 2-3px is
  allowed only for chip/badge internal padding, treated as a documented exception, not a seventh
  step.
- **Radius:** 3 steps — `3px` (chips, dots), `5px` (buttons, inputs, nav rows), `8px` (cards,
  popovers, banners). Nothing gets a bespoke radius.
- **Elevation:** 3 named tiers (`--e1/--e2/--e3`) each paired with a surface step
  (`panel`→`panel`→`panel-2`), so "raised" means a lightness change *and* a shadow change, not
  shadow alone — which matters most in dark mode, below.
- **Density model:** stay dense by default — 12.5px body text, tight block rhythm, borders doing
  the separating work instead of padding. This is a tool developers keep open in a side monitor
  while working; comfort-mode padding would cost more screen real estate than it buys in
  legibility. No comfortable/compact toggle proposed — it's a second density system to maintain
  for a product whose whole ethos is not building things that don't need building.

## Shine that earns its place

**Earn it — visual weight mapped to epistemic status, not to flair.** The one idea I'd actually
fight for: give the *measured, shipped* numbers (the 0.55ms audit-append p95) real size — 30px
mono, bold — and keep every *fabricated demo* number at normal body size with a small
"illustrative" tag beside it. Right now both classes of number render identically, which is
backwards for a product whose defining bug class (30+ recorded instances, per
`web-ui-mockup.md`) is asserting a property the code doesn't have. Making the true number the
*visually loudest* thing on the screen is shine that is also honesty — it's a design pattern that
literally cannot be applied to a claim that isn't backed by a measurement, so building the UI
around it is a forcing function against the exact defect this project keeps naming.

**Earn it — motion that reports a real change.** The budget bar's fill transitioning
(`inline-size`, ~260ms ease-out) when the underlying proportion actually changes (dragging the
simulator, switching sessions) is legitimate: it's telling you something moved, not performing
liveliness. Same logic for a lightweight `background-color` flash on the Copy button when a
clipboard write actually succeeds. Both are motion *reporting an event*, which is the only kind
of motion this product should ship.

**Earn it — restraint as the shine mechanism for gold.** Gold currently marks exactly one thing:
"this governs, unconditionally." Keep it that rare. The temptation under "make it shine" is to
reach for gold as a general brand accent — gradient headers, gold-tinted buttons, a gold glow on
hover. Don't: the moment gold appears on something that *doesn't* mean "pinned/governs," it stops
being a signal and starts being wallpaper, and the one screen where gold's rarity currently
carries real information (the injection preview's "pinned" chips) gets quietly diluted.

**Decoration — reject these:** gradient-mesh/aurora backgrounds behind cards (the "AI product"
glow-blob cliché — implies ambient intelligence this tool explicitly is not); `backdrop-filter`
glassmorphism (expensive, inconsistent across engines, and implies a translucent-layering
metaphor that doesn't match a flat, single-pane data reader); spring/bounce easing (a playful,
consumer-app register wrong for a compliance tool); a light-sweep shimmer used as generic "premium"
loading polish rather than an honest loading state (a genuine skeleton pulse during a slow decay-
chart render is fine; a diagonal shimmer implying "processing something impressive" overstates a
product whose selector is asserted under 10ms); confetti/celebration on "in sync"; illustrations
or hero art (nothing in this product is illustratable honestly — it's textual and structural).

## Dark mode

The `light-dark()` + `color-scheme` architecture is the right call and should stay exactly as
architected — one token definition instead of three copies, `color-scheme` doing the mode
selection so native form controls and scrollbars don't flash the wrong theme before JS runs.
Three concrete improvements:

1. **Add an elevated-surface tint (`--panel-2`).** Popovers and the exited-server banner currently
   reuse `--panel`, so "floating above the page" is communicated by shadow alone. In dark mode
   shadow barely registers against a near-black background — depth needs to be readable as
   *lightness*, the way it already partly is between `--paper` (#0f0f12) and `--panel` (#17171c).
   Extend that ladder one more step for anything that floats.
2. **A dark-mode-only inset highlight, not more shadow.** A drop shadow's whole job is showing
   where light *isn't* reaching; on a dark background there's no light to withhold. The
   professional fix is a 1px lighter inset edge (`box-shadow: inset 0 1px 0 <faint white>`,
   defined via `light-dark()` so it's a no-op in light mode) standing in for what shadow does in
   light mode. Sketch demonstrates this on `.floating`.
3. **Recheck `--faint` at small sizes.** `#94918a` on `#f7f6f2` for 10-10.5px uppercase eyebrow
   labels (`.cnt`, `.wave`, section labels) is a real WCAG risk at that size/weight — worth an
   actual contrast audit before shipping; the sketch darkens it slightly as a starting point.
   Everything else (the dashed/solid/hollow dot redundancy, the print stylesheet forcing pure
   light regardless of theme, the theme toggle's `◐` glyph needing no icon font) is already right
   and should be kept as-is.

## Dense surfaces

This is most of the product, so small, non-decorative fixes compound:

- **Tables:** add zebra striping (`tbody tr:nth-child(even)`, low-opacity tint) and sticky
  `<thead>` for anything that scrolls long (audit stream, Ask results) — currently a scrolled
  table loses its column headings. Right-align and tabular-num numeric columns explicitly (a
  `.num` utility, decoupled from `.m` — not every number is monospace-identifier text). Add
  `tr:hover` on tables that are actually clickable rows, which today only nav items get.
- **Trees:** the coverage tree currently indents with four literal `&nbsp;` per level baked into
  the text node. That's fragile (not a token, can't be resized, doesn't communicate structure to
  assistive tech) and it's an RTL smell in waiting the moment anyone touches that markup. Replace
  with `padding-inline-start: calc(var(--depth) * 16px + 6px)` set via an inline `--depth` custom
  property per row, plus real `role="tree"`/`role="treeitem"`/`aria-level` — the hierarchy becomes
  legible to a screen reader for free, not just visually. A subtle `border-inline-start` guide
  line at each indent step (VS Code's file-tree pattern) helps the eye track parent/child in
  deeper trees; it's `border-inline-start`, so it needs no RTL handling at all.
- **Code / compose blocks:** the compose-don't-write treatment is already this mockup's most
  faithful part — keep the pattern exactly. Add one thing: visually flag the destructive/greppable
  token (`--yes`) inside the composed command in the warn colour. The spec calls `--yes` out by
  name as "an explicit, greppable token in the transcript" that buys legibility, not security — 
  giving it visual weight in the UI is that same legibility property, just applied a moment
  earlier, before the paste rather than after.
- **Diffs:** the review queue is currently a per-field table with a `stale` chip but no diff
  colouring. Word-level `<ins>`/`<del>` around the actually-changed substring (real semantic
  elements, not spans — announced by assistive tech with no extra ARIA) is a concrete instance of
  spec §1's own test: a terminal can show a two-column diff, but inline word-level diff colouring
  inside a table cell is not something `diff` in a shell does pleasantly. This is the strongest
  "shine" candidate in the whole review because it's also the highest-value functional win.
- **Charts (decay, W3):** no charting library is available or needed. Hand-roll bars/sparklines as
  plain elements sized through a `--v` custom property and `calc()` — the "chart" is markup plus
  arithmetic, zero JS charting logic. Keep the measurement-window caveat as permanent visible
  caption text under the chart, not a hover-only tooltip — consistent with the project's
  "staleness is never silent" rule applied to a chart's honesty about its own window.

## RTL strategy

The existing sheet is close to fully logical already, and the one exception it has
(`.nav[aria-current] { box-shadow: inset 2px 0 0 var(--gold) }`, mirrored via an explicit
`[dir="rtl"]` override) is handled correctly. Auditing the rest of the file for anything that
*can't* be expressed logically, and for gotchas any new "shine" work would introduce:

| Not logical | Why | Mirroring strategy |
|---|---|---|
| `box-shadow` offsets | no logical form exists | explicit `[dir="rtl"]` override (already done for `.nav`; do the same for the new `.stale` diff indicator) |
| `linear-gradient(to right, …)` | direction keywords are physical | a `--grad-dir` custom property, `to right` by default, redefined to `to left` under `[dir="rtl"]` — same technique as `--flip`, one definition instead of a duplicated rule per gradient |
| `transform: translateX()` / any horizontal transform | physical axis | a `--flip` custom property (`1`, `-1` under `[dir="rtl"]`) multiplied into the offset via `calc()` |
| CSS border-triangle hack (any hand-drawn arrow/caret pointing sideways) | built from physical border sides | `[dir="rtl"] .thing { transform: scaleX(-1) }` — cheap, and the shape doesn't need redrawing, just flipping. A *vertical*-pointing chevron (select caret, expand/collapse arrow drawn as a rotated corner) needs no mirroring at all — down is down in both directions, which the sketch's select caret relies on |
| `background-position` used for a decorative or functional icon (e.g. a custom `<select>` caret via the common two-gradient trick) | percentages in `background-position` are box-relative, not writing-mode-relative, in every shipping engine — this is a genuinely common, genuinely silent RTL bug | avoid it structurally: draw the caret as a pseudo-element positioned with `inset-inline-end` (logical) instead of a background image positioned with a percentage. Demonstrated in the sketch's `.selwrap::after` |
| Identifiers/paths/hex-values/code embedded in RTL prose | must stay LTR or reorder incorrectly against surrounding punctuation | the existing `.m,code,kbd{direction:ltr;unicode-bidi:isolate}` rule — the single most important line in the sheet. **Checklist item for every new component:** if it renders an id, a path, or a code token, it gets `.m` or it inherits the bug the comment above that rule describes |

Everything else — `grid-template-columns`/`grid-template-areas` (direction-aware automatically),
`text-align:start`, all `margin-inline`/`padding-inline`/`inset-inline` usage, the drop-shadow
token (`--sh`/`--e1..3`, which have no horizontal offset component and so need no mirroring at
all) — is already correct and should be the template for anything new. **Process note:** the
project's existing `test/docs/parity.test.ts` pattern (assert the EN/HE key sets are equal) is the
right model for a CSS-adjacent test too — nothing here can be asserted about *translation
freshness*, but a lint that greps the stylesheet for `margin-left|padding-right|text-align:\s*left|text-align:\s*right`
and fails the build on a match would catch the regression class this table exists to prevent,
cheaply, in CI, forever.

## Component inventory

15 primitives, named to match the existing sheet's conventions where one already exists:

1. **Card** (`.card`) — base surface, `--e1`, `--r-md`; `.raised` variant for interactive-hover contexts (`--e2`).
2. **Floating panel** (`.floating`, extends `.pop`) — `--panel-2` + `--e3` + dark-mode inset hairline; anchor for pickers, alerts.
3. **Chip** (`.chip`) — semantic verdict badge; 4 variants (`gov/ok/warn/crit`), colour/border/bg derived by formula from one accent token per variant.
4. **Table** (native `table` + `.num`, zebra, sticky `<thead>`) — the primary dense-data primitive; used by every "Core" and "Watch" screen.
5. **Tree** (`role="tree"`, `[role="treeitem"][style="--depth:n"]`) — hierarchical disclosure list; depth via custom property, guide line, status dot.
6. **Bar/gauge** (`.bar`) — proportional fill, multi-segment (fits/spills), animated `inline-size`.
7. **Command block** (`.cmd`) — the compose-don't-write treatment; scrollable code, copy button with success micro-state, flagged destructive token, warn-coloured `cmdnote`.
8. **Diff cell** (`ins`/`del`, `td.stale`) — word-level and field-level change indication for the review queue.
9. **Empty state** (`.empty`) — dashed border, heading, explanation, embedded `.cmd` next-step.
10. **Banner** (`.banner`) — full-width lifecycle alert (`--e3`+`--panel-2`, `--crit` ring); server-exited state.
11. **Nav row** (`.nav`) — rail navigation button; gold inset-start accent when current, count/wave badges.
12. **Segmented control** (`.seg`, generalising the existing `#wfilters button[aria-pressed]` pattern) — toggle-button group for audit-kind and query filters.
13. **Form field** (`select`/`input` + `.selwrap`) — consistent border/radius/focus-ring; hand-drawn logical caret (no `background-position` trick).
14. **Status dot** (`.dot`) — colour + shape redundant small-state marker (solid gold / solid ok / dashed warn).
15. **Chart** — hand-rolled bar/sparkline via `--v` custom properties and `calc()`, with a permanent (non-hover) caveat caption.

Honourable mention, not counted: the page-header pattern (`.phd` + `<h2>` + `.verdict`) and the
status-strip segment (`.strip` item + `.sep`) are both reusable enough to formalize the same way if
the count were 17.

## Headline

Keep the paper-and-gold direction — it's the correct material metaphor for a governance tool, and
the fix this UI needs is systemic (real type/spacing/radius/elevation scales) rather than
stylistic. Let "shine" mean two things only: gold stays rare enough that it still means something,
and visual weight gets reserved for what's actually measured — the 0.55ms figure sized like a
headline is worth more, and is more honest, than any gradient. RTL is nearly solved already; the
handful of physical-property exceptions (gradients, transforms, a select caret) all resolve with
the same one-line technique the codebase already uses for `box-shadow`, so extending it costs
almost nothing.
