// src/ui/public/lib/pane-resize.js
//
// **The item pane's width is a PREFERENCE.** The owner asked for it on
// 2026-08-27: "resize the right pane to enlarge it … because it may include a
// long text boddy". Somebody reading item after item wants the pane wider and
// wants it to STAY that way — so unlike the float (a MODE, see app.js), this
// is written to `localStorage` and comes back on the next load.
//
// A plain browser ES module: no types, no imports, no build step. Pulled out of
// `app.js` for the reason every other `lib/` module was — spec §6 keeps the DOM
// glue outside the tested surface, and what is testable here is the RULE: what
// a drag means, which stored values are widths, what a keystroke does.
//
// CSSOM only. The page ships under `style-src 'self'` with no `unsafe-inline`,
// so the width is written through `style.setProperty` and never as markup.

/** The one key this module owns. Nothing else about the pane is stored. */
const KEY = 'mycontext.pane.w';

/**
 * 330px is what shipped (mockup ~398) and what `:root{--pane-w:330px}` still
 * declares. Home restores THIS, so a drag that went badly is one keystroke to
 * undo rather than a fiddle back to a number nobody remembers.
 */
const DEFAULT_W = 330;

/**
 * The same floor and ceiling `styles.css`'s `clamp(280px, var(--pane-w), 70vw)`
 * enforces on the layout — repeated here NOT as a second guarantee but so that
 * `aria-valuenow` and the stored number never disagree with what is drawn. The
 * clamp is what actually bounds the layout, deliberately, because it holds for
 * a value written by anything at all; this only keeps the announcement honest.
 *
 * 4000 rather than a viewport-derived ceiling: `70vw` is what the layout obeys
 * and it changes with the window, so a stored number can legitimately exceed
 * today's window and be right again on a wider one. This is only the bound past
 * which a value is not a plausible pane width at all.
 */
const MIN_W = 280;
const MAX_W = 4000;

/**
 * 16px a keystroke. Small enough to aim a column edge with, large enough that
 * crossing the useful range is a held key rather than a career. Arrow keys are
 * the whole keyboard story here: a separator is not a spinner, and Home already
 * covers "put it back".
 */
const STEP = 16;

/**
 * `globalThis.localStorage`, or `null`.
 *
 * **Reading the property itself can throw**, before any method is called on it:
 * a sandboxed iframe, or a browser configured to block site data, raises a
 * SecurityError on the access. A bare default parameter would therefore take
 * the whole boot down on exactly the machines least able to report it.
 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The stored width, or `null` for anything that is not one.
 *
 * `Number.isSafeInteger` and not `Number.isFinite`: `'1e999'` is `Infinity` as
 * a Number, and an infinite width passes every `>=`/`<=` written below it. The
 * whole point of this function is that a store which has been edited, corrupted
 * or written by an older build cannot reach the layout.
 */
function stored(storage) {
  if (storage === null || storage === undefined) return null;
  try {
    const raw = storage.getItem(KEY);
    if (raw === null || raw === undefined) return null;
    const n = Number.parseInt(raw, 10);
    // `String(n) !== raw.trim()` rejects '330px' and '330abc', which parseInt
    // would happily read as 330. A store that says `330px` was written by
    // something this module does not understand, and guessing at its intent is
    // how a convenience starts making decisions.
    if (String(n) !== raw.trim()) return null;
    return Number.isSafeInteger(n) && n >= MIN_W && n <= MAX_W ? n : null;
  } catch {
    // A private window, blocked site data, a quota that is full. The pane is
    // the product and remembering a width is a convenience; a convenience may
    // not take the product down with it.
    return null;
  }
}

/** Write it, and say nothing if the store refuses. Same reasoning as above. */
function remember(storage, px) {
  if (storage === null || storage === undefined) return;
  try {
    storage.setItem(KEY, String(px));
  } catch { /* see stored(): a convenience may not break the product */ }
}

/**
 * Install the drag handle and the arrow keys on `root` — the `.app` element,
 * because `--pane-w` is read by `.app.pane-open`'s own grid template.
 *
 * `storage` and `doc` are injected with browser defaults so `test/ui/
 * pane-resize.test.ts` can drive every failure mode of the store without a
 * browser, which is the reason this is a module and not a block in `app.js`.
 */
export function installPaneResize(root, storage = defaultStorage(), doc = globalThis.document) {
  if (root === null || root === undefined) return;

  const handle = doc?.getElementById?.('panegrip') ?? null;

  // The RANGE, written here rather than authored in `index.html`, because these
  // two numbers must agree with the ones the writer below clamps to and one
  // source of truth is the only way that stays true. Without them a `separator`
  // carrying a value is announced against ARIA's own defaults of 0..100, so
  // "330" would be read as far past the end of a range nobody declared.
  handle?.setAttribute('aria-valuemin', String(MIN_W));
  handle?.setAttribute('aria-valuemax', String(MAX_W));

  let width = stored(storage) ?? DEFAULT_W;

  /**
   * The one writer. `aria-valuenow` moves with the property, because a
   * separator that reports a stale number is worse than one that reports none:
   * a screen-reader user would be told the width they asked for arrived when it
   * did not.
   */
  const setWidth = (px, persist) => {
    width = Math.min(MAX_W, Math.max(MIN_W, Math.round(px)));
    root.style.setProperty('--pane-w', `${width}px`);
    handle?.setAttribute('aria-valuenow', String(width));
    if (persist) remember(storage, width);
  };

  // Applied on install even when nothing was stored, so the property always
  // holds a real number and `aria-valuenow` is never absent on a control that
  // declares a min and a max. Not persisted: reading the default back is not
  // the reader having chosen it.
  setWidth(width, false);

  if (handle === null) return;

  /**
   * Which way is wider.
   *
   * The pane sits at the grid's inline-END in both writing directions, so in
   * Hebrew it is on the LEFT and dragging left NARROWS it. `clientX` knows
   * nothing about that. Read at gesture time rather than at install, because
   * the language toggle flips `dir` on a live page.
   */
  const widenSign = () => (doc?.documentElement?.getAttribute?.('dir') === 'rtl' ? 1 : -1);

  let from = 0;
  let fromWidth = 0;
  let pointer = null;

  handle.addEventListener('pointerdown', (event) => {
    pointer = event.pointerId;
    from = event.clientX;
    fromWidth = width;
    // Capture, rather than a `mousemove` listener on the document: a pointer
    // that leaves the window still delivers its `pointerup` here, so the drag
    // cannot outlive the gesture. A document listener that never sees the
    // release resizes the pane with every later mouse move, and the only way
    // out is a reload.
    if (typeof handle.setPointerCapture === 'function') handle.setPointerCapture(event.pointerId);
    // Stops the browser starting a text selection across the whole page for
    // what the reader intends as a drag of one edge.
    event.preventDefault?.();
  });

  handle.addEventListener('pointermove', (event) => {
    if (pointer === null) return;
    setWidth(fromWidth + widenSign() * (event.clientX - from), false);
  });

  /**
   * The gesture ends, and THIS is where the preference is written.
   *
   * Not on every `pointermove`: `localStorage` is synchronous, and a drag
   * across the screen is hundreds of moves. One write per gesture stores
   * exactly what the reader settled on.
   */
  const end = (event) => {
    if (pointer === null) return;
    if (typeof handle.releasePointerCapture === 'function' && event?.pointerId !== undefined) {
      try { handle.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    }
    pointer = null;
    remember(storage, width);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  handle.addEventListener('keydown', (event) => {
    const sign = widenSign();
    let next = null;
    if (event.key === 'ArrowLeft') next = width + sign * -STEP;
    else if (event.key === 'ArrowRight') next = width + sign * STEP;
    // Home is the undo. Named in the plan for that reason: a bad drag must cost
    // one keystroke, not a hunt for 330.
    else if (event.key === 'Home') next = DEFAULT_W;
    if (next === null) return;
    // Only for the keys this control owns. Swallowing the rest would trap Tab
    // on the handle and take Escape away from the pane.
    event.preventDefault?.();
    setWidth(next, true);
  });
}
