# Direction C — **Ink Order**

**Deliverable:** `reports/design-panel/dir-c/prototype.html` — one self-contained file, no external
requests. Injection preview and Audit stream, both themes, Hebrew RTL, motion running.

---

## The idea, in one sentence

> **Every answer in this product is inked in the order the machine computed it and stops where the
> machine stopped — so what was never reached stays visibly un-inked, colour is spent only on
> quantities that were measured, and the corpus speaks in a different typeface from the tool.**

It is not a look. It is one rule about **when a mark is allowed to appear**: a thing may be drawn
only once the machine has actually computed it, in the position the machine computed it in.
Everything else in the direction falls out of that rule.

---

## Why this product and no other

Three facts about mycontext are unusual enough to build an identity on, and all three are already
in the mockup, unexploited.

**1. The order *is* the explanation, and the current drawing cannot say so.**
`preview.whyn` spends ninety words explaining that the gate ladder must be read in `select()`'s own
order, that the rungs above passed, that the rung itself carries the diagnosis, and that everything
below is *not reached rather than passed*. It needs ninety words because a static list of six rows
cannot express a sequence that halts. Ink the rungs in order, in ~500 ms, and stop the pen dead at
the gate that binds, and the caption becomes a footnote instead of the load-bearing element. **The
animation is not decoration on the ladder; it is the ladder's missing dimension.**

**2. This product's hardest drawing problem is absence, and no dashboard has that problem.**
The ghost lane. The hatched void. "not examined" ≠ "gap". A tier drawn *absent*, hatched and named,
because "an empty track would claim it ran and delivered nothing, which is a different fact." "A
zero-length bar would be a claim the record does not make." Every other product draws what happened.
This one has to draw what didn't, and be precise about *which kind* of didn't.

So absence gets **one** treatment — a diagonal hatch at 3:1 — and it carries all of it: spilled, not
reached, not examined, not recorded, absent tier, never delivered. Learned once, read everywhere.
Never grey-out, never empty. And the failing gate's pen physically **stops short** of the end of its
track: the un-inked remainder is the fact, not the red colour.

**3. The product already rules that the corpus and the tool are different voices. It just says it
with a box.** `pane.well`: *"Corpus text sits in a well and inside `<bdi>`. The product's own words
never do — that is how you tell them apart."* This direction makes that rule **typographic**, which
is the one place it cannot be missed:

| voice | face | what it says |
|---|---|---|
| **Instrument** | IBM Plex Sans + IBM Plex Sans Hebrew | the product's own words |
| **Machine** | IBM Plex Mono, always LTR | identifiers, paths, commands, every figure |
| **Corpus** | Frank Ruhl Libre, 300–900 variable, Latin *and* Hebrew in one file | text read off disk |

The corpus is set **larger and looser than the chrome** — an inversion, and a statement: the governed
words matter more than the tool that shows them.

Two things make this pairing a choice rather than a default. Plex Mono **has no Hebrew and does not
need one**, because the product's own rule says identifiers never mirror — the gap in the superfamily
*is* the rule, made material. And the Hebrew of IBM Plex Sans Hebrew and the Hebrew of Frank Ruhl
Libre are **drawn by the same designer, Yanek Iontef**, so the two voices are distinct in Latin and
harmonised in Hebrew. Frank Ruhl Libre is Rafael Frank's 1908 Hebrew book serif: the face a body of
standing text is set in.

---

## The pen set — and the thing the mockup says it lacks

The brief noted: *there is no colour meaning "clickable"; gold means "this governs."* Under this
direction that is not a defect, it is **the rule**:

> **Colour is reserved for measured quantities. Five pens, no sixth, because there is no sixth
> quantity. Interaction is never a hue.**

| pen | means |
|---|---|
| gold | governs — has authority here |
| viridian | delivered · measured · in sync |
| ochre | deficient — gap, drift, needs attention |
| oxide | refused · withheld by rule · failed |
| indigo | carried in from somewhere else |
| *(hatch)* | *absent — not a pen* |

Interaction is an **inked underline that travels** on hover and focus — the same gesture as every
other mark on the page. The rail's current screen is a **pen mark in the margin**, where a reader
ticks their place. Nothing is coloured to say "you may click this."

This also settles a question the mockup leaves ambiguous: the budget ribbon's filled segments are all
viridian, because a filled segment means *delivered*. `pinned` is the single exception, and gold there
is not a fourth tier colour — a pinned item genuinely **governs every path**, so it is the gold pen
doing its own job.

**Deliberately rejected:** `ui-ux-pro-max`'s own palette database returns, for "Developer Tool / IDE",
`#0F172A` ground with `#22C55E` accent, annotated *"Code dark + run green"* — which is precisely the
near-black-plus-acid-green default the `frontend-design` skill names as an AI tell. Also rejected: the
warm cream `#F4F1EA` + serif + terracotta cluster, which is the direction the current mockup already
leans toward. The ground here is a **cool oat-grey** — a bed a record lies on, with the record itself
sitting lighter on top of it, and the chrome bands taking the bed colour so the paper reads as paper.

---

## The signature: the checksum sigil

Every item carries a mark drawn deterministically from its checksum, in the dimensionless spirograph
form of a **guilloché** — the curve a rose engine cuts into a share certificate:

```
x(t) = R[(1−k)·cos t + l·k·cos((1−k)/k · t)]
y(t) = R[(1−k)·sin t − l·k·sin((1−k)/k · t)]
```

`k` and `l` come straight out of the hash, so the ornament **is** the checksum. This is chosen and not
merely pretty for one reason: guilloché exists in security printing precisely because it is machine-
derived and cannot be redrawn by hand. That is what a checksum is for.

And it does a job no identicon does. A checksum is sixty-four characters nobody reads. A mark is
recognisable across screens — the same item in the preview, in the audit stream and in the pane — and,
crucially, **it changes visibly when the file on disk changes**. Open
`CONST-zero-runtime-dependencies` in the prototype: the recorded checksum's mark and the file on
disk's mark are drawn over one another in gold and oxide, and drift is legible without reading a hex
digit. Marks appear only in the item table, the pane, and audit rows that *name an item*; they are
never sprayed across the record.

---

## Motion — four motions, and no fifth

| motion | what it is | easing |
|---|---|---|
| **ink** | a pen travels across a track | `cubic-bezier(.25,.05,.20,1)` · 300 ms |
| **draw** | a stroke is laid down (sigils) | same · 620 ms |
| **stamp** | a mark lands on paper | `cubic-bezier(.30,1.45,.55,1)` · 190 ms |
| **feed** | the record advances by one row | **`linear`** · 360 ms |

A plotter pen rides a servo: it ramps and settles, so **ink eases**. Paper on a sprocket does not —
the feed is a stepper at constant rate, so **feed is linear**. (Railway's split-flap board on their
homepage eases nothing, for exactly this reason: mechanical things don't ease.)

The page-load sequence is **the selector running**, ~1.6 s once: run pens, then the delivered rows'
sigils, then the ladder in `select()`'s order, then the ribbon in first-fit order — fills inking,
ghosts outlining, in the position the selector considered each one. Nothing loops except the activity
pulse, which is honestly live, and whose newest column is drawn as still filling because a recorder
always has a partial bucket and drawing it as complete would be a claim.

Every duration is declared **twice** — once with a value and once at 1 ms — with delays multiplied by
a `--t-scale` that goes to `0`. Under `prefers-reduced-motion` the animation still *runs* and simply
lands, so there is no second code path and **no `!important` anywhere in the sheet**. (Stripe's
pattern; it is better than the blanket override the mockup would otherwise need.) A **Still** button
in the header lets the owner flip it and compare side by side.

---

## Across all twenty-one screens, not just these two

The direction is four rules, and each maps onto screens I did not build:

**Ink order = computation order.** Budget simulator's staircase inks left to right as the sweep
evaluates; the rung the slider snaps to stamps. Doctor's checks ink in the order the doctor runs them
and stop at the first that fails. Review queue inks in queue order. Relations draws edges in
traversal order. Coverage gaps inks per directory as the walk descends. Where there is no order,
there is no ink sequence — Status and Configure simply appear.

**Un-inked is a value.** Scope coverage's "not examined" dot becomes the hatch and stops being
confusable with "gap". Decay's recency comb hatches the *never* bucket instead of putting it at
infinity. Export/import hatches what a pack does not carry. Ask hatches a result set that was
truncated, distinct from one that was empty.

**The pen set.** Every count, chip and bar on all 21 screens takes one of five pens or the hatch.
This is the rule that most constrains future work and the one most worth adopting even if the rest is
rejected: **no new colour without a new measured quantity.**

**Three voices.** Composer and Capture show corpus text — book face. Documentation, Tutorials and
Learn are the product's own prose — instrument face. Ask's SQL, every path and every id — machine
face, LTR. The rule that decides which face a string takes is *exactly* the rule that decides whether
it has a `data-t` key, which brings us to cost.

**Structure encoding something true.** Each run's head carries, at its reading end, a small monospace
line naming **where its figures came from**: `select() · 09:14:02`, `injection() · select() order`,
`itemCost() · first-fit`, `audit.jsonl · tail -f`. That is the ledger's *folio column* — the reference
to the source of an entry — and in a provenance tool it is the one fact every block owes the reader.
It is also **free**: those strings are machine literals, unkeyed, exactly as the audit `kind` values
are.

---

## What it costs

**Build step: none.** Plain CSS and plain DOM, no framework, no bundler, no preprocessor. Every
data-driven size is set through `style.setProperty`, and no node is built from an HTML string — so the
shipped `style-src 'self'; script-src 'self'` is satisfied unchanged. Extracting this into
`public/styles.css` + `public/lib/*.js` is a copy-paste, not a port.

**Fonts: 150 KB raw / 202 KB base64 for four faces**, all SIL OFL 1.1 (IBM Plex Sans, Plex Sans
Hebrew, Plex Mono © IBM Corp; Frank Ruhl Libre © Yanek Iontef, Michal Sahar, Danny Meirav). This is
the direction's only real material cost and it deserves naming plainly: the product's own
`CONST-zero-runtime-dependencies` says the CLI, MCP server and hooks ship with nothing. Fonts are UI
assets served by the local server to a browser, so they fall inside the panel's dependency ruling —
but they are 202 KB added to an npm package that prides itself on being small. **Shipped they should
be four separate `.woff2` files under `public/fonts/`, not base64**; they are inlined here only
because this deliverable must be one self-contained file. If the owner rejects the cost, the
direction survives on `ui-sans-serif` / `ui-monospace` / `Georgia` with `font-size-adjust:
cap-height` — it loses the corpus voice, which is the part I would fight for.

**Runtime: cheap.** Only `transform` and `opacity` are animated, so motion stays on the compositor.
Custom properties carry *delays*, never animated values — animating through a `var()` forces paint on
every frame. There is no `backdrop-filter`, no blur, no shadow stack: the mockup's 57,000-node gloss
cost story does not arise, because this direction's depth cue is a **rule**, not a paint.

**The 396-key EN/HE string system: essentially zero.** This is the strongest practical argument for
the direction and the one I most want on the record.

- The prototype uses the **shipped mechanism unchanged** — `data-t`, `data-t-aria`, `data-t-title`,
  with `{m:…}` / `{v:name=…}` / `{mv:…}` markers. Both languages render through the *same* code path,
  so English cannot silently diverge.
- The direction changes **paint and order**, not words. The hatch, the pens, the ink sequence, the
  sigil, the double rule and the three faces are all CSS; not one of them needs a string.
- The folio line in each run head is a machine literal, unkeyed — the same class as the audit `kind`
  values.
- **Net new keys across both screens: one.** `gate.notReached` — and it *removes* a defect: the
  mockup builds "not reached — " behind a `HEB ? … : …` ternary that no string table can see and the
  parity check cannot count. (`demo.replay` and `demo.still` label panel scaffolding and would not
  ship.)

**Where it costs real work:** every screen must be walked once to re-file its colours into the five
pens and its emptinesses into the hatch. That is a day of judgement calls per screen group, not a
rewrite, and it is the same walk any of the other directions needs.

---

## Accessibility, RTL and print — measured, not asserted

- **Contrast, measured in-browser in both themes.** Worst text: **4.70:1** light (`.cnt`), **5.69:1**
  dark. All five pens ≥ 4.9:1 on the record. The hatch is a *meaningful graphical object*, so it owes
  3:1 under WCAG 1.4.11 and was corrected from 2.2 / 2.0 to **3.4 / 3.7**. Control bounds got their
  own token, `--ctrl` (**3.0–3.5:1**), separate from `--rule-2`, which bounds rules and owes nothing —
  the same split the mockup made with `--edge` / `--edge-3`, and for the same reason.
- **Targets.** 33 focusables, all with accessible names, none under 24 px. Item links got
  `padding-block` on the control rather than the cell, so they reach 24 px without the record
  loosening.
- **RTL is not a mirror-and-hope.** The pen's travel direction is a token (`--po`) and the hatch angle
  flips with it, so the failing gate's pen stops short on the *reading* side in Hebrew. Hebrew loses
  uppercasing and letter-spacing on every label (Hebrew is unicase; letter-spacing damages it).
  `font-synthesis: none`, because Plex Sans Hebrew is static-weight and browsers will happily smear or
  skew Hebrew, which a Hebrew reader reads as broken. Two real bidi bugs were found and fixed by
  testing rather than by reasoning: pane values were being reordered
  (`.mycontext/items/X.md` → `mycontext/items/X.md.`), and the corpus well took the *interface's*
  direction instead of the *corpus's* — now `dir="auto"` on the block, with `:dir(rtl)` sizing, so a
  Hebrew rule inside an English UI sets right-to-left and an English rule inside a Hebrew UI sets
  left-to-right. **Both cases are in the prototype**; open `RULE-never-log-customer-email`, which was
  authored in Hebrew.
- **Print.** Motion is irrelevant on paper because the printed state is the *final* state — nothing
  needs to be re-drawn to be correct. `@media print` neutralises transforms, drops the chrome and
  reveals hidden screens. The hatch and the double rule survive monochrome by construction; the pens
  do not, which is why every pen is paired with a word.
- **Degradation.** `prefers-contrast: more` and `forced-colors: active` move the depth cue from paint
  to edge, hatches become dashed `CanvasText` borders, and the sigil goes to `CanvasText` at full
  opacity.

---

## One borrowed convention worth keeping

`0.55 ms audit append p95` carries a **double rule** underneath it. In accounting a single rule under
a figure means the figure is still running; a double rule means the procedure is complete and no
further entry will be posted. It is the one measured number in this product, and it is the only thing
on any screen that gets that mark. Anyone who has read a financial statement reads it correctly
without a legend.

---

## The thing I am least sure of

**The sigil is the part I would concede first, and the corpus serif is the part I would fight for.**

The sigil is the boldest element and the one closest to decoration. The honest case against it: the
id is already on the row, it is already unique, and a rosette next to it adds no information the id
does not carry — so it is an ornament that has talked its way into a dense working screen, and forty-
three of them is forty-three things to look past. Its defence is drift: the mark is derived from the
*checksum*, so it changes when the file changes, and that is a real failure mode this product cares
about which nothing else on screen surfaces. **But that defence only holds if the drift view ships.**
If the owner does not want drift-by-sigil, the sigil should be cut down to the detail pane alone, or
cut entirely — and the direction loses nothing structural, because the boldness would then have to be
spent on the ladder, where it belongs anyway.

Two smaller ones I would rather name than have found:

- **The corpus serif at working density.** Frank Ruhl Libre's Latin is a fairly high-contrast text
  serif. At 15.5 px in a well it is comfortable; if the owner wants the book face to spread into
  Composer, Capture and Documentation it will need testing at length, and 15.5 px may need to become
  16. Hebrew is the easier half — it holds up better than the Latin does.
- **Three of the five directions on this panel independently named themselves "the instrument."** That
  tells me the metaphor is the obvious answer and therefore not, by itself, an identity. I renamed
  mine to the mechanism instead. If the owner is comparing on vibe, these directions will look
  adjacent; the questions that actually separate them are: *does the drawing happen in the order the
  machine computed it, does absence have exactly one mark, and does the corpus speak in a different
  voice from the tool?*

---

## Tools consulted, and what each changed

| tool | what it changed |
|---|---|
| **`frontend-design`** | The centre of the assignment. Its named AI-default clusters (warm cream + serif + terracotta; near-black + acid green; broadsheet hairlines) ruled out my first two palettes *and* the mockup's current lean, and pushed the ground to cool oat-grey. "Spend your boldness in one place" is why there is exactly one flourish (the sigil) and why I now say I would cut it before anything else. "Structure is information" is why the runs are not numbered `01/02/03` — but the gate rungs *are*, because there the order genuinely carries meaning. |
| **`ui-ux-pro-max:brand` / `:design` / `:design-system`** | Changed the direction by **negation**, which was still worth the query: `search.py --domain color` for "developer tool audit provenance" returns Tailwind slate + `#22C55E`, *"Code dark + run green"* — the exact default. Seeing the templated answer written down is what made me confident the cool-grey/five-pen system was a choice. `:design` and `:brand` turned out to be routers to asset-management workflows and contributed nothing else. |
| **`artifact-design`** | The three-state theming discipline (bare `:root` = complete palette; never define a colour only inside a media or `[data-theme]` block), `tabular-nums` on every digit column, `overflow-x` on wide content, and the reminder that a token was *picked* rather than inherited. |
| **`chrome-devtools-mcp:a11y-debugging`** | Drove the measurement pass rather than an assertion pass. Produced the `--ctrl` token split, the hatch correction from 2.2→3.4, the `--ink-3` nudge, and the 24 px target fix. Every number in the accessibility section above came out of it. |
| **`chrome-devtools-mcp` (screenshots, evaluate)** | Found the bugs reasoning missed: an infinite loop in the string renderer (recursion sharing one `/g` regex), the activity pulse computing to zero height, a `<span>` illegally parented to `<tr>`, both bidi bugs, and the two-column break needing a **container** query rather than a media query because opening the detail pane narrows the record without narrowing the window. |
| **Web research** (typography, motion, editorial/archival design, Linear · Vercel · Raycast · Stripe · Warp · Railway) | Confirmed Frank Ruhl Libre as the answer to "open Hebrew serif with a real weight range" — variable 300–900, Latin and Hebrew in one file, Hebrew subset 18,748 bytes — and that IBM Plex Sans Hebrew's Hebrew is by the same designer, which is why the pairing works. Gave me the guilloché equations, the ledger single/double-rule convention, the folio column, Stripe's declare-durations-twice reduced-motion pattern, and Railway's `linear` split-flap easing, which is what split my motion into eased *ink* and linear *feed*. Also corrected two things I would have got wrong from memory: `font-synthesis: none` for Hebrew, and that the "Hebrew sets 5–15% larger" ratio is folklore — W3C's Hebrew Layout Requirements is silent on it, and `font-size-adjust: cap-height` is the real instrument. |
| **`mycontext` corpus itself** | Every string, number, gate, candidate cost and Hebrew translation is the mockup's own, copied key-for-key. Nothing here is machine-translated and no product content is invented. |
