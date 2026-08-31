/**
 * **What a chip is actually painted, measured on the rendered chip.**
 *
 * ── THE FAILURE THIS FILE IS FOR ───────────────────────────────────────────
 *
 * Two of them, and they are the same failure pointed at two different files.
 *
 *   `plan:walk seq:78`   `svg.chart text{fill:var(--dim)}` is an AUTHOR rule
 *                        and a `fill=` on a mark is a PRESENTATION attribute,
 *                        so 113 marks asked for `--warn`/`--crit`/`--ink` and
 *                        113 rendered grey. For six days. Every check that
 *                        existed read the STYLESHEET, and the stylesheet was
 *                        right the whole time.
 *
 *   `plan:screens 1s-c`  `.chip`'s base rule set `color:#0b0c11` — near-black
 *                        text, a `border:1px solid` that therefore resolved to
 *                        near-black `currentColor`, on a near-black plate. The
 *                        one chip with no modifier class (the budget ribbon's
 *                        `index` tier) was INVISIBLE, in the app and in the
 *                        design of record alike. `styles-parity` compares rule
 *                        bodies byte-for-byte and both files carried the same
 *                        bytes, so every gate was green over a label nobody
 *                        could read.
 *
 * A gate that reads a stylesheet cannot see either one. **So nothing in this
 * file reads a rule.** Every assertion is a computed value off an element the
 * browser laid out, and the token values are resolved from the LIVE sheet
 * through a probe span — a retheme moves the expectation with it rather than
 * reddening the gate, which is `chart-css-authority.spec.ts`'s method, copied
 * deliberately.
 *
 * ── WHAT IT ASSERTS, AND WHY EACH ONE ──────────────────────────────────────
 *
 *   the register table    Every visible chip renders the colour ITS OWN CLASS
 *                         asks for. `.chip.gov` is `--gold`, `.chip.carry` is
 *                         `--carry`, and the two NEUTRALS — `.chip.index` and
 *                         `.chip.unmeas` — are `--dim`, which is a decoration
 *                         step and not a sixth meaning hue.
 *
 *   legibility            Every visible chip clears 4.5:1 against the surface
 *                         it actually sits on, walking up for the first opaque
 *                         ancestor. This is the assertion that would have
 *                         caught `1s-c` on the day it shipped: an invisible
 *                         chip reads 1.0-ish and nothing else does.
 *
 *   no two meanings alike Five meaning hues plus one neutral must resolve to
 *                         six DISTINCT computed colours. Two meanings landing
 *                         on one value is the whole hazard the five-hue budget
 *                         exists to bound (`DEC-the-meaning-hue-budget-is-five-
 *                         gold-ok-carry-crit-and-warn`), and it is invisible to
 *                         a byte comparison of two stylesheets that agree.
 *
 *   colour is not alone   Every chip carries a word AND a glyph. Strip the hue
 *                         — print, `forced-colors`, a monochrome reader — and
 *                         the state must still be there. Asserted as text
 *                         content, because that is the carrier that survives.
 *
 *   driven, not read      The last test moves `.chip.index`'s colour IN THE
 *                         SHIPPED SHEET through `insertRule` and requires the
 *                         rendered index chips to follow, while the `ok` chips
 *                         beside them stay put. A chip carrying its own copy of
 *                         a declaration would not move, and that is the
 *                         `check-cssom-restatement` defect wearing a chip.
 *
 * ── THE DESIGN OF RECORD IS MEASURED TOO ───────────────────────────────────
 *
 * `1s-c` was a defect in `docs/design/web-ui-mockup.html` ITSELF, which is the
 * one kind no parity gate can ever report: both files agreed, so both were
 * green and both were wrong. The mockup therefore gets the same legibility
 * measurement, over its own static markup, in its own file.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './app.ts';
import { settleScreen } from './settle.ts';
import { openMockup, showScreen, expectNoFaults } from './mockup.ts';

/**
 * The screens that draw a chip, and the reason the list is short.
 *
 * Every screen here was measured to draw at least one chip against the
 * deterministic `.demo-corpus`; a screen that draws none contributes nothing
 * but a settle. `preview` carries the budget ribbon (the `index` tier and the
 * `gov`/`ok` tiers), `ask` the audit table's neutral kind chip, `watch` the
 * `crit`/`warn` record chips, `work` the stale marker and the uncopied
 * `unmeas` face, `simulate` the fits/over pair, and `port` the travels/rebuilt
 * pair.
 */
const CHIP_SCREENS = ['preview', 'simulate', 'ask', 'watch', 'work', 'port'] as const;

/**
 * **The register table: what each chip class means and which token it spends.**
 *
 * Five MEANING hues and one NEUTRAL. `index` and `unmeas` are both neutral and
 * both `--dim` on purpose — an index line and an unmeasured fact are each
 * "this is not a state, it is a quieter kind of present", and neither may
 * borrow a meaning hue to say so. Both rules are declared beside each other in
 * `styles.css` and in the mockup, with that reasoning against them, and
 * `test/ui/styles-parity.test.ts` holds the pair byte-identical in both files.
 *
 * They share a register, so they are allowed to share a value; that is why the
 * distinctness test below groups by REGISTER and not by class.
 *
 * **No citation into the mockup here, deliberately.** `plan:rulings seq:47` is
 * open on exactly this: the citation form has no answer for `.html`, those
 * citations are not scanned by `verify:citations`, and the form itself is a
 * documents decision nobody has taken. An unscanned pointer into the design of
 * record is a pointer that goes stale silently — which is what this whole file
 * is about — so this docstring names the rules and lets the parity test be the
 * thing that actually holds them together.
 */
const REGISTER: Record<string, string> = {
  gov: 'gold',
  ok: 'ok',
  warn: 'warn',
  crit: 'crit',
  carry: 'carry',
  index: 'dim',
  unmeas: 'dim',
};

/** Every token this file resolves off the live sheet. */
const TOKENS = ['gold', 'ok', 'warn', 'crit', 'carry', 'dim', 'ink', 'faint'] as const;

/**
 * The token values, read through a probe span coloured via the CSSOM.
 *
 * Custom properties inherit from `:root`, so this reports what the SHEET means
 * by `--warn` right now rather than what a test file remembers it meaning.
 */
function tokens(page: Page): Promise<Record<string, string>> {
  return page.evaluate((names) => {
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const name of names) {
      probe.style.setProperty('color', `var(--${name})`);
      out[name] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, [...TOKENS]) as Promise<Record<string, string>>;
}

interface Chip {
  readonly screen: string;
  /** The `class` attribute exactly as the screen wrote it. */
  readonly cls: string;
  /** The chip's own word — the carrier that survives losing the hue. */
  readonly text: string;
  /** `::before`'s resolved content: the glyph, the second such carrier. */
  readonly glyph: string;
  readonly color: string;
  readonly borderColor: string;
  /** The first OPAQUE surface behind it, which is what a reader sees it on. */
  readonly ground: string;
  /** WCAG contrast of `color` against `ground`, two decimals. */
  readonly ratio: number;
  /** An inline `style` colour — a restatement, which no chip may carry. */
  readonly inlineColor: string;
}

/**
 * Every VISIBLE chip under one screen's own section, measured.
 *
 * **Scoped to `[data-p="…"]:not([hidden])`, and that is load-bearing.** The
 * router keeps every screen it has ever drawn inside `#screen` and merely
 * hides the ones that are not current, so a bare `document.querySelectorAll`
 * reaches four screens' chips and attributes them all to the current one —
 * the exact defect `chart-css-authority.spec.ts` records having measured one
 * chart three times. The zero-box guard catches the rest: an outgoing screen
 * is still laid out for a frame.
 */
const COLLECT = (rootSelector: string) => {
  interface Rgb { r: number; g: number; b: number; a: number }
  const parse = (value: string): Rgb | null => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (m === null) return null;
    const parts = m[1]!.split(',').map((n) => Number.parseFloat(n.trim()));
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts.length > 3 ? parts[3]! : 1 };
  };
  const luminance = ({ r, g, b }: Rgb): number => {
    const chan = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  // A chip with no background of its own shows whatever is painted behind it.
  // Reading its own `backgroundColor` would call that `rgba(0,0,0,0)` and then
  // score every bare chip against black, which is precisely the reading that
  // would have declared the invisible index chip fine.
  const ground = (el: Element): Rgb => {
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg !== null && bg.a > 0.99) return bg;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    // The shell's ground is a gradient stack over `#0b0c11`; when nothing
    // opaque is found, that flat base is the honest floor to score against.
    return body !== null && body.a > 0.99 ? body : { r: 11, g: 12, b: 17, a: 1 };
  };
  const root = document.querySelector(rootSelector);
  if (root === null) return null;
  const out: Omit<Chip, 'screen'>[] = [];
  for (const el of root.querySelectorAll('.chip')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (fg === null) continue;
    const bg = ground(el);
    const lf = luminance(fg);
    const lb = luminance(bg);
    const before = getComputedStyle(el, '::before').content;
    out.push({
      cls: el.getAttribute('class') ?? '',
      text: (el.textContent ?? '').trim().slice(0, 40),
      glyph: before === 'none' ? '' : before.replace(/^"|"$/g, '').trim(),
      color: cs.color,
      borderColor: cs.borderTopColor,
      ground: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
      ratio: Math.round(((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)) * 100) / 100,
      inlineColor: (el as HTMLElement).style.getPropertyValue('color'),
    });
  }
  return out;
};

/** Open a screen from the rail and come back when it has finished drawing. */
async function chipsOn(page: Page, screen: string): Promise<Chip[]> {
  await page.evaluate((s) => {
    const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
    if (btn === null) throw new Error(`no rail button for screen ${s}`);
    if (location.hash !== `#/${s}`) btn.click();
  }, screen);
  const settled = await settleScreen(page, screen);
  // Fail as ITSELF. Falling through would report a slow machine as a missing
  // chip, which is a statement about colour produced by a clock.
  expect(
    settled.settled,
    `${screen} never settled (${settled.attempts} samples, ${settled.count} elements, `
    + `${settled.inFlight} reads in flight), so nothing here was measured`,
  ).toBe(true);
  const found = await page.evaluate(COLLECT, `#screen [data-p="${screen}"]:not([hidden])`);
  expect(found, `${screen} has no section in #screen, so the scope matched nothing`)
    .not.toBeNull();
  return (found ?? []).map((c) => ({ screen, ...c }));
}

/** Which register a chip's class asks for, `null` for a chip with no class. */
function registerOf(cls: string): string | null {
  const classes = cls.split(/\s+/);
  for (const name of Object.keys(REGISTER)) {
    if (classes.includes(name)) return REGISTER[name]!;
  }
  return null;
}

function evidenceOf(chips: readonly Chip[]): string {
  return chips
    .map((c) => `${c.screen} ${JSON.stringify(c.text)} class=${JSON.stringify(c.cls)} `
      + `asks --${registerOf(c.cls) ?? 'inherit'} renders ${c.color} on ${c.ground} `
      + `(${c.ratio}:1, border ${c.borderColor})`)
    .join(' | ');
}

/** Every chip on every screen in `CHIP_SCREENS`, once, for a whole-page test. */
async function everyChip(page: Page): Promise<Chip[]> {
  const all: Chip[] = [];
  for (const screen of CHIP_SCREENS) all.push(...await chipsOn(page, screen));
  expect(
    all.length,
    'not one chip was drawn on any of the six screens that draw chips, so every assertion '
    + 'below would have passed over an empty page',
  ).toBeGreaterThan(5);
  return all;
}

test('every chip renders the colour its own class asks for', async ({ app }) => {
  const want = await tokens(app.page);
  const all = await everyChip(app.page);

  const classed = all.filter((c) => registerOf(c.cls) !== null);
  const wrong = classed.filter((c) => c.color !== want[registerOf(c.cls)!]);
  expect(
    wrong.length,
    'a chip did not render the colour its class asks for. Grepping styles.css for the rule '
    + `would have said it was fine; this is what the browser painted: ${evidenceOf(wrong)}`,
  ).toBe(0);

  // A chip's border is its own colour, per the five modifier rules. A border
  // resolving to something else means a base rule is still asserting one.
  const bordered = classed.filter((c) => c.borderColor !== want[registerOf(c.cls)!]
    && !c.cls.split(/\s+/).some((k) => k === 'index' || k === 'unmeas'));
  expect(
    bordered.length,
    `a meaning chip's border is not its own hue: ${evidenceOf(bordered)}`,
  ).toBe(0);

  // The restatement guard. `scripts/check-cssom-restatement.ts` is the source
  // half and says so about its own holes; this half never reads a module.
  const restated = all.filter((c) => c.inlineColor !== '');
  expect(
    restated.length,
    'a chip carries its own inline copy of a colour styles.css owns, which no gate that reads '
    + `a stylesheet can see: ${evidenceOf(restated)}`,
  ).toBe(0);
});

test('no chip is invisible against the surface it sits on', async ({ app }) => {
  const all = await everyChip(app.page);
  // 4.5:1 is the same bar `button-contrast.spec.ts` holds every control to, and
  // a chip is 12px text — the small-text threshold, not the large-text one.
  const unreadable = all.filter((c) => c.ratio < 4.5);
  expect(
    unreadable.length,
    'a chip is unreadable on the surface it is drawn on. This is `plan:screens seq:1s-c`: the '
    + 'index tier drew near-black text and a near-black border on a near-black plate, in the '
    + 'app and in the design of record alike, and every gate stayed green because both files '
    + `carried the same bytes. Measured: ${evidenceOf(unreadable)}`,
  ).toBe(0);

  // Anti-vacuity: a page that drew no chip at all would satisfy the filter
  // above, and a chip that resolved to no colour would too.
  expect(
    all.every((c) => c.ratio > 0),
    `a chip scored no contrast at all, so the measurement is broken: ${evidenceOf(all)}`,
  ).toBe(true);
});

test('no two meanings resolve to the same chip colour', async ({ app }) => {
  // Measured on PROBE chips rather than on rendered ones, so the assertion
  // holds even on a corpus that happens to draw no `carry` tier this run — the
  // question is what the sheet does with the class, and a register that is
  // real but undrawn today is exactly the one that drifts unnoticed.
  const seen = await app.page.evaluate((classes) => {
    const host = document.querySelector('#screen') ?? document.body;
    const out: Record<string, { color: string; background: string; glyph: string }> = {};
    for (const name of classes) {
      const probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.className = name === '' ? 'chip' : `chip ${name}`;
      probe.dataset['g'] = '◇';
      probe.textContent = name === '' ? 'bare' : name;
      host.append(probe);
      const cs = getComputedStyle(probe);
      const before = getComputedStyle(probe, '::before').content;
      out[name] = {
        color: cs.color,
        background: cs.backgroundColor,
        glyph: before === 'none' ? '' : before.replace(/^"|"$/g, '').trim(),
      };
      probe.remove();
    }
    return out;
  }, [...Object.keys(REGISTER), '']);

  const evidence = Object.entries(seen)
    .map(([k, v]) => `${k === '' ? '(bare)' : k} ${v.color} on ${v.background} glyph ${JSON.stringify(v.glyph)}`)
    .join(' | ');

  // Six registers, six values: the five meaning hues, plus the one neutral the
  // two neutral classes share.
  const byRegister = new Map<string, string>();
  for (const [cls, reg] of Object.entries(REGISTER)) {
    const value = seen[cls]!.color;
    const already = byRegister.get(reg);
    expect(
      already === undefined || already === value,
      `two classes in the same register (--${reg}) disagree about its colour: ${evidence}`,
    ).toBe(true);
    byRegister.set(reg, value);
  }
  expect(
    new Set(byRegister.values()).size,
    'two different meanings resolve to the SAME colour, so one of them cannot be read as '
    + `itself. The budget is five hues plus a neutral, and this is what they render: ${evidence}`,
  ).toBe(byRegister.size);

  // **The base rule may not assert a colour.** A bare chip inherits; a bare
  // chip that carries its own hard-coded near-black is the `1s-c` defect at
  // its source, and it is invisible to every check that reads the stylesheet
  // because the stylesheet says exactly what it means to say.
  const bare = seen['']!;
  const inherited = await app.page.evaluate(() => {
    const host = document.querySelector('#screen') ?? document.body;
    return getComputedStyle(host).color;
  });
  expect(
    bare.color,
    'the `.chip` base rule is asserting a colour of its own instead of letting an unclassed '
    + `chip inherit one. That is the defect, not the starting point: ${evidence}`,
  ).toBe(inherited);
});

test('a chip never carries its state in colour alone', async ({ app }) => {
  const all = await everyChip(app.page);
  // Strip the hue and the state must still be there. A chip's own word is the
  // carrier that survives print, `forced-colors` and a monochrome reader; the
  // glyph is the second. Requiring the WORD (not merely one of the two) is
  // deliberate — `.chip.carry` and `.chip.index` resolve to the same `◇`, so
  // on those two the glyph alone does not separate them and the word does.
  const mute = all.filter((c) => c.text === '');
  expect(
    mute.length,
    'a chip says nothing without its colour — no word inside it. Colour is never the only '
    + `carrier of a state: ${evidenceOf(mute)}`,
  ).toBe(0);
  const glyphless = all.filter((c) => c.glyph === '');
  expect(
    glyphless.length,
    `a chip drew no glyph, so it has one channel where the design specifies two: ${evidenceOf(glyphless)}`,
  ).toBe(0);
});

/** `insertRule` on the shipped sheet, run `body`, then take the rule back off. */
async function underProbe<T>(page: Page, rule: string, body: () => Promise<T>): Promise<T> {
  await page.evaluate((r) => {
    const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
    if (sheet === undefined) {
      throw new Error(
        'the shipped styles.css is not among document.styleSheets, so there is no sheet to '
        + 'drive. This is a broken probe, not a clean page: fail rather than report green.',
      );
    }
    sheet.insertRule(r, sheet.cssRules.length);
  }, rule);
  try {
    return await body();
  } finally {
    await page.evaluate(() => {
      const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
      if (sheet === undefined) return;
      sheet.deleteRule(sheet.cssRules.length - 1);
    });
  }
}

test('the stylesheet still owns a chip colour — driven, not read', async ({ app }) => {
  // The tests above would pass just as well if every colour came from an
  // attribute the screen wrote. This one moves the SHEET and requires the
  // chips to follow.
  const PROBE = 'rgb(1, 2, 3)';
  const want = await tokens(app.page);
  const before = await chipsOn(app.page, 'preview');
  const neutral = before.filter((c) => registerOf(c.cls) === 'dim');
  expect(
    neutral.length,
    `preview drew no neutral chip, so the probe below would prove nothing: ${evidenceOf(before)}`,
  ).toBeGreaterThan(0);

  const after = await underProbe(app.page, `.chip.index{color:${PROBE}}`, async () => {
    let seen: Chip[] = [];
    await expect
      .poll(async () => {
        const found = await app.page.evaluate(COLLECT, '#screen [data-p="preview"]:not([hidden])');
        seen = (found ?? []).map((c) => ({ screen: 'preview', ...c }));
        return seen.length;
      }, { timeout: 20_000, message: 'the probe lost the chips it was measuring' })
      .toBeGreaterThan(0);
    return seen;
  });

  const moved = after.filter((c) => c.cls.split(/\s+/).includes('index'));
  expect(moved.length, `the probe lost the index chips: ${evidenceOf(after)}`).toBeGreaterThan(0);
  for (const chip of moved) {
    expect(
      chip.color,
      `the stylesheet moved .chip.index to ${PROBE} and this chip did not follow, so it is `
      + `carrying its own copy of a colour styles.css owns: ${evidenceOf(after)}`,
    ).toBe(PROBE);
  }
  for (const chip of after.filter((c) => registerOf(c.cls) === 'gold')) {
    expect(
      chip.color,
      `a gov chip moved with a rule that names .index, so the classes are not doing the work `
      + `this ruling says they do: ${evidenceOf(after)}`,
    ).toBe(want['gold']);
  }
});

/**
 * **The design of record, measured in its own file.**
 *
 * `1s-c` is a defect in `docs/design/web-ui-mockup.html` itself — the rarest
 * kind this project produces and the one no parity gate can report, because
 * both files agreed. `styles-parity` was green throughout. Only looking finds
 * these, so this looks.
 */
test('the mockup draws no invisible chip either', async ({ page }) => {
  const faults = await openMockup(page);
  const bad: string[] = [];
  for (const screen of ['preview', 'ask', 'work', 'port', 'status']) {
    await showScreen(page, screen);
    // The mockup is one static document with no fetches, so a paint is enough.
    await page.waitForTimeout(120);
    const found = await page.evaluate(COLLECT, `[data-p="${screen}"]:not([hidden])`);
    for (const chip of found ?? []) {
      if (chip.ratio < 4.5) {
        bad.push(`${screen} ${JSON.stringify(chip.text)} class=${JSON.stringify(chip.cls)} `
          + `${chip.color} on ${chip.ground} (${chip.ratio}:1)`);
      }
    }
  }
  expectNoFaults(faults, 'while measuring the mockup\'s chips');
  expect(
    bad,
    'the design of record draws a chip nobody can read. Fixing the app alone would leave the '
    + 'defect in the file the app is copied FROM, which is how it got into the app: ' + bad.join(' | '),
  ).toEqual([]);
});
