/**
 * **The budget simulator can be asked the COLD question — which it now opens
 * on — says which one it is answering, and the WARM one is one press away** —
 * `plan:walk seq:86`, `plan:budget seq:6` and `plan:budget seq:12`, in a real
 * browser over the real DOM.
 *
 * ── WHAT WAS MEASURED WHEN WARM WAS STILL THE DEFAULT (2026-08-31) ─────────
 *
 * Driven against this repository's own corpus:
 *
 *     the screen contained the string `cold` zero times
 *     every query carried `session=<id>`, so only the warm question was askable
 *     the fits table drew `restored 0 of 0` and `continuity 0 of 0`
 *     104 items had been removed one gate earlier, named in no cell of it
 *
 * Same corpus, same event, only the session parameter differing:
 *
 *     session=<id>   pinned  1 of 1      seenFiltered 104
 *     cold=1         pinned 24 of 25     seenFiltered   0
 *
 * That shape got a fix — `plan:walk seq:86` built the toggle below — but the
 * ruling that shipped with it kept warm as the DEFAULT. **That default is what
 * broke again on 2026-09-04**
 * (`TASK-the-budget-simulator-draws-no-rungs-because-the-seen-gate`): the same
 * repository, one long-running session later — 519 seen-file lines, 136 unique
 * ids — answered `seenFiltered: 134` of this corpus's 143 injectable items on
 * the very session the owner had open, and every rung of every tier drew
 * `sim.stair0seen`. Not a corner of the corpus; 93.7% of the whole injectable
 * pool. The message was correct and is unchanged — it is what a simulator
 * defaulting to one session's accumulated history was always going to say
 * often enough. `plan:budget seq:12`'s decision: the simulator answers *what
 * would be selected under this path and these budgets*, a question about the
 * corpus and the config rather than about any one reader's `seen` file, so
 * COLD is now what a reader opens on. Warm is not removed — it is exactly the
 * control built below, reachable by one press, and this file still drives it.
 *
 * ── WHY THE WARM READING STILL MUST BE DRIVEN, NOT FIXTURED ────────────────
 *
 * `plan:walk seq:86`'s own done-when: *"a browser test drives a session that has
 * already been delivered items, because a cold fixture cannot reproduce the
 * defect — that is the blindness that let it ship."* A cold corpus answers zero
 * at the `seen` gate by construction, so a spec that only ever rendered cold
 * would pass against the defect it exists to catch. Every assertion below is
 * taken in the shell's own cold default first — where the `seen` gate removing
 * nothing is guaranteed by construction — and the warm reading is taken by
 * PRESSING the control rather than by rebuilding the page.
 *
 * **It writes nothing.** The question is client state and the restore control
 * touches only the range store, so every assertion here is reversible by closing
 * the page — `e2e/simulate-slider.spec.ts` documents in full why a spec that
 * changes a budget changes it underneath every other worker on the one shared
 * `.demo-corpus`, and this spec deliberately never needs that.
 */
import { expect, test } from './app.ts';
import { settleScreen } from './settle.ts';

const SIM = '[data-p="simulate"]';

/**
 * The router keeps every visited screen inside `#screen`, merely hidden, and the
 * injection preview draws a question strip of its own. Every locator below is
 * scoped to `[data-p="simulate"]` for that reason and not for tidiness: an
 * unscoped `[data-q="cold"]` is a strict-mode violation the moment a walk has
 * been through the preview.
 */
const warmButton = `${SIM} #simq button[data-q="live"]`;
const coldButton = `${SIM} #simq button[data-q="cold"]`;

test('the question strip offers both, answers cold by default, and says which it is showing', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });
  const walk = await settleScreen(page, 'simulate', { requires: '#simq button' });
  expect(walk.settled,
    `the simulator never settled (${walk.inFlight} \`/api\` reads in flight) — this is a LOAD `
    + 'failure and not a missing control. Run this spec alone before believing anything below.')
    .toBe(true);

  // Both questions are reachable, and the pressed one SAYS SO. `plan:budget
  // seq:12` moved which one that is — cold, here, deliberately unlike the
  // injection preview — but not that a reader must always be able to tell
  // which of the two they are looking at.
  await expect(page.locator(coldButton)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(warmButton)).toHaveAttribute('aria-pressed', 'false');

  // The warm option is named by the SESSION ITSELF — a value, not prose — which
  // is what identifies the question it would ask, whether or not it is the one
  // pressed right now.
  const label = await page.locator(`${warmButton} b.v`).textContent();
  expect(label?.trim(), 'the warm option must name the session it is asking about').not.toBe('');
});

test('the seen gate is named, and pressing warm changes the answer rather than the label', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });
  const walk = await settleScreen(page, 'simulate', { requires: '#seenNote' });
  expect(walk.settled, `the simulator never settled (${walk.inFlight} in flight)`).toBe(true);

  // The count the `seen` gate removed is DRAWN, whichever way it reads. A
  // measured zero is named as a zero (`sim.seen0`) and a non-zero names its
  // number — the standard this whole task is an instance of.
  const seenCold = (await page.locator(`${SIM} #seenNote`).textContent()) ?? '';
  expect(seenCold.trim(), 'the seen gate was left silent').not.toBe('');

  // Cold has been shown nothing, so the gate removed nothing — by construction,
  // on every corpus. That is the one cross-corpus assertion this file can make
  // about the count on the DEFAULT screen, and `plan:budget seq:12`'s entire
  // point: the default answer no longer depends on which session is open.
  expect(seenCold).toMatch(/Nothing was removed/);

  // The table's rows, cold. A cold reading may only ever explain an empty tier
  // as "nothing qualified" — nothing has been delivered to a window that does
  // not exist yet.
  const zeroRowsCold = await page.locator(`${SIM} #simtbl tr`).evaluateAll(
    (rows) => rows.map((r) => r.textContent ?? '').filter((t) => t.includes('0 of 0')),
  );
  for (const row of zeroRowsCold) {
    expect(row, `a tier drew "0 of 0" cold and gave a reason other than "nothing qualified" — ${row}`)
      .toMatch(/nothing qualified/);
  }

  await page.locator(warmButton).click();
  const warm = await settleScreen(page, 'simulate', { requires: '#seenNote' });
  expect(warm.settled, `the warm question never settled (${warm.inFlight} in flight)`).toBe(true);

  // The control is not decorative: it moves the QUESTION, and the pressed state
  // follows it so the two readings are never confused for one another.
  await expect(page.locator(warmButton)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(coldButton)).toHaveAttribute('aria-pressed', 'false');

  // The table's rows, warm. Whatever this corpus and this session answer, a row
  // reading `0 of 0` must still carry a REASON beside it rather than a bare
  // ratio — the same element read differently one click apart, which is the
  // proof the note is MEASURED rather than a constant.
  const seenWarm = (await page.locator(`${SIM} #seenNote`).textContent()) ?? '';
  expect(seenWarm.trim(), 'the seen gate was left silent once warm').not.toBe('');

  const zeroRowsWarm = await page.locator(`${SIM} #simtbl tr`).evaluateAll(
    (rows) => rows.map((r) => r.textContent ?? '').filter((t) => t.includes('0 of 0')),
  );
  for (const row of zeroRowsWarm) {
    expect(row, `a tier drew "0 of 0" and did not say which emptiness it is — ${row}`)
      .toMatch(/already delivered|nothing qualified/);
  }
});

test('the value in force is shown beside the edited one, and one control puts it back', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });
  const walk = await settleScreen(page, 'simulate', { requires: '#restorectl button' });
  expect(walk.settled, `the simulator never settled (${walk.inFlight} in flight)`).toBe(true);

  const slider = page.locator(`${SIM} input[type="range"]`).first();
  const inForce = page.locator(`${SIM} #inForce`);
  const restore = page.locator(`${SIM} #restorectl button`);

  const force = (await inForce.textContent())?.trim() ?? '';
  const started = await slider.inputValue();
  expect(force, 'the budget in force was not drawn beside the one being simulated').not.toBe('');

  // Nothing has changed, so the control answers "nothing has changed" by being
  // unpressable. That is the second question it exists to answer.
  await expect(restore).toBeDisabled();

  // Edit. `fill` on a range input sets the value and fires `input`, which is the
  // event the screen listens on.
  await slider.fill('1');
  await expect(restore).toBeEnabled();
  expect(await slider.inputValue(), 'the thumb did not take the edit').toBe('1');

  // The in-force number must NOT have followed the thumb — that is the whole of
  // what the reader had lost without it, and the defect the owner reported.
  expect((await inForce.textContent())?.trim(),
    'the budget in force followed the thumb, so the reader still cannot see what it was')
    .toBe(force);

  await restore.click();
  await expect(restore).toBeDisabled();
  expect(await slider.inputValue(), 'restore did not put the simulated value back')
    .toBe(started);
});
