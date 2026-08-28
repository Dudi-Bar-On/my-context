/**
 * `nav.inj` — **Budget simulator**, `<section data-p="simulate">` in the design
 * of record. Drag a budget, watch what fits.
 *
 * It joins the hero's rail group and takes the pane/plate pattern that screen
 * establishes rather than inventing its own: the tier table is DATA, so it sits
 * on `.plate` inside the `.pane` the card already is (repaint Task 7 —
 * *"Text may float on glass. Data may not."*). The mockup already marks it that
 * way and this file copies the marking rather than deciding it.
 *
 * **THE STAIRCASE AND THE LADDER LANDED** (`#stair`, `#ladder`, with
 * `sim.stair`, `sim.stairn`, `sim.thresh` and `sim.snap`), reading
 * `GET /api/simulate/sweep` (`plan:walk seq:7`) — one server-side call that
 * runs the real selector at every cumulative candidate cost and returns the
 * rung list whole. No second implementation of `fitToBudget` lives here or
 * ever will: `core/select.ts` does not export it, and this screen was never
 * going to be the second place that rule got written.
 *
 * **The readout under the staircase** (`#readout`) is STILL refused, for a
 * reason the sweep does not touch. Its numbers are not the problem —
 * *"N in · M out · T tokens used"*, and the *"next in at …"* line beneath it,
 * are both derivable from data this screen already has. Its WORDS are: the
 * mockup builds that sentence out of English and Hebrew literals inside its
 * own script, under no `data-t`, and therefore under no key in either string
 * table. `test/ui/strings-parity.test.ts` fails on a key the design of record
 * does not declare, so the sentence cannot be worded here at all — and
 * spelling it out of keys that DO exist would put a different sentence on
 * screen under the mockup's name. Recorded as an open question for the owner:
 * the day `#readout` gets a `data-t`, it is ten lines, and none of them touch
 * the sweep this task built.
 *
 * **The stale sentence is gone.** `sim.stairn` used to say `itemCost` was
 * *"private in select.ts today: one export, and this chart is live"* — wrong
 * on both counts by the time this screen could read the mockup: `itemCost` is
 * `export`ed already (`core/select.ts`, with a docstring naming this
 * simulator as the reason), and `src/ui/read-model.ts`'s `/api/simulate` has
 * consumed it since Plan 1. Corrected in `en.js`, `he.js` and the mockup
 * together, because a stale sentence in one of the three is a stale sentence
 * a reader of any of the three would meet.
 *
 * The rest is what was always fully served: the tier picker, the budget
 * slider (which now SNAPS to a rung on every drag tick — `sim.snap` promises
 * it in prose, and a slider that does not snap under a sentence saying it
 * does is worse than the missing chart), the five-row fits table it drives,
 * and the spill ratio bar. Every number in the fits table comes from one
 * `/api/simulate` response, so the table cannot disagree with itself; every
 * number in the staircase and ladder comes from one `/api/simulate/sweep`
 * response, for the same reason one level up.
 *
 * **Two events, because five tiers do not live on one.** `tiersRun` is
 * `select.ts`'s own dispatch: `pinned`, `continuity`, `restored` and `index`
 * are reached by `compact`, and `jit` only by `tool`. `compact` is read for
 * the continuity row deliberately: it is the event where that tier's answer is
 * least obvious, because the window was REBUILT and the tier must re-deliver
 * even though the seen ledger already holds the item. So the screen holds two selections at
 * once and reads each tier's row off whichever one actually ran it. A tier
 * that neither event reached is drawn as absent, never as a zero — an empty
 * count would claim it ran and delivered nothing, which is a different fact.
 * The sweep follows the same split: `EVENT_FOR[tier]` is the one event that
 * event dispatch would ever route that tier through, so the sweep is never
 * asked a question `select()` itself would refuse.
 */
import { selectQuery } from '/lib/viewmodel.js';
import { el, errorNote, mono, num, screenHead, spaced } from '/screens/parts.js';

/** The mockup's five tracks, in its order. `select.ts`'s own tier names. */
const TIERS = ['pinned', 'jit', 'restored', 'continuity', 'index'];

/**
 * Which event reaches which tier, read off `tiersRun` rather than restated:
 * `compact` runs pinned + restored + index, and `tool` is the only event with a
 * jit target. One request each, and the tier being dragged has its override
 * applied to whichever of the two runs it. The sweep (`runSweep` below) reuses
 * this exact map, so a sweep is never sent under an event that would not have
 * reached the tier it is pricing.
 */
const EVENT_FOR = {
  pinned: 'compact', restored: 'compact', continuity: 'compact', index: 'compact', jit: 'tool',
};

/**
 * The mockup's own slider bounds: `min=0 max=12000 step=50`. `max` is a FLOOR
 * here, not the bound — see `sliderMaxFor`.
 */
const SLIDER = { min: '0', max: '12000', step: '50' };

/**
 * The slider's upper bound — the ONE function that decides it, and the ONE
 * seam every caller (`applyBound` below) goes through to apply it. Three
 * numbers are weighed, and the largest wins:
 *
 *   - `SLIDER.max` — the mockup's own 12,000, kept as a FLOOR so the control
 *     still spans a useful range on a corpus whose budgets and candidates are
 *     small (a real corpus that never approaches it, which is most of them,
 *     should still get a slider worth dragging).
 *   - the budget actually IN FORCE for this tier. Assigning `slider.value`
 *     above `max` silently CLAMPS — `input[type=range]`'s own behaviour — so
 *     this term is what keeps `e2e/simulate-slider.spec.ts` green: a slider
 *     that cannot reach the budget in force is drawing a number nobody set,
 *     whatever computes the rest of the bound.
 *   - the LAST RUNG of this tier's sweep, when one has been fetched. This is
 *     `plan:walk seq:7`'s own replacement for the old interim fix: once the
 *     sweep exists, admitting every candidate is the point past which raising
 *     the budget changes nothing, so it is the natural ceiling — not a round
 *     number chosen to look generous.
 *
 * **This function is the seam a later task extends, not a formula to
 * duplicate.** The owner's ruling mid-build: the slider's maximum is meant to
 * become a separately-set control later — "changed by its own control, not by
 * dragging the slider" — and this file must not foreclose that. Keeping the
 * arithmetic in this one function, called only through `applyBound`, is what
 * lets that land as an edit to the function body (a fourth term, a config
 * read) instead of a hunt through every place `slider.max` is assigned.
 * `rungs` is `null` before the sweep resolves and `[]` for a tier this event
 * would never reach or a `tool` event with no path — both fold to "nothing
 * swept yet", the same way `budgets === null` already folds to "nothing
 * simulated yet".
 */
function sliderMaxFor(budgets, tier, rungs) {
  const inForce = budgets === null ? 0 : Number(budgets[tier] ?? 0);
  const swept = rungs !== null && rungs.length > 0 ? rungs[rungs.length - 1].threshold : 0;
  return String(Math.max(Number(SLIDER.max), Number.isFinite(inForce) ? inForce : 0, swept));
}

/* ── The admission staircase and threshold ladder — `sv(tag, attrs)` is the
      mockup's own SVG factory, argument for argument (`screens/graph.js` and
      `screens/decay.js` carry the same three lines; a fourth copy is still
      cheaper than a shared module for three attributes and one loop). Styling
      comes from the shared `svg.chart` rules in `styles.css` (`.axis`,
      `.step`, `.nowline`, `.defline`, `text.mono`) — nothing here repeats them
      inline. Only `direction:ltr` is set on the root, for the reason
      `screens/decay.js`'s own header measured: an inherited `dir="rtl"` flips
      `text-anchor:start/end` a SECOND time on top of the mirroring `X()` and
      `anchor()` already do, which empties the label gutter rather than
      filling it from the other side. ── */
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const key of Object.keys(attrs)) node.setAttribute(key, String(attrs[key]));
  return node;
}
function svText(attrs, text) {
  const node = sv('text', attrs);
  node.textContent = text;
  return node;
}

/** The mockup's own chart box and pads (`renderStair`, mockup ~4068). */
const STAIR_W = 560;
const STAIR_H = 200;
const STAIR_PL = 32;
const STAIR_PR = 14;
const STAIR_PT = 12;
const STAIR_PB = 26;
/** How many x-axis ticks to draw, beyond the 0 the axis line already implies. */
const STAIR_X_TICKS = 4;
/** Extra viewBox rows under the axis when there is an omission to disclose. */
const STAIR_FOOT = 14;

/* ── CHART DENSITY — thin the axis, annotate the notable, say what you dropped
      ─────────────────────────────────────────────────────────────────────────
      `axisTicks` and `placeLabels` are the mockup's own two helpers (mockup
      ~3809, added with this change), transcribed the way `sv`/`svText` above
      are. They are here rather than inline because they are DECISIONS, and
      Spec §6 puts `screens/*.js` outside the tested surface: as pure functions
      of numbers they are pinned by `test/ui/simulate-screen.test.ts` with no
      `document` in the room, exactly as `screens/graph.js` pins `egoDrawing`
      and `screens/decay.js` pins `combTicks`.

      **WHY THEY EXIST, measured rather than supposed** (`plan:walk seq:62`).
      This staircase drew a y tick per integer and the word `eviction` once per
      eviction, unconditionally. The mockup's six hand-authored rungs never
      showed it. Driven with Playwright at 1440x900 against three corpora, at
      an IDENTICAL 1.6x scale in every one of them:

          surface        rungs   y ticks   eviction labels   overlapping pairs
          mockup             6         7                 1                   0
          this repository   18        19               ~15                many
          .demo-corpus     ~400        43               169               1881

      Scale was measured first and eliminated: viewBox 560x200 renders 896x320
      in both surfaces and the first text is 9.5px in both. The defect is
      DENSITY and only density, which is why nothing below touches a font size.

      **The rule is the design's own, not an invention.**
      `reports/uiux/sketches/05-dataviz.html` — the sketch these views were
      drawn from — states it three times in prose: its density rail merges
      consecutive same-state runs so *"3,800 directories become a few hundred
      rects"*; its recency comb annotates the ONE notable row with a callout
      (*"pinned, yet cold — it spilled"*) and leaves the other nine as bare
      markers; its ego graph caps at sixty *"with the overflow shown in the
      column it was cut from"*. Thin, annotate the notable, disclose the rest.
      The sketch's own staircase is the one graphic it never applied them to.

      **GEOMETRY IS IN VIEWBOX UNITS AND THE ARITHMETIC IS PESSIMISTIC.**
      `svg.chart{inline-size:100%}` scales the viewBox but NOT the text: a
      560-unit chart rendered 896 wide still draws `--fs-chart` at 10 CSS px,
      which is 6.25 viewBox units, not 10. A label therefore occupies FEWER
      units the wider the chart is drawn, and the only scale at which an
      estimate can be wrong in the dangerous direction is 1:1. Every width
      below is figured at 1:1, so a real render always has more room than the
      arithmetic assumed, never less. ── */

/** Advance per character at `--fs-chart` (10px, ≈0.6em) at 1:1, in viewBox units. */
const CHW = 6;
/** The line box one chart label occupies at that size, and the air around it. */
const LBH = 12;
const LBPAD = 4;
/** How close two axis tick labels may come before one of them has to go. */
const TICKGAP = 20;
/**
 * How many annotations a chart may carry before they stop being CALLOUTS and
 * become a labelling scheme. The sketch's recency comb annotates one row in ten
 * and its prose is explicit that this is the point: a callout says *look at this
 * one*, and a word beside every marker says nothing at all. Three is the most
 * that still reads as the former, and three of them at the pessimistic 1:1 width
 * take 144 of the staircase's 514 plotted units, so the cap binds before the
 * geometry does rather than after.
 */
const CALLOUTS = 3;

/**
 * The tick VALUES for a count axis `0..max` spanning `span` viewBox units:
 * every multiple of the smallest 1/2/5×10ⁿ step that keeps neighbours
 * `TICKGAP` apart, plus `max` itself, which is the one value a reader of a
 * count axis must be able to see.
 *
 * **At the mockup's six rungs the step is 1 and the answer is 0..6** — the
 * unconditional loop this replaces, value for value, so the design's own case
 * does not move a pixel. At eighteen it is `0 5 10 15 18`; at four hundred it
 * is `0 50 … 350 402`.
 */
export function axisTicks(max, span) {
  if (max <= 0) return [0];
  const need = (max * TICKGAP) / span;
  let i = 0;
  let step = 1;
  while (step < need) { i += 1; step = [1, 2, 5][i % 3] * 10 ** Math.floor(i / 3); }
  const ticks = [];
  for (let n = 0; n <= max; n += step) ticks.push(n);
  if (ticks[ticks.length - 1] !== max) {
    // The last multiple goes rather than the maximum, when the two would crowd.
    if (((max - ticks[ticks.length - 1]) * span) / max < TICKGAP) ticks.pop();
    ticks.push(max);
  }
  return ticks;
}

/**
 * Which annotations survive, decided in UNMIRRORED coordinates and projected
 * afterwards — the rule `screens/decay.js` states for `badpinOutward`, and for
 * the same reason: `scale(-1,1)` would reverse the glyphs too.
 *
 * `marks` is `{x, y, text, rank}` — the point being annotated and how much it
 * matters. They are offered the space in RANK order, so it goes to the most
 * informative labels rather than to whichever came first along the axis, and
 * one survives only if it is within `cap`, its box clears every box already
 * kept, and it stays inside `[left, right]`. A label that would run off the
 * reading end is turned around onto the other side of its own marker before it
 * is given up.
 *
 * `omitted` is not optional. `INV-nothing-is-dropped-silently` applies to a
 * chart exactly as it applies to a selection, and the caller draws the count.
 */
export function placeLabels(marks, left, right, off, cap) {
  const kept = [];
  const labels = [];
  const ordered = [...marks].sort((a, b) => b.rank - a.rank || a.x - b.x);
  for (const mark of ordered) {
    if (labels.length >= cap) break;
    const width = mark.text.length * CHW;
    let x = mark.x + off;
    let side = 'start';
    if (x + width > right) {
      x = mark.x - off;
      side = 'end';
      if (x - width < left) continue;
    }
    const x1 = side === 'start' ? x : x - width;
    const x2 = side === 'start' ? x + width : x;
    const clash = kept.some((b) => x1 < b.x2 + LBPAD && b.x1 < x2 + LBPAD
      && mark.y - LBH < b.y + LBPAD && b.y - LBH < mark.y + LBPAD);
    if (clash) continue;
    kept.push({ x1, x2, y: mark.y });
    labels.push({ x, y: mark.y, anchor: side, text: mark.text });
  }
  return { labels, omitted: marks.length - labels.length };
}

/* ── The unkeyed words — transcribed rather than declared, for the reason
      `screens/decay.js`'s own AXIS_ZERO/AXIS_UNIT/NEVER/BADPIN are: an SVG
      `<text>` or an `aria-label` attribute cannot hold an element, which is
      where every `data-t` key in this product lives. The mockup writes each
      of these as a `HEB ? … : …` ternary in its own script, under no key in
      either table. Raised in this task's report, alongside the ones
      `screens/decay.js` and `screens/graph.js` already carry. ── */
const STAIR_LABEL_EN = 'Admission staircase: items admitted as a function of the tier budget';
const STAIR_LABEL_HE = 'גרם מדרגות: כמות הפריטים המתקבלים כפונקציה של תקציב הרמה';
const EVICTION_EN = 'eviction';
const EVICTION_HE = 'פינוי';
const MORE_EN = ' more evictions';
const MORE_HE = ' פינויים נוספים';
const LADDER_ITEMS_EN = ' items';
const LADDER_ITEMS_HE = ' פריטים';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'sim.h', 'sim.v', 'sim.sub');

  let tier = 'jit';
  let files = null;
  let chosenPath = null;
  let budgets = null;
  /**
   * This tier's sweep: `null` before the first fetch resolves (or after one
   * fails — `drawStair`/`drawLadder` leave the plates as `runSweep`'s own
   * catch left them rather than blanking a message underneath itself), `[]`
   * for a tier this event never reaches, a `tool` event with no path, or the
   * `index` tier (out of scope — see `runSweep`), and otherwise the rung list
   * `GET /api/simulate/sweep` answered, oldest threshold first.
   */
  let rungs = null;

  // --- The admission staircase and threshold ladder ------------------------
  // The mockup's `<div class="card pane sim">`: two columns, the staircase
  // and its controls on the left, the ladder on the right — `.sim` is the
  // grid rule already shipped in `styles.css` for exactly this card.
  const simCard = el('div', 'card pane sim');

  const stairCol = el('div');
  const stairHead = el('h3');
  stairHead.append(...ctx.t('sim.stair'));
  const stairPlate = el('div', 'plate');
  stairPlate.id = 'stair';

  const ctl = el('div', 'simctl');
  const tierName = el('span', 'm', tier);
  tierName.id = 'tierName';
  const slider = el('input');
  slider.id = 'slider';
  slider.type = 'range';
  slider.min = SLIDER.min;
  slider.max = SLIDER.max;
  slider.step = SLIDER.step;
  // An `aria-label` is an ATTRIBUTE and cannot hold an element, which is the
  // sink `tFlat` exists for and the reason reaching for it is written down.
  slider.setAttribute('aria-label', ctx.tFlat('aria.tierBudget'));
  const budgetVal = el('span', 'm');
  budgetVal.id = 'budgetVal';
  ctl.append(tierName, slider, budgetVal);

  const tierPick = el('div', 'segbar');
  tierPick.id = 'tierPick';
  tierPick.setAttribute('role', 'group');
  tierPick.setAttribute('aria-label', ctx.tFlat('aria.tierpick'));

  // `#readout` is deliberately NOT built — see the header's second refusal.
  const stairNote = el('p', 'small');
  stairNote.append(...ctx.t('sim.stairn'));
  stairCol.append(stairHead, stairPlate, ctl, tierPick, spaced(stairNote));

  const ladderCol = el('div');
  const ladderHead = el('h3');
  ladderHead.append(...ctx.t('sim.thresh'));
  const ladderPlate = el('div', 'ladder plate');
  ladderPlate.id = 'ladder';
  // `{offrung}` is the mockup's own illustrative "6,050" — a number chosen to
  // BE arbitrary, since the sentence's whole point is that landing on any
  // specific off-rung value is what snapping prevents. It is not derived from
  // this tier's real rungs: the note is built once, before the first sweep
  // response exists to derive one from, and the claim it makes ("dragging
  // lands on meaning rather than on ___") holds for every tier and every
  // corpus alike, which a live number would not make any truer.
  const snapNote = el('p', 'small');
  snapNote.append(...ctx.t('sim.snap', { offrung: num(6050) }));
  ladderCol.append(ladderHead, ladderPlate, spaced(snapNote));

  simCard.append(stairCol, ladderCol);
  root.append(simCard);

  // --- The fits table -----------------------------------------------------
  const tableCard = el('div', 'card pane');
  const plate = el('div', 'plate');
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['sim.tier', 'sim.budget', 'sim.fits', 'sim.spills']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = el('tbody');
  tbody.id = 'simtbl';
  table.append(thead, tbody);
  plate.append(table);

  const chipNote = el('p', 'small');
  const evictHelp = el('details', 'help');
  const evictSummary = el('summary');
  evictSummary.append(...ctx.t('help.whyBudget'));
  const evictBox = el('div', 'helpbox');
  const evictText = el('span');
  evictText.append(...ctx.t('sim.evict'));
  evictBox.append(evictText);
  evictHelp.append(evictSummary, evictBox);
  tableCard.append(plate, spaced(chipNote), evictHelp);
  root.append(tableCard);

  // --- Selected, then not delivered ---------------------------------------
  // The mockup's third card, markup for markup: an `h3`, a `.plate` of
  // diverging bars, and `sim.ration` under it at the same 8px the other two
  // notes take. The heading and the note are built ONCE and unconditionally —
  // they are prose about a chart, and they stay true whether the projection
  // answers, is absent, or refuses. Only the plate's contents move.
  const ratioCard = el('div', 'card pane');
  const ratioHead = el('h3');
  ratioHead.append(...ctx.t('sim.ratio'));
  const ratioPlate = el('div', 'plate');
  const ratioNote = el('p', 'small');
  ratioNote.append(...ctx.t('sim.ration'));
  ratioCard.append(ratioHead, ratioPlate, spaced(ratioNote));
  root.append(ratioCard);

  /** The one place `slider.max` is ever assigned — see `sliderMaxFor`. */
  function applyBound() {
    slider.max = sliderMaxFor(budgets, tier, rungs);
  }

  /**
   * The staircase itself: `rungs` turned into an SVG, geometry for geometry
   * with the mockup's own `renderStair` (~4066), with one deliberate
   * departure — the x axis scales to THIS tier's own data (the last rung, the
   * budget in force and the budget being dragged, whichever is largest)
   * rather than the mockup's fixed 12,000, because `plan:walk seq:7` replaces
   * that literal outright and a fixed axis under a variable bound would just
   * move the same lie to a different number.
   */
  function drawStair() {
    stairPlate.replaceChildren();
    if (rungs === null || rungs.length === 0) return;

    const rtl = document.documentElement.dir === 'rtl';
    const X = (u) => (rtl ? STAIR_W - u : u);
    const anchor = (a) => (rtl ? (a === 'start' ? 'end' : a === 'end' ? 'start' : a) : a);

    const cur = Number(slider.value);
    const def = budgets === null ? 0 : Number(budgets[tier] ?? 0);
    const maxB = Math.max(rungs[rungs.length - 1].threshold, cur, def, 1);
    const maxN = Math.max(...rungs.map((r) => r.count), 1);
    const bx = (b) => STAIR_PL + (b / maxB) * (STAIR_W - STAIR_PL - STAIR_PR);
    const by = (n) => STAIR_H - STAIR_PB - (n / maxN) * (STAIR_H - STAIR_PT - STAIR_PB);

    const kids = [];
    kids.push(sv('line', {
      class: 'axis', x1: X(STAIR_PL), y1: STAIR_H - STAIR_PB, x2: X(STAIR_W - STAIR_PR),
      y2: STAIR_H - STAIR_PB,
    }));
    kids.push(sv('line', {
      class: 'axis', x1: X(STAIR_PL), y1: STAIR_PT, x2: X(STAIR_PL), y2: STAIR_H - STAIR_PB,
    }));
    for (const n of axisTicks(maxN, STAIR_H - STAIR_PT - STAIR_PB)) {
      kids.push(svText(
        { x: X(STAIR_PL - 6), y: by(n) + 3, 'text-anchor': anchor('end'), class: 'mono' },
        String(n),
      ));
    }
    for (let i = 0; i <= STAIR_X_TICKS; i++) {
      const t = Math.round((maxB * i) / STAIR_X_TICKS);
      kids.push(svText(
        { x: X(bx(t)), y: STAIR_H - STAIR_PB + 13, 'text-anchor': 'middle', class: 'mono' },
        num(t),
      ));
    }

    let d = '';
    let prev = null;
    const evicts = [];
    rungs.forEach((r, i) => {
      const x = X(bx(r.threshold));
      const y = by(r.count);
      if (i === 0) { d = `M ${x} ${y}`; } else {
        d += ` L ${x} ${by(prev.count)} L ${x} ${y}`;
        if (r.count < prev.count) {
          evicts.push({ threshold: r.threshold, count: r.count, drop: prev.count - r.count });
        }
      }
      prev = r;
    });
    kids.push(sv('path', { class: 'step', d }));
    // The MARKER is the datum and every eviction keeps one. The WORD is an
    // annotation, and one word per marker is what turned fifteen of them into
    // `evictionevictioneviction` and a hundred and sixty-nine of them into one
    // unbroken band: the biggest drops get it, in the space there actually is,
    // and the count of the rest is drawn under the axis.
    const word = rtl ? EVICTION_HE : EVICTION_EN;
    const placed = placeLabels(
      evicts.map((e) => ({ x: bx(e.threshold), y: by(e.count) - 8, text: word, rank: e.drop })),
      STAIR_PL, STAIR_W - STAIR_PR, 7, CALLOUTS,
    );
    for (const e of evicts) {
      kids.push(sv('circle', {
        cx: X(bx(e.threshold)), cy: by(e.count), r: 4, fill: 'var(--critbg)',
        stroke: 'var(--crit)', 'stroke-width': 1.6,
      }));
    }
    for (const label of placed.labels) {
      kids.push(svText(
        { x: X(label.x), y: label.y, 'text-anchor': anchor(label.anchor), fill: 'var(--crit)' },
        label.text,
      ));
    }
    // The foot exists only when there is something to disclose, so the six-rung
    // design of record keeps the `0 0 560 200` viewBox it has always had. Same
    // shape as `screens/decay.js`'s `+N older than the N sessions served`.
    const foot = placed.omitted > 0 ? STAIR_FOOT : 0;
    if (placed.omitted > 0) {
      kids.push(svText(
        {
          x: X(STAIR_PL), y: STAIR_H + 10, 'text-anchor': anchor('start'),
          fill: 'var(--crit)',
        },
        `+${num(placed.omitted)}${rtl ? MORE_HE : MORE_EN}`,
      ));
    }

    const defx = X(bx(def));
    kids.push(sv('line', { class: 'defline', x1: defx, y1: STAIR_PT, x2: defx, y2: STAIR_H - STAIR_PB }));
    const nowx = X(bx(cur));
    kids.push(sv('line', { class: 'nowline', x1: nowx, y1: STAIR_PT, x2: nowx, y2: STAIR_H - STAIR_PB }));
    // The budget being dragged is the axis's own last value whenever the slider
    // sits at its bound — `sliderMaxFor` makes the swept last rung the maximum —
    // and the label then ran off the reading end and printed itself a second
    // time over the x tick of the same number. Photographed doing exactly that
    // at 16,000. Same turnaround rule the eviction callouts use, chosen in
    // UNMIRRORED coordinates and projected after.
    const nowU = bx(cur);
    const nowOut = nowU + 5 + num(cur).length * CHW <= STAIR_W - STAIR_PR;
    kids.push(svText(
      {
        x: X(nowOut ? nowU + 5 : nowU - 5), y: STAIR_PT + 9,
        'text-anchor': anchor(nowOut ? 'start' : 'end'),
        fill: 'var(--gold)', class: 'mono',
      },
      num(cur),
    ));

    const svg = sv('svg', {
      viewBox: `0 0 ${STAIR_W} ${STAIR_H + foot}`,
      class: 'chart',
      role: 'img',
      // An accessible name is an ATTRIBUTE and cannot hold an element — see
      // the module header.
      'aria-label': rtl ? STAIR_LABEL_HE : STAIR_LABEL_EN,
    });
    svg.style.setProperty('direction', 'ltr');
    for (const kid of kids) svg.append(kid);
    stairPlate.append(svg);
  }

  /**
   * The threshold ladder: one row per rung, collapsed the way `rungs` already
   * arrived collapsed (the endpoint drops a threshold whose admitted count did
   * not change from the one before it, so every row here is meaningful). `.ev`
   * is `sim.snap`'s red rung — *"more budget, fewer items"* — and `.at` is the
   * highest rung at or below the budget currently being dragged, the mockup's
   * own rule (`renderStair`'s `rungs[...].classList.add('at')` line, read as a
   * fact about the LAST such rung rather than replayed as a mutation: the class
   * is decided before the row is built, not patched onto it afterwards, so the
   * three parts of this element's identity — tag, classes, content — are set
   * in one call the way every other element in this file is).
   */
  function drawLadder() {
    ladderPlate.replaceChildren();
    if (rungs === null || rungs.length === 0) return;

    const rtl = document.documentElement.dir === 'rtl';
    const cur = Number(slider.value);
    let atIndex = -1;
    rungs.forEach((rung, i) => { if (rung.threshold <= cur) atIndex = i; });
    rungs.forEach((rung, i) => {
      const ev = rung.evicted.length > 0;
      const classes = [ev ? 'ev' : null, i === atIndex ? 'at' : null].filter((c) => c !== null);
      const row = el('div', classes.length === 0 ? null : classes.join(' '));
      row.append(
        mono(num(rung.threshold)),
        el('span', null, (ev ? '▼ ' : '') + rung.count + (rtl ? LADDER_ITEMS_HE : LADDER_ITEMS_EN)),
      );
      ladderPlate.append(row);
    });
  }

  /**
   * `GET /api/simulate/sweep` for the CURRENT tier — one request, redrawing
   * both the staircase and the ladder from the one response, exactly as
   * `plan:walk seq:7` asks: *"Ship them together or not at all."*
   *
   * `index` is out of scope by construction — the endpoint refuses it (per-line
   * costs, not per-item; `apiSimulate`'s own docstring names the same gap) —
   * so this never asks the server a question it would 400 on; it draws the
   * absent state locally instead, the same way a `tool` event with no path
   * does for `jit`.
   */
  async function runSweep() {
    if (tier === 'index') {
      rungs = [];
      applyBound();
      drawStair();
      drawLadder();
      return;
    }
    const path = tier === 'jit' ? await ensurePath() : null;
    if (EVENT_FOR[tier] === 'tool' && path === null) {
      rungs = [];
      applyBound();
      drawStair();
      drawLadder();
      return;
    }
    const qs = selectQuery(
      EVENT_FOR[tier], EVENT_FOR[tier] === 'tool' ? path : null, ctx.session(), { tier },
    );
    try {
      const sweep = await ctx.api(`/api/simulate/sweep?${qs}`);
      rungs = sweep.rungs;
    } catch (error) {
      rungs = null;
      stairPlate.replaceChildren(errorNote(error.message));
      ladderPlate.replaceChildren();
      applyBound();
      return;
    }
    applyBound();
    drawStair();
    drawLadder();
  }

  function drawTierPick() {
    tierPick.replaceChildren();
    for (const name of TIERS) {
      const button = el('button', null, name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(name === tier));
      button.onclick = () => {
        tier = name;
        tierName.textContent = tier;
        // The old sweep belongs to the old tier — cleared immediately so the
        // stair and ladder never draw one tier's rungs under another's name
        // while the new sweep is in flight.
        rungs = null;
        // The bound first, then the value — the other order clamps, which is
        // the defect this pair exists to prevent. `applyBound` falls back to
        // the budget-in-force/floor terms until `runSweep` resolves and
        // refines it — never below what is about to be assigned.
        applyBound();
        if (budgets !== null) slider.value = String(budgets[tier]);
        drawStair();
        drawLadder();
        drawTierPick();
        void run();
        void runSweep();
      };
      tierPick.append(button);
    }
  }

  async function ensurePath() {
    if (files !== null) return chosenPath;
    const coverage = await ctx.api('/api/coverage');
    files = coverage.files.map((f) => f.path);
    chosenPath = files.length > 0 ? files[0] : null;
    return chosenPath;
  }

  /**
   * One request per event, with the dragged tier's override applied to whichever
   * of the two actually runs it.
   *
   * The `tool` request needs a path — `/api/select`'s grammar refuses
   * `event=tool` without one — and an empty repository has none. That case
   * answers `null` rather than a fabricated selection, and the jit row is drawn
   * absent, which is true: there is no file for a tool event to be about.
   */
  async function fetchBoth(value) {
    const path = await ensurePath();
    const override = value === null ? {} : { [tier]: value };
    const compactQs = selectQuery(
      'compact', null, ctx.session(), EVENT_FOR[tier] === 'compact' ? override : {},
    );
    const compact = ctx.api(`/api/simulate?${compactQs}`);
    if (path === null) return { compact: await compact, tool: null };
    const toolQs = selectQuery(
      'tool', path, ctx.session(), EVENT_FOR[tier] === 'tool' ? override : {},
    );
    return { compact: await compact, tool: await ctx.api(`/api/simulate?${toolQs}`) };
  }

  /**
   * One tier's row, off the response for the event that runs it.
   *
   * `fits` and `eligible` are counted from the SAME selection, so the ratio is
   * a ratio and not two numbers from two answers. The index tier counts LINES,
   * not entries — `IndexSummary.normative` is what was admitted and `truncated`
   * is what the index budget turned away — which is the same distinction
   * `/api/simulate`'s own note draws about why its `costs` table cannot size
   * that track.
   */
  function countFor(name, sim) {
    if (sim === null || !sim.tiersRun.includes(name)) return null;
    if (name === 'index') {
      const fits = sim.selection.index.normative.length;
      return { fits, spills: sim.selection.index.truncated, budget: sim.budgets.index };
    }
    return {
      fits: sim.selection.full.filter((e) => e.tier === name).length,
      spills: sim.selection.spilled.filter((s) => s.tier === name).length,
      budget: sim.budgets[name],
    };
  }

  function drawTable(both) {
    tbody.replaceChildren();
    let current = null;
    for (const name of TIERS) {
      const sim = EVENT_FOR[name] === 'tool' ? both.tool : both.compact;
      const counts = countFor(name, sim);
      const row = el('tr');

      // The tier cell is a `.m` run, not a chip: the mockup reserves the chip
      // in this table for the fits RATIO and the spill count, and a second chip
      // in the same row would claim the tier name were a verdict too.
      const c1 = el('td');
      c1.append(mono(name));
      const c2 = el('td');
      const c3 = el('td');
      const c4 = el('td');

      if (counts === null) {
        // Absent, not empty. The tier was never reached by either event this
        // screen asks about, so it has no budget spent and no items turned
        // away; a `0` in these cells would claim it ran.
        c2.append(mono('—'));
        c3.append(mono('—'));
        c4.append(mono('—'));
      } else {
        const eligible = counts.fits + counts.spills;
        c2.append(mono(num(counts.budget)));
        // The fits column is a RATIO, as `sim.chipn` says. It is written with a
        // solidus rather than the mockup script's `' of '`: that word is an
        // unkeyed English literal in the mockup's own demo loop, with no key in
        // either string table, and shipping it would put untranslated English
        // inside a Hebrew sentence. Recorded as an open question for the owner.
        const chip = el('span', `chip ${counts.spills > 0 ? 'warn' : 'ok'}`);
        chip.dataset.g = counts.spills > 0 ? '▲' : '●';
        chip.textContent = `${num(counts.fits)}/${num(eligible)}`;
        c3.append(chip);
        if (counts.spills > 0) {
          const spillChip = el('span', 'chip warn', num(counts.spills));
          spillChip.dataset.g = '▲';
          c4.append(spillChip);
        } else {
          c4.append(mono('0'));
        }
        if (name === tier) current = { fits: counts.fits, eligible };
      }
      row.append(c1, c2, c3, c4);
      tbody.append(row);
    }

    // `sim.chipn` quotes the ratio it is explaining, so it quotes the row being
    // dragged. A tier neither event reached has no ratio to quote and the note
    // stands down rather than quoting a fabricated one.
    chipNote.replaceChildren();
    if (current !== null) {
      chipNote.append(...ctx.t('sim.chipn', {
        fits: num(current.fits), eligible: num(current.eligible),
      }));
    }
  }

  /**
   * One half of one diverging bar — the mockup's `isz(el('i'), pct)`, without
   * the `style` attribute it writes there. `inline-size` is the LOGICAL
   * property, so the Hebrew page mirrors the whole chart for free; the mockup's
   * own comment over `.div-row` says that is why both halves were written
   * logically in the first place.
   *
   * A count of zero draws NO `<i>` at all, exactly as the mockup does — a
   * zero-width bar with a border on it is a mark on the screen where nothing
   * happened. A count of `null` is the OTHER thing and draws nothing either:
   * `spillRatio` answers `null` where a role tally filled its window, meaning
   * the number is below a cutoff and unknown rather than zero, and a bar is a
   * magnitude claim this side has no magnitude for.
   */
  function ratioHalf(cls, count, max) {
    const half = el('div', cls);
    if (count !== null && count > 0) {
      const bar = el('i');
      bar.style.setProperty('inline-size', `${(count / max) * 100}%`);
      half.append(bar);
    }
    return half;
  }

  /** `12/22`, and the `—` this screen already uses for a number nobody measured. */
  function tally(count) {
    return count === null ? '—' : num(count);
  }

  /**
   * `GET /api/watch/ratio`'s rows as the mockup's `renderRatio` draws them:
   * name, delivered half, spilled half, `delivered/spilled`.
   *
   * **The normalisation is over BOTH halves of ALL rows**, which is what
   * `sim.ration` promises — *"both normalised to the largest count in the
   * table"* — and it is the difference between a chart you can compare across
   * rows and four rows each drawn against itself. `null`s are excluded from the
   * maximum rather than read as zero, for the reason `ratioHalf` gives.
   *
   * The rows arrive already ordered, longest red half first, and are NOT
   * re-sorted here: `spillRatio` ranks them and documents why a `null` sorts
   * below a measured zero, and a second ordering in the client is a second
   * opinion about the same question.
   */
  function drawRatio(rows) {
    ratioPlate.replaceChildren();
    const measured = rows.flatMap((r) => [r.delivered, r.spilled]).filter((n) => n !== null);
    // `1` rather than `0`: an all-zero table would divide by zero and every bar
    // would be `NaN%`, which the browser drops on the floor silently.
    const max = Math.max(...measured, 1);
    for (const row of rows) {
      const line = el('div', 'div-row');
      const name = el('span', 'div-name', row.id);
      // `.div-name` ellipsises, so the full id has to survive somewhere. A
      // `title` is an ATTRIBUTE sink and an item id is a literal, not a
      // translated string, so nothing goes through `tFlat` here.
      name.setAttribute('title', row.id);
      line.append(
        name,
        ratioHalf('div-l', row.delivered, max),
        ratioHalf('div-r', row.spilled, max),
        el('span', 'div-n', `${tally(row.delivered)}/${tally(row.spilled)}`),
      );
      ratioPlate.append(line);
    }
    // The mockup's key row: an empty cell, the two words under their own
    // halves, an empty cell. A legend under no bars is a legend for nothing, so
    // it is drawn only when there are bars.
    //
    // **Both words are keys that already exist, and neither is new.** The
    // mockup writes them as bare English/Hebrew literals in its script, under
    // no `data-t`, so this screen has no key of its own for them and may not
    // invent one — `strings-parity` fails a key the design of record does not
    // declare. `preview.delivered` and `sim.spills` are the same two words in
    // the same two languages, already declared and already on screen: in
    // Hebrew they are the mockup's legend verbatim (`נמסר`, `נשפך`), and in
    // English they differ only in being the table's own column headings
    // ("Delivered", "Spills") rather than the legend's lowercase. Borrowing the
    // fits table's word for the fits table's quantity is the reading that keeps
    // the two halves of this screen agreeing; recorded for the owner all the
    // same.
    if (rows.length === 0) return;
    const key = el('div', 'div-row');
    const delivered = el('span', 'div-n');
    delivered.append(...ctx.t('preview.delivered'));
    const spilled = el('span');
    spilled.append(...ctx.t('sim.spills'));
    key.append(el('span'), delivered, spilled, el('span'));
    ratioPlate.append(key);
  }

  let pending = null;

  async function run(value = Number(slider.value)) {
    budgetVal.textContent = num(value);
    try {
      const both = await fetchBoth(String(value));
      drawTable(both);
    } catch (error) {
      tbody.replaceChildren();
      chipNote.replaceChildren(errorNote(error.message));
    }
  }

  slider.oninput = () => {
    // Snap to a rung, on every tick — the mockup's own `renderStair`
    // (~4149) does this synchronously, before anything is redrawn, so a
    // slider that never touches a fetch still lands on meaning rather than on
    // an arbitrary value between two of them.
    if (rungs !== null && rungs.length > 0) {
      const thresholds = rungs.map((r) => r.threshold);
      const v = Number(slider.value);
      slider.value = String(
        thresholds.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), thresholds[0]),
      );
    }
    budgetVal.textContent = num(Number(slider.value));
    drawStair();
    drawLadder();
    clearTimeout(pending);
    pending = setTimeout(() => { void run(); }, 150);
  };
  ctx.onSessionChange(() => { void run(); void runSweep(); });

  drawTierPick();
  try {
    // The defaults, from the config the server is running on — never a literal
    // in this file. The mockup's `TIER_BUDGET` is demo data; `budgets` on the
    // response is `Config.budgets`, which is what a reader is dragging away
    // from and needs to be able to drag back to.
    const both = await fetchBoth(null);
    budgets = both.compact.budgets;
    // The bound BEFORE the value. Assigning above `max` clamps silently, so the
    // other order draws a budget nobody set — see `sliderMaxFor`. This is the
    // first of the three places `applyBound` runs; the tier buttons and
    // `runSweep`'s own resolution are the other two, and all three go through
    // the one function.
    applyBound();
    slider.value = String(budgets[tier]);
    budgetVal.textContent = num(budgets[tier]);
    drawTable(both);
  } catch (error) {
    chipNote.replaceChildren(errorNote(error.message));
  }
  // Independent of the table fetch above, and never awaited ahead of it: the
  // sweep is its own request over its own endpoint, and a slow or failed sweep
  // must not hold up the fits table this screen already served reliably.
  void runSweep();

  /**
   * The spill ratio, once. It reads HISTORY — how often each item was delivered
   * and how often it was selected and could not be fitted — so it follows
   * neither the slider nor the tier picker nor the session, and re-fetching it
   * on a drag would be one request per rung for an answer that cannot have
   * changed. The language toggle re-runs `render()`, which is what repaints it.
   *
   * **Its own try/catch, and deliberately not the table's.** `/api/watch/ratio`
   * refuses with a 503 whenever the audit projection is behind its log — which
   * is not a hypothetical, it is this repository's most-repeated operational
   * state — and a shared catch would blank the fits table, which is served by a
   * different endpoint reading a different store and is still perfectly true. A
   * refusal is drawn in the SERVER'S OWN WORDS and INSTEAD of the bars, never
   * beside an empty plate: an endpoint that refused and a projection holding no
   * spills are two facts, and the second one draws an empty plate on purpose.
   */
  try {
    // No `limit`: the endpoint's own default is ten and its header says where
    // that line is drawn and why. A number here would be a second opinion.
    const ratio = await ctx.api('/api/watch/ratio');
    drawRatio(ratio.rows);
  } catch (error) {
    ratioPlate.replaceChildren(errorNote(error.message));
  }
}
