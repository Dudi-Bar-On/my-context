/**
 * The DOM helpers the three `nav.inj` screens share, transcribed from the
 * design of record rather than invented here.
 *
 * `docs/design/web-ui-mockup.html` is the UI specification, and its own script
 * builds every screen out of a handful of tiny factories — `el`, `mono` and `num`
 * among them. This file is those, plus the composites all three screens
 * in this task draw identically: the screen heading (`.phd` + `.verdict` +
 * `.psub`), the split item id (`.idfull`/`.idkind`/`.idslug`) and the tier
 * chip. A fourth file in `screens/` rather than three copies of the same
 * fifteen lines: a second spelling of a shape drawn on three screens is how
 * two of them come to disagree about it.
 *
 * **It is DOM glue, and DOM glue is the stated untested surface** (spec §6,
 * and `test/ui/viewmodel.test.ts`'s own header). Nothing that can be DECIDED
 * lives here — decisions live in `lib/viewmodel.js`, which `node --test`
 * imports directly.
 *
 * **No `innerHTML`, and no `style` attribute.** The first is the mockup's own
 * standing rule: assigning markup destroys the `.m` spans that carry
 * `unicode-bidi:isolate`. The second is a shipping constraint the mockup is
 * exempt from and this code is not: the server sends `style-src 'self'` with no
 * `'unsafe-inline'`
 * (`ui/security.ts` · ``No `'unsafe-inline'`: §3's no-build-step rule already requires`` · ~291),
 * which forbids a `style="…"` attribute. Where the mockup writes one, this
 * code sets the same declaration through CSSOM, which CSP does not gate — and
 * only ever with LOGICAL properties.
 */

import { wallStamp } from '../lib/viewmodel.js';

/** `el(tag, cls, txt)` — the mockup's own factory, argument for argument. */
export function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}

/** A monospace, direction-known run. `.m` is `direction:ltr; unicode-bidi:isolate`. */
export function mono(text) {
  return el('span', 'm', text);
}

/**
 * Group separators, `en-US`, exactly as the mockup's `num` does it. Not the
 * page language: the mockup draws `4,260` in both languages, and a token count
 * that changes its separators with the UI language is a second thing to
 * reconcile for no reader's benefit.
 */
export function num(n) {
  return Number(n).toLocaleString('en-US');
}

/**
 * ── ONE AUDIT INSTANT, ONE SPELLING ────────────────────────────────────────
 *
 * `audit.at` is drawn on three screens — the Audit stream's `At`, Ask's `At`
 * and the injection preview's `When` — and until 2026-08-31 each screen
 * formatted it in its own file. Two of the three were near-copies that
 * disagreed about which strings they would reformat at all, so feeding both
 * audit tables the same malformed record made them disagree about what a
 * reader was looking at; the third was a considered divergence carrying a
 * third copy of the same argument. A reader comparing the Audit stream against
 * the Ask table against the preview's When column was comparing three
 * renderings of one fact and could not tell whether they disagreed. The pair
 * below is that decision, written ONCE, beside `num()` for the reason this
 * file exists.
 *
 * **ABSOLUTE, never relative.** *"3 minutes ago"* reads better in a sentence
 * and is useless everywhere this value actually goes: it cannot be compared
 * against the same record on another screen, it cannot be pasted into a bug
 * report or matched against a log line, and it is a different string every
 * time the screen redraws — so two rows a reader is comparing may have been
 * rendered against two different `now`s, and a live stream re-renders. An
 * audit stamp is EVIDENCE, and evidence is quoted rather than narrated.
 *
 * **`en-GB` is a FORMAT choice and not a language one** — the same argument
 * `num()` makes for `en-US`. It is the 24-hour, day-first spelling in both UI
 * languages, and an audit timestamp that changed shape with the interface
 * language would be a second thing to reconcile for no reader's benefit. It is
 * also not a user-facing STRING: nothing here is keyed, and nothing here needs
 * to be.
 *
 * **Hebrew does need its own treatment, and it is not a second format.** A
 * stamp is digits and separators, which the bidi algorithm reads as NEUTRAL —
 * so inside RTL prose `29/08/2026, 04:33` is two number runs with a neutral
 * between them, and the time can be laid out to the LEFT of the date. What
 * fixes that is the isolated run around the value, not a different calendar:
 * every call site puts this output inside `.m` (`td.m small` on both audit
 * tables) or an `{mv:…}` slot, which is `.m.v` — `direction:ltr;
 * unicode-bidi:isolate`. That is a property of the RENDERED run, so it is
 * measured as one in `e2e/bidi.spec.ts` rather than asserted about a class
 * name in a string.
 *
 * **Two precisions, because the two columns answer different questions.**
 * `clockOf` keeps SECONDS: the audit stream lands a burst of ten `ui-refused`
 * records inside one second, and dropping the seconds would collapse that
 * burst into ten rows stamped identically. `stampOf` drops them and adds the
 * DATE instead: two preview rows can be weeks apart — `preview.when` says so
 * on the screen — a bare clock draws those two identically, and a second on a
 * weeks-old delivery is noise standing where the day should be.
 *
 * **ONE parse guard, and it is the stricter of the two that were here.** Only
 * a real INSTANT is reformatted. An audit record's `at` is UTC ISO-8601 by
 * declaration; the index's `updated_at` is `2026-08-23 05:21:54`, which
 * carries no zone at all — `new Date()` reads that as LOCAL time, so
 * reformatting it shifts the value by the running machine's offset and then
 * presents the result as though it had been measured. A string that is not an
 * instant, and a string `Date` cannot parse, are therefore both drawn AS THEY
 * ARRIVED: the record's own bytes are the last true thing left.
 */
const INSTANT = /T.*(Z|[+-]\d\d:?\d\d)$/;

/** The `Date` behind an `at`, or `null` when it is not an instant this may reformat. */
function instantOf(at) {
  const text = String(at);
  if (!INSTANT.test(text)) return null;
  const when = new Date(text);
  return Number.isNaN(when.getTime()) ? null : when;
}

/** A wall clock to the SECOND, `09:26:05` — both audit tables' `At` column. */
export function clockOf(at) {
  const when = instantOf(at);
  if (when === null) return String(at);
  return when.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/**
 * A wall DATE and a wall clock to the minute, `29/08/2026, 04:33` — the
 * injection preview's `When`, where two rows can be weeks apart.
 */
export function stampOf(at) {
  const when = instantOf(at);
  if (when === null) return String(at);
  // ── AND SINCE 2026-09-02 THE FORMAT ITSELF LIVES ONE DIRECTORY UP.
  //
  // The status bar gained a wall CLOCK field on both surfaces, and the
  // terminal half of it is TypeScript — which cannot statically import this
  // untyped browser module, but already reaches `lib/viewmodel.js` through a
  // dynamic-import bridge for the occupancy bands. So the `en-GB`, 24-hour,
  // day-first spelling this function settled moved there as `wallStamp`, and
  // this call is what stops it becoming the fourth copy of one decision — the
  // exact regression the task that wrote this function existed to end.
  //
  // The PARSE GUARD stays here, and that division is the point: `instantOf` is
  // about whether an AUDIT RECORD's stamp may be reformatted at all, which is
  // a fact about this product's own log; `wallStamp` is about how an instant
  // is spelled, which is a fact about the interface.
  return wallStamp(when.getTime()) ?? String(at);
}

/** The mockup's `style="margin-block-start:8px"`, without the attribute. */
export function spaced(e) {
  e.style.setProperty('margin-block-start', '8px');
  return e;
}

/* ══ HOW WIDE A CHART MAY DRAW — owner ruling 2026-09-01 ═══════════════════
 *
 * Owner, looking at the product: *"the graphics all over is condensed left
 * after we changed it's scale, could we extend the x axis to the right but
 * without breaking the proportion especially not the font just more spacing?"*
 *
 * ── WHAT WAS MEASURED, IN A BROWSER, BEFORE ANY NUMBER MOVED ──────────────
 *
 * Three fixed-viewBox charts, at the owner's own 2273px against the live
 * 733-item corpus, each read with its own host plate:
 *
 *     staircase (simulate)  viewBox 560   rendered 560   plate 1714   1154px empty
 *     ego graph (graph)     viewBox 900   rendered 900   plate 1973   1073px empty
 *     recency comb (decay)  viewBox 900   rendered 900   plate 1958   1058px empty
 *
 * So between 54% and 67% of every chart's own card was blank, on the right,
 * and the drawing sat squeezed into the left of it. The two CSS-drawn graphics
 * were measured in the same pass and are NOT affected — `.hstrip` filled 1776
 * of 1984 and `.ribbon .track` 1958 of 1958 — which is what identifies the
 * cause as belonging to `svg.chart` and not to the cards.
 *
 * ── THE CAUSE, AND IT IS NOT A FONT SIZE ──────────────────────────────────
 *
 * `svg.chart` said `inline-size:100%` until 2026-08-29 and says
 * `max-inline-size:100%` now, over `width`/`height` attributes each chart
 * writes equal to its own viewBox. That change was correct and is not being
 * reversed: it is what makes one viewBox unit one CSS pixel, so `--fs-chart`
 * means ten pixels on every screen instead of being multiplied by 1.600 here
 * and 1.267 there. But it left every chart at its AUTHORED width — 560 or 900
 * — whatever the card gave it, and a 900-unit drawing in a 1958px card is a
 * drawing with 1,058px of nothing beside it. The charts were not scaled down
 * too far; they stopped being told how much room they had.
 *
 * **This is the third attempt on these graphics and the first that is not
 * about type.** Two font-size fixes were made from arithmetic without opening
 * the rendered page and both were wrong (`e2e/chart-scale.spec.ts`'s header
 * keeps that ledger). Nothing here touches a font size, a stroke width or a
 * node box: the ONLY thing that changes is how many units the x axis spans,
 * which is exactly the owner's *"just more spacing"*.
 *
 * ── WHY WIDENING THE VIEWBOX IS THE ANSWER AND STRETCHING IT IS NOT ───────
 *
 * A stretch (`inline-size:100%` over a 900-unit box) multiplies the GEOMETRY
 * and leaves the type alone, so the proportion between a label and the mark it
 * names breaks — the defect of 2026-08-29. Widening the viewBox itself, with
 * the `width` attribute kept equal to it, keeps the ratio at exactly 1:1: ten
 * pixels of text stays ten pixels of text, a 210px node box stays 210px, and
 * the extra room lands entirely in the gaps between the marks. That is
 * distribution along x, not a zoom, and it is what `e2e/chart-scale.spec.ts`
 * already asserts — that file's `scale` is `rendered ÷ viewBox` and stays 1.
 *
 * ── THE FLOOR IS THE AUTHORED WIDTH, AND THERE IS NO CEILING ──────────────
 *
 * Never NARROWER than the design of record's own number: each of these
 * geometries reserves fixed gutters (the comb's 214px label column, the
 * staircase's 26px foot, the graph's 210px node boxes) and a width below the
 * authored one puts them on top of each other. Below it the stylesheet's
 * `max-inline-size:100%` still shrinks the whole drawing as it does today,
 * which is the one case where the factor is not 1 — and it can only ever be
 * smaller, so a token never renders larger than the number it states.
 *
 * ── AND THE CEILING THE SAME DAY, BECAUSE THE OWNER LOOKED AGAIN ──────────
 *
 * *"relations is better now but still not perfect."* Measured at the same
 * 2273px, focus `DEC-foreign-store-never-leaves-the-repository-so-the-question-
 * of`, which has ONE drawn relation:
 *
 *     svg          viewBox 0 0 1348 250        width attr 1348
 *     node 1       x 265   w 210               centre 370
 *     node 2       x 1387  w 210               centre 1492
 *     ink          420 of 1348 units           69% EMPTY
 *
 * Two node boxes pinned to opposite edges of a card with 1,122px of nothing
 * between them. That is the morning's defect in the other direction, and it
 * has the same cause read the other way round: a chart was told how much room
 * it HAD and never asked how much it could USE.
 *
 * So `natural` joins `authored` here, and the span is the plate CLAMPED
 * BETWEEN THEM — `max(authored, min(available, natural))`. `authored` is still
 * the floor and still the number below which the geometry collides; `natural`
 * is what the CONTENT can spend, and it is the drawing's own to compute
 * because only the drawing knows its column count and its row count. The
 * caller that supplies neither is unchanged: `natural` defaults to no ceiling,
 * which is the staircase's and the comb's behaviour today and stays it —
 * every rung and every tooth of those two is a distinct datum, so a wider box
 * is more of the data on screen and the room is always worth having. An ego
 * graph's three columns are three columns at any width.
 *
 * **A drawing narrower than its plate is CENTRED, and deliberately.**
 * `svg.chart` gained `margin-inline:auto` — in the design of record first and
 * in `styles.css` to match, which is the order every presentation change takes
 * here. Left-aligned was the alternative and it is the wrong one: the ego
 * graph's own geometry is symmetric about the focus column, so a symmetric
 * drawing hard against the left of a wide card reads as a layout that failed
 * rather than as one that chose. Centring is also the only option that does
 * not move when the item pane is dragged.
 */

/**
 * How many viewBox units this chart may span inside `host`, given the width
 * the design of record authored for it.
 *
 * **`clientWidth` MINUS the padding, and the subtraction is the whole of it.**
 * `clientWidth` excludes the border and the scrollbar and INCLUDES the padding
 * — `.plate` spends 12px on each side — so using it bare would size every chart
 * 24px wider than the box it has to fit in, overflow the card by exactly that,
 * and put the page into the horizontal scroll `e2e/chart-scale.spec.ts`
 * forbids. `getBoundingClientRect()` is worse again: it adds the border back.
 * Rounded DOWN, because a fractional overshoot is still an overshoot.
 *
 * A host that is not laid out yet answers 0 (detached, or `display:none`), and
 * the authored width is the honest answer there rather than a chart one pixel
 * wide.
 *
 * **`natural` is the CEILING and it is the drawing's, not the container's** —
 * the widest box this particular drawing has any use for, which only the
 * drawing can compute because it is the one thing that knows its own content.
 * Omitting it means "no ceiling", which is the answer for a chart whose every
 * unit of width is another datum on screen: the staircase's rungs and the
 * comb's teeth. The clamp is `max(authored, min(available, natural))`, so the
 * floor still wins over a ceiling that somehow came in below it and neither
 * bound can silently swap places with the other.
 */
export function chartSpan(host, authored, natural = Infinity) {
  const capped = (span) => (span > natural ? Math.max(authored, natural) : span);
  if (host === null || host === undefined) return capped(authored);
  // A HOST WITH NO LAYOUT KEEPS THE WIDTH IT IS ALREADY DRAWN AT. A plate that
  // is detached, or in a section on its way out, measures zero, and answering
  // the authored floor there would collapse a chart that is merely not being
  // looked at — then un-collapse it visibly when it came back. Reading the
  // drawn viewBox makes a re-render of a hidden chart reproduce what was there.
  // Measured on the design of record, which keeps every section in the document
  // at once: its EN → HE → EN round trip came back with the off-screen charts at
  // 900 where they had been 1,958.
  if (host.clientWidth === 0) {
    const drawn = drawnSpan(host);
    return capped(drawn > authored ? drawn : authored);
  }
  const pad = globalThis.getComputedStyle === undefined ? null : getComputedStyle(host);
  const inset = pad === null ? 0
    : (parseFloat(pad.paddingInlineStart) || 0) + (parseFloat(pad.paddingInlineEnd) || 0);
  const avail = Math.floor(host.clientWidth - inset);
  return capped(Number.isFinite(avail) && avail > authored ? avail : authored);
}

/**
 * Draw a chart into `host` at the width `host` actually has, and REDRAW it at
 * the new width whenever `host` is resized.
 *
 * **Without the second half the first is a chart that is right once.** These
 * screens draw on route entry and never again; a window resized afterwards —
 * or a pane dragged wider, which `lib/pane-resize.js` does on the same page —
 * would leave the drawing at the width it was born at, which is the defect
 * being fixed wearing a different trigger.
 *
 * `ResizeObserver` on the HOST rather than on `window`, because the plate's
 * width is decided by the card and the pane and not only by the viewport, and
 * a `resize` listener would miss every one of those.
 *
 * **Guarded against the observer loop, which is not theoretical.** The callback
 * replaces the host's child, and a child replacement that changed the host's
 * width would call the callback again forever. It cannot change the width — a
 * `.plate` is sized by its card — but a guard that costs one comparison is
 * cheaper than trusting that, so a redraw happens only when the measured span
 * actually MOVED. That also collapses the burst of callbacks a single drag
 * produces into one redraw per distinct width.
 *
 * Nothing is torn down. The observer holds only the host, so when the screen is
 * replaced and the host goes out of the document both are collected together;
 * an observer on a detached element fires for nothing in the meantime.
 */
const CHART_DRAW = new WeakMap();

export function fitChart(host, authored, draw, natural = Infinity) {
  // ── ONE OBSERVER PER HOST, AND IT ALWAYS HOLDS THE NEWEST DRAW.
  //
  // A screen calls this again whenever its own data changes — `screens/graph.js`
  // does it on every focus the picker offers — into the SAME plate. Installing
  // a watcher per call would leave one live observer per focus ever chosen, all
  // of them firing on one resize; keeping the FIRST watcher would leave it
  // holding the first focus's data, so a resize would quietly redraw the graph
  // the reader navigated away from. The registry answers both: the watcher is
  // installed once and reads whatever draw was handed in last.
  //
  // **THE TWO BOUNDS RIDE IN THE REGISTRY BESIDE THE DRAW, AND THAT IS NEW.**
  // They used to be closed over by the watcher on its first call, which was
  // harmless while `authored` was one constant per screen. It stopped being
  // harmless the moment they became functions of the DATA: an ego graph's floor
  // and natural width both move with its column and row count, so a watcher
  // holding the first focus's bounds would resize the reader's current graph
  // against a graph they left. Same registry, same reason, one entry.
  const first = !CHART_DRAW.has(host);
  CHART_DRAW.set(host, { draw, authored, natural });
  paintChart(host);
  if (first) watchChartWidth(host, authored, () => paintChart(host));
}

/** The span `host`'s currently registered chart may take, bounds and all. */
function fittedSpan(host, authored, natural) {
  const held = CHART_DRAW.get(host);
  return held === undefined
    ? chartSpan(host, authored, natural)
    : chartSpan(host, held.authored, held.natural);
}

/**
 * Draw, then check whether DRAWING changed the room, and settle it here rather
 * than a frame later.
 *
 * **Measured, not defensive.** A 60-node ego graph is 823px tall; drawing it
 * puts the page into a vertical scrollbar, which takes ~15px off its own plate
 * — so a chart drawn at 980 units finds itself in a 965px box and renders at
 * 0.985 instead of 1:1. `e2e/chart-scale.spec.ts` caught exactly that, because
 * it measures the moment the chart appears. Leaving the correction to the
 * `ResizeObserver` is a frame too late: for that frame the chart really is the
 * wrong size, and a reader on a tall chart would see it settle.
 *
 * Bounded at three passes. Each pass either agrees with the last measurement
 * and returns, or draws once more at the width it just found; a width A whose
 * drawing forces width B and a width B whose drawing forces width A would
 * otherwise spin, and a chart one pixel out is better than a hang.
 */
function paintChart(host) {
  let span = fittedSpan(host);
  for (let pass = 0; pass < 3; pass += 1) {
    host.replaceChildren(CHART_DRAW.get(host).draw(span));
    const now = fittedSpan(host);
    if (now === span) return;
    span = now;
  }
}

/**
 * Call `redraw` whenever `host`'s CHART SPAN stops matching the chart that is
 * drawn in it, and never otherwise.
 *
 * The half of `fitChart` that a screen redrawing its own chart for its own
 * reasons needs on its own — `screens/simulate.js` rebuilds the staircase on
 * every slider step, so it owns the draw and needs only the trigger.
 *
 * **THE COMPARISON IS AGAINST THE DRAWN VIEWBOX, NOT AGAINST A REMEMBERED
 * NUMBER, and that is what makes the first paint correct.** Measured on the
 * recency comb at 2273px: the plate was 1,973px wide when the chart was drawn,
 * the 1,862-unit-tall chart then put the PAGE into a vertical scrollbar, and
 * the plate came back 1,958px — so the chart was 15px wider than the box it
 * was now in and `rendered ÷ viewBox` read 0.992 instead of 1. A watcher
 * seeded with "the width I see now" is blind to exactly that, because by the
 * time it looks, now is already the new width. Reading the viewBox asks the
 * only question that matters — *is what is drawn the size of the room it is
 * in* — and answers it the same way on the first callback as on the hundredth.
 *
 * The same comparison is the loop guard. The callback replaces the host's
 * child, and a child replacement that changed the host's width would call the
 * callback forever; here the redraw makes the two numbers equal by
 * construction, so the second callback returns without doing anything. The
 * oscillation check below covers the one shape that could still cycle — a
 * width A whose drawing forces width B and a width B whose drawing forces
 * width A — which nothing in this product does today (a chart's height is
 * decided by its row count, never by its width) and which would be a hang
 * rather than a glitch if it ever did.
 *
 * `ResizeObserver` on the HOST rather than on `window`, because a plate is
 * narrowed by the item pane being dragged as well as by the viewport, and a
 * `resize` listener would see the second and miss the first. It also fires
 * once when observation begins, which is what corrects the first paint above.
 *
 * Nothing is torn down. The observer holds only the host, so when the screen is
 * replaced and the host leaves the document both are collected together; an
 * observer on a detached element fires for nothing in the meantime.
 *
 * `natural` is the ceiling `chartSpan` documents, for a caller driving its own
 * redraw. A host that `fitChart` registered ignores it and reads the bounds of
 * whatever draw is registered NOW — see `fittedSpan`, and the note in
 * `fitChart` about the focus a watcher would otherwise still be holding.
 */
export function watchChartWidth(host, authored, redraw, natural = Infinity) {
  if (typeof ResizeObserver !== 'function') return;
  // The two spans most recently drawn at, newest first. A span that comes back
  // equal to the one BEFORE last is a cycle, not a resize, and the watcher
  // stops rather than repainting between two widths forever.
  let recent = [];
  new ResizeObserver(() => {
    // A HOST WITH NO LAYOUT IS NOT A RESIZE. A plate that is detached, or in a
    // section on its way out, reports zero width, and `chartSpan` answers the
    // authored floor for it — refitting to that would be undone the moment the
    // host came back, which is a flip the cycle guard below would latch on.
    if (host.clientWidth === 0) return;
    // `fittedSpan` and not `chartSpan`: when `fitChart` installed this watcher
    // the bounds belong to whatever draw is registered NOW, not to the one that
    // happened to be first. A caller driving its own redraw supplies its own.
    const span = fittedSpan(host, authored, natural);
    if (drawnSpan(host) === span) return;
    if (recent[1] === span) return;
    recent = [span, recent[0]];
    redraw(span);
  }).observe(host);
}

/** The width the chart currently in `host` was drawn at, or -1 if there is none. */
function drawnSpan(host) {
  const svg = host.querySelector('svg.chart');
  if (svg === null) return -1;
  const box = (svg.getAttribute('viewBox') ?? '').split(/\s+/);
  const width = Number(box[2]);
  return Number.isFinite(width) ? width : -1;
}

/**
 * `<div class="phd"><h2>…</h2><span class="verdict">✅ <span>…</span></span></div>`
 * followed by `<p class="psub">…</p>`, which is how all 21 screens open.
 *
 * The ✅ is a SIBLING of the translated span, never inside it — the mockup's
 * own arrangement, and the reason it matters is the defect `e2e/language.spec.ts`
 * pins: a translated element's children are replaced wholesale from the string
 * table, which knows nothing of a glyph someone nested inside one.
 *
 * **`glyph` exists because the design of record uses two of them, and this
 * composite shipped able to draw only one.** Nineteen of the twenty-one screens
 * open ✅; `data-p="status"` and `data-p="learn"` open ⚠️ — a recorded
 * exception and a conditional pass, which is a different verdict and says so
 * (`docs/design/web-ui-mockup.html` · `<span class="verdict">⚠️ <span data-t="st.v">` · ~1912).
 * Defaulted rather than required, so the three screens already calling this
 * function are untouched.
 *
 * **Nineteen of twenty-one stayed the emoji; Status did not, and this is why.**
 * The ui1 Task 19 reconciliation said the emoji verdict "is replaced by the
 * `.chip` primitive", reading repaint spec §6 — arguably about CATEGORY
 * glyphs on item ids rather than the verdict, which is why this stayed an
 * open disagreement rather than a settled one for a time (repaint 9.2,
 * 2026-08-22, repainted `.card.gloss` to `.card.pane` on these lines and left
 * every `✅`/`⚠️` in place). **`TASK-ui1-task-19-doctor-decay-status-and-
 * learn-screens`'s own VERIFIED PARTIAL pass, 2026-08-26, settled it the other
 * way**: Status specifically — not Learn, whose emoji verdict is untouched —
 * was marked NOT MET for exactly this, in so many words: "a real verdict chip
 * is the `.chip` primitive with a meaning hue, not an emoji." No later ruling
 * reopened that. `verdictChip` is therefore opt-in rather than a change to
 * `glyph`'s default: passing it swaps the emoji sibling for a `.chip` of the
 * named hue carrying the verdict text itself, and every caller that does not
 * pass it — nineteen screens, Learn included — is byte-for-byte unaffected.
 */
export function screenHead(ctx, root, titleKey, verdictKey, subKey, glyph = '✅', verdictChip = null) {
  const phd = el('div', 'phd');
  const h = el('h2');
  h.append(...ctx.t(titleKey));
  const verdict = el('span', 'verdict');
  if (verdictChip === null) {
    verdict.append(`${glyph} `);
    const vtext = el('span');
    vtext.append(...ctx.t(verdictKey));
    verdict.append(vtext);
  } else {
    const chip = el('span', `chip ${verdictChip}`);
    chip.append(...ctx.t(verdictKey));
    verdict.append(chip);
  }
  phd.append(h, verdict);
  const sub = el('p', 'psub');
  sub.append(...ctx.t(subKey));
  root.append(phd, sub);
}

/**
 * `<span class="idfull m"><span class="idkind">CONST</span><span class="idslug">-…</span></span>`
 *
 * The split is at the FIRST hyphen, which is where the category prefix ends:
 * `CONST-postgres-pool-capped-at-20` is `CONST` + `-postgres-pool-capped-at-20`.
 * An id with no hyphen keeps the whole of itself as the kind rather than
 * inventing an empty one.
 */
export function idFull(id, cls = 'idfull m') {
  const wrap = el('span', cls);
  const cut = id.indexOf('-');
  wrap.append(
    el('span', 'idkind', cut === -1 ? id : id.slice(0, cut)),
    el('span', 'idslug', cut === -1 ? '' : id.slice(cut)),
  );
  return wrap;
}

/**
 * The `button.linkid` every id on every screen is, so a click reaches the
 * global item detail pane (`aside.pane#pane`, Task 16's). This file does NOT
 * wire that click: the shell owns the pane and delegates from the document,
 * exactly as the mockup does, and a second listener here would open it twice.
 */
export function linkId(id, split = true) {
  const b = el('button', 'linkid m');
  b.type = 'button';
  b.dataset.id = id;
  if (split) {
    const cut = id.indexOf('-');
    b.append(
      el('span', 'idkind', cut === -1 ? id : id.slice(0, cut)),
      el('span', 'idslug', cut === -1 ? '' : id.slice(cut)),
    );
  } else {
    b.append(document.createTextNode(id));
  }
  return b;
}

/** The mockup's `<svg class="icon-open"><use href="#i-open"></use></svg>`. */
export function openIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon-open');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-open');
  svg.append(use);
  return svg;
}

/**
 * The mockup's `TIERCHIP` table, verbatim: which chip class and which glyph a
 * tier wears. The tier NAME is not a translated string anywhere in the mockup
 * — `pinned`, `jit`, `restored`, `continuity` and `index` are the config's
 * own keys and the selector's own words, drawn as literals in every chip the
 * file paints.
 */
const TIERCHIP = {
  pinned: ['chip gov', '◆'],
  jit: ['chip ok', '●'],
  restored: ['chip ok', '●'],
  continuity: ['chip carry', '◈'],
  index: ['chip index', '◇'],
};

export function tierChip(tier) {
  const [cls, glyph] = TIERCHIP[tier] ?? ['chip', '◇'];
  const chip = el('span', cls, tier);
  chip.dataset.g = glyph;
  return chip;
}

/**
 * A refusal: a WORDED frame in the reader's language, around the refusing
 * party's own words, unedited.
 *
 * **The frame is `err.note`, and it exists because the refusal used to have
 * none.** This paragraph said, until 2026-08-30, that the mockup declares no
 * string for it and that inventing one "would fail
 * `test/ui/strings-parity.test.ts` in the direction that names it". That
 * direction was dropped on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, and the gate
 * has had ONE mockup-facing check ever since — the GAP direction, which fails
 * on a sentence the design drew and the product does not have. A key the
 * mockup never drew is ordinary development. Re-read the gate's own docstring
 * before quoting it; this comment is the reason a defect outlived its cause on
 * fifteen modules, and it is the widest of the fifteen: EVERY server refusal
 * on EVERY screen in this UI came through here, so a reader in Hebrew was
 * shown English at the exact moment something had gone wrong.
 *
 * **What is NOT worded, and must not be.** The message itself. It is the
 * endpoint's `error` text, the platform's exception, a command's `stderr` or
 * an audit note, and it is shown as it arrived — the same treatment
 * `/api/session/:session/injected`'s `error` field already carries, "the seen
 * file's own words, not a paraphrase". `err.note` says so in the sentence, so
 * a reader is told the run is untranslated rather than left to wonder why half
 * the line changed language and half did not.
 *
 * **`ctx` defaults to the shell's own, and no call site had to change.** Every
 * caller here and in `lib/command-actions.js` already had a translated screen
 * around it; threading a parameter through six of them to reach one paragraph
 * would have been six edits for one sentence. `globalThis.myctx` is what
 * `app.js` publishes (`src/ui/public/app.js` · `  window.myctx = {` · ~2556),
 * and it is the same shape `screens/packs.js` already relies on for `document`
 * (`src/ui/public/screens/packs.js` · `export function isolated(text, doc = globalThis.document) {` · ~192).
 * Where there is no shell — `node --test` importing this module with a
 * stand-in `document` — the message is drawn bare, which is exactly what
 * shipped before and is never worse than it.
 *
 * It is `.spill` (`--crit`) and it is drawn INSTEAD of the data, never beside
 * an empty view: an endpoint that refused and a corpus that is empty are two
 * facts, and this project's own invariant is that the difference survives.
 */
export function errorNote(message, ctx = globalThis.myctx) {
  const text = message === undefined || message === null ? '' : String(message);
  const note = el('p', 'small spill');
  if (ctx !== undefined && ctx !== null && typeof ctx.t === 'function') {
    note.append(...ctx.t('err.note', { error: text }));
  } else {
    note.textContent = text;
  }
  return note;
}

// --- The bound every list declares ------------------------------------------
//
// `REQ-every-list-and-table-declares-what-leaves-it-and-when-and-says`: a
// surface that grows with the corpus and never says what it dropped is two
// defects at once — it becomes unusable at scale, and it cannot be told apart
// from a surface that is showing everything.
//
// **ONE implementation, six call sites**, because six surfaces sharing one
// mechanism must share their wording or the product grows six ways to say
// "there is more". The six are the delivered list, the carried blocks and the
// spilled list (`preview.js`), the injected-now table (`injected.js`), the
// review queue (`work.js`) and the pack stack (`packs.js`).
//
// **The ORDER is a parameter, and it is the whole of the owner's ruling**
// (`DEC-a-record-list-bounds-by-time-a-computed-list-bounds-by`):
//
//   'recent'   — a surface that REPLAYS A RECORD. Every row carries a real
//                timestamp, so the last N by time is a meaningful selection and
//                the remainder is fetchable because it is persisted.
//   'admitted' — a surface that RE-COMPUTES. `SelectionEntry` is
//                `{item, tier}` and `IndexLine` is `{id, type, title,
//                carried?}`; neither carries a time field, and every item in a
//                preview arrives at the same hypothetical instant. Its only
//                real ordering is the one `select()` used: first-fit, tier by
//                tier. Stamping a computation with a time it never happened at
//                would be fabrication.
//   'considered' — the same computation, read from the other side: the items
//                that did NOT arrive, in the order the selector offered them.
//                A third order rather than a reuse of `admitted`, because a
//                spilled list is the one surface where the word "admitted"
//                is false about every row it sits under. Added 2026-08-28
//                with the preview's spilled-items list.
//
// **`displayOnly` is not decoration and not politeness.** On the preview the
// cap is a DISPLAY cap over a list that was delivered WHOLE, so the sentence
// has to say so in those words. Without it, "showing 20 of 47" reads as "you
// were given 20" — a false claim about the injection itself, on the one screen
// whose promise is *"exactly what Claude gets"*.
//
// The remainder costs no round trip anywhere: every one of the five already
// receives its whole array in the response it is rendering. So "show all" is a
// re-render, the total is always EXACT rather than "at least N", and the honest
// sentence is available in every state — including the state where nothing was
// truncated, which is why `list.allOf` exists. A list that shows everything and
// says nothing cannot be told apart from one that truncated.
//
// --- The way THROUGH the bound -----------------------------------------------
//
// `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`, from the
// owner on 2026-08-27: *"I could not find a button or a different control that
// let the user get the next or the previous batch of records"*. Declaring the
// bound is necessary and it is not sufficient.
//
// **This is a control, not a paging layer**, and the paragraph above is why it
// can be. All five surfaces already hold their WHOLE array, so a page is a
// re-render over data legitimately in hand — the requirement's sharpest
// condition, *no surface may answer "next" by re-reading the whole corpus and
// slicing*, is satisfied by construction here and nothing below introduces a
// fetch. `/api/coverage` is the surface that genuinely pages, over a walk no
// client could hold, and it is not touched: what is borrowed from it is how it
// READS, not how it works — its `omitted` counts what a page left out on BOTH
// sides, and `list.omittedBoth` says the same thing in the same shape so the
// two do not end up as two different ideas.
//
// **"Previous" is a direction in the LIST, never in the page index.** Three of
// the five take the LAST N because their logs are append-only, so their page 0
// is the END of the array and their page index counts BACKWARDS through time.
// One vocabulary for the reader — lower row numbers are "previous" in both
// modes — and the index is what flips. Reverse it and the review queue answers
// "previous" with the wrong end of its own log, under a sentence naming the
// right one: a sample presented as a summary, which is the defect the slice
// comment in `paint` already exists to prevent.
//
// **`displayOnly` survives every page, and that is the subtle one.** The clause
// exists because "showing 20 of 47" would otherwise read as "you were given 20"
// on the one screen whose promise is *exactly what Claude gets*. "Rows 21-40 of
// 47" reads that way at least as readily — a page number is what a reader has
// learned means *the rest is elsewhere*. Moving through a DISPLAY cap is not
// moving through what was delivered, so the clause is appended on every capped
// state rather than only on the first.

/**
 * Which slice of `items` a page holds — the one DECISION in this file.
 *
 * `end` is exclusive, `before`/`after` count what the page leaves out on each
 * side, and `page` comes back CLAMPED so a caller cannot land on a page nobody
 * could be on. An empty list is one page of nothing rather than zero pages:
 * `STD-a-measured-zero-is-drawn` governs the empty end, and `pages: 0` would
 * make every step below refuse for a reason no reader could see.
 *
 * `take === 'last'` counts its pages from the END, so its SHORT page sits at
 * the old end of the log rather than the new one. Getting that inverted would
 * drop the newest rows off the opening page of the review queue.
 */
export function pageWindow(total, cap, page, take) {
  const pages = Math.max(1, Math.ceil(total / cap));
  const at = Math.min(pages - 1, Math.max(0, page));
  const end = take === 'last' ? total - at * cap : Math.min(total, at * cap + cap);
  const start = take === 'last' ? Math.max(0, end - cap) : at * cap;
  return { start, end, page: at, pages, before: start, after: total - end };
}

/**
 * The page a step lands on, or `null` when the step is not available.
 *
 * `direction` is `'next'` (towards HIGHER row numbers) or `'prev'` (towards
 * lower ones), in both `take` modes. `null` is what disables a control, so the
 * refusal and the disabling are one decision rather than two that can drift.
 */
export function pageStep(page, pages, take, direction) {
  const towardsEnd = direction === 'next' ? 1 : -1;
  // The flip, and the whole of the `take: 'last'` correction.
  const step = take === 'last' ? -towardsEnd : towardsEnd;
  const landing = page + step;
  return landing < 0 || landing >= pages ? null : landing;
}

/* ── THE SIMULATOR'S RANGE MAXIMUM — one store, three screens ─────────────

   `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget`, the
   owner's five-part requirement of 2026-08-28. Parts 3 and 4 are what make this
   a STORE rather than a variable inside `screens/simulate.js`: *"the config
   screen should be synchronized with the simulator and also the ribbon budget in
   the injection preview max values should be updated"*. Three screens have to
   agree about one number, so it is written down ONCE and the three import it
   — the same argument `lib/live-invalidation.js` makes about which kinds
   invalidate which screen, and `lib/palette-defs.js` about the command
   catalogue: a hand-kept second copy of a shared fact is a defect waiting to
   happen.

   **It lives HERE, in the module every screen already imports**, rather than in
   `screens/simulate.js` with the other two importing that. A screen importing a
   screen would make the injection preview load the simulator to draw a ribbon,
   and it is also unloadable by `test/ui/config-screen.test.ts`, which rewrites
   exactly the three specifiers this file is one of.

   **A module-level object, and deliberately not `sessionStorage`.**
   `test/ui/config-screen.test.ts` forbids `screens/config.js` naming
   `sessionStorage` at all — a screen reaches for state through `ctx`, never
   for the browser's own stores — and the reach for one would buy nothing here:
   an ES module is a singleton per page, so this object already outlives every
   `render()` and every navigation between the three screens, which is exactly
   the lifetime the range wants. It does not survive a reload, and that is the
   right answer too: a reload re-reads the budgets from disk, and a range
   remembered across it would be a bound nobody on this page had set.

   **Why the client at all, and not `config.json`.** The range maximum is not a
   budget. A budget is what the selector is run at; the range is what a reader
   has decided is worth exploring, and the two must not share a control — the
   whole first half of the task's design section. Writing an exploration bound
   into the file that governs injection would make every glance at the simulator
   a change to the product's behaviour.

   **Nothing here can clamp.** `simRangeFor` answers `null` for anything that is
   not a positive integer, and `simulate.js`'s `sliderMaxFor` never lets a stored
   range pull the bound below the budget in force. That is the one property that
   has survived all four designs of this number, and it survives this one:
   the slider can always reach the budget actually in force, and never displays a
   value that was clamped. ── */

/** `{ [tier]: positive integer }`, for the tiers a reader has set a range on. */
const SIM_RANGE = {};

/**
 * The range maximum a reader has SET for `tier`, or `null` when they have not.
 *
 * `null` is a real answer and not a zero: no range set means the simulator's
 * derived default is in force, which is a different fact from a range of
 * nothing.
 */
export function simRangeFor(tier) {
  const value = SIM_RANGE[tier];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** Set it. The one writer, called by the range control's own commit. */
export function setSimRange(tier, max) {
  SIM_RANGE[tier] = max;
}

/**
 * **"Raising a budget past the limit raises the limit"** — the task's own
 * title, performed from wherever the budget was raised.
 *
 * `screens/config.js` calls this for every field its budget write actually
 * changed, so a budget written on Configure that exceeds the range a reader set
 * on the simulator carries the range up with it. The two screens can then never
 * disagree about what the slider is able to reach.
 *
 * It only ever RAISES. A budget lowered on Configure leaves the range where the
 * reader put it — narrowing somebody's chosen range because a number moved
 * underneath them is the "maximum that silently moves while you drag" the design
 * section refuses. And with NO range set there is nothing to raise: the derived
 * bound already carries the budget in force as one of its own terms, so writing
 * one here would invent a decision the reader never made.
 */
export function raiseSimRange(tier, atLeast) {
  const current = simRangeFor(tier);
  if (current === null || current >= atLeast) return;
  if (!Number.isInteger(atLeast) || atLeast <= 0) return;
  setSimRange(tier, atLeast);
}

/** Card lists sit in a scene the design of record sizes; tables and card stacks scroll. */
export const BOUND_CAP_LIST = 20;
export const BOUND_CAP_TABLE = 50;

/**
 * Draws `items` through `draw`, capped, and appends the bound line under them.
 *
 * `host` receives the drawn rows; the bound line is returned so the caller can
 * place it where the reader reaches the end of the list — which is not always
 * the same parent (a `<table>`'s rows go in a `<tbody>` and its bound line
 * cannot).
 */
/** One keyed sentence, wrapped the way the design of record wraps it. */
function sentence(ctx, key, slots) {
  const span = el('span');
  span.append(...ctx.t(key, slots));
  return span;
}

/**
 * A record bounds by time; a computation bounds by admission order.
 *
 * **`'considered'` is the third, and it is not a synonym for `'admitted'`.**
 * The preview's spilled list draws the items the selector did NOT admit, so
 * "in the order the selector admitted them" would put the one word that card
 * exists to contradict directly under it. What is true of a spill is the order
 * the selector CONSIDERED it in — the same wording `ui/read-model.ts` uses of
 * the same field — and that order is load-bearing rather than decorative:
 * first-fit admits greedily, so `[4,9,4]` against a budget of 10 spills a
 * different item than `[9,1,5]` does.
 *
 * **`'position'` is the fourth, and it is the one that claims NOTHING about
 * order.** It landed 2026-08-29 with the Ask screen's result table, which is the
 * first bounded list here whose order is not this app's to describe: the rows
 * come back in whatever order the SERVER's `ORDER BY` chose, and that order is
 * different on every tab of the one table — newest-first on the audit tab, by
 * id on the corpus tab, by count on a predefined report. None of the three
 * sentences above is true of all three, and picking the closest would be a
 * claim about the answer rather than a reading of it.
 *
 * Saying nothing is honest HERE and would not be on the other four, which is
 * why this is a fourth member rather than a replacement. Those four bound lists
 * whose visible order is the argument for their contents — what the selector
 * admitted, what it considered, what a log did most recently — and a reader who
 * loses that loses the point of the list. The Ask table carries its order in
 * its own At column, on screen, beside every row; the bound line there only has
 * to say WHERE IN THE ANSWER the page sits, and row numbers say that without
 * borrowing a word from a `ORDER BY` this file cannot see.
 */
function orderKeyFor(spec) {
  if (spec.order === 'recent') return 'list.recentOf';
  if (spec.order === 'position') return 'list.positionOf';
  return spec.order === 'considered' ? 'list.consideredOf' : 'list.admittedOf';
}

/**
 * The same distinction, said with row numbers — for a page past the first,
 * where "the first N" and "the N most recent" have both stopped being true.
 * Two keys rather than one because the ORDER is the owner's own ruling and a
 * page that dropped it would leave a reader guessing which end is which.
 */
function rowsKeyFor(spec) {
  if (spec.order === 'recent') return 'list.rowsRecent';
  if (spec.order === 'position') return 'list.rowsPosition';
  return spec.order === 'considered' ? 'list.rowsConsidered' : 'list.rowsAdmitted';
}

export function boundedList(ctx, host, items, draw, spec) {
  const cap = spec.cap;
  const total = items.length;
  const bound = el('div', 'bound');
  const line = el('p', 'small');
  // **The line IS the announcement.** It already says where the reader is and
  // it is rewritten wholesale on every move, so making it live announces the
  // move in the same words the sighted reader gets. Weighed against a separate
  // visually-hidden region, which would say everything twice and would need a
  // `.visually-hidden` rule in `styles.css` — a file this change may not open,
  // and a second sentence to keep in step with this one forever.
  line.setAttribute('aria-live', 'polite');
  const button = el('button');
  button.type = 'button';

  let expanded = false;
  let page = 0;

  // **A list holding back nothing draws NO control**, and "no control" means
  // absent rather than `hidden` or `disabled` — *an inert control is the same
  // lie as a blank screen*. `items` is fixed for the life of this call, so
  // whether the cap bites is decidable once, here, and the two buttons are
  // never built when it does not.
  const paged = total > cap;
  const stepper = (name, key) => {
    const b = el('button');
    b.type = 'button';
    // A real `<button type="button">`: Enter and Space come free, it is in the
    // tab order, and it needs no key handler of its own. `type` is set because
    // every one of these lists can sit inside a form, where the default is
    // `submit`. No class — `.bound button` styles it from its ancestor, which
    // is the rule `e2e/button-contrast.spec.ts` exists to keep true, and a new
    // class here would need a stylesheet this change may not open.
    b.dataset.step = name;
    b.append(...ctx.t(key));
    return b;
  };
  const prev = paged ? stepper('prev', 'list.prevRows') : null;
  const next = paged ? stepper('next', 'list.nextRows') : null;
  // Reading order: where you are, then the two steps, then "show all". The
  // steps sit before the escape hatch because they are the answer to the
  // question the line just raised.
  bound.append(line);
  if (paged) bound.append(prev, next);
  bound.append(button);

  /** The `displayOnly` clause, or nothing — appended to EVERY capped state. */
  const promise = () => (spec.displayOnly === true
    ? [document.createTextNode(' '), sentence(ctx, 'list.displayOnly', { total: num(total) })]
    : []);

  const paint = () => {
    // **WHICH ROWS SURVIVE IS THE CLAIM THE SENTENCE MAKES**, so the slice has
    // to match it. A record surface whose rows arrive OLDEST FIRST — which is
    // how the design of record draws the injected table, ascending by its own
    // When column — keeps its most recent rows at the END. Slicing the head
    // there would show the oldest N under a sentence promising the newest N,
    // which is the exact failure this requirement exists to prevent: a sample
    // presented as a summary. The survivors are then drawn in their ORIGINAL
    // order, so the table's direction is unchanged and only its membership is.
    //
    // `pageWindow` is that same rule generalised to a page past the first, and
    // it is a pure function precisely so the rule can be asserted rather than
    // described (`test/ui/bounded-list.test.ts`).
    const at = pageWindow(total, cap, page, spec.take);
    page = at.page;
    const kept = expanded ? items : items.slice(at.start, at.end);
    host.replaceChildren(...kept.map((item, i) => draw(item, i)));

    if (total <= cap) {
      // Not a truncation, and it still says so. `STD-a-measured-zero-is-drawn`
      // governs the empty end of this; this is the other one.
      line.replaceChildren(sentence(ctx, 'list.allOf', { total: num(total) }));
      button.hidden = true;
      return;
    }
    button.hidden = false;
    if (expanded) {
      line.replaceChildren(sentence(ctx, 'list.allOf', { total: num(total) }));
      button.replaceChildren(...ctx.t('list.showFewer'));
      // Withdrawn rather than left disabled: a step control beside a list
      // showing everything says there is somewhere else to be, and there is
      // not. `hidden` and not removal, because the state reverses.
      prev.hidden = true;
      next.hidden = true;
      return;
    }
    prev.hidden = false;
    next.hidden = false;
    // `null` from `pageStep` is "this step does not exist", and it is the same
    // decision as "this control is inert" — one source, so the button and the
    // handler cannot come to disagree about where the list ends.
    prev.disabled = pageStep(page, at.pages, spec.take, 'prev') === null;
    next.disabled = pageStep(page, at.pages, spec.take, 'next') === null;

    // **Each sentence is its own `<span>`**, because that is how the design of
    // record carries a keyed sentence inside a paragraph that holds more than
    // one — `data-t` has to sit ON an element, and `applyLang` replaces that
    // element's children wholesale. Appending the nodes bare into the `<p>`
    // would render identically and diverge structurally, which is exactly the
    // kind of difference `screen-parity` exists to catch.
    if (page === 0) {
      // The opening page keeps the sentence it has always had. "Showing the
      // first 20 of 47" and "showing the 50 most recent of 120" are ALREADY
      // positions, and they carry the ORDER ruling in words the row-numbered
      // sentence has to shorten — so they are not replaced for the sake of a
      // uniform shape the reader gains nothing from.
      line.replaceChildren(
        sentence(ctx, orderKeyFor(spec), { shown: num(at.end - at.start), total: num(total) }),
        ...promise(),
      );
      button.replaceChildren(...ctx.t('list.showAll', { total: num(total) }));
      return;
    }
    // Off the opening page, "the first 20" and "the 50 most recent" would both
    // be FALSE, so the sentence becomes row numbers plus what the page left
    // out on both sides — `/api/coverage`'s own reading of a page.
    line.replaceChildren(
      sentence(ctx, rowsKeyFor(spec),
        { from: num(at.start + 1), to: num(at.end), total: num(total) }),
      document.createTextNode(' '),
      sentence(ctx, 'list.omittedBoth', { before: num(at.before), after: num(at.after) }),
      ...promise(),
    );
    button.replaceChildren(...ctx.t('list.showAll', { total: num(total) }));
  };

  button.addEventListener('click', () => { expanded = !expanded; paint(); });
  if (paged) {
    for (const [control, direction, sibling] of [[prev, 'prev', next], [next, 'next', prev]]) {
      control.addEventListener('click', () => {
        const landing = pageStep(page, pageWindow(total, cap, page, spec.take).pages,
          spec.take, direction);
        if (landing === null) return;
        page = landing;
        paint();
        // **A control that has just gone inert hands its focus on.** `disabled`
        // was chosen over `aria-disabled` because a disabled button is honestly
        // out of the tab order and needs no handler that quietly does nothing —
        // which is the inert control the requirement names. What it costs is
        // focus: a keyboard reader pressing Enter until the last page would
        // lose it to the document and have to tab back from the top. The
        // sibling is always live here, because a step that landed proves the
        // one back the way it came exists.
        if (control.disabled) sibling.focus();
      });
    }
  }
  paint();
  return bound;
}
