/**
 * **The Configure composer, driven in a real browser** — `plan:config seq:1`,
 * `plan:walk seq:13`, `plan:walk seq:10`.
 *
 * `test/ui/config-screen.test.ts` holds this screen's decidable half: which
 * bytes get pasted, which line gets composed, which face a blast panel wears
 * for a given answer. What no node test can hold is the thing all three tasks
 * are actually about — **that a control a person presses composes a candidate,
 * that the candidate reaches the server, and that the number drawn back is the
 * number the server measured.** That only exists in a browser
 * (`RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it`).
 *
 * ── THE ONE ASSERTION THAT MAKES "MEASURED, NOT ESTIMATED" A FACT ─────────
 *
 * `plan:walk seq:10`: *"The blast count must stay EXACT. `cfg.spn` rules out
 * estimating it in the browser… and `scopePolicyFor` computes it over the real
 * corpus, server-side. That is the whole reason the POST exists."*
 *
 * So `the blast count is the server's own number` below does not assert a
 * CONSTANT. It captures the actual `POST /api/config/preview` response the
 * click produced, reads `governing.stopsBeingInjected.length` out of it, and
 * requires the panel's headline to carry that exact figure. A screen that
 * estimated client-side would pass a hard-coded expectation on the day it was
 * written and fail this on any corpus — which is the direction a gate about
 * exactness has to fail in.
 *
 * ── WHY THE OPENING STATE IS A NAMED ZERO AND NOT A BLANK ────────────────
 *
 * Every pane opens on the configuration in force, so its candidate resolves to
 * what the file already resolves to and the honest answer is "nothing
 * changes". `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * requires that to be DRAWN and NAMED, and the fourth pane — Watched documents
 * — requires the other clause: no endpoint measures what `watchedDocs` governs,
 * so it draws no count at all and says so.
 *
 * Selectors follow `capture-execute.spec.ts`' house style: the screen through
 * its `[data-p="…"]` region, each pane through the `data-pane` `composerPane`
 * stamps, and buttons by TEXT or by the `data-value` the segbar carries —
 * never by wording, which changes with the reader's language.
 */
import { test, expect } from './app.ts';
import type { Page, Response } from '@playwright/test';
import { settleScreen } from './settle.ts';

const CONFIG = '[data-p="config"]';
const pane = (name: string): string => `${CONFIG} [data-pane="${name}"]`;

/** Navigate to Configure and wait for the four panes to have finished drawing. */
async function openConfigure(page: Page): Promise<void> {
  // **The two bounds below add up to more than the default 30s test budget**,
  // and a test that dies on the clock reports a slow server as a broken screen
  // — the exact failure `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-
  // slow-machine` names. Measured 2026-08-29: this file starts a UI child
  // server per test, and two of six runs spent the whole settle bound still
  // holding boot reads while the same screen alone settled in 6.4s. The test
  // budget is raised so the SETTLE is what fails, with its own message.
  test.setTimeout(90_000);
  await expect(page.locator('.nav').first(),
    'the server never rendered a rail button — it probably has no token')
    .toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { location.hash = '#/config'; });
  // `requires` is the fourth fact `settle.ts` offers, and this screen needs it:
  // the panes are drawn synchronously and each one's plate is filled by a POST
  // that lands afterwards, so "the count stopped moving" is satisfied by a
  // screen whose four plates are still empty.
  // Forty samples rather than the default twenty-five. Every test in this file
  // starts its own UI child server, and the boot's nine reads plus this
  // screen's three previews land under whatever contention the run is already
  // carrying — measured 2026-08-29: alone this screen settles in 6.4s, and
  // inside the file two of six runs were still holding five boot reads at the
  // ten-second bound. A bound that expires on a busy machine reports a slow
  // server as a screen that did not draw, which is the failure
  // `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine` is
  // about — so the bound is raised rather than the assertion weakened.
  const walk = await settleScreen(page, 'config', { requires: '.blast', samples: 40 });
  expect(walk.settled,
    `Configure never settled: ${walk.count} elements, ${walk.inFlight} /api reads in flight. `
    + 'This is a LOAD failure — run this spec alone before believing anything below it.')
    .toBe(true);
}

test('four panes, each with its own heading, its own current value and its own settle step',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    // `plan:config seq:1`: Profile, Categories, Budgets, Watched documents.
    // The measurement it was written against — "one flat page… covering three
    // of the seven things config.json actually carries" — is what this ends.
    for (const name of ['profile', 'categories', 'budgets', 'watched']) {
      await expect(page.locator(pane(name)),
        `Configure has no ${name} pane — plan:config seq:1 names four subjects`)
        .toBeVisible();
      // Its own heading, its own explanatory sentence, its own plate.
      await expect(page.locator(`${pane(name)} > h3`).first()).toBeVisible();
      await expect(page.locator(`${pane(name)} .plate`)).toHaveCount(1);
      // Its own settle step: the exact bytes, and the absolute path to paste
      // them into. `config.path` is what the endpoint reported — an absolute
      // path — never the mockup's abbreviated `.my_context/config.json`.
      await expect(page.locator(`${pane(name)} pre.m`)).toHaveCount(1);
      await expect(page.locator(`${pane(name)} .cmd code`).first())
        .toContainText('config.json');
    }
  });

test('three panes compose a command line the reader can see; Budgets composes none',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    // The house pattern, shipped on the Review queue and followed exactly:
    // the composed line is visible as text, and ONE Copy-and-Execute control
    // sits beside it. `commandActions` draws `.cmdactions` with both buttons.
    const composed: Record<string, string> = {
      profile: 'mycontext status',
      watched: 'mycontext doctor',
    };
    for (const [name, line] of Object.entries(composed)) {
      const codes = page.locator(`${pane(name)} .cmd code`);
      await expect(codes, `the ${name} pane composes no command line`).toHaveCount(2);
      await expect(codes.nth(1)).toHaveText(line);
      await expect(page.locator(`${pane(name)} .cmdactions button`).first()).toBeVisible();
    }

    // Categories names the category the pane is SHOWING, so the argument moves
    // with the picker rather than being a constant.
    const chosen = await page.locator(`${pane('categories')} select.path`).inputValue();
    await expect(page.locator(`${pane('categories')} .cmd code`).nth(1))
      .toHaveText(`mycontext list ${chosen}`);

    // **Budgets composes NO line, and that is `cfg.nocmd` holding.** No
    // `mycontext` command edits or reports a budget, so the only `<code>` in
    // this pane is the path to paste into — and what it has instead is the
    // Write control ruled in on 2026-08-27.
    await expect(page.locator(`${pane('budgets')} .cmd code`)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Write budgets', exact: true }))
      .toBeVisible();
  });

test('every pane opens on a MEASURED zero, drawn and named', async ({ app }) => {
  const { page } = app;
  await openConfigure(page);

  // Nothing has been composed, so nothing changes — and a plate that showed
  // that as emptiness would be indistinguishable from a plate that failed to
  // load. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
  for (const name of ['profile', 'categories', 'budgets']) {
    const blast = page.locator(`${pane(name)} .blast`);
    await expect(blast, `${name} drew no blast panel at all`).toHaveCount(1);
    // The neutral face: not `warn`, not `crit`. Both of those claim a change.
    await expect(blast).not.toHaveClass(/\b(warn|crit)\b/);
    await expect(blast.locator('b')).toContainText('No change');
    // And no delta rows, because no value moved.
    await expect(page.locator(`${pane(name)} .delta`)).toHaveCount(0);
  }
});

test('Watched documents names itself UNMEASURED rather than drawing a zero',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    // The other clause of the same standard. `watchedDocs` is read by
    // `src/hooks/post-tool-use.ts` and by nothing `POST /api/config/preview`
    // runs, so a "0 items change" here would be a true answer to a question
    // nobody asked. The pane makes no preview call at all.
    const blast = page.locator(`${pane('watched')} .blast`);
    await expect(blast).toHaveCount(1);
    await expect(blast).not.toHaveClass(/\b(warn|crit)\b/);
    await expect(blast.locator('b')).toContainText('Unmeasured');
    // No count anywhere in the panel — this is the assertion that would fail
    // if someone later "improved" it by posting a candidate and drawing the
    // zeros that come back.
    await expect(blast).not.toContainText('No change');
  });

/**
 * **The one that makes exactness a fact rather than a claim.**
 *
 * `inert` is the most destructive change the configuration offers — `cfg.spn`
 * says so — and it is the position whose radius the mockup draws a crit panel
 * for. Pressing it composes a candidate, the candidate goes to the server, and
 * the panel's headline must carry the number that came BACK.
 */
test('the blast count is the server\'s own number, not one worked out in the browser',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    // **`rule` and not the opening category.** The pane opens on `lesson`,
    // which is the design of record's own subject — and on this corpus
    // `lesson` is `tier: rationale`, so its items are not injected under ANY
    // scope policy and `inert` moves nothing. A test that pressed the opening
    // position would assert a count of zero and prove nothing about
    // exactness. `rule` is normative by catalogue, enabled in
    // `.demo-corpus`'s own config, and its items carry no scope — which is
    // precisely the population `scopePolicy` decides the reach of.
    const picker = page.locator(`${pane('categories')} select.path`);
    const settled = page.waitForResponse((response: Response) =>
      response.url().includes('/api/config/preview'));
    await picker.selectOption('rule');
    await settled;

    const bar = page.locator(`${pane('categories')} .segbar[aria-label="scopePolicy"]`);
    await expect(bar).toBeVisible();

    const answered = page.waitForResponse((response: Response) =>
      response.url().includes('/api/config/preview') && response.request().method() === 'POST');
    await bar.locator('button[data-value="inert"]').click();
    const body = await (await answered).json() as {
      governing: { stopsBeingInjected: { id: string }[] };
      scopePolicy: { category: string; unscopedItems: { id: string }[] }[];
    };

    const stops = body.governing.stopsBeingInjected.length;
    expect(stops,
      'the corpus this suite runs over has no unscoped, normative rule item, so this test can '
      + 'prove nothing about a count. Point it at a category that has one.')
      .toBeGreaterThan(0);

    const blast = page.locator(`${pane('categories')} .blast`);
    // The destructive face, because something stops governing.
    await expect(blast).toHaveClass(/\bcrit\b/);
    // The EXACT figure, as a whole word, so `2` cannot pass against `21`.
    await expect(blast.locator('b')).toHaveText(new RegExp(`\\b${stops}\\b`));

    // And the scope-policy half of the answer, which no other pane has: the
    // unscoped items of this category, counted by the same lookup the selector
    // runs (`scopePolicyFor`), reported in the same panel.
    const entry = body.scopePolicy.find((row) => row.category !== undefined);
    expect(entry, 'the preview reported no scopePolicy change for a moved policy').toBeDefined();
    await expect(blast).toContainText(String(entry!.unscopedItems.length));

    // The plate now carries rows, one per item whose governance moved, bounded.
    await expect(page.locator(`${pane('categories')} .delta.loss`).first()).toBeVisible();
    // And the neutral row naming the value that moved, which is half of "what
    // changes" — `cfg.deltan`'s whole argument.
    await expect(page.locator(`${pane('categories')} .delta`).first())
      .toContainText('categories.rule.scopePolicy');
  });

/**
 * **The clause a browser caught, and the reason this file exists.**
 *
 * `cfg.spn` says the panel is *"how much of the corpus stops working if this
 * value changes"*, and TWO different answers are true of that sentence: an item
 * that stops GOVERNING, and an item that still governs and no longer FITS.
 *
 * The first version of `blastReading` read only the first. Driven in a real
 * browser on 2026-08-29 against the live corpus, dropping `budgets.pinned` from
 * 16,000 to 4,000 moved delivery from 25 items to 9 and spills from 1 to 17 —
 * and the panel underneath said *"No change — this is the configuration in
 * force"*, because a budget never moves `injection()`'s answer. The plate was
 * drawing the loss in three rows while the panel denied it. Nothing in the node
 * suite could see that; the screen was correct about every fact it had and
 * wrong about the one it was for.
 */
test('a budget that spills items says so, in the destructive face', async ({ app }) => {
  const { page } = app;
  await openConfigure(page);

  const pinned = page.locator(`${pane('budgets')} input[aria-label="budgets.pinned"]`);
  await expect(pinned).toBeVisible();

  const answered = page.waitForResponse((response: Response) =>
    response.url().includes('/api/config/preview') && response.request().method() === 'POST');
  // One token, which nothing on this corpus fits inside. The number is not the
  // point — what is measured is what `select` does with it.
  await pinned.fill('1');
  await pinned.blur();
  const body = await (await answered).json() as {
    selection: { before: { full: unknown[] }; after: { full: unknown[] } };
  };

  const dropped = body.selection.before.full.length - body.selection.after.full.length;
  expect(dropped,
    'this corpus delivers nothing at session start even at its own budgets, so squeezing them '
    + 'proves nothing about a spill')
    .toBeGreaterThan(0);

  const blast = page.locator(`${pane('budgets')} .blast`);
  await expect(blast, 'a budget that spills items must not read as "No change"')
    .toHaveClass(/\bcrit\b/);
  await expect(blast.locator('b')).toHaveText(new RegExp(`\\b${dropped}\\b`));
  // And the three selection rows that say the same thing in the plate above it.
  await expect(page.locator(`${pane('budgets')} .delta.loss`).first()).toBeVisible();
});

/**
 * **The same defect a third time would be free, so it is gated too.**
 *
 * `agentEdits` is one of the three lookups `POST /api/config/preview` runs and
 * it names every item of the category it moves — and it moves NEITHER what
 * governs nor what is delivered, so a panel reading only those two says "No
 * change" over a measured list. Found on the live corpus on 2026-08-29:
 * `categories.rule.agentEdits` `review`→`allow` reported thirty-nine items and
 * the panel denied all of them.
 */
test('a change to who may edit an item says so, in its own face', async ({ app }) => {
  const { page } = app;
  await openConfigure(page);

  const picker = page.locator(`${pane('categories')} select.path`);
  const settled = page.waitForResponse((response: Response) =>
    response.url().includes('/api/config/preview'));
  await picker.selectOption('rule');
  await settled;

  // The position that is NOT pressed, read off the bar rather than assumed:
  // which of `allow`/`review` a category resolves to is a property of the
  // catalogue and of the corpus's own config, not of this file.
  const bar = page.locator(`${pane('categories')} .segbar`).nth(2);
  const other = bar.locator('button[aria-pressed="false"]').first();
  await expect(other, 'the agentEdits bar has no unpressed position').toBeVisible();

  const answered = page.waitForResponse((response: Response) =>
    response.url().includes('/api/config/preview') && response.request().method() === 'POST');
  await other.click();
  const body = await (await answered).json() as {
    agentEdits: { category: string; items: unknown[] }[];
  };

  const moved = body.agentEdits.reduce((total, row) => total + row.items.length, 0);
  expect(moved, 'this corpus has no rule item, so moving agentEdits proves nothing')
    .toBeGreaterThan(0);

  const blast = page.locator(`${pane('categories')} .blast`);
  await expect(blast, 'a change to who may edit an item must not read as "No change"')
    .toHaveClass(/\bwarn\b/);
  await expect(blast.locator('b')).toHaveText(new RegExp(`\\b${moved}\\b`));
});

/**
 * `plan:config seq:4`'s acceptance test, in a browser: *"the file already HAS a
 * `categories` object, so the block is an entry INSIDE it and not a top-level
 * key — getting that wrong produces invalid JSON and a refusal that reads like
 * the wizard was wrong."*
 *
 * **REWRITTEN 2026-09-01, because this test pinned the defect.** It asserted the
 * block STARTED with `  "categories": {` — a top-level key — against a corpus
 * whose `config.json` already has one. `JSON.parse` does not refuse a duplicate
 * key: the last one wins, so following the screen would have silently replaced
 * every category override in the file, and the `JSON.parse` check below passed
 * over it because a duplicate key is not a syntax error. `pastePlan` decides the
 * placement now, and what is asserted here is the placement the reader is
 * actually in: an ENTRY, at four spaces, inside the object the file has.
 */
test('the categories pane pastes an entry INSIDE categories, and it parses',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    await page.locator(`${pane('categories')} .segbar[aria-label="scopePolicy"] `
      + 'button[data-value="inert"]').click();
    const chosen = await page.locator(`${pane('categories')} select.path`).inputValue();
    const block = await page.locator(`${pane('categories')} pre.m`).textContent() ?? '';

    // The four-space open IS the proof that this corpus has a `categories`
    // object: `pastePlan` composes the entry form for no other file. On a config
    // without one the right block is the top-level form and this assertion fails
    // loudly, rather than the test checking a branch nobody is in.
    expect(block.startsWith(`    "${chosen}": {`),
      `the composed block is not an entry inside categories: ${JSON.stringify(block.slice(0, 60))}`)
      .toBe(true);
    expect(block, 'a second top-level "categories" key silently replaces every category already set')
      .not.toContain('"categories"');
    expect(block).toContain('"scopePolicy": "inert"');

    // It parses INSIDE the object it would be pasted into — one level further in
    // than a top-level block, which is the whole of the difference. A block that
    // did not is the invalid-JSON failure the task names, caught here rather
    // than by a person whose config stopped loading.
    expect(() => JSON.parse(`{"categories":{\n${block}\n}}`) as unknown).not.toThrow();

    // And the reader is TOLD that, in step 2 — the half of the hand-off that
    // makes the block usable. A right block under no instruction is the failure
    // `plan:config seq:4` was written about.
    await expect(page.locator(`${pane('categories')} ol.steps li`)).toHaveCount(4);
    await expect(page.locator(`${pane('categories')} ol.steps li`).nth(1))
      .toContainText('categories');
  });

/**
 * **The four numbered steps, `plan:config seq:4`.**
 *
 * *"DO, as numbered steps rather than prose: the absolute path, spelled out and
 * copyable; WHERE in the file the block goes, given what the file already
 * contains; the block itself, copyable in one gesture; and what to run
 * afterwards to confirm it took."* Four `<li>` per pane, in that order, and the
 * fourth carries the composed line everywhere a line exists.
 */
test('every pane hands the paste off in four numbered steps', async ({ app }) => {
  const { page } = app;
  await openConfigure(page);

  for (const name of ['profile', 'categories', 'budgets', 'watched']) {
    const steps = page.locator(`${pane(name)} ol.steps > li`);
    await expect(steps, `the ${name} pane hands the paste off as prose, not as steps`)
      .toHaveCount(4);
    // Step 1 is the file, spelled in full, with its OWN copy control beside the
    // one on the block — a path a reader has to retype is a path they mistype.
    await expect(steps.nth(0).locator('.cmd code')).toContainText('config.json');
    await expect(steps.nth(0).locator('.cmd button')).toBeVisible();
    // Step 2 says nothing but WHERE. It carries no block and no command.
    await expect(steps.nth(1).locator('pre.m')).toHaveCount(0);
    // Step 3 is the bytes and one gesture to copy them.
    await expect(steps.nth(2).locator('pre.m')).toHaveCount(1);
    await expect(steps.nth(2).locator('.cmd button')).toBeVisible();
  }

  // Step 4 is the confirmation, and it is the step that turns a paste into a
  // settled change. Budgets is the one pane with no line — `cfg.nocmd` — and
  // its fourth step says so rather than being absent.
  await expect(page.locator(`${pane('profile')} ol.steps > li`).nth(3).locator('code'))
    .toHaveText('mycontext status');
  await expect(page.locator(`${pane('budgets')} ol.steps > li`).nth(3).locator('code'))
    .toHaveCount(0);
});

/**
 * **The category wizard, `plan:config seq:3`.**
 *
 * *"A stepped flow ... every step offers the legal values rather than expecting
 * them to be known."* What is driven here is the two things that make it a
 * wizard rather than a form: it will not carry an illegal value forward, and a
 * prefix collision is caught against the whole catalogue rather than against the
 * field. It ends in the same four-step hand-off every other pane ends in.
 */
test('the category wizard refuses a name the catalogue already has, and hands off when complete',
  async ({ app }) => {
    const { page } = app;
    await openConfigure(page);

    const wizard = page.locator(pane('wizard'));
    await expect(wizard, 'Configure has no category wizard — plan:config seq:3').toBeVisible();

    // Before anything is typed the pane says why it is not measuring, and draws
    // no steps at all: four steps about a block nobody could paste would be
    // worse than none.
    await expect(wizard.locator('ol.steps > li')).toHaveCount(0);
    await expect(wizard.locator('.plate')).not.toBeEmpty();

    const next = wizard.getByRole('button', { name: 'Next', exact: true });

    /**
     * **`fill` then `blur`, and the `blur` is the whole point.**
     *
     * Every free-text control on this screen settles on `change` and not on
     * `input` — deliberately, and `textField` records the reason: the field's
     * job is to compose a candidate and ask the server what it would do, and a
     * preview per keystroke is a request storm answering questions nobody
     * finished asking. Playwright's `fill` dispatches `input`; `change` is what
     * a real reader produces by leaving the field, and `blur` is that.
     *
     * The first version of this test used `fill` alone. It passed its
     * collision assertion and proved nothing: Next is disabled on an EMPTY
     * name too, so an assertion that only checks `toBeDisabled` after a fill
     * that never settled is green on a control nobody touched.
     */
    const settle = async (label: string, value: string): Promise<void> => {
      const field = wizard.locator(`input[aria-label="${label}"]`);
      await field.fill(value);
      await field.blur();
    };

    // A name this configuration already has. The flow refuses to carry it
    // forward — which is the cross-field check a form does at submit time, done
    // at the step that can still be fixed. The REFUSAL is asserted as well as
    // the disabled button, because "disabled" is also what an empty field
    // looks like and the two must not be confusable.
    const taken = await page.locator(`${pane('categories')} select.path`).inputValue();
    await settle('name', taken);
    await expect(wizard, `the wizard did not say why "${taken}" is refused`)
      .toContainText('already a category in this configuration');
    await expect(next, `the wizard let "${taken}" past step 1, and the catalogue already has it`)
      .toBeDisabled();

    // A fresh one is accepted, and the flow moves.
    await settle('name', 'e2e-wizard-category');
    await expect(next).toBeEnabled();
    await next.click();

    // Step 2 is the prefix, and a collision is a fact about the whole resolved
    // catalogue rather than about the field. `TASK` is `task`'s prefix in this
    // corpus's own config, and the refusal names the category it belongs to.
    await settle('prefix', 'TASK');
    await expect(wizard).toContainText('is already the prefix of');
    await expect(next, 'the wizard let a colliding prefix past — two categories would mint one id')
      .toBeDisabled();
    await settle('prefix', 'E2EW');
    await expect(next).toBeEnabled();

    // Tier, then description — the two the loader REQUIRES of a custom
    // category, and the pair that completes the flow.
    await next.click();
    await expect(wizard.locator('.segbar button[data-value="normative"]')).toBeVisible();
    await next.click();
    await settle('description', 'A category this end-to-end test defined.');

    // And now the hand-off, the same four steps as every other pane, with the
    // block placed INSIDE the object the file already has.
    const steps = wizard.locator('ol.steps > li');
    await expect(steps).toHaveCount(4);
    const block = await steps.nth(2).locator('pre.m').textContent() ?? '';
    expect(block.startsWith('    "e2e-wizard-category": {'),
      `the wizard composed ${JSON.stringify(block.slice(0, 60))}`).toBe(true);
    expect(block).toContain('"tier"');
    expect(block).toContain('"description"');
    expect(block).toContain('"prefix": "E2EW"');
    expect(() => JSON.parse(`{"categories":{\n${block}\n}}`) as unknown).not.toThrow();

    // The receipt is the same one the Categories pane takes: the category the
    // flow just defined, listed.
    await expect(steps.nth(3).locator('code'))
      .toHaveText('mycontext list e2e-wizard-category');
  });
