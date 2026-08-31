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
 * **The readout under the staircase (`#readout`) IS BUILT**, 2026-08-31, and
 * the standing refusal recorded here is discharged rather than restated. That
 * refusal was WRONG for three days before it was merely obsolete: it said
 * `test/ui/strings-parity.test.ts` "fails on a key the design of record does
 * not declare" — a direction dropped on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`. Re-measured
 * against the gate's own docstring on 2026-08-30: it has ONE mockup-facing
 * check, the GAP direction, and a key the mockup never drew passes it.
 *
 * **The WORDS are the design of record's own; only the KEYS are new.**
 * `sim.readout`, `sim.nextin` and `sim.evictw` carry `renderStair`'s three
 * sentences out of the `HEB ? … : …` ternaries it wrote them in, English and
 * Hebrew both, verbatim. The key was the forbidden part and is not forbidden
 * any more, so nothing here was drafted that the mockup had not already said.
 *
 * **THE SCREEN CAN NOW ASK THE COLD QUESTION** (`plan:walk seq:86`). Until
 * 2026-08-31 this file contained the string `cold` zero times: it always sent
 * `ctx.session()`, so *what would a brand-new window get* was reachable from
 * `curl` and from nowhere in the product. Measured on this repository, same
 * event, only that parameter differing — `session=<id>` answered
 * `pinned 1 of 1` where `cold=1` answered `pinned 24 of 25`, and the fits table
 * drew `restored 0 of 0` and `continuity 0 of 0` while 104 items sat removed
 * one gate earlier, accounted for in no cell of it. The warm question stays the
 * DEFAULT and cold is offered, labelled, and never silently substituted; the
 * `seen` count `/api/simulate` has served since 2026-08-29 is drawn and named,
 * and a tier reading `0 of 0` says which of the two emptinesses it is.
 *
 * **The budget blocks below the table are `plan:budget seq:2, 3, 4 and 6`**,
 * built in that order because each assumes the last: a recommendation that
 * carries its three derived numbers, a validation over all five budgets against
 * the whole window that REFUSES rather than guessing one, the next step a full
 * window has, and the pairing plus the one control that puts an edit back.
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
 * **THE SLIDER HAS A RANGE CONTROL, AND THE SNAP IS GONE** (2026-08-29,
 * `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget`). Two
 * changes, one defect: measured in a browser against this corpus, the thumb
 * started pinned hard right — `value === max === 16000`, by construction,
 * because the budget in force WAS the bound — and every click on the track
 * landed on one of eighteen rungs clustered below 1,550. The screen whose
 * subtitle reads *"Raising a budget can evict an item"* could not be dragged
 * rightwards at all. The range maximum is now a Config-style number with a
 * button that commits it (`sliderMaxFor`'s fourth term, and the store above
 * it), and the thumb steps in single tokens and stays under the pointer
 * (`slider.oninput`). `sim.snap`'s prose was corrected in both string tables
 * and in the mockup to describe what ships.
 *
 * The rest is what was always fully served: the tier picker, the budget
 * slider, the five-row fits table it drives,
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
import {
  el, errorNote, mono, num, screenHead, setSimRange, simRangeFor, spaced,
} from '/screens/parts.js';

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
 * The slider's bounds. `min` and `max` are the mockup's own (`max` is a FLOOR
 * here, not the bound — see `sliderMaxFor`); `step` is NOT, and the difference
 * is the point.
 *
 * **`step` was the mockup's `50` and is now `1`, by owner instruction**, 2026-
 * 08-28: *"the slide resolution is coarse and actually unusable it should slide
 * smoothly with much smaller steps."* `DEC-the-mockup-governs-presentation-
 * never-behaviour-and-a` is why that is not a contradiction to weigh: how a
 * control responds to a drag is BEHAVIOUR, and the mockup has no standing over
 * it. The mockup's own attribute and its `sim.snap` prose were corrected to
 * match what ships, because a design document asserting a behaviour the app
 * does not have is worse than silent.
 *
 * **And the SNAP that used to sit on top of it is gone with it** — see
 * `slider.oninput` for the whole argument. In one line: the thumb now lands
 * where the pointer put it, and the rung that actually governs is REPORTED (the
 * ladder's `.at` row, the staircase's own step path) rather than enforced by
 * dragging the thumb away from the reader's finger.
 */
const SLIDER = { min: '0', max: '12000', step: '1' };

/**
 * **The fraction the second recommendation lets the corpus grow by**
 * (`plan:budget seq:2`: *"that cost with headroom for the corpus to grow by a
 * stated fraction"*). Stated, and stated ON SCREEN — `sim.recGrown` carries it
 * as a `{pct}` slot rather than baking "20%" into the sentence, so the number a
 * reader is offered and the number this constant holds cannot drift apart.
 *
 * A FRACTION and not a token count, for `HandoverConfig.thresholdPercent`'s own
 * reason one level up: a fixed number of tokens of headroom means something
 * different on a corpus of twenty items and one of two thousand, and the thing
 * being grown is the corpus.
 */
const GROWTH = 0.2;

/**
 * **The working reserve — the one open choice `plan:budget seq:3` left, closed
 * here as a FRACTION of the window and recorded as a decision.**
 *
 * The task's words: *"A budget that technically fits and leaves nothing to work
 * in is still wrong. Whether that reserve is stated as a number or a fraction is
 * the one open choice here."* A fraction, because the window it is a reserve of
 * is not a constant — this machine reports 1,000,000 and the same product runs
 * against 200,000 — and a reserve of "50,000 tokens" is a fifth of one window
 * and a quarter of the other. The percentage is drawn in every sentence that
 * uses it (`{res}`, `{pct}`), so it is never an invisible policy.
 *
 * A quarter is a judgement and is the owner's to change; it is one constant and
 * one number in four strings.
 */
const RESERVE = 0.25;

/**
 * **The question this screen is answering, restored across renders** — the
 * injection preview's `PICKED`, for the reason written there: the question a
 * reader pressed is reader state that no fetch carries, and a `render()` that
 * resets it to warm (a language toggle, a return to the route) is answering a
 * question they had already left.
 *
 * `'live'` is the default and stays the default. `plan:walk seq:86`'s ruling,
 * inherited from the preview: cold is a second, equally legitimate question and
 * must be reachable and LABELLED, never silently substituted.
 */
const PICKED = { mode: 'live' };

/**
 * The typed range maximum, validated — or `null`, which is a REFUSAL and never
 * a clamp.
 *
 * Deliberately `requirePositiveIntegerBudget`'s own grammar
 * (`src/core/budgets-write.ts`): a run of digits, parsed, and a positive
 * integer or nothing. The owner asked for *"a control like in config"*, and a
 * control that looks like Configure's while accepting what Configure refuses is
 * a second spelling of the rule, which is the thing that ruling exists to
 * avoid. The SERVER is not in this path at all — no budget is being written —
 * so this is the whole validator rather than a hint in front of one.
 */
function parseRangeMax(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
 * **THE FOURTH TERM LANDED, and it is the one this function was kept in one
 * piece for.** The seam this docstring reserved — *"the slider's maximum is
 * meant to become a separately-set control later"* — is now the range control
 * below, and the edit is what was promised: a term in this body, not a hunt
 * through every place `slider.max` is assigned.
 *
 * It does not join the `Math.max`. **A range the reader SET REPLACES the
 * derived default**, because the three terms above are a guess at a useful
 * range and an explicit number is not a guess — folding it into the same
 * `max()` would mean the range could only ever be raised, and *"a maximum that
 * can only be changed by dragging into it cannot be lowered at all"* is half
 * the defect this task exists to fix. So a reader on a small corpus can set 800
 * and get 800, below the 12,000 floor, and the staircase finally spreads over
 * the rungs that exist.
 *
 * **One term survives the replacement: the budget in force.** A range below it
 * would clamp `slider.value` and draw a number nobody set, which is the exact
 * defect `e2e/simulate-slider.spec.ts` pins and the one property all four
 * designs of this bound have had to keep.
 *
 * `rungs` is `null` before the sweep resolves and `[]` for a tier this event
 * would never reach or a `tool` event with no path — both fold to "nothing
 * swept yet", the same way `budgets === null` already folds to "nothing
 * simulated yet".
 */
function sliderMaxFor(budgets, tier, rungs) {
  const raw = budgets === null ? 0 : Number(budgets[tier] ?? 0);
  const inForce = Number.isFinite(raw) ? raw : 0;
  const set = simRangeFor(tier);
  if (set !== null) return String(Math.max(set, inForce));
  const swept = rungs !== null && rungs.length > 0 ? rungs[rungs.length - 1].threshold : 0;
  return String(Math.max(Number(SLIDER.max), inForce, swept));
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

      **GEOMETRY IS IN VIEWBOX UNITS, AND SINCE 2026-08-29 THOSE UNITS ARE
      PIXELS.** `svg.chart{inline-size:100%}` used to scale the viewBox but NOT
      the text: a 560-unit chart rendered 896 wide still drew `--fs-chart` at
      10 CSS px, which is 6.25 viewBox units, not 10. A label therefore
      occupied FEWER units the wider the chart was drawn, and the only scale at
      which an estimate could be wrong in the dangerous direction was 1:1 —
      which is why every width below was figured at that 1:1. The chart is now
      BOUND at its own viewBox width (`svg.chart{max-inline-size:100%}` over a
      `width` attribute, mockup ~1025/4193), so 1:1 is no longer the
      pessimistic bound but the case that actually renders, and `CHW` is the
      true advance rather than an upper one. Not one number below moved: the
      arithmetic was already written for exactly this. ── */

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

/**
 * This module's own unsubscribe from the shell's session listeners, if any.
 *
 * `screens/preview.js`' note carries the argument. Taken here even though this
 * screen cannot hold two renders — see `render()`'s own note on why it cannot
 * — because the accumulation is a defect on its own terms: three visits to
 * `#/simulate` used to leave three listeners, so one session change fired
 * three `run()` + `runSweep()` pairs, which is six requests for one answer.
 */
let dropSessionListener = null;

export async function render(root, ctx) {
  if (dropSessionListener !== null) {
    dropSessionListener();
    dropSessionListener = null;
  }

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
  /**
   * The context window this session is running in, or `null` — which is a
   * REFUSAL and never a zero.
   *
   * `{ size, used }` when `GET /api/watch/context` carried a `known` sample with
   * a window size, and `null` for every other state that endpoint can answer:
   * no bridge, no sample for this session, a sample Claude Code's schema has
   * moved under, or a `not-yet-known` reading between a compaction and the next
   * API call. All four collapse here on purpose — the ACT is the same for all of
   * them and `sim.winNone` names it — while the thing that must never collapse
   * is `null` into `0`, which is what would turn "we never measured" into "the
   * window is empty".
   */
  let win = null;
  /**
   * The ids `select`'s own `seen` gate removed under the question being asked —
   * `/api/simulate`'s `seenFiltered`, which this screen never used to request.
   * `[]` is a MEASURED zero (a cold question always reads zero, correctly) and
   * is a different fact from the response not having been read yet, which is
   * why the first paint draws nothing until one lands.
   */
  let seenOut = [];
  /** The last `/api/simulate` pair, so a redraw needs no refetch. */
  let lastBoth = null;

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
  /* ── `16,000 → 22,000` — WHAT IT WAS, BESIDE WHAT IT IS ────────────────────

     `plan:budget seq:6`, the owner's own complaint: *"after changing the
     controls the user does not know what it was if he does not want to apply his
     changes"*. The screen used to hold ONLY the dragged value, so the number you
     dragged away from was gone the moment you dragged.

     It is drawn WHILE editing and not on apply, which is the whole point of the
     task: *"by the time the confirm renders, the reader has already lost the
     value they were deciding about"*. And it is DERIVED — `budgets[tier]` is
     `Config.budgets` off the same `/api/simulate` response the rest of this
     screen reads, the pairing `diffBudgets` computes server-side for Configure's
     confirm — so there is no second source to disagree with.

     The arrow is a bare `→` and carries no key: it is a MARK, not a word, and
     `sim.wasn` under the control is the sentence that says which side is which
     without naming a reading direction that flips under `dir="rtl"`. */
  const inForceVal = el('span', 'm');
  inForceVal.id = 'inForce';
  const budgetVal = el('span', 'm');
  budgetVal.id = 'budgetVal';
  ctl.append(tierName, slider, inForceVal, ' → ', budgetVal);

  /* ── The range control — a Config-style number and a button that commits it ──

     RULED by the owner 2026-08-28 after a sub-slider was weighed against it:
     *"a control like in config"*, and *"upon setting it we should have a button
     to update it the same we does in the config"*. So the shape is Configure's
     Budgets card, part for part — `div.cmdactions` holding an
     `input[type=number]` and a button, with a `div.execresult[role=status]`
     underneath for the receipt — and not a second spelling of it. No rule in
     `styles.css` is added: every class here already exists and is already held
     to the mockup byte for byte by `test/ui/styles-parity.test.ts`.

     **It is NOT Configure's write, and the difference is the whole design.**
     Configure's button writes `config.json` behind a confirm and a single-use
     nonce, because it changes what the product does. This one changes what this
     screen can show, so it commits to the range store and nothing else: no
     confirm, no nonce, no `POST`. What it shares is the SHAPE the owner asked
     for — a field that does nothing until a button is pressed, and a receipt
     saying what happened — because *"setting a range is an act with a receipt,
     not a silent field"*.

     The accepted cost, named in the ruling so nobody rediscovers it as a bug:
     typing shows nothing until the button is pressed, on a screen whose subject
     is watching a number move. The recorded alternative is the sub-slider. ── */
  const rangeCtl = el('div', 'cmdactions');
  rangeCtl.id = 'rangectl';
  const rangeLabel = el('label', 'small');
  rangeLabel.htmlFor = 'rangeMax';
  rangeLabel.append(...ctx.t('sim.rangeh'));
  const rangeMax = el('input', 'm');
  rangeMax.id = 'rangeMax';
  rangeMax.type = 'number';
  // A UX hint only, exactly as the Budgets card says of its own pair: the
  // refusal lives in `parseRangeMax`, and a browser that ignored both attributes
  // would still be refused by name rather than clamped.
  rangeMax.min = '1';
  rangeMax.step = '1';
  // The same raw, untranslated spelling Configure's budget inputs use
  // (`budgets.jit`) — an identifier a test can select on in either language,
  // not a sentence.
  rangeMax.setAttribute('aria-label', 'simulate.rangeMax');
  const rangeGo = el('button');
  rangeGo.type = 'button';
  rangeGo.append(...ctx.t('sim.rangebtn'));
  const rangeSaid = el('div', 'execresult');
  rangeSaid.hidden = true;
  rangeSaid.setAttribute('role', 'status');
  rangeCtl.append(rangeLabel, rangeMax, rangeGo, rangeSaid);

  const rangeNote = el('p', 'small');
  rangeNote.append(...ctx.t('sim.rangen'));

  /* ── ONE CONTROL THAT PUTS IT BACK ─────────────────────────────────────────

     `plan:budget seq:6`'s first half: *"One control that discards the edits and
     puts the inputs back to what `config.json` holds. It also answers 'has
     anything changed at all' — it is only enabled when something has."*

     It lives in a `.cmdactions` of its own rather than beside the thumb, for a
     reason that is not layout: every button this app builds must be styled by
     something (`e2e/button-contrast.spec.ts`), and `.cmdactions button` and
     `.segbar button` are the two rules `styles.css` has. A bare button dropped
     into `.simctl` would be the one control on this screen with no rule behind
     it, and no rule may be added here — the stylesheet is not this task's file.

     **It restores the SIMULATION, and writes nothing.** Configure's Restore
     would be a different control on a different screen with `config.json` behind
     it; this one puts the slider back to the budget in force and clears every
     range a reader set, which is the whole of what this screen holds. */
  const restoreCtl = el('div', 'cmdactions');
  restoreCtl.id = 'restorectl';
  const restoreGo = el('button');
  restoreGo.type = 'button';
  restoreGo.append(...ctx.t('sim.restore'));
  restoreGo.disabled = true;
  restoreCtl.append(restoreGo);

  const wasNote = el('p', 'small');
  wasNote.append(...ctx.t('sim.wasn'));

  const tierPick = el('div', 'segbar');
  tierPick.id = 'tierPick';
  tierPick.setAttribute('role', 'group');
  tierPick.setAttribute('aria-label', ctx.tFlat('aria.tierpick'));

  /* ── THE QUESTION: this session, or a brand-new one ────────────────────────

     **`plan:walk seq:86`, and it is the preview's answer copied rather than a
     second design.** Measured on this screen before the change: it contained the
     string `cold` zero times, always sent `ctx.session()`, and could therefore
     only ever ask the warm question. Same corpus, same event, only that
     parameter differing — `session=<id>` answered `full: 1, spilled: 0` where
     `cold=1` answered `full: 25, spilled: 1`, and the fits table drew
     `restored 0 of 0` and `continuity 0 of 0` with no way to ask why.

     **THE DEFAULT DOES NOT MOVE.** Warm is what the session in the strip would
     actually be given now; cold is offered, LABELLED, and never silently swapped
     in. That ruling was taken on the preview and it carries here unchanged: a
     reader who cannot tell which of the two they are looking at is worse off
     than one who could only ever see the first.

     The three strings are the design of record's own — `sess.cold`,
     `sess.coldn` and `preview.qwarmn`, already declared, already on screen one
     route away. Borrowing them rather than inventing three is the same reading
     `drawRatio`'s legend takes below: a second spelling of a word is how two
     surfaces come to disagree about it. Only the NOTE is this screen's own,
     because `preview.qnote` names a file picker this screen does not have.

     `simq`, not `qpick`: the router keeps every visited screen inside `#screen`,
     merely hidden, so the preview's `#qpick` is still in the document when this
     one draws. Two elements under one id is a defect whether or not this file
     ever queries by it. */
  let sessionMode = PICKED.mode;
  const qbar = el('div', 'segbar');
  qbar.id = 'simq';
  qbar.setAttribute('role', 'group');
  qbar.setAttribute('aria-label', ctx.tFlat('sess.title'));
  const qNote = el('p', 'small');
  qNote.append(...ctx.t('sim.qnote'));

  /**
   * The session every `/api/simulate` and `/api/simulate/sweep` call on this
   * screen carries — `'cold'` is `selectQuery`'s own sentinel for `cold=1` and
   * is not a session id (`lib/viewmodel.js`).
   *
   * A shell with no sessions at all already answers `'cold'` from
   * `ctx.session()`, so the two states collapse there, correctly: there is no
   * warm question to ask, and `drawQ` draws one button rather than an inert
   * second one.
   */
  const sessionFor = () => (sessionMode === 'cold' ? 'cold' : ctx.session());

  /* ── THE READOUT, BUILT ────────────────────────────────────────────────────

     The mockup's `<div class="readout" id="readout">`, and the module header's
     standing refusal of it is DISCHARGED rather than repeated. The refusal was
     never about the sweep: its WORDS were unkeyed English/Hebrew ternaries in
     the mockup's own script, and inventing a key used to fail
     `strings-parity` — a direction `DEC-the-app-is-what-is-built-the-mockup-is-
     history-and-a` dropped on 2026-08-26.

     So the keys are new and the WORDS ARE NOT: `sim.readout`, `sim.nextin` and
     `sim.evictw` carry `renderStair`'s own three sentences, English and Hebrew,
     lifted out of its ternaries verbatim. What is new is the key, which is the
     part the gate forbade and no longer does. */
  const readout = el('div', 'readout');
  readout.id = 'readout';

  const stairNote = el('p', 'small');
  stairNote.append(...ctx.t('sim.stairn'));
  // The range control sits directly under the slider it bounds, and above the
  // tier picker, because the range is per TIER and reading it any other way
  // round invites the belief that one number bounds all five. The restore
  // control follows both, because it is what puts either of them back; the
  // question strip follows the tier picker, because "which tier" and "which
  // session" are the two axes of one question and reading them apart invites
  // the belief that the second is a view of the first.
  stairCol.append(
    stairHead, stairPlate, ctl, rangeCtl, spaced(rangeNote), restoreCtl, spaced(wasNote),
    tierPick, qbar, spaced(qNote), readout, spaced(stairNote),
  );

  const ladderCol = el('div');
  const ladderHead = el('h3');
  ladderHead.append(...ctx.t('sim.thresh'));
  const ladderPlate = el('div', 'ladder plate');
  ladderPlate.id = 'ladder';
  // `{offrung}` is the mockup's own illustrative "6,050" — a number chosen to
  // BE arbitrary, and it survives the 2026-08-29 rewrite of this sentence with
  // its job inverted: it used to name the value snapping PREVENTED you landing
  // on, and now it names a value you may land on freely because the rung below
  // it is what decides. It is still not derived from this tier's real rungs —
  // the note is built once, before the first sweep response exists to derive
  // one from, and the claim holds for every tier and every corpus alike.
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

  /* ── WHAT THE `seen` GATE REMOVED, NAMED ───────────────────────────────────

     The second half of `plan:walk seq:86`, and the half that makes an empty row
     readable. `/api/simulate` has served `seenFiltered` since 2026-08-29 — the
     ids `select`'s own `injectable ∩ seen` removed — and this screen has never
     asked for it. Measured warm against this repository on 2026-08-31: 104 items
     removed at that gate, accounted for in no cell of the fits table, while four
     of its five rows read `0 of 0`.

     It sits under the table rather than beside a row because the gate runs
     BEFORE any tier picks its candidates, so the count is not attributable to a
     tier and a per-row copy of it would claim it was. The rows get the
     distinction the count makes possible, and nothing stronger — see
     `zeroReason` in `drawTable`. */
  const seenNote = el('p', 'small');
  seenNote.id = 'seenNote';

  const evictHelp = el('details', 'help');
  const evictSummary = el('summary');
  evictSummary.append(...ctx.t('help.whyBudget'));
  const evictBox = el('div', 'helpbox');
  const evictText = el('span');
  evictText.append(...ctx.t('sim.evict'));
  evictBox.append(evictText);
  evictHelp.append(evictSummary, evictBox);
  /* ── THE RECOMMENDATION CARRIES THE NUMBERS, NOT THE ADVICE ────────────────

     `plan:budget seq:2`. *"Raise the budget" is not actionable.* So this block
     says what the tier COSTS, what it is SET to, and what it would have to BE,
     and then offers three values, each labelled with what it buys and what it
     costs — *"because a list of numbers with no consequences attached is a guess
     with a dropdown"*.

     **All three are DERIVED and none is invented.**

       - The exact cost is the last rung of THIS tier's sweep — the smallest
         budget at which `fitToBudget` admits every candidate. Not the sum of
         `costs`, which is the same number only while first-fit happens to be
         monotone, and `sim.evict` is the whole argument that it is not.
       - The growth value is that number with `GROWTH` headroom, and the
         percentage is drawn beside it.
       - The ceiling is `window − the other four budgets − a working reserve`,
         and it is the one that CANNOT be derived without the status-line
         bridge. When no window has been measured the button is not drawn
         holding a guess; it is drawn saying it is not offered, which is
         `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` applied
         to a recommendation.

     Plus free entry, per the owner's requirement. The slider is a control for
     exploring and cannot be typed into; this is the field for a reader who
     already knows the number they want. */
  const recHead = el('h3');
  recHead.append(...ctx.t('sim.rech'));
  const recLine = el('p', 'small');
  recLine.id = 'recn';
  const recBar = el('div', 'segbar');
  recBar.id = 'recbar';
  recBar.setAttribute('role', 'group');
  recBar.setAttribute('aria-label', ctx.tFlat('sim.rech'));
  const recCtl = el('div', 'cmdactions');
  recCtl.id = 'recctl';
  const recLabel = el('label', 'small');
  recLabel.htmlFor = 'recFree';
  recLabel.append(...ctx.t('sim.recFreeh'));
  const recFree = el('input', 'm');
  recFree.id = 'recFree';
  recFree.type = 'number';
  recFree.min = '1';
  recFree.step = '1';
  // The same raw, untranslated spelling Configure's budget inputs and this
  // screen's own range field use — an identifier a test can select on in either
  // language, not a sentence.
  recFree.setAttribute('aria-label', 'simulate.budget');
  const recGo = el('button');
  recGo.type = 'button';
  recGo.append(...ctx.t('sim.recGo'));
  const recSaid = el('div', 'execresult');
  recSaid.hidden = true;
  recSaid.setAttribute('role', 'status');
  recCtl.append(recLabel, recFree, recGo, recSaid);

  /* ── VALIDATION IS AGAINST THE WHOLE WINDOW, AND REFUSES TO GUESS ──────────

     `plan:budget seq:3`. `pinned + jit + restored + continuity + index` must fit
     `context_window_size`; *"a single budget that passes on its own while the
     [five] together do not is the failure mode this exists to prevent, and it is
     the one a per-field check cannot see."*

     **FIVE, where the task's own text says four, and the difference is said out
     loud rather than smoothed over.** The item was written on 2026-08-27 and
     names `pinned + jit + restored + index`; `continuity` is a budget in
     `Config.budgets` and in `BUDGET_KEYS` today. Validating four of five would
     leave the fifth free to overflow the window, which is precisely the failure
     the item exists to prevent, so the check sums what the config actually
     holds. Recorded for the owner rather than decided in silence.

     **The ceiling is only knowable when the bridge has spoken**, so without a
     sample this REFUSES rather than validating against a guess.
     `GET /api/watch/context` is the one endpoint that carries Claude Code's own
     `context_window_size` (`classifyContext`, through `apiWatchContext`) — it
     already exists and already refuses to invent a number, so nothing
     server-side is added here and no model-to-window table is consulted. On this
     machine one such table would say 200,000 where the truth is 1,000,000. */
  const winHead = el('h3');
  winHead.append(...ctx.t('sim.winh'));
  const winLine = el('p', 'small');
  winLine.id = 'winn';
  // A SECOND line and never a clause of the first: "the five budgets do not fit
  // the window" and "the window you are in has no room for them right now" are
  // two facts with two different next steps, and folding them into one sentence
  // is how a reader learns neither.
  const fullLine = el('p', 'small');
  fullLine.id = 'winfull';

  tableCard.append(
    plate, spaced(chipNote), spaced(seenNote),
    recHead, recLine, recBar, recCtl,
    winHead, winLine, fullLine,
    evictHelp,
  );
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

  /**
   * The one place `slider.max` is ever assigned — see `sliderMaxFor`.
   *
   * The range FIELD follows it, and that is not decoration: the number in the
   * box is what pressing the button would commit, so a box showing anything
   * other than the bound actually in force is an offer to change nothing while
   * looking like an offer to change something. It re-fills on every bound
   * change — a tier switch, a sweep resolving, a budget written on Configure —
   * except while the reader is typing in it, because overwriting a half-typed
   * number under somebody's cursor is the one thing worse than showing a stale
   * one.
   */
  function applyBound() {
    slider.max = sliderMaxFor(budgets, tier, rungs);
    if (document.activeElement !== rangeMax) rangeMax.value = slider.max;
  }

  /** The budget in force for `tier`, or `null` before the first response. */
  function inForce() {
    if (budgets === null) return null;
    const raw = Number(budgets[tier] ?? 0);
    return Number.isFinite(raw) ? raw : null;
  }

  /**
   * **"Has anything changed at all" — the question the restore control answers
   * by being enabled** (`plan:budget seq:6`).
   *
   * Two things on this screen can differ from what is in force: the value being
   * simulated, and a range a reader set on ANY tier — not only this one, because
   * one control puts them all back and a button that says "restore" while
   * leaving four tiers' ranges where they were would be lying about its scope.
   */
  function changedFromForce() {
    if (budgets === null) return false;
    if (TIERS.some((name) => simRangeFor(name) !== null)) return true;
    return Number(slider.value) !== inForce();
  }

  /**
   * The pairing beside the thumb, and the restore button's enabled state — the
   * two halves of `plan:budget seq:6`, redrawn together because they are two
   * readings of one fact.
   */
  function drawWas() {
    const force = inForce();
    inForceVal.textContent = force === null ? '—' : num(force);
    restoreGo.disabled = !changedFromForce();
  }

  /**
   * **What this tier would have to BE**: the smallest budget at which the sweep
   * admits as many items as it ever admits.
   *
   * Not `rungs[rungs.length - 1]`, and the difference is `sim.evict`'s whole
   * subject: first-fit is not monotone in membership, so the LAST rung of a
   * sweep with an eviction in it admits FEWER items than an earlier one. The
   * rung list arrives ascending and collapsed, so the first rung carrying the
   * maximum count is both the largest admission and the cheapest way to reach
   * it — which is exactly the number a recommendation should carry.
   *
   * `null` for a tier with no sweep: nothing swept, nothing to recommend.
   */
  function neededFor(list) {
    if (list === null || list.length === 0) return null;
    let best = list[0];
    for (const rung of list) if (rung.count > best.count) best = rung;
    return best.count === 0 ? null : { threshold: best.threshold, count: best.count };
  }

  /**
   * What the current tier COSTS, off the selection this screen already holds.
   *
   * `costs` is a lookup table `/api/simulate` builds over `full ∪ spilled`, so
   * the candidates that reached this tier and the price of each are both in one
   * response and cannot be two answers to two questions. A candidate whose id
   * `costs` does not price answers `null` for the whole total rather than a
   * short sum: a cost that is quietly one item light is the silent drop this
   * project keeps paying for.
   */
  function costOf(sim) {
    if (sim === null || !sim.tiersRun.includes(tier)) return null;
    const ids = [
      ...sim.selection.full.filter((e) => e.tier === tier).map((e) => e.item?.id),
      ...sim.selection.spilled.filter((s) => s.tier === tier).map((s) => s.id),
    ];
    const priced = new Map((sim.costs ?? []).map((c) => [c.id, c.tokens]));
    let total = 0;
    for (const id of ids) {
      const cost = priced.get(id);
      if (typeof cost !== 'number') return null;
      total += cost;
    }
    return { ids, n: ids.length, tokens: total };
  }

  /** The `/api/simulate` response for whichever event runs the current tier. */
  function simForTier() {
    if (lastBoth === null) return null;
    return EVENT_FOR[tier] === 'tool' ? lastBoth.tool : lastBoth.compact;
  }

  /**
   * The five budgets as they would stand with the value being simulated applied
   * to the tier being dragged — which is the set `plan:budget seq:3` validates.
   * `null` until the config has been read; nothing is validated against
   * defaults this file made up.
   */
  function candidateBudgets() {
    if (budgets === null) return null;
    return { ...budgets, [tier]: Number(slider.value) };
  }

  /* ── THE READOUT'S CONTENTS ────────────────────────────────────────────────
     The mockup's `renderStair` tail, port for port: how many are in, how many
     are out and what that costs; the budget the next one would arrive at; and
     the eviction warning when the sweep contains a downward step. Every figure
     comes from responses this screen already holds. */
  function drawReadout() {
    readout.replaceChildren();
    const sim = simForTier();
    const counts = countFor(tier, sim);
    const priced = costOf(sim);
    // A tier neither event reached has no readout, for `countFor`'s own reason:
    // "0 in · 0 out · 0 tokens used" would claim it ran and delivered nothing.
    if (counts === null || priced === null) return;
    const line = el('div');
    line.append(...ctx.t('sim.readout', {
      fits: num(counts.fits), spills: num(counts.spills), used: num(priced.tokens),
    }));
    readout.append(line);

    // `next in at` — the mockup's own arithmetic: the cheapest thing that did
    // not fit arrives when the budget reaches what is already spent plus its own
    // cost. Drawn only when there IS something out; a readout claiming a next
    // arrival where everything already arrived would be inventing a queue.
    const spilledIds = sim.selection.spilled.filter((s) => s.tier === tier).map((s) => s.id);
    const prices = new Map((sim.costs ?? []).map((c) => [c.id, c.tokens]));
    let cheapest = null;
    for (const id of spilledIds) {
      const cost = prices.get(id);
      if (typeof cost !== 'number') continue;
      if (cheapest === null || cost < cheapest.cost) cheapest = { id, cost };
    }
    if (cheapest !== null) {
      // What the ADMITTED items take: everything this tier priced, less what
      // spilled. `priced.tokens` covers `full ∪ spilled` by construction, so
      // this is a subtraction rather than a second pass with a second chance to
      // disagree with the total drawn one line above it.
      const used = priced.tokens - spilledIds
        .reduce((sum, id) => sum + (prices.get(id) ?? 0), 0);
      const next = el('div', 'small');
      next.append(...ctx.t('sim.nextin', {
        at: num(used + cheapest.cost), id: cheapest.id,
      }));
      readout.append(next);
    }

    if (rungs !== null && rungs.some((r) => r.evicted.length > 0)) {
      const warn = el('div', 'small');
      warn.append(...ctx.t('sim.evictw'));
      // CSSOM, never a `style` attribute: the server sends `style-src 'self'`
      // with no `'unsafe-inline'`, which is the one thing on this block that may
      // not be transcribed from the mockup literally.
      warn.style.setProperty('color', 'var(--crit)');
      readout.append(warn);
    }
  }

  /* ── THE RECOMMENDATION ────────────────────────────────────────────────────
     `plan:budget seq:2`, drawn from the sweep and the priced selection. */
  function drawRec() {
    recLine.replaceChildren();
    recBar.replaceChildren();
    const sim = simForTier();
    const priced = costOf(sim);
    const need = neededFor(rungs);
    const set = inForce();
    if (priced === null || need === null || set === null) {
      recLine.append(...ctx.t('sim.recNone'));
      return;
    }
    recLine.append(...ctx.t('sim.recn', {
      tier: tier, cost: num(priced.tokens), n: num(priced.n), set: num(set), need: num(need.threshold),
    }));

    // The ceiling, and it is the term that refuses. `window − the other four
    // budgets − a working reserve`, or nothing at all: a ceiling computed
    // against a window nobody measured is the guess this whole task forbids.
    const others = budgets === null ? 0
      : TIERS.filter((name) => name !== tier)
        .reduce((sum, name) => sum + Number(budgets[name] ?? 0), 0);
    const reserve = win === null ? 0 : Math.round(win.size * RESERVE);
    const ceiling = win === null ? null : win.size - others - reserve;

    const offers = [
      {
        head: 'sim.recExact',
        sub: 'sim.recExactn',
        subs: { n: num(need.count), cost: num(need.threshold) },
        value: need.threshold,
      },
      {
        head: 'sim.recGrow',
        sub: 'sim.recGrown',
        subs: {
          n: num(need.count),
          pct: num(Math.round(GROWTH * 100)),
          cost: num(Math.ceil(need.threshold * (1 + GROWTH))),
        },
        value: Math.ceil(need.threshold * (1 + GROWTH)),
      },
      ceiling !== null && ceiling > 0
        ? {
          head: 'sim.recCeil',
          sub: 'sim.recCeiln',
          subs: {
            other: num(others),
            pct: num(Math.round(RESERVE * 100)),
            win: num(win.size),
            cost: num(ceiling),
          },
          value: ceiling,
        }
        : { head: 'sim.recCeil', sub: 'sim.recCeilNon', subs: {}, value: null },
    ];

    for (const offer of offers) {
      const button = el('button');
      button.type = 'button';
      button.dataset.rec = offer.head;
      const head = el('span');
      head.append(...ctx.t(offer.head));
      if (offer.value !== null) head.append(' ', mono(num(offer.value)));
      const sub = el('span', 'small');
      sub.append(...ctx.t(offer.sub, offer.subs));
      button.append(head, ' ', sub);
      // Not offered is not the same as offered-and-inert: the button that
      // carries no number cannot be pressed, and says why in its own subtitle.
      button.disabled = offer.value === null;
      if (offer.value !== null) button.onclick = () => { applyBudget(offer.value, recSaid); };
      recBar.append(button);
    }
  }

  /* ── THE WHOLE-WINDOW CHECK, AND THE FULL-WINDOW NEXT STEP ─────────────────
     `plan:budget seq:3` and `plan:budget seq:4`, drawn together because they
     read the same two numbers and mean two different things. */
  function drawWindow() {
    winLine.replaceChildren();
    fullLine.replaceChildren();
    const candidate = candidateBudgets();
    if (candidate === null) return;
    const total = TIERS.reduce((sum, name) => sum + Number(candidate[name] ?? 0), 0);

    if (win === null) {
      // THE REFUSAL. It names what is missing and stops; it does not validate.
      winLine.append(...ctx.t('sim.winNone'));
      return;
    }
    const reserve = Math.round(win.size * RESERVE);
    const left = win.size - total;
    const chip = el('span', 'chip');
    const subs = {
      total: num(total), win: num(win.size),
      pct: num(Math.round((total / win.size) * 100)),
      left: num(Math.max(left, 0)), res: num(Math.round(RESERVE * 100)),
      over: num(Math.max(total - win.size, 0)),
    };
    let key = 'sim.winOk';
    if (total > win.size) { key = 'sim.winOver'; chip.className = 'chip crit'; chip.dataset.g = '■'; } else if (left < reserve) { key = 'sim.winTight'; chip.className = 'chip warn'; chip.dataset.g = '▲'; } else { chip.className = 'chip ok'; chip.dataset.g = '●'; }
    winLine.append(chip, ' ', ...ctx.t(key, subs));

    /* **A FULL WINDOW IS A STATE WITH A NEXT STEP, NOT A FAILURE**
       (`plan:budget seq:4`). The five budgets can fit the window and still have
       nowhere to land in the window RUNNING RIGHT NOW, because that window is
       already part spent. The message names the ACT — *"run /compact or /clear
       and the N pinned items will arrive"* — rather than the state, because
       "the context window is full" is a weather report.

       **And nothing is blocked.** No control is disabled, no value is refused
       and the simulation carries on: budgets are read at SessionStart, so a
       compact or a clear is precisely the moment a new value takes effect. The
       write is not blocked by a full window, only its consequence is deferred —
       and saying "cannot" while doing nothing would make the reader do it
       twice. */
    const free = Math.max(win.size - win.used, 0);
    if (total > free) {
      const counts = countFor(tier, simForTier());
      const need = neededFor(rungs);
      const arriving = counts !== null ? counts.fits : (need === null ? 0 : need.count);
      fullLine.append(...ctx.t('sim.full', {
        used: num(win.used), win: num(win.size), free: num(free), total: num(total),
        n: num(arriving), tier: tier,
      }));
    }
  }

  /**
   * One place a budget is applied to the slider — the three recommendation
   * buttons and the free-entry field all come through it.
   *
   * **A value you asked to simulate must be reachable**, and assigning above an
   * `input[type=range]`'s `max` clamps in silence. So a value past the bound
   * raises the bound, through the range store the range control already owns —
   * which is not a new rule but the one `sim.rangen` already ships: *"raising a
   * budget past it — here or on Configure — raises it."* The receipt says so
   * when it happens, because a control that moved a second number without
   * saying is the silent-change defect the range ruling exists to prevent.
   */
  function applyBudget(value, said) {
    said.hidden = false;
    if (value > Number(slider.max)) {
      setSimRange(tier, value);
      applyBound();
      said.replaceChildren(...ctx.t('sim.recRange', {
        tier: tier, value: num(value), max: num(Number(slider.max)),
      }));
    } else {
      said.replaceChildren(...ctx.t('sim.recSet', { tier: tier, value: num(value) }));
    }
    slider.value = String(value);
    budgetVal.textContent = num(value);
    drawStair();
    drawLadder();
    drawWas();
    drawWindow();
    void run();
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
    if (rungs === null) return;
    /* ── AN EMPTY STAIRCASE SAYS WHY IT IS EMPTY ────────────────────────────
       `plan:walk seq:86`: *"a reader sees a flat staircase and cannot tell
       whether the tiers are empty because nothing qualified or because
       everything had already been delivered."* A blank plate was the fourth
       reading of that — it could not even say which of the four absences it
       was. Each of them is now named, and each is a MEASURED absence:

         index          the endpoint refuses it by construction (per-line costs)
         jit, no path   a `tool` event needs a file and the walk offers none
         seen removed   the gate took the candidates before this tier saw them
         nothing        nothing qualified — which is the only one that used to
                        be readable, and only by guessing.

       The `seen` count is the fact the screen never asked for. Warm on this
       repository it is 104 and the staircase drew nothing at all. */
    if (rungs.length === 0 || rungs.every((r) => r.count === 0)) {
      const why = el('p', 'small');
      if (tier === 'index') why.append(...ctx.t('sim.stairIndex'));
      else if (EVENT_FOR[tier] === 'tool' && files !== null && chosenPath === null) {
        why.append(...ctx.t('sim.stairNoPath'));
      } else if (seenOut.length > 0) {
        why.append(...ctx.t('sim.stair0seen', { n: num(seenOut.length) }));
      } else why.append(...ctx.t('sim.stair0none'));
      stairPlate.append(why);
      return;
    }

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
        // `class`, not `fill`: a presentation attribute loses to
        // `svg.chart text{fill:var(--dim)}`, so every one of these words drew
        // grey. `styles.css` ~1541 owns the colour now.
        { x: X(label.x), y: label.y, 'text-anchor': anchor(label.anchor), class: 'crit' },
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
          class: 'crit',
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
        class: 'mono gold',
      },
      num(cur),
    ));

    const svg = sv('svg', {
      viewBox: `0 0 ${STAIR_W} ${STAIR_H + foot}`,
      // `width`/`height` ARE THE CHART'S NATURAL SIZE, and they are load-bearing.
      // `svg.chart` says `max-inline-size:100%` and no longer `inline-size:100%`,
      // so the used width is this element's own INTRINSIC width — which is what
      // these two presentation attributes supply. Without them an `<svg>` that
      // carries only a viewBox has a ratio and no intrinsic size and the browser
      // falls back to 300x150. The mockup's `chart()` factory writes the same two
      // (mockup ~4193); `block-size:auto` in the stylesheet overrides the height
      // one on purpose, so the ratio is recomputed on the narrow-card case.
      width: STAIR_W,
      height: STAIR_H + foot,
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
    // The all-zero sweep is cleared here too, and not only in `drawStair`: a
    // ladder listing one rung that admits nothing beside a staircase saying
    // there is no rung to draw would be two answers to one question.
    if (rungs === null || rungs.length === 0 || rungs.every((r) => r.count === 0)) return;

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
      drawReadout();
      drawRec();
      return;
    }
    const path = tier === 'jit' ? await ensurePath() : null;
    if (EVENT_FOR[tier] === 'tool' && path === null) {
      rungs = [];
      applyBound();
      drawStair();
      drawLadder();
      drawReadout();
      drawRec();
      return;
    }
    const qs = selectQuery(
      EVENT_FOR[tier], EVENT_FOR[tier] === 'tool' ? path : null, sessionFor(), { tier },
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
    drawReadout();
    drawRec();
    drawWindow();
    drawWas();
  }

  /**
   * The question strip — `paintQ`'s shape from `screens/preview.js`, and its
   * ruling with it: the warm option is named by the SESSION ITSELF (a value,
   * drawn the way `#sesslbl` draws it, because that is what identifies the
   * question), and the cold option is prose taking the design of record's own
   * string.
   *
   * A shell with no sessions answers `'cold'` from `ctx.session()`, so one
   * button is drawn rather than an inert second one asking a question that does
   * not exist.
   */
  function drawQ() {
    qbar.replaceChildren();
    const live = ctx.session();
    const options = live === 'cold' ? ['cold'] : ['live', 'cold'];
    for (const mode of options) {
      const button = el('button');
      button.type = 'button';
      button.dataset.q = mode;
      const head = el('span');
      if (mode === 'live') head.append(el('b', 'v', live));
      else head.append(...ctx.t('sess.cold'));
      const sub = el('span', 'small');
      sub.append(...ctx.t(mode === 'live' ? 'preview.qwarmn' : 'sess.coldn'));
      button.append(head, ' ', sub);
      button.setAttribute('aria-pressed', String(mode === sessionMode));
      button.onclick = () => {
        if (sessionMode === mode) return;
        sessionMode = mode;
        PICKED.mode = mode;
        // The old sweep and the old selection belong to the OLD question —
        // cleared before either request goes out, so nothing is ever drawn
        // under a label that no longer describes it.
        rungs = null;
        lastBoth = null;
        seenOut = [];
        drawQ();
        drawStair();
        drawLadder();
        void run();
        void runSweep();
      };
      qbar.append(button);
    }
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
        // The receipts belong to the tier they were left on: a range set on
        // `pinned` and a budget simulated on it are not statements about `jit`.
        rangeSaid.hidden = true;
        recSaid.hidden = true;
        drawStair();
        drawLadder();
        drawTierPick();
        drawReadout();
        drawRec();
        drawWindow();
        drawWas();
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
      'compact', null, sessionFor(), EVENT_FOR[tier] === 'compact' ? override : {},
    );
    const compact = ctx.api(`/api/simulate?${compactQs}`);
    if (path === null) return { compact: await compact, tool: null };
    const toolQs = selectQuery(
      'tool', path, sessionFor(), EVENT_FOR[tier] === 'tool' ? override : {},
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
        // The fits column is a RATIO, as `sim.chipn` says, and it is written in
        // the mockup's own words again. It shipped as a bare solidus because
        // the `' of '` in the mockup's demo loop is an unkeyed literal and
        // "shipping it would put untranslated English inside a Hebrew
        // sentence" — true of a literal, and never true of a key. The reason
        // no key was written was `strings-parity` failing on one the design of
        // record does not declare, which stopped being a rule on 2026-08-26.
        // `sim.fitsOf` is that key; `sim.chipn` directly below already quoted
        // the same two slots in both languages, so the copy needed no
        // inventing at all.
        const chip = el('span', `chip ${counts.spills > 0 ? 'warn' : 'ok'}`);
        chip.dataset.g = counts.spills > 0 ? '▲' : '●';
        chip.append(...ctx.t('sim.fitsOf', {
          fits: num(counts.fits), eligible: num(eligible),
        }));
        c3.append(chip);
        /* ── A MEASURED `0 of 0` SAYS WHICH EMPTINESS IT IS ────────────────
           `plan:walk seq:86`'s own done-when: *"a tier drawing 0/0 says whether
           that is nothing qualified or everything was already delivered."*
           Before this, four of this table's five rows read `0 of 0` warm on
           this repository while 104 items sat removed one gate earlier, and the
           screen accounted for them nowhere.

           **The claim is exactly the gate's own and no stronger.** Rung 5 runs
           before any tier picks its candidates, so an item it removed might
           still have been no candidate of THIS tier — `always` for pinned,
           `matchesScope` for jit, the restore list for restored. So the row
           says *everything it could have had was already delivered* only when
           the gate actually removed something under the question being asked,
           and *nothing qualified for it* when it did not. What a fresh window
           would really get is the OTHER question, and the control above is how
           a reader asks it. */
        if (counts.fits === 0 && counts.spills === 0) {
          const why = el('span', 'small');
          why.append(...ctx.t(seenOut.length > 0 ? 'sim.zeroSeen' : 'sim.zeroNone'));
          c3.append(' ', why);
        }
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

    // The `seen` count, named. A measured zero is DRAWN and named — `sim.seen0`
    // says the gate removed nothing, which is what makes every empty row below
    // it readable as "nothing qualified" rather than as an unexplained blank.
    seenNote.replaceChildren();
    seenNote.append(...(seenOut.length === 0
      ? ctx.t('sim.seen0')
      : ctx.t('sim.seen', { n: num(seenOut.length) })));
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
      // `.div-name` WRAPS as of 2026-08-30 - it no longer ellipsises, and this
      // comment said it did for a day after the rule changed. The `title` stays,
      // and so does the assertion pinning it: a wrapped id is still a long id in
      // a narrow track, and the tooltip is what a reader reaches for when the
      // wrap costs three lines. Only the stated REASON moved. A
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
    // no `data-t`. Inventing a key is ALLOWED here — `strings-parity` dropped
    // the invented direction on 2026-08-26 — and is still not what this does,
    // because two keys carrying these exact two words already exist and a
    // second spelling of a word is how two surfaces come to disagree about it.
    // `preview.delivered` and `sim.spills` are the same two words in
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
      lastBoth = both;
      // `seenFiltered` rides on the COMPACT response deliberately: the `seen`
      // gate is a property of the session and the corpus, not of the event, and
      // `compact` is the one request this screen always makes. Reading it off
      // whichever response happened to be second would make the count depend on
      // whether a file walk existed.
      seenOut = both.compact.seenFiltered ?? [];
      drawTable(both);
      drawReadout();
      drawRec();
      drawWindow();
      drawWas();
    } catch (error) {
      tbody.replaceChildren();
      chipNote.replaceChildren(errorNote(error.message));
    }
  }

  /* ── THE SNAP IS GONE, AND THIS IS THE ARGUMENT ─────────────────────────────

     Until 2026-08-29 this handler rewrote `slider.value` to the nearest rung on
     every tick. The owner's instruction: *"the slide resolution is coarse and
     actually unusable it should slide smoothly with much smaller steps"*, and
     separately *"the slider always displayed at the max value ... when moving it
     it then changes it's position"*. The second complaint is the snap, not the
     step: the thumb jumped away from the pointer.

     **`sim.snap`'s prose is not a counter-argument and was never a
     counter-party.** Snapping is BEHAVIOUR and
     `DEC-the-mockup-governs-presentation-never-behaviour-and-a` gives the mockup
     no standing over it. What the prose contains that IS worth weighing is an
     engineering fact — *"every value between two rungs behaves identically"* —
     and it is true of the selector.

     **Both facts are true at once, so the fix reports rather than enforces.**
     Measured against this repository's own corpus on 2026-08-29: eighteen
     `jit` rungs, every one of them at or below 1,550, under a bound of 16,000.
     A click at 40% of the track produced 1,550; a click at 95% produced 1,550
     as well. The thumb had eighteen reachable positions in the leftmost tenth
     of the track and none at all in the other nine — which is what "unusable"
     names, and it is worse than coarse, it is a control that cannot be aimed.

     So the thumb moves in single tokens and lands where the pointer put it, and
     the governing rung is REPORTED in the two places that already report it:
     the ladder marks it `.at` (the highest rung at or below this value) and the
     staircase's step path is drawn from the rungs themselves, so the reader sees
     the flat tread they are standing on. Nothing between two rungs is claimed to
     be a different answer, because the ladder is saying which rung it is.

     The three shapes the task listed were weighed. Snapping within a threshold
     distance keeps a jump that is merely rarer, and still moves the thumb away
     from the finger. Previewing the snap target during a drag adds a second
     readout to explain a movement that would then still happen. Reporting the
     rung removes the movement instead of annotating it, and costs nothing the
     reader was getting. ── */
  slider.oninput = () => {
    budgetVal.textContent = num(Number(slider.value));
    drawStair();
    drawLadder();
    // Synchronous on every tick, and deliberately NOT behind the 150ms debounce
    // the refetch sits behind: both read numbers this screen already holds, and
    // a "what it was" pairing that lags the thumb by a sixth of a second is a
    // pairing a reader watches disagree with the control they are dragging.
    drawWas();
    drawWindow();
    clearTimeout(pending);
    pending = setTimeout(() => { void run(); }, 150);
  };

  /**
   * The range control's commit — the button, and the receipt it leaves.
   *
   * A refusal and a success both land in `#rangectl`'s own `.execresult`, in
   * the reader's language, and neither touches the slider's VALUE: setting the
   * range is a decision about what is worth exploring, and silently moving the
   * budget under it would be the two-questions-one-control conflation this
   * whole task exists to undo.
   */
  // `onclick`, not `addEventListener`, for the same reason `slider.oninput` is a
  // property in this file: one handler, assigned once, at the only place that
  // ever assigns it.
  rangeGo.onclick = () => {
    const wanted = parseRangeMax(rangeMax.value);
    rangeSaid.hidden = false;
    if (wanted === null) {
      // Refused BY NAME and never clamped — `requirePositiveIntegerBudget`'s own
      // discipline, applied to the one budget-shaped field the server never sees.
      rangeSaid.replaceChildren(...ctx.t('sim.rangebad', { typed: rangeMax.value }));
      return;
    }
    setSimRange(tier, wanted);
    // The bound first, then everything drawn against it — the same order the
    // tier buttons and the first paint take, for the same reason.
    applyBound();
    drawStair();
    drawLadder();
    rangeSaid.replaceChildren(...ctx.t('sim.rangeset', { tier: tier, max: num(Number(slider.max)) }));
    drawWas();
  };

  /**
   * **One control puts it back** — `plan:budget seq:6`.
   *
   * It discards the SIMULATION and writes nothing: the slider returns to the
   * budget `config.json` holds for this tier, and every range a reader set is
   * unset so the derived bound comes back. `setSimRange(tier, null)` is the
   * unset — `simRangeFor` answers `null` for anything that is not a positive
   * integer — and it is the same seam the range control's own commit goes
   * through, so there is one writer of that store and not two.
   *
   * The bound BEFORE the value, for the reason every other assignment on this
   * screen takes that order: the other one clamps.
   */
  restoreGo.onclick = () => {
    if (budgets === null) return;
    for (const name of TIERS) setSimRange(name, null);
    applyBound();
    slider.value = String(budgets[tier]);
    budgetVal.textContent = num(budgets[tier]);
    rangeSaid.hidden = true;
    recSaid.hidden = true;
    drawStair();
    drawLadder();
    drawWas();
    drawWindow();
    void run();
  };

  /**
   * Free entry — the other half of `plan:budget seq:2`'s offer, and it takes
   * `parseRangeMax`'s grammar rather than a second one: a field that looks like
   * the range field beside it while accepting what that one refuses is the
   * two-spellings defect the range ruling already named. Refused BY NAME and
   * never clamped.
   */
  recGo.onclick = () => {
    const wanted = parseRangeMax(recFree.value);
    if (wanted === null) {
      recSaid.hidden = false;
      recSaid.replaceChildren(...ctx.t('sim.recBad', { typed: recFree.value }));
      return;
    }
    applyBudget(wanted, recSaid);
  };
  /**
   * **Why this screen cannot hold two renders, measured rather than assumed.**
   *
   * `preview.js`'s defect needs a container that is CLEARED before the request
   * and APPENDED to after it. Every drawing surface on this screen is replaced
   * wholesale inside a synchronous draw instead — `stairPlate`, `ladderPlate`,
   * `tbody`, `chipNote`, `ratioPlate` and `tierPick` each open with
   * `replaceChildren()` and finish appending before they yield, and none of the
   * six is written to between an await and its own clear. Two overlapping
   * `run()`s therefore leave ONE table, not two.
   *
   * What they can leave is the OLDER answer, if it resolves second. That is a
   * different defect from the one this task is about and it is not made worse
   * by anything here, so it is recorded rather than patched: a generation guard
   * on `run()`/`runSweep()` is the same two lines `preview.js` now carries.
   */
  dropSessionListener = ctx.onSessionChange(() => { void run(); void runSweep(); });

  drawTierPick();
  drawQ();

  /* ── THE WINDOW, ASKED FOR ONCE ────────────────────────────────────────────

     `GET /api/watch/context` is the ONE place in this product Claude Code's own
     `context_window_size` is reachable — the status-line tee, through
     `classifyContext`. It is fetched here rather than derived anywhere, and its
     absence is carried as `null` rather than as a number.

     **Its own try/catch, and deliberately not the table's**, for the reason the
     spill ratio's has one: this endpoint answering nothing must cost the screen
     its window validation and never its fits table, which is served by a
     different endpoint reading a different store and is still perfectly true.
     Every failure lands as "no window measured", which is exactly what a
     refusal, a 500 and a missing bridge all are from here.

     One request, before the first paint of the validation block. It is not
     re-fetched on a drag: a context window does not change because a slider
     did, and one request per rung for an answer that cannot have moved is the
     defect `drawRatio` above already records. */
  try {
    const live = ctx.session();
    if (live !== 'cold') {
      const body = await ctx.api(`/api/watch/context?session=${encodeURIComponent(live)}`);
      const sample = body.sample === null ? null : body.sample.context;
      if (sample !== null && sample.state === 'known'
        && typeof sample.windowSize === 'number' && sample.windowSize > 0
        && typeof sample.usedTokens === 'number') {
        win = { size: sample.windowSize, used: sample.usedTokens };
      }
    }
  } catch {
    // `win` stays `null`, which is the refusal `sim.winNone` names. Nothing is
    // drawn about a window nobody measured, and the error is not surfaced as a
    // second failure: "no window" is the whole of what a reader can act on, and
    // `sim.winNone` already tells them how to get one.
    win = null;
  }

  try {
    // The defaults, from the config the server is running on — never a literal
    // in this file. The mockup's `TIER_BUDGET` is demo data; `budgets` on the
    // response is `Config.budgets`, which is what a reader is dragging away
    // from and needs to be able to drag back to.
    const both = await fetchBoth(null);
    budgets = both.compact.budgets;
    lastBoth = both;
    seenOut = both.compact.seenFiltered ?? [];
    // The bound BEFORE the value. Assigning above `max` clamps silently, so the
    // other order draws a budget nobody set — see `sliderMaxFor`. This is the
    // first of the three places `applyBound` runs; the tier buttons and
    // `runSweep`'s own resolution are the other two, and all three go through
    // the one function.
    applyBound();
    slider.value = String(budgets[tier]);
    budgetVal.textContent = num(budgets[tier]);
    drawTable(both);
    drawReadout();
    drawRec();
    drawWindow();
    drawWas();
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
