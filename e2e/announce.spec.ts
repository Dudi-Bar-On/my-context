/**
 * **THE COPY BUTTON ACKNOWLEDGES, AND THE SHELL HAS SOMEWHERE TO SAY SO.**
 * `plan:walk seq:31`.
 *
 * ── THE DEFECT, AS IT WAS MEASURED ────────────────────────────────────────
 *
 * 2026-08-25, by `plan:review seq:5`, by clicking the button and reading the
 * clipboard: THE COPY WORKS — the Review queue's control put exactly
 * `mycontext review promote-revision …` on the clipboard. NOTHING SAID SO.
 * After the click the button's label, its class list and its ARIA attributes
 * were BYTE-IDENTICAL to before, and no element anywhere in the document had
 * changed. A reader could not tell a successful copy from a click that missed.
 *
 * ── WHY THIS IS A BROWSER TEST AND NOT A NODE ONE ─────────────────────────
 *
 * `test/ui/command-actions.test.ts` proves the CONTROL asks the shell to say
 * something, and it proves the sentence differs between a write that resolves
 * and a write that rejects. It cannot prove there is anywhere to say it: its
 * `ctx.announce` is a stub, and a stub that is called is not a live region.
 * The region is built by `app.js`, which spec §6 leaves untested on purpose,
 * so this file is its only witness — and the thing it witnesses is the one
 * thing a stub cannot: that a real `[aria-live]` element in a real document
 * CHANGES ITS CONTENT when a real `navigator.clipboard.writeText` settles.
 *
 * **A test that checked the region merely EXISTS would prove nothing**, and
 * proving-existence-instead-of-behaviour is the exact shape of defect this
 * task is about. So every assertion below reads the region's text BEFORE and
 * AFTER, and the failure path is driven by making the platform promise reject.
 *
 * ── HOW THE WRITE IS MADE TO REJECT ───────────────────────────────────────
 *
 * `navigator.clipboard` is a live `Clipboard` instance and `writeText` lives on
 * its prototype, so an OWN property defined on the instance shadows it for the
 * page. The override is installed after the app has booted and before the
 * click, which is exactly where the control reads it: `commandActions` calls
 * `navigator.clipboard.writeText(…)` at click time and never captures it. No
 * reload is needed and no app code is touched — what changes is what the
 * platform answers, which is the only thing that changes for a reader whose
 * browser refuses the write.
 *
 * Deliberately NOT done by revoking the clipboard permission: a revoked
 * permission in Chromium can surface as a prompt, a silent no-op or a
 * rejection depending on channel and focus, and a test whose failure mode
 * varies by browser build is not measuring the app.
 *
 * ── AND `.cmdstate`, WHICH WAS THE SAME MISTAKE IN A STRING ───────────────
 *
 * The Review queue drew *"copied, not yet observed landing"* beside every
 * command from first paint — beside a command nobody had copied.
 * `plan:walk seq:81` reported it and could not fix it in lane for want of a
 * key. Both states are asserted here, and asserted against the SETTLEMENT: the
 * refused write must leave the card saying "not copied", because a state
 * flipped by a click is the same lie one layer down.
 */
import { test, expect } from './app.ts';
import { settleScreen } from './settle.ts';

const WORK = '[data-p="work"]';
/** The shell's one region for a transient outcome. `app.js`' `ANNOUNCE_ID`. */
const REGION = '#announce';

/** The English table's own sentences, so a reword fails by name here. */
const COPIED = 'Copied to the clipboard.';
const FAILED = 'Copy failed. Nothing was written to the clipboard.';
const UNCOPIED = 'not copied';
const ARMED = 'armed';

/** Open the Review queue and wait for the property, never for a clock. */
async function openWork(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/work'; });
  const settled = await settleScreen(page, 'work', { requires: '.cmdactions button' });
  expect(
    settled.settled,
    `the Review queue never settled — ${settled.count} elements and ${settled.inFlight} /api `
    + `reads still open after ${settled.attempts} samples. Measured nothing; failing as itself.`,
  ).toBe(true);
}

/**
 * The revision card's Copy button. Scoped to `[data-queue="revision"]`: the
 * screen draws two queues and `.cmdactions` first() is no longer an
 * unambiguous way to name one.
 */
function copyButton(page: import('@playwright/test').Page) {
  return page.locator(`${WORK} [data-queue="revision"]`).first()
    .locator('.cmdactions').first()
    .getByRole('button', { name: 'Copy', exact: true });
}

function cmdState(page: import('@playwright/test').Page) {
  return page.locator(`${WORK} [data-queue="revision"]`).first().locator('.cmdstate').first();
}

test('the shell carries a live region, and it says NOTHING until something happens', async ({ app }) => {
  const { page } = app;
  await openWork(page);

  const region = page.locator(REGION);
  await expect(region, 'the shell never built a live region').toHaveCount(1);

  const shape = await page.evaluate((selector) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el === null) return null;
    const box = el.getBoundingClientRect();
    return {
      text: (el.textContent ?? '').trim(),
      live: el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      // The three ways a live region can be silenced, and none of them may be
      // true of it: a hidden region is not announced, and a region that is not
      // announced is decoration.
      inTree: el.checkVisibility({
        visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true,
      }),
      hidden: el.hidden,
      inProv: el.parentElement?.id ?? null,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }, REGION);

  expect(shape, 'the region vanished between the count and the read').not.toBeNull();
  expect(shape?.text, 'a region already holding words announces something nobody did').toBe('');
  expect(shape?.live, 'polite is the default; assertive is argued for, per outcome').toBe('polite');
  expect(shape?.atomic, 'these are whole sentences — half of one tells a reader nothing').toBe('true');
  expect(shape?.hidden, '[hidden] takes it out of the accessibility tree entirely').toBe(false);
  expect(shape?.inTree, 'display/visibility/opacity must all leave it announceable').toBe(true);
  expect(shape?.inProv, 'it belongs to the SHELL — one home, beside the provenance bar').toBe('prov');
  // Announced, not seen. The design of record has no shell slot for a transient
  // outcome, so it may not draw one: clipped to a pixel is the one way to be
  // invisible and still be read out.
  expect(shape?.width, 'the region must not be visible chrome').toBeLessThanOrEqual(2);
  expect(shape?.height, 'the region must not be visible chrome').toBeLessThanOrEqual(2);
});

test('a copy that RESOLVES changes what the live region says, and arms the card', async ({ app }) => {
  const { page } = app;
  await page.context().grantPermissions(['clipboard-write'], {
    origin: `http://127.0.0.1:${app.port}`,
  });
  await openWork(page);

  const region = page.locator(REGION);
  const state = cmdState(page);

  // BEFORE. Both halves of the defect, in their original state.
  await expect(region, 'nothing has happened yet').toHaveText('');
  await expect(
    state,
    'the card must not claim a copy nobody made — this is `plan:walk seq:81`',
  ).toContainText(UNCOPIED);

  await copyButton(page).click();

  // AFTER — and this is a real clipboard resolution, not a stubbed one: the
  // page holds `clipboard-write` and the write went to the browser's own
  // clipboard, which is what `plan:review seq:5` verified already worked and
  // already said nothing about.
  await expect(
    region,
    'the region\'s CONTENT must change when the write resolves. A region that exists and never '
    + 'changes is the same silence with an attribute on it',
  ).toHaveText(COPIED);
  await expect(
    region,
    'a success does not argue for interrupting what a reader is already being told',
  ).toHaveAttribute('aria-live', 'polite');
  await expect(state, 'the card is armed by the WRITE, not by the click').toContainText(ARMED);
});

test('a copy that REJECTS says so, interrupts, and leaves the card unarmed', async ({ app }) => {
  const { page } = app;
  await openWork(page);

  // The one line that makes this test different from the one above. See this
  // file's header for why the platform promise is shadowed rather than the
  // permission revoked.
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('clipboard write permission denied')),
    });
  });

  const region = page.locator(REGION);
  const state = cmdState(page);
  await expect(region).toHaveText('');

  await copyButton(page).click();

  await expect(
    region,
    'a refused write must be said out loud — the reader believes the command is on their '
    + 'clipboard and the next thing they do is paste into a shell',
  ).toHaveText(FAILED);
  await expect(
    region,
    'THIS is the interruption the ruling reserves for a failure: a polite queue can hold the '
    + 'news until after the reader has pasted the wrong thing',
  ).toHaveAttribute('aria-live', 'assertive');
  await expect(
    state,
    'a write the browser refused must not flip the card to "armed"',
  ).toContainText(UNCOPIED);
  // And the platform's own words stay on screen for the reader who is looking.
  // The announcement says WHAT happened; this says why, and neither replaces
  // the other.
  await expect(page.locator(`${WORK} [data-queue="revision"]`).first())
    .toContainText('permission denied');
});
