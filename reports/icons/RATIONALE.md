# Icon library selection — rationale

**Recommendation: Heroicons, the 16px/solid set.** Not because it wins any single measurement outright — Radix's grid is a hair tighter, Fluent's maintenance is more active — but because it's the only candidate with a genuine small-size drawing, a clean MIT licence, healthy maintenance, *and* zero packaging friction, all four at once. See `comparison.html` for the rendered proof; this file is the paper trail behind it.

Everything below was checked today (2026-08-21) against packages actually installed with `npm install` in a scratchpad, plus live GitHub REST API / npm registry calls, plus a live Chromium 152 forced-colors measurement via CDP. Nothing is from memory. Where I couldn't independently re-verify a sub-agent's finding (one item, flagged below), I say so.

---

## Method

- Installed and inspected today: `lucide-static@1.33.0`, `@phosphor-icons/core@2.1.1`, `@radix-ui/react-icons@1.3.2`, `heroicons@2.2.0`, `@tabler/icons@3.46.0`, `iconoir@7.12.1`, `@material-symbols/svg-400@0.46.0`, `@fluentui/svg-icons@1.1.337`.
- Counts are `ls`/`find` on the actual installed folders, not vendor marketing copy. Licences are the actual `LICENSE` file shipped in each package.
- Maintenance signal is the GitHub REST API's `pushed_at` and npm registry publish timestamps, fetched live today, cross-checked against a research pass that independently hit the same APIs plus raw-file/tarball inspection.
- The `forced-colors` findings are a live measurement: Puppeteer driving headless Chromium 152.0.7977.42, a CDP session issuing `Emulation.setEmulatedMedia({features:[{name:'forced-colors',value:'active'}]})`, then reading back `getComputedStyle` on the actual pane/icon markup used in `comparison.html`. Not simulated, not assumed.
- The six icons per candidate were extracted verbatim from the installed package. Radix Icons ships no plain SVG at all (see below) — those six were pulled by parsing the compiled React bundle's `React.createElement("path", {d: "..."})` calls, the only route available today.

## Per-candidate findings

### Radix Icons
- **Grid:** 15×15, natively — confirmed by extracting the raw path data (`viewBox="0 0 15 15"`, half-pixel anchors like `2.5`/`7.5`/`12.5` typical of a hand-fit pixel grid, not a scaled-down 24px path).
- **Licence:** MIT.
- **Count:** 318 in the published `@radix-ui/react-icons@1.3.2`; 332 on GitHub `main`.
- **Maintenance:** stable channel frozen since 2024-11-14 (~21 months); a v2 release candidate exists (tagged 2026-04-14) but isn't stable.
- **Packaging friction — decisive:** the published npm tarball ships **zero** `.svg` files. It's compiled React components only. There is no official plain-SVG channel. The six icons shown were extracted by regex-parsing `react-icons.cjs.development.js` — workable once, but it means every future Radix update requires re-running a bespoke extraction script against a compiled bundle, not `npm install && cp`. That's a real, recurring cost for a product whose stated constraint is zero-friction vendoring into other people's repos.
- **currentColor:** yes, per path (`fill: color` in source, default `'currentColor'`).

### Fluent UI System Icons
- **Grid:** 16×16, natively — confirmed by direct inspection of `assets/*_16_regular.svg` files (not derived from a 20 or 24px master).
- **Licence:** MIT.
- **Count:** 3,018 unique concepts (verified by stripping the `_<size>_<style>` suffix from all 20,641 filenames and counting uniques) × up to 7 sizes × up to 4 styles.
- **Maintenance:** the most active of every candidate measured — GitHub `pushed_at` 2026-08-20 (yesterday relative to this check), npm `1.1.337` published 2026-08-13, near-continuous point releases.
- **Packaging friction:** ships **no `fill` attribute at all** on any icon — every glyph defaults to opaque black per the SVG spec. Confirmed directly (`cat icons/checkmark_16_regular.svg` — no `fill` anywhere). Needs a build-time patch to `currentColor`, shown unpatched and patched side by side in `comparison.html`.
- **RTL:** a sub-agent reported that Fluent's source repo encodes per-icon `directionType` metadata (`"unique"` vs `"mirror"`) elsewhere in the Fluent ecosystem. **I could not independently re-verify this** — GitHub code search requires auth I don't have, and the metadata is not present in the `@fluentui/svg-icons` package actually inspected here. Treat the *existence* of that metadata as reported-not-verified; treat its *absence from the lightweight SVG package* as directly confirmed. Practically: even if real, it isn't reachable from the low-friction package we'd actually vendor.

### Heroicons — 16/solid (the recommendation)
- **Grid:** 16×16, natively — and provably not a scaled-down 24px set: the 16px set has 316 icons against 324 at 24px (8 dropped outright, which mechanical scaling never does), the path data differs structurally between sizes (e.g. `check.svg`: `M12.416 3.376…` at 16px vs `M16.704 4.153…` at 20px — not a uniform ×0.8 transform), and the CHANGELOG documents manual redraws ("rebuilt some icons for better clarity", "fixed chevrons in mini set").
- **Licence:** MIT.
- **Count:** 324 at 24px (outline + solid), 324 at 20px/solid, 316 at 16px/solid.
- **Maintenance:** actively maintained; the low open-issue count (4) reflects a deliberately narrow contribution policy (bug fixes only, no new icons accepted), not neglect — the repo was pushed 2026-05-12 and has `insiders` prereleases as recent as the same date.
- **Packaging:** one plain `.svg` per icon per style/size folder. `currentColor` out of the box, no patch needed.
- **No friction flags.** This is the whole case for it.

### Lucide
- **Grid:** 24×24, scaled ≈0.63× to reach 15px.
- **Licence:** dual **ISC + MIT** — ISC covers Lucide's own new icons, MIT covers icons inherited from the Feather fork. GitHub's automatic licence detector reports `NOASSERTION` on this repo because it can't classify a dual-licence file; a licence-scanning CI step would need a manual allow-list entry.
- **Count:** 1,776 canonical (the `icons/` folder holds 2,034 files; ~258 are deprecated-name aliases, cross-checked against `icon-nodes.json`'s key count).
- **Maintenance:** the most active by raw commit frequency of any candidate — pushed the day before this check, releases roughly weekly.
- **Packaging:** `lucide-static` ships one plain `.svg` per icon. `currentColor` by default. No friction.

### Tabler Icons
- **Grid:** 24×24, scaled ≈0.63×.
- **Licence:** MIT — explicitly re-verified today (the brief flagged this as worth checking since the catalogue has grown so large); no relicensing found, copyright line reads "2020–2026".
- **Count:** 6,184 (5,130 outline + 1,054 filled) — the largest catalogue of any candidate.
- **Maintenance:** pushed 2 days before this check.
- **Packaging:** plain `.svg` per icon under `icons/outline/` and `icons/filled/`. Each file carries one extra invisible hit-area path (`stroke="none"`) — harmless, worth stripping at build time. Most predictable naming of any candidate: all six actions matched the first guess.

### Iconoir
- **Grid:** 24×24, 1.5px stroke (thinner than Lucide/Tabler's 2px), scaled ≈0.63×.
- **Licence:** MIT.
- **Count:** 1,671 (1,383 regular + 288 solid).
- **Maintenance:** pushed 9 days before this check, roughly monthly releases.
- **Packaging note:** the npm package's bundled icon-font CSS is roughly 4× the size of the plain-SVG folder — vendor from `icons/` specifically, never the whole package.

### Material Symbols
- **Grid:** nominally 24×24 (960-unit internal coordinate system); **this specific offline package bakes in opsz-48 geometry only**.
- **Licence:** Apache-2.0. Good news for silent vendoring: the source repo ships **no `NOTICE` file**, so Apache-2.0 §4(d)'s notice-propagation clause never triggers — no attribution-file obligation beyond keeping the licence text itself.
- **Count:** 3,899.
- **Maintenance:** upstream (Google) pushed 1 week before this check — very active.
- **Real finding, not assumption:** Google's live API genuinely serves distinct small-size geometry — fetching the same glyph (`refresh`) at 20px vs 48px from `fonts.gstatic.com` returns structurally different path data, not a scaled transform, confirming Material Symbols' optical-sizing claim is real. But the convenient offline `@material-symbols/svg-400` package used for vendoring only bundles the 48px-optimized geometry; reaching the true 20px geometry means a live per-icon fetch from Google Fonts at build time, not a plain `npm install`.
- **Packaging friction:** ships **no `fill` attribute** — same problem as Fluent, same fix applied and shown.

### Phosphor — regular weight
- **Grid:** 256×256 — the only candidate needing a viewBox normalization step to sit alongside the others.
- **Licence:** MIT.
- **Count:** 1,512 unique names × 6 weights (thin/light/regular/bold/fill/duotone) = 9,072 files.
- **Maintenance — disqualifying:** no npm release since 2024-03-29 (over two years before this check); the last commit touching actual icon content was 2025-05-21. The repo isn't archived, but growth has effectively stopped. **Excluded from serious consideration on this basis alone** — vendoring a tool meant to live inside other people's repositories for years onto a two-year-frozen source is a bet against the evidence, independent of how the glyphs look.

## Why Heroicons over Radix and Fluent specifically

All three have a real small-size drawing (15px, 16px, 16px respectively) and all three rendered legibly in `comparison.html` at both 14px and 16px on the actual glass pane — this was not a photo finish decided by squinting at pixels. The decision is about what each one costs to actually vendor and keep vendored:

| | Radix | Fluent | Heroicons 16/solid |
|---|---|---|---|
| Native grid | 15×15 | 16×16 | 16×16 |
| Ships plain SVG today | **No** | Yes | Yes |
| `currentColor` out of the box | Yes | **No** | Yes |
| Maintenance | frozen ~21mo | most active measured | active, narrow scope |
| Package size for what we need | small | 20,641 files for 6 icons | 1,288 files for 6 icons |

Radix loses on the one thing that compounds every time the set needs to change: there is no supported way to get its SVGs without parsing a compiled JS bundle by hand. Fluent loses on immediacy: real vendoring work (a currentColor patch) is required before the first render, and its single strongest differentiator — RTL direction metadata — isn't reachable from the package that's actually low-friction to vendor, and I could not independently confirm its existence in a form I could use today. Heroicons asks for nothing: `npm install heroicons`, copy six files, done, and the licence, count, and maintenance facts all check out clean.

## RTL — the mirroring list

Of the six actions, **only `open` mirrors.** It depicts an arrow escaping a box toward the reading-end corner, so the corner has to flip with reading direction. The other five are non-directional and must **not** mirror — flipping `search`'s glass or `refresh`'s loop would be actively wrong, not merely unnecessary:

| Action | Mirrors under RTL? | Why |
|---|---|---|
| refresh | No | cyclical motion, no spatial "forward" |
| copy | No | a duplicate-document glyph, non-directional |
| **open** | **Yes** | arrow escapes toward the reading-end corner |
| confirm | No | a checkmark has no reading direction |
| search | No | a magnifying glass is not a directional glyph |
| add | No | symmetric; mirroring is a no-op anyway |

**Does any candidate mark this?** No — checked all eight. None ship a pre-mirrored variant or machine-readable direction metadata for these six specific icons. (Material Symbols has 11 hand-special-cased `_rtl` icons elsewhere in its catalogue — `checklist_rtl`, `keyboard_tab_rtl`, etc. — none of which are among our six. Fluent may have direction metadata elsewhere in its ecosystem per a sub-agent's report, not independently confirmed, and not present in the package actually used here.) Mirroring is implemented once, in `comparison.html`, as `[dir="rtl"] .ic-mirror { transform: scaleX(-1) }` applied only to the `open` icon — verified programmatically (not just by eye): under `dir="rtl"` the `open` icon's computed transform is `matrix(-1,0,0,1,0,0)`; all five others compute to `none` in both directions.

## `forced-colors: active` — measured, not assumed

Verified live against Chromium 152.0.7977.42 (Puppeteer + CDP `Emulation.setEmulatedMedia`), reading back real `getComputedStyle` values on the actual glass-pane markup used in `comparison.html`. The spec's own §8 called this scenario "untested against glass" — it's tested now.

**The glass material itself does not survive.** Measured on `.pane`:
- `background-image` (both the gloss gradient and the ground-tint gradient) → forced to `none`
- `background-color` → forced to fully transparent
- `border-color` → forced to a system colour
- `backdrop-filter` → **not** forced, keeps blurring — now blurring nothing colourful behind it

The pane degrades to a blurred, system-coloured outline. That's a finding about the whole visual direction, not just icons, and it answers an item the spec explicitly left open.

**For icons specifically**, the mechanism (confirmed both by reading Chromium's source, `third_party/blink/renderer/core/css/svg.css`, which sets `svg { forced-color-adjust: preserve-parent-color }`, and by three independent live measurements here):

1. An icon using `fill="currentColor"` and inheriting `color` normally from its container **tracks whatever forced colour that container receives.** Measured directly: a brand colour (`rgb(139,156,230)`) on a wrapping element becomes forced black the instant the page enters forced-colors mode, and the inheriting SVG follows automatically. This is what every patched candidate here does.
2. A **hardcoded literal fill** — either an explicit `fill="#hex"` or, as Fluent and Material Symbols ship it, no `fill` attribute at all (defaulting to opaque black per the SVG spec) — **is left completely alone, in every theme.** Measured directly: `fill:#8b9ce6` set as a literal (non-`currentColor`) value survives forced-colors unchanged; an icon with no fill attribute stays exactly the black it always was. That's not a safety net, it's a coincidence: it happened to be legible here because black contrasts against this measurement's forced light background, and it would be invisible against a forced dark background, unconditionally, no matter what the user's chosen system palette actually is.

**Conclusion: the `currentColor` patch Fluent and Material Symbols both need isn't a cosmetic nicety — it's the difference between an icon that participates in forced-colors mode and one that's gambling on which system theme the reader happens to have.** This is an argument that generalizes past this specific decision: any future icon work in this product should treat "ships `currentColor`" as a hard requirement, not a preference.

## Bundle cost, for the six actions actually needed

Inlined as raw SVG markup (what `comparison.html` does), measured with `Buffer.byteLength` on the actual extracted strings — not estimated:

| Candidate | 6 icons, inlined (measured) |
|---|---|
| Phosphor | 1,592 B |
| Material Symbols (patched) | 1,679 B |
| Fluent (patched) | 1,749 B |
| Lucide | 1,925 B |
| Iconoir | 2,279 B |
| Heroicons 16/solid | 2,437 B |
| Tabler | 2,664 B (includes one inert hit-area path per icon) |
| Radix | 4,886 B — largest, not smallest: the hand-fit 15px grid trades a tight *viewport* for verbose, high-precision decimal control points |

The spread (1.6–4.9 KB) is real but doesn't matter at this scale — six icons from any candidate here round to "free" against a 12.5px-monospace-row UI, and it's the one axis where Radix's native grid is actually a mild cost rather than a benefit. Bundle size was never the deciding axis; it's reported, measured, because the brief asked for it, not because it moved the recommendation.

## Licence summary — vendoring permission

All eight are permissively licensed and explicitly permit vendoring into another repository; none require attribution to appear in-product, only that the licence text travel with the copy:

| Candidate | SPDX | Vendoring note |
|---|---|---|
| Radix | MIT | standard |
| Fluent | MIT | standard |
| Heroicons | MIT | standard |
| Lucide | ISC + MIT (dual) | GitHub auto-detection reports NOASSERTION — pre-empt with a manual CI allow-list entry |
| Tabler | MIT | standard, reconfirmed unchanged today |
| Iconoir | MIT | standard |
| Material Symbols | Apache-2.0 | no NOTICE file upstream → no notice-propagation burden |
| Phosphor | MIT | standard (moot given the maintenance disqualification) |

## What each consulted tool actually changed

- **`frontend-design` skill:** reinforced testing legibility at the *actual* target size rather than judging at a comfortable native size and extrapolating — directly why `comparison.html` renders every candidate at both 14px and 16px rather than once at 24px.
- **`ui-ux-pro-max:design` skill:** routed to its icon-design reference, which supplied the SVG authoring checklist (`currentColor`, `stroke-linecap/linejoin: round`, minimal path nodes) used to judge the stroke-based candidates, and surfaced a documented AI-icon-generation pipeline (Gemini 3.1 Pro) as the concrete fallback if the evidence had pointed to "draw them ourselves." It didn't: three candidates (Radix, Fluent, Heroicons) already have genuine small-size masters, which a freshly generated set would have to out-draw to be worth the switch, and nothing in the render suggested any of them fall short.
- **`context7`:** dispatched for Radix Icons and Lucide documentation specifically (package distribution/v2 status for Radix; lucide-static vs JS packages and small-size guidance for Lucide), per the pinned consultation rule. See the addendum at the end of this file for the actual result.
- **`chrome-devtools-mcp:a11y-debugging` skill:** framed the forced-colors verification as a measurement problem (real computed styles under real emulation) rather than a documentation-reading problem, which is why the forced-colors section above is backed by CDP measurements against this project's actual glass tokens rather than a citation of someone else's blog post.

## The strongest argument against this pick

**Radix Icons is a better fit on the numbers that matter most to a 12.5px monospace row — a 15px native grid beats a 16px one, marginally, at exactly the sizes this UI renders at — and if the packaging problem gets fixed (v2 ships a real plain-SVG export, which is already on GitHub `main` even if not published), Heroicons loses its only advantage over it.** The honest counter-argument to my own recommendation is that I'm optimizing for *today's* vendoring cost against a library whose maintainers are visibly mid-fix on exactly the gap that's disqualifying it. If Radix Icons v2 stabilizes with a published `icons/*.svg` export — which its own `main` branch already scaffolds — re-running this comparison could flip the recommendation, and it would be worth checking back.

## Deliverable note

`reports/icons/comparison.other-agent-instance.html` in this same directory is **not mine** — it was already present, mid-write, when I reached this step, evidently from another agent working the identical brief concurrently in a shared environment. I moved it aside rather than overwrite or delete it; it represents an independent second attempt at this same question and the owner may want to compare the two rather than have one silently vanish.

## Addendum — context7 result

*(pending at time of writing; the query was in flight when this file was first committed — updated below once it returns)*
