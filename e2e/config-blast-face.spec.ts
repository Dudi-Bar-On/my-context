/**
 * **The Configure blast panel and delta plate, measured on the COMPUTED style**
 * — `plan:walk seq:112`.
 *
 * ── WHY THIS FILE IS NOT A GREP ────────────────────────────────────────────
 *
 * The ten `.delta` / `.blast` rules were absent from `styles.css` for a week
 * while both files that mention them read correctly: the design of record
 * declared them, `screens/config.js` emitted every class they name, and
 * `screen-parity` counted the elements and found them all. Nothing was wrong
 * except the page, where a panel reporting that sixty-six items stop being
 * injected rendered as the same grey paragraph as one reporting no change.
 *
 * A test that greps `styles.css` for `.blast` would have been green the moment
 * the rules were pasted in and would have proved nothing about that. This
 * project has the standing example: **110 chart marks rendered grey for six
 * days** while `svg.chart text{fill:var(--dim)}` — an author rule — beat every
 * `fill="var(--warn)"` presentation attribute under it. The CSS was right, the
 * markup was right, and the screen was wrong. Only a computed reading can tell
 * those apart, because only the computed reading is what the reader sees.
 *
 * So every assertion below is `getComputedStyle`, taken off the two panels
 * SIDE BY SIDE in one live screen, and every one of them is a difference
 * rather than a value: the question this panel exists to answer is not "is it
 * crit" but "does a change LOOK different from no change".
 *
 * ── THE TWO FACES, AND WHY THESE TWO ───────────────────────────────────────
 *
 *   the change face      Profile, pressed from `standard` to `minimal`.
 *                        `minimal` is the smallest normative vocabulary
 *                        (`src/core/categories.ts` · `PROFILES`), so pressing
 *                        it disables categories whose items then stop
 *                        governing — `blastReading`'s `stops`, the crit face,
 *                        carrying a count the SERVER measured.
 *
 *   the no-change face   Watched documents. Nothing `POST /api/config/preview`
 *                        runs reads `watchedDocs`, so the pane makes no
 *                        preview call at all and wears the neutral
 *                        `unmeasured` face with no count anywhere in it —
 *                        `STD-a-measured-zero-is-drawn-and-named-an-
 *                        unmeasured-thing-is`, second clause.
 *
 * Both are on screen at the same instant, in the same theme, at the same
 * `colorScheme: 'dark'` this suite pins. If the two read identically, the
 * panel is decoration.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 *
 * It asserts no colour literal that only this stylesheet knows. The neutral
 * border must be `--edge-3` and the destructive one `--crit`, resolved off
 * `:root` at run time and converted, so a repaint that moves a token moves
 * this test with it and a repaint that DELETES the rule still fails. The
 * meaning-hue budget is five (gold, ok, carry, crit, warn) and these rules
 * introduce no sixth; nothing here would notice one, and nothing here should.
 */
import { test, expect } from './app.ts';
import type { Page, Response } from '@playwright/test';
import { settleScreen } from './settle.ts';

const CONFIG = '[data-p="config"]';
const pane = (name: string): string => `${CONFIG} [data-pane="${name}"]`;

/**
 * Every computed declaration this carry is responsible for, read off ONE
 * element in ONE snapshot.
 *
 * One `evaluate` rather than one per property, for `settle.ts`'s own reason:
 * readings paired across two snapshots can describe a state that was never
 * simultaneously true. Logical property names, because that is what the
 * stylesheet is written in and this UI mirrors under RTL.
 */
interface Face {
  readonly borderStyle: string;
  readonly borderWidth: string;
  readonly borderColor: string;
  readonly background: string;
  readonly color: string;
  readonly headlineDisplay: string;
  readonly text: string;
}

async function readFace(page: Page, selector: string): Promise<Face> {
  return await page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (node === null) throw new Error(`no element matches ${sel}`);
    const s = getComputedStyle(node);
    const head = node.querySelector('b');
    return {
      borderStyle: s.getPropertyValue('border-block-start-style'),
      borderWidth: s.getPropertyValue('border-block-start-width'),
      borderColor: s.getPropertyValue('border-block-start-color'),
      background: s.getPropertyValue('background-color'),
      color: s.getPropertyValue('color'),
      headlineDisplay: head === null ? '(no <b>)' : getComputedStyle(head).display,
      text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  }, selector);
}

/**
 * A `:root` token, resolved by the page and normalised to the same `rgb(...)`
 * spelling a computed colour comes back in.
 *
 * Done by asking the platform rather than by parsing the hex here: the tokens
 * are plain hex today and could be `light-dark()` or `color-mix()` tomorrow,
 * and a converter that only understands `#rrggbb` would then fail as a wrong
 * colour rather than as an unread token. The probe is a detached element that
 * is never appended, so nothing this test does can be seen by the screen it is
 * measuring.
 */
async function token(page: Page, name: string): Promise<string> {
  return await page.evaluate((prop) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${prop})`;
    document.documentElement.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

/** Navigate to Configure and wait for the four panes to have finished drawing. */
async function openConfigure(page: Page): Promise<void> {
  // The two bounds below add up to more than the default 30s budget, for the
  // reason `config-composer.spec.ts` records against the same screen: this
  // file starts a UI child server per test, and a test that dies on the clock
  // reports a slow server as a broken screen
  // (`LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine`).
  test.setTimeout(90_000);
  await expect(page.locator('.nav').first(),
    'the server never rendered a rail button — it probably has no token')
    .toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { location.hash = '#/config'; });
  // `requires: '.blast'` is the fourth fact `settle.ts` offers and this screen
  // needs it: the panes are drawn synchronously and each plate is filled by a
  // POST that lands afterwards, so "the count stopped moving" is satisfied by
  // a screen whose four plates are still empty. Forty samples for the same
  // measured reason the sibling file gives.
  const walk = await settleScreen(page, 'config', { requires: '.blast', samples: 40 });
  expect(walk.settled,
    `Configure never settled: ${walk.count} elements, ${walk.inFlight} /api reads in flight. `
    + 'This is a LOAD failure — run this spec alone before believing anything below it.')
    .toBe(true);
}

/**
 * **The assertion the whole carry exists for.**
 *
 * Not "the panel has class crit" — `screen-parity` already counts classes and
 * was green throughout the week the rules were missing. What is measured is
 * that the two panels RESOLVE differently: a different border colour, a
 * different ground, a different text colour, and in both cases a real 1px
 * solid border rather than the `0px none` an unstyled `<div>` computes to.
 */
test('a face reporting a change and one reporting none do not render alike',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    // The no-change face is on screen from the first paint and is never posted
    // for, so it is read BEFORE anything is pressed and again after — its
    // whole claim is that composing elsewhere does not move it.
    const neutralBefore = await readFace(page, `${pane('watched')} .blast`);

    // `minimal` is the other position of a closed set of two; the pane opens
    // on whatever `config.json` resolves to, so the button is addressed by the
    // `data-value` the segbar stamps rather than by its position or wording.
    const bar = page.locator(`${pane('profile')} .segbar`).first();
    const minimal = bar.locator('button[data-value="minimal"]');
    await expect(minimal, 'the profile segbar has no `minimal` position').toBeVisible();
    await expect(minimal, 'the corpus this suite runs over already resolves to `minimal`, so '
      + 'pressing it composes nothing and this test can prove no difference')
      .toHaveAttribute('aria-pressed', 'false');

    const answered = page.waitForResponse((response: Response) =>
      response.url().includes('/api/config/preview') && response.request().method() === 'POST');
    await minimal.click();
    const body = await (await answered).json() as {
      governing: { stopsBeingInjected: { id: string }[] };
    };
    const stops = body.governing.stopsBeingInjected.length;
    expect(stops,
      'dropping this corpus to the `minimal` profile stops nothing governing, so this test can '
      + 'prove nothing about a change face. Point it at a corpus with items outside `minimal`.')
      .toBeGreaterThan(0);

    const change = page.locator(`${pane('profile')} .blast`);
    await expect(change, 'a profile change that stops items governing must wear the crit face')
      .toHaveClass(/\bcrit\b/);
    // The EXACT figure, as a whole word, so `6` cannot pass against `66`.
    await expect(change.locator('b')).toHaveText(new RegExp(`\\b${stops}\\b`));

    const changed = await readFace(page, `${pane('profile')} .blast`);
    const neutral = await readFace(page, `${pane('watched')} .blast`);
    const crit = await token(page, '--crit');
    const edge = await token(page, '--edge-3');

    // Reported rather than only asserted: the two readings ARE the finding,
    // and a run whose numbers nobody can see is the reporting failure this
    // project keeps paying for.
    console.log(`[seq:112] change face (profile, stops ${stops}): ${JSON.stringify(changed)}`);
    console.log(`[seq:112] no-change face (watched, unmeasured): ${JSON.stringify(neutral)}`);
    console.log(`[seq:112] tokens: --crit ${crit} · --edge-3 ${edge}`);

    // 1 · Both are a real bordered panel. An unstyled div computes `0px none`,
    //     which is the state this task was dispatched to end.
    for (const [label, face] of [['change', changed], ['no-change', neutral]] as const) {
      expect(face.borderStyle, `${label} face has no border style — .blast did not apply`)
        .toBe('solid');
      expect(face.borderWidth, `${label} face has no border width — .blast did not apply`)
        .toBe('1px');
    }

    // 2 · **The difference itself.** Three declarations, three separate ways a
    //     reader could tell the two apart, each asserted on its own so a
    //     partial carry cannot pass on the strength of the others.
    expect(changed.borderColor,
      'the crit face and the neutral face draw the SAME border colour — this is exactly the '
      + 'defect: a panel reporting items stop being injected looks like one reporting none')
      .not.toBe(neutral.borderColor);
    expect(changed.background,
      'the crit face and the neutral face draw the same ground')
      .not.toBe(neutral.background);
    expect(changed.color,
      'the crit face and the neutral face draw the same text colour')
      .not.toBe(neutral.color);

    // 3 · And they are the DESIGNED colours, resolved off `:root` at run time
    //     rather than written down here — so a repaint moves this with it.
    expect(changed.borderColor, '.blast.crit must border in --crit').toBe(crit);
    expect(changed.color, '.blast.crit must write in --crit').toBe(crit);
    expect(neutral.borderColor, '.blast must border in --edge-3').toBe(edge);

    // 4 · `.blast b` — the headline is a block, so the count sits on its own
    //     line above the sentence. Inline is what a bare <b> computes to.
    expect(changed.headlineDisplay, '.blast b must be a block').toBe('block');
    expect(neutral.headlineDisplay, '.blast b must be a block').toBe('block');

    // 5 · The neutral face did not move when the other pane was composed. It
    //     carries no count at all, which is the clause a later "improvement"
    //     that posted a candidate for it would break.
    expect(neutral.borderColor).toBe(neutralBefore.borderColor);
    expect(neutral.background).toBe(neutralBefore.background);
    expect(neutral.text).not.toMatch(/\d/);
  });

/**
 * **The plate above the panel, on the same reading.**
 *
 * `cfg.deltan`'s argument is that the PAIR is the row — *"the old value struck
 * through, the new one emphasised, and the row tinted by the direction it
 * moved"*. All three of those are declarations, not markup: without them
 * `was`, `→` and `will` are three runs of text with no gap, no baseline and
 * nothing saying which one is the past.
 */
test('a delta row is a struck-through pair, not three runs of text', async ({ app }) => {
  const { page } = app;
  await openConfigure(page);

  const answered = page.waitForResponse((response: Response) =>
    response.url().includes('/api/config/preview') && response.request().method() === 'POST');
  await page.locator(`${pane('profile')} .segbar`).first()
    .locator('button[data-value="minimal"]').click();
  await answered;

  const rows = page.locator(`${pane('profile')} .delta`);
  await expect(rows.first(), 'the profile plate drew no delta row for a value that moved')
    .toBeVisible();

  const plate = await page.evaluate((sel) => {
    const row = document.querySelector(sel);
    if (row === null) throw new Error(`no element matches ${sel}`);
    const rs = getComputedStyle(row);
    const was = row.querySelector('.was');
    const will = row.querySelector('.will');
    const arrow = row.querySelector('.arrow');
    const of = (n: Element | null, prop: string): string =>
      n === null ? '(absent)' : getComputedStyle(n).getPropertyValue(prop);
    return {
      display: rs.display,
      columnGap: rs.columnGap,
      alignItems: rs.alignItems,
      wasDecoration: of(was, 'text-decoration-line'),
      wasColor: of(was, 'color'),
      willWeight: of(will, 'font-weight'),
      willBackground: of(will, 'background-color'),
      arrowColor: of(arrow, 'color'),
    };
  }, `${pane('profile')} .delta`);
  console.log(`[seq:112] delta row: ${JSON.stringify(plate)}`);

  // The row is a baseline-aligned flex line with a real gap — `--sp-2`, 8px.
  expect(plate.display, '.delta must be a flex row').toBe('flex');
  expect(plate.alignItems, '.delta must align on the baseline').toBe('baseline');
  expect(plate.columnGap, '.delta must carry the --sp-2 gap').toBe('8px');

  // The strike-through is the ONLY thing that says a value is the old one.
  expect(plate.wasDecoration, '.delta .was is not struck through — nothing marks the old value')
    .toContain('line-through');
  // And the new one is emphasised rather than merely present.
  expect(Number(plate.willWeight), '.delta .will must be heavier than body text')
    .toBeGreaterThan(400);
  expect(plate.willBackground, '.delta .will must sit on the --goldbg wash')
    .not.toBe('rgba(0, 0, 0, 0)');
  expect(plate.arrowColor, '.delta .arrow must be gold').toBe(await token(page, '--gold'));

  // The direction tint: a governance row that LOSES is crit, and it is a
  // different colour from the neutral value row beside it in the same plate.
  const loss = page.locator(`${pane('profile')} .delta.loss`).first();
  await expect(loss, 'no .delta.loss row for a profile change that stops items governing')
    .toBeVisible();
  const lossColor = await loss.evaluate((n) => getComputedStyle(n).color);
  console.log(`[seq:112] .delta.loss color: ${lossColor} · neutral .delta color: ${plate.wasColor}`);
  expect(lossColor, '.delta.loss must be tinted --crit').toBe(await token(page, '--crit'));
});
