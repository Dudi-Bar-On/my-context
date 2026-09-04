/**
 * `nav.ev` — **Audit stream**, `<section data-p="watch">` in the design of
 * record. One card, in the mockup's own order: the activity pulse, its note,
 * the kind filters, the record table, the live region, the token-void note —
 * plus the registered-hooks panel at the foot, which the mockup does not draw
 * at all (`hooks/31`, below) and which is added rather than fitted into the
 * mockup's order, under `DEC-the-app-is-what-is-built-the-mockup-is-history-
 * and-a-gap`: a feature this screen gains does not have to be drawn in the
 * design of record first.
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
 *   - **The live feed** is `GET /api/watch/stream`, through `ctx.subscribeStream()`
 *     since `plan:live seq:1` — the shell opens that ONE connection and this
 *     screen asks for every record kind (`'*'`), rather than opening a fetch
 *     of its own the way it did when `ctx.stream()` first added it to the
 *     shell (`plan:walk seq:11`). It reads the JSONL directly and so is
 *     the ONLY part of this screen that still answers when the projection is
 *     stale — which, since `plan:walk seq:52`, is why it also carries a
 *     BOUNDED REPLAY of what was already in the log. Both other sources on this
 *     screen read the projection, so a corpus whose projection was never built
 *     or has fallen behind its log had nothing left to draw the feed from, and
 *     an empty live tail was read as "this corpus has no records". See
 *     `BOUND_CAP_LIST` below, and `applyStreamBacklog`.
 *   - **The budget** the token bar is drawn against is the sum of the resolved
 *     tier budgets from `GET /api/config`; see `watch.voidn`'s note below.
 *   - **The registered-hooks panel** is `GET /api/ask/summary?report=ops` —
 *     `summaryByOp`, unbounded by any `limit`, so it answers from the WHOLE
 *     projection rather than sharing a budget with `agent-step` the way the
 *     feed above does. See its own build site (`applyRegisteredHooks`, below)
 *     for the fault this closes.
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
import { dedupeKey, describeRecord, describeStreamEvent, formatDuration } from '/lib/viewmodel.js';
// `clockOf` — the mockup's `At` column, `09:26:05`. Shared with Ask's audit
// table and with the injection preview's `When` rather than spelled a third
// time here: this screen's own copy reformatted anything `Date` would accept,
// Ask's refused a stamp carrying no zone, and the two audit tables therefore
// disagreed about the same record. `parts.js` holds the guard, the two
// precisions and the whole argument.
import {
  BOUND_CAP_TABLE, clockOf, el, errorNote, linkId, mono, num, screenHead, spaced,
} from '/screens/parts.js';

/** The mockup's pulse: 120 columns of ten seconds each, in a 900x34 box. */
const PULSE_W = 900;
const PULSE_H = 34;
const PULSE_MINUTES = 20;
const PULSE_BUCKET_SECONDS = 10;
/** The mockup's own column gutter, so 120 columns read as 120 and not as a fill. */
const PULSE_GUTTER = 1.4;

/** The most this feed will ever hold in memory, once backlog and live records are merged. */
const FEED_CAP = 200;

/**
 * The bound `resolveSteps` searches within, past the feed's own window —
 * `/api/ask/audit`'s own declared ceiling (`ask-model.ts`'s
 * `intParam(url, 'limit', 1, 2000, 200)`), not `FEED_CAP`.
 *
 * **Measured wrong at `FEED_CAP` (200) on this project's own dogfooded
 * corpus, in a browser, the moment this task's fix first shipped**: one
 * lane's own 139-step burst was findable and its toggle came alive, but
 * every OTHER `subagent-stop` row on screen still read "0 steps" — not
 * because their steps do not exist, but because `SubagentStop` alone had
 * written 10,786 records by then (`applyRegisteredHooks`' own panel, this
 * corpus) and a 200-deep search among them reaches only the one or two
 * newest bursts. `FEED_CAP` was the right number for the MIXED feed above,
 * which competes six other kinds for the same budget; it undersells a
 * lookup that competes against nothing but `agent-step` itself. Spending the
 * endpoint's own outer limit here costs one wider read per unresolved lane,
 * not a wider one for the feed everybody shares, and still ends in a
 * disclosed miss rather than an unbounded scan — the endpoint refuses
 * anything past this by construction, so it is the widest bound this lookup
 * COULD ask for without a second endpoint.
 */
const STEP_LOOKUP_CAP = 2000;

/**
 * How much history the screen OPENS WITH — `/api/ask/audit?limit=BACKLOG`, the
 * projection-backed read.
 *
 * **Raised from a bare 20 to `FEED_CAP` on
 * `TASK-the-audit-stream-shows-almost-nothing-of-what-the-log-holds`, 2026-09-04
 * — measured, not guessed.** The owner's live screen drew 7 rows, one of them a
 * step, over a log holding 92 `agent-step` records written the previous hour;
 * reproduced here on this repository's own corpus, a 20/50-record window opened
 * with every completed lane showing "0 steps" — not a partial count, NONE —
 * while only the one agent that happened to be stepping LIVE while the tab was
 * open ever showed a real number. A `SubagentStop` backfills a lane's steps in
 * ONE burst (this file's own note on `LANE_OPS` above), so on a corpus this
 * active a finished lane's dispatch, every one of its steps, AND its stop can
 * all sit behind more than fifty other records by the time anyone opens the
 * tab — not merely the dispatch, which is the narrower case
 * `TASK-a-lane-backfills-more-steps-than-the-feed-window-holds-so` already
 * fixed STRUCTURALLY (orphan grouping + a lookup for the missing dispatch,
 * which survives any burst size because it does not depend on the window at
 * all).
 *
 * **This case has no such structural fix.** There is no burst-size-independent
 * way to guarantee a whole lane's steps are fetched without scanning the log
 * this screen deliberately does not replay in full
 * (`MAX_STREAM_BACKLOG`, `ui/watch-model.ts`) — some bound is unavoidable, so
 * the fix is the one this project already uses for every other bounded read:
 * pick a cap, and DISCLOSE what it left out (`applyBacklog`'s bound line,
 * `applyStreamBacklog`'s `watch.backlogSome`). `FEED_CAP` and not a fresh
 * number: it is already this exact feed's own declared ceiling on how much it
 * will EVER hold, so opening with less than that wastes headroom the feed
 * would keep anyway, and inventing a smaller "opens with" number beside it
 * would be a second bound meaning the same thing `BOUND_CAP_LIST`'s own
 * docblock (below) warns against. Still ten times the mockup's `BOUND_CAP_TABLE`
 * paging convention (50) and forty times `BOUND_CAP_LIST` (20) — a deliberate
 * departure, argued above, for the one screen whose central content backfills
 * in bursts no other bounded list on this app has to survive.
 */
const BACKLOG = FEED_CAP;

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
 * **The number is `FEED_CAP`, matching `BACKLOG` above, and not
 * `BOUND_CAP_LIST` any more.** It used to be: five other bounded surfaces in
 * this app cap at `BOUND_CAP_LIST` (20), and a sixth bound invented here would
 * have been a sixth thing for the product to mean by "some". That reasoning
 * held for a stream carrying an ordinary list; it does not hold for the ONE
 * fallback a corpus with no current projection is left with, over a log whose
 * central content — lane steps — backfills in bursts this file's `BACKLOG`
 * comment measures at up to ~150 rows. A 20-record fallback left every
 * finished lane showing zero steps whenever the primary read could not answer,
 * which on an actively dogfooded corpus is routine rather than rare (`readProjection`'s
 * `absent`/`behind` states, `ui/watch-model.ts`). The two backlogs now agree on
 * one number for one reason — "how much history does this screen open with" —
 * rather than answering it twice. The whole log is still NOT replayed: 2,076
 * records into a live view would be the same defect pointed the other way,
 * which is why the stream still declares what it held back rather than
 * dropping it silently.
 *
 * **This screen no longer requests it.** `plan:live seq:1` lifted the
 * connection into the shell: `app.js` opens `/api/watch/stream` at most once,
 * ever, for every screen that ever subscribes, so the backlog size is a
 * property of the ONE connection rather than of whichever screen happens to
 * be the first to ask for it. `app.js`'s own `ensureLiveStream()` requests
 * `FEED_CAP` as a literal — it cannot import a screen module without inverting
 * the shell/screen dependency `ui/watch-model.ts`'s own docblock names for the
 * same reason (`readProjection`'s "opened READ-ONLY... exported for
 * ask-model.ts" note) — so the number is duplicated across the two files
 * rather than shared, and is kept equal by this comment rather than by import.
 */

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
 * **THE LANE GROUPING — the owner's first approved refactor, and the fix for
 * the 58%-of-the-screen row shape.**
 *
 * Measured on his live screen: 30 of 52 sampled rows were bare `subagent-stop`
 * — an opaque agent id, a `type` that is wrong on 96.4% of rows, and a
 * sentence about a seen file nobody asked about — while the `agent-dispatched`
 * row a few lines up carried that SAME lane's purpose and its real type. The
 * information existed and was not joined.
 *
 * **The join is by agent id.** `agent-dispatched`, `agent-step` and
 * `subagent-stop` each embed it in their own `note` as `agent=<id>`
 * (`core/audit.ts` · `HOOK_OPS`'s own comment states why: the two hook events
 * this trio spans, `PostToolUse` and `SubagentStop`, are shared with ordinary
 * hook rows and cannot tell a lane's rows apart from each other by event
 * alone). `agentIdOf` is the one place that note is parsed; every renderer
 * below calls it rather than re-deriving the pattern.
 *
 * **Recomputed on every `renderRows()`, never carried incrementally.** A
 * `SubagentStop` firing backfills ~150 `agent-step` rows in one burst,
 * timestamped with the TRANSCRIPT's own past instants rather than the arrival
 * instant (this file's own note on `BACKLOG` above). Tracking group
 * membership incrementally as records arrive would have to special-case that
 * burst; deriving the groups fresh from whatever `visible()` currently holds
 * does not, because it never depends on arrival order in the first place —
 * only on which ids are present.
 */
const LANE_OPS = new Set(['agent-dispatched', 'agent-step', 'subagent-stop']);

/**
 * **Which `hooks/hooks.json` EVENT wrote each op — the registered-hooks
 * panel's own vocabulary** (`TASK-the-audit-stream-does-not-show-every-hook-
 * that-is-registered`, hooks/31).
 *
 * A DUPLICATE of `core/audit.ts`'s `REGISTERED_HOOK_OPS`, under the same
 * name, not an import: a browser ES module cannot import that file — it pulls
 * in `node:fs`, `node:path` and the rest of this project's server side.
 * `test/ui/watch-registered-hooks.test.ts` holds the two to deep equality so a
 * change on one side without the other fails a test rather than drifting in
 * silence, the mitigation `test/hooks/hooks-manifest.test.ts` already applies
 * to `hooks/hooks.json` itself. See `core/audit.ts`'s own copy for the full
 * argument — why two ops per key is not an oversight, and why `manual` is
 * deliberately absent.
 */
export const REGISTERED_HOOK_OPS = {
  SessionStart: ['session-start', 'compact-restore'],
  SubagentStart: ['subagent-start'],
  PreToolUse: ['deny', 'jit', 'agent-item-waived'],
  SessionEnd: ['session-end'],
  PreCompact: ['pre-compact'],
  PostCompact: ['post-compact'],
  PostToolUse: ['post-tool-use', 'agent-dispatched'],
  PostToolUseFailure: ['post-tool-use-failure'],
  FileChanged: ['file-changed'],
  InstructionsLoaded: ['instructions-loaded'],
  ConfigChange: ['config-change'],
  PermissionDenied: ['permission-denied'],
  SubagentStop: ['subagent-stop', 'agent-step'],
  Stop: ['stop'],
  Setup: ['setup'],
  TaskCreated: ['task-created'],
  TaskCompleted: ['task-completed'],
  UserPromptExpansion: ['prompt-expansion'],
};

/**
 * The join key a dispatch, a step and a stop each carry in their own `note`
 * as `agent=<id>` — see `HOOK_OPS`'s comment in `core/audit.ts`. `null` for a
 * note that carries none, which this build never invents a value for.
 */
function agentIdOf(note) {
  if (typeof note !== 'string') return null;
  const m = /agent=([^\s:;]+)/.exec(note);
  return m === null ? null : m[1];
}

/** The agent id a record's OWN note carries, or `null` for a record outside `LANE_OPS`. */
function laneIdOf(record) {
  if (record.kind !== 'hook' || !LANE_OPS.has(record.op)) return null;
  return agentIdOf(record.note ?? null);
}

/**
 * `agent-dispatched`'s own note shape (`hooks/post-tool-use.ts` ·
 * `agentDispatchNote`): `dispatched type=<type> agent=<id>[: <description>]`.
 * Shared by the in-window group and the looked-up one, so the two cannot
 * come to parse it differently.
 */
function parseDispatchNote(note) {
  const m = /^dispatched type=(\S+) agent=\S+(?::\s(.*))?$/.exec(note ?? '');
  return {
    agentType: m !== null ? m[1] : '<absent>',
    purpose: m !== null && typeof m[2] === 'string' && m[2] !== '' ? m[2] : null,
  };
}

/**
 * This module's own unsubscribe from the shared live stream, if any.
 *
 * `plan:live seq:1` moved the CONNECTION itself into `app.js` — it is opened
 * once, ever, and outlives this screen. What is still module-level, and still
 * needed for the same reason it always was, is this SUBSCRIPTION: a screen
 * module is imported once and `render()` runs again on every return to
 * `#/watch`, so without unsubscribing the first visit's callback on the way
 * out, a second visit would leave the first visit's closures listening
 * forever and double every row that arrived.
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
  /**
   * **CHECKED against `TASK-the-preview-can-hold-two-renders-at-once-and-
   * session` on 2026-08-29, and safe on both halves — which is why this file
   * is the pattern the other three now copy rather than a site that needed
   * fixing.**
   *
   * The SUBSCRIPTION half is the block below, and it has been right since this
   * screen landed: one module-level unsubscribe, dropped at the top of every
   * `render()`. `screens/preview.js`, `screens/injected.js` and
   * `screens/simulate.js` now hold `ctx.onSessionChange`'s unsubscribe in
   * exactly this shape, and `app.js` grew one to hold because this file's
   * argument applies word for word to the other subscription a screen can have.
   *
   * The DOUBLE-RENDER half is safe structurally: every host on this screen is
   * created by the current `render()` and attached to `root` BEFORE the three
   * reads at the foot of the file, so a second render's `root.replaceChildren()`
   * detaches the first one's hosts and its late `applyBudget`/`applyVolume`/
   * `applyBacklog` write into nodes that have left the document. The rows go
   * through `renderRows()`, which is `body.replaceChildren(built)` — a REPLACE,
   * inside a synchronous function, never a clear before a request and an append
   * after it.
   *
   * A second visit must not leave the first visit's subscription listening —
   * the shared connection stays open regardless, but its callback would
   * otherwise still be closures over a screen this render just discarded.
   * Unsubscribing here rather than only on the way out also covers a reload
   * of the same route and a render that threw before it reached its own
   * teardown.
   */
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
  const filters = el('div', 'kindfilters');
  filters.id = 'wfilters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', ctx.tFlat('aria.wfilters'));
  for (const [property, value] of [
    ['display', 'flex'], ['gap', '6px'], ['flex-wrap', 'wrap'],
  ]) {
    filters.style.setProperty(property, value);
  }

  // --- The record table -----------------------------------------------------
  const plate = el('div', 'plate');
  const table = el('table');
  const head = el('thead');
  const headRow = el('tr');
  for (const key of ['th.at', 'th.kind', 'th.op', 'th.who', 'th.detail']) {
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

  // --- The lane isolation note ------------------------------------------------
  //
  // Coordinator relay, 2026-09-04: a reader can already narrow to a KIND;
  // what was missing was narrowing to a LANE — "show me only what that lane
  // did" — and grouping already joins the records this needs. Op-level
  // narrowing under `hook` was raised alongside it and left for a follow-up:
  // grouping folds most `hook` rows into their lane's one row, so a bare
  // `hook` filter may already be narrow enough once this ships, and building
  // a second control before measuring that would be guessing ahead of data.
  const laneNote = spaced(el('p', 'small'));
  laneNote.id = 'wlane';
  laneNote.hidden = true;

  // --- The live region ------------------------------------------------------
  const alive = spaced(el('p', 'small'));
  alive.id = 'alive';
  alive.setAttribute('aria-live', 'polite');

  // --- The token-void note --------------------------------------------------
  const voidNote = el('p', 'small');

  // --- The registered hooks panel --------------------------------------------
  //
  // **`TASK-the-audit-stream-does-not-show-every-hook-that-is-registered`
  // (hooks/31): the owner still did not observe every hook that has been
  // registered, after the feed's own window was raised from 20 to `FEED_CAP`.**
  // Measured, not guessed: the newest `FEED_CAP` rows of this repository's own
  // live segment are 74.5% `agent-step` and 9% `subagent-stop` — a SINGLE
  // `SubagentStop` backfill burst can be worth most of the window on its own
  // (this file's own `BACKLOG` comment already measures that burst at up to
  // ~150 rows) — so a registered hook that fires rarely can be genuinely IN
  // THE LOG and still never land inside the bounded feed above between two
  // bursts. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
  // draws the line this panel exists to hold: today a hook that never fires
  // and a hook the bounded feed crowded out look IDENTICAL — both are simply
  // absent from the table above — and a reader cannot tell "nothing happened"
  // from "something happened and this screen dropped it".
  //
  // **Answered from `/api/ask/summary?report=ops`, deliberately NOT from
  // `records` above.** That endpoint's `summaryByOp` takes no `limit` — it
  // reports every op the WHOLE projection holds, so a hook's row here does not
  // share a budget with `agent-step` the way the feed's own `records` array
  // does. It is the same projection `/api/ask/audit` already reads on this
  // screen, so the same three states apply: `fresh` answers measured; `absent`
  // (never built) and a refusal (behind, diverged, damaged) are both
  // UNMEASURED — never a zero — because "no projection has read this log yet"
  // and "the log holds nothing for this hook" are different facts.
  //
  // **The vocabulary is `REGISTERED_HOOK_OPS` above, not derived from data.**
  // Every other vocabulary this screen offers is deliberately DERIVED from
  // observed records (`learnKinds`'s own header states why: a hand-copied enum
  // goes stale in silence). That rule cannot reach this table: the whole
  // question is whether a REGISTERED hook has ever been observed, and a list
  // built only from what has been observed can never name the one row that
  // answers "never". `REGISTERED_HOOK_OPS` is hand-kept for exactly that
  // reason, and `test/ui/watch-registered-hooks.test.ts` plus
  // `test/core/audit-registered-hooks.test.ts` are what stop it going stale in
  // the silence `ask.js`'s own header names as the cost of not doing this.
  const reghSection = el('div', 'plate regh');
  const reghHead = el('h3');
  reghHead.append(...ctx.t('watch.regh'));
  const reghNote = el('p', 'small');
  reghNote.append(...ctx.t('watch.reghn', { records: num(FEED_CAP) }));
  const reghFault = errorNote('');
  reghFault.id = 'reghfault';
  reghFault.hidden = true;
  const reghTable = el('table');
  const reghHeadEl = el('thead');
  const reghHeadRow = el('tr');
  for (const key of ['th.hook', 'th.status', 'th.count', 'th.last']) {
    const cell = el('th');
    cell.append(...ctx.t(key));
    reghHeadRow.append(cell);
  }
  reghHeadEl.append(reghHeadRow);
  const reghBody = el('tbody');
  reghBody.id = 'reghtbl';
  reghTable.append(reghHeadEl, reghBody);
  reghSection.append(reghHead, reghNote, reghFault, reghTable);

  card.append(
    pulse, pulseFault, pulseNote, filters, plate, laneNote, feedBound, feedFault, alive, voidNote,
    reghSection,
  );

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
  /** Which lanes the reader has folded open, by agent id. Persists across re-renders. */
  const expandedLanes = new Set();
  /** The one lane the reader has isolated the feed to, or `null` for none. */
  let isolatedAgent = null;
  /**
   * **THE LOOKUP-BEYOND-THE-WINDOW — `TASK-a-lane-backfills-more-steps-than-
   * the-feed-window-holds-so`.**
   *
   * Measured on the live corpus: a lane's steps arrive in ONE burst at stop
   * time while its dispatch was written once at start time, so any lane
   * recording more steps than the backlog window holds is GUARANTEED to push
   * its own dispatch out of that window — 95 steps, dispatch 88 rows back,
   * window 50. Growing the window is not a fix: a longer lane defeats a
   * bigger window the same way, for the same structural reason, forever.
   *
   * So the dispatch is looked up instead, past the window, ONCE per agent id
   * and cached here — `null` for "looked up, not found" (this project's own
   * corpus measures 546 of 552 agent ids with NO dispatch record at all,
   * because the feature that writes one is newer than most of the lanes in
   * the log; a repeated lookup for those would just repeat a miss forever).
   * `agentId → AuditRecord | null`.
   */
  const resolvedDispatches = new Map();
  /** Agent ids with a lookup in flight, so a burst of renders fires it once. */
  const pendingLookups = new Set();

  /**
   * Bounded the same way every other list in this app is bounded
   * (`BOUND_CAP_TABLE`, `screens/parts.js`) — an unbounded search for one id
   * is the window defect wearing a different shape. A miss within the bound
   * is cached as a miss; it is not retried with a wider one.
   */
  function resolveDispatch(agentId) {
    if (resolvedDispatches.has(agentId) || pendingLookups.has(agentId)) return;
    pendingLookups.add(agentId);
    ctx.api(`/api/ask/audit?op=agent-dispatched&limit=${BOUND_CAP_TABLE}`)
      .then((result) => {
        const match = (result.records ?? []).find((r) => agentIdOf(r.note ?? null) === agentId);
        resolvedDispatches.set(agentId, match ?? null);
      })
      .catch(() => {
        // The lookup itself is a courtesy, not a claim this screen depends
        // on — its own refusal must not become a second one on top of
        // `feedFault`'s. Cached as a miss so it is asked once, not on every
        // render this lane is still on screen.
        resolvedDispatches.set(agentId, null);
      })
      .finally(() => {
        pendingLookups.delete(agentId);
        renderRows();
      });
  }

  /**
   * **THE LOOKUP-BEYOND-THE-WINDOW FOR STEPS — the counterpart `resolveDispatch`
   * above never grew, and closing that asymmetry is
   * `TASK-expanding-a-lane-is-dead-for-every-lane-but-the-newest`'s mandatory
   * deliverable.** A lane can recover its own HEADER from beyond the window
   * (`resolveDispatch`) but not its own CONTENTS — measured live: the newest
   * 200 records are 173 `agent-step` rows belonging to ONE lane, so every
   * other lane on screen reports zero steps and its toggle draws disabled
   * (`laneGroupRows`'s own `toggle.disabled = steps.length === 0`) whether or
   * not that lane ever recorded any.
   *
   * Same shape as `resolveDispatch`, on purpose, not a different one: an
   * in-flight guard so a burst of renders fires it once per agent id, and a
   * negative cache so a miss within the bound is asked once and not retried
   * wider. What differs is only the bound's WIDTH and what it is bounded BY.
   * A dispatch is one record per lane, so `BOUND_CAP_TABLE` (50) newest
   * `agent-dispatched` rows reaches nearly any lane's. A lane's STEPS are a
   * burst of up to ~150 rows written in one `SubagentStop` firing (`BACKLOG`'s
   * own comment, above, measures it), and this project's own corpus turned
   * out to hold thousands of them — `STEP_LOOKUP_CAP`'s own docblock has the
   * measurement that moved this off `FEED_CAP`. Filtered by `op=agent-step`
   * and not the bare feed, for the reason this whole task exists: the newest
   * N records of ANY kind can themselves be almost entirely one lane's
   * burst, so a mixed-kind window would starve every OTHER lane's lookup the
   * identical way the unbounded feed already does. Asking the endpoint for
   * `agent-step` alone spends the budget on nothing but the kind this lookup
   * exists to find.
   *
   * `agentId → AuditRecord[] | null` — `null` for "looked up, none found
   * within the bound", exactly `resolvedDispatches`'s own shape.
   */
  const resolvedSteps = new Map();
  /** Agent ids with a steps lookup in flight, so a burst of renders fires it once. */
  const pendingStepLookups = new Set();

  function resolveSteps(agentId) {
    if (resolvedSteps.has(agentId) || pendingStepLookups.has(agentId)) return;
    pendingStepLookups.add(agentId);
    ctx.api(`/api/ask/audit?op=agent-step&limit=${STEP_LOOKUP_CAP}`)
      .then((result) => {
        const match = (result.records ?? []).filter((r) => agentIdOf(r.note ?? null) === agentId);
        resolvedSteps.set(agentId, match.length > 0 ? match : null);
      })
      .catch(() => {
        // The same courtesy `resolveDispatch` states for its own catch: this
        // lookup's refusal must not become a second one on top of
        // `feedFault`'s, and a miss is cached so it is asked once per lane.
        resolvedSteps.set(agentId, null);
      })
      .finally(() => {
        pendingStepLookups.delete(agentId);
        renderRows();
      });
  }

  /**
   * **THE THREE-STATE READ — `STD-a-measured-zero-is-drawn-and-named-an-
   * unmeasured-thing-is`, applied to a lane's own step count.**
   *
   * WINDOW steps first, unchanged: a lane whose steps are already in hand
   * needs no lookup, and this never fires one for it. Only a lane reporting
   * NONE in the window asks `resolveSteps` — fired from here, the render
   * that needs the answer, exactly where `orphanGroupRows` already fires
   * `resolveDispatch` rather than from a separate pass.
   *
   * `measured` is false only while nobody has looked yet or the lookup is
   * still in flight — never once `resolvedSteps` holds an answer, whether
   * that answer was some steps or none. A lane that genuinely has none once
   * the lookup completes reads as a MEASURED zero, the same "0 steps"
   * `watch.laneSteps` already draws for a lane whose zero steps were visible
   * in the window all along; a lane nobody has asked about yet never reaches
   * that sentence — see `stepsCell`, its one call site.
   */
  function effectiveSteps(agentId, windowSteps) {
    if (windowSteps.length > 0) return { steps: windowSteps, measured: true };
    resolveSteps(agentId);
    if (!resolvedSteps.has(agentId)) return { steps: [], measured: false };
    return { steps: resolvedSteps.get(agentId) ?? [], measured: true };
  }

  /**
   * The `N steps` segment of a lane's detail cell, or the unmeasured chip in
   * its place — the one call site `laneGroupRows` and `orphanGroupRows` both
   * share so the two cannot draw this differently.
   *
   * `.chip.unmeas` with `data-g="◌"` is not invented here: it is this
   * screen's own primitive, already spent on `applyRegisteredHooks`'
   * `watch.reghUnmeasured` a few hundred lines below, under the same
   * standard. Reused rather than a third convention for the same fact.
   */
  function stepsCell(measured, effSteps) {
    if (measured) return ctx.t('watch.laneSteps', { steps: num(effSteps.length) });
    const chip = el('span', 'chip unmeas');
    chip.dataset.g = '◌';
    chip.append(...ctx.t('watch.laneStepsUnmeasured'));
    chip.title = ctx.tFlat('title.laneStepsUnmeasured');
    return [chip];
  }

  const visible = () => {
    let list = selected === 'all' ? records : records.filter((r) => r.kind === selected);
    if (isolatedAgent !== null) list = list.filter((r) => laneIdOf(r) === isolatedAgent);
    return list;
  };

  /** Shows or hides the "isolated to one lane" note, and its own clear control. */
  function renderLaneNote() {
    if (isolatedAgent === null) {
      laneNote.hidden = true;
      return;
    }
    laneNote.replaceChildren();
    laneNote.append(...ctx.t('watch.laneIsolated'));
    const clear = el('button', 'linkid m');
    clear.type = 'button';
    clear.append(...ctx.t('watch.laneClear'));
    clear.addEventListener('click', () => {
      isolatedAgent = null;
      renderLaneNote();
      renderRows();
      sayShown();
    });
    laneNote.append(' ', clear);
    laneNote.hidden = false;
  }

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
   * **`watch.regime` is the label, and it was an English literal until
   * 2026-08-30.** The design of record builds the phrase inside a
   * `HEB ? … : …` ternary in its own script, under no `data-t`, and this
   * comment gave that as the reason a key was impossible: *"`strings-parity`
   * compares both tables against the mockup's `data-t` set in BOTH
   * directions"*. It does not. It compares them in ONE direction, and has
   * since 2026-08-26 —
   * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped the
   * invented direction and the gate's docstring says so in its own words. The
   * claim above was quoted from memory, and it kept this row English under `א`
   * for three days after it stopped being true.
   *
   * `watch.sub` already carried the concept in both languages ("A focus change
   * is a regime change, drawn as a rule across the feed"); what was missing was
   * this ROW's label, which is the one a reader meets at the boundary itself.
   * The ` · ` separator stays a text node beside the translated span, for the
   * reason `screenHead`'s ✅ does: a translated element's children are replaced
   * wholesale, and a glyph nested inside one does not survive it.
   */
  function regimeRow(described, at) {
    const row = el('tr', 'regime');
    const cell = el('td');
    cell.colSpan = 5;
    const wrap = el('div', 'rw');
    const text = el('span');
    text.append(...ctx.t('watch.regime'), ' · ');
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
   * An identifier needs no translation, exactly as `SessionStart` and an item
   * id need none, and it says strictly more than the bare `ui-refused` this
   * rendered before.
   *
   * **One of the two reasons given here was wrong, and it is struck.** This
   * used to add that "`strings-parity` requires every key to exist in the
   * mockup too", so four new keys were impossible. It does not, and has not
   * since 2026-08-26 —
   * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped that
   * direction. Four keys COULD be written; they should not be, and the reason
   * is the paragraph above rather than a gate. Re-measured 2026-08-30 with the
   * rest of `plan:walk seq:92` — the refusal survived its stated cause, which
   * is what makes it worth restating rather than deleting.
   *
   * **The OTHER claim two paragraphs up is now wrong too, and THIS strikes
   * it.** "A `hook` record's primary is its `hook` field — the platform
   * event — not its `op`: the hook ops are `pre-compact`, `post-tool-use`,
   * `deny`, and none of them is the word the mockup prints" held only because
   * every hook op mapped ONE-TO-ONE onto a platform event. It stopped holding
   * on 2026-09-04, when two ops were added on events already claimed by
   * others rather than events of their own — see `HOOK_OPS`'s own comment in
   * `core/audit.ts` for the full argument, which is deliberate reuse and not
   * an oversight: `agent-dispatched` shares `PostToolUse` with the ordinary
   * `post-tool-use` op (both fire on the same widened matcher), and
   * `agent-step` shares `SubagentStop` with `subagent-stop` (both are written
   * from the same firing, one per lane and one per tool call inside it).
   *
   * A row led by the EVENT cannot tell either pair apart: an `agent-step` row
   * and a `subagent-stop` row both read bare `SubagentStop`, and an
   * `agent-dispatched` row reads `PostToolUse` — indistinguishable from an
   * ordinary tool-use hook, saying nothing about a dispatch. This is the
   * defect the owner reported as "I still cannot see the new hooks and their
   * info in the audit stream": both rows were on screen the whole time: the
   * screen could not NAME them (confirmed live with Playwright, not reasoned
   * about — see `e2e/watch-feed.spec.ts`).
   *
   * **The OP is the primary now, for every kind including `hook`.** The op is
   * what was RECORDED, and it always names a row on its own — that is the
   * whole reason `access`, `progress` and `mutation` already led with it two
   * paragraphs up; `hook` was the one kind that hid it. The EVENT has not
   * stopped being useful — `SessionStart` is genuinely the word a reader
   * wants for an injection-ish hook row, and losing the event would only
   * trade one blindness for another — so it still shows, as DETAIL right
   * after the op, in parens: `agent-step (SubagentStop)`, `agent-dispatched
   * (PostToolUse)`, `deny (PreToolUse)`. Two ops that share one event now read
   * as two different words carrying the same parenthetical, which is the one
   * shape that is both distinguishable at a glance and keeps the event a hook
   * row still owes a reader.
   */
  /**
   * **THE OP/WHO/DETAIL SPLIT — the second and third approved column, and
   * where `whatOf`'s PRIMARY — DETAIL shape (see the struck paragraphs above)
   * moves once the table has room to draw it in columns rather than in one
   * sentence.**
   *
   * `op` was already the primary word for every kind — that argument is
   * unchanged and is still exactly why it leads. What changes here is only
   * WHERE the rest lands: `who` is the row's subject — an item, a lane's
   * purpose, a check, a host — and `detail` is everything else the record
   * carries. The already-good kinds (`injection`, `mutation`,
   * `post-tool-use-failure`) keep the exact same WORDS this task's report
   * promises not to touch; only their column changes.
   *
   * Appends into `who` and `detail` directly rather than returning nodes,
   * because `access`'s `nonce-minted` needs BOTH filled from a field
   * (`nonceMint`) `describeRecord` does not carry — read off the raw
   * `record` here rather than in `lib/viewmodel.js`, which this task does not
   * own and must not edit.
   *
   * `columnsFor` is the public entry: it calls `fillColumns` and then applies
   * the ONE fallback every screen in this app already uses for a cell with
   * nothing to say (`'—'`, bare — `ask.js`, `doctor.js`, `packs.js`, `port.js`
   * and more all write it literally rather than through a key). Applied
   * AFTER, in one place, so every branch below can simply leave a cell empty
   * rather than each spelling its own dash.
   */
  function columnsFor(record, described, who, detail) {
    fillColumns(record, described, who, detail);
    if (who.childNodes.length === 0) who.append('—');
    if (detail.childNodes.length === 0) detail.append('—');
  }

  function fillColumns(record, described, who, detail) {
    if (described.kind === 'injection') {
      who.append(
        ...ctx.t('watch.delivered', { delivered: described.injected }),
        ', ',
        ...ctx.t('watch.spilled', { spilled: described.spilled.length }),
      );
      costOf(detail, described);
      return;
    }

    if (described.kind === 'access') {
      if (described.op === 'nonce-minted') {
        // No `note`, no `itemId`, no `refusal` — a mint carries `nonceMint`
        // instead (`ui/security.ts` · `recordNonceMint`), and nothing copied
        // it into `describeRecord`. This is the "no subject AT ALL" row from
        // the owner's measurement; the host it minted for is a real field
        // the record already carries and was never rendered.
        const mint = record.nonceMint;
        const host = mint !== null && mint !== undefined && typeof mint.host === 'string' && mint.host !== ''
          ? mint.host : null;
        if (host !== null) who.append(mono(host));
        const origin = mint !== null && mint !== undefined
          && typeof mint.origin === 'string' && mint.origin !== '' ? mint.origin : null;
        if (origin !== null) detail.append(mono(origin));
        return;
      }
      if (described.refusal !== null) {
        const { check, method, route } = described.refusal;
        if (typeof check === 'string' && check !== '') who.append(mono(check));
        if (typeof method === 'string' && typeof route === 'string' && route !== '') {
          detail.append(mono(`${method} ${route}`));
        }
      }
    }

    if (described.itemId !== null) who.append(linkId(described.itemId, false));

    // The hook event rides as DETAIL beside the op — the struck paragraphs
    // above's argument for why it is not the primary, kept for every hook
    // row this function still composes generically (a lane group and an
    // orphan lane row are composed by their own renderers instead, below).
    if (described.kind === 'hook' && typeof described.hook === 'string' && described.hook !== '') {
      detail.append(mono(`(${described.hook})`));
    }
    if (described.note !== null) {
      if (detail.childNodes.length > 0) detail.append(' — ');
      detail.append(bdi(described.note));
    }
    if (described.path !== null) {
      if (detail.childNodes.length > 0) detail.append(' ');
      detail.append(mono(described.path));
    }
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

    row.append(el('td', 'm small', described.op));
    const who = el('td');
    const detail = el('td', 'small');
    columnsFor(record, described, who, detail);
    row.append(who, detail);
    return row;
  }

  /**
   * **THE GROUP ROW — the owner's first approved refactor, drawn.**
   *
   * Anchored on the DISPATCH, per the hard constraint: it is the only row
   * that carries both the lane's purpose and its real agent type. `who` is
   * the purpose when the note carries one, the agent id otherwise — an
   * honest fallback, never a blank. `detail` says the type, the step count,
   * how long the lane ran (or has been running), and whether it finished —
   * which is where the raw `subagent-stop` sentence
   * (`delivery=finished agent=<id> type=<type>; its seen file was left in
   * place`) ends up: SUMMARISED, never drawn a second time verbatim.
   *
   * **A lane still running has no `stop` — rendered as running, never as
   * finished.** Its duration is measured to NOW rather than to a stop that
   * has not happened, so the number on screen keeps climbing rather than
   * freezing at the moment the group was last drawn.
   *
   * Returns an ARRAY of rows — the anchor, then each step when the lane is
   * expanded — because `renderRows` appends a fragment of rows, not a tree;
   * there is no `<tr>` that nests other `<tr>`s.
   */
  function laneGroupRows(dispatch, agentId, steps, stop) {
    const at = clockOf(dispatch.at);
    const { agentType, purpose } = parseDispatchNote(dispatch.note);
    const expanded = expandedLanes.has(agentId);
    const { steps: effSteps, measured } = effectiveSteps(agentId, steps);

    const row = el('tr', stop === null ? 'lane running' : 'lane');
    row.dataset.agent = agentId;
    row.append(el('td', 'm small', at));

    const kindCell = el('td');
    const toggle = el('button', 'lanetoggle');
    toggle.type = 'button';
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.disabled = effSteps.length === 0;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.setAttribute('aria-label', ctx.tFlat(expanded ? 'aria.laneCollapse' : 'aria.laneExpand'));
    toggle.addEventListener('click', () => {
      if (expandedLanes.has(agentId)) expandedLanes.delete(agentId);
      else expandedLanes.add(agentId);
      renderRows();
    });
    kindCell.append(toggle, kindChip('hook'));
    row.append(kindCell);

    row.append(el('td', 'm small', 'agent-dispatched'));

    // The purpose (or, honestly, the bare id) IS the lane's subject, and it
    // isolates the feed to this lane on click — the owner's second ask,
    // relayed mid-task: "let a reader filter to one lane".
    const who = el('td');
    const subject = el('button', 'linkid m');
    subject.type = 'button';
    subject.append(bdi(purpose ?? agentId));
    const isolated = isolatedAgent === agentId;
    subject.setAttribute('aria-pressed', isolated ? 'true' : 'false');
    subject.title = ctx.tFlat(isolated ? 'aria.laneClear' : 'aria.laneIsolate');
    subject.addEventListener('click', () => {
      isolatedAgent = isolatedAgent === agentId ? null : agentId;
      renderLaneNote();
      renderRows();
      sayShown();
    });
    who.append(subject);
    row.append(who);

    const detail = el('td', 'small');
    detail.append(mono(agentType), ' · ');
    detail.append(...stepsCell(measured, effSteps));
    const span = formatDuration(
      (stop !== null ? Date.parse(stop.at) : Date.now()) - Date.parse(dispatch.at),
    );
    if (span !== null) detail.append(' · ', span);
    detail.append(' · ', ...ctx.t(stop === null ? 'watch.laneRunning' : 'watch.laneFinished'));
    row.append(detail);

    const rows = [row];
    if (expanded) for (const step of effSteps) rows.push(laneStepRow(step));
    return rows;
  }

  /**
   * One folded step, drawn only while its lane is expanded. `agent-step`'s
   * own note shape (`hooks/subagent-stop.ts` · `transcriptSteps`):
   * `<tool>: <subject> agent=<id>`.
   */
  function laneStepRow(step) {
    const at = clockOf(step.at);
    const m = /^(\S+): (.*) agent=\S+$/.exec(step.note ?? '');
    const tool = m !== null ? m[1] : '<absent>';
    const subject = m !== null ? m[2] : (step.note ?? '');

    const row = el('tr', 'lanestep');
    row.append(el('td', 'm small', at));
    row.append(el('td'));
    row.append(el('td', 'm small', '└ agent-step'));
    const who = el('td');
    who.append(mono(tool));
    row.append(who);
    const detail = el('td', 'small');
    detail.append(bdi(subject));
    row.append(detail);
    return row;
  }

  /**
   * **THE ORPHAN GROUP — one row per agent id even when its dispatch is not
   * in view, fixing `TASK-a-lane-backfills-more-steps-than-the-feed-window-
   * holds-so`.**
   *
   * The join this task already wrote (agent id) does not need the dispatch
   * to fire — only the dispatch's TITLE does. So every step and stop sharing
   * one id collapses to ONE row here exactly as `laneGroupRows` collapses an
   * in-window lane, with the dispatch treated as a title that may be
   * missing rather than as the thing that licenses a group to exist. 95
   * identical `dispatch not in view` rows become one row reading 95 steps.
   *
   * **The honest unknown stays honest — it is just said ONCE now.** No
   * label is invented from the steps themselves; `resolveDispatch` is the
   * only source of a real purpose, and until it resolves (or confirms a
   * miss) this reads the bare id, exactly as the hard constraint asks.
   */
  function orphanGroupRows(agentId, steps, stop) {
    resolveDispatch(agentId);
    const resolved = resolvedDispatches.get(agentId) ?? null;
    const parsed = resolved !== null ? parseDispatchNote(resolved.note) : null;
    // The anchor is whichever of this group's own records is newest —
    // `rows` reads newest-first, so the FIRST of the steps this call was
    // handed (the stop, when there is one, is checked first: it is the
    // group's own most recent fact). There is no dispatch row to anchor on;
    // that is the whole defect this function exists to survive.
    const anchor = stop ?? steps[0];
    const at = clockOf(anchor.at);
    const expanded = expandedLanes.has(agentId);
    const { steps: effSteps, measured } = effectiveSteps(agentId, steps);

    const row = el('tr', stop === null ? 'lane running' : 'lane');
    row.dataset.agent = agentId;
    row.append(el('td', 'm small', at));

    const kindCell = el('td');
    const toggle = el('button', 'lanetoggle');
    toggle.type = 'button';
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.disabled = effSteps.length === 0;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.setAttribute('aria-label', ctx.tFlat(expanded ? 'aria.laneCollapse' : 'aria.laneExpand'));
    toggle.addEventListener('click', () => {
      if (expandedLanes.has(agentId)) expandedLanes.delete(agentId);
      else expandedLanes.add(agentId);
      renderRows();
    });
    kindCell.append(toggle, kindChip('hook'));
    row.append(kindCell);

    row.append(el('td', 'm small', stop !== null ? 'subagent-stop' : 'agent-step'));

    const who = el('td');
    const subject = el('button', 'linkid m');
    subject.type = 'button';
    subject.append(bdi(parsed !== null ? parsed.purpose ?? agentId : agentId));
    const isolated = isolatedAgent === agentId;
    subject.setAttribute('aria-pressed', isolated ? 'true' : 'false');
    subject.title = ctx.tFlat(isolated ? 'aria.laneClear' : 'aria.laneIsolate');
    subject.addEventListener('click', () => {
      isolatedAgent = isolatedAgent === agentId ? null : agentId;
      renderLaneNote();
      renderRows();
      sayShown();
    });
    who.append(subject);
    row.append(who);

    const detail = el('td', 'small');
    if (parsed !== null) detail.append(mono(parsed.agentType), ' · ');
    detail.append(...stepsCell(measured, effSteps));
    detail.append(' · ', ...ctx.t(stop === null ? 'watch.laneRunning' : 'watch.laneFinished'));
    // `laneFound` once the lookup names the dispatch, `laneNotInView` while
    // it is still unresolved OR confirmed missing — two different facts,
    // never collapsed into one sentence: the reader now knows WHO, and it is
    // still true that the dispatch row itself is not on screen.
    detail.append(' · ', ...ctx.t(resolved !== null ? 'watch.laneFound' : 'watch.laneNotInView'));
    row.append(detail);

    const built = [row];
    if (expanded) for (const step of effSteps) built.push(laneStepRow(step));
    return built;
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
    cell.colSpan = 5;
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

    // Every dispatch currently on screen, by agent id — the group's anchor,
    // and the ONLY thing that decides whether a step or a stop is grouped,
    // orphaned, or (if it names no lane at all) drawn as an ordinary row.
    // Recomputed fresh every call — see `LANE_OPS`'s own note on why this
    // does not track membership incrementally.
    const dispatchByAgent = new Map();
    for (const record of rows) {
      if (record.kind === 'hook' && record.op === 'agent-dispatched') {
        const id = agentIdOf(record.note ?? null);
        if (id !== null && !dispatchByAgent.has(id)) dispatchByAgent.set(id, record);
      }
    }
    // Steps and stops, split into the two buckets `TASK-a-lane-backfills-
    // more-steps-than-the-feed-window-holds-so` names: the dispatch's own
    // (grouped under it, as before) and the ORPHAN's — an agent id `LANE_OPS`
    // names that has NO dispatch in view. Both are keyed the same way for
    // the same reason: a long lane's burst does not care which bucket its id
    // lands in, and neither renderer below does either.
    const stepsByAgent = new Map();
    const stopByAgent = new Map();
    const orphanStepsByAgent = new Map();
    const orphanStopByAgent = new Map();
    for (const record of rows) {
      const id = laneIdOf(record);
      if (id === null || record.op === 'agent-dispatched') continue;
      const inView = dispatchByAgent.has(id);
      const steps = inView ? stepsByAgent : orphanStepsByAgent;
      const stops = inView ? stopByAgent : orphanStopByAgent;
      if (record.op === 'agent-step') {
        if (!steps.has(id)) steps.set(id, []);
        steps.get(id).push(record);
      } else if (record.op === 'subagent-stop') {
        stops.set(id, record);
      }
    }

    const built = document.createDocumentFragment();
    // Drawn only when there is something on BOTH sides of it. A rule under
    // nothing, or over nothing, separates nothing and is one more mark for a
    // reader to account for.
    let pending = rows.some((record) => live.has(record))
      && rows.some((record) => !live.has(record));
    // An orphan group is drawn ONCE, at the position of the first (newest)
    // of its own records this loop reaches — never once per step, which is
    // the defect `TASK-a-lane-backfills-...` measured as fifty identical
    // rows for one 95-step lane.
    const renderedOrphans = new Set();
    for (const record of rows) {
      const id = laneIdOf(record);
      // A step or a stop whose dispatch IS in view is drawn once, folded
      // under that dispatch — never at its own position, and never twice.
      if (id !== null && record.op !== 'agent-dispatched' && dispatchByAgent.has(id)) continue;
      // An orphan's second and later record: already drawn as part of its
      // group's one row, above, in this same loop.
      if (id !== null && record.op !== 'agent-dispatched' && renderedOrphans.has(id)) continue;

      if (pending && !live.has(record)) {
        built.append(historyBoundary());
        pending = false;
      }

      if (id !== null && record.op === 'agent-dispatched') {
        for (const groupRow of laneGroupRows(record, id, stepsByAgent.get(id) ?? [], stopByAgent.get(id) ?? null)) {
          built.append(groupRow);
        }
        continue;
      }
      if (id !== null) {
        renderedOrphans.add(id);
        for (const groupRow of orphanGroupRows(id, orphanStepsByAgent.get(id) ?? [], orphanStopByAgent.get(id) ?? null)) {
          built.append(groupRow);
        }
        continue;
      }
      built.append(rowFor(record));
    }
    body.replaceChildren(built);
    return rows.length;
  }

  /**
   * The filter row's own counts, from `records` — what the feed actually
   * holds — never from a second source that could disagree with the table
   * beside it. Called after every `remember()` batch rather than rebuilding
   * the whole filter row, because an `agent-step` burst can be ~150 records
   * arriving in one firing and a full `renderFilters()` per record would
   * rebuild eight buttons that many times over.
   */
  function updateFilterCounts() {
    const counts = new Map();
    for (const record of records) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
    for (const button of filters.querySelectorAll('button[data-k]')) {
      const kind = button.dataset.k;
      const count = kind === 'all' ? records.length : (counts.get(kind) ?? 0);
      const badge = button.querySelector('.cnt');
      if (badge !== null) badge.textContent = num(count);
    }
  }

  /**
   * One filter button per member of `AUDIT_KINDS`, **derived and never
   * written down** — the mockup's own standing instruction, and its own reason:
   * a hand-copied enum goes stale in silence, and this one already did (`access`
   * and `progress` landed in `core/audit.ts` after the card was drawn and
   * nothing came back to redraw them).
   *
   * `All` is the only prose here and is the only thing keyed.
   *
   * **Each button also carries its own count, in `.cnt`** — the coordinator's
   * relay of the owner's measurement: a corpus that is 62% one kind cannot be
   * narrowed by kind alone, and a button that can never do anything (`progress`,
   * never once fired on the measured corpus) is noise a reader learns to
   * ignore. A count turns that zero from a mystery into a fact, without
   * removing the button — `progress` and `focus` stay offered, correctly,
   * because a kind that has not happened YET is not a kind that cannot.
   * `.cnt` is the product's own count pill, already spent elsewhere (Coverage
   * gaps, Doctor) — no new class for this task to invent.
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
      button.append(' ', el('span', 'cnt', '0'));
      filters.append(button);
    }
    updateFilterCounts();
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
  // (`core/config.ts` · `  pinned: 6000, jit: 6000, restored: 8000, continuity: 2000, index: 1200,` · ~93)
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

  // ── THE REGISTERED HOOKS PANEL ───────────────────────────────────────────
  //
  // `hooks/31`. `report=ops` answers every op the WHOLE projection holds —
  // `summaryByOp` takes no `limit` — so this table shares no budget with the
  // bounded feed above and a rare hook cannot be crowded out of IT the way it
  // can be crowded out of `records`.
  function applyRegisteredHooks(summary) {
    reghFault.hidden = true;
    // `fresh` is the only state a measurement can be trusted from. `absent` —
    // no projection has ever been built — is UNMEASURED, exactly as
    // `applyVolume` above reads it, and never a zero: reading it as zero
    // would report "this hook never fired" over a log this endpoint has not
    // read.
    const measured = summary.projectionState === 'fresh';
    const byOp = new Map();
    if (measured) {
      for (const row of summary.rows ?? []) byOp.set(row.label, row);
    }
    const rows = Object.keys(REGISTERED_HOOK_OPS).map((hookName) => {
      if (!measured) return { hookName, measured: false, count: 0, last: null };
      let count = 0;
      let last = null;
      for (const op of REGISTERED_HOOK_OPS[hookName]) {
        const row = byOp.get(op);
        if (row === undefined) continue;
        count += row.count;
        if (row.last !== null && (last === null || row.last > last)) last = row.last;
      }
      return { hookName, measured: true, count, last };
    });
    renderRegisteredHooks(rows);
  }

  function failRegisteredHooks(error) {
    // The projection is behind, diverged or damaged — still not the same fact
    // as "this hook never fired", so every row is drawn UNMEASURED rather
    // than left off the table or drawn as a zero.
    reghFault.textContent = error.message;
    reghFault.hidden = false;
    renderRegisteredHooks(Object.keys(REGISTERED_HOOK_OPS).map((hookName) => (
      { hookName, measured: false, count: 0, last: null }
    )));
  }

  function renderRegisteredHooks(rows) {
    const built = [];
    for (const row of rows) {
      const tr = el('tr');
      const hookCell = el('td');
      hookCell.append(mono(row.hookName));
      const statusCell = el('td');
      if (!row.measured) {
        // `.chip.unmeas` — the strip's own primitive for exactly this state
        // (`screens/doctor.js`'s `noRepairChip`, `app.js`'s `stateChip`), so a
        // reader who has already learned that glyph elsewhere on this product
        // reads it the same way here.
        const chip = el('span', 'chip unmeas');
        chip.dataset.g = '◌';
        chip.append(...ctx.t('watch.reghUnmeasured'));
        chip.title = ctx.tFlat('title.reghUnmeasured');
        statusCell.append(chip);
      } else {
        // Neutral in both directions — `chip ok` for a measured zero as much
        // as for a measured count, because "never fired" is frequently the
        // CORRECT state (`SessionEnd` only fires on `/clear`) and is not a
        // fault this chip's colour may claim.
        const chip = el('span', 'chip ok');
        chip.dataset.g = '●';
        chip.append(...ctx.t(row.count === 0 ? 'watch.reghNever' : 'watch.reghSeen'));
        statusCell.append(chip);
      }
      const countCell = el('td');
      countCell.append(mono(row.measured ? num(row.count) : '—'));
      const lastCell = el('td');
      lastCell.append(mono(row.last !== null && row.last !== undefined ? clockOf(row.last) : '—'));
      tr.append(hookCell, statusCell, countCell, lastCell);
      built.push(tr);
    }
    reghBody.replaceChildren(...built);
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
    updateFilterCounts();
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
    updateFilterCounts();
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

  // ── THE FOUR READS, IN PARALLEL AND APPLIED IN ORDER ─────────────────────
  //
  // **Parallel because they are independent, and because a screen that settles
  // four times settles wrongly.** They were sequential, which cost two things.
  // The first is plain: four local reads taken one after another is four
  // round trips of blank screen where one would do. The second is what actually
  // failed — `e2e/screen-parity.spec.ts` decides a screen has finished
  // rendering when two element counts 400ms apart agree, and a screen that
  // grows in separate steps can sit still across that window with a fetch
  // still in flight. It sampled a half-drawn Audit stream under the full
  // suite's parallel load and reported the graphic missing. One await, one
  // settle.
  //
  // APPLIED in a fixed order regardless of which resolves first: the budget
  // before the backlog, because a row's token bar is drawn against it and a
  // bar rendered before the denominator arrived would be a different bar. The
  // registered-hooks summary is last because nothing else on this screen reads
  // from it.
  //
  // `allSettled` and not `all`: these four refuse independently — a stale
  // projection takes the pulse, the backlog and the summary while the config
  // still answers — and `all` would discard three good answers because the
  // fourth failed.
  const [config, volume, backlog, regh] = await Promise.allSettled([
    ctx.api('/api/config'),
    ctx.api(`/api/watch/volume?minutes=${PULSE_MINUTES}&bucket=${PULSE_BUCKET_SECONDS}`),
    ctx.api(`/api/ask/audit?limit=${BACKLOG}`),
    ctx.api('/api/ask/summary?report=ops'),
  ]);
  if (config.status === 'fulfilled') applyBudget(config.value);
  else voidNote.replaceWith(errorNote(config.reason.message));
  if (volume.status === 'fulfilled') applyVolume(volume.value);
  else failVolume(volume.reason);
  if (regh.status === 'fulfilled') applyRegisteredHooks(regh.value);
  else failRegisteredHooks(regh.reason);
  if (backlog.status === 'fulfilled') applyBacklog(backlog.value);
  else failBacklog(backlog.reason);
  sayShown();

  // ── THE LIVE STREAM ──────────────────────────────────────────────────────
  //
  // `plan:live seq:1`: this screen no longer opens its own connection. It
  // subscribes to the SHELL's one connection instead, asking for `'*'` — every
  // record kind, known or not — because this is the one screen in the product
  // that draws all seven of them (`KIND_HUE`/`KIND_CHIP` above already handle
  // an unaccounted kind rather than dropping it, which is what makes `'*'`
  // honest here rather than a guess at a closed list). `hello`, `resync` and
  // `fault` reach every subscriber regardless of `kinds` — see `app.js`'s
  // `dispatchLiveEvent` — so this screen still sees exactly the frames it
  // always did; only who opened the fetch changed.
  const stop = ctx.subscribeStream('*', (event, data) => {
    const described = describeStreamEvent(event, data);
    if (described.kind === 'record') {
      if (described.record === null) return;
      learnKinds([described.record.kind]);
      if (remember(described.record, true)) {
        updateFilterCounts();
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
  });
  // `subscribeStream` has no `onEnd` — an ended stream is not this screen's
  // to report. It reaches this callback as `fault` (handled above, `faulted`
  // set and said), and the connection dying at the network level is a global
  // state the shell answers globally, with `#exited` and the `mycontext ui`
  // remedy; a second, quieter claim here would be a screen guessing at why.
  // Nothing reconnects, ever (spec §2).

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
