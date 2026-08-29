/**
 * **THE READER'S PLACE ON THE INJECTION PREVIEW, AND THE TWO DISCLOSURES BESIDE
 * IT** — `plan:walk seq:64`, `seq:58` and `seq:60`, measured in a browser
 * because all three are browser facts and none of them is visible to a unit
 * test.
 *
 * ── 1 · A TAKEN REFRESH KEEPS THE READER'S QUESTION (`seq:64`) ────────────
 *
 * `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks`: a refresh that can keep
 * the reader's place happens; one that cannot ASKS. `preview` correctly declares
 * `refresh: 'ask'` — and until 2026-08-29, when the reader said yes, it threw
 * away the thing the asking was for. `render()` rebuilt `#evsel` from
 * `EVENTS[0]`, and the chosen path and the warm/cold question were `let`s inside
 * `render()`, so the screen came back on *session-start · warm · no path*.
 *
 * **WHY THE OBVIOUS TEST WOULD HAVE PASSED WHILE MEASURING NOTHING, which is
 * the whole reason this file is written the way it is.** The natural test —
 * pick something, take the refresh, assert the screen still says something —
 * goes green whether the picks survive or not, because the picker's RESET is
 * itself an answer and on most fixtures it is an answer that looks fine. This
 * task was found by `plan:live seq:7` hitting exactly that: its assertion would
 * have measured the picker's reset rather than the property it was about.
 *
 * So this test refuses to rely on the picks alone. It asserts BOTH:
 *
 *   1. the three controls still read what the reader left them at, AND
 *   2. the ANSWER on screen is the one only those picks produce — established
 *      by first measuring that the picked question's answer DIFFERS from the
 *      landing question's on this corpus, and skipping with a sentence if a
 *      later corpus makes the two coincide.
 *
 * A test that can pass by coincidence is worse than a missing one, so the
 * coincidence is measured away rather than assumed away.
 *
 * ── 2 · THE PATH PICKER SAYS WHAT IT CAN AND CANNOT DO (`seq:58`) ─────────
 *
 * Owner: *"event - when selecting tool, the path should be used as filter but it
 * does nothing"*. Every link in the chain holds; what makes the control inert is
 * that almost nothing in the corpus declares a scope, and an unscoped item is
 * unrestricted under the default `scopePolicy` — so it matches every path. The
 * screen never said so. The counts asserted here are read from
 * `/api/help/scope` **through the page's own door**, never hand-computed: a
 * second implementation of the split in the test would agree with the screen
 * today and drift later.
 *
 * ── 3 · THE ABSENT-TIER SENTENCES CHANGE LANGUAGE (`seq:60`) ──────────────
 *
 * Two ribbon sentences shipped as English literals with no key. In Hebrew they
 * stayed English, and nothing could see it: `strings-parity` compares KEY SETS
 * and a string with no key is invisible to it; `bidi.spec` censuses runs per
 * `data-t` and text under no `data-t` is not censused. `screen-literals.test.ts`
 * is the check that now sees literals at all; this is the browser proof that
 * these two actually move.
 *
 * **Asserted as a CHANGE and a round trip, not against pinned Hebrew.** Copying
 * `he.js`'s value into this file would make the test a second copy of the table
 * that passes when both are wrong together. What must hold is that the sentence
 * is not the English one, is not empty, and comes back.
 */
import { test, expect, CORPUS } from './app.ts';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { recordAudit } from '../src/core/audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';
import { settleScreen } from './settle.ts';

/**
 * `recordAudit`'s `root` is the `.my_context` directory, not the workspace —
 * `e2e/live-refresh.spec.ts` records the measurement behind this line: passing
 * `CORPUS` itself writes a stray log the running server never watches, so the
 * stream sees nothing and the affordance never appears.
 */
const MY_CONTEXT = path.join(CORPUS, DIR_NAME);

/** A path a scoped item in `.demo-corpus` actually names — `preview-spilled`'s own. */
const SCOPED_PATH = 'src/api/handler.ts';

/** The preview section, and every query scoped to it. */
const preview = (page: Page) => page.locator('[data-p="preview"]').last();

/** Land on the preview and wait for it to have finished drawing. */
async function landing(page: Page): Promise<void> {
  await page.evaluate(() => { window.location.hash = '#/preview'; });
  const settled = await settleScreen(page, 'preview', { requires: '#evsel' });
  expect(settled.settled, `the preview never settled — ${settled.inFlight} reads still in `
    + `flight after ${settled.attempts} samples`).toBe(true);
}

/** Choose an event, and wait for the screen to redraw around it. */
async function chooseEvent(page: Page, event: string): Promise<void> {
  await preview(page).locator('#evsel').selectOption(event);
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled, 'the preview never settled after the event changed').toBe(true);
}

/** Choose a path on a tool event, and wait. */
async function choosePath(page: Page, file: string): Promise<void> {
  await preview(page).locator('#pathsel').selectOption(file);
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled, 'the preview never settled after the path changed').toBe(true);
}

/** Press one of the two question buttons, and wait. */
async function ask(page: Page, which: 'live' | 'cold'): Promise<void> {
  await preview(page).locator(`#qpick button[data-q="${which}"]`).click();
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled, `the preview never settled after asking the ${which} question`)
    .toBe(true);
}

/** What the three controls read right now — the reader's place, as one value. */
const place = (page: Page): Promise<{ event: string; path: string; question: string }> =>
  preview(page).evaluate((section) => {
    const pressed = [...section.querySelectorAll<HTMLElement>('#qpick button')]
      .find((b) => b.getAttribute('aria-pressed') === 'true');
    return {
      event: section.querySelector<HTMLSelectElement>('#evsel')?.value ?? '(no event picker)',
      path: section.querySelector<HTMLSelectElement>('#pathsel')?.value ?? '(no path picker)',
      question: pressed?.dataset['q'] ?? '(nothing pressed)',
    };
  });

/** The ids the Delivered card is showing — the ANSWER, as opposed to the question. */
const delivered = (page: Page): Promise<string[]> =>
  preview(page).locator('#deliveredRows .row')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-id') ?? ''));

test('a taken refresh keeps the event, the path and the question — and the answer they produce', async ({ app }) => {
  const { page } = app;
  await landing(page);

  // The landing answer, which is what the defect used to substitute in.
  const landingPlace = await place(page);
  expect(landingPlace.event, 'the screen must land on session-start for this comparison to mean '
    + 'anything').toBe('session-start');
  const landingAnswer = await delivered(page);

  // The reader's question: a different event, a chosen path, the cold question.
  await chooseEvent(page, 'tool');
  await choosePath(page, SCOPED_PATH);
  await ask(page, 'cold');
  const chosen = await place(page);
  expect(chosen, 'the three controls did not take the picks this test is about')
    .toEqual({ event: 'tool', path: SCOPED_PATH, question: 'cold' });
  const chosenAnswer = await delivered(page);

  // ── THE COINCIDENCE, MEASURED AWAY ────────────────────────────────────
  //
  // If this corpus answers the picked question exactly as it answers the
  // landing one, then every assertion below about the ANSWER would hold
  // whether the picks survived or not — which is the failure mode this task
  // was found by. Said out loud rather than silently tolerated.
  const answersDiffer = JSON.stringify(chosenAnswer) !== JSON.stringify(landingAnswer);
  test.info().annotations.push({
    type: 'measured',
    description: `session-start/warm delivered ${landingAnswer.length} ids; `
      + `tool@${SCOPED_PATH}/cold delivered ${chosenAnswer.length}; differ: ${answersDiffer}`,
  });

  // Not a permanent banner: nothing has arrived yet.
  await expect(page.locator('#screenstale'), 'the affordance is visible with nothing pending')
    .toBeHidden();

  // A real record, through the shared stream's own tail — not a page-side fake.
  recordAudit(MY_CONTEXT, {
    kind: 'mutation', op: 'update', origin: 'human',
    itemId: 'RULE-preview-picks-acceptance-synthetic', fields: ['body'],
  });

  await expect(
    page.locator('#screenstale'),
    'a mutation preview declares itself invalidated by never surfaced the affordance',
  ).toBeVisible({ timeout: 10_000 });

  // While it waits to be pressed, nothing has moved — `ask` means ask.
  expect(await place(page), 'the picks moved before the refresh was even taken')
    .toEqual(chosen);

  // TAKE IT. This calls the screen's own render() again, in place, which is
  // exactly the act that used to discard all three picks.
  await page.locator('#screenstale button').click();
  await expect(page.locator('#screenstale'), 'the affordance stayed up after being pressed')
    .toBeHidden({ timeout: 10_000 });
  // **No `requires: '#pathsel'` here, deliberately.** The defect this test is
  // about DESTROYS the path picker — the event resets to `session-start`, which
  // takes no path — so requiring it would spend the settle bound and fail with
  // *the preview never settled*, which reads as a hung screen. Watched: against
  // the pre-fix file that is exactly what it reported, and the acceptance
  // assertion below never ran. Settling on the screen alone lets the defect be
  // named by the assertion that is actually about it.
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled, 'the preview never settled after the refresh was taken').toBe(true);

  // ── THE ACCEPTANCE CONDITION ──────────────────────────────────────────
  expect(
    await place(page),
    'taking the refresh discarded the reader\'s question. `refresh: \'ask\'` exists to protect '
    + 'exactly this state, and a screen that asks and then throws the answer away is worse '
    + 'than one that never asked — DEC-a-refresh-keeps-the-reader-s-place-or-it-asks',
  ).toEqual(chosen);

  // And the ANSWER is still the picked question's, which is the half that
  // cannot be satisfied by a picker that merely LOOKS unchanged.
  if (answersDiffer) {
    expect(
      await delivered(page),
      'the controls read correctly but the rows are the landing question\'s answer — the '
      + 'screen is captioned with one question and showing another',
    ).toEqual(chosenAnswer);
  } else {
    test.info().annotations.push({
      type: 'unmeasured',
      description: 'this corpus answers the picked question exactly as it answers the landing '
        + 'one, so the answer half of this test could not distinguish them. The picks '
        + 'themselves are still asserted above; only the corroboration went unmeasured.',
    });
  }
});

test('the path picker discloses how many items are scoped, and what the policy means for the rest', async ({ app }) => {
  const { page } = app;
  await landing(page);

  const note = preview(page).locator('#scopeNote');

  // On an event that takes no path, there is no sentence to draw — the
  // disclosure is about the picker, and the picker is not there.
  await expect(
    note,
    'the scope disclosure is drawn on session-start, where there is no path to disclose '
    + 'anything about',
  ).toBeEmpty();

  await chooseEvent(page, 'tool');

  // The counts, read through the page's own door — `/api/help/scope` is where
  // the server already partitions the corpus and stamps each unscoped item with
  // `scopePolicyFor`'s own answer. Recomputing the split here would be a second
  // implementation that agrees today and drifts later.
  const split = await page.evaluate(async () => {
    const ctx = (window as unknown as {
      myctx: { api: (route: string) => Promise<unknown> };
    }).myctx;
    const body = await ctx.api('/api/help/scope') as {
      corpus: { scoped: unknown[]; unscoped: { policy: string }[] };
    };
    return {
      scoped: body.corpus.scoped.length,
      unscoped: body.corpus.unscoped.length,
      inert: body.corpus.unscoped.filter((u) => u.policy === 'inert').length,
    };
  });
  expect(
    split.scoped + split.unscoped,
    'this corpus holds no items at all, so nothing below measures anything',
  ).toBeGreaterThan(0);

  await expect(
    note,
    'a tool event draws no scope disclosure at all — the control is presented as a filter '
    + 'with nothing said about what it can do',
  ).not.toBeEmpty();

  const text = (await note.innerText()).replace(/\s+/g, ' ');
  // The whole corpus, not the drawn half: a sentence naming a display cap where
  // a corpus total belongs is the display cap reported as a fact.
  expect(
    text,
    'the disclosure must carry the REAL count of scoped items and the REAL total — these are '
    + 'the two numbers the owner needed in order to read an inert-looking control correctly',
  ).toContain(`${split.scoped} of ${split.scoped + split.unscoped}`);
  expect(text, 'and how many carry no scope of their own').toContain(String(split.unscoped));
  expect(
    text,
    'and it must name the tier the path actually narrows — the path reaches the jit tier and '
    + 'no other, and a sentence that implied otherwise would be a new wrong answer',
  ).toMatch(/jit/);

  // The inert clause appears exactly when the policy actually removes something.
  if (split.inert > 0) {
    expect(text, 'some unscoped items are inert and the sentence must say so')
      .toMatch(/inert/);
  }

  // **The control is DISCLOSED, never hidden.** A missing control is the same
  // silence one step further on — the task says so in those words.
  await expect(
    preview(page).locator('#pathsel'),
    'the path picker was removed rather than explained',
  ).toBeVisible();

  // And it goes away with the event it is about.
  await chooseEvent(page, 'session-start');
  await expect(note, 'the disclosure outlived the picker it is about').toBeEmpty();
});

test('the absent-tier ribbon sentences change language, because they are keyed now', async ({ app }) => {
  const { page } = app;
  await landing(page);

  /** The label and hint of every hatched (absent) tier track, in order. */
  const absentText = (): Promise<string[]> => preview(page).evaluate((section) =>
    [...section.querySelectorAll('#ribbons .ribbon')]
      .filter((r) => r.querySelector('.notrun') !== null)
      .flatMap((r) => [
        [...r.querySelectorAll<HTMLElement>('.rlabel > span')]
          .filter((s) => !s.classList.contains('chip'))
          .map((s) => s.textContent ?? '').join(''),
        r.querySelector<HTMLElement>('.hint')?.textContent ?? '',
      ]));

  const english = await absentText();
  expect(
    english.length,
    'no tier is absent on this event, so there is no absent-tier sentence to measure. '
    + 'session-start does not reach jit or restored, so this is a real failure and not a '
    + 'corpus accident',
  ).toBeGreaterThan(0);
  expect(english, 'the English sentences are the design of record\'s own words')
    .toContain('does not run on this event');
  expect(english).toContain('Absent, not empty — this event never reaches the tier at all.');

  await page.locator('#lang').click();
  const settled = await settleScreen(page, 'preview', { requires: '#ribbons' });
  expect(settled.settled, 'the preview never settled after the language toggle').toBe(true);
  expect(await page.evaluate(() => document.documentElement.dir), 'Hebrew declares its direction')
    .toBe('rtl');

  const hebrew = await absentText();
  expect(hebrew.length, 'a sentence appeared or disappeared with the language')
    .toBe(english.length);
  expect(
    hebrew.every((s) => s.trim() !== ''),
    'a sentence went EMPTY in Hebrew, which passes a "it changed" check while being worse '
    + 'than not translating it at all',
  ).toBe(true);
  expect(
    hebrew.filter((s, i) => s === english[i]),
    'these sentences stayed English inside a right-to-left page. That is the defect '
    + '`plan:walk seq:60` is about: an unkeyed literal is invisible to strings-parity, which '
    + 'compares key sets, and to bidi.spec, which censuses per data-t',
  ).toEqual([]);

  // The round trip, for `language.spec.ts`'s own reason: a toggle that cannot
  // come back has lost the English rather than translated it.
  await page.locator('#lang').click();
  const back = await settleScreen(page, 'preview', { requires: '#ribbons' });
  expect(back.settled, 'the preview never settled coming back to English').toBe(true);
  expect(await absentText(), 'the English sentences did not come back').toEqual(english);
});
