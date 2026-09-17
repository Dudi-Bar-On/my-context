// @basis TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic,
// INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A NEW MARK KIND THAT CANNOT BE FILTERED, REACHED OR SEEN IS A KIND THAT
 * EXISTS ONLY IN THE FILE** — the five checks
 * `TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic` names, on
 * a document that actually holds a `report` mark.
 *
 * ── WHY THIS FILE EXISTS WHEN `mark-hues` AND `mark-kinds` ALREADY RUN ────
 *
 * Both of those seed their marks BY HAND, as `origin: 'owner'` rows written
 * straight into `.anchors.jsonl`, and `mark-hues.spec.ts` seeds all nine kinds
 * including `report`. So "the UI can draw a report mark" was already green on
 * the day the automatic pass had never produced one in its life.
 *
 * That is the exact shape the item warns about: *"every layer looked right
 * while the feature was dead, twice this week."* The claim being proved here is
 * narrower and it is the one that was untested — **that a `report` mark THE
 * PASS WROTE reaches the filter, the menu, the key, the hue and the step.**
 * Nothing in this fixture writes an anchor. `mycontext conversation rebuild`
 * does, out of a transcript, the way it will on his archive.
 *
 * ── AND IT IS A LANE'S DOCUMENT, BECAUSE THAT IS WHERE A REPORT LIVES ────
 *
 * A `report` marks a LANE's last answer, so the document holding one is
 * `/lane.html?id=<agentId>` — `plan:archive seq:51`'s bare window, which
 * imports `mountDocument` and forks nothing. Every check below is therefore
 * also a check that the five surfaces work in the window with no application
 * around them, which is the half a test driven only through the shell misses.
 *
 * ── THE FIVE, AND THE ANTI-VACUITY EACH ONE CARRIES ──────────────────────
 *
 * | the check | how a false green would look | what refuses it |
 * |---|---|---|
 * | 1 the filter offers it | a select with one option | the lane holds `table` too, and both must be offered |
 * | 2 the menu has its radio, ticked | a menu with no radios at all | the tick must MOVE, and land on `report` |
 * | 3 `K` cycles onto it | a ring of one | the ring is walked whole and must come home |
 * | 4 it draws in its hue | every kind grey | `table` and `report` share `kindfound` and must differ from the ground |
 * | 5 stepping lands on its turn | a walk that stops anywhere | the landing record is read off the fixture |
 *
 * READ-ONLY, so `fullyParallel` is correct rather than tolerated: not one test
 * below marks, relabels or drops anything.
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

const SESSION = 'sess-report-reach';
const LANE = 'agent-report-reach';
const MISSION = 'general-purpose — replace the ruling detector and take the lane report';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * **THE DISPATCH BLOCK, VERBATIM IN SHAPE** — a `user` record inside a lane's
 * transcript, carrying a normative id and the word `must`.
 *
 * It is here so that the screen's own count is a proof too: if this were still
 * marked, the lane would hold three kinds and every number below would move.
 */
const dispatch = {
  type: 'user',
  message: {
    role: 'user',
    content: [{
      type: 'text',
      text: '_This block was added by my_context when this subagent started._\n\n'
        + '### RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none · rule\n\n'
        + 'A test declares what it rests on, and every relative import must carry a `.ts`.',
    }],
  },
  timestamp: '2026-09-11T09:00:00.000Z',
  isSidechain: true,
};

const laneAnswer = (body: string, i: number): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: new Date(Date.UTC(2026, 8, 11, 9, 1, i)).toISOString(),
  isSidechain: true,
});

/** The turn the `table` grammar takes, so the lane holds TWO kinds and not one. */
const TABLE_BODY = [
  '## What the pass counted',
  '',
  '| what | n |',
  '| --- | --- |',
  '| newly marked | 225 |',
].join('\n');

/** The lane's final answer. Well past the 400-character floor. */
const REPORT_BODY = [
  'Done. Here is what changed and what it cost.',
  '',
  ...Array.from({ length: 10 }, (_, i) =>
    `Finding ${i + 1}: the detector was replaced rather than deleted, because the kind is the `
    + 'right name for the right thing and only the detection was wrong.'),
].join('\n');

/** The lane's records, in the order the transcript holds them. */
function laneTranscript(): { text: string; records: unknown[] } {
  const records: unknown[] = [dispatch, laneAnswer(TABLE_BODY, 1)];
  // **FORTY FILLERS, SO THE DOCUMENT IS TALLER THAN THE WINDOW.** Check 5 rests
  // on the report turn NOT being on screen before the step and being on screen
  // after it. A document that fits in the viewport would make the second half
  // true without the step doing anything, which is a proof whose fixture
  // carried its power.
  for (let i = 0; i < 40; i += 1) {
    records.push(laneAnswer(
      `Step ${i}: ordinary progress, no table, no pipe, nothing by nature here.`, 2 + i));
  }
  records.push(laneAnswer(REPORT_BODY, 20));
  return { text: jsonl(records), records };
}

/** The session's own transcript — short, and one turn of it is his. */
const SESSION_TURNS = [
  {
    type: 'user',
    message: { role: 'user', content: 'from now on the port must always be 58888' },
    timestamp: '2026-09-11T08:59:00.000Z',
    origin: { kind: 'human' },
    promptSource: 'typed',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'dispatching a lane.' }] },
    timestamp: '2026-09-11T08:59:30.000Z',
  },
];

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-report-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-report-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(SESSION_TURNS));

  const built = laneTranscript();
  const laneDir = path.join(dir, SESSION, 'subagents');
  mkdirSync(laneDir, { recursive: true });
  writeFileSync(path.join(laneDir, `${LANE}.jsonl`), built.text);
  writeFileSync(path.join(laneDir, `${LANE}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: MISSION, toolUseId: 'toolu_report', spawnDepth: 1,
  }));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // **THE ONLY WRITER OF ANCHORS IN THIS FILE.** Nothing is seeded; the pass
    // reads the transcripts and decides. If it decided wrong, the screen below
    // has nothing to draw and every test fails at its anti-vacuity line rather
    // than passing quietly.
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

/** The lane's bare document, with the stepper drawn and its anchors loaded. */
async function openLane(page: Page): Promise<void> {
  // The shell first, for the credential and nothing else: `/lane.html`
  // exchanges no nonce and rides the `Path=/` cookie the bootstrap sets.
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.goto(`http://127.0.0.1:${harness.port}/lane.html?id=${LANE}`);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  // Waiting for the COUNT, so every assertion is about a loaded document
  // rather than about a race.
  await expect(page.locator('.tvnavmarkcount')).toContainText('2', { timeout: 20_000 });
}

/** The archive screen, with the marked-points list drawn. */
async function openArchive(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
}

/* ══ 0. THE PASS PRODUCED THE FIXTURE, AND THE DISPATCH IS NOT IN IT ══════ */


/**
 * ══ REACHING Top, End AND THE FIND BOX SINCE `semantic/15` ════════════════
 *
 * The owner ruled on 2026-09-17 that the controls leave the card: `.tvbar` and
 * `.tvnav` are gone and every control lives in the panel that owns its
 * subject. The route to a panel is the right-click menu, whose first three
 * rows are Search, Step through and Copy — above the separator — so the index
 * IS the panel.
 *
 * `jumpTo` shuts the panel again, because what follows one of these is an
 * assertion about the document and not about a dialog standing over it.
 */
async function usePanelAt(page: Page, at: number, name: string): Promise<void> {
  const open = `dialog.mcpanel[data-panel="${name}"][open]`;
  if (await page.locator(open).count() > 0) return;
  await page.evaluate(() => { document.getSelection()?.removeAllRanges(); });
  await page.locator('.tvscroll .tvturn').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.tvmenu .tvmenuitem').nth(at).click();
  await expect(page.locator(open)).toHaveCount(1, { timeout: 10_000 });
}

async function jumpTo(page: Page, which: 'top' | 'end'): Promise<void> {
  // **IT LEAVES THE PANEL AS IT FOUND IT.** A test whose subject is the
  // stepper has the panel open and needs it to stay open; one that only wants
  // the reader at an end has nothing open and must not be left with a dialog
  // over the well it is about to photograph or click into.
  const open = 'dialog.mcpanel[data-panel="navigate"][open]';
  const wasOpen = await page.locator(open).count() > 0;
  await usePanelAt(page, 1, 'navigate');
  await page.locator(`dialog.mcpanel[data-panel="navigate"] button.tv${which}`).click();
  if (wasOpen) return;
  await page.locator('dialog.mcpanel[data-panel="navigate"] .mcpanelclose').click();
  await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
}

async function typeInFind(page: Page, query: string): Promise<void> {
  await usePanelAt(page, 0, 'search');
  await page.locator('dialog.mcpanel[data-panel="search"] .tvfind').fill(query);
}

test('the pass wrote a report and a table on this lane, and nothing on the dispatch', async ({ page }) => {
  await openArchive(page);
  const listed = await page.locator('.convanchor').evaluateAll((nodes) => nodes.map((n) => ({
    kind: (n.querySelector('.convanchorkind')?.textContent ?? '').trim(),
    label: (n.querySelector('.convanchorlabel')?.textContent
      ?? n.textContent ?? '').trim().slice(0, 90),
  })));
  console.log(`[report] the list holds ${JSON.stringify(listed, null, 0)}`);

  // THREE marks in this workspace and not four: his ruling, the lane's table,
  // the lane's report. The dispatch is the fourth candidate and it is refused.
  expect(listed.length, 'the marks list drew nothing, so every check below would be a reading '
    + 'of an empty screen').toBe(3);
  expect(
    listed.some((row) => row.label.includes('RULE-a-test-names-the-items')),
    'THE DEFECT: 296 of the 377 `ruling` marks on his archive were this plugin\'s own '
    + 'injection block, and 55 wore this exact id as their label. Not one may come back.',
  ).toBe(false);
  expect(
    listed.some((row) => row.kind.includes('report')), 'no report mark reached the list at all',
  ).toBe(true);
});

/* ══ 1. THE FILTER OFFERS IT, WITH ITS OWN WORD ══════════════════════════ */

test('check 1: the kind filter offers `report`, with its own word', async ({ page }) => {
  await openLane(page);
  const offered = await page.locator('.tvnavkind option').evaluateAll(
    (nodes) => nodes.map((n) => ({
      value: (n as HTMLOptionElement).value, word: (n.textContent ?? '').trim(),
    })));
  console.log(`[report] the select offers ${JSON.stringify(offered)}`);

  expect(offered[0]?.value, 'the select does not open on every kind, so a reader who narrows '
    + 'the walk has no stated way back to all of it').toBe('');
  expect(offered.slice(1).map((o) => o.value).sort(),
    'the select offers a kind this lane does not hold, or is missing one it does')
    .toEqual(['report', 'table']);

  const report = offered.find((o) => o.value === 'report');
  expect(report?.word, 'the option drew its RAW ID rather than a word — `kindWord` falls back to '
    + 'the kind itself when `ANCHOR_KIND_KEYS` has no entry, which is what a kind added to the '
    + 'core and not to the browser\'s tables looks like').not.toBe('report');
  expect(report?.word, 'and the word must be the one the string table holds').toBe('a report');
});

/* ══ 2. THE MENU HAS ITS RADIO, AND THE TICK FOLLOWS IT ══════════════════ */

test('check 2: the kind picker carries a `report` option, and the tick moves to it', async ({ page }) => {
  await openLane(page);
  /*
   * ══ THE RADIOS LEFT THE MENU ON 2026-09-17 — `semantic/15` ═══════════════
   *
   * This test named the right-click menu's `menuitemradio` rows, and they are
   * gone: the owner ruled that the menu keeps only what acts on THE TURN YOU
   * RIGHT-CLICKED, and *"what am I walking"* is a fact about the document. The
   * rows were only ever a second route to `kindPick` — they set the real
   * `<select>` and dispatched its own `change` — so what this test was really
   * asserting is the VOCABULARY, and the vocabulary is the select's options.
   *
   * It is re-aimed at that select rather than deleted, because the thing it
   * was filed to catch is unchanged and still worth catching: a `report`
   * offered as the raw core word instead of the string table's *"a report"*,
   * or a second vocabulary appearing beside the first.
   */
  await usePanelAt(page, 1, 'navigate');
  const radios = page.locator('dialog.mcpanel[data-panel="navigate"] .tvnavkind option');
  await expect(radios, 'the picker drew no kinds at all').not.toHaveCount(0);

  /*
   * **THE TRAILING `✓` NO LONGER HAS TO BE STRIPPED.** The menu's chosen row
   * drew a tick glyph after its word, so its TEXT moved with the state and a
   * comparison that kept it would have asserted the tick twice and the
   * vocabulary not at all. An `<option>` carries no tick: the state is
   * `selected`, which is the same fact `aria-checked` carried and the one a
   * screen reader gets from a `<select>`.
   */
  const words = (nodes: Element[]): { word: string; checked: string | null }[] =>
    nodes.map((n) => ({
      word: (n.textContent ?? '').trim(),
      // An `<option>`'s state is `selected`, which is the same fact the menu
      // row's `aria-checked` carried and is the one a screen reader gets from
      // a `<select>`.
      checked: (n as HTMLOptionElement).selected ? 'true' : 'false',
    }));

  const before = await radios.evaluateAll(words);
  console.log(`[report] menu radios ${JSON.stringify(before)}`);
  expect(before.map((r) => r.word), 'the picker offers a vocabulary this build does not hold')
    .toEqual(['Marked points of every kind', 'a report', 'a table']);
  expect(before.filter((r) => r.checked === 'true').length,
    'a picker must have exactly one chosen option').toBe(1);
  expect(before.find((r) => r.checked === 'true')?.word,
    'the walk does not open unnarrowed').toBe('Marked points of every kind');

  // **THE CHOICE MUST MOVE.** A group whose state never moves is a list of words.
  await page.locator('dialog.mcpanel[data-panel="navigate"] .tvnavkind')
    .selectOption({ label: 'a report' });
  await expect(page.locator('.tvnavmarkcount')).toContainText('a report', { timeout: 10_000 });
  const after = await radios.evaluateAll(words);
  console.log(`[report] the picker after choosing ${JSON.stringify(after)}`);
  expect(after.find((r) => r.checked === 'true')?.word,
    'the choice did not follow, so the picker shows a state the walk is not in')
    .toBe('a report');
  // And it is the REAL select the walk reads, not a second one beside it.
  expect(await page.locator('.tvnavkind').inputValue(),
    'the picker set its own state instead of the control the walk reads').toBe('report');
});

/* ══ 3. `K` CYCLES ONTO IT, AND THE COUNT NAMES IT ═══════════════════════ */

test('check 3: K cycles onto `report` and the count says what it is counting', async ({ page }) => {
  await openLane(page);
  const everyKind = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();

  const walked: string[] = [];
  const counts: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('KeyK');
    walked.push(await page.locator('.tvnavkind').inputValue());
    counts.push((await page.locator('.tvnavmarkcount').textContent() ?? '').trim());
  }
  console.log(`[report] K walked ${JSON.stringify(walked)}`);
  console.log(`[report] counts ${JSON.stringify(counts)}`);

  expect(walked, 'K did not walk the select in its own order, and the ring must come home to '
    + '"every kind" or a keyboard reader can enter the filter and not leave')
    .toEqual(['report', 'table', '']);
  expect(counts[0], 'the counter never noticed the key').not.toBe(everyKind);
  expect(counts[0], 'the count changed its meaning without saying so — the same "1" stands for '
    + 'every mark one second and every report the next').toContain('a report');
  expect(counts[0], 'and it must report the ONE report this lane holds').toContain('1');
  expect(counts[2], 'coming home did not restore the unnarrowed sentence').toBe(everyKind);
});

/* ══ 4. IT DRAWS IN ITS HUE, IN THE LIST AND IN THE DOCUMENT ═════════════ */

test('check 4: a report draws in the found hue, on the row and in the document alike', async ({ page }) => {
  await openArchive(page);
  const listRow = await page.locator('.convanchor').evaluateAll((nodes) => nodes.map((n) => {
    const field = n.querySelector('.convanchorkind');
    return {
      word: (field?.textContent ?? '').trim(),
      cls: field?.getAttribute('class') ?? '',
      colour: field === null ? '' : getComputedStyle(field).color,
    };
  }));
  console.log(`[report] list kinds ${JSON.stringify(listRow)}`);
  const inList = listRow.find((r) => r.word.includes('report'));
  expect(inList, 'no report row reached the marks list').toBeDefined();
  expect(inList?.cls, 'the report row carries no hue group, so it draws in the standing grey — '
    + 'which is what a kind added to the core and not to `ANCHOR_KIND_HUE` looks like')
    .toContain('kindfound');

  // The ANTI-VACUITY half: the grey is a real state on this screen, and the
  // report must not be in it. `his ruling` is `kindsettled` and the table is
  // `kindfound`, so three of the four groups are exercised by one fixture.
  const settled = listRow.find((r) => r.cls.includes('kindsettled'));
  expect(settled, 'no settled mark reached the list, so "the report is not grey" is measured '
    + 'against nothing').toBeDefined();
  expect(inList?.colour, 'the report and the ruling painted the same colour, so the groups are '
    + 'not what the screen is drawing').not.toBe(settled?.colour);

  await openLane(page);
  const inDoc = await page.evaluate(() => [...document.querySelectorAll('.tvanchorkind')]
    .map((n) => ({
      word: (n.textContent ?? '').trim(),
      cls: n.getAttribute('class') ?? '',
      colour: getComputedStyle(n).color,
    })));
  console.log(`[report] document kinds ${JSON.stringify(inDoc)}`);
  const drawn = inDoc.find((r) => r.word.includes('report'));
  expect(drawn, 'the document drew no report kind at all — the item\'s defect is '
    + '`.convanchorkind` AND `.tvanchorkind`, "on the row and in the document alike", so a fix '
    + 'on one surface is half a fix').toBeDefined();
  expect(drawn?.cls).toContain('kindfound');
  expect(drawn?.colour, 'the document painted the report a different colour from the list')
    .toBe(inList?.colour);
});

/* ══ 5. STEPPING TO IT LANDS ON THE TURN IT MARKS ════════════════════════ */

test('check 5: stepping the report walk lands on the lane\'s final answer', async ({ page }) => {
  await openLane(page);
  // The picker is in the step panel since `semantic/15`.
  await usePanelAt(page, 1, 'navigate');
  await page.locator('.tvnavkind').selectOption('report');
  await expect(page.locator('.tvnavmarkcount')).toContainText('a report', { timeout: 10_000 });
  await jumpTo(page, 'top');

  /*
   * **THE LANDING IS CHECKED BY WHAT THE READER CAN SEE, NOT BY AN INDEX.**
   *
   * A `.tvrow`'s `data-n` is the document's own section number and it is NOT
   * the record index of the transcript — measured here: the lane's final answer
   * is record 42 of 43 and a different section number. And the row at the TOP
   * of the well is not the answer either, because the last turn of a document
   * cannot be scrolled to the top: the scroller runs out first. Both of those
   * are facts about a viewer rather than about a mark, so neither is what this
   * test asks. What it asks is the reader's own question — *did it put the turn
   * my bookmark names in front of me* — and `toBeInViewport` is that question.
   */
  const reportTurn = page.locator('.tvrow').filter({
    has: page.locator('.tvanchorkind', { hasText: 'a report' }),
  });
  /*
   * **AT THE TOP IT IS NOT IN THE DOM AT ALL**, and that is the anti-vacuity
   * half rather than an accident: the well evicts a row the moment it leaves
   * the window, which `.convanchsaid`'s own header states as the reason a
   * landing is announced OUTSIDE the well. So a count of zero here is the
   * strongest form of "the step is doing the work" — the turn is 41 rows down a
   * document taller than the viewport, and nothing about it exists to be seen.
   */
  await expect(reportTurn, 'the report turn is already drawn from the TOP of the document, so '
    + '"the step brought it into view" would be true without the step — the fixture must be '
    + 'taller than the window or this proof carries no power')
    .toHaveCount(0);

  await page.locator('.tvnavmarknext').click();
  await expect(page.locator('.tvnavsaid')).toContainText('1 of 1', { timeout: 10_000 });
  const said = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[report] said "${said}"`);

  await expect(reportTurn, 'the report walk stopped somewhere other than on the lane\'s final '
    + 'answer — which is the whole of what a `report` mark means, and the one thing a reader '
    + 'uses it for').toBeInViewport({ timeout: 10_000 });
  await expect(reportTurn, 'and the turn it landed on is not the one the report names')
    .toContainText('Done. Here is what changed');
  // The other mark in this document, and the one a walk that ignored its filter
  // would have landed on first. It is 40 turns back, so the same eviction that
  // made the check above honest keeps it out of the DOM here.
  await expect(page.locator('.tvrow').filter({ hasText: 'What the pass counted' }),
    'the walk landed near the TABLE turn as well, so the filter narrowed nothing')
    .toHaveCount(0);
  expect(said, 'a landing announced a position without saying what it is a position IN')
    .toContain('a report');

  // The label the landing names is the LANE'S MISSION, which is the half that
  // makes a list of 189 reports readable: a header cell would not say which
  // lane this was.
  expect(said, 'the landing did not name the mark, so a reader stepping through reports cannot '
    + 'tell which lane they have arrived in').toContain(MISSION.slice(0, 30));
});
