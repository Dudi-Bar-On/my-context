/**
 * **The session picker — `#sessbtn` opens `#sesspop`, and the choice reaches
 * the screens.**
 *
 * `plan:walk seq:115`. Both title-bar triggers shipped carrying
 * `aria-haspopup="dialog"` at ids that had no markup anywhere, so two controls
 * did nothing when pressed. `app.js`'s own header recorded the refusal and
 * `e2e/injected-empty.spec.ts` recorded its cost in as many words: *"The app has
 * no session picker … a screen whose whole subject is WHICH session can
 * therefore only ever be seen showing one"*, which is why that file has to MOUNT
 * `screens/injected.js` rather than navigate to it.
 *
 * This file is the other side of that sentence. Test 2 navigates — no mounting,
 * no overridden `ctx.session()` — and drives the shipped shell from a click on
 * the trigger to a table that could not have been drawn for the default
 * session.
 *
 * ── WHY A BROWSER, AND NOT A DOM UNIT TEST ────────────────────────────────
 *
 * Spec §6: the DOM glue (`app.js` and `screens/*.js`) is deliberately untested
 * by the node suite, so a browser is the only place any of this is measurable.
 * And three of the four things this dialog must get right are not observable
 * from markup at all — where focus IS, whether Escape gives it back, and
 * whether `aria-expanded` describes the state the dialog is actually in. A
 * static check reads the authored `aria-expanded="false"` and passes over a
 * trigger that can never expand anything, which is precisely the defect that
 * shipped.
 *
 * ── THE PICKER IS A READ, AND THAT IS ASSERTED ────────────────────────────
 *
 * Test 2 counts every request the page makes while the choice is taken and
 * fails on any method that is not GET. Choosing a session changes which session
 * the screens ASK about and writes nothing — the ruling that says it needs no
 * approval boundary — so a POST appearing here is that ruling being violated,
 * not a detail. (`#focuspop` is the opposite case and gets the opposite
 * treatment: it composes a line and one Execute runs it.)
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/**
 * The long working session `scripts/demo-corpus.ts` drives through the real
 * hooks — sixty injection rows over four tiers, and the one session in the
 * fixture whose `Injected now` table crosses its own bound.
 *
 * It is deliberately NOT the default: `/api/sessions` answers the freshly
 * started session 23 (six rows, one tier), because a long session's injection
 * preview recomputes to a delivery of zero and empties both of the preview's
 * panes. That gap is what makes this a real assertion — "Showing the 50 most
 * recent of 60" is a sentence the default session cannot produce, so a test
 * that sees it has proved the shell moved off the default rather than that a
 * label changed.
 */
const LONG = 'demo-session-a3f9c1-11';

/** Where focus is, and what the trigger claims — the two facts under test. */
async function state(page: Page): Promise<{
  hidden: boolean; expanded: string | null; focusInside: boolean; focusId: string;
}> {
  return page.evaluate(() => ({
    hidden: document.querySelector<HTMLElement>('#sesspop')!.hidden,
    expanded: document.querySelector('#sessbtn')!.getAttribute('aria-expanded'),
    focusInside: document.activeElement?.closest('#sesspop') !== null,
    focusId: (document.activeElement as HTMLElement | null)?.id ?? '(none)',
  }));
}

/* ══ 1 · THE DIALOG ITSELF ═══════════════════════════════════════════════ */

test('the session dialog opens, announces it, takes focus, and gives it back', async ({ app }) => {
  const { page } = app;

  // The authored starting state, read back rather than assumed: a trigger that
  // began life expanded would make every assertion below meaningless.
  expect((await state(page)).hidden, '#sesspop starts hidden').toBe(true);
  expect((await state(page)).expanded, '#sessbtn starts collapsed').toBe('false');

  await page.click('#sessbtn');
  const open = await state(page);
  expect(open.hidden, '#sessbtn must open #sesspop — the whole defect is that it did not').toBe(false);
  expect(open.expanded, '#sessbtn must say it is expanded, or a screen reader is told the '
    + 'opposite of what is on screen').toBe('true');
  // **The assertion that a keyboard user is not stranded.** The dialog follows
  // the header in DOM order, so without this the reader's focus is still on the
  // trigger and reaching the choices is luck of ordering rather than design.
  expect(open.focusInside, 'focus must move into #sesspop').toBe(true);

  // Escape closes it AND hands focus back. The second half is the half a
  // hidden dialog breaks silently: `display:none` on the focused element drops
  // focus to <body>, and the reader loses their place in the page with nothing
  // on screen to say so.
  await page.keyboard.press('Escape');
  const closed = await state(page);
  expect(closed.hidden, 'Escape closes #sesspop').toBe(true);
  expect(closed.expanded, 'and the trigger stops claiming to be expanded').toBe('false');
  expect(closed.focusId, 'Escape must return focus to the control the dialog was opened from')
    .toBe('sessbtn');

  // A click OUTSIDE dismisses too — and deliberately does not move focus,
  // because the click has already put focus where the reader aimed it.
  await page.click('#sessbtn');
  expect((await state(page)).hidden, 'reopened for the outside-click case').toBe(false);
  await page.click('.body');
  const dismissed = await state(page);
  expect(dismissed.hidden, 'a click outside the dialog dismisses it').toBe(true);
  expect(dismissed.expanded, 'and `aria-expanded` follows it down').toBe('false');

  // And the trigger is a toggle: pressing it again closes what it opened,
  // keeping focus on itself.
  await page.click('#sessbtn');
  await page.click('#sessbtn');
  expect((await state(page)).hidden, '#sessbtn toggles its own dialog shut').toBe(true);
});

/* ══ 2 · THE CHOICE REACHES THE SCREENS ══════════════════════════════════ */

test('choosing a session changes what Injected now reads', async ({ app }) => {
  const { page } = app;
  test.setTimeout(120_000);

  await page.evaluate(() => { location.hash = '#/injected'; });
  // `.card.pane`, not the section: `route()` writes a holding chip into the
  // section and only then awaits the module, whose `render()` opens with
  // `replaceChildren()`. The card is the signal the clear has happened.
  // (`e2e/injected-empty.spec.ts` carries the full argument.)
  const section = page.locator('section[data-p="injected"]');
  await section.locator('.card.pane').waitFor({ state: 'attached', timeout: 30_000 });

  // ── The precondition, asserted rather than assumed ──────────────────────
  //
  // The shell landed on the DEFAULT session, and over the default session this
  // table holds nothing back — `boundedList` draws "Showing all N" and no step
  // control at all. If this were already the long session the assertion below
  // would pass without the picker having done anything.
  const before = await page.locator('#sesslbl').textContent();
  expect(before, 'the shell must land on a session before this test moves it').not.toBe('');
  expect(before, `the shell already landed on ${LONG}, so this test cannot show that the picker `
    + 'moved it. The fixture default has changed — see scripts/demo-corpus.ts.').not.toBe(LONG);
  await expect(section.locator('.bound p'),
    'over the default session this table holds nothing back')
    .not.toHaveText(/Showing the 50 most recent/, { timeout: 20_000 });

  // ── The picker must actually offer the session, by NAME where it has one ─
  await page.click('#sessbtn');
  const row = page.locator(`#sesslist .row[data-sid="${LONG}"]`);
  await expect(row, `#sesslist must offer ${LONG}. It is in /api/sessions' window — if this `
    + 'is empty the list is not being painted from loadSessions() at all.')
    .toHaveCount(1, { timeout: 15_000 });
  await expect(row.locator('.m').first(),
    'every row shows the session id, which is the one thing always known about it')
    .toHaveText(LONG);

  // ── The choice — and every request it causes is a READ ──────────────────
  const methods: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) methods.push(request.method());
  });

  await row.click();

  // The dialog closes on the choice and hands focus back: its whole answer is
  // the label the trigger now carries, so there is nothing left to look at.
  const after = await state(page);
  expect(after.hidden, 'choosing a session closes the picker').toBe(true);
  expect(after.focusId, 'and returns focus to the trigger').toBe('sessbtn');
  await expect(page.locator('#sesslbl'),
    'the title bar must name the session the reader chose').toHaveText(LONG);

  // **THE STATE CHANGE, and it is one only the chosen session can produce.**
  // Sixty rows against `BOUND_CAP_TABLE` = 50, on a seen file written entirely
  // by the real hooks. The default session has six.
  await expect(section.locator('.bound p'),
    `Injected now never re-read for ${LONG}. The session listener is what carries the choice `
    + 'into the screens (`ctx.onSessionChange`), so this failing means the change was made '
    + 'and never announced.')
    .toHaveText(/Showing the 50 most recent of \d+\./, { timeout: 30_000 });
  await expect(section.locator('tbody tr'),
    'and the rows are capped at the bound, not merely reported as capped').toHaveCount(50);

  expect(methods.length,
    'the choice caused no request at all, so nothing below measured a re-read').toBeGreaterThan(0);
  expect([...new Set(methods)],
    'THE PICKER IS A READ. It moves which session the screens ask about and writes nothing — '
    + 'that is the ruling that lets it skip the approval boundary every composed command goes '
    + 'behind. A non-GET here is that ruling broken.').toEqual(['GET']);
});

/* ══ 3 · THE NAME, WHERE THERE IS ONE ════════════════════════════════════ */

/**
 * **A name is optional and `mycontext` owns it.**
 *
 * `SessionSummary.name` is what `mycontext session name` gave the session and
 * `core/ledger.ts` states in its own words that it is *"`null` and never a
 * fallback"* — a derived name cannot be told from a real one. So the picker
 * draws the short id always and appends the name only where there is one. The
 * owner's own session is named "my-context V2.0.0 Development" and would be a
 * poor thing to make them find by hex prefix.
 *
 * **Over a fabricated `/api/sessions`, and that is deliberate.** The simulated
 * corpus names none of its sessions — `scripts/demo-corpus.ts` never calls
 * `mycontext session name` — so the named branch is unreachable over the
 * fixture, and asserting it against a corpus that happens to have a name is how
 * a test comes to measure the day rather than the code. The response is the
 * endpoint's own documented shape (`SessionsBody`, `read-model.ts` ~790); only
 * the rows are ours.
 *
 * The reload is the app's own supported path, not a trick: the nonce is
 * one-shot and died on the first load, and `rememberedToken()` restores the
 * token from `sessionStorage` precisely so that a reload — and the language
 * toggle, which reloads by design — keeps working.
 */
test('a named session shows its name beside its id, and an unnamed one shows only the id',
  async ({ app }) => {
    const { page } = app;

    await page.route('**/api/sessions*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ledger: 'present',
        default: 'demo-named-0001',
        sessions: [
          {
            sessionId: 'demo-named-0001',
            lastInjectedAt: new Date(Date.now() - 3_600_000).toISOString(),
            itemCount: 4,
            name: 'my-context V2.0.0 Development',
          },
          {
            sessionId: 'demo-unnamed-0002',
            lastInjectedAt: new Date(Date.now() - 7_200_000).toISOString(),
            itemCount: 2,
            name: null,
          },
        ],
        sessionCount: 2,
      }),
    }));

    await page.reload();
    await expect(page.locator('.nav').first(),
      'the reload never re-authenticated — the token is remembered in sessionStorage for '
      + 'exactly this path').toBeVisible({ timeout: 20_000 });

    await page.click('#sessbtn');
    const named = page.locator('#sesslist .row[data-sid="demo-named-0001"]');
    const bare = page.locator('#sesslist .row[data-sid="demo-unnamed-0002"]');
    await expect(named, 'the picker must draw a row per session').toHaveCount(1, { timeout: 15_000 });
    await expect(bare).toHaveCount(1);

    // The name is in a `<bdi>` and the id in `.m` — a name is corpus text in an
    // unknown direction, an id is a machine value that must read LTR in an RTL
    // page. Asserted by ELEMENT, not by the row's flattened text, because that
    // is the difference the treatment exists to make.
    await expect(named.locator('bdi'),
      'a session that has a name must show it — a picker of opaque ids is a poor answer')
      .toHaveText('my-context V2.0.0 Development');
    await expect(named.locator('.m').first()).toHaveText('demo-named-0001');
    await expect(bare.locator('bdi'),
      'and nothing is invented for a session nobody named: `name` is null and stays null')
      .toHaveCount(0);

    // The default is the selected row on arrival, so the reader can see WHICH
    // session the screens are already reading rather than having to compare the
    // list against the label.
    await expect(named, 'the session the shell is on is the marked row')
      .toHaveAttribute('aria-selected', 'true');
    await expect(bare).toHaveAttribute('aria-selected', 'false');

    // And the cold row is a real choice below the rule — a different question
    // ("what would a brand-new session get"), never another session.
    await expect(page.locator('#sesspop [data-cold]'),
      'the cold session is authored in the markup and is the picker\'s other choice')
      .toHaveCount(1);
  });
