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
};
// FOUR groups, by TENSE, in the mockup's own order. `watch` and `ask` join
// nav.ev (plan 3); `work`, `capture`, `palette`, `config` join nav.ch (plan
// 2). `docs` and `tut` belong to nav.read and are unassigned (§0.4). A group
// with nothing in it yet renders as nothing (renderNav below), not as a bare
// heading — nav.ch is empty until plan 2 lands.
const NAV = [
  ['nav.inj', ['preview', 'coverage', 'gaps', 'simulate', 'injected']],
  ['nav.ev', ['doctor', 'decay', 'graph', 'status']],
  ['nav.ch', []],
  ['nav.read', ['learn']],
];

let token = null;

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

async function api(path) {
  let response;
  try {
    response = await fetch(path, { headers: { 'X-Mycontext-Token': token } });
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
  }
  if (!response.ok) {
    // A refusal from the security gate carries the STATUS AND NOTHING ELSE
    // (Task 13, ruling A4): there is no body, so this must not assume one —
    // response.json() on an empty body throws, and it would throw HERE,
    // outside the catch above, turning a clean 403 into a mystery. Other
    // failures (an unknown route, a handler error) still answer a JSON
    // `error`, so read a body only when there IS one.
    const raw = await response.text();
    let detail = '';
    if (raw !== '') { try { detail = String(JSON.parse(raw).error ?? ''); } catch { detail = ''; } }
    throw new Error(detail === '' ? String(response.status) : detail);
  }
  return await response.json();
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

function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren();               // never innerHTML — see i18n above
  for (const [groupKey, names] of NAV) {
    if (names.length === 0) continue;
    const group = document.createElement('div');
    group.className = 'grp';
    const label = document.createElement('p');
    label.append(...translate(table.strings, groupKey));
    group.append(label);
    for (const name of names) {
      const a = document.createElement('a');
      a.href = `#/${name}`;
      // The RAIL LABEL, from the string table — `s.<name>` — not the route
      // name. `preview` is a URL; "Injection preview" is the product's word
      // for it, and it has a Hebrew pair.
      a.append(...translate(table.strings, `s.${name}`));
      // `.nav` is the mockup's own rail-link class (`.nav[aria-current=
      // "page"]`, docs/design/web-ui-mockup.html ~459) — not styled by
      // Task 16's own stylesheet (out of the primitives/utility scope this
      // task ships; see styles.css's header), but the class and the
      // aria-current attribute are the accessibility-load-bearing part, and
      // both are set unconditionally so a later task's CSS lands on the
      // right hook without a app.js change.
      a.className = 'nav';
      if (location.hash === `#/${name}`) a.setAttribute('aria-current', 'page');
      group.append(a);
    }
    nav.append(group);
  }
}

async function route() {
  // Decision 5: the landing screen is the injection preview, at
  // event=session-start on the most recent session, rendering with no
  // input. NOT 'status' — that screen is built by Task 19 and deferred to
  // wave 3 ("Corrected 2026-08-20", plan Task 16 note).
  const name = (location.hash.replace(/^#\//, '') || 'preview');
  const loader = SCREENS[name] || SCREENS.preview;
  renderNav();
  const root = document.getElementById('screen');
  // No string-table key exists yet for a transient loading state (checked:
  // neither the mockup nor the string tables declare one) — inventing an
  // untranslated string here would be exactly the defect this shell's i18n
  // discipline exists to prevent, so the screen is simply cleared while the
  // dynamic import resolves rather than shown a placeholder. Open question,
  // this task's report.
  root.replaceChildren();
  const mod = await loader();
  await mod.render(root, window.myctx);
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
  if (token === null) {
    showExited();
    return;
  }

  window.myctx = {
    api,
    // Nodes. Screens append: `el.append(...ctx.t(key, vals))`. The flattened
    // form is a SEPARATE call, so reaching for it is a visible decision.
    t: (key, subs) => translate(table.strings, key, subs),
    tFlat: (key, subs) => flat(table.strings, key, subs),
    session: currentSession,
    onSessionChange: (fn) => sessionListeners.push(fn),
    navigate: (hash) => { location.hash = hash; },
  };

  await loadSessions();
  stopHeartbeat = startHeartbeat(document, () => api('/api/ping').catch(() => {}), 60_000);
  window.addEventListener('hashchange', route);
  await route();
}

main();
