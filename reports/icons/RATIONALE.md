# Icon library for the mycontext web UI — rationale

**Recommendation: Tabler Icons, outline style, vendored as six inlined SVGs (refresh, copy, external-link, check, search, plus).**

Everything below was checked today (2026-08-21) against the actual, currently-published packages — installed with `npm install` into an isolated scratchpad, never into this repository's `node_modules` — not recalled from training data. Where I couldn't verify something directly I say so. The rendered proof is `reports/icons/comparison.html`; this file is the argument behind it.

---

## 1. The one-sentence version

Tabler's outline set is a literal, un-reinterpreted match for the spec's "one stroke family," renders crisply at 14–16px when actually magnified and inspected (not merely eyeballed at 100%), ships as a genuine plain `.svg` per icon with real `currentColor`, carries the cleanest single-MIT licence of any stroke-based candidate, and was pushed to more recently than every candidate checked except Fluent — and none of that required accepting the packaging risk that sank the two candidates with a mathematically tighter fit to this UI's row height.

## 2. What actually decided it — and what didn't

Going in, the obvious hypothesis was **grid math**: a library drawn natively at 15 or 16px should out-render one scaled down from 24px, at 14–16px. I ordered the eight candidates by exactly that axis and expected it to settle things.

It didn't. I rendered all six actions for all eight candidates on the real glass-pane tokens at 14px and 16px, then went back and re-rendered each at `deviceScaleFactor: 6` (Puppeteer, Chromium 152.0.7977.42) and inspected the icons at true anti-aliased fidelity rather than trusting a resized screenshot. **Every actively-maintained candidate — Radix, Fluent, Heroicons, Lucide, Tabler, Iconoir — was legible and clean at both sizes.** The 2px-stroke-on-a-24-grid families (Lucide, Tabler, Iconoir) did not show the sub-pixel blur I expected from the scaling math; modern SVG anti-aliasing handles a ~1.25px effective stroke at 15px fine. So "which one can you read" turned out not to discriminate among the top six. What discriminates is what happens when you actually try to get the SVGs out of each package and keep them there for years.

That's the pivot this report makes, and it's worth being upfront about: a purely mathematical analysis would have pointed at Radix (15×15, the tightest fit of anything checked) or Heroicons (16×16, hand-redrawn, not scaled). Rendering it disproved the premise that grid-tightness was the deciding axis, and a **real bug in my own extraction pipeline**, caught only because I went and looked at true magnification, is a big part of why the recommendation moved off Radix. See §6.

## 3. The eight candidates, verified today

| | Licence (SPDX) | Icon count | Grid | Last touched | Ships plain SVG? | Ships real `currentColor`? |
|---|---|---|---|---|---|---|
| **Tabler — outline** ✅ | MIT | 6,184 (5,130 outline + 1,054 filled) | 24×24, 2px stroke | commit 2 days before check | Yes, `@tabler/icons` `icons/outline/*.svg` | Yes |
| Radix Icons | MIT | 318 published / 332 on GitHub `main` | **15×15 native** | stable channel frozen since 2024-11-14 (~21 months); v2 RC exists, not stable | **No** — current npm tarball ships zero `.svg` files | Yes (in the compiled bundle) |
| Fluent UI System Icons — Regular | MIT | 3,018 unique concepts (20,641 files across sizes/styles) | **16×16 native** | pushed **yesterday** — most active of all eight | Yes, `@fluentui/svg-icons` `icons/*.svg` | **No** — no `fill` attribute at all, defaults to black |
| Heroicons — 16/solid (mini) | MIT | 316 of 324 (8 deliberately excluded at 16px) | **16×16 native, hand-redrawn** | actively maintained; narrow scope by policy (bug-fixes only) | Yes, `heroicons` `16/solid/*.svg` | Yes |
| Lucide | ISC + MIT (dual) | 1,776 canonical (2,034 files in `icons/`, ~258 are deprecated-name aliases) | 24×24, 2px stroke | pushed within the last day — tied for most active | Yes, `lucide-static` `icons/*.svg` | Yes |
| Iconoir | MIT | 1,671 (1,383 regular + 288 solid) | 24×24, **1.5px stroke** | release 9 days before check | Yes, `iconoir` `icons/*.svg` (the bundled icon-font CSS is ~4× the size — vendor from `icons/` only) | Yes |
| Material Symbols — Outlined | Apache-2.0 (no NOTICE file in source, so no NOTICE-propagation burden) | 3,899 | 24×24 nominal (960-unit grid); the offline npm package bakes in **opsz 48 only** | Google pushes ~weekly; last push 1 week before check | Yes, `@material-symbols/svg-400` `outlined/*.svg` | **No** — no `fill` attribute, defaults to black |
| Phosphor — Regular | MIT | 1,512 unique names × 6 weights | 256×256 (unusual internal grid) | **STALLED** — no npm release since 2024-03-29 (2+ years); last icon-content commit 2025-05-21 | Yes, `@phosphor-icons/core` `assets/regular/*.svg` | Yes |

Sources for licence/count/grid: direct inspection of the installed npm package (`package.json`, `LICENSE`, and the actual icon files/folder counts) for every row. Sources for maintenance dates: GitHub REST API (`pushed_at`, latest commit) and the npm registry's publish timestamps, queried today. Material Symbols' 20px-vs-48px claim was verified by diffing the actual path data fetched from `fonts.gstatic.com` at both sizes — they are structurally different curves, not a scaled transform, so the geometry genuinely exists; it just isn't in the convenient offline package.

Two extra facts, not in the table: **Radix's GitHub `main` branch already scaffolds a `./icons/*.svg` subpath export** for its unreleased v2 (confirmed independently twice — once by direct inspection of `main`'s `package.json`, once by a separate research pass) — the packaging gap is being actively fixed upstream, just not shipped. And **none of the eight ship any RTL-mirroring metadata for these six icons** (§5) — Material Symbols has 11 hand-special-cased `_rtl` icons elsewhere in its catalogue (`checklist_rtl`, `format_list_numbered_rtl`, etc.), none of which are among refresh/copy/open/confirm/search/add.

## 4. Why Tabler over the two mathematically tighter fits

**Radix Icons (15×15 native) — the strongest icon on paper, ruled out on packaging risk, demonstrated rather than assumed.** Radix's current stable release (`@radix-ui/react-icons@1.3.2`) contains **zero plain `.svg` files** — confirmed by extracting the actual npm tarball and finding no `.svg` entries in it at all. The only way to get raw markup today is to parse the compiled React bundle (`react-icons.cjs.development.js`) and pull path data out of `React.createElement("path", {...})` calls. I wrote that extraction script for this report. **The first version of it had a boundary bug**: it grabbed the right icon's first path correctly but then kept scanning past the end of that icon's component definition and picked up the *next* icon's path too, superimposing it via `fill-rule: evenodd`. At a glance in a normal-sized screenshot this looked like an icon. At `deviceScaleFactor: 6` it was visibly a scribbled mess — refresh and copy both had a second, unrelated icon's outline fused into them. I caught it because I happened to zoom in for an unrelated reason; a less careful build script would ship it. That is not a hypothetical maintenance cost — it is a bug that occurred, once, in this exact seven-hour exercise, against a bundle format Radix does not version or document as an extraction target. A build pipeline that has to reverse-engineer where one icon's definition ends and the next begins in an unversioned compiled artifact is a liability disproportionate to a grid-size edge that, once actually rendered, produced no visible legibility difference from Tabler.

**Heroicons 16/solid (16×16 native, hand-redrawn) — a very close second, set aside on spec-literalism, not on any flaw.** This is the strongest "if not Tabler, then this" pick, and I want to be honest that the case against it is thin: it has zero packaging friction (real `currentColor`, real plain SVG, one file per icon), it's genuinely hand-redrawn rather than mechanically scaled (proven three ways — see §6 of the earlier research pass: a different icon count at 16px than 24px, changelog entries documenting manual redraws, and structurally different path data between sizes), and it's actively maintained. The reason it isn't the pick is that it's a **filled/solid** family, and the spec's own wording for the action set is "inline SVG, **one stroke family**." Tabler is a literal match for that phrase; Heroicons is a defensible but interpretive one (its filled shapes read as a consistent, stroke-weight-like line at this size — which is genuinely true, visually — but that's a reading of the spec, not an instance of it). Given the owner explicitly rejected a prior round of this work as "too safe," I chose not to quietly reinterpret the spec's own language in order to land on the library with zero asterisks. If the owner is fine reading "one stroke family" loosely, Heroicons is the pick with no other changes needed to this report's method.

**Fluent UI System Icons — the best-maintained candidate, set aside on the same packaging-friction class as Material Symbols.** It has the best maintenance signal of anything checked (pushed yesterday) and a genuinely native 16×16 grid, but the lightweight `@fluentui/svg-icons` package ships **no `fill` attribute at all** — every path defaults to solid black and needs a build-time patch before it's usable on a dark pane. That patch is a one-line, safe regex (unlike Radix's bundle-parsing), so this is a much smaller objection than Radix's — but it's still a real step Tabler doesn't require. Its one genuine differentiator, a reported per-icon RTL classification (`directionType: "mirror"` vs `"unique"`), is not present in this lightweight package; reaching it means depending on the larger `@fluentui/react-icons` metadata instead, which is scope creep for vendoring six static glyphs.

**Material Symbols and Phosphor** are documented in the table and in `comparison.html` but were never live contenders: Material Symbols has the same unpatched-black-fill problem as Fluent plus a wrong-optical-size problem (the offline package only ships opsz-48 geometry); Phosphor's core package has had no npm release in over two years, which is disqualifying for something meant to be vendored into other people's repositories indefinitely, independent of how it looks.

## 5. RTL mirroring

The UI mirrors under `dir="rtl"`. Of the six actions, exactly **one** has a spatial direction that should flip:

| Icon | Mirrors under RTL? | Why |
|---|---|---|
| **open** (external-link) | **Yes** | The arrow points out of the box toward the reading-end corner — that corner is upper-right in LTR, upper-left in RTL. |
| refresh | No | A cyclical action, not a directional one — flipping the loop's rotation direction would misrepresent it. |
| copy | No | Two overlapping rectangles; no inherent direction. |
| confirm (check) | No | Not a directional glyph in any major design system's RTL guidance. |
| search (magnifying glass) | No | The handle's angle is a stylistic convention, not a reading-direction cue. |
| add (plus) | No | Symmetric — mirroring is a no-op. |

**None of the eight libraries checked ship a pre-mirrored variant for any of these six.** Mirroring is left to the consuming application everywhere, via a scoped rule:

```css
[dir="rtl"] .icon-open { transform: scaleX(-1); }
```

This was verified in the rendered comparison, not just asserted: `comparison.html`'s LTR/RTL section shows the real row twice, with `dir="rtl"` genuinely set on the second copy, and only the "open" button carries the mirror transform. The row-action ordering itself also flips correctly under `dir="rtl"` with no extra code, because it's ordinary inline flow, not an explicit left/right layout.

## 6. `forced-colors` verdict

Measured directly, not assumed — Chromium 152.0.7977.42, a real CDP session (`Emulation.setEmulatedMedia({features:[{name:'forced-colors',value:'active'}]})`), computed styles read back from the actual pane CSS copied verbatim from the spec.

**What forces and what doesn't, on this exact glass pane:**
- Both of the pane's `background-image` gradient layers (the gloss and the tint) are forced to `none`.
- `background-color` is forced to a fully transparent value.
- `border-color` and the pane's own `color` are forced to system colours.
- `backdrop-filter: blur(20px) saturate(1.4)` keeps running, unforced — now blurring almost nothing.
- **The glass material does not survive `forced-colors`; it collapses to a bordered box.** This answers the spec's own §8 open question ("`forced-colors`... untested against glass") — it is now tested, and the material does not hold up. That's a finding about the whole visual direction, not just icons, surfaced as a side effect of testing the icon set properly.

**The icon-specific finding:** an SVG's `fill: currentColor` resolves through the SVG root's `forced-color-adjust: preserve-parent-color` — confirmed both in Chromium's own UA stylesheet (`svg.css`) and in the CSS Color Adjustment Module Level 1 spec (W3C CR snapshot, 2026-05-07). In practice: **if an icon inherits its colour from a forced-adjusted ancestor, it correctly follows along. If the icon (or a wrapping element) sets its own explicit `color` — including via a CSS custom property like `var(--ok)` — that colour is left exactly as authored and does not track the forced palette.** Measured directly: an icon given its own `color: #8b9ce6` stayed that exact purple under forced-colors while its container's background and border were stripped out from under it.

**The rule this implies for vendoring, and it happens to be free:** the spec's own token system already has action icons (refresh/copy/open/confirm/search/add) inheriting neutral `--ink`/`--dim` rather than setting their own colour — only chip meaning-colours are ever set explicitly, and a chip already carries meaning by **shape** too (circle/square/diamond, §3.6 of the spec), so a colour that goes inert under forced-colors doesn't erase the information. This was also verified live: the winner row's tier marks kept their gold/green/blue hues under real forced-colors emulation (because they set their own colour) while the surrounding pane, borders, and text correctly went to the system palette — shape stayed legible throughout.

**One more thing this surfaced, unprompted:** live-testing under real forced-colors also showed that a single rule scoped to `.pane` is not enough. The sunken **search field** (the spec's own primitive §3.3, "the literal field") is its own surface with its own explicit background and border, and in this exact test it stayed a muddy dark grey instead of resolving to the `Field`/`FieldText` system-colour pair meant for exactly this case. Every distinct surface the spec defines — pane, plate, sunken field — needs its own forced-colors rule; that's real, previously-uncounted implementation surface area behind the spec's "untested against glass" line.

## 7. Bundle cost, inlined

Six icons only — refresh, copy, open, confirm, search, add — measured as raw UTF-8 bytes of the extracted markup:

| Library | 6-icon raw size |
|---|---|
| Fluent | 1,749 B |
| Material Symbols | 1,679 B |
| Phosphor | 1,592 B |
| Lucide | 1,925 B |
| Iconoir | 2,279 B |
| Heroicons 16/solid | 2,437 B |
| **Tabler (as shipped)** | **2,664 B** |
| Radix (bundle-extracted) | 4,886 B |

Tabler is not the smallest — its extra invisible hit-area path per icon (`<path stroke="none" d="M0 0h24v24H0z" fill="none"/>`, a click-target convenience some consumers want) adds bytes for no visual effect. Stripped and minified, the six-icon Tabler set is **2,172 bytes raw, ~463 bytes gzipped**. At any of these sizes the difference between candidates is noise: six icons, however sourced, cost under 5KB raw and under 1KB gzipped. **Bundle size was not a factor in this decision** — it's reported because the brief asked for it, not because it discriminated between candidates.

## 8. Tools consulted, and what each one changed

Per `RULE-ui-work-consults-every-installed-design-frontend-and-browser`:

- **`frontend-design`** — reinforced testing at the *exact* target size rather than eyeballing at a comfortable native size, which is what drove building both a 14px and 16px row per candidate instead of one, and later the `deviceScaleFactor: 6` magnified re-check that caught the Radix bug.
- **`ui-ux-pro-max:design`** — routed to its icon-design reference, which supplied the small-size SVG authoring checklist (`currentColor`, `stroke-linecap`/`stroke-linejoin: round`, minimal path nodes) used to judge every stroke-based candidate, and confirmed a bespoke AI-icon-generation pipeline (Gemini 3.1 Pro) exists as a real fallback if the evidence had pointed to "draw them ourselves." It didn't: Radix, Fluent, and Heroicons' native small-size drawings, and Tabler/Lucide/Iconoir's crisp-at-magnification stroke rendering, all already clear the bar a fresh hand-drawn set would have to match from zero.
- **`context7`** — queried for Radix Icons and Lucide package-distribution facts. It corroborated, independently, the same finding this report reached by directly inspecting the published tarball: Radix's stable release has no plain-SVG export, and a real one is scaffolded but unpublished on `main`.
- **`chrome-devtools-mcp` (a11y-debugging)** — used to check the finished `comparison.html` for console errors and broken elements before shipping it (none found: 150 SVGs, zero zero-size elements, no horizontal overflow), and its browser was the one actually driven (via CDP) for the `forced-colors` measurements in §6, which is the load-bearing empirical work in this report.

## 9. The strongest argument against this pick

**Radix Icons' 15×15 grid is a genuinely, mathematically tighter fit to this UI's 14–16px rows than Tabler's 24×24-scaled-to-15px, and Radix's packaging gap is visibly being fixed, not permanently broken.** Its `main` branch already scaffolds a real `./icons/*.svg` export for the unreleased v2. If that ships, Radix's only disqualifying weakness disappears, and at that point its tighter native grid — even though it produced no *visible* advantage in this round of rendering — is still the more principled choice for a UI whose entire icon requirement is six glyphs at almost exactly Radix's native size. **This recommendation has a natural expiration condition: re-run this comparison against `@radix-ui/react-icons@2.x` if and when it ships a real SVG export, and Tabler should lose to it on principle even without a visible difference in the render.** Until then, betting a build pipeline on hand-parsing an unversioned compiled bundle — a mistake this exact report made once, on the first attempt, with careful code — is the wrong trade for six icons that Tabler already delivers cleanly today.

A secondary, smaller argument against this pick: if "one stroke family" in the spec was meant loosely rather than literally, Heroicons 16/solid is at least as strong a choice with zero asterisks of its own (§4). That's a judgment call about how to read four words in a design spec, not a factual dispute, and it's flagged rather than resolved unilaterally.
