/**
 * **The focus dialog — `#focusbtn` opens `#focuspop`, and a choice reaches a
 * composed command.**
 *
 * `plan:walk seq:115`, the other half of `e2e/session-picker.spec.ts`. Both
 * title-bar triggers shipped carrying `aria-haspopup="dialog"` at ids that had
 * no markup anywhere, so two controls in the header did nothing when pressed.
 * That file drives the session picker; this one drives the focus dialog.
 *
 * ── THE TWO DIALOGS ARE OPPOSITE CASES, AND THAT IS WHAT IS ASSERTED ──────
 *
 * The session picker is a READ: it moves which session the screens ask about
 * and writes nothing, which is the ruling that lets it skip the approval
 * boundary. A FOCUS is not. It changes what Claude receives on the next event —
 * `mycontext focus` writes `state/focus.json` — and this UI does not write. So
 * the dialog COMPOSES a command line and hands it to the one Copy-and-Execute
 * control every composing screen already uses (`lib/command-actions.js`), and
 * test 2 below counts every request the page makes while three different lines
 * are composed and fails on any method that is not GET. A POST here is that
 * ruling being violated, not a detail.
 *
 * ── WHY A BROWSER ─────────────────────────────────────────────────────────
 *
 * Spec §6: the DOM glue (`app.js`, `screens/*.js`) is deliberately untested by
 * the node suite, so a browser is the only place any of this is measurable. And
 * three of the four things this dialog must get right are not observable from
 * markup at all — where focus IS, whether Escape gives it back, and whether
 * `aria-expanded` describes the state the dialog is actually in. A static check
 * reads the authored `aria-expanded="false"` and passes over a trigger that can
 * never expand anything, which is precisely the defect that shipped.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** Where focus is, and what the trigger claims — the two facts under test. */
async function state(page: Page): Promise<{
  hidden: boolean; expanded: string | null; focusInside: boolean; focusId: string;
  focusRow: string | null;
}> {
  return page.evaluate(() => ({
    hidden: document.querySelector<HTMLElement>('#focuspop')!.hidden,
    expanded: document.querySelector('#focusbtn')!.getAttribute('aria-expanded'),
    focusInside: document.activeElement?.closest('#focuspop') !== null,
    focusId: (document.activeElement as HTMLElement | null)?.id ?? '(none)',
    // Which CHOICE holds focus, if any — the rows carry no id, so this is the
    // only way to say "the first row" rather than merely "somewhere inside".
    focusRow: (document.activeElement as HTMLElement | null)?.dataset?.focus ?? null,
  }));
}

/* ══ 1 · THE DIALOG ITSELF ═══════════════════════════════════════════════ */

test('the focus dialog opens, takes focus, and gives it back', async ({ app }) => {
  const { page } = app;

  // The authored starting state, read back rather than assumed: a trigger that
  // began life expanded would make every assertion below meaningless.
  expect((await state(page)).hidden, '#focuspop starts hidden').toBe(true);
  expect((await state(page)).expanded, '#focusbtn starts collapsed').toBe('false');

  await page.click('#focusbtn');
  const open = await state(page);
  expect(open.hidden, '#focusbtn must open #focuspop — the whole defect is that it did not')
    .toBe(false);
  expect(open.expanded, '#focusbtn must say it is expanded, or a screen reader is told the '
    + 'opposite of what is on screen').toBe('true');
  // **The assertion that a keyboard user is not stranded.** The dialog follows
  // the header in DOM order, so without this the reader's focus is still on the
  // trigger and reaching the choices is luck of ordering rather than design.
  expect(open.focusInside, 'focus must move into #focuspop').toBe(true);
  expect(open.focusRow, 'and it lands on the first CHOICE, not on the dialog box — focusing a '
    + '<div role="dialog"> would announce the whole dialog before the reader could act')
    .toBe('live');

  // Escape closes it AND hands focus back. The second half is the half a hidden
  // dialog breaks silently: `display:none` on the focused element drops focus
  // to <body>, and the reader loses their place with nothing on screen to say so.
  await page.keyboard.press('Escape');
  const closed = await state(page);
  expect(closed.hidden, 'Escape closes #focuspop').toBe(true);
  expect(closed.expanded, 'and the trigger stops claiming to be expanded').toBe('false');
  expect(closed.focusId, 'Escape must return focus to the control the dialog was opened from')
    .toBe('focusbtn');

  // A click OUTSIDE dismisses too — and deliberately does not move focus,
  // because the click has already put focus where the reader aimed it.
  await page.click('#focusbtn');
  expect((await state(page)).hidden, 'reopened for the outside-click case').toBe(false);
  await page.click('.body');
  const dismissed = await state(page);
  expect(dismissed.hidden, 'a click outside the dialog dismisses it').toBe(true);
  expect(dismissed.expanded, 'and `aria-expanded` follows it down').toBe('false');

  // And the trigger is a toggle: pressing it again closes what it opened.
  await page.click('#focusbtn');
  await page.click('#focusbtn');
  expect((await state(page)).hidden, '#focusbtn toggles its own dialog shut').toBe(true);

  // ONE AT A TIME. The two dialogs share a corner of the screen — `.pop` seats
  // both at the same inset — so two open at once is two dialogs stacked on one
  // another. Driven across the pair, which is the case a table-driven
  // `togglePopover()` could regress without either single dialog failing.
  await page.click('#sessbtn');
  await page.click('#focusbtn');
  const exclusive = await page.evaluate(() => ({
    sess: document.querySelector<HTMLElement>('#sesspop')!.hidden,
    sessExpanded: document.querySelector('#sessbtn')!.getAttribute('aria-expanded'),
    focus: document.querySelector<HTMLElement>('#focuspop')!.hidden,
  }));
  expect(exclusive.sess, 'opening the focus dialog closes the session picker').toBe(true);
  expect(exclusive.sessExpanded, 'and the picker\'s trigger stops claiming to be expanded')
    .toBe('false');
  expect(exclusive.focus, 'and the one that was asked for is open').toBe(false);
  await page.keyboard.press('Escape');
});

/* ══ 2 · THE CHOICE REACHES A COMPOSED COMMAND ═══════════════════════════ */

/**
 * **The state change this dialog exists to produce.**
 *
 * Not a screen re-read — that is the session picker's half, and a focus that
 * re-read a screen would be a focus this page had APPLIED. What changes here is
 * the command line the dialog composes, which is the whole of what a
 * composes-never-writes control may change, and it is driven through all three
 * of its branches.
 */
test('a choice composes a mycontext focus line, and nothing writes', async ({ app }) => {
  const { page } = app;

  // Counted from before the first click, so a write taken on ANY of the three
  // compositions below is caught rather than only one of them.
  const methods: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) methods.push(request.method());
  });

  await page.click('#focusbtn');
  const line = page.locator('#focusargv');
  const off = page.locator('#focuspop .row[data-focus="off"]');
  const live = page.locator('#focuspop .row[data-focus="live"]');

  // ── The opening composition ────────────────────────────────────────────
  //
  // `--show` and not a bare `mycontext focus`: the standing row is "the focus
  // that is set" and no tags have been named, so the honest line REPORTS the
  // focus. A bare `mycontext focus` would set a focus of nothing, which is not
  // what the row says.
  await expect(line, 'the dialog must open onto a composed line, never an empty box')
    .toHaveText('mycontext focus --show');
  await expect(live, 'the standing row is the marked one').toHaveAttribute('aria-selected', 'true');
  await expect(off).toHaveAttribute('aria-selected', 'false');

  // **The one Copy-and-Execute control, reused rather than respelled.** Selected
  // by TEXT because the control's buttons are deliberately classless — see
  // `lib/command-actions.js`, which records why `.copy`/`.exec` were deleted.
  await expect(page.locator('#focusact .cmdactions button'),
    'the composed line must be handed to the shared control, not to a copy button of this '
    + 'dialog\'s own — the confirm inside that control IS the approval boundary')
    .toHaveText(['Copy']);

  // ── Focus off ──────────────────────────────────────────────────────────
  await off.click();
  await expect(line, 'choosing "focus off" must compose the command\'s own spelling for it')
    .toHaveText('mycontext focus --clear');
  await expect(off, 'and the chosen row is the marked one').toHaveAttribute('aria-selected', 'true');
  await expect(live).toHaveAttribute('aria-selected', 'false');
  // The dialog STAYS OPEN, unlike the session picker: its whole answer is the
  // line inside it, so there is somewhere left to look.
  expect((await state(page)).hidden, 'a choice must not dismiss the dialog holding its answer')
    .toBe(false);

  // ── Tags ───────────────────────────────────────────────────────────────
  await live.click();
  await page.fill('#focustags', 'v2,ui');
  await expect(line, 'tags compose `--tag`, the flag the CLI documents; a comma-separated list '
    + 'is inside quoteArg\'s safe set and so is not quoted')
    .toHaveText('mycontext focus --tag v2,ui');

  // A value that needs quoting is quoted, which is the property that makes the
  // shown line and the copied line the same string in a shell.
  await page.fill('#focustags', 'two words');
  await expect(line).toHaveText('mycontext focus --tag "two words"');

  // Whitespace alone is not a tag list. The box is trimmed, so it falls back to
  // the reporting line rather than composing `--tag "   "`.
  await page.fill('#focustags', '   ');
  await expect(line, 'a box holding only spaces names no tags').toHaveText('mycontext focus --show');

  // ── NOTHING WROTE ──────────────────────────────────────────────────────
  //
  // THE RULING, asserted. The focus dialog composes; applying the line is the
  // shared control's act, behind its confirm and its single-use nonce. A POST
  // taken from a row click or a keystroke would be a second approval route,
  // which is the one thing this dialog may not grow.
  expect([...new Set(methods)],
    'THE FOCUS DIALOG COMPOSES AND DOES NOT WRITE. Every request the page made while three '
    + 'different lines were composed must be a GET; a non-GET here is the approval boundary '
    + 'being routed around.').not.toContain('POST');

  await page.keyboard.press('Escape');
});
