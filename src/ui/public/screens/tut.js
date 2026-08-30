/**
 * `nav.read` — **Tutorials**, `<section data-p="tut">` in the design of record.
 * Six tutorials, each titled with a JOB rather than a feature, and two columns
 * saying which of them is written in which language.
 *
 * ── THIS SCREEN HAS NO PLAN BEHIND IT, AND THAT CHANGES HOW IT WAS BUILT ──
 *
 * Its own task is named for the fact — `TASK-screens-tut-js-has-no-plan-behind-it`,
 * *"tut is covered by nothing. Owner call whether it is scope or an
 * omission."* — so there is no Step 3 sketch to reconcile with the mockup the
 * way `screens/learn.js` had to. What exists is the mockup, and §4's
 * correction grading the three `nav.read` screens separately
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · ``- **`tut` — Tutorials.** ✅ `tu.v``` · ~1338).
 * Everything below that the mockup does not settle is marked as a judgement
 * call in this task's report rather than resolved quietly here.
 *
 * ── IT READS NO ENDPOINT, AND THAT IS A MEASUREMENT, NOT AN OMISSION ──────
 *
 * `/api/help/:topic` is the obvious candidate and it cannot serve this screen.
 * It answers **four** topics
 * (`src/ui/read-model.ts` · `export const UI_HELP_TOPICS: UiHelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~1488),
 * `mycontext help` itself knows **seven**
 * (`src/core/teach.ts` · `'categories', 'scope', 'capture', 'workflow', 'cli', 'tools', 'slash',` · ~17),
 * and not one of either list is a tutorial: a request for one comes back as
 * the 404 that names what IS served
 * (`src/ui/read-model.ts` · `no help topic "${params.topic}" — topics served here:` · ~1548).
 * The rest of the read surface was read the same way — every `registerRoute`
 * in `src/ui/` — and no route serves `docs/TUTORIAL.md`,
 * `docs/TUTORIAL-ADVANCED.md` or any other file from the repository. **The two
 * tutorials the mockup replaces with six are on disk and unreachable from the
 * browser.**
 *
 * So the six rows are CONTENT, and the string table is where content lives:
 * `tu.1`…`tu.6` are the titles, `tu.j1`…`tu.j6` the jobs, in the mockup's own
 * order. Transcribing them is not inventing them. Fetching a topic this screen
 * does not draw, purely so it could be said to have an endpoint, would be the
 * invention.
 *
 * ── THE EN/HE COLUMNS ARE A CLAIM THIS MODULE MAKES AND CANNOT CHECK ──────
 *
 * Five of six Hebrew cells and one English cell read **to write**; the rest
 * are ✅. Those twelve states are the mockup's, measured by whoever drew it,
 * and `TUTORIALS` below is the only place they exist in the app. Nothing on
 * this server can confirm one: there is no tutorials directory to stat, no
 * endpoint to ask, and `tu.gap` says in the mockup's own words that *"the
 * changelog already records that the tutorials have no parity test"*. **A
 * table that says ✅ about a file nobody checked is exactly the kind of claim
 * this project's invariants are written against**, and it is the loudest open
 * question in this task's report. It is drawn anyway, because the alternative
 * — twelve em dashes on a screen whose entire subject is which tutorials exist
 * — deletes the screen rather than qualifying it.
 *
 * **The claim was checked by hand once, against the repository, and it holds
 * — as SECTIONS, not as six documents.** `tu.1` is `docs/TUTORIAL.md`, whose
 * own title is *"my_context — the first twenty minutes"*. Four of the other
 * five are chapters of `docs/TUTORIAL-ADVANCED.md`: `tu.3` is *"2. Scope, and
 * the policy that inverts it"*, `tu.4` *"4. Budgets, and what happens when
 * they bind"*, `tu.5` *"8. Revisions and the review queue"*, `tu.6` *"6.
 * Pulling items out of a document you already have"*. `tu.2` — *the model did
 * the banned thing* — matches no heading in either file, and it is exactly the
 * one row the mockup marks **to write** in English. So the six the mockup
 * promises are a carve-up of the two that exist, five sixths written and one
 * sixth not; the ✅ is a claim about MATERIAL, and no file on disk is named
 * for any of the six. That reading is a hand check on one day, not a test.
 *
 * What is NOT done, on the spec's explicit instruction: *"Do not ship a toggle
 * that falls back."*
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · `**Do not ship a toggle that` · ~1347).
 * The HE column is a status, never a control. No row links anywhere, because
 * the mockup gives no row a link, an id or an open affordance, and there is
 * nothing behind one to open.
 *
 * ── WHAT THE MOCKUP DRAWS THAT THIS CANNOT ────────────────────────────────
 *
 * **Nothing, since 2026-08-25 — and this paragraph said otherwise until
 * 2026-08-30.** It recorded the one `<b>` run inside `tu.gap`
 * (`docs/design/web-ui-mockup.html` · `<b>to write</b> rather than as a language toggle` · ~2306)
 * as unbuildable, on TWO reasons, and both had expired before it was last read:
 *
 *   - *"`lib/i18n.js`'s grammar has three markers and no emphasis one"*. It has
 *     five. `{b:}` and `{i:}` landed on 2026-08-25 and they NEST, which is the
 *     whole of why that parser stopped being one regex
 *     (`src/ui/public/lib/i18n.js` · `const MARKER = /^\{(mv|m|b|i):/;` · ~35).
 *     `tu.gap` carries `{b:to write}` in both tables today, and so does the
 *     mockup's own `HE` table, so the run is drawn.
 *   - *"adding a key here would fail `strings-parity` in the direction that
 *     names it"*. That direction was dropped on 2026-08-26 by
 *     `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`. No new
 *     key was needed in the end — the VALUE of an existing one was — but the
 *     citation was wrong either way, and it is the citation this screen is one
 *     of fifteen sites of (`plan:walk seq:92`).
 *
 * `TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup` is what
 * closed the first; this screen was listed under it and nobody came back to
 * strike the line. Read the grammar, not a comment about it.
 *
 * **`EN` and `HE` are literals, and the mockup wrote them that way** — the two
 * `<th>` carry no `data-t`, and the string tables declare no key for either.
 * They are language tags, the same kind of thing as `screens/learn.js`'s topic
 * names, which are *"the config's own keys and the selector's own words"*. The
 * consequence is real and stated rather than hidden: in the Hebrew UI these
 * two headers still read `EN` and `HE`.
 *
 * No element here carries a `data-t` attribute, for the reason the shell gives
 * (`src/ui/public/app.js` · `attributes and every string it draws comes through` · ~321):
 * this app has no re-scanner, the א/A control reloads the page, and every
 * screen renders once per language.
 */
import { el, screenHead, spaced } from '/screens/parts.js';

/**
 * The two states a language cell can be in.
 *
 * `todo` is the mockup's own word — `tu.todo`, *"to write"* — and `done` is
 * the ✅ it draws opposite. Two states and no third: the mockup has no cell
 * meaning "partly", and inventing one would need a key that does not exist.
 */
export const DONE = 'done';
export const TODO = 'todo';

/**
 * The six rows, in the mockup's order, exactly as its `<tbody>` draws them
 * (`docs/design/web-ui-mockup.html` · `<tr><td data-t="tu.1">First twenty minutes</td>` · ~2298).
 *
 * A data table rather than six blocks of markup, so that "which tutorial is
 * written in which language" is ONE thing to read and one thing to correct on
 * the day a tutorial is written — and so `test/ui/tut-screen.test.ts` can
 * compare it against the design of record row by row, without a browser.
 *
 * `title` and `job` are KEYS, never text: `tu.1` and `tu.j1` are what the
 * mockup's `data-t` attributes name, and the English words beside them in the
 * mockup are `en.js`'s, not this file's.
 */
export const TUTORIALS = [
  { title: 'tu.1', job: 'tu.j1', en: DONE, he: TODO },
  { title: 'tu.2', job: 'tu.j2', en: TODO, he: TODO },
  { title: 'tu.3', job: 'tu.j3', en: DONE, he: TODO },
  { title: 'tu.4', job: 'tu.j4', en: DONE, he: TODO },
  { title: 'tu.5', job: 'tu.j5', en: DONE, he: TODO },
  { title: 'tu.6', job: 'tu.j6', en: DONE, he: TODO },
];

/**
 * The two TRANSLATED column headers, in the mockup's order — the tutorial and
 * the job it answers. Exported for the same reason `TUTORIALS` is: the order
 * of the columns is the design of record's, and a test can hold it.
 */
export const HEAD_KEYS = ['tu.t', 'tu.job'];

/** The mockup's two other column headers, untranslated. See the header comment. */
export const LANG_COLUMNS = ['EN', 'HE'];

/**
 * What one language cell contains, as a description rather than as DOM — the
 * one decision this screen makes, and therefore the one thing in it that a
 * test without a browser can hold.
 *
 * `done` is a bare glyph in a bare `<td>`; `todo` is `<span class="chip warn"
 * data-g="▲">` around `tu.todo`. `data-g` is transcribed from the mockup and
 * is not what paints the ▲ here: the shipped sheet draws it from the class
 * (`src/ui/public/styles.css` · `.chip.warn::before{content:"▲ "}` · ~539),
 * with `attr(data-g)` only as the base rule, for a chip carrying no meaning
 * class. It is set anyway, because `parts.js`' `tierChip` sets it and one
 * spelling of a chip is the point of that file.
 *
 * **An unknown state throws.** The alternative is a default branch drawing
 * either ✅ over a tutorial nobody wrote or a warning over one that exists,
 * and both are false statements about the repository — the same reason `t()`
 * throws on a key it cannot find rather than rendering blank.
 */
export function cellSpec(state) {
  if (state === DONE) return { kind: 'glyph', glyph: '✅' };
  if (state === TODO) return { kind: 'chip', className: 'chip warn', glyph: '▲', key: 'tu.todo' };
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
 * Synchronous, unlike every other screen's `render`, because there is nothing
 * to await: no endpoint answers this screen (see the header), so there is no
 * refusal to catch and `parts.js`' `errorNote` is not imported. `route()` does
 * `await mod.render(...)`, which is happy with either.
 */
export function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'tu.h', 'tu.v', 'tu.sub');

  const card = el('div', 'card pane');
  const table = el('table');

  // A `<thead>` — the only one on the three `nav.read` screens. Two translated
  // headers, then the two language tags as literals.
  const headRow = el('tr');
  for (const key of HEAD_KEYS) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  for (const lang of LANG_COLUMNS) headRow.append(el('th', null, lang));
  const thead = el('thead');
  thead.append(headRow);

  const tbody = el('tbody');
  for (const tutorial of TUTORIALS) {
    const row = el('tr');
    const title = el('td');
    title.append(...ctx.t(tutorial.title));
    // `.small` on the job cell and not on the title: the mockup's own
    // arrangement, and it is what makes the column of jobs read as the answer
    // to the column of titles rather than as a second list of them.
    const job = el('td', 'small');
    job.append(...ctx.t(tutorial.job));
    row.append(title, job, languageCell(ctx, tutorial.en), languageCell(ctx, tutorial.he));
    tbody.append(row);
  }

  table.append(thead, tbody);

  // The mockup's `style="margin-block-start:8px"`, through `spaced()` — a
  // `style` attribute is forbidden by the server's own `style-src 'self'` with
  // no `'unsafe-inline'`, which is the reason that helper exists.
  const gap = el('p', 'small');
  gap.append(...ctx.t('tu.gap'));

  card.append(table, spaced(gap));
  root.append(card);
}
