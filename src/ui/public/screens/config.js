/**
 * `nav.ch` — **Configure**, `<section data-p="config">` in the design of record.
 * The screen whose verdict is the strongest claim in the product: `cfg.v`,
 * *"the strongest 'a terminal cannot do this'"*.
 *
 * ── ONE PANE PER CONFIGURATION SUBJECT ────────────────────────────────────
 *
 * REWRITTEN 2026-08-29 — `plan:config seq:1`, `plan:walk seq:13`,
 * `plan:walk seq:10`, dispatched as one task because all three land here.
 *
 * `plan:config seq:1` measured what this screen was: *"one flat page. Its
 * sections are Budgets, What changes, a scope-policy strip, Apply this, and
 * Watched documents — which covers three of the seven things config.json
 * actually carries and mixes a preview into the middle of them."* It named the
 * subjects and the shape: **Profile, Categories, Budgets, Watched documents,
 * each with its own heading, its own current value and its own settle step.**
 * That is `composerPane` below, called four times.
 *
 * **The owner's second requirement, given 2026-08-25, governs every pane:**
 * *"every configuration entry is treated as ask or composer does — the user
 * SELECTS wherever possible, and where free text is unavoidable there are
 * explanatory instructions about the value and a default or recommended value
 * as a PLACEHOLDER before the user types."* So every closed vocabulary on this
 * screen is a `.segbar` — `profile`, `tier`, `agentEdits`, `scopePolicy`, all
 * four served as lists by `GET /api/config`'s `meta` — and the three places
 * free text is unavoidable (a prefix, a description, a glob) carry the value
 * IN FORCE as their placeholder and a sentence saying what the value is for.
 * Nothing here invents a vocabulary: a control that offered a value the loader
 * would refuse is a control that composes a refusal.
 *
 * ── THE SCREEN COMPOSES; IT DOES NOT WRITE ────────────────────────────────
 *
 * `.my_context/config.json` is guarded by a deny hook and nothing on this
 * screen writes it — the hook's own words are `cfg.nocmd`'s: *"changes to
 * `.my_context/config.json` are the user's to make — ask, do not edit."* **So
 * this is a TEACHING surface, not an editing one, and a vague instruction here
 * is the defect.** Each pane therefore ends in a **numbered hand-off** with
 * four steps and no fifth (`plan:config seq:4`, built 2026-09-01):
 *
 *   1. the ABSOLUTE path the endpoint reported — `config.path`, the file this
 *      server actually read, never the mockup's abbreviated
 *      `.my_context/config.json`, which is a guess for a workspace elsewhere
 *      on disk — with its own Copy control.
 *   2. **WHERE in the file the block goes, given what the file already
 *      contains.** `pastePlan` decides which of six placements this is and
 *      `placementNote` draws that one's sentence. This step is the reason the
 *      task exists and the reason it was wrong: until 2026-09-01 the Categories
 *      pane composed a top-level `"categories"` key against files that already
 *      had one, and `JSON.parse` resolves a duplicate key to the LAST one — so
 *      following the screen would have silently dropped every other category
 *      override in the reader's file. See `pastePlan`.
 *   3. the exact bytes, as a `<pre class="m">` block indented for the placement
 *      step 2 named (`jsonBlock`), copyable in one gesture.
 *   4. ONE composed command line and the house's single Copy-and-Execute
 *      control, which is what turns a paste into a settled change: it is the
 *      command that CONFIRMS the edit took (`plan:config seq:4`: *"what to run
 *      afterwards to confirm it took"*).
 *
 * Step 4 is `screens/work.js`'s pattern exactly — `PALETTE` + `commandFor` +
 * `composeCommand` + `commandActions`, the same four pieces the Review queue
 * ships, so the line a reader sees and the argv the confirm rebuilds are one
 * computation rendered twice. `verifyPlan` is this file's `revisionPlan`.
 *
 * **Four panes compose a line and one deliberately does not.** No `mycontext`
 * command reads or writes a budget — that is `cfg.nocmd`, still true and still
 * on screen — so the Budgets pane composes NO command line, and drawing one
 * there would be a fake receipt for the one subject the CLI cannot report. What
 * it has instead is the write ruled in on 2026-08-27 (`plan:budget seq:5`,
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`): the
 * `BUDGETS_ID` branch of `src/ui/execute.ts`, behind the same `GET
 * /api/execute/confirm` / `POST /api/execute` pair every boundary command uses.
 * That is unchanged by this rewrite, down to the field-by-field confirm.
 *
 * The four lines, and why each one is the receipt for its own subject:
 *
 *   Profile     `mycontext status` — its first line prints `profile "<name>"`
 *               and the table under it is the per-category count the profile
 *               decides. Measured on this corpus 2026-08-29: `my_context
 *               1.0.2: 681 item(s), profile "standard"`.
 *   Categories  `mycontext list <category>` — the category the pane just
 *               changed, listed. It refuses BY NAME if the paste left the
 *               category unresolvable, which is the failure `plan:config
 *               seq:4` calls the acceptance test.
 *   Watched     `mycontext doctor` — the self-check, which re-reads
 *               `config.json` and reports if it no longer loads. Named
 *               narrowly on purpose: nothing in the CLI PRINTS `watchedDocs`,
 *               and this file's report says so rather than implying doctor
 *               checks the globs.
 *   Wizard      `mycontext list <the new category>` — the same receipt the
 *               Categories pane takes, for the category the flow just defined.
 *               An empty list is the right answer there and is still a receipt:
 *               the category resolved, which is the only claim the paste made.
 *
 * ── THE CATEGORY WIZARD, `plan:config seq:3` ──────────────────────────────
 *
 * Built 2026-09-01 as the fifth pane. Stepped rather than a form because the
 * ordering is real — the tier decides which `agentEdits` default sits under it,
 * and a prefix collision is only knowable against the whole catalogue — and
 * every step offers the legal values rather than expecting them to be known.
 * `meta.updateStores`, `meta.defaultAgentEdits` and `meta.defaultScopePolicy`
 * were added to `read-model-config.ts` in the same edit, DERIVED from
 * `UPDATE_STORES`, `defaultAgentEdits` and `DEFAULT_SCOPE_POLICY` themselves —
 * `plan:builder seq:2`'s rule, which that task cites: the values come from the
 * same constants the parser enforces, so a vocabulary cannot be right in the
 * wizard and wrong in the refusal. Its own docstring carries the rest.
 *
 * It is also the ONE caller `POST /api/config/check` has. `preview` answers
 * what a change would DO and `check` answers what the loader MAKES of it,
 * returning the resolved config to prove it — which is the answer a flow full
 * of defaults needs and the one every other pane already has, because every
 * other pane opens on a category the loader resolved and served.
 *
 * ── THE DELTA PLATE AND THE BLAST PANELS, WHICH WERE THE STANDOFF ─────────
 *
 * `plan:walk seq:10`: config.js would not draw the delta rows because there was
 * no POST, and `styles.css` would not carry the rules because no module drew
 * them. **`ctx.post` shipped 2026-08-23 and had zero callers**; the header this
 * file used to carry still told the next reader the fetcher *"takes a path and
 * nothing else: no method, no body"*, which is why nobody noticed. It is
 * corrected here, in the same edit as the first call, which is what
 * `plan:config seq:2` asked for in those words.
 *
 * Every pane's plate is filled by `POST /api/config/preview`, with the pane's
 * own CANDIDATE config in the body and the shared select grammar in the query
 * (`selectQuery('session-start', null, 'cold')` — one grammar, the same
 * `parseSelectQuery` `/api/select` uses). The response shape was VERIFIED
 * against the running server before a row was drawn, which the task asked for:
 * `{ governing: { becomesInjected, stopsBeingInjected, unchanged },
 * agentEdits, scopePolicy, selection: { before, after } }`.
 *
 * **Every number on a blast panel is measured server-side or it is not drawn.**
 * `cfg.spn` rules out the alternative in its own words — *"`scopePolicyFor`
 * makes its effect computable exactly rather than estimated"* — and
 * `blastReading` reads TWO destructive answers off that one response rather
 * than one, which a browser had to catch: see its own docstring for the panel
 * that said *"No change"* over a budget which had just spilled sixteen items.
 *
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` decides the
 * other half: the Watched documents pane draws NO governing count at all and
 * names itself unmeasured, because `watchedDocs` is read by
 * `src/hooks/post-tool-use.ts` and by nothing the preview endpoint runs.
 * Posting a candidate that differs only in `watchedDocs` returns `0 / 0 /
 * <every item>` — a true zero about a question nobody asked, which is exactly
 * the reading that standard forbids.
 *
 * **The ten `.delta` / `.blast` rules WERE carried on 2026-08-30**
 * (`plan:walk seq:112`), byte-identical from the mockup, and this paragraph
 * said they were "STILL not in `styles.css`" for the hours in between. The
 * standoff broke in the direction predicted here: the stylesheet's own note
 * declined to carry rules "for markup nothing renders", this screen rendered
 * them, and the carry followed.
 *
 * They are `.delta`, `.delta .was`, `.delta .will`, `.delta .arrow`,
 * `.delta.gain`, `.delta.loss`, `.blast`, `.blast.warn`, `.blast.crit` and
 * `.blast b`, and `e2e/config-blast-face.spec.ts` now asserts the COMPUTED
 * difference between a change face and a no-change one — crit red against
 * neutral — rather than the presence of a class.
 *
 * ── WHAT IS SERVED AND DELIBERATELY NOT DRAWN ─────────────────────────────
 *
 * `resolved.ui` arrives on every response and appears nowhere below, and that
 * is now a CHECKED omission rather than an inherited one.
 * `TASK-ui-enabled-is-accepted-strictly-validated-and-read-by`
 * (`plan:rulings seq:42`) is still open, in its own words: *"the key parses, is
 * strictly validated, is documented, and no code reads it. A user who sets it
 * to false gets a UI anyway."* A pane offering `ui.enabled` would assert the
 * setting governs something. It governs nothing, so there is no pane. Cited by
 * id rather than in the `file · fragment · ~line` form because it lives in the
 * corpus at the outer repository root, which is not a path inside this package.
 *
 * `resolved.categories[].enabled` is read but not offered: whether a category
 * exists at all is what `profile` decides, and a per-category `enabled` toggle
 * beside a profile picker gives two controls for one outcome with no rule on
 * screen for which wins. `extraFields` and `updates` are DRAWN as the value in
 * force and are not composable here — they are a list and a nested object, and
 * `plan:config seq:3`'s category wizard is where an editor for them belongs.
 * Both are named in this task's report.
 *
 * `skippedKeys`/`skippedNotice` ARE drawn, and that is a duty: the field's own
 * words are that *"a surface that shows config to a human and does not print
 * this notice has re-created the silent drop this field exists to end"*
 * (`src/ui/read-model-config.ts` · `own words that "a surface that shows config to a human and does not print` · ~63).
 * No string table declares a key for it, so it is drawn in the SERVER'S OWN
 * WORDING, unedited — the treatment `errorNote` gives a refusal.
 *
 * ── THE PURE HALF, AND WHY IT IS EXPORTED ─────────────────────────────────
 *
 * `budgetRows`, `jsonBlock`, `policyPositions`, `categoryEntry`, `valueDeltas`,
 * `blastReading` and `verifyPlan` take plain data and return plain data: no
 * `document`, no `ctx`, no network. They are what
 * `test/ui/config-screen.test.ts` runs under `node --test`. The DOM glue below
 * them is the stated untested surface (spec §6), and the split is what keeps
 * "which number is struck through", "what exactly gets pasted" and "which line
 * would run" out of it.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions, confirmPath, diffTable, viewsFromEffect } from '/lib/command-actions.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { fieldView, selectQuery } from '/lib/viewmodel.js';
import {
  BOUND_CAP_LIST, boundedList, el, errorNote, mono, num, raiseSimRange, screenHead, spaced,
} from '/screens/parts.js';


/**
 * The reserved catalogue-shaped id `src/ui/execute.ts` reads as "the budgets
 * branch, not a catalogue command" — `BUDGETS_ID` there, respelled here
 * because a browser module cannot import a `.ts` constant. The two are one
 * decision, not two, the same relationship `CONFIRM_LANG_ARG` already has
 * between that file and `lib/command-actions.js`. It is not, and must never
 * become, a `palette-defs.js` entry: `test/ui/execute-budgets-route.test.ts`
 * asserts the catalogue names nothing by this id.
 */
const BUDGET_ID = 'config:budgets';

/**
 * The category the Categories pane OPENS on.
 *
 * The mockup hard-codes one: `<h3><span class="m">categories.lesson.scopePolicy</span></h3>`.
 * `lesson` is a real catalogue category (measured: present in the resolved
 * config of this repository and of `.demo-corpus`, both on the `standard`
 * profile), so the design of record's own subject is the opening selection
 * rather than a category picked here — and a config that resolves without it
 * opens on whatever its first category is instead, never on a heading naming a
 * category that does not exist.
 */
export const SP_CATEGORY = 'lesson';

/** An error's message, however it arrived. */
function message(error) {
  return error && error.message ? error.message : String(error);
}

/**
 * `POST /api/config/preview?…` — the ONE path this screen previews through.
 *
 * The query is the shared select grammar, built by the shared builder, because
 * `parseSelectQuery` is the same parser `/api/select`, `/api/render` and
 * `/api/simulate` read and a second spelling of `event=…&cold=1` here is how
 * two of them come to disagree about what a preview is a preview OF.
 *
 * `session-start` and `cold=1`: a brand-new session's answer. That is the
 * question a configuration change is actually about — what the NEXT session
 * gets — and it is the one question that needs no session id, so the pane never
 * has to ask a reader which session they meant before it can answer.
 */
function previewPath() {
  return `/api/config/preview?${selectQuery('session-start', null, 'cold')}`;
}

/**
 * The Budgets table's five rows: `{ key, was, will }`, where `was` is `null`
 * when the file changes nothing and the built-in default is what runs.
 *
 * **The pair is the row** — `cfg.deltan`'s whole argument, in the mockup's own
 * words: *"Each row is the pair, not the direction alone… 'What was it before'
 * is half of 'what changes'."* Here `was` is the SHIPPED DEFAULT and `will` is
 * what this config resolves to, which is a different pairing from the delta
 * plate's (that one is an edit in flight, and an edit in flight is what
 * `POST /api/config/preview` answers). `meta.defaultBudgets` is
 * `DEFAULT_BUDGETS` itself, passed through
 * (`src/ui/read-model-config.ts` · `  defaultBudgets: DEFAULT_BUDGETS,` · ~107).
 *
 * The key ORDER comes from the defaults object, never from a list written here:
 * `BUDGET_KEYS` is derived from `DEFAULT_BUDGETS` on the server too
 * (`src/core/config.ts` · `const BUDGET_KEYS = Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[];` · ~1252),
 * so a sixth budget appears in this table the day it is added and no second
 * spelling of the tier list has to be found and edited.
 */
export function budgetRows(budgets, defaults) {
  const resolved = budgets ?? {};
  return Object.keys(defaults ?? {}).map((key) => {
    const fallback = defaults[key];
    const will = resolved[key] === undefined ? fallback : resolved[key];
    return { key, was: will === fallback ? null : fallback, will };
  });
}

/**
 * One top-level block of `config.json`, as text to paste — `  "budgets": {…}`,
 * indented exactly as `<section data-p="config">`'s two `<pre class="m">`
 * blocks are, two spaces in, because the block is pasted INTO an object.
 *
 * `JSON.stringify(value, null, 2)` and then one extra indent on every line but
 * the first: that is what makes `"pinned"` land at four spaces and the closing
 * brace at two, which is the mockup's own shape and is asserted against the
 * mockup's bytes in `test/ui/config-screen.test.ts`.
 *
 * The KEY goes through `JSON.stringify` as well. It is a constant at every call
 * site, so nothing here needs escaping today — and a composer that hand-wrote
 * its own quotes would be the one place in this file that could emit invalid
 * JSON for a value it did not expect.
 *
 * **`indent` is the depth the block is pasted AT, and it defaults to the two
 * spaces every caller wanted until 2026-09-01.** A category entry is pasted one
 * level further in — inside the file's existing `categories` object rather than
 * beside it — so it lands at four, and `pastePlan` below is the only thing that
 * ever passes the argument. At `2` this composes byte-identical text to what it
 * always did, which is what keeps the assertion against the mockup's own `<pre>`
 * bytes meaningful.
 */
export function jsonBlock(key, value, indent = 2) {
  const pad = ' '.repeat(indent);
  const body = JSON.stringify(value, null, 2).split('\n').join(`\n${pad}`);
  return `${pad}${JSON.stringify(key)}: ${body}`;
}

/**
 * **WHERE the block goes in the file the reader actually has** — the question
 * `plan:config seq:4` names as the acceptance test for the whole composer:
 * *"the file already HAS a categories object, so the block is an entry inside
 * it and not a top-level key — getting that wrong produces invalid JSON and a
 * refusal that reads like the wizard was wrong."*
 *
 * **It was wrong here until 2026-09-01, and measurably so.** The Categories
 * pane composed `  "categories": { "lesson": {…} }` unconditionally, and both
 * corpora this product is developed against — the outer one and `.demo-corpus`
 * — already have a populated `categories` object. `JSON.parse` does not refuse
 * a duplicate key: the LAST one wins. So a reader who followed the screen's own
 * instruction would have silently dropped every other category override in
 * their file, including this repository's own `task` category with its eight
 * extra fields and its five `updates` declarations. A hand-off that is right
 * for an empty config and wrong for a populated one is wrong for every real
 * user, because every real user has a populated one.
 *
 * Six placements, and the pane draws the sentence for the one it is in:
 *
 *   `newfile`       there is no file. The block is the whole of it, braces and
 *                   all — the one case where the composed text is a document
 *                   rather than a fragment.
 *   `newkey`        the file has no such top-level key. Paste inside the
 *                   outermost braces, after a comma.
 *   `replacekey`    the file sets it already. Replace that entry whole.
 *   `newentry`      the key is an object and the entry is not in it yet. The
 *                   block is an entry INSIDE, at four spaces, and `last` names
 *                   the entry it goes after so "after a comma" points at
 *                   something the reader can find.
 *   `newentry0`     the same, into an object with nothing in it, where there is
 *                   no `last` to name and the sentence must not pretend there
 *                   is.
 *   `replaceentry`  the entry is already declared. Replace it whole.
 *
 * `file` is `GET /api/config`'s answer — `exists` and `raw` — never a guess
 * about either. A file that does not parse never reaches here: `render` stops
 * on `parseError` before a pane is built, because a placement computed against
 * a `raw` of `null` would be an instruction about a file nobody can read.
 */
export function pastePlan(file, block) {
  const raw = file && typeof file.raw === 'object' && file.raw !== null && !Array.isArray(file.raw)
    ? file.raw
    : {};
  const { key, value, entry } = block;
  if (file?.exists !== true) {
    const whole = entry === undefined ? value : { [entry]: value };
    return { where: 'newfile', anchor: key, last: null, text: `{\n${jsonBlock(key, whole)}\n}` };
  }
  const declared = Object.hasOwn(raw, key);
  const holder = declared ? raw[key] : undefined;
  const isMap = typeof holder === 'object' && holder !== null && !Array.isArray(holder);
  if (entry !== undefined) {
    // A `categories` key that is absent — or present as something that is not
    // an object, which the loader refuses anyway — is a TOP-LEVEL paste
    // carrying the entry inside it. That is the only branch where the entry
    // form would be wrong, and it is the branch an empty config is in.
    if (!isMap) {
      return {
        where: 'newkey', anchor: key, last: null, text: jsonBlock(key, { [entry]: value }),
      };
    }
    const names = Object.keys(holder);
    return {
      where: Object.hasOwn(holder, entry)
        ? 'replaceentry'
        : (names.length === 0 ? 'newentry0' : 'newentry'),
      anchor: `${key}.${entry}`,
      last: names.length === 0 ? null : names[names.length - 1],
      text: jsonBlock(entry, value, 4),
    };
  }
  return {
    where: declared ? 'replacekey' : 'newkey',
    anchor: key,
    last: null,
    text: jsonBlock(key, value),
  };
}

/**
 * The segbar's three positions for one category: `{ name, current, positions }`
 * with exactly one `pressed`, or `null` when the resolved config has no such
 * category.
 *
 * The three values are `meta.scopePolicies`, in the server's DECLARATION ORDER,
 * which is user-facing rather than incidental — the CLI's refusals list them in
 * that order (`src/ui/read-model-config.ts` · `are passed through in DECLARATION ORDER,` · ~96).
 * A picker that sorted them would teach a different vocabulary from the one the
 * refusal prints. The mockup happens to draw `global`/`required`/`inert`, which
 * is that order — checked, not assumed.
 *
 * `current` is what the CONFIG resolves to. Since 2026-08-29 the bar is a
 * CONTROL rather than a reading: moving it composes a candidate and asks
 * `POST /api/config/preview` "and what would that do to this corpus", which is
 * the question that used to have no answer and is why the bar shipped disabled.
 */
export function policyPositions(categories, policies, name) {
  const category = (categories ?? []).find((c) => c.name === name);
  if (category === undefined) return null;
  return {
    name,
    current: category.scopePolicy,
    positions: (policies ?? []).map((value) => ({ value, pressed: value === category.scopePolicy })),
  };
}

/**
 * The `categories` block a paste has to carry — **an ENTRY INSIDE the object,
 * never a top-level key**, which `plan:config seq:4` names as the acceptance
 * test for the whole composer: *"the file already HAS a categories object, so
 * the block is an entry inside it and not a top-level key — getting that wrong
 * produces invalid JSON and a refusal that reads like the wizard was wrong."*
 *
 * The entry is the RAW file's entry for that category, extended by the fields
 * the reader moved. Raw and not resolved, and that is the whole of the care
 * this function takes: `resolved` carries every field the catalogue supplied
 * as well as the ones the file states, so pasting a resolved entry back would
 * freeze twenty-four defaults into the user's file and silently opt them out of
 * every future catalogue change. What the file said, plus what was changed, is
 * the only merge that leaves the file saying what its author meant.
 *
 * A category the raw file has never mentioned starts from `{}`, which is the
 * same rule one level down.
 */
export function categoryEntry(raw, name, changed) {
  const declared = raw && typeof raw === 'object' && raw.categories
    && typeof raw.categories === 'object' && !Array.isArray(raw.categories)
    ? raw.categories[name]
    : undefined;
  const base = declared && typeof declared === 'object' && !Array.isArray(declared) ? declared : {};
  return { ...base, ...changed };
}

/**
 * The neutral rows of a delta plate: one per configuration VALUE that moved.
 *
 * `{ path, was, will }`, compared as text, because these are values a person
 * typed into a form and `4000` from an `<input>` and `4000` from JSON are the
 * same edit. A key present in `after` and absent from `before` carries
 * `was: null`, which `deltaRow` draws as the arrow alone — the mockup's own
 * treatment for a value that had no previous half.
 *
 * It reports what the FILE would say, never what the corpus would do. The
 * second half is the server's answer and arrives beside these rows; keeping the
 * two apart is what stops this function growing an opinion about a corpus it
 * cannot see.
 */
export function valueDeltas(before, after) {
  const rows = [];
  for (const path of Object.keys(after ?? {})) {
    const was = (before ?? {})[path];
    const will = after[path];
    if (was !== undefined && String(was) === String(will)) continue;
    rows.push({ path, was: was === undefined ? null : String(was), will: String(will) });
  }
  return rows;
}

/**
 * The blast panel's FACE, its level and its counts, read off the preview.
 *
 * `cfg.spn` states what this panel is: *"how much of the corpus stops working
 * if this value changes"*. **Two different answers can be true of that
 * sentence, and reading only one of them shipped a wrong panel** — measured in
 * a browser on 2026-08-29, before this function had its second clause. Dropping
 * `budgets.pinned` from 16,000 to 4,000 on the live corpus moved delivery from
 * 25 items to 9 and spills from 1 to 17, and the panel said *"No change — this
 * is the configuration in force"*, because `governing` is about ELIGIBILITY and
 * a budget never moves `injection()`'s answer. The plate above it was drawing
 * the loss in three rows while the panel underneath denied it.
 *
 * So there are two destructive readings and they are ranked rather than netted:
 *
 *   `stops`   an item stops GOVERNING — a rule that is no longer enforced
 *             anywhere, whatever the budgets are. The stronger claim, so it
 *             wins when both are true.
 *   `spills`  an item still governs and no longer FITS. `select` is what the
 *             hook runs, so `selection.after` is what would actually start
 *             spilling rather than an estimate of it.
 *
 * their two mirrors `starts` and `fits`, which only add, and one reading that
 * is neither — `edits`, which is `agentEdits` moving. **That one was the SAME
 * defect a second time and was caught the same way**: `agentEditsFor` is one of
 * the three lookups the preview runs, it names every item of the category it
 * moves, and none of the other four faces can ever fire on it — an
 * `allow`→`review` change moves neither `injection()` nor `select()`, so a
 * panel reading only those two said "No change" over a measured list of
 * thirty-eight items. `none` is a MEASURED zero and is drawn and named as one
 * rather than left blank; it now means all three lookups agreed.
 *
 * Every number is a length or a count the server computed by running the real
 * functions — `injection()` twice per item, `select()` twice over the same
 * items and context — so nothing here estimates anything. A malformed answer
 * degrades to zeros AND to `none` together, so a panel can never say "0 items"
 * in a crit face.
 */
export function blastReading(preview) {
  const answer = preview ?? {};
  const governing = answer.governing ?? {};
  const list = (value) => (Array.isArray(value) ? value : []);
  const stops = list(governing.stopsBeingInjected).length;
  const becomes = list(governing.becomesInjected).length;
  const unchanged = Number.isFinite(governing.unchanged) ? governing.unchanged : 0;
  const selection = answer.selection ?? {};
  const delivered = (side) => list((selection[side] ?? {}).full).length;
  const dropped = Math.max(0, delivered('before') - delivered('after'));
  const added = Math.max(0, delivered('after') - delivered('before'));
  // Every item of every category whose `agentEdits` moved — the server's own
  // list, not a re-count: it filtered `i.type === name` itself, and spec §4's
  // rule for this answer is that "17 items" is a number a reader has to trust
  // and a list is one they can check.
  const edited = list(answer.agentEdits)
    .reduce((total, row) => total + list(row.items).length, 0);
  const counts = { stops, becomes, dropped, added, edited, unchanged };
  if (stops > 0) return { face: 'stops', level: 'crit', n: stops, ...counts };
  if (dropped > 0) return { face: 'spills', level: 'crit', n: dropped, ...counts };
  if (becomes > 0) return { face: 'starts', level: 'warn', n: becomes, ...counts };
  if (edited > 0) return { face: 'edits', level: 'warn', n: edited, ...counts };
  if (added > 0) return { face: 'fits', level: 'warn', n: added, ...counts };
  return { face: 'none', level: 'none', n: 0, ...counts };
}

/**
 * The line a pane composes, as a catalogue id, a value bag and an argv — the
 * same triple `screens/work.js`'s `revisionPlan` returns, for the same reason.
 *
 * It goes through `commandFor` + `composeCommand` like every other composed
 * line in this UI, so the quoting has a single implementation
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1)
 * and a category name carrying a space is quoted before it ever reaches a
 * clipboard.
 *
 * It THROWS on a name the catalogue does not declare rather than composing a
 * line from a literal array. A second spelling of a command whose flag set was
 * verified against the real argument parser exactly once is how the two come to
 * disagree, and the confirm's whole job is that they cannot.
 */
export function verifyPlan(name, values = {}) {
  const def = PALETTE.find((entry) => entry.name === name);
  if (def === undefined) {
    throw new Error(`config: the command catalogue declares no "${name}"`);
  }
  return { id: def.name, values, argv: commandFor(def, values) };
}

/**
 * `<div class="segbar">` with one `<button aria-pressed>` per legal value —
 * the house's own picker for a closed vocabulary, and the control the mockup
 * itself draws for `scopePolicy`.
 *
 * `role="group"` with `aria-label` names the set, because buttons whose meaning
 * is "which of us is chosen" are a group and not unrelated controls.
 * `aria-pressed` rather than `aria-checked`: these are toggle buttons, not
 * radios in a form, and `.segbar button[aria-pressed="true"]` is the rule that
 * gives the chosen one its gold face.
 *
 * The button's TEXT is the value itself — `global`, `normative`, `standard` —
 * and is deliberately not translated: these are the literals the loader
 * accepts and the refusal prints, so a Hebrew label would teach a vocabulary
 * `config.json` does not have. The same call `work.js` makes about its `stale`
 * chip, in the direction that is unambiguously right here.
 */
function segbar(ariaLabel, values, chosen, pick) {
  const bar = el('div', 'segbar');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', ariaLabel);
  const buttons = [];
  for (const value of values ?? []) {
    const button = el('button', null, value);
    button.type = 'button';
    // Read by `e2e/` to press one position without depending on its WORDING.
    // The same reason `parts.js` stamps `data-step` on its paging controls.
    button.dataset.value = value;
    button.setAttribute('aria-pressed', String(value === chosen()));
    button.addEventListener('click', () => {
      if (value === chosen()) return;
      pick(value);
      for (const [held, node] of buttons) {
        node.setAttribute('aria-pressed', String(held === chosen()));
      }
    });
    buttons.push([value, button]);
    bar.append(button);
  }
  return bar;
}

/**
 * Step 2's sentence: WHERE this block goes, given what the file already
 * contains — one of `pastePlan`'s six placements, drawn as the one it is in.
 *
 * **Six literal calls and not a lookup table**, and the reason is
 * the one `composerPane`'s `spec` states: a key reached through a variable is
 * invisible to `test/ui/config-screen.test.ts`'s scanner, which finds the keys
 * this screen names by matching literal calls against its own bytes. A key
 * missing from the Hebrew table throws at render time, in Hebrew only, which is
 * the failure nobody sees until a reader reports a blank screen.
 */
function placementNote(ctx, plan) {
  if (plan.where === 'newfile') return ctx.t('cfg.pl.newfile');
  if (plan.where === 'replacekey') return ctx.t('cfg.pl.replacekey', { key: plan.anchor });
  if (plan.where === 'replaceentry') return ctx.t('cfg.pl.replaceentry', { key: plan.anchor });
  if (plan.where === 'newentry') return ctx.t('cfg.pl.newentry', { last: String(plan.last) });
  if (plan.where === 'newentry0') return ctx.t('cfg.pl.newentry0');
  return ctx.t('cfg.pl.newkey', { key: plan.anchor });
}

/**
 * A free-text field, with the value IN FORCE as its placeholder.
 *
 * That placeholder is the owner's requirement rather than a nicety: *"where
 * free text is unavoidable there are explanatory instructions about the value
 * and a default or recommended value as a PLACEHOLDER before the user types."*
 * It is `.globin` — the stylesheet's existing input, defined for the
 * Composer's glob field and the only themed text input this sheet ships, so
 * this screen adds no selector `styles.css` would have to gain.
 *
 * `change` and not `input`: the field's job is to compose a candidate and ask
 * the server what it would do, and a preview per keystroke is a request storm
 * answering questions nobody finished asking.
 */
function textField(label, placeholder, value, settle) {
  const input = el('input', 'globin');
  input.type = 'text';
  input.value = value;
  input.setAttribute('placeholder', placeholder);
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => settle(input.value));
  return input;
}

/** A labelled control: the keyed sentence, then the control under it. */
function field(ctx, key, control) {
  const wrap = el('div');
  const label = el('p', 'small');
  label.append(...ctx.t(key));
  wrap.append(label, control);
  return spaced(wrap);
}

/**
 * One `.delta` row — `label was → will`, tinted by direction.
 *
 * `.was` is struck through and `.will` is highlighted; the classes are the
 * mockup's own and are used verbatim, because the pairing is the argument:
 * *"a lone `+1` chip keeps the direction while losing the pairing"*. A row
 * with no `was` draws the arrow and the new value alone, which is what the
 * mockup's own `deltaRow(kind, label, null, will)` branch does.
 */
function deltaRow(row) {
  const box = el('div', row.kind ? `delta ${row.kind}` : 'delta');
  box.append(row.label());
  if (row.was !== null) box.append(el('span', 'was', row.was));
  box.append(el('span', 'arrow', '→'), el('span', 'will', row.will));
  return box;
}

/**
 * The blast panel: `<div class="blast"><b>headline</b><span>detail</span>`,
 * the mockup's own three faces.
 *
 * Every slot it substitutes is a count the server measured. The `none` face is
 * a drawn, named zero — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
 * thing-is` — and the `unmeasured` face is that standard's other clause: it
 * carries NO count at all, because the question this pane's subject raises is
 * one no endpoint answers.
 */
function blastPanel(ctx, blast, extra) {
  const faces = {
    none: ['blast', 'cfg.blast0', 'cfg.blast0n'],
    starts: ['blast warn', 'cfg.blastw', 'cfg.blastwn'],
    edits: ['blast warn', 'cfg.blaste', 'cfg.blasten'],
    fits: ['blast warn', 'cfg.blasta', 'cfg.blastan'],
    stops: ['blast crit', 'cfg.blastc', 'cfg.blastcn'],
    spills: ['blast crit', 'cfg.blasts', 'cfg.blastsn'],
    unmeasured: ['blast', 'cfg.blastu', 'cfg.blastun'],
  };
  const [cls, headKey, noteKey] = faces[blast.face];
  const box = el('div', cls);
  const slots = { n: String(blast.n), unchanged: String(blast.unchanged) };
  const headline = el('b');
  headline.append(...ctx.t(headKey, slots));
  const detail = el('span');
  detail.append(...ctx.t(noteKey, slots));
  box.append(headline, detail);
  if (extra) box.append(extra);
  return box;
}

/**
 * The per-item half of a delta plate: one `.delta.gain` per item that starts
 * governing, one `.delta.loss` per item that stops.
 *
 * BOUNDED, through the shared bound rather than a slice: a profile change moves
 * sixty-six items on this corpus, measured, and an unbounded list is the defect
 * `boundedList` exists to end. `order: 'position'` because these arrive in the
 * STORE's order, which is a property of the corpus and not a time series —
 * `'recent'` would promise a newest-first reading this answer does not carry.
 */
function governanceRows(ctx, plate, preview) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const items = [
    ...list((preview.governing ?? {}).becomesInjected)
      .map((item) => ({ kind: 'gain', id: item.id, wasKey: 'cfg.notgov', willKey: 'cfg.gov' })),
    ...list((preview.governing ?? {}).stopsBeingInjected)
      .map((item) => ({ kind: 'loss', id: item.id, wasKey: 'cfg.gov', willKey: 'cfg.notgov' })),
  ];
  if (items.length === 0) return;
  const host = el('div');
  const bound = boundedList(ctx, host, items, (item) => {
    const box = el('div', `delta ${item.kind}`);
    box.append(mono(item.id));
    box.append(el('span', 'was', ctx.tFlat(item.wasKey)));
    box.append(el('span', 'arrow', '→'), el('span', 'will', ctx.tFlat(item.willKey)));
    return box;
  }, { cap: BOUND_CAP_LIST, order: 'position' });
  plate.append(host, bound);
}

/**
 * The three rows that summarise the SELECTION — what the real selector did,
 * twice, over the same items and the same context.
 *
 * `select` is what the hook runs, so `after.spilled` is what would actually
 * start spilling rather than an estimate of it. Drawn only where a figure
 * MOVED: three identical rows under a change that touched none of them would
 * be three restatements of "nothing happened", which the blast panel above
 * already says once.
 *
 * The token counts carry group separators and the budgets table does not. That
 * asymmetry is the mockup's own — `6000` in the table, `4,260` in the plate —
 * and it is right: the table is the digits a person types into a file, and a
 * separator there is a number they cannot paste back.
 */
function selectionRows(ctx, selection) {
  const before = selection?.before ?? {};
  const after = selection?.after ?? {};
  const size = (value) => (Array.isArray(value) ? value.length : 0);
  const pairs = [
    { key: 'cfg.delivered', was: size(before.full), will: size(after.full), up: 'gain' },
    { key: 'cfg.spilledn', was: size(before.spilled), will: size(after.spilled), up: 'loss' },
    { key: 'cfg.tokensn', was: Number(before.tokens ?? 0), will: Number(after.tokens ?? 0), up: null },
  ];
  return pairs.filter((pair) => pair.was !== pair.will).map((pair) => ({
    kind: pair.up === null
      ? null
      : (pair.will > pair.was ? pair.up : (pair.up === 'gain' ? 'loss' : 'gain')),
    label: () => {
      const span = el('span');
      span.append(...ctx.t(pair.key));
      return span;
    },
    was: num(pair.was),
    will: num(pair.will),
  }));
}

/**
 * **The Budgets pane's Write control — a second, narrower control beside
 * `commandActions`, not a reuse of it.**
 *
 * `commandActions` draws a `<code>` line (the argv) and a Copy button beside
 * Execute, because every OTHER boundary control on this UI composes a CLI
 * command. A budget write composes nothing of the kind — there is no argv, no
 * shell line, nothing to copy — so drawing it here would show a fake command
 * line for the one write this product deliberately keeps out of the CLI's
 * reach (`cfg.nocmd`). What IS shared, imported rather than re-implemented,
 * is the three pieces that do not depend on there being a command:
 * `confirmPath` (the SAME query-string shape `GET /api/execute/confirm`
 * reads, `id` plus values plus `?lang=`), `viewsFromEffect` (the server's
 * `effect` reshaped for `fieldView`) and `diffTable` (the field/in-force/
 * proposed table, headed by `exec.changes`, that every other confirm already
 * draws through). One nonce is minted for this whole page, and it is minted
 * where it always is — the confirm GET `execute.ts` answers — never here.
 *
 * `inputs` is `{ [budgetKey]: <input type=number>, … }`, read at the moment
 * Write is clicked so the values sent are whatever the fields hold THEN, not
 * whatever `budgetRows` computed when the screen loaded. On success every
 * input the write actually changed is updated to the server's own `after`
 * value, so the field a reader is looking at reflects what `config.json` now
 * says without a full-screen reload.
 */
function budgetSaveControl(ctx, inputs) {
  const root = el('div', 'cmdactions');
  const save = el('button');
  save.type = 'button';
  save.append(...ctx.t('cfg.savebtn'));
  root.append(save);

  const confirmBox = el('div', 'confirm');
  confirmBox.hidden = true;
  confirmBox.setAttribute('role', 'group');
  confirmBox.setAttribute('aria-label', ctx.tFlat('cfg.saveh'));
  // Focusable but not in the tab order — `commandActions`' own reason: focus
  // moves here when the confirm opens so its label and the residual are
  // announced before either button is reached.
  confirmBox.tabIndex = -1;

  const result = el('div', 'execresult');
  result.hidden = true;
  result.setAttribute('role', 'status');

  root.append(confirmBox, result);

  const say = (...nodes) => { result.replaceChildren(...nodes); result.hidden = false; };
  const dismiss = () => { confirmBox.replaceChildren(); confirmBox.hidden = true; };

  save.addEventListener('click', async () => {
    result.replaceChildren();
    result.hidden = true;
    dismiss();

    const values = {};
    for (const [key, input] of Object.entries(inputs)) values[key] = input.value;

    // **THE CONTROL IS DISARMED FOR THE DURATION, and it says so** — the same
    // block `lib/command-actions.js` grew on 2026-09-01, carried here on the
    // same day because this is the same GET behind a second button and a
    // reader cannot be expected to know which surface they are on.
    //
    // The confirm GET is not a lookup. Since `plan:execute seq:5b` it DERIVES
    // the effect by copying the whole corpus to a scratch directory and running
    // the command there (`src/ui/execute-effect.ts` · `deriveEffect`), measured
    // on `.demo-corpus` at 5.1s / 6.4s / 7.3s. Until this line existed all of
    // that happened behind a button that changed in no way whatsoever, which is
    // indistinguishable from a control that is broken — and an impatient second
    // press started a SECOND full-corpus dry run and MINTED A SECOND NONCE on
    // the one route this codebase calls the security boundary. One press, one
    // mint.
    //
    // `exec.checking` rather than a Configure-specific key: it describes the
    // GET, which is the same GET, and a second wording for one wait is how two
    // surfaces come to describe the same seconds differently.
    save.disabled = true;
    say(...ctx.t('exec.checking'));

    // The nonce is minted HERE and nowhere else — by the GET that renders
    // this confirm — the same property `commandActions` states and the same
    // route that mints it: `src/ui/execute.ts`'s `handleConfirm`, whichever
    // branch a caller's `id` selects.
    let answer;
    try {
      answer = await ctx.api(confirmPath(BUDGET_ID, values, ctx.lang));
    } catch (error) {
      say(errorNote(message(error)));
      return;
    } finally {
      // Re-armed on BOTH paths, and in a `finally` so a refusal is a state a
      // reader can leave by pressing the button again rather than a control
      // that stays dead until the screen is redrawn.
      save.disabled = false;
    }

    // The question the pending sentence asked has been answered, so it goes:
    // left standing it would sit above the confirm still claiming to be
    // checking, which is a screen saying one thing and meaning another — the
    // same defect the blast panel exists to prevent, arriving in the status
    // region. A refusal keeps its own sentence, because `say()` above replaced
    // this one with the reason.
    result.replaceChildren();
    result.hidden = true;

    const items = viewsFromEffect(answer.effect ?? []);
    confirmBox.replaceChildren();
    confirmBox.append(el('p', 'residual', String(answer.residual ?? '')));
    // One table, no per-item heading: unlike a catalogue command, which may
    // touch several items, a budget write is always exactly one thing —
    // `config.json` — so naming it above the table would say nothing a reader
    // does not already know from the screen they are on.
    for (const item of items) confirmBox.append(diffTable(ctx, item.views.map(fieldView)));

    const go = el('button', 'go');
    go.type = 'button';
    go.append(...ctx.t('cfg.saveg'));
    const cancel = el('button', 'cancel');
    cancel.type = 'button';
    cancel.append(...ctx.t('exec.cancel'));
    confirmBox.append(go, cancel);

    cancel.addEventListener('click', dismiss);
    confirmBox.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dismiss();
    });

    go.addEventListener('click', async () => {
      // One click, one write: the nonce is single-use.
      go.disabled = true;
      dismiss();
      let outcome;
      try {
        outcome = await ctx.post('/api/execute', { id: BUDGET_ID, values, nonce: answer.nonce });
      } catch (error) {
        say(errorNote(message(error)));
        return;
      }
      say(el('span', null, ctx.tFlat('cfg.saved')));
      if (typeof outcome?.auditNote === 'string' && outcome.auditNote !== '') {
        result.append(errorNote(outcome.auditNote));
      }
      // Every field the write actually changed is set to its new value —
      // `outcome.diff`, the SAME `BudgetFieldDiff[]` the confirm rendered, so
      // the field a reader is looking at updates to what the file now says
      // without a full-screen reload that would wipe the message just shown.
      // `cfg.h2`'s receipt ("returning to the tab shows the new value") is
      // still true on a fresh navigation, which re-fetches from disk regardless.
      for (const change of Array.isArray(outcome?.diff) ? outcome.diff : []) {
        const key = String(change.field).replace(/^budgets\./, '');
        const input = inputs[key];
        if (input) input.value = String(change.after);
        // **"Raising a budget past the limit raises the limit"**, performed from
        // this side of it. `raiseSimRange` only ever raises, and does nothing at
        // all where no range has been set — there the simulator's derived bound
        // already carries the budget in force as one of its own terms, so there
        // is nothing here that could be out of step.
        raiseSimRange(key, Number(change.after));
      }
    });

    confirmBox.hidden = false;
    confirmBox.focus();
  });

  return root;
}

/**
 * **One pane, for one configuration subject** — the shape `plan:config seq:1`
 * specified, built once and called four times.
 *
 * A pane is its heading, its explanatory sentence, its controls, its own
 * "What changes" plate and its own settle step. Nothing is shared between two
 * panes at runtime: each holds its own draft, composes its own candidate and
 * asks its own preview, so a reader who moves a budget sees no rows appear
 * under Profile.
 *
 * `spec` is the pane's whole contract:
 *
 *   `key`        the `data-pane` a browser test addresses it by.
 *   `head`       its heading, `note` its sentence — THUNKS, never key strings.
 *                A key reached through a variable is invisible to
 *                `test/ui/config-screen.test.ts`'s scanner, which finds the
 *                keys a screen names by matching a literal `ctx.t(` call
 *                against this file's own bytes; a key missing from the Hebrew
 *                table throws at render time, in Hebrew only, which is the
 *                failure nobody sees until a reader reports a blank screen.
 *                `screens/work.js`'s `LABEL` table is the same device.
 *   `controls`   builds the controls, given the repaint to call on a change.
 *   `values`     the `{ path: value }` the FILE would say — the neutral rows.
 *   `base`       the same paths as the file says them NOW — a thunk for the
 *                same reason `values` is, because on the Categories pane BOTH
 *                sides move with the picker.
 *   `block`      `{ key, value }` for `jsonBlock` — the bytes to paste.
 *   `candidate`  the whole candidate config, or `null` for a subject whose
 *                reach no endpoint measures.
 *   `command`    the line the settle step offers, or `null`.
 *   `pending`    optional: true while the pane's subject is not yet a thing the
 *                loader could be asked about. Only the category wizard is ever
 *                in that state, and while it is, the pane draws its reason and
 *                nothing else — no steps about a block nobody could paste, and
 *                no blast panel over a half-composed category.
 *   `plateId`    the mockup's own id for this plate, where it has one.
 *   `extra`      a node appended inside the blast panel (the scope-policy
 *                pane's unscoped-item count).
 *
 * **The plate is repainted whole on every change, never patched.** The rows,
 * the counts and the panel's own face all belong to ONE candidate; rewriting
 * a number in place and leaving the border colour alone is precisely the "says
 * one thing, means another" defect the panel exists to prevent, arriving from
 * the other side. `token` discards an answer that arrives after a newer one
 * was asked, so a slow preview of an abandoned draft cannot overwrite a fresh
 * one.
 */
function composerPane(ctx, config, spec) {
  const card = el('div', 'card pane');
  card.dataset.pane = spec.key;

  const head = el('h3');
  head.append(...spec.head());
  const note = el('p', 'small');
  note.append(...spec.note());
  card.append(head, note);

  const effectHead = el('h3');
  effectHead.append(...ctx.t('cfg.effect'));
  const plate = el('div', 'plate');
  if (spec.plateId) plate.id = spec.plateId;

  const applyHead = el('h3');
  applyHead.append(...ctx.t('cfg.apply'));
  // **Four numbered steps, and the numbering is the information.** `plan:config
  // seq:4`: *"DO, as numbered steps rather than prose: the absolute path,
  // spelled out and copyable; WHERE in the file the block goes, given what the
  // file already contains; the block itself, copyable in one gesture; and what
  // to run afterwards to confirm it took."* An `<ol>` because these happen in
  // an order and prose loses it — and because a reader who has done two of them
  // needs to see which two.
  const steps = el('ol', 'steps');

  let token = 0;
  let pasteText = '';

  const pasteButton = (label, text, host) => {
    const button = el('button');
    button.type = 'button';
    button.append(...label());
    button.addEventListener('click', () => {
      // Composed and copied, never applied. The user's own editor is the only
      // thing that ever writes this file — which is what keeps the deny hook's
      // rule about `.my_context/config.json` true of this UI as well.
      //
      // A copy that fails says so, in the platform's own words — the treatment
      // `screens/doctor.js` established, for the reason it records: the
      // mockup's own "Copied"/"Copy failed" label swap is an unkeyed ternary in
      // its script, so neither string table can carry it, and inventing the two
      // keys here would fail the parity check.
      navigator.clipboard.writeText(text()).catch((error) => {
        host().after(errorNote(message(error)));
      });
    });
    return button;
  };

  const paint = async () => {
    // **A pane whose subject is not yet complete says so and draws nothing
    // else.** Only the category wizard is ever in this state; every other pane
    // opens on a subject that already exists. Four steps about a block nobody
    // could paste would be worse than no steps, and a blast panel over a
    // half-composed category would be a measurement of a question the loader
    // cannot be asked — which is the `unmeasured` face's job and not this one's,
    // so the plate carries the sentence instead of a panel.
    if (spec.pending && spec.pending()) {
      pasteText = '';
      steps.replaceChildren();
      steps.hidden = true;
      // **REMOVED, not `hidden`.** `.card>h3` sets `display:flex`, which is an
      // AUTHOR rule and beats the UA's `[hidden]{display:none}` — the same
      // defect `.cmd` had, recorded in `screen-parity`'s ledger: the attribute
      // is set, nothing changes, and a heading sits over nothing. `.steps` sets
      // no display of its own, so `hidden` is enough there.
      applyHead.remove();
      const waiting = el('p', 'small');
      waiting.append(...ctx.t('cfg.wizpending'));
      plate.replaceChildren(waiting);
      return;
    }
    steps.hidden = false;
    if (!applyHead.isConnected && steps.parentNode !== null) steps.before(applyHead);

    steps.replaceChildren();
    const block = spec.block();
    const plan = pastePlan(config, block);
    pasteText = plan.text;

    {
      // ── Step 1: the file, spelled in full ────────────────────────────────
      // The ABSOLUTE path the endpoint reports rather than the abbreviated
      // `.my_context/config.json` the mockup draws: `path` is the file this
      // server actually read, and a workspace elsewhere on disk makes the
      // abbreviation a guess. Its own Copy, because a path a reader has to
      // retype is a path they will mistype.
      const openStep = el('li');
      const openNote = el('p', 'small');
      openNote.append(...(plan.where === 'newfile' ? ctx.t('cfg.step1new') : ctx.t('cfg.step1')));
      const cmd = el('div', 'cmd');
      cmd.append(
        el('code', null, config.path),
        pasteButton(() => ctx.t('btn.copypath'), () => config.path, () => cmd),
      );
      openStep.append(openNote, cmd);

      // ── Step 2: WHERE, given what the file already contains ──────────────
      const whereStep = el('li');
      const whereNote = el('p', 'small');
      whereNote.append(...placementNote(ctx, plan));
      whereStep.append(whereNote);

      // ── Step 3: the bytes, copyable in one gesture ───────────────────────
      const blockStep = el('li');
      const blockNote = el('p', 'small');
      blockNote.append(...ctx.t('cfg.step3'));
      const pre = el('pre', 'm', pasteText);
      // `.cmd` and not `.cmdactions`: this is the mockup's own compose-and-copy
      // row, minus the `<code>` — the bytes are the `<pre>` above it, which is
      // too tall for one. `.cmd code` therefore stays at ONE per pane in step 1
      // and one more in step 4, which is what `e2e/config-composer.spec.ts`
      // addresses the path and the command line by.
      const copyRow = el('div', 'cmd');
      copyRow.append(
        pasteButton(() => ctx.t('btn.copypatch'), () => pasteText, () => copyRow),
      );
      blockStep.append(blockNote, pre, copyRow);

      // ── Step 4: what to run afterwards, which is what turns a paste into a
      //    settled change. The line is rebuilt with the draft, because its
      //    ARGUMENT can move with the controls — `mycontext list <category>`
      //    names whichever category the pane is showing. Built inside a `try`:
      //    a pane that cannot compose its line still has three steps worth
      //    following, and the refusal is drawn where the line would have been.
      const runStep = el('li');
      const runNote = el('p', 'small');
      runNote.append(...(spec.command === null ? ctx.t('cfg.step4b') : ctx.t('cfg.step4')));
      runStep.append(runNote);
      if (spec.command !== null) {
        try {
          const line = spec.command();
          const box = el('div', 'cmd');
          box.append(el('code', null, composeCommand(line.argv)));
          runStep.append(box, commandActions({
            argv: line.argv, id: line.id, values: line.values, ctx,
          }));
        } catch (error) {
          runStep.append(errorNote(message(error)));
        }
      }

      steps.append(openStep, whereStep, blockStep, runStep);
    }

    const rows = valueDeltas(spec.base(), spec.values());
    const candidate = spec.candidate();
    if (candidate === null) {
      plate.replaceChildren();
      for (const row of rows) plate.append(deltaRow(neutral(row)));
      plate.append(blastPanel(ctx, { face: 'unmeasured', level: 'none', n: 0, unchanged: 0 }));
      return;
    }

    const mine = ++token;
    let answer;
    try {
      answer = await ctx.post(previewPath(), { candidate });
    } catch (error) {
      if (mine !== token) return;
      // The endpoint's own wording, unedited. A candidate the loader refuses
      // comes back as `resolveConfig`'s message verbatim, which is the same
      // sentence the CLI prints — the property `apiConfigPreview` was built to
      // have, and a paraphrase here would be a second wording for one refusal.
      plate.replaceChildren(errorNote(message(error)));
      return;
    }
    if (mine !== token) return;

    plate.replaceChildren();
    for (const row of rows) plate.append(deltaRow(neutral(row)));
    for (const row of selectionRows(ctx, answer.selection)) plate.append(deltaRow(row));
    governanceRows(ctx, plate, answer);
    plate.append(blastPanel(ctx, blastReading(answer), spec.extra ? spec.extra(answer) : null));
  };

  const controls = spec.controls(paint);
  card.append(controls, effectHead, plate, applyHead, steps);
  void paint();
  return card;
}

/** A value row, as `deltaRow` takes it: the config path drawn as a mono run. */
function neutral(row) {
  return { kind: null, label: () => mono(row.path), was: row.was, will: row.will };
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'cfg.h', 'cfg.v', 'cfg.sub');

  let config;
  try {
    // Fresh from disk on every call, by the endpoint's own design — which is
    // what `cfg.h2` promises the reader as the receipt: *"this screen re-reads
    // config.json from disk on every load, so returning to the tab shows the
    // new value"*. Nothing is cached here; `render` runs per navigation.
    config = await ctx.api('/api/config');
  } catch (error) {
    // INSTEAD of the panes, never beside them. A config that could not be read
    // and a config with nothing unusual in it are opposite facts, and four
    // panes of defaults would report the second one.
    root.append(errorNote(message(error)));
    return;
  }

  // A file that does not parse, and a file that does not load, are FIELDS here
  // rather than 500s — the endpoint carries them precisely so this screen can
  // show the text to fix. Both are hard stops: `resolved` is null in the first
  // case and null in the second, so there is nothing to draw underneath.
  //
  // **WHICH of the two failures it is, is now worded; the loader's sentence
  // under it still is not.** This comment used to say the plan's names for
  // these keys — `configure.parseError` / `configure.resolveError` — "were
  // never added, and adding them would fail
  // `test/ui/strings-parity.test.ts` in the direction that names a key the
  // design of record does not declare". That direction was dropped on
  // 2026-08-26 by `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`
  // and the gate has had one mockup-facing check ever since. `cfg.parseErr` and
  // `cfg.resolveErr` are those two keys, in both tables.
  //
  // The loader's own message follows each, through `errorNote`, which words its
  // own frame and says in the sentence that what it wraps is untranslated. The
  // two facts are different: WHICH failure this is, is the product's to say and
  // is now said in the reader's language; WHAT the loader found is the loader's
  // to say and is shown as it arrived.
  const stop = (key, text) => {
    const lead = el('p', 'small');
    lead.append(...ctx.t(key));
    root.append(lead, errorNote(text));
  };
  if (config.parseError !== null) {
    stop('cfg.parseErr', config.parseError);
    return;
  }
  if (config.resolveError !== null) {
    stop('cfg.resolveErr', config.resolveError);
    return;
  }
  const resolved = config.resolved;
  const meta = config.meta;
  // The RAW file, which is what a candidate is built from and what a paste
  // edits. `structuredClone` per pane below, so one pane's draft can never
  // reach another's candidate through a shared object.
  const raw = config.raw !== null && typeof config.raw === 'object' && !Array.isArray(config.raw)
    ? config.raw
    : {};

  // R14.2's disclosure, in the one sentence `skippedKeyNotice` composes. Drawn
  // above the panes because it is about the FILE rather than about any one
  // setting, and drawn at all because the alternative is the silent drop the
  // field exists to end. Empty for every config this build fully understands,
  // which is nearly all of them — measured empty on this repository and on
  // `.demo-corpus`.
  if (resolved.skippedKeys.length > 0) {
    root.append(el('p', 'small', resolved.skippedNotice));
  }

  // `cfg.deltan` is the design of record's argument for the ROW SHAPE, and it
  // is drawn ONCE, here, rather than under each of the four plates: it explains
  // how every plate on the screen reads, and four copies of one paragraph is a
  // screen arguing with itself.
  const deltaNote = el('p', 'small');
  deltaNote.append(...ctx.t('cfg.deltan'));
  root.append(spaced(deltaNote));

  // ── Pane 1: Profile ──────────────────────────────────────────────────────
  // A closed set of two, served as `meta.profiles` — `Object.keys(PROFILES)`,
  // passed through. The segbar is the whole control; there is no free text on
  // this subject at all.
  let profile = resolved.profile;
  const profilePane = composerPane(ctx, config, {
    key: 'profile',
    head: () => ctx.t('cfg.profile'),
    note: () => ctx.t('cfg.profilen'),
    plateId: null,
    controls: (paint) => field(ctx, 'cfg.inforce', segbar(
      ctx.tFlat('cfg.profile'), meta.profiles, () => profile,
      (value) => { profile = value; void paint(); },
    )),
    base: () => ({ profile: resolved.profile }),
    values: () => ({ profile }),
    block: () => ({ key: 'profile', value: profile }),
    candidate: () => ({ ...structuredClone(raw), profile }),
    // `mycontext status` prints `profile "<name>"` on its first line and the
    // per-category table under it — the two things this pane changes, in one
    // read. Measured on this corpus 2026-08-29.
    command: () => verifyPlan('status'),
    extra: null,
  });

  // ── Pane 2: Budgets ──────────────────────────────────────────────────────
  // The mockup's table, row for row: `<td class="m">jit</td>` and a value cell
  // that is either the number or the PAIR, `6000 → <b>8000</b>`, plus one
  // `<input type="number">` per row in a third column.
  //
  // Numbers are drawn WITHOUT group separators, which is the mockup's own
  // choice here and not an oversight of `num()`: `<section data-p="config">`
  // writes `6000` in this table and `6,000` in the delta plate. The table is
  // the file's literal value — the digits a user types into `config.json` — and
  // a separator in that cell would be a number they cannot paste back.
  const budgetInputs = {};
  const budgetDraft = () => {
    const values = {};
    for (const [key, input] of Object.entries(budgetInputs)) values[key] = Number(input.value);
    return values;
  };
  const budgetsPane = composerPane(ctx, config, {
    key: 'budgets',
    head: () => ctx.t('cfg.budgets'),
    note: () => ctx.t('cfg.budgetsn'),
    plateId: 'cfgdelta',
    controls: (paint) => {
      const wrap = el('div');
      const table = el('table');
      const body = el('tbody');
      for (const row of budgetRows(resolved.budgets, meta.defaultBudgets)) {
        const tr = el('tr');
        const value = el('td', 'm');
        if (row.was === null) {
          value.append(String(row.will));
        } else {
          // `<b>` on the value in force, exactly as the mockup bolds the new
          // half of its pair: the default is context, the resolved value runs.
          value.append(`${row.was} → `, el('b', null, String(row.will)));
        }
        // `min="1"` and `step="1"` are a UX hint only; the SERVER is the
        // validator (`requirePositiveIntegerBudget`, `src/core/budgets-write.ts`),
        // refusing by name rather than clamping, and a browser that skipped this
        // attribute would still be refused correctly. Pre-filled with `row.will`
        // — what the file resolves to right now — never `row.was`, the default,
        // which is what the placeholder carries instead.
        const input = el('input', 'm');
        input.type = 'number';
        input.min = '1';
        input.step = '1';
        input.value = String(row.will);
        input.setAttribute('placeholder', String(meta.defaultBudgets[row.key]));
        input.setAttribute('aria-label', `budgets.${row.key}`);
        input.addEventListener('change', () => { void paint(); });
        budgetInputs[row.key] = input;
        const editCell = el('td');
        editCell.append(input);
        tr.append(el('td', 'm', row.key), value, editCell);
        body.append(tr);
      }
      table.append(body);
      // `cfg.nocmd` belongs to THIS pane and to no other: it is the sentence
      // that says why a budget is written here and nowhere else, and why this
      // is the one pane on the screen with no command line under it.
      const nocmd = el('p', 'small');
      nocmd.append(...ctx.t('cfg.nocmd'));
      wrap.append(table, budgetSaveControl(ctx, budgetInputs), spaced(nocmd));
      return wrap;
    },
    base: () => Object.fromEntries(budgetRows(resolved.budgets, meta.defaultBudgets)
      .map((row) => [`budgets.${row.key}`, row.will])),
    values: () => Object.fromEntries(
      Object.entries(budgetDraft()).map(([key, value]) => [`budgets.${key}`, value])),
    block: () => ({ key: 'budgets', value: budgetDraft() }),
    candidate: () => ({ ...structuredClone(raw), budgets: budgetDraft() }),
    // NO command line, deliberately. `cfg.nocmd`, drawn in this pane: no
    // `mycontext` command edits or reports a budget, and a composed line here
    // would be a receipt for a read the CLI cannot perform.
    command: null,
    extra: null,
  });

  const two = el('div', 'two');
  two.append(profilePane, budgetsPane);
  root.append(two);

  // ── Pane 3: Categories ───────────────────────────────────────────────────
  //
  // The one pane with more than one field, because a category IS more than one
  // field: `tier`, `scopePolicy`, `agentEdits` are closed sets and become
  // segbars; `prefix` and `description` are free text and carry the value in
  // force as their placeholder. `extraFields` and `updates` are shown as the
  // value in force and are not composable — a list and a nested object, and
  // `plan:config seq:3`'s wizard is where an editor for them belongs.
  //
  // **The scope-policy segbar is a CONTROL now.** It shipped disabled because
  // moving it would have to answer "and what would that do to this corpus",
  // and the fetcher could not ask. It can: each position composes a candidate
  // and the panel below is the SERVER's count, exact because `scopePolicyFor`
  // and `injection` run over the real corpus — which is the whole reason the
  // POST exists (`cfg.spn`: "computable exactly rather than estimated").
  const names = (resolved.categories ?? []).map((c) => c.name);
  if (names.length > 0) {
    let chosen = names.includes(SP_CATEGORY) ? SP_CATEGORY : names[0];
    let draft = {};
    const inForce = () => (resolved.categories ?? []).find((c) => c.name === chosen) ?? {};
    const settled = (fieldName) => (Object.hasOwn(draft, fieldName)
      ? draft[fieldName]
      : inForce()[fieldName]);

    const categoriesPane = composerPane(ctx, config, {
      key: 'categories',
      head: () => ctx.t('cfg.cats'),
      note: () => ctx.t('cfg.catsn'),
      plateId: 'spout',
      controls: (paint) => {
        const wrap = el('div');

        // A bare `<select class="path">` — twenty-five categories is not a
        // segbar, and `.path` is the treatment `screens/preview.js` already
        // gives a long closed list on this stylesheet.
        const picker = el('select', 'path');
        picker.setAttribute('aria-label', ctx.tFlat('cfg.catpick'));
        for (const name of names) {
          const option = el('option', null, name);
          option.value = name;
          if (name === chosen) option.selected = true;
          picker.append(option);
        }
        const heading = el('p', 'small');
        const path = mono(`categories.${chosen}`);
        heading.append(path);
        picker.addEventListener('change', () => {
          chosen = picker.value;
          // A different category is a different subject, so the draft does not
          // travel with it: carrying `tier: 'normative'` from `lesson` onto
          // `rule` would compose a change to a category the reader never
          // looked at. The controls are rebuilt from the new category's own
          // values by the repaint below.
          draft = {};
          rebuild();
          void paint();
        });

        const body = el('div');
        const rebuild = () => {
          body.replaceChildren();
          path.textContent = `categories.${chosen}`;
          const current = inForce();
          const pick = (name) => (value) => { draft[name] = value; void paint(); };
          body.append(
            field(ctx, 'cfg.tier', segbar(
              ctx.tFlat('cfg.tier'), meta.tiers, () => settled('tier'), pick('tier'))),
            // `aria.scopepolicy` is the key the mockup itself hangs on this bar
            // (`data-t-aria="aria.scopepolicy"`), and an attribute cannot hold
            // an element, which is the sink `tFlat` exists for.
            field(ctx, 'cfg.policy', segbar(
              ctx.tFlat('aria.scopepolicy'), meta.scopePolicies,
              () => settled('scopePolicy'), pick('scopePolicy'))),
            field(ctx, 'cfg.agentedits', segbar(
              ctx.tFlat('cfg.agentedits'), meta.agentEdits,
              () => settled('agentEdits'), pick('agentEdits'))),
            field(ctx, 'cfg.prefix', textField(
              `categories.${chosen}.prefix`, String(current.prefix ?? ''),
              String(settled('prefix') ?? ''), pick('prefix'))),
            field(ctx, 'cfg.desc', textField(
              `categories.${chosen}.description`, String(current.description ?? ''),
              String(settled('description') ?? ''), pick('description'))),
          );
          // Read, drawn, and NOT composable — said on screen rather than left
          // to be discovered as a missing control.
          const extras = el('p', 'small');
          extras.append(...ctx.t('cfg.extran', {
            fields: (current.extraFields ?? []).join(', ') || '—',
          }));
          body.append(spaced(extras));
        };
        rebuild();

        // The blast-radius sentence sits with the bar it is about, exactly as
        // the design of record places it.
        const spNote = el('p', 'small');
        spNote.append(...ctx.t('cfg.spn'));
        wrap.append(heading, picker, body, spaced(spNote));
        return wrap;
      },
      // The in-force value of every field the reader has touched, so a row is
      // drawn only where the draft actually DIFFERS and it can carry the pair —
      // "what was it before" is half of "what changes". A static `{}` here drew
      // an arrow-only row for a field moved away and moved back, which is a
      // change nobody made.
      base: () => Object.fromEntries(Object.keys(draft)
        .map((name) => [`categories.${chosen}.${name}`, inForce()[name]])),
      values: () => Object.fromEntries(Object.keys(draft)
        .map((name) => [`categories.${chosen}.${name}`, draft[name]])
        .filter(([, value]) => value !== undefined)),
      // `entry`, so `pastePlan` composes an entry INSIDE the file's existing
      // `categories` object rather than a second top-level key beside it. That
      // is `plan:config seq:4`'s acceptance test, and it was wrong here until
      // 2026-09-01: this pane wrapped the entry in `{ categories: { … } }`
      // unconditionally, against files that already had one.
      block: () => ({ key: 'categories', value: categoryEntry(raw, chosen, draft), entry: chosen }),
      candidate: () => {
        const next = structuredClone(raw);
        const categories = next.categories && typeof next.categories === 'object'
          && !Array.isArray(next.categories) ? next.categories : {};
        next.categories = { ...categories, [chosen]: categoryEntry(raw, chosen, draft) };
        return next;
      },
      // The category the pane is showing, listed. It refuses BY NAME if the
      // paste left the category unresolvable, which is the acceptance test
      // `plan:config seq:4` names.
      command: () => verifyPlan('list', { category: chosen }),
      // The scope-policy half of the answer, which no other pane has: the
      // UNSCOPED items of this category, whose reach that setting decides. It
      // is the mockup's own "7 items become injectable nowhere", measured —
      // `unscopedItems` is the list the server filtered, and its length is
      // the count.
      extra: (answer) => {
        const entry = (Array.isArray(answer.scopePolicy) ? answer.scopePolicy : [])
          .find((row) => row.category === chosen);
        if (entry === undefined) return null;
        const line = el('span');
        line.append(...ctx.t('cfg.unscoped', {
          n: String((entry.unscopedItems ?? []).length), cat: chosen, policy: entry.after,
        }));
        return line;
      },
    });
    root.append(categoriesPane);
  }

  // ── Pane 3b: Create a category — `plan:config seq:3` ─────────────────────
  //
  // *"A very structured way to create a new category with every detail
  // possible selected by the user; a wizard is an option."* — owner, 2026-08-23.
  //
  // **A WIZARD RATHER THAN A FORM, and the task's argument survives scrutiny:**
  // *"tier changes which other choices are legal, and a prefix that collides is
  // only knowable against the whole catalogue."* Both are real here. The tier
  // decides which `agentEdits` value the loader would fill in for a reader who
  // never touches that step — `meta.defaultAgentEdits`, computed by
  // `defaultAgentEdits` itself on the server — so step 6 opens pressed on a
  // different position depending on what step 3 chose. And a prefix collision
  // is a fact about the WHOLE resolved catalogue, not about the field: step 2
  // is checked against every `prefix` `GET /api/config` served, which is the
  // only place that list exists in this page.
  //
  // **Every step offers the legal values rather than expecting them to be
  // known**, and every one of them is DERIVED — `plan:builder seq:2`'s rule,
  // which this task cites: the values come from the same constants the parser
  // enforces. `meta.tiers` is pinned to the `Tier` union at compile time,
  // `meta.agentEdits` and `meta.scopePolicies` are `AGENT_EDITS`/
  // `SCOPE_POLICIES` in declaration order, and `meta.updateStores` is the array
  // `requireUpdatableName` validates `store` against. Nothing here spells a
  // vocabulary a second time, so a vocabulary cannot be right in the wizard and
  // wrong in the refusal.
  //
  // **The two free-text steps are checked here and the CHARACTER grammar is
  // not.** Name and prefix collisions are computable from what was served;
  // `requirePrefix`'s "1-12 letters or digits" is a regex in `core/config.ts`
  // that is not exported, and restating it in a browser module would be exactly
  // the second spelling this file refuses everywhere else. The candidate goes to
  // `POST /api/config/preview`, which refuses an unloadable config with
  // `resolveConfig`'s message VERBATIM, and the plate draws that refusal. So the
  // rule is taught by the loader that owns it, in the loader's own words.
  //
  // **It composes; it does not write** — owner decision 2026-08-23, unchanged.
  // It ends in the same four-step hand-off every other pane ends in, which is
  // `plan:config seq:4` and is the reason these two tasks were built together.
  const WIZ_STEPS = 8;
  const wizPrefixes = new Map((resolved.categories ?? [])
    .map((c) => [String(c.prefix ?? '').toUpperCase(), c.name]));
  const wizNames = new Set(names);
  const wizUpdateRow = () => ({ name: '', store: meta.updateStores[0], values: '', projectsTo: '', note: '' });
  let wizAt = 0;
  const wiz = {
    name: '', prefix: '', tier: meta.tiers[0], description: '', extraFields: '',
    agentEdits: null, scopePolicy: null, updates: [],
  };
  /** A comma-separated free-text field as the list the loader wants. */
  const wizList = (text) => String(text).split(',').map((v) => v.trim()).filter((v) => v !== '');
  const wizName = () => wiz.name.trim();
  const wizPrefix = () => wiz.prefix.trim();
  // The tier's default, PRESSED rather than assumed: a reader who never opens
  // step 6 gets what the loader would have filled in, and can see that they did.
  const wizEdits = () => (wiz.agentEdits ?? meta.defaultAgentEdits[wiz.tier]);
  const wizPolicy = () => (wiz.scopePolicy ?? meta.defaultScopePolicy);
  const wizUpdates = () => {
    const out = {};
    for (const row of wiz.updates) {
      const name = row.name.trim();
      if (name === '') continue;
      const entry = { store: row.store };
      const values = wizList(row.values);
      if (values.length > 0) entry.values = values;
      if (row.projectsTo.trim() !== '') entry.projectsTo = row.projectsTo.trim();
      if (row.note.trim() !== '') entry.note = row.note.trim();
      out[name] = entry;
    }
    return out;
  };
  /**
   * The entry the file would gain. Only what the reader actually said: a key
   * left alone is ABSENT rather than written at its default, for the same
   * reason `categoryEntry` merges over the raw file rather than the resolved
   * one — freezing today's defaults into a user's config opts them out of every
   * future change to them, silently.
   */
  const wizValue = () => {
    const value = { tier: wiz.tier, description: wiz.description.trim() };
    if (wizPrefix() !== '') value.prefix = wizPrefix();
    const extras = wizList(wiz.extraFields);
    if (extras.length > 0) value.extraFields = extras;
    if (wiz.agentEdits !== null) value.agentEdits = wiz.agentEdits;
    if (wiz.scopePolicy !== null) value.scopePolicy = wiz.scopePolicy;
    const updates = wizUpdates();
    if (Object.keys(updates).length > 0) value.updates = updates;
    return value;
  };
  const wizCandidate = () => {
    const next = structuredClone(raw);
    const categories = next.categories && typeof next.categories === 'object'
      && !Array.isArray(next.categories) ? next.categories : {};
    next.categories = { ...categories, [wizName()]: wizValue() };
    return next;
  };
  // The two the LOADER requires of a custom category, and nothing else:
  // `resolveConfig` refuses one that declares neither tier nor description by
  // name. Everything past them has a default the loader fills in, which is why
  // the flow can be finished from step 4 and the remaining steps are offers
  // rather than gates.
  const wizReady = () => wizName() !== '' && !wizNames.has(wizName())
    && wiz.description.trim() !== '';

  const wizardPane = composerPane(ctx, config, {
    key: 'wizard',
    head: () => ctx.t('cfg.wiz'),
    note: () => ctx.t('cfg.wizn'),
    plateId: null,
    pending: () => !wizReady(),
    controls: (paint) => {
      const wrap = el('div');
      const progress = el('p', 'small');
      const body = el('div');
      const refusal = el('p', 'small');
      const receipt = el('div');
      const bar = el('div', 'cmdactions');
      const back = el('button');
      back.type = 'button';
      back.append(...ctx.t('cfg.wizback'));
      const next = el('button');
      next.type = 'button';
      next.append(...ctx.t('cfg.wiznext'));
      bar.append(back, next);

      /**
       * The step's own refusal, or null. It is what disables Next, so the flow
       * cannot carry an illegal value forward and discover it four steps later
       * — which is the whole of what "real ordering and cross-field validation"
       * buys over a form.
       */
      const stop = () => {
        if (wizAt === 0) {
          if (wizName() === '') return () => ctx.t('cfg.wz.need');
          if (wizNames.has(wizName())) return () => ctx.t('cfg.wz.taken', { name: wizName() });
          return null;
        }
        if (wizAt === 1) {
          const held = wizPrefixes.get(wizPrefix().toUpperCase());
          if (wizPrefix() !== '' && held !== undefined) {
            return () => ctx.t('cfg.wz.pfxtaken', { prefix: wizPrefix(), cat: held });
          }
          return null;
        }
        if (wizAt === 3 && wiz.description.trim() === '') return () => ctx.t('cfg.wz.need');
        return null;
      };

      /**
       * `POST /api/config/check` — the ONE caller this endpoint has, and the
       * reason it is called here and nowhere else on this screen.
       *
       * `preview` answers what a change would DO; `check` answers what the
       * loader MAKES of it, and returns the resolved config to prove it. That
       * second answer is this flow's whole subject: a wizard that offers a
       * default has to be able to show what the default resolved TO, and every
       * other pane opens on a category the loader already resolved and served.
       * It is a read — `read-model-config.ts` says of itself that everything in
       * it reads, validates and previews and nothing writes — and
       * `test/ui/no-writes.test.ts` holds the server's import graph to that.
       */
      // `token` for the same reason `composerPane`'s `paint` has one, and it was
      // MEASURED missing: every step change asks again, and two answers in
      // flight both cleared and both appended, so the receipt rendered twice on
      // screen. An answer that arrives after a newer one was asked is discarded.
      let receiptToken = 0;
      const refreshReceipt = async () => {
        const mine = ++receiptToken;
        receipt.replaceChildren();
        if (!wizReady()) return;
        let answer;
        try {
          answer = await ctx.post('/api/config/check', { candidate: wizCandidate() });
        } catch (error) {
          if (mine !== receiptToken) return;
          receipt.replaceChildren(errorNote(message(error)));
          return;
        }
        if (mine !== receiptToken) return;
        receipt.replaceChildren();
        // `ok: false` is this endpoint's SUCCESS case — "no, and here is why",
        // in `resolveConfig`'s own words, which is the same sentence the CLI
        // prints. Drawn through `errorNote`, which words its own frame and says
        // what it wraps is untranslated.
        if (answer.ok !== true) {
          receipt.append(errorNote(String(answer.error ?? '')));
          return;
        }
        const entry = (answer.resolved?.categories ?? []).find((c) => c.name === wizName());
        if (entry === undefined) return;
        const note = el('p', 'small');
        note.append(...ctx.t('cfg.wz.resolved'));
        receipt.append(note, el('pre', 'm', JSON.stringify(entry, null, 2)));
      };

      const rebuild = () => {
        progress.replaceChildren();
        progress.append(...ctx.t('cfg.wizstep', {
          n: String(wizAt + 1), total: String(WIZ_STEPS),
        }));
        body.replaceChildren();
        const settle = (name) => (value) => { wiz[name] = value; rebuild(); void paint(); };
        // One step on screen at a time. Each is its keyed instruction and its
        // control, and the instruction says what the value is FOR — the owner's
        // 2026-08-25 requirement for every free-text entry on this screen.
        if (wizAt === 0) {
          // The `aria-label` is the config KEY this step composes, spelled the
          // way the other steps spell theirs — `name`, `prefix`, `description`,
          // `extraFields` — so a reader hearing it hears the key they are about
          // to paste. The sentence above the control is what says what it means.
          body.append(field(ctx, 'cfg.wz.name', textField(
            'name', ctx.tFlat('cfg.wz.namehint'), wiz.name, settle('name'))));
        } else if (wizAt === 1) {
          body.append(field(ctx, 'cfg.wz.prefix', textField(
            'prefix', wizName().replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase(),
            wiz.prefix, settle('prefix'))));
        } else if (wizAt === 2) {
          body.append(field(ctx, 'cfg.tier', segbar(
            ctx.tFlat('cfg.tier'), meta.tiers, () => wiz.tier, settle('tier'))));
        } else if (wizAt === 3) {
          body.append(field(ctx, 'cfg.wz.desc', textField(
            'description', ctx.tFlat('cfg.wz.deschint'), wiz.description, settle('description'))));
        } else if (wizAt === 4) {
          body.append(field(ctx, 'cfg.wz.extra', textField(
            'extraFields', ctx.tFlat('cfg.wz.extrahint'), wiz.extraFields,
            settle('extraFields'))));
        } else if (wizAt === 5) {
          body.append(field(ctx, 'cfg.agentedits', segbar(
            ctx.tFlat('cfg.agentedits'), meta.agentEdits, wizEdits, settle('agentEdits'))));
        } else if (wizAt === 6) {
          body.append(field(ctx, 'cfg.policy', segbar(
            ctx.tFlat('aria.scopepolicy'), meta.scopePolicies, wizPolicy,
            settle('scopePolicy'))));
        } else {
          const head = el('p', 'small');
          head.append(...ctx.t('cfg.wz.updates'));
          body.append(spaced(head));
          if (wiz.updates.length === 0) {
            const none = el('p', 'small');
            none.append(...ctx.t('cfg.wz.upnone'));
            body.append(spaced(none));
          }
          wiz.updates.forEach((row, index) => {
            const box = el('div');
            const put = (name) => (value) => { row[name] = value; rebuild(); void paint(); };
            box.append(
              field(ctx, 'cfg.wz.upname', textField(
                `updates[${index}].name`, ctx.tFlat('cfg.wz.upnamehint'), row.name, put('name'))),
              field(ctx, 'cfg.wz.upstore', segbar(
                ctx.tFlat('cfg.wz.upstore'), meta.updateStores, () => row.store, put('store'))),
              field(ctx, 'cfg.wz.upvalues', textField(
                `updates[${index}].values`, ctx.tFlat('cfg.wz.upvalueshint'), row.values,
                put('values'))),
              // `projectsTo` borrows the updatable name's own hint on purpose:
              // the field it projects to is usually the field it is named
              // after, and `state` is the measured case in this repository's
              // own config. A second key holding the same word would be two
              // spellings of one example.
              field(ctx, 'cfg.wz.upprojects', textField(
                `updates[${index}].projectsTo`, ctx.tFlat('cfg.wz.upnamehint'), row.projectsTo,
                put('projectsTo'))),
              field(ctx, 'cfg.wz.upnote', textField(
                `updates[${index}].note`, ctx.tFlat('cfg.wz.upnotehint'), row.note, put('note'))),
            );
            const drop = el('div', 'cmdactions');
            const remove = el('button');
            remove.type = 'button';
            remove.append(...ctx.t('cfg.wz.updrop'));
            remove.addEventListener('click', () => {
              wiz.updates.splice(index, 1);
              rebuild();
              void paint();
            });
            drop.append(remove);
            box.append(drop);
            body.append(box);
          });
          const addBar = el('div', 'cmdactions');
          const add = el('button');
          add.type = 'button';
          add.append(...ctx.t('cfg.wz.upadd'));
          add.addEventListener('click', () => {
            wiz.updates.push(wizUpdateRow());
            rebuild();
            void paint();
          });
          addBar.append(add);
          body.append(addBar);
        }

        const held = stop();
        refusal.replaceChildren();
        if (held !== null) refusal.append(...held());
        back.disabled = wizAt === 0;
        next.disabled = held !== null || wizAt === WIZ_STEPS - 1;
        void refreshReceipt();
      };

      back.addEventListener('click', () => {
        if (wizAt === 0) return;
        wizAt -= 1;
        rebuild();
      });
      next.addEventListener('click', () => {
        if (wizAt >= WIZ_STEPS - 1 || stop() !== null) return;
        wizAt += 1;
        rebuild();
      });

      rebuild();
      wrap.append(progress, body, refusal, bar, receipt);
      return wrap;
    },
    // The FILE's own before-and-after for this subject, which for a category
    // that does not exist yet is a single arrow-only row per field — the
    // mockup's own treatment for a value that had no previous half.
    base: () => ({}),
    values: () => Object.fromEntries(Object.entries(wizValue())
      .map(([name, value]) => [`categories.${wizName()}.${name}`,
        typeof value === 'object' ? JSON.stringify(value) : value])),
    block: () => ({ key: 'categories', value: wizValue(), entry: wizName() }),
    candidate: () => wizCandidate(),
    // The category this flow just defined, listed. It refuses BY NAME if the
    // paste left it unresolvable, which is the acceptance test `plan:config
    // seq:4` names — and on a category with no items yet, a clean empty list is
    // the receipt that the definition itself loaded.
    command: () => verifyPlan('list', { category: wizName() }),
    extra: null,
  });
  root.append(wizardPane);

  // ── Pane 4: Watched documents ────────────────────────────────────────────
  //
  // One `.globin` per glob in force, plus one empty field to add another, and
  // the list REPLACES rather than merges — `cfg.watchednote`'s own warning,
  // which is exactly the kind of thing the explanatory text exists to say
  // before someone loses a list.
  //
  // **Its plate carries no governing count, and that is the standard rather
  // than a shortfall.** `watchedDocs` is read by `src/hooks/post-tool-use.ts`
  // and by nothing `POST /api/config/preview` runs — not `injection`, not
  // `agentEditsFor`, not `scopePolicyFor`, not `select`. Posting a candidate
  // that differs only here answers `0` changed and `<every item>` unchanged: a
  // true zero about a question nobody asked. `candidate: () => null` is how
  // this pane says so, and the panel it draws is the `unmeasured` face.
  const watched = [...(resolved.watchedDocs ?? [])];
  const watchedDraft = () => watched.map((value) => value.trim()).filter((value) => value !== '');
  const watchedPane = composerPane(ctx, config, {
    key: 'watched',
    head: () => ctx.t('cfg.watched'),
    note: () => ctx.t('cfg.watchedn'),
    plateId: null,
    controls: (paint) => {
      const wrap = el('div');
      // The two names are `watchedNote`/`watchedText` and stay that way:
      // `screens/port.js` cites this exact line as the precedent for where it
      // places its own `span.prop`, and a rename here breaks that citation
      // without changing anything a reader sees.
      const watchedNote = el('p', 'small');
      const watchedText = el('span');
      watchedText.append(...ctx.t('cfg.watchednote'));
      // `PROPOSED` is an unkeyed literal in the design of record and the badge
      // is KEPT: the note describes `init` writing what the repository actually
      // has, and `DEFAULT_WATCHED_DOCS` is still the fixed three-path list it
      // argues against (`src/core/config.ts` · `export const DEFAULT_WATCHED_DOCS = [` · ~117).
      // The app's own rule is that a built feature drops the badge; this one is
      // not built.
      watchedNote.append(watchedText, ' ', el('span', 'prop', 'PROPOSED'));
      const fields = el('div');
      // One extra empty row, so adding a glob needs no control of its own.
      // The placeholder is the glob IN FORCE at that position — the owner's
      // "a default or recommended value as a PLACEHOLDER" — and the added row,
      // which has no value in force behind it, carries the keyed hint instead.
      const held = [...watched];
      [...watched, ''].forEach((value, index) => {
        const input = textField(
          `watchedDocs[${index}]`, held[index] ?? ctx.tFlat('cfg.globhint'), value,
          (next) => {
            watched[index] = next;
            void paint();
          });
        fields.append(spaced(input));
      });
      wrap.append(watchedNote, fields);
      return wrap;
    },
    base: () => ({ watchedDocs: (resolved.watchedDocs ?? []).join(', ') }),
    values: () => ({ watchedDocs: watchedDraft().join(', ') }),
    block: () => ({ key: 'watchedDocs', value: watchedDraft() }),
    candidate: () => null,
    // The self-check: it re-reads `config.json` and refuses by name if the
    // paste broke it. It does NOT report the globs themselves — nothing in the
    // CLI does — which is what `cfg.watchedn` says on screen and what this
    // task's report names as unmeasured.
    command: () => verifyPlan('doctor'),
    extra: null,
  });
  root.append(watchedPane);

  // The one landing disclosure, at the foot of the screen: it is about the
  // whole file rather than about any one pane.
  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.land'));
  const helpBox = el('div', 'helpbox');
  const landed = el('span');
  landed.append(...ctx.t('cfg.h1'));
  const receipt = el('span');
  receipt.append(...ctx.t('cfg.h2'));
  helpBox.append(landed, receipt);
  help.append(summary, helpBox);
  root.append(help);
}
