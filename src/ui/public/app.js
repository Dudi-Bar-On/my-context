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
    // Only send the header when there is something to send. A null token
    // stringifies to the literal "null" in a header, which the gate reads as a
    // WRONG token (403) rather than an absent one — and a 403 would mask the
    // cookie, which is the credential a reloaded page actually has.
    response = await fetch(path, {
      headers: token === null ? {} : { 'X-Mycontext-Token': token },
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
      // a body is read only when there is one — `.json()` on an empty body
      // throws, and it would throw here rather than at the caller.
      const raw = await response.text();
      let detail = '';
      if (raw !== '') { try { detail = String(JSON.parse(raw).error ?? ''); } catch { detail = ''; } }
      onEvent('fault', { error: detail === '' ? String(response.status) : detail });
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
