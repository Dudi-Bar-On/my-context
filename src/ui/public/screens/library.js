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
 * ── AND WHAT IT LISTS WAS NARROWED THE SAME DAY ───────────────────────────
 *
 * `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`, taken
 * after the first build of this screen was reviewed: *"the two READMEs and the
 * tutorials — what a reader reads — not 166 internal specs, plans and
 * reports"*. "every document" above was read as "every markdown file the
 * manifest carries", and 190 rows of working documents is not a library.
 *
 * The narrowing is of the LIST and not of the viewer, which is the ruling's
 * own shape and the reason it costs nothing: `/doc.html` still opens any of
 * the 190, so a link from the README to `docs/ROADMAP.md` resolves and a link
 * from a spec to a report resolves, while nothing internal is put in front of
 * a reader who did not follow a link to it. `lib.only` states the size of what
 * is unlisted, on the screen.
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
import { paintCliHelp } from '/screens/cli-help.js';
import { el, errorNote, openIcon, screenHead, spaced } from '/screens/parts.js';
// The DATA half of the Coverage tree, and only the data half: `buildTree`
// takes a flat file list, knows nothing about scope, and returns a genuinely
// nested structure. `treeRows` — which flattens that structure back into a
// linear array of depth-carrying rows — is deliberately not imported; see the
// corpus browser's own section header for why.
import { buildTree } from '/lib/viewmodel.js';
// `/lib/wa-tree.js` is imported by `registerTree()` below, DYNAMICALLY and
// once, rather than statically here — see that function for the reason.

/**
 * **The document each surface offers, and it is one document per surface.**
 *
 * `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`, owner
 * ruling of 2026-09-05, after this screen was found listing 190 documents:
 * *"the two READMEs and the tutorials — what a reader reads — not 166 internal
 * specs, plans and reports"*, and on the language: *"English console offers
 * README.md; Hebrew console offers docs/README.he.md. Each surface offers its
 * own document rather than one with a language switch bolted on."*
 *
 * So this is a map from the INTERFACE language to the document that surface
 * offers, and it is the whole roster of the Documents card. It is written down
 * here rather than derived because it is a RULING and not a measurement: the
 * manifest cannot tell you which of the 190 documents a reader is meant to
 * start from, and a rule that guessed — "everything named README" — would put
 * a new `reports/README.md` in front of a reader the day somebody wrote one.
 *
 * The other 188 are not hidden, they are UNLISTED: `/doc.html` opens any id in
 * the manifest, so every reference from one document to another still
 * resolves. `lib.only` says so on the screen, because a list that silently
 * dropped 188 rows would be exactly the drop
 * `INV-nothing-is-dropped-silently` forbids.
 */
const README_FOR = { en: 'README.md', he: 'docs/README.he.md' };

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

/**
 * The documents half: THIS SURFACE'S README, and the count of what is not
 * listed.
 *
 * There is no filter and no `lib.shown` bound any more, and their absence is
 * the change rather than an omission: both existed to make 190 rows navigable,
 * and a card holding one row needs neither. What replaces them is `lib.only`,
 * which states the size of what is NOT here — the disclosure the bound used to
 * carry, now carried by a sentence a reader can act on.
 *
 * The README is LOOKED UP in the manifest rather than assumed present: if the
 * id this surface offers is not in what the server served, the card says the
 * roster holds nothing for it instead of drawing a row that opens a 404.
 */
function paintDocuments(ctx, host, list) {
  const documents = list.documents;
  const wanted = README_FOR[ctx.lang] ?? README_FOR.en;
  const entry = documents.find((row) => row.id === wanted);

  const rows = el('div', 'rows');
  host.append(rows);
  if (entry === undefined) {
    rows.append(...ctx.t('lib.nomatch'));
  } else {
    rows.append(entryRow(ctx, {
      href: docHref('doc', entry.id, entry.language === 'he' ? 'he' : 'en'),
      title: entry.title,
      // `hasHebrewMirror` is read off the disk by the server on THIS request,
      // so the mark rises on its own the day a mirror is written — it is never
      // a number written down here.
      marks: [mirrorMark(ctx, entry.hasHebrewMirror)],
    }));
  }

  // **THE UNLISTED ARE COUNTED, NOT HIDDEN.** `documents.length` is the whole
  // manifest as the server just served it, so this number is measured on every
  // paint and cannot drift from what `/doc.html` will actually open.
  const only = el('p', 'small');
  only.append(...ctx.t('lib.only', {
    rest: Math.max(documents.length - (entry === undefined ? 0 : 1), 0),
  }));
  host.append(only);

  if (list.truncated === true) {
    const cut = el('p', 'small');
    cut.append(...ctx.t('dv.trunc'));
    host.append(cut);
  }
}

/* ══ THE CORPUS FILE BROWSER ═══════════════════════════════════════════════
 *
 * `TASK-the-library-browses-the-corpus-files-and-a-file-opens`, owner
 * requirement 2026-09-06: *"a reader walks the corpus as a nested folder tree,
 * drilling into a folder and back out, and opens a file rendered in its own
 * tab."*
 *
 * ── WHICH QUESTION THIS ANSWERS, SO IT IS NOT A SECOND ITEM PANE ─────────
 *
 * Clicking an id anywhere in this console opens `aside#pane` with that item's
 * summary, scope, tier, body and provenance — rendered FROM THE INDEX, every
 * field already parsed. This browser shows the MARKDOWN ON DISK, frontmatter
 * and all. "Where does this file live, and what is actually written in it" is
 * a different question from "what does the corpus hold about this item", and
 * the two surfaces are kept apart on purpose: this one lists no summaries,
 * draws no tier chips and joins nothing, and the pane opens no files.
 *
 * ── THE CONTROL IS EXTERNAL, BY OWNER RULING ─────────────────────────────
 *
 * *"for the tree control use an external component, choose the best one"* —
 * owner, 2026-09-06, given after the item's own body had argued for reusing
 * `treeRows` and the flat `.tree` markup the Coverage screen draws. So this is
 * the vendored `<wa-tree>` (Web Awesome 3.12.0, `lib/wa-tree.js`), and the
 * markup is GENUINELY NESTED: a collapsed folder hides its subtree BY
 * CONTAINMENT, which is the defect class the flat version already paid for
 * once (`.tree .row[hidden]{display:none}` written to beat `display:flex` at
 * equal specificity, reported as broken collapse markers, explained away as
 * stale cached code, and a real CSS specificity fault the whole time).
 *
 * `buildTree` IS still reused, and only for the data: it takes a flat file
 * list, knows nothing about scope, and returns a genuinely nested structure.
 * `treeRows` — the half that flattens that structure back to a linear array of
 * depth-carrying rows — is the half deliberately left behind.
 *
 * ── WHAT A CLICK ON A FOLDER DOES, WHICH THE ITEM ASKS TO BE DECIDED ─────
 *
 * *"it cannot silently do both: expand in place, or descend into it, with the
 * other on a separate affordance."* Both are wanted and both are here, on two
 * affordances the component already distinguishes and neither of them invented:
 *
 *   - **The CHEVRON expands the folder in place.** `<wa-tree>`'s own
 *     `handleClick` tests for its expand button before anything else, and
 *     ArrowRight / ArrowLeft (swapped under `dir="rtl"`) do the same from the
 *     keyboard. Nothing here overrides it.
 *   - **The NAME descends into it**, re-rooting the tree at that folder. Under
 *     `selection="single"` selecting an item does not expand it, so the two
 *     gestures cannot collide, and Enter or Space on a focused folder is the
 *     keyboard spelling of the same act.
 *   - **The BREADCRUMB comes back out**, following `/doc.html`'s own precedent
 *     for a path shown above a document rather than inventing a second one.
 *
 * ── AND THE SCALE IS BOUNDED FROM THE START ──────────────────────────────
 *
 * 951 files in fifteen category folders on this corpus (2026-09-06). Three
 * bounds, none of them added after somebody noticed:
 *
 *   1. **Re-rooting.** Only the CURRENT folder's children are drawn as
 *      top-level items. The corpus root draws fifteen.
 *   2. **`lazy`.** A folder's children are built the first time it is
 *      expanded, not before, so an unopened folder costs one element rather
 *      than its whole subtree. (`lib/wa-tree.js` records that `wa-spinner` is
 *      not vendored; nothing is drawn for the loading moment because the
 *      children are appended synchronously inside the event and there is no
 *      moment to draw.)
 *   3. **A scrolling frame.** `.corpustree` has a `max-block-size`, so the
 *      widest, deepest folder cannot make the page grow without limit — the
 *      lesson the 942-option `<select>` taught at ~3,900 px.
 */

/**
 * Register `<wa-tree>` and `<wa-tree-item>`, once, and only where there is a
 * custom-element registry to register them into.
 *
 * **Importing the shim IS the registration** — each vendored chunk ends in Web
 * Awesome's own `customElement` decorator, which calls
 * `customElements.define` itself — so there is nothing to call and nothing to
 * bind, and this returns the import's own promise rather than a value.
 *
 * **Why it is dynamic and guarded rather than a static import at the top of
 * this file.** The vendored closure touches `document`, `HTMLElement` and
 * `customElements` at MODULE EVALUATION time, so a static import makes this
 * whole screen module unloadable outside a browser — measured, not assumed:
 * importing `screens/library.js` under `node --test` with a static
 * `import '/lib/wa-tree.js'` throws `ReferenceError: document is not defined`
 * before a single line of this file runs. That would have taken
 * `test/ui/library-screen.test.ts` with it — every assertion in it, including
 * the ones about the two owner instructions this screen was rebuilt for — for
 * a component none of them exercise.
 *
 * So the guard buys the same bargain every parse in this app makes: the
 * SHAPE of the tree (its nesting, its addresses, its counts, its breadcrumb)
 * stays measurable without a browser, and the component itself is driven in
 * Playwright, where it is the only place it can honestly be driven anyway.
 * Nothing is skipped silently in a browser: `customElements` is defined in
 * every one this console runs in, and `e2e/corpus-tree.spec.ts` asserts the
 * elements actually upgraded.
 */
let registration = null;
function registerTree() {
  if (registration === null) {
    registration = typeof customElements === 'undefined'
      ? Promise.resolve(null)
      : import('/lib/wa-tree.js');
  }
  return registration;
}

/** The chevron path, byte-identical to `tree-proof.html`'s — that page is the
 *  worked example and this is the second consumer, so the glyph is the same
 *  glyph rather than a second drawing of one. */
const CHEV_PATH = 'M4.5 2.5 8 6l-3.5 3.5';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * One slotted chevron.
 *
 * **Both slots carry the SAME glyph, and that is what the component expects**
 * — `wa-tree-item` rotates the expand button itself (90deg expanded, -90deg
 * expanded under `dir="rtl"`). Drawing an already-turned glyph for the
 * collapse slot double-counts that rotation, which `tree-proof.html` records
 * as the defect its first draft shipped. `wa-chev` is what the RTL flip rule
 * in `styles.css` keys on.
 */
function chevron(slot) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('slot', slot);
  svg.setAttribute('class', 'wa-chev');
  svg.setAttribute('part', 'chev');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', CHEV_PATH);
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/**
 * The address of one corpus file's rendered page.
 *
 * A third key beside `doc=` and `tut=`, not a third value of `doc=`: a
 * document id is a REPOSITORY-relative path and a corpus file id is
 * WORKSPACE-relative, so one key holding both would be two rootings under one
 * name. `doc.js`'s `docAddress` is the only reader of these and this is the
 * only writer.
 *
 * Exported and pure so `node --test` can measure it without a browser — the
 * same bargain `docHref` above makes.
 */
export function corpusHref(id) {
  return `/doc.html?corpus=${encodeURIComponent(id)}`;
}

/**
 * A `<bdi>` around every path segment, and it is LOAD-BEARING rather than
 * decoration: a folder label ending in `/` renders as `/adr` under `dir="rtl"`
 * without it — a Unicode bidi effect on the trailing slash, recorded in the
 * tree evaluation's §6.7 after it showed up in the RTL rehearsal.
 */
function segment(text) {
  return el('bdi', 'wa-name', text);
}

/** One node of the nested tree as a `<wa-tree-item>`.
 *
 *  A FILE's label is a real `<a>`, so a middle-click and a "copy link address"
 *  work the way a reader expects of something that opens a tab — the same
 *  reasoning `.docrow` records above. `tabIndex = -1` keeps it out of the tab
 *  order, because `<wa-tree>` is a roving-focus widget and a focusable anchor
 *  inside every row would make Tab walk 618 stops instead of one.
 *
 *  A FOLDER carries `lazy`, so its children are built on first expand, and a
 *  count so a reader can tell a folder of three from a folder of six hundred
 *  before opening it. */
function treeItem(node) {
  const item = document.createElement('wa-tree-item');
  const isDir = node.children.length > 0;
  item.dataset.kind = isDir ? 'dir' : 'file';
  item.dataset.path = node.path;
  if (isDir) {
    item.lazy = true;
    const count = el('span', 'wa-count', String(node.fileCount));
    item.append(segment(`${node.name}/`), count);
    return item;
  }
  const link = el('a', 'wa-file');
  link.href = corpusHref(node.path);
  link.target = '_blank';
  link.rel = 'noopener';
  link.tabIndex = -1;
  link.append(segment(node.name));
  item.append(link);
  return item;
}

/** Every directory node of a built tree, by path — what a lazy expand and a
 *  breadcrumb jump both look their target up in. Built once per fetch. */
function indexNodes(root) {
  const byPath = new Map([['', root]]);
  const walk = (node) => {
    for (const child of node.children) {
      if (child.children.length > 0) {
        byPath.set(child.path, child);
        walk(child);
      }
    }
  };
  walk(root);
  return byPath;
}

/** The breadcrumb: the corpus root, then one crumb per folder descended into.
 *  The LAST crumb is the current location and is drawn as text rather than a
 *  button — a control that navigates to where you already are is a control
 *  that does nothing, and this page has no reason to draw one. */
function crumbs(root, location) {
  const parts = location === '' ? [] : location.split('/');
  const out = [{ label: `${root}/${parts[0] ?? ''}`, path: parts[0] ?? '' }];
  for (let i = 1; i < parts.length; i += 1) {
    out.push({ label: parts[i], path: parts.slice(0, i + 1).join('/') });
  }
  return out;
}

/**
 * The browser, drawn for one location and redrawn wholesale when the reader
 * descends or climbs.
 *
 * Redrawn rather than mutated on purpose: the expanded/collapsed state of the
 * folders under the OLD location means nothing under the new one, so carrying
 * it across would be carrying a fact that had stopped being about anything.
 */
function paintCorpusAt(ctx, host, state) {
  host.replaceChildren();

  const bar = el('nav', 'crumbs');
  bar.setAttribute('aria-label', ctx.tFlat('lib.filesbread'));
  for (const crumb of crumbs(state.root, state.location)) {
    // **THE `<bdi>` IS LOAD-BEARING HERE TOO, and it was found by looking at
    // the picture rather than by reasoning.** The first crumb is
    // `.my_context/items`, and a string that STARTS with a dot renders as
    // `my_context/items.` under `dir="rtl"` without isolation — the same
    // Unicode effect `tree-proof.html` records for a folder label that ends
    // with a slash, at the other end of the string. Caught in the RTL
    // screenshot on 2026-09-06, after every assertion in
    // `e2e/corpus-tree.spec.ts` had passed.
    if (crumb.path === state.location) {
      const here = el('span', 'crumb here');
      here.append(el('bdi', '', crumb.label));
      bar.append(here);
      continue;
    }
    const up = el('button', 'crumb');
    up.type = 'button';
    up.append(el('bdi', '', crumb.label));
    up.addEventListener('click', () => {
      paintCorpusAt(ctx, host, { ...state, location: crumb.path });
    });
    bar.append(up);
  }
  host.append(bar);

  const node = state.byPath.get(state.location);
  if (node === undefined || node.children.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('lib.filesnone'));
    host.append(none);
    return;
  }

  const frame = el('div', 'corpustree');
  const tree = document.createElement('wa-tree');
  tree.setAttribute('selection', 'single');
  tree.setAttribute('aria-label', ctx.tFlat('lib.filestree'));
  tree.append(chevron('expand-icon'), chevron('collapse-icon'));
  for (const child of node.children) tree.append(treeItem(child));

  // A folder's children, built the first time it is opened. `lazy = false`
  // afterwards, which is what tells the component the load it asked for has
  // answered — it then runs its own expand animation.
  tree.addEventListener('wa-lazy-load', (event) => {
    const item = event.target;
    if (item === null || item.dataset === undefined) return;
    const found = state.byPath.get(item.dataset.path ?? '');
    if (found !== undefined) for (const child of found.children) item.append(treeItem(child));
    item.lazy = false;
  });

  // Selecting a FOLDER descends into it. Selecting a file does nothing here:
  // the file's own anchor is what opens it, and a second opener on the same
  // gesture would open two tabs.
  tree.addEventListener('wa-selection-change', (event) => {
    const picked = event.detail?.selection?.[0];
    if (picked === undefined || picked.dataset?.kind !== 'dir') return;
    paintCorpusAt(ctx, host, { ...state, location: picked.dataset.path ?? state.location });
  });

  // Enter and Space on a FILE, which the anchor cannot receive: focus lives on
  // the `<wa-tree-item>`, so the component's own key handling selects the row
  // and never reaches the link inside it. `<wa-tree>`'s handler runs first and
  // does not stop propagation, so this listener sees the same key.
  tree.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const active = document.activeElement;
    if (active === null || active.dataset?.kind !== 'file') return;
    const link = active.querySelector('a.wa-file');
    if (link !== null) link.click();
  });

  frame.append(tree);
  host.append(frame);

  const here = el('p', 'small');
  here.append(...ctx.t('lib.filescount', {
    dirs: node.children.filter((child) => child.children.length > 0).length,
    files: node.children.filter((child) => child.children.length === 0).length,
    total: state.total,
  }));
  host.append(here);
}

/**
 * The corpus card: one read of `/api/corpus`, then the tree.
 *
 * The two DISCLOSURES are drawn whether or not they have anything to report,
 * for `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`: how
 * many index rows the served boundary refused, and whether the roster was cut
 * at its bound. A screen that only spoke up when something was dropped would
 * leave a reader unable to tell a complete corpus from a check that had
 * stopped running.
 */
async function paintCorpus(ctx, host, body) {
  await registerTree();
  const root = typeof body.root === 'string' && body.root !== '' ? body.root : '.my_context';
  const tree = buildTree(body.files.map((path) => ({ path, governs: [] })));
  const byPath = indexNodes(tree);

  const surface = el('div');
  host.append(surface);
  paintCorpusAt(ctx, surface, {
    root, byPath, location: 'items', total: body.files.length,
  });

  const refused = el('p', 'small');
  refused.append(...ctx.t('lib.filesrefused', {
    refused: Math.max(body.indexed - body.files.length, 0),
    indexed: body.indexed,
  }));
  host.append(refused);

  if (body.truncated === true) {
    const cut = el('p', 'small');
    cut.append(...ctx.t('lib.filestrunc'));
    host.append(cut);
  }
}

/**
 * The screen. All three endpoints are read before any card is drawn, and each
 * card holds its own refusal: a Tutorials endpoint that refuses must not take
 * the Documents list down with it, the reverse, and neither may take the
 * corpus browser down with them.
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
  //
  // The right-hand side is a STACK rather than a single card, owner request
  // 2026-09-06. Measured before changing it: Documents is ~204px tall beside a
  // Tutorials roster that runs to ~749px, so 545px of the right column was
  // dead while three cards sat full-width underneath it.
  //
  // The nav card stays a DIRECT child of `.two` deliberately —
  // `.two.align-top>[data-role="nav"]` is the selector that makes it sticky,
  // and wrapping the other side leaves that untouched. `.libcol` carries
  // `min-inline-size:0` for the reason this screen already learned once: a
  // grid child's default minimum is its content, and the flag tables in the
  // command-line card are wide.
  const main = el('div', 'libcol');
  main.append(tuts);
  const side = el('div', 'libcol');
  side.append(docs);
  two.append(main, side);

  // The heading stays put and only the roster scrolls, owner request
  // 2026-09-06: "do not scroll the title Tutorials, only the basic and
  // advanced sections below it".
  //
  // So the `<h3>` is a child of the CARD and everything else goes into a
  // scroller beside it. The previous shape put the title inside the scrolling
  // box, so a reader who scrolled to ADVANCED lost the only label saying what
  // they were looking at.
  //
  // This is NOT the sticky nav coming back. That was `position:sticky` on the
  // whole card, which pinned it over the corpus tree in the same column and is
  // what he asked me to remove an hour ago. This scrolls a box inside a card
  // that is itself in normal flow, so nothing can overlap anything.
  const tutHead = el('h3');
  tutHead.append(...ctx.t('lib.tuts'));
  tuts.append(tutHead);
  const tutScroll = el('div', 'cardscroll');
  tuts.append(tutScroll);
  const docHead = el('h3');
  docHead.append(...ctx.t('lib.docs'));
  docs.append(docHead);

  // The corpus browser stacks UNDER Tutorials in the left column, at exactly
  // its width. Owner request 2026-09-06, in two steps: first "the same width
  // as the Tutorials card", then — after seeing it — "it just scrolls and
  // overlaps the tutorial card while it should sit below it, the same as you
  // did in the documents column".
  //
  // BOTH COLUMNS ARE NOW `.libcol` STACKS, and that symmetry is the fix rather
  // than a tidy-up. Placing this card at column 1 / row 2 of the grid put it
  // in a different grid area from Tutorials, and Tutorials is
  // `position:sticky` with `max-block-size:85vh` and its own `overflow-y` —
  // so it pinned itself over the tree as the page scrolled. Inside one flex
  // column there is no sticky and no second scroller: the tree simply follows
  // the roster, which is what he asked for and what the right column already
  // did.
  //
  // Tutorials stops being sticky as a CONSEQUENCE, because
  // `.two.align-top>[data-role="nav"]` is a direct-child selector and the nav
  // card now has a wrapper. That is deliberate: sticky earns its keep beside a
  // long document, not above a card the reader is meant to scroll to.
  //
  // `data-role` stays deliberately absent here — the two roles this screen
  // spends are `nav` (wayfinding) and `content` (the reading surface), and a
  // file browser is neither; a third hue would extend the card-role system,
  // which the ruling that established it asks not to be done casually.
  const files = el('div', 'card pane');
  main.append(files);
  const filesHead = el('h3');
  filesHead.append(...ctx.t('lib.files'));
  const filesSub = el('p', 'small');
  filesSub.append(...ctx.t('lib.filessub'));
  files.append(filesHead, filesSub);

  const [tutBody, docBody, corpusBody] = await Promise.all([
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
    ctx.api('/api/corpus').then((b) => {
      if (b === null || typeof b !== 'object' || !Array.isArray(b.files)
        || typeof b.indexed !== 'number') {
        throw new Error('library: /api/corpus answered without a files array and an indexed count');
      }
      return b;
    }).catch((error) => error),
  ]);

  // Both halves go into the scroller, refusal included: a card whose error
  // note sat outside it would put the failure above a heading that promises a
  // roster, and the reader would scroll an empty box looking for the reason.
  if (tutBody instanceof Error) tutScroll.append(errorNote(tutBody.message));
  else paintTutorials(ctx, tutScroll, tutBody);
  if (docBody instanceof Error) docs.append(errorNote(docBody.message));
  else paintDocuments(ctx, docs, docBody);
  if (corpusBody instanceof Error) files.append(errorNote(corpusBody.message));
  else await paintCorpus(ctx, files, corpusBody);

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
  side.append(notes);

  /**
   * **The command-line half** —
   * `TASK-the-library-explains-the-command-line-every-switch-parameter`, owner
   * requirement 2026-09-06. It is a whole card of its own in
   * `screens/cli-help.js`, appended here and given nothing but the root to
   * append to, so the two halves of this screen own no element in common.
   *
   * That is deliberate and it is about MERGES rather than tidiness: this
   * screen is being widened by more than one lane at once, and a card that
   * builds itself inside a function of its own is a card that can be added,
   * moved or removed without touching a line of the roster above it. The shell
   * — `screenHead`, the two-column grid, the notes card — is untouched by this
   * addition.
   *
   * Awaited LAST, after both rosters are painted, because it makes its own two
   * reads and a reader looking for a tutorial should not wait on the flag
   * tables to arrive.
   */
  await paintCliHelp(ctx, side);
}
