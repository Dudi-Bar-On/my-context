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
const COLLECT = `(() => {
  const parse = (value) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(value);
    if (m === null) return null;
    const parts = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }) => {
    const chan = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  // The background a reader actually sees. A transparent button shows its
  // nearest painted ancestor, so walking up is not a nicety — a button with
  // \`background: transparent\` inside a dark card is fine, and reading its own
  // computed value would call it white.
  const effectiveBackground = (el) => {
    for (let node = el; node !== null; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg !== null && bg.a > 0.99) return bg;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  const out = [];
  for (const el of document.querySelectorAll('button')) {
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
})()`;

async function buttonsOn(
  page: Page, screen: string, options: { alreadyThere?: boolean } = {},
): Promise<ButtonReport[]> {
  // `alreadyThere` is for a screen the caller has already navigated to AND put
  // into a particular state. Re-navigating would reset it, which is how the
  // composed state would silently become the empty one again.
  if (options.alreadyThere !== true) {
    await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
  }
  // Settle the same way `screen-parity.spec.ts` does, and for the same reason:
  // a screen draws its heading synchronously and its controls after a fetch, so
  // "has any element" is true almost immediately and is the wrong signal.
  let previous = -1;
  let settled = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const now = await page.evaluate(
      (s) => document.querySelectorAll(`[data-p="${s}"] *`).length, screen);
    if (now > 0 && now === previous) { settled = true; break; }
    previous = now;
    await page.waitForTimeout(400);
  }
  // The cap fails as ITSELF. Falling through would judge a half-drawn screen
  // and report a load failure as a contrast defect — a message about
  // correctness produced by a slow machine, which is the shape
  // `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow` names.
  expect(settled, `${screen}: still growing after 25 samples over 10s — NOT measured. `
    + 'Run this spec alone before believing anything it says.').toBe(true);
  const found = (await page.evaluate(COLLECT)) as Omit<ButtonReport, 'screen'>[];
  return found.map((b) => ({ ...b, screen }));
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
      const bar = b.disabled ? MIN_RATIO_DISABLED : MIN_RATIO;
      if (b.ratio < bar) {
        failures.push(
          `${b.screen}: "${b.label}" in <${b.container}> — ${b.ratio}:1 `
          + `(${b.color} on ${b.background}${b.disabled ? ', disabled' : ''}), needs ${bar}:1`);
      }
    }
  }

  // Anti-vacuity, and it is not decoration: if the navigation silently stopped
  // working, every screen would report zero buttons and this test would pass by
  // looking at nothing — the exact failure its own subject is an instance of.
  expect(seen, 'no buttons were measured at all; the walk found nothing to judge').toBeGreaterThan(20);

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
  const found = (await page.evaluate(COLLECT)) as Omit<ButtonReport, 'screen'>[];
  const probe = found.find((b) => b.label === 'Run');
  expect(probe, 'the collector did not see an injected button at all').toBeDefined();
  expect(probe!.ratio, 'light text on the UA button face must measure as unreadable')
    .toBeLessThan(MIN_RATIO);
  await page.evaluate(() => { document.getElementById('contrast-probe')?.remove(); });
});
