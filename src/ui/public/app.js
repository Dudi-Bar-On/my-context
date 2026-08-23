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
//        ctx.stream(p, onEv, onEnd) GET, token-headered, SSE-parsed; returns a
//                                    stop() that aborts it. onEnd(reason) fires
//                                    exactly once. NEVER reconnects (§2).
//                                    See stream() below.
//        ctx.t(key, subs)           Node[] — the ONLY renderer. Append it:
//                                    `el.append(...ctx.t(key, vals))`. Never
//                                    assign with textContent/innerHTML (owner
//                                    ruling A1, §0.6 — see lib/i18n.js).
//        ctx.tFlat(key, subs)       string — attribute/text-only sinks ONLY
//                                    (aria-label, title, an <option> label).
//                                    Reaching for this to fill an element is
//                                    the bug; ctx.t() is what fills one.
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
// The ONE markdown renderer. The Docs screen owns it because Docs was the
// first screen that needed one; the item pane is the second, and a second
// implementation of "turn corpus text into nodes safely" is the last thing
// this product should grow — that renderer is already the thing
// `e2e/runs.spec.ts` points at when it asserts the page SHOWS a script tag
// rather than running one.
import { markdownNodes } from '/screens/docs.js';

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
  };
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
  els.file.textContent = item.source_file ?? '—';

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
    const link = event.target.closest?.('[data-id]');
    if (link === null || link === undefined) return;
    const id = link.dataset.id;
    if (typeof id !== 'string' || id === '') return;
    void openPane(id);
  });
  // Escape closes it, the same gesture the popovers already answer to
  // (`e2e/keyboard.spec.ts` asserts that contract for those).
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePane();
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
}

async function main() {
  const lang = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  table = await import(`/strings/${lang}.js`);
  applyLanguage(document.documentElement, table);
  // The wordmark is not a translated string: the mockup renders it as a bare
  // <b>mycontext</b> with no `data-t`, and a product name is not translated.
  document.getElementById('session-label').append(...translate(table.strings, 'top.session'));
  document.getElementById('focus-label').append(...translate(table.strings, 'top.focus'));
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
    // The held-open door. Same token, same no-reconnect rule; the caller gets
    // back the stop() that aborts it.
    stream,
    // Nodes. Screens append: `el.append(...ctx.t(key, vals))`. The flattened
    // form is a SEPARATE call, so reaching for it is a visible decision.
    t: (key, subs) => translate(table.strings, key, subs),
    tFlat: (key, subs) => flat(table.strings, key, subs),
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
