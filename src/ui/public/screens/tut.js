/**
 * `nav.read` — **Tutorials**, `<section data-p="tut">` in the design of record.
 * A list of every tutorial the manifest names, grouped Basic and Advanced,
 * **and a reader that opens one of them in place.**
 *
 * ── WHAT THIS SCREEN WAS UNTIL 2026-09-05, AND WHY THAT WAS NOT ENOUGH ────
 *
 * It was a CHECKLIST. Six rows, hard-coded here as translation keys, each with
 * two cells saying whether a designated heading existed in one of two files.
 * `TASK-no-endpoint-serves-tutorial-state-so-twelve-cells-are-hard` had already
 * made those twelve cells honest — they are measured by `GET /api/tutorials`
 * rather than asserted by whoever last edited this file — but a reader who came
 * to this screen to READ A TUTORIAL left with nothing. Six rows of ✅ and
 * *to write* is a report ABOUT documentation, not documentation.
 *
 * `TASK-the-tutorials-screen-gets-a-reader-not-only-a-checklist` (`plan:tuts
 * seq:4`) is that gap, closed. Two things changed and they are one change:
 *
 *   1. **The rows are the MANIFEST'S**, not this file's. `GET /api/tutorials`
 *      answers one row per entry in `docs/tutorials/manifest.json` — id, title,
 *      tier, and the same `en`/`he` states as before — so the roster grows when
 *      the manifest does and this module names no tutorial at all. The six
 *      `tu.1`…`tu.j6` keys stay in both string tables because the frozen mockup
 *      still declares them (`DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`);
 *      nothing here reads them any more.
 *   2. **A row is a LINK.** `#/tut/<id>` opens the reader, which fetches
 *      `GET /api/tutorials/:id` and draws its markdown through `markdownNodes`.
 *
 * ── THE RENDERER IS BORROWED, NOT WRITTEN ────────────────────────────────
 *
 * `markdownNodes` is imported from `/lib/markdown.js` — the shared renderer
 * `app.js` already imports for item bodies, and the reason
 * `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` gives:
 * *"Two call sites are fine; two implementations are the defect."* This screen
 * is the third call site and it adds no renderer, no HTML string and no
 * dependency — `CONST-zero-runtime-dependencies` is not touched by a feature
 * that ships an `import` of a file already served.
 *
 * ── THE ADDRESS IS A MANIFEST ID, AND IT IS CHECKED AGAINST THE LIST ──────
 *
 * `readerId` reads one path segment out of the hash and nothing else. Before it
 * is sent anywhere it is looked up in the roster `GET /api/tutorials` just
 * answered; an id that names no row draws `tu.noid` and NO fetch is made. So
 * the closed set the server enforces (`apiTutorialDoc` looks the id up as a Map
 * key and never joins it onto a path) is enforced on this side too, and a
 * pasted address cannot even cause a request for something that is not served.
 *
 * ── THE EN/HE COLUMNS, WHAT THEY MEAN AND WHAT THEY DO NOT ────────────────
 *
 * Unchanged, and now SAID ON SCREEN rather than only in this comment —
 * `tu.donemeans` is the sentence, and it exists because a ✅ that a reader
 * reads as "this tutorial is good" is a claim nothing measured.
 *
 * `done` means the file exists and carries all four required section headings;
 * `todo` means the file exists and at least one is missing; `unmeasured` means
 * there is no file on disk to check at all. None of the three says anything
 * about the prose.
 *
 * **The zero is DRAWN.** `tu.rollup` states `done` of `total` from the
 * endpoint's own `heRollup`, so "no tutorial is translated yet" is a stated
 * measurement rather than a pattern a reader has to notice by counting chips —
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
 *
 * **And the reader never falls back silently.** *"Do not ship a toggle that
 * falls back."* In the Hebrew UI the reader asks for `lang=he` only when the
 * row's own `he` state says a Hebrew file exists; where it does not, the
 * English text is drawn UNDER `tu.enonly`, which says so. The HE column itself
 * is still a status and never a control.
 *
 * No element here carries a `data-t` attribute, for the reason the shell gives:
 * this app has no re-scanner, the א/A control reloads the page, and every
 * screen renders once per language.
 */
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';
import { markdownNodes } from '/lib/markdown.js';

/**
 * The three states a language cell can be in.
 *
 * `todo` is the mockup's own word — `tu.todo`, *"to write"*. `unmeasured` is
 * not the mockup's: the design of record predates the endpoint and draws only
 * `done` and `todo`, so there is no third cell in it to reconcile with. It
 * exists here because the endpoint can answer it honestly and the mockup
 * cannot be asked to draw a state it never anticipated — the same gap
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names for
 * every other screen that reuses `.chip.unmeas`.
 */
export const DONE = 'done';
export const TODO = 'todo';
export const UNMEASURED = 'unmeasured';

/**
 * The two tiers, in the order they are drawn, paired with the heading key each
 * one carries. *"Basic and advanced"* is the owner's own split
 * (the tutorials design of 2026-09-05 says so in those words), and `tier` is a
 * field of every manifest entry — so this array carries the ORDER and the KEYS
 * only, never a roster.
 */
export const TIERS = [
  { tier: 'basic', key: 'tu.basic' },
  { tier: 'advanced', key: 'tu.adv' },
];

/**
 * The two TRANSLATED column headers. `tu.t` is the mockup's own; `tu.job` is
 * retired from the table because a manifest title IS the job it answers — R2's
 * whole rule — so a second column repeating it would be the same fact twice.
 * `tu.id` took its place: the id is what the address bar carries and what the
 * server looks up, and a screen that hides its own addressing makes a deep
 * link something a reader can only be given rather than read off the page.
 */
export const HEAD_KEYS = ['tu.t', 'tu.id'];

/** The mockup's two other column headers, untranslated. They are language
 * tags — the same kind of thing as `screens/learn.js`'s topic names — and the
 * consequence is stated rather than hidden: in the Hebrew UI they still read
 * `EN` and `HE`. */
export const LANG_COLUMNS = ['EN', 'HE'];

/**
 * What one language cell contains, as a description rather than as DOM.
 * **Unchanged by this task**, deliberately: the three cell shapes are the
 * mockup's and the shared `◌` primitive's, and a reader who learned them on
 * this screen yesterday reads the same three today.
 *
 * **An unknown state throws.** A default branch here would draw one of three
 * false statements about the repository over a fourth answer the endpoint
 * never sends — the same reason `t()` throws on a key it cannot find rather
 * than rendering blank.
 */
export function cellSpec(state) {
  if (state === DONE) return { kind: 'glyph', glyph: '✅' };
  if (state === TODO) return { kind: 'chip', className: 'chip warn', glyph: '▲', key: 'tu.todo' };
  if (state === UNMEASURED) {
    return { kind: 'chip', className: 'chip unmeas', glyph: '◌', key: 'strip.unmeasured' };
  }
  throw new Error(`tut: unknown language-cell state: ${String(state)}`);
}

/** One `<td>`, built from `cellSpec`'s description. */
function languageCell(ctx, state) {
  const spec = cellSpec(state);
  if (spec.kind === 'glyph') return el('td', null, spec.glyph);
  const cell = el('td');
  const chip = el('span', spec.className);
  chip.dataset.g = spec.glyph;
  chip.append(...ctx.t(spec.key));
  cell.append(chip);
  return cell;
}

/**
 * The tutorial id a hash addresses, or `null` for the list view.
 *
 * `#/tut` and `#/tut/` are the list; `#/tut/<id>` is the reader. Exported and
 * given the hash as an ARGUMENT rather than reading `location` itself, so
 * `node --test` can measure the parse without a browser — the same bargain
 * `markdownNodes` makes by taking a `doc`.
 *
 * A malformed percent-escape is returned AS WRITTEN rather than thrown on: it
 * is then looked up in the roster like any other string, misses, and draws
 * `tu.noid`. A refusal that names what is served is a better answer than a
 * stack trace, and it is the same answer the server gives for the same input.
 */
export function readerId(hash) {
  const asked = String(hash ?? '').replace(/^#\//, '');
  const parts = asked.split('/');
  if (parts[0] !== 'tut' || parts.length < 2 || parts[1] === '') return null;
  try {
    return decodeURIComponent(parts[1]);
  } catch {
    return parts[1];
  }
}

/** `location.hash`, or `''` where there is no `location` — `node --test`. */
function currentHash() {
  return typeof location === 'undefined' ? '' : location.hash;
}

/** The hash that opens one tutorial. `encodeURIComponent` keeps an id that
 * ever grows a `/` inside ONE segment, which is what `app.js`'s
 * `screenFromHash` splits on. */
function readerHash(id) {
  return `#/tut/${encodeURIComponent(id)}`;
}

/**
 * The role each tier's own card carries in the CSS expert's card-role system
 * (styles.css, "CARD ROLES") — `nav` for foundational/orientation material,
 * `content` for advanced/deep material, the same two roles a picker-versus-
 * document split spends on Documentation. Marked with `data-role`, not a
 * class: the composite `class="card pane"` several tests and
 * `e2e/screen-parity.spec.ts`'s kind ledger assert verbatim never changes
 * shape, on this card or the neutral ones around it.
 */
const TIER_ROLE = { basic: 'nav', advanced: 'content' };

/**
 * The list view: the Hebrew rollup, one card per tier — each carrying its own
 * table and its own role colour, scannable at a glance rather than only by
 * reading the heading text — and the sentences that say what a ✅ does and
 * does not mean.
 *
 * THREE (or fewer) cards, not one: `summary` (the rollup, and the empty
 * state) and `notes` (what a ✅ means) are deliberately left with NO
 * `data-role` — they are neither wayfinding nor a reading surface, they are
 * the screen talking about itself, and giving them a colour would spend the
 * system on something it does not mean. A tier with no rows draws no card at
 * all, the same restraint the previous single-card shape already applied to
 * its heading: an empty "Advanced" section is a claim the manifest does not
 * support.
 */
function renderList(root, ctx, body) {
  const summary = el('div', 'card pane');
  root.append(summary);

  // The measured zero, first — before the chips a reader would otherwise have
  // to count for themselves.
  const rollup = el('p', 'small');
  rollup.append(...ctx.t('tu.rollup', {
    done: body.heRollup.done, total: body.heRollup.total,
  }));
  summary.append(rollup);

  if (body.tutorials.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('tu.none'));
    summary.append(none);
    return;
  }

  for (const { tier, key } of TIERS) {
    const rows = body.tutorials.filter((row) => row.tier === tier);
    // A tier with no rows draws no card: an empty table under "Advanced"
    // would be a heading claiming a section the manifest does not have.
    if (rows.length === 0) continue;

    const card = el('div', 'card pane');
    card.dataset.role = TIER_ROLE[tier];

    const heading = el('h3');
    heading.append(...ctx.t(key));

    const headRow = el('tr');
    for (const headKey of HEAD_KEYS) {
      const th = el('th');
      th.append(...ctx.t(headKey));
      headRow.append(th);
    }
    for (const lang of LANG_COLUMNS) headRow.append(el('th', null, lang));
    const thead = el('thead');
    thead.append(headRow);

    const tbody = el('tbody');
    for (const row of rows) {
      const tr = el('tr');

      // **The title is the MANIFEST'S own words, not a key.** It is content
      // the same way `screens/learn.js`'s topic names are the config's own
      // words: this module has no table to look it up in, and inventing one
      // would put a second roster beside the derived one.
      const title = el('td');
      if (row.en === UNMEASURED) {
        // Nothing to open. A link to a document that does not exist is worse
        // than no link: it promises a read and answers a refusal.
        title.textContent = row.title;
      } else {
        const link = el('a', null, row.title);
        link.href = readerHash(row.id);
        title.append(link);
      }

      const id = el('td', 'small');
      id.append(el('span', 'm', row.id));

      tr.append(title, id, languageCell(ctx, row.en), languageCell(ctx, row.he));
      tbody.append(tr);
    }

    const table = el('table');
    table.append(thead, tbody);
    card.append(heading, table);
    root.append(card);
  }

  // What the ✅ means and does not mean — on the screen, per this task, rather
  // than only in this file's header where no reader of the table will find it.
  const notes = el('div', 'card pane');
  const means = el('p', 'small');
  means.append(...ctx.t('tu.donemeans'));
  const unwritten = el('p', 'small');
  unwritten.append(...ctx.t('tu.unwritten'));
  const gap = el('p', 'small');
  gap.append(...ctx.t('tu.gap'));

  notes.append(means, unwritten, gap);
  root.append(notes);
}

/**
 * The reader: one tutorial's markdown, drawn through the app's one renderer.
 *
 * The roster is passed in rather than re-fetched, so the id is validated
 * against the SAME answer the list was drawn from and the reader cannot ask
 * the server for something the list does not offer.
 */
async function renderReader(root, ctx, body, id) {
  const card = el('div', 'card pane');
  root.append(card);

  const back = el('p', 'small');
  const backLink = el('a');
  backLink.href = '#/tut';
  backLink.append(...ctx.t('tu.back'));
  back.append(backLink);
  card.append(back);

  const row = body.tutorials.find((entry) => entry.id === id);
  if (row === undefined) {
    const refusal = el('p', 'small');
    refusal.append(...ctx.t('tu.noid'));
    const named = el('p', 'small');
    named.append(el('span', 'm', id));
    card.append(refusal, named);
    return;
  }

  // A real tutorial is open: this card is the reading surface (card-role
  // "content"), regardless of the tutorial's own tier — the refusal above
  // stays neutral, since there is nothing to read yet.
  card.dataset.role = 'content';

  const head = el('h3', null, row.title);
  const ident = el('p', 'small');
  ident.append(el('span', 'm', row.id));
  card.append(head, ident);

  // **The one place a language decision is made, and it is made on a
  // MEASUREMENT.** `he` is `unmeasured` exactly when there is no Hebrew file to
  // read; anything else means one exists. So a Hebrew reader gets Hebrew where
  // Hebrew exists and a LABELLED English text where it does not — never the
  // silent substitution the spec forbids.
  const hebrewExists = row.he !== UNMEASURED;
  const wantHebrew = ctx.lang === 'he' && hebrewExists;

  let doc;
  try {
    doc = await ctx.api(
      `/api/tutorials/${encodeURIComponent(row.id)}${wantHebrew ? '?lang=he' : ''}`);
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }

  if (ctx.lang === 'he' && !wantHebrew) {
    const note = el('p', 'small');
    note.append(...ctx.t('tu.enonly'));
    card.append(note);
  }

  const md = el('div', 'md');
  md.append(...markdownNodes(doc.markdown, document, ctx.tFlat).nodes);
  card.append(md);

  if (doc.truncated === true) {
    const cut = el('p', 'small');
    cut.append(...ctx.t('tu.trunc'));
    card.append(cut);
  }

  // The renderer's own promise about what it refuses, reused rather than
  // respelled — `dv.mdnote` is the sentence `screens/docs.js` already draws
  // beside the same nodes, and one renderer with two spellings of its own
  // guarantee is two guarantees to keep in step.
  const mdnote = el('p', 'small');
  mdnote.append(...ctx.t('dv.mdnote'));
  card.append(spaced(mdnote));
}

/**
 * Async, and it awaits `GET /api/tutorials` before it can draw either view:
 * the list needs the roster, and the reader needs it too — to check the id it
 * was given against the set that is actually served.
 */
export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'tu.h', 'tu.v', 'tu.sub');

  let body;
  try {
    body = await ctx.api('/api/tutorials');
    if (body === null || typeof body !== 'object' || !Array.isArray(body.tutorials)
      || body.heRollup === null || typeof body.heRollup !== 'object'
      || typeof body.heRollup.done !== 'number' || typeof body.heRollup.total !== 'number') {
      throw new Error('tut: /api/tutorials answered without a tutorials array and a heRollup');
    }
  } catch (error) {
    // The endpoint's own words, drawn INSTEAD of the table and never beside an
    // invented one — the same rule `screens/coverage.js` follows for its own
    // refusal.
    root.append(errorNote(error.message));
    return;
  }

  const id = readerId(currentHash());
  if (id === null) {
    renderList(root, ctx, body);
    return;
  }
  await renderReader(root, ctx, body, id);
}
