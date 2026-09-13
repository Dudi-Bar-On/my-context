// @basis TASK-nine-contrast-ratios-are-computed-against-a-colour-the, DEC-run-is-removed-execute-is-the-only-way-to-run-what-the, LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine
/**
 * **Every button the app draws is styled by something, and its text can be read
 * AGAINST THE PIXELS ACTUALLY UNDER IT.**
 *
 * `plan:rulings seq:51`. The owner found this by looking, on 2026-08-27: in the
 * Composer, choosing a READ action generates a button after Copy with a white
 * background and text that cannot be seen.
 *
 * ── WHY IT HAPPENS, AND WHY IT IS A CLASS ─────────────────────────────────
 *
 * `styles.css`'s only global button rule is `button{font:inherit;color:inherit}`.
 * It takes the app's LIGHT colour and **sets no background**. So a classless
 * `<button>` gets light text from the app and its background from the USER
 * AGENT — near-white on Windows Chrome. Light on white. Invisible, and invisible
 * precisely BECAUSE the half-reset succeeded at one half.
 *
 * Which buttons are safe is decided by ANCESTOR rules — `.cmd button`,
 * `.bound button`, `.segbar button`, `.icon`. A classless button inside one of
 * those looks right; the same button one level up does not. The Composer's Copy
 * sits inside `div.cmd` and looked right; the read action's button was appended
 * to a classless `div` and did not.
 *
 * ── WHY THIS IS A BROWSER TEST AND CANNOT BE A SOURCE SCAN ────────────────
 *
 * The styling comes from ancestors, so "is this button styled" is a question
 * about the CASCADE, and the cascade only exists in a browser. A source scan
 * would have to reimplement selector matching to answer it, and a reimplementation
 * that is subtly wrong passes exactly the buttons it is wrong about.
 *
 * ── WHAT AN INVISIBLE BUTTON COSTS, WHICH IS WHY IT GETS A GATE ───────────
 *
 * A human never reports one, because they never see it. This one surfaced only
 * because a NEW button appeared beside a working one and the difference was
 * visible. Every other instance is still there, unreported, until somebody
 * happens to compose the right thing.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE INSTRUMENT WAS WRONG, AND WHAT REPLACED IT — 2026-09-13
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `TASK-nine-contrast-ratios-are-computed-against-a-colour-the` (D40, and the
 * first item that number has ever had).
 *
 * **THE DEFECT.** Until this date the effective background was found by walking
 * ancestors with `getComputedStyle(node).backgroundColor` and stopping at the
 * first value whose alpha exceeded .99. That reads the `background-color`
 * PROPERTY and nothing else, and this app's ground is not a colour: `:root`
 * declares
 *
 *     --ground: radial-gradient(120% 90% at 14% 6%, #433580 0%, transparent 58%),
 *               radial-gradient(115% 85% at 88% 92%, #0f6069 0%, transparent 60%),
 *               radial-gradient( 90% 70% at 56% 46%, #23306f 0%, transparent 66%),
 *               #0b0c11;
 *
 * and `body{background:var(--ground)}`. The shorthand puts the three blobs in
 * `background-image` and only `#0b0c11` in `background-color` — so the walk
 * climbed past every transparent ancestor, reached `body`, and answered
 * **#0b0c11: the colour UNDER the gradients, which is the darkest the screen
 * can ever be at that point.** For this app's light text that is the optimistic
 * end of the range, and optimism is the dangerous direction for a legibility
 * gate.
 *
 * **AND A SECOND, SIMPLER BUG IN THE SAME LINE.** The parser was
 * `/rgba?\(([^)]+)\)/`. `--goldbg` is `color-mix(in oklch, var(--gold) 12%,
 * var(--panel))`, which computes to `oklch(0.277473 0.028058 86.0336)` — the
 * regex does not match it, so the walk treated a FULLY OPAQUE background as
 * absent and climbed past it. Every `aria-pressed="true"` control in the
 * segmented bars and the kind filters was measured against #0b0c11 while the
 * screen painted it on rgb(46, 39, 24). Measured: token 10.19:1, paint 4.60:1.
 *
 * **THE SIZE OF THE ERROR, MEASURED**, which is what the item asked for first
 * and the reason it is recorded here rather than only in a report. Every style
 * signature the twelve screens draw, the token's claim beside the worst pixel of
 * real paint (2026-09-13, chromium, 1280x720, dark, this repository's corpus):
 *
 *     container         colour on own background      token    paint     gap
 *     div.cmd           #f0eef6 on --panel #17171c    15.54    15.54    0.00
 *     div.cmdactions    #f0eef6 on --panel            15.54    15.54    0.00
 *     div               #a9a6b8 on --sink  #101014     7.99     7.99    0.00
 *     div.bound         #a9a6b8 on --sink              7.99     7.99    0.00
 *     div.bound         #a9a6b8 on --sink, disabled    7.99     7.99    0.00
 *     div.kindfilters   #a9a6b8 on --sink              7.99     7.99    0.00
 *     div.segbar        #a9a6b8 on --sink              7.99     7.99    0.00
 *     td                #a9a6b8 on transparent         8.22     8.02   -0.20
 *     td                #a9a6b8 on transparent, disb.  8.22     8.24   +0.02
 *     span.row          #a9a6b8 on transparent         8.22     8.04   -0.18
 *     p.small           #eab308 on transparent        10.19     8.20   -1.99
 *     td                #eab308 on transparent        10.19     6.87   -3.32
 *     div.segbar        #eab308 on --goldbg (oklch)   10.19     7.71   -2.48
 *     div.kindfilters   #eab308 on --goldbg (oklch)   10.19     6.22   -3.97
 *     span.row          #f0eef6 on transparent        16.99     8.10   -8.89
 *     span.row          #f0eef6 on --goldbg (oklch)   16.99     6.22  -10.77
 *     div.cmdactions    #f0eef6 on --panel, disabled  15.54     4.63  -10.91
 *
 * **So the finding splits three ways, and the split is the finding.**
 *
 *   1. **A button that paints its own OPAQUE `background-color` was measured
 *      exactly right, and still is.** Seven of the seventeen signatures agree to
 *      the second decimal. For those the item's premise does not hold, and
 *      saying so is as much a part of this work as the rest.
 *   2. **A TRANSPARENT button over the gradient was overstated by 0.2 to 8.9
 *      points**, and the size depends on where it is — `span.row` runs 8.10 at
 *      worst and 17.46 at best across the tree, one style, one screen.
 *   3. **Two things the old walk could not see AT ALL.** `oklch` fills, because
 *      its parser matched `rgb()` only; and `opacity`, which it ignored, so the
 *      three disabled Composer controls were reported at 15.54:1 while the
 *      screen paints them at 4.63:1 — an eleven-point error on a control the
 *      reader is supposed to be able to tell apart from a missing one.
 *
 * **Nothing in the shipped product measures below its bar by either method.**
 * The lowest real reading is 4.63:1 on a disabled control held to 2.5, and the
 * lowest on an enabled one is 6.22:1 against 4.5. This is a defect in the
 * INSTRUMENT, not a claim that the UI fails contrast — Lighthouse, which
 * measures from the render, scored accessibility 100 on 2026-09-13. What the
 * instrument was doing was reporting margin it had not earned, and in three
 * places the margin it invented was larger than the margin the design actually
 * has.
 *
 * ── WHAT THE MEASUREMENT DOES NOW ─────────────────────────────────────────
 *
 * It reads the ground **out of a screenshot, at the pixels where the label is
 * actually drawn**, exactly as `e2e/frame-paint.spec.ts` and
 * `e2e/code-hue.spec.ts` read a border: find the box by SPAN and not by colour,
 * decode the PNG, index it pixel by pixel, and print the token beside the paint
 * so a reader can see the two disagree.
 *
 * The glyphs are taken out of the way first. `-webkit-text-fill-color:
 * transparent` is used and **not** `color:transparent`, because the measurement
 * still has to ask the element what colour it declares — that property paints
 * nothing and leaves `getComputedStyle(el).color` untouched, and there is a test
 * below that proves it rather than trusting it. With the glyphs gone the label's
 * own footprint contains nothing but the ground, so no glyph-detection
 * heuristic is needed and no antialiased edge can be mistaken for a dark
 * background. That mattered: the first attempt sampled the button's padding
 * gutters instead and was wrong twice over — the corners of a button with
 * `border-radius` lie OUTSIDE the fill and read the ground beside it, and the
 * centre of a button is the glyph.
 *
 * ── THE RULE FOR A GROUND THAT MOVES, AND THE ARGUMENT FOR IT ─────────────
 *
 * A gradient has no single colour, so a single ratio is a lie about it. The
 * rule adopted here:
 *
 *     **A label's ratio is the WORST ratio over every pixel its own text boxes
 *     cover.** Not the centre, not an average, not the corners.
 *
 * Why the worst: contrast is a floor, not a mean. A reader who cannot make out
 * the left half of a word has not been helped by the right half measuring 16:1.
 *
 * Why the label's own boxes and not the element's: the element's box includes
 * padding outside the rounded corners, and it also includes child elements that
 * paint their own fills (a `.cnt` count pill inside a kind filter). Neither is
 * behind the text. The text boxes are exactly the region where the question is
 * asked, and they are obtained from a `Range` over each text node, so a button
 * whose label wraps onto three lines is measured on three real boxes.
 *
 * Why not "corners and centre", which the item offered: measured, it is wrong
 * in both directions on this product. The corners fall outside `border-radius`
 * and report the ground BESIDE the control (a `.kindfilters` button on the
 * opaque `--sink` fill read rgb(35, 40, 74) at its corner — the gradient, not
 * the button), and the centre is the glyph itself (a Copy button read
 * rgb(166, 165, 172), which is the antialiased edge of the letter C). The worst
 * pixel of the label's own footprint needs neither exception.
 *
 * ── WHAT IS JUDGED, AND WHAT HONESTLY CANNOT BE ───────────────────────────
 *
 * **A ratio can only be read where there is paint to read.** Between 550 and 670
 * buttons are enumerated across the twelve screens — the spread is the live
 * audit feed and the corpus tree, not the code — and at rest only about 40 of
 * them are on the screen. The rest are below the fold of `main.body`, whose
 * scroll height reaches 26,309px on Doctor. The old gate judged all of them,
 * which was only possible because it was not looking at any of them. This one
 * reads about 120, says which, and says what it could not reach.
 *
 * So the walk SCROLLS, and the bound on how far is a fact about this layout
 * rather than a budget: `body` is exactly viewport-sized and never scrolls
 * (measured: `scrollingElement` 720/720 on every screen), so **the gradient is
 * painted once into a fixed 1280x720 box and does not move.** A row inside
 * `main.body` can therefore only ever sit somewhere in that scroller's own
 * visible band, and the set of grounds available in that band is the same at
 * every scroll offset. Scrolling further reveals new BUTTONS, never new
 * GROUNDS. Three offsets per screen plus a targeted pass is enough, and the
 * targeted pass is what makes the guarantee below true.
 *
 * **The guarantee is per STYLE SIGNATURE, not per button.** Every distinct
 * (container, declared colour, own background, disabled) combination a screen
 * draws must be judged on real paint at least once, or the spec fails as
 * itself. That is the property the gate exists for — the owner's defect was a
 * property of where a button was appended, and it repeats identically across
 * all 251 instances of `div.cmdactions`. A signature that cannot be brought on
 * screen is reported by name and reddens the run; it is never silently skipped,
 * because "measured what it could reach and silent about what it missed" is
 * this file's own recorded failure mode, twice.
 *
 * ── THE ONE APPROXIMATION, STATED ─────────────────────────────────────────
 *
 * An element with `opacity < 1` fades its glyph AND its own fill together, so
 * the painted glyph is `a*fg + (1-a)*backdrop` while the sampled pixel is
 * `a*ownBg + (1-a)*backdrop`. This composites the declared colour at the
 * element's effective opacity over the SAMPLED pixel, which is exact when the
 * element's own background is transparent and a close approximation when it is
 * not. Three buttons in the product have `opacity < 1` (`.cmdactions
 * button:disabled`, at .5); measured, they land at 4.71:1 against a 2.5 bar, so
 * nothing rests on the approximation. Recovering the backdrop exactly is
 * `(sampled - a*b*ownBg) / (1 - a*b)` and is the change to make if that ever
 * stops being true.
 */
import { test, expect } from './app.ts';
import { settleScreen } from './settle.ts';
import type { Page } from '@playwright/test';

/**
 * The screens that COMPOSE a command, and therefore draw the buttons this exists
 * for — plus the two whose copy controls were measured on 2026-08-27 and
 * deliberately offer no Execute (`config` copies budgets text, `coverage` copies
 * a command that composes nothing).
 *
 * Named rather than derived from the rail, and that is deliberate: a screen that
 * starts drawing buttons later should make somebody READ this list and decide,
 * rather than being swept in by a loop and passing or failing without a reader.
 */
const SCREENS = [
  'palette', 'doctor', 'packs', 'port', 'proc', 'work', 'capture',
  'config', 'coverage', 'ask', 'watch', 'decay',
];

/**
 * Screens that draw no button of their own here, each for a reason that is
 * MEASURED and written down. Named, never silently tolerated.
 *
 * **This list no longer weakens the wait, and that change is the point.** It
 * used to drop `requires: 'button'` for its members, which is the same hole the
 * settle exists to close: a screen listed here by mistake would have been
 * settled on its first stable frame and measured half-drawn. Since 2026-09-13
 * every screen gets the full `requires: 'button'` wait, and this list only
 * decides what a QUIET, STABLE, BUTTONLESS screen means — see `buttonsOn`.
 *
 * `capture` builds nothing below its inputs until a category and a title are
 * entered — measured 2026-08-27: doctor 2 controls, proc 2, packs 1, port 1,
 * **capture 0**. `palette` was in the same position and got `composeOnPalette`;
 * Capture wants the equivalent typing step, and until it has one this entry is
 * what stops the gate claiming coverage it does not have.
 *
 * `decay` draws NO BUTTONS AT ALL — measured, not assumed: `screens/decay.js`
 * contains zero `el('button')`, `createElement('button')` or `.icon`
 * occurrences. It is a reading surface. **That is a CODE reason, and it is the
 * only one in this list**; if `decay` ever gains a control this entry becomes
 * wrong and should be removed rather than kept as cover.
 *
 * **`proc` and `work` are DATA reasons and are new on 2026-09-13, because this
 * gate was already red at HEAD and nobody had said so.** Both build a
 * `commandActions` control — `screens/proc.js` ~567, `screens/work.js` ~409 —
 * and neither reaches that line over this corpus, which since 2026-09-07 is the
 * repository's own (`INSTR-testing-happens-against-the-current-corpus-and-an`).
 * Each screen says so on the screen, in its own words, and that is what was
 * measured rather than inferred:
 *
 *     proc   "No procedure in this corpus. The lifecycle above is what one
 *             would be; nothing has been written yet."   — and `.my_context/
 *             items/procedure` holds zero files, checked.
 *     work   "Drafts awaiting a decision. None — everything captured is
 *             already settled."
 *
 * So the walk cannot reach their controls today, and the honest record of that
 * is an entry here with the screen's own sentence beside it — not a green run
 * over a screen nobody looked at. **The moment either corpus condition changes,
 * the screen draws its Copy control, the walk measures it normally, and this
 * entry costs nothing** — the list relaxes a requirement, it never suppresses a
 * measurement.
 */
const EXPECTED_EMPTY = new Set(['capture', 'decay', 'proc', 'work']);

/**
 * 4.5:1 is the WCAG AA threshold for ordinary text, and a button's label is
 * ordinary text. The defect this gate exists for computes at roughly **1.1:1** —
 * light grey on the UA's near-white button face — so the bar is nowhere near the
 * failure and no styled button in this product is anywhere near the bar. It is
 * not a tuning knob: raising it would start failing considered designs, and
 * lowering it would still catch this one while admitting the next.
 */
const MIN_RATIO = 4.5;

/**
 * A disabled button is deliberately de-emphasised, and the browser dims its text
 * on top of whatever the stylesheet says. Held to a lower bar rather than
 * exempted: a control you cannot press is still a control you must be able to
 * READ, or you cannot tell it apart from one that is missing.
 *
 * Since 2026-09-13 this bar is measured against a foreground that has the
 * element's `opacity` composited into it, which the old computed-style method
 * ignored entirely. The three disabled Composer controls measure 4.71:1 under
 * the new reading, so the bar did not have to move.
 */
const MIN_RATIO_DISABLED = 2.5;

/** One run of text inside a button, judged on the pixels its own boxes cover. */
interface RunReport {
  /** The colour the element that owns this text declares. */
  color: string;
  /** Worst ratio over the run's own pixels — the number this gate judges. */
  worst: number;
  /** Best ratio over the same pixels. The two differ when the ground moves. */
  best: number;
  /** The painted ground at the worst pixel, and at the best. */
  worstGround: string;
  bestGround: string;
  /** How many pixels were read. Zero means nothing was judged. */
  pixels: number;
  /** The label is not wholly on the screen, so it has no paint to read. */
  offScreen: boolean;
}

interface ButtonReport {
  screen: string;
  /** Index within the scoped walk — stable while the DOM is, used to scroll to one. */
  index: number;
  label: string;
  container: string;
  color: string;
  /** The button's OWN declared background, printed so an `oklch` fill is visible. */
  ownBackground: string;
  /** What the pre-2026-09-13 ancestor walk answered. Kept, and printed beside the paint. */
  tokenBackground: string;
  tokenRatio: number;
  /** Worst over every run, or null when nothing on this button could be read. */
  paintRatio: number | null;
  paintBest: number | null;
  worstGround: string;
  disabled: boolean;
  opacity: number;
  runs: RunReport[];
  box: string;
}

/** container + colour + own background + disabled. The thing the guarantee is per. */
function signatureOf(b: ButtonReport): string {
  return `${b.container} | ${b.color} on ${b.ownBackground}${b.disabled ? ' | disabled' : ''}`;
}

/**
 * **Read the token AND the paint, in one pass, for every button in scope.**
 *
 * A REAL function, not a string. `page.evaluate` passes an argument only to a
 * function — given a string it evaluates it as an expression and drops the arg,
 * which is how the first attempt at scoping this silently measured nothing.
 *
 * **SCOPED, and the scope is the whole point.** This queried `document` until
 * 2026-08-27, which made the anti-vacuity guard satisfy itself: the rail and the
 * header carry more than twenty buttons on every screen, so `seen > 20` was true
 * even for a screen that drew NOTHING. A guard that a page's furniture can
 * satisfy cannot detect the failure it was written for.
 */
const COLLECT = (arg: { rootSelector: string | null; src: string }) => (async () => {
  interface Rgb { r: number; g: number; b: number; a: number }
  const parse = (value: string): Rgb | null => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (m === null) return null;
    const parts = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }: Rgb): number => {
    const chan = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  const ratio = (a: Rgb, b: Rgb): number => {
    const la = luminance(a); const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const over = (fg: Rgb, bg: Rgb): Rgb => ({
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  });
  const say = (c: Rgb): string =>
    `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

  /**
   * **The pre-2026-09-13 method, kept verbatim so the two can be printed side by
   * side.** It answers the `background-color` PROPERTY of the nearest ancestor
   * that has an opaque one — which on this app is `body`'s `#0b0c11`, the colour
   * beneath three `radial-gradient()`s that it cannot see. It is no longer what
   * anything is judged on.
   */
  const tokenBackground = (el: Element): Rgb => {
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg !== null && bg.a > 0.99) return bg;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body ?? { r: 255, g: 255, b: 255, a: 1 };
  };

  const img = new Image();
  img.src = arg.src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2d context for the render');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const W = canvas.width; const H = canvas.height;
  // Every rect below indexes this image by CSS pixel. A screenshot at a
  // different scale would silently read the wrong pixel for every button, so it
  // fails here instead, as itself.
  if (W !== window.innerWidth || H !== window.innerHeight) {
    throw new Error(`the render is ${W}x${H} and the viewport is `
      + `${window.innerWidth}x${window.innerHeight} — every sample would be off by scale`);
  }

  /**
   * **The region of the screen where this node's own paint actually reaches.**
   *
   * `getBoundingClientRect()` answers where a box WOULD be, not where it is
   * drawn: a table row scrolled to the top of `main.body` reports y=2 while the
   * scroller's client area starts at y=100, and the pixels at y=2 belong to the
   * header above it. Reading them produced 22 false failures on the first run of
   * this method — a `--sink`-filled control "measured" on `rgb(70, 65, 97)`,
   * which is the gradient behind the header, and a gold id "measured" on
   * `rgb(34, 197, 94)`, which is a chip in a different card.
   *
   * So every ancestor that clips gets to narrow the region, by its PADDING box
   * (`clientLeft`/`clientWidth`) rather than its border box — which also takes
   * the scrollbar gutter out, and a scrollbar thumb is `--edge-3`
   * `rgb(110, 110, 126)`, the other colour those false failures were read from.
   */
  const clipOf = (el: Element): { x0: number; y0: number; x1: number; y1: number } => {
    let x0 = 0; let y0 = 0; let x1 = W; let y1 = H;
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      if (n.clientWidth === 0 && n.clientHeight === 0) continue;
      const r = n.getBoundingClientRect();
      const left = r.x + n.clientLeft;
      const top = r.y + n.clientTop;
      x0 = Math.max(x0, left);
      y0 = Math.max(y0, top);
      x1 = Math.min(x1, left + n.clientWidth);
      y1 = Math.min(y1, top + n.clientHeight);
    }
    return { x0, y0, x1, y1 };
  };

  /**
   * **The PADDING box of the element that owns the text — the region where its
   * own background is actually painted.**
   *
   * A text node's `Range` rects are LINE boxes, and a line box is free to be
   * taller than the content box it sits in. `.cnt` — the count pill inside every
   * kind filter, which `styles.css` ~1819 describes as "a bordered pill inside a
   * 27px button" — is exactly that: its digits' line box reaches over its own
   * 1px `--edge-3` border, so the literal footprint included nine pixels of
   * `rgb(110, 110, 126)` and the gate reported nine controls at 2.11:1 that a
   * reader can read perfectly well. The border is not what the digits sit on.
   *
   * Computed from the border widths rather than `clientWidth`, because `.cnt` is
   * laid out inline and an inline box reports `clientWidth` 0.
   */
  const paintBox = (el: Element): { x0: number; y0: number; x1: number; y1: number } => {
    const cs = getComputedStyle(el);
    const w = (v: string): number => Number.parseFloat(v) || 0;
    const r = el.getBoundingClientRect();
    return {
      x0: r.x + w(cs.borderLeftWidth),
      y0: r.y + w(cs.borderTopWidth),
      x1: r.right - w(cs.borderRightWidth),
      y1: r.bottom - w(cs.borderBottomWidth),
    };
  };

  const root = arg.rootSelector === null
    ? document : document.querySelector(arg.rootSelector);
  if (root === null) return null;

  const out: Record<string, unknown>[] = [];
  const buttons = [...root.querySelectorAll('button')];
  for (let index = 0; index < buttons.length; index += 1) {
    const el = buttons[index];
    const box = el.getBoundingClientRect();
    // A button with no box is not drawn: a hidden pane, a screen not on top.
    // Judging one would report a colour nobody can see.
    if (box.width === 0 || box.height === 0) continue;
    const cs = getComputedStyle(el);
    const declared = parse(cs.color);
    if (declared === null) continue;

    let opacity = 1;
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      const o = Number.parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(o)) opacity *= o;
    }

    // Every text node inside the button, with the colour ITS OWN parent
    // declares — so a `.cnt` count pill in a kind filter is judged on its own
    // colour against its own fill rather than on the button's.
    const runs: {
      colour: Rgb; declared: string; rects: DOMRect[];
      clip: { x0: number; y0: number; x1: number; y1: number };
      paint: { x0: number; y0: number; x1: number; y1: number };
    }[] = [];
    const walk = (node: Node): void => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if ((child.textContent ?? '').trim() === '') continue;
          const parent = child.parentElement;
          if (parent === null) continue;
          const colour = parse(getComputedStyle(parent).color);
          if (colour === null) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          runs.push({
            colour,
            declared: getComputedStyle(parent).color,
            rects: [...range.getClientRects()],
            clip: clipOf(parent),
            paint: paintBox(parent),
          });
        } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
      }
    };
    walk(el);

    const reports: Record<string, unknown>[] = [];
    for (const run of runs) {
      let worst = Infinity; let best = -Infinity;
      let worstGround = ''; let bestGround = '';
      let pixels = 0; let offScreen = false;
      for (const raw of run.rects) {
        if (raw.width < 1 || raw.height < 1) continue;
        // Narrowed to where the owning element's own background is painted, so
        // a line box taller than its content box does not drag the element's
        // BORDER into the answer. This is a refinement of the question, not a
        // reason to withhold: the glyphs are inside it.
        const rect = {
          x: Math.max(raw.x, run.paint.x0),
          y: Math.max(raw.y, run.paint.y0),
          right: Math.min(raw.right, run.paint.x1),
          bottom: Math.min(raw.bottom, run.paint.y1),
        };
        if (rect.right - rect.x < 1 || rect.bottom - rect.y < 1) continue;
        // **Partly visible is NOT partly measurable**: the hidden part may be
        // the worst part, so the whole run is withheld and said to be. That
        // covers both ways a label can be absent from the paint — off the
        // viewport, and clipped by a scroller it has been scrolled out of. A row
        // withheld at one scroll offset is read at another; `keep` in
        // `buttonsOn` takes the worst of the readings that DID land.
        if (rect.x < Math.max(0, run.clip.x0) || rect.y < Math.max(0, run.clip.y0)
          || rect.right > Math.min(W, run.clip.x1)
          || rect.bottom > Math.min(H, run.clip.y1)) { offScreen = true; continue; }
        // Rounded INWARD. A 1px border is exactly what the clamp above exists to
        // exclude, and `Math.floor`/`Math.ceil` outward would hand it straight
        // back on any box that lands on a fractional pixel.
        const x0 = Math.ceil(rect.x); const y0 = Math.ceil(rect.y);
        const x1 = Math.min(W, Math.floor(rect.right));
        const y1 = Math.min(H, Math.floor(rect.bottom));
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;
        // The ground is smooth, so a long label is sampled on a stride rather
        // than on every column. The stride is bounded so a 400px row still
        // spends ~64 columns across its own span, which is where the gradient's
        // variation lives.
        const stepX = Math.max(1, Math.floor((x1 - x0) / 64));
        const stepY = Math.max(1, Math.floor((y1 - y0) / 24));
        for (let y = y0; y < y1; y += stepY) {
          for (let x = x0; x < x1; x += stepX) {
            const i = (y * W + x) * 4;
            const ground = { r: px[i], g: px[i + 1], b: px[i + 2], a: 1 };
            const painted = over({ ...run.colour, a: run.colour.a * opacity }, ground);
            const r = ratio(painted, ground);
            pixels += 1;
            if (r < worst) { worst = r; worstGround = say(ground); }
            if (r > best) { best = r; bestGround = say(ground); }
          }
        }
      }
      reports.push({
        color: run.declared,
        worst: pixels === 0 ? null : Math.round(worst * 100) / 100,
        best: pixels === 0 ? null : Math.round(best * 100) / 100,
        worstGround, bestGround, pixels, offScreen: pixels === 0 && offScreen,
      });
    }

    const judged = reports.filter((r) => r['pixels'] !== 0);
    const paintRatio = judged.length === 0
      ? null : Math.min(...judged.map((r) => r['worst'] as number));
    const paintBest = judged.length === 0
      ? null : Math.max(...judged.map((r) => r['best'] as number));
    const at = judged.find((r) => r['worst'] === paintRatio);
    const tokenBg = tokenBackground(el);

    out.push({
      index,
      label: (el.textContent ?? '').trim().slice(0, 40)
        || el.getAttribute('aria-label') || '(no label)',
      container: el.parentElement === null ? '(none)'
        : el.parentElement.tagName.toLowerCase()
          + (el.parentElement.className ? '.' + String(el.parentElement.className).split(' ').join('.') : ''),
      color: cs.color,
      ownBackground: cs.backgroundColor,
      tokenBackground: say(tokenBg),
      tokenRatio: Math.round(ratio(declared, tokenBg) * 100) / 100,
      paintRatio,
      paintBest,
      worstGround: at === undefined ? '' : (at['worstGround'] as string),
      disabled: (el as HTMLButtonElement).disabled === true,
      opacity: Math.round(opacity * 100) / 100,
      runs: reports,
      box: `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`,
    });
  }
  return out;
})();

/**
 * **The trick the whole measurement rests on, and the reason it is this property
 * and not `color`.**
 *
 * `-webkit-text-fill-color` paints the glyph and nothing else. `color` is left
 * exactly as the cascade computed it, so the same pass that reads the ground out
 * of a glyph-free render can still ask each element what colour it declares.
 * `the measurement reads the declared colour while the glyphs are hidden` below
 * proves that rather than assuming it.
 */
const HIDE = 'contrast-hide-glyphs';

async function renderWithoutGlyphs(page: Page): Promise<string> {
  await page.evaluate((id) => {
    const style = document.createElement('style');
    style.id = id;
    style.textContent =
      '*{-webkit-text-fill-color:transparent!important;text-shadow:none!important}';
    document.head.append(style);
  }, HIDE);
  const png = await page.screenshot();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function showGlyphs(page: Page): Promise<void> {
  await page.evaluate((id) => { document.getElementById(id)?.remove(); }, HIDE);
}

/**
 * One measurement at the page's current scroll position: hide the glyphs, take
 * the render, and read both numbers off it in the SAME evaluate. Same evaluate
 * because the gap between a screenshot and a `getBoundingClientRect` is a gap in
 * which the live stream can move a row, and a moved row indexes the wrong pixels.
 */
async function measureHere(page: Page, scope: string | null): Promise<ButtonReport[]> {
  const src = await renderWithoutGlyphs(page);
  try {
    const found = await page.evaluate(COLLECT, { rootSelector: scope, src });
    return (found ?? []) as unknown as ButtonReport[];
  } finally {
    await showGlyphs(page);
  }
}

/** Two animation frames, so a scroll has actually been painted before the shot. */
async function painted(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function buttonsOn(
  page: Page, screen: string, options: { alreadyThere?: boolean } = {},
): Promise<ButtonReport[]> {
  // `alreadyThere` is for a screen the caller has already navigated to AND put
  // into a particular state. Re-navigating would reset it, which is how the
  // composed state would silently become the empty one again.
  if (options.alreadyThere !== true) {
    await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
  }
  // Wait for the thing the next line actually reads, not a proxy of it. The
  // next line reads BUTTONS — so settling on "two equal element counts 400ms
  // apart" is satisfied by a screen whose count never changes because its
  // controls have not arrived yet, which is exactly what happened to Doctor:
  // its command block is built after a fetch resolves, so a pre-fetch count
  // held steady across two polls and the screen was declared settled with
  // zero of its buttons drawn. `drewNothing = ["doctor"]` is what caught it.
  //
  // EXISTENCE and STABILITY answer different questions, and this gate needs
  // BOTH because it measures EVERY button on the screen, not the presence of
  // one. The third fact `settle.ts` adds — the router's holding chip is gone —
  // is the one this file was one small change away from being bitten by: the
  // stability half alone is satisfied by two elements present from the first
  // frame that never change, and this spec survived only because it
  // additionally required a real `<button>` while `stateChip` builds a `<span>`.
  //
  // **EVERY screen waits for a button, including the ones known to draw none.**
  // Dropping `requires` for the `EXPECTED_EMPTY` members — which is what this
  // did until 2026-09-13 — hands exactly those screens the settle that this
  // file has twice been caught by: stable-and-quiet is true of a screen whose
  // controls have not arrived yet. It costs the full 10s cap on four screens,
  // and that is the price of the list never being able to hide a slow one.
  //
  // The cap fails as ITSELF. Falling through would judge a half-drawn screen and
  // report a load failure as a contrast defect — a message about correctness
  // produced by a slow machine, which is the shape
  // `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow` names.
  const strong = await settleScreen(page, screen, { requires: 'button' });
  if (!strong.settled) {
    // **Why it did not settle, asked rather than assumed.** "Still fetching or
    // still growing" and "finished, quiet, and drew no button" are different
    // facts with different fixes, and the message must not report the second as
    // the first. Three samples is enough: the 25 above have already been spent.
    const quiet = await settleScreen(page, screen, { samples: 3 });
    expect(quiet.settled, `${screen}: still growing, still holding the router's unread chip, or `
      + `still fetching (${quiet.inFlight} reads in flight, ${quiet.count} nodes) — NOT `
      + 'measured. Run this spec alone before believing anything it says.').toBe(true);
    // Quiet, stable, and buttonless. Legal only for a screen that has said in
    // writing why it draws none here; for anything else `drewNothing` below is
    // the guard that names it.
    expect(EXPECTED_EMPTY.has(screen),
      `${screen}: settled, quiet and drew NO BUTTON OF ITS OWN. That is not a timeout — the `
      + 'screen finished. Either its controls need a state to exist in (see `composeOnPalette` '
      + 'for what that step looks like) or it belongs in `EXPECTED_EMPTY` with the sentence the '
      + 'screen itself prints as the reason.').toBe(true);
  }

  const scope = `[data-p="${screen}"]`;
  const best = new Map<number, ButtonReport>();
  const keep = (rows: ButtonReport[]): void => {
    for (const row of rows) {
      const had = best.get(row.index);
      // A button seen at two scroll offsets is kept at the offset where it was
      // actually readable, and if it was readable at both, at its WORST — the
      // ground moves under it and the floor is the number that matters.
      if (had === undefined
        || (had.paintRatio === null && row.paintRatio !== null)
        || (had.paintRatio !== null && row.paintRatio !== null
          && row.paintRatio < had.paintRatio)) {
        best.set(row.index, { ...row, screen });
      }
    }
  };

  keep(await measureHere(page, scope));
  // `null` means the section itself is not in the DOM — a different failure from
  // "drew no buttons", and one the caller must not read as an empty list.
  const present = await page.evaluate((s) => document.querySelector(s) !== null, scope);
  expect(present, `${screen}: no [data-p] section in the document at all`).toBe(true);

  // Three offsets through the screen's own scroller. Not a budget: `body` never
  // scrolls on this app, so the gradient is a fixed 1280x720 painting and the
  // band `main.body` occupies is the same at every offset. More offsets would
  // show the same grounds holding different rows.
  const extent = await page.evaluate(() => {
    const s = document.querySelector('main.body');
    return s === null ? null : { client: s.clientHeight, scroll: s.scrollHeight };
  });
  if (extent !== null && extent.scroll > extent.client + 4) {
    for (const fraction of [0.5, 1]) {
      await page.evaluate((f) => {
        const s = document.querySelector('main.body');
        if (s !== null) s.scrollTop = (s.scrollHeight - s.clientHeight) * f;
      }, fraction);
      await painted(page);
      keep(await measureHere(page, scope));
    }
  }

  // **The targeted pass, which is what makes the per-signature guarantee true.**
  // Anything still unread is brought to the middle of the screen and read there.
  // Bounded by the number of signatures still missing, and it stops the moment
  // a pass adds nothing rather than running the cap out.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seen = new Set<string>();
    for (const b of best.values()) if (b.paintRatio !== null) seen.add(signatureOf(b));
    const target = [...best.values()]
      .find((b) => b.paintRatio === null && !seen.has(signatureOf(b)));
    if (target === undefined) break;
    await page.evaluate(({ s, i }) => {
      const el = document.querySelector(s)?.querySelectorAll('button')[i];
      el?.scrollIntoView({ block: 'center', inline: 'center' });
    }, { s: scope, i: target.index });
    await painted(page);
    const before = [...best.values()].filter((b) => b.paintRatio !== null).length;
    keep(await measureHere(page, scope));
    const after = [...best.values()].filter((b) => b.paintRatio !== null).length;
    if (after === before) break;
  }

  await page.evaluate(() => {
    const s = document.querySelector('main.body');
    if (s !== null) s.scrollTop = 0;
  });
  return [...best.values()];
}

/**
 * **The Composer draws nothing until a command is COMPOSED, and that is where the
 * owner's defect lives.**
 *
 * `palette.js` returns early on `if (!complete) return;` — the command box, the
 * Copy control and the read action are all built only once every required
 * argument is filled. So walking to `#/palette` and reading its buttons measures
 * the picker and the flag controls and NOT the three controls this gate exists
 * for.
 *
 * That is not a hypothetical. This spec was written without this step, it passed,
 * and then the fix was REVERTED — reintroducing the owner's exact defect — and it
 * **still passed**. A gate that measures what it was pointed at and is silent
 * about what it missed is this project's most expensive recurring shape.
 *
 * `doctor` is the command driven here because it takes no arguments at all, so
 * "composed" is one selection away and the step cannot fail for a reason that has
 * nothing to do with buttons.
 */
async function composeOnPalette(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator('[data-p="palette"] select').first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  await picker.selectOption('doctor');
  // The control the whole gate is for. If it never appears the composer changed
  // shape, and measuring the screen without it would be the vacuous pass again.
  await page.locator('[data-p="palette"] .cmdactions button').first()
    .waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * **The token beside the paint, printed whether the gate passes or fails**, the
 * way `e2e/frame-paint.spec.ts` prints its own. The measurement is the
 * deliverable: a run where every signature agrees to the decimal is the finding
 * that the token method was right for that signature, and a reader can only see
 * that if the number is on the page.
 */
function report(rows: ButtonReport[]): string {
  const groups = new Map<string, ButtonReport[]>();
  for (const row of rows) {
    const key = signatureOf(row);
    const had = groups.get(key);
    if (had === undefined) groups.set(key, [row]); else had.push(row);
  }
  const lines = [
    'signature'.padEnd(66) + ' seen judged  token  worst   best  ground at the worst',
  ];
  for (const [key, group] of [...groups.entries()].sort()) {
    const judged = group.filter((b) => b.paintRatio !== null);
    const worst = judged.length === 0
      ? null : judged.reduce((a, b) => (b.paintRatio! < a.paintRatio! ? b : a));
    lines.push(
      key.slice(0, 66).padEnd(66)
      + String(group.length).padStart(5)
      + String(judged.length).padStart(7)
      + String(group[0].tokenRatio).padStart(7)
      + (worst === null ? '      -      -  (never on screen)'
        : String(worst.paintRatio).padStart(7)
          + String(Math.max(...judged.map((b) => b.paintBest!))).padStart(7)
          + '  ' + worst.worstGround));
  }
  return lines.join('\n');
}

test('every button drawn on a command-composing screen can be read', async ({ app }) => {
  test.setTimeout(300_000);
  const { page } = app;
  const failures: string[] = [];
  const perScreen = new Map<string, number>();
  const all: ButtonReport[] = [];
  let seen = 0;
  let judged = 0;

  const judge = (b: ButtonReport, where: string): void => {
    seen += 1;
    all.push(b);
    if (b.paintRatio === null) return;
    judged += 1;
    const bar = b.disabled ? MIN_RATIO_DISABLED : MIN_RATIO;
    if (b.paintRatio < bar) {
      failures.push(
        `${where}: "${b.label}" in <${b.container}> at ${b.box} — ${b.paintRatio}:1 `
        + `(${b.color}${b.opacity < 1 ? ` at opacity ${b.opacity}` : ''} on the painted `
        + `${b.worstGround}${b.disabled ? ', disabled' : ''}), needs ${bar}:1. `
        + `The old computed-style method said ${b.tokenRatio}:1 against `
        + `${b.tokenBackground}.`);
    }
  };

  // The composed state FIRST, because it is the one the owner reported and the
  // one a plain walk cannot reach.
  await composeOnPalette(page);
  let composedControls = 0;
  for (const b of await buttonsOn(page, 'palette', { alreadyThere: true })) {
    if (b.container.startsWith('div.cmdactions')) composedControls += 1;
    judge(b, 'palette (composed)');
  }
  // **THE CONTROLS, NOT A HEADCOUNT — and the number moved on 2026-09-07.**
  //
  // This read `expect(seen).toBeGreaterThan(2)`, and 2 was the right floor for
  // exactly as long as a composed READ drew THREE controls: Copy, Execute, and
  // Run. Run is removed
  // (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`), so `doctor`
  // — the command `composeOnPalette` drives, chosen because it takes no
  // arguments — now composes two, and the guard failed on a screen that was
  // working. That is the guard doing its job; it is not a reason to relax it
  // into `> 0`. `div.cmdactions` is also the class whose background made the
  // owner's original defect visible, and it stays language-neutral: these
  // labels are "Copy"/"Execute" in English and "העתקה"/"הרצה" in Hebrew.
  expect(composedControls,
    'the composed Composer drew fewer than its two controls (Copy and Execute, inside '
    + '`div.cmdactions`) — either the compose step did not take, or a control this gate is '
    + 'pointed at has stopped being drawn and the walk below is measuring nothing.')
    .toBeGreaterThanOrEqual(2);

  for (const screen of SCREENS) {
    for (const b of await buttonsOn(page, screen)) {
      perScreen.set(screen, (perScreen.get(screen) ?? 0) + 1);
      judge(b, screen);
    }
  }

  console.log(`\n── button contrast, token beside paint ──\n${report(all)}\n`);

  // **Anti-vacuity, PER SCREEN, because the total was satisfying itself.**
  //
  // This asserted `seen > 20` over an unscoped `document` query, so the rail and
  // header alone made it true — for every screen, including one that drew
  // nothing. Now the collector is scoped to `[data-p="<screen>"]` and each
  // screen is required to have drawn at least one button of its own.
  const drewNothing = SCREENS.filter((s) => (perScreen.get(s) ?? 0) === 0 && !EXPECTED_EMPTY.has(s));
  expect(drewNothing, 'these screens drew no buttons of their own, so nothing on them was judged. '
    + 'Either the walk did not reach them, or their controls need a state to exist in — see '
    + '`composeOnPalette` for what that step looks like.').toEqual([]);
  expect(seen, 'no buttons were measured at all; the walk found nothing to judge').toBeGreaterThan(5);

  // **The guarantee, and it is per SIGNATURE rather than per button.** A ratio
  // can only be read where there is paint, and most of these buttons are below
  // the fold of a 26,309px scroller. What the gate owes a reader is that every
  // distinct way of styling a button that a screen actually draws was judged on
  // real paint at least once — the owner's defect was a property of the styling,
  // not of the row. A signature nothing could reach is named here rather than
  // quietly dropped, because "measured what it could reach, silent about what it
  // missed" is the failure this file has already had twice.
  const reached = new Set(all.filter((b) => b.paintRatio !== null).map(signatureOf));
  const unreached = [...new Set(all.map(signatureOf))].filter((s) => !reached.has(s));
  expect(unreached,
    'these button styles were drawn but never brought onto the screen, so no paint was read '
    + 'for them and nothing about them was judged. Give one of them a state or a scroll step '
    + 'that puts it on screen — do not delete the signature from the walk.').toEqual([]);
  expect(judged,
    'nothing at all was read off the render — every label was off screen, which means the '
    + 'scroll steps above stopped working and this gate is measuring a token again')
    .toBeGreaterThan(5);

  expect(failures, 'a button cannot be read against what is behind it. The usual cause is a '
    + 'CLASSLESS <button> outside a container that styles buttons: the only global rule is '
    + '`button{font:inherit;color:inherit}`, which sets colour and NOT background, so the '
    + 'button takes the app\'s light text and the user agent\'s light button face. Give the '
    + 'control\'s own selector a background from a token — do not rely on where it is appended. '
    + 'The second cause, since the ground is read from the render: the control is TRANSPARENT '
    + 'and sits where `--ground`\'s gradient is bright.')
    .toEqual([]);
});

test('the measurement can see a broken button — proved, not asserted', async ({ app }) => {
  // A gate nobody has watched fail is a gate nobody has tested. This injects the
  // exact defect the owner reported — a classless button in a classless div —
  // and requires the collector to catch it. Without this, a collector that
  // silently found nothing would make the test above green forever.
  const { page } = app;
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'contrast-probe';
    host.style.cssText = 'position:fixed;left:300px;top:300px;z-index:99999';
    const b = document.createElement('button');
    b.textContent = 'Run';
    b.style.all = 'unset';
    b.style.background = 'rgb(239, 239, 239)';
    b.style.color = 'rgb(240, 238, 246)';
    b.style.display = 'inline-block';
    b.style.padding = '4px';
    host.append(b);
    document.body.append(host);
  });
  const found = await measureHere(page, null);
  const probe = found.find((b) => b.label === 'Run');
  expect(probe, 'the collector did not see an injected button at all').toBeDefined();
  expect(probe!.paintRatio, 'the injected button was never read off the render').not.toBeNull();
  expect(probe!.paintRatio!, 'light text on the UA button face must measure as unreadable '
    + 'when the ground is read from the paint').toBeLessThan(MIN_RATIO);
  // The old method agreed on THIS one, and saying so is the point: the defect in
  // the instrument was never that it could not see an opaque fill.
  expect(probe!.tokenRatio, 'an opaque own background is the one case the computed-style walk '
    + 'always got right, and this proof must not pretend otherwise').toBeLessThan(MIN_RATIO);
  await page.evaluate(() => { document.getElementById('contrast-probe')?.remove(); });
});

test('the measurement reads the declared colour while the glyphs are hidden', async ({ app }) => {
  // The whole method rests on `-webkit-text-fill-color` painting nothing and
  // changing nothing. If a browser ever made it also rewrite `color`, every
  // foreground in this file would silently become `rgba(0, 0, 0, 0)` and every
  // ratio would become 1:1 — which fails loudly, but only after a reader has
  // spent a morning on it. This is the one line that says which.
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/watch'; });
  await settleScreen(page, 'watch', { requires: 'button' });
  const read = (): Promise<string[]> => page.evaluate(() =>
    [...document.querySelectorAll('[data-p="watch"] button')]
      .slice(0, 8).map((b) => getComputedStyle(b).color));
  const shown = await read();
  expect(shown.length, 'watch drew no buttons to read a colour from').toBeGreaterThan(0);
  await page.evaluate((id) => {
    const style = document.createElement('style');
    style.id = id;
    style.textContent =
      '*{-webkit-text-fill-color:transparent!important;text-shadow:none!important}';
    document.head.append(style);
  }, HIDE);
  const hidden = await read();
  await showGlyphs(page);
  expect(hidden, '`-webkit-text-fill-color` moved `color`, so every foreground this spec reads '
    + 'while the glyphs are hidden is now the wrong colour').toEqual(shown);
  expect(hidden.every((c) => c !== 'rgba(0, 0, 0, 0)'),
    'a hidden glyph reported its colour as transparent').toBe(true);
});

/**
 * **The proof the item asked for: put a sample where the gradient is steepest.**
 *
 * A contrast test is unusually prone to a proof whose FIXTURE carries its power
 * — if the probe sits where the ground is flat, the old method and the new one
 * agree and the proof proves nothing. So this one is placed deliberately: the
 * first `--ground` blob is `#433580` centred at 14% 6% of a 1280x720 viewport,
 * which is (179, 43), fading to transparent at 58% of a 1536px horizontal
 * radius — so along y=43 the ground runs from `rgb(67, 53, 128)` at x=179 to
 * `#0b0c11` by x≈1070. One wide probe laid across that line sees the whole ramp.
 *
 * The app's own chrome is hidden for the duration so that what is behind the
 * probe is `body` and nothing else. This is testing the MEASUREMENT, not a
 * screen, and leaving the rail behind it would make the fixture's power come
 * from the rail.
 *
 * `rgb(137, 137, 137)` is chosen, not picked: it measures 5.58:1 against
 * `#0b0c11` — comfortably ABOVE the 4.5 bar, so the old instrument passes it —
 * and 2.91:1 against the blob's own colour, which is below it. The gap is the
 * whole finding.
 */
test('the ground is read from the paint, and a moving ground is reported at its worst',
  async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => {
      const hidden: HTMLElement[] = [];
      for (const child of document.body.children) {
        const el = child as HTMLElement;
        hidden.push(el);
        el.dataset['contrastWas'] = el.style.visibility;
        el.style.visibility = 'hidden';
      }
      const host = document.createElement('div');
      host.id = 'ground-probe';
      host.style.cssText = 'position:fixed;left:0;top:30px;width:1200px;height:26px;z-index:99999';
      const b = document.createElement('button');
      b.style.cssText = 'all:unset;display:block;width:1200px;height:26px;background:transparent;'
        + 'color:rgb(137, 137, 137);font:16px/26px monospace;white-space:nowrap';
      host.append(b);
      document.body.append(host);
      // Grow the label until it spans the ramp, measured rather than guessed: a
      // font metric that differs between the two browser projects would
      // otherwise make this probe span 700px on one of them and prove nothing.
      const range = document.createRange();
      for (let n = 8; n <= 400; n += 4) {
        b.textContent = '█'.repeat(n);
        range.selectNodeContents(b.firstChild!);
        if (range.getBoundingClientRect().width > 1150) break;
      }
    });
    const found = await measureHere(page, null);
    const probe = found.find((b) => b.box.startsWith('0,30'));
    await page.evaluate(() => {
      document.getElementById('ground-probe')?.remove();
      for (const child of document.body.children) {
        const el = child as HTMLElement;
        el.style.visibility = el.dataset['contrastWas'] ?? '';
        delete el.dataset['contrastWas'];
      }
    });

    expect(probe, 'the probe laid across the gradient was not collected').toBeDefined();
    expect(probe!.paintRatio, 'the probe was never read off the render').not.toBeNull();

    // 1. The old instrument passes it. Not asserted from memory — recomputed by
    //    the same walk, kept in the collector for exactly this comparison.
    expect(probe!.tokenBackground,
      'the computed-style walk no longer lands on `body`\'s flat `#0b0c11`, so this proof is '
      + 'no longer about the defect it was written for').toBe('rgb(11, 12, 17)');
    expect(probe!.tokenRatio,
      'the old method must PASS this probe, or it is not the defect').toBeGreaterThan(MIN_RATIO);

    // 2. The new one fails it, on paint the screen actually carries.
    expect(probe!.paintRatio!,
      `the paint-read method must fail a probe over the gradient's own blob; it read `
      + `${probe!.paintRatio} on ${probe!.worstGround}`).toBeLessThan(MIN_RATIO);

    // 3. **And the rule for a moving ground.** One element, one line of text, two
    //    very different answers — which is why the gate reports the worst and why
    //    a single number for a gradient is a lie. A margin of 2 points is well
    //    inside the ~2.7 measured and well outside anything antialiasing could
    //    produce.
    expect(probe!.paintBest! - probe!.paintRatio!,
      'the same label spanned the gradient\'s ramp and measured the same at both ends, so '
      + 'either the probe is no longer across the ramp or the sampler has stopped reading '
      + `position (worst ${probe!.paintRatio}, best ${probe!.paintBest})`).toBeGreaterThan(2);
    console.log(`\n── ground probe: token ${probe!.tokenRatio}:1 against `
      + `${probe!.tokenBackground}; paint ${probe!.paintRatio}:1 on ${probe!.worstGround} `
      + `at worst and ${probe!.paintBest}:1 at best ──\n`);
  });

test('an opaque background the old parser could not read is read from the paint',
  async ({ app }) => {
    // The second bug in the same line, and it needs no gradient at all. The walk
    // parsed `rgb()`/`rgba()` only, so `color-mix(in oklch, …)` — which is what
    // `--goldbg` computes to, and what every `aria-pressed="true"` control in
    // this app is filled with — matched nothing, was treated as ABSENT, and the
    // walk climbed past a fully opaque fill to `body`.
    const { page } = app;
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'oklch-probe';
      host.style.cssText = 'position:fixed;left:400px;top:400px;z-index:99999';
      const b = document.createElement('button');
      b.textContent = 'pressed';
      b.style.cssText = 'all:unset;display:inline-block;padding:6px 10px;'
        + 'background:oklch(0.277473 0.028058 86.0336);color:rgb(169, 166, 184);font:14px monospace';
      host.append(b);
      document.body.append(host);
    });
    const found = await measureHere(page, null);
    const probe = found.find((b) => b.label === 'pressed');
    await page.evaluate(() => { document.getElementById('oklch-probe')?.remove(); });

    expect(probe, 'the oklch probe was not collected').toBeDefined();
    expect(probe!.paintRatio, 'the oklch probe was never read off the render').not.toBeNull();
    // The walk still cannot see the fill — that is the defect, stated rather
    // than repaired, because the repair is to stop asking it.
    expect(probe!.tokenBackground,
      'the computed-style walk can now read an `oklch` fill, so this probe is measuring '
      + 'something else').toBe('rgb(11, 12, 17)');
    expect(probe!.tokenRatio - probe!.paintRatio!,
      'the token and the paint agreed on a fill the token parser cannot even read, which means '
      + `the paint is not being read either (token ${probe!.tokenRatio}, paint `
      + `${probe!.paintRatio})`).toBeGreaterThan(2);
  });
