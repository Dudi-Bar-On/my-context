# The web UI's visual direction — design

**Status:** approved section by section by the owner, 2026-08-21, in a live browser rather than from description.
**Supersedes** the visual direction of `docs/design/web-ui-mockup.html` and voids the measurements in `reports/2026-08-21-VISUAL-DIRECTION.md`.
**Does not touch** the mockup's 396 string keys, its EN/HE parity, its structure, or `test/ui/strings-parity.test.ts`.

---

## 0. Why this exists

A five-expert panel produced four prototypes and a cost table. The owner's verdict was that the improvements were real but it *"did not make the wow effect I was looking for"*.

**The cause was the brief, not the panel.** Every direction was loaded with the same research, whose conclusions were *design in monochrome first*, *default to stillness*, *no decorative gradients, glows or glass effects*, and a frequency law reserving motion for rare actions. Four experts given one foundation converged on it — **three of the five independently named themselves "the instrument"**, and one flagged that as evidence the space had collapsed. An explicit owner request for 3D and floating cards was dropped in favour of a research consensus. The owner's words should have won.

This design is the correction, arrived at by showing rather than describing.

---

## 1. The rulings

| Ruling | Decision |
|---|---|
| **Priority** | Impress in the first five seconds. Long-session comfort is *considered*, not a veto, and gets re-examined after the first iteration. |
| **Theme** | **Dark only.** No light mode. |
| **Material** | Glass, dark-tinted, subtle gloss, tint thinning a very little toward the upper-left. |
| **Depth** | 3D is **static** — panes sit on planes at a slight angle. Depth is the look, not an effect that fires. |
| **Motion** | **Only where clicking does something.** If it moves, it acts. |
| **Ground** | Radial blooms, purple and teal on `#0b0c11`. **Not** a diagonal composition — tried and rejected. |
| **Graphics** | Data sits on an opaque **plate**. Text may float on glass; data may not. |
| **Icons** | No category glyphs. Tier marks and a six-glyph action set only, from **Tabler outline**. |
| **Prefix** | Emphasised by **taking away** — the kind keeps full ink, the slug drops to `--dim`. |
| **Typefaces** | **Geist** for Latin, **IBM Plex Sans Hebrew** for Hebrew, **Geist Mono** for machine strings. One declaration, not a switch. |
| **Landing** | Repaint the mockup in place. One design of record, hero screen first. |

---

## 2. The token layer

### 2.1 The ground is a token, not a background

Glass has nothing to refract without a ground, so the ground is used identically on all 21 screens. That consistency is what stops the direction reading as *"the injection preview is special and the rest is a different app."*

```css
background:
  radial-gradient(120% 90% at 14% 6%, #433580 0%, transparent 58%),
  radial-gradient(115% 85% at 88% 92%, #0f6069 0%, transparent 60%),
  radial-gradient(90% 70% at 56% 46%, #23306f 0%, transparent 66%),
  #0b0c11;
```

### 2.2 The pane

```css
backdrop-filter: blur(20px) saturate(1.4);
border: 1px solid rgb(255 255 255 / .14);
background:
  linear-gradient(133deg, rgb(255 255 255/.07) 0%, rgb(255 255 255/.02) 46%, rgb(0 0 0/.05) 100%),
  linear-gradient(133deg, rgb(9 10 16/.56) 0%, rgb(9 10 16/.62) 34%, rgb(9 10 16/.64) 100%);
box-shadow: 0 2px 3px rgb(0 0 0/.4), 0 10px 22px rgb(0 0 0/.34),
            0 26px 56px rgb(0 0 0/.3), inset 0 1px 0 rgb(255 255 255/.20);
border-radius: 12px;
```

Two gradients, and the distinction matters. The first is the **gloss** — a fixed white sheen. The second is the **tint**, thinning from `.56` to `.64` so more ground comes through the corner nearest the light. That second one is the difference between a pane that is *lit* and a pane you can *see into*, and only the second reads as glass.

### 2.3 Why the glass is tinted dark

A white-tinted glass admits the ground's **brightness** and drags the text field up with it. Measured on the vivid ground, white glass gave `--dim` **4.10–5.44** across three positions — failing 4.5 in two of them. **Dark glass gave 6.28–7.18** for the same colour on the same ground.

Dark glass admits the *colour* but not the *brightness*, which is what lets the ground stay vivid everywhere — including the centre — while the reading field stays where the type expects it.

### 2.4 Measured contrast

Sampled from rendered pixels with the blur, glass and ground composited. Not read from a stylesheet.

| Token | Value | Measured | Needs | Verdict |
|---|---|---|---|---|
| `--ink` | `#f0eef6` | 12.89 | 4.5 | passes |
| `--dim` | `#a9a6b8` | 6.43 | 4.5 | passes |
| `--faint` | `#7d7a90` | 3.83 | 4.5 | **fails** |

**`--faint` is unresolved and must not be used for anything that has to be read at 4.5.** It clears the large-text bar of 3:1, so column headers and micro-labels may keep it; body-sized prose may not. Lifting it far enough to pass makes it nearly as bright as `--dim`, compressing the three-step hierarchy to two — so this is a decision deferred, not a bug to fix quietly.

**Contrast was a range and is now a number.** On the original ground `--dim` measured 4.37 over the purple and 6.28 over the teal — the same token, the same screen, two answers. Dark glass collapsed that range to 6.28 everywhere, which also means a token can be tested once rather than per position.

### 2.5 Meaning colours

`--gold #e8c368` governs · `--ok #7cc0a0` matched this path · `--carry #8b9ce6` carried from a prior session · `--crit #e08b8b` spilled.

**Every one is retuned from the paper values and every one is re-measured.** The first panel's contrast work — including its repaired `#7d620f` — was measured against a ground that no longer exists.

### 2.6 Motion tokens

```
--ease        cubic-bezier(.23, 1, .32, 1)
--dur-nav     180ms   navigation
--dur-act     200ms   the act
--dur-link    280ms   its consequence
--dur-retime  420ms   data travelling to a new value
```

**There is deliberately no ambient duration token.** Ambient motion is forbidden, and a token that does not exist cannot be reached for by accident.

---

## 3. The primitives

Eight. Every screen is built from these and nothing else.

1. **The pane** — one material, one radius, one shadow. Panels, cards and the rail are all this. Nothing in the product is a plain box.
2. **The actionable row** — the only primitive that moves. Hover lifts 3px; selection holds it up.
3. **The literal field** — a darker field *inside* the pane, for the machine's own voice. Selecting a row lights its block here.
4. **The static card** — same material, no motion, because clicking does nothing. **Stillness is how the interface says "not a control".**
5. **The plane** — static tilt. Perspective on the container; **nothing pushed behind it** (see §7.1).
6. **The chip** — the only place colour is spent. Four meanings, four hues, **and shape carries them too** — circle, square, diamond — so colour is never load-bearing alone.
7. **The rail** — a pane like any other. The current screen carries a gold inset edge, the one place gold appears outside a chip.
8. **The header** — **git where the avatar would have gone.** Branch, working tree, and the commit the corpus was reconciled against. No account, no bell, no plan badge.

---

## 3A. Typography

```css
--sans: "Geist", "IBM Plex Sans Hebrew", system-ui, sans-serif;
--mono: "Geist Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
```

**One declaration, not a switch.** The browser picks per glyph, so no code ever asks which language it is in. That is the requirement, not a convenience: in this product a Hebrew sentence routinely contains an English id, and a per-language font switch would have to be applied *inside* a string.

**Why two families rather than one.** Neither Geist nor Inter has a Hebrew cut, and this product ships English and Hebrew at parity on every screen. A pairing whose Hebrew is a system fallback makes the second language visibly second-class — different weight, different x-height, a line that does not share the rhythm of the one above it. IBM Plex Sans Hebrew is a real cut by a designer who also drew the Latin companion.

**Verified before adopting, because mixing families is only safe if the metrics agree:**

| Probe | Geist stack | Plex stack |
|---|---|---|
| `תצוגת הזרקה` at 13px | 73.1 × 17 | 72.9 × 17 |
| `4,260` at 13px | 35.0 × 17 | 34.8 × 17 |

**0.2px apart on both.** The seam that would have hurt is digits: they are Latin, so in the mixed stack they come from Geist while the Hebrew words around them come from Plex — and this product is full of numbers.

**The mono face needs no Hebrew cut, deliberately.** Ids, paths and the literal panel are machine strings that never mirror; the design already forces them LTR with `unicode-bidi: isolate`. That removes the hardest requirement from the hardest category of face to find.

**Weights.** Geist's heading weight is **450** — its signature, heavier than body without being bold. Body 400, emphasis 500, the prefix's `--ink` run 600.

**Loading.** Self-hosted `.woff2` under `src/ui/public/fonts/`, served same-origin. This is only possible because `font-src 'self' data:` was added to the CSP (§7.4); before that no font could load at all, same-origin or otherwise. Both families are OFL, so vendoring them into a plugin that ships inside other people's repositories is permitted.

---

## 4. Graphics — the plate

**Text may float on glass. Data may not.**

Every data view sits on an opaque plate inside its pane:

```css
background: rgb(6 7 11 / .72);
border-radius: 9px;
```

This is not tidiness. Colour here carries meaning, and if the ground shows through the marks then **the same tier reads as two different colours on two halves of one screen** — and a quantity whose colour cannot be trusted is not a quantity. The plate also lets a ribbon be measured against its own ticks, stops SVG node fills being translucent, and means each chart is tested once rather than per position.

**Accepted cost:** a plate is a second surface inside a pane, so a data-heavy screen is glass, plate, marks. On coverage the plate will be most of the visible area, which pushes the glass toward being a frame rather than the substance. The owner accepted this.

---

## 5. Transitions

**Navigation — the rail never moves.** It is the shared element; only the content region changes, and it **crossfades** at `--dur-nav`. Nothing travels horizontally, so there is no direction to mirror and **Hebrew costs nothing**. This also sidesteps the finding that transform-based animation libraries have no RTL awareness: `translateX` is not a logical property and `dir="rtl"` never mirrors it. A crossfade has no axis to get wrong.

**Retiming — the segments travel, and that is the point.** Change the event and the ribbon does not redraw; it moves to its new widths over `--dur-retime`. **The movement is the information** — you see *which* tier gained and which collapsed, which a redraw hides.

Retiming is a deliberate exception to the motion rule. `--dur-act` and `--dur-link` signal *affordance*; this one carries *data*. It is an exception because the motion is the content rather than a hint about it.

All motion sits inside `@media (prefers-reduced-motion: no-preference)`, so the true default is static.

---

## 6. Icons

**No category glyphs.** The id already says the kind — `CONST`, `RULE`, `INV`, `DEC` — in monospace, on every row, in both languages. A glyph beside it repeats what the reader has already been told, needs twenty-four drawings, and has a hole by construction for every custom category a user invents.

**Kept:** the tier mark (circle, square, diamond), because it encodes something no text on the row carries and shape survives `forced-colors` and print. And a six-glyph action set — refresh, copy, open, confirm, search, add — inline SVG, one stroke family.

**Inline SVG, not an icon font.** `font-src 'self' data:` landed in `563ff2e`, so a font-based set is now technically loadable — and is still the wrong choice: inline SVG tree-shakes per icon, inherits `currentColor`, and behaves predictably under `forced-colors`.

### 6.2 The library — Tabler outline

**Chosen for packaging and licence, not legibility**, because legibility turned out not to discriminate.

The first pass chose Heroicons on the reasonable theory that a native small grid beats one scaled down from 24px. Re-rendering all eight candidates at `deviceScaleFactor: 6` in real Chromium disproved it: **every actively-maintained set is legible at 14–16px**, and the gap the grid arithmetic predicted does not appear. That moved the decision off *which can you read* and onto vendoring risk.

**Tabler** ships real plain `.svg` files per icon, real `currentColor`, a single MIT licence, and one stroke family — a literal match for what §6 already required.

**Radix is the tightest mathematical fit at 15×15 native, and loses anyway.** Its npm release ships **zero plain SVG files**, and the extraction script written to pull icons out of its compiled bundle **spliced a neighbouring icon's path into two of the six glyphs** — invisible at normal size, obviously wrong at magnification. That is not a hypothetical vendoring risk; it happened during this evaluation.

**This choice has a stated expiry.** Radix's GitHub `main` already scaffolds a real `./icons/*.svg` export for an unreleased v2. If that ships, Radix should win on principle, since the rendering showed no visible difference either way.

**RTL.** Of the six glyphs only **open** mirrors. None of the eight libraries ships pre-mirrored variants, so mirroring is ours to apply.

### 6.1 The prefix

The kind keeps full `--ink`; the remainder of the id drops to `--dim`. Emphasis by taking away, using only tokens that already exist.

**The id stays one text run.** Verified by execution: selecting across the inline span in all five candidate treatments yielded `CONST-postgres-pool-capped-at-20` intact, hyphen included. What a padded chip costs is not copyability but *legibility as one name*.

---

## 7. Consequences

### 7.1 3D and clickability fight each other, silently

A `translateZ(-14px)` on two tilted panels pushed them behind their parent's plane in the 3D context, and **the parent intercepted every click**. `elementFromPoint` at a row's own centre returned the container. The handler was never wrong; nothing could reach it.

**Rule: perspective goes on the container, and nothing is pushed behind it. Anything tilted must be hit-tested, not just looked at.**

### 7.2 Light mode comes out, as one change

The `light-dark()` pairs across the token block, the light halves of the e2e specs, and the theme toggle. A half-removed theme is worse than either, so this is a task, not a cleanup.

### 7.3 Print becomes a design problem

The spec requires a real print stylesheet, and printing from dark measured **246 contrast failures against 17 from light**. With no light theme to fall back on, print needs its own register rather than the screen's colours on paper.

### 7.4 The CSP, one line, already landed

`font-src 'self' data:` shipped in `563ff2e`, with the pinned header assertion in `server-e2e` updated in the same commit so the two cannot disagree. Nothing else changed. A font cannot execute, so this re-opens exactly one category and closes no part of the defence that matters. **The rest of the CSP earns its place**: the page renders item titles and bodies authored by agents and by ingest, which is the whole reason `default-src 'none'` is there.

### 7.5 What is untouched

The 396 string keys, EN/HE parity, `strings-parity.test.ts`, the structure of all 21 screens, and every logical CSS property. None of them care about colour.

---

## 8. Open, and deliberately not decided here

- **`--faint` at 3.83.** Either the hierarchy loses a step, or faint is reserved for large text and non-essential labels where 3:1 is the bar. §2.4.
- **Print's register.** §7.3.
- **`forced-colors` — measured, and it is worse than the open question assumed.** SVG `fill`/`stroke` are still not force-adjusted, so the graph is fixable in CSS and canvas is not. But the icon evaluation measured the glass itself under High Contrast and **the material does not survive** — `backdrop-filter`, the tint gradients and the layered shadow are all stripped or overridden. A dark-only, glass-based direction therefore needs a *declared* High Contrast register, in the same way §7.3 says print does. This is now the second place the direction owes a second visual answer.
- **The pinned e2e counts.** Three of them assert element counts that a repaint may move.
- **Whether long-session comfort survives.** The owner ruled impress-first for the first iteration and reserved the right to revisit.
