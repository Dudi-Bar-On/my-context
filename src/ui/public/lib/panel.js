// src/ui/public/lib/panel.js
//
// **THE FLOATING PANEL — THE FIRST DIALOG IN THIS PRODUCT, AND THEREFORE THE
// HOUSE PATTERN FROM NOW ON.** `semantic/9`,
// `TASK-the-find-options-the-owner-asked-for-twice-in-a-floating`.
//
// The owner specified the shape himself and he was precise: *"three different
// subjects on three different dialogs opend from the right mouse button menu,
// could be a little bit transparent, movable on screen, stays on screen while
// you can look at the viewer and closed uppon clicking it's close button as a
// standard window."*
//
// SEARCH is the first of the three. NAVIGATION and COPY follow once he has
// judged this one, which is why this file exists at all: it is the FRAME, with
// one caller today, rather than a box built into the screen that would have to
// be reverse-engineered twice.
//
// ── `show()` AND NEVER `showModal()`, WHICH IS THE WHOLE TECHNICAL CRUX ────
//
// *"stays on screen while you can look at the viewer"*. A MODAL dialog makes
// everything behind it inert — the viewer would be dead while the panel was
// open, which is the one thing he asked for it not to be. `show()` is
// non-modal and leaves the document live.
//
// **AND THE CONSEQUENCE IS HANDLED HERE RATHER THAN DISCOVERED LATER:
// ESCAPE ONLY AUTO-CLOSES A MODAL DIALOG.** With `show()` the browser does
// nothing at all on Escape. He asked for a close button; a reader expects
// Escape; this ships both, and `Escape` is bound on the dialog itself with
// `stopPropagation`, which is the guard `confirm/5` established on the rename
// box so that the item pane behind it keeps its own meaning of the key.
//
// A second consequence, and it is why `position` is set in CSS rather than
// left to the user agent: a non-modal `<dialog>` is `position: absolute` by
// default, so it would scroll away with the page. `.mcpanel` is `fixed`.
//
// ── WHAT IS ALREADY DECIDED, AND IT IS THE OWNER'S TO OVERRULE ────────────
//
//   — **Several may be open at once.** Nothing here closes a sibling.
//   — **Each remembers where it was dragged**, per viewer, in `localStorage`,
//     keyed by the panel's own name. Every read is guarded: a private window
//     throws on the property access itself, and a page that fell over there
//     would fall over on the machines least able to report it.
//   — **Clicking a panel brings it to the front.** One counter, handed out on
//     `pointerdown`, because two panels dragged over each other otherwise
//     stack in creation order for ever.
//
// ── CSSOM ONLY ────────────────────────────────────────────────────────────
//
// Geometry is written through `style.setProperty` and never as a `style=`
// attribute, which is this app's standing rule — and in LOGICAL properties,
// which is `.tvmenu`'s rule one file along: a pointer answers in physical
// pixels from the left, and in a Hebrew page `inset-inline-start` is measured
// from the RIGHT edge, so the number is reflected once at the boundary.

/** How many panels this module has ever raised. The front one wears the top. */
let raised = 0;

/**
 * The lowest `z-index` a panel may hold.
 *
 * Above `.tvmenu`'s 20, because the right-click menu is what OPENS a panel and
 * a panel that opened under the menu that opened it would be invisible until
 * the menu closed.
 */
const BASE_Z = 40;

/** Nothing may be dragged so far that its own header cannot be grabbed back. */
const KEEP_VISIBLE_PX = 48;

/**
 * `globalThis.localStorage`, or `null`.
 *
 * **Reading the property itself can throw**, before any method is called on
 * it — a sandboxed frame, or a browser set to block site data. The same
 * guard, for the same reason, as `lib/pane-resize.js`, whose header spells it
 * out: a convenience may not take the product down with it.
 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The one key shape this module owns. */
export function placeKey(name) {
  return `mycontext.panel.${name}`;
}

/**
 * **THE STORED PLACE, OR `null` FOR ANYTHING THAT IS NOT ONE.**
 *
 * Exported and pure so that `test/ui/panel.test.ts` can drive every way a
 * store can lie without a browser — which is the half of this file that has
 * rules rather than pixels, and the half the item requires to keep working
 * *"when that read throws or returns nothing, which it does in a private
 * window"*.
 *
 * `Number.isFinite` and not a bare `typeof`: `JSON.parse('{"start":null}')`
 * gives `null`, which `typeof` calls `object` and every `>=` below accepts.
 * `'1e999'` parses to `Infinity`, which passes every bound anyone would write.
 * A store that has been edited, corrupted or written by an older build must
 * not be able to reach the layout at all.
 */
export function readPlace(storage, name) {
  if (storage === null || storage === undefined) return null;
  let raw;
  try {
    raw = storage.getItem(placeKey(name));
  } catch {
    // Private mode, blocked site data, a quota error on read in some engines.
    return null;
  }
  if (typeof raw !== 'string' || raw === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Somebody else's value under our key, or half a write. Not an error to
    // report to a reader: the panel simply opens where it opens.
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const { start, top } = parsed;
  if (!Number.isFinite(start) || !Number.isFinite(top)) return null;
  return { start: Math.round(start), top: Math.round(top) };
}

/** Write it, and say nothing if the store refuses. Same reasoning as above. */
export function writePlace(storage, name, place) {
  if (storage === null || storage === undefined) return;
  try {
    storage.setItem(placeKey(name), JSON.stringify(place));
  } catch { /* see readPlace(): a convenience may not break the product */ }
}

/**
 * **A PLACE THAT IS ON THE SCREEN.**
 *
 * Pure, exported and tested, because it is the rule a stored value has to
 * survive: the reader dragged this panel on a 2560-wide monitor and is now on
 * a laptop, or turned the window sideways, and a panel restored at
 * `start: 2100` would be a feature that has silently vanished. `KEEP_VISIBLE_PX`
 * of it is always reachable at both ends.
 *
 * A panel WIDER than the viewport clamps to `0` rather than to a negative
 * number: the start edge is the one a reader needs, because that is where the
 * title and the close button are.
 */
export function clampPlace(place, panel, view) {
  const maxStart = Math.max(0, view.w - Math.min(panel.w, view.w));
  const maxTop = Math.max(0, view.h - KEEP_VISIBLE_PX);
  return {
    start: Math.round(Math.min(Math.max(place.start, 0), maxStart)),
    top: Math.round(Math.min(Math.max(place.top, 0), maxTop)),
  };
}

/**
 * **BUILD ONE PANEL.** Returns `{ dialog, body, open, close, isOpen }`.
 *
 *   — `name`     the storage key and the `data-panel` handle a test names.
 *   — `title`    nodes, from `ctx.t(...)`, for the header.
 *   — `closeLabel` the accessible name of the close button. `×` alone is not
 *                one, and this app has shipped an unnamed control before.
 *   — `onClose`  run after the dialog closes, whatever route closed it. The
 *                caller uses it to put the controls it lent back where they
 *                came from, so there is ONE restore path rather than three.
 *   — `fallbackFocus` where the caret goes when the panel closes and there
 *                was nowhere to hand it back to. See `close()`.
 *   — `doc` / `storage` injected, so the DOM-free half is drivable in Node.
 *
 * It is NOT opened here. A panel that mounted open would draw itself over a
 * document the reader has not asked it about.
 */
export function createPanel({
  name,
  title,
  closeLabel,
  onClose = () => {},
  fallbackFocus = () => null,
  doc = globalThis.document,
  storage = defaultStorage(),
}) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'mcpanel';
  dialog.dataset.panel = name;
  const head = doc.createElement('div');
  head.className = 'mcpanelhead';
  const heading = doc.createElement('h2');
  heading.className = 'mcpanelname';
  heading.append(...title);
  /*
   * **`aria-label` AND NOT `aria-labelledby`.** Pointing at the heading would
   * be the better markup — except that the close button sits in the same
   * header, and the label is taken from the heading's own words either way.
   * Written once, here, from the nodes the caller supplied.
   */
  dialog.setAttribute('aria-label', heading.textContent ?? name);
  const shut = doc.createElement('button');
  shut.type = 'button';
  shut.className = 'mcpanelclose';
  /*
   * **THE GLYPH IS `aria-hidden` AND THE NAME IS A SENTENCE.** `×` read aloud
   * is "multiplication sign", which is not what this button does. Same
   * treatment the `.tvmenutick` and every `.tvkey` chip on this screen get,
   * and for the same reason: the visible mark and the announced name are two
   * carriers of one fact, not one carrier doing both jobs badly.
   */
  const glyph = doc.createElement('span');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '×';
  shut.append(glyph);
  shut.setAttribute('aria-label', closeLabel);
  shut.title = closeLabel;
  head.append(heading, shut);

  const body = doc.createElement('div');
  body.className = 'mcpanelbody';
  dialog.append(head, body);

  /** Where the caret was when this opened, so closing can hand it back. */
  let from = null;

  const isOpen = () => dialog.open === true;

  const toFront = () => {
    raised += 1;
    dialog.style.setProperty('z-index', String(BASE_Z + raised));
  };

  const view = () => ({
    w: doc.documentElement?.clientWidth ?? 0,
    h: doc.documentElement?.clientHeight ?? 0,
  });

  const rtl = () => (doc.documentElement?.getAttribute('dir') === 'rtl');

  /** The panel's own inline-start, in logical pixels from the start edge. */
  const startOf = (box) => (rtl() ? view().w - box.right : box.left);

  const placeAt = (place) => {
    const box = dialog.getBoundingClientRect();
    const safe = clampPlace(place, { w: box.width, h: box.height }, view());
    dialog.style.setProperty('inset-inline-start', `${safe.start}px`);
    dialog.style.setProperty('inset-block-start', `${safe.top}px`);
    /*
     * **THE HEIGHT BOUND IS WRITTEN HERE BECAUSE CSS CANNOT READ THE TOP** —
     * `semantic/11`, and it was found by LOOKING AT A SCREENSHOT, which is the
     * second time on this panel that a defect survived a green browser suite
     * and was caught by an eye (`reports/2026-09-16-the-find-panel.md` §5.5
     * is the first, a find field 470 px tall).
     *
     * `styles.css` bounds the panel with `max-block-size: calc(100vh - 4rem)`,
     * which is a bound on the panel's HEIGHT and not on where its bottom
     * lands. This panel opens 284 px down and the help makes it 936 px tall,
     * so it was 936 px of content ending 220 px BELOW a 1000 px viewport —
     * with the match stepper and the count line, which are the two things the
     * reader came for, off the bottom of the screen and unreachable, because a
     * `position:fixed` box does not scroll with the page.
     *
     * A fixed element cannot be bounded against its own top in CSS, and the
     * top is not a constant: the reader drags this. So the bound is rewritten
     * on every placement — open, drag and clamp all arrive here — and the
     * dialog's own `overflow:auto` then scrolls what does not fit. `1rem` of
     * air below, which is the inset the panel opens with above.
     */
    dialog.style.setProperty('max-block-size', `calc(100vh - ${safe.top}px - 1rem)`);
    return safe;
  };

  /**
   * **THE DRAG.**
   *
   * Pointer capture rather than a listener on `document`, which is
   * `pane-resize.js`'s measured rule: a pointer that leaves the window still
   * delivers its `pointerup` to the captured element, so the gesture cannot
   * outlive itself and leave the panel following the mouse with no way out
   * but a reload.
   *
   * The physical delta is converted ONCE, here, by `startOf` and the sign
   * below — everything downstream is in logical pixels, so nothing else in
   * this file has to know which way the page reads.
   */
  let pointer = null;
  let fromX = 0;
  let fromY = 0;
  let fromPlace = { start: 0, top: 0 };

  head.addEventListener('pointerdown', (event) => {
    // The close button is IN the header. Without this, pressing it begins a
    // drag, and a drag that never moves still swallows the click.
    if (event.target instanceof Element && event.target.closest('.mcpanelclose') !== null) return;
    pointer = event.pointerId;
    fromX = event.clientX;
    fromY = event.clientY;
    const box = dialog.getBoundingClientRect();
    fromPlace = { start: startOf(box), top: box.top };
    if (typeof head.setPointerCapture === 'function') head.setPointerCapture(event.pointerId);
    // Otherwise the browser begins selecting the title text across the page.
    event.preventDefault();
  });

  head.addEventListener('pointermove', (event) => {
    if (pointer === null) return;
    const dx = event.clientX - fromX;
    placeAt({
      start: fromPlace.start + (rtl() ? -dx : dx),
      top: fromPlace.top + (event.clientY - fromY),
    });
  });

  /**
   * The gesture ends and THIS is where the place is written.
   *
   * One write per drag rather than one per `pointermove`: `localStorage` is
   * synchronous and a drag across a screen is hundreds of moves. What is
   * stored is the CLAMPED place, so the value in the store is one the next
   * viewport can use rather than one it has to repair.
   */
  const endDrag = (event) => {
    if (pointer === null) return;
    if (typeof head.releasePointerCapture === 'function' && event?.pointerId !== undefined) {
      try { head.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    }
    pointer = null;
    const box = dialog.getBoundingClientRect();
    writePlace(storage, name, { start: Math.round(startOf(box)), top: Math.round(box.top) });
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  /**
   * Shut it, and hand the caret back.
   *
   * **THE CARET IS NEVER LEFT ON THE BODY**, which is the half of the focus
   * rule that actually bites on this screen: the panel holds the controls the
   * reader was using, so closing it removes them, and unless something takes
   * focus in the same turn the browser drops it to `document.body` and the
   * reader is back at the top of the page.
   * `TASK-every-write-on-conversations-throws-focus-to-the-document` measured
   * that at 47 tab stops here.
   */
  const close = () => {
    if (!isOpen()) return;
    const back = from;
    from = null;
    dialog.close();
    onClose();
    /*
     * **FOCUS LEFT INSIDE A CLOSED DIALOG IS FOCUS NOWHERE, and that was
     * found by driving it.** The close button is IN the panel, so at this
     * moment `document.activeElement` is still that button — `dialog.close()`
     * hides the subtree but the engine's focus fix-up is not guaranteed to
     * have run yet. A bare `!== document.body` test therefore reads "somebody
     * has the caret", returns, and leaves the reader on a control that is no
     * longer drawn. It passed in English and reddened in Hebrew on the same
     * build, which is what a race looks like from the outside.
     */
    const active = globalThis.document?.activeElement ?? null;
    const stranded = active === null || active === doc.body || dialog.contains(active);
    if (!stranded) return;
    /*
     * **AND A PANEL OPENED FROM THE WELL HAS NOWHERE TO HAND IT BACK TO**,
     * which is why there is a second target rather than only `from`. Opening
     * from the right-click menu or from the `/` key leaves the caret on the
     * body — the menu has already shut itself, the reader was scrolling — so
     * `from` is legitimately `null` and restoring it would be restoring
     * nothing. Measured in the browser: closing left `document.activeElement`
     * on `BODY`, which is exactly the 47-tab-stop defect
     * `TASK-every-write-on-conversations-throws-focus-to-the-document`
     * records. `fallbackFocus` is the caller's answer to "where does the
     * reader stand when this closes"; for Search it is the find box, back in
     * the bar, which is the control the panel borrowed.
     */
    if (back !== null && back.isConnected) { back.focus(); return; }
    const spare = fallbackFocus();
    if (spare !== null && spare !== undefined && spare.isConnected) spare.focus();
  };

  shut.addEventListener('click', close);

  /**
   * **ESCAPE, WIRED BY HAND, BECAUSE `show()` DOES NOT GET IT FOR FREE.**
   *
   * The `cancel` event and the automatic close are MODAL-only behaviour. A
   * non-modal dialog receives nothing at all, so without this the panel would
   * be a box with no keyboard way out — and the reader would find that out by
   * pressing Escape and watching the item pane behind it close instead.
   *
   * `stopPropagation` is that second half, and it is the rule already in force
   * on this screen: `app.js` closes the item pane on Escape and `confirm/5`
   * bound the key on the rename box with exactly this guard. One press, one
   * level, innermost first.
   */
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });

  // Clicking anywhere in a panel raises it. `pointerdown` and not `click`, so
  // a reader who presses a button in the back panel sees it come forward
  // BEFORE the button acts rather than after.
  dialog.addEventListener('pointerdown', toFront);

  /**
   * Open it where it was left.
   *
   * `show()` first and THEN place it: a `<dialog>` that is not open has no
   * box, so `getBoundingClientRect()` answers zeros and `clampPlace` would
   * clamp against a panel of no size. The default — when nothing is stored,
   * which is every first open and every private window — is the point the
   * caller passes, which is where the reader's own gesture was.
   */
  const open = (fallback) => {
    if (isOpen()) { toFront(); return; }
    const active = globalThis.document?.activeElement ?? null;
    from = active !== null && active !== doc.body ? active : null;
    // NEVER `showModal()`. See this file's header: the viewer must stay live.
    dialog.show();
    toFront();
    placeAt(readPlace(storage, name) ?? fallback);
  };

  return { dialog, body, head, open, close, isOpen };
}
