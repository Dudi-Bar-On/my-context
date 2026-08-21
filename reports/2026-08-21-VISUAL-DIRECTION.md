# Visual direction — the mycontext web-UI mockup

**Commissioned 2026-08-21. Panel: review-t1. Output is a ranked decision document, not an edit.**

**Rule this from `reports/2026-08-21-VISUAL-DIRECTION.html`.** That page renders every colour, every
type size and every depth treatment described here, in both themes and in Hebrew, with the before
and the after side by side. This file is the reasoning and the provenance record behind it. Open the
HTML; read this when you want to know how a number was obtained or why an option is ranked where it
is.

Provenance is marked on every claim:

- `[M]` **measured today**, 2026-08-21, in a browser, against this worktree's mockup.
- `[V]` **verified** by reading the file today.
- `[R]` **reasoned** — an argument, not a measurement.

Nothing is marked `[M]` that was not re-measured today. The reason this panel exists is that a
prior panel's measurements may have gone stale, and several of them had.

---

## 0. Method, and what would have made it wrong

`[M]` The mockup was served over HTTP from a throwaway `node:http` server on `127.0.0.1` (the
Playwright MCP plugin blocks `file:`, and — see D8 — serving it turned out to be load-bearing for
one finding). It was driven with Playwright 1.62 / Chromium at 1280×900, `deviceScaleFactor 1`,
timezone UTC.

**All 21 screens, in English and Hebrew, in light and dark — 84 states.** Every state screenshotted.
Plus separate passes for `@media print` (both themes, both languages, all 21 screens),
`forced-colors: active`, `prefers-reduced-transparency: reduce` (via CDP
`Emulation.setEmulatedMedia`, which Playwright's context options do not expose) and
`prefers-contrast: more`.

**How contrast was obtained.** For every element that owns visible text: the foreground is
`getComputedStyle(el).color`, the background is the whole ancestor chain composited — every
`background-color`, in order, with alpha — **plus the `.gloss` sheen gradient evaluated at that
element's own vertical position inside its card**, since the sheen's alpha is a function of how far
down the card you are. The foreground is then composited over the resulting background. Thresholds
are WCAG 2.x: 4.5:1, or 3:1 for text ≥24px or ≥18.66px at weight ≥700.

**Colour resolution.** Token values are read through a live probe element, so `light-dark()` and
`color-mix(in oklch, …)` resolve the way the browser paints them. This is not a detail. The first
run of this harness normalised colour strings through a `<canvas>` directly, and a canvas cannot
parse `light-dark()`; an invalid `fillStyle` assignment silently leaves the previous value in place,
so the harness produced a **token matrix of 1.00 ratios and 645 contrast "failures", every one of
them an artefact**. The second run resolves through the cascade and validates every canvas parse by
probing from two different seed colours and requiring the same answer. It reports **26 distinct
failures**, and the option tables in the HTML page were independently reproduced twice — once by a
standalone solver and once by re-measuring the finished page — and agree to the second decimal.

`[R]` I am recording that mistake because this project's characteristic defect is asserting a
property the code does not have, and a measurement harness is exactly as capable of it as a
product is. Had I not cross-checked, this document would have opened with five fabricated failures.

**Depth and mark colours** were additionally sampled from **real rendered pixels**, by screenshotting
a 1×1 clip and decoding the PNG (`zlib.inflateSync` plus scanline un-filtering). Where a number below
says "sampled", it came from the framebuffer, not from the CSSOM.

`[M]` Across all 84 states: **zero console errors, zero uncaught exceptions, zero dialogs.**

---

## 1. What the rebuild already fixed

This is first because it changes what is worth arguing about. Four of the prior panel's headline
findings do not reproduce.

| Prior finding (19 Aug) | Today | Evidence |
|---|---|---|
| `--faint` fails 4.5:1 in **both** themes — 3.14 / 3.07 on panel, 2.91 / 3.29 on paper | **Fixed** | `[M]` 5.57–7.50 across `--panel`, `--paper` and `--sink`, both themes. Not one `--faint` failure in 84 states. |
| Printing any screen but Coverage yields a blank page | **Fixed** | `[M]` 21/21 screens print with text, both languages, both themes. `[V]` `[data-p].printing` in the print block. |
| `prefers-reduced-transparency` and `forced-colors` not honoured | **Landed for `.gloss`** | `[M]` under both queries the gradient goes to `none`, the shadow to `none`, the border to `--ink` / `CanvasText`. `prefers-contrast: more` too. |
| Physical CSS properties / RTL leakage | **Clean** | `[V]` zero matches for `margin-left\|padding-right\|text-align:\s*(left\|right)\|float:\s*(left\|right)` and for bare `left:`/`right:`/`top:`/`bottom:`. |
| Pinned counts drift | **Hold** | `[M]` 406 `[data-t]`, 225 `.m`, 12 `data-t-aria` in the live DOM; `[M]` 396 keys in `en.js`, 396 in `he.js`. |
| `--gold` vs `--ok` at 1.04:1 | **Mitigated, not fixed** | `[M]` now 1.30:1 light, 1.43:1 dark — still under 3:1. But `[V]` `.dot.g` is a circle, `.dot.o` a square, `.dot.w` a dashed outline, `.dot.n` a half-opacity circle, and `[V]` every chip prints a glyph through `::before{content:attr(data-g)}`. **Shape now carries the meaning and colour is redundant.** That is the right answer and nothing below should undo it. |

`[M]` The four semantic accents remain mutually indistinguishable by luminance — `--ok` vs `--warn`
is 1.05:1 light and 1.03:1 dark, `--warn` vs `--dim` 1.01:1 light — and the four chip *backgrounds*
sit between 1.01:1 and 1.06:1 of each other. `[R]` This is not a defect while shape is redundant.
It becomes one the moment any new component signals with colour alone, which is why the rule belongs
in writing before forty screens are built.

---

## 2. Bucket one — defects. Not weighed against preferences.

Ranked by severity. Each is shown, rendered, in §1 of the HTML page.

### D1 — critical. Printing while the dark theme is on produces an unreadable page.

`[M]` Under `@media print` with `data-theme="dark"`, the 21 screens produce **246** text-contrast
failures. The identical pass in light produces **17**.

`[V]` The print block forces `body{background:#fff;color:#000}` and never resets `color-scheme`, so
every `light-dark()` token keeps its **dark** value while the paper turns white. `[M]` The tokens
during a dark print resolve to `--ink rgb(236,235,228)`, `--dim rgb(146,143,135)`,
`--faint rgb(165,162,154)`, `--gold rgb(219,176,71)`, `--sink rgb(16,16,20)`.

Worst measured, from the dark print pass:

| Element | Ratio | Needs |
|---|---|---|
| `details.help .helpbox b` — `--ink` (dark) on a printed light box | **1.21:1** | 4.5 |
| `.cmd code` — forced black text on a `--sink` that is still `#101014` | **1.11:1** | 4.5 |
| `details.help summary` — `--gold` (dark) on paper | **1.74:1** | 4.5 |
| `.card>h3` — `--faint` (dark) on paper | **2.55:1** | 4.5 |
| `.psub` — `--dim` (dark) on paper | **3.23:1** | 4.5 |

**The fix, measured.** Adding `@media print{ :root, :root[data-theme] { color-scheme: light } }`
takes the count **246 → 17**, which is exactly the light-mode baseline. `[M]` (Specificity matters:
`:root[data-theme="dark"]{color-scheme:dark}` outranks a bare `:root`, so the print rule must match
the attribute or carry `!important`. My first attempt at this fix changed nothing for exactly that
reason, and I only knew because I measured it rather than asserting it.)

**Why nothing caught it.** `[V]` `e2e/print.spec.ts` *does* assert `bodyBg === rgb(255,255,255)` and
`bodyColor === rgb(0,0,0)` — and both still pass, because `body` is the one thing the print block
does reset. The tokens are not checked. `[V]` `e2e/playwright.config.ts` pins `colorScheme: 'light'`
for the whole suite, so no spec has ever printed from dark. `[R]` The fix is a second project in the
config, or a `test.use({ colorScheme: 'dark' })` block in the print spec, asserting a token rather
than the body.

`[R]` One honest caveat on severity. Chrome does not print background colours unless the user ticks
"Background graphics", so the two failures that depend on a dark `background-color` surviving
(`.cmd code` at 1.11, the black card slabs) only bite with that box ticked. The failures that are
**text colours** — 1.21, 1.74, 2.55, 3.23 — bite regardless. Either way the page is unusable.

### D2 — high. `--gold` on `--goldbg` is 4.20:1 in light. The one contrast failure that survived.

`[M]` The prior panel measured this pair at 4.31:1. With today's tokens and the `color-mix`
derivation it measures **4.20:1** — it got slightly worse. It appears on `.chip.gov` ("pinned",
"carried"), on the pressed state of every `.segbar` button and on `.icon[aria-pressed="true"]`,
across **preview, coverage, simulate, injected, watch, ask, doctor, config, proc and port** — 9 of
21 screens, both languages, and again on the printed page. `[M]` Dark passes at 7.82:1.

`[M]` Candidate repairs, all measured today with the mockup's own
`color-mix(in oklch, gold 12%, panel)` evaluated by the browser:

| light `--gold` | on `--goldbg` | on `--panel` | on `--paper` | on `--sink` |
|---|---|---|---|---|
| `#8a6d14` (today) | **4.20** | 4.91 | 4.54 | 4.15 |
| `#836710` | 4.55 | 5.36 | 4.96 | 4.54 |
| **`#7d620f` ← recommended** | **4.87** | 5.79 | 5.36 | 4.90 |
| `#775d0e` | 5.21 | 6.25 | 5.79 | 5.29 |

`[M]` Thinning the mix instead also works — 12% → 6% reaches 4.54 — but `--goldbg` is already only
**1.17:1** against `--panel`, so that buys contrast by making the chip's background disappear.
`[R]` Darkening the ink is the better trade, and it retires the focus ring's marginal
4.15-on-`--sink` at the same time.

### D3 — high. `.linkid`, the most repeated control in the product, has no CSS rule at all.

`[V]` `grep` for `.linkid` in the mockup's stylesheet returns nothing. The class is written on
markup (`docs/design/web-ui-mockup.html:707–711, 883–884, 1082`) and on a JS-built button
(`:2225`), and never styled. It therefore renders as a native `<button>`: UA `ButtonFace`, UA
border, UA padding.

`[M]` In dark that paints `rgb(107,107,107)` — a colour that exists in no token in the sheet —
giving its 10.875px label **4.46:1** against a required 4.5. `[M]` Its box measures **19px** tall.

`[R]` The deeper cause is a hole in the token set: **there is no colour that means "this is
clickable".** Gold means "this governs". That is why the product's most repeated control ended up
with no design, and why the focus ring had to borrow the meaning colour. §3 proposes filling it.

### D4 — high. Thirteen distinct controls sit below the 24×24 CSS-px target minimum.

`[M]` Measured across all 21 screens: every `.linkid` at **19px** tall (5 identifiers per screen on
preview, coverage, injected, doctor, watch), every `details > summary` at **17px** (7 screens), and
one inline documentation link at **32×16**. WCAG 2.5.8 (AA, WCAG 2.2) requires 24×24 unless the
target is inline within a sentence; a row-level identifier button in a table cell is not.

### D5 — high. Card titles paint file paths and identifiers in upper case.

`[V]` `.card>h3{ text-transform:uppercase; letter-spacing:.08em }` at `:216`, and card titles
contain `.m` runs holding real identifiers. `[M]` Computed style confirms `text-transform:uppercase`
on the elements carrying `src/billing/prices.js` (coverage), `RULE-never-log-customer-email` and
`REV-8c21` (work), `categories.lesson.scopePolicy` (config), `PROC-migrate-money-columns-to-integers`
(proc) and `src/billing/**` (capture). `[M]` Confirmed visually in the light/EN coverage screenshot:
the card reads **WHAT GOVERNS SRC/BILLING/PRICES.JS**.

`[R]` POSIX paths are case-sensitive, and this product's whole argument is that an identifier is
exact. A path shown in the wrong case is the same defect class as a command with a flag that does
not exist.

**The same rule bites Hebrew twice.** `[M]` The rail's group labels compute to
`text-transform:uppercase; letter-spacing:1px` and are applied to Hebrew — Hebrew has no case, so
the transform is a silent no-op and the entire micro-label hierarchy is left resting on 10px plus a
tracking value that only makes Hebrew harder to read. `[M]` The screen title carries
`letter-spacing:-0.192px` on Hebrew for the same reason. `[R]` `:lang(he){ text-transform:none;
letter-spacing:normal }`, with weight carrying the hierarchy instead.

### D6 — medium. `prefers-reduced-transparency` is honoured for the decoration and ignored for the data.

`[V]` The query names `.gloss, .gloss.float` and nothing else. `[V]` Seven `opacity` declarations
carry meaning and are untouched by it:

| Selector | opacity | What it encodes |
|---|---|---|
| `.dot.n` | `.5` | "not examined" — a fourth coverage state |
| `.notrun` | `.3` | "this tier never ran on this event" |
| `.rung.after` | `.42` | items below the admission threshold |
| `.mini i.u` | `.34` | ungoverned share of a directory |
| `svg.chart .edge.bearing` | `.55` | load-bearing vs incidental relation |
| `tr.regime .ln` | `.45` | a regime boundary in the audit stream |
| `.legend .ln.bearing` | `.55` | the legend for the above |

`[R]` The inversion is the finding: the one place translucency is purely decorative degrades
correctly; the seven places where translucency *is* the signal do not. The same query, seven more
selectors, each going to a solid colour or a pattern.

### D7 — medium. Under Windows High Contrast the tier ribbon and the relations graph lose their meaning.

`[M]` With `forced-colors: active`, `.gloss` degrades exactly as designed. But `.seg.pinned`,
`.seg.index` and `.dot` all resolve to `background rgb(255,255,255)` / `border rgb(0,0,0)` in light
and the inverse in dark — four tiers, one visual state. `[M]` And SVG is not adjusted at all: the
relations graph keeps `stroke: rgb(147,48,47)` (`--crit`, light) and node `fill: rgb(23,23,28)`
against a system `Canvas`, so in dark High Contrast the nodes sit at roughly **1.16:1** against the
ground.

`[M]` The chips survive, because their `::before` glyph is *content* and content is not forced. The
dots survive by shape. `[R]` The ribbon has no glyph and the graph has no adjustment; both are
fixable inside the existing `@media (forced-colors: active)` block — segments need a pattern
(a `repeating-linear-gradient` is a `background-image` and survives), the SVG needs
`stroke: CanvasText` / `fill: Canvas` written by name.

### D8 — medium. No `<meta charset>`. Served over HTTP, every Hebrew string becomes mojibake.

`[V]` The file declares no `<meta charset>` (`grep -c 'meta charset'` → 0) and carries no BOM
(first three bytes `3c 21 2d`). `[M]` Served as `Content-Type: text/html`, Chrome reports
`document.characterSet === "windows-1252"` and the Hebrew for "scope coverage" renders as
`×›×™×¡×•×™ ×"×™×§×£`. Served as `text/html; charset=utf-8` it renders correctly. `[M]` Loaded from
`file:`, Chrome sniffs UTF-8 and it renders correctly.

`[R]` That last measurement is why nothing has caught this: `e2e/mockup.ts` builds `MOCKUP_URL` with
`pathToFileURL`, so the entire e2e suite — including `language.spec.ts` and `bidi.spec.ts` — loads
the page over `file:` and is structurally unable to observe it. The shipped app serves this page
over HTTP.

### D9–D12 — lower, still measured.

- **D9** `[M]` `.chip.crit` in dark is **4.44:1** against 4.5 — a marginal fail, on watch and
  palette. `[M]` `--crit: #d27676` reaches 4.89 on `--critbg` and 5.61 on `--panel`.
- **D10** `[M]` The type scale is declared but not enforced — six declared steps, **fourteen**
  rendered sizes, `--fs-4` (22px) used by **nothing**, smallest rendered text **8px**. Full table in
  §4 and in the HTML page.
- **D11** `[M]` The `--mono` stack has no Hebrew face. `קובץ` renders at exactly **67.609px** under
  `--mono`, under `serif` and under `monospace` alike, while `file` differs sharply (93.75 / 53.31) —
  i.e. the Hebrew falls through to one shared fallback in every family, so the `font-variant-numeric:
  tabular-nums` that `.m` asks for is not delivered for it. `[R]` This mostly does not bite, because
  `.m` holds Latin identifiers by design; it bites where Hebrew reaches a `.m` run.
- **D12** `[M]` `grep -rn "57,000\|57000\|57 000\|57,195"` over the whole repository returns
  **one** hit: the mockup's own CSS comment at `:124`, *"That allowlist is the whole 57,000-node cost
  story."* `[M]` The Coverage screen measures **122** elements and a forced full-subtree layout of it
  takes **0.6 ms**. `[R]` A fabricated figure is now load-bearing inside the design of record, used
  to justify a rule that is correct for other reasons. The rule should keep its justification and
  lose its number.

**Measured and deliberately *not* called defects.** `[M]` `--rule` (1.33:1 light, 1.19:1 dark) and
`--edge` (1.65:1 / 1.59:1) sit below 3:1, but `[V]` `--edge` bounds only `.bar`, `.mini`, `.track`
and `.dot.n` — data graphics, not controls — and `--rule` is decorative by the sheet's own comment.
`[M]` `--edge-3`, which that comment nominates as the control border, measures 3.54:1 light and
3.57:1 dark on `--panel` and passes; its 2.99:1 against `--sink` is the *inside* of a control whose
outside is 3.54:1, which satisfies 1.4.11. `[V]` `prefers-reduced-motion` is absent and correctly so:
the sheet contains **zero** transitions, animations and keyframes — a fact that stops being
comfortable the moment depth gains a hover state.

**A stale claim, corrected.** `[R]` The prior panel recorded that gold, ok and warn land within
5/255 of each other on a monochrome printout. `[M]` With today's tokens the BT.601 luma values are
**gold 108, dim 99, warn 94, ok 85, crit 77** in light — a 31-level spread, not 5 — and
**gold 177, warn 150, dim 143, ok 142, crit 136** in dark, where `--ok` and `--dim` are **1 level
apart** and `--ok` and `--warn` are 8. So the claim is wrong as stated for light and understated for
dark. Either way, shape redundancy is what makes the printout legible, not the hues.

---

## 3. Bucket two — the owner's call. Palette, and can it go blue?

**Yes. The useful question is *which half*.** `[R]` The palette has two independent halves, and
treating them as one is what makes the question feel risky:

- **The neutral axis** — `--paper`, `--panel`, `--sink`, `--rule`, `--edge`, `--ink`, `--dim`,
  `--faint`. This is what people mean when they say a product "looks blue". It carries no meaning;
  it is temperature. Changing it is a swap of ten values in one file.
- **The accent** — `--gold`. This one carries meaning: *this governs, unconditionally*. Spending it
  on brand spends the only place the colour says something.

`[R]` And there is a third slot that does not exist and should: **a colour that means "this is
clickable"**. Its absence is measurable — it is D3 and D4, and it is why focus had to borrow gold.

All four options are rendered in the HTML page, in both themes and in Hebrew, as swatches *and* as a
working fragment of the injection preview.

### Option 1 — rank 1, recommended. Cool neutrals, gold kept for meaning, blue introduced as chrome.

**Cost:** 10 token values changed, 2 tokens added (`--link`, `--focus`), one file. Plus the
`.linkid` rule that D3 needs anyway.
**Meaning cost:** none — gold stays rare.
**Gains:** the "clickable" colour the product does not have; retires the gold focus ring.

Light: `--paper #f2f5fa`, `--panel #ffffff`, `--panel-2 #f8fafd`, `--sink #e6ebf3`, `--ink #141821`,
`--dim #5c6472`, `--faint #565e6c`, `--rule #dde3ec`, `--edge #c6cdd9`, `--edge-3 #818b9b`,
`--gold #7d620f`, `--link/--focus #0b57d0`.
Dark: `--paper #0c0f16`, `--panel #141822`, `--panel-2 #1a1f2b`, `--sink #0d1018`, `--ink #e7eaf0`,
`--dim #8d95a4`, `--faint #a0a8b6`, `--rule #232936`, `--edge #333a48`, `--edge-3 #6a7382`,
`--gold #dbb047`, `--crit #d27676`, `--link/--focus #8ab4f8`.

`[M]` Measured off the decision page itself — the HTML renders this palette as a working fragment of
the injection preview, and the harness then re-measured what it drew. The first five rows were
independently reproduced by a standalone solver and agree to the second decimal; the last row is
computed from the same sRGB formula, since the page shows `--edge-3` as a border rather than as text:

| pair | light | dark | needs |
|---|---|---|---|
| `--ink` on `--panel` | 17.76 | 14.72 | 4.5 |
| `--dim` on `--panel` | 5.96 | 5.89 | 4.5 |
| `--faint` on `--panel` | 6.54 | 7.41 | 4.5 |
| `--gold` on `--goldbg` | 4.87 | 7.24 | 4.5 |
| `--link` on `--panel` | 6.39 | 8.42 | 4.5 |
| `--crit` on `--critbg` | 6.39 | 4.85 | 4.5 |
| `--edge-3` on `--panel` | 3.44 | 3.71 | 3.0 |

`[R]` **Why rank 1.** It answers the question — the interface visibly goes blue — while spending the
blue on the one job no colour currently does, and leaving gold's rarity intact. `[M]` One caution:
blue against gold is **1.10:1** in light and **1.03:1** in dark, so a blue link and a gold "governs"
mark are near-identical in luminance. `[R]` They must be told apart by *role* — the link underlined,
the mark a chip with a glyph — never by hue. That is how the HTML page draws it.

### Option 2 — rank 2. Keep the warm paper exactly as it is; add blue chrome only.

**Cost:** 2 token repairs (D2, D9) + 2 tokens added. **Meaning cost:** none.
`[R]` The cheapest thing on the page that still fixes D2, D9, D3 and D4. If "could it go blue" turns
out to mean "could links stop being invisible", this is the whole of it. Ranked second only because
it does not change the temperature at all.

### Option 3 — rank 3. Cool neutrals, gold only, no blue chrome.

**Cost:** 10 token values. `[R]` Identical in temperature to Option 1 and strictly weaker: it takes
the whole visual change and none of the functional gain. It is in the document because it is the
honest "just make it blue" reading, and because seeing it beside Option 1 is the fastest way to
notice that what separates them is the underline and the focus ring, not the hue.

### Option 4 — rank 4, not recommended. Full blue: blue replaces gold as the meaning accent.

**Cost:** 10 token values plus every `--gold` use re-read. **Meaning cost:** high.

`[M]` With blue as the accent, "this governs" and "this is a link" are the same colour, so one of
them must give up colour entirely. `[M]` The four accents become blue / green / amber / red, whose
BT.601 luma values are **70 / 85 / 94 / 77** — the same monochrome collapse the current palette has,
moved rather than repaired. `[R]` Separately, this is the one direction the 19 August panel rejected
by name, on the grounds that a saturated brand blue reads as *consumer product* where this tool's
argument is that it is a *ledger*. That is an argument, not a measurement, and the owner may
overrule it — but should overrule it knowingly, and must then name the replacement mark for
"this governs" before anything is written into the mockup.

---

## 4. Bucket two — type scale and headers

`[M]` The token scale declares six steps: 10 / 11 / 12.5 / 14 / 16 / 22px. The rendered page uses
**fourteen** distinct sizes across 26 size×weight combinations. `--fs-4` (22px) is used by
**nothing**. The largest text on any screen is a 16.38px `<h3>` that no rule matches — the browser's
default — which makes a card sub-heading *larger* than the screen title beside it.

| rendered | source | elements |
|---|---|---|
| 16.38px / 700 | an `<h3>` matching no rule — UA default — **escapee** | 2 |
| 16px / 620 | `--fs-3` — `h2`, the screen title | 21 |
| 14px / 700 | `--fs-2` | 21 |
| 13px / 400 | `.nav{font-size:13px}` — hardcoded, off-scale — **escapee** | 420 |
| 12.5px / 400 | `--fs-1` — table body | 203 |
| 12.5px / 700 | an `<h4>` in a markdown block — **escapee** | 1 |
| 12.18 / 10.875 / 9.57px | `.m{font-size:.87em}` of three different parents | 273 |
| 11px / 400,600,620,650,700 | `--fs-0` | 875 |
| 10px / 400,700 | `--fs-00` | 267 |
| 9.5px | SVG axis labels — hardcoded — **escapee** | 86 |
| 9px | `.prop` badge and graph node labels — hardcoded — **escapee** | 79 |
| 8.7px | `.m` inside a 10px chip | 21 |
| 8px | relation labels in the graph — hardcoded — **escapee** | 5 |
| 22px | `--fs-4` — **declared, used by nothing** | 0 |

`[M]` There is no `<h1>` on any screen. `[M]` Every size is `px`; nothing is `rem`, so a user who
raises their default font size gets nothing.

### Type option 1 — rank 1, recommended. Enforce the scale; do not restyle it.

**Cost:** ~15 CSS lines. No markup, no strings, no change to the three pinned e2e counts.
**Visible change:** two headings and the graph labels; nothing else moves.

- Every size in `rem` against a 16px root, floor `0.625rem` (10px). The 8px and 9px SVG labels rise
  to the floor.
- `.nav`'s hardcoded 13px becomes `--fs-1`; the unstyled `<h3>` and `<h4>` get rules.
- `h3 .m, th .m { text-transform:none; letter-spacing:normal }` — D5.
- `:lang(he){ text-transform:none; letter-spacing:normal }`, with weight carrying the hierarchy.
- `--fs-4` gets a use or gets deleted. It should get a use — see option 2.

### Type option 2 — rank 2. Enforce, and give the headers a real step.

**Cost:** option 1 plus two rules. **Density cost:** ~10px per card, on every screen.
Screen title 16 → 22px (`--fs-4`, finally used); card title 11px uppercase `--faint` → 13px
sentence-case `--dim` at weight 650. `[R]` This is the option that most changes how *finished* the
product looks and most costs the density a ledger wants. Ranked second because it is a taste change
wearing a system change's clothes: option 1 is a correction, this is a decision.

### Type option 3 — rank 3. Enforce, and open the body text.

**Cost:** option 1 plus one token value; table body 12.5 → 13.5px. **Density cost:** ~8% of rows per
screen. `[R]` Easier to read, and people sit in front of this for a long time. Ranked last because
the screens that matter most — coverage, the audit stream, the injection preview — are exactly the
ones that lose rows.

---

## 5. Bucket two — depth, and how far the floating cards should go

`[M]` The depth system already exists and is implemented the right way: an **opaque**
`background-color`, one static painted gradient, two zero-blur inset shadows, no `backdrop-filter`,
`.gloss` on 43 elements, `.gloss.float` for a raised tier, and correct degradation under
`prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` and print. Because the
surface is opaque, every contrast ratio on it is a fixed number — which is why the 84-state audit
could measure it at all.

**And in light mode half of it is a no-op.** `[M]` Sampled from real rendered pixels: the top edge
of a light card measures `rgb(255,255,255)` and its interior `rgb(255,255,254)` — a ratio of
**1.00:1**. The white rim highlight has nothing to be lighter *than*, because `--panel` is already
`#fffffe`. Only the bottom shade registers, at **1.13:1**. `[M]` In dark the same sample gives
**1.25:1** at the top and **1.06:1** at the bottom — there, the rim is doing real work.

`[R]` This is the single measured reason dark mode looks materially better built than light.

### Depth option 1 — rank 1, recommended. Give light mode something for the highlight to sit on.

**Cost:** one token value. Light `--panel` `#fffffe` → `#fdfcfa`.

`[M]` Measured today:

| light `--panel` | rim step | `--ink` | `--dim` | `--faint` |
|---|---|---|---|---|
| `#fffffe` (today) | **1.00** | 17.86 | 6.00 | 6.58 |
| **`#fdfcfa` ← recommended** | 1.03 | 17.43 | 5.86 | 6.42 |
| `#fbfaf6` | 1.04 | 17.11 | 5.75 | 6.30 |
| `#f9f8f3` | 1.06 | 16.81 | 5.65 | 6.19 |

`[R]` Every candidate keeps every ink token far above 4.5:1. This is the cheapest change in the
document and the one that most changes whether light mode reads as a wireframe or as an object.

### Depth option 2 — rank 2. Add the floating tier — on an allowlist, meaning one thing.

**Cost:** an allowlist and a scan rule, not new CSS. `.gloss.float` already exists.

`[R]` The rule to write down: **elevation encodes dismissibility and nothing else.** A surface
floats if and only if it can be dismissed — popovers, the exit banner, the composer overlay, the
detail pane. A card that cannot be dismissed does not float, however important it is. Nothing gains
gloss for being important; a verdict rendered as floating reads as provisional.

`[V]` The existing `.gloss` allowlist ("card-scale surfaces only, never a row/cell/chip/dot") is the
right shape and should keep its rule while losing its fabricated 57,000 (D12). `[M]` The real cost
today is 43 glossed elements page-wide, 3 on the Coverage screen, and a 0.6 ms forced layout of that
screen's entire subtree — the rule is cheap because it is a rule about selectors, not a hope about
the compositor.

### Depth option 3 — rank 3, not recommended. Hover lift, deeper shadow, stronger sheen.

`[V]` The sheet contains zero transitions and zero animations today, which is why
`prefers-reduced-motion` is legitimately absent. A hover lift is motion, and the query becomes
mandatory — a fifth degradation site alongside print, `forced-colors`, reduced-transparency and
`prefers-contrast`. `[R]` The dark sheen also has a stated ceiling (`--sheen-top` alpha 0.075, with
0.055 shipping), so "stronger" in dark has roughly 36% of headroom before `--dim` on a lifted panel
crosses 4.5:1. Shown in the HTML page at that ceiling so the owner can see what the whole remaining
budget actually buys: very little.

---

## 6. Is this the most attractive design available?

`[R]` Honestly: it is unusually coherent for a hand-written sheet, and the gap between how it looks
and how a finished product looks is **not the palette**. Three measured things account for most of
it, and all three are already itemised above:

1. **An unstyled control repeated five times per screen** (D3). Native browser buttons in a data
   table are the loudest "this is a mockup" signal on any screen.
2. **Light mode has no depth at all** (§5) — the rim highlight measures 1.00:1.
3. **Fourteen font sizes where six are declared** (§4), including one heading larger than the screen
   title it sits under.

`[R]` None of those is a restyle. A palette swap changes the photograph; these three change whether
it reads as *drawn* or as *built*. If the owner wants one sentence: fix those three and the current
palette will look better than a new palette would on top of them.

---

## 7. What must land before the forty UI tasks, and what can wait

`[R]` The dividing line is whether a change lives in the token file or in the screens. A token
change costs one file today and forty files after ui2 and ui3 ship.

**Before.**

| Item | Why it cannot wait |
|---|---|
| The palette ruling (§3) | Every screen built against the wrong token set is rebuilt. |
| D2 `--gold` → `#7d620f`; D9 `--crit` dark → `#d27676` | Token values. One line each now; a re-audit of 21 screens later. |
| The type ruling (§4) and the `rem` conversion | Forty screens will be written against whichever scale exists when they are written. |
| D5 identifiers stop being upper-cased | It is a rule on `h3`/`th`; every screen written before it inherits it. |
| D3 / D4 style `.linkid`, 24px targets | The product's most repeated control has no design. Forty screens will copy whatever it is. |
| The depth ruling (§5) | Light `--panel` is a token; the `.gloss` allowlist is a scan rule that must exist before there is anything to scan. |
| D1 the print `color-scheme` line, plus a dark print spec | One line, and it stops a whole class of screen from shipping broken. |
| D8 `<meta charset="utf-8">` | One tag. Hebrew is unreadable without it the moment the page is served rather than opened. |

**Can wait.**

| Item | Why |
|---|---|
| D6 the seven `opacity` selectors | Per-component, and the components are being written anyway. |
| D7 forced-colors for the ribbon and the SVG | Lives inside the components that draw them. |
| D11 a Hebrew-capable mono fallback | Affects rendering, not structure, and needs a font decision the zero-dependency constraint may refuse. |
| D12 the fabricated 57,000 in the comment | A comment. Correct it the next time that block is touched. |

`[R]` None of the recommendations above adds visible text, so none of them touches `strings/en.js`,
`strings/he.js` or the 396-key parity. None changes the element count, so the three pinned e2e
counts (406 / 225 / 12) are unaffected. The single exception is D3: styling `.linkid` as a link is
CSS only, but raising its target to 24px may change layout height and is worth a visual check.
All depth and colour work inherits the zero-physical-properties rule, and the two things this
document proposes to add — an underline on a link and a lighter light `--panel` — have no
directional component at all.

---

## 8. The one question

> **Does `--gold` keep its monopoly on meaning — so that blue enters only as chrome, for links and
> focus, and never marks a tier — or is gold available to be spent as the brand colour, in which
> case the product needs a different mark for "this governs" before anything is written into the
> mockup?**

Every ranked palette option turns on this and only this. Options 1, 2 and 3 assume the first answer.
Option 4 assumes the second and owes a replacement mark. The type and depth rulings are independent
of it and can be given separately.

---

*Measured 2026-08-21 against `docs/design/web-ui-mockup.html` on branch `v2/review-t1`. Harness:
Playwright 1.62 / Chromium over a `node:http` server on `127.0.0.1`; 21 screens × 2 languages ×
2 themes, plus print, `forced-colors`, `prefers-reduced-transparency` and `prefers-contrast: more`
passes. This panel was read-only over the product: nothing in the mockup, the string tables or the
plans was edited to produce it.*
