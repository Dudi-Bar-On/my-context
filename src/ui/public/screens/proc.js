/**
 * `nav.ch` — **Procedures**, `<section data-p="proc">` in the design of record.
 * The one-shot lifecycle: a set of steps performed once and then done, with
 * the settlement that closes it composed here and run in the user's own shell.
 *
 * The screen is three cards. The first is STATIC — the four-state table and
 * `pr.why`, prose the design of record owns and this file transcribes. The
 * second is LIVE — one card per procedure the corpus holds, drawn from
 * `GET /api/procedures` and `GET /api/procedure/:id`. The third is static
 * again — `pr.write`'s three paragraphs about who may tick a box.
 *
 * `nav.ch` is *"Change — composed, never run"* and that is exactly what this
 * screen does: nothing here writes, and the one line it composes goes to a
 * clipboard. `pr.w3` is the product's own reason — *"`active → done` stays
 * yours"* — and `src/ui/proc-model.ts` records that the routes behind this
 * screen are READ-ONLY for the same reason. There is no POST in `ctx` at all.
 *
 * ── THE MOCKUP DRAWS ONE PROCEDURE. THE CORPUS HAS N ─────────────────────
 *
 * `<section data-p="proc">` draws a single card for a single sample id
 * (`docs/design/web-ui-mockup.html` · `<h3 data-t="pr.item"><span class="m v" data-v="item">` · ~2122)
 * with no picker beside it, so zero, one and many are undecided — which is
 * why `/api/procedures` exists at all. **Decided here as: one card per
 * procedure, in the `.two` grid, in the endpoint's own id order, with the
 * static `pr.write` card last.** At exactly one procedure that is the mockup's
 * layout byte for byte; above one the grid flows, which is what a
 * `grid-template-columns:1fr 1fr` already does
 * (`src/ui/public/styles.css` · `.two{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)}` · ~685).
 * At zero the grid holds the static card alone. **Reported, not settled** — a
 * picker, a sort control and a stage filter are all layouts the design of
 * record does not have, and `pr.` declares no string for any of them.
 *
 * **Zero procedures draws no procedure card and says nothing about it.** There
 * is no `pr.empty` in either table, so there is no sentence to write — the
 * call `gaps.js` and `work.js` both already make. What this screen must NOT do
 * is fall back to the mockup's own sample: `pr.item` is `{mv:item}`, a slot,
 * so drawing it would mean inventing `PROC-migrate-money-columns-to-integer-cents`
 * and offering `mycontext procedure done` on it from a copy button. An
 * invented id inside a `<code>` a copy button offers is the one thing this UI
 * must never produce.
 *
 * ── THE CHIP IS THE REAL VERDICT, AND IT WILL DISAGREE WITH THE TABLE ─────
 *
 * The static table maps a STAGE to a chip. The card's chip is picked by the
 * REAL `injection` verdict the endpoint serves — the answer the hook itself
 * computes for this item under this config — so the two can disagree on
 * screen, and on a `ready` procedure they will.
 *
 * `pr.idx` puts *"index line only"* against the `ready` row. The shipped
 * selector does not do that: `isEligible`
 * (`src/core/select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~198)
 * admits `active` only, so a `ready` procedure reaches neither the injected
 * block nor an index line, and `injection()` returns `not injected (status
 * "proposed")`. The model serves BOTH — the CLI's sentence as the
 * `ready-is-not-injected` disclosure, and the true per-item verdict — and says
 * in its own words that *"IT IS THE MOCKUP THAT IS WRONG"*. **Nothing here
 * edits the table and nothing here quietly agrees with it**: the table is
 * drawn as designed, the card is drawn as measured, and the disclosure
 * explaining the gap is rendered underneath. A mockup change is the owner's
 * and needs a screenshot.
 *
 * ── FOUR ROWS, FIVE STAGES ────────────────────────────────────────────────
 *
 * `pr.states` is *"Four states, and exactly one of them injects"* and the
 * table draws four. There are five
 * (`src/ui/proc-model.ts` · `const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;` · ~126),
 * and the fifth is not an invention: `pr.aband`, on this very screen, says
 * *"Abandoned rather than finished is `superseded`"*. So the screen already
 * knows the state exists and has no row for it.
 *
 * **No fifth row is added here, and the reason has CHANGED.** This paragraph
 * said the blocker was `test/ui/strings-parity.test.ts` failing "in the
 * direction that names it" on a `pr.` meaning string the design of record does
 * not declare. That direction was dropped on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, so the gate
 * is not what stops it and has not been for days. Re-measured 2026-08-30
 * against the gate's own docstring.
 *
 * What stops it is the HEADING directly above the table. `pr.states` is *"Four
 * states, and exactly one of them injects"*, in both tables and in the design
 * of record, and a fifth row under a sentence that counts four is a screen
 * disagreeing with itself in the space of two elements. Correcting that
 * sentence is a change to the design of record, which is the owner's under
 * `DEC-claude-drafts-the-mockup-and-the-owner-approves` — one sentence and one
 * row, and they land together or not at all.
 *
 * What keeps the state from being dropped meanwhile is that the CARD prints the
 * stage as its own chip text: an abandoned procedure reads `abandoned` on
 * screen, in the CLI's own word, whether or not the table above it has a row.
 *
 * ── DISCLOSURES ARE RENDERED, IN THE SERVER'S OWN WORDS ───────────────────
 *
 * Both routes carry a `disclosures` array — five codes, each a fact that is
 * true whether or not a response mentions it — and `src/ui/proc-model.ts` says
 * plainly that *"A screen that renders the rows and drops the disclosures has
 * re-created the silent drop they exist to end."*
 *
 * **`pr.` has a key for none of them, and it cannot: they are the server's
 * sentences, not the product's.** A disclosure is composed by
 * `src/ui/proc-model.ts` out of what this corpus actually holds, so there is
 * nothing fixed to key. They are rendered exactly the way this UI renders an
 * endpoint's `error` text — as it arrived, in the server's own words
 * (`src/ui/public/screens/parts.js` · `export function errorNote(message, ctx = globalThis.myctx) {` · ~211).
 * The cost is that they stay English in the Hebrew UI; what has changed since
 * 2026-08-30 is that the CARD around them now says what they are (`pr.disc`),
 * so a reader is told they are the endpoint's qualifications rather than left
 * with a titled-nothing card of English.
 *
 * The `error`/`warning` headings this used to be reported alongside are keyed
 * now (`doc.error`, `doc.warning`): they were the product's words all along,
 * and the reason given for leaving them — `strings-parity` failing on a key the
 * mockup does not declare — was retired on 2026-08-26.
 *
 * `file-ticks-are-not-progress` is the one worth reading twice, because it
 * contradicts the paragraph printed directly above it. `pr.md` says *"there is
 * no second place a procedure could disagree with itself"*. There is: the
 * parser stores a tick
 * (`src/core/item.ts` · `const step: Step = { text: m[2]!, checked: m[1] === 'x' };` · ~233),
 * so a hand-edited `- [x]` in the Markdown is a tick the audit log knows
 * nothing about. The endpoint serves the LOG's replay in `step.checked` and
 * discloses the divergence; this screen draws the log and prints the
 * disclosure. Neither resolves it — a mockup change, a parser change or a
 * `doctor` check is the owner's call.
 *
 * ── WHAT IS SERVED AND NOT DRAWN ─────────────────────────────────────────
 *
 * `title`, `status`, `injection.phrase`, `injection.gate`, `stages` and
 * `category.declared`/`category.enabled` all arrive and appear nowhere. The
 * mockup's `h3` is the ID (`pr.item` is `{mv:item}` and nothing else), there
 * is no cell for a raw status beside a derived stage, and `category` reaches
 * the screen only through the `category-disabled` disclosure the server
 * composes for it. Left unread rather than promoted into columns the design of
 * record does not have — the call `status.js` and `work.js` already made on
 * their own screens.
 *
 * ── ONE REQUEST, THEN ONE PER PROCEDURE ──────────────────────────────────
 *
 * The list route answers everything the card needs EXCEPT the steps, and the
 * step table is the card. So the detail route is called once per listed
 * procedure, in parallel, and a detail that refuses costs that card its table
 * and nothing else: `id`, the chip, `3 / 5`, the bar and `pr.md` all come from
 * the summary, so the card still draws them with the refusal standing where
 * the table would have been. Losing a whole card to one failed request would
 * drop the half that still reads.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
import { el, errorNote, mono, num, spaced } from '/screens/parts.js';

/**
 * The static state table, verbatim from
 * (`docs/design/web-ui-mockup.html` · `<tr><td class="m">ready</td><td class="small" data-t="pr.s2">you approved it</td>` · ~2108).
 *
 * The STAGE NAMES are literals and not keys, and that is the design of
 * record's own choice rather than an oversight here: it writes `<td class="m">
 * proposed</td>` with no `data-t`, because these are the CLI's own vocabulary
 * — the same treatment `parts.js` gives the four tier names in `TIERCHIP`
 * (`src/ui/public/screens/parts.js` · `const TIERCHIP = {` · ~161). They stay
 * English in the Hebrew UI, which is a known and reported asymmetry of every
 * such literal in this UI, not a new one.
 *
 * `data-g` is set on every chip for fidelity with the mockup's markup; the
 * glyph itself is painted by `.chip.gov::before` and its siblings, so it is
 * written once, in CSS, and this attribute only ever matters to a bare `.chip`
 * (`src/ui/public/styles.css` · `.chip::before{content:attr(data-g) " ";font-family:var(--mono)}` · ~542).
 *
 * Exported so `node --test` can hold all four rows against the mockup's own
 * `<tr>`s — stage, meaning key, chip class, glyph and verdict key — without a
 * DOM. A table transcribed by hand needs a check that it was transcribed.
 */
export const STATE_ROWS = [
  { stage: 'proposed', meaning: 'pr.s1', chip: 'chip warn', glyph: '▲', verdict: 'pr.none' },
  { stage: 'ready', meaning: 'pr.s2', chip: 'chip ok', glyph: '●', verdict: 'pr.idx' },
  { stage: 'active', meaning: 'pr.s3', chip: 'chip gov', glyph: '◆', verdict: 'pr.full' },
  { stage: 'done', meaning: 'pr.s4', chip: 'chip warn', glyph: '▲', verdict: 'pr.none' },
];

/**
 * The three chips the mockup's own table uses, keyed by what an item's real
 * injection verdict says — NOT by its stage.
 *
 * The verdict is `{ phrase, injected, gate }`
 * (`src/cli/commands/injection.ts` · `export interface InjectionVerdict {` · ~18)
 * and three of its outcomes are exactly the three chips already drawn on this
 * screen:
 *
 *   - `injected` — the item is delivered in full at a session start. `pr.full`,
 *     *"in full, every session"*, `chip gov`.
 *   - `gate === 'tier'` — the item is eligible and NOT normative, so it is
 *     *"searchable, and counted in the session index, but never injected in
 *     full"* (`src/core/render-item.ts` · `export const RATIONALE_NOT_INJECTED =` · ~142).
 *     That IS `pr.idx`, *"index line only"*, `chip ok`. It is reachable here:
 *     `procedure` ships normative (`src/core/categories.ts` · `  procedure:     def('procedure', 'PROC', 'normative', true,` · ~58)
 *     but a config may set the category's tier itself, and this screen must
 *     draw what the config does rather than what the catalogue defaults to.
 *   - anything else — `eligible` (not active, or the category is off) or
 *     `scope` (unscoped under `scopePolicy: "inert"`). `pr.none`, *"not
 *     injected"*, `chip warn`.
 *
 * There is no fourth outcome to invent a chip for: `injected === (gate ===
 * 'passed')` always, by that interface's own construction.
 */
export const INJECTION_CHIP = {
  full: { cls: 'chip gov', glyph: '◆', key: 'pr.full' },
  index: { cls: 'chip ok', glyph: '●', key: 'pr.idx' },
  none: { cls: 'chip warn', glyph: '▲', key: 'pr.none' },
};

/**
 * Which chip an item wears — decided here, so `node --test` can check the
 * mapping without standing up a DOM.
 *
 * A missing or malformed verdict falls to `none` rather than throwing. The
 * conservative direction is the only safe one: a card that claimed `in full`
 * for an item nobody measured would assert the most expensive thing on the
 * screen — that this procedure is in every session's context — on no evidence.
 */
export function injectionChip(verdict) {
  if (verdict === null || typeof verdict !== 'object') return INJECTION_CHIP.none;
  if (verdict.injected === true) return INJECTION_CHIP.full;
  if (verdict.gate === 'tier') return INJECTION_CHIP.index;
  return INJECTION_CHIP.none;
}

/**
 * `inline-size` for `<i class="f">`, as a percentage string.
 *
 * The mockup hard-codes `60%` beside `3 / 5`
 * (`docs/design/web-ui-mockup.html` · `<div class="bar"><i class="f" style="inline-size:60%"></i></div>` · ~2125),
 * which is the sample's own arithmetic; this computes it.
 *
 * **`total === 0` is `0%`, never `NaN%` and never `100%`.** A procedure with
 * no `## Steps` section is a real thing — the item is a procedure whose steps
 * were never written — and `0 / 0` is not "finished". A full gold bar over
 * `0 / 0` would report a completed run that never had a step to complete.
 *
 * **`unreadable` is NOT drawn into the bar.** `.bar` carries a second segment
 * class for exactly this shape of thing (`src/ui/public/styles.css` · `.bar i.f{background:var(--gold)} .bar i.s{background:var(--crit)}` · ~702),
 * and using it here would be this file inventing a graphic the design of
 * record does not draw on this screen, in a colour that means "spilled"
 * elsewhere. The count is not dropped: the server discloses it in a sentence,
 * which is rendered below. Reported as an open question — a hatched or
 * crit-tinted third segment is a plausible answer and it is the owner's.
 */
export function barWidth(progress) {
  if (progress === null || typeof progress !== 'object') return '0%';
  const total = Number(progress.total);
  const done = Number(progress.done);
  if (!Number.isFinite(total) || total <= 0) return '0%';
  if (!Number.isFinite(done) || done <= 0) return '0%';
  return `${Math.min(100, Math.round((done / total) * 100))}%`;
}

/**
 * The one line this screen composes, or `null` when there is nothing to
 * compose — never a guess.
 *
 * `null` for any stage but `active`, and that is the screen's own sentence
 * rather than a preference: `pr.w3` is *"What is not relaxed: the state.
 * `active → done` stays yours."* A `done` command offered against a `proposed`
 * procedure would be a settlement for a run that has not started, and against
 * a `done` one a settlement for a run already closed.
 *
 * **No `--yes`.** The CLI accepts it (`src/cli/commands/procedure.ts` · `       mycontext procedure done <id> [--yes]` · ~83)
 * and the mockup composes the line without it
 * (`docs/design/web-ui-mockup.html` · `<div class="cmd"><code>mycontext procedure done PROC-migrate-money-columns-to-integer-cents</code>` · ~2151).
 * Following the mockup is also following `pr.w3`: the confirmation prompt IS
 * the human's decision, and pre-answering it in a string handed to a clipboard
 * would compose away the one step this whole lifecycle keeps for a person.
 *
 * `composeCommand` rather than a template literal, so the quoting has one
 * implementation and an id carrying a space is quoted before it reaches a
 * clipboard. It THROWS on an empty id — an id is the one argument this command
 * cannot do without — and the caller draws the refusal where the block would
 * have been.
 *
 * **The command catalogue declares no `procedure` entry at all** — `PALETTE`
 * in `lib/palette-defs.js` has none — so unlike Work this screen cannot look
 * its argv up by name. The argv is written here, once, and reported: the
 * catalogue is where a flag set gets verified against the real parser, and a
 * command composed outside it has had no such check.
 */
export function doneArgv(procedure) {
  if (procedure === null || typeof procedure !== 'object') return null;
  if (procedure.stage !== 'active') return null;
  return ['mycontext', 'procedure', 'done', procedure.id];
}

/**
 * The same settlement as the string a reader sees, and the one that refuses.
 *
 * Split from `doneArgv` because the Copy-and-Execute control takes an ARGV — a
 * string cannot be executed, and a screen carrying both as independent values
 * is exactly the drift the confirm exists to prevent. The refusal on an
 * unquotable id lives HERE, in `composeCommand`, which is where it always lived:
 * `doneArgv` answers the stage question and the composer answers the quoting
 * one, and neither has been given the other's job.
 */
export function doneCommand(procedure) {
  const argv = doneArgv(procedure);
  return argv === null ? null : composeCommand(argv);
}

/**
 * Every disclosure the screen has been handed, in order, with duplicates
 * removed BY MESSAGE.
 *
 * The two routes overlap on purpose — `progress-is-workspace-scoped` is
 * unconditional on both, and `ready-is-not-injected` fires on the list when
 * any procedure is ready and on the detail when that one is — so a screen
 * reading a list plus N details is handed the same sentence N+1 times.
 *
 * **Deduplicated by message and not by code**, and the difference is not
 * cosmetic. `file-ticks-are-not-progress` is per-item and names the item and
 * its step numbers; two procedures with hand-edited ticks produce two
 * different sentences under one code, and collapsing by code would drop the
 * second — the exact silent drop `INV-nothing-is-dropped-silently` and this
 * whole array exist to prevent. Byte-identical sentences say nothing twice;
 * different sentences all survive.
 *
 * The `code` travels with the message so a later keyed rendering can branch on
 * it without matching on prose — the shape the model chose it for.
 */
export function disclosureMessages(groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      if (entry === null || typeof entry !== 'object') continue;
      const message = typeof entry.message === 'string' ? entry.message : '';
      if (message === '' || seen.has(message)) continue;
      seen.add(message);
      out.push({ code: typeof entry.code === 'string' ? entry.code : '', message });
    }
  }
  return out;
}

/**
 * `<div class="phd"><h2>…</h2></div>` and `<p class="psub">`.
 *
 * **`screenHead` is not called and cannot be**: it takes a verdict key, and
 * `pr.` declares none. The mockup's `.verdict` on this screen holds one thing
 * — `<span class="prop">PROPOSED</span>`
 * (`docs/design/web-ui-mockup.html` · `<span class="verdict"><span class="prop">PROPOSED</span></span></div>` · ~2099)
 * — and that badge is retired: the task record says so
 * (*"the mockup's PROPOSED badge is retired as a scope marker"*), the shell
 * computes the rail's copy of it from `SCREENS` membership so it disappears
 * the moment this module is registered, and the owner has already ruled on the
 * identical case on the preview screen: *"when comparing to mockup the
 * proposed word is a known diff and it is ok"*
 * (`e2e/screen-parity.spec.ts` · `// "leave the mockup intact, do it only in the real, i need it to stay on the` · ~173).
 *
 * So the badge is not drawn — and neither is the empty box that held it. A
 * `.verdict` with nothing in it is not a verdict; it is a container claiming
 * this screen states one. Both kinds go to the KNOWN_GAPS ledger in this
 * task's report rather than being drawn hollow.
 */
function head(ctx, root) {
  const phd = el('div', 'phd');
  const h = el('h2');
  h.append(...ctx.t('pr.h'));
  phd.append(h);
  const sub = el('p', 'psub');
  sub.append(...ctx.t('pr.sub'));
  root.append(phd, sub);
}

/**
 * The static four-state table and `pr.why` — the design of record's own prose,
 * transcribed and not computed.
 *
 * It is drawn whether or not either endpoint answers. The task record is
 * explicit that where no endpoint answers the mockup's own static content is
 * rendered rather than the screen left out, and this half never depended on an
 * endpoint in the first place: it is what the lifecycle IS, not what this
 * corpus holds.
 */
function statesCard(ctx) {
  const card = el('div', 'card pane');
  const h = el('h3');
  h.append(...ctx.t('pr.states'));

  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['th.state', 'pr.mean', 'pr.inj']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = el('tbody');
  for (const row of STATE_ROWS) {
    const tr = el('tr');
    const meaning = el('td', 'small');
    meaning.append(...ctx.t(row.meaning));
    const chip = el('span', row.chip);
    chip.dataset.g = row.glyph;
    chip.append(...ctx.t(row.verdict));
    const verdict = el('td');
    verdict.append(chip);
    tr.append(el('td', 'm', row.stage), meaning, verdict);
    tbody.append(tr);
  }
  table.append(thead, tbody);

  const why = el('p', 'small');
  why.append(...ctx.t('pr.why'));
  card.append(h, table, spaced(why));
  return card;
}

/**
 * `<div class="cmd"><code>…</code></div>` followed by the ONE Copy-and-Execute
 * control — which here is Copy alone, so this line is still composed and never
 * run. That is what keeps the user's own Bash deny rules matching the command
 * strings they were written against (§7).
 *
 * The hand-rolled Copy button that used to live here is gone. It was one of
 * nine across `screens/`, and adding Execute nine times would have been nine
 * chances to get the confirm wrong — the confirm being the security boundary.
 * `lib/command-actions.js` is the one spelling, and the "Copied"/"Copy failed"
 * labels this button owed the mockup are its problem now.
 *
 * The control is a SIBLING of `.cmd` rather than a child, and a fragment rather
 * than a wrapping `<div>`: `.cmdactions button` carries its own background
 * precisely so the control does not depend on which container it lands in, and
 * a classless container is the other half of the defect that left the
 * Composer's read button rendering light text on the user agent's near-white
 * button face.
 */
function commandRow(ctx, argv) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  // Composed HERE, so an id this UI cannot quote throws before anything is
  // appended and the caller's catch draws the refusal where the block would
  // have been — the behaviour this screen has always had.
  box.append(el('code', null, composeCommand(argv)));
  // **`id: null` — Copy alone, and it is the answer twice over.**
  //
  // `PALETTE` declares no `procedure` entry at all, which this file already
  // records above `doneArgv`: the catalogue is where a flag set is verified
  // against the real argument parser, and this argv has had no such check. The
  // client sends an id and the server rebuilds argv from the catalogue, so an
  // id the catalogue does not have has nothing to rebuild — and an unverified
  // argv is the last thing that should be handed an Execute button.
  //
  // The second reason is `pr.w3`, *"active → done stays yours"*: the composed
  // line carries no `--yes` because the confirmation prompt IS the human's
  // decision. Weighed against composing `--yes` and offering Execute, which
  // would answer that prompt on their behalf in the same edit.
  block.append(box, commandActions({ argv, id: null, values: {}, ctx }));
  return block;
}

/**
 * The step table: `<td class="m">[x]</td><td class="small">…</td>` per step,
 * with the mockup's own `margin-block-start:10px` set through CSSOM.
 *
 * The attribute cannot be written — the server sends `style-src 'self'` with
 * no `'unsafe-inline'` — which is the constraint `parts.js` records for its
 * own `spaced()`; 10px is a second value that helper does not carry, so it is
 * set the same way here rather than rounded to 8 to reuse it.
 *
 * **The mark is `[x]`/`[ ]` and it is the AUDIT LOG'S**, not the file's. The
 * endpoint replays progress records over the item and serves the result as
 * `step.checked` (`src/ui/proc-model.ts` · `        steps: item.steps.map((step, i) => ({ n: i + 1, text: step.text, checked: done.has(i + 1) })),` · ~514),
 * so a box drawn ticked here is a recorded flip and nothing else. The file's
 * own `- [x]` is a different value that this screen never receives, and the
 * `file-ticks-are-not-progress` disclosure is what says so when the two
 * disagree.
 *
 * The step TEXT is the item's, not a string key. `pr.k1`–`pr.k5` are the
 * mockup's five sample steps and there is nothing for them to key on a real
 * procedure; they are named in this task's report as the five `pr.` keys this
 * screen cannot place.
 */
function stepsTable(steps) {
  const table = el('table');
  table.style.setProperty('margin-block-start', '10px');
  const tbody = el('tbody');
  for (const step of steps) {
    const tr = el('tr');
    tr.append(el('td', 'm', step.checked === true ? '[x]' : '[ ]'), el('td', 'small', step.text));
    tbody.append(tr);
  }
  table.append(tbody);
  return table;
}

/**
 * One procedure, as the mockup's left-hand card.
 *
 * `summary` always exists — it came from the list — and `detail` may be a
 * refusal. Everything above the step table is drawn from the summary alone, so
 * a failed detail request costs the table and the disclosures and nothing
 * else.
 *
 * The `h3` is `pr.item`, which is `{mv:item}` and therefore the ID and only
 * the ID: a monospace, bidi-isolated value run. **Not `linkId`** — the design
 * of record writes `<span class="m v">` on this heading where it writes
 * `button.linkid` elsewhere, and a button opening the item-detail pane would
 * be a control this screen has not been given. The served `title` has nowhere
 * to go for the same reason.
 *
 * **The `.cmd` block is in THIS card and the mockup draws it in the other
 * one.** That is a real divergence and it is forced: the command names an id,
 * an id belongs to a procedure, and the `pr.write` card is drawn once for a
 * screen that may hold zero procedures or five. Composing there would mean
 * picking one of five silently, or inventing one out of zero. Here it is
 * unambiguous and it appears only where it is true — on an `active`
 * procedure, per `doneCommand`. Reported.
 */
function procedureCard(ctx, summary, detail) {
  const card = el('div', 'card pane');

  const h = el('h3');
  h.append(...ctx.t('pr.item', { item: summary.id }));

  // The chip's TEXT is the stage and its CLASS is the injection verdict — see
  // this file's header. The two are different facts and the mockup happens to
  // draw a sample where they agree (`active`, injected in full, `chip gov`).
  const chipStyle = injectionChip(summary.injection);
  const chip = el('span', chipStyle.cls, summary.stage);
  chip.dataset.g = chipStyle.glyph;

  const progress = summary.progress ?? { done: 0, total: 0, unreadable: 0 };
  const line = el('p', 'small');
  const steps = el('span');
  steps.append(...ctx.t('pr.steps'));
  // `num` is the mockup's own `en-US` grouping, for the reason `parts.js`
  // gives: a number that changes its separators with the UI language is a
  // second thing to reconcile for no reader's benefit.
  line.append(chip, ' ', mono(`${num(progress.done)} / ${num(progress.total)}`), ' ', steps);

  const bar = el('div', 'bar');
  const fill = el('i', 'f');
  fill.style.setProperty('inline-size', barWidth(progress));
  bar.append(fill);

  card.append(h, line, bar);

  if (detail.ok) card.append(stepsTable(detail.procedure.steps ?? []));
  // Instead of the table, never beside an empty one: a procedure with no steps
  // and a detail read that refused are opposite facts, and an empty `<tbody>`
  // would report the first while the second is true.
  else card.append(errorNote(detail.error.message));

  // `pr.md`'s two slots are this procedure's real counts, so the sentence
  // "{done} of {steps} is counted, never stored" is about the card it sits on
  // rather than about the mockup's sample.
  const note = el('p', 'small');
  note.append(...ctx.t('pr.md', { done: num(progress.done), steps: num(progress.total) }));
  card.append(spaced(note));

  try {
    const argv = doneArgv(summary);
    // Built inside the try: `commandRow` composes, so an unquotable id throws
    // before a single node reaches the card and the refusal lands below.
    if (argv !== null) card.append(commandRow(ctx, argv));
  } catch (error) {
    // An id this UI cannot quote is a broken response, not a stage: say so
    // where the block would have been rather than composing something weaker.
    card.append(errorNote(error.message));
  }
  return card;
}

/**
 * `pr.write` — the static right-hand card: who may tick a box, and what is not
 * relaxed.
 *
 * Three paragraphs and `pr.aband`, all prose from the design of record. The
 * mockup's `.cmd` block sat between the third paragraph and `pr.aband`; it is
 * now in each procedure's own card — see `procedureCard` for why, and this
 * task's report for the divergence.
 */
function writeCard(ctx) {
  const card = el('div', 'card pane');
  const h = el('h3');
  h.append(...ctx.t('pr.write'));
  card.append(h);
  for (const key of ['pr.w1', 'pr.w2', 'pr.w3']) {
    const p = el('p', 'small');
    p.append(...ctx.t(key));
    card.append(p);
  }
  const aband = el('p', 'small');
  aband.append(...ctx.t('pr.aband'));
  card.append(spaced(aband));
  return card;
}

/**
 * The disclosures, in one card at the foot of the screen.
 *
 * **One place rather than scattered**, because several of them qualify the
 * whole screen rather than one card — `progress is recorded per workspace`
 * qualifies every number above it, and the disabled-category sentence explains
 * an empty screen rather than any card on it. The per-item ones name their own
 * id in their own text, so nothing is lost by moving them here.
 *
 * **The card carries an `<h3>` since 2026-08-30, and did not before.** The
 * reason recorded here was that "a heading invented here would fail
 * `strings-parity` in the direction that names it" — the direction dropped on
 * 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, quoted from
 * memory rather than from the gate. `pr.disc` is the heading, in both tables,
 * and it words the one thing a reader could not otherwise get: that these
 * sentences are true whether or not a card above them says so, which is the
 * model's own account of why it sends them at all.
 *
 * **Where these sentences belong on the page is still an open question for the
 * owner** — the model says as much about the workspace-scope limit in
 * particular. Naming the card does not answer it; it stops the card being
 * anonymous while it waits.
 */
function disclosureCard(ctx, messages) {
  const card = el('div', 'card pane');
  const h = el('h3');
  h.append(...ctx.t('pr.disc'));
  card.append(h);
  // The sentences themselves are the endpoint's, unedited: composed per corpus,
  // so there is nothing fixed to key and nothing here that could be.
  for (const entry of messages) card.append(el('p', 'small', entry.message));
  return card;
}

export async function render(root, ctx) {
  root.replaceChildren();
  head(ctx, root);
  // Static and unconditional: the lifecycle table is what a procedure IS, and
  // it does not stop being true because a read failed.
  root.append(statesCard(ctx));

  let list = null;
  let refusal = null;
  try {
    list = await ctx.api('/api/procedures');
  } catch (error) {
    refusal = error;
  }

  const summaries = list !== null && Array.isArray(list.procedures) ? list.procedures : [];
  // In parallel, and each failing alone. `Promise.all` over a mapper that
  // catches is what makes one refusal cost one card: an uncaught rejection
  // here would take every card down for one bad id.
  const details = await Promise.all(summaries.map(async (summary) => {
    try {
      const body = await ctx.api(`/api/procedure/${encodeURIComponent(summary.id)}`);
      const procedure = body === null || typeof body !== 'object' ? null : body.procedure;
      // A 200 whose shape is not the contract is a refusal wearing a success
      // status, and it is said so rather than drawn as a procedure with no
      // steps — which is a real state, and would be reported here wrongly.
      if (procedure === null || typeof procedure !== 'object') {
        return { ok: false, error: new Error(`proc: /api/procedure/${summary.id} answered 200 `
          + 'without a procedure — the steps below would be a shape error drawn as an empty run') };
      }
      return { ok: true, procedure };
    } catch (error) {
      return { ok: false, error };
    }
  }));

  const two = el('div', 'two');
  if (refusal !== null) {
    // The refusal takes the card slot the procedures would have filled. A
    // corpus with no procedures and a list read that failed are opposite
    // facts, and an absent card would report the first while the second is
    // true.
    const card = el('div', 'card pane');
    card.append(errorNote(refusal.message));
    two.append(card);
  }
  summaries.forEach((summary, index) => two.append(procedureCard(ctx, summary, details[index])));
  two.append(writeCard(ctx));
  root.append(two);

  const messages = disclosureMessages([
    list !== null ? list.disclosures : [],
    ...details.map((detail) => (detail.ok ? detail.procedure.disclosures : [])),
  ]);
  if (messages.length > 0) root.append(disclosureCard(ctx, messages));
}
