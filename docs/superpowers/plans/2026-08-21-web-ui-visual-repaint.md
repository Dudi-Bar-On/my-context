# Web UI Visual Repaint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaint `docs/design/web-ui-mockup.html` — the design of record — into the approved dark glass direction, without touching its 396 string keys, its EN/HE parity, or its structure.

**Architecture:** The mockup's token block is replaced wholesale; every screen inherits the new material through tokens it already references. Eight primitives carry the whole visual system, so a screen is a composition of primitives rather than a set of decisions. Light mode is removed as one change rather than left half-present. The hero screen lands first and alone, so the direction can be judged before nineteen more screens depend on it.

**Tech Stack:** Plain CSS in a single self-contained HTML file. No framework, no build step, no runtime dependency. Self-hosted `.woff2`. Inline SVG.

**Spec:** `docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md`

## Global Constraints

- **Zero runtime dependencies.** `package.json` has no `dependencies` and `bin` points at `./src/cli/index.ts`, run from source by Node 24. Nothing in this plan changes that.
- **Erasable syntax only** in any `.ts` touched — no `enum`, no parameter properties, no `namespace`.
- **Logical CSS properties only.** The UI mirrors. Zero `margin-left`, `padding-right`, `text-align:left|right`, `float`. Verified at 2,794 declarations today.
- **No `innerHTML`.** Anywhere.
- **396 string keys at exact EN/HE parity.** `test/ui/strings-parity.test.ts` derives its count and refuses invented keys. A key added to the mockup must be added to `strings/en.js` and `strings/he.js` in the same commit.
- **Dark only.** No `light-dark()`, no `prefers-color-scheme` branch, no theme toggle.
- **Motion only where clicking acts.** Four duration tokens exist and no ambient one.
- **`--faint` is large-text only.** Body-sized prose uses `--dim`.
- **No NUL bytes.** `npm run check:text-files` has caught four this week, written from an unescaped u-0000 literal — including one in this plan, on the line stating this rule. Write the escape as text, never as the character.
- **Gates, all of which must pass before any task is done:** `npm test`, `npm run typecheck`, `npm run check:text-files`, `npm run check:retired`, `npm run check:test-glob`, `npm run verify:citations`, `npm run test:e2e`. Baseline at plan time: **3187 tests / 3185 pass / 0 fail / 2 skipped**, citations **696 / 0 broken**, e2e **21 passed**.
- **Three tests flake under concurrent load and are not yours:** `test/core/seen-file.test.ts`, `test/cli/ingest-lock.test.ts`, `test/docs/examples.test.ts` (fails by TIMEOUT). Run the file alone to confirm, say so, move on.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/design/web-ui-mockup.html` | The design of record. Token block, primitive CSS, 21 screens. Everything visual lands here. |
| `src/ui/public/fonts/*.woff2` | Three self-hosted faces. New directory. |
| `src/ui/public/styles.css` | Currently a 99-byte placeholder. Becomes the shipped stylesheet, mirroring the mockup's tokens. |
| `test/ui/strings-parity.test.ts` | Untouched by intent. If a task reddens it, the task added a key without its pair. |
| `test/ui/faint-usage.test.ts` | **New.** Enforces the `--faint` rule. |
| `e2e/bidi.spec.ts`, `e2e/language.spec.ts`, `e2e/runs.spec.ts` | Three pinned counts move. Derive them, do not re-pin. |
| `e2e/playwright.config.ts` | Loses the light-mode project. |

---

## Task 1: The token layer, and light mode out

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — the `:root` token block
- Modify: `e2e/playwright.config.ts` — remove the light project
- Test: `test/ui/strings-parity.test.ts` must stay green (it does not read colour)

**Interfaces:**
- Consumes: nothing.
- Produces: `--ground`, `--pane-gloss`, `--pane-tint`, `--pane-edge`, `--pane-lit`, `--lift`, `--ink`, `--dim`, `--faint`, `--gold`, `--ok`, `--carry`, `--crit`, `--plate`, `--ease`, `--dur-nav`, `--dur-act`, `--dur-link`, `--dur-retime`. Every later task references these by name and defines none of its own.

- [x] **Step 1: Count what exists, so the removal can be proven complete**

```bash
grep -c "light-dark(" docs/design/web-ui-mockup.html
grep -c "prefers-color-scheme" docs/design/web-ui-mockup.html
```
Record both numbers. They must be **0** at the end of this task.

- [x] **Step 2: Replace the token block**

```css
:root{
  --ground:
    radial-gradient(120% 90% at 14% 6%, #433580 0%, transparent 58%),
    radial-gradient(115% 85% at 88% 92%, #0f6069 0%, transparent 60%),
    radial-gradient(90% 70% at 56% 46%, #23306f 0%, transparent 66%),
    #0b0c11;
  --pane-gloss: linear-gradient(133deg, rgb(255 255 255/.07) 0%, rgb(255 255 255/.02) 46%, rgb(0 0 0/.05) 100%);
  --pane-tint:  linear-gradient(133deg, rgb(9 10 16/.56) 0%, rgb(9 10 16/.62) 34%, rgb(9 10 16/.64) 100%);
  --pane-edge:  rgb(255 255 255/.14);
  --pane-lit:   inset 0 1px 0 rgb(255 255 255/.20);
  --lift: 0 2px 3px rgb(0 0 0/.4), 0 10px 22px rgb(0 0 0/.34), 0 26px 56px rgb(0 0 0/.3);
  --plate: rgb(6 7 11/.72);
  --ink:#f0eef6; --dim:#a9a6b8; --faint:#7d7a90;
  --gold:#e8c368; --ok:#7cc0a0; --carry:#8b9ce6; --crit:#e08b8b;
  --ease:cubic-bezier(.23,1,.32,1);
  --dur-nav:180ms; --dur-act:200ms; --dur-link:280ms; --dur-retime:420ms;
}
```

There is deliberately **no ambient duration token**. Do not add one.

- [x] **Step 3: Delete every `light-dark()` pair and the `prefers-color-scheme` block**

Re-run Step 1's greps. Both must return 0. A half-removed theme is worse than either.

- [x] **Step 4: Remove the light project from the Playwright config**

The config pins `colorScheme` per project. Delete the light one. **This is why the print-from-dark defect went unseen for so long** — no spec ever printed from dark.

- [x] **Step 5: Run the gates**

```bash
npm test && npm run test:e2e
```
Expect the three pinned e2e counts to be **unchanged** — this task moves no elements. If they move, something structural was edited by accident.

- [x] **Step 6: Commit**

```bash
git add docs/design/web-ui-mockup.html e2e/playwright.config.ts
git commit -m "feat(ui): the dark glass token layer, and light mode out as one change"
```

---

## Task 2: Vendor the typefaces

**Files:**
- Create: `src/ui/public/fonts/geist-{400,450,500,600}.woff2`, `geist-mono-{400,500}.woff2`, `plex-sans-hebrew-{400,500,600}.woff2`
- Create: `src/ui/public/fonts/LICENSE-OFL.txt`
- Modify: `docs/design/web-ui-mockup.html` — `@font-face` block and `--sans` / `--mono`

**Interfaces:**
- Produces: `--sans: "Geist","IBM Plex Sans Hebrew",system-ui,sans-serif` and `--mono: "Geist Mono",ui-monospace,monospace`.

- [x] **Step 1: Fetch the faces and confirm the licence permits vendoring**

Both families are OFL. The licence file ships beside them because this plugin installs inside other people's repositories.

- [x] **Step 2: Write the `@font-face` block**

```css
@font-face{font-family:"Geist";font-weight:400;font-style:normal;font-display:swap;
  src:url("fonts/geist-400.woff2") format("woff2")}
/* …450, 500, 600; Geist Mono 400, 500; IBM Plex Sans Hebrew 400, 500, 600 */
```

`font-display: swap` so a missing file degrades to a fallback rather than invisible text.

- [x] **Step 3: Write the failing test — the Hebrew face must actually resolve**

```js
// test/ui/fonts.test.ts
test('the Hebrew cut is declared, not left to a fallback', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  assert.match(html, /font-family:\s*"IBM Plex Sans Hebrew"/,
    'Hebrew has no cut in Geist; without Plex the second language falls back to a system face');
});
```

- [x] **Step 4: Run it, watch it fail, implement, watch it pass**

- [x] **Step 5: Verify in a browser that all three families load**

```js
await document.fonts.ready;
document.fonts.check('14px "Geist"');              // true
document.fonts.check('14px "Geist Mono"');          // true
document.fonts.check('14px "IBM Plex Sans Hebrew"'); // true
```

**This only works because `font-src 'self' data:` landed in `563ff2e`.** Before that no font loaded at all.

- [x] **Step 6: Commit**

---

## Task 3: The eight primitives

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — primitive CSS, after the token block
- Test: `test/ui/primitives.test.ts` (create)

**Interfaces:**
- Consumes: every token from Task 1, `--sans`/`--mono` from Task 2.
- Produces: `.pane`, `.plate`, `.row`, `.lit`, `.blk`, `.chip`, `.rail`, `.hdr`, `.plane`, `.scene`.

- [x] **Step 1: Write the pane**

```css
.pane{position:relative;border-radius:12px;overflow:hidden;
  backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid var(--pane-edge);
  background:var(--pane-gloss),var(--pane-tint);
  box-shadow:var(--lift),var(--pane-lit)}
```

Two gradients and the order matters: gloss over tint. The tint thinning from `.56` to `.64` is what lets the corner nearest the light be seen *into* rather than merely lit.

- [x] **Step 2: Write the plane, with the hit-testing rule enforced**

```css
.scene{}                                   /* no perspective here */
.pair{perspective:1600px;perspective-origin:50% 42%}
.plane.l{transform:rotateY(3.2deg)}
.plane.r{transform:rotateY(-3.2deg)}
```

**Never `translateZ` with a negative value.** A `translateZ(-14px)` pushed panels behind their parent's plane and the parent intercepted every click — `elementFromPoint` at a row's own centre returned the container. The handler was never wrong; nothing could reach it.

- [x] **Step 3: Write the failing hit-test**

```js
test('a tilted pane is still clickable at its own centre', async () => {
  const el = await page.$('.plane .row');
  const r = await el.boundingBox();
  const hit = await page.evaluate(([x, y]) =>
    document.elementFromPoint(x, y).closest('.row') !== null,
    [r.x + r.width / 2, r.y + r.height / 2]);
  assert.equal(hit, true, '3D depth and clickability fight each other, silently');
});
```

- [x] **Step 4: Run it, watch it fail against a deliberately negative Z, then implement**

- [x] **Step 5: Write the row, the plate, the literal field, the chip, the rail, the header**

```css
.row{display:flex;align-items:center;gap:10px;inline-size:100%;padding:10px 12px;
  font:12.5px/1.3 var(--mono);color:var(--ink);
  background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer;
  transition:transform var(--dur-act) var(--ease),background var(--dur-act) ease,
             border-color var(--dur-act) ease,box-shadow var(--dur-act) var(--ease)}
.row:hover{transform:translateY(-3px);background:rgb(255 255 255/.06);
  border-color:rgb(255 255 255/.13);box-shadow:0 6px 16px rgb(0 0 0/.32)}
.plate{background:var(--plate);border-radius:9px;padding:12px 13px}
.chip{font:700 10px/1 var(--mono);padding:3px 7px;border-radius:3px;color:#0b0c11}
```

The static card is `.pane` with **no** `:hover` rule at all. **Stillness is how the interface says "not a control"** — do not give it a hover state for symmetry.

- [x] **Step 6: Wrap every transition in the reduced-motion guard**

```css
@media (prefers-reduced-motion:no-preference){ /* every transition lives here */ }
```
Structural, so the true default is static.

**As built, and the four things the plan got wrong.**

1. **`test/ui/primitives.test.ts` cannot host the Step 3 hit-test.** `page.$` /
   `page.evaluate` are Playwright fixtures; `e2e/mockup.ts` and
   `e2e/playwright.config.ts` both already explain why a Playwright spec
   cannot live under `test/` at all — `node:test` cannot run it, and
   `check:test-glob`'s file-count parity would either miss it or trip on it.
   The hit-test is `e2e/primitives.spec.ts` instead; `test/ui/primitives.test.ts`
   holds everything about the eight primitives a static scan of the
   stylesheet CAN prove (selectors defined, no negative `translateZ`
   anywhere, perspective only on `.pair`, `.pane` has no `:hover`, the row's
   transition sits only inside the reduced-motion guard, the chip base rule
   carries no `border`). Every one of those was verified red before green by
   temporarily mutating the mockup and reverting — the file diffs
   byte-identical to before each mutation.
2. **The negative-`translateZ` bug needs `transform-style:preserve-3d` to
   reproduce at all.** The first version of the "forbidden shape" control in
   `e2e/primitives.spec.ts` set `perspective` on the broken container and
   `translateZ(-14px)` on the broken plane, exactly as §7.1 describes, and
   the click still landed on the row — Chromium does not z-sort a transformed
   descendant against its ancestor's own box unless something in the chain
   opts into a shared 3D rendering context. Adding `transform-style:
   preserve-3d` to both the broken container and the broken plane reproduces
   the swallow. The real primitives never need this: they never use a
   negative `translateZ` in the first place, so preserve-3d is irrelevant to
   them — it only matters for faithfully re-creating the historical defect
   in an isolated control.
3. **`.pane`, `.rail` and `.chip` already existed, unowned by this task, with
   different jobs.** `.pane` was the item-detail aside's `grid-area`, `.rail`
   the nav sidebar's `grid-area`, both with their own legacy `background` /
   `border-inline-*`. Left alone, those two legacy rules — later in source
   order — would have silently outranked the primitive's material on exactly
   those properties, and the primitive would have shipped with no visible
   effect on either real element. Fixed by removing just those two
   declarations from each legacy rule (grid-area, overflow, padding
   untouched) so the shared `.pane,.rail,.hdr` rule's material wins cleanly.
   Verified in a real browser, not just reasoned about: screenshotted the
   rail and a forced-open item-detail pane before and after — no breakage,
   the pane now visibly reads as glass. `.chip` collides differently: its
   base rule sets no `border` and no bare `color`, so all 49 existing
   `.chip.gov/.ok/.warn/.crit` usages keep their border and colour from the
   higher-specificity modifier rule; only font-weight and font-family shift
   for now-un-repainted screens, confirmed by a zoomed screenshot of a real
   chip. The four-hue + shape (circle/square/diamond) variant system §3 #6
   asks for is genuinely unspecified by both the plan and the spec at the
   selector level, and is left unwired — inventing a naming scheme here
   would be proposing, not implementing, a ruling.
4. **`.hdr` is not bound to anything yet.** No element in the current DOM
   carries `class="hdr"` — the live top bar is still `.top`. §3 #8 gives the
   header's CONTENT ("git where the avatar would have gone... no account, no
   bell, no plan badge"), not its material; the shared `.pane,.rail,.hdr`
   rule extends primitive #1's "nothing in the product is a plain box" to it
   by inference, not by an explicit ruling on `.hdr` specifically. Flagged
   for the owner rather than silently assumed.

- [x] **Step 7: Gates, commit**

---

## Task 4: The `--faint` checker

**Files:**
- Create: `test/ui/faint-usage.test.ts`
- Modify: `docs/design/web-ui-mockup.html` if the check finds violations

**Interfaces:**
- Consumes: `--faint` from Task 1.
- Produces: nothing other tasks call. It is a gate.

- [x] **Step 1: Write the failing test**

```js
// --faint measures 3.83 on the glass. It clears the 3:1 large-text bar and
// fails the 4.5 body bar, so it is legal ONLY at large-text size.
// This is enforced rather than remembered: rules people are asked to remember
// are the ones this project keeps finding broken.
const LARGE_TEXT_MIN_PX = 18;      // or 14px at weight >= 700
test('--faint is never applied below large-text size', () => {
  const offenders = rulesUsing('--faint')
    .filter((r) => effectiveSizePx(r) < LARGE_TEXT_MIN_PX && effectiveWeight(r) < 700);
  assert.deepEqual(offenders, [],
    `--faint measures 3.83 and needs 4.5 at body size. Use --dim: ${offenders.join(', ')}`);
});
```

- [x] **Step 2: Run it. It must go RED on the current mockup** — if it is green immediately, the parser is not finding rules and the checker cannot fail. **A checker is not verified until it has been made red.** This project has found six that could never fail.

- [x] **Step 3: Fix every offender by moving it to `--dim`**

- [x] **Step 4: Run again — green. Then plant one violation and watch it go red again.** Report both messages.

- [x] **Step 5: Commit**

**As built, and the three things the snippet above got wrong.** The checker is
`scripts/check-faint-usage.ts` — a pure analyser plus a CLI report, the shape of
`check-text-files.ts` — and `test/ui/faint-usage.test.ts` is the gate that runs
it inside `npm test`. No eighth `npm run check:*` script was added, so the
seven-gate list is unchanged.

1. **`18` and `14` are POINT sizes.** WCAG's large text is 18pt, or 14pt when
   bold, which in CSS reference pixels is 24 and 18.66. The snippet's numbers
   would bless `--faint` on 14px bold text — 3.83 against a 4.5 requirement,
   which is the defect the checker exists to prevent. The shipped constants are
   WCAG's. Nothing had to be fixed differently: every offending rule sat at
   8-11px, so the offender set is identical under either threshold.
2. **The filter's `&&` exempts every bold rule at every size.** `size < 18 &&
   weight < 700` cannot fire on a 10px `font-weight:700` micro-label, and five
   of the ten offenders found were exactly that. Bold is not large text; the
   14pt allowance needs both halves.
3. **Non-text uses are not offenders.** Six of the sixteen `--faint` uses in
   the mockup are hatched backgrounds, borders and SVG strokes. Non-text owes
   3:1, which 3.83 clears, so a check on the token's NAME rather than on what
   it paints would have demanded six pointless edits.

**One thing for the owner, not for an implementer.** Spec §2.4 permits `--faint`
at "column headers, micro-labels, and anything at large-text size", but a 10px
uppercase column header is not large text under any definition — so applying
Step 3 as written moved all ten text uses to `--dim` and left `--faint` on
decoration only. The rule and the examples beside it disagree, and what is
shipped here is the rule. If the third ink step is meant to carry text, it is
the VALUE that has to move, not the checker.

---

## Task 5: Tabler icons, six glyphs

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — an inline `<symbol>` sprite
- Create: `src/ui/public/icons/LICENSE-MIT.txt`

**Interfaces:**
- Produces: `<use href="#i-refresh">`, `#i-copy`, `#i-open`, `#i-confirm`, `#i-search`, `#i-add`.

- [x] **Step 1: Extract the six from Tabler's outline set**

Tabler ships **real plain `.svg` files per icon**. Radix does not — its npm release ships zero, and an extraction script written against its compiled bundle spliced a neighbouring icon's path into two glyphs during evaluation. That is why Tabler was chosen; do not substitute.

**Done 2026-08-21.** Fetched verbatim from `github.com/tabler/tabler-icons` (`icons/outline/*.svg`, MIT): `refresh.svg`, `copy.svg`, `check.svg`, `search.svg`, `plus.svg`, and `external-link.svg` for `open` — Tabler has no icon literally named "open"; `external-link` is its closest semantic match (tagged "new tab / external / redirect" upstream) and is what `#i-open` uses. `check.svg` is tagged "confirm" and `plus.svg` is tagged "add" upstream, matching this set's names one for one. Each `<path d="…">` copied unmodified, source file traced to symbol id in the sprite's own HTML comment.

- [x] **Step 2: Inline them as a sprite, with `currentColor`**

```html
<svg style="display:none" aria-hidden="true">
  <symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</symbol>
</svg>
```

**Done 2026-08-21.** All six symbols added to `docs/design/web-ui-mockup.html`, right after `</style>` and before `<div class="app" id="app">`. Every `<symbol>` keeps `fill="none" stroke="currentColor"` unchanged from source, so colour comes from the consuming element's `color`, not a token defined here.

- [x] **Step 3: Mirror `open` under RTL, and only `open`**

```css
[dir="rtl"] .icon-open{transform:scaleX(-1)}
```
Of the six, **only `open` mirrors.** None of the eight libraries evaluated ships pre-mirrored variants, so this is ours to apply.

**Done 2026-08-21.** Rule added verbatim at the end of the `<style>` block. Verified in a real Chromium page (`deviceScaleFactor:6`): under `dir="rtl"`, `.icon-open` computes `matrix(-1, 0, 0, 1, 0, 0)`; all five other glyphs compute `none`.

- [x] **Step 4: Write the failing test that the sprite is complete**

```js
test('every icon referenced by a use element is defined in the sprite', () => {
  const used = [...html.matchAll(/href="#(i-[a-z]+)"/g)].map((m) => m[1]);
  const defined = [...html.matchAll(/<symbol id="(i-[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(used.filter((u) => !defined.includes(u)), []);
});
```

**Done 2026-08-21**, in `test/ui/icon-sprite.test.ts`, kept as written plus a second check the literal test above cannot fail on: at this point in the plan nothing yet writes a `<use>` (icons are wired into screens by Tasks 6 and 9), so `used` is `[]` and the used-vs-defined diff alone passes trivially whether or not the sprite exists. Added `'every one of the six spec glyphs has a symbol defined'` to carry the actual red-then-green: verified red by deleting `<symbol id="i-confirm">` (that test failed naming `i-confirm`; a symbol-count assertion in a fifth test failed alongside it) and by adding a stray `href="#i-typo"` (the plan's own test failed naming `i-typo`, nothing else did) — both reverted after, file diffed byte-identical to before the mutation.

- [x] **Step 5: Run, implement, verify at 14px and 16px in a browser, commit**

**Done 2026-08-21.** Rendered all six in real Chromium at `deviceScaleFactor:6`, both a 14px and a 16px container, plus the RTL row above. Screenshot inspected at magnification: refresh (two curved arrows), copy (two overlapping squares), open (box with an outbound corner arrow, mirrored correctly under RTL), confirm (checkmark), search (magnifying glass), add (plus) — six distinct, uncorrupted glyphs, none showing the Radix-style spliced-path defect.

---

## Task 6: The injection preview — the hero screen

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — the injection preview screen only
- Test: `e2e/runs.spec.ts` must still pass

**Interfaces:**
- Consumes: every primitive from Task 3, icons from Task 5.
- Produces: the composition pattern the other twenty screens copy.

- [x] **Step 1: Compose the two-plane layout**

Left plane: `.pane` holding `.row` items. Right plane: `.pane` holding `.lit` with `.blk` children. The rail persists outside both.

**Done 2026-08-21.** `.scene > .pair > .plane.l/.plane.r`, each `.plane` holding one `.pane` (`.pane.rows` on the left, `.lit.linked` on the right — `.linked` opts one `.lit` into the row-driven wiring so an unlinked `.lit` elsewhere stays fully opaque, per Task 3's own note that the opacity split is this task's wiring). The Event card and the "why not"/ribbon cards move from `.card.gloss` to `.card.pane`, the drop-in material swap: `.card` still carries layout (padding/margin), `.pane` now carries the glass. `.pair` only declared `perspective` (Task 3); arranging its two `.plane` children side by side is added here as the screen's own layout, the same split Task 3 left for the row's selection state.

- [x] **Step 2: Wire the linkage — selecting a row lights its block**

This is the screen's whole job, and the reason the row is allowed to move: *you are never looking at a rule without seeing the text it produced, and never looking at injected text without seeing which rule produced it.*

Dim non-selected blocks to **`opacity:.58`**, not lower. At `.32` two items cannot be compared.

**Amended 2026-08-22, and the original ruling matters.** The owner ruled `.42` in the browser, and `.42` shipped. Reviewing the rendered page afterwards found what the ruling could not: `opacity` dims the block's TEXT along with its presence, and `.42` composited over the plate measures **~3.6:1**, under the 4.5:1 body-text floor this direction holds everywhere else. `.58` measures **~5.1:1** and still reads as clearly de-emphasised beside a selected item at full opacity. The number moved; the ruling behind it — *far enough to recede, not so far that two items cannot be compared* — did not. `e2e/injection-preview.spec.ts` pins `0.58` and its header carries this reason, so nobody restores `.42` from a document and quietly reintroduces a contrast failure.

**Done 2026-08-21.** Four of the five "Delivered" items (the ones with real body text) became `.row`/`.blk` pairs keyed by `data-choice`/`data-for`; `.row[aria-pressed="true"]` completes the primitive's own contract (reuses `:hover`'s exact look, unconditionally, so the state survives reduced motion) and `.lit.linked .blk.sel{opacity:1}` against a `.42` default does the dimming. The fifth item — `ADR-markdown-plus-disposable-index`, carried/index-only, no body text exists for it in `ITEMS` — is deliberately **not** forced into the linkage; a rationale-tier item structurally has no "text it produced" to show. It stays visible as a sibling of the `preview.carried` paragraph (never nested inside it — nesting would hit the exact defect `e2e/language.spec.ts` pins against, a badge destroyed by `applyLang`'s wholesale child replacement on a `data-t` element). This also preserves the pinned "twelve PROPOSED badges" e2e count untouched. Also composed: the prefix ruling (`.idkind`/`.idslug`, kind keeps `--ink`, slug drops to `--dim`, one inline parent so the id copies whole) and the sprite's first consumer — `#i-open` on each `.blk`'s id, since clicking it opens the item's full detail via the existing `.linkid`/`openPane` delegate, needing no new string key (the button's own visible text is its accessible name; the glyph is `aria-hidden`).

- [x] **Step 3: Verify the linkage in a browser, not by reading the CSS**

```js
await page.click('[data-choice="b3"]');
// selected row lifts, its block reaches opacity 1, siblings drop to .58
```

**Done 2026-08-21**, in `e2e/injection-preview.spec.ts` (new — `e2e/runs.spec.ts` has no hook for a screen-specific interaction, and `e2e/primitives.spec.ts` is scoped to the generic forbidden-shape control, per its own header). Two tests: (1) `elementFromPoint` at a tilted row's own centre resolves to that row's `data-choice`, hit-testing the real `.pair`/`.plane` 3D context this screen actually uses, not a synthetic fixture; (2) clicking a row asserts exactly one `aria-pressed="true"`, a non-`none` computed `transform` on it, the paired block's computed opacity is exactly `1`, and every other block's is exactly `0.58`. Also verified by hand in a real browser (a throwaway static server, since `file://` is blocked for the MCP browser tool): screenshotted before and after a click, watched the selected row lift and its block light while the other three visibly dim.

**One thing found and fixed while building this, outside the task's stated scope but load-bearing for it:** `--ground` (Task 1) was defined and never consumed anywhere in the sheet — `body` was still painting the legacy flat `--paper`. Screenshotting the live page showed a flat, colourless screen; the glass had nothing to admit, which is §2.3's entire argument for tinting it dark. Wired `body{background:var(--ground)}` once, globally, since §2.1 states the ground is "used identically on all 21 screens" — a per-screen fix would have been wrong. Re-ran every gate after; nothing else referenced `--paper` (`grep` confirms), and the print media query already overrides `body`'s background later in source order, so `e2e/print.spec.ts`'s white-background assertion is unaffected.

- [x] **Step 4: Gates including e2e, commit. STOP HERE for owner review** — this is the screen the direction is judged on, and nineteen more depend on it.

**Gates**, run three times (before and after the `--ground` fix, then again after fixing the flake below), all green: `npm test` 3507/3507 pass (0 fail, 2 skipped, matching the two documented pre-existing skips), `npm run typecheck` clean, `npm run check:text-files` 552 files/0 NUL bytes, `npm run check:retired` 104 phrases/0 present, `npm run check:test-glob` reaches all 214 test files, `npm run verify:citations` 0 broken/0 fault, `npm run test:e2e` **25 passed** (master's 21 + `e2e/primitives.spec.ts`'s 2 from Task 3 + this task's 2 new — derived by running the suite, never hand-pinned).

**One flake in the new suite, found and fixed, not one of the two documented pre-existing ones.** The linkage test's first draft took a single `getComputedStyle` snapshot immediately after `click()`; `.blk`'s opacity animates over `--dur-act` under `prefers-reduced-motion:no-preference` (the browser's default), so the snapshot sometimes raced the transition and read the pre-click `.42` for the item that had just been selected — "Expected: 1, Received: 0.42". Rewritten with Playwright's polling `toHaveCSS`/`toHaveAttribute` assertions, which wait on the actual end state rather than a fixed sleep; confirmed with 5 repeated standalone runs and a full parallel `npm run test:e2e` run, all green.

**Where the three deliberately-unresolved items showed, composing around them rather than resolving them:**
1. **The chip variant system.** Every chip on this screen — `pinned`, `jit`, `carried` — kept its exact pre-existing `.chip.gov`/`.chip.ok` legacy class and glyph (`◆`/`●`/`◇`). No shape/hue invention. The absence shows as: colour is still the only channel: a colour-blind reader distinguishes `pinned` from `jit` by the glyph already in `data-g`, not by a shape primitive.
2. **`.hdr`.** Untouched. The top strip is still `.top`, still outside this task's file scope note ("the injection preview screen only"). The absence shows as: the header is the one piece of chrome on this screen that is not yet glass, sitting directly above panes that now are.
3. **`--faint`.** Not used anywhere in this task's additions — every new text is `--ink` (`.idkind`) or `--dim` (`.idslug`, `.blk` body text, the small labels), verified by `npm test` staying green (the checker would have named the rule if not).

---

## Task 7: The plate across the data views

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — the 18 graphical views

**Interfaces:**
- Consumes: `.plate` from Task 3.

- [x] **Step 1: Write the failing test**

```js
test('every data view sits on a plate', () => {
  const views = ['#ribbon', '#coverage', '#relations', '#comb', '#stream', /* …18 */];
  const naked = views.filter((v) => !closestHasClass(v, 'plate'));
  assert.deepEqual(naked, [],
    'text may float on glass; data may not — the ground shows through the marks');
});
```

**As built, and why the plan's own sketch could not run as written.** `closestHasClass`
assumes a DOM; this project ships no HTML/DOM parser (`package.json` has none) and a
Playwright page cannot live under `test/` — `primitives.test.ts`'s own header explains
why (`node:test` cannot run it, and `check:test-glob`'s file-count parity would catch
the mismatch). `test/ui/plate-usage.test.ts` instead walks a real tag-nesting stack
over the markup between `</style>` and the real `<script>`, tracking which open
ancestor (if any) carries `class="plate"` at the point each target id appears.
**Verified red before trusted green**, per this project's own rule that "a checker
that has never been red is not a checker": eight synthetic-markup controls first
(exact-element match, two-level ancestor match, no-ancestor miss, a CLOSED sibling
plate wrongly counted, multi-token class match, substring-vs-token rejection, a
missing id failing loudly rather than passing by absence, and a void `<input>`
proven not to desync the stack), then the real file with `#ego`'s `class="plate"`
mutated out by hand — confirmed red with the exact id named in the failure message —
and reverted to byte-identical.

**The eighteen, resolved by evidence rather than guessed.** The plan's own sketch
names five illustrative ids (`#ribbon`, `#coverage`, `#relations`, `#comb`,
`#stream`) that do not exist verbatim in the mockup — no id is `ribbon`,
`coverage`, `relations` or `stream` anywhere in the file. Read as a real
enumeration instead of illustration: the script's own "RESTORED GRAPHICAL VIEWS"
section carries eighteen numbered `── N ·` view comments (1–5, 7–10, 12–15, 17–18)
across its helper functions, and three further ids are filled by sibling render
functions sharing the same helpers and the same job (`renderDet` — coverage
detail, named explicitly in the ui1 Task 18 reconciliation note; `renderAudit`;
`renderQ`) plus `paneSpark` (the item-detail aside's delivery sparkline). That
reading lands on exactly eighteen: `#gates`, `#ribbons` (hero); `#tree`, `#det`
(coverage); `#stair`, `#ladder`, `#simtbl`, `#ratio` (simulate); `#pulse`, `#atbl`
(audit stream); `#qres` (ask); `#comb`, `#heat` (decay); `#ego` (relations);
`#globtree` (composer); `#cfgdelta`, `#spout` (configure); `#panespark`
(item-detail aside, cross-screen). Segmented CONTROLS beside these views
(`#tierPick`, `#gatepick`, `#spbar`, `#asktabs`, `#wfilters`) are excluded — a tab
strip selects, it does not display a quantity. Static reference tables carrying no
computed quantity (doctor's findings, the gaps list, injected-now, work's diff,
status's counts, and the port/packs/tut/docs/learn screens) are also outside this
eighteen; see the Task 7 report for the standing question of whether any of them
should move too.

**Two of the eighteen are `<tbody>` targets inside a `<table>`, so the table itself
is wrapped in a new `<div class="plate">` (`#atbl`, `#qres`; `#simtbl` likewise).
The other fifteen are empty leaf `<div>`s the script fills — `class="plate"` is
added directly to the existing element (`plate` appended where the div already
carried a class, e.g. `class="tree plate"`, so nothing already on it is lost).

- [x] **Step 2: Run it red, wrap each view, run it green** — done; see above.

- [x] **Step 3: Verify the reason it exists** — sample a gold ribbon segment's rendered pixel at two positions on one screen. Before the plate they differ; after, they match. **A quantity whose colour cannot be trusted is not a quantity.**

**Done in a real (headless Chromium) browser**, not reasoned about — `file://` is
blocked for the MCP browser tool, same constraint Task 6 hit, so this used the
project's own installed `@playwright/test` directly via a throwaway script (not
committed). A standalone fixture reproduced `--ground`, `.pane` and `.plate`
verbatim from this file, with `#tree`'s actual `.mini i.u{background:var(--warn);
opacity:.34}` magnitude-bar mark (genuinely translucent, not a solid swatch)
placed once inside the ground's purple hotspot (radial centre 14%,6%) and once
inside its teal hotspot (88%,92%), with and without `.plate`. Sampled 1×1-pixel
screenshots at each swatch's centre: **without** `.plate`, the same mark measured
RGB(93,71,70) at the purple position and RGB(77,76,55) at the teal position — a
Euclidean distance of 22.5, a real hue shift, not noise. **With** `.plate`, the
same two positions measured RGB(75,56,36) and RGB(72,59,35) — distance 4.4, about
five times tighter. Not exactly zero: `--plate` (`rgb(6 7 11/.72)`) is itself 72%
opaque, not 100%, so a small residual of the pane's own backdrop-blurred ground
still shows through — expected given the token as defined, and still a five-fold
tightening. Confirmed visually too: a full-page screenshot shows the unplated
swatches reading as visibly different hues (mauve-brown vs. olive) while the
plated pair both read as the same warm amber-brown.

- [x] **Step 4: Commit**

---

## Task 8: Transitions

**Files:**
- Modify: `docs/design/web-ui-mockup.html`

- [x] **Step 1: Navigation — the rail persists, content crossfades at `--dur-nav`**

Nothing travels horizontally. **A crossfade has no axis to get wrong**, which is why Hebrew costs nothing here — `translateX` is not a logical property and `dir="rtl"` never mirrors it.

**Done 2026-08-22.** `go()` (unchanged) still just flips `hidden` on every `[data-p]` synchronously; the crossfade is wired entirely in CSS against that existing attribute, no JS touched. `[data-p][hidden]{opacity:0}` is the unconditional STATE (survives reduced motion, same shape as `.row`'s primitive); the ANIMATION — `transition:opacity var(--dur-nav) var(--ease),display var(--dur-nav) allow-discrete` plus the `@starting-style` block that gives a hidden→visible flip a "before" frame to animate from at all — lives only inside `@media screen and (prefers-reduced-motion:no-preference)`. Both are additionally scoped to `@media screen`: `@media print` above already owns `[data-p]`'s `display` with its own `!important` rules, and a leaked `opacity:0` would print invisible ink on the one screen print still renders (checked against `e2e/print.spec.ts` before landing, not assumed safe — it stayed green, twice).

**One thing the plan did not anticipate, found while wiring this.** `display:none→block` and `block→none` keep the OUTGOING and INCOMING screen simultaneously un-hidden for the ~180ms both are mid-transition. `[data-p]` sections are plain block siblings under `.body`, so without a stacking fix the incoming screen laid out BELOW the outgoing one instead of over it — a jump, not a crossfade. Fixed with `.body{display:grid}` / `.body>[data-p]{grid-column:1;grid-row:1}`, both inside the same `@media screen` block. This is layout, not a `transition`/`animation` declaration by the letter of the task split — flagged here rather than silently treated as in-scope, but implemented rather than reported, because without it "crossfade" was not actually true: the two screens never occupied the same box to fade between. Confirmed inert outside the transition window: a `[hidden]` pane is `display:none` and never occupies a grid track, and with motion reduced no two panes are ever simultaneously un-hidden in the first place — `go()`'s `forEach` flips every `hidden` attribute in one synchronous pass, so there is no frame in between for a viewer, or for this grid rule, to see.

**Verified past the gates, in a real Chromium page, not just by reading the CSS.** A throwaway script (`chromium.launch()`, not the pinned e2e suite) sampled `getComputedStyle` opacity on a fresh page per sample point after clicking `.nav[data-s="coverage"]`: 20ms → `0`, 60ms → `0`, 90ms → `0.979`, 120ms → `0.991`, 160ms → `0.999`, 200ms+ → `1` — a smooth `cubic-bezier(.23,1,.32,1)` climb landing at the `--dur-nav` (180ms) mark, front-loaded exactly as that curve's control points (`.23,1` / `.32,1`) predict. `getBoundingClientRect()` for the outgoing and incoming screen matched exactly (`top`/`left`/`height` identical) mid-transition, confirming the grid stack overlaps them rather than stacking them. **Caution for whoever writes screen-transition assertions next (Task 9/12):** repeatedly polling `getComputedStyle` on the SAME long-lived page during this transition (rather than one query per fresh page) reads back a value stuck at the `@starting-style` value the entire time instead of progressing — an automation/CDP artifact of forced synchronous style recalculation racing `@starting-style`, not a real rendering bug (the single-query and screenshot checks above both resolve correctly). Any test against this transition must poll for the end state via Playwright's own polling assertions (`toHaveCSS`, etc.), exactly per Task 6's flake note — never a bare `getComputedStyle` snapshot, and this file's own throwaway script is itself a demonstration of why not.

- [x] **Step 2: Retiming — segments travel to their new widths at `--dur-retime`**

```css
.rib u{transition:inline-size var(--dur-retime) var(--ease)}
```

**The movement is the information** — you see *which* tier gained and which collapsed, which a redraw hides. This is the one deliberate exception to "motion signals affordance".

**Done 2026-08-22, adapted to the real selector.** `.rib`/`u` do not exist anywhere in the file — the actual four-tier budget ribbon's segments are `.track .seg` (built by `renderRibbons()`, driven by `#evsel`). Added `.track .seg{transition:inline-size var(--dur-retime) var(--ease)}`, gated the same way as every other primitive transition: inside `@media (prefers-reduced-motion:no-preference)` only, the segment's width itself (set via `isz()`'s `element.style.setProperty('inline-size', …)`, already logical, already CSSOM per the file's own CSP note) is the unconditional state.

- [ ] **Step 3: Verify by measurement, not by eye** — **blocked, not done, reported rather than faked.**

```js
// before: jit segment 243px → after event change: 20px → after another: 416px
```

**This transition is wired and inert.** `renderRibbons()` calls `host.replaceChildren()` and rebuilds every `.seg` from scratch on every `#evsel` change (`docs/design/web-ui-mockup.html`, the `renderRibbons` function, `.track` built fresh each call). A CSS `transition` animates a property change on one persisting element; a brand-new element has no "before" value to animate from, so today the ribbon still redraws exactly as before — the transition rule fires on nothing. Producing the plan's own verification numbers (243px → 20px → 416px on the *same* segment) requires `renderRibbons()` to key its `.seg` nodes (by tier + candidate id, the same identity `fitFirstFit`/`CANDIDATES` already carry) and reuse them across a re-render instead of wiping the host — that is JS render-logic inside a data-view's own rendering function, not a `transition`/`animation` declaration, and it sits inside the same function repaint-7 owns as "the data views." Flagged for repaint-7 or a follow-up task rather than edited here, and Step 3 is left unchecked rather than fabricating a before/after measurement that the current wiring cannot produce.

- [x] **Step 4: Commit**

---

## Task 9: The remaining twenty screens

**Files:**
- Modify: `docs/design/web-ui-mockup.html`

Split across four commits by rail group so a reviewer can reject one group without rejecting all twenty.

- [x] **Step 1: Injection group** — scope coverage, coverage gaps, budget simulator, injected now

**Done.** The `.card.gloss` → `.card.pane` material swap (8 sites), the same drop-in
substitution Task 6 already used on the hero — `.card` keeps the layout, `.pane`
supplies the glass. **One real collision found and fixed, not just a class-name
question:** `#covfull .two{display:grid;grid-template-columns:1fr 1fr}` lays the
"Repository" and "What governs" cards out as CSS Grid items, and the legacy
`.pane{grid-area:pane;…}` rule (written when the item-detail aside was the only
element carrying bare `.pane`, per Task 3's own note that its structure was left
"untouched") now matches every `.card.pane` too — both cards resolved the
unrelated named line `pane` and collapsed onto each other at full width, one over
the other. `e2e/states.spec.ts` caught it as a hard click-timeout on the file-tree
`role="treeitem"`, not as a visual glitch; a synthetic-markup check first reproduced
it against master (test passed clean on unmodified HEAD, confirming the patch was
the cause) before the fix. Rescoped that whole legacy block from `.pane` to `#pane`
(the aside's own unique id), which also silently fixes a second, already-shipped
defect on Task 6's hero: `.pane h3` (later in source than `.card>h3`, same
specificity) had been overriding every card heading's font-size/margin from
`--fs-0`/`--sp-2` to `--fs-2`/`--sp-1` since Task 6 landed — confirmed by
`getComputedStyle` before (16px/4px) and after (13px/8px) the rescoping. Verified
in a real Chromium page (`chromium.launch()`, file:// — the MCP browser tool
blocks it, same constraint Tasks 6-8 hit): screenshots of all four screens in
English and one in Hebrew, side-by-side cards no longer overlapping, tree item
clickable again. Full `npm run test:e2e` 25/25 green.

- [x] **Step 2: Evidence group** — audit stream, ask, doctor, decay, relations, status

**Done.** Same `.card.gloss` → `.card.pane` swap, 9 sites across six screens (audit
stream 1, ask 1, doctor 3, decay 2, relations 1, status 1). No new legacy
collision — none of these screens lay their cards out in a CSS grid the way
coverage's `.two` did, so Step 1's `#pane` rescoping was the fix this group
needed too, not a new one. Verified in a real Chromium page: all six screens
screenshotted in English, cards rendering as glass with no overlap; ask's nested
flat "query this composed" sub-card (deliberately `background:var(--sunk)`, not
`.pane` — a card-in-a-card would be glass-on-glass, which no primitive calls
for) still reads correctly against its now-glass parent. `npm run test:e2e`
25/25.
- [x] **Step 3: Change group** — review queue, capture, composer, configure, procedures, export/import, template packs

**Done.** Same swap, 16 sites across the seven screens (work 1, capture 1,
palette 1, config 4, proc 3, port 3, packs 3). This group is where the `.two`
grid layout the Injection group's coverage screen surfaced is most common —
config, proc, port and packs each lay two cards out side by side in it. All
four screenshotted and confirmed rendering as two non-overlapping glass panes,
confirming the `#pane` rescoping from Step 1 generalises rather than being a
one-off patch for coverage specifically. `npm run test:e2e` 25/25.

- [x] **Step 4: Read group** — documentation, tutorials, learn

**Done.** Same swap, 4 sites (docs 2, tut 1, learn 1) — docs' Contents/rendered-
README pair is the group's own `.two` grid, screenshotted and confirmed as two
non-overlapping glass panes. `grep -c 'class="card gloss'` across the whole
file is **0** after this commit: all 37 sites Task 9 owned are `.card.pane`,
the same primitive the hero (Task 6) already used for its 4. `npm run
test:e2e` 25/25.

- [x] **Step 5: After each, run `npm run test:e2e` and confirm every screen still renders in both languages**

**Done, after all four groups.** `npm run test:e2e` run and green (25/25) after
every one of the four commits above, not only at the end. Every-language
rendering is exercised by `e2e/runs.spec.ts`'s two "every screen renders"
specs (English and Hebrew) plus `e2e/language.spec.ts`'s round trip, all in
that same 25 — not a separate manual pass per screen. Manual browser
verification (screenshots, both languages) was done per group and is recorded
in Steps 1-4 above, since e2e proves the page runs clean and un-hidden, not
that the intended material is what actually painted — Step 1's grid collision
is exactly the kind of defect e2e's `runs.spec.ts` cannot see (the screen
"renders clean," it is simply two panes occupying one rectangle) and only a
real click (`states.spec.ts`) or a screenshot caught.

**Corrected while implementing:** Step 3's own list omits **Template packs** —
the rail's own `.grp` markup (`<!-- ══ rail: three groups by tense … ══ -->`,
itself stale too — there are four groups, not three) has seven buttons in the
Change group (`work`, `capture`, `palette`, `config`, `proc`, `port`, `packs`),
not six. 4 (Injection) + 6 (Evidence) + 7 (Change) + 3 (Read) = 20, matching this
task's own title; the plan's list without `packs` only reaches 19. Added it above
rather than silently including it in Step 3's commit without a paper trail.

---

## Task 10: The print register

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — `@media print`
- Modify: `e2e/print.spec.ts`

- [x] **Step 1: Write the failing test — print from dark**

**Done.** `e2e/print.spec.ts`'s per-screen loop now also asserts the nine print-
register custom properties (`--ground`, `--ink`, `--dim`, `--faint`, `--gold`,
`--ok`, `--warn`, `--crit`, `--carry`) read off `:root`, plus one rendered
element's actual computed colour (`.psub`, the screen's own subtitle) — the
check `bodyBg`/`bodyColor` alone could not do, since a token can be declared
correctly while nothing still reads it. Written and run red against the
unmodified file first (every `--token` assertion failed, reporting the
screen's own light values), confirming it was the tokens and not the body
that had to move; green after Step 2's register landed.

- [x] **Step 2: Design a printed register rather than converting the screen**

**Done.** The register lives entirely inside `@media print{ :root{…} }` as
~24 custom-property overrides (ground, the three ink steps, all five meaning
hues, the pane/plate/glass tokens), because every rule in the file already
paints through `var(--token)` — no selector-by-selector repaint needed, and
`--goldbg`/`--okbg`/`--warnbg`/`--critbg`/`--carrybg` re-resolve for free
since they are themselves `color-mix(in oklch, var(--gold) 12%, var(--panel))`
etc. On top of the token layer: `.pane,.card` lose the glass (backdrop-filter,
box-shadow, gradient fills) for a plain hairline border — this also fixes a
latent bug the old `.pane{border:0}` rule had (it removed the pane's only
boundary and leaned on `--pane-edge`, a near-white line, to stay visible on
white paper, which it never did — the item-detail aside printed with no
outline at all); `.plate,.lit` drop their opaque fill for the same hairline,
per "the plate as a hairline rule"; `.chip` drops colour entirely for a black
border/label, relying on the `::before` glyph (`content`, not `fill`) for the
five-hue distinction paper cannot carry; and the 3.2° `.plane` tilt is
flattened (`transform:none`), since a screen-only appraisal cue reads as a
rendering defect at an angle on a static page.

- [x] **Step 3: Measure — 21 screens, both languages, printed. Report the failure count.**

**Done.** See the task report for the harness and numbers: 889 EN + 829 HE
per-element occurrences (57 / 47 unique fg/bg/threshold triples) before, 0
after, both languages, all 21 screens, under print media emulation.

- [x] **Step 4: Commit**

---

## Task 11: The two degraded registers — High Contrast, and reduced transparency

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — `@media (forced-colors: active)` and `@media (prefers-reduced-transparency: reduce)`

- [x] **Step 1: Confirm the finding by measurement**

**The glass does not survive High Contrast.** `backdrop-filter`, both tint gradients and the layered shadow are stripped or overridden. Measured during the icon evaluation.

**Done 2026-08-22 — re-measured in a real Chromium (Playwright `forcedColors:'active'`) against the file as it stood before this task's CSS existed.** Confirmed: both `--pane-gloss`/`--pane-tint` gradients strip to `background-image:none` with no `background-color` to fall back to (the pane goes fully transparent, not merely dimmed) and `box-shadow` strips to `none`. **Corrected in the process:** `backdrop-filter` is NOT auto-stripped — it measured unchanged (`blur(20px) saturate(1.4)`) — so it has to be dropped explicitly in both registers, not assumed away.

- [x] **Step 2: Declare a register rather than letting the browser improvise**

`.pane` → `Canvas` with a `CanvasText` border. `.plate` → `Canvas` with a hairline. Chips keep their `::before` glyph, which is `content` and therefore not forced. **SVG `fill`/`stroke` are NOT force-adjusted in Chromium** — restate them by system colour name.

**Done 2026-08-22.** `.pane,.rail,.hdr{background:Canvas;border-color:CanvasText;box-shadow:none;backdrop-filter:none}` — `.rail` and `.hdr` included, not `.pane` alone: both joined the shared material rule on 2026-08-22 (after this task was written), so both share the same failure and need the same fix. `.plate,.lit{background:Canvas;border:1px solid CanvasText}` — `.lit` included too, since it consumes the same `--plate` token and has the same missing-border problem. `symbol[id^="i-"]{fill:none;stroke:CanvasText}` restates the six icon glyphs. Chips needed no CSS change: `::before{content:"◆ "}` etc. measured present, verbatim, under forced-colors. **Corrected in the process:** the six icons' `stroke="currentColor"` already measured a correctly-forced stroke via the inherited, forced `color` — not literally invisible today — but restated anyway per this step's own instruction, since that is the more robust contract to build to.

- [x] **Step 3: Verify the tier ribbon still distinguishes four tiers** — under forced-colors the segments previously collapsed to one visual state. Patterns survive; `repeating-linear-gradient` is a `background-image` and does.

**Done 2026-08-22 — and this step's own premise measured false.** Verified first: yes, `.seg.pinned/.jit/.restored/.index` still collapse to an identical `rgb(255,255,255)` background with no image. But **`repeating-linear-gradient` does NOT survive forced-colors** — measured `background-image:none` on every existing hatch pattern already in the file (`.ghosts .gh`, `.notrun`, `.mini i.x`, `.div-r i`, `.tokvoid`), no different from a plain gradient. `border-style` (dashed/dotted/double) is not on Chromium's forced list and measured unchanged in the same test, so the fix uses that instead: `.seg.pinned{border-block:3px solid CanvasText}`, `.jit` dashed, `.restored` dotted, `.index` double — confirmed rendering as four visually distinct patterns (screenshot, `deviceScaleFactor:3`) and asserted in `e2e/degraded.spec.ts`.

- [x] **Step 4: Honour `prefers-reduced-transparency: reduce`**

Carried from review 2, which recorded it as unhonoured and which this plan otherwise replaces. **A person who has asked their system for less transparency has asked for exactly the thing this direction is built out of**, so the answer cannot be to ignore it.

The register is the smallest honest one: `--pane-tint` and `--plate` go fully opaque, `backdrop-filter` is dropped, and **nothing else changes** — the ground, the type, the lift and the icons all stay. Test that `.pane` computes an opaque background under the query.

```css
@media (prefers-reduced-transparency: reduce){
  :root{--pane-tint:linear-gradient(133deg,#12141c 0%,#101219 100%); --plate:#06070b}
  .pane{backdrop-filter:none;-webkit-backdrop-filter:none}
}
```

**Done 2026-08-22 — implemented as written, with one correction.** The snippet above resets `.pane` alone; by 2026-08-22 `.rail` and `.hdr` had joined the same shared material rule (`.pane,.rail,.hdr`) and consume the identical `backdrop-filter`/`--pane-tint`, so resetting `.pane` only would have left the header and nav rail still blurring the ground while every card went opaque — a half-applied register. Implemented as `.pane,.rail,.hdr{backdrop-filter:none;-webkit-backdrop-filter:none}`. Verified in a real Chromium via CDP `Emulation.setEmulatedMedia`: `matchMedia('(prefers-reduced-transparency: reduce)').matches` is `true`, `.pane`/`.rail`/`.hdr` all compute an opaque `background-image` (`rgb(18, 20, 28)…rgb(16, 18, 25)`, no alpha) and `backdrop-filter:none`; `--plate` computes `rgb(6, 7, 11)`, opaque; `box-shadow` (the lift) measured byte-identical to the unedited baseline. Asserted in `e2e/degraded.spec.ts`.

- [x] **Step 5: Commit**

---

## Task 12: Re-measure, and derive the pinned counts

**Files:**
- Modify: `e2e/bidi.spec.ts`, `e2e/language.spec.ts`

- [ ] **Step 1: Re-measure every token against the finished screens**

Sample from **rendered pixels** with the blur, glass and ground composited — not `getComputedStyle` strings. A previous harness produced 645 fake failures by parsing `light-dark()` through a canvas.

- [ ] **Step 2: Confirm the range collapsed**

`--dim` must measure the same everywhere, not 4.37 in one place and 6.28 in another. **That is what dark glass bought**, and it means a token can be tested once rather than per position.

- [ ] **Step 3: Derive the three pinned counts, do not re-pin them**

`bidi.spec.ts` pins 382 `[data-t]` elements and 221 `.m` runs; `language.spec.ts` pins 11 `data-t-aria`. Compute them from the file the way `strings-parity.test.ts` does. **A test that remembers a number fails for the wrong reason the next time a screen gains a label.**

- [ ] **Step 4: Bound the cost of the blur**

Also carried from review 2: `backdrop-filter` is expensive and **the coverage map already has a measured performance problem**. Every `.pane` now declares one. Measure the coverage screen before and after with a Playwright trace; if the repaint makes an already-slow screen slower, say so in the commit message with both numbers rather than discovering it later. The fix, if one is needed, is `backdrop-filter` on the rail and the header only — not on every pane in a list.

- [ ] **Step 5: Full gates, commit**

---

## Task 13: Reconcile the planned UI tasks with the new direction

**Files:**
- Modify: `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` (ui1 tasks 16–20)
- Modify: the ui2 plan (14 tasks) and the ui3 plan (15 tasks)
- Modify: the corresponding `task` items in `.my_context/items/task/`

**Why this task exists.** Thirty-one open UI tasks were planned against a warm-paper mockup with a light theme, a different token set, and no plate. The adversary measured the blast radius of a direction change: **12 rewritten by name, 6 disturbed, 13 untouched** — the untouched ones being server-side. Leaving them stale means every one of those twelve is executed against a document that describes a product that no longer exists, and the first agent to notice will be the one halfway through building the wrong thing.

- [x] **Step 1: Enumerate, do not estimate**

```bash
cd D:/Users/UserC/source/repos/test_mycontext_plugin
node my-context/src/cli/index.ts search --type task --tag plan:ui1 --tag state:todo
# repeat for plan:ui2 and plan:ui3
```
Run every mycontext command from the **outer repo root** — `my-context/` carries its own corpus and will answer instead.

**Done 2026-08-21.** `--tag` accepts one value per this build (`search --tag plan:ui1` then filtered locally on the `state:todo` tag, since the two-`--tag` form above is refused: `--tag was given 2 times… pass it once`). Enumerated 31 open items exactly: ui1 5 (tasks 16–20), ui2 13 (tasks 2–14), ui3 13 (tasks 1–13).

- [x] **Step 2: Classify each open task into exactly one of three**

- **Untouched** — server-side, read models, wiring. The direction never reaches it.
- **Disturbed** — references a token, a colour or a theme in passing. One-line corrections.
- **Rewritten** — its subject is a screen's appearance. Its steps describe the old material.

**Done 2026-08-21.** Every open task's section was read in full and grepped against the mockup's retired
tokens, `theme`/`light-dark`/`paper`, hardcoded hex, icon-library and CSS-class signals. Result: **22
untouched, 0 disturbed, 9 rewritten** — see Step 8.

- [x] **Step 3: For every rewritten task, correct the plan text, not just the item**

The item body says *"the full specification is the task section itself"* — so the plan is the authority and the item tracks state. **Correcting the item alone leaves the authority wrong**, which is the failure mode this project has hit repeatedly.

**Done 2026-08-21.** All 9 rewritten tasks' sections were edited in `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` (Tasks 16–19), `…-2-palette-and-work.md` (Tasks 11–13) and `…-3-watch-and-ask.md` (Tasks 11–12): blockquote reconciliation notes plus in-place code corrections (hardcoded hex colours, retired token names, retired utility classes). Each corresponding item's body and tags were also updated (`reconcile:rewritten` + a one-line note), so item and plan agree.

- [x] **Step 4: Delete what the direction has made obsolete**

Any step that says *light mode*, *`light-dark()`*, *theme toggle*, or *warm paper* is now false. A step that is false is worse than a step that is missing: the missing one gets noticed.

**Done 2026-08-21.** The one concrete instance found — ui1 Task 16's `#theme` button, in both its mockup-binding blockquote and its HTML shell sample — is removed and replaced with a note naming why (dark only, no toggle). No other open task named light mode, `light-dark()`, a theme toggle or warm paper by those words; the rest of the drift was retired hex values and retired token/class names rather than theme-toggle language, corrected task by task (Step 3).

- [x] **Step 5: Add the citation from each rewritten task to this plan and to the spec**

So an executor reading a screen task finds the material definition without being told to look for it.

**Done 2026-08-21.** Machine-checked citations (`` `file` · `fragment` · ~line ``) were added in ui1 Tasks 16, 17, 18 and 19, pointing at this plan's Task 1 (styles.css gap), Task 6 (hero pattern), Task 7 (plate rule), Task 11 (SVG forced-colors) and the spec's §6 (icon glyphs). ui2 and ui3's rewritten tasks carry the same cross-references in prose rather than the strict citation form, naming the exact repaint task and spec section each correction rests on. `docs/design/web-ui-mockup.html` itself is never cited in the checked form — `.html` is not one of `verify-citations.ts`'s citable extensions, so every mockup reference in these three plans has always been informal, repaint or no repaint.

- [x] **Step 6: Run `npm run verify:citations`**

Expect breakage — these plans quote the mockup heavily and Tasks 1–9 moved most of what they quote. Repair **both halves**: the anchor, and the claim beside it. A re-anchor walks straight past a sentence that has gone false.

**Done 2026-08-21 — no breakage found.** Tasks 1–9 of this plan have not yet landed in this worktree (the mockup still carries its pre-repaint `light-dark()` token block), so the anticipated breakage does not exist yet here; citations that quote the current mockup for **structure** (ids, `data-p` values, string keys) remain accurate under the repaint, which touches material only. Ran clean before and after this task's edits: **701 citations, 0 broken, 0 ambiguous, 0 marker faults** (baseline was 696/0 broken; the 5 added are this task's own, all resolving `ok`).

- [x] **Step 7: Rule on whole tasks, not only on steps**

Some tasks may be obsolete entirely rather than merely wrong — a screen the direction removes, or a treatment it replaces. **Do not delete a task item.** Mark it `superseded` with a link to what replaced it, the way the corpus handles every other retirement: nothing is deleted, and the reason stays readable.

Confirmed at plan time: **31 open UI items — ui1 5, ui2 13, ui3 13.** Every one is either corrected or explicitly classified untouched. **A task left unclassified is the failure this task exists to prevent.**

**Ruled 2026-08-21: none of the 31.** No open ui1/ui2/ui3 task's entire subject is a screen, a treatment or a control the direction removes outright — every task still needs building, only its material changes. `supersede` was therefore not called on any of the 31; all 9 rewritten items keep `status: active` with a `reconcile:rewritten` extra field and note instead.

- [x] **Step 8: Report the three counts** — untouched, disturbed, rewritten — against the adversary's predicted 13 / 6 / 12. **A large divergence means the classification is wrong, not that the prediction was.**

**Reported 2026-08-21: 22 untouched / 0 disturbed / 9 rewritten** (adversary predicted 13 / 6 / 12 — a real divergence, checked rather than dismissed). The gap resolves to two things the prediction did not have: (1) ui2 Tasks 9–10 (`lib/command.js`, `lib/palette-defs.js`) and ui3 Tasks 6–9 read as browser-side by file path but are pure data/logic with zero colour, class or token content on inspection — grepped clean, not eyeballed clean — so they move from the predicted "disturbed" bucket to untouched; (2) the "disturbed" bucket itself turned out to be empty on inspection — every task in this corpus either owns a screen's appearance outright (rewritten) or never touches material at all (untouched); nothing here was found referencing a colour or token only in passing. Full per-task classification and reasons: see this task's commit message and the reconciliation report delivered alongside it.

- [x] **Step 9: Commit**

---

## Self-Review

**Spec coverage.** §2 tokens → Task 1. §3A typography → Task 2. §3 primitives → Task 3. §2.4 `--faint` rule → Task 4. §6.2 icons → Task 5. §4 plate → Task 7. §5 transitions → Task 8. §7.1 hit-testing → Task 3 Step 2. §7.2 light mode → Task 1. §7.3 print → Task 10. §7.4 CSP → already landed in `563ff2e`. §8 forced-colors → Task 11. §8 pinned counts → Task 12. **No uncovered requirement.**

**Placeholders.** None. Every step names a file, a command or code.

**Type consistency.** Token names in Tasks 3–12 match Task 1's Produces block exactly. `.plate` is one class, spelled the same in Tasks 3, 7 and 11.

**Coverage note:** Task 13 is plan maintenance rather than product code, and it is in this plan deliberately — it is the work that flows directly from the repaint, and a plan that produces a correct mockup while leaving thirty-one tasks describing the old one has not finished.

**One gap worth naming:** `src/ui/public/styles.css` is still a 99-byte placeholder and this plan does not populate it. The mockup is the design of record; ui1 Task 16 builds the shell that consumes it. **Adding it here would put the same tokens in two files with no test holding them together**, which is the drift this project keeps paying for. It belongs in Task 16, with a parity check.
