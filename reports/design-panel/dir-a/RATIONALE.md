# dir-a — the restrained instrument

**Prototype:** `reports/design-panel/dir-a/prototype.html` — self-contained, no external
requests, zero dependencies (no build step, no library, no font host). Built and QA'd against
Chrome (chrome-devtools MCP) at 1280×900: both themes, both languages, keyboard focus, hover
linkage, and a contrast pass. Console is clean in every state tested.

---

## 1. The visual idea

**A graduated instrument scale, applied three times, never decoratively.**

This product's whole argument is that governance is *measured*, not vibed: a budget in tokens,
a coverage percentage, a cost per item, a gate that binds at a specific position in an ordered
list. The signature is a literal ruler — tick marks and running totals — planted at the three
places where the product already does real measurement:

1. **The budget ribbon** gets a ruled scale under its fill track, graduated to *that tier's own
   budget* (a 6,000-token track and an 8,000-token track are visibly different instruments, not
   the same bar stretched).
2. **The literal panel's gutter** (see below) is a running token total, not a decorative line
   number — it answers "how far into the budget is this text" at every line.
3. **The audit pulse** gets a tick-marked minute axis under its columns.

One idea, three surfaces, each doing the measuring it claims to do. Per the frontend-design
brief's own warning against spending boldness everywhere: this is the one place this file takes
a risk, and everything around it — chips, tables, chrome — stays quiet.

**Everything else is the base mockup's own token layer, applied, not reinvented.** Warm paper,
near-black ink, gold-means-governs, mono-for-literal/sans-for-UI. An existing, coherent system
was already sitting in `docs/design/web-ui-mockup.html`; the job was to fill its two real holes
(no motion, no "clickable" affordance) and prove the ceiling, not replace what already works.
Per the panel's own warning: a ledger wants gridlines and density, not a SaaS dashboard's
whitespace-and-cards proportions — this direction never imports a stat tile, a donut, an avatar,
or a card grid.

### The second screen — what the first cannot show

Injection preview is static data arriving. **Audit stream** is a product with a pulse: a live
feed, a regime boundary drawn as a rule instead of a row, and the honest distinction between
"zero tokens" and "tokens never recorded" (a hatched void, not a zero-length bar — the base
product's own honesty convention, kept). It's the one place a tiny amount of real, continuous
motion is defensible — one bar, still growing, breathes at 2.2s — and it's the only animation in
the file that isn't tied to a person's input.

---

## 2. What was built

- **Injection preview**, rebuilt around Stripe's own teardown of its docs site (`BEST-IN-CLASS.md`
  §Stripe): left is the governed items with their rationale; right is a **dark, monospace,
  always-dark, scroll-synced panel** showing the literal text crossing into the window, gutter
  running-token-total, **bidirectional highlight** — hover a row, its region lights on the right;
  hover a span there, its row lights on the left. This is "the injection preview is the product"
  (synthesis rule 7) taken literally, not just praised.
- **Audit stream** — six record kinds, the regime-change rule, the token-void/token-bar
  distinction, a tick-ruled activity pulse, kind filters.
- **Both themes**, via the base's own `light-dark()` + `color-scheme` tokens (not reinvented).
- **Hebrew, working**: full RTL mirroring (rail, tables, chips, the gate ladder, the literal
  panel's gutter-then-text column order), sourced from the base mockup's own verified `HE`
  strings where the same concepts appear (gate names, tier vocabulary, the exact "why not"
  prose for `STD-api-errors-use-problem-json`/`ADR-markdown-plus-disposable-index`/
  `DEC-sessionstart-injection-verified`), so this isn't placeholder Hebrew — it's the product's
  own voice, reused, plus a small amount of new copy for the two screens' own chrome.
- **Motion, actually running**: see §3.
- **The real numbers**: `TIER_BUDGET`, `CANDIDATES`, and the exact first-fit selector
  (`fitFirstFit`) are the base mockup's own fabricated-but-consistent dataset, not new props —
  the ribbon, the gate ladder and the literal panel all derive from the same arithmetic, so they
  cannot disagree with each other, same as the base's own design intent.

### Two defects fixed, from the panel's own measurement doc

The brief said don't re-measure `reports/2026-08-21-VISUAL-DIRECTION.md` — so I applied its
findings instead of re-deriving them:

- **D2** (`--gold` on `--goldbg`, 4.20:1, fails 4.5): shipped the doc's own recommended
  `#7d620f`. Verified today at **4.87:1** on `--goldbg` (canvas-pixel-sampled, not CSSOM-read —
  see §5 on why that distinction mattered).
- **D3/D4** (`.linkid` has no CSS rule at all; 13 controls under the 24px target floor): gave
  `.linkid` a real rule — mono for "this is an identifier", a dotted underline that goes solid on
  hover for "this is clickable" (deliberately *not* a new hue — see §3), and `min-block-size:24px`.
  Measured today at **24.4px** tall, **17.9:1** text contrast at rest.
- **D5** (Hebrew inherits an uppercase transform that silently no-ops and leaves 10px text on a
  Latin tracking value): `:lang(he){text-transform:none;letter-spacing:normal}` up front, before
  it was needed, rather than patched after the fact.

---

## 3. Motion — the actual answer to "why doesn't it wow"

The measured fact from `reports/2026-08-21-VISUAL-DIRECTION.md` is that the shipped product has
**zero transitions, animations and keyframes.** The instinct is to add motion everywhere. The
research says otherwise — Vercel's own words, "default to stillness," and Raycast's launcher,
used 100+ times a day, has **no** open/close animation at all. So this file adds motion in
exactly three places and nowhere else:

1. **Zero in, eased out** (Linear's `--speed-highlightFadeIn: 0s`, the single most instructive
   number in the research). Selecting a row, hovering a `.linkid`, linking to the literal panel —
   all appear **instantly** (`transition-duration:0s` on `.hot`) and only *fade back* over 150ms.
   Feedback to input is never delayed; only decay is smoothed.
2. **A registered `@property` re-fit**, once, on a deliberate action. Switching the event
   selector (session-start/tool/compact/manual) re-flows the ribbon segments over 200ms instead
   of snapping. `--w` is registered `@property` with `syntax:'<percentage>'` — the research's own
   named trap is that an *unregistered* custom property has universal syntax and cannot
   interpolate, producing a hard jump at the midpoint that reads as a bug. Registered correctly,
   it tweens. It does **not** run on first paint (a `.tuned` class is added one frame *after* the
   initial render) — a page load is not a deliberate action, and rule 8 in the research
   (`BEST-IN-CLASS.md`) is explicit that a staggered entrance is exactly the kind of decoration
   this product's register cannot carry.
3. **The one still-growing pulse bar breathes**, 2.2s, because it is the one thing in either
   screen that is *actually still happening* without a person touching anything.

**Everything else is instant.** No page transitions, no count-ups, no skeleton, no stagger — the
frequency law from the research (`BEST-IN-CLASS-TOKENS.md` §8) says an action performed 100+
times a day gets none, and reading rows in a ledger is exactly that action.

`prefers-reduced-motion` is honoured structurally, not defensively: every `transition`/
`animation` declaration in the file sits **inside** `@media (prefers-reduced-motion:
no-preference)` — the true, unconditional default is the static/instant state, and motion is
strictly an addition layered on top. (This is the same discipline the research recommends for
scroll-driven animation — never define the hidden/animated state as the unconditional base — 
generalised to every transition in the file, not just one API.)

**The clickable-role decision.** D3 names a real hole: no colour in the system means
"clickable" — gold means *governs*. The obvious fix is a sixth hue. I didn't take it. Both
Vercel's published rule ("colour only when it adds significant meaning to state, action, or
data") and this product's own chip system agree colour means *state*; a colour for
*affordance* would compete with gold for attention on every screen. `.linkid` carries
clickability through **form** instead — weight, a dotted-to-solid underline, a real target size —
which is also the cheaper fix: zero new tokens, one class rule.

---

## 4. Two CSS features from the research, applied narrowly

**CSS anchor positioning**, on the `.linkid` hover/focus peek. `anchor-name` is set via
`element.style.setProperty()` on whichever row is currently hovered (never `setAttribute`,
which the shipped `style-src 'self'` blocks silently — confirmed in `PRIOR-RESEARCH.md`, and the
reason every data-driven size in this file goes through the CSSOM). The popover binds with
`position-area: block-end span-inline-end` — **logical** keywords, so it mirrors under Hebrew
for free; verified today (`CSS.supports('position-anchor','--x')` returns `true` in this Chrome).
The fallback path (for anything that doesn't support it) computes a **physical** `top`/`left`
from `getBoundingClientRect()` — deliberately not logical, because that's what the JS math
actually produced, and it doesn't attempt to mirror. That gap between the two paths is real, and
it's the honest shape of the answer in §6.

**Bidi isolation**, applied and then *caught failing* in testing. The literal panel's token count
(`4,260 / 6,000`) is two number runs joined by a bare `/` with no strong-direction anchor between
them — exactly the pattern `PRIOR-RESEARCH.md` warns about for IDs and timestamps in RTL prose.
First render mirrored it (`6,000 / 4,260`) because the span wasn't isolated. Caught by screenshot
diff against the English render, fixed with `direction:ltr;unicode-bidi:isolate` on the one span
that needed it. Recorded here because this project's own stated failure mode is asserting a
property the code doesn't have, and I nearly did exactly that.

---

## 5. Tools consulted, and what each one changed

Per `RULE-ui-work-consults-every-installed-design-frontend-and-browser`:

- **`frontend-design`** — the one that mattered most. Its calibration list of AI-default looks
  (warm cream + serif + terracotta; near-black + one acid accent; broadsheet hairlines) made me
  scrutinise this direction's own warm-paper base for the same failure mode. It survives the
  check because the warmth is doing *product* work here (a ledger reads as paper/archive, per
  the research's own rule 2) and the accent is gold-as-governance, not a decorative pop — but the
  skill is what made me argue that case explicitly instead of assuming it. It also produced the
  "spend your boldness in one place" discipline that shaped the graduated-scale signature: one
  idea, three places, nothing decorative added elsewhere.
- **`ui-ux-pro-max:design-system`** — its three-layer token model (primitive → semantic →
  component) is what the base mockup already does (`--gold` → `--goldbg` → `.chip.gov`). Confirmed
  the existing architecture rather than changing it, and gave me the vocabulary to add the two
  new tokens (`--link-line`, the motion durations) at the correct layer instead of hardcoding them
  on components.
- **`ui-ux-pro-max:ui-styling` / `:brand`** — largely off-brief by design (shadcn/Tailwind/Radix
  stack, which zero-dependency explicitly rules out), and that mismatch is itself informative for
  §6. The `brand` skill's UI-specific note — "semantic colour is separate from the accent hue and
  doesn't count as your accent" — is what pushed the `.linkid` decision away from a sixth hue and
  toward form (§3).
- **`artifact-design`** — its three-state theme pattern (bare `:root`, a `prefers-color-scheme`
  media block guarded by `:not([data-theme="light"])`, and an explicit `[data-theme="dark"]`
  override) is built for a page with an unknown host theme. This file uses the base product's own
  `light-dark()` + `color-scheme` mechanism instead, which is the correct call for a page that
  *owns* its theme toggle rather than inheriting one — but reading the skill is what surfaced that
  as a real decision rather than a default, and its "give every theme the same care, don't
  naively invert" rule is why the literal panel got its own considered near-black palette instead
  of just inverting the app's tokens.
- **`chrome-devtools-mcp:a11y-debugging`** — supplied the actual test method used in §7: contrast
  via real pixel sampling (canvas `fillStyle`/`getImageData`), not CSSOM string-reading, because
  `getComputedStyle` returns unresolved `color-mix()`/`oklch()` function text for some values in
  this Chrome build — the same class of measurement trap `reports/2026-08-21-VISUAL-DIRECTION.md`
  describes for `light-dark()` on a `<canvas>`. Following that method is what caught the gutter
  contrast failure below instead of reporting a false pass.

---

## 6. Cost to adopt, and effect on the 396-key system

**Cost.** Everything here is CSS custom properties, one small vanilla-JS render layer (~250
lines, no framework), and native browser features already unflagged in Chrome (`@property`,
anchor positioning, `light-dark()`). Nothing to install — the worktree's `node_modules` junction
was never touched. Adopting the *motion* layer into the real product is copy the six duration/
ease tokens and the `prefers-reduced-motion` discipline; adopting the *`.linkid` fix* is one CSS
rule, applied everywhere the class already exists. Both are strictly additive to the existing
sheet — nothing here required deleting or restructuring a working rule.

**Effect on the 396-key system.** Every new UI string in this file (`nav.*`, `s.*`, `preview.*`,
`watch.*`, the gate names, `peek.h`) follows the base's own `data-t` convention and would slot in
as roughly **25–30 new keys** at EN/HE parity — small, because most of the copy here **reused**
the base's own verified strings rather than inventing parallel ones (the base's `HE` map already
had the exact Hebrew for the gate ladder, the tier vocabulary, and three of the five delivered
items; I read it out of the file rather than re-translating). The two places I *did* write new
prose with embedded `.m`/`.v` runs (`preview.carried`, `watch.voidn`) are deliberately **not** on
`data-t` nodes — a `data-t` textContent swap destroys nested spans, which is a bug I introduced
and then caught in testing (§8). They're twin `data-lang` blocks instead, which is one more
pattern for the 396-key system to standardise on if it wants rich, mixed-direction strings to be
translatable at all; right now the base mockup solves this with a small template parser
(`{m:text}`/`{v:name=val}`) that this file's smaller scope didn't need to reproduce, but a
396-key system at full scale will.

---

## 7. Where the zero-dependency ceiling actually is

**Plain CSS gets the whole way on everything this panel can see: styling, motion, theming,
RTL, and accessibility affordance.** Nothing in this prototype — the graduated-scale signature,
the zero-in/eased-out motion discipline, the bidirectional literal-panel linkage, the anchor-
positioned peek, the dark/light and EN/HE matrix, the focus rings — needed a library. If the
question is "can CSS alone reach 'wow' for this product," the answer from this file is yes:
the ceiling is not a rendering-fidelity ceiling.

**The ceiling is in two places, and neither of them is styling:**

1. **Browser-support insurance, not capability.** CSS anchor positioning and `@property` are
   real, shipped, and correct — but Chrome-only today. This file's fallback path (§4) is honest
   and small (one `getBoundingClientRect` call), but it is also *unmirrored*, and every anchored
   surface in a 21-screen product needs the same two-path treatment by hand. A positioning
   library (Floating UI) doesn't do anything CSS anchor positioning can't already do on a modern
   engine — it buys **cross-browser insurance today**, which is a different and much smaller
   claim than "CSS can't do this."
2. **DOM virtualization at real scale.** `PRIOR-RESEARCH.md` names 1,500–3,000 nodes as the zone
   where `content-visibility:auto` and disciplined `will-change` stop being enough on their own.
   This prototype's tables are small by design (8 audit rows, 7 delivered items) and never
   touches that wall. A repository with a real corpus and a real audit history will. Hand-rolling
   correct windowed virtualization — variable row height, scroll anchoring, keyboard nav through
   a virtual list, `content-visibility`'s interaction with find-in-page — is real, ongoing
   engineering risk that a maintained library (`tanstack-virtual`) absorbs. That is not a styling
   problem and CSS does not solve it by getting better.

**Everything in between — the actual "wow" surface: motion, density, bilingual correctness,
the instrument-scale signature, the literal panel — plain CSS and about 250 lines of vanilla JS
reach it completely, with no dependency tax.** If the product needs a library, it needs it for
browser-matrix insurance on two or three specific surfaces and for virtualizing lists past a
few thousand rows — not because CSS ran out of ceiling on how this product looks or moves.

---

## 8. One honest note on process

Three real bugs shipped in the first draft and were caught only by actually running the file in
a browser, not by re-reading the source: a `data-t` node that owned nested `.m`/`.v` children
(destroyed on language switch — a `TypeError` in the console led to it), a theme-conditional CSS
selector that wasn't itself gated behind a media query (would have painted the literal panel dark
under a light system preference with no `data-theme` set), and the bidi-reversal in §4. All three
are fixed and re-verified in the file as shipped. Recorded here because this project's own
recurring defect, named in `reports/2026-08-21-VISUAL-DIRECTION.md`'s own method section, is
asserting a property the code doesn't have — and a design rationale document is exactly as
capable of that as a measurement harness is.
