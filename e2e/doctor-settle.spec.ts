/**
 * **The bulk settlement on the Doctor screen — one ruling for a whole code.**
 *
 * `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`, owner
 * ruling 2026-09-03, overturning his own no-bulk ruling of 2026-08-31: *"for
 * notices that could be many items, we need to have a capability to fix all of
 * them at once using doctor"*, and *"doctor was added to the app for repairing
 * this is it's role"*. Measured on this repository the same day: 71 findings, 70
 * of them routing to `acknowledge` — seventy confirmations and seventy one-shot
 * nonces to clear one screen. A gate nobody can afford to pass is not a gate.
 *
 * ── THIS SPEC RUNS OVER THE LIVE CORPUS, DELIBERATELY ──────────────────────
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`, owner,
 * 2026-09-03: *"all your tests would be on the current corpus because we are
 * doing dog fooding"*, and it says in its own words that the browser suite
 * *"is hardwired to `.demo-corpus` today and therefore does not comply"*. So
 * this file does NOT use `./app.ts`'s fixture: it starts its own server over the
 * repository's own corpus and asserts against what that corpus actually
 * reports. The reason it matters here rather than in general is the shape of
 * this feature — a control that only appears when a code has TWO OR MORE open
 * findings. The demo corpus's Doctor answers three `dead_scope` findings; the
 * live one answers 89 across five codes. A fixture would have proved the control
 * can be drawn and nothing about whether it appears on the screen the owner
 * opens.
 *
 * **The server writes nothing.** `test/ui/server-e2e.test.ts` snapshots every
 * byte under the workspace and compares it after a full route sweep, so the
 * read surface leaving the corpus untouched is an assertion rather than a
 * comment.
 *
 * ── AND IT NEVER PRESSES "RUN IT" ──────────────────────────────────────────
 *
 * **A bulk acknowledgement writes to the owner's live corpus, and nobody has
 * approved that.** So the drive stops one button short: the confirm is opened,
 * read, asserted against the composed line, and CANCELLED. What that leaves
 * unproved is stated rather than left to be discovered — the write path is
 * covered end to end in `test/cli/ack-all.test.ts`, against a throwaway
 * workspace, where it belongs
 * (`RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is`).
 *
 * ── WHAT IS ASSERTED HERE AND NOWHERE ELSE ─────────────────────────────────
 *
 * `test/ui/doctor-screen.test.ts` holds the DECISION — which findings a
 * settlement covers, that the count is the finding count, that the argv carries
 * no `--yes`. Spec §6 keeps DOM glue out of the node suite, so what only a
 * browser can answer is what this file asks: that the control RENDERS, in the
 * right card, with the right count on it, and that pressing Execute reaches the
 * same confirm-and-nonce path every other command in this UI uses.
 */
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';

const REPO = path.resolve(import.meta.dirname, '..');

const screen = '[data-p="doctor"]';
/** A command block that is a direct child of a card: shared by every row of its
 *  code. The bulk settlement is one of these; a row's own `ack` sits in a
 *  `<td>`, and the child combinator is the whole difference. */
const sharedCmd = `${screen} .card.pane > div.cmd`;

/** `Finding` as `/api/doctor` serves it — `runChecks`' own shape, unreshaped. */
interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
  acknowledged?: true;
  remedy: { route: string; command?: string; values?: Record<string, string | true> };
}

/**
 * The app over THIS repository's corpus. A fixture of its own rather than
 * `./app.ts`'s, for the reason in the header: that one is pinned to
 * `.demo-corpus` and this feature is invisible at fixture scale.
 */
const test = base.extend<{ live: { page: Page } }>({
  live: async ({ page }, use) => {
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(REPO);
      const h = harness;
      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      await expect(
        page.locator('.nav').first(),
        'the app never rendered a rail button — it probably has no token',
      ).toBeVisible({ timeout: 20_000 });
      await use({ page });
    } finally {
      if (harness !== undefined) await harness.stop();
    }
  },
});

/**
 * Navigate to Doctor and wait for the cards the served body builds, returning
 * the body the screen actually drew from.
 *
 * **The response is CAPTURED, never re-fetched.** A second fetch would need the
 * page's token and would ask the server again — two runs of `runChecks`, which
 * can legitimately disagree if anything moved between them. What is under test
 * is whether the screen matches ITS OWN data, so the body it was handed is the
 * one this compares against.
 */
async function openDoctor(page: Page): Promise<Finding[]> {
  const answered = page.waitForResponse(
    (r) => r.url().includes('/api/doctor') && r.status() === 200, { timeout: 30_000 },
  );
  await page.evaluate(() => { location.hash = '#/doctor'; });
  await page.locator(`${screen} .card.pane`).first().waitFor({ timeout: 30_000 });
  // The settlements are drawn in the same pass as the cards, so the cards being
  // there is the signal. One frame of settle, never a blind timeout.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-p="doctor"] .card.pane').length === 3,
    undefined, { timeout: 30_000 },
  );
  const body = await (await answered).json() as { findings?: Finding[] };
  expect(body.findings, '/api/doctor answered without a findings list').toBeDefined();
  return body.findings ?? [];
}

/** The counts the SCREEN offers, read off the composed lines it drew. */
async function offered(page: Page): Promise<Map<string, number>> {
  const lines = await page.locator(`${sharedCmd} code`).allTextContents();
  const out = new Map<string, number>();
  for (const line of lines) {
    const m = /ack --all --code (\S+) --count (\d+)/.exec(line);
    if (m !== null) out.set(m[1], Number(m[2]));
  }
  return out;
}

test('the live corpus draws a settlement per code, and every count is the corpus\'s own', async ({ live }) => {
  const { page } = live;
  const findings = await openDoctor(page);
  // Anti-vacuity: a corpus with nothing to settle would pass every assertion
  // below by having nothing to check, which is the shape this project has
  // caught itself shipping four times.
  expect(findings.length, 'the live corpus reports no findings at all; this spec measured nothing')
    .toBeGreaterThan(0);

  // The expected set, derived from the SERVED body rather than from the screen:
  // a code with two or more findings that name an item, route to `acknowledge`,
  // and are not already ruled on.
  const expected = new Map<string, number>();
  for (const f of findings) {
    if (f.remedy?.route !== 'acknowledge') continue;
    if (typeof f.item !== 'string' || f.item === '') continue;
    if (f.acknowledged === true) continue;
    expected.set(f.code, (expected.get(f.code) ?? 0) + 1);
  }
  for (const [code, n] of [...expected]) if (n < 2) expected.delete(code);

  expect(expected.size,
    'no code in the live corpus has two open findings a person settles, so this run proves '
    + 'nothing about the control the owner asked for').toBeGreaterThan(0);

  const drawn = await offered(page);
  // Set equality in BOTH directions. A code the screen offers that the body
  // does not support would compose a command the CLI refuses; a code the body
  // supports and the screen does not offer is the seventy-confirmations problem
  // still unsolved for that code, in silence.
  expect(
    [...drawn.entries()].sort(),
    'the settlements on screen and the settlements the served findings support are not the '
    + 'same set',
  ).toEqual([...expected.entries()].sort());

  // **The count on the button is the count the CLI will find.** It is the
  // argument of `--count`, which is how `mycontext ack --all` is CONSENTED to,
  // and the command refuses a count that does not match. A control composing a
  // number that is off by one composes a command guaranteed to be refused.
  for (const [code, n] of drawn) {
    expect(n, `${code}: the screen and the served body disagree about the count`)
      .toBe(expected.get(code));
  }

  // Each one carries the sentence that says what it covers AND that nothing
  // disappears — the property of this act a reader could most easily get wrong.
  const notes = (await page.locator(`${screen} .card.pane > p.small`).allInnerTexts()).join(' | ');
  for (const code of drawn.keys()) {
    expect(notes, `${code} has a control and no sentence above it`).toContain(code);
  }
  expect(notes, 'the settlement must say that the findings stay')
    .toMatch(/stays reported and counted/);

  // And it is EXECUTE, not Copy-only: it goes through the same confirm and the
  // same one-shot nonce as every other command this UI runs.
  const actions = page.locator(`${screen} .card.pane > div.cmd + .cmdactions`);
  await expect(actions.first().getByRole('button', { name: 'Execute' })).toBeVisible();
});

test('a settlement covers only what a ruling can settle, and the row keeps its own control', async ({ live }) => {
  const { page } = live;
  // The edge cases the live corpus is not guaranteed to hold on any given day,
  // served rather than staged: writing items into the corpus to produce them is
  // exactly what the dogfooding instruction does NOT licence.
  const findings: Finding[] = [
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-a', message: 'body retracts its own premise. Which of the two moves is the owner\'s call.', remedy: { route: 'acknowledge' } },
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-b', message: 'body retracts its own premise. Which of the two moves is the owner\'s call.', remedy: { route: 'acknowledge' } },
    // Already ruled on: it keeps its row, its chip and its own control, and is
    // NOT in the count — the command would refuse it.
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-c', message: 'body retracts its own premise. Which of the two moves is the owner\'s call.', remedy: { route: 'acknowledge' }, acknowledged: true },
    // Names no item: an acknowledgement is anchored to an item's content.
    { level: 'info', code: 'body_disagrees_with_meta', message: 'body retracts its own premise. Which of the two moves is the owner\'s call.', remedy: { route: 'acknowledge' } },
    // A different route: bulk-running `refresh` would rewrite two bodies.
    { level: 'warn', code: 'source_drift', item: 'REF-a', message: '"a.md" has changed since REF-a snapshotted it. Run `mycontext refresh REF-a`.', remedy: { route: 'run', command: 'refresh', values: { id: 'REF-a', yes: true } } },
    { level: 'warn', code: 'source_drift', item: 'REF-b', message: '"b.md" has changed since REF-b snapshotted it. Run `mycontext refresh REF-b`.', remedy: { route: 'run', command: 'refresh', values: { id: 'REF-b', yes: true } } },
    // One of a kind: the row's own `ack <id> <code>` already settles it, and a
    // bulk control for one row would be a second control for one act.
    { level: 'error', code: 'source_missing', item: 'REF-c', message: 'source document "c.md" could not be read.', remedy: { route: 'acknowledge' } },
  ];
  await page.route('**/api/doctor*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ findings }),
  }));
  await openDoctor(page);

  const drawn = await offered(page);
  expect([...drawn.entries()],
    'the settlement must cover exactly the findings the command will write: not the one already '
    + 'ruled on, not the one naming no item, not a `run` route, and not a code with a single row')
    .toEqual([['body_disagrees_with_meta', 2]]);

  // **NOTHING DISAPPEARS.** `INV-nothing-is-dropped-silently` and the owner's
  // own words in `RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it`:
  // a finding that was acknowledged rather than repaired stays, marked. All
  // seven rows are still on screen, and the four ack-routed ones still carry
  // their own per-row control.
  await expect(page.locator(`${screen} tbody tr`)).toHaveCount(findings.length);
  await expect(page.locator(`${screen} td div.cmd`)).toHaveCount(4);
  await expect(page.locator(`${screen} span.chip.index`),
    'the acknowledged row must still say it was ruled on').toHaveCount(1);

  // The tally is untouched by this feature: rows-drawing-a-chip + repairs +
  // settle is still exactly `findings`.
  const tally = await page.locator(`${screen} > p.small`).first().innerText();
  expect(tally).toContain(String(findings.length));
});

test('Execute opens the confirm naming the exact command, and this spec stops there', async ({ live }) => {
  const { page } = live;
  await openDoctor(page);

  const drawn = await offered(page);
  // **Asserted, never skipped.** A `test.skip` here would turn "the control
  // vanished" into a green run with a note nobody reads — measured: mutating
  // the screen so it draws no settlement failed the two tests above and SKIPPED
  // these two. A skip is how a regression stays green.
  expect(drawn.size,
    'the live corpus draws no settlement, so there is nothing to confirm — either the control '
    + 'regressed or this corpus has no code with two open findings a person settles',
  ).toBeGreaterThan(0);

  const cmd = page.locator(`${sharedCmd}`).filter({ hasText: 'ack --all' }).first();
  await cmd.scrollIntoViewIfNeeded();
  const line = (await cmd.locator('code').innerText()).trim();
  const actions = cmd.locator('xpath=following-sibling::div[contains(@class,"cmdactions")][1]');

  await actions.getByRole('button', { name: 'Execute' }).click();

  // **The string a person reads in the confirm and the argv that runs are the
  // same thing** — that is the confirm's whole job, and the argv it shows is the
  // SERVER'S, rebuilt from the catalogue rather than echoed from the page.
  const shown = actions.locator('code').filter({ hasText: 'ack --all' });
  await expect(shown.first()).toBeVisible({ timeout: 20_000 });
  expect((await shown.first().innerText()).trim(),
    'the confirm shows a different command from the one the card offered').toBe(line);

  // `ack` is off the approval boundary — it changes nothing that governs — so
  // this is the plain confirm and NOT the field-by-field diff. That is derived
  // rather than chosen: `approvalBoundary()` reads the boundary off which
  // commands accept `--yes`, and this one does not.
  await expect(actions.getByRole('button', { name: 'Run it' }),
    'the confirm did not arm — the nonce is minted by this GET and by nothing else',
  ).toBeVisible({ timeout: 20_000 });

  // **AND IT IS NOT PRESSED.** A bulk acknowledgement writes to the owner's
  // live corpus. The write path is proved in `test/cli/ack-all.test.ts` against
  // a throwaway workspace; here the drive stops one button short, deliberately,
  // and cancels so nothing is left armed.
  await actions.getByRole('button', { name: 'Cancel' }).click();
  await expect(actions.getByRole('button', { name: 'Run it' })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Execute' })).toBeVisible();
});

test('the settlement speaks Hebrew too, and its command does not change', async ({ live }) => {
  const { page } = live;
  await openDoctor(page);
  const before = await offered(page);
  expect(before.size,
    'the live corpus draws no settlement in English, so nothing here measures the Hebrew one',
  ).toBeGreaterThan(0);

  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await openDoctor(page);

  const notes = (await page.locator(`${screen} .card.pane > p.small`).allInnerTexts()).join(' | ');
  expect(notes.trim().length, 'the sentence renders empty in Hebrew').toBeGreaterThan(0);
  expect(notes, 'the Hebrew UI still shows the English sentence — doc.settle is not in he.js')
    .not.toContain('One ruling for all');
  expect(notes, 'the Hebrew sentence must still name the code it covers')
    .toContain([...before.keys()][0]);

  // A COMMAND is byte-identical in both tables: it is composed, not translated.
  expect([...(await offered(page)).entries()].sort()).toEqual([...before.entries()].sort());
});
