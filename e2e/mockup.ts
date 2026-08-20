/**
 * The page under test, and the twenty-one screens it must draw.
 *
 * WHAT IS UNDER TEST IS THE MOCKUP, not an implementation. `docs/design/
 * web-ui-mockup.html` is the specification — its own header says so — and
 * `src/ui/` holds three modules and two string tables, no page. Asserting
 * against a built page would be asserting that whatever was built is what was
 * built; asserting against the mockup is the only way a browser test can say
 * anything the file itself did not already say.
 *
 * `MYCONTEXT_MOCKUP` overrides the path. It exists for exactly one purpose: to
 * point the suite at a DELIBERATELY BROKEN copy and watch it go red. A browser
 * test that passes against a broken page is worse than no test, and the only
 * way to know is to break the page on purpose. The committed mockup belongs to
 * the owner and is never edited to prove a test works — the copy goes in a temp
 * directory instead.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(import.meta.dirname, '..');

export const MOCKUP_PATH = process.env['MYCONTEXT_MOCKUP'] !== undefined
  ? path.resolve(process.env['MYCONTEXT_MOCKUP'])
  : path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

export const MOCKUP_URL = pathToFileURL(MOCKUP_PATH).href;

/**
 * The screens, written out rather than read off the page.
 *
 * Reading the rail and then asserting the rail is a tautology: delete a screen
 * and the test deletes the assertion with it. The list is the specification, so
 * it is spelled here, in the mockup's own order — three groups by tense, then
 * Read — and a screen that disappears fails at the count.
 */
export const SCREENS = [
  // Injection — what arrives
  'preview', 'coverage', 'gaps', 'simulate', 'injected',
  // Evidence — why it did or didn't
  'watch', 'ask', 'doctor', 'decay', 'graph', 'status',
  // Change — composed, never run
  'work', 'capture', 'palette', 'config', 'proc', 'port', 'packs',
  // Read
  'docs', 'tut', 'learn',
] as const;

/**
 * Every console error and every uncaught exception the page produced, from the
 * first byte. Collected before `goto`, because an error thrown during load is
 * the exact failure this suite exists for and it is over before any assertion
 * could subscribe.
 *
 * A `dialog` is collected too and dismissed. `alert(1)` firing on load is not
 * hypothetical here: a literal script-closing tag inside a template string once
 * ended the script element early, the tail of the file became markup, and the
 * alert it contained fired on every load. Nothing read the file wrongly — the
 * file was read exactly right and the browser did something else.
 */
export interface PageFaults {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly dialogs: string[];
  /** Everything, flattened, for a single assertion with a readable message. */
  all(): string[];
}

export function watchForFaults(page: Page): PageFaults {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const dialogs: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`uncaught ${err.name}: ${err.message}`);
  });
  page.on('dialog', (dialog) => {
    dialogs.push(`${dialog.type()}(${JSON.stringify(dialog.message())})`);
    void dialog.dismiss();
  });

  return {
    consoleErrors, pageErrors, dialogs,
    all() { return [...consoleErrors, ...pageErrors, ...dialogs]; },
  };
}

/** Open the mockup with fault collection already armed. */
export async function openMockup(page: Page): Promise<PageFaults> {
  const faults = watchForFaults(page);
  await page.goto(MOCKUP_URL);
  return faults;
}

/**
 * Show a screen the way the rail does.
 *
 * `.click()` in page context rather than Playwright's actionability-checked
 * click, because the print stylesheet hides the rail — and a screen that cannot
 * be reached under print media is still a screen that must print.
 */
export async function showScreen(page: Page, screen: string): Promise<void> {
  await page.evaluate((s) => {
    const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
    if (btn === null) throw new Error(`no rail button for screen ${s}`);
    btn.click();
  }, screen);
}

/** Assert nothing went wrong, naming what did. */
export function expectNoFaults(faults: PageFaults, where: string): void {
  expect(faults.all(), `the page must run clean ${where}`).toEqual([]);
}
