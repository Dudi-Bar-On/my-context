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

- [ ] **Step 1: Count what exists, so the removal can be proven complete**

```bash
grep -c "light-dark(" docs/design/web-ui-mockup.html
grep -c "prefers-color-scheme" docs/design/web-ui-mockup.html
```
Record both numbers. They must be **0** at the end of this task.

- [ ] **Step 2: Replace the token block**

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

- [ ] **Step 3: Delete every `light-dark()` pair and the `prefers-color-scheme` block**

Re-run Step 1's greps. Both must return 0. A half-removed theme is worse than either.

- [ ] **Step 4: Remove the light project from the Playwright config**

The config pins `colorScheme` per project. Delete the light one. **This is why the print-from-dark defect went unseen for so long** — no spec ever printed from dark.

- [ ] **Step 5: Run the gates**

```bash
npm test && npm run test:e2e
```
Expect the three pinned e2e counts to be **unchanged** — this task moves no elements. If they move, something structural was edited by accident.

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Fetch the faces and confirm the licence permits vendoring**

Both families are OFL. The licence file ships beside them because this plugin installs inside other people's repositories.

- [ ] **Step 2: Write the `@font-face` block**

```css
@font-face{font-family:"Geist";font-weight:400;font-style:normal;font-display:swap;
  src:url("fonts/geist-400.woff2") format("woff2")}
/* …450, 500, 600; Geist Mono 400, 500; IBM Plex Sans Hebrew 400, 500, 600 */
```

`font-display: swap` so a missing file degrades to a fallback rather than invisible text.

- [ ] **Step 3: Write the failing test — the Hebrew face must actually resolve**

```js
// test/ui/fonts.test.ts
test('the Hebrew cut is declared, not left to a fallback', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  assert.match(html, /font-family:\s*"IBM Plex Sans Hebrew"/,
    'Hebrew has no cut in Geist; without Plex the second language falls back to a system face');
});
```

- [ ] **Step 4: Run it, watch it fail, implement, watch it pass**

- [ ] **Step 5: Verify in a browser that all three families load**

```js
await document.fonts.ready;
document.fonts.check('14px "Geist"');              // true
document.fonts.check('14px "Geist Mono"');          // true
document.fonts.check('14px "IBM Plex Sans Hebrew"'); // true
```

**This only works because `font-src 'self' data:` landed in `563ff2e`.** Before that no font loaded at all.

- [ ] **Step 6: Commit**

---

## Task 3: The eight primitives

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — primitive CSS, after the token block
- Test: `test/ui/primitives.test.ts` (create)

**Interfaces:**
- Consumes: every token from Task 1, `--sans`/`--mono` from Task 2.
- Produces: `.pane`, `.plate`, `.row`, `.lit`, `.blk`, `.chip`, `.rail`, `.hdr`, `.plane`, `.scene`.

- [ ] **Step 1: Write the pane**

```css
.pane{position:relative;border-radius:12px;overflow:hidden;
  backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid var(--pane-edge);
  background:var(--pane-gloss),var(--pane-tint);
  box-shadow:var(--lift),var(--pane-lit)}
```

Two gradients and the order matters: gloss over tint. The tint thinning from `.56` to `.64` is what lets the corner nearest the light be seen *into* rather than merely lit.

- [ ] **Step 2: Write the plane, with the hit-testing rule enforced**

```css
.scene{}                                   /* no perspective here */
.pair{perspective:1600px;perspective-origin:50% 42%}
.plane.l{transform:rotateY(3.2deg)}
.plane.r{transform:rotateY(-3.2deg)}
```

**Never `translateZ` with a negative value.** A `translateZ(-14px)` pushed panels behind their parent's plane and the parent intercepted every click — `elementFromPoint` at a row's own centre returned the container. The handler was never wrong; nothing could reach it.

- [ ] **Step 3: Write the failing hit-test**

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

- [ ] **Step 4: Run it, watch it fail against a deliberately negative Z, then implement**

- [ ] **Step 5: Write the row, the plate, the literal field, the chip, the rail, the header**

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

- [ ] **Step 6: Wrap every transition in the reduced-motion guard**

```css
@media (prefers-reduced-motion:no-preference){ /* every transition lives here */ }
```
Structural, so the true default is static.

- [ ] **Step 7: Gates, commit**

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

- [ ] **Step 1: Compose the two-plane layout**

Left plane: `.pane` holding `.row` items. Right plane: `.pane` holding `.lit` with `.blk` children. The rail persists outside both.

- [ ] **Step 2: Wire the linkage — selecting a row lights its block**

This is the screen's whole job, and the reason the row is allowed to move: *you are never looking at a rule without seeing the text it produced, and never looking at injected text without seeing which rule produced it.*

Dim non-selected blocks to **`opacity:.42`**, not lower. At `.32` two items cannot be compared.

- [ ] **Step 3: Verify the linkage in a browser, not by reading the CSS**

```js
await page.click('[data-choice="b3"]');
// selected row lifts, its block reaches opacity 1, siblings drop to .42
```

- [ ] **Step 4: Gates including e2e, commit. STOP HERE for owner review** — this is the screen the direction is judged on, and nineteen more depend on it.

---

## Task 7: The plate across the data views

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — the 18 graphical views

**Interfaces:**
- Consumes: `.plate` from Task 3.

- [ ] **Step 1: Write the failing test**

```js
test('every data view sits on a plate', () => {
  const views = ['#ribbon', '#coverage', '#relations', '#comb', '#stream', /* …18 */];
  const naked = views.filter((v) => !closestHasClass(v, 'plate'));
  assert.deepEqual(naked, [],
    'text may float on glass; data may not — the ground shows through the marks');
});
```

- [ ] **Step 2: Run it red, wrap each view, run it green**

- [ ] **Step 3: Verify the reason it exists** — sample a gold ribbon segment's rendered pixel at two positions on one screen. Before the plate they differ; after, they match. **A quantity whose colour cannot be trusted is not a quantity.**

- [ ] **Step 4: Commit**

---

## Task 8: Transitions

**Files:**
- Modify: `docs/design/web-ui-mockup.html`

- [ ] **Step 1: Navigation — the rail persists, content crossfades at `--dur-nav`**

Nothing travels horizontally. **A crossfade has no axis to get wrong**, which is why Hebrew costs nothing here — `translateX` is not a logical property and `dir="rtl"` never mirrors it.

- [ ] **Step 2: Retiming — segments travel to their new widths at `--dur-retime`**

```css
.rib u{transition:inline-size var(--dur-retime) var(--ease)}
```

**The movement is the information** — you see *which* tier gained and which collapsed, which a redraw hides. This is the one deliberate exception to "motion signals affordance".

- [ ] **Step 3: Verify by measurement, not by eye**

```js
// before: jit segment 243px → after event change: 20px → after another: 416px
```

- [ ] **Step 4: Commit**

---

## Task 9: The remaining twenty screens

**Files:**
- Modify: `docs/design/web-ui-mockup.html`

Split across four commits by rail group so a reviewer can reject one group without rejecting all twenty.

- [ ] **Step 1: Injection group** — scope coverage, coverage gaps, budget simulator, injected now
- [ ] **Step 2: Evidence group** — audit stream, ask, doctor, decay, relations, status
- [ ] **Step 3: Change group** — review queue, capture, composer, configure, procedures, export/import
- [ ] **Step 4: Read group** — documentation, tutorials, learn
- [ ] **Step 5: After each, run `npm run test:e2e` and confirm every screen still renders in both languages**

---

## Task 10: The print register

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — `@media print`
- Modify: `e2e/print.spec.ts`

- [ ] **Step 1: Write the failing test — print from dark**

The existing spec asserts `bodyBg === white` and `bodyColor === black`, and **both still pass while 246 text-contrast failures exist**, because the body is the one thing the print block does reset. Assert the *tokens*, not the body.

- [ ] **Step 2: Design a printed register rather than converting the screen**

There is no light theme to fall back on. Glass, the ground and the layered shadow all print as nothing or as grey mud. Print gets: white ground, black ink, the plate as a hairline rule, chips as glyph-plus-label.

- [ ] **Step 3: Measure — 21 screens, both languages, printed. Report the failure count.**

- [ ] **Step 4: Commit**

---

## Task 11: The two degraded registers — High Contrast, and reduced transparency

**Files:**
- Modify: `docs/design/web-ui-mockup.html` — `@media (forced-colors: active)` and `@media (prefers-reduced-transparency: reduce)`

- [ ] **Step 1: Confirm the finding by measurement**

**The glass does not survive High Contrast.** `backdrop-filter`, both tint gradients and the layered shadow are stripped or overridden. Measured during the icon evaluation.

- [ ] **Step 2: Declare a register rather than letting the browser improvise**

`.pane` → `Canvas` with a `CanvasText` border. `.plate` → `Canvas` with a hairline. Chips keep their `::before` glyph, which is `content` and therefore not forced. **SVG `fill`/`stroke` are NOT force-adjusted in Chromium** — restate them by system colour name.

- [ ] **Step 3: Verify the tier ribbon still distinguishes four tiers** — under forced-colors the segments previously collapsed to one visual state. Patterns survive; `repeating-linear-gradient` is a `background-image` and does.

- [ ] **Step 4: Honour `prefers-reduced-transparency: reduce`**

Carried from review 2, which recorded it as unhonoured and which this plan otherwise replaces. **A person who has asked their system for less transparency has asked for exactly the thing this direction is built out of**, so the answer cannot be to ignore it.

The register is the smallest honest one: `--pane-tint` and `--plate` go fully opaque, `backdrop-filter` is dropped, and **nothing else changes** — the ground, the type, the lift and the icons all stay. Test that `.pane` computes an opaque background under the query.

```css
@media (prefers-reduced-transparency: reduce){
  :root{--pane-tint:linear-gradient(133deg,#12141c 0%,#101219 100%); --plate:#06070b}
  .pane{backdrop-filter:none;-webkit-backdrop-filter:none}
}
```

- [ ] **Step 5: Commit**

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
