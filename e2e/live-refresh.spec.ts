/**
 * `plan:live seq:3` — `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks`:
 * *"a refresh that can keep the reader's place happens; one that cannot
 * ASKS."* `seq:2` built the declaration (`SCREEN_INVALIDATION`) and left it
 * inert on purpose; this is the task that makes it act, and this file is the
 * proof — a browser driving the real page, not a re-implementation of the
 * rule in Node.
 *
 * THE ACCEPTANCE CONDITION, quoted from the task and reproduced here as the
 * first test's own assertion sequence: *"with an item pane open and the page
 * scrolled, a mutation arrives; the pane stays open on the same item and the
 * scroll offset does not move."* `preview` is the screen this measures it
 * against — the landing screen, guaranteed a `button.linkid` against
 * `.demo-corpus` (`e2e/item-pane.spec.ts`'s own note: several screens render
 * NONE against this fixture) — and it declares `refresh: 'ask'`
 * (`live-invalidation.js`: an open gate-pick selection a silent rebuild would
 * discard), so the test also measures the affordance itself: it is HIDDEN
 * until something arrives, shown once, and hidden again once taken — never a
 * permanent banner.
 *
 * The second test is `REQ-configure-and-the-simulator-agree-on-the-budgets
 * -whatever`, verified the way the requirement itself is written: two TABS
 * open on the SAME server, one performing a REAL budget write through
 * Configure's own UI (not a synthetic audit record — the requirement is
 * about a write reaching the OTHER screen, and only a real write proves
 * that), the other sitting on Simulate, untouched, the whole time. `second
 * tab on the same origin is not locked out` (`e2e/app-refresh.spec.ts`) is
 * the technique this reuses: a bare-origin navigation on the same browser
 * context authenticates off the cookie the first tab's nonce exchange left
 * behind.
 */
import { test, expect, CORPUS } from './app.ts';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { recordAudit } from '../src/core/audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

// `CORPUS` (from `./app.ts`) is the WORKSPACE — the directory `mycontext ui`
// is pointed at, and the value `startUiChild()` takes — not the `.my_context`
// directory `recordAudit`'s own `root` parameter expects
// (`auditLogPath(root)` joins `root` straight to `.audit/audit.jsonl`, and
// `e2e/live-stream.spec.ts`'s own fixture passes `path.join(dir, DIR_NAME)`
// for exactly this reason). Passing `CORPUS` itself here silently wrote a
// STRAY `.demo-corpus/.audit/audit.jsonl` the running server's tail never
// watches — `written: true`, and no record the stream would ever see. Caught
// by the acceptance test itself going consistently red on `#screenstale`
// (and, once, passing the earlier assertions by accident on old debounced
// timing before this was found) — see this task's report.
const MY_CONTEXT = path.join(CORPUS, DIR_NAME);

/** The first id button on the injection preview — `item-pane.spec.ts`'s own helper. */
async function firstLink(page: Page) {
  const link = page.locator('button.linkid').first();
  await expect(link, 'no button.linkid rendered — this test cannot measure what it is for')
    .toBeVisible({ timeout: 15_000 });
  return link;
}

test('a mutation while an item pane is open and the page is scrolled: the pane stays, the scroll stays', async ({ app }) => {
  const { page } = app;

  // Preconditions the acceptance condition names, established in order.
  const link = await firstLink(page);
  const clickedId = (await link.textContent() ?? '').trim();
  await link.click();
  await expect(page.locator('#pane'), 'the pane did not open').toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#paneid')).toHaveText(clickedId);

  // `.body`/`#screen` is the scroll container — `.body{overflow-y:auto}`, not
  // the window (styles.css / mockup, byte-identical). Set directly rather
  // than scrolled by gesture: what this test measures is whether the VALUE
  // moves on its own, not whether a wheel event can reach it.
  const scrolled = await page.evaluate(() => {
    const body = document.getElementById('screen');
    if (body === null) return -1;
    body.scrollTop = 300;
    return body.scrollTop;
  });
  expect(scrolled, 'the preview screen against .demo-corpus is not tall enough to scroll — '
    + 'this test cannot measure a scroll offset that never left zero').toBeGreaterThan(0);

  // Not a permanent banner: hidden before anything has arrived.
  await expect(page.locator('#screenstale'), 'the affordance is visible with nothing pending')
    .toBeHidden();

  // The mutation. A real record, appended the way `e2e/live-stream.spec.ts`
  // does it — through the shared stream's own tail, not a page-side fake.
  recordAudit(MY_CONTEXT, {
    kind: 'mutation', op: 'update', origin: 'human',
    itemId: 'RULE-live-refresh-acceptance-synthetic', fields: ['body'],
  });

  // `preview` declares `refresh: 'ask'`: the affordance appears; NOTHING else
  // is expected to move yet — pressing it is what performs the refresh.
  await expect(
    page.locator('#screenstale'),
    'a mutation preview declared itself invalidated by never surfaced the affordance — '
    + 'the wiring from live-invalidation.js to the screen never fired',
  ).toBeVisible({ timeout: 5_000 });

  // THE ACCEPTANCE CONDITION, first half: while the affordance waits to be
  // pressed, the pane and the scroll are exactly as they were.
  await expect(page.locator('#pane')).toBeVisible();
  await expect(page.locator('#paneid')).toHaveText(clickedId);
  expect(await page.evaluate(() => document.getElementById('screen')?.scrollTop ?? -1))
    .toBe(scrolled);

  // Take it. This is what calls the screen's own render() again, in place.
  await page.locator('#screenstale button').click();

  // Taken, not standing: the affordance hides itself once acted on.
  await expect(page.locator('#screenstale'), 'the affordance stayed up after being pressed — '
    + 'a page that always shows it is a page with a notification nobody reads')
    .toBeHidden({ timeout: 5_000 });

  // THE ACCEPTANCE CONDITION, second half: AFTER the real rebuild — preview's
  // whole `<section>` was just torn down and redrawn — the pane and the
  // scroll are still exactly as they were. This is the property the decision
  // is actually about; the first half only proved the wiring reaches the
  // screen at all.
  await expect(page.locator('#pane'), 'the pane closed when the screen refreshed — '
    + 'refresh must call the screen\'s own render(), never route(), which closePane()s first')
    .toBeVisible();
  await expect(page.locator('#paneid')).toHaveText(clickedId);
  // `expect.poll`, not a single synchronous read: `#screenstale` hides the
  // INSTANT the control is pressed (`act()`'s own first line), well before
  // `render()` — a real fetch — has resolved, and `render()` clears `section`
  // before it repopulates it. A bare read here would legitimately catch the
  // MIDDLE of the rebuild, scrollTop already clamped toward zero by the
  // momentarily-empty section and not yet restored — a false failure this
  // test itself would be responsible for, not the product. Polling is what
  // waits for the FINAL state the acceptance condition actually names.
  await expect.poll(
    () => page.evaluate(() => document.getElementById('screen')?.scrollTop ?? -1),
    { message: 'the scroll offset did not settle back to where it was', timeout: 5_000 },
  ).toBe(scrolled);
});

test('REQ-configure-and-the-simulator-agree-on-the-budgets-whatever: a budget write on Configure reaches Simulate, open in another tab', async ({ app }) => {
  const { page: configPage } = app;

  await configPage.evaluate(() => { location.hash = '#/config'; });
  await expect(configPage.locator('[data-p="config"]')).toBeVisible({ timeout: 15_000 });
  const jitInput = configPage.locator('input[aria-label="budgets.jit"]');
  await expect(jitInput, 'the jit budget input never rendered').toBeVisible({ timeout: 10_000 });
  const before = Number(await jitInput.inputValue());
  // A value that cannot collide with whatever this corpus already holds —
  // computed from what is actually on screen rather than a fixed literal, so
  // a second run against the same (gitignored, persistent) demo corpus still
  // produces a real, detectable change.
  const after = before + 111;

  // The SECOND tab — Simulate, opened and left alone. `page.context()
  // .newPage()` on the same origin authenticates off the cookie the first
  // tab's nonce exchange already set (`app-refresh.spec.ts`'s own proof that
  // this works); no second nonce is spent.
  const simPage = await configPage.context().newPage();
  try {
    await simPage.goto(`http://127.0.0.1:${app.port}/`);
    await expect(simPage.locator('.nav').first(), 'the second tab never authenticated')
      .toBeVisible({ timeout: 15_000 });
    await simPage.evaluate(() => { location.hash = '#/simulate'; });
    await expect(simPage.locator('[data-p="simulate"]')).toBeVisible({ timeout: 15_000 });
    // `jit` is TIERS[1] — `#simtbl tr:nth-child(2)`, budget in the second cell.
    const simJitBudget = simPage.locator('#simtbl tr:nth-child(2) td:nth-child(2)');
    await expect(simJitBudget).toHaveText(before.toLocaleString('en-US'));
    await expect(simPage.locator('#screenstale'), 'the affordance is visible before any write happened')
      .toBeHidden();

    // The write, through Configure's own UI — a REAL `POST /api/execute`,
    // audited as `kind: 'mutation'` by the code this task did not write and
    // is not re-testing; what this test measures is only whether the record
    // it produces REACHES the other tab.
    await jitInput.fill(String(after));
    await configPage.getByRole('button', { name: 'Write budgets' }).click();
    await expect(configPage.locator('.confirm')).toBeVisible({ timeout: 10_000 });
    await configPage.locator('.confirm button.go').click();
    await expect(configPage.locator('.execresult')).toBeVisible({ timeout: 10_000 });

    // Simulate declares `refresh: 'ask'` too (a live slider mid-drag is
    // exactly the state a silent rebuild must not discard) — so the write
    // surfaces as the SAME affordance, on a screen that never navigated and
    // never itself performed the write.
    await expect(
      simPage.locator('#screenstale'),
      'Configure wrote a budget and Simulate — open the whole time — never learned: '
      + 'the two screens can silently disagree again, which is the requirement this task meets',
    ).toBeVisible({ timeout: 5_000 });

    // Take it, and the simulator now shows what Configure just wrote —
    // "whatever moved them", proven end to end rather than asserted.
    await simPage.locator('#screenstale button').click();
    await expect(simJitBudget, 'Simulate refreshed but still shows the OLD budget — '
      + 'the two screens agree that something changed but not on what')
      .toHaveText(after.toLocaleString('en-US'), { timeout: 5_000 });
  } finally {
    await simPage.close();
  }
});
