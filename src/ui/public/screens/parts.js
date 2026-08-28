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

/** The mockup's `style="margin-block-start:8px"`, without the attribute. */
export function spaced(e) {
  e.style.setProperty('margin-block-start', '8px');
  return e;
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
 * **It is still an emoji, and that is the mockup's ruling rather than an
 * oversight.** The ui1 Task 19 reconciliation says the emoji verdict "is
 * replaced by the `.chip` primitive", reading repaint spec §6 — but §6's
 * subject is CATEGORY glyphs on item ids ("the id already says the kind"), and
 * it never mentions the verdict. The mockup is the appearance authority, and
 * repaint 9.2 repainted the Evidence group's six screens on 2026-08-22,
 * editing these very lines to swap `.card.gloss` for `.card.pane` — and left
 * all twenty-one `✅`/`⚠️` in place, with `.verdict` still carrying its own
 * live rule. A shipped surface that disagreed with it on two screens out of
 * twenty-one would be the fracture, not the fix. Flagged in this task's report
 * with a screenshot, because a look is what should settle it.
 */
export function screenHead(ctx, root, titleKey, verdictKey, subKey, glyph = '✅') {
  const phd = el('div', 'phd');
  const h = el('h2');
  h.append(...ctx.t(titleKey));
  const verdict = el('span', 'verdict');
  verdict.append(`${glyph} `);
  const vtext = el('span');
  vtext.append(...ctx.t(verdictKey));
  verdict.append(vtext);
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
 * A refusal, in the SERVER'S OWN WORDS.
 *
 * **The mockup has no string for this on any of the three screens**, and
 * inventing one would fail `test/ui/strings-parity.test.ts` in the direction
 * that names it — a key in a table that the design of record does not declare.
 * So nothing here is worded: the endpoint's own `error` text is shown as it
 * arrived, which is the same treatment `/api/session/:session/injected`'s
 * `error` field already carries — "the seen file's own words, not a
 * paraphrase". Recorded as an open question for the owner rather than resolved
 * here.
 *
 * It is `.spill` (`--crit`) and it is drawn INSTEAD of the data, never beside
 * an empty view: an endpoint that refused and a corpus that is empty are two
 * facts, and this project's own invariant is that the difference survives.
 */
export function errorNote(message) {
  return el('p', 'small spill', message);
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
 */
function orderKeyFor(spec) {
  if (spec.order === 'recent') return 'list.recentOf';
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
