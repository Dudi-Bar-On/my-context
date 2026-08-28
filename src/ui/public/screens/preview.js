/**
 * `nav.inj` — **Injection preview**, `<section data-p="preview">` in the design
 * of record. The landing screen, and the one the whole visual direction is
 * judged on.
 *
 * **Built from the mockup's markup, not from the plan's Step 3 sketch.** That
 * sketch draws a `<ul>` of items and a `<pre>` of rendered text and names nine
 * string keys — `preview.pickFile`, `preview.nothing`, `preview.spilled`,
 * `preview.renderedText`, `common.loading` among them — that **no string table
 * declares**, because the tables are transcribed key-for-key from the design of
 * record and it declares none of them. `t()` THROWS on a key it cannot find, so
 * that sketch cannot render a single line; and its shape is superseded anyway
 * by the repaint, whose own words for this screen are the composition below.
 * Every key named here is one the mockup declares.
 *
 * **The composition** (repaint Task 6, spec §3 primitives 2 and 3): a left
 * `.plane` holding a `.pane` of `.row`s, a right `.plane` holding a `.lit` of
 * `.blk`s, both inside the `.pair` that carries the perspective, and the rail
 * outside both. Selecting a row holds it up (`aria-pressed`) and lights its
 * paired block; every other block drops to `.58` — which is a STYLESHEET fact
 * (`.lit.linked .blk{opacity:.58}` / `.lit.linked .blk.sel{opacity:1}`), so
 * this file toggles the `.sel` class and never a number.
 * `e2e/injection-preview.spec.ts` pins the value against the mockup.
 *
 * **The two graphics, and where each figure on them comes from.** Both were
 * withheld by the previous pass on the reading *"where a view cannot be drawn,
 * stop and ask"*. The owner answered on 2026-08-22
 * (`DEC-every-screen-the-mockup-shows-is-approved-for-implementation`): every
 * screen, graphic and static datum in the mockup is approved work — where an
 * endpoint answers, read it; where none does, render the mockup's own content
 * rather than leaving it out. So both are built, and every figure on them is
 * named here as LIVE or as the design's own literal.
 *
 *   - **The gate ladder** (`#gatepick` + `#gates`, between `preview.why` and
 *     `preview.whyn`) is LIVE, and the field the old note said did not exist
 *     now does. `injection()` writes a `GateCode` beside its sentence off the
 *     same branch — never a second reading of the item
 *     (`cli/commands/injection.ts` · `The first gate this item fails, in` · ~22) —
 *     and `/api/items` serves it on every item. The other three rungs come
 *     from where each is decided, exactly as that field's own note directs:
 *     *"A full ladder is composed from those four sources — and from none of
 *     their sentences."* Rung 3 is `Selection.focus.hidden`, rung 6 is
 *     `Selection.spilled`. **Rung 5, `seen`, is the one that cannot be
 *     composed here**: the seen set is resolved server-side from the session
 *     and appears in no response, so no item can be shown failing at it. Not
 *     approximated — filed, and said in this file rather than left for a
 *     reader to notice from an empty rung.
 *
 *     **The picker holds ONE EXEMPLAR PER RUNG, and since 2026-08-28 it says
 *     so** (`preview.spec`). `/api/items` is sorted by id, so "the first item
 *     that fails this rung" is stable by construction — and stable against
 *     precisely the changes a reader is trying to observe. The specimen is
 *     kept and disclosed rather than replaced by a picker over every failing
 *     item, which would be `preview.whyn`'s own objection one axis along; the
 *     rung a reader is usually chasing is rung 6, and every item that failed
 *     THAT is now named in the `Not delivered` card below.
 *   - **The spilled-items list** (`#spilledRows`, `preview.spill` /
 *     `preview.spilln`) is LIVE and whole: one row per `Selection.spilled`
 *     entry, in that array's own order, with its tier, its band where the tier
 *     banded, and its `sim.costs` price. It is the second half of
 *     `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`, which
 *     changed which items arrive on a tool event and asked for the
 *     displacement to be observable rather than mysterious.
 *   - **The five-tier budget ribbon with its ghost lane** (`#ribbons`, between
 *     `preview.ribbon` and `preview.ribbonn`) is LIVE for its budgets, its
 *     tier dispatch, its admitted segments and its spilled ghosts —
 *     `/api/simulate` serves `budgets`, `tiersRun` and `costs`, and
 *     `/api/select` serves `full` and `spilled`. **Two figures on it are not
 *     served, and both are drawn the way the design of record itself draws
 *     them rather than guessed:**
 *
 *       1. **Per-line index costs.** The index tier admits LINES, and their
 *          costs are exposed by no endpoint
 *          (`ui/read-model.ts` · `per-line index costs are exposed by no endpoint in this plan` · ~397).
 *          The tier's own total spend IS recoverable — `Selection.tokens` is
 *          the full-text costs plus the per-line estimates, so the difference
 *          against `costs` is arithmetic on two served numbers and not a
 *          second derivation of a decision — so the track carries ONE segment
 *          for the whole admitted run. That is the mockup's own shape for this
 *          tier and not a reduction of it: its `CANDIDATES.index` is already
 *          two aggregates, `19 normative index lines` and `6 more that did not
 *          fit`. What is lost is the second of those — a spilled aggregate
 *          cannot be sized, so the lane holds no ghost for the index tier and
 *          its `.hint` says which count went unsized rather than drawing a
 *          width nobody served.
 *       2. **The interleaving of fills and ghosts.** The lane's positions are
 *          the selector's candidate order, and `full` and `spilled` are two
 *          SUBSEQUENCES of it with the merge missing. It is not recoverable:
 *          first-fit admits greedily, so `[9,1,5]` at a budget of 10 and
 *          `[4,9,4]` at 10 both yield two fills and one spill, and the spill
 *          sits last in one and second in the other. Recovering it needs
 *          either a spill ORDINAL or the spilled item's `severity`/`layer` on
 *          the wire; `Spill` carries `{id, tier, reason, band?}` — the band
 *          orders the two GROUPS and not the items inside one — and
 *          `ItemSummary` carries neither, and reading the position back out of the reason
 *          sentence is the second implementation of `select()`'s decision this
 *          project keeps paying for. So each admitted candidate holds its
 *          position as a `.gap` at its real width and each spilled one is a
 *          `.gh` at its real width, in `selection.spilled`'s own order — which
 *          is the order the read model states it must be drawn in
 *          (`ui/read-model.ts` · `order the selector considered each item, tier by tier` · ~390) —
 *          but a ghost cannot yet appear BETWEEN two fills, which is the
 *          placement `preview.ribbonn` asks for. Filed.
 *
 * **The rungs' names and the ribbon's hints are the mockup's own literals, not
 * string keys, and cannot become keys here.** Its `GATES` table, its
 * `does not run on this event` label and its four hint sentences are built in
 * its own script with an inline `HEB?he:en`, so no `data-t` declares them —
 * and `test/ui/strings-parity.test.ts` fails a table key the design of record
 * does not declare, in that exact direction. They are drawn as literals, the
 * same treatment `parts.js`'s `TIERCHIP` gives a tier name and `watch.js`'s
 * `KIND_CHIP` gives a record kind. The gate CODES are product vocabulary and
 * are right as literals; the DESCRIPTIONS are prose and are not, so they stay
 * English under `א` and that is a defect this file cannot fix alone. Filed as
 * its own task, beside the one `watch.js` already carries for the emphasis
 * runs the string grammar has no marker for.
 */
import { selectQuery } from '/lib/viewmodel.js';
import {
  BOUND_CAP_LIST, boundedList, el, errorNote, idFull, linkId, mono, num, screenHead,
  simRangeFor, spaced, tierChip,
} from '/screens/parts.js';

/**
 * The mockup's four `<option>`s, in its order. Literals, not translated
 * strings: these are `SelectContext.event`'s own values, and the query grammar
 * sends them back over the wire unchanged.
 */
const EVENTS = ['session-start', 'tool', 'compact', 'manual'];

/**
 * The five tracks of the budget ribbon, in the mockup's own drawing order.
 *
 * **Not `sim.tiersRun`, which is a MEMBERSHIP test here and not a layout.**
 * `select.ts` says so where it exports that field: *"A caller drawing fixed
 * tracks reads it as a membership test; the order is a disclosure, not a
 * layout."* Five fixed tracks is what makes an absent tier drawable at all —
 * a track that vanished with its tier would say nothing, where a hatched one
 * says the event never reached it.
 */
const TIERS = ['pinned', 'jit', 'restored', 'continuity', 'index'];

/**
 * `select()`'s six gates, in `GATE_LADDER`'s order, with the one-line
 * description the design of record writes beside each.
 *
 * **The order is the whole of what the ladder shows** — `preview.whyn`: *"the
 * order is the explanation … the one that binds is only meaningful in the
 * position it holds"* — so it is transcribed from the design of record rather
 * than composed here, and `test/core/gate-code.test.ts` already holds that
 * table against `GATE_LADDER` rung for rung, in the mockup, so this list
 * cannot drift from the codes without that test saying so.
 *
 * `code` is `GateCode`'s own spelling, which is what `/api/items` sends and
 * what this file matches on. `name` is what the mockup DRAWS, which differs at
 * rung 2 — *"normative tier"* for the code `tier` — and the appearance is the
 * mockup's business.
 *
 * The descriptions are its literals; see this file's header for why they
 * cannot be string keys and what that costs under `א`.
 */
const GATES = [
  {
    code: 'eligible',
    name: 'eligible',
    q: 'active, not retired, not superseded, category enabled, not past valid_until',
  },
  {
    code: 'tier',
    name: 'normative tier',
    q: 'only a normative category is injectable in full; a rationale category reaches the '
      + 'index line and no further',
  },
  {
    code: 'focus',
    name: 'focus',
    q: 'a focus predicate narrows the corpus before scope is even considered',
  },
  {
    code: 'scope',
    name: 'scope',
    q: 'matchesScope against the event path, POSIX-normalised on both sides',
  },
  {
    code: 'seen',
    name: 'seen',
    q: 'already-delivered items are filtered out before budgeting',
  },
  {
    code: 'budget',
    name: 'budget',
    q: 'what reaches here and does not fit spills whole, with its reason — never truncated',
  },
];

/** `GATES`' index for a `GateCode`, or -1 for `passed` and anything unknown. */
const RUNG = (code) => GATES.findIndex((gate) => gate.code === code);

/** The mockup's `isz()` — a data width, through the CSSOM and logical. */
function sized(node, percent) {
  node.style.setProperty('inline-size', `${percent}%`);
  return node;
}

/**
 * A cost as a percentage of its tier's budget — the one arithmetic the ribbon
 * does.
 *
 * **Not clamped, and that is deliberate.** A single candidate can cost more
 * than the whole budget, and its ghost is then WIDER than the track above it:
 * that is the fact `preview.ribbonn` calls first-fit being honest, and
 * clamping it to 100 would draw an item that merely just missed. `.track`
 * carries `overflow:hidden` for the admitted side, and `.ghosts` is a flex row
 * that shrinks — neither escapes the card.
 *
 * A budget of zero is not a division. It answers 0, and the `.hint` beside it
 * still reports the real headroom, so a tier configured to zero reads as a
 * tier that could admit nothing rather than as `NaN%`.
 */
function pct(tokens, budget) {
  return budget <= 0 ? 0 : (tokens / budget) * 100;
}

/**
 * **What one track is drawn to: the tier's budget, or the range the reader set
 * on the simulator when that is wider.**
 *
 * The budget is still the FACT — `used / budget` in the label, `headroom` in
 * the hint, and both are computed from it and not from this. What this changes
 * is the SCALE the segments are laid out against, so that a reader who has
 * widened the simulator's range to 40,000 sees this ribbon drawn over 40,000
 * too, and the tier they are considering raising has visible room to grow into
 * rather than a track that is already full by construction.
 *
 * `Math.max`, never a replacement: a range NARROWER than the budget in force
 * would draw a full track as an overflowing one, which is a different claim.
 * With no range set this is the budget exactly, so the default drawing is byte
 * for byte what it always was.
 */
function scaleFor(tier, budget) {
  const range = simRangeFor(tier);
  return range === null ? budget : Math.max(budget, range);
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'preview.h', 'preview.v', 'preview.sub');

  // --- Event --------------------------------------------------------------
  const evCard = el('div', 'card pane');
  const evH = el('h3');
  evH.append(...ctx.t('preview.ev'));
  // The mockup writes this row's layout as a `style` attribute. CSP forbids one
  // in the shipped app, so the same declarations go through CSSOM instead.
  const bar = el('div');
  bar.style.setProperty('display', 'flex');
  bar.style.setProperty('gap', '8px');
  bar.style.setProperty('flex-wrap', 'wrap');
  bar.style.setProperty('align-items', 'center');
  bar.style.setProperty('font-size', '14.5px');

  const evLabel = el('label', 'small');
  evLabel.htmlFor = 'evsel';
  evLabel.append(...ctx.t('preview.evl'));
  const evsel = el('select');
  evsel.id = 'evsel';
  for (const name of EVENTS) {
    const option = el('option', null, name);
    option.value = name;
    evsel.append(option);
  }
  // The path slot. The mockup draws `session-start` and writes one unkeyed
  // literal here — `path — none (session-start takes none)`. Three of the four
  // events take no path, so the literal is drawn with the event it is actually
  // about; the sentence is the mockup's, the noun is the one on screen.
  const pathSlot = el('span');
  bar.append(evLabel, evsel, pathSlot);

  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.more'));
  const helpBox = el('div', 'helpbox');
  const firstLine = el('span');
  const p1 = el('b');
  p1.append(...ctx.t('help.p1'));
  firstLine.append(p1, ' ');
  // The five narrowing inputs, as the mockup writes them: `.m` literals rather
  // than translated strings — they are `SelectContext`'s own field names.
  const inputs = ['event', 'path', 'seen', 'restore', 'focus'];
  inputs.forEach((name, i) => {
    firstLine.append(mono(name));
    if (i < inputs.length - 1) firstLine.append(', ');
  });
  firstLine.append(' — all five, or this previews a different question.');
  const secondLine = el('span');
  secondLine.append(...ctx.t('help.p2'));
  helpBox.append(firstLine, secondLine);
  help.append(summary, helpBox);
  evCard.append(evH, bar, help);
  root.append(evCard);

  // --- Delivered, the scene, and the carry --------------------------------
  const out = el('div');
  root.append(out);

  /**
   * The file list, fetched ONCE and only when a tool event first needs it.
   * `/api/coverage` walks the whole repository, and the landing event is
   * `session-start`, which takes no path at all — paying for that walk on first
   * paint would be paying for a picker the screen has not shown.
   */
  let files = null;
  let chosenPath = null;

  /**
   * Every item and its injection verdict, fetched ONCE for the gate ladder.
   *
   * It is the corpus, not the selection, and it is right that it is: the
   * ladder's subject is *"why not"*, and an item that failed rung 1 or rung 2
   * is in no selection at all. `/api/items` is also the only place the gate
   * CODE travels, so there is nowhere else to ask.
   *
   * Cached across event changes because it does not depend on the event —
   * `injection()` is asked about an item and a config, with no event in hand
   * (`cli/commands/injection.ts` · `the question about an item it has not written yet` · ~73).
   * The three rungs that DO move with the event come from the selection, which
   * is refetched every time.
   */
  let items = null;

  async function ensureFiles() {
    if (files !== null) return files;
    const coverage = await ctx.api('/api/coverage');
    files = coverage.files.map((f) => f.path);
    if (chosenPath === null && files.length > 0) [chosenPath] = files;
    return files;
  }

  async function ensureItems() {
    if (items !== null) return items;
    items = (await ctx.api('/api/items')).items;
    return items;
  }

  function drawPathSlot(event) {
    pathSlot.replaceChildren();
    if (event !== 'tool') {
      pathSlot.className = 'm small';
      pathSlot.append(`path — none (${event} takes none)`);
      return;
    }
    pathSlot.className = '';
    // `path` is a `.m` LITERAL, exactly as the helpbox above spells it — the one
    // accessible name for this control the design of record supplies without
    // inventing a string key the tables do not declare.
    const label = el('label', 'm small', 'path');
    label.htmlFor = 'pathsel';
    const picker = el('select', 'path');
    picker.id = 'pathsel';
    for (const file of files ?? []) {
      const option = el('option', 'path', file);
      option.value = file;
      picker.append(option);
    }
    if (chosenPath !== null) picker.value = chosenPath;
    picker.onchange = () => { chosenPath = picker.value; void show(); };
    pathSlot.append(label, ' ', picker);
  }

  async function show() {
    const event = evsel.value;
    out.replaceChildren();
    try {
      if (event === 'tool') await ensureFiles();
      drawPathSlot(event);
      // No file to preview a tool event against. `/api/select` refuses
      // `event=tool` without a path, and asking anyway would turn an empty
      // repository into a refusal the reader would have to decode.
      if (event === 'tool' && chosenPath === null) return;

      const qs = selectQuery(event, event === 'tool' ? chosenPath : null, ctx.session());
      // `/api/select` is `select()`'s serialization and nothing else (design
      // decision 7), so the SELECTION is read from there and never from the
      // simulator's copy of it. `/api/simulate` is asked only for the two things
      // decision 7 keeps off that response: the budgets, and which tiers ran.
      const [selection, sim, corpus] = await Promise.all([
        ctx.api(`/api/select?${qs}`),
        ctx.api(`/api/simulate?${qs}`),
        ensureItems(),
      ]);
      draw(selection, sim, corpus);
    } catch (error) {
      // The endpoint's own words, drawn INSTEAD of the data: an empty selection
      // and a refused request are two facts, and only one of them is about the
      // corpus.
      out.replaceChildren(errorNote(error.message));
    }
  }

  function draw(selection, sim, corpus) {
    // `Delivered` — the three numbers `preview.cap` words. `used` is
    // `Selection.tokens`, the figure the budget decisions were actually made
    // against and which the selector computed rather than a client re-derived;
    // `budget` is the sum over the tiers this event RAN, because a budget for a
    // tier that never ran is not part of what this selection could spend.
    const budget = sim.tiersRun.reduce((total, tier) => total + sim.budgets[tier], 0);
    const delivered = el('div', 'card pane');
    const dh = el('h3');
    dh.append(...ctx.t('preview.delivered'));
    const cap = el('p', 'small');
    cap.append(...ctx.t('preview.cap', {
      items: num(selection.full.length),
      used: num(selection.tokens),
      budget: num(budget),
    }));
    // `.two` — Delivered beside Why not, the house two-column pattern this
    // screen used before the repaint and five other screens still use.
    const two = el('div', 'two');
    delivered.append(dh, cap);

    // ── The delivered rows live INSIDE the Delivered card ──────────────────
    //
    // Until 2026-08-26 they sat in a `.scene > .pair > .plane.l` beside a
    // `.plane.r` holding each item's BODY, and that right plane was the only
    // untitled card on the screen. The owner asked for it out, and he was
    // right on the facts: it duplicated the item detail pane, which draws the
    // same body PLUS type, status, tier, scope, governs, file and the
    // twelve-week sparkline.
    //
    // It was not a misunderstanding — repaint Task 6 built it deliberately,
    // for a stated reason: "never look at a rule without seeing the text it
    // produced". What changed is that the detail pane can now do that job; when
    // the linked view was written the pane had no sparkline, a `file` row that
    // showed a dash on every item, and `.well`/`.welllabel` rules that were
    // never carried.
    //
    // AND THE PATTERN HAD ONE INSTANCE. `.scene`, `.pair` and `.plane` were
    // called "the composition pattern the other twenty screens copy"; measured
    // across the whole mockup they appear EXACTLY ONCE each, here, and no
    // screen ever copied them. `.two` — what the pre-repaint design used for
    // this very screen — is used six times.
    //
    // So the layout returns to `.two`: Delivered beside Why not, the ribbon
    // below both, and a row opens the pane.
    const rows = el('div', 'rows');
    rows.id = 'deliveredRows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));

    // **`data-id`, so the shell's own delegated handler opens the pane.** Not a
    // second listener: `app.js` already routes any click inside `[data-id]` to
    // `openPane`, and a screen adding its own would be a second implementation
    // of the one behaviour every id in this product shares.
    // **A DISPLAY cap, and the sentence says so in those words.** The order is
    // the selector's own first-fit admission order, because `SelectionEntry` is
    // `{item, tier}` and carries no time — see `boundedList`. Getting the
    // wording wrong here turns "showing 20 of 47" into "you were given 20",
    // which would be false about the one screen that promises *exactly what
    // Claude gets*.
    const deliveredBound = boundedList(ctx, rows, selection.full, (entry) => {
      const row = el('button', 'row');
      row.type = 'button';
      row.dataset.id = entry.item.id;
      row.append(idFull(entry.item.id), tierChip(entry.tier));
      return row;
    }, { cap: BOUND_CAP_LIST, order: 'admitted', displayOnly: true });
    delivered.append(rows, deliveredBound);

    // Why not sits in the SECOND column, so `drawGates` is handed its host
    // rather than reaching for `out`.
    two.append(delivered);
    drawGates(corpus, selection, two);
    out.append(two);

    drawCarry(selection.index);
    // Between the ladder and the ribbon, and that is the argument the whole
    // screen is read in: Why not diagnoses ONE item, Not delivered NAMES every
    // one of them, and the ribbon then shows what the budgets did with the
    // widths. The ribbon still comes last.
    drawSpilled(selection, sim);
    drawRibbons(selection, sim);
  }

  /**
   * The cross-session carry, in the four clauses `core/render.ts` already
   * composes for the CLI out of this same one field — so the two surfaces have
   * one vocabulary rather than two that agree today.
   *
   * **Each clause is omitted entirely when its own list is empty**, which is the
   * mockup's rule and not a tidiness preference: a clause carrying a zero every
   * session is how a reader learns to skim past the one session where it
   * matters.
   *
   * **The `.carrieditem` blocks are the ids behind `carried.shown`**, and they
   * come from `IndexSummary.normative` rather than from `CarriedSummary`:
   * `shown` is a COUNT, and the ids that produced it are the lines the summary
   * flags — `carried` is set to `true` on a line a previous session had and is
   * ABSENT otherwise, deliberately
   * (`core/select.ts` · `The key is ABSENT otherwise, deliberately` · ~70). One block per
   * arriving line, so the sentence's number and the list under it are the same
   * fact twice rather than two facts that agree today.
   *
   * They are SIBLINGS of the `preview.carried` paragraph and never nested
   * inside it — the mockup's own arrangement, for the defect
   * `e2e/language.spec.ts` pins: a `data-t` element's children are replaced
   * wholesale from the string table, which knows nothing of a button or a chip
   * someone put inside one.
   *
   * **The `PROPOSED` badge is NOT drawn, and this is an ACCEPTED DIVERGENCE
   * from the design of record — the first one this project has recorded.**
   *
   * Owner ruling, 2026-08-23, in his own words: "leave the mockup intact, do it
   * only in the real, i need it to stay on the mockup for history, when
   * comparing to mockup the proposed word is a known diff and it is ok."
   *
   * The badge marks a FEATURE as proposed — that is what `.prop` means
   * everywhere else in the design of record, on rail buttons and on whole
   * screens' verdicts. This block is now BUILT, and the app's own tested rule
   * is that a built feature stops advertising itself as proposed
   * (`e2e/app-layout.spec.ts` · `the rail no longer badges watch as PROPOSED` · ~322).
   * Drawing it here would label a working feature a proposal.
   *
   * So the two files deliberately differ, and each is right for its own job:
   * the mockup keeps the badge as the historical record of what was proposed
   * when it was drawn, and the app drops it because the thing exists. The
   * divergence is REGISTERED rather than silent — `e2e/screen-parity.spec.ts`
   * carries `span.prop` in `preview`'s ledger with this reason, so the gate
   * still fails if any OTHER kind goes missing, and nobody later mistakes this
   * for a screen that forgot something.
   */
  function drawCarry(index) {
    const carried = index.carried;
    if (carried === null || carried === undefined) return;
    const line = el('p', 'small');
    line.append(...ctx.t('preview.carried', {
      lines: num(carried.shown),
      session: `${carried.sessionId} · ${carried.label}`,
    }));
    out.append(spaced(line));

    // The same rule as the delivered list, by the owner's own instruction:
    // `IndexLine` is `{id, type, title, carried?}` and has no timestamp either.
    // The blocks need a host of their own — they used to be appended straight
    // to `out`, which leaves nothing for a bound line to sit under.
    const carriedHost = el('div');
    const carriedLines = index.normative.filter((line) => line.carried === true);
    const carriedBound = boundedList(ctx, carriedHost, carriedLines, (indexLine) => {
      const block = el('div', 'carrieditem small');
      const chip = el('span', 'chip gov');
      chip.dataset.g = '◇';
      chip.append(...ctx.t('tier.carried'));
      block.append(linkId(indexLine.id), chip);
      return block;
    }, { cap: BOUND_CAP_LIST, order: 'admitted', displayOnly: true });
    out.append(carriedHost, carriedBound);

    if (carried.dropped.length > 0) {
      const dropped = el('p', 'small');
      dropped.append(...ctx.t('index.carriedDropped', {
        dropped: num(carried.dropped.length),
        // The drop REASONS ride untranslated inside the slot: `select.ts`'s
        // `carriedDropReason` is their one spelling and there is no stable code
        // to translate from.
        ids: carried.dropped.map((d) => `${d.id} (${d.reason})`).join(', '),
      }));
      out.append(dropped);
    }
    if (carried.displaced.length > 0) {
      const displaced = el('p', 'small');
      displaced.append(...ctx.t('index.carriedDisplaced', {
        displaced: num(carried.displaced.length),
        ids: carried.displaced.join(', '),
      }));
      out.append(displaced);
    }
    // The fetch line appears only when there is something to fetch.
    if (carried.dropped.length > 0 || carried.displaced.length > 0) {
      const fetchLine = el('p', 'small');
      fetchLine.append(...ctx.t('index.carriedFetch'));
      out.append(fetchLine);
    }
  }

  /**
   * **`Not delivered` — every item that spilled, NAMED, with what it cost.**
   *
   * Until 2026-08-28 the only account this screen gave of what did not arrive
   * was the ribbon's ghost lane: widths without names, and `selection.spilled`
   * consulted solely to answer *"did this one item spill"* — a question the
   * reader has to already suspect the answer to. The owner reported it as
   * *"there is no place there for a list of items that did not delivered"*.
   *
   * **It does not overturn `preview.whyn` beside it.** That note argues against
   * listing six REASONS — a closed vocabulary whose order carries the meaning —
   * and it is right. This lists ITEMS: the reader's own data, different every
   * run, and its count is the answer to *"was my budget too small"*.
   *
   * **WHOLE, not per-tier**, with the tier on each row. `Selection.spilled` is
   * one list across every tier that ran; the ribbon splits it five ways only
   * because a ghost has to be sized against its own tier's budget. Both
   * readings are true and the aggregate is the one most easily lost between
   * them, so `preview.spilln` says which this is in those words.
   *
   * **In `selection.spilled`'s own order, never sorted here.** That order is
   * the one the selector considered each item in, tier by tier
   * (`ui/read-model.ts` · `order the selector considered each item, tier by tier` · ~390),
   * and it is load-bearing rather than incidental: first-fit admits greedily,
   * so `[4,9,4]` against a budget of 10 spills a different item than `[9,1,5]`
   * does. Re-sorting these rows by size or by id would draw a different
   * algorithm.
   *
   * **The band is READ, not re-derived** — `Spill.band`, written inside
   * `fitToBudget` where the position is known
   * (`core/select.ts` · `const partitioned = bands.filter(` · ~575). Comparing
   * `item.scope.length` against the event path here would be a second
   * implementation of the selector's own partition, which is the two-spellings
   * defect `GateCode` exists to prevent. It is ABSENT wherever the candidates
   * were not actually split, and the row then carries no marker: a partition
   * nobody made is not a fact to draw.
   *
   * **An index row shows a dash where a cost would be**, and the note says why.
   * `sim.costs` prices every id in `full ∪ spilled` with `itemCost` — the
   * FULL-TEXT cost — but the index tier admitted a LINE, and per-line index
   * costs are exposed by no endpoint
   * (`ui/read-model.ts` · `per-line index costs are exposed by no endpoint in this plan` · ~397).
   * Drawing the full-text figure beside an index line would be a number this
   * screen invented. The same gap the ghost lane already declines to size.
   *
   * **Bounded like every other list here**, through the one `boundedList` — 139
   * spills is an ordinary session-start figure on a real corpus — and with the
   * `considered` order, because these rows were not admitted. `displayOnly` is
   * deliberately NOT passed: that clause says *"all N were in the injection"*,
   * which is false of every row in this card.
   */
  function drawSpilled(selection, sim) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.spill'));
    const rows = el('div', 'rows');
    rows.id = 'spilledRows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
    card.append(heading, rows);

    const cost = new Map(sim.costs.map((entry) => [entry.id, entry.tokens]));
    const bound = boundedList(ctx, rows, selection.spilled, (spill) => {
      const row = el('button', 'row');
      row.type = 'button';
      // `data-id`, so the shell's own delegated handler opens the pane — the
      // one path every id in this product takes. It is the whole point of
      // naming the item: the reader asks "why did this not arrive", reads the
      // tier and the cost, and opens the item without leaving the screen.
      row.dataset.id = spill.id;
      row.append(idFull(spill.id), tierChip(spill.tier));
      // The band, where the selector actually banded. A `.m` run rather than a
      // chip: the chips on this row already carry the tier, a second coloured
      // token would compete with it, and `band 2` is product vocabulary from
      // the ruling rather than prose.
      if (spill.band !== undefined) row.append(mono(`band ${spill.band}`));
      row.append(mono(spill.tier === 'index' ? '—' : num(cost.get(spill.id) ?? 0)));
      // The reason as the tooltip, in the SERVER's own words — the same
      // treatment the ghost lane gives it, and never parsed for the figures
      // above.
      row.title = spill.reason;
      return row;
    }, { cap: BOUND_CAP_LIST, order: 'considered' });
    card.append(bound);

    const note = el('p', 'small');
    note.append(...ctx.t('preview.spilln'));
    card.append(note);
    out.append(card);
  }

  /**
   * **`Why not — the first gate that failed`**: the segmented item picker and
   * the six-rung ladder, in `select()`'s own order.
   *
   * The order IS the view. A two-column table naming the failing gate loses it,
   * and `preview.whyn` says why that matters: *"a list of six reasons is noise,
   * and the one that binds is only meaningful in the position it holds. Rungs
   * above it passed, the rung itself carries the diagnosis, and everything
   * below is not reached rather than passed."*
   *
   * **Which rung binds is READ, never re-derived.** Rungs 1, 2 and 4 are
   * `ItemSummary.gate`, written beside `injection()`'s sentence by the same
   * branch; rung 3 is membership of `Selection.focus.hidden`; rung 6 is
   * membership of `Selection.spilled`. Nothing here parses a sentence and
   * nothing here re-asks a predicate — the four sources are exactly the four
   * `InjectionVerdict.gate`'s own note names, and they are consulted in LADDER
   * order so an item hidden by focus AND unscoped under `inert` binds at rung
   * 3, which is where `select` would have stopped, and not at rung 4.
   *
   * **Rung 5 has no source and therefore no candidate.** The `seen` set is
   * resolved server-side out of the session and rides on no response, so this
   * screen cannot name an item that was filtered as already-delivered. The
   * rung is still DRAWN — a ladder with a rung missing would be the one shape
   * this view exists to prevent — it simply never binds. Filed as its own task.
   *
   * The picker holds one representative per rung, lowest first, and opens on
   * the DEEPEST one: the item that got furthest before failing is the one whose
   * ladder has something to show above the break, and it is the case the design
   * of record opens on too.
   */
  function drawGates(corpus, selection, host) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.why'));
    const pick = el('div', 'segbar');
    pick.id = 'gatepick';
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
    // **THE PICKER SAYS WHAT IT IS HOLDING.** It offers one EXEMPLAR PER RUNG,
    // and `/api/items` is sorted by id so "the first" is stable by
    // construction — which is exactly the property the owner ran into: change
    // the event, change a budget, change what actually arrived, and the same
    // specimen very often comes back. *"Can not see changes to why not"* is
    // that stability, correctly reported about a panel that never disclosed it.
    //
    // **Disclosed rather than replaced, and the reasoning is recorded rather
    // than left in this choice.** Offering every failing item would rebuild
    // `preview.whyn`'s own objection one axis along — a picker of 139 names is
    // noise, and the ladder is a diagnosis of ONE item by construction. What
    // was missing was not a bigger picker but a list, and rung 6 — the rung a
    // reader is usually chasing — now has one below, named in the selector's
    // own order. The other five rungs remain specimens and now say so.
    const spec = el('p', 'small');
    spec.append(...ctx.t('preview.spec'));
    const ladderHost = el('div', 'gladder plate');
    ladderHost.id = 'gates';
    const note = el('p', 'small');
    note.append(...ctx.t('preview.whyn'));
    card.append(heading, pick, spaced(spec), ladderHost, spaced(note));
    host.append(card);

    const hidden = new Set(selection.focus === null ? [] : selection.focus.hidden);
    const spills = new Map(selection.spilled.map((spill) => [spill.id, spill]));

    /** The first rung this item fails, walked in ladder order. -1 if it fails none. */
    const rungOf = (item) => {
      const own = RUNG(item.gate);
      // Rungs 1 and 2 are item-level and sit above focus, so they answer first.
      if (own === 0 || own === 1) return own;
      if (hidden.has(item.id)) return 2;
      // `ItemSummary.gate` can only ever say `scope` in its one item-level
      // form — an unscoped item under `scopePolicy: "inert"`. The per-event
      // `matchesScope` refusal is not on this endpoint at all, so an item this
      // event's path does not reach is simply absent from the picker rather
      // than being placed on a rung nobody served.
      if (own === 3) return 3;
      return spills.has(item.id) ? 5 : -1;
    };

    const chosen = [];
    for (let rung = 0; rung < GATES.length; rung++) {
      // `/api/items` is sorted by id, so "the first" is a stable choice and not
      // whichever the store happened to hand back.
      const hit = corpus.find((item) => rungOf(item) === rung);
      if (hit !== undefined) chosen.push({ rung, item: hit });
    }
    let who = chosen.length === 0 ? null : chosen[chosen.length - 1];

    /** The binding rung's diagnosis, in the SERVER'S own words. */
    const diagnosis = (pickedItem, rung) => {
      if (rung === 2) {
        // `describeFocus()` is the CLI's one spelling of this and is served
        // nowhere, so the axes are NAMED rather than re-worded here: they are
        // identifiers, and an identifier belongs in a `.m` run.
        const axes = selection.focus.axes;
        const parts = [];
        for (const [name, values] of [
          ['tags', axes.tags], ['categories', axes.categories], ['scope', axes.scope],
        ]) {
          if (values.length === 0) continue;
          if (parts.length > 0) parts.push(' · ');
          parts.push(mono(`${name}: ${values.join(', ')}`));
        }
        return parts;
      }
      // `Spill.reason` and `injection()`'s `phrase` ride untranslated, for the
      // reason the carry's drop reasons do: each is its own one spelling, and
      // there is no stable code under it to translate from.
      if (rung === 5) return [spills.get(pickedItem.id).reason];
      return [pickedItem.phrase];
    };

    function paint() {
      pick.replaceChildren();
      for (const candidate of chosen) {
        const button = el('button');
        button.type = 'button';
        // `.v` — bidi isolation WITHOUT the monospace, which is `lib/i18n.js`'s
        // own description of that class. The mockup writes the id as bare
        // button text, so `.m` would draw this strip in a different face from
        // the design of record; a bare text node would draw it identically and
        // lose the isolation an identifier needs in an RTL paragraph. `.v` is
        // the one that is both.
        const label = el('span', 'v', candidate.item.id);
        button.append(label);
        button.setAttribute('aria-pressed', String(candidate === who));
        button.onclick = () => { who = candidate; paint(); };
        pick.append(button);
      }
      ladderHost.replaceChildren();
      GATES.forEach((gate, i) => {
        // No candidate at all: every rung is drawn NEUTRAL rather than passed.
        // "Nothing was asked" and "everything passed" are different facts, and
        // six green ticks for a question nobody put is the second one told
        // wrongly.
        const state = who === null ? '' : i < who.rung ? 'pass' : i === who.rung ? 'binds' : 'after';
        const rung = el('div', state === '' ? 'rung' : `rung ${state}`);
        const mark = state === 'pass' ? ' ✓' : state === 'binds' ? ' ✗' : '';
        rung.append(el('span', 'n', `${i + 1}${mark}`));
        const name = el('span');
        name.append(el('b', null, gate.name));
        const why = el('span', 'q');
        if (state === 'binds') why.append(...diagnosis(who.item, who.rung));
        else if (state === 'after') why.append(`not reached — ${gate.q}`);
        else why.append(gate.q);
        rung.append(name, why);
        ladderHost.append(rung);
      });
    }
    paint();
  }

  /**
   * **`Budget ribbon — five tiers, and what fell out of each`.**
   *
   * Five FIXED tracks, one per tier, whatever this event reached: a tier that
   * never ran is hatched and named, and an empty track would claim it ran and
   * delivered nothing, which is a different fact — `select.ts`'s own words
   * where it exports `tiersRun`, and `preview.ribbonn`'s where it draws it.
   *
   * Deliberately CSS flex and not SVG. The mockup's ruling: *"a quantity bar
   * must mirror, and flex with logical properties mirrors for free"*. Every
   * width goes through the CSSOM (`sized`), never a `style` attribute, which
   * the shipped `style-src` would refuse.
   *
   * It follows `#evsel` rather than adding a second event selector, which is
   * the last sentence of `preview.ribbonn`.
   */
  function drawRibbons(selection, sim) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.ribbon'));
    const host = el('div', 'plate');
    host.id = 'ribbons';
    const note = el('p', 'small');
    note.append(...ctx.t('preview.ribbonn'));
    card.append(heading, host, note);

    // **The continuity tier's overflow, said out loud on the screen too.**
    // `select` already reports it structurally (`Selection.continuitySpill`)
    // and `render.ts` says it inside the injected block; this is the third
    // place, and three is deliberate. The defect being fixed is a guarantee
    // believed to be in force that silently was not, so the disclosure is put
    // wherever somebody might be looking. Drawn ONLY when the tier actually
    // overflowed — `null` is the ordinary case and draws nothing, because a
    // warning that is always on screen is a warning nobody reads.
    const overflow = selection.continuitySpill;
    if (overflow) {
      const loud = el('p', 'small');
      loud.append(...ctx.t('preview.contover', {
        n: String(overflow.ids.length),
        ids: overflow.ids.join(', '),
        cost: num(overflow.cost),
        budget: num(overflow.budget),
      }));
      card.append(loud);
    }
    out.append(card);

    const cost = new Map(sim.costs.map((entry) => [entry.id, entry.tokens]));
    let fullTokens = 0;
    for (const entry of selection.full) fullTokens += cost.get(entry.item.id) ?? 0;
    // The index tier's own spend. `Selection.tokens` is the `itemCost` of every
    // full-text entry PLUS the per-line estimate of every admitted index line,
    // and `costs` prices the first set — so the difference is the second. That
    // is arithmetic over two numbers the server computed, not a client
    // re-deriving a decision: nothing here re-estimates a line.
    const indexTokens = Math.max(0, selection.tokens - fullTokens);

    for (const tier of TIERS) {
      const budget = sim.budgets[tier];
      // Every width below is a percentage of `scale`; every FIGURE below is
      // computed from `budget`. Keeping the two apart is what lets the ribbon be
      // drawn over a raised range without any sentence on it becoming untrue.
      const scale = scaleFor(tier, budget);
      const ribbon = el('div', 'ribbon');
      const label = el('div', 'rlabel');
      label.append(tierChip(tier));

      if (!sim.tiersRun.includes(tier)) {
        label.append(el('span', null, 'does not run on this event'));
        const absent = el('div', 'track');
        absent.append(el('div', 'notrun'));
        ribbon.append(label, absent,
          el('div', 'hint', 'Absent, not empty — this event never reaches the tier at all.'));
        host.append(ribbon);
        continue;
      }

      // What the track draws, what the lane draws, and the two counts beside
      // the chip. The index tier is one aggregate segment and no ghosts — see
      // this file's header for exactly which figure is missing and why.
      const isIndex = tier === 'index';
      const fits = isIndex
        ? [{ id: `${selection.index.normative.length} normative index lines`, tokens: indexTokens }]
        : selection.full.filter((entry) => entry.tier === tier)
          .map((entry) => ({ id: entry.item.id, tokens: cost.get(entry.item.id) ?? 0 }));
      const spilled = isIndex
        ? []
        : selection.spilled.filter((spill) => spill.tier === tier)
          .map((spill) => ({ id: spill.id, tokens: cost.get(spill.id) ?? 0 }));
      const used = isIndex ? indexTokens : fits.reduce((total, f) => total + f.tokens, 0);
      const outCount = isIndex
        ? selection.index.truncated
        : spilled.length;
      const inCount = isIndex ? selection.index.normative.length : fits.length;

      // The range is named whenever it is not the budget, because a track drawn
      // to a scale nobody is told about is the silent-ambiguity shape this
      // project keeps paying for: two ribbons of different widths would
      // otherwise mean the same spend.
      label.append(el('span', 'n',
        `${num(used)} / ${num(budget)}${scale === budget ? '' : ` · to ${num(scale)}`}`
        + ` · ${inCount} in · ${outCount} out`));

      const track = el('div', 'track');
      for (const fit of fits) {
        const segment = sized(el('div', `seg ${tier}`), pct(fit.tokens, scale));
        // The mockup's own tooltip, and an unkeyed literal there as here.
        segment.title = `${fit.id} · ${num(fit.tokens)} tokens`;
        track.append(segment);
      }
      // The head: what the tier did not spend, drawn as the track's own
      // remainder rather than as a fifth colour.
      track.append(el('div', 'seg head'));

      const ghosts = el('div', 'ghosts');
      for (const fit of fits) {
        // An admitted candidate holds its position INVISIBLY, so a ghost sits
        // under the place in the track the selector considered it.
        ghosts.append(sized(el('div', 'gap'), pct(fit.tokens, scale)));
      }
      for (const spill of spilled) {
        const ghost = sized(el('div', 'gh'), pct(spill.tokens, scale));
        ghost.title = `${spill.id} · ${num(spill.tokens)} tokens · budget exceeded`;
        ghosts.append(ghost);
      }

      const hint = el('div', 'hint');
      const headroom = budget - used;
      // Said once, before the headroom sentence, so the track's empty tail is
      // never read as headroom it is not: past the budget the tail is range, and
      // range admits nothing until the budget is actually raised.
      if (scale !== budget) {
        hint.append(
          el('b', null, `Drawn to the simulator's range, ${num(scale)}`),
          ` — the budget in force is still ${num(budget)}, and the track past it is `
          + 'range, not headroom. ',
        );
      }
      if (outCount === 0) {
        hint.append(`Everything selected fit. Headroom ${num(headroom)} tokens.`);
      } else if (isIndex) {
        // The one figure no endpoint serves, said rather than drawn at a width
        // nobody computed.
        hint.append(`Headroom ${num(headroom)}. ${outCount} index lines did not fit; `
          + 'per-line index costs are exposed by no endpoint, so the ghost lane cannot size them.');
      } else {
        const smallest = Math.min(...spilled.map((spill) => spill.tokens));
        hint.append(
          `Headroom ${num(headroom)}. `,
          el('b', null, `the smallest thing that did not fit costs ${num(smallest)}`),
          ' — so the headroom is not usable by anything currently selected.',
        );
      }
      ribbon.append(label, track, ghosts, hint);
      host.append(ribbon);
    }
  }

  evsel.onchange = () => { void show(); };
  ctx.onSessionChange(() => { void show(); });
  await show();
}
