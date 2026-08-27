/**
 * **Capture offers Execute, proven in a browser rather than in the source.**
 *
 * `plan:execute seq:6c`, owner ruling 2026-08-27
 * (`DEC-cap-warn-is-dropped-and-capture-gains-execute-the-other`).
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 *
 * Every other assertion that Capture gained Execute is a SOURCE SCAN.
 * `capture-screen.test.ts` checks that the file contains `id: 'add'`; it cannot
 * check that a button is drawn, because there is no DOM harness on that side.
 * And the parity walk never reaches this screen's composed state — that is the
 * standing `KNOWN_GAPS.capture` entry, whose own note says "a walk that never
 * reaches a state cannot judge it".
 *
 * So without this file, the whole claim rests on a string appearing in a file.
 * That is exactly the shape `button-contrast.spec.ts` records paying for: a
 * gate that measured what it was pointed at, passed, and kept passing when the
 * defect it was written for was reintroduced.
 *
 * ── WHY THE COMPOSED STATE IS A STEP WITH ITS OWN FAILURE ───────────────────
 *
 * Nothing below Capture's inputs renders until a category and a title exist:
 * `capture.js` builds the command block only when `captureArgv` returns an
 * argv, and refuses a half-built capture outright — "an `add` missing its
 * category is not a shorter `add`, it is a different one". So a walk that
 * merely opens `#/capture` sees no command, no Copy and no Execute, and every
 * assertion about them would pass vacuously against an empty screen.
 *
 * Reaching the state is therefore a step that fails as ITSELF, naming what must
 * be true for the subject to exist, rather than a wait that falls through into
 * a measurement of nothing.
 */
import { expect, test } from './app.ts';
import type { Page } from '@playwright/test';

/** Capture's own region, so nothing here can match another screen's furniture. */
const SCREEN = '[data-p="capture"]';

/**
 * Drive Capture into the state where it composes a command.
 *
 * The two controls are addressed by position because `capture.js` gives them
 * neither id nor class, and deliberately: the mockup's own `id="globin"` is not
 * copied since screens stack in the DOM and stay there hidden, so a second
 * element carrying that id would collide with the Composer's.
 */
async function composeACapture(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/capture'; });

  const category = page.locator(`${SCREEN} select`).first();
  await category.waitFor({ state: 'visible', timeout: 15_000 });
  // The first real option: the leading one is the "absent" placeholder, and
  // selecting it would leave the capture half-built and the command refused.
  const chosen = await category.locator('option').nth(1).getAttribute('value');
  expect(chosen, 'the category select offers no real category, so nothing can be composed')
    .toBeTruthy();
  await category.selectOption(chosen as string);

  const title = page.locator(`${SCREEN} input[type="text"]`).first();
  await title.waitFor({ state: 'visible', timeout: 15_000 });
  await title.fill('a capture driven by the browser suite');

  // The command block is the precondition for everything below. If it never
  // appears, the compose step failed and the assertions that follow would be
  // measuring an empty screen — so this waits as its own step and says so.
  await page.locator(`${SCREEN} div.cmd`).first()
    .waitFor({ state: 'visible', timeout: 15_000 });
}

test('Capture composes a command and offers Execute beside Copy', async ({ app }) => {
  const { page } = app;
  await composeACapture(page);

  const labels = await page.locator(`${SCREEN} .cmdactions button`).allInnerTexts();
  expect(labels.length, 'the shared control drew no buttons at all, so the compose step did not take')
    .toBeGreaterThan(0);

  // Both, and by TEXT rather than by class: the control's buttons are
  // deliberately classless — `.cmdactions button` carries their appearance —
  // and `screen-parity` compares element KINDS, so a `button.exec` here would
  // delete the kind `button` from this screen's inventory.
  expect(labels).toContain('Copy');
  expect(labels, 'Capture must offer Execute: seq:6c passed the catalogue id `add`, and without '
    + 'it commandActions appends Copy and returns before Execute is ever constructed')
    .toContain('Execute');
});

test('Capture no longer tells the reader to run it in their own shell', async ({ app }) => {
  const { page } = app;
  await composeACapture(page);

  // The other half of the ruling, and the half a source scan cannot see: the
  // sentence is gone from the RENDERED screen, not merely from the string table.
  const text = await page.locator(SCREEN).innerText();
  expect(text, 'cap.warn — "This is a write. Run it in your own shell." — must not be drawn '
    + 'beside a button that runs it; that contradiction is why this screen waited for a ruling')
    .not.toContain('own shell');

  // And the element it lived in is gone, which is what let `p.cmdnote` leave
  // KNOWN_GAPS.capture rather than stay there as a gap nobody could close.
  await expect(page.locator(`${SCREEN} p.cmdnote`)).toHaveCount(0);
});
