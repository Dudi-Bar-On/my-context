/**
 * `nav.ev` — **Decay**, `<section data-p="decay">` in the design of record.
 * Two graphical views, and this file now draws both of them.
 *
 * ── WHAT CHANGED, AND WHY THE OLD REFUSAL NO LONGER HOLDS ─────────────────
 *
 * This screen shipped as its own frames with no marks in them, on the reading
 * that *"NEITHER can be served by this repository today"*. That was true of
 * **plan 1's endpoints, in plan 1's week**. It is not true of this build, and
 * the two halves stopped being true for two different reasons:
 *
 *   - **The heatstrip's source shipped.** Its refusal cited the design of
 *     record's own sentence — *"Its source is not the ledger, which records
 *     deliveries only: it is `audit_item.role` joined to `audit.at`, both
 *     indexed, with the `since` / `until` filters that already ship"*
 *     (`dec.heatn`) — and plan 1 had no audit endpoint at all. The plan says
 *     in as many words where that left it: the projection read *"is one
 *     endpoint answering three views, and it sits behind plan 3's boundary
 *     while three plan-1 screens draw it"*
 *     (`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` · `which is one endpoint answering three views, and it sits behind plan 3's boundary` · ~190).
 *     **Plan 3 landed.** `GET /api/ask/audit` takes `since`, `until`, `kind`
 *     and `item`, and answers `AuditRecord`s carrying `injected[]` and
 *     `spilled[]` per record
 *     (`ui/ask-model.ts` · `export function apiAskAudit(ws: Workspace, url: URL): JsonResult {` · ~202).
 *     That is `audit.at` with the two filters the note names, and the two
 *     roles the strip is made of. The strip is drawn from THAT, never from
 *     `/api/decay`'s `series` — approximating it from the ledger is refused by
 *     name by the plan (*"must not be approximated from the ledger"*,
 *     ~6400) and would make this card contradict the paragraph printed under
 *     it, which says the ledger is not its source.
 *
 *   - **The comb's axis has an owner again.** `/api/decay` gives a BINARY
 *     split at `window` and a `lastUsed` TIMESTAMP; the comb wants an ORDINAL
 *     IN SESSIONS, and the endpoint says so itself — *"`sessionsAgo: number |
 *     null` per row, computed where the ordering lives"*
 *     (`ui/read-model.ts` · `per row, computed where the ordering lives.** Reported, not invented — §0.3` · ~927).
 *     The ordering lives in `Ledger`, and one endpoint already publishes it:
 *     `/api/sessions`' `sessions` is `sessionSummaries(SESSIONS_LIMIT)`, whose
 *     docstring pins the agreement — *"`sessionSummaries(n).map(s =>
 *     s.sessionId)` equals `recentSessions(n)`"*
 *     (`core/ledger.ts` · `agreement (`sessionSummaries(n).map(s => s.sessionId)` equals` · ~502).
 *     So the ordinal is READ, not re-derived: `combRows` indexes the server's
 *     own order and joins `series`' `(session, item)` markers onto it. That is
 *     §0.3 row 7's *"presentation over two endpoints this plan already
 *     ships"*, and it is specifically NOT the thing the endpoint objected to —
 *     nothing here re-spells `MAX(injected_at) DESC, session_id DESC`.
 *
 *     **Why that matters beyond the copied-rule rule.** A tooth's POSITION and
 *     a tooth's COLOUR are the same fact read twice: `report.cold` was
 *     computed against `recentSessions(window)`, and a browser-side sort would
 *     be a second spelling of that order. The day the two disagreed, a warm
 *     item would sit past the window line with a warm fill and nothing would
 *     say which half was wrong. Reading the order from the endpoint that owns
 *     it makes the disagreement impossible instead of unlikely.
 *
 * ── THE ONE THING THE ORDER CANNOT REACH, AND WHY IT IS DISCLOSED ─────────
 *
 * `SESSIONS_LIMIT` is twenty (`ui/read-model.ts` · `export const SESSIONS_LIMIT = 20;` · ~483)
 * and the comb's axis runs to sixty. An item whose newest ledger session is
 * older than the twentieth-most-recent has an ordinal this response cannot
 * name — it is *"at least twenty"* and no more than that. Such a tooth is
 * **not placed at a position it might not hold**, and it is **not dropped in
 * silence** either: `combRows` returns the count and the chart draws it as a
 * `+N` line under the axis, which is the idiom the design of record already
 * uses for a cap it could not draw past (`+N more`, the ego graph). On a
 * ledger with twenty sessions or fewer the count is zero and the line is
 * absent, which is this repository's own case today.
 *
 * ── THE STRINGS THAT ARE NOT STRINGS, AND WHERE A LITERAL IS ALLOWED ──────
 *
 * The mockup builds every word inside these two graphics in script, behind a
 * `HEB ? … : …` ternary, so **none of them keys in either table** — the tick
 * labels, `never`, `sessions ago`, the badpin annotation, the heatstrip's two
 * axis ends, and the accessible name of the chart. `screens/graph.js` met the
 * same wall on the same kind of surface and set the boundary this file keeps:
 * an unkeyed English literal is transcribed **only where no element can live**
 * — inside an SVG `<text>`, or in an attribute — because *"an SVG `<text>`
 * cannot hold an element, so `tFlat` is the sink here whatever the renderer
 * does"* (`screens/graph.js` · `'aria-label': 'Relation ego-graph: columns by direction, relation type on every edge',` · ~240).
 * Everything that IS an element goes through `ctx.t()` and nothing else.
 *
 * **`#deccaveat` therefore stays undrawn**, and that is the same boundary
 * rather than an exception to it. It is a `<p class="small">` — a paragraph in
 * the document, where an element can live and `ctx.t()` belongs — whose three
 * sentences the mockup writes as a ternary and no table declares. Drawing it
 * as an English literal would put untranslated prose in the reading flow of a
 * bilingual screen, which is a different act from naming an axis inside a
 * picture. Raised as an open question, not resolved here: it is the sentence
 * that tells a reader "cold" means twenty SESSIONS rather than twenty days,
 * and the window and the ledger's own session count are both on the chart's
 * data already, waiting for a key with two slots.
 *
 * ── THE STYLESHEET THIS SCREEN DOES NOT HAVE ──────────────────────────────
 *
 * `styles.css` carries `.heat`, `.hstrip`, `.hname`, `.heataxis` and the whole
 * `.legend` family, so the heatstrip and the legend need nothing from this
 * file. It does **not** carry the mockup's SVG chart primitives
 * (`svg.chart{…}`, `svg.chart text{…}`, `svg.chart text.mono{…}`,
 * `svg.chart .axis{…}`, `svg.chart .never{…}` — mockup ~803-810), and an
 * unstyled `<svg>` is a 300x150 box of black text on a near-black plate. The
 * classes are still written, so the day the shell carries those rules they win
 * on cascade order; until then each mark also NAMES ITS OWN TOKEN, and the
 * chart's typography is set once on the root through the CSSOM. Setting it
 * through `el.style.setProperty` rather than a `style` attribute is not a
 * preference: the server sends `style-src 'self'` with no `'unsafe-inline'`,
 * which blocks the attribute and permits the CSSOM (see `screens/parts.js`).
 *
 * **Nothing is invented and nothing is guessed.** Every number in the geometry
 * below is the mockup's own (`renderComb`, ~3779; `renderHeat`, ~3837), every
 * colour is a token the design of record already spends here, and every
 * classification — cold, warm, unrestricted, never, pinned-and-cold — is read
 * off `/api/decay`'s report rather than recomputed from its parts.
 */
import { el, errorNote, screenHead } from '/screens/parts.js';

const NS = 'http://www.w3.org/2000/svg';

/* ── The recency comb's geometry, from `renderComb` (mockup ~3779) ───────── */

/** The mockup's chart box, its label gutter, its never-bucket gutter, its pads. */
export const W = 900;
const PL = 214;
const PR = 92;
const PT = 18;
const PB = 30;
/** The log axis's far end, in sessions. `dx(MAX_S)` is the axis's last pixel. */
export const MAX_S = 60;
/**
 * The mockup's fixed 210 is kept as a FLOOR rather than as the value, exactly
 * as `screens/graph.js` keeps its own: the mockup draws ten sample rows and a
 * real corpus draws every eligible item. `ROW` is that same 210 divided by
 * those ten rows, so a ten-row corpus renders the design of record's own
 * chart, pixel for pixel, and a fifty-row corpus grows instead of crushing
 * fifty labels into the space for ten. Capping the rows is not the
 * alternative: `dec.comb` is *"one tooth per item, never bucketed"*.
 */
const H_MIN = 210;
const ROW = (H_MIN - PT - PB) / 10;
/**
 * Where an id label stops. **Twenty-eight, and the mockup's own is 32.**
 *
 * The label is anchored at `PL - 8` = 206 and grows leftward; the `∀`
 * unrestricted overlay sits at x=4. At `svg.chart text.mono`'s 11px in a
 * monospace face (advance ≈ 0.6em ≈ 6.6 user units) a 32-character label is
 * ≈211 units wide and starts at ≈-5 — it runs THROUGH the overlay and off the
 * gutter. (`--fs-chart-mono` is 9.5px since `plan:walk seq:62` restored the
 * pre-repaint chart ramp, so the advance is ≈5.7 and every figure here is now
 * CONSERVATIVE — the label is narrower than the arithmetic that chose 28
 * assumed, and 28 clears the overlay by more than it used to, never less.) The mockup never sees this because its ten sample ids are 21-35
 * characters and only three of them are unrestricted; on this repository's own
 * corpus fifty of fifty-two rows are, so the collision is on every row.
 * Photographed before the change. Twenty-eight lands at ≈21 and clears the
 * overlay with room to spare. Per-chart truncation is already this codebase's
 * practice rather than a new liberty — `screens/graph.js` sets its own 28
 * against a 210-wide node box.
 */
const ID_MAX = 28;
/**
 * Rough width of `BADPIN` at `--fs-00` (12px, ≈6.5 units per character in the
 * sans face), used only to decide WHICH SIDE of its dot the annotation goes
 * on. See `badpinOutward`.
 */
const BADPIN_W = 200;

/**
 * Which side of its dot `dec.badpin`'s annotation hangs on, in UNMIRRORED
 * coordinates: outward (the mockup's own nine units to the reading end) when
 * the viewBox still has room for the sentence there, inward when it does not.
 *
 * The mockup never has to choose, because its one pinned-and-cold sample sits
 * at 34 sessions, mid-axis. **A pinned item that is cold because it was NEVER
 * injected sits in the terminal box**, forty-four units from the edge, and the
 * sentence runs off the chart — photographed doing exactly that. Inward is
 * empty space on this axis by construction: nothing is ever plotted between
 * the last tick and the never box.
 */
export function badpinOutward(cx) {
  return W - (cx + 9) >= BADPIN_W;
}
/** Left edge of the terminal "never" box, and its width. The mockup's `nx`/46. */
const NEVER_X = W - PR + 16;
const NEVER_W = 46;

/* ── The 90-day heatstrip, from `renderHeat` (mockup ~3837) ──────────────── */

/** One cell per day, ninety of them — the card's own title says so. */
export const HEAT_DAYS = 90;
/** The mockup draws five items. Ranked, never sliced off the top of an id sort. */
export const HEAT_ROWS = 5;
/**
 * `limit` on `/api/ask/audit`, at that endpoint's own ceiling. It keeps the
 * LAST n records after every other filter, so a corpus with more than this
 * many injection records inside ninety days would under-fill its OLDEST cells
 * — never its newest. Nothing in the response says whether it truncated, and
 * saying so on screen would need a key no table declares; raised in this
 * task's report with `#deccaveat` rather than invented here.
 */
export const AUDIT_LIMIT = 2000;
const DAY_MS = 86_400_000;

/* ── The unkeyed words. Every one is a `HEB ? … : …` ternary in the mockup's
      own script and is transcribed here for the reason the header gives: it
      goes inside an SVG `<text>` or an attribute, where no element can live.
      Raised in this task's report. ─────────────────────────────────────── */
const AXIS_ZERO = 'this session';
const AXIS_UNIT = 'sessions ago';
const NEVER = 'never';
const BADPIN = 'pinned, yet cold — it spilled';
const COMB_LABEL =
  'Recency comb: sessions since last injection, one row per item, with a separate never bucket';
const HEAT_START = '90 days ago';
const HEAT_END = 'today';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'dec.h', 'dec.v', 'dec.sub');

  // Card 1 — the recency comb, its legend, and the disclosure about what
  // "cold" does and does not mean. The order is the mockup's own: heading,
  // plate, legend, then the disclosure — with `#deccaveat` between the last
  // two in the mockup and deliberately undrawn here (see the header).
  // `<details class="help"><summary>…` is the mockup's own disclosure widget,
  // used on four screens.
  const comb = el('div', 'card pane');
  const combHead = el('h3');
  combHead.append(...ctx.t('dec.comb'));
  const combPlate = el('div', 'plate');
  combPlate.id = 'comb';
  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.whyCold'));
  const helpBox = el('div', 'helpbox');
  helpBox.append(...ctx.t('dec.help'));
  help.append(summary, helpBox);
  comb.append(combHead, combPlate, legend(ctx), help);

  // Card 2 — the 90-day heatstrip and the note the mockup draws under it.
  // `dec.heatn` names this card's source in its own last sentence, and the
  // strip below is read from exactly that source and no other.
  const heat = el('div', 'card pane');
  const heatHead = el('h3');
  heatHead.append(...ctx.t('dec.heat'));
  const heatPlate = el('div', 'heat plate');
  heatPlate.id = 'heat';
  const heatNote = el('p', 'small');
  heatNote.append(...ctx.t('dec.heatn'));
  // The mockup's `style="margin-block-start:10px"` — through the CSSOM,
  // because the shipped `style-src 'self'` blocks the attribute form.
  heatNote.style.setProperty('margin-block-start', '10px');
  heat.append(heatHead, heatPlate, heatNote);

  root.append(comb, heat);

  /**
   * **CHECKED against `TASK-the-preview-can-hold-two-renders-at-once-and-
   * session` on 2026-08-29, and safe — for a structural reason, not by luck.**
   *
   * That defect is a container CLEARED before a request and APPENDED to after
   * it, so two overlapping calls each clear an empty container and each append
   * a whole render. This screen cannot reach that state, and the line above is
   * why: `combPlate` and `heatPlate` are created fresh by THIS call and
   * attached to `root` BEFORE either read starts. A second `render()` opens
   * with `root.replaceChildren()`, which detaches them — so a first render
   * whose fetch lands late appends its chart into a node that is no longer in
   * the document. One render is on screen, and it is the newer one.
   *
   * It also subscribes to nothing: no `ctx.onSessionChange` here and no stream,
   * so there is no listener to accumulate per render either. The two reads
   * below draw INTO the plates and never re-append them, which is the property
   * this note is actually about — moving either `el()` call after an `await`
   * would reintroduce the defect, and that is what to look at if this screen
   * ever grows a third card.
   *
   * Two independent reads of two different sources, in flight together: the
   * comb cannot tell the strip anything and the strip cannot tell the comb
   * anything, so neither waits on the other's refusal.
   */
  await Promise.all([drawComb(ctx, combPlate), drawHeat(ctx, heatPlate)]);
}

/**
 * The five legend entries, in the mockup's own order: four `<i>` swatches for
 * the four mark states, then the `∀` overlay drawn as `<span class="ln">`.
 *
 * The swatch is a SIBLING of the translated span, never inside it — a
 * translated element's children are replaced wholesale from the string table,
 * which knows nothing of a swatch someone nested in one. `∀` is the mockup's
 * own glyph and is not a translated string in either table.
 */
function legend(ctx) {
  const wrap = el('div', 'legend');
  const entries = [
    ['i', 'warm', null, 'dec.warm'],
    ['i', 'cold', null, 'dec.cold'],
    ['i', 'never', null, 'dec.never'],
    ['i', 'badpin', null, 'dec.badpin'],
    ['span', 'ln', '∀', 'dec.unres'],
  ];
  for (const [tag, cls, glyph, key] of entries) {
    const entry = el('span');
    const label = el('span');
    label.append(...ctx.t(key));
    entry.append(el(tag, cls, glyph), label);
    wrap.append(entry);
  }
  return wrap;
}

/* -------------------------------------------------------------------------- *
 * 1 · The recency comb.
 * -------------------------------------------------------------------------- */

async function drawComb(ctx, host) {
  let decay;
  let sessions;
  try {
    [decay, sessions] = await Promise.all([ctx.api('/api/decay'), ctx.api('/api/sessions')]);
  } catch (error) {
    host.append(errorNote(error.message));
    return;
  }
  // `report: null` is the NOT-PROJECTED state, and the endpoint is explicit
  // about why it is null rather than a report of zeroes: feeding empty
  // readings to `computeDecay` returns every eligible item as cold, and this
  // chart would then ring `dec.badpin`'s *"a defect signal, not decay"* around
  // every pinned item in a corpus that has simply never run. No measurement
  // happened, so no marks are drawn — the card keeps its frame and its help.
  if (decay.report === null) return;

  const order = sessions.sessions.map((s) => s.sessionId);
  const { rows, unplaceable } = combRows(decay.report, decay.series, order);
  if (rows.length === 0) return;
  host.append(drawCombChart(decay.report, rows, unplaceable, order.length));
}

/**
 * One tooth per item: its ordinal in sessions, and the four states the legend
 * names — all four read off the report, none of them recomputed here.
 *
 * `sessionsAgo` is `null` for *never injected* and `undefined` for *injected,
 * but before the sessions this response can order*. Two different facts, and
 * the second is why this returns a count beside the rows (see the header).
 *
 * `cold` is membership of `report.cold`, NOT `sessionsAgo >= window`: the
 * server computed that classification against `recentSessions(window)` and
 * this file must not hold a second opinion about it. `never` is
 * `useCount === 0`, which the endpoint names as the short route — *"`DecayRow
 * .useCount === 0` IS not-projected, and `DecayRow.always` is the pinned half
 * of `dec.badpin`"* — rather than the long one through `/api/items`.
 *
 * Rows are ordered by ordinal, newest first, with never last and ties broken
 * on the id, so the same corpus draws the same chart twice.
 */
export function combRows(report, series, order) {
  const index = new Map(order.map((sessionId, i) => [sessionId, i]));
  const unrestricted = new Set(report.unrestricted.map((row) => row.id));
  // The item's ordinal is the SMALLEST index it appears at — the most recent
  // session that delivered it. A `series` marker in a session outside the
  // served order contributes nothing to the minimum and cannot be placed.
  const newest = new Map();
  for (const event of series) {
    const at = index.get(event.sessionId);
    if (at === undefined) continue;
    const best = newest.get(event.itemId);
    if (best === undefined || at < best) newest.set(event.itemId, at);
  }

  const rows = [];
  let unplaceable = 0;
  for (const [cold, list] of [[true, report.cold], [false, report.warm]]) {
    for (const row of list) {
      const never = row.useCount === 0;
      const sessionsAgo = never ? null : newest.get(row.id);
      if (!never && sessionsAgo === undefined) {
        unplaceable += 1;
        continue;
      }
      rows.push({
        id: row.id,
        sessionsAgo,
        cold,
        always: row.always,
        unrestricted: unrestricted.has(row.id),
        never,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.never !== b.never) return a.never ? 1 : -1;
    if (!a.never && a.sessionsAgo !== b.sessionsAgo) return a.sessionsAgo - b.sessionsAgo;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { rows, unplaceable };
}

/**
 * The axis ticks, `[sessions, label]`, transcribed from the mockup's own list
 * (`mockup ~3785`). The window's tick is drawn in `--warn` and relabelled by
 * the chart; when the caller asked for a window that is not one of the five,
 * a sixth tick is added for it, because the boundary the whole screen is about
 * must be ON the axis whatever `?window=N` said. A window past the axis's own
 * end cannot be drawn and is left off rather than clamped onto a position it
 * does not hold.
 */
export function combTicks(window) {
  const ticks = [[0, AXIS_ZERO], [1, '1'], [5, '5'], [20, '20'], [50, '50']];
  if (!ticks.some(([s]) => s === window) && window <= MAX_S) ticks.push([window, String(window)]);
  return ticks.filter(([s]) => s <= MAX_S).sort((a, b) => a[0] - b[0]);
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

function drawCombChart(report, rows, unplaceable, served) {
  // Mirroring is by PROJECTION, not by transform: `scale(-1,1)` would reverse
  // the digits too. The page direction is `<html dir>`, which `applyLanguage`
  // sets from the string table itself — a layout fact, not a translated one.
  const rtl = document.documentElement.dir === 'rtl';
  const X = (u) => (rtl ? W - u : u);
  const anchor = (a) => (rtl ? (a === 'start' ? 'end' : a === 'end' ? 'start' : a) : a);

  const height = Math.max(H_MIN, PT + PB + rows.length * ROW);
  const dx = (s) => PL + (Math.log10(1 + s) / Math.log10(1 + MAX_S)) * (W - PL - PR);
  const kids = [];

  // The baseline, then one dashed vertical per tick. `.axis` is the mockup's
  // class and `--rule` is the token that class carries; both are written,
  // because the shell has the token and not (yet) the rule.
  kids.push(sv('line', {
    class: 'axis', x1: X(PL), y1: height - PB, x2: X(W - PR), y2: height - PB,
    stroke: 'var(--rule)', 'stroke-width': 1,
  }));
  for (const [sessions, label] of combTicks(report.window)) {
    const isWindow = sessions === report.window;
    kids.push(sv('line', {
      class: 'axis', x1: X(dx(sessions)), y1: PT - 4, x2: X(dx(sessions)), y2: height - PB,
      'stroke-dasharray': '2 4', stroke: isWindow ? 'var(--warn)' : 'var(--rule)',
    }));
    kids.push(svText(
      {
        x: X(dx(sessions)), y: height - PB + 13, 'text-anchor': 'middle',
        fill: isWindow ? 'var(--warn)' : 'var(--dim)',
      },
      isWindow ? `window ${report.window}` : label,
    ));
  }
  kids.push(svText(
    { x: X(dx(MAX_S)), y: height - PB + 24, 'text-anchor': 'middle', fill: 'var(--dim)' },
    AXIS_UNIT,
  ));

  // The terminal box. *"never injected — a kind, not a big number"*
  // (`dec.never`): it is a different KIND of fact from an ordinal, so it gets
  // a box of its own off the end of the axis instead of a position on it.
  kids.push(sv('rect', {
    class: 'never', x: X(NEVER_X) - (rtl ? NEVER_W : 0), y: PT - 6,
    width: NEVER_W, height: height - PT - PB + 6, rx: 4,
    fill: 'var(--critbg)', stroke: 'var(--crit)', 'stroke-dasharray': '2 2',
  }));
  kids.push(svText(
    {
      x: X(NEVER_X + NEVER_W / 2), y: height - PB + 13, 'text-anchor': 'middle',
      fill: 'var(--crit)',
    },
    NEVER,
  ));

  const rowH = (height - PT - PB) / rows.length;
  rows.forEach((row, i) => {
    const y = PT + rowH * i + rowH / 2;
    // Nodes carry IDS, not titles — the same rule the ego graph states, and
    // for the same reason: it keeps bidi-sensitive text out of every SVG in
    // the product.
    const label = svText(
      { x: X(PL - 8), y: y + 3, 'text-anchor': anchor('end'), class: 'mono', fill: 'var(--ink)' },
      row.id.length > ID_MAX ? `${row.id.slice(0, ID_MAX - 1)}…` : row.id,
    );
    // `svg.chart text.mono{font-family:var(--mono);font-size:var(--fs-chart-mono)}`
    // (mockup ~816), restated through the CSSOM because this element carries
    // its own inline style for the rest of the chart too (see the root block
    // below). It names the TOKEN, never the literal: `plan:walk seq:62` found
    // the chart-specific sizes inflated twice over, and an inline literal here
    // would have survived the fix in the stylesheet and quietly kept one
    // chart's ids at the old size.
    label.style.setProperty('font-family', 'var(--mono)');
    label.style.setProperty('font-size', 'var(--fs-chart-mono)');
    kids.push(label);
    // `∀` is an OVERLAY, never a third bucket: *"a breadth view over cold ∪
    // warm"* (`dec.unres`), and `DecayReport.unrestricted`'s own docstring
    // says a consumer that sums the three double-counts.
    if (row.unrestricted) {
      kids.push(svText(
        { x: X(4), y: y + 3, 'text-anchor': anchor('start'), fill: 'var(--dim)' }, '∀',
      ));
    }
    const bad = row.always && row.cold;
    const cx = row.never ? NEVER_X + NEVER_W / 2 : dx(row.sessionsAgo);
    // Warm is a solid disc, cold is a ring — `--gold` and `--warn` are close
    // enough in light mode that colour alone would not carry the distinction.
    kids.push(sv('circle', {
      cx: X(cx), cy: y, r: bad ? 5.5 : 4.2,
      fill: row.never ? 'var(--critbg)' : row.cold ? 'var(--panel)' : 'var(--gold)',
      stroke: row.never ? 'var(--crit)' : bad ? 'var(--crit)' : row.cold ? 'var(--warn)' : 'none',
      'stroke-width': bad ? 2 : 1.6,
    }));
    if (bad) {
      // The side is chosen in UNMIRRORED coordinates and then projected, so
      // RTL flips the whole decision with everything else on this chart.
      const outward = badpinOutward(cx);
      kids.push(svText(
        {
          x: X(outward ? cx + 9 : cx - 9), y: y + 3,
          'text-anchor': anchor(outward ? 'start' : 'end'), fill: 'var(--crit)',
        },
        BADPIN,
      ));
    }
  });

  // The teeth this response cannot place, said out loud. The `+N` form is the
  // design of record's own idiom for a count it could not draw past.
  if (unplaceable > 0) {
    kids.push(svText(
      {
        x: X(PL), y: height - PB + 24, 'text-anchor': anchor('start'), fill: 'var(--warn)',
      },
      `+${unplaceable} older than the ${served} sessions served`,
    ));
  }

  const svg = sv('svg', {
    viewBox: `0 0 ${W} ${height}`,
    // `width`/`height` ARE THE CHART'S NATURAL SIZE, and they are load-bearing.
    // `svg.chart` says `max-inline-size:100%` and no longer `inline-size:100%`,
    // so the used width is this element's own INTRINSIC width — which is what
    // these two presentation attributes supply. Without them an `<svg>` that
    // carries only a viewBox has a ratio and no intrinsic size and the browser
    // falls back to 300x150. The mockup's `chart()` factory writes the same two
    // (mockup ~4193); `block-size:auto` in the stylesheet overrides the height
    // one on purpose, so the ratio is recomputed on the narrow-card case.
    width: W,
    height,
    class: 'chart',
    role: 'img',
    // An accessible name is an ATTRIBUTE and cannot hold an element. The
    // mockup writes this sentence as a ternary and no key declares it.
    'aria-label': COMB_LABEL,
  });
  // `svg.chart{…}` and `svg.chart text{…}` (mockup ~803-804) restated on the
  // element, through the CSSOM, because the shell's stylesheet has neither and
  // an unstyled chart is black text on a near-black plate. `fill` inherits, so
  // every mark that does not name its own colour gets the axis grey.
  // **`direction: ltr` on the chart root, and it is the load-bearing line in
  // this block.** Measured in Hebrew on 2026-08-23, at 1568x779: without it
  // the `<svg>` inherits `direction: rtl` from `<html dir>`, and in an RTL
  // inline direction SVG resolves `text-anchor:start` to the RIGHT edge — so
  // `anchor()`'s start↔end flip, which the mockup's own `ANC()` performs,
  // becomes a SECOND flip on top of the one `direction` already did. The id
  // gutter came back empty and every label sat 180 units inside the plot,
  // over the teeth. Two self-consistent designs exist — mirror the anchors OR
  // let `direction` mirror them — and this file takes the mockup's, which
  // means the chart must declare the direction that flip assumes.
  //
  // It is also the treatment this product already gives a Latin run in an RTL
  // page: `.m` is `direction:ltr; unicode-bidi:isolate` for exactly the ids
  // and tokens this chart is made of, and `gr.note` makes keeping
  // bidi-sensitive text out of an SVG a rule rather than a preference.
  svg.style.setProperty('direction', 'ltr');
  svg.style.setProperty('display', 'block');
  // `max-inline-size`, NOT `inline-size` — the whole point of the 2026-08-29
  // scale bound, and the one line of this restatement that had to move with it.
  // This block re-declares `svg.chart{…}` on the element because the shell had
  // no such rule when this file landed; the shell has it now, and an inline
  // `inline-size:100%` here BEATS it, so leaving it would have pinned this one
  // chart at the stretched 1.267x while the other two rendered 1:1. Measured
  // doing exactly that before this line changed.
  svg.style.setProperty('max-inline-size', '100%');
  svg.style.setProperty('block-size', 'auto');
  svg.style.setProperty('overflow', 'visible');
  svg.style.setProperty('font-family', 'var(--sans)');
  svg.style.setProperty('font-size', 'var(--fs-chart)');
  svg.style.setProperty('fill', 'var(--dim)');
  for (const kid of kids) svg.append(kid);
  return svg;
}

/* -------------------------------------------------------------------------- *
 * 2 · The 90-day heatstrip.
 * -------------------------------------------------------------------------- */

async function drawHeat(ctx, host) {
  const now = new Date();
  let audit;
  try {
    audit = await ctx.api(
      `/api/ask/audit?kind=injection&since=${heatSince(now)}&limit=${AUDIT_LIMIT}`,
    );
  } catch (error) {
    host.append(errorNote(error.message));
    return;
  }
  // `absent` is the projection that was never built — a state, not ninety
  // zeroes. Ninety empty cells would be this card asserting ninety quiet days
  // over a log it has not read, and *"an empty cell is a day nothing
  // happened"* is a claim (`dec.heatn`). Everything worse than `absent`
  // refused above, in the endpoint's own words.
  if (audit.projectionState !== 'fresh') return;

  const rows = heatRows(audit.records, now);
  if (rows.length === 0) return;
  for (const row of rows) {
    const name = el('div', 'hname', row.id);
    // The mockup's own `nm.title = id`: the cell is ellipsised by `.hname`, so
    // the full id has to be reachable. An id is not a translated string.
    name.title = row.id;
    const strip = el('div', 'hstrip');
    for (const cell of row.cells) strip.append(el('i', cell));
    host.append(name, strip);
  }
  // The mockup's own empty first-column cell, so the axis lands under the
  // strips rather than under the names (`mockup ~3860`).
  const axis = el('div', 'heataxis');
  axis.append(el('span', null, HEAT_START), el('span', null, HEAT_END));
  host.append(el('div'), axis);
}

/**
 * The `since` the strip asks for: UTC midnight of the strip's FIRST cell.
 *
 * A date rather than a span — `parseWhen` reads `2026-08-16` as UTC midnight
 * and `89d` as this clock time 89 days back
 * (`core/audit.ts` · `const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())` · ~653).
 * The cells are UTC days, so the bound must be one too, or the oldest cell
 * would be missing whatever happened before this morning's clock time.
 */
export function heatSince(now) {
  return new Date((utcDay(now) - (HEAT_DAYS - 1)) * DAY_MS).toISOString().slice(0, 10);
}

/** Whole UTC days since the epoch, from a `Date` or from an audit `at`. */
function utcDay(when) {
  const ms = when instanceof Date ? when.getTime() : Date.parse(when);
  return Number.isNaN(ms) ? Number.NaN : Math.floor(ms / DAY_MS);
}

/**
 * One row per item, ninety cells per row: `null` where nothing happened,
 * `h1`/`h2`/`h3` by how much was delivered that day, `sp` where the item was
 * spilled.
 *
 * **Spill wins a day it shares with a delivery**, and that is the whole point
 * of the view rather than a tie-break: *"This is the one view that separates
 * 'quiet' from 'selected and thrown away repeatedly'"* (`dec.heatn`). A day an
 * item was selected, delivered once and thrown away three times is not a quiet
 * day drawn in gold.
 *
 * **The rows are the busiest items, ranked, and the rank counts BOTH roles.**
 * Ranking on deliveries alone would drop exactly the item that spills more
 * than it lands, which is the row a reader opened this card for. Ties break on
 * the id so the same log draws the same five twice.
 *
 * **One intensity scale for the whole card, not one per row.** Per-row scales
 * make every row's own busiest day the same gold, which reads as five equally
 * busy items; the card's title is *"90-day delivery, per item"* and the
 * comparison between items is the thing it is for.
 */
export function heatRows(records, now, days = HEAT_DAYS, limit = HEAT_ROWS) {
  const last = utcDay(now);
  const first = last - (days - 1);
  const items = new Map();
  const bucket = (id) => {
    let found = items.get(id);
    if (found === undefined) {
      found = { id, delivered: new Map(), spilled: new Map(), total: 0 };
      items.set(id, found);
    }
    return found;
  };
  for (const record of records) {
    const day = utcDay(record.at);
    if (!Number.isFinite(day) || day < first || day > last) continue;
    const cell = day - first;
    for (const [role, refs] of [['delivered', record.injected], ['spilled', record.spilled]]) {
      for (const ref of refs ?? []) {
        const found = bucket(ref.id);
        found[role].set(cell, (found[role].get(cell) ?? 0) + 1);
        found.total += 1;
      }
    }
  }

  const ranked = [...items.values()]
    .sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit);
  let max = 0;
  for (const item of ranked) for (const count of item.delivered.values()) max = Math.max(max, count);

  return ranked.map((item) => ({
    id: item.id,
    cells: Array.from({ length: days }, (_unused, cell) => {
      if ((item.spilled.get(cell) ?? 0) > 0) return 'sp';
      const level = heatLevel(item.delivered.get(cell) ?? 0, max);
      return level === 0 ? null : `h${level}`;
    }),
  }));
}

/**
 * Which of `.hstrip i.h1` / `.h2` / `.h3` a day's delivery count wears — three
 * bands over the card's own busiest day, so the darkest cell in the card is
 * always `h3` and a day with one delivery is never mistaken for a day with
 * forty. A count of zero is no class at all: *"an empty cell is a day nothing
 * happened"*, and `.hstrip i` already draws that.
 */
export function heatLevel(count, max) {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(3, Math.max(1, Math.ceil((count / max) * 3)));
}
