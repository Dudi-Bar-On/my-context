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
 * ── THIS SPEC RAN OVER THE LIVE CORPUS, UNTIL THE LIVE CORPUS HAD NOTHING ──
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`, owner,
 * 2026-09-03: *"all your tests would be on the current corpus because we are
 * doing dog fooding"*. That is the rule this file used to follow — its own
 * server, over the repository's own corpus, asserting against what that
 * corpus actually reported. It held for exactly as long as the corpus had
 * something to settle: 89 findings across five codes, one of them measured at
 * 71-of-74 that same day.
 *
 * Doctor went from 95 findings to ZERO the same day this spec was written, on
 * the strength of the very capabilities it and its siblings exist to exercise.
 * A spec that requires an unsettled corpus to prove a settling feature is
 * measuring nothing once the corpus is settled — the anti-vacuity guard below
 * is exactly the assertion that catches that, and it now fails honestly rather
 * than passing on an empty screen.
 *
 * **The owner's exception, given for this file, in these terms:** a temp
 * workspace holding one deliberately manufactured defect, exercised on screen,
 * then thrown away — never a fixture corpus standing in for the real one, and
 * never a write to `.my_context/`. `makeSettleWorkspace` below is that
 * workspace. It is `mkdtemp`'d, seeded through the real CLI (`init`, `add`,
 * `rebuild` — the same three commands a person would type), read once by
 * `startUiChild` — the same spawn path every other UI harness in this project
 * goes through — and `rmSync`'d in the fixture's `finally`, whether the test
 * passed or not. **This file never opens a server over this repository's own
 * `.my_context/` again.**
 *
 * ── WHY TWO FINDINGS, NOT ONE, AND WHY THIS ONE CODE ────────────────────────
 *
 * The control under test draws only for a CODE with TWO OR MORE open
 * findings — `screens/doctor.js`'s own rule, "one finding is not a class: the
 * row already carries `mycontext ack <id> <code>`, which is shorter, more
 * precise and settles the same thing." A workspace seeded with one deliberate
 * defect would build a screen with nothing to bulk-settle, which is the same
 * vacuity this file already guards against one level up. So the workspace
 * carries two items, each seeded with the SAME deliberate defect — a rule body
 * that retracts its own premise, `checkBodyAgreement`'s trigger for
 * `body_disagrees_with_meta` — rather than one. It is `test/cli/ack-all.test.ts`'s
 * own choice, for the identical reason: it needs no neighbouring file to cite,
 * and it carries no specimen-exemption mechanism (`citation_form`'s
 * `historical-citation` marker) to dodge for a scenario that has no use for it.
 * Two items, two findings, one code, both unacknowledged — the smallest corpus
 * this control can be measured on, and nothing else is seeded.
 *
 * ── AND IT NEVER PRESSES "RUN IT" ──────────────────────────────────────────
 *
 * The confirm is opened, read, asserted against the composed line, and
 * CANCELLED — this test is titled "and this spec stops there" for that reason,
 * and stays true to it even now that the corpus behind it is a throwaway
 * workspace rather than the owner's own. The write path is covered end to end
 * in `test/cli/ack-all.test.ts`, against its own throwaway workspace, where it
 * belongs (`RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is`)
 * — duplicating it here would prove the same thing twice through a slower door.
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
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';

/** The CLI entry the throwaway workspace is seeded through — `init`, `add`,
 *  `rebuild`, exactly as a person would type them. */
const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

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
 * A body whose own wording retracts its premise — `checkBodyAgreement`'s own
 * trigger for `body_disagrees_with_meta`, borrowed verbatim from
 * `test/cli/ack-all.test.ts` so the two files exercise the identical finding
 * rather than two spellings of "a body that disagrees with itself".
 */
const RETRACTING_BODY =
  'THE PREMISE HERE IS RETRACTED. This rule no longer holds in the form its title claims.';

/**
 * `mkdtemp`'d, `init`'d, seeded with exactly two rules carrying the same
 * deliberate defect, `rebuild`'t, and handed back as a bare path — the
 * fixture below is what starts a server over it and what throws it away.
 *
 * **`rebuild` is not optional here.** `/api/doctor` is served through
 * `withStores`, which reads the SQLite-backed index (`ws.dbPath`) rather than
 * walking the filesystem the way the plain CLI's own `doctor` command does —
 * `doctor-outcome.spec.ts`'s `makeWriteWorkspace` carries the same step for the
 * same reason. `add` alone left this workspace with two item files and no
 * guarantee the index agrees with them yet; `rebuild` is the one command whose
 * whole purpose is making that guarantee true.
 */
function makeSettleWorkspace(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-settle-'));
  const run = (args: string[]): void => {
    execFileSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  };
  run(['init']);
  for (const title of ['Settlement probe rule one', 'Settlement probe rule two']) {
    run([
      'add', 'rule', title, '--body', RETRACTING_BODY,
      '--summary', `A rule about ${title.toLowerCase()}.`, '--yes',
    ]);
  }
  run(['rebuild']);
  return root;
}

/**
 * The app over a THROWAWAY workspace built fresh for this file, and never
 * again over this repository's own corpus — see the header for why, and for
 * the owner's exception this fixture is built to stay inside. A fixture of its
 * own rather than `./app.ts`'s, for the reason the header argues at length:
 * that one is pinned to `.demo-corpus`, and the feature under test is
 * invisible at fixture scale unless the fixture is built to hold it, which
 * `./app.ts`'s is not and should not be widened to be.
 */
const test = base.extend<{ settle: { page: Page } }>({
  settle: async ({ page }, use) => {
    let harness: UiHarness | undefined;
    let root: string | undefined;
    try {
      root = makeSettleWorkspace();
      harness = await startUiChild(root);
      const h = harness;
      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      await expect(
        page.locator('.nav').first(),
        'the app never rendered a rail button — it probably has no token',
      ).toBeVisible({ timeout: 20_000 });
      await use({ page });
    } finally {
      if (harness !== undefined) await harness.stop();
      // Best-effort, and deliberately not awaited into a failure: a Windows
      // SQLite handle can outlive the child's own `exit` event by a beat, and a
      // failed cleanup of a disposable temp directory is not a reason to fail
      // an assertion that already passed — `doctor-outcome.spec.ts`'s
      // `makeWriteWorkspace` cleanup carries the identical argument.
      if (root !== undefined) {
        try { rmSync(root, { recursive: true, force: true }); } catch { /* see above */ }
      }
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

test('this workspace draws a settlement per code, and every count is its own', async ({ settle }) => {
  const { page } = settle;
  const findings = await openDoctor(page);
  // Anti-vacuity: a corpus with nothing to settle would pass every assertion
  // below by having nothing to check, which is the shape this project has
  // caught itself shipping four times. This workspace is manufactured
  // specifically to hold something to settle, so a failure here means the
  // manufacturing itself broke — not that the day's corpus happened to be
  // clean.
  expect(findings.length, 'this workspace reports no findings at all; this spec measured nothing')
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
    'no code in this workspace has two open findings a person settles, so this run proves '
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

test('a settlement covers only what a ruling can settle, and the row keeps its own control', async ({ settle }) => {
  const { page } = settle;
  // These edge cases are not worth constructing as real items in the seeded
  // workspace — hand-building seven items just to exercise the screen's own
  // filtering logic would be exactly the "general fixture" this file's
  // exception does not licence. Served instead: what is under test is the
  // filtering, not the corpus.
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

test('Execute opens the confirm naming the exact command, and this spec stops there', async ({ settle }) => {
  const { page } = settle;
  await openDoctor(page);

  const drawn = await offered(page);
  // **Asserted, never skipped.** A `test.skip` here would turn "the control
  // vanished" into a green run with a note nobody reads — measured: mutating
  // the screen so it draws no settlement failed the two tests above and SKIPPED
  // these two. A skip is how a regression stays green.
  expect(drawn.size,
    'this workspace draws no settlement, so there is nothing to confirm — either the control '
    + 'regressed or the seeded workspace failed to produce a code with two open findings a '
    + 'person settles',
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

  // **AND IT IS NOT PRESSED.** The write path is proved end to end in
  // `test/cli/ack-all.test.ts`, against its own throwaway workspace; here the
  // drive stops one button short, deliberately — this test is titled "and this
  // spec stops there" and stays true to it even though the corpus behind it is
  // now this file's own throwaway workspace rather than the owner's — and
  // cancels so nothing is left armed.
  await actions.getByRole('button', { name: 'Cancel' }).click();
  await expect(actions.getByRole('button', { name: 'Run it' })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Execute' })).toBeVisible();
});

test('the settlement speaks Hebrew too, and its command does not change', async ({ settle }) => {
  const { page } = settle;
  await openDoctor(page);
  const before = await offered(page);
  expect(before.size,
    'this workspace draws no settlement in English, so nothing here measures the Hebrew one',
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
