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
 *
 * ── IT NOW READS AN ENDPOINT, AND THE TWELVE CELLS ARE COMPUTED ───────────
 *
 * They used to be hard-coded — `TASK-no-endpoint-serves-tutorial-state-so-
 * twelve-cells-are-hard`, filed because no route served `docs/TUTORIAL.md` or
 * `docs/TUTORIAL-ADVANCED.md`, so a hand check against the repository was the
 * only thing behind the twelve done-or-to-write cells this module drew. **A
 * table that says done about a file nobody checked is exactly the kind of
 * claim this project's invariants are written against.**
 *
 * `GET /api/tutorials` (`read-model.ts`'s `apiTutorials`) is that check, run
 * on every request: five of the six rows are measured against a real heading
 * in one of the two tutorial files, the sixth ("when it did not fire") names
 * no heading to check FOR anywhere in either file, and the endpoint answers
 * `unmeasured` for it rather than guessing `done` or `todo` — the same
 * reasoning `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * states for a figure no call can produce. **This screen reuses that
 * standard's own `◌` primitive** (`.chip.unmeas`, `data-g="◌"` — the same
 * shape `doctor.js`, `watch.js` and `app.js` already draw it in) rather than
 * inventing a fourth cell meaning.
 *
 * The endpoint is positional, not keyed: it answers six `{en, he}` pairs in
 * the mockup's own row order, and this module zips them against `TUTORIAL_ROWS`
 * below by index. `read-model.ts` has no business knowing this file's
 * translation keys, and this file already owns them.
 *
 * ── THE EN/HE COLUMNS, WHAT THEY MEAN AND WHAT THEY DO NOT ────────────────
 *
 * `done` means the row's designated heading is present in its file today;
 * `todo` means the file exists and it is not; `unmeasured` means there is
 * nothing on disk this endpoint could check. None of the three is a claim
 * about whether the PROSE under that heading is any good — only that the
 * section exists, which is what "a tutorial nobody checked" needed to become
 * "a tutorial the server looked for."
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
 * Nothing, since 2026-08-25: `lib/i18n.js`'s run grammar carries `{b:}` and
 * `{i:}` and they nest, so `tu.gap`'s bolded "to write" is drawn in full.
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
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';

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
 * The six rows' CONTENT, in the mockup's order, exactly as its `<tbody>`
 * draws them
 * (`docs/design/web-ui-mockup.html` · `<tr><td data-t="tu.1">First twenty minutes</td>` · ~2298).
 *
 * `title` and `job` are KEYS, never text, and this is the one place in the app
 * that names them: `/api/tutorials` answers STATE only (see the header), so
 * the content this array carries has nowhere else it could come from.
 */
export const TUTORIAL_ROWS = [
  { title: 'tu.1', job: 'tu.j1' },
  { title: 'tu.2', job: 'tu.j2' },
  { title: 'tu.3', job: 'tu.j3' },
  { title: 'tu.4', job: 'tu.j4' },
  { title: 'tu.5', job: 'tu.j5' },
  { title: 'tu.6', job: 'tu.j6' },
];

/**
 * The two TRANSLATED column headers, in the mockup's order — the tutorial and
 * the job it answers. Exported for the same reason `TUTORIAL_ROWS` is: the
 * order of the columns is the design of record's, and a test can hold it.
 */
export const HEAD_KEYS = ['tu.t', 'tu.job'];

/** The mockup's two other column headers, untranslated. See the header comment. */
export const LANG_COLUMNS = ['EN', 'HE'];

/**
 * What one language cell contains, as a description rather than as DOM — the
 * one decision this screen makes over what `/api/tutorials` answers, and
 * therefore the one thing a test without a browser can hold.
 *
 * `done` is a bare glyph in a bare `<td>`; `todo` is `<span class="chip warn"
 * data-g="▲">` around `tu.todo`, transcribed from the mockup. `unmeasured` is
 * `<span class="chip unmeas" data-g="◌">` around `strip.unmeasured` —
 * `app.js`'s own key for the same primitive, reused rather than given a
 * fourth spelling in a table this task may not add a key to.
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
 * Async, unlike the version of this screen that hard-coded its twelve cells:
 * `render()` now awaits `GET /api/tutorials` before it can draw a single
 * language cell. `route()` already does `await mod.render(...)`.
 */
export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'tu.h', 'tu.v', 'tu.sub');

  let states;
  try {
    const data = await ctx.api('/api/tutorials');
    if (data === null || typeof data !== 'object' || !Array.isArray(data.tutorials)
      || data.tutorials.length !== TUTORIAL_ROWS.length) {
      throw new Error('tut: /api/tutorials answered without a six-row tutorials array');
    }
    states = data.tutorials;
  } catch (error) {
    // The endpoint's own words, drawn INSTEAD of the table and never beside an
    // invented one — the same rule `screens/coverage.js` follows for its own
    // refusal.
    root.append(errorNote(error.message));
    return;
  }

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
  TUTORIAL_ROWS.forEach((tutorial, i) => {
    const state = states[i];
    const row = el('tr');
    const title = el('td');
    title.append(...ctx.t(tutorial.title));
    // `.small` on the job cell and not on the title: the mockup's own
    // arrangement, and it is what makes the column of jobs read as the answer
    // to the column of titles rather than as a second list of them.
    const job = el('td', 'small');
    job.append(...ctx.t(tutorial.job));
    row.append(title, job, languageCell(ctx, state.en), languageCell(ctx, state.he));
    tbody.append(row);
  });

  table.append(thead, tbody);

  // The mockup's `style="margin-block-start:8px"`, through `spaced()` — a
  // `style` attribute is forbidden by the server's own `style-src 'self'` with
  // no `'unsafe-inline'`, which is the reason that helper exists.
  const gap = el('p', 'small');
  gap.append(...ctx.t('tu.gap'));

  card.append(table, spaced(gap));
  root.append(card);
}
