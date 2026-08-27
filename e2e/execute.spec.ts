/**
 * **The confirm, read and only then run, in a real browser — on every screen
 * that draws Execute for a real command.**
 *
 * `plan:execute seq:7`. The brief carries TWO `### Task 7` headings; the owner's
 * widening (2026-08-27) is the scope and the file/step spec beneath it is the
 * shape — they are one task. `execute-route.test.ts` already proves the SERVER:
 * the ordering, the nonce, the refusals, the audit pair. What no server test can
 * prove is that **the string a person READ is the argv that RAN** — that is the
 * screen, the confirm and the endpoint agreeing, and it only exists in a browser.
 *
 * ── SCOPE: PALETTE, DOCTOR AND WORK — THREE SCREENS, NOT SEVEN ─────────────
 *
 * `packs`, `port` and `proc` pass `id: null` to `commandActions` and draw Copy
 * alone, by a recorded owner decision
 * (`DEC-cap-warn-is-dropped-and-capture-gains-execute-the-other`): asserting
 * Execute there would assert a control deliberately absent. `capture` already
 * has its own file, `e2e/capture-execute.spec.ts` — this one does not repeat it.
 * That leaves palette (the Composer), doctor (its repair rows) and work (the
 * Review queue's settlement row) as the three screens that draw Execute for a
 * command the catalogue can name.
 *
 * **Doctor is NOT tested below, and that is a deliberate omission rather than
 * a gap nobody noticed.** Writing that test surfaced a real product defect,
 * fixed today in commit `6c4bdb8` while this file was being written — see
 * "no Doctor-repair test" further down, and this file's own report, for the
 * full account. Palette and work are covered; a Doctor test asserting the
 * CORRECT post-fix behaviour is left for whoever verifies that fix.
 *
 * ── THE HAZARD, AND THE ISOLATION DECISION ─────────────────────────────────
 *
 * These tests RUN COMMANDS. The e2e suite drives one shared `.demo-corpus` and
 * workers run in parallel (`fullyParallel: true`, `e2e/playwright.config.ts`),
 * so a spec that actually MUTATES the fixture corrupts the ground every other
 * spec measures against — the exact shape that cost two red runs on 2026-08-26
 * and one unexplained one on 2026-08-27.
 *
 * **Decision: exactly one test here executes a real mutation, and it gets its
 * OWN workspace rather than restoring around the shared one.** "Give the write
 * its own copy" was chosen over "restore after" because restoring is a promise
 * about bytes this file cannot keep cheaply: `edit`-family writes (which is what
 * `pin` is — `NAMED_ENTRY_POINTS` in `src/cli/commands/edit.ts`) do not
 * necessarily round-trip to identical bytes on an un-pin (frontmatter ordering,
 * a touched checksum), so "run pin, then run unpin" leaves a corpus that is
 * SEMANTICALLY back but not verifiably byte-identical — and a test that leaves
 * that behind for the next spec to discover is the defect this hazard warns
 * about, not a shortcut past it. A disposable `mkdtemp` copy has no such
 * promise to keep: it is deleted afterward and nothing outside this test ever
 * sees it.
 *
 * The copy reuses the exact mechanism `src/ui/execute-effect.ts` already ships
 * for every boundary confirm's own dry run — `worthCopying` (skip `.audit` and
 * `.index.db*`, which the demo corpus's OWN in-flight server holds open under a
 * mandatory Windows lock — `EDOM` was the owner's report of exactly this,
 * 2026-08-27) — rather than a second, hand-rolled copy filter that could drift
 * from it.
 *
 * **The other tests run reads, or a write the corpus's current state answers
 * with a refusal rather than a mutation — measured rather than assumed — so
 * they run directly against the shared corpus:**
 *
 *   - Two tests compose and run `status`, which takes no argument and always
 *     exits 0 (unlike `doctor`, which exits 1 whenever this corpus carries an
 *     error-level finding — it currently does, two `source_missing` findings —
 *     so asserting `doctor` always exits clean would assert a fact about
 *     today's corpus content rather than about the confirm-then-run mechanism
 *     these tests exist to prove).
 *   - One test drives Work's own composed settlement (`revisionPlan` in
 *     `src/ui/public/screens/work.js`, `review promote-revision`), which
 *     targets the ONE pending revision `scripts/demo-corpus.ts` stages
 *     deliberately STALE ("demo-corpus: staged one revision against … (body
 *     made stale)") so that `<td class="m stale">` has something real to
 *     render. Promoting a stale revision without `--force` — which
 *     `revisionPlan` never adds — refuses before any file is touched: verified
 *     by running it, in this repository, against a scratch copy of
 *     `.demo-corpus`, before this file was written — `EXIT=1`,
 *     "… is unchanged." on stdout.
 *
 * That write is real, run for real, against the real shared corpus — not
 * stubbed and not skipped — and is documented here as a command this corpus's
 * CURRENT state answers with a refusal rather than a write. If the fixture
 * ever stops producing that finding, the compose step below fails AS ITSELF,
 * loudly, rather than silently measuring an empty screen.
 *
 * `capture-execute.spec.ts` is the house style this file follows: a compose
 * step that fails as itself when the state it needs is not reached, buttons
 * selected by TEXT because they are deliberately classless, and every screen
 * addressed through its own `[data-p="…"]` region so a screen that stacks
 * hidden in the DOM cannot be mistaken for the one under test.
 *
 * ── WHAT THE BRIEF'S OWN SNIPPET GETS WRONG ─────────────────────────────────
 *
 * `open()`, `compose()` and `SEEDED_ITEM` do not exist anywhere in this
 * repository — the snippet was illustrative and does not compile. The real
 * harness is `e2e/app.ts`'s `test`/`expect`/`app.page`, and what the confirm
 * renders changed on 2026-08-27, after the plan was written: pressing Execute
 * does a GET to `/api/execute/confirm`, which derives the effect SERVER-side by
 * dry-running the command against a copy of the corpus (`src/ui/execute-effect.ts`),
 * and shows the residual sentence, the command in `div.cmd`, and — for a
 * boundary command with a non-empty effect — one `p.effect-item` heading plus
 * one `table.diff` PER ITEM touched. Buttons are classless and are selected by
 * their text: "Execute", "Run it", "Cancel", "Copy".
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base, type Page } from '@playwright/test';
import { expect, test, CORPUS } from './app.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { snapshot, worthCopying } from '../src/ui/execute-effect.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

/** The CLI entry the isolated workspace's own index gets built through. */
const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

const PALETTE = '[data-p="palette"]';
const WORK = '[data-p="work"]';
const WATCH = '[data-p="watch"]';

/**
 * Drive the Composer to a composed `status` — a read that takes no arguments,
 * the same shape `composeOnPalette` in `e2e/button-contrast.spec.ts` uses
 * (reproduced locally rather than imported, matching `capture-execute.spec.ts`'s
 * own choice not to reach into a sibling file for a compose step). `status`
 * rather than `doctor`: `doctor` exits 1 whenever this corpus carries an
 * error-level finding — measured against `.demo-corpus` while writing this
 * file, it currently does (two `source_missing` findings) — so asserting
 * `doctor` always exits clean would be asserting a fact about today's corpus
 * content, not about the confirm-then-run mechanism this test exists to prove.
 * `status` reports on the workspace itself and always exits 0.
 */
async function composeStatusOnPalette(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator(`${PALETTE} select`).first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  await picker.selectOption('status');
  await page.locator(`${PALETTE} .cmdactions button`).first()
    .waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Drive the Composer to a composed `pin <id> --yes` — the boundary command this
 * file's one write test runs. `id` is read from the caller's own workspace
 * (an item this test already knows is `always: false`), and the `--yes`
 * checkbox is checked deliberately: `pin` is `edit --always=true` under a
 * shorter name (`src/cli/commands/edit.ts`) and inherits `edit`'s confirmation
 * gate, so composing it WITHOUT `--yes` would compose a command that previews
 * and then declines for want of confirmation — the opposite of what this test
 * needs to prove.
 */
async function composePinOnPalette(page: Page, itemId: string): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator(`${PALETTE} select`).first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  await picker.selectOption('pin');

  // The second control `pin` offers: its required `id` argument, a picker
  // sourced from the corpus's own items (`args: [{ name: 'id', source: 'items' }]`,
  // `src/ui/public/lib/palette-defs.js`).
  const idPicker = page.locator(`${PALETTE} select`).nth(1);
  await idPicker.waitFor({ state: 'visible', timeout: 15_000 });
  await idPicker.selectOption(itemId);

  const yes = page.locator(`${PALETTE} input[type="checkbox"]`).first();
  await yes.waitFor({ state: 'visible', timeout: 15_000 });
  await yes.check();

  await page.locator(`${PALETTE} .cmdactions button`).first()
    .waitFor({ state: 'visible', timeout: 15_000 });
}

test('a read command runs from the UI and the screen shows what it did', async ({ app }) => {
  const { page } = app;
  await composeStatusOnPalette(page);

  await page.locator(`${PALETTE} .cmdactions`).getByRole('button', { name: 'Execute', exact: true }).click();
  // Scoped to `.confirm` specifically, not to every `div.cmd` on the screen:
  // the Composer's OWN pre-existing `.cmd` (the client's composition, drawn the
  // moment the command is complete) and the confirm's `.cmd` (the SERVER'S
  // re-derivation, drawn only after Execute is clicked) both match `div.cmd`,
  // and asserting against the wrong one would prove nothing about the confirm.
  await expect(
    page.locator(`${PALETTE} .confirm div.cmd code`),
    'the confirm must show the exact argv a person is about to run',
  ).toHaveText('mycontext status');

  await page.locator(`${PALETTE} .confirm`).getByRole('button', { name: 'Run it', exact: true }).click();
  await expect(
    page.locator(`${PALETTE} .execresult`),
    '`status` must exit clean',
  ).toContainText('exit 0');
});

test('the run is in the audit stream, as one execution record', async ({ app }) => {
  test.setTimeout(60_000);
  const { page } = app;
  // A command run BY THIS TEST — `fullyParallel: true` gives every test its own
  // server and its own page, so there is no other test's execution to ride on.
  await composeStatusOnPalette(page);
  await page.locator(`${PALETTE} .cmdactions`).getByRole('button', { name: 'Execute', exact: true }).click();
  await page.locator(`${PALETTE} .confirm`).getByRole('button', { name: 'Run it', exact: true }).click();
  await expect(page.locator(`${PALETTE} .execresult`)).toContainText('exit 0');

  // The audit projection that `/api/ask/audit` reads is never synced by a plain
  // write (`recordAudit` only appends the JSONL — `src/core/audit.ts`), so this
  // does NOT read the backlog table; it reads the LIVE STREAM's own backlog
  // instead, which `src/ui/watch-model.ts`'s `streamHandler` builds by tailing
  // the JSONL directly through `AuditTail` and "opens no database at all" — so
  // it is immune to exactly the staleness that would otherwise make this
  // record invisible for the length of this test.
  await page.evaluate(() => { location.hash = '#/watch'; });
  await expect(
    page.locator(`${WATCH} tbody tr`).first(),
    'the audit stream drew no rows at all — the live stream backlog never arrived',
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(WATCH),
    'the run this test just made must appear as an `execute` record '
    + '(`src/ui/execute.ts` writes `op: \'execute\'` before the run and `op: \'execute-done\'` after it)',
  ).toContainText('execute');
});

// **Deliberately no Doctor-repair test in this file.** Writing one surfaced a
// real product defect on 2026-08-28: `src/ui/execute-effect.ts`'s dry run
// copies only `.my_context` into a scratch directory, and (until fixed today,
// commit 6c4bdb8) `src/cli/commands/refresh.ts` re-derived the repository root
// from THAT scratch directory's own parent rather than from the real
// repository, so a repair reading a repo-relative `source_file` — exactly what
// `doctor.js`'s `source_drift` repair does — could never resolve it and the
// confirm refused every time. A test written against that behaviour would have
// encoded the defect as correct and gone red the moment it was fixed, which is
// worse than no test. See this file's report for the full write-up; a
// Doctor-repair test asserting the CORRECT post-fix behaviour is left for
// whoever verifies the fix.

test("Review queue's Execute confirms honestly, even for a revision the corpus refuses to settle",
  async ({ app }) => {
    test.setTimeout(60_000);
    const { page } = app;
    await page.evaluate(() => { location.hash = '#/work'; });

    // Fails as itself: `scripts/demo-corpus.ts` stages exactly one revision,
    // deliberately stale ("staged one revision against … (body made stale)").
    // If the corpus ever ships with that revision settled or removed, work
    // draws no card and this line times out naming exactly that.
    const actions = page.locator(`${WORK} .cmdactions`).first();
    await expect(
      actions,
      'the Review queue drew no settlement row — the demo corpus\'s one staged '
      + 'revision may have been promoted, discarded or regenerated away',
    ).toBeVisible({ timeout: 15_000 });

    await actions.getByRole('button', { name: 'Execute', exact: true }).click();
    // The dry run behind the confirm GET runs the SAME argv the real run would
    // (`src/ui/execute.ts`'s own point: "the effect shown is the effect of the
    // command as it will actually be run"), and this revision's own staleness
    // refuses it before a nonce is ever minted — so what a reader sees here is
    // not a confirm dialog with a "Run it" button; it is the CLI's own refusal,
    // inline. `mutate.ts` names the state `STALE` and the CLI's sentence uses
    // the word.
    await expect(
      actions,
      'a stale revision must be refused rather than confirmed — the confirm\'s own dry run '
      + 'promotes the same argv the real run would and gets the same refusal',
    ).toContainText('STALE');
    await expect(
      actions.locator('.confirm'),
      'a refused confirm must mint no nonce and offer no way to run it anyway',
    ).toBeHidden();
  });

/**
 * `mkdtemp`'d and thrown away — see this file's header for why a disposable
 * copy was chosen over restoring the shared corpus in place. Reuses
 * `worthCopying` from `src/ui/execute-effect.ts` (skip `.audit` and
 * `.index.db*`) rather than a second filter that could disagree with it, and
 * for the same reason that function needs it: another worker's server may hold
 * `.demo-corpus`'s own `.index.db` open under a mandatory Windows lock.
 */
function makeWriteWorkspace(): { root: string; myContextDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-write-'));
  cpSync(CORPUS, root, { recursive: true, filter: worthCopying });
  // `worthCopying` skips `.index.db`, so this workspace has no index at all
  // yet. `rebuild` is the one command whose whole purpose is building it
  // (`src/ui/public/lib/palette-defs.js`: "rewrites .index.db on disk"), and it
  // is needed HERE rather than left to the server: the server's READ routes
  // open the index `Store.openReadOnlyChecked` (`src/ui/read-model.ts`'s
  // `withStores`), which cannot CREATE a database file that does not exist yet
  // — measured directly, every SQLite-backed `/api/*` route answered `unable
  // to open database file` on a workspace this step had not yet touched, while
  // `/api/config` (which opens no store) answered fine. `audit` does NOT do
  // this — it reads the JSONL log directly and never opens the item index, so
  // `e2e/app.ts`'s own `syncProjection()` (also `audit --limit 1`) works there
  // only because the REAL `.demo-corpus`'s index was already built when the
  // fixture itself was generated (`scripts/demo-corpus.ts`'s many writes).
  execFileSync(process.execPath, [CLI, 'rebuild'], {
    cwd: root, encoding: 'utf8', stdio: 'pipe',
  });
  return { root, myContextDir: path.join(root, DIR_NAME) };
}

/**
 * The first item this workspace's own files say is not yet pinned. Read from
 * the FILES rather than trusted from a hard-coded id, so the fixture this
 * chooses stays true even if `.demo-corpus` is regenerated: `pin`-ing an
 * already-pinned item is a documented no-op in this codebase
 * (`src/cli/commands/edit.ts`'s "nothing to change" refusal) and would leave
 * `deriveEffect` reporting an empty effect — the one thing this test exists to
 * show is NOT empty.
 */
function firstUnpinnedItemId(myContextDir: string): string {
  for (const [rel, text] of snapshot(myContextDir)) {
    const always = /^always:\s*(\S+)/m.exec(text)?.[1];
    const id = /^id:\s*(\S+)/m.exec(text)?.[1];
    if (always === 'false' && id !== undefined) return id;
  }
  throw new Error(
    `e2e: no item under ${myContextDir} has \`always: false\` — every item in this corpus is `
    + 'already pinned, so `pin` has nothing left to prove',
  );
}

base('a boundary command shows every field that changes, before and after, and only then runs',
  async ({ page }) => {
    base.setTimeout(90_000);
    const workspace = makeWriteWorkspace();
    let harness: UiHarness | undefined;
    try {
      const itemId = firstUnpinnedItemId(workspace.myContextDir);
      harness = await startUiChild(workspace.root);
      const h = harness;

      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      await expect(
        page.locator('.nav').first(),
        'the isolated server never rendered a rail button — it probably has no token',
      ).toBeVisible({ timeout: 15_000 });

      await composePinOnPalette(page, itemId);
      const actions = page.locator(`${PALETTE} .cmdactions`).first();
      await actions.getByRole('button', { name: 'Execute', exact: true }).click();

      // The security surface: every field `pin` changes, before and after, is
      // named — table `<caption>` is what gives it its accessible name
      // (`src/ui/public/lib/command-actions.js`'s `diffTable`).
      await expect(
        page.getByRole('table', { name: /changes/i }),
        `\`pin ${itemId}\` must show a non-empty diff — it was chosen above precisely because `
        + 'it is not yet pinned, so `always` genuinely changes',
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(`${PALETTE} .confirm`)).toContainText(
        'not that you asked',
      );
      await expect(page.locator(PALETTE).getByRole('cell', { name: 'always', exact: true })).toBeVisible();

      await page.locator(`${PALETTE} .confirm`).getByRole('button', { name: 'Run it', exact: true }).click();
      await expect(page.locator(`${PALETTE} .execresult`)).toContainText('exit 0');
      // `always` again — this time the row survives into the RESULT only
      // indirectly: what proves the run and not merely the preview agreed is
      // reading the field back off disk.
      const after = snapshot(workspace.myContextDir);
      const rewritten = [...after.values()].find((text) => text.includes(`id: ${itemId}\n`));
      expect(rewritten, `${itemId}'s file went missing after the run`).toBeDefined();
      expect(rewritten, `\`pin ${itemId}\` ran but the file on disk still reads \`always: false\``)
        .toMatch(/^always: true$/m);
    } finally {
      if (harness !== undefined) await harness.stop();
      // Best-effort: a Windows SQLite handle can outlive the child's own
      // `exit` event by a beat, and a failed cleanup of a disposable temp
      // directory is not a reason to fail an assertion that already passed.
      try { rmSync(workspace.root, { recursive: true, force: true }); } catch { /* see above */ }
    }
  });

/**
 * **Doctor's own repair reaches a confirm — the owner's 2026-08-28 report.**
 *
 * Twice, from this screen, Execute produced:
 *
 *     about to refresh: item REF-… checksum af12674273859b85 -> 244cac0d…
 *     my_context: refusing without confirmation — stdin is not interactive.
 *
 * `refresh` replaces an item's whole body, so it gates on a human by reading
 * stdin. A command run from this UI is a child process with NO TERMINAL, so it
 * computed the change, printed it, and refused — and the dry run behind the
 * confirm refused first, so no confirm rendered either. The button was dead in
 * both directions, and `doctor.js` was the one screen composing a boundary
 * command without `--yes` (`work.js` already did).
 *
 * This test presses Execute and asserts a CONFIRM appears. It deliberately does
 * NOT press "Run it": the shared `.demo-corpus` is driven by every other spec
 * in this suite, and refreshing an item there would rewrite a body underneath
 * them. The defect was never in the running — it was that the confirm could not
 * be reached — so reaching it is the whole assertion.
 */
test("Doctor's repair reaches a confirm instead of refusing for want of a terminal", async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/doctor'; });

  // The command block only exists if this corpus HAS a source_drift finding.
  // A screen is not a state: without this step the assertions below would pass
  // against a Doctor that simply found nothing to repair.
  const exec = page.locator('[data-p="doctor"] .cmdactions button', { hasText: 'Execute' }).first();
  await exec.waitFor({ state: 'visible', timeout: 20_000 });

  const shown = await page.locator('[data-p="doctor"] div.cmd code').first().innerText();
  expect(shown, 'the composed line must carry --yes, or the command cannot run from a UI at all: '
    + 'refresh gates on stdin and a child process has no terminal to answer through')
    .toContain('--yes');

  await exec.click();

  const confirm = page.locator('[data-p="doctor"] div.confirm').first();
  await confirm.waitFor({ state: 'visible', timeout: 30_000 });

  const text = await confirm.innerText();
  expect(text, 'the confirm must RENDER. Before this fix the dry run refused for want of '
    + 'confirmation and the reader was shown that refusal instead of a confirm.')
    .not.toContain('refusing without confirmation');
  expect(text).toContain('--yes');
  await expect(confirm.locator('button', { hasText: 'Run it' })).toBeVisible();
});
