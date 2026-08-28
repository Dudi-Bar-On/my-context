// src/ui/public/app.js — the shell: bootstrap, heartbeat, i18n, router, exit
// banner. A plain browser ES module, loaded by index.html's
// `<script type="module" src="/app.js">`. No types, no bundler, no build
// step — this file's own bytes are what the browser runs.
//
// ── THE SCREEN CONTRACT (Tasks 17-19 and plans 2/3 build against this) ─────
//
//   1. Register a loader in SCREENS below, keyed by the mockup's `data-p`
//      value — `#/gaps` and a future `<section data-p="gaps">` read the same
//      identifier twice (§0.2). The loader is `() => import('/screens/x.js')`
//      — a dynamic import per screen, not a static one, so one screen's
//      module error cannot take the shell down with it.
//   2. Add the screen's name into exactly one of the four NAV groups, in the
//      mockup's own order (nav.inj / nav.ev / nav.ch / nav.read). Plans 2 and
//      3 add INTO these four groups; neither adds a fifth (§0.4).
//   3. Add the rail label under `s.<name>` and, if the group is new content,
//      whatever screen-body keys it needs, to BOTH src/ui/public/strings/en.js
//      and he.js, at the same key, same slot shape — strings-parity.test.ts
//      enforces this both ways.
//   4. Export `render(root, ctx)` from the screen module. `route()` awaits the
//      dynamic import, then calls `mod.render(root, window.myctx)` — `root`
//      is `<main id="screen">` itself (already cleared), `ctx` is the object
//      built in `main()` below:
//
//        ctx.api(path)              GET, token-headered, JSON-parsed;
//                                    throws on any refusal or network failure
//                                    (see api() below for exactly what).
//        ctx.post(path, body)       POST, and THE SAME DOOR as api(): same
//                                    token header, same refusal handling, same
//                                    JSON parse, same throw. `body` is any
//                                    JSON-encodable value; it is stringified
//                                    and sent as application/json. Omit it and
//                                    the request carries no body at all — an
//                                    empty POST, not `"undefined"`.
//                                    Both are request() below, which is where
//                                    the credential and the refusal live ONCE.
//        ctx.subscribeStream(kinds, onEv)
//                                    The shell's ONE live connection
//                                    (`/api/watch/stream`), fanned out by
//                                    RECORD KIND — never by screen name.
//                                    `kinds` is an array of `AuditKind`
//                                    strings this screen wants `record`
//                                    frames for, or `'*'` for every kind,
//                                    known or not. `hello`/`resync`/`fault`
//                                    are facts about the STREAM, not about
//                                    one record's kind, so every subscriber
//                                    hears those regardless of `kinds` —
//                                    including a `fault` that happened
//                                    before this screen subscribed at all.
//                                    Returns unsubscribe(); the connection
//                                    itself outlives every screen and is
//                                    torn down only with the page (never
//                                    per-screen — plan:live seq:1). See
//                                    "THE SHARED LIVE STREAM" below.
//        ctx.t(key, subs)           Node[] — the ONLY renderer. Append it:
//                                    `el.append(...ctx.t(key, vals))`. Never
//                                    assign with textContent/innerHTML (owner
//                                    ruling A1, §0.6 — see lib/i18n.js).
//        ctx.tFlat(key, subs)       string — attribute/text-only sinks ONLY
//                                    (aria-label, title, an <option> label).
//                                    Reaching for this to fill an element is
//                                    the bug; ctx.t() is what fills one.
//        ctx.lang                   'en' or 'he' — this page's OWN table.lang,
//                                    for the rare case a screen has to tell the
//                                    SERVER which language it is rendering in
//                                    rather than render a translated string
//                                    itself. `lib/command-actions.js` is the
//                                    first: the execute confirm's residual
//                                    (§6.3) is a security sentence kept OUT of
//                                    the string tables on purpose (Task 8b), so
//                                    it travels as a query parameter instead.
//        ctx.session()              the current session id, or 'cold'.
//        ctx.onSessionChange(fn)    fn(sessionId) on every future change.
//        ctx.navigate(hash)         sets location.hash (triggers the router).
//
//   A screen throwing during render() is NOT caught here — per spec §6 the
//   DOM glue (this file and screens/*.js) is untested and deliberately so;
//   a screen's own render() is where its error handling, if any, belongs.
//
// ── WHAT THIS TASK DID NOT WIRE, AND WHY (see this task's report) ──────────
//
//   #focusbtn/#sessbtn open no popup: the mockup's #focuspop/#sesspop dialogs
//   have no markup in this task's index.html (an "unowned" surface, the same
//   shape as the item-detail pane and provenance bar — plan §0.2 items 4-5),
//   and building one here would be inventing UI the mockup names only as a
//   target id, never as markup this task owns. loadSessions() below still
//   computes and exposes the real default/cold session (ctx.session()) so a
//   later task can wire the popup without re-deriving that logic.

import { extractNonce, exchangeNonce } from '/lib/bootstrap.js';
import { startHeartbeat } from '/lib/heartbeat.js';
import { applyLanguage, pickLanguage, t as translate, tFlat as flat } from '/lib/i18n.js';
// The pane's WIDTH — a preference, remembered per browser. Its own module for
// spec §6's reason: the rule (what a drag means, which stored values are
// widths, what a keystroke does) is testable without a browser, and only the
// wiring below is not.
import { installPaneResize } from '/lib/pane-resize.js';
// The ONE markdown renderer. The Docs screen owns it because Docs was the
// first screen that needed one; the item pane is the second, and a second
// implementation of "turn corpus text into nodes safely" is the last thing
// this product should grow — that renderer is already the thing
// `e2e/runs.spec.ts` points at when it asserts the page SHOWS a script tag
// rather than running one.
import { markdownNodes } from '/screens/docs.js';
// The rail's Coverage-gaps badge counts the SAME directories the gaps table
// lists, through the same function. See `paintRailCounts` for why the count is
// derived here rather than served as a number by `/api/status`.
import { buildTree, coverageGaps } from '/lib/viewmodel.js';
// The shared live stream's backlog size — see "THE SHARED LIVE STREAM" below.
// Reused rather than respelled: `watch.js` requested exactly this many records
// on connect for as long as the stream has existed, and the shell opening the
// ONE connection now is the same request, made once instead of once per visit.
import { BOUND_CAP_LIST } from '/screens/parts.js';

const SCREENS = {
  preview: () => import('/screens/preview.js'),
  coverage: () => import('/screens/coverage.js'),
  gaps: () => import('/screens/gaps.js'),
  simulate: () => import('/screens/simulate.js'),
  injected: () => import('/screens/injected.js'),
  doctor: () => import('/screens/doctor.js'),
  decay: () => import('/screens/decay.js'),
  graph: () => import('/screens/graph.js'),
  status: () => import('/screens/status.js'),
  learn: () => import('/screens/learn.js'),
  watch: () => import('/screens/watch.js'),
  // The six screens whose endpoints already existed, built in parallel on
  // 2026-08-23 and registered here at the merge rather than ahead of it.
  //
  // Registering a loader before its module lands does two bad things at once:
  // the route 404s on click, and the rail's PROPOSED badge — computed from
  // `Object.hasOwn(SCREENS, name)` in renderNav() — disappears, so the shell
  // claims a screen is built while it is still being written. The badge is
  // the honest half of this object, and it is only honest if these lines and
  // the files arrive together.
  ask: () => import('/screens/ask.js'),
  work: () => import('/screens/work.js'),
  palette: () => import('/screens/palette.js'),
  config: () => import('/screens/config.js'),
  docs: () => import('/screens/docs.js'),
  tut: () => import('/screens/tut.js'),
  // The last four, 2026-08-23. Their read models were built the day before and
  // wired in the same merge, which is what unblocked them: until then these
  // were the only four screens in the mockup with no endpoint at all behind
  // them. TWENTY-ONE OF TWENTY-ONE.
  capture: () => import('/screens/capture.js'),
  proc: () => import('/screens/proc.js'),
  port: () => import('/screens/port.js'),
  packs: () => import('/screens/packs.js'),
};
// FOUR groups, by TENSE, and ALL TWENTY-ONE SCREENS, in the mockup's own
// order (`web-ui-mockup.html` ~1260-1290).
//
// It used to list only the ten screens that were built, which is why the rail
// showed 10 entries against the mockup's 21 and read as a different product.
// Hiding a screen because its content is not written yet tells the reader the
// product is smaller than it is; the mockup answers this itself, and the
// answer is `<span class="prop">PROPOSED</span>` — it badges `proc`,
// `port` and `packs` exactly that way. So every screen is listed, and the
// ones with no module behind them carry that badge.
//
// The list is spelled here rather than derived from SCREENS, deliberately:
// derived, a screen would silently leave the rail the moment its import broke,
// and the rail is how a person learns what exists.
const NAV = [
  ['nav.inj', ['preview', 'coverage', 'gaps', 'simulate', 'injected']],
  ['nav.ev', ['watch', 'ask', 'doctor', 'decay', 'graph', 'status']],
  ['nav.ch', ['work', 'capture', 'palette', 'config', 'proc', 'port', 'packs']],
  ['nav.read', ['docs', 'tut', 'learn']],
];

let token = null;
/** The disconnected banner is said ONCE, not once per pane. Twenty screens each
 *  reporting the same dead credential is noise; the state is one fact. */
let disconnectedShown = false;

/**
 * The token, for as long as this tab lives.
 *
 * NOT localStorage: a token that outlives the tab outlives the server that
 * issued it, and the next `mycontext ui` mints a different one — so a stored
 * token would be stale far more often than it was useful. sessionStorage dies
 * with the tab, which is the same lifetime the in-memory token already had,
 * plus reloads.
 *
 * A stale token — the server restarted while the tab stayed open — is not a
 * silent failure: the first `/api` call refuses, `forgetToken()` clears it,
 * and the exit banner says the server this page was talking to is gone. That
 * is true, and it is what the banner is for.
 */
const TOKEN_KEY = 'myctx-token';

function rememberToken(value) {
  try { sessionStorage.setItem(TOKEN_KEY, value); } catch { /* private mode: memory only */ }
}

function rememberedToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function forgetToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* nothing to forget */ }
}
let table = null;
let sessionValue = 'cold';
/**
 * **"No credential" and "cold" are two different facts, and `sessionValue`
 * alone cannot tell them apart.** `data.sessions.length === 0` is a real,
 * authenticated answer — an empty ledger — and `sessionValue` lands on
 * `'cold'` for it below, correctly. A `loadSessions()` that never GOT an
 * answer — the 401 a bare URL draws, per `KNOWN-the-bare-server-url-...` —
 * leaves `sessionValue` at this same initial `'cold'` too, because the
 * assignment below never runs. One string, two causes, and this project's own
 * `STD-a-measured-zero-is-drawn-and-named` is exactly the standard against
 * confusing them.
 *
 * So this starts `true` — no read has succeeded yet — and only `loadSessions()`
 * ever clears it, on the one branch that means a credential actually worked.
 * `route()` reads it to decide whether the reader is owed the explanation
 * `sess.nocred` carries; nothing else consults it, which is the whole of "not
 * a parallel state machine" — one bit, set where `sessionValue` already is.
 */
let noCredential = true;
const sessionListeners = [];

// Takes NODES, because translate() returns nodes: a string cannot carry the
// isolated runs the string tables mark, and flattening one on screen is the
// defect the mockup records as shipped (§0.6). The mockup's exit banner
// carries a msg, a literal restart command and an OK dismiss
// (docs/design/web-ui-mockup.html ~2245-2248); OK only hides the banner —
// there is nothing to reconnect to (spec §2).
function banner(...nodes) {
  const el = document.getElementById('exited');
  el.replaceChildren(...nodes);
  el.hidden = false;
}

/**
 * **"Not connected" — said out loud, with a button that fixes it.**
 *
 * Owner instruction, 2026-08-23: *"the user should be known that currently the
 * server is not connected and needs to be refreshed."*
 *
 * Until now a page whose credential had died said NOTHING. Every pane rendered
 * its own `403`, which reads as twenty broken screens rather than one dead
 * token, and the only banner this shell had says "The server has exited" — which
 * is FALSE here and the more misleading for being confident: the server is
 * listening, healthy, and refusing this tab specifically.
 *
 * The message has to be true in both halves of that state, because the page
 * cannot tell them apart from a refusal alone. A stale sessionStorage token
 * against a LIVE server is fixed by exactly what it says — the reload drops the
 * dead token and the cookie carries the tab. A server that was RESTARTED has
 * never issued this browser anything, so no refresh can conjure a credential,
 * and the honest second clause points at the link it printed. One sentence
 * covers both without claiming more than it knows.
 *
 * The refresh button reloads rather than re-fetching: a reload re-runs `main()`,
 * which reads the cleared storage, sends nothing, and lets the browser attach
 * the cookie — the whole recovery, in the one gesture a reader would try first.
 */
function showDisconnected() {
  if (disconnectedShown) return;
  disconnectedShown = true;
  const msg = document.createElement('span');
  msg.append(...translate(table.strings, 'ex.stale'));
  const refresh = document.createElement('button');
  refresh.className = 'icon';
  refresh.append(...translate(table.strings, 'btn.refresh'));
  refresh.onclick = () => { location.reload(); };
  banner(msg, refresh);
}

/* ══ ITEM DETAIL PANE ═══════════════════════════════════════════════════════
 *
 * **Every `button.linkid` in this product was inert.** `parts.js`'s linkId()
 * has written them since Task 16 and its header has said all along that "the
 * shell owns the pane and delegates from the document, exactly as the mockup
 * does, and a second listener here would open it twice" — a division of labour
 * where one half was never built. So an id rendered as a button, hovered like a
 * link, and did nothing. The owner reported it twice.
 *
 * Delegated from `document` rather than bound per button, which is not a
 * micro-optimisation: every screen rebuilds its own subtree on every route and
 * on every language change, so per-button listeners would have to be re-bound
 * by twenty-one screens and one of them would forget. A document listener
 * cannot go stale, and it is why linkId() was told not to bind its own.
 */

/** The pane's own elements, looked up once. `null` until the shell is parsed. */
function paneEls() {
  return {
    aside: document.getElementById('pane'),
    id: document.getElementById('paneid'),
    title: document.getElementById('panetitle'),
    type: document.getElementById('panetype'),
    status: document.getElementById('panestatus'),
    tier: document.getElementById('panetier'),
    scope: document.getElementById('panescope'),
    gov: document.getElementById('panegov'),
    file: document.getElementById('panefile'),
    body: document.getElementById('panebody'),
    spark: document.getElementById('panespark'),
    spn: document.getElementById('panespn'),
    float: document.getElementById('panefloat'),
  };
}

/**
 * **Floating is a MODE, and the width is a PREFERENCE. That is the whole
 * design and it is what decides where each of them lives.**
 *
 * Somebody who has hit a 4,000-word rule wants the screen for a moment and
 * wants their layout back afterwards — so this is a class on `.app` and
 * NOTHING is written down. A float that survived a reload, or a route change,
 * would greet the next reader with a page-covering panel they never asked for.
 * The width, by contrast, is somebody reading item after item who wants the
 * pane wider and wants it to STAY: `lib/pane-resize.js` stores that one.
 *
 * `classList.add`/`remove` rather than `toggle(name, on)`, because that is the
 * pair every other class change in this file uses and the two behave
 * identically here.
 */
function setPaneFloat(on) {
  const app = document.getElementById('app');
  if (app === null) return;
  if (on) app.classList.add('pane-float');
  else app.classList.remove('pane-float');
  // The button reports its own state, so the control announces "pressed" while
  // the pane is floating rather than silently changing what it does.
  paneEls().float?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

/** Floating right now? Read off `.app`, which is the one place the mode lives. */
function paneIsFloating() {
  return document.getElementById('app')?.classList.contains('pane-float') === true;
}

/**
 * The sparkline's summary sentence, in the reader's language.
 *
 * **Transcribed, not keyed, and that is forced rather than chosen.** The
 * mockup builds this sentence inside its own script as a `HEB ? … : …`
 * ternary and declares no `data-t` for it, so no key exists — and
 * `strings-parity` holds both tables equal to the mockup's `data-t` set in
 * BOTH directions, so inventing `pane.spn` would fail as an invented string.
 * The same treatment `parts.js`'s `TIERCHIP` gives a tier name.
 *
 * Both languages are carried because the mockup carries both. Where the mockup
 * offers only English (the gate-ladder descriptions, the ribbon hints) this
 * app draws English; here it does not have to, and a Hebrew reader gets
 * Hebrew. Filed as part of the "prose the mockup builds in script" family —
 * `plan:screens seq:1s-b`.
 */
function sparkSentence(weeks, spillw, he) {
  let lastIdx = -1;
  weeks.forEach((v, i) => { if (v > 0) lastIdx = i; });
  if (lastIdx < 0) {
    return he ? 'לא נמסר באף אחד מ‑12 השבועות.' : 'Not delivered in any of the twelve weeks.';
  }
  const ago = weeks.length - 1 - lastIdx;
  const spills = spillw.length;
  if (he) {
    return `נמסר לאחרונה ${ago ? `לפני ${ago} שבועות` : 'השבוע'}. ${spills} שפיכות בחלון הזה.`;
  }
  const when = ago === 0 ? 'this week' : `${ago} week${ago === 1 ? '' : 's'} ago`;
  return `Last delivered ${when}. ${spills} spill${spills === 1 ? '' : 's'} in that window.`;
}

/**
 * Draw the twelve-week delivery sparkline, or say why there is none.
 *
 * Three marks and they are three different facts, which is the whole reason
 * this takes two series rather than one: a bar is GOLD for a week with
 * deliveries, `.dead` grey for a week with none, and `.sp` hatched for a week
 * the item was SPILLED. The mockup's own comment is the rule — "a quiet week
 * and a rejected week must never look alike" — and an item can be spilled in a
 * week it was also delivered in, so `.sp` wins the mark and the height still
 * reports the deliveries.
 *
 * **A refusal and an empty history are not the same answer.** `weeks: null` is
 * the ABSENT projection: nothing has read the log, so twelve grey bars would
 * assert twelve measured quiet weeks. It says so instead
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). A BEHIND
 * or damaged projection never reaches here — the endpoint refuses and the
 * catch below reports that refusal in the endpoint's own words.
 */
function drawSpark(els, data, he) {
  if (els.spark === null || els.spn === null) return;
  els.spark.replaceChildren();
  els.spn.textContent = '';

  const weeks = data?.weeks ?? null;
  if (weeks === null) {
    els.spn.textContent = he
      ? 'אין היסטוריה מוקרנת לפריט הזה.'
      : 'No projected history for this item.';
    return;
  }
  const spillw = data.spillw ?? [];
  const max = Math.max(...weeks, 1);
  weeks.forEach((v, i) => {
    const bar = document.createElement('i');
    if (spillw.includes(i)) bar.className = 'sp';
    else if (v === 0) bar.className = 'dead';
    bar.style.setProperty('block-size', `${Math.max(5, (v / max) * 100)}%`);
    bar.title = `${he ? 'שבוע ' : 'week '}${i + 1} · ${v}${he ? ' מסירות' : ' delivered'}`
      + (spillw.includes(i) ? (he ? ' · נשפך' : ' · spilled') : '');
    els.spark.append(bar);
  });
  els.spn.textContent = sparkSentence(weeks, spillw, he);
}

/** The id currently shown, so clicking the same id twice does not re-fetch. */
let paneId = null;

/**
 * Close it, and give the grid its two columns back.
 *
 * `.app.pane-open` is what widens the layout to three columns (styles.css
 * ~310, byte-identical to the mockup). Hiding the aside WITHOUT dropping that
 * class would leave a 330px empty column on the right — the pane would be
 * invisible and still taking a third of the screen.
 */
function closePane() {
  const { aside } = paneEls();
  if (aside === null) return;
  aside.hidden = true;
  document.getElementById('app')?.classList.remove('pane-open');
  // The float goes with it, and this line is why `route()` needs only the one
  // `closePane()` call to discard the mode as well as the pane. Left behind, a
  // `pane-float` on a closed pane is a two-column grid still wearing a fixed
  // panel's rules — and the button would still claim to be pressed. The
  // remembered WIDTH is deliberately NOT cleared here: navigation discards a
  // mode and keeps a preference (`test/ui/pane-route.test.ts`).
  setPaneFloat(false);
  paneId = null;
}

/**
 * Fill the pane from `/api/item/:id` and show it.
 *
 * Everything the `<dl>` needs is served: `item` carries type, status, scope and
 * the source file, `injection` carries the verdict phrase the `governs` row
 * shows. The mockup's twelve-week sparkline is NOT drawn, and that is a
 * refusal rather than an omission — `read-model.ts` states in its own words
 * that `Usage` is a count and "a count cannot carry the spilled state at all"
 * (~1433). An empty chart would claim a history was measured.
 *
 * A failure REPLACES the pane's contents rather than leaving the previous
 * item's values under a new id, which is the shape of wrongness that is worst
 * here: the reader would be looking at one id's header above another id's
 * fields with nothing saying so.
 */
async function openPane(id) {
  const els = paneEls();
  if (els.aside === null) return;
  if (paneId === id && !els.aside.hidden) return;

  els.aside.hidden = false;
  document.getElementById('app')?.classList.add('pane-open');
  paneId = id;

  // The id and a holding state go up FIRST. The fetch is a round trip, and a
  // pane that opens empty and fills later reads as broken for exactly as long
  // as the request takes.
  els.id.textContent = id;
  els.title.textContent = '';
  for (const key of ['type', 'status', 'tier', 'scope', 'gov', 'file']) els[key].textContent = '…';
  els.body.replaceChildren();
  els.spark?.replaceChildren();
  if (els.spn !== null) els.spn.textContent = '';

  let data;
  try {
    data = await api(`/api/item/${encodeURIComponent(id)}`);
  } catch (err) {
    // The id is kept on screen: it is the one thing known to be true, and it
    // tells the reader WHICH click failed.
    els.title.textContent = err instanceof Error ? err.message : String(err);
    for (const key of ['type', 'status', 'tier', 'scope', 'gov', 'file']) els[key].textContent = '—';
    paneId = null;
    return;
  }

  // Guard against an out-of-order response: two fast clicks can land in the
  // wrong order, and the later request is not necessarily the later answer.
  if (paneId !== id) return;

  const item = data.item ?? {};
  els.id.textContent = item.id ?? id;
  els.title.textContent = item.title ?? '';
  els.type.textContent = item.type ?? '—';
  els.status.textContent = item.status ?? '—';
  // Tier is not on the item — it is a property of the item's CATEGORY, and the
  // endpoint does not send it. Severity is what the item itself carries and is
  // the honest value for this row until the endpoint sends the tier.
  els.tier.textContent = item.severity ?? '—';
  els.scope.textContent = Array.isArray(item.scope) && item.scope.length > 0
    ? item.scope.join(', ')
    : '—';
  els.gov.textContent = data.injection?.phrase ?? '—';
  // `filePath`, the item's OWN file — which is what the design of record shows
  // in this row (`items/constraint/CONST-postgres-pool-capped-at-20.md`).
  //
  // It read `item.source_file` until 2026-08-25, and that was wrong twice over.
  // `source_file` is not a field on the wire in ANY case — the payload spells
  // it `sourceFile` — so the row rendered `—` for every item ever opened, not
  // merely for un-ingested ones. And even spelled correctly it is the wrong
  // fact: `sourceFile` is INGEST PROVENANCE, the document an item was ingested
  // from, and it is null for every hand-authored item. Two bugs that hid each
  // other, and neither is visible to a parity gate — the `<dd>` is present,
  // correctly classed, and holds a plausible dash.
  els.file.textContent = item.filePath ?? '—';

  // `<bdi>` because a body is corpus text in an unknown direction, sitting in
  // a page whose direction is the product's. That is the whole point of the
  // well, and `pane.well` is the caption that says so.
  const bdi = document.createElement('bdi');
  // `.nodes`, not the return value. It answers `{ nodes, refusals }` — spread
  // bare it is not iterable, and the TypeError lands AFTER the `<dl>` is
  // already filled, so the pane shows every field correctly and silently keeps
  // the previous item's body. Caught by `e2e/item-pane.spec.ts` asserting the
  // `<bdi>` is attached rather than assuming the append worked.
  bdi.append(...markdownNodes(item.body ?? '', document).nodes);
  els.body.replaceChildren(bdi);

  // The history is a SECOND request, and deliberately so: it reads the audit
  // projection, which can refuse when the corpus itself cannot. Folding it
  // into `/api/item/:id` would make the whole pane share the weakest store it
  // touches — a behind projection would cost the reader the `<dl>` as well as
  // the chart. Awaited after the pane is already filled, so the fields are on
  // screen while this lands.
  const he = document.documentElement.getAttribute('lang') === 'he';
  try {
    const history = await api(`/api/item/${encodeURIComponent(id)}/history`);
    if (paneId !== id) return;
    drawSpark(els, history, he);
  } catch (err) {
    if (paneId !== id) return;
    // The endpoint's own refusal, in its own words — the treatment `errorNote`
    // gives every server refusal in this product. A projection that is behind
    // says so here rather than showing a chart of nothing.
    drawSpark(els, null, he);
    if (els.spn !== null) els.spn.textContent = err instanceof Error ? err.message : String(err);
  }
}

/**
 * The document-level delegation, installed once.
 *
 * `closest` rather than a target test, because a linkid contains two spans
 * (`.idkind` and `.idslug`) and a click almost always lands on one of them
 * rather than on the button itself.
 */
function installItemPane() {
  document.addEventListener('click', (event) => {
    const close = event.target.closest?.('#paneclose');
    if (close !== null && close !== undefined) { closePane(); return; }
    // Checked BEFORE `[data-id]`, like the close button and for the same
    // reason: both live inside the pane, and the pane is drawn on screens whose
    // rows are themselves `[data-id]` — a float click that fell through to the
    // link branch would re-open a pane instead of expanding it.
    const float = event.target.closest?.('#panefloat');
    if (float !== null && float !== undefined) { setPaneFloat(!paneIsFloating()); return; }
    const link = event.target.closest?.('[data-id]');
    if (link === null || link === undefined) return;
    const id = link.dataset.id;
    if (typeof id !== 'string' || id === '') return;
    void openPane(id);
  });
  // Escape closes it, the same gesture the popovers already answer to
  // (`e2e/keyboard.spec.ts` asserts that contract for those).
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // **Escape steps back ONE level.** One un-floats, a second closes. The
    // alternative — one Escape dismissing both at once — is the gesture a
    // MODAL would answer to, and this is deliberately not a modal: the rail
    // and the body stay usable behind the floating pane, so leaving the
    // expanded view is a separate act from leaving the item.
    if (paneIsFloating()) { setPaneFloat(false); return; }
    closePane();
  });
}

function showExited() {
  const msg = document.createElement('span');
  msg.append(...translate(table.strings, 'ex.msg'));
  const cmd = document.createElement('code');
  cmd.textContent = 'mycontext ui';
  const ok = document.createElement('button');
  ok.className = 'icon';
  ok.append(...translate(table.strings, 'ex.ok'));
  ok.onclick = () => { document.getElementById('exited').hidden = true; };
  banner(msg, cmd, ok);
}

/**
 * **A refusal's message, read from a response that may carry no body at all.**
 *
 * The gate's refusals carry the STATUS AND NOTHING ELSE (Task 13, ruling A4),
 * so `response.json()` on one throws — and it throws at whichever caller
 * forgot, turning a clean 403 into a mystery. Other failures (an unknown
 * route, a handler error) still answer a JSON `error`, so a body is read only
 * when there IS one, and a body that parses to nothing useful falls back to
 * the status for the same reason: the reader gets a number rather than an
 * empty string.
 *
 * It is a function rather than four lines repeated because it WAS four lines
 * repeated — `api()` and `stream()` each carried their own copy, and this
 * shell now has a third caller in `post()`. Three copies of "what did the
 * server actually refuse with" is three places for the answer to drift, and
 * this codebase treats that drift as the defect rather than as duplication.
 */
async function refusalDetail(response) {
  const raw = await response.text();
  if (raw === '') return String(response.status);
  let detail = '';
  try { detail = String(JSON.parse(raw).error ?? ''); } catch { detail = ''; }
  return detail === '' ? String(response.status) : detail;
}

/**
 * **The one door: every credentialled request this page makes goes through
 * here, and the method is the only thing that varies.**
 *
 * `api()` and `post()` below are both this function. That is the point of it:
 * the token rule, the 401/403 recovery, the banner-clearing and the refusal
 * body are ONE implementation with a method and a body as inputs, not two that
 * agree today. A second copy would agree until the first time one of them was
 * fixed — which is exactly the history the 401/403 branch below records.
 *
 * `body === undefined` means NO body and NO content-type, so `api()`'s GET is
 * byte-for-byte the request it always was; a POST with a body sends it as
 * JSON, which is what `server.ts` parses (`JSON.parse(await readBody(req))`).
 */
async function request(path, method, body) {
  let response;
  try {
    // Only send the header when there is something to send. A null token
    // stringifies to the literal "null" in a header, which the gate reads as a
    // WRONG token (403) rather than an absent one — and a 403 would mask the
    // cookie, which is the credential a reloaded page actually has.
    response = await fetch(path, {
      method,
      headers: {
        ...(token === null ? {} : { 'X-Mycontext-Token': token }),
        // Only when there is a body: a bare `content-type` on a GET describes
        // content that does not exist.
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      // Spread rather than `body: undefined`, so a GET's init is the same
      // object shape it has always been.
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    // The server has exited (idle or closed). Say so; NEVER reconnect —
    // silent reconnection would reintroduce the daemon by another name (§2).
    showExited();
    stopHeartbeat();
    throw new Error('server exited');
  }
  if (response.status === 401 || response.status === 403) {
    // The token this tab remembered is not this server's. Clear it, so a
    // reload after the next `mycontext ui` starts from the handoff instead of
    // presenting a dead token forever.
    forgetToken();
    // **AND clear it IN MEMORY, which is the half that was missing.**
    //
    // `forgetToken()` only removes the sessionStorage copy. The module-level
    // `token` kept the dead value, so every later call in this page's life sent
    // the same rejected header again — a page that 403s once 403s until it is
    // reloaded, and the reader is given no reason to reload. Measured against a
    // restarted server on 2026-08-23: the rail drew, every pane said 403, and
    // the state was permanent.
    //
    // Clearing it is also what lets the page recover WITHOUT a reload. This
    // function's own header explains that a null token means no header is sent,
    // "and a 403 would mask the cookie, which is the credential a reloaded page
    // actually has" — so the very next request goes out bare, the browser
    // attaches the `mycontext_token` cookie, and a tab whose sessionStorage is
    // stale but whose cookie is current simply carries on. When neither is
    // current the answer becomes 401, which is the honest state and the one the
    // shell is built to survive.
    token = null;
    // Say it once, plainly. Every pane would otherwise print its own bare
    // `403` and the reader would count twenty broken screens instead of one
    // dead credential — which is exactly what the owner met on 2026-08-23.
    showDisconnected();
  }
  if (response.ok && disconnectedShown) {
    // **The banner says "not connected", so it must stop saying it the moment
    // the page IS connected.** Found by looking, not by reasoning: after a
    // nonce redeemed the tab in place and every pane filled with real data, the
    // red bar was still sitting across the bottom claiming otherwise — a stale
    // warning is its own defect, and a warning that outlives its cause teaches
    // the reader to ignore the next one.
    disconnectedShown = false;
    document.getElementById('exited').hidden = true;
  }
  if (!response.ok) {
    // A refusal from the security gate carries the status and nothing else, so
    // the body is read only when there is one — see refusalDetail() above,
    // which is that rule, once, for this function and for stream().
    throw new Error(await refusalDetail(response));
  }
  return await response.json();
}

/**
 * The screen contract's GET. Unchanged in every observable way — one argument,
 * no method, no body — and now one line, because everything it used to say is
 * said by request() for both verbs.
 */
async function api(path) {
  return await request(path, 'GET', undefined);
}

/**
 * **The same door, opened with a body.** `POST /api/config/check`,
 * `POST /api/config/preview` and `POST /api/overlap` are registered and tested
 * and, until this existed, unreachable from any screen: `api()` took a path
 * and nothing else, and the token is closed over inside this module, so a
 * hand-rolled `fetch` from a screen would carry no credential and be refused
 * by the gate — which would be the gate working.
 *
 * **A POST here is not a write, and this shell does not gain one.** All three
 * routes read, validate or preview; `src/ui/` binds no writer at all and
 * `test/ui/no-writes.test.ts` asserts that structurally. The verb is HTTP's,
 * chosen because the question does not fit in a query string — a candidate
 * `config.json`, a draft's title and body — not because anything is stored.
 *
 * `body` is any JSON-encodable value and is optional: omitting it sends an
 * empty POST, which the endpoints answer with the 400 that names the field
 * they wanted. Returns the parsed JSON, throws on any refusal or network
 * failure, exactly as `api()` does, because it IS `api()` with a method.
 *
 * **It is `post(path, body)` and not the `api(path, init)` that plan-2 Task 12
 * sketched, and the difference is worth the four lines it costs a reader** —
 * `screens/config.js` names the sketch, and this is what it got instead. An
 * `init` bag gives ONE entry two behaviours that a caller tells apart only by
 * reading the argument, where two named entries say which door was opened at
 * the call site; and the sketch's own `headers` line sends
 * `'X-Mycontext-Token': token` unconditionally, which is precisely the bug
 * request() carries a paragraph about — a null token stringifies to "null",
 * the gate reads a WRONG token, and the 403 masks the cookie. The shared half
 * is request(), so nothing about that sketch is lost except the shape of the
 * argument list.
 */
async function post(path, body) {
  return await request(path, 'POST', body);
}

/**
 * The SAME door as `api()`, held open — a token-carrying `fetch` whose body is
 * fed to the SSE parser frame by frame. `ui3` Task 11 adds it for
 * `/api/watch/stream`, and it closes over `token` for the same reason `api()`
 * does: the credential never leaves this module.
 *
 * **Not `EventSource`.** `EventSource` sends no custom headers, and the token
 * travels in `X-Mycontext-Token` on every `/api` request (spec §2), so the
 * stream has to be a fetch and `lib/sse.js` does what `EventSource` would have
 * (`lib/sse.js` · `use EventSource: EventSource sends no custom headers, and the token travels` · ~4).
 *
 * **It never reconnects, and neither does anything it returns.** A closed
 * stream is rendered as closed; silent reconnection would reintroduce the
 * daemon by another name, which is the same §2 rule `api()` already implements
 * for a failed fetch. The one thing that DOES happen on a network failure is
 * what `api()` does — the exit banner, once — because a stream that dies
 * without an abort is the server having gone away.
 *
 * `onEnd(reason)` fires EXACTLY once: `'aborted'` when the caller stopped it,
 * `'closed'` otherwise. Every frame, including `fault`, is delivered to
 * `onEvent` first — the fault carries the server's own message and swallowing
 * it here would leave the screen with a state and no reason for it.
 *
 * A refusal has no frames at all, so it is turned INTO one: a screen that
 * renders `fault` already knows how to say why a stream is not running, and a
 * second failure shape would be a second thing for every caller to handle.
 *
 * The returned function aborts and is idempotent.
 */
function stream(path, onEvent, onEnd) {
  const controller = new AbortController();
  let ended = false;
  const end = (reason) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  void (async () => {
    let response;
    try {
      response = await fetch(path, {
        headers: token === null ? {} : { 'X-Mycontext-Token': token },
        signal: controller.signal,
      });
    } catch {
      // An abort is this page's own doing and says nothing about the server.
      if (!controller.signal.aborted) {
        showExited();
        stopHeartbeat();
      }
      end(controller.signal.aborted ? 'aborted' : 'closed');
      return;
    }
    if (response.status === 401 || response.status === 403) forgetToken();
    if (!response.ok) {
      // The gate's refusals carry the status and nothing else (ruling A4), so
      // a body is read only when there is one — refusalDetail() is that rule,
      // shared with request(). What differs here is what is DONE with the
      // answer: a stream turns it into a `fault` frame rather than throwing,
      // because a screen that renders `fault` already knows how to say why a
      // stream is not running.
      onEvent('fault', { error: await refusalDetail(response) });
      end('closed');
      return;
    }

    const { createSseParser } = await import('/lib/sse.js');
    const feed = createSseParser(onEvent);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // `{ stream: true }` — a multi-byte character split across two socket
        // reads is one character, not two replacement marks.
        feed(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      // A frame the parser could not read is a BROKEN stream, and a broken
      // stream is reported rather than skipped. Swallowing it here would be
      // this shell deciding the server said nothing.
      if (!controller.signal.aborted) {
        onEvent('fault', { error: error && error.message ? error.message : String(error) });
      }
    }
    end(controller.signal.aborted ? 'aborted' : 'closed');
  })();

  return () => {
    controller.abort();
    end('aborted');
  };
}

/* ══ THE SHARED LIVE STREAM ═══════════════════════════════════════════════
 *
 * `plan:live seq:1` — "the shell owns ONE stream, and screens subscribe to
 * it". `watch.js` used to be the only caller of `stream()` above, opening and
 * closing its OWN connection on every visit to `#/watch`. That does not scale
 * to a product with twenty-two screens: the idle monitor deliberately does
 * not count an open stream as activity (`ui/watch-model.ts`'s own comment on
 * its poll timer — the timer is unref'd for exactly this reason), so a
 * connection per screen would be N things the server is holding for a page
 * that may be abandoned, and N chances for the token, the fault and the
 * teardown to each be solved slightly differently — the same argument this
 * file's own header makes about `hookContext` one layer down.
 *
 * So this module opens `/api/watch/stream` at most ONCE, ever, and every
 * screen that wants any of it calls `subscribeStream()` below instead of
 * `stream()` directly. `stream()` itself stays exactly what it was — the
 * primitive, still used for exactly this one connection — and is no longer
 * reachable from a screen at all (removed from the `window.myctx` contract):
 * a door left open is a door someone eventually opens again per-screen.
 */
let liveStop = null;
/**
 * Every screen currently listening, in subscribe order. `kinds` is a `Set`
 * of `AuditKind` strings this subscriber wants `record` frames for, or the
 * literal `'*'` for every kind, known or not.
 */
const liveSubscribers = new Set();
/**
 * The stream's own `hello`, remembered so a screen that subscribes AFTER the
 * connection already opened — a second visit to a live screen while the
 * FIRST visit's connection is still the one running, now that it is never
 * closed on navigation — sees the same opening frame a first subscriber
 * would have. `hello` fires exactly once per connection (§2: no reconnect,
 * ever), so without this a re-subscribed screen would sit believing nothing
 * had connected at all.
 */
let liveHello = null;
/**
 * The stream's terminal `fault`, if it has already happened, carried as the
 * server's own error text (`''` when a frame carried none). Replayed to a
 * late subscriber for the reason `liveHello` is: the connection never
 * reopens, so a screen mounting after the fault has exactly one chance to
 * learn the stream is dead, and it must be told rather than left to assume
 * silence means nothing is happening.
 */
let liveEnded = null;

/**
 * **Chrome-owned, said once, regardless of which screen (if any) is showing
 * — the "shell's version" of the fault `watch.js` already draws.**
 *
 * The idle-timeout exit (§ this task's own item) leaves the server's process
 * gone, which a broken `fetch()` already reports through `showExited()`
 * inside `stream()` above — that path is unchanged and still fires. What
 * THAT path cannot cover is a `fault` FRAME on an otherwise-live server (a
 * damaged audit line, or a stale token caught only by the stream request):
 * the response is 200 and the connection is real, so nothing about it looks
 * like the server exiting, and until now the only account of it lived inside
 * `watch.js`'s own `#alive` region — invisible on every one of the other
 * twenty-one screens. `STD-a-measured-zero-is-drawn-and-named`: "nothing is
 * happening" and "I stopped hearing" must not look alike, on ANY screen, not
 * only the one screen that happened to draw the difference before.
 *
 * Reuses `watch.streamFault` rather than inventing a second sentence for the
 * same fact — the shared connection carries the identical frame regardless
 * of who is listening, so the words that were already true stay true here.
 */
function showLiveFault(error) {
  const el = document.getElementById('livestate');
  const sep = document.getElementById('livesep');
  if (el === null) return;
  const chip = document.createElement('span');
  chip.className = 'chip warn';
  chip.dataset.g = '▲';
  chip.append(...translate(table.strings, 'watch.streamFault', { error }));
  el.replaceChildren(chip);
  el.hidden = false;
  if (sep !== null) sep.hidden = false;
}

/**
 * The one place every frame off the shared connection passes through: the
 * shell's own bookkeeping (`liveHello`/`liveEnded`/`showLiveFault`) runs
 * FIRST, unconditionally, because it must happen whether or not any screen
 * is currently subscribed; the per-subscriber fan-out runs after.
 *
 * **`record` is filtered by kind; nothing else is.** A `record` frame is a
 * claim about ONE kind and is fanned out only to a subscriber that asked for
 * it — the whole of "a screen that wants nothing costs nothing". Every other
 * frame is a claim about the STREAM itself and reaches every subscriber
 * regardless of `kinds`: a subscriber that filtered `hello`/`fault` out along
 * with the record kinds it does not care about would have no way left to
 * learn the connection it depends on has ended.
 */
function dispatchLiveEvent(event, data) {
  if (event === 'hello') liveHello = data;
  if (event === 'fault') {
    liveEnded = data !== null && typeof data === 'object' && typeof data.error === 'string'
      ? data.error : '';
    showLiveFault(liveEnded);
  }
  if (event === 'record') {
    const kind = data !== null && typeof data === 'object' ? data.kind : undefined;
    for (const sub of liveSubscribers) {
      if (sub.kinds === '*' || (typeof kind === 'string' && sub.kinds.has(kind))) sub.onEvent(event, data);
    }
    return;
  }
  for (const sub of liveSubscribers) sub.onEvent(event, data);
}

/**
 * Opens the ONE connection. Only the FIRST call ever does anything —
 * `liveStop` stays non-null for the rest of the page's life, whether the
 * stream is still running or has already faulted, because reopening after a
 * fault would be exactly the reconnection §2 forbids, aimed at whichever
 * screen subscribes next instead of the one that was there when it died.
 */
function ensureLiveStream() {
  if (liveStop !== null) return;
  liveStop = stream(`/api/watch/stream?backlog=${BOUND_CAP_LIST}`, dispatchLiveEvent, () => {
    // An ended stream is not any one screen's to report — `dispatchLiveEvent`'s
    // `fault` branch above is where the one true, shell-owned account of it is
    // said, and it is said whether or not a screen is even listening.
  });
}

/**
 * The screen contract's live door — see the header block above for the full
 * shape. Registers `onEvent` for the `kinds` this screen wants, opening the
 * shared connection on the very first call this page ever makes and reusing
 * it on every one after. A `hello` or `fault` that already happened is
 * replayed to THIS subscriber immediately, in that order, so a screen that
 * subscribes late is never left inferring the stream's state from silence.
 */
function subscribeStream(kinds, onEvent) {
  const sub = { kinds: kinds === '*' ? '*' : new Set(kinds), onEvent };
  liveSubscribers.add(sub);
  ensureLiveStream();
  if (liveHello !== null) onEvent('hello', liveHello);
  if (liveEnded !== null) onEvent('fault', { error: liveEnded });
  return () => { liveSubscribers.delete(sub); };
}

let stopHeartbeat = () => {};

function currentSession() { return sessionValue; }

/**
 * Fetch `/api/sessions`, pick the default the same way the server does
 * (`Ledger.recentSessions(1)[0]`, repeated here only as a fallback if
 * `data.default` is somehow absent), and reflect it into `#sesslbl` — the
 * mockup's own demo shows a raw session id there (`<b id="sesslbl">a3f9c1
 * </b>`), not a translated string, so this is a plain value assignment, not
 * a t()/tFlat() call. `sess.cold` (real key, string table) covers the
 * no-sessions state. There is no `<select>`/dropdown here — see the file
 * header's "what this task did not wire".
 */
async function loadSessions() {
  const data = await api('/api/sessions');
  // Reached only past a real answer — `api()` throws before this line on a
  // 401/403 or a dead connection, so getting here IS the credential working.
  // See `noCredential`'s own header for why this can't just be `sessionValue
  // === 'cold'` read backwards.
  noCredential = false;
  sessionValue = data.sessions.length === 0 ? 'cold' : (data.default ?? 'cold');
  const label = document.getElementById('sesslbl');
  label.textContent = sessionValue === 'cold' ? flat(table.strings, 'sess.cold') : sessionValue;
  for (const fn of sessionListeners) fn(sessionValue);
}

/**
 * **The provenance bar and the status strip — the app's two missing rows.**
 *
 * `.app` declares `grid-template-rows:46px 1fr 26px 30px` with areas
 * `top / rail body / prov / strip`, so the grid reserved both rows from the day
 * the shell landed while nothing was ever built to sit in them. 26 + 30 = 56,
 * and that is exactly the band of bare `.app` the owner saw across the bottom
 * of every screen, showing the body's gradient through.
 *
 * BUILT IN SCRIPT, NOT COPIED AS MARKUP, and that is deliberate. The mockup
 * writes these as static HTML carrying `data-t` attributes and scans for them.
 * This app has no such scanner — `index.html` contains zero `data-t`
 * attributes and every string it draws comes through `translate()` — so
 * pasting the mockup's markup would ship English literals the א/A toggle could
 * never reach. Take the mockup's DESIGN, never its BEHAVIOUR: the classes, the
 * order and the states are the mockup's; how the text gets there is this app's.
 *
 * WHAT IS REAL, AND WHAT IS HONESTLY ABSENT. The git group is live off
 * `/api/meta`'s `git`, whose four `upstream` values map one-to-one onto the
 * mockup's states; the item count is live off `/api/status`. The context group
 * renders `strip.ctx.noBridge` — its own keyed state for "no status line
 * bridge is installed" — which is the true answer here, not a blank.
 *
 * NOT BUILT, and named rather than dropped: "injections today" and the audit
 * append p95. Both need an audit aggregate this read surface does not expose,
 * and inventing a number for a bar whose whole job is provenance would be the
 * exact defect this bar exists to prevent. Their separators are omitted with
 * them, so the strip reads as a shorter TRUE bar rather than a complete one
 * with holes.
 */
function renderChrome() {
  const app = document.getElementById('app');
  if (app === null) return;

  // Present and empty: the bar is "one home for every qualification the
  // screens owe", and when no screen owes one there is nothing to say. The
  // row is reserved by the grid either way, so building it empty is what
  // stops the background showing through; screens fill #provparts later.
  if (document.getElementById('prov') === null) {
    const prov = document.createElement('div');
    prov.className = 'prov';
    prov.id = 'prov';
    prov.setAttribute('aria-label', flat(table.strings, 'aria.prov'));
    const parts = document.createElement('span');
    parts.className = 'provparts';
    parts.id = 'provparts';
    prov.append(parts);
    app.append(prov);
  }

  let strip = document.getElementById('strip');
  if (strip === null) {
    strip = document.createElement('footer');
    strip.className = 'strip';
    strip.id = 'strip';
    app.append(strip);
  }
  strip.replaceChildren();

  const sep = () => {
    const e = document.createElement('span');
    e.className = 'sep';
    return e;
  };

  const git = document.createElement('span');
  git.className = 'gitstate';
  git.id = 'gitstate';
  strip.append(git, sep());

  const count = document.createElement('span');
  count.className = 'm';
  count.id = 'stripitems';
  const itemsLabel = document.createElement('span');
  itemsLabel.append(...translate(table.strings, 'strip.items'));
  strip.append(count, document.createTextNode(' '), itemsLabel, sep());

  const ctx = document.createElement('span');
  ctx.className = 'ctxstate';
  ctx.id = 'ctx';
  const noBridge = document.createElement('span');
  noBridge.append(...translate(table.strings, 'strip.ctx.noBridge'));
  ctx.append(noBridge);
  strip.append(ctx);

  // ── THE SHARED LIVE STREAM'S OWN FAULT — present but hidden, exactly as
  // `#prov` is built empty above, so the row's width does not jump the
  // instant a fault actually happens. `showLiveFault()` unhides both; see
  // "THE SHARED LIVE STREAM" for why this lives at shell level at all.
  const liveSep = document.createElement('span');
  liveSep.className = 'sep';
  liveSep.id = 'livesep';
  liveSep.hidden = true;
  const live = document.createElement('span');
  live.id = 'livestate';
  live.hidden = true;
  strip.append(liveSep, live);

  // This function reruns on a live page — `installNonceRedemption()` calls it
  // a second time after a pasted nonce redeems in place — and `strip
  // .replaceChildren()` above would otherwise silently un-say a fault the
  // stream already reported. A fact the reader was already told must survive
  // the chrome being rebuilt around it.
  if (liveEnded !== null) showLiveFault(liveEnded);
}

/**
 * Fill the strip from the two endpoints that can answer it.
 *
 * Separate from `renderChrome` because the shell must exist before the first
 * fetch resolves — a bar that appears late is a layout that jumps, and the
 * 56px row is reserved from first paint whether or not the data has landed.
 */
async function fillChrome() {
  const git = document.getElementById('gitstate');
  const count = document.getElementById('stripitems');
  if (git === null || count === null) return;

  try {
    const meta = await api('/api/meta');
    const g = meta.git;
    // `branch` is checked BEFORE `detached`, because git-info.ts documents one
    // shape where both `branch === null` and `detached === false` hold — a HEAD
    // it could not understand — and there `upstream: 'unknown'` is what should
    // render, never "on a branch".
    if (g === undefined || g === null) {
      git.append(...translate(table.strings, 'strip.notARepo'));
    } else if (typeof g.branch === 'string') {
      git.append(...translate(table.strings, 'strip.branch',
        { branch: g.branch, commit: String(g.commit ?? '').slice(0, 7) }));
      const chip = document.createElement('span');
      const key = g.upstream === 'in-sync' ? 'strip.inSync'
        : g.upstream === 'differs' ? 'strip.differs'
          : g.upstream === 'no-upstream' ? 'strip.noUpstream' : 'strip.unknownTip';
      chip.className = g.upstream === 'in-sync' ? 'chip ok' : 'chip warn';
      chip.dataset.g = g.upstream === 'in-sync' ? '●' : '▲';
      chip.append(...translate(table.strings, key, { branch: g.branch }));
      git.append(chip);
    } else if (g.detached === true) {
      git.append(...translate(table.strings, 'strip.detached',
        { commit: String(g.commit ?? '').slice(0, 7) }));
    } else {
      const chip = document.createElement('span');
      chip.className = 'chip warn';
      chip.dataset.g = '▲';
      chip.append(...translate(table.strings, 'strip.unknownTip'));
      git.append(chip);
    }
  } catch {
    // A failed read is not "not a git repository" — it is nothing known, and
    // the strip says nothing rather than guessing.
  }

  try {
    const status = await api('/api/status');
    count.textContent = String(status.items.total);
  } catch { /* leave the count empty rather than show a wrong one */ }
}

// --- The rail's count badges ------------------------------------------------
//
// `<span class="cnt x">7</span>` beside Coverage gaps, Doctor and Review queue:
// the count of things wanting attention, on the rail, where a person sees it
// without opening the screen. The design of record has drawn all three since it
// was written and `styles.css` has carried `.cnt` and `.cnt.x` just as long —
// and nothing in this shell ever created one, so the stylesheet had rules for
// an element that did not exist. Invisible to `styles-parity` by construction:
// it compares CSS BLOCKS, and both files have the block.
//
// **THREE STATES, THREE SPELLINGS, because two of them are easy to confuse and
// `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` says they may
// not be.** A badge that is simply absent cannot tell a reader whether nothing
// needs attention or whether nobody looked:
//
//     .cnt.x   "7"   measured, and something wants attention
//     .cnt     "0"   measured, and nothing does — drawn in the NEUTRAL class,
//                    so it reports without shouting
//     .cnt     "—"   NOT measured: the endpoint refused, and the em dash is
//                    this product's own mark for a value nothing measured
//                    (`status.js` draws one for the same reason)
//
// The zero badge is the one the design of record does not draw, and it is drawn
// anyway: the mockup's scene happens to have a finding on all three screens, so
// the question never arose there. `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`
// is what makes that an ordinary decision rather than a divergence to file.
//
// **TWO REQUESTS, NOT THE `counts` FIELD THE TASK PROPOSED**, and the reason is
// worth stating because the task's suggestion looked better on its face. One
// `/api/status` carrying all three numbers would be one request and would keep
// every derivation server-side. But the Coverage-gaps number is
// `coverageGaps()` — a walk over the coverage tree that lives in
// `lib/viewmodel.js` and is tested there — and moving it server-side means
// either a SECOND implementation of one rule, which this project bans outright,
// or a refactor that makes the gaps table read a server-computed list. Neither
// belongs in a task about drawing a badge. Two boot requests against a local
// server is the cheaper price, and it is paid once.
const RAIL_COUNTS = ['gaps', 'doctor', 'work'];

/** `null` means NOT MEASURED, which is never the same as `0`. */
async function railCounts() {
  const counts = { gaps: null, doctor: null, work: null };
  // Each source is caught separately: `/api/coverage` refusing must not cost
  // the two numbers `/api/status` answered perfectly well.
  try {
    const status = await api('/api/status');
    counts.doctor = (status.health?.errors ?? 0) + (status.health?.warnings ?? 0);
    counts.work = status.pendingRevisions?.revisions ?? 0;
  } catch { /* stays null — named as unmeasured on the rail */ }
  try {
    const coverage = await api('/api/coverage');
    counts.gaps = coverageGaps(buildTree(coverage.files ?? [])).length;
  } catch { /* stays null */ }
  return counts;
}

function railBadge(count) {
  const badge = document.createElement('span');
  if (count === null) {
    badge.className = 'cnt';
    badge.append(document.createTextNode('—'));
    badge.title = flat(table.strings, 'rail.cntNone');
    return badge;
  }
  badge.className = count > 0 ? 'cnt x' : 'cnt';
  badge.append(document.createTextNode(String(count)));
  badge.title = flat(table.strings, count > 0 ? 'rail.cntSome' : 'rail.cntZero', {
    count: String(count),
  });
  return badge;
}

async function paintRailCounts() {
  const counts = await railCounts();
  for (const name of RAIL_COUNTS) {
    const button = document.querySelector(`.nav[data-s="${name}"]`);
    // The rail is rebuilt on a language change, so a badge from the previous
    // paint would otherwise be appended beside a new one.
    if (button === null) continue;
    for (const stale of button.querySelectorAll('.cnt')) stale.remove();
    button.append(railBadge(counts[name]));
  }
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren();               // never innerHTML — see i18n above
  for (const [groupKey, names] of NAV) {
    const group = document.createElement('div');
    group.className = 'grp';
    const label = document.createElement('p');
    label.append(...translate(table.strings, groupKey));
    group.append(label);
    for (const name of names) {
      // **A <button>, not an <a>, because the mockup's rail is buttons**
      // (`web-ui-mockup.html` ~1262: `<button class="nav" data-s="preview">`).
      // It is not cosmetic: `e2e/mockup.ts`'s showScreen() and every spec in
      // this suite reach the rail as `.nav[data-s="<name>"]`, so an anchor
      // without `data-s` is a rail no test can drive.
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav';
      button.dataset.s = name;
      // The label is wrapped in its own <span>, as the mockup does, so the
      // badge beside it is a sibling rather than part of the translated run.
      const text = document.createElement('span');
      text.append(...translate(table.strings, `s.${name}`));
      button.append(text);

      const built = Object.hasOwn(SCREENS, name);
      if (built) {
        button.addEventListener('click', () => { location.hash = `#/${name}`; });
      } else {
        // The mockup's own vocabulary for "named but not real yet". Untranslated
        // there too — `<span class="prop">PROPOSED</span>` carries no data-t —
        // so this copies it rather than inventing a key the tables do not have.
        const badge = document.createElement('span');
        badge.className = 'prop';
        badge.textContent = 'PROPOSED';
        button.append(badge);
        // `aria-disabled`, never the `disabled` property: a disabled button
        // leaves the tab order, so a keyboard user would never learn the screen
        // exists — which is the whole reason it is listed. This stays reachable
        // and announces itself as unavailable, and carries no click handler.
        button.setAttribute('aria-disabled', 'true');
      }
      if (location.hash === `#/${name}`) button.setAttribute('aria-current', 'page');
      group.append(button);
    }
    nav.append(group);
  }
}

async function route() {
  // **The pane belongs to the screen that opened it.** `installItemPane`
  // delegates from the document and `pane-open` is a class on `.app`, which
  // outlives every screen — so without this the pane opened on Coverage is
  // still there on Simulate, squeezing the body to three columns for an item
  // the user has navigated away from. Twelve of the twenty-two screens emit no
  // `[data-id]` at all and could only ever INHERIT it. Measured 2026-08-27:
  // `closePane` appeared three times in this file (its declaration, the ✕
  // handler, Escape) and not once in `route()`; the owner reported the result
  // as "there are many screens that it should not appear but currently it
  // does". CLOSED and not hidden, and here at the TOP rather than beside the
  // section build: `closePane()` drops the class, sets `hidden` and forgets
  // the id in one call, so no part of the previous screen's pane survives into
  // the next one — and it runs even if the dynamic import below throws.
  // `test/ui/pane-route.test.ts` is this line.
  closePane();
  // Decision 5: the landing screen is the injection preview, at
  // event=session-start on the most recent session, rendering with no
  // input. NOT 'status' — that screen is built by Task 19 and deferred to
  // wave 3 ("Corrected 2026-08-20", plan Task 16 note).
  const asked = (location.hash.replace(/^#\//, '') || 'preview');
  // Resolve BEFORE building the section. `SCREENS[name] || SCREENS.preview`
  // renders the preview for an unknown route, and naming the section after the
  // route rather than the screen would create a `[data-p="nonsense"]` holding
  // the preview's markup — a lie in the DOM that any parity check would read
  // as a screen that exists.
  const name = Object.hasOwn(SCREENS, asked) ? asked : 'preview';
  const loader = SCREENS[name];
  renderNav();
  // Fire-and-forget, and NEVER awaited here — see main()'s note on the bare
  // `await` that took a whole boot down over one 401. A rail badge is the least
  // important thing on this page; it may not be able to delay or break the rest.
  void paintRailCounts();

  // **Every screen is a `<section data-p="NAME">`, and they STACK.**
  //
  // The mockup writes all 21 as siblings of `.body` and shows one by flipping
  // `hidden` (`web-ui-mockup.html` ~1295-2312), with `.body{display:grid}` and
  // `.body>[data-p]{grid-column:1;grid-row:1}` putting every one of them in the
  // SAME grid cell so an outgoing and incoming screen overlap during the
  // crossfade instead of the incoming one being laid out below the outgoing —
  // which reads as a jump-cut, not a fade. Until now this app had neither: no
  // `[data-p]` element and, before the CSS carry, not one `data-p` rule in the
  // stylesheet. `.body` was a plain block holding one screen's loose children,
  // which is why the whole stylesheet was being applied to a container it was
  // not written for.
  //
  // Sections are created ON FIRST VISIT rather than all 21 up front, because
  // screen modules are dynamically imported and eleven of them do not exist
  // yet. A section with nothing behind it would be an empty grid cell claiming
  // to be a screen. The ones already visited stay in the DOM, hidden, exactly
  // as the mockup keeps all 21.
  const body = document.getElementById('screen');
  let section = body.querySelector(`[data-p="${name}"]`);
  if (section === null) {
    section = document.createElement('section');
    section.dataset.p = name;
    body.append(section);
  }
  for (const other of body.querySelectorAll('[data-p]')) other.hidden = other !== section;

  // No string-table key exists yet for a transient loading state (checked:
  // neither the mockup nor the string tables declare one) — inventing an
  // untranslated string here would be exactly the defect this shell's i18n
  // discipline exists to prevent, so the screen is simply cleared while the
  // dynamic import resolves rather than shown a placeholder. Open question,
  // this task's report.
  section.replaceChildren();
  const mod = await loader();
  await mod.render(section, window.myctx);

  // **`KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it`.**
  //
  // AFTER `render()`, never before: every screen's own `render()` opens with
  // `root.replaceChildren()` (`preview.js` and the rest, uniformly), so
  // anything appended first is simply erased. This runs on every route while
  // `noCredential` holds, which is deliberate — the reader may click any rail
  // button while locked out, and the statement has to follow them there, not
  // wait for them to guess that `preview` is where it lives.
  //
  // What it is NOT: the `#exited` banner (`.banner`, a fixed overlay) or the
  // `#sesspop` dialog neither of which is built in this shell (see the header
  // comment on "what this task did not wire"). Both were considered and
  // rejected — a banner and a modal are both call-outs ABOVE the content; this
  // sits IN the one place a reader locked out of every screen is actually
  // looking, which is the content itself, empty as it is.
  //
  // `sess.nocred`, not `sess.cold`: the label `#sesslbl` already draws stays
  // exactly as `sess.cold` left it (a real, authenticated empty ledger reads
  // "Cold session" and says nothing more, correctly). This is a SEPARATE
  // string precisely so that sentence never grows a credential claim it would
  // owe the OTHER 'cold' — an authenticated reader with zero sessions must
  // never meet a paragraph telling them their credential is missing.
  if (noCredential) {
    const note = document.createElement('p');
    note.className = 'small spill';
    note.append(...translate(table.strings, 'sess.nocred'));
    section.append(note);
  }
}

/**
 * Fill every `[data-t]` element in the shipped shell from the string table.
 *
 * **This did not exist until 2026-08-25, and ten elements were quietly English
 * because of it.** `index.html` carries ten `data-t` attributes — the item
 * pane's six `<dl>` labels, `pane.body`, `pane.hist`, `pane.histn` and
 * `pane.well` — and the file's own comment says they "are translated in place
 * by i18n.js's applyStatic". THERE WAS NO `applyStatic`: `applyLanguage()`
 * sets `lang` and `dir` and nothing else, and nothing anywhere queried
 * `[data-t]`. So those labels rendered their AUTHORED English on the Hebrew
 * page, and `pane.histn` — added with no authored text, the way this shell
 * builds everything else — rendered blank.
 *
 * No gate could see it. `strings-parity` compares the two tables against the
 * mockup's `data-t` SET, and all ten keys are present in all three; a key that
 * exists and is never rendered still matches.
 *
 * `translate()`, not `textContent`, because these keys carry `{b:}`/`{i:}`
 * emphasis and `{m:}` runs — `pane.histn` bolds *spilled* and italicises
 * *every* — and assigning text would flatten them. Owner ruling A1: `t()`
 * returns nodes and they are appended.
 *
 * `replaceChildren` first, so the authored English that seeds the markup is
 * REPLACED rather than appended to.
 */
function applyStatic(root) {
  for (const el of root.querySelectorAll('[data-t]')) {
    const key = el.getAttribute('data-t');
    if (key === null || key === '') continue;
    el.replaceChildren(...translate(table.strings, key));
  }
}

async function main() {
  const lang = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  table = await import(`/strings/${lang}.js`);
  applyLanguage(document.documentElement, table);
  // The wordmark is not a translated string: the mockup renders it as a bare
  // <b>mycontext</b> with no `data-t`, and a product name is not translated.
  document.getElementById('session-label').append(...translate(table.strings, 'top.session'));
  document.getElementById('focus-label').append(...translate(table.strings, 'top.focus'));
  applyStatic(document);
  // The language control is an ICON BUTTON in the mockup (`#lang`, "א/A"), not
  // a labelled <select>. Its accessible name is an OPEN QUESTION (§0.4) — do
  // not invent a key for it here; raise it, change the mockup, then add it to
  // both string tables.
  const langButton = document.getElementById('lang');
  langButton.onclick = () => {
    localStorage.setItem('myctx-lang', lang === 'he' ? 'en' : 'he');
    location.reload();
  };

  const nonce = extractNonce(location.hash);
  if (nonce !== null) {
    token = await exchangeNonce(fetch.bind(window), nonce);
    history.replaceState(null, '', location.pathname); // the fragment dies here (§2)
    if (token !== null) rememberToken(token);
  }
  // A reload has no nonce: the fragment died on the first load and the nonce
  // is one-shot at the server. Without this the page came back blank —
  // every /api call 401ing — and the only cure was restarting the server.
  // sessionStorage is the same trust boundary the token already sits in:
  // one origin, one tab, gone when the tab closes, and unreadable by anything
  // `script-src 'self'` does not already let run. It buys a reload, and it
  // buys the language toggle, which reloads by design.
  if (token === null) token = rememberedToken();
  // **No token is NOT a dead server, and the page must not say it is.**
  //
  // This used to `showExited()` and return, which is how the owner came to be
  // looking at a page whose only content was "The server has exited" while the
  // server was running perfectly. The message was wrong, and because the boot
  // returned here, nothing else was ever drawn.
  //
  // There is now a third credential this code cannot see: the `mycontext_token`
  // cookie, set at handoff and HttpOnly by design, so `document.cookie` will
  // never show it. The only way to find out whether this page is authenticated
  // is to ASK THE SERVER — so the boot continues, and `api()` deals with a real
  // 401 if one actually comes back. Bailing here would refuse to use a
  // credential the browser is already holding.

  window.myctx = {
    api,
    // The same door with a body. Reaches the three POST routes no screen could
    // call before; it reads, validates and previews, and it writes nothing.
    post,
    // The shell's ONE live connection, fanned out by record kind — never a
    // door onto a fresh connection of its own. See "THE SHARED LIVE STREAM"
    // and the header block above for the shape.
    subscribeStream,
    // Nodes. Screens append: `el.append(...ctx.t(key, vals))`. The flattened
    // form is a SEPARATE call, so reaching for it is a visible decision.
    t: (key, subs) => translate(table.strings, key, subs),
    tFlat: (key, subs) => flat(table.strings, key, subs),
    // `table.lang` is 'en' or 'he' — set once in main() by the import of
    // `/strings/${lang}.js` above, and it does not change without a reload
    // (the language toggle reloads by design). Exposed for `command-actions.js`
    // to carry to the confirm route; see the screen-contract note above.
    lang: table.lang,
    session: currentSession,
    onSessionChange: (fn) => sessionListeners.push(fn),
    navigate: (hash) => { location.hash = hash; },
  };

  // The two grid rows the shell always reserved and never filled. Drawn before
  // the first data call so the 56px band never exists, not even for a frame.
  renderChrome();
  void fillChrome();

  // **THE RECOVERY PATH AND THE HEARTBEAT ARE INSTALLED BEFORE THE FIRST CALL
  // THAT CAN FAIL. That ordering is the whole fix; see below.**
  stopHeartbeat = startHeartbeat(document, () => api('/api/ping').catch(() => {}), 60_000);
  installNonceRedemption();
  // Installed here for the same reason as the two above: it is a document
  // listener that must survive a boot which fails. A pane wired after
  // `loadSessions()` would be a pane that does not open on exactly the pages
  // where a reader most wants to inspect an item — the degraded ones.
  installItemPane();
  // The remembered WIDTH, applied before the first screen paints so the pane
  // never opens at 330px and jumps. Installed here beside `installItemPane()`
  // and for the same reason: it must survive a boot that fails, and the width
  // the reader chose is theirs on the degraded pages too. The module defaults
  // to `localStorage` and swallows every way it can refuse — reading the
  // property itself throws in a sandboxed frame — so this cannot be what takes
  // the boot down.
  installPaneResize(document.getElementById('app'));

  // `loadSessions()` reads `/api/sessions`, and every refusal this server can
  // make lands here as a rejection. Awaited BARE, it took the entire boot with
  // it — measured on 2026-08-23, with the owner looking at the result:
  //
  //   [EXCEPTION] app.js  Error: 401
  //       at api  at async loadSessions  at async main
  //
  // and after it, nothing. Not the heartbeat, not the hashchange listener, not
  // `renderNav()`, not `route()`. The header and the footer strip had already
  // been drawn, so the page was not blank — it was a chrome around an empty
  // rail and an empty body, which reads exactly like a broken router and is
  // not one.
  //
  // **Two things made that far worse than a missing session name.**
  //
  // The heartbeat never started, so the page issued no `/api` request ever
  // again — and `IdleMonitor` reaps a server after fifteen minutes without
  // one. The lockout starved the timer that then killed the server, and the
  // next reload met a port with nothing behind it. One symptom, two layers,
  // fifteen minutes apart.
  //
  // And the `hashchange` listener below — which exists for precisely this
  // state, and whose own comment calls itself "the ONLY route back after the
  // server restarts" — was registered AFTER this line. The remedy for a
  // locked-out page was installed after the call that fails when the page is
  // locked out. Pasting the printed URL into the tab did nothing, and could
  // never have done anything.
  //
  // So: a session read that fails is now a session that is `cold`, which is a
  // state this shell already draws and `sess.cold` already has a string for.
  // The rail, the router and both listeners survive it. **Nothing that can
  // fail on a missing credential may run before the recovery path is
  // installed** — that is the invariant, and the ordering above is it.
  try {
    await loadSessions();
  } catch {
    // Deliberately silent HERE and loud everywhere it matters: `fillChrome()`
    // and every screen make their own calls and draw their own refusals, so
    // the reason reaches the page through them rather than being swallowed.
    // Re-throwing would restore exactly the defect this comment describes.
  }

  // **A nonce pasted into a LIVE page is redeemed, not routed.**
  //
  // The fragment is how this app receives a credential, and until now only the
  // BOOT looked at it. Pasting the URL `mycontext ui` prints into a tab already
  // showing the app changed the hash without reloading the document — a
  // same-document navigation — so `main()` never re-ran, the nonce was never
  // exchanged, and the router treated the hex as a screen name and fell back to
  // the preview. The page stayed exactly as locked out as before, and the one
  // action a person would naturally take to fix it did nothing at all.
  //
  // That is not a corner case. It is the ONLY route back after the server
  // restarts: the old token is stale, the cookie for it has been expired by the
  // refusal path, and the printed URL is the sole source of a new one. It cost
  // three wrong diagnoses on 2026-08-23 before the refusal log showed that
  // `POST /api/handoff` had never been called at all.
  //
  // Redeeming in place rather than reloading, because a reload would drop the
  // fragment before the new document could read it — the same trap the boot
  // already dodges with `history.replaceState`.
  await route();
}

/**
 * The `hashchange` handler, lifted out of `main()`'s tail into its own
 * function so it can be installed BEFORE the first call that can reject.
 *
 * It used to sit inline after `await loadSessions()`, which meant the one
 * remedy for a page with no credential was registered after the call that
 * fails when the page has no credential. See the ordering note in `main()`.
 */
function installNonceRedemption() {
  window.addEventListener('hashchange', () => {
    const pasted = extractNonce(location.hash);
    if (pasted === null) { void route(); return; }
    void (async () => {
      const fresh = await exchangeNonce(fetch.bind(window), pasted);
      history.replaceState(null, '', location.pathname);
      if (fresh !== null) {
        token = fresh;
        rememberToken(fresh);
        // The screens were drawn with no credential, so they drew nothing.
        // Everything the shell computed is stale for the same reason.
        renderChrome();
        void fillChrome();
        // Guarded for the same reason the boot's call is: a redemption that
        // succeeded and a session list that then refused must still reach
        // `route()`, or the page recovers its token and stays empty.
        try { await loadSessions(); } catch { /* screens draw their own */ }
      }
      await route();
    })();
  });
}

main();
