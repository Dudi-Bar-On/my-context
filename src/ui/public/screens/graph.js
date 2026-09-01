/**
 * `nav.ev` — **Relations**, `<section data-p="graph">` in the design of record.
 * An ego-graph, not a hairball.
 *
 * **Columns by DIRECTION, which is the mockup's layout and `gr.note`'s own
 * reason for it**: *"Direction is the layout: the column decides which way the
 * relation points, so nothing has to be simulated."* `layoutGraph`
 * (`lib/viewmodel.js`) places every node by its SIGNED depth from the focus and
 * this file turns those columns into the mockup's own geometry — three columns
 * at x=8 / 345 / 682 across a 900-wide viewBox fall straight out of the even
 * spread it uses, so the numbers here are the mockup's numbers rather than a
 * second set that happens to look similar.
 *
 * **No physics, no dependency, and no re-derivation.** Both facts an edge
 * carries are the server's: `type` is the relation vocabulary and `loadBearing`
 * is `isLoadBearing(type)` called in `/api/graph`, because *"a browser `.js`
 * module cannot import a core `.ts` module and re-listing the vocabulary in the
 * client is the copied-rule defect this plan exists to prevent"*.
 *
 * **Every stroke is a CLASS, never an inline colour.** `line.setAttribute(
 * 'stroke', e.dangling ? '#a01a1a' : '#888')` in the plan's own Step 3 names two
 * colours that no longer exist in the token set, and `setAttribute` cannot read
 * a custom property. The mockup already draws edges as `path.edge.bearing` /
 * `.edge.ref` / `.edge.dangling` and nodes as `rect.node.focus` / `.missing` /
 * `.superseded` / `.more`, backed by `--edge-3`, `--ink`, `--faint`, `--gold`
 * and `--crit` — and a class is the only form `forced-colors` can restate,
 * since SVG `stroke`/`fill`
 * (`docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` · `are NOT force-adjusted in Chromium` · ~560).
 * The reconciliation note asks for `--pane-edge` on a plain edge; the mockup's
 * own `.edge` rule is `stroke:var(--edge-3)` and the mockup is the design of
 * record, so `--edge-3` stands. Neither hex appears in this file, and neither
 * appears in the mockup either.
 *
 * **Nodes carry ids, never titles** (`gr.note`), which is what keeps
 * bidi-sensitive text out of every SVG in the product. The whole chart mirrors
 * by PROJECTION rather than by transform — `X()` and `px()` below flip an
 * x-coordinate into the reading direction so the glyphs stay upright, exactly
 * as the mockup's own restored views do.
 *
 * **WHO CHOOSES THE FOCUS — ANSWERED 2026-08-31, AND IT IS A READ.**
 * Every field the legend names is served — `focus` is the response's own,
 * `missing` is on the node, superseded is `status`, load-bearing is on the edge
 * and *"+N more"* is `omitted` — so nothing here is refused for want of data.
 * What was missing was the one thing the design of record does not say:
 * **WHICH item the ego graph is drawn around.** The screen fetched `/api/items`
 * and took element zero, so it could only ever draw one item's neighbourhood
 * and which one was an accident of the list's order.
 *
 * **There is a picker now** — `gr.focus`, a `<label>` and a `<select>` of every
 * id `/api/items` answers, above the plate. Changing it refetches
 * `/api/graph?focus=…` and redraws the chart and the readout, and NOTHING
 * ELSE: it writes nothing, composes nothing and confirms nothing, because
 * choosing what to look at is a READ. There is no compose-then-execute control
 * here and there is no approval boundary to cross, which is the same reason
 * `coverage.js` needs none for its tree.
 *
 * **The default is unchanged and deliberately so.** The picker opens on the
 * first item by id — the same answer twice, the same answer the screen has
 * always given — so a reader who touches nothing sees what they saw before.
 *
 * **`gr.focus`, not the plan sketch's `graph.focus`.** Every string this screen
 * names is in its own `gr.` namespace, and `test/ui/graph-screen.test.ts` holds
 * *"the screen names every `gr.*` key the tables declare, and invents none"* in
 * BOTH directions — a `graph.` key would sit outside the only gate that would
 * ever notice it going unused or undeclared. The WORDING is unapproved copy
 * drafted here and reported as such.
 *
 * **`graph.radius` is NOT declared, and that is the task's own ruling rather
 * than an omission.** Radius stays the endpoint's default of 1, which is what
 * `gr.sub` promises — *"One focused item, radius 1"* — and it is SENT rather
 * than relied on, so the readout names the horizon it actually asked for
 * instead of quoting a default from memory. A radius control is a second
 * question and it is settled the other way.
 *
 * The header's own focus popup remains a different thing entirely
 * (`focus.live` — `state/focus.json`, which narrows injection by tags,
 * categories and scope and names no item at all).
 *
 * **EVERY DECISION IS IN `egoDrawing`, AND NOTHING IS DECIDED IN THE GLUE.**
 * Spec §6 names `screens/*.js` as the untested surface, so this file computes
 * the entire picture — every coordinate, every class, every truncation — as
 * plain data first, and `chart()` does nothing but turn that list into
 * elements. `test/ui/graph-screen.test.ts` drives `egoDrawing` with no
 * `document` in the room and pins the routing against the mockup's own
 * numbers, which is the only way to check the one thing a kind count cannot:
 * an edge either arrives at its own two nodes or it does not.
 *
 * **NOTHING IS DROPPED IN SILENCE.** Three ends were loose. A *dangling*
 * relation is drawn, not swallowed — the server answers `missing: true` on the
 * node and `dangling: true` on the edge, so it is a `path.edge.dangling`
 * arriving at a `rect.node.missing` and the legend names both. A relation
 * whose target lies past the radius is never SENT (`/api/graph` stops the walk
 * at the horizon) and one whose target the 60-node cap refused is dropped
 * server-side with that node — neither is knowable from this response, so the
 * readout states `radius` and `omitted` outright rather than letting the
 * reader assume the picture is the whole corpus. And an edge this layout
 * cannot place — an endpoint absent from `nodes`, which a well-formed response
 * never contains — used to be `continue`d away without a trace; it is now
 * counted and reported as the defect it would be.
 */
import { edgeClass, egoNodeClass, layoutGraph } from '/lib/viewmodel.js';
import { el, errorNote, fitChart, mono, screenHead, spaced } from '/screens/parts.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * The mockup's own chart box, node box and gutters, number for number.
 *
 * `W` IS THE FLOOR SINCE 2026-09-01, NOT THE VALUE — owner ruling, *"could we
 * extend the x axis to the right … just more spacing"*. Measured at 2273px, a
 * 900-unit ego graph rendered 900px inside a 1,973px plate and left 1,073px of
 * that card empty. `egoDrawing` now takes the span its host actually has and
 * spreads the SAME three 210px columns across it; the node box, the type
 * labels and `--fs-chart` are untouched, because the extra room goes entirely
 * into the gutters between columns. See `chartSpan` in `screens/parts.js` for
 * the measurement and why widening the viewBox is not stretching it.
 */
const W = 900;
const NH = 22;
const NW = 210;
const MARGIN = 8;
/** The mockup's fixed height, kept as the FLOOR rather than as the value: it
 *  draws five nodes and the endpoint caps at sixty. */
const H_MIN = 250;
/** Vertical room `spread()` leaves for the column captions and the last row. */
const H_PAD = 56;
/** Room per row past the point where `H_MIN` stops being enough. */
const ROW = 26;
/** The mockup's own id truncation — an ego graph is read, not audited. */
const ID_MAX = 28;
/** The baseline the mockup writes its three column captions on. */
const CAPTION_Y = 16;
/**
 * The radius this screen asks for. It is also `/api/graph`'s own default, and
 * is sent anyway: the readout tells the reader how far the picture reaches,
 * and a screen that reads that number off a server default it never named
 * would be repeating a fact rather than stating one.
 */
const RADIUS = 1;

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'gr.h', 'gr.v', 'gr.sub');

  const card = el('div', 'card pane');
  const box = el('div', 'plate');
  box.id = 'ego';
  // The readout and any refusal live in their own container so a focus change
  // can replace exactly them. Rebuilding the whole card would rebuild the
  // picker, and a `<select>` replaced mid-interaction takes the keyboard focus
  // and the open list down with it.
  const foot = el('div');
  card.append(box, legend(ctx), spaced(note(ctx)), foot);
  root.append(card);

  let items;
  try {
    items = await ctx.api('/api/items');
  } catch (error) {
    box.append(errorNote(error.message));
    return;
  }
  // A corpus with no items has no ego to draw and no error to report. The card,
  // the legend and the note are the real markup; the plate holds nothing. No
  // picker either — an empty `<select>` is a control offering nothing.
  if (items.items.length === 0) return;

  /**
   * Draw the ego graph around one id, replacing the plate and the foot.
   *
   * Every refusal lands in the PLATE, where the chart would have been, and the
   * foot is emptied with it: a stale readout under a failed refetch would name
   * a focus, a node count and an omitted count belonging to the previous
   * picture, which is worse than no readout at all.
   */
  // ── THE FILTER'S STATE, AND WHY IT OUTLIVES ONE DRAW ─────────────────────
  //
  // A reader who has turned `relates_to` off is asking a question, not
  // describing one item, so changing the focus must not silently answer a
  // different question than the one on screen. The set therefore lives with the
  // SCREEN and not with the response, and the control is built once.
  //
  // It starts EMPTY and is filled from the first response's `relationTypes`,
  // which is how "all on by default" is expressed without this file knowing how
  // many types there are.
  const kept = new Set();
  let filterBar = null;
  // True once `/api/graph` has told us the vocabulary, which is what turns
  // `kept` from "not asked yet" into "the reader kept nothing".
  let typesKnown = false;
  // Set by `render` once the picker exists; the type filter calls it so one
  // function owns the list and the count that explains it.
  let refilterPicker = () => {};
  // ── THE RESPONSE THE FILTER ACTS ON, HELD RATHER THAN CLOSED OVER.
  //
  // The control is built ONCE, on the first response, and a toggle must repaint
  // whatever is on screen NOW. Closing its callback over the response that
  // happened to be in hand when it was built made a toggle redraw the graph of
  // the item the reader had navigated AWAY from — measured, not reasoned: with
  // the picker moved to a three-edge item, turning a type off and on again came
  // back with zero edges, because "on again" repainted the first item.
  let latest = null;

  const draw = async (focus) => {
    box.replaceChildren();
    foot.replaceChildren();
    let data;
    try {
      data = await ctx.api(
        `/api/graph?focus=${encodeURIComponent(focus)}&radius=${RADIUS}`,
      );
    } catch (error) {
      box.append(errorNote(error.message));
      return;
    }
    // The vocabulary as the server sent it. Defaulted to an empty list rather
    // than to a guess: a response without it draws no filter at all, which is
    // the screen as it was, and is the honest reading of "this server does not
    // offer the vocabulary" — never a list this file invented.
    const types = Array.isArray(data.relationTypes) ? data.relationTypes : [];
    latest = data;
    if (filterBar === null && types.length > 0) {
      for (const type of types) kept.add(type);
      typesKnown = true;
      filterBar = typeFilter(ctx, types, kept, () => {
        // BOTH, and in this order: the drawing answers the question, and the
        // picker stops offering items that would answer it with nothing.
        if (latest !== null) paint(latest);
        refilterPicker();
      });
      card.insertBefore(filterBar, box);
      refilterPicker();
    }
    paint(data);
  };

  /**
   * Draw one response through the filter — the only place the two meet.
   *
   * Separated from `draw` because toggling a type must NOT refetch: the answer
   * is already here and the question being asked is about what to show of it.
   * One request per focus, and none per toggle.
   */
  const paint = (data) => {
    box.replaceChildren();
    foot.replaceChildren();
    // FILTERED HERE AND NOT IN THE LAYOUT. `egoDrawing` is a pure function of a
    // response, and it stays one: what it receives is a response with fewer
    // edges, which is a thing the server could equally have sent. The layout has
    // no opinion about filtering and does not gain one.
    const all = data.edges;
    // ── "NOT ASKED YET" IS NOT "KEPT NOTHING", AND CONFLATING THEM DREW AN
    //    EMPTY SCREEN. `kept` is empty in two completely different situations:
    //    before any response has told us the vocabulary, and after a reader has
    //    turned every type off. Treating the first as the second meant that on
    //    any server whose `/api/graph` does not carry `relationTypes` — an older
    //    one, or a fixture — this screen filtered every edge away and reported
    //    "no relation of the types you kept" instead of drawing the graph.
    //    Caught by `e2e/chart-scale.spec.ts`'s 60-node cap test, which serves
    //    exactly such a body, rather than by reasoning about it.
    //
    //    `typesKnown` is the same distinction `qualifies` already makes for the
    //    picker; this is the other half of it. With no vocabulary there is no
    //    filter, so everything is shown and nothing is hidden.
    const shown = !typesKnown ? all
      : kept.size === 0 ? [] : all.filter((e) => kept.has(e.type));
    const hidden = all.length - shown.length;
    const view = { ...data, edges: shown };

    // Mirroring is by PROJECTION, not by transform: `scale(-1,1)` would reverse
    // the digits too. The page direction is `<html dir>`, which `applyLanguage`
    // sets from the string table itself — a layout fact, not a translated one,
    // and the one piece of the drawing that has to be read from the document.
    // Re-read per draw rather than closed over: the language can change between
    // one focus and the next without this screen being rebuilt.
    const rtl = document.documentElement.dir === 'rtl';

    // ── AN EMPTY RESULT SAYS WHY IT IS EMPTY ────────────────────────────────
    //
    // A filter that hides everything must not render an empty canvas, which
    // reads as the screen being broken rather than as the reader having asked
    // for nothing. The two empty cases are DIFFERENT facts and are said
    // differently: an item with no relations at all is not a filter outcome, and
    // telling a reader to "turn a type back on" would be advice that cannot
    // help them.
    if (shown.length === 0 && all.length > 0) {
      const why = el('p', 'small');
      why.append(...ctx.t('gr.filterEmpty', { n: String(hidden) }));
      box.append(why);
      foot.append(spaced(readout(data, { edges: [] }, hidden)));
      return;
    }
    if (all.length === 0) {
      const why = el('p', 'small');
      why.append(...ctx.t('gr.filterNoRel'));
      box.append(why);
    }

    // ── DRAWN AT THE PLATE'S OWN WIDTH, AND REDRAWN WHEN IT MOVES.
    //
    // `fitChart` measures `box`, calls this back with the span it found, and
    // calls it again on every distinct width the plate takes afterwards — a
    // window resize, or the item pane being dragged, both of which change this
    // card without changing the viewport in a way a `resize` listener could
    // see. The drawing is recomputed rather than the SVG rescaled: the whole
    // point is that the type does not scale with the box.
    fitChart(box, W, (span) => chart(ctx, egoDrawing(view, rtl, span)));
    // The readout and the refusal below it are counts, not coordinates, so
    // they are taken once from a drawing at the authored width. Nothing in
    // either depends on how wide the plate is.
    const drawing = egoDrawing(view, rtl);
    // `data` and not `view`, deliberately: the readout states what the SERVER
    // answered beside what is drawn, so `edges=` stays the true total and
    // `filtered=` says how much of it is not on screen.
    foot.append(spaced(readout(data, drawing, hidden)));
    if (hidden > 0) {
      const said = el('p', 'small');
      said.append(...ctx.t('gr.filterHid', { n: String(hidden) }));
      foot.append(said);
    }
    // An endpoint no column holds is a response this layout cannot honour, and
    // the one thing it must not do is quietly draw the rest. Reported in the
    // refusal register the screen already uses for a server that said no.
    const lost = drawing.undrawnEdges + drawing.undrawnNodes;
    if (lost > 0) {
      foot.append(errorNote(
        `${drawing.undrawnEdges} edge(s) and ${drawing.undrawnNodes} node(s) in this response ` +
        'name an id the ego layout could not place, and are not in the drawing above',
      ));
    }
  };

  // The picker goes ABOVE the plate, because it decides what the plate holds.
  // The default is the first item by id — what this screen has always drawn.
  // ── THE SPLIT, AND THE DEFAULT THAT FOLLOWS FROM IT ──────────────────────
  //
  // Computed HERE rather than inside the picker, because the first draw has to
  // agree with what the picker is showing as selected. Opening on
  // `items.items[0]` while the picker lists only related items put the `<select>`
  // on its own first option and the chart on a different item entirely — a
  // silent disagreement between a control and the thing it controls, caught by
  // `e2e/graph-focus.spec.ts` rather than reasoned about.
  //
  // `related` first, falling back to the whole list: a corpus in which nothing
  // relates to anything still opens on an item and draws its single node, which
  // is the honest picture of that corpus rather than an empty card.
  // An item qualifies when it has at least one relation of a type the reader
  // has KEPT. `relationKinds === null` is "this server did not measure it", and
  // an unmeasured item is offered — filtering on an absent measurement would
  // empty the picker on a surface that never counted.
  const qualifies = (item) => {
    if (!Array.isArray(item.relationKinds)) return true;
    if (item.relationKinds.length === 0) return false;
    // Before the first response the vocabulary is unknown and `kept` is empty;
    // an item with any relation at all qualifies until the types arrive.
    if (kept.size === 0 && !typesKnown) return true;
    return item.relationKinds.some((t) => kept.has(t));
  };
  // RETIRED IS THE SERVER'S CLOSED SET, NOT THREE NAMES WRITTEN HERE.
  // `retiredStatuses` is `RETIRED_STATUSES` out of `core/select.ts` served on
  // `/api/items`; a fourth member added there reaches this screen with no edit.
  // An absent list means the server did not say, and nothing is treated as
  // retired — never a guess at which statuses count.
  const retired = new Set(Array.isArray(items.retiredStatuses) ? items.retiredStatuses : []);
  const isRetired = (item) => retired.has(item.status);
  const bar = focusPicker(ctx, items.items, qualifies, isRetired, draw);
  refilterPicker = bar.refilter;
  card.insertBefore(bar, box);
  const first = items.items.find((i) => qualifies(i) && !isRetired(i))
    ?? items.items.find(qualifies) ?? items.items[0];
  await draw(first.id);
}

/**
 * **The relation-type filter — the owner's *"find interesting relations by type
 * not just browsing all over the list"*, 2026-09-01.**
 *
 * -- THE OPTIONS ARE NOT A LIST IN THIS FILE ------------------------------
 *
 * They are `body.relationTypes`, which is `RELATION_TYPES` out of
 * `core/vocabulary.ts` served verbatim on `/api/graph`. This module's own header
 * already names the alternative as the defect -- "re-listing the vocabulary in
 * the client is the copied-rule defect this plan exists to prevent" -- and a
 * hand-kept copy of a CLOSED vocabulary is what this project has been caught
 * keeping more than once. A ninth member of that array appears here with no
 * change to this file, to `styles.css` or to either string table.
 *
 * The type NAMES are therefore not translated, exactly as the relation labels
 * on the edges are not: they are the vocabulary's own words, and inventing a
 * Hebrew `derived_from` would be translating an identifier. Only the prose
 * around them is keyed.
 *
 * -- MULTI-SELECT, ALL ON -------------------------------------------------
 *
 * The owner's phrase is "find interesting relations", which is SUBTRACTIVE: a
 * reader knows which types are noise here and wants them gone, not one type at
 * a time. Single-select answers a different question ("show me only the
 * supersedes") and cannot express "everything except relates_to", which is the
 * common case in a corpus where one type dominates. All on by default, so the
 * screen opens on the whole picture and the filter is something a reader
 * REACHES for rather than something they have to undo first.
 *
 * `aria-pressed` toggles rather than checkboxes, because `.segbar
 * button[aria-pressed="true"]` is this design's existing shape for exactly this
 * -- a row of sticky toggles -- and a new control kind would be a new thing to
 * learn for no gain.
 *
 * -- AND IT RE-FILTERS THE PICKER, WHICH IS THE OWNER'S OWN CORRECTION ----
 *
 * This screen shipped an argument for the opposite — that the picker answers
 * "does this item relate to anything at all", a fact about the corpus, and
 * should hold still while the type filter answers a question about the view.
 * The owner looked at the product and that argument was wrong: with only
 * `derived_from` kept, `OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-
 * the-machine` was still offered, and choosing it drew nothing and reported two
 * hidden relations. An item whose every relation is of a type the reader has
 * turned OFF is, for that reader in that moment, exactly as empty as one with
 * no relations — and it costs a line in a list whose length was the complaint,
 * plus a wasted click to find out.
 *
 * So the picker's test is `at least one relation OF A KEPT TYPE`, re-run on
 * every toggle, and the count line under it moves with the list rather than
 * being computed once. A count that stops matching the list it explains is
 * worse than no count.
 *
 * **The item in force is always offered, even when it stops qualifying.** The
 * reader is looking at it; dropping it from the list would leave the `<select>`
 * showing one item and the chart showing another, which is the disagreement
 * `e2e/graph-focus.spec.ts` already caught once on this screen. It stays,
 * the drawing says plainly that nothing of the kept types is in it, and the
 * next choice is the reader's.
 *
 * -- IT FILTERS THE DRAWING, WHICH IS ALSO THE LIST -----------------------
 *
 * There is one list on this screen and it is the picture; the readout under it
 * counts what the picture holds. Both move together, and the readout gains a
 * `filtered=N` term whenever anything is hidden, so a number a reader quotes is
 * never a total the view is not showing.
 */
function typeFilter(ctx, types, state, onChange) {
  const wrap = el('div');
  wrap.style.setProperty('display', 'flex');
  wrap.style.setProperty('gap', '8px');
  wrap.style.setProperty('align-items', 'center');
  wrap.style.setProperty('flex-wrap', 'wrap');

  const label = el('label', 'small');
  label.append(...ctx.t('gr.filter'));
  wrap.append(label);

  const bar = el('div', 'segbar');
  bar.id = 'egotypes';
  const buttons = [];
  const paint = () => {
    for (const [type, button] of buttons) {
      button.setAttribute('aria-pressed', state.has(type) ? 'true' : 'false');
    }
  };
  for (const type of types) {
    const button = el('button');
    button.type = 'button';
    button.dataset.type = type;
    // The vocabulary's own word, as data: `mono` is what this product spends on
    // an identifier everywhere else, and a relation type is one.
    button.append(mono(type));
    button.addEventListener('click', () => {
      if (state.has(type)) state.delete(type); else state.add(type);
      paint();
      onChange();
    });
    buttons.push([type, button]);
    bar.append(button);
  }
  // Two shortcuts, because clearing seven toggles to see one type is not a
  // filter. `None` is legal and lands on the empty state, which SAYS what it is
  // rather than drawing a blank card.
  const all = el('button');
  all.type = 'button';
  all.append(...ctx.t('gr.filterAll'));
  all.addEventListener('click', () => { for (const t of types) state.add(t); paint(); onChange(); });
  const none = el('button');
  none.type = 'button';
  none.append(...ctx.t('gr.filterNone'));
  none.addEventListener('click', () => { state.clear(); paint(); onChange(); });
  bar.append(all, none);
  paint();
  wrap.append(bar);
  return wrap;
}

/**
 * **The focus picker. It is a READ and it is built like one.**
 *
 * A `<label>` and a `<select>`, and nothing else: no compose block, no confirm,
 * no Execute. Choosing which item to look at writes nothing, so there is no
 * approval boundary here to cross and building one would teach a reader that
 * this screen can change their corpus.
 *
 * **Every option is an id and nothing else**, which is `gr.note`'s rule for
 * this whole screen — *"Nodes carry ids, not titles"* — held one element
 * further out than the SVG. An `<option>` cannot hold a `<span>`, so the
 * isolation an id needs inside RTL prose cannot be built out of elements here;
 * `dir="ltr"` on the `<select>` is the attribute form of the same thing, and it
 * is why the served `title` is not appended beside the id.
 *
 * **`change`, not `input`.** A `<select>` fires `input` on every keyboard
 * arrow while the list is open, so `input` would fetch a graph per keystroke
 * on the way to the id a reader was actually walking towards.
 *
 * The bar's layout is set through CSSOM: the server sends `style-src 'self'`
 * with no `'unsafe-inline'`, so no `style` attribute can be written here — the
 * constraint `parts.js` records for its own `spaced()`.
 */
function focusPicker(ctx, items, qualifies, isRetired, draw) {
  const bar = el('div');
  bar.style.setProperty('display', 'flex');
  bar.style.setProperty('gap', '8px');
  bar.style.setProperty('align-items', 'center');
  bar.style.setProperty('flex-wrap', 'wrap');
  bar.style.setProperty('margin-block-end', '8px');

  const label = el('label', 'small');
  label.htmlFor = 'egofocus';
  label.append(...ctx.t('gr.focus'));

  const picker = el('select');
  picker.id = 'egofocus';
  // An id is data, not prose. `.m`'s `direction:ltr` cannot reach inside an
  // `<option>`, and this attribute is what keeps the list readable under `א`.
  picker.dir = 'ltr';
  // ── ITEMS WITH NOTHING TO DRAW ARE NOT OFFERED, AND THE COUNT IS STATED ──
  //
  // Owner, 2026-09-01: *"i see many relations that has only an item in the
  // centre of the screen, these are items without relations, they should at
  // least be filtered or disabled because they make the selection list long
  // without any added value"*. Measured on this corpus: 591 of 733 items have a
  // degree of zero, so four fifths of the list led to a single node in an empty
  // card. FILTERED rather than disabled, because a disabled row still costs a
  // line in a list whose LENGTH is the complaint.
  //
  // **`relations` is BOTH directions**, counted by `/api/items` the same way
  // `/api/graph` builds its adjacency — every relation pushed onto its source
  // and its target. An out-degree test would have hidden every item that names
  // nobody but is named by somebody, and each of those draws a perfectly good
  // graph with the arrows pointing inward. Verified against the endpoint rather
  // than assumed.
  //
  // **`null` is NOT zero.** A server that did not measure the degree says
  // `null`, and an unmeasured item is OFFERED: hiding on an absent measurement
  // would empty the picker on any surface that never counted, which is the
  // blank-is-a-failure defect wearing a filter.
  //
  // **NOTHING IS DROPPED SILENTLY.** The count of what is not listed is drawn
  // under the picker with a control that lists them anyway, so the picker is
  // never quietly shorter than the corpus (`INV-nothing-is-dropped-silently`).
  // ── TWO INDEPENDENT REASONS AN ITEM IS NOT LISTED, COUNTED SEPARATELY ────
  //
  // An item is offered when it has at least one relation of a KEPT TYPE and is
  // not RETIRED. Both exclusions are reversible and each has its own count,
  // because a reader who cannot tell which rule removed something cannot trust
  // the list at all: one combined "N hidden" would be worse than either number
  // alone. The retired count is of items that would OTHERWISE have been listed,
  // so an item that is both retired and unrelated is counted once, under the
  // reason a reader would hit first.
  //
  // The item in force is offered whatever either rule says — see the header on
  // the type filter for why a control must never disagree with its own drawing.
  let showAll = false;
  let showRetired = false;
  let hiddenUnrelated = 0;
  let hiddenRetired = 0;
  const fill = () => {
    const held = picker.value;
    const list = [];
    hiddenUnrelated = 0;
    hiddenRetired = 0;
    for (const item of items) {
      const ok = showAll || qualifies(item);
      const retired = isRetired(item);
      if (item.id === held || (ok && (showRetired || !retired))) { list.push(item); continue; }
      if (!ok) hiddenUnrelated += 1; else hiddenRetired += 1;
    }
    picker.replaceChildren();
    for (const item of list) {
      // RETIRED IS VISIBLE WHEN IT IS SHOWN. An `<option>` holds no elements, so
      // the chip every other screen would draw cannot be built here; the status
      // WORD is appended instead, and it is the corpus's own vocabulary rather
      // than a marker invented for this list — the same reason the relation
      // types are drawn untranslated.
      const label = isRetired(item) ? `${item.id} · ${item.status}` : item.id;
      const option = el('option', null, label);
      option.value = item.id;
      picker.append(option);
    }
    // The selection survives the list changing under it. Without this a reader
    // who toggled a type while looking at an item would be moved to a different
    // one without asking, and the graph would follow.
    if (held !== '' && [...picker.options].some((o) => o.value === held)) picker.value = held;
  };
  picker.addEventListener('change', () => { void draw(picker.value); });

  bar.append(label, picker);

  // The disclosure, and the way back. Hidden — not absent — when nothing is
  // being held back, so the line appears and disappears with the fact rather
  // than the bar changing shape.
  const line = (countOf, textKey, showKey, hideKey, flip, state) => {
    const p = el('p', 'small');
    const button = el('button');
    button.type = 'button';
    button.addEventListener('click', () => { flip(); fill(); refresh(); });
    const paint = () => {
      p.replaceChildren();
      // Hidden — not absent — when there is nothing to disclose, so the bar does
      // not change shape as the counts move. A line saying "0 are not listed" is
      // noise; a line that vanishes and reappears in a different place is worse.
      p.hidden = countOf() === 0 && !state();
      if (p.hidden) return;
      p.append(...ctx.t(textKey, { n: String(countOf()) }));
      p.append(document.createTextNode(' '));
      button.replaceChildren(...ctx.t(state() ? hideKey : showKey));
      p.append(button);
    };
    return { el: p, paint };
  };
  const unrelatedLine = line(
    () => hiddenUnrelated, 'gr.lonely', 'gr.lonelyShow', 'gr.lonelyHide',
    () => { showAll = !showAll; }, () => showAll,
  );
  const retiredLine = line(
    () => hiddenRetired, 'gr.retired', 'gr.retiredShow', 'gr.retiredHide',
    () => { showRetired = !showRetired; }, () => showRetired,
  );
  const refresh = () => { unrelatedLine.paint(); retiredLine.paint(); };
  fill();
  refresh();
  bar.append(unrelatedLine.el, retiredLine.el);
  // Handed back so the type filter can re-run the same two steps: one owner of
  // the list, called from wherever the question changes.
  bar.refilter = () => { fill(); refresh(); };
  return bar;
}

/** `sv(tag, attrs)` — the mockup's own SVG factory, argument for argument. */
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

/**
 * **The whole picture, as data, before one element exists.**
 *
 * `data` is `/api/graph`'s body verbatim and `rtl` is the page direction; the
 * return value is every coordinate, class and label the chart will carry, plus
 * the count of anything the response named and this layout could not place.
 * No `document` is touched, which is what lets `test/ui/graph-screen.test.ts`
 * assert that an edge leaves its OWN node's box and arrives at its OWN
 * target's — the fact a parity gate counting element kinds is blind to.
 *
 * **Both facts on an edge are the server's** (`type` is the relation
 * vocabulary, `loadBearing` is `isLoadBearing(type)` called in `/api/graph`),
 * and `edgeClass` turns the pair into the legend's three line styles here in
 * the browser without re-listing one word of that vocabulary.
 */
export function egoDrawing(data, rtl = false, span = W) {
  // Never narrower than the design of record's own box: three 210px node boxes
  // plus their gutters do not fit in less, and below it the stylesheet's
  // `max-inline-size:100%` shrinks the whole drawing as it always has.
  const width = Math.max(W, span);
  const X = (u) => (rtl ? width - u : u);
  const px = (x, boxW) => (rtl ? width - x - boxW : x);

  const placed = layoutGraph(data.nodes, data.edges, data.focus);
  // `at` is the whole reason an edge can find its ends: `layoutGraph` answers
  // in ITS order, not the response's, so an edge's two ids are resolved
  // through this index rather than by position in either array.
  const at = new Map(placed.map((p) => [p.id, p]));
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const columns = Math.max(...placed.map((p) => p.x)) + 1;
  // The "+N more" node is a ROW in the last column, exactly as the mockup adds
  // it to its own `out` column, so it counts toward that column's height.
  const perColumn = new Array(columns).fill(0);
  for (const p of placed) perColumn[p.x] += 1;
  if (data.omitted > 0) perColumn[columns - 1] += 1;
  const height = Math.max(H_MIN, H_PAD + Math.max(...perColumn) * ROW);

  // One column is centred; two or more spread evenly across the box. At three
  // columns this is the mockup's own 8 / 345 / 682.
  const colX = (index) => (columns === 1
    ? (width - NW) / 2
    : MARGIN + index * ((width - NW - MARGIN * 2) / (columns - 1)));
  const spread = (count, index) => {
    const gap = (height - H_PAD) / Math.max(count, 1);
    return 34 + gap * index + gap / 2;
  };

  // Rows within a column, in `layoutGraph`'s (relation type, id) order.
  const yOf = (p) => spread(perColumn[p.x], p.y);

  // The column captions, one per occupied column, carrying the SIGNED depth
  // rather than a sentence: the middle one is the declared key `gr.lfocus` and
  // only `chart()` holds a `ctx` to resolve it with.
  const captions = [];
  const captionSeen = new Set();
  for (const p of placed) {
    if (captionSeen.has(p.x)) continue;
    captionSeen.add(p.x);
    captions.push({ depth: Math.sign(p.depth), x: X(colX(p.x) + NW / 2), y: CAPTION_Y });
  }

  // **HOW AN EDGE FINDS ITS TWO ENDPOINTS.** `edge.from` and `edge.to` are ids,
  // and each is looked up in `at` to get the column/row the layout gave THAT
  // id — never an index into `data.nodes`, whose order is the server's walk
  // order and not the layout's. The curve then leaves the trailing side of the
  // earlier column's box and arrives at the leading side of the later one, so
  // both ends land on a box edge rather than under a label; `forward` is what
  // makes that true for a relation that points leftward as well as rightward.
  const edges = [];
  let undrawnEdges = 0;
  for (const edge of data.edges) {
    const a = at.get(edge.from);
    const b = at.get(edge.to);
    // An id no column holds cannot be routed to, and guessing a coordinate for
    // it would draw a line to a place nothing is. Counted, and said out loud
    // by `render` — the previous `continue` lost it without a trace.
    if (a === undefined || b === undefined) { undrawnEdges += 1; continue; }
    const forward = a.x <= b.x;
    const x1 = forward ? colX(a.x) + NW : colX(a.x);
    const x2 = forward ? colX(b.x) : colX(b.x) + NW;
    const y1 = yOf(a);
    const y2 = yOf(b);
    const mx = (x1 + x2) / 2;
    edges.push({
      from: edge.from,
      to: edge.to,
      // Every edge carries its relation TYPE, because "broken" and "how much it
      // matters" are two different facts (`gr.note`). A relation type is the
      // vocabulary's own word and is not translated anywhere in the mockup.
      type: edge.type,
      cls: `edge ${edgeClass(edge)}`,
      d: `M ${X(x1)} ${y1} C ${X(mx)} ${y1} ${X(mx)} ${y2} ${X(x2)} ${y2}`,
      labelX: X(mx),
      labelY: (y1 + y2) / 2 - 5,
    });
  }

  // ── TWO RELATIONS BETWEEN ONE PAIR ARE TWO LABELS AT ONE POINT ──────────
  //
  // Owner, 2026-09-01: *"the relation text is small and strings override each
  // other so it is not readable"*. MEASURED, in a browser, by comparing bounding
  // boxes rather than by looking: with `constrains`, `refines` and `relates_to`
  // between one pair, three labels rendered at x=1199..1206, y=334 — the same
  // point, one painted over the next. Four overlapping pairs in a five-edge
  // drawing, ALL of them edge-label against edge-label; zero node-against-node
  // and zero edge-against-node, which is what says this is a placement defect in
  // `labelX`/`labelY` and not a density one.
  //
  // The cause is that both coordinates are functions of the two ENDPOINTS and
  // of nothing else, so two edges that share a pair share a midpoint exactly.
  // `RELATION_TYPES` is a closed vocabulary of eight and two items may
  // legitimately be related in more than one way, so this is an ordinary corpus
  // shape rather than a corner.
  //
  // **WIDENING THE CHART DOES NOT FIX IT, and that was measured before this was
  // written**: identical coordinates stay identical at any span, and the same
  // drawing produced the same four overlaps at the authored 900 and at the 1,363
  // it spans now. The room the chart gained is real and is not the answer here.
  //
  // **NOTHING IS HIDDEN AND NOTHING IS DROPPED.** The labels are STACKED — the
  // group is centred on the midpoint it shares, so it straddles its own edge the
  // way one label did — rather than one of them being suppressed. A relation
  // whose name silently disappears is worse than one that overlaps, because the
  // reader cannot tell it is missing (`INV-nothing-is-dropped-silently`), and on
  // a screen whose whole job is showing what relates to what it would be the
  // defect wearing a fix.
  const LABEL_LINE = 13;
  const atPoint = new Map();
  for (const edge of edges) {
    const key = `${Math.round(edge.labelX)}:${Math.round(edge.labelY)}`;
    const bucket = atPoint.get(key);
    if (bucket === undefined) atPoint.set(key, [edge]); else bucket.push(edge);
  }
  for (const bucket of atPoint.values()) {
    if (bucket.length === 1) continue;
    bucket.forEach((edge, i) => {
      edge.labelY += (i - (bucket.length - 1) / 2) * LABEL_LINE;
    });
  }

  const nodes = [];
  for (const p of placed) {
    // `layoutGraph` places the focus whether or not the response listed it, and
    // an unlisted id is exactly the "target not in corpus" the legend names —
    // so it is drawn as MISSING rather than read off an undefined.
    const node = byId.get(p.id) ?? { id: p.id, status: null, missing: true };
    const y = yOf(p);
    const state = egoNodeClass(node, data.focus);
    nodes.push({
      id: p.id,
      cls: state === '' ? 'node' : `node ${state}`,
      x: px(colX(p.x), NW), y: y - NH / 2, width: NW, height: NH,
      labelX: X(colX(p.x) + NW / 2), labelY: y + 3.5,
      label: p.id.length > ID_MAX ? `${p.id.slice(0, ID_MAX - 1)}…` : p.id,
    });
  }
  // A served node the walk from the focus never reaches has no column either.
  // Same rule as an unroutable edge: counted, never quietly absent.
  const undrawnNodes = data.nodes.filter((node) => !at.has(node.id)).length;

  // The cap dropped nodes, and saying so is not optional — `gr.sub` promises
  // "a hard cap of 60 nodes with an explicit '+N more'". The mockup writes the
  // word `more` as an unkeyed ternary and paints it with an inline
  // `fill:'var(--warn)'`; the fill is left to the stylesheet through
  // `text.nid.more` and only the word is transcribed.
  //
  // **The class was right and the rule was missing.** The original reason given
  // here — "a custom property cannot resolve in a presentation attribute" — is
  // not true, and was measured false on the live corpus 2026-08-29: the comb's
  // `<circle fill="var(--gold)">` computes rgb(232,195,104). What is true is
  // stronger: a presentation attribute loses to `svg.chart text{fill:var(
  // --dim)}`, so an attribute here would have drawn grey no matter what it
  // named. `text.nid.more` itself was never declared until 2026-08-29
  // (`styles.css` ~1563), so this word drew as an ordinary id until then.
  let more = null;
  if (data.omitted > 0) {
    const lastColumn = columns - 1;
    const y = spread(perColumn[lastColumn], perColumn[lastColumn] - 1);
    more = {
      cls: 'node more',
      x: px(colX(lastColumn), NW), y: y - NH / 2, width: NW, height: NH,
      labelX: X(colX(lastColumn) + NW / 2), labelY: y + 3.5,
      label: `+${data.omitted} more`,
    };
  }

  return { width, height, columns, captions, edges, nodes, more, undrawnEdges, undrawnNodes };
}

/**
 * The drawing turned into elements, and nothing else decided here.
 *
 * EDGES FIRST, so a node box is never drawn under its own connectors — the
 * mockup's own order, and the reason `egoDrawing` keeps the two lists apart.
 */
function chart(ctx, drawing) {
  const svg = sv('svg', {
    viewBox: `0 0 ${drawing.width} ${drawing.height}`,
    // `width`/`height` ARE THE CHART'S NATURAL SIZE, and they are load-bearing.
    // `svg.chart` says `max-inline-size:100%` and no longer `inline-size:100%`,
    // so the used width is this element's own INTRINSIC width — which is what
    // these two presentation attributes supply. Without them an `<svg>` that
    // carries only a viewBox has a ratio and no intrinsic size and the browser
    // falls back to 300x150. The mockup's `chart()` factory writes the same two
    // (mockup ~4193); `block-size:auto` in the stylesheet overrides the height
    // one on purpose, so the ratio is recomputed on the narrow-card case.
    width: drawing.width,
    height: drawing.height,
    class: 'chart',
    role: 'img',
    // An accessible name is an ATTRIBUTE, so no element could survive here and
    // no key declares this sentence: the mockup writes it as a ternary too.
    'aria-label': 'Relation ego-graph: columns by direction, relation type on every edge',
  });

  // `gr.lfocus` is a declared key and is used for the middle column; the two
  // direction captions are written in the mockup's own script as unkeyed
  // `HEB ? … : …` ternaries, so they are transcribed as its English and raised
  // in this task's report — dropping them would leave the reader unable to tell
  // which column points which way, which is the entire claim this layout makes.
  // An SVG `<text>` cannot hold an element, so `tFlat` is the sink here whatever
  // the renderer does.
  const CAPTION = {
    '-1': 'these point at the focus',
    '1': 'the focus points at these',
  };
  for (const caption of drawing.captions) {
    const text = caption.depth === 0 ? ctx.tFlat('gr.lfocus') : CAPTION[String(caption.depth)];
    if (text === undefined) continue;
    svg.append(svText({ x: caption.x, y: caption.y, 'text-anchor': 'middle' }, text));
  }

  for (const edge of drawing.edges) {
    svg.append(sv('path', { class: edge.cls, d: edge.d }));
    svg.append(svText(
      { x: edge.labelX, y: edge.labelY, 'text-anchor': 'middle', class: 'rel' }, edge.type,
    ));
  }

  for (const node of [...drawing.nodes, ...(drawing.more === null ? [] : [drawing.more])]) {
    const rect = sv('rect', {
      class: node.cls, x: node.x, y: node.y, width: node.width, height: node.height, rx: 4,
    });
    const label = svText(
      {
        x: node.labelX, y: node.labelY, 'text-anchor': 'middle',
        class: node.cls === 'node more' ? 'nid more' : 'nid',
      },
      node.label,
    );

    // ── A NODE OPENS THE ITEM PANE — owner ruling 2026-09-01, *"in relations
    // screen allow to click on items to see their details as in other screens
    // (in the pane)"*.
    //
    // **NOTHING IS REIMPLEMENTED HERE.** `installItemPane` (app.js) is a
    // DOCUMENT-level delegated listener that opens the pane for the nearest
    // `[data-id]` ancestor of whatever was clicked, and that attribute is the
    // whole contract — it is how `linkId()` gets every other screen the pane for
    // free. This screen draws SVG and had simply never opted in: `graph.js` uses
    // `linkId` zero times and set `data-id` nowhere. So the fix is to carry the
    // attribute, not to add a second way of opening a pane.
    //
    // **On a `<g>` and not on the rect**, because a click lands on whichever
    // inner shape is under the pointer — the rect on its body, the `<text>` on
    // its own glyphs — and `closest('[data-id]')` has to resolve from both. One
    // group per node answers both with one attribute.
    //
    // **THE KEYBOARD IS NOT FREE and is the half that is not delegated.**
    // `linkId()` returns a real `<button>`, so on every other screen an id is
    // tabbable and answers Enter. An SVG `<g>` is neither, so it is given
    // `tabindex`, `role="button"` and its own Enter/Space handler — otherwise
    // Relations would be the one screen where items are mouse-only.
    // `preventDefault` on Space because Space scrolls the page by default and a
    // reader who activated a node did not ask to be moved down the document.
    //
    // **A MISSING NODE IS NOT A DOOR.** The server answers `missing: true` for a
    // relation pointing at an item that is not in the corpus, and the legend
    // names that state; opening the pane on it would fetch an id that is not
    // there and draw an empty panel, which reads as the pane being broken rather
    // than as the item being absent. The `+N more` node is not a door either —
    // it is a COUNT and not an item, so there is nothing for a pane to show. Both
    // are drawn exactly as before, with no cursor, no focus stop and no
    // `data-id`, so the affordance is present exactly where it leads somewhere.
    const openable = node.cls !== 'node more' && !node.cls.includes('missing');
    if (!openable) {
      svg.append(rect, label);
      continue;
    }
    const hit = sv('g', {
      class: 'nodehit', 'data-id': node.id, role: 'button', tabindex: '0',
      // The accessible name is the id, which is what this screen draws and what
      // the pane will open. An `aria-label` is an ATTRIBUTE and holds no
      // element, so the full id goes here even where the drawn label is elided.
      'aria-label': node.id,
    });
    hit.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    hit.append(rect, label);
    svg.append(hit);
  }
  return svg;
}

/**
 * **What this picture is of, and how far it reaches.**
 *
 * Five numbers in the endpoint's own vocabulary — `focus`, `radius`, `nodes`,
 * `edges`, `omitted` — and not one translated word, for the same reason a
 * relation type is drawn untranslated: these are `/api/graph`'s parameter and
 * field names, literals rather than prose, so no string key is invented for
 * them and neither table gains one.
 *
 * It exists because three different absences look identical without it. A
 * focus with no relations draws one box; a focus whose neighbours all sit past
 * `radius=1` draws one box; a screen whose edge code was never written draws
 * one box. `edges=0` beside `radius=1` separates the first two from the third
 * on sight, and `omitted` says outright that a graph is a partial view — the
 * one thing the "+N more" node cannot say when the cap dropped nothing.
 *
 * One `span.m` rather than five: `.m` is `direction:ltr; unicode-bidi:isolate`,
 * and an id set loose in an RTL paragraph is the bidi defect this whole screen
 * keeps titles out of its SVG to avoid.
 */
function readout(data, drawing, hidden = 0) {
  const p = el('p', 'small');
  // `edges` is what the SERVER answered and `drawn` is what this layout placed;
  // `filtered` is the third number and it is STATED rather than folded into
  // either. A filtered view restating the total as though it were the whole
  // picture is the dishonest count the owner's ruling forbids — hiding is fine,
  // hiding invisibly is not.
  p.append(mono(
    `focus=${data.focus} · radius=${RADIUS} · nodes=${data.nodes.length}` +
    ` · edges=${data.edges.length} · drawn=${drawing.edges.length}` +
    (hidden > 0 ? ` · filtered=${hidden}` : '') +
    ` · omitted=${data.omitted}`,
  ));
  return p;
}

/**
 * The six legend entries, in the mockup's own order: three NODE states drawn as
 * `<i>` swatches, then three EDGE classes drawn as `<span class="ln">` rules.
 *
 * The swatch is a SIBLING of the translated span, never inside it — a
 * translated element's children are replaced wholesale from the string table,
 * which knows nothing of a swatch someone nested in one.
 */
function legend(ctx) {
  const wrap = el('div', 'legend');
  const entries = [
    ['i', 'focusn', 'gr.lfocus'],
    ['i', 'missn', 'gr.lmiss'],
    ['i', 'supn', 'gr.lsup'],
    ['span', 'ln bearing', 'gr.lbear'],
    ['span', 'ln ref', 'gr.lref'],
    ['span', 'ln dang', 'gr.ldang'],
  ];
  for (const [tag, cls, key] of entries) {
    const entry = el('span');
    const label = el('span');
    label.append(...ctx.t(key));
    entry.append(el(tag, cls), label);
    wrap.append(entry);
  }
  return wrap;
}

function note(ctx) {
  const p = el('p', 'small');
  p.append(...ctx.t('gr.note'));
  return p;
}
