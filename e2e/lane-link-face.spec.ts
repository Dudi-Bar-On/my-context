// @basis TASK-the-lane-link-inherits-the-jump-button-s-styling-and-a, DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
/**
 * **A LINK LOOKS LIKE A LINK, AND NOT LIKE A JUMP BUTTON** — `plan:archive
 * seq:31`, measured in a real browser in both languages.
 *
 * `plan:archive seq:15` shipped `laneLink` wearing `.tvjump`, the class Top,
 * End and "N new below" wear, because `src/ui/public/styles.css` belonged to
 * another lane the night it landed. The consequence was not a broken control —
 * it works, and its behaviour is asserted in `e2e/conversations.spec.ts` — it
 * was THREE affordances stacked on one sentence: a border, a monospace face
 * meant for identifiers, and the user agent's own underline.
 *
 * ── WHY THIS IS MEASURED IN A BROWSER AND NOT READ OUT OF THE FILE ─────────
 *
 * The markup is `class="tvjump tvlane"` and it stays that way: `laneLink` is
 * in another lane's file and `e2e/conversations.spec.ts` names `a.tvlane` and
 * `a.tvlanehome` as handles. So the new rules do not REPLACE `.tvjump`, they
 * OVERRIDE it, and they do so on source order alone — two single-class
 * selectors of equal specificity, the later one winning. A grep proving the
 * rule exists would prove nothing about which of the two the browser picked.
 * Only the cascade's own answer settles it, so every assertion below reads
 * `getComputedStyle`.
 *
 * ── AND IT IS COMPARED AGAINST THE PAGE, NEVER AGAINST A LITERAL ───────────
 *
 * "sans" is asserted as *the same family the body already uses* and "not mono"
 * as *a different family from the `.tvjump` button beside it*, rather than
 * against the string in `--sans`. `--gold` is resolved by a probe element
 * painted `color:var(--gold)` in the live document. A literal `#eab308` or
 * `"Geist"` here would go red on the next repaint while the design intent —
 * this link is set in the page's own text face, in the page's own link hue —
 * held perfectly.
 *
 * ── TWO CONTROLS, AND THE SECOND ONE IS NOT DECORATION ─────────────────────
 *
 * `.tvlane` sits inline in `.tvstephead`, inside a fold on the turn that
 * dispatched the lane. `.tvlanehome` sits in `.tvnote` on a lane document's
 * own head. Both are sentences, both wore `.tvjump`, and they are reached by
 * different renderers — so both are measured, and the head one is measured
 * first because it needs no fold and would still stand if the fold's markup
 * moved underneath this file.
 *
 * The fixture is deliberately TINY — one session, one dispatching turn, one
 * lane — because nothing here is about scrolling, virtualisation or the
 * reader's position. `e2e/conversations.spec.ts` owns those and proves them on
 * a 120-round document; this file asks one question about paint.
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

const SESSION = 'sess-face';
const LANE_CALL = 'toolu_FACE_LANE';
const LANE_BRIEF = 'read the stylesheet and report what it paints';
const LANE_PHRASE = 'the working that produced the face report';
const OPENING = 'what does the lane link look like';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-face-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-face-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: OPENING }, timestamp: '2026-09-09T09:00:00.000Z' },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: LANE_CALL, name: 'Agent', input: { prompt: LANE_BRIEF } }],
      },
      timestamp: '2026-09-09T09:00:01.000Z',
    },
    { type: 'assistant', message: { role: 'assistant', content: text('and that is what it looks like') }, timestamp: '2026-09-09T09:00:09.000Z' },
  ]));

  const lanes = path.join(dir, SESSION, 'subagents');
  mkdirSync(lanes, { recursive: true });
  writeFileSync(path.join(lanes, 'agent-face.jsonl'), jsonl([
    { type: 'user', message: { role: 'user', content: LANE_BRIEF }, timestamp: '2026-09-09T09:00:02.000Z' },
    { type: 'assistant', message: { role: 'assistant', content: text(LANE_PHRASE) }, timestamp: '2026-09-09T09:00:03.000Z' },
  ]));
  writeFileSync(path.join(lanes, 'agent-face.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'Read the stylesheet',
    toolUseId: LANE_CALL, spawnDepth: 1,
  }));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
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

/** One page load, at a hash, in one language — `conversations.spec.ts`' `open`, for its reasons. */
async function open(page: Page, hash: string, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash);
  await page.waitForSelector('.convrow, .tvturn, .spill', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/** What the browser actually decided to paint this control, plus the two yardsticks. */
const face = (link: Locator): Promise<{
  fontFamily: string; decoration: string; color: string;
  borderWidths: string[]; background: string;
  bodyFamily: string; jumpFamily: string; gold: string;
}> => link.evaluate((n) => {
  const el = n as HTMLElement;
  const s = getComputedStyle(el);
  // THE HUE IS RESOLVED IN THE LIVE DOCUMENT, not copied from the file. A
  // probe painted `var(--gold)` answers with whatever the current theme,
  // language and media state make that token mean.
  const probe = document.createElement('span');
  probe.style.color = 'var(--gold)';
  document.body.append(probe);
  const gold = getComputedStyle(probe).color;
  probe.remove();
  // The nearest control still wearing `.tvjump` alone — a real jump button,
  // whose mono face is the thing this link must no longer share.
  const jump = document.querySelector('.tvbar button.tvjump');
  return {
    fontFamily: s.fontFamily,
    decoration: s.textDecorationLine,
    color: s.color,
    borderWidths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
    background: s.backgroundColor,
    bodyFamily: getComputedStyle(document.body).fontFamily,
    jumpFamily: jump === null ? '' : getComputedStyle(jump).fontFamily,
    gold,
  };
});

/**
 * The whole claim, asserted the same way about both controls: ONE affordance,
 * and it is the one this stylesheet already uses for a link.
 */
async function expectsALinkFace(link: Locator, where: string): Promise<void> {
  await expect(link, `${where}: the control must be on the page to be measured`).toBeVisible();
  const f = await face(link);

  expect(f.jumpFamily, `${where}: a real jump button must be on the page as the mono yardstick`)
    .not.toBe('');
  expect(f.fontFamily, `${where}: a sentence is set in the page's own text face`)
    .toBe(f.bodyFamily);
  expect(f.fontFamily, `${where}: and no longer in the identifier face the jump buttons wear`)
    .not.toBe(f.jumpFamily);

  // THE BORDER IS GONE ON ALL FOUR SIDES, checked physically rather than
  // through `border-inline-start`: whichever way `dir` points, a box drawn
  // around a wrapping sentence is the defect, and under RTL the logical
  // sides swap. Four zeroes is the only answer that is right in both.
  expect(f.borderWidths, `${where}: no box around a sentence that wraps`)
    .toEqual(['0px', '0px', '0px', '0px']);
  expect(f.background, `${where}: and no panel ground either`).toBe('rgba(0, 0, 0, 0)');

  // WHAT SURVIVES: the underline, and `--gold`. `.tvsaid a` is already this
  // hue for exactly this meaning, so no sixth hue is spent and the budget
  // `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` rules is
  // untouched.
  expect(f.decoration, `${where}: the one affordance a reader does not have to learn`)
    .toBe('underline');
  expect(f.color, `${where}: the hue this file already gives a link inside a transcript`)
    .toBe(f.gold);
}

for (const lang of ['en', 'he'] as const) {
  test(`the back-link on a lane's own head is a link, not a jump button (${lang})`, async ({ page }) => {
    // Opened DIRECTLY, which is what the new tab `laneLink` opens actually is.
    // Nothing here needs a fold, so this assertion stands even if the fold's
    // markup changes underneath this file.
    await open(page, '#/conversations/agent-face', lang);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expectsALinkFace(page.locator('a.tvlanehome').first(), `${lang} · the lane head`);
    // THE ELEMENT, never `fullPage`. A full-page shot resizes the viewport,
    // which re-lays this document out and can hand back a picture of a state
    // no assertion above ever saw — the trap `plan:archive seq:15` recorded.
    // `e2e/screens/` is git-ignored, so this is a look, not an artefact.
    await page.locator('p.tvlaneof').screenshot({ path: `e2e/screens/lane-face-head-${lang}.png` });
  });

  test(`the lane link on the dispatching step is a link, not a jump button (${lang})`, async ({ page }) => {
    await open(page, `#/conversations/${SESSION}`, lang);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    // The fixture is three records long, so the whole document is drawn and
    // the fold needs no scrolling to reach — the reason this file keeps its
    // own tiny session instead of borrowing the 120-round one.
    const fold = page.locator('details').filter({ has: page.locator('a.tvlane') }).first();
    await expect(fold, 'the dispatching turn must draw its fold').toHaveCount(1);
    await fold.locator('summary').first().click();

    await expectsALinkFace(page.locator('a.tvlane').first(), `${lang} · the dispatching step`);
    await fold.screenshot({ path: `e2e/screens/lane-face-step-${lang}.png` });
  });
}
