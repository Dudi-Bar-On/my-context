/**
 * `nav.inj` — **Injection preview**, `<section data-p="preview">` in the design
 * of record. The landing screen, and the one the whole visual direction is
 * judged on.
 *
 * **Built from the mockup's markup, not from the plan's Step 3 sketch.** That
 * sketch draws a `<ul>` of items and a `<pre>` of rendered text and names nine
 * string keys — `preview.pickFile`, `preview.nothing`, `preview.spilled`,
 * `preview.renderedText`, `common.loading` among them — that **no string table
 * declares**, because the tables are transcribed key-for-key from the design of
 * record and it declares none of them. `t()` THROWS on a key it cannot find, so
 * that sketch cannot render a single line; and its shape is superseded anyway
 * by the repaint, whose own words for this screen are the composition below.
 * Every key named here is one the mockup declares.
 *
 * **The composition** (repaint Task 6, spec §3 primitives 2 and 3): a left
 * `.plane` holding a `.pane` of `.row`s, a right `.plane` holding a `.lit` of
 * `.blk`s, both inside the `.pair` that carries the perspective, and the rail
 * outside both. Selecting a row holds it up (`aria-pressed`) and lights its
 * paired block; every other block drops to `.58` — which is a STYLESHEET fact
 * (`.lit.linked .blk{opacity:.58}` / `.lit.linked .blk.sel{opacity:1}`), so
 * this file toggles the `.sel` class and never a number.
 * `e2e/injection-preview.spec.ts` pins the value against the mockup.
 *
 * **What this screen does NOT draw, and why it draws nothing in their place.**
 * Two of the mockup's cards here are graphical views this repository cannot
 * serve, and the instruction for that case is explicit — *"Where a view cannot
 * be drawn, stop and ask; do not draw a weaker one"*:
 *
 *   - **The gate ladder** (`#gates`, with `preview.why` and `preview.whyn`). It
 *     needs the INDEX of the first gate that failed, in `select()`'s own
 *     six-gate order. **No read model carries it.** `Spill.reason` is English
 *     prose and the plan forbids synthesising the ladder from it by name; the
 *     screen's own note says the fix needs *"a stable code on `injection()`"*,
 *     which does not exist yet. A two-column table naming the failing gate is
 *     precisely the weaker version the instruction refuses, because the ORDER
 *     is the explanation.
 *   - **The four-tier budget ribbon with its ghost lane** (`#ribbons`, with
 *     `preview.ribbon` and `preview.ribbonn`). Three of its four tracks are
 *     servable — `/api/simulate` returns `costs` and `tiersRun`. The fourth is
 *     not: the index tier admits LINES, and per-line index costs are exposed by
 *     no endpoint
 *     (`ui/read-model.ts` · `per-line index costs are exposed by no endpoint in this plan` · ~394).
 *     A ribbon drawn with three of four tracks is a weaker version of a view
 *     whose whole subject is *"four tiers, and what fell out of each"*.
 *
 * Both are reported to the owner rather than approximated. When the read models
 * arrive they land here in the mockup's own order, `preview.why` first.
 */
import { selectQuery } from '/lib/viewmodel.js';
import {
  el, errorNote, idFull, linkId, mono, num, openIcon, screenHead, spaced, tierChip,
} from '/screens/parts.js';

/**
 * The mockup's four `<option>`s, in its order. Literals, not translated
 * strings: these are `SelectContext.event`'s own values, and the query grammar
 * sends them back over the wire unchanged.
 */
const EVENTS = ['session-start', 'tool', 'compact', 'manual'];

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'preview.h', 'preview.v', 'preview.sub');

  // --- Event --------------------------------------------------------------
  const evCard = el('div', 'card pane');
  const evH = el('h3');
  evH.append(...ctx.t('preview.ev'));
  // The mockup writes this row's layout as a `style` attribute. CSP forbids one
  // in the shipped app, so the same declarations go through CSSOM instead.
  const bar = el('div');
  bar.style.setProperty('display', 'flex');
  bar.style.setProperty('gap', '8px');
  bar.style.setProperty('flex-wrap', 'wrap');
  bar.style.setProperty('align-items', 'center');
  bar.style.setProperty('font-size', '14.5px');

  const evLabel = el('label', 'small');
  evLabel.htmlFor = 'evsel';
  evLabel.append(...ctx.t('preview.evl'));
  const evsel = el('select');
  evsel.id = 'evsel';
  for (const name of EVENTS) {
    const option = el('option', null, name);
    option.value = name;
    evsel.append(option);
  }
  // The path slot. The mockup draws `session-start` and writes one unkeyed
  // literal here — `path — none (session-start takes none)`. Three of the four
  // events take no path, so the literal is drawn with the event it is actually
  // about; the sentence is the mockup's, the noun is the one on screen.
  const pathSlot = el('span');
  bar.append(evLabel, evsel, pathSlot);

  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.more'));
  const helpBox = el('div', 'helpbox');
  const firstLine = el('span');
  const p1 = el('b');
  p1.append(...ctx.t('help.p1'));
  firstLine.append(p1, ' ');
  // The five narrowing inputs, as the mockup writes them: `.m` literals rather
  // than translated strings — they are `SelectContext`'s own field names.
  const inputs = ['event', 'path', 'seen', 'restore', 'focus'];
  inputs.forEach((name, i) => {
    firstLine.append(mono(name));
    if (i < inputs.length - 1) firstLine.append(', ');
  });
  firstLine.append(' — all five, or this previews a different question.');
  const secondLine = el('span');
  secondLine.append(...ctx.t('help.p2'));
  helpBox.append(firstLine, secondLine);
  help.append(summary, helpBox);
  evCard.append(evH, bar, help);
  root.append(evCard);

  // --- Delivered, the scene, and the carry --------------------------------
  const out = el('div');
  root.append(out);

  /**
   * The file list, fetched ONCE and only when a tool event first needs it.
   * `/api/coverage` walks the whole repository, and the landing event is
   * `session-start`, which takes no path at all — paying for that walk on first
   * paint would be paying for a picker the screen has not shown.
   */
  let files = null;
  let chosenPath = null;

  async function ensureFiles() {
    if (files !== null) return files;
    const coverage = await ctx.api('/api/coverage');
    files = coverage.files.map((f) => f.path);
    if (chosenPath === null && files.length > 0) [chosenPath] = files;
    return files;
  }

  function drawPathSlot(event) {
    pathSlot.replaceChildren();
    if (event !== 'tool') {
      pathSlot.className = 'm small';
      pathSlot.append(`path — none (${event} takes none)`);
      return;
    }
    pathSlot.className = '';
    // `path` is a `.m` LITERAL, exactly as the helpbox above spells it — the one
    // accessible name for this control the design of record supplies without
    // inventing a string key the tables do not declare.
    const label = el('label', 'm small', 'path');
    label.htmlFor = 'pathsel';
    const picker = el('select', 'path');
    picker.id = 'pathsel';
    for (const file of files ?? []) {
      const option = el('option', 'path', file);
      option.value = file;
      picker.append(option);
    }
    if (chosenPath !== null) picker.value = chosenPath;
    picker.onchange = () => { chosenPath = picker.value; void show(); };
    pathSlot.append(label, ' ', picker);
  }

  async function show() {
    const event = evsel.value;
    out.replaceChildren();
    try {
      if (event === 'tool') await ensureFiles();
      drawPathSlot(event);
      // No file to preview a tool event against. `/api/select` refuses
      // `event=tool` without a path, and asking anyway would turn an empty
      // repository into a refusal the reader would have to decode.
      if (event === 'tool' && chosenPath === null) return;

      const qs = selectQuery(event, event === 'tool' ? chosenPath : null, ctx.session());
      // `/api/select` is `select()`'s serialization and nothing else (design
      // decision 7), so the SELECTION is read from there and never from the
      // simulator's copy of it. `/api/simulate` is asked only for the two things
      // decision 7 keeps off that response: the budgets, and which tiers ran.
      const [selection, sim] = await Promise.all([
        ctx.api(`/api/select?${qs}`),
        ctx.api(`/api/simulate?${qs}`),
      ]);
      draw(selection, sim);
    } catch (error) {
      // The endpoint's own words, drawn INSTEAD of the data: an empty selection
      // and a refused request are two facts, and only one of them is about the
      // corpus.
      out.replaceChildren(errorNote(error.message));
    }
  }

  function draw(selection, sim) {
    // `Delivered` — the three numbers `preview.cap` words. `used` is
    // `Selection.tokens`, the figure the budget decisions were actually made
    // against and which the selector computed rather than a client re-derived;
    // `budget` is the sum over the tiers this event RAN, because a budget for a
    // tier that never ran is not part of what this selection could spend.
    const budget = sim.tiersRun.reduce((total, tier) => total + sim.budgets[tier], 0);
    const delivered = el('div', 'card pane');
    const dh = el('h3');
    dh.append(...ctx.t('preview.delivered'));
    const cap = el('p', 'small');
    cap.append(...ctx.t('preview.cap', {
      items: num(selection.full.length),
      used: num(selection.tokens),
      budget: num(budget),
    }));
    delivered.append(dh, cap);
    out.append(delivered);

    // The two-plane scene. `.pair` carries the perspective; `.plane.l` and
    // `.plane.r` carry the tilt; the rail is outside both and untouched.
    const scene = el('div', 'scene');
    const pair = el('div', 'pair');
    const left = el('div', 'plane l');
    const rows = el('div', 'pane rows');
    rows.id = 'deliveredRows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
    const right = el('div', 'plane r');
    const lit = el('div', 'lit linked');
    lit.id = 'deliveredLit';

    selection.full.forEach((entry, index) => {
      const row = el('button', 'row');
      row.type = 'button';
      row.dataset.choice = entry.item.id;
      // The FIRST item is held selected on first paint, so the screen never
      // shows a rule without the text it produced.
      row.setAttribute('aria-pressed', String(index === 0));
      row.append(idFull(entry.item.id), tierChip(entry.tier));
      rows.append(row);

      const blk = el('div', index === 0 ? 'blk sel' : 'blk');
      blk.dataset.for = entry.item.id;
      const head = linkId(entry.item.id);
      head.append(openIcon());
      const body = el('div', 'blkbody');
      // The item's own prose, paragraph for paragraph. NOT a client-side
      // re-spelling of `renderItemBlock` — its heading, its steps section, its
      // observation lines and its scope footer are that function's format, and
      // a second implementation of a format is how two surfaces come to
      // disagree about what was injected. The whole item is one click away in
      // the global detail pane, which is where this `.linkid` leads.
      for (const para of String(entry.item.body ?? '').split(/\n{2,}/)) {
        if (para.trim() !== '') body.append(el('p', null, para.trim()));
      }
      blk.append(head, body);
      lit.append(blk);
    });

    // Delegated — one listener for the plane, exactly as the mockup does it.
    rows.addEventListener('click', (event) => {
      const row = event.target.closest('.row');
      if (!row) return;
      const id = row.dataset.choice;
      for (const r of rows.querySelectorAll('.row')) {
        r.setAttribute('aria-pressed', String(r === row));
      }
      for (const b of lit.querySelectorAll('.blk')) {
        b.classList.toggle('sel', b.dataset.for === id);
      }
    });

    left.append(rows);
    right.append(lit);
    pair.append(left, right);
    scene.append(pair);
    out.append(scene);

    drawCarry(selection.index.carried);
  }

  /**
   * The cross-session carry, in the four clauses `core/render.ts` already
   * composes for the CLI out of this same one field — so the two surfaces have
   * one vocabulary rather than two that agree today.
   *
   * **Each clause is omitted entirely when its own list is empty**, which is the
   * mockup's rule and not a tidiness preference: a clause carrying a zero every
   * session is how a reader learns to skim past the one session where it
   * matters.
   *
   * The mockup's `.carrieditem` — the carried id drawn as a chip beside this
   * sentence — is **marked `PROPOSED`**, and the file's own header says a
   * PROPOSED feature is *"not built and not specified"*. It is not built here.
   */
  function drawCarry(carried) {
    if (carried === null || carried === undefined) return;
    const line = el('p', 'small');
    line.append(...ctx.t('preview.carried', {
      lines: num(carried.shown),
      session: `${carried.sessionId} · ${carried.label}`,
    }));
    out.append(spaced(line));

    if (carried.dropped.length > 0) {
      const dropped = el('p', 'small');
      dropped.append(...ctx.t('index.carriedDropped', {
        dropped: num(carried.dropped.length),
        // The drop REASONS ride untranslated inside the slot: `select.ts`'s
        // `carriedDropReason` is their one spelling and there is no stable code
        // to translate from.
        ids: carried.dropped.map((d) => `${d.id} (${d.reason})`).join(', '),
      }));
      out.append(dropped);
    }
    if (carried.displaced.length > 0) {
      const displaced = el('p', 'small');
      displaced.append(...ctx.t('index.carriedDisplaced', {
        displaced: num(carried.displaced.length),
        ids: carried.displaced.join(', '),
      }));
      out.append(displaced);
    }
    // The fetch line appears only when there is something to fetch.
    if (carried.dropped.length > 0 || carried.displaced.length > 0) {
      const fetchLine = el('p', 'small');
      fetchLine.append(...ctx.t('index.carriedFetch'));
      out.append(fetchLine);
    }
  }

  evsel.onchange = () => { void show(); };
  ctx.onSessionChange(() => { void show(); });
  await show();
}
