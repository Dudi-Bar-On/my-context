/**
 * `nav.ev` — **Audit stream**, `<section data-p="watch">` in the design of
 * record. One card, in the mockup's own order: the activity pulse, its note,
 * the kind filters, the record table, the live region, the token-void note.
 *
 * **The mockup's DESIGN, never its BEHAVIOUR.** The design of record writes
 * this screen as static HTML carrying `data-t` attributes and scans the
 * document for them; this app has no such scanner and `index.html` carries no
 * `data-t` at all, so every string here goes through `ctx.t()` / `ctx.tFlat()`
 * and the א/A toggle reaches all of it. Two consequences are worth naming
 * rather than leaving to be discovered:
 *
 *   - **`#wrowparts` is not built.** The mockup declares the four row
 *     sentences once inside a hidden div and CLONES them per row, dropping the
 *     key from the copy, because its scanner would otherwise translate one
 *     declaration many times. `ctx.t()` returns FRESH NODES on every call, so
 *     the declaration is the call: `watch.delivered`, `watch.spilled`,
 *     `watch.tokens` and `watch.tokensNotRecorded` are asked for per row and
 *     arrive already translated. The mockup's hidden div is scaffolding for a
 *     problem this app does not have.
 *   - **`#alive` holds ONE state at a time.** The mockup renders all four of
 *     its sentences and hides three, cycling them on click — a demo
 *     affordance for a page with no stream behind it. Here the state is the
 *     stream's: `watch.shown` while records are listed, `watch.streamWaiting`
 *     once connected with nothing yet, `watch.emptyLog` when the log itself was
 *     read to its beginning and holds nothing, `watch.resync` after a rotation,
 *     and `watch.streamFault` when the stream refuses to continue. **The
 *     difference between the second and the third is the owner's whole report**
 *     — "nothing since you opened this" and "this corpus has no audit log" were
 *     one blank screen, and `sayShown` below is where they became two
 *     sentences. The region is `aria-live="polite"` and carries no `title`,
 *     exactly as the mockup says: a tooltip on a live region is read out with
 *     the live text.
 *
 * ── WHERE EACH PART COMES FROM ────────────────────────────────────────────
 *
 *   - **The pulse** is `GET /api/watch/volume?minutes=20&bucket=10` — 120
 *     ten-second columns, which is what the mockup's own note asks for.
 *   - **The kind filters** are DERIVED and never written down; see
 *     `learnKinds` below for the two sources and for what is missing.
 *   - **The backlog** is `GET /api/ask/audit` — the query surface, which reads
 *     the projection. It is not one of the five `/api/watch/*` routes, and it
 *     is the one the view-model's own resync obligation names: after a
 *     rotation the tail resets to the current EOFs, so what landed in the gap
 *     is NOT coming down the stream and only a projection read can fill it
 *     (`lib/viewmodel.js` · `The only way to fill that hole is to refetch the backlog through the query` · ~131).
 *   - **The live feed** is `GET /api/watch/stream` through `ctx.stream()`,
 *     added to the shell by this task. It reads the JSONL directly and so is
 *     the ONLY part of this screen that still answers when the projection is
 *     stale — which, since `plan:walk seq:52`, is why it also carries a
 *     BOUNDED REPLAY of what was already in the log. Both other sources on this
 *     screen read the projection, so a corpus whose projection was never built
 *     or has fallen behind its log had nothing left to draw the feed from, and
 *     an empty live tail was read as "this corpus has no records". See
 *     `STREAM_BACKLOG` below, and `applyStreamBacklog`.
 *   - **The budget** the token bar is drawn against is the sum of the resolved
 *     tier budgets from `GET /api/config`; see `watch.voidn`'s note below.
 *
 * **`/api/watch/spills`, `/api/watch/ratio` and `/api/watch/context` are NOT
 * read here, and that is the mockup's arrangement rather than an omission.**
 * `<section data-p="watch">` draws no spills pane, no ratio bar and no context
 * figure: the ratio is the simulator's (`sim.ratio`), the context figure is the
 * status strip's (§4b), and the spill answer is carried on this screen by the
 * injection row's own `watch.spilled` count. The plan says the same in its own
 * words — *"No spills pane appears on this screen"*.
 *
 * ── THE PULSE'S COLOURS — the ruling this task was left to make ────────────
 *
 * `/api/watch/volume` ships the buckets and names no colour, deliberately
 * (`ui/watch-model.ts` · `What colour any of this is drawn in is NOT decided here and must not be.` · ~72),
 * and the task item says the ruling falls to *"whoever builds `#pulse`"*
 * because four meaning hues do not divide evenly into six record kinds.
 *
 * The ruling taken here: **use the hues the design of record has already
 * assigned to these kinds, and invent none.** The mockup's own audit row gives
 * `mutation` the critical hue and `access` the warning hue and everything else
 * the ok hue; its own regime rule gives `focus` gold. That is four hues over
 * seven kinds, and `injection`, `hook`, `progress` and `execution` therefore
 * share one — a real loss, and it widened on 2026-08-27 rather than being
 * papered over with a colour nobody ruled. A column whose total exceeds what its own breakdown accounts for —
 * which is how a kind this build does not know arrives — keeps the unaccounted
 * remainder at full height in `--faint`, so the pulse stays honest about how
 * much happened while saying nothing it cannot account for.
 *
 * ── NO `innerHTML`, NO `style` ATTRIBUTE ───────────────────────────────────
 *
 * Both for the reasons `screens/parts.js` sets down: the page renders
 * agent-authored record notes, and the server sends `style-src 'self'` with no
 * `'unsafe-inline'`. Every declaration the mockup writes as an attribute is set
 * through CSSOM here, and only with logical properties.
 */
import { dedupeKey, describeRecord, describeStreamEvent } from '/lib/viewmodel.js';
import { BOUND_CAP_LIST, el, errorNote, linkId, mono, num, screenHead, spaced } from '/screens/parts.js';

/** The mockup's pulse: 120 columns of ten seconds each, in a 900x34 box. */
const PULSE_W = 900;
const PULSE_H = 34;
const PULSE_MINUTES = 20;
const PULSE_BUCKET_SECONDS = 10;
/** The mockup's own column gutter, so 120 columns read as 120 and not as a fill. */
const PULSE_GUTTER = 1.4;

/** How much history the screen opens with, and the most it will hold. */
const BACKLOG = 50;
const FEED_CAP = 200;

/**
 * How much history the STREAM replays on connect — `plan:walk seq:52`, the
 * owner's *"the audit stream is blank without records"*.
 *
 * **This is a second backlog and it is not redundant with `BACKLOG` above.**
 * That one is `/api/ask/audit`, which reads the PROJECTION; this one is the
 * JSONL, read by `AuditTail`. They are the same records whenever the projection
 * is current — `remember()` dedupes the overlap on the record's whole
 * serialized self — and they diverge in exactly the two states that produced
 * the report: a projection that was never built answers 200 with no records at
 * all, and a projection that is behind its log answers 503. In both the query
 * surface has nothing to give and the JSONL has 2,076 records.
 *
 * **The number is `BOUND_CAP_LIST` and is not a new one.** Five other bounded
 * surfaces in this app already cap at it, and a sixth bound invented here would
 * be a sixth thing for the product to mean by "some". The whole log is NOT
 * replayed: 2,076 records into a live view is the same defect pointed the other
 * way, which is why the stream declares what it held back rather than dropping
 * it silently.
 */
const STREAM_BACKLOG = BOUND_CAP_LIST;

/**
 * The chip a record kind wears, transcribed from the mockup's own `renderAudit`
 * — `'chip '+(kk==='mutation'?'crit':kk==='access'?'warn':'ok')` with `✕`, `▲`
 * and `●` for the glyph. A refusal is a warning and a mutation is the one thing
 * on this screen that changed the corpus; everything else is an ordinary event.
 *
 * The kind NAME is never translated. It is the record's own literal — product
 * vocabulary, the same treatment `parts.js`'s `TIERCHIP` gives a tier name —
 * and the mockup says why in its own filter-row comment: a `watch.kind.<kind>`
 * lookup against a kind the list forgot THROWS, which blanks the screen rather
 * than mislabelling one chip.
 */
const KIND_CHIP = {
  mutation: ['chip crit', '✕'],
  access: ['chip warn', '▲'],
};
const KIND_CHIP_DEFAULT = ['chip ok', '●'];

/** The pulse's hues — see this file's header for the ruling and its cost. */
const KIND_HUE = {
  mutation: 'var(--crit)',
  access: 'var(--warn)',
  focus: 'var(--gold)',
};
const KIND_HUE_DEFAULT = 'var(--ok)';
/** What a column counted but could not attribute: a kind this build cannot name. */
const KIND_HUE_UNKNOWN = 'var(--faint)';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The stream this module has open, if any.
 *
 * Module-level because a screen module is imported once and `render()` runs
 * again on every return to `#/watch`. Without this, walking away and back
 * would leave the first stream reading forever and the second would double
 * every row that arrived.
 */
let openStream = null;

/** `sv(tag, attrs)` — `screens/graph.js`'s factory, argument for argument. */
function sv(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key of Object.keys(attrs)) node.setAttribute(key, String(attrs[key]));
  return node;
}

/**
 * Direction UNKNOWN, so it is isolated: a record's `note` is written by an
 * agent or a human and may be in either script. `styles.css` carries the
 * mockup's `bdi{unicode-bidi:isolate}` for exactly this.
 */
function bdi(text) {
  return el('bdi', null, text);
}

/**
 * The mockup's `At` column: a wall clock, `09:26:05`.
 *
 * `en-GB` is a FORMAT choice and not a language one, the same argument
 * `parts.js`'s `num()` makes for `en-US`: it is the 24-hour spelling in both
 * UI languages, and an audit timestamp that changed shape with the interface
 * language would be a second thing to reconcile for no reader's benefit.
 *
 * A timestamp this build cannot parse is rendered AS IT ARRIVED rather than as
 * `Invalid Date` — the record's own bytes are the last true thing left.
 */
function clockOf(at) {
  const when = new Date(at);
  return Number.isNaN(when.getTime()) ? String(at) : when.toLocaleTimeString('en-GB', { hour12: false });
}

function kindChip(kind) {
  const [className, glyph] = KIND_CHIP[kind] ?? KIND_CHIP_DEFAULT;
  const chip = el('span', className, kind);
  chip.dataset.g = glyph;
  return chip;
}

/**
 * The activity pulse: one stacked column per bucket, height by volume, segment
 * by kind.
 *
 * STACKED rather than coloured by a dominant kind, because "height is records
 * in that column, colour is the record kind" is a claim about the whole column
 * and a dominant-kind rule would silently drop everything else in it. The
 * segments are drawn in the order the endpoint declares them, which is
 * `AUDIT_KINDS`' own order — the server builds each breakdown from that one
 * declaration
 * (`ui/watch-model.ts` · `byKind: Object.fromEntries(AUDIT_KINDS.map((k) => [k, 0])) as Record<AuditKind, number>,` · ~80).
 *
 * Mirrored by PROJECTION for RTL, never by a transform: `scale(-1,1)` would
 * reverse the marks' own geometry too. The page direction is `<html dir>`,
 * which `applyLanguage` sets from the string table.
 */
function drawPulse(ctx, buckets) {
  const rtl = document.documentElement.dir === 'rtl';
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const slot = PULSE_W / buckets.length;
  const width = Math.max(0.5, slot - PULSE_GUTTER);
  const svg = sv('svg', {
    viewBox: `0 0 ${PULSE_W} ${PULSE_H}`,
    class: 'chart',
    // The box is 34px and the series is 120 columns wide; without this the
    // aspect ratio is preserved and the columns letterbox inside their plate.
    preserveAspectRatio: 'none',
    role: 'img',
    // An accessible name is an ATTRIBUTE and cannot hold an element, which is
    // what `tFlat` exists for. `watch.pulsen` is the design of record's own
    // sentence about this graphic, so the label is keyed rather than invented.
    'aria-label': ctx.tFlat('watch.pulsen'),
  });
  const round = (n) => Math.round(n * 100) / 100;
  // **The floor the columns stand on, drawn whether or not any of them are.**
  //
  // A twenty-minute window is empty most of the time on a real corpus — this
  // repository's own log has stretches of hours — and without this the plate
  // renders as a bare box, which a reader cannot tell from a chart that failed
  // to draw. A measured zero and an undrawn chart are two facts and the
  // difference has to survive. The treatment is this project's own, stated for
  // the same series one layer down
  // (`lib/viewmodel.js` · `in which nothing happened must draw a flat line on the floor, and 0/0 would` · ~110).
  // **`vector-effect:non-scaling-stroke`, and it is not a flourish.** The plate
  // is 34px tall and `.plate` spends 12px of padding on each side of it, so the
  // 34-unit viewBox renders into EIGHT pixels — measured on the design of
  // record itself, which draws its own pulse at exactly the same eight (`#pulse`
  // host 34, svg 8, in both files). One user unit is therefore 0.235 device px,
  // and the first version of this floor was drawn as a 1-unit rect that came
  // back 0.235px tall and invisible in the screenshot — which is the exact
  // failure it exists to prevent, found by looking rather than by reasoning.
  // A non-scaling stroke is one DEVICE pixel whatever the viewBox does.
  //
  // `--edge-3` and not `--rule`, the mockup's axis token
  // (`svg.chart .axis{stroke:var(--rule)}`): every other chart in the design
  // sits on `--plate`, and `.pulse` sets its own darker `--sink` ground, where
  // `--rule` is a line nobody can see. `--edge-3` is the same family at the
  // contrast this ground needs — the token that "bounds CONTROLS, so it owes 3:1".
  //
  // Drawn FIRST and therefore behind: a column stands on the floor and covers
  // it, so no bar is shortened by it. The floor is what is left where no column
  // stands, which is the whole point — a twenty-minute window with nothing in
  // it must read as a chart of nothing, not as a chart that failed to draw.
  svg.append(sv('line', {
    x1: 0, y1: PULSE_H - 1, x2: PULSE_W, y2: PULSE_H - 1,
    stroke: 'var(--edge-3)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
  }));
  buckets.forEach((bucket, index) => {
    if (bucket.total === 0) return;
    const u = index * slot;
    const x = round(rtl ? PULSE_W - u - width : u);
    let top = PULSE_H;
    let accounted = 0;
    const segment = (count, fill) => {
      const height = (count / max) * PULSE_H;
      top -= height;
      svg.append(sv('rect', {
        x, y: round(top), width: round(width), height: round(height), fill, rx: 1,
      }));
    };
    for (const [kind, count] of Object.entries(bucket.byKind ?? {})) {
      if (count === 0) continue;
      accounted += count;
      segment(count, KIND_HUE[kind] ?? KIND_HUE_DEFAULT);
    }
    // The column's height is its TOTAL, and a kind this build does not know is
    // counted there and absent from the breakdown by the endpoint's own design.
    // Drawing only the accounted part would shorten the column in silence.
    if (bucket.total > accounted) segment(bucket.total - accounted, KIND_HUE_UNKNOWN);
  });
  return svg;
}

export async function render(root, ctx) {
  // A second visit must not leave the first visit's stream reading. Stopping
  // it here rather than only on the way out also covers a reload of the same
  // route and a render that threw before it reached its own teardown.
  if (openStream !== null) {
    openStream();
    openStream = null;
  }

  root.replaceChildren();
  screenHead(ctx, root, 'watch.h', 'watch.v', 'watch.sub');

  const card = el('div', 'card pane');
  root.append(card);

  // --- The activity pulse ---------------------------------------------------
  // `.plate` because it is DATA: "Text may float on glass. Data may not."
  // The mockup marks it the same way — `<div class="pulse plate" id="pulse">`.
  const pulse = el('div', 'pulse plate');
  pulse.id = 'pulse';
  const pulseFault = errorNote('');
  pulseFault.hidden = true;
  const pulseNote = el('p', 'small');
  // The mockup's `style="margin-block:0 9px"`, through CSSOM because CSP
  // forbids the attribute (see `screens/parts.js`).
  pulseNote.style.setProperty('margin-block', '0 9px');
  pulseNote.append(...ctx.t('watch.pulsen'));

  // --- The kind filters -----------------------------------------------------
  const filters = el('div');
  filters.id = 'wfilters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', ctx.tFlat('aria.wfilters'));
  for (const [property, value] of [
    ['display', 'flex'], ['gap', '6px'], ['flex-wrap', 'wrap'], ['margin-block-end', '9px'],
  ]) {
    filters.style.setProperty(property, value);
  }

  // --- The record table -----------------------------------------------------
  const plate = el('div', 'plate');
  const table = el('table');
  const head = el('thead');
  const headRow = el('tr');
  for (const key of ['th.at', 'th.kind', 'th.what']) {
    const cell = el('th');
    cell.append(...ctx.t(key));
    headRow.append(cell);
  }
  head.append(headRow);
  const body = el('tbody');
  body.id = 'atbl';
  table.append(head, body);
  plate.append(table);

  // --- What the replay held back -------------------------------------------
  //
  // `REQ-every-list-and-table-declares-what-leaves-it-and-when-and`. Placed
  // where `boundedList` places its own bound line — under the table, where the
  // reader reaches the end of the list — and built as the same `p.small`,
  // because a second spelling of "there is more" is how a product comes to have
  // two. It carries NO "show earlier" control: `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`
  // was filed today and is not this task. What is here so that it does not have
  // to be undone is the BOUNDARY — the oldest replayed record's own `at`, which
  // `/api/ask/audit` already accepts as `until`. "Show earlier" is that
  // parameter, not a rewrite.
  //
  // Hidden until the stream's opening frame answers: a bound line drawn over a
  // list nothing has measured would be the defect one layer up.
  const feedBound = el('p', 'small');
  feedBound.id = 'wbound';
  feedBound.hidden = true;

  const feedFault = errorNote('');
  feedFault.hidden = true;

  // --- The live region ------------------------------------------------------
  const alive = spaced(el('p', 'small'));
  alive.id = 'alive';
  alive.setAttribute('aria-live', 'polite');

  // --- The token-void note --------------------------------------------------
  const voidNote = el('p', 'small');

  card.append(pulse, pulseFault, pulseNote, filters, plate, feedBound, feedFault, alive, voidNote);

  // ── STATE ────────────────────────────────────────────────────────────────
  /** Newest first, which is the order the mockup's own table reads in. */
  const records = [];
  /** Full serialized identity, so the stream and the backlog overlap once. */
  const seen = new Set();
  /**
   * The records that ARRIVED WHILE THE READER WATCHED, by identity.
   *
   * Requirement 3 of the fix: a backlog that cannot be told from the live feed
   * only relocates the confusion the blank feed caused. Held as a set of the
   * record objects themselves rather than as a flag on each record, because a
   * record is a server object this screen renders and must not annotate — a
   * field added here would travel into `dedupeKey`, which keys on the record's
   * whole serialized self, and the same record arriving twice would stop
   * deduping.
   */
  const live = new Set();
  /** The kinds the filter row offers, in the order they were learned. */
  const kinds = [];
  let selected = 'all';
  let budget = null;
  /** Once the stream has refused, nothing else will arrive and nothing reconnects. */
  let faulted = false;
  /** True once the stream's opening frame has been read — see `sayShown`. */
  let connected = false;
  /**
   * Whether the LOG itself is empty, or `null` while nobody has measured.
   *
   * The three values are three different sentences and the whole of what
   * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` asks for
   * here. Only a backlog that reached the beginning of the log may set `true`.
   */
  let logEmpty = null;

  const visible = () => (selected === 'all' ? records : records.filter((r) => r.kind === selected));

  function say(key, subs) {
    alive.replaceChildren(...ctx.t(key, subs));
  }

  /**
   * **WHICH empty this is, said out loud** — the half of the owner's report
   * that a backlog alone does not fix.
   *
   * An empty feed used to mean one thing on screen and three things in fact.
   * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is broken
   * by any of them rendering as the others:
   *
   *   - the log was READ TO ITS BEGINNING and holds nothing — a MEASURED zero,
   *     and the only state entitled to say "this corpus has no audit log";
   *   - the stream answered and could not measure the log — "nothing since you
   *     connected", which is what `watch.streamWaiting` has always said and is
   *     an UNMEASURED emptiness;
   *   - nothing has been measured at all yet, because no read has resolved, or
   *     a filter is hiding rows that exist. `watch.shown` is exactly true here:
   *     it counts what is ON SCREEN, which is what the key says, and the
   *     pressed filter button beside it names the narrowing.
   */
  function sayShown() {
    if (faulted) return;
    const shown = visible().length;
    if (shown > 0) {
      say('watch.shown', { records: shown });
      return;
    }
    if (logEmpty === true) {
      say('watch.emptyLog');
      return;
    }
    if (connected && logEmpty === null) {
      say('watch.streamWaiting');
      return;
    }
    say('watch.shown', { records: shown });
  }

  /**
   * A record enters the feed at most once, keyed by its whole serialized self
   * — records carry no id, which is design decision 1's trade, taken knowingly:
   * "inventing an id server-side would be a second truth about a log whose
   * whole value is being the first one".
   */
  function remember(record, newest) {
    const key = dedupeKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    if (newest) {
      records.unshift(record);
      live.add(record);
    } else {
      records.push(record);
    }
    // The dropped record leaves `live` with it. `seen` deliberately keeps its
    // key — that is what stops a re-arriving record from being drawn twice —
    // but `live` is asked "is this ON SCREEN and new", and a set that only ever
    // grew would answer for records the feed no longer holds.
    while (records.length > FEED_CAP) live.delete(records.pop());
    return true;
  }

  /**
   * A focus change is NOT a row. It is a regime boundary drawn across the whole
   * feed, because everything below it was selected from a different corpus and
   * the series either side of it is not comparable. Drawn as a row it reads as
   * one more event, and the disappearance it explains looks causeless.
   *
   * **`regime change · ` is the mockup's own English literal and is NOT keyed.**
   * The design of record builds it inside a `HEB ? … : …` ternary in script, so
   * neither string table declares it and neither could: `strings-parity.test.ts`
   * compares both tables against the mockup's `data-t` set in BOTH directions,
   * and a key invented here would fail it as an invented string. Transcribed
   * rather than corrected, and raised in this task's report — the fix is a key
   * in the mockup first. `watch.sub` already carries the concept in both
   * languages ("A focus change is a regime change, drawn as a rule across the
   * feed"), so the meaning is not lost, only this row's label.
   */
  function regimeRow(described, at) {
    const row = el('tr', 'regime');
    const cell = el('td');
    cell.colSpan = 3;
    const wrap = el('div', 'rw');
    const text = el('span', null, 'regime change · ');
    text.append(mono(described.op));
    if (described.note !== null) text.append(' — ', bdi(described.note));
    wrap.append(el('span', null, '◇'), text, el('span', 'ln'), mono(at));
    cell.append(wrap);
    row.append(cell);
    return row;
  }

  /**
   * The `What` column for everything that is not an injection: the record's own
   * fields, in the order the mockup's sample rows read them, and nothing
   * composed that the record does not carry.
   *
   * Every part comes from `describeRecord`, which is the TESTED view-model —
   * `op`, `itemId`, `note`, `path`. The id is a `linkId` rather than plain text
   * because every other screen in this app makes a corpus id reachable, and a
   * row that names an item it cannot open is a dead end; the mockup writes it
   * as prose because its sample rows are prose.
   *
   * Wrapped in a `<bdi>`, which is what the mockup's own row does with this
   * cell (`c3.append(bdi(w))`): the direction of what a record carries is
   * UNKNOWN — an agent wrote the note and a human named the item — and the
   * isolation is the only thing that keeps one Hebrew note from reordering the
   * `op` in front of it.
   */
  /**
   * **The WHAT cell, composed per KIND — because the mockup composes one.**
   *
   * This was a single generic line for every kind that is not `injection` or
   * `focus`: op, then itemId, then note, then path. It satisfied `mutation` by
   * coincidence — that kind's shape happens to be op plus id, which is exactly
   * what the mockup shows — and nothing else.
   *
   * The design of record gives each kind its own sentence, and the shape is
   * always PRIMARY — DETAIL:
   *
   *     hook       SessionStart — 2 pinned, 7 index
   *     access     ui-refused — a write was attempted from the read-only UI
   *     progress   step-done — PROC-release-checklist, step 3 of 7
   *     mutation   create INV-prices-are-integer-cents
   *
   * What differs per kind is which field is the PRIMARY, and that is the whole
   * defect. A `hook` record's primary is its `hook` field — the platform event
   * — not its `op`: the hook ops are `pre-compact`, `post-tool-use`, `deny`,
   * and none of them is the word the mockup prints. An `access` record's detail
   * is which check refused it, which lives in `refusal.check` and was never
   * reaching this function at all.
   *
   * **The refusal check is rendered as an IDENTIFIER, not as prose**, and that
   * is deliberate rather than lazy. `token-missing` and `token-mismatch` are
   * the vocabulary `security.ts` refuses in, they are what the audit record
   * stores, and they are the words somebody grepping the log will search for.
   * Prose would need four new sentences in both string tables — and
   * `strings-parity` requires every key to exist in the mockup too, so it would
   * mean writing four Hebrew security sentences nobody here can review. An
   * identifier needs no translation, exactly as `SessionStart` and an item id
   * need none, and it says strictly more than the bare `ui-refused` this
   * rendered before.
   */
  function whatOf(described) {
    const box = bdi('');

    // A hook's primary is the EVENT, falling back to the op when a record
    // carries no `hook` field — older records, and any this reader has not met.
    if (described.kind === 'hook' && typeof described.hook === 'string' && described.hook !== '') {
      box.append(mono(described.hook));
    } else {
      box.append(mono(described.op));
    }

    if (described.itemId !== null) box.append(' ', linkId(described.itemId, false));

    // `access`: which check refused it, and on what route. Both come from
    // `refusal`, which `describeRecord` now carries; before this the row could
    // say only `ui-refused` and a reader had no way to learn why.
    if (described.kind === 'access' && described.refusal !== null) {
      const { check, method, route } = described.refusal;
      if (typeof check === 'string' && check !== '') box.append(' — ', mono(check));
      if (typeof method === 'string' && typeof route === 'string' && route !== '') {
        box.append(' ', mono(`${method} ${route}`));
      }
    }

    if (described.note !== null) box.append(' — ', bdi(described.note));
    if (described.path !== null) box.append(' ', mono(described.path));
    return [box];
  }

  /**
   * The injection row's cost: a gold bar against the budget, or a hatched void
   * where `tokens` was never written.
   *
   * **Absent is not zero**, which is the whole reason the void exists — the
   * field is optional on `AuditRecord` and records written before 1.0.1 never
   * had it, so a zero-length bar would be a claim the record does not make
   * (`core/audit.ts` · `ABSENT on records written before this field existed, and absence means` · ~366).
   * `describeRecord` is where that decision is made and tested; this only draws
   * the two states it returns.
   *
   * **With no budget there is no bar, and the number still shows.** A bar is a
   * ratio, and a ratio with an unknown denominator cannot be drawn at any
   * length — including zero. The count is known either way and is said either
   * way.
   */
  function costOf(cell, described) {
    if (described.tokens === 'not-recorded') {
      const voidBar = el('div', 'tokvoid');
      voidBar.title = ctx.tFlat('title.tokensNotRecorded');
      const note = el('div', 'nt');
      note.append(...ctx.t('watch.tokensNotRecorded'));
      cell.append(voidBar, note);
      return;
    }
    if (budget !== null) {
      const bar = el('div', 'tokbar');
      const pct = budget > 0
        ? Math.min(100, (described.tokens / budget) * 100)
        : (described.tokens > 0 ? 100 : 0);
      bar.style.setProperty('inline-size', `${pct}%`);
      cell.append(bar);
    }
    const note = el('div', 'nt');
    note.append(...ctx.t('watch.tokens', { tokens: num(described.tokens) }));
    cell.append(note);
  }

  function rowFor(record) {
    const described = describeRecord(record);
    const at = clockOf(described.at);
    if (described.kind === 'focus') return regimeRow(described, at);

    const row = el('tr');
    row.append(el('td', 'm small', at));
    const kindCell = el('td');
    kindCell.append(kindChip(described.kind));
    row.append(kindCell);

    const what = el('td');
    if (described.kind === 'injection') {
      what.append(
        ...ctx.t('watch.delivered', { delivered: described.injected }),
        ', ',
        ...ctx.t('watch.spilled', { spilled: described.spilled.length }),
      );
      costOf(what, described);
    } else {
      what.append(...whatOf(described));
    }
    row.append(what);
    return row;
  }

  /**
   * **The line between what you are watching and what was already there.**
   *
   * A backlog that a reader cannot tell from the live feed does not fix the
   * defect — it moves it: the screen stops being blank and starts being
   * ambiguous about which of its rows just happened. So the two halves are
   * separated by a rule across the whole feed, and the rule is LABELLED.
   *
   * **It reuses `tr.regime`, and that reuse is a decision rather than a
   * shortcut.** The stylesheet owns exactly one full-width feed boundary and
   * describes it in those terms — *"A focus change is not a row. It is a regime
   * boundary"* — with `.rw` and `.ln` as its parts. Two alternatives were
   * weighed and both cost a new CSS rule, which this task may not add: marking
   * each live row with the shell's `.live` dot fails because `.live` sizes
   * itself with `inline-size`/`block-size`, which do nothing on an inline
   * element inside a `<td>` and would need a flex wrapper rule; and a class of
   * its own needs a rule by definition. What the reuse costs is that two
   * different boundaries wear one hue — mitigated by the sentence, which is
   * keyed and translated, and by there being at most ONE of these on a feed.
   *
   * No glyph, unlike `regimeRow`: its `◇` is the regime mark, and borrowing it
   * would make the two boundaries identical at a glance instead of merely
   * similar.
   */
  function historyBoundary() {
    const row = el('tr', 'regime');
    const cell = el('td');
    cell.colSpan = 3;
    const wrap = el('div', 'rw');
    const text = el('span');
    text.append(...ctx.t('watch.historyLine'));
    wrap.append(text, el('span', 'ln'));
    cell.append(wrap);
    row.append(cell);
    return row;
  }

  function renderRows() {
    const rows = visible();
    const built = document.createDocumentFragment();
    // Drawn only when there is something on BOTH sides of it. A rule under
    // nothing, or over nothing, separates nothing and is one more mark for a
    // reader to account for.
    let pending = rows.some((record) => live.has(record))
      && rows.some((record) => !live.has(record));
    for (const record of rows) {
      if (pending && !live.has(record)) {
        built.append(historyBoundary());
        pending = false;
      }
      built.append(rowFor(record));
    }
    body.replaceChildren(built);
    return rows.length;
  }

  /**
   * One filter button per member of `AUDIT_KINDS`, **derived and never
   * written down** — the mockup's own standing instruction, and its own reason:
   * a hand-copied enum goes stale in silence, and this one already did (`access`
   * and `progress` landed in `core/audit.ts` after the card was drawn and
   * nothing came back to redraw them).
   *
   * `All` is the only prose here and is the only thing keyed.
   */
  function renderFilters() {
    filters.replaceChildren();
    const entries = [['all', null], ...kinds.map((kind) => [kind, kind])];
    for (const [value, literal] of entries) {
      const button = el('button', 'icon');
      button.type = 'button';
      // The mockup's `style="inline-size:auto"` on every filter button: `.icon`
      // is a 29px square by default and these carry words.
      button.style.setProperty('inline-size', 'auto');
      button.dataset.k = value;
      button.setAttribute('aria-pressed', value === selected ? 'true' : 'false');
      if (literal === null) button.append(...ctx.t('watch.all'));
      else button.append(literal);
      filters.append(button);
    }
  }

  /**
   * The two places the kind vocabulary can be learned from, and what is missing.
   *
   * The FIRST is `/api/watch/volume`: every bucket carries a breakdown holding
   * every member of `AUDIT_KINDS` at zero, built from the one declaration, so
   * its key order IS the enum. That is a real derivation and it is the one this
   * screen prefers.
   *
   * The SECOND is the records themselves, which is a derivation from DATA and
   * strictly weaker — it can only name kinds that happen to have occurred. It
   * exists because the first one vanishes exactly when it is least affordable:
   * a projection that is stale, diverged or damaged makes `/api/watch/volume`
   * a 503, and the filter row would otherwise be left offering `All` alone
   * while the live stream filled the table with seven kinds of record.
   *
   * **No browser-reachable endpoint serves `AUDIT_KINDS` unconditionally**, and
   * that is a genuine gap between the mockup's instruction and this app's
   * architecture. Raised in this task's report rather than closed here by
   * respelling the enum in JavaScript, which is the one thing the instruction
   * forbids.
   */
  function learnKinds(more) {
    let changed = false;
    for (const kind of more) {
      if (typeof kind === 'string' && kind !== '' && !kinds.includes(kind)) {
        kinds.push(kind);
        changed = true;
      }
    }
    if (changed) renderFilters();
  }

  renderFilters();
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-k]');
    if (button === null) return;
    selected = button.dataset.k;
    for (const other of filters.querySelectorAll('button[data-k]')) {
      other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
    }
    renderRows();
    sayShown();
  });

  // Said BEFORE the first fetch resolves, not after. An `aria-live` region
  // that is empty for as long as three round trips take announces nothing at
  // all to a screen reader arriving in that window, and "0 records shown" is
  // true at that moment — it is the count of what is on screen, which is what
  // the key says.
  sayShown();

  // ── THE BUDGET THE TOKEN BAR IS DRAWN AGAINST ────────────────────────────
  //
  // The SUM of the resolved tier budgets, because an injection's `tokens` is
  // "the sum of the chars/4 estimates the selector charged its budgets" across
  // every tier that ran, and no field on the record says which tiers those
  // were. The total is therefore the only bound that is true of every
  // injection record. The mockup writes 6,000, which is one tier's default
  // (`core/config.ts` · `export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };` · ~56)
  // and would over-fill every bar on a corpus that raised any budget. Raised in
  // this task's report: the honest denominator is per-EVENT, and the record
  // would have to carry which tiers ran for it to be drawn.
  function applyBudget(config) {
    const budgets = config.resolved === null || config.resolved === undefined
      ? null : config.resolved.budgets;
    if (budgets === null || budgets === undefined) {
      // The loader's own words, never a paraphrase — the same treatment every
      // other endpoint refusal on this surface gets.
      voidNote.replaceWith(errorNote(config.parseError ?? config.resolveError ?? ''));
    } else {
      budget = Object.values(budgets).reduce((sum, value) => sum + value, 0);
      voidNote.append(...ctx.t('watch.voidn', { budget: num(budget) }));
    }
  }

  // ── THE PULSE ────────────────────────────────────────────────────────────
  function applyVolume(volume) {
    if (volume.buckets.length === 0) {
      // An absent projection answers with NO columns rather than a row of
      // zeroes, and the difference must survive on screen: 120 zero columns is
      // a chart asserting that nothing happened over a log nothing has read.
      // The state is the SERVER'S OWN WORD — `absent` — drawn as a literal
      // chip, the treatment a kind and a tier already get, because no string
      // table declares a sentence for it and the mockup declares no key to add
      // one under. Raised in this task's report: this state owes the design of
      // record a keyed sentence.
      const state = el('span', 'chip warn', String(volume.projectionState));
      state.dataset.g = '▲';
      pulse.append(state);
    } else {
      learnKinds(Object.keys(volume.buckets[0].byKind ?? {}));
      pulse.append(drawPulse(ctx, volume.buckets));
    }
  }

  function failVolume(error) {
    // Beside the plate rather than inside it: `.pulse` is a 34px box with
    // `overflow:hidden`, and a refusal clipped to one line of itself is a
    // refusal nobody can read.
    pulseFault.textContent = error.message;
    pulseFault.hidden = false;
  }

  // ── THE BACKLOG ──────────────────────────────────────────────────────────
  //
  // Oldest-first off the wire (`filterSelect` takes the newest n in descending
  // order and reverses them), and this feed reads newest-first, so it is walked
  // backwards rather than reversed into a second array.
  function applyBacklog(backlog) {
    for (let i = backlog.records.length - 1; i >= 0; i -= 1) {
      remember(backlog.records[i], false);
      learnKinds([backlog.records[i].kind]);
    }
    feedFault.hidden = true;
    renderRows();
  }

  function failBacklog(error) {
      // Drawn BESIDE the table and not instead of it: the stream can still be
      // filling that table while the projection refuses, and those are two
      // different facts about two different reads.
      //
      // **Said ONCE when it is the same sentence.** The pulse and the backlog
      // read the same projection through the same door, so a stale or damaged
      // one refuses both with a byte-identical message — and the screen was
      // printing that four-line paragraph twice, forty lines apart, which
      // reads as a rendering bug rather than as two facts. Compared as TEXT
      // and not assumed: two DIFFERENT refusals are two different facts and
      // both are shown, which is the case this collapse must not swallow.
    const message = error.message;
    const alreadySaid = !pulseFault.hidden && pulseFault.textContent === message;
    feedFault.textContent = message;
    feedFault.hidden = alreadySaid;
    renderRows();
  }

  // ── THE STREAM'S OWN BACKLOG ─────────────────────────────────────────────
  //
  // What was already in the JSONL when the stream opened, carried on the
  // `hello` frame. This is the half of the fix that answers the owner directly:
  // the query surface above reads the PROJECTION and has nothing to give when
  // the projection was never built (200, no records) or is behind its log (503)
  // — and both of those were true of the corpus he was looking at.
  //
  // Applied as HISTORY (`remember(record, false)`), never as live: these
  // records predate the connection, and calling them live would put a boundary
  // in the wrong place and a lie in the live region.
  function applyStreamBacklog(opening) {
    const replayed = Array.isArray(opening.records) ? opening.records : [];
    // Oldest first off the wire and newest-first on screen, so it is walked
    // backwards rather than reversed into a second array — `applyBacklog`'s
    // own rule, kept identical so the two backlogs cannot disagree about order.
    for (let i = replayed.length - 1; i >= 0; i -= 1) {
      remember(replayed[i], false);
      learnKinds([replayed[i].kind]);
    }
    // `complete` is a MEASUREMENT — the tail's scan reached the beginning of
    // the log — so an empty complete backlog is the one thing entitled to say
    // this corpus has no audit log. Anything less leaves `logEmpty` null and
    // the live region says the unmeasured sentence instead.
    logEmpty = opening.complete === true && replayed.length === 0;
    if (replayed.length === 0) {
      // Nothing to bound. The empty state is one sentence in the live region,
      // not two saying the same thing in different words.
      feedBound.replaceChildren();
      feedBound.hidden = true;
    } else {
      feedBound.replaceChildren(...ctx.t(
        opening.complete === true ? 'watch.backlogAll' : 'watch.backlogSome',
        { shown: num(replayed.length) },
      ));
      feedBound.hidden = false;
    }
    renderRows();
  }

  /** The resync obligation's refetch, and only that: the first load is below. */
  async function reloadBacklog() {
    try {
      applyBacklog(await ctx.api(`/api/ask/audit?limit=${BACKLOG}`));
    } catch (error) {
      failBacklog(error);
    }
  }

  // ── THE THREE READS, IN PARALLEL AND APPLIED IN ORDER ────────────────────
  //
  // **Parallel because they are independent, and because a screen that settles
  // three times settles wrongly.** They were sequential, which cost two things.
  // The first is plain: three local reads taken one after another is three
  // round trips of blank screen where one would do. The second is what actually
  // failed — `e2e/screen-parity.spec.ts` decides a screen has finished
  // rendering when two element counts 400ms apart agree, and a screen that
  // grows in three separate steps can sit still across that window with a fetch
  // still in flight. It sampled a half-drawn Audit stream under the full
  // suite's parallel load and reported the graphic missing. One await, one
  // settle.
  //
  // APPLIED in a fixed order regardless of which resolves first: the budget
  // before the backlog, because a row's token bar is drawn against it and a
  // bar rendered before the denominator arrived would be a different bar.
  //
  // `allSettled` and not `all`: these three refuse independently — a stale
  // projection takes the pulse and the backlog while the config still answers —
  // and `all` would discard two good answers because the third failed.
  const [config, volume, backlog] = await Promise.allSettled([
    ctx.api('/api/config'),
    ctx.api(`/api/watch/volume?minutes=${PULSE_MINUTES}&bucket=${PULSE_BUCKET_SECONDS}`),
    ctx.api(`/api/ask/audit?limit=${BACKLOG}`),
  ]);
  if (config.status === 'fulfilled') applyBudget(config.value);
  else voidNote.replaceWith(errorNote(config.reason.message));
  if (volume.status === 'fulfilled') applyVolume(volume.value);
  else failVolume(volume.reason);
  if (backlog.status === 'fulfilled') applyBacklog(backlog.value);
  else failBacklog(backlog.reason);
  sayShown();

  // ── THE LIVE STREAM ──────────────────────────────────────────────────────
  const stop = ctx.stream(`/api/watch/stream?backlog=${STREAM_BACKLOG}`, (event, data) => {
    const described = describeStreamEvent(event, data);
    if (described.kind === 'record') {
      if (described.record === null) return;
      learnKinds([described.record.kind]);
      if (remember(described.record, true)) {
        renderRows();
        sayShown();
      }
      return;
    }
    if (described.kind === 'hello') {
      connected = true;
      // **Read off `data`, not off `described`.** `describeStreamEvent` names
      // this frame and its poll interval and nothing else, and it lives in
      // `lib/viewmodel.js` — the module whose own rule is that a frame it
      // cannot name must not reach the feed. The backlog is not a frame: it is
      // a field on a frame that module already names, so it is read here, where
      // the screen that asked for it can apply it.
      const opening = data !== null && typeof data === 'object' ? data.backlog : undefined;
      if (opening !== undefined && opening !== null) applyStreamBacklog(opening);
      // `sayShown` owns the choice between "N records shown", "connected —
      // waiting for the next record" and "this corpus has no audit log at all".
      // It used to be made here, and it could only see two of the three.
      sayShown();
      return;
    }
    if (described.gap) {
      // The tail reset to the current EOFs, so whatever landed in the gap is
      // not coming down this stream. The obligation is the refetch, and the
      // sentence goes up AFTER it so that "the history list below was
      // refetched" is true when it is read.
      void reloadBacklog().then(() => { if (!faulted) say(described.stringKey); });
      return;
    }
    if (described.ended) {
      faulted = true;
      say(described.stringKey, { error: described.error ?? '' });
      return;
    }
    // 'unknown' — a frame this build cannot name never reaches the feed as
    // though it were audited history.
  }, () => {
    // An ENDED stream is not this screen's to report. The server exiting is a
    // global state and the shell answers it globally, with `#exited` and the
    // `mycontext ui` remedy; a second, quieter claim here would be a screen
    // guessing at why. Nothing reconnects, ever (spec §2).
  });

  openStream = stop;

  // The screen contract has no teardown hook, so the shell's own router event
  // is the one signal available: `route()` flips `hidden` on every section
  // synchronously before it awaits the next screen's module, and this listener
  // is registered after the shell's, so `root.hidden` is already true by the
  // time this runs.
  const onLeave = () => {
    if (!root.hidden) return;
    window.removeEventListener('hashchange', onLeave);
    if (openStream === stop) openStream = null;
    stop();
  };
  window.addEventListener('hashchange', onLeave);
}
