// @basis none - a driver, not a test: it holds no assertion about the product, only the way a person presses Execute and reads what came back. The assertions live in the two specs that import it.
/**
 * **PRESSING EXECUTE THE WAY A PERSON PRESSES IT, AND READING WHAT CAME BACK.**
 *
 * Lifted out of `composer-execute.spec.ts` when a second spec needed the same
 * five functions — `plan:builder seq:11` (D12), whose write half runs every
 * remaining runnable entry in `composer-write-execute.spec.ts`. Every docblock
 * below is the one that was written where the function was first measured; the
 * failures they name were paid for once and are not re-paid by copying the
 * functions into a second file.
 *
 * Nothing here bypasses the confirm or the nonce. `runIt` presses Execute and
 * then clicks `Run it`, because the item's own instruction about the approval
 * boundary is that it *"must not be bypassed to make a test convenient"*.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { UiHarness } from '../test/ui/helpers.ts';
import { CMD, PAL } from './composer.ts';

/** Open the app on a server of our own, authenticated the way a person is. */
export async function openApp(page: Page, h: UiHarness): Promise<void> {
  await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
  await expect(
    page.locator('.nav').first(),
    'the isolated server never rendered a rail button — it probably has no token',
  ).toBeVisible({ timeout: 20_000 });
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
  }
}

/**
 * **THE OUTCOME REGION FOR ONE COMPOSED LINE, and never for the line before it.**
 *
 * `.execresult` cannot be reached with `.first()`, and that is a property of
 * the product rather than a quirk of the selector. `app.js`' own
 * `attachExecuteOutcome` CARRIES the outcome node across the redraw its run
 * caused, and re-homes it onto a control whose `data-cmdkey` matches; when the
 * composed line has moved on there is no match and the outcome goes to the TOP
 * OF THE SECTION instead, deliberately, so a reader is not left hunting for
 * what their click did. So after running `status` and then choosing `doctor`,
 * the palette section holds `status`'s outcome above `doctor`'s form — and a
 * `.first()` reads the wrong run. This test asserted `mycontext status` where
 * it had composed `mycontext doctor` and was right to fail.
 *
 * `data-cmdkey` is `commandActions`' own identity for a control — the composed
 * line — and is stamped on the result region for exactly this. Selecting by it
 * is asking for the outcome of THIS command by the product's own name for it.
 */
export function outcomeFor(page: Page, line: string): Locator {
  // **The BACKSLASH is escaped before the quote, and that order is the whole
  // of it.** A composed line only ever carried plain words until a write case
  // put a quotation mark inside a `--title`; `quoteArg` renders that as `\"`
  // INSIDE the quoted word, so the key holds a backslash, and escaping only the
  // quote left `\\"` in the selector — an unterminated attribute value, which
  // Chrome rejects outright with `is not a valid selector` rather than simply
  // not matching. Escaping `\` first is what makes the second replacement safe.
  const key = line.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return page.locator(`${PAL} .execresult[data-cmdkey="${key}"]`);
}

/** What pressing Execute produced: a confirm to answer, or the reason there is none. */
export interface Pressed {
  /** `open` — the confirm is on screen. `refused` — the control answered instead. */
  state: 'open' | 'refused';
  confirm: Locator;
  /** Everything the result region said, when the confirm did not open. */
  said: string;
}

/**
 * Press Execute and wait for the confirm — or for the reason there is not one.
 *
 * The wait races the confirm against the result region's own error note, so a
 * refused confirm GET fails in the SERVER'S words within seconds instead of
 * timing out in ninety and saying only "hidden".
 *
 * **A refusal is returned rather than thrown**, because for some entries it is
 * the correct result: `src/ui/execute-effect.ts` refuses the confirm outright
 * when the dry run exits non-zero — *"a non-zero exit is a real answer about
 * the command … it means the write did not complete, so there is no effect to
 * show"* — so a command the CLI will refuse can never reach `Run it`, and a
 * test that demanded a confirm for one would be demanding the product be wrong.
 * `openConfirm` is the assertion for callers that need the confirm to open.
 */
export async function pressExecute(page: Page, what: string): Promise<Pressed> {
  const actions = page.locator(`${CMD} .cmdactions`).first();
  await expect(actions, `${what}: a command control is on screen to press`).toHaveCount(1);
  await actions.getByRole('button', { name: 'Execute', exact: true }).click();
  const confirm = actions.locator('.confirm');
  // Polled only while the control is still WORKING; the assertion is made once,
  // afterwards. `expect.poll(...).toBe('open')` keeps polling a settled refusal
  // until the timeout, which is how a confirm refused in one second reported
  // itself as three and a half minutes of nothing.
  let state = 'waiting';
  await expect
    .poll(async () => {
      state = await readState();
      return state === 'waiting' ? 'waiting' : 'settled';
    }, {
      timeout: 180_000,
      intervals: [200, 500, 1000, 2000],
      message: `${what}: the confirm neither opened nor said why. The confirm GET derives the `
        + 'effect by copying the corpus to a scratch directory and running the command there '
        + '(`src/ui/execute-effect.ts`), which costs real seconds.',
    })
    .toBe('settled');
  if (state === 'open') return { state: 'open', confirm, said: '' };
  return { state: 'refused', confirm, said: state };

  async function readState(): Promise<string> {
    if (await confirm.isVisible().catch(() => false)) return 'open';
    // **Everything the control is saying, not just the shape this test hoped
    // for.** The first version of this wait watched only `.spill`, and when
    // the confirm did not open it reported "hidden" and nothing else — three
    // tests spent 3.5 minutes each arriving at a message that named no cause.
    // The result region is a live region the product fills with the reason,
    // so the reason is what the failure should carry.
    const said = (await actions.locator('.execresult').textContent().catch(() => '')) ?? '';
    // `exec.checking` is the pending sentence the control draws while the
    // derivation runs, so it is a WAIT and not an answer. Anything else in
    // this region is the reason there will be no confirm.
    if (said.trim() === '' || /Checking|בודק|נבדק/.test(said)) return 'waiting';
    return said.trim();
  }
}

/** `pressExecute`, and the confirm MUST have opened. */
export async function openConfirm(page: Page, what: string): Promise<Locator> {
  const pressed = await pressExecute(page, what);
  expect(
    pressed.state === 'open' ? 'open' : `the control says: ${pressed.said.slice(0, 500)}`,
    `${what}: the confirm must open`,
  ).toBe('open');
  return pressed.confirm;
}

/** Press Execute, answer the confirm, and settle. THE NONCE PATH, NOT BYPASSED. */
export async function runIt(page: Page, line: string, what: string): Promise<void> {
  // **The confirm is NOT bypassed**, which is the item's own instruction about
  // the approval boundary: "Entries that sit on the approval boundary exercise
  // the confirm-and-nonce path, which must not be bypassed to make a test
  // convenient." The nonce is minted by the GET that renders this, and spending
  // it is the only way to reach the run.
  const confirm = await openConfirm(page, what);
  await confirm.getByRole('button', { name: 'Run it', exact: true }).click();
  await expect(outcomeFor(page, line).locator('.exitcode'), `${what}: an outcome arrives`)
    .toBeVisible({ timeout: 180_000 });
}

/**
 * What the outcome region says: the exit code it drew, and what the command
 * printed — ALL of what it printed, which takes a click.
 *
 * **The output is BOUNDED, and that is a feature rather than truncation.**
 * `saidNodes` hands the command's lines to `boundedList` with `BOUND_CAP_LIST`,
 * so a long answer is drawn as an opening window under a "Show all N" control.
 * Comparing the drawn window to the CLI's whole stdout reports a difference
 * that is not one: `mycontext show <id>` lost its entire body and every
 * observation, sixteen lines, and looked like the UI dropping output.
 *
 * So this presses the control, which is what a reader does and which also makes
 * the affordance itself part of what is under test — a "Show all" that did not
 * show all would fail the comparison below rather than passing quietly.
 */
export async function outcome(
  page: Page, line: string,
): Promise<{ code: number; out: string; ran: string }> {
  const region = outcomeFor(page, line);
  const codeText = (await region.locator('.exitcode').first().textContent()) ?? '';
  const code = Number(/(-?\d+)/.exec(codeText)?.[1] ?? 'NaN');
  const showAll = region.getByRole('button', { name: /^Show all |^הצג את כל / });
  if (await showAll.count() > 0 && await showAll.first().isVisible().catch(() => false)) {
    await showAll.first().click();
  }
  const said = region.locator('pre.lit');
  const out = await said.count() > 0 ? ((await said.first().textContent()) ?? '') : '';
  const ran = (await region.locator('.cmd code').first().textContent()) ?? '';
  return { code, out, ran };
}

/**
 * **WAIT FOR THE SCREEN TO STOP MOVING AFTER A RUN — because it does move, and
 * further than a reader would expect.**
 *
 * Measured 2026-09-07 with a probe that ran ONE `mycontext edit` from the
 * Composer and then read the entry picker: `select=ack`. The whole screen is
 * re-rendered by the live refresh the write triggers, `render()` builds a fresh
 * `<select>`, and a fresh `<select>` opens on its first option — which is
 * `PALETTE[0]`, `ack`. So the def the reader chose, every field they filled and
 * the glob pattern they typed are gone the moment their command succeeds. That
 * is reported as a finding; it is not this file's to fix.
 *
 * What it costs a TEST is that the redraw lands at an unpredictable moment
 * AFTER the outcome appears, so a `chooseEntry` that has already returned can
 * be clobbered by it. Measured twice, as two unrelated-looking failures: a
 * `check()` that resolved to `unpin`'s `--yes` box and then, mid-retry, to
 * `ack`'s `finding` box ("Not a checkbox or radio button"), and an outcome
 * region read as empty because it was read while it was being re-homed.
 *
 * So this waits for two consecutive identical samples of the two things the
 * redraw changes — the picker's value and the form's field count. It is written
 * over what the screen SHOWS rather than over "the picker says ack", so it will
 * keep working, unchanged, on the day the reset is fixed.
 */
export async function settleScreen(page: Page): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const now = await page.evaluate((pal) => {
        const root = document.querySelector(pal);
        const select = root?.querySelector('select');
        const form = root?.querySelector('.card.pane > div:nth-of-type(1)');
        return `${select === null || select === undefined ? '?' : select.value}`
          + `/${form === null || form === undefined ? -1 : form.querySelectorAll(':scope > label.small').length}`;
      }, PAL);
      const verdict = now === previous ? 'settled' : 'moving';
      previous = now;
      return verdict;
    }, { timeout: 60_000, intervals: [300, 300, 400, 500, 700] })
    .toBe('settled');
}

/**
 * Two texts compared as a person compares two terminal outputs: trailing
 * whitespace and blank-line runs do not carry meaning, and the UI renders
 * stdout into a `<pre>` through `textContent`.
 */
export function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}
