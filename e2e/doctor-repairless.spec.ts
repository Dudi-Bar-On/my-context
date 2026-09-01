/**
 * **A Doctor whose every finding is repaired by a person must SAY so — in the
 * rows and in a count — instead of falling silent.**
 *
 * ── WHAT WENT WRONG, AND WHY IT WAS INVISIBLE ──────────────────────────────
 *
 * Owner, 2026-08-28, opening this screen: *"doctor lost it's execute an fix
 * controls ? why yo broke it ?"*
 *
 * **Nothing was broken, and that is the whole defect.** The screen draws a
 * repair control only for the four codes whose own message names a runnable
 * command; `lib/viewmodel.js`'s `repairCommandFor` is the entire list and `null`
 * is its ORDINARY answer, because most findings are repaired by editing a file.
 * That day cleared nine `source_file` links — retiring every `source_drift`,
 * the code that had been supplying most of the controls — and `plan:categories
 * seq:21` added `blocked_without_needs`, whose remedy is a person naming a
 * blocker and which is correctly not automatable. The corpus got healthier and
 * the toolbar went quiet.
 *
 * **Quiet is what broken looks like.** The reader's only evidence was an
 * absence, and an absence cannot distinguish "this corpus needs no command"
 * from "this build lost its commands". The reaction was the cost of the
 * silence, not a misreading of it.
 *
 * ── WHY A BROWSER, AND WHY A SERVED ANSWER ─────────────────────────────────
 *
 * `test/ui/doctor-screen.test.ts` holds the DECISION — which codes earn a
 * repair, that the tally and the row disclosure read one function, that the
 * chip is the strip's own primitive. What it cannot hold is the thing the owner
 * saw: a rendered screen with no control on it. Spec §6 keeps DOM glue out of
 * the node suite, so the rendering is only ever checked here, and the state
 * under test is precisely a rendering.
 *
 * **The findings are SERVED, not staged in the corpus.** `.demo-corpus` is
 * shared by every spec in this suite and is driven by them; editing items into
 * it to produce `blocked_without_needs` and `nested_corpus` would rewrite
 * bodies underneath the others, and `execute.spec.ts` already refuses to run
 * this screen's repair for that exact reason. `/api/doctor` serves `runChecks`
 * verbatim — `{ findings: Finding[] }`, unfiltered and unreshaped — so
 * fulfilling that route is the endpoint's own body shape and what is under test
 * is the DRAWING of it. `chart-scale.spec.ts` serves `/api/graph` the same way
 * and for the same reason.
 *
 * The two codes are the owner's own, and their messages are the REAL sentences
 * `src/doctor/checks.ts` composes for them — abbreviated, not invented, so a
 * reworded check leaves this spec asserting about a message that still exists.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** `Finding` as `/api/doctor` serves it: `{ level, code, message, item? }`. */
interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
}

/**
 * **The corpus of 2026-08-28, code for code**: two findings, both real, neither
 * repairable. `blocked_without_needs` is answered by a person naming a blocker;
 * `nested_corpus` is answered by starting sessions somewhere else. Neither has
 * a command for the screen to compose, and that is correct.
 */
const ALL_UNREPAIRABLE: Finding[] = [
  {
    level: 'warn',
    code: 'blocked_without_needs',
    item: 'TASK-the-shared-write-preview-block-was-never-built',
    message: 'is at state "blocked" and names nothing in "needs", so it is a blocker with no '
      + 'target: nothing can say what would free it, and nothing will notice when that thing '
      + 'lands.',
  },
  {
    level: 'info',
    code: 'nested_corpus',
    message: 'a second corpus is nested at "sub/project". `findProjectRoot` stops at the FIRST '
      + '`.my_context` above the working directory, so any session started at or below that '
      + 'path gets THAT corpus instead of this one — a different board, silently.',
  },
];

/** The same two, plus one finding that DOES compose a line. The control case. */
const ONE_REPAIRABLE: Finding[] = [
  ...ALL_UNREPAIRABLE,
  {
    level: 'error',
    code: 'index_stale',
    message: 'the index is older than the items it indexes. Run `mycontext rebuild`.',
  },
];

async function openDoctor(page: Page, findings: Finding[]): Promise<void> {
  await page.route('**/api/doctor*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ findings }),
  }));
  await page.evaluate(() => { location.hash = '#/doctor'; });
  // The three cards are built AFTER the endpoint answers, so their appearance
  // is the signal that this served body is what is on screen — never a timeout.
  await page.locator('[data-p="doctor"] .card.pane').first().waitFor({ timeout: 20_000 });
}

const screen = '[data-p="doctor"]';

test('every finding unrepairable: each row says so, and the screen counts them', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, ALL_UNREPAIRABLE);

  // **The state under test, asserted as a state rather than assumed.** Without
  // this the two assertions below would pass against a screen that simply drew
  // nothing at all — which is the bug, not the fix.
  await expect(
    page.locator(`${screen} div.cmd`),
    'this corpus composes no command, so there must be no command block to find',
  ).toHaveCount(0);
  await expect(page.locator(`${screen} .cmdactions`)).toHaveCount(0);

  // ── The row says what it HAS. ──
  const chips = page.locator(`${screen} span.chip.unmeas`);
  await expect(
    chips,
    'a finding with no automated repair drew nothing at all — which is the silence the owner '
    + 'read as a regression. Every one of these two rows must name its own state.',
  ).toHaveCount(ALL_UNREPAIRABLE.length);
  await expect(chips.first()).toHaveText('no automated repair');

  // And it says WHY, in the title — the same split the strip's three named
  // states use: two words on screen, the sentence in the attribute.
  const why = await chips.first().getAttribute('title');
  expect(why, 'the chip names a state and never explains it').toBeTruthy();
  // Case-insensitive, and it is the SENTENCE that is pinned rather than its casing:
  // `title.noRepair` was shortened on 2026-09-01 under
  // STD-a-screen-line-says-the-fact-in-plain-words and now OPENS with the clause
  // ("Repaired by a person, not a command: …"), which a case-sensitive substring
  // read as the fact having been dropped. What must not change is that the
  // explanation names a PERSON as the repair.
  expect(why, 'the explanation must say that a person is the repair, not that one is missing')
    .toMatch(/repaired by a person/i);

  // ── The screen states how many findings carry a repair. ──
  const tally = page.locator(`${screen} > p.small`).first();
  await expect(tally).toBeVisible();
  const text = await tally.innerText();
  expect(text, 'the count of findings is not stated').toContain('2');
  expect(text, 'a zero repairs must be DRAWN AND NAMED — that is the entire difference between '
    + 'a healthy corpus and a screen that lost its controls').toMatch(/automated repair:\s*0/);
});

test('a repairable finding keeps its control and does not draw the chip', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, ONE_REPAIRABLE);

  // The control is still composed where a command exists — a disclosure that
  // suppressed the controls would "fix" the report by causing it.
  const cmd = page.locator(`${screen} div.cmd code`);
  await expect(cmd).toHaveCount(1);
  await expect(cmd.first()).toHaveText('mycontext rebuild');

  // Two chips, not three: the repairable row draws none.
  await expect(
    page.locator(`${screen} span.chip.unmeas`),
    'the chip is drawn per ROW and only where the row has no repair; a chip beside a command '
    + 'says nothing',
  ).toHaveCount(2);

  // The row that owns the command carries no chip of its own.
  const stale = page.locator(`${screen} tr`, { hasText: 'index_stale' }).first();
  await expect(stale.locator('span.chip.unmeas')).toHaveCount(0);

  await expect(page.locator(`${screen} > p.small`).first())
    .toContainText(/automated repair:\s*1/);
});

/**
 * **Both halves of the disclosure survive the language toggle**, because a
 * reader who cannot read English is exactly the reader an unexplained blank
 * strands. `#lang` is the shell's own control; the assertion is that the two
 * elements are still there and still say something in the other table, never
 * that a particular Hebrew sentence is on screen — translation freshness is a
 * review obligation, not a tested one (`test/ui/strings-parity.test.ts`).
 *
 * `#lang` writes the preference and RELOADS, and the reload lands on the
 * default screen because the nonce fragment died on the first load. So the
 * route is re-armed and the screen re-opened rather than assumed to survive —
 * a spec that asserted against whatever the reload happened to draw would be
 * measuring the landing screen.
 */
test('the disclosure and the tally exist in Hebrew too', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, ALL_UNREPAIRABLE);
  await page.click('#lang');
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await openDoctor(page, ALL_UNREPAIRABLE);

  const chips = page.locator(`${screen} span.chip.unmeas`);
  await expect(chips).toHaveCount(ALL_UNREPAIRABLE.length);
  const said = await chips.first().innerText();
  expect(said.trim().length, 'the chip renders empty in Hebrew').toBeGreaterThan(0);
  expect(said, 'the Hebrew UI still shows the English state — the key is not in he.js')
    .not.toContain('no automated repair');
  const title = await chips.first().getAttribute('title');
  expect(title, 'the reason is untranslated in Hebrew').not.toContain('repaired by a person');

  const tally = await page.locator(`${screen} > p.small`).first().innerText();
  expect(tally, 'the tally must still carry both numbers in the other table').toContain('2');
  expect(tally).toContain('0');
});
