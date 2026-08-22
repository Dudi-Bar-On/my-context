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
 */
export function screenHead(ctx, root, titleKey, verdictKey, subKey) {
  const phd = el('div', 'phd');
  const h = el('h2');
  h.append(...ctx.t(titleKey));
  const verdict = el('span', 'verdict');
  verdict.append('✅ ');
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
  index: ['chip', '◇'],
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
