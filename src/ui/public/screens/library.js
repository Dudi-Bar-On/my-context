/**
 * `nav.read` — **Library**: the ONE console page that replaces the
 * Documentation and Tutorials screens.
 *
 * ── THE RULING THIS FILE IS ───────────────────────────────────────────────
 *
 * `DEC-the-documentation-and-tutorials-screens-become-one-list-and`, owner
 * ruling of 2026-09-05, taken after the Documentation screen was built wrong
 * twice and the Tutorials screen once:
 *
 *   *"One console page replaces both screens. It lists every document and
 *   tutorial BY TITLE, never by file path, with the measured EN/HE state
 *   beside each. Opening one opens a RENDERED page in a new browser tab. The
 *   console stops trying to be a documentation site."*
 *
 * So this screen READS NO MARKDOWN. It imports no renderer, draws no document
 * body, and has no reader inside it. `/doc.html` is where a document is read,
 * and it is a page of its own in a tab of its own.
 *
 * Five items were cancelled unbuilt by the same ruling — `docsys/5`, `/6`,
 * `/9`, `/10` and `tuts/4`. What survives of them is here: the manifest-driven
 * roster, and the mirror state read off disk on every request. What does not
 * is the picker-plus-reader shape, the heading index, and the deep link into a
 * heading from inside the console. The ruling states that trade rather than
 * leaving it to be discovered: a new tab leaves the console, so there is no
 * deep link from a screen into a heading, and no cross-linking from a document
 * to a corpus item. That is Learn's job, and Learn is untouched.
 *
 * ── INSTRUCTION 2: A ROW IS NAMED BY ITS TITLE ────────────────────────────
 *
 * *"do not display the full path file names but what they contain title"* —
 * `docs/tutorials/injection-tiers.md` tells a reader nothing they wanted to
 * know. Every row here is `entry.title`, which the server derives in
 * `docTitle` from the document's own first `#` heading and falls back to the
 * filename only where there is none. Measured across all 190 documents this
 * manifest serves: ZERO fall back to a filename, and none has an empty title.
 * So no path is displayed anywhere on this screen — not as a label, not as a
 * tooltip, not beside the title in a small monospace span, which is what the
 * screen this replaces did. The path is shown on the DOCUMENT's own page,
 * where GitHub shows it too, and nowhere else.
 *
 * The filter matches what is DISPLAYED and nothing else, for the same reason:
 * a filter that silently matched a hidden path would make the list respond to
 * text no reader can see.
 *
 * ── INSTRUCTION 3: AN ENTRY IS NOT AN ORDINARY LINK ───────────────────────
 *
 * *"change the style of the links in the new page either use a button or other
 * way becase the link style is not looking good"*. Every entry is the `.row`
 * PRIMITIVE — the mockup's own actionable row, the one primitive that moves on
 * hover, already spent on exactly this job by the session and focus dialogs —
 * carrying the sprite's `#i-open` glyph to say where it goes. `.docrow` adds
 * only the two things `.row` cannot know: `text-decoration:none` (it was
 * written for `<button>`, and these are anchors, because a middle-click and a
 * "copy link" are things a reader expects of something that opens a tab) and
 * the card-role accent.
 *
 * The card-role system (`styles.css`, "CARD ROLES") is reused rather than
 * extended, which the ruling asks for in as many words: *"the card-role system
 * landed the same day and has the vocabulary."* Tutorials is `nav` (teal —
 * wayfinding, where a reader starts), Documents is `content` (violet — the
 * reading surface).
 */
import { el, errorNote, openIcon, screenHead, spaced } from '/screens/parts.js';

/**
 * How many document rows are drawn at once. 190 documents is more than one
 * card should render and far more than a reader scans, so the list is BOUNDED
 * and SAYS SO (`lib.shown`), with the filter above it as the way past the
 * bound. Not a scroll box: a bound a reader can see the size of is the
 * disclosure `INV-nothing-is-dropped-silently` asks for, and a scrollbar is
 * not one. The tutorials are 24 and are drawn whole.
 */
const DOC_LIMIT = 30;

/** The two tiers, in the order they are drawn, with the heading key each one
 *  carries. Taken unchanged from the screen this replaces: "basic and
 *  advanced" is the owner's own split and `tier` is a field of every manifest
 *  entry, so this array carries the ORDER and the KEYS only, never a roster. */
const TIERS = [
  { tier: 'basic', key: 'tu.basic' },
  { tier: 'advanced', key: 'tu.adv' },
];

/** The three states a tutorial's language cell can be in — the endpoint's own
 *  vocabulary, unchanged by this rebuild so that a reader who learned the
 *  chips on the Tutorials screen reads the same three here. */
const DONE = 'done';
const TODO = 'todo';
const UNMEASURED = 'unmeasured';

/**
 * The address of the standalone rendered page.
 *
 * A QUERY STRING and not a fragment, deliberately: the fragment on that page
 * belongs to the DOCUMENT, so `#the-five-tiers` lands on a heading exactly as
 * it does on GitHub. Putting the document id there instead would have taken
 * the one address a reader most wants to be able to paste.
 *
 * Exported and pure so `node --test` can measure it without a browser — the
 * same bargain every parse in this app makes.
 */
export function docHref(kind, id, lang) {
  const key = kind === 'tut' ? 'tut' : 'doc';
  const base = `/doc.html?${key}=${encodeURIComponent(id)}`;
  return lang === 'he' ? `${base}&lang=he` : base;
}

/** ✅ where a Hebrew mirror exists, and the "to write" chip where it does not
 *  — never a blank cell. The `title` carries the sentence, because a bare
 *  glyph beside a title is not a statement anyone can read. */
function mirrorMark(ctx, hasMirror) {
  if (hasMirror) {
    const yes = el('span', 'lang ok', '✅');
    yes.title = ctx.tFlat('dv.heyes');
    return yes;
  }
  const chip = el('span', 'chip warn');
  chip.dataset.g = '▲';
  chip.title = ctx.tFlat('dv.heno');
  chip.append(...ctx.t('tu.todo'));
  return chip;
}

/** One tutorial's EN or HE cell. An unknown state THROWS rather than drawing
 *  one of three false statements over a fourth answer the endpoint never
 *  sends — the same rule `t()` follows for a key it cannot find. */
function langMark(ctx, state, label) {
  if (state === DONE) {
    const yes = el('span', 'lang ok', `${label} ✅`);
    yes.title = ctx.tFlat('tu.donemeans');
    return yes;
  }
  if (state === TODO) {
    const chip = el('span', 'chip warn');
    chip.dataset.g = '▲';
    chip.append(`${label} `, ...ctx.t('tu.todo'));
    return chip;
  }
  if (state === UNMEASURED) {
    const chip = el('span', 'chip unmeas');
    chip.dataset.g = '◌';
    chip.append(`${label} `, ...ctx.t('strip.unmeasured'));
    return chip;
  }
  throw new Error(`library: unknown language state: ${String(state)}`);
}

/**
 * One entry: the `.row` primitive as an anchor that opens a new tab.
 *
 * `target="_blank"` is the ruling's own instruction. `rel="noopener"` is
 * belt-and-braces on a same-origin page — the new tab could reach back through
 * `window.opener` and there is no reason it ever should.
 *
 * **The token travels by cookie and needs no second nonce.** `mycontext_token`
 * is `Path=/`, `HttpOnly`, `SameSite=Strict` (`security.ts`), and Strict
 * attaches a cookie to a same-site navigation the user started — which is what
 * a click on this anchor is. Verified against the running server rather than
 * assumed.
 */
function entryRow(ctx, { href, title, marks }) {
  const row = el('a', 'row docrow');
  row.href = href;
  row.target = '_blank';
  row.rel = 'noopener';
  const label = el('span', 'docname', title);
  const tail = el('span', 'docmarks');
  for (const mark of marks) tail.append(mark);
  row.append(label, tail, openIcon());
  return row;
}

/** The tutorials half: one card per tier, in the manifest's own order. */
function paintTutorials(ctx, host, body) {
  const rollup = el('p', 'small');
  rollup.append(...ctx.t('tu.rollup', {
    done: body.heRollup.done, total: body.heRollup.total,
  }));
  host.append(rollup);

  if (body.tutorials.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('tu.none'));
    host.append(none);
    return;
  }

  for (const { tier, key } of TIERS) {
    const rows = body.tutorials.filter((row) => row.tier === tier);
    // A tier with no rows draws no heading: an empty "Advanced" band would be
    // a claim the manifest does not support.
    if (rows.length === 0) continue;
    const heading = el('p', 'welllabel');
    heading.append(...ctx.t(key));
    host.append(heading);
    const list = el('div', 'rows');
    for (const row of rows) {
      if (row.en === UNMEASURED) {
        // Nothing to open. A link to a document that does not exist is worse
        // than no link: it promises a read and answers a refusal. So the row
        // is drawn — the roster is the whole roster — and it is not a link.
        const dead = el('div', 'row docrow dead');
        const marks = el('span', 'docmarks');
        marks.append(langMark(ctx, row.en, 'EN'), ' ', langMark(ctx, row.he, 'HE'));
        dead.append(el('span', 'docname', row.title), marks);
        list.append(dead);
        continue;
      }
      // The Hebrew text is asked for only where the row's own measured state
      // says a Hebrew file EXISTS, which is `done` and only `done`. Where it
      // does not, the English text opens and the document page LABELS it as
      // English — never the silent substitution the spec forbids.
      //
      // **`todo` is deliberately not enough, and the screen this replaces had
      // that wrong.** `apiTutorials` derives the HE cell as: absent English →
      // `unmeasured`; a Hebrew file present → `done` or `todo` on its four
      // required headings; **no Hebrew file but English present → `todo`**.
      // So `todo` conflates "written and incomplete" with "not written at
      // all", and `screens/tut.js`'s `row.he !== UNMEASURED` therefore asked
      // for `?lang=he` on a tutorial with no Hebrew file and took the
      // endpoint's 404. Measured 2026-09-05 on `narrowing-a-session-focus`
      // (`he: 'todo'`, no file): `GET /api/tutorials/narrowing-a-session-focus
      // ?lang=he` answers 404. `doc.js` also falls back — labelled — for a
      // pasted address, so neither route can produce that refusal.
      const wantHebrew = ctx.lang === 'he' && row.he === DONE;
      list.append(entryRow(ctx, {
        href: docHref('tut', row.id, wantHebrew ? 'he' : 'en'),
        title: row.title,
        marks: [langMark(ctx, row.en, 'EN'), ' ', langMark(ctx, row.he, 'HE')],
      }));
    }
    host.append(list);
  }
}

/** The documents half: the manifest, filtered by title and bounded. */
function paintDocuments(ctx, host, list) {
  const documents = list.documents;

  // **THE HEBREW NUMBER IS COUNTED, NEVER WRITTEN DOWN.** Every entry's
  // `hasHebrewMirror` was read off the disk by the server on THIS request, so
  // this line rises on its own the day a mirror is written.
  const mirrors = documents.filter((entry) => entry.hasHebrewMirror).length;
  const mirrorLine = el('p', 'small');
  mirrorLine.append(...ctx.t('dv.hemirror', { done: mirrors, total: documents.length }));
  host.append(mirrorLine);

  const filter = el('input', 'small');
  filter.type = 'search';
  filter.setAttribute('placeholder', ctx.tFlat('lib.filter'));
  filter.setAttribute('aria-label', ctx.tFlat('lib.filter'));
  host.append(filter);

  const rows = el('div', 'rows');
  const shown = el('p', 'small');
  host.append(rows, shown);
  if (list.truncated === true) {
    const cut = el('p', 'small');
    cut.append(...ctx.t('dv.trunc'));
    host.append(cut);
  }

  /** Redraw for the current filter. Only these two elements are rebuilt:
   *  filtering is a reading aid, not a route, so it neither navigates nor
   *  refetches. */
  const paint = () => {
    const needle = filter.value.trim().toLowerCase();
    const matched = needle === ''
      ? documents
      : documents.filter((entry) => entry.title.toLowerCase().includes(needle));
    rows.replaceChildren();
    shown.replaceChildren();
    if (matched.length === 0) {
      shown.append(...ctx.t('lib.nomatch'));
      return;
    }
    for (const entry of matched.slice(0, DOC_LIMIT)) {
      rows.append(entryRow(ctx, {
        href: docHref('doc', entry.id, entry.language === 'he' ? 'he' : 'en'),
        title: entry.title,
        marks: [mirrorMark(ctx, entry.hasHebrewMirror)],
      }));
    }
    shown.append(...ctx.t('lib.shown', {
      shown: Math.min(matched.length, DOC_LIMIT), total: documents.length,
    }));
  };
  filter.addEventListener('input', paint);
  paint();
}

/**
 * The screen. Both endpoints are read before either card is drawn, and each
 * card holds its own refusal: a Tutorials endpoint that refuses must not take
 * the Documents list down with it, and the reverse.
 */
export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'lib.h', 'lib.v', 'lib.sub');

  const two = el('div', 'two align-top');
  root.append(two);

  const tuts = el('div', 'card pane');
  tuts.dataset.role = 'nav';
  const docs = el('div', 'card pane');
  docs.dataset.role = 'content';
  // Both cards are in the DOM before either fetch, so the screen's composition
  // is the same shape whether a read answers, refuses or is still in flight.
  two.append(tuts, docs);

  const tutHead = el('h3');
  tutHead.append(...ctx.t('lib.tuts'));
  tuts.append(tutHead);
  const docHead = el('h3');
  docHead.append(...ctx.t('lib.docs'));
  docs.append(docHead);

  const [tutBody, docBody] = await Promise.all([
    ctx.api('/api/tutorials').then((b) => {
      if (b === null || typeof b !== 'object' || !Array.isArray(b.tutorials)
        || b.heRollup === null || typeof b.heRollup !== 'object'
        || typeof b.heRollup.done !== 'number' || typeof b.heRollup.total !== 'number') {
        throw new Error('library: /api/tutorials answered without a tutorials array and a heRollup');
      }
      return b;
    }).catch((error) => error),
    ctx.api('/api/doc').then((b) => {
      if (b === null || typeof b !== 'object' || !Array.isArray(b.documents)) {
        throw new Error('library: /api/doc answered without a documents array');
      }
      return b;
    }).catch((error) => error),
  ]);

  if (tutBody instanceof Error) tuts.append(errorNote(tutBody.message));
  else paintTutorials(ctx, tuts, tutBody);
  if (docBody instanceof Error) docs.append(errorNote(docBody.message));
  else paintDocuments(ctx, docs, docBody);

  // What opening a row does, and how the page it opens renders — said on the
  // screen rather than only in this file's header, because a reader of the
  // list is exactly the person who needs to know a tab is about to open and
  // what it will look like when it does.
  const notes = el('div', 'card pane');
  const tab = el('p', 'small');
  tab.append(...ctx.t('lib.newtab'));
  const like = el('p', 'small');
  like.append(...ctx.t('lib.github'));
  notes.append(tab, spaced(like));
  root.append(notes);
}
