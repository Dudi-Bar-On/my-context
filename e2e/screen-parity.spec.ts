/**
 * **Every KIND of element the mockup draws on a screen must exist on that
 * screen in the app — and the gaps are a ledger that may only shrink.**
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * On 2026-08-22 the Audit stream screen landed, rendered, passed every gate,
 * and was wrong the moment the owner looked at it. Measured element by element
 * against the mockup it was missing 109 `<rect>` elements — the entire graphic
 * of the screen — plus the token bar, the regime-change row and five status
 * chips. Nothing in the suite could fail for that, because nothing compared the
 * app to the design of record.
 *
 * Screenshots did not catch it either. Four were taken that day and read
 * approvingly. A tally does not read approvingly.
 *
 * ── WHAT IS COMPARED, AND WHY IT IS KINDS AND NOT COUNTS ───────────────────
 *
 * A "kind" is `tag.class1.class2` with the classes sorted — `svg`, `rect`,
 * `div.ladder.plate`, `span.chip.ok`. For each screen this collects the set of
 * kinds the mockup's `[data-p="<name>"]` section renders, and the set the app's
 * section renders, and reports what the mockup has that the app does not.
 *
 * **Counts are deliberately NOT compared.** The mockup carries four sample rows
 * where the app renders 275 real items; on the Audit stream the app draws 382
 * elements to the mockup's 218 and is right to. Equality of counts would fail
 * on correctness. What must hold is that no KIND is absent: a screen missing
 * every `<rect>` is missing its graphic, however many rows it drew.
 *
 * Hidden elements are excluded on both sides. The mockup keeps every state
 * variant in markup and shows one — six git states, five context states — so
 * counting hidden nodes would demand the app render states that are not true.
 *
 * ── THE LEDGER, AND WHY IT FAILS IN BOTH DIRECTIONS ────────────────────────
 *
 * `KNOWN_GAPS` records what is missing today, per screen, measured. A screen
 * whose gaps match its entry passes. Two things fail:
 *
 *   - **A gap not in the ledger** — a regression, or a screen that was built
 *     without reading the mockup. This is the case this file exists for.
 *   - **A ledger entry that is no longer missing** — the gap was closed and
 *     nobody updated the ledger. Failing here is what stops the list rotting
 *     into a permanent excuse: closing a gap forces the entry out, so the
 *     ledger can only ever shrink.
 *
 * That is the same mechanism `test.fail()` gave the empty-band assertion, which
 * did exactly this and forced its own removal when `renderChrome()` landed.
 *
 * **This ledger is not a target to be tuned green.** Every entry is a task in
 * mycontext under `plan:screens`. Deleting an entry to make the suite pass,
 * without building the thing, is the one edit that makes this file worse than
 * nothing.
 */
import { test, expect } from './app.ts';

/** `tag.class1.class2`, classes sorted, for one visible element. */
const COLLECT_KINDS = (selector: string): string[] | null => {
  const root = document.querySelector<HTMLElement>(selector);
  if (root === null) return null;
  const kinds = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    // `offsetParent === null` catches display:none and every ancestor's
    // [hidden]; the position check keeps a legitimately fixed element in.
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const raw = typeof el.className === 'string' ? el.className.trim() : '';
    const cls = raw === '' ? '' : `.${raw.split(/\s+/).sort().join('.')}`;
    kinds.add(`${el.tagName.toLowerCase()}${cls}`);
  }
  return [...kinds].sort();
};

/**
 * Screens the app has a module for. Not derived from the rail: the rail lists
 * all 21 by design, and the eleven with no module are a different fact from a
 * screen that exists and is incomplete.
 */
const BUILT = [
  'preview', 'coverage', 'gaps', 'simulate', 'injected',
  'watch', 'doctor', 'decay', 'graph', 'status', 'learn',
] as const;

/**
 * Measured on 2026-08-22 at 1568x779 against this repository's own corpus.
 *
 * Read the shape of it: almost every entry is a GRAPHIC. `svg`, `rect`,
 * `circle`, `line`, `path`, `text`, and the structures that carry them —
 * `div.ribbon`, `div.ladder.plate`, `div.heat.plate`, `div.segbar`,
 * `div.track`. The screens draw their data and omit their pictures. That is one
 * defect repeated eleven times, not eleven defects.
 *
 * `injected` is empty because that screen is complete. It is the proof the
 * comparison can reach zero.
 */
/**
 * **Screens whose gap set moves with the DATA, not with the code.**
 *
 * For these the ledger is a CEILING, not an exact match: a gap must still be
 * listed, but an entry that is temporarily closed does not fail. Everywhere
 * else the ledger stays exact and can only shrink.
 *
 * `watch` is here because it draws what the audit log happens to contain.
 * `div.tokbar`, `div.tokvoid`, `div.nt` and `span.chip.ok` need an INJECTION
 * record in the recent window; `div.rw`, `span.ln` and `tr.regime` need a FOCUS
 * record; `rect` needs any record at all inside the pulse's twenty-minute
 * window. `screens/watch.js` builds all of them — photographed doing so in
 * `reports/2026-08-22-ui3-11-watch/watch-live-1568x779.png` — and this
 * repository's own newest fifty records happen to be mutations, so most are
 * absent here on most runs.
 *
 * That is not a hypothetical. The ledger was measured at 15 gaps, shrank to 8
 * an hour later as the corpus changed, and `rect` came back on the very next
 * run because the pulse window emptied. An exact ledger over live data is a
 * test that fails for a reason that is not a regression, which this project has
 * already learned is the most expensive kind of red.
 *
 * **The real fix is a fixture corpus** holding one record of every kind, so the
 * comparison measures the code instead of the day. `e2e/app.ts` already takes
 * `MYCONTEXT_E2E_CORPUS`, so the hook exists. Tracked as its own task; until
 * then this exemption is the honest way to keep the gate useful for the other
 * ten screens rather than switching it off.
 */
const DATA_DEPENDENT = new Set<string>(['watch']);

const KNOWN_GAPS: Record<string, string[]> = {
  preview: [
    'button', 'div.binds.rung', 'div.carrieditem.small', 'div.gap', 'div.gh',
    'div.ghosts', 'div.gladder.plate', 'div.head.seg', 'div.hint', 'div.index.seg',
    'div.notrun', 'div.pass.rung', 'div.pinned.seg', 'div.plate', 'div.ribbon',
    'div.rlabel', 'div.segbar', 'div.track', 'i', 'li', 'span.chip', 'span.chip.ok',
    'span.n', 'span.prop', 'span.q', 'ul',
  ],
  coverage: ['div', 'div.mini', 'i', 'i.g', 'i.u', 'i.x'],
  gaps: ['b', 'button.icon', 'span.m', 'span.v', 'td', 'td.m', 'td.small'],
  simulate: [
    'b', 'circle', 'div', 'div.at', 'div.card.pane.sim', 'div.div-l', 'div.div-r',
    'div.div-row', 'div.ev', 'div.ladder.plate', 'div.readout', 'div.small', 'h3',
    'i', 'line', 'path', 'span.div-n', 'span.div-name', 'svg', 'text',
  ],
  injected: [],
  // Shrank from 15 to 8 while this gate was being written: the agent building
  // screens/watch.js landed the SVG (rect, svg), the bidi runs and the table,
  // and the gate demanded the ledger follow. Exactly the mechanism.
  //
  // **SEVEN OF THESE EIGHT ARE DATA, NOT CODE, and this entry will fail in the
  // stale-entry direction the day that changes.** `screens/watch.js` builds
  // `div.nt`, `div.tokbar`, `div.tokvoid` and `span.chip.ok` for every
  // INJECTION row and `div.rw`, `span.ln` and `tr.regime` for every FOCUS
  // record; all seven are absent here only because this corpus's newest fifty
  // audit records happen to be mutations. Photographed rendering, all seven, in
  // `reports/2026-08-22-ui3-11-watch/watch-live-1568x779.png` — the same build
  // over a corpus that has injections and a focus change in its recent history.
  // When one lands in this corpus's newest fifty, this entry shrinks, and the
  // correct edit is to remove the closed names — not to widen the screen's
  // backlog window until the gate agrees with the ledger.
  //
  // `b` is the one real gap: the mockup bolds three runs inside translated
  // strings (`Activity pulse`, `regime change`, `hatched void`) and
  // `lib/i18n.js`'s run grammar has no emphasis marker, so no string table can
  // carry one. Tracked as
  // TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup.
  //
  // The same entry is also hostage to the audit PROJECTION: it went stale
  // twice in forty minutes of ordinary work on 2026-08-22, and a stale
  // projection empties this screen entirely — `rect`, `svg`, `td`, `bdi` and
  // both chips vanish and the gate fails in the other direction, for a reason
  // that is not a regression. Tracked as
  // TASK-on-a-working-corpus-the-audit-projection-is-stale-within.
  watch: [
    // The union of every kind observed absent across runs — a ceiling, not a
    // measurement of one moment. See DATA_DEPENDENT above.
    'b', 'bdi', 'div.nt', 'div.rw', 'div.tokbar', 'div.tokvoid', 'rect',
    'span.chip.crit', 'span.chip.ok', 'span.chip.warn', 'span.ln', 'svg', 'td',
    'td.m.small', 'tr.regime',
  ],
  doctor: ['b', 'span.m', 'span.m.v', 'span.prop'],
  decay: [
    'b', 'circle', 'div', 'div.heat.plate', 'div.heataxis', 'div.hname', 'div.hstrip',
    'div.legend', 'div.plate', 'i', 'i.badpin', 'i.cold', 'i.h1', 'i.h2', 'i.h3',
    'i.never', 'i.sp', 'i.warm', 'line', 'rect', 'span.ln', 'svg', 'text',
  ],
  graph: ['b', 'path'],
  status: ['b'],
  learn: ['i', 'span.m'],
};

test('every screen draws every KIND of element its mockup section draws', async ({ app }) => {
  // **This one test walks ELEVEN screens twice**, waits 300ms for each mockup
  // section to settle and up to 25 x 400ms for each app screen to stop growing.
  // Alone it takes 16s; inside the full suite, with six workers each running
  // their own server over the same corpus, it took 22.5s in `chrome` and
  // **timed out at 30s in `chromium` on the same run** — a wall-clock failure
  // with no assertion behind it, which is the worst kind of red because it
  // reads exactly like a regression. The budget is raised rather than the
  // settle loop shortened: shortening it is how this file's own header records
  // sampling a half-drawn screen and writing a ledger full of gaps that were
  // not there.
  test.setTimeout(180_000);
  const { page } = app;

  // The mockup is opened in a second page of the same context rather than a
  // second fixture: one browser, one run, and the two renders are guaranteed
  // to be at the same viewport and colour scheme.
  const mockupPage = await page.context().newPage();
  const { MOCKUP_URL } = await import('./mockup.ts');
  await mockupPage.goto(MOCKUP_URL);
  await mockupPage.waitForLoadState('domcontentloaded');

  const report: string[] = [];
  const stale: string[] = [];

  try {
    for (const screen of BUILT) {
      await mockupPage.evaluate((name) => {
        for (const section of document.querySelectorAll<HTMLElement>('[data-p]')) {
          section.hidden = section.dataset.p !== name;
        }
      }, screen);
      // The mockup's own transitions run on `hidden`; sample after they settle.
      await mockupPage.waitForTimeout(300);
      const mockKinds = await mockupPage.evaluate(COLLECT_KINDS, `[data-p="${screen}"]`);
      expect(mockKinds, `the mockup has no [data-p="${screen}"] section — the screen list ` +
        'and the design of record disagree').not.toBeNull();

      await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
      // **Wait for the render to SETTLE, not merely to start.**
      //
      // A screen draws its heading synchronously and its data after one or more
      // fetches resolve, so "has any element" is true almost immediately and is
      // the wrong signal — sampling on it reported `div.scene` and `div.pair`
      // missing from the preview screen, which are plainly there. That would
      // have written a ledger full of gaps that do not exist, which is worse
      // than no ledger at all.
      //
      // Two consecutive equal counts, sampled 400ms apart, is the signal: a
      // screen still fetching changes between samples. Capped so a genuinely
      // empty screen fails on the assertion below rather than hanging here.
      let previous = -1;
      for (let attempt = 0; attempt < 25; attempt++) {
        const now = await page.evaluate(
          (s) => document.querySelectorAll(`[data-p="${s}"] *`).length, screen);
        if (now > 0 && now === previous) break;
        previous = now;
        await page.waitForTimeout(400);
      }
      expect(previous, `${screen}: never rendered anything`).toBeGreaterThan(0);
      const appKinds = (await page.evaluate(COLLECT_KINDS, `[data-p="${screen}"]`)) ?? [];

      const missing = mockKinds!.filter((k) => !appKinds.includes(k));
      const known = KNOWN_GAPS[screen] ?? [];
      const unexpected = missing.filter((k) => !known.includes(k));
      // A data-dependent screen's ledger is a ceiling: an entry that is closed
      // today may be open tomorrow because the corpus moved, not because the
      // code did, so 'no longer missing' is not a finding there.
      const closed = DATA_DEPENDENT.has(screen)
        ? [] : known.filter((k) => !missing.includes(k));

      if (unexpected.length > 0) {
        report.push(`${screen}: the mockup draws these and the app does not, and they are ` +
          `NOT in the ledger — ${JSON.stringify(unexpected)}`);
      }
      if (closed.length > 0) {
        stale.push(`${screen}: these are in KNOWN_GAPS but are no longer missing — delete them ` +
          `from the ledger and close the matching task — ${JSON.stringify(closed)}`);
      }
    }
  } finally {
    await mockupPage.close();
  }

  expect(report, 'a screen is missing something the design of record draws. Read the mockup ' +
    'section and build it, or add a task and record it in KNOWN_GAPS — never delete a ledger ' +
    'entry to go green').toEqual([]);
  expect(stale, 'the ledger claims a gap that is closed. This failure is the ledger working: ' +
    'it can only shrink, and closing a gap must remove its entry').toEqual([]);
});
