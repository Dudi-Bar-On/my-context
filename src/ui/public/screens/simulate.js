/**
 * `nav.inj` — **Budget simulator**, `<section data-p="simulate">` in the design
 * of record. Drag a budget, watch what fits.
 *
 * It joins the hero's rail group and takes the pane/plate pattern that screen
 * establishes rather than inventing its own: the tier table is DATA, so it sits
 * on `.plate` inside the `.pane` the card already is (repaint Task 7 —
 * *"Text may float on glass. Data may not."*). The mockup already marks it that
 * way and this file copies the marking rather than deciding it.
 *
 * **THE SPILL RATIO LANDED, and the card above it still has not.** The three
 * refusals this file opened with were one per card; one of them has expired and
 * says so below, and the other two are unchanged. Nothing weaker is drawn in
 * their place — *"Where a view cannot be drawn, stop and ask; do not draw a
 * weaker one"*:
 *
 *   - **The admission staircase and the threshold ladder** (`#stair`, `#ladder`,
 *     with `sim.stair`, `sim.stairn`, `sim.thresh` and `sim.snap`). Both are a
 *     SWEEP: the selector re-run at every cumulative candidate cost, *"exact,
 *     not sampled"*. No endpoint answers a sweep. It is reachable at N+1 round
 *     trips — one `/api/simulate` at budget 0 to learn the tier's candidate
 *     list and each candidate's `itemCost`, then one more per rung — and that
 *     is a request-volume decision with a caching design behind it, not a
 *     detail to settle on the way past. The alternative, re-running `fitToBudget`
 *     in the browser, is a second implementation of the selector and is refused.
 *     **Still asked, and still not guessed**, and the asking is now a live task
 *     rather than a comment: `TASK-the-admission-staircase-needs-a-sweep-response-or-a-ruling`
 *     (`plan:ui1 seq:17c`), which is OPEN and which says in its own words that
 *     `sim.snap` and `sim.stairn` *"return with it"*. So the two rungs of prose
 *     stay down with the charts: `sim.snap` promises a slider that snaps to
 *     rungs, and a slider that does not snap under a sentence saying it does is
 *     worse than the missing chart.
 *   - **The readout under the staircase** (`#readout`) is refused for a SECOND
 *     and independent reason, worth separating because it will outlive the
 *     first. Its numbers are not the problem — *"N in · M out · T tokens
 *     used"*, and the *"next in at …"* line beneath it, are all in the one
 *     `/api/simulate` response this screen already reads. Its WORDS are: the
 *     mockup builds that sentence out of English and Hebrew literals inside its
 *     own script, under no `data-t`, and therefore under no key in either
 *     string table. `test/ui/strings-parity.test.ts` fails on a key the design
 *     of record does not declare, so the sentence cannot be worded here at all
 *     — and spelling it out of the keys that DO exist would put a different
 *     sentence on screen under the mockup's name. That is the same refusal
 *     `sim.chipn`'s solidus records further down, one size larger. Recorded as
 *     an open question for the owner: the day `#readout` gets a `data-t`, it is
 *     ten lines.
 *
 * **What LANDED is the spill ratio** (`#ratio`, with `sim.ratio` and
 * `sim.ration`) — the diverging bar, delivered growing from the centre toward
 * the reading start and spilled toward the reading end, so *"a long red half
 * names which budget is too small"*. It was refused here on the grounds that
 * its source — the note's own words, *"`audit_item.role` through `topItems`"* —
 * *"is the audit projection, which no route in this plan exposes"*. That
 * sentence is out of date: `GET /api/watch/ratio` exposes exactly it, reading
 * `topItems` twice through the read-only door, and its own header says it was
 * built for this chart. A refusal whose reason has expired is not a standing
 * decision, so it came out.
 *
 * The rest is what was always fully served: the tier picker, the budget slider,
 * and the four-row fits table the slider drives. Every number in it comes from
 * one `/api/simulate` response, so the table cannot disagree with itself.
 *
 * **Two events, because four tiers do not live on one.** `tiersRun` is
 * `select.ts`'s own dispatch: `pinned`, `restored` and `index` are reached by
 * `compact`, and `jit` only by `tool`. So the screen holds two selections at
 * once and reads each tier's row off whichever one actually ran it. A tier that
 * neither event reached is drawn as absent, never as a zero — an empty count
 * would claim it ran and delivered nothing, which is a different fact.
 */
import { selectQuery } from '/lib/viewmodel.js';
import { el, errorNote, mono, num, screenHead, spaced } from '/screens/parts.js';

/** The mockup's four tracks, in its order. `select.ts`'s own tier names. */
const TIERS = ['pinned', 'jit', 'restored', 'index'];

/**
 * Which event reaches which tier, read off `tiersRun` rather than restated:
 * `compact` runs pinned + restored + index, and `tool` is the only event with a
 * jit target. One request each, and the tier being dragged has its override
 * applied to whichever of the two runs it.
 */
const EVENT_FOR = { pinned: 'compact', restored: 'compact', index: 'compact', jit: 'tool' };

/** The mockup's own slider bounds, verbatim: `min=0 max=12000 step=50`. */
const SLIDER = { min: '0', max: '12000', step: '50' };

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'sim.h', 'sim.v', 'sim.sub');

  let tier = 'jit';
  let files = null;
  let chosenPath = null;
  let budgets = null;

  // --- The controls -------------------------------------------------------
  const ctlCard = el('div', 'card pane');
  const ctl = el('div', 'simctl');
  const tierName = el('span', 'm', tier);
  tierName.id = 'tierName';
  const slider = el('input');
  slider.id = 'slider';
  slider.type = 'range';
  slider.min = SLIDER.min;
  slider.max = SLIDER.max;
  slider.step = SLIDER.step;
  // An `aria-label` is an ATTRIBUTE and cannot hold an element, which is the
  // sink `tFlat` exists for and the reason reaching for it is written down.
  slider.setAttribute('aria-label', ctx.tFlat('aria.tierBudget'));
  const budgetVal = el('span', 'm');
  budgetVal.id = 'budgetVal';
  ctl.append(tierName, slider, budgetVal);

  const tierPick = el('div', 'segbar');
  tierPick.id = 'tierPick';
  tierPick.setAttribute('role', 'group');
  tierPick.setAttribute('aria-label', ctx.tFlat('aria.tierpick'));
  ctlCard.append(ctl, tierPick);
  root.append(ctlCard);

  // --- The fits table -----------------------------------------------------
  const tableCard = el('div', 'card pane');
  const plate = el('div', 'plate');
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['sim.tier', 'sim.budget', 'sim.fits', 'sim.spills']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = el('tbody');
  tbody.id = 'simtbl';
  table.append(thead, tbody);
  plate.append(table);

  const chipNote = el('p', 'small');
  const evictHelp = el('details', 'help');
  const evictSummary = el('summary');
  evictSummary.append(...ctx.t('help.whyBudget'));
  const evictBox = el('div', 'helpbox');
  const evictText = el('span');
  evictText.append(...ctx.t('sim.evict'));
  evictBox.append(evictText);
  evictHelp.append(evictSummary, evictBox);
  tableCard.append(plate, spaced(chipNote), evictHelp);
  root.append(tableCard);

  // --- Selected, then not delivered ---------------------------------------
  // The mockup's third card, markup for markup: an `h3`, a `.plate` of
  // diverging bars, and `sim.ration` under it at the same 8px the other two
  // notes take. The heading and the note are built ONCE and unconditionally —
  // they are prose about a chart, and they stay true whether the projection
  // answers, is absent, or refuses. Only the plate's contents move.
  const ratioCard = el('div', 'card pane');
  const ratioHead = el('h3');
  ratioHead.append(...ctx.t('sim.ratio'));
  const ratioPlate = el('div', 'plate');
  const ratioNote = el('p', 'small');
  ratioNote.append(...ctx.t('sim.ration'));
  ratioCard.append(ratioHead, ratioPlate, spaced(ratioNote));
  root.append(ratioCard);

  function drawTierPick() {
    tierPick.replaceChildren();
    for (const name of TIERS) {
      const button = el('button', null, name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(name === tier));
      button.onclick = () => {
        tier = name;
        tierName.textContent = tier;
        if (budgets !== null) slider.value = String(budgets[tier]);
        drawTierPick();
        void run();
      };
      tierPick.append(button);
    }
  }

  async function ensurePath() {
    if (files !== null) return chosenPath;
    const coverage = await ctx.api('/api/coverage');
    files = coverage.files.map((f) => f.path);
    chosenPath = files.length > 0 ? files[0] : null;
    return chosenPath;
  }

  /**
   * One request per event, with the dragged tier's override applied to whichever
   * of the two actually runs it.
   *
   * The `tool` request needs a path — `/api/select`'s grammar refuses
   * `event=tool` without one — and an empty repository has none. That case
   * answers `null` rather than a fabricated selection, and the jit row is drawn
   * absent, which is true: there is no file for a tool event to be about.
   */
  async function fetchBoth(value) {
    const path = await ensurePath();
    const override = value === null ? {} : { [tier]: value };
    const compactQs = selectQuery(
      'compact', null, ctx.session(), EVENT_FOR[tier] === 'compact' ? override : {},
    );
    const compact = ctx.api(`/api/simulate?${compactQs}`);
    if (path === null) return { compact: await compact, tool: null };
    const toolQs = selectQuery(
      'tool', path, ctx.session(), EVENT_FOR[tier] === 'tool' ? override : {},
    );
    return { compact: await compact, tool: await ctx.api(`/api/simulate?${toolQs}`) };
  }

  /**
   * One tier's row, off the response for the event that runs it.
   *
   * `fits` and `eligible` are counted from the SAME selection, so the ratio is
   * a ratio and not two numbers from two answers. The index tier counts LINES,
   * not entries — `IndexSummary.normative` is what was admitted and `truncated`
   * is what the index budget turned away — which is the same distinction
   * `/api/simulate`'s own note draws about why its `costs` table cannot size
   * that track.
   */
  function countFor(name, sim) {
    if (sim === null || !sim.tiersRun.includes(name)) return null;
    if (name === 'index') {
      const fits = sim.selection.index.normative.length;
      return { fits, spills: sim.selection.index.truncated, budget: sim.budgets.index };
    }
    return {
      fits: sim.selection.full.filter((e) => e.tier === name).length,
      spills: sim.selection.spilled.filter((s) => s.tier === name).length,
      budget: sim.budgets[name],
    };
  }

  function drawTable(both) {
    tbody.replaceChildren();
    let current = null;
    for (const name of TIERS) {
      const sim = EVENT_FOR[name] === 'tool' ? both.tool : both.compact;
      const counts = countFor(name, sim);
      const row = el('tr');

      // The tier cell is a `.m` run, not a chip: the mockup reserves the chip
      // in this table for the fits RATIO and the spill count, and a second chip
      // in the same row would claim the tier name were a verdict too.
      const c1 = el('td');
      c1.append(mono(name));
      const c2 = el('td');
      const c3 = el('td');
      const c4 = el('td');

      if (counts === null) {
        // Absent, not empty. The tier was never reached by either event this
        // screen asks about, so it has no budget spent and no items turned
        // away; a `0` in these cells would claim it ran.
        c2.append(mono('—'));
        c3.append(mono('—'));
        c4.append(mono('—'));
      } else {
        const eligible = counts.fits + counts.spills;
        c2.append(mono(num(counts.budget)));
        // The fits column is a RATIO, as `sim.chipn` says. It is written with a
        // solidus rather than the mockup script's `' of '`: that word is an
        // unkeyed English literal in the mockup's own demo loop, with no key in
        // either string table, and shipping it would put untranslated English
        // inside a Hebrew sentence. Recorded as an open question for the owner.
        const chip = el('span', `chip ${counts.spills > 0 ? 'warn' : 'ok'}`);
        chip.dataset.g = counts.spills > 0 ? '▲' : '●';
        chip.textContent = `${num(counts.fits)}/${num(eligible)}`;
        c3.append(chip);
        if (counts.spills > 0) {
          const spillChip = el('span', 'chip warn', num(counts.spills));
          spillChip.dataset.g = '▲';
          c4.append(spillChip);
        } else {
          c4.append(mono('0'));
        }
        if (name === tier) current = { fits: counts.fits, eligible };
      }
      row.append(c1, c2, c3, c4);
      tbody.append(row);
    }

    // `sim.chipn` quotes the ratio it is explaining, so it quotes the row being
    // dragged. A tier neither event reached has no ratio to quote and the note
    // stands down rather than quoting a fabricated one.
    chipNote.replaceChildren();
    if (current !== null) {
      chipNote.append(...ctx.t('sim.chipn', {
        fits: num(current.fits), eligible: num(current.eligible),
      }));
    }
  }

  /**
   * One half of one diverging bar — the mockup's `isz(el('i'), pct)`, without
   * the `style` attribute it writes there. `inline-size` is the LOGICAL
   * property, so the Hebrew page mirrors the whole chart for free; the mockup's
   * own comment over `.div-row` says that is why both halves were written
   * logically in the first place.
   *
   * A count of zero draws NO `<i>` at all, exactly as the mockup does — a
   * zero-width bar with a border on it is a mark on the screen where nothing
   * happened. A count of `null` is the OTHER thing and draws nothing either:
   * `spillRatio` answers `null` where a role tally filled its window, meaning
   * the number is below a cutoff and unknown rather than zero, and a bar is a
   * magnitude claim this side has no magnitude for.
   */
  function ratioHalf(cls, count, max) {
    const half = el('div', cls);
    if (count !== null && count > 0) {
      const bar = el('i');
      bar.style.setProperty('inline-size', `${(count / max) * 100}%`);
      half.append(bar);
    }
    return half;
  }

  /** `12/22`, and the `—` this screen already uses for a number nobody measured. */
  function tally(count) {
    return count === null ? '—' : num(count);
  }

  /**
   * `GET /api/watch/ratio`'s rows as the mockup's `renderRatio` draws them:
   * name, delivered half, spilled half, `delivered/spilled`.
   *
   * **The normalisation is over BOTH halves of ALL rows**, which is what
   * `sim.ration` promises — *"both normalised to the largest count in the
   * table"* — and it is the difference between a chart you can compare across
   * rows and four rows each drawn against itself. `null`s are excluded from the
   * maximum rather than read as zero, for the reason `ratioHalf` gives.
   *
   * The rows arrive already ordered, longest red half first, and are NOT
   * re-sorted here: `spillRatio` ranks them and documents why a `null` sorts
   * below a measured zero, and a second ordering in the client is a second
   * opinion about the same question.
   */
  function drawRatio(rows) {
    ratioPlate.replaceChildren();
    const measured = rows.flatMap((r) => [r.delivered, r.spilled]).filter((n) => n !== null);
    // `1` rather than `0`: an all-zero table would divide by zero and every bar
    // would be `NaN%`, which the browser drops on the floor silently.
    const max = Math.max(...measured, 1);
    for (const row of rows) {
      const line = el('div', 'div-row');
      const name = el('span', 'div-name', row.id);
      // `.div-name` ellipsises, so the full id has to survive somewhere. A
      // `title` is an ATTRIBUTE sink and an item id is a literal, not a
      // translated string, so nothing goes through `tFlat` here.
      name.setAttribute('title', row.id);
      line.append(
        name,
        ratioHalf('div-l', row.delivered, max),
        ratioHalf('div-r', row.spilled, max),
        el('span', 'div-n', `${tally(row.delivered)}/${tally(row.spilled)}`),
      );
      ratioPlate.append(line);
    }
    // The mockup's key row: an empty cell, the two words under their own
    // halves, an empty cell. A legend under no bars is a legend for nothing, so
    // it is drawn only when there are bars.
    //
    // **Both words are keys that already exist, and neither is new.** The
    // mockup writes them as bare English/Hebrew literals in its script, under
    // no `data-t`, so this screen has no key of its own for them and may not
    // invent one — `strings-parity` fails a key the design of record does not
    // declare. `preview.delivered` and `sim.spills` are the same two words in
    // the same two languages, already declared and already on screen: in
    // Hebrew they are the mockup's legend verbatim (`נמסר`, `נשפך`), and in
    // English they differ only in being the table's own column headings
    // ("Delivered", "Spills") rather than the legend's lowercase. Borrowing the
    // fits table's word for the fits table's quantity is the reading that keeps
    // the two halves of this screen agreeing; recorded for the owner all the
    // same.
    if (rows.length === 0) return;
    const key = el('div', 'div-row');
    const delivered = el('span', 'div-n');
    delivered.append(...ctx.t('preview.delivered'));
    const spilled = el('span');
    spilled.append(...ctx.t('sim.spills'));
    key.append(el('span'), delivered, spilled, el('span'));
    ratioPlate.append(key);
  }

  let pending = null;

  async function run(value = Number(slider.value)) {
    budgetVal.textContent = num(value);
    try {
      const both = await fetchBoth(String(value));
      drawTable(both);
    } catch (error) {
      tbody.replaceChildren();
      chipNote.replaceChildren(errorNote(error.message));
    }
  }

  slider.oninput = () => {
    budgetVal.textContent = num(Number(slider.value));
    clearTimeout(pending);
    pending = setTimeout(() => { void run(); }, 150);
  };
  ctx.onSessionChange(() => { void run(); });

  drawTierPick();
  try {
    // The defaults, from the config the server is running on — never a literal
    // in this file. The mockup's `TIER_BUDGET` is demo data; `budgets` on the
    // response is `Config.budgets`, which is what a reader is dragging away
    // from and needs to be able to drag back to.
    const both = await fetchBoth(null);
    budgets = both.compact.budgets;
    slider.value = String(budgets[tier]);
    budgetVal.textContent = num(budgets[tier]);
    drawTable(both);
  } catch (error) {
    chipNote.replaceChildren(errorNote(error.message));
  }

  /**
   * The spill ratio, once. It reads HISTORY — how often each item was delivered
   * and how often it was selected and could not be fitted — so it follows
   * neither the slider nor the tier picker nor the session, and re-fetching it
   * on a drag would be one request per rung for an answer that cannot have
   * changed. The language toggle re-runs `render()`, which is what repaints it.
   *
   * **Its own try/catch, and deliberately not the table's.** `/api/watch/ratio`
   * refuses with a 503 whenever the audit projection is behind its log — which
   * is not a hypothetical, it is this repository's most-repeated operational
   * state — and a shared catch would blank the fits table, which is served by a
   * different endpoint reading a different store and is still perfectly true. A
   * refusal is drawn in the SERVER'S OWN WORDS and INSTEAD of the bars, never
   * beside an empty plate: an endpoint that refused and a projection holding no
   * spills are two facts, and the second one draws an empty plate on purpose.
   */
  try {
    // No `limit`: the endpoint's own default is ten and its header says where
    // that line is drawn and why. A number here would be a second opinion.
    const ratio = await ctx.api('/api/watch/ratio');
    drawRatio(ratio.rows);
  } catch (error) {
    ratioPlate.replaceChildren(errorNote(error.message));
  }
}
