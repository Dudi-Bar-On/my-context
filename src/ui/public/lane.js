/**
 * **THE BARE LANE WINDOW'S BOOT** — `plan:archive seq:51`.
 *
 * One helper agent's transcript, in a window with nothing of the application
 * around it. Owner ruling 2026-09-09: *"what i meant is to only see the viewer
 * with the transcript in it as a single window without all the app arround
 * it"* — and, taken the same day after both alternatives were declined, **only
 * a LANE opens this way; his own SESSION keeps the rail, the strip and the
 * header exactly as before.**
 *
 * ── THE FOUR THINGS THIS FILE OWNS, AND IT OWNS NOTHING ELSE ─────────────
 *
 *   1. **The address.** `?id=<agentId>`. A query string and not a fragment,
 *      for `doc.html`'s reason: a fragment on a viewer page is not the shell
 *      router's to spend, and a query is the form of this address a reader can
 *      copy. `laneHref` in `screens/conversations.js` is the only writer of it
 *      and this is the only reader.
 *   2. **The credential.** Nothing is exchanged here — no nonce, no handoff.
 *      The `mycontext_token` cookie is `Path=/`, `HttpOnly`, `SameSite=Strict`
 *      (`ui/security.ts`) and `validateApiRequest` accepts `header ?? cookie`,
 *      so a same-origin `fetch` from a tab the reader opened by clicking a
 *      link carries it. `doc.js` already runs on exactly this bargain and
 *      records the verification against a running server.
 *   3. **The read model's own answer to "what is this".** The outline is
 *      fetched before anything is drawn, and `source === 'subagent'` — which
 *      is `subagentAsRow`'s honest answer and not a guess from the id — is
 *      what decides whether this page draws at all. **A SESSION IS HANDED
 *      BACK TO THE APP**, `location.replace`d to `/#/conversations/<id>`, so
 *      a hand-typed or stale bare address can never take his instruments away
 *      from him. That is the ruling's "the shape follows from WHAT is being
 *      opened" spent rather than restated: no mode, no preference, no
 *      parameter that selects a shape.
 *   4. **The four-field `ctx`.** `t`, `tFlat`, `api` and `navigate` are
 *      everything `mountDocument` and its subtree reach for — measured over
 *      the file, and the one caller that wants more (`commandActions`, in the
 *      secrets fold) is drawn on a session and never on a lane. So this page
 *      hands over four functions and imports the viewer whole.
 *
 * ── WHAT IS DELIBERATELY NOT FORKED ──────────────────────────────────────
 *
 * The renderer, and everything `seq:7` through `seq:50` built with it: the
 * virtualised scroll, the byte-offset windowing, the landing at the end, the
 * follow timer, the folds, the copy bar, the lane links and the agent type.
 * `mountDocument` is imported from `screens/conversations.js` and called. A
 * page that reimplemented any of that would be a second viewer, which is what
 * `seq:15` refused and what `rowFor` exists to prevent — and it is exactly the
 * trap `/doc.html` sets, since that page is drawn by `githubNodes` and this
 * content is drawn by `markdownNodes`.
 *
 * ── AND THE PROVENANCE SURVIVES THE CHROME ───────────────────────────────
 *
 * What he asked to lose is the application, not the answer to "which lane is
 * this and how do I get back". `mountDocument` already draws `p.tvlaneof` and
 * `a.tvlanehome` on any document whose source is `subagent`, and `seq:40`'s
 * `button.tvlaneshut` is drawn here for the first time in the tab it was
 * written for: this window's `history.length` really is 1.
 *
 * ── i18n AND THE THEME ───────────────────────────────────────────────────
 *
 * Both string tables are loaded here and `applyLanguage` sets `lang`/`dir` on
 * the first frame, so an RTL reader gets an RTL window rather than English
 * drawn into one. The stored choice is shared with the app because
 * `localStorage` is per-origin — the same bargain `doc.js` makes, and the
 * reason this page carries no א/A control of its own: a toggle is chrome, and
 * chrome is what this window exists to be without.
 */
import { applyLanguage, pickLanguage, t as translate, tFlat as flat } from '/lib/i18n.js';
import { el, errorNote } from '/screens/parts.js';
import { laneIndex, mountDocument, sessionHref } from '/screens/conversations.js';

/** The string table for the interface, loaded once. */
let table = null;

/**
 * The lane this URL addresses, or `null` for an address that names none.
 *
 * Exported and taking the search string as an ARGUMENT so `node --test` can
 * measure the parse without a browser — the same bargain `doc.js`' `docAddress`
 * and `screens/conversations.js`' `sessionFromHash` both make.
 */
export function laneFromSearch(search) {
  let params;
  try {
    params = new URLSearchParams(String(search ?? ''));
  } catch {
    return null;
  }
  const id = params.get('id');
  return id === null || id === '' ? null : id;
}

/**
 * One read, with the cookie and nothing else — `doc.js`' `readJson`, and
 * deliberately the same shape: a refusal is thrown with the SERVER'S OWN words
 * where it sent any, because its 404 names what it does hold and that is worth
 * more to a reader than a status number.
 *
 * **It is NOT `app.js`' `request()`**, and that is a real difference rather
 * than an oversight. That function owns the shell's disconnected banner, its
 * token memory and its skew latch — three pieces of state this page has none
 * of and must not pretend to. A window with one document in it says its
 * refusals in the document, which is what `errorNote` below does.
 */
async function readJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const said = body !== null && typeof body === 'object' && typeof body.error === 'string'
      ? body.error
      : `${response.status}`;
    throw new Error(said);
  }
  return body;
}

/**
 * The screen contract, minus everything a window with no shell cannot honour.
 *
 * `navigate` is the one that changes meaning here. In the app it moves the
 * hash and the router redraws `#screen`; on this page there is no router, so a
 * hash address is resolved against the ROOT and the window goes to the
 * application. That is honest: `conv.back` and the roster control both lead
 * out of this window by design, and the ways back that stay in it —
 * `a.tvlanehome`'s new tab and `button.tvlaneshut` — are drawn beside them.
 */
const ctx = {
  t: (key, subs) => translate(table.strings, key, subs, document),
  tFlat: (key, subs) => flat(table.strings, key, subs),
  api: (path) => readJson(path),
  navigate: (hash) => { window.location.assign(new URL(String(hash), `${window.location.origin}/`).href); },
  get lang() { return table === null ? 'en' : table.lang; },
};

/** `errorNote`'s default second argument is `globalThis.myctx`; this is it. */
globalThis.myctx = ctx;

async function main() {
  let language = 'en';
  try {
    language = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  } catch {
    // Private mode refuses `localStorage`. The navigator still answers, and a
    // window that threw here would be blank rather than merely English.
    language = pickLanguage(null, navigator.language);
  }
  table = await import(`/strings/${language}.js`);
  applyLanguage(document.documentElement, table);

  const host = document.getElementById('lane');
  const viewer = el('section', 'tvroot');
  host.replaceChildren(viewer);

  const id = laneFromSearch(window.location.search);
  if (id === null) {
    // Not a throw and not a blank page: an address that names no lane is a
    // fact about the address, said where a reader is looking.
    // `INV-nothing-is-dropped-silently`.
    //
    // Drawn directly rather than through `errorNote`, and the difference
    // matters: that helper wraps its argument in `err.note` — *"the wording is
    // the system's own and is not translated"* — which would be a false claim
    // about a sentence this product wrote and translated into both tables.
    // `errorNote` is kept for the refusals below, which really are the
    // server's own words.
    const said = el('p', 'small spill');
    said.append(...ctx.t('conv.doc.noLane'));
    viewer.append(said);
    return;
  }

  // **The roster, started BEFORE the outline and awaited after it** — the
  // shape `render()` uses in the app and for the same two reasons. Two reads
  // that need nothing from each other should not be two round trips in
  // sequence; and a refusal is caught into "not read" rather than thrown,
  // because a roster this page could not fetch must not take the document down
  // with it. `conv.doc.lanesUnread` says so on the page.
  const lanes = ctx.api(`/api/conversations/${encodeURIComponent(id)}/subagents`)
    .then((body) => laneIndex(body))
    .catch(() => laneIndex(null));

  let outline;
  try {
    outline = await ctx.api(`/api/conversations/${encodeURIComponent(id)}/outline`);
  } catch (error) {
    viewer.append(errorNote(error.message, ctx));
    return;
  }

  // **THE READ MODEL DECIDES THE SHAPE, NOT THE ADDRESS.** `rowFor` resolves a
  // session, a lane or a kept copy, and `source` is its answer. A session
  // reached here — a hand-typed address, a link from before this landed, a
  // bookmark — is handed back to the application rather than drawn in a window
  // with no strip and no rail, because that is where he works.
  //
  // `replace` and not `assign`: this window has shown nothing yet, so leaving
  // a history entry for a page that only ever redirected would give Back a
  // step that immediately redirects again.
  if (outline.source !== 'subagent') {
    window.location.replace(sessionHref(id));
    return;
  }

  // **THE TAB SAYS WHICH LANE IT IS**, and it says it in the lane's own
  // recorded words — the brief the dispatcher typed, or the id when none was
  // recorded. Nothing is composed around it: a title is the one string on this
  // page a reader meets outside the document, and inventing product prose for
  // it would be an untranslated sentence in the one place the א/A choice
  // cannot reach. A reader with four lane windows open can tell them apart.
  if (typeof outline.title === 'string' && outline.title !== '') document.title = outline.title;
  else document.title = outline.sessionId;

  /**
   * **AND THE POINT INSIDE IT, WHEN AN ANCHOR SENT THE READER HERE** —
   * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`,
   * capability 4.
   *
   * `?at=<byte>` rides beside `?id=`, in the same query string and for the
   * same reason the id is one: a fragment on a viewer page is not the shell
   * router's to spend, and a query is the form of this address a reader can
   * copy. `anchorHref` in `screens/conversations.js` is the only writer of it
   * and this is the only reader — the same split `laneHref` already has.
   *
   * An unreadable value is `null` and the document opens where it always
   * does. A hand-edited address is not a reason to refuse a lane.
   */
  const asked = new URLSearchParams(window.location.search).get('at');
  const at = asked !== null && /^\d+$/.test(asked) ? Number(asked) : null;
  mountDocument(ctx, viewer, outline, () => { ctx.navigate('#/conversations'); },
    await lanes, at);
}

main().catch((error) => {
  // A boot that throws must SAY so rather than leave a blank page — the rule
  // `doc.js` follows for the same reason. There may be no string table at this
  // point, so the message is the error's own words with nothing invented
  // around them.
  const host = document.getElementById('lane');
  const said = document.createElement('p');
  said.className = 'small spill';
  said.textContent = error instanceof Error ? error.message : String(error);
  if (host !== null) host.replaceChildren(said);
});
