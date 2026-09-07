// @basis none - a driver, not a test: it holds no assertion about the product, only the selectors and oracles the three composer specs share.
/**
 * **DRIVING THE COMPOSER AS A PERSON DRIVES IT** — the shared half of
 * `plan:builder seq:11` (D12), whose instruction is that every field, every
 * value and every interacting pair is exercised *"driven in a browser, in both
 * languages, clicking what a person clicks"*.
 *
 * Two spec files share this: `composer-matrix.spec.ts`, which sweeps the form
 * without running anything, and `composer-execute.spec.ts`, which runs what the
 * catalogue licenses and compares the answer to the real CLI's. They are two
 * files because they need two corpora — the sweep is a read and shares the
 * worker's server, while every write brings its own disposable workspace, which
 * is `e2e/execute.spec.ts`'s precedent and the one the item names.
 *
 * ── WHY THE CONTROLS ARE FOUND BY POSITION ────────────────────────────────
 *
 * `captionFor` (`src/ui/public/lib/builder.js`) writes a field's caption as a
 * bare TEXT NODE — `id *:` — deliberately, because "`category` and `--severity`
 * are the words `mycontext add` takes on a terminal, so a translated caption
 * would name an argument that does not exist". There is therefore no attribute
 * on a drawn control carrying the field's name, and inventing one for a test
 * would be adding a product seam for a test's convenience.
 *
 * What there IS, is an order: `screens/palette.js`' `build()` walks
 * `controlSpecs(def)` and appends one `label.small` per spec, in that order,
 * with exactly one exception it states out loud — the `glob` field `continue`s
 * out of the loop because "its home is the tester card, not the form list".
 * So the nth `form > label.small` is the nth non-glob spec, and that is a claim
 * about the screen rather than about a selector. `controlsOf` asserts the count
 * before it zips, so a screen that stops drawing a field fails here rather than
 * silently shifting every later field's identity by one.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';


export const PAL = '[data-p="palette"]';

/**
 * The palette card's own children, positionally, because none of the three
 * carries a class or an id to be found by.
 *
 * `screens/palette.js` appends them in one statement — `card.append(form,
 * helpBox, argvHead, chipRow, blockNote, cmdBox)` — and then appends the glob
 * tester's own `div.card` after it. So among the card's `<div>` children the
 * order is form, helpBox, cmdBox, globCard, and `:last-of-type` is the GLOB
 * TESTER rather than the command area. That mistake cost three red tests while
 * this file was being written: `#globcount` reads `1,331 / 1,331`, which is a
 * `p.small` with text in it, so a selector aimed at `bld.incomplete` found the
 * file count instead and failed with a number. `assertLayout` below turns that
 * from a silent mis-aim into a named failure.
 */
export const FORM = `${PAL} .card.pane > div:nth-of-type(1)`;
export const CMD = `${PAL} .card.pane > div:nth-of-type(3)`;

/** The CLI entry every oracle in these files runs. */
export const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

export interface Spec {
  readonly name: string;
  readonly required?: boolean;
  readonly boolean?: boolean;
  readonly input?: string;
  readonly source?: string;
  readonly options?: readonly string[];
  readonly format?: string;
  readonly joined?: boolean;
}

export interface Def {
  readonly name: string;
  readonly kind: string;
  readonly base: readonly string[];
  readonly args: readonly Spec[];
  readonly flags: readonly Spec[];
  readonly runnable?: boolean;
  readonly boundary?: boolean;
}

/**
 * **THE CATALOGUE, LOADED THE WAY THE BROWSER LOADS IT — same bytes, no build
 * step — and imported as a URL rather than as a relative specifier.**
 *
 * `test/ui/palette-lib.test.ts` already met this and already wrote down the
 * answer: `allowJs` is off and `tsconfig.json`'s `include` is `.ts` only, so a
 * resolved `.js` module is an implicit `any` and `strict` refuses it with
 * TS7016. A URL specifier is also the only form that survives a Windows path.
 * The shape is stated at the boundary rather than inferred, which is what lets
 * the rest of this file be typed at all.
 */
const DEFS_URL = new URL(`file://${path.join(
  import.meta.dirname, '..', 'src', 'ui', 'public', 'lib', 'palette-defs.js',
).replaceAll('\\', '/')}`);
const { PALETTE, commandFor, runnableFor } = await import(DEFS_URL.href) as {
  PALETTE: readonly Def[];
  commandFor: (def: Def, values: Record<string, unknown>) => string[];
  runnableFor: (def: Def) => boolean;
};

export const DEFS: readonly Def[] = PALETTE;

/** Every control a def offers, args before flags — `builder.js`' own `controlSpecs`. */
export function specsOf(def: Def): readonly Spec[] {
  return [...def.args, ...def.flags];
}

/**
 * The control kind `controlFor` will build for a spec, IN ITS BRANCH ORDER.
 *
 * The order is load-bearing and was measured wrong once while writing this:
 * `input: 'suggest'` is tested BEFORE `source`, so `pin`'s `id` — which carries
 * both — is a filtering BOX and not a `<select>`. A table that consulted
 * `source` first would expect 29 pickers where the screen draws 20.
 */
export type Kind = 'suggest' | 'select' | 'checkbox' | 'textarea' | 'glob' | 'tags' | 'text';

export function kindOf(spec: Spec): Kind {
  if (spec.input === 'suggest') return 'suggest';
  if (typeof spec.source === 'string') return 'select';
  if (Array.isArray(spec.options)) return 'select';
  if (spec.boolean === true) return 'checkbox';
  if (spec.input === 'textarea') return 'textarea';
  if (spec.input === 'glob') return 'glob';
  if (spec.input === 'tags') return 'tags';
  return 'text';
}

/** Open the Composer and wait for the entry picker the whole screen hangs off. */
export async function openComposer(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  await page.locator(`${PAL} select`).first().waitFor({ state: 'visible', timeout: 20_000 });
  await assertLayout(page);
}

/**
 * The two positional selectors above, proved on the running screen before a
 * single field is driven through them — see `CMD`'s docblock for the failure
 * this exists to name.
 */
export async function assertLayout(page: Page): Promise<void> {
  // `el('div')` sets no class attribute at all, so both of these are `null` —
  // asserted as absence rather than as an empty string, which is the shape
  // `toHaveAttribute` would have wanted and the reason this check was itself
  // red on its first run.
  for (const [selector, what] of [[FORM, 'FORM'], [CMD, 'COMMAND AREA']] as const) {
    expect(
      await page.locator(selector).getAttribute('class'),
      `the palette card's ${what} is a classless <div>; a class here means the card's child `
      + 'order has changed and every selector in this file is aimed one div out',
    ).toBeNull();
  }
  await expect(
    page.locator(`${CMD} #globcount`),
    'the command area must not contain the glob tester\'s file count — if it does, the '
    + 'card\'s child order has changed and every selector in this file is aimed one div out',
  ).toHaveCount(0);
}

/** Choose one catalogue entry, and wait for its form to have been rebuilt. */
export async function chooseEntry(page: Page, name: string): Promise<Def> {
  const def = DEFS.find((d) => d.name === name);
  if (def === undefined) throw new Error(`composer.ts: no catalogue entry named ${name}`);
  await page.locator(`${PAL} select`).first().selectOption(name);
  // Waiting on the label COUNT is what proves the rebuild landed: `build()` is
  // synchronous, but Playwright's `selectOption` returns before the change
  // event's listener has necessarily run, and the previous def's form standing
  // one tick longer would hand every caller the wrong controls.
  const wanted = specsOf(def).filter((s) => s.input !== 'glob').length;
  await expect(page.locator(`${FORM} > label.small`)).toHaveCount(wanted, { timeout: 15_000 });
  return def;
}

/**
 * Every drawn control of the chosen def, by the field's own CLI name.
 *
 * `form` is the first bare `<div>` the palette card holds (`card.append(form,
 * helpBox, argvHead, chipRow, blockNote, cmdBox)`), and `> label.small` are its
 * fields in spec order. The glob field is reached by the id the screen gives it.
 */
export async function controlsOf(page: Page, def: Def): Promise<Map<string, Locator>> {
  const labels = page.locator(`${FORM} > label.small`);
  const drawn = specsOf(def).filter((s) => s.input !== 'glob');
  await expect(
    labels,
    `${def.name}: the form must draw one label per non-glob field, in spec order — `
    + `${drawn.map((s) => s.name).join(', ')}`,
  ).toHaveCount(drawn.length, { timeout: 15_000 });

  const map = new Map<string, Locator>();
  drawn.forEach((spec, index) => {
    const kind = kindOf(spec);
    const inner = kind === 'select' ? 'select' : kind === 'textarea' ? 'textarea' : 'input';
    map.set(spec.name, labels.nth(index).locator(inner));
  });
  for (const spec of specsOf(def)) {
    if (spec.input === 'glob') map.set(spec.name, page.locator(`${PAL} #globin`));
  }
  return map;
}

/**
 * Put one value into one control the way a person does: a picker is CHOSEN, a
 * switch is CLICKED, and a box is TYPED into. `fill` rather than `type` for the
 * boxes — it is what taking a suggestion from a `<datalist>` popup does to the
 * element, which is the interaction `e2e/composer-suggest.spec.ts` already
 * models and `e2e/execute.spec.ts` uses to fill the same `id` box.
 */
export async function setValue(
  control: Locator, spec: Spec, value: string | boolean,
): Promise<void> {
  const kind = kindOf(spec);
  if (kind === 'checkbox') {
    if (value === true) await control.check();
    else await control.uncheck();
    return;
  }
  if (kind === 'select') {
    await control.selectOption(String(value));
    return;
  }
  await control.fill(String(value));
}

/** The composed line under the form, or `null` when the screen drew none. */
export async function composedLine(page: Page): Promise<string | null> {
  const code = page.locator(`${CMD} .cmd code`).first();
  if (await code.count() === 0) return null;
  return (await code.textContent()) ?? null;
}

/**
 * The four `commandChecker` states, read OFF THE SCREEN rather than out of the
 * module — which is the item's *"driven as a user"* clause applied to an
 * assertion, and is possible because `builder.js` exports the four as constants
 * "precisely so you can assert them".
 *
 * `incomplete` is a fifth answer and not a state of the checker at all: the
 * screen never asks about a line it has not finished composing
 * (`screens/palette.js`: "checking it would be asking the parser about a line
 * the reader has not finished writing").
 */
export type Verdict = 'pending' | 'passed' | 'refused' | 'unreadable' | 'incomplete';

export async function verdictOf(page: Page): Promise<Verdict> {
  const box = page.locator(CMD);
  if (await box.locator('.cmd').count() === 0) return 'incomplete';
  if (await box.locator('p.small.spill').count() > 0) return 'refused';
  const note = box.locator('p.aside.bldcheck');
  if (await note.count() === 0) return 'passed';
  const text = (await note.textContent()) ?? '';
  if (/Checking this line|נבדקת מול/.test(text)) return 'pending';
  if (/could not be checked|לא ניתן היה לבדוק/.test(text)) return 'unreadable';
  return 'passed';
}

/** Wait for the debounced check to settle into a verdict that is not pending. */
export async function settled(page: Page): Promise<Verdict> {
  await expect
    .poll(() => verdictOf(page), { timeout: 15_000, intervals: [60, 120, 250, 500] })
    .not.toBe('pending');
  return verdictOf(page);
}

/* ══ THE ORACLES ══════════════════════════════════════════════════════════ */

/**
 * **A REAL SHELL, PARSING THE LINE THE SCREEN OFFERS TO COPY.**
 *
 * The item's own words: what the screen produces "is text a person pastes into
 * a shell, so quoting is still the failure mode that matters most there". Every
 * assertion this repository has made about that so far compares the composed
 * STRING to an expected string — a second opinion about `quoteArg`, written by
 * the same hand that wrote `quoteArg`. This asks the only authority that
 * decides the question, `sh`, to split the line and say what argv it produced.
 *
 * `mycontext` is replaced by `argv-echo.mjs` before the line is handed over, so
 * the shell does the word splitting and the quote removal and NOTHING RUNS.
 * That substitution is also why this is safe to point at a hostile value: the
 * only program named on the line prints its own argv and exits.
 */
export function shellSplit(line: string): string[] {
  if (!line.startsWith('mycontext ')) throw new Error(`shellSplit: not a composed line: ${line}`);
  const echo = path.resolve(import.meta.dirname, 'argv-echo.mjs');
  const rest = line.slice('mycontext '.length);
  const out = execFileSync('bash', ['-c', `"$MYCTX_NODE" "$MYCTX_ECHO" ${rest}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MYCTX_NODE: process.execPath, MYCTX_ECHO: echo },
  });
  return JSON.parse(out) as string[];
}

/** What the catalogue means this form to compose, argv-wise. `mycontext` dropped. */
export function meantArgv(def: Def, values: Record<string, unknown>): string[] {
  return (commandFor(def, values) as string[]).slice(1);
}

/**
 * **WHAT THE FORM IS ACTUALLY HOLDING**, read off the controls rather than
 * reconstructed from what a test believes it typed.
 *
 * Found the hard way: 112 of 294 free-text cases were "wrong" on this helper's
 * first run, and 105 of them were the test's own fault. The Composer SEEDS its
 * glob control with the universal pattern — `controlFor(spec, …, { value:
 * EVERY_FILE })`, `screens/palette.js` — so every `add`, `edit`, `focus`,
 * `lesson-accept` and `review promote` line carries `--scope "**"` that nobody
 * typed and a reconstructed values bag does not know about. A test that
 * predicts the form's contents is a test that will be wrong about the screen
 * every time the screen seeds, defaults or normalises anything; reading the
 * controls is the same act `readValues` performs in the product.
 */
export async function currentValues(
  def: Def, controls: Map<string, Locator>,
): Promise<Record<string, string | true>> {
  const values: Record<string, string | true> = {};
  for (const spec of specsOf(def)) {
    const control = controls.get(spec.name)!;
    if (kindOf(spec) === 'checkbox') {
      if (await control.isChecked()) values[spec.name] = true;
      continue;
    }
    const value = await control.inputValue();
    if (value !== '') values[spec.name] = value;
  }
  return values;
}

export { runnableFor, commandFor };
