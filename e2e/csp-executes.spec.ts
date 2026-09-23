// @basis TASK-release-phase-3-the-defects, TASK-no-content-security-policy-header-and-no-meta-on-a-local
/**
 * **THE PROOF OWNER RULING E (2026-09-21) ATTACHED TO THE CONTENT-SECURITY-
 * POLICY: every command-executing screen still executes its commands under the
 * header.**
 *
 * The ruling's condition, verbatim: *"Content-Security-Policy on, `script-src
 * 'self'`, styles unrestricted, AND the lane proves every command-executing
 * screen (composer, palette, builder, config) still executes its commands
 * under the header before it lands."*
 *
 * ── WHY THE PROOF IS A FILE RATHER THAN A PARAGRAPH ────────────────────────
 *
 * `TASK-no-content-security-policy-header-and-no-meta-on-a-local` argued
 * AGAINST the header on 2026-08-22 and `security.ts` carried pages of that
 * argument. The half of it that was measured — that `style-src` governs the
 * style ATTRIBUTE and not the CSSOM, so no chart was ever blocked — is still
 * true and is kept as history where it was written. The half that was NOT
 * measured is the half this file exists for: nobody had ever driven a command
 * to completion in a browser with the header on. "It probably still works" is
 * the shape of claim this project spent 2026-08-22 discovering it had been
 * making about a header nothing sent.
 *
 * So the proof is a run, and it was run BEFORE the header existed as well as
 * after. The baseline matters: a spec that only ever ran green under the header
 * cannot tell "the CSP costs nothing" apart from "these four screens were
 * already broken and this spec never noticed".
 *
 * ── THE FOUR SCREENS, AND THE NAMES THE RULING USES FOR THEM ───────────────
 *
 * The product's own string table answers most of this: `s.palette` is
 * `'Composer'`, so the Composer IS the `[data-p="palette"]` screen and the
 * ruling's "composer" and "palette" are one region with two execution paths.
 * They are proved separately because they are separately breakable:
 *
 *   composer   `mycontext status` — the argument-less read. The Composer's
 *              picker, the builder's command area, the confirm, the nonce.
 *   palette    `mycontext show <id>` — a CATALOGUE entry that takes an
 *              argument, so the suggest box and `commandFor`'s argv assembly
 *              are on the path as well as the run.
 *   builder    Capture (`[data-p="capture"]`), which is `lib/builder.js`
 *              rendering a catalogue entry on a screen that is not the
 *              Composer — the ruling's "builder" — executing `mycontext add`.
 *   config     Configure (`[data-p="config"]`), whose Profile pane composes a
 *              line and hands it to the same one Copy-and-Execute control
 *              (`screens/config.js` · step 4).
 *
 * Two further screens execute — the Review queue (`screens/work.js`) and
 * Doctor's repair (`screens/doctor.js`) — and both are driven to their confirm
 * by `e2e/execute.spec.ts` in the same gate run, so the header is proved over
 * them too without a second corpus copy here.
 *
 * ── HOW A CSP VIOLATION IS CAUGHT, WHICH IS TWICE AND NOT ONCE ─────────────
 *
 * 1. `page.on('console')` / `page.on('pageerror')`, matched against
 *    `Content-Security-Policy` and `Refused to`. This is the brief's own
 *    instrument and it is what a person sees in DevTools.
 * 2. The `securitypolicyviolation` DOM event, registered through
 *    `addInitScript` so it is armed before the document's first byte. Playwright
 *    injects that through CDP, which is not subject to the page's own policy,
 *    so the recorder cannot be silenced by the thing it is recording.
 *
 * The second exists because the first is a STRING MATCH on a browser's
 * diagnostic wording, which is neither stable nor translated-into-anything
 * this project controls. A violation that Chrome words differently tomorrow
 * would pass (1) and still fail (2), and the event carries the directive and
 * the blocked URI, which is what a fix needs.
 *
 * Every phase asserts BOTH lists empty at the end, and the assertion names the
 * screen — a page-load violation and a violation raised by pressing Execute are
 * different defects with different fixes.
 *
 * ── WHY EACH PHASE OWNS A DISPOSABLE TWIN OF THE CORPUS ────────────────────
 *
 * These phases press Execute and RUN commands. `src/ui/execute.ts` appends an
 * `execute` record BEFORE it runs anything, so there is no such thing as
 * running a read from this UI without writing to the corpus it read — and one
 * of the four runs `mycontext add`, which writes an item. `scratchCorpus`
 * (`e2e/scratch-corpus.ts`) is the owner's exception spelled as a function, and
 * `e2e/execute.spec.ts` is the precedent this follows rather than a new
 * mechanism.
 *
 * A twin per PHASE rather than one twin for the file: each phase then fails as
 * itself, on its own server, with no other phase's write underneath it — and a
 * red gate names the screen that broke rather than the first one in the list.
 */
import { test as base, expect } from '@playwright/test';
import type { ConsoleMessage, Locator, Page } from '@playwright/test';
import { readAudit } from '../src/core/audit.ts';
import { snapshot } from '../src/ui/execute-effect.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { scratchCorpus } from './scratch-corpus.ts';
import { openApp } from './composer-run.ts';

const PALETTE = '[data-p="palette"]';
const CAPTURE = '[data-p="capture"]';
const CONFIG = '[data-p="config"]';

/**
 * How long one phase may take. A twin is a copy of a 1,085-item corpus plus two
 * rebuilds (12-20s, measured by `scratch-corpus.ts`), and the confirm GET is
 * not a lookup — it DERIVES the effect by copying the corpus again and running
 * the command in the copy (`src/ui/execute-effect.ts`), which costs real
 * seconds twice over. `composer-execute.spec.ts` budgets 600s for a sweep of
 * every read; one run plus one twin is given a third of that.
 */
const PHASE_BUDGET = 300_000;

/** The wording Chrome uses when a policy blocks something. Both halves, per the brief. */
const CSP_WORDS = /Content-Security-Policy|Refused to/i;

/** One violation, as the DOM event reports it — the directive and what it blocked. */
interface Violation {
  directive: string;
  blocked: string;
  source: string;
}

/** What a phase collects while it drives the screen. */
interface Watch {
  /** Console lines and page errors that mention a policy. */
  said: string[];
  /** `securitypolicyviolation` events, read out of the page at the end. */
  events: () => Promise<Violation[]>;
}

/**
 * Arm both recorders on a page that has not navigated yet.
 *
 * `addInitScript` runs before any of the document's own script on every
 * document, so a violation raised by the very first module load is caught. The
 * array is hung off `window` under a name nothing in `src/ui/public/` uses; it
 * is read back with `page.evaluate` rather than pushed through `console.log`,
 * because a recorder that reports through the channel it is watching is a
 * recorder that can be mistaken for the thing it found.
 */
async function watchForCsp(page: Page): Promise<Watch> {
  const said: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (CSP_WORDS.test(text)) said.push(`[console.${message.type()}] ${text}`);
  });
  page.on('pageerror', (error: Error) => {
    const text = `${error.message}`;
    if (CSP_WORDS.test(text)) said.push(`[pageerror] ${text}`);
  });
  await page.addInitScript(() => {
    const seen: unknown[] = [];
    (globalThis as unknown as Record<string, unknown>).__cspViolations = seen;
    globalThis.addEventListener('securitypolicyviolation', (event: Event) => {
      const e = event as SecurityPolicyViolationEvent;
      seen.push({
        directive: e.effectiveDirective || e.violatedDirective,
        blocked: e.blockedURI,
        source: `${e.sourceFile}:${e.lineNumber}`,
      });
    });
  });
  return {
    said,
    events: async (): Promise<Violation[]> => await page.evaluate(
      () => ((globalThis as unknown as Record<string, unknown>).__cspViolations ?? []) as unknown,
    ) as Promise<Violation[]>,
  };
}

/** Both recorders must be empty, and the failure names the screen and the directive. */
async function assertNoViolations(watch: Watch, what: string): Promise<void> {
  const events = await watch.events();
  expect(
    events.map((v) => `${v.directive} blocked ${v.blocked} (${v.source})`),
    `${what}: the page raised securitypolicyviolation. Under owner ruling E the answer is to fix `
    + 'the DIRECTIVE or the screen — never to remove the header.',
  ).toEqual([]);
  expect(
    watch.said,
    `${what}: the browser console mentioned a Content-Security-Policy refusal. Under owner `
    + 'ruling E the answer is to fix the directive or the screen — never to remove the header.',
  ).toEqual([]);
}

/**
 * Press Execute and wait for the confirm — or for the reason there will not be
 * one. Lifted in shape from `composer-run.ts`'s `pressExecute`, generalised
 * over the screen's region because three of the four screens here are not the
 * Composer and its selectors are the Composer's.
 *
 * The wait races the confirm against the control's OWN result region, which is
 * where `src/ui/execute-effect.ts` puts its refusal — so a confirm that is
 * refused in one second fails in the server's words instead of timing out in
 * four minutes saying only "hidden".
 */
/** What pressing Execute produced: a confirm to answer, or the reason there is none. */
interface Pressed {
  state: 'open' | 'refused';
  confirm: Locator;
  /** Everything the result region said, when the confirm did not open. */
  said: string;
}

async function pressExecuteOn(page: Page, screen: string, what: string): Promise<Pressed> {
  const actions = page.locator(`${screen} .cmdactions`).first();
  const execute = actions.getByRole('button', { name: 'Execute', exact: true });
  await expect(
    execute,
    `${what}: this screen must offer Execute beside Copy — without it there is nothing to prove`,
  ).toBeVisible({ timeout: 30_000 });
  await execute.click();

  const confirm = actions.locator('.confirm');
  let state = 'waiting';
  await expect
    .poll(async () => {
      state = await readState();
      return state === 'waiting' ? 'waiting' : 'settled';
    }, {
      timeout: 180_000,
      intervals: [200, 500, 1000, 2000],
      message: `${what}: the confirm neither opened nor said why`,
    })
    .toBe('settled');
  if (state === 'open') return { state: 'open', confirm, said: '' };
  return { state: 'refused', confirm, said: state };

  async function readState(): Promise<string> {
    if (await confirm.isVisible().catch(() => false)) return 'open';
    const said = (await actions.locator('.execresult').first().textContent().catch(() => '')) ?? '';
    if (said.trim() === '' || /Checking|בודק|נבדק/.test(said)) return 'waiting';
    return said.trim();
  }
}

/** `pressExecuteOn`, and the confirm MUST have opened. */
async function openConfirmOn(page: Page, screen: string, what: string): Promise<Locator> {
  const pressed = await pressExecuteOn(page, screen, what);
  expect(
    pressed.state === 'open' ? 'open' : `the control says: ${pressed.said.slice(0, 500)}`,
    `${what}: the confirm must open`,
  ).toBe('open');
  return pressed.confirm;
}

/**
 * Press Execute, answer the confirm, and read the receipt the screen drew.
 *
 * THE NONCE PATH IS NOT BYPASSED: the nonce is minted by the confirm GET and
 * spending it is the only way to reach the run, which is the approval boundary
 * `composer-run.ts` records must not be shortcut to make a test convenient.
 *
 * The receipt is looked up by the EXIT CODE it carries rather than by position.
 * An Execute redraws the screen it was run on, `app.js`'s `attachExecuteOutcome`
 * re-homes the outcome onto the control it came from, and the top of the
 * section is the fallback — so pinning a placement here would assert whichever
 * half happens to apply. `e2e/doctor-outcome.spec.ts` owns the placement;
 * this file's business is that the run happened and said so.
 */
async function runFrom(page: Page, screen: string, what: string): Promise<string> {
  const confirm = await openConfirmOn(page, screen, what);
  await confirm.getByRole('button', { name: 'Run it', exact: true }).click();
  const receipt = page.locator(`${screen} .execresult`).filter({ hasText: /exit\s+-?\d+/ }).first();
  await expect(
    receipt,
    `${what}: the run must come back with an exit code on screen`,
  ).toBeVisible({ timeout: 180_000 });
  return await receipt.innerText();
}

/** One `execute-done` row, which is the SERVER's record that it ran the command. */
interface DoneRow {
  op?: string;
  command?: { id?: string; argv?: string[]; exitCode?: number | null };
}

/**
 * The completion rows the run left in the twin's own audit log.
 *
 * `execute-done` rather than `execute`: `src/ui/execute.ts` writes the first
 * BEFORE it spawns anything, so an `execute` row proves only that the route was
 * asked. The pair is joined by `at` + `command.id` and the second one carries
 * the exit code, so it is the row that says the command ran to the end.
 */
function completions(myContextDir: string): DoneRow[] {
  return (readAudit(myContextDir) as unknown as DoneRow[]).filter((r) => r.op === 'execute-done');
}

/** An id this twin's own files carry — never one typed into this file. */
function firstItemId(myContextDir: string): string {
  for (const [, text] of snapshot(myContextDir)) {
    const id = /^id:\s*(\S+)/m.exec(text)?.[1];
    if (id !== undefined) return id;
  }
  throw new Error(`csp-executes: no item under ${myContextDir}`);
}

/**
 * One phase: a twin, a server of its own, both recorders armed before the first
 * navigation, and the twin removed afterwards whether the phase passed or not.
 *
 * The violation assertion is made in the `finally` side of the body's own
 * return, not here, so a phase that fails on its screen reports THAT failure
 * rather than being overwritten by an empty violation list.
 */
async function phase(
  page: Page,
  what: string,
  body: (ctx: { page: Page; myContextDir: string; watch: Watch }) => Promise<void>,
): Promise<void> {
  const watch = await watchForCsp(page);
  const scratch = scratchCorpus();
  let harness: UiHarness | undefined;
  try {
    harness = await startUiChild(scratch.root, [], scratch.env);
    await openApp(page, harness);
    // The load itself is a measurement: `src/ui/public/` is one `<script
    // type="module">` and a stylesheet, and a `script-src 'self'` that refused
    // either of them would leave every phase below asserting against a blank
    // page rather than reporting the refusal.
    await assertNoViolations(watch, `${what}: the page load`);
    await body({ page, myContextDir: scratch.myContextDir, watch });
  } finally {
    if (harness !== undefined) await harness.stop();
    scratch.dispose();
  }
}

/* ══ 1 — THE COMPOSER: the argument-less read ═════════════════════════════ */

base('the Composer executes a command under the header, and raises no CSP violation',
  async ({ page }) => {
    base.setTimeout(PHASE_BUDGET);
    await phase(page, 'Composer', async ({ myContextDir, watch }) => {
      await page.evaluate(() => { location.hash = '#/palette'; });
      const picker = page.locator(`${PALETTE} select`).first();
      await picker.waitFor({ state: 'visible', timeout: 30_000 });
      // `status` rather than `doctor`: `doctor` exits 1 whenever the corpus
      // carries an error-level finding, so asserting a clean exit from it would
      // be asserting a fact about today's corpus content rather than about the
      // confirm-then-run mechanism. `e2e/execute.spec.ts` records the same
      // choice for the same reason.
      await picker.selectOption('status');

      const receipt = await runFrom(page, PALETTE, 'Composer · mycontext status');
      expect(receipt, 'the Composer\'s run of `mycontext status` must exit clean')
        .toContain('exit 0');

      const done = completions(myContextDir);
      expect(
        done.map((r) => r.command?.id),
        'the server must have recorded one `execute-done` row for the Composer\'s run',
      ).toEqual(['status']);
      expect(done[0]?.command?.exitCode, 'and the row must carry the clean exit').toBe(0);

      await assertNoViolations(watch, 'Composer · after the run');
    });
  });

/* ══ 2 — THE PALETTE: a catalogue entry that takes an argument ════════════ */

base('a palette entry with an argument executes under the header, and raises no CSP violation',
  async ({ page }) => {
    base.setTimeout(PHASE_BUDGET);
    await phase(page, 'Palette', async ({ myContextDir, watch }) => {
      const id = firstItemId(myContextDir);

      await page.evaluate(() => { location.hash = '#/palette'; });
      const picker = page.locator(`${PALETTE} select`).first();
      await picker.waitFor({ state: 'visible', timeout: 30_000 });
      await picker.selectOption('show');

      // `show`'s required `id` is a FILTERING BOX over the corpus's own items
      // (`input: 'suggest', source: 'items'`), not a `<select>` — `fill` is
      // exactly what taking a suggestion from the popup does to it.
      const idBox = page.locator(`${PALETTE} input[list="sugg-id"]`).first();
      await idBox.waitFor({ state: 'visible', timeout: 30_000 });
      await idBox.fill(id);

      const receipt = await runFrom(page, PALETTE, `Palette · mycontext show ${id}`);
      expect(receipt, 'the palette entry\'s run must exit clean').toContain('exit 0');
      expect(
        receipt,
        'and the outcome must carry the item the argument named — an argv assembled without it '
        + 'would run a different command and still draw an exit code',
      ).toContain(id);

      const done = completions(myContextDir);
      expect(
        done.map((r) => r.command?.argv?.join(' ')),
        'the server must have recorded the run WITH its argument',
      ).toEqual([`show ${id}`]);

      await assertNoViolations(watch, 'Palette · after the run');
    });
  });

/* ══ 3 — THE BUILDER: Capture, which is the builder off the Composer ══════ */

/**
 * **WHAT THIS PHASE ASSERTS, AND WHY IT STOPS WHERE IT DOES — a defect this
 * file MEASURED rather than a bar it lowered.**
 *
 * Capture's Execute cannot reach a completed run TODAY, and the header has
 * nothing to do with it. Measured 2026-09-23 on the baseline run, before the
 * CSP existed, in the CLI's own words through the confirm:
 *
 *     my_context: this capture carries no summary, and an item created without
 *     one can never afterwards be asked for it … Nothing was created.
 *
 * `capture.js`' `FIELDS` is `['category', 'title', 'scope', 'severity']`
 * (`src/ui/public/screens/capture.js` ~314) and the catalogue's `add` carries a
 * `summary` field and a `summary-omitted` flag that this screen offers neither
 * of — so every line Capture composes is one `mycontext add` refuses, and
 * `src/ui/execute-effect.ts` refuses the CONFIRM outright on a non-zero dry
 * run. The screen offers Execute and Execute can never finish. That is
 * reported as a finding against a file this task does not hold; it is not
 * this file's to fix and it is not silently passed over either.
 *
 * So the phase asserts everything that IS reachable, which is the whole of the
 * CSP-relevant path: the builder renders on a screen that is not the Composer,
 * the press reaches the server, the SERVER RUNS THE COMMAND — `deriveEffect`
 * copies the corpus and executes the real CLI in the copy, which is an
 * execution and is what produced the sentence above — the answer comes back
 * over `fetch` and the screen renders it. Every mechanism a `script-src 'self'`
 * could break is on that path. What is NOT on it is the second half of a POST
 * this screen's own composed argv cannot legally reach.
 *
 * The day `summary` is added to `FIELDS`, this phase should be lifted to
 * `runFrom` + an `execute-done` row like the other three, and the assertion
 * below will fail as itself the moment the refusal stops arriving — so it
 * cannot quietly outlive the defect it describes.
 */
base('Capture — the builder on its own screen — reaches the server under the header, and raises no CSP violation',
  async ({ page }) => {
    base.setTimeout(PHASE_BUDGET);
    await phase(page, 'Capture', async ({ watch }) => {
      await page.evaluate(() => { location.hash = '#/capture'; });

      // Addressed by position because `capture.js` gives these controls neither
      // id nor class, deliberately — `e2e/capture-execute.spec.ts` carries the
      // reason (the mockup's `id="globin"` would collide with the Composer's
      // once both screens have been visited).
      const category = page.locator(`${CAPTURE} select`).first();
      await category.waitFor({ state: 'visible', timeout: 30_000 });
      // The first REAL option: the leading one is the "absent" placeholder, and
      // choosing it leaves the capture half-built and the command refused.
      const chosen = await category.locator('option').nth(1).getAttribute('value');
      expect(chosen, 'the category select offers no real category, so nothing can be composed')
        .toBeTruthy();
      await category.selectOption(chosen as string);

      // **A title distinctive enough to be nobody's twin.** The contradiction
      // gate runs on `add` (landed 2026-09-08, `9c9cd31b`) and refuses a near
      // twin of something already governing; `src/ui/execute-effect.ts` refuses
      // the CONFIRM outright when the dry run exits non-zero, so a bland title
      // would present here as "the confirm never opened" and would be read as
      // the CSP having broken the screen. `e2e/seeds.ts`' `pinnableItem` takes
      // the same precaution for the same reason.
      const title = page.locator(`${CAPTURE} input[type="text"]`).first();
      await title.waitFor({ state: 'visible', timeout: 30_000 });
      await title.fill(
        'csp proof capture: quokkas audit the turnstile ledger at dusk on a Wednesday',
      );

      // The command block is the precondition for everything below: nothing
      // renders until a category and a title exist, so without this wait the
      // assertions would measure an empty screen.
      await page.locator(`${CAPTURE} div.cmd`).first()
        .waitFor({ state: 'visible', timeout: 30_000 });

      const pressed = await pressExecuteOn(page, CAPTURE, 'Capture · mycontext add');
      // The server RAN the command — `deriveEffect` executes the real CLI in a
      // copy of the corpus — and the screen rendered what it said. Both halves
      // are asserted: an empty answer, or one this file wrote itself, would
      // prove nothing about the round trip.
      expect(
        pressed.said,
        'Capture pressed Execute and the server neither confirmed nor answered. Under the header '
        + 'that would mean the fetch or the rendering was refused; without it, it means the '
        + 'derivation never returned.',
      ).not.toEqual('');
      expect(
        pressed.said,
        'the answer Capture drew must be the CLI\'s OWN words, carried back from a real run in '
        + 'the derivation copy — see this phase\'s docblock for why it is a refusal today',
      ).toContain('summary');
      expect(
        pressed.said,
        'and it must name the remedy the CLI names, so this assertion fails as itself the day '
        + '`FIELDS` gains `summary` and the refusal stops arriving',
      ).toContain('--summary-omitted');

      await assertNoViolations(watch, 'Capture · after the press');
    });
  });

/* ══ 4 — CONFIGURE: the pane that composes a line and hands it to the same
        one Copy-and-Execute control ═════════════════════════════════════ */

base('Configure executes the line its pane composed under the header, and raises no CSP violation',
  async ({ page }) => {
    base.setTimeout(PHASE_BUDGET);
    await phase(page, 'Configure', async ({ myContextDir, watch }) => {
      await page.evaluate(() => { location.hash = '#/config'; });

      // The Profile pane's step 4 — "what to run afterwards, which is what
      // turns a paste into a settled change" — is `mycontext status` and it is
      // drawn through `commandActions` with the catalogue id, so it carries a
      // real Execute rather than Copy alone.
      const profile = page.locator(`${CONFIG} [data-pane="profile"]`);
      await expect(profile, 'Configure drew no profile pane').toBeVisible({ timeout: 30_000 });
      await expect(
        profile.locator('.cmd code').nth(1),
        'the profile pane composes no command line, so there is nothing to execute',
      ).toHaveText('mycontext status', { timeout: 30_000 });

      const receipt = await runFrom(page, `${CONFIG} [data-pane="profile"]`, 'Configure · profile');
      expect(receipt, 'Configure\'s run of `mycontext status` must exit clean').toContain('exit 0');

      const done = completions(myContextDir);
      expect(
        done.map((r) => r.command?.id),
        'the server must have recorded one `execute-done` row for Configure\'s run',
      ).toEqual(['status']);

      await assertNoViolations(watch, 'Configure · after the run');
    });
  });
