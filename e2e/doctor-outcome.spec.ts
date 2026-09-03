/**
 * **What a run TELLS the person who ran it — measured in the viewport, not in
 * the DOM.**
 *
 * Owner, 2026-09-03: *"check the doctor using playright, it looks like the run
 * do nothing"*.
 *
 * ── WHAT WAS MEASURED BEFORE ANYTHING WAS CHANGED ─────────────────────────
 *
 * Driven in real Chrome the same day: Execute -> confirm -> "Run it" on a
 * Doctor row WORKS. `POST /api/execute` answers 200 with `exitCode: 0` and real
 * stdout, and two `GET /api/doctor` refreshes follow it. The screen then redraws
 * identically, and two independent causes put together the impression of a
 * control that does nothing:
 *
 *  1. **The outcome was rendered off-screen.** `app.js`'s `attachExecuteOutcome`
 *     did `section.prepend(...)` — the top of the screen — and the Doctor pane
 *     over `.demo-corpus` is 166,929px tall. Probed twice, 2s and 14s after the
 *     run, identical both times: `.execresult hidden:false text:"exit 0"
 *     top:-3974px inView:false` on the corpus that was open then, and
 *     `top:-146,513px` on this fixture. `window.scrollY` stayed 0 throughout,
 *     because the page's scroller is an INNER container.
 *
 *  2. **`ack`'s entire effect was invisible on the row it was run from.** `ack`
 *     sets `Finding.acknowledged`; `read-model.ts` carries the field verbatim
 *     and records that *"the Doctor screen still draws an acknowledged finding,
 *     marked"* and that *"drawing it is the screen's business"*. It was not
 *     done: `screens/doctor.js` and `lib/viewmodel.js` contained zero
 *     occurrences of the word. So the one command 73 of that morning's 74
 *     findings offered wrote a field nothing read.
 *
 * ── WHY THE ASSERTION IS A BOUNDING BOX AND NOT A NODE ────────────────────
 *
 * **The node already existed, and that is precisely the bug.** Three assertions
 * in `e2e/execute.spec.ts` were green throughout, because `toContainText('exit
 * 0')` passes on a node 146,000px above the reader. A test that only asks
 * whether the outcome is IN THE DOM cannot fail on this defect, and did not.
 * Everything below measures where the outcome IS, against the window.
 *
 * ── SCOPE, AND WHAT IS DELIBERATELY NOT REPEATED ──────────────────────────
 *
 * `e2e/doctor-repairless.spec.ts` holds that every finding reaches a control or
 * says why it has none; `test/ui/doctor-screen.test.ts` holds which route earns
 * which control and that the tally and the row read one decision. Neither can
 * hold what the owner saw, which is a rendered page with the answer on it and
 * nowhere near the reader. That only exists in a browser, and only with a real
 * viewport under it.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base, type Page } from '@playwright/test';
import { expect, test, CORPUS } from './app.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { worthCopying } from '../src/ui/execute-effect.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

/** The CLI entry the isolated workspace's own index gets built through. */
const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

const DOCTOR = '[data-p="doctor"]';

/**
 * `Finding` as `/api/doctor` serves it — `doctor-repairless.spec.ts`'s own
 * declaration, plus the field this file is about. `acknowledged` is OPTIONAL on
 * the wire: `runChecks` sets it through `markAcknowledged` only where a person
 * has ruled, so absent and `false` are the same fact and the screen normalises
 * them to one in `cardRows`.
 */
type Remedy =
  | { route: 'run'; command: string; values: Record<string, string | true> }
  | { route: 'copy'; argv: string[] }
  | { route: 'acknowledge' }
  | { route: 'none'; why: 'person' | 'nothing' };

interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  remedy: Remedy;
  item?: string;
  acknowledged?: boolean;
}

/**
 * **Two findings that differ in ONE field**, which is the only way to measure
 * "visibly distinct" without measuring something else by accident. Same level,
 * same code, same remedy, same message shape — so anything that tells them
 * apart on screen can only be the ruling.
 *
 * The code and the message are the real ones `src/doctor/checks.ts` composes
 * for `body_disagrees_with_meta` (abbreviated, not invented — a reworded check
 * then leaves this spec asserting about a message that still exists), and it is
 * the group the owner's own screen was mostly made of: 36 of 74 that morning.
 */
const ONE_RULED_ON: Finding[] = [
  {
    level: 'warn',
    code: 'body_disagrees_with_meta',
    item: 'DEC-nobody-has-ruled-on-this-one',
    remedy: { route: 'acknowledge' },
    message: 'body retracts its own premise. Read the body against the title and the fields; '
      + 'which of the two moves is the owner\'s call.',
  },
  {
    level: 'warn',
    code: 'body_disagrees_with_meta',
    item: 'DEC-a-person-has-ruled-on-this-one',
    remedy: { route: 'acknowledge' },
    acknowledged: true,
    message: 'body retracts its own premise. Read the body against the title and the fields; '
      + 'which of the two moves is the owner\'s call.',
  },
];

/**
 * Serve a fixed findings body and open Doctor on it — `doctor-repairless.spec.ts`'s
 * helper, and its reasoning applies here unchanged: `.demo-corpus` is shared by
 * every spec in this parallel suite and editing acknowledgements into it would
 * rewrite item files underneath them. `/api/doctor` serves `runChecks` verbatim,
 * so fulfilling that route is the endpoint's own body shape and what is under
 * test is the DRAWING of it.
 *
 * **`page.route` survives the reload the language toggle does.** `#lang` writes
 * `localStorage` and calls `location.reload()` (`app.js`), and route handlers
 * are registered on the PAGE rather than on the document, so the Hebrew half of
 * this file measures the same served body as the English half.
 */
async function serveDoctor(page: Page, findings: Finding[]): Promise<void> {
  await page.route('**/api/doctor*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ findings }),
  }));
}

/** Open the Doctor screen and wait for the cards the served body produces. */
async function openDoctor(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/doctor'; });
  await page.locator(`${DOCTOR} .card.pane`).first().waitFor({ timeout: 30_000 });
}

/* ══ THE ACKNOWLEDGED ROW, DRAWN — Fix 2 ═══════════════════════════════════ */

test('an acknowledged finding is visibly distinct from one nobody has ruled on', async ({ app }) => {
  const { page } = app;
  await serveDoctor(page, ONE_RULED_ON);
  await openDoctor(page);

  const rows = page.locator(`${DOCTOR} tbody tr`);
  await expect(
    rows,
    'the served body draws two rows or this test is measuring an empty screen',
  ).toHaveCount(2, { timeout: 30_000 });

  const ruled = rows.filter({ hasText: 'DEC-a-person-has-ruled-on-this-one' });
  const open = rows.filter({ hasText: 'DEC-nobody-has-ruled-on-this-one' });

  // ── IT IS DRAWN, AND IT IS DRAWN ONLY WHERE SOMEBODY RULED. ──
  //
  // Both halves matter and the second is the one that fails silently: a mark on
  // every row says nothing at all, and would pass an assertion that only looked
  // at the acknowledged one.
  const mark = ruled.locator('span.chip.index');
  await expect(
    mark,
    'the acknowledged finding draws no mark. `ack` writes `Finding.acknowledged`, `/api/doctor` '
    + 'serves it and `read-model.ts` says the screen draws it — this is the assertion that the '
    + 'screen actually does',
  ).toBeVisible();
  await expect(
    open.locator('span.chip.index'),
    'a finding nobody has ruled on is wearing the acknowledged mark — a mark on every row is '
    + 'the same silence as a mark on none',
  ).toHaveCount(0);

  // ── IT SAYS WHAT IT IS, AND WHY, THE WAY THIS SCREEN ALREADY DOES. ──
  //
  // The word is the carrier — `styles.css` says so for this exact class: two
  // neutrals "are told apart by the WORD inside the chip", which is what
  // survives print and forced-colors — and the sentence lives in the title, the
  // same split `noRepairChip` and the strip's own state chips use.
  await expect(mark).toHaveText('acknowledged');
  const why = await mark.getAttribute('title');
  expect(why, 'the mark names a state and never explains it').toBeTruthy();
  expect(
    why ?? '',
    'the explanation must carry the ack design\'s load-bearing claim: an acknowledged finding '
    + 'is still reported and still counted. A reader who thinks this is a silencer is reading '
    + 'the screen wrong in the one direction that matters.',
  ).toMatch(/still counted/i);

  // ── AND IT IS A MARK, NOT A FILTER. ──
  //
  // Owner ruling 2026-08-27, argued in `src/core/acknowledge.ts`: *"An
  // acknowledged finding is still computed, still reported, still counted."*
  // Each of these would be a way of quietly turning the mark into a silencer.
  await expect(
    ruled,
    'the acknowledged finding left the list — acknowledging is not filtering',
  ).toHaveCount(1);
  await expect(
    ruled.locator('div.cmd code'),
    'the acknowledged row lost the control it had. The mark takes nothing away from the row; '
    + 'withdrawing a ruling is `ack --clear`, a different command with a different confirm.',
  ).toHaveCount(1);

  const tally = await page.locator(`${DOCTOR} > p.small`).first().innerText();
  expect(tally, 'the finding count was decremented by the ruling — it is the whole run, and the '
    + 'whole run is still two').toMatch(/findings:\s*2/);
  expect(tally, '`yours to settle` counts the rows that CARRY `mycontext ack`, and both of these '
    + 'do. Reducing it by the rulings already made would leave the acknowledged row counted in '
    + 'none of the summary\'s columns while still drawing its control — the summary '
    + 'contradicting the rows underneath it.').toMatch(/settle:\s*2/);
  expect(tally, 'nothing on this screen says how many findings have been ruled on, so acking one '
    + 'moves no number at all — the same silence one level up from the row')
    .toMatch(/already ruled on:\s*1/);
});

/* ══ THE SAME ROW, IN HEBREW ═══════════════════════════════════════════════ */

/**
 * **Both new sentences, in the other language, on the same served body.**
 *
 * `doc.acked` and `title.acked` are new keys and `doc.tally` grew a fourth slot;
 * `test/ui/strings-parity.test.ts` holds the KEY SETS and the SLOT NAMES equal
 * across the two tables, and it cannot hold that the Hebrew page renders them —
 * a key present in both tables and never reached still ships as a blank chip.
 * `e2e/language.spec.ts` records the two ways that has actually gone wrong here
 * before: a badge destroyed by `applyLang`'s `replaceChildren`, and a `title`
 * that stayed English because only the text path was translated. The mark is
 * exactly both shapes at once — a chip whose title is an attribute.
 */
test('the acknowledged mark and the ruling count are drawn in Hebrew too', async ({ app }) => {
  const { page } = app;
  test.setTimeout(90_000);
  await serveDoctor(page, ONE_RULED_ON);
  await openDoctor(page);
  await expect(page.locator(`${DOCTOR} span.chip.index`)).toHaveCount(1);

  // `#lang` writes `localStorage` and reloads (`app.js`), so the page is booted
  // again from the token in `sessionStorage` — waiting on the rail rather than
  // on a timeout keeps this honest on a slow machine.
  await page.click('#lang');
  await expect(
    page.locator('.nav').first(),
    'the page never came back from the language reload',
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await openDoctor(page);

  const mark = page.locator(`${DOCTOR} span.chip.index`);
  await expect(
    mark,
    'the mark is gone in Hebrew, or it multiplied — `applyLang` replaces the children of a '
    + '`data-t` element wholesale, which is how five PROPOSED badges were destroyed once before',
  ).toHaveCount(1);
  const said = (await mark.innerText()).trim();
  expect(said, 'the mark rendered empty in Hebrew — a key in both tables that nothing reaches '
    + 'still ships as a blank chip').not.toBe('');
  expect(said, 'the mark is still English in the Hebrew UI').not.toBe('acknowledged');
  const why = await mark.getAttribute('title');
  expect(why ?? '', 'the title stayed English in the Hebrew UI — an attribute the text path '
    + 'never reaches, which is exactly the defect `language.spec.ts` records')
    .not.toMatch(/still counted/i);
  expect((why ?? '').length, 'the Hebrew mark carries no explanation at all').toBeGreaterThan(20);

  const tally = await page.locator(`${DOCTOR} > p.small`).first().innerText();
  expect(tally, 'the fourth figure left braces on the Hebrew screen, or was not substituted at '
    + 'all — `t()` throws on an unsupplied slot and a slot named only in one table is how that '
    + 'happens').not.toMatch(/[{}]/);
  // Read positionally rather than by its Hebrew label: copying the label into
  // this file would be a second spelling of a string the table already owns,
  // and it would go stale the day the wording is improved. `doc.tally` is five
  // `·`-separated figures in both languages since `a3555c4` added the fifth
  // ("notes about the checks", for `about`-flagged rows like
  // `citation_form_excused`) — `strings-parity` holds the slot NAMES equal
  // across the pair, and this holds the SHAPE equal on screen.
  const figures = tally.split('·').map((part) => part.trim()).filter((part) => part !== '');
  expect(figures.length, `the Hebrew tally rendered as ${figures.length} figure(s), not five — `
    + `"${tally}"`).toBe(5);
  // The ruling count is still the FOURTH figure (index 3) — `acked` sits ahead
  // of the fifth, `notes`, in `doc.tally`'s own slot order.
  expect(figures[3], 'the fourth figure is the ruling count, and it must carry the 1 this served '
    + 'body produces').toMatch(/\b1\b/);
});

/* ══ THE OUTCOME, IN THE VIEWPORT — Fix 1 ══════════════════════════════════ */

/**
 * `mkdtemp`'d and thrown away. **This test RUNS `mycontext ack`, which writes
 * into an item file and re-stamps its checksum**, so it gets its own workspace
 * rather than a promise to restore the shared `.demo-corpus` that every other
 * spec in this parallel suite measures against — `e2e/execute.spec.ts` took the
 * same decision for `pin` and for `review promote`, and carries the full
 * argument for choosing a disposable copy over restoring in place.
 *
 * Reuses `worthCopying` from `src/ui/execute-effect.ts` (skip `.audit` and
 * `.index.db*`) rather than a second filter that could disagree with it, and
 * for the same reason that function needs it: another worker's server may hold
 * `.demo-corpus`'s own `.index.db` open under a mandatory Windows lock.
 */
function makeWriteWorkspace(): { root: string; myContextDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-outcome-'));
  cpSync(CORPUS, root, { recursive: true, filter: worthCopying });
  // `worthCopying` skips `.index.db`, so this workspace has no index yet and
  // every SQLite-backed `/api/*` route would answer `unable to open database
  // file`: the read routes open the index read-only and cannot CREATE it.
  // `rebuild` is the one command whose whole purpose is building it.
  execFileSync(process.execPath, [CLI, 'rebuild'], {
    cwd: root, encoding: 'utf8', stdio: 'pipe',
  });
  return { root, myContextDir: path.join(root, DIR_NAME) };
}

/**
 * **THE ASSERTION THIS FILE EXISTS FOR.** A run started from a row far down a
 * very tall pane reports its exit code WHERE THE PERSON WHO PRESSED THE BUTTON
 * IS, and the row it was run from shows what the run did to it.
 *
 * Everything here is real: a real corpus, the real doctor, a real confirm minted
 * by the real GET, a real `mycontext ack` writing a real item file. Nothing is
 * served, because the two things under test are a LAYOUT (which needs the real
 * 166,929px pane the real corpus produces) and a WRITE LANDING (which needs a
 * command that actually ran).
 *
 * **Three preconditions are asserted as states rather than assumed**, because
 * each of them failing silently would leave the assertions below passing over a
 * screen that never reached the condition the defect needs:
 *
 *   - the pane is taller than the window, or "off-screen" has no meaning;
 *   - the reader is scrolled well down it, or the top of the section is in view
 *     anyway and the old behaviour would pass;
 *   - the chosen row is NOT already acknowledged, or the mark this asserts was
 *     there before the run. `.demo-corpus` carries two acknowledgements of its
 *     own, measured 2026-09-03, so this is a live hazard rather than a
 *     theoretical one.
 */
base('the outcome of a run lands in the viewport, on the row it was run from', async ({ page }) => {
  base.setTimeout(300_000);
  const workspace = makeWriteWorkspace();
  let harness: UiHarness | undefined;
  try {
    harness = await startUiChild(workspace.root);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the isolated server never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });

    // **Doctor is reached by LOADING it, not by changing the hash out from
    // under the screen that is still booting — and that is a defect this test
    // is routing around rather than a preference. It is reported as
    // `app.js`'s route race; see below.**
    //
    // `route()` opens with `teardownLiveScreen()` and ends with
    // `setupLiveScreen(name, mod, section)`, which writes `currentScreenRefresh`
    // — the closure `noteExecuteSettled` calls to redraw the screen a run was
    // made on. There is no generation guard between the two, so when a hash
    // change starts a SECOND route while the boot route is still rendering,
    // whichever screen finishes LAST wins the slot. Measured here 2026-09-03
    // over `page.evaluate(location.hash = '#/doctor')`: Doctor is one `/api/doctor`
    // and the landing preview is five sequential fetches, so preview always
    // finished second, and the run's refresh then re-rendered PREVIEW — the
    // network log after `POST /api/execute` was `select`, `simulate`, `items`,
    // `coverage`, `injection-history` and not one `doctor`. Doctor never
    // refetched, so the ruling this test asserts was on disk, in the index and
    // in the read model (all three verified directly) and no request ever asked
    // for it.
    //
    // A reload lands on `#/doctor` with one route and no second screen to lose
    // to, which is also how a person reaches this screen from a bookmark. The
    // token is claimed by the nonce above and survives the reload — the
    // language toggle already relies on that, it calls `location.reload()`.
    //
    // **What this deliberately does NOT do is assert the race away.** The race
    // is real, it is not Doctor's, and it costs any reader who clicks a rail
    // button while the landing screen is still loading their next Execute's
    // redraw. It wants its own fix in `app.js` and its own test; this file is
    // about where an outcome lands.
    await page.goto(`http://127.0.0.1:${h.port}/#/doctor`);
    await page.reload();
    // A row-scoped control is a `.cmdactions` inside a `<td>`: the ack that
    // answers for ONE finding, as opposed to a shared repair appended under the
    // card. Waiting on one is how this test knows the screen is drawn.
    const rowActions = page.locator(`${DOCTOR} td .cmdactions`);
    await expect(
      rowActions.first(),
      'the Doctor screen drew no row-scoped control at all — this corpus may have no finding '
      + 'whose remedy is `acknowledge`, which `mycontext doctor` would say',
    ).toBeVisible({ timeout: 60_000 });

    // ── PRECONDITION 1: the pane is taller than the window. ──
    const geometry = await page.evaluate(() => {
      const host = document.getElementById('screen')!;
      return { scrollHeight: host.scrollHeight, clientHeight: host.clientHeight };
    });
    expect(
      geometry.scrollHeight - geometry.clientHeight,
      `the Doctor pane is only ${geometry.scrollHeight}px inside a ${geometry.clientHeight}px `
      + 'window, so nothing can be rendered off-screen and this test cannot measure the defect '
      + 'it is about. Measured on `.demo-corpus` 2026-09-03: 166,929px.',
    ).toBeGreaterThan(2_000);

    // ── PRECONDITION 3, taken before the target is chosen: a row nobody has
    // ruled on. `.demo-corpus` ships two acknowledgements of its own.
    const unruled = page.locator(`${DOCTOR} tbody tr`)
      .filter({ has: page.locator('td .cmdactions') })
      .filter({ hasNot: page.locator('span.chip.index') });
    await expect(
      unruled.first(),
      'every settleable finding in this corpus is already acknowledged, so this test cannot '
      + 'watch a ruling land',
    ).toBeVisible({ timeout: 30_000 });
    // ── THE TARGET, AND IT IS NAMED BY WHAT IT IS RATHER THAN BY WHERE IT SAT.
    //
    // **`unruled.last()` cannot be carried across the run, because the run is
    // the act that empties it.** `unruled` is a live locator whose filter is
    // `hasNot: span.chip.index`, and `mycontext ack` puts exactly that chip on
    // the row. So `unruled.last()` names one row before "Run it" and a
    // DIFFERENT one after it, and assertion 4 below — "the row now carries the
    // chip" — was unsatisfiable by construction against a locator defined to
    // exclude every row that carries one. Measured: it failed as `element(s)
    // not found` over a ruling that had landed perfectly.
    //
    // **The identity used instead is `data-cmdkey`, which is the product's own
    // answer to this same question.** `commandActions` stamps the composed line
    // on the control and on the result region so `attachExecuteOutcome` can put
    // an outcome back on its row after the redraw that run causes; a test that
    // needs to find the same row after the same redraw has no better key and
    // inventing a second one would be inventing a second answer. It survives
    // the ack on the screen's own recorded ruling — an acknowledged row keeps
    // its ack control, "the mark is a mark, not a filter" (`screens/doctor.js`,
    // and assertion 4b pins it). An `.nth()` would not survive it either, so an
    // index is not the smaller change here; it is the same bug with a longer
    // fuse.
    //
    // **And the key must name ONE row, which is not free on this screen.**
    // `mycontext ack <id> <code>` answers for an item and a CODE, and one item
    // can raise one code several times: measured on `.demo-corpus` 2026-09-03,
    // `TASK-wire-the-retry-budget-to-the-config` raises
    // `tag_projection_unprojected` three times, once per unprojected tag, and
    // all three rows compose the identical line. That is not a defect — `ack`
    // rules on the finding, and `app.js`'s `executeOutcomeHome` documents the
    // shared-key case as imprecise-but-safe — but it is a row this test cannot
    // measure, because "the outcome is ON THE ROW IT WAS RUN FROM" has no
    // single answer when three rows are the same row as far as the command is
    // concerned. So the target is the LAST unruled row whose key is its own.
    // Still the last, for the reason it was always the last: the further down
    // the pane the reader is, the further the old behaviour put the answer.
    const settleable = await page.locator(`${DOCTOR} tbody tr`).evaluateAll((rows) => rows
      .map((tr) => ({
        key: tr.querySelector('td .cmdactions')?.getAttribute('data-cmdkey') ?? null,
        ruled: tr.querySelector('span.chip.index') !== null,
      }))
      .filter((r): r is { key: string; ruled: boolean } => r.key !== null));
    const tally = new Map<string, number>();
    for (const r of settleable) tally.set(r.key, (tally.get(r.key) ?? 0) + 1);
    const alone = settleable.filter((r) => !r.ruled && tally.get(r.key) === 1);
    expect(
      alone.length,
      'every unruled settleable finding on this screen shares its command with another row, so '
      + 'no single row can be watched taking a ruling of its own. Measured on `.demo-corpus` '
      + '2026-09-03: 72 settleable rows, and the repeats are all `tag_projection_unprojected`, '
      + 'one row per unprojected tag of the same item.',
    ).toBeGreaterThan(0);
    const command = alone[alone.length - 1]!.key;
    expect(command, 'the chosen row does not compose a command').toMatch(/^mycontext ack /);
    // A `data-cmdkey` is an argv of ids and codes — no quote and no backslash
    // has ever appeared in one — so it goes into the attribute selector as
    // written. The count below is what would report it if that ever changed.
    const row = page.locator(`${DOCTOR} tbody tr`)
      .filter({ has: page.locator(`td .cmdactions[data-cmdkey="${command}"]`) });
    await expect(
      row,
      'the key chosen precisely because it named one row named a different number of them',
    ).toHaveCount(1);
    const actions = row.locator('td .cmdactions');

    await row.scrollIntoViewIfNeeded();

    // ── PRECONDITION 2: the reader is a long way down. ──
    const readerAt = await page.evaluate(() => document.getElementById('screen')!.scrollTop);
    expect(
      readerAt,
      'the reader is at the top of the screen, where the section\'s own first child is visible '
      + 'anyway — the defect only exists for a reader who is somewhere else',
    ).toBeGreaterThan(1_000);

    // ── THE RUN. ──
    await actions.getByRole('button', { name: 'Execute', exact: true }).click();
    // The confirm GET is not a lookup: it derives the effect by copying the
    // whole corpus to a scratch directory and running the command there
    // (`src/ui/execute-effect.ts`). Measured on `.demo-corpus` at 5.1s / 6.4s /
    // 7.3s for `review promote-revision`, and `ack` re-runs every doctor check
    // on top of that — so this budget is a server round trip, not a repaint.
    //
    // **Scoped to `actions` — the row's OWN control — and not to the screen.**
    // `commandActions` appends the Execute button, the `div.confirm` and the
    // `div.execresult` as siblings of one `.cmdactions` root, so the confirm
    // this click opened is the one inside the control that was clicked and
    // there is exactly one of it. A screen-wide `div.confirm` plus `.first()`
    // used to be unambiguous because Doctor drew a handful; since 71 of 72
    // findings gained a per-row `mycontext ack` it resolves in DOM order to
    // some other row's confirm, which is built hidden and stays hidden — 239
    // polls against a hidden node while the real confirm was open below it.
    // Neither `.last()` nor an index replaces it: the row this test drives is
    // chosen at runtime by `unruled.last()`, so only the row itself names it.
    const confirm = actions.locator('div.confirm');
    await confirm.waitFor({ state: 'visible', timeout: 120_000 });
    await expect(
      confirm.locator('div.cmd code'),
      'the confirm must show the exact argv this row is about to run',
    ).toHaveText(command);
    await confirm.getByRole('button', { name: 'Run it', exact: true }).click();

    // ── 1. THE RUN HAPPENED, AND THE ANSWER IS ON SCREEN. ──
    //
    // Filtered by TEXT rather than scoped to a direct child of the section:
    // where the outcome lands is the whole question this test asks, so a
    // selector that encodes one placement would assert the answer instead of
    // measuring it. Every control on the screen brings its own empty, hidden
    // `.execresult`; exactly one of them carries an exit code.
    const outcome = page.locator(`${DOCTOR} .execresult`).filter({ hasText: 'exit 0' });
    await expect(
      outcome,
      'the run reported no clean exit. `ack` records a ruling and changes nothing else, so a '
      + 'non-zero exit here is a refusal worth reading rather than a flake.',
    ).toHaveCount(1, { timeout: 120_000 });

    // ── 2. AND IT IS IN THE VIEWPORT. THIS IS THE DEFECT. ──
    //
    // A bounding box, never a node: the node existed throughout the defect, at
    // `top: -146,513px`, and three assertions elsewhere in this suite were green
    // over it for exactly that reason.
    const box = await outcome.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return {
        top: Math.round(r.top), height: Math.round(r.height),
        windowHeight: window.innerHeight, windowScrollY: window.scrollY,
        hostScrollTop: Math.round(document.getElementById('screen')!.scrollTop),
        inView: r.bottom > 0 && r.top < window.innerHeight && r.height > 0,
      };
    });
    expect(
      box,
      `the outcome is at top:${box.top} in a ${box.windowHeight}px window — the run worked and `
      + 'the reader was never shown it. Note `windowScrollY` is 0: the scroller is `#screen`, '
      + 'so nothing written against the window would have moved it.',
    ).toMatchObject({ inView: true });
    await expect(
      outcome,
      'the outcome is in the DOM and out of the window',
    ).toBeInViewport();

    // ── 3. AND IT IS ON THE ROW IT WAS RUN FROM, not parked at the top. ──
    //
    // Both are in view once the shell scrolls to the outcome, so "in view" alone
    // cannot tell them apart — and the row is where the confirm rendered, which
    // is the precedent this fix follows.
    await expect(
      page.locator(`${DOCTOR} > .execresult`),
      'the outcome was prepended to the top of the section. That is the FALLBACK, for a run '
      + 'that removed the row it was run from; this row is still here, so the answer belongs '
      + 'beside the button that asked for it.',
    ).toHaveCount(0);
    await expect(
      row.locator('.execresult').filter({ hasText: 'exit 0' }),
      'the exit code is not on the row it was run from',
    ).toHaveCount(1);

    // ── 4. AND THE ROW SHOWS WHAT THE RUN DID TO IT. ──
    //
    // The second half of the report, end to end and with nothing served: `ack`
    // wrote `acknowledged` into the item file, `runChecks` read it back through
    // `markAcknowledged`, `/api/doctor` served it on the refresh the run itself
    // caused, and the row drew it. Before this, all four of those happened and
    // the last one did not.
    await expect(
      row.locator('span.chip.index'),
      'the ruling landed and the row still looks exactly as it did before it. This is the '
      + 'owner\'s report in its second form: the command ran, the field was written, and the '
      + 'screen redrew identically.',
    ).toBeVisible({ timeout: 120_000 });
    await expect(
      row.locator('div.cmd code'),
      'the acknowledged row lost its control — the mark is a mark, not a filter',
    ).toHaveCount(1);

    // And the summary moved with it, which is the number that was missing: on
    // this corpus acking a finding used to change no figure on the screen.
    await expect(
      page.locator(`${DOCTOR} > p.small`).first(),
      'nothing in the tally counts the rulings, so a ruling moves no number at all',
    ).toContainText('already ruled on:', { timeout: 30_000 });
  } finally {
    if (harness !== undefined) await harness.stop();
    // Best-effort: a Windows SQLite handle can outlive the child's own `exit`
    // event by a beat, and a failed cleanup of a disposable temp directory is
    // not a reason to fail an assertion that already passed.
    try { rmSync(workspace.root, { recursive: true, force: true }); } catch { /* see above */ }
  }
});
