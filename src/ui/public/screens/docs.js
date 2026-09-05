/**
 * `nav.read` — **Documentation**, `<section data-p="docs">` in the design of
 * record. A **Contents** card beside a card that renders one section, and the
 * markdown is turned into NODES — never into an HTML string.
 *
 * ── THE THING THE DESIGN USED TO ASK FOR THAT NOTHING SERVED ───────────────
 *
 * `dv.sub` used to promise a document: *"The repository's own README,
 * rendered here and addressed by heading ordinal."* The spec repeated it and
 * called the mechanism the decision
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · `addressed by **heading ordinal** — so one integer gives both a deep link` · ~1327).
 *
 * **No endpoint serves the README.** The read server's whole route table is in
 * `registerReadRoutes`, and the only route that answers markdown at all is
 * `GET /api/help/:topic`, whose reachable set is four
 * (`src/ui/read-model.ts` · `export const UI_HELP_TOPICS: UiHelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~1488).
 * `README.md` sits at the repository root, outside `src/ui/public/`, so the
 * static handler cannot reach it either — measured, not assumed: nothing under
 * `src/ui/` names it. This screen therefore renders a `mycontext help` topic,
 * which is what it has always done — `dv.sub` was the thing that disagreed.
 * `DEC-the-documentation-screen-serves-the-help-topics-and-says-so` ruled the
 * sentence false on 2026-08-25 (*"the screen serves `mycontext help` topics,
 * and `dv.sub` is corrected to say so"*), and the correction did not reach the
 * mockup or either string table for three weeks —
 * `TASK-the-documentation-screen-still-promises-the-readme-on-screen` is what
 * finally landed it, on 2026-09-05, in `dv.sub` and `dv.v` alike. Not a new
 * discovery: plan 1 already recorded that this screen belongs to no plan
 * (`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` · `**Documentation and Tutorials belong to no plan and are not claimed here.**` · ~214),
 * which is why nothing was ever built to feed it.
 *
 * ── WHY §4, AND WHY THE CONTENTS CARD IS STILL THE MOCKUP'S OWN FIVE ───────
 *
 * The mockup's Contents card lists five sections by ordinal — 1, 2, 3, 4 and
 * 7 — under `dv.t1`…`dv.t4` and `dv.t7`, and every one of those five is a
 * declared key in both string tables. They are drawn here exactly where the
 * design of record draws them, unchanged, because a translated string that
 * exists for one list and is drawn nowhere is a key nobody can find again.
 *
 * Of those five, **exactly one names a topic this server can serve**: `dv.t4`
 * is *"Scope"*, and `scope` is one of the four in `UI_HELP_TOPICS`. So the
 * second card renders THAT one — `§4 — Scope` — and the two cards say the same
 * thing to a reader: the Contents lists five sections, and the section drawn
 * is the fourth. The mockup renders `§3` and its Contents is not interactive;
 * neither is this one, for the same reason — the design draws no control there
 * and `#/docs/4` is not a route this shell's `route()` can parse, so there is
 * no deep link to any of the other four. Reported, not invented.
 *
 * **The heading text comes from `tFlat('dv.t4')`, and that is the one place
 * this file reaches for the flat renderer.** `dv.rendered` is `§{ordinal} —
 * {heading}`, so `{heading}` is a SUBSTITUTION VALUE, and `t()` puts every
 * substitution into a `span.v` by setting `.textContent` on it — a text-only
 * sink by construction, which is exactly what `tFlat` is for. It is not being
 * used to fill an element; `t()` fills the element. The value has to be the
 * TRANSLATED heading rather than the served document's own `# Scope`, because
 * `dv.sub`'s other half is *"a language switch that lands on the same
 * section"* — the ordinal is what survives the switch, and the heading beside
 * it must follow the language or the claim is false on the Hebrew page. In
 * English the two agree exactly: the served document's first heading IS
 * `# Scope`.
 *
 * ── THE RENDERER LIVES IN `lib/markdown.js` NOW, AND WHY IT MOVED ─────────
 *
 * `markdownNodes` was declared in THIS file and imported out of it by `app.js`
 * and `screens/tut.js` — a shared renderer living inside one screen, so two of
 * its three callers reached across a screen boundary to get it. On 2026-09-05
 * `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` replaced its
 * hand-written scanner with a vendored markdown-it used as a tokeniser only,
 * and the move out of this screen came with it. Every argument about what the
 * renderer refuses, what it hands back as text, and why no HTML string is ever
 * produced now lives in that module's own header; this screen imports it and
 * passes `ctx.tFlat` as the labeller.
 *
 * **`markdownNodes` takes the labeller, not `ctx`.** `label(key, subs)` is a
 * flat-string function — `ctx.tFlat`, in the browser — because a refusal label
 * is `textContent` on a `span.refusal` and an attribute-shaped sink cannot
 * hold the elements `t()` builds. It defaults to the English wording so
 * `node --test` can keep passing a two-method `doc` and nothing else.
 */
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';
import { markdownNodes } from '/lib/markdown.js';

/**
 * ── THE CONTENTS CARD WAS FIVE LITERALS UNTIL 2026-09-05, AND IS NOW DERIVED ─
 *
 * What stood here was the mockup's own Contents list, transcribed:
 *
 *     const CONTENTS = [{ ordinal: 1, key: 'dv.t1' }, … { ordinal: 7, key: 'dv.t7' }];
 *     const RENDERED = { topic: 'scope', entry: CONTENTS[3] };
 *
 * Five hand-picked headings, of which exactly one named something the server
 * could serve, beside one hard-coded `mycontext help` topic. It was honest
 * about being that — the header above says so at length — and it was still a
 * table of contents nobody derived from a document.
 *
 * `TASK-rebuild-the-documentation-screen-s-index-from-a-real` (`docsys/5`) and
 * `TASK-show-per-document-whether-a-hebrew-mirror-exists-measured` (`docsys/6`)
 * replace both with `GET /api/doc`: a document picker over the whole manifest,
 * each document's own ATX headings as its index, and `hasHebrewMirror` per
 * document read off the disk by the server on every request. The five `dv.t*`
 * keys stay in both string tables because the frozen mockup still declares
 * them (`DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`);
 * nothing here reads them any more.
 *
 * **`README.md` is the default because the requirement names it**, not because
 * it is first alphabetically: `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`
 * calls it and `docs/README.he.md` *"the base of the documentation system"*. In
 * the Hebrew UI the Hebrew README opens instead — a real Hebrew document, so
 * this is a DEFAULT and not the silent English fallback §4 forbids. A reader
 * who deep-links to a specific document always gets that document.
 */
const DEFAULT_DOC = { en: 'README.md', he: 'docs/README.he.md' };

/**
 * How many rows the picker draws at once. The manifest is 158 documents in
 * this repository today and grows with every report written, which is more
 * than one card should render and far more than a reader scans — so the list
 * is BOUNDED and says so (`dv.shown`), with the filter above it as the way
 * past the bound. Not a scroll box: a bound a reader can see the size of is
 * the disclosure `INV-nothing-is-dropped-silently` asks for, and a scrollbar
 * is not one.
 */
const PICKER_LIMIT = 30;

/**
 * The `{ id, anchor }` a hash addresses, both `null` where it names neither.
 *
 * `#/docs` is the screen; `#/docs/<id>` is one document; `#/docs/<id>/<anchor>`
 * is one heading inside it — the deep link the design of record asks for in
 * those words. A document id is a repo-relative PATH and carries `/`, so the
 * screen writes it `encodeURIComponent`'d into one segment; splitting on `/`
 * here is therefore correct and is the same split `app.js`'s `screenFromHash`
 * makes to pick the module.
 *
 * Exported and taking the hash as an ARGUMENT so `node --test` can measure the
 * parse without a browser — the same bargain `markdownNodes` makes with `doc`.
 * A malformed percent-escape is returned as written and then misses the
 * manifest lookup, which draws `dv.noid`: the refusal names what IS served,
 * exactly as the server's own would.
 */
export function docAddress(hash) {
  const asked = String(hash ?? '').replace(/^#\//, '');
  const parts = asked.split('/');
  const decode = (raw) => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };
  if (parts[0] !== 'docs' || parts.length < 2 || parts[1] === '') {
    return { id: null, anchor: null };
  }
  return {
    id: decode(parts[1]),
    anchor: parts.length > 2 && parts[2] !== '' ? decode(parts[2]) : null,
  };
}

/** `location.hash`, or `''` where there is no `location` — `node --test`. */
function currentHash() {
  return typeof location === 'undefined' ? '' : location.hash;
}

/** The hash that opens one document, optionally at one heading. */
function docHash(id, anchor) {
  const base = `#/docs/${encodeURIComponent(id)}`;
  return anchor === undefined || anchor === null ? base : `${base}/${encodeURIComponent(anchor)}`;
}

/**
 * A heading's text, reduced to what BOTH sides of the join can agree on.
 *
 * The server's `docHeadings` records a heading's SOURCE text — backticks,
 * asterisks and all — while `markdownNodes` has already turned those into
 * `<span class="m">` and `<b>` by the time a rendered heading has a
 * `textContent`. So `## The \`--json\` flag` is two different strings on the
 * two sides and neither is wrong. Stripping the two markers is what makes them
 * comparable, and comparing TEXT rather than counting positions is what keeps
 * the anchors right when the two parsers disagree about a line — the server
 * reads no fences inside an indented block, this renderer does, and neither is
 * going to be taught the other's grammar for the sake of an id.
 */
function headingKey(text) {
  return String(text).replace(/[`*]/g, '').trim();
}

/**
 * Give every rendered heading the server's own anchor, so `#/docs/:id/:anchor`
 * has something to land on.
 *
 * Walks the rendered nodes and the manifest's heading list together, in
 * document order, matching on `headingKey` and never assigning the same anchor
 * twice. A heading the server did not report (one this renderer found and it
 * did not) simply gets no id — it is not addressable, which is honest, and it
 * does not push every heading after it onto the wrong anchor.
 */
function assignAnchors(nodes, headings) {
  const remaining = [...headings];
  const walk = (list) => {
    for (const node of list) {
      if (/^h[1-6]$/.test(node.tagName === undefined ? '' : node.tagName.toLowerCase())) {
        const key = headingKey(node.textContent);
        const at = remaining.findIndex((h) => headingKey(h.text) === key);
        if (at !== -1) {
          node.id = remaining[at].anchor;
          remaining.splice(0, at + 1);
        }
        continue;
      }
      if (node.children !== undefined) walk([...node.children]);
    }
  };
  walk([...nodes]);
}

/** ✅ where a Hebrew mirror exists, and the Tutorials screen's own `to write`
 * chip where it does not — reused rather than reinvented, per `docsys/6`, and
 * never a blank cell. The `title` carries the sentence, because a bare glyph
 * beside a path is not a statement anyone can read. */
function mirrorMark(ctx, hasMirror) {
  if (hasMirror) {
    const yes = el('span', null, '✅');
    yes.title = ctx.tFlat('dv.heyes');
    return yes;
  }
  const chip = el('span', 'chip warn');
  chip.dataset.g = '▲';
  chip.title = ctx.tFlat('dv.heno');
  chip.append(...ctx.t('tu.todo'));
  return chip;
}

/**
 * The Documentation screen: a document picker built from the server's
 * manifest, that document's own headings as its index, and its markdown.
 *
 * **Nothing here ever names a path.** The picker's rows carry ids the server
 * just answered; the address bar's id is looked up in that same list before a
 * single byte is fetched, so an id that is not in the manifest causes no
 * request at all. That is the client half of the property
 * `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` rules on
 * the server: *"The client never sends a path."*
 */
export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'dv.h', 'dv.v', 'dv.sub');

  // `align-top` and `data-role` are the CSS expert's card-role system
  // (styles.css, "CARD ROLES" — 2026-09-05 UI/UX pass): the picker/index card
  // is `nav` (wayfinding), the document card is `content` (the reading
  // surface). Structure and classes only, per that task's scope — this
  // screen's OWN shape (a picker over every corpus document) is the design
  // the owner has since rejected (`DEC-the-documentation-screen-is-a-help-
  // system-built-from-the`) and is expected to change under a later task;
  // the role system underneath is not screen-specific and survives that
  // rebuild.
  const two = el('div', 'two align-top');
  root.append(two);

  const toc = el('div', 'card pane');
  toc.dataset.role = 'nav';
  const card = el('div', 'card pane');
  card.dataset.role = 'content';
  // Both cards are in the DOM before the fetch, so the screen's composition is
  // the same shape whether the read answers, refuses or is still in flight —
  // and a refusal lands inside the card that would have held it, instead of
  // replacing the screen.
  two.append(toc, card);

  let list;
  try {
    list = await ctx.api('/api/doc');
    if (list === null || typeof list !== 'object' || !Array.isArray(list.documents)) {
      throw new Error('docs: /api/doc answered without a documents array');
    }
  } catch (error) {
    toc.append(errorNote(error.message));
    return;
  }

  const documents = list.documents;
  const asked = docAddress(currentHash());
  const byId = (id) => documents.find((entry) => entry.id === id);
  // The address wins where it names a real document; otherwise the requirement's
  // own base document, per language; otherwise whatever the manifest has first.
  const selected = (asked.id === null ? undefined : byId(asked.id))
    ?? (asked.id === null
      ? (byId(DEFAULT_DOC[ctx.lang === 'he' ? 'he' : 'en']) ?? byId(DEFAULT_DOC.en) ?? documents[0])
      : undefined);

  // ── Contents: the picker, the measured mirror count, the heading index ──
  const tocHead = el('h3');
  tocHead.append(...ctx.t('dv.toc'));
  toc.append(tocHead);

  // **THE HEBREW NUMBER IS COUNTED, NEVER WRITTEN DOWN** (`docsys/6`). Every
  // entry's `hasHebrewMirror` was read off the disk by the server on THIS
  // request, so this line rises on its own the day a mirror is written and
  // nothing in this file changes.
  const mirrors = documents.filter((entry) => entry.hasHebrewMirror).length;
  const mirrorLine = el('p', 'small');
  mirrorLine.append(...ctx.t('dv.hemirror', { done: mirrors, total: documents.length }));
  toc.append(mirrorLine);

  const filter = el('input', 'small');
  filter.type = 'search';
  filter.setAttribute('placeholder', ctx.tFlat('dv.filter'));
  filter.setAttribute('aria-label', ctx.tFlat('dv.filter'));
  toc.append(filter);

  const rows = el('div', 'small');
  const shown = el('p', 'small');
  toc.append(rows, shown);
  if (list.truncated === true) {
    const cut = el('p', 'small');
    cut.append(...ctx.t('dv.trunc'));
    toc.append(cut);
  }

  /** Redraw the picker for the current filter. Only these two elements are
   * rebuilt: filtering is a reading aid, not a route, so it neither navigates
   * nor refetches. */
  const paintRows = () => {
    const needle = filter.value.trim().toLowerCase();
    const matched = needle === ''
      ? documents
      : documents.filter((entry) => entry.id.toLowerCase().includes(needle)
        || entry.title.toLowerCase().includes(needle));
    rows.replaceChildren();
    shown.replaceChildren();
    if (matched.length === 0) {
      shown.append(...ctx.t('dv.nomatch'));
      return;
    }
    for (const entry of matched.slice(0, PICKER_LIMIT)) {
      const row = el('div');
      const link = el('a', 'm', entry.id);
      link.href = docHash(entry.id);
      if (selected !== undefined && entry.id === selected.id) {
        link.setAttribute('aria-current', 'true');
      }
      row.append(link, ' ', mirrorMark(ctx, entry.hasHebrewMirror));
      rows.append(row);
    }
    shown.append(...ctx.t('dv.shown', {
      shown: Math.min(matched.length, PICKER_LIMIT), total: documents.length,
    }));
  };
  filter.addEventListener('input', paintRows);
  paintRows();

  // ── The document ────────────────────────────────────────────────────────
  const head = el('h3');
  const md = el('div', 'md');
  md.id = 'mdout';
  const mdnote = el('p', 'small');
  mdnote.append(...ctx.t('dv.mdnote'));

  if (selected === undefined) {
    head.append(...ctx.t('dv.nodoc'));
    const why = el('p', 'small');
    why.append(...ctx.t(asked.id === null ? 'dv.pick' : 'dv.noid'));
    card.append(head, why, md, spaced(mdnote));
    return;
  }

  head.textContent = selected.title;
  const ident = el('p', 'small');
  ident.append(el('span', 'm', selected.id), ' ', mirrorMark(ctx, selected.hasHebrewMirror));
  card.append(head, ident, md, spaced(mdnote));

  // The selected document's OWN index, under the picker — the derived
  // replacement for the five literal rows this card used to draw.
  const indexHead = el('p', 'small');
  indexHead.append(...ctx.t('dv.inthis'));
  toc.append(spaced(indexHead));
  if (selected.headings.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('dv.nohead'));
    toc.append(none);
  } else {
    const index = el('div', 'small');
    for (const heading of selected.headings) {
      const row = el('div');
      const link = el('a', null, heading.text);
      link.href = docHash(selected.id, heading.anchor);
      // The ordinal, U+00B7 between two spaces, then the heading — the
      // mockup's own row shape, kept while its content became derived.
      row.append(`${heading.ordinal} · `, link);
      index.append(row);
    }
    toc.append(index);
  }

  const parity = el('p', 'small');
  parity.append(...ctx.t('dv.parity'));
  toc.append(spaced(parity));

  let body;
  try {
    body = await ctx.api(`/api/doc/${encodeURIComponent(selected.id)}`);
  } catch (error) {
    // The endpoint's own words — its 404 names how many documents ARE in the
    // manifest, which is worth more than an empty `.md`.
    md.append(errorNote(error.message));
    return;
  }

  const { nodes } = markdownNodes(body.markdown, document, ctx.tFlat);
  assignAnchors(nodes, Array.isArray(body.headings) ? body.headings : []);
  md.append(...nodes);

  if (asked.anchor !== null) {
    const target = md.querySelector === undefined ? null : md.querySelector(`[id="${CSS.escape(asked.anchor)}"]`);
    if (target !== null && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start' });
    }
  }
}
