// @basis TASK-the-composer-is-tested-as-a-user-would-use-it-every-field
/**
 * **THE COMPOSER IN BOTH LANGUAGES, AND LOOKED AT RATHER THAN ONLY ASSERTED.**
 *
 * `plan:builder seq:11` (D12): *"it is tested AS A USER, not as a module: driven
 * in a browser, in both languages, clicking what a person clicks. A screen that
 * renders correctly and does nothing when used is the defect this rule exists
 * for. Three separate lanes found real defects this week by LOOKING AT A
 * SCREENSHOT after every assertion had passed — a chevron pointing the wrong
 * way, a leading dot migrating under RTL, and an output table shredded by a flex
 * container. Assertions are necessary and have repeatedly been insufficient."*
 *
 * So this file does two things a matrix sweep does not. It drives the form in
 * Hebrew — every kind of control, filled, switched and chosen, under
 * `dir="rtl"` — and it SAVES A PICTURE of each state, which is the artefact the
 * lane's report is written from.
 *
 * ── WHAT THE PICTURES ARE FOR, AND WHY THEY ARE NOT SNAPSHOTS ─────────────
 *
 * Not `toHaveScreenshot`. A golden image fails on a font hint and passes on a
 * table shredded into a diagonal fan if the fan was there when the golden was
 * taken; it answers "has this changed" and the question here is "is this right",
 * which only a person answers. The files are written to `test-results/` and
 * read by the lane, and the assertions beside them are the ones a machine CAN
 * make about layout: nothing overflows its card, the machine values stay
 * left-to-right inside the right-to-left flow, and the English runs the CLI
 * wrote carry `dir="auto"` so their closing punctuation stays attached.
 *
 * That last one is a defect this repository has measured twice — a leading dot
 * migrating under RTL, and 552 Hebrew sentences whose closing punctuation
 * detached 70px from the letter before it — and `foreignRun` is the repair.
 */
import path from 'node:path';
import { test, expect } from './app.ts';
import {
  CMD, DEFS, FORM, PAL, chooseEntry, composedLine, controlsOf, kindOf, openComposer,
  setValue, settled, specsOf,
} from './composer.ts';

const SHOTS = path.join(import.meta.dirname, '..', 'test-results', 'd12-composer');

/** Switch the whole shell to Hebrew, the way a person does: the one toggle. */
async function toHebrew(page: import('@playwright/test').Page): Promise<void> {
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

/**
 * Nothing on this screen is wider than the card that holds it.
 *
 * The Composer has been broken by exactly this twice — a 942-option `<select>`
 * at 3,902px and a 600-character example line at 1,325px of overflow — and both
 * are recorded in `builder.js`' own `paintEcho` docblock as the reason the echo
 * is a paragraph rather than a wider box. So it is measured rather than trusted,
 * in the language where a long machine value is most likely to escape.
 */
async function nothingOverflows(
  page: import('@playwright/test').Page, what: string,
): Promise<void> {
  const spills = await page.evaluate((sel) => {
    const card = document.querySelector(`${sel} .card.pane`);
    if (card === null) return ['the palette card is not on screen'];
    const width = card.getBoundingClientRect().width;
    const out: string[] = [];
    for (const node of card.querySelectorAll<HTMLElement>('*')) {
      const box = node.getBoundingClientRect();
      // 2px of slack for sub-pixel layout; a real overflow on this screen has
      // historically been hundreds of pixels, never one.
      if (box.width > width + 2) {
        out.push(`${node.tagName.toLowerCase()}.${node.className || '(none)'} `
          + `is ${Math.round(box.width)}px inside a ${Math.round(width)}px card`);
      }
    }
    // **AND THE SCROLL WIDTH, which is the measurement the loop above cannot
    // make.** A card that is `overflow-x: auto` CLIPS its children, so every
    // child reports a width inside the card while the card itself scrolls — the
    // element comparison passes and the reader still gets a horizontal
    // scrollbar and a first label reading `y *:` where `category *:` should be.
    // That is what the first Hebrew screenshot showed after this function had
    // already said the layout was clean, which is the item's whole point about
    // assertions being necessary and insufficient.
    for (const scroller of [card, ...card.querySelectorAll<HTMLElement>('*')]) {
      const el = scroller as HTMLElement;
      // **A FORM CONTROL SCROLLING ITS OWN VALUE IS NOT A LAYOUT DEFECT** — it
      // is what a text box does, and the whole reason `paintEcho` exists is
      // that a 67-character id does not fit in a 318px box. Measured here at
      // 38,566px of content in a 167px `<input>` for the item's own
      // very-long-string value, which is correct behaviour and would have made
      // this check cry wolf on every long value forever.
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)) continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.push(`${el.tagName.toLowerCase()}.${el.className || '(none)'} SCROLLS `
          + `horizontally: ${el.scrollWidth}px of content in ${el.clientWidth}px`);
      }
    }
    return out;
  }, PAL);
  expect(spills, `${what}: nothing may be wider than the card that holds it`).toEqual([]);
}

test('the Composer is driven in Hebrew, every kind of control, and photographed',
  async ({ app }) => {
    test.setTimeout(240_000);
    const { page } = app;
    await openComposer(page);
    await toHebrew(page);
    await openComposer(page);

    // `add` is the entry that carries one of every control kind the catalogue
    // has: a corpus-filled `<select>`, a plain box, a textarea, a tag list, a
    // glob, a closed vocabulary and several switches. Driving it in Hebrew
    // drives all seven.
    const def = await chooseEntry(page, 'add');
    const controls = await controlsOf(page, def);
    const kinds = new Set(specsOf(def).map(kindOf));
    expect(
      [...kinds].sort(),
      '`add` is chosen because it carries one of nearly every control kind — if that stops '
      + 'being true this test is no longer driving what it claims to drive',
    ).toEqual(['checkbox', 'glob', 'select', 'tags', 'text', 'textarea']);

    await page.screenshot({ path: path.join(SHOTS, 'he-1-empty-required.png'), fullPage: true });
    // **Visibly required, in Hebrew.** The caption's `*` and the `aria-invalid`
    // mark are language-independent by construction — the caption is the CLI's
    // own word — and this is where that is checked rather than assumed.
    // Derived from the def rather than typed: `add` has TWO required fields —
    // `category` and `title` — and hard-coding one was this test's own mistake,
    // caught by the `<select>` gaining the mark it had always been missing.
    const requiredCount = specsOf(def).filter((sp) => sp.required === true).length;
    await expect(
      page.locator(`${FORM} [aria-invalid="true"]`),
      `every empty required control is marked — ${def.name} declares ${requiredCount}`,
    ).toHaveCount(requiredCount);
    await expect(page.locator(`${CMD} p.small`).first(), 'and the sentence is Hebrew')
      .toContainText('קלט נדרש חסר');
    await nothingOverflows(page, 'Hebrew, incomplete');

    // Fill it as a person would, one control of each kind.
    const categories = await controls.get('category')!.locator('option').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ''),
    );
    // Named rather than indexed, and it REFUSES an unknown name: `add` carries
    // `yes` and not `always`, and a helper that shrugged at a missing field
    // failed inside `kindOf` with `Cannot read properties of undefined` instead
    // of saying which field the test had asked for.
    const set = async (name: string, value: string | boolean): Promise<void> => {
      const spec = specsOf(def).find((s) => s.name === name);
      const control = controls.get(name);
      if (spec === undefined || control === undefined) {
        throw new Error(`composer-bidi: \`${def.name}\` has no field named "${name}" — it has `
          + specsOf(def).map((s) => s.name).join(', '));
      }
      await setValue(control, spec, value);
    };
    await set('category', categories[0]!);
    // **A Hebrew value in the field, and a machine value beside it.** The title
    // is corpus text whose language this app did not choose; `--tags` and
    // `--scope` are machine values that must stay LTR inside the RTL flow.
    await set('title', 'כותרת בעברית עם נקודה בסוף.');
    await set('body', 'גוף הפריט, שתי שורות, עם ערך לועזי src/ui/**/*.ts באמצע.');
    await set('tags', 'alpha,beta');
    await set('severity', 'hard');
    await set('yes', true);

    const line = await composedLine(page);
    expect(line, 'a line composes in Hebrew exactly as it does in English').not.toBeNull();
    expect(await settled(page), 'and the CLI accepts it').toBe('passed');
    await page.screenshot({ path: path.join(SHOTS, 'he-2-composed.png'), fullPage: true });
    await nothingOverflows(page, 'Hebrew, composed');

    /**
     * **A LABEL SITS BESIDE THE BOX IT LABELS — measured in pixels, because in
     * Hebrew it did not.**
     *
     * Found by looking at `he-2-composed.png` after every assertion in this
     * file had passed. `.tagname` is deliberately `direction:ltr;
     * unicode-bidi:isolate` — a tag is a machine value — and it also carried
     * `flex:1 1 auto`, so its BOX filled the row while `text-align:start`
     * inside that box resolved to the LTR start, the LEFT edge. The RTL row
     * puts the checkbox on the RIGHT. Measured: tag `v2`'s ink ended at x=114
     * and its own checkbox began at x=1011 — 897px apart, on all 226 rows.
     *
     * Invisible in English, where both starts are the same edge. This asserts
     * the ADJACENCY rather than the CSS, so any future rule that separates them
     * again fails here whichever property does it.
     */
    const gap = await page.evaluate((sel) => {
      const pick = document.querySelector(`${sel} .tagpick`);
      if (pick === null) return null;
      const box = pick.querySelector('input[type="checkbox"]')!.getBoundingClientRect();
      const ink = document.createRange();
      ink.selectNodeContents(pick.querySelector('.tagname')!);
      const name = ink.getBoundingClientRect();
      return Math.round(Math.max(box.left - name.right, name.left - box.right));
    }, PAL);
    expect(gap, 'this corpus supplies tags, so there is a row to measure').not.toBeNull();
    expect(
      gap!,
      'a tag name must sit beside its own checkbox — it was 897px away in Hebrew, which made '
      + 'choosing the right row guesswork on every one of the tags this corpus carries',
    ).toBeLessThan(40);

    /**
     * **THE MACHINE VALUE STAYS LEFT-TO-RIGHT.** `div.cmd > code` carries
     * `direction:ltr; unicode-bidi:isolate` in `styles.css` for exactly this: a
     * composed command inside a `dir="rtl"` page reorders around its own
     * punctuation without the isolation, and what the reader copies stops being
     * what the reader read.
     */
    const cmdDir = await page.locator(`${CMD} .cmd code`).evaluate(
      (n) => getComputedStyle(n).direction,
    );
    expect(cmdDir, 'the composed command is LTR-isolated inside the RTL page').toBe('ltr');

    /**
     * **AND THE ENGLISH RUN THE CLI WROTE CARRIES `dir="auto"`.** `bld.checked`
     * is a keyed Hebrew sentence, but the CLI's own refusal text beside it is
     * English written elsewhere, and an English sentence in an RTL flow renders
     * its trailing full stop at the WRONG END. `foreignRun` is the repair and
     * this is where it is proved on the running page.
     */
    await set('valid-from', 'not-a-date');
    await set('extra', 'nope');
    const verdict = await settled(page);
    if (verdict === 'refused') {
      const foreign = page.locator(`${CMD} p.small.spill span[dir="auto"]`);
      await expect(foreign, "the CLI's own words are direction-isolated from the Hebrew page")
        .toHaveCount(1);
      await page.screenshot({ path: path.join(SHOTS, 'he-3-refusal.png'), fullPage: true });
    }

    // **The shell-active refusal, in Hebrew** — the sentence, the ✕ chip and
    // the disabled Copy, all three, because a refusal a reader cannot read is
    // the same as no refusal.
    await set('valid-from', '');
    await set('extra', '');
    await set('title', 'לפני$(id)אחרי');
    await expect(
      page.locator(`${PAL} .card.pane > p`).nth(1), 'the block sentence is Hebrew',
    ).toContainText('ההעתקה חסומה');
    await expect(page.locator(`${PAL} .card.pane .chip.crit`), 'and the ✕ chip marks the argument')
      .not.toHaveCount(0);
    await expect(
      page.locator(`${CMD} .cmdactions`).locator(':scope > button').first(),
      'and Copy is refused in Hebrew exactly as in English',
    ).toBeDisabled();
    await page.screenshot({ path: path.join(SHOTS, 'he-4-blocked.png'), fullPage: true });
    await nothingOverflows(page, 'Hebrew, copy blocked');

    // **The long machine value**, which is where a card breaks if it is going
    // to: 4,000 characters in a box on a two-column form inside an RTL page.
    await set('title', `long-${'w'.repeat(4000)}-end`);
    await page.screenshot({ path: path.join(SHOTS, 'he-5-long-value.png'), fullPage: true });
    await nothingOverflows(page, 'Hebrew, a 4,000-character value');

    /**
     * **BACK TO ENGLISH, AND THE FORM IS EMPTY. Measured, and reported rather
     * than asserted as correct.**
     *
     * The language toggle re-renders the screen, so `render()` runs again and
     * `build()` runs against the entry picker's default — the catalogue's first
     * entry — with every field blank. A reader who has filled in `add` and
     * toggles the language loses the command they were composing.
     *
     * This test does NOT call that a defect and does not repair it. It is the
     * shell's re-render, shared by every screen, and whether composed state
     * should survive a language toggle is a design question about the shell
     * rather than about the builder — the kind of ruling `palette-defs.js`
     * already declines to take on its own (`review promote --all`: "a design
     * decision … and this task is not the place to take it"). What the test
     * does is pin the behaviour so it cannot change unnoticed, and photograph
     * it so the owner can look at it and rule.
     */
    await set('title', 'a plain title');
    const before = await composedLine(page);
    expect(before, 'a line is composed in Hebrew before the toggle').not.toBeNull();
    await page.click('#lang');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    /**
     * **WAITED FOR, NOT SNAPPED.** The first version photographed here
     * immediately and produced a picture of an EMPTY Composer — which read as a
     * screen that renders nothing after a language toggle, and is not. The
     * toggle re-runs `render()`, which makes five awaited reads before it draws
     * anything (`/api/items`, `/api/config`, `/api/review-queue`,
     * `/api/revisions`, `/api/meta`), so the camera caught the gap. Kept as a
     * note because a screenshot that lies is worse than no screenshot: the
     * lane's whole method here is to believe the picture.
     */
    const picker = page.locator(`${PAL} select`).first();
    await expect(picker, 'the screen finishes re-rendering after the toggle')
      .toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${FORM} > label.small`).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SHOTS, 'en-6-after-round-trip.png'), fullPage: true });
    expect(
      await picker.inputValue(),
      'the language toggle re-renders the screen, so the entry picker returns to the '
      + "catalogue's first entry — FINDING, reported to the owner, not repaired here",
    ).toBe(DEFS[0]!.name);
    expect(
      await composedLine(page),
      'and the command the reader was composing is gone with it — same finding',
    ).toBeNull();
    // Whatever it now draws, it must still draw it INSIDE its card.
    await nothingOverflows(page, 'English, after the round trip');
  });
