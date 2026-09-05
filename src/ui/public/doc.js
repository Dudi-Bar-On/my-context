/**
 * **The standalone rendered document page** — `DEC-the-documentation-and-
 * tutorials-screens-become-one-list-and`, owner ruling 2026-09-05.
 *
 * One document, rendered the way GitHub renders one, on a page of its own in a
 * tab of its own. The console lists; this reads.
 *
 * ── THE THREE THINGS THIS FILE OWNS ───────────────────────────────────────
 *
 *   1. **The address.** `?doc=<repo-relative id>` or `?tut=<manifest id>`, with
 *      an optional `&lang=he`. A query string and NOT a fragment, because the
 *      fragment on this page belongs to the document: `#the-five-tiers` lands
 *      on a heading exactly as it does on GitHub, which is the one address a
 *      reader most wants to be able to paste. `docHref` in
 *      `screens/library.js` is the only writer of these addresses and this is
 *      the only reader.
 *   2. **The credential.** Nothing is exchanged here — no nonce, no handoff.
 *      The `mycontext_token` cookie is `Path=/`, `HttpOnly`, `SameSite=Strict`
 *      (`security.ts`), and `validateApiRequest` accepts `header ?? cookie`, so
 *      a same-origin `fetch` from a tab the reader opened by clicking a link
 *      carries it. VERIFIED against the running server rather than assumed:
 *      `GET /api/doc` with only that cookie answers 200. `SameSite=Strict` is
 *      what makes that safe — the cookie is never attached to a request another
 *      site started, and `X-Frame-Options: DENY` keeps this page out of a
 *      frame.
 *   3. **The disclosure.** How many constructs the GitHub allow-list refused,
 *      how many attributes it dropped, how many links named something this
 *      server cannot open, and — always, refusals or none — the sentence that
 *      says byte-identical parity with GitHub is not claimed.
 *      `INV-nothing-is-dropped-silently` is why the counts are drawn even when
 *      they are zero: `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
 *      thing-is`.
 *   4. **The roster a link is checked against.** `GET /api/doc` — the same 190
 *      documents the Library's own list is drawn from — read in parallel with
 *      the document itself and handed to `githubNodes` as `openable`.
 *
 * ── NEVER A DEAD LINK, AND WHY THE ROSTER IS READ HERE ────────────────────
 *
 * `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`: *"if the
 * documents are refering other documents get them too or do not support the
 * link"*. The renderer enforces it (`decideLink` in `lib/markdown.js`), but it
 * cannot know two things from the markdown alone, and this page supplies both:
 *
 *   - **`base`** — the containing document's own directory, so a relative link
 *     resolves the way GitHub resolves it. `TUTORIAL.md` inside
 *     `docs/README.he.md` is `docs/TUTORIAL.md`; `../README.md` is `README.md`.
 *   - **`openable`** — every id `GET /api/doc/:id` will actually serve. The
 *     VIEWER opens any of the 190 markdown documents in the repository, while
 *     the Library's LIST shows only the READMEs and the tutorials. That is the
 *     ruling's own shape: every internal reference resolves, and nothing
 *     internal is put in front of a reader who did not follow a link to it.
 *
 * A roster that fails to read is NOT quietly treated as an empty one. Every
 * relative link then falls to plain text — the safe direction, since a
 * renderer that cannot check must not promise — and `gh.noroster` says on the
 * page that that is what happened.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 * No `innerHTML`, anywhere. No `eval`. No `Function`. Every node on this page
 * came out of `githubNodes`, which builds them with `createElement` and
 * `textContent`, having passed every raw tag and attribute through
 * `lib/sanitize.js`'s allow-list first. This server sends no
 * `Content-Security-Policy` (retired by owner decision 2026-08-22, and
 * `server-e2e.test.ts` asserts its absence), so that structural guarantee is
 * the only one there is — which is exactly why it is structural.
 *
 * It also renders no console chrome, opens no stream, and holds no session.
 * A reader who opened a document wants the document.
 */
import { applyLanguage, pickLanguage, t as translate, tFlat as flat } from '/lib/i18n.js';
import { githubNodes } from '/lib/markdown.js';

/**
 * The directory a relative link inside this document resolves against —
 * GitHub's rule, which is the containing file's own directory.
 *
 * For a `?doc=` address that is the id's own dirname, since the id IS the
 * repo-relative path. For a `?tut=` address it is not: a tutorial id is a
 * feature key (`narrowing-a-session-focus`), not a path. Rather than write
 * `docs/tutorials/` down here — a second copy of a fact
 * `docs/tutorials/manifest.json` already owns, and the kind of copy that goes
 * quietly wrong when a directory moves — the tutorial's FILE is found in the
 * document roster this page already holds, and its dirname is the answer.
 *
 * Exported and pure so `node --test` can measure it without a browser, the
 * same bargain `docAddress` and `endpointFor` make.
 */
export function baseDirFor(address, ids) {
  if (address.kind === 'doc') {
    const at = String(address.id).lastIndexOf('/');
    return at === -1 ? '' : String(address.id).slice(0, at);
  }
  if (address.kind !== 'tut' || ids === null) return '';
  const suffix = `/${address.id}${address.lang === 'he' ? '.he' : ''}.md`;
  for (const id of ids) {
    if (id.endsWith(suffix)) return id.slice(0, id.length - suffix.length);
  }
  return '';
}

/** The string table for the interface, loaded once. */
let table = null;

/** `t()` and `tFlat()`, bound to the loaded table — the same two functions
 *  every screen receives on `ctx`, spelled here because this page has no
 *  shell to hand them out. */
const t = (key, subs) => translate(table.strings, key, subs, document);
const tFlat = (key, subs) => flat(table.strings, key, subs);

/**
 * The document this URL addresses.
 *
 * Exported and taking the search string as an ARGUMENT so `node --test` can
 * measure the parse without a browser — the same bargain `githubNodes` makes
 * with `doc`. An address that names neither a document nor a tutorial returns
 * `kind: null`, which draws a refusal naming what IS served rather than
 * fetching something arbitrary.
 */
export function docAddress(search) {
  let params;
  try {
    params = new URLSearchParams(String(search ?? ''));
  } catch {
    return { kind: null, id: null, lang: 'en' };
  }
  const lang = params.get('lang') === 'he' ? 'he' : 'en';
  const doc = params.get('doc');
  if (doc !== null && doc !== '') return { kind: 'doc', id: doc, lang };
  const tut = params.get('tut');
  if (tut !== null && tut !== '') return { kind: 'tut', id: tut, lang };
  return { kind: null, id: null, lang };
}

/** The endpoint one address reads. The id is percent-encoded into ONE path
 *  segment, because a document id is a repo-relative path and carries `/`. */
export function endpointFor(address) {
  if (address.kind === 'doc') return `/api/doc/${encodeURIComponent(address.id)}`;
  if (address.kind === 'tut') {
    const base = `/api/tutorials/${encodeURIComponent(address.id)}`;
    return address.lang === 'he' ? `${base}?lang=he` : base;
  }
  return null;
}

/**
 * One read, with the cookie and nothing else.
 *
 * A refusal is thrown with the SERVER'S OWN WORDS where it sent any — its 404
 * names how many documents are in the manifest, which is worth more to a
 * reader than "not found".
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

/** A refusal drawn INTO the article, in the frame the app uses everywhere
 *  else: the product's words around the refusing party's own, unedited. */
function refusal(host, key, detail) {
  const wrap = document.createElement('div');
  const said = document.createElement('p');
  said.className = 'refusal';
  said.append(...t(key));
  wrap.append(said);
  if (detail !== undefined && detail !== null && detail !== '') {
    const pre = document.createElement('pre');
    pre.textContent = detail;
    wrap.append(pre);
  }
  host.replaceChildren(wrap);
}

async function main() {
  const language = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  table = await import(`/strings/${language}.js`);
  applyLanguage(document.documentElement, table);

  const back = document.getElementById('back');
  back.replaceChildren(...t('gh.back'));
  const article = document.getElementById('doc');
  const pathLine = document.getElementById('docpath');
  const stateLine = document.getElementById('docstate');
  const note = document.getElementById('docnote');
  const disclose = document.getElementById('docdisclose');
  const linkLine = document.getElementById('doclinks');
  const parity = document.getElementById('docparity');

  // **The roster, started BEFORE the document is read and awaited after it.**
  // Two reads that need nothing from each other should not be two round trips
  // in sequence. A refusal is caught into `null` rather than thrown: a roster
  // this page could not read must not take the document down with it — it
  // costs the relative links, and `gh.noroster` says so.
  const roster = readJson('/api/doc').then((body) => (
    body !== null && typeof body === 'object' && Array.isArray(body.documents)
      ? new Set(body.documents.map((entry) => entry.id))
      : null
  )).catch(() => null);

  // The parity sentence is drawn BEFORE the read and never removed: it is true
  // of every document on this page, including one that fails to load, and a
  // claim about the renderer should not depend on the renderer having run.
  parity.replaceChildren(...t('gh.parity'));

  const address = docAddress(location.search);
  if (address.kind === null) {
    document.title = tFlat('gh.notitle');
    pathLine.textContent = '';
    refusal(article, 'gh.noaddress');
    return;
  }

  pathLine.textContent = address.id;
  document.title = address.id;

  let body;
  // **The one fallback on this page, and it is LABELLED, which is the whole
  // difference between a fallback and a silent substitution.**
  //
  // `/api/tutorials/:id?lang=he` 404s when no Hebrew file exists, and the
  // roster cannot always tell: `apiTutorials` reports `he: 'todo'` BOTH for a
  // Hebrew file that is present and incomplete AND for one that was never
  // written. `screens/library.js` therefore only ever links `lang=he` for a
  // `done` row — but a pasted or hand-edited address can still ask for a
  // Hebrew text that is not there, and answering that with the server's raw
  // 404 tells a reader nothing they can act on. So the English is read
  // instead and `gh.enonly` says, on the page, that it is English.
  let fellBackToEnglish = false;
  try {
    body = await readJson(endpointFor(address));
  } catch (error) {
    if (address.kind !== 'tut' || address.lang !== 'he') {
      refusal(article, 'gh.unread', error.message);
      return;
    }
    try {
      body = await readJson(endpointFor({ ...address, lang: 'en' }));
      fellBackToEnglish = true;
      address.lang = 'en';
    } catch {
      // The English is not there either — the id names no tutorial at all, and
      // the FIRST refusal is the one worth showing: it is the one the reader's
      // own address produced.
      refusal(article, 'gh.unread', error.message);
      return;
    }
  }

  const title = typeof body.title === 'string' && body.title !== '' ? body.title : address.id;
  document.title = title;

  // **The document's own direction, which is not the interface's.** A Hebrew
  // reader opening an English document reads LTR prose under an RTL interface,
  // and vice versa. Deciding this from the SERVED document rather than from the
  // interface language is what keeps a mixed pair readable — and where a
  // tutorial has no Hebrew file, `gh.enonly` says the English text is English
  // rather than substituting it silently under a Hebrew heading.
  const hebrew = address.kind === 'doc'
    ? body.language === 'he'
    : address.lang === 'he';
  article.setAttribute('dir', hebrew ? 'rtl' : 'ltr');
  article.setAttribute('lang', hebrew ? 'he' : 'en');
  if (fellBackToEnglish || (language === 'he' && !hebrew)) {
    note.hidden = false;
    note.replaceChildren(...t('gh.enonly'));
  }

  if (address.kind === 'tut') {
    // `.tag`, this page's own quiet outline — NOT the console's `.chip`, whose
    // five meaning hues belong to a screen that makes verdicts. A document page
    // that reintroduced the console's chip vocabulary would be reintroducing
    // the console.
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.append(...t('lib.tuts'));
    stateLine.replaceChildren(tag);
  }

  const openable = await roster;
  const rendered = githubNodes(body.markdown, document, tFlat, {
    base: baseDirFor(address, openable),
    openable,
  });
  article.replaceChildren(...rendered.nodes);

  // The measured zero is DRAWN. `STD-a-measured-zero-is-drawn-and-named-an-
  // unmeasured-thing-is`: "no construct in this document is outside GitHub's
  // allow-list" is a measurement worth stating, and a page that only spoke up
  // when something was refused would leave a reader unable to tell a clean
  // document from a renderer that had stopped checking.
  //
  // **The link count is SPLIT OUT of the refusal count, and it has to be.**
  // `gh.refused` says the refused constructs "were refused and SHOWN as
  // refusals" — true of a tag outside the allow-list, which gets a labelled
  // box, and false of a link whose target cannot be opened, which is drawn as
  // ordinary text with no box at all. Counting the two together would make
  // that sentence a lie about half of what it counted.
  const undrawn = rendered.refusals.filter((why) => why === 'link target').length;
  const refused = rendered.refusals.length - undrawn;
  disclose.replaceChildren(...(refused === 0 && rendered.dropped.length === 0
    ? t('gh.clean')
    : t('gh.refused', { refused, dropped: rendered.dropped.length })));
  linkLine.replaceChildren(...(openable === null
    ? t('gh.noroster')
    : (undrawn === 0 ? t('gh.linksok') : t('gh.links', { links: undrawn }))));

  if (body.truncated === true) {
    const cut = document.createElement('p');
    cut.className = 'small';
    cut.append(...t('tu.trunc'));
    article.append(cut);
  }

  // The fragment is the document's, so it is honoured HERE — after the nodes
  // exist. The browser resolved `#…` against an empty page a moment ago and
  // found nothing; this is the same jump, once there is something to jump to.
  const anchor = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (anchor !== '') {
    const target = article.querySelector(`[id="${CSS.escape(anchor)}"]`);
    if (target !== null) target.scrollIntoView({ block: 'start' });
  }
}

main().catch((error) => {
  // A boot that throws must SAY so rather than leave a blank page — the same
  // rule the shell follows. There may be no string table at this point, so the
  // message is the error's own words and nothing is invented around them.
  const article = document.getElementById('doc');
  const said = document.createElement('p');
  said.className = 'refusal';
  said.textContent = error instanceof Error ? error.message : String(error);
  if (article !== null) article.replaceChildren(said);
});
