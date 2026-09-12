// @basis REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// INV-nothing-is-dropped-silently
/**
 * **EVERY ANCHOR CAPABILITY, DRIVEN IN A BROWSER** — owner ruling 2026-09-12,
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`.
 *
 * ── WHAT THIS FILE USED TO ASSERT, AND WHY THAT IS NOW THE DEFECT ────────
 *
 * It asserted that the composed line carried the byte offset of the turn on
 * screen, and that the box offered **Copy and NOT Execute**. Both were true
 * and both were the limitation, not the design. His ruling reverses them in as
 * many words: *"you shouldn't limit me because you decided to use the CLI and
 * then you tell me that this is the way i need to use it — unacceptable"*, and
 * the sentence that decides what counts — *"a composed command the reader must
 * copy into a terminal is NOT the UI having the capability, it is the UI
 * describing one."*
 *
 * So the assertions here are that the SCREEN DID IT. Each of the seven
 * capabilities is driven as a person drives it, and the row afterwards is read
 * back out of the page rather than out of a promise.
 *
 * ── THE FIXTURE IS PLANTED, AND THAT IS THE POINT OF IT ──────────────────
 *
 * Two turns that ARE anchors by nature and four that are not, in one session.
 * The automatic pass is asserted to mark exactly the first two, so a detector
 * that fired on prose would show up here as a third row rather than as a
 * number nobody checks.
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

const SESSION = 'sess-anchors';

/**
 * **The table's label is its FIRST READABLE HEADER CELL, not the joined row.**
 *
 * Owner ruling 2026-09-11, landed as `440710b6`: the automatic pass keeps two
 * kinds and the table labels that read as a bare `|` are fixed. `tableLabel`
 * (`src/core/anchor-pass.ts` since 2026-09-12) now answers
 * `header.find(isReadable)`, so `| tokenizer | hits |` is anchored as
 * `tokenizer` rather than as `tokenizer | hits`.
 */
const TABLE_HEADER = 'tokenizer';
/**
 * **Still in the transcript, and deliberately NOT an anchor any more.**
 *
 * The `report` detector was retired by the same ruling — 101 automatic
 * `report` anchors went to zero. This turn names a dated report path and no
 * normative id, so it is one of the 53 that were genuinely dropped rather than
 * one of the 48 the retired grammar had been HIDING as rulings. It stays in
 * the fixture as a NEGATIVE: a detector that came back would add a third row
 * below and say so.
 */
const REPORT = 'reports/2026-09-10-lexical-selection-research.md';
const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';
/** In the transcript and in NO label — so a label search cannot pass for a prose search. */
const PROSE = 'the weather in the afternoon was ordinary and worth nothing';

const TABLE_TURN = [
  'Here is what was measured.',
  '',
  '| tokenizer | hits |',
  '| --- | --- |',
  '| trigram | 14 |',
  '| unicode61 | 0 |',
].join('\n');

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

/**
 * **THE DOCUMENT HAS TO BE TALLER THAN THE WINDOW, and that is a measurement
 * this file needs rather than padding for its own sake.**
 *
 * The go-to test asserts that opening a marked point LANDS on it. On a
 * six-turn fixture the whole document fits on screen, so it is in view however
 * the document opened — and the removal proof found exactly that: deleting the
 * scroll (`landOn`) left every assertion green, because the only thing being
 * checked was the sentence the page draws beside it.
 *
 * Forty filler turns after the six make the document scroll. The marked table
 * is then turn 2 of 46 and the document opens at the END, so "the table is in
 * view" is false by default and true only because something scrolled there.
 *
 * They are plain prose on purpose: no pipe, no delimiter row, no normative id.
 * A filler turn that the grammar recognised would add rows to the count test
 * two screens down.
 */
const FILLER = Array.from({ length: 40 }, (_, i) => say(
  'assistant',
  `Filler turn number ${i} exists to make this document taller than the window, so that `
  + 'landing on a marked point is something a test can see rather than something it is told. '
  + 'It carries no table, no pipe and no normative id, so nothing here is an anchor by nature.',
  '2026-09-10T09:10:00.000Z',
));

const TURNS = [
  say('user', `follow ${RULING} here`, '2026-09-10T09:00:00.000Z'),
  say('assistant', TABLE_TURN, '2026-09-10T09:00:01.000Z'),
  say('assistant', `I wrote it up in ${REPORT} today`, '2026-09-10T09:00:02.000Z'),
  say('assistant', PROSE, '2026-09-10T09:00:03.000Z'),
  say('user', 'שלום, כאן אין מזהה פריט בכלל ואין טבלה', '2026-09-10T09:00:04.000Z'),
  say('assistant', 'and a shell pipeline | grep -v Warning | head -5 is not a table',
    '2026-09-10T09:00:05.000Z'),
  ...FILLER,
];

/** Where record `n` starts, in BYTES — what a marked point must carry. */
function offsetOf(n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(TURNS[i]), 'utf8') + 1;
  return at;
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-anchor-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-anchor-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(TURNS));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // The index, the words and the automatic anchors all arrive from this one
    // CLI write, which is how a person meets them.
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

async function open(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convarchq', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/**
 * **Put the archive back the way `beforeAll` left it.**
 *
 * These tests WRITE, which is the whole point of them, and a marked point left
 * behind would be a row the next test counts. Driven through the same routes
 * the page drives, so the cleanup cannot succeed where the feature fails.
 */
async function reset(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const token = document.cookie; // the cookie is HttpOnly; the fetch carries it either way
    void token;
    const list = await (await fetch('/api/conversations/anchors')).json();
    for (const anchor of list.anchors ?? []) {
      if (anchor.origin !== 'owner') continue;
      await fetch('/api/conversations/anchors/drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: anchor.id }),
      });
    }
    await fetch('/api/conversations/anchors/sweep', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
  });
}

/* ══ CAPABILITY 1 — CREATE, FROM A SEARCH HIT ═════════════════════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`the viewer marks the point itself, and never composes a command · ${lang}`, async ({ page }) => {
    await open(page, lang);
    // A turn the automatic pass did NOT mark — the ordinary prose one — or
    // there would be no offer to mark, which is the other test below.
    await page.locator('.convarchq').fill('afternoon');
    const hit = page.locator('.convhit').first();
    await expect(hit).toBeVisible({ timeout: 20_000 });

    // Closed until asked for: a write is an offer, not a thing the screen puts
    // in front of a reader who was searching.
    await expect(hit.locator('.convhitcmd')).toBeHidden();
    await hit.locator('.convhitmarkbtn').click();

    // **THERE IS NO COMMAND ON THIS SCREEN ANY MORE.** The assertion that used
    // to stand here read the composed `mycontext conversation anchor …` line
    // out of `code` and checked its byte offset. A `code` element here now
    // would be the composed-command shape coming back, which is exactly what
    // the ruling forbids.
    await expect(
      hit.locator('.convhitcmd code'),
      'the mark box composes a command again — the UI describing a capability rather than '
      + 'having one, which is the defect this requirement reversed',
    ).toHaveCount(0);

    const field = hit.locator('.convmarklabel');
    await expect(field).toBeVisible();
    // Pre-filled with the words that were searched for — the same default the
    // composed `--label` carried, now in a box a person can correct.
    await expect(field).toHaveValue('afternoon');
    await field.fill('the one about the weather');
    await page.screenshot({ path: `e2e/screens/anchors-mark-${lang}.png`, fullPage: true });
    await hit.locator('.convmarksave').click();

    // The row redraws as MARKED, with no button still offering to mark it.
    await expect(hit.locator('.convhitmarked')).toBeVisible({ timeout: 20_000 });
    await expect(hit.locator('.convhitmarkbtn')).toHaveCount(0);

    // And the point is in the list below, with the name that was typed.
    const marked = page.locator('.convanchor', { hasText: 'the one about the weather' });
    await expect(marked).toHaveCount(1, { timeout: 20_000 });
    await page.screenshot({ path: `e2e/screens/anchors-marked-${lang}.png`, fullPage: true });

    await reset(page);
  });
}

/* ══ CAPABILITY 2 — SEE, WITH THE DETAILS AN ANCHOR CARRIES ═══════════════ */

test('a marked point shows what it carries: name, kind, who marked it, when, and the byte', async ({ page }) => {
  await open(page, 'en');
  const row = page.locator('.convanchor', { hasText: TABLE_HEADER });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  const head = row.locator('.convanchorwhere');
  await expect(head.locator('.convanchorkind')).toHaveText('a table');
  await expect(head.locator('.convanchororigin')).toHaveText('marked for you');
  // The BYTE, which is the detail that tells two marks in one session apart —
  // and the one a reader needs to check a mark against the CLI.
  await expect(head, 'the byte offset is one of the seven details the ruling lists')
    .toContainText(String(offsetOf(1)));
  await expect(head).toContainText('at byte');
  await page.screenshot({ path: 'e2e/screens/anchors-details.png', fullPage: true });
});

test('a table and a ruling are already marked, and nothing else is', async ({ page }) => {
  await open(page, 'en');
  const rows = page.locator('.convanchor');
  await expect(rows).toHaveCount(2, { timeout: 20_000 });

  const labels = await rows.locator('.convanchorlabel').allInnerTexts();
  expect(
    labels.sort(),
    'exactly the two turns that are anchors by NATURE, each labelled with the evidence that '
    + 'fired — the first readable header cell, and the id. The REPORT turn is now a negative '
    + 'alongside the prose turn, the Hebrew turn and the shell pipeline: the owner retired that '
    + 'grammar on 2026-09-11 (441 of 613 anchors re-counted, `automatic/report` 101 to 0). A '
    + 'detector that widened, or a report detector that came back, would add a row here.',
  ).toEqual([RULING, TABLE_HEADER].sort());

  const kinds = await rows.locator('.convanchorkind').allInnerTexts();
  expect(kinds.sort()).toEqual(['a ruling you gave', 'a table']);

  await page.screenshot({ path: 'e2e/screens/anchors-automatic.png', fullPage: true });
});

/* ══ CAPABILITY 3 — FIND, ACROSS THE SET ══════════════════════════════════ */

test('the marked points are searched by name, and that is not the same box as the words', async ({ page }) => {
  await open(page, 'en');
  await expect(page.locator('.convanchor')).toHaveCount(2, { timeout: 20_000 });

  await page.locator('.convanchfind').fill(TABLE_HEADER);
  const rows = page.locator('.convanchor');
  await expect(rows).toHaveCount(1, { timeout: 20_000 });
  await expect(rows.locator('.convanchorlabel')).toHaveText(TABLE_HEADER);

  // **The two boxes answer different questions, and this is what says so.**
  // `PROSE` is in the transcript and in no label, so a find box that had
  // quietly become a prose search would return a row here.
  await page.locator('.convanchfind').fill('afternoon');
  await expect(
    page.locator('.convanchnone'),
    'the find box matched a phrase that is in the CONVERSATION and in no label — the two '
    + 'searches on this screen have collapsed into one',
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.convanchor')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screens/anchors-find.png', fullPage: true });
});

/* ══ CAPABILITY 4 — GO TO ═════════════════════════════════════════════════ */

test('opening a marked point lands the document on it, and says which point it is', async ({ page }) => {
  await open(page, 'en');
  const row = page.locator('.convanchor', { hasText: TABLE_HEADER });
  await expect(row).toBeVisible({ timeout: 20_000 });
  const href = await row.locator('.convanchoropen').getAttribute('href');
  expect(href, 'the address carries the byte, which is what the anchor actually stores')
    .toBe(`/#/conversations/at/${SESSION}/${offsetOf(1)}`);

  await row.locator('.convanchoropen').click();

  // **THE WELL IS ACTUALLY AT THE POINT, and this assertion exists because the
  // removal proof found its absence.** The first draft checked only the
  // sentence below; deleting the scroll itself (`landOn`) left it green,
  // because the page still SAID it had landed. A disclosure of a thing that
  // did not happen is worse than no disclosure at all.
  //
  // **`.tvscroll`'s own scrollTop, and not `toBeInViewport`.** The document
  // scrolls INSIDE a well that is itself inside a page with its own scroll, so
  // "in the browser viewport" answers a question about where the well sits on
  // the page — a first attempt at this assertion passed and failed for exactly
  // that reason. Every row's top is WRITTEN from the model into
  // `insetBlockStart`, so the row's position and the well's scroll are two
  // numbers that can be compared directly.
  const table = page.locator('.tvturn', { hasText: 'Here is what was measured' });
  await expect(table).toBeVisible({ timeout: 20_000 });
  const where = await page.evaluate(() => {
    const well = document.querySelector('.tvscroll') as HTMLElement;
    const rows = [...document.querySelectorAll('.tvturn')] as HTMLElement[];
    const row = rows.find((r) => (r.textContent ?? '').includes('Here is what was measured'));
    return row === undefined ? null : {
      scrollTop: well.scrollTop,
      rowTop: Number.parseFloat(row.style.insetBlockStart),
      end: well.scrollHeight - well.clientHeight,
    };
  });
  expect(where, 'the marked turn was never drawn').not.toBe(null);
  expect(
    Math.abs(where!.rowTop - where!.scrollTop),
    'the well is not sitting at the marked turn — the address opened the document and the '
    + 'landing did not happen, which is exactly what the sentence below would still claim',
  ).toBeLessThan(60);
  expect(
    where!.end - where!.scrollTop,
    'the well is at its END, which is where this document opens with NO address — so nothing '
    + 'here distinguishes a landing from the default',
  ).toBeGreaterThan(200);

  // The landing is DISCLOSED — a document that opened somewhere other than
  // where it always opens, saying nothing, is a reader wondering whether the
  // scroll broke.
  const landed = page.locator('.tvlanded');
  await expect(landed).toBeVisible({ timeout: 20_000 });
  await expect(landed).toContainText('Opened at the point you marked');
  await expect(landed.locator('.tvlandedlabel')).toHaveText(TABLE_HEADER);
  await page.screenshot({ path: 'e2e/screens/anchors-goto.png', fullPage: true });
});

test('the same document opened WITHOUT an address still opens at its end', async ({ page }) => {
  // The control for the assertion above. Without it, "the table is in view and
  // the last turn is not" could be a fact about where this document always
  // opens rather than about the address that was followed.
  await open(page, 'en');
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  await expect(page.locator('.tvlanded')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.tvturn', { hasText: 'Filler turn number 39' }))
    .toBeVisible({ timeout: 20_000 });
  const at = await page.evaluate(() => {
    const well = document.querySelector('.tvscroll') as HTMLElement;
    return { scrollTop: well.scrollTop, end: well.scrollHeight - well.clientHeight };
  });
  expect(
    at.end,
    'this document does not scroll at all, so "it opened at its end" and "it landed on a point '
    + 'near the top" are the same position and the test above proves nothing',
  ).toBeGreaterThan(200);
  expect(at.end - at.scrollTop, 'the document did not open at its end').toBeLessThan(60);
  // **NOT DRAWN AT ALL**, which is a stronger statement than "not in view" and
  // is what a virtualised document actually does: the window is chosen from
  // the scroll position, so a turn forty rows above it is not in the DOM. If
  // this ever answers 1, the document has stopped virtualising and every
  // height measurement on this screen is measuring something else.
  await expect(page.locator('.tvturn', { hasText: 'Here is what was measured' }))
    .toHaveCount(0);
});

/* ══ CAPABILITY 5 AND 6 — RELABEL AND DROP ════════════════════════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`a marked point is renamed and taken back from the screen · ${lang}`, async ({ page }) => {
    await open(page, lang);
    const row = page.locator('.convanchor', { hasText: TABLE_HEADER });
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.locator('.convanchorrename').click();
    const field = row.locator('.convanchorrenameinput');
    await expect(field).toBeVisible();
    await expect(field).toHaveValue(TABLE_HEADER);
    await field.fill('the tokenizer measurement');
    await row.locator('.convanchorrenamesave').click();

    const renamed = page.locator('.convanchor', { hasText: 'the tokenizer measurement' });
    await expect(renamed).toHaveCount(1, { timeout: 20_000 });
    // **AND THE ROW BECAME HIS.** The pass reads back every row it owns and
    // puts it to today's grammar, so a name typed onto one would be silently
    // replaced on the next run unless ownership moves — which is why the
    // screen says so rather than letting him find out.
    await expect(renamed.locator('.convanchororigin'))
      .toHaveText(lang === 'en' ? 'you marked it' : 'אתם סימנתם');
    await page.screenshot({ path: `e2e/screens/anchors-renamed-${lang}.png`, fullPage: true });

    // DROP, with no confirm dialog — owner ruling 2026-09-11, and the reason
    // is that the point is still there and the same byte marks it again.
    await renamed.locator('.convanchordrop').click();
    await expect(page.locator('.convanchor', { hasText: 'the tokenizer measurement' }))
      .toHaveCount(0, { timeout: 20_000 });

    await reset(page);
  });
}

/* ══ CAPABILITY 7 — RUN THE AUTOMATIC PASS, FROM THE SCREEN ═══════════════ */

test('the automatic pass runs from a button, and reports what it changed', async ({ page }) => {
  await open(page, 'en');
  const sweep = page.locator('.convanchsweep');
  await expect(sweep).toBeVisible({ timeout: 20_000 });

  // The rebuild in `beforeAll` already ran the pass, so this run has nothing
  // to do — and saying so is the assertion. A screen that drew nothing on a
  // run that changed nothing would be indistinguishable from a broken button.
  await sweep.click();
  const said = page.locator('.convanchsweepsaid');
  await expect(said).toBeVisible({ timeout: 30_000 });
  await expect(said).toContainText('Nothing changed', { timeout: 30_000 });
  await page.screenshot({ path: 'e2e/screens/anchors-sweep-idempotent.png', fullPage: true });

  // And the other direction: take back what the pass owns, then press it again
  // and watch it say how many it put back. Without this the test above would
  // pass over a button that did nothing at all.
  await page.evaluate(async () => {
    const list = await (await fetch('/api/conversations/anchors')).json();
    for (const anchor of list.anchors ?? []) {
      await fetch('/api/conversations/anchors/drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: anchor.id }),
      });
    }
  });
  await sweep.click();
  await expect(said).toContainText('2 newly marked', { timeout: 30_000 });
  await expect(said).toContainText('Nothing you marked yourself was touched');
  await expect(page.locator('.convanchor')).toHaveCount(2, { timeout: 20_000 });
  await page.screenshot({ path: 'e2e/screens/anchors-sweep-refilled.png', fullPage: true });
});

/* ══ CREATION PATH 3 — BY HAND WHILE READING ══════════════════════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`a point is marked from inside the document being read · ${lang}`, async ({ page }) => {
    await open(page, lang);
    await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
    await page.waitForSelector('.tvscroll', { timeout: 20_000 });

    // **THE DOCUMENT'S OWN FILTER, because the document is virtualised and
    // opens at its end.** A turn forty rows above the window is not in the DOM
    // at all, so a test that reached for it by text would be asserting against
    // a row nothing had drawn. Typing in the find box is also the path a
    // reader takes to get to a turn they remember — the one the archive search
    // is not, because that box searches every session and this one searches
    // this document.
    await page.locator('.tvfind').fill('the weather in the afternoon');

    // The prose turn, which nothing marked — the control on a row that IS
    // marked is the other branch, asserted below.
    const turn = page.locator('.tvturn', { hasText: 'the weather in the afternoon' });
    await expect(turn).toBeVisible({ timeout: 20_000 });
    const bar = turn.locator('.tvanchorbar');
    await expect(
      bar.locator('.tvanchormark'),
      'a reader who found a turn by READING has no way to mark it — which is exactly the '
      + 'creation path the owner listed third and the one this document had none of',
    ).toBeVisible();

    await bar.locator('.tvanchormark').click();
    await bar.locator('.tvanchorinput').fill('found while reading');
    await page.screenshot({ path: `e2e/screens/anchors-in-document-${lang}.png`, fullPage: true });
    await bar.locator('.tvanchorsave').click();

    // The control becomes the MARKED state in place, with the name beside it.
    await expect(turn.locator('.tvanchored')).toBeVisible({ timeout: 20_000 });
    await expect(turn.locator('.tvanchorlabel')).toHaveText('found while reading');
    await expect(turn.locator('.tvanchormark')).toHaveCount(0);
    await page.screenshot({ path: `e2e/screens/anchors-in-document-done-${lang}.png`, fullPage: true });

    // And it is taken back from the same place.
    await turn.locator('.tvanchordrop').click();
    await expect(turn.locator('.tvanchormark')).toBeVisible({ timeout: 20_000 });

    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convarchq', { timeout: 20_000 });
    await reset(page);
  });
}

test('a turn the automatic pass marked shows its name in the document, not an offer to mark it', async ({ page }) => {
  await open(page, 'en');
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  // The filter, for the reason the test above gives: this document is
  // virtualised and opens at its end, so the table is not drawn until asked
  // for.
  await page.locator('.tvfind').fill('Here is what was measured');
  const turn = page.locator('.tvturn', { hasText: 'Here is what was measured' });
  await expect(turn).toBeVisible({ timeout: 20_000 });
  await expect(turn.locator('.tvanchored')).toBeVisible({ timeout: 20_000 });
  await expect(turn.locator('.tvanchorlabel')).toHaveText(TABLE_HEADER);
  await expect(turn.locator('.tvanchormark')).toHaveCount(0);
});
