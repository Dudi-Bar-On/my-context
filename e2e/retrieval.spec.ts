// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently,
// RULE-drive-the-ui-through-playwright-while-doing-the-work-not
/**
 * **RECONSTRUCT, DRIVEN IN A BROWSER** — `plan:recall seq:2` Tasks 11 and 12,
 * and §4, §9, §10 and §10a of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHAT ONLY A BROWSER CAN SAY HERE ──────────────────────────────────────
 *
 * A unit test can prove `markReturn` marks. It cannot prove that the sentence
 * *nothing has been sent anywhere* is on the screen beside the text it is true
 * of, that the reversed ruling is drawn as its own region rather than only
 * buried in a `<pre>` a reader may not scroll, that unticking a claim actually
 * removes it from what comes back, or that a second round is offered on the
 * claim he picked. Those are the four things this file drives, in both
 * languages, because they are the four a reader acts on.
 *
 * ── THE FIXTURE IS PLANTED, AND THE SUPERSESSION IS REAL ─────────────────
 *
 * `mycontext supersede` writes both halves of a retirement — the successor's
 * `supersedes` and the retiree's `superseded_by` plus its status — so the
 * fixture is a genuine supersession rather than a field set by hand. That
 * matters: the marking asks the corpus, and a hand-written status would be
 * testing the fixture rather than the corpus.
 *
 * One claim names the reversed ruling, one names a ruling still in force, and
 * one names nothing. The middle claim is the NEGATIVE: a marking that warned
 * about everything would say nothing, and without a standing ruling in the
 * same result nothing here would notice.
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

const SESSION = 'sess-recall';
const REVERSED = 'DEC-the-ui-is-developed-against-a-simulated-corpus-until-the';
const SUCCESSOR = 'INSTR-testing-happens-against-the-current-corpus-and-an-exception';
const STANDING = 'INV-nothing-is-dropped-silently';

/** The subject of claim 3 — named in no other claim, so a section can be told apart. */
const SUBJECT = 'The anchors table is keyed by session and byte offset.';

const RESULT_ID = 'recall-0001';
const RESULT = [
  `# Retrieval result — ${RESULT_ID}`,
  '',
  '**Written** 2026-09-10T08:00:00.000Z · **mode** `list-subjects`',
  `**Mission** \`.my_context/.retrieval/${RESULT_ID}.mission.md\``,
  '',
  '## What it found',
  '',
  `- The browser suite ran against a stand-in corpus under ${REVERSED}. [commit a50fc84]`,
  `- Nothing is dropped without a line saying so — ${STANDING}. [file src/core/retrieval/noise.ts:264]`,
  `- ${SUBJECT} [turn ${SESSION}@0]`,
  '',
].join('\n');

/** A passage dense in NAMES, which is what §3 measured as the thing that matches. */
const PASSAGE = `we ruled on ${REVERSED} and the code lives in src/core/anchors.ts`;

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const TURNS = [
  {
    type: 'user',
    message: { role: 'user', content: `follow ${STANDING} here` },
    timestamp: '2026-09-10T09:00:00.000Z',
  },
  // **The turn the material table is built out of.** The passage names this
  // id, so the archive must hold a turn naming it too — otherwise the mission
  // honestly carries no points and the assertion below is measuring the
  // fixture rather than the screen. That is how the empty-table defect was
  // found in the first place, so the fixture says why it is shaped this way.
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: `we ruled on ${REVERSED} and it stands for now` }],
    },
    timestamp: '2026-09-10T09:00:00.500Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'שלום, כאן אין מזהה פריט' }] },
    timestamp: '2026-09-10T09:00:01.000Z',
  },
];

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-recall-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-recall-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(TURNS));
  process.env['CLAUDE_CONFIG_DIR'] = home;

  const previous = process.cwd();
  process.chdir(cwd);
  try {
    const run = (argv: string[]): number => runCli(argv, cwd, () => {});
    if (run(['init']) !== 0) throw new Error('the probe workspace did not initialize');
    if (run(['conversation', 'rebuild']) !== 0) throw new Error('the archive did not build');
    if (run([
      'add', 'decision', 'The UI is developed against a simulated corpus until the shell lands',
      '--body', 'The browser suite runs against a fixture rather than the live corpus.',
      '--summary', 'The browser tests use a stand-in corpus for now.', '--yes',
    ]) !== 0) throw new Error('the reversed decision was not created');
    if (run([
      'add', 'instruction', 'Testing happens against the current corpus and an exception',
      '--body', 'Dogfooding: every test runs on the live corpus unless he approves otherwise.',
      '--summary', 'Tests run against the real corpus unless he approves an exception.', '--yes',
    ]) !== 0) throw new Error('the successor was not created');
    if (run([
      'add', 'invariant', 'Nothing is dropped silently',
      '--body', 'Every omission is disclosed where it happened.',
      '--summary', 'Anything left out is said out loud.', '--yes',
    ]) !== 0) throw new Error('the standing invariant was not created');
    if (run([
      'supersede', REVERSED, '--by', SUCCESSOR, '--reason', 'overruled 2026-09-07', '--yes',
    ]) !== 0) throw new Error('the supersession was not written');
  } finally {
    process.chdir(previous);
  }

  const results = path.join(cwd, '.my_context', '.retrieval');
  mkdirSync(results, { recursive: true });
  writeFileSync(path.join(results, `${RESULT_ID}.result.md`), RESULT, 'utf8');

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
  // **30s, not 20** — `e2e/scratch-corpus.ts`' `openSeeded` uses the same
  // number for the same reason. `beforeAll` here builds a workspace, an
  // archive index, three items and a supersession, ONCE PER WORKER, and at
  // four workers one run in three left this wait 20s short. Measured rather
  // than assumed: serial, 7 of 7 in 21.8s; parallel, 6 of 7 then 7 of 7. It is
  // the fixture's cost, not a slow screen.
  await page.waitForSelector('.convrecall', { timeout: 30_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

for (const lang of ['en', 'he'] as const) {
  test(`the four modes are offered, and a passage becomes a brief · ${lang}`, async ({ page }) => {
    await open(page, lang);

    // **Step 1 — the four modes.** Counted and named by their `data-mode`,
    // never by their label: the labels are in two string tables and a test
    // that read them would be asserting the translation rather than the offer.
    const modes = page.locator('button.convrecallmode');
    await expect(modes).toHaveCount(4);
    await expect(page.locator('button.convrecallmode[data-mode="from-selection"]')).toBeVisible();
    await expect(page.locator('button.convrecallmode[data-mode="free-text"]')).toBeVisible();
    await expect(page.locator('button.convrecallmode[data-mode="list-subjects"]')).toBeVisible();
    await expect(page.locator('button.convrecallmode[data-mode="list-anchors"]')).toBeVisible();
    // One armed, and it says which — a radiogroup a reader cannot see the
    // highlight of still has to answer "which one".
    await expect(page.locator('button.convrecallmode[aria-checked="true"]')).toHaveCount(1);

    await page.locator('textarea.convrecallpassage').fill(PASSAGE);
    await page.locator('button.convrecallprepare').click();

    // The brief itself, and the NAMES it will look for. Asserted on the names
    // region rather than on the document: the passage is in the textarea and
    // the mission quotes the repository path, so a `page` level assertion on
    // the id would pass with the query region deleted.
    const names = page.locator('p.convrecallnames');
    await expect(names).toBeVisible({ timeout: 20_000 });
    await expect(names).toContainText(REVERSED);

    const mission = page.locator('pre.convrecallmission');
    await expect(mission).toBeVisible();
    // Three things a mission missing any one of produces a result nobody can
    // trust — Task 9 step 1, re-taken on the rendered text and on its own
    // HEADINGS rather than on loose words: "cite" and "verify" both occur in
    // the prose of other sections, so a word-level assertion would pass on a
    // brief that had lost the duty it names.
    await expect(mission).toContainText('## What you must do');
    await expect(mission).toContainText('## Every claim must CITE');
    await expect(mission).toContainText('## The material — open it at these points');
    await expect(mission).toContainText('against the CODEBASE and against GIT');

    // **THE MATERIAL IS NOT EMPTY.** A brief that says "open it at these
    // points" and then lists none reads as working and answers nothing — the
    // defect this whole assertion exists for, and one only a browser found.
    await expect(mission).not.toContainText('0 points.');
    const rows = await mission.evaluate((node) => (node.textContent ?? '')
      .split(String.fromCharCode(10))
      .filter((line) => /^[|] \d+ [|]/.test(line)).length);
    expect(rows, 'the mission carries no material rows, so there is nothing to open')
      .toBeGreaterThan(0);
    // And it carries POINTERS, never the passage: the whole point is that the
    // noise does not enter a context window, the helper's included.
    await expect(mission).not.toContainText('we ruled on');

    await page.screenshot({ path: `e2e/screens/retrieval-brief-${lang}.png`, fullPage: true });
  });

  test(`a result is read, and what returns is marked · ${lang}`, async ({ page }) => {
    await open(page, lang);

    await page.locator('button.convrecallopen').first().click();
    const claims = page.locator('div.convrecallclaim');
    await expect(claims).toHaveCount(3, { timeout: 20_000 });

    // **Reading a result must not open the ITEM pane.** The first draft put
    // `data-id` on the row, and `installItemPane` opens on a click inside any
    // `[data-id]` — so every press of Read also opened a pane saying "no item
    // recall-0001 in this corpus". A result is not a corpus item.
    await expect(
      page.locator('#pane:not([hidden])'),
      'reading a retrieval result opened the corpus item pane',
    ).toHaveCount(0);

    // **Step 3 — he returns PART of it.** Untick the middle claim, which is
    // the one naming the ruling still in force, so the reversal region below
    // cannot be produced by the claim he dropped.
    await claims.nth(1).locator('input.convrecalltick').uncheck();
    await page.locator('button.convrecallreturn').click();

    // **Step 2 — THE SAFETY BOUNDARY, on screen, beside the text.** The one
    // sentence the whole feature rests on, and it is drawn BEFORE the payload
    // rather than under it.
    const safe = page.locator('p.convrecallsafe');
    await expect(safe).toBeVisible({ timeout: 20_000 });
    const marked = page.locator('pre.convrecallmarkedtext');
    await expect(marked).toBeVisible();
    await expect(
      safe.evaluate((node) => {
        const text = document.querySelector('pre.convrecallmarkedtext');
        return text === null
          ? false
          : (node.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }),
      'the safety sentence must be drawn before the text it is true of, not under it',
    ).resolves.toBe(true);

    // **Step 4 — the marking.** On the payload's own headings, not by
    // substring: the reversed id is inside claim 1, which is in this payload,
    // so `toContainText(REVERSED)` would pass on a build that dropped the
    // marking entirely.
    await expect(marked).toContainText('THIS IS A RECORD, NOT AN INSTRUCTION');
    await expect(marked).toContainText('REVERSED SINCE');
    await expect(marked).toContainText('2 of the 3 claims');

    // And the reversal is its OWN region, so a reader who does not scroll the
    // payload still sees it.
    const reversed = page.locator('p.convrecallreversedone');
    await expect(reversed).toHaveCount(1);
    await expect(reversed).toContainText(REVERSED);
    await expect(reversed).toContainText(SUCCESSOR);

    // The unticked claim is GONE from what returns, and its id with it. This
    // is the assertion that "part of a result" is real rather than cosmetic.
    await expect(marked).not.toContainText(STANDING);

    // **§10a — the second destination**, composed and not run.
    const stage = page.locator('.convrecallstagecmd code');
    await expect(stage).toBeVisible();
    await expect(stage).toContainText('restore --build --from-result');
    await expect(stage).toContainText('--claims 1,3');
    // What he would be approving, which is NOT the payload — D34's two
    // artefacts, kept two.
    const form = page.locator('pre.convrecallform');
    await expect(form).toBeVisible();
    await expect(form).toContainText('COVERAGE: PARTIAL');

    await page.screenshot({ path: `e2e/screens/retrieval-marked-${lang}.png`, fullPage: true });
  });

  test(`rounds compose: a subject is picked and the next brief is about it · ${lang}`, async ({ page }) => {
    await open(page, lang);
    await page.locator('button.convrecallopen').first().click();
    const claims = page.locator('div.convrecallclaim');
    await expect(claims).toHaveCount(3, { timeout: 20_000 });

    // Round one listed subjects; he picks the third.
    const banner = page.locator('p.convrecallround');
    await expect(banner).toBeHidden();
    await claims.nth(2).locator('button.convrecalldeeper').click();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(SUBJECT);

    await page.locator('button.convrecallprepare').click();
    const mission = page.locator('pre.convrecallmission');
    await expect(mission).toBeVisible({ timeout: 20_000 });
    await expect(mission).toContainText('## Round 2 — the subject he chose');
    await expect(mission).toContainText(SUBJECT);
    // The failure this guards: a second round that lists subjects again reads
    // as working, returns a file, and answers nothing he asked.
    await expect(mission).toContainText('Do not list subjects again');

    await page.screenshot({ path: `e2e/screens/retrieval-round2-${lang}.png`, fullPage: true });
  });
}

test('the retrieval panel is on the document too, seeded from the marked passage', async ({ page }) => {
  await open(page, 'en');
  // Into the document — the same `mountDocument` `/lane.html` runs.
  await page.locator('.convrow button, .convopen').first().click().catch(async () => {
    await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  });
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });

  // The control lives in the copy bar, beside the three copies, because that
  // is where a reader is the moment he has a passage marked.
  const control = page.locator('button.tvrecall');
  await expect(control).toBeVisible();
  await expect(page.locator('.convrecall')).toHaveCount(1);

  // **It starts CLOSED on a document, and the bare-lane measurement is why.**
  // `e2e/conversations.spec.ts` asserts that a `/lane.html` window gives the
  // well more than 55% of itself; mounted open, this panel took it to 33.3%.
  // A window whose whole purpose is one document may not spend two thirds of
  // itself on chrome nobody asked for.
  await expect(page.locator('.convrecallbox')).toBeHidden();

  await control.click();
  await expect(page.locator('.convrecallbox')).toBeVisible();
  await expect(page.locator('textarea.convrecallpassage')).toBeFocused();
  await page.screenshot({ path: 'e2e/screens/retrieval-on-document.png', fullPage: true });
});
