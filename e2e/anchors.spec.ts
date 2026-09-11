// @basis TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// INV-nothing-is-dropped-silently
/**
 * **ANCHORS, SET TWO WAYS, DRIVEN IN A BROWSER** — `plan:recall seq:1` Task 4
 * and §7 of `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * The owner's ruling is that he marks one, and that things which are anchors
 * by nature — *"a table, a report"*, a ruling he gave — are marked *"without
 * requiring the user to initiate one"*. Both halves are on this screen and
 * both are driven here.
 *
 * ── THE HALF A UNIT TEST CANNOT SEE ──────────────────────────────────────
 *
 * The page cannot mark an anchor: the server is read-only, and the treatment
 * every write on this screen gets is the one `conv.secrets.run` already uses —
 * the command is COMPOSED from the argv the server built, shown, and run by a
 * person. So the assertion that matters is not that a button exists but that
 * **the line it reveals carries the byte offset of the turn on screen**, and
 * that it offers Copy and NOT Execute. `mycontext conversation anchor` is in
 * no catalogue entry; a browser that could run it would be the read-only
 * guarantee failing at the one place a new feature most wants to break it.
 *
 * ── THE FIXTURE IS PLANTED, AND THAT IS THE POINT OF IT ──────────────────
 *
 * Three turns that ARE anchors by nature and three that are not, in one
 * session. The automatic pass is asserted to mark exactly the first three, so
 * a detector that fired on prose would show up here as a fourth row rather
 * than as a number nobody checks.
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
 * (`src/cli/commands/conversation.ts`) now answers `header.find(isReadable)`,
 * so `| tokenizer | hits |` is anchored as `tokenizer` rather than as
 * `tokenizer | hits`.
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

const TURNS = [
  say('user', `follow ${RULING} here`, '2026-09-10T09:00:00.000Z'),
  say('assistant', TABLE_TURN, '2026-09-10T09:00:01.000Z'),
  say('assistant', `I wrote it up in ${REPORT} today`, '2026-09-10T09:00:02.000Z'),
  say('assistant', PROSE, '2026-09-10T09:00:03.000Z'),
  say('user', 'שלום, כאן אין מזהה פריט בכלל ואין טבלה', '2026-09-10T09:00:04.000Z'),
  say('assistant', 'and a shell pipeline | grep -v Warning | head -5 is not a table',
    '2026-09-10T09:00:05.000Z'),
];

/** Where record `n` starts, in BYTES — what the composed command must carry. */
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

for (const lang of ['en', 'he'] as const) {
  test(`the viewer composes the command that marks a point, and never runs it · ${lang}`, async ({ page }) => {
    await open(page, lang);
    // A turn the automatic pass did NOT mark — the ordinary prose one — or
    // there would be no offer to compose, which is the other test below.
    await page.locator('.convarchq').fill('afternoon');
    const hit = page.locator('.convhit').first();
    await expect(hit).toBeVisible({ timeout: 20_000 });

    // Closed until asked for: a composed write is an offer, not a thing the
    // screen puts in front of a reader who was searching.
    await expect(hit.locator('.convhitcmd')).toBeHidden();
    await hit.locator('.convhitmarkbtn').click();
    const line = hit.locator('.convhitcmd code');
    await expect(line).toBeVisible();

    // **The offset in the line is the offset of the turn on screen.** Asserted
    // as the WHOLE command rather than by substring: the session id, the
    // offset and the label each appear elsewhere on this page, and a
    // `toContainText` on any one of them would pass on a line built for a
    // different hit.
    await expect(line).toHaveText(
      `mycontext conversation anchor ${SESSION} ${offsetOf(3)} --label afternoon`,
    );

    // Copy and NOT Execute. `conversation anchor` is in no catalogue entry, so
    // a Run control here would be a browser performing a write.
    const actions = hit.locator('.convhitcmd');
    await expect(actions.getByRole('button')).toHaveCount(1);

    await page.screenshot({ path: `e2e/screens/anchors-mark-${lang}.png`, fullPage: true });
  });
}

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

test('an anchor the archive holds is drawn on its hit as already marked', async ({ page }) => {
  await open(page, 'en');
  await page.locator('.convarchq').fill('afternoon');
  const plain = page.locator('.convhit').first();
  await expect(plain).toBeVisible({ timeout: 20_000 });
  await expect(
    plain.locator('.convhitmarked'),
    'an ordinary turn is not marked, and the screen must not say it is',
  ).toHaveCount(0);
  await expect(plain.locator('.convhitmarkbtn')).toBeVisible();

  // The TABLE turn is one the automatic pass marked, so the hit that lands on
  // it says so instead of offering to mark it a second time.
  await page.locator('.convarchq').fill('unicode61');
  const marked = page.locator('.convhit').first();
  await expect(marked.locator('.convhitmarked')).toBeVisible({ timeout: 20_000 });
  await expect(marked.locator('.convhitmarkbtn')).toHaveCount(0);
});
