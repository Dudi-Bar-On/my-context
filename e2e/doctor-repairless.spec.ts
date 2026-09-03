/**
 * **Every doctor finding reaches a control or says why it has none — and the
 * screen counts both.**
 *
 * ── THE FIRST HALF, 2026-08-28 ─────────────────────────────────────────────
 *
 * Owner, opening this screen: *"doctor lost it's execute an fix controls ? why
 * yo broke it ?"*
 *
 * **Nothing was broken, and that was the defect.** The screen drew a repair
 * control only for the four codes whose own message named a runnable command;
 * `lib/viewmodel.js`'s `repairCommandFor` was the entire list and `null` was its
 * ordinary answer. That day cleared nine `source_file` links — retiring every
 * `source_drift`, the code that had been supplying most of the controls — and
 * `plan:categories seq:21` added `blocked_without_needs`, whose remedy is a
 * person naming a blocker. The corpus got healthier and the toolbar went quiet.
 *
 * **Quiet is what broken looks like.** The reader's only evidence was an
 * absence, and an absence cannot distinguish "this corpus needs no command"
 * from "this build lost its commands". The fix was a chip on the row and a count
 * above the cards, and both are still asserted below.
 *
 * ── THE SECOND HALF, 2026-09-03, AND WHY THE FIRST WAS NOT ENOUGH ──────────
 *
 * Owner: *"currently doctor contains many items i do not have any way to
 * handle, solve it"*. Measured the same morning against this repository: **74
 * findings, five codes, and not one of them with a control.** The screen was
 * honest — every row said "no automated repair" and the tally said `0` — and
 * honesty about having nothing to offer is not the same as having something to
 * offer.
 *
 * `mycontext ack <id> <code>` had existed since 2026-08-27 (owner ruling,
 * argued in `src/core/acknowledge.ts`) and reached NO surface in this UI. It is
 * the designed route for a finding whose resolution is a judgement rather than a
 * command — *"which of the two moves is the owner's call"*, *"only a person can
 * tell the two apart"* — and it is now what those rows draw.
 *
 * What made it reachable is the design recorded at `reports/V2-HANDOVER.md:437`
 * and finally built: **`Finding` declares its own remedy**, so the screen reads
 * a route off the finding instead of consulting a four-code table of its own.
 * `test/ui/palette-lib.test.ts` carried the reason `ack` had no catalogue entry,
 * and the reason names exactly that: *"a control that composed a usable line
 * would have to be driven by the doctor read model rather than by a flag
 * declaration"*.
 *
 * ── WHY A BROWSER, AND WHY A SERVED ANSWER ─────────────────────────────────
 *
 * `test/ui/doctor-screen.test.ts` holds the DECISION — which route earns which
 * control, that the tally and the row read one declaration, that the chip is the
 * strip's own primitive. What it cannot hold is the thing the owner saw: a
 * rendered screen with no control on it. Spec §6 keeps DOM glue out of the node
 * suite, so the rendering is only ever checked here, and the state under test is
 * precisely a rendering.
 *
 * **The findings are SERVED, not staged in the corpus.** `.demo-corpus` is
 * shared by every spec in this suite and is driven by them; editing items into
 * it to produce these codes would rewrite bodies underneath the others, and
 * `execute.spec.ts` already refuses to run this screen's repair for that exact
 * reason. `/api/doctor` serves `runChecks` verbatim — `{ findings: Finding[] }`,
 * unfiltered and unreshaped — so fulfilling that route is the endpoint's own
 * body shape and what is under test is the DRAWING of it. `chart-scale.spec.ts`
 * serves `/api/graph` the same way and for the same reason.
 *
 * The codes and messages are the owner's own, and the messages are the REAL
 * sentences `src/doctor/checks.ts` composes for them — abbreviated, not
 * invented, so a reworded check leaves this spec asserting about a message that
 * still exists. The `remedy` on each is the one that check declares, for the
 * same reason.
 *
 * ── WHAT THIS SPEC DELIBERATELY STOPS SHORT OF ─────────────────────────────
 *
 * It presses no Execute. `.demo-corpus` is driven by every other spec here, and
 * an acknowledgement writes into an item file and re-stamps its checksum. The
 * defect being closed was never in the running — it was that there was nothing
 * to press — so the assertion is that the control is composed, correct and
 * offered as EXECUTE rather than Copy-only. `execute.spec.ts` drives this
 * screen's Execute-to-confirm path against the corpus's own `source_drift`.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/**
 * `Remedy` as `src/doctor/checks.ts` declares it and `/api/doctor` serves it:
 * a ROUTE, plus the catalogue id and value bag the server would rebuild an argv
 * from. Never a composed command — the client sends an id and a value bag and
 * never a command (spec §3.1).
 */
type Remedy =
  | { route: 'run'; command: string; values: Record<string, string | true> }
  | { route: 'copy'; argv: string[] }
  | { route: 'acknowledge' }
  | { route: 'none'; why: 'person' | 'nothing' };

/** `Finding` as `/api/doctor` serves it: `{ level, code, message, remedy, item? }`. */
interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  remedy: Remedy;
  item?: string;
}

/**
 * **A corpus whose findings offer NOTHING**, which is the state the 2026-08-28
 * report was made of and the one a screen must not answer with silence.
 *
 * Both name no item, so neither can even be acknowledged: an acknowledgement is
 * anchored to an item (`acknowledgeFinding` writes into its `acknowledged` map
 * and re-stamps its checksum), and there is nothing here to anchor to. They are
 * the two `route: 'none'` reasons, one each:
 *
 *   `why: 'person'`    `cli_not_on_path` is answered by `npm link`, which is
 *                      not a command this product composes.
 *   `why: 'nothing'`   `nested_corpus` says in its own words that *"nothing is
 *                      wrong with it existing"*. It asks for no change at all.
 */
const NO_CONTROL: Finding[] = [
  {
    level: 'warn',
    code: 'cli_not_on_path',
    remedy: { route: 'none', why: 'person' },
    message: '`mycontext` — the word every documented command in this project\'s READMEs and '
      + 'skill begins with — does not resolve on this machine\'s PATH. Run `npm link` to provide '
      + 'it.',
  },
  {
    level: 'info',
    code: 'nested_corpus',
    remedy: { route: 'none', why: 'nothing' },
    message: 'a second corpus is nested at "sub/project". `findProjectRoot` stops at the FIRST '
      + '`.my_context` above the working directory, so any session started at or below that '
      + 'path gets THAT corpus instead of this one — a different board, silently.',
  },
];

/**
 * **The corpus of 2026-09-03, in miniature**: findings a PERSON settles, on
 * items, which is 73 of that morning's 74. Each declares `route: 'acknowledge'`
 * and each must draw `mycontext ack <id> <code>` on its own row.
 *
 * `blocked_without_needs` is the code from the first report — its remedy is a
 * person naming a blocker, correctly not automatable — and it is here precisely
 * because "correctly not automatable" never meant "correctly uncontrolled".
 * `body_disagrees_with_meta` is the largest group on the owner's own screen, 36
 * of the 74, and its message ends by naming whose call it is.
 */
const SETTLED_BY_A_PERSON: Finding[] = [
  {
    level: 'warn',
    code: 'blocked_without_needs',
    item: 'TASK-the-shared-write-preview-block-was-never-built',
    remedy: { route: 'acknowledge' },
    message: 'is at state "blocked" and names nothing in "needs", so it is a blocker with no '
      + 'target: nothing can say what would free it, and nothing will notice when that thing '
      + 'lands.',
  },
  {
    level: 'info',
    code: 'body_disagrees_with_meta',
    item: 'DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn',
    remedy: { route: 'acknowledge' },
    message: 'body retracts its own premise. Read the body against the title and the fields; '
      + 'which of the two moves is the owner\'s call.',
  },
];

/** One finding that a COMMAND repairs — the control case for both halves. */
const REPAIRABLE: Finding = {
  level: 'error',
  code: 'index_stale',
  remedy: { route: 'run', command: 'rebuild', values: {} },
  message: 'the index is older than the items it indexes. Run `mycontext rebuild`.',
};

const screen = '[data-p="doctor"]';

/**
 * The SHARED repair block, which is a direct child of the card — as opposed to
 * a row's own control, which is inside a `<td>`. Both are `div.cmd`, and the
 * child combinator is the whole difference between "the command that answers
 * for this card" and "the command that answers for this row".
 */
const sharedCmd = `${screen} .card.pane > div.cmd`;
/** A control drawn inside a table cell: the row's own `mycontext ack`. */
const rowCmd = `${screen} td div.cmd`;

async function openDoctor(page: Page, findings: Finding[]): Promise<void> {
  await page.route('**/api/doctor*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ findings }),
  }));
  await page.evaluate(() => { location.hash = '#/doctor'; });
  // The three cards are built AFTER the endpoint answers, so their appearance
  // is the signal that this served body is what is on screen — never a timeout.
  await page.locator(`${screen} .card.pane`).first().waitFor({ timeout: 20_000 });
}

test('a finding nothing can act on says so on its row, and the screen counts them', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, NO_CONTROL);

  // **The state under test, asserted as a state rather than assumed.** Without
  // this the assertions below would pass against a screen that simply drew
  // nothing at all — which is the bug, not the fix.
  await expect(
    page.locator(`${screen} div.cmd`),
    'neither of these findings composes a command anywhere, so there must be no command block '
    + 'to find — under the cards or inside a row',
  ).toHaveCount(0);
  await expect(page.locator(`${screen} .cmdactions`)).toHaveCount(0);

  // ── The row says what it HAS. ──
  const chips = page.locator(`${screen} span.chip.unmeas`);
  await expect(
    chips,
    'a finding with no control drew nothing at all — which is the silence the owner read as a '
    + 'regression. Every one of these two rows must name its own state.',
  ).toHaveCount(NO_CONTROL.length);

  // **Two reasons, two sentences, and they are not the same fact.** One is
  // settled by a person outside my_context; the other asks for no change at
  // all. Drawing one sentence over both described the product instead of the
  // finding.
  const said = await chips.allInnerTexts();
  expect(new Set(said.map((t) => t.trim())).size,
    'both rows drew the SAME chip — the two `route: "none"` reasons have collapsed into one '
    + 'sentence, and a finding that asks for nothing now reads as a finding nobody built a fix '
    + 'for').toBe(2);
  expect(said.join(' | ')).toContain('no automated repair');
  expect(said.join(' | ')).toContain('nothing to do');

  // And it says WHY, in the title — the same split the strip's three named
  // states use: two words on screen, the sentence in the attribute.
  for (const chip of await chips.all()) {
    const why = await chip.getAttribute('title');
    expect(why, 'the chip names a state and never explains it').toBeTruthy();
    expect((why ?? '').length, 'the explanation is a word, not a sentence').toBeGreaterThan(20);
  }

  // ── The screen states how many findings carry each kind of control. ──
  const tally = page.locator(`${screen} > p.small`).first();
  await expect(tally).toBeVisible();
  const text = await tally.innerText();
  expect(text, 'the count of findings is not stated').toContain('2');
  expect(text, 'a zero repairs must be DRAWN AND NAMED — that is the entire difference between '
    + 'a healthy corpus and a screen that lost its controls').toMatch(/automated repair:\s*0/);
  expect(text, 'the count of findings a person can settle is missing — it is the number the '
    + 'owner was actually asking for').toMatch(/settle:\s*0/);
});

/**
 * **THE ASSERTION THIS FILE WAS EXTENDED FOR.** A finding whose remedy is
 * `acknowledge` draws a real, composed, executable control on its own row —
 * not a chip, not a Copy-only line, and not nothing.
 */
test('a finding a person settles draws mycontext ack on its own row', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, SETTLED_BY_A_PERSON);

  // Not one chip on the screen: every row here has a control, so no row may say
  // it has none. This is the exact inversion of the state above.
  await expect(
    page.locator(`${screen} span.chip.unmeas`),
    'a finding with an acknowledge control still drew the chip that says it has none — the '
    + 'screen is contradicting itself on the same row',
  ).toHaveCount(0);

  // ── The control, on the ROW, one per finding. ──
  const rows = page.locator(rowCmd);
  await expect(
    rows,
    'the acknowledge control is not drawn on the rows. This is the defect the owner reported on '
    + '2026-09-03: `mycontext ack` had existed since 2026-08-27 and no screen offered it.',
  ).toHaveCount(SETTLED_BY_A_PERSON.length);

  // Nothing under the card: an ack answers for ONE row and one row only, and a
  // shared block would be a control a reader cannot match to a finding.
  await expect(
    page.locator(sharedCmd),
    'an acknowledge command was appended under the card, where the shared repairs go — a reader '
    + 'cannot tell which of N rows it belongs to',
  ).toHaveCount(0);

  // ── The line is the command, with the finding's OWN id and code. ──
  const lines = await rows.locator('code').allInnerTexts();
  expect(lines.map((l) => l.trim()).sort()).toEqual([
    'mycontext ack DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn'
      + ' body_disagrees_with_meta',
    'mycontext ack TASK-the-shared-write-preview-block-was-never-built blocked_without_needs',
  ].sort());

  // Each line sits on the row it names, which is what makes a per-row control
  // safe: a control composed from a copy of an id could name a different item
  // from the cell beside it.
  for (const finding of SETTLED_BY_A_PERSON) {
    const row = page.locator(`${screen} tr`, { hasText: finding.code }).first();
    await expect(row.locator('div.cmd code')).toHaveText(
      `mycontext ack ${finding.item} ${finding.code}`,
    );
  }

  // ── EXECUTE, not Copy alone. ──
  //
  // `commandActions` draws Copy for every command and adds Execute only where
  // the remedy names a catalogue entry the SERVER can rebuild the argv from. A
  // Copy-only control here would mean `ack` never reached `PALETTE`, and the
  // row would be a sentence to retype rather than a control to press — which is
  // the state the owner reported, wearing a tidier shape.
  const actions = page.locator(`${screen} td .cmdactions`);
  await expect(actions).toHaveCount(SETTLED_BY_A_PERSON.length);
  await expect(
    actions.first().getByRole('button', { name: 'Execute', exact: true }),
    'the control offers Copy alone — `ack` is not resolving through the command catalogue, so '
    + 'there is nothing for the server to rebuild and nothing to confirm',
  ).toBeVisible();

  // ── And the tally names them. ──
  const tally = await page.locator(`${screen} > p.small`).first().innerText();
  expect(tally, 'the tally must count the rulings separately from the repairs: folding them '
    + 'together would say "with an automated repair: 2" over a corpus where nothing is automated')
    .toMatch(/automated repair:\s*0/);
  expect(tally).toMatch(/settle:\s*2/);
});

test('a repairable finding keeps its shared control and draws no chip', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, [...NO_CONTROL, REPAIRABLE]);

  // The control is still composed where a command exists — a disclosure that
  // suppressed the controls would "fix" the report by causing it. It is a
  // direct child of the card, because `mycontext rebuild` answers for every
  // `index_stale` row at once rather than for one of them.
  const cmd = page.locator(`${sharedCmd} code`);
  await expect(cmd).toHaveCount(1);
  await expect(cmd.first()).toHaveText('mycontext rebuild');

  // Two chips, not three: the repairable row draws none.
  await expect(
    page.locator(`${screen} span.chip.unmeas`),
    'the chip is drawn per ROW and only where the row has no control; a chip beside a command '
    + 'says nothing',
  ).toHaveCount(NO_CONTROL.length);

  // The row that owns the command carries no chip of its own.
  const stale = page.locator(`${screen} tr`, { hasText: 'index_stale' }).first();
  await expect(stale.locator('span.chip.unmeas')).toHaveCount(0);

  await expect(page.locator(`${screen} > p.small`).first())
    .toContainText(/automated repair:\s*1/);
});

/**
 * **Every part of the disclosure survives the language toggle**, because a
 * reader who cannot read English is exactly the reader an unexplained blank
 * strands. `#lang` is the shell's own control; the assertion is that the
 * elements are still there and still say something in the other table, never
 * that a particular Hebrew sentence is on screen — translation freshness is a
 * review obligation, not a tested one (`test/ui/strings-parity.test.ts`).
 *
 * The COMMAND is the exception and is asserted verbatim: a composed argv is not
 * a sentence and must not be translated. A localised `mycontext ack` would be a
 * line that does not run.
 *
 * `#lang` writes the preference and RELOADS, and the reload lands on the
 * default screen because the nonce fragment died on the first load. So the
 * route is re-armed and the screen re-opened rather than assumed to survive —
 * a spec that asserted against whatever the reload happened to draw would be
 * measuring the landing screen.
 */
test('the chips, the tally and the ack control all exist in Hebrew too', async ({ app }) => {
  const { page } = app;
  await openDoctor(page, [...NO_CONTROL, ...SETTLED_BY_A_PERSON]);
  await page.click('#lang');
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await openDoctor(page, [...NO_CONTROL, ...SETTLED_BY_A_PERSON]);

  const chips = page.locator(`${screen} span.chip.unmeas`);
  await expect(chips).toHaveCount(NO_CONTROL.length);
  const said = await chips.first().innerText();
  expect(said.trim().length, 'the chip renders empty in Hebrew').toBeGreaterThan(0);
  expect(said, 'the Hebrew UI still shows the English state — the key is not in he.js')
    .not.toContain('no automated repair');
  const title = await chips.first().getAttribute('title');
  expect(title, 'the reason is untranslated in Hebrew').not.toContain('Settled by a person');

  // The second chip's key is the newer of the two and is the one most likely to
  // have been added to en.js alone.
  const both = await chips.allInnerTexts();
  expect(both.join(' | '), 'the second reason is untranslated in Hebrew')
    .not.toContain('nothing to do');

  const tally = await page.locator(`${screen} > p.small`).first().innerText();
  expect(tally, 'the tally must still carry all three numbers in the other table').toContain('4');
  expect(tally).toContain('0');
  expect(tally).toContain('2');

  // The control is a COMMAND, not prose: it is byte-identical in both tables.
  await expect(page.locator(rowCmd)).toHaveCount(SETTLED_BY_A_PERSON.length);
  await expect(page.locator(`${rowCmd} code`).first()).toContainText('mycontext ack ');
  await expect(
    page.locator(`${screen} td .cmdactions`).first().getByRole('button'),
    'the Hebrew UI draws no control on a row that has one in English',
  ).not.toHaveCount(0);
});
