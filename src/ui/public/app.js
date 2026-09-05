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
//                                    "THE SHARED LIVE STREAM" below. A screen
//                                    never calls this itself to learn when to
//                                    refresh — `route()` does that FOR every
//                                    screen, off `SCREEN_INVALIDATION`
//                                    (`lib/live-invalidation.js`, plan:live
//                                    seq:2/3 — see "LIVE INVALIDATION" below).
//                                    The one exception is `watch`, which owns
//                                    its own incremental redraw and calls this
//                                    directly, same as always.
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
//        ctx.onSessionChange(fn)    fn(sessionId) on every future change — a
//                                    CHANGE, not every read of /api/sessions.
//                                    Returns an unsubscribe, and a screen that
//                                    subscribes MUST hold it and call it from
//                                    its next render(): render() runs again on
//                                    every return to the route and on every
//                                    live refresh, so a listener that is never
//                                    removed accumulates one per render.
//                                    screens/preview.js is the worked example.
//        ctx.navigate(hash)         sets location.hash (triggers the router).
//        ctx.announce(nodes, urgent)
//                                    Says one thing in the app's ONE live
//                                    region, built by renderChrome() beside
//                                    `#provparts`. `nodes` is what ctx.t()
//                                    answers, never a string. `urgent` raises
//                                    it from polite to assertive and is for a
//                                    FAILURE only. Announce the OUTCOME — the
//                                    clipboard write that RESOLVED, the run
//                                    that answered — never the click that
//                                    asked for it: a button that says
//                                    "Copied" on click has re-created the
//                                    defect this exists to fix. There is no
//                                    second region and a screen may not build
//                                    one; two collide and a reader hears
//                                    neither.
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
//
//   ── AND #sesspop LANDED ON 2026-09-02 (`plan:walk seq:115`) ──────────────
//
//   That refusal was right when it was written and became a defect: two
//   controls in the title bar did nothing when pressed, and the owner asked
//   for the session picker twice in one morning. `#sesspop` is now built —
//   markup in `index.html` after `</header>`, mechanism in `installPopovers()`
//   below, rows in `paintSessionList()` — and it consumes `loadSessions()`'s
//   answer exactly as the note above anticipated, without re-deriving it.
//
//   ── AND #focuspop LANDED THE SAME DAY (`plan:walk seq:115`) ─────────────
//
//   The second half of the same defect. Markup in `index.html` beside
//   `#sesspop`, mechanism in the same `installPopovers()` — one table, one
//   `togglePopover()`, one Escape — and its composition in
//   `paintFocusCommand()` below.
//
//   **It COMPOSES; it does not write.** A focus changes what Claude receives
//   on the next event, which is the kind of change the owner applies, so the
//   two rows and the tag box build a `mycontext focus …` line and hand it to
//   `lib/command-actions.js` — the one control that owns Copy, the confirm and
//   `POST /api/execute`. Nothing in this file posts on a row click, and there
//   is no second approval route.
//
//   The picker is a READ: it moves `sessionValue` and nothing else, so every
//   screen's next request names the chosen session and the server is never
//   told anything. That is what ends the state `plan:walk seq:35` measured,
//   where `ctx.session()` could only ever be the default and *Injected now*
//   could only ever draw one session.

import { extractNonce, exchangeNonce } from '/lib/bootstrap.js';
// **The ONE Copy-and-Execute control, adopted by the title bar's focus dialog.**
// `#focuspop` composes `mycontext focus …` and must not be a second approval
// route: the confirm inside this control IS the security boundary (spec §6.3),
// and nine hand-rolled copy buttons is the mistake it was built to end. See
// `paintFocusCommand()`.
import { commandActions } from '/lib/command-actions.js';
// The argv-to-line spelling, shared with that control so the string a reader
// sees in `.cmd` and the string the control copies cannot drift apart.
import { composeCommand } from '/lib/command.js';
import { startHeartbeat } from '/lib/heartbeat.js';
import { applyLanguage, pickLanguage, t as translate, tFlat as flat } from '/lib/i18n.js';
// The pane's WIDTH — a preference, remembered per browser. Its own module for
// spec §6's reason: the rule (what a drag means, which stored values are
// widths, what a keystroke does) is testable without a browser, and only the
// wiring below is not.
import { installPaneResize } from '/lib/pane-resize.js';
// The ONE markdown renderer. It lived inside the Docs screen until 2026-09-05,
// because Docs was the first screen that needed one; it is a library now, since
// the item pane and the tutorial reader are the second and third callers and a
// second implementation of "turn corpus text into nodes safely" is the last
// thing this product should grow — that renderer is already the thing
// `e2e/runs.spec.ts` points at when it asserts the page SHOWS a script tag
// rather than running one.
import { markdownNodes } from '/lib/markdown.js';
// The strip's context group. `contextStrip()` is the decision table for the
// five states §4b names and the three project-knowledge answers beside them —
// written, tested (`test/ui/viewmodel.test.ts`) and, until 2026-08-29, called
// by nothing at all: the strip asserted `strip.ctx.noBridge` unconditionally
// while the function that decides between no-bridge and four other answers
// sat in the module beside it. `formatAge` ticks the "as of … ago" off
// `receivedAt` at RENDER time, which is why that age is not a field on the
// view — a number frozen at fetch time is the one thing that label must not
// be.
// `occupancyLevel` bands the context percentage against the SERVED
// `handoverThresholdPercent` (`plan:walk seq:117`) and `corpusDrift` is the
// three-state table for `measureCorpusDrift`'s answer — both in the module
// beside `contextStrip` and both unit-tested there, because a decision table
// inside a DOM builder is a decision table no test can reach.
import {
  CONTEXT_FILL_CRIT_PERCENT, CONTEXT_FILL_WARN_PERCENT, CONTEXT_SAMPLE_FRESH_MS,
  askHeadroom, contextStrip, corpusDrift, fillLevel, fmtCount, formatAge, formatDuration,
  occupancyBands, occupancyLevel, usageBar, usageLevelOf,
  // ── AND THE THREE THE 2026-09-02 FIELDS ARE DRAWN WITH.
  //
  // `wallStamp` is the wall clock's ONE spelling and `relDir`/`corpusDir`
  // are the ONE abbreviation both bars draw a directory with. They live beside
  // `formatDuration` for the same reason it does: the terminal reaches every
  // one of them through its dynamic-import bridge, so there is one
  // implementation of each rather than a copy per surface — see `relDir`'s own
  // header for why the abbreviation is relative and what it buys.
  corpusDir, relDir, wallStamp,
} from '/lib/viewmodel.js';
// The shared live stream's backlog size — see "THE SHARED LIVE STREAM" below.
//
// **`SHARED_STREAM_BACKLOG` below, not `BOUND_CAP_LIST` any more
// (`TASK-the-audit-stream-shows-almost-nothing-of-what-the-log-holds`,
// 2026-09-04).** This shell cannot import `screens/watch.js`'s own `FEED_CAP` —
// that would invert the shell/screen dependency every screen module already
// relies on running one way — so the number that used to be borrowed from a
// generic list bound is now a literal here, kept equal to `watch.js`'s
// `FEED_CAP`/`BACKLOG` BY COMMENT rather than by import. See `screens/watch.js`
// · `Raised from a bare 20 to FEED_CAP` · for the measurement that argues the
// number: a 20-record fallback left every finished lane on the live screen
// showing zero steps, over a corpus whose `agent-step` records backfill in
// bursts of up to ~150 at once.
// WHICH kinds make each screen stale, and whether that screen may be
// rebuilt in place or must ask first — see "LIVE INVALIDATION" below and
// that file's own header for why both facts live in the one table.
// `CHROME_INVALIDATION` is the same declaration for the shell's OWN chrome —
// the status strip's four groups and the provenance bar — which is not a
// screen, has no route, and is built once for the life of the page. Same file,
// same shape, same gate; a separate export because that table is keyed by
// SCREEN NAME and its gate fails on a key `app.js` routes no screen for.
// `STREAM_POLL_MS` is the server's own tail interval, mirrored by name so the
// Execute settle window can be derived from the two clocks that sit between a
// record being appended and this page deciding what to do about it, rather than
// from a number somebody liked. See `EXECUTE_SETTLED_WINDOW_MS`.
import {
  CHROME_INVALIDATION, LIVE_INVALIDATION_DEBOUNCE_MS, SCREEN_INVALIDATION,
  STREAM_POLL_MS,
} from '/lib/live-invalidation.js';

const SCREENS = {
  preview: () => import('/screens/preview.js'),
  coverage: () => import('/screens/coverage.js'),
  // `gaps` retired 2026-09-04 (seq:22) — folded into `coverage.js`. `route()`
  // sends a stale `#/gaps` link here to `coverage` explicitly.
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
  ['nav.inj', ['preview', 'coverage', 'simulate', 'injected']],
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

/**
 * The marker the handoff sets beside the `mycontext_token` cookie: the port of
 * the server that issued it. `security.ts`'s `CREDENTIAL_COOKIE`.
 *
 * Not `HttpOnly`, and deliberately so — it is the one thing about this page's
 * own credential that script is ALLOWED to know. The token itself stays
 * unreadable.
 */
const CRED_COOKIE = 'mycontext_cred';

/**
 * The port named by the marker cookie, or `null`.
 *
 * Hand-parsed for the reason `security.ts`'s `cookieValue` is: zero runtime
 * dependencies, the header is `name=value; name=value`, and anything that does
 * not split cleanly is skipped rather than guessed at. `document.cookie` can
 * itself throw where storage is blocked, which is a browser saying "you have
 * no cookies" — the same answer as an absent marker.
 */
function credentialCookiePort() {
  let raw = '';
  // Coerced, not trusted: `document.cookie` throws where storage is blocked
  // and is `undefined` in the shell's own in-process harnesses. Both mean the
  // same thing here — no marker — and neither may take the boot down, which is
  // the whole reason this function is allowed to be consulted before the first
  // request.
  try { raw = typeof document.cookie === 'string' ? document.cookie : ''; } catch { return null; }
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== CRED_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return value === '' ? null : value;
  }
  return null;
}

/**
 * **Does this page hold a credential AT ALL? Answered without spending a
 * request to be told.**
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 *
 * `plan:walk seq:85`, measured 2026-08-29 in a real browser against
 * `.demo-corpus`: a boot with no credential — a bookmarked bare URL, a second
 * tab, a tab whose server has been replaced — fired the shell's whole opening
 * set (`/api/meta`, `/api/status`, `/api/watch/volume`, `/api/watch/stream`,
 * `/api/sessions`, then the landing screen's `/api/status`, `/api/coverage`,
 * `/api/select`, `/api/simulate`, `/api/items`) and had every one of them
 * refused. **A refusal is the read surface's one WRITE** — `recordRefusal` →
 * `recordAudit` → `keepProjectionCurrent`, a `BEGIN IMMEDIATE` transaction —
 * so ten reads became ten writes, of nothing but failures, and every one of
 * them was repeated the instant a nonce was pasted (`installNonceRedemption`
 * re-runs the identical set). 5,207 of that corpus's 6,156 audit records, and
 * 17% of the owner's live log, were the app refusing its own boot.
 *
 * ── WHY THE PAGE COULD NOT ANSWER THIS BEFORE ──────────────────────────────
 *
 * There are three places a credential can be, and until today the page could
 * see only two of them. `token` is the in-memory one, from a redeemed nonce.
 * `sessionStorage` is the tab's copy, which buys a reload. The third is the
 * `mycontext_token` cookie — `HttpOnly` by design, so `document.cookie` will
 * never show it — and `main()`'s own comment took the honest way out: *"The
 * only way to find out whether this page is authenticated is to ASK THE
 * SERVER."* That was true, and asking cost nine refusals. It is no longer
 * true: `security.ts`'s `CREDENTIAL_COOKIE` is a marker set in the same
 * response as the token cookie and cleared in the same response, carrying the
 * issuing PORT and no credential at all.
 *
 * ── WHY THE PORT AND NOT MERELY "A COOKIE EXISTS" ──────────────────────────
 *
 * Cookies are scoped to a HOST, not a port, so every `mycontext ui` on
 * 127.0.0.1 overwrites the same `mycontext_token`. A tab on the previous
 * port therefore holds a cookie the current server never issued: that is
 * `token-mismatch`, 869 of the 5,207 records above, and it is a boot that was
 * refused ten times for a credential it could have known was not its own. The
 * marker is overwritten by the same last-writer-wins rule, so it always names
 * the server whose token the cookie currently holds.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 *
 * It is not a second gate, and it never says yes on its own: `false` means
 * "there is nothing to present", never "you may not". A `true` here still buys
 * exactly one thing — the request is SENT — and the server decides it, which
 * is why a stale cookie for the right port still goes out, is still refused,
 * and is still audited. **Those refusals are the ones that must stay**: a
 * wrong token is a security event, and this removes self-inflicted refusals,
 * not the record of real ones.
 */
function credentialHeld() {
  if (token !== null) return true;
  return credentialCookiePort() === location.port;
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

/* ══ THE SERVER IS OLDER THAN ITS OWN ASSETS ════════════════════════════════
 *
 * `plan:live seq:12`. Measured 2026-08-28: a server that started at 13:58 was
 * still answering `/api/select` from a `core/select.ts` that knew four tiers
 * while this page had already fetched, live from disk, the `screens/preview.js`
 * that drew five. The continuity lane rendered and nothing could ever fill it,
 * and the owner reported a feature as broken that had shipped an hour earlier.
 *
 * **The page cannot work this out on its own, and must not try.** It can see
 * what it was served; it cannot see what the server's modules were loaded from.
 * A page that merely noticed its own assets changing would announce a RESTART
 * as loudly as a skew. So the server answers — `staleCode`, derived from the
 * one `CodeIdentity` it stamped at start (`src/core/code-identity.ts`) — and this
 * shell's whole job is to compare what it was told against what it is showing,
 * and to stop being silent.
 *
 * **It rides the heartbeat, not the first paint.** `/api/meta` is read once,
 * when the page loads; the reader who actually paid for this had a tab open
 * since the morning. `/api/ping` is the only thing this shell polls — once a
 * minute, while the tab is visible — so it is the only channel that can reach
 * that reader, and `noteCodeSkew` is called from both.
 *
 * **Not latched.** `showCodeSkew` is idempotent and is called again on every
 * ping that still reports a skew, so the banner comes back if
 * `showDisconnected`'s recovery, which shares `#exited`, hid it. Dismissal is
 * the reader's and is remembered: `ex.ok` on this banner means "I know, I will
 * restart when I am ready", and a warning that reappears every sixty seconds
 * after being answered is the one that teaches people to ignore banners.
 */
let codeSkewDismissed = false;

/**
 * The sentence this banner needs, and the ONE thing this lane could not build.
 *
 * `plan:live seq:12` owns the server, the wire and this shell; the string
 * tables and the design of record are another agent's, and a UI sentence in
 * this product is not invented at the point of use — it is added to
 * `docs/design/web-ui-mockup.html` first and to BOTH `strings/en.js` and
 * `strings/he.js` after. Until that lands there is nothing true to render, and
 * `t()` throws on a missing key by design, so the guard below is the seam
 * rather than a fallback: the moment the key exists this banner draws, with no
 * further change here. The interim disclosure is `CODE_FREEZE_NOTICE`, printed
 * by `mycontext ui` at start.
 */
const CODE_SKEW_KEY = 'ex.codeSkew';

/**
 * The session picker's not-projected notice — `plan:rulings seq:26`. A
 * constant rather than a literal inside `paintSessionList()`'s `translate()`
 * call, for the identical reason `CODE_SKEW_KEY` is: `test/ui/viewmodel.test
 * .ts`'s "every string key app.js itself names is declared in both tables"
 * scans this file for the literal call shape and fails on any key not yet in
 * both tables. This lane does not own the string tables either.
 */
const SESS_NOT_PROJECTED_KEY = 'sess.notProjected';

/** Any `/api` answer that carries `staleCode`. Anything else is ignored. */
function noteCodeSkew(answer) {
  if (answer !== null && typeof answer === 'object' && answer.staleCode === true) showCodeSkew();
}

/* ══ THE CORPUS HAS MOVED AND THE LOG DID NOT SEE IT ══════════════════
 *
 * `measureCorpusDrift` landed on 2026-08-31 and `/api/ping` and `/api/meta`
 * have carried its answer as `corpus` ever since. **Nothing drew it**, and its
 * six string keys were already in both tables waiting.
 *
 * **THE PARALLEL HOOK TO `noteCodeSkew`, AND DELIBERATELY THE SAME SHAPE.**
 * That function reads `staleCode` off ANY `/api` answer that carries one, so
 * the disclosure rides both channels the server puts it on: `/api/meta` at
 * first paint, which is the only one that reaches a tab in its first minute,
 * and `/api/ping` on the heartbeat, which is the only one that reaches a tab
 * open since the morning. `corpus` is served on exactly the same two requests
 * for exactly the same reason (`server.ts`'s own comment: "a corpus drifts
 * while a tab sits open in a way a server's own code cannot"), so it is read
 * the same way rather than through a third channel that could disagree with
 * the other two.
 *
 * Where it differs from `staleCode`: a skew raises a BANNER and is latched
 * until dismissed, because the remedy is a restart the reader has to perform.
 * Drift is ambient provenance — one chip in the corpus group of the strip,
 * beside the item count it qualifies — because there is nothing to do about it
 * except know, and a modal every time somebody saves a file in an editor is a
 * modal that gets ignored.
 *
 * The value is REMEMBERED rather than re-fetched, so `CHROME_REFILL.corpus`
 * refilling the count for a `mutation` does not blank a drift answer that came
 * from a ping thirty seconds ago. `null` is the honest "nothing has answered
 * yet", which `corpusDrift()` reports as `unknown` — not as `in-step`.
 */
let corpusDriftAnswer = null;

/** Any `/api` answer that carries `corpus`. Anything else is ignored. */
function noteCorpusDrift(answer) {
  if (answer === null || typeof answer !== 'object') return;
  if (answer.corpus === undefined) return;
  corpusDriftAnswer = answer.corpus;
  fillCorpusDrift();
}

/**
 * Draw the drift chip from whatever last answered.
 *
 * Three states and no fourth, straight off `corpusDrift()`'s table — which is
 * in `lib/viewmodel.js` and unit-tested there, because the one thing this must
 * not do is turn `drifted: null` into "no". `core/corpus-drift.ts` is explicit:
 * a sweep that hit its entry bound and found nothing answers `null` rather than
 * `false`, because "nothing here" over the part that fit is not the question
 * that was asked.
 *
 * One `replaceChildren` at the end and no clear first, the same as every other
 * segment — see `fillItems` for why that matters now that segments have more
 * than one caller.
 */
function fillCorpusDrift() {
  const host = document.getElementById('corpusdrift');
  if (host === null) return;
  const view = corpusDrift(corpusDriftAnswer);
  const chip = document.createElement('span');
  if (view.state === 'drifted') {
    chip.className = 'chip warn';
    chip.dataset.g = '▲';
    chip.dataset.f = 'corpus-drift';
    chip.dataset.k = 'strip.corpusDrifted';
    // The age is the whole reason the endpoint answers `aheadByMs` at all:
    // "an edit landed since you opened this tab" and "an edit landed last
    // Tuesday" are different sentences and only the reader can tell which
    // matters. `formatAge` is the strip's one spelling of a duration.
    chip.append(...translate(table.strings, 'strip.corpusDrifted', {
      age: view.aheadByMs === null ? '—' : formatAge(view.aheadByMs),
    }));
    chip.title = flat(table.strings, 'title.corpusDrifted');
  } else if (view.state === 'in-step') {
    // A MEASURED negative, drawn and named. `STD-a-measured-zero-is-drawn-and
    // -named-an-unmeasured-thing-is` clause 1: the sweep ran, reached
    // everything it meant to, and found nothing newer than the log — which is
    // a finding, and a reader deciding whether to trust this page is entitled
    // to it rather than to a silence they have to interpret.
    chip.className = 'chip ok';
    chip.dataset.g = '●';
    chip.dataset.f = 'corpus-drift';
    chip.dataset.k = 'strip.corpusInStep';
    chip.append(...translate(table.strings, 'strip.corpusInStep'));
    chip.title = flat(table.strings, 'title.corpusInStep');
  } else {
    chip.className = 'chip unmeas';
    chip.dataset.g = '◌';
    chip.dataset.f = 'corpus-drift';
    chip.dataset.k = 'strip.corpusDriftUnknown';
    chip.append(...translate(table.strings, 'strip.corpusDriftUnknown'));
    chip.title = flat(table.strings, 'title.corpusDriftUnknown');
  }
  host.replaceChildren(chip);
}

/* ══ THE CONFIG BROKE MID-SESSION, AND ONLY ONE SCREEN COULD SAY SO ═══════
 *
 * `plan:live seq:13`. `liveWorkspace` keeps serving the last config that DID
 * load when `config.json` stops loading mid-session, rather than failing
 * every endpoint at once — right, because the alternative would take out the
 * one screen (Configure) that can show the reader the broken text. But that
 * left everyone else: Simulate's ribbon and Work's governing set are computed
 * from a config that is not the file in front of the reader, with no hint
 * that it is not. `/api/meta`'s `configError` is the fix, and it rides the
 * SAME first-paint call `noteCodeSkew` and `noteCorpusDrift` already read —
 * see `fillGit()` — because it is a fact every screen's shell already has in
 * hand, not a second channel to keep in step with `/api/config`'s
 * `servingLastGood`.
 *
 * **Not on the heartbeat, unlike `staleCode` and `corpus`.** Those two ride
 * `/api/ping` as well because the case that cost a bug report was a tab open
 * since the morning; `/api/meta` is what the server actually carries this
 * field on (`server.ts`'s own comment), and a config break is recovered the
 * way it is caused — an edit to `config.json`, on this same running server,
 * which is itself a `repo`-kind mutation this shell already refetches
 * `/api/meta` for (`CHROME_REFILL.repo` calls `fillGit` again).
 *
 * Three states, straight off `configError`'s own type, `string | null`: never
 * absent (`STD-a-measured-zero-…` clause 3), and the `null` reading is a
 * MEASURED good state and not an absence (clause 1) — "the config on disk is
 * the config governing this page" is a finding, the same as `corpusInStep`
 * one function up.
 */
let configErrorAnswer;

/** Any `/api` answer that carries `configError`. Anything else is ignored. */
function noteConfigError(answer) {
  if (answer === null || typeof answer !== 'object') return;
  if (!('configError' in answer)) return;
  configErrorAnswer = answer.configError;
  fillConfigError();
}

/**
 * The three pending keys, named as CONSTANTS rather than as literals inside a
 * translate/flat call — `CODE_SKEW_KEY`'s own precedent, and for the identical
 * reason: `test/ui/viewmodel.test.ts`'s "every string key app.js itself names
 * is declared in both tables" scans this file, by TEXT, for that exact call
 * shape written out with a quoted key, and fails on any key that is not yet in
 * both tables. A constant passed BY NAME is invisible to that scan, which is
 * what lets this land — guarded, drawing nothing — before the design-of-record
 * owner has composed the sentences.
 */
const CONFIG_UNKNOWN_KEY = 'strip.configUnknown';
const CONFIG_OK_KEY = 'strip.configOk';
const CONFIG_BROKEN_KEY = 'strip.configBroken';
const CONFIG_UNKNOWN_TITLE_KEY = 'title.configUnknown';
const CONFIG_OK_TITLE_KEY = 'title.configOk';
const CONFIG_BROKEN_TITLE_KEY = 'title.configBroken';

/**
 * Draw the config chip from whatever last answered.
 *
 * Guarded on the string keys existing, the same seam `showCodeSkew` uses:
 * this lane does not own `strings/en.js` or `strings/he.js`, a UI sentence
 * here is composed by the design-of-record owner, and `t()` throws on a
 * missing key by design. Nothing draws until the three keys land, and then
 * this needs no further change.
 */
function fillConfigError() {
  const host = document.getElementById('configerr');
  if (host === null) return;
  if (table === null) return;
  const chip = document.createElement('span');
  const draw = (cls, glyph, key, titleKey) => {
    if (!(key in table.strings)) return false;
    chip.className = cls;
    chip.dataset.g = glyph;
    chip.dataset.f = 'config-error';
    chip.dataset.k = key;
    chip.append(...translate(table.strings, key));
    // The title is a courtesy, not a second gate: a table carrying the label
    // but not yet the (later-added) tooltip still draws the chip.
    if (titleKey in table.strings) chip.title = flat(table.strings, titleKey);
    return true;
  };
  let drawn;
  if (configErrorAnswer === undefined) {
    drawn = draw('chip unmeas', '◌', CONFIG_UNKNOWN_KEY, CONFIG_UNKNOWN_TITLE_KEY);
  } else if (configErrorAnswer === null) {
    drawn = draw('chip ok', '●', CONFIG_OK_KEY, CONFIG_OK_TITLE_KEY);
  } else {
    drawn = draw('chip warn', '▲', CONFIG_BROKEN_KEY, CONFIG_BROKEN_TITLE_KEY);
  }
  if (!drawn) return;
  host.replaceChildren(chip);
}

/* ══ THE CONTEXT WINDOW FILLED AND THE LOG DID NOT SEE IT ═══════════════
 *
 * Owner, 2026-08-31, CRITICAL: *"the status bar now refreshes but only when i
 * reload the page - i want it to be updated automatically without refreshing
 * the web page."*
 *
 * **THE CAUSE IS THE SAME ONE AS `noteCorpusDrift` ABOVE, ONE SEGMENT OVER.**
 * `CHROME_INVALIDATION.session` declares `kinds: ['injection']`, and that
 * declaration is honest — its own derivation block says so at length: the
 * project-knowledge share IS injection records, and the context PERCENTAGE is
 * the status-line tee, written by `mycontext statusline` on Claude Code's
 * per-message hook, *"a command that records NO audit record at all"*. A fact
 * with no audit kind can never appear in a list of kinds. So the group filled
 * at first paint, subscribed to a kind that a working session may not produce
 * for an hour, and sat there. Every other strip segment was live; this one was
 * a photograph.
 *
 * **NOT CLOSED BY GIVING THE FACT A KIND, AND NOT BY A WATCHER.** Both are
 * ruled out by measurement rather than by preference, and both are written down
 * where they were measured: `fs.watch` collapses to two events naming nothing
 * past ~20-50 files on this platform (`core/corpus-drift.ts`), and an audit row
 * per assistant message is one row per message — 5,207 rows of exactly that
 * shape were deleted from this corpus for being noise. What is left is the
 * channel that already exists, which is what `corpus` above did with the
 * identical problem.
 *
 * ── WHY THIS IS NOT SIMPLY `void fillContext()` ON THE HEARTBEAT ─────────
 *
 * Because the two questions cost two different amounts and only one of them
 * has to be asked every minute. Measured 2026-08-31, Windows/Node 24:
 *
 *     /api/ping's occupancy read      0.32ms p50   flat
 *     /api/watch/context, full        4.69ms p50   grows with the session's
 *                                                  injection count
 *
 * The expensive one opens the audit projection and sums this session's
 * injection records. The cheap one is one `existsSync`, one small file and one
 * `JSON.parse`. So the ping carries the cheap one, and the answer decides:
 * MOVED, and the group is refetched in full; unmoved, and it is REDRAWN from
 * the body already in hand, which costs nothing and still re-computes every
 * age from `Date.now()`. The reader gets a group that is correct on every tick
 * either way, and the server pays 4.69ms only on the ticks where something
 * actually happened — at most once per assistant message.
 *
 * **The stamp includes the server's `stale` verdict**, which is what makes an
 * IDLE session work rather than freeze. Nothing moves for hours, so nothing is
 * refetched — and then the sample crosses `CONTEXT_SAMPLE_FRESH_MS`,
 * `readOccupancy` starts answering `unmeasurable/stale` instead of a
 * percentage, the stamp changes, and the strip refetches and de-colours itself.
 * That is `walk/123`'s fossil being caught by the same mechanism that keeps the
 * figure live, rather than by a second one.
 */
let occupancyStamp = null;

/**
 * The last answer `/api/watch/context` gave, and whether the session was cold.
 *
 * `null` means nothing has answered yet — or the last call was REFUSED, which
 * is cleared deliberately in `fillContext`'s catch: a redraw must never bring
 * back a body the server has since refused to confirm, and `strip.unread` with
 * its retry is the honest state there.
 */
let lastContextBody = null;

/**
 * Everything about an occupancy answer that a redraw could not work out for
 * itself. One string, compared for equality — the same shape `noteCorpusDrift`
 * remembers its answer in, and cheaper than a deep compare of five fields.
 *
 * `null` in (no session named, or a body that predates the field) gives
 * `'absent'`, which is stable: a heartbeat that never names a session must not
 * refetch on every tick.
 */
function stampOccupancy(occupancy) {
  if (occupancy === null || occupancy === undefined || typeof occupancy !== 'object') return 'absent';
  if (occupancy.state !== 'known') return `unmeasurable:${String(occupancy.why)}`;
  return `known:${String(occupancy.receivedAt)}:${String(occupancy.usedTokens)}/${String(occupancy.windowSize)}`;
}

/**
 * The heartbeat's query string: `?session=…`, or empty before a session is
 * known.
 *
 * Empty rather than `?session=cold`: `'cold'` is this shell's word for "no
 * session to ask about", not a session id, and sending it would have the server
 * look for a `.statusline/cold.json` and answer `no-sample` — a claim about the
 * bridge for a question nobody asked.
 */
function pingQuery() {
  const session = currentSession();
  return session === 'cold' ? '' : '?session=' + encodeURIComponent(session);
}

/** Any `/api` answer that carries `occupancy`. Anything else is ignored. */
function noteOccupancy(answer) {
  if (answer === null || typeof answer !== 'object') return;
  if (answer.occupancy === undefined) return;
  const next = stampOccupancy(answer.occupancy);
  const moved = next !== occupancyStamp;
  occupancyStamp = next;
  // A page that has never drawn the group has nothing to redraw, so the first
  // answer always fetches — including the `'absent'` one, which is how a strip
  // whose boot `fillContext()` was refused gets a second chance.
  if (moved || lastContextBody === null) { void fillContext(); return; }
  drawContext();
}

function showCodeSkew() {
  if (codeSkewDismissed) return;
  if (table === null || !(CODE_SKEW_KEY in table.strings)) return;
  const msg = document.createElement('span');
  msg.append(...translate(table.strings, CODE_SKEW_KEY));
  // A literal, exactly as `showExited()` writes it: the remedy is a command,
  // and a command is not a translated string.
  const cmd = document.createElement('code');
  cmd.textContent = 'mycontext ui';
  const ok = document.createElement('button');
  ok.className = 'icon';
  ok.append(...translate(table.strings, 'ex.ok'));
  ok.onclick = () => {
    codeSkewDismissed = true;
    document.getElementById('exited').hidden = true;
  };
  banner(msg, cmd, ok);
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
    summary: document.getElementById('panesummary'),
    sumlab: document.getElementById('panesumlab'),
    stale: document.getElementById('panestale'),
    props: document.getElementById('paneprops'),
  };
}

/**
 * **The summary, its staleness disclosure and its property chips — the three
 * elements above the `<dl>`, filled or hidden together.**
 *
 * ── WHAT THIS CLOSES ───────────────────────────────────────────────────────
 *
 * `plan:walk seq:119` phase 3, filed and never built. Every active item in this
 * corpus carries a `summary` — one plain sentence saying what it IS, written
 * for a reader who does not know this codebase — and no screen in the product
 * drew it. A reader had to read the body, which is the thing a summary exists
 * to spare them.
 *
 * ── ABSENT IS ABSENT ───────────────────────────────────────────────────────
 *
 * `summary` is optional on `Item` and always will be: every corpus predates the
 * field, and the sixteen superseded and deprecated items in this project's own
 * corpus carry none. So `null` hides all three elements rather than drawing an
 * empty paragraph, a blank line or a dash. Every path through here sets
 * `hidden` explicitly on every element, because the pane is REUSED — a second
 * item's summary must never sit under a first item's id.
 *
 * ── A STALE SUMMARY IS SHOWN, AND SHOWN AS STALE ───────────────────────────
 *
 * `summaryOf` records the content the summary was written against; when the
 * item moves under it, the two disagree and the server's `summaryState` reads
 * `stale` (or `unanchored`, for a summary hand-edited into a file with no basis
 * at all). Both mean one thing to a reader: do not quote this as though it
 * described the item.
 *
 * It is still DRAWN — nothing in this product is dropped silently — through
 * three carriers, because one is not enough. A `.chip.warn` says the word; the
 * note under it says the sentence; the rule down the summary's leading edge is
 * the thing a reader notices first and the only one that would not survive
 * print or a monochrome screen. That ordering is deliberate: colour is never
 * the only carrier of a state here.
 *
 * The WORDING is this app's, in the reader's language, rather than
 * `summaryStalenessNote`'s. That function is one English paragraph shared by
 * `mycontext show`, `get_item` and `doctor` — three English surfaces — and
 * piping it here would put an English paragraph into the Hebrew UI, which is
 * the defect the provenance bar already recorded costing every screen in the
 * product. The FACT is measured in exactly one place (`summaryState`,
 * core/content-hash.ts, called by the server); only the sentence is local.
 *
 * ── WHICH PROPERTIES EARN A CHIP ───────────────────────────────────────────
 *
 * The owner's ask is the summary "with the properties that complement the
 * knowledge and understanding" — which is not every field, and the six the
 * `<dl>` already carries two lines below (type, status, tier, scope, governs,
 * file) are exactly the ones that would be noise here. The rule is: **a
 * property earns a chip when it changes whether a reader should act on the
 * sentence they just read, and is not already stated in this same block.**
 *
 *   `always`      — this item governs every session regardless of scope. It is
 *                   the strongest claim an item can make about itself and the
 *                   `<dl>` does not carry it at all. 26 of 733 here.
 *   `continuity`  — it is carried ACROSS sessions. Same argument; also absent
 *                   from the `<dl>`.
 *   `origin`      — `agent` only. An item captured by something other than a
 *                   person is a different kind of claim from one a person
 *                   wrote, and this project's own rule is that it does not
 *                   govern until a person promotes it. 36 of 733.
 *   `validUntil`  — an item whose truth has a stated END. Drawn in the warn
 *                   register because a reader acting on a summary needs to know
 *                   the item is on a clock; 17 of 733 carry one.
 *   `extra.*`     — the CATEGORY-SPECIFIC fields, and this is what makes the
 *                   chip set per-item-type without a table of types here: a
 *                   `rule` carries `directive`, a `requirement` carries `kind`,
 *                   a `risk` carries `likelihood` and `impact`. Whatever the
 *                   config gives the category is what appears.
 *
 * **Not chipped, and each for a reason rather than by omission.** The `<dl>`'s
 * six, because they are eight pixels away. `tags`, because a tag is a
 * PROJECTION axis rather than a property of the claim — 709 of 733 items carry
 * some, so chipping them would bury the four above in a wall of grey. And
 * `severity`, because it is the `<dl>`'s `tier` row already.
 *
 * **No new chip modifier is spent.** `gov`, `carry`, `warn` and the neutral
 * `index` are the existing registers and they mean here exactly what they mean
 * everywhere else; the hue budget is five plus a neutral and a sixth needs an
 * owner ruling, not a display task. Every chip carries a word AND a glyph, so
 * none of them says anything in colour alone.
 */
function fillPaneSummary(els, item, state) {
  if (els.summary === null || els.stale === null || els.props === null) return;
  const stale = state === 'stale' || state === 'unanchored';

  // The sentence. `textContent` because a summary is CORPUS text — never
  // markdown, never nodes this app composed — and the same reason `#panebody`
  // goes through one renderer rather than through `innerHTML`.
  const text = typeof item.summary === 'string' ? item.summary : '';
  els.summary.textContent = text;
  els.summary.className = stale ? 'itemsum stale' : 'itemsum';
  els.summary.hidden = text === '';
  // ── AND ITS LABEL, HIDDEN WITH IT — owner ruling 2026-09-01.
  //
  // The label carries no content of its own (`fillStaticText` writes it from
  // `pane.summary` once per language), so the only thing to decide here is
  // whether it is SHOWN, and the answer is exactly when the sentence under it
  // is. A `.welllabel` standing over an absent summary is a heading for
  // nothing — the empty-band defect `#prov` and the 26+30px strip band both
  // already cost this shell — and 16 of the 733 items in this corpus carry no
  // summary at all, so it is not a hypothetical case.
  //
  // Guarded rather than assumed present: `test/ui/pane-route.test.ts` drives
  // this shell through a fake document built from a fixture, and a pane built
  // before this element existed would otherwise throw here rather than draw an
  // unlabelled summary.
  if (els.sumlab !== null) els.sumlab.hidden = text === '';

  // The disclosure. Hidden whenever there is nothing to disclose, so a good
  // summary is never shadowed by an empty warning.
  els.stale.replaceChildren();
  els.stale.hidden = !(stale && text !== '');
  if (stale && text !== '') {
    els.stale.append(...translate(
      table.strings, state === 'unanchored' ? 'sum.unanchoredNote' : 'sum.staleNote',
    ));
  }

  // The chips.
  els.props.replaceChildren();
  // Counted rather than read back off the host: `childElementCount` is a real
  // DOM property and the fake document `test/ui/pane-route.test.ts` drives this
  // shell through does not have one, so reading it there would yield `undefined`
  // and leave an EMPTY chip strip unhidden — visible in a browser, invisible to
  // the test. A local count is the same answer in both.
  let chips = 0;
  const chip = (cls, glyph, nodes) => {
    const span = document.createElement('span');
    span.className = cls;
    span.dataset.g = glyph;
    span.append(...nodes);
    els.props.append(span);
    chips += 1;
  };
  // FIRST, because it qualifies everything after it: a reader who is about to
  // trust four properties should learn in the same glance that the sentence
  // above them may no longer describe the item.
  if (stale && text !== '') {
    chip('chip warn', '▲', translate(
      table.strings, state === 'unanchored' ? 'sum.unanchored' : 'sum.stale',
    ));
  }
  if (item.always === true) chip('chip gov', '◆', translate(table.strings, 'sum.always'));
  if (item.continuity === true) chip('chip carry', '◇', translate(table.strings, 'sum.continuity'));
  if (item.origin === 'agent') chip('chip index', '◇', translate(table.strings, 'sum.agent'));
  if (typeof item.validUntil === 'string' && item.validUntil !== '') {
    chip('chip warn', '▲', translate(table.strings, 'sum.until', { until: item.validUntil }));
  }
  // The category's own fields, in the order the item carries them. Both halves
  // are CORPUS text — `directive: dont`, `likelihood: high` — so they are text
  // nodes rather than a translated key: this app does not know what a category
  // may name, and inventing an English label for a value the project chose
  // would be translating somebody else's vocabulary.
  const extra = item.extra !== null && typeof item.extra === 'object' ? item.extra : {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value !== 'string' || value === '') continue;
    chip('chip index', '◇', [document.createTextNode(`${key}: ${value}`)]);
  }
  els.props.hidden = chips === 0;
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
  // **The summary block goes DOWN, not to a holding dash.** The `<dl>` above
  // shows `…` while the fetch is in flight because six labelled rows with
  // nothing beside them read as broken; a summary has no label, so an ellipsis
  // there would be indistinguishable from an item whose summary is the word
  // "…". Hidden is the honest holding state, and it is also the state an item
  // with no summary ends in — one fewer shape to get wrong.
  if (els.summary !== null) { els.summary.hidden = true; els.summary.textContent = ''; }
  if (els.stale !== null) { els.stale.hidden = true; els.stale.replaceChildren(); }
  if (els.props !== null) { els.props.hidden = true; els.props.replaceChildren(); }

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
  // **Before the `<dl>`, because it is what the reader came for.** The six rows
  // below answer *does this apply to me*; the summary answers *what is this*,
  // and the second question is not worth asking until the first has an answer.
  //
  // `data.summaryState` is the SERVER's measurement and is never re-derived
  // here: it is a checksum over the item's canonicalised summarised fields
  // (`itemSummaryBasis`), and a browser-side copy would be a second
  // implementation of the identity the whole corpus is keyed on. A response
  // that somehow carries no verdict is treated as UNANCHORED rather than as
  // current — the direction that discloses.
  const hasSummary = typeof item.summary === 'string' && item.summary !== '';
  fillPaneSummary(els, item, hasSummary
    ? (typeof data.summaryState === 'string' ? data.summaryState : 'unanchored')
    : 'absent');
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
    // **Escape steps back ONE level**, and as of 2026-09-02 there is a level
    // ABOVE the pane to step back from: a title-bar popover. `installPopovers`
    // handles that key first (it is installed first, and document listeners run
    // in registration order) and this guard is what stops the SAME keystroke
    // from also closing the pane behind it. Without it, one Escape over an open
    // `#sesspop` would dismiss the dialog and the item the reader was reading.
    if (popoverOpen() !== null) return;
    // One un-floats, a second closes. The alternative — one Escape dismissing
    // both at once — is the gesture a MODAL would answer to, and this is
    // deliberately not a modal: the rail and the body stay usable behind the
    // floating pane, so leaving the expanded view is a separate act from
    // leaving the item.
    if (paneIsFloating()) { setPaneFloat(false); return; }
    closePane();
  });
}

/**
 * ══ THE TITLE-BAR POPOVERS — `#sesspop` and `#focuspop` ═══════════════════
 *
 * `plan:walk seq:115`. Both triggers shipped with `aria-haspopup="dialog"` and
 * a permanent `aria-expanded="false"`, and neither dialog had markup anywhere:
 * two controls in the title bar that did nothing when pressed, reported by the
 * owner. This is the mechanism they were missing, and there is exactly ONE of
 * it — the pane is the other dialog in this shell and it is a different shape
 * (it opens from a click on an item, not from a trigger that must announce its
 * own state), so this does not try to be both.
 *
 * The behaviour is the design of record's, read off `web-ui-mockup.html`'s own
 * script (~4736-4750) rather than invented:
 *
 *   · ONE AT A TIME. Opening either closes the other. They share a corner of
 *     the screen — `.pop{inset-block-start:42px;inset-inline-end:var(--sp-3)}`
 *     seats both in the same place — so two open at once is two dialogs
 *     stacked on one another.
 *   · FOCUS MOVES IN, to the first `.row`. A dialog that opens without taking
 *     focus strands a keyboard user: the trigger is still focused, the content
 *     is after it in DOM order, and Tab walks INTO the dialog only by luck of
 *     ordering. Both dialogs are authored so their first `.row` is a real
 *     choice.
 *   · AND FOCUS COMES BACK. Escape returns it to the trigger — the one thing
 *     the mockup does NOT do, and the reason it is here: the mockup's Escape
 *     hides the popover and leaves `document.activeElement` inside a
 *     `display:none` subtree, which drops focus to `<body>` and loses the
 *     reader's place in the page. An outside CLICK deliberately does not move
 *     focus, because the click has already put it where the reader aimed.
 *
 * `aria-expanded` is set on every transition and from ONE place, so it cannot
 * describe a state the dialog is not in.
 */
const POPOVERS = [
  { trigger: 'sessbtn', dialog: 'sesspop' },
  { trigger: 'focusbtn', dialog: 'focuspop' },
];

/** The id of the open dialog, or `null`. The one place that answer lives. */
let popoverId = null;

function popoverOpen() { return popoverId; }

/**
 * Hide every popover and tell every trigger it is collapsed.
 *
 * `restoreFocus` is the difference between the two dismissals, and it is not a
 * detail: Escape is a keyboard gesture and must hand focus back to the control
 * the reader opened the dialog from, while a click outside has already placed
 * focus deliberately and must not have it yanked away.
 */
function closePopovers(restoreFocus) {
  const was = popoverId;
  popoverId = null;
  for (const { trigger, dialog } of POPOVERS) {
    const pop = document.getElementById(dialog);
    if (pop !== null) pop.hidden = true;
    document.getElementById(trigger)?.setAttribute('aria-expanded', 'false');
  }
  if (!restoreFocus || was === null) return;
  const owner = POPOVERS.find((entry) => entry.dialog === was);
  if (owner !== undefined) document.getElementById(owner.trigger)?.focus();
}

/**
 * Open `dialog`, or close it if it is already the open one.
 *
 * Closing via the trigger keeps focus ON the trigger — the reader is already
 * there, having just pressed it, and moving focus after a press that CLOSED
 * something would be the shell taking a step the reader did not ask for.
 */
function togglePopover(dialog) {
  const wasOpen = popoverId === dialog;
  // Closed FIRST and unconditionally, before the dialog is even looked up. The
  // interim state this shell is in until `#focuspop` lands is exactly why:
  // `#focusbtn` resolves to no element, and an early return above this line
  // would leave `#sesspop` open behind a press of the OTHER trigger — one
  // popover at a time, whether or not the one being asked for exists.
  closePopovers(false);
  const pop = document.getElementById(dialog);
  if (pop === null) return;
  const trigger = POPOVERS.find((entry) => entry.dialog === dialog)?.trigger ?? null;
  if (wasOpen) {
    if (trigger !== null) document.getElementById(trigger)?.focus();
    return;
  }
  pop.hidden = false;
  popoverId = dialog;
  if (trigger !== null) document.getElementById(trigger)?.setAttribute('aria-expanded', 'true');
  // The first CHOICE, not the dialog box: `.row` is a real button either way
  // (`#sesspop`'s cold row is authored in the markup, so this is never empty
  // even before `/api/sessions` answers), and focusing a `<div role="dialog">`
  // would need a `tabindex` on it and would announce the whole dialog before
  // the reader could act.
  pop.querySelector('.row')?.focus();
  // **The tag vocabulary is read on the OPEN**, not at install and not once.
  // `void`, deliberately: the dialog is already on screen and focused by the
  // time the request settles, and awaiting here would delay the open behind a
  // corpus read. `paintFocusPicker()` draws the not-yet-read state until it
  // lands, so there is never an unexplained empty box.
  if (dialog === 'focuspop') {
    void readFocusVocabulary();
    void readFocusCatalogue();
  }
}

/**
 * ══ `#focuspop` — WHAT THE DIALOG COMPOSES ════════════════════════════════
 *
 * Which of the two rows is chosen. `'live'` on arrival, matching the
 * `aria-selected="true"` the markup authors on that row, so the dialog's first
 * paint and its first keystroke agree about which choice is standing.
 *
 * This is a property of the DIALOG, not of the corpus: it says which command
 * the reader is composing, never which focus is set. What IS set is
 * `state/focus.json`, read by the server and drawn on the status strip and in
 * `#focuslbl` — see `drawIdentity()`.
 */
let focusChoice = 'live';

/**
 * The argv the dialog's current state composes — `mycontext` included, because
 * that is what a person types and what Copy hands to a shell.
 *
 * THE THREE LINES, AND WHY EACH IS THE FLAG IT IS. Read off the real command
 * (`node src/cli/index.ts help cli`, and `core/command-flags.ts`'s accept-list
 * `['tag','category','scope','clear','show','preview','relations','json']`)
 * rather than off any prose about it:
 *
 *   · **off** → `--clear`. The command's own spelling for "stop narrowing".
 *   · **live, with tags** → `--tag <tags>`. `<tag>…` positionals and `--tag a,b`
 *     are both real; the flag is the form the usage line and the flag table
 *     document, and one spelling is what keeps the composed line and the
 *     confirm the same string.
 *   · **live, no tags** → `--show`. The honest answer to "the focus that is
 *     set" when the reader has narrowed nothing: report it. A dialog that
 *     composed a bare `mycontext focus` would compose a command that sets a
 *     focus of nothing, which is not what the row says.
 *
 * The tags are read from the box at call time and TRIMMED, so a box holding
 * only spaces composes `--show` rather than `--tag "   "`.
 */
function focusArgv() {
  if (focusChoice === 'off') return ['mycontext', 'focus', '--clear', '--yes'];
  const tags = (document.getElementById('focustags')?.value ?? '').trim();
  if (tags === '') return ['mycontext', 'focus', '--show'];
  return ['mycontext', 'focus', '--tag', tags, '--yes'];
}

/**
 * **`--yes` is on the two WRITE lines and on neither read — the owner's ruling
 * of 2026-09-04 ("writes take the boundary, the read does not") composed
 * rather than described.**
 *
 * `mycontext focus` joined the approval boundary on that ruling
 * (`DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the`): it accepts
 * `--yes`, `confirmAction` gates `--clear` and the set, and the three
 * reporting forms refuse the flag BY NAME (`cli/commands/focus.ts`). So the
 * three lines this dialog composes are no longer alike, and the line has to
 * say which is which:
 *
 *   · `--clear --yes` and `--tag <tags> --yes` are writes, and the flag is
 *     SHOWN rather than implied — `lib/palette-defs.js` holds every other
 *     boundary command to exactly that ("`--yes` shown rather than hidden"),
 *     because the confirm a reader is being asked to give is the thing they
 *     are reading. It is also what makes the copied line work where it is
 *     pasted: off a TTY the command refuses without it.
 *   · `--show` takes no `--yes` AND MUST NOT BE GIVEN ONE. The CLI refuses it
 *     there, so composing it would hand the reader a line that does not run —
 *     and it would ask, in the owner's words, "are you sure you want to report
 *     something?".
 *
 * `e2e/focus-picker.spec.ts` asserted all three of these lines and was
 * re-taken with this change rather than adjusted around it.
 */

/**
 * The catalogue id for the line now composed, or `null`.
 *
 * **`null` for `--show`, and that is the ruling at the UI layer rather than a
 * gap.** A read needs no confirm, so it is handed to the shared control with
 * no id and gets Copy alone — the same treatment `screens/port.js` and
 * `screens/proc.js` get, for their own reasons.
 *
 * `null` for the WRITES TOO, until `lib/palette-defs.js` carries a `focus`
 * entry — and that file belongs to another lane. The client sends an id and
 * never a command (spec §3.1), so an id the server's catalogue cannot resolve
 * is a confirm that 400s rather than a button that works. `focusCatalogued` is
 * read from the catalogue itself rather than assumed, so the day the entry
 * lands Execute appears here with no edit, and `e2e/focus-picker.spec.ts`
 * fails on its Copy-only assertion so that the change is taken deliberately.
 */
function focusCommandId(argv) {
  if (!focusCatalogued) return null;
  return argv.includes('--yes') ? 'focus' : null;
}

/** The value bag the server rebuilds that same argv from. */
function focusCommandValues(argv) {
  if (!argv.includes('--yes')) return {};
  if (argv.includes('--clear')) return { clear: true, yes: true };
  return { tag: argv[argv.indexOf('--tag') + 1], yes: true };
}

/**
 * Whether `lib/palette-defs.js` names `focus`. Read once, lazily, on the first
 * open of the dialog — a static import would load the whole catalogue into
 * every page load for a popover nobody has pressed.
 */
let focusCatalogued = false;

async function readFocusCatalogue() {
  try {
    const { PALETTE } = await import('/lib/palette-defs.js');
    focusCatalogued = PALETTE.some((def) => def.name === 'focus' && def.kind === 'write');
  } catch {
    // A catalogue that cannot be read is a catalogue with no entry: Copy alone,
    // which is the safe direction. Nothing here may fabricate an id.
    focusCatalogued = false;
  }
  paintFocusCommand();
}

/* ══ THE TAG PICKER ═══════════════════════════════════════════════════════
 *
 * `REQ-the-focus-dialog-offers-the-tags-it-could-focus-on-with-the`, owner
 * request 2026-09-02: *"i would like to have such a generated check box list
 * with the item counts in the dialog so user could select there and not have
 * to remember them"*.
 *
 * ── THE BOX IS THE MODEL, and that is the whole design ────────────────────
 *
 * `#focustags` holds the comma-separated list `focusArgv()` already composes
 * from. Ticking a checkbox writes into it; typing into it re-marks the
 * checkboxes. So there is ONE list of tags in this dialog, `focusArgv()` is
 * unchanged, and the tag axis's semantics cannot drift: `core/select.ts`
 * matches an item that carries ANY of the tags (`focus.tags.some(…)`), and a
 * picker holding its own parallel state is how a second reading — "all of
 * these" — gets built without anyone deciding to build one.
 *
 * It also keeps the escape hatch a picker alone would take away: a tag no item
 * carries yet cannot be ticked, and can still be typed.
 *
 * ── THE TWO CLASSES, and why they are two controls ────────────────────────
 *
 * Owner ruling on presentation, 2026-09-04: **free-form tags as checkboxes,
 * projected tags behind their prefix.** `/api/tags` serves them already split,
 * derived from the categories' own `projectsTo` declarations rather than from
 * a list here — see `TagsBody` for the measurement (431 tags on this corpus,
 * of which 217 are `seq:` values alone).
 *
 *   · free-form — a membership a person chose. One checkbox each, carrying the
 *     number of items that have it.
 *   · projected — GENERATED from a frontmatter field, and hand-writing one is
 *     refused by `mutate.ts`. One `<select>` per prefix, because the field
 *     holds one value: picking `plan:builder` replaces whatever `plan:` token
 *     the box held rather than adding a second, which is `reconcileTags`'s own
 *     rule (core/tag-projection.ts) arriving in the UI.
 */

/**
 * The vocabulary `/api/tags` last answered, or `null` before the first read.
 *
 * `null` and `{ free: [], projected: [] }` are different states and both are
 * drawn: the first says "not read yet", the second says "this corpus has no
 * tags". They are the two halves of
 * `LESSON-on-real-data-an-absent-feature-and-a-missing-feature-look`, and one
 * empty box would be indistinguishable from either.
 */
let focusVocabulary = null;

/** What the last read failed with, or `null`. Drawn rather than swallowed. */
let focusVocabularyError = null;

/** The tags the box names, in the order it names them. */
function tagsInBox() {
  return (document.getElementById('focustags')?.value ?? '')
    .split(',').map((tag) => tag.trim()).filter((tag) => tag !== '');
}

/**
 * Replace the box's list, then recompose and re-mark.
 *
 * Joined with `,` and no space, which is what `--tag` takes and what keeps the
 * composed line inside `quoteArg`'s safe set — a space would quote the line,
 * which is correct and noisier to read for no gain.
 */
function setTagsInBox(tags) {
  const box = document.getElementById('focustags');
  if (box === null) return;
  box.value = [...new Set(tags)].join(',');
  paintFocusCommand();
  markFocusPicks();
}

/**
 * Mark every control FROM the box, never the other way round.
 *
 * Derived on every paint rather than remembered, so a tag typed by hand ticks
 * its checkbox and a tag deleted by hand unticks it — and so a redraw of the
 * picker cannot disagree with the line the dialog is showing.
 */
function markFocusPicks() {
  const host = document.getElementById('focuspick');
  if (host === null) return;
  const chosen = new Set(tagsInBox());
  for (const box of host.querySelectorAll('input[type="checkbox"][data-tag]')) {
    box.checked = chosen.has(box.dataset.tag);
  }
  for (const select of host.querySelectorAll('select[data-prefix]')) {
    const prefix = `${select.dataset.prefix}:`;
    // The FIRST tag under this prefix, which is the rule `projectedTagValues`
    // and `reconcileTags` already follow: a corpus that somehow carries two
    // keeps its first, and the select does not silently claim the second.
    const held = [...chosen].find((tag) => tag.startsWith(prefix)) ?? '';
    // A value the corpus no longer carries leaves `selectedIndex` at -1, so
    // the select shows blank rather than snapping to its first option and
    // claiming a choice the box does not hold.
    select.value = held;
  }
}

/** One free-form tag as a checkbox, with the number of items carrying it. */
function tagCountRow(count, eligible) {
  const row = document.createElement('label');
  row.className = 'tagpick';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.dataset.tag = count.tag;
  const name = document.createElement('span');
  name.className = 'tagname';
  name.textContent = count.tag;
  const number = document.createElement('span');
  number.className = 'tagn';
  number.textContent = String(count.items);
  // **The whole truth goes in the title, and the count stays the count.** A
  // focus never hides a hard rule, a pinned item or a continuity item, so what
  // `--tag v2` INJECTS is larger than the number of items carrying `v2` — 11
  // carried and 107 injected for `a11y` on this repository's own corpus,
  // measured 2026-09-04. The discriminating number is the one on screen; the
  // honest one is one hover away, and neither is hidden.
  row.title = flat(table.strings, 'focus.tagn', {
    items: String(count.items), tag: count.tag,
    visible: String(count.visible), eligible: String(eligible),
  });
  row.append(box, name, number);
  return row;
}

/** One projected prefix as a select — "pick a plan", never 217 checkboxes. */
function projectedPicker(group, eligible) {
  const wrap = document.createElement('div');
  wrap.className = 'tagproj';
  const label = document.createElement('label');
  label.className = 'small m';
  label.htmlFor = `focusproj-${group.prefix}`;
  label.append(...translate(table.strings, 'focus.proj', { prefix: group.prefix }));
  const select = document.createElement('select');
  select.id = `focusproj-${group.prefix}`;
  select.dataset.prefix = group.prefix;
  select.title = flat(table.strings, 'focus.projn', {
    fields: group.fields.join(', '), cmd: group.commands.join(' / '),
  });
  const any = document.createElement('option');
  any.value = '';
  any.textContent = flat(table.strings, 'focus.projany');
  select.append(any);
  if (group.options.length === 0) {
    // A DECLARED prefix nobody uses yet is a real state and is said, not
    // dropped: "this project has no plans" and "this project cannot have
    // plans" must not render as the same empty select.
    const none = document.createElement('option');
    none.value = '';
    none.disabled = true;
    none.textContent = flat(table.strings, 'focus.projnone', { prefix: group.prefix });
    select.append(none);
  }
  for (const option of group.options) {
    const node = document.createElement('option');
    node.value = option.tag;
    node.textContent = `${option.tag} · ${option.items}`;
    node.title = flat(table.strings, 'focus.tagn', {
      items: String(option.items), tag: option.tag,
      visible: String(option.visible), eligible: String(eligible),
    });
    select.append(node);
  }
  wrap.append(label, select);
  return wrap;
}

/**
 * Draw the picker from the last read.
 *
 * Rebuilt whole, like `paintFocusCommand()` and for its reason: the checked
 * state is derived from the box at the end of this function, so a half-patched
 * list cannot carry a mark belonging to a tag that is no longer there.
 */
function paintFocusPicker() {
  const host = document.getElementById('focuspick');
  if (host === null) return;

  const aside = (key) => {
    const note = document.createElement('p');
    note.className = 'aside';
    note.append(...translate(table.strings, key));
    return note;
  };

  if (focusVocabularyError !== null) {
    host.replaceChildren(aside('focus.pickerr'));
    return;
  }
  if (focusVocabulary === null) {
    host.replaceChildren(aside('focus.picking'));
    return;
  }

  const { free, projected, eligible } = focusVocabulary;
  const nodes = projected.map((group) => projectedPicker(group, eligible));

  if (free.length === 0) {
    nodes.push(aside('focus.pickn'));
  } else {
    const caption = document.createElement('p');
    caption.className = 'aside';
    caption.append(...translate(table.strings, 'focus.free', {
      n: String(free.length), eligible: String(eligible),
    }));
    const list = document.createElement('div');
    list.className = 'tagpicks';
    list.append(...free.map((count) => tagCountRow(count, eligible)));
    // **The OR is on screen, not only in the code.** `matchesFocus` accepts an
    // item carrying ANY of the chosen tags, and the requirement warns in those
    // words that "a picker that reads as AND would silently narrow to nothing".
    // A checkbox list is read as AND by default, so the sentence is drawn.
    nodes.push(caption, list, aside('focus.any'));
  }
  host.replaceChildren(...nodes);
  markFocusPicks();
}

/**
 * Read the vocabulary, on every OPEN of the dialog rather than once.
 *
 * `/api/tags` costs one `store.all()` plus a 9ms sweep (measured on this
 * corpus, 431 tags × 779 eligible items — see `apiTags`), and the alternative
 * to re-reading is a cache that every item write has to invalidate.
 * `RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it` is the same
 * argument from the other side: a tag added since the dialog last opened has
 * to be there when it opens again.
 *
 * NOT read at install. The dialog is authored `hidden`, and paying a corpus
 * read at page load for a popover nobody has pressed is the cost this shell
 * already refuses for every screen it has not routed to.
 */
async function readFocusVocabulary() {
  try {
    focusVocabulary = await api('/api/tags');
    focusVocabularyError = null;
  } catch (error) {
    // Kept and DRAWN. A picker that silently rendered nothing on a failed read
    // would be indistinguishable from a corpus with no tags, which is the one
    // confusion this endpoint exists to end.
    focusVocabulary = null;
    focusVocabularyError = error;
  }
  paintFocusPicker();
}

/**
 * Draw the composed line and the control that acts on it.
 *
 * **The id is DERIVED per line now, and the sentence that used to stand here
 * is false.** It said `focus` "takes no `--yes`, so `approvalBoundary()` does
 * not place it on the boundary at all". Since the owner's ruling of 2026-09-04
 * it does take `--yes`, and the derivation puts it on the boundary — the
 * fourteenth member — so the reason for Copy-alone has changed and is no longer
 * the same reason for all three lines this dialog composes:
 *
 *   · `--show` gets `id: null` BY THE RULING. It is a read, it needs no
 *     confirm, and `lib/command-actions.js` gives Copy alone to a composition
 *     the catalogue cannot name. `screens/port.js` and `screens/proc.js` pass
 *     `id: null` for reasons of their own; this one is a design decision.
 *   · the two WRITES get `id: 'focus'` the moment `lib/palette-defs.js` carries
 *     that entry, and `null` until then — read from the catalogue rather than
 *     assumed (`focusCommandId`). That file belongs to another lane; the entry
 *     it needs is `kind: 'write'`, `boundary: true`, `base: ['mycontext',
 *     'focus']`, flags `tag`/`category`/`scope`/`clear`/`yes`, with `show`,
 *     `preview`, `relations` and `json` named in `FLAGS_NOT_OFFERED` because a
 *     boundary entry has no business composing a report.
 *
 * What that buys is the thing the ruling asks for: ONE approval route. The
 * dialog does not post, does not write and does not grow a confirm of its own;
 * it composes, and the shared control decides what may be done with the line.
 *
 * Rebuilt whole on every change rather than patched: the control is stateless
 * between compositions (its result region belongs to the line that produced
 * it), and a stale Copy button beside a changed line is the drift the
 * composed-and-shown design exists to prevent.
 */
function paintFocusCommand() {
  const code = document.getElementById('focusargv');
  const host = document.getElementById('focusact');
  if (code === null || host === null) return;
  for (const row of document.querySelectorAll('#focuspop .row[data-focus]')) {
    row.setAttribute('aria-selected', String(row.dataset.focus === focusChoice));
  }
  const argv = focusArgv();
  code.textContent = composeCommand(argv);
  // `window.myctx` rather than a ctx assembled here: the control reaches
  // `t()`, `announce()` and the execute doors through the ONE shell contract
  // every screen already uses, so this dialog gets no private surface.
  host.replaceChildren(commandActions({
    argv, id: focusCommandId(argv), values: focusCommandValues(argv), ctx: window.myctx,
  }));
}

/**
 * The document-level wiring, installed once and BEFORE `installItemPane()` —
 * see the Escape guard there for why the order is load-bearing.
 *
 * Delegated from the document rather than bound to each dialog, for the same
 * reason the item pane is: `#sesslist`'s rows are rebuilt on every session read
 * and a listener bound to a row would be a listener on a discarded element.
 */
function installPopovers() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('#sessbtn, #focusbtn');
    if (trigger !== null && trigger !== undefined) {
      togglePopover(trigger.id === 'sessbtn' ? 'sesspop' : 'focuspop');
      return;
    }
    const inside = event.target.closest?.('.pop');
    if (inside === null || inside === undefined) {
      // A CLICK OUTSIDE dismisses — and this is the branch, not a listener on
      // the two dialogs that calls `stopPropagation()` the way the mockup does.
      // Swallowing every click inside a popover would also swallow it before
      // `installItemPane`'s delegation ran, and the two dialogs sit in the same
      // document as every `[data-id]` in the product.
      closePopovers(false);
      return;
    }
    // ── Inside `#sesspop`: choosing a session ─────────────────────────────
    //
    // **THIS IS THE READ THE TASK EXISTS FOR, and it writes nothing.** It moves
    // `sessionValue`, which is what `ctx.session()` answers and what every
    // screen builds its next request from; the server is never told, because
    // there is nothing on the server to tell. That is why there is no
    // confirmation here and no `POST` — compare `#focuspop`, which composes a
    // command line and still needs an Execute behind the approval boundary.
    // ── Inside `#focuspop`: composing a line, and writing NOTHING ─────────
    //
    // The opposite case to the one below, and the reason both live in one
    // handler: a choice here moves `focusChoice` and redraws the composed
    // line, and the dialog STAYS OPEN because its whole answer is the line
    // inside it — there is somewhere left to look, which is exactly what is
    // not true of the session picker. Applying the line is the shared
    // control's act, behind its confirm; nothing on this path posts.
    const choice = event.target.closest?.('#focuspop .row[data-focus]');
    if (choice !== null && choice !== undefined) {
      const next = choice.dataset.focus;
      if (typeof next !== 'string' || next === '') return;
      focusChoice = next;
      paintFocusCommand();
      return;
    }
    const row = event.target.closest?.('#sesspop [data-sid], #sesspop [data-cold]');
    if (row === null || row === undefined) return;
    const chosen = row.dataset.cold !== undefined ? 'cold' : row.dataset.sid;
    if (typeof chosen !== 'string' || chosen === '') return;
    setSession(chosen);
    // Closed on the choice, focus back on the trigger: the picker's whole
    // answer is the label the trigger now carries, so there is nothing left in
    // the dialog to look at. (`#focuspop` deliberately does the opposite — the
    // line its choice composes lives INSIDE it.)
    closePopovers(true);
  });
  // The tag box recomposes as it is typed. Delegated from the document like
  // everything else here, and narrowed by id rather than by a `.pop` ancestor
  // test: this is the only input the title bar has, and a handler that fired
  // for every input in the product would be a handler running on every
  // keystroke of every screen's forms.
  //
  // **And the picker is re-marked from the box, never the reverse.** Typing
  // `v2` ticks its checkbox; deleting it unticks it. One list, one direction.
  document.addEventListener('input', (event) => {
    if (event.target?.id !== 'focustags') return;
    paintFocusCommand();
    markFocusPicks();
  });
  // ── The picker writes INTO the box ───────────────────────────────────────
  //
  // `change` and not `click`: a checkbox reached by keyboard (Space) fires no
  // click on some platforms and always fires change, and a `<select>` has no
  // click at all worth listening to. Delegated from the document for the
  // reason everything else here is — `#focuspick` is rebuilt on every open, so
  // a listener bound to a row would be bound to a discarded element.
  document.addEventListener('change', (event) => {
    const box = event.target?.closest?.('#focuspick input[type="checkbox"][data-tag]');
    if (box !== null && box !== undefined) {
      const tag = box.dataset.tag;
      if (typeof tag !== 'string' || tag === '') return;
      // ADDED to the end and REMOVED in place — the reader's own order is kept,
      // because the box is a line they can also type into and reordering it
      // under their cursor is the shell taking a step they did not ask for.
      const held = tagsInBox();
      setTagsInBox(box.checked ? [...held, tag] : held.filter((t) => t !== tag));
      return;
    }
    const select = event.target?.closest?.('#focuspick select[data-prefix]');
    if (select === null || select === undefined) return;
    const prefix = `${select.dataset.prefix}:`;
    // **One value per prefix, which is what a projection IS.** The tag is
    // generated from a field that holds one value (`core/tag-projection.ts`,
    // `reconcileTags`: "the first tag under the prefix keeps its SLOT and
    // takes the new value; any further tag under the same prefix is dropped").
    // A select that ADDED would compose `--tag plan:walk,plan:builder`, which
    // the CLI accepts and which asks for items in either plan — a different
    // question from the one the control appears to ask.
    const kept = tagsInBox().filter((t) => !t.startsWith(prefix));
    setTagsInBox(select.value === '' ? kept : [...kept, select.value]);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (popoverId === null) return;
    closePopovers(true);
  });
  // The opening composition, drawn once at install so the dialog is never
  // opened onto an empty `.cmd`. `#focuspop` is authored `hidden`, so this
  // costs one paint of two elements nobody is looking at yet.
  paintFocusCommand();
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
  // **A request this page already knows the answer to is not sent.**
  //
  // See `credentialHeld()` for the measurement. With no token in memory, none
  // in `sessionStorage` and no marker cookie for THIS server, the gate's
  // answer is fixed before the socket opens: `validateApiRequest` finds
  // neither `x-mycontext-token` nor `mycontext_token`, and returns
  // `401 token-missing`. Sending it anyway buys one thing — an `access` record
  // appended and projected under `BEGIN IMMEDIATE`, on the page's own boot.
  //
  // **`'401'` is not a pretence that the server was reached; it is the answer
  // the gate gives, computed rather than fetched.** A refusal carries a status
  // line and nothing else (owner ruling A4), so `refusalDetail()` on a real
  // token-missing response returns this exact string. Keeping it byte-identical
  // is deliberate: every caller — the screens, `fillProvenance`'s
  // `prov.projFailed`, `ctx-post.spec.ts` — sees precisely what it saw before,
  // and no new sentence reaches the page from here. What changes is only that
  // the audit log no longer records the app refusing itself.
  //
  // `showDisconnected()` for the same parity: today the first 401 of a
  // credential-less boot is what raises the banner, and the reader is owed it
  // whether the refusal travelled or not. `route()`'s `sess.nocred` note still
  // arrives by its own path — `noCredential` is cleared only where
  // `loadSessions()` gets a real answer, and this branch is not one.
  if (!credentialHeld()) {
    showDisconnected();
    throw new Error('401');
  }
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

/**
 * How much history the ONE connection replays on open — see the import
 * comment above for why this is a literal and not an import of `watch.js`'s
 * `FEED_CAP`, which it must equal. Only `watch.js` reads the `hello` frame's
 * `backlog` field today, but the number is the connection's own property
 * (`plan:live seq:1`), not any one screen's, so it lives here rather than
 * being threaded through `subscribeStream()` as a per-caller argument.
 */
const SHARED_STREAM_BACKLOG = 200;

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
  // **A credential-less page opens no connection, and does not spend its ONE
  // chance to open one either.**
  //
  // `/api/watch/stream` is the tenth of the ten refusals a credential-less boot
  // used to record (see `credentialHeld()`), and it was the most expensive of
  // them to answer with a fault: `liveStop` is set once and never cleared —
  // "reopening after a fault would be exactly the reconnection §2 forbids" —
  // so a stream refused during a boot with no token left the page with no live
  // connection FOR THE REST OF ITS LIFE, including after a pasted nonce
  // redeemed it in place. The recovery path re-runs every read; it could not
  // re-run this.
  //
  // Returning without setting `liveStop` is what distinguishes "not opened"
  // from "opened and died". Nothing is faulted, because nothing connected —
  // announcing a dead stream the page never had would be the same false
  // certainty in the other direction. `route()` subscribes on every screen it
  // builds, so the redemption's own `route()` is what opens it for real.
  if (!credentialHeld()) return;
  liveStop = stream(`/api/watch/stream?backlog=${SHARED_STREAM_BACKLOG}`, dispatchLiveEvent, () => {
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

/* ══ LIVE INVALIDATION — ACTING ON WHAT live-invalidation.js DECLARES ═══════
 *
 * `plan:live seq:3`. `seq:2` built `SCREEN_INVALIDATION` and left it inert on
 * purpose ("nothing here re-renders anything" — that file's own header). This
 * is the one place that changes: `route()` reads `SCREEN_INVALIDATION[name]`
 * for the screen it just built and subscribes on the screen's behalf, so a
 * screen module never imports live-invalidation.js and never re-renders
 * itself off the stream — the same division `subscribeStream()` already
 * draws between "the door" and "who walks through it".
 *
 * `watch` is excluded outright (`EXCLUDED_FROM_GENERIC_LIVE_REFRESH`): it has
 * subscribed to the shared stream itself since `seq:1` and redraws its own
 * rows incrementally. Wiring it again here would be a second, coarser
 * subscriber undoing the first screen's own fine-grained one.
 */
const EXCLUDED_FROM_GENERIC_LIVE_REFRESH = new Set(['watch']);

/**
 * **WHICH ROUTE OWNS THE SCREEN.** Taken at the top of `route()`, checked at
 * every point after an `await` that would write state OUTLIVING that call.
 *
 * ── THE DEFECT IT CLOSES, MEASURED ────────────────────────────────────────
 *
 * `route()` opens with `teardownLiveScreen()` and ends with
 * `setupLiveScreen(name, mod, section)`, which writes `currentScreenRefresh` —
 * the closure `noteExecuteSettled` calls to redraw the screen a command was run
 * on. Between those two points it AWAITS twice (the dynamic import, then the
 * render), and `route()` is entered from `hashchange` as `void route()`. So a
 * hash change landing inside the first route's render starts a second one, and
 * whichever finishes LAST took the slot — not whichever the reader is looking
 * at.
 *
 * It is not symmetric, which is why it was reproducible rather than rare:
 * `doctor` is one `/api/doctor`, and the landing `preview` is five sequential
 * fetches. Click a rail button while the landing screen is still loading and
 * preview finishes second EVERY time. Measured 2026-09-03: after
 * `POST /api/execute` on the visible Doctor screen the page fetched `select`,
 * `simulate`, `items`, `coverage`, `injection-history` — preview's endpoint set
 * — and not one `/api/doctor`, though the ruling was on disk and the read model
 * returned it. `e2e/doctor-outcome.spec.ts` had to reach Doctor by RELOADING
 * rather than by changing the hash, and said so in its own comment.
 *
 * ── WHY A GENERATION AND NOT A LOCK OR A CANCEL ───────────────────────────
 *
 * A lock would make the reader wait for a screen they have already left. A
 * cancel would need an `AbortSignal` threaded through `mod.render(root, ctx)`,
 * a contract twenty-one screen modules implement, to unsend fetches that
 * `sectionRender`'s own header already rules cannot be unsent ("Chained rather
 * than cancelled ... a render abandoned halfway leaves a half-drawn screen").
 * A superseded render is not itself dangerous — every screen has its OWN
 * `[data-p]` section and `renderScreen` queues per section, so it draws into a
 * hidden element nobody is reading, and the only way back to that section is a
 * `route()` that redraws it first. What is dangerous is the SHARED state it
 * writes AFTERWARDS. So the loser is allowed to finish and forbidden to
 * install, and at the one point where a doomed route can be stopped before it
 * spends anything — between the import resolving and the render starting — it
 * is stopped.
 *
 * `e2e/route-race.spec.ts` drives it.
 */
let routeGeneration = 0;

/** Torn down and re-armed on every `route()` — one screen's subscription at a time. */
let liveScreenUnsub = null;
/** The single in-flight debounce timer for the CURRENT screen's subscription. */
let liveScreenTimer = null;
/**
 * **THE SINGLE SLOT, AND IT IS STILL SINGLE** — `plan:walk seq:116` moved
 * where this affordance is DRAWN and changed nothing about how many of it
 * there can be.
 *
 * The refresh the shown affordance would perform if pressed, or `null` while
 * it is hidden. ONE variable, for the reason it was always one: every screen's
 * `render()` opens with `root.replaceChildren()` and six of them then await an
 * endpoint and append, so two overlapping renders each clear an empty section
 * and each append a whole screen — measured in a browser on 2026-08-29 as
 * three hash writes in one turn drawing NINE `<h3>` where one render draws
 * three. A second pending refresh is a second render, so there is one slot and
 * taking it replaces whatever was in it.
 *
 * It is also still read at CLICK time rather than captured when the button is
 * built, which is what lets the button be rebuilt per screen without the
 * closure and the current route disagreeing.
 */
let pendingScreenRefresh = null;

/**
 * **The affordance renders WITH THE SCREEN IT ACTS ON** — owner ruling
 * 2026-08-31, *"move the refresh button to the screen"* (`plan:walk seq:116`).
 *
 * ── WHY IT MOVED ─────────────────────────────────────────────────────────
 *
 * It rendered at the end of the STATUS STRIP, whose every group refreshes
 * itself silently and on its own (`CHROME_INVALIDATION`, every row `auto`), so
 * a control sitting in that row reads as the strip's. The owner asked what it
 * was for *"if the status bar should be ongoing refreshed"*. Its own message
 * already answered — *"New activity for this screen"* — and the placement was
 * saying something else, louder.
 *
 * ── WHERE IT WENT: THE SCREEN'S TITLE ROW, IN A RESERVED SLOT ────────────
 *
 * Into the visible `[data-p]` section's `.phd` — the heading row `parts.js`'s
 * `screenHead()` builds for every screen — beside the screen's own name and
 * verdict. Owner, 2026-08-31: *"the refresh button should be move maybe to
 * title because now it overrides screen data."*
 *
 * The row is 37px tall WHETHER OR NOT this is in it, which is the whole design:
 * see `styles.css`'s `.phd` and `#screenstale` rules for the two failures a
 * reserved slot answers together — content covered (the overlay this replaces)
 * and content displaced (the 300px scroll defect the overlay was chosen to
 * avoid). Two properties had to survive the move and both are load-bearing:
 *
 *   1. **It may not move the reader's place.** `DEC-a-refresh-keeps-the-reader
 *      -s-place-or-it-asks` has an acceptance test that measures `.body`'s
 *      scrollTop across a refresh, and `plan:walk seq:64` measured a refresh
 *      discarding three of the owner's selections in one act. A block inserted
 *      into the section's flow would push every row down by its own height the
 *      instant it appeared. The reserved slot takes it OUT of that: the title
 *      row is already as tall as this control, so putting the control in it
 *      changes no height at all and `scrollTop` is untouched in both
 *      directions. (The placement this replaced achieved the same by overlaying
 *      the screen in its own grid cell, which is where the covering came from.)
 *   2. **It may not be erased by the render it is offering.** Every screen's
 *      `render()` opens with `root.replaceChildren()`, which would take this
 *      with it. It is not appended once and left: it is INSERTED when shown and
 *      REMOVED when hidden, and every path that re-renders (`act()` below,
 *      `route()`, `teardownLiveScreen`) hides it first. So there is no moment
 *      where a live affordance and a render are both touching the section.
 *
 * `#screenstale` keeps its ID, its `role="status"` and its `[hidden]`
 * specificity fix — `#screenstale[hidden]{display:none}` in `styles.css`, which
 * exists because `#screenstale{display:flex}` is an ID rule and outranks the
 * user agent's `[hidden]` attribute selector. That defect shipped once already
 * ("New activity for this screen." painted on every screen from boot, with a
 * Refresh button offering to reload a screen that had not gone stale), and
 * removing the element from the DOM when hidden does not make the rule
 * redundant: the element is `hidden` for the frame between construction and
 * insertion, and `showLiveFault`'s neighbour rule shares the selector list.
 *
 * `onTake` is what pressing its control does.
 */
function showLiveAffordance(onTake) {
  pendingScreenRefresh = onTake;
  const body = document.getElementById('screen');
  if (body === null) return;
  // **WHERE THE READER WAS READING WHEN THIS APPEARED**, captured here and used
  // by `act()` instead of the offset at the moment the control is pressed.
  //
  // This is what the title-row placement costs and how it is paid. The old
  // OVERLAY was `position:sticky` at the top of the scroll container, so it was
  // on screen wherever the reader had scrolled to and pressing it moved nothing.
  // In the title row it scrolls away with the title, so reaching it means
  // scrolling back to the top — and `scrollTop` is 0 by the time the click
  // lands. Restoring THAT would return the reader to the top of a screen they
  // were reading the middle of, which is `DEC-a-refresh-keeps-the-reader-s-
  // place-or-it-asks` broken by the mechanism built to honour it.
  //
  // A reader's place is where they were reading, not where they had to go to
  // reach a button. Measured: without this, the decision's own acceptance test
  // reads 0 where it scrolled to 300.
  pendingScreenScroll = body.scrollTop;
  const el = affordanceElement();
  el.hidden = false;
  // **INTO THE VISIBLE SCREEN'S TITLE ROW** — owner, 2026-08-31: *"the refresh
  // button should be move maybe to title because now it overrides screen
  // data."*
  //
  // It used to go into `.body` and take the screens' own grid cell, which
  // OVERLAID the screen. That was a deliberate trade and it bought a real
  // property — with the body scrolled to 300px, an affordance inserted into the
  // flow moved `scrollTop` to 358, and `DEC-a-refresh-keeps-the-reader-s-place-
  // or-it-asks`'s acceptance test caught it — but the price was covering the
  // data the reader was looking at, which is the report above.
  //
  // Neither failure comes back, because the room is RESERVED rather than taken:
  // `.phd` is 37px tall on every screen whether or not this is in it (see its
  // rule in `styles.css`, carried byte-identical from the design of record).
  // Nothing is overlaid, because the affordance has a place of its own; nothing
  // shifts when it appears or is taken, because that place is there either way.
  // An affordance that appears by TAKING space it did not previously hold is
  // the 300px defect again in a new place.
  //
  // **`.phd` and not the section**, which is what makes the reservation
  // possible: it is one row, it is the first thing in every screen, and
  // `parts.js`'s `screenHead()` builds it for all of them. Falling back to
  // `body.prepend` for a screen that somehow has none keeps the affordance
  // reachable rather than silently dropping it — and that path is the OLD
  // placement, cell and all, so it is no worse than what it replaces.
  //
  // The order within the row is deliberate: APPENDED, after the heading and the
  // verdict, so a screen reader meets the screen's name first and then the
  // qualification about it. `role="status"` is what announces it out of order
  // to a reader who is elsewhere on the page; position is for the reader who
  // arrives at the top.
  //
  // `append` MOVES a node already in the document rather than copying it, so
  // the single-affordance guarantee survives the move exactly as it survived
  // `prepend`: one element cannot be in two title rows at once.
  const head = visibleSection()?.querySelector('.phd') ?? null;
  if (head === null) body.prepend(el);
  else head.append(el);
}

/**
 * Hide it — pressed, the reader navigated to a different screen, or the screen
 * is about to be redrawn anyway.
 *
 * Removed from the DOM rather than merely hidden, because the section it sits
 * in is about to be `replaceChildren()`-ed by whatever comes next and an
 * element that survives that by accident is an element nobody owns.
 */
function hideLiveAffordance() {
  pendingScreenRefresh = null;
  // Cleared with the affordance it belongs to: an offset kept past the notice
  // that recorded it would send a LATER refresh — an Execute run, an auto
  // redraw — to a place nobody was reading.
  pendingScreenScroll = null;
  if (screenStaleEl === null) return;
  screenStaleEl.hidden = true;
  screenStaleEl.remove();
}

/**
 * The section the reader is looking at.
 *
 * **The router keeps every visited screen inside `#screen`, merely hidden**
 * (`route()`'s own comment: the ones already visited stay in the DOM, exactly
 * as the mockup keeps all 21). So this is scoped to the VISIBLE one — a
 * `querySelector('[data-p]')` would find whichever screen was visited first and
 * hand a run's outcome to a page nobody can see.
 */
function visibleSection() {
  const body = document.getElementById('screen');
  if (body === null) return null;
  for (const section of body.querySelectorAll('[data-p]')) {
    if (!section.hidden) return section;
  }
  return null;
}

/**
 * The one affordance element, built on first use and reused ever after.
 *
 * ONE element for the whole page even though it is inserted into a different
 * section on every route, and that is the same argument the single
 * `pendingScreenRefresh` slot makes: one element cannot be in two sections at
 * once, so "the affordance is showing on two screens" is not a state this can
 * reach. `prepend` MOVES a node that is already in the document rather than
 * copying it, so the move is the removal.
 */
let screenStaleEl = null;
/**
 * `#screen`'s scroll offset at the moment the affordance went up, or `null`
 * when none is showing. See `showLiveAffordance` for why the offset at the
 * moment it is PRESSED is the wrong one to keep.
 */
let pendingScreenScroll = null;
function affordanceElement() {
  if (screenStaleEl !== null) return screenStaleEl;
  const stale = document.createElement('p');
  stale.id = 'screenstale';
  stale.className = 'small';
  stale.hidden = true;
  // `role=status`: the one line names WHAT ARRIVED, and a reader away from the
  // screen when it appears is exactly who an `aria-live` region is for — the
  // same treatment `budgetSaveControl`'s own result region gets in `config.js`.
  stale.setAttribute('role', 'status');
  const staleMsg = document.createElement('span');
  staleMsg.append(...translate(table.strings, 'live.screenStale'));
  // BOUND AND DISCLOSED. In the title row the message shares one line with the
  // screen's own heading, so `#screenstale>span:first-child` ellipsises it
  // rather than letting it wrap the row taller than the slot reserved for it.
  // An ellipsis with no way to the rest is the shape 05-dataviz.html's
  // bound-AND-disclose rule refuses, and this is the way to the rest — the same
  // treatment the context sentence in the strip already gets.
  staleMsg.title = flat(table.strings, 'live.screenStale');
  const staleBtn = document.createElement('button');
  staleBtn.type = 'button';
  staleBtn.className = 'icon';
  staleBtn.append(...translate(table.strings, 'btn.refresh'));
  // Reads `pendingScreenRefresh` at CLICK time, never captured here: this
  // button is built once, for the life of the page, and which screen it
  // refreshes changes on every route.
  staleBtn.onclick = () => { pendingScreenRefresh?.(); };
  stale.append(staleMsg, staleBtn);
  screenStaleEl = stale;
  return stale;
}

/**
 * Tear down whatever the PREVIOUS screen subscribed — called at the top of
 * `route()`, beside `closePane()`, for the identical reason: a subscription
 * opened by the screen that just left is not this one's to keep receiving,
 * and a pending affordance from a screen no longer on-screen is a promise
 * about content the reader cannot see any more.
 */
function teardownLiveScreen() {
  if (liveScreenUnsub !== null) { liveScreenUnsub(); liveScreenUnsub = null; }
  if (liveScreenTimer !== null) { clearTimeout(liveScreenTimer); liveScreenTimer = null; }
  // The same argument, for the Execute-driven refresh: `currentScreenRefresh`
  // closes over the PREVIOUS screen's module and section, and running it after
  // the reader has left would draw that screen into a section nobody is
  // looking at. `route()` sets a new one through `setupLiveScreen`.
  currentScreenRefresh = null;
  // And the outcome of the last run this page started: it is a statement about
  // a screen the reader has just left, and carrying it onto the next one would
  // be an exit code beside content it says nothing about.
  executeOutcome = null;
  hideLiveAffordance();
}

/**
 * The render in flight for each `[data-p]` section, so two never write to one
 * section at the same time.
 *
 * ── WHY THIS EXISTS, MEASURED ─────────────────────────────────────────────
 *
 * `TASK-the-preview-can-hold-two-renders-at-once-and-session` is written about
 * `preview.js`'s `show()`, and the same shape sits one level up in THIS file.
 * **Every screen's `render()` opens with `root.replaceChildren()`** — the
 * property `route()` and `setupLiveScreen` both already lean on, twice each,
 * in their own comments — and six of them then AWAIT an endpoint and append to
 * `root` afterwards (`config`, `coverage`, `doctor`, `packs`, `port`, `work`).
 * Two overlapping `render()` calls on one section therefore each clear an
 * already-empty section and each append a whole screen.
 *
 * It is reachable through the app's own doors, and it was measured in a
 * browser on 2026-08-29 over `.demo-corpus` rather than reasoned about:
 *
 *   three `location.hash` writes in ONE turn (`#/coverage`, `#/preview`,
 *   `#/coverage`)          Coverage drew NINE `<h3>` where one render draws
 *                          three — three whole screens stacked in one section.
 *   two un-awaited `render()` calls, which is exactly what `act()` below makes
 *                          SIX — two screens stacked.
 *
 * `route()` is entered from `hashchange` as `void route()`, and `act()` calls
 * `render()` without awaiting it by design, so neither had anything stopping a
 * second render from starting inside the first one's fetch.
 *
 * ── WHY SERIALIZED HERE RATHER THAN GUARDED IN EACH SCREEN ────────────────
 *
 * Because the ordering is this file's fact, not a screen's. A generation guard
 * is the right answer INSIDE a screen that re-enters its own loader —
 * `preview.js` and `injected.js` carry one, because their `show()` is called
 * again by their own controls and by the session. But `render()` is called by
 * the ROUTER, and twenty-one screens each re-deriving "am I still the current
 * render of my section" is twenty-one chances to get it wrong for a rule that
 * is true of all of them. One queue, at the one place that starts them.
 *
 * Chained rather than cancelled: a `fetch` already in flight cannot be
 * unsent, and a render abandoned halfway leaves a half-drawn screen, which is
 * the blank this project's own standard forbids. Each render therefore begins
 * where the last one finished — the section is written once per render, in
 * order, and the reader ends on the newest.
 *
 * A rejected render does not poison the queue: the next one still runs, and
 * the failure belongs to whoever awaited it. Keyed WEAKLY, because a section
 * is a DOM node this map must not keep alive.
 */
const sectionRender = new WeakMap();

/**
 * Render `mod` into `section`, after whatever was already rendering into it.
 * Every caller in this file goes through here; nothing calls `mod.render`
 * directly any more.
 */
async function renderScreen(mod, section) {
  const previous = sectionRender.get(section);
  const mine = (async () => {
    // Its rejection is its own caller's to handle — swallowed HERE only so one
    // failed render does not stop the next one from drawing.
    if (previous !== undefined) { try { await previous; } catch { /* not this render's */ } }
    await mod.render(section, window.myctx);
  })();
  sectionRender.set(section, mine);
  await mine;
}

/**
 * Subscribe the screen `route()` just built. `mod` and `section` are what
 * `render()` needs to be called again; `name` is the `SCREEN_INVALIDATION`
 * key. A screen with no entry, or `watch`, gets no subscription at all —
 * silence rather than a guess.
 *
 * **`event !== 'record'` is filtered out here, not upstream.** `hello` and
 * `fault` reach every subscriber regardless of `kinds` (`dispatchLiveEvent`'s
 * own rule, so a subscriber can always learn the stream itself died) — and
 * this subscriber's `kinds` may be `'*'` (`ask`), so without this check a
 * stream-level frame would be mistaken for "something this screen draws
 * arrived" and debounce a refresh nothing invalidated.
 *
 * **Debounced by `LIVE_INVALIDATION_DEBOUNCE_MS`, restarted on every
 * matching frame** — the same coalescing `live-invalidation.js`'s own header
 * argues for (one act, several rows off the stream), applied here rather
 * than left for every screen to reinvent.
 */
function setupLiveScreen(name, mod, section, generation) {
  // **A SUPERSEDED ROUTE MAY NOT INSTALL ITSELF.** `route()` checks this too,
  // one line before the call; it is checked AGAIN here because this function is
  // what actually writes the shared slots — `currentScreenRefresh`, and
  // `liveScreenUnsub`, which it overwrites WITHOUT unsubscribing, so a late
  // install both steals the Execute refresh and leaks the current screen's
  // subscription behind it. A guard that lives only at the call site is a guard
  // the next caller does not inherit. See `routeGeneration`.
  if (generation !== routeGeneration) return;
  const decl = SCREEN_INVALIDATION[name];

  const act = () => {
    // Read BEFORE `hideLiveAffordance()` clears it: this is the reading
    // position `showLiveAffordance` recorded when the notice went up, and it is
    // preferred over the live `scrollTop` for the reason written there. `null`
    // — every path that is not a taken affordance, such as an Execute run or an
    // auto redraw — falls through to the offset the reader is at now, which is
    // the same value the live read has always given those paths.
    const takenFrom = pendingScreenScroll;
    hideLiveAffordance();
    // **Every screen's `render()` opens with `root.replaceChildren()`**
    // (`route()`'s own comment on this, above) — for however long the
    // dynamic import already resolved and the fetch inside `render()` is
    // in flight, `section` sits EMPTY. `#screen` is the scroll container
    // (`.body{overflow-y:auto}`), and a browser clamps `scrollTop` to
    // whatever `scrollHeight` allows AT THAT INSTANT — it does not
    // remember the pre-clear value once content regrows. Measured: without
    // this, `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks`'s own
    // acceptance test failed with the scroll silently reset to 0, even
    // though nothing here ever calls `scrollTo` or touches `#screen`
    // directly. Captured before the rebuild and reasserted after, so the
    // FINAL state — the property the test actually measures — holds
    // regardless of what the browser does mid-rebuild.
    const scrollHost = document.getElementById('screen');
    const savedScroll = takenFrom ?? (scrollHost === null ? null : scrollHost.scrollTop);
    return renderScreen(mod, section).then(() => {
      // **AND THE REDRAW CHECKS AGAIN WHEN IT LANDS.** `act` can be held for a
      // while — in `currentScreenRefresh` across an Execute, in
      // `pendingScreenRefresh` behind an affordance the reader may take at
      // leisure — and `scrollHost` is `#screen`, ONE element shared by every
      // section. A restore arriving after the reader has routed away would set
      // the NEW screen's offset from the OLD screen's reading position, which
      // is `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` broken by the
      // mechanism built to honour it. `attachExecuteOutcome()` is skipped with
      // it and loses nothing: a route ran, so `teardownLiveScreen()` has
      // already dropped `executeOutcome`, and it would return at its own first
      // line anyway.
      if (generation !== routeGeneration) return;
      if (scrollHost !== null && savedScroll !== null) scrollHost.scrollTop = savedScroll;
      // **After EVERY redraw, not only the first.** One Execute is three
      // records — `execute`, the CLI's own `mutation`, `execute-done` — and the
      // debounced subscription below redraws for them too. Without this the
      // outcome was prepended by `noteExecuteSettled` and then wiped ~250ms
      // later by the very frames the run had produced: measured in the
      // `chromium` project on 2026-08-31, where the run reported `exit 0` and
      // the screen then swallowed it. See `attachExecuteOutcome`.
      attachExecuteOutcome();
    });
  };

  // **Held for the Execute path, and held for EVERY screen** — including the
  // ones with no `SCREEN_INVALIDATION` entry and `watch`, which are excluded
  // from the generic stream subscription below and are not excluded from this.
  // The two questions are different: "does a record off the stream make this
  // screen stale" is a per-screen declaration, while "did the reader just
  // change something through this app's own Execute control" is not a property
  // of the screen at all. `watch` redraws its own rows incrementally and would
  // be double-subscribed by the generic path; it is still a screen an Execute
  // can be run from, and it still gets redrawn by one.
  currentScreenRefresh = act;

  if (decl === undefined || EXCLUDED_FROM_GENERIC_LIVE_REFRESH.has(name)) return;

  liveScreenUnsub = subscribeStream(decl.kinds, (event) => {
    if (event !== 'record') return;
    if (liveScreenTimer !== null) clearTimeout(liveScreenTimer);
    const again = () => {
      liveScreenTimer = null;
      // **`act()` calls the screen's OWN `render()` directly — never
      // `route()`.** `route()` opens with `closePane()`; calling it here
      // would close the very pane this feature exists to keep open. Calling
      // `mod.render(section, ctx)` in place is what `DEC-a-refresh-keeps
      // -the-reader-s-place-or-it-asks`'s "just updates" half actually is:
      // the pane lives outside `section` entirely (`#pane` is its own grid
      // area) and `.body`'s scrollTop is untouched by rebuilding ONE
      // `[data-p]` child's contents.
      //
      // **`executeSettled` is the second thing that makes a redraw safe, and
      // it is not a weakening of `'ask'`** — `plan:walk seq:120`. `'ask'` is
      // right and stays right for a change SOMEBODY ELSE made: `DEC-a-refresh
      // -keeps-the-reader-s-place-or-it-asks` settles that and `plan:walk
      // seq:64` measured a refresh discarding three of the owner's selections
      // in one act. A change the reader just made THROUGH THIS APP'S OWN
      // EXECUTE CONTROL is a different event. They pressed Run; they know what
      // happened; asking "shall I refresh?" is the app pretending not to know
      // something it does know, and a settled item still sitting in the queue
      // is worse than a lost scroll position.
      //
      // These records ARE that act's own — the `execute` row, the CLI's own
      // `mutation` row, and `execute-done` — arriving on the one connection
      // within one debounce window of the run this page started. Without this
      // branch the reader gets an affordance offering to show them the result
      // of the thing they just did.
      //
      // **A run this page started is still going: decide nothing yet.** The
      // `execute` row is written BEFORE the command runs, so this frame is the
      // reader's own act announcing itself mid-flight. Redrawing here could
      // show the item still in the queue — the reported symptom with extra
      // steps — and asking is the app pretending not to know what it is doing.
      // Re-armed rather than dropped, so the frame is not lost if the run ends
      // without producing another one.
      if (executeInFlight > 0) {
        liveScreenTimer = setTimeout(again, LIVE_INVALIDATION_DEBOUNCE_MS);
        return;
      }
      if (decl.refresh === 'auto' || executeSettled) act();
      else showLiveAffordance(act);
    };
    liveScreenTimer = setTimeout(again, LIVE_INVALIDATION_DEBOUNCE_MS);
  });
}

/* ══ AN ACTION TAKEN THROUGH EXECUTE REFRESHES THE SCREEN IT WAS TAKEN ON ══
 *
 * `plan:walk seq:120`. Owner report, 2026-08-31, after driving six review-queue
 * drafts through Accept/Reject -> Execute on their own corpus: *"after pressing
 * Run on a Review queue item, the item stays in the queue, the page does not
 * refresh, and the gold count beside Review queue in the rail does not change."*
 *
 * Three separate causes, and this is where two of them are answered (the third,
 * the rail, is `CHROME_REFILL`'s new `rail` row and the call below):
 *
 *   1. `work` is `refresh: 'ask'`, so even when it noticed it offered the
 *      affordance instead of redrawing.
 *   2. It might not notice at all: Accept and Reject run `review promote` /
 *      `review discard`, which write `execution` rows (`execute`,
 *      `execute-done`) alongside whatever `mutation` the CLI records for
 *      itself, and `work` declares only `mutation`. Whether the stream woke it
 *      depended on the ordering of two record kinds, one of which the row does
 *      not declare.
 *
 * ── WHY THE TRIGGER IS THE POST RESOLVING, AND WHY THAT IS `execute-done` ──
 *
 * **Do not refresh before the write has landed.** Redrawing on `execute` would
 * redraw the queue MID-FLIGHT and could show the item still there — the reported
 * symptom with extra steps. `execute-done` is the row that says the run
 * finished, and `src/ui/execute.ts`'s handler appends it at its step 6 and
 * RETURNS at step 7: the response to `POST /api/execute` cannot be read by this
 * page until `recordCompletion` has been called. So the resolution of that POST
 * is the `execute-done` moment, observed on the connection that caused it —
 * strictly after the run, with no dependence on stream ordering, stream
 * latency, or a debounce that might fire between two frames of one act.
 *
 * ── IT GOES THROUGH THE SINGLE SLOT, NOT AROUND IT ────────────────────────
 *
 * `currentScreenRefresh` is the same `act` closure `setupLiveScreen` built for
 * this screen, and `act` calls `renderScreen`, which is the WeakMap-keyed queue
 * every render in this file goes through. Two overlapping renders on one
 * section were measured drawing nine `<h3>` where one render draws three; an
 * Execute-driven refresh is chained behind whatever is already rendering, like
 * every other one. `act` also hides the affordance first, so a pending "new
 * activity" from the same run is taken back by the redraw that answers it.
 */
let currentScreenRefresh = null;

/**
 * True for as long as records arriving on the stream are still plausibly this
 * page's own Execute settling.
 *
 * A WINDOW rather than a latch consumed once, because one run is several
 * frames — `ui/execute.ts` writes `execute` before the run and `execute-done`
 * after it, and the CLI writes its own `mutation` in between — and they do not
 * all arrive inside one debounce. Four debounce periods is the bound: long
 * enough that the trailing frames of one act are recognised as that act, short
 * enough that a change somebody else makes a moment later still ASKS, which is
 * the distinction this whole feature turns on and must not flatten.
 */
let executeSettled = false;
let executeSettledTimer = null;

/**
 * **A run this page started is IN FLIGHT** — between the reader answering the
 * confirm and the POST coming back.
 *
 * It exists because the first record of the pair arrives during that gap.
 * `ui/execute.ts` writes the `execute` row BEFORE it runs anything ("a run that
 * cannot be recorded does not happen"), and the run itself is a child process
 * that takes a second or two; the stream polls once a second and the screen
 * subscription debounces for half of one. Measured in a browser on 2026-08-31:
 * pressing Run raised *"New activity for this screen. Refresh"* about 1.5s in,
 * over a change the reader was at that moment making, and then took it back
 * when the run finished.
 *
 * So while this holds, the stream's timer is RE-ARMED rather than acted on:
 * more frames of the same act are coming and the answer is not knowable yet.
 * Never redrawn either — `plan:walk seq:120` is explicit that refreshing on
 * `execute` could show the item still there, which is the reported symptom with
 * extra steps.
 */
let executeInFlight = 0;

/**
 * How long after a run settles its own trailing frames may still arrive.
 *
 * DERIVED FROM THE TWO CLOCKS BETWEEN THE RECORD AND THIS PAGE, rather than
 * picked: the server's tail polls at `STREAM_POLL_MS` (1000ms — sent to every
 * client in the `hello` frame) and the screen subscription then debounces for
 * `LIVE_INVALIDATION_DEBOUNCE_MS`. A record appended just before the response
 * therefore reaches a decision up to one poll plus one debounce later. Doubled,
 * because the pair is two records and the second is written after the first is
 * already travelling.
 *
 * Too short and the reader is asked about their own act; too long and a change
 * somebody ELSE makes moments later is redrawn without asking, which is the
 * distinction this whole feature turns on. Three seconds is the shortest value
 * that covers the measured path.
 */
const EXECUTE_SETTLED_WINDOW_MS = 2 * (STREAM_POLL_MS + LIVE_INVALIDATION_DEBOUNCE_MS);

/**
 * The result region of the run this page most recently started, held for as
 * long as redraws caused by that run can still arrive.
 *
 * **A HOLDER RATHER THAN A ONE-SHOT RE-ATTACH, because one Execute is several
 * redraws.** `report()` writes the exit code, the stderr and the audit note
 * into a region that lives INSIDE the `[data-p]` section, and every redraw
 * opens with `root.replaceChildren()` — so a node prepended once is detached
 * again by the next frame of the same act. Measured on 2026-08-31: the promote
 * reported `exit 0`, the outcome was prepended, and the `mutation` frame 250ms
 * later took it away. Every redraw inside the settle window re-attaches it, and
 * the window closing is what lets it go.
 *
 * Losing this matters more for a FAILED run than for a clean one: the reader
 * would see the item still sitting in the queue and be told nothing about why.
 *
 * **HELD UNTIL THE READER LEAVES THE SCREEN OR RUNS SOMETHING ELSE, and NOT on
 * the `executeSettled` window's timer.** It was on that timer for one round and
 * the timer lost: the window is four debounce periods (1s), and one Execute on
 * the Work screen produces TWO chained redraws whose two fetches together
 * outlast it — measured in a browser on 2026-08-31, where the promote removed
 * the row, moved the rail, and left no exit code anywhere on the page. The
 * window governs a different question (may a redraw happen without asking) and
 * borrowing it for this one made a visible fact depend on how fast two
 * endpoints answered. A redraw of the SAME screen while the reader is still on
 * it does not make "the run you just made here exited 0" any less true.
 */
let executeOutcome = null;

/**
 * Put the held outcome back **ON THE ROW IT WAS RUN FROM**, and make sure the
 * person who pressed the button can actually see it.
 *
 * ── THE DEFECT THIS REPLACES, MEASURED ────────────────────────────────────
 *
 * Owner, 2026-09-03: *"check the doctor using playright, it looks like the run
 * do nothing"*. Driven in real Chrome the same day, the run works end to end —
 * `POST /api/execute` answers 200 with `exitCode: 0` and real stdout, followed
 * by two `GET /api/doctor` refreshes — and the screen then redraws identically.
 *
 * This function was the reason. It did `section.prepend(executeOutcome)`: the
 * TOP of the screen, which was defended above as "where a statement about the
 * act that produced this screen belongs" and is a fine sentence about a screen
 * that fits in a window. The Doctor pane is ~4,000px tall, and the reader who
 * presses Execute on row 21 is nowhere near the top of it. Probed twice, 2s and
 * 14s after "Run it", identical both times:
 *
 *     .execresult  hidden:false  text:"exit 0"  top:-3974px  inView:false
 *
 * So the single piece of feedback the product gives for a write it just made
 * was rendered 3,974px above the reader, and nothing said so. **This is not a
 * Doctor defect.** Every screen that composes a command reaches this function,
 * so every one of them had it: `palette`, `doctor`, `work`, `capture`,
 * `coverage`, `packs`, `port` and `proc`.
 *
 * ── WHY THE ROW, RATHER THAN A SCROLL TO THE TOP OR A BANNER ──────────────
 *
 * **Because the CONFIRM already got this right and the outcome did not.**
 * `lib/command-actions.js` renders the confirm INLINE, in the row, under the
 * button that opened it — the residual, the argv, the per-item diff and the two
 * buttons — and nobody has ever reported not finding it. The outcome is the
 * answer to the question that confirm asked, and it belongs in the same place.
 * It could not GET back there because every redraw opens with
 * `root.replaceChildren()` and builds a fresh, anonymous control, so the shell
 * had nothing to aim at. `commandActions` now stamps `data-cmdkey` (the
 * composed line — the identity `cardCommands` already dedupes by), so the row
 * can be found again.
 *
 * Two alternatives were weighed and rejected:
 *
 *   SCROLL THE SCREEN TO THE TOP after every run. It takes the reader away
 *   from the row they were working on to read one line, and on a 4,000px pane
 *   that is a whole screen of travel each way. It also answers only half the
 *   report: the outcome would be visible, and it would still not be beside the
 *   thing it is about.
 *
 *   A STICKY OR OVERLAID BANNER. This project has already run that experiment
 *   with `#screenstale` and recorded the result in `styles.css`: overlaid in
 *   the screens' own grid cell, nothing moved and *"the price was that it
 *   covered the data underneath it, which is what the owner then reported"*.
 *   Repeating it for a second transient would be re-shipping a defect whose
 *   write-up is thirty lines long in the stylesheet.
 *
 * ── AND THE FALLBACK, WHICH IS THE OLD BEHAVIOUR PLUS A SCROLL ────────────
 *
 * A run can REMOVE the row it was run from — `work.js`'s promote is exactly
 * that, and it is the case `e2e/execute.spec.ts` drives — and then there is no
 * control to return to. The outcome goes to the top of the section, as before,
 * because a statement with nowhere of its own to be still has to be somewhere.
 * What is new is that the reader is taken to it: `scrollIntoView` walks the
 * scroll CHAIN, which is what this layout needs — `#screen` is the scroller
 * (`.body{overflow-y:auto}`) and `window.scrollY` measured 0 throughout, so
 * anything written against the window would have moved nothing at all.
 *
 * `block: 'nearest'` and not `'center'`: it is a no-op when the node is already
 * visible, which is the ordinary case once the outcome is back on its row, and
 * it scrolls the MINIMUM when it is not. So this is idempotent across the
 * several redraws one Execute produces rather than a jump repeated three times.
 *
 * Still idempotent and still safe to call after any render: nothing with no
 * outcome held, and no move when the node is already where it should be.
 */
function attachExecuteOutcome() {
  if (executeOutcome === null) return;
  const section = visibleSection();
  if (section === null) return;
  // **THE HOME IS RE-ASKED EVERY TIME, AND "IT IS SOMEWHERE IN THE SECTION" IS
  // NOT AN ANSWER.** This used to open with `if (!section.contains(...))`, so
  // the FIRST attach decided the placement for good — and one attach can
  // legitimately land on a section that is momentarily EMPTY, which makes the
  // fallback the permanent answer for a row that is still there.
  //
  // ── THE WINDOW, WHICH IS ORDINARY RATHER THAN EXOTIC ─────────────────────
  //
  // One Execute produces several redraws by design (`execute`, the CLI's own
  // `mutation`, `execute-done`), so the stream's `act()` is routinely QUEUED
  // BEHIND the Execute's own through `renderScreen`'s per-section chain. When
  // the first render resolves, the second render's continuation is already
  // registered on it — and every screen's `render()` opens with
  // `root.replaceChildren()` SYNCHRONOUSLY. So the second render clears the
  // section in a microtask that runs BEFORE the first render's `.then` reaches
  // this function: `executeOutcomeHome` scans an empty section, finds nothing,
  // and the outcome is prepended to the top. Every later attach then saw
  // `contains` and left it there — including the ones that ran after the rows
  // came back.
  //
  // Measured 2026-09-03, `doctor-outcome.spec.ts:337` under parallel load, both
  // browser projects, on the code as it stood before this change and after the
  // route-race guard (so: not that defect):
  //   `[data-p="doctor"] > .execresult` resolved to 1 for the full 5s bound,
  //   while the row it was run from was on screen carrying its control.
  // At `--workers=1` the same test passed, because the second render had
  // finished before the first one's `.then` ran.
  //
  // ── WHY RE-HOMING IS SAFE TO DO ON EVERY ATTACH ──────────────────────────
  //
  // It is a MOVE, not a copy — one node has one parent — and the target is
  // compared first, so an outcome already on its row is not touched at all and
  // this stays the idempotent call every render path can make blindly. The
  // fallback keeps its meaning exactly: `home === null` is "this screen no
  // longer draws the control this ran from" (`work.js`'s promote removes the
  // row it was run from, which `e2e/execute.spec.ts` drives), and the top of
  // the section is still where a statement with nowhere of its own to be goes.
  // What changes is only that the fallback is no longer PERMANENT: when the
  // control comes back — because the redraw that had cleared it finished — the
  // answer returns to the row that asked for it.
  const home = executeOutcomeHome(section);
  if (home !== null) {
    if (executeOutcome.parentNode !== home) home.append(executeOutcome);
  } else if (executeOutcome.parentNode !== section) {
    section.prepend(executeOutcome);
  }
  revealExecuteOutcome();
}

/**
 * The rebuilt control the held outcome came from, or `null` when this screen no
 * longer draws it.
 *
 * Matched on `data-cmdkey` — the composed command line, written by
 * `commandActions` onto both the control and the result region it hands over.
 * A LINEAR SCAN rather than an attribute selector, deliberately: the key is a
 * shell command, it contains quotes and spaces on any id that needs escaping,
 * and `CSS.escape` on every redraw is a second correctness question this does
 * not need to answer. Eight hundred and twenty nodes is the largest screen this
 * product draws and a `querySelectorAll` walk over it costs nothing beside the
 * fetch that produced them.
 *
 * **The FIRST match, and where that is imprecise it is imprecise safely.** Two
 * controls can share a key only when one screen composes the identical line
 * twice — a shared repair block for a code that appears at two levels is the
 * only shape that reaches it — and then the outcome lands on a control for the
 * SAME command, which is still a true statement in a place the reader can read
 * it. An ordinal would not be more correct: after a redraw that removed rows,
 * the n-th control of a key is not the same control either.
 */
function executeOutcomeHome(section) {
  const key = executeOutcome.dataset?.cmdkey;
  if (typeof key !== 'string' || key === '') return null;
  for (const control of section.querySelectorAll('.cmdactions')) {
    if (control.dataset.cmdkey === key) return control;
  }
  return null;
}

/**
 * Bring the held outcome into the viewport, if it is not already there.
 *
 * Guarded on `hidden` because the region is BUILT hidden and unhidden by
 * `say()` — scrolling to a node with no box is a scroll to nowhere — and on the
 * method existing at all, the same guard `announce()` carries: a screen
 * rendered by a test harness has no layout engine behind it.
 */
function revealExecuteOutcome() {
  if (executeOutcome === null || executeOutcome.hidden === true) return;
  if (typeof executeOutcome.scrollIntoView !== 'function') return;
  executeOutcome.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * An Execute this page ran has finished. Redraw the screen it was run on, and
 * move the rail with it.
 *
 * **Called by `lib/command-actions.js` and by nothing else, and that is a
 * decision rather than a convenience.** That module owns the ONE
 * confirm-and-run control in this product — every screen that offers Execute
 * calls `commandActions` — so one call site reaches the Palette's runs,
 * Doctor's repair and Work's Accept and Reject alike. The alternative
 * considered was hooking `post()` itself, which is the door every Execute goes
 * through; it was rejected because `screens/config.js` ALSO posts
 * `/api/execute`, for the budget save, and that screen updates its own fields
 * in place with a recorded reason not to reload — *"without a full-screen
 * reload that would wipe the message just shown"*. A door-level hook would have
 * overruled another screen's own decision from a place its author would never
 * think to look.
 *
 * `outcomeNode` is the run's result region, carried across the redraw.
 *
 * A REFUSAL settles too, deliberately: `handleExecute` records the `execute`
 * row before it runs anything and a non-zero exit is still a run that happened,
 * so "the command failed" is not the same as "nothing changed", and a screen
 * left showing the pre-run state after a partial write would be the same defect
 * pointing the other way. What does NOT reach here is a request that never
 * left the browser — `request()` throws before `fetch` when no credential is
 * held, and there the screen is already showing what it should.
 */
function noteExecuteSettled(outcomeNode) {
  if (executeInFlight > 0) executeInFlight -= 1;
  executeSettled = true;
  executeOutcome = outcomeNode ?? null;
  if (executeSettledTimer !== null) clearTimeout(executeSettledTimer);
  executeSettledTimer = setTimeout(() => {
    executeSettledTimer = null;
    executeSettled = false;
  }, EXECUTE_SETTLED_WINDOW_MS);
  // The screen, through the same single slot every other refresh goes through.
  //
  // **AND THE OUTCOME SURVIVES THE REDRAW.** `report()` writes the exit code,
  // the stderr and the audit note into a region that lives INSIDE the section
  // — so a refresh that merely redrew would take back the answer to "what did
  // that do", which is worse for a NON-ZERO exit than for a clean one: the
  // reader would see the item still in the queue and be told nothing about
  // why. The node is re-attached ON THE ROW IT WAS RUN FROM, and only at the
  // top of the screen when that row is gone — see `attachExecuteOutcome` for
  // the measurement that moved it and for why the reader is scrolled to it
  // either way. It is re-attached whether or not it has content yet: it is
  // built `hidden` and `say()` unhides it, so the order in which the refresh
  // and `report()` finish cannot matter.
  const done = currentScreenRefresh?.();
  if (done !== undefined && done !== null && typeof done.then === 'function') {
    void done.then(attachExecuteOutcome, attachExecuteOutcome);
  } else {
    // No screen refresh to wait for — a screen with no held `act`, or a test
    // harness with no shell. The outcome still belongs on screen.
    attachExecuteOutcome();
  }
  // **AND THE RAIL, IN THE SAME ACT.** `paintRailCounts()` was called from
  // `route()` and from nowhere else, so the gold badge beside Review queue was
  // correct exactly once per navigation and never moved again — a defect on its
  // own, and the one the owner named second. It counts BOTH queues
  // (`pendingRevisions.revisions + reviewQueue.drafts`, fixed 2026-08-30 after
  // reading one made it say 0 with a draft on screen), and nothing here changes
  // that: this calls the same function.
  void paintRailCounts();
}

/* ══ LIVE INVALIDATION FOR THE SHELL'S OWN CHROME ══════════════════════════
 *
 * Owner, 2026-08-29: *"the refresh mechanism you already implemented should
 * include also the status line."*
 *
 * The strip shows an item count, a git state, a context fullness and — one row
 * up, same chrome, same fill pass — how the audit projection stood. All of
 * those move while a person works, and until now nothing told the strip so:
 * `renderChrome()` built it once, `fillChrome()` filled it once at boot, and
 * its only recovery was the per-segment Refresh control. So the strip
 * participates in live invalidation the way a screen does, off
 * `CHROME_INVALIDATION` — see that table's own header for how each row's kinds
 * were derived and why every row is `'auto'`.
 *
 * ── WHAT IS DIFFERENT FROM `setupLiveScreen`, AND WHY ────────────────────
 *
 *  1. **Subscribed ONCE, for the life of the page, never torn down.**
 *     `teardownLiveScreen()` exists because a subscription opened by the
 *     screen that just left is not the next screen's to keep receiving. The
 *     strip never leaves. Re-arming it per route would be a subscription
 *     churned twenty times a session for chrome that never changes.
 *  2. **One subscription PER GROUP, each with its own timer.** The strip's
 *     segments have different sources, so a blanket re-fill on every record
 *     would refetch four endpoints to redraw one of them — and would make the
 *     git group flicker for an item write, over a fact no audit record can
 *     move. Each group subscribes to its own kinds and refills its own
 *     segment; a group whose kinds are `[]` never subscribes at all, which is
 *     what makes "do not refetch what has not changed" structural rather than
 *     a promise. Separate timers for the reason the debounce constant's own
 *     header gives: one group's burst must not delay another group's refill.
 *  3. **No `'ask'` path.** `showLiveAffordance` is the SCREEN's affordance,
 *     driven by the single `pendingScreenRefresh` slot that belongs to
 *     whichever screen is on show; borrowing it for chrome would take back a
 *     screen refresh the reader has not pressed yet, and a second control in
 *     the strip is a PRESENTATION change the design of record decides first.
 *     A row that is not `'auto'` is therefore SKIPPED here rather than
 *     silently auto-refreshed, and `test/ui/live-invalidation.test.ts` fails
 *     on any such row so it cannot be introduced quietly.
 *
 * The three named states survive by construction, because this calls the same
 * fillers the boot and the Refresh buttons call: a refill whose endpoint
 * refuses draws `strip.unread` and offers the call again, `strip.unmeasured`
 * belongs to the `audit` group which fetches nothing and is never refilled,
 * and a measured zero is drawn as `0`. Each filler also collects its nodes
 * and swaps them in with ONE `replaceChildren` at the end, so no segment is
 * ever momentarily blank — see `fillItems`.
 */
const CHROME_REFILL = {
  // Declared for the key even though `kinds: []` means it is never called:
  // this object and `CHROME_INVALIDATION` are held to the SAME key set by
  // `test/ui/live-invalidation.test.ts`, in both directions, so a row that
  // gains kinds cannot find itself with nothing to run.
  repo: () => { const el = document.getElementById('gitstate'); if (el !== null) void fillGit(el); },
  corpus: () => { const el = document.getElementById('stripitems'); if (el !== null) void fillItems(el); },
  // ── AND WITH IT, SINCE 2026-09-01, LINE 1 AND THE COST GROUP. The model,
  // the window's name and focus, the cost, the cache share and the audit clock
  // all ride `/api/watch/context`, so one call refills all of them and there is
  // no second row in this table for facts that arrive in one body.
  session: () => { void fillContext(); },
  // **NOT A NO-OP ANY MORE.** This row read `() => {}` while the group's only
  // content was `injections today`, which has no source on this read surface
  // and is drawn NAMED as unmeasured. The group now also carries the audit
  // CLOCK — when the log last moved, and what moved it — which is served on
  // `/api/watch/context`, so there is something to make stale and something to
  // run. `kinds: '*'` beside it, because the clock's entire job is to report
  // that the log moved: a row of ANY kind is exactly the event it reports, and
  // a subscription to a subset would be a clock that stops for the kinds
  // nobody listed. It shares `session`'s call, so the extra kinds cost a
  // refetch of one body this page already refetches, never a second endpoint.
  audit: () => { void fillContext(); },
  prov: () => { void fillProvenance(); },
  // **THE RAIL'S COUNT BADGES, WHICH NOTHING EVER REFRESHED** — `plan:walk
  // seq:120`, third of the three causes the owner's report has under it.
  //
  // `paintRailCounts()` was called from `route()` and from nowhere else, so the
  // gold badge beside Review queue was right at the moment a screen was opened
  // and never moved again. The strip's groups have refreshed live since
  // `CHROME_INVALIDATION` landed and this table had no row for the rail at all
  // — which is why the badge would still have been wrong even if the screen
  // had redrawn perfectly.
  //
  // It is chrome by every test this table applies: no route, no reader state,
  // built once, outlives every navigation. `['mutation']` because that is what
  // moves all three numbers — `/api/status`'s health counts and both review
  // queues, and `/api/coverage`'s tree — derived from the same endpoints the
  // `status` screen row above derives its own `['mutation']` from, rather than
  // re-derived differently for the same data.
  rail: () => { void paintRailCounts(); },
};

/**
 * The chrome's unsubscribes, empty until `setupLiveChrome()` runs once — and
 * NOTHING CALLS THEM, deliberately. There is no `teardownLiveChrome()` beside
 * `teardownLiveScreen()` because there is no moment to call it at: the strip
 * outlives every route and dies only with the page, which is when the shared
 * connection goes too. Kept as handles rather than a bare boolean so the state
 * a reader finds here is "these five subscriptions, still open" rather than
 * "armed", and so a future teardown has something to call.
 */
const liveChromeUnsubs = [];

/**
 * Arm the chrome's subscriptions. Idempotent and once-ever, the same shape as
 * `ensureLiveStream()` and for the same reason: `renderChrome()` runs a second
 * time when a pasted nonce redeems in place, and a second set of subscribers
 * would refill every segment twice for one record.
 */
function setupLiveChrome() {
  if (liveChromeUnsubs.length > 0) return;
  for (const [group, decl] of Object.entries(CHROME_INVALIDATION)) {
    const refill = CHROME_REFILL[group];
    if (refill === undefined) continue;
    // "Nothing invalidates me" costs nothing: no subscription, no timer, and
    // no chance of a refetch for a record this segment does not read.
    if (decl.kinds !== '*' && decl.kinds.length === 0) continue;
    // See point 3 above. Skipping is the safe direction — it draws nothing and
    // discards nothing — and the gate is what makes it loud.
    if (decl.refresh !== 'auto') continue;
    let timer = null;
    liveChromeUnsubs.push(subscribeStream(decl.kinds, (event) => {
      // Filtered here for the reason `setupLiveScreen` filters here: `hello`
      // and `fault` reach every subscriber regardless of `kinds`, and `prov`
      // asks for `'*'`, so without this a stream-level frame would refill a
      // segment nothing invalidated.
      if (event !== 'record') return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; refill(); }, LIVE_INVALIDATION_DEBOUNCE_MS);
    }));
  }
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
 * no-sessions state.
 *
 * **AND SINCE 2026-09-02 IT PAINTS THE PICKER TOO** (`plan:walk seq:115`).
 * What used to stand here — "there is no `<select>`/dropdown here" — was the
 * defect: `#sessbtn` carried `aria-haspopup="dialog"` pointing at a `#sesspop`
 * that did not exist, so the control did nothing when pressed and
 * `ctx.session()` was permanently `/api/sessions`' `default` (measured,
 * `plan:walk seq:35`). The answer this function already had is the answer the
 * dialog needs, so the dialog reads it here rather than fetching `/api/sessions`
 * a second time and re-deriving the default from it — two derivations of one
 * fact is how the two surfaces come to disagree.
 */
async function loadSessions() {
  const data = await api('/api/sessions');
  // Reached only past a real answer — `api()` throws before this line on a
  // 401/403 or a dead connection, so getting here IS the credential working.
  // See `noCredential`'s own header for why this can't just be `sessionValue
  // === 'cold'` read backwards.
  noCredential = false;
  // The picker's rows, held for `paintSessionList()` — `sessionSummaries`
  // VERBATIM off the wire (`read-model.ts` keeps it that way on purpose, which
  // is how `name` reached this client at all), never re-shaped field by field.
  sessionRows = Array.isArray(data.sessions) ? data.sessions : [];
  // `plan:rulings seq:26`: `data.ledger` off the wire, never re-derived from
  // `sessions.length === 0` — that collapse is exactly the defect the STD
  // exists to forbid, because a `not-projected` corpus and a `ready` ledger
  // holding no rows both answer an empty list, and only this field says which.
  sessionLedgerPresence = data.ledger === 'not-projected' ? 'not-projected' : 'ready';
  const next = data.sessions.length === 0 ? 'cold' : (data.default ?? 'cold');
  setSession(next);
}

/**
 * `/api/sessions`' `LedgerPresence`, from the last successful `loadSessions()`.
 *
 * `'ready'` at boot — before the first answer this is presumed rather than
 * unmeasured, because the popover cannot be opened before `loadSessions()` has
 * run once (`main()` awaits it), so there is no paint that could see any other
 * value here.
 */
let sessionLedgerPresence = 'ready';

/**
 * The sessions `/api/sessions` last answered with, in its order. Empty until
 * the first successful read, and left ALONE by a read that refused: a picker
 * that emptied itself on a 401 would tell a locked-out reader the corpus has no
 * sessions, which is a claim about the ledger and not about the credential.
 */
let sessionRows = [];

/**
 * Move the shell to `next`, and tell everything that asked to be told.
 *
 * Lifted out of `loadSessions()` on 2026-09-02 with the picker, because there
 * are two callers now and the notification contract is subtle enough that a
 * second hand-written copy of it would drift. `loadSessions()` calls it with
 * the server's default; `#sesspop`'s row handler calls it with the reader's
 * choice. Everything below is the behaviour that was already here.
 *
 * **ON CHANGE, and this is the difference between a listener and a pulse.**
 *
 * `onSessionChange(fn)` promises `fn` on every future CHANGE — the contract
 * is written into this file's own header block. It used to fire on every
 * CALL, which is a different thing: `loadSessions()` runs at boot and again on
 * every nonce redeemed into a live page, so a screen subscribed here was
 * told the session had moved when it had not, and re-fetched a selection it
 * was already showing. Paired with `preview.js`'s appending `draw()` that is
 * the second half of `TASK-the-preview-can-hold-two-renders-at-once-and-
 * session`: a spurious notification is a spurious `show()`, and two `show()`
 * calls in flight used to be two renders on screen.
 *
 * Recorded BEFORE the assignment, because "changed" is a comparison against
 * what the shell was last showing and there is exactly one place that is
 * known.
 */
function setSession(next) {
  const changed = next !== sessionValue;
  sessionValue = next;
  // **`#sesslbl` STAYS THE RAW ID and does not become the name.** The design of
  // record's own demo writes an id there and two e2e specs read it as one
  // (`preview-compact-continuity`, `preview-overlap`, both `toHaveText` a
  // session id) — the label is how a test, and a reader, says WHICH session
  // without ambiguity, and two sessions can share a name where they cannot
  // share an id. The NAME is drawn in the picker beside the id, which is the
  // surface that has room for both.
  const label = document.getElementById('sesslbl');
  label.textContent = sessionValue === 'cold' ? flat(table.strings, 'sess.cold') : sessionValue;
  paintSessionList();
  if (!changed) return;
  // Over a COPY: a listener may unsubscribe from inside its own callback (a
  // screen re-rendering itself does exactly that), and splicing the array
  // being iterated would skip the listener after it.
  for (const fn of [...sessionListeners]) fn(sessionValue);
}

/**
 * `#sesslist` — one row per session the ledger knows, newest first, built from
 * `sessionRows` and never from markup.
 *
 * **THE NAME IS THE POINT.** `SessionSummary.name` is what `mycontext session
 * name` gave the session and it is `null` when nobody named it — ruling 12, and
 * `core/ledger.ts` states in its own words that it is "`null` and never a
 * fallback", because a derived name cannot be told from a real one. So this
 * draws the short id ALWAYS and appends the name only where there is one: an
 * unnamed session shows exactly what is known about it, and the reader's own
 * session ("my-context V2.0.0 Development") is findable by the name they gave
 * it rather than by a hex prefix they never chose.
 *
 * The name goes in a `<bdi>` and the id in `.m`: a name is corpus text in an
 * unknown direction and an id is a machine value that must read LTR in an RTL
 * page. That is the same treatment the item pane's body and every id in this
 * product already get.
 *
 * `aria-selected` marks the current row rather than `aria-pressed`, because
 * `.pop .row[aria-selected="true"]` is the design of record's own rule for a
 * chosen row in one of these dialogs.
 *
 * The right column is `formatAge`, this app's ONE spelling of a duration, over
 * `lastInjectedAt` — and an em dash where that timestamp cannot be parsed,
 * because a row that quietly showed `0s` for an unreadable date would be a
 * measurement nobody took (`STD-a-measured-zero-is-drawn-and-named`).
 */
function paintSessionList() {
  const list = document.getElementById('sesslist');
  if (list === null) return;
  const rows = [];
  for (const row of sessionRows) {
    const id = typeof row.sessionId === 'string' ? row.sessionId : '';
    if (id === '') continue;
    const button = document.createElement('button');
    button.className = 'row';
    button.dataset.sid = id;
    button.setAttribute('aria-selected', String(id === sessionValue));
    const left = document.createElement('span');
    const mono = document.createElement('span');
    mono.className = 'm';
    mono.textContent = id;
    left.append(mono);
    if (typeof row.name === 'string' && row.name !== '') {
      left.append(document.createTextNode(' · '));
      const named = document.createElement('bdi');
      named.textContent = row.name;
      left.append(named);
    }
    const when = document.createElement('span');
    when.className = 'small m';
    const at = Date.parse(row.lastInjectedAt);
    when.textContent = Number.isFinite(at) ? formatAge(Math.max(0, Date.now() - at)) : '—';
    button.append(left, when);
    rows.push(button);
  }
  // **`not-projected` gets its OWN panel, not the empty list above** —
  // `plan:rulings seq:26`, settled by `STD-a-measured-zero-is-drawn-and-named-
  // …`. `rows` being empty is the mockup's null state, and it is exactly the
  // wrong thing to leave here for a corpus that may have been injected into a
  // thousand times: the ledger PROJECTION was never built, which is a
  // different fact from a fully-projected ledger genuinely holding no rows,
  // and the reader is owed the difference. Reuses the `◌` unmeasured primitive
  // `doctor.js`, `watch.js` and `fillCorpusDrift`/`fillConfigError` above
  // already use — never a fourth convention for the same fact — and is guarded
  // on the string key existing, `showCodeSkew`'s own seam: this lane does not
  // own the string tables, and the panel draws the moment the key lands there.
  if (sessionLedgerPresence === 'not-projected' && table !== null
      && SESS_NOT_PROJECTED_KEY in table.strings) {
    const notice = document.createElement('p');
    notice.className = 'aside';
    const chip = document.createElement('span');
    chip.className = 'chip unmeas';
    chip.dataset.g = '◌';
    chip.dataset.f = 'ledger-projection';
    chip.dataset.k = SESS_NOT_PROJECTED_KEY;
    chip.append(...translate(table.strings, SESS_NOT_PROJECTED_KEY));
    notice.append(chip);
    rows.push(notice);
  }
  list.replaceChildren(...rows);
  // The cold row lives in the markup, below the rule, so it is marked here
  // rather than built here — and it is the selected row exactly when the shell
  // is on `cold`, which is a real state (an empty ledger, a not-projected one,
  // or a session read that refused) and not merely the absence of a choice.
  document.querySelector('#sesspop [data-cold]')
    ?.setAttribute('aria-selected', String(sessionValue === 'cold'));
}

/**
 * **The provenance bar and the status strip — the app's two missing rows.**
 *
 * `.app` declares `grid-template-rows:46px 1fr 26px 38px` with areas
 * `top / rail body / prov / strip`, so the grid reserved both rows from the day
 * the shell landed while nothing was ever built to sit in them. That strip row
 * was 30px until 2026-08-29, and 26 + 30 = 56 is exactly the band of bare
 * `.app` the owner saw across the bottom of every screen, showing the body's
 * gradient through. styles.css's status-strip rule carries why it is 38 now,
 * and what was measured before it moved.
 *
 * BUILT IN SCRIPT, NOT COPIED AS MARKUP, and that is deliberate. The mockup
 * writes these as static HTML carrying `data-t` attributes and scans for them.
 * This app has no such scanner — `index.html` contains zero `data-t`
 * attributes and every string it draws comes through `translate()` — so
 * pasting the mockup's markup would ship English literals the א/A toggle could
 * never reach. Take the mockup's DESIGN, never its BEHAVIOUR: the classes, the
 * order and the states are the mockup's; how the text gets there is this app's.
 *
 * ── FOUR OF FORTY-FOUR, AND WHAT CHANGED — 2026-08-29, plan:walk seq:29b+29 ─
 *
 * Measured 2026-08-28, both surfaces driven in one browser: the mockup's strip
 * carried 44 elements in 5 colours and this one carried 4 in 1. The owner's
 * words were "many properties are currently missing and also the font should
 * be bigger to be readable, also use colors to diffrentiate between
 * properties", and separately "the status line is not constantly showing".
 *
 * **The strip is not intermittent and never was.** This function creates
 * `footer.strip#strip` once and nothing anywhere removes it, hides it, or
 * rebuilds `#app` around it; `.strip` is its own grid row and the three
 * siblings above it are each their own scroll container, so none of them can
 * push it past the viewport. What varied was CONTENT: the git group and the
 * item count were filled by one-shot calls whose catch blocks left their span
 * EMPTY ON PURPOSE — "the strip says nothing rather than guessing" — with no
 * retry, so one transient failure blanked them permanently. A blank git group
 * and a blank count beside one leftover sentence is exactly what "not
 * constantly showing" looks like from outside.
 *
 * That is `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * clause 3 — "a blank is indistinguishable from a failure to load, and a
 * reader who cannot tell those apart stops trusting the surface" — and the
 * standard was ruled after this code was written, which is how a
 * correct-looking catch block survived. **Every group can now say
 * `strip.unread` and offer the call again**, and that named unmeasured state
 * was built for the FOUR before the missing forty were added, so the finished
 * strip does not inherit the same silence across forty-four segments.
 *
 * **What each segment needed, established per segment rather than assumed to
 * share one blocker** — `plan:port seq:6` recorded two absences; there were
 * forty, and they did not have a common cause:
 *
 *   git group          `/api/meta` — already live; now has an unread state.
 *   item count         `/api/status` — already live; now has an unread state.
 *   context group      `/api/watch/context`, REGISTERED AND SERVING since ui3
 *                      tasks 4 and 5 landed. This is `plan:walk seq:29`: the
 *                      strip told every reader "The status line bridge is not
 *                      installed", INCLUDING the readers who had installed
 *                      it, because `strip.ctx.noBridge` was appended with no
 *                      check of any kind. It asks now — see `fillContext()`.
 *   project-knowledge  the same endpoint's `mycontext` half: three answers,
 *                      one of them an error, all keyed.
 *   injections today   NO SOURCE ON THIS READ SURFACE — for `today`. Counting
 *                      a calendar day means asking `/api/watch/volume` for
 *                      every minute since local midnight and summing
 *                      `byKind.injection` — up to 1,440 columns on every page
 *                      boot, which that endpoint's own cap calls "where a
 *                      request stops being a pulse and starts being a scan";
 *                      and its window ends at `now` rather than on a midnight
 *                      boundary, so the total would be off by part of a
 *                      minute. Wrong by a little, in a bar whose entire job is
 *                      provenance, is wrong.
 *
 *                      **RESOLVED 2026-09-01 by changing the WORD.** The
 *                      figure that does exist is `/api/watch/context`'s
 *                      `mycontext.injections`, bounded to the current context
 *                      epoch, already on this page and being discarded; the
 *                      label now says `injections this context` and means it.
 *                      See `injectionParts`. It was drawn NAMED AS UNMEASURED
 *                      for the four days between, rather than dropped —
 *                      `plan:port seq:6`'s "a shorter TRUE bar" was true and
 *                      silent about what it was not saying, which clause 2
 *                      forbids — and a label that stayed unmeasured any longer
 *                      would have become the thing readers learn to skip.
 *   audit append p95   CUT. No runtime source at all: the mockup's 0.55 ms is
 *                      a benchmark figure out of `core/audit-db.ts`'s header,
 *                      not something this server measures, and a latency
 *                      diagnostic with no action attached does not earn a
 *                      permanent place in the densest row this shell has.
 *
 * **Colour, and the word beside it.** Four provenance groups — repo, corpus,
 * session, audit — each carrying one of the five meaning colours AND a label
 * word. The word is not decoration: `reports/uiux/sketches/06-a11y.html`
 * requires "a glyph AND a colour AND a name", because --gold and --ok measure
 * 1.04:1 against each other and are the same state to a dichromat, identical
 * grey on a monochrome printer, and one system tone under forced-colors.
 * Colour is the fast channel; the word is the one that always survives.
 *
 * **The font is a DESIGN change and the mockup was edited FIRST**, per this
 * project's order for every design-of-record change: both surfaces measured
 * 13px, so the app was faithful and the design was what could not be read.
 * `--fs-strip`/`--fs-strip-mono` are the strip's own ramp, beside `--fs-chart`
 * and for the reason that ramp exists — a prose repaint must not be able to
 * move a dense bar's size out from under it.
 */
function renderChrome() {
  const app = document.getElementById('app');
  if (app === null) return;

  // **THE 26px BAND THAT SAID NOTHING, 2026-08-29.** This used to be built
  // present and EMPTY, on the reasoning that the bar is "one home for every
  // qualification the screens owe" and that when no screen owes one there is
  // nothing to say. Measured across eight screens on 2026-08-29: `#prov` was
  // 26px x 1280px with one child, zero visible descendants and no text, on
  // every one of them — while the design of record fills the same bar on every
  // screen. The owner, looking at the product: "the upper row is empty."
  //
  // `e2e/app-layout.spec.ts`'s "no empty band" assertion passed over it for
  // eight days, because it measures GEOMETRY: a 26px element with no text
  // covers its span and leaves no gap. The test proved the row EXISTS; it never
  // asked whether it SAYS anything, and its own docstring calls the defect "a
  // band of nothing". That assertion is strengthened in the same commit.
  //
  // What fills it here is the SHELL's own qualification and not a screen's: how
  // the audit projection stood when this page read it. `#provparts` is still
  // the screens' to fill.
  if (document.getElementById('prov') === null) {
    const prov = document.createElement('div');
    prov.className = 'prov';
    prov.id = 'prov';
    prov.setAttribute('aria-label', flat(table.strings, 'aria.prov'));
    const parts = document.createElement('span');
    parts.className = 'provparts';
    parts.id = 'provparts';
    const proj = document.createElement('span');
    proj.className = 'provproj';
    proj.id = 'provproj';
    prov.append(parts, proj, announceRegion());
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

  // ── TWO ROWS SINCE 2026-09-01, AND THE SPLIT IS THE TERMINAL BAR'S.
  //
  // Owner ruling: line 1 is IDENTITY — what does not change while the session
  // runs — and line 2 is STATE, everything that moves. The reason is a reading
  // habit rather than a width: after ten minutes a reader stops looking at
  // line 1 at all, so every changing number belongs on one row and motion
  // never appears where the eye has learned that nothing does. The terminal is
  // the precedent (`cli/commands/statusline-powerline.ts` · `buildLines`), the
  // owner approved it there, and the strip follows it here.
  //
  // **The rows are ELEMENTS, not a wrap.** `.strip` is a grid of two STATED
  // rows — 26px and 38px — so the bar is sized once, for its tallest content,
  // and can never be a container smaller than what is in it. A flex row that
  // wrapped would have grown silently, pushed its overflow out of the 38px the
  // `.app` grid reserved, and left whatever escaped behind the cards laid out
  // as though the strip ended where its box said it did. That is not a
  // hypothetical: it is what one intermediate state of this very change did,
  // measured on the owner's page — a 64px box with 134px of content in it.
  // ── AND A THIRD ROW WHEN THE FIELDS NEED ONE — owner ruling 2026-09-01,
  // *"on a screen with lower resolution the web status bar is somewhat
  // truncated, could we dynamically set 3rd status bar row so fields could
  // overflow dynamically to that line and not be truncated?"*
  //
  // **The rows are no longer built by appending as the groups are made.** Each
  // subject collects its groups into a LIST, and `layoutStrip` turns the lists
  // into rows — which is what lets the row count be decided by measurement
  // instead of being fixed at two, and what keeps the separators right when a
  // group moves (a `.sep` is drawn BETWEEN groups, so a group that changes rows
  // changes which separators exist).
  //
  // The subject split survives exactly as the owner set it: a group is the
  // atom, a group never leaves its subject, and a subject that outgrows one row
  // gets a second one of its OWN immediately below it. Nothing spills by
  // position, and no row ever mixes identity with state. `fitStrip` decides.
  const identity = [];
  const state = [];

  // One provenance group. The colour comes off `.sgrp-<name>` in the
  // stylesheet and the word comes out of the string table; `data-k` records
  // WHICH key was drawn, so `e2e/strip.spec.ts` can compare what this strip
  // renders against what the design of record declares. Without it a browser
  // test can only count anonymous spans, which is how forty missing segments
  // went a month without being noticed.
  const group = (name, labelKey, into) => {
    const g = document.createElement('span');
    g.className = 'sgrp sgrp-' + name;
    const label = document.createElement('span');
    label.className = 'slab';
    label.dataset.k = labelKey;
    label.append(...translate(table.strings, labelKey));
    g.append(label);
    // A LIST for the strip's own subjects, an ELEMENT for the header's repo
    // group — which is the one caller that is not a strip row and has a
    // position of its own to keep (before `.topr`).
    if (Array.isArray(into)) into.push(g); else into.append(g);
    return g;
  };

  // ── THE REPO GROUP LIVES IN THE HEADER — `plan:walk seq:114`, owner ruling
  // 2026-08-31. `index.html`'s own comment has described this header as
  // "primitive 8: git where the avatar would have gone" since it was written,
  // and then recorded that "that content is not wired here". It went into the
  // STRIP instead, and measured at 1280px on 2026-08-31 it took 372.5px of the
  // 906px the strip's four groups rendered into — 41% of a crowded row — while
  // `#ctx`, the one figure the owner asked to be able to read, had 157px. The
  // header measured 1,692px of nothing at 2304px wide and 668px at 1280.
  //
  // Built here rather than pasted into `index.html` for the reason the whole of
  // this function is built in script: `index.html` carries no `data-t` scanner
  // and every string it draws comes through `translate()`, so authored markup
  // would ship English literals the א/A toggle could never reach.
  //
  // Inserted BEFORE `.topr`, which carries `margin-inline-start:auto` — so the
  // pickers stay pinned to the far end and the git state fills the space
  // between them and the wordmark, which is exactly the space that was empty.
  // Rebuilt in place on a second `renderChrome()` (a pasted nonce redeeming)
  // the same way the strip is: found by id, emptied, refilled.
  const topbar = document.getElementById('topbar');
  if (topbar !== null) {
    document.getElementById('hdrrepo')?.remove();
    const repo = group('repo', 'strip.grp.repo', topbar);
    repo.id = 'hdrrepo';
    const git = document.createElement('span');
    git.className = 'gitstate';
    git.id = 'gitstate';
    repo.append(git);
    // `group()` appended it at the END of the header; it belongs before the
    // pickers, which carry `margin-inline-start:auto` and stay pinned to the
    // far edge either way. Moved rather than built in place so `group()` keeps
    // its one shape for all four provenance groups.
    // ── AND THE PROJECT'S NAME, which no web surface drew at all until
    // 2026-09-01. The terminal bar has carried it on line 1 since it was
    // written; the browser had a wordmark saying "mycontext" — the product —
    // and nothing saying WHICH REPOSITORY is open. Two windows on two clones
    // were indistinguishable in the chrome.
    //
    // `projectRoot` is the `.my_context` directory, so the NAME is its
    // parent's — the same derivation `mycontext statusline` makes from the
    // session directory Claude Code names, and the same one the session-name
    // suppression compares against server-side.
    const name = document.createElement('span');
    name.className = 'reponame';
    name.id = 'reponame';
    repo.append(name);
    const pickers = topbar.querySelector('.topr');
    if (pickers !== null) topbar.insertBefore(repo, pickers);
  }

  // ══ LINE 1 — IDENTITY ═════════════════════════════════════════════════
  //
  // The repo group is NOT rebuilt here and that is deliberate. It is identity
  // and it is already drawn, in the header, where `plan:walk seq:114` moved it
  // on 2026-08-31 to give the context figure its width back. The header is the
  // row above this one and is permanently visible, so the project, the branch
  // and the commit are already on an identity line; moving them again would
  // reverse a day-old ruling to gain nothing. `e2e/strip.spec.ts` already
  // reads the header group and this footer as ONE surface, and
  // `test/ui/strip-parity.test.ts` does the same.
  const model = group('model', 'strip.grp.model', identity);
  const modelState = document.createElement('span');
  modelState.className = 'modelstate';
  modelState.id = 'modelstate';
  model.append(modelState);

  const windowGrp = group('window', 'strip.grp.window', identity);
  const windowState = document.createElement('span');
  windowState.className = 'windowstate';
  windowState.id = 'windowstate';
  windowGrp.append(windowState);

  // ── AND THE CORPUS GROUP JOINS THEM — owner ruling 2026-09-01,
  // *"rebalance the fields between the lines to show their maximum lenght and
  // not truncated"*.
  //
  // MEASURED at the owner's 2273px: row 1 was using 335px and row 2 was
  // saturated, with exactly two segments clipped — `in step with the log` (104
  // shown, 168 needed) and `injections today` (37 shown, 101 needed). 128px of
  // unmet need beside ~1,600px of unused space one row up.
  //
  // WHICH GROUP MOVES IS NOT ARBITRARY, and it is not the biggest one. The row
  // split is IDENTITY over STATE, and the corpus group is the one line-2 group
  // whose facts are not this session's: an item count, whether the files have
  // moved under the log, how many doctor findings stand and how many items
  // await a ruling all change on the corpus's timescale — an edit, a branch
  // switch, a promotion — and not on the per-message timescale everything left
  // on line 2 moves at. The session group could not move: the context figure
  // changes on every response, and motion on the row the eye has learned is
  // still is the whole thing this split exists to prevent.
  //
  // It is also, and this is a coincidence worth writing down rather than
  // relying on, one of the two groups that was clipping.
  const corpus = group('corpus', 'strip.grp.corpus', identity);
  const count = document.createElement('span');
  count.className = 'corpusstate';
  count.id = 'stripitems';
  // ── AND WHETHER THE CORPUS MOVED WITHOUT THE LOG SEEING IT.
  //
  // `measureCorpusDrift` landed on 2026-08-31 and `/api/ping` and `/api/meta`
  // have served its answer as `corpus` ever since; nothing drew it, and its six
  // string keys were already sitting in both tables. Its own module says why the
  // fact matters: everything live on this page comes from the audit log, and an
  // item edited in an editor, by another tool, or by a branch switch appends
  // NOTHING to that log — so the page can be drawing a corpus that has moved
  // under it and say nothing at all.
  //
  // Its OWN element, beside the count rather than inside it, because the two
  // have different sources and different refill triggers: the count is
  // `/api/status` on a `mutation`, and the drift is whatever `/api/meta` or the
  // once-a-minute `/api/ping` last answered. One `replaceChildren` per fact
  // means a refill of either can never blank the other — `fillItems`' own
  // header is the argument, applied one element along.
  const drift = document.createElement('span');
  drift.className = 'corpusdrift';
  drift.id = 'corpusdrift';
  // ── AND WHETHER THE CONFIG GOVERNING THIS PAGE IS THE FILE ON DISK —
  // `plan:live seq:13`. A third fact, its own element for the reason `drift`
  // is its own beside the count: a different source (`/api/meta`, read once
  // at boot — see `noteConfigError`), a different refill trigger, and a
  // refill of either must never blank the third. See `fillConfigError`.
  const configErr = document.createElement('span');
  configErr.className = 'configerr';
  configErr.id = 'configerr';
  // ── AND WHAT THE CORPUS IS WAITING ON — owner ruling 2026-08-31.
  //
  // Two counts and two doors: doctor findings at error or warning level, and
  // the items waiting for the owner to rule on them. The owner has twice
  // reported that doctor findings are discovered late, and *"a count that is
  // not a door is only half of it"*.
  //
  // **THE COST WAS THE WHOLE QUESTION, AND IT IS ZERO.** The ruling was
  // conditional — *"DO NOT run a full doctor sweep on the heartbeat … if you
  // cannot make it cheap, do not build it"* — because `runChecks` over this
  // corpus is 103 findings across 732 items and MEASURED AT 0.8–1.7 SECONDS a
  // run, beside the 6.24 ms/min `measureCorpusDrift` costs. Running that on a
  // heartbeat, per visible tab, is not a field, it is a regression.
  //
  // It is not run. `/api/status` — the ONE call this group already makes for
  // the item count — has served `health: {errors, warnings, infos}` and
  // `reviewQueue` beside that count since it was written. So both numbers come
  // off a response already on the wire, refreshed on `mutation` exactly as the
  // count is, and the heartbeat is untouched. `fillItems` fills this element
  // from the same body in the same pass.
  //
  // `.sprop` and not a new class: it is the strip's existing shrink-and-
  // ellipsise treatment (`min-inline-size:0; overflow:hidden; text-overflow:
  // ellipsis; white-space:nowrap`), which is what keeps the strip from spilling
  // at 900px. Nothing is added to either stylesheet for this.
  const notes = document.createElement('span');
  notes.className = 'sprop';
  notes.id = 'corpusnotes';
  corpus.append(count, drift, configErr, notes);

  // ── WHERE THIS SESSION IS, AND WHICH CORPUS IT GOT — owner request,
  // 2026-09-02, and the coordinator's ruling the same day that BOTH are drawn
  // rather than one standing in for the other.
  //
  // ── WHY ITS OWN GROUP, AND NOT INSIDE `corpus` ─────────────────────────
  //
  // The obvious home was the corpus group one along, and it is the wrong one
  // twice over. That group's subject is what is IN the corpus — an item count,
  // whether the files moved under the log, how many doctor findings stand,
  // what is waiting to be ruled on — while these two say WHICH corpus all of
  // that was counted from, which is a fact one level up. And it would have put
  // a field named CORPUS under a heading reading CORPUS, which is the exact
  // noise `standDownDuplicateHeadings` exists to remove and which that
  // function cannot remove here, because the group would then hold five names
  // rather than one.
  //
  // IDENTITY and not STATE, so it sits on row 1: these do not move on the
  // per-message clock row 2 runs at, and the day one of them moves is the day
  // it is the most important thing on the bar. The strip's own fitter deals
  // the groups across rows by measurement, so a seventh group costs no
  // hand-kept layout.
  const where = group('where', 'strip.grp.where', identity);
  const whereState = document.createElement('span');
  whereState.className = 'wherestate';
  whereState.id = 'wherestate';
  where.append(whereState);

  // ── THE ACCOUNT'S QUOTA IS A DIFFERENT SUBJECT FROM THIS SESSION'S WINDOW,
  // and since 2026-09-01 it is a different GROUP — owner ruling, the second
  // rebalance of the same evening.
  //
  // MEASURED at 2273px with the two rows first drawn: `sgrp-session` was eight
  // fields and 1,492px — SIXTY-FIVE PERCENT of the whole strip in one group,
  // where every other group measured between 129 and 432px. Row 2 was not
  // overloaded because it held three groups; it was overloaded because one of
  // them was larger than all the others combined. Moving whole groups between
  // rows could only have inverted that.
  //
  // **The split is by subject, which is the rule the owner set** (*"divide the
  // rows by related subjects, simmilar to the terminal status line"*). The
  // context figure, the ask, the myctx share and the handover verdict are all
  // about THIS SESSION'S WINDOW. The five-hour and seven-day windows are about
  // the ACCOUNT'S QUOTA — a different thing, on a different clock: hours and
  // days, against a figure that moves on every response. A slow fact belongs
  // with the other slow facts, which is line 1.
  //
  // **This is one place the two bars deliberately differ, and the parity test
  // is built to allow it.** The terminal carries the rate windows on its line
  // 2, because a terminal has one width and no second row to spend. What
  // `test/ui/strip-parity.test.ts` compares is WHICH FACTS are on the bar,
  // never where or how they are drawn — a gate that asserted layout would fail
  // the first time one surface could do something the other cannot.
  const limits = group('limits', 'strip.grp.limits', identity);
  const limitState = document.createElement('span');
  limitState.className = 'limitstate';
  limitState.id = 'limitstate';
  limits.append(limitState);

  // ══ LINE 2 — STATE ════════════════════════════════════════════════════

  const session = group('session', 'strip.grp.session', state);
  const ctx = document.createElement('span');
  ctx.className = 'ctxstate';
  ctx.id = 'ctx';
  session.append(ctx);

  // ── WHAT THIS SESSION IS COSTING, AND HOW MUCH THE CACHE IS ABSORBING.
  //
  // One group and not two fields in the session group, because they are the
  // ACCOUNT's facts rather than this window's: the context figure beside them
  // measures the window, and `$4.62` measures the bill. The terminal folds the
  // pair into one block for the same reason — they are one question — and this
  // is that block with a label on it.
  //
  // No new source and no new call: `cost.total_cost_usd` rides the status-line
  // payload `/api/watch/context` already reads, and the warm share is derived
  // from the three token counts in the same payload by the same `payloadExtras`
  // the terminal parses it with.
  const cost = group('cost', 'strip.grp.cost', state);
  const costState = document.createElement('span');
  costState.className = 'coststate';
  costState.id = 'coststate';
  cost.append(costState);

  // ── THE AUDIT GROUP — two properties the reader is owed, and BOTH of them
  // are measured now.
  //
  // ── ONE FIGURE SINCE 2026-08-31, NOT TWO — owner ruling.
  //
  // `strip.append` (the audit append p95) and the `strip.meas` chip beside it
  // are CUT. The p95 is a latency measurement of the audit log's WRITE path: a
  // developer diagnostic with no action attached, holding a permanent place in
  // the densest row this shell has. It is not useless, it is MISPLACED — and
  // nothing here was ever measuring it. The mockup's `0.55 ms` came out of
  // `core/audit-db.ts`'s own benchmark header, and that is where the figure
  // still lives, beside `test/perf/audit-latency.perf.ts` which takes it. No
  // measurement was lost by this cut, because none was being made.
  //
  // The injections figure stayed, on an explicit ruling that it stays: it is
  // the at-a-glance proof the one feature this product exists for is firing at
  // all. **It stayed for four days as a label with a permanent `not measured`
  // chip under it, and that is what is fixed on 2026-09-01** — the owner
  // reported it twice. See `injectionParts` for where the number was already
  // being computed and thrown away, and for why the LABEL moved to meet the
  // number rather than the other way round.
  //
  // Built empty here and filled by `drawContext()` from `/api/watch/context`,
  // which is what every other measured segment on this bar does. The 26px band
  // must not jump when the answer lands, so the element exists from first
  // paint; `fillContext`'s `unread()` names the group if the call fails.
  const audit = group('audit', 'strip.grp.audit', state);
  const auditState = document.createElement('span');
  auditState.className = 'auditstate';
  auditState.id = 'auditstate';
  // ── AND WHEN THE LOG LAST MOVED, the group's other figure — `newestAuditRow`
  // over the audit projection `/api/watch/context` already opens. It is the
  // field this group's header once called impossible, made possible by a
  // different endpoint answering it.
  //
  // Its own element beside the injections figure, for the reason `#corpusdrift`
  // is its own beside the count: two facts, two sources, two refill triggers,
  // and one `replaceChildren` per fact means a refill of either can never blank
  // the other.
  const auditLog = document.createElement('span');
  auditLog.className = 'auditlog';
  auditLog.id = 'auditlog';
  audit.append(auditState, auditLog);

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
  // The tail belongs to the END of the strip, wherever that ends up: it is the
  // shared stream's fault and it is not a provenance group, so `layoutStrip`
  // appends it after the last row's last group rather than binding it to the
  // state row by name.
  const tail = [liveSep, live];

  // ── THE SCREEN-LIVE AFFORDANCE IS NO LONGER BUILT HERE — `plan:walk
  // seq:116`, owner ruling 2026-08-31: *"move the refresh button to the
  // screen"*.
  //
  // The owner asked what a refresh button on the right of the status bar was
  // for, *"if the status bar should be ongoing refreshed"*, and that question
  // IS the defect. The strip refreshes itself silently — `CHROME_INVALIDATION`
  // declares every group `auto` — and the control at the end of its row acts on
  // THE SCREEN. Its own message said so all along (*"New activity for this
  // screen. Refresh"*); the placement contradicted the wording, and the
  // placement won. It is built by `showLiveAffordance` now, into the section it
  // acts on. See that function for how the single-slot guarantee and
  // `#screenstale`'s specificity fix both survive the move.
  //
  // This function reruns on a live page — `installNonceRedemption()` calls it
  // a second time after a pasted nonce redeems in place — and `strip
  // .replaceChildren()` above would otherwise silently un-say a fault the
  // stream already reported. A fact the reader was already told must survive
  // the chrome being rebuilt around it. The affordance no longer needs the
  // same treatment for the same reason it needed it before: it does not live
  // in this subtree any more, so a rebuild here cannot reach it.
  // -- THE ROWS THEMSELVES, MADE FROM THE LISTS AND THEN MEASURED.
  stripPlan = { identity, state, tail };
  fitStrip();
  watchStripFit(strip);

  if (liveEnded !== null) showLiveFault(liveEnded);
}

/**
 * The strip's contents as SUBJECTS rather than as rows — `{identity, state,
 * tail}`, each an ordered list of elements. `null` until `renderChrome()` has
 * run; `fitStrip()` is a no-op before that, and in a test harness that never
 * built a shell.
 */
let stripPlan = null;

/**
 * **How much of a subject is being cut off, in pixels, right now.**
 *
 * Not an estimate of what the groups WOULD need. A natural-width estimate
 * cannot be taken while flexbox is already squeezing them — every group would
 * be measured at the width it had just been shrunk to — so what is asked here
 * is the question the owner actually asked: *is anything truncated*. Every box
 * in this subject that is scrolling its own content is one that is cutting text
 * off, and the sum of what each cannot show is how much room the subject is
 * short of.
 *
 * That number is directly comparable between the two subjects, which is what
 * decides who gets the third row when both are short.
 */
function stripDeficit(subject) {
  let short = 0;
  for (const row of document.querySelectorAll('.striprow-' + subject)) {
    for (const el of row.querySelectorAll('*')) {
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
        short += el.scrollWidth - el.clientWidth;
      }
    }
  }
  return short;
}

/**
 * Below this, a subject is not "truncated", it is an ellipsis.
 *
 * **A whole row is 38px of the body, so it is spent for lost WORDS and not for
 * lost pixels.** Measured at 1,440px on the live corpus: the identity row was
 * three boxes short by 6px, 7px and 5px — eighteen pixels, under one character
 * each, and every one of them already ellipsised AND disclosed by its own
 * `title`. Buying that back with a fourth row would have cost 38px of the one
 * elastic track in the shell to recover three characters, which is the trade
 * the owner is on the other side of: the complaint is that fields are
 * *truncated*, and a value whose last character is an ellipsis is not a field
 * that has been cut off.
 *
 * Forty pixels is five to six characters at `--fs-strip` — a short word, the
 * smallest unit whose loss actually costs a reader meaning. It is also the
 * hysteresis that stops the bar adding and dropping a whole row as the context
 * percentage ticks through a digit.
 */
const STRIP_SLACK = 40;

/**
 * Put the subjects into rows. `splits` maps each subject to how many of its
 * groups sit on each of its rows — `{identity: [4], state: [1, 2]}` is one
 * identity row of four groups over two state rows of one and two.
 *
 * **A subject's continuation rows sit immediately under its own first row**, so
 * the reading order is never broken: identity, identity again, state — or
 * identity, state, state again. A shared overflow row would put the end of line
 * 1 below the whole of line 2, which is the "spilling by position" the owner
 * ruled against. A group is never split and never changes subject.
 *
 * Separators are drawn HERE and not by whoever built the group, because a
 * separator is a fact about two ADJACENT groups: the group that ends a row must
 * not carry one, and the group that opens the next must not either.
 */
function layoutStrip(strip, splits) {
  const rows = [];
  const push = (subject, groups) => {
    const row = document.createElement('div');
    row.className = 'striprow striprow-' + subject;
    groups.forEach((g, i) => {
      if (i > 0) {
        const bar = document.createElement('span');
        bar.className = 'sep';
        row.append(bar);
      }
      row.append(g);
    });
    rows.push(row);
  };
  for (const subject of ['identity', 'state']) {
    const groups = stripPlan[subject];
    let at = 0;
    for (const take of splits[subject]) {
      push(subject, groups.slice(at, at + take));
      at += take;
    }
    if (at < groups.length) push(subject, groups.slice(at));
  }
  rows[rows.length - 1].append(...stripPlan.tail);
  strip.replaceChildren(...rows);
}

/**
 * Every way of dealing `n` groups into exactly `rows` rows, in order of
 * FRONT-LOADED first — `[3,1]` before `[2,2]` before `[1,3]`.
 *
 * Front-loaded first because the bar reads top to bottom: what fits on the
 * earlier row belongs on it, and a continuation row that is fuller than the row
 * it continues reads as two rows rather than as one thing that ran on. The
 * first composition that is not cut wins, so the order IS the preference.
 */
function stripCompositions(n, rows) {
  if (rows === 1) return [[n]];
  const out = [];
  for (let head = n - rows + 1; head >= 1; head -= 1) {
    for (const rest of stripCompositions(n - head, rows - 1)) out.push([head, ...rest]);
  }
  return out;
}

/**
 * **THE CEILING, AND IT IS A NUMBER AN OWNER MAY WANT TO MOVE.**
 *
 * Rows are created because the content needs them, so nothing here decides that
 * two or three is the right answer — the measurement does. What this decides is
 * where growing the bar stops being the better trade: the strip is the shell's
 * last grid row and every pixel of it comes out of `.app`'s one elastic track,
 * so a bar free to grow without limit could eat the body it annotates. Four
 * rows is ~145px, which is 20% of a 720px window and the point past which the
 * bounded-and-disclosed ellipsis (every box here clips WITH a title) is the
 * cheaper answer than another band of chrome.
 *
 * It is not a row count — three rows is simply what today's fields need at most
 * widths — and a field set that grows will reach it sooner. Reported.
 */
const STRIP_MAX_ROWS = 4;

/**
 * **THE ROW COUNT IS MEASURED, NOT DECLARED** — owner ruling 2026-09-01.
 *
 * -- WHAT THE OWNER SAW, AND WHERE ----------------------------------------
 *
 * *"On a screen with lower resolution the web status bar is somewhat
 * truncated, could we dynamically set 3rd status bar row so fields could
 * overflow dynamically to that line and not be truncated?"*
 *
 * Measured in a browser against the live 733-item corpus, before anything
 * moved: identity holds ~1,270px of content and state ~1,900-2,080px, so the
 * two-row bar was clean at the owner's 2,273px and cutting below roughly
 * 2,100px. At 1,600px four boxes on the state row were clipping; at 1,024px the
 * window group on the identity row was showing 52px of a 331px value.
 *
 * -- IT GROWS, IT IS NOT RESERVED, AND THE COST IS WHY ---------------------
 *
 * The owner ruled once already that *a reserved slot beats a thing that appears
 * and shifts content* — for the refresh affordance, a 37px control INSIDE a
 * screen, where reserving it costs that screen 37px of one row. This is not
 * that. A reserved extra strip row is 38px of the shell's ONE elastic track
 * taken on every screen at every width, including the owner's own 2,273px where
 * it is never needed — and it would be 38px of nothing, which is the empty-band
 * defect this shell has already paid for twice (`#prov` at 26px saying nothing,
 * and the 26+30px bare band across the bottom of every screen). A row that is
 * always there and usually empty is worse than a row that appears when there is
 * something to put in it.
 *
 * What that ruling was actually against is CONTENT THAT JUMPS while a reader is
 * looking at it, and that is answered directly instead: `STRIP_SLACK` means a
 * row is spent for real truncation and never for a digit, and the decision is a
 * pure function of (content, width) — the same content at the same width always
 * gets the same number of rows, so nothing oscillates.
 *
 * -- HOW IT DECIDES -------------------------------------------------------
 *
 * Always from ONE ROW PER SUBJECT, so the answer never depends on what the bar
 * happened to be showing a moment ago. Then a row at a time, each one going to
 * whichever subject is being cut MORE — measured, not preferred, so a field set
 * that grows on either subject is served by the same rule. Within a subject the
 * groups are dealt front-loaded first (`stripCompositions`), so a continuation
 * row is never fuller than the row it continues.
 *
 * A row that does not actually reduce the cut is HANDED BACK rather than kept:
 * a group whose own content is wider than the whole bar cannot be helped by
 * moving it, and spending 38px to draw it in a different place is the worst of
 * both answers.
 *
 * **Truncation stays the last resort.** When the ceiling is reached or another
 * row would not help, what is over ellipsises exactly as it does today — every
 * box here bounds AND discloses, so a cut is still readable one hover away.
 *
 * **Nothing here assumes a field width.** Everything is read off the rendered
 * bar, so fields that gain a progress bar, an icon and a `used / max` count are
 * answered by the same code taking more rows sooner, with no number to update.
 *
 * **This lays out several times on purpose, and synchronously.** Nothing paints
 * between the trial layouts — they are one task — so a reader never sees the
 * intermediate bars the measurement walks through.
 */
function fitStrip() {
  const strip = document.getElementById('strip');
  if (strip === null || stripPlan === null) return;
  const splits = {
    identity: [stripPlan.identity.length],
    state: [stripPlan.state.length],
  };
  layoutStrip(strip, splits);

  // A subject nothing further can be done for — one group per row already, or
  // an extra row that measured no better. It stops being considered so the loop
  // can go on serving the OTHER one instead of stopping at the worse of the two.
  const stuck = new Set();
  let rows = 2;
  while (rows < STRIP_MAX_ROWS && stuck.size < 2) {
    const cut = { identity: stripDeficit('identity'), state: stripDeficit('state') };
    const open = ['identity', 'state'].filter((s) => !stuck.has(s) && cut[s] > STRIP_SLACK);
    if (open.length === 0) break;
    // The row goes to whoever is being cut MORE. Measured, never preferred.
    const worst = open.reduce((a, b) => (cut[b] > cut[a] ? b : a));
    // One group per row already: there is no further arrangement to try.
    const want = splits[worst].length + 1;
    if (want > stripPlan[worst].length) { stuck.add(worst); continue; }

    let best = null;
    let bestCut = cut[worst];
    // **THE EVENEST ARRANGEMENT THAT FITS, not the first one that does.** Owner,
    // 2026-09-01: *"it also should layout more balanced and evenly located in
    // the rows"*.
    //
    // `stripCompositions` enumerates largest-first-row first -- five groups over
    // two rows arrive as `[4,1]`, `[3,2]`, `[2,3]`, `[1,4]` -- and this loop used
    // to BREAK on the first one under the slack. `[4,1]` clears the threshold, so
    // the bar settled on four groups crowded onto one row and a single group
    // alone on the next, and never looked at `[3,2]` sitting one step behind it.
    //
    // Fitting is a THRESHOLD, not a score: every arrangement under the slack is
    // equally uncut, so among them the tie is broken by evenness rather than by
    // enumeration order. Only when nothing fits does the smallest deficit win --
    // there the number is a real measure of harm, and balance is not worth a cut
    // word.
    let fit = null;
    const spread = (c) => [Math.max(...c), Math.max(...c) - Math.min(...c)];
    const evener = (a, b) => {
      const [aMax, aSpread] = spread(a);
      const [bMax, bSpread] = spread(b);
      return aMax !== bMax ? aMax < bMax : aSpread < bSpread;
    };
    const was = splits[worst];
    for (const comp of stripCompositions(stripPlan[worst].length, want)) {
      splits[worst] = comp;
      layoutStrip(strip, splits);
      const now = stripDeficit(worst);
      if (now <= STRIP_SLACK) {
        if (fit === null || evener(comp, fit)) { fit = comp; bestCut = now; }
        continue;
      }
      if (now < bestCut) { best = comp; bestCut = now; }
    }
    if (fit !== null) best = fit;
    if (best === null) {
      // The extra row bought nothing — a group whose own content is wider than
      // the whole bar cannot be helped by moving it, and spending 38px to draw
      // it somewhere else is the worst of both answers. Handed back.
      splits[worst] = was;
      layoutStrip(strip, splits);
      stuck.add(worst);
      continue;
    }
    splits[worst] = best;
    layoutStrip(strip, splits);
    rows += 1;
    // NO EARLY EXIT ON `bestCut`. The subject just served being clean says
    // nothing about the other one, and breaking here left the identity row cut
    // at 1,024px while the state row had only just been given its second. The
    // loop re-measures BOTH at the top, which is the only place that decision
    // can be made correctly.
  }
}

/**
 * Re-fit when the bar's CONTENT or its WIDTH moves, and never otherwise.
 *
 * Both matter and neither implies the other: a window drag changes the width
 * with the content untouched, and a refill changes the content — every group
 * swaps its children in with one `replaceChildren` — with the width untouched.
 * A `MutationObserver` over the subtree is the ONE wiring point that catches
 * every refill without this function having to know which they are, which is
 * what stops a segment added later from silently missing the fit.
 *
 * `takeRecords()` after the fit DISCARDS the mutations the fit itself just
 * made. Without it every fit would queue another forever: a `MutationObserver`
 * callback is a microtask, so it runs after this function has returned and a
 * plain re-entrancy flag would already be false by the time it did.
 *
 * Coalesced to one fit per frame, because a refill lands as a burst of
 * mutations and re-laying the bar out per record is work nobody sees.
 */
const STRIP_WATCHED = new WeakSet();

function watchStripFit(strip) {
  if (typeof MutationObserver !== 'function') return;
  // ONCE PER STRIP. `renderChrome()` runs a second time when a pasted nonce
  // redeems in place, and `#strip` is FOUND rather than rebuilt there — so a
  // second call would leave two observers on one bar, both fitting it. Same
  // shape and same reason as `setupLiveChrome`'s own once-ever guard.
  if (STRIP_WATCHED.has(strip)) return;
  STRIP_WATCHED.add(strip);
  let queued = false;
  const run = () => {
    queued = false;
    fitStrip();
    watcher.takeRecords();
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  };
  const watcher = new MutationObserver(queue);
  watcher.observe(strip, { childList: true, subtree: true, characterData: true });
  // ── AND WHEN THE WINDOW CHANGES SIZE — owner, 2026-09-01: *"the browsers sizes
  //    changed and we need to fit the bar to the available space"*.
  //
  // A `MutationObserver` alone sees only the bar's own CONTENT. Every reason the
  // strip needs refitting that comes from OUTSIDE it — the window resized, the
  // rail opened, the zoom changed — mutated nothing in here and so raised
  // nothing at all, and the arrangement stayed whatever the width at first paint
  // had earned. A bar that fits at 2273px and is cut at 1280px was only ever one
  // drag of a window edge away.
  //
  // **Width only.** Adding a row changes the strip's HEIGHT, and a height change
  // is this observer watching its own tail — it would queue a fit, which adds a
  // row, which queues a fit. The remembered width is what breaks that loop:
  // nothing the fit itself does to the bar can change the width the shell gives
  // it, so a width that has genuinely moved is always someone else's doing.
  if (typeof ResizeObserver === 'function') {
    let lastWidth = null;
    const sizer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width === lastWidth) return;
      lastWidth = width;
      queue();
    });
    sizer.observe(strip);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(queue).observe(strip);
}

/** The id of the app's one live region. Written once, read by `announce()`. */
const ANNOUNCE_ID = 'announce';

/**
 * **THE APP'S ONE LIVE REGION, AND THERE IS EXACTLY ONE.**
 *
 * Measured 2026-08-25 by `plan:review seq:5`:
 * `document.querySelector('[aria-live]')` answered `null` on every screen, so
 * no transient outcome in this product — not a copy, not a refresh, not an
 * execution result — was ever announced. The Copy button that acknowledges
 * nothing was one instance of that; the shell having no place to say anything
 * was the defect underneath it.
 *
 * **Re-measured 2026-08-31, because that census has moved and the difference
 * is the whole design.** Three `aria-live` regions have landed since, and none
 * of them is this one: `screens/watch.js`' `#alive`, `screens/palette.js`'
 * `#globcount` and `boundedList`'s paging line in `screens/parts.js`. All three
 * are VISIBLE SENTENCES a sighted reader also gets, rewritten in place, two of
 * them drawn by the design of record itself — content that happens to be live,
 * not a place to put an outcome. What was still missing, and is what this
 * builds, is a home for a transient outcome that has no visible home of its
 * own: a copy that worked, and a copy that did not.
 *
 * **One, in the shell, and not one per screen.** A second region is how two
 * announcements collide and a reader hears neither, and a screen module that
 * created chrome outliving its own render would be taking the shell owner's
 * decision. It is built beside `#provparts` for the same argument the
 * provenance bar already makes for qualifications: one home, at shell level,
 * for a thing every screen owes.
 *
 * **It is announced, not seen.** The design of record has no shell slot for
 * this — its two `aria-live` regions (`#alive` on Watch, `#globcount` on the
 * Composer) are per-screen content with their own copy, not a place to put a
 * transient outcome — so drawing words into the 26px provenance band would be
 * inventing visible chrome the owner has not approved. Hidden the ONE way a
 * live region may be hidden: clipped to a pixel, never `display:none`,
 * `visibility:hidden` or `[hidden]`, all three of which take it out of the
 * accessibility tree and silence it. Through CSSOM because the server ships
 * `style-src 'self'` and a `style=` attribute is refused outright — the same
 * door `screens/coverage.js`'s legend swatch already goes through.
 *
 * **`aria-live` is set per announcement rather than baked in**, which is why
 * this carries no `role`: `role="status"` would fix the politeness at polite
 * and then be contradicted by the attribute. Polite is the default and covers
 * every success. A FAILED copy is the one case that argues for interrupting —
 * the reader believes a command is on their clipboard, and the next thing
 * they do is paste something else into a shell, where the mistake is theirs to
 * discover the hard way. `aria-atomic` because these are whole sentences and a
 * reader who hears half of one has been told nothing.
 */
function announceRegion() {
  const region = document.createElement('span');
  region.className = 'announce';
  region.id = ANNOUNCE_ID;
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  // Absolute, so it is out of `.prov`'s flex flow entirely and cannot widen
  // the bar or move what the bar already says. One pixel with the middle
  // clipped away is the shape that stays in the accessibility tree.
  region.style.setProperty('position', 'absolute');
  region.style.setProperty('inline-size', '1px');
  region.style.setProperty('block-size', '1px');
  region.style.setProperty('overflow', 'hidden');
  region.style.setProperty('clip-path', 'inset(50%)');
  return region;
}

/**
 * Say one thing, once, to whoever is listening rather than looking.
 *
 * `nodes` is what `ctx.t()` answers — Node[], never a string, for ruling A1's
 * reason: a translated sentence carries `.m`/`.v` runs and a `textContent`
 * assignment flattens them. `urgent` raises the region to `assertive`, and it
 * is SET BEFORE the content: an assistive technology reads the politeness that
 * is on the element at the moment the mutation lands, so writing the words
 * first would announce them at the old level.
 *
 * A no-op when the shell has not been built — a screen rendered by a test
 * harness has no chrome, and an announcement is not worth a thrown error.
 */
function announce(nodes, urgent = false) {
  const region = document.getElementById(ANNOUNCE_ID);
  if (region === null) return;
  region.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
  region.replaceChildren(...nodes);
}

/**
 * A neutral chip naming a state, carrying its own glyph.
 *
 * Neutral on purpose. An unmeasured fact is not a warning and may not borrow
 * `--warn`'s voice — a reader who learns that "not read" looks like "differs
 * from origin/main" stops being able to read either. `data-g` is the same
 * channel `.chip.ok` and `.chip.warn` use, so the state stays legible with no
 * colour at all: under forced-colors, on a monochrome printer, and to a reader
 * who cannot tell green from amber.
 */
function stateChip(key, titleKey) {
  const chip = document.createElement('span');
  chip.className = 'chip unmeas';
  chip.dataset.g = '◌';
  chip.dataset.k = key;
  chip.append(...translate(table.strings, key));
  // The chip NAMES the state in two words, because a bar 30px tall has room
  // for two words and the context sentence beside it is the one thing allowed
  // to give way — written as a sentence, these two chips measured 400px of a
  // 1280px strip between them and squeezed that sentence to nothing. WHY it is
  // in that state is a title, the same treatment the git group's own
  // explanation already gets. `tFlat` because an attribute cannot hold an
  // element; see its own header.
  chip.title = flat(table.strings, titleKey);
  return chip;
}

/**
 * **The unmeasured state for a segment whose call did not answer, and the
 * control that asks again.**
 *
 * The two built segments used to leave their span EMPTY here, on the stated
 * reasoning that "the strip says nothing rather than guessing" and "leave the
 * count empty rather than show a wrong one". Both halves of that are right and
 * the conclusion was wrong: a blank cannot tell a reader whether the fact is
 * absent, whether the call failed, or whether the strip is still loading — and
 * with no retry it never came back, which is what the owner saw as a status
 * line that "is not constantly showing".
 *
 * Saying nothing and saying "not read" are different amounts of guessing.
 * Only one of the two is a claim, and it is the blank.
 */
function unreadState(retry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon';
  btn.append(...translate(table.strings, 'btn.refresh'));
  // Re-entrant by construction: `retry` calls the same filler again, which
  // rebuilds this element and this button along with it.
  btn.onclick = () => { retry(); };
  return [stateChip('strip.unread', 'title.unread'), btn];
}

/** A token count the way §4b writes one — `47.0k` — and never a blank. */
/**
 * **ONE TREATMENT FOR EVERY USED-OF-MAXIMUM FIELD ON THE STRIP.**
 *
 * Owner ruling, 2026-09-01: *"use the same controls for every field that
 * displays amount used from maximum available for context, handover, used 5h,
 * used 7d etc"*, then *"i want a field name on the left of every info because
 * it's not self explanatory"*, then *"caps as name looks ok, use for both"*
 * and *"the name could be in white and the field text coloured"*.
 *
 * The terminal answered all four first; this is the same treatment on the same
 * five fields, from the same shared `usageLevelOf`, so a figure cannot be
 * `caution` in one window and `warn` in the other:
 *
 *     NAME   icon   bar          percentage   (used / max)   suffix
 *     ASK    🔶     ▰▰▰▰▰▰▰▰▱▱   76%          (65.0 / 85)    ·+20.0
 *
 * ── WHAT DOES NOT TRANSFER FROM THE TERMINAL ──────────────────────────────
 *
 * The flat `│`-separated line. The strip keeps its grouped-box layout and its
 * headings — the FIELDS look like the terminal's fields, the BAR does not
 * become a copy of the terminal. So this returns one inline element to be
 * dropped inside whichever `.sgrp` already owns the fact, and it invents no
 * layout of its own.
 *
 * ── THE ICON CARRIES AN ACCESSIBLE NAME, WHICH IS NOT OPTIONAL ────────────
 *
 * `06-a11y.html`'s rule is a glyph AND a colour AND a name. An emoji dropped
 * into HTML is announced by screen readers as whatever the font vendor called
 * it — "skull", not "critical" — or skipped entirely, so the level would be a
 * picture with no name at all. `role="img"` plus an `aria-label` out of the
 * string table is what makes the band a WORD as well as a hue, in both
 * languages, and it is why `strip.level.*` exists in `en.js` and `he.js`.
 *
 * `safe` draws NO icon — a calm bar should be quiet, the same choice the
 * terminal makes — so the band's name there is carried by the value's colour
 * and by the `title`, which every one of these fields gets.
 */
/**
 * A field's NAME, in caps and white, with no banding — owner ruling
 * 2026-09-01: *"field names should be caps and white"*, of every field and not
 * only every group heading.
 *
 * `bandUsage` does this AND the level treatment; this is the half a field
 * takes when it has no level to show. Same class, same casing, same ink, so
 * the names read as one row of fixed furniture whether or not the value beside
 * them carries a hue.
 *
 * A group lends its name to a field only where it holds ONE — `COST` above a
 * field also called `COST` is noise. Where it holds several, as the cost group
 * now does with the spend, the cache share and the session's age, each field
 * takes its own.
 */
function nameField(el, nameKey) {
  const name = document.createElement('b');
  name.className = 'ulab';
  name.dataset.k = nameKey;
  name.append(...translate(table.strings, nameKey));
  el.classList.add('ufield');
  el.prepend(name);
  return el;
}

/** Whether a field already carries one of the four levels. */
function isBanded(el) {
  return ['safe', 'caution', 'warning', 'critical'].some((b) => el.classList.contains(b));
}

function bandUsage(el, pct, nameKey) {
  const level = usageLevelOf(pct);
  const band = level === null ? 'unmeas' : level;
  el.classList.add('ufield', band);

  // **THE VALUE IS WRAPPED so the band's ink has one element to land on.**
  // These fields arrive in three shapes — a `.ctxfig` span, a `.chip`, and a
  // sentence assembled by the string table — and only some of them had a child
  // to colour. Wrapping whatever is already here means the level reaches the
  // VALUE and nothing else, whichever shape the field came in, and it is what
  // lets `.ulab` keep its white against every one of them.
  const value = document.createElement('span');
  value.className = 'uval';
  value.append(...el.childNodes);
  el.append(value);

  // The NAME, first and in white. Upper-cased by the STYLESHEET rather than by
  // the string: `strip.grp.session` IS `'session'`, and the shouting is a
  // presentation choice the strip already makes for its group headings. Casing
  // in CSS keeps the string translatable and lets Hebrew — which has no case —
  // render its own word untouched.
  if (nameKey !== undefined) {
    const name = document.createElement('b');
    name.className = 'ulab';
    name.dataset.k = nameKey;
    name.append(...translate(table.strings, nameKey));
    el.prepend(name);
  }

  // The BAR is decoration over a number that is already in the element, so it
  // is hidden from the accessibility tree rather than announced as ten box
  // characters. The figure it sits beside is the accessible content.
  const bar = document.createElement('span');
  bar.className = 'ubar';
  bar.setAttribute('aria-hidden', 'true');
  bar.textContent = usageBar(pct);
  // INSIDE the value, not beside it. The value is the pill — see `bandUsage`'s
  // note on the label sitting outside — and the bar and the icon belong to the
  // figure rather than to the field's name.
  el.querySelector('.uval').prepend(bar);

  // ── THE ICON CARRIES AN ACCESSIBLE NAME, AND THAT IS NOT OPTIONAL ────────
  //
  // `06-a11y.html`'s rule is a glyph AND a colour AND a name. An emoji dropped
  // into HTML is announced as whatever the font vendor called it — "skull",
  // not "critical" — or skipped entirely, which would leave the band as a
  // picture with no name at all. `role="img"` plus an `aria-label` out of the
  // string table is what makes the level a WORD in both languages, and it is
  // why `strip.level.*` exists in `en.js` and `he.js`.
  //
  // `safe` draws NO icon: a calm bar should be quiet, the same choice the
  // terminal makes. The band is still named there — by the value's colour and
  // by the field's own `title`.
  if (level !== null && level !== 'safe') {
    const icon = document.createElement('span');
    icon.className = 'uicon';
    icon.setAttribute('role', 'img');
    const key = 'strip.level.' + level;
    icon.dataset.k = key;
    icon.setAttribute('aria-label', flat(table.strings, key));
    icon.textContent = LEVEL_ICON[level];
    bar.before(icon);
  }
  return el;
}

/** The four levels' icons — the same three glyphs the terminal draws. */
const LEVEL_ICON = {
  safe: '',
  caution: '\u26a0\ufe0f',
  warning: '\u{1f536}',
  critical: '\u{1f480}',
};

function tokenCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

/**
 * Fill the strip from the endpoints that can answer it.
 *
 * Separate from `renderChrome` because the shell must exist before the first
 * fetch resolves — a bar that appears late is a layout that jumps, and the
 * 56px row is reserved from first paint whether or not the data has landed.
 *
 * The two halves are separate functions because each is its own retry target:
 * a failed `/api/meta` must not take the item count down with it, and asking
 * again must ask for the one thing that failed.
 *
 * **They are now each a live-REFILL target too**, for the same reason one step
 * further on: `CHROME_INVALIDATION` declares different kinds per group, and
 * `setupLiveChrome` calls exactly the filler whose source moved. This whole
 * function runs at boot and never again — nothing wholesale re-fills the strip.
 */
async function fillChrome() {
  const git = document.getElementById('gitstate');
  const count = document.getElementById('stripitems');
  if (git === null || count === null) return;
  // **The drift chip is drawn at BOOT, before anything has answered.** Its
  // source is a field on `/api/meta` and `/api/ping` rather than a call of its
  // own, so without this the segment sits EMPTY until the first answer arrives
  // — and empty is the one thing it may not be: a page that has not been told
  // whether the corpus moved is not a page that measured nothing.
  // `corpusDriftAnswer` is `null` here and `corpusDrift()` reports that as
  // `unknown`, which draws "not known" and never "in step".
  fillCorpusDrift();
  // Same reasoning, one fact over: a page that has not been told whether the
  // config governing it is the file on disk is not a page that measured a
  // working one — see `fillConfigError`.
  fillConfigError();
  await Promise.all([fillGit(git), fillItems(count), fillProvenance()]);
}

/**
 * **How the audit projection stood when this page read it** — the shell's own
 * provenance, in the bar built for provenance.
 *
 * `/api/watch/volume` at one minute and one bucket is one indexed row and one
 * column; it is asked for its `projectionState`, not for its series. Three of
 * the bar's four keyed answers are reachable from a read surface:
 *
 *   'fresh'    -> `prov.projFresh`  — already current
 *   'absent'   -> `prov.projAbsent` — never built. `readProjection` calls this
 *                 "the never-built empty state, and ONLY it", and it is the
 *                 answer a fresh workspace always gives; it had no key until
 *                 today, so the one thing the bar most often had to say was the
 *                 one thing it could not.
 *   a refusal  -> `prov.projFailed` — behind, diverged, truncated or corrupt.
 *                 The endpoint's own message is the reason, carried verbatim.
 *
 * `prov.projCaughtUp` is NOT reachable and that is not an oversight: catching a
 * projection up is a WRITE, a read surface may not perform one, and answering
 * from a stale projection would present a partial history as a complete one.
 * The state exists in the design of record for a surface that may sync. This
 * one may not, so it never draws it rather than drawing it untruthfully.
 */
async function fillProvenance() {
  const proj = document.getElementById('provproj');
  if (proj === null) return;
  const label = document.createElement('span');
  label.id = 'provprojlabel';
  label.dataset.k = 'prov.projLabel';
  label.append(...translate(table.strings, 'prov.projLabel'));
  const state = document.createElement('span');
  try {
    const volume = await api('/api/watch/volume?minutes=1&bucket=60');
    const key = volume.projectionState === 'absent' ? 'prov.projAbsent' : 'prov.projFresh';
    state.dataset.k = key;
    state.append(...translate(table.strings, key));
  } catch (err) {
    state.dataset.k = 'prov.projFailed';
    state.append(...translate(table.strings, 'prov.projFailed',
      { error: err instanceof Error ? err.message : String(err) }));
  }
  // Swapped in at the END, never cleared first. See `fillItems`.
  proj.replaceChildren(label, document.createTextNode(' '), state);
}

async function fillGit(git) {
  // Collected and swapped in below, for the reason `fillItems` states: a live
  // refill that CLEARS first shows a blank where a named state was, for as
  // long as the fetch takes. A plain array rather than a DocumentFragment —
  // `replaceChildren` spreads it just the same, and `test/ui/pane-float.test.ts`
  // drives this file against a minimal document stub.
  const parts = [];
  const keyed = (key, subs) => {
    const el = document.createElement('span');
    el.dataset.k = key;
    el.append(...translate(table.strings, key, subs));
    return el;
  };
  const chip = (key, subs, ok) => {
    const el = keyed(key, subs);
    // The upstream VERDICT, which is a different fact from the branch's name:
    // `git-info.ts` reads `.git` as files and cannot walk revisions, so this
    // says `differs` where a count would be a number nobody measured. Web-only
    // — the terminal draws the branch and not its upstream.
    el.dataset.f = 'upstream';
    el.className = ok ? 'chip ok' : 'chip warn';
    el.dataset.g = ok ? '●' : '▲';
    return el;
  };
  try {
    const meta = await api('/api/meta');
    // First paint's half of the skew disclosure — see `showCodeSkew`. Before
    // the git branch, because everything below this line can `return` early on
    // a shape the strip cannot draw, and the skew is not the strip's fact.
    noteCodeSkew(meta);
    // The first-paint half of the drift disclosure, on the same answer and
    // beside the same call — see `noteCorpusDrift`. Before the git branch, for
    // the identical reason `noteCodeSkew` is: everything below this line can
    // `return` early on a shape the strip cannot draw, and neither of these
    // facts is the git group's.
    noteCorpusDrift(meta);
    // The first-paint (and, via `CHROME_REFILL.repo`, mutation-triggered)
    // half of the config-break disclosure — see `noteConfigError`. Before the
    // git branch for the same reason the two disclosures above are: nothing
    // below this line owns this fact and a shape the strip cannot draw must
    // not cost it.
    noteConfigError(meta);
    // ── AND WHICH REPOSITORY IS OPEN. The wordmark says "mycontext", which is
    // the PRODUCT; nothing in this chrome said which clone. The terminal bar
    // has carried the project name on its line 1 since it was written, and two
    // windows on two clones were indistinguishable here.
    //
    // `repoRoot` is served by `/api/meta`, the call this function already
    // makes. Drawn before the git branch for the reason the two disclosures
    // above are drawn there: everything below can `return` early on a shape
    // the strip cannot draw, and the repository's name is not the git group's
    // fact to lose with it.
    drawProjectName(meta);
    const g = meta.git;
    // `branch` is checked BEFORE `detached`, because git-info.ts documents one
    // shape where both `branch === null` and `detached === false` hold — a HEAD
    // it could not understand — and there `upstream: 'unknown'` is what should
    // render, never "on a branch".
    if (g === undefined || g === null) {
      const none = keyed('strip.notARepo', {});
      none.dataset.f = 'upstream';
      parts.push(none);
    } else if (typeof g.branch === 'string') {
      // **THE BRANCH KEEPS ITS FULL NAME AGAIN, BECAUSE THE GROUP MOVED** —
      // `plan:walk seq:114`, owner ruling 2026-08-31.
      //
      // It was shortened to its last path segment earlier the same day, and
      // that ruling was entirely about WIDTH: measured in the strip, the repo
      // group took 372.5px of the 906px the four groups rendered into at
      // 1280px, while `#ctx` — the context figure the owner asked to be able to
      // read — had 157px. `.ctxstate` was the one flex item in that bar allowed
      // to give way, so every pixel the repo group took came out of exactly
      // that figure, and the owner accepted losing the ability to tell two
      // campaign branches apart at a glance to get it back.
      //
      // That price is not owed any more. This group renders in the HEADER now,
      // which measured 1,692px of nothing at 2304px wide and 668px at 1280, and
      // where nothing else is competing for the space. `campaign/my-context-
      // test` and `campaign/my-context-prod` are two different branches and a
      // reader should not have to hover to find out which one they are on.
      //
      // **The COMMIT stays seven characters** and is not a casualty of the same
      // reasoning: `@ 4798e20` is how a reader tells which build a server is
      // serving, seven characters is the length git itself prints, and a forty-
      // character SHA would be the only thing in this row nobody reads. The
      // full value goes in the `title`, which is the established channel for an
      // explanation beside a value — `stateChip()` puts `title.unread` there and
      // the design of record puts a `title` on `#gitstate` itself. A raw value,
      // deliberately NOT a key: there is nothing in a SHA to translate.
      const commit = String(g.commit ?? '');
      const segment = keyed('strip.branch',
        { branch: g.branch, commit: commit.slice(0, 7) });
      segment.dataset.f = 'branch';
      // Only when something was actually dropped. A title repeating what is
      // already on screen is noise a screen reader reads out twice.
      if (commit.length > 7) segment.title = commit;
      parts.push(segment);
      // **THE UPSTREAM VERDICT DRAWS NOTHING WHEN THERE IS NOTHING TO ACT ON**
      // — owner ruling 2026-08-31, the pass that asked of every field in this
      // bar *"would this change what I do next"*.
      //
      // `in-sync` answered no. "in sync with origin/<branch>" is REASSURANCE:
      // it is the common case, so it holds a permanent place in the most
      // expensive row this shell has and spends it on the one state a reader
      // never needs told. The three states below are CONDITIONS — every one of
      // them is something to do — and the branch NAME and commit above are
      // identity, which is why they stay in every state including this one.
      //
      // So the field now costs nothing in the common case and still carries
      // the whole signal: it draws exactly when it has something to say.
      //
      // **What this is NOT: ahead/behind counts.** The ruling asked for them
      // and this reader cannot honestly produce them. `src/ui/git-info.ts`
      // reads `.git` AS FILES — no shell-out, no revision walk — and says so in
      // its own words: *"ahead/behind counts need a revision walk, which is not
      // a file read, so 'differs' is as precise as this reader can honestly be"*
      // (spec §4 fixes the same vocabulary from the other side). Two numbers
      // this server did not measure, in a bar whose entire job is provenance,
      // is worse than the word that is true. Reported to the owner rather than
      // resolved here.
      //
      // The chip carries the full branch too, and always did: `strip.differs`
      // says "differs from origin/{branch}" — a REMOTE ref, which is a
      // different string from the local branch's display name.
      if (g.upstream !== 'in-sync') {
        const key = g.upstream === 'differs' ? 'strip.differs'
          : g.upstream === 'no-upstream' ? 'strip.noUpstream' : 'strip.unknownTip';
        parts.push(chip(key, { branch: g.branch }, false));
      }
    } else if (g.detached === true) {
      const detached = keyed('strip.detached', { commit: String(g.commit ?? '').slice(0, 7) });
      detached.dataset.f = 'branch';
      parts.push(detached);
    } else {
      parts.push(chip('strip.unknownTip', {}, false));
    }
  } catch {
    // A failed read is not "not a git repository" — that half of the old
    // reasoning stands, and `strip.notARepo` is still never drawn from here.
    // What changed is that it is not a BLANK either. See `unreadState`.
    parts.push(...unreadState(() => { void fillGit(git); }));
  }
  git.replaceChildren(...parts);
}

/**
 * **Swapped in at the END with one `replaceChildren` — never cleared first**,
 * and the same is now true of `fillGit`, `fillContext` and `fillProvenance`.
 *
 * These functions used to open with `el.replaceChildren()` and append after
 * the `await`, which was harmless while the only caller was a boot filling an
 * empty strip. `CHROME_INVALIDATION` gives them a second caller — a live
 * refill of a segment that is already SAYING something — and there the clear
 * blanks a drawn value, a named `strip.unread`, or a measured zero for as long
 * as the fetch takes. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured
 * -thing-is` clause 3 is the whole reason those named states exist: "a blank is
 * indistinguishable from a failure to load". A blank that appears BECAUSE the
 * data moved would be that defect arriving through the mechanism built to end
 * it, and it would arrive on the segments a reader watches most.
 *
 * One statement writes the segment, so it goes from the old answer to the new
 * one with nothing in between.
 */
async function fillItems(count) {
  const label = document.createElement('span');
  // ── WEB-ONLY, AND LEGITIMATELY SO. The item count, the drift sweep, the two
  // doors and the injection tally have no terminal counterpart and are not
  // owed one: `test/ui/strip-parity.test.ts` checks ONE direction — the
  // terminal's fields must be a subset of these — because the browser has room
  // the terminal does not and the owner ruled that it be used. Tagged all the
  // same, so the set this surface declares is the whole of what it draws and
  // not merely the half that has a twin.
  label.dataset.f = 'items';
  label.dataset.k = 'strip.items';
  // ── A PILL LIKE EVERY OTHER FIELD, with one honest difference ───────────
  // Its NAME is already in the string — `strip.items` renders the word
  // "items" — so it takes `.ulab` on that word rather than a second label in
  // front of it. Naming a field twice is worse than not naming it, which is
  // the rule the rate windows follow for the same reason.
  label.className = 'ulab ufield';
  label.title = flat(table.strings, 'title.items');
  label.append(...translate(table.strings, 'strip.items'));
  const value = document.createElement('span');
  value.className = 'm uval';
  const notes = document.getElementById('corpusnotes');
  try {
    const status = await api('/api/status');
    // A measured zero is DRAWN and named — an empty corpus is a finding and
    // the reader is entitled to it (clause 1 of the same standard).
    value.textContent = String(status.items.total);
    // **THE FIGURE GOES INSIDE THE PILL, AFTER ITS NAME.** Owner, 2026-09-01:
    // "735 ITEMS should be ITEMS 735 in the rectangle where 735 should appear
    // in blue". It read value-then-label with the number OUTSIDE the outline,
    // so it drew as the prose "735 items" while every other field on the bar
    // draws `LABEL value` inside one rectangle. `.uval` carries the unlevelled
    // blue by the rule directly above it in styles.css, so the colour needs no
    // second declaration here.
    label.append(document.createTextNode(' '), value);
    count.replaceChildren(label);
    // ── THE SAME BODY, TWO MORE FACTS. See `renderChrome`'s note on
    // `#corpusnotes` for why this costs nothing: `health` and `reviewQueue`
    // were already in this response, so neither count adds a call and neither
    // runs a doctor sweep. Filled in the same pass and with one
    // `replaceChildren`, so the two elements can never disagree about which
    // answer they are drawing.
    if (notes !== null) notes.replaceChildren(...corpusNoteButtons(status));
  } catch {
    value.textContent = '—';
    label.append(document.createTextNode(' '), value);
    count.replaceChildren(label, ...unreadState(() => { void fillItems(count); }));
    // The counts have no answer either, and the retry above asks for all three
    // at once. Cleared rather than left showing the previous corpus's numbers:
    // a stale count beside a `not read` item count is the fossil `walk/123`
    // named, one element along.
    if (notes !== null) notes.replaceChildren();
  }
}

/**
 * **THE TWO COUNTS THE CORPUS GROUP DRAWS, AS DOORS** — owner ruling
 * 2026-08-31.
 *
 * Both are `button.linkid`, the shell's existing link-button primitive, because
 * the ruling attached the door to the count: *"a count that is not a door is
 * only half of it"*. Neither invents arithmetic — `doctorNoticeCount` and
 * `reviewQueueCount` are the SAME two functions the rail badges call, so the
 * strip and the rail cannot come apart about one corpus.
 *
 * **The doctor count is drawn at zero and the review count is not, and that is
 * not an inconsistency.** A corpus with no findings is a measured zero and the
 * reader is entitled to it — *"no findings"* is the answer most worth having
 * and a blank cannot give it (`STD-a-measured-zero-is-drawn-and-named-an-
 * unmeasured-thing-is`, clause 1). An empty review queue is not a finding about
 * the corpus at all: it is the absence of a request, and the ruling says this
 * one *"renders only when non-zero"*.
 */
function corpusNoteButtons(status) {
  const out = [];
  const open = (key, titleKey, count, route, field) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    // A PILL like every other field — owner ruling, every field on the bar.
    // Still a button and still a door: the pill is a presentation, not a
    // downgrade of the affordance.
    btn.className = 'linkid ufield';
    btn.dataset.f = field;
    btn.dataset.k = key;
    btn.append(...translate(table.strings, key, { count: String(count) }));
    btn.title = flat(table.strings, titleKey);
    btn.onclick = () => { location.hash = `#/${route}`; };
    return btn;
  };
  out.push(open('strip.doc', 'title.doc', doctorNoticeCount(status), 'doctor',
    'doctor-notices'));
  const queue = reviewQueueCount(status);
  if (queue > 0) out.push(open('strip.queue', 'title.queue', queue, 'work', 'review-queue'));
  return out;
}

/**
 * **ONE SPELLING OF EACH COUNT, CALLED TWICE.** The rail's badges and the
 * strip's two doors draw the same two numbers, and a second arithmetic here
 * would be two surfaces disagreeing about one corpus — which is exactly the
 * defect `railCounts` already carries a comment about, from the day the Work
 * badge read only `pendingRevisions` and said 0 with a draft on screen.
 *
 * Doctor is errors + warnings and NOT infos: an `info` finding is a remark, and
 * a count that includes remarks is a count nobody acts on. That is the rail's
 * existing choice, kept rather than re-litigated.
 */
function doctorNoticeCount(status) {
  return (status?.health?.errors ?? 0) + (status?.health?.warnings ?? 0);
}

/**
 * BOTH queues, because the screen the button opens draws both: drafts waiting
 * to be promoted and revision proposals waiting for a verdict are each an item
 * awaiting the owner's ruling, and counting one of them makes the number read
 * as "nothing to do here" while the other is full.
 */
function reviewQueueCount(status) {
  return (status?.pendingRevisions?.revisions ?? 0) + (status?.reviewQueue?.drafts ?? 0);
}

/**
 * **The context group ASKS, instead of asserting.** `plan:walk seq:29`.
 *
 * `strip.ctx.noBridge` used to be appended unconditionally, with no check of
 * any kind, so the strip told every reader "The status line bridge is not
 * installed" — including every reader who had installed it. It was true when
 * it was written: `plan:port seq:6` named its own unblocking condition, "ui3
 * tasks 4 and 5 build the statusline, which is what would let the context
 * group leave its noBridge state", both landed, and nothing came back. A
 * provenance bar stating an unchecked fact is the precise defect that bar
 * exists to prevent.
 *
 * **NO-BRIDGE AND NO-SAMPLE ARE NOT THE SAME STATE**, and `watch-model.ts`
 * says so against itself: its one `null` covers "no bridge installed, or this
 * session was never sampled". `contextStrip()` reports `no-bridge` for both
 * because that is the only story the endpoint can tell, and nothing here
 * widens it into a claim the data cannot carry. What this function must not
 * do is invent a sixth state.
 *
 * **NO CREDENTIAL IS NOT A COLD SESSION.** `sessionValue` lands on `'cold'`
 * both for a real empty ledger and for a `loadSessions()` that never got an
 * answer; `noCredential` is the bit that tells them apart, and drawing "cold
 * session — a hypothetical has no live context number" over a page that was
 * refused would break clause 2 in the same sentence this task exists to fix.
 * A page with no credential draws the unread state and the retry.
 *
 * Called after `loadSessions()` rather than from `fillChrome()`, because the
 * session id is this endpoint's only parameter and `fillChrome()` runs before
 * the session is known — deliberately, so the strip exists before the first
 * data call.
 */
async function fillContext() {
  const ctx = document.getElementById('ctx');
  if (ctx === null) return;
  const retry = () => { void fillContext(); };
  // ── THE FOUR OTHER BOXES THIS ONE ANSWER FILLS (2026-09-01).
  //
  // The model, the window's name and focus, the cost and the audit clock all
  // ride `/api/watch/context`, so one refusal is a refusal for all five and
  // every one of them must SAY so rather than sit blank —
  // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, clause 3:
  // "a blank is indistinguishable from a failure to load". A retry in each is
  // the same retry; they all ask this one function again.
  const unread = () => {
    for (const id of ['modelstate', 'windowstate', 'coststate', 'auditlog', 'limitstate']) {
      const el = document.getElementById(id);
      if (el !== null) el.replaceChildren(...unreadState(retry));
    }
    // **The injections figure is on this call too, since 2026-09-01.** It rides
    // the same body as the five above (`mycontext.injections`), so it fails
    // with them and must say so with them. It is drawn by its own builder
    // rather than by `unreadState` because its LABEL has to survive every
    // state — `e2e/strip.spec.ts` pins that the property stays named even when
    // its number is not there.
    const inj = document.getElementById('auditstate');
    if (inj !== null) inj.replaceChildren(...injectionParts(null));
  };
  if (noCredential) { ctx.replaceChildren(...unreadState(retry)); unread(); return; }

  const session = currentSession();
  let body = null;
  if (session !== 'cold') {
    try {
      body = await api('/api/watch/context?session=' + encodeURIComponent(session));
    } catch {
      lastContextBody = null;
      ctx.replaceChildren(...unreadState(retry));
      unread();
      return;
    }
  }

  // Remembered so `drawContext()` can redraw this same answer without asking
  // for it again — see `noteOccupancy`, which is what pays for that.
  lastContextBody = { body, cold: session === 'cold' };
  drawContext();
}

/**
 * **REDRAW THE CONTEXT GROUP FROM THE ANSWER ALREADY IN HAND** —
 * `plan:walk seq:124`.
 *
 * Split out of `fillContext()` rather than folded into it because the two halves
 * have different costs and the heartbeat needs to choose between them.
 * `/api/watch/context` opens the audit projection and sums this session's
 * injection records; measured 2026-08-31 over a 360-injection session it is
 * 4.69ms p50, and it grows with the session — `cli/commands/statusline.ts`'s own
 * header cites 5,000 injection records for one session as a shape this product
 * meets. `readOccupancy`, on `/api/ping`, is 0.32ms flat. So the heartbeat asks
 * the cheap question every tick and pays the expensive one only when the answer
 * moved.
 *
 * **The redraw is not a lesser rendering, and that is what makes the choice
 * safe.** It calls the same builders over the same body, so every state, chip
 * and title comes out identical — the ONE thing that differs is the thing that
 * must: `age`, `occupancyChip`'s `ageMs` and the handover chip are all computed
 * from `Date.now()` at draw time, so a redraw of an unmoved sample tells the
 * truth about how old it now is. A design that skipped the redraw entirely
 * would freeze the "as of … ago" label at whatever it said when the fetch
 * happened to resolve, which is `walk/123`'s fossil wearing a different hat.
 */
function drawContext() {
  const ctx = document.getElementById('ctx');
  if (ctx === null || lastContextBody === null) return;
  const { body, cold } = lastContextBody;
  // Collected and swapped in at every exit below, never cleared first. See
  // `fillItems` for why that matters now that this has more than one caller.
  const parts = [];

  const view = contextStrip(body, cold);
  const state = document.createElement('span');
  // ── THE FIGURE CARRIES THE BAND, AND IT IS THE EMPHASISED ELEMENT OF THE
  // WHOLE BAR — owner ruling 2026-09-01, in two parts.
  //
  // FIRST: *"verify the percentage has coloured levels green yellow red,
  // currently only white text"*. The band WAS computed and WAS correct — it
  // was attached to a chip beside the figure reading "room left", while the
  // number itself stayed neutral. A reader looking at `39.2%` saw grey and
  // concluded the levels were not implemented. That is the terminal's shape
  // (`● ctx 25.1%`, the block itself carrying the band) and the strip was the
  // one that had drifted from it.
  //
  // SECOND, AND SUPERSEDED THE SAME DAY — kept because it was a ruling and it
  // was reasoned. It read:
  //
  // > *"emphesize the context metrics by a background and or bigger bolded
  // > font, background colour should represent the level"*. `.ctxfig` is one
  // > class carrying the METRICS — 16px, 700 weight, its own padded box — and
  // > `.ctxfig.ok/.warn/.crit/.unmeas` carry ONLY colour.
  //
  // **Replaced by two later rulings of 2026-09-01**: *"the web status bar
  // window and ask currently has background that should be removed in order to
  // look similar to the status line at the terminal"*, and *"the bigger font
  // in the status bar should be normalized like the other fields in the bar"*.
  //
  // Both are coherent with the first rather than a reversal of it. When it was
  // made, this field had no bar, no level icon and no counts — a fill and
  // bigger type were the ONLY emphasis available. It now carries a ten-cell
  // bar, a level icon and a value coloured by its band, so the emphasis is
  // made three times over and the type and the fill were saying it a fourth
  // and fifth. The strip is converging on the terminal, where every field is
  // the same size and only the ink and the icon move.
  //
  // What the first ruling was PROTECTING survives untouched: the box is still
  // the same size in every state, so the row cannot move as the session fills.
  // A figure that grew when the band changed would shift the whole row while
  // somebody was reading it — that was true then and is true now.
  //
  // NO SIXTH HUE. `--okbg`, `--warnbg` and `--critbg` are already declared and
  // already spent by `.chip.ok/.warn/.crit`; a background in a hue the budget
  // already assigns is not a new hue
  // (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`).
  //
  // AND THE CHIP BESIDE IT STAYS. Colour is never the only carrier
  // (`06-a11y.html`: a glyph AND a colour AND a name) and `room left` is the
  // NAME — what survives a dichromat, a mono printer and forced-colors. The
  // terminal spends a glyph on exactly this and for exactly this reason.
  state.className = 'ctxfig ' + ctxFigureLevel(view);
  state.dataset.f = 'context';
  if (view.state === 'known') {
    state.dataset.k = 'strip.ctx.known';
    state.append(...translate(table.strings, 'strip.ctx.known', {
      pct: view.pct === null ? '—' : view.pct.toFixed(1),
      // FULL counts with thousands separators since the owner's reference
      // settled it — `(90,000 / 200,000)`, never `(90.0k / 200.0k)`. Shared
      // with the terminal through `fmtCount` so the two cannot punctuate one
      // number two ways; `tokenCount`'s `k` abbreviation stays for the
      // corpus-scale figures elsewhere on the strip, which have no maximum to
      // be read against and are not used-of-maximum fields.
      used: view.used === null ? '—' : fmtCount(view.used),
      size: view.size === null ? '—' : fmtCount(view.size),
      // Computed from `receivedAt` HERE rather than carried on the view, so
      // the label says how old the sample is now and not how old it was when
      // the fetch happened to resolve.
      age: view.receivedAt === null
        ? '—'
        : formatAge(Math.max(0, Date.now() - Date.parse(view.receivedAt))),
    }));
    // The used-of-maximum treatment: NAME, icon, bar, then the figure the
    // string already produced. Banded by the shared `usageLevelOf`, so this
    // field and the terminal's `WINDOW` cannot disagree.
    bandUsage(state, view.pct, 'strip.grp.window');
  } else {
    const key = view.state === 'not-yet-known' ? 'strip.ctx.notYetKnown'
      : view.state === 'unknown' ? 'strip.ctx.unknown'
        : view.state === 'no-bridge' ? 'strip.ctx.noBridgeShort' : 'strip.ctx.cold';
    state.dataset.k = key;
    state.append(...translate(table.strings, key));
    // THE NO-BRIDGE STATE IS THREE WORDS, AND THE SENTENCE IS ON DEMAND.
    // Drawn at full length it was a third of the strip and STILL ellipsised —
    // the most expensive segment in the bar, saying the least, with the
    // context percentage crowded out entirely. Owner, 2026-08-29: "it includes
    // a very long text that are not so important and other more important info
    // could not be seen like the context size left filled percentage". Neither
    // half is dropped: 05-dataviz.html's rule for anything bounded is bound it
    // AND disclose what was bounded, and an ellipsis with no way to the rest is
    // exactly the shape that rule refuses.
    if (key === 'strip.ctx.noBridgeShort') {
      state.title = flat(table.strings, 'strip.ctx.noBridge');
    }
  }
  // The context group is the one item in the strip allowed to give way, so any
  // of its states can end in an ellipsis on a narrow window. Each carries its
  // own full text, so the truncation is bounded AND disclosed rather than being
  // a dead end — the same rule the no-bridge state above follows for a
  // different reason.
  if (state.title === '') state.title = state.textContent;
  parts.push(state);

  // The project-knowledge share is a SECOND question, asked only of `known` —
  // the mockup's own rule, and the right one: "6.2k of it" has no antecedent
  // beside a context figure that does not exist. Three answers, one of them an
  // error, and the partial one exists because an injection recorded before
  // `tokens` existed is unknown rather than zero.
  if (view.state === 'known') {
    const tail = document.createElement('span');
    tail.className = 'small';
    // All three answers are ONE field in its three states - the share, the
    // partial share, and the reason there is none. A block explaining why a
    // field is missing is not a second field; the terminal tags its own
    // "myctx unavailable" the same way.
    tail.dataset.f = 'myctx';
    if (view.myctx === null) {
      tail.dataset.k = 'strip.myctxUnavailable';
      tail.append(...translate(table.strings, 'strip.myctxUnavailable', {
        // The endpoint sets `mycontextError` on every branch that leaves
        // `mycontext` null. The fallback is there so a shape it cannot
        // currently produce still renders a reason rather than a colon with
        // nothing after it.
        error: view.myctxError ?? flat(table.strings, 'strip.unread'),
      }));
    } else {
      // THE SAME PERCENTAGE THE TERMINAL PRINTS, from the SAME expression and
      // the SAME rounding — `(input.myctx.tokens / win) * 100` at `decimals:
      // 1` in `statusline-powerline.ts`'s `myctx` `usedOfMaxSegment`. Copied
      // rather than re-derived, so the two bars cannot round one fraction of
      // a percent two different ways (`TASK-the-web-strip-reports-the
      // -project-knowledge-share-in-tokens`). The bar below already computes
      // this same figure to band its colour; this is that figure, written as
      // the number it was always banded against but never printed.
      //
      // `—` is this file's own measured-absence mark for a percentage it
      // cannot compute (`strip.ctx.known`'s `pct` above uses the same glyph
      // for the same reason) — not a zero, and reachable only if `view.size`
      // were ever unusable while `view.state === 'known'`, which
      // `context-occupancy.ts` does not currently produce.
      const pct = typeof view.size === 'number' && view.size > 0
        ? ((view.myctx.tokens / view.size) * 100).toFixed(1)
        : '—';
      if (view.myctx.unrecorded > 0) {
        tail.dataset.k = 'strip.myctxPartial';
        tail.append(...translate(table.strings, 'strip.myctxPartial', {
          pct,
          tokens: fmtCount(view.myctx.tokens),
          injections: String(view.myctx.injections),
          unrecorded: String(view.myctx.unrecorded),
        }));
      } else {
        tail.dataset.k = 'strip.myctx';
        tail.append(...translate(table.strings, 'strip.myctx', {
          pct,
          tokens: fmtCount(view.myctx.tokens),
          injections: String(view.myctx.injections),
        }));
      }
    }
    // ── THE FIFTH BANDED FIELD, and it needs a MAXIMUM to be banded against.
    //
    // What mycontext put into this window, out of the window — the same
    // denominator the context figure uses, which is what makes it
    // used-of-maximum by the same definition rather than by analogy. An
    // unmeasurable window leaves it with no maximum, and it then draws the
    // bare count it always drew rather than inventing a percentage: a field
    // that quietly switched denominators would be worse than one that visibly
    // has none.
    if (view.myctx !== null && typeof view.size === 'number' && view.size > 0) {
      bandUsage(tail, (view.myctx.tokens / view.size) * 100, 'strip.grp.myctx');
    }
    parts.push(tail);
  }

  // ── HOW FULL THE WINDOW IS, AND — SEPARATELY — HOW CLOSE THE ASK IS.
  //
  // Owner ruling 2026-08-31: *"the context figure becomes TWO fields, not
  // one."* One chip used to answer both questions and could therefore answer
  // neither: a window at 91% with the ask not yet fired and a window at 91%
  // past the ask came out as the same colour. They are two facts and they are
  // drawn as two.
  //
  // Both apply ONLY to `known`, because both are bands around a percentage and
  // the other four states have no percentage to band. Both are also withheld
  // together on a stale sample — see `fillChip` — so a reader never gets one
  // live-looking answer beside one that was refused.
  const fill = fillChip(view);
  if (fill !== null) parts.push(fill);
  const proximity = handoverProximityChip(view);
  if (proximity !== null) parts.push(proximity);
  // ── AND HOW FAR THE NEXT ASK IS, AS A NUMBER - owner ruling 2026-09-01.
  //
  // The chips above say WHAT BECAME of the ask; this says how far the next one
  // is. Two different facts, and the owner asked for both: a reader told
  // "handover written 2h ago" still does not know whether the next ask is
  // sixty points away or three. The terminal has drawn it since the ruling
  // that the distance is worth reading at ANY fill.
  //
  // NEUTRAL, and that is what keeps the gold earned. A marker that is gold at
  // every fill - including a window at 25% with sixty points of headroom - has
  // stopped meaning anything by the time it is needed, which is precisely why
  // `handoverProximityChip` above is silent below the warn band.
  const head = askHeadroomChip(view);
  if (head !== null) parts.push(head);
  // The account's two windows are NOT here any more: they are their own group
  // on line 1 since 2026-09-01 — a different subject on a different clock. See
  // `renderChrome`. They are still drawn from this same body, in the same pass,
  // by `drawIdentity` below.
  // ── AND WHAT BECAME OF THE HANDOVER ASK — `plan:walk seq:118`. Drawn in
  // EVERY state, including the ones with no context figure at all: whether the
  // handover was written is a fact about this session, not about whether the
  // status-line bridge is installed, and `ignored` is precisely the state a
  // reader would never think to go and check for.
  const handoverChip = handoverVerdictChip(view);
  if (handoverChip !== null) parts.push(handoverChip);
  ctx.replaceChildren(...parts);
  // The same one answer fills line 1 and the two line-2 groups beside this one.
  drawIdentity(view);
  // ── SCALED FIELDS HOVER WITH THEIR OWN FULL TEXT ────────────────────────
  // Owner, 2026-09-01: "now as the WINDOW hover, do the same for all the
  // scaled fields". WINDOW has always shown its own untruncated line on hover
  // and that is the thing the owner kept pointing at: a field carrying a bar,
  // a percentage and a count truncates inside a narrow group, so the hover is
  // where the whole reading survives. An explanation, however good, is not
  // what a truncating field owes its reader first — the non-scale fields keep
  // their short plain-words explanations, which is the other half of the same
  // ruling.
  //
  // Done as a sweep AFTER the row is built rather than at each call site,
  // because a field's label and its value are separate children and the text
  // is only whole once both are in place. Reading it off the field element
  // means the hover cannot drift from the line: it IS the line.
  // Scoped to the whole strip, not to `ctx`: the rate windows live in the
  // LIMITS group and were being missed by a sweep that only searched the
  // session group it was written next to.
  const strip = document.querySelector('.strip') ?? ctx;
  // **EVERY FIELD'S HOVER OPENS WITH ITS OWN LINE, EMOJI AND ALL** — owner
  // ruling, 2026-09-01: "add the correct text for every field hover text
  // including the emoji before of it as it appears in the field itself".
  //
  // A field truncates inside a narrow group, so the first thing its hover owes
  // the reader is the whole of what the line was trying to say — including the
  // level emoji, which is the one part that says WHICH state this reading is
  // in. The explanation, where a field has one, follows on its own line: the
  // reading first, the reason second.
  //
  // The bar and the emoji come out monochrome in a native tooltip, which the
  // browser draws in its own colours and no CSS reaches. The owner has seen a
  // page-drawn alternative and chosen this: the colour lives on the LINE,
  // where it already works, and the hover carries the text.
  for (const el of strip.querySelectorAll('[data-f]')) {
    const whole = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (whole === '') continue;
    const had = el.title;
    // A field whose title already IS its line must not gain a second copy.
    const extra = had !== '' && had !== whole && !had.startsWith(whole) ? `
${had}` : '';
    el.title = whole + extra;
  }

}

/**
 * **HOW FAR THE HANDOVER ASK IS, AS A NUMBER** — owner ruling 2026-09-01, and
 * the field the strip had no answer for at all.
 *
 * The strip already carried the ask's STATE — *"handover written 4h ago"* — and
 * the gold marker that fires as the ask approaches. Neither of them is the
 * DISTANCE, and the owner asked for both: they are two facts, and the one a
 * reader plans against is how many points are left.
 *
 * **The subtraction is `askHeadroom`'s and nobody else's.** It is declared in
 * `lib/viewmodel.js` beside `occupancyBands`, and `statusline-powerline.ts`
 * reaches the same function through the same bridge it reaches the bands
 * through. A `threshold - pct` written here would be a second spelling of one
 * number, which is the defect this whole pass exists to end.
 *
 * **Neutral, never gold, and that is what keeps the gold worth something.**
 * `handoverProximityChip` beside this spends the gold when the ask approaches;
 * this one carries the figure at every live fill in the chip the strip already
 * uses for "this is a reading, not a verdict".
 *
 * `null` in three cases, each of which is a refusal rather than a zero: no
 * configured ask (there is no distance to a threshold nobody set), a state with
 * no percentage to subtract from, and a sample too old to place — a fossil with
 * sixty points of headroom is not reassurance, it is a stale claim wearing a
 * plus sign. It also goes quiet AT the ask, where the distance is spent and the
 * gold `handover due` beside it takes the sentence over.
 */
function askHeadroomChip(view) {
  const threshold = view.handover.threshold;
  if (view.state !== 'known' || threshold === null) return null;
  const ageMs = view.receivedAt === null ? null : Math.max(0, Date.now() - Date.parse(view.receivedAt));
  const level = occupancyLevel(view.pct, threshold, ageMs);
  // **THE ASK KEEPS ITS SCALE PAST THE THRESHOLD** — owner ruling, 2026-09-01:
  // "i want to see the scale as the context, only after compaction or clear it
  // should reset to 0". It used to return `null` at `crit` and hand the field
  // to a words-only chip, so the bar and the figure VANISHED at exactly the
  // moment the field matters most, and the reader lost the one thing that says
  // HOW FAR past the ask they are.
  //
  // This supersedes the 2026-09-01 D6 ruling ("past the ask the number stops
  // being the point, the action is"). The action still has its own chip beside
  // this one; what changed is that the measurement no longer disappears to make
  // room for it. Like the context figure, it falls to zero only when the window
  // does — on a compaction or a clear.
  if (level === null || level === 'stale') return null;
  // Past the threshold there is no headroom left to print. `askHeadroom`
  // answers `null` there, and a clamped `0.0` is the honest reading: the gap
  // is spent, and a negative gap beside a full bar would say the same thing
  // twice in two spellings.
  const headroom = Math.max(0, askHeadroom(view.pct, threshold) ?? 0);
  const chip = document.createElement('span');
  // `askfig` rather than `chip unmeas`, and NOT a repoint of `.chip.unmeas`,
  // which other screens use for a different job. It drops the fill and keeps
  // the RECTANGLE — owner ruling 2026-09-01: *"ASK has no rectangle and it
  // should, just without background (transparent)"*. `unmeas` is gone from the
  // list because it also sets `color:var(--dim)` on the chip, which is the one
  // thing this field must NOT be: its value carries the level.
  chip.className = 'chip askfig';
  chip.dataset.f = 'ask';
  chip.dataset.g = '◆';
  chip.dataset.k = 'strip.ctxAsk';
  // ── THE SAME ELEMENTS IN THE SAME ORDER AS THE TERMINAL ──────────────────
  //
  // Owner, 2026-09-01: *"ASK, handover does not display the percentage as it is
  // in the terminal status line"*. The strip was drawing the bare threshold
  // `85` where the terminal draws `88% (75.0 / 85)`, so the two surfaces said
  // different things about one field.
  //
  // **`strip-parity` could not catch this and it is worth naming why.** That
  // test asserts a FIELD IS PRESENT on both surfaces; `ask` was present on
  // both, so it passed while the content diverged. Presence is a weaker
  // guarantee than content — see the lane report for whether it can be
  // strengthened.
  //
  // The ask's own count pair is `(75.0 / 85)` and NOT thousands-separated,
  // because its numerator is percentage POINTS of the window rather than
  // tokens; `fmtCount` is for the token counts. That distinction is the
  // terminal lane's and is reused rather than re-derived.
  chip.append(...translate(table.strings, 'strip.ctxAsk', {
    // Used-of-THRESHOLD: how far along the way to the ask this window is.
    askPct: ((view.pct / threshold) * 100).toFixed(0),
    // The window's own figure, at the one decimal the ctx field uses.
    pct: view.pct.toFixed(1),
    // The threshold reads as configured — `85`, not `85.0` — while the
    // DISTANCE always carries its decimal, because it is the figure that moves
    // and a gap showing `+3` for anything from 2.5 to 3.5 hides the last
    // message before the ask. The same two rules the terminal block follows.
    threshold: Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1),
    headroom: headroom.toFixed(1),
  }));
  chip.title = flat(table.strings, 'strip.ctxAsk', {
    askPct: ((view.pct / threshold) * 100).toFixed(0),
    pct: view.pct.toFixed(1),
    threshold: Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1),
    headroom: headroom.toFixed(1),
  });
  // Banded as used-of-THRESHOLD, exactly as the terminal bands it: the maximum
  // is the ask and the used figure is the window's own percentage, both in
  // percentage points of the window. Past the ask this chip is already `null`
  // above and `handoverVerdictChip` says the words instead — so no bar and no
  // signed figure can ever appear beside "handover due".
  bandUsage(chip, (view.pct / threshold) * 100, 'strip.grp.ask');
  return chip;
}

/**
 * **WHICH REPOSITORY IS OPEN** — drawn in the header's provenance group, beside
 * the branch and the commit, because it is the same fact one level up.
 *
 * `projectRoot` is the `.my_context` directory, so the NAME is its parent's.
 * That is the same derivation `mycontext statusline` makes from the session
 * directory Claude Code names, and the same one `distinctSessionName` compares
 * a session name against server-side — so the three cannot disagree about what
 * this project is called.
 *
 * A workspace with no `repoRoot` draws nothing rather than a placeholder: the
 * git group beside this already says `not a git repository`, and two blocks
 * saying one absence is one fact twice.
 */
function drawProjectName(meta) {
  const el = document.getElementById('reponame');
  if (el === null) return;
  const root = typeof meta?.repoRoot === 'string' ? meta.repoRoot : null;
  if (root === null) { el.replaceChildren(); return; }
  const name = root.split(/[\\/]/).filter((part) => part !== '').pop() ?? null;
  if (name === null) { el.replaceChildren(); return; }
  const span = document.createElement('span');
  span.dataset.k = 'strip.project';
  span.dataset.f = 'project';
  span.append(...translate(table.strings, 'strip.project', { project: name }));
  el.replaceChildren(span);
}

/**
 * **WHICH BAND THE CONTEXT FIGURE ITSELF WEARS.**
 *
 * `fillLevel` and nothing else — the ABSOLUTE bands, declared once in
 * `lib/viewmodel.js`, the same call `fillChip` makes one element along. Two
 * calls of one function, never two functions: the chip and the figure are the
 * WORD and the COLOUR for one fact, and a reader who saw them disagree would
 * be right to stop trusting both.
 *
 * `'unmeas'` for everything that is not a live level — a state with no
 * percentage, and a sample too old to place. Visibly not-a-level rather than a
 * level, which is the treatment `.chip.unmeas` already gets and for the same
 * reason: a fossil in confident red is worse than an uncoloured number.
 */
function ctxFigureLevel(view) {
  if (view.state !== 'known') return 'unmeas';
  const ageMs = view.receivedAt === null ? null : Math.max(0, Date.now() - Date.parse(view.receivedAt));
  const level = fillLevel(view.pct, ageMs);
  return level === 'ok' || level === 'warn' || level === 'crit' ? level : 'unmeas';
}

/**
 * **LINE 1, AND THE TWO LINE-2 GROUPS THAT RIDE THE SAME ANSWER.**
 *
 * Every field here was already drawn by `mycontext statusline` and by no web
 * surface at all. They diverged because the two bars were specified separately
 * with nothing holding them together — this project's most-repeated defect,
 * measured eight times by 2026-09-01 — and `test/ui/strip-parity.test.ts` is
 * what holds them together now.
 *
 * **The strip is a SUPERSET, never a harmonisation.** It keeps every field it
 * already had, including the review queue, which the terminal refuses because
 * it costs a second database open there and is free from `/api/status` here.
 * Same field, different verdict, and the reason is the surface's cost model
 * rather than the field's worth.
 *
 * `data-f` beside `data-k` on every keyed segment: `data-k` says WHICH SENTENCE
 * was drawn and `data-f` says WHICH FACT it is about. The parity test compares
 * the second, because two surfaces are entitled to say one fact differently —
 * the browser can give the context figure a background and a larger face and
 * the terminal cannot — and nothing about presentation may travel through a
 * gate whose subject is coverage.
 */
function drawIdentity(view) {
  // `{ field }` and not a positional argument, because `field: '<id>'` is the
  // one form `test/ui/strip-parity.test.ts` derives both surfaces' field sets
  // from. An id passed positionally would be invisible to that derivation, and
  // a derivation with a blind spot is a hand-kept list wearing a regex.
  /**
   * **EVERY FIELD ON THE STRIP IS A PILL — owner ruling 2026-09-01, stated as
   * a RULE rather than the list it arrived as.**
   *
   * The owner pointed at the `in step with the log` chip, said it looks nice,
   * and then named fields to receive it in four batches — the banded five,
   * then COST/CACHE/AUDIT, then MODEL and the session name, then CORPUS. That
   * is every field on the bar, so it is written here as the general form:
   *
   *     LEVELLED fields   the level's hue on border, fill and value
   *     UNLEVELLED fields the neutral register, with a WHITE value
   *
   * Doing it as a rule and not a list is what stops the next field being born
   * bare and discovered by the owner looking at it. A field that genuinely
   * should not be a pill is an argued exception, not an omission.
   *
   * ONE PILL PER FACT, never per group. The corpus group holds an item count,
   * a drift state, the doctor notices and the review queue — four facts with
   * four independent levels — and a single pill would have to pick one hue for
   * all of them.
   *
   * `nameKey` gives the field its caps-and-white label; `cls` is for the
   * callers that already had a class of their own.
   */
  const keyed = (key, subs, { field, cls, nameKey, titleKey }) => {
    const el = document.createElement('span');
    el.dataset.k = key;
    el.dataset.f = field;
    if (cls !== undefined) el.className = cls;
    // The VALUE is wrapped so the ink rule has one element to land on — white
    // when the field carries no level, the level's hue when it does. Without
    // the wrapper the label would take the same colour as the value.
    const value = document.createElement('span');
    value.className = 'uval';
    value.append(...translate(table.strings, key, subs));
    el.append(value);
    el.classList.add('ufield');
    // ── THE HOVER, on every field — owner ruling 2026-09-01, *"WINDOW text
    //    hover is great, do the same for all of the other fields exactly"*.
    //
    // "Exactly" is the standard, not the instruction: WINDOW's title names the
    // figure, gives the counts under it and states the sample's age, so a
    // reader who hovers LEARNS something the line could not fit. A tooltip
    // that restates the visible text is worse than none — it teaches the
    // reader that hovering is not worth doing.
    //
    // What each one carries: what the number is in plain words, where it comes
    // from when that is not obvious (several are derived, not served), and the
    // bound the line had to drop — MYCTX counts only this epoch and only ops
    // that reach this model, CACHE is derived from a read/creation split,
    // AUDIT is the newest row and not a rate.
    //
    // **A TOOLTIP IS NOT A CARRIER.** It is invisible to touch, to
    // keyboard-only navigation and in print, so nothing lives only here: every
    // fact a reader must act on is still on the line or in the pane. This is
    // additive, and it is what lets the LINE be short rather than an excuse to
    // keep it long.
    if (titleKey !== undefined) el.title = flat(table.strings, titleKey);
    return nameKey === undefined ? el : nameField(el, nameKey);
  };

  const model = document.getElementById('modelstate');
  if (model !== null) {
    const parts = [];
    // A session with no sample has no model to name, and says so with the
    // chip the whole strip already uses for it rather than going blank.
    if (view.model === null) {
      parts.push(stateChip('strip.unread', 'title.unread'));
    } else {
      parts.push(keyed('strip.model', { name: view.model },
        // ── THE MODEL IS BLUE, matching the terminal ────────────────────
        // Owner ruling 2026-09-01: *"the MODEL should appear in blue as it is
        // in the terminal status line"*. The terminal draws this block with
        // `INK.carry`, chosen as the nearest neighbour of this file's own
        // `--carry`, so the web side is that token and nothing is matched by
        // eye.
        //
        // **It is a NEUTRAL IDENTITY use, not a severity claim.** `--carry` is
        // one of the five meaning-hues and means "carried across sessions"
        // elsewhere; here it says WHICH MODEL, and a model is never good or
        // bad. Nobody should read a blue model pill as a level.
        //
        // One token, two uses, as in the terminal: `--carry` is also the ask
        // marker's, now that gold moved to the `caution` band. A model-specific
        // blue would be a second spelling of one hue.
        { field: 'model', nameKey: 'strip.grp.model', titleKey: 'title.model',
          cls: 'carryfield' }));
      // The modes are composed by the server out of `modeFlags`, the same
      // judgement the terminal folds into its model block. Absent means "no
      // mode is out of the ordinary", which costs this row nothing.
      if (view.modes !== null) {
        parts.push(keyed('strip.modelModes', { modes: view.modes },
          { field: 'model', cls: 'small' }));
      }
    }
    model.replaceChildren(...parts);
  }

  const windowEl = document.getElementById('windowstate');
  if (windowEl !== null) {
    const parts = [];
    // Drawn only when it differs from the project name — the suppression is
    // `distinctSessionName`'s, applied server-side, so both bars apply one
    // rule. A window named after its project restates the header.
    if (view.sessionName !== null) {
      parts.push(keyed('strip.sessionName', { name: view.sessionName },
        // **SESSION NAME, not WINDOW** — owner ruling 2026-09-01,
        // *"WINDOW (window name, to be called session name)"*. It also removes
        // a collision: `WINDOW` is the context field, and two different pills
        // on one bar cannot carry one name.
        { field: 'session-name', nameKey: 'strip.grp.sessionName',
          titleKey: 'title.sessionName' }));
    }
    // **Read from `state/focus.json`, never from the audit log** — every
    // `focus-set` row in the real log carries `sessionId: null`, so the log
    // cannot answer this at all. Unlike the terminal, the no-focus case is
    // DRAWN: this row has the width, and after a compaction the question a
    // reader has is not "how full am I" but "where was I".
    if (!view.focusRead) parts.push(stateChip('strip.unread', 'title.unread'));
    else if (view.focus === null) {
      parts.push(keyed('strip.noFocus', {},
        { field: 'focus', cls: 'small', nameKey: 'strip.grp.focus',
          titleKey: 'title.focus' }));
    } else {
      parts.push(keyed('strip.focus', { focus: view.focus },
        { field: 'focus', nameKey: 'strip.grp.focus', titleKey: 'title.focus' }));
    }
    windowEl.replaceChildren(...parts);
  }

  // **`#focuslbl` — the title bar's half of the same fact.** The trigger has
  // carried an empty `<b>` since the shell landed, because nothing had ever
  // told it what focus is set; the strip above has the answer and this is the
  // one place it is known, so it is written here rather than re-derived.
  //
  // It says what IS SET and never what `#focuspop` is composing: the dialog
  // composes a command that has not been run, and a label that moved on a row
  // click would be this UI claiming to have applied it. The label moves when
  // the SERVER's answer moves, which is the only honest trigger.
  //
  // `focus.offn` ("no narrowing") rather than an empty label for the no-focus
  // case — a measured "nothing is narrowing this" and an unread state must not
  // look alike, which is the same rule the strip's `strip.unread` chip keeps.
  const focusLabel = document.getElementById('focuslbl');
  if (focusLabel !== null && view.focusRead) {
    focusLabel.textContent = view.focus === null
      ? flat(table.strings, 'focus.offn')
      : view.focus;
  }

  const cost = document.getElementById('coststate');
  if (cost !== null) {
    const parts = [];
    // ── EVERY FIELD IS NAMED, not just every group — owner ruling 2026-09-01,
    //    *"field names should be caps and white"*, and they meant the fields.
    //
    // The group heading says COST and this group holds THREE fields: the
    // spend, the cache share and the session's age. A heading cannot name
    // three things, so each takes its own label in the same caps-and-white
    // treatment the terminal gives all thirteen of its fields. `nameField`
    // adds the label without any banding — these carry no level.
    if (view.costUsd !== null) {
      parts.push((
        keyed('strip.cost', { usd: view.costUsd.toFixed(2) },
          { field: 'cost-cache', nameKey: 'strip.grp.cost', titleKey: 'title.cost' })));
    }
    if (view.warmPercent !== null) {
      parts.push((
        keyed('strip.warm', { pct: view.warmPercent.toFixed(1) },
          { field: 'cost-cache', cls: 'small', nameKey: 'strip.grp.cache',
            titleKey: 'title.warm' })));
    }
    // ── HOW LONG THIS SESSION HAS RUN — the ONE field the terminal drew and
    //    this strip did not, and the reason two parity gates were red.
    //
    // `test/ui/strip-parity.test.ts` and `e2e/strip.spec.ts` both assert
    // terminal ⊆ web, and `elapsed` was the single id failing them. The ruling
    // is that the strip is a SUPERSET — the fix is to draw the field here,
    // never to stop drawing it there and never to relax the assertion — so
    // this is that fix. It sits with the cost because both come off the same
    // `cost` object in the payload and both are totals for the session.
    //
    // Absent when the payload carried no duration, which draws nothing rather
    // than `0m`: a session whose length nobody reported is not one that has
    // just started.
    // A payload that carried neither is not a session that cost nothing. The
    // named unread state, never an invented `$0.00`. Checked BEFORE the elapsed
    // field is pushed, so this group's unread state still means what it meant:
    // a field that is always present would otherwise make it unreachable.
    if (parts.length === 0) parts.push(stateChip('strip.unread', 'title.unread'));
    // ── HOW LONG THIS SESSION HAS RUN — ALWAYS DRAWN, and named when there is
    //    nothing to draw.
    //
    // NAMED like every other field. It carries no bar — it is a duration, not
    // an amount used out of a maximum — so it takes the label alone and none of
    // the banding. The ruling is that every field says what it is, not that
    // every field is a used-of-maximum field.
    //
    // It used to be drawn only when the payload reported a duration, which is
    // why `e2e/strip.spec.ts`'s parity gate was red: `elapsed` was the ONE id
    // the terminal drew and no scenario here ever reached. A field nobody can
    // see in any state is not a field the strip draws, and the strip is a
    // SUPERSET by the owner ruling of 2026-09-01. So the absent case is drawn
    // and NAMED rather than skipped — `STD-a-measured-zero-is-drawn-and-named`,
    // whose whole point is that a blank and a zero must not look alike.
    //
    // `formatDuration` and not `formatAge`, spaced, because the terminal spells
    // this field `5d 8h` and `formatAge` rounded it to `5d`. Owner ruling,
    // 2026-09-01: the same field carries the same value on both surfaces.
    const ran = formatDuration(view.elapsedMs, ' ');
    parts.push((
      keyed('strip.elapsed', { elapsed: ran ?? '—' },
        { field: 'elapsed', cls: ran === null ? 'small unmeas' : 'small',
          nameKey: 'strip.grp.elapsed', titleKey: 'title.elapsed' })));
    cost.replaceChildren(...parts);
  }

  // ── WHERE THIS SESSION IS, AND WHICH CORPUS THAT GOT IT (2026-09-02).
  //
  // **BOTH FIELDS ARE ALWAYS DRAWN, and named when there is nothing to draw.**
  // That is the `elapsed` lesson applied before it costs anything: a field
  // drawn only when its value is present is a field no scenario reaches, which
  // is what left `elapsed` failing both parity gates for a day. It is also
  // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` — a blank
  // is indistinguishable from a failure to load, and on THESE two fields the
  // blank would be indistinguishable from "you have not moved", which is the
  // one sentence they exist to be able to deny.
  //
  // The paths are abbreviated by `relDir`/`corpusDir`, the same two functions
  // the terminal reaches through its dynamic-import bridge — so the two bars
  // cannot spell one abbreviation two ways. The whole absolute path survives
  // in the field's hover, which `drawContext`'s closing sweep composes from
  // the line and which `title.cwd` explains under it.
  const whereEl = document.getElementById('wherestate');
  if (whereEl !== null) {
    const parts = [];
    const dir = relDir(view.cwd, view.projectDir);
    parts.push(dir === null
      ? keyed('strip.cwdUnknown', {},
        { field: 'cwd', cls: 'small unmeas', nameKey: 'strip.grp.cwd', titleKey: 'title.cwd' })
      : keyed('strip.cwd', { dir },
        { field: 'cwd', nameKey: 'strip.grp.cwd', titleKey: 'title.cwd' }));
    parts.push(corpusRootField(view, keyed));
    // **AND THE ABSOLUTE PATHS ON THE HOVER, under the explanation.** The line
    // is a comparison and the hover is where the whole reading survives — the
    // rule `drawContext`'s sweep already applies to every scaled field. It is
    // set here rather than there because only this function has the absolute
    // path: the sweep composes a title out of the LINE, and the line is
    // deliberately the abbreviation.
    if (view.cwd !== null) parts[0].title += '\n' + view.cwd;
    if (view.corpusRoot?.root != null) parts[1].title += '\n' + view.corpusRoot.root;
    whereEl.replaceChildren(...parts);
  }

  const injections = document.getElementById('auditstate');
  if (injections !== null) injections.replaceChildren(...injectionParts(view));

  const log = document.getElementById('auditlog');
  if (log !== null) {
    const parts = auditClockParts(view);
    // ── AND AS OF WHEN — owner request, 2026-09-02.
    //
    // **Beside the audit clock deliberately.** That field says how LONG AGO
    // the log last moved; this one says as of WHEN, and the pair is what turns
    // a relative age into an absolute instant a reader can hold against a log
    // line, a commit or their own memory. Either alone is half the sentence.
    //
    // **IT TICKS, AND IT ADDS NO TIMER.** `drawContext()` already re-renders
    // on the ping cycle — every sixty seconds, whether or not the occupancy
    // moved (`noteOccupancy`) — and `formatAge`, `formatDuration` and the
    // occupancy chip are all computed at draw time for exactly this reason. A
    // stamp to the MINUTE is therefore live to within its own resolution off
    // the timer that is already running, and a second timer for one field
    // would be a second thing to stop when the page idles.
    //
    // **THE TERMINAL CANNOT DO THIS AND MUST NOT PRETEND TO.** Claude Code
    // draws the status line on demand, once per assistant message; it has no
    // way to repaint between them. So the same field there is the instant that
    // line was DRAWN, which is genuinely the more useful reading on a surface
    // that goes stale — it says how old everything else on the row is. The two
    // will therefore disagree, by up to one assistant message, AND THAT IS
    // CORRECT: they report the same fact — when this bar was last painted —
    // measured on two surfaces that paint on different triggers. The owner's
    // "same value on both surfaces" ruling is about fields whose value is a
    // measurement of the same thing, and it is honoured here where it can be:
    // one spelling, one resolution, one function (`wallStamp`). A future
    // parity gate that demanded equal SECONDS would be demanding that the
    // terminal tick. See `stamp()` in `cli/commands/statusline-powerline.ts`,
    // which carries the same note from the other side.
    const at = wallStamp(Date.now());
    parts.push(keyed('strip.clock', { stamp: at ?? '—' },
      { field: 'clock', cls: at === null ? 'small unmeas' : 'small',
        nameKey: 'strip.grp.clock', titleKey: 'title.clock' }));
    log.replaceChildren(...parts);
  }

  // The account's quota, in its own group on line 1. Silent when the payload
  // carried no window — absence is silence here and never a placeholder, for
  // the reason `rateLimitParts` gives: a 0% invented for a window nobody
  // reported would be a claim about an account that was never made. A body
  // that answered NOTHING is a different case and says so.
  const limits = document.getElementById('limitstate');
  if (limits !== null) {
    const parts = rateLimitParts(view);
    // **A GROUP MAY NOT BE EMPTY.** `rateLimitParts` is silent for a window the
    // payload did not carry, which is right for ONE window beside another that
    // reported: a 0% invented for a window nobody reported would be a claim
    // about an account that was never made. It is not right for the whole
    // group, because a label with nothing after it is the band of nothing this
    // shell has already been caught drawing once. Neither window reported is a
    // NAMED absence (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
    // thing-is`, clause 3: "a blank is indistinguishable from a failure to
    // load"), and it is a different sentence from "not read" — the endpoint
    // answered, and what it carried had no `rate_limits` in it.
    if (parts.length === 0) {
      const none = document.createElement('span');
      none.className = 'chip unmeas';
      none.dataset.g = '◌';
      none.dataset.k = 'strip.rlNone';
      none.dataset.f = 'rate-5h';
      none.append(...translate(table.strings, 'strip.rlNone'));
      none.title = flat(table.strings, 'title.rate');
      parts.push(none);
    }
    limits.replaceChildren(...parts);
  }

  standDownDuplicateHeadings();
}

/**
 * **WHICH CORPUS THE SESSION'S DIRECTORY RESOLVED TO — and the alarm.**
 *
 * ── THE INTERESTING STATE IS DISAGREEMENT, NOT THE PATH ────────────────────
 *
 * A corpus resolved from a directory inside a project is normal and
 * unremarkable, and a bar that spent forty-six columns saying so on every
 * paint would have taught its reader to stop looking at it long before the day
 * it mattered. What is NOT ordinary is a walk that stopped at a NESTED corpus
 * while another stands higher up the same tree: that is the shape of the
 * failure the owner reported twice on 2026-09-02, and it is the ONE state this
 * field raises its voice for.
 *
 *     CORPUS test_mycontext_plugin                   the ordinary case
 *     CORPUS ▲ ./my-context — 44 items, 759 above    the alarm
 *
 * **THE COUNTS RIDE THE ALARM AND THEY ARE THE POINT.** The outage this comes
 * from was not somebody misreading a path — it was reading "44 items" as a
 * project with little recorded in it rather than as A DIFFERENT CORPUS.
 * `nestedCorpusNote` prints both numbers for exactly that reason and this is
 * that disclosure at bar width.
 *
 * **The judgement is the SERVER'S and is not re-derived here.** Whether the
 * walk stopped early is `core/corpus-identity.ts`', made against a filesystem
 * a browser cannot see, and it is the same function `mycontext statusline` and
 * every MCP tool result call. A second implementation of "is this the wrong
 * corpus" would be a particularly bad version of the defect the field exposes.
 *
 * **Colour is never the only carrier.** `▲` and the two counts say it with no
 * hue at all, which is `06-a11y.html`'s rule and what keeps the field legible
 * under forced-colors and to a reader who cannot tell amber from blue.
 *
 * Four states and each is named: the alarm, the ordinary root, a session that
 * resolved to NO corpus (a measurement), and a server that did not say (an
 * unread state). The last two are different sentences and are drawn as two.
 */
function corpusRootField(view, keyed) {
  const opts = {
    field: 'corpus-root', nameKey: 'strip.grp.corpusRoot', titleKey: 'title.corpusRoot',
  };
  const resolved = view.corpusRoot;
  if (resolved === null) {
    return keyed('strip.unread', {}, { ...opts, cls: 'small unmeas' });
  }
  if (resolved.root === null) {
    return keyed('strip.corpusRootNone', {}, { ...opts, cls: 'small unmeas' });
  }
  const dir = corpusDir(resolved.root, view.projectDir);
  if (dir === null) {
    return keyed('strip.unread', {}, { ...opts, cls: 'small unmeas' });
  }
  const nesting = resolved.nesting;
  if (nesting === null || nesting.items === null || nesting.enclosingItems === null) {
    return keyed('strip.corpusRoot', { dir }, opts);
  }
  const el = keyed('strip.corpusRootNested', {
    dir, items: String(nesting.items), enclosing: String(nesting.enclosingItems),
  }, { ...opts, cls: 'chip warn' });
  el.dataset.g = '▲';
  return el;
}

/**
 * **A GROUP HEADING STANDS DOWN WHEN ITS FIELDS NAME THEMSELVES.**
 *
 * Owner ruling 2026-09-01: every field on the bar is a named pill. That
 * collides with the group headings the strip has always drawn, and the
 * collision is visible — `MODEL MODEL Opus 5 …`, `SESSION WINDOW 78.6% …`.
 *
 * The rule, from the terminal, which solved this first: a group lends its name
 * where it holds ONE fact, and each field keeps its own where it holds
 * several. So the heading prints only when nothing inside it is named.
 *
 * **Derived at draw time rather than listed.** A hand-kept list of which
 * groups print their heading is exactly the thing that goes stale when a field
 * gains a label — this project's most-repeated defect. Asking the DOM which
 * groups contain a `.ulab` cannot go stale: a field that gains a name stands
 * its heading down on the next paint, and a field that loses one brings it
 * back, with nothing to remember.
 *
 * HIDDEN, not removed, so `e2e/strip.spec.ts` can still find the heading and
 * see that it was drawn and suppressed rather than never built — and so a
 * group whose fields are absent this paint gets its name back.
 *
 * **`style.display` and NOT the `hidden` attribute**, which is the trap this
 * hit on the first attempt: `[hidden]{display:none}` is a USER-AGENT rule, and
 * `.slab` sets its own `display` in the stylesheet. An author declaration beats
 * a UA one, so `hidden` was set, correct, and did nothing at all — the headings
 * kept drawing and the bar read `MODEL MODEL Opus 5`. An inline style is an
 * author declaration of the highest specificity, so it wins, and it needs no
 * matching rule in `styles.css` and therefore none in the mockup either.
 */
function standDownDuplicateHeadings() {
  for (const g of document.querySelectorAll('.strip .sgrp')) {
    const label = g.querySelector(':scope > .slab');
    if (label === null) continue;
    // **ONLY WHERE THE HEADING WOULD SAY THE SAME WORD TWICE.**
    //
    // The first cut stood the heading down whenever ANY field inside was
    // named, and that was too broad: it took `CORPUS` off a group reading
    // `734 ITEMS · in step with the log · 0 doctor notices`, which is the only
    // thing saying what those three facts have in common. Four groups lost
    // their subject and `repo`/`model` looked fine only because their single
    // field happens to share the group's word.
    //
    // The rule is narrower and it is about DUPLICATION, not about naming:
    // print the word once. A group with one field of the same name drops the
    // field's copy of it; a group with several keeps its heading AND every
    // field's own name, because `CORPUS` above three differently-named pills
    // is not a repetition — it is the grouping.
    //
    // The terminal is not the precedent here: it is a flat line with no
    // grouping, so it never had a heading to lose.
    const own = [...g.querySelectorAll('.ulab')];
    const heading = (label.textContent ?? '').trim().toLowerCase();
    const duplicate = own.length === 1
      && (own[0].textContent ?? '').trim().toLowerCase() === heading;
    if (duplicate) own[0].style.display = 'none';
    label.dataset.standdown = duplicate ? '0' : '0';
  }
}

/**
 * **WHEN THE AUDIT LOG LAST MOVED** — the one field in the audit group that
 * has a source on this read surface.
 *
 * Three states, kept apart, because an empty log and a failed read are
 * different facts: "nothing has been recorded" is a measurement and "I could
 * not tell" is not, and a bar that draws them identically has destroyed the
 * only difference that matters.
 *
 * **The staleness mark is DERIVED, not chosen.** Past `CONTEXT_SAMPLE_FRESH_MS`
 * — this page's own constant, the same one that decides a context sample is too
 * old to present as current — the block goes `warn`. Reusing it is the honest
 * reading rather than a convenience: the constant answers "how long before a
 * reading stops being evidence of a live session", and a log that has recorded
 * nothing for that long is the same claim about the same session. No threshold
 * is spelled here, and if that constant moves this moves with it.
 *
 * The age is computed HERE, at draw time, for the reason the "as of … ago"
 * label beside it is: a duration frozen when the value was fetched is not a
 * duration.
 */
function auditClockParts(view) {
  const last = view.lastAudit;
  const keyed = (key, subs, cls, glyph) => {
    const el = document.createElement('span');
    el.dataset.k = key;
    el.dataset.f = 'last-audit';
    el.className = cls;
    if (glyph !== undefined) el.dataset.g = glyph;
    el.append(...translate(table.strings, key, subs));
    el.title = flat(table.strings, 'title.log');
    return el;
  };
  if (last === null) return [stateChip('strip.unread', 'title.unread')];
  if (last.state === 'empty') return [keyed('strip.logEmpty', {}, 'sprop')];
  if (last.state !== 'known' || last.at === null || last.op === null) {
    return [keyed('strip.logUnreadable', {}, 'chip warn', '▲')];
  }
  const at = Date.parse(last.at);
  // A stamp this product wrote and cannot parse. Not an age of zero, and not
  // silence either: the row is there and its date is not readable.
  if (!Number.isFinite(at)) return [keyed('strip.logUnreadable', {}, 'chip warn', '▲')];
  const ageMs = Math.max(0, Date.now() - at);
  // `formatDuration`, matching the terminal's `since` exactly: this field is on
  // both surfaces, so it carries the same value at the same resolution.
  const age = formatDuration(ageMs);
  // ── STALE SAYS THE SAME THING, IN A DIFFERENT COLOUR — owner ruling,
  //    2026-09-01: *"terminal shows the last audit while the bar shows that
  //    nothing was loged from"*, and then *"fix it to be exact as the terminal"*.
  //
  // This branch used to draw "nothing logged for 13h", which was FALSE wherever
  // it appeared: a row that is thirteen hours old is a row that was logged. It
  // also dropped the op — the one fact a reader wants most at exactly the moment
  // the log has gone quiet — and it disagreed with the terminal, which keeps
  // `SubagentStop ·13h45m` and moves only its INK: *"Blue while it is merely a
  // fact; warn once it IS the finding."*
  //
  // So the words are now the same words, and the WARN CHIP plus the ▲ carry the
  // whole of the warning. The key survives with the same sentence on purpose:
  // the KEY is what distinguishes the state (colour, glyph, and the design of
  // record's own segment ledger), the TEXT is the fact, and the fact did not
  // change when it got old. `INV-nothing-is-dropped-silently`.
  if (ageMs > CONTEXT_SAMPLE_FRESH_MS) {
    return [keyed('strip.logQuiet', { op: last.op, age }, 'chip warn', '▲')];
  }
  return [keyed('strip.log', { op: last.op, age }, 'sprop')];
}

/**
 * **HOW MANY TIMES PROJECT KNOWLEDGE WAS INJECTED INTO THIS SESSION** — the
 * last `not measured` on the strip, 2026-09-01.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 *
 * The audit group drew a label and a permanent `not measured` chip, and had
 * since the strip refactor. That is the shape `strip.append` was CUT for the
 * day before: a label promising a measurement nobody takes. The difference is
 * that this one was KEPT by an explicit ruling — it is the at-a-glance proof
 * that injection is firing at all — so it needed a SOURCE, not a removal.
 *
 * ── AND THE SOURCE WAS ALREADY IN THE ROOM ─────────────────────────────────
 *
 * `/api/watch/context` has been serving `mycontext: {tokens, injections,
 * unrecorded}` since the project-knowledge share landed, and this page has been
 * reading it: `contextStrip` puts it on `view.myctx` and the session group
 * spends `tokens` in `strip.myctx`. `injections` came down the same wire, in
 * the same object, and was used only inside that one sentence's parentheses.
 * The terminal bar's lane found the same thing on its side the same morning —
 * `myctxShare` returns the count and gates on `> 0`. **No new endpoint, no new
 * call, no new query.** The one thing that changes is that a number already on
 * the page is drawn where the label for it already was.
 *
 * ── THE LABEL MOVED TO MEET THE NUMBER ─────────────────────────────────────
 *
 * The label said `injections today`. The figure is not a calendar day and never
 * could have been cheaply: `/api/watch/context` bounds the count to the current
 * CONTEXT EPOCH — what survived the last compaction — and drops `subagent-start`
 * records, both in `core/context-share.ts`, because the sentence beside it says
 * "of IT", of the window whose fullness is drawn two groups over. Unbounded, on
 * this repository's own corpus, that sum was 2.5x the bounded one.
 *
 * Counting a real "today" would mean asking `/api/watch/volume` for every
 * minute since local midnight — up to 1,440 columns on every page boot, past
 * that endpoint's own cap — and it would STILL be wrong by part of a minute,
 * because its window ends at `now` and not on a midnight boundary. Wrong by a
 * little, on a bar whose whole job is provenance, is wrong.
 *
 * So `strip.inj` reads `injections this context` and the number under it is
 * exactly that. A wrong word on a correct figure is still a wrong figure, and
 * the word is the half that was cheap to fix.
 *
 * ── A MEASURED ZERO IS `0`, AND AN UNMEASURED ONE IS NOT ───────────────────
 *
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. Three
 * answers, and they are three different sentences:
 *
 *   `0`                a projection that was read and holds no injection for
 *                      this session. Injection has not fired. That is the
 *                      figure this field exists to show, and it is drawn.
 *   `not read`         the endpoint did not answer. `fillContext`'s `unread()`
 *                      owns that one and this function never sees it.
 *   `not measured`     the endpoint answered and could not produce the count —
 *                      no projection built for this corpus, or the read
 *                      refused. `mycontextError` carries the reason and it
 *                      becomes the chip's title, because the reason is a
 *                      sentence and the bar has room for two words.
 *
 * A cold session is the fourth and it is `not measured` too: there is no
 * session to count injections into, which is a thing nobody measured rather
 * than a session that received none.
 *
 * **THE LABEL IS DRAWN IN EVERY ONE OF THEM, INCLUDING `not read`.** The
 * property is what the reader is owed and hiding the whole segment is how forty
 * of forty-four came to be invisible; `e2e/strip.spec.ts` pins it. That is why
 * this function owns the unread rendering too instead of `fillContext`'s
 * generic `unread()` — the generic one is a chip and a button with no name on
 * it, which is right for a segment whose label lives outside it and wrong here.
 */
function injectionParts(view) {
  const label = document.createElement('span');
  // Same shape as the item count: the string carries the word, so it takes the
  // label treatment on that word rather than gaining a second one.
  label.className = 'sprop ulab ufield';
  label.dataset.f = 'injections';
  label.dataset.k = 'strip.inj';
  label.title = flat(table.strings, 'title.inj');
  label.append(...translate(table.strings, 'strip.inj'));
  const dashed = (...before) => {
    const dash = document.createElement('span');
    dash.className = 'm';
    dash.textContent = '—';
    return [...before, dash, document.createTextNode(' '), label];
  };

  // The endpoint did not answer at all. A different sentence from "it answered
  // and could not count".
  //
  // **NAMED HERE, RETRIED NEXT DOOR.** `unreadState` pairs its chip with a
  // refresh button, and this is the one segment that must not take it: the
  // audit clock sits in the SAME group, rides the SAME body, and already draws
  // that button a few pixels away — `fillContext`'s own note is that "a retry
  // in each is the same retry; they all ask this one function again". A second
  // button for the same call, in the densest row this shell has, is width spent
  // on nothing. Measured at 1280px with the call refusing: the audit group came
  // to 552px with it and 390px without, against a strip that
  // `e2e/strip.spec.ts` holds to a width budget group by group.
  if (view === null) return dashed(stateChip('strip.unread', 'title.unread'));

  // The unmeasured cases keep the em dash the segment has always drawn where
  // the figure goes, so the label never sits alone with nothing in front of it.
  if (view.myctx === null) {
    const chip = stateChip('strip.unmeasured', 'title.unmeasured');
    // The endpoint's own sentence when it has one — it names the corpus and the
    // command that would build the projection, which is more use than the
    // generic title and is the same reason `strip.myctxUnavailable` prints it.
    if (typeof view.myctxError === 'string' && view.myctxError !== '') {
      chip.title = view.myctxError;
    }
    return dashed(chip);
  }

  // **A COUNT WITH RECORDS BEHIND IT THAT CANNOT BE PRICED IS STILL AN EXACT
  // COUNT.** `unrecorded` is injections logged before `tokens` existed on the
  // record; it makes the TOKEN sum a lower bound — `strip.myctxPartial` says
  // `≥` for exactly that — and leaves the injection COUNT exact, because those
  // rows were counted and only their size is unknown. Nothing is qualified
  // here that does not need to be.
  // ── ONE PILL, not a bare figure beside a labelled one ────────────────────
  // The count and its word were two `[data-f="injections"]` elements sitting
  // side by side, so the figure was bare text next to a pill. They are ONE
  // FACT and they become one pill: the label inside, the value beside it, the
  // same shape every other field takes.
  const wrap = document.createElement('span');
  wrap.className = 'ufield';
  wrap.dataset.f = 'injections';
  wrap.title = flat(table.strings, 'title.inj');
  const figure = document.createElement('span');
  figure.className = 'm uval';
  figure.textContent = String(view.myctx.injections);
  label.className = 'sprop ulab';
  label.removeAttribute('data-f');
  wrap.append(label, document.createTextNode(' '), figure);
  return [wrap];
}

/**
 * **HOW FULL THE WINDOW IS, ON ABSOLUTE BANDS** — `plan:walk seq:117`, and the
 * owner ruling of 2026-08-31 that split one chip into two fields.
 *
 * The context figure carried no colour at all, so a reader could see 60.1% and
 * not see how much runway that left. Three things this had to be, and each of
 * them ruled out an easier version:
 *
 *  1. **ABSOLUTE, and that is the change.** This chip's boundaries are
 *     `CONTEXT_FILL_WARN_PERCENT` (60) and `CONTEXT_FILL_CRIT_PERCENT` (85),
 *     declared ONCE in `lib/viewmodel.js` and never spelled here or in a title.
 *     They are deliberately NOT derived from `handoverThresholdPercent`: how
 *     full a window is does not become a different fact because somebody
 *     reconfigured when the handover fires. The threshold-derived question —
 *     how close is the ask — is `handoverProximityChip` below, one element
 *     along, in gold.
 *  2. **Colour is never the only carrier.** The percentage stays a number in
 *     the sentence beside this, and the state is a `.chip` — a WORD, a glyph,
 *     and one of the five budgeted hues. That is `06-a11y.html`'s rule ("a
 *     glyph AND a colour AND a name"), and it is the same treatment the four
 *     group labels already get for the same reason: --gold and --ok measure
 *     1.04:1 against each other and are one state to a dichromat, one grey on a
 *     mono printer, and one system tone under forced-colors.
 *  3. **A stale figure is NOT coloured as though it were live.** The strip
 *     already discloses age — *"as of last response, 29h ago"* — and a fossil
 *     rendered in confident red is worse than an uncoloured number.
 *     `occupancyLevel` answers `'stale'` past `CONTEXT_SAMPLE_FRESH_MS` and
 *     that draws the NEUTRAL chip, which is visibly not-a-level rather than a
 *     level: `.chip.unmeas` spends `--dim` and carries `◌`, and it is the same
 *     chip `strip.unread` and `strip.unmeasured` already wear.
 *
 * `null` when there is nothing to band: a state with no percentage at all.
 * Unlike the gold marker beside it this survives the handover feature being
 * switched off, because an absolute band needs no threshold — a corpus with no
 * handover configured still has a window that can fill up.
 *
 * No sixth hue (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-
 * warn`): ok, warn and crit already exist, the neutral already exists, gold
 * already exists, and every one of these `.chip.*` modifiers is in the mockup
 * at the same value — which `test/ui/styles-parity.test.ts` checks in both
 * directions.
 */
function fillChip(view) {
  const ageMs = view.receivedAt === null ? null : Math.max(0, Date.now() - Date.parse(view.receivedAt));
  const level = view.state === 'known' ? fillLevel(view.pct, ageMs) : null;
  if (level === null) return null;
  const chip = document.createElement('span');
  // The WORD for the band the figure beside it wears in COLOUR. Web-only as a
  // separate field: the terminal spends a glyph on the same job, inside the
  // context block itself, so there is no second block there to name.
  chip.dataset.f = 'fill';
  if (level === 'stale') {
    chip.className = 'chip unmeas';
    chip.dataset.g = '\u25cc';
    chip.dataset.k = 'strip.ctxLevelStale';
    chip.append(...translate(table.strings, 'strip.ctxLevelStale'));
    chip.title = flat(table.strings, 'title.ctxLevelStale');
    return chip;
  }
  chip.className = 'chip ' + level;
  // The title names both boundaries, and they are read off the module that
  // declares them rather than typed here — a second copy of 60 or 85 is the
  // defect this project has measured eight times, and a title is exactly where
  // one would hide.
  const subs = {
    fillWarn: String(CONTEXT_FILL_WARN_PERCENT),
    fillCrit: String(CONTEXT_FILL_CRIT_PERCENT),
  };
  // Every key spelled in full, never composed from a prefix — see the note on
  // `handoverProximityChip` below, and `test/ui/viewmodel.test.ts`, which reads
  // these literals out of this file's own bytes.
  if (level === 'crit') {
    chip.dataset.g = '\u25a0';
    chip.dataset.k = 'strip.fillCrit';
    chip.append(...translate(table.strings, 'strip.fillCrit'));
    chip.title = flat(table.strings, 'title.fillCrit', subs);
  } else if (level === 'warn') {
    chip.dataset.g = '\u25b2';
    chip.dataset.k = 'strip.fillWarn';
    chip.append(...translate(table.strings, 'strip.fillWarn'));
    chip.title = flat(table.strings, 'title.fillWarn', subs);
  } else {
    chip.dataset.g = '\u25cf';
    chip.dataset.k = 'strip.fillOk';
    chip.append(...translate(table.strings, 'strip.fillOk'));
    chip.title = flat(table.strings, 'title.fillOk', subs);
  }
  return chip;
}

/**
 * **HOW CLOSE THE HANDOVER ASK IS — ONE GOLD MARKER AT TWO WEIGHTS, AND
 * SILENT BELOW THE WARN BAND.** Owner ruling 2026-08-31.
 *
 * `occupancyBands`/`occupancyLevel` still decide WHEN this fires, unchanged and
 * still derived from the SERVED `handoverThresholdPercent` — the value is
 * configurable, `core/config.ts` names one place its default is applied, and a
 * constant here would be a second one. What changed is the presentation: a
 * three-step ok/warn/crit ramp became a flag.
 *
 *   below T * 0.9    nothing at all
 *   at or past       `chip gov` — gold, a diamond, "nearing the handover ask"
 *   at or past T     `chip gov` with the words in a `{b:}` run — the same gold
 *                    marker, emphasised, "at the handover ask"
 *
 * **Why the `ok` state is now silence.** It said *"well below the handover
 * ask"*, which is the common case and therefore free of information — the same
 * reasoning that cut `strip.inSync` from the repo group in this pass. A field
 * that only speaks when it has something to say costs the row nothing the rest
 * of the time.
 *
 * **Why gold and not a sixth hue.**
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` assigns all
 * five meaning-hues, and two full ramps beside each other would need a sixth
 * and a seventh. Gold already means "this wants your attention" in this
 * product, and an ask is a REQUEST rather than a severity level. The absolute
 * fill chip beside this keeps ok/warn/crit, so between them the pair says both
 * things at once: crit with no gold is a nearly-full window whose ask has not
 * fired, and crit WITH gold is both.
 *
 * **Colour is still never the only carrier.** Two gold chips at two weights are
 * one hue, so the two states are told apart by their WORDS — which is what
 * survives a dichromat, a monochrome printer and forced-colors — and by the
 * `{b:}` run, which survives all three as well.
 *
 * A stale sample draws nothing here: `fillChip` beside it has already said the
 * reading is too old to place, and two chips saying that would be one fact
 * twice.
 */
function handoverProximityChip(view) {
  const threshold = view.handover.threshold;
  const ageMs = view.receivedAt === null ? null : Math.max(0, Date.now() - Date.parse(view.receivedAt));
  const level = view.state === 'known' ? occupancyLevel(view.pct, threshold, ageMs) : null;
  if (level === null || level === 'stale' || level === 'ok') return null;
  const bands = occupancyBands(threshold);
  const chip = document.createElement('span');
  // `govfig` drops the FILL and keeps the rectangle, for the same ruling and
  // on the same field as `askfig`: this is the ask in its FIRED state, and a
  // field that lost its fill below the threshold and got one back at it would
  // be two treatments for one field.
  chip.className = 'chip gov govfig';
  // `ask-verdict`, not `ask`: the ask field now draws its own bar at every
  // level, so this chip is the ACTION beside the measurement rather than a
  // replacement for it. Two elements claiming one field id would make the
  // enumeration ambiguous about which one is the field.
  chip.dataset.f = 'ask-verdict';
  chip.dataset.g = '\u25c6';
  // One decimal place: at the configured threshold of 85 the warn band opens at
  // 76.5, and rounding it to 77 would print a boundary the code does not use.
  const subs = { warn: bands.warn.toFixed(1), threshold: String(threshold) };
  if (level === 'crit') {
    chip.dataset.k = 'strip.ctxCrit';
    chip.append(...translate(table.strings, 'strip.ctxCrit'));
    chip.title = flat(table.strings, 'title.ctxCrit', subs);
  } else {
    chip.dataset.k = 'strip.ctxWarn';
    chip.append(...translate(table.strings, 'strip.ctxWarn'));
    chip.title = flat(table.strings, 'title.ctxWarn', subs);
  }
  return chip;
}

/**
 * **THE ACCOUNT'S TWO RATE-LIMIT WINDOWS** — owner ruling 2026-08-31: the
 * owner's seven-day window read 49% and nothing on any surface said so.
 *
 * **No new source and no new call.** `rate_limits.five_hour` and
 * `.seven_day` ride in the status-line payload the tee already stores WHOLE, so
 * `classifyRateLimits` reads them at the moment `classifyContext` reads the
 * context window and `/api/watch/context` carries both. Everything below is
 * presentation over a field that was already on the wire.
 *
 * **The countdown is half the field.** `resetsAt` is unix SECONDS and the age
 * is computed HERE, at draw time, for the same reason the "as of … ago" label
 * beside it is: a percentage with no reset time is alarming rather than
 * actionable, and a countdown frozen at fetch time is not a countdown. A window
 * whose reset time the payload did not carry draws its percentage and no
 * countdown, rather than a guess.
 *
 * **Banded by `occupancyLevel` — the SAME function the handover proximity
 * uses, never a second threshold set.** A hand-kept number that has to agree
 * with a derived one is this project's most-repeated defect. Silent below the
 * warn band, for the reason the gold marker is: a limit nowhere near its
 * ceiling changes nothing a reader does next. ONE chip for both windows and not
 * two, because the answer a reader needs is "is either of them close", and two
 * chips saying the same word is the crowding this pass exists to undo.
 *
 * **Absent is silence, never a placeholder.** Both windows are independently
 * nullable — see `classifyRateLimits` for the three levels at which the payload
 * can decline to say — and a `0%` invented for a window nobody reported would
 * be a claim about an account that was never made.
 */
function rateLimitParts(view) {
  const out = [];
  const windows = [
    { key: 'strip.rl5', window: view.rate.fiveHour, field: 'rate-5h', nameKey: 'strip.grp.rate5' },
    { key: 'strip.rl7', window: view.rate.sevenDay, field: 'rate-7d', nameKey: 'strip.grp.rate7' },
  ];
  let worst = null;
  // **WHICH WINDOW EARNED THE VERDICT.** Owner, 2026-09-01: *"i think i
  // understand the limit near just didn't remember it relates to the 7D usage,
  // we should add a label or some other way to make user understand this
  // field"*. The chip is a verdict over BOTH windows and said only "limit
  // near", so a reader who had not just read the code could not tell whether
  // the five-hour or the seven-day allowance was the one filling up -- and
  // those two call for different actions. The name travels with the level.
  let worstName = null;
  for (const { key, window, field, nameKey } of windows) {
    if (window === null) continue;
    const span = document.createElement('span');
    // ── BANDED ON THE FIGURE, 2026-09-01 — owner ruling. These two were
    // NEUTRAL AT EVERY VALUE: the chip below said "limit near" once a window
    // crossed, and the percentages themselves never carried a colour at all.
    //
    // A quota's own fullness has nothing to do with when a handover is due, so
    // these are banded on the ABSOLUTE scale and never against the handover
    // threshold — which is what `occupancyLevel` measures, and what the chip
    // below wrongly used until this ruling.
    //
    // No age argument: a rate-limit window arrives with the payload being read
    // right now, so there is no such thing as a stale one. `usageLevelOf` is the
    // pure form and has no `stale` branch to leave unreachable.
    // **`usageLevelOf`, THE SAME FOUR BANDS THE TERMINAL USES** -- owner ruling,
    // 2026-09-01: *"align to terminal"*.
    //
    // This read `fillLevel` (60/85) while the terminal's `rateLimitSegment` goes
    // through `usedOfMaxSegment` -> `usageLevel` -> `usageLevelOf` (60/70/80),
    // and the comment that used to sit here claimed the opposite in so many
    // words: *"`fillLevel`, which is what the terminal bands them with"*. It was
    // not. Between 80 and 85 percent the terminal called a window CRITICAL while
    // this bar's verdict still said "limit near" -- one fact, two answers, which
    // is the exact defect the two-surface bands exist to prevent.
    //
    // The FIGURE was never wrong: `bandUsage` below has always banded it with
    // `usageLevelOf`, and the four-level rules beat `.rlfig.ok/.warn/.crit` by
    // source order (see the note above `.uicon` in styles.css). Only the verdict
    // read the older ramp, which is why the disagreement was visible in the chip
    // and nowhere else. The three-band class is dropped here rather than
    // recomputed: `bandUsage` adds the band, and `unmeas` when there is none.
    const level = usageLevelOf(window.usedPercent);
    span.className = 'small rlfig';
    span.dataset.k = key;
    span.dataset.f = field;
    span.append(...translate(table.strings, key, {
      pct: String(Math.round(window.usedPercent)),
      // `resetsAt` is SECONDS; `formatDuration` takes milliseconds. Clamped at zero
      // so a window whose reset moment has passed but whose payload has not
      // been rewritten yet reads "now" rather than a negative countdown.
      //
      // **`formatDuration`, NOT `formatAge`** \u2014 owner ruling, 2026-09-01: "add the
      // minutes too as it is in the status line in terminal". `formatAge`
      // answers "how old is this" and drops to one unit deliberately; a
      // COUNTDOWN is a different question. `23h` is the same string for a
      // window resetting in twenty-three hours and one resetting in twenty-
      // three hours fifty-five, and this is the figure a reader uses to decide
      // whether to wait. `formatDuration` is the terminal's own `until` rule, so
      // neither bar can say a thing the other does not.
      reset: window.resetsAt === null
        ? '\u2014'
        : formatDuration(Math.max(0, window.resetsAt * 1000 - Date.now())),
    }));
    // The same four levels the terminal bands these with, and the NAME comes
    // from the string table rather than from the value: `strip.rl5` used to
    // open with a literal `5h`, which would have named the field twice once
    // the label arrived. The name moved OUT of every banded string for exactly
    // that reason — see `bandUsage`.
    bandUsage(span, window.usedPercent, nameKey);
    out.push(span);
    // No `ageMs` argument: the staleness rule belongs to the CONTEXT sample,
    // which is a measurement of this window and goes out of date as the session
    // moves. A rate-limit percentage is a fact about the account over a fixed
    // period and the reset time beside it says how long that period has left,
    // so the reader can see for themselves how old the reading is.
    // The SAME band the figure beside it wears, and the same one the terminal
    // uses — see the note above. This read `occupancyLevel` against the
    // handover threshold until 2026-09-01, then `fillLevel`'s 60/85, and now the
    // 60/70/80 the terminal actually bands these windows with.
    //
    // **`caution` earns no chip, and that is the point of having four bands.**
    // The verdict is the loud channel: it is a word on a bar that is mostly
    // numbers, and one that appeared at 60% -- the very first pixel of the second
    // band of four -- was crying wolf for a fifth of the range. The 60-70 band is
    // not silent, it is drawn where a band belongs: on the FIGURE, in gold, with
    // its own icon. The chip now speaks for `warning` and `critical`, which are
    // the two the reader must act on.
    //
    // `critical` always overwrites, `warning` only claims an empty verdict, so
    // the name that survives is always the window the verdict is about.
    if (level === 'critical') { worst = 'crit'; worstName = nameKey; }
    else if (level === 'warning' && worst === null) { worst = 'warn'; worstName = nameKey; }
  }
  if (worst !== null) {
    const chip = document.createElement('span');
    chip.className = 'chip ' + worst;
    // **A VERDICT IS A FIELD.** Owner, 2026-09-01: "limit near rectangle should
    // be standardised". It measured 28px beside every other pill's 26 because
    // `.strip .sgrp [data-f]` carries the shared metrics and this chip had no
    // `data-f` to be caught by it — so it kept whatever line-height it
    // inherited. Every word-only state is a field like any other: it occupies
    // the same slot a figure occupies at another value, and a bar that is
    // uniform while calm and ragged when something needs attention is wrong
    // exactly when it is being read.
    chip.dataset.f = 'rate-verdict';
    // `{mv:win}` in both tables, so the Latin `7d` stays isolated and monospaced
    // inside the Hebrew sentence rather than reordering it.
    const win = worstName === null ? '' : flat(table.strings, worstName);
    if (worst === 'crit') {
      chip.dataset.g = '\u25a0';
      chip.dataset.k = 'strip.rlAt';
      chip.append(...translate(table.strings, 'strip.rlAt', { win }));
    } else {
      chip.dataset.g = '\u25b2';
      chip.dataset.k = 'strip.rlNear';
      chip.append(...translate(table.strings, 'strip.rlNear', { win }));
    }
    chip.title = flat(table.strings, 'title.rate');
    out.push(chip);
  }
  return out;
}

/**
 * **WHAT BECAME OF THE HANDOVER ASK** — `plan:walk seq:118`, owner ruling
 * 2026-08-31: *show, beside the context figure, when the handover was
 * automatically created or updated.*
 *
 * **The fact already existed, was durable, and nothing read it.** Every
 * `pre-compact` record has carried `handoverAsk` since 2026-08-27 — read off
 * the live audit log, `2026-08-29T04:22 auto 99.7147% handoverAsk: acted-on`,
 * with the note naming both the ask time and the file's write time. The verdict
 * was computed, written and kept, and the strip did not read it.
 *
 * **NOT RE-DERIVED HERE, AND THAT IS THE RULING.** `core/handover-ask.ts`
 * computes it by comparing the latch's `askedAt` against the handover file's
 * mtime, and its own header calls that comparison the whole feature: *the flag
 * is not a claim, it is a comparison*. A browser can stat nothing, so it could
 * only ever guess — and a second computation of one question is a second
 * spelling, which is how facts come apart. The server answers on
 * `/api/watch/context`; this draws what it was told.
 *
 * **Five states, and none of them silent:**
 *
 *   acted-on      ok      the mechanism worked, WITH WHEN — the value is
 *                         knowing the handover is current, not merely that
 *                         something happened once.
 *   ignored       crit    the ask went out and the file was not written. THE
 *                         ONE THAT MATTERS MOST, and the one a reader will
 *                         never think to check for, so it is the loudest hue in
 *                         the budget rather than a quieter `acted-on`. This
 *                         project has already paid for the alternative once:
 *                         the item held to be the continuity guarantee was
 *                         delivered on no event at all, for weeks, while
 *                         everyone believed the guarantee was in force —
 *                         because a record said an ask went out, which reads
 *                         exactly like the mechanism working.
 *   not-asked     carry   configured, and this session has not crossed the
 *                         threshold. A MEASURED not-yet (`STD-a-measured-zero-
 *                         is-drawn-and-named-an-unmeasured-thing-is`), and not
 *                         a warning — nothing is wrong, so it does not borrow
 *                         a warning's voice. `--carry` is the continuity hue
 *                         and this is the continuity mechanism.
 *   off           neutral no `handover` key at all: the whole feature is off
 *                         and silent, which is a DIFFERENT FACT from
 *                         `not-asked` and is said rather than collapsed into
 *                         it. One means nobody configured this; the other
 *                         means somebody did and the moment never came.
 *   unverifiable  neutral asked, and the comparison could not be made. Never
 *                         folded into `ignored`: an accusation nothing supports
 *                         is the same defect as a guarantee nothing supports.
 *
 * `verdict: null` draws nothing — the endpoint did not answer, or this is a
 * cold session with no endpoint to ask. That is not `off`: "the feature is
 * switched off" is something this page was told, and "nobody told us anything"
 * is not.
 */
function handoverVerdictChip(view) {
  const h = view.handover;
  if (h.verdict === null) return null;
  const chip = document.createElement('span');
  const subs = {
    path: h.path ?? '—',
    asked: h.askedAt ?? '—',
    written: h.writtenAt ?? '—',
    threshold: h.threshold === null ? '—' : String(h.threshold),
  };
  // The same reasoning as the rate-limit verdict above, and the same owner
  // ruling: `handover written 13h ago` measured 24px. Set once here rather
  // than in each branch, so a verdict added later cannot miss it.
  chip.dataset.f = 'handover-verdict';
  if (h.verdict === 'acted-on') {
    chip.className = 'chip ok';
    chip.dataset.g = '●';
    chip.dataset.k = 'strip.hoActed';
    // WHEN, computed from `writtenAt` at RENDER time so it ticks — the same
    // treatment, and for the same reason, as the "as of … ago" on the context
    // sentence one element back. A handover written eight hours ago and one
    // written eight seconds ago are different answers to "is it current".
    const writtenMs = h.writtenAt === null ? NaN : Date.parse(h.writtenAt);
    chip.append(...translate(table.strings, 'strip.hoActed', {
      age: Number.isFinite(writtenMs) ? formatAge(Math.max(0, Date.now() - writtenMs)) : '—',
    }));
    chip.title = flat(table.strings, 'title.hoActed', subs);
  } else if (h.verdict === 'ignored') {
    chip.className = 'chip crit';
    chip.dataset.g = '■';
    chip.dataset.k = 'strip.hoIgnored';
    chip.append(...translate(table.strings, 'strip.hoIgnored'));
    chip.title = flat(table.strings, 'title.hoIgnored', subs);
  } else if (h.verdict === 'not-asked') {
    chip.className = 'chip carry';
    chip.dataset.g = '◇';
    chip.dataset.k = 'strip.hoNotAsked';
    chip.append(...translate(table.strings, 'strip.hoNotAsked'));
    chip.title = flat(table.strings, 'title.hoNotAsked', subs);
  } else if (h.verdict === 'off') {
    chip.className = 'chip unmeas';
    chip.dataset.g = '◌';
    chip.dataset.k = 'strip.hoOff';
    chip.append(...translate(table.strings, 'strip.hoOff'));
    chip.title = flat(table.strings, 'title.hoOff', subs);
  } else {
    // `unverifiable`, and anything a later build of the server adds. An
    // unknown verdict is drawn as NOT KNOWN rather than dropped: a chip that
    // vanishes for a state this page has not heard of is the silence every
    // named state in this strip exists to end.
    chip.className = 'chip unmeas';
    chip.dataset.g = '◌';
    chip.dataset.k = 'strip.hoUnknown';
    chip.append(...translate(table.strings, 'strip.hoUnknown'));
    chip.title = flat(table.strings, 'title.hoUnknown', subs);
  }
  return chip;
}

// --- The rail's count badges ------------------------------------------------
//
// `<span class="cnt x">7</span>` beside Doctor and Review queue: the count of
// things wanting attention, on the rail, where a person sees it without
// opening the screen. The design of record has drawn this since it was
// written and `styles.css` has carried `.cnt` and `.cnt.x` just as long — and
// nothing in this shell ever created one, so the stylesheet had rules for an
// element that did not exist. Invisible to `styles-parity` by construction: it
// compares CSS BLOCKS, and both files have the block.
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
// **`gaps` retired 2026-09-04** (`TASK-coverage-gaps-folds-into-scope-
// coverage-keeping-the-one-fact`, seq:22) with the rail button it used to
// badge — `coverageGaps()` still lives in `lib/viewmodel.js` and is still what
// `screens/coverage.js`'s own status line counts, but there is no longer a
// `.nav[data-s="gaps"]` to paint a badge onto, and the extra `/api/coverage`
// boot request that only fed this badge is dropped with it.
const RAIL_COUNTS = ['doctor', 'work'];

/** `null` means NOT MEASURED, which is never the same as `0`. */
async function railCounts() {
  const counts = { doctor: null, work: null };
  try {
    const status = await api('/api/status');
    counts.doctor = doctorNoticeCount(status);
    // BOTH queues, because the screen draws both. Reading only
    // `pendingRevisions` made the badge say 0 with a draft sitting on the
    // screen waiting for a verdict -- a badge that undercounts what its own
    // screen shows is worse than no badge, because it reads as "nothing to do
    // here" rather than as missing. `/api/status` already served
    // `reviewQueue.drafts`; nothing new is fetched.
    counts.work = reviewQueueCount(status);
  } catch { /* stays null — named as unmeasured on the rail */ }
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
      // `screenFromHash`, not `location.hash === '#/name'`: since 2026-09-05 a
      // hash may carry the screen's OWN sub-path after the screen name
      // (`#/docs/<id>/<anchor>`), and an equality test would drop the rail
      // highlight the moment a reader opened a document — the rail would say
      // no screen is current while a screen is plainly on the page.
      if (screenFromHash(location.hash) === name) button.setAttribute('aria-current', 'page');
      group.append(button);
    }
    nav.append(group);
  }
}

/**
 * **The screen a hash names — its FIRST path segment, and nothing after it.**
 *
 * Until 2026-09-05 a hash was the whole screen name and nothing else, so
 * `route()` compared the whole string against `SCREENS` and `renderNav()`
 * compared it against `#/${name}`. Two screens now address a DOCUMENT in the
 * hash — `#/docs/<id>/<anchor>` and `#/tut/<id>`, the deep link
 * `docs/superpowers/specs/2026-09-05-documentation-screen-design.md` §2 asks
 * for — and under the old reading every one of those addresses was an unknown
 * route that rendered the injection preview instead. The screen half of a deep
 * link cannot be the screen's own business: the shell is what picks the module.
 *
 * **The segment after the screen is NOT parsed here, deliberately.** This
 * function answers one question — which module — and the rest of the hash is
 * read by that module, which is the only code that knows what its own ids
 * mean. `screens/docs.js` looks its id up in the manifest the server just
 * answered; nothing in this shell ever resolves one.
 *
 * A document id contains `/` (it is a repo-relative path), so the screens
 * `encodeURIComponent` it into ONE segment. That keeps this split at the first
 * `/` correct without this function knowing anything about ids.
 */
function screenFromHash(hash) {
  const asked = (String(hash).replace(/^#\//, '') || 'preview');
  const cut = asked.indexOf('/');
  return cut === -1 ? asked : asked.slice(0, cut);
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
  //
  // **AND THIS ROUTE'S GENERATION IS TAKEN FIRST, before a single piece of
  // shared state is touched.** Everything from here to the first `await` is
  // synchronous, so the LAST route to start is the one whose screen is visible
  // and whose rail is current; `routeGeneration` is that fact written down, so
  // the work that resumes after an `await` can ask whether it is still the
  // reader's. See `routeGeneration` for the measurement.
  const generation = routeGeneration + 1;
  routeGeneration = generation;
  closePane();
  // The same argument, for the OTHER piece of state a screen leaves behind:
  // a subscription opened on Coverage's behalf and an affordance saying
  // Coverage has new rows both belong to a screen the reader just navigated
  // away from. `teardownLiveScreen()` — see "LIVE INVALIDATION" above.
  teardownLiveScreen();
  // Decision 5: the landing screen is the injection preview, at
  // event=session-start on the most recent session, rendering with no
  // input. NOT 'status' — that screen is built by Task 19 and deferred to
  // wave 3 ("Corrected 2026-08-20", plan Task 16 note).
  const askedRaw = screenFromHash(location.hash);
  // `screens/gaps.js` retired 2026-09-04 (`TASK-coverage-gaps-folds-into-
  // scope-coverage-keeping-the-one-fact`, seq:22): the rail button is gone,
  // but a reader who still has `#/gaps` from before that — a bookmark, a
  // stale link — is sent to Scope coverage, the screen directly above it in
  // the same rail group, where the one fact that screen reported (empty
  // categories) now lives as a card. Without this they would fall through to
  // the unknown-route case below and land on the injection preview instead,
  // which is not "one item up" and not where the fact moved to.
  const asked = askedRaw === 'gaps' ? 'coverage' : askedRaw;
  if (askedRaw === 'gaps') {
    // `replaceState`, not another `location.hash =` write: the latter fires
    // `hashchange` and re-enters this whole function a second time for a
    // redirect that has already decided where it is going. `replaceState`
    // corrects the address bar and, because `renderNav()` below reads
    // `location.hash` fresh, the rail highlights Scope coverage as current
    // — without a second route, and without a `#/gaps` entry left in
    // history for Back to return to.
    history.replaceState(null, '', '#/coverage');
  }
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

  // **AND IT SAYS SO WHILE IT IS EMPTY.** This used to clear the section and
  // wait, on the reasoning that "no string-table key exists yet for a transient
  // loading state ... inventing an untranslated string here would be exactly
  // the defect this shell's i18n discipline exists to prevent". The i18n half
  // of that was right; the conclusion was not. Clearing and waiting made
  // `.body` — the `1fr` row, the tallest one on the page — a band of nothing
  // for the length of a dynamic import: measured 2026-08-29 on `preview` at
  // 1280x720, 610px tall, one child, `<section data-p="preview"></section>`,
  // and not one visible glyph. `e2e/app-layout.spec.ts`'s geometry assertion
  // passed over it for exactly the reason it passed over `#prov` — an empty
  // element still covers its span — and its CONTENT assertion, added the same
  // day, names it.
  //
  // The answer was to WRITE THE KEY rather than to keep the silence: both
  // string tables carry `screen.unread` and `title.screenUnread` now, and this
  // draws the same chip the strip draws for the same kind of fact
  // (STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is, clause 3 —
  // "a blank is indistinguishable from a failure to load"). Nothing has to
  // remove it: every screen's `render()` opens with `root.replaceChildren()`,
  // uniformly, which is the same property the `noCredential` note below already
  // depends on.
  section.replaceChildren();
  const unread = document.createElement('p');
  unread.className = 'small';
  unread.id = 'screenunread';
  unread.append(stateChip('screen.unread', 'title.screenUnread'));
  section.append(unread);
  const mod = await loader();
  // **STOPPED HERE IF THE READER HAS ALREADY MOVED ON**, at the one point where
  // stopping costs nothing: the import has resolved, the render has not begun,
  // and everything this route would do from here on — five sequential fetches,
  // on the landing screen — is work for a `[data-p]` section that is now hidden
  // and that the next visit redraws from scratch anyway. Nothing is left
  // half-drawn: the section holds the `#screenunread` holding chip appended
  // above, which is exactly what every screen shows before it has finished, and
  // the only thing that ever makes it visible again is a `route()` whose own
  // `section.replaceChildren()` clears it first.
  if (generation !== routeGeneration) return;
  // Through the queue, never straight at the module: two routes to one screen
  // in one turn used to leave two whole renders stacked in its section. See
  // `sectionRender` above for the measurement.
  await renderScreen(mod, section);
  // Arm live invalidation for THIS screen, now that it has something on
  // screen to either rebuild or ask about. After render(), not before: a
  // record arriving mid-render would race a subscription against a first
  // paint that has not happened yet.
  // **THE RENDER MAY HAVE OUTLIVED THE ROUTE.** A fetch already in flight
  // cannot be unsent, so a route superseded DURING `renderScreen` still
  // finishes — into its own hidden section, harmlessly. What it must not do is
  // reach the lines below, which write state belonging to whatever screen the
  // reader is on NOW: `currentScreenRefresh` and `liveScreenUnsub` through
  // `setupLiveScreen`, and the `sess.nocred` note into a section the winning
  // route has already stopped showing.
  if (generation !== routeGeneration) return;
  setupLiveScreen(name, mod, section, generation);

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
  // `#sesspop` dialog — which IS built now (2026-09-02) and still is not where
  // this sentence goes. Both were considered and rejected — a banner and a
  // dialog are both call-outs ABOVE the content, and a dialog is worse: it says
  // nothing until the reader presses the control they have no reason to press.
  // This sits IN the one place a reader locked out of every screen is actually
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
 * because of it.** `index.html` carried ten `data-t` attributes then and
 * carries ELEVEN since 2026-09-01 — the item pane's six `<dl>` labels,
 * `pane.summary`, `pane.body`, `pane.hist`, `pane.histn` and
 * `pane.well` — and the file's own comment says they "are translated in place
 * by i18n.js's applyStatic". THERE WAS NO `applyStatic`: `applyLanguage()`
 * sets `lang` and `dir` and nothing else, and nothing anywhere queried
 * `[data-t]`. So those labels rendered their AUTHORED English on the Hebrew
 * page, and `pane.histn` — added with no authored text, the way this shell
 * builds everything else — rendered blank.
 *
 * No gate could see it. `strings-parity` compares the two tables against the
 * mockup's `data-t` SET, and every one of those keys is present in all three; a
 * key that exists and is never rendered still matches.
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
  // There is a third credential this code cannot see: the `mycontext_token`
  // cookie, set at handoff and HttpOnly by design, so `document.cookie` will
  // never show it. Bailing here would refuse to use a credential the browser is
  // already holding — so the boot continues, and it always will.
  //
  // **What this comment used to say next was "the only way to find out whether
  // this page is authenticated is to ASK THE SERVER", and that stopped being
  // true on 2026-08-29.** Asking cost ten refusals per boot, each one a write
  // (`plan:walk seq:85`), because there was no way to tell an unauthenticated
  // page from an authenticated one without being refused. There is now:
  // `credentialHeld()` reads the script-visible marker the handoff sets beside
  // the HttpOnly cookie, and `request()` is where that answer is acted on — one
  // place, so the heartbeat, the strip, the rail counts and every screen
  // inherit it without knowing about it. Nothing about the ORDER below
  // changes; what changes is that a page holding nothing sends nothing.

  window.myctx = {
    api,
    // The same door with a body. Reaches the three POST routes no screen could
    // call before; it reads, validates and previews, and it writes nothing.
    post,
    // **"The run this page started has finished"** (`plan:walk seq:120`).
    // `lib/command-actions.js` calls it once `POST /api/execute` has settled and
    // its outcome is drawn; the shell then redraws the screen the run was taken
    // on, moves the rail's counts with it, and carries the outcome region
    // across the redraw. See `noteExecuteSettled` for why this is a door a
    // screen opens rather than a hook inside `post()`.
    executeSettled: noteExecuteSettled,
    // **"A run this page started is under way"**, said before the POST rather
    // than after it. The pair's FIRST record is written before the command
    // runs, so without this the reader is offered a refresh for the act they
    // are in the middle of. See `executeInFlight`.
    executeStarted: () => { executeInFlight += 1; },
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
    // **Returns its own unsubscribe, and a screen that subscribes must call
    // it.** This used to answer `push`'s return value — an array length, which
    // nothing could do anything with — and there was no way to stop listening
    // at all. A screen module is imported once and its `render()` runs again on
    // every return to its route and on every live refresh, so the listeners
    // accumulated one per render: visit a screen three times and one session
    // change started three renders of it. `subscribeStream` already answers an
    // unsubscribe for the same reason; this is that contract, applied to the
    // other subscription a screen can hold.
    onSessionChange: (fn) => {
      sessionListeners.push(fn);
      return () => {
        const at = sessionListeners.indexOf(fn);
        if (at !== -1) sessionListeners.splice(at, 1);
      };
    },
    navigate: (hash) => { location.hash = hash; },
    // The app's ONE live region, reached through the shell contract rather
    // than by any caller knowing its id. See `announceRegion()` above for why
    // there is one and why it is not visible chrome.
    announce,
  };

  // The two grid rows the shell always reserved and never filled. Drawn before
  // the first data call so the 56px band never exists, not even for a frame.
  renderChrome();
  void fillChrome();
  // The strip's own live invalidation, armed HERE — beside the two calls that
  // build and fill it, and before the first call that can fail, for the same
  // reason the heartbeat and the nonce listener are: a page whose session read
  // was refused still has a strip, and a strip that never learns anything
  // moved is the state this exists to end. Once-ever; see `setupLiveChrome`.
  setupLiveChrome();

  // **THE RECOVERY PATH AND THE HEARTBEAT ARE INSTALLED BEFORE THE FIRST CALL
  // THAT CAN FAIL. That ordering is the whole fix; see below.**
  // The ping's answer was thrown away until `plan:live seq:12`; it now carries
  // `staleCode`, and this is the only channel that reaches a tab which has been
  // open since the morning. Still `.catch(() => {})`: a heartbeat that cannot
  // reach the server is `showExited()`'s business, raised by `api()` itself.
  //
  // **AND THE SESSION IT NAMES** (`plan:walk seq:124`). `occupancy` is the one
  // fact on this request that is session-scoped rather than workspace-scoped,
  // so the heartbeat has to say which session it is asking about; without the
  // parameter the server answers `null`, which is "nobody asked" and not a
  // reading. `currentSession()` is read on every tick rather than captured
  // once, because the reader can change sessions under this timer and a
  // heartbeat pinned to the session that was current at boot would keep the
  // strip live for a session nobody is looking at.
  //
  // **THE CADENCE IS STILL 60s, AND IT WAS RULED RATHER THAN INHERITED.**
  // The occupancy read is 0.32ms and would be affordable far faster — but
  // `measureCorpusDrift` rides this same request, and its once-a-minute budget
  // (6.24ms/min, measured against `fs.watch`'s 96-1,121ms/min) is the argument
  // that ruled out a watcher in the first place. Shortening this interval
  // multiplies that sweep for every visible tab; a second timer would be a
  // second cadence to keep in step. So the interval stands, and what makes 60s
  // enough is the pair above: the sample under it is rewritten once per
  // assistant message, and every age on the strip is recomputed at draw time.
  stopHeartbeat = startHeartbeat(
    document, () => api('/api/ping' + pingQuery()).then((answer) => {
      noteCodeSkew(answer);
      noteCorpusDrift(answer);
      noteOccupancy(answer);
    }).catch(() => {}), 60_000);
  installNonceRedemption();
  // **BEFORE `installItemPane()`, and the order is the contract.** Both install
  // a document-level `keydown`, listeners fire in registration order, and
  // `installItemPane`'s handler asks `popoverOpen()` whether this Escape was
  // already spent. Installed here rather than after `loadSessions()` for the
  // same reason the pane is: a reader whose session read was refused still has
  // a title bar, and a picker that only works on a healthy page is a picker
  // missing from every page where knowing the session matters most.
  installPopovers();
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
  // again — and `IdleMonitor` reaps a server that goes that long without one.
  // The lockout starved the timer that then killed the server, and the next
  // reload met a port with nothing behind it. One symptom, two layers, an idle
  // window apart — fifteen minutes when this happened, eight hours since the
  // 2026-08-23 ruling recorded in `ui/idle.ts`.
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
  // AFTER the session read and OUTSIDE the try, on both of its branches: the
  // context group's endpoint takes the session id as its only parameter, and a
  // session read that failed is a state that group DRAWS (`noCredential`)
  // rather than a reason to leave it empty. `void`, like `fillChrome()` above
  // — the strip may never hold up the router.
  void fillContext();

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
        // The context group was drawn with no credential and drew the unread
        // state; a redemption is exactly the event that makes it answerable.
        void fillContext();
      }
      await route();
    })();
  });
}

main();
