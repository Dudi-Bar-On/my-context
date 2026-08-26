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
 * — `pinned`, `jit`, `restored` and `index` are the config's own keys and the
 * selector's own words, drawn as literals in every chip the file paints.
 */
const TIERCHIP = {
  pinned: ['chip gov', '◆'],
  jit: ['chip ok', '●'],
  restored: ['chip ok', '●'],
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
// **ONE implementation, five call sites**, because five surfaces sharing one
// mechanism must share their wording or the product grows five ways to say
// "there is more". The five are the delivered list and the carried blocks
// (`preview.js`), the injected-now table (`injected.js`), the review queue
// (`work.js`) and the pack stack (`packs.js`).
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

/** A record bounds by time; a computation bounds by admission order. */
function orderKeyFor(spec) {
  return spec.order === 'recent' ? 'list.recentOf' : 'list.admittedOf';
}

export function boundedList(ctx, host, items, draw, spec) {
  const cap = spec.cap;
  const total = items.length;
  const bound = el('div', 'bound');
  const line = el('p', 'small');
  const button = el('button');
  button.type = 'button';
  bound.append(line, button);

  let expanded = false;

  const paint = () => {
    const shown = expanded ? total : Math.min(cap, total);
    // **WHICH `shown` SURVIVE IS THE CLAIM THE SENTENCE MAKES**, so the slice
    // has to match it. A record surface whose rows arrive OLDEST FIRST — which
    // is how the design of record draws the injected table, ascending by its
    // own When column — keeps its most recent rows at the END. Slicing the head
    // there would show the oldest N under a sentence promising the newest N,
    // which is the exact failure this requirement exists to prevent: a sample
    // presented as a summary. The survivors are then drawn in their ORIGINAL
    // order, so the table's direction is unchanged and only its membership is.
    const kept = spec.take === 'last' ? items.slice(total - shown) : items.slice(0, shown);
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
      return;
    }
    // **Each sentence is its own `<span>`**, because that is how the design of
    // record carries a keyed sentence inside a paragraph that holds more than
    // one — `data-t` has to sit ON an element, and `applyLang` replaces that
    // element's children wholesale. Appending the nodes bare into the `<p>`
    // would render identically and diverge structurally, which is exactly the
    // kind of difference `screen-parity` exists to catch.
    line.replaceChildren(
      sentence(ctx, orderKeyFor(spec), { shown: num(shown), total: num(total) }),
      ...(spec.displayOnly === true
        ? [document.createTextNode(' '), sentence(ctx, 'list.displayOnly', { total: num(total) })]
        : []),
    );
    button.replaceChildren(...ctx.t('list.showAll', { total: num(total) }));
  };

  button.addEventListener('click', () => { expanded = !expanded; paint(); });
  paint();
  return bound;
}
