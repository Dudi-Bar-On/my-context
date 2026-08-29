/**
 * **Every button the app draws is styled by something, and its text can be read.**
 *
 * `plan:rulings seq:51`. The owner found this by looking, on 2026-08-27: in the
 * Composer, choosing a READ action generates a button after Copy with a white
 * background and text that cannot be seen.
 *
 * ── WHY IT HAPPENS, AND WHY IT IS A CLASS ─────────────────────────────────
 *
 * `styles.css`'s only global button rule is `button{font:inherit;color:inherit}`.
 * It takes the app's LIGHT colour and **sets no background**. So a classless
 * `<button>` gets light text from the app and its background from the USER
 * AGENT — near-white on Windows Chrome. Light on white. Invisible, and invisible
 * precisely BECAUSE the half-reset succeeded at one half.
 *
 * Which buttons are safe is decided by ANCESTOR rules — `.cmd button`,
 * `.bound button`, `.segbar button`, `.icon`. A classless button inside one of
 * those looks right; the same button one level up does not. The Composer's Copy
 * sits inside `div.cmd` and looked right; the read action's button was appended
 * to a classless `div` and did not.
 *
 * ── WHY THIS IS A BROWSER TEST AND CANNOT BE A SOURCE SCAN ────────────────
 *
 * The styling comes from ancestors, so "is this button styled" is a question
 * about the CASCADE, and the cascade only exists in a browser. A source scan
 * would have to reimplement selector matching to answer it, and a reimplementation
 * that is subtly wrong passes exactly the buttons it is wrong about.
 *
 * It is measured on COMPUTED STYLE for the same reason. A class-list check would
 * pass a button carrying a class the stylesheet does not actually style — a
 * different way to be invisible, and one the owner's report would not have
 * distinguished.
 *
 * ── WHAT AN INVISIBLE BUTTON COSTS, WHICH IS WHY IT GETS A GATE ───────────
 *
 * A human never reports one, because they never see it. This one surfaced only
 * because a NEW button appeared beside a working one and the difference was
 * visible. Every other instance is still there, unreported, until somebody
 * happens to compose the right thing.
 */
import { test, expect } from './app.ts';
import { settleScreen } from './settle.ts';
import type { Page } from '@playwright/test';

/**
 * The screens that COMPOSE a command, and therefore draw the buttons this exists
 * for — plus the two whose copy controls were measured on 2026-08-27 and
 * deliberately offer no Execute (`config` copies budgets text, `coverage` copies
 * a command that composes nothing).
 *
 * Named rather than derived from the rail, and that is deliberate: a screen that
 * starts drawing buttons later should make somebody READ this list and decide,
 * rather than being swept in by a loop and passing or failing without a reader.
 */
/**
 * Screens whose controls do not exist until something is typed or chosen, so a
 * WALK measures nothing on them. Named, never silently tolerated.
 *
 * `capture` builds nothing below its inputs until a category and a title are
 * entered — measured 2026-08-27: doctor 2 controls, proc 2, packs 1, port 1,
 * work 1, **capture 0**. `palette` was in the same position and got
 * `composeOnPalette`; Capture wants the equivalent typing step, and until it has
 * one this entry is what stops the gate claiming coverage it does not have.
 */
const EXPECTED_EMPTY = new Set(['capture', 'decay']);

// `decay` draws NO BUTTONS AT ALL — measured, not assumed: `screens/decay.js`
// contains zero `el('button')`, `createElement('button')` or `.icon`
// occurrences. It is a reading surface. That is a different reason from
// `capture`'s, and the two are listed together only because the guard needs one
// list; if `decay` ever gains a control this entry becomes wrong and should be
// removed rather than kept as cover.

const SCREENS = [
  'palette', 'doctor', 'packs', 'port', 'proc', 'work', 'capture',
  'config', 'coverage', 'ask', 'watch', 'decay',
];

/**
 * Chrome's `buttonface`. Measured rather than assumed — this is what a
 * `<button>` matching no background rule computes to, and it is the value the
 * owner saw.
 *
 * Compared as a NUMBER through the contrast maths below rather than as a string:
 * a UA that spells the same colour differently would slip a string comparison,
 * and what is actually wrong with the button is the contrast, not the spelling.
 */
interface ButtonReport {
  screen: string;
  label: string;
  container: string;
  color: string;
  background: string;
  ratio: number;
  disabled: boolean;
}

/**
 * Relative luminance, then the WCAG contrast ratio. Both are on the page,
 * because the effective background needs `getComputedStyle` on real ancestors:
 * a transparent button shows whatever is behind it, and only the browser knows
 * what that resolved to.
 */
/**
 * **SCOPED, and the scope is the whole point.**
 *
 * This queried `document` until 2026-08-27, which made the anti-vacuity guard
 * below satisfy itself: the rail and the header carry more than twenty buttons
 * on every screen, so `seen > 20` was true even for a screen that drew NOTHING.
 * A guard that a page's furniture can satisfy cannot detect the failure it was
 * written for — and it was written for exactly that failure, having already been
 * caught passing over a control that was never built.
 *
 * Third instance of one shape in one day: a query correct about what it measured
 * and silent about what it missed. Here it was in the test written to catch it.
 */
// A REAL function, not a string. `page.evaluate` passes an argument only to a
// function — given a string it evaluates it as an expression and drops the arg,
// which is how the first attempt at scoping this silently measured nothing.
const COLLECT = (rootSelector: string | null) => {
  interface Rgb { r: number; g: number; b: number; a: number }
  const parse = (value: string): Rgb | null => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (m === null) return null;
    const parts = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }: Rgb): number => {
    const chan = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  // The background a reader actually sees. A transparent button shows its
  // nearest painted ancestor, so walking up is not a nicety — a button with
  // `background: transparent` inside a dark card is fine, and reading its own
  // computed value would call it white.
  const effectiveBackground = (el: Element): Rgb => {
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg !== null && bg.a > 0.99) return bg;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  const out: Omit<ButtonReport, 'screen'>[] = [];
  const root = rootSelector === null ? document : document.querySelector(rootSelector);
  if (root === null) return null;
  for (const el of root.querySelectorAll('button')) {
    const rect = el.getBoundingClientRect();
    // A button with no box is not drawn: a hidden pane, a screen not on top.
    // Judging one would report a colour nobody can see.
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = effectiveBackground(el);
    if (fg === null) continue;
    const lf = luminance(fg);
    const lb = luminance(bg);
    const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    out.push({
      label: (el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label') || '(no label)',
      container: el.parentElement === null ? '(none)'
        : el.parentElement.tagName.toLowerCase() + (el.parentElement.className ? '.' + String(el.parentElement.className).split(' ').join('.') : ''),
      color: cs.color,
      background: cs.backgroundColor,
      ratio: Math.round(ratio * 100) / 100,
      disabled: el.disabled === true,
    });
  }
  return out;
};

async function buttonsOn(
  page: Page, screen: string, options: { alreadyThere?: boolean } = {},
): Promise<ButtonReport[]> {
  // `alreadyThere` is for a screen the caller has already navigated to AND put
  // into a particular state. Re-navigating would reset it, which is how the
  // composed state would silently become the empty one again.
  if (options.alreadyThere !== true) {
    await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
  }
  // Wait for the thing the next line actually reads, not a proxy of it. The
  // next line reads BUTTONS — so settling on "two equal element counts 400ms
  // apart" is satisfied by a screen whose count never changes because its
  // controls have not arrived yet, which is exactly what happened to Doctor:
  // its command block is built after a fetch resolves, so a pre-fetch count
  // held steady across two polls and the screen was declared settled with
  // zero of its buttons drawn. `drewNothing = ["doctor"]` is what caught it.
  //
  // EXISTENCE and STABILITY answer different questions, and this gate needs
  // BOTH because it measures EVERY button on the screen, not the presence of
  // one. Existence alone stops as soon as the FIRST button appears — a screen
  // that draws one button synchronously and the rest after a second fetch
  // would settle on the first and be measured half-drawn, the same defect one
  // step further along. Stability alone is the original bug: a count that
  // never moves because nothing has arrived yet. Only "a button exists AND
  // the count has stopped moving" answers "is everything this screen is going
  // to draw actually drawn".
  //
  //
  // **And the third fact `settle.ts` adds is the one this file was one small
  // change away from being bitten by.** The stability half alone is satisfied
  // by the router's holding chip — two elements, present from the first frame,
  // never changing. This spec survived only because it additionally required a
  // real `<button>` and `stateChip` builds a `<span>`; the moment a holding
  // state rendered a button, every `EXPECTED_EMPTY` screen and every other one
  // would have been measured on the chip. `TASK-two-more-e2e-settles-can-be-
  // satisfied-by-the-router-holding` (plan:walk seq:83) is that reading, and
  // this is it closed rather than left latent.
  //
  // `EXPECTED_EMPTY` screens genuinely draw no button, ever — requiring one
  // there would just burn the full cap every run. They are the one case that
  // asks for no fourth fact; the other three still hold for them.
  const { settled } = await settleScreen(page, screen, {
    ...(EXPECTED_EMPTY.has(screen) ? {} : { requires: 'button' }),
  });
  // The cap fails as ITSELF. Falling through would judge a half-drawn screen
  // and report a load failure as a contrast defect — a message about
  // correctness produced by a slow machine, which is the shape
  // `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow` names.
  expect(settled, `${screen}: still growing, still holding the router's unread chip, or `
    + 'still fetching after 25 samples over 10s — NOT measured. '
    + 'Run this spec alone before believing anything it says.').toBe(true);
  const found = (await page.evaluate(COLLECT, `[data-p="${screen}"]`)) as Omit<ButtonReport, 'screen'>[] | null;
  // `null` means the section itself is not in the DOM — a different failure from
  // "drew no buttons", and one the caller must not read as an empty list.
  expect(found, `${screen}: no [data-p] section in the document at all`).not.toBeNull();
  return found!.map((b) => ({ ...b, screen }));
}

/**
 * 4.5:1 is the WCAG AA threshold for ordinary text, and a button's label is
 * ordinary text. The defect this gate exists for computes at roughly **1.1:1** —
 * light grey on the UA's near-white button face — so the bar is nowhere near the
 * failure and no styled button in this product is anywhere near the bar. It is
 * not a tuning knob: raising it would start failing considered designs, and
 * lowering it would still catch this one while admitting the next.
 */
const MIN_RATIO = 4.5;

/**
 * A disabled button is deliberately de-emphasised, and the browser dims its text
 * on top of whatever the stylesheet says. Held to a lower bar rather than
 * exempted: a control you cannot press is still a control you must be able to
 * READ, or you cannot tell it apart from one that is missing.
 */
const MIN_RATIO_DISABLED = 2.5;

/**
 * **The Composer draws nothing until a command is COMPOSED, and that is where the
 * owner's defect lives.**
 *
 * `palette.js` returns early on `if (!complete) return;` — the command box, the
 * Copy control and the read action are all built only once every required
 * argument is filled. So walking to `#/palette` and reading its buttons measures
 * the picker and the flag controls and NOT the three controls this gate exists
 * for.
 *
 * That is not a hypothetical. This spec was written without this step, it passed,
 * and then the fix was REVERTED — reintroducing the owner's exact defect — and it
 * **still passed**. A gate that measures what it was pointed at and is silent
 * about what it missed is this project's most expensive recurring shape, and it
 * had just produced another instance of itself.
 *
 * `doctor` is the command driven here because it takes no arguments at all, so
 * "composed" is one selection away and the step cannot fail for a reason that has
 * nothing to do with buttons.
 */
async function composeOnPalette(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator('[data-p="palette"] select').first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  await picker.selectOption('doctor');
  // The control the whole gate is for. If it never appears the composer changed
  // shape, and measuring the screen without it would be the vacuous pass again.
  await page.locator('[data-p="palette"] .cmdactions button').first()
    .waitFor({ state: 'visible', timeout: 15_000 });
}

test('every button drawn on a command-composing screen can be read', async ({ app }) => {
  test.setTimeout(180_000);
  const { page } = app;
  const failures: string[] = [];
  const perScreen = new Map<string, number>();
  let seen = 0;

  // The composed state FIRST, because it is the one the owner reported and the
  // one a plain walk cannot reach.
  await composeOnPalette(page);
  for (const b of await buttonsOn(page, 'palette', { alreadyThere: true })) {
    seen += 1;
    const bar = b.disabled ? MIN_RATIO_DISABLED : MIN_RATIO;
    if (b.ratio < bar) {
      failures.push(
        `palette (composed): "${b.label}" in <${b.container}> — ${b.ratio}:1 `
        + `(${b.color} on ${b.background}${b.disabled ? ', disabled' : ''}), needs ${bar}:1`);
    }
  }
  expect(seen, 'the composed Composer drew no buttons at all — the compose step did not take')
    .toBeGreaterThan(2);

  for (const screen of SCREENS) {
    for (const b of await buttonsOn(page, screen)) {
      seen += 1;
      perScreen.set(screen, (perScreen.get(screen) ?? 0) + 1);
      const bar = b.disabled ? MIN_RATIO_DISABLED : MIN_RATIO;
      if (b.ratio < bar) {
        failures.push(
          `${b.screen}: "${b.label}" in <${b.container}> — ${b.ratio}:1 `
          + `(${b.color} on ${b.background}${b.disabled ? ', disabled' : ''}), needs ${bar}:1`);
      }
    }
  }

  // **Anti-vacuity, PER SCREEN, because the total was satisfying itself.**
  //
  // This asserted `seen > 20` over an unscoped `document` query, so the rail and
  // header alone made it true — for every screen, including one that drew
  // nothing. Now the collector is scoped to `[data-p="<screen>"]` and each
  // screen is required to have drawn at least one button of its own.
  //
  // `EXPECTED_EMPTY` is the honest exception: Capture builds no controls until a
  // category and a title are typed, so a walk measures nothing there. That is a
  // KNOWN limit, named — and named rather than tolerated, because the same shape
  // silently hid the owner's invisible button from the first version of this
  // gate. Removing a screen from that list without giving it a state-driving
  // step puts the hole straight back.
  const drewNothing = SCREENS.filter((s) => (perScreen.get(s) ?? 0) === 0 && !EXPECTED_EMPTY.has(s));
  expect(drewNothing, 'these screens drew no buttons of their own, so nothing on them was judged. '
    + 'Either the walk did not reach them, or their controls need a state to exist in — see '
    + '`composeOnPalette` for what that step looks like.').toEqual([]);
  expect(seen, 'no buttons were measured at all; the walk found nothing to judge').toBeGreaterThan(5);

  expect(failures, 'a button cannot be read against what is behind it. The usual cause is a '
    + 'CLASSLESS <button> outside a container that styles buttons: the only global rule is '
    + '`button{font:inherit;color:inherit}`, which sets colour and NOT background, so the '
    + 'button takes the app\'s light text and the user agent\'s light button face. Give the '
    + 'control\'s own selector a background from a token — do not rely on where it is appended.')
    .toEqual([]);
});

test('the measurement can see a broken button — proved, not asserted', async ({ app }) => {
  // A gate nobody has watched fail is a gate nobody has tested. This injects the
  // exact defect the owner reported — a classless button in a classless div —
  // and requires the collector to catch it. Without this, a collector that
  // silently found nothing would make the test above green forever.
  const { page } = app;
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'contrast-probe';
    const b = document.createElement('button');
    b.textContent = 'Run';
    b.style.all = 'unset';
    b.style.background = 'rgb(239, 239, 239)';
    b.style.color = 'rgb(240, 238, 246)';
    b.style.display = 'inline-block';
    b.style.padding = '4px';
    host.append(b);
    document.body.append(host);
  });
  const found = (await page.evaluate(COLLECT, null)) as Omit<ButtonReport, 'screen'>[];
  const probe = found.find((b) => b.label === 'Run');
  expect(probe, 'the collector did not see an injected button at all').toBeDefined();
  expect(probe!.ratio, 'light text on the UA button face must measure as unreadable')
    .toBeLessThan(MIN_RATIO);
  await page.evaluate(() => { document.getElementById('contrast-probe')?.remove(); });
});
