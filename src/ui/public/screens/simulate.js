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
 * **Two of the mockup's three cards are not drawn here, and nothing weaker is
 * drawn in their place** — *"Where a view cannot be drawn, stop and ask; do not
 * draw a weaker one"*:
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
 *     **Asked, not guessed.** The two rungs of prose that describe those charts
 *     go with them: `sim.snap` promises a slider that snaps to rungs, and a
 *     slider that does not snap under a sentence saying it does is worse than
 *     the missing chart.
 *   - **The spill ratio** (`#ratio`, with `sim.ratio` and `sim.ration`). Its own
 *     note names its source — *"`audit_item.role` through `topItems`"* — and
 *     that is the audit projection, which no route in this plan exposes.
 *
 * What IS drawn is what is fully served: the tier picker, the budget slider, and
 * the four-row fits table the slider drives. Every number in it comes from one
 * `/api/simulate` response, so the table cannot disagree with itself.
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
}
