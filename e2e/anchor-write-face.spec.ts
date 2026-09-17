// @basis TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the,
// TASK-every-write-on-conversations-throws-focus-to-the-document,
// TASK-take-it-back-deletes-immediately-with-no-confirm-no-undo-and,
// TASK-the-anchor-write-routes-answer-indexed-false-and-no-client,
// TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and,
// INV-nothing-is-dropped-silently,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **WHAT THE FOUR ANCHOR WRITES DO AFTERWARDS**, driven in a browser — where
 * the caret lands, what is announced, whether there is a way back, and whether
 * the screen read the answer the server actually sent.
 *
 * The three items this file rests on are three halves of one question, which
 * is why they are driven in one fixture rather than three: *does a write on
 * this screen tell you it landed?* `conversations.spec.ts` and
 * `anchors.spec.ts` drive the same seven capabilities and assert the ROW
 * afterwards; not one of them looks at `document.activeElement`, at a live
 * region that outlives the row it described, or at a `200` whose body says the
 * write did not happen.
 *
 * ── WHY EACH ASSERTION NEEDS A BROWSER AND NOT A UNIT TEST ────────────────
 *
 *   - **Focus is a property of a live document.** "The row was replaced" is a
 *     DOM fact a unit test can hold; "and the caret fell to `document.body`,
 *     twenty-four stops from where the reader was" is a fact about the
 *     browser's focus model at the moment a subtree containing the focused
 *     node was torn out. Nothing short of a real focus ring can say it.
 *   - **An `aria-live` region announces only if it was in the document BEFORE
 *     its text changed.** A region built at the moment of the write, inside
 *     the subtree the write destroys, is silent in a way no assertion about
 *     its `textContent` can see. So the assertions below are about WHERE the
 *     region lives and whether it survives the redraw.
 *   - **The refusals are only reachable from the wire.** A `200` carrying
 *     `indexed: false` is what a workspace with no archive answers, and the
 *     screen cannot be made to produce one from the inside. `page.route`
 *     fulfils the three refusal shapes the routes really send, which is the
 *     only instrument that can ask "does the client read this field".
 *
 * ── THE FIXTURE, AND THE ONE THING IT HAS TO HOLD ─────────────────────────
 *
 * Anchors of BOTH origins, because the whole proportionality ruling turns on
 * the difference: the automatic pass reads back every `origin: 'automatic'`
 * row and never reads an `origin: 'owner'` one, so a point marked for you
 * comes back by itself and a point you marked never does. The `owner` rows
 * arrive through `.my_context/.anchors.jsonl` — "the one durable copy of the
 * bookmarks and the truth the `anchors` table is rebuilt from" — and the
 * `automatic` ones arrive the way a reader's really do: a table turn and a
 * ruling turn in the transcript, marked by `conversation rebuild`'s own pass.
 *
 * Per `e2e/app.ts`' case 2: a spec that needs ONE SPECIFIC STATE arranges it
 * in a workspace of its own and serves THAT.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';
import { writeAnchorFile } from '../src/core/anchor-file.ts';
import { anchorIdFor } from '../src/core/anchors.ts';

/**
 * **THESE TESTS SHARE ONE STORE, SO THEY MUST NOT RUN AT ONCE.**
 *
 * Every test in this file drives ONE workspace and ONE server, built once in
 * `beforeAll`, and almost every one of them WRITES an anchor. The project sets
 * `fullyParallel: true`, which parallelises tests inside a file as well as
 * across files — so fourteen tests were mutating one `.anchors.jsonl` and one
 * index concurrently.
 *
 * Measured 2026-09-14, this file alone at `--workers=2`, three runs back to
 * back: 2 failed, then 1 failed, then 14 passed — and a DIFFERENT test each
 * time (`:426`, `:539`, then `:479`). Every one of them passes alone. That
 * signature is a data race between tests, not a slow machine.
 *
 * **This is not the contention the config warns against hiding.**
 * `e2e/playwright.config.ts` deliberately refuses to lower `workers` to mask a
 * saturated box, and that reasoning stands and is untouched — this file still
 * runs in parallel with every OTHER spec, and the worker count is unchanged.
 * What is serialised is only the set of tests that share one mutable store,
 * which is a correctness property of this fixture and not a performance dial.
 *
 * `mode: default` rather than `serial` on purpose: serial SKIPS the rest of
 * the file after a failure, which would turn one red into thirteen silences —
 * the opposite of what this suite is for.
 *
 * The durable fix is a store per test, or a distinct point per test. The
 * second is already required here for another reason, recorded at the
 * document-side test below.
 */
test.describe.configure({ mode: 'default' });
const SESSION = 'sess-writes';
/** In the transcript, in no label — the words a search hit is found by. */
const PROSE = 'the weather in the afternoon was ordinary and worth nothing';
const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';
const TABLE_HEADER = 'tokenizer';
/**
 * Past `BOUND_CAP_LIST` (20) by enough that the list is genuinely paged, so a
 * focus assertion is made on a screen with a bound line under it rather than
 * on a short list where nothing was ever held back.
 */
const OWNED = 24;

const TABLE_TURN = [
  'Here is what was measured.',
  '',
  '| tokenizer | hits |',
  '| --- | --- |',
  '| trigram | 14 |',
].join('\n');

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

/**
 * Filler, for `anchors.spec.ts`' stated reason: the document is virtualised
 * and opens at its end, so a turn worth marking has to be reachable through
 * the document's own find box rather than by scrolling a test.
 */
const FILLER = Array.from({ length: 30 }, (_, i) => say(
  'assistant',
  `Filler turn number ${i} carries no table, no pipe and no normative id, so nothing in it `
  + 'is a point by nature and the automatic pass leaves it alone.',
  '2026-09-10T09:10:00.000Z',
));

const TURNS = [
  say('user', `follow ${RULING} here`, '2026-09-10T09:00:00.000Z'),
  say('assistant', TABLE_TURN, '2026-09-10T09:00:01.000Z'),
  say('assistant', PROSE, '2026-09-10T09:00:02.000Z'),
  ...FILLER,
];

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-write-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-write-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(TURNS));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // The hand-marked rows go into the file that is the truth; the second
    // rebuild re-derives the table from it and runs the automatic pass again,
    // which re-marks the table and the ruling and never reads these.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      Array.from({ length: OWNED }, (_, i) => ({
        /**
         * **THE ID IS DERIVED, because in this product it always is.**
         *
         * This read `owned0000`…`owned0023` until 2026-09-14, and
         * `writeAnchorFile` takes whatever id it is handed. Nothing the
         * product can do produces such a row: `markAnchor` composes
         * `anchorIdFor(sessionId, agentId, byteOffset)` — "the reason marking
         * the same point twice is one row rather than two" — and a relabel IS
         * `markAnchor` at the same point.
         *
         * So a rename of one of those rows wrote a SECOND row at the derived
         * id and left the hand-written one standing: measured in the browser
         * on a copy of this fixture, 26 marked points became 27, with
         * `owned0015` ("a point I kept 15") and `sess-…:-:100480` ("a name
         * that DID land") both in the list at the same byte. Every assertion
         * in this file finds its row by LABEL, so not one of them could see it.
         */
        id: anchorIdFor(SESSION, null, 100_000 + i * 32),
        sessionId: SESSION,
        agentId: null,
        byteOffset: 100_000 + i * 32,
        label: `a point I kept ${String(i).padStart(2, '0')}`,
        kind: 'note',
        origin: 'owner' as const,
        at: new Date(Date.UTC(2026, 8, 8, 9, 0, i)).toISOString(),
        note: null,
      })));
    runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally {
    process.chdir(previous);
  }
  harness = await startUiChild(cwd);
});

test.afterAll(async () => {
  await harness?.stop();
  delete process.env['CLAUDE_CONFIG_DIR'];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
});

async function open(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
  /*
   * **THERE IS DELIBERATELY NO `#exited` ASSERTION HERE**, and that is a
   * measurement rather than an oversight.
   *
   * `anchors.spec.ts` and `anchors-paged.spec.ts` each assert it inside their
   * own `open()`, for a good reason they both state: an overlay raised
   * mid-test intercepts every click below it, so naming it gives a legible
   * error instead of a mysterious one. Measured here on GREEN code, across
   * nine runs of this file, that assertion failed on its own in five tests it
   * had nothing to do with — at the boot placement and again after the
   * content — because `#exited` is raised by any request that outruns the
   * nonce exchange or a heartbeat tick that loses a race under load, and
   * `request()` takes it down again on the next `response.ok`.
   *
   * The argument the other two files make is what settles it: an overlay
   * really up still fails everything below, so nothing is lost by not
   * duplicating the claim — and what a false one COSTS is a red on this file
   * attributed to the write flows, which are exactly what it exists to
   * measure. The flakiness itself is reported as an open finding rather than
   * fixed here; it is a property of the shell's boot, not of these writes.
   */
}

/**
 * **WHERE THE CARET IS, AND WHAT IT COSTS TO GET BACK.**
 *
 * `landed` is what `document.activeElement` actually is, named the way a
 * reader would name it. `stopsBack` is the item's own unit: how many tab stops
 * a keyboard reader presses to reach `want` FROM WHERE THEY NOW ARE. It counts
 * the rendered, focusable, non-negative-tabindex elements between the two in
 * document order, which is the tab order for a page that sets no positive
 * `tabindex` — and this app sets none.
 *
 * `-1` means `want` is not focusable at all, which is itself an answer: a
 * reader cannot walk back to a control the write removed.
 */
async function focusCost(page: Page, want: { sel: string; inRowNamed?: string }): Promise<{
  landed: string; stopsBack: number; sameElement: boolean;
}> {
  return await page.evaluate((ask) => {
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), '
      + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const shown = (n: Element): boolean => (n as HTMLElement).offsetParent !== null
      || getComputedStyle(n).position === 'fixed';
    const order = [...document.querySelectorAll(FOCUSABLE)].filter(shown);
    const active = document.activeElement;
    // A row is found by the name on it, because that is how a reader finds it
    // — and `:text-is()` is Playwright's, not the browser's.
    let within: ParentNode = document;
    if (ask.inRowNamed !== undefined) {
      const row = [...document.querySelectorAll('.convanchor')].find(
        (r) => (r.querySelector('.convanchorlabel')?.textContent ?? '') === ask.inRowNamed);
      if (row === undefined) return { landed: 'no such row', stopsBack: -1, sameElement: false };
      within = row;
    }
    const target = within.querySelector(ask.sel);
    const name = (n: Element | null): string => {
      if (n === null) return 'null';
      if (n === document.body) return 'BODY';
      const cls = n.className === '' ? '' : `.${String(n.className).split(' ').join('.')}`;
      return `${n.tagName.toLowerCase()}${cls}`;
    };
    const from = active === null ? -1 : order.indexOf(active);
    const to = target === null ? -1 : order.indexOf(target);
    return {
      landed: name(active),
      // From the body (or from anything outside the tab order) the walk starts
      // at the top of the document, which is the item's own reading of it.
      stopsBack: to === -1 ? -1 : Math.abs(to - (from === -1 ? 0 : from)),
      sameElement: active !== null && active === target,
    };
  }, want);
}

/** The row of the list whose label is exactly `label`. */
function rowOf(page: Page, label: string) {
  return page.locator('.convanchor').filter({ hasText: label }).first();
}

/* ══ confirm/1 — WHERE THE CARET GOES AFTER EACH WRITE ════════════════════ */


/**
 * Type into the find box, opening the panel it lives in first.
 *
 * **`semantic/15` TOOK THE BOX OFF THE CARD.** It was a `.tvbar` control until
 * 2026-09-17; the owner asked for the controls to leave the card, and `/`
 * still opens the panel the box is in and lands the caret in it — which is the
 * route a reader takes and therefore the route this takes.
 */
async function findInDoc(page: Page, query: string): Promise<void> {
  if (await page.locator('dialog.mcpanel[data-panel="search"][open]').count() === 0) {
    await page.locator('.tvscroll').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(page.locator('dialog.mcpanel[data-panel="search"][open]'))
      .toHaveCount(1, { timeout: 10_000 });
  }
  await page.locator('dialog.mcpanel[data-panel="search"] .tvfind').fill(query);
  /*
   * **AND THE PANEL IS SHUT AGAIN**, because every assertion in this file acts
   * on a ROW in the well and a panel floating over it intercepts the pointer:
   * measured, `.tvnavfoundplace` inside the open dialog swallowed the click
   * aimed at a turn's own Mark button. Filtering is a thing a reader does and
   * then leaves; the query survives the close, which is the whole point of the
   * box having one home.
   */
  await page.locator('dialog.mcpanel[data-panel="search"] .mcpanelclose').click();
  await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
}

test('renaming a marked point leaves the caret on the row, not at the top of the page', async ({ page }) => {
  await open(page);
  const row = rowOf(page, 'a point I kept 23');
  await expect(row).toBeVisible({ timeout: 20_000 });

  await row.locator('.convanchorrename').click();
  await row.locator('.convanchorrenameinput').fill('renamed by the keyboard');
  // Enter in the one field, which is the keyboard path — `labelWrite`'s rule 4.
  await row.locator('.convanchorrenameinput').press('Enter');
  await expect(page.locator('.convanchor').filter({ hasText: 'renamed by the keyboard' }))
    .toHaveCount(1, { timeout: 20_000 });

  const cost = await focusCost(page,
    { inRowNamed: 'renamed by the keyboard', sel: '.convanchorrename' });
  console.log(`[confirm/1 rename] landed=${cost.landed} stopsBack=${cost.stopsBack}`);
  expect(cost.landed, 'the write threw the caret to the document body').not.toBe('BODY');
  expect(cost.sameElement,
    'the caret is not on the control the reader was using when the write landed').toBe(true);
  expect(cost.stopsBack, 'the reader has to walk back to where they were').toBe(0);
});

test('taking a point back leaves the caret beside the list, not at the top of the page', async ({ page }) => {
  await open(page);
  const row = rowOf(page, 'a point I kept 22');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator('.convanchordrop').click();
  await expect(page.locator('.convanchor').filter({ hasText: 'a point I kept 22' }))
    .toHaveCount(0, { timeout: 20_000 });

  const cost = await focusCost(page, { sel: '.convanchsaid .convanchputback' });
  console.log(`[confirm/1 drop] landed=${cost.landed} stopsBack=${cost.stopsBack}`);
  expect(cost.landed, 'the write threw the caret to the document body').not.toBe('BODY');
  expect(cost.sameElement,
    'the caret did not land on the way back the screen just offered').toBe(true);
});

test('marking a search hit leaves the caret on the row that changed', async ({ page }) => {
  await open(page);
  await page.locator('.convarchq').fill('afternoon');
  const hit = page.locator('.convhit').first();
  await expect(hit).toBeVisible({ timeout: 20_000 });
  await hit.locator('.convhitmarkbtn').click();
  await hit.locator('.convmarklabel').fill('marked with the keyboard');
  await hit.locator('.convmarklabel').press('Enter');
  await expect(hit.locator('.convhitmarked')).toBeVisible({ timeout: 20_000 });

  const cost = await focusCost(page, { sel: '.convhit .convhitmarked' });
  console.log(`[confirm/1 mark] landed=${cost.landed} stopsBack=${cost.stopsBack}`);
  expect(cost.landed, 'the write threw the caret to the document body').not.toBe('BODY');
  expect(cost.landed, 'the caret did not land on what replaced the control')
    .toContain('convhitmarked');
});

/* ══ confirm/2 — THE ONE IRREVERSIBLE ACT, IN PROPORTION ══════════════════ */

test('taking back a point you marked yourself is announced, and can be put back', async ({ page }) => {
  await open(page);
  const row = rowOf(page, 'a point I kept 21');
  await expect(row).toBeVisible({ timeout: 20_000 });

  // **NO DIALOG BEFORE THE ACT** — the owner's ruling of 2026-09-11 stands.
  // One click takes it back, and `page.on('dialog')` would fire on a confirm
  // that this asserts does not exist.
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs += 1; void d.dismiss(); });
  await row.locator('.convanchordrop').click();
  await expect(page.locator('.convanchor').filter({ hasText: 'a point I kept 21' }))
    .toHaveCount(0, { timeout: 20_000 });
  expect(dialogs, 'a bookmark grew a confirm dialog, which the ruling forbids').toBe(0);

  // **AND IT IS SAID, in a region that outlived the row it describes.** The
  // announcement used to live inside the row, so the redraw that removed the
  // row removed the sentence about it before anything could read it.
  const said = page.locator('.convanchsaid');
  await expect(said).toBeVisible();
  await expect(said, 'nothing said what happened').toContainText('Taken back');
  await expect(said, 'the screen does not say which point it was')
    .toContainText('a point I kept 21');
  await expect(said, 'the reader is not told this one never comes back by itself')
    .toContainText('never');

  // **THE WAY BACK.** The same point, at the same byte, under the same name.
  await said.locator('.convanchputback').click();
  await expect(page.locator('.convanchor').filter({ hasText: 'a point I kept 21' }))
    .toHaveCount(1, { timeout: 20_000 });
  await expect(said, 'putting it back is not confirmed either').toContainText('Put back');
  await page.screenshot({ path: 'e2e/screens/anchor-taken-back-owned.png', fullPage: true });
});

test('taking back a point marked for you names the pass, and offers no way back it does not need', async ({ page }) => {
  await open(page);
  const row = rowOf(page, TABLE_HEADER);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator('.convanchororigin')).toHaveText('marked for you');
  await row.locator('.convanchordrop').click();
  await expect(page.locator('.convanchor').filter({ hasText: TABLE_HEADER }))
    .toHaveCount(0, { timeout: 20_000 });

  const said = page.locator('.convanchsaid');
  await expect(said).toContainText('Taken back');
  // The route back for this class already exists on this card and is named
  // rather than duplicated: the pass marks it again, and the button that runs
  // the pass is four lines above.
  await expect(said, 'the reader is not told this one comes back by itself')
    .toContainText('marks it again');
  await expect(said.locator('.convanchputback'),
    'a point the pass regenerates was given an undo that would re-file it as a note of '
    + 'yours — a button that does not do what it says').toHaveCount(0);
  await page.screenshot({ path: 'e2e/screens/anchor-taken-back-automatic.png', fullPage: true });

  // Put the fixture back the way the other tests expect it.
  await page.locator('.convanchsweep').click();
  await expect(page.locator('.convanchor').filter({ hasText: TABLE_HEADER }))
    .toHaveCount(1, { timeout: 30_000 });
});

/* ══ confirm/4 — THE ANSWER THE SERVER SENT, READ ═════════════════════════ */

test('a rename the server says did not happen is not drawn as "Renamed"', async ({ page }) => {
  await open(page);
  // The shape `apiAnchorRelabel` really answers in a workspace whose archive
  // has never been built: `200 { indexed: false }`, which is a state and not a
  // failure — so `post()` does not throw and the client has to read it.
  await page.route('**/api/conversations/anchors/relabel', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        indexed: false,
        error: 'Nothing is indexed in this workspace yet, so there is nothing to mark.',
      }),
    });
  });

  const row = rowOf(page, 'a point I kept 20');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator('.convanchorrename').click();
  await row.locator('.convanchorrenameinput').fill('a name that did not land');
  await row.locator('.convanchorrenamesave').click();

  const said = row.locator('.convanchorsaid');
  await expect(said).toBeVisible({ timeout: 20_000 });
  await expect(said, 'the screen drew a confirmation for a write the server refused')
    .not.toContainText('Renamed');
  /**
   * **THE SENTENCE FOR THIS ANSWER AND NOT MERELY "a refusal happened"** —
   * found by the removal proof, which is the only reason it says this.
   *
   * The first draft asserted `Not saved`, and deleting the `indexed === false`
   * branch left all ten tests GREEN: with that line gone the answer falls
   * through to the `anchor === null` test, `{ indexed: false }` carries no
   * `anchor` either, and the screen refuses anyway — in the WRONG WORDS. A
   * refusal that names the wrong cause is the reader being told to reload a
   * screen when what they actually need is to build the archive. So the
   * assertion names the cause, and the negative below is what makes the
   * removal visible.
   */
  await expect(said, 'nothing told the reader the write did not land')
    .toContainText('no archive index yet');
  await expect(said, 'the refusal names the wrong cause — this is the never-built archive, '
    + 'not a row that could not be read back').not.toContainText('could not be read back');
  // And the row still says what is stored, rather than what was typed.
  await expect(row.locator('.convanchorlabel')).toHaveText('a point I kept 20');
});

test('a rename whose row cannot be read back is not drawn as "Renamed"', async ({ page }) => {
  await open(page);
  // The second answer nobody read: a success envelope around an absent result.
  await page.route('**/api/conversations/anchors/relabel', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ indexed: true, anchor: null, tookOwnership: false }),
    });
  });

  const row = rowOf(page, 'a point I kept 19');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator('.convanchorrename').click();
  await row.locator('.convanchorrenameinput').fill('a name with no row behind it');
  await row.locator('.convanchorrenamesave').click();

  const said = row.locator('.convanchorsaid');
  await expect(said).toBeVisible({ timeout: 20_000 });
  await expect(said, 'a success envelope around an absent result was drawn as a success')
    .not.toContainText('Renamed');
  await expect(said).toContainText('could not be read back');
});

test('a take-back the server says removed nothing is not announced as a removal', async ({ page }) => {
  await open(page);
  // `dropped: false` is the answer a second click on a stale list produces —
  // an answer, not a failure, and not a removal either.
  await page.route('**/api/conversations/anchors/drop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ indexed: true, dropped: false }),
    });
  });

  const row = rowOf(page, 'a point I kept 18');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator('.convanchordrop').click();

  const said = row.locator('.convanchorsaid');
  await expect(said).toBeVisible({ timeout: 20_000 });
  await expect(said, 'the screen announced a removal the server says did not happen')
    .toContainText('already gone');
  await expect(page.locator('.convanchsaid .convanchputback'),
    'a way back was offered for a point nothing took away').toHaveCount(0);
  // The row is still there, because nothing was removed.
  await expect(page.locator('.convanchor').filter({ hasText: 'a point I kept 18' }))
    .toHaveCount(1);
});

/* ══ THE DOCUMENT'S OWN CONTROL, WHICH IS THE SAME THREE WRITES ═══════════ */

test('a write inside the document leaves the caret on the row, and a take-back is announced there too', async ({ page }) => {
  await open(page);
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  /**
   * **A turn NOTHING ELSE IN THIS FILE MARKS, and that is the point.**
   *
   * This test used to reach for the PROSE turn — but
   * `marking a search hit leaves the caret on the row that changed`, above,
   * searches `afternoon` and marks the FIRST hit, which is that same turn.
   * The file shares one workspace and one server across all its tests, so by
   * the time this one runs the point is already taken, `.tvanchormark` is
   * not drawn, and the fill on the next line has nothing to fill.
   *
   * Measured 2026-09-14: this test PASSES ALONE and FAILS IN ITS OWN FILE at
   * both --workers=1 and --workers=2, and the failing pair differed between
   * runs — the signature of order dependence, not of a defect in what it
   * asserts. A filler turn is marked by nothing else here, carries no table,
   * no pipe and no normative id, so the automatic pass leaves it alone too.
   * Nothing about the subject changes: the assertion is about where the caret
   * lands after a write, and any turn serves for that.
   */
  await findInDoc(page, 'Filler turn number 7');
  const turn = page.locator('.tvturn').filter({ hasText: 'Filler turn number 7' });
  await expect(turn).toBeVisible({ timeout: 20_000 });

  await turn.locator('.tvanchormark').click();
  await turn.locator('.tvanchorinput').fill('marked while reading');
  await turn.locator('.tvanchorinput').press('Enter');
  await expect(turn.locator('.tvanchored')).toBeVisible({ timeout: 20_000 });

  const afterMark = await focusCost(page, { sel: '.tvturn .tvanchorrename' });
  console.log(`[confirm/1 doc mark] landed=${afterMark.landed} stopsBack=${afterMark.stopsBack}`);
  expect(afterMark.landed, 'the write threw the caret to the document body').not.toBe('BODY');
  expect(afterMark.sameElement,
    'the caret did not land on the row the write changed').toBe(true);

  await turn.locator('.tvanchordrop').click();
  await expect(turn.locator('.tvanchormark')).toBeVisible({ timeout: 20_000 });
  await expect(turn.locator('.tvanchorsaid'),
    'the document takes a point back and says nothing at all').toContainText('Taken back');
  await expect(turn.locator('.tvanchorputback'),
    'a point the reader marked by hand has no way back inside the document either')
    .toBeVisible();

  const afterDrop = await focusCost(page, { sel: '.tvturn .tvanchorputback' });
  console.log(`[confirm/1 doc drop] landed=${afterDrop.landed} stopsBack=${afterDrop.stopsBack}`);
  expect(afterDrop.landed, 'the write threw the caret to the document body').not.toBe('BODY');
  expect(afterDrop.sameElement, 'the caret did not land on the way back').toBe(true);
});

/* ══ confirm/3 — VERIFIED, NOT RE-FIXED ══════════════════════════════════ */

/**
 * `TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and` was
 * closed in the code by `c984218d`, and `e2e/anchors-paged.spec.ts` holds the
 * paging itself at 47 rows. What is measured HERE is the item's own headline
 * number — the card's SHARE of the document — because that is the figure the
 * item is stated in and the one a reader of the item would want to see again.
 */
test('the marked points are a part of the page rather than most of it', async ({ page }) => {
  await open(page);
  const share = await page.evaluate(() => {
    const box = document.querySelector('.convanchorsbox');
    if (box === null) return null;
    return {
      inBox: box.querySelectorAll('*').length,
      inDocument: document.querySelectorAll('*').length,
      rows: box.querySelectorAll('.convanchor').length,
    };
  });
  expect(share).not.toBe(null);
  const pct = (100 * share!.inBox) / share!.inDocument;
  console.log(`[confirm/3] rows=${share!.rows} inBox=${share!.inBox} `
    + `inDocument=${share!.inDocument} share=${pct.toFixed(1)}%`);
  expect(share!.rows, 'the list draws one page, not every row').toBeLessThanOrEqual(20);
  /**
   * **THE SHARE IS REPORTED AND NOT ASSERTED, and the removal proof is why.**
   *
   * Replacing this list's `cap` with 10,000 — the whole of the paging, gone —
   * moves the share from 49.4% to 55.2% on this fixture. A threshold anywhere
   * between those two would be a number tuned to one fixture rather than a
   * property, and a threshold outside them would pass in both states: an
   * assertion that cannot tell the defect from the fix. Twenty-six marked
   * points simply cannot make one card 92% of a page.
   *
   * What DOES separate them is the row count above, which went 26 -> 20 under
   * the same removal, and the figure the item is actually stated in, which
   * `e2e/anchors-paged.spec.ts` measures where it is measurable: 16,799
   * elements to 392, and 97.8% of the screen to 51.7%, on 884 marked points.
   */
  expect(pct, 'the share is a recorded measurement, not a bound').toBeGreaterThan(0);
});

/* ══ confirm/5 — THE WAY OUT, AND THE COUNT THAT KEPT THE WHOLE ═══════════ */

/**
 * `TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the`, driven in
 * a browser because every claim in it is a fact about a live document.
 *
 * ── WHY EACH OF THESE NEEDS A BROWSER ─────────────────────────────────────
 *
 *   - **"Escape shut the field" is a key event reaching a listener on a
 *     subtree.** A unit test can call a handler; only a browser can say that
 *     the key a reader actually presses arrives where this code put its
 *     listener, and that `app.js`' own document-level Escape — the one that
 *     closes the item pane — never sees it. That second half is asserted with
 *     a counter whose liveness is proven in the same test, because a counter
 *     reading 0 because it was never wired says nothing at all.
 *   - **"And nothing was written" is a fact about the wire.** It is measured
 *     twice and in two places: no POST leaves the page at all, and the server
 *     is asked afterwards what it holds. A cancel that quietly commits is
 *     worse than no cancel, and only the second question catches the version
 *     of that defect where the request goes out under some other name.
 *   - **The count is a sentence about two lists at once** — the one that
 *     matched and the one that exists — and its numbers are composed from a
 *     filtered fetch and a remembered unfiltered one. The compounding the item
 *     names appears only on a screen where the page ALSO holds rows back.
 */

/**
 * A label nothing may ever store, spelled so that a grep over the list or the
 * anchors file finds it at once if a cancel ever writes one.
 */
const FORBIDDEN = 'THIS DRAFT MUST NEVER BE STORED';
/** `BOUND_CAP_LIST`, which this file may not import: the page is served, not linked. */
const CAP = 20;

/** Every anchor write that left the page, at the network rather than at `fetch`. */
function anchorWrites(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes('/api/conversations/anchors')) return;
    seen.push(request.url().replace(/^https?:\/\/[^/]+/, ''));
  });
  return seen;
}

/** What the server holds, asked of it rather than read off the screen. */
async function storedLabels(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    const answer = await fetch('/api/conversations/anchors');
    const body = await answer.json() as { anchors: { label: string }[] };
    return body.anchors.map((a) => a.label);
  });
}

test('Escape leaves a rename with nothing written, and the caret back on the row', async ({ page }) => {
  await open(page);
  const writes = anchorWrites(page);
  /*
   * **THE KEY MUST NOT REACH THE DOCUMENT.** `app.js` closes the item pane on
   * a document-level Escape, so a box that let the key bubble would shut
   * itself AND the pane behind it — one keystroke, two levels. This listener
   * stands exactly where that one stands, and it is asked twice: once with the
   * caret inside the box, once with it outside, so a zero means "stopped here"
   * rather than "never wired".
   */
  await page.evaluate(() => {
    (window as unknown as { escapes: number }).escapes = 0;
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') (window as unknown as { escapes: number }).escapes += 1;
    });
  });

  const row = rowOf(page, 'a point I kept 17');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator('.convanchorrename').click();
  const field = row.locator('.convanchorrenameinput');
  await expect(field, 'the box opened without the caret in the field').toBeFocused();
  await field.fill(FORBIDDEN);
  await field.press('Escape');

  await expect(row.locator('.convanchorrenamebox'),
    'Escape left the rename field open — the field this item says swallows it').toBeHidden();
  await expect(row.locator('.convanchorlabel'),
    'the draft reached the row').toHaveText('a point I kept 17');
  expect(writes, 'a cancel sent a write to the server').toEqual([]);
  const stored = await storedLabels(page);
  // **THE INSTRUMENT PROVES ITSELF IN THE SAME RUN.** An absence asserted
  // against a list that came back empty — a 404, a route stub left installed,
  // a field renamed — is an assertion no mutation could ever redden.
  expect(stored, 'the archive read back empty, so the absence below measures nothing')
    .toContain('a point I kept 17');
  expect(stored, 'a cancel wrote the draft to the archive').not.toContain(FORBIDDEN);

  const escapedToDocument = await page.evaluate(
    () => (window as unknown as { escapes: number }).escapes);
  expect(escapedToDocument,
    'the key reached the document, where it also closes the item pane').toBe(0);
  /*
   * **THE CARET, MEASURED BEFORE ANYTHING ELSE TOUCHES IT.** The liveness
   * check below moves it deliberately, so it runs after this: the first draft
   * of this test asked the question afterwards and could only report a
   * 26-stop walk from the sweep button, which says nothing about where the
   * cancel PUT the caret.
   */
  const cost = await focusCost(page,
    { inRowNamed: 'a point I kept 17', sel: '.convanchorrename' });
  console.log(`[confirm/5 escape] landed=${cost.landed} stopsBack=${cost.stopsBack}`);
  expect(cost.landed, 'the cancel threw the caret to the document body').not.toBe('BODY');
  expect(cost.sameElement,
    'the caret did not land on the control that opened the box').toBe(true);
  expect(cost.stopsBack, 'the reader has to walk back to where they were').toBe(0);

  // The same counter with the caret outside any box: a 0 above is the key
  // being stopped here, and not the counter being dead.
  await page.locator('.convanchsweep').focus();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as unknown as { escapes: number }).escapes),
    'the counter cannot see an Escape at all, so the zero above measured nothing').toBe(1);

  // **AND THE ABANDONED DRAFT IS NOT HANDED BACK AS THE NAME.** A box that
  // reopened holding what a reader threw away is the same defect one gesture
  // later.
  await row.locator('.convanchorrename').click();
  await expect(field, 'the draft a cancel threw away came back in the field')
    .toHaveValue('a point I kept 17');
  await field.press('Escape');
});

test('Cancel leaves a rename and takes its own refusal down with it', async ({ page }) => {
  await open(page);
  const writes = anchorWrites(page);
  const row = rowOf(page, 'a point I kept 16');
  await expect(row).toBeVisible({ timeout: 20_000 });
  /*
   * **A REAL DRAFT FIRST, and the removal proof is why it is here.** This
   * test opened straight onto the empty-name refusal, and under the mutation
   * that makes a cancel call the write (`void run()` at the top of
   * `abandon`) it stayed GREEN: an empty name is refused by `labelWrite`
   * before any request leaves, so `writes` was empty for a reason that had
   * nothing to do with the cancel. A cancel over a name the server WOULD have
   * accepted is the only gesture that can tell those two apart.
   */
  await row.locator('.convanchorrename').click();
  await row.locator('.convanchorrenameinput').fill(FORBIDDEN);
  await row.locator('.convanchorrenamecancel').click();
  await expect(row.locator('.convanchorlabel'),
    'Cancel wrote the draft to the row').toHaveText('a point I kept 16');

  await row.locator('.convanchorrename').click();
  // The refusal this box draws for itself, so that what the cancel takes down
  // is known to have been there.
  await row.locator('.convanchorrenameinput').fill('   ');
  await row.locator('.convanchorrenamesave').click();
  const said = row.locator('.convanchorsaid');
  await expect(said, 'an empty name was not refused').toContainText('A name cannot be empty');

  await row.locator('.convanchorrenamecancel').click();
  await expect(row.locator('.convanchorrenamebox'), 'Cancel left the field open').toBeHidden();
  await expect(said,
    'the refusal outlived the box it was about — a sentence about a field '
    + 'nobody can see any more').toBeHidden();
  await expect(row.locator('.convanchorrenameinput'),
    'the cancelled draft is still in the field').toHaveValue('a point I kept 16');
  expect(writes, 'a cancel sent a write to the server').toEqual([]);
  expect(await storedLabels(page), 'Cancel wrote the draft to the archive')
    .not.toContain(FORBIDDEN);

  const cost = await focusCost(page,
    { inRowNamed: 'a point I kept 16', sel: '.convanchorrename' });
  console.log(`[confirm/5 cancel] landed=${cost.landed} stopsBack=${cost.stopsBack}`);
  expect(cost.landed, 'the cancel threw the caret to the document body').not.toBe('BODY');
  expect(cost.sameElement,
    'the caret did not land on the control that opened the box').toBe(true);
});

test('Escape leaves a mark inside the document without marking anything', async ({ page }) => {
  await open(page);
  const writes = anchorWrites(page);
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  // **A turn nothing else in this file marks** — the rule the document test
  // above states and paid for. Filler 7 is that test's; this is 12.
  await findInDoc(page, 'Filler turn number 12');
  const turn = page.locator('.tvturn').filter({ hasText: 'Filler turn number 12' });
  await expect(turn).toBeVisible({ timeout: 20_000 });

  await turn.locator('.tvanchormark').click();
  await turn.locator('.tvanchorinput').fill(FORBIDDEN);
  await turn.locator('.tvanchorinput').press('Escape');

  await expect(turn.locator('.tvanchorbox'), 'Escape left the field open').toBeHidden();
  await expect(turn.locator('.tvanchormark'),
    'the row stopped offering to mark a point that was never marked').toBeVisible();
  await expect(turn.locator('.tvanchored'),
    'a cancelled mark drew the row as marked').toHaveCount(0);
  expect(writes, 'a cancelled mark sent a write').toEqual([]);
  const stored = await storedLabels(page);
  expect(stored, 'the archive read back empty, so the absence below measures nothing')
    .toContain('a point I kept 00');
  expect(stored, 'a cancelled mark reached the archive').not.toContain(FORBIDDEN);
  await expect(turn.locator('.tvanchorinput'),
    'the abandoned draft is still in the field').toHaveValue('');
});

test('a filter says what it narrowed, and the page bound says what it held back', async ({ page }) => {
  await open(page);
  const count = page.locator('.convanchcount');
  const whole = Number(/(\d+)/.exec(await count.textContent() ?? '')?.[1]);
  expect(whole, 'the unfiltered list does not hold enough points to hide any')
    .toBeGreaterThan(CAP);

  await page.locator('input.convanchfind').fill('a point I kept');
  await expect(count, 'the narrowed count never learned to carry the whole')
    .toContainText(' of ', { timeout: 20_000 });
  const said = await count.textContent() ?? '';
  const matched = Number(/(\d+) of (\d+)/.exec(said)?.[1]);
  const carried = Number(/(\d+) of (\d+)/.exec(said)?.[2]);
  const bound = await page.locator('.convanchorsbox .bound p').textContent() ?? '';
  console.log(`[confirm/5 count] count="${said.trim()}" bound="${bound.trim()}" whole=${whole}`);

  expect(matched, 'the filter hid nothing, so this measures nothing').toBeLessThan(whole);
  expect(carried, 'the count lost the size of the thing that was narrowed').toBe(whole);
  /*
   * **THE COMPOUNDING THE ITEM NAMES.** The list already holds rows back at a
   * cap of 20, so a count that ALSO hid the filter's effect would put two
   * silent subtractions on one screen. Here there are three numbers and all
   * three are said: twenty drawn, of the matched, of the whole.
   */
  expect(matched, 'the filtered list fits on one page, so nothing is held back '
    + 'and the compounding this asserts cannot occur').toBeGreaterThan(CAP);
  expect(bound, 'the page bound describes a list other than the one on screen')
    .toContain(`of ${matched}`);
  await page.screenshot({ path: 'e2e/screens/anchor-count-narrowed.png', fullPage: true });
});
